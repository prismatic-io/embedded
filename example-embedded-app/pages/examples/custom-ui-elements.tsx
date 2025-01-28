import Head from "next/head";

import prismatic from "@prismatic-io/embedded";

import React, { useEffect } from "react";
import SidebarLayout from "@/layouts/SidebarLayout";
import ExampleHeader from "@/components/ExampleHeader";
import PageTitleWrapper from "@/components/PageTitleWrapper";
import Footer from "@/components/Footer";
import usePrismaticAuth from "@/usePrismaticAuth";
import {
  Avatar,
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  Container,
  Grid2 as Grid,
  LinearProgress,
  Typography,
} from "@mui/material";

import config from "prismatic/config";
import { CableTwoTone } from "@mui/icons-material";

import customUiElementsHelperText from "./custom-ui-elements.md";

interface MarketplaceIntegration {
  id: string;
  name: string;
  allowMultipleMarketplaceInstances: boolean;
  avatarUrl?: string;
  category: string;
  description: string;
  isCustomerDeployable: boolean;
  marketplaceConfiguration: string;
  overview: string;
  versionNumber: number;
  firstDeployedInstance?: {
    id: string;
  };
  deployedInstances: "ZERO" | "ONE" | "MULTIPLE";
  deploymentStatus?: "ACTIVATED" | "PAUSED" | "UNCONFIGURED";
}

type MarketplaceIntegrationsResponse = {
  data: {
    marketplaceIntegrations: {
      nodes: MarketplaceIntegration[];
    };
  };
};

/**
 * This component is used to display the avatar for a marketplace integration.
 * Icons are used if the integration does not have an avatar.
 * Images are fetched from a presigned S3 URL.
 */
function PrismaticAvatar({ avatarUrl, token }) {
  const [src, setSrc] = React.useState("");

  useEffect(() => {
    let mounted = true;
    if (avatarUrl) {
      fetch(`${config.prismaticUrl}${avatarUrl}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((response) => {
        response.json().then((data) => {
          if (mounted) {
            setSrc(data.url);
          }
        });
      });
    }

    return () => {
      mounted = false;
    };
  }, []);

  if (!avatarUrl) {
    return (
      <Avatar>
        <CableTwoTone />
      </Avatar>
    );
  }

  return src ? <Avatar variant="rounded" src={src} /> : null;
}

function CustomUiElements() {
  const { authenticated, token } = usePrismaticAuth();
  const [marketPlaceLoading, setMarketplaceLoading] = React.useState(true);
  const [marketplaceIntegrations, setMarketplaceIntegrations] = React.useState<
    MarketplaceIntegration[]
  >([]);

  React.useEffect(() => {
    let mounted = true;

    if (authenticated && token) {
      const fetchMarketplaceData = async () => {
        const query = `
          query getMarketplaceIntegrations {
            marketplaceIntegrations(
              includeActiveIntegrations: true
              sortBy: [
                { field: CATEGORY, direction: ASC }
                { field: NAME, direction: ASC }
              ]
            ) {
              nodes {
                id
                name
                allowMultipleMarketplaceInstances
                avatarUrl
                category
                description
                isCustomerDeployable
                marketplaceConfiguration
                overview
                versionNumber
                firstDeployedInstance {
                  id
                }
                deployedInstances
                deploymentStatus
              }
            }
          }
        `;
        const response = (await prismatic.graphqlRequest({
          query,
        })) as MarketplaceIntegrationsResponse;

        if (mounted) {
          setMarketplaceIntegrations(
            response.data.marketplaceIntegrations.nodes,
          );
          setMarketplaceLoading(false);
        }
      };
      fetchMarketplaceData();
    }

    return () => {
      mounted = false;
    };
  }, [authenticated, token]);

  return (
    <>
      <Head>
        <title>Custom UI Elements</title>
      </Head>
      <PageTitleWrapper>
        <ExampleHeader markdown={customUiElementsHelperText} />
      </PageTitleWrapper>
      {marketPlaceLoading ? (
        <Container>
          <LinearProgress />
        </Container>
      ) : (
        <Container>
          <Grid container spacing={2}>
            {marketplaceIntegrations
              .filter((integration) => integration.isCustomerDeployable)
              .map((integration) => (
                <Grid key={integration.id} size={4}>
                  <Card
                    elevation={3}
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      height: "100%",
                    }}
                  >
                    <CardHeader
                      avatar={
                        <PrismaticAvatar
                          avatarUrl={integration.avatarUrl}
                          token={token}
                        />
                      }
                      title={integration.name}
                    />
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        {integration.description}
                      </Typography>
                    </CardContent>
                    <CardActions sx={{ justifyContent: "flex-end" }}>
                      <Button
                        size="small"
                        variant="contained"
                        color={
                          integration.deployedInstances === "ZERO"
                            ? "primary"
                            : "secondary"
                        }
                        onClick={() =>
                          prismatic.configureIntegration({
                            integrationName: integration.name,
                            theme: "LIGHT",
                            usePopover: true,
                            skipRedirectOnRemove: true,
                            screenConfiguration: {
                              configurationWizard: { isInModal: true },
                            },
                          })
                        }
                      >
                        {integration.deployedInstances === "ZERO"
                          ? "Add"
                          : "Edit"}
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
          </Grid>
        </Container>
      )}
      <Footer />
    </>
  );
}

CustomUiElements.getLayout = (page) => (
  <SidebarLayout titleMarginBottom={4}>{page}</SidebarLayout>
);
export default CustomUiElements;
