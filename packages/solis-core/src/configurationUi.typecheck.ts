import type {
  ConfigurationResource,
  Ui,
  UserConfigurationResource,
} from "./index.js";
import type { Ui as ProtocolUi } from "./protocol/index.js";

const publicUi: Ui = { type: "custom", value: [null, false, 42, "host"] };
const protocolUi: ProtocolUi = publicUi;

const configurationUiContract = (
  resource: ConfigurationResource | UserConfigurationResource,
) => {
  if (resource.status !== "success") return;
  const ui: Ui | null | undefined = resource.data.ui;
  // @ts-expect-error Presentation metadata is no longer unwrapped.
  resource.data.uiSchema;
  if (ui?.type === "uiSchema") {
    const layout: Record<string, unknown> = ui.value;
    return layout;
  }
  if (ui?.type === "custom") {
    const model: unknown = ui.value;
    return model;
  }
};

void protocolUi;
void configurationUiContract;
