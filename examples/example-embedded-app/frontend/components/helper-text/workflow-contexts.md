# Workflow Contexts

A workflow context is a blueprint your organization defines once in Prismatic. It
fixes the trigger, decides which actions a user may add, and declares a
`contextData` schema that your app fills in. Your customer's users then start
from a focused starting point instead of a blank canvas.

This example is different from the others on purpose: **the context has to exist
before the page works.** An organization admin publishes a trigger, then creates
the context in the Prismatic app under Organization settings → Workflow
Contexts. The steps are on the page itself, in the "Before you start" card,
along with the source of the trigger to publish.

The trigger takes two inputs, `projectId` and `includeUpdated`. The context
declares `contextData` properties named `projectId` and `includeUpdates`, and
injects each one into the matching input. The names do not have to agree: what
matters is the injection you configure on the Trigger tab. The two fields on
this page are what fill them in.

## Creating a workflow

`prismatic.createWorkflow()` takes the context's stable key and returns the id of
the new workflow.

```js
const response = await prismatic.createWorkflow("acme-project-tasks", {
  name: `Task updates for ${project.name}`,
  externalId: project.id,
  contextData: {
    projectId: project.id,
    includeUpdates,
  },
});

const workflowId = response.data.importWorkflow.workflow.id;
```

`contextData` must match the schema you defined on the context's trigger. Those
values are handed to the trigger, so a workflow built from a project already
knows which project it belongs to, and whether to fire on updated tasks.

`externalId` is your identifier, not Prismatic's. Storing the record id there is
what lets you find the workflow again later.

## Finding workflows again

`prismatic.queryWorkflows()` filters by context, by your external id, or both.

```js
const response = await prismatic.queryWorkflows({
  contextStableKey: "acme-project-tasks",
  externalId: "P-8801",
});

const workflows = response.data.workflows.nodes;
```

The results are scoped to the customer in the JWT you signed, so one customer
never sees another's workflows.

## Opening the builder

`prismatic.showWorkflow()` embeds the workflow builder for one workflow.

```js
prismatic.showWorkflow({
  workflowId,
  selector: "#my-embedded-workflow",
  theme: theme === "light" ? "LIGHT" : "DARK",
  onDelete: () => refreshList(),
});
```

Pass `usePopover: true` instead of `selector` to open the builder over the page.
When you pass `onDelete`, the call returns a cleanup function — call it when the
component unmounts.

## Typed context data

`createWorkflow` types its `contextData` argument from an interface you augment,
so a missing or misspelled property is a compile error:

```ts
declare module "@prismatic-io/embedded" {
  interface WorkflowContexts {
    "acme-project-tasks": {
      projectId: string;
      includeUpdates: boolean;
    };
  }
}
```

Generate that declaration for every context in your organization rather than
writing it by hand:

```bash
npx @prismatic-io/embedded generate-types
```

The typing applies when you pass the key as a string literal. This page lets you
type the key into a form, so the key is a plain `string` and `contextData` falls
back to `Record<string, unknown>`. In your own app you would pass the literal and
get the checking.

You can review the code for this page in `frontend/routes/examples/workflow-contexts.tsx`.
The prerequisite card is in `frontend/components/workflow-context-prerequisites.tsx`.

Read more about
[Workflow Contexts](https://prismatic.io/docs/embed/workflow-builder/workflow-contexts/).
