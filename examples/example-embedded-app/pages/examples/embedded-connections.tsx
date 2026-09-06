import prismatic from "@prismatic-io/embedded";
import Head from "next/head";
import React from "react";
import EmbeddedFrame from "@/components/EmbeddedFrame";
import ExampleHeader from "@/components/ExampleHeader";
import PageTitleWrapper from "@/components/PageTitleWrapper";
import SidebarLayout from "@/layouts/SidebarLayout";
import usePrismaticAuth from "@/usePrismaticAuth";

import embeddedConnectionsHelperText from "./embedded-connections.md";

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
        <title>Connections</title>
      </Head>
      <PageTitleWrapper>
        <ExampleHeader markdown={embeddedConnectionsHelperText} />
      </PageTitleWrapper>
      <EmbeddedFrame id={embeddedDivId} />
    </>
  );
}

Connections.getLayout = (page) => <SidebarLayout>{page}</SidebarLayout>;

export default Connections;
