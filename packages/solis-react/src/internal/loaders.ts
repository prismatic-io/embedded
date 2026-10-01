/**
 * The loaders behind every cached read. One per resource: each acquires its stubs, warms
 * their `state()` streams, and hands the cache a `release` that undoes exactly what it did.
 */

import type {
  AuthenticatedUser,
  ConnectionState,
  CreateInstanceInput,
  InstanceState,
  ListConnectionsFilter,
  ListIntegrationsInput,
  MarketplaceIntegrationState,
} from "@prismatic-io/solis-core/protocol";
import type {
  AuthedHandle,
  ConfigurationError,
  ConnectionError,
  ConnectionStub,
  InstanceStub,
  IntegrationStub,
  MarketplaceIntegrationError,
} from "@prismatic-io/solis-core";
import {
  createAction,
  type DisposableActionHandle,
  disposeQuietly,
  toConfigurationError,
  toConnectionError,
  toMarketplaceIntegrationError,
} from "@prismatic-io/solis-core/internal";
import {
  type ConnectionOwnership,
  type LoadedConnection,
  ownConnection,
} from "./connectionResource.js";
import { type EntityEntry, retainEntity } from "./entityEntries.js";
import type { AdoptInstance } from "./instanceEffects.js";
import {
  type IntegrationInstances,
  type NestedInstanceOwnership,
  ownIntegrationInstances,
} from "./integrationInstances.js";
import {
  type InstanceEffects,
  type LoadedInstanceResource,
  loadInstanceResource,
  ownInstance,
} from "./instanceResource.js";
import { keys } from "./keys.js";
import type { Page } from "./listStore.js";
import type {
  OwnedValue,
  ResourceCache,
  ResourceLease,
} from "./resourceCache.js";
import { settle } from "./settle.js";

/** Throws naming the feature the frame does not announce, from inside a loader. */
export type Guard = () => void;

export type MarketplaceFilters = Omit<
  ListIntegrationsInput,
  "limit" | "cursor"
>;

export interface LoadedIntegration
  extends LoadedOne<IntegrationStub, MarketplaceIntegrationState> {
  createInstance: DisposableActionHandle<
    CreateInstanceInput,
    InstanceState,
    MarketplaceIntegrationError
  >;
  instances: IntegrationInstances;
}

/** What an integration entry needs to own its actions and hold its instances. */
export interface IntegrationOwnership {
  api: AuthedHandle;
  guard: Guard;
  adopt: AdoptInstance;
  nested: NestedInstanceOwnership;
}

export type IntegrationEntry = EntityEntry<
  LoadedIntegration,
  MarketplaceIntegrationError
>;

/**
 * One marketplace page from `cursor`. Each row is adopted as its integration's own entry, the
 * one `useMarketplaceIntegration` reads, unless that entry already exists.
 */
export const loadMarketplacePage = async ({
  api,
  guard,
  adopt,
  nested,
  filters,
  pageSize,
  cursor,
  cache,
  token,
}: IntegrationOwnership & {
  filters: MarketplaceFilters;
  pageSize: number;
  cursor: string | null;
  cache: ResourceCache;
  token: string;
}): Promise<Page<IntegrationEntry>> => {
  guard();
  const acquisition = cache.beginAcquisition();
  const leases: ResourceLease<unknown>[] = [];
  /** The wire page object: a page arriving as a stub holds its own import. */
  let source: unknown;
  const release = () => {
    for (const lease of leases) lease.release();
    disposeQuietly(source);
  };

  try {
    const result = await api.marketplace.list({
      ...filters,
      limit: pageSize,
      ...(cursor ? { cursor } : {}),
    });
    source = result;
    const arrivals = await Promise.allSettled(
      (result.integrations as unknown as IntegrationStub[]).map(
        async (borrowed) => {
          // The page owns its wire references. Give the entity an independent
          // reference before warming its stream so it can outlive the page.
          const stub = borrowed.dup() as unknown as IntegrationStub;
          disposeQuietly(borrowed);
          const incoming = await ownIntegration({
            api,
            guard,
            adopt,
            nested,
            stub,
          });
          const id = incoming.value.state.id;
          return retainEntity({
            cache,
            token,
            id,
            key: keys.integration(id),
            load: () =>
              loadIntegration({
                api,
                guard,
                adopt,
                nested,
                integrationId: id,
              }),
            incoming,
            acquisition,
            guard,
            toError: toMarketplaceIntegrationError,
            leases,
          });
        },
      ),
    );
    const failure = arrivals.find((arrival) => arrival.status === "rejected");
    if (failure) throw failure.reason;
    return {
      entries: arrivals.flatMap((arrival) =>
        arrival.status === "fulfilled" ? [arrival.value] : [],
      ),
      endCursor: result.pageInfo.endCursor,
      hasNextPage: result.pageInfo.hasNextPage,
      release,
    };
  } catch (error) {
    release();
    throw error;
  } finally {
    acquisition.release();
  }
};

