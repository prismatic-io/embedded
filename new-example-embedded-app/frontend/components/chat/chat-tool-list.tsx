import { ChevronRight, CircleAlert, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { Skeleton } from "#/components/ui/skeleton";
import { cn } from "#/lib/utils";
import type { PrismaticTool } from "#server/prismatic-mcp";

/** Reads the tools the MCP server offers for the signed-in customer. */
function useMcpTools() {
  const [tools, setTools] = useState<PrismaticTool[]>([]);
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let canceled = false;

    fetch("/api/acme-mcp-tools")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`The tool list request failed (${response.status}).`);
        }
        return (await response.json()) as { tools: PrismaticTool[] };
      })
      .then((payload) => {
        if (canceled) return;
        setTools(payload.tools);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (canceled) return;
        setError(err);
        setLoading(false);
      });

    return () => {
      canceled = true;
    };
  }, []);

  return { tools, error, loading };
}

function ToolEntry({ tool }: { tool: PrismaticTool }) {
  return (
    <details className="group/tool rounded-lg bg-card ring-1 ring-border">
      <summary className="flex cursor-pointer list-none items-start gap-2 px-3 py-2">
        <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform group-open/tool:rotate-90" />
        <Wrench className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-mono text-xs">
          {tool.name}
        </span>
      </summary>
      <div className="space-y-2 border-t border-border px-3 pt-2 pb-3">
        {tool.title ? (
          <p className="text-xs font-medium">{tool.title}</p>
        ) : null}
        {tool.description ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {tool.description}
          </p>
        ) : null}
        {tool.parameters.length > 0 ? (
          <dl className="space-y-1.5">
            {tool.parameters.map((parameter) => (
              <div key={parameter.name}>
                <dt className="flex items-baseline gap-1.5 font-mono text-[0.7rem]">
                  {parameter.name}
                  {parameter.type ? (
                    <span className="text-muted-foreground">
                      {parameter.type}
                    </span>
                  ) : null}
                  {parameter.required ? (
                    <span className="text-[0.65rem] text-muted-foreground uppercase">
                      required
                    </span>
                  ) : null}
                </dt>
                {parameter.description ? (
                  <dd className="text-[0.7rem] leading-relaxed text-muted-foreground">
                    {parameter.description}
                  </dd>
                ) : null}
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-[0.7rem] text-muted-foreground">
            This tool takes no parameters.
          </p>
        )}
      </div>
    </details>
  );
}

/** The MCP tools this customer's deployed integrations expose. */
export function ChatToolList({ className }: { className?: string }) {
  const { tools, error, loading } = useMcpTools();

  return (
    <aside className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex shrink-0 items-baseline gap-2 pb-3">
        <h3 className="text-sm font-semibold">Available tools</h3>
        {loading ? null : (
          <span className="text-xs text-muted-foreground">{tools.length}</span>
        )}
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span className="min-w-0 break-words">{error.message}</span>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-4">
        {loading
          ? [0, 1, 2, 3].map((placeholder) => (
              <Skeleton key={placeholder} className="h-9 w-full rounded-lg" />
            ))
          : tools.map((tool) => <ToolEntry key={tool.name} tool={tool} />)}
        {!loading && !error && tools.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            This customer has no deployed integrations, so the assistant has no
            tools to call.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
