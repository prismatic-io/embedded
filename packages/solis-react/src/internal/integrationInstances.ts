/**
 * The instances a listing carries, as instance resources. Membership follows the listing's
 * live state; each instance is adopted as the entry `useInstance(id)` reads, so a card, an
 * instance list and an instance screen show one value and share one status per action.
 *
 * The frame serves the stubs from the read that produced the listing's state, so carrying
 * instances costs no request per instance.
 */

import type {
  InstanceState,
  MarketplaceIntegrationState,
} from "@prismatic-io/solis-core/protocol";
import type {
  Action,
  AuthedHandle,
  ConfigurationError,
  InstanceResource,
  InstanceStub,
  IntegrationStub,
  ListItem,
} from "@prismatic-io/solis-core";
import {
  observeState,
  toConfigurationError,
} from "@prismatic-io/solis-core/internal";
import { type EntityEntry, retainEntity } from "./entityEntries.js";
import {
  type InstanceOwnership,
  instanceActionsOf,
  type LoadedInstanceResource,
  loadInstanceResource,
  ownInstance,
  toInstanceItemResource,
} from "./instanceResource.js";
import { keys } from "./keys.js";
import type {
  OwnedValue,
  ResourceCache,
  ResourceLease,
} from "./resourceCache.js";
import { unavailableAction } from "./unavailableAction.js";

/** Where a listing's instances live: the session's cache, and how to own an instance. */
export interface NestedInstanceOwnership {
  cache: ResourceCache;
  token: string;
  ownership: InstanceOwnership;
}

export interface IntegrationInstances {
  /** Signals any change in membership, an instance's state or one of its action statuses. */
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => readonly ListItem<InstanceResource>[];
}

interface Held {
  entry: EntityEntry<LoadedInstanceResource, ConfigurationError>;
  leases: ResourceLease<unknown>[];
}

interface Memo {
  sources: readonly unknown[];
  item: ListItem<InstanceResource>;
}

interface Source {
  subscribe: (listener: () => void) => () => void;
}

const NONE: readonly ListItem<InstanceResource>[] = [];

const unavailableRefresh = unavailableAction<void, void>(
  "Instance is not loaded.",
).getSnapshot();

const idsOf = (state: MarketplaceIntegrationState | undefined) =>
  state?.instances.map(({ id }) => id);

const sameElements = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length &&
  a.every((value, index) => Object.is(value, b[index]));

const releaseAll = (leases: readonly ResourceLease<unknown>[]) => {
  for (const lease of leases) lease.release();
};

/**
 * Holds the instances `integration`'s state names, starting from `state`. Resolves once
 * those are held, so a listing never shows before its instances do.
 */
