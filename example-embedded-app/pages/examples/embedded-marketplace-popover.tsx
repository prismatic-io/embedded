import Head from "next/head";

import prismatic from "@prismatic-io/embedded";

import React from "react";
import SidebarLayout from "@/layouts/SidebarLayout";
import ExampleHeader from "@/components/ExampleHeader";
import PageTitleWrapper from "@/components/PageTitleWrapper";
import usePrismaticAuth from "@/usePrismaticAuth";
import { Button, Container } from "@mui/material";

import embeddedMarketplacePopoverHelperText from "./embedded-marketplace-popover.md";

function EmbeddedMarketplacePopover() {
  const { authenticated } = usePrismaticAuth();

  return (
    <>
      <Head>
        <title>Embedded Marketplace</title>
      </Head>
      <PageTitleWrapper>
        <ExampleHeader markdown={embeddedMarketplacePopoverHelperText} />
      </PageTitleWrapper>
      <Container>
        {authenticated ? (
          <Button
            variant="contained"
            onClick={() => {
              prismatic.showMarketplace({
                usePopover: true,
                theme: "LIGHT",
              });
            }}
          >
            Open Integration Marketplace
          </Button>
        ) : null}
      </Container>
    </>
  );
}

EmbeddedMarketplacePopover.getLayout = (page) => (
  <SidebarLayout titleMarginBottom={4}>{page}</SidebarLayout>
);

export default EmbeddedMarketplacePopover;
