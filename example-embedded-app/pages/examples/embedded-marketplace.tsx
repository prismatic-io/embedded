import { Container, styled } from "@mui/material";

import prismatic from "@prismatic-io/embedded";
import Head from "next/head";
import React from "react";
import ExampleHeader from "@/components/ExampleHeader";
import Footer from "@/components/Footer";
import PageTitleWrapper from "@/components/PageTitleWrapper";
import SidebarLayout from "@/layouts/SidebarLayout";
import usePrismaticAuth from "@/usePrismaticAuth";

import embeddedMarketplaceHelperText from "./embedded-marketplace.md";

const EmbeddedMarketplaceWrapper = styled(Container)(() => ({
  height: "70vh",
  width: "100%",
}));

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
        <title>Embedded Marketplace</title>
      </Head>
      <PageTitleWrapper>
        <ExampleHeader markdown={embeddedMarketplaceHelperText} />
      </PageTitleWrapper>
      <EmbeddedMarketplaceWrapper
        id={embeddedDivId}
        maxWidth={false}
        disableGutters
      />
      <Footer />
    </>
  );
}

EmbeddedMarketplace.getLayout = (page) => <SidebarLayout>{page}</SidebarLayout>;

export default EmbeddedMarketplace;
