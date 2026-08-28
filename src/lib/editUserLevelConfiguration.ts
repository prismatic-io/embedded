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
 * Renders the signed-in person's own configuration for an instance directly
 * into a DOM element (no popover), so a customer user can supply their own
 * connections without being taken through the instance's configuration.
 *
 * Use this rather than {@link editInstanceConfiguration} for a customer user.
 * A customer user has no instance level pages to fill in, and passing an
 * `instanceId` to a marketplace screen otherwise leaves them choosing from a
 * list of instances rather than configuring the one already named.
 *
 * The callbacks report the user level lifecycle, which is not the same as the
 * instance one: `onSuccess` fires when their configuration deploys, not when
 * the instance does.
 *
 * @param props - Configuration and display options.
 * @param props.instanceId - The ID of the instance whose user level configuration to open.
 * @param props.selector - A CSS selector for the DOM element to render into.
 * @param props.theme - Optional theme override (`"LIGHT"` or `"DARK"`).
 * @param props.screenConfiguration - Optional screen configuration for the configuration wizard.
 * @param props.onSuccess - Called when the person's configuration is successfully deployed.
 * @param props.onCancel - Called when the person cancels the configuration.
 * @param props.onDelete - Called when the person removes their configuration.
 * @returns A cleanup function that removes the event listeners, or `undefined` if no callbacks were provided.
 *
 * @example
 * // Let a customer user connect their own account to an instance
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
    // `reconfigure` names the instance so it is not asked for again;
    // `userLevelConfigured` picks the person's pages over the instance's.
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
