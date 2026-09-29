import { type DynamicToolUIPart, getToolName, type ToolUIPart } from "ai";
import {
  Check,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ToolPart = ToolUIPart | DynamicToolUIPart;

function toolState(part: ToolPart) {
  switch (part.state) {
    case "output-available":
      return {
        label: "Done",
        icon: Check,
        className: "text-emerald-600 dark:text-emerald-400",
      };
    case "output-error":
      return {
        label: "Failed",
        icon: CircleAlert,
        className: "text-destructive",
      };
    case "output-denied":
      return {
        label: "Declined",
        icon: CircleAlert,
        className: "text-muted-foreground",
      };
    case "approval-requested":
    case "approval-responded":
      return {
        label: "Waiting for approval",
        icon: CircleAlert,
        className: "text-muted-foreground",
      };
    default:
      return {
        label: "Running",
        icon: LoaderCircle,
        className: "animate-spin text-muted-foreground",
      };
  }
}

function Payload({ title, value }: { title: string; value: unknown }) {
  if (value === undefined || value === null) {
    return null;
  }
  return (
    <div className="mt-2">
      <div className="mb-1 text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </div>
      <pre className="max-h-48 overflow-auto rounded-md bg-background p-2 text-xs leading-relaxed text-foreground/80 ring-1 ring-border">
        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

/** One MCP tool call the assistant made, with its input and output. */
export function ChatToolCall({ part }: { part: ToolPart }) {
  const { label, icon: StateIcon, className } = toolState(part);
  const name = part.type === "dynamic-tool" ? part.toolName : getToolName(part);

  return (
    <details className="group/tool rounded-lg bg-muted/60 text-sm ring-1 ring-border">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2">
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open/tool:rotate-90" />
        <Wrench className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-mono text-xs">{name}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          {label}
          <StateIcon className={cn("size-3.5", className)} />
        </span>
      </summary>
      <div className="border-t border-border px-3 pt-2 pb-3">
        <Payload title="Input" value={part.input} />
        <Payload title="Output" value={part.output} />
        <Payload title="Error" value={part.errorText} />
      </div>
    </details>
  );
}
