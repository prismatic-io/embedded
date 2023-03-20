export type SimplePhrase = string;

export type ComplexPhrase<
  T extends Record<string, string | boolean | number> = Record<
    string,
    string | boolean | number
  >
> = T & {
  _?: string;
};

export enum PhraseNamespace {
  COMPONENTS = "components",
  INTEGRATIONS = "integrations",
  MARKETPLACE = "integration-marketplace",
  MARKETPLACE_INTEGRATION_ALERT_MONITORS = "integrations.id.alert-monitors",
  MARKETPLACE_INTEGRATION_CONFIGURATION = "integrations.id.configurations",
  MARKETPLACE_INTEGRATION_EXECUTIONS = "integrations.id.executions",
  MARKETPLACE_INTEGRATION_LOGS = "integrations.id.logs",
  MARKETPLACE_INTEGRATION_SUMMARY = "integrations.id",
  MARKETPLACE_INTEGRATION_TEST = "integrations.id.test",
  MARKETPLACE_NOT_FOUND = "app.marketplace-not-found",
}

interface SharedPhrases {
  // common
  /** English: "Don’t see an action you’re looking for?" */
  "common.contactUsText": SimplePhrase;

  /** English: "Contact us" */
  "common.contactUsButton": SimplePhrase;

  /** English: "Loading" */
  "common.loading": SimplePhrase;

  /** English: "Saving" */
  "common.saving": SimplePhrase;

  /** English: "You must be authenticated." */
  "common.unauthorized": SimplePhrase;

  /** English: "This version has no publish message" */
  "common.noPublishedMessage": SimplePhrase;

  // dialogs
  /** English: "Remove %{removeType}" */
  "deleteDialog.confirmButton": ComplexPhrase<{ removeType: string }>;

  /** English: "does not match: %{requiredText}" */
  "deleteDialog.confirmRequiredTextValidation": ComplexPhrase<{
    requiredText: string;
  }>;

  /** English: "To confirm please type" */
  "deleteDialog.confirmText": SimplePhrase;

  /** English: "Remove %{removeType}" */
  "deleteDialog.openButton": ComplexPhrase<{ removeType: string }>;

  /** English: "Delete" */
  "deleteDialog.requiredText": SimplePhrase;

  /** English: "Are you sure?" */
  "deleteDialog.title": SimplePhrase;

  /** English: "This action cannot be undone. This will permanently delete %{requiredText} %{removalItems}." */
  "deleteDialog.warningText": ComplexPhrase<{
    requiredText: string;
    removalItems?: string;
  }>;

  /** English: "Details" */
  "webhookUrlDialog.openButton": SimplePhrase;

  /** English: "Webhook URLs" */
  "webhookUrlDialog.title": SimplePhrase;

  /** English: "Remove Integration" */
  "deleteUserConfigurationDialog.confirmButton": SimplePhrase;

  /** English: "Remove User Configuration" */
  "deleteUserConfigurationDialog.confirmButton--isAdmin": SimplePhrase;

  /** English: "Deactivate Integration" */
  "deleteUserConfigurationDialog.confirmButton--isCustomerMarketplaceUser": SimplePhrase;

  /** English: "Delete" */
  "deleteUserConfigurationDialog.openButton": SimplePhrase;

  /** English: "Are you sure?" */
  "deleteUserConfigurationDialog.title": SimplePhrase;

  /** English: "This action cannot be undone. This will permanently delete the integration." */
  "deleteUserConfigurationDialog.warningText": SimplePhrase;

  /** English: "This action cannot be undone. This will permanently delete the configuration for %{email}." */
  "deleteUserConfigurationDialog.warningText--isAdmin": ComplexPhrase<{
    email: string;
  }>;

  /** English: "User Configuration" */
  "deleteUserConfigurationDialog.options.userConfigurationButton": SimplePhrase;

  /** English: "This action cannot be undone. This will deactivate the integration." */
  "deleteUserConfigurationDialog.warningText--isCustomerMarketplaceUser": SimplePhrase;

