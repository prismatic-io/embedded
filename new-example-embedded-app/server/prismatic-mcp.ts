/**
 * Shared access to Prismatic's MCP flow server
 * (https://prismatic.io/docs/ai/model-context-protocol), which presents the
 * integrations a customer deployed as MCP tools. The chat bot endpoint calls
 * the tools, and the tool list endpoint only describes them.
 */

import { createMCPClient } from "@ai-sdk/mcp";
import { generatePrismaticJwt } from "./prismatic-auth.ts";
import type { PrismaticConfig } from "./prismatic-config.ts";

/** One parameter of an MCP tool, in the shape the browser receives it. */
export interface PrismaticToolParameter {
  name: string;
  type?: string;
  description?: string;
  required: boolean;
}

/** One MCP tool, in the shape the browser receives it. */
export interface PrismaticTool {
  name: string;
  title?: string;
  description?: string;
  parameters: PrismaticToolParameter[];
}

/** The part of a JSON Schema that describes the input of a tool. */
interface ToolInputSchema {
  properties?: Record<
    string,
    { type?: string | string[]; description?: string }
  >;
  required?: string[];
}

/**
 * Opens a connection to the MCP server for the customer in the configuration
 * and returns the tools it offers. Close the client when you are done with it.
 */
export async function connectPrismaticMcp(config: PrismaticConfig) {
  const client = await createMCPClient({
    transport: {
      type: "http",
      url: config.prismaticMcpUrl,
      headers: {
        Authorization: `Bearer ${generatePrismaticJwt(config)}`,
      },
    },
  });

  // We use the spread operator to remove the "current Prismatic 'me'" tool
  const { me, ...tools } = await client.tools();

  return { client, tools };
}

export type PrismaticToolSet = Awaited<
  ReturnType<typeof connectPrismaticMcp>
>["tools"];

/** Flattens the tools into plain JSON that the browser can display. */
export function describePrismaticTools(
  tools: PrismaticToolSet,
): PrismaticTool[] {
  return Object.entries(tools).map(([name, tool]) => {
    // The MCP client wraps the schema the server sent, so the JSON Schema
    // itself sits one level down.
    const schema = (tool.inputSchema as { jsonSchema?: ToolInputSchema })
      .jsonSchema;
    const required = new Set(schema?.required ?? []);

    return {
      name,
      title: tool.title,
      // The AI SDK allows a function that builds the description at call time.
      // The MCP client only ever sets a string.
      description:
        typeof tool.description === "string" ? tool.description : undefined,
      parameters: Object.entries(schema?.properties ?? {}).map(
        ([parameterName, parameter]) => ({
          name: parameterName,
          type: Array.isArray(parameter.type)
            ? parameter.type.join(" | ")
            : parameter.type,
          description: parameter.description,
          required: required.has(parameterName),
        }),
      ),
    };
  });
}
