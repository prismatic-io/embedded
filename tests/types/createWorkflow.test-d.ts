/**
 * Type tests for createWorkflow with module augmentation.
 *
 * Validates that generated .d.ts files correctly augment
 * WorkflowContexts and that createWorkflow enforces the
 * augmented contextData shapes.
 *
 * The fixture at ./fixtures/prismatic.d.ts simulates the
 * output of `generate-types`.
 */
import { expectTypeOf } from "expect-type";
import { createWorkflow } from "../../src/lib/createWorkflow";
import type { WorkflowContexts } from "../../src/lib/createWorkflow";

// ---------------------------------------------------------------------------
// WorkflowContexts is augmented with the fixture's keys
// ---------------------------------------------------------------------------

expectTypeOf<WorkflowContexts>().toHaveProperty("ticket-automation");
expectTypeOf<WorkflowContexts>().toHaveProperty("product-automation");

expectTypeOf<WorkflowContexts["ticket-automation"]>().toEqualTypeOf<{
  ticketId: string;
}>();

expectTypeOf<WorkflowContexts["product-automation"]>().toEqualTypeOf<{
  projectId: string;
}>();

// ---------------------------------------------------------------------------
// createWorkflow accepts valid contextData for known keys
// ---------------------------------------------------------------------------

createWorkflow("ticket-automation", {
  name: "test",
  contextData: { ticketId: "123" },
});

createWorkflow("product-automation", {
  name: "test",
  contextData: { projectId: "proj-1" },
});

// ---------------------------------------------------------------------------
// createWorkflow rejects invalid contextData for known keys
// ---------------------------------------------------------------------------

createWorkflow("ticket-automation", {
  name: "test",
  // @ts-expect-error — ticketId is missing, wrongField is not valid
  contextData: { wrongField: "oops" },
});

createWorkflow("product-automation", {
  name: "test",
  // @ts-expect-error — projectId is missing, wrongField is not valid
  contextData: { wrongField: "oops" },
});

// ---------------------------------------------------------------------------
// createWorkflow allows unknown keys with any contextData
// ---------------------------------------------------------------------------

createWorkflow("unknown-workflow", {
  name: "test",
  contextData: { anything: "goes" },
});
