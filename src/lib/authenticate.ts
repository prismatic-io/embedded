import urlJoin from "url-join";

import { assertInit } from "../utils/assertInit";
import { state } from "../state";

const ERROR_MESSAGE =
  "The authenticate method expects an object containing a token and additional optional configuration.";
const EXPECTED_KEYS = ["token"];

export interface AuthenticateProps {
  prismaticUrl?: string;
  token: string;
}

export const authenticate = async (props: AuthenticateProps) => {
  assertInit("authenticate");

  if (!props) {
    throw new Error(ERROR_MESSAGE);
  }

  const givenProps = new Set(Object.keys(props));

  if (!EXPECTED_KEYS.every((key) => givenProps.has(key))) {
    throw new Error(ERROR_MESSAGE);
  }

  const { token } = props;

  state.jwt = token;

  const prismaticUrl = props.prismaticUrl ?? state.prismaticUrl;

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
};
