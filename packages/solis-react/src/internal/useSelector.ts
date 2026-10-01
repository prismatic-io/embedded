/** Observing a stub's `state()` and re-rendering only on the slice a caller asked for. */

import {
  observeState,
  observeStateList,
  type SharedState,
  type SharedStateStatus,
  type Stateful,
} from "@prismatic-io/solis-core/internal";
import {
  type DependencyList,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { useResourceError, useResourceErrors } from "../PrismaticProvider.js";

export type SelectionState<S> =
  | { status: "loading"; value: undefined; error: undefined }
  | { status: "ready"; value: S; error: undefined }
  | { status: "error"; value: undefined; error: Error };

export interface ListSelectionState<S> {
  status: "loading" | "partial" | "ready" | "error";
  /** Positional against the targets; `values[i]` stays `undefined` until target `i` emits. */
  values: readonly (S | undefined)[];
  error: Error | undefined;
}

const LOADING = {
  status: "loading",
  value: undefined,
  error: undefined,
} as const;

const identity = <T>(value: T) => value as unknown;

const noop = () => {};

interface ListObservation<S> extends ListSelectionState<S> {
  errors: readonly (Error | undefined)[];
}

const EMPTY_LIST: ListObservation<never> = {
  status: "loading",
  values: [],
  error: undefined,
  errors: [],
};

interface SnapshotCache<T, S> {
  shared: SharedState<T>;
  status: SharedStateStatus;
  latest: T | undefined;
  error: Error | undefined;
  selection: SelectionState<S>;
}

/**
 * Observes one target's `state()` and re-renders only when the selected slice changes.
 * Every `useSelector` on the same stub joins one `state()` call. `compare` defaults to
 * `Object.is`; supply one when selecting an object or array, which is otherwise a fresh
 * identity on every emission. `selector` and `compare` are read through refs, so an
 * inline function does not resubscribe and an abandoned render's selector never takes effect.
 */
export const useSelector = <T, S = T>(
  target: Stateful<T> | null | undefined,
  selector: (state: T) => S = identity as (state: T) => S,
  compare: (a: S, b: S) => boolean = Object.is,
  deps: DependencyList = [target],
): SelectionState<S> => {
  const selectorRef = useRef(selector);
  const compareRef = useRef(compare);

  useLayoutEffect(() => {
    selectorRef.current = selector;
    compareRef.current = compare;
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: caller-owned deps
  const observed = useMemo(() => target, deps);
  const cache = useRef<SnapshotCache<T, S> | undefined>(undefined);
  /** Resolved in `subscribe` rather than during render, which must stay pure. */
  const sharedRef = useRef<{
    target: Stateful<T>;
    state: SharedState<T>;
  } | null>(null);

  const subscribe = useCallback(
    (listener: () => void) => {
      if (!observed) return noop;
      const shared = observeState(observed);
      sharedRef.current = { target: observed, state: shared };
      const off = shared.subscribe(listener);
      return () => {
        off();
        if (sharedRef.current?.state === shared) sharedRef.current = null;
      };
    },
    [observed],
  );

  /** Must return the identical object until an input changed, or React loops on
   * "getSnapshot should be cached". */
  const getSnapshot = (): SelectionState<S> => {
    const shared =
      sharedRef.current && sharedRef.current.target === observed
        ? sharedRef.current.state
        : null;
    if (!shared) return LOADING;
    const { status, latest, error } = shared;
    const previous = cache.current;
    if (
      previous &&
      previous.shared === shared &&
      previous.status === status &&
      previous.latest === latest &&
      previous.error === error
    ) {
      return previous.selection;
    }

    let selection: SelectionState<S>;
    if (status === "error" && error) {
      selection = { status: "error", value: undefined, error };
    } else if (latest === undefined) {
      selection = LOADING;
    } else if (
      previous &&
      previous.shared === shared &&
      previous.selection.status === "ready" &&
      previous.latest === latest
    ) {
      // Only the status moved (ready to closed): the value stands.
      selection = previous.selection;
    } else {
      const next = selectorRef.current(latest);
      const last =
        previous && previous.shared === shared ? previous.selection : undefined;
      selection =
        last?.status === "ready" && compareRef.current(last.value, next)
          ? last
          : { status: "ready", value: next, error: undefined };
    }

    cache.current = { shared, status, latest, error, selection };
    return selection;
  };

  const getServerSnapshot = (): SelectionState<S> => LOADING;

  const selection = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  useResourceError(selection.error);
  return selection;
};

interface ListCache<S> {
  latest: readonly (unknown | undefined)[];
  status: string;
  errors: readonly (Error | undefined)[];
  selection: ListObservation<S>;
}

const sameElements = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length &&
  a.every((value, index) => Object.is(value, b[index]));

/**
 * Fans out over N targets and rejoins positionally. Targets are compared element-wise, so
 * a caller passing a freshly mapped array on every render keeps the same N streams.
 */
export const useSelectorList = <T, S = T>(
  targets: readonly Stateful<T>[] | null | undefined,
  selector: (state: T) => S = identity as (state: T) => S,
  compare: (a: S, b: S) => boolean = Object.is,
): ListSelectionState<S> => {
  const selectorRef = useRef(selector);
  const compareRef = useRef(compare);

  useLayoutEffect(() => {
    selectorRef.current = selector;
    compareRef.current = compare;
  });

  const stableRef = useRef<readonly Stateful<T>[] | null>(null);
  const incoming = targets ?? null;
  if (
    incoming === null ||
    stableRef.current === null ||
    !sameElements(stableRef.current, incoming)
  ) {
    stableRef.current = incoming;
  }
  const stable = stableRef.current;

  const shared = useMemo(
    () => (stable ? observeStateList(stable) : null),
    [stable],
  );
  const cache = useRef<ListCache<S> | undefined>(undefined);

  const subscribe = useCallback(
    (listener: () => void) => (shared ? shared.subscribe(listener) : noop),
    [shared],
  );

  const getSnapshot = (): ListObservation<S> => {
    if (!shared) return EMPTY_LIST as ListObservation<S>;
    const { status, latest, error, errors } = shared;
    const previous = cache.current;
    if (
      previous &&
      previous.status === status &&
      sameElements(previous.errors, errors) &&
      sameElements(previous.latest, latest)
    ) {
      return previous.selection;
    }

    const last = previous?.selection.values;
    const values = latest.map((state, index) => {
      if (state === undefined) return undefined;
      const next = selectorRef.current(state);
      const prior = last?.[index];
      // Keep the prior slice's identity when it compares equal, so an unchanged re-emit
      // does not re-render.
      return prior !== undefined && compareRef.current(prior, next)
        ? prior
        : next;
    });

    const selection: ListObservation<S> = { status, values, error, errors };
    cache.current = { latest, status, errors, selection };
    return selection;
  };

  const getServerSnapshot = (): ListObservation<S> =>
    EMPTY_LIST as ListObservation<S>;

  const selection = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  useResourceErrors(selection.errors);
  return selection;
};
