import { expect, test } from "vitest";
import { toMarketplaceIntegrationError } from "./internal.js";

test.each([
  "PRISMATIC_SESSION_REVOKED",
  "PRISMATIC_PROTOCOL_MISMATCH",
  "PRISMATIC_MARKETPLACE_INTEGRATION_NOT_FOUND",
])("preserves the supported marketplace error code %s", (code) => {
  const cause = Object.assign(new Error("request failed"), { code });
  const error = toMarketplaceIntegrationError(cause);
  expect(error).toBeInstanceOf(Error);
  expect(error.code).toBe(code);
  expect(error.message).toBe(cause.message);
  expect(error.cause).toBe(cause);
});

test.each([
  new Error("offline"),
  Object.assign(new Error("unsupported"), { code: "OTHER" }),
  "failed",
])("normalizes unknown marketplace failures: %s", (cause) => {
  const error = toMarketplaceIntegrationError(cause);
  expect(error.code).toBe("PRISMATIC_UNKNOWN");
  expect(error.message).toBe(cause instanceof Error ? cause.message : cause);
});
