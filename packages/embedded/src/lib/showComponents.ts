import type { Options } from "../types/options";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

export type ShowComponentsProps = Options & {};

/**
 * Renders the component browser, where your customer's users can browse
 * available components and their actions.
 *
 * Components can be filtered by category or label via the `filters` option.
 *
 * @param options - Display options for the components screen.
 *
 * @example
 * // Show components in a popover
 * prismatic.showComponents({ usePopover: true });
 *
 * @example
 * // Show components inline, filtered by category
 * prismatic.showComponents({
 *   selector: "#components-container",
 *   filters: { components: { category: "Data Platforms" } },
 * });
 *
 * @see {@link https://prismatic.io/docs/embed/additional-screens/show-components/ | Embedding Components}
 */
export const showComponents = (options: ShowComponentsProps) => {
  assertInit("showComponents");

  setIframe("/components/", options, {});
};
