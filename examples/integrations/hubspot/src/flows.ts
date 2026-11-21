import { flow } from "@prismatic-io/spectral";
import { type AcmeContact, accessToken, upsertContacts } from "./hubspot";

/**
 * Reads the contacts from a webhook request. Acme sends either one contact or
 * `{ "contacts": [...] }`. Contacts without an email are skipped, since HubSpot
 * matches contacts by email.
 */
export function contactsFromPayload(body: unknown): AcmeContact[] {
  if (!body || typeof body !== "object") return [];
  const contacts = Array.isArray((body as { contacts?: unknown }).contacts)
    ? (body as { contacts: unknown[] }).contacts
    : [body];
  return contacts.filter(
    (contact): contact is AcmeContact =>
      !!contact &&
      typeof contact === "object" &&
      typeof (contact as AcmeContact).email === "string" &&
      (contact as AcmeContact).email !== "",
  );
}

export const syncContactsToHubSpot = flow({
  name: "Sync Contacts to HubSpot",
  stableKey: "sync-contacts-to-hubspot",
  description: "Creates or updates HubSpot contacts from the Acme contacts posted to its webhook",
  onExecution: async (context, params) => {
    const contacts = contactsFromPayload(params.onTrigger.results.body.data);
    if (contacts.length === 0) {
      context.logger.warn("The request had no contacts with an email address.");
      return { data: { synced: [] } };
    }

    const token = accessToken(context.connections?.instance?.hubspot);
    const synced = await upsertContacts(token, contacts);
    context.logger.info(`Synced ${synced.length} contacts to HubSpot`);
    return { data: { synced } };
  },
});

export default [syncContactsToHubSpot];
