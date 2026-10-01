import type { ProtocolMismatchCode, SessionRevokedCode } from "./api.js";
import type {
  Connection,
  ConnectionTemplateRef,
  CreateConnectionPermissionReason,
} from "./connections.js";
import type { ConfigurationExperience } from "./marketplace.js";
import type { Permission } from "./permissions.js";

export type JsonSchema = boolean | Record<string, unknown>;

export type InstanceConfigState =
  | "FULLY_CONFIGURED"
  | "NEEDS_INSTANCE_CONFIGURATION"
  | "NEEDS_USER_LEVEL_CONFIGURATION";

/** One reading of `deployed`, `enabled`, `needsDeploy` and `configState`, so hosts don't
 * rebuild it. Earlier entries win when several apply. */
export type InstanceLifecycle =
  | "notDeployed"
  | "needsReconfiguration"
  | "needsUserConfiguration"
  | "paused"
  | "pendingChanges"
  | "active";

export interface InstanceState {
  id: string;
  name: string;
  description: string | null;
  integrationId: string;
  integrationVersionNumber: number;
  enabled: boolean;
  deployed: boolean;
  needsDeploy: boolean;
  configState: InstanceConfigState;
  lifecycle: InstanceLifecycle;
  lastDeployedAt: string | null;
  lastExecutedAt: string | null;
  flows: readonly InstanceFlow[];
  /** The saved instance configuration, for read-only views; editing goes through init. */
  configuration: InstanceConfiguration;
  /** The authenticated user's personal configuration, or null when the integration asks
   * users for none. */
  userConfiguration: InstanceUserConfiguration | null;
  /** The newer version the marketplace offers, or null when the instance is current. */
  update: InstanceUpdate | null;
  permissions: InstancePermissions;
}

export interface InstanceConfiguration {
  /** Null when nothing has been saved. */
  value: unknown;
  configurationVersion: string | null;
}

export interface InstanceUserConfiguration {
  /** Null when the user hasn't saved personal settings. */
  value: unknown;
  configurationVersion: string | null;
  configured: boolean;
}

export interface InstanceUpdate {
  integrationVersionId: string;
  versionNumber: number;
  /** The newer version saves configuration under a different configuration version, so its
   * init migrates the values and the user should review them before moving. */
  requiresReconfiguration: boolean;
}

export interface InstancePermissions {
  updateDetails: Permission<ConfigurationPermissionReason>;
  deploy: Permission<ConfigurationPermissionReason>;
  /** Moving to {@link InstanceState.update} without reconfiguring. */
  upgrade: Permission<ConfigurationPermissionReason>;
  pause: Permission<ConfigurationPermissionReason>;
  resume: Permission<ConfigurationPermissionReason>;
  remove: Permission<ConfigurationPermissionReason>;
}

export interface InstanceFlow {
  id: string;
  name: string;
  stableId: string | null;
  webhookUrl: string;
  /**
   * Absent until a detail read of this instance loads it: {@link Instance.refreshDetail}, or
   * any {@link Instance.updateDetails}, which reads the flows it checks. List reads never
   * select keys, and a later list read keeps the keys a detail read loaded.
   */
  apiKeys?: readonly string[];
  endpointSecurityType: string;
  permissions: { updateApiKeys: Permission<ConfigurationPermissionReason> };
}

export interface CreateInstanceInput {
  name: string;
  description?: string;
}

/** Omitted details remain unchanged; empty keys clear only the selected flow. */
export interface UpdateInstanceDetailsInput {
  name?: string;
  flows?: readonly { flowId: string; apiKeys: readonly string[] }[];
}

export type ConfigurationPermissionReason =
  | "role-restricted"
  | "connection-missing"
  | "connection-inactive"
  | "connection-visibility-unavailable"
  | "not-deployed"
  | "already-paused"
  | "not-paused"
  | "no-update"
  | "requires-reconfiguration"
  | (string & {});

export interface ConfigurationPermissions {
  init: Permission<ConfigurationPermissionReason>;
  save: Permission<ConfigurationPermissionReason>;
}

export interface ConfigurationServerFunction {
  key: string;
  label: string;
  description: string | null;
  inputSchema: JsonSchema | null;
  outputSchema: JsonSchema | null;
  permission: Permission<ConfigurationPermissionReason>;
}

/**
 * One instance's configuration for one integration version: the instance's current version,
 * or a newer one being reviewed before the instance moves to it. Saved values are not here;
 * they are on {@link InstanceState.configuration}, and editing starts from init.
 */
export interface ConfigurationState {
  instanceId: string;
  /** The integration version this configuration is for. */
  integrationId: string;
  integrationName: string;
  versionNumber: number;
  /** How this version is configured: rendered by the host, or by Prismatic's wizard. */
  configurationExperience: ConfigurationExperience;
  /** The version differs from the one the instance runs, so saving moves the instance. */
  isUpgrade: boolean;
  deployedVersion: number | null;
  needsDeploy: boolean;
  schema: JsonSchema;
  uiSchema: JsonSchema | null;
  configurationVersion: string | null;
  deployedConfigurationVersion: string | null;
  serverFunctions: readonly ConfigurationServerFunction[];
  permissions: ConfigurationPermissions;
}

/** Which integration version a configuration is for; omitted, the instance's current one. */
export interface ConfigurationScopeInput {
  integrationVersionId?: string;
}

export interface ConfigurationFieldError {
  path: string | null;
  message: string;
}

