import { Options } from "../types/options";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

export type ShowMarketplaceProps = Options & {};

export const showMarketplace = (options: ShowMarketplaceProps) => {
  assertInit("showMarketplace");

  setIframe(
    "integration-marketplace",
    {
      ...options,
      screenConfiguration: {
        ...options.screenConfiguration,
        marketplace: {
          includeActiveIntegrations: true,
          ...options.screenConfiguration?.marketplace,
        },
      },
    },
    {}
  );
};
