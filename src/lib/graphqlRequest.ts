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

export const graphqlRequest = async <
  TData = unknown,
  TVariables = Record<string, unknown>
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
