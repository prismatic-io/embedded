/** Acquiring RPC results and owning their lifetimes. */

import { disposeAll, disposeQuietly } from "@prismatic-io/solis-core/internal";
import { type DependencyList, useEffect, useState } from "react";
import { toError } from "./toError.js";

export type StubState<T> =
  | { status: "loading"; value: undefined; error: undefined }
  | { status: "ready"; value: T; error: undefined }
  | { status: "error"; value: undefined; error: Error };

const LOADING = {
  status: "loading",
  value: undefined,
  error: undefined,
} as const;

const isDev = () => process.env.NODE_ENV !== "production";

/**
 * Acquires one stub and owns its lifetime: `acquire` runs after commit, a result
 * superseded by newer `deps` is disposed rather than stored, and what it holds is
 * disposed when replaced or unmounted. Pass `null` to stay in `loading` without acquiring.
 * The value is borrowed — take your own with `.dup()` to outlive the owner. Throws in
 * development on an array, which {@link useStubList} owns instead.
 */
export const useStub = <T>(
  acquire: (() => PromiseLike<T> | T | null | undefined) | null | undefined,
  deps: DependencyList,
): StubState<T> => {
  const [state, setState] = useState<StubState<T>>(LOADING);

  useEffect(() => {
    if (!acquire) {
      setState(LOADING);
      return;
    }

    let cancelled = false;
    let acquired: T | undefined;
    setState(LOADING);

    const run = async () => {
      try {
        const result = await acquire();
        if (result === null || result === undefined) return;
        if (isDev() && Array.isArray(result)) {
          throw new Error(
            "useStub acquired an array, whose elements it cannot dispose. Use useStubList.",
          );
        }
        if (cancelled) {
          disposeQuietly(result);
          return;
        }
        acquired = result;
        setState({ status: "ready", value: result, error: undefined });
      } catch (error) {
        if (cancelled) return;
        setState({ status: "error", value: undefined, error: toError(error) });
      }
    };

    void run();

    return () => {
      cancelled = true;
      disposeQuietly(acquired);
      acquired = undefined;
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: caller-owned deps
  }, deps);

  return state;
};

/**
 * Acquires a collection of stubs and releases it — container and elements — on unmount,
 * superseded deps, or a late landing.
 */
export const useStubList = <T>(
  acquire:
    | (() => PromiseLike<readonly T[]> | readonly T[] | null | undefined)
    | null
    | undefined,
  deps: DependencyList,
): StubState<readonly T[]> => {
  const [state, setState] = useState<StubState<readonly T[]>>(LOADING);

  useEffect(() => {
    if (!acquire) {
      setState(LOADING);
      return;
    }

    let cancelled = false;
    let acquired: readonly T[] | undefined;
    setState(LOADING);

    const run = async () => {
      try {
        const result = await acquire();
        if (result === null || result === undefined) return;
        if (cancelled) {
          disposeAll(result);
          return;
        }
        acquired = result;
        setState({ status: "ready", value: result, error: undefined });
      } catch (error) {
        if (cancelled) return;
        setState({ status: "error", value: undefined, error: toError(error) });
      }
    };

    void run();

    return () => {
      cancelled = true;
      disposeAll(acquired);
      acquired = undefined;
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: caller-owned deps
  }, deps);

  return state;
};
