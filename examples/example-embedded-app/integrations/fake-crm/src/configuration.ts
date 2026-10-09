import { configuration, serverFunction } from "@prismatic-io/spectral";
import { z } from "zod";
import { toAcmeContact } from "./acme";
import { listFields, listRecords, listRecordTypes } from "./fake-crm";

/**
 * The shape of the values an instance saves. Your app renders the form that
 * collects them; Prismatic validates them against this schema when they're saved,
 * and flows read them, already parsed, from `context.configuration`.
 */
export const configurationSchema = z.object({
  /** The API name of the Fake CRM record type to sync, such as `Lead`. */
  recordType: z.string().min(1).meta({ title: "Record type" }),
  /**
   * For each Acme contact field, the API name of the Fake CRM field to read.
   * Titles become `title` in the published JSON Schema, so an app can label
   * its form fields from the schema.
   */
  fieldMapping: z
    .object({
      email: z.string().min(1).meta({ title: "Email" }),
      firstName: z.string().optional().meta({ title: "First name" }),
      lastName: z.string().min(1).meta({ title: "Last name" }),
      phone: z.string().optional().meta({ title: "Phone" }),
      company: z.string().optional().meta({ title: "Company" }),
      jobTitle: z.string().optional().meta({ title: "Job title" }),
    })
    .meta({ title: "Field mapping" }),
});

export type Configuration = z.infer<typeof configurationSchema>;

/**
 * Names this shape of the configuration. Change it when the schema changes in a
 * way saved values can't satisfy, so `init` can tell which shape a saved value is in.
 */
export const CONFIGURATION_VERSION = "fake-crm-v1";

/** Suggested mappings for the record types the example knows about. */
const DEFAULT_MAPPINGS: Record<string, Configuration["fieldMapping"]> = {
  Lead: {
    email: "Email",
    firstName: "FirstName",
    lastName: "LastName",
    phone: "Phone",
    company: "Company",
    jobTitle: "Title",
  },
  Contact: {
    email: "Email",
    firstName: "FirstName",
    lastName: "LastName",
    phone: "Phone",
    company: "AccountName",
    jobTitle: "Title",
  },
  Hooli_Leads__c: {
    email: "Primary_Email__c",
    firstName: "Given_Name__c",
    lastName: "Family_Name__c",
    phone: "Direct_Line__c",
    company: "Organization__c",
    jobTitle: "Job_Title__c",
  },
};

/** The record types a customer can choose from. */
export const listRecordTypesFunction = serverFunction({
  label: "List record types",
  description: "The Fake CRM record types that can be synced to Acme",
  inputSchema: z.object({}),
  outputSchema: z.array(z.object({ name: z.string(), label: z.string(), custom: z.boolean() })),
  perform: async () => listRecordTypes(),
});

/** The fields of the chosen record type, for each Acme field's dropdown. */
export const listFieldsFunction = serverFunction({
  label: "List fields",
  description: "The fields of a Fake CRM record type",
  inputSchema: z.object({ recordType: z.string().min(1) }),
  outputSchema: z.array(
    z.object({
      name: z.string(),
      label: z.string(),
      type: z.enum(["string", "email", "phone", "number"]),
    }),
  ),
  perform: async (_context, { recordType }) => listFields(recordType),
});

/**
 * A sample record of the chosen type, and the Acme contact the current mapping
 * would make from it. The mapping arrives as an input because it hasn't been
 * saved yet: the customer is still editing it.
 */
export const getSampleRecordFunction = serverFunction({
  label: "Get sample record",
  description: "A sample Fake CRM record and the Acme contact a mapping makes from it",
  inputSchema: z.object({
    recordType: z.string().min(1),
    fieldMapping: z.record(z.string(), z.string()).optional(),
  }),
  outputSchema: z.object({
    record: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).nullable(),
    acmeContact: z.record(z.string(), z.string()),
  }),
  perform: async (_context, { recordType, fieldMapping }) => {
    const [record] = listRecords(recordType);
    if (!record) return { record: null, acmeContact: {} };
    return { record, acmeContact: toAcmeContact(record, fieldMapping ?? {}) };
  },
});

export const integrationConfiguration = configuration({
  instance: {
    schema: configurationSchema,
    version: CONFIGURATION_VERSION,
    /**
     * A JSON Forms layout. Prismatic doesn't render it for a headless
     * configuration; your app may read it. The example app reads the order of
     * the field mapping controls, since JSON Schema properties have no order.
     */
    uiSchema: {
      type: "VerticalLayout",
      elements: [
        { type: "Control", scope: "#/properties/recordType" },
        {
          type: "Group",
          label: "Field mapping",
          elements: ["email", "firstName", "lastName", "phone", "company", "jobTitle"].map(
            (key) => ({ type: "Control", scope: `#/properties/fieldMapping/properties/${key}` }),
          ),
        },
      ],
    },
  },
  serverFunctions: {
    listRecordTypes: listRecordTypesFunction,
    listFields: listFieldsFunction,
    getSampleRecord: getSampleRecordFunction,
  },
  init: {
    /**
     * Suggests values for your app to show in its form. It saves nothing. The
     * shape of what it returns is up to you; your app is what reads it.
     */
    perform: async (context) => {
      const defaults: Configuration = { recordType: "Lead", fieldMapping: DEFAULT_MAPPINGS.Lead };

      if (context.configurationVersion === CONFIGURATION_VERSION) {
        // A new instance arrives here too, with an empty `{}` configuration,
        // so check whether anything valid has been saved before using it.
        const saved = configurationSchema.safeParse(context.configuration);
        return {
          migratedValues: saved.success ? saved.data : defaults,
          unresolvedReasons: [],
        };
      }

      // `null` means the instance was configured with config pages, which this
      // integration never had. Any other version is one this code doesn't know.
      return {
        migratedValues: defaults,
        unresolvedReasons: [
          `Saved configuration version "${String(context.configurationVersion)}" is unknown. Review the suggested values.`,
        ],
      };
    },
  },
});

/**
 * Turns on the configuration in flow contexts and types `context.configuration`
 * from the schema above.
 */
declare module "@prismatic-io/spectral" {
  interface Experimental {
    integrationConfiguration: true;
  }

  interface IntegrationDefinitionConfiguration extends TIntegrationConfiguration {}
}

type TIntegrationConfiguration = typeof integrationConfiguration;
