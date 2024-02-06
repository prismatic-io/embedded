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
  Card,
  CardContent,
  CardHeader,
  Container,
  Grid,
  LinearProgress,
  Typography,
} from "@mui/material";

import config from "prismatic/config";

import customComponentListHelperText from "./custom-component-list.md";

interface Component {
  id: string;
  versionNumber: number;
  label: string;
  description: string;
  iconUrl: string;
  public: boolean;
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

  return src ? <Avatar variant="rounded" src={src} /> : null;
}

function CustomComponentList() {
  const { authenticated, token } = usePrismaticAuth();
  const [marketPlaceLoading, setMarketplaceLoading] = React.useState(true);
  const [components, setComponents] = React.useState<Component[]>([]);

  React.useEffect(() => {
    let mounted = true;

    if (authenticated && token) {
      const fetchMarketplaceData = async () => {
        const query = `query getComponents($cursor: String) {
          components(after: $cursor, sortBy: {direction: ASC, field: LABEL}) {
            nodes {
              id
              versionNumber
              label
              description
              iconUrl
              public
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
        `;
        let components: Component[] = [];
        let cursor: string = "";

        /** The Prismatic API is paginated; loop over pages of 100 records of components until there are no more pages to fetch. */
        do {
          const response = await prismatic.graphqlRequest({
            query,
            variables: { cursor },
          });
          components = components.concat(response.data.components.nodes);
          cursor = response.data.components.pageInfo.endCursor;
        } while (cursor);

        if (mounted) {
          setComponents(components);
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
        <title>Components in Custom UI Elements</title>
      </Head>
      <PageTitleWrapper>
        <ExampleHeader markdown={customComponentListHelperText} />
      </PageTitleWrapper>
      {marketPlaceLoading ? (
        <Container>
          <LinearProgress />
        </Container>
      ) : (
        <Container>
          <Grid container spacing={2}>
            {components.map((component) => (
              <Grid
                item
                xs={6}
                md={4}
                key={component.id}
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
                        avatarUrl={component.iconUrl}
                        token={token}
                      />
                    }
                    title={`${component.label} - v${component.versionNumber} `}
                  />
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      {!component.public && <strong>Private: </strong>}
                      {component.description}
                    </Typography>
                  </CardContent>
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

CustomComponentList.getLayout = (page) => (
  <SidebarLayout titleMarginBottom={4}>{page}</SidebarLayout>
);
export default CustomComponentList;
