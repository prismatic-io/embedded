/**
 * Per-id entity entries a list holds on behalf of its items. Each is the very cache entry the
 * matching detail hook reads, plus the refresh action that detail hook shares, so an item and
 * a detail view of the same entity show one value and one action status.
 */

import type { PrismaticError } from "@prismatic-io/solis-core";
import {
  createAction,
  type DisposableActionHandle,
} from "@prismatic-io/solis-core/internal";
import type { Guard } from "./loaders.js";
import type {
  OwnedValue,
  ResourceAcquisition,
  ResourceCache,
  ResourceLease,
} from "./resourceCache.js";

export interface RefreshActionValue<E extends PrismaticError> {
  action: DisposableActionHandle<void, void, E>;
}

/** The unscoped key of the action that reloads the entry at `key`. */
export const refreshActionKey = (key: string) => `refresh/${key}`;

/** One refresh action per key, whichever reader acquires it first. */
export const createRefreshAction = <E extends PrismaticError>({
  guard,
  reload,
  toError,
}: {
  guard: Guard;
  reload: () => Promise<void>;
  toError: (error: unknown) => E;
}): OwnedValue<RefreshActionValue<E>> => {
  const action = createAction<void, void, E>({
    execute: async () => {
      guard();
      await reload();
      return { status: "success", data: undefined };
    },
    toError,
  });
  return { value: { action }, release: () => action.dispose() };
};

export interface EntityEntry<Loaded, E extends PrismaticError> {
  id: string;
  lease: ResourceLease<Loaded>;
  refresh: ResourceLease<RefreshActionValue<E>>;
}

/**
 * Adopts `incoming` as the entity's entry unless one already exists, and retains its refresh
 * action. Every lease taken is pushed to `leases` before it settles, so a caller that fails
 * part way releases exactly what it took.
 */
export const retainEntity = async <Loaded, E extends PrismaticError>({
  cache,
  token,
  id,
  key,
  load,
  incoming,
  acquisition,
  guard,
  toError,
  leases,
}: {
  cache: ResourceCache;
  token: string;
  id: string;
  /** Unscoped, as the detail hook keys it. */
  key: string;
  load: () => Promise<OwnedValue<Loaded>>;
  incoming: OwnedValue<Loaded>;
  acquisition: ResourceAcquisition;
  guard: Guard;
  toError: (error: unknown) => E;
  leases: ResourceLease<unknown>[];
}): Promise<EntityEntry<Loaded, E>> => {
  const scoped = `${token}:${key}`;
  const lease = cache.retain({ key: scoped, load, incoming, acquisition });
  leases.push(lease as ResourceLease<unknown>);
  const refresh = cache.retain<RefreshActionValue<E>>({
    key: `${token}:${refreshActionKey(key)}`,
    load: async () =>
      createRefreshAction({
        guard,
        reload: () => cache.refetch(scoped),
        toError,
      }),
    acquisition,
  });
  leases.push(refresh as ResourceLease<unknown>);
  await Promise.all([lease.ready, refresh.ready]);
  return { id, lease, refresh };
};
