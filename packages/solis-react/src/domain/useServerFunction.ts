import type {
  ConfigurationResource,
  ServerFunctionAction,
  UserConfigurationResource,
} from "@prismatic-io/solis-core";
import { useEffect, useRef } from "react";
import {
  createServerFunctionHandle,
  type ServerFunctionHandle,
  serverFunctionSourceOf,
} from "../internal/serverFunctions.js";
import { useAction } from "./useAction.js";

/**
 * One server function of a configuration, as an action this component owns: a stable
 * identity and a status of its own, released when the component unmounts. It runs against
 * the integration version the configuration is for. Separate calls are separate actions, so
 * several runs of the same function proceed side by side. Before the configuration loads,
 * `execute` resolves to an error.
 */
export const useServerFunction = <TInputs = unknown, TOutput = unknown>(
  configuration: ConfigurationResource | UserConfigurationResource,
  key: string,
): ServerFunctionAction<TInputs, TOutput> => {
  const source = serverFunctionSourceOf(configuration);
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const scope = source?.scope ?? null;
  const owned = useRef<{
    scope: string | null;
    key: string;
    handle: ServerFunctionHandle;
  } | null>(null);
  if (
    !owned.current ||
    owned.current.scope !== scope ||
    owned.current.key !== key
  )
    owned.current = {
      scope,
      key,
      handle: createServerFunctionHandle({ key, source: sourceRef }),
    };
  const { handle } = owned.current;
  useEffect(() => handle.retain(), [handle]);
  return useAction(handle.action) as unknown as ServerFunctionAction<
    TInputs,
    TOutput
  >;
};
