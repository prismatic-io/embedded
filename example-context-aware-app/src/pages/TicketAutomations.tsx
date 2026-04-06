import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import * as prismatic from "@prismatic-io/embedded";
import usePrismaticAuth from "../usePrismaticAuth";

const BUILDER_DIV_ID = "workflow-builder";

export default function TicketAutomations() {
  const { id, automationId } = useParams<{
    id: string;
    automationId: string;
  }>();
  const { authenticated } = usePrismaticAuth();

  useEffect(() => {
    if (!authenticated || !automationId) return;

    prismatic.showWorkflow({
      workflowId: automationId,
      selector: `#${BUILDER_DIV_ID}`,
    });
  }, [authenticated, automationId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ padding: "12px 0" }}>
        <Link to={`/tickets/${id}`}>← Back to ticket</Link>
      </div>
      <div
        id={BUILDER_DIV_ID}
        style={{ flex: 1, border: "1px solid #3a3a3a", borderRadius: 8 }}
      />
    </div>
  );
}
