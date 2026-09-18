import {
  type ChatStatus,
  isTextUIPart,
  isToolUIPart,
  type UIMessage,
} from "ai";
import { Bot, CircleAlert, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatToolCall } from "@/components/chat/chat-tool-call";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";

const SUGGESTIONS = [
  "What integrations do I have available?",
  "What tasks are due today?",
  "Give me a list of new leads",
  "Do I have any tickets assigned to me?",
];

function AssistantAvatar() {
  return (
    <Avatar className="mt-0.5 size-7">
      <AvatarFallback className="bg-gradient-to-br from-sky-500 to-indigo-600 text-white">
        <Bot className="size-4" />
      </AvatarFallback>
    </Avatar>
  );
}

function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-muted prose-pre:text-foreground">
      <ReactMarkdown
        // GitHub Flavored Markdown. Without it a table, a strikethrough or a
        // task list arrives as literal text, because react-markdown only
        // parses CommonMark on its own.
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => (
            <a href={props.href} target="_blank" rel="noopener noreferrer">
              {props.children}
            </a>
          ),
          // A wide table would otherwise push the whole chat column sideways.
          table: (props) => (
            <div className="overflow-x-auto">
              <table>{props.children}</table>
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

function UserMessage({ message }: { message: UIMessage }) {
  const session = useSession();
  const text = message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("\n\n");

  return (
    <div className="flex items-start justify-end gap-3">
      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm whitespace-pre-wrap text-primary-foreground">
        {text}
      </div>
      <Avatar className="mt-0.5 size-7">
        <AvatarFallback className="bg-gradient-to-br from-violet-500 to-indigo-600 text-[10px] font-medium text-white">
          {session.userInitials}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}

function AssistantMessage({ message }: { message: UIMessage }) {
  return (
    <div className="flex items-start gap-3">
      <AssistantAvatar />
      <div className="min-w-0 flex-1 space-y-3 pt-0.5">
        {message.parts.map((part, index) => {
          const key = `${message.id}-${index}`;
          if (isTextUIPart(part)) {
            return <Markdown key={key}>{part.text}</Markdown>;
          }
          if (isToolUIPart(part)) {
            return <ChatToolCall key={key} part={part} />;
          }
          return null;
        })}
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-3">
      <AssistantAvatar />
      <div className="flex items-center gap-1 pt-2">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyState({
  onSuggestion,
}: {
  onSuggestion: (text: string) => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white">
        <Sparkles className="size-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold">
        Ask about your integrations
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        The assistant reaches your deployed Prismatic integrations through MCP
        tools, and it can run them for you.
      </p>
      <div className="mt-6 grid w-full max-w-xl gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onSuggestion(suggestion)}
            className="rounded-lg bg-card px-3 py-2 text-left text-sm text-muted-foreground ring-1 ring-border transition-colors hover:bg-muted hover:text-foreground"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

function ErrorMessage({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">The assistant did not answer.</p>
        <p className="mt-0.5 break-words opacity-80">{error.message}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={onRetry}>
        <RefreshCw data-icon="inline-start" />
        Retry
      </Button>
    </div>
  );
}

export function ChatMessages({
  messages,
  status,
  error,
  onRetry,
  onSuggestion,
}: {
  messages: UIMessage[];
  status: ChatStatus;
  error?: Error;
  onRetry: () => void;
  onSuggestion: (text: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Follow the answer as it streams in, and settle gently when it stops.
  useEffect(() => {
    if (messages.length === 0) return;
    bottomRef.current?.scrollIntoView({
      block: "end",
      behavior: status === "streaming" ? "auto" : "smooth",
    });
  }, [messages, status]);

  if (messages.length === 0) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EmptyState onSuggestion={onSuggestion} />
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="space-y-6 pt-1 pb-4">
        {messages.map((message) =>
          message.role === "user" ? (
            <UserMessage key={message.id} message={message} />
          ) : (
            <AssistantMessage key={message.id} message={message} />
          ),
        )}
        {status === "submitted" ? <ThinkingIndicator /> : null}
        {error ? <ErrorMessage error={error} onRetry={onRetry} /> : null}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
