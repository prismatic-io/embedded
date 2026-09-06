import { graphqlRequest } from "./utils/graphqlRequest";

interface WorkflowContextNode {
  stableKey: string;
  contextSchema: string;
}

interface WorkflowContextsData {
  workflowContexts: {
    nodes: WorkflowContextNode[];
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string;
    };
  };
}

const query = `
  query workflowContexts($cursor: String) {
    workflowContexts(after: $cursor) {
      nodes {
        stableKey
        contextSchema
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export interface WorkflowContext {
  stableKey: string;
  contextSchema: Record<string, unknown>;
}

export const fetchWorkflowContexts = async (): Promise<WorkflowContext[]> => {
  const contexts: WorkflowContext[] = [];
  let cursor: string | undefined;

  do {
    const data = await graphqlRequest<
      WorkflowContextsData,
      { cursor?: string }
    >({
      query,
      variables: { cursor },
    });

    for (const node of data.workflowContexts.nodes) {
      const parsed = JSON.parse(node.contextSchema);
      if (parsed == null) continue;
      contexts.push({
        stableKey: node.stableKey,
        contextSchema: parsed,
      });
    }

    if (data.workflowContexts.pageInfo.hasNextPage) {
      cursor = data.workflowContexts.pageInfo.endCursor;
    } else {
      break;
    }
  } while (cursor);

  return contexts;
};
