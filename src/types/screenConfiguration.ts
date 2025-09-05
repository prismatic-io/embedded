export type TriggerDetails = "default" | "default-open" | "hidden";

export interface InstanceScreenConfiguration {
  hideBackToMarketplace?: boolean;
  hideTabs?: Array<"Test" | "Executions" | "Logs">;
  hidePauseButton?: boolean;
}

export interface ConfigureInstanceScreenConfiguration {
  configuration?: "allow-details" | "always-show-details" | "disallow-details";
}

export interface MarketplaceConfiguration {
  configuration?: "allow-details" | "always-show-details" | "disallow-details";
  hideSearch?: boolean;
  hideActiveIntegrationsFilter?: boolean;
}

export interface WorkflowsConfiguration {
  includeIntegrations?: boolean;
}

export interface InitializingConfiguration {
  /** The background color of the loading screen */
  background: string;
  /** The font color of the loading screen text and loading icon */
  color: string;
}

export interface ConfigurationWizardConfiguration {
  mode?: "streamlined" | "traditional";
  /**
   * Defines how customer-activated connections will be configured in the configuration wizard.
   * `inline` is the legacy way where inputs are inline in the config page
   * `reusable` means the user can choose from their credentials for that customer-activated connection in a way that the connection can also be reused in other instances
   * @default "reusable"
   */
  connectionConfiguration?: "inline" | "reusable";
  hideSidebar?: boolean;
  isInModal?: boolean;
  triggerDetailsConfiguration?: TriggerDetails;
  /**
   * Disable logs on integrations deployed via marketplace
   * @default "never"
   */
  logsDisabled?: "always" | "never" | "optional";
  /**
   * Disable step results on integrations deployed via marketplace
   * @default "never"
   */
  stepResultsDisabled?: "always" | "never" | "optional";
}

export interface DashboardScreenConfiguration {
  hideTabs?: Array<
    | "Attachments"
    | "Components"
    | "Credentials"
    | "Executions"
    | "Instances"
    | "Integrations"
    | "Logs"
    | "Marketplace"
  >;
}

export interface ScreenConfiguration {
  configurationWizard?: ConfigurationWizardConfiguration;
  configureInstance?: ConfigureInstanceScreenConfiguration;
  dashboard?: DashboardScreenConfiguration;
  initializing?: InitializingConfiguration;
  instance?: InstanceScreenConfiguration;
  marketplace?: MarketplaceConfiguration;
  workflows?: WorkflowsConfiguration;
  isInPopover?: boolean;
}
