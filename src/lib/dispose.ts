import stateService from "../state";
import {
  EMBEDDED_ID,
  EMBEDDED_IFRAME_PRELOAD_ID,
  EMBEDDED_STYLE_ID,
} from "../utils/iframe";
import { releaseListeners } from "./init";

/**
 * Removes every DOM node, listener, and piece of in-memory state created by
 * {@link init}. Use this when the embedded experience is being unmounted
 * (SPA route change, logout, conditional render) or to fully reset between
 * tests.
 *
 * After `dispose`, the next call to {@link init} starts from a clean slate:
 * the popover DOM, preload iframe, and stylesheet are recreated, and a fresh
 * Escape-key listener is attached.
 *
 * Calling `dispose` before `init`, or twice in a row, is a safe no-op.
 *
 * @example
 * // Fully reset the SDK
 * prismatic.dispose();
 *
 * @example
 * // Re-initialize with new options
 * prismatic.dispose();
 * prismatic.init({ theme: "DARK" });
 */
export const dispose = () => {
  document.getElementById(EMBEDDED_ID)?.remove();
  document.getElementById(EMBEDDED_IFRAME_PRELOAD_ID)?.remove();
  document.getElementById(EMBEDDED_STYLE_ID)?.remove();

  releaseListeners();

  stateService.setState(stateService.getInitialState());
};
