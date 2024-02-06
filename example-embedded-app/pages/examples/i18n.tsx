import Head from "next/head";

import prismatic from "@prismatic-io/embedded";

import React from "react";
import SidebarLayout from "@/layouts/SidebarLayout";
import ExampleHeader from "@/components/ExampleHeader";
import PageTitleWrapper from "@/components/PageTitleWrapper";
import { Container, styled } from "@mui/material";
import Footer from "@/components/Footer";
import usePrismaticAuth from "@/usePrismaticAuth";

import i18nHelperText from "./i18n.md";

const EmbeddedMarketplaceWrapper = styled(Container)(() => ({
  height: "70vh",
  width: "100%",
}));

const embeddedDivId = "embedded-marketplace-div";

function Internationalization() {
  const { authenticated } = usePrismaticAuth();

  React.useEffect(() => {
    if (authenticated) {
      prismatic.showMarketplace({
        selector: `#${embeddedDivId}`,
        theme: "LIGHT",
        translation: {
          debugMode: true,
          phrases: {
            // Static Translations:
            "integration-marketplace__filterBar.allButton": "Alle, bitte!",
            "integration-marketplace__filterBar.activateButton":
              "Solo activado",
            "detail.categoryLabel": "カテゴリー",
            "detail.descriptionLabel": "विवरण",
            "detail.overviewLabel": "概述",

            // Complex translation with variables:
            "activateIntegrationDialog.banner.text--isNotConfigurable": {
              _: "Veuillez contacter %{organization} pour activer cette intégration",
            },

            // Dynamic translations of developer-specified integration names, config variables, etc:
            dynamicPhrase: {
              "Microsoft Teams": "Microsoft Squadre", // Integration name
              "Notify a Teams channel of new leads":
                "Notifica un canale di Teams di nuovi lead", // Integration description
              "Teams Configuration": "Configurazione di Teams", // Config wizard page title
              "Enter your Teams authentication info": "", // Config wizard page subtitle
              "Teams Authentication": "Autenticazione di Teams", // Config variable
              "<h1>Teams OAuth</h1>": "<h1>OAuth di Teams</h1>", // HTML helper text in the config wizard
            },
          },
        },
      });
    }
  }, [authenticated]);

  return (
    <>
      <Head>
        <title>Internationalization (i18n)</title>
      </Head>
      <PageTitleWrapper>
        <ExampleHeader markdown={i18nHelperText} />
      </PageTitleWrapper>
      <EmbeddedMarketplaceWrapper
        id={embeddedDivId}
        maxWidth={false}
        disableGutters
      />
      <Footer />
    </>
  );
}

Internationalization.getLayout = (page) => (
  <SidebarLayout>{page}</SidebarLayout>
);

export default Internationalization;
