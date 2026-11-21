import type { CrmRecord } from "./fake-crm";

/**
 * The fields of a contact in Acme, the app this integration sends data to.
 * Each one is mapped from a field of the customer's chosen Fake CRM record type.
 */
export const ACME_CONTACT_FIELDS = [
  { key: "email", label: "Email", required: true },
  { key: "firstName", label: "First name", required: false },
  { key: "lastName", label: "Last name", required: true },
  { key: "phone", label: "Phone", required: false },
  { key: "company", label: "Company", required: false },
  { key: "jobTitle", label: "Job title", required: false },
] as const;

export type AcmeContactField = (typeof ACME_CONTACT_FIELDS)[number]["key"];

export type AcmeContact = Partial<Record<AcmeContactField, string>>;

/** For each Acme contact field, the Fake CRM field it's read from. */
export type FieldMapping = Partial<Record<AcmeContactField, string>>;

/**
 * Builds an Acme contact from a Fake CRM record. The flow and the
 * `getSampleRecord` server function both use this, so the preview a customer
 * sees while configuring is exactly what the flow sends.
 */
export function toAcmeContact(record: CrmRecord, mapping: FieldMapping): AcmeContact {
  const contact: AcmeContact = {};
  for (const { key } of ACME_CONTACT_FIELDS) {
    const crmField = mapping[key];
    const value = crmField ? record[crmField] : undefined;
    if (value !== undefined && value !== null && value !== "") {
      contact[key] = String(value);
    }
  }
  return contact;
}
