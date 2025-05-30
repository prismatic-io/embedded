import Head from "next/head";

import prismatic from "@prismatic-io/embedded";

import React from "react";
import SidebarLayout from "@/layouts/SidebarLayout";
import { Container, styled } from "@mui/material";
import Footer from "@/components/Footer";
import usePrismaticAuth from "@/usePrismaticAuth";

const WorkflowWrapper = styled(Container)(() => ({
  height: "70vh",
  width: "100%",
}));

const embeddedDivId = "embedded-marketplace-div";

function Workflows() {
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
        <title>Embedded Marketplace</title>
      </Head>
      <WorkflowWrapper id={embeddedDivId} maxWidth={false} disableGutters />
      <Footer />
    </>
  );
}

Workflows.getLayout = (page) => <SidebarLayout>{page}</SidebarLayout>;

export default Workflows;