export interface LoadedOne<Stub, State> {
  stub: Stub;
  state: State;
}

export const loadIntegration = async ({
  integrationId,
  ...ownership
}: IntegrationOwnership & { integrationId: string }): Promise<
  OwnedValue<LoadedIntegration>
> => {
  try {
    ownership.guard();
    const stub = (await ownership.api.marketplace.get(
      integrationId,
    )) as unknown as IntegrationStub;
    return await ownIntegration({ ...ownership, stub });
  } catch (error) {
    throw toMarketplaceIntegrationError(error);
  }
};

const disposedError = () =>
  Object.assign(new Error("Integration was released."), {
    code: "PRISMATIC_ACTION_DISPOSED",
  });

/**
 * Warms an integration stub and binds the actions its entry owns, so a listed integration
 * carries the same actions, with the same status, as one read by id.
 */
const ownIntegration = async ({
  api,
  guard,
  adopt,
  nested,
  stub,
}: IntegrationOwnership & { stub: IntegrationStub }): Promise<
  OwnedValue<LoadedIntegration>
> => {
  const settled = await withSettled<
    IntegrationStub,
    MarketplaceIntegrationState
  >(stub, "integration's");
  let instances: OwnedValue<IntegrationInstances>;
  try {
    instances = await ownIntegrationInstances({
      ...nested,
      api,
      integration: stub,
      state: settled.value.state,
    });
  } catch (error) {
    settled.release?.();
    throw error;
  }
  let disposed = false;
  const createInstance = createAction<
    CreateInstanceInput,
    InstanceState,
    MarketplaceIntegrationError
  >({
    execute: async (input) => {
      guard();
      const created = (await stub.createInstance(
        input,
      )) as unknown as InstanceStub;
      // The backend created the instance either way; nothing is left to adopt it into.
      if (disposed) {
        disposeQuietly(created);
        throw disposedError();
      }
      return { status: "success", data: await adopt({ api, created }) };
    },
    toError: toMarketplaceIntegrationError,
  });
  return {
    value: { ...settled.value, createInstance, instances: instances.value },
    release: () => {
      disposed = true;
      createInstance.dispose();
      instances.release?.();
      settled.release?.();
    },
  };
};

export type { LoadedConnection } from "./connectionResource.js";

export type ConnectionEntry = EntityEntry<LoadedConnection, ConnectionError>;

const matchesConnection = (
  state: ConnectionState,
  filter: ListConnectionsFilter,
): boolean =>
  (filter.componentKey === undefined ||
    state.component.key === filter.componentKey) &&
  (filter.kind === undefined || state.kind === filter.kind) &&
  (filter.status === undefined || state.status === filter.status);

/**
 * Every connection the caller may use, as one page: connections are not paged. Each is
 * adopted as its connection's own entry, the one `useConnection` reads, unless that entry
 * already exists. When the frame did not apply `filter`, it is applied here to each
 * connection's state as listed.
 */
export const loadConnectionsPage = async ({
  api,
  ownership,
  filter,
  serverSide,
  cache,
  token,
}: {
  api: AuthedHandle;
  ownership: ConnectionOwnership;
  filter: ListConnectionsFilter;
  serverSide: boolean;
  cache: ResourceCache;
  token: string;
}): Promise<Page<ConnectionEntry>> => {
  const { guard } = ownership;
  guard();
  const acquisition = cache.beginAcquisition();
  const leases: ResourceLease<unknown>[] = [];
  const release = () => {
    for (const lease of leases) lease.release();
  };

  try {
    const stubs = (await api.connections.list(
      serverSide ? filter : undefined,
    )) as unknown as ConnectionStub[];
    const arrivals = await Promise.allSettled(
      stubs.map(async (stub) => {
        const incoming = await ownConnection(stub, ownership);
        const { state } = incoming.value;
        if (!serverSide && !matchesConnection(state, filter)) {
          incoming.release?.();
          return [];
        }
        return [
          await retainEntity({
            cache,
            token,
            id: state.id,
            key: keys.connection(state.id),
            load: () => loadConnection(api, ownership, state.id),
            incoming,
            acquisition,
            guard,
            toError: toConnectionError,
            leases,
          }),
        ];
      }),
    );
    const failure = arrivals.find((arrival) => arrival.status === "rejected");
    if (failure) throw failure.reason;
    return {
      entries: arrivals.flatMap((arrival) =>
        arrival.status === "fulfilled" ? arrival.value : [],
      ),
      endCursor: null,
      hasNextPage: false,
      release,
    };
  } catch (error) {
    release();
    throw error;
  } finally {
    acquisition.release();
  }
};

