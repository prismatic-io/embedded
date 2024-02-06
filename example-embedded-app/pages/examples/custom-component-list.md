## Custom Component List

This page demonstrates how you can fetch a list of all available components from the [Prismatic GraphQL API](https://prismatic.io/docs/embedded-api-requests/) and render the components with custom UI elements.

GraphQL queries and mutations are run using the `prismatic.graphqlRequest()` function.
You can test out GraphQL queries from the Prismatic [GraphQL explorer](https://prismatic.io/docs/explorer/).

This page runs a `components` query on behalf of your customer user, and maps the array of component objects that are returned to custom UI objects.
This is handy if you would like to display a list of components that your customer has access to in the embedded designer.

You can edit this page by modifying `pages/examples/custom-component-list.tsx`.
