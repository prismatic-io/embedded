import type {
  SaveUserConfigurationInput,
  UserConfigurationState,
} from "@prismatic-io/solis-core/protocol";
import type {
  AuthedHandle,
  UserConfigurationResource,
} from "@prismatic-io/solis-core";
import { toConfigurationError } from "@prismatic-io/solis-core/internal";
import { useCallback, useEffect, useMemo } from "react";
import { useConfigurationConnections } from "../internal/configurationConnections.js";
import { keys } from "../internal/keys.js";
import { carryServerFunctionSource } from "../internal/serverFunctions.js";
import { toResource } from "../internal/toResource.js";
import { unavailableAction } from "../internal/unavailableAction.js";
import { useRead } from "../internal/useResource.js";
import { useResourceRefreshAction } from "../internal/useResourceRefreshAction.js";
import {
  type LoadedUserConfiguration,
  loadUserConfigurationResource,
} from "../internal/userConfigurationResource.js";
import { useSelector } from "../internal/useSelector.js";
import {
  useConfirmedSessionScope,
  useResourceCache,
  useSessionState,
  useSessionToken,
} from "../PrismaticProvider.js";
import { useAction } from "./useAction.js";
import { useFeature } from "./useFeature.js";

const NOT_LOADED = "User configuration is not loaded.";
const unavailableSave = unavailableAction<SaveUserConfigurationInput, void>(
  NOT_LOADED,
);
const unavailableRemove = unavailableAction<void, void>(NOT_LOADED);

/**
 * The signed-in user's own configuration of an instance, always for the instance's current
 * version. All unsaved form values remain host-owned. `data.connections` holds the user-level
 * connections its server functions can run with, loaded once this has loaded.
 */
export const useUserConfiguration = (
  instanceId: string | null | undefined,
): UserConfigurationResource => {
  const session = useSessionState();
  const { ready, isReady } = useConfirmedSessionScope();
  const cache = useResourceCache();
  const token = useSessionToken();
  // Keep ownership pinned while private data is quarantined, even with zero idle grace.
  useEffect(() => {
    if (!instanceId) return;
    return cache.observe(`${token}:${keys.userConfiguration(instanceId)}`);
  }, [cache, token, instanceId]);
  const requireInstances = useFeature("instances");
  const requireUserConfiguration = useFeature("userConfiguration");
  const requireRemove = useFeature("userConfiguration.remove");
  const guard = useCallback(() => {
    if (!isReady())
      throw Object.assign(
        new Error("The authenticated session is not confirmed."),
        {
          code: "PRISMATIC_CONFIGURATION_UNAVAILABLE",
        },
      );
    requireInstances();
    requireUserConfiguration();
  }, [isReady, requireInstances, requireUserConfiguration]);
  const key = instanceId ? keys.userConfiguration(instanceId) : null;
  const load = useCallback(
    (api: AuthedHandle) =>
      loadUserConfigurationResource({
        api,
        guard,
        guardRemove: requireRemove,
        instanceId: instanceId ?? "",
      }),
    [instanceId, guard, requireRemove],
  );
  const read = useRead<LoadedUserConfiguration>(
    useMemo(() => (key && ready ? { key, load } : null), [key, ready, load]),
  );
  const selected = useSelector<UserConfigurationState>(read.data?.stub);
  const save = useAction(read.data?.save ?? unavailableSave);
  const remove = useAction(read.data?.remove ?? unavailableRemove);
  const refresh = useResourceRefreshAction({
    key: instanceId ? keys.userConfiguration(instanceId) : null,
    ready,
    guard,
  });
  const actions = useMemo(() => {
    const value = { refresh, save, remove };
    if (key)
      carryServerFunctionSource(value, {
        scope: key,
        owner: () =>
          cache.peekSnapshot<LoadedUserConfiguration>(`${token}:${key}`)?.value
            ?.functions,
        guard,
      });
    return value;
  }, [refresh, save, remove, key, cache, token, guard]);

  const state =
    read.data &&
    (selected.status === "ready" ? selected.value : read.data.state);
  const connections = useConfigurationConnections({
    ownerKey: ready ? key : null,
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
