// Fixture: simulates the output of `generate-types` for type testing.
// This augments WorkflowContexts the same way a consumer's generated
// file would, but targets the source path since these tests compile
// against src/ (not dist/).

export {};

declare module "../../../src/lib/createWorkflow" {
  interface WorkflowContexts {
    "ticket-automation": { ticketId: string };
    "product-automation": { projectId: string };
  }
}
