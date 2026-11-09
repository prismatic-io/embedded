import {
  Component,
  computed,
  input,
  linkedSignal,
  type OnInit,
  output,
  signal,
} from "@angular/core";
import type { ConfigurationConnectionSelection, ConfigurationStub } from "@prismatic-io/solis-core";
import { callServerFunction } from "../solis";

/**
 * The values the Slack integration saves. This mirrors the zod schema in
 * `examples/example-embedded-app/integrations/slack/src/configuration.ts`.
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
@Component({
  selector: "app-slack-form",
  template: `
    <form (submit)="$event.preventDefault(); save.emit(values())">
      <label class="field">
        <span>Channel</span>
        <select (change)="chooseChannel($any($event.target).value)" [disabled]="!channels()">
          <option value="">{{ channels() ? "Choose a channel" : "Reading your channels…" }}</option>
          @for (channel of channels(); track channel.id) {
            <option [value]="channel.id" [selected]="channel.id === values().channelId">
              {{ channel.isPrivate ? "🔒" : "#" }} {{ channel.name }}
            </option>
          }
        </select>
        @if (fieldError(); as message) {
          <small class="error">{{ message }}</small>
        }
      </label>
      <p class="muted">
        {{
          selected()?.isPrivate
            ? "Invite the Acme app to this private channel so it can post there."
            : "Acme can post to any public channel without joining it."
        }}
      </p>
      @if (error(); as error) {
        <p class="error">{{ error }}</p>
      }
      <div class="actions">
        <button type="submit" [disabled]="busy() || !values().channelId">Save and deploy</button>
      </div>
    </form>
  `,
})
export class SlackForm implements OnInit {
  readonly config = input.required<ConfigurationStub>();
  /** The values the integration's `init` suggested. */
  readonly initialValues = input.required<SlackConfiguration>();
  /** The Slack connection to list channels with, before the instance is linked to it. */
  readonly connections = input.required<readonly ConfigurationConnectionSelection[]>();
  readonly busy = input(false);
  readonly fieldErrors = input<readonly { path: string | null; message: string }[]>([]);
  readonly save = output<SlackConfiguration>();

  protected readonly values = linkedSignal(() => this.initialValues());
  protected readonly channels = signal<Channel[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly selected = computed(() =>
    this.channels()?.find(({ id }) => id === this.values().channelId),
  );
  protected readonly fieldError = computed(
    () => this.fieldErrors().find(({ path }) => path?.endsWith("channelId"))?.message,
  );

  async ngOnInit() {
    try {
      this.channels.set(
        await callServerFunction<Channel[]>(this.config(), "listChannels", {}, this.connections()),
      );
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    }
  }

  protected chooseChannel(channelId: string) {
    // The name is saved for display only.
    const channel = this.channels()?.find(({ id }) => id === channelId);
    this.values.set({ channelId, channelName: channel?.name });
  }
}
