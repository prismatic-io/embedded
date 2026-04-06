import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as prismatic from "@prismatic-io/embedded";
import { getTicket } from "../storage";
import usePrismaticAuth from "../usePrismaticAuth";

interface Workflow {
  id: string;
  name: string;
  description: string;
}

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const ticket = id ? getTicket(id) : undefined;
  const { authenticated } = usePrismaticAuth();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkflows = () => {
    setLoading(true);
    prismatic
      .queryWorkflows({
        contextStableKey: "ticket-automation",
        externalId: ticket.id,
      })
      .then((result) => {
        setWorkflows(result.data.workflows.nodes);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!authenticated) return;
    fetchWorkflows();
  }, [authenticated]);

  const handleCreateAutomation = async () => {
    if (!ticket) return;
    const result = await prismatic.createWorkflow("ticket-automation", {
      name: `Automation for ${ticket.title}`,
      contextData: {
        ticketId: ticket.id,
        title: ticket.title,
        priority: ticket.priority ?? "low",
      },
      externalId: ticket.id,
    });
    const workflowId = result.data.importWorkflow.workflow.id;
    navigate(`/tickets/${ticket.id}/automations/${workflowId}`);
  };

  if (!ticket) {
    return (
      <div>
        <h1>Ticket not found</h1>
        <Link to="/">Back to list</Link>
      </div>
    );
  }

  return (
    <div>
      <Link to="/">← Back to list</Link>
      <h1>{ticket.title}</h1>
      <p>
        <strong>Status:</strong> {ticket.status}
      </p>
      <p>
        <strong>Created:</strong>{" "}
        {new Date(ticket.createdAt).toLocaleDateString()}
      </p>
      <p>{ticket.description}</p>

      <hr />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2>Workflows</h2>
        <button onClick={handleCreateAutomation}>+ Create Automation</button>
      </div>
      {loading ? (
        <p>Loading workflows…</p>
      ) : workflows.length === 0 ? (
        <p>No workflows found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {workflows.map((wf) => (
              <tr key={wf.id}>
                <td>{wf.name}</td>
                <td>{wf.description}</td>
                <td>
                  <Link to={`/tickets/${ticket.id}/automations/${wf.id}`}>
                    Open Builder →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
