import { Options } from "../types/options";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

export type ConfigureInstanceProps = Options & {
  integrationName: string;
  skipRedirectOnRemove?: boolean;
};

export const configureInstance = ({
  integrationName,
  skipRedirectOnRemove,
  ...options
}: ConfigureInstanceProps) => {
  assertInit("configureInstance");

  setIframe("find-integration-marketplace", options, {
    integrationName,
    ...(skipRedirectOnRemove ? { skipRedirectOnRemove: "true" } : {}),
  });
};
