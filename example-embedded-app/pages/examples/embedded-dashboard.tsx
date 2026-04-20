import { Container, styled } from "@mui/material";

import prismatic from "@prismatic-io/embedded";
import Head from "next/head";
import React from "react";
import ExampleHeader from "@/components/ExampleHeader";
import Footer from "@/components/Footer";
import PageTitleWrapper from "@/components/PageTitleWrapper";
import SidebarLayout from "@/layouts/SidebarLayout";
import usePrismaticAuth from "@/usePrismaticAuth";

import embeddedDashboardHelperText from "./embedded-dashboard.md";

const EmbeddedDashboardWrapper = styled(Container)(() => ({
  height: "70vh",
  width: "100%",
}));

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
        <title>Embedded Dashboard</title>
      </Head>
      <PageTitleWrapper>
        <ExampleHeader markdown={embeddedDashboardHelperText} />
      </PageTitleWrapper>
      <EmbeddedDashboardWrapper
        id={embeddedDivId}
        maxWidth={false}
        disableGutters
      />
      <Footer />
    </>
  );
}

EmbeddedDashboard.getLayout = (page) => <SidebarLayout>{page}</SidebarLayout>;

export default EmbeddedDashboard;
