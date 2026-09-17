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

const unsetOption = { value: UNSET, label: "Not set (default)" } as const;

const value = <T extends string>(setting: Unsettable<T>) =>
  setting === UNSET ? undefined : setting;

type DetailsSetting = NonNullable<
  NonNullable<ScreenConfiguration["marketplace"]>["configuration"]
>;

const DETAILS_OPTIONS = [
  unsetOption,
  { value: "allow-details", label: "allow-details" },
  { value: "always-show-details", label: "always-show-details" },
  { value: "disallow-details", label: "disallow-details" },
] as const satisfies ReadonlyArray<{
  value: Unsettable<DetailsSetting>;
  label: string;
}>;

type WizardConfiguration = NonNullable<
  ScreenConfiguration["configurationWizard"]
>;

const MODE_OPTIONS = [
  unsetOption,
  { value: "streamlined", label: "streamlined" },
  { value: "traditional", label: "traditional" },
] as const satisfies ReadonlyArray<{
  value: Unsettable<NonNullable<WizardConfiguration["mode"]>>;
  label: string;
}>;

const CONNECTION_OPTIONS = [
  unsetOption,
  { value: "reusable", label: "reusable" },
  { value: "inline", label: "inline" },
] as const satisfies ReadonlyArray<{
  value: Unsettable<
    NonNullable<WizardConfiguration["connectionConfiguration"]>
  >;
  label: string;
}>;

const TRIGGER_OPTIONS = [
  unsetOption,
  { value: "default", label: "default" },
  { value: "default-open", label: "default-open" },
  { value: "hidden", label: "hidden" },
] as const satisfies ReadonlyArray<{
  value: Unsettable<
    NonNullable<WizardConfiguration["triggerDetailsConfiguration"]>
  >;
  label: string;
}>;

const DISABLED_OPTIONS = [
  unsetOption,
  { value: "never", label: "never" },
  { value: "optional", label: "optional" },
  { value: "always", label: "always" },
] as const satisfies ReadonlyArray<{
  value: Unsettable<NonNullable<WizardConfiguration["logsDisabled"]>>;
  label: string;
}>;

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
      description="This page demonstrates every screenConfiguration option for the integration marketplace. Change an option and the marketplace reloads with it."
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
                label="Detail pages"
                hint="marketplace.configuration"
                value={marketplaceDetails}
                options={DETAILS_OPTIONS}
                onChange={setMarketplaceDetails}
              />
              <PlaygroundSwitch
                label="Hide the search box"
                hint="marketplace.hideSearch"
                checked={hideSearch}
                onChange={setHideSearch}
              />
              <PlaygroundSwitch
                label="Hide the activated filter"
                hint="marketplace.hideActiveIntegrationsFilter"
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
                value={mode}
                options={MODE_OPTIONS}
                onChange={setMode}
              />
              <PlaygroundSelect
                label="Connections"
                hint="configurationWizard.connectionConfiguration"
                value={connectionConfiguration}
                options={CONNECTION_OPTIONS}
                onChange={setConnectionConfiguration}
              />
              <PlaygroundSelect
                label="Trigger details"
                hint="configurationWizard.triggerDetailsConfiguration"
                value={triggerDetails}
                options={TRIGGER_OPTIONS}
                onChange={setTriggerDetails}
              />
              <PlaygroundSelect
                label="Disable logs"
                hint="configurationWizard.logsDisabled"
                value={logsDisabled}
                options={DISABLED_OPTIONS}
                onChange={setLogsDisabled}
              />
              <PlaygroundSelect
                label="Disable step results"
                hint="configurationWizard.stepResultsDisabled"
                value={stepResultsDisabled}
                options={DISABLED_OPTIONS}
                onChange={setStepResultsDisabled}
              />
              <PlaygroundSwitch
                label="Hide the sidebar"
                hint="configurationWizard.hideSidebar"
                checked={hideSidebar}
                onChange={setHideSidebar}
              />
              <PlaygroundSwitch
                label="Open in a modal"
                hint="configurationWizard.isInModal"
                checked={isInModal}
                onChange={setIsInModal}
              />
            </PlaygroundSection>

            <PlaygroundSection
              title="Configure instance"
              description="Applies when you open the wizard with configureInstance()."
            >
              <PlaygroundSelect
                label="Detail pages"
                hint="configureInstance.configuration"
                value={instanceDetails}
                options={DETAILS_OPTIONS}
                onChange={setInstanceDetails}
              />
            </PlaygroundSection>

            <PlaygroundSection
              title="Instance"
              description="The page for an integration the customer activated."
            >
              <PlaygroundSwitch
                label="Hide back to marketplace"
                hint="instance.hideBackToMarketplace"
                checked={hideBackToMarketplace}
                onChange={setHideBackToMarketplace}
              />
              <PlaygroundSwitch
                label="Hide the pause button"
                hint="instance.hidePauseButton"
                checked={hidePauseButton}
                onChange={setHidePauseButton}
              />
              <PlaygroundSwitch
                label="Hide deactivation"
                hint="instance.hideDeactivation"
                checked={hideDeactivation}
                onChange={setHideDeactivation}
              />
              <div className="grid gap-1.5">
                <span className="text-xs font-medium">Hidden tabs</span>
                <span className="text-[11px] leading-tight text-muted-foreground">
                  instance.hideTabs
                </span>
                <PlaygroundChips
                  values={hideTabs}
                  options={INSTANCE_TABS}
                  onChange={setHideTabs}
                />
              </div>
            </PlaygroundSection>

            <PlaygroundSection
              title="Loading screen"
              description="Shown while an embedded screen starts."
            >
              <PlaygroundSwitch
                label="Use custom colors"
                hint="initializing"
                checked={customLoading}
                onChange={setCustomLoading}
              />
              {customLoading ? (
                <>
                  <PlaygroundColor
                    label="Background"
                    hint="initializing.background"
                    value={background}
                    onChange={setBackground}
                  />
                  <PlaygroundColor
                    label="Text and spinner"
                    hint="initializing.color"
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
