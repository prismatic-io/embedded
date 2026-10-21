import {
  type ConfigurationConnectionSelection,
  type MarketplaceIntegration,
  type MarketplaceIntegrationActions,
  useConfiguration,
  useInstance,
  useMarketplace,
  usePrismatic,
} from "@prismatic-io/solis-react";
import { createFileRoute } from "@tanstack/react-router";
import { CircleCheck, CircleDashed, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EmbedLoading } from "#/components/embed-loading";
import {
  ConfigurationEditor,
  type InitProposal,
  readProposal,
  unpopulatedFields,
} from "#/components/headless/configuration-editor";
import { findConfigurationForm } from "#/components/headless/configuration-forms";
import {
  type ConsentWindow,
  openConsentWindow,
  preopenedConsentHost,
} from "#/components/headless/consent-window";
import { HeadlessSession } from "#/components/headless/headless-session";
import {
  currentInstance,
  IntegrationAvatar,
  LIFECYCLE_LABELS,
} from "#/components/headless/integration-avatar";
import { HelperText } from "#/components/helper-text";
import { Page } from "#/components/page";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { cn } from "#/lib/utils";

export const Route = createFileRoute("/examples/headless-one-click-list")({
  component: RouteComponent,
});

/**
 * The session gets `preopenedConsentHost`, so a click can open the OAuth
 * consent window before the instance it authorizes exists. See
 * `frontend/components/headless/consent-window.ts`.
 */
function RouteComponent() {
  return (
    <Page
      title="One-Click Connect"
      description="Headless integrations in a list, each with a Connect button. Connect authorizes the customer's account with OAuth, then configures and deploys the integration. When an integration needs more than a connection, its remaining settings open in a dialog."
      actions={<HelperText id="headless-one-click-list" />}
      fullHeight
    >
      <div className="relative h-full overflow-y-auto p-1">
        <HeadlessSession host={preopenedConsentHost}>
          <IntegrationList />
        </HeadlessSession>
      </div>
    </Page>
  );
}

