import prismatic from "@prismatic-io/embedded";
import Head from "next/head";
import React from "react";
import EmbeddedFrame from "@/components/EmbeddedFrame";
import ExampleHeader from "@/components/ExampleHeader";
import FeatureNotEnabled from "@/components/FeatureNotEnabled";
import PageTitleWrapper from "@/components/PageTitleWrapper";
import SidebarLayout from "@/layouts/SidebarLayout";
import usePrismaticAuth from "@/usePrismaticAuth";

import embeddedWorkflowBuilderCopilotHelperText from "./embedded-workflow-builder-copilot.md";

const embeddedDivId = "embedded-workflow-builder-copilot-div";

function WorkflowBuilderCopilot() {
  const { authenticated, userinfo } = usePrismaticAuth();
  const { allowWorkflowCopilot } = userinfo?.authenticatedUser.customer || {};

  React.useEffect(() => {
    if (authenticated && allowWorkflowCopilot) {
      prismatic.showWorkflows({
        selector: `#${embeddedDivId}`,
        theme: "LIGHT",
        screenConfiguration: {
          workflowBuilder: {
            copilot: {
              initialChatVisibility: "open",
            },
          },
        },
      });
    }
  }, [authenticated, allowWorkflowCopilot]);

  return (
    <>
      <Head>
        <title>Workflow Builder + Copilot</title>
      </Head>
      <PageTitleWrapper>
        <ExampleHeader markdown={embeddedWorkflowBuilderCopilotHelperText} />
      </PageTitleWrapper>
      {allowWorkflowCopilot ? (
        <EmbeddedFrame id={embeddedDivId} />
      ) : (
        <FeatureNotEnabled
          featureName="Workflow Builder Copilot"
          docsUrl="https://prismatic.io/docs/embed/workflow-builder/ai-copilot/"
        />
      )}
    </>
  );
}

WorkflowBuilderCopilot.getLayout = (page) => (
  <SidebarLayout>{page}</SidebarLayout>
);

export default WorkflowBuilderCopilot;
