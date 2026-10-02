import prismatic from "@prismatic-io/embedded";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { EmbedLoading } from "#/components/embed-loading";
import { HelperText } from "#/components/helper-text";
import { Page } from "#/components/page";
import { useTheme } from "#/components/theme-provider";
import { Button } from "#/components/ui/button";
import { Label } from "#/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { Switch } from "#/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { WorkflowContextPrerequisites } from "#/components/workflow-context-prerequisites";
import { usePrismaticAuth } from "#/hooks/use-prismatic-auth";
import { projects } from "#/lib/fake-data";

export const Route = createFileRoute("/examples/workflow-contexts")({
  component: RouteComponent,
});

/**
 * Declaring the context here types the `contextData` argument of
 * `createWorkflow` when you pass the key as a literal, so a missing or
 * misspelled property is a compile error. The example passes a key the user
 * typed, which is a plain `string`, so this declaration documents the shape
 * rather than enforcing it. `npx @prismatic-io/embedded generate-types`
 * writes this file for every context in your organization.
 */
declare module "@prismatic-io/embedded" {
  interface WorkflowContexts {
    "acme-project-tasks": {
      projectId: string;
      includeUpdates: boolean;
    };
  }
}

const STABLE_KEY_STORAGE_KEY = "prismatic-example-context-stable-key";
const DEFAULT_STABLE_KEY = "acme-project-tasks";

/**
 * Listing the organization's contexts is the only way to tell a context that
 * does not exist from one that exists with no workflows yet: filtering
 * `queryWorkflows` by an unknown `contextStableKey` succeeds and returns an
 * empty list rather than an error.
 */
const WORKFLOW_CONTEXTS_QUERY = `
  query workflowContexts {
    workflowContexts {
      nodes {
        stableKey
      }
    }
  }
`;

interface WorkflowContextsData {
  workflowContexts: {
    nodes: { stableKey: string }[];
  };
}

/** One workflow returned by `queryWorkflows`, narrowed to what this page shows. */
interface ContextWorkflow {
  id: string;
  name: string;
  externalId: string | null;
  updatedAt: string;
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function RouteComponent() {
  const { authenticated, error } = usePrismaticAuth();
  const { theme } = useTheme();

  const [stableKey, setStableKey] = useState(DEFAULT_STABLE_KEY);
  const [workflows, setWorkflows] = useState<ContextWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);
  const [contextStatus, setContextStatus] = useState<
    "checking" | "missing" | "found"
  >("checking");
  const [availableKeys, setAvailableKeys] = useState<string[]>([]);
  const [projectId, setProjectId] = useState(projects[0].id);
  const [includeUpdates, setIncludeUpdates] = useState(false);
  const [creating, setCreating] = useState(false);
  const [openWorkflowId, setOpenWorkflowId] = useState<string | null>(null);

  // The stable key belongs to the organization running this app, so it is not
  // in .env.local with the rest of the configuration. Keep it in the browser.
  useEffect(() => {
    const saved = window.localStorage.getItem(STABLE_KEY_STORAGE_KEY);
    if (saved) {
      setStableKey(saved);
    }
  }, []);

  const updateStableKey = (value: string) => {
    setStableKey(value);
    window.localStorage.setItem(STABLE_KEY_STORAGE_KEY, value);
  };

  /** Confirm the stable key names a context that actually exists. */
  const checkContext = useCallback(async () => {
    if (!authenticated || !stableKey) {
      return;
    }

    setContextStatus("checking");
    try {
      const response = await prismatic.graphqlRequest<WorkflowContextsData>({
        query: WORKFLOW_CONTEXTS_QUERY,
      });

      if (response.errors?.length) {
        setContextError(response.errors.map((e) => e.message).join(" "));
        return;
      }

      const keys = response.data.workflowContexts.nodes.map(
        (node) => node.stableKey,
      );
      setAvailableKeys(keys);
      setContextStatus(keys.includes(stableKey) ? "found" : "missing");
    } catch (err) {
      setContextError(err instanceof Error ? err.message : String(err));
    }
  }, [authenticated, stableKey]);

  useEffect(() => {
    checkContext();
  }, [checkContext]);

