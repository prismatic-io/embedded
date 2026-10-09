/** Headless RPC client for Prismatic. The wire contract lives at `@prismatic-io/solis-core/protocol`. */

// Types a runtime caller cannot avoid naming: the options bag `createClient` takes, and
// what `serverInfo` and `hasFeature` hand back. Everything else comes from the protocol package.
export type {
  ConfigurationConnectionSelection,
  ConfigurationFlow,
  ConfigurationOperationError,
  ConfigurationPermissionReason,
  ConfigurationPermissions,
  ConfigurationScopeInput,
  ConfigurationServerFunction,
  FeatureName,
  FlowSchedule,
  HostApi,
  InitializeConfigurationInput,
  InvokeConfigurationFunctionInput,
  PreAuthApi,
  PrismaticApi,
  ProtocolVersion,
  Result,
  SaveConfigurationInput,
  SaveUserConfigurationInput,
  ServerInfo,
  UpdateInstanceDetailsInput,
} from "./protocol/index.js";
// Re-exported for hosts that boot a frame themselves or implement the frame side.
export {
  headlessPath,
  PORT_EVENT,
  PROTOCOL_MISMATCH_CODE,
  PROTOCOL_VERSION,
  READY_EVENT,
  redactError,
  SESSION_REVOKED_CODE,
} from "./protocol/index.js";
export type { Action, ActionHandle } from "./action.js";
export type {
  AuthedHandle,
  Client,
  ConfigurationStub,
  ConnectionStub,
  CreateClientOptions,
  InstanceStub,
  IntegrationStub,
  StatefulStub,
  UserConfigurationStub,
} from "./client.js";
export {
  ConnectError,
  createClient,
  ProtocolMismatchError,
} from "./client.js";
export type { BaseErrorCode } from "./errors.js";
export {
  baseErrorCodes,
  hasFeature,
  isProtocolMismatch,
  isSessionRevoked,
} from "./errors.js";
export type {
  Configuration,
  ConfigurationActions,
  ConfigurationConnectionRequirement,
  ConfigurationConnections,
  ConfigurationConnectionsResource,
  ConfigurationError,
  ConfigurationResource,
  Connection,
  ConnectionActions,
  ConnectionError,
  ConnectionPermissionReason,
  ConnectionPermissions,
  ConnectionResource,
  ConnectInput,
  ConnectOptions,
  CreateConnectionInput,
  CreateConnectionPermissionReason,
  CreateInstanceInput,
  CreateInstancePermission,
  CreateInstancePermissionReason,
  Instance,
  InstanceActions,
  InstanceConfiguration,
  InstancePermissions,
  InstanceResource,
  InstanceUpdate,
  InstanceUserConfiguration,
  ListInput,
  ListItem,
  ListResource,
  MarketplaceIntegration,
  MarketplaceIntegrationActions,
  MarketplaceIntegrationError,
  MarketplaceIntegrationPermissions,
  MarketplaceIntegrationResource,
  PageInfo,
  Permission,
  PrismaticError,
  Resource,
  ServerFunctionAction,
  UserConfiguration,
  UserConfigurationActions,
  UserConfigurationResource,
} from "./resource.js";
export type {
  RpcEvent,
  RpcEventListener,
  TableEntry,
  TableEntryKind,
  Telemetry,
} from "./telemetry.js";
export type {
  OpenVisibleFrameOptions,
  VisibleFrameMount,
} from "./visibleFrame.js";
