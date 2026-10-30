import {
  Component,
  computed,
  effect,
  input,
  linkedSignal,
  output,
  signal,
  type WritableSignal,
} from "@angular/core";
import type { ConfigurationStub } from "@prismatic-io/solis-core";
import type { ConfigurationState } from "@prismatic-io/solis-core/protocol";
import { callServerFunction } from "../solis";

/**
 * The values the Fake CRM integration saves. This mirrors the zod schema in
 * `examples/example-embedded-app/integrations/fake-crm/src/configuration.ts`.
 * Prismatic validates saved values against that schema.
 */
export interface FakeCrmConfiguration {
  recordType: string;
  fieldMapping: Record<string, string | undefined>;
}

/** What the Fake CRM integration's server functions return. */
interface RecordType {
  name: string;
  label: string;
  custom: boolean;
}
interface CrmField {
  name: string;
  label: string;
}
interface SampleRecord {
  record: Record<string, unknown> | null;
  acmeContact: Record<string, string>;
}

const FIELD_MAPPING_SCOPE = "#/properties/fieldMapping/properties/";

/**
 * The setup form for the Fake CRM integration, built with this app's own
 * markup. Prismatic supplies the data: the configuration's JSON Schema, and
 * three server functions that read the customer's CRM.
 */
@Component({
  selector: "app-fake-crm-form",
  template: `
    <form (submit)="$event.preventDefault(); save.emit(values())">
      <section>
        <h3>Where do you keep your people?</h3>
        <p class="muted">Choose the Fake CRM record type to sync to Acme as contacts.</p>
        @if (recordTypes(); as recordTypes) {
          <div class="choices">
            @for (type of recordTypes; track type.name) {
              <button
                type="button"
                class="choice"
                [class.selected]="values().recordType === type.name"
                (click)="chooseRecordType(type.name)"
              >
                <strong>{{ type.label }}</strong>
                @if (type.custom) {
                  <span class="badge">Custom</span>
                }
                <code>{{ type.name }}</code>
              </button>
            }
          </div>
        } @else {
          <p class="muted">Reading record types from Fake CRM…</p>
        }
      </section>

      @if (values().recordType) {
        <div class="mapper">
          <section>
            <h3>Map fields</h3>
            @for (field of acmeFields(); track field.key) {
              <label class="field">
                <span>
                  {{ field.title }}
                  @if (field.required) {
                    <span class="error">*</span>
                  }
                </span>
                <select (change)="mapField(field.key, $any($event.target).value)">
                  <option value="">Don't sync</option>
                  @for (crmField of crmFields(); track crmField.name) {
                    <option
                      [value]="crmField.name"
                      [selected]="crmField.name === values().fieldMapping[field.key]"
                    >
                      {{ crmField.label }} ({{ crmField.name }})
                    </option>
                  }
                </select>
                @if (errorFor(field.key); as message) {
                  <small class="error">{{ message }}</small>
                }
              </label>
            }
          </section>

          <section class="preview">
            <h3>Preview in Acme</h3>
            <p class="muted">A sample record from Fake CRM, as Acme will receive it.</p>
            @if (preview()?.record === null) {
              <p class="muted">This record type has no records to preview.</p>
            } @else {
              <table>
                <tr><th>Acme field</th><th>From Fake CRM</th><th>Value</th></tr>
                @for (field of acmeFields(); track field.key) {
                  <tr>
                    <td>{{ field.title }}</td>
                    <td><code>{{ values().fieldMapping[field.key] ?? "—" }}</code></td>
                    <td>{{ preview()?.acmeContact?.[field.key] ?? "—" }}</td>
                  </tr>
                }
              </table>
            }
          </section>
        </div>
      }

      @if (error(); as error) {
        <p class="error">{{ error }}</p>
      }
      <div class="actions">
        <button type="submit" [disabled]="busy() || missing().length > 0">Save and deploy</button>
        @if (missing().length) {
          <span class="muted">Map {{ missing().join(" and ") }} to continue.</span>
        }
      </div>
    </form>
  `,
})
export class FakeCrmForm {
  readonly config = input.required<ConfigurationStub>();
  readonly state = input.required<ConfigurationState>();
  /** The values the integration's `init` suggested. */
  readonly initialValues = input.required<FakeCrmConfiguration>();
  readonly busy = input(false);
  /** Validation errors Prismatic returned from the last save, by JSON path. */
  readonly fieldErrors = input<readonly { path: string | null; message: string }[]>([]);
  readonly save = output<FakeCrmConfiguration>();

