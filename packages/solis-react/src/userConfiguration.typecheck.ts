import type { UserConfigurationResource } from "./index.js";
import { useServerFunction, useUserConfiguration } from "./index.js";

const useUserConfigurationContract = () => {
  const resource: UserConfigurationResource = useUserConfiguration(null);
  const action = useServerFunction<{ query: string }, { found: boolean }>(
    resource,
    "lookup",
  );
  action
    .execute({
      inputs: { query: "host value" },
      connections: [{ key: "service", id: "connection" }],
    })
    .then((result) => {
      if (result.status === "success") {
        const found: boolean = result.data.found;
        // @ts-expect-error Function output types are preserved.
        const wrong: string = result.data.found;
        void found;
        void wrong;
      }
    });
  // @ts-expect-error Function input types are checked.
  action.execute({ inputs: { query: 42 } });
  // @ts-expect-error Inputs must be explicit.
  action.execute();
  // @ts-expect-error Server functions are owned by the component that runs them.
  resource.actions.createServerFunction;
  // @ts-expect-error No user scope option.
  useUserConfiguration("instance", { scope: "user" });
  // @ts-expect-error User configuration has no integration lookup override.
  useUserConfiguration("instance", { integrationId: "integration" });
  // @ts-expect-error Always the instance's current version.
  useUserConfiguration({ instanceId: "instance", integrationVersionId: "v2" });
  // @ts-expect-error No SDK-owned form setter.
  resource.setDraft({});
  // @ts-expect-error No SDK dirty state.
  resource.isDirty;
  // @ts-expect-error No SDK form reset.
  resource.reset();
  // @ts-expect-error No SDK seed key.
  resource.seedKey;
  if (resource.status === "success") {
    const connections = resource.data.connections;
    if (connections.status === "success")
      void connections.data.serverFunctions.lookup;
  }
  useServerFunction(resource, "unknown")
    .execute({ inputs: null })
    .then((result) => {
      if (result.status === "success") {
        // @ts-expect-error Default function output is unknown.
        result.data.found;
      }
    });
  return resource;
};
void useUserConfigurationContract;
