import { HostedConfiguration, type HostedConfigurationProps } from "./index.js";

export const minimal = <HostedConfiguration instanceId="SW5zdGFuY2U6..." />;

export const everyProp = (
  <HostedConfiguration
    instanceId="SW5zdGFuY2U6..."
    onReady={({ setConfigVars }) => {
      setConfigVars({
        configVars: {
          Region: { value: "west" },
          Fields: { value: ["Name"] },
          Mapping: { value: [{ key: "from", value: "to" }] },
          Schedule: {
            value: "0 9 * * *",
            scheduleType: "custom",
            timeZone: "UTC",
          },
          Connection: { inputs: { apiKey: { value: "key" } } },
        },
      });
      // @ts-expect-error Hosted config variable values use the embedded input shape.
      setConfigVars({ configVars: { Region: "west" } });
    }}
    onClose={() => {}}
    onEvent={(event: unknown) => void event}
    onError={(error: Error) => void error.message}
    className="h-full"
  />
);

// @ts-expect-error The wizard needs an instance to configure.
export const withoutInstance = <HostedConfiguration />;

export const props: HostedConfigurationProps = { instanceId: "id" };
