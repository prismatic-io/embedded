/** A visible embedded document with its event channel connected to the hidden frame. */
export interface VisibleFrameMount {
  iframe: HTMLIFrameElement;
  dispose: () => void;
}

export interface OpenVisibleFrameOptions {
  /** An embedded route on the same Prismatic origin as the headless frame. */
  url: string;
  container: HTMLElement;
  title?: string;
  timeoutMs?: number;
  /** Uninterpreted messages from this mount's port, including future event types. */
  onEmbeddedEvent?: (message: unknown) => void;
  /** The frame finished reconciling a change to server-backed resources. */
  onResourcesChanged?: () => void;
  onError?: (error: Error) => void;
  /** The frame closed this mount: the wizard closed, or the session was revoked. */
  onClose?: () => void;
  /** Aborting disposes the mount, including while it is still opening. */
  signal?: AbortSignal;
}

export const VISIBLE_PORT_EVENT = "PRISMATIC_HEADLESS_VISIBLE_PORT";
export const VISIBLE_PORT_CLOSE_EVENT = "PRISMATIC_HEADLESS_VISIBLE_CLOSE";
export const VISIBLE_PORT_READY_EVENT = "PRISMATIC_HEADLESS_VISIBLE_READY";
export const VISIBLE_PORT_EMBEDDED_EVENT = "PRISMATIC_HEADLESS_EMBEDDED_EVENT";
export const VISIBLE_PORT_RESOURCES_CHANGED =
  "PRISMATIC_HEADLESS_RESOURCES_CHANGED";
export const VISIBLE_PORT_RECONCILE_ERROR =
  "PRISMATIC_HEADLESS_RECONCILE_ERROR";

export const openVisibleFrame = (
  {
    url,
    container,
    title = "Embedded content",
    timeoutMs = 30_000,
    onEmbeddedEvent,
    onResourcesChanged,
    onError,
    onClose,
    signal: callerSignal,
  }: OpenVisibleFrameOptions,
  headlessFrame: HTMLIFrameElement,
  prismaticOrigin: string,
  isDisposed: () => boolean,
  signal: AbortSignal,
): Promise<VisibleFrameMount> => {
  const target = new URL(url, prismaticOrigin);
  if (target.origin !== prismaticOrigin)
    throw new Error(
      "The configuration view must use the embedded application origin",
    );
  target.searchParams.set("hostOrigin", window.location.origin);
  target.searchParams.set("embed", "true");
  const iframe = document.createElement("iframe");
  iframe.src = target.toString();
  iframe.title = title;
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "0";
  iframe.allow = "clipboard-read; clipboard-write";
  const channel = new MessageChannel();
  const id = crypto.randomUUID();
  let disposed = false;
  let offered = false;
  let readyReceived = false;
  let transferred = false;
  let timer: ReturnType<typeof setTimeout>;
  let rejectPending: ((reason: Error) => void) | undefined;
  let resolvePending: ((mount: VisibleFrameMount) => void) | undefined;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    clearTimeout(timer);
    signal.removeEventListener("abort", dispose);
    callerSignal?.removeEventListener("abort", dispose);
    window.removeEventListener("message", onMessage);
    iframe.removeEventListener("error", onFrameError);
    rejectPending?.(new Error("Visible frame was disposed"));
    rejectPending = undefined;
    headlessFrame.contentWindow?.postMessage(
      { type: VISIBLE_PORT_CLOSE_EVENT, id },
      prismaticOrigin,
    );
    channel.port1.close();
    if (!transferred) channel.port2.close();
    iframe.remove();
  };
  const onFrameError = () => dispose();
  const onMessage = (event: MessageEvent) => {
    if (disposed || isDisposed() || event.origin !== prismaticOrigin) return;
    if (
      event.source === iframe.contentWindow &&
      event.data?.event === "PRISMATIC_HOST_READY" &&
      !offered
    ) {
      offered = true;
      iframe.contentWindow?.postMessage(
        { event: "PRISMATIC_HOST_PORT" },
        prismaticOrigin,
        [channel.port1],
      );
    } else if (
      event.source === headlessFrame.contentWindow &&
      event.data?.type === VISIBLE_PORT_CLOSE_EVENT &&
      event.data.id === id
    ) {
      const opened = readyReceived;
      dispose();
      if (opened) onClose?.();
    } else if (
      event.source === headlessFrame.contentWindow &&
      event.data?.type === VISIBLE_PORT_EMBEDDED_EVENT &&
      event.data.id === id &&
      readyReceived
    ) {
      onEmbeddedEvent?.(event.data.data);
    } else if (
      event.source === headlessFrame.contentWindow &&
      event.data?.type === VISIBLE_PORT_RESOURCES_CHANGED &&
      event.data.id === id &&
      readyReceived
    ) {
      onResourcesChanged?.();
    } else if (
      event.source === headlessFrame.contentWindow &&
      event.data?.type === VISIBLE_PORT_RECONCILE_ERROR &&
      event.data.id === id &&
      readyReceived &&
      typeof event.data.message === "string"
    ) {
      onError?.(new Error(event.data.message));
    } else if (
      event.source === headlessFrame.contentWindow &&
      event.data?.type === VISIBLE_PORT_READY_EVENT &&
      event.data.id === id &&
      offered
    ) {
      readyReceived = true;
      clearTimeout(timer);
      rejectPending = undefined;
      iframe.removeEventListener("error", onFrameError);
      resolvePending?.({ iframe, dispose });
    }
  };
  const ready = new Promise<VisibleFrameMount>((resolve, reject) => {
    resolvePending = resolve;
    rejectPending = reject;
  });
  window.addEventListener("message", onMessage);
  iframe.addEventListener("error", onFrameError);
  signal.addEventListener("abort", dispose, { once: true });
  callerSignal?.addEventListener("abort", dispose, { once: true });
  timer = setTimeout(() => {
    rejectPending?.(
      new Error("Visible frame did not complete its channel handshake"),
    );
    rejectPending = undefined;
    dispose();
  }, timeoutMs);
  container.appendChild(iframe);
  if (isDisposed() || callerSignal?.aborted) {
    dispose();
    return ready;
  }
  headlessFrame.contentWindow?.postMessage(
    {
      type: VISIBLE_PORT_EVENT,
      id,
      path: target.pathname,
      port: channel.port2,
    },
    prismaticOrigin,
    [channel.port2],
  );
  transferred = Boolean(headlessFrame.contentWindow);
  return ready;
};
