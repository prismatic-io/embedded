import { Info } from "lucide-react";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Layout for the option playgrounds: a column of controls beside the embedded
 * screen, with the generated SDK options below it.
 *
 * There is no Prismatic code in this file. The examples that use it are in
 * `frontend/routes/examples/`.
 */
export function Playground({
  controls,
  options,
  wideControls,
  children,
}: {
  /** The control panel on the left. */
  controls: React.ReactNode;
  /** The generated SDK options, shown under the embedded screen. */
  options?: React.ReactNode;
  /** Widen the control panel for controls that need the room. */
  wideControls?: boolean;
  /** The embedded screen. */
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full gap-6">
      <aside
        className={cn(
          "flex shrink-0 flex-col gap-5 overflow-y-auto pr-2 pb-2",
          wideControls ? "w-96" : "w-76",
        )}
      >
        {controls}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border">
          {children}
        </div>
        {options}
      </div>
    </div>
  );
}

export function PlaygroundSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

/** An info icon that explains a control in plain words when hovered. */
function InfoTip({ label, text }: { label: string; text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`About ${label}`}
          className="text-muted-foreground hover:text-foreground"
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-64">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function ControlLabel({
  htmlFor,
  label,
  hint,
  description,
}: {
  htmlFor?: string;
  label: string;
  hint?: string;
  description?: string;
}) {
  return (
    <div className="grid gap-0.5">
      <div className="flex items-center gap-1">
        <Label htmlFor={htmlFor} className="text-xs font-medium">
          {label}
        </Label>
        {description ? <InfoTip label={label} text={description} /> : null}
      </div>
      {hint ? (
        <span className="text-[11px] leading-tight text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function PlaygroundSwitch({
  label,
  hint,
  description,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  /** A plain-language explanation, shown when the info icon is hovered. */
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-3">
      <ControlLabel
        htmlFor={id}
        label={label}
        hint={hint}
        description={description}
      />
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}

export interface PlaygroundOption<T extends string> {
  value: T;
  label: string;
  /** The value as the SDK spells it, shown beside the label. */
  code?: string;
  /** What choosing this option does, shown under the select once chosen. */
  description?: string;
}

export function PlaygroundSelect<T extends string>({
  label,
  hint,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  /** A plain-language explanation, shown when the info icon is hovered. */
  description?: string;
  value: T;
  options: ReadonlyArray<PlaygroundOption<T>>;
  onChange: (value: T) => void;
}) {
  const id = useId();
  const selected = options.find((option) => option.value === value);
  return (
    <div className="grid gap-1.5">
      <ControlLabel
        htmlFor={id}
        label={label}
        hint={hint}
        description={description}
      />
      <Select value={value} onValueChange={(next) => onChange(next as T)}>
        <SelectTrigger id={id} size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
              {option.code ? (
                <span className="font-mono text-[10px] text-muted-foreground">
                  {option.code}
                </span>
              ) : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected?.description ? (
        <p className="text-[11px] leading-tight text-muted-foreground">
          {selected.description}
        </p>
      ) : null}
    </div>
  );
}

export function PlaygroundText({
  label,
  hint,
  description,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  hint?: string;
  /** A plain-language explanation, shown when the info icon is hovered. */
  description?: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <ControlLabel
        htmlFor={id}
        label={label}
        hint={hint}
        description={description}
      />
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

export function PlaygroundColor({
  label,
  hint,
  description,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  /** A plain-language explanation, shown when the info icon is hovered. */
  description?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <ControlLabel
        htmlFor={id}
        label={label}
        hint={hint}
        description={description}
      />
      <input
        id={id}
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="size-8 shrink-0 cursor-pointer rounded-md border border-border bg-transparent"
      />
    </div>
  );
}

/** A set of checkboxes rendered as toggle chips. */
export function PlaygroundChips<T extends string>({
  label,
  hint,
  description,
  values,
  options,
  onChange,
}: {
  /** Leave it out when the section title already names the chips. */
  label?: string;
  hint?: string;
  /** A plain-language explanation, shown when the info icon is hovered. */
  description?: string;
  values: readonly T[];
  options: readonly T[];
  onChange: (values: T[]) => void;
}) {
  return (
    <div className="grid gap-1.5">
      {label ? (
        <ControlLabel label={label} hint={hint} description={description} />
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const selected = values.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                onChange(
                  selected
                    ? values.filter((value) => value !== option)
                    : [...values, option],
                )
              }
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                selected
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-accent",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Shows the options the controls above produced, ready to copy. */
export function PlaygroundOptions({
  code,
  label = "Generated options",
}: {
  code: string;
  label?: string;
}) {
  return (
    <div className="shrink-0 rounded-lg border border-border bg-muted/40">
      <div className="border-b border-border px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
        {label}
      </div>
      <pre className="max-h-44 overflow-auto p-3 text-[11px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
