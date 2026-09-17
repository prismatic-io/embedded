import prismatic from "@prismatic-io/embedded";
import { createContext, useContext, useEffect, useState } from "react";

/** Your backend endpoint that signs an embedded JWT. */
const LOCAL_PRISMATIC_AUTH_ENDPOINT = "/api/prismatic-auth";

/**
 * Refresh this many seconds before the token expires. `prismatic-config.ts`
 * requires a token lifetime well above this, so the delay stays positive.
 */
const REFRESH_MARGIN_SECONDS = 30;

export interface PrismaticUserInfo {
  authenticatedUser: {
    id: string;
    name: string;
    email: string;
    externalId: string | null;
    org: { id: string; name: string };
    customer: {
      id: string;
      name: string;
      externalId: string | null;
      allowEmbeddedDesigner: boolean;
      allowEmbeddedWorkflowBuilder: boolean;
      allowWorkflowCopilot: boolean;
    } | null;
  };
}

interface TokenResponse {
  token: string;
  expiresIn: number;
  prismaticUrl: string;
}

/**
 * Step 1. Ask your own backend for a token.
 *
 * The signing key must stay on the server, so the browser never signs a JWT.
 * Here the endpoint is the dev-server middleware in
 * `src/plugins/prismatic-auth.ts`. In your app it is a real route.
 */
async function fetchToken(): Promise<TokenResponse> {
  const response = await fetch(LOCAL_PRISMATIC_AUTH_ENDPOINT);
  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      body?.error ??
        `Token request failed: ${response.status} ${response.statusText}`,
    );
  }

  return body as TokenResponse;
}

let initialized = false;

/**
 * Step 2. Initialize the SDK.
 *
 * `init` resets the SDK state, so call it once per page load. Refreshing the
 * token later calls `authenticate` again, not `init`.
 */
function initializeOnce(prismaticUrl: string) {
  if (initialized) {
    return;
  }
  prismatic.init({ prismaticUrl });
  initialized = true;
}

const USER_INFO_QUERY = `{
  authenticatedUser {
    id
    name
    email
    externalId
    org {
      id
      name
    }
    customer {
      id
      name
      externalId
      allowEmbeddedDesigner
      allowEmbeddedWorkflowBuilder
      allowWorkflowCopilot
    }
  }
}`;

/**
 * Step 4. Read the signed-in user.
 *
 * `graphqlRequest` sends the token from the last `authenticate` call, so this
 * returns the customer's own view of the Prismatic API. The `customer` field
 * is null for an organization user and set for an embedded user.
 */
async function fetchUserInfo(): Promise<PrismaticUserInfo> {
  const result = await prismatic.graphqlRequest<PrismaticUserInfo>({
    query: USER_INFO_QUERY,
  });

  if (result.errors?.length) {
    throw new Error(result.errors.map((error) => error.message).join(" "));
  }

  return result.data;
}

// ===========================================================================
// Part 2 — the React binding.
//
// One state object, one effect, one context. The effect runs the four steps
// above and then schedules itself again before the token expires.
// ===========================================================================

export interface PrismaticAuth {
  /** True after `authenticate` succeeds. Embedded screens need this. */
  authenticated: boolean;
  /** The current JWT. Pass it on if you make your own API requests. */
  token: string | null;
  /** The signed-in user, from the Prismatic API. */
  userinfo: PrismaticUserInfo | null;
  /** Set if any step failed. Show it instead of an embedded screen. */
  error: Error | null;
  /** Prismatic URL */
  prismaticUrl: string;
}

const UNAUTHENTICATED: PrismaticAuth = {
  authenticated: false,
  token: null,
  userinfo: null,
  error: null,
  prismaticUrl: "",
};

const PrismaticContext = createContext<PrismaticAuth | null>(null);

export function PrismaticProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<PrismaticAuth>(UNAUTHENTICATED);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = async () => {
      try {
        const { token, expiresIn, prismaticUrl } = await fetchToken();
        initializeOnce(prismaticUrl);
        await prismatic.authenticate({ token });
        const userinfo = await fetchUserInfo();

        if (cancelled) {
          return;
        }

        setAuth({
          authenticated: true,
          token,
          userinfo,
          error: null,
          prismaticUrl,
        });

        // Schedule a refresh before the token expires.
        timer = setTimeout(
          connect,
          (expiresIn - REFRESH_MARGIN_SECONDS) * 1000,
        );
      } catch (error) {
        if (cancelled) {
          return;
        }
        setAuth({
          ...UNAUTHENTICATED,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    };

    connect();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return <PrismaticContext value={auth}>{children}</PrismaticContext>;
}

/** Returns the Prismatic token, the signed-in user, and the auth state. */
export function usePrismaticAuth(): PrismaticAuth {
  const context = useContext(PrismaticContext);

  if (!context) {
    throw new Error("usePrismatic must be used inside a PrismaticProvider.");
  }

  return context;
}
