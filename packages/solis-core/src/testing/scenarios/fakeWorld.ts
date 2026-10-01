import type {
  ConnectionKind,
  ConnectionManagedBy,
  ConnectionScope,
  ConnectionState,
} from "../../protocol/index.js";
import {
  FakeCollection,
  type FakeConfigurationSeed,
  type FakeConnectionRequirement,
  type FakeEmbeddedRole,
  type FakeStores,
  type FakeUpgradeTarget,
  type FakeUserConfigurationSeed,
  fakeConnectionState,
  fakeInstanceState,
  fakeIntegrationState,
  type InstanceRecord,
} from "../fakeFrame.js";
import {
  type ResolvedIntegration,
  resolveInstance,
  resolveIntegration,
  type World,
  type WorldConnection,
  type WorldConnectionRequirement,
  type WorldRole,
  worldConnectionId,
  worldDefinitionId,
  worldTemplateId,
} from "./world.js";

const ROLES: Record<WorldRole, FakeEmbeddedRole> = {
  admin: { isCustomerMarketplaceUser: false, isCustomerMarketplaceAdmin: true },
  user: { isCustomerMarketplaceUser: true, isCustomerMarketplaceAdmin: false },
};

const allowed = { allowed: true as const, reason: null };
const restricted = { allowed: false as const, reason: "role-restricted" };

const upgradeTarget = (
  integrations: readonly ResolvedIntegration[],
  integration: ResolvedIntegration,
): FakeUpgradeTarget | null => {
  const target = integrations.find(({ id }) => id === integration.upgradeTo);
  return target
    ? {
        integrationId: target.id,
        versionNumber: target.versionNumber,
        configurationVersion: target.configurationVersion,
      }
    : null;
};

/** Options by platform id; the fake offers only those its connection store serves. */
const requirementsOf = (
  connections: readonly WorldConnection[],
  requirements: readonly WorldConnectionRequirement[],
): FakeConnectionRequirement[] =>
  requirements.map(({ key, options, template }) => ({
    key,
    options: options.flatMap((name) => {
      const connection = connections.find(
        (candidate) => candidate.name === name,
      );
      return connection ? [worldConnectionId(connection)] : [];
    }),
    ...(template
      ? {
          template: {
            id: worldTemplateId(template),
            oauth2Type: template.oauth2Type,
          },
        }
      : {}),
  }));

/** What the frame serves a customer: org-activated kinds never get here. */
const SERVED: Partial<
  Record<
    WorldConnection["kind"],
    {
      kind: ConnectionKind;
      managedBy: ConnectionManagedBy;
      scope: ConnectionScope;
    }
  >
> = {
  customerActivated: {
    kind: "customerActivated",
    managedBy: "customer",
    scope: "customer",
  },
  manualCustomerActivated: {
    kind: "manualCustomerActivated",
    managedBy: "customer",
    scope: "customer",
  },
  userActivated: { kind: "userActivated", managedBy: "user", scope: "user" },
  userLevel: { kind: "userLevel", managedBy: "user", scope: "user" },
};

const connectionState = (connection: WorldConnection): ConnectionState[] => {
  const served = SERVED[connection.kind];
  if (!served) return [];
  const component = connection.componentKey;
  const id = worldConnectionId(connection);
  return [
    fakeConnectionState({
      id,
      kind: served.kind,
      label: connection.label,
      definition: {
        id:
          connection.kind === "manualCustomerActivated"
            ? id
            : worldDefinitionId(connection),
        stableKey: connection.definition,
      },
      status: connection.status,
      managedBy: served.managedBy,
      variableScope: served.scope,
      component: { key: component, label: component, iconUrl: null },
      connection: {
        key: component,
        label: component,
        oauth2Type: connection.oauth2Type ?? null,
        iconUrl: null,
      },
    }),
  ];
};

const configurationSeed = (
  integrations: readonly ResolvedIntegration[],
  integration: ResolvedIntegration,
  connections: readonly WorldConnection[],
): FakeConfigurationSeed => ({
  name: integration.name,
  configurationExperience: integration.configurationExperience,
  schema: integration.schema,
  configurationVersion: integration.configurationVersion,
  versionNumber: integration.versionNumber,
  upgradeTarget: upgradeTarget(integrations, integration),
  init: () => integration.initResult,
  connectionOptions: () => ({
    init: requirementsOf(connections, integration.initConnections),
    serverFunctions: Object.fromEntries(
      integration.serverFunctions.map((fn) => [
        fn.key,
        requirementsOf(connections, fn.connections ?? []),
      ]),
    ),
  }),
  serverFunctions: integration.serverFunctions.map((fn) => ({
    key: fn.key,
    label: fn.label,
    description: null,
    inputSchema: null,
    outputSchema: null,
    permission: allowed,
    ...(fn.invalidInputs
      ? {
          error: {
            name: "Error",
            code: "PRISMATIC_CONFIGURATION_INVALID" as const,
            message: fn.invalidInputs,
          },
        }
      : {}),
    execute: ({ inputs }) => fn.execute?.(inputs) ?? null,
  })),
});

