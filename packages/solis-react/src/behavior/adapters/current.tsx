/**
 * The behavior specs' adapter onto today's hooks. This is the only file under `behavior/`
 * that names a hook, a resource shape or an action handle; a refactor that reshapes the API
 * rewrites this file and leaves every spec alone.
 */

import type {
  ConfigurationState,
  ConnectionKind,
  ConnectionState,
  ConnectionStatus,
  HostApi,
  InstanceState,
  UserConfigurationState,
} from "@prismatic-io/solis-core/protocol";
import type {
  Client,
  ConfigurationConnections,
  ConfigurationConnectionsResource,
  ConfigurationResource,
  ConnectionResource,
  InstanceResource,
  ListItem,
  MarketplaceIntegration,
  MarketplaceIntegrationResource,
} from "@prismatic-io/solis-core";
import { waitFor } from "@testing-library/react";
import {
  type ReactNode,
  StrictMode,
  useEffect,
  useSyncExternalStore,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  PrismaticProvider,
  useConfiguration,
  useConnection,
  useConnections,
  useInstance,
  useInstances,
  useMarketplace,
  useMarketplaceFilterOptions,
  useMarketplaceIntegration,
  usePrismatic,
  usePrismaticClient,
  useServerFunction,
  useUserConfiguration,
} from "../../index.js";
import type {
  Adapter,
  CarriedInstanceTarget,
  ConfigurationFacts,
  ConnectionFacts,
  ConnectionOptionsFacts,
  Failure,
  InstanceFacts,
  ListFilter,
  ListingFacts,
  ListKind,
  ListTarget,
  ListView,
  Outcome,
  PersonalConfigurationFacts,
  ResourceKind,
  ResourceTarget,
  ResourceView,
  Target,
} from "./types.js";

type Input = Record<string, unknown>;
type Invoke = (input: Input) => Promise<Outcome>;

interface PublishedItem {
  view: ResourceView<unknown>;
  invoke: Record<string, Invoke>;
}

interface Published {
  view: ResourceView<unknown> | ListView<unknown>;
  invoke: Record<string, Invoke>;
  busy: string[];
  /** A list's items, by id, each with the actions it carries. */
  items?: Record<string, PublishedItem>;
  /** Current action snapshots, so an invoke can wait for the render its result caused. */
  actions?: Record<string, unknown>;
}

interface ReaderSpec {
  key: string;
  /** A carried instance is read through its listing's screen. */
  target: Exclude<Target, CarriedInstanceTarget>;
  /** A screen holding one server function of the target's configuration. */
  serverFunction?: string;
  /** That screen is handed a copy of the configuration rather than the one read. */
  copied?: boolean;
}

interface HostState {
  token: string;
  renders: number;
  readers: readonly ReaderSpec[];
}

const WAIT = { timeout: 3000, interval: 5 };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const toFailure = (error: unknown): Failure => {
  const e = (error ?? {}) as Partial<Failure>;
  return {
    code: e.code ?? "PRISMATIC_UNKNOWN",
    message: e.message ?? String(error),
    ...(e.fields ? { fields: e.fields } : {}),
  };
};

const toOutcome = (result: {
  status: "success" | "error";
  data?: unknown;
  error?: unknown;
}): Outcome =>
  result.status === "success"
    ? { status: "success", data: result.data }
    : { status: "error", error: toFailure(result.error) };

const stableJson = (value: unknown) =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)),
        )
      : v,
  );

/** A list item addresses the list that holds it; a carried instance, its listing. */
const keyOf = (target: Target): string =>
  "listing" in target
    ? `listing ${target.listing}`
    : "list" in target
      ? `${target.list} ${stableJson(target.filter ?? {})}`
      : `${target.kind} ${target.id ?? "none"}${target.version ? ` @${target.version}` : ""}`;

const listingFacts = (state: MarketplaceIntegration): ListingFacts => ({
  id: state.id,
  name: state.name,
  category: state.category,
  labels: state.labels,
  canActivate: state.permissions.createInstance.allowed,
  activationBlockedBy: state.permissions.createInstance.reason ?? null,
  instances: state.instances.flatMap((instance) =>
    instance.status === "success" ? [instanceFacts(instance.data)] : [],
  ),
  instancesUnavailable: state.instancesError !== null,
  configurationExperience: state.configurationExperience,
});

