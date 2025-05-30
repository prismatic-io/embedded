import { Options } from "../types/options";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

export type ShowWorkflowsProps = Options & {};

export const showWorkflows = (options: ShowWorkflowsProps) => {
  assertInit("showWorkflows");

  setIframe("/workflows/", options, {});
};