  /** English: "This will remove all user configurations and deactivate the integration." */
  "deleteUserConfigurationDialog.warningText--hasUserConfiguration": SimplePhrase;

  /** English: "Deactivate Integration" */
  "deactivateIntegrationDialog.confirmButton": SimplePhrase;

  /** English: "Deactivate Integration" */
  "deactivateIntegrationDialog.openButton": SimplePhrase;

  /** English: "Are you sure?" */
  "deactivateIntegrationDialog.title": SimplePhrase;

  /** English: "This will deactivate this integration." */
  "deactivateIntegrationDialog.warningText": SimplePhrase;

  /** English: "Cancel" */
  "configurationWizardDialog.cancelButton": SimplePhrase;

  /** English: "Finish" */
  "configurationWizardDialog.finishButton": SimplePhrase;

  /** English: "Next" */
  "configurationWizardDialog.nextButton": SimplePhrase;

  /** English: "Previous" */
  "configurationWizardDialog.previousButton": SimplePhrase;

  /** English: "Returning to the previous page will discard unsaved changes on this page. Are you sure?" */
  "configurationWizardDialog.previousWarningText": SimplePhrase;

  /** English: "Cancel" */
  "apiKeyDialog.cancelButton": SimplePhrase;

  /** English: "Generate API key" */
  "apiKeyDialog.generateApiKeyButton": SimplePhrase;

  /** English: "This will remove the existing API Key." */
  "apiKeyDialog.text": SimplePhrase;

  /** English: "API key" */
  "apiKeyDialog.title": SimplePhrase;

  /** English: "Update" */
  "apiKeyDialog.updateButton": SimplePhrase;

  /** English: "Please contact %{organization} to configure this integration." */
  "activateIntegrationDialog.banner.text--isNotConfigurable": ComplexPhrase<{
    organization?: string;
  }>;

  /** English: "Cancel" */
  "activateIntegrationDialog.cancelButton": SimplePhrase;

  /** English: "Configure" */
  "activateIntegrationDialog.configureButton": SimplePhrase;

  // filter bar
  /** English: "Integration Marketplace" */
  "filterBar.breadcrumb.integrationMarketplace": SimplePhrase;

  /** English: "Active Integrations" */
  "filterBar.breadcrumb.activeIntegrations": SimplePhrase;

  /** English: "Instances" */
  "filterBar.breadcrumb.instances": SimplePhrase;

  /** English: "Components" */
  "filterBar.breadcrumb.components": SimplePhrase;

  /** English: "Filter" */
  "filterBar.openFiltersButton": SimplePhrase;

  /** English: "Clear filters" */
  "filterBar.clearFiltersButton": SimplePhrase;

  /** English: "Refresh" */
  "filterBar.refreshButton": SimplePhrase;

  /** English: "Auto-polling is only available with default filters." */
  "filterBar.refreshTooltip": SimplePhrase;

  /** English: "[Empty String]" */
  "filterBar.title": SimplePhrase;

  // filter results
  /** English: "[Empty String]" */
  "filterResults.placeholderCta": SimplePhrase;

  /** English: "[Empty String]" */
  "filterResults.placeholderText": SimplePhrase;

  /** English: "[Empty String]" */
  "filterResults.placeholderTitle": SimplePhrase;

  // inputs
  /** English: "Monitor" */
  "input.alertMonitorLabel": SimplePhrase;

  /** English: "Alert Trigger" */
  "input.alertTriggerLabel": SimplePhrase;

  /** English: "Add API key" */
  "input.apiKeyAddButton": SimplePhrase;

  /** English: "API Key" */
  "input.apiKeyLabel": SimplePhrase;

  /** English: "No API key configured" */
  "input.apiKeyPlaceholder": SimplePhrase;

  /** English: "Category" */
  "input.categoryLabel": SimplePhrase;

  /** English: "Edit" */
  "input.codePlaceholder": SimplePhrase;

