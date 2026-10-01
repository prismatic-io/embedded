import type {
  Client,
  ListItem,
  ListResource,
  MarketplaceIntegrationError,
  MarketplaceIntegrationResource,
  PageInfo,
  PrismaticError,
  Resource,
} from "@prismatic-io/solis-core";
import {
  type AuthenticatedUserResource,
  type ConnectionPermissionReason,
  type CreateInstancePermission,
  type CreateInstancePermissionReason,
  type PrismaticSessionResource,
  useAuthenticatedUser,
  useConfiguration,
  useConnection,
  useInstance,
  useInstances,
  useMarketplace,
  useMarketplaceIntegration,
  usePrismatic,
  usePrismaticClient,
} from "./index.js";

// @ts-expect-error The obsolete singular hook is not part of the public API.
export type RemovedIntegrationHook = typeof import("./index.js").useIntegration;

const usePublicIntegration = () => {
  const resource: MarketplaceIntegrationResource =
    useMarketplaceIntegration(null);
  // @ts-expect-error <HostedConfiguration> renders the wizard instead.
  resource.actions.editInstanceConfiguration;
  // @ts-expect-error RPC targets never escape the public resource.
  resource.stub;
  // @ts-expect-error Disposal is internal.
  resource[Symbol.dispose];
  if (resource.status === "success") {
    const permission: CreateInstancePermission =
      resource.data.permissions.createInstance;
    if (!permission.allowed) {
      const reason: CreateInstancePermissionReason = permission.reason;
      return reason;
    }
  }
  if (resource.status === "error") {
    const refreshing: boolean = resource.isRefreshing;
    return refreshing;
  }
  return resource;
};

void usePublicIntegration;

// @ts-expect-error usePrismatic is the one session hook.
export type RemovedSessionHook = typeof import("./index.js").useSession;
// @ts-expect-error usePrismaticClient returns the client itself.
export type RemovedClientHook = typeof import("./index.js").useClient;

const usePublicSession = () => {
  const session: PrismaticSessionResource = usePrismatic();
  const client: Client | null = usePrismaticClient();
  const user: AuthenticatedUserResource = useAuthenticatedUser();
  // @ts-expect-error Readiness is the resource status.
  session.isReady;
  user.actions.refresh.execute();
  session.actions.refresh.execute();
  if (session.status === "success") {
    const announced: boolean = session.data.hasFeature("connections");
    return announced && session.data.serverInfo.version && client;
  }
  if (user.status === "success") return user.data.email;
  return session;
};

void usePublicSession;

const usePublicMarketplace = () => {
  const marketplace: ListResource<
    MarketplaceIntegrationResource,
    MarketplaceIntegrationError
  > = useMarketplace({ search: "crm", pageSize: 10, onPageLoad: "replace" });
  // @ts-expect-error The filter is `search`, not the protocol's `searchTerm`.
  useMarketplace({ searchTerm: "crm" });
  // @ts-expect-error Paging is an action, not a method on the resource.
  marketplace.fetchNextPage;
  const paging: Promise<unknown> = marketplace.actions.loadNextPage.execute();
  marketplace.actions.loadPreviousPage.execute();
  marketplace.actions.refresh.execute();
  // @ts-expect-error Items exist only on success.
  marketplace.data.items;
  if (marketplace.status !== "success") return paging;
  const { hasNextPage, hasPreviousPage }: PageInfo = marketplace.data.pageInfo;
  const item: ListItem<MarketplaceIntegrationResource> | undefined =
    marketplace.data.items[0];
  if (!item) return { hasNextPage, hasPreviousPage };
  const key: string = item.id;
  item.actions.refresh.execute();
  item.actions.createInstance.execute({ name: "Orders" });
  // @ts-expect-error An item is a resource; its data exists only on success.
  item.data.name;
  return item.status === "success" ? item.data.name : key;
};

void usePublicMarketplace;

type PublicApi = typeof import("./index.js");

/**
 * Hooks that read nothing: the action observer and the client escape hatch. A server
 * function is an action its component owns.
 */
type NonReadHooks = "useAction" | "usePrismaticClient" | "useServerFunction";

type RootReadHooks = {
  [K in keyof PublicApi as K extends `use${string}`
    ? K extends NonReadHooks
      ? never
      : K
    : never]: PublicApi[K];
};

type HooksNotReturningAResource = {
  [K in keyof RootReadHooks]: RootReadHooks[K] extends (
    ...args: never[]
  ) => Resource<unknown, PrismaticError, object>
    ? never
    : K;
}[keyof RootReadHooks];

export const everyRootReadReturnsAResource: [
  HooksNotReturningAResource,
] extends [never]
  ? true
  : HooksNotReturningAResource = true;

