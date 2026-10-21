import {
  type ConfigurationConnectionSelection,
  type ConfigurationResource,
  HostedConfiguration,
  type InstanceResource,
  type JsonSchema,
  type ListItem,
  type MarketplaceIntegrationResource,
  useConfiguration,
  useInstance,
  useMarketplace,
  useMarketplaceFilterOptions,
  useMarketplaceIntegration,
} from "@prismatic-io/solis-react";
import { createFileRoute } from "@tanstack/react-router";
import { AppWindow, Loader2, PanelsTopLeft, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EmbedLoading } from "#/components/embed-loading";
import { ConfigurationEditor } from "#/components/headless/configuration-editor";
import { ConnectionPicker } from "#/components/headless/connection-picker";
import { HeadlessSession } from "#/components/headless/headless-session";
import {
  currentInstance,
  IntegrationAvatar,
  LIFECYCLE_LABELS,
} from "#/components/headless/integration-avatar";
import { HelperText } from "#/components/helper-text";
import { Page } from "#/components/page";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { useDebouncedValue } from "#/hooks/use-debounced-value";

export const Route = createFileRoute("/examples/headless-configuration")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Page
      title="Headless Configuration"
      description="A marketplace drawn with this app's own components, built with @prismatic-io/solis-react. Integrations that support headless configuration are set up with this app's own forms. The rest open Prismatic's configuration wizard in an iframe."
      actions={<HelperText id="headless-configuration" />}
      fullHeight
    >
      <div className="relative h-full">
        <HeadlessSession>
          <Marketplace />
        </HeadlessSession>
      </div>
    </Page>
  );
}

const ALL_CATEGORIES = "__all__";

