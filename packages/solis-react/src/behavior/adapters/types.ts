/**
 * What a behavior spec can do to the app and read back from it, in domain terms. An adapter
 * maps this onto one generation of the SDK's API; the specs never see that API.
 */

export type ResourceKind =
  | "listing"
  | "instance"
  | "configuration"
  | "personalConfiguration"
  | "connection"
  | "connectionOptions"
  | "personalConnectionOptions";

export type ListKind =
  | "marketplace"
  | "instances"
  | "connections"
  | "categories"
  | "labels";

export interface ResourceTarget {
  kind: ResourceKind;
  id: string | null;
  /** A configuration, or its connection choices, for this integration version rather than
   * the instance's current one. */
  version?: string;
}

export interface ListFilter {
  search?: string;
  category?: string;
  label?: string;
  integrationId?: string;
  /** Connections: who activates them. */
  kind?: string;
  /** Connections: their status. */
  status?: string;
  pageSize?: number;
  /** `"replace"` shows one page at a time; the default `"append"` accumulates pages. */
  onPageLoad?: "append" | "replace";
}

export interface ListTarget {
  list: ListKind;
  filter?: ListFilter;
}

/** One item of a list, acted on from the list rather than from its own screen. */
export interface ListItemTarget extends ListTarget {
  item: string;
}

/** An instance acted on from the listing that carries it, such as a marketplace card. */
export interface CarriedInstanceTarget {
  listing: string;
  instance: string;
}

export type Target =
  | ResourceTarget
  | ListTarget
  | ListItemTarget
  | CarriedInstanceTarget;

export interface Failure {
  code: string;
  message: string;
  fields?: readonly { path: string | null; message: string }[];
}

export type Outcome<T = unknown> =
  | { status: "success"; data: T }
  | { status: "error"; error: Failure };

export interface ListingFacts {
  id: string;
  name: string;
  category: string | null;
  labels: readonly string[];
  canActivate: boolean;
  activationBlockedBy: string | null;
  /** The instances it carries, on every version, newest first. */
  instances: readonly InstanceFacts[];
  /** Its instances could not be read, so it carries none. */
  instancesUnavailable: boolean;
  configurationExperience: "headless" | "hosted";
}

export interface InstanceFacts {
  id: string;
  name: string;
  integrationId: string;
  versionNumber: number;
  deployed: boolean;
  enabled: boolean;
  needsDeploy: boolean;
  lifecycle:
    | "notDeployed"
    | "active"
    | "paused"
    | "pendingChanges"
    | "needsReconfiguration"
    | "needsUserConfiguration";
  /** `apiKeys` is absent until the instance's own screen loads it; lists never do. */
  flows: { id: string; name: string; apiKeys?: readonly string[] }[];
  /** The saved configuration, read-only, and the version it was saved under. */
  configuration: { value: unknown; version: string | null };
  /** The signed-in user's own settings; `null` when the integration asks users for none. */
  personalConfiguration: { saved: boolean; value: unknown } | null;
  /** The newer version on offer, and whether moving to it needs the user's review. */
  update: { to: string; versionNumber: number; needsReview: boolean } | null;
  /** Why each action is unavailable to this user right now; `null` when it is available. */
  blockedBy: Record<
    "deploy" | "upgrade" | "pause" | "resume" | "remove" | "rename",
    string | null
  >;
}

/** One instance's configuration for one integration version. */
export interface ConfigurationFacts {
  instanceId: string;
  /** The version the configuration is for. */
  integrationId: string;
  integrationName: string;
  versionNumber: number;
  /** Saving moves the instance to this version. */
  isUpgrade: boolean;
  configurationExperience: "headless" | "hosted";
  deployedVersion: number | null;
  needsDeploy: boolean;
  serverFunctions: readonly string[];
}

export interface PersonalConfigurationFacts {
  integrationId: string;
  saved: boolean;
  value: unknown;
}

