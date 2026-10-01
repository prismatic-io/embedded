import prismatic, { type ScreenConfiguration } from "@prismatic-io/embedded";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { EmbedLoading } from "#/components/embed-loading";
import { HelperText } from "#/components/helper-text";
import { Page } from "#/components/page";
import {
  Playground,
  PlaygroundChips,
  PlaygroundColor,
  type PlaygroundOption,
  PlaygroundOptions,
  PlaygroundSection,
  PlaygroundSelect,
  PlaygroundSwitch,
} from "#/components/playground";
import { useTheme } from "#/components/theme-provider";
import { useDebouncedValue } from "#/hooks/use-debounced-value";
import { usePrismaticAuth } from "#/hooks/use-prismatic-auth";

export const Route = createFileRoute("/examples/screen-configuration")({
  component: RouteComponent,
});

const SELECTOR = "#screen-configuration-marketplace";

/**
 * Every select below can stay unset. An unset option is left out of the
 * `screenConfiguration` object, so Prismatic applies its own default.
 */
const UNSET = "unset";

type Unsettable<T extends string> = T | typeof UNSET;

const unsetOption = {
  value: UNSET,
  label: "Not set",
  description: "Left out of the options, so Prismatic's default applies.",
} as const;

const value = <T extends string>(setting: Unsettable<T>) =>
  setting === UNSET ? undefined : setting;

type DetailsSetting = NonNullable<
  NonNullable<ScreenConfiguration["marketplace"]>["configuration"]
>;

const DETAILS_OPTIONS = [
  unsetOption,
  {
    value: "allow-details",
    label: "Back to the marketplace",
    code: "allow-details",
    description:
      "After the wizard, the customer returns to the marketplace list. A card's menu still offers the details screen.",
  },
  {
    value: "always-show-details",
    label: "Open the details screen",
    code: "always-show-details",
    description:
      "After the wizard, or on picking an activated integration, the customer lands on its details screen.",
  },
  {
    value: "disallow-details",
    label: "No details screen",
    code: "disallow-details",
    description:
      "Like Back to the marketplace, but a card's menu has no details option, so the customer cannot reach the details screen.",
  },
] as const satisfies ReadonlyArray<
  PlaygroundOption<Unsettable<DetailsSetting>>
>;

const DETAILS_DESCRIPTION =
  "Where a customer lands after the configuration wizard, and whether they can reach an integration's details screen. That screen holds the Test, Executions, and Logs tabs.";

type WizardConfiguration = NonNullable<
  ScreenConfiguration["configurationWizard"]
>;

const MODE_OPTIONS = [
  unsetOption,
  {
    value: "streamlined",
    label: "Skip the overview page",
    code: "streamlined",
    description:
      "The wizard opens on its first configuration page. This is the default.",
  },
  {
    value: "traditional",
    label: "Start with an overview page",
    code: "traditional",
    description:
      "The wizard opens on a page where the customer names the instance and sees details such as flow webhook URLs.",
  },
] as const satisfies ReadonlyArray<
  PlaygroundOption<Unsettable<NonNullable<WizardConfiguration["mode"]>>>
>;

const CONNECTION_OPTIONS = [
  unsetOption,
  {
    value: "reusable",
    label: "Reuse saved connections",
    code: "reusable",
    description:
      "The customer picks from credentials they already saved, and one connection can serve several integrations. This is the default.",
  },
  {
    value: "inline",
    label: "Enter credentials each time",
    code: "inline",
    description:
      "The connection's fields sit on the configuration page, and nothing is shared with other integrations. This is the older behavior.",
  },
] as const satisfies ReadonlyArray<
  PlaygroundOption<
    Unsettable<NonNullable<WizardConfiguration["connectionConfiguration"]>>
  >
>;

const TRIGGER_OPTIONS = [
  unsetOption,
  {
    value: "default",
    label: "Collapsed",
    code: "default",
    description: "Shown, but closed until the customer expands it.",
  },
  {
    value: "default-open",
    label: "Expanded",
    code: "default-open",
    description: "Shown and already open.",
  },
  {
    value: "hidden",
    label: "Hidden",
    code: "hidden",
    description: "Not shown at all.",
  },
] as const satisfies ReadonlyArray<
  PlaygroundOption<
    Unsettable<NonNullable<WizardConfiguration["triggerDetailsConfiguration"]>>
  >
>;

/**
 * Shared by logs and step results. `data` names what is stored, for the
 * descriptions.
 */
const disabledOptions = (data: string) =>
  [
    unsetOption,
    {
      value: "never",
      label: "Keep",
      code: "never",
      description: `Prismatic stores ${data}. This is the default.`,
    },
    {
      value: "always",
      label: "Turn off",
      code: "always",
      description: `Prismatic does not store ${data}.`,
    },
    {
      value: "optional",
      label: "Customer chooses",
      code: "optional",
      description: `The wizard shows a toggle so the customer decides whether to store ${data}.`,
    },
  ] as const satisfies ReadonlyArray<
    PlaygroundOption<
      Unsettable<NonNullable<WizardConfiguration["logsDisabled"]>>
    >
  >;

