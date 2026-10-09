/**
 * The backend a behavior spec starts from, described in domain terms, and a view of what the
 * backend holds afterwards. Specs never reach the fake frame directly; they say what exists,
 * what the backend should stall or refuse, and read back what it persisted.
 */

import type {
  ConfigurationFieldError,
  InstanceFlow,
} from "@prismatic-io/solis-core/protocol";
import {
  FakeCollection,
  type FakeConfigurationSeed,
  type FakeEmbeddedRole,
  type FakeFrame,
  FakePrismaticApi,
  type FakeUserConfigurationSeed,
  fakeConnectionState,
  fakeInstanceState,
  fakeIntegrationState,
  fakeUserConfigurationRecord,
  type InstanceRecord,
  installFakeFrame,
  withConnectionStatus,
} from "@prismatic-io/solis-core/testing";

export const APP_ORIGIN = "https://app.example.com";

export type Role = "admin" | "user";

type Validate = (value: unknown) => ConfigurationFieldError[] | undefined;
type ServerFunction = (inputs: unknown) => unknown;

export interface WorldIntegration {
  id: string;
  name?: string;
  category?: string | null;
  labels?: readonly string[];
  versionNumber?: number;
  allowMultipleInstances?: boolean;
  isCustomerDeployable?: boolean;
  /** `false` for a version that backs instances but that the marketplace does not list. */
  listed?: boolean;
  /** Id of the version the marketplace offers as this one's upgrade. */
  upgradeTo?: string;
  /** The version its configuration is saved under. Defaults to one per integration, so an
   * upgrade needs review unless both versions name the same one. */
  configurationVersion?: string;
  /** `"hosted"` for config pages or low-code: nothing for the host to render itself. */
  configurationExperience?: "headless" | "hosted";
  configuration?: {
    /** What the author's init returns. Defaults to the saved value. */
    init?: (saved: unknown) => unknown;
    /** Field errors the backend answers a save with, or nothing to accept it. */
    validate?: Validate;
    /** Every save and init is refused as forbidden. */
    forbidden?: boolean;
    serverFunctions?: Record<string, ServerFunction>;
    /** Server functions the backend refuses for want of a usable connection. */
    functionsNeedingConnection?: readonly string[];
    /** What init needs: connection ids by requirement key. Only ids of connections in
     * the world are offered. */
    connectionRequirements?: Record<string, readonly string[]>;
    /** What each server function needs, the same way. */
    functionConnectionRequirements?: Record<
      string,
      Record<string, readonly string[]>
    >;
    /** Requirements, by key, the customer can make a new credential for: the OAuth grant
     * of the customer-activated connection behind each (`null` for one that isn't OAuth). */
    newConnections?: Record<string, WorldNewConnection>;
  };
  /** Present when the integration asks each user for their own configuration. */
  personalConfiguration?: {
    validate?: Validate;
    serverFunctions?: Record<string, ServerFunction>;
    /** The user-level connections each server function needs, the same way. */
    functionConnectionRequirements?: Record<
      string,
      Record<string, readonly string[]>
    >;
  };
}

export interface WorldNewConnection {
  oauth2Type: "authorization_code" | "client_credentials" | null;
  /** Whether a client-credentials credential connects as it's made. Defaults to `ACTIVE`;
   * `FAILED` is the provider refusing it, which the platform reports while keeping it. */
  connectsAs?: "ACTIVE" | "FAILED";
}

export interface WorldFlow {
  id: string;
  name: string;
  apiKeys?: readonly string[];
}

export interface WorldInstance {
  id: string;
  integrationId: string;
  name?: string;
  /** Defaults to true; `false` is a never-deployed instance. */
  deployed?: boolean;
  value?: unknown;
  flows?: readonly WorldFlow[];
  /** Whether the organization lets the customer upgrade it. Defaults to true. */
  upgradeable?: boolean;
}

export interface WorldPersonalConfiguration {
  user: string;
  instanceId: string;
  value: unknown;
  /** Defaults to true. */
  active?: boolean;
}

