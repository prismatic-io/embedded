/**
 * A stand-in for a Salesforce-like CRM called "Fake CRM". A real integration
 * would call the CRM's API with a connection; this one returns static data, so
 * the example runs without credentials.
 *
 * Each customer's CRM stores people in a different record type. Some use the
 * standard Lead or Contact objects, and Hooli uses a custom object,
 * Hooli_Leads__c, with its own field names.
 */

export type FieldType = "string" | "email" | "phone" | "number";

export interface RecordType {
  /** The API name, such as `Hooli_Leads__c`. This is what gets saved. */
  name: string;
  label: string;
  custom: boolean;
}

export interface Field {
  /** The API name, such as `Primary_Email__c`. */
  name: string;
  label: string;
  type: FieldType;
}

export type CrmRecord = Record<string, string | number | null>;

export const RECORD_TYPES: RecordType[] = [
  { name: "Lead", label: "Lead", custom: false },
  { name: "Contact", label: "Contact", custom: false },
  { name: "Hooli_Leads__c", label: "Hooli Lead", custom: true },
];

const FIELDS: Record<string, Field[]> = {
  Lead: [
    { name: "Id", label: "Lead ID", type: "string" },
    { name: "FirstName", label: "First Name", type: "string" },
    { name: "LastName", label: "Last Name", type: "string" },
    { name: "Email", label: "Email", type: "email" },
    { name: "Phone", label: "Phone", type: "phone" },
    { name: "Company", label: "Company", type: "string" },
    { name: "Title", label: "Title", type: "string" },
    { name: "LeadSource", label: "Lead Source", type: "string" },
    { name: "Status", label: "Lead Status", type: "string" },
  ],
  Contact: [
    { name: "Id", label: "Contact ID", type: "string" },
    { name: "FirstName", label: "First Name", type: "string" },
    { name: "LastName", label: "Last Name", type: "string" },
    { name: "Email", label: "Email", type: "email" },
    { name: "Phone", label: "Business Phone", type: "phone" },
    { name: "MobilePhone", label: "Mobile Phone", type: "phone" },
    { name: "AccountName", label: "Account Name", type: "string" },
    { name: "Title", label: "Title", type: "string" },
    { name: "Department", label: "Department", type: "string" },
  ],
  Hooli_Leads__c: [
    { name: "Id", label: "Record ID", type: "string" },
    { name: "Name", label: "Full Name", type: "string" },
    { name: "Given_Name__c", label: "Given Name", type: "string" },
    { name: "Family_Name__c", label: "Family Name", type: "string" },
    { name: "Primary_Email__c", label: "Primary Email", type: "email" },
    { name: "Direct_Line__c", label: "Direct Line", type: "phone" },
    { name: "Organization__c", label: "Organization", type: "string" },
    { name: "Job_Title__c", label: "Job Title", type: "string" },
    { name: "Hooli_Score__c", label: "Hooli Score", type: "number" },
  ],
};

const RECORDS: Record<string, CrmRecord[]> = {
  Lead: [
    {
      Id: "00Q5e00000A1b2C",
      FirstName: "Monica",
      LastName: "Hall",
      Email: "monica.hall@raviga.example",
      Phone: "+1 650-555-0142",
      Company: "Raviga Capital",
      Title: "Partner",
      LeadSource: "Web",
      Status: "Working",
    },
    {
      Id: "00Q5e00000A1b2D",
      FirstName: "Jared",
      LastName: "Dunn",
      Email: "jared@piedpiper.example",
      Phone: "+1 650-555-0188",
      Company: "Pied Piper",
      Title: "Head of Business Development",
      LeadSource: "Referral",
      Status: "Open",
    },
  ],
  Contact: [
    {
      Id: "0035e00000Z9y8X",
      FirstName: "Bertram",
      LastName: "Gilfoyle",
      Email: "gilfoyle@piedpiper.example",
      Phone: "+1 650-555-0111",
      MobilePhone: "+1 650-555-0666",
      AccountName: "Pied Piper",
      Title: "Systems Architect",
      Department: "Engineering",
    },
    {
      Id: "0035e00000Z9y8Y",
      FirstName: "Dinesh",
      LastName: "Chugtai",
      Email: "dinesh@piedpiper.example",
      Phone: "+1 650-555-0112",
      MobilePhone: null,
      AccountName: "Pied Piper",
      Title: "Software Engineer",
      Department: "Engineering",
    },
  ],
  Hooli_Leads__c: [
    {
      Id: "a015e00000H00L1",
      Name: "Gavin Belson",
      Given_Name__c: "Gavin",
      Family_Name__c: "Belson",
      Primary_Email__c: "gavin.belson@hooli.example",
      Direct_Line__c: "+1 650-555-0100",
      Organization__c: "Hooli",
      Job_Title__c: "Chief Executive Officer",
      Hooli_Score__c: 98,
    },
    {
      Id: "a015e00000H00L2",
      Name: "Nelson Bighetti",
      Given_Name__c: "Nelson",
      Family_Name__c: "Bighetti",
      Primary_Email__c: "big.head@hooli.example",
      Direct_Line__c: null,
      Organization__c: "Hooli XYZ",
      Job_Title__c: "Head of Hooli XYZ",
      Hooli_Score__c: 42,
    },
  ],
};

/** The record types the customer's CRM offers. */
export const listRecordTypes = (): RecordType[] => RECORD_TYPES;

/** The fields of one record type, or an empty list for a type that doesn't exist. */
export const listFields = (recordType: string): Field[] => FIELDS[recordType] ?? [];

/** Every record of one record type. */
export const listRecords = (recordType: string): CrmRecord[] => RECORDS[recordType] ?? [];