export interface ConfigurationOperationError extends Error {
  code:
    | "PRISMATIC_CONFIGURATION_INVALID"
    | "PRISMATIC_CONFIGURATION_UNAVAILABLE"
    | "PRISMATIC_CONFIGURATION_FORBIDDEN"
    | "PRISMATIC_CONNECTION_UNAVAILABLE"
    /** The instance was deleted; its configuration and personal settings went with it. */
    | "PRISMATIC_INSTANCE_REMOVED"
    | "PRISMATIC_ACTION_DISPOSED"
    | "PRISMATIC_ACTION_BUSY"
    | SessionRevokedCode
    | ProtocolMismatchCode
    | "PRISMATIC_UNKNOWN";
  fields?: readonly ConfigurationFieldError[];
  connectionKeys?: readonly string[];
}

export type Result<T, E> =
  | { status: "success"; data: T }
  | { status: "error"; error: E };

export interface InitializeConfigurationInput {
  connections?: readonly ConfigurationConnectionSelection[];
}

/** Saving a configuration for a newer version also moves the instance to it. */
export interface SaveConfigurationInput {
  value: unknown;
}

export interface SaveUserConfigurationInput {
  value: unknown;
}

/** Persisted configuration for the authenticated user on an existing instance. */
export interface UserConfigurationState {
  instanceId: string;
  integrationId: string;
  versionNumber: number;
  /** Whether the user has saved personal settings, as on the instance's `userConfiguration`. */
  configured: boolean;
  schema: JsonSchema | null;
  uiSchema: JsonSchema | null;
  configurationVersion: string | null;
  value: unknown;
  serverFunctions: readonly ConfigurationServerFunction[];
  permissions: {
    save: Permission<ConfigurationPermissionReason>;
    remove: Permission<ConfigurationPermissionReason>;
  };
}

export interface UserConfigurationTarget {
  state(): ReadableStream<UserConfigurationState>;
  refresh(): Promise<UserConfigurationState>;
  remove(): Promise<Result<void, ConfigurationOperationError>>;
  /** Creates and activates when absent; otherwise updates. Never deploys the instance. */
  save(
    input: SaveUserConfigurationInput,
  ): Promise<Result<void, ConfigurationOperationError>>;
  /** The user-level connections the instance's server functions can run with. */
  readConnectionOptions(): Promise<ConfigurationConnectionOptions>;
  createServerFunction(input: {
    key: string;
  }): Promise<ConfigurationFunctionTarget>;
}

export interface InvokeConfigurationFunctionInput<TInputs = unknown> {
  inputs: TInputs;
  connections?: readonly ConfigurationConnectionSelection[];
}

export interface ConfigurationConnectionSelection {
  key: string;
  id: string;
}

/**
 * A connection a caller needs, and the connections the user may pick for it. Each option is
 * the same connection {@link ConnectionsApi.get} serves; org-activated connections are
 * supplied by the platform and never offered.
 */
export interface ConfigurationConnectionRequirement {
  key: string;
  label: string;
  options: readonly Connection[];
  /** What a new credential for it is made from; `null` when it isn't customer-activated. */
  template: ConnectionTemplateRef | null;
  permissions: {
    createConnection: Permission<CreateConnectionPermissionReason>;
  };
}

/** What init and each server function of the configuration's version need, by caller. */
export interface ConfigurationConnectionOptions {
  init: readonly ConfigurationConnectionRequirement[];
  serverFunctions: Readonly<
    Record<string, readonly ConfigurationConnectionRequirement[]>
  >;
}

/** Owned by its configuration; each factory call has an independent lifetime. */
export interface ConfigurationFunctionTarget {
  execute(
    input: InvokeConfigurationFunctionInput,
  ): Promise<Result<unknown, ConfigurationOperationError>>;
}

export interface ConfigurationTarget {
  state(): ReadableStream<ConfigurationState>;
  refresh(): Promise<ConfigurationState>;
  readConnectionOptions(): Promise<ConfigurationConnectionOptions>;
  init(
    input: InitializeConfigurationInput,
  ): Promise<Result<unknown, ConfigurationOperationError>>;
  save(
    input: SaveConfigurationInput,
  ): Promise<Result<void, ConfigurationOperationError>>;
  /** Invocations run against the configuration's version, wherever the instance is. */
  createServerFunction(input: {
    key: string;
  }): Promise<ConfigurationFunctionTarget>;
}

/** A never-deployed instance is an instance too: its first `deploy()` makes it live. */
export interface Instance {
  state(): ReadableStream<InstanceState>;
  refresh(): Promise<InstanceState>;
  /** A detail read: {@link refresh} plus each flow's `apiKeys`. */
  refreshDetail(): Promise<InstanceState>;
  updateDetails(
    input: UpdateInstanceDetailsInput,
  ): Promise<Result<void, ConfigurationOperationError>>;
  configuration(input?: ConfigurationScopeInput): Promise<ConfigurationTarget>;
  userConfiguration(): Promise<UserConfigurationTarget>;
  deploy(): Promise<void>;
  /** Moves to {@link InstanceState.update} keeping the saved values. Doesn't deploy: the old
   * version keeps running until a deploy succeeds. */
  upgrade(): Promise<Result<void, ConfigurationOperationError>>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  delete(): Promise<void>;
}

export interface ListInstancesInput {
  integrationId?: string;
  limit?: number;
  cursor?: string;
}

export interface InstanceListPage {
  readonly instances: Instance[];
  readonly pageInfo: {
    endCursor: string | null;
    hasNextPage: boolean;
  };
}

export interface InstancesApi {
  get(instanceId: string): Promise<Instance>;
  list(input?: ListInstancesInput): Promise<InstanceListPage>;
}
