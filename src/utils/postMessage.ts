import { getIframeElement, isIframe } from "./iframe";
import { ConfigVar } from "../types/configVars";

export enum PrismaticMessageEvent {
  INSTANCE_CONFIGURATION_CLOSED = "INSTANCE_CONFIGURATION_CLOSED",
  INSTANCE_CONFIGURATION_LOADED = "INSTANCE_CONFIGURATION_LOADED",
  INSTANCE_CONFIGURATION_OPENED = "INSTANCE_CONFIGURATION_OPENED",
  INSTANCE_CREATED = "INSTANCE_CREATED",
  INSTANCE_DELETED = "INSTANCE_DELETED",
  INSTANCE_DEPLOYED = "INSTANCE_DEPLOYED",
  SET_CONFIG_VAR = "SET_CONFIG_VAR",
  SET_SCREEN_CONFIGURATION = "SET_SCREEN_CONFIGURATION",
  SET_TOKEN = "SET_TOKEN",
  SET_TRANSLATION = "SET_TRANSLATION",
  SET_VERSION = "SET_VERSION",
}

interface InstanceData {
  customerId: string;
  customerName: string;
  instanceId: string;
  instanceName: string;
  integrationName: string;
  integrationVersionNumber: number;
}

export type MessageData =
  | {
      data: InstanceData;
      event: PrismaticMessageEvent.INSTANCE_CONFIGURATION_OPENED;
    }
  | {
      data: InstanceData & { configVars: Record<string, ConfigVar> };
      event: PrismaticMessageEvent.INSTANCE_CONFIGURATION_LOADED;
    }
  | {
      data: InstanceData;
      event: PrismaticMessageEvent.INSTANCE_CONFIGURATION_CLOSED;
    }
  | {
      data: InstanceData;
      event: PrismaticMessageEvent.INSTANCE_CREATED;
    }
  | {
      data: InstanceData;
      event: PrismaticMessageEvent.INSTANCE_DELETED;
    }
  | {
      data: InstanceData;
      event: PrismaticMessageEvent.INSTANCE_DEPLOYED;
    };

interface BasePostMessageProps {
  event: unknown;
}

export interface SelectorPostMessageProps extends BasePostMessageProps {
  selector?: string;
}

export interface ElementPostMessageProps extends BasePostMessageProps {
  iframe: Element;
}

type PostMessageProps = SelectorPostMessageProps | ElementPostMessageProps;

export const getMessageIframe = (event: MessageEvent) =>
  Array.from(document.getElementsByTagName("iframe")).find(
    (iframe) => iframe.contentWindow === event.source
  );

const isIframePostMessage = (
  props: PostMessageProps
): props is ElementPostMessageProps => "iframe" in props;

export const postMessage = (props: PostMessageProps) => {
  const iframeElement = isIframePostMessage(props)
    ? props.iframe
    : getIframeElement(props.selector);

  if (!isIframe(iframeElement)) {
    return;
  }

  iframeElement.contentWindow?.postMessage(props.event, "*");
};
