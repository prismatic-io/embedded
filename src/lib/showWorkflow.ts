import type { Options } from "../types/options";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

export type ShowWorkflowBuilderProps = Options & {
  workflowId: string;
};

/**
 * Renders the workflow builder for a specific workflow, allowing your customer's
 * users to view and modify the workflow's steps, triggers, and configuration.
 *
 * @param props - Display options including the workflow to open.
 * @param props.workflowId - The ID of the workflow to open in the builder.
 *
 * @example
 * // Open a specific workflow in a popover
 * prismatic.showWorkflow({
 *   workflowId: "V29ya2Zsb3c6YTFiMmMz...",
 *   usePopover: true,
 * });
 *
 * @example
 * // Open a specific workflow inline
 * prismatic.showWorkflow({
 *   workflowId: "V29ya2Zsb3c6YTFiMmMz...",
 *   selector: "#workflow-container",
 * });
 *
 * @see {@link https://prismatic.io/docs/embed/workflow-builder/workflow-builder/ | Embedding the Workflow Builder}
 */
export const showWorkflow = ({
  workflowId,
  ...options
}: ShowWorkflowBuilderProps) => {
  assertInit("showWorkflowBuilder");

  setIframe(`/builder/${workflowId}/`, options, {});
};
