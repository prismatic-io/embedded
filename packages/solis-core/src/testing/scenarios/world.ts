/**
 * Backend state a scenario starts from, described once and translated per runner: into
 * fake-frame stores, or into the rows a scripted GraphQL backend serves the real frame.
 * Nothing here names a runner's internals, so a scenario reads the same against both.
 */

import type { JsonSchema } from "../../protocol/index.js";

/** `admin` is a customer marketplace admin, `user` a customer marketplace user. */
export type WorldRole = "admin" | "user";

export interface WorldUser {
  principal: string;
  role: WorldRole;
}

export interface WorldServerFunction {
  key: string;
  label: string;
  /** Computes the result from the invocation inputs. */
  execute?: (inputs: unknown) => unknown;
  /** Makes every invocation fail validation with this message. */
  invalidInputs?: string;
  /** Connections the function needs. */
  connections?: readonly WorldConnectionRequirement[];
}

/** A connection a caller needs, and the {@link WorldConnection} names that could fill it. */
export interface WorldConnectionRequirement {
  key: string;
  options: readonly string[];
  /** The customer-activated connection behind it, which new credentials are made from. */
  template?: WorldConnectionTemplate;
}

export interface WorldConnectionTemplate {
  /** Its stable key; {@link worldTemplateId} derives the platform id from it. */
  definition: string;
  oauth2Type: WorldOAuth2Type;
  /**
   * Whether a client-credentials credential made from it connects as it's saved. Defaults
   * to `ACTIVE`; `FAILED` is the provider refusing, which fails the save but keeps the
   * credential.
   */
  connectsAs?: "ACTIVE" | "FAILED";
}

export type WorldOAuth2Type =
  | "authorization_code"
  | "client_credentials"
  | null;

/**
 * Who activates a connection. The organization's kinds exist on the platform, but a
 * customer is never served them. `userLevel` is a user's own credential for a connection an
 * instance's user-level configuration needs.
 */
export type WorldConnectionKind =
  | "customerActivated"
  | "manualCustomerActivated"
  | "userActivated"
  | "userLevel"
  | "orgActivatedCustomer"
  | "orgActivatedGlobal";

export type WorldConnectionStatus = "ACTIVE" | "PENDING" | "ERROR" | "FAILED";

/** A credential on the platform, as its owner named it. */
export interface WorldConnection {
  /** Unique within the world; {@link worldConnectionId} derives the platform id from it. */
  name: string;
  kind: WorldConnectionKind;
  label: string;
  status: WorldConnectionStatus;
  componentKey: string;
  /** Defaults to `null`: not OAuth. */
  oauth2Type?: WorldOAuth2Type;
  /** Stable key of the connection the author declared, shared by its credentials. */
  definition: string;
  /** Whose personal connection a `userActivated` or `userLevel` one is. */
  owner?: string;
  /** The instance a `userLevel` one belongs to. */
  instanceId?: string;
}

const CUSTOMER_CREDENTIAL_KINDS: readonly WorldConnectionKind[] = [
  "customerActivated",
  "orgActivatedCustomer",
];

/** The typename the platform encodes in a connection's id. */
export const worldConnectionTypename = ({ kind }: WorldConnection) =>
  kind === "userLevel"
    ? "UserLevelConfigVariable"
    : CUSTOMER_CREDENTIAL_KINDS.includes(kind)
      ? "CustomerConfigVariable"
      : "ScopedConfigVariable";

/** A Relay-style id: the platform tells credential kinds apart by its typename. */
export const worldConnectionId = (connection: WorldConnection) =>
  btoa(`${worldConnectionTypename(connection)}:${connection.name}`);

/** The id of a customer-activated connection credentials are made from. */
export const worldTemplateId = ({ definition }: WorldConnectionTemplate) =>
  btoa(`ScopedConfigVariable:${definition}`);

/** The id of the connection definition a credential belongs to. */
export const worldDefinitionId = ({ definition }: WorldConnection) =>
  btoa(`ScopedConfigVariable:${definition}`);

