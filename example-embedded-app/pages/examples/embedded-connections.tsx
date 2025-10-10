import Head from "next/head";

import prismatic from "@prismatic-io/embedded";

import React from "react";
import SidebarLayout from "@/layouts/SidebarLayout";
import { Container, styled } from "@mui/material";
import Footer from "@/components/Footer";
import usePrismaticAuth from "@/usePrismaticAuth";

const ConnectionsWrapper = styled(Container)(() => ({
  height: "70vh",
  width: "100%",
}));

const embeddedDivId = "embedded-connections-div";

function Connections() {
  const { authenticated } = usePrismaticAuth();

  React.useEffect(() => {
    if (authenticated) {
      prismatic.showConnections({
        selector: `#${embeddedDivId}`,
        theme: "LIGHT",
      });
    }
  }, [authenticated]);

  return (
    <>
      <Head>
        <title>Embedded Connections</title>
      </Head>
      <ConnectionsWrapper id={embeddedDivId} maxWidth={false} disableGutters />
      <Footer />
    </>
  );
}

Connections.getLayout = (page) => <SidebarLayout>{page}</SidebarLayout>;

export default Connections;
