import type { ConfigurationOperationError, Result } from "./protocol/index.js";
import { toPrismaticError } from "./errors.js";
import type { PrismaticError } from "./resource.js";

export type Action<I, O, E extends PrismaticError = PrismaticError> = {
  execute: (input: I) => Promise<Result<O, E>>;
} & (
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: O }
  | { status: "error"; error: E }
);

/** Framework-neutral observation of an action's current execution state. */
export interface ActionHandle<I, O, E extends PrismaticError = PrismaticError> {
  getSnapshot: () => Action<I, O, E>;
  subscribe: (listener: () => void) => () => void;
}

export const toConfigurationError =
  /* @__PURE__ */ toPrismaticError<ConfigurationOperationError>([
    "PRISMATIC_CONFIGURATION_INVALID",
    "PRISMATIC_CONFIGURATION_UNAVAILABLE",
    "PRISMATIC_CONFIGURATION_FORBIDDEN",
    "PRISMATIC_CONNECTION_UNAVAILABLE",
    "PRISMATIC_INSTANCE_REMOVED",
  ]);

export type DisposableActionHandle<
  I,
  O,
  E extends PrismaticError = ConfigurationOperationError,
> = ActionHandle<I, O, E> & { dispose: () => void };

/** One call at a time per action; independent handles never share execution state. */
export const createAction = <
  I,
  O,
  E extends PrismaticError = ConfigurationOperationError,
>({
  execute: run,
  // Callers that pick another error type pass their own mapper.
  toError = toConfigurationError as unknown as (error: unknown) => E,
}: {
  execute: (input: I) => Promise<Result<O, E>>;
  toError?: (error: unknown) => E;
}): DisposableActionHandle<I, O, E> => {
  let disposed = false;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        // A subscriber must not turn a completed operation into a rejected promise.
      }
    }
  };
  const unavailable = (
    code: "PRISMATIC_ACTION_DISPOSED" | "PRISMATIC_ACTION_BUSY",
  ): Result<O, E> => ({
    status: "error",
    error: {
      name: "Error",
      code,
      message:
        code === "PRISMATIC_ACTION_DISPOSED"
          ? "Action was released."
          : "Action is already running.",
    } as E,
  });
  const publish = (next: Action<I, O, E>) => {
    if (disposed) return;
    snapshot = next;
    notify();
  };
  const execute = async (input: I): Promise<Result<O, E>> => {
    if (disposed) return unavailable("PRISMATIC_ACTION_DISPOSED");
    if (snapshot.status === "loading")
      return unavailable("PRISMATIC_ACTION_BUSY");
    publish({ status: "loading", execute });
    if (disposed) return unavailable("PRISMATIC_ACTION_DISPOSED");
    let result: Result<O, E>;
    try {
      result = await run(input);
    } catch (error) {
      result = { status: "error", error: toError(error) };
    }
    if (disposed) return unavailable("PRISMATIC_ACTION_DISPOSED");
    publish({ ...result, execute });
    return result;
  };
  let snapshot: Action<I, O, E> = {
    status: "idle",
    execute,
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      if (disposed) return () => {};
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      snapshot = { ...unavailable("PRISMATIC_ACTION_DISPOSED"), execute };
      notify();
      listeners.clear();
    },
  };
};
