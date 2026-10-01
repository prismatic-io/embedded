import type {
  InstanceState,
  UpdateInstanceDetailsInput,
} from "@prismatic-io/solis-core/protocol";
import type {
  Action,
  AuthedHandle,
  ConfigurationError,
  InstanceActions,
  InstanceResource,
  InstanceStub,
} from "@prismatic-io/solis-core";
import {
  createAction,
  type DisposableActionHandle,
  disposeQuietly,
  observeState,
  toConfigurationError,
} from "@prismatic-io/solis-core/internal";
import type { Guard } from "./loaders.js";
import type { OwnedValue, Snapshot } from "./resourceCache.js";
import { settle } from "./settle.js";
import { toResource } from "./toResource.js";
import { unavailableAction } from "./unavailableAction.js";

type OwnedAction<I> = DisposableActionHandle<I, void>;

export interface LoadedInstanceResource {
  stub: InstanceStub;
  state: InstanceState;
  /**
   * Reads the API keys of flows a detail view hasn't asked for yet, such as those a version
   * move brought. A failed read leaves them without keys until a refresh.
   */
  loadFlowApiKeys: () => Promise<void>;
  updateDetails: OwnedAction<UpdateInstanceDetailsInput>;
  deploy: OwnedAction<void>;
  upgrade: OwnedAction<void>;
  pause: OwnedAction<void>;
  resume: OwnedAction<void>;
  remove: OwnedAction<void>;
}

/** What an instance's writes must refresh beyond the instance itself. */
export interface InstanceEffects {
  /** A write that may move the instance in or across lists. */
  changed: () => void;
  removed: (instanceId: string) => void;
}

/** What an instance entry needs to own its actions. */
export interface InstanceOwnership {
  guard: Guard;
  guardDetails: Guard;
  guardUpgrade: Guard;
  effects: InstanceEffects;
}

/** Reads one instance by id into the entry every list and detail view of it shares. */
export const loadInstanceResource = async ({
  api,
  instanceId,
  ...ownership
}: InstanceOwnership & {
  api: AuthedHandle;
  instanceId: string;
  detail?: boolean;
}): Promise<OwnedValue<LoadedInstanceResource>> => {
  ownership.guard();
  return ownInstance({
    ...ownership,
    acquire: async () =>
      (await api.instances.get(instanceId)) as unknown as InstanceStub,
  });
};

const ignore = () => {};

/**
 * Takes ownership of an instance stub, warms its stream and binds its actions, so a listed
 * instance's entry carries the same actions as one read by id. A detail read also loads
 * each flow's API keys before the entry settles; whether or not that succeeds, the instance
 * itself is ready.
 */
