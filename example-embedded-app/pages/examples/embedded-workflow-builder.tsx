import { Container, styled } from "@mui/material";

import prismatic from "@prismatic-io/embedded";
import Head from "next/head";
import React from "react";
import SidebarLayout from "@/layouts/SidebarLayout";
import usePrismaticAuth from "@/usePrismaticAuth";

const WorkflowWrapper = styled(Container)(() => ({
  height: "calc(100vh - 90px)",
  width: "100%",
}));

const embeddedDivId = "embedded-workflow-div";

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
        <title>Embedded Workflow</title>
      </Head>
      <WorkflowWrapper id={embeddedDivId} maxWidth={false} disableGutters />
    </>
  );
}

Workflows.getLayout = (page) => <SidebarLayout>{page}</SidebarLayout>;

export default Workflows;
