/** Reading instances: a list, and one by id. */

import type { InstanceState } from "@prismatic-io/solis-core/protocol";
import type {
  ConfigurationError,
  InstanceResource,
  ListInput,
  ListResource,
} from "@prismatic-io/solis-core";
import { toConfigurationError } from "@prismatic-io/solis-core/internal";
import { useCallback, useEffect, useMemo } from "react";
import { useInstanceEffects } from "../internal/instanceEffects.js";
import {
  instanceActionsOf,
  type LoadedInstanceResource,
  loadInstanceResource,
  toInstanceItemResource,
  toInstanceResource,
  unavailableDetails,
  unavailableVoid,
} from "../internal/instanceResource.js";
import { keys } from "../internal/keys.js";
import { loadInstancesPage } from "../internal/loaders.js";
import type { ItemSources } from "../internal/useListItems.js";
import { useListResource } from "../internal/useListResource.js";
import { useRead } from "../internal/useResource.js";
import { useResourceRefreshAction } from "../internal/useResourceRefreshAction.js";
import { useSelector } from "../internal/useSelector.js";
import {
  useConfirmedSessionScope,
  useResourceCache,
  useSessionState,
  useSessionToken,
} from "../PrismaticProvider.js";
import { useAction } from "./useAction.js";
import { useFeature } from "./useFeature.js";

export type InstancesInput = { integrationId?: string } & ListInput;

const DEFAULT_PAGE_SIZE = 25;

const stubOf = ({ stub }: LoadedInstanceResource) => stub;

/**
 * Instances visible to the caller, newest first, never-deployed ones included; `lifecycle`
 * tells them apart. Omitting `integrationId` lists every instance the JWT can see. `filter`
 * is compared structurally, so an inline literal does not re-list.
 *
 * Each item is the same resource `useInstance(id)` returns: one cache entry, one live
 * state, and the same actions with one shared status, so acting on a row needs no read.
 */
export const useInstances = (
  filter: InstancesInput = {},
): ListResource<InstanceResource, ConfigurationError> => {
  const {
    pageSize = DEFAULT_PAGE_SIZE,
    onPageLoad = "append",
    integrationId,
  } = filter;
  const guard = useFeature("instances");
  const guardDetails = useFeature("instances.updateDetails");
  const guardUpgrade = useFeature("instances.upgrade");
  const effects = useInstanceEffects();
  const cache = useResourceCache();
  const token = useSessionToken();
  const session = useSessionState();
  const key = keys.instances({ integrationId, pageSize, onPageLoad });

  const fetchPage = useCallback(
    (
      api: Parameters<typeof loadInstancesPage>[0]["api"],
      cursor: string | null,
    ) =>
      loadInstancesPage({
        api,
        guard,
        guardDetails,
        guardUpgrade,
        effects,
        integrationId,
        pageSize,
        cursor,
        cache,
        token,
      }),
    [
      guard,
      guardDetails,
      guardUpgrade,
      effects,
      integrationId,
      pageSize,
      cache,
      token,
    ],
  );
  const loadEntity = useCallback(
    (api: Parameters<typeof loadInstanceResource>[0]["api"], id: string) =>
      loadInstanceResource({
        api,
        guard,
        guardDetails,
        guardUpgrade,
        effects,
        instanceId: id,
      }),
    [guard, guardDetails, guardUpgrade, effects],
  );
  const project = useCallback(
    ({
      entry,
      live,
      liveError,
      refresh,
    }: ItemSources<
      LoadedInstanceResource,
      InstanceState,
      ConfigurationError
    >) =>
      toInstanceItemResource({
        error: session.error ?? entry.error ?? liveError,
        entry,
        live,
        refresh,
      }),
    [session.error],
  );

  return useListResource({
    key,
    mode: onPageLoad,
    guard,
    toError: toConfigurationError,
    fetchPage,
    loadEntity,
    stubOf,
    actionsOf: instanceActionsOf,
    project,
  });
};

/**
 * Lists never load flow API keys, so a detail view that found its entry already listed, or
 * whose instance moved to a version with new flows, asks for the keys any flow lacks. Each
 * flow is asked for once; a failed read leaves it without keys until a refresh.
 */
const useFlowApiKeys = ({
  loaded,
  state,
}: {
  loaded: LoadedInstanceResource | undefined;
  state: InstanceState | undefined;
}) => {
  const unloadedFlows = (state?.flows ?? [])
    .filter(({ apiKeys }) => apiKeys === undefined)
    .map(({ id }) => id)
    .join("\n");
  useEffect(() => {
    if (loaded && unloadedFlows) void loaded.loadFlowApiKeys();
  }, [loaded, unloadedFlows]);
};

/**
 * One session-owned resource per instance id, deployed or not. Unlike a list item, it loads
 * each flow's `apiKeys`; the list items sharing its entry then show them too.
 */
export const useInstance = (
  instanceId: string | null | undefined,
): InstanceResource => {
  const session = useSessionState();
  const { ready, isReady } = useConfirmedSessionScope();
  const cache = useResourceCache();
  const token = useSessionToken();
  const requireInstances = useFeature("instances");
  const requireDetails = useFeature("instances.updateDetails");
  const requireUpgrade = useFeature("instances.upgrade");
  const effects = useInstanceEffects();
  useEffect(() => {
    if (instanceId)
      return cache.observe(`${token}:${keys.instance(instanceId)}`);
  }, [cache, token, instanceId]);
  const guard = useCallback(() => {
    if (!isReady())
      throw Object.assign(
        new Error("The authenticated session is not confirmed."),
        {
          code: "PRISMATIC_CONFIGURATION_UNAVAILABLE",
        },
      );
    requireInstances();
  }, [isReady, requireInstances]);
  const read = useRead<LoadedInstanceResource>(
    useMemo(
      () =>
        instanceId && ready
          ? {
              key: keys.instance(instanceId),
              load: (api) =>
                loadInstanceResource({
                  api,
                  guard,
                  guardDetails: requireDetails,
                  guardUpgrade: requireUpgrade,
                  effects,
                  instanceId,
                  detail: true,
                }),
            }
          : null,
      [instanceId, ready, guard, requireDetails, requireUpgrade, effects],
    ),
  );
  const selected = useSelector<InstanceState>(read.data?.stub);
  useFlowApiKeys({
    loaded: read.data,
    state: selected.status === "ready" ? selected.value : read.data?.state,
  });
  const updateDetails = useAction(
    read.data?.updateDetails ?? unavailableDetails,
  );
  const deploy = useAction(read.data?.deploy ?? unavailableVoid);
  const upgrade = useAction(read.data?.upgrade ?? unavailableVoid);
  const pause = useAction(read.data?.pause ?? unavailableVoid);
  const resume = useAction(read.data?.resume ?? unavailableVoid);
  const remove = useAction(read.data?.remove ?? unavailableVoid);
  const refresh = useResourceRefreshAction({
    key: instanceId ? keys.instance(instanceId) : null,
    ready,
    guard,
  });
  const actions = useMemo(
    () => ({ updateDetails, deploy, upgrade, pause, resume, remove, refresh }),
    [updateDetails, deploy, upgrade, pause, resume, remove, refresh],
  );
  return useMemo(
    () =>
      toInstanceResource({
        error:
          session.error ??
          read.error ??
          (selected.status === "error" ? selected.error : null),
        loaded: read.data,
        live: selected.status === "ready" ? selected.value : undefined,
        isRefreshing: refresh.status === "loading" || read.isRefetching,
        actions,
      }),
    [
      session.error,
      read.error,
      read.data,
      read.isRefetching,
      refresh.status,
      selected,
      actions,
    ],
  );
};
