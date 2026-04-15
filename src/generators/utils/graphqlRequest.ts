import { getPrismAccessToken, getPrismaticUrl } from "./prism";

interface GraphqlRequestProps<TVariables = Record<string, unknown>> {
  query: string;
  variables?: TVariables;
}

interface GraphqlResponse<TData = unknown> {
  data: TData;
  errors?: { message: string }[];
}

export const graphqlRequest = async <
  TData = unknown,
  TVariables = Record<string, unknown>,
>({
  query,
  variables,
}: GraphqlRequestProps<TVariables>): Promise<TData> => {
  const accessToken = await getPrismAccessToken();
  const prismaticUrl = getPrismaticUrl();

  const response = await fetch(new URL("/api", prismaticUrl).toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const result: GraphqlResponse<TData> = await response.json();

  if (result.errors?.length) {
    throw new Error(
      `GraphQL errors: ${result.errors.map((e) => e.message).join(", ")}`,
    );
  }

  return result.data;
};
