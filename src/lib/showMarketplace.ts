import {
  ConfigurationWizardConfiguration,
  InstanceScreenConfiguration,
  MarketplaceConfiguration,
  MarketplaceFilters,
} from "../types";
import { Options } from "../types/options";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

interface ShowMarketplaceDefaults {
  filters: {
    marketplace: MarketplaceFilters;
  };
  screenConfiguration: {
    configurationWizard: ConfigurationWizardConfiguration;
    instance: InstanceScreenConfiguration;
    marketplace: MarketplaceConfiguration;
  };
}

export const showMarketplaceDefaults: ShowMarketplaceDefaults = {
  filters: {
    marketplace: {
      includeActiveIntegrations: true,
    },
  },
  screenConfiguration: {
    configurationWizard: {},
    instance: {},
    marketplace: {},
  },
};

export type ShowMarketplaceProps = Options & {};

export const showMarketplace = (
  options: ShowMarketplaceProps = { usePopover: true }
) => {
  assertInit("showMarketplace");

  setIframe("integration-marketplace", options, {});
};
