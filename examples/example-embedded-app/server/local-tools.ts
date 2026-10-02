/**
 * The tools the chat bot runs here in the dev server, rather than on
 * Prismatic's MCP flow server. `localTools` goes to the AI SDK alongside the
 * MCP tools, and `describeLocalTools` mirrors `describePrismaticTools` so the
 * tool list endpoint can return every tool the assistant has.
 */

import { tool } from "ai";
import { z } from "zod";
import type { PrismaticTool } from "./prismatic-mcp.ts";

/** How long an `httpRequest` call may run before it is aborted. */
const HTTP_REQUEST_TIMEOUT_MS = 15_000;

/**
 * The response body goes back to the model, so cap it. One large page would
 * otherwise crowd out the rest of the conversation.
 */
const MAX_RESPONSE_BODY_CHARACTERS = 20_000;

const HTTP_REQUEST_DESCRIPTION =
  "Send an HTTP request to a URL and return the status, headers and response body. Use it to reach an API that no other tool covers. Prefer a Prismatic tool whenever one fits, since those run against the connections the customer already configured.";

const httpRequestInputSchema = z.object({
  url: z
    .url("The URL must be absolute, such as https://api.example.com/widgets.")
    .describe("The absolute http:// or https:// URL to request."),
  method: z
    .enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"])
    .optional()
    .describe("The HTTP method. GET when omitted."),
  headers: z
    .record(z.string(), z.string())
    .optional()
    .describe('Request headers, such as { "Accept": "application/json" }.'),
  body: z
    .string()
    .optional()
    .describe(
      "The request body, already serialized. Send JSON as a string and set a Content-Type header. Ignored for GET and HEAD.",
    ),
});

/**
 * Lets the assistant call an HTTP API directly.
 *
 * This runs in the Vite dev server, so it can reach whatever that machine can
 * reach, including services on localhost and on your private network. That is
 * fine for an example app you run yourself. Before shipping something like it,
 * restrict the hosts it may call and keep credentials out of the arguments the
 * model picks.
 */
const httpRequestTool = tool({
  description: HTTP_REQUEST_DESCRIPTION,
  inputSchema: httpRequestInputSchema,
  execute: async ({ url, method = "GET", headers, body }) => {
    const { protocol } = new URL(url);
    if (protocol !== "http:" && protocol !== "https:") {
      return {
        error: `Only http and https URLs are supported, not ${protocol}`,
      };
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        // A GET or HEAD request may not carry one.
        body: method === "GET" || method === "HEAD" ? undefined : body,
        signal: AbortSignal.timeout(HTTP_REQUEST_TIMEOUT_MS),
      });

      const text = await response.text();
      const truncated = text.length > MAX_RESPONSE_BODY_CHARACTERS;

      // A 4xx or 5xx is an answer the model can work with, so we report the
      // status rather than treat it as a failure.
      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers),
        body: truncated ? text.slice(0, MAX_RESPONSE_BODY_CHARACTERS) : text,
        truncated,
      };
    } catch (error) {
      // Hand the failure to the model instead of throwing, so it can explain
      // the problem or try a different call.
      return { error: error instanceof Error ? error.message : String(error) };
    }
  },
});

/** The tools that run here rather than on the MCP server. */
export const localTools = { httpRequest: httpRequestTool };

/** The JSON Schema of a tool input, as `z.toJSONSchema` returns it. */
interface LocalToolInputSchema {
  properties?: Record<string, { type?: string; description?: string }>;
  required?: string[];
}

/** Flattens the local tools into the shape the browser displays. */
export function describeLocalTools(): PrismaticTool[] {
  const schema = z.toJSONSchema(httpRequestInputSchema) as LocalToolInputSchema;
  const required = new Set(schema.required ?? []);

  return [
    {
      name: "httpRequest",
      title: "HTTP request",
      description: HTTP_REQUEST_DESCRIPTION,
      parameters: Object.entries(schema.properties ?? {}).map(
        ([parameterName, parameter]) => ({
          name: parameterName,
          type: parameter.type,
          description: parameter.description,
          required: required.has(parameterName),
        }),
      ),
    },
  ];
}
