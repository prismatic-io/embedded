export const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value));
