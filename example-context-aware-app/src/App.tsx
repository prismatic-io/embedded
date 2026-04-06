import { Routes, Route } from "react-router-dom";
import "./App.css";
import TicketList from "./pages/TicketList";
import TicketCreate from "./pages/TicketCreate";
import TicketDetail from "./pages/TicketDetail";
import TicketAutomations from "./pages/TicketAutomations";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<TicketList />} />
      <Route path="/tickets/create" element={<TicketCreate />} />
      <Route path="/tickets/:id" element={<TicketDetail />} />
      <Route
        path="/tickets/:id/automations/:automationId"
        element={<TicketAutomations />}
      />
    </Routes>
  );
}
