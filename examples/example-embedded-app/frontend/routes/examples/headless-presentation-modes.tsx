import {
  type MarketplaceIntegration,
  type MarketplaceIntegrationActions,
  useConfiguration,
  useInstance,
  useMarketplace,
} from "@prismatic-io/solis-react";
import { createFileRoute } from "@tanstack/react-router";
import { CircleCheck, FileText, ListOrdered, Loader2 } from "lucide-react";
import { useState } from "react";
import { EmbedLoading } from "#/components/embed-loading";
import { ConfigurationEditor } from "#/components/headless/configuration-editor";
import type {
  FakeCrmConfiguration,
  FormLayout,
} from "#/components/headless/fake-crm-configuration-form";
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
import { cn } from "#/lib/utils";

export const Route = createFileRoute("/examples/headless-presentation-modes")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Page
      title="Presentation Modes"
      description="One headless integration, two ways to present its configuration: every question on a single page, or one question per step in a wizard. Both save the same values with the same Solis calls; only this app's layout changes."
      actions={<HelperText id="headless-presentation-modes" />}
      fullHeight
    >
      <div className="relative h-full overflow-y-auto p-1">
        <HeadlessSession>
          <PresentationModes />
        </HeadlessSession>
      </div>
    </Page>
  );
}

/** The integration this example configures. Its source is in `integrations/fake-crm/`. */
const FAKE_CRM = "Fake CRM";

const LAYOUTS: { value: FormLayout; label: string; icon: typeof FileText }[] = [
  { value: "single-page", label: "Single page", icon: FileText },
  { value: "wizard", label: "Multi-step wizard", icon: ListOrdered },
];

function PresentationModes() {
  const [layout, setLayout] = useState<FormLayout>("single-page");
  const marketplace = useMarketplace({ includeActiveIntegrations: true });

  if (marketplace.status === "loading") {
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
  const fakeCrm = marketplace.data.items.find(
    (item) => item.status === "success" && item.data.name === FAKE_CRM,
  );

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Presentation mode</legend>
        <div className="inline-flex w-fit rounded-lg border p-1">
          {LAYOUTS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={layout === value}
              onClick={() => setLayout(value)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                layout === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Switch modes at any time, even halfway through setup. The values you
          entered stay put.
        </p>
      </fieldset>

      {fakeCrm?.status === "success" ? (
        <FakeCrmSetup
          integration={fakeCrm.data}
          createInstance={fakeCrm.actions.createInstance}
          layout={layout}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          This example needs the Fake CRM integration in your marketplace. Its
          source and setup steps are in <code>integrations/fake-crm/</code>.
        </p>
      )}
    </div>
  );
}

function FakeCrmSetup({
  integration,
  createInstance,
  layout,
}: {
  integration: MarketplaceIntegration;
  createInstance: MarketplaceIntegrationActions["createInstance"];
  layout: FormLayout;
}) {
  // Until the listing reloads, it may not list the instance created here.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const instanceId = currentInstance(integration.instances)?.id ?? createdId;
  const instance = useInstance(instanceId);
  const configuration = useConfiguration({ instanceId });
  const [configuring, setConfiguring] = useState(false);
  const [error, setError] = useState("");

  const lifecycle =
    instance.status === "success" ? instance.data.lifecycle : null;
  const deployed = lifecycle !== null && lifecycle !== "notDeployed";

  const start = async () => {
    setError("");
    if (!instanceId) {
      const created = await createInstance.execute({ name: integration.name });
      if (created.status === "error") return setError(created.error.message);
      setCreatedId(created.data.id);
    }
    setConfiguring(true);
  };

  const remove = async () => {
    if (!window.confirm("Remove this instance of Fake CRM?")) return;
    const removed = await instance.actions.remove.execute();
    if (removed.status === "error") return setError(removed.error.message);
    setCreatedId(null);
    setConfiguring(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="flex items-center gap-4 rounded-xl border p-5">
        <IntegrationAvatar
          name={integration.name}
          avatarUrl={integration.avatarUrl}
          className="mb-0 size-12"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{integration.name}</h3>
            {lifecycle ? (
              <Badge variant={LIFECYCLE_LABELS[lifecycle].variant}>
                {LIFECYCLE_LABELS[lifecycle].label}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {integration.description}
          </p>
        </div>
        {!configuring ? (
          <div className="flex gap-2">
            {instanceId ? (
              <Button variant="outline" onClick={remove}>
                Remove
              </Button>
            ) : null}
            <Button
              disabled={
                createInstance.status === "loading" ||
                (!instanceId && !integration.permissions.createInstance.allowed)
              }
              onClick={start}
            >
              {createInstance.status === "loading" ? (
                <Loader2 className="animate-spin" />
              ) : null}
              {deployed ? "Reconfigure Fake CRM" : "Deploy Fake CRM"}
            </Button>
          </div>
        ) : null}
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {configuring ? (
        <section className="flex flex-col gap-4 rounded-xl border p-6">
          <h3 className="text-lg font-semibold">
            {deployed ? "Reconfigure" : "Set up"} Fake CRM
          </h3>
          {configuration.status === "success" ? (
            <ConfigurationEditor
              key={configuration.data.versionNumber}
              configuration={configuration}
              layout={layout}
              submitLabel={deployed ? "Save and deploy" : "Deploy Fake CRM"}
              onDeployed={() => setConfiguring(false)}
              onCancel={() => setConfiguring(false)}
            />
          ) : configuration.status === "error" ? (
            <p className="text-sm text-destructive">
              {configuration.error.message}
            </p>
          ) : (
            <Loader2 className="animate-spin text-muted-foreground" />
          )}
        </section>
      ) : deployed && instance.status === "success" ? (
        <DeployedSummary value={instance.data.configuration.value} />
      ) : null}
    </div>
  );
}

function DeployedSummary({ value }: { value: unknown }) {
  const saved = value as Partial<FakeCrmConfiguration> | null;
  if (!saved?.recordType) return null;
  const mapped = Object.entries(saved.fieldMapping ?? {}).filter(
    ([, field]) => field,
  );
  return (
    <section className="flex items-start gap-3 rounded-xl border p-5 text-sm">
      <CircleCheck className="mt-0.5 size-4 text-primary" />
      <div>
        <p className="font-medium">Fake CRM is deployed.</p>
        <p className="text-muted-foreground">
          It syncs <code>{saved.recordType}</code> records to Acme, mapping{" "}
          {mapped.length} fields:{" "}
          {mapped.map(([acme, crm]) => `${acme} ← ${crm}`).join(", ")}.
        </p>
      </div>
    </section>
  );
}
