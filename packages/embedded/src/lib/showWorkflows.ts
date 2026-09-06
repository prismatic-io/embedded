import type { Options } from "../types/options";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

export type ShowWorkflowsProps = Options & {};

/**
 * Renders the workflows list screen, where your customer's users can browse
 * and manage their workflows.
 *
 * Set `screenConfiguration.workflows.includeIntegrations` to also display
 * integrations alongside workflows.
 *
 * @param options - Display options for the workflows list.
 *
 * @example
 * // Show workflows list in a popover
 * prismatic.showWorkflows({ usePopover: true });
 *
 * @example
 * // Show workflows inline, including integrations
 * prismatic.showWorkflows({
 *   selector: "#workflows-container",
 *   screenConfiguration: {
 *     workflows: { includeIntegrations: true },
 *   },
 * });
 *
 * @see {@link https://prismatic.io/docs/embed/workflow-builder/workflow-builder/ | Embedding the Workflow Builder}
 */
export const showWorkflows = (options: ShowWorkflowsProps) => {
  assertInit("showWorkflows");

  setIframe("/workflows/", options, {});
};
