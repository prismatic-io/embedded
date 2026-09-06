import type { Options } from "../types/options";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

export type ShowConnectionsProps = Options & {};

/**
 * Renders the connections management screen, where your customer's users can
 * view and manage their reusable credential connections.
 *
 * @param options - Display options for the connections screen.
 *
 * @example
 * // Show connections in a popover
 * prismatic.showConnections({ usePopover: true });
 *
 * @example
 * // Show connections inline
 * prismatic.showConnections({ selector: "#connections-container" });
 *
 * @see {@link https://prismatic.io/docs/embed/additional-screens/show-connections/ | Embedding Connections}
 */
export const showConnections = (options: ShowConnectionsProps) => {
  assertInit("showConnections");

  setIframe("/customer-connections/", options, {});
};