export interface WorldIntegration {
  id: string;
  name: string;
  category?: string | null;
  labels?: readonly string[];
  description?: string | null;
  versionNumber?: number;
  allowMultipleInstances?: boolean;
  isCustomerDeployable?: boolean;
  marketplaceConfiguration?:
    | "AVAILABLE_AND_DEPLOYABLE"
    | "AVAILABLE_NOT_DEPLOYABLE"
    | "NOT_AVAILABLE_IN_MARKETPLACE";
  /** `"hosted"` for config pages: the version defines no Spectral configuration. */
  configurationExperience?: "headless" | "hosted";
  /** `false` for an older version: it backs instances but the marketplace lists its successor. */
  listed?: boolean;
  schema?: JsonSchema;
  configurationVersion?: string;
  userConfigurationSchema?: JsonSchema;
  serverFunctions?: readonly WorldServerFunction[];
  /** What the author's configuration init returns. */
  initResult?: unknown;
  /** Id of the version the marketplace offers as this one's upgrade. */
  upgradeTo?: string;
  initConnections?: readonly WorldConnectionRequirement[];
}

export interface WorldFlow {
  id: string;
  name: string;
  apiKeys?: readonly string[];
  updatable?: boolean;
}

export interface WorldInstance {
  id: string;
  name: string;
  integrationId: string;
  /** Defaults to true; `false` is a never-deployed instance. */
  deployed?: boolean;
  /** Defaults to `deployed`. */
  enabled?: boolean;
  value?: unknown;
  flows?: readonly WorldFlow[];
  updatable?: boolean;
  /** Whether the organization lets the customer move it to a newer version. Defaults to true. */
  upgradeable?: boolean;
}

/** Instances are listed in creation order, oldest first. */
export interface World {
  users: readonly WorldUser[];
  integrations: readonly WorldIntegration[];
  instances?: readonly WorldInstance[];
  connections?: readonly WorldConnection[];
}

export type ResolvedIntegration = Required<
  Omit<WorldIntegration, "upgradeTo" | "userConfigurationSchema">
> &
  Pick<WorldIntegration, "upgradeTo" | "userConfigurationSchema">;

export type ResolvedFlow = Required<WorldFlow> & {
  webhookUrl: string;
  endpointSecurityType: string;
};

export type ResolvedInstance = Required<
  Omit<WorldInstance, "value" | "flows">
> & {
  value: unknown;
  flows: readonly ResolvedFlow[];
  lastDeployedAt: string | null;
};

export const DEPLOYED_AT = "2026-01-01T00:00:00Z";

export const resolveIntegration = (
  integration: WorldIntegration,
): ResolvedIntegration => ({
  category: null,
  labels: [],
  description: null,
  versionNumber: 1,
  allowMultipleInstances: false,
  isCustomerDeployable: true,
  marketplaceConfiguration: "AVAILABLE_AND_DEPLOYABLE",
  listed: true,
  configurationExperience: "headless",
  schema: {},
  configurationVersion: "1",
  serverFunctions: [],
  initResult: null,
  initConnections: [],
  ...integration,
});

export const resolveInstance = (instance: WorldInstance): ResolvedInstance => {
  const deployed = instance.deployed ?? true;
  return {
    enabled: deployed,
    updatable: true,
    upgradeable: true,
    value: undefined,
    ...instance,
    deployed,
    lastDeployedAt: deployed ? DEPLOYED_AT : null,
    flows: (instance.flows ?? []).map((flow) => ({
      apiKeys: [],
      updatable: true,
      ...flow,
      webhookUrl: `https://hooks.example.test/${instance.id}/${flow.id}`,
      endpointSecurityType: "CUSTOMER_OPTIONAL",
    })),
  };
};

/** Every version sharing an upgrade edge with this one, oldest first. */
export const versionFamily = (
  integrations: readonly ResolvedIntegration[],
  integration: ResolvedIntegration,
): ResolvedIntegration[] =>
  integrations
    .filter(
      (candidate) =>
        candidate.id === integration.id ||
        candidate.id === integration.upgradeTo ||
        candidate.upgradeTo === integration.id,
    )
    .sort((a, b) => a.versionNumber - b.versionNumber);
