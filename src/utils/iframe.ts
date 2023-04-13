import merge from "lodash.merge";

import { PrismaticMessageEvent } from "../types/postMessage";
import { isPopover, Options } from "../types/options";
import { openPopover } from "./popover";
import { postMessage } from "./postMessage";
import { state } from "../state";

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

  if (options) {
    Object.entries(options).forEach(([key, value]) => {
      if (key in state) {
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

  iframeContainerElement.innerHTML = /* html */ `
    <iframe 
      id="${EMBEDDED_IFRAME_ID}"
      src="${state.prismaticUrl}/${route}/?${queryParams.toString()}" 
      height="100%" 
      width="100%" 
      frameBorder="0"
      allow="clipboard-read; clipboard-write"
    ></iframe>
  `;

  const iframeElement = iframeContainerElement.querySelector("iframe");

  if (iframeElement && options?.autoFocusIframe !== false) {
    iframeElement.addEventListener("mouseenter", () => {
      iframeElement.focus();
    });
  }

  if (isPopover(options)) {
    openPopover();
  }

  if (iframeElement) {
    iframeElement.onload = () => {
      // TODO: JC - This is redundant for the fact that the JWT is still being passed as a query param. We'll eventually do this refactor to avoid passing the JWT as a query param. Reference https://github.com/prismatic-io/prismatic/pull/5324
      if (state.jwt) {
        postMessage({
          iframe: iframeElement,
          event: {
            event: PrismaticMessageEvent.SET_TOKEN,
            data: state.jwt,
          },
        });
      }

      if (EMBEDDED_VERSION) {
        postMessage({
          iframe: iframeElement,
          event: {
            event: PrismaticMessageEvent.SET_VERSION,
            data: EMBEDDED_VERSION,
          },
        });
      }

      if (state.translation) {
        postMessage({
          iframe: iframeElement,
          event: {
            event: PrismaticMessageEvent.SET_TRANSLATION,
            data: state.translation,
          },
        });
      }

      if (state.screenConfiguration) {
        postMessage({
          iframe: iframeElement,
          event: {
            event: PrismaticMessageEvent.SET_SCREEN_CONFIGURATION,
            data: state.screenConfiguration,
          },
        });
      }

      if (state.filters) {
        postMessage({
          iframe: iframeElement,
          event: {
            event: PrismaticMessageEvent.SET_FILTERS,
            data: state.filters,
          },
        });
      }
    };
  }
};
