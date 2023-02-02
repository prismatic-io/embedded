type TriggerDetails = "default" | "default-open" | "hidden";

interface InstanceScreenConfiguration {
  hideBackToMarketplace?: boolean;
  hideTabs?: Array<"Test" | "Executions" | "Monitors" | "Logs">;
}

interface MarketplaceConfiguration {
  configuration: "allow-details" | "always-show-details" | "disallow-details";
  /** Include all active Integrations including those activated outside the Marketplace. */
  includeActiveIntegrations?: boolean;
}

interface InitializingConfiguration {
  /** The background color of the loading screen */
  background: string;
  /** The font color of the loading screen text and loading icon */
  color: string;
}

interface ConfigurationWizardConfiguration {
  hideSidebar?: boolean;
  isInModal?: boolean;
  triggerDetailsConfiguration?: TriggerDetails;
}

export interface ScreenConfiguration {
  configurationWizard?: ConfigurationWizardConfiguration;
  initializing?: InitializingConfiguration;
  instance?: InstanceScreenConfiguration;
  marketplace?: MarketplaceConfiguration;
}
