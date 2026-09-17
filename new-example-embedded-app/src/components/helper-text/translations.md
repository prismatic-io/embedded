# Translations and i18n

Every word the embedded screens show comes from a phrase key. Pass a
`translation` option to replace the phrases you care about. Use it to translate
the screens into another language, or to match the wording your own app already
uses.

```js
prismatic.showMarketplace({
  selector: "#my-embedded-marketplace",
  translation: {
    phrases: {
      "integration-marketplace__filterBar.title": "App Directory",
      "integration-marketplace__filterBar.allButton": "All apps",
    },
  },
});
```

A phrase you do not set keeps its Prismatic default.

## Put a phrase back

Send `phrases` on every call, even when it holds nothing. An option you leave
out keeps the value your last call set, so an empty object is what puts the
Prismatic wording back.

```js
// Back to the Prismatic defaults
prismatic.showMarketplace({
  selector: "#my-embedded-marketplace",
  translation: { debugMode: false, phrases: {} },
});
```

This page does the same. Clear a row, or pick the **English** preset, and it
sends `phrases` with nothing left in it.

## The editor on this page

The panel on the left lists every phrase Prismatic can show. Add a row, pick a
key from the dropdown, and type the wording you want. Search the dropdown by
key or by the English text.

The list comes from the `@prismatic-io/translations` package, which the SDK
depends on. This page reads it at run time:

```js
import translations from "@prismatic-io/translations";

const everyPhrase = translations.phrases;
```

The package ships CommonJS, so use a default import. A named import of
`phrases` breaks when your server renders the page.

You do not need that package to translate the screens. It is useful when you
build a tool like this one, or when you want to see every default in one place.

## Simple and complex phrases

Most phrases are plain strings, so a row takes one value.

Some phrases hold a variable, written `%{variableName}`. Those take an object
instead: the template goes in `_`, and each variable goes beside it. Send only
the parts you change.

```js
translation: {
  phrases: {
    // Plain string
    "integration-marketplace__filterBar.allButton": "Todas",
    // New template, default variables kept
    "activateIntegrationDialog.banner.text--isNotConfigurable": {
      _: "Póngase en contacto con %{organization} para configurar esto.",
    },
    // Default template kept, one word changed
    "dataTable.integrationLabel": { integrationSingular: "App" },
  },
}
```

That last form is how you rename a concept. Prismatic says "Integration" in
many phrases through the same `integrationSingular` variable, so you reword the
variable instead of every phrase.

A variable has one of two jobs, and the editor labels each row accordingly:

- **Wording**, such as `integrationSingular` or `organization`. It carries an
  English default, and you can change it.
- **Run time**, such as `usageCount` or `connectionName`. Prismatic fills it in
  as the screen draws, so keep its `%{name}` in your template and do not set a
  value for it.

## Dynamic phrases

The catalog covers the words Prismatic ships. It does not cover the words you
wrote yourself: your integration names, your config variable labels, your wizard
page titles and help text, and your flow and step names. Those are **dynamic
phrases**, and they go in a `dynamicPhrase` object inside `phrases`.

A dynamic phrase has no key. You match it by the text Prismatic shows today.

```js
prismatic.init({
  translation: {
    phrases: {
      dynamicPhrase: {
        "Microsoft Teams": "Microsoft Squadre",
        "Notify a Teams channel of new leads":
          "Notifica un canale di Teams di nuovi lead",
        "Teams Configuration": "Configurazione di Teams",
      },
    },
  },
});
```

The match is exact. Capital letters, punctuation, and any HTML tags must agree,
or the text stays as it is.

To list the dynamic phrases in your own tenant, run:

```bash
prism translations:list
```

That writes a `translations_output.json` file with every phrase Prismatic found
in your account. Use it as the list to translate from.

## Find a phrase key

Turn on **Debug mode** in the panel on the left. The embedded screen then shows
the key of each phrase in place of the text, so you can read the key you want.

```js
prismatic.init({ translation: { debugMode: true } });
```

Your editor also helps. The `Phrases` type lists every key, and the English text
of each one is in its doc comment.

## Where to set it

Set `translation` in `prismatic.init()` to apply it to every screen. Set it on a
single call, as this page does, to apply it to that screen only. A call-level
option merges over the one from `init`.

You can review the code for this page in
`src/routes/examples/translations.tsx`. The phrase catalog it reads is built in
`src/lib/phrases.ts`.

Read more about
[Translations and Internationalization](https://prismatic.io/docs/embed/translations-and-internationalization/).
