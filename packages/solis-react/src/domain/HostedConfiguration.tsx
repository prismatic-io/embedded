import { useEffect, useRef } from "react";
import { useSessionState } from "../PrismaticProvider.js";
import { keys } from "../internal/keys.js";
import { useRefreshFamily } from "../internal/useResource.js";

export interface HostedConfigurationProps {
  instanceId: string;
  /** The wizard closed: the user finished or cancelled, or the session ended. */
  onClose?: () => void;
  /** Every message the wizard emits, uninterpreted. */
  onEvent?: (event: unknown) => void;
  onError?: (error: Error) => void;
  className?: string;
}

const affectedFamilies = [
  /* @__PURE__ */ keys.instances(),
  /* @__PURE__ */ keys.marketplace(),
  /* @__PURE__ */ keys.instance(),
  /* @__PURE__ */ keys.configuration(),
  /* @__PURE__ */ keys.userConfiguration(),
];

/**
 * Renders Prismatic's configuration wizard for an instance. It removes the wizard when the
 * wizard closes or this component unmounts, and refreshes whatever the wizard changed.
 */
export const HostedConfiguration = ({
  instanceId,
  onClose,
  onEvent,
  onError,
  className,
}: HostedConfigurationProps) => {
  const session = useSessionState();
  const refreshFamily = useRefreshFamily();
  const container = useRef<HTMLDivElement>(null);
  // An identity change moves refreshFamily, and the frame closes the wizard then; reading it
  // through the ref keeps the component from reopening the wizard for the new user.
  const callbacks = useRef({ onClose, onEvent, onError, refreshFamily });
  useEffect(() => {
    callbacks.current = { onClose, onEvent, onError, refreshFamily };
  });
  const client =
    session.status === "ready" && session.api ? session.client : null;

  useEffect(() => {
    if (!client || !container.current) return;
    const abort = new AbortController();
    client
      .openVisibleFrame({
        url: `/configure-instance/${encodeURIComponent(instanceId)}/?reconfigure=true`,
        container: container.current,
        title: "Integration configuration",
        signal: abort.signal,
        onEmbeddedEvent: (event) => callbacks.current.onEvent?.(event),
        onResourcesChanged: () => {
          for (const family of affectedFamilies)
            callbacks.current.refreshFamily(family);
        },
        onError: (error) => callbacks.current.onError?.(error),
        onClose: () => callbacks.current.onClose?.(),
      })
      .then(
        (mount) => abort.signal.addEventListener("abort", mount.dispose),
        (error: unknown) => {
          if (abort.signal.aborted) return;
          callbacks.current.onError?.(
            error instanceof Error ? error : new Error(String(error)),
          );
        },
      );
    return () => abort.abort();
  }, [client, instanceId]);

  return <div ref={container} className={className} />;
};
