import type { Options } from "../types/options";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

type ConfigureInstancesBase = Options & {
  skipRedirectOnRemove: boolean;
};

export type ConfigureInstanceWithIntegrationName = ConfigureInstancesBase & {
  integrationName: string;
};

export type ConfigureInstanceWithIntegrationId = ConfigureInstancesBase & {
  integrationId: string;
};

export type ConfigureInstanceWithInstanceId = ConfigureInstancesBase & {
  instanceId: string;
};

export type ConfigureInstanceProps =
  | ConfigureInstanceWithIntegrationName
  | ConfigureInstanceWithIntegrationId
  | ConfigureInstanceWithInstanceId;

/**
 * Opens the configuration wizard for an integration, allowing a customer user
 * to activate and configure an instance. You can identify the target by
 * `integrationName`, `integrationId`, or `instanceId`.
 *
 * - Use `integrationName` to let a customer activate a new instance of a
 *   marketplace integration by its display name.
 * - Use `integrationId` to target a specific integration version.
 * - Use `instanceId` to reconfigure an already-deployed instance.
 *
 * @param props - Configuration options. Exactly one of `integrationName`, `integrationId`, or `instanceId` is required.
 * @param props.skipRedirectOnRemove - When `true`, prevents redirecting to the marketplace after the instance is removed.
 *
 * @example
 * // Configure by integration name (most common)
 * prismatic.configureInstance({
 *   integrationName: "Salesforce",
 *   usePopover: true,
 *   skipRedirectOnRemove: false,
 * });
 *
 * @example
 * // Reconfigure an existing instance inline
 * prismatic.configureInstance({
 *   instanceId: "SW5zdGFuY2U6OGE2YjZi...",
 *   selector: "#config-container",
 *   skipRedirectOnRemove: true,
 * });
 *
 * @see {@link https://prismatic.io/docs/embed/marketplace/ | Embedding the Marketplace}
 */
export const configureInstance = ({ ...props }: ConfigureInstanceProps) => {
  assertInit("configureInstance");

  if (isConfigureInstanceWithInstanceId(props)) {
    const { instanceId, skipRedirectOnRemove, ...options } = props;

    return setIframe("/find-integration-marketplace/", options, {
      instanceId,
      ...(skipRedirectOnRemove ? { skipRedirectOnRemove: "true" } : {}),
    });
  }

  if (isConfigureInstanceWithIntegrationId(props)) {
    const { integrationId, skipRedirectOnRemove, ...options } = props;

    return setIframe("/find-integration-marketplace/", options, {
      integrationId,
      ...(skipRedirectOnRemove ? { skipRedirectOnRemove: "true" } : {}),
    });
  }

  if (isConfigureInstanceWithIntegrationName(props)) {
    const { integrationName, skipRedirectOnRemove, ...options } = props;

    setIframe("/find-integration-marketplace/", options, {
      integrationName,
      ...(skipRedirectOnRemove ? { skipRedirectOnRemove: "true" } : {}),
    });
  }
};

/** Type guard that checks whether the props identify a target instance by `instanceId`. */
export const isConfigureInstanceWithInstanceId = (
  props: ConfigureInstanceProps,
): props is ConfigureInstanceWithInstanceId => {
  return Boolean("instanceId" in props && props.instanceId);
};

/** Type guard that checks whether the props identify a target integration by `integrationId`. */
export const isConfigureInstanceWithIntegrationId = (
  props: ConfigureInstanceProps,
): props is ConfigureInstanceWithIntegrationId => {
  return Boolean("integrationId" in props && props.integrationId);
};

/** Type guard that checks whether the props identify a target integration by `integrationName`. */
export const isConfigureInstanceWithIntegrationName = (
  props: ConfigureInstanceProps,
): props is ConfigureInstanceWithIntegrationName => {
  return Boolean("integrationName" in props && props.integrationName);
};
