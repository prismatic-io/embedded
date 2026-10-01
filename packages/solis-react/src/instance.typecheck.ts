import type {
  Instance,
  InstanceLifecycle,
  InstanceState,
} from "@prismatic-io/solis-core/protocol";
import type {
  ConfigurationError,
  InstanceConfiguration,
  InstanceResource,
  InstanceUpdate,
  InstanceUserConfiguration,
  Permission,
  Result,
} from "./index.js";
import { useInstance } from "./index.js";

const useInstanceContract = () => {
  const resource: InstanceResource = useInstance("instance");
  // @ts-expect-error An id alone addresses an instance, deployed or not.
  useInstance("instance", { integrationId: "owner" });
  const update: Promise<Result<void, ConfigurationError>> =
    resource.actions.updateDetails.execute({
      name: "Orders",
      flows: [{ flowId: "flow", apiKeys: [] }],
    });
  const deploy: Promise<Result<void, ConfigurationError>> =
    resource.actions.deploy.execute();
  const refresh: Promise<Result<void, ConfigurationError>> =
    resource.actions.refresh.execute();
  const upgrade: Promise<Result<void, ConfigurationError>> =
    resource.actions.upgrade.execute();
  // @ts-expect-error Upgrade moves to the offered update; it takes no target.
  resource.actions.upgrade.execute({ integrationVersionId: "v2" });
  // @ts-expect-error Instance resources do not expose RPC stubs.
  resource.stub;
  // @ts-expect-error Data requires successful narrowing.
  resource.data;
  // @ts-expect-error Flow ids are required.
  resource.actions.updateDetails.execute({ flows: [{ apiKeys: [] }] });
  resource.actions.updateDetails.execute({
    // @ts-expect-error API keys are string lists.
    flows: [{ flowId: "flow", apiKeys: "key" }],
  });
  // @ts-expect-error Refresh uses the common Action contract.
  resource.actions.refresh();
  if (resource.status === "success") {
    const state: InstanceState = resource.data;
    const keys: readonly string[] | undefined = resource.data.flows[0].apiKeys;
    // @ts-expect-error Keys are absent until a detail read loads them.
    const loaded: readonly string[] = resource.data.flows[0].apiKeys;
    const lifecycle: InstanceLifecycle = resource.data.lifecycle;
    const saved: InstanceConfiguration = resource.data.configuration;
    const personal: InstanceUserConfiguration | null =
      resource.data.userConfiguration;
    const offered: InstanceUpdate | null = resource.data.update;
    // @ts-expect-error The update may be absent; narrow before reading it.
    resource.data.update.requiresReconfiguration;
    const {
      updateDetails,
      deploy: mayDeploy,
      upgrade: mayUpgrade,
      pause,
      resume,
      remove,
    } = resource.data.permissions;
    const permissions: Permission[] = [
      updateDetails,
      mayDeploy,
      mayUpgrade,
      pause,
      resume,
      remove,
    ];
    return {
      update,
      deploy,
      upgrade,
      refresh,
      keys,
      loaded,
      state,
      lifecycle,
      saved,
      personal,
      offered,
      permissions,
    };
  }
  return { update, deploy, upgrade, refresh };
};
void useInstanceContract;

const instanceProtocolContract = (instance: Instance) => {
  // @ts-expect-error Flow data belongs to instance state, not a second target.
  instance.flows();
  // @ts-expect-error Renaming goes through updateDetails.
  instance.rename({ name: "Renamed" });
};
void instanceProtocolContract;
