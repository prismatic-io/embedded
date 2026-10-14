import type {
  ConfigurationResource,
  Ui,
  UserConfigurationResource,
} from "./index.js";

const publicUi: Ui = { type: "custom", value: [null, false, 42, "host"] };
const configurationUiContract = (
  resource: ConfigurationResource | UserConfigurationResource,
) => {
  if (resource.status !== "success") return;
  const ui: Ui | null | undefined = resource.data.ui;
  // @ts-expect-error Presentation metadata is no longer unwrapped.
  resource.data.uiSchema;
  return ui?.type === "uiSchema" ? ui.value : undefined;
};

void publicUi;
void configurationUiContract;
