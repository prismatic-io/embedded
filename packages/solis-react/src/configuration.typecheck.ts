import type {
  ConfigurationResource,
  ServerFunctionAction,
} from "@prismatic-io/solis-core";
import { useConfiguration, useServerFunction } from "./index.js";

const useConfigurationContract = () => {
  const resource: ConfigurationResource = useConfiguration({
    instanceId: null,
  });
  useConfiguration({ instanceId: "instance", integrationVersionId: "v2" });
  // @ts-expect-error The configuration takes one object, not a bare id.
  useConfiguration("instance");
  // @ts-expect-error The version is named for what it is.
  useConfiguration({ instanceId: "instance", integrationId: "integration" });
  // @ts-expect-error Host values are not SDK draft state.
  resource.setDraft({});
  // @ts-expect-error No SDK dirty state.
  resource.isDirty;
  // @ts-expect-error No SDK reset operation.
  resource.reset();
  // @ts-expect-error No SDK seed key.
  resource.seedKey;
  // @ts-expect-error Server functions are owned by the component that runs them.
  resource.actions.createServerFunction;
  resource.actions.init.execute({ connections: [{ key: "a", id: "b" }] });
  // @ts-expect-error The version is the configuration's scope.
  resource.actions.init.execute({ targetIntegrationVersionId: "v2" });

  const typed: ServerFunctionAction<{ baseId: string }, { tables: string[] }> =
    useServerFunction<{ baseId: string }, { tables: string[] }>(
      resource,
      "listTables",
    );
  typed.execute({ inputs: { baseId: "host-owned" } });
  // @ts-expect-error Inputs are explicit.
  typed.execute();
  // @ts-expect-error Host input contracts are checked.
  typed.execute({ inputs: { baseId: 42 } });
  typed.execute({ inputs: { baseId: "host-owned" } }).then((value) => {
    if (value.status === "success") {
      const tables: string[] = value.data.tables;
      // @ts-expect-error Output contracts are checked.
      const wrong: number = value.data.tables;
      void tables;
      void wrong;
    }
  });
  const status: "idle" | "loading" | "success" | "error" = typed.status;
  void status;
  useServerFunction(resource, "untyped")
    .execute({ inputs: 42 })
    .then((value) => {
      if (value.status === "success") {
        // @ts-expect-error Default output remains unknown.
        value.data.tables;
      }
    });
  // @ts-expect-error A server function needs the configuration it runs for.
  useServerFunction("instance", "listTables");
  return resource;
};
void useConfigurationContract;
