import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTicket } from "../storage";
import { Ticket } from "../types";

export default function TicketCreate() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Ticket["status"]>("open");
  const [priority, setPriority] = useState<Ticket["priority"]>("medium");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTicket({ title, description, status, priority });
    navigate("/");
  };

  return (
    <div>
      <h1>Create Ticket</h1>
      <form onSubmit={handleSubmit} style={{ maxWidth: 500 }}>
        <div style={{ marginBottom: 16 }}>
          <label>
            Title
            <br />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </label>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>
            Description
            <br />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </label>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>
            Status
            <br />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Ticket["status"])}
              style={{ width: "100%", boxSizing: "border-box" }}
            >
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="closed">Closed</option>
            </select>
          </label>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label>
            Priority
            <br />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Ticket["priority"])}
              style={{ width: "100%", boxSizing: "border-box" }}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
        </div>
        <button type="submit">Create</button>
      </form>
    </div>
  );
}
