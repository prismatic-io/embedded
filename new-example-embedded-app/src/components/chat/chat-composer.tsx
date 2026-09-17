import type { ChatStatus } from "ai";
import { ArrowUp, Square } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const MAX_HEIGHT = 160;

export function ChatComposer({
  status,
  onSend,
  onStop,
}: {
  status: ChatStatus;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const busy = status === "submitted" || status === "streaming";

  // Grow the textarea with its content, up to a few lines.
  const resize = (element: HTMLTextAreaElement) => {
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT)}px`;
  };

  const submit = () => {
    const text = input.trim();
    if (!text || busy) return;
    onSend(text);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  return (
    <div className="shrink-0 pt-2">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="rounded-2xl bg-card p-2 ring-1 ring-border transition-shadow focus-within:ring-2 focus-within:ring-ring/50"
      >
        <textarea
          ref={textareaRef}
          value={input}
          rows={1}
          onChange={(event) => {
            setInput(event.target.value);
            resize(event.currentTarget);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Ask about your integrations..."
          className="block max-h-40 w-full resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center justify-between gap-3 pt-1 pl-2">
          <span className="text-xs text-muted-foreground">
            Enter to send, Shift + Enter for a new line
          </span>
          {busy ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={onStop}
            >
              <Square className="fill-current" />
              <span className="sr-only">Stop the answer</span>
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!input.trim()}>
              <ArrowUp />
              <span className="sr-only">Send the message</span>
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