export const loadConnection = async (
  api: AuthedHandle,
  ownership: ConnectionOwnership,
  id: string,
): Promise<OwnedValue<LoadedConnection>> => {
  ownership.guard();
  const stub = (await api.connections.get(id)) as unknown as ConnectionStub;
  return ownConnection(stub, ownership);
};

export type InstanceEntry = EntityEntry<
  LoadedInstanceResource,
  ConfigurationError
>;

/**
 * One instances page from `cursor`, newest first, never-deployed instances included. Each
 * row is adopted as its instance's own entry, the one `useInstance` reads with the same
 * actions, unless that entry already exists.
 */
export const loadInstancesPage = async ({
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
}: {
  api: AuthedHandle;
  guard: Guard;
  guardDetails: Guard;
  guardUpgrade: Guard;
  effects: InstanceEffects;
  integrationId: string | undefined;
  pageSize: number;
  cursor: string | null;
  cache: ResourceCache;
  token: string;
}): Promise<Page<InstanceEntry>> => {
  guard();
  const acquisition = cache.beginAcquisition();
  const leases: ResourceLease<unknown>[] = [];
  /** The wire page object: it owns its rows' references. */
  let source: unknown;
  const release = () => {
    for (const lease of leases) lease.release();
    disposeQuietly(source);
  };

  try {
    const result = await api.instances.list({
      ...(integrationId ? { integrationId } : {}),
      limit: pageSize,
      ...(cursor ? { cursor } : {}),
    });
    source = result;
    const ownership = { guard, guardDetails, guardUpgrade, effects };
    const arrivals = await Promise.allSettled(
      (result.instances as unknown as InstanceStub[]).map(async (borrowed) => {
        // An independent reference lets the entity outlive the page.
        const incoming = await ownInstance({
          ...ownership,
          acquire: async () => {
            const stub = borrowed.dup() as unknown as InstanceStub;
            disposeQuietly(borrowed);
            return stub;
          },
        });
        const id = incoming.value.state.id;
        return retainEntity({
          cache,
          token,
          id,
          key: keys.instance(id),
          load: () =>
            loadInstanceResource({ ...ownership, api, instanceId: id }),
          incoming,
          acquisition,
          guard,
          toError: toConfigurationError,
          leases,
        });
      }),
    );
    const failure = arrivals.find((arrival) => arrival.status === "rejected");
    if (failure) throw failure.reason;
    return {
      entries: arrivals.flatMap((arrival) =>
        arrival.status === "fulfilled" ? [arrival.value] : [],
      ),
      endCursor: result.pageInfo.endCursor,
      hasNextPage: result.pageInfo.hasNextPage,
      release,
    };
  } catch (error) {
    release();
    throw error;
  } finally {
    acquisition.release();
  }
};

/** Plain data, not a stub, so the resource releases nothing. */
export const loadAuthenticatedUser = async (
  api: AuthedHandle,
  guard: Guard,
): Promise<OwnedValue<AuthenticatedUser>> => {
  guard();
  return { value: await api.getAuthenticatedUser() };
};

/** Warms one stub's stream and owns both the observer and the stub. */
export const withSettled = async <
  Stub extends Parameters<typeof settle>[0],
  State,
>(
  stub: Stub,
  subject: string,
): Promise<OwnedValue<LoadedOne<Stub, State>>> => {
  try {
    const { state, release } = await settle<State>(stub as never, subject);
    return {
      value: { stub, state },
      release: () => {
        release();
        disposeQuietly(stub);
      },
    };
  } catch (error) {
    disposeQuietly(stub);
    throw error;
  }
};
