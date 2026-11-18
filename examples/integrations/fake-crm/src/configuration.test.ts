import { CONFIGURATION_VERSION, integrationConfiguration } from "./configuration";

describe("configuration init", () => {
  const definition = integrationConfiguration.init;
  if (!definition) throw new Error("Fake CRM must define configuration init");
  const init = definition.perform;

  test("proposes defaults for an instance with no saved values", async () => {
    const proposal = await init({
      configurationVersion: CONFIGURATION_VERSION,
      configuration: {},
    } as never);

    expect(proposal.configuration.recordType).toBe("Lead");
    expect(proposal.configuration.fieldMapping.email).toBe("Email");
    expect(proposal.unresolvedReasons).toEqual([]);
  });

  test("preserves valid saved configuration", async () => {
    const configuration = {
      recordType: "Contact",
      fieldMapping: { email: "Email", lastName: "LastName" },
    };
    const proposal = await init({
      configurationVersion: CONFIGURATION_VERSION,
      configuration,
    } as never);

    expect(proposal.configuration).toEqual(configuration);
    expect(proposal.unresolvedReasons).toEqual([]);
  });

  test("includes review metadata for an unknown configuration version", async () => {
    const proposal = await init({
      configurationVersion: "old-version",
      configuration: {},
    } as never);

    expect(proposal.configuration.recordType).toBe("Lead");
    expect(proposal.unresolvedReasons).toEqual([
      'Saved configuration version "old-version" is unknown. Review the suggested values.',
    ]);
  });
});
