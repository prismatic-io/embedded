import Head from "next/head";

import prismatic from "@prismatic-io/embedded";

import React from "react";
import SidebarLayout from "@/layouts/SidebarLayout";
import ExampleHeader from "@/components/ExampleHeader";
import PageTitleWrapper from "@/components/PageTitleWrapper";
import { Container, Link, Stack, Typography, styled } from "@mui/material";
import Footer from "@/components/Footer";
import usePrismaticAuth from "@/usePrismaticAuth";
import { ReportProblemTwoTone } from "@mui/icons-material";

import embeddedDesignerHelperText from "./embedded-designer.md";

const EmbeddedDesignerWrapper = styled(Container)(() => ({
  height: "70vh",
  width: "100%",
}));

const embeddedDivId = "embedded-designer-div";

function EmbeddedDesigner() {
  const { authenticated, userinfo } = usePrismaticAuth();
  const { allowEmbeddedDesigner } = userinfo?.authenticatedUser.customer || {};

  React.useEffect(() => {
    if (authenticated && allowEmbeddedDesigner) {
      prismatic.showIntegrations({
        selector: `#${embeddedDivId}`,
        theme: "LIGHT",
      });
    }
  }, [authenticated, allowEmbeddedDesigner]);

  return (
    <>
      <Head>
        <title>Embedded Marketplace</title>
      </Head>
      <PageTitleWrapper>
        <ExampleHeader markdown={embeddedDesignerHelperText} />
      </PageTitleWrapper>
      <div>
        {allowEmbeddedDesigner ? (
          <EmbeddedDesignerWrapper
            id={embeddedDivId}
            maxWidth={false}
            disableGutters
          />
        ) : (
          <Container>
            <Stack direction="row" alignItems="center" gap={1}>
              <ReportProblemTwoTone sx={{ color: "orange" }} />
              <Typography variant="body1">
                Embedded Designer is not enabled for the customer. Embedded
                designer is an opt-in feature, and is enabled on a per-customer
                basis. You may need to enable embedded designer for this
                customer, or the embedded designer may need to be enabled for
                your organization. See{" "}
                <Link
                  href="https://prismatic.io/docs/embedded-designer/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  docs
                </Link>
                .
              </Typography>
            </Stack>
          </Container>
        )}
      </div>
      <Footer />
    </>
  );
}

EmbeddedDesigner.getLayout = (page) => <SidebarLayout>{page}</SidebarLayout>;

export default EmbeddedDesigner;
