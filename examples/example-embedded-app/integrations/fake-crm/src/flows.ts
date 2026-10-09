import { flow } from "@prismatic-io/spectral";
import { type AcmeContact, toAcmeContact } from "./acme";
import type { Configuration } from "./configuration";
import { listRecords } from "./fake-crm";

/**
 * Reads every record of the configured type from Fake CRM and maps each one to
 * an Acme contact. Kept apart from the flow so it can be tested directly.
 */
export function buildAcmeContacts(configuration: Configuration): AcmeContact[] {
  return listRecords(configuration.recordType).map((record) =>
    toAcmeContact(record, configuration.fieldMapping),
  );
}

export const syncContactsToAcme = flow({
  name: "Sync Contacts to Acme",
  stableKey: "sync-contacts-to-acme",
  description: "Maps Fake CRM records to Acme contacts and logs what it would send to Acme",
  onExecution: async (context) => {
    // Typed from the configuration schema and already validated when it was saved.
    const { configuration } = context;
    if (!configuration) {
      throw new Error("This instance has no saved configuration.");
    }

    const contacts = buildAcmeContacts(configuration);
    context.logger.info(
      `Mapping ${contacts.length} ${configuration.recordType} records to Acme contacts`,
    );
    for (const contact of contacts) {
      // A real integration would POST each contact to Acme's API here.
      context.logger.info(`Sending contact to Acme: ${JSON.stringify(contact)}`);
    }

    return { data: { recordType: configuration.recordType, contacts } };
  },
});

export default [syncContactsToAcme];
