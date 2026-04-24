import prismatic from "@prismatic-io/embedded";
import Head from "next/head";
import React from "react";
import EmbeddedFrame from "@/components/EmbeddedFrame";
import ExampleHeader from "@/components/ExampleHeader";
import PageTitleWrapper from "@/components/PageTitleWrapper";
import SidebarLayout from "@/layouts/SidebarLayout";
import usePrismaticAuth from "@/usePrismaticAuth";

import embeddedWorkflowBuilderHelperText from "./embedded-workflow-builder.md";

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
        <title>Workflow Builder</title>
      </Head>
      <PageTitleWrapper>
        <ExampleHeader markdown={embeddedWorkflowBuilderHelperText} />
      </PageTitleWrapper>
      <EmbeddedFrame id={embeddedDivId} />
    </>
  );
}

Workflows.getLayout = (page) => <SidebarLayout>{page}</SidebarLayout>;

export default Workflows;
