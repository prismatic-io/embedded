import type {
  ConfigurationConnectionRequirement,
  ConfigurationConnectionSelection,
  ConfigurationResource,
} from "@prismatic-io/solis-react";
import { Check, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";

/**
 * Asks which of the customer's credentials each connection of an integration
 * runs with, such as which Slack workspace. Customer-activated connections are
 * reusable: a customer who connected Slack for one integration can choose that
 * credential here instead of authorizing Slack again.
 */
export function ConnectionPicker({
  configuration,
  onContinue,
}: {
  configuration: ConfigurationResource;
  onContinue: (selections: ConfigurationConnectionSelection[]) => void;
}) {
  if (configuration.status !== "success") return null;
  const { connections } = configuration.data;
  // Connection requirements load in the background, after the configuration.
  if (connections.status === "loading") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Reading your connections…
      </p>
    );
  }
  if (connections.status === "error") {
    return (
      <div className="flex items-center gap-3 text-sm">
        <p className="text-destructive">{connections.error.message}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => connections.actions.refresh.execute()}
        >
          Retry
        </Button>
      </div>
    );
  }
  return (
    <Choices
      requirements={connections.data.instance ?? []}
      onContinue={onContinue}
    />
  );
}

function Choices({
  requirements,
  onContinue,
}: {
  requirements: readonly ConfigurationConnectionRequirement[];
  onContinue: (selections: ConfigurationConnectionSelection[]) => void;
}) {
  // Start from the credential each connection is linked to, if any.
  const [chosen, setChosen] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      requirements.flatMap(({ key, selected }) =>
        selected ? [[key, selected]] : [],
      ),
    ),
  );
  const complete = requirements.every(({ key }) => chosen[key]);

  return (
    <div className="flex flex-col gap-6">
      {requirements.map((requirement) => (
        <RequirementChoice
          key={requirement.key}
          requirement={requirement}
          chosen={chosen[requirement.key]}
          onChoose={(id) =>
            setChosen((current) => ({ ...current, [requirement.key]: id }))
          }
        />
      ))}
      <Button
        className="self-start"
        disabled={!complete}
        onClick={() =>
          onContinue(requirements.map(({ key }) => ({ key, id: chosen[key] })))
        }
      >
        Continue
      </Button>
    </div>
  );
}

function RequirementChoice({
  requirement,
  chosen,
  onChoose,
}: {
  requirement: ConfigurationConnectionRequirement;
  chosen: string | undefined;
  onChoose: (id: string) => void;
}) {
  const [error, setError] = useState("");
  const { createConnection } = requirement.actions;
  const permission = requirement.permissions.createConnection;

  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-medium">{requirement.label}</h3>
      <div className="flex flex-col gap-2">
        {requirement.options.map((option) => {
          if (option.status !== "success") return null;
          const active = option.data.status === "ACTIVE";
          return (
            <button
              key={option.id}
              type="button"
              disabled={!active}
              onClick={() => onChoose(option.id)}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50",
                chosen === option.id && "border-primary ring-2 ring-primary/30",
              )}
            >
              <span className="flex items-center gap-2">
                {chosen === option.id ? (
                  <Check className="size-4 text-primary" />
                ) : (
                  <span className="size-4" />
                )}
                {option.data.label}
              </span>
              <Badge variant={active ? "secondary" : "outline"}>
                {active ? "Connected" : option.data.status.toLowerCase()}
              </Badge>
            </button>
          );
        })}
      </div>
      <Button
        variant="outline"
        className="self-start"
        disabled={!permission.allowed || createConnection.status === "loading"}
        // Call createConnection straight from the click: for OAuth it opens the
        // provider's consent screen, and browsers only allow that from a click.
        onClick={async () => {
          setError("");
          const created = await createConnection.execute({});
          if (created.status === "success") onChoose(created.data.id);
          else setError(created.error.message);
        }}
      >
        {createConnection.status === "loading" ? (
          <Loader2 className="animate-spin" data-icon="inline-start" />
        ) : (
          <Plus data-icon="inline-start" />
        )}
        {createConnection.status === "loading"
          ? "Waiting for you to authorize…"
          : `Connect a new ${requirement.label} account`}
      </Button>
      {!permission.allowed ? (
        <p className="text-xs text-muted-foreground">
          You can't connect a new account ({permission.reason}).
        </p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </section>
  );
}
