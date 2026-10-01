/** The session-scoped store every read hook goes through: one entry per key, and stub ownership. */

import { toError } from "./toError.js";

/** Default time an unobserved entry lives before the cache releases what it holds. */
export const RESOURCE_IDLE_MS = 10_000;

/**
 * How long a settled entry waits for the render that started it to commit. Independent of
 * `idleMs`, which may be zero: a load whose reader never commits (a route change mid-load,
 * a prefetch nobody reads) has no effect to release it.
 */
const ABANDON_MS = 1_000;

/** The value, and a `release` for the stubs it borrows, run at most once per entry. */
export interface OwnedValue<T> {
  value: T;
  release?: () => void;
  /** Reloads the same capability without replacing its action state or ownership. */
  refresh?: () => Promise<T>;
}

export type Loader<T> = () => Promise<OwnedValue<T>>;

/** Covers asynchronous acquisition before the incoming entity's key is known. */
export interface ResourceAcquisition {
  isCurrent: (key: string) => boolean;
  release: () => void;
}

/** Internal ownership of one entry generation, never of its replacement. */
export interface ResourceLease<T> {
  snapshot: () => Snapshot<T>;
  ready: Promise<void>;
  refresh: () => Promise<void>;
  setLoader: (load: Loader<T>) => void;
  release: () => void;
}

export type EntryStatus = "missing" | "pending" | "success" | "error";

/** What a reader sees. `isRefetching` means a settled entry has a reload in flight. */
export interface Snapshot<T> {
  status: Exclude<EntryStatus, "missing">;
  value: T | undefined;
  error: Error | undefined;
  isRefetching: boolean;
}

interface Entry<T> {
  status: "pending" | "success" | "error";
  leases: number;
  /** Identifies the in-flight load allowed to settle this entry. */
  run: Promise<void> | undefined;
  value: T | undefined;
  error: Error | undefined;
  release: (() => void) | undefined;
  refresh: (() => Promise<T>) | undefined;
  /** Rebuilt on any mutation, so `useSyncExternalStore` sees a new identity exactly then. */
  snapshot: Snapshot<T>;
}

type AnyEntry = Entry<unknown>;

/**
 * Keyed cache of loads, owning the stubs its loaders acquired.
 *
 * Ownership is the cache's, not the reader's: N readers of one key share one entry and one
 * set of stubs. An entry is released once unobserved for `idleMs`, or when the cache closes
 * with the session; one settling after `close()` is released on arrival rather than stored.
 *
 * `refetch` reloads without dropping what is there, so a reader does not blank; the old
 * stubs go only once the replacement is stored. `invalidate` drops instead, for a create or
 * delete whose stale list is worth nothing.
 */
export class ResourceCache {
  #entries = new Map<string, AnyEntry>();
  /** Mounted readers per key. Zero, with an entry present, means the idle timer is armed. */
  #observers = new Map<string, number>();
  #timers = new Map<string, ReturnType<typeof setTimeout>>();
  #listeners = new Set<() => void>();
  /** Loaders outlive their entries so `refetch` can re-run one after a drop. */
  #loaders = new Map<string, Loader<unknown>>();
  #closed = false;
  #generation = 0;
  #acquisitions = new Set<((key: string) => boolean)[]>();
  #idleMs: number;

  constructor(idleMs: number = RESOURCE_IDLE_MS) {
    this.#idleMs = idleMs;
  }

  /**
   * The entry as data, starting the load if it has none. Identity is stable between
   * mutations, so a `useSyncExternalStore` reader neither loops nor misses a change.
   */
  snapshot<T>(key: string, load: Loader<T>): Snapshot<T> {
    return this.#ensure(key, load).snapshot;
  }

