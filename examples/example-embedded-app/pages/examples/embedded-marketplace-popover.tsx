import { Button, Container } from "@mui/material";

import prismatic from "@prismatic-io/embedded";
import Head from "next/head";
import ExampleHeader from "@/components/ExampleHeader";
import PageTitleWrapper from "@/components/PageTitleWrapper";
import SidebarLayout from "@/layouts/SidebarLayout";
import usePrismaticAuth from "@/usePrismaticAuth";

import embeddedMarketplacePopoverHelperText from "./embedded-marketplace-popover.md";

function EmbeddedMarketplacePopover() {
  const { authenticated } = usePrismaticAuth();

  return (
    <>
      <Head>
        <title>Marketplace Popover</title>
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
