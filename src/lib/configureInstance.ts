import { Options } from "../types/options";
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

export const isConfigureInstanceWithInstanceId = (
  props: ConfigureInstanceProps
): props is ConfigureInstanceWithInstanceId => {
  return Boolean("instanceId" in props && props.instanceId);
};

export const isConfigureInstanceWithIntegrationId = (
  props: ConfigureInstanceProps
): props is ConfigureInstanceWithIntegrationId => {
  return Boolean("integrationId" in props && props.integrationId);
};

export const isConfigureInstanceWithIntegrationName = (
  props: ConfigureInstanceProps
): props is ConfigureInstanceWithIntegrationName => {
  return Boolean("integrationName" in props && props.integrationName);
};
