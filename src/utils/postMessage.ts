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

export const getMessageIframe = (event: MessageEvent) =>
  Array.from(document.getElementsByTagName("iframe")).find(
    (iframe) => iframe.contentWindow === event.source
  );

const isIframePostMessage = (
  props: PostMessageProps
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
