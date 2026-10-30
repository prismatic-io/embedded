import { Component, computed, input, linkedSignal, output, signal } from "@angular/core";
import type { Client, ConfigurationConnectionSelection } from "@prismatic-io/solis-core";
import { createConnection, type Requirement } from "../solis";

/**
 * Asks which of the customer's credentials each connection of an integration
 * runs with, such as which Slack workspace. Customer-activated connections are
 * reusable: a customer who connected Slack for one integration can choose that
 * credential here instead of authorizing Slack again.
 */
@Component({
  selector: "app-connection-picker",
  template: `
    @for (requirement of requirements(); track requirement.key) {
      <section>
        <h3>{{ requirement.label }}</h3>
        <div class="options">
          @for (option of requirement.options; track option.id) {
            <button
              type="button"
              class="choice"
              [class.selected]="chosen()[requirement.key] === option.id"
              [disabled]="option.status !== 'ACTIVE'"
              (click)="choose(requirement.key, option.id)"
            >
              {{ option.label }}
              <span class="badge" [class.installed]="option.status === 'ACTIVE'">
                {{ option.status === "ACTIVE" ? "Connected" : option.status.toLowerCase() }}
              </span>
            </button>
          }
        </div>
        <button
          type="button"
          [disabled]="
            !requirement.template || !requirement.createPermission.allowed || connecting()
          "
          (click)="connect(requirement)"
        >
          {{
            connecting() === requirement.key
              ? "Waiting for you to authorize…"
              : "Connect a new " + requirement.label + " account"
          }}
        </button>
        @if (!requirement.createPermission.allowed) {
          <p class="muted">
            You can't connect a new account ({{ requirement.createPermission.reason }}).
          </p>
        }
      </section>
    }
    @if (error(); as error) {
      <p class="error">{{ error }}</p>
    }
    <div class="actions">
      <button (click)="continue.emit(selections())" [disabled]="!complete()">Continue</button>
    </div>
  `,
})
export class ConnectionPicker {
  readonly client = input.required<Client>();
  readonly initialRequirements = input.required<Requirement[]>({ alias: "requirements" });
  readonly continue = output<ConfigurationConnectionSelection[]>();

  /** A local copy, so a connection made here joins its requirement's options. */
  protected readonly requirements = linkedSignal(() => this.initialRequirements());
  /** Starts from the credential each connection is linked to, if any. */
  protected readonly chosen = linkedSignal<Record<string, string>>(() =>
    Object.fromEntries(
      this.initialRequirements().flatMap(({ key, selected }) =>
        selected ? [[key, selected]] : [],
      ),
    ),
  );
  protected readonly connecting = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly complete = computed(() =>
    this.requirements().every(({ key }) => this.chosen()[key]),
  );
  private readonly selections = computed(() =>
    this.requirements().map(({ key }) => ({ key, id: this.chosen()[key] })),
  );

  protected choose(key: string, id: string) {
    this.chosen.update((chosen) => ({ ...chosen, [key]: id }));
  }

  /** Runs from the click, so `createConnection` can open the consent window. */
  protected async connect(requirement: Requirement) {
    this.error.set(null);
    this.connecting.set(requirement.key);
    try {
      const connection = await createConnection(this.client(), requirement.template!);
      this.requirements.update((requirements) =>
        requirements.map((r) =>
          r.key === requirement.key ? { ...r, options: [...r.options, connection] } : r,
        ),
      );
      this.choose(requirement.key, connection.id);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.connecting.set(null);
    }
  }
}
