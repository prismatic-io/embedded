import {
  CONFIGURATION_VERSION,
  configurationSchema,
  integrationConfiguration,
} from "./configuration";

describe("configuration init", () => {
  const definition = integrationConfiguration.init;
  if (!definition) throw new Error("HubSpot must define configuration init");
  const init = definition.perform;

  test("returns a complete, empty configuration", async () => {
    const proposal = await init({
      configurationVersion: CONFIGURATION_VERSION,
      configuration: {},
    } as never);

    expect(proposal.configuration).toEqual({});
    expect(configurationSchema.safeParse(proposal.configuration).success).toBe(true);
  });

  test("drops the lifecycle stage version 1 saved", async () => {
    const proposal = await init({
      configurationVersion: "hubspot-v1",
      configuration: { lifecycleStage: "customer" },
    } as never);

    expect(proposal.configuration).toEqual({});
  });
});
