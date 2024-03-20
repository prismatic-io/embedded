import React from "react";
import Head from "next/head";
import prismatic from "@prismatic-io/embedded";

import usePrismaticAuth from "@/usePrismaticAuth";

function ConfigureShopifyInstance() {
  const { authenticated, token } = usePrismaticAuth();

  React.useEffect(() => {
    if (authenticated && token) {
      prismatic.configureInstance({
        integrationName: "Shopify",
        usePopover: true,
        screenConfiguration: {
          configurationWizard: {
            isInModal: true,
            triggerDetailsConfiguration: "hidden",
          },
        },
      });
    }
  }, [authenticated]);

  return (
    <>
      <Head>
        <title>Configure Shopify</title>
      </Head>
    </>
  );
}

export default ConfigureShopifyInstance;
