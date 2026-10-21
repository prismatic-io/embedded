import type {
  ConfigurationConnectionSelection,
  ConfigurationResource,
} from "@prismatic-io/solis-react";
import { Hash, Loader2, Lock } from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Label } from "#/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { useServerFunctionQuery } from "#/hooks/use-server-function-query";

/**
 * The values the Slack integration saves. This mirrors the zod schema in
 * `integrations/slack/src/configuration.ts`.
 */
export interface SlackConfiguration {
  channelId: string;
  channelName?: string;
}

/** What the Slack integration's `listChannels` server function returns. */
interface Channel {
  id: string;
  name: string;
  isPrivate: boolean;
}

/**
 * Asks which Slack channel Acme posts to. The integration's `listChannels`
 * server function reads the channels with the customer's Slack connection.
 */
export function SlackConfigurationForm({
  configuration,
  initialValues,
  busy,
  submitLabel,
  fieldErrors,
  connections,
  onSubmit,
  onCancel,
}: {
  configuration: ConfigurationResource;
  initialValues: SlackConfiguration;
  busy: boolean;
  submitLabel: string;
  fieldErrors: { path: string | null; message: string }[];
  /** The Slack connection to list channels with, before the instance is linked to it. */
  connections: readonly ConfigurationConnectionSelection[];
  onSubmit: (values: SlackConfiguration) => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<SlackConfiguration>(initialValues);
  const channels = useServerFunctionQuery<Record<string, never>, Channel[]>(
    configuration,
    "listChannels",
    {},
    connections,
  );
  const error = fieldErrors.find(({ path }) => path?.endsWith("channelId"));
  const selected = channels.data?.find(({ id }) => id === values.channelId);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="slack-channel">Channel</Label>
        <Select
          value={values.channelId || undefined}
          onValueChange={(channelId) => {
            const channel = channels.data?.find(({ id }) => id === channelId);
            setValues({ channelId, channelName: channel?.name });
          }}
          disabled={channels.status !== "success"}
        >
          <SelectTrigger id="slack-channel" className="w-full">
            <SelectValue
              placeholder={
                channels.status === "loading"
                  ? "Reading your channels…"
                  : "Choose a channel"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {channels.data?.map((channel) => (
              <SelectItem key={channel.id} value={channel.id}>
                {channel.isPrivate ? <Lock /> : <Hash />}
                {channel.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {channels.status === "error" ? (
          <p className="text-xs text-destructive">{channels.error}</p>
        ) : null}
        {error ? (
          <p className="text-xs text-destructive">{error.message}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {selected?.isPrivate
            ? "Invite the Acme app to this private channel so it can post there."
            : "Acme can post to any public channel without joining it."}
        </p>
      </div>
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={busy || !values.channelId}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
