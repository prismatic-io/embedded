import prismatic from "@prismatic-io/embedded";
import Head from "next/head";
import { useParams } from "next/navigation";
import React from "react";
import EmbeddedFrame from "@/components/EmbeddedFrame";
import SidebarLayout from "@/layouts/SidebarLayout";
import usePrismaticAuth from "@/usePrismaticAuth";

const embeddedDivId = "embedded-workflow-div";

function Workflow() {
  const { authenticated } = usePrismaticAuth();
  const params = useParams();
  const { workflowId } = params ?? {};

  React.useEffect(() => {
    if (authenticated && typeof workflowId === "string" && workflowId) {
      prismatic.showWorkflow({
        selector: `#${embeddedDivId}`,
        theme: "LIGHT",
        workflowId,
      });
    }
  }, [authenticated, workflowId]);

  return (
    <>
      <Head>
        <title>Embedded Workflow</title>
      </Head>
      <EmbeddedFrame id={embeddedDivId} />
    </>
  );
}

Workflow.getLayout = (page) => <SidebarLayout>{page}</SidebarLayout>;

export default Workflow;
