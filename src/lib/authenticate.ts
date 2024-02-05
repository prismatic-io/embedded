import urlJoin from "url-join";

import { PrismaticMessageEvent } from "../types/postMessage";
import { EMBEDDED_IFRAME_ID } from "../utils/iframe";
import { assertInit } from "../utils/assertInit";
import { postMessage } from "../utils/postMessage";
import stateService from "../state";
import { graphqlRequest } from "./graphqlRequest";

const ERROR_MESSAGE =
  "The authenticate method expects an object containing a token and additional optional configuration.";
const EXPECTED_KEYS = ["token"];

export interface AuthenticateProps {
  prismaticUrl?: string;
  token: string;
}

export const authenticate = async (options: AuthenticateProps) => {
  assertInit("authenticate");

  if (!options) {
    throw new Error(ERROR_MESSAGE);
  }

  const givenProps = new Set(Object.keys(options));

  if (!EXPECTED_KEYS.every((key) => givenProps.has(key))) {
    throw new Error(ERROR_MESSAGE);
  }

  const { token } = options;

  const iframeElement = document.getElementById(
    EMBEDDED_IFRAME_ID
  ) as HTMLIFrameElement;

  const state = stateService.getStateCopy();
  if (state.jwt !== token && iframeElement) {
    postMessage({
      iframe: iframeElement,
      event: {
        event: PrismaticMessageEvent.SET_TOKEN,
        data: token,
      },
    });
  }

  const prismaticUrl = options.prismaticUrl ?? state.prismaticUrl;

  const authResponse = await fetch(
    urlJoin(prismaticUrl, "embedded", "authenticate"),
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      method: "post",
    }
  );

  if (!authResponse.ok) {
    const responseText = await authResponse.text();
    if (responseText) {
      throw new Error(
        `Authentication failed. Server sent back: ${responseText}`
      );
    } else {
      throw new Error(
        `Authentication failed. Please check that your customer and organization information are correct, and that the token you provided is not expired.`
      );
    }
  }

  state.jwt = token;

  stateService.setState(state);

  const result = await graphqlRequest({
    query: `{
      authenticatedUser {
        customer {
          allowEmbeddedDesigner
        }
      }
    }`,
  });
  state.embeddedDesignerEnabled =
    result.data.authenticatedUser.customer.allowEmbeddedDesigner;
  stateService.setState(state);
};
