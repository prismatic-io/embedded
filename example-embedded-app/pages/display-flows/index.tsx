import Head from "next/head";

import prismatic from "@prismatic-io/embedded";

import Footer from "@/components/Footer";
import SidebarLayout from "@/layouts/SidebarLayout";
import usePrismaticAuth from "@/usePrismaticAuth";
import {
  Box,
  Button,
  Container,
  LinearProgress,
  List,
  ListItem,
  Modal,
} from "@mui/material";
import React from "react";
import FlowRenderer from "./FlowRenderer";

interface Instance {
  id: string;
  name: string;
  integration: {
    definition: string;
  };
}

function DisplayFlowsExample() {
  const { authenticated, token } = usePrismaticAuth();
  const [pageLoading, setPageLoading] = React.useState(true);
  const [activeInstance, setActiveInstance] = React.useState<Instance>();
  const [instances, setInstances] = React.useState<Instance[]>([]);
  const [showModal, setShowModal] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    if (authenticated && token) {
      const fetchInstances = async () => {
        const query = `query getInstances {
          instances {
            nodes {
              id
              name
              integration {
                definition
              }
            }
          }
        }`;
        const response = await prismatic.graphqlRequest({ query });

        if (mounted) {
          setInstances(response.data.instances.nodes);
          setPageLoading(false);
        }
      };
      fetchInstances();
    }

    return () => {
      mounted = false;
    };
  }, [authenticated, token]);

  return (
    <>
      <Head>
        <title>Display Flows Example</title>
      </Head>
      {pageLoading ? (
        <Container>
          <LinearProgress />
        </Container>
      ) : (
        <Container>
          <List>
            {instances.map((instance) => (
              <ListItem key={instance.id}>
                {instance.name}
                <Button
                  onClick={() => {
                    setActiveInstance(instance);
                    setShowModal(true);
                  }}
                >
                  View Flow
                </Button>
              </ListItem>
            ))}
          </List>
        </Container>
      )}
      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false);
        }}
      >
        <Box
          sx={{
            position: "absolute" as "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            bgcolor: "background.paper",
            border: "2px solid #000",
            boxShadow: 24,
            p: 4,
          }}
        >
          {activeInstance ? (
            <FlowRenderer definition={activeInstance.integration.definition} />
          ) : null}
        </Box>
      </Modal>
      <Footer />
    </>
  );
}

DisplayFlowsExample.getLayout = (page) => (
  <SidebarLayout titleMarginBottom={4}>{page}</SidebarLayout>
);
export default DisplayFlowsExample;