export const ownIntegrationInstances = async ({
  api,
  integration,
  state,
  cache,
  token,
  ownership,
}: NestedInstanceOwnership & {
  api: AuthedHandle;
  integration: IntegrationStub;
  state: MarketplaceIntegrationState;
}): Promise<OwnedValue<IntegrationInstances>> => {
  const held = new Map<string, Held>();
  const listeners = new Set<() => void>();
  let order: readonly string[] = [];
  let wanted: readonly string[] = [];
  let released = false;
  let queue = Promise.resolve();

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const adopt = async (missing: ReadonlySet<string>) => {
    const acquisition = cache.beginAcquisition();
    try {
      const stubs =
        (await integration.instances()) as unknown as InstanceStub[];
      const arrivals = await Promise.allSettled(
        stubs.map(async (stub) => {
          const incoming = await ownInstance({
            ...ownership,
            acquire: async () => stub,
          });
          const { id } = incoming.value.state;
          if (released || !missing.has(id) || held.has(id)) {
            incoming.release?.();
            return;
          }
          const leases: ResourceLease<unknown>[] = [];
          try {
            const entry = await retainEntity({
              cache,
              token,
              id,
              key: keys.instance(id),
              load: () =>
                loadInstanceResource({ ...ownership, api, instanceId: id }),
              incoming,
              acquisition,
              guard: ownership.guard,
              toError: toConfigurationError,
              leases,
            });
            if (released) releaseAll(leases);
            else held.set(id, { entry, leases });
          } catch (error) {
            releaseAll(leases);
            throw error;
          }
        }),
      );
      // A stub nobody wanted may fail harmlessly; one that leaves an instance unheld may not.
      const failure = arrivals.find((arrival) => arrival.status === "rejected");
      if (failure && [...missing].some((id) => !held.has(id)))
        throw failure.reason;
    } finally {
      acquisition.release();
    }
  };

  /** Holds exactly `ids`, in their order. Runs one at a time, latest membership last. */
  const apply = async (ids: readonly string[]) => {
    if (released) return;
    const keep = new Set(ids);
    for (const [id, { leases }] of held)
      if (!keep.has(id)) {
        held.delete(id);
        releaseAll(leases);
      }
    const missing = new Set(ids.filter((id) => !held.has(id)));
    if (missing.size) await adopt(missing);
    order = ids.filter((id) => held.has(id));
    notify();
  };

  const sync = (ids: readonly string[]) => {
    if (sameElements(ids, wanted)) return queue;
    wanted = ids;
    // A failed adoption is retried on the listing's next change; what is held stays shown.
    queue = queue.then(() => apply(ids)).catch(() => {});
    return queue;
  };

  wanted = idsOf(state) ?? [];
  try {
    await apply(wanted);
  } catch (error) {
    released = true;
    for (const { leases } of held.values()) releaseAll(leases);
    throw error;
  }

  const shared = observeState<MarketplaceIntegrationState>(integration);
  const memos = new Map<string, Memo>();
  let snapshot: readonly ListItem<InstanceResource>[] = NONE;

  const getSnapshot = () => {
    let changed = order.length !== snapshot.length;
    const next = order.flatMap((id, index) => {
      const entry = held.get(id)?.entry;
      if (!entry) return [];
      const lease = entry.lease.snapshot();
      const live = lease.value
        ? observeState<InstanceState>(lease.value.stub)
        : undefined;
      const refresh = (entry.refresh.snapshot().value?.action.getSnapshot() ??
        unavailableRefresh) as Action<void, void, ConfigurationError>;
      const liveError = live?.status === "error" ? live.error : undefined;
      const sources = [
        lease,
        live?.latest,
        liveError,
        refresh,
        ...(lease.value ? instanceActionsOf(lease.value) : []).map((action) =>
          action.getSnapshot(),
        ),
      ];
      const memo = memos.get(id);
      if (memo && sameElements(memo.sources, sources)) {
        if (memo.item !== snapshot[index]) changed = true;
        return [memo.item];
      }
      changed = true;
      const item = {
        ...toInstanceItemResource({
          error: lease.error ?? liveError,
          entry: lease,
          live: live?.latest,
          refresh,
        }),
        id,
      };
      memos.set(id, { sources, item });
      return [item];
    });
    if (!changed) return snapshot;
    for (const id of memos.keys()) if (!held.has(id)) memos.delete(id);
    snapshot = next;
    return snapshot;
  };

  const subscribe = (listener: () => void) => {
    const watched = new Map<string, { source: Source; off: () => void }>();
    const watch = (key: string, source: Source | undefined) => {
      const current = watched.get(key);
      if (current?.source === source) return;
      current?.off();
      watched.delete(key);
      if (source) watched.set(key, { source, off: source.subscribe(onChange) });
    };
    // An entity reload swaps its stub, and with it the stream and actions to follow.
    const reconcile = () => {
      for (const [id, { entry }] of held) {
        const loaded = entry.lease.snapshot().value;
        watch(`live:${id}`, loaded ? observeState(loaded.stub) : undefined);
        watch(`refresh:${id}`, entry.refresh.snapshot().value?.action);
        (loaded ? instanceActionsOf(loaded) : []).forEach((action, index) => {
          watch(`owned:${id}:${index}`, action);
        });
      }
    };
    const onChange = () => {
      reconcile();
      listener();
    };
    const onMembership = () => {
      const ids = idsOf(shared.latest);
      if (ids) void sync(ids);
    };
    listeners.add(onChange);
    const offCache = cache.subscribe(onChange);
    const offListing = shared.subscribe(onMembership);
    reconcile();
    onMembership();
    return () => {
      listeners.delete(onChange);
      offCache();
      offListing();
      for (const { off } of watched.values()) off();
      watched.clear();
    };
  };

  return {
    value: { subscribe, getSnapshot },
    release: () => {
      released = true;
      for (const { leases } of held.values()) releaseAll(leases);
      held.clear();
      order = [];
    },
  };
};
