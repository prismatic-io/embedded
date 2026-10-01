import {
  type HostApi,
  PrismaticProvider,
  type RpcEvent,
  type RpcEventListener,
} from "./index.js";

const prismaticUrl = "https://app.prismatic.io";

export const withToken = (
  <PrismaticProvider prismaticUrl={prismaticUrl} auth={{ token: "jwt" }}>
    {null}
  </PrismaticProvider>
);

export const awaitingToken = (
  <PrismaticProvider prismaticUrl={prismaticUrl}>{null}</PrismaticProvider>
);

export const legacyJwt = (
  // @ts-expect-error `auth={{ token }}` is the one way to authenticate.
  <PrismaticProvider prismaticUrl={prismaticUrl} jwt="jwt-legacy">
    {null}
  </PrismaticProvider>
);

const telemetry: RpcEventListener = (event: RpcEvent) => void event.kind;
const host: HostApi = { openExternalUrl: () => true };

export const everyBootProp = (
  <PrismaticProvider
    prismaticUrl={prismaticUrl}
    auth={{ token: "jwt" }}
    telemetry={telemetry}
    clientMeta={{ surface: "settings" }}
    host={host}
    timeoutMs={10_000}
  >
    {null}
  </PrismaticProvider>
);
