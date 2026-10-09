import type {
  ConfigurationResource,
  JsonSchema,
} from "@prismatic-io/solis-react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Label } from "#/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import {
  type ServerFunctionQuery,
  useServerFunctionQuery,
} from "#/hooks/use-server-function-query";
import { cn } from "#/lib/utils";

/**
 * The values the Fake CRM integration saves. This mirrors the zod schema in
 * `integrations/fake-crm/src/configuration.ts`. Prismatic validates saved
 * values against that schema, so this type only helps the form.
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

interface Field {
  name: string;
  label: string;
  type: string;
}

interface SampleRecord {
  record: Record<string, string | number | null> | null;
  acmeContact: Record<string, string>;
}

/** Leaves a field unmapped. Radix Select can't use an empty string as a value. */
const UNMAPPED = "__unmapped__";

export interface AcmeField {
  key: string;
  title: string;
  required: boolean;
}

const FIELD_MAPPING_SCOPE = "#/properties/fieldMapping/properties/";

/** Every `scope` in a JSON Forms layout, in the order the layout lists them. */
function scopesOf(uiSchema: unknown): string[] {
  if (!uiSchema || typeof uiSchema !== "object") return [];
  const { scope, elements } = uiSchema as {
    scope?: string;
    elements?: unknown[];
  };
  return [
    ...(scope ? [scope] : []),
    ...(elements ?? []).flatMap((element) => scopesOf(element)),
  ];
}

/**
 * Reads the Acme fields to map from the configuration's JSON Schema rather
 * than hard-coding them, so a new field in the integration shows up here
 * without an app change. The integration sets each `title` with zod's
 * `.meta()`. JSON Schema properties have no order, so the order comes from the
 * integration's `uiSchema`.
 */
export function acmeFieldsFromSchema(
  schema: JsonSchema,
  uiSchema: JsonSchema | null,
): AcmeField[] {
  if (typeof schema !== "object") return [];
  const properties = schema.properties as
    | Record<
        string,
        { properties?: Record<string, { title?: string }>; required?: string[] }
      >
    | undefined;
  const fieldMapping = properties?.fieldMapping;
  const order = scopesOf(uiSchema)
    .filter((scope) => scope.startsWith(FIELD_MAPPING_SCOPE))
    .map((scope) => scope.slice(FIELD_MAPPING_SCOPE.length));
  const position = (key: string) =>
    order.includes(key) ? order.indexOf(key) : order.length;
  return Object.entries(fieldMapping?.properties ?? {})
    .map(([key, field]) => ({
      key,
      title: field.title ?? key,
      required: fieldMapping?.required?.includes(key) ?? false,
    }))
    .sort((a, b) => position(a.key) - position(b.key));
}

/**
 * A two-step setup form for the Fake CRM integration, drawn entirely with this
 * app's own components. Prismatic supplies the data: the JSON Schema of the
 * configuration, and three server functions that read the customer's CRM.
 */
