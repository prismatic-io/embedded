import { configuration, customerActivatedConnection, serverFunction } from "@prismatic-io/spectral";
import { z } from "zod";
import { accessToken, listChannels } from "./slack";

/**
 * The shape of the values an instance saves. The channel has no sensible
 * default, so after the customer connects Slack the example app asks them to
 * choose one.
 */
export const configurationSchema = z.object({
  /** The ID of the channel to post to, such as `C0123456789`. */
  channelId: z.string().min(1).meta({ title: "Channel" }),
  /** The channel's name when it was chosen, for display only. */
  channelName: z.string().optional().meta({ title: "Channel name" }),
});

export type Configuration = z.infer<typeof configurationSchema>;

/**
 * Names this shape of the configuration. Change it when the schema changes in a
 * way saved values can't satisfy, so `init` can tell which shape a saved value is in.
 */
export const CONFIGURATION_VERSION = "slack-v1";

/**
 * The customer's Slack workspace. It's a customer-activated connection: your
 * organization defines it once in Prismatic, with your Slack app, and each
 * customer authorizes their own workspace. The stable key must match the one
 * you give that connection in Prismatic.
 */
export const slackConnection = customerActivatedConnection({ stableKey: "slack-oauth" });

/** The channels a customer can choose from, read from their Slack workspace. */
export const listChannelsFunction = serverFunction({
  label: "List channels",
  description: "The channels in the customer's Slack workspace",
  inputSchema: z.object({}),
  outputSchema: z.array(z.object({ id: z.string(), name: z.string(), isPrivate: z.boolean() })),
  connections: ["instance.slack"],
  perform: async ({ connections }) => listChannels(accessToken(connections.instance.slack)),
});

export const integrationConfiguration = configuration({
  instance: {
    schema: configurationSchema,
    version: CONFIGURATION_VERSION,
    connections: { slack: slackConnection },
  },
  serverFunctions: {
    listChannels: listChannelsFunction,
  },
  init: {
    /**
     * Returns the saved channel when there is one. Otherwise it leaves the
     * required channel empty, so the example app asks the customer to choose
     * one before it saves. The reason is shown alongside that question.
     */
    perform: async (context) => {
      if (context.configurationVersion === CONFIGURATION_VERSION) {
        // A new instance arrives here too, with an empty `{}` configuration.
        const saved = configurationSchema.safeParse(context.configuration);
        if (saved.success) return { configuration: saved.data, unresolvedReasons: [] };
      }
      return {
        configuration: { channelId: "" },
        unresolvedReasons: ["Choose the Slack channel Acme posts to."],
      };
    },
  },
});

/**
 * Types `context.configuration` and `context.connections` in flow contexts
 * from the configuration above.
 */
declare module "@prismatic-io/spectral" {
  interface IntegrationDefinitionConfiguration extends TIntegrationConfiguration {}
}

type TIntegrationConfiguration = typeof integrationConfiguration;
