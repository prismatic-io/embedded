import {
  EMBEDDED_IFRAME_CONTAINER_SELECTOR,
  EMBEDDED_OVERLAY_SELECTOR,
  EMBEDDED_OVERLAY_VISIBLE_CLASS,
  getIframeContainerElement,
  isIframe,
} from "./iframe";
import { PrismaticMessageEvent } from "../types/postMessage";

export const getPopover = () =>
  document.querySelector(EMBEDDED_OVERLAY_SELECTOR);

export const openPopover = () =>
  getPopover()?.classList.add(EMBEDDED_OVERLAY_VISIBLE_CLASS);

export const closePopover = () => {
  const iframeElement = getIframeContainerElement(
    `${EMBEDDED_IFRAME_CONTAINER_SELECTOR} > iframe`
  );

  if (!isIframe(iframeElement)) {
    return;
  }

  iframeElement.contentWindow?.postMessage(
    { event: PrismaticMessageEvent.MARKETPLACE_CLOSED },
    "*"
  );

  getPopover()?.classList.remove(EMBEDDED_OVERLAY_VISIBLE_CLASS);
};