// @ts-expect-error Reads return Resource; the older QueryResult convention is gone.
export type RemovedQueryResult = import("./index.js").QueryResult<unknown>;
// @ts-expect-error Writes are Actions; the older MutationResult convention is gone.
export type RemovedMutationResult = import("./index.js").MutationResult<
  unknown,
  unknown
>;
// @ts-expect-error Creating an instance is an action on the marketplace integration.
export type RemovedCreateInstanceHook = PublicApi["useCreateInstance"];
export type RemovedConnectionOptionsHook =
  // @ts-expect-error Connection choices are `data.connections` on the configuration.
  PublicApi["useConfigurationConnectionOptions"];

type ListHooks = "useConnections" | "useInstances" | "useMarketplace";

type HooksReturningAListResource = {
  [K in keyof RootReadHooks]: RootReadHooks[K] extends (
    ...args: never[]
  ) => ListResource<unknown, PrismaticError, object>
    ? K
    : never;
}[keyof RootReadHooks];

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export const exactlyTheListHooksReturnAListResource: Same<
  HooksReturningAListResource,
  ListHooks
> = true;

/** A hook that needs only an id takes the bare id; everything else takes one object. */
type SingleIdHooks =
  | "useConnection"
  | "useInstance"
  | "useMarketplaceIntegration"
  | "useUserConfiguration";
type NoArgumentHooks =
  | "useAuthenticatedUser"
  | "useMarketplaceFilterOptions"
  | "usePrismatic"
  | "usePrismaticClient";
type ObjectArgumentHooks = Exclude<
  keyof RootReadHooks,
  SingleIdHooks | NoArgumentHooks
>;

type SingleIdHooksWithOtherArguments = {
  [K in SingleIdHooks]: Same<
    Parameters<PublicApi[K]>,
    [string | null | undefined]
  > extends true
    ? never
    : K;
}[SingleIdHooks];
export const singleIdHooksTakeOnlyTheId: [
  SingleIdHooksWithOtherArguments,
] extends [never]
  ? true
  : SingleIdHooksWithOtherArguments = true;

type NoArgumentHooksTakingArguments = {
  [K in NoArgumentHooks]: Parameters<PublicApi[K]> extends [] ? never : K;
}[NoArgumentHooks];
export const noArgumentHooksTakeNothing: [
  NoArgumentHooksTakingArguments,
] extends [never]
  ? true
  : NoArgumentHooksTakingArguments = true;

type ObjectHooksWithOtherArguments = {
  [K in ObjectArgumentHooks]: Parameters<PublicApi[K]> extends
    | [object]
    | [object?]
    ? Parameters<PublicApi[K]>[0] extends string | null | undefined
      ? K
      : never
    : K;
}[ObjectArgumentHooks];
export const otherHooksTakeOneObject: [ObjectHooksWithOtherArguments] extends [
  never,
]
  ? true
  : ObjectHooksWithOtherArguments = true;

const useArgumentShapes = () => {
  useInstance("instance-1");
  useInstance(null);
  // @ts-expect-error A lone id is passed bare, not wrapped.
  useInstance({ instanceId: "instance-1" });
  useConfiguration({ instanceId: "instance-1", integrationVersionId: "v2" });
  // @ts-expect-error A hook with more than an id takes one object.
  useConfiguration("instance-1");
  useInstances({ integrationId: "integration-1", pageSize: 10 });
  // @ts-expect-error Lists take a filter object, never a positional id.
  useInstances("integration-1");
};

void useArgumentShapes;

// @ts-expect-error Invalidation happens inside actions.
export type RemovedInvalidate = PublicApi["useInvalidate"];
// @ts-expect-error Cache keys are internal.
export type RemovedKeys = PublicApi["keys"];
// @ts-expect-error Inputs are compared structurally inside each hook.
export type RemovedStableInput = PublicApi["useStableInput"];
// @ts-expect-error The idle window is the provider's `resourceIdleMs`.
export type RemovedIdleConstant = PublicApi["RESOURCE_IDLE_MS"];

const usePublicConnection = () => {
  const connection = useConnection(null);
  const configuration = useConfiguration({ instanceId: null });
  // Called straight from a click, with nothing to pass.
  void connection.actions.connect.execute();
  void connection.actions.connect.execute({ timeoutMs: 60_000 });
  void connection.actions.disconnect.execute();
  if (connection.status === "success") {
    const reason: ConnectionPermissionReason | null =
      connection.data.permissions.connect.reason;
    return reason;
  }
  if (
    configuration.status === "success" &&
    configuration.data.connections.status === "success"
  ) {
    const [requirement] = configuration.data.connections.data.init;
    if (requirement?.permissions.createConnection.allowed)
      void requirement.actions.createConnection.execute({ label: "Sales" });
    // @ts-expect-error A new connection's grant comes from the requirement, not the host.
    void requirement?.actions.createConnection.execute({ oauth2Type: "x" });
  }
  return connection;
};

void usePublicConnection;