  /** English: "Confirmation text" */
  "input.confirmRequiredTextLabel": SimplePhrase;

  /** English: "Content type" */
  "input.contentTypeLabel": SimplePhrase;

  /** English: "Customer" */
  "input.customerLabel": SimplePhrase;

  /** English: "There was an error" */
  "input.dateError": SimplePhrase;

  /** English: "There was an error" */
  "input.dateTimeError": SimplePhrase;

  /** English: "Description" */
  "input.descriptionLabel": SimplePhrase;

  /** English: "Default Value" */
  "input.defaultValueLabel": SimplePhrase;

  /** English: "Email" */
  "input.emailLabel": SimplePhrase;

  /** English: "End Date/Time" */
  "input.endDateLabel": SimplePhrase;

  /** English: "External ID" */
  "input.externalIdLabel": SimplePhrase;

  /** English: "Show only failed preprocess flows" */
  "input.failedPreprocessFlowsOnlyLabel": SimplePhrase;

  /** English: "Search %{type}" */
  "input.filterSearchPlaceholder": ComplexPhrase<{ type?: string }>;

  /** English: "Add header" */
  "input.headersAddButton": SimplePhrase;

  /** English: "Key" */
  "input.headersKeyLabel": SimplePhrase;

  /** English: "Headers" */
  "input.headersLabel": SimplePhrase;

  /** English: "Value" */
  "input.headersValueLabel": SimplePhrase;

  /** English: "Include customer components" */
  "input.includeCustomerComponentsLabel": SimplePhrase;

  /** English: "Include customer integrations" */
  "input.includeCustomerIntegrationsLabel": SimplePhrase;

  /** English: "Instance" */
  "input.instanceLabel": SimplePhrase;

  /** English: "Integration" */
  "input.integrationLabel": SimplePhrase;

  /** English: "Integration Version" */
  "input.integrationVersionLabel": SimplePhrase;

  /** English: "Designer Version" */
  "input.integrationVersionLatestLabel": SimplePhrase;

  /** English: "Labels" */
  "input.labelsLabel": SimplePhrase;

  /** English: "Key" */
  "input.keyLabel": SimplePhrase;

  /** English: "Key" */
  "input.keyPlaceholder": SimplePhrase;

  /** English: "Designer Version" */
  "input.latestVersionLabel": SimplePhrase;

  /** English: "Log Severity" */
  "input.logSeverityLabel": SimplePhrase;

  /** English: "Connection Only" */
  "input.logType.integrationConnectionValue": SimplePhrase;

  /** English: "Execution & Connection" */
  "input.logType.integrationExecutionAndConnectionValue": SimplePhrase;

  /** English: "Execution only" */
  "input.logType.integrationExecutionValue": SimplePhrase;

  /** English: "Log Type" */
  "input.logTypeLabel": SimplePhrase;

  /** English: "No options found" */
  "input.noOptionsValue": SimplePhrase;

  /** English: "None" */
  "input.noneValue": SimplePhrase;

  /** English: "Edit" */
  "input.objectFieldMapPlaceholder": SimplePhrase;

  /** English: "Show original executions only" */
  "input.originalOnlyLabel": SimplePhrase;

  /** English: "Payload body" */
  "input.payloadBodyLabel": SimplePhrase;

  /** English: "Post URL" */
  "input.postUrlLabel": SimplePhrase;

  /** English: "Role" */
  "input.roleLabel": SimplePhrase;

  /** English: "Flow Selector" */
  "input.selectFlowLabel": SimplePhrase;

  /** English: "Log severity" */
  "input.severityLabel": SimplePhrase;

  /** English: "Start Date/Time" */
  "input.startDateLabel": SimplePhrase;

  /** English: "Show only private components" */
  "input.showOnlyPrivateComponentsLabel": SimplePhrase;

  /** English: "Show only templates" */
  "input.showOnlyTemplatesLabel": SimplePhrase;

