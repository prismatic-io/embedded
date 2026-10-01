/** The one reader every read hook goes through, and the two ways to reload a key. */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import {
  useResourceCache,
  useSessionRevoked,
  useSessionToken,
} from "../PrismaticProvider.js";
import type { Loader, OwnedValue, Snapshot } from "./resourceCache.js";
import { useApiHandle } from "./useApiHandle.js";

/** A read's key and the loader behind it. */
export interface ResourceSpec<T> {
  /** Unprefixed; the reader scopes it by the session token. */
  key: string;
  /** Acquires the resource and the `release` for the stubs it took. The cache owns both. */
  load: (
    api: NonNullable<ReturnType<typeof useApiHandle>>,
  ) => Promise<OwnedValue<T>>;
}

/** What every read hook is written against. */
export interface Read<T> {
  status: "pending" | "success" | "error";
  data: T | undefined;
  error: Error | null;
  /** A `refresh()` reload is in flight over a settled value or error. */
  isRefetching: boolean;
  /** Reloads this key in place; the current value stays until the replacement stores. */
  refresh: () => Promise<void>;
}

const PENDING = {
  status: "pending",
  data: undefined,
  error: null,
  isRefetching: false,
} as const;

/**
 * Reads one cache entry, sharing it with every other reader of the same key: N readers of
 * one key acquire one set of stubs. A `null` spec stays `pending` and starts nothing.
 *
 * `refresh` addresses this reader's own key, not its family — a config screen refreshing
 * its instance must not re-list every other instance.
 */
export const useRead = <T>(spec: ResourceSpec<T> | null): Read<T> => {
  const api = useApiHandle();
  const token = useSessionToken();
  const cache = useResourceCache();
  const scoped = api && spec ? `${token}:${spec.key}` : null;
  const load = useLoader(spec, api);

  // Started during render, not in an effect: that is what lets one entry serve a sibling
  // that mounted a commit earlier, rather than each reader starting its own load.
  const started = scoped && load ? cache.snapshot<T>(scoped, load) : null;

  const subscribe = useCallback(
    (listener: () => void) => cache.subscribe(listener),
    [cache],
  );
  // Reads the live entry, never a remembered one: falling back to this render's own
  // snapshot would keep painting a key that has since been invalidated, and never reload.
  const getSnapshot = useCallback(
    (): Snapshot<T> | null =>
      scoped ? (cache.peekSnapshot<T>(scoped) ?? null) : null,
    [cache, scoped],
  );
  const snapshot =
    useSyncExternalStore(subscribe, getSnapshot, () => null) ?? started;

  useObserve(scoped);

  // A revoked session invalidated every stub the cache holds, including the ones behind
  // entries that have not failed yet, so the whole cache goes rather than this key alone.
  const onRevoked = useSessionRevoked();
  const failure = snapshot?.status === "error" ? snapshot.error : undefined;
  useEffect(() => {
    if (failure) onRevoked(failure);
  }, [failure, onRevoked]);

  const refresh = useCallback(() => {
    if (!scoped) return Promise.resolve();
    const completion = cache.refetch(scoped);
    completion.catch(onRevoked);
    return completion;
  }, [cache, scoped, onRevoked]);

  return useMemo((): Read<T> => {
    if (!snapshot) return { ...PENDING, refresh };
    if (snapshot.status === "error") {
      return {
        status: "error",
        data: undefined,
        error: snapshot.error ?? new Error("The read failed."),
        isRefetching: snapshot.isRefetching,
        refresh,
      };
    }
    if (snapshot.status === "success") {
      return {
        status: "success",
        data: snapshot.value as T,
        error: null,
        isRefetching: snapshot.isRefetching,
        refresh,
      };
    }
    return { ...PENDING, refresh };
  }, [snapshot, refresh]);
};

/** Addresses cached reads by unprefixed key or family prefix, under every session token. */
export type Invalidator = (prefix: string) => void;

const unscoped = (key: string) => key.slice(key.indexOf(":") + 1);

/**
 * Drops cached reads, for a write that changed which rows belong in a list it never read.
 * A reader of a dropped key falls back to `pending`, so prefer {@link useRefreshFamily}
 * wherever the stale value is still worth showing. Matches under every session token,
 * since the write may have been the last thing a superseded handle did.
 */
export const useInvalidate = (): Invalidator => {
  const cache = useResourceCache();
  return useCallback<Invalidator>(
    (prefix) => {
      cache.invalidateMatching((key) => unscoped(key).startsWith(prefix));
    },
    [cache],
  );
};

/** Reloads a whole family in place, for a write that moved a field rather than membership. */
export const useRefreshFamily = (): Invalidator => {
  const cache = useResourceCache();
  const token = useSessionToken();
  return useCallback<Invalidator>(
    (prefix) => {
      cache.refetchPrefix(`${token}:${prefix}`);
    },
    [cache, token],
  );
};

/**
 * Pins `load` to an identity tracking the key and the handle, so a caller passing a fresh
 * arrow every render does not reload. A queued load may use the latest same-identity
 * closure, but a later key or session cannot redirect work reserved for this one.
 */
const useLoader = <T>(
  spec: ResourceSpec<T> | null,
  api: ReturnType<typeof useApiHandle>,
): Loader<T> | null => {
  const ref = useRef({ spec, api });
  ref.current = { spec, api };
  const key = spec?.key ?? null;

  return useMemo(() => {
    const captured = ref.current.spec;
    if (key === null || !api || !captured) return null;
    return () => {
      const { spec: current, api: live } = ref.current;
      return (current?.key === key && live === api ? current : captured).load(
        api,
      );
    };
  }, [key, api]);
};

/**
 * Holds the key against the cache's idle sweep while this reader is mounted. Effects run
 * only for a tree that committed, so an entry an abandoned render started is observed by
 * nobody and falls to the abandonment window instead.
 */
const useObserve = (scoped: string | null): void => {
  const cache = useResourceCache();
  useEffect(() => {
    if (!scoped) return;
    return cache.observe(scoped);
  }, [cache, scoped]);
};