export interface World {
  /** Unlisted users are customer marketplace admins. */
  users?: Record<string, Role>;
  integrations?: readonly WorldIntegration[];
  instances?: readonly WorldInstance[];
  personalConfigurations?: readonly WorldPersonalConfiguration[];
  connections?: readonly {
    id: string;
    status?: "ACTIVE" | "PENDING" | "ERROR" | "FAILED";
    /** Defaults to customer-activated. `userLevel` is a user's own credential for a
     * connection an instance's user-level configuration needs. */
    kind?:
      | "customerActivated"
      | "manualCustomerActivated"
      | "userActivated"
      | "userLevel";
    /** The user a personal connection belongs to; only they are served it. */
    owner?: string;
    /** The OAuth grant; `null` for a connection that isn't OAuth. Defaults to an
     * authorization code grant. */
    oauth2Type?: "authorization_code" | "client_credentials" | null;
  }[];
  /** The consent screen the backend answers with, for every connection. */
  consentUrl?: string;
  /** How long a connection being authorized goes before its status is checked again on its
   * own. Defaults to a few milliseconds. */
  statusRecheckMs?: number;
}

/** A backend operation a spec can stall or count. */
export type Operation =
  | "configuration.read"
  | "configuration.save"
  | "configuration.deploy"
  | "configuration.init"
  | "configuration.serverFunction"
  | "configuration.connections"
  | "personalConfiguration.read"
  | "personalConfiguration.save"
  | "marketplace.list"
  | "marketplace.get"
  | "marketplace.filterOptions"
  | "marketplace.activate"
  | "connections.list"
  | "instances.list"
  | "instances.get"
  /** Reading an instance's flow API keys, which only its own screen does. */
  | "instances.flowApiKeys";

/** Operations the backend can be told to fail once. */
export type Fault =
  | "configuration.read"
  | "configuration.refresh"
  | "marketplace.list"
  | "marketplace.get"
  | "marketplace.filterOptions"
  /** Reading the customer's instances for a marketplace page. */
  | "marketplace.instances"
  | "instances.flowApiKeys";

export interface InstanceView {
  name: string;
  integrationId: string;
  versionNumber: number;
  deployed: boolean;
  enabled: boolean;
  needsDeploy: boolean;
  lastDeployedAt: string | null;
  value: unknown;
  flows: { id: string; apiKeys: readonly string[] }[];
}

export interface PersonalConfigurationView {
  saved: boolean;
  active: boolean;
  value: unknown;
}

export interface Backend {
  instance: (id: string) => InstanceView | undefined;
  instances: (integrationId?: string) => (InstanceView & { id: string })[];
  personalConfiguration: (
    user: string,
    instanceId: string,
  ) => PersonalConfigurationView;
  /** How many times the backend served an operation. */
  served: (operation: Operation) => number;
  /** Stalls the next arrivals of an operation until released. */
  hold: (operation: Operation) => {
    reached: Promise<void>;
    release: () => void;
  };
  failNext: (fault: Fault) => void;
  /** A change made elsewhere, such as the Prismatic UI; the app sees it on its next read. */
  publishListing: (integration: WorldIntegration) => void;
  /** A listing taken out of the marketplace elsewhere. */
  withdrawListing: (id: string) => void;
  /** An instance moved to another version elsewhere, bringing that version's flows; the app
   * sees it on its next read. */
  upgradeElsewhere: (
    instanceId: string,
    move: { to: string; flows: readonly WorldFlow[] },
  ) => void;
  /** A flow's API keys changed elsewhere; the app sees them on its next read of them. */
  setFlowApiKeysElsewhere: (
    instanceId: string,
    flowId: string,
    apiKeys: readonly string[],
  ) => void;
  /** A connection deleted elsewhere; the app learns of it on its next read. */
  removeConnection: (id: string) => void;
  /** The provider's answer to the user's consent, as it lands on the backend. */
  consent: (id: string, outcome: "granted" | "refused") => void;
  connection: (id: string) => { label: string; status: string } | undefined;
  /** Connections made from what a requirement needs. */
  connectionsFor: (requirement: string) => { id: string; label: string }[];
  /** Drops every live update the app holds for an instance. */
  dropLiveUpdates: (instanceId: string) => void;
  signIns: () => number;
  frameBoots: () => number;
}

