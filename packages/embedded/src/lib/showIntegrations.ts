import type { Options } from "../types/options";
import { assertEmbeddedDesigner } from "../utils/assertEmbeddedDesigner";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

export type ShowIntegrationsProps = Options & {};

/**
 * Renders the integrations list screen, where your customer's users can view
 * and manage integrations they have built with the embedded designer.
 *
 * Requires the embedded designer feature to be enabled for the customer.
 *
 * @param options - Display options for the integrations list.
 *
 * @example
 * // Show integrations list in a popover
 * prismatic.showIntegrations({ usePopover: true });
 *
 * @example
 * // Show integrations list inline
 * prismatic.showIntegrations({ selector: "#integrations-container" });
 */
export const showIntegrations = (options: ShowIntegrationsProps) => {
  assertInit("showIntegrations");
  assertEmbeddedDesigner("showIntegrations");

  setIframe("/integrations/", options, {});
};
