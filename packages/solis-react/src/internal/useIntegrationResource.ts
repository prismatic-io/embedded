import type { MarketplaceIntegrationState } from "@prismatic-io/solis-core/protocol";
import type { CreateInstanceInput } from "@prismatic-io/solis-core/protocol";
import type {
  Instance,
  InstanceResource,
  ListItem,
  MarketplaceIntegration,
  MarketplaceIntegrationActions,
  MarketplaceIntegrationError,
  MarketplaceIntegrationResource,
} from "@prismatic-io/solis-core";
import { toMarketplaceIntegrationError } from "@prismatic-io/solis-core/internal";
import { useMemo, useSyncExternalStore } from "react";
import { useAction } from "../domain/useAction.js";
import { useFeature } from "../domain/useFeature.js";
import { useSessionState } from "../PrismaticProvider.js";
import { keys } from "./keys.js";
import type { LoadedIntegration } from "./loaders.js";
import { toResource } from "./toResource.js";
import { unavailableAction } from "./unavailableAction.js";
import type { Read } from "./useResource.js";
import { useResourceRefreshAction } from "./useResourceRefreshAction.js";
import { useSelector } from "./useSelector.js";

/** Stands in for an integration's create until its entry loads. */
export const unavailableCreateInstance = unavailableAction<
  CreateInstanceInput,
  Instance,
  MarketplaceIntegrationError
>(
  "Integration is not loaded.",
  "PRISMATIC_MARKETPLACE_INTEGRATION_UNAVAILABLE",
);

const NO_INSTANCES: readonly ListItem<InstanceResource>[] = [];
const noSubscription = () => () => {};
const noInstances = () => NO_INSTANCES;

const composed = new WeakMap<
  MarketplaceIntegrationState,
  WeakMap<readonly ListItem<InstanceResource>[], MarketplaceIntegration>
>();

/** One listing value per state and instances, so every reader of it sees the same object. */
const withInstances = (
  state: MarketplaceIntegrationState,
  instances: readonly ListItem<InstanceResource>[],
): MarketplaceIntegration => {
  const byInstances = composed.get(state) ?? new WeakMap();
  composed.set(state, byInstances);
  const known = byInstances.get(instances);
  if (known) return known;
  const value = { ...state, instances };
  byInstances.set(instances, value);
  return value;
};

/** The one projection behind a detail read and a marketplace list item alike. */
export const toIntegrationResource = ({
  enabled = true,
  error,
  loaded,
  live,
  instances = NO_INSTANCES,
  isRefreshing,
  actions,
}: {
  enabled?: boolean;
  error: unknown;
  loaded: LoadedIntegration | undefined;
  live: MarketplaceIntegrationState | undefined;
  instances: readonly ListItem<InstanceResource>[] | undefined;
  isRefreshing: boolean;
  actions: MarketplaceIntegrationActions;
}): MarketplaceIntegrationResource =>
  toResource({
    enabled,
    error,
    data: loaded && withInstances(live ?? loaded.state, instances),
    isRefreshing,
    actions,
    toError: toMarketplaceIntegrationError,
  });

export const useIntegrationResource = ({
  read,
  integrationId,
}: {
  read: Omit<Read<LoadedIntegration>, "refresh">;
  integrationId: string | null | undefined;
}): MarketplaceIntegrationResource => {
  const session = useSessionState();
  const guard = useFeature("marketplace");
  const enabled = integrationId !== null && integrationId !== undefined;
  const selection = useSelector<MarketplaceIntegrationState>(
    read.data?.stub ?? null,
  );
  const refresh = useResourceRefreshAction({
    key: enabled ? keys.integration(integrationId) : null,
    guard,
    toError: toMarketplaceIntegrationError,
  });
  const createInstance = useAction(
    read.data?.createInstance ?? unavailableCreateInstance,
  );
  const actions = useMemo(
    () => ({ refresh, createInstance }),
    [refresh, createInstance],
  );
  const nested = read.data?.instances;
  const instances = useSyncExternalStore(
    nested?.subscribe ?? noSubscription,
    nested?.getSnapshot ?? noInstances,
  );

  return useMemo(
    () =>
      toIntegrationResource({
        enabled,
        error:
          session.error ??
          read.error ??
          (selection.status === "error" ? selection.error : null),
        loaded: read.data,
        live: selection.status === "ready" ? selection.value : undefined,
        instances,
        isRefreshing: read.isRefetching || refresh.status === "loading",
        actions,
      }),
    [
      instances,
      enabled,
      session.error,
      read.error,
      read.data,
      read.isRefetching,
      refresh.status,
      selection,
      actions,
    ],
  );
};
