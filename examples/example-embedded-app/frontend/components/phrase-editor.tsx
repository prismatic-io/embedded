import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { findPhrase, PHRASE_CATALOG, type PhraseVariable } from "@/lib/phrases";
import { cn } from "@/lib/utils";

/** One row of the editor: a phrase key and the wording to use for it. */
export interface PhraseOverride {
  /** Row identity. It never reaches Prismatic. */
  id: string;
  /** A key from the catalog, or "" while the row is still empty. */
  key: string;
  /** The replacement text, or the template of a phrase that holds variables. */
  text: string;
  /** Replacement wording for the variables of a complex phrase. */
  variables: Record<string, string>;
}

let nextId = 0;

export const newPhraseOverride = (): PhraseOverride => ({
  id: `phrase-${nextId++}`,
  key: "",
  text: "",
  variables: {},
});

/**
 * One row of the dynamic phrase editor.
 *
 * A dynamic phrase is text that comes from your own Prismatic tenant, such as
 * an integration name or a config variable label. It has no key in the
 * catalog, so you match it by its exact English text.
 */
export interface DynamicPhrase {
  /** Row identity. It never reaches Prismatic. */
  id: string;
  /** The text as it reads in Prismatic today. The match is exact. */
  source: string;
  /** The text to show instead. */
  target: string;
}

export const newDynamicPhrase = (): DynamicPhrase => ({
  id: `dynamic-${nextId++}`,
  source: "",
  target: "",
});

/** Long lists are slow to draw and hard to read, so show a page at a time. */
const MAX_RESULTS = 60;

function PhrasePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { shown, total } = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const found = needle
      ? PHRASE_CATALOG.filter(
          (entry) =>
            entry.key.toLowerCase().includes(needle) ||
            entry.english.toLowerCase().includes(needle),
        )
      : PHRASE_CATALOG;
    return { shown: found.slice(0, MAX_RESULTS), total: found.length };
  }, [query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between font-mono text-[11px]"
        >
          <span className="truncate">{value || "Select a phrase"}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[30rem] border p-0">
        <div className="border-b border-border p-2">
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by key or by English text"
            className="h-8 text-xs"
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {shown.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">
              No phrase matches "{query}".
            </p>
          ) : (
            shown.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => {
                  onChange(entry.key);
                  setOpen(false);
                  setQuery("");
                }}
                className={cn(
                  "flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-accent",
                  entry.key === value && "bg-accent",
                )}
              >
                <Check
                  className={cn(
                    "mt-0.5 size-3.5 shrink-0",
                    entry.key === value ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[11px]">
                    {entry.key}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {entry.english}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
        <div className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
          {total > shown.length
            ? `Showing ${shown.length} of ${total} phrases. Keep typing to narrow the list.`
            : `${total} of ${PHRASE_CATALOG.length} phrases`}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <Label
        htmlFor={id}
        className="text-[11px] font-normal text-muted-foreground"
      >
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 text-xs"
      />
    </div>
  );
}

function VariableField({
  variable,
  value,
  onChange,
}: {
  variable: PhraseVariable;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="grid grid-cols-[7rem_1fr] items-center gap-2">
      <Label
        htmlFor={id}
        className="truncate font-mono text-[11px] font-normal text-muted-foreground"
      >
        %&#123;{variable.name}&#125;
      </Label>
      <Input
        id={id}
        value={value}
        placeholder={variable.fallback}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 text-xs"
      />
    </div>
  );
}

function PhraseRow({
  override,
  onChange,
  onRemove,
}: {
  override: PhraseOverride;
  onChange: (next: PhraseOverride) => void;
  onRemove: () => void;
}) {
  const entry = findPhrase(override.key);

  return (
    <div className="grid gap-2 rounded-lg border border-border p-2.5">
      <div className="flex items-start gap-1.5">
        <div className="min-w-0 flex-1">
          <PhrasePicker
            value={override.key}
            onChange={(key) =>
              onChange({ ...override, key, text: "", variables: {} })
            }
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Remove this phrase"
          onClick={onRemove}
          className="size-8 shrink-0 text-muted-foreground"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {entry ? (
        <>
          <Input
            value={override.text}
            placeholder={entry.english}
            onChange={(event) =>
              onChange({ ...override, text: event.target.value })
            }
            className="h-8 text-xs"
          />

          {entry.variables.map((variable) => (
            <VariableField
              key={variable.name}
              variable={variable}
              value={override.variables[variable.name] ?? ""}
              onChange={(value) =>
                onChange({
                  ...override,
                  variables: { ...override.variables, [variable.name]: value },
                })
              }
            />
          ))}

          {entry.runtimeVariables.length > 0 ? (
            <p className="text-[11px] leading-tight text-muted-foreground">
              Keep{" "}
              {entry.runtimeVariables.map((name) => `%{${name}}`).join(" and ")}{" "}
              in the text. Prismatic fills{" "}
              {entry.runtimeVariables.length > 1 ? "those" : "that"} in as the
              screen draws.
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Select a phrase to give it new wording.
        </p>
      )}
    </div>
  );
}

/**
 * A list of phrase overrides. Each row picks a key from the catalog and gives
 * it new wording.
 *
 * There is no Prismatic code in this file. The example that uses it is
 * `frontend/routes/examples/translations.tsx`.
 */
export function PhraseEditor({
  overrides,
  onChange,
}: {
  overrides: PhraseOverride[];
  onChange: (overrides: PhraseOverride[]) => void;
}) {
  return (
    <div className="grid gap-2">
      {overrides.map((override) => (
        <PhraseRow
          key={override.id}
          override={override}
          onChange={(next) =>
            onChange(
              overrides.map((item) => (item.id === next.id ? next : item)),
            )
          }
          onRemove={() =>
            onChange(overrides.filter((item) => item.id !== override.id))
          }
        />
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange([...overrides, newPhraseOverride()])}
      >
        <Plus data-icon="inline-start" />
        Add a phrase
      </Button>
    </div>
  );
}

/**
 * A list of dynamic phrases. Each row matches text Prismatic shows today and
 * gives the text to show instead.
 *
 * There is no Prismatic code in this file. The example that uses it is
 * `frontend/routes/examples/translations.tsx`.
 */
export function DynamicPhraseEditor({
  phrases,
  onChange,
}: {
  phrases: DynamicPhrase[];
  onChange: (phrases: DynamicPhrase[]) => void;
}) {
  const update = (next: DynamicPhrase) =>
    onChange(phrases.map((item) => (item.id === next.id ? next : item)));

  return (
    <div className="grid gap-2">
      {phrases.map((phrase) => (
        <div
          key={phrase.id}
          className="grid gap-2 rounded-lg border border-border p-2.5"
        >
          <div className="flex items-start gap-1.5">
            <div className="min-w-0 flex-1">
              <Field
                label="Text in Prismatic today"
                value={phrase.source}
                placeholder="Microsoft Teams"
                onChange={(source) => update({ ...phrase, source })}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove this dynamic phrase"
              onClick={() =>
                onChange(phrases.filter((item) => item.id !== phrase.id))
              }
              className="mt-5 size-8 shrink-0 text-muted-foreground"
            >
              <X className="size-3.5" />
            </Button>
          </div>
          <Field
            label="Text to show instead"
            value={phrase.target}
            placeholder="Microsoft Squadre"
            onChange={(target) => update({ ...phrase, target })}
          />
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange([...phrases, newDynamicPhrase()])}
      >
        <Plus data-icon="inline-start" />
        Add a dynamic phrase
      </Button>
    </div>
  );
}
