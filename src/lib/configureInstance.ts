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

  const updatedOptions = skipRedirectOnRemove
    ? {
        ...options,
        screenConfiguration: {
          ...options.screenConfiguration,
          instance: {
            ...options.screenConfiguration?.instance,
            skipRedirectOnRemove: true,
          },
        },
      }
    : { ...options };

  setIframe("find-integration-marketplace", updatedOptions, {
    integrationName,
  });
};
