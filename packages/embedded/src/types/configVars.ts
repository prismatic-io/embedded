type ScheduleTypeEnum =
  | "none"
  | "once"
  | "custom"
  | "minute"
  | "hour"
  | "day"
  | "week";

type DefaultConfigVarDataTypeEnum =
  | "boolean"
  | "code"
  | "connection"
  | "credential"
  | "date"
  | "fieldMapping"
  | "objectFieldMap"
  | "picklist"
  | "schedule"
  | "string"
  | "timestamp";

type ValueConfigVarDataType = Exclude<
  DefaultConfigVarDataTypeEnum,
  "fieldMapping"
>;

/**
 * The value of a `fieldMapping` config variable. Each row maps a source field
 * (`key`) to a destination field (`value`).
 */
export type FieldMappingValue = Array<{ key: string; value: string }>;

type CollectionTypeEnum = "valuelist" | "keyvaluelist";

type CodeLanguageEnum = "json" | "xml" | "html";

interface BaseConfigVar {
  id: string;
  codeLanguage: CodeLanguageEnum | null;
  collectionType: CollectionTypeEnum | null;
  dataType: DefaultConfigVarDataTypeEnum | null;
  pickList: string[] | null;
  scheduleType: ScheduleTypeEnum | null;
  timeZone: string | null;
}

interface StringConfigVar extends BaseConfigVar {
  collectionType: null;
  dataType: ValueConfigVarDataType | null;
  value: string;
}

interface ValueListConfigVar extends BaseConfigVar {
  collectionType: "valuelist";
  dataType: ValueConfigVarDataType | null;
  value: string[];
}

interface KeyValueListConfigVar extends BaseConfigVar {
  collectionType: "keyvaluelist";
  dataType: ValueConfigVarDataType | null;
  value: Array<{ key: string; value: string }>;
}

interface FieldMappingConfigVar extends BaseConfigVar {
  collectionType: null;
  dataType: "fieldMapping";
  /** A JSON string of a {@link FieldMappingValue}. */
  value: string;
}

export type DefaultConfigVar =
  | FieldMappingConfigVar
  | KeyValueListConfigVar
  | StringConfigVar
  | ValueListConfigVar;

enum InstanceConfigVariableStatus {
  ACTIVE = "ACTIVE",
  ERROR = "ERROR",
  PENDING = "PENDING",
}

export interface ConnectionConfigVar extends BaseConfigVar {
  inputs: Record<string, { value: string }>;
  status: InstanceConfigVariableStatus | null;
}

/**
 * A config variable in a postMessage event. A connection config variable has
 * no `value`, so check for `value` before you check `dataType`.
 *
 * @example
 * if ("value" in configVar && configVar.dataType === "fieldMapping") {
 *   const rows: FieldMappingValue = JSON.parse(configVar.value);
 * }
 */
export type ConfigVar = DefaultConfigVar | ConnectionConfigVar;

export type ConfigVars = Record<
  string,
  DefaultConfigVarInput | ConnectionConfigVarInput
>;

interface BaseConfigVarInput {
  value: string;
}

interface ValueListConfigVarInput {
  value: string[];
}

interface KeyValueListConfigVarInput {
  value: Array<{ key: string; value: string }>;
}

interface FieldMappingConfigVarInput {
  /** The rows, or a JSON string of the rows. */
  value: FieldMappingValue | string;
}

interface ScheduleConfigVarInput {
  scheduleType: ScheduleTypeEnum;
  timeZone: string | undefined;
  value: string;
}

export interface ConnectionConfigVarInput {
  onPremiseResourceId?: string;
  inputs: Record<string, { value: string }>;
}

export type DefaultConfigVarInput =
  | BaseConfigVarInput
  | FieldMappingConfigVarInput
  | KeyValueListConfigVarInput
  | ScheduleConfigVarInput
  | ValueListConfigVarInput;
