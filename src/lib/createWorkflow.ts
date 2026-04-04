import { assertInit } from "../utils/assertInit";
import { graphqlRequest } from "./graphqlRequest";

export interface WorkflowContexts {}

interface CreateWorkflowArgs<TContextData = unknown> {
  contextData: TContextData;
  externalId?: string;
}

interface CreateWorkflowData {
  importWorkflow: {
    workflow: {
      id: string;
    };
    errors: {
      field: string;
      messages: string[];
    }[];
  };
}

interface CreateWorkflowVariables {
  contextStableKey: string;
  contextData: string;
  externalId?: string;
}

const mutation = `
  mutation createWorkflow($contextStableKey: String, $contextData: String, $externalId: String) {
    importWorkflow(input: {
      contextStableKey: $contextStableKey
      contextData: $contextData
      externalId: $externalId
    }) {
      workflow {
        id
      }
      errors {
        field
        messages
      }
    }
  }
`;

export async function createWorkflow<
  TKey extends keyof WorkflowContexts | (string & {})
>(
  contextStableKey: TKey,
  args: CreateWorkflowArgs<
    TKey extends keyof WorkflowContexts
      ? WorkflowContexts[TKey]
      : Record<string, unknown>
  >
) {
  assertInit("createWorkflow");

  return graphqlRequest<CreateWorkflowData, CreateWorkflowVariables>({
    query: mutation,
    variables: {
      contextStableKey,
      contextData: JSON.stringify(args.contextData),
      externalId: args.externalId,
    },
  });
}
