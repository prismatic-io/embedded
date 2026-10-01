import type {
  ActionHandle,
  ConfigurationError,
  PrismaticError,
} from "@prismatic-io/solis-core";

/** Stands in for an action whose owning resource has not loaded; it never changes state. */
export const unavailableAction = <
  I,
  O,
  E extends PrismaticError = ConfigurationError,
>(
  message: string,
  code: E["code"] = "PRISMATIC_CONFIGURATION_UNAVAILABLE",
): ActionHandle<I, O, E> => {
  const snapshot = {
    status: "idle" as const,
    execute: async (_input: I) => ({
      status: "error" as const,
      error: { name: "Error", code, message } as E,
    }),
  };
  return { getSnapshot: () => snapshot, subscribe: () => () => {} };
};
