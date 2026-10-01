import type {
  ConfigurationOperationError,
  ConfigurationState,
  ConnectionState,
  CreateConnectionPermissionReason,
  CreateInstanceInput,
  InitializeConfigurationInput,
  InstanceState,
  InvokeConfigurationFunctionInput,
  MarketplaceIntegrationState,
  Permission,
  SaveConfigurationInput,
  SaveUserConfigurationInput,
  UpdateInstanceDetailsInput,
  UserConfigurationState,
} from "./protocol/index.js";
import type { Action } from "./action.js";
import type { BaseErrorCode } from "./errors.js";

export type {
  ConnectionPermissionReason,
  ConnectionPermissions,
  CreateConnectionPermissionReason,
  CreateInstanceInput,
  CreateInstancePermission,
  CreateInstancePermissionReason,
  InstanceConfiguration,
  InstancePermissions,
  InstanceUpdate,
  InstanceUserConfiguration,
  MarketplaceIntegrationPermissions,
  Permission,
} from "./protocol/index.js";

/** Structural: error class identity does not survive RPC. */
export interface PrismaticError extends Error {
  readonly code: string;
}

export interface MarketplaceIntegrationError extends PrismaticError {
  readonly code:
    | "PRISMATIC_SESSION_REVOKED"
    | "PRISMATIC_PROTOCOL_MISMATCH"
    | "PRISMATIC_MARKETPLACE_INTEGRATION_NOT_FOUND"
    | "PRISMATIC_MARKETPLACE_INTEGRATION_UNAVAILABLE"
    | BaseErrorCode;
}

export type Resource<
  T,
  TError extends PrismaticError = PrismaticError,
  TActions = Record<string, never>,
> = { actions: TActions } & (
  | { status: "loading" }
  | { status: "error"; error: TError; isRefreshing: boolean }
  | {
      status: "success";
      data: T;
      isRefreshing: boolean;
    }
);

/** Where a list's loaded window sits. `hasPreviousPage` is only ever true in replace mode. */
export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** A list item is the entity's own resource plus a stable id to key it by. */
export type ListItem<R> = R & { id: string };

/** Every list hook's input extends this. `onPageLoad` defaults to `"append"`. */
export interface ListInput {
  pageSize?: number;
  onPageLoad?: "append" | "replace";
}

/**
 * Every list, paged or not. Paging status is `loadNextPage.status`, not a `pageInfo`
 * field; a list that does not page reports `hasNextPage: false`.
 */
export type ListResource<
  R,
  TError extends PrismaticError = PrismaticError,
  TActions extends object = Record<never, never>,
> = Resource<
  { items: readonly ListItem<R>[]; pageInfo: PageInfo },
  TError,
  TActions & {
    refresh: Action<void, void, TError>;
    loadNextPage: Action<void, void, TError>;
    loadPreviousPage: Action<void, void, TError>;
  }
>;

export type Instance = InstanceState;

export interface MarketplaceIntegrationActions {
  refresh: Action<void, void, MarketplaceIntegrationError>;
  /** Creates a never-deployed instance; gate it on `permissions.createInstance`. */
  createInstance: Action<
    CreateInstanceInput,
    Instance,
    MarketplaceIntegrationError
  >;
}

/**
 * A listing, carrying its instances on every version as instance resources: each is the
 * resource `useInstance(id)` returns, sharing its cache entry, live state and actions.
 */
export type MarketplaceIntegration = Omit<
  MarketplaceIntegrationState,
  "instances"
> & { instances: readonly ListItem<InstanceResource>[] };

export type MarketplaceIntegrationResource = Resource<
  MarketplaceIntegration,
  MarketplaceIntegrationError,
  MarketplaceIntegrationActions
>;

export type ConfigurationError = ConfigurationOperationError;

/** A new credential for a requirement, which the user then selects by its id. */
export interface CreateConnectionInput extends ConnectOptions {
  /** The name the customer gives it. */
  label?: string;
  /** Input values by name, beside the ones the connection supplies. */
  inputs?: Readonly<Record<string, string>>;
}

/** A connection a caller needs, offering the connections the user may pick for it. */
export interface ConfigurationConnectionRequirement {
  key: string;
  label: string;
  /** The same resources `useConnection(id)` returns. Org-activated connections are
   * supplied by the platform and never offered. */
  options: readonly ListItem<ConnectionResource>[];
  permissions: {
    createConnection: Permission<CreateConnectionPermissionReason>;
  };
  actions: {
    /**
     * Makes the customer a credential for this requirement and connects it, in one click:
     * an OAuth connection opens its consent screen from the click, a client-credentials
     * one connects as it's made. Resolves with the new connection once it's connected,
     * and it joins `options`. Call it from the click handler.
     */
    createConnection: Action<
      CreateConnectionInput,
      Connection,
      ConnectionError
    >;
  };
}

