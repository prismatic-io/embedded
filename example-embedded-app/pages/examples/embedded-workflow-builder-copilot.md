## Workflow Builder with Copilot

An AI assistant inside the builder that scaffolds steps, maps data between systems, and troubleshoots failing runs — without the customer leaving the canvas. Auto-opening it is great for guided onboarding, demos, and template-driven flows.

Rendered with `showWorkflows()` and `screenConfiguration.workflowBuilder.copilot.initialChatVisibility: "open"`. Pass `"hide"` (default) to keep the panel collapsed until the user opens it.

`agent.context` gives the copilot additional context about your application, keyed by topic. Use it to describe your domain vocabulary, the components you expect the agent to reach for, or details about the signed-in user — so a request phrased in your product's language resolves without the user having to explain it. Available on `init()` and on every `show*()` call, where per-call entries merge over the ones given to `init()`.

**To enable:** Copilot must be turned on for your organization (contact Prismatic support) and for the signed-in customer.

Setup and options: [Workflow Builder AI Copilot](https://prismatic.io/docs/embed/workflow-builder/ai-copilot/).