export function FakeCrmConfigurationForm({
  configuration,
  initialValues,
  busy,
  submitLabel,
  fieldErrors,
  onSubmit,
  onCancel,
}: {
  configuration: ConfigurationResource;
  /** The values the integration's `init` suggested. */
  initialValues: FakeCrmConfiguration;
  busy: boolean;
  submitLabel: string;
  /** Validation errors Prismatic returned from the last save, by JSON path. */
  fieldErrors: { path: string | null; message: string }[];
  onSubmit: (values: FakeCrmConfiguration) => void;
  onCancel?: () => void;
}) {
  const [step, setStep] = useState<"recordType" | "mapping">("recordType");
  const [values, setValues] = useState<FakeCrmConfiguration>(initialValues);

  const recordTypes = useServerFunctionQuery<
    Record<string, never>,
    RecordType[]
  >(configuration, "listRecordTypes", {});
  const fields = useServerFunctionQuery<{ recordType: string }, Field[]>(
    configuration,
    "listFields",
    values.recordType ? { recordType: values.recordType } : null,
  );
  // Sends the unsaved mapping, so the preview follows every change.
  const preview = useServerFunctionQuery<FakeCrmConfiguration, SampleRecord>(
    configuration,
    "getSampleRecord",
    step === "mapping" ? values : null,
  );

  if (configuration.status !== "success") return null;
  const acmeFields = acmeFieldsFromSchema(
    configuration.data.schema,
    configuration.data.uiSchema,
  );
  const missing = acmeFields.filter(
    (field) => field.required && !values.fieldMapping[field.key],
  );

  const chooseRecordType = (recordType: string) => {
    if (recordType === values.recordType) return;
    // A new record type has different fields, so the old mapping can't carry over.
    setValues({ recordType, fieldMapping: {} });
  };

  const mapField = (acmeField: string, crmField: string) =>
    setValues((current) => ({
      ...current,
      fieldMapping: {
        ...current.fieldMapping,
        [acmeField]: crmField === UNMAPPED ? undefined : crmField,
      },
    }));

  return (
    <div className="flex flex-col gap-6">
      <Steps step={step} />

      {step === "recordType" ? (
        <section className="flex flex-col gap-4">
          <div>
            <h3 className="font-medium">Where do you keep your people?</h3>
            <p className="text-sm text-muted-foreground">
              Choose the Fake CRM record type to sync to Acme as contacts.
            </p>
          </div>
          {recordTypes.status === "error" ? (
            <p className="text-sm text-destructive">{recordTypes.error}</p>
          ) : !recordTypes.data ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Reading record types
              from Fake CRM…
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {recordTypes.data.map((recordType) => (
                <button
                  key={recordType.name}
                  type="button"
                  onClick={() => chooseRecordType(recordType.name)}
                  className={cn(
                    "rounded-lg border p-4 text-left transition-colors hover:bg-accent",
                    values.recordType === recordType.name &&
                      "border-primary ring-2 ring-primary/30",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{recordType.label}</span>
                    {recordType.custom ? (
                      <Badge variant="outline">Custom</Badge>
                    ) : null}
                  </div>
                  <code className="text-xs text-muted-foreground">
                    {recordType.name}
                  </code>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              disabled={!values.recordType}
              onClick={() => setStep("mapping")}
            >
              Next: map fields <ArrowRight data-icon="inline-end" />
            </Button>
            {onCancel ? (
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            ) : null}
          </div>
        </section>
      ) : (
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(values);
          }}
        >
          <div className="grid gap-8 lg:grid-cols-2">
            <section className="flex flex-col gap-4">
              <div>
                <h3 className="font-medium">Map fields</h3>
                <p className="text-sm text-muted-foreground">
                  For each Acme contact field, choose the{" "}
                  <code>{values.recordType}</code> field to read.
                </p>
              </div>
              {fields.status === "error" ? (
                <p className="text-sm text-destructive">{fields.error}</p>
              ) : null}
              {acmeFields.map((acmeField) => {
                const error = fieldErrors.find(({ path }) =>
                  path?.endsWith(acmeField.key),
                );
                return (
                  <div
                    key={acmeField.key}
                    className="grid grid-cols-[8rem_1fr] items-center gap-3"
                  >
                    <Label htmlFor={`map-${acmeField.key}`}>
                      {acmeField.title}
                      {acmeField.required ? (
                        <span className="text-destructive">*</span>
                      ) : null}
                    </Label>
                    <div>
                      <Select
                        value={values.fieldMapping[acmeField.key] ?? UNMAPPED}
                        onValueChange={(value) =>
                          mapField(acmeField.key, value)
                        }
                        disabled={fields.status !== "success"}
                      >
                        <SelectTrigger
                          id={`map-${acmeField.key}`}
                          className="w-full"
                        >
                          <SelectValue placeholder="Loading fields…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNMAPPED}>Don't sync</SelectItem>
                          {fields.data?.map((field) => (
                            <SelectItem key={field.name} value={field.name}>
                              {field.label}{" "}
                              <span className="text-muted-foreground">
                                ({field.name})
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {error ? (
                        <p className="mt-1 text-xs text-destructive">
                          {error.message}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </section>

            <MappingPreview
              acmeFields={acmeFields}
              mapping={values.fieldMapping}
              preview={preview}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep("recordType")}
              disabled={busy}
            >
              Back
            </Button>
            <Button type="submit" disabled={busy || missing.length > 0}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              {submitLabel}
            </Button>
            {missing.length > 0 ? (
              <span className="text-sm text-muted-foreground">
                Map {missing.map(({ title }) => title).join(" and ")} to
                continue.
              </span>
            ) : null}
          </div>
        </form>
      )}
    </div>
  );
}

function Steps({ step }: { step: "recordType" | "mapping" }) {
  const steps = [
    { id: "recordType", label: "Choose a record type" },
    { id: "mapping", label: "Map fields and preview" },
  ] as const;
  const current = steps.findIndex(({ id }) => id === step);
  return (
    <ol className="flex items-center gap-3 text-sm">
      {steps.map(({ id, label }, index) => (
        <li key={id} className="flex items-center gap-3">
          {index > 0 ? <span className="h-px w-8 bg-border" /> : null}
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full border text-xs",
              index < current &&
                "border-primary bg-primary text-primary-foreground",
              index === current && "border-primary text-primary",
            )}
          >
            {index < current ? <Check className="size-3" /> : index + 1}
          </span>
          <span
            className={cn(
              index === current ? "font-medium" : "text-muted-foreground",
            )}
          >
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Shows a sample Fake CRM record and the Acme contact the current mapping
 * makes from it. The integration's `getSampleRecord` server function does the
 * mapping with the same code its flow uses.
 */
function MappingPreview({
  acmeFields,
  mapping,
  preview,
}: {
  acmeFields: AcmeField[];
  mapping: FakeCrmConfiguration["fieldMapping"];
  preview: ServerFunctionQuery<SampleRecord>;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Preview in Acme</h3>
          <p className="text-sm text-muted-foreground">
            A sample record from Fake CRM, as Acme will receive it.
          </p>
        </div>
        {preview.status === "loading" ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : null}
      </div>
      {preview.status === "error" ? (
        <p className="text-sm text-destructive">{preview.error}</p>
      ) : null}
      {preview.data?.record === null ? (
        <p className="text-sm text-muted-foreground">
          This record type has no records to preview.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Acme field</TableHead>
              <TableHead>From Fake CRM</TableHead>
              <TableHead>Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {acmeFields.map((field) => (
              <TableRow key={field.key}>
                <TableCell className="font-medium">{field.title}</TableCell>
                <TableCell>
                  {mapping[field.key] ? (
                    <code className="text-xs">{mapping[field.key]}</code>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {preview.data?.acmeContact[field.key] ?? (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
