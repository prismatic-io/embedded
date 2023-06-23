# Example Embedded App

This directory contains an example NextJS/React application that embeds the Prismatic SDK. It contains examples of how to embed the integration marketplace and integration designer, as well as additional examples for dynamically setting config variables, pulling additional data from Prismatic's GraphQL API, and more.

For documentation on installing the Prismatic embedded SDK in your app, see the [Prismatic docs](https://prismatic.io/docs/installing-embedded/).

## Important files

While some code in this directory is boilerplate NextJS code, these files contain example code for embedding Prismatic in an application:

- `package.json` includes a dependency on `@prismatic-io/embedded`
- `pages/examples/*` show examples of things you can do with the embedded Prismatic SDK
- `prismatic/config.ts` contains your configuration information
- `pages/_app.tsx` initializes the Prismatic SDK with your configuration
- `src/usePrismaticAuth.ts` shows how to authenticate the `prismatic` SDK client
- `pages/api/prismatic-auth.ts` is a backend API endpoint that generates a signed JWT to authenticate a user

## Set up

To run this example embedded application yourself, ensure that you have a modern version of [Node.js](https://nodejs.org/) installed. Then, install this package's dependencies by running `npm install` from the `example-embedded-app` directory.

Next, make a copy of `prismatic/config.ts.template` called `prismatic/config.ts`. Populate `prismatic/config.ts` with the information you need to generate JWT tokens for customer user authentication:

- Replace `signingKey` with a signing key that you generate [in Prismatic](https://prismatic.io/docs/installing-embedded/#jwt-signing-keys).
- If your tenant is not in the US commercial region, replace `prismaticUrl` with your tenant's region.
- Replace `sub` with a unique customer ID for your customer user.
- Replace `organization` with your organization's ID, which you can find on the same page where you generated the signing key.
- Replace `customer` with the _external ID_ of a customer that you've created in Prismatic.
- _Optional_. Replace `name` with the customer's name.

Once your configuration is in place, you can run `npm run dev` to run the example embedded app locally. The app should be available in your browser at http://localhost:3000.
