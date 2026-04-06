import { Ticket } from "./types";

const STORAGE_KEY = "tickets";

export function getTickets(): Ticket[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function getTicket(id: string): Ticket | undefined {
  return getTickets().find((t) => t.id === id);
}

export function createTicket(
  ticket: Omit<Ticket, "id" | "createdAt">
): Ticket {

  const tickets = getTickets();
  const newTicket: Ticket = {
    ...ticket,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  tickets.push(newTicket);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  return newTicket;
}
