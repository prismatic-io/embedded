import type { AuthedHandle } from "@prismatic-io/solis-core";
import { useSessionState } from "../PrismaticProvider.js";

/** The authed handle, or `null` before a jwt. Identity is fresh per token rotation. */
export const useApiHandle = (): AuthedHandle | null => {
  const state = useSessionState();
  return state.status === "ready" ? state.api : null;
};
