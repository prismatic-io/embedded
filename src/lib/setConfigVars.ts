import type { ConfigVars } from "../types/configVars";
import { PrismaticMessageEvent } from "../types/postMessage";
import { postMessage } from "../utils/postMessage";

interface SetConfigVarsPropsBase {
  configVars: ConfigVars;
}

interface SelectorSetConfigVarProps extends SetConfigVarsPropsBase {
  selector?: string;
}

interface IFrameSetConfigVarProps extends SetConfigVarsPropsBase {
  iframe: Element;
}

export type SetConfigVarsProps =
  | IFrameSetConfigVarProps
  | SelectorSetConfigVarProps;

/**
 * Programmatically sets configuration variable values on an active configuration
 * wizard. This is useful for pre-filling config values based on context from
 * your application (e.g., setting an API endpoint or customer-specific settings).
 *
 * You can target the iframe either by passing the iframe element directly
 * (obtained from {@link getMessageIframe}) or by passing a `selector` string.
 *
 * @param props - The config vars and target iframe.
 * @param props.configVars - A map of config variable keys to their values.
 * @param props.iframe - The iframe element to send config vars to (use with `getMessageIframe`).
 * @param props.selector - A CSS selector for the iframe to send config vars to.
 *
 * @example
 * // Set config vars using an iframe reference from a message event
 * window.addEventListener("message", (event) => {
 *   if (event.data.event === "INSTANCE_CONFIGURATION_LOADED") {
 *     const iframe = prismatic.getMessageIframe(event);
 *     prismatic.setConfigVars({
 *       iframe,
 *       configVars: {
 *         "API Endpoint": { value: "https://api.example.com" },
 *         "Sync Frequency": { value: "daily" },
 *       },
 *     });
 *   }
 * });
 *
 * @example
 * // Set config vars using a CSS selector
 * prismatic.setConfigVars({
 *   selector: "#config-container",
 *   configVars: {
 *     "API Key": { value: "my-api-key" },
 *   },
 * });
 *
 * @see {@link https://prismatic.io/docs/embed/marketplace/ | Embedding the Marketplace}
 */
export const setConfigVars = ({
  configVars,
  ...options
}: SetConfigVarsProps) => {
  postMessage({
    ...options,
    event: { event: PrismaticMessageEvent.SET_CONFIG_VAR, data: configVars },
  });
};