export interface ConnectionFacts {
  id: string;
  label: string;
  kind: string;
  status: string;
  /** Why connecting or disconnecting is unavailable right now; `null` when it is available. */
  blockedBy: Record<"connect" | "disconnect", string | null>;
}

/** A connection a caller needs, and the ids of the connections offered for it. */
export interface ConnectionRequirementFacts {
  key: string;
  options: readonly string[];
  /** Why the user can't make a new connection for it; `null` when they can. */
  createBlockedBy: string | null;
}

export interface ConnectionOptionsFacts {
  init: readonly ConnectionRequirementFacts[];
  serverFunctions: Record<string, readonly ConnectionRequirementFacts[]>;
}

export interface FactsByKind {
  listing: ListingFacts;
  instance: InstanceFacts;
  configuration: ConfigurationFacts;
  personalConfiguration: PersonalConfigurationFacts;
  connection: ConnectionFacts;
  connectionOptions: ConnectionOptionsFacts;
  personalConnectionOptions: ConnectionOptionsFacts;
}

export interface RowsByKind {
  marketplace: ListingFacts;
  instances: InstanceFacts;
  connections: ConnectionFacts;
  categories: string;
  labels: string;
}

export type ResourceView<T> =
  | { status: "loading" }
  | { status: "ready"; data: T; refreshing: boolean }
  | { status: "error"; error: Failure; refreshing: boolean };

export interface ListView<T> {
  status: "loading" | "ready" | "error";
  rows: readonly T[];
  error?: Failure;
  hasMore: boolean;
  hasPrevious: boolean;
  refreshing: boolean;
}

/**
 * Action names by target:
 * - listing, and a marketplace item: `activate({ name })`
 * - instance, also carried by a listing: `deploy`, `upgrade`, `pause`, `resume`, `remove`,
 *   `rename({ name })`, `setFlowApiKeys({ flowId, apiKeys })`
 * - configuration: `init({ connections? })`, `save({ value })`,
 *   `serverFunction({ key, inputs, connections?, caller?, copied? })`
 * - personalConfiguration: `save({ value })`, `remove`,
 *   `serverFunction({ key, inputs, caller?, copied? })`
 * - connection, and a connections item: `connect({ timeoutMs? })`, `disconnect`; on the
 *   connection's own screen, `cancelConnect` cancels a connect still waiting there
 * - connectionOptions: `createConnection({ requirement, label? })`, for the requirement of
 *   init or of any server function with that key
 *
 * A server function runs from a caller: one screen holding one of it. The same `caller`
 * reuses that screen; without one, every run comes from a screen of its own. With `copied`,
 * the host hands that screen a copy of the configuration it read rather than the original.
 * - lists: `nextPage`, `previousPage`
 * - every target, list items included: `refresh`
 */
export interface Adapter {
  /** Starts reading a resource if nothing reads it yet, and returns it once it settles. */
  readResource: <K extends ResourceKind>(
    kind: K,
    id: string | null,
    scope?: { version?: string },
  ) => Promise<ResourceView<FactsByKind[K]>>;
  readList: <K extends ListKind>(
    kind: K,
    filter?: ListFilter,
  ) => Promise<ListView<RowsByKind[K]>>;
  /** One item as the list holds it, once the list has settled. */
  readListItem: <K extends ListKind>(
    kind: K,
    filter: ListFilter | undefined,
    id: string,
  ) => Promise<ResourceView<RowsByKind[K]> | undefined>;
  execute: (
    target: Target,
    action: string,
    input?: Record<string, unknown>,
  ) => Promise<Outcome>;
  refresh: (target: Target) => Promise<Outcome>;
  /** Leaves every screen: nothing reads anything, while the session stays up. */
  unmount: () => Promise<void>;
  /** The same user with a fresh token, or a different user. */
  signInAs: (token: string) => Promise<void>;
  /** Re-renders the host with nothing changed. */
  rerender: () => Promise<void>;
  /** Actions still running, named `<target> <action>`. */
  busyActions: () => string[];
  /** Transport counts, for the harness's hygiene check. */
  transport: () => { imports: number; exports: number };
  close: () => void;
}
