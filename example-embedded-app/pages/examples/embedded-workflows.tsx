import Head from "next/head";

import prismatic from "@prismatic-io/embedded";

import React from "react";
import SidebarLayout from "@/layouts/SidebarLayout";
import ExampleHeader from "@/components/ExampleHeader";
import PageTitleWrapper from "@/components/PageTitleWrapper";
import { Container, styled } from "@mui/material";
import Footer from "@/components/Footer";
import usePrismaticAuth from "@/usePrismaticAuth";

import embeddedWorkflowsHelperText from "./embedded-workflows.md";

const EmbeddedWorkflowsWrapper = styled(Container)(() => ({
  height: "70vh",
  width: "100%",
}));

const embeddedDivId = "embedded-workflows-div";

function EmbeddedWorkflows() {
  const { authenticated } = usePrismaticAuth();

  React.useEffect(() => {
    if (authenticated) {
      prismatic.showWorkflows({
        selector: `#${embeddedDivId}`,
        theme: "LIGHT",
      });
    }
  }, [authenticated]);

  return (
    <>
      <Head>
        <title>Embedded Workflow Builder</title>
      </Head>
      <PageTitleWrapper>
        <ExampleHeader markdown={embeddedWorkflowsHelperText} />
      </PageTitleWrapper>
      <EmbeddedWorkflowsWrapper
        id={embeddedDivId}
        maxWidth={false}
        disableGutters
      />
      <Footer />
    </>
  );
}

EmbeddedWorkflows.getLayout = (page) => <SidebarLayout>{page}</SidebarLayout>;

export default EmbeddedWorkflows;
