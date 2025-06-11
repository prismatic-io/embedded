import { Options } from "../types/options";
import { assertEmbeddedDesigner } from "../utils/assertEmbeddedDesigner";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

export type ShowWorkflowsProps = Options & {};

export const showWorkflows = (options: ShowWorkflowsProps) => {
  assertInit("showWorkflows");
  assertEmbeddedDesigner("showWorkflows");

  setIframe("/workflows/", options, {});
};
