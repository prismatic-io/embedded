# Edit Instance Configuration

An instance is one integration a customer has deployed. `editInstanceConfiguration()`
opens the configuration wizard for an instance that already exists, so the
customer can rotate a credential, point at a new endpoint, or change a config
variable without going back to the marketplace.

```js
const cleanup = prismatic.editInstanceConfiguration({
  instanceId: "SW5zdGFuY2U6OGE2YjZi...",
  selector: "#edit-instance-configuration",
  screenConfiguration: {
    configurationWizard: { triggerDetailsConfiguration: "hidden" },
  },
  onSuccess: () => console.log("Saved."),
  onCancel: () => console.log("Canceled."),
  onDelete: () => console.log("Removed."),
});

// Call cleanup() when the wizard goes away.
cleanup?.();
```

## How it differs from configureInstance

`configureInstance()` takes an integration and lets the customer activate a new
instance of it. `editInstanceConfiguration()` takes an instance that already
exists and opens its wizard directly. Use this one when your own app supplies
the list, as this page does.

It also gives you three callbacks. Use them to close your dialog and to read
your list again, because the customer may have paused or removed the instance
while the wizard was open. This page does both.

`editInstanceConfiguration()` returns a cleanup function when you supply a
callback. Call it when you remove the wizard, or the listeners stay behind.

This opens the configuration of the instance itself. A customer user who
supplies their own connections needs `editUserLevelConfiguration()` instead.

## Find the instances

The list on this page comes from the Prismatic API, through
`prismatic.graphqlRequest()`:

```graphql
query getInstances {
  instances(sortBy: [{ field: NAME, direction: ASC }]) {
    nodes {
      id
      name
      enabled
      lastExecutedAt
      integration {
        name
        description
        category
      }
    }
  }
}
```

The query runs with the customer's own token, so it returns that customer's
instances and no one else's. Prototype a query of your own in the
[GraphQL explorer](https://prismatic.io/docs/explorer/).

You can review the code for this page in
`src/routes/examples/edit-instance-configuration.tsx`.

References: [Configuration Wizard Customization](https://prismatic.io/docs/embed/marketplace/)
and [Embedded API Requests](https://prismatic.io/docs/embed/embedded-api-requests/).