export interface InstalledBackend {
  backend: Backend;
  frame: FakeFrame;
  restore: () => void;
}

const ROLES: Record<Role, FakeEmbeddedRole> = {
  admin: { isCustomerMarketplaceUser: false, isCustomerMarketplaceAdmin: true },
  user: { isCustomerMarketplaceUser: true, isCustomerMarketplaceAdmin: false },
};

const listingState = (integration: WorldIntegration) =>
  fakeIntegrationState({
    id: integration.id,
    name: integration.name ?? integration.id,
    category: integration.category ?? null,
    labels: [...(integration.labels ?? [])],
    versionNumber: integration.versionNumber ?? 1,
    allowMultipleInstances: integration.allowMultipleInstances ?? false,
    isCustomerDeployable: integration.isCustomerDeployable ?? true,
    userLevelConfigured: integration.personalConfiguration !== undefined,
    configurationExperience: integration.configurationExperience ?? "headless",
  });

class Gates {
  #held = new Map<
    Operation,
    { reached: () => void; released: Promise<void> }
  >();
  #served = new Map<Operation, number>();

  hold(operation: Operation) {
    let reached!: () => void;
    let release!: () => void;
    const arrival = new Promise<void>((resolve) => {
      reached = resolve;
    });
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.#held.set(operation, { reached, released });
    return {
      reached: arrival,
      release: () => {
        this.#held.delete(operation);
        release();
      },
    };
  }

  /** Counts the arrival and, when held, resolves once the spec releases it. */
  pass(operation: Operation): Promise<void> | undefined {
    this.#served.set(operation, this.served(operation) + 1);
    const gate = this.#held.get(operation);
    if (!gate) return undefined;
    gate.reached();
    return gate.released;
  }

  served(operation: Operation): number {
    return this.#served.get(operation) ?? 0;
  }
}

const configurationVersionOf = (integration: WorldIntegration) =>
  integration.configurationVersion ?? `${integration.id}-definition`;

const requirementsOf = (needed: Record<string, readonly string[]> = {}) =>
  Object.entries(needed).map(([key, options]) => ({ key, options }));

const functionRequirementsOf = (
  needed: Record<string, Record<string, readonly string[]>> = {},
) =>
  Object.fromEntries(
    Object.entries(needed).map(([key, requirements]) => [
      key,
      requirementsOf(requirements),
    ]),
  );

const templateIdOf = (requirement: string) => `template-${requirement}`;

const failure = (code: string, message: string) => ({
  name: "Error",
  code,
  message,
});

