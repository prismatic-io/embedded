/**
 * TypeScript compatibility test — verifies the published .d.ts output
 * type-checks correctly across the range of TS versions we support.
 *
 * Imports from ../dist (what consumers get from npm) rather than ../src, so
 * it catches TS-version-specific syntax that tsdown / rolldown-plugin-dts
 * emits during declaration generation.
 *
 * Run via: npm run typecheck:compat
 *
 * Supported floor: TS 4.9.
 */
import { expectTypeOf } from "expect-type";

import prismatic, {
  type AuthenticateProps,
  authenticate,
  BooleanOperator,
  type ComponentsFilters,
  type ConditionalExpression,
  type ConfigurationWizardConfiguration,
  type ConfigureInstanceProps,
  type ConfigureInstanceWithInstanceId,
  type ConfigureInstanceWithIntegrationId,
  type ConfigureInstanceWithIntegrationName,
  type ConfigVars,
  type ConnectionConfigVarInput,
  closePopover,
  configureInstance,
  createWorkflow,
  type DefaultConfigVarInput,
  type EditInstanceConfigurationProps,
  type EMBEDDED_DEFAULTS,
  editInstanceConfiguration,
  type Filters,
  type FontConfiguration,
  type GoogleFontFamilies,
  type GraphqlRequestProps,
  getMessageIframe,
  graphqlRequest,
  type InitializingConfiguration,
  type InitProps,
  type InstanceScreenConfiguration,
  type IntegrationsFilters,
  init,
  isConfigureInstanceWithInstanceId,
  isConfigureInstanceWithIntegrationId,
  isConfigureInstanceWithIntegrationName,
  type MarketplaceConfiguration,
  type MarketplaceFilters,
  type MessageData,
  type Options,
  type PopoverOptions,
  PrismaticMessageEvent,
  queryWorkflows,
  type ScreenConfiguration,
  type SelectorOptions,
  type SetConfigVarsProps,
  type ShowComponentProps,
  type ShowDesignerProps,
  setConfigVars,
  showComponent,
  type showComponents,
  type showConnections,
  type showDashboard,
  showDesigner,
  type showIntegrations,
  type showLogs,
  showMarketplace,
  type showWorkflow,
  type showWorkflows,
  TermOperator,
  type Theme,
  type TriggerDetails,
} from "../dist";

// ---------------------------------------------------------------------------
// Default export parity — `prismatic.X` must equal the named export `X`
// ---------------------------------------------------------------------------

expectTypeOf(prismatic.init).toEqualTypeOf<typeof init>();
expectTypeOf(prismatic.authenticate).toEqualTypeOf<typeof authenticate>();
expectTypeOf(prismatic.createWorkflow).toEqualTypeOf<typeof createWorkflow>();
expectTypeOf(prismatic.configureInstance).toEqualTypeOf<
  typeof configureInstance
>();
expectTypeOf(prismatic.editInstanceConfiguration).toEqualTypeOf<
  typeof editInstanceConfiguration
>();
expectTypeOf(prismatic.graphqlRequest).toEqualTypeOf<typeof graphqlRequest>();
expectTypeOf(prismatic.queryWorkflows).toEqualTypeOf<typeof queryWorkflows>();
expectTypeOf(prismatic.setConfigVars).toEqualTypeOf<typeof setConfigVars>();
expectTypeOf(prismatic.showComponent).toEqualTypeOf<typeof showComponent>();
expectTypeOf(prismatic.showComponents).toEqualTypeOf<typeof showComponents>();
expectTypeOf(prismatic.showConnections).toEqualTypeOf<typeof showConnections>();
expectTypeOf(prismatic.showDashboard).toEqualTypeOf<typeof showDashboard>();
expectTypeOf(prismatic.showDesigner).toEqualTypeOf<typeof showDesigner>();
expectTypeOf(prismatic.showIntegrations).toEqualTypeOf<
  typeof showIntegrations
>();
expectTypeOf(prismatic.showLogs).toEqualTypeOf<typeof showLogs>();
expectTypeOf(prismatic.showMarketplace).toEqualTypeOf<typeof showMarketplace>();
expectTypeOf(prismatic.showWorkflow).toEqualTypeOf<typeof showWorkflow>();
expectTypeOf(prismatic.showWorkflows).toEqualTypeOf<typeof showWorkflows>();
expectTypeOf(prismatic.closePopover).toEqualTypeOf<typeof closePopover>();
expectTypeOf(prismatic.getMessageIframe).toEqualTypeOf<
  typeof getMessageIframe
