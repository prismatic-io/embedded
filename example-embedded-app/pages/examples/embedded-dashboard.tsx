import prismatic from "@prismatic-io/embedded";
import Head from "next/head";
import React from "react";
import EmbeddedFrame from "@/components/EmbeddedFrame";
import ExampleHeader from "@/components/ExampleHeader";
import PageTitleWrapper from "@/components/PageTitleWrapper";
import SidebarLayout from "@/layouts/SidebarLayout";
import usePrismaticAuth from "@/usePrismaticAuth";

import embeddedDashboardHelperText from "./embedded-dashboard.md";

const embeddedDivId = "embedded-dashboard-div";

function EmbeddedDashboard() {
  const { authenticated } = usePrismaticAuth();

  React.useEffect(() => {
    if (authenticated) {
      prismatic.showDashboard({
        selector: `#${embeddedDivId}`,
        theme: "LIGHT",
        screenConfiguration: {
          dashboard: {
            hideTabs: ["Attachments"],
          },
        },
      });
    }
  }, [authenticated]);

  return (
    <>
      <Head>
        <title>Customer Dashboard</title>
      </Head>
      <PageTitleWrapper>
        <ExampleHeader markdown={embeddedDashboardHelperText} />
      </PageTitleWrapper>
      <EmbeddedFrame id={embeddedDivId} />
    </>
  );
}

EmbeddedDashboard.getLayout = (page) => <SidebarLayout>{page}</SidebarLayout>;

export default EmbeddedDashboard;
