/**
 * Type tests for config variable values: the `fieldMapping` and
 * `objectFieldMap` data types, the values that postMessage events send, and
 * the values that `setConfigVars` accepts.
 */
import { expectTypeOf } from "expect-type";
import { setConfigVars } from "../../src/lib/setConfigVars";
import type {
  ConfigVar,
  ConfigVars,
  DefaultConfigVar,
  FieldMappingValue,
  MessageData,
} from "../../src/types";
import { PrismaticMessageEvent } from "../../src/types/postMessage";

const rows = [
  { key: "email", value: "Email" },
  { key: "last_name", value: "LastName" },
];

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

expectTypeOf<"fieldMapping">().toMatchTypeOf<DefaultConfigVar["dataType"]>();
expectTypeOf<"objectFieldMap">().toMatchTypeOf<DefaultConfigVar["dataType"]>();

expectTypeOf<FieldMappingValue>().toEqualTypeOf<
  Array<{ key: string; value: string }>
>();

// ---------------------------------------------------------------------------
// postMessage values
// ---------------------------------------------------------------------------

declare const defaultConfigVar: DefaultConfigVar;

if (defaultConfigVar.dataType === "fieldMapping") {
  expectTypeOf(defaultConfigVar.value).toEqualTypeOf<string>();
  expectTypeOf(defaultConfigVar.collectionType).toEqualTypeOf<null>();
}

if (defaultConfigVar.dataType === "objectFieldMap") {
  expectTypeOf(defaultConfigVar).toHaveProperty("value");
  if (defaultConfigVar.collectionType === null) {
    expectTypeOf(defaultConfigVar.value).toEqualTypeOf<string>();
  }
}

declare const configVar: ConfigVar;

if ("value" in configVar && configVar.dataType === "fieldMapping") {
  expectTypeOf(configVar.value).toEqualTypeOf<string>();
  expectTypeOf(configVar.collectionType).toEqualTypeOf<null>();
}

declare const message: MessageData;

if (message.event === PrismaticMessageEvent.INSTANCE_CONFIGURATION_LOADED) {
  const loaded = message.data.configVars["Lead Field Mapping"];
  if ("value" in loaded && loaded.dataType === "fieldMapping") {
    expectTypeOf(loaded.value).toEqualTypeOf<string>();
    expectTypeOf(loaded.collectionType).toEqualTypeOf<null>();
  }
}

if (message.event === PrismaticMessageEvent.USER_CONFIGURATION_LOADED) {
  const loaded = message.data.userLevelConfigVariables["Lead Field Mapping"];
  if ("value" in loaded && loaded.dataType === "fieldMapping") {
    expectTypeOf(loaded.value).toEqualTypeOf<string>();
    expectTypeOf(loaded.collectionType).toEqualTypeOf<null>();
  }
}

// ---------------------------------------------------------------------------
// setConfigVars values
// ---------------------------------------------------------------------------

const fieldMappingRows: ConfigVars = {
  "Lead Field Mapping": { value: rows },
};
expectTypeOf(fieldMappingRows).toMatchTypeOf<ConfigVars>();

const fieldMappingString: ConfigVars = {
  "Lead Field Mapping": { value: JSON.stringify(rows) },
};
expectTypeOf(fieldMappingString).toMatchTypeOf<ConfigVars>();

setConfigVars({
  selector: "#config-container",
  configVars: {
    // @ts-expect-error A field mapping row needs a destination field (`value`).
    "Lead Field Mapping": { value: [{ key: "email" }] },
  },
});

setConfigVars({
  selector: "#config-container",
  configVars: {
    // @ts-expect-error A field mapping destination field is a string.
    "Lead Field Mapping": { value: [{ key: "email", value: 1 }] },
  },
});

setConfigVars({
  selector: "#config-container",
  configVars: { "Lead Field Mapping": { value: rows } },
});

setConfigVars({
  selector: "#config-container",
  configVars: { "Lead Field Mapping": { value: JSON.stringify(rows) } },
});
