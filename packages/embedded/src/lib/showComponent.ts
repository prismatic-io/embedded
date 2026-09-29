import type { Options } from "../types/options";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

export type ShowComponentProps = Options & {
  componentId: string;
};

/**
 * Renders the detail page for a specific component, showing its available
 * actions, triggers, and data sources.
 *
 * @param props - Display options including the component to show.
 * @param props.componentId - The ID of the component to display.
 *
 * @example
 * // Show a specific component in a popover
 * prismatic.showComponent({
 *   componentId: "Q29tcG9uZW50OmFiY2Rl...",
 *   usePopover: true,
 * });
 *
 * @example
 * // Show a specific component inline
 * prismatic.showComponent({
 *   componentId: "Q29tcG9uZW50OmFiY2Rl...",
 *   selector: "#component-detail",
 * });
 *
 * @see {@link https://prismatic.io/docs/embed/additional-screens/show-components/ | Embedding Components}
 */
export const showComponent = ({
  componentId,
  ...options
}: ShowComponentProps) => {
  assertInit("showComponent");

  setIframe(`/components/${componentId}/`, options, {});
};
