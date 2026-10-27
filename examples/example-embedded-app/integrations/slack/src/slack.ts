import type { Connection } from "@prismatic-io/spectral";

/**
 * A small Slack Web API client. It calls Slack with the bot token of the
 * customer's Slack connection, so the integration needs no component.
 */

const SLACK_API = "https://slack.com/api";

/** Stop listing channels after this many pages, so a huge workspace stays quick. */
const MAX_CHANNEL_PAGES = 5;

export interface Channel {
  id: string;
  name: string;
  isPrivate: boolean;
}

/** The bot token of an OAuth 2.0 connection. */
export function accessToken(connection: Connection | undefined): string {
  const token = connection?.token?.access_token;
  if (typeof token !== "string" || !token) {
    throw new Error("The Slack connection has no access token. Connect Slack again.");
  }
  return token;
}

/** Slack answers HTTP 200 with `ok: false` when a call fails. */
async function slack<T>(token: string, method: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${SLACK_API}/${method}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
      ...init?.headers,
    },
  });
  const body = (await response.json()) as { ok: boolean; error?: string } & T;
  if (!body.ok) {
    throw new Error(`Slack's ${method} failed: ${body.error ?? response.status}`);
  }
  return body;
}

/** The channels the customer can choose from, sorted by name. */
export async function listChannels(token: string): Promise<Channel[]> {
  const channels: Channel[] = [];
  let cursor = "";
  for (let page = 0; page < MAX_CHANNEL_PAGES; page++) {
    const query = new URLSearchParams({
      types: "public_channel,private_channel",
      exclude_archived: "true",
      limit: "200",
      ...(cursor ? { cursor } : {}),
    });
    const result = await slack<{
      channels: { id: string; name: string; is_private: boolean }[];
      response_metadata?: { next_cursor?: string };
    }>(token, `conversations.list?${query}`);
    channels.push(
      ...result.channels.map(({ id, name, is_private }) => ({ id, name, isPrivate: is_private })),
    );
    cursor = result.response_metadata?.next_cursor ?? "";
    if (!cursor) break;
  }
  return channels.sort((a, b) => a.name.localeCompare(b.name));
}

/** Posts a message to a channel, and returns the message's timestamp. */
export async function postMessage(token: string, channel: string, text: string): Promise<string> {
  const result = await slack<{ ts: string }>(token, "chat.postMessage", {
    method: "POST",
    body: JSON.stringify({ channel, text }),
  });
  return result.ts;
}
