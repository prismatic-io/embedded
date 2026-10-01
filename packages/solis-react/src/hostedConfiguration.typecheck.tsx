import { HostedConfiguration, type HostedConfigurationProps } from "./index.js";

export const minimal = <HostedConfiguration instanceId="SW5zdGFuY2U6..." />;

export const everyProp = (
  <HostedConfiguration
    instanceId="SW5zdGFuY2U6..."
    onClose={() => {}}
    onEvent={(event: unknown) => void event}
    onError={(error: Error) => void error.message}
    className="h-full"
  />
);

// @ts-expect-error The wizard needs an instance to configure.
export const withoutInstance = <HostedConfiguration />;

export const props: HostedConfigurationProps = { instanceId: "id" };
