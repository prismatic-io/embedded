## Custom Component List

Render Prismatic data in your own UI. This page queries `components` through `prismatic.graphqlRequest()` and maps the results to custom elements — handy when you want to surface the components a customer can use inside the embedded designer without Prismatic's chrome.

Queries run client-side with the customer's access token, which scopes results to that customer automatically. Prototype them in the [GraphQL explorer](https://prismatic.io/docs/explorer/).

API reference: [Embedded API Requests](https://prismatic.io/docs/embed/embedded-api-requests/). For a drop-in picker, see [Show Components](https://prismatic.io/docs/embed/additional-screens/show-components/).
