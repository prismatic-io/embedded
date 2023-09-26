import merge from "lodash.merge";

import { PrismaticMessageEvent } from "../types/postMessage";
import { isPopover, Options } from "../types/options";
import { openPopover } from "./popover";
import { postMessage } from "./postMessage";
import stateService, { ValidKeys } from "../state";
import urlJoin from "url-join";

export const EMBEDDED_ID = "pio__embedded";
export const EMBEDDED_IFRAME_ID = "pio__iframe";
export const EMBEDDED_IFRAME_CONTAINER_CLASS = "pio__iframeContainer";
export const EMBEDDED_IFRAME_CONTAINER_SELECTOR = `#${EMBEDDED_ID} .${EMBEDDED_IFRAME_CONTAINER_CLASS}`;
export const EMBEDDED_OVERLAY_CLASS = "pio__overlay";
export const EMBEDDED_OVERLAY_SELECTOR = `#${EMBEDDED_ID} > .${EMBEDDED_OVERLAY_CLASS}`;
export const EMBEDDED_OVERLAY_VISIBLE_CLASS = `${EMBEDDED_OVERLAY_CLASS}--is_visible`;
export const EMBEDDED_POPOVER_CLASS = "pio__popover";
export const EMBEDDED_POPOVER_CLOSE_CLASS = "pio__closeBtn";

export const getIframeContainerElement = (selector: string) =>
  document.querySelector(selector);

export const getIframeElement = (selector: string | undefined) =>
  document.querySelector(
    `${selector || EMBEDDED_IFRAME_CONTAINER_SELECTOR} > iframe`
  );

export const isIframe = (
  element?: Element | null
): element is HTMLIFrameElement =>
  Boolean(element && element.tagName === "IFRAME");

export const setIframe = (
  route: string,
  options: Options,
  params?: Record<string, string>
) => {
  if (!isPopover(options) && !options.selector) {
    console.error("Could not find display selector.");
  }

  const iframeContainerElement = getIframeContainerElement(
    isPopover(options) ? EMBEDDED_IFRAME_CONTAINER_SELECTOR : options.selector
  );

  if (!iframeContainerElement) {
    return;
  }

  // we use a copy of state so that changes to this only impact this iframe and do not update the shared state
  const state = stateService.getStateCopy();

  if (options) {
    Object.entries(options).forEach(([key, value]) => {
      if (ValidKeys.has(key)) {
        if (state[key] instanceof Object) {
          state[key] = merge(state[key], value);
        } else {
          state[key] = value;
        }
      }
    });
  }

  const queryParams = new URLSearchParams({
    ...params,
    embed: "true",
    jwt: state.jwt,
  });

  if (state.theme) {
    queryParams.set("theme", state.theme);
  }

  if (state.screenConfiguration?.initializing) {
    queryParams.set(
      "initializing",
      JSON.stringify(state.screenConfiguration.initializing)
    );
  }
  if (state.fontConfiguration) {
    queryParams.set(
      "fontConfiguration",
      JSON.stringify(state.fontConfiguration)
    );
  }

  const iframeSrc = `${urlJoin(state.prismaticUrl, route)}?${queryParams}`;

  iframeContainerElement.innerHTML = /* html */ `
    <iframe
      id="${EMBEDDED_IFRAME_ID}"
      src="${iframeSrc}"
      height="100%"
      width="100%"
      frameBorder="0"
      allow="clipboard-read; clipboard-write"
    ></iframe>
  `;

  const iframeElement = iframeContainerElement.querySelector("iframe");

  if (iframeElement) {
    window.addEventListener(
      "message",
      (event: MessageEvent<{ event: string }>) => {
        if (event.data?.event === "PRISMATIC_INITIALIZED") {
          postMessage({
            iframe: iframeElement,
            event: {
              event: PrismaticMessageEvent.SET_TOKEN,
              data: state.jwt,
            },
          });

          postMessage({
            iframe: iframeElement,
            event: {
              event: PrismaticMessageEvent.SET_VERSION,
              data: EMBEDDED_VERSION,
            },
          });

          postMessage({
            iframe: iframeElement,
            event: {
              event: PrismaticMessageEvent.SET_TRANSLATION,
              data: state.translation,
            },
          });

          postMessage({
            iframe: iframeElement,
            event: {
              event: PrismaticMessageEvent.SET_SCREEN_CONFIGURATION,
              data: state.screenConfiguration,
            },
          });

          postMessage({
            iframe: iframeElement,
            event: {
              event: PrismaticMessageEvent.SET_FILTERS,
              data: state.filters,
            },
          });
        }
      }
    );
  }

  if (iframeElement && options?.autoFocusIframe !== false) {
    iframeElement.addEventListener("mouseenter", () => {
      iframeElement.focus();
    });
  }

  if (isPopover(options)) {
    openPopover();
  }
};