>();
expectTypeOf(prismatic.BooleanOperator).toEqualTypeOf<typeof BooleanOperator>();
expectTypeOf(prismatic.TermOperator).toEqualTypeOf<typeof TermOperator>();
expectTypeOf(prismatic.PrismaticMessageEvent).toEqualTypeOf<
  typeof PrismaticMessageEvent
>();
expectTypeOf(prismatic.EMBEDDED_DEFAULTS).toEqualTypeOf<
  typeof EMBEDDED_DEFAULTS
>();

// ---------------------------------------------------------------------------
// Function signatures — parameters and return types
// ---------------------------------------------------------------------------

expectTypeOf(init).parameter(0).toEqualTypeOf<InitProps | undefined>();
expectTypeOf(init).returns.toBeVoid();

expectTypeOf(authenticate).parameter(0).toEqualTypeOf<AuthenticateProps>();
expectTypeOf(authenticate).returns.resolves.toBeVoid();

expectTypeOf(closePopover).parameters.toEqualTypeOf<[]>();
expectTypeOf(closePopover).returns.toBeVoid();

expectTypeOf(getMessageIframe).parameter(0).toEqualTypeOf<MessageEvent>();
expectTypeOf(getMessageIframe).returns.toEqualTypeOf<
  HTMLIFrameElement | undefined
>();

expectTypeOf(configureInstance)
  .parameter(0)
  .toEqualTypeOf<ConfigureInstanceProps>();
expectTypeOf(configureInstance).returns.toBeVoid();

expectTypeOf(editInstanceConfiguration)
  .parameter(0)
  .toEqualTypeOf<EditInstanceConfigurationProps>();
expectTypeOf(editInstanceConfiguration).returns.toEqualTypeOf<
  (() => void) | undefined
>();

expectTypeOf(setConfigVars).parameter(0).toEqualTypeOf<SetConfigVarsProps>();
expectTypeOf(setConfigVars).returns.toBeVoid();

expectTypeOf(showComponent).parameter(0).toEqualTypeOf<ShowComponentProps>();
expectTypeOf(showDesigner).parameter(0).toEqualTypeOf<ShowDesignerProps>();
expectTypeOf(showMarketplace).returns.toBeVoid();

// ---------------------------------------------------------------------------
// createWorkflow generic dispatches on WorkflowContexts keys; unknown keys
// (the `string & {}` branch) accept arbitrary contextData
// ---------------------------------------------------------------------------

expectTypeOf(createWorkflow).toBeFunction();
expectTypeOf(
  createWorkflow("unknown-workflow-key", {
    name: "x",
    contextData: { arbitrary: "ok" },
  }),
).resolves.toMatchTypeOf<{ data?: unknown }>();

// ---------------------------------------------------------------------------
// graphqlRequest is generic over TData and TVariables
// ---------------------------------------------------------------------------

type MyData = { hello: string };
type MyVars = { id: string };
expectTypeOf(
  graphqlRequest<MyData, MyVars>({
    query: "query X($id: ID!) { hello(id: $id) }",
    variables: { id: "1" },
  }),
).resolves.toMatchTypeOf<{ data: MyData }>();

// ---------------------------------------------------------------------------
// queryWorkflows — optional variables, returns a GraphQL response
// ---------------------------------------------------------------------------

expectTypeOf(queryWorkflows).toBeFunction();
expectTypeOf(queryWorkflows()).resolves.toMatchTypeOf<{ data?: unknown }>();

// ---------------------------------------------------------------------------
// Type guards — narrow ConfigureInstanceProps
// ---------------------------------------------------------------------------

declare const anyConfig: ConfigureInstanceProps;
if (isConfigureInstanceWithInstanceId(anyConfig)) {
  expectTypeOf(anyConfig).toMatchTypeOf<ConfigureInstanceWithInstanceId>();
  expectTypeOf(anyConfig.instanceId).toBeString();
}
if (isConfigureInstanceWithIntegrationId(anyConfig)) {
  expectTypeOf(anyConfig).toMatchTypeOf<ConfigureInstanceWithIntegrationId>();
  expectTypeOf(anyConfig.integrationId).toBeString();
}
if (isConfigureInstanceWithIntegrationName(anyConfig)) {
  expectTypeOf(anyConfig).toMatchTypeOf<ConfigureInstanceWithIntegrationName>();
  expectTypeOf(anyConfig.integrationName).toBeString();
}