export const ownInstance = async ({
  acquire,
  guard,
  guardDetails,
  guardUpgrade,
  effects,
  detail = false,
}: InstanceOwnership & {
  acquire: () => Promise<InstanceStub>;
  detail?: boolean;
}): Promise<OwnedValue<LoadedInstanceResource>> => {
  let stub: InstanceStub | undefined;
  const flowsAskedForKeys = new Set<string>();
  let disposed = false;
  let deleted = false;
  const observers: (() => void)[] = [];
  const actions: { dispose: () => void }[] = [];
  const release = () => {
    if (disposed) return;
    disposed = true;
    for (const action of actions) action.dispose();
    for (const observer of observers) observer();
    disposeQuietly(stub);
  };
  const assertLive = () => {
    guard();
    if (disposed || deleted)
      throw Object.assign(new Error("Instance was released or removed."), {
        code: "PRISMATIC_ACTION_DISPOSED",
      });
  };
  try {
    stub = await acquire();
    const target = stub;
    if (detail) await target.refreshDetail().catch(ignore);
    const settled = await settle<InstanceState>(target, "instance's");
    observers.push(settled.release);
    if (detail)
      for (const { id } of settled.state.flows) flowsAskedForKeys.add(id);
    const state = () =>
      observeState<InstanceState>(target).latest ?? settled.state;
    const own = <I>(run: (input: I) => Promise<void>) => {
      const action = createAction<I, void>({
        execute: async (input) => {
          assertLive();
          await run(input);
          if (disposed)
            throw Object.assign(new Error("Instance was released."), {
              code: "PRISMATIC_ACTION_DISPOSED",
            });
          return { status: "success", data: undefined };
        },
      });
      actions.push(action);
      return action;
    };
    const enabledTarget = () => {
      if (!state().deployed)
        throw Object.assign(
          new Error("Pause and resume require a deployed instance."),
          {
            code: "PRISMATIC_CONFIGURATION_INVALID",
          },
        );
      return target;
    };
    /**
     * Re-reads the keys too once a detail view asked for them, so they don't go stale and a
     * failed key read is retried. Failing that, the instance still refreshes.
     */
    const refreshState = async () => {
      await (flowsAskedForKeys.size > 0 ||
      state().flows.some(({ apiKeys }) => apiKeys !== undefined)
        ? target.refreshDetail().catch(() => target.refresh())
        : target.refresh());
      assertLive();
      const observed = observeState(target);
      if (observed.status === "error" || observed.status === "closed") {
        observed.restart();
        const restarted = await settle(target, "instance's");
        restarted.release();
      }
    };
    const value: LoadedInstanceResource = {
      stub: target,
      state: settled.state,
      loadFlowApiKeys: async () => {
        const unasked = state().flows.filter(
          ({ id, apiKeys }) =>
            apiKeys === undefined && !flowsAskedForKeys.has(id),
        );
        if (!unasked.length) return;
        for (const { id } of unasked) flowsAskedForKeys.add(id);
        await target.refreshDetail().catch(ignore);
      },
      updateDetails: own<UpdateInstanceDetailsInput>(async (input) => {
        guardDetails();
        const result = await target.updateDetails(input);
        if (result.status === "error") throw result.error;
      }),
      deploy: own<void>(async () => {
        await target.deploy();
        assertLive();
        effects.changed();
      }),
      upgrade: own<void>(async () => {
        guardUpgrade();
        const result = await target.upgrade();
        if (result.status === "error") throw result.error;
        assertLive();
        effects.changed();
      }),
      pause: own<void>(async () => enabledTarget().pause()),
      resume: own<void>(async () => enabledTarget().resume()),
      remove: own<void>(async () => {
        await target.delete();
        deleted = true;
        effects.removed(settled.state.id);
      }),
    };
    return {
      value,
      release,
      refresh: async () => {
        await refreshState();
        return value;
      },
    };
  } catch (error) {
    release();
    throw error;
  }
};

const removedError = () =>
  Object.assign(new Error("Instance was removed."), {
    code: "PRISMATIC_INSTANCE_REMOVED",
  });

/** The one projection behind a detail read and an instance list item alike. */
export const toInstanceResource = ({
  error,
  loaded,
  live,
  isRefreshing,
  actions,
}: {
  error: unknown;
  loaded: LoadedInstanceResource | undefined;
  live: InstanceState | undefined;
  isRefreshing: boolean;
  actions: InstanceActions;
}): InstanceResource =>
  toResource({
    error:
      error ?? (actions.remove.status === "success" ? removedError() : null),
    data: loaded && (live ?? loaded.state),
    isRefreshing,
    actions,
    toError: toConfigurationError,
  });

const NOT_LOADED = "Instance is not loaded.";
export const unavailableDetails = unavailableAction<
  UpdateInstanceDetailsInput,
  void
>(NOT_LOADED);
export const unavailableVoid = unavailableAction<void, void>(NOT_LOADED);

/** The actions an instance entry owns, whose statuses its item shows. */
export const instanceActionsOf = ({
  updateDetails,
  deploy,
  upgrade,
  pause,
  resume,
  remove,
}: LoadedInstanceResource) => [
  updateDetails,
  deploy,
  upgrade,
  pause,
  resume,
  remove,
];

/** An instance held on someone else's behalf, as a list or a listing holds it. */
export const toInstanceItemResource = ({
  error,
  entry,
  live,
  refresh,
}: {
  error: unknown;
  entry: Snapshot<LoadedInstanceResource>;
  live: InstanceState | undefined;
  refresh: Action<void, void, ConfigurationError>;
}): InstanceResource => {
  const loaded = entry.value;
  return toInstanceResource({
    error,
    loaded,
    live,
    isRefreshing: entry.isRefetching || refresh.status === "loading",
    actions: {
      updateDetails: (
        loaded?.updateDetails ?? unavailableDetails
      ).getSnapshot(),
      deploy: (loaded?.deploy ?? unavailableVoid).getSnapshot(),
      upgrade: (loaded?.upgrade ?? unavailableVoid).getSnapshot(),
      pause: (loaded?.pause ?? unavailableVoid).getSnapshot(),
      resume: (loaded?.resume ?? unavailableVoid).getSnapshot(),
      remove: (loaded?.remove ?? unavailableVoid).getSnapshot(),
      refresh,
    },
  });
};
