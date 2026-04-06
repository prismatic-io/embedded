declare module "@prismatic-io/embedded" {
  interface WorkflowContexts {
    "ticket-automation": {
      ticketId: string;
      title: string;
      priority: "low" | "medium" | "high" | "critical";
    };
  }
}
