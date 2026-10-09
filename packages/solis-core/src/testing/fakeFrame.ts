/**
 * In-process stand-in for the Prismatic frame, served over a real capnweb session.
 *
 * Mirrors frontend/src/headless: streams emit only after a read or mutation through the
 * session (stateStream.ts), listing rollups and permissions are derived per role
 * (MarketplaceIntegrationImpl.ts, HeadlessConfigurationApi.ts), and emissions are JSON
 * deduped. Known gaps that remain:
 * - Instance and configuration streams share one publish channel, so a re-read of either
 *   publishes both; the real frame keeps a multiplexer per surface.
 * - Stores are shared by every session, except the flow API keys each session's detail
 *   reads loaded. Revocation resets what sessions have seen rather than each session keeping
 *   its own cache.
 * - Marketplace `filterQuery` is ignored, and orderings on CREATED_AT,
 *   PUBLISHED_AT and UPDATED_AT keep insertion order.
 * - Flow permissions are seeded, not derived. Instance permissions
 *   derive from the role and state, with the seeded `updateDetails`, `deploy` and `remove`
 *   standing in for the API's per-user `allowUpdate`, `allowDeploy` and `allowRemove`.
 */

import {
  type AuthenticatedUser,
  type ConfigurationConnectionOptions,
  type ConfigurationConnectionRequirement,
  type ConfigurationExperience,
  type ConfigurationFunctionTarget,
  type ConfigurationOperationError,
  type ConfigurationScopeInput,
  type ConfigurationServerFunction,
  type ConfigurationState,
  type ConfigurationTarget,
  type Connection,
  type ConnectionAuthorization,
  type ConnectionOperationError,
  type ConnectionState,
  type ConnectionStatus,
  type ConnectionsApi,
  type ConnectionTemplate,
  type ConnectionTemplateRef,
  type CreateConnectionInput,
  type CreateInstanceInput,
  type FeatureName,
  type HostApi,
  type InitializeConfigurationInput,
  type Instance,
  type InstanceListPage,
  type InstanceState,
  type InstancesApi,
  type InvokeConfigurationFunctionInput,
  type JsonSchema,
  type ListConnectionsFilter,
  type ListInstancesInput,
  type ListIntegrationsInput,
  type MarketplaceApi,
  type MarketplaceFilterOptions,
  type MarketplaceIntegrationState,
  type MarketplaceIntegrationTarget,
  type MarketplaceListPage,
  type MarketplaceOrdering,
  PORT_EVENT,
  PROTOCOL_VERSION,
  type PrismaticApi,
  type ProtocolVersion,
  READY_EVENT,
  type Result,
  redactError,
  type SaveConfigurationInput,
  type SaveUserConfigurationInput,
  SESSION_REVOKED_CODE,
  type ServerInfo,
  type UserConfigurationState,
  type UserConfigurationTarget,
} from "../protocol/index.js";
import { newMessagePortRpcSession, type RpcStub, RpcTarget } from "capnweb";
import {
  fakeConnectionPermissions,
  fakeInstancePermissions,
  fakeLifecycle,
  fakeUpdate,
} from "./fakeRules.js";

const FAKE_FEATURES: FeatureName[] = [
  "authenticatedUser",
  "connections",
  "connections.listFilter",
  "connections.connect",
  "marketplace",
  "marketplace.filterOptions",
  "instances",
  "configuration",
  "userConfiguration",
  "userConfiguration.remove",
  "instances.updateDetails",
  "instances.upgrade",
  "host.openExternalUrl",
];

const serverInfo = (
  protocol: ProtocolVersion = PROTOCOL_VERSION,
): ServerInfo => ({
  version: "0.0.0-fake",
  protocol,
  features: FAKE_FEATURES,
});

interface Subscriber<T> {
  controller: ReadableStreamDefaultController<unknown>;
  project: (item: T) => unknown;
  last?: { json: string; value: unknown };
}

/**
 * In-memory collection behind the fake's data surface: the backend's rows plus the value
 * sessions last read for each. A `state()` stream emits that value on subscribe and again
 * on {@link FakeCollection.publish}, which the fake calls wherever the real frame reads or
 * mutates through the session. A write made with {@link FakeCollection.set} is out of
 * band: nothing emits it until the next such read.
 */
export class FakeCollection<T extends { id: string }> {
  #items = new Map<string, T>();
  #published = new Map<string, T>();
  #subscribers = new Map<string, Set<Subscriber<T>>>();

  constructor(seed: T[] = []) {
    for (const item of seed) this.#items.set(item.id, item);
  }

