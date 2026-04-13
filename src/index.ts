import * as methods from "./lib";

export * from "./lib";

export * from "./types";
export { closePopover } from "./utils/popover";
export { getMessageIframe } from "./utils/postMessage";

export default {
  ...methods,
};
