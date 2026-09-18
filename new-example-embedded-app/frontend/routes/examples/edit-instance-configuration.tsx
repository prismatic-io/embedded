import prismatic from "@prismatic-io/embedded";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { EmbedLoading } from "#/components/embed-loading";
import { HelperText } from "#/components/helper-text";
import { type Instance, InstanceCard } from "#/components/instance-card";
import { Page } from "#/components/page";
import { useTheme } from "#/components/theme-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { usePrismaticAuth } from "#/hooks/use-prismatic-auth";

export const Route = createFileRoute("/examples/edit-instance-configuration")({
  component: RouteComponent,
});

const WIZARD_SELECTOR = "#edit-instance-configuration";

const GET_INSTANCES_QUERY = `
  query getInstances {
    instances(sortBy: [{ field: NAME, direction: ASC }]) {
      nodes {
        id
        name
        enabled
        lastExecutedAt
        integration {
          name
          description
          category
        }
      }
    }
  }
`;

interface InstancesResponse {
  data: {
    instances: {
      nodes: Instance[];
    };
  };
}

/**
 * Embeds the configuration wizard for one instance.
 *
 * `editInstanceConfiguration` opens the wizard for an instance that already
 * exists, so the customer edits it instead of activating it again. It returns
 * a cleanup function that removes the listeners behind the three callbacks.
 */
function ConfigurationWizard({
  instanceId,
  onClose,
  onSaved,
}: {
  instanceId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { theme } = useTheme();

  useEffect(() => {
    const cleanup = prismatic.editInstanceConfiguration({
      instanceId,
      selector: WIZARD_SELECTOR,
      theme: theme === "light" ? "LIGHT" : "DARK",
      screenConfiguration: {
        // The webhook URL of the trigger is not useful to this customer, so
        // leave it out.
        configurationWizard: { triggerDetailsConfiguration: "hidden" },
      },
      onSuccess: onSaved,
      onDelete: onSaved,
      onCancel: onClose,
    });

    return () => cleanup?.();
  }, [instanceId, theme, onClose, onSaved]);

  return <div id="edit-instance-configuration" className="h-full" />;
}

function RouteComponent() {
  const { authenticated, error } = usePrismaticAuth();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Instance | null>(null);

  const loadInstances = useCallback(async () => {
    const response = (await prismatic.graphqlRequest({
      query: GET_INSTANCES_QUERY,
    })) as InstancesResponse;
    setInstances(response.data.instances.nodes);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authenticated) {
      loadInstances();
    }
  }, [authenticated, loadInstances]);

  const close = useCallback(() => setEditing(null), []);

  // The customer may have paused or deleted the instance in the wizard, so
  // read the list again before the dialog closes.
  const saved = useCallback(() => {
    setEditing(null);
    loadInstances();
  }, [loadInstances]);

  return (
    <Page
      title="Edit Instance Configuration"
      description="This page demonstrates how to list the integrations a customer already deployed and open the configuration wizard for one of them."
      actions={<HelperText id="edit-instance-configuration" />}
      fullHeight
    >
      <div className="relative h-full">
        {error ? (
          <p className="text-sm text-destructive">
            Error authenticating with Prismatic: {error.message}
          </p>
        ) : !authenticated || loading ? (
          <EmbedLoading label="Loading deployed instances" />
        ) : instances.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This customer has not deployed an integration yet.
          </p>
        ) : (
          <div className="h-full overflow-y-auto">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {instances.map((instance) => (
                <InstanceCard
                  key={instance.id}
                  instance={instance}
                  onConfigure={() => setEditing(instance)}
                />
              ))}
            </div>
          </div>
        )}

        <Dialog
          open={editing !== null}
          onOpenChange={(open) => {
            if (!open) {
              close();
            }
          }}
        >
          <DialogContent className="flex h-[85vh] max-w-4xl flex-col gap-0 p-0 sm:max-w-4xl">
            <DialogHeader className="border-b border-border p-4">
              <DialogTitle>{editing?.name}</DialogTitle>
              <DialogDescription>
                Change the configuration of this deployed integration.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1">
              {editing ? (
                <ConfigurationWizard
                  instanceId={editing.id}
                  onClose={close}
                  onSaved={saved}
                />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Page>
  );
}
