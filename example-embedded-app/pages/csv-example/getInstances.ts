import prismatic from "@prismatic-io/embedded";

export interface Instance {
  id: string;
  enabled: boolean;
  flowConfigs: FlowConfigs;
  integration: Integration;
  webhookUrls: Record<string, string>;
}

export interface FlowConfigs {
  nodes: FlowConfigsNode[];
}

export interface FlowConfigsNode {
  flow: Flow;
  webhookUrl: string;
}

export interface Flow {
  name: string;
}

export interface Integration {
  id: string;
  name: string;
  avatarUrl: null | string;
  category: Category;
}

export enum Category {
  CSVStores = "CSV Stores",
  Communication = "Communication",
  Empty = "",
}
const query = `query getInstances {
  instances {
    nodes {
      id
      enabled
      flowConfigs {
        nodes {
          flow {
            name
          }
          webhookUrl
        }
      }
      integration {
        id
        name
        avatarUrl
        category
      }
    }
  }
}
`;

const getInstances = (): Promise<Instance[]> => {
  return prismatic.graphqlRequest({ query }).then((response) => {
    const csvInstances = (response.data.instances.nodes as Instance[]).filter(
      (instance) => instance.integration.category === "CSV Stores",
    );
    // Make webhook URLs more accessible
    for (const instance of csvInstances) {
      instance.webhookUrls = Object.fromEntries(
        instance.flowConfigs.nodes.map((flowConfig) => [
          flowConfig.flow.name,
          flowConfig.webhookUrl,
        ]),
      );
    }
    return csvInstances;
  });
};

export default getInstances;
