import { PrismaticMessageEvent } from "../types/postMessage";
import {
  EMBEDDED_IFRAME_CONTAINER_SELECTOR,
  EMBEDDED_OVERLAY_SELECTOR,
  EMBEDDED_OVERLAY_VISIBLE_CLASS,
  getIframeContainerElement,
  isIframe,
} from "./iframe";

export const getPopover = () =>
  document.querySelector(EMBEDDED_OVERLAY_SELECTOR);

export const openPopover = () => {
  getPopover()?.classList.add(EMBEDDED_OVERLAY_VISIBLE_CLASS);
};

/**
 * Programmatically closes the currently open Prismatic popover. This notifies
 * the embedded iframe that the marketplace was closed and dispatches a
 * `POPOVER_CLOSED` event on the window.
 *
 * The popover also closes automatically when the user clicks the close button,
 * clicks the overlay backdrop, or presses the Escape key.
 *
 * @example
 * // Close the popover from your own UI
 * document.getElementById("my-close-btn")
 *   .addEventListener("click", () => prismatic.closePopover());
 *
 * @example
 * // Listen for the popover closed event
 * window.addEventListener("message", (event) => {
 *   if (event.data.event === "POPOVER_CLOSED") {
 *     console.log("Popover was closed");
 *   }
 * });
 *
 * @see {@link https://prismatic.io/docs/embed/marketplace/ | Embedding the Marketplace}
 */
export const closePopover = () => {
  const iframeElement = getIframeContainerElement(
    `${EMBEDDED_IFRAME_CONTAINER_SELECTOR} > iframe`,
  );

  if (!isIframe(iframeElement)) {
    return;
  }

  iframeElement.contentWindow?.postMessage(
    { event: PrismaticMessageEvent.MARKETPLACE_CLOSED },
    "*",
  );

  window.postMessage({ event: PrismaticMessageEvent.POPOVER_CLOSED }, "*");

  getPopover()?.classList.remove(EMBEDDED_OVERLAY_VISIBLE_CLASS);
};
