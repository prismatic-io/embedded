import { assertInit } from "../utils/assertInit";
import { graphqlRequest } from "./graphqlRequest";

export interface WorkflowContexts {}

interface CreateWorkflowArgs<TContextData = unknown> {
  name: string;
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
  name: string;
  contextStableKey: string;
  contextData: string;
  externalId?: string;
}

const mutation = `
  mutation createWorkflow($name: String!, $contextStableKey: String, $contextData: String, $externalId: String) {
    importWorkflow(input: {
      name: $name
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
      name: args.name,
      contextStableKey,
      contextData: JSON.stringify(args.contextData),
      externalId: args.externalId,
    },
  });
}
