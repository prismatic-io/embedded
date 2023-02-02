type ScheduleTypeEnum = "none" | "custom" | "minute" | "hour" | "day" | "week";

type DefaultConfigVarDataTypeEnum =
  | "boolean"
  | "code"
  | "connection"
  | "credential"
  | "date"
  | "picklist"
  | "schedule"
  | "string"
  | "timestamp";

type CollectionTypeEnum = "valuelist" | "keyvaluelist";

type CodeLanguageEnum = "json" | "xml" | "html";

interface BaseConfigVar {
  codeLanguage: CodeLanguageEnum | null;
  collectionType: CollectionTypeEnum | null;
  dataType: DefaultConfigVarDataTypeEnum | null;
  pickList: string[] | null;
  scheduleType: ScheduleTypeEnum | null;
  timeZone: string | null;
}

interface StringConfigVar extends BaseConfigVar {
  collectionType: null;
  value: string;
}

interface ValueListConfigVar extends BaseConfigVar {
  collectionType: "valuelist";
  value: string[];
}

interface KeyValueListConfigVar extends BaseConfigVar {
  collectionType: "keyvaluelist";
  value: Array<{ key: string; value: string }>;
}

export type DefaultConfigVar =
  | KeyValueListConfigVar
  | StringConfigVar
  | ValueListConfigVar;

enum InstanceConfigVariableStatus {
  ACTIVE = "ACTIVE",
  ERROR = "ERROR",
  PENDING = "PENDING",
}

export interface ConnectionConfigVar {
  inputs: Record<string, { value: string }>;
  status: InstanceConfigVariableStatus | null;
}

export type ConfigVar = DefaultConfigVar | ConnectionConfigVar;

interface BaseConfigVarInput {
  value: string;
}

interface ValueListConfigVarInput {
  value: string[];
}

interface KeyValueListConfigVarInput {
  value: Array<{ key: string; value: string }>;
}

interface ScheduleConfigVarInput {
  scheduleType: ScheduleTypeEnum;
  timeZone: string | undefined;
  value: string;
}

export interface ConnectionConfigVarInput {
  inputs: Record<string, { value: string }>;
}

export type DefaultConfigVarInput =
  | BaseConfigVarInput
  | KeyValueListConfigVarInput
  | ScheduleConfigVarInput
  | ValueListConfigVarInput;
