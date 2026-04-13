import { PrismaticMessageEvent } from "../types/postMessage";
import type { ConfigurationWizardConfiguration } from "../types/screenConfiguration";
import type { Theme } from "../types/theme";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

export type EditInstanceConfigurationProps = {
  instanceId: string;
  selector: string;
  theme?: Theme;
  screenConfiguration?: {
    configurationWizard?: Omit<ConfigurationWizardConfiguration, "isInModal">;
  };
  onCancel?: () => void;
  onSuccess?: () => void;
  onDelete?: () => void;
};

/**
 * Renders the configuration wizard for an existing instance directly into a
 * DOM element (no popover). This is useful when you want to embed instance
 * configuration inline within your own application's UI.
 *
 * Unlike {@link configureInstance}, this function opens the config wizard directly,
 * supports lifecycle callbacks (`onSuccess`, `onCancel`, `onDelete`), and returns a
 * cleanup function to remove event listeners.
 *
 * @param props - Configuration and display options.
 * @param props.instanceId - The ID of the instance to configure.
 * @param props.selector - A CSS selector for the DOM element to render into.
 * @param props.theme - Optional theme override (`"LIGHT"` or `"DARK"`).
 * @param props.screenConfiguration - Optional screen configuration for the configuration wizard.
 * @param props.onSuccess - Called when the instance is successfully deployed.
 * @param props.onCancel - Called when the user cancels the configuration.
 * @param props.onDelete - Called when the user deletes the instance.
 * @returns A cleanup function that removes the event listeners, or `undefined` if no callbacks were provided.
 *
 * @example
 * // Edit an instance's configuration with lifecycle callbacks
 * const cleanup = prismatic.editInstanceConfiguration({
 *   instanceId: "SW5zdGFuY2U6OGE2YjZi...",
 *   selector: "#config-panel",
 *   onSuccess: () => console.log("Configuration saved!"),
 *   onCancel: () => console.log("Configuration canceled."),
 *   onDelete: () => console.log("Instance deleted."),
 * });
 *
 * // Call cleanup() when you're done to remove event listeners
 * cleanup?.();
 *
 * @see {@link https://prismatic.io/docs/embed/marketplace/ | Embedding the Marketplace}
 */
export const editInstanceConfiguration = ({
  instanceId,
  selector,
  theme,
  screenConfiguration,
  onCancel,
  onSuccess,
  onDelete,
}: EditInstanceConfigurationProps) => {
  assertInit("editInstanceConfiguration");

  setIframe(
    `/configure-instance/${instanceId}/`,
    {
      selector,
      ...(theme ? { theme } : {}),
      screenConfiguration: {
        ...screenConfiguration,
        configurationWizard: {
          ...screenConfiguration?.configurationWizard,
          isInModal: true,
        },
      },
    },
    { reconfigure: "true" },
  );

  if (!onCancel && !onSuccess && !onDelete) {
    return;
  }

  const abortController = new AbortController();

  window.addEventListener(
    "message",
    (event: MessageEvent<{ event: string }>) => {
      switch (event.data?.event) {
        case PrismaticMessageEvent.INSTANCE_DEPLOYED:
          onSuccess?.();
          abortController.abort();
          break;
        case PrismaticMessageEvent.INSTANCE_DELETED:
          onDelete?.();
          abortController.abort();
          break;
        case PrismaticMessageEvent.INSTANCE_CONFIGURATION_CANCELED:
          onCancel?.();
          abortController.abort();
          break;
      }
    },
    { signal: abortController.signal },
  );

  return () => abortController.abort();
};
