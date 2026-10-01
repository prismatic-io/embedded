/**
 * The fake's own reading of instance and connection state. Written apart from the frame's
 * derivation so the scenario corpus compares two implementations rather than one.
 */

import type {
  ConfigurationPermissionReason,
  ConnectionPermissionReason,
  ConnectionPermissions,
  ConnectionStatus,
  InstanceLifecycle,
  InstancePermissions,
  InstanceState,
  InstanceUpdate,
  Permission,
} from "../protocol/index.js";

type Check<TReason extends string> = readonly [
  passes: boolean,
  reason: TReason,
];

/** The first failing check denies; with none failing, the action is allowed. */
const firstDenial = <TReason extends string>(
  ...checks: Check<TReason>[]
): Permission<TReason> => {
  const failed = checks.find(([passes]) => !passes);
  return failed
    ? { allowed: false, reason: failed[1] }
    : { allowed: true, reason: null };
};

export const fakeLifecycle = ({
  deployed,
  enabled,
  needsDeploy,
  configState,
}: Pick<
  InstanceState,
  "deployed" | "enabled" | "needsDeploy" | "configState"
>): InstanceLifecycle => {
  const readings: [applies: boolean, lifecycle: InstanceLifecycle][] = [
    [!deployed, "notDeployed"],
    [configState === "NEEDS_INSTANCE_CONFIGURATION", "needsReconfiguration"],
    [
      configState === "NEEDS_USER_LEVEL_CONFIGURATION",
      "needsUserConfiguration",
    ],
    [!enabled, "paused"],
    [needsDeploy, "pendingChanges"],
  ];
  return readings.find(([applies]) => applies)?.[1] ?? "active";
};

export const fakeUpdate = ({
  currentVersionId,
  currentConfigurationVersion,
  target,
}: {
  currentVersionId: string;
  currentConfigurationVersion: string | null;
  target: {
    integrationVersionId: string;
    versionNumber: number;
    configurationVersion: string | null;
  } | null;
}): InstanceUpdate | null => {
  if (!target || target.integrationVersionId === currentVersionId) return null;
  const { configurationVersion, ...version } = target;
  return {
    ...version,
    requiresReconfiguration:
      configurationVersion !== currentConfigurationVersion,
  };
};

export const fakeInstancePermissions = ({
  allowUpdate,
  allowDeploy,
  allowRemove,
  roleWritable,
  customerUpgradeable,
  update,
  deployed,
  enabled,
}: {
  allowUpdate: boolean;
  allowDeploy: boolean;
  allowRemove: boolean;
  roleWritable: boolean;
  customerUpgradeable: boolean;
  update: InstanceUpdate | null;
  deployed: boolean;
  enabled: boolean;
}): InstancePermissions => {
  type Reason = ConfigurationPermissionReason;
  const canWrite: Check<Reason> = [
    roleWritable && allowUpdate,
    "role-restricted",
  ];
  const isDeployed: Check<Reason> = [deployed, "not-deployed"];
  return {
    updateDetails: firstDenial<Reason>([allowUpdate, "role-restricted"]),
    deploy: firstDenial<Reason>([
      roleWritable && allowDeploy,
      "role-restricted",
    ]),
    upgrade: firstDenial<Reason>(
      [update !== null, "no-update"],
      canWrite,
      [customerUpgradeable, "role-restricted"],
      [!update?.requiresReconfiguration, "requires-reconfiguration"],
    ),
    pause: firstDenial<Reason>(canWrite, isDeployed, [
      enabled,
      "already-paused",
    ]),
    resume: firstDenial<Reason>(canWrite, isDeployed, [!enabled, "not-paused"]),
    remove: firstDenial<Reason>([
      roleWritable && allowRemove,
      "role-restricted",
    ]),
  };
};

export const fakeConnectionPermissions = ({
  oauth2Type,
  status,
  writable,
}: {
  oauth2Type: string | null;
  status: ConnectionStatus;
  writable: boolean;
}): ConnectionPermissions => {
  type Reason = ConnectionPermissionReason;
  const isOAuth: Check<Reason> = [oauth2Type !== null, "NOT_OAUTH"];
  const canWrite: Check<Reason> = [writable, "ROLE_RESTRICTED"];
  return {
    connect: firstDenial<Reason>(
      isOAuth,
      canWrite,
      [!/^client_credentials$/i.test(oauth2Type ?? ""), "CLIENT_CREDENTIALS"],
      [status !== "ACTIVE", "ALREADY_CONNECTED"],
    ),
    disconnect: firstDenial<Reason>(isOAuth, canWrite, [
      status !== "PENDING",
      "NOT_CONNECTED",
    ]),
  };
};
