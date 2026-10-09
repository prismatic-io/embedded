import {
  type ConfigurationResource,
  PrismaticProvider as HeadlessProvider,
  HostedConfiguration,
  type ListItem,
  type MarketplaceIntegrationResource,
  type Result,
  useConfiguration,
  useInstance,
  useMarketplace,
  useMarketplaceIntegration,
  usePrismatic,
} from "@prismatic-io/solis-react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EmbedLoading } from "#/components/embed-loading";
import {
  type AcmeField,
  acmeFieldsFromSchema,
  type FakeCrmConfiguration,
  FakeCrmConfigurationForm,
} from "#/components/headless/fake-crm-configuration-form";
import { HelperText } from "#/components/helper-text";
import { Page } from "#/components/page";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
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
import { usePrismaticAuth } from "#/hooks/use-prismatic-auth";

export const Route = createFileRoute("/examples/headless-configuration")({
  component: RouteComponent,
});

/**
 * Headless configuration uses `@prismatic-io/solis-react`, not the
 * `@prismatic-io/embedded` iframe SDK the other examples use. Its provider
 * takes the same embedded JWT. Here the token comes from the app's existing
 * auth hook, which also refreshes it before it expires; the provider applies a
 * new token to the live session.
 */
function RouteComponent() {
  const { token, prismaticUrl, error } = usePrismaticAuth();

  if (error) {
    return (
      <PageWrapper>
        <p>Error authenticating with Prismatic: {error.message}</p>
      </PageWrapper>
    );
  }
  if (!token) {
    return (
      <PageWrapper>
        <EmbedLoading label="Signing in to Prismatic" />
      </PageWrapper>
    );
  }
  return (
    <PageWrapper>
      <HeadlessProvider prismaticUrl={prismaticUrl} auth={{ token }}>
        <Marketplace />
      </HeadlessProvider>
    </PageWrapper>
  );
}