export const installBackend = async (
  world: World,
): Promise<InstalledBackend> => {
  const gates = new Gates();
  const faults = new Set<Fault>();
  const takeFault = (fault: Fault) => faults.delete(fault);
  const integrations = world.integrations ?? [];
  const byId = new Map(integrations.map((i) => [i.id, i]));

  const configurationSeed = (
    integration: WorldIntegration,
  ): FakeConfigurationSeed => {
    const authored = integration.configuration ?? {};
    const target = integration.upgradeTo
      ? byId.get(integration.upgradeTo)
      : undefined;
    const needsConnection = new Set(authored.functionsNeedingConnection);
    const withTemplates = (
      needed: { key: string; options: readonly string[] }[],
    ) =>
      needed.map((requirement) => {
        const made = authored.newConnections?.[requirement.key];
        return made
          ? {
              ...requirement,
              template: {
                id: templateIdOf(requirement.key),
                oauth2Type: made.oauth2Type,
              },
            }
          : requirement;
      });
    return {
      name: integration.name ?? integration.id,
      configurationExperience: integration.configurationExperience,
      schema: { type: "object" },
      configurationVersion: configurationVersionOf(integration),
      versionNumber: integration.versionNumber ?? 1,
      upgradeTarget: target
        ? {
            integrationId: target.id,
            versionNumber: target.versionNumber ?? 1,
            configurationVersion: configurationVersionOf(target),
          }
        : null,
      ...(authored.forbidden
        ? {
            initError: failure(
              "PRISMATIC_CONFIGURATION_FORBIDDEN",
              "Backend authorization denied",
            ) as FakeConfigurationSeed["initError"],
            saveError: failure(
              "PRISMATIC_CONFIGURATION_FORBIDDEN",
              "Backend authorization denied",
            ) as FakeConfigurationSeed["saveError"],
          }
        : {}),
      init: async ({ value }) => {
        await gates.pass("configuration.init");
        return authored.init ? authored.init(value) : value;
      },
      invalidate: authored.validate,
      connectionOptions: async () => {
        await gates.pass("configuration.connections");
        return {
          init: withTemplates(requirementsOf(authored.connectionRequirements)),
          serverFunctions: Object.fromEntries(
            Object.entries({
              ...Object.fromEntries(
                Object.keys(authored.serverFunctions ?? {}).map((key) => [
                  key,
                  [],
                ]),
              ),
              ...functionRequirementsOf(
                authored.functionConnectionRequirements,
              ),
            }).map(([key, needed]) => [key, withTemplates(needed)]),
          ),
        };
      },
      serverFunctions: Object.entries(authored.serverFunctions ?? {}).map(
        ([key, run]) => ({
          key,
          label: key,
          description: null,
          inputSchema: null,
          outputSchema: null,
          permission: { allowed: true as const, reason: null },
          ...(needsConnection.has(key)
            ? {
                error: failure(
                  "PRISMATIC_CONNECTION_UNAVAILABLE",
                  "The selected connection is unavailable",
                ) as FakeConfigurationSeed["saveError"],
              }
            : {}),
          execute: async ({ inputs }) => {
            await gates.pass("configuration.serverFunction");
            return run(inputs);
          },
        }),
      ),
      beforeRead: () => {
        gates.pass("configuration.read");
        if (takeFault("configuration.read"))
          throw new Error("Configuration temporarily unavailable");
      },
      beforeRefresh: () => {
        if (takeFault("configuration.refresh"))
          throw new Error("Configuration refresh failed");
      },
      beforeSave: () => gates.pass("configuration.save"),
      beforeDeploy: () => gates.pass("configuration.deploy"),
    };
  };

  const personalSeed = (
    integration: WorldIntegration,
  ): FakeUserConfigurationSeed | undefined => {
    const authored = integration.personalConfiguration;
    if (!authored) return undefined;
    return {
      schema: { type: "object" },
      invalidate: authored.validate,
      connectionOptions: () => ({
        serverFunctions: functionRequirementsOf(
          authored.functionConnectionRequirements,
        ),
      }),
      serverFunctions: Object.entries(authored.serverFunctions ?? {}).map(
        ([key, run]) => ({
          key,
          label: key,
          description: null,
          inputSchema: null,
          outputSchema: null,
          permission: { allowed: true as const, reason: null },
          execute: ({ inputs }) => run(inputs),
        }),
      ),
      beforeRead: () => {
        gates.pass("personalConfiguration.read");
      },
      beforeSave: () => gates.pass("personalConfiguration.save"),
    };
  };

  const flowSeed = (instanceId: string, flow: WorldFlow): InstanceFlow => ({
    id: flow.id,
    name: flow.name,
    stableId: null,
    scheduleFromDeployer: false,
    schedule: null,
    webhookUrl: `https://hooks.example.test/${instanceId}/${flow.id}`,
    apiKeys: [...(flow.apiKeys ?? [])],
    endpointSecurityType: "CUSTOMER_OPTIONAL",
    permissions: { updateApiKeys: { allowed: true, reason: null } },
  });

  const instanceSeed = (instance: WorldInstance) => {
    const integration = byId.get(instance.integrationId);
    if (!integration)
      throw new Error(`Unknown integration: ${instance.integrationId}`);
    const deployed = instance.deployed ?? true;
    return {
      ...fakeInstanceState({
        id: instance.id,
        integrationId: instance.integrationId,
        name: instance.name ?? instance.id,
        integrationVersionNumber: integration.versionNumber ?? 1,
        deployed,
        enabled: deployed,
        lastDeployedAt: deployed ? "2026-01-01T00:00:00Z" : null,
        configState: deployed
          ? "FULLY_CONFIGURED"
          : "NEEDS_INSTANCE_CONFIGURATION",
        flows: (instance.flows ?? []).map((flow) =>
          flowSeed(instance.id, flow),
        ),
      }),
      value: instance.value,
      customerUpgradeable: instance.upgradeable ?? true,
    };
  };

  const personalSeeds = Object.fromEntries(
    integrations.flatMap((integration) => {
      const seed = personalSeed(integration);
      return seed ? [[integration.id, seed]] : [];
    }),
  );

  const frame = installFakeFrame({
    origin: APP_ORIGIN,
    role: (principal) => ROLES[world.users?.[principal] ?? "admin"],
    beforeInstanceWalk: () => {
      if (takeFault("marketplace.instances"))
        throw new Error("Instances temporarily unavailable");
    },
    integrations: integrations
      .filter(({ listed }) => listed !== false)
      .map(listingState),
    configurations: Object.fromEntries(
      integrations.map((integration) => [
        integration.id,
        configurationSeed(integration),
      ]),
    ),
    userConfigurations: personalSeeds,
    instances: (world.instances ?? []).map(instanceSeed),
    userConfigurationRecords: (world.personalConfigurations ?? []).map(
      ({ user, instanceId, value, active = true }) =>
        fakeUserConfigurationRecord({
          principal: user,
          instanceId,
          userLevelConfigId: `${user}-${instanceId}-personal`,
          configurationId: `${user}-${instanceId}-values`,
          value,
          active,
        }),
    ),
    connections: (world.connections ?? []).map(
      ({ id, status, kind, oauth2Type = "authorization_code" }) =>
        fakeConnectionState({
          id,
          status: status ?? "ACTIVE",
          ...(kind ? { kind } : {}),
          connection: {
            key: oauth2Type ? "oauth2" : "apiKey",
            label: oauth2Type ? "OAuth 2.0" : "API key",
            oauth2Type,
            iconUrl: null,
          },
        }),
    ),
    connectionOwners: Object.fromEntries(
      (world.connections ?? []).flatMap(({ id, owner }) =>
        owner ? [[id, owner]] : [],
      ),
    ),
    connectionTemplates: Object.fromEntries(
      integrations.flatMap((integration) =>
        Object.entries(integration.configuration?.newConnections ?? {}).map(
          ([requirement, { oauth2Type, connectsAs }]) => [
            templateIdOf(requirement),
            {
              label: requirement,
              oauth2Type,
              ...(connectsAs ? { connectsAs } : {}),
            },
          ],
        ),
      ),
    ),
    ...(world.consentUrl
      ? { authorizeUrl: () => world.consentUrl as string }
      : {}),
    connectionPollMs: world.statusRecheckMs ?? 20,
  });

  const restorers = await instrumentApi(gates, takeFault);

  const view = (record: InstanceRecord): InstanceView => ({
    name: record.name,
    integrationId: record.integrationId,
    versionNumber: record.integrationVersionNumber,
    deployed: record.deployed,
    enabled: record.enabled,
    needsDeploy: record.needsDeploy,
    lastDeployedAt: record.lastDeployedAt,
    value: record.value,
    flows: record.flows.map(({ id, apiKeys }) => ({
      id,
      apiKeys: apiKeys ?? [],
    })),
  });

  const backend: Backend = {
    instance: (id) => {
      const record = frame.instances.get(id);
      return record ? view(record) : undefined;
    },
    instances: (integrationId) =>
      frame.instances
        .list()
        .filter((r) => !integrationId || r.integrationId === integrationId)
        .map((record) => ({ id: record.id, ...view(record) })),
    personalConfiguration: (user, instanceId) => {
      const record = frame.userConfigurationRecords
        .list()
        .find((r) => r.principal === user && r.instanceId === instanceId);
      return {
        saved: Boolean(record?.userLevelConfigId),
        active: record?.active ?? false,
        value: record?.configurationId ? record.value : null,
      };
    },
    served: (operation) => gates.served(operation),
    hold: (operation) => gates.hold(operation),
    failNext: (fault) => {
      faults.add(fault);
    },
    publishListing: (integration) => {
      frame.integrations.set(listingState(integration));
    },
    withdrawListing: (id) => {
      frame.integrations.remove(id);
    },
    upgradeElsewhere: (instanceId, { to, flows }) => {
      const record = frame.instances.get(instanceId);
      const target = byId.get(to);
      if (!record || !target)
        throw new Error(`Cannot move ${instanceId} to ${to}`);
      frame.instances.set({
        ...record,
        integrationId: to,
        integrationVersionNumber: target.versionNumber ?? 1,
        flows: flows.map((flow) => flowSeed(instanceId, flow)),
      });
    },
    setFlowApiKeysElsewhere: (instanceId, flowId, apiKeys) => {
      const record = frame.instances.get(instanceId);
      if (!record) throw new Error(`No instance ${instanceId}`);
      frame.instances.set({
        ...record,
        flows: record.flows.map((flow) =>
          flow.id === flowId ? { ...flow, apiKeys: [...apiKeys] } : flow,
        ),
      });
    },
    removeConnection: (id) => {
      frame.connections.remove(id);
    },
    consent: (id, outcome) => {
      const current = frame.connections.get(id);
      if (!current) throw new Error(`No connection ${id}`);
      frame.connections.set(
        withConnectionStatus(
          current,
          outcome === "granted" ? "ACTIVE" : "FAILED",
        ),
      );
    },
    connection: (id) => {
      const current = frame.connections.get(id);
      return current && { label: current.label, status: current.status };
    },
    connectionsFor: (requirement) =>
      frame.connections
        .list()
        .filter(({ definition }) => definition.id === templateIdOf(requirement))
        .map(({ id, label }) => ({ id, label })),
    dropLiveUpdates: (instanceId) => {
      frame.instances.failStreams(instanceId, new Error("stream failed"));
      const personal = frame.userConfigurationRecords
        .list()
        .filter((r) => r.instanceId === instanceId);
      for (const record of personal)
        frame.userConfigurationRecords.failStreams(
          record.id,
          new Error("stream failed"),
        );
    },
    signIns: () => frame.authCount(),
    frameBoots: () => frame.portCount(),
  };

  return {
    backend,
    frame,
    restore: () => {
      for (const restore of restorers) restore();
      frame.restore();
    },
  };
};