// ---------------------------------------------------------------------------
// Runtime enums — string-valued. `${EnumType}` widens members to their
// underlying string literal union, which is what consumers actually receive
// when interpolating or serializing enum values.
// ---------------------------------------------------------------------------

expectTypeOf(BooleanOperator.and).toEqualTypeOf<BooleanOperator>();
expectTypeOf<`${BooleanOperator}`>().toEqualTypeOf<"and" | "or">();

expectTypeOf(TermOperator.equal).toEqualTypeOf<TermOperator>();
expectTypeOf<`${TermOperator}`>().toEqualTypeOf<
  | "equal"
  | "notEqual"
  | "in"
  | "notIn"
  | "startsWith"
  | "doesNotStartWith"
  | "endsWith"
  | "doesNotEndWith"
>();

expectTypeOf(
  PrismaticMessageEvent.INSTANCE_CONFIGURATION_OPENED,
).toEqualTypeOf<PrismaticMessageEvent>();
// Spot-check that a handful of expected string values are in the enum's
// underlying union (rather than asserting the full 25-member union verbatim,
// which would fight the team every time a new event is added).
expectTypeOf<"INSTANCE_CONFIGURATION_OPENED">().toMatchTypeOf<`${PrismaticMessageEvent}`>();
expectTypeOf<"MARKETPLACE_CLOSED">().toMatchTypeOf<`${PrismaticMessageEvent}`>();
expectTypeOf<"WORKFLOW_ENABLED">().toMatchTypeOf<`${PrismaticMessageEvent}`>();

// ---------------------------------------------------------------------------
// Theme, TriggerDetails, Options discriminated union
// ---------------------------------------------------------------------------

expectTypeOf<Theme>().toEqualTypeOf<"DARK" | "LIGHT">();
expectTypeOf<TriggerDetails>().toEqualTypeOf<
  "default" | "default-open" | "hidden"
>();
expectTypeOf<Options>().toEqualTypeOf<PopoverOptions | SelectorOptions>();

// Options discriminator
declare const anyOptions: Options;
if (anyOptions.usePopover === true) {
  expectTypeOf(anyOptions).toMatchTypeOf<PopoverOptions>();
} else {
  expectTypeOf(anyOptions).toMatchTypeOf<SelectorOptions>();
  expectTypeOf(anyOptions.selector).toBeString();
}

// ---------------------------------------------------------------------------
// InitProps shape — spot-check that the major fields exist and are optional
// ---------------------------------------------------------------------------

expectTypeOf<InitProps>().toHaveProperty("theme");
expectTypeOf<InitProps>().toHaveProperty("screenConfiguration");
expectTypeOf<InitProps>().toHaveProperty("translation");
expectTypeOf<InitProps["theme"]>().toEqualTypeOf<Theme | undefined>();
expectTypeOf<InitProps["prismaticUrl"]>().toEqualTypeOf<string | undefined>();
expectTypeOf<InitProps["skipPreload"]>().toEqualTypeOf<boolean | undefined>();

// ---------------------------------------------------------------------------
// configureInstance discriminants all share `skipRedirectOnRemove`
// ---------------------------------------------------------------------------

expectTypeOf<
  ConfigureInstanceWithInstanceId["skipRedirectOnRemove"]
>().toEqualTypeOf<boolean>();
expectTypeOf<
  ConfigureInstanceWithIntegrationId["integrationId"]
>().toEqualTypeOf<string>();
expectTypeOf<
  ConfigureInstanceWithIntegrationName["integrationName"]
>().toEqualTypeOf<string>();

// ---------------------------------------------------------------------------
// EditInstanceConfigurationProps shape — uses selector (no usePopover)
// ---------------------------------------------------------------------------

expectTypeOf<
  EditInstanceConfigurationProps["instanceId"]
>().toEqualTypeOf<string>();
expectTypeOf<
  EditInstanceConfigurationProps["selector"]
>().toEqualTypeOf<string>();
expectTypeOf<EditInstanceConfigurationProps>().toHaveProperty("onCancel");
expectTypeOf<EditInstanceConfigurationProps>().toHaveProperty("onSuccess");
expectTypeOf<EditInstanceConfigurationProps>().toHaveProperty("onDelete");

