import type {
  ConfigurationState,
  InitializeConfigurationInput,
  SaveConfigurationInput,
} from "@prismatic-io/solis-core/protocol";
import type {
  AuthedHandle,
  ConfigurationResource,
} from "@prismatic-io/solis-core";
import { toConfigurationError } from "@prismatic-io/solis-core/internal";
import { useCallback, useMemo } from "react";
import { useConfigurationConnections } from "../internal/configurationConnections.js";
import {
  type LoadedConfiguration,
  loadConfigurationResource,
} from "../internal/configurationResource.js";
import { keys } from "../internal/keys.js";
import { carryServerFunctionSource } from "../internal/serverFunctions.js";
import { toResource } from "../internal/toResource.js";
import { unavailableAction } from "../internal/unavailableAction.js";
import { useRead } from "../internal/useResource.js";
import { useResourceRefreshAction } from "../internal/useResourceRefreshAction.js";
import { useSelector } from "../internal/useSelector.js";
import {
  useResourceCache,
  useSessionState,
  useSessionToken,
} from "../PrismaticProvider.js";
import { useAction } from "./useAction.js";
import { useFeature } from "./useFeature.js";

const NOT_LOADED = "Configuration is not loaded.";
const unavailableInit = unavailableAction<
  InitializeConfigurationInput,
  unknown
>(NOT_LOADED);
const unavailableSave = unavailableAction<SaveConfigurationInput, void>(
  NOT_LOADED,
);

export interface ConfigurationInput {
  instanceId: string | null | undefined;
  /** A newer version to review before moving to it. Defaults to the instance's current one. */
  integrationVersionId?: string;
}

/**
 * One instance's configuration for one integration version. Everything on it follows that
 * version: schema, server functions, permissions, init and save. Saving a newer version's
 * configuration also moves the instance to it. Saved values are on `useInstance`; the host
 * owns every unsaved value. `data.connections` loads in the background once this has loaded.
 */
export const useConfiguration = ({
  instanceId,
  integrationVersionId,
}: ConfigurationInput): ConfigurationResource => {
  const session = useSessionState();
  const cache = useResourceCache();
  const token = useSessionToken();
  const requireInstances = useFeature("instances");
  const requireConfiguration = useFeature("configuration");
  const guard = useCallback(() => {
    requireInstances();
    requireConfiguration();
  }, [requireInstances, requireConfiguration]);
  const key = instanceId
    ? keys.configuration(instanceId, { integrationVersionId })
    : null;
  const load = useCallback(
    (api: AuthedHandle) =>
      loadConfigurationResource({
        api,
        guard,
        instanceId: instanceId ?? "",
        integrationVersionId,
      }),
    [guard, instanceId, integrationVersionId],
  );
  const read = useRead<LoadedConfiguration>(
    useMemo(() => (key ? { key, load } : null), [key, load]),
  );
  const selected = useSelector<ConfigurationState>(read.data?.stub);
  const init = useAction(read.data?.init ?? unavailableInit);
  const save = useAction(read.data?.save ?? unavailableSave);
  const refresh = useResourceRefreshAction({ key, guard });
  const actions = useMemo(() => {
    const value = { refresh, init, save };
    if (key)
      carryServerFunctionSource(value, {
        scope: key,
        owner: () =>
          cache.peekSnapshot<LoadedConfiguration>(`${token}:${key}`)?.value
            ?.functions,
        guard,
      });
    return value;
  }, [refresh, init, save, key, cache, token, guard]);

  const state =
    read.data &&
    (selected.status === "ready" ? selected.value : read.data.state);
  const connections = useConfigurationConnections({
    ownerKey: key,
    integrationId: state?.integrationId,
    guard,
    loadOwner: load,
  });
  const data = useMemo(
    () => (state ? { ...state, connections } : undefined),
    [state, connections],
  );

  return toResource({
    enabled: Boolean(instanceId),
    error:
      session.error ??
      read.error ??
      (selected.status === "error" ? selected.error : null),
    data,
    isRefreshing: read.isRefetching || refresh.status === "loading",
    actions,
    toError: toConfigurationError,
  });
};