  /**
   * `queryWorkflows` filtered by `contextStableKey` returns only the workflows
   * built from this context, for the customer in the signed JWT. An unknown
   * key is not an error here, so `checkContext` below decides whether the
   * context exists.
   */
  const loadWorkflows = useCallback(async () => {
    if (!authenticated || !stableKey) {
      return;
    }

    setLoading(true);
    try {
      const response = await prismatic.queryWorkflows({
        contextStableKey: stableKey,
      });

      if (response.errors?.length) {
        setContextError(response.errors.map((e) => e.message).join(" "));
        setWorkflows([]);
        return;
      }

      setContextError(null);
      setWorkflows(response.data.workflows.nodes);
    } catch (err) {
      setContextError(err instanceof Error ? err.message : String(err));
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  }, [authenticated, stableKey]);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  /**
   * `createWorkflow` builds a workflow from the context and returns its id.
   * `contextData` must match the schema defined on the context's trigger, and
   * `externalId` is your own identifier, so you can find the workflow again
   * with `queryWorkflows({ externalId })`.
   */
  const createWorkflowForProject = async () => {
    const project = projects.find((candidate) => candidate.id === projectId);
    if (!project) {
      return;
    }

    setCreating(true);
    try {
      const response = await prismatic.createWorkflow(stableKey, {
        name: `Task updates for ${project.name}`,
        externalId: project.id,
        // These two properties become the Project Trigger's two inputs.
        contextData: {
          projectId: project.id,
          includeUpdates,
        },
      });

      const { workflow, errors } = response.data.importWorkflow;
      if (errors?.length) {
        setContextError(
          errors.map((e) => `${e.field}: ${e.messages.join(", ")}`).join(" "),
        );
        return;
      }

      setContextError(null);
      setOpenWorkflowId(workflow.id);
      await loadWorkflows();
    } catch (err) {
      setContextError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  // `showWorkflow` renders the workflow builder into a div you already have on
  // the page. The container below only exists once a workflow is selected.
  useEffect(() => {
    if (!authenticated || !openWorkflowId) {
      return;
    }

    const cleanup = prismatic.showWorkflow({
      workflowId: openWorkflowId,
      selector: "#my-embedded-workflow",
      theme: theme === "light" ? "LIGHT" : "DARK",
      onDelete: () => {
        setOpenWorkflowId(null);
        loadWorkflows();
      },
    });

    return () => cleanup?.();
  }, [authenticated, openWorkflowId, theme, loadWorkflows]);

  // The prerequisites are about setup inside the Prismatic app, so they stay on
  // the page whatever the SDK is doing. Hiding them behind the authenticated
  // check would hide them exactly when someone is stuck.
  return (
    <PageWrapper>
      <div className="space-y-6">
        <WorkflowContextPrerequisites
          stableKey={stableKey}
          onStableKeyChange={updateStableKey}
          status={authenticated ? contextStatus : "checking"}
        />

        {error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm">
            <p className="font-medium">
              Error authenticating with Prismatic: {error.message}
            </p>
          </div>
        ) : null}

        {contextStatus === "missing" && !contextError ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm">
            <p className="font-medium">
              No workflow context has the stable key{" "}
              <code className="font-mono">{stableKey}</code>.
            </p>
            <p className="mt-1 text-muted-foreground">
              {availableKeys.length === 0
                ? "Your organization has no workflow contexts yet. Follow the steps above to create one."
                : "Follow the steps above to create it, or use one of the keys your organization already has:"}
            </p>
            {availableKeys.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {availableKeys.map((key) => (
                  <li key={key}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="font-mono"
                      onClick={() => updateStableKey(key)}
                    >
                      {key}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {contextError ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm">
            <p className="font-medium">
              Prismatic could not use the context{" "}
              <code className="font-mono">{stableKey}</code>.
            </p>
            <p className="mt-1 text-muted-foreground">{contextError}</p>
            <p className="mt-1 text-muted-foreground">
              Check that the context exists, that its stable key matches, and
              that its <code className="font-mono">contextData</code> schema has
              the two properties above.
            </p>
          </div>
        ) : null}

        {!authenticated ? (
          <div className="relative h-40">
            <EmbedLoading label="Connecting to Prismatic" />
          </div>
        ) : (
          <>
            <section>
              <h3 className="text-lg font-medium">New automation</h3>
              <p className="mt-1 mb-3 text-sm text-muted-foreground">
                These two fields are the Project Trigger's two inputs. They go
                to <code className="font-mono">createWorkflow</code> as{" "}
                <code className="font-mono">contextData</code>, so the workflow
                arrives already pointed at one project.
              </p>
              <div className="flex flex-wrap items-end gap-6 rounded-md border p-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="project-id">Project ID</Label>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger id="project-id" className="w-72">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name} ({project.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="include-updated">
                    Include Updated Tasks?
                  </Label>
                  <div className="flex h-8 items-center gap-2">
                    <Switch
                      id="include-updated"
                      checked={includeUpdates}
                      onCheckedChange={setIncludeUpdates}
                    />
                    <span className="text-sm text-muted-foreground">
                      {includeUpdates ? "true" : "false"}
                    </span>
                  </div>
                </div>

                <Button
                  disabled={!stableKey || creating || contextStatus !== "found"}
                  onClick={createWorkflowForProject}
                >
                  {creating ? "Creating\u2026" : "Create workflow"}
                </Button>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-medium">
                Workflows built from this context
              </h3>
              <p className="mt-1 mb-3 text-sm text-muted-foreground">
                Returned by{" "}
                <code className="font-mono">
                  queryWorkflows({"{"} contextStableKey {"}"})
                </code>
                .
              </p>
              {loading ? (
                <p className="text-sm text-muted-foreground">
                  Loading workflows…
                </p>
              ) : workflows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No workflows yet. Create one above.
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">Builder</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workflows.map((workflow) => (
                        <TableRow key={workflow.id}>
                          <TableCell className="font-medium">
                            {workflow.name}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {workflow.externalId ?? "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {dateFormat.format(new Date(workflow.updatedAt))}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant={
                                openWorkflowId === workflow.id
                                  ? "default"
                                  : "outline"
                              }
                              onClick={() => setOpenWorkflowId(workflow.id)}
                            >
                              Open
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            {openWorkflowId ? (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-medium">Workflow builder</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOpenWorkflowId(null)}
                  >
                    Close builder
                  </Button>
                </div>
                <div
                  id="my-embedded-workflow"
                  className="h-[42rem] overflow-hidden rounded-md border"
                />
              </section>
            ) : null}
          </>
        )}
      </div>
    </PageWrapper>
  );
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Page
      title="Workflow Contexts"
      description="This page demonstrates how to create workflows from a workflow context, so your customer's users start from a blueprint your organization defined instead of a blank canvas."
      actions={<HelperText id="workflow-contexts" />}
    >
      {children}
    </Page>
  );
}
