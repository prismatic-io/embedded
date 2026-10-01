import type {
  SaveUserConfigurationInput,
  UserConfigurationState,
} from "@prismatic-io/solis-core/protocol";
import type {
  AuthedHandle,
  InstanceStub,
  UserConfigurationStub,
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

export interface LoadedUserConfiguration {
  stub: UserConfigurationStub;
  state: UserConfigurationState;
  save: OwnedAction<SaveUserConfigurationInput, void>;
  remove: OwnedAction<void, void>;
  functions: FunctionOwner;
}

/** The session cache owns this read, its save, and every independent function action. */
export const loadUserConfigurationResource = async ({
  api,
  guard,
  guardRemove,
  instanceId,
}: {
  api: AuthedHandle;
  guard: Guard;
  guardRemove: Guard;
  instanceId: string;
}): Promise<OwnedValue<LoadedUserConfiguration>> => {
  guard();
  let instance: InstanceStub | undefined;
  let stub: UserConfigurationStub | undefined;
  let releaseObserver: (() => void) | undefined;
  let releaseVersionObserver: (() => void) | undefined;
  let disposed = false;
  let save: LoadedUserConfiguration["save"] | undefined;
  let remove: LoadedUserConfiguration["remove"] | undefined;
  const functions = createFunctionOwner(async (key) => {
    guard();
    if (!stub) throw releasedError();
    return stub.createServerFunction({ key });
  });
  const release = () => {
    if (disposed) return;
    disposed = true;
    save?.dispose();
    remove?.dispose();
    functions.release();
    releaseVersionObserver?.();
    releaseObserver?.();
    disposeQuietly(stub);
    disposeQuietly(instance);
  };
  const releasedError = () =>
    Object.assign(new Error("User configuration was released."), {
      code: "PRISMATIC_ACTION_DISPOSED",
    });
  try {
    instance = (await api.instances.get(instanceId)) as unknown as InstanceStub;
    stub =
      (await instance.userConfiguration()) as unknown as UserConfigurationStub;
    const target = stub;
    const settled = await settle<UserConfigurationState>(
      target,
      "user configuration's",
    );
    releaseObserver = settled.release;
    let configuredIntegrationId = settled.state.integrationId;
    const synchronizeVersion = (state: UserConfigurationState) => {
      if (disposed || state.integrationId === configuredIntegrationId) return;
      configuredIntegrationId = state.integrationId;
      functions.invalidate();
    };
    const observed = observeState<UserConfigurationState>(target);
    releaseVersionObserver = observed.subscribe(() => {
      if (observed.status === "ready" && observed.latest)
        synchronizeVersion(observed.latest);
    });
    save = createAction({
      execute: (input: SaveUserConfigurationInput) => {
        guard();
        return target.save(input);
      },
    });
    remove = createAction({
      execute: () => {
        guard();
        guardRemove();
        return target.remove();
      },
    });
    const refreshState = async () => {
      guard();
      const state = await target.refresh();
      if (disposed) throw releasedError();
      synchronizeVersion(state);
      const shared = observeState<UserConfigurationState>(target);
      if (shared.status === "error" || shared.status === "closed") {
        shared.restart();
        const restarted = await settle<UserConfigurationState>(
          target,
          "user configuration's",
        );
        restarted.release();
      }
      if (disposed) throw releasedError();
      return state;
    };
    const value: LoadedUserConfiguration = {
      stub: target,
      state: settled.state,
      save,
      remove,
      functions,
    };
    return {
      value,
      release,
      refresh: async () => {
        try {
          const state = await refreshState();
          return { ...value, state };
        } catch (error) {
          throw Object.assign(
            new Error(toConfigurationError(error).message),
            toConfigurationError(error),
          );
        }
      },
    };
  } catch (error) {
    release();
    throw Object.assign(
      new Error(toConfigurationError(error).message),
      toConfigurationError(error),
    );
  }
};
