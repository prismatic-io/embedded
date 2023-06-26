## Custom UI Elements

This page demonstrates how you can fetch data from the [Prismatic GraphQL API](https://prismatic.io/docs/embedded-api-requests/) to build your own custom UI for your customers.
Data is fetched by your frontend app using the access token that you generated for embedded, and queries run by your client are scoped to the customer who is currently logged in.

GraphQL queries and mutations are run using the `prismatic.graphqlRequest()` function.
You can test out GraphQL queries from the Prismatic [GraphQL explorer](https://prismatic.io/docs/explorer/).

This page runs a `marketplaceIntegrations` query on behalf of your customer user, and maps the array of integration objects that are returned to custom UI objects.
This is handy if you would like to fully customize your customers' UI experience as they explore your integrations.

You can edit this page by modifying `pages/examples/custom-ui-elements.tsx`.
