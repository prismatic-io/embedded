import prismatic, { type Translation } from "@prismatic-io/embedded";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { EmbedLoading } from "#/components/embed-loading";
import { HelperText } from "#/components/helper-text";
import { Page } from "#/components/page";
import {
  type DynamicPhrase,
  DynamicPhraseEditor,
  newDynamicPhrase,
  newPhraseOverride,
  PhraseEditor,
  type PhraseOverride,
} from "#/components/phrase-editor";
import {
  Playground,
  PlaygroundOptions,
  PlaygroundSection,
  PlaygroundSelect,
  PlaygroundSwitch,
} from "#/components/playground";
import { useTheme } from "#/components/theme-provider";
import { useDebouncedValue } from "#/hooks/use-debounced-value";
import { usePrismaticAuth } from "#/hooks/use-prismatic-auth";
import { findPhrase } from "#/lib/phrases";

export const Route = createFileRoute("/examples/translations")({
  component: RouteComponent,
});

const SELECTOR = "#translations-marketplace";

type Preset = Array<{
  key: string;
  text?: string;
  variables?: Record<string, string>;
}>;

/** Ready-made phrase sets, to fill the editor with something to look at. */
const PRESETS = {
  english: [],
  spanish: [
    { key: "integration-marketplace__filterBar.title", text: "Mercado" },
    {
      key: "integration-marketplace__input.filterSearchPlaceholder",
      text: "Buscar integraciones",
    },
    { key: "integration-marketplace__filterBar.allButton", text: "Todas" },
    {
      key: "integration-marketplace__filterBar.activateButton",
      text: "Activadas",
    },
    { key: "integration-marketplace__card.runningLabel", text: "Activada" },
    {
      key: "integration-marketplace__card.activateLabel",
      text: "Activada sin configurar",
    },
    { key: "integration-marketplace__card.pausedLabel", text: "En pausa" },
  ],
  acme: [
    { key: "integration-marketplace__filterBar.title", text: "App Directory" },
    {
      key: "integration-marketplace__input.filterSearchPlaceholder",
      text: "Search apps",
    },
    { key: "integration-marketplace__filterBar.allButton", text: "All apps" },
    {
      key: "integration-marketplace__filterBar.activateButton",
      text: "Connected",
    },
    { key: "integration-marketplace__card.runningLabel", text: "Connected" },
    { key: "integration-marketplace__card.activateLabel", text: "Needs setup" },
    // A phrase that holds a variable. Rewording the variable renames the word
    // everywhere the phrase uses it.
    {
      key: "dataTable.integrationLabel",
      variables: { integrationSingular: "App" },
    },
  ],
} satisfies Record<string, Preset>;

type PresetName = keyof typeof PRESETS;

const PRESET_OPTIONS = [
  { value: "english", label: "English (no overrides)" },
  { value: "spanish", label: "Español" },
  { value: "acme", label: "Acme wording" },
] as const satisfies ReadonlyArray<{ value: PresetName; label: string }>;

const toOverrides = (preset: Preset): PhraseOverride[] =>
  preset.map((entry) => ({
    ...newPhraseOverride(),
    key: entry.key,
    text: entry.text ?? "",
    variables: entry.variables ?? {},
  }));

/**
 * Turns the rows of the editors into the `phrases` object the SDK takes.
 *
 * A phrase with no variables takes a plain string. A phrase that holds
 * variables takes an object: the template goes in `_`, and each variable goes
 * beside it. Send only the parts you change. Prismatic keeps its own default
 * for every part you leave out.
 *
 * Text that comes from your own Prismatic tenant has no key. It goes in
 * `dynamicPhrase`, matched by the exact text Prismatic shows today.
 */
