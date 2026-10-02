import { CircleAlert, CircleCheck, ExternalLink, ZoomIn } from "lucide-react";
import { useState } from "react";
import configurationScreenshot from "@/assets/workflow-context-configuration.png";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

/**
 * There is no Prismatic code in this file. The example that uses it is
 * `frontend/routes/examples/workflow-contexts.tsx`.
 *
 * Unlike the other examples, workflow contexts need setup inside the Prismatic
 * app before the page can do anything. This component explains that setup and
 * takes the stable key of the context you created, so the example route keeps
 * to the SDK calls.
 */

/**
 * The `contextData` schema the example route sends to `createWorkflow`. Each
 * property maps onto the matching input of `PROJECT_TRIGGER_SOURCE` below, so
 * the two have to stay in step.
 */
const CONTEXT_DATA_SCHEMA = [
  {
    property: "projectId",
    type: "string",
    triggerInput: "Project ID",
    example: '"P-8801"',
  },
  {
    property: "includeUpdates",
    type: "boolean",
    triggerInput: "Include Updated Tasks?",
    example: "true",
  },
] as const;

const DOCS_URL =
  "https://prismatic.io/docs/embed/workflow-builder/workflow-contexts/";

/**
 * The trigger the context pins. Its two inputs are what the `contextData`
 * schema maps onto, so the shape here and the table below have to agree.
 * Publish it in a custom component, then pick it on the context's Trigger tab.
 */
const PROJECT_TRIGGER_SOURCE = `import { input, trigger } from "@prismatic-io/spectral";

export const projectTrigger = trigger({
  display: {
    label: "Project Trigger",
    description: "Send updates for new or updated tasks within a project",
  },
  inputs: {
    projectId: input({
      label: "Project ID",
      type: "string",
      required: true,
    }),
    includeUpdated: input({
      label: "Include Updated Tasks?",
      type: "boolean",
      required: true,
      default: "false",
    }),
  },
  perform: async (context, payload, params) => {
    context.logger.info(
      \`I run when tasks are created\${params.includeUpdated ? " or updated" : ""} for project ID: \${params.projectId}\`,
    );
    return Promise.resolve({ payload });
  },
  synchronousResponseSupport: "valid",
  scheduleSupport: "invalid",
});
`;

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.8em]">
      {children}
    </code>
  );
}

/**
 * The finished Trigger tab, so you can compare it with your own. It is a tall
 * screenshot, so it sits small inline and opens full size on click.
 */
function ConfigurationScreenshot() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group relative mt-3 block overflow-hidden rounded-md border transition-colors hover:border-ring"
        >
          <img
            src={configurationScreenshot}
            alt="The Trigger tab of the Acme Project Tasks context, with Set specific trigger chosen, Project Trigger selected, and the projectId and includeUpdates context data properties injected into the Project ID and Include Updated Tasks? inputs."
            className="h-44 w-auto object-cover object-top"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-background/70 opacity-0 transition-opacity group-hover:opacity-100">
            <ZoomIn className="size-5" />
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] gap-2 overflow-y-auto sm:max-w-3xl">
        <DialogTitle>Trigger tab of the finished context</DialogTitle>
        <DialogDescription>
          The context data properties on the left are injected into the trigger
          inputs below them.
        </DialogDescription>
        <img
          src={configurationScreenshot}
          alt="The Trigger tab of the Acme Project Tasks context, shown full size."
          className="w-full rounded-md border"
        />
      </DialogContent>
    </Dialog>
  );
}

export function WorkflowContextPrerequisites({
  stableKey,
  onStableKeyChange,
  status,
}: {
  /** The stable key of the workflow context, as typed by the user. */
  stableKey: string;
  onStableKeyChange: (stableKey: string) => void;
  /**
   * Whether a context with that key was found in the organization. Checking
   * this needs the `workflowContexts` query: an unknown key makes
   * `queryWorkflows` return an empty list rather than fail.
   */
  status: "checking" | "missing" | "found";
}) {
  const [open, setOpen] = useState(status !== "found");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Before you start
          {status === "checking" ? (
            <Badge variant="secondary">Checking\u2026</Badge>
          ) : status === "found" ? (
            <Badge variant="default">
              <CircleCheck data-icon="inline-start" />
              Context found
            </Badge>
          ) : (
            <Badge variant="outline">
              <CircleAlert data-icon="inline-start" />
              Setup required
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          A workflow context is a blueprint your organization defines in
          Prismatic. It has to exist before this page can create a workflow from
          it.
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>
            {open ? "Hide steps" : "Show steps"}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
        {open ? (
          <>
            <ol className="list-decimal space-y-3 pl-5 text-sm text-muted-foreground marker:text-foreground">
              <li>
                In the Prismatic app, open{" "}
                <span className="text-foreground">Organization settings</span>{" "}
                and select the{" "}
                <span className="text-foreground">Workflow Contexts</span> tab.
              </li>
              <li>
                Publish a custom component holding this trigger. Scaffold one
                with <Code>prism components:init</Code>, drop the trigger in,
                then <Code>prism components:publish</Code>. Its two inputs are
                what the context maps <Code>contextData</Code> onto.
                <pre className="mt-2 max-h-72 overflow-auto rounded-md border bg-muted/50 p-3 text-xs leading-relaxed">
                  <code className="font-mono">{PROJECT_TRIGGER_SOURCE}</code>
                </pre>
              </li>
              <li>
                Select <span className="text-foreground">+ New Context</span>.
                Give it a name, and a stable key you will paste below. This
                example assumes the key <Code>acme-project-tasks</Code>.
              </li>
              <li>
                On the <span className="text-foreground">Trigger</span> tab,
                choose{" "}
                <span className="text-foreground">Set specific trigger</span>{" "}
                and pick{" "}
                <span className="text-foreground">Project Trigger</span>. Define
                the <Code>contextData</Code> schema with these two properties,
                then map each one onto the trigger input beside it.
                <div className="mt-2 overflow-hidden rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 text-foreground">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-medium">
                          Property
                        </th>
                        <th className="px-3 py-1.5 text-left font-medium">
                          Type
                        </th>
                        <th className="px-3 py-1.5 text-left font-medium">
                          Maps to trigger input
                        </th>
                        <th className="px-3 py-1.5 text-left font-medium">
                          Example value
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {CONTEXT_DATA_SCHEMA.map((field) => (
                        <tr key={field.property} className="border-t">
                          <td className="px-3 py-1.5 font-mono">
                            {field.property}
                          </td>
                          <td className="px-3 py-1.5 font-mono">
                            {field.type}
                          </td>
                          <td className="px-3 py-1.5">{field.triggerInput}</td>
                          <td className="px-3 py-1.5 font-mono">
                            {field.example}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ConfigurationScreenshot />
              </li>
              <li>
                On the <span className="text-foreground">Actions</span> tab,
                pick which components your customer's users may add to the
                workflow. Leaving availability{" "}
                <span className="text-foreground">Enabled</span> exposes them
                all.
              </li>
              <li>Save the context, then paste its stable key below.</li>
            </ol>

            <a
              href={DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm underline underline-offset-4"
            >
              Workflow contexts documentation
              <ExternalLink className="size-3.5" />
            </a>

            <Separator />
          </>
        ) : null}

        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="context-stable-key">Context stable key</Label>
            <Input
              id="context-stable-key"
              value={stableKey}
              onChange={(event) => onStableKeyChange(event.target.value)}
              placeholder="acme-project-tasks"
              className="w-72 font-mono"
              spellCheck={false}
            />
          </div>
          <p className="pb-1.5 text-xs text-muted-foreground">
            Saved in this browser so it survives a reload.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
