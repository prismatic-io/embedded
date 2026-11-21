import type { Connection } from "@prismatic-io/spectral";

/**
 * A small HubSpot API client. It calls HubSpot's REST API with the OAuth
 * access token of the customer's HubSpot connection, so the integration needs
 * no component.
 */

const HUBSPOT_API = "https://api.hubapi.com";

/** A contact as Acme sends it to the integration's webhook. */
export interface AcmeContact {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
}

/** The access token of an OAuth 2.0 connection. */
export function accessToken(connection: Connection | undefined): string {
  const token = connection?.token?.access_token;
  if (typeof token !== "string" || !token) {
    throw new Error("The HubSpot connection has no access token. Connect HubSpot again.");
  }
  return token;
}

async function hubspot<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${HUBSPOT_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`HubSpot returned ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as T;
}

/** HubSpot's properties for an Acme contact. Empty fields are left out. */
export function toHubSpotProperties(contact: AcmeContact): Record<string, string> {
  const properties: Record<string, string | undefined> = {
    email: contact.email,
    firstname: contact.firstName,
    lastname: contact.lastName,
    phone: contact.phone,
    company: contact.company,
    jobtitle: contact.jobTitle,
  };
  return Object.fromEntries(
    Object.entries(properties).filter((entry): entry is [string, string] => !!entry[1]),
  );
}

/** Creates or updates HubSpot contacts, matched by email. */
export async function upsertContacts(
  token: string,
  contacts: AcmeContact[],
): Promise<{ id: string; email: string }[]> {
  const result = await hubspot<{
    results: { id: string; properties: { email: string } }[];
  }>(token, "/crm/v3/objects/contacts/batch/upsert", {
    method: "POST",
    body: JSON.stringify({
      inputs: contacts.map((contact) => ({
        id: contact.email,
        idProperty: "email",
        properties: toHubSpotProperties(contact),
      })),
    }),
  });
  return result.results.map(({ id, properties }) => ({ id, email: properties.email }));
}
