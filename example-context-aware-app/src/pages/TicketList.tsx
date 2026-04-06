import { Link } from "react-router-dom";
import { getTickets } from "../storage";

export default function TicketList() {
  const tickets = getTickets();

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1>Tickets</h1>
        <Link to="/tickets/create">+ New Ticket</Link>
      </div>
      {tickets.length === 0 ? (
        <p>No tickets yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td>
                  <Link to={`/tickets/${ticket.id}`}>{ticket.title}</Link>
                </td>
                <td>{ticket.status}</td>
                <td>{new Date(ticket.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
