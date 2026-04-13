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
    { reconfigure: "true" }
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
    { signal: abortController.signal }
  );

  return () => abortController.abort();
};