const LOGS_OPTIONS = disabledOptions("logs");
const STEP_RESULTS_OPTIONS = disabledOptions("step results");

/** Both settings take effect only under a custom retention policy. */
const RETENTION_NOTE =
  "Takes effect only if your organization has a custom retention policy, which Prismatic support sets up.";

type InstanceTab = NonNullable<
  NonNullable<ScreenConfiguration["instance"]>["hideTabs"]
>[number];

const INSTANCE_TABS = [
  "Test",
  "Executions",
  "Logs",
] as const satisfies readonly InstanceTab[];

function RouteComponent() {
  const { authenticated, error } = usePrismaticAuth();
  const { theme } = useTheme();

  // marketplace
  const [marketplaceDetails, setMarketplaceDetails] =
    useState<Unsettable<DetailsSetting>>(UNSET);
  const [hideSearch, setHideSearch] = useState(false);
  const [hideActiveFilter, setHideActiveFilter] = useState(false);

  // configurationWizard
  const [mode, setMode] =
    useState<Unsettable<NonNullable<WizardConfiguration["mode"]>>>(UNSET);
  const [connectionConfiguration, setConnectionConfiguration] =
    useState<
      Unsettable<NonNullable<WizardConfiguration["connectionConfiguration"]>>
    >(UNSET);
  const [triggerDetails, setTriggerDetails] =
    useState<
      Unsettable<
        NonNullable<WizardConfiguration["triggerDetailsConfiguration"]>
      >
    >(UNSET);
  const [logsDisabled, setLogsDisabled] =
    useState<Unsettable<NonNullable<WizardConfiguration["logsDisabled"]>>>(
      UNSET,
    );
  const [stepResultsDisabled, setStepResultsDisabled] =
    useState<
      Unsettable<NonNullable<WizardConfiguration["stepResultsDisabled"]>>
    >(UNSET);
  const [hideSidebar, setHideSidebar] = useState(false);
  const [isInModal, setIsInModal] = useState(false);

  // configureInstance
  const [instanceDetails, setInstanceDetails] =
    useState<Unsettable<DetailsSetting>>(UNSET);

  // instance
  const [hideBackToMarketplace, setHideBackToMarketplace] = useState(false);
  const [hidePauseButton, setHidePauseButton] = useState(false);
  const [hideDeactivation, setHideDeactivation] = useState(false);
  const [hideTabs, setHideTabs] = useState<InstanceTab[]>([]);

  // initializing
  const [customLoading, setCustomLoading] = useState(false);
  const [background, setBackground] = useState("#1e1b4b");
  const [color, setColor] = useState("#e0e7ff");

  const screenConfiguration: ScreenConfiguration = {
    marketplace: {
      configuration: value(marketplaceDetails),
      hideSearch,
      hideActiveIntegrationsFilter: hideActiveFilter,
    },
    configurationWizard: {
      mode: value(mode),
      connectionConfiguration: value(connectionConfiguration),
      triggerDetailsConfiguration: value(triggerDetails),
      logsDisabled: value(logsDisabled),
      stepResultsDisabled: value(stepResultsDisabled),
      hideSidebar,
      isInModal,
    },
    configureInstance: { configuration: value(instanceDetails) },
    instance: {
      hideBackToMarketplace,
      hidePauseButton,
      hideDeactivation,
      hideTabs,
    },
    // Both colors are required, so send the pair or leave the screen alone.
    ...(customLoading ? { initializing: { background, color } } : {}),
  };

  const settled = useDebouncedValue(JSON.stringify(screenConfiguration));

  useEffect(() => {
    if (!authenticated) {
      return;
    }
    prismatic.showMarketplace({
      selector: SELECTOR,
      theme: theme === "light" ? "LIGHT" : "DARK",
      screenConfiguration: JSON.parse(settled) as ScreenConfiguration,
    });
  }, [authenticated, theme, settled]);

  return (
    <Page
      title="Screen Configuration"
      description="This playground demonstrates every screenConfiguration option for the integration marketplace. Change an option and the marketplace reloads with it."
      actions={<HelperText id="screen-configuration" />}
      fullHeight
    >
      <Playground
        controls={
          <>
            <PlaygroundSection
              title="Marketplace"
              description="The list of integrations your customer browses."
            >
              <PlaygroundSelect
                label="Details screen"
                hint="marketplace.configuration"
                description={DETAILS_DESCRIPTION}
                value={marketplaceDetails}
                options={DETAILS_OPTIONS}
                onChange={setMarketplaceDetails}
              />
              <PlaygroundSwitch
                label="Hide the search box"
                hint="marketplace.hideSearch"
                description="Removes the search bar above the list of integrations."
                checked={hideSearch}
                onChange={setHideSearch}
              />
              <PlaygroundSwitch
                label="Hide the activated filter"
                hint="marketplace.hideActiveIntegrationsFilter"
                description="Removes the All and Activated buttons at the top right, which let a customer list only the integrations they turned on."
                checked={hideActiveFilter}
                onChange={setHideActiveFilter}
              />
            </PlaygroundSection>

            <PlaygroundSection
              title="Configuration wizard"
              description="The screens a customer steps through to activate an integration."
            >
              <PlaygroundSelect
                label="Wizard mode"
                hint="configurationWizard.mode"
                description="Whether the wizard begins with an overview page before the configuration pages."
                value={mode}
                options={MODE_OPTIONS}
                onChange={setMode}
              />
              <PlaygroundSelect
                label="Connections"
                hint="configurationWizard.connectionConfiguration"
                description="How the wizard asks for credentials to the other apps an integration connects to, such as a customer's Salesforce account."
                value={connectionConfiguration}
                options={CONNECTION_OPTIONS}
                onChange={setConnectionConfiguration}
              />
              <PlaygroundSelect
                label="Trigger details"
                hint="configurationWizard.triggerDetailsConfiguration"
                description="The panel that shows how each flow starts, such as its webhook URL or schedule."
                value={triggerDetails}
                options={TRIGGER_OPTIONS}
                onChange={setTriggerDetails}
              />
              <PlaygroundSelect
                label="Logs"
                hint="configurationWizard.logsDisabled"
                description={`Whether Prismatic stores the log lines an integration writes as it runs. ${RETENTION_NOTE}`}
                value={logsDisabled}
                options={LOGS_OPTIONS}
                onChange={setLogsDisabled}
              />
              <PlaygroundSelect
                label="Step results"
                hint="configurationWizard.stepResultsDisabled"
                description={`Whether Prismatic stores the data each step of a flow returns as it runs. ${RETENTION_NOTE}`}
                value={stepResultsDisabled}
                options={STEP_RESULTS_OPTIONS}
                onChange={setStepResultsDisabled}
              />
              <PlaygroundSwitch
                label="Hide the sidebar"
                hint="configurationWizard.hideSidebar"
                description="Removes the sidebar on the left of the wizard."
                checked={hideSidebar}
                onChange={setHideSidebar}
              />
              <PlaygroundSwitch
                label="Open in a modal"
                hint="configurationWizard.isInModal"
                description="Shows the wizard as a dialog over your page, rather than in the space the marketplace fills."
                checked={isInModal}
                onChange={setIsInModal}
              />
            </PlaygroundSection>

            <PlaygroundSection
              title="Configure instance"
              description="Applies when you open the wizard with configureInstance()."
            >
              <PlaygroundSelect
                label="Details screen"
                hint="configureInstance.configuration"
                description="The same choice as the marketplace's Details screen, for when your app opens the wizard itself with prismatic.configureInstance()."
                value={instanceDetails}
                options={DETAILS_OPTIONS}
                onChange={setInstanceDetails}
              />
            </PlaygroundSection>

            <PlaygroundSection
              title="Instance"
              description="The details screen for an integration the customer activated."
            >
              <PlaygroundSwitch
                label="Hide back to marketplace"
                hint="instance.hideBackToMarketplace"
                description="Removes the Back to Marketplace link. Useful when your own app handles navigation."
                checked={hideBackToMarketplace}
                onChange={setHideBackToMarketplace}
              />
              <PlaygroundSwitch
                label="Hide the pause button"
                hint="instance.hidePauseButton"
                description="Stops the customer from pausing or unpausing the integration."
                checked={hidePauseButton}
                onChange={setHidePauseButton}
              />
              <PlaygroundSwitch
                label="Hide deactivation"
                hint="instance.hideDeactivation"
                description="Removes the button that deactivates the integration, so the customer cannot turn it off."
                checked={hideDeactivation}
                onChange={setHideDeactivation}
              />
              <PlaygroundChips
                label="Hidden tabs"
                hint="instance.hideTabs"
                description="Tabs to remove. Test runs the integration on demand, Executions lists past runs, and Logs shows what the runs wrote."
                values={hideTabs}
                options={INSTANCE_TABS}
                onChange={setHideTabs}
              />
            </PlaygroundSection>

            <PlaygroundSection
              title="Loading screen"
              description="Shown while an embedded screen starts."
            >
              <PlaygroundSwitch
                label="Use custom colors"
                hint="initializing"
                description="Colors for the loading screen Prismatic shows while an embedded screen starts. Send both colors or neither."
                checked={customLoading}
                onChange={setCustomLoading}
              />
              {customLoading ? (
                <>
                  <PlaygroundColor
                    label="Background"
                    hint="initializing.background"
                    description="The background color of the loading screen."
                    value={background}
                    onChange={setBackground}
                  />
                  <PlaygroundColor
                    label="Text and spinner"
                    hint="initializing.color"
                    description="The color of the loading text and spinner."
                    value={color}
                    onChange={setColor}
                  />
                </>
              ) : null}
            </PlaygroundSection>
          </>
        }
        options={
          <PlaygroundOptions
            code={JSON.stringify(screenConfiguration, null, 2)}
          />
        }
      >
        {error ? (
          <div className="p-6 text-sm text-destructive">
            Error authenticating with Prismatic: {error.message}
          </div>
        ) : (
          <>
            <div id="screen-configuration-marketplace" className="h-full" />
            {!authenticated && (
              <EmbedLoading label="Loading the integration marketplace" />
            )}
          </>
        )}
      </Playground>
    </Page>
  );
}
