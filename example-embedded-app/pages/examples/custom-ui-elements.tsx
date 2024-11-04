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
  Grid,
  LinearProgress,
  Typography,
} from "@mui/material";

import config from "prismatic/config";
import { CableTwoTone } from "@mui/icons-material";

import customUiElementsHelperText from "./custom-ui-elements.md";

interface MarketplaceIntegration {
  id: string;
  name: string;
  avatarUrl: string;
  description: string;
  overview: string;
  category: string;
  marketplaceConfiguration: string;
  isCustomerDeployable: boolean;
  versionNumber: number;
  versionSequence: {
    nodes: {
      id: string;
      versionNumber: number;
    }[];
  };
  instances: {
    nodes: {
      id: string;
      enabled: boolean;
      lastDeployedAt: string;
      configState: string;
    }[];
  };
}

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
        const query = `query getMarketplaceIntegrations {
          marketplaceIntegrations(
            sortBy: [{field: CATEGORY, direction: ASC}, {field: NAME, direction: ASC}]
          ) {
            nodes {
              id
              name
              avatarUrl
              description
              overview
              category
              marketplaceConfiguration
              isCustomerDeployable
              versionNumber
              versionSequence(first: 1, versionIsAvailable: true) {
                nodes {
                  id
                  versionNumber
                }
              }
              instances {
                nodes {
                  id
                  enabled
                  lastDeployedAt
                  configState
                }
              }
            }
          }
        }`;
        const response = await prismatic.graphqlRequest({ query });

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
                <Grid
                  item
                  xs={6}
                  md={4}
                  key={integration.id}
                  display="stretch"
                  flexDirection="column"
                >
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
                          integration.instances.nodes.length
                            ? "secondary"
                            : "primary"
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
                        {integration.instances.nodes.length ? "Edit" : "Add"}
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
