/**
 * In this file we configure two api endpoints:
 *   - `/api/acme-chat-bot` handles chatbot communication using the AI SDK.
 *   - `/api/acme-mcp-tools` lists the tools the chatbot can call.
 * Both reach Prismatic's MCP flow server through `connectPrismaticMcp`, which
 * presents Prismatic flows as MCP tools.
 * See https://prismatic.io/docs/ai/model-context-protocol
 *
 * The chatbot also gets the tools in `local-tools.ts`, which run in this dev
 * server rather than on the MCP server.
 */

import type { ServerResponse } from "node:http";
import { openai } from "@ai-sdk/openai";
import type { UIMessage } from "ai";
import {
  convertToModelMessages,
  isStepCount,
  pipeUIMessageStreamToResponse,
  streamText,
  toUIMessageStream,
} from "ai";
import type { Connect, Plugin, ViteDevServer } from "vite";
import { describeLocalTools, localTools } from "./local-tools.ts";
import { loadPrismaticConfig } from "./prismatic-config.ts";
import {
  connectPrismaticMcp,
  describePrismaticTools,
} from "./prismatic-mcp.ts";

const parseMessages = async (req: Connect.IncomingMessage) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const parsedPayload = JSON.parse(Buffer.concat(chunks).toString()) as {
    messages: UIMessage[];
  };
  return parsedPayload.messages;
};

export const acmeChatBotPlugin = (): Plugin => ({
  name: "acme-chat-plugin",
  configureServer: (server: ViteDevServer) => {
    const envDir = server.config.envDir || server.config.root;
    const { mode } = server.config;

    // Warn at start-up, but still register the route so the browser gets the
    // same message.
    try {
      loadPrismaticConfig(envDir, mode);
    } catch (err) {
      server.config.logger.warn(
        `\n[prismatic-auth] ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }

    const reportError = (res: ServerResponse, error: unknown) => {
      server.config.logger.error(
        `\n[prismatic-auth] ${error instanceof Error ? error.message : String(error)}\n`,
      );
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error }));
    };

    server.middlewares.use("/api/acme-chat-bot", async (req, res) => {
      // Read on every request so an edit to .env.local takes effect at once.
      const config = loadPrismaticConfig(envDir, mode);
      try {
        const messages = await parseMessages(req);

        const { client: prismaticMcpClient, tools: prismaticTools } =
          await connectPrismaticMcp(config);

        const tools = { ...prismaticTools, ...localTools };

        const result = streamText({
          model: openai("gpt-5.6-terra"),
          messages: await convertToModelMessages(messages),
          instructions:
            "You are a helpful assistant for Acme SaaS. Help users interact with the integrations they've deployed by invoking MCP tools you have access to. If a user asks you to perform an action that you do not have a corresponding tool for, suggest that they enable a related integration or reach out to Acme support. You also have an httpRequest tool that calls an HTTP API directly; use it only when no integration tool covers the request.",
          tools,
          stopWhen: isStepCount(5),
          onEnd: async () => {
            // Close MCP client when done
            await prismaticMcpClient?.close();
          },
        });

        // Stream the new assistant message back to the browser as server-sent
        // events. The `useChat` hook reads this format.
        await pipeUIMessageStreamToResponse({
          response: res,
          stream: toUIMessageStream({
            stream: result.stream,
            tools,
            originalMessages: messages,
          }),
        });
      } catch (error) {
        reportError(res, error);
      }
    });

    server.middlewares.use("/api/acme-mcp-tools", async (_req, res) => {
      // Read on every request so an edit to .env.local takes effect at once.
      const config = loadPrismaticConfig(envDir, mode);
      try {
        const { client, tools } = await connectPrismaticMcp(config);
        const describedTools = [
          ...describePrismaticTools(tools),
          ...describeLocalTools(),
        ];
        await client.close();

        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ tools: describedTools }));
      } catch (error) {
        reportError(res, error);
      }
    });
  },
});