  /** The entry `key` already has, or `undefined`. Starts nothing. */
  peekSnapshot<T>(key: string): Snapshot<T> | undefined {
    return (this.#entries.get(key) as Entry<T> | undefined)?.snapshot;
  }

  /** Whether `key` has settled, for a caller that must not start a load. */
  peek(key: string): EntryStatus {
    return this.#entries.get(key)?.status ?? "missing";
  }

  /** Capture before RPC and release in finally after adoption or failure. */
  beginAcquisition(): ResourceAcquisition {
    const generation = this.#generation;
    const invalidations: ((key: string) => boolean)[] = [];
    this.#acquisitions.add(invalidations);
    let released = false;
    return {
      isCurrent: (key) =>
        !released &&
        !this.#closed &&
        generation === this.#generation &&
        !invalidations.some((matches) => matches(key)),
      release: () => {
        released = true;
        invalidations.length = 0;
        this.#acquisitions.delete(invalidations);
      },
    };
  }

  /**
   * Consumes `incoming`, including when refused. The first reserved entry wins;
   * incoming values never replace pending, failed, or refreshing entries.
   * `load`, not the adoption candidate, remains the refresh acquisition.
   */
  retain<T>({
    key,
    load,
    incoming,
    acquisition,
  }: {
    key: string;
    load: Loader<T>;
    incoming?: OwnedValue<T>;
    acquisition?: ResourceAcquisition;
  }): ResourceLease<T> {
    if (this.#closed || (acquisition && !acquisition.isCurrent(key))) {
      incoming?.release?.();
      throw new Error("The resource acquisition was revoked.");
    }
    let entry = this.#entries.get(key) as Entry<T> | undefined;
    if (entry) {
      incoming?.release?.();
    } else {
      entry = this.#start(
        key,
        incoming ? () => Promise.resolve(incoming) : load,
      );
    }
    this.#loaders.set(key, load as Loader<unknown>);
    entry.leases += 1;
    const timer = this.#timers.get(key);
    if (timer !== undefined) clearTimeout(timer);
    this.#timers.delete(key);
    const retained = entry;
    let released = false;
    return {
      snapshot: () => retained.snapshot,
      ready:
        retained.run ??
        (retained.status === "error"
          ? this.#handledRejection(retained.error)
          : Promise.resolve()),
      refresh: () =>
        !released && this.#entries.get(key) === retained
          ? this.refetch(key)
          : Promise.resolve(),
      setLoader: (next) => {
        if (!released && this.#entries.get(key) === retained)
          this.#loaders.set(key, next as Loader<unknown>);
      },
      release: () => {
        if (released) return;
        released = true;
        retained.leases -= 1;
        if (this.#entries.get(key) === retained) this.#arm(key);
      },
    };
  }

  #handledRejection(error: unknown): Promise<void> {
    const failure = Promise.reject<void>(error);
    failure.catch(() => {});
    return failure;
  }

  /**
   * Adopts a new idle window, re-arming every key that is already counting down. Without
   * the re-arm a provider prop change would take effect only for keys loaded after it.
   */
  setIdleMs(idleMs: number): void {
    if (idleMs === this.#idleMs) return;
    this.#idleMs = idleMs;
    for (const key of [...this.#timers.keys()]) {
      const timer = this.#timers.get(key);
      if (timer !== undefined) clearTimeout(timer);
      this.#timers.delete(key);
      this.#arm(key);
    }
  }

  /**
   * Registers interest in `key`, cancelling its idle release; the returned function drops it
   * and re-arms the timer. Counted per key rather than per entry, so an invalidation between
   * a reader's render and its effect does not strand the count.
   */
  observe(key: string): () => void {
    const timer = this.#timers.get(key);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.#timers.delete(key);
    }
    this.#observers.set(key, (this.#observers.get(key) ?? 0) + 1);

    let dropped = false;
    return () => {
      if (dropped) return;
      dropped = true;
      const remaining = (this.#observers.get(key) ?? 1) - 1;
      if (remaining > 0) this.#observers.set(key, remaining);
      else this.#observers.delete(key);
      this.#arm(key);
    };
  }

  /**
   * Reloads `key` in place, keeping its settled value and stubs until the new load lands. A
   * failed reload leaves the old value standing, reported by `isRefetching` dropping back
   * to false rather than by replacing it with an error. Its promise rejects on failure.
   * Concurrent callers share the in-flight completion.
   */
  refetch(key: string): Promise<void> {
    const entry = this.#entries.get(key);
    if (!entry) return Promise.resolve();
    if (entry.run) return entry.run;
    const load = this.#loaders.get(key);
    if (!load) return Promise.resolve();

    const inPlace = entry.status === "success" ? entry.refresh : undefined;
    const run: Promise<void> = Promise.resolve()
      .then(() =>
        inPlace
          ? inPlace().then((value) => ({
              value,
              release: entry.release,
              refresh: inPlace,
            }))
          : load(),
      )
      .then(
        (resource) => {
          const current = this.#entries.get(key);
          // The key was dropped, superseded, or the cache closed while this reload was in
          // flight: the stubs it acquired belong to nobody.
          if (!current || current.run !== run || this.#closed) {
            if (!inPlace) resource.release?.();
            return;
          }
          // The old value's stubs go only once the new ones are stored, so a reader that
          // re-renders between the two never sees a released stub.
          const stale = inPlace ? undefined : current.release;
          current.status = "success";
          current.value = resource.value;
          current.error = undefined;
          current.release = resource.release;
          current.refresh = resource.refresh;
          current.run = undefined;
          this.#refresh(current, false);
          stale?.();
          // A reload nothing is watching still has to be swept, or its stubs outlive the
          // reader that asked for it.
          this.#arm(key, ABANDON_MS);
          this.#notify();
        },
        (caught: unknown) => {
          const current = this.#entries.get(key);
          if (current && current.run === run) {
            current.run = undefined;
            if (current.status === "error") current.error = toError(caught);
            this.#refresh(current, false);
            this.#arm(key, ABANDON_MS);
            this.#notify();
          }
          throw toError(caught);
        },
      );

    entry.run = run;
    this.#refresh(entry, true);
    this.#notify();
    // Existing fire-and-forget readers may ignore completion; awaiters still reject.
    run.catch(() => {});
    return run;
  }

  /** Drops `key` and releases what it held; a load still in flight settles and is released
   * on arrival. */
  invalidate(key: string): void {
    for (const invalidations of this.#acquisitions)
      invalidations.push((candidate) => candidate === key);
    this.#drop(key);
    this.#notify();
  }

  /** Drops every key whose name starts with `prefix`. */
  invalidatePrefix(prefix: string): void {
    this.invalidateMatching((key) => key.startsWith(prefix));
  }

  /** Drops every key `predicate` accepts, for a caller matching past the session token
   * a key is scoped by. */
  invalidateMatching(predicate: (key: string) => boolean): void {
    for (const invalidations of this.#acquisitions)
      invalidations.push(predicate);
    for (const key of [...this.#entries.keys()]) {
      if (predicate(key)) this.#drop(key);
    }
    this.#notify();
  }

  /** Refetches every key whose name starts with `prefix`, keeping each value on screen. */
  refetchPrefix(prefix: string): void {
    for (const key of [...this.#entries.keys()]) {
      if (key.startsWith(prefix)) this.refetch(key);
    }
  }

  /** Fires whenever an entry changes, so a mounted reader re-renders into it. */
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /** Revokes acquisitions without disconnecting mounted readers from the store. */
  revoke(): void {
    this.#generation += 1;
    for (const invalidations of this.#acquisitions) invalidations.length = 0;
    this.#acquisitions.clear();
    for (const key of [...this.#entries.keys()]) this.#drop(key);
    this.#loaders.clear();
    this.#notify();
  }

  /** Releases everything and refuses to store a load still in flight. The next read
   * reopens it. */
  close(): void {
    this.#closed = true;
    this.#listeners.clear();
    this.revoke();
    this.#observers.clear();
    this.#loaders.clear();
  }

  get size(): number {
    return this.#entries.size;
  }

  get pendingAcquisitions(): number {
    return this.#acquisitions.size;
  }

  #ensure<T>(key: string, load: Loader<T>): Entry<T> {
    // React's StrictMode tears a tree down and remounts it; a read after close is that
    // remount, not a leak, so reopen rather than hand back an entry nothing will store.
    this.#closed = false;
    this.#loaders.set(key, load as Loader<unknown>);
    const existing = this.#entries.get(key) as Entry<T> | undefined;
    if (existing) return existing;
    return this.#start(key, load);
  }

  #start<T>(key: string, load: Loader<T>): Entry<T> {
    const settle = (apply: (entry: Entry<T>) => void): boolean => {
      const current = this.#entries.get(key) as Entry<T> | undefined;
      if (!current || current.run !== run || this.#closed) return false;
      apply(current);
      current.run = undefined;
      this.#refresh(current, false);
      return true;
    };

    const run: Promise<void> = Promise.resolve()
      .then(load)
      .then(
        (resource) => {
          const stored = settle((current) => {
            current.status = "success";
            current.value = resource.value;
            current.release = resource.release;
            current.refresh = resource.refresh;
          });
          // Armed on the abandonment window, not `idleMs`: the reader that started this load
          // has not committed yet, and a zero idle window would drop the entry underneath it
          // and hand its next render a different stub.
          if (stored) this.#arm(key, ABANDON_MS);
          else resource.release?.();
          this.#notify();
        },
        (caught: unknown) => {
          const stored = settle((current) => {
            current.status = "error";
            current.error = toError(caught);
          });
          if (stored) this.#arm(key, ABANDON_MS);
          this.#notify();
          throw toError(caught);
        },
      );
    // Initial reads report failure in the snapshot; refresh callers may also await it.
    run.catch(() => {});

    const entry: Entry<T> = {
      status: "pending",
      leases: 0,
      run,
      value: undefined,
      error: undefined,
      release: undefined,
      refresh: undefined,
      snapshot: {
        status: "pending",
        value: undefined,
        error: undefined,
        isRefetching: false,
      },
    };
    this.#entries.set(key, entry as AnyEntry);
    return entry;
  }

  #refresh<T>(entry: Entry<T>, isRefetching: boolean): void {
    entry.snapshot = {
      status: entry.status,
      value: entry.value,
      error: entry.error,
      isRefetching,
    };
  }

  /** Starts the countdown, unless a reader holds the key or one is already running. */
  #arm(key: string, ms = this.#idleMs): void {
    if (
      !this.#entries.has(key) ||
      (this.#entries.get(key)?.leases ?? 0) > 0 ||
      this.#observers.has(key) ||
      this.#timers.has(key)
    )
      return;
    const timer = setTimeout(() => {
      this.#timers.delete(key);
      if (!this.#observers.has(key)) {
        this.#drop(key);
        this.#notify();
      }
    }, ms);
    // jsdom keeps the process alive on a pending timer; Node's unref is absent in the
    // browser, so it is optional.
    (timer as unknown as { unref?: () => void }).unref?.();
    this.#timers.set(key, timer);
  }

  #drop(key: string): void {
    const timer = this.#timers.get(key);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.#timers.delete(key);
    }
    const entry = this.#entries.get(key);
    this.#entries.delete(key);
    if (entry) {
      entry.status = "error";
      entry.value = undefined;
      entry.error = new Error("The resource entry was released.");
      this.#refresh(entry, false);
    }
    entry?.release?.();
  }

  #notify(): void {
    for (const listener of [...this.#listeners]) {
      try {
        listener();
      } catch {
        // One reader's failure is its own.
      }
    }
  }
}