type Method = (...args: unknown[]) => Promise<unknown>;

/**
 * Wraps the frame's list-style reads, which have no seed hooks, so specs can count and
 * fail them. The prototypes are shared by every session, so each wrap is undone on restore.
 */
const instrumentApi = async (
  gates: Gates,
  takeFault: (fault: Fault) => boolean,
): Promise<(() => void)[]> => {
  const probe = "probe";
  const api = new FakePrismaticApi(probe, {
    connections: new FakeCollection(),
    integrations: new FakeCollection([fakeIntegrationState({ id: probe })]),
    instances: new FakeCollection(),
    configurations: {},
    templates: [],
    nextId: (prefix) => prefix,
  });
  const listing = await api.marketplace.get(probe);
  const instance = await listing.createInstance({ name: probe });
  const surfaces: [object, string, Operation][] = [
    [Object.getPrototypeOf(instance), "refreshDetail", "instances.flowApiKeys"],
    [Object.getPrototypeOf(listing), "createInstance", "marketplace.activate"],
    [Object.getPrototypeOf(api.marketplace), "list", "marketplace.list"],
    [Object.getPrototypeOf(api.marketplace), "get", "marketplace.get"],
    [
      Object.getPrototypeOf(api.marketplace),
      "filterOptions",
      "marketplace.filterOptions",
    ],
    [Object.getPrototypeOf(api.connections), "list", "connections.list"],
    [Object.getPrototypeOf(api.instances), "list", "instances.list"],
    [Object.getPrototypeOf(api.instances), "get", "instances.get"],
  ];
  return surfaces.map(([prototype, name, operation]) => {
    const target = prototype as Record<string, Method>;
    const original = target[name];
    if (!original) throw new Error(`The fake frame has no ${operation}.`);
    target[name] = async function (this: unknown, ...args: unknown[]) {
      await gates.pass(operation);
      if (takeFault(operation as Fault))
        throw new Error(`${operation} is temporarily unavailable`);
      return original.apply(this, args);
    };
    return () => {
      target[name] = original;
    };
  });
};