/** Every integration in the marketplace, headless or not, with a search. */
function Marketplace() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const query = useDebouncedValue(search, 300);
  const filterOptions = useMarketplaceFilterOptions();
  const marketplace = useMarketplace({
    includeActiveIntegrations: true,
    ...(query ? { search: query } : {}),
    ...(category !== ALL_CATEGORIES ? { category } : {}),
  });
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-72">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search integrations"
            className="pl-8"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
            {filterOptions.status === "success"
              ? filterOptions.data.categories.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))
              : null}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <PanelsTopLeft className="size-3.5" /> Set up in Acme
          </span>
          <span className="flex items-center gap-1.5">
            <AppWindow className="size-3.5" /> Prismatic wizard
          </span>
        </div>
      </div>

      {/* The padding keeps the cards' outlines inside the scroll area. */}
      <div className="relative min-h-0 flex-1 overflow-y-auto p-1">
        {marketplace.status === "loading" ? (
          <EmbedLoading label="Loading the integration marketplace" />
        ) : marketplace.status === "error" ? (
          <div className="flex items-center gap-3">
            <p>{marketplace.error.message}</p>
            <Button onClick={() => marketplace.actions.refresh.execute()}>
              Retry
            </Button>
          </div>
        ) : marketplace.data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No integrations match.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {marketplace.data.items.map((item) => (
              <IntegrationCard
                key={item.id}
                item={item}
                onOpen={() => setSelected(item.id)}
              />
            ))}
          </div>
        )}
      </div>

      <SetupDialog integrationId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function IntegrationCard({
  item,
  onOpen,
}: {
  item: ListItem<MarketplaceIntegrationResource>;
  onOpen: () => void;
}) {
  if (item.status !== "success") {
    return <Card className="h-44 animate-pulse" />;
  }
  const integration = item.data;
  const instance = currentInstance(integration.instances);
  const lifecycle =
    instance?.status === "success"
      ? LIFECYCLE_LABELS[instance.data.lifecycle]
      : null;
  const headless = integration.configurationExperience === "headless";

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader>
        <IntegrationAvatar
          name={integration.name}
          avatarUrl={integration.avatarUrl}
        />
        <CardTitle>{integration.name}</CardTitle>
        <CardDescription className="line-clamp-2">
          {integration.description || "No description provided."}
        </CardDescription>
        {lifecycle ? (
          <CardAction>
            <Badge variant={lifecycle.variant}>{lifecycle.label}</Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-wrap items-end gap-2 text-xs text-muted-foreground">
        {/* The marketplace reports the experience of its latest version.
            Setup checks the version it actually configures. */}
        {headless ? (
          <Badge variant="secondary">
            <PanelsTopLeft /> Set up in Acme
          </Badge>
        ) : (
          <Badge variant="outline">
            <AppWindow /> Prismatic wizard
          </Badge>
        )}
        {integration.category ? (
          <Badge variant="outline">{integration.category}</Badge>
        ) : null}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          variant={instance ? "outline" : "default"}
          onClick={onOpen}
        >
          {instance ? "Manage" : "Set up"}
        </Button>
      </CardFooter>
    </Card>
  );
}

/**
 * Sets up or manages one integration in a dialog. Opening it on an integration
 * the customer hasn't activated creates an instance, which stays "Not
 * deployed" until the customer finishes setting it up.
 */
function SetupDialog({
  integrationId,
  onClose,
}: {
  integrationId: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={integrationId !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-5xl">
        {integrationId ? (
          <IntegrationSetup
            key={integrationId}
            integrationId={integrationId}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function IntegrationSetup({
  integrationId,
  onClose,
}: {
  integrationId: string;
  onClose: () => void;
}) {
  const integration = useMarketplaceIntegration(integrationId);
  const [error, setError] = useState("");
  // Until the listing reloads, it may not list the instance created here.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const started = useRef(false);

  const data = integration.status === "success" ? integration.data : null;
  const instanceId = (data && currentInstance(data.instances)?.id) ?? createdId;
  const canCreate =
    !!data && !data.instancesError && data.permissions.createInstance.allowed;

  // The customer chose "Set up", so activate the integration right away.
  const { createInstance } = integration.actions;
  useEffect(() => {
    if (!data || instanceId || !canCreate || started.current) return;
    started.current = true;
    createInstance.execute({ name: data.name }).then((result) => {
      if (result.status === "success") setCreatedId(result.data.id);
      else setError(result.error.message);
    });
  }, [data, instanceId, canCreate, createInstance]);

  if (integration.status === "loading") {
    return <Loader2 className="animate-spin text-muted-foreground" />;
  }
  if (integration.status === "error") {
    return <p className="text-destructive">{integration.error.message}</p>;
  }
  const { name, overview, description, avatarUrl, permissions } =
    integration.data;

  return (
    <>
      <DialogHeader className="flex-row items-center gap-3">
        <IntegrationAvatar name={name} avatarUrl={avatarUrl} className="mb-0" />
        <div className="flex flex-col gap-1">
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription className="line-clamp-2">
            {overview || description}
          </DialogDescription>
        </div>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : integration.data.instancesError ? (
          // The listing loads even when the customer's instances couldn't be
          // read, but with no instances and `createInstance` denied.
          <div className="flex items-center gap-3 text-sm">
            <p className="text-muted-foreground">
              Couldn't load your instances of {name}.{" "}
              {integration.data.instancesError.message}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={integration.actions.refresh.status === "loading"}
              onClick={() => integration.actions.refresh.execute()}
            >
              Retry
            </Button>
          </div>
        ) : instanceId ? (
          <InstanceSetup instanceId={instanceId} onClose={onClose} />
        ) : !canCreate ? (
          <p className="text-sm text-muted-foreground">
            You can't activate this integration (
            {permissions.createInstance.reason}).
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Activating {name}…
          </p>
        )}
      </div>
    </>
  );
}

/**
 * The version being configured decides who draws its
 * configuration. A headless version gets this app's forms. A hosted one, which
 * uses config pages, gets Prismatic's configuration wizard in an iframe.
 */
function InstanceSetup({
  instanceId,
  onClose,
}: {
  instanceId: string;
  onClose: () => void;
}) {
  const instance = useInstance(instanceId);
  // Saving an update moves the instance to it, after which it offers no
  // update. Remember the version under review so the review can finish.
  const [reviewing, setReviewing] = useState<string | null>(null);
  const update = instance.status === "success" ? instance.data.update : null;
  const reviewVersionId =
    reviewing ??
    (update?.requiresReconfiguration ? update.integrationVersionId : null);
  useEffect(() => {
    if (reviewVersionId && !reviewing) setReviewing(reviewVersionId);
  }, [reviewVersionId, reviewing]);
  // Leave out `integrationVersionId` for the version the instance runs, or
  // pass an update's version to configure that version before moving to it.
  const configuration = useConfiguration({
    instanceId,
    integrationVersionId: reviewVersionId ?? undefined,
  });

  if (instance.status === "loading" || configuration.status === "loading") {
    return <Loader2 className="animate-spin text-muted-foreground" />;
  }
  if (instance.status === "error") {
    return <p className="text-destructive">{instance.error.message}</p>;
  }
  if (configuration.status === "error") {
    return <p className="text-destructive">{configuration.error.message}</p>;
  }

  if (configuration.data.configurationExperience === "hosted") {
    // The wizard closes itself when the customer finishes or cancels, and
    // Solis refreshes whatever it changed, such as the instance's status.
    return (
      <div className="h-[70vh] overflow-hidden rounded-lg border">
        <HostedConfiguration
          instanceId={instanceId}
          className="h-full w-full"
          onClose={onClose}
        />
      </div>
    );
  }

  return (
    <HeadlessSetup
      instance={instance}
      configuration={configuration}
      reviewing={reviewVersionId !== null}
      onReviewed={() => setReviewing(null)}
      onRemoved={onClose}
    />
  );
}

/**
 * A headless integration: connect the customer's accounts, configure it with
 * this app's form, then manage the deployed instance. The same steps set up a
 * new instance, edit a deployed one, and review an update whose
 * configuration changed shape.
 */
function HeadlessSetup({
  instance,
  configuration,
  reviewing,
  onReviewed,
  onRemoved,
}: {
  instance: InstanceResource;
  configuration: ConfigurationResource;
  /** `configuration` is for an update the customer must review. */
  reviewing: boolean;
  onReviewed: () => void;
  onRemoved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [selections, setSelections] = useState<
    ConfigurationConnectionSelection[] | null
  >(null);
  if (instance.status !== "success" || configuration.status !== "success") {
    return null;
  }

  const { lifecycle } = instance.data;
  const needsSetup =
    lifecycle === "notDeployed" ||
    lifecycle === "needsReconfiguration" ||
    reviewing;

  if (!needsSetup && !editing) {
    return (
      <InstanceSummary
        instance={instance}
        schema={configuration.data.schema}
        onEdit={() => setEditing(true)}
        onRemoved={onRemoved}
      />
    );
  }

  const { connections } = configuration.data;
  const requirements =
    connections.status === "success" ? (connections.data.instance ?? []) : [];
  const needsConnections = requirements.length > 0 && !selections;
  const steps = requirements.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {reviewing ? (
        <p className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          Version {configuration.data.versionNumber} changes how this
          integration is configured. Review your settings to update to it.
        </p>
      ) : null}
      {steps ? (
        <ol className="flex gap-6 text-sm">
          <li
            className={
              needsConnections ? "font-medium" : "text-muted-foreground"
            }
          >
            1. Connect your accounts
          </li>
          <li
            className={
              needsConnections ? "text-muted-foreground" : "font-medium"
            }
          >
            2. Configure {configuration.data.integrationName}
          </li>
        </ol>
      ) : null}
      {needsConnections || connections.status !== "success" ? (
        // Shows the loading and error states of the requirements, too.
        <ConnectionPicker
          configuration={configuration}
          onContinue={setSelections}
        />
      ) : (
        <ConfigurationEditor
          key={configuration.data.versionNumber}
          configuration={configuration}
          connections={selections ?? undefined}
          submitLabel={
            lifecycle === "notDeployed"
              ? "Save and activate"
              : "Save and deploy"
          }
          onDeployed={() => {
            setEditing(false);
            setSelections(null);
            onReviewed();
          }}
          onCancel={
            needsSetup
              ? undefined
              : () => {
                  setEditing(false);
                  setSelections(null);
                }
          }
        />
      )}
    </div>
  );
}

/** A deployed headless instance: its status, saved values, and webhook URLs. */
function InstanceSummary({
  instance,
  schema,
  onEdit,
  onRemoved,
}: {
  instance: InstanceResource;
  schema: JsonSchema;
  onEdit: () => void;
  onRemoved: () => void;
}) {
  if (instance.status !== "success") return null;
  const { lifecycle, configuration, flows, permissions, update } =
    instance.data;
  const { pause, resume, remove, upgrade, deploy } = instance.actions;
  const status = LIFECYCLE_LABELS[lifecycle];

  return (
    <div className="flex flex-col gap-6">
      {update && !update.requiresReconfiguration ? (
        // The new version saves configuration in the same shape, so the
        // instance can move to it keeping its values.
        <div className="flex items-center justify-between gap-3 rounded-lg border p-4">
          <span className="text-sm">
            Version {update.versionNumber} is available. Your configuration
            carries over as it is.
          </span>
          <Button
            disabled={
              !permissions.upgrade.allowed ||
              upgrade.status === "loading" ||
              deploy.status === "loading"
            }
            onClick={async () => {
              const moved = await upgrade.execute();
              if (moved.status === "success") await deploy.execute();
            }}
          >
            Update to version {update.versionNumber}
          </Button>
        </div>
      ) : null}
      <div className="flex items-center justify-between">
        <Badge variant={status.variant}>{status.label}</Badge>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onEdit}>
            Edit configuration
          </Button>
          {lifecycle === "paused" ? (
            <Button
              variant="outline"
              disabled={!permissions.resume.allowed}
              onClick={() => resume.execute()}
            >
              Resume
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={!permissions.pause.allowed}
              onClick={() => pause.execute()}
            >
              Pause
            </Button>
          )}
          <Button
            variant="destructive"
            disabled={!permissions.remove.allowed}
            onClick={async () => {
              if (!window.confirm("Remove this instance?")) return;
              const removed = await remove.execute();
              if (removed.status === "success") onRemoved();
            }}
          >
            Remove
          </Button>
        </div>
      </div>
      <SavedValues schema={schema} value={configuration.value} />
      <section className="flex flex-col gap-2">
        <h3 className="font-medium">Webhook URLs</h3>
        {flows.map((flow) => (
          <div key={flow.id} className="flex flex-col gap-1">
            <span className="text-sm">{flow.name}</span>
            <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
              {flow.webhookUrl}
            </pre>
          </div>
        ))}
      </section>
    </div>
  );
}

/**
 * Saved values, labeled with the titles in the configuration's JSON Schema.
 * Any headless integration's values display this way, form or no form.
 */
function SavedValues({
  schema,
  value,
}: {
  schema: JsonSchema;
  value: unknown;
}) {
  if (!value || typeof value !== "object" || Object.keys(value).length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing saved yet.</p>;
  }
  const properties =
    typeof schema === "object"
      ? ((schema.properties ?? {}) as Record<string, { title?: string }>)
      : {};
  const display = (entry: unknown) =>
    entry && typeof entry === "object"
      ? Object.entries(entry)
          .map(([key, nested]) => `${key} → ${String(nested)}`)
          .join(", ")
      : String(entry);

  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-medium">Configuration</h3>
      <dl className="grid grid-cols-[10rem_1fr] gap-y-1 text-sm">
        {Object.entries(value).map(([key, entry]) => (
          <div key={key} className="contents">
            <dt className="text-muted-foreground">
              {properties[key]?.title ?? key}
            </dt>
            <dd>
              <code className="text-xs">{display(entry)}</code>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