// ---------------------------------------------------------------------------
// Filters: nested structure + ConditionalExpression recursion
// ---------------------------------------------------------------------------

expectTypeOf<Filters>().toHaveProperty("marketplace");
expectTypeOf<Filters["marketplace"]>().toEqualTypeOf<
  MarketplaceFilters | undefined
>();
expectTypeOf<Filters["integrations"]>().toEqualTypeOf<
  IntegrationsFilters | undefined
>();
expectTypeOf<Filters["components"]>().toEqualTypeOf<
  ComponentsFilters | undefined
>();
expectTypeOf<MarketplaceFilters["filterQuery"]>().toEqualTypeOf<
  ConditionalExpression | undefined
>();

// Term expression: [TermOperator, unknown, unknown?]
const termExpr: ConditionalExpression = [TermOperator.equal, "category", "ERP"];
expectTypeOf(termExpr).toMatchTypeOf<ConditionalExpression>();

// Boolean expression: recursive
const boolExpr: ConditionalExpression = [
  BooleanOperator.and,
  [TermOperator.equal, "a", 1],
  [TermOperator.notEqual, "b", 2],
];
expectTypeOf(boolExpr).toMatchTypeOf<ConditionalExpression>();

// ---------------------------------------------------------------------------
// ConfigVars: record of input-shaped config vars
// ---------------------------------------------------------------------------

expectTypeOf<ConfigVars>().toEqualTypeOf<
  Record<string, DefaultConfigVarInput | ConnectionConfigVarInput>
>();
expectTypeOf<ConnectionConfigVarInput>().toHaveProperty("inputs");
expectTypeOf<ConnectionConfigVarInput["inputs"]>().toEqualTypeOf<
  Record<string, { value: string }>
>();

// ---------------------------------------------------------------------------
// ScreenConfiguration nesting
// ---------------------------------------------------------------------------

expectTypeOf<ScreenConfiguration>().toHaveProperty("marketplace");
expectTypeOf<ScreenConfiguration["marketplace"]>().toEqualTypeOf<
  MarketplaceConfiguration | undefined
>();
expectTypeOf<ScreenConfiguration["configurationWizard"]>().toEqualTypeOf<
  ConfigurationWizardConfiguration | undefined
>();
expectTypeOf<ScreenConfiguration["instance"]>().toEqualTypeOf<
  InstanceScreenConfiguration | undefined
>();
expectTypeOf<ScreenConfiguration["initializing"]>().toEqualTypeOf<
  InitializingConfiguration | undefined
>();

expectTypeOf<InitializingConfiguration>().toEqualTypeOf<{
  background: string;
  color: string;
}>();

// InstanceScreenConfiguration hideTabs is a restricted string-literal array
expectTypeOf<InstanceScreenConfiguration["hideTabs"]>().toEqualTypeOf<
  Array<"Test" | "Executions" | "Logs"> | undefined
>();

// MarketplaceConfiguration.configuration is a known string-literal union
expectTypeOf<MarketplaceConfiguration["configuration"]>().toEqualTypeOf<
  "allow-details" | "always-show-details" | "disallow-details" | undefined
>();

// ---------------------------------------------------------------------------
// FontConfiguration shape
// ---------------------------------------------------------------------------

expectTypeOf<FontConfiguration>().toEqualTypeOf<{
  google: GoogleFontFamilies;
}>();
expectTypeOf<GoogleFontFamilies>().toEqualTypeOf<{
  families: Array<string>;
}>();

// ---------------------------------------------------------------------------
// MessageData tagged union — `event` is always a PrismaticMessageEvent member
// ---------------------------------------------------------------------------

declare const anyMsg: MessageData;
expectTypeOf(anyMsg.event).toMatchTypeOf<PrismaticMessageEvent>();
if (anyMsg.event === PrismaticMessageEvent.INSTANCE_CONFIGURATION_LOADED) {
  // The tagged variant narrows `data` accordingly
  expectTypeOf(anyMsg.data).toHaveProperty("configVars");
}

// ---------------------------------------------------------------------------
// GraphqlRequestProps is generic on TVariables (defaults to a record)
// ---------------------------------------------------------------------------

expectTypeOf<GraphqlRequestProps>().toHaveProperty("query");
expectTypeOf<GraphqlRequestProps["query"]>().toEqualTypeOf<string>();
expectTypeOf<GraphqlRequestProps<{ id: string }>["variables"]>().toEqualTypeOf<
  { id: string } | undefined
>();
