import type { Options } from "../types/options";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

export type ShowLogsProps = Options & {};

/**
 * Renders the logs screen, where your customer's users can view execution
 * logs for their deployed instances.
 *
 * @param options - Display options for the logs screen.
 *
 * @example
 * // Show logs in a popover
 * prismatic.showLogs({ usePopover: true });
 *
 * @example
 * // Show logs inline
 * prismatic.showLogs({ selector: "#logs-container" });
 *
 * @see {@link https://prismatic.io/docs/embed/additional-screens/show-logs/ | Embedding Logs}
 */
export const showLogs = (options: ShowLogsProps) => {
  assertInit("showLogs");

  setIframe("/logs/", options, {});
};
