import prismatic from "@prismatic-io/embedded";
import Head from "next/head";
import React from "react";

import usePrismaticAuth from "@/usePrismaticAuth";

function ConfigureShopifyInstance() {
  const { authenticated, token } = usePrismaticAuth();

  React.useEffect(() => {
    if (authenticated && token) {
      prismatic.configureInstance({
        integrationName: "Shopify",
        usePopover: true,
        skipRedirectOnRemove: true,
        screenConfiguration: {
          configurationWizard: {
            isInModal: true,
            triggerDetailsConfiguration: "hidden",
          },
        },
      });
    }
  }, [authenticated, token]);

  return (
    <Head>
      <title>Configure Shopify</title>
    </Head>
  );
}

export default ConfigureShopifyInstance;
