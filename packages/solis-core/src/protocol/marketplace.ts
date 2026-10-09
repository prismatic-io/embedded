/** The marketplace: integrations a customer can browse and deploy. */

import type {
  ConfigurationFlow,
  CreateInstanceInput,
  Instance,
} from "./configuration.js";
import type { ConditionalExpression } from "./filters.js";
import type { Permission } from "./permissions.js";

export type MarketplaceAvailability =
  | "AVAILABLE_AND_DEPLOYABLE"
  | "AVAILABLE_NOT_DEPLOYABLE"
  | "NOT_AVAILABLE_IN_MARKETPLACE";

export type CreateInstancePermissionReason =
  | "MARKETPLACE_USER"
  | "INSTANCE_EXISTS"
  | "NOT_CUSTOMER_DEPLOYABLE"
  | "NOT_DEPLOYABLE"
  | "INSTANCES_UNAVAILABLE"
  | (string & {});

export type CreateInstancePermission =
  Permission<CreateInstancePermissionReason>;

/**
 * How an integration version is configured: `"headless"` when it defines a Spectral
 * configuration the host renders itself, `"hosted"` when it uses config pages or is low-code
 * and configures through Prismatic's wizard.
 */
export type ConfigurationExperience = "headless" | "hosted";

export interface MarketplaceIntegrationPermissions {
  createInstance: CreateInstancePermission;
}

export interface InstancesUnavailableError {
  code: "PRISMATIC_INSTANCES_UNAVAILABLE";
  message: string;
}

/** One emission from {@link MarketplaceIntegrationTarget.state}: the listing as plain data. */
export interface MarketplaceIntegrationState {
  permissions: MarketplaceIntegrationPermissions;
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  avatarUrl: string | null;
  versionNumber: number;
  availability: MarketplaceAvailability;
  marketplaceConfiguration: string;
  marketplaceAvailableVersion: {
    id: string;
    marketplaceConfiguration: string;
  } | null;
  /**
   * The experience of the latest marketplace version, for badges and filters before an
   * instance exists. Route an open configuration by the version actually being configured.
   */
  configurationExperience: ConfigurationExperience;
  /** Flows of the offered marketplace version, not necessarily the instance's version. */
  flows: readonly ConfigurationFlow[];
  /** When `false`, `createInstance()` rejects once one instance exists. */
  allowMultipleInstances: boolean;
  isCustomerDeployable: boolean;
  /** Whether the listing declares user-level configuration. */
  userLevelConfigured: boolean;
  /**
   * The caller's instances of this integration, on any of its versions and never-deployed
   * ones included, newest first. {@link MarketplaceIntegrationTarget.instances} hands out
   * their stubs.
   */
  instances: readonly { id: string }[];
  /**
   * Why {@link instances} could not be read, which leaves it empty; `null` when it was. The
   * listing still loads. Reading the listing again, or changing an instance through this
   * session, reads them again. While it is set, `createInstance` is denied with
   * `INSTANCES_UNAVAILABLE` wherever an existing instance would decide it.
   */
  instancesError: InstancesUnavailableError | null;
  /** Long-form marketplace copy, typically markdown. */
  overview: string | null;
  labels: string[];
  customer: {
    id: string;
    name: string;
    avatarUrl: string | null;
  } | null;
}

/**
 * Live reference to one marketplace integration, as returned by
 * {@link MarketplaceApi.list} and {@link MarketplaceApi.get}.
 *
 * The host must dispose stubs it holds (`using`, or `stub[Symbol.dispose]()`) so the
 * frame can drop its export-table entry — including every stub inside a list page.
 */
export interface MarketplaceIntegrationTarget {
  /**
   * The listing's readable properties, emitted on subscribe and again on every change
   * until the stream is cancelled.
   *
   * A value reflects the server as of this session's last interaction: the frame emits
   * after its own mutations, not on a timer.
   */
  state(): ReadableStream<MarketplaceIntegrationState>;
  /**
   * Stubs for the instances in the latest `state()`, in its order. They come from the read
   * that produced that state, so this costs no request of its own.
   */
  instances(): Promise<Instance[]>;
  /**
   * Creates a never-deployed instance. Rejects on a listing that does not
   * `allowMultipleInstances` and already has one, deployed or not; read the mode from
   * `state()` first.
   */
  createInstance(input: CreateInstanceInput): Promise<Instance>;
}

export interface MarketplaceOrdering {
  field:
    | "CATEGORY"
    | "CREATED_AT"
    | "CUSTOMER"
    | "DESCRIPTION"
    | "NAME"
    | "PUBLISHED_AT"
    | "UPDATED_AT"
    | "VERSION_NUMBER";
  direction: "ASC" | "DESC";
}

export interface ListIntegrationsInput {
  searchTerm?: string;
  category?: string;
  label?: string;
  filterQuery?: ConditionalExpression;
  includeActiveIntegrations?: boolean;
  /** Require every `filterQuery` term to match rather than any. */
  strictMatchFilterQuery?: boolean;
  /** Restrict to activated (`true`) or inactive (`false`) integrations. */
  activated?: boolean;
  /** Defaults to CATEGORY ASC, NAME ASC when omitted or empty. */
  ordering?: readonly MarketplaceOrdering[];
  limit?: number;
  cursor?: string;
}

export interface MarketplaceListPage {
  readonly integrations: MarketplaceIntegrationTarget[];
  readonly pageInfo: {
    endCursor: string | null;
    hasNextPage: boolean;
  };
}

/** Distinct values across the visible marketplace, for filter UIs. */
export interface MarketplaceFilterOptions {
  readonly categories: string[];
  readonly labels: string[];
}

export interface MarketplaceApi {
  /** Paginated marketplace listings. Returns stubs, not data. */
  list(input?: ListIntegrationsInput): Promise<MarketplaceListPage>;
  /** Lookup by integration id, for deep-linked host routes. */
  get(integrationId: string): Promise<MarketplaceIntegrationTarget>;
  /** Categories and labels from one walk of the marketplace. Gated by `marketplace.filterOptions`. */
  filterOptions(): Promise<MarketplaceFilterOptions>;
}
