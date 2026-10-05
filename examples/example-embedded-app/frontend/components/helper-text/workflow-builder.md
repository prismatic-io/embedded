# Embedded Workflow Builder

Workflows are automations your customer's users build for themselves. A
workflow belongs to one customer, and it is theirs to create, edit, and run.

`prismatic.showWorkflows()` embeds the screen where they see their workflows and
open the builder for any of them.

```js
prismatic.showWorkflows({
  selector: "#my-embedded-workflows",
  theme: theme === "light" ? "LIGHT" : "DARK",
});
```

Open the screen in a popover instead of an iframe on the page:

```js
prismatic.showWorkflows({ usePopover: true });
```

Show the customer's deployed integrations on the same screen:

```js
prismatic.showWorkflows({
  selector: "#my-embedded-workflows",
  screenConfiguration: {
    workflows: { includeIntegrations: true },
  },
});
```

The screen shows only the workflows belonging to the customer in the JWT you
signed. One customer never sees another's workflows.

## Opening one workflow

`showWorkflows()` renders the list and lets the user pick. When you already know
which workflow to open, `showWorkflow()` goes straight to the builder for it:

```js
prismatic.showWorkflow({
  workflowId: "V29ya2Zsb3c6YTFiMmMz...",
  selector: "#my-embedded-workflow",
});
```

That is what the [Workflow Contexts](/examples/workflow-contexts) page does after
it creates a workflow.

You can review the code for this page in `frontend/routes/examples/workflow-builder.tsx`.

Read more about
[Embedding the Workflow Builder](https://prismatic.io/docs/embed/workflow-builder/workflow-builder/).
