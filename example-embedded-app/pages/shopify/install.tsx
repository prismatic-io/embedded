import React from "react";
import Head from "next/head";
import prismatic from "@prismatic-io/embedded";

import { useRouter } from "next/router";
import usePrismaticAuth from "@/usePrismaticAuth";

const steps = {
  initializing: "Initializing",
  queryForInstances: "Querying for instances",
  creatingInstance: "Creating instance",
  updatingInstance: "Updating instance config variables",
  redirectingToShopify: "Redirecting to Shopify",
};
type Steps = keyof typeof steps;

function InstallShopify() {
  const router = useRouter();
  const { authenticated, token, userinfo } = usePrismaticAuth();
  const [step, setStep] = React.useState<Steps>("initializing");
  const { shop } = router.query;

  React.useEffect(() => {
    /**
     * Create a new instance (if needed), configure the instance given the `shop`
     * query parameter, and redirect the user to the Shopify OAuth page.
     */
    const redirectToShopifyAuth = async () => {
      setStep("queryForInstances");
      const getIntegrationResult = await prismatic.graphqlRequest({
        query: `query getShopifyInstances {
          marketplaceIntegrations(
            name: "Shopify"
          ) {
            nodes {
              id
              instances {
                nodes {
                  id
                }
              }
            }
          }
        }`,
      });
      const { nodes: instances } =
        getIntegrationResult.data.marketplaceIntegrations.nodes[0].instances;

      let instanceId = "";

      if (instances.length === 0) {
        setStep("creatingInstance");
        // We need to create a new Shopify instance
        const createInstanceResult = await prismatic.graphqlRequest({
          query: `mutation createShopifyInstance(
              $integrationId: ID!
              $customerId: ID!
              $instanceName: String!
            ) {
              createInstance(
                input: {
                  integration: $integrationId
                  customer: $customerId
                  name: $instanceName
                }
              ) {
                instance {
                  id
                }
              }
            }`,
          variables: {
            integrationId:
              getIntegrationResult.data.marketplaceIntegrations.nodes[0].id,
            customerId: userinfo.authenticatedUser.customer.id,
            instanceName: "Shopify",
          },
        });
        instanceId = createInstanceResult.data.createInstance.instance.id;
      } else {
        // We have an existing Shopify instance
        instanceId = instances[0].id;
      }

      // Configure the instance
      setStep("updatingInstance");
      const updateInstanceResult = await prismatic.graphqlRequest({
        query: `mutation ($instanceId: ID!, $configVariables: [InputInstanceConfigVariable]) {
          updateInstanceConfigVariables(
            input: { id: $instanceId, configVariables: $configVariables }
          ) {
            instance {
              id
              configVariables {
                nodes {
                  requiredConfigVariable {
                    key
                  }
                  authorizeUrl
                }
              }
            }
            errors {
              field
              messages
            }
          }
        }`,
        variables: {
          instanceId,
          configVariables: [
            {
              key: "Shopify Connection",
              values: JSON.stringify([
                { name: "host", type: "value", value: shop },
                {
                  name: "tokenUrl",
                  type: "value",
                  value: `https://${shop}/admin/oauth/access_token`,
                },
                {
                  name: "authorizeUrl",
                  type: "value",
                  value: `https://${shop}/admin/oauth/authorize`,
                },
              ]),
            },
          ],
        },
      });
      const { errors, instance } =
        updateInstanceResult.data.updateInstanceConfigVariables;
      if (errors.length > 0) {
        console.error(errors);
      }
      const configVariables = instance.configVariables.nodes;

      setStep("redirectingToShopify");

      // Redirect to the instance's Shopify Connection authorize URL
      window.location = configVariables.find(
        (configVariable) =>
          configVariable.requiredConfigVariable.key === "Shopify Connection",
      ).authorizeUrl;
    };

    if (authenticated && token && userinfo && shop) {
      redirectToShopifyAuth();
    }
  }, [authenticated, token, userinfo?.authenticatedUser.customer.id, shop]);

  return (
    <>
      <Head>
        <title>Shopify Redirect</title>
      </Head>
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontSize: "5em" }}>{steps[step]}</div>
      </div>
    </>
  );
}

export default InstallShopify;
