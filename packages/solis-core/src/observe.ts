/** Shared subscriptions to a stub's `state()` stream. */

import { disposeQuietly } from "./dispose.js";

/**
 * Anything exposing the protocol's `state()` convention. The chunk type is phantom;
 * neither capnweb's intersection nor DOM `ReadableStream` is assignable here.
 */
export interface Stateful<T> {
  state(): ReadableStream<T> | PromiseLike<ReadableStream<T>> | (unknown & {});
}

export type SharedStateStatus = "loading" | "ready" | "error" | "closed";

/**
 * One `state()` stream, shared by every observer of the same stub. `latest` reads
 * synchronously, `undefined` until the first emission. `"closed"` means the frame ended
 * the stream; `latest` is kept until the last observer leaves. Listeners are
 * payload-free signals fired on any change of `status` or `latest`.
 */
export interface SharedState<S> {
  readonly status: SharedStateStatus;
  readonly latest: S | undefined;
  readonly error: Error | undefined;
  subscribe(listener: () => void): () => void;
  /** Reopens a failed/closed stream without creating a second observation authority. */
  restart(): void;
}

/**
 * How long a stream stays open after its last observer leaves. A resubscribe inside the
 * window keeps the stream and its `latest`.
 */
export const STATE_RELEASE_GRACE_MS = 50;

type StateStream<T> = {
  getReader(): ReadableStreamDefaultReader<T>;
  cancel(reason?: unknown): Promise<void>;
};

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

/** Keyed by stub identity: two `list()` calls hand out two stubs for one entity, and
 * those stay separate. Weak, so a dropped stub takes its entry with it. */
const registry = new WeakMap<object, Shared<unknown>>();

class Shared<S> implements SharedState<S> {
  status: SharedStateStatus = "loading";
  latest: S | undefined = undefined;
  error: Error | undefined = undefined;

  readonly #target: Stateful<S>;
  readonly #listeners = new Set<() => void>();
  /** Bumped on every open and release; an in-flight pump that sees a mismatch stops. */
  #generation = 0;
  #reader: ReadableStreamDefaultReader<S> | undefined;
  #open = false;
  #releaseTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(target: Stateful<S>) {
    this.#target = target;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    if (this.#releaseTimer !== undefined) {
      clearTimeout(this.#releaseTimer);
      this.#releaseTimer = undefined;
    }
    // A released entry was dropped from the registry; put it back.
    if (registry.get(this.#target) !== this) {
      registry.set(this.#target, this as unknown as Shared<unknown>);
    }
    if (!this.#open) void this.#pump();

    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.#listeners.delete(listener);
      if (this.#listeners.size === 0 && this.#releaseTimer === undefined) {
        this.#releaseTimer = setTimeout(() => {
          this.#releaseTimer = undefined;
          if (this.#listeners.size === 0) this.#release();
        }, STATE_RELEASE_GRACE_MS);
      }
    };
  }

  #notify() {
    for (const listener of this.#listeners) {
      try {
        listener();
      } catch {
        // A listener's failure is its own; the other observers still hear.
      }
    }
  }

  restart() {
    if (this.status !== "error" && this.status !== "closed") return;
    this.#generation += 1;
    this.#reader?.cancel().catch(() => {});
    this.#reader = undefined;
    void this.#pump(true);
    this.#notify();
  }

  async #pump(restarting = false) {
    const generation = ++this.#generation;
    let received = false;
    this.#open = true;
    this.status = "loading";
    this.error = undefined;

    try {
      const stream = (await this.#target.state()) as StateStream<S>;
      if (generation !== this.#generation) {
        await stream.cancel().catch(() => {});
        return;
      }
      const reader = stream.getReader();
      this.#reader = reader;

      while (true) {
        const result = await reader.read();
        if (generation !== this.#generation) return;
        if (result.done) {
          this.status = restarting && !received ? "error" : "closed";
          if (this.status === "error") {
            this.error = new Error(
              "The restarted state stream closed before emitting.",
            );
          }
          this.#notify();
          return;
        }
        received = true;
        const previous = this.latest;
        if (this.status === "ready" && Object.is(previous, result.value))
          continue;
        this.latest = result.value;
        this.status = "ready";
        this.#notify();
        if (previous !== undefined) disposeQuietly(previous);
      }
    } catch (error) {
      if (generation !== this.#generation) return;
      this.status = "error";
      this.error = toError(error);
      this.#notify();
    }
  }

  // capnweb delivers the cancel to the frame lazily, on the frame's next write.
  #release() {
    this.#generation += 1;
    this.#open = false;
    const reader = this.#reader;
    this.#reader = undefined;
    reader?.cancel().catch(() => {});
    const previous = this.latest;
    this.latest = undefined;
    this.error = undefined;
    this.status = "loading";
    disposeQuietly(previous);
    if (registry.get(this.#target) === this) registry.delete(this.#target);
  }
}

/** The first subscriber opens the stream; everyone after joins it. */
export const observeState = <S>(target: Stateful<S>): SharedState<S> => {
  const existing = registry.get(target) as Shared<S> | undefined;
  if (existing) return existing;
  const created = new Shared<S>(target);
  registry.set(target, created as unknown as Shared<unknown>);
  return created;
};

export type SharedListStatus = "loading" | "partial" | "ready" | "error";

/** Aggregate of N {@link SharedState}s, positional against the targets it was built from. */
export interface SharedList<S> {
  readonly status: SharedListStatus;
  /** `latest[i]` stays `undefined` until target `i` emits. */
  readonly latest: readonly (S | undefined)[];
  readonly error: Error | undefined;
  /** Every target's error, positional even when an earlier target has already failed. */
  readonly errors: readonly (Error | undefined)[];
  subscribe(listener: () => void): () => void;
}

/**
 * Fans out over several stubs and rejoins positionally, so a list renders progressively.
 * A `"closed"` target counts as settled, so a deleted row does not hold the list at
 * `"partial"` forever.
 */
export const observeStateList = <S>(
  targets: readonly Stateful<S>[],
): SharedList<S> => {
  const shared = targets.map((target) => observeState(target));

  const settled = (state: SharedState<S>) =>
    state.status === "ready" ||
    state.status === "closed" ||
    state.status === "error";

  return {
    get status(): SharedListStatus {
      if (shared.some((s) => s.status === "error")) return "error";
      if (shared.length === 0 || shared.every(settled)) return "ready";
      return shared.some(settled) ? "partial" : "loading";
    },
    get latest() {
      return shared.map((s) => s.latest);
    },
    get error() {
      return shared.find((s) => s.error)?.error;
    },
    get errors() {
      return shared.map((s) => s.error);
    },
    subscribe(listener: () => void) {
      const offs = shared.map((s) => s.subscribe(listener));
      return () => {
        for (const off of offs) off();
      };
    },
  };
};
