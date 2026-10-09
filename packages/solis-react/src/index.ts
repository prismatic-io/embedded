/**
 * React bindings for the Prismatic headless SDK.
 *
 * SSR is unsupported: the provider boots the iframe in an effect, so every hook renders
 * `loading` during a server render.
 */

export type {
  ConfigurationExperience,
  ConfigurationFlow,
  ConnectionKind,
  ConnectionStatus,
  FlowSchedule,
  HostApi,
  InstanceFlow,
  InstanceLifecycle,
  JsonSchema,
  MarketplaceFilterOptions,
  MarketplaceOrdering,
} from "@prismatic-io/solis-core/protocol";
export type {
  Action,
  ActionHandle,
  Configuration,
  ConfigurationActions,
  ConfigurationConnectionRequirement,
  ConfigurationConnections,
  ConfigurationConnectionSelection,
  ConfigurationConnectionsResource,
  ConfigurationError,
  ConfigurationPermissionReason,
  ConfigurationPermissions,
  ConfigurationResource,
  ConfigurationServerFunction,
  Connection,
  ConnectInput,
  ConnectionActions,
  ConnectOptions,
  ConnectionError,
  ConnectionPermissionReason,
  ConnectionPermissions,
  ConnectionResource,
  CreateConnectionInput,
  CreateConnectionPermissionReason,
  CreateInstanceInput,
  CreateInstancePermission,
  CreateInstancePermissionReason,
  InitializeConfigurationInput,
  Instance,
  InstanceActions,
  InstanceConfiguration,
  InstancePermissions,
  InstanceResource,
  InstanceUpdate,
  InstanceUserConfiguration,
  InvokeConfigurationFunctionInput,
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
  Result,
  RpcEvent,
  RpcEventListener,
  SaveConfigurationInput,
  SaveUserConfigurationInput,
  ServerFunctionAction,
  UpdateInstanceDetailsInput,
  UserConfiguration,
  UserConfigurationActions,
  UserConfigurationResource,
} from "@prismatic-io/solis-core";
export type { HostedConfigurationProps } from "./domain/HostedConfiguration.js";
export { HostedConfiguration } from "./domain/HostedConfiguration.js";
export { useAction } from "./domain/useAction.js";
export type { AuthenticatedUserResource } from "./domain/useAuthenticatedUser.js";
export { useAuthenticatedUser } from "./domain/useAuthenticatedUser.js";
export type { ConfigurationInput } from "./domain/useConfiguration.js";
export { useConfiguration } from "./domain/useConfiguration.js";
export type { ConnectionsInput } from "./domain/useConnections.js";
export { useConnection, useConnections } from "./domain/useConnections.js";
export type { InstancesInput } from "./domain/useInstances.js";
export { useInstance, useInstances } from "./domain/useInstances.js";
export type { MarketplaceInput } from "./domain/useMarketplace.js";
export { useMarketplace } from "./domain/useMarketplace.js";
export type { MarketplaceFilterOptionsResource } from "./domain/useMarketplaceFilters.js";
export { useMarketplaceFilterOptions } from "./domain/useMarketplaceFilters.js";
export { useMarketplaceIntegration } from "./domain/useMarketplaceIntegration.js";
export { useServerFunction } from "./domain/useServerFunction.js";
export { useUserConfiguration } from "./domain/useUserConfiguration.js";
export type {
  AttachedProviderProps,
  BootedProviderProps,
  PrismaticAuth,
  PrismaticProviderProps,
  PrismaticSession,
  PrismaticSessionActions,
  PrismaticSessionResource,
} from "./PrismaticProvider.js";
export {
  PrismaticProvider,
  usePrismatic,
  usePrismaticClient,
} from "./PrismaticProvider.js";
