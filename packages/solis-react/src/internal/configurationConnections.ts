/**
 * A configuration's connection choices: a nested resource that loads once its configuration
 * has, so it never holds the configuration up. Each option is adopted as its connection's
 * own entry, the one `useConnection(id)` reads, so an option and a connection screen show one
 * value and share one refresh.
 */

import type {
  ConfigurationConnectionOptions,
  ConnectionTemplateRef,
  Permission,
  ConfigurationConnectionRequirement as WireRequirement,
  ConnectionState,
  CreateConnectionPermissionReason,
} from "@prismatic-io/solis-core/protocol";
import type {
  AuthedHandle,
  ConfigurationConnectionRequirement,
  ConfigurationConnectionsResource,
  ConnectionError,
  ConnectionStub,
  CreateConnectionInput,
} from "@prismatic-io/solis-core";
import {
  disposeQuietly,
  toConfigurationError,
  toConnectionError,
} from "@prismatic-io/solis-core/internal";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  toConnectionItemResource,
  useConnectionOwnership,
} from "../domain/useConnections.js";
import {
  useResourceCache,
  useSessionState,
  useSessionToken,
} from "../PrismaticProvider.js";
import {
  type ConnectionOwnership,
  connectionActionsOf,
  ownConnection,
} from "./connectionResource.js";
import { CreateConnectionActions } from "./createConnections.js";
import { retainEntity } from "./entityEntries.js";
import { keys } from "./keys.js";
import {
  type ConnectionEntry,
  type Guard,
  type LoadedConnection,
  loadConnection,
} from "./loaders.js";
import type {
  OwnedValue,
  ResourceCache,
  ResourceLease,
} from "./resourceCache.js";
import { toResource } from "./toResource.js";
import { unavailableAction } from "./unavailableAction.js";
import { useApiHandle } from "./useApiHandle.js";
import { type ItemSources, useListItems } from "./useListItems.js";
import { useRead } from "./useResource.js";
import { useResourceRefreshAction } from "./useResourceRefreshAction.js";

interface RequirementShape {
  key: string;
  label: string;
  ids: readonly string[];
  template: ConnectionTemplateRef | null;
  permission: Permission<CreateConnectionPermissionReason>;
}

interface LoadedConnections {
  init: readonly RequirementShape[];
  serverFunctions: Readonly<Record<string, readonly RequirementShape[]>>;
  entries: readonly ConnectionEntry[];
}

/** The configuration entry that answers for its connections. */
export interface ConnectionsOwner {
  stub: { readConnectionOptions: () => Promise<unknown> };
}

const releasedError = () =>
  Object.assign(new Error("Configuration was released."), {
    code: "PRISMATIC_ACTION_DISPOSED",
  });

const loadConfigurationConnections = async ({
  api,
  guard,
  ownership,
  cache,
  token,
  ownerKey,
  loadOwner,
}: {
  api: AuthedHandle;
  guard: Guard;
  ownership: ConnectionOwnership;
  cache: ResourceCache;
  token: string;
  ownerKey: string;
  loadOwner: (api: AuthedHandle) => Promise<OwnedValue<ConnectionsOwner>>;
}): Promise<OwnedValue<LoadedConnections>> => {
  guard();
  const acquisition = cache.beginAcquisition();
  const leases: ResourceLease<unknown>[] = [];
  /** The wire result: it owns the option references until each is duplicated. */
  let source: unknown;
  const release = () => {
    for (const lease of leases) lease.release();
    disposeQuietly(source);
  };
  try {
    const owner = cache.retain({
      key: `${token}:${ownerKey}`,
      load: () => loadOwner(api),
    });
    leases.push(owner as ResourceLease<unknown>);
    await owner.ready;
    const configuration = owner.snapshot().value;
    if (!configuration) throw releasedError();
    const options =
      (await configuration.stub.readConnectionOptions()) as ConfigurationConnectionOptions;
    source = options;
    const requirements: WireRequirement[] = [
      ...options.init,
      ...Object.values(options.serverFunctions).flat(),
    ];
    const arrivals = await Promise.allSettled(
      requirements
        .flatMap(({ options }) => options as unknown as ConnectionStub[])
        .map(async (borrowed) => {
          const stub = borrowed.dup() as unknown as ConnectionStub;
          return ownConnection(stub, ownership);
        }),
    );
    disposeQuietly(source);
    source = undefined;
    const settled = arrivals.flatMap((arrival) =>
      arrival.status === "fulfilled" ? [arrival.value] : [],
    );
    const failure = arrivals.find((arrival) => arrival.status === "rejected");
    if (failure) {
      for (const incoming of settled) incoming.release?.();
      throw failure.reason;
    }
    const firsts = new Map<string, OwnedValue<LoadedConnection>>();
    for (const incoming of settled) {
      const { id } = incoming.value.state;
      if (firsts.has(id)) incoming.release?.();
      else firsts.set(id, incoming);
    }
    const entries = await Promise.all(
      [...firsts].map(([id, incoming]) =>
        retainEntity({
          cache,
          token,
          id,
          key: keys.connection(id),
          load: () => loadConnection(api, ownership, id),
          incoming,
          acquisition,
          guard,
          toError: toConnectionError,
          leases,
        }),
      ),
    );
    let next = 0;
    const shape = ({
      key,
      label,
      options,
      template,
      permissions,
    }: WireRequirement): RequirementShape => ({
      key,
      label,
      ids: options.map(() => settled[next++]?.value.state.id ?? ""),
      template,
      permission: permissions.createConnection,
    });
    const init = options.init.map(shape);
    const serverFunctions = Object.fromEntries(
      Object.entries(options.serverFunctions).map(([key, needed]) => [
        key,
        needed.map(shape),
      ]),
    );
    return { value: { init, serverFunctions, entries }, release };
  } catch (error) {
    release();
    const failed = toConfigurationError(error);
    throw Object.assign(new Error(failed.message), failed);
  } finally {
    acquisition.release();
  }
};

