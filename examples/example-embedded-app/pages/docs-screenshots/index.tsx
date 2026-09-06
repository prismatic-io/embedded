/**
 * This page is used to take screenshots of the embedded marketplace
 * and embedded designer for https://prismatic.io/docs
 */

import { Container, styled } from "@mui/material";
import prismatic from "@prismatic-io/embedded";
import { useEffect } from "react";
import AppContainer from "@/docs-layout/AppContainer";
import usePrismaticAuth from "@/usePrismaticAuth";

const EmbeddedMarketplaceWrapper = styled(Container)(() => ({
  height: "70vh",
  width: "100%",
}));

const embeddedDivId = "embedded-marketplace-div";

function DocsScreenshot() {
  const { authenticated } = usePrismaticAuth();

  useEffect(() => {
    if (authenticated) {
      prismatic.showMarketplace({
        selector: `#${embeddedDivId}`,
        theme: "LIGHT",
      });
    }
  }, [authenticated]);

  return (
    <AppContainer>
      <EmbeddedMarketplaceWrapper
        id={embeddedDivId}
        maxWidth={false}
        disableGutters
      />
    </AppContainer>
  );
}

export default DocsScreenshot;
