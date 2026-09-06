import { PrismaticMessageEvent } from "../types/postMessage";
import type { ConfigurationWizardConfiguration } from "../types/screenConfiguration";
import type { Theme } from "../types/theme";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

export type EditUserLevelConfigurationProps = {
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
 * Renders the configuration wizard for a customer user's own connections,
 * inline within a DOM element you provide.
 *
 * Customer users supply their own connections rather than the instance's, so
 * this opens their pages and nothing else. Use {@link editInstanceConfiguration}
 * for the instance's own configuration instead.
 *
 * The callbacks report what happens to that person's configuration, not to the
 * instance: `onSuccess` fires when their configuration deploys.
 *
 * @param props - Configuration and display options.
 * @param props.instanceId - The ID of the instance to configure.
 * @param props.selector - A CSS selector for the DOM element to render into.
 * @param props.theme - Optional theme override (`"LIGHT"` or `"DARK"`).
 * @param props.screenConfiguration - Optional screen configuration for the configuration wizard.
 * @param props.onSuccess - Called when the person's configuration is successfully deployed.
 * @param props.onCancel - Called when the person cancels the configuration.
 * @param props.onDelete - Called when the person removes their configuration.
 * @returns A cleanup function that removes the event listeners, or `undefined` if no callbacks were provided.
 *
 * @example
 * // Let a customer user connect their own account
 * const cleanup = prismatic.editUserLevelConfiguration({
 *   instanceId: "SW5zdGFuY2U6OGE2YjZi...",
 *   selector: "#config-panel",
 *   onSuccess: () => console.log("Their account is connected."),
 *   onCancel: () => console.log("Configuration canceled."),
 *   onDelete: () => console.log("Their configuration was removed."),
 * });
 *
 * // Call cleanup() when you're done to remove event listeners
 * cleanup?.();
 *
 * @see {@link https://prismatic.io/docs/embed/marketplace/ | Embedding the Marketplace}
 */
export const editUserLevelConfiguration = ({
  instanceId,
  selector,
  theme,
  screenConfiguration,
  onCancel,
  onSuccess,
  onDelete,
}: EditUserLevelConfigurationProps) => {
  assertInit("editUserLevelConfiguration");

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
    { reconfigure: "true", userLevelConfigured: "true" },
  );

  if (!onCancel && !onSuccess && !onDelete) {
    return;
  }

  const abortController = new AbortController();

  window.addEventListener(
    "message",
    (event: MessageEvent<{ event: string }>) => {
      switch (event.data?.event) {
        case PrismaticMessageEvent.USER_CONFIGURATION_DEPLOYED:
          onSuccess?.();
          abortController.abort();
          break;
        case PrismaticMessageEvent.USER_CONFIGURATION_DELETED:
          onDelete?.();
          abortController.abort();
          break;
        // There is no user level cancel event; cancelling the wizard reports
        // itself under the instance level name.
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