  protected readonly values = linkedSignal(() => this.initialValues());
  protected readonly recordTypes = signal<RecordType[] | null>(null);
  protected readonly crmFields = signal<CrmField[] | null>(null);
  protected readonly preview = signal<SampleRecord | null>(null);
  protected readonly error = signal<string | null>(null);

  /**
   * The Acme fields to map, read from the JSON Schema rather than hard-coded,
   * so a new field in the integration shows up without an app change. Schema
   * properties have no order, so the order comes from the integration's
   * JSON Forms `ui` layout.
   */
  protected readonly acmeFields = computed(() => {
    const { schema, ui } = this.state();
    const mapping = (schema as { properties?: Record<string, MappingSchema> }).properties
      ?.fieldMapping;
    const order = scopesOf(ui?.type === "uiSchema" ? ui.value : null)
      .filter((scope) => scope.startsWith(FIELD_MAPPING_SCOPE))
      .map((scope) => scope.slice(FIELD_MAPPING_SCOPE.length));
    const position = (key: string) => (order.includes(key) ? order.indexOf(key) : order.length);
    return Object.entries(mapping?.properties ?? {})
      .map(([key, field]) => ({
        key,
        title: field.title ?? key,
        required: mapping?.required?.includes(key) ?? false,
      }))
      .sort((a, b) => position(a.key) - position(b.key));
  });

  protected readonly missing = computed(() =>
    this.acmeFields()
      .filter((field) => field.required && !this.values().fieldMapping[field.key])
      .map((field) => field.title),
  );

  private readonly recordType = computed(() => this.values().recordType);
  private readonly latestCall = new Map<string, number>();

  constructor() {
    effect(() => this.query("listRecordTypes", {}, this.recordTypes));
    // Only a new record type reloads its fields, not every mapping change.
    effect(() => {
      const recordType = this.recordType();
      if (recordType) this.query("listFields", { recordType }, this.crmFields);
    });
    // Sends the unsaved mapping, so the preview follows every change.
    effect(() => {
      if (this.values().recordType) this.query("getSampleRecord", this.values(), this.preview);
    });
  }

  protected chooseRecordType(recordType: string) {
    if (recordType === this.values().recordType) return;
    // A new record type has different fields, so the old mapping can't carry over.
    this.crmFields.set(null);
    this.values.set({ recordType, fieldMapping: {} });
  }

  protected mapField(acmeField: string, crmField: string) {
    // Drop an unmapped field rather than send `undefined`: getSampleRecord
    // takes a mapping of strings only.
    const { [acmeField]: _, ...fieldMapping } = this.values().fieldMapping;
    if (crmField) fieldMapping[acmeField] = crmField;
    this.values.update((values) => ({ ...values, fieldMapping }));
  }

  protected errorFor(key: string) {
    return this.fieldErrors().find(({ path }) => path?.endsWith(key))?.message;
  }

  /** Runs a server function and sets `target`, ignoring answers to older calls. */
  private async query<T>(key: string, inputs: unknown, target: WritableSignal<T | null>) {
    const call = (this.latestCall.get(key) ?? 0) + 1;
    this.latestCall.set(key, call);
    try {
      const data = await callServerFunction<T>(this.config(), key, inputs);
      if (this.latestCall.get(key) === call) target.set(data);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    }
  }
}

interface MappingSchema {
  properties?: Record<string, { title?: string }>;
  required?: string[];
}

/** Every `scope` in a JSON Forms layout, in the order the layout lists them. */
function scopesOf(uiSchema: unknown): string[] {
  if (!uiSchema || typeof uiSchema !== "object") return [];
  const { scope, elements } = uiSchema as { scope?: string; elements?: unknown[] };
  return [...(scope ? [scope] : []), ...(elements ?? []).flatMap(scopesOf)];
}
