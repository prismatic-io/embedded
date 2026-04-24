export type TriggerDetails = "default" | "default-open" | "hidden";

export interface InstanceScreenConfiguration {
  hideBackToMarketplace?: boolean;
  hideTabs?: Array<"Test" | "Executions" | "Logs">;
  hidePauseButton?: boolean;
  hideDeactivation?: boolean;
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

export type CopilotChatVisibility = "open" | "hide";

export interface CopilotConfiguration {
  /**
   * Controls the initial state of the workflow builder copilot chat panel when
   * the builder is presented.
   * - `hide` (default): the copilot button is shown, the panel is collapsed
   *   until the user opens it.
   * - `open`: the copilot panel is expanded on load.
   *
   * Only takes effect when the copilot is enabled for the organization and customer.
   *
   * @default "hide"
   */
  initialChatVisibility?: CopilotChatVisibility;
}

export interface WorkflowBuilderConfiguration {
  copilot?: CopilotConfiguration;
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

export interface DesignerConfiguration {
  hideInstances?: boolean;
  hideMarketplace?: boolean;
  hideRemoveIntegration?: boolean;
}

export interface ScreenConfiguration {
  configurationWizard?: ConfigurationWizardConfiguration;
  configureInstance?: ConfigureInstanceScreenConfiguration;
  dashboard?: DashboardScreenConfiguration;
  designer?: DesignerConfiguration;
  initializing?: InitializingConfiguration;
  instance?: InstanceScreenConfiguration;
  marketplace?: MarketplaceConfiguration;
  workflowBuilder?: WorkflowBuilderConfiguration;
  workflows?: WorkflowsConfiguration;
  isInPopover?: boolean;
}
