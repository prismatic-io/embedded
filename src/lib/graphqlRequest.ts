import urlJoin from "url-join";

import { getCurrentState } from "../state";
import { assertInit } from "../utils/assertInit";

export interface GraphqlRequestProps {
  query: string;
  variables?: Record<string, unknown>;
}

export const graphqlRequest = async ({
  query,
  variables,
}: GraphqlRequestProps) => {
  assertInit("authenticate");

  const { jwt: accessToken, prismaticUrl } = getCurrentState();

  const response = await fetch(urlJoin(prismaticUrl, "api"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  return await response.json();
};