  /** English: "Failed" */
  "input.status.failedValue": SimplePhrase;

  /** English: "Running" */
  "input.status.runningValue": SimplePhrase;

  /** English: "Successful" */
  "input.status.successfulValue": SimplePhrase;

  /** English: "Status" */
  "input.statusLabel": SimplePhrase;

  /** English: "Step" */
  "input.stepLabel": SimplePhrase;

  /** English: "URL" */
  "input.urlLabel": SimplePhrase;

  /** English: "Value" */
  "input.valueLabel": SimplePhrase;

  /** English: "Add a value" */
  "input.valuePlaceholder": SimplePhrase;

  /** English: "Add value" */
  "input.valueAddButton": SimplePhrase;

  // chips
  /** English: "Template" */
  "chip.templateLabel": SimplePhrase;

  /** English: "Private" */
  "chip.privateLabel": SimplePhrase;

  // details
  /** English: "Category" */
  "detail.categoryLabel": SimplePhrase;

  /** English: "Config Variable" */
  "detail.configVariableLabel": SimplePhrase;

  /** English: "Customer" */
  "detail.customerLabel": SimplePhrase;

  /** English: "Description" */
  "detail.descriptionLabel": SimplePhrase;

  /** English: "Execution" */
  "detail.executionLabel": SimplePhrase;

  /** English: "View in Execution Context" */
  "detail.executionText": SimplePhrase;

  /** English: "Instance" */
  "detail.instanceLabel": SimplePhrase;

  /** English: "Integration" */
  "detail.integrationLabel": SimplePhrase;

  /** English: "Labels" */
  "detail.labelsLabel": SimplePhrase;

  /** English: "Last Run" */
  "detail.lastRunLabel": SimplePhrase;

  /** English: "Overview" */
  "detail.overviewLabel": SimplePhrase;

  /** English: "Show more..." */
  "detail.retryButton": SimplePhrase;

  /** English: "Retry" */
  "detail.retryLabel": SimplePhrase;

  /** English: "%{retryCount} retries of %{maxRetryCount} total." */
  "detail.retryValue": ComplexPhrase<{
    retryCount: number;
    maxRetryCount: number;
  }>;

  /** English: "Status" */
  "detail.statusLabel": SimplePhrase;

  /** English: "Paused" */
  "detail.statusPausedValue": SimplePhrase;

  /** English: "Running" */
  "detail.statusRunningValue": SimplePhrase;

  /** English: "Activated but not configured" */
  "detail.statusUnconfiguredValue": SimplePhrase;

  /** English: "Version" */
  "detail.versionLabel": SimplePhrase;

  // data table
  /** English: "Active Instances" */
  "dataTable.activeInstancesLabel": SimplePhrase;

  /** English: "Category" */
  "dataTable.categoryLabel": SimplePhrase;

  /** English: "Connection" */
  "dataTable.connectionLabel": SimplePhrase;

  /** English: "Comments" */
  "dataTable.commentsLabel": SimplePhrase;

  /** English: "Customer" */
  "dataTable.customerLabel": SimplePhrase;

  /** English: "Default" */
  "dataTable.defaultLabel": SimplePhrase;

  /** English: "Description" */
  "dataTable.descriptionLabel": SimplePhrase;

  /** English: "Email" */
  "dataTable.emailLabel": SimplePhrase;

  /** English: "Events" */
  "dataTable.eventsLabel": SimplePhrase;

  /** English: "Example" */
  "dataTable.exampleLabel": SimplePhrase;

  /** English: "Flow" */
  "dataTable.flowLabel": SimplePhrase;

  /** English: "Input" */
  "dataTable.inputLabel": SimplePhrase;

  /** English: "Inputs ${count}" */
  "dataTable.inputsText": ComplexPhrase<{
    count: number;
  }>;

  /** English: "Instance" */
  "dataTable.instanceLabel": SimplePhrase;

  /** English: "Integration" */
  "dataTable.integrationLabel": SimplePhrase;

