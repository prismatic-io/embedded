import { flow } from "@prismatic-io/spectral";
import { accessToken, postMessage } from "./slack";

/**
 * The message for a webhook request. Acme sends `{ "text": "..." }`; anything
 * else is posted as formatted JSON, so a test request always shows up.
 */
export function messageFromPayload(body: unknown): string {
  if (body && typeof body === "object" && typeof (body as { text?: unknown }).text === "string") {
    return (body as { text: string }).text;
  }
  return `New event from Acme:\n\`\`\`${JSON.stringify(body, null, 2)}\`\`\``;
}

export const postAcmeNotifications = flow({
  name: "Post Acme Notifications",
  stableKey: "post-acme-notifications",
  description: "Posts the notifications sent to its webhook to the configured Slack channel",
  onExecution: async (context, params) => {
    const { configuration, connections } = context;
    if (!configuration) {
      throw new Error("This instance has no saved configuration.");
    }

    const text = messageFromPayload(params.onTrigger.results.body.data);
    const token = accessToken(connections?.instance?.slack);
    const ts = await postMessage(token, configuration.channelId, text);
    context.logger.info(`Posted to #${configuration.channelName ?? configuration.channelId}`);
    return { data: { channel: configuration.channelId, ts } };
  },
});

export default [postAcmeNotifications];
