/** The cache's key vocabulary. Exact keys address one entry; families address invalidation. */

import { stableKey } from "./input.js";

/**
 * Every cached read's key. Called with no arguments each returns the prefix covering its
 * whole family, so `keys.instances()` reaches every instance list regardless of filter —
 * which is what a create or delete needs, since it changes membership of
 * lists it never read.
 */
export const keys = {
  marketplace: (input?: unknown) =>
    input === undefined ? "marketplace/" : `marketplace/${stableKey(input)}`,
  integration: (id?: string) =>
    id === undefined ? "integration/" : `integration/${id}`,
  connections: (filter?: unknown) =>
    filter === undefined ? "connections/" : `connections/${stableKey(filter)}`,
  connection: (id?: string) =>
    id === undefined ? "connection/" : `connection/${id}`,
  instances: (input?: unknown) =>
    input === undefined ? "instances/" : `instances/${stableKey(input)}`,
  instance: (id?: string) =>
    id === undefined ? "instance/" : `instance/${id}`,
  /** With only an instance, the prefix covering every version's configuration of it. */
  configuration: (
    instanceId?: string,
    version?: { integrationVersionId?: string },
  ) =>
    instanceId === undefined
      ? "configuration/"
      : version === undefined
        ? `configuration/${instanceId}/`
        : `configuration/${instanceId}/${version.integrationVersionId ?? "current"}`,
  userConfiguration: (instanceId?: string) =>
    instanceId === undefined
      ? "user-configuration/"
      : `user-configuration/${instanceId}`,
  /**
   * A configuration's connection choices, for the version it showed when they loaded.
   * Without a version, the prefix covering every version's choices of that configuration.
   */
  configurationConnections: (owner: string, integrationId?: string) =>
    integrationId === undefined
      ? `connections-of/${owner.endsWith("/") ? owner : `${owner}/`}`
      : `connections-of/${owner}/${integrationId}`,
  authenticatedUser: () => "authenticatedUser/",
  marketplaceFilterOptions: () => "marketplace-filter-options/",
} as const;