/** What init and each server function need, by caller. */
export interface ConfigurationConnections {
  init: readonly ConfigurationConnectionRequirement[];
  serverFunctions: Readonly<
    Record<string, readonly ConfigurationConnectionRequirement[]>
  >;
}

/** Loads in the background once its configuration has loaded, never holding it up. */
export type ConfigurationConnectionsResource = Resource<
  ConfigurationConnections,
  ConfigurationError,
  { refresh: Action<void, void, ConfigurationError> }
>;

export type Configuration = ConfigurationState & {
  connections: ConfigurationConnectionsResource;
};

/** One run of a server function, owned by the component that holds it. */
export type ServerFunctionAction<TInputs = unknown, TOutput = unknown> = Action<
  InvokeConfigurationFunctionInput<TInputs>,
  TOutput,
  ConfigurationError
>;

export interface ConfigurationActions {
  refresh: Action<void, void, ConfigurationError>;
  init: Action<InitializeConfigurationInput, unknown, ConfigurationError>;
  /** Saving a newer version's configuration also moves the instance to that version. */
  save: Action<SaveConfigurationInput, void, ConfigurationError>;
}

export type ConfigurationResource = Resource<
  Configuration,
  ConfigurationError,
  ConfigurationActions
>;

export type UserConfiguration = UserConfigurationState & {
  connections: ConfigurationConnectionsResource;
};

export interface InstanceActions {
  updateDetails: Action<UpdateInstanceDetailsInput, void, ConfigurationError>;
  deploy: Action<void, void, ConfigurationError>;
  /** Moves to `update` keeping the saved values; gate it on `permissions.upgrade`. Doesn't
   * deploy. */
  upgrade: Action<void, void, ConfigurationError>;
  pause: Action<void, void, ConfigurationError>;
  resume: Action<void, void, ConfigurationError>;
  remove: Action<void, void, ConfigurationError>;
  refresh: Action<void, void, ConfigurationError>;
}

export type InstanceResource = Resource<
  Instance,
  ConfigurationError,
  InstanceActions
>;

export interface UserConfigurationActions {
  refresh: Action<void, void, ConfigurationError>;
  save: Action<SaveUserConfigurationInput, void, ConfigurationError>;
  remove: Action<void, void, ConfigurationError>;
}

export type UserConfigurationResource = Resource<
  UserConfiguration,
  ConfigurationError,
  UserConfigurationActions
>;

export interface ConnectionError extends PrismaticError {
  readonly code:
    | "PRISMATIC_CONNECTION_NOT_FOUND"
    | "PRISMATIC_CONNECTION_REMOVED"
    /** The connection's permissions deny it. */
    | "PRISMATIC_CONNECTION_FORBIDDEN"
    | "PRISMATIC_CONNECTION_INVALID"
    /** The provider or the platform refused the authorization. */
    | "PRISMATIC_CONNECT_FAILED"
    | "PRISMATIC_CONNECT_TIMEOUT"
    /** The host aborted through `signal`. */
    | "PRISMATIC_CONNECT_ABORTED"
    /** The user closed the consent window and the connection never connected. */
    | "PRISMATIC_CONNECT_ABANDONED"
    /** The browser refused the consent window: call `connect` from a click. */
    | "PRISMATIC_POPUP_BLOCKED"
    | BaseErrorCode;
}

export type Connection = ConnectionState;

export interface ConnectOptions {
  /** How long to wait for the user to consent. Defaults to 10 minutes. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

// biome-ignore lint/suspicious/noConfusingVoidType: lets `connect.execute()` take no argument
export type ConnectInput = ConnectOptions | void;

export interface ConnectionActions {
  refresh: Action<void, void, ConnectionError>;
  /**
   * Authorizes an OAuth connection: opens the provider's consent screen from the click and
   * resolves with the connection once it's `ACTIVE`, or with why it isn't. Call it from the
   * click handler, before any `await`. Gate it on `data.permissions.connect`.
   */
  connect: Action<ConnectInput, Connection, ConnectionError>;
  /** Gate it on `data.permissions.disconnect`. Resolves with the connection, now `PENDING`. */
  disconnect: Action<void, Connection, ConnectionError>;
}

export type ConnectionResource = Resource<
  Connection,
  ConnectionError,
  ConnectionActions
>;
