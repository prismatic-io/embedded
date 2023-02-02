import {
  EMBEDDED_IFRAME_CLASS,
  EMBEDDED_OVERLAY_CLASS,
  EMBEDDED_OVERLAY_VISIBLE_CLASS,
  EMBEDDED_POPOVER_CLASS,
  EMBEDDED_POPOVER_CLOSE_CLASS,
} from "./utils/iframe";

export const styles = /* html */ `<style>
  .${EMBEDDED_OVERLAY_CLASS} {
    backdrop-filter: blur(10px);
    background: rgb(119 119 119 / 29%);
    bottom: 0;
    display: block;
    left: 0;
    opacity: 0;
    position: fixed;
    right: 0;
    top: 0;
    transition: all 0.3s ease-in;
    visibility: hidden;
    z-index: 9999;
  }
  .${EMBEDDED_OVERLAY_CLASS}.${EMBEDDED_OVERLAY_VISIBLE_CLASS} {
    opacity: 1;
    visibility: visible;
  }
  .${EMBEDDED_POPOVER_CLASS} {
    background: #fff;
    border-radius: 4px;
    bottom: 0;
    height: 80vh;
    left: 0;
    margin: auto;
    overflow: hidden;
    position: absolute;
    right: 0;
    top: 0;
    width: 80vw;
  }
  .${EMBEDDED_POPOVER_CLOSE_CLASS} {
    all: unset;
    cursor: pointer;
    position: absolute;
    right: 1.5em;
    top: 1.3em;
  }
  .${EMBEDDED_IFRAME_CLASS} {
    height: 100%
  }
</style>`;
