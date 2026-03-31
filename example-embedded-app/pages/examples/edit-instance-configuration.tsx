import Head from "next/head";

import prismatic from "@prismatic-io/embedded";

import React from "react";
import SidebarLayout from "@/layouts/SidebarLayout";
import usePrismaticAuth from "@/usePrismaticAuth";
import {
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  Container,
  Dialog,
  DialogContent,
  Grid2 as Grid,
  LinearProgress,
  Typography,
} from "@mui/material";

interface Instance {
  id: string;
  name: string;
  integration: {
    name: string;
    description: string;
  };
}

type InstancesResponse = {
  data: {
    instances: {
      nodes: Instance[];
    };
  };
};

function ConfigurationDialog({
  instanceId,
  onClose,
}: {
  instanceId: string;
  onClose: () => void;
}) {
  const embeddedDivId = "edit-instance-configuration-div";

  React.useEffect(() => {
    const cleanup = prismatic.editInstanceConfiguration({
      instanceId,
      selector: `#${embeddedDivId}`,
      theme: "LIGHT",
      screenConfiguration: {
        configurationWizard: {
          triggerDetailsConfiguration: "hidden",
        },
      },
      onCancel: onClose,
      onSuccess: onClose,
      onDelete: onClose,
    });
    return () => cleanup?.();
  }, [instanceId, onClose]);

  return (
    <DialogContent sx={{ height: "80vh", padding: 0 }} id={embeddedDivId} />
  );
}

function EditInstanceConfiguration() {
  const { authenticated, token } = usePrismaticAuth();
  const [loading, setLoading] = React.useState(true);
  const [instances, setInstances] = React.useState<Instance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = React.useState<
    string | null
  >(null);

  React.useEffect(() => {
    let mounted = true;

    if (authenticated && token) {
      const fetchInstances = async () => {
        const response = (await prismatic.graphqlRequest({
          query: `
            query getInstances {
              instances {
                nodes {
                  id
                  name
                  integration {
                    name
                    description
                  }
                }
              }
            }
          `,
        })) as InstancesResponse;

        if (mounted) {
          setInstances(response.data.instances.nodes);
          setLoading(false);
        }
      };
      fetchInstances();
    }

    return () => {
      mounted = false;
    };
  }, [authenticated, token]);

  const handleClose = React.useCallback(() => {
    setSelectedInstanceId(null);
  }, []);

  return (
    <>
      <Head>
        <title>Edit Instance Configuration</title>
      </Head>
      {loading ? (
        <Container>
          <LinearProgress />
        </Container>
      ) : (
        <Container>
          <Grid container spacing={2}>
            {instances.map((instance) => (
              <Grid key={instance.id} size={4}>
                <Card
                  elevation={3}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    height: "100%",
                  }}
                >
                  <CardHeader title={instance.name} />
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      {instance.integration.description}
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ justifyContent: "flex-end" }}>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => setSelectedInstanceId(instance.id)}
                    >
                      Configure
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      )}
      <Dialog
        open={Boolean(selectedInstanceId)}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
      >
        {selectedInstanceId && (
          <ConfigurationDialog
            instanceId={selectedInstanceId}
            onClose={handleClose}
          />
        )}
      </Dialog>
    </>
  );
}

EditInstanceConfiguration.getLayout = (page) => (
  <SidebarLayout>{page}</SidebarLayout>
);
export default EditInstanceConfiguration;
