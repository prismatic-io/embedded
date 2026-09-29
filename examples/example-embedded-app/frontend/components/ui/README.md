# UI primitives — nothing to see here

This directory holds unmodified [shadcn/ui](https://ui.shadcn.com) components.

**There is no Prismatic-specific code in this directory.** If you read this
repository to learn how to embed Prismatic, skip this directory.

The components here are generic buttons, cards, tables, and layout primitives.
The `shadcn` CLI generated them, and we keep them separate for that reason.

One change is not from the CLI: we removed the mobile branch from
`sidebar.tsx`. This app targets the desktop only.

To add another primitive, run:

```bash
npx shadcn@latest add <component>
```

Prismatic examples are in `frontend/routes/examples`.