function buildPhrases(overrides: PhraseOverride[], dynamic: DynamicPhrase[]) {
  // Keyed by string rather than by the `Phrases` key union. That union holds
  // every phrase Prismatic ships, which is more than TypeScript will index
  // into, so the object is narrowed once on the way out.
  const phrases: Record<string, string | Record<string, string>> = {};

  for (const override of overrides) {
    const entry = findPhrase(override.key);
    if (!entry) {
      continue;
    }

    const text = override.text.trim();
    const hasVariables =
      entry.variables.length > 0 || entry.runtimeVariables.length > 0;

    if (!hasVariables) {
      if (text) {
        phrases[entry.key] = text;
      }
      continue;
    }

    const phrase: Record<string, string> = {};
    if (text) {
      phrase._ = text;
    }
    for (const variable of entry.variables) {
      const value = override.variables[variable.name]?.trim();
      if (value) {
        phrase[variable.name] = value;
      }
    }
    if (Object.keys(phrase).length > 0) {
      phrases[entry.key] = phrase;
    }
  }

  // Always present, so that clearing a row puts the Prismatic wording back.
  const dynamicPhrase: Record<string, string> = {};
  for (const phrase of dynamic) {
    const source = phrase.source.trim();
    const target = phrase.target.trim();
    if (source && target) {
      dynamicPhrase[source] = target;
    }
  }
  phrases.dynamicPhrase = dynamicPhrase;

  return phrases as NonNullable<Translation["phrases"]>;
}

function RouteComponent() {
  const { authenticated, error } = usePrismaticAuth();
  const { theme } = useTheme();
  const [preset, setPreset] = useState<PresetName>("english");
  const [overrides, setOverrides] = useState<PhraseOverride[]>(() => [
    newPhraseOverride(),
  ]);
  const [dynamic, setDynamic] = useState<DynamicPhrase[]>(() => [
    newDynamicPhrase(),
  ]);
  const [debugMode, setDebugMode] = useState(false);

  // Send both options on every call, even when `phrases` is empty. An option
  // you leave out keeps the value the last call set, so an empty object is
  // what puts the Prismatic defaults back.
  const translation = useMemo<Translation>(
    () => ({ debugMode, phrases: buildPhrases(overrides, dynamic) }),
    [overrides, dynamic, debugMode],
  );

  // Rebuilding the iframe on every keystroke would be distracting, so wait
  // until typing stops.
  const settled = useDebouncedValue(JSON.stringify(translation));

  useEffect(() => {
    if (!authenticated) {
      return;
    }
    prismatic.showMarketplace({
      selector: SELECTOR,
      theme: theme === "light" ? "LIGHT" : "DARK",
      translation: JSON.parse(settled) as Translation,
    });
  }, [authenticated, theme, settled]);

  const applyPreset = (name: PresetName) => {
    setPreset(name);
    const rows = toOverrides(PRESETS[name]);
    setOverrides(rows.length > 0 ? rows : [newPhraseOverride()]);
  };

  return (
    <Page
      title="Translations and i18n"
      description="This translation playground demonstrates how to translate or reword the embedded screens. Pick any phrase Prismatic can show, give it new wording, and the marketplace reloads with it."
      actions={<HelperText id="translations" />}
      fullHeight
    >
      <Playground
        wideControls
        controls={
          <>
            <PlaygroundSection title="Phrase set">
              <PlaygroundSelect
                label="Preset"
                hint="Fill the editor with a ready-made set."
                value={preset}
                options={PRESET_OPTIONS}
                onChange={applyPreset}
              />
              <PlaygroundSwitch
                label="Debug mode"
                hint="Show the key of each phrase on the embedded screen."
                checked={debugMode}
                onChange={setDebugMode}
              />
            </PlaygroundSection>

            <PlaygroundSection
              title="Phrases"
              description="Leave a field empty to keep the Prismatic default."
            >
              <PhraseEditor overrides={overrides} onChange={setOverrides} />
            </PlaygroundSection>

            <PlaygroundSection
              title="Dynamic phrases"
              description="Text from your own Prismatic tenant, such as an integration name. Match it by its exact wording."
            >
              <DynamicPhraseEditor phrases={dynamic} onChange={setDynamic} />
            </PlaygroundSection>
          </>
        }
        options={
          <PlaygroundOptions code={JSON.stringify(translation, null, 2)} />
        }
      >
        {error ? (
          <div className="p-6 text-sm text-destructive">
            Error authenticating with Prismatic: {error.message}
          </div>
        ) : (
          <>
            <div id="translations-marketplace" className="h-full" />
            {!authenticated && (
              <EmbedLoading label="Loading the integration marketplace" />
            )}
          </>
        )}
      </Playground>
    </Page>
  );
}
