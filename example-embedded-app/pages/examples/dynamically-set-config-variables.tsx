import Head from "next/head";

import prismatic, {
  PrismaticMessageEvent,
  getMessageIframe,
} from "@prismatic-io/embedded";

import React, { useEffect } from "react";
import SidebarLayout from "@/layouts/SidebarLayout";
import ExampleHeader from "@/components/ExampleHeader";
import PageTitleWrapper from "@/components/PageTitleWrapper";
import { Button, Container } from "@mui/material";
import usePrismaticAuth from "@/usePrismaticAuth";

import dynamicallySetConfigVariableHelperText from "./dynamically-set-config-variables.md";

function DyanamicallySetConfigVariable() {
  const { authenticated } = usePrismaticAuth();

  /** Wrap event listener in a useEffect so it only fires once */
  useEffect(() => {
    const listener = (message: MessageEvent) => {
      const { event, data } = message.data;
      if (event === PrismaticMessageEvent.INSTANCE_CONFIGURATION_LOADED) {
        const iframe = getMessageIframe(message);
        if (data.integrationName === "Setting Config Variables Example") {
          prismatic.setConfigVars({
            iframe,
            configVars: {
              "Acme API URL": { value: "https://api.acme.com" },
              "Acme API Key": { inputs: { apiKey: { value: "abc-123" } } },
            },
          });
        }
      }
    };

    window.addEventListener("message", listener);
    return () => {
      window.removeEventListener("message", listener);
    };
  }, []);

  return (
    <>
      <Head>
        <title>Dynamically Setting Config Variables</title>
      </Head>
      <PageTitleWrapper>
        <ExampleHeader markdown={dynamicallySetConfigVariableHelperText} />
      </PageTitleWrapper>
      <Container>
        {authenticated ? (
          <Button
            variant="contained"
            onClick={() => {
              prismatic.configureInstance({
                integrationName: "Setting Config Variables Example",
                usePopover: true,
                theme: "LIGHT",
                skipRedirectOnRemove: true,
              });
            }}
          >
            Configure Example Integration
          </Button>
        ) : null}
      </Container>
    </>
  );
}

DyanamicallySetConfigVariable.getLayout = (page) => (
  <SidebarLayout titleMarginBottom={4}>{page}</SidebarLayout>
);

export default DyanamicallySetConfigVariable;
