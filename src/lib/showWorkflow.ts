import { Options } from "../types/options";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

export type ShowWorkflowBuilderProps = Options & {
  workflowId: string;
};

export const showWorkflow = ({
  workflowId,
  ...options
}: ShowWorkflowBuilderProps) => {
  assertInit("showWorkflowBuilder");

  setIframe(`/builder/${workflowId}/`, options, {});
};
