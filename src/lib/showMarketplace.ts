import type { Options } from "../types/options";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

export type ShowMarketplaceProps = Options & {};

/**
 * Renders Prismatic's integration marketplace, where your customers can browse,
 * activate, and configure available integrations.
 *
 * The marketplace can be displayed in a popover (default) or rendered inline
 * within a specific DOM element using the `selector` option.
 *
 * @param options - Display options for the marketplace.
 *
 * @example
 * // Show marketplace in a popover
 * prismatic.showMarketplace({ usePopover: true });
 *
 * @example
 * // Show marketplace inline in a specific DOM element
 * prismatic.showMarketplace({
 *   selector: "#marketplace-container",
 *   theme: "DARK",
 *   filters: { marketplace: { category: "ERP" } },
 * });
 *
 * @see {@link https://prismatic.io/docs/embed/marketplace/ | Embedding the Marketplace}
 */
export const showMarketplace = (
  options: ShowMarketplaceProps = { usePopover: true },
) => {
  assertInit("showMarketplace");

  setIframe("/integration-marketplace/", options, {});
};