  /** English: "Labels" */
  "dataTable.labelsLabel": SimplePhrase;

  /** English: "Last triggered" */
  "dataTable.lastTriggeredAtLabel": SimplePhrase;

  /** English: "Message" */
  "dataTable.messageLabel": SimplePhrase;

  /** English: "Name" */
  "dataTable.nameLabel": SimplePhrase;

  /** English: "Required" */
  "dataTable.requiredLabel": SimplePhrase;

  /** English: "Published" */
  "dataTable.publishedLabel": SimplePhrase;

  /** English: "Timestamp" */
  "dataTable.timestampLabel": SimplePhrase;

  /** English: "Triggers" */
  "dataTable.triggersLabel": SimplePhrase;

  /** English: "Type" */
  "dataTable.typeLabel": SimplePhrase;

  /** English: "Version" */
  "dataTable.versionLabel": SimplePhrase;

  // headers
  /** English: "Actions" */
  "header.actionsText": SimplePhrase;

  /** English: "Connections" */
  "header.connectionsText": SimplePhrase;

  /** English: "Data Sources" */
  "header.dataSourcesText": SimplePhrase;

  /** English: "Triggers" */
  "header.triggersText": SimplePhrase;

  /** English: "Uncategorized" */
  "header.uncategorizedText": SimplePhrase;

  // tooltips
  /** English: "Close" */
  "tooltip.close": SimplePhrase;

  /** English: "Connection Logs" */
  "tooltip.connectionLogs": SimplePhrase;

  /** English: "No Connection Logs" */
  "tooltip.connectionLogs--noLogs": SimplePhrase;

  /** English: "Copied to clipboard!" */
  "tooltip.copyConfirmed": SimplePhrase;

  /** English: "Copy cURL to clipboard" */
  "tooltip.copyCurl": SimplePhrase;

  /** English: "Copy log to clipboard" */
  "tooltip.copyLog": SimplePhrase;

  /** English: "Copy payload to clipboard" */
  "tooltip.copyPayload": SimplePhrase;

  /** English: "Copy URL to clipboard" */
  "tooltip.copyUrl": SimplePhrase;

  /** English: "Pass this API key via an HTTP header" */
  "tooltip.passApiKeyToHeader": SimplePhrase;

  /** English: "Restore default" */
  "tooltip.restoreDefault": SimplePhrase;

  // log severity levels
  /** English: "Debug" */
  "logSeverity.debug": SimplePhrase;

  /** English: "Error" */
  "logSeverity.error": SimplePhrase;

  /** English: "Fatal" */
  "logSeverity.fatal": SimplePhrase;

  /** English: "Info" */
  "logSeverity.info": SimplePhrase;

  /** English: "Metric" */
  "logSeverity.metric": SimplePhrase;

  /** English: "Trace" */
  "logSeverity.trace": SimplePhrase;

  /** English: "Warn" */
  "logSeverity.warn": SimplePhrase;

  // tabs
  /** English: "Monitors" */
  "alertMonitorsTab.title": SimplePhrase;

  /** English: "User Configuration" */
  "configurationTab.title": SimplePhrase;

  /** English: "Executions" */
  "executionsTab.title": SimplePhrase;

  /** English: "Payload" */
  "payloadTab.title": SimplePhrase;

  /** English: "Summary" */
  "summaryTab.title": SimplePhrase;

  /** English: "Test is running" */
  "testTab.testResults.banner.text--testIsRunning": SimplePhrase;

  /** English: "View Execution" */
  "testTab.testResults.button": SimplePhrase;

  /** English: "Endpoint test result" */
  "testTab.testResults.title": SimplePhrase;

  /** English: "Test" */
  "testTab.title": SimplePhrase;

  /** English: "Result preview not available for this step" */
  "stepOutputsTab.noResultsText": SimplePhrase;

  /** English: "No step outputs available" */
  "stepOutputsTab.noStepOutputsText": SimplePhrase;

