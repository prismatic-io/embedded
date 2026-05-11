import type { Options } from "../types/options";
import { PrismaticMessageEvent } from "../types/postMessage";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

export type ShowWorkflowBuilderProps = Options & {
  workflowId: string;
  onDelete?: () => void;
};

/**
 * Renders the workflow builder for a specific workflow, allowing your customer's
 * users to view and modify the workflow's steps, triggers, and configuration.
 *
 * @param props - Display options including the workflow to open.
 * @param props.workflowId - The ID of the workflow to open in the builder.
 * @param props.onDelete - Called when the workflow is deleted.
 * @returns A cleanup function that removes the event listeners, or `undefined` if onDelete was not provided.
 *
 * @example
 * // Open a specific workflow in a popover
 * const cleanup = prismatic.showWorkflow({
 *   workflowId: "V29ya2Zsb3c6YTFiMmMz...",
 *   onDelete: () => console.log(`Workflow deleted.`),
 *   usePopover: true,
 * });
 * // Call cleanup() when you're done to remove event listeners
 * cleanup?.();
 *
 * @example
 * // Open a specific workflow inline
 * prismatic.showWorkflow({
 *   workflowId: "V29ya2Zsb3c6YTFiMmMz...",
 *   selector: "#workflow-container",
 * });
 *
 * @example
 * // Open the workflow builder with the copilot panel already expanded
 * prismatic.showWorkflow({
 *   workflowId: "V29ya2Zsb3c6YTFiMmMz...",
 *   selector: "#workflow-container",
 *   screenConfiguration: {
 *     workflowBuilder: { copilot: { initialChatVisibility: "open" } },
 *   },
 * });
 *
 * @see {@link https://prismatic.io/docs/embed/workflow-builder/workflow-builder/ | Embedding the Workflow Builder}
 */
export const showWorkflow = ({
  workflowId,
  onDelete,
  ...options
}: ShowWorkflowBuilderProps) => {
  assertInit("showWorkflowBuilder");

  setIframe(`/builder/${workflowId}/`, options, {});

  if (onDelete) {
    const abortController = new AbortController();

    window.addEventListener(
      "message",
      (event: MessageEvent<{ event: string }>) => {
        if (event.data?.event === PrismaticMessageEvent.WORKFLOW_DELETED) {
          onDelete();
        }
      },
      { signal: abortController.signal },
    );

    return () => abortController.abort();
  }
};
