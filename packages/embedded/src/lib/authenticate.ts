import urlJoin from "url-join";
import stateService from "../state";
import { PrismaticMessageEvent } from "../types/postMessage";
import { assertInit } from "../utils/assertInit";
import { EMBEDDED_IFRAME_ID } from "../utils/iframe";
import { postMessage } from "../utils/postMessage";
import { graphqlRequest } from "./graphqlRequest";

const ERROR_MESSAGE =
  "The authenticate method expects an object containing a token and additional optional configuration.";
const EXPECTED_KEYS = ["token"];

export interface AuthenticateProps {
  prismaticUrl?: string;
  token: string;
}

/**
 * Authenticates an embedded user with a signed JWT token. This must be called after
 * {@link init} and before rendering any embedded screens. The token should be a
 * short-lived RS256-signed JWT generated on your backend.
 *
 * After the initial call, call `authenticate` again before the token expires
 * (typically ~60 seconds before expiry) to keep the session alive. All active
 * iframes update automatically when a new token is provided.
 *
 * @param options - Authentication options.
 * @param options.token - A signed JWT containing `sub`, `organization`, `customer`, `iat`, and `exp` claims.
 * @param options.prismaticUrl - Override the Prismatic app URL for this authentication request.
 * @throws {Error} If the token is missing or the server rejects it.
 *
 * @example
 * // Authenticate with a token fetched from your backend
 * const response = await fetch("/api/prismatic-token");
 * const { token } = await response.json();
 * await prismatic.authenticate({ token });
 *
 * @example
 * // Re-authenticate before token expiry
 * const TOKEN_LIFETIME_MS = 10 * 60 * 1000; // 10 minutes
 * const refreshToken = async () => {
 *   const { token } = await fetchToken();
 *   await prismatic.authenticate({ token });
 *   setTimeout(refreshToken, TOKEN_LIFETIME_MS - 60_000);
 * };
 * refreshToken();
 *
 * @see {@link https://prismatic.io/docs/embed/authenticate-users/ | Authenticating Embedded Users}
 */
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
    EMBEDDED_IFRAME_ID,
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
    },
  );

  if (!authResponse.ok) {
    const responseText = await authResponse.text();

    if (responseText) {
      throw new Error(
        `Authentication failed. Server sent back: ${responseText}`,
      );
    } else {
      throw new Error(
        `Authentication failed. Please check that your customer and organization information are correct, and that the token you provided is not expired.`,
      );
    }
  }

  state.jwt = token;

  stateService.setState(state);

  const result = await graphqlRequest<{
    authenticatedUser: {
      customer: { allowEmbeddedDesigner: boolean };
    };
  }>({
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
