import { Options } from "../types";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

type ConfigureIntegrationProps = Options & {
  integrationName: string;
  skipRedirectOnRemove?: boolean;
};

export const configureIntegration = ({
  integrationName,
  skipRedirectOnRemove,
  ...options
}: ConfigureIntegrationProps) => {
  assertInit("configureInstance");

  setIframe("find-integration-marketplace", options, {
    integrationName,
    ...(skipRedirectOnRemove ? { skipRedirectOnRemove: "true" } : {}),
  });
};
