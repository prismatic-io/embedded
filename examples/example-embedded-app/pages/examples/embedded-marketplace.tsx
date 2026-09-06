import prismatic from "@prismatic-io/embedded";
import Head from "next/head";
import React from "react";
import EmbeddedFrame from "@/components/EmbeddedFrame";
import ExampleHeader from "@/components/ExampleHeader";
import PageTitleWrapper from "@/components/PageTitleWrapper";
import SidebarLayout from "@/layouts/SidebarLayout";
import usePrismaticAuth from "@/usePrismaticAuth";

import embeddedMarketplaceHelperText from "./embedded-marketplace.md";

const embeddedDivId = "embedded-marketplace-div";

function EmbeddedMarketplace() {
  const { authenticated } = usePrismaticAuth();

  React.useEffect(() => {
    if (authenticated) {
      prismatic.showMarketplace({
        selector: `#${embeddedDivId}`,
        theme: "LIGHT",
      });
    }
  }, [authenticated]);

  return (
    <>
      <Head>
        <title>Marketplace</title>
      </Head>
      <PageTitleWrapper>
        <ExampleHeader markdown={embeddedMarketplaceHelperText} />
      </PageTitleWrapper>
      <EmbeddedFrame id={embeddedDivId} />
    </>
  );
}

EmbeddedMarketplace.getLayout = (page) => <SidebarLayout>{page}</SidebarLayout>;

export default EmbeddedMarketplace;