  /** English: "Step Not Available" */
  "stepOutputsTab.stepNotSelected": SimplePhrase;

  /** English: "Step Outputs" */
  "stepOutputsTab.title": SimplePhrase;

  /** English: "Error" */
  "logsTab.banner.error": ComplexPhrase<{ count: number }>;

  /** English: "Errors" */
  "logsTab.banner.errorPlural": ComplexPhrase<{ count: number }>;

  /** English: "No logs available" */
  "logsTab.noLogsTitle": SimplePhrase;

  /** English: "Select a test run to view test logs" */
  "logsTab.noTestSelectedText": SimplePhrase;

  /** English: "No test run selected" */
  "logsTab.noTestSelectedTitle": SimplePhrase;

  /** English: "Show all logs" */
  "logsTab.showAllButton": SimplePhrase;

  /** English: "Show only errors" */
  "logsTab.showErrorsButton": SimplePhrase;

  /** English: "Logs" */
  "logsTab.title": SimplePhrase;

  /** English: "Cancelled by a new execution" */
  "retryTab.cancelledLabel": SimplePhrase;

  /** English: "Next retry" */
  "retryTab.scheduledRetryLabel": SimplePhrase;

  /** English: "%{retryIndex} of %{maxRetryCount} at %{nextScheduledRetry}" */
  "retryTab.scheduledRetryText": ComplexPhrase<{
    retryIndex: number;
    maxRetryCount: number;
    nextScheduledRetry: string;
  }>;

  /** English: "Failed after %{retryCount} retries" */
  "retryTab.statusFailedPluralText": ComplexPhrase<{ retryCount: number }>;

  /** English: "Failed after %{retryCount} retry" */
  "retryTab.statusFailedText": ComplexPhrase<{ retryCount: number }>;

  /** English: "Final status" */
  "retryTab.statusLabel": SimplePhrase;

  /** English: "Succeeded on retry %{retryCount}" */
  "retryTab.statusSuccessText": ComplexPhrase<{ retryCount: number }>;

  /** English: "Retry" */
  "retryTab.title": SimplePhrase;

  // components
  /** English: "Trigger details" */
  "triggerDetails.title": SimplePhrase;

  /** English: "API key configured" */
  "triggerDetails.apiConfiguredText": SimplePhrase;

  /** English: "No API key configured" */
  "triggerDetails.noApiConfiguredText": SimplePhrase;

  /** English: "Execution Details" */
  "executionDetails.title": SimplePhrase;

  /** English: "Executions" */
  "executionOptions.title": SimplePhrase;

  // config wizard
  /** English: "This configuration page has no configuration." */
  "configWizard.noConfigurationText": SimplePhrase;

  // oauth connection component
  /** English: "Connect" */
  "oAuthConnection.connectButton": SimplePhrase;

  /** English: "Disconnect" */
  "oAuthConnection.disconnectButton": SimplePhrase;

  // no results component
  /** English: "No results" */
  "noResults.title": SimplePhrase;

  /** English: "Your search of "{searchTerm}" returned no results." */
  "noResults.text": ComplexPhrase<{ searchTerm: string }>;

  // listing pages empty state
  /** English: "Integration marketplace" */
  "emptyState.integrationMarketplaceTitle": SimplePhrase;

  /** English: "Your integration marketplace is where your customers go to browse your integration offerings and self-activate the ones they want. It can be white-labeled and embedded in your app to create a native integration experience." */
  "emptyState.integrationMarketplaceText": SimplePhrase;

  /** English: "Here is where you set up which integrations are included in your marketplace and how they appear." */
  "emptyState.integrationMarketplaceTextTwo": SimplePhrase;

  /** English: "Learn about the integration marketplace" */
  "emptyState.integrationMarketplaceDocsButton": SimplePhrase;

  /** English: "Embedding marketplace in your app" */
  "emptyState.integrationMarketplaceDocsButtonTwo": SimplePhrase;
}

