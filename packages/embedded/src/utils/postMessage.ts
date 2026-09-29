import { getIframeElement, isIframe } from "./iframe";

interface PostMessageBase {
  event: unknown;
}

export interface SelectorPostMessage extends PostMessageBase {
  selector?: string;
}

export interface ElementPostMessage extends PostMessageBase {
  iframe: Element;
}

type PostMessageProps = SelectorPostMessage | ElementPostMessage;

/**
 * Returns the iframe element that sent a given `MessageEvent`. This is typically
 * used inside a `window.addEventListener("message", ...)` handler to identify
 * which Prismatic iframe dispatched an event, so you can pass it to
 * {@link setConfigVars} or perform other targeted operations.
 *
 * @param event - The `MessageEvent` received from `window.addEventListener("message", ...)`.
 * @returns The matching `HTMLIFrameElement`, or `undefined` if no iframe matches.
 *
 * @example
 * window.addEventListener("message", (event) => {
 *   if (event.data.event === "INSTANCE_CONFIGURATION_LOADED") {
 *     const iframe = prismatic.getMessageIframe(event);
 *     if (iframe) {
 *       prismatic.setConfigVars({
 *         iframe,
 *         configVars: { "My Config Var": { value: "preset-value" } },
 *       });
 *     }
 *   }
 * });
 *
 * @see {@link https://prismatic.io/docs/embed/marketplace/ | Embedding the Marketplace}
 */
export const getMessageIframe = (event: MessageEvent) =>
  Array.from(document.getElementsByTagName("iframe")).find(
    (iframe) => iframe.contentWindow === event.source,
  );

const isIframePostMessage = (
  props: PostMessageProps,
): props is ElementPostMessage => "iframe" in props;

export const postMessage = (props: PostMessageProps) => {
  const iframeElement = isIframePostMessage(props)
    ? props.iframe
    : getIframeElement(props.selector);

  if (!isIframe(iframeElement)) {
    return;
  }

  iframeElement.contentWindow?.postMessage(props.event, "*");
};
