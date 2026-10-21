import {
  type ConfigurationConnectionSelection,
  type ConfigurationResource,
  type JsonSchema,
  useInstance,
  usePrismatic,
} from "@prismatic-io/solis-react";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { findConfigurationForm } from "#/components/headless/configuration-forms";
import type { FormLayout } from "#/components/headless/fake-crm-configuration-form";
import { Button } from "#/components/ui/button";

/**
 * What `init` returns. Spectral requires `configuration`; this app's
 * integrations add `unresolvedReasons`, things the customer must decide before
 * the configuration is complete.
 */
export interface InitProposal {
  configuration: unknown;
  unresolvedReasons?: string[];
}

export function readProposal(output: unknown): InitProposal {
  if (output && typeof output === "object" && "configuration" in output) {
    return output as InitProposal;
  }
  throw new Error("The integration's init returned no configuration.");
}

/**
 * The required fields a configuration value leaves empty, as dotted paths,
 * read from the configuration's JSON Schema. An empty result means the value
 * is complete enough to save without asking the customer anything.
 *
 * A field counts as empty when it's missing, `null`, an empty string, or an
 * empty array that must have items. Nested objects are checked field by field.
 */
export function unpopulatedFields(
  schema: JsonSchema,
  value: unknown,
  path = "",
): string[] {
  if (typeof schema !== "object") return [];
  const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
  const required = (schema.required ?? []) as string[];
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return Object.entries(properties).flatMap(([key, property]) => {
    const field = path ? `${path}.${key}` : key;
    const entry = record[key];
    if (isEmpty(entry, property)) {
      return required.includes(key) ? [field] : [];
    }
    return typeof property === "object" && property.type === "object"
      ? unpopulatedFields(property, entry, field)
      : [];
  });
}

function isEmpty(value: unknown, schema: JsonSchema): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value) && value.length === 0) {
    return typeof schema === "object" && Number(schema.minItems ?? 0) > 0;
  }
  return false;
}

type FieldError = { path: string | null; message: string };

/**
 * The connections an instance is linked to, by requirement key. Server
 * functions and `init` run with these unless the app passes others.
 */
export function linkedConnections(
  configuration: ConfigurationResource,
): ConfigurationConnectionSelection[] {
  if (configuration.status !== "success") return [];
  const { connections } = configuration.data;
  if (connections.status !== "success") return [];
  return (connections.data.instance ?? []).flatMap(({ key, selected }) =>
    selected ? [{ key, id: selected }] : [],
  );
}

/**
 * Runs `init` for suggested values, shows them in this app's form for the
 * integration, then saves and deploys.
 *
 * `connections` are the customer's choice of credential for each connection
 * the integration declares, such as a Slack connection they just authorized.
 * Saving links the instance to them, which it needs before it can deploy.
 * Leave them out to keep the connections the instance is linked to.
 */
export function ConfigurationEditor({
  configuration,
  connections,
  proposal: suggested,
  submitLabel,
  layout = "wizard",
  onDeployed,
  onCancel,
}: {
  configuration: ConfigurationResource;
  connections?: readonly ConfigurationConnectionSelection[];
  /** A proposal from an `init` the app already ran. Without one, this runs `init`. */
  proposal?: InitProposal;
  submitLabel: string;
  layout?: FormLayout;
  onDeployed: () => void;
  onCancel?: () => void;
}) {
  const session = usePrismatic();
  const instance = useInstance(
    configuration.status === "success" ? configuration.data.instanceId : null,
  );
  const [proposal, setProposal] = useState<InitProposal | null>(
    suggested ?? null,
  );
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState(false);
  const started = useRef(suggested !== undefined);

  const selections = connections ?? linkedConnections(configuration);
  const connectionsLoading =
    configuration.status === "success" &&
    configuration.data.connections.status === "loading";

  // `init` proposes values and saves nothing, so it's safe to run on open. It
  // waits for the connection requirements, to pass the ones `init` declares.
  useEffect(() => {
    if (configuration.status !== "success" || connectionsLoading) return;
    if (started.current) return;
    started.current = true;
    const { connections: requirements } = configuration.data;
    const initKeys =
      requirements.status === "success"
        ? requirements.data.init.map(({ key }) => key)
        : [];
    configuration.actions.init
      .execute({
        connections: selections.filter(({ key }) => initKeys.includes(key)),
      })
      .then((result) => {
        if (result.status === "error") {
          setError(result.error.message);
          return;
        }
        try {
          setProposal(readProposal(result.data));
        } catch (thrown) {
          setError((thrown as Error).message);
        }
      });
  }, [configuration, connectionsLoading, selections]);

  if (configuration.status !== "success") return null;
  const Form = findConfigurationForm(configuration.data);

  if (!proposal) {
    return error ? (
      <p className="text-sm text-destructive">{error}</p>
    ) : (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Preparing your
        configuration…
      </p>
    );
  }

  // Linking connections on save needs a Prismatic stack that supports it.
  const canLink =
    session.status === "success" &&
    session.data.hasFeature("configuration.connections");

  const submit = async (value: unknown) => {
    setBusy(true);
    setError("");
    setFieldErrors([]);
    // Prismatic validates the value against the integration's schema. Invalid
    // fields come back on the error, by path.
    const saved = await configuration.actions.save.execute({
      value,
      ...(connections?.length && canLink ? { connections } : {}),
    });
    if (saved.status === "error") {
      setError(saved.error.message);
      setFieldErrors([...(saved.error.fields ?? [])]);
      setBusy(false);
      return;
    }
    // Saving stores values. Deploying is what makes the instance run them.
    const deployed = await instance.actions.deploy.execute();
    setBusy(false);
    if (deployed.status === "error") {
      setError(deployed.error.message);
      return;
    }
    onDeployed();
  };

  const { schema, integrationName } = configuration.data;
  const hasFields =
    typeof schema === "object" &&
    Object.keys((schema.properties ?? {}) as object).length > 0;

  // A configuration with no fields, such as HubSpot's, only needs saving:
  // saving links the connections, and the instance deploys with them.
  if (!hasFields) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {integrationName} needs no settings.
        </p>
        <div className="flex gap-2">
          {onCancel ? (
            <Button variant="outline" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
          ) : null}
          <Button
            disabled={busy}
            onClick={() => submit(proposal.configuration)}
          >
            {busy ? <Loader2 className="animate-spin" /> : null}
            {submitLabel}
          </Button>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    );
  }

  if (!Form) {
    return (
      <div className="text-sm text-muted-foreground">
        This app has no form for {integrationName} yet. Its configuration schema
        is:
        <pre className="mt-2 max-h-80 overflow-auto rounded bg-muted p-3 text-xs">
          {JSON.stringify(schema, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {proposal.unresolvedReasons?.length ? (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          <ul className="ml-5 list-disc">
            {proposal.unresolvedReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <Form
        configuration={configuration}
        initialValues={proposal.configuration}
        busy={busy}
        submitLabel={submitLabel}
        fieldErrors={fieldErrors}
        connections={selections}
        layout={layout}
        onSubmit={submit}
        onCancel={onCancel}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
