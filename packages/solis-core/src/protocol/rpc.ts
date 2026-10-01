/** Transport limits both ends configure their capnweb session with. */

/** Caps applied to an incoming message before it is parsed. Both ends install the same values:
 * these are enforced on the receiving side, so setting them on one end alone constrains
 * nothing about what that end can be sent. */
export const RPC_LIMITS = {
  maxBigIntDigits: 128,
  maxDepth: 64,
  maxMessageSize: 4 * 1024 * 1024,
} as const;

/** Error properties safe to forward across the wire; everything else is dropped. */
export type SafeErrorProp = "code" | "status" | "statusCode";
export const SAFE_ERROR_PROPS = [
  "code",
  "status",
  "statusCode",
] as const satisfies readonly SafeErrorProp[];

/**
 * Strips a thrown error down to its message, name, and the {@link SAFE_ERROR_PROPS}.
 * Install it as capnweb's `onSendError`, which applies on the serializing side only:
 * each end installs it for what it sends, and neither can verify the other did.
 */
export const redactError = (error: Error): Error => {
  const redacted = new Error(error.message);
  redacted.name = error.name;
  redacted.stack = undefined;
  for (const key of SAFE_ERROR_PROPS) {
    const value = (error as unknown as Record<string, unknown>)[key];
    if (typeof value === "string" || typeof value === "number") {
      (redacted as unknown as Record<string, unknown>)[key] = value;
    }
  }
  return redacted;
};
