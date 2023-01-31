import { styles } from "../styles";
import { closePopover } from "../utils/popover";
import { state, State } from "../state";
import {
  EMBEDDED_ID,
  EMBEDDED_IFRAME_CLASS,
  EMBEDDED_OVERLAY_CLASS,
  EMBEDDED_OVERLAY_SELECTOR,
  EMBEDDED_OVERLAY_VISIBLE_CLASS,
  EMBEDDED_POPOVER_CLASS,
  EMBEDDED_POPOVER_CLOSE_CLASS,
} from "../utils/iframe";

export interface InitProps
  extends Pick<State, "screenConfiguration" | "theme" | "translation">,
    Partial<Pick<State, "filters" | "prismaticUrl">> {}

export const init = (options?: InitProps) => {
  const existingElement = document.getElementById(EMBEDDED_ID);

  if (existingElement) {
    return;
  }

  if (options) {
    Object.entries(options).forEach(([key, value]) => {
      if (key in state) {
        state[key] = value;
      }
    });
  }

  state.initComplete = true;

  document.head.insertAdjacentHTML("beforeend", styles);

  const embeddedElement = document.createElement("div");

  embeddedElement.id = EMBEDDED_ID;

  embeddedElement.innerHTML = /* html */ `
    <div class="${EMBEDDED_OVERLAY_CLASS}">
      <div class="${EMBEDDED_POPOVER_CLASS}">
        <button class="${EMBEDDED_POPOVER_CLOSE_CLASS}" aria-label="close popover" data-close>✕</button>
        <div class="${EMBEDDED_IFRAME_CLASS}"></div>
      </div>
    </div>
  `;

  document.body.appendChild(embeddedElement);

  const closeButtonElement = document.querySelector(
    `#${EMBEDDED_ID} .${EMBEDDED_POPOVER_CLOSE_CLASS}`
  );

  const overlayElement = document.querySelector(EMBEDDED_OVERLAY_SELECTOR);

  overlayElement?.addEventListener("click", (event) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    closePopover();
  });

  closeButtonElement?.addEventListener("click", () => closePopover());

  document.addEventListener("keyup", (e) => {
    if (
      e.key === "Escape" &&
      document.querySelector(`.${EMBEDDED_OVERLAY_VISIBLE_CLASS}`)
    ) {
      closePopover();
    }
  });
};
