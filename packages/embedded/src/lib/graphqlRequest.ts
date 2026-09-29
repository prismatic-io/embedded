import urlJoin from "url-join";

import stateService from "../state";
import { assertInit } from "../utils/assertInit";

export interface GraphqlRequestProps<TVariables = Record<string, unknown>> {
  query: string;
  variables?: TVariables;
}

export interface GraphqlRequestResponse<TData = unknown> {
  data: TData;
  errors?: { message: string }[];
}

/**
 * Executes an authenticated GraphQL request against the Prismatic API.
 * The request is automatically authorized using the JWT from the most
 * recent {@link authenticate} call.
 *
 * This is useful for building custom UIs — for example, querying
 * `marketplaceIntegrations` to render a custom marketplace.
 *
 * @param props - The GraphQL query and optional variables.
 * @param props.query - The GraphQL query string.
 * @param props.variables - Optional variables to pass to the query.
 * @returns The parsed JSON response from the Prismatic API.
 *
 * @example
 * // Query available marketplace integrations
 * const result = await prismatic.graphqlRequest({
 *   query: `{
 *     marketplaceIntegrations(
 *       filters: { category: "ERP" }
 *     ) {
 *       nodes {
 *         id
 *         name
 *         description
 *         category
 *       }
 *     }
 *   }`,
 * });
 * console.log(result.data.marketplaceIntegrations.nodes);
 *
 * @example
 * // Query with variables
 * const result = await prismatic.graphqlRequest({
 *   query: `query ($integrationId: ID!) {
 *     integration(id: $integrationId) {
 *       name
 *       instances { nodes { id name } }
 *     }
 *   }`,
 *   variables: { integrationId: "SW50ZWdyYXRpb246..." },
 * });
 *
 * @see {@link https://prismatic.io/docs/embed/embedded-api-requests/ | Embedded API Requests}
 */
export const graphqlRequest = async <
  TData = unknown,
  TVariables = Record<string, unknown>,
>({
  query,
  variables,
}: GraphqlRequestProps<TVariables>): Promise<GraphqlRequestResponse<TData>> => {
  assertInit("authenticate");

  const { jwt, prismaticUrl } = stateService.getStateCopy();

  const response = await fetch(urlJoin(prismaticUrl, "api"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  return await response.json();
};
