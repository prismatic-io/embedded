import { ConfigVar } from "./configVars";

export interface InstanceConfigurationData {
  customerId: string;
  customerName: string;
  instanceId: string;
  instanceName: string;
  integrationName: string;
  integrationVersionNumber: number;
}

export interface InstanceConfigurationLoadedData
  extends InstanceConfigurationData {
  configVars: Record<string, ConfigVar>;
}

export interface UserConfigurationData extends InstanceConfigurationData {
  userConfigId: string | undefined;
  userEmail: string;
  userId: string;
  userLevelConfigVariables: Record<string, ConfigVar>;
  userName: string;
}

export enum PrismaticMessageEvent {
  INSTANCE_CONFIGURATION_CLOSED = "INSTANCE_CONFIGURATION_CLOSED",
  INSTANCE_CONFIGURATION_LOADED = "INSTANCE_CONFIGURATION_LOADED",
  INSTANCE_CONFIGURATION_OPENED = "INSTANCE_CONFIGURATION_OPENED",
  INSTANCE_CREATED = "INSTANCE_CREATED",
  INSTANCE_DELETED = "INSTANCE_DELETED",
  INSTANCE_DEPLOYED = "INSTANCE_DEPLOYED",
  MARKETPLACE_CLOSED = "MARKETPLACE_CLOSED",
  SET_CONFIG_VAR = "SET_CONFIG_VAR",
  SET_SCREEN_CONFIGURATION = "SET_SCREEN_CONFIGURATION",
  SET_TOKEN = "SET_TOKEN",
  SET_TRANSLATION = "SET_TRANSLATION",
  SET_VERSION = "SET_VERSION",
  USER_CONFIGURATION_CLOSED = "USER_CONFIGURATION_CLOSED",
  USER_CONFIGURATION_DELETED = "USER_CONFIGURATION_DELETED",
  USER_CONFIGURATION_DEPLOYED = "USER_CONFIGURATION_DEPLOYED",
  USER_CONFIGURATION_LOADED = "USER_CONFIGURATION_LOADED",
  USER_CONFIGURATION_OPENED = "USER_CONFIGURATION_OPENED",
}

export type MessageData =
  | {
      data: InstanceConfigurationData;
      event: PrismaticMessageEvent.INSTANCE_CONFIGURATION_OPENED;
    }
  | {
      data: InstanceConfigurationLoadedData;
      event: PrismaticMessageEvent.INSTANCE_CONFIGURATION_LOADED;
    }
  | {
      data: InstanceConfigurationData;
      event: PrismaticMessageEvent.INSTANCE_CONFIGURATION_CLOSED;
    }
  | {
      data: InstanceConfigurationData;
      event: PrismaticMessageEvent.INSTANCE_CREATED;
    }
  | {
      data: InstanceConfigurationData;
      event: PrismaticMessageEvent.INSTANCE_DELETED;
    }
  | {
      data: InstanceConfigurationData;
      event: PrismaticMessageEvent.INSTANCE_DEPLOYED;
    }
  | {
      data: UserConfigurationData;
      event: PrismaticMessageEvent.USER_CONFIGURATION_DELETED;
    }
  | {
      data: UserConfigurationData;
      event: PrismaticMessageEvent.USER_CONFIGURATION_DEPLOYED;
    }
  | {
      data: UserConfigurationData;
      event: PrismaticMessageEvent.USER_CONFIGURATION_CLOSED;
    }
  | {
      data: UserConfigurationData;
      event: PrismaticMessageEvent.USER_CONFIGURATION_LOADED;
    }
  | {
      data: UserConfigurationData;
      event: PrismaticMessageEvent.USER_CONFIGURATION_OPENED;
    };
