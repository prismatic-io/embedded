import { assertInit } from "../utils/assertInit";
import { graphqlRequest } from "./graphqlRequest";

export interface Workflow {
  id: string;
  name: string;
  versionNumber: number;
  description: string;
  updatedAt: string;
  lastExecutedAt: string | null;
  createdAt: string;
  category: string | null;
  labels: string[];
  customer: {
    id: string;
    name: string;
  };
  instance: {
    enabled: boolean;
  } | null;
  deployedVersion: {
    id: string;
  } | null;
}

export interface QueryWorkflowsData {
  workflows: {
    nodes: Workflow[];
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
    totalCount: number;
  };
}

export interface QueryWorkflowsProps extends Record<string, unknown> {
  searchTerm?: string;
  descriptionSearch?: string;
  categorySearch?: string;
  labelSearch?: string;
  contextStableKey?: string;
  externalId?: string;
  sortBy?: string[];
  first?: number;
  cursor?: string;
}

const query = `
  query queryWorkflows(
    $cursor: String
    $searchTerm: String
    $descriptionSearch: String
    $categorySearch: String
    $labelSearch: String
    $contextStableKey: String
    $externalId: String
    $first: Int
    $sortBy: [IntegrationVariantOrder]
  ) {
    workflows: integrationVariants(
      after: $cursor
      name_Icontains: $searchTerm
      description_Icontains: $descriptionSearch
      category: $categorySearch
      labels_Icontains: $labelSearch
      contextStableKey: $contextStableKey
      externalId: $externalId
      exclude: [INTEGRATION]
      first: $first
      sortBy: $sortBy
    ) {
      nodes {
        ... on Workflow {
          id
          name
          versionNumber
          description
          updatedAt
          lastExecutedAt
          createdAt
          category
          labels
          customer {
            id
            name
          }
          instance {
            enabled
          }
          deployedVersion {
            id
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

export const queryWorkflows = async (variables?: QueryWorkflowsProps) => {
  assertInit("queryWorkflows");

  return graphqlRequest<QueryWorkflowsData, QueryWorkflowsProps>({
    query,
    variables,
  });
};
