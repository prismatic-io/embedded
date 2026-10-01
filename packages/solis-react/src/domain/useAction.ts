import type {
  Action,
  ActionHandle,
  PrismaticError,
} from "@prismatic-io/solis-core";
import { useSyncExternalStore } from "react";
import { useResourceError } from "../PrismaticProvider.js";

export const useAction = <I, O, E extends PrismaticError>(
  handle: ActionHandle<I, O, E>,
): Action<I, O, E> => {
  const action = useSyncExternalStore(
    handle.subscribe,
    handle.getSnapshot,
    handle.getSnapshot,
  );
  useResourceError(action.status === "error" ? action.error : undefined);
  return action;
};
