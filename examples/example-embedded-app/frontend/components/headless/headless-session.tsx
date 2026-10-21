import {
  PrismaticProvider as HeadlessProvider,
  type HostApi,
  usePrismatic,
} from "@prismatic-io/solis-react";
import { EmbedLoading } from "#/components/embed-loading";
import { usePrismaticAuth } from "#/hooks/use-prismatic-auth";

/**
 * Starts a Solis session for the headless examples, and shows its children
 * once the session is ready.
 *
 * Solis (`@prismatic-io/solis-react`) is separate from the
 * `@prismatic-io/embedded` iframe SDK the other examples use, but its provider
 * takes the same embedded JWT. Here the token comes from the app's existing
 * auth hook, which also refreshes it before it expires; the provider applies a
 * new token to the live session.
 *
 * Render this inside an element with `position: relative`, which the loading
 * placeholder fills.
 */
export function HeadlessSession({
  host,
  children,
}: {
  /**
   * Capabilities granted to Solis. Pass a module-level object: a new identity
   * restarts the session.
   */
  host?: HostApi;
  children: React.ReactNode;
}) {
  const { token, prismaticUrl, error } = usePrismaticAuth();

  if (error) {
    return <p>Error authenticating with Prismatic: {error.message}</p>;
  }
  if (!token) {
    return <EmbedLoading label="Signing in to Prismatic" />;
  }
  return (
    <HeadlessProvider
      prismaticUrl={prismaticUrl}
      auth={{ token }}
      {...(host ? { host } : {})}
    >
      <SessionReady>{children}</SessionReady>
    </HeadlessProvider>
  );
}

function SessionReady({ children }: { children: React.ReactNode }) {
  const session = usePrismatic();
  if (session.status === "error") {
    return <p>Could not connect to Prismatic: {session.error.message}</p>;
  }
  if (session.status === "loading") {
    return <EmbedLoading label="Connecting to Prismatic" />;
  }
  return children;
}