/** The integrations this customer can activate, drawn with the app's own cards. */
function Marketplace() {
  const session = usePrismatic();
  const marketplace = useMarketplace({ includeActiveIntegrations: true });
  const [selected, setSelected] = useState<string | null>(null);

  if (session.status === "error") {
    return <p>Could not connect to Prismatic: {session.error.message}</p>;
  }
  if (session.status === "loading" || marketplace.status === "loading") {
    return <EmbedLoading label="Loading the integration marketplace" />;
  }
  if (marketplace.status === "error") {
    return (
      <div className="flex items-center gap-3">
        <p>{marketplace.error.message}</p>
        <Button onClick={() => marketplace.actions.refresh.execute()}>
          Retry
        </Button>
      </div>
    );
  }
  if (selected) {
    return (
      <IntegrationSetup
        integrationId={selected}
        onBack={() => setSelected(null)}
      />
    );
  }

  const { items } = marketplace.data;
  return (
    // The padding keeps the cards' outlines inside the scroll area, which
    // would otherwise clip them at its edges.
    <div className="h-full overflow-y-auto p-1">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          This customer has no integrations in the marketplace.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <IntegrationCard
              key={item.id}
              item={item}
              onOpen={() => setSelected(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const LIFECYCLE_LABELS = {
  notDeployed: { label: "Not deployed", variant: "outline" },
  needsReconfiguration: { label: "Needs review", variant: "destructive" },
  needsUserConfiguration: { label: "Needs your setup", variant: "outline" },
  paused: { label: "Paused", variant: "secondary" },
  pendingChanges: { label: "Changes not deployed", variant: "outline" },
  active: { label: "Active", variant: "default" },
} as const;

function IntegrationCard({
  item,
  onOpen,
}: {
  item: ListItem<MarketplaceIntegrationResource>;
  onOpen: () => void;
}) {
  if (item.status !== "success") {
    return <Card className="h-40 animate-pulse" />;
  }
  const integration = item.data;
  // Each listing carries the customer's instances as live instance resources.
  const [instance] = integration.instances;
  const lifecycle =
    instance?.status === "success"
      ? LIFECYCLE_LABELS[instance.data.lifecycle]
      : null;

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
        {/* "headless" integrations are configured with your own UI;
            "hosted" ones with Prismatic's configuration wizard. */}
        <Badge variant="secondary">{integration.configurationExperience}</Badge>
        {integration.category ? (
          <Badge variant="outline">{integration.category}</Badge>
        ) : null}
        <span>Version {integration.versionNumber}</span>
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
 * An integration's icon. `avatarUrl` is a path on your Prismatic stack. An
 * authenticated request to it returns `{ url }`, a short-lived link to the
 * image itself.
 */
function IntegrationAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const { token, prismaticUrl } = usePrismaticAuth();
  const [src, setSrc] = useState("");

  useEffect(() => {
    if (!avatarUrl || !token) return;
    let mounted = true;
    fetch(`${prismaticUrl}${avatarUrl}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => response.json())
      .then((body: { url?: string }) => {
        if (mounted && body.url) setSrc(body.url);
      })
      .catch(() => {
        // Keep the fallback initials.
      });
    return () => {
      mounted = false;
    };
  }, [avatarUrl, token, prismaticUrl]);

  return (
    <Avatar className="mb-1 size-10 rounded-md after:rounded-md">
      <AvatarImage
        src={src}
        alt=""
        className="rounded-md bg-muted object-contain p-1"
      />
      <AvatarFallback className="rounded-md font-medium">
        {name.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

/** One integration: activate it, or manage the instance the customer has. */
function IntegrationSetup({
  integrationId,
  onBack,
}: {
  integrationId: string;
  onBack: () => void;
}) {
  const integration = useMarketplaceIntegration(integrationId);
  const [error, setError] = useState("");
  const retries = useRef(0);

  // If the customer's instances couldn't be read, the listing still loads,
  // but with no instances and `createInstance` denied. Read it again a few
  // times before asking the customer to retry.
  const instancesError =
    integration.status === "success" ? integration.data.instancesError : null;
  const { refresh } = integration.actions;
  useEffect(() => {
    if (!instancesError) {
      retries.current = 0;
      return;
    }
    if (retries.current >= 3) return;
    const timer = setTimeout(
      () => {
        retries.current += 1;
        refresh.execute();
      },
      1000 * 2 ** retries.current,
    );
    return () => clearTimeout(timer);
  }, [instancesError, refresh]);

  const back = (
    <Button variant="ghost" size="sm" onClick={onBack} className="self-start">
      <ArrowLeft data-icon="inline-start" /> All integrations
    </Button>
  );
  if (integration.status === "loading") {
    return <Loader2 className="animate-spin text-muted-foreground" />;
  }
  if (integration.status === "error") {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <p className="text-destructive">{integration.error.message}</p>
      </div>
    );
  }

  const { name, overview, description, instances, permissions } =
    integration.data;
  const { createInstance } = integration.actions;
  const [instance] = instances;

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto pb-8">
      {back}
      <div>
        <h3 className="text-xl font-semibold">{name}</h3>
        <p className="text-sm text-muted-foreground">
          {overview || description}
        </p>
      </div>
      {instancesError ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground">
            Couldn't load your instances of {name}. {instancesError.message}
          </p>
          <Button
            variant="outline"
            disabled={refresh.status === "loading"}
            onClick={() => refresh.execute()}
          >
            {refresh.status === "loading" ? (
              <Loader2 className="animate-spin" />
            ) : null}
            Retry
          </Button>
        </div>
      ) : instance ? (
        <InstanceSetup instanceId={instance.id} />
      ) : (
        <div className="flex flex-col items-start gap-2">
          {/* Activating creates an instance that isn't deployed yet. The
              customer configures it, then the app deploys it. */}
          <Button
            disabled={
              !permissions.createInstance.allowed ||
              createInstance.status === "loading"
            }
            onClick={async () => {
              setError("");
              const created = await createInstance.execute({ name });
              if (created.status === "error") setError(created.error.message);
            }}
          >
            {createInstance.status === "loading" ? (
              <Loader2 className="animate-spin" />
            ) : null}
            Activate {name}
          </Button>
          {!permissions.createInstance.allowed ? (
            <p className="text-sm text-muted-foreground">
              You can't activate this integration (
              {permissions.createInstance.reason}).
            </p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      )}
    </div>
  );
}

/**
 * Decides what an instance needs: a compatible update, a review of an update
 * that changed the configuration's shape, Prismatic's wizard for a hosted
 * version, or this app's own form for a headless one.
 */
function InstanceSetup({ instanceId }: { instanceId: string }) {
  const instance = useInstance(instanceId);
  const [editing, setEditing] = useState(false);
  // Saving an update moves the instance to it, after which it offers no
  // update. Remember the version under review so the review can finish.
  const [reviewing, setReviewing] = useState<string | null>(null);

  const update = instance.status === "success" ? instance.data.update : null;
  const reviewVersionId =
    reviewing ??
    (update?.requiresReconfiguration ? update.integrationVersionId : null);
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

  const { lifecycle } = instance.data;
  const { configurationExperience } = configuration.data;

  // A hosted version has no schema for this app to render: open Prismatic's
  // configuration wizard instead. It offers any available update itself.
  if (configurationExperience === "hosted") {
    return (
      <div className="h-[70vh] min-h-96 rounded-lg border">
        <HostedConfiguration
          instanceId={instanceId}
          className="h-full w-full"
        />
      </div>
    );
  }

  const needsConfiguration =
    lifecycle === "notDeployed" ||
    lifecycle === "needsReconfiguration" ||
    reviewVersionId !== null;

  if (editing || needsConfiguration) {
    return (
      <Editor
        key={configuration.data.versionNumber}
        configuration={configuration}
        title={
          reviewVersionId
            ? `Review the update to version ${configuration.data.versionNumber}`
            : lifecycle === "notDeployed"
              ? "Set up the integration"
              : "Edit configuration"
        }
        submitLabel={
          lifecycle === "notDeployed" ? "Save and activate" : "Save and deploy"
        }
        onStart={() => reviewVersionId && setReviewing(reviewVersionId)}
        onSave={async () => {
          // Saving stores values (and, for an update, moves the instance to
          // that version). Deploying is what makes the instance run them.
          const deployed = await instance.actions.deploy.execute();
          if (deployed.status === "success") {
            setEditing(false);
            setReviewing(null);
          }
          return deployed;
        }}
        onCancel={
          needsConfiguration
            ? undefined
            : () => {
                setEditing(false);
              }
        }
      />
    );
  }

  return (
    <InstanceSummary
      instanceId={instanceId}
      acmeFields={acmeFieldsFromSchema(
        configuration.data.schema,
        configuration.data.uiSchema,
      )}
      onEdit={() => setEditing(true)}
    />
  );
}

/** What `init` returns for the Fake CRM integration. Its author chose this shape. */
interface InitProposal {
  migratedValues: FakeCrmConfiguration;
  unresolvedReasons?: string[];
}

type FieldError = { path: string | null; message: string };

/**
 * Asks the integration's `init` for suggested values, shows them in the form,
 * then saves and deploys. The same component sets up a new instance, edits a
 * saved configuration, and reviews an update.
 */
function Editor({
  configuration,
  title,
  submitLabel,
  onStart,
  onSave,
  onCancel,
}: {
  configuration: ConfigurationResource;
  title: string;
  submitLabel: string;
  onStart: () => void;
  onSave: () => Promise<Result<void, { message: string }>>;
  onCancel?: () => void;
}) {
  const [proposal, setProposal] = useState<InitProposal | null>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const { init, save } = configuration.actions;
  const ready = configuration.status === "success";

  // `init` proposes values and saves nothing, so it's safe to run on open.
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    onStart();
    init.execute({}).then((result) => {
      if (result.status === "success") {
        setProposal(result.data as InitProposal);
      } else {
        setError(result.error.message);
      }
    });
  }, [init, ready, onStart]);

  if (configuration.status !== "success") return null;
  const { serverFunctions } = configuration.data;

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-6">
      <h3 className="text-lg font-semibold">{title}</h3>
      {!proposal ? (
        error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Preparing your
            configuration…
          </p>
        )
      ) : !serverFunctions.some(({ key }) => key === "listRecordTypes") ? (
        // This page's form is written for the Fake CRM integration. Another
        // headless integration needs a form built for its own schema.
        <div className="text-sm text-muted-foreground">
          This example's form is built for the Fake CRM integration. This
          integration's schema is:
          <pre className="mt-2 overflow-x-auto rounded bg-muted p-3 text-xs">
            {JSON.stringify(configuration.data.schema, null, 2)}
          </pre>
        </div>
      ) : (
        <>
          {proposal.unresolvedReasons?.length ? (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
              <strong>Check these before saving:</strong>
              <ul className="ml-5 list-disc">
                {proposal.unresolvedReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <FakeCrmConfigurationForm
            configuration={configuration}
            initialValues={proposal.migratedValues}
            busy={busy}
            submitLabel={submitLabel}
            fieldErrors={fieldErrors}
            onCancel={onCancel}
            onSubmit={async (value) => {
              setBusy(true);
              setError("");
              setFieldErrors([]);
              // Prismatic validates the value against the integration's
              // schema. Invalid fields come back on the error, by path.
              const saved = await save.execute({ value });
              if (saved.status === "error") {
                setError(saved.error.message);
                setFieldErrors([...(saved.error.fields ?? [])]);
                setBusy(false);
                return;
              }
              const deployed = await onSave();
              if (deployed.status === "error") setError(deployed.error.message);
              setBusy(false);
            }}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </>
      )}
    </section>
  );
}

/**
 * Whether a saved value has the Fake CRM configuration's shape. An instance
 * that has never been saved holds `{}`, not `null`, and a just-saved value can
 * take a moment to reach the instance resource, so check before reading it.
 */
function isFakeCrmConfiguration(value: unknown): value is FakeCrmConfiguration {
  if (!value || typeof value !== "object") return false;
  const { recordType, fieldMapping } = value as Partial<FakeCrmConfiguration>;
  return typeof recordType === "string" && typeof fieldMapping === "object";
}

/** A deployed instance: what it saved, and how to run its flow. */
function InstanceSummary({
  instanceId,
  acmeFields,
  onEdit,
}: {
  instanceId: string;
  acmeFields: AcmeField[];
  onEdit: () => void;
}) {
  const instance = useInstance(instanceId);
  if (instance.status !== "success") return null;
  const { lifecycle, configuration, flows, integrationVersionNumber, update } =
    instance.data;
  const { pause, resume, upgrade, deploy, remove } = instance.actions;
  const { permissions } = instance.data;
  const saved = isFakeCrmConfiguration(configuration.value)
    ? configuration.value
    : null;
  const status = LIFECYCLE_LABELS[lifecycle];

  return (
    <div className="flex flex-col gap-6">
      {update && !update.requiresReconfiguration ? (
        // The new version saves configuration in the same shape, so the
        // instance can move to it keeping its values.
        <div className="flex items-center justify-between rounded-lg border p-4">
          <span className="text-sm">
            Version {update.versionNumber} is available. Your configuration
            carries over as it is.
          </span>
          <Button
            disabled={!permissions.upgrade.allowed}
            onClick={async () => {
              const moved = await upgrade.execute();
              if (moved.status === "success") await deploy.execute();
            }}
          >
            Update to version {update.versionNumber}
          </Button>
        </div>
      ) : null}

      <section className="flex flex-col gap-3 rounded-lg border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">Configuration</h3>
            <Badge variant={status.variant}>{status.label}</Badge>
            <span className="text-xs text-muted-foreground">
              Version {integrationVersionNumber} · configuration{" "}
              {configuration.configurationVersion}
            </span>
          </div>
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
              onClick={() => {
                if (window.confirm("Remove this instance?")) remove.execute();
              }}
            >
              Remove
            </Button>
          </div>
        </div>
        {saved ? (
          <dl className="grid grid-cols-[10rem_1fr] gap-y-1 text-sm">
            <dt className="text-muted-foreground">Record type</dt>
            <dd>
              <code>{saved.recordType}</code>
            </dd>
            {acmeFields.map((field) => (
              <div key={field.key} className="contents">
                <dt className="text-muted-foreground">{field.title}</dt>
                <dd>
                  {saved.fieldMapping[field.key] ? (
                    <code>{saved.fieldMapping[field.key]}</code>
                  ) : (
                    <span className="text-muted-foreground">Not synced</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing saved yet.</p>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border p-6">
        <h3 className="text-lg font-semibold">Run the flow</h3>
        <p className="text-sm text-muted-foreground">
          Each flow has a webhook URL. Call it, then open the instance's logs in
          Prismatic to see the contacts the flow would send to Acme.
        </p>
        {flows.map((flow) => (
          <div key={flow.id} className="flex flex-col gap-1">
            <span className="text-sm font-medium">{flow.name}</span>
            <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
              curl -X POST '{flow.webhookUrl}'
            </pre>
          </div>
        ))}
      </section>
    </div>
  );
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Page
      title="Headless Configuration"
      description="This page demonstrates how to configure an integration with your own UI instead of Prismatic's configuration wizard. It uses @prismatic-io/solis-react to list integrations, run the integration's server functions, and save and deploy the configuration."
      actions={<HelperText id="headless-configuration" />}
      fullHeight
    >
      <div className="relative h-full">{children}</div>
    </Page>
  );
}
