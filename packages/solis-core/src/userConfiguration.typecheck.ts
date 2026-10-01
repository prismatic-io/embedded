import type { Instance, UserConfigurationTarget } from "./protocol/index.js";
import type {
  ConfigurationError,
  Permission,
  Result,
  UserConfigurationResource,
} from "./index.js";

const userConfigurationContract = (
  resource: UserConfigurationResource,
  instance: Instance,
) => {
  const target: Promise<UserConfigurationTarget> = instance.userConfiguration();
  const refresh: Promise<Result<void, ConfigurationError>> =
    resource.actions.refresh.execute();
  const save: Promise<Result<void, ConfigurationError>> =
    resource.actions.save.execute({ value: {} });
  // @ts-expect-error Explicit host values are mandatory.
  resource.actions.save.execute({});
  resource.actions.save.execute({
    value: {},
    // @ts-expect-error User saves cannot select an integration version.
    targetIntegrationVersionId: "version",
  });
  // @ts-expect-error There is no user init action.
  resource.actions.init.execute({});
  // @ts-expect-error There is no user deploy action.
  resource.actions.deploy.execute({});
  // @ts-expect-error Scope is not caller-selectable.
  resource.scope;
  // @ts-expect-error No SDK-owned form state.
  resource.draft;
  // @ts-expect-error Permissions belong to successful data.
  resource.permissions;
  if (resource.status === "success") {
    const permission: Permission = resource.data.permissions.save;
    const configured: boolean = resource.data.configured;
    // @ts-expect-error Backend record ids stay inside the frame.
    resource.data.configurationId;
    const value: unknown = resource.data.value;
    const connections = resource.data.connections.status;
    void connections;
    // @ts-expect-error Server functions are owned by the component that runs them.
    resource.actions.createServerFunction;
    // @ts-expect-error No user target switch.
    resource.data.upgradeTarget;
    return { target, refresh, save, permission, configured, value };
  }
  // @ts-expect-error Data requires successful narrowing.
  resource.data;
  if (resource.status === "error") return resource.error.code;
  // @ts-expect-error Initial loading has no refresh state.
  resource.isRefreshing;
};
void userConfigurationContract;
