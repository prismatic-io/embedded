import {
  CONFIGURATION_VERSION,
  configurationSchema,
  integrationConfiguration,
} from "./configuration";

describe("configuration init", () => {
  const definition = integrationConfiguration.init;
  if (!definition) throw new Error("Slack must define configuration init");
  const init = definition.perform;

  test("asks for a channel on a new instance", async () => {
    const proposal = await init({
      configurationVersion: CONFIGURATION_VERSION,
      configuration: {},
    } as never);

    expect(proposal.configuration).toEqual({ channelId: "" });
    // The empty channel is not a valid configuration, so the customer has to choose.
    expect(configurationSchema.safeParse(proposal.configuration).success).toBe(false);
    expect(proposal.unresolvedReasons).toEqual(["Choose the Slack channel Acme posts to."]);
  });

  test("preserves a saved channel", async () => {
    const configuration = { channelId: "C0123456789", channelName: "acme" };
    const proposal = await init({
      configurationVersion: CONFIGURATION_VERSION,
      configuration,
    } as never);

    expect(proposal.configuration).toEqual(configuration);
    expect(proposal.unresolvedReasons).toEqual([]);
  });
});
