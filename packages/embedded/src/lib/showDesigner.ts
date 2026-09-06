import type { Options } from "../types/options";
import { assertEmbeddedDesigner } from "../utils/assertEmbeddedDesigner";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

export type ShowDesignerProps = Options & {
  integrationId: string;
};

/**
 * Renders the embedded integration designer for a specific integration, allowing
 * your customer's users to build and modify integration workflows.
 *
 * Requires the embedded designer feature to be enabled for the customer.
 *
 * @param props - Display options including the integration to open.
 * @param props.integrationId - The ID of the integration to open in the designer.
 *
 * @example
 * // Open the designer for a specific integration in a popover
 * prismatic.showDesigner({
 *   integrationId: "SW50ZWdyYXRpb246YzNmOGU...",
 *   usePopover: true,
 * });
 *
 * @example
 * // Open the designer inline
 * prismatic.showDesigner({
 *   integrationId: "SW50ZWdyYXRpb246YzNmOGU...",
 *   selector: "#designer-container",
 * });
 *
 * @see {@link https://prismatic.io/docs/embed/workflow-builder/workflow-builder/ | Embedding the Workflow Builder}
 */
export const showDesigner = ({
  integrationId,
  ...options
}: ShowDesignerProps) => {
  assertInit("showDesigner");
  assertEmbeddedDesigner("showDesigner");

  setIframe(`/integrations/${integrationId}/`, options, {});
};