const instanceFacts = (state: InstanceState): InstanceFacts => ({
  id: state.id,
  name: state.name,
  integrationId: state.integrationId,
  versionNumber: state.integrationVersionNumber,
  deployed: state.deployed,
  enabled: state.enabled,
  needsDeploy: state.needsDeploy,
  lifecycle: state.lifecycle,
  flows: state.flows.map(({ id, name, apiKeys }) => ({ id, name, apiKeys })),
  configuration: {
    value: state.configuration.value,
    version: state.configuration.configurationVersion,
  },
  personalConfiguration: state.userConfiguration && {
    saved: state.userConfiguration.configured,
    value: state.userConfiguration.value,
  },
  update: state.update && {
    to: state.update.integrationVersionId,
    versionNumber: state.update.versionNumber,
    needsReview: state.update.requiresReconfiguration,
  },
  blockedBy: {
    deploy: state.permissions.deploy.reason ?? null,
    upgrade: state.permissions.upgrade.reason ?? null,
    pause: state.permissions.pause.reason ?? null,
    resume: state.permissions.resume.reason ?? null,
    remove: state.permissions.remove.reason ?? null,
    rename: state.permissions.updateDetails.reason ?? null,
  },
});

const configurationFacts = (state: ConfigurationState): ConfigurationFacts => ({
  instanceId: state.instanceId,
  integrationId: state.integrationId,
  integrationName: state.integrationName,
  versionNumber: state.versionNumber,
  isUpgrade: state.isUpgrade,
  configurationExperience: state.configurationExperience,
  deployedVersion: state.deployedVersion,
  needsDeploy: state.needsDeploy,
  serverFunctions: state.serverFunctions.map(({ key }) => key),
});

const personalFacts = (
  state: UserConfigurationState,
): PersonalConfigurationFacts => ({
  integrationId: state.integrationId,
  saved: state.configured,
  value: state.value,
});

const connectionFacts = (state: ConnectionState): ConnectionFacts => ({
  id: state.id,
  label: state.label,
  kind: state.kind,
  status: state.status,
  blockedBy: {
    connect: state.permissions.connect.reason ?? null,
    disconnect: state.permissions.disconnect.reason ?? null,
  },
});

const optionsFacts = (
  connections: ConfigurationConnections,
): ConnectionOptionsFacts => {
  const requirements = (
    needed: ConfigurationConnections["init"],
  ): ConnectionOptionsFacts["init"] =>
    needed.map(({ key, options, permissions }) => ({
      key,
      options: options.map(({ id }) => id),
      createBlockedBy: permissions.createConnection.reason ?? null,
    }));
  return {
    init: requirements(connections.init),
    serverFunctions: Object.fromEntries(
      Object.entries(connections.serverFunctions).map(([key, needed]) => [
        key,
        requirements(needed),
      ]),
    ),
  };
};

type AnyResource<T> =
  | { status: "loading" }
  | { status: "error"; error: unknown; isRefreshing: boolean }
  | { status: "success"; data: T; isRefreshing: boolean };

const resourceView = <T, F>(
  resource: AnyResource<T>,
  facts: (data: T) => F,
): ResourceView<F> => {
  if (resource.status === "loading") return { status: "loading" };
  if (resource.status === "error")
    return {
      status: "error",
      error: toFailure(resource.error),
      refreshing: resource.isRefreshing,
    };
  return {
    status: "ready",
    data: facts(resource.data),
    refreshing: resource.isRefreshing,
  };
};

const isLoading = (status: string) =>
  status === "loading" || status === "pending";

class Controller {
  #state: HostState;
  #listeners = new Set<() => void>();
  published = new Map<string, Published>();
  /** The pending connect on each screen, so the user can cancel it there. */
  connecting = new Map<string, AbortController>();
  client: Client | null = null;
  authenticated = false;

  constructor(token: string) {
    this.#state = { token, renders: 0, readers: [] };
  }

  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getState = () => this.#state;

