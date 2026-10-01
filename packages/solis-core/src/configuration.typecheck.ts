import type {
  Action,
  ActionHandle,
  ConfigurationResource,
  ConfigurationError,
  Result,
} from "./index.js";

const configurationContract = (resource: ConfigurationResource) => {
  const refresh: Promise<Result<void, ConfigurationError>> =
    resource.actions.refresh.execute();
  // @ts-expect-error Refresh uses the common Action contract.
  resource.actions.refresh();
  const save: Promise<Result<void, ConfigurationError>> =
    resource.actions.save.execute({ value: {} });
  resource.actions.save.execute({
    value: {},
    // @ts-expect-error The version is the configuration's scope, not a save input.
    targetIntegrationVersionId: "version-id",
  });
  resource.actions.init.execute({});
  // @ts-expect-error Server functions are owned by the component that runs them.
  resource.actions.createServerFunction;
  // @ts-expect-error The instance owns the only deploy.
  resource.actions.deploy;
  // @ts-expect-error Host values are mandatory.
  resource.actions.save.execute({});
  // @ts-expect-error SDK-owned drafts have been removed.
  resource.draft;
  // @ts-expect-error Permissions belong to successful data.
  resource.permissions;
  // @ts-expect-error No consumer RPC ownership.
  resource.stub;
  if (resource.status === "success") {
    // @ts-expect-error Saved values are on the instance; editing starts from init.
    resource.data.value;
    // @ts-expect-error The configuration is already scoped to the version it shows.
    resource.data.upgradeTarget;
    const isUpgrade: boolean = resource.data.isUpgrade;
    const name: string = resource.data.integrationName;
    const experience: "headless" | "hosted" =
      resource.data.configurationExperience;
    const connections = resource.data.connections;
    if (connections.status === "success") {
      const [requirement] = connections.data.init;
      const id: string | undefined = requirement?.options[0]?.id;
      const fn = connections.data.serverFunctions.listTables;
      void id;
      void fn;
    }
    const refreshing: boolean = resource.isRefreshing;
    return { isUpgrade, name, experience, refreshing, refresh, save };
  }
  // @ts-expect-error Unsuccessful resources have no data.
  resource.data;
  if (resource.status === "error") {
    const error: ConfigurationError = resource.error;
    const refreshing: boolean = resource.isRefreshing;
    return { error, refreshing };
  }
  // @ts-expect-error Initial loading has no refresh progress.
  resource.isRefreshing;
};

const actionContract = (
  handle: ActionHandle<{ inputs: unknown }, unknown, ConfigurationError>,
) => {
  const action: Action<{ inputs: unknown }, unknown, ConfigurationError> =
    handle.getSnapshot();
  const unsubscribe: () => void = handle.subscribe(() => {});
  const result: Promise<Result<unknown, ConfigurationError>> = action.execute({
    inputs: {},
  });
  if (action.status === "success") {
    const data: unknown = action.data;
    // @ts-expect-error Success has no error.
    action.error;
    return { data, result, unsubscribe };
  }
  // @ts-expect-error Data exists only after success.
  action.data;
  if (action.status === "error") return action.error.code;
  // @ts-expect-error Idle/loading has no error.
  action.error;
};
void configurationContract;
void actionContract;
