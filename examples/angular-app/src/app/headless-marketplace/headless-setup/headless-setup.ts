import { Component, computed, input, type OnInit, output, signal } from "@angular/core";
import type {
  Client,
  ConfigurationConnectionSelection,
  ConfigurationStub,
  InstanceStub,
} from "@prismatic-io/solis-core";
import type { ConfigurationState } from "@prismatic-io/solis-core/protocol";
import { ConnectionPicker } from "./connection-picker";
import { FakeCrmForm } from "./fake-crm-form";
import { SlackForm } from "./slack-form";
import { type ConnectionChoices, readConnectionChoices } from "../solis";

/** A headless integration's instance, and the configuration to edit. */
export interface HeadlessTarget {
  client: Client;
  instance: InstanceStub;
  config: ConfigurationStub;
  state: ConfigurationState;
}

/**
 * What `init` returns. Spectral requires `configuration`; the example
 * integrations add `unresolvedReasons`, things the customer must review.
 */
interface InitProposal {
  configuration: unknown;
  unresolvedReasons?: string[];
}

/**
 * Configures a headless integration with this app's own UI:
 *
 * 1. Connect the customer's accounts, if the integration needs any.
 * 2. Run `init` for suggested values, and show them in this app's form.
 * 3. Save, linking the chosen connections, and deploy.
 */
@Component({
  selector: "app-headless-setup",
  imports: [ConnectionPicker, FakeCrmForm, SlackForm],
  template: `
    @if (choices()?.instance?.length) {
      <ol class="steps">
        <li [class.current]="step() === 'connections'">1. Connect your accounts</li>
        <li [class.current]="step() === 'configure'">
          2. Configure {{ target().state.integrationName }}
        </li>
      </ol>
    }

    @switch (step()) {
      @case ("connections") {
        <app-connection-picker
          [client]="target().client"
          [requirements]="choices()!.instance"
          (continue)="configure($event)"
        />
      }
      @case ("configure") {
        @if (proposal(); as proposal) {
          @if (proposal.unresolvedReasons?.length) {
            <ul class="notice">
              @for (reason of proposal.unresolvedReasons; track reason) {
                <li>{{ reason }}</li>
              }
            </ul>
          }
          @switch (form()) {
            @case ("fake-crm") {
              <app-fake-crm-form
                [config]="target().config"
                [state]="target().state"
                [initialValues]="$any(proposal.configuration)"
                [busy]="busy()"
                [fieldErrors]="fieldErrors()"
                (save)="saveAndDeploy($event)"
              />
            }
            @case ("slack") {
              <app-slack-form
                [config]="target().config"
                [initialValues]="$any(proposal.configuration)"
                [connections]="selections()"
                [busy]="busy()"
                [fieldErrors]="fieldErrors()"
                (save)="saveAndDeploy($event)"
              />
            }
            @case ("no-fields") {
              <!-- Such as HubSpot: saving links the connections, and the instance deploys with them. -->
              <p class="muted">{{ target().state.integrationName }} needs no settings.</p>
              <div class="actions">
                <button (click)="saveAndDeploy(proposal.configuration)" [disabled]="busy()">
                  Save and deploy
                </button>
              </div>
            }
            @default {
              <!-- This app has no form for this integration, so edit its values as JSON. -->
              <textarea #json rows="14" [value]="stringify(proposal.configuration)"></textarea>
              <div class="actions">
                <button (click)="saveJson(json.value)" [disabled]="busy()">Save and deploy</button>
              </div>
            }
          }
        } @else if (!error()) {
          <p class="muted">Preparing your configuration…</p>
        }
      }
      @default {
        @if (!error()) {
          <p class="muted">Reading your connections…</p>
        }
      }
    }

    @if (error(); as error) {
      <p class="error">{{ error }}</p>
    }
  `,
})
export class HeadlessSetup implements OnInit {
  readonly target = input.required<HeadlessTarget>();
  readonly deployed = output();

  protected readonly step = signal<"loading" | "connections" | "configure">("loading");
  protected readonly choices = signal<ConnectionChoices | null>(null);
  /** The customer's credential for each connection, by requirement key. */
  protected readonly selections = signal<ConfigurationConnectionSelection[]>([]);
  protected readonly proposal = signal<InitProposal | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly fieldErrors = signal<{ path: string | null; message: string }[]>([]);

  /**
   * This app's form for the integration. Forms match by a server function
   * only that integration defines: unlike its name, that survives a rename.
   */
  protected readonly form = computed(() => {
    const { schema, serverFunctions } = this.target().state;
    const defines = (key: string) => serverFunctions.some((fn) => fn.key === key);
    if (defines("listRecordTypes")) return "fake-crm";
    if (defines("listChannels")) return "slack";
    const properties = typeof schema === "object" ? (schema.properties ?? {}) : {};
    return Object.keys(properties).length ? "json" : "no-fields";
  });

  async ngOnInit() {
    try {
      const choices = await readConnectionChoices(this.target().config);
      this.choices.set(choices);
      if (choices.instance.length) this.step.set("connections");
      else await this.configure([]);
    } catch (error) {
      this.fail(error);
    }
  }

  /** `init` proposes values and saves nothing, so it's safe to run on open. */
  protected async configure(selections: ConfigurationConnectionSelection[]) {
    this.selections.set(selections);
    this.step.set("configure");
    // `init` runs with only the connections it declares.
    const initKeys = this.choices()?.initKeys ?? [];
    try {
      const result = await this.target().config.init({
        connections: selections.filter(({ key }) => initKeys.includes(key)),
      });
      if (result.status === "error") throw result.error;
      this.proposal.set(result.data as InitProposal);
    } catch (error) {
      this.fail(error);
    }
  }

  protected stringify(value: unknown) {
    return JSON.stringify(value, null, 2);
  }

  protected saveJson(json: string) {
    try {
      this.saveAndDeploy(JSON.parse(json));
    } catch {
      this.error.set("That isn't valid JSON.");
    }
  }

  protected async saveAndDeploy(value: unknown) {
    this.busy.set(true);
    this.error.set(null);
    this.fieldErrors.set([]);
    try {
      // Prismatic validates the value against the integration's schema.
      // Invalid fields come back on the error, by path. Saving also links the
      // instance to the chosen connections, which it needs before it can deploy.
      const connections = this.selections();
      const saved = await this.target().config.save({
        value,
        ...(connections.length ? { connections } : {}),
      });
      if (saved.status === "error") {
        this.fieldErrors.set([...(saved.error.fields ?? [])]);
        throw saved.error;
      }
      // Saving stores values. Deploying is what makes the instance run them.
      await this.target().instance.deploy();
      this.deployed.emit();
    } catch (error) {
      this.fail(error);
    } finally {
      this.busy.set(false);
    }
  }

  private fail(error: unknown) {
    this.error.set(error instanceof Error ? error.message : String(error));
  }
}
