import type {
  ConfigurationState,
  InitializeConfigurationInput,
  SaveConfigurationInput,
} from "@prismatic-io/solis-core/protocol";
import type {
  AuthedHandle,
  ConfigurationStub,
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
import type { OwnedValue } from "./resourceCache.js";
import { createFunctionOwner, type FunctionOwner } from "./serverFunctions.js";
import { settle } from "./settle.js";

type OwnedAction<I, O> = DisposableActionHandle<I, O>;

export interface LoadedConfiguration {
  stub: ConfigurationStub;
  state: ConfigurationState;
  init: OwnedAction<InitializeConfigurationInput, unknown>;
  save: OwnedAction<SaveConfigurationInput, void>;
  functions: FunctionOwner;
}

const releasedError = () =>
  Object.assign(new Error("Configuration was released."), {
    code: "PRISMATIC_ACTION_DISPOSED",
  });

const asConfigurationError = (error: unknown) =>
  Object.assign(
    new Error(toConfigurationError(error).message),
    toConfigurationError(error),
  );

/**
 * One instance's configuration for one version, the instance's current one when
 * `integrationVersionId` is omitted. The cache entry owns its actions and the server function
 * targets handed out for it, which go stale when the version it shows changes.
 */
export const loadConfigurationResource = async ({
  api,
  guard,
  instanceId,
  integrationVersionId,
}: {
  api: AuthedHandle;
  guard: Guard;
  instanceId: string;
  integrationVersionId: string | undefined;
}): Promise<OwnedValue<LoadedConfiguration>> => {
  guard();
  let instance: InstanceStub | undefined;
  let stub: ConfigurationStub | undefined;
  let releaseObserver: (() => void) | undefined;
  let releaseVersionObserver: (() => void) | undefined;
  let disposed = false;
  const actions = new Set<{ dispose: () => void }>();
  const functions = createFunctionOwner(async (key) => {
    if (!stub) throw releasedError();
    return stub.createServerFunction({ key });
  });
  const release = () => {
    if (disposed) return;
    disposed = true;
    for (const action of actions) action.dispose();
    actions.clear();
    functions.release();
    releaseVersionObserver?.();
    releaseObserver?.();
    disposeQuietly(stub);
    disposeQuietly(instance);
  };
  const own = <I, O>(action: OwnedAction<I, O>) => {
    if (disposed) action.dispose();
    else actions.add(action);
    return action;
  };
  try {
    const owner = (await api.instances.get(
      instanceId,
    )) as unknown as InstanceStub;
    instance = owner;
    stub = (await owner.configuration(
      integrationVersionId ? { integrationVersionId } : undefined,
    )) as unknown as ConfigurationStub;
    const target = stub;
    const settled = await settle<ConfigurationState>(target, "configuration's");
    releaseObserver = settled.release;
    let shownIntegrationId = settled.state.integrationId;
    const synchronizeVersion = (state: ConfigurationState) => {
      if (disposed || state.integrationId === shownIntegrationId) return;
      shownIntegrationId = state.integrationId;
      functions.invalidate();
    };
    const observed = observeState<ConfigurationState>(target);
    releaseVersionObserver = observed.subscribe(() => {
      if (observed.status === "ready" && observed.latest)
        synchronizeVersion(observed.latest);
    });
    const value: LoadedConfiguration = {
      stub: target,
      state: settled.state,
      init: own(
        createAction({
          execute: (input: InitializeConfigurationInput) => target.init(input),
        }),
      ),
      save: own(
        createAction({
          execute: (input: SaveConfigurationInput) => target.save(input),
        }),
      ),
      functions,
    };
    return {
      value,
      release,
      refresh: async () => {
        try {
          const state = await target.refresh();
          if (disposed) throw releasedError();
          synchronizeVersion(state);
          const shared = observeState<ConfigurationState>(target);
          if (shared.status === "error" || shared.status === "closed") {
            shared.restart();
            const restarted = await settle<ConfigurationState>(
              target,
              "configuration's",
            );
            restarted.release();
          }
          if (disposed) throw releasedError();
          return { ...value, state };
        } catch (error) {
          throw asConfigurationError(error);
        }
      },
    };
  } catch (error) {
    release();
    throw asConfigurationError(error);
  }
};
