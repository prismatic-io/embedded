import { ConfigVar } from "./configVars";

interface InstanceConfigurationBase {
  customerId: string;
  customerName: string;
  instanceId: string;
  instanceName: string;
  integrationName: string;
  integrationVersionNumber: number;
}

export interface InstanceConfigurationData extends InstanceConfigurationBase {
  configVars: Record<string, ConfigVar> | undefined;
}

export interface UserConfigurationData extends InstanceConfigurationBase {
  userConfigId: string | undefined;
  userEmail: string;
  userId: string;
  userLevelConfigVariables: Record<string, ConfigVar>;
  userName: string;
}

export enum PostMessageEvent {
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

/**
 * @deprecated Use PostMessageEvent instead
 */
export type PrismaticMessageEvent = PostMessageEvent;

export type PostMessage =
  | {
      data: InstanceConfigurationData;
      event: PostMessageEvent.INSTANCE_CONFIGURATION_OPENED;
    }
  | {
      data: InstanceConfigurationData;
      event: PostMessageEvent.INSTANCE_CONFIGURATION_LOADED;
    }
  | {
      data: InstanceConfigurationData;
      event: PostMessageEvent.INSTANCE_CONFIGURATION_CLOSED;
    }
  | {
      data: InstanceConfigurationData;
      event: PostMessageEvent.INSTANCE_CREATED;
    }
  | {
      data: InstanceConfigurationData;
      event: PostMessageEvent.INSTANCE_DELETED;
    }
  | {
      data: InstanceConfigurationData;
      event: PostMessageEvent.INSTANCE_DEPLOYED;
    }
  | {
      data: UserConfigurationData;
      event: PostMessageEvent.USER_CONFIGURATION_DELETED;
    }
  | {
      data: UserConfigurationData;
      event: PostMessageEvent.USER_CONFIGURATION_DEPLOYED;
    }
  | {
      data: UserConfigurationData;
      event: PostMessageEvent.USER_CONFIGURATION_CLOSED;
    }
  | {
      data: UserConfigurationData;
      event: PostMessageEvent.USER_CONFIGURATION_LOADED;
    }
  | {
      data: UserConfigurationData;
      event: PostMessageEvent.USER_CONFIGURATION_OPENED;
    };

/**
 * @deprecated Use PostMessage instead
 */
export type MessageData = PostMessage;
