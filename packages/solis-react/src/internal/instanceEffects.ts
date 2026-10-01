import type { InstanceState } from "@prismatic-io/solis-core/protocol";
import type { AuthedHandle, InstanceStub } from "@prismatic-io/solis-core";
import { useCallback, useMemo } from "react";
import { useFeature } from "../domain/useFeature.js";
import { useResourceCache, useSessionToken } from "../PrismaticProvider.js";
import {
  type InstanceEffects,
  type InstanceOwnership,
  loadInstanceResource,
  ownInstance,
} from "./instanceResource.js";
import type { NestedInstanceOwnership } from "./integrationInstances.js";
import { keys } from "./keys.js";
import { useInvalidate, useRefreshFamily } from "./useResource.js";

/**
 * A write that changes which lists hold an instance refreshes every instance list in place,
 * and the listings whose rollups count it. Removal also drops the instance's configurations.
 */
export const useInstanceEffects = (): InstanceEffects => {
  const invalidate = useInvalidate();
  const refreshFamily = useRefreshFamily();
  return useMemo(() => {
    const changed = () => {
      refreshFamily(keys.instances());
      refreshFamily(keys.marketplace());
    };
    return {
      changed,
      removed: (instanceId) => {
        changed();
        for (const owner of [
          keys.configuration(instanceId),
          keys.userConfiguration(instanceId),
        ]) {
          invalidate(owner);
          invalidate(keys.configurationConnections(owner));
        }
      },
    };
  }, [invalidate, refreshFamily]);
};

/** What an instance entry needs to own its actions, as every reader of one binds them. */
const useInstanceOwnership = (): InstanceOwnership => {
  const guard = useFeature("instances");
  const guardDetails = useFeature("instances.updateDetails");
  const guardUpgrade = useFeature("instances.upgrade");
  const effects = useInstanceEffects();
  return useMemo(
    () => ({ guard, guardDetails, guardUpgrade, effects }),
    [guard, guardDetails, guardUpgrade, effects],
  );
};

/** What a listing needs to hold its instances as the entries `useInstance(id)` reads. */
export const useNestedInstanceOwnership = (): NestedInstanceOwnership => {
  const cache = useResourceCache();
  const token = useSessionToken();
  const ownership = useInstanceOwnership();
  return useMemo(
    () => ({ cache, token, ownership }),
    [cache, token, ownership],
  );
};

/** Takes a just-created instance into the cache and refreshes the lists it joins. */
export type AdoptInstance = (input: {
  api: AuthedHandle;
  created: InstanceStub;
}) => Promise<InstanceState>;

/**
 * Adopts a created instance as the entry `useInstance(id)` reads, so routing to it costs no
 * second read. Nothing holds the entry afterwards, so it is swept like any unread one.
 */
export const useAdoptInstance = (): AdoptInstance => {
  const cache = useResourceCache();
  const token = useSessionToken();
  const ownership = useInstanceOwnership();
  return useCallback(
    async ({ api, created }) => {
      const incoming = await ownInstance({
        ...ownership,
        acquire: async () => created,
      });
      const { state } = incoming.value;
      const lease = cache.retain({
        key: `${token}:${keys.instance(state.id)}`,
        load: () =>
          loadInstanceResource({ ...ownership, api, instanceId: state.id }),
        incoming,
      });
      try {
        await lease.ready;
      } finally {
        lease.release();
      }
      ownership.effects.changed();
      return state;
    },
    [cache, token, ownership],
  );
};
