import { ConfigVar } from "./configVars";

export interface WorkflowConfigurationData {
  customerId: string;
  customerName: string;
  instanceId: string;
  instanceName: string;
  workflowVersionId: string | null;
}

export interface InstanceConfigurationData {
  customerId: string;
  customerName: string;
  instanceId: string;
  instanceName: string;
  integrationName: string;
  integrationVersionNumber: number;
  readOnly: boolean;
}

export interface InstanceConfigurationLoadedData
  extends InstanceConfigurationData {
  configVars: Record<string, ConfigVar>;
}

export interface InstanceConfigurationPageLoadedData
  extends InstanceConfigurationLoadedData {
  pageName: string;
  pageContent: Record<string, unknown>;
}

export interface UserConfigurationData extends InstanceConfigurationData {
  userConfigId: string | undefined;
  userEmail: string;
  userId: string;
  userLevelConfigVariables: Record<string, ConfigVar>;
  userName: string;
}

export interface UserConfigurationPageData extends UserConfigurationData {
  pageName: string;
  pageContent: Record<string, unknown>;
}

export enum PrismaticMessageEvent {
  INSTANCE_CONFIGURATION_CLOSED = "INSTANCE_CONFIGURATION_CLOSED",
  INSTANCE_CONFIGURATION_LOADED = "INSTANCE_CONFIGURATION_LOADED",
  INSTANCE_CONFIGURATION_PAGE_LOADED = "INSTANCE_CONFIGURATION_PAGE_LOADED",
  INSTANCE_CONFIGURATION_OPENED = "INSTANCE_CONFIGURATION_OPENED",
  INSTANCE_CREATED = "INSTANCE_CREATED",
  INSTANCE_DELETED = "INSTANCE_DELETED",
  INSTANCE_DEPLOYED = "INSTANCE_DEPLOYED",
  MARKETPLACE_CLOSED = "MARKETPLACE_CLOSED",
  POPOVER_CLOSE_REQUESTED = "POPOVER_CLOSE_REQUESTED",
  POPOVER_CLOSED = "POPOVER_CLOSED",
  SET_CONFIG_VAR = "SET_CONFIG_VAR",
  SET_FILTERS = "SET_FILTERS",
  SET_SCREEN_CONFIGURATION = "SET_SCREEN_CONFIGURATION",
  SET_TOKEN = "SET_TOKEN",
  SET_TRANSLATION = "SET_TRANSLATION",
  SET_VERSION = "SET_VERSION",
  USER_CONFIGURATION_CLOSED = "USER_CONFIGURATION_CLOSED",
  USER_CONFIGURATION_DELETED = "USER_CONFIGURATION_DELETED",
  USER_CONFIGURATION_DEPLOYED = "USER_CONFIGURATION_DEPLOYED",
  USER_CONFIGURATION_LOADED = "USER_CONFIGURATION_LOADED",
  USER_CONFIGURATION_PAGE_LOADED = "USER_CONFIGURATION_PAGE_LOADED",
  USER_CONFIGURATION_OPENED = "USER_CONFIGURATION_OPENED",
  WORKFLOW_ENABLED = "WORKFLOW_ENABLED",
  WORKFLOW_DISABLED = "WORKFLOW_DISABLED",
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
      data: InstanceConfigurationPageLoadedData;
      event: PrismaticMessageEvent.INSTANCE_CONFIGURATION_PAGE_LOADED;
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
      data: {};
      event: PrismaticMessageEvent.POPOVER_CLOSE_REQUESTED;
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
      data: UserConfigurationPageData;
      event: PrismaticMessageEvent.USER_CONFIGURATION_PAGE_LOADED;
    }
  | {
      data: UserConfigurationData;
      event: PrismaticMessageEvent.USER_CONFIGURATION_OPENED;
    }
  | 
    {
      data: WorkflowConfigurationData;
      event: PrismaticMessageEvent.WORKFLOW_ENABLED
    } 
  | 
    {
      data: WorkflowConfigurationData;
      event: PrismaticMessageEvent.WORKFLOW_DISABLED
    };