export interface UniquePhrases {
  // marketplace listing
  /** English: "Activated but not configured" */
  "integration-marketplace__card.activateLabel": SimplePhrase;

  /** English: "Paused" */
  "integration-marketplace__card.pausedLabel": SimplePhrase;

  /** English: "Activated" */
  "integration-marketplace__card.runningLabel": SimplePhrase;

  /** English: "Activated but not configured" */
  "integration-marketplace__card.ulcUnconfiguredLabel": SimplePhrase;

  /** English: "Activated" */
  "integration-marketplace__filterBar.activateButton": SimplePhrase;

  /** English: "All" */
  "integration-marketplace__filterBar.allButton": SimplePhrase;

  // marketplace integration summary
  /** English: "Please contact %{organization} to activate this integration." */
  "integrations.id__banner.customerActivateText": ComplexPhrase<{
    organization: string;
  }>;

  /** English: "Please contact %{organization} to update to latest version." */
  "integrations.id__banner.customerUpdateText": ComplexPhrase<{
    organization: string;
  }>;

  /** English: "Your integration is enabled" */
  "integrations.id__banner.enabledText": SimplePhrase;

  /** English: "Pause Integration" */
  "integrations.id__banner.pauseButton": SimplePhrase;

  /** English: "Your integration is paused" */
  "integrations.id__banner.pausedText": SimplePhrase;

  /** English: "Unpause Integration" */
  "integrations.id__banner.unpauseButton": SimplePhrase;

  /** English: "Update" */
  "integrations.id__banner.updateButton": SimplePhrase;

  /** English: "There is an update available" */
  "integrations.id__banner.updateText": SimplePhrase;

  /** English: "Configure User Level Configuration" */
  "integrations.id__filterBar.configureUserButton": SimplePhrase;

  /** English: "Reconfigure" */
  "integrations.id__filterBar.reconfigureButton": SimplePhrase;

  /** English: "Reconfigure User Level Configuration" */
  "integrations.id__filterBar.reconfigureUserButton": SimplePhrase;

  /** English: "View Configuration" */
  "integrations.id__filterBar.viewConfigurationButton": SimplePhrase;

  /** English: "View User Level Configuration" */
  "integrations.id__filterBar.viewUserConfigurationButton": SimplePhrase;

  // marketplace integration summary
  /** English: "Save & Run Test" */
  "integrations.id.test__filterBar.saveRunButton": SimplePhrase;

  // marketplace integration alert monitors
  /** English: "Click the add monitor button to add a monitor." */
  "integrations.id.alert-monitors__filterResults.placeholderText--hasInstanceOrCustomer": SimplePhrase;

  // marketplace integration logs
  /** English: "Go to instances" */
  "integrations.id.logs__filterResults.placeholderCta--hasCustomer": SimplePhrase;

  /** English: "To add logs, first start an instance." */
  "integrations.id.logs__filterResults.placeholderText--hasCustomer": SimplePhrase;

  /** English: "To add logs, make sure your instance is running." */
  "integrations.id.logs__filterResults.placeholderText--hasInstance": SimplePhrase;

  // marketplace not found
  /** English: "Not Found" */
  "app.marketplace-not-found__title": SimplePhrase;

  /** English: "The page you requested was not found." */
  "app.marketplace-not-found__text": SimplePhrase;

  // integrations
  /** English: "Add integration" */
  "integrations__filterBar.addButton": SimplePhrase;

  // 404
  /** English: "404" */
  "404__title": SimplePhrase;

  /** English: "The page you requested was not found." */
  "404__text": SimplePhrase;

  /** English: "Back to dashboard" */
  "404__button": SimplePhrase;
}

export type PhrasesBase = SharedPhrases & UniquePhrases;

export type PrismaticPhrases<T extends SharedPhrases = SharedPhrases> =
  Partial<{
    [K in keyof T as `${PhraseNamespace}__${string & K}`]: T[K];
  }> &
    PhrasesBase;

export type Phrases = Partial<PrismaticPhrases>;
