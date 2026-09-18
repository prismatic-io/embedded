# Chat Bot Example

This example chat bot leverages Prismatic's [MCP Flow Server](https://prismatic.io/docs/ai/model-context-protocol) to present integrations you've built as MCP tools.

This allows the chat bot to interact with your integrations as if they were native tools, providing a seamless experience for end users.

If you do not currently see your integrations listed as tools, ensure that they are properly deployed and accessible through the MCP Flow Server.

The code for the page is available in `frontend/routes/examples/chat-bot.tsx`, and the chatbot backend that fetches tools is implemented in `server/acme-chat-bot.ts`.

Tutorial: [Get Started with Agentic Flows](https://prismatic.io/docs/get-started/agentic-flows/first-agentic-flow/)
