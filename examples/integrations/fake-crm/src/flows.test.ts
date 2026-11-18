import { toAcmeContact } from "./acme";
import { getSampleRecordFunction, listFieldsFunction } from "./configuration";
import { buildAcmeContacts } from "./flows";

describe("buildAcmeContacts", () => {
  test("maps a custom record type with its own field names", () => {
    const [gavin] = buildAcmeContacts({
      recordType: "Hooli_Leads__c",
      fieldMapping: {
        email: "Primary_Email__c",
        firstName: "Given_Name__c",
        lastName: "Family_Name__c",
        company: "Organization__c",
      },
    });
    expect(gavin).toEqual({
      email: "gavin.belson@hooli.example",
      firstName: "Gavin",
      lastName: "Belson",
      company: "Hooli",
    });
  });
});

describe("toAcmeContact", () => {
  test("leaves out unmapped and empty fields", () => {
    expect(
      toAcmeContact({ Email: "a@b.example", Phone: null }, { email: "Email", phone: "Phone" }),
    ).toEqual({
      email: "a@b.example",
    });
  });
});

describe("server functions", () => {
  test("listFields returns the fields of a record type", async () => {
    const fields = await listFieldsFunction.perform({} as never, { recordType: "Contact" });
    expect(fields.map(({ name }) => name)).toContain("AccountName");
  });

  test("getSampleRecord previews an unsaved mapping", async () => {
    const preview = await getSampleRecordFunction.perform({} as never, {
      recordType: "Lead",
      fieldMapping: { email: "Email", lastName: "LastName" },
    });
    expect(preview.acmeContact).toEqual({ email: "monica.hall@raviga.example", lastName: "Hall" });
  });
});
