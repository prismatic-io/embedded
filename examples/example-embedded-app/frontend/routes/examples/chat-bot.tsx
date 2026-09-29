import { useChat } from "@ai-sdk/react";
import { createFileRoute } from "@tanstack/react-router";
import { DefaultChatTransport } from "ai";
import { ChatComposer } from "#/components/chat/chat-composer";
import { ChatMessages } from "#/components/chat/chat-messages";
import { ChatToolList } from "#/components/chat/chat-tool-list";
import { HelperText } from "#/components/helper-text";
import { Page } from "#/components/page";

export const Route = createFileRoute("/examples/chat-bot")({
  component: ChatBot,
});

function ChatBot() {
  const { messages, sendMessage, status, error, stop, regenerate } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/acme-chat-bot",
    }),
  });

  return (
    <Page
      title="Chat Bot"
      description="This page demonstrates how to give a chat bot access to your customer's deployed integrations using Prismatic's MCP server. You create flows that are 'agentic', and your bot will have access to invoke those agentic flows synchronously."
      actions={<HelperText id="chat-bot" />}
      fullHeight
    >
      <div className="mx-auto flex h-full w-full max-w-6xl gap-8">
        <div className="flex min-w-0 flex-1 flex-col">
          <ChatMessages
            messages={messages}
            status={status}
            error={error}
            onRetry={() => regenerate()}
            onSuggestion={(text) => sendMessage({ text })}
          />
          <ChatComposer
            status={status}
            onSend={(text) => sendMessage({ text })}
            onStop={stop}
          />
        </div>
        <ChatToolList className="hidden w-72 shrink-0 lg:flex" />
      </div>
    </Page>
  );
}