/** The world as fake-frame stores. Only listed versions reach the marketplace. */
export const toFakeStores = (world: World): FakeStores => {
  const integrations = world.integrations.map(resolveIntegration);
  const byId = new Map(integrations.map((i) => [i.id, i]));
  const roles = new Map(
    world.users.map(({ principal, role }) => [principal, ROLES[role]]),
  );
  const instances = (world.instances ?? []).map((seed): InstanceRecord => {
    const instance = resolveInstance(seed);
    const integration = byId.get(instance.integrationId);
    if (!integration)
      throw new Error(`Unknown integration: ${instance.integrationId}`);
    return {
      ...fakeInstanceState({
        id: instance.id,
        integrationId: instance.integrationId,
        name: instance.name,
        integrationVersionNumber: integration.versionNumber,
        deployed: instance.deployed,
        enabled: instance.enabled,
        lastDeployedAt: instance.lastDeployedAt,
        configState: instance.deployed
          ? "FULLY_CONFIGURED"
          : "NEEDS_INSTANCE_CONFIGURATION",
        flows: instance.flows.map((flow) => ({
          id: flow.id,
          name: flow.name,
          stableId: null,
          webhookUrl: flow.webhookUrl,
          apiKeys: [...flow.apiKeys],
          endpointSecurityType: flow.endpointSecurityType,
          permissions: {
            updateApiKeys:
              instance.updatable && flow.updatable ? allowed : restricted,
          },
        })),
        permissions: {
          updateDetails: instance.updatable ? allowed : restricted,
        },
      }),
      value: instance.value,
      customerUpgradeable: instance.upgradeable,
      deployedVersion: instance.deployed ? integration.versionNumber : null,
      deployedConfigurationVersion: instance.deployed
        ? integration.configurationVersion
        : null,
    };
  });
  let n = 0;
  return {
    connections: new FakeCollection(
      (world.connections ?? []).flatMap(connectionState),
    ),
    integrations: new FakeCollection(
      integrations
        .filter(({ listed }) => listed)
        .map((integration) =>
          fakeIntegrationState({
            id: integration.id,
            name: integration.name,
            category: integration.category,
            description: integration.description,
            labels: [...integration.labels],
            versionNumber: integration.versionNumber,
            allowMultipleInstances: integration.allowMultipleInstances,
            isCustomerDeployable: integration.isCustomerDeployable,
            marketplaceConfiguration: integration.marketplaceConfiguration,
            availability: integration.marketplaceConfiguration,
            userLevelConfigured:
              integration.userConfigurationSchema !== undefined,
            configurationExperience: integration.configurationExperience,
          }),
        ),
    ),
    instances: new FakeCollection(instances),
    configurations: Object.fromEntries(
      integrations.map((integration) => [
        integration.id,
        configurationSeed(integrations, integration, world.connections ?? []),
      ]),
    ),
    userConfigurations: Object.fromEntries(
      integrations.flatMap((integration) =>
        integration.userConfigurationSchema === undefined
          ? []
          : [
              [
                integration.id,
                {
                  schema: integration.userConfigurationSchema,
                } satisfies FakeUserConfigurationSeed,
              ],
            ],
      ),
    ),
    userConfigurationRecords: new FakeCollection(),
    templates: [],
    connectionTemplates: Object.fromEntries(
      integrations
        .flatMap((integration) => [
          ...integration.initConnections,
          ...integration.serverFunctions.flatMap((fn) => fn.connections ?? []),
        ])
        .flatMap(({ template }) =>
          template
            ? [
                [
                  worldTemplateId(template),
                  {
                    label: template.definition,
                    oauth2Type: template.oauth2Type,
                    ...(template.connectsAs
                      ? { connectsAs: template.connectsAs }
                      : {}),
                  },
                ],
              ]
            : [],
        ),
    ),
    connectionOwners: Object.fromEntries(
      (world.connections ?? []).flatMap((connection) =>
        connection.owner
          ? [[worldConnectionId(connection), connection.owner]]
          : [],
      ),
    ),
    connectionPollMs: 20,
    nextId: (prefix) => `${prefix}-${++n}`,
    roleOf: (principal) => {
      const role = roles.get(principal);
      if (!role) throw new Error(`Unknown principal: ${principal}`);
      return role;
    },
  };
};