/** Every headless integration in the marketplace, one per row. */
function IntegrationList() {
  const marketplace = useMarketplace({ includeActiveIntegrations: true });
  // One connection at a time: there's one consent window to hand out.
  const [connecting, setConnecting] = useState<string | null>(null);

  if (marketplace.status === "loading") {
    return <EmbedLoading label="Loading integrations" />;
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

  // Integrations that use Prismatic's configuration wizard can't be set up in
  // one click, so this list leaves them out.
  const headless = marketplace.data.items.flatMap((item) =>
    item.status === "success" &&
    item.data.configurationExperience === "headless"
      ? [{ integration: item.data, actions: item.actions }]
      : [],
  );
  if (headless.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This customer has no headless integrations in the marketplace. Import
        the HubSpot and Slack integrations from <code>integrations/</code> to
        try this example.
      </p>
    );
  }

  // One section per marketplace category, in alphabetical order, with
  // uncategorized integrations last.
  const categories = new Map<string, typeof headless>();
  for (const entry of headless) {
    const category = entry.integration.category ?? OTHER;
    categories.set(category, [...(categories.get(category) ?? []), entry]);
  }
  const sections = [...categories]
    .sort(([a], [b]) =>
      a === OTHER ? 1 : b === OTHER ? -1 : a.localeCompare(b),
    )
    .map(([category, entries]) => ({
      category,
      entries: entries.sort((a, b) =>
        a.integration.name.localeCompare(b.integration.name),
      ),
    }));

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      {sections.map(({ category, entries }) => (
        <section key={category} className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            {category}
          </h3>
          <div className="divide-y overflow-hidden rounded-xl border">
            {entries.map(({ integration, actions }) => (
              <IntegrationRow
                key={integration.id}
                integration={integration}
                createInstance={actions.createInstance}
                locked={connecting !== null && connecting !== integration.id}
                setConnecting={setConnecting}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** The section for integrations with no marketplace category. */
const OTHER = "Other";

type Stage =
  | "idle"
  | "creating"
  | "authorizing"
  | "initializing"
  | "saving"
  | "deploying";

const STAGE_LABELS: Record<Exclude<Stage, "idle">, string> = {
  creating: "Getting ready…",
  authorizing: "Waiting for you to authorize…",
  initializing: "Loading settings…",
  saving: "Saving settings…",
  deploying: "Deploying…",
};

/** A click that's waiting for the instance's connection requirements to load. */
interface Attempt {
  consent: ConsentWindow;
  controller: AbortController;
}

const POPUP_BLOCKED =
  "Your browser blocked the sign-in window. Allow pop-ups for this site, then try again.";

/**
 * One integration, and the Connect button that sets it up:
 *
 * 1. Create an instance, if the customer has none.
 * 2. Make a credential for the integration's connection with
 *    `createConnection`, which runs the OAuth flow.
 * 3. Run `init` for the integration's suggested configuration.
 * 4. If the suggested configuration fills every required field in the
 *    integration's schema, save it, linking the new credential, and deploy.
 *    Otherwise, show the rest of the settings in a dialog first.
 */
function IntegrationRow({
  integration,
  createInstance,
  locked,
  setConnecting,
}: {
  integration: MarketplaceIntegration;
  createInstance: MarketplaceIntegrationActions["createInstance"];
  locked: boolean;
  setConnecting: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const { id, name, description, avatarUrl, permissions } = integration;
  const session = usePrismatic();
  const [createdId, setCreatedId] = useState<string | null>(null);
  // Until the listing reloads, it may not list an instance this row created.
  const instanceId = currentInstance(integration.instances)?.id ?? createdId;
  // Both hooks wait while `instanceId` is null.
  const instance = useInstance(instanceId);
  const configuration = useConfiguration({ instanceId });

  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  /** Credentials chosen in a setup the customer hasn't finished. */
  const [selections, setSelections] = useState<
    ConfigurationConnectionSelection[] | null
  >(null);
  const [dialog, setDialog] = useState<
    { kind: "finish"; proposal?: InitProposal } | { kind: "settings" } | null
  >(null);

  // The steps run across several renders, so they read the latest resources.
  const latest = useRef({ instance, configuration });
  latest.current = { instance, configuration };
  const cancel = useRef<AbortController | null>(null);

  const busy = stage !== "idle";
  useEffect(() => {
    setConnecting((current) => (busy ? id : current === id ? null : current));
  }, [busy, id, setConnecting]);

  const requirements =
    configuration.status === "success" &&
    configuration.data.connections.status === "success"
      ? configuration.data.connections.data
      : null;

  const fail = (message: string) => {
    setStage("idle");
    setError(message);
  };

  /** Steps 3 and 4. */
  const configureAndDeploy = async (
    chosen: ConfigurationConnectionSelection[],
  ) => {
    setSelections(chosen);
    setStage("initializing");
    const current = latest.current.configuration;
    if (current.status !== "success") return fail("Configuration not loaded.");
    const initKeys = requirements?.init.map(({ key }) => key) ?? [];
    const initialized = await current.actions.init.execute({
      connections: chosen.filter(({ key }) => initKeys.includes(key)),
    });
    if (initialized.status === "error") {
      return fail(initialized.error.message);
    }
    const proposal = readProposal(initialized.data);
    // Required fields `init` couldn't fill mean the integration needs more
    // than a connection, such as Slack's channel. Ask for them first.
    if (unpopulatedFields(current.data.schema, proposal.configuration).length) {
      setStage("idle");
      setDialog({ kind: "finish", proposal });
      return;
    }

    setStage("saving");
    const canLink =
      session.status === "success" &&
      session.data.hasFeature("configuration.connections");
    const saved = await latest.current.configuration.actions.save.execute({
      value: proposal.configuration,
      ...(canLink && chosen.length ? { connections: chosen } : {}),
    });
    if (saved.status === "error") return fail(saved.error.message);

    setStage("deploying");
    const deployed = await latest.current.instance.actions.deploy.execute();
    if (deployed.status === "error") return fail(deployed.error.message);
    setStage("idle");
    setSelections(null);
  };

  /** Step 2, once the instance's connection requirements have loaded. */
  const authorize = async ({ consent, controller }: Attempt) => {
    if (!requirements) return;
    if (!requirements.instance) {
      consent.close();
      return fail(
        "This Prismatic stack can't link connections to an instance from Solis yet.",
      );
    }
    if (requirements.instance.length === 0) {
      // Nothing to authorize.
      consent.close();
      return configureAndDeploy([]);
    }
    if (requirements.instance.length > 1) {
      consent.close();
      return fail(
        "This integration needs more than one connection, so it can't be set up in one click.",
      );
    }
    const [requirement] = requirements.instance;
    setStage("authorizing");
    consent.use();
    const created = await requirement.actions.createConnection.execute({
      signal: controller.signal,
    });
    consent.close();
    cancel.current = null;
    if (created.status === "error") {
      if (created.error.code === "PRISMATIC_CONNECT_ABORTED") {
        setStage("idle");
        return;
      }
      return fail(created.error.message);
    }
    await configureAndDeploy([{ key: requirement.key, id: created.data.id }]);
  };

  // A click on Connect opens the consent window, then waits here for the
  // requirements of the instance it may have just created.
  const running = useRef(false);
  const loadError =
    configuration.status === "error"
      ? configuration.error.message
      : configuration.status === "success" &&
          configuration.data.connections.status === "error"
        ? configuration.data.connections.error.message
        : null;
  useEffect(() => {
    if (!attempt || running.current) return;
    if (loadError) {
      setAttempt(null);
      attempt.consent.close();
      fail(loadError);
      return;
    }
    if (!requirements) return;
    running.current = true;
    setAttempt(null);
    authorize(attempt).finally(() => {
      running.current = false;
    });
  });

  /** Step 1, and everything after it. Runs inside the click. */
  const connect = async () => {
    setError("");
    if (selections) {
      // The customer authorized already, then left the settings dialog.
      setDialog({ kind: "finish" });
      return;
    }
    // Open the consent window now, synchronously, while the browser still
    // counts this as the click. It waits blank until the consent URL arrives.
    const consent = openConsentWindow();
    if (!consent) return fail(POPUP_BLOCKED);
    const controller = new AbortController();
    cancel.current = controller;
    if (!instanceId) {
      setStage("creating");
      const created = await createInstance.execute({ name });
      if (created.status === "error") {
        consent.close();
        return fail(created.error.message);
      }
      if (controller.signal.aborted) {
        consent.close();
        setStage("idle");
        return;
      }
      setCreatedId(created.data.id);
    }
    setAttempt({ consent, controller });
  };

  const disconnect = async () => {
    if (!window.confirm(`Disconnect ${name}? This removes the integration.`)) {
      return;
    }
    setError("");
    const removed = await instance.actions.remove.execute();
    if (removed.status === "error") return setError(removed.error.message);
    setCreatedId(null);
    setSelections(null);
  };

  const lifecycle =
    instance.status === "success" ? instance.data.lifecycle : null;
  const connected = lifecycle !== null && lifecycle !== "notDeployed";
  const hasSettings =
    configuration.status === "success" &&
    findConfigurationForm(configuration.data) !== null;

  const status = busy
    ? STAGE_LABELS[stage as Exclude<Stage, "idle">]
    : lifecycle === "active"
      ? "Connected"
      : connected
        ? LIFECYCLE_LABELS[lifecycle].label
        : selections
          ? "Authorized · finish setup to connect"
          : "Not connected";

  return (
    <article className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-start gap-x-4 gap-y-3 bg-background px-6 py-5">
      <IntegrationAvatar name={name} avatarUrl={avatarUrl} className="mb-0" />
      <div className="min-w-0">
        <h3 className="font-semibold">{name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {description || "No description provided."}
        </p>
        <p
          aria-live="polite"
          className={cn(
            "mt-3 flex items-center gap-1.5 text-xs",
            lifecycle === "active" ? "text-primary" : "text-muted-foreground",
          )}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : connected ? (
            <CircleCheck className="size-3.5" />
          ) : (
            <CircleDashed className="size-3.5" />
          )}
          {status}
        </p>
        {error ? (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2 self-center">
        {busy ? (
          <Button
            variant="outline"
            disabled={stage !== "creating" && stage !== "authorizing"}
            onClick={() => cancel.current?.abort()}
          >
            Cancel
          </Button>
        ) : connected ? (
          <>
            {hasSettings ? (
              <Button
                variant="outline"
                onClick={() => setDialog({ kind: "settings" })}
              >
                Settings
              </Button>
            ) : null}
            {lifecycle === "paused" ? (
              <Button
                variant="outline"
                onClick={() => instance.actions.resume.execute()}
              >
                Resume
              </Button>
            ) : null}
            <Button variant="outline" onClick={disconnect}>
              Disconnect
            </Button>
          </>
        ) : (
          <Button
            className="min-w-28"
            disabled={
              locked ||
              (!instanceId && !permissions.createInstance.allowed) ||
              // An existing instance's requirements must be loaded, so the
              // click can go straight to the consent window.
              (!!instanceId && !requirements && !selections)
            }
            onClick={connect}
          >
            {selections ? "Finish setup" : "Connect"}
          </Button>
        )}
      </div>

      <Dialog open={dialog !== null} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {dialog?.kind === "settings"
                ? `${name} settings`
                : `Finish connecting ${name}`}
            </DialogTitle>
            <DialogDescription>
              {dialog?.kind === "settings"
                ? "Change how this integration works. Saving deploys your changes."
                : `${name} is authorized. Choose the rest of its settings to connect it.`}
            </DialogDescription>
          </DialogHeader>
          {dialog && configuration.status === "success" ? (
            <ConfigurationEditor
              configuration={configuration}
              {...(dialog.kind === "finish"
                ? {
                    proposal: dialog.proposal,
                    connections: selections ?? undefined,
                  }
                : {})}
              submitLabel={dialog.kind === "finish" ? "Connect" : "Save"}
              onDeployed={() => {
                setDialog(null);
                setSelections(null);
              }}
              onCancel={() => setDialog(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </article>
  );
}