  update(change: Partial<HostState>) {
    this.#state = { ...this.#state, ...change };
    for (const listener of this.#listeners) listener();
  }

  mount(spec: ReaderSpec) {
    if (this.#state.readers.some(({ key }) => key === spec.key)) return;
    this.update({ readers: [...this.#state.readers, spec] });
  }

  publish(key: string, published: Published) {
    this.published.set(key, published);
  }

  unpublish(key: string) {
    this.published.delete(key);
  }
}

const usePublish = (
  controller: Controller,
  key: string,
  published: Published,
) => {
  useEffect(() => {
    controller.publish(key, published);
    return () => controller.unpublish(key);
  });
};

interface ReaderProps {
  controller: Controller;
  spec: ReaderSpec;
}

const resourceIdOf = (spec: ReaderSpec) => (spec.target as ResourceTarget).id;
const versionOf = (spec: ReaderSpec) => (spec.target as ResourceTarget).version;
const filterOf = (spec: ReaderSpec): ListFilter =>
  (spec.target as ListTarget).filter ?? {};

const busyOf = <T extends Record<keyof T, { status: string }>>(
  key: string,
  statuses: T,
): string[] =>
  Object.entries<{ status: string }>(statuses)
    .filter(([, action]) => isLoading(action.status))
    .map(([name]) => `${key} ${name}`);

const ListingReader = ({ controller, spec }: ReaderProps) => {
  const resource = useMarketplaceIntegration(resourceIdOf(spec));
  const invokers = listingInvokers(resource.actions);
  const carried = (
    resource.status === "success" ? resource.data.instances : []
  ).map((instance) => ({
    instance,
    invokers: instanceInvokers(instance.actions),
  }));
  const carriedAction = (id: string, name: string) => () =>
    controller.published.get(spec.key)?.actions?.[`${id} ${name}`] as
      | ActionSnapshot
      | undefined;
  usePublish(controller, spec.key, {
    view: resourceView(resource, listingFacts),
    invoke: Object.fromEntries(
      Object.entries(invokers).map(([name, { run }]) => [
        name,
        async (input: Input) => toOutcome(await run(input)),
      ]),
    ),
    items: Object.fromEntries(
      carried.map(({ instance, invokers }) => [
        instance.id,
        {
          view: resourceView(instance, instanceFacts),
          invoke: Object.fromEntries(
            Object.entries(invokers).map(([name, { run }]) => [
              name,
              (input: Input) =>
                settledAction(carriedAction(instance.id, name), () =>
                  run(input),
                )(input),
            ]),
          ),
        },
      ]),
    ),
    actions: Object.fromEntries(
      carried.flatMap(({ instance, invokers }) =>
        Object.entries(invokers).map(([name, { action }]) => [
          `${instance.id} ${name}`,
          action,
        ]),
      ),
    ),
    busy: [
      ...busyOf(spec.key, resource.actions),
      ...carried.flatMap(({ instance }) =>
        busyOf(`${spec.key} ${instance.id}`, instance.actions),
      ),
    ],
  });
  return null;
};

type ActionResult = {
  status: "success" | "error";
  data?: unknown;
  error?: unknown;
};

/** One spec action on an item or resource: the handle whose status it moves, and the run. */
interface Invoker {
  action: ActionSnapshot;
  run: (input: Input) => Promise<ActionResult>;
}

const listingInvokers = (
  actions: MarketplaceIntegrationResource["actions"],
): Record<string, Invoker> => ({
  activate: {
    action: actions.createInstance,
    run: async ({ name }) => {
      const result = await actions.createInstance.execute({
        name: String(name),
      });
      return result.status === "success"
        ? { status: "success", data: instanceFacts(result.data) }
        : result;
    },
  },
  refresh: { action: actions.refresh, run: () => actions.refresh.execute() },
});

const instanceInvokers = (
  actions: InstanceResource["actions"],
): Record<string, Invoker> => ({
  deploy: { action: actions.deploy, run: () => actions.deploy.execute() },
  upgrade: { action: actions.upgrade, run: () => actions.upgrade.execute() },
  pause: { action: actions.pause, run: () => actions.pause.execute() },
  resume: { action: actions.resume, run: () => actions.resume.execute() },
  remove: { action: actions.remove, run: () => actions.remove.execute() },
  rename: {
    action: actions.updateDetails,
    run: ({ name }) => actions.updateDetails.execute({ name: String(name) }),
  },
  setFlowApiKeys: {
    action: actions.updateDetails,
    run: ({ flowId, apiKeys }) =>
      actions.updateDetails.execute({
        flows: [
          { flowId: String(flowId), apiKeys: apiKeys as readonly string[] },
        ],
      }),
  },
  refresh: { action: actions.refresh, run: () => actions.refresh.execute() },
});

const InstanceReader = ({ controller, spec }: ReaderProps) => {
  const resource = useInstance(resourceIdOf(spec));
  const { actions } = resource;
  usePublish(controller, spec.key, {
    view: resourceView(resource, instanceFacts),
    invoke: Object.fromEntries(
      Object.entries(instanceInvokers(actions)).map(([name, { run }]) => [
        name,
        async (input: Input) => toOutcome(await run(input)),
      ]),
    ),
    busy: busyOf(spec.key, actions),
  });
  return null;
};

const useConfigurationOf = (spec: ReaderSpec) =>
  useConfiguration({
    instanceId: resourceIdOf(spec),
    integrationVersionId: versionOf(spec),
  });

const ConfigurationReader = ({ controller, spec }: ReaderProps) => {
  const resource = useConfigurationOf(spec);
  const { actions } = resource;
  usePublish(controller, spec.key, {
    view: resourceView(resource, configurationFacts),
    invoke: {
      init: async ({ connections }) =>
        toOutcome(
          await actions.init.execute(
            connections
              ? { connections: connections as { key: string; id: string }[] }
              : {},
          ),
        ),
      save: async ({ value }) =>
        toOutcome(await actions.save.execute({ value })),
      refresh: async () => toOutcome(await actions.refresh.execute()),
    },
    busy: busyOf(spec.key, actions),
  });
  return null;
};

const PersonalConfigurationReader = ({ controller, spec }: ReaderProps) => {
  const resource = useUserConfiguration(resourceIdOf(spec));
  const { actions } = resource;
  usePublish(controller, spec.key, {
    view: resourceView(resource, personalFacts),
    invoke: {
      save: async ({ value }) =>
        toOutcome(await actions.save.execute({ value })),
      remove: async () => toOutcome(await actions.remove.execute()),
      refresh: async () => toOutcome(await actions.refresh.execute()),
    },
    busy: busyOf(spec.key, actions),
  });
  return null;
};

/** One screen holding one server function of a configuration. */
const usePublishServerFunction = (
  controller: Controller,
  spec: ReaderSpec,
  configuration:
    | ConfigurationResource
    | ReturnType<typeof useUserConfiguration>,
) => {
  const fn = useServerFunction(
    spec.copied
      ? ({
          ...configuration,
          actions: { ...configuration.actions },
        } as typeof configuration)
      : configuration,
    spec.serverFunction ?? "",
  );
  usePublish(controller, spec.key, {
    view: { status: "ready", data: null, refreshing: false },
    invoke: {
      run: async ({ inputs, connections }) =>
        toOutcome(
          await fn.execute({
            inputs,
            ...(connections
              ? { connections: connections as { key: string; id: string }[] }
              : {}),
          }),
        ),
    },
    busy: busyOf(spec.key, { serverFunction: fn }),
  });
};

const ConfigurationFunctionCaller = ({ controller, spec }: ReaderProps) => {
  usePublishServerFunction(controller, spec, useConfigurationOf(spec));
  return null;
};

const PersonalFunctionCaller = ({ controller, spec }: ReaderProps) => {
  usePublishServerFunction(
    controller,
    spec,
    useUserConfiguration(resourceIdOf(spec)),
  );
  return null;
};

const connectionInvokers = (
  actions: ConnectionResource["actions"],
  signal?: () => AbortSignal,
): Record<string, Invoker> => ({
  connect: {
    action: actions.connect,
    run: async ({ timeoutMs }) => {
      const result = await actions.connect.execute({
        ...(typeof timeoutMs === "number" ? { timeoutMs } : {}),
        ...(signal ? { signal: signal() } : {}),
      });
      return result.status === "success"
        ? { status: "success", data: connectionFacts(result.data) }
        : result;
    },
  },
  disconnect: {
    action: actions.disconnect,
    run: async () => {
      const result = await actions.disconnect.execute();
      return result.status === "success"
        ? { status: "success", data: connectionFacts(result.data) }
        : result;
    },
  },
  refresh: { action: actions.refresh, run: () => actions.refresh.execute() },
});

const ConnectionReader = ({ controller, spec }: ReaderProps) => {
  const resource = useConnection(resourceIdOf(spec));
  const invokers = connectionInvokers(resource.actions, () => {
    const pending = new AbortController();
    controller.connecting.set(spec.key, pending);
    return pending.signal;
  });
  usePublish(controller, spec.key, {
    view: resourceView(resource, connectionFacts),
    invoke: {
      ...Object.fromEntries(
        Object.entries(invokers).map(([name, { run }]) => [
          name,
          async (input: Input) => toOutcome(await run(input)),
        ]),
      ),
      cancelConnect: async () => {
        controller.connecting.get(spec.key)?.abort();
        return { status: "success", data: null };
      },
    },
    busy: busyOf(spec.key, resource.actions),
  });
  return null;
};

const LOADING_CONNECTIONS: ConfigurationConnectionsResource = {
  status: "loading",
  actions: {
    refresh: {
      status: "idle",
      execute: async () => ({
        status: "error",
        error: Object.assign(new Error("Configuration is not loaded."), {
          code: "PRISMATIC_CONFIGURATION_UNAVAILABLE" as const,
        }),
      }),
    },
  },
};

const usePublishConnections = (
  controller: Controller,
  spec: ReaderSpec,
  configuration: {
    status: string;
    data?: { connections: ConfigurationConnectionsResource };
  },
) => {
  const connections =
    configuration.status === "success" && configuration.data
      ? configuration.data.connections
      : LOADING_CONNECTIONS;
  const requirements =
    connections.status === "success"
      ? [
          ...connections.data.init,
          ...Object.values(connections.data.serverFunctions).flat(),
        ]
      : [];
  usePublish(controller, spec.key, {
    view: resourceView(connections, optionsFacts),
    invoke: {
      refresh: async () =>
        toOutcome(await connections.actions.refresh.execute()),
      createConnection: async ({ requirement, label }) => {
        const needed = requirements.find(({ key }) => key === requirement);
        if (!needed) throw new Error(`Nothing needs ${String(requirement)}`);
        const result = await needed.actions.createConnection.execute(
          typeof label === "string" ? { label } : {},
        );
        return toOutcome(
          result.status === "success"
            ? { status: "success", data: connectionFacts(result.data) }
            : result,
        );
      },
    },
    busy: [
      ...busyOf(spec.key, connections.actions),
      ...requirements.flatMap(({ key, actions }) =>
        busyOf(`${spec.key} ${key}`, actions),
      ),
    ],
  });
};

const ConnectionOptionsReader = ({ controller, spec }: ReaderProps) => {
  usePublishConnections(controller, spec, useConfigurationOf(spec));
  return null;
};

const PersonalConnectionOptionsReader = ({ controller, spec }: ReaderProps) => {
  usePublishConnections(
    controller,
    spec,
    useUserConfiguration(resourceIdOf(spec)),
  );
  return null;
};

interface ActionSnapshot {
  status: string;
}

/**
 * Runs an action and waits for the render its result caused, so the next read sees what the
 * action did. A refusal changes nothing, so there is no render to wait for.
 */
const settledAction =
  (
    locate: () => ActionSnapshot | undefined,
    run: () => Promise<{
      status: "success" | "error";
      data?: unknown;
      error?: unknown;
    }>,
  ): Invoke =>
  async () => {
    const before = locate();
    const outcome = toOutcome(await run());
    if (
      outcome.status === "error" &&
      /ACTION_BUSY|ACTION_DISPOSED/.test(outcome.error.code)
    )
      return outcome;
    await waitFor(() => {
      const now = locate();
      if (now === before || (now && isLoading(now.status)))
        throw new Error("the action's result has not rendered");
    }, WAIT);
    return outcome;
  };

const listResourceView = <T, F>(
  resource:
    | { status: "loading" }
    | { status: "error"; error: unknown; isRefreshing: boolean }
    | {
        status: "success";
        data: {
          items: readonly AnyResource<T>[];
          pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean };
        };
        isRefreshing: boolean;
      },
  row: (item: T) => F,
): ListView<F> => {
  if (resource.status === "loading")
    return {
      status: "loading",
      rows: [],
      hasMore: false,
      hasPrevious: false,
      refreshing: false,
    };
  if (resource.status === "error")
    return {
      status: "error",
      rows: [],
      error: toFailure(resource.error),
      hasMore: false,
      hasPrevious: false,
      refreshing: resource.isRefreshing,
    };
  const { items, pageInfo } = resource.data;
  return {
    status: "ready",
    rows: items.flatMap((item) =>
      item.status === "success" ? [row(item.data)] : [],
    ),
    hasMore: pageInfo.hasNextPage,
    hasPrevious: pageInfo.hasPreviousPage,
    refreshing: resource.isRefreshing,
  };
};

interface ListItemLike {
  id: string;
  status: string;
  actions: { refresh: ActionSnapshot & { execute: () => Promise<unknown> } };
}

const refreshInvoker = (item: ListItemLike): Record<string, Invoker> => ({
  refresh: {
    action: item.actions.refresh,
    run: () => item.actions.refresh.execute() as Promise<ActionResult>,
  },
});

/** Publishes a ListResource: its view, paging, and each item with the actions it carries. */
const usePublishList = <T, F, I extends ListItemLike = ListItemLike>(
  controller: Controller,
  spec: ReaderSpec,
  list: Parameters<typeof listResourceView<T, F>>[0] & {
    actions: Record<
      "refresh" | "loadNextPage" | "loadPreviousPage",
      ActionSnapshot & {
        execute: () => Promise<{
          status: "success" | "error";
          data?: unknown;
          error?: unknown;
        }>;
      }
    >;
  },
  facts: (data: T) => F,
  itemInvokers: (item: I) => Record<string, Invoker> = refreshInvoker,
) => {
  const { actions } = list;
  const items = (list.status === "success"
    ? list.data.items
    : []) as unknown as (AnyResource<T> & I)[];
  const invokers = items.map((item) => ({
    item,
    invokers: itemInvokers(item),
  }));
  const published = () => controller.published.get(spec.key);
  const listAction = (name: string) => () =>
    published()?.actions?.[name] as ActionSnapshot | undefined;
  const itemAction = (id: string, name: string) => () =>
    published()?.actions?.[`${id} ${name}`] as ActionSnapshot | undefined;
  usePublish(controller, spec.key, {
    view: listResourceView(list, facts),
    invoke: {
      refresh: settledAction(listAction("refresh"), () =>
        actions.refresh.execute(),
      ),
      nextPage: settledAction(listAction("nextPage"), () =>
        actions.loadNextPage.execute(),
      ),
      previousPage: settledAction(listAction("previousPage"), () =>
        actions.loadPreviousPage.execute(),
      ),
    },
    items: Object.fromEntries(
      invokers.map(({ item, invokers }) => [
        item.id,
        {
          view: resourceView(item, facts),
          invoke: Object.fromEntries(
            Object.entries(invokers).map(([name, { run }]) => [
              name,
              (input: Input) =>
                settledAction(itemAction(item.id, name), () => run(input))(
                  input,
                ),
            ]),
          ),
        },
      ]),
    ),
    actions: {
      refresh: actions.refresh,
      nextPage: actions.loadNextPage,
      previousPage: actions.loadPreviousPage,
      ...Object.fromEntries(
        invokers.flatMap(({ item, invokers }) =>
          Object.entries(invokers).map(([name, { action }]) => [
            `${item.id} ${name}`,
            action,
          ]),
        ),
      ),
    },
    busy: [
      ...busyOf(spec.key, {
        refresh: actions.refresh,
        nextPage: actions.loadNextPage,
        previousPage: actions.loadPreviousPage,
      }),
      ...items.flatMap((item) =>
        busyOf(`${spec.key} ${item.id}`, item.actions),
      ),
    ],
  });
};

const MarketplaceReader = ({ controller, spec }: ReaderProps) => {
  const {
    integrationId: _integrationId,
    kind: _kind,
    status: _status,
    ...filter
  } = filterOf(spec);
  usePublishList(
    controller,
    spec,
    useMarketplace(filter),
    listingFacts,
    (item: ListItem<MarketplaceIntegrationResource>) =>
      listingInvokers(item.actions),
  );
  return null;
};

const InstancesReader = ({ controller, spec }: ReaderProps) => {
  const { integrationId, pageSize, onPageLoad } = filterOf(spec);
  usePublishList(
    controller,
    spec,
    useInstances({
      ...(integrationId ? { integrationId } : {}),
      ...(pageSize ? { pageSize } : {}),
      ...(onPageLoad ? { onPageLoad } : {}),
    }),
    instanceFacts,
    (item: ListItem<InstanceResource>) => instanceInvokers(item.actions),
  );
  return null;
};

const ConnectionsReader = ({ controller, spec }: ReaderProps) => {
  const { kind, status, pageSize, onPageLoad } = filterOf(spec);
  usePublishList(
    controller,
    spec,
    useConnections({
      ...(kind ? { kind: kind as ConnectionKind } : {}),
      ...(status ? { status: status as ConnectionStatus } : {}),
      ...(pageSize ? { pageSize } : {}),
      ...(onPageLoad ? { onPageLoad } : {}),
    }),
    connectionFacts,
    (item: ListItem<ConnectionResource>) => connectionInvokers(item.actions),
  );
  return null;
};

const resourceListView = <T,>(
  resource: AnyResource<readonly T[]>,
): ListView<T> => {
  if (resource.status === "loading")
    return {
      status: "loading",
      rows: [],
      hasMore: false,
      hasPrevious: false,
      refreshing: false,
    };
  if (resource.status === "error")
    return {
      status: "error",
      rows: [],
      error: toFailure(resource.error),
      hasMore: false,
      hasPrevious: false,
      refreshing: resource.isRefreshing,
    };
  return {
    status: "ready",
    rows: [...resource.data],
    hasMore: false,
    hasPrevious: false,
    refreshing: resource.isRefreshing,
  };
};

const filterOptionReader =
  (field: "categories" | "labels") =>
  ({ controller, spec }: ReaderProps) => {
    const options = useMarketplaceFilterOptions();
    usePublish(controller, spec.key, {
      view: resourceListView(
        options.status === "success"
          ? { ...options, data: options.data[field] }
          : options,
      ),
      invoke: {
        refresh: async () => toOutcome(await options.actions.refresh.execute()),
      },
      busy: busyOf(spec.key, options.actions),
    });
    return null;
  };

const CategoriesReader = filterOptionReader("categories");

const LabelsReader = filterOptionReader("labels");

const RESOURCE_READERS: Record<
  ResourceKind,
  (props: ReaderProps) => ReactNode
> = {
  listing: ListingReader,
  instance: InstanceReader,
  configuration: ConfigurationReader,
  personalConfiguration: PersonalConfigurationReader,
  connection: ConnectionReader,
  connectionOptions: ConnectionOptionsReader,
  personalConnectionOptions: PersonalConnectionOptionsReader,
};

const LIST_READERS: Record<ListKind, (props: ReaderProps) => ReactNode> = {
  marketplace: MarketplaceReader,
  instances: InstancesReader,
  connections: ConnectionsReader,
  categories: CategoriesReader,
  labels: LabelsReader,
};

const Reader = (props: ReaderProps) => {
  const { target, serverFunction } = props.spec;
  const Component =
    "list" in target
      ? LIST_READERS[target.list]
      : serverFunction !== undefined
        ? target.kind === "personalConfiguration"
          ? PersonalFunctionCaller
          : ConfigurationFunctionCaller
        : RESOURCE_READERS[target.kind];
  return <Component {...props} />;
};

const Session = ({ controller }: { controller: Controller }) => {
  const session = usePrismatic();
  const client = usePrismaticClient();
  useEffect(() => {
    controller.client = client;
    controller.authenticated =
      session.status === "success" && !session.isRefreshing;
  });
  return null;
};

const Host = ({
  controller,
  origin,
  host,
}: {
  controller: Controller;
  origin: string;
  host: HostApi | undefined;
}) => {
  const { token, readers } = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
  );
  return (
    // A fresh `auth` literal every render, as a host would naturally write it.
    <PrismaticProvider
      prismaticUrl={origin}
      auth={{ token }}
      resourceIdleMs={0}
      {...(host ? { host } : {})}
    >
      <Session controller={controller} />
      {readers.map((spec) => (
        <Reader key={spec.key} controller={controller} spec={spec} />
      ))}
    </PrismaticProvider>
  );
};

/** Boots the app under StrictMode, always: every spec gets its doubled effects. */
export const createAdapter = async ({
  origin,
  token,
  host,
}: {
  origin: string;
  token: string;
  /** Capabilities the host grants the frame, such as opening URLs itself. */
  host?: HostApi;
}): Promise<Adapter> => {
  // Updates land outside `act`, as they do in a browser; specs wait on outcomes instead.
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = false;
  const controller = new Controller(token);
  const container = document.createElement("div");
  document.body.append(container);
  const root: Root = createRoot(container);
  root.render(
    <StrictMode>
      <Host controller={controller} origin={origin} host={host} />
    </StrictMode>,
  );
  const waitForAuthentication = () =>
    waitFor(() => {
      if (!controller.authenticated || !controller.client)
        throw new Error("the session has not authenticated");
    }, WAIT);
  await waitForAuthentication();

  const reader = async (spec: ReaderSpec): Promise<Published> => {
    controller.mount(spec);
    return waitFor(() => {
      const published = controller.published.get(spec.key);
      if (!published) throw new Error(`${spec.key} has not rendered`);
      return published;
    }, WAIT);
  };

  const settled = async (key: string, id: string | null) => {
    // Nothing to wait for on a null id: it stays loading by design.
    if (id === null) {
      await sleep(30);
      return controller.published.get(key)?.view;
    }
    return waitFor(() => {
      const view = controller.published.get(key)?.view;
      if (!view || view.status === "loading")
        throw new Error(`${key} is still loading`);
      return view;
    }, WAIT);
  };

  let calls = 0;
  const invoke = async (
    target: Target,
    action: string,
    input: Input = {},
  ): Promise<Outcome> => {
    const key = keyOf(target);
    if ("listing" in target) {
      const listing: ResourceTarget = { kind: "listing", id: target.listing };
      await reader({ key, target: listing });
      await settled(key, target.listing);
      const run =
        controller.published.get(key)?.items?.[target.instance]?.invoke[action];
      if (!run)
        throw new Error(`${key} carries no ${target.instance} with ${action}`);
      return run(input);
    }
    if ("item" in target) {
      const { item, ...list } = target;
      await reader({ key, target: list });
      await settled(key, "list");
      const run = controller.published.get(key)?.items?.[item]?.invoke[action];
      if (!run) throw new Error(`${key} has no item ${item} with ${action}`);
      return run(input);
    }
    if ("list" in target) {
      await reader({ key, target });
      await settled(key, "list");
    } else {
      await reader({ key, target });
      await settled(key, target.id);
    }
    if (action === "serverFunction") {
      const { key: functionKey, caller, copied, ...run } = input;
      const callerKey = `${key} serverFunction ${String(functionKey)} ${
        caller === undefined ? `call ${++calls}` : String(caller)
      }`;
      const screen = await reader({
        key: callerKey,
        target,
        serverFunction: String(functionKey),
        ...(copied ? { copied: true } : {}),
      });
      const execute = screen.invoke.run;
      if (!execute) throw new Error(`${callerKey} cannot run`);
      return execute(run);
    }
    const run = controller.published.get(key)?.invoke[action];
    if (!run) throw new Error(`${key} has no action ${action}`);
    return run(input);
  };

  return {
    readResource: async (kind, id, scope) => {
      const target: ResourceTarget = {
        kind,
        id,
        ...(scope?.version ? { version: scope.version } : {}),
      };
      const key = keyOf(target);
      await reader({ key, target });
      return (await settled(key, id)) as never;
    },
    readList: async (kind, filter) => {
      const target: ListTarget = { list: kind, filter };
      const key = keyOf(target);
      await reader({ key, target });
      return (await settled(key, "list")) as never;
    },
    readListItem: async (kind, filter, id) => {
      const target: ListTarget = { list: kind, filter };
      const key = keyOf(target);
      await reader({ key, target });
      await settled(key, "list");
      return controller.published.get(key)?.items?.[id]?.view as never;
    },
    execute: invoke,
    refresh: (target) => invoke(target, "refresh"),
    unmount: async () => {
      controller.update({ readers: [] });
      await waitFor(() => {
        if (controller.published.size)
          throw new Error("screens are still mounted");
      }, WAIT);
    },
    signInAs: async (next) => {
      controller.authenticated = false;
      controller.update({ token: next });
      await waitForAuthentication();
    },
    rerender: async () => {
      controller.update({ renders: controller.getState().renders + 1 });
      await sleep(0);
    },
    busyActions: () =>
      [...controller.published.values()].flatMap(({ busy }) => busy),
    transport: () => {
      if (!controller.client) throw new Error("The session never booted.");
      const { imports, exports } = controller.client.stats();
      return { imports, exports };
    },
    close: () => {
      root.unmount();
      container.remove();
    },
  };
};
