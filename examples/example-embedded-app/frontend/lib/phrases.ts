import type { Translation } from "@prismatic-io/embedded";
// A default import, because the package ships CommonJS. A named import of
// `phrases` breaks when the server renders this page.
import translations from "@prismatic-io/translations";

export type PhraseKey = keyof NonNullable<Translation["phrases"]>;

export interface PhraseVariable {
  name: string;
  /** The English default for the variable. */
  fallback: string;
}

export interface PhraseEntry {
  key: PhraseKey;
  /** The English text. A phrase with variables holds its template here. */
  english: string;
  /**
   * The English text as a screen shows it, with each wording variable filled
   * in by its default. Runtime variables keep their `%{name}`.
   */
  preview: string;
  /** Variables that carry a default word. You can reword these. */
  variables: PhraseVariable[];
  /**
   * Variables Prismatic fills in as the screen renders, such as a count or a
   * connection name. Keep their `%{name}` in the text.
   */
  runtimeVariables: string[];
}

function toEntry(key: string, value: unknown): PhraseEntry {
  if (typeof value === "string") {
    return {
      key: key as PhraseKey,
      english: value,
      preview: value,
      variables: [],
      runtimeVariables: [],
    };
  }

  const phrase = value as Record<string, unknown>;
  const variables: PhraseVariable[] = [];
  const runtimeVariables: string[] = [];

  for (const [name, fallback] of Object.entries(phrase)) {
    if (name === "_") {
      continue;
    }
    // An empty string or a zero is a placeholder for a value the screen
    // supplies. Anything else is wording you can change.
    if (typeof fallback === "string" && fallback !== "") {
      variables.push({ name, fallback });
    } else {
      runtimeVariables.push(name);
    }
  }

  const english = typeof phrase._ === "string" ? phrase._ : "";
  const fallbacks = new Map(variables.map((v) => [v.name, v.fallback]));

  return {
    key: key as PhraseKey,
    english,
    preview: english.replace(
      /%\{(\w+)\}/g,
      (match, name: string) => fallbacks.get(name) ?? match,
    ),
    variables,
    runtimeVariables,
  };
}

/**
 * Every phrase the embedded screens can show, with its English default.
 *
 * `dynamicPhrase` is left out. It holds names that come from your own
 * Prismatic tenant, such as integration names, not a fixed phrase.
 */
export const PHRASE_CATALOG: PhraseEntry[] = Object.entries(
  translations.phrases,
)
  .filter(([key]) => key !== "dynamicPhrase")
  .map(([key, value]) => toEntry(key, value))
  .sort((a, b) => a.key.localeCompare(b.key));

const BY_KEY = new Map(PHRASE_CATALOG.map((entry) => [entry.key, entry]));

export const findPhrase = (key: string): PhraseEntry | undefined =>
  BY_KEY.get(key as PhraseKey);

export interface PhraseGroup {
  /** The screen the phrases appear on. */
  title: string;
  keys: PhraseKey[];
}

/**
 * The phrases most people change first, grouped by the screen they appear on.
 * The picker shows these until you search or ask for the full list.
 */
export const COMMON_PHRASES: PhraseGroup[] = [
  {
    title: "Marketplace",
    keys: [
      "integration-marketplace__filterBar.title",
      "integration-marketplace__input.filterSearchPlaceholder",
      "integration-marketplace__filterBar.allButton",
      "integration-marketplace__filterBar.activateButton",
    ],
  },
  {
    title: "Integration cards",
    keys: [
      "integration-marketplace__card.runningLabel",
      "integration-marketplace__card.activateLabel",
      "integration-marketplace__card.pausedLabel",
      "integration-marketplace__card.connectionErrorLabel",
    ],
  },
  {
    title: "Configuration wizard",
    keys: [
      "configurationWizardDialog.nextButton",
      "configurationWizardDialog.finishButton",
      "common.cancelButton",
      "common.saveButton",
    ],
  },
  {
    title: "Activated integration",
    keys: [
      "integrations.id__banner.enabledText",
      "integrations.id__banner.pauseButton",
      "integrations.id__filterBar.reconfigureButton",
      "deactivateIntegrationDialog.openButton",
      "integrations.id__banner.updateText",
    ],
  },
];
