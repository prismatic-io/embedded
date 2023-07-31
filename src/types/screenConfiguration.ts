export type TriggerDetails = "default" | "default-open" | "hidden";

export interface InstanceScreenConfiguration {
  hideBackToMarketplace?: boolean;
  hideTabs?: Array<"Test" | "Executions" | "Monitors" | "Logs">;
}

export interface MarketplaceConfiguration {
  configuration?: "allow-details" | "always-show-details" | "disallow-details";
  /**
   * Include all active Integrations including those activated outside the Marketplace.
   * @default true
   * @deprecated Use marketplace filters instead, this will be removed in the next major version (v2.0.0)
   */
  includeActiveIntegrations?: boolean;
}

export interface InitializingConfiguration {
  /** The background color of the loading screen */
  background: string;
  /** The font color of the loading screen text and loading icon */
  color: string;
}

export interface ConfigurationWizardConfiguration {
  hideSidebar?: boolean;
  isInModal?: boolean;
  triggerDetailsConfiguration?: TriggerDetails;
}

export interface DashboardScreenConfiguration {
  hideTabs?: Array<
    | "Attachments"
    | "Components"
    | "Executions"
    | "Instances"
    | "Integrations"
    | "Logs"
    | "Marketplace"
  >;
}

export interface ScreenConfiguration {
  configurationWizard?: ConfigurationWizardConfiguration;
  dashboard?: DashboardScreenConfiguration;
  initializing?: InitializingConfiguration;
  instance?: InstanceScreenConfiguration;
  marketplace?: MarketplaceConfiguration;
}
