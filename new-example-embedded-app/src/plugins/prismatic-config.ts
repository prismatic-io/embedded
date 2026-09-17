import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import dotenv from "dotenv";
import { z } from "zod";

/**
 * The client refreshes the token 30 seconds before it expires. A short
 * lifetime would make it refresh almost without a pause, so require a floor.
 */
const MIN_TOKEN_VALID_SECONDS = 120;

/** Every variable is required. There are no defaults. */
const required = (name: string) =>
  z
    .string({ error: `${name} is missing.` })
    .trim()
    .min(1, `${name} is missing.`);

const envSchema = z
  .object({
    PRISMATIC_URL: required("PRISMATIC_URL").pipe(
      z.url("PRISMATIC_URL must be a URL, such as https://app.prismatic.io"),
    ),
    PRISMATIC_ORGANIZATION: required("PRISMATIC_ORGANIZATION"),
    PRISMATIC_CUSTOMER_EXTERNAL_ID: required("PRISMATIC_CUSTOMER_EXTERNAL_ID"),
    PRISMATIC_CUSTOMER_NAME: required("PRISMATIC_CUSTOMER_NAME"),
    PRISMATIC_USER_ID: required("PRISMATIC_USER_ID"),
    PRISMATIC_USER_NAME: required("PRISMATIC_USER_NAME"),
    PRISMATIC_ROLE: required("PRISMATIC_ROLE").pipe(
      z.enum(["admin", "user"], {
        error: 'PRISMATIC_ROLE must be "admin" or "user".',
      }),
    ),
    PRISMATIC_TOKEN_VALID_SECONDS: required("PRISMATIC_TOKEN_VALID_SECONDS")
      .regex(
        /^[1-9]\d*$/,
        "PRISMATIC_TOKEN_VALID_SECONDS must be a whole number greater than zero.",
      )
      .transform(Number)
      .pipe(
        z
          .number()
          .min(
            MIN_TOKEN_VALID_SECONDS,
            `PRISMATIC_TOKEN_VALID_SECONDS must be at least ${MIN_TOKEN_VALID_SECONDS} seconds.`,
          ),
      ),
    PRISMATIC_SIGNING_KEY_PATH: required("PRISMATIC_SIGNING_KEY_PATH"),
    OPENAI_API_KEY: required("OPENAI_API_KEY"),
    PRISMATIC_MCP_URL: required("PRISMATIC_MCP_URL"),
  })
  .transform((env) => ({
    prismaticUrl: env.PRISMATIC_URL,
    organization: env.PRISMATIC_ORGANIZATION,
    customerExternalId: env.PRISMATIC_CUSTOMER_EXTERNAL_ID,
    customerName: env.PRISMATIC_CUSTOMER_NAME,
    userId: env.PRISMATIC_USER_ID,
    userName: env.PRISMATIC_USER_NAME,
    role: env.PRISMATIC_ROLE,
    tokenValidSeconds: env.PRISMATIC_TOKEN_VALID_SECONDS,
    openaiApiKey: env.OPENAI_API_KEY,
    prismaticMcpUrl: env.PRISMATIC_MCP_URL,
  }));

export type PrismaticConfig = z.infer<typeof envSchema> & {
  signingKey: string;
};

export class PrismaticConfigError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(
      [
        "The Prismatic configuration is incomplete.",
        ...problems.map((problem) => `  - ${problem}`),
        "Copy .env.example to .env.local and fill in the values.",
      ].join("\n"),
    );
    this.name = "PrismaticConfigError";
    this.problems = problems;
  }
}

/**
 * Reads the .env files the way Vite does, most specific first.
 *
 * We parse the files ourselves rather than call Vite's `loadEnv`. Vite copies
 * the values into `process.env` at start-up and `loadEnv` lets `process.env`
 * win, so an edit to .env.local would stay invisible until you restart Node.
 * We do not read `process.env` for the same reason.
 */
function readEnvFiles(envDir: string, mode: string): Record<string, string> {
  const files = [`.env.${mode}.local`, ".env.local", `.env.${mode}`, ".env"];

  const env: Record<string, string> = {};
  for (const file of files) {
    const path = resolve(envDir, file);
    if (!existsSync(path)) {
      continue;
    }
    const parsed = dotenv.parse(readFileSync(path, "utf8"));
    // The first file that sets a key wins.
    for (const [key, value] of Object.entries(parsed)) {
      env[key] ??= value;
    }
  }

  return env;
}

/**
 * Reads the key file. zod checks the shape of the variables, not the disk, so
 * this runs on its own. That way a bad key path and a bad variable both report
 * in the same message.
 */
function readSigningKey(
  envDir: string,
  path: string | undefined,
  problems: string[],
): string {
  const trimmed = path?.trim();
  if (!trimmed) {
    // The schema already reports this one as missing.
    return "";
  }

  let key: string;
  try {
    key = readFileSync(resolve(envDir, trimmed), "utf8");
  } catch {
    problems.push(
      `PRISMATIC_SIGNING_KEY_PATH points to an unreadable file: ${trimmed}`,
    );
    return "";
  }

  if (!key.includes("-----BEGIN")) {
    problems.push(
      `PRISMATIC_SIGNING_KEY_PATH is not a PEM file. It must start with -----BEGIN: ${trimmed}`,
    );
    return "";
  }

  return key;
}

/**
 * Reads the Prismatic configuration from the .env files in `envDir`.
 * Throws a PrismaticConfigError that lists every problem at once.
 */
export function loadPrismaticConfig(
  envDir: string,
  mode: string,
): PrismaticConfig {
  const env = readEnvFiles(envDir, mode);
  const result = envSchema.safeParse(env);

  const problems = result.success
    ? []
    : result.error.issues.map((issue) => issue.message);

  const signingKey = readSigningKey(
    envDir,
    env.PRISMATIC_SIGNING_KEY_PATH,
    problems,
  );

  if (!result.success || problems.length > 0) {
    throw new PrismaticConfigError(problems);
  }

  return { ...result.data, signingKey };
}
