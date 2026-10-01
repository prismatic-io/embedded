export type Permission<TReason extends string = string> =
  | { allowed: true; reason: null }
  | { allowed: false; reason: TReason };
