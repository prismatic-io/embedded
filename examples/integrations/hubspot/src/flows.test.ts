import { contactsFromPayload } from "./flows";
import { accessToken, toHubSpotProperties, upsertContacts } from "./hubspot";

const connection = {
  key: "hubspot",
  configVarKey: "hubspot",
  fields: {},
  token: { access_token: "test-token" },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(body: unknown) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("contactsFromPayload", () => {
  test("reads one contact or a list of contacts", () => {
    expect(contactsFromPayload({ email: "a@b.example" })).toEqual([{ email: "a@b.example" }]);
    expect(
      contactsFromPayload({ contacts: [{ email: "a@b.example" }, { email: "c@d.example" }] }),
    ).toHaveLength(2);
  });

  test("skips contacts without an email", () => {
    expect(contactsFromPayload({ contacts: [{ firstName: "No" }, { email: "" }] })).toEqual([]);
    expect(contactsFromPayload("not json")).toEqual([]);
  });
});

describe("toHubSpotProperties", () => {
  test("renames fields to HubSpot properties and leaves out empty ones", () => {
    expect(toHubSpotProperties({ email: "a@b.example", firstName: "Ada", phone: "" })).toEqual({
      email: "a@b.example",
      firstname: "Ada",
    });
  });
});

describe("HubSpot API", () => {
  test("accessToken requires an OAuth token", () => {
    expect(accessToken(connection)).toBe("test-token");
    expect(() => accessToken({ ...connection, token: undefined })).toThrow(/Connect HubSpot/);
  });

  test("upsertContacts matches contacts by email", async () => {
    const fetch = stubFetch({ results: [{ id: "101", properties: { email: "a@b.example" } }] });

    const synced = await upsertContacts("test-token", [{ email: "a@b.example" }]);

    expect(synced).toEqual([{ id: "101", email: "a@b.example" }]);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert");
    expect(JSON.parse(init.body as string)).toEqual({
      inputs: [
        {
          id: "a@b.example",
          idProperty: "email",
          properties: { email: "a@b.example" },
        },
      ],
    });
  });
});