  list(): T[] {
    return [...this.#items.values()];
  }

  get(id: string): T | undefined {
    return this.#items.get(id);
  }

  /** Adds or replaces an item out of band — another tab, the Prismatic UI. Open streams
   * see it only after the session next reads it. */
  set(item: T): void {
    this.#items.set(item.id, item);
  }

  /** Writes and publishes: what a mutation through the session does. A spec models an
   * outside change with `set()` and a read through the session instead. */
  commit(item: T): void {
    this.set(item);
    this.publish(item.id);
  }

  /** Emits the stored value to every open stream for it, skipping JSON-equal repeats. */
  publish(id: string): void {
    const current = this.#items.get(id);
    if (current === undefined) return;
    this.#published.set(id, current);
    for (const subscriber of this.#subscribers.get(id) ?? [])
      this.#emit(subscriber, current);
  }

  /** Deletes an item and closes every open stream for it — what `cancel()` and `delete()` do. */
  remove(id: string): void {
    this.#items.delete(id);
    this.#published.delete(id);
    for (const { controller } of this.#subscribers.get(id) ?? [])
      controller.close();
    this.#subscribers.delete(id);
  }

  /** Open `state()` streams for an item — asserts that cancel released them. */
  subscriberCount(id: string): number {
    return this.#subscribers.get(id)?.size ?? 0;
  }

  failStreams(id: string, error: Error): void {
    for (const { controller } of this.#subscribers.get(id) ?? [])
      controller.error(error);
    this.#subscribers.delete(id);
  }

  /** Open `state()` streams across every item. Stale until {@link FakeCollection.flush}. */
  openStreams(): number {
    let total = 0;
    for (const set of this.#subscribers.values()) total += set.size;
    return total;
  }

  /**
   * Re-emits each stream's last value, which is what makes a client's queued cancel land:
   * capnweb pumps `state()` into a pipe whose writable only observes the cancelled far end
   * on its next write, so an unflushed count still holds streams no observer wants.
   * Re-emitting the same object rather than a copy keeps observers quiet — `observeState`
   * drops an `Object.is`-equal repeat — and bypasses the JSON dedupe on purpose.
   */
  flush(): void {
    for (const set of this.#subscribers.values()) {
      for (const { controller, last } of set) {
        if (!last) continue;
        try {
          controller.enqueue(last.value);
        } catch {
          // Already closed or errored; the cancel handler drops it.
        }
      }
    }
  }

  /** Emits the value sessions last saw (a first subscribe reads the row), each emission
   * passed through `project`. */
  stream<U = T>(id: string, project?: (item: T) => U): ReadableStream<U> {
    const current = this.#published.get(id) ?? this.#items.get(id);
    if (!current) throw new Error(`not found: ${id}`);
    this.#published.set(id, current);

    let subscriber: Subscriber<T>;
    return new ReadableStream<U>({
      start: (controller) => {
        subscriber = {
          controller: controller as ReadableStreamDefaultController<unknown>,
          project: project ?? ((item) => item),
        };
        const set = this.#subscribers.get(id) ?? new Set();
        this.#subscribers.set(id, set);
        set.add(subscriber);
        this.#emit(subscriber, current);
      },
      cancel: () => {
        this.#subscribers.get(id)?.delete(subscriber);
      },
    });
  }

  /** Closes every open stream and forgets what sessions saw — what revocation does. */
  closeAll(): void {
    for (const set of this.#subscribers.values()) {
      for (const { controller } of set) controller.close();
    }
    this.#subscribers.clear();
    this.#published.clear();
  }

  #emit(subscriber: Subscriber<T>, item: T): void {
    const value = subscriber.project(item);
    const json = JSON.stringify(value);
    if (subscriber.last?.json === json) return;
    subscriber.last = { json, value };
    try {
      subscriber.controller.enqueue(value);
    } catch {
      // The host cancelled between publish and enqueue.
    }
  }
}

/**
 * An integration's authored configuration as the fake knows it. `init` is the author's
 * function and runs in the frame, so it never crosses the wire; `schema`, `uiSchema` and
 * `configurationVersion` are the data {@link ConfigurationState} carries.
 */
/** The newer version the marketplace offers an instance of this one. */
export interface FakeUpgradeTarget {
  integrationId: string;
  versionNumber: number;
  configurationVersion: string | null;
}

/** A connection a caller needs, by the ids of the connections offered for it. Ids the
 * connection store doesn't hold are not offered, as the frame offers only connections a
 * customer may use. */
export interface FakeConnectionRequirement {
  key: string;
  label?: string;
  options: readonly string[];
  /** The customer-activated connection new credentials for it are made from. Every
   * credential made from it is offered too, as the frame offers the customer's own. */
  template?: ConnectionTemplateRef;
}

/** How a customer-activated connection a credential is made from behaves. */
export interface FakeConnectionTemplate {
  label?: string;
  oauth2Type: string | null;
  /**
   * Whether a client-credentials credential connects as it's made. Defaults to `ACTIVE`;
   * anything else fails the save, as the platform's failed auto-connect does, and keeps the
   * credential pending.
   */
  connectsAs?: ConnectionStatus;
}

export interface FakeConnectionRequirements {
  init?: readonly FakeConnectionRequirement[];
  serverFunctions?: Readonly<
    Record<string, readonly FakeConnectionRequirement[]>
  >;
}

export interface FakeConfigurationSeed {
  schema: JsonSchema;
  flows?: ConfigurationState["flows"];
  uiSchema?: JsonSchema;
  configurationVersion?: string;
  /** The integration's name; defaults to the listing's, or the version id. */
  name?: string;
  /** Defaults to the listing's, or headless. */
  configurationExperience?: ConfigurationExperience;
  init?: (
    context: { value: unknown } & InitializeConfigurationInput,
  ) => unknown | Promise<unknown>;
  initError?: ConfigurationOperationError;
  saveError?: ConfigurationOperationError;
  versionNumber?: number;
  upgradeTarget?: FakeUpgradeTarget | null;
  permissions?: Partial<ConfigurationState["permissions"]>;
  connectionOptions?: () =>
    | FakeConnectionRequirements
    | Promise<FakeConnectionRequirements>;
  serverFunctions?: (ConfigurationServerFunction & {
    error?: ConfigurationOperationError;
    execute: (
      input: InvokeConfigurationFunctionInput,
    ) => unknown | Promise<unknown>;
  })[];
  beforeRead?: () => void;
  stateStream?: (
    state: ConfigurationState,
  ) => ReadableStream<ConfigurationState>;
  beforeRefresh?: () => void | Promise<void>;
  beforeSave?: (input: SaveConfigurationInput) => void | Promise<void>;
  beforeDeploy?: () => void | Promise<void>;
  beforeFunction?: (key: string) => void | Promise<void>;
  /** Rejects a save and returns these field errors instead of persisting. */
  invalidate?: (
    value: unknown,
  ) => { path: string | null; message: string }[] | undefined;
}

/** The API's per-user flags, as a seed states them: a denied `updateDetails` is
 * `allowUpdate: false`, a denied `deploy` is `allowDeploy: false` and a denied `remove` is
 * `allowRemove: false`. Absent means allowed. */
type SeededInstancePermissions = Partial<InstanceState["permissions"]>;

/** What an instance's state reads from its configuration and the caller's personal record
 * rather than storing itself. */
type InstanceFacts = Pick<
  InstanceState,
  "configuration" | "userConfiguration" | "update"
>;

type DerivedInstanceFields = "lifecycle" | "permissions" | keyof InstanceFacts;

/** One instance as the fake stores it: the wire-visible {@link InstanceState} plus the
 * persisted configuration value. Both `state()` streams are projections of it.
 * `customerUpgradeable` stands in for the API's `isCustomerUpgradeable`; absent means true. */
export type InstanceRecord = Omit<InstanceState, DerivedInstanceFields> & {
  permissions?: SeededInstancePermissions;
  value: unknown;
  deployedVersion?: number | null;
  deployedConfigurationVersion?: string | null;
  customerUpgradeable?: boolean;
};

/** An initial instance; `value` seeds a saved configuration. */
export type FakeInstanceSeed = Omit<InstanceState, DerivedInstanceFields> & {
  permissions?: SeededInstancePermissions;
  value?: unknown;
  deployedConfigurationVersion?: string | null;
  customerUpgradeable?: boolean;
};

export interface FakeUserConfigurationSeed {
  schema: JsonSchema | null;
  uiSchema?: JsonSchema | null;
  configurationVersion?: string | null;
  permissions?: Partial<UserConfigurationState["permissions"]>;
  serverFunctions?: FakeConfigurationSeed["serverFunctions"];
  connectionOptions?: FakeConfigurationSeed["connectionOptions"];
  beforeRead?: () => void;
  stateStream?: (
    state: UserConfigurationState,
  ) => ReadableStream<UserConfigurationState>;
  beforeRefresh?: () => void | Promise<void>;
  beforeSave?: (input: SaveUserConfigurationInput) => void | Promise<void>;
  beforeCreate?: (input: SaveUserConfigurationInput) => void | Promise<void>;
  beforeUpdate?: (input: SaveUserConfigurationInput) => void | Promise<void>;
  beforeActivate?: () => void | Promise<void>;
  beforeFunction?: (key: string) => void | Promise<void>;
  saveError?: ConfigurationOperationError;
  invalidate?: FakeConfigurationSeed["invalidate"];
  /** Models authoritative backend normalization, rather than echoing the submitted value. */
  normalize?: (value: unknown) => unknown;
}

/** An observation slot, not proof of persisted data: null IDs represent absence. */
export interface UserConfigurationRecord {
  id: string;
  principal: string;
  instanceId: string;
  userLevelConfigId: string | null;
  configurationId: string | null;
  value: unknown;
  active: boolean;
}

export const fakeUserConfigurationRecord = ({
  principal,
  instanceId,
  ...overrides
}: Pick<UserConfigurationRecord, "principal" | "instanceId"> &
  Partial<UserConfigurationRecord>): UserConfigurationRecord => ({
  id: JSON.stringify([principal, instanceId]),
  principal,
  instanceId,
  userLevelConfigId: null,
  configurationId: null,
  value: null,
  active: false,
  ...overrides,
});

export interface FakeStores {
  connections: FakeCollection<ConnectionState>;
  integrations: FakeCollection<MarketplaceIntegrationState>;
  instances: FakeCollection<InstanceRecord>;
  configurations: Record<string, FakeConfigurationSeed>;
  userConfigurations?: Record<string, FakeUserConfigurationSeed>;
  userConfigurationRecords?: FakeCollection<UserConfigurationRecord>;
  templates: ConnectionTemplate[];
  /** Customer-activated connections a credential can be made from, by id. */
  connectionTemplates?: Record<string, FakeConnectionTemplate>;
  /** The consent URL `authorize()` answers for a connection. */
  authorizeUrl?: (id: string) => string;
  /** How often an authorization in flight is re-read. */
  connectionPollMs?: number;
  /** The principal each personal connection belongs to, by id. Only its owner is served it. */
  connectionOwners?: Record<string, string>;
  nextId: (prefix: string) => string;
  roleOf?: (principal: string) => FakeEmbeddedRole;
  /** Runs where the real frame walks the customer's instances for a marketplace page;
   * throwing fails that walk. */
  beforeInstanceWalk?: () => void;
  /** Listings whose last page read could not read their instances. */
  unreadInstances?: Set<string>;
  /** Instances deleted through the frame, which then read as removed rather than unknown. */
  removedInstances?: Set<string>;
}

/** Each flow's API keys as one session's last detail read of an instance loaded them, by
 * instance id. List reads select no keys and keep these; other sessions don't see them. */
type LoadedFlowApiKeys = Map<string, ReadonlyMap<string, readonly string[]>>;

/** The embedded role the real frame reads from the session's JWT. */
export interface FakeEmbeddedRole {
  isCustomerMarketplaceUser: boolean;
  isCustomerMarketplaceAdmin: boolean;
}

const CUSTOMER_ADMIN: FakeEmbeddedRole = {
  isCustomerMarketplaceUser: false,
  isCustomerMarketplaceAdmin: true,
};

const roleOf = (stores: FakeStores, principal: string) =>
  stores.roleOf?.(principal) ?? CUSTOMER_ADMIN;

/** Mirrors the frame's role check: a marketplace user, or an admin on an integration the
 * customer may not deploy, can't write. */
const roleWritable = (role: FakeEmbeddedRole, customerDeployable: boolean) =>
  !role.isCustomerMarketplaceUser &&
  !(role.isCustomerMarketplaceAdmin && !customerDeployable);

/** What the real frame serves for an integration whose author declared no configuration. */
const NO_CONFIGURATION: FakeConfigurationSeed = { schema: {} };

const configurationSeed = (stores: FakeStores, integrationId: string) =>
  stores.configurations[integrationId] ?? NO_CONFIGURATION;

/**
 * The version sequence an integration version belongs to: every version joined to it by an
 * upgrade target, named by the first of them in id order.
 */
const sequenceOf = (stores: FakeStores, integrationId: string): string => {
  const edges = Object.entries(stores.configurations).flatMap(([from, seed]) =>
    seed.upgradeTarget ? [[from, seed.upgradeTarget.integrationId]] : [],
  );
  const family = new Set([integrationId]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const [from, to] of edges) {
      if (family.has(from) === family.has(to)) continue;
      family.add(from);
      family.add(to);
      grew = true;
    }
  }
  return [...family].sort()[0] ?? integrationId;
};

/** The caller's instances of every version of a listing, newest first, as the real frame
 * groups them. */
const instancesOfListing = (stores: FakeStores, listingId: string) => {
  const sequence = sequenceOf(stores, listingId);
  return stores.instances
    .list()
    .filter((r) => sequenceOf(stores, r.integrationId) === sequence)
    .reverse();
};

/** Mirrors `integrationPermissions` in MarketplaceIntegrationImpl.ts. */
const integrationPermissions = (
  listing: MarketplaceIntegrationState,
  role: FakeEmbeddedRole,
): MarketplaceIntegrationState["permissions"] => {
  const unread = listing.instancesError !== null;
  const instanceCount = unread ? null : listing.instances.length;
  const reason = role.isCustomerMarketplaceUser
    ? "MARKETPLACE_USER"
    : !listing.allowMultipleInstances && instanceCount !== 0
      ? unread
        ? "INSTANCES_UNAVAILABLE"
        : "INSTANCE_EXISTS"
      : role.isCustomerMarketplaceAdmin && !listing.isCustomerDeployable
        ? "NOT_CUSTOMER_DEPLOYABLE"
        : role.isCustomerMarketplaceAdmin &&
            !instanceCount &&
            listing.marketplaceConfiguration !== "AVAILABLE_AND_DEPLOYABLE"
          ? unread
            ? "INSTANCES_UNAVAILABLE"
            : "NOT_DEPLOYABLE"
          : null;
  return {
    createInstance:
      reason === null
        ? { allowed: true, reason: null }
        : { allowed: false, reason },
  };
};

/** Mirrors the real frame's listing when its page could not read the instances. */
const INSTANCES_UNAVAILABLE = {
  code: "PRISMATIC_INSTANCES_UNAVAILABLE",
  message: "The customer's instances could not be read.",
} as const;

/** The listing as the frame resolves it: the caller's instances of every version (never-deployed
 * ones count), then permissions from those and the role. */
// The API filters category and label with _Icontains.
const containsIgnoringCase = (value: string | null, search: string) =>
  value?.toLowerCase().includes(search.toLowerCase()) ?? false;

const resolveListing = (
  stores: FakeStores,
  listing: MarketplaceIntegrationState,
  role: FakeEmbeddedRole,
): MarketplaceIntegrationState => {
  const unread = stores.unreadInstances?.has(listing.id) ?? false;
  const withInstances: MarketplaceIntegrationState = {
    ...listing,
    instances: unread
      ? []
      : instancesOfListing(stores, listing.id).map(({ id }) => ({ id })),
    instancesError: unread ? INSTANCES_UNAVAILABLE : null,
  };
  return {
    ...withInstances,
    permissions: integrationPermissions(withInstances, role),
  };
};

/** An instance mutation through the session moved the listings carrying its version's
 * instances; publishing them is the targeted re-read the real frame makes. */
const integrationChanged = (stores: FakeStores, integrationId: string) => {
  const sequence = sequenceOf(stores, integrationId);
  for (const listing of stores.integrations.list())
    if (sequenceOf(stores, listing.id) === sequence) {
      stores.unreadInstances?.delete(listing.id);
      stores.integrations.publish(listing.id);
    }
};

const instanceGone = (id: string) =>
  Object.assign(new Error(`Instance was deleted: ${id}`), {
    code: "PRISMATIC_INSTANCE_REMOVED" as const,
  });

/** Mirrors `failed` in configurationShared.ts: a result is plain data, so only the code
 * and message cross the wire. */
const failed = (
  caught: unknown,
): Result<never, ConfigurationOperationError> => {
  const code =
    caught instanceof Error && "code" in caught
      ? (caught.code as ConfigurationOperationError["code"])
      : "PRISMATIC_UNKNOWN";
  const message = caught instanceof Error ? caught.message : String(caught);
  return { status: "error", error: configurationError(code, message) };
};

const settle = async <T>(
  run: () => Promise<Result<T, ConfigurationOperationError>>,
): Promise<Result<T, ConfigurationOperationError>> => {
  try {
    return await run();
  } catch (error) {
    return failed(error);
  }
};

const idSequence = () => {
  let n = 0;
  return (prefix: string) => `${prefix}-${++n}`;
};

const emptyStores = (): FakeStores => ({
  connections: new FakeCollection(),
  integrations: new FakeCollection(),
  instances: new FakeCollection(),
  configurations: {},
  templates: [],
  nextId: idSequence(),
});

/** Mirrors `toInstanceState` in HeadlessConfigurationApi.ts. */
const toInstanceState = (
  {
    value,
    deployedVersion: _dv,
    deployedConfigurationVersion: _de,
    customerUpgradeable,
    flows,
    permissions,
    // Derived below from `facts`; a stored record's copies are stale.
    configuration: _configuration,
    userConfiguration: _userConfiguration,
    update: _update,
    ...state
  }: InstanceRecord & Partial<InstanceFacts> & { lifecycle?: unknown },
  {
    role = CUSTOMER_ADMIN,
    customerDeployable = true,
    facts = {
      configuration: { value: value ?? null, configurationVersion: null },
      userConfiguration: null,
      update: null,
    },
  }: {
    role?: FakeEmbeddedRole;
    customerDeployable?: boolean;
    facts?: InstanceFacts;
  } = {},
): InstanceState => ({
  ...state,
  ...facts,
  lifecycle: fakeLifecycle(state),
  flows: flows ?? [],
  permissions: fakeInstancePermissions({
    allowUpdate: permissions?.updateDetails?.allowed !== false,
    allowDeploy: permissions?.deploy?.allowed !== false,
    allowRemove: permissions?.remove?.allowed !== false,
    roleWritable: roleWritable(role, customerDeployable),
    customerUpgradeable: customerUpgradeable !== false,
    update: facts.update,
    deployed: state.deployed,
    enabled: state.enabled,
  }),
});

/** Mirrors the frame: the saved value under the current definition's version, the caller's
 * own personal record, and the marketplace's newer version. */
const instanceFacts = (
  stores: FakeStores,
  record: InstanceRecord,
  principal: string,
): InstanceFacts => {
  const seed = configurationSeed(stores, record.integrationId);
  const configurationVersion = seed.configurationVersion ?? null;
  const target = seed.upgradeTarget ?? null;
  const personal = stores.userConfigurations?.[record.integrationId];
  const personalRecord = stores.userConfigurationRecords?.get(
    fakeUserConfigurationRecord({ principal, instanceId: record.id }).id,
  );
  return {
    configuration: { value: record.value ?? null, configurationVersion },
    userConfiguration: personal
      ? {
          value: personalRecord?.configurationId ? personalRecord.value : null,
          configurationVersion: personal.configurationVersion ?? null,
          configured: Boolean(personalRecord?.userLevelConfigId),
        }
      : null,
    update: fakeUpdate({
      currentVersionId: record.integrationId,
      currentConfigurationVersion: configurationVersion,
      target: target && {
        integrationVersionId: target.integrationId,
        versionNumber: target.versionNumber,
        configurationVersion: target.configurationVersion,
      },
    }),
  };
};

const toRecord = (seed: FakeInstanceSeed): InstanceRecord => ({
  ...seed,
  value: seed.value,
});

/** A complete {@link ConnectionState} with every field defaulted; override what a test cares about. */
export const fakeConnectionState = (
  overrides: Partial<ConnectionState> & { id: string },
): ConnectionState => {
  const state = connectionDefaults(overrides);
  return {
    ...state,
    permissions:
      overrides.permissions ??
      fakeConnectionPermissions({
        oauth2Type: state.connection.oauth2Type,
        status: state.status,
        writable: true,
      }),
  };
};

/** The same connection with a new status, its permissions derived again. */
export const withConnectionStatus = (
  { permissions: _permissions, ...state }: ConnectionState,
  status: ConnectionStatus,
): ConnectionState => fakeConnectionState({ ...state, status });

const connectionDefaults = (
  overrides: Partial<ConnectionState> & { id: string },
): Omit<ConnectionState, "permissions"> => ({
  kind: "customerActivated",
  label: overrides.id,
  definition: { id: `definition-${overrides.id}`, stableKey: overrides.id },
  description: null,
  status: "PENDING",
  managedBy: "customer",
  variableScope: "customer",
  component: { key: "slack", label: "Slack", iconUrl: null },
  connection: {
    key: "oauth2",
    label: "OAuth 2.0",
    oauth2Type: "authorization_code",
    iconUrl: null,
  },
  inputs: [],
  oAuthRedirectConfig: null,
  ...overrides,
});

/** A complete {@link MarketplaceIntegrationState} with every field defaulted. */
export const fakeIntegrationState = (
  overrides: Partial<MarketplaceIntegrationState> & { id: string },
): MarketplaceIntegrationState => ({
  permissions: {
    createInstance: { allowed: true, reason: null },
  },
  name: overrides.id,
  category: null,
  description: null,
  avatarUrl: null,
  versionNumber: 1,
  availability: "AVAILABLE_AND_DEPLOYABLE",
  marketplaceConfiguration: "AVAILABLE_AND_DEPLOYABLE",
  marketplaceAvailableVersion: null,
  configurationExperience: "headless",
  flows: [],
  allowMultipleInstances: false,
  isCustomerDeployable: true,
  userLevelConfigured: false,
  instances: [],
  instancesError: null,
  overview: null,
  labels: [],
  customer: null,
  ...overrides,
});

/** A complete {@link InstanceState} with every field defaulted: a never-deployed instance.
 * `enabled` follows `deployed`, as the backend enables an instance on its first deploy.
 * `lifecycle` is always derived from the other fields. */
export const fakeInstanceState = (
  overrides: Partial<Omit<InstanceState, "permissions">> & {
    id: string;
    integrationId: string;
    permissions?: SeededInstancePermissions;
  },
): InstanceState => {
  const { configuration, userConfiguration, update, ...rest } = overrides;
  return toInstanceState(
    {
      name: overrides.id,
      description: null,
      integrationVersionNumber: 1,
      enabled: overrides.deployed ?? false,
      deployed: false,
      needsDeploy: false,
      configState: "NEEDS_INSTANCE_CONFIGURATION",
      lastDeployedAt: null,
      lastExecutedAt: null,
      flows: [],
      ...rest,
      value: undefined,
    },
    {
      facts: {
        configuration: configuration ?? {
          value: null,
          configurationVersion: null,
        },
        userConfiguration: userConfiguration ?? null,
        update: update ?? null,
      },
    },
  );
};

type AssertLive = () => void;

const connectionError = (
  code: ConnectionOperationError["code"],
  message: string,
): ConnectionOperationError => ({ name: "Error", code, message });

const FAKE_POLL_MS = 2_000;
const POLL_WINDOW_MS = 15 * 60_000;
const SETTLED = new Set<string>(["ACTIVE", "FAILED", "ERROR"]);

/**
 * Mirrors the frame's watch on authorizations in flight: re-reads each one on a timer and
 * publishes what it finds, until its status settles, nothing streams it, or the window
 * closes.
 */
class ConnectionWatch {
  #store: FakeCollection<ConnectionState>;
  #pollMs: number;
  #watched = new Map<string, { from: string; until: number }>();
  #timer: ReturnType<typeof setInterval> | undefined;

  constructor(store: FakeCollection<ConnectionState>, pollMs = FAKE_POLL_MS) {
    this.#store = store;
    this.#pollMs = pollMs;
  }

  watch(id: string) {
    const current = this.#store.get(id);
    if (!current) return;
    this.#watched.set(id, {
      from: current.status,
      until: Date.now() + POLL_WINDOW_MS,
    });
    this.#timer ??= setInterval(() => this.#poll(), this.#pollMs);
  }

  stop() {
    this.#watched.clear();
    clearInterval(this.#timer);
    this.#timer = undefined;
  }

  #poll() {
    for (const [id, { from, until }] of this.#watched) {
      const current = this.#store.get(id);
      if (current) this.#store.publish(id);
      if (
        !current ||
        this.#store.subscriberCount(id) === 0 ||
        Date.now() > until ||
        (SETTLED.has(current.status) && current.status !== from)
      )
        this.#watched.delete(id);
    }
    if (!this.#watched.size) this.stop();
  }
}

const watches = new WeakMap<FakeStores, ConnectionWatch>();

/** One watch per backend, as the frame keeps one per session. */
const watchOf = (stores: FakeStores) => {
  let watch = watches.get(stores);
  if (!watch) {
    watch = new ConnectionWatch(stores.connections, stores.connectionPollMs);
    watches.set(stores, watch);
  }
  return watch;
};

/** Mirrors the frame: a personal connection is served only to its owner. */
const servedConnection = (
  stores: FakeStores,
  principal: string,
  id: string,
): ConnectionState | undefined => {
  const owner = stores.connectionOwners?.[id];
  return owner === undefined || owner === principal
    ? stores.connections.get(id)
    : undefined;
};

class FakeConnection extends RpcTarget implements Connection {
  #id: string;
  #stores: FakeStores;
  #principal: string;
  #watch: ConnectionWatch;
  #assertLive: AssertLive;

  constructor(
    id: string,
    stores: FakeStores,
    principal: string,
    watch: ConnectionWatch,
    assertLive: AssertLive,
  ) {
    super();
    this.#id = id;
    this.#stores = stores;
    this.#principal = principal;
    this.#watch = watch;
    this.#assertLive = assertLive;
  }

  state(): ReadableStream<ConnectionState> {
    this.#assertLive();
    return this.#stores.connections.stream(this.#id);
  }

  async authorize(): Promise<
    Result<ConnectionAuthorization, ConnectionOperationError>
  > {
    this.#assertLive();
    const current = servedConnection(this.#stores, this.#principal, this.#id);
    if (!current)
      return {
        status: "error",
        error: connectionError(
          "PRISMATIC_CONNECTION_NOT_FOUND",
          `connection not found: ${this.#id}`,
        ),
      };
    if (!current.permissions.connect.allowed)
      return {
        status: "error",
        error: connectionError(
          "PRISMATIC_CONNECTION_FORBIDDEN",
          `The connection can't be connected: ${current.permissions.connect.reason}`,
        ),
      };
    this.#watch.watch(this.#id);
    return {
      status: "success",
      data: {
        url:
          this.#stores.authorizeUrl?.(this.#id) ??
          `https://provider.example.test/authorize?state=${encodeURIComponent(this.#id)}`,
      },
    };
  }

  async disconnect(): Promise<
    Result<ConnectionState, ConnectionOperationError>
  > {
    this.#assertLive();
    const current = servedConnection(this.#stores, this.#principal, this.#id);
    if (!current)
      return {
        status: "error",
        error: connectionError(
          "PRISMATIC_CONNECTION_NOT_FOUND",
          `connection not found: ${this.#id}`,
        ),
      };
    if (!current.permissions.disconnect.allowed)
      return {
        status: "error",
        error: connectionError(
          "PRISMATIC_CONNECTION_FORBIDDEN",
          `The connection can't be disconnected: ${current.permissions.disconnect.reason}`,
        ),
      };
    const disconnected = withConnectionStatus(current, "PENDING");
    this.#stores.connections.commit(disconnected);
    return { status: "success", data: disconnected };
  }
}

class FakeTemplatesApi extends RpcTarget {
  #templates: ConnectionTemplate[];
  #assertLive: AssertLive;

  constructor(templates: ConnectionTemplate[], assertLive: AssertLive) {
    super();
    this.#templates = templates;
    this.#assertLive = assertLive;
  }

  async list(filter?: {
    componentKey?: string;
  }): Promise<ConnectionTemplate[]> {
    this.#assertLive();
    const key = filter?.componentKey;
    return key
      ? this.#templates.filter((t) => t.connection.component.key === key)
      : this.#templates;
  }
}

class FakeConnectionsApi extends RpcTarget implements ConnectionsApi {
  #stores: FakeStores;
  #principal: string;
  #templates: FakeTemplatesApi;
  #watch: ConnectionWatch;
  #assertLive: AssertLive;

  constructor(stores: FakeStores, principal: string, assertLive: AssertLive) {
    super();
    this.#stores = stores;
    this.#principal = principal;
    this.#templates = new FakeTemplatesApi(stores.templates, assertLive);
    this.#watch = watchOf(stores);
    this.#assertLive = assertLive;
  }

  #stub(id: string) {
    return new FakeConnection(
      id,
      this.#stores,
      this.#principal,
      this.#watch,
      this.#assertLive,
    );
  }

  async list(filter?: ListConnectionsFilter): Promise<Connection[]> {
    this.#assertLive();
    const store = this.#stores.connections;
    const connections = store
      .list()
      .filter(({ id }) => servedConnection(this.#stores, this.#principal, id));
    for (const c of connections) store.publish(c.id);
    return connections
      .filter((c) => {
        if (filter?.componentKey && c.component.key !== filter.componentKey)
          return false;
        if (filter?.kind && c.kind !== filter.kind) return false;
        if (filter?.status && c.status !== filter.status) return false;
        return true;
      })
      .map((c) => this.#stub(c.id));
  }

  async get(id: string): Promise<Connection> {
    this.#assertLive();
    if (!servedConnection(this.#stores, this.#principal, id))
      throw Object.assign(new Error(`connection not found: ${id}`), {
        code: "PRISMATIC_CONNECTION_NOT_FOUND",
      });
    this.#stores.connections.publish(id);
    return this.#stub(id);
  }

  /** Mirrors the frame: only a customer admin may make one, from a known template. */
  async create({
    templateId,
    label,
  }: CreateConnectionInput): Promise<
    Result<Connection, ConnectionOperationError>
  > {
    this.#assertLive();
    const role = roleOf(this.#stores, this.#principal);
    if (role.isCustomerMarketplaceUser || !role.isCustomerMarketplaceAdmin)
      return {
        status: "error",
        error: connectionError(
          "PRISMATIC_CONNECTION_FORBIDDEN",
          "Only a customer admin can make connections.",
        ),
      };
    const template = this.#stores.connectionTemplates?.[templateId];
    if (!template)
      return {
        status: "error",
        error: connectionError(
          "PRISMATIC_CONNECTION_INVALID",
          `No customer-activated connection ${templateId}`,
        ),
      };
    const id = this.#stores.nextId("connection");
    const made = fakeConnectionState({
      id,
      kind: "customerActivated",
      label: label ?? template.label ?? templateId,
      definition: { id: templateId, stableKey: templateId },
      connection: {
        key: "oauth2",
        label: "OAuth 2.0",
        oauth2Type: template.oauth2Type,
        iconUrl: null,
      },
    });
    this.#stores.connections.commit(made);
    if (template.oauth2Type?.toLowerCase() === "client_credentials") {
      // As the platform does: the credential is kept, but its failed first connect
      // fails the save, and the frame answers that failure instead of the connection.
      if (template.connectsAs && template.connectsAs !== "ACTIVE")
        return {
          status: "error",
          error: connectionError(
            "PRISMATIC_CONNECT_FAILED",
            "Failed to auto-connect client credentials, please verify your configuration and try again.",
          ),
        };
      this.#watch.watch(id);
      this.#stores.connections.set(withConnectionStatus(made, "ACTIVE"));
    }
    return { status: "success", data: this.#stub(id) };
  }

  // A getter, as in the real frame: capnweb exposes prototype members, not own
  // properties, so a nested API has to hang off the prototype.
  get templates(): FakeTemplatesApi {
    this.#assertLive();
    return this.#templates;
  }

  static stop(api: FakeConnectionsApi) {
    api.#watch.stop();
  }
}

const configurationError = (
  code: ConfigurationOperationError["code"],
  message: string,
): ConfigurationOperationError => ({ name: "Error", code, message });

const disposedError = (what: string) =>
  Object.assign(new Error(`${what} was released.`), {
    code: "PRISMATIC_ACTION_DISPOSED" as const,
  });

/** Mirrors `ConfigurationFunctionImpl`: a released action answers ACTION_DISPOSED, including
 * for a call that was already in flight. */
class FakeConfigurationFunction
  extends RpcTarget
  implements ConfigurationFunctionTarget
{
  #disposed = false;

  constructor(
    private readonly invoke: (
      input: InvokeConfigurationFunctionInput,
    ) => Promise<Result<unknown, ConfigurationOperationError>>,
    private readonly release: () => void = () => {},
  ) {
    super();
  }

  async execute(input: InvokeConfigurationFunctionInput) {
    if (this.#disposed) return failed(disposedError("Function action"));
    const result = await this.invoke(input);
    return this.#disposed ? failed(disposedError("Function action")) : result;
  }

  [Symbol.dispose]() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.release();
  }
}

/** Mirrors the frame: each option is the connection `connections.get` serves, published so
 * its stream emits at once, and an id the store doesn't hold is not offered. A requirement
 * with a template also offers every credential made from it. */
const offeredConnections = (
  stores: FakeStores,
  principal: string,
  assertLive: AssertLive,
  requirements: FakeConnectionRequirements | undefined,
): ConfigurationConnectionOptions => {
  const role = roleOf(stores, principal);
  const canCreate =
    !role.isCustomerMarketplaceUser && role.isCustomerMarketplaceAdmin;
  const watch = watchOf(stores);
  const toRequirement = ({
    key,
    label,
    options,
    template,
  }: FakeConnectionRequirement): ConfigurationConnectionRequirement => {
    const made = template
      ? stores.connections
          .list()
          .filter(
            (c) =>
              c.kind === "customerActivated" && c.definition.id === template.id,
          )
          .map(({ id }) => id)
      : [];
    return {
      key,
      label: label ?? key,
      options: [...new Set([...options, ...made])]
        .filter((id) => servedConnection(stores, principal, id))
        .map((id) => {
          stores.connections.publish(id);
          return new FakeConnection(id, stores, principal, watch, assertLive);
        }),
      template: template ?? null,
      permissions: {
        createConnection: !template
          ? { allowed: false, reason: "NO_TEMPLATE" }
          : canCreate
            ? { allowed: true, reason: null }
            : { allowed: false, reason: "ROLE_RESTRICTED" },
      },
    };
  };
  return {
    init: (requirements?.init ?? []).map(toRequirement),
    serverFunctions: Object.fromEntries(
      Object.entries(requirements?.serverFunctions ?? {}).map(
        ([key, needed]) => [key, needed.map(toRequirement)],
      ),
    ),
  };
};

/** One instance's configuration for one integration version: the one `versionId` names, or
 * whichever the instance currently runs. */
class FakeConfiguration extends RpcTarget implements ConfigurationTarget {
  #disposed = false;
  #functions = new Set<FakeConfigurationFunction>();

  constructor(
    private readonly id: string,
    private readonly versionId: string | undefined,
    private readonly stores: FakeStores,
    private readonly principal: string,
    private readonly assertLive: AssertLive,
  ) {
    super();
  }

  #assertUsable() {
    this.assertLive();
    if (this.#disposed) throw disposedError("Configuration");
  }

  #record(): InstanceRecord {
    const record = this.stores.instances.get(this.id);
    if (!record) throw instanceGone(this.id);
    return record;
  }

  #scope(record = this.#record()): string {
    return this.versionId ?? record.integrationId;
  }

  #seed(integrationId = this.#scope()): FakeConfigurationSeed {
    return configurationSeed(this.stores, integrationId);
  }

  /** Mirrors `toConfigurationSnapshot`: save follows the role, init follows the
   * instance's update permission. A seed's `permissions` override both. */
  #project(record: InstanceRecord): ConfigurationState {
    const integrationId = this.#scope(record);
    const seed = this.#seed(integrationId);
    const listing = this.stores.integrations.get(integrationId);
    const writable = roleWritable(
      roleOf(this.stores, this.principal),
      listing?.isCustomerDeployable ?? true,
    )
      ? { allowed: true as const, reason: null }
      : { allowed: false as const, reason: "role-restricted" as const };
    const invocable =
      record.permissions?.updateDetails?.allowed === false
        ? { allowed: false as const, reason: "role-restricted" as const }
        : { allowed: true as const, reason: null };
    const isUpgrade = integrationId !== record.integrationId;
    return {
      instanceId: record.id,
      integrationId,
      integrationName: seed.name ?? listing?.name ?? integrationId,
      versionNumber: isUpgrade
        ? (seed.versionNumber ?? record.integrationVersionNumber)
        : record.integrationVersionNumber,
      configurationExperience:
        seed.configurationExperience ??
        listing?.configurationExperience ??
        "headless",
      isUpgrade,
      needsDeploy: record.needsDeploy,
      deployedVersion:
        record.deployedVersion ??
        (record.deployed ? record.integrationVersionNumber : null),
      schema: seed.schema,
      uiSchema: seed.uiSchema ?? null,
      flows: seed.flows ?? listing?.flows ?? [],
      configurationVersion: seed.configurationVersion ?? null,
      deployedConfigurationVersion: record.deployedConfigurationVersion ?? null,
      serverFunctions: (seed.serverFunctions ?? []).map(
        ({ execute: _execute, error: _error, ...metadata }) => metadata,
      ),
      permissions: {
        init: invocable,
        save: writable,
        ...seed.permissions,
      },
    };
  }

  state(): ReadableStream<ConfigurationState> {
    this.#assertUsable();
    this.#seed().beforeRead?.();
    const stream = this.#seed().stateStream?.(this.#project(this.#record()));
    if (stream) return stream;
    return this.stores.instances.stream(this.id, (record) =>
      this.#project(record),
    );
  }

  async refresh(): Promise<ConfigurationState> {
    this.#assertUsable();
    await this.#seed().beforeRefresh?.();
    this.#assertUsable();
    this.stores.instances.publish(this.id);
    return this.#project(this.#record());
  }

  async readConnectionOptions(): Promise<ConfigurationConnectionOptions> {
    this.#assertUsable();
    const requirements = await this.#seed().connectionOptions?.();
    this.#assertUsable();
    return offeredConnections(
      this.stores,
      this.principal,
      this.assertLive,
      requirements,
    );
  }

  async init(
    input: InitializeConfigurationInput,
  ): Promise<Result<unknown, ConfigurationOperationError>> {
    this.#assertUsable();
    return settle(async () => {
      const seed = this.#seed();
      if (seed.initError) return { status: "error", error: seed.initError };
      const data = seed.init
        ? await seed.init({ value: this.#record().value, ...input })
        : this.#record().value;
      this.assertLive();
      return { status: "success", data };
    });
  }

  /** Saving a newer version's configuration moves the instance to it, awaiting a deploy. */
  async save(
    input: SaveConfigurationInput,
  ): Promise<Result<void, ConfigurationOperationError>> {
    this.#assertUsable();
    return settle(async () => {
      const integrationId = this.#scope();
      const seed = this.#seed(integrationId);
      if (seed.saveError) return { status: "error", error: seed.saveError };
      await seed.beforeSave?.(input);
      this.assertLive();
      const errors = seed.invalidate?.(input.value);
      if (errors?.length)
        return {
          status: "error",
          error: {
            ...configurationError(
              "PRISMATIC_CONFIGURATION_INVALID",
              "Invalid configuration",
            ),
            fields: errors,
          },
        };
      const record = this.#record();
      const moving = integrationId !== record.integrationId;
      const flows = (seed.flows ?? record.flows).map((definition) => {
        const previous = record.flows.find(
          (flow) =>
            flow.id === definition.id ||
            (definition.stableId !== null &&
              flow.stableId === definition.stableId),
        );
        return {
          webhookUrl: "",
          endpointSecurityType: "CUSTOMER_OPTIONAL",
          permissions: {
            updateApiKeys: {
              allowed: true as const,
              reason: null,
            },
          },
          ...previous,
          ...definition,
          schedule:
            input.flows?.find(({ flowId }) => flowId === definition.id)
              ?.schedule ??
            previous?.schedule ??
            null,
        };
      });
      this.stores.instances.commit({
        ...record,
        flows,
        value: input.value,
        deployedVersion:
          record.deployedVersion ??
          (record.deployed ? record.integrationVersionNumber : null),
        deployedConfigurationVersion:
          record.deployedConfigurationVersion ?? null,
        integrationId,
        integrationVersionNumber: moving
          ? (seed.versionNumber ?? record.integrationVersionNumber)
          : record.integrationVersionNumber,
        needsDeploy: record.needsDeploy || moving,
        configState: "FULLY_CONFIGURED",
      });
      integrationChanged(this.stores, integrationId);
      if (moving) integrationChanged(this.stores, record.integrationId);
      return { status: "success", data: undefined };
    });
  }

  async createServerFunction({
    key,
  }: {
    key: string;
  }): Promise<ConfigurationFunctionTarget> {
    this.#assertUsable();
    const integrationId = this.#scope();
    await this.#seed(integrationId).beforeFunction?.(key);
    this.#assertUsable();
    const action = new FakeConfigurationFunction(
      async (input) => {
        this.#assertUsable();
        return settle(async () => {
          const definition = this.#seed(integrationId).serverFunctions?.find(
            (fn) => fn.key === key,
          );
          if (!definition)
            return {
              status: "error",
              error: configurationError(
                "PRISMATIC_CONFIGURATION_UNAVAILABLE",
                "Unknown function",
              ),
            };
          if (definition.error)
            return { status: "error", error: definition.error };
          const data = await definition.execute(input);
          this.assertLive();
          return { status: "success", data };
        });
      },
      () => this.#functions.delete(action),
    );
    this.#functions.add(action);
    return action;
  }

  [Symbol.dispose]() {
    this.#disposed = true;
    for (const action of this.#functions) action[Symbol.dispose]();
    this.#functions.clear();
  }
}

/** The record, its stream, and instance-level configuration. */
class FakeInstanceBase extends RpcTarget {
  protected readonly id: string;
  protected readonly stores: FakeStores;
  protected readonly principal: string;
  protected readonly assertLive: AssertLive;
  protected readonly loadedFlowApiKeys: LoadedFlowApiKeys;

  constructor(
    id: string,
    stores: FakeStores,
    principal: string,
    assertLive: AssertLive,
    loadedFlowApiKeys: LoadedFlowApiKeys,
  ) {
    super();
    this.id = id;
    this.stores = stores;
    this.principal = principal;
    this.assertLive = assertLive;
    this.loadedFlowApiKeys = loadedFlowApiKeys;
  }

  protected record(): InstanceRecord {
    const record = this.stores.instances.get(this.id);
    if (!record) throw instanceGone(this.id);
    return record;
  }

  /** The instance as this session's principal sees it, with the flow keys the session has
   * loaded. */
  protected project(record: InstanceRecord): InstanceState {
    const state = toInstanceState(record, {
      role: roleOf(this.stores, this.principal),
      customerDeployable:
        this.stores.integrations.get(record.integrationId)
          ?.isCustomerDeployable ?? true,
      facts: instanceFacts(this.stores, record, this.principal),
    });
    const loaded = this.loadedFlowApiKeys.get(this.id);
    return {
      ...state,
      flows: state.flows.map(({ apiKeys: _unloaded, ...flow }) => {
        const apiKeys = loaded?.get(flow.id);
        return apiKeys ? { ...flow, apiKeys } : flow;
      }),
    };
  }

  /** What a detail read does: loads every flow's keys as the backend holds them now. */
  protected loadFlowApiKeys(record: InstanceRecord): void {
    this.loadedFlowApiKeys.set(
      this.id,
      new Map(
        (record.flows ?? []).map(({ id, apiKeys }) => [
          id,
          [...(apiKeys ?? [])],
        ]),
      ),
    );
  }

  state(): ReadableStream<InstanceState> {
    this.assertLive();
    return this.stores.instances.stream(this.id, (record) =>
      this.project(record),
    );
  }

  async refresh(): Promise<InstanceState> {
    this.assertLive();
    const record = this.record();
    this.stores.instances.publish(this.id);
    return this.project(record);
  }

  async refreshDetail(): Promise<InstanceState> {
    this.assertLive();
    const record = this.record();
    this.loadFlowApiKeys(record);
    this.stores.instances.publish(this.id);
    return this.project(record);
  }

  /** Mirrors the frame, which reads the flows it checks whatever the outcome, so every
   * call loads the keys. */
  async updateDetails(
    input: import("../protocol/index.js").UpdateInstanceDetailsInput,
  ): Promise<Result<void, ConfigurationOperationError>> {
    this.assertLive();
    const result = this.#applyDetails(input);
    this.loadFlowApiKeys(this.record());
    this.stores.instances.publish(this.id);
    return result;
  }

  #applyDetails(
    input: import("../protocol/index.js").UpdateInstanceDetailsInput,
  ): Result<void, ConfigurationOperationError> {
    const record = this.record();
    const invalid = (message: string) => ({
      status: "error" as const,
      error: configurationError("PRISMATIC_CONFIGURATION_INVALID", message),
    });
    const forbidden = () => ({
      status: "error" as const,
      error: configurationError(
        "PRISMATIC_CONFIGURATION_FORBIDDEN",
        "Updating these details is not permitted.",
      ),
    });
    if (
      !input ||
      (input.name !== undefined &&
        (typeof input.name !== "string" || !input.name.trim())) ||
      (input.flows !== undefined && !Array.isArray(input.flows))
    )
      return invalid("Provide valid instance details.");
    if (
      input.name !== undefined &&
      record.permissions?.updateDetails?.allowed === false
    )
      return forbidden();
    const selected = new Set<string>();
    for (const change of input.flows ?? []) {
      const flow = record.flows?.find((flow) => flow.id === change?.flowId);
      if (!flow || selected.has(change.flowId))
        return invalid("Select each flow at most once.");
      selected.add(change.flowId);
      if (
        !flow.permissions.updateApiKeys.allowed ||
        record.permissions?.updateDetails?.allowed === false
      )
        return forbidden();
      if (
        !Array.isArray(change.apiKeys) ||
        [...change.apiKeys].some(
          (key: unknown) => typeof key !== "string" || !key.trim(),
        )
      )
        return invalid("API keys must be non-empty strings.");
    }
    this.stores.instances.set({
      ...record,
      ...(input.name !== undefined ? { name: input.name } : {}),
      flows: (record.flows ?? []).map((flow) => {
        const change = input.flows?.find((change) => change.flowId === flow.id);
        return change ? { ...flow, apiKeys: [...change.apiKeys] } : flow;
      }),
    });
    return { status: "success", data: undefined };
  }

  async configuration(
    input: ConfigurationScopeInput = {},
  ): Promise<ConfigurationTarget> {
    this.assertLive();
    this.record();
    this.stores.instances.publish(this.id);
    return new FakeConfiguration(
      this.id,
      input.integrationVersionId,
      this.stores,
      this.principal,
      this.assertLive,
    );
  }

  async delete(): Promise<void> {
    this.assertLive();
    const { integrationId } = this.record();
    this.stores.instances.remove(this.id);
    this.loadedFlowApiKeys.delete(this.id);
    this.stores.removedInstances ??= new Set();
    this.stores.removedInstances.add(this.id);
    integrationChanged(this.stores, integrationId);
  }

  /** Deploys and publishes the instance and its listing. The backend enables an instance
   * on its first deploy only. */
  protected async deployRecord(): Promise<void> {
    this.assertLive();
    await this.stores.configurations[
      this.record().integrationId
    ]?.beforeDeploy?.();
    this.assertLive();
    const record = this.record();
    const firstDeploy = !record.deployed && record.lastDeployedAt === null;
    this.stores.instances.commit({
      ...record,
      deployed: true,
      enabled: firstDeploy || record.enabled,
      deployedVersion: record.integrationVersionNumber,
      deployedConfigurationVersion:
        this.stores.configurations[record.integrationId]
          ?.configurationVersion ?? null,
      needsDeploy: false,
      lastDeployedAt: new Date().toISOString(),
      configState:
        record.value === undefined ? record.configState : "FULLY_CONFIGURED",
    });
    integrationChanged(this.stores, record.integrationId);
  }
}

class FakeUserConfiguration
  extends RpcTarget
  implements UserConfigurationTarget
{
  private readonly records: FakeCollection<UserConfigurationRecord>;
  private readonly recordId: string;
  #disposed = false;
  #functions = new Set<FakeConfigurationFunction>();
  #streams = new Set<() => void>();

  constructor(
    private readonly instanceId: string,
    private readonly stores: FakeStores,
    principal: string,
    private readonly assertLive: AssertLive,
  ) {
    super();
    this.records = stores.userConfigurationRecords ??= new FakeCollection();
    const initial = fakeUserConfigurationRecord({ principal, instanceId });
    this.recordId = initial.id;
    if (!this.records.get(initial.id)) this.records.set(initial);
    // Acquiring is a read, as `acquire()` refreshes in the real frame.
    this.#publish();
  }

  /** Mirrors `UserConfigurationImpl`: a deleted instance or a released target answers
   * UNAVAILABLE or ACTION_DISPOSED. */
  #assertUsable() {
    this.assertLive();
    this.#instance();
    if (this.#disposed) throw disposedError("User configuration");
  }

  #instance(): InstanceRecord {
    const instance = this.stores.instances.get(this.instanceId);
    if (!instance) throw instanceGone(this.instanceId);
    return instance;
  }

  #record(): UserConfigurationRecord {
    const record = this.records.get(this.recordId);
    if (!record)
      throw new Error(`user configuration not found: ${this.recordId}`);
    return record;
  }

  #seed(
    integrationId = this.#instance().integrationId,
  ): FakeUserConfigurationSeed {
    return (
      this.stores.userConfigurations?.[integrationId] ?? {
        schema: null,
      }
    );
  }

  #project(
    instance = this.#instance(),
    record = this.#record(),
  ): UserConfigurationState {
    const seed = this.#seed(instance.integrationId);
    return {
      instanceId: instance.id,
      integrationId: instance.integrationId,
      versionNumber: instance.integrationVersionNumber,
      configured: record.userLevelConfigId !== null,
      schema: seed.schema,
      uiSchema: seed.uiSchema ?? null,
      configurationVersion: seed.configurationVersion ?? null,
      value: record.configurationId === null ? null : record.value,
      serverFunctions: (seed.serverFunctions ?? []).map(
        ({ execute: _execute, error: _error, ...metadata }) => metadata,
      ),
      permissions: {
        save: { allowed: true, reason: null },
        remove:
          record.userLevelConfigId !== null
            ? { allowed: true, reason: null }
            : { allowed: false, reason: "role-restricted" },
        ...seed.permissions,
      },
    };
  }

  #publish() {
    this.stores.instances.publish(this.instanceId);
    this.records.publish(this.recordId);
  }

  /** The record and the instance stream in, each emission projected from the latest of
   * both. A repeated source value is a flush and passes through undeduped. */
  state(): ReadableStream<UserConfigurationState> {
    this.#assertUsable();
    this.#seed().beforeRead?.();
    const custom = this.#seed().stateStream?.(this.#project());
    if (custom) return custom;
    const records = this.records.stream(this.recordId).getReader();
    const instances = this.stores.instances.stream(this.instanceId).getReader();
    const readers = [records, instances];
    let record: UserConfigurationRecord | undefined;
    let instance: InstanceRecord | undefined;
    let last: { json: string; state: UserConfigurationState } | undefined;
    let stopped = false;
    let close = () => {};
    const stream = new ReadableStream<UserConfigurationState>({
      start: (controller) => {
        close = () => {
          if (stopped) return;
          stopped = true;
          try {
            controller.close();
          } catch {
            // Already closed or cancelled.
          }
          void Promise.all(readers.map((r) => r.cancel().catch(() => {})));
        };
        const emit = (repeat: boolean) => {
          if (!record || !instance) return;
          if (repeat && last) {
            controller.enqueue(last.state);
            return;
          }
          const state = this.#project(instance, record);
          const json = JSON.stringify(state);
          if (json === last?.json) return;
          last = { json, state };
          controller.enqueue(state);
        };
        const pump = async <T>(
          reader: ReadableStreamDefaultReader<T>,
          apply: (value: T) => boolean,
        ) => {
          try {
            while (!stopped) {
              const { done, value } = await reader.read();
              if (stopped) return;
              if (done) return close();
              emit(apply(value));
            }
          } catch (error) {
            if (stopped) return;
            stopped = true;
            controller.error(error);
            await Promise.all(readers.map((r) => r.cancel().catch(() => {})));
          }
        };
        void pump(records, (value) => {
          const repeat = value === record;
          record = value;
          return repeat;
        });
        void pump(instances, (value) => {
          const repeat = value === instance;
          instance = value;
          return repeat;
        });
      },
      cancel: async () => {
        stopped = true;
        this.#streams.delete(close);
        await Promise.all(readers.map((r) => r.cancel().catch(() => {})));
      },
    });
    this.#streams.add(close);
    return stream;
  }

  async refresh(): Promise<UserConfigurationState> {
    this.#assertUsable();
    await this.#seed().beforeRefresh?.();
    this.#assertUsable();
    this.#publish();
    return this.#project();
  }

  async save(
    input: SaveUserConfigurationInput,
  ): Promise<Result<void, ConfigurationOperationError>> {
    this.assertLive();
    return settle(async () => {
      this.#assertUsable();
      const seed = this.#seed();
      if (seed.saveError) return { status: "error", error: seed.saveError };
      await seed.beforeSave?.(input);
      this.#assertUsable();
      const fields = seed.invalidate?.(input.value);
      if (fields?.length)
        return {
          status: "error",
          error: {
            ...configurationError(
              "PRISMATIC_CONFIGURATION_INVALID",
              "Invalid user configuration",
            ),
            fields,
          },
        };
      const record = this.#record();
      const creating = record.userLevelConfigId === null;
      if (creating) {
        await seed.beforeCreate?.(input);
        this.#assertUsable();
        await seed.beforeActivate?.();
      } else {
        await seed.beforeUpdate?.(input);
      }
      this.#assertUsable();
      this.records.commit({
        ...record,
        userLevelConfigId:
          record.userLevelConfigId ?? this.stores.nextId("ulc"),
        configurationId:
          record.configurationId ?? this.stores.nextId("user-json"),
        value: seed.normalize ? seed.normalize(input.value) : input.value,
        active: creating ? true : record.active,
      });
      this.#publish();
      return { status: "success", data: undefined };
    });
  }

  async remove(): Promise<Result<void, ConfigurationOperationError>> {
    this.assertLive();
    return settle(async () => {
      this.#assertUsable();
      if (this.#seed().permissions?.remove?.allowed === false)
        return {
          status: "error",
          error: configurationError(
            "PRISMATIC_CONFIGURATION_FORBIDDEN",
            "Removing user configuration is not permitted.",
          ),
        };
      this.records.commit({
        ...this.#record(),
        userLevelConfigId: null,
        configurationId: null,
        value: null,
        active: false,
      });
      this.#publish();
      return { status: "success", data: undefined };
    });
  }

  async readConnectionOptions(): Promise<ConfigurationConnectionOptions> {
    this.#assertUsable();
    const requirements = await this.#seed().connectionOptions?.();
    this.#assertUsable();
    return offeredConnections(
      this.stores,
      this.records.get(this.recordId)?.principal ?? "",
      this.assertLive,
      requirements,
    );
  }

  async createServerFunction({
    key,
  }: {
    key: string;
  }): Promise<ConfigurationFunctionTarget> {
    this.#assertUsable();
    const integrationId = this.#instance().integrationId;
    await this.#seed().beforeFunction?.(key);
    this.#assertUsable();
    const action = new FakeConfigurationFunction(
      async (input) => {
        this.assertLive();
        return settle(async () => {
          this.#assertUsable();
          if (this.#instance().integrationId !== integrationId)
            return {
              status: "error",
              error: configurationError(
                "PRISMATIC_ACTION_DISPOSED",
                "Integration changed",
              ),
            };
          const definition = this.#seed().serverFunctions?.find(
            (fn) => fn.key === key,
          );
          if (!definition)
            return {
              status: "error",
              error: configurationError(
                "PRISMATIC_CONFIGURATION_UNAVAILABLE",
                "Unknown function",
              ),
            };
          if (definition.error)
            return { status: "error", error: definition.error };
          const data = await definition.execute(input);
          this.assertLive();
          return { status: "success", data };
        });
      },
      () => this.#functions.delete(action),
    );
    this.#functions.add(action);
    return action;
  }

  [Symbol.dispose]() {
    this.#disposed = true;
    for (const action of this.#functions) action[Symbol.dispose]();
    this.#functions.clear();
    for (const close of this.#streams) close();
    this.#streams.clear();
  }
}

class FakeInstance extends FakeInstanceBase implements Instance {
  async userConfiguration(): Promise<UserConfigurationTarget> {
    this.assertLive();
    this.record();
    return new FakeUserConfiguration(
      this.id,
      this.stores,
      this.principal,
      this.assertLive,
    );
  }

  async deploy(): Promise<void> {
    await this.deployRecord();
  }

  /** Mirrors `upgradeInstance`: re-reads the permission, then moves the instance keeping
   * its values, awaiting a deploy. */
  async upgrade(): Promise<Result<void, ConfigurationOperationError>> {
    this.assertLive();
    return settle(async () => {
      const record = this.record();
      const { update, permissions } = this.project(record);
      if (!permissions.upgrade.allowed || !update)
        return {
          status: "error",
          error: configurationError(
            "PRISMATIC_CONFIGURATION_FORBIDDEN",
            `Upgrading this instance is not permitted: ${permissions.upgrade.reason ?? "no-update"}.`,
          ),
        };
      this.stores.instances.commit({
        ...record,
        integrationId: update.integrationVersionId,
        integrationVersionNumber: update.versionNumber,
        deployedVersion:
          record.deployedVersion ??
          (record.deployed ? record.integrationVersionNumber : null),
        deployedConfigurationVersion:
          record.deployedConfigurationVersion ?? null,
        needsDeploy: true,
      });
      integrationChanged(this.stores, update.integrationVersionId);
      integrationChanged(this.stores, record.integrationId);
      return { status: "success", data: undefined };
    });
  }

  async pause(): Promise<void> {
    await this.#setEnabled(false);
  }

  async resume(): Promise<void> {
    await this.#setEnabled(true);
  }

  async #setEnabled(enabled: boolean): Promise<void> {
    this.assertLive();
    const record = this.record();
    this.stores.instances.commit({ ...record, enabled });
    integrationChanged(this.stores, record.integrationId);
  }
}

const CURSOR_PREFIX = "fake-cursor:";

/** Opaque cursors over a filtered list, as the real pages carry. A cursor the fake did not
 * issue rejects, as the API does. */
const paginate = <T, S>(
  matches: T[],
  input: { limit?: number; cursor?: string },
  toStub: (item: T) => S,
): {
  items: S[];
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
} => {
  const decoded = input.cursor ? atob(input.cursor) : `${CURSOR_PREFIX}0`;
  const offset = Number(decoded.slice(CURSOR_PREFIX.length));
  if (!decoded.startsWith(CURSOR_PREFIX) || !Number.isInteger(offset))
    throw new Error(`invalid cursor: ${input.cursor}`);
  const page = matches.slice(offset, offset + (input.limit ?? 50));
  const end = offset + page.length;
  return {
    items: page.map(toStub),
    pageInfo: {
      endCursor: page.length ? btoa(`${CURSOR_PREFIX}${end}`) : null,
      hasNextPage: end < matches.length,
    },
  };
};

class FakeInstancesApi extends RpcTarget implements InstancesApi {
  #stores: FakeStores;
  #principal: string;
  #assertLive: AssertLive;
  #loadedFlowApiKeys: LoadedFlowApiKeys;

  constructor(
    stores: FakeStores,
    principal: string,
    assertLive: AssertLive,
    loadedFlowApiKeys: LoadedFlowApiKeys,
  ) {
    super();
    this.#stores = stores;
    this.#principal = principal;
    this.#assertLive = assertLive;
    this.#loadedFlowApiKeys = loadedFlowApiKeys;
  }

  #stub(id: string) {
    return new FakeInstance(
      id,
      this.#stores,
      this.#principal,
      this.#assertLive,
      this.#loadedFlowApiKeys,
    );
  }

  async get(instanceId: string): Promise<Instance> {
    this.#assertLive();
    const record = this.#stores.instances.get(instanceId);
    if (!record)
      throw this.#stores.removedInstances?.has(instanceId)
        ? instanceGone(instanceId)
        : new Error(`instance not found: ${instanceId}`);
    this.#stores.instances.publish(instanceId);
    return this.#stub(instanceId);
  }

  /** Newest first, never-deployed instances included. Insertion order is creation order. */
  async list(input: ListInstancesInput = {}): Promise<InstanceListPage> {
    this.#assertLive();
    const matches = this.#stores.instances
      .list()
      .filter(
        (r) => !input.integrationId || r.integrationId === input.integrationId,
      )
      .reverse();
    const { items, pageInfo } = paginate(matches, input, (r) => {
      this.#stores.instances.publish(r.id);
      return this.#stub(r.id);
    });
    return { instances: items, pageInfo };
  }
}

class FakeMarketplaceIntegration
  extends RpcTarget
  implements MarketplaceIntegrationTarget
{
  #id: string;
  #stores: FakeStores;
  #principal: string;
  #assertLive: AssertLive;
  #loadedFlowApiKeys: LoadedFlowApiKeys;

  constructor(
    id: string,
    stores: FakeStores,
    principal: string,
    assertLive: AssertLive,
    loadedFlowApiKeys: LoadedFlowApiKeys,
  ) {
    super();
    this.#id = id;
    this.#stores = stores;
    this.#principal = principal;
    this.#assertLive = assertLive;
    this.#loadedFlowApiKeys = loadedFlowApiKeys;
  }

  #instance(id: string) {
    return new FakeInstance(
      id,
      this.#stores,
      this.#principal,
      this.#assertLive,
      this.#loadedFlowApiKeys,
    );
  }

  #listing(): MarketplaceIntegrationState {
    const listing = this.#stores.integrations.get(this.#id);
    if (!listing) throw new Error(`integration not found: ${this.#id}`);
    return listing;
  }

  /** Every version's instances of the integration, newest first, published as the real
   * frame's read does. */
  #records(): InstanceRecord[] {
    const records = instancesOfListing(this.#stores, this.#id);
    for (const r of records) this.#stores.instances.publish(r.id);
    return records;
  }

  state(): ReadableStream<MarketplaceIntegrationState> {
    this.#assertLive();
    const role = roleOf(this.#stores, this.#principal);
    return this.#stores.integrations.stream(this.#id, (listing) =>
      resolveListing(this.#stores, listing, role),
    );
  }

  async instances(): Promise<Instance[]> {
    this.#assertLive();
    if (this.#stores.unreadInstances?.has(this.#id)) return [];
    return this.#records().map((r) => this.#instance(r.id));
  }

  /** Reads the listing and its instances fresh, as the real frame does before deciding. */
  async createInstance(input: CreateInstanceInput): Promise<Instance> {
    this.#assertLive();
    const listing = this.#listing();
    this.#stores.integrations.publish(this.#id);
    if (!listing.allowMultipleInstances && this.#records().length) {
      throw new Error(
        `integration does not allow multiple instances: ${this.#id}`,
      );
    }
    const id = this.#stores.nextId("inst");
    this.#stores.instances.commit({
      ...fakeInstanceState({
        id,
        integrationId: this.#id,
        name: input.name,
        description: input.description ?? null,
        integrationVersionNumber: listing.versionNumber,
      }),
      value: undefined,
    });
    integrationChanged(this.#stores, this.#id);
    return this.#instance(id);
  }
}

const DEFAULT_ORDERING: readonly MarketplaceOrdering[] = [
  { field: "CATEGORY", direction: "ASC" },
  { field: "NAME", direction: "ASC" },
];

const orderingValue: Partial<
  Record<
    MarketplaceOrdering["field"],
    (listing: MarketplaceIntegrationState) => string | number | null
  >
> = {
  CATEGORY: (i) => i.category,
  CUSTOMER: (i) => i.customer?.name ?? null,
  DESCRIPTION: (i) => i.description,
  NAME: (i) => i.name,
  VERSION_NUMBER: (i) => i.versionNumber,
};

/** Stable sort by each ordering in turn; nulls sort last ascending, as Postgres does.
 * Fields the fake does not model keep insertion order. */
const sortListings = (
  listings: MarketplaceIntegrationState[],
  ordering: readonly MarketplaceOrdering[],
) =>
  [...listings].sort((a, b) => {
    for (const { field, direction } of ordering) {
      const value = orderingValue[field];
      if (!value) continue;
      const [x, y] = [value(a), value(b)];
      if (x === y) continue;
      const ascending = x === null ? 1 : y === null ? -1 : x < y ? -1 : 1;
      return direction === "ASC" ? ascending : -ascending;
    }
    return 0;
  });

class FakeMarketplaceApi extends RpcTarget implements MarketplaceApi {
  #store: FakeCollection<MarketplaceIntegrationState>;
  #stores: FakeStores;
  #principal: string;
  #assertLive: AssertLive;
  #loadedFlowApiKeys: LoadedFlowApiKeys;

  constructor(
    stores: FakeStores,
    principal: string,
    assertLive: AssertLive,
    loadedFlowApiKeys: LoadedFlowApiKeys,
  ) {
    super();
    this.#store = stores.integrations;
    this.#stores = stores;
    this.#principal = principal;
    this.#assertLive = assertLive;
    this.#loadedFlowApiKeys = loadedFlowApiKeys;
  }

  #stub(id: string) {
    return new FakeMarketplaceIntegration(
      id,
      this.#stores,
      this.#principal,
      this.#assertLive,
      this.#loadedFlowApiKeys,
    );
  }

  /** Honors `searchTerm`, `category`, `label`, `activated`, `ordering`, `limit` and
   * `cursor`; `filterQuery` is accepted and ignored. */
  async list(input: ListIntegrationsInput = {}): Promise<MarketplaceListPage> {
    this.#assertLive();
    const term = input.searchTerm?.toLowerCase();
    const { category, label } = input;
    const role = roleOf(this.#stores, this.#principal);
    const matches = this.#store
      .list()
      .map((i) => resolveListing(this.#stores, i, role))
      .filter((i) => {
        if (term && !i.name.toLowerCase().includes(term)) return false;
        if (category && !containsIgnoringCase(i.category, category))
          return false;
        if (label && !i.labels.some((l) => containsIgnoringCase(l, label)))
          return false;
        if (
          input.activated !== undefined &&
          i.instances.length > 0 !== input.activated
        ) {
          return false;
        }
        return true;
      });
    const ordered = sortListings(
      matches,
      input.ordering?.length ? input.ordering : DEFAULT_ORDERING,
    );
    let walked = true;
    try {
      this.#stores.beforeInstanceWalk?.();
    } catch {
      walked = false;
    }
    const { items, pageInfo } = paginate(ordered, input, (i) => {
      if (walked) this.#stores.unreadInstances?.delete(i.id);
      else this.#stores.unreadInstances?.add(i.id);
      this.#store.publish(i.id);
      return this.#stub(i.id);
    });
    return { integrations: items, pageInfo };
  }

  async get(integrationId: string): Promise<MarketplaceIntegrationTarget> {
    this.#assertLive();
    if (!this.#store.get(integrationId))
      throw Object.assign(
        new Error(`integration not found: ${integrationId}`),
        { code: "PRISMATIC_MARKETPLACE_INTEGRATION_NOT_FOUND" },
      );
    this.#stores.unreadInstances?.delete(integrationId);
    this.#store.publish(integrationId);
    return this.#stub(integrationId);
  }

  async filterOptions(): Promise<MarketplaceFilterOptions> {
    this.#assertLive();
    const categories = new Set<string>();
    const labels = new Set<string>();
    for (const integration of this.#store.list()) {
      if (integration.category) categories.add(integration.category);
      for (const label of integration.labels) labels.add(label);
    }
    return { categories: [...categories].sort(), labels: [...labels].sort() };
  }
}

/** The frame's identity rule, matching the real server: everything before the first `:`
 * is the principal, the rest is the token. `"orgA:t1"` and `"orgA:t2"` are a refresh;
 * `"orgB:t1"` is a different principal. */
const principalOf = (jwt: string) => jwt.split(":")[0] ?? jwt;

/**
 * Serves {@link PrismaticApi} over in-memory {@link FakeStores}. Every surface returns
 * real `RpcTarget` stubs whose `state()` streams cross the wire exactly as the
 * frontend's do, so host code runs end to end without a live app. Revocation closes
 * every open stream, as it does there.
 */
export class FakePrismaticApi extends RpcTarget implements PrismaticApi {
  #scope = crypto.randomUUID();
  #revoked = false;
  #jwt: string;
  #stores: FakeStores;
  #host: RpcStub<HostApi> | null;
  #connections: FakeConnectionsApi;
  #marketplace: FakeMarketplaceApi;
  #instances: FakeInstancesApi;
  #loadedFlowApiKeys: LoadedFlowApiKeys = new Map();

  constructor(
    jwt = "",
    stores: FakeStores = emptyStores(),
    host: RpcStub<HostApi> | null = null,
  ) {
    super();
    this.#jwt = jwt;
    this.#stores = stores;
    this.#host = host;
    const assertLive = () => this.#assertLive();
    const principal = principalOf(jwt);
    this.#connections = new FakeConnectionsApi(stores, principal, assertLive);
    this.#marketplace = new FakeMarketplaceApi(
      stores,
      principal,
      assertLive,
      this.#loadedFlowApiKeys,
    );
    this.#instances = new FakeInstancesApi(
      stores,
      principal,
      assertLive,
      this.#loadedFlowApiKeys,
    );
  }

  #assertLive() {
    if (this.#revoked) {
      throw Object.assign(new Error("session revoked"), {
        code: SESSION_REVOKED_CODE,
      });
    }
  }

  get connections(): FakeConnectionsApi {
    this.#assertLive();
    return this.#connections;
  }

  get marketplace(): FakeMarketplaceApi {
    this.#assertLive();
    return this.#marketplace;
  }

  get instances(): FakeInstancesApi {
    this.#assertLive();
    return this.#instances;
  }

  /** Asks the host to open a URL the way the real frame does during OAuth. `false` when
   * no `host` was granted or the host rejected — the frame never sees why. */
  async openExternalUrl(url: string): Promise<boolean> {
    this.#assertLive();
    if (!this.#host) return false;
    try {
      return await this.#host.openExternalUrl(url);
    } catch {
      return false;
    }
  }

  async serverInfo(): Promise<ServerInfo> {
    return serverInfo();
  }

  async getSessionScope(): Promise<string> {
    this.#assertLive();
    return this.#scope;
  }

  async getAuthenticatedUser(): Promise<AuthenticatedUser> {
    this.#assertLive();
    return {
      id: `user-${principalOf(this.#jwt)}`,
      email: "dev@example.com",
      name: "Dev User",
    };
  }

  /** Echoes the token the frame currently holds, so tests can see refreshes. */
  currentJwt(): string {
    this.#assertLive();
    return this.#jwt;
  }

  /** Statics, not methods: the wire surface is exactly this class's methods. */
  static refresh(api: FakePrismaticApi, jwt: string) {
    api.#jwt = jwt;
  }

  static revoke(api: FakePrismaticApi) {
    api.#revoked = true;
    FakeConnectionsApi.stop(api.#connections);
    api.#stores.connections.closeAll();
    api.#stores.integrations.closeAll();
    api.#stores.instances.closeAll();
    api.#loadedFlowApiKeys.clear();
    api.#stores.userConfigurationRecords?.closeAll();
  }

  echo(value: string): string {
    return value;
  }

  /** Throws the shape the real frontend's GraphQL layer throws: request context hanging
   * off the error, JWT included. */
  leak(): never {
    throw Object.assign(new Error("request failed"), {
      name: "GraphQLApiError",
      code: "GRAPHQL_ERROR",
      request: { headers: { Authorization: "Bearer server-side-jwt" } },
      response: { body: "tenant internals" },
    });
  }

  /** Invokes a host-supplied callback and reports everything the host's rejection
   * carried across the wire, so tests can assert on what leaked. */
  async captureRejection(callback: () => Promise<unknown>): Promise<{
    name: string;
    message: string;
    stack?: string;
    props: Record<string, unknown>;
  }> {
    try {
      await callback();
      throw new Error("callback did not reject");
    } catch (error) {
      const e = error as Error;
      const props: Record<string, unknown> = {};
      for (const key of Object.keys(e))
        props[key] = (e as unknown as Record<string, unknown>)[key];
      if ("cause" in e) props.cause = e.cause;
      return { name: e.name, message: e.message, stack: e.stack, props };
    }
  }
}

/**
 * Pre-auth root the fake exposes, mirroring the real one. It does not `implement
 * PreAuthApi`: `authenticate` resolves to the concrete {@link FakePrismaticApi}, whose
 * extra test affordances are not on the protocol.
 */
export class FakePreAuthApi extends RpcTarget {
  #api: FakePrismaticApi | null = null;
  #principal: string | null = null;
  #stores: FakeStores;
  #host: RpcStub<HostApi> | null = null;
  authCount = 0;
  protocol: ProtocolVersion = PROTOCOL_VERSION;

  constructor(stores: FakeStores = emptyStores()) {
    super();
    this.#stores = stores;
  }

  /** The host's main, as returned by the frame's `newMessagePortRpcSession`. */
  attachHost(host: RpcStub<HostApi>) {
    this.#host = host;
  }

  serverInfo(): ServerInfo {
    return serverInfo(this.protocol);
  }

  async authenticate(jwt: string): Promise<FakePrismaticApi> {
    if (!jwt) throw new Error("authenticate requires a non-empty jwt");
    this.authCount += 1;
    const principal = principalOf(jwt);
    if (this.#api && this.#principal === principal) {
      FakePrismaticApi.refresh(this.#api, jwt);
      return this.#api;
    }
    if (this.#api) FakePrismaticApi.revoke(this.#api);
    this.#principal = principal;
    this.#api = new FakePrismaticApi(jwt, this.#stores, this.#host);
    return this.#api;
  }
}

export interface FakeFrameOptions {
  /** Origin the fake frame claims to post from. Defaults to the app origin. */
  origin?: string;
  /** Skip the READY post entirely, to exercise the boot timeout path. */
  neverReady?: boolean;
  /** Delay before posting READY, in ms. */
  readyDelayMs?: number;
  /** Observe the host's port handshake without inspecting RPC traffic. */
  onHandshake?: (client: unknown) => void;
  /** Open the frame's session without `onSendError`, reproducing a server that has not
   * installed the redactor. Only a test asserting that guard should set this. */
  withoutRedaction?: boolean;
  /** Protocol identifier the frame claims. Defaults to the one this build speaks; set it to
   * something else to exercise the mismatch path. */
  protocol?: ProtocolVersion;
  /** Connections the frame serves. Mutate later through {@link FakeFrame.connections}. */
  connections?: ConnectionState[];
  integrations?: MarketplaceIntegrationState[];
  /** Authored configuration per integration id. An integration without one serves an
   * empty schema, as the real frame does when the author declared none. */
  configurations?: Record<string, FakeConfigurationSeed>;
  userConfigurations?: Record<string, FakeUserConfigurationSeed>;
  userConfigurationRecords?: UserConfigurationRecord[];
  /** Instances that already exist; `value` seeds a saved configuration. */
  instances?: FakeInstanceSeed[];
  templates?: ConnectionTemplate[];
  /** Customer-activated connections a credential can be made from, by id. */
  connectionTemplates?: Record<string, FakeConnectionTemplate>;
  /** The consent URL `authorize()` answers for a connection. */
  authorizeUrl?: (id: string) => string;
  /** How often an authorization in flight is re-read. Defaults to 2s, as the frame does. */
  connectionPollMs?: number;
  /** The principal each personal connection belongs to, by id. Only its owner is served it. */
  connectionOwners?: Record<string, string>;
  /** The embedded role each session's JWT carries, from which listing and configuration
   * permissions derive. Defaults to a customer marketplace admin. */
  role?: FakeEmbeddedRole | ((principal: string) => FakeEmbeddedRole);
  /** Runs where the real frame walks the customer's instances for a marketplace page;
   * throwing fails that walk, so the page's listings carry no instances and say so. */
  beforeInstanceWalk?: () => void;
}

export interface FakeFrame {
  /** Store behind `api.connections`. `set()` is an out-of-band write that open `state()`
   * streams see after the next read through the session. */
  connections: FakeCollection<ConnectionState>;
  /** Live store behind `api.marketplace`. */
  integrations: FakeCollection<MarketplaceIntegrationState>;
  /** Live store behind every `Instance` and `Configuration` stub. */
  instances: FakeCollection<InstanceRecord>;
  userConfigurationRecords: FakeCollection<UserConfigurationRecord>;
  /** Resolves once the frame has accepted a port and opened its RPC session. */
  connected: Promise<void>;
  /** Ports the frame accepted — asserts against duplicate handshakes. */
  portCount: () => number;
  /** `authenticate()` calls the frame served across all ports. */
  authCount: () => number;
  /**
   * `state()` streams the frame still holds open, across every store. Only meaningful
   * after {@link FakeFrame.flushStreams} has settled; before that it counts streams whose
   * cancel is queued but undelivered.
   */
  openStreams: () => number;
  /**
   * Delivers every queued stream cancel by writing into each open stream, then settles.
   * Await this before sampling `openStreams()` or `client.stats().exports`, or a released
   * stream still reads as held and the count climbs on a clean path.
   */
  flushStreams: () => Promise<void>;
  restore: () => void;
}

/**
 * Patches `document.createElement` so the next created `<iframe>` behaves like a real
 * Prismatic frame: its `contentWindow` answers the port handshake and hosts a
 * {@link FakePrismaticApi} session. jsdom does not run iframe content, so both halves of
 * the `postMessage` conversation are synthesized here.
 *
 * One frame at a time, and `restore()` in `afterEach` is mandatory or the patch and its
 * stores leak into the next test.
 */
export const installFakeFrame = (options: FakeFrameOptions = {}): FakeFrame => {
  const {
    origin = window.location.origin,
    neverReady = false,
    readyDelayMs = 0,
    onHandshake,
    withoutRedaction = false,
    protocol = PROTOCOL_VERSION,
    connections = [],
    integrations = [],
    configurations = {},
    userConfigurations = {},
    userConfigurationRecords = [],
    instances = [],
    templates = [],
    connectionTemplates,
    authorizeUrl,
    connectionPollMs,
    connectionOwners,
    role = CUSTOMER_ADMIN,
    beforeInstanceWalk,
  } = options;

  const userRecords = new FakeCollection(userConfigurationRecords);
  const stores: FakeStores = {
    connections: new FakeCollection(connections),
    integrations: new FakeCollection(integrations),
    instances: new FakeCollection(instances.map(toRecord)),
    configurations,
    userConfigurations,
    userConfigurationRecords: userRecords,
    templates,
    connectionTemplates,
    authorizeUrl,
    connectionPollMs,
    connectionOwners,
    nextId: idSequence(),
    roleOf: typeof role === "function" ? role : () => role,
    beforeInstanceWalk,
    unreadInstances: new Set(),
  };

  const realCreateElement = document.createElement.bind(document);
  const roots: FakePreAuthApi[] = [];
  let ports = 0;
  let resolveConnected: () => void;
  const connected = new Promise<void>((resolve) => {
    resolveConnected = resolve;
  });

  const timers: Array<ReturnType<typeof setTimeout>> = [];

  document.createElement = ((tagName: string, ...rest: unknown[]) => {
    const element = realCreateElement(tagName as "iframe", ...(rest as []));
    if (tagName.toLowerCase() !== "iframe") return element;

    const iframe = element as HTMLIFrameElement;

    const contentWindow = {
      postMessage: (data: {
        type?: string;
        port?: MessagePort;
        client?: unknown;
      }) => {
        if (data?.type !== PORT_EVENT || !data.port) return;
        onHandshake?.(data.client);
        ports += 1;
        const root = new FakePreAuthApi(stores);
        root.protocol = protocol;
        roots.push(root);
        const host = newMessagePortRpcSession<HostApi>(
          data.port,
          root,
          withoutRedaction ? undefined : { onSendError: redactError },
        );
        root.attachHost(host);
        resolveConnected();
      },
    };
    Object.defineProperty(iframe, "contentWindow", {
      configurable: true,
      get: () => contentWindow as unknown as Window,
    });

    if (!neverReady) {
      timers.push(
        setTimeout(() => {
          window.dispatchEvent(
            new MessageEvent("message", {
              data: { type: READY_EVENT },
              origin,
              source: contentWindow as unknown as Window,
            }),
          );
        }, readyDelayMs),
      );
    }

    return iframe;
  }) as typeof document.createElement;

  const collections = (): FakeCollection<{ id: string }>[] => [
    stores.connections as unknown as FakeCollection<{ id: string }>,
    stores.integrations as unknown as FakeCollection<{ id: string }>,
    stores.instances as unknown as FakeCollection<{ id: string }>,
    userRecords as unknown as FakeCollection<{ id: string }>,
  ];

  const openStreams = () =>
    collections().reduce((total, c) => total + c.openStreams(), 0);

  return {
    connections: stores.connections,
    integrations: stores.integrations,
    instances: stores.instances,
    userConfigurationRecords: userRecords,
    connected,
    portCount: () => ports,
    authCount: () => roots.reduce((total, root) => total + root.authCount, 0),
    openStreams,
    flushStreams: async () => {
      // One flush delivers one round of cancels, and a cancel can free a stream whose own
      // cancel is still queued (a page stub's rows). Repeat until the count holds.
      let last = -1;
      for (let round = 0; round < 20 && openStreams() !== last; round += 1) {
        last = openStreams();
        for (const c of collections()) c.flush();
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    },
    restore: () => {
      for (const timer of timers) clearTimeout(timer);
      watchOf(stores).stop();
      document.createElement = realCreateElement;
    },
  };
};