const stubOf = ({ stub }: LoadedConnection) => stub;

/**
 * `owner` is the configuration's cache key and how to load it; `integrationId` is the version
 * it shows, unset until it has loaded. A different version is a different set of choices.
 */
export const useConfigurationConnections = ({
  ownerKey,
  integrationId,
  guard,
  loadOwner,
}: {
  ownerKey: string | null;
  integrationId: string | undefined;
  guard: Guard;
  loadOwner: (api: AuthedHandle) => Promise<OwnedValue<ConnectionsOwner>>;
}): ConfigurationConnectionsResource => {
  const api = useApiHandle();
  const cache = useResourceCache();
  const token = useSessionToken();
  const session = useSessionState();
  const ownership = useConnectionOwnership();
  const key =
    ownerKey && integrationId
      ? keys.configurationConnections(ownerKey, integrationId)
      : null;
  const read = useRead<LoadedConnections>(
    // biome-ignore lint/correctness/useExhaustiveDependencies: `loadOwner` is represented by `ownerKey`
    useMemo(
      () =>
        key && ownerKey
          ? {
              key,
              load: (current) =>
                loadConfigurationConnections({
                  api: current,
                  guard,
                  ownership,
                  cache,
                  token,
                  ownerKey,
                  loadOwner,
                }),
            }
          : null,
      [key, ownerKey, guard, ownership, cache, token],
    ),
  );
  const loaded = read.data;
  // Same-scope authentication keeps the entries but replaces the API handle.
  if (api && loaded)
    for (const entry of loaded.entries)
      entry.lease.setLoader(() => loadConnection(api, ownership, entry.id));
  const creators = useRead<CreateConnectionActions>(
    useMemo(
      () =>
        key
          ? {
              key: `createConnection/${key}`,
              load: async () => {
                const actions = new CreateConnectionActions();
                return { value: actions, release: () => actions.dispose() };
              },
            }
          : null,
      [key],
    ),
  ).data;
  if (creators) {
    const byKey = new Map(
      [
        ...(loaded?.init ?? []),
        ...Object.values(loaded?.serverFunctions ?? {}).flat(),
      ].map((requirement) => [requirement.key, requirement]),
    );
    creators.source = {
      api,
      ownership,
      requirement: (requirementKey) => byKey.get(requirementKey),
      reload: () => {
        if (key) void cache.refetch(`${token}:${key}`).catch(() => {});
      },
    };
  }
  const creatorsVersion = useSyncExternalStore(
    creators?.subscribe ?? noSubscription,
    creators?.version ?? noVersion,
    noVersion,
  );

  const project = useCallback(
    ({
      entry,
      live,
      liveError,
      closed,
      refresh,
    }: ItemSources<LoadedConnection, ConnectionState, ConnectionError>) =>
      toConnectionItemResource({
        error: session.error ?? entry.error ?? liveError,
        entry,
        live,
        closed,
        refresh,
      }),
    [session.error],
  );
  const items = useListItems({
    entries: loaded?.entries ?? NO_ENTRIES,
    stubOf,
    actionsOf: connectionActionsOf,
    project,
  });
  const refresh = useResourceRefreshAction({ key, guard });
  const actions = useMemo(() => ({ refresh }), [refresh]);
  // `creatorsVersion` moves when a requirement's createConnection status does.
  const data = useMemo(() => {
    if (!loaded) return undefined;
    const byId = new Map(items.map((item) => [item.id, item]));
    const resolve = ({
      key,
      label,
      ids,
      permission,
    }: RequirementShape): ConfigurationConnectionRequirement => ({
      key,
      label,
      options: ids.flatMap((id) => {
        const item = byId.get(id);
        return item ? [item] : [];
      }),
      permissions: { createConnection: permission },
      actions: {
        createConnection: (
          creators?.get(key) ?? unavailableCreate
        ).getSnapshot(),
      },
    });
    return {
      init: loaded.init.map(resolve),
      serverFunctions: Object.fromEntries(
        Object.entries(loaded.serverFunctions).map(([caller, needed]) => [
          caller,
          needed.map(resolve),
        ]),
      ),
    };
  }, [loaded, items, creators, creatorsVersion]);

  return useMemo(
    () =>
      toResource({
        error: session.error ?? read.error,
        data,
        isRefreshing: read.isRefetching || refresh.status === "loading",
        actions,
        toError: toConfigurationError,
      }),
    [
      session.error,
      read.error,
      data,
      read.isRefetching,
      refresh.status,
      actions,
    ],
  );
};

const NO_ENTRIES: readonly never[] = [];

const noSubscription = () => () => {};
const noVersion = () => 0;

const unavailableCreate = unavailableAction<
  CreateConnectionInput,
  ConnectionState,
  ConnectionError
>("Connection choices are not loaded.", "PRISMATIC_UNKNOWN");
