import prismatic from "@prismatic-io/embedded";
import Router from "next/router";
import React, { useEffect, useMemo } from "react";
import useSWR from "swr";
import config from "../prismatic/config";

interface UserInfoProps {
  authenticatedUser: {
    customer: {
      id: string;
      allowEmbeddedDesigner: boolean;
    };
  };
}
interface AuthConfig {
  authenticated: boolean;
  token: string | null;
  userinfo: UserInfoProps;
}

const fetcher = async (uri: string) => {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(
      `Request failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
};

const getUserInfo = async (): Promise<UserInfoProps> => {
  const query = `{
    authenticatedUser {
      customer {
        id
        allowEmbeddedDesigner
      }
    }
  }`;
  const result = await prismatic.graphqlRequest<UserInfoProps>({ query });
  return result.data;
};

/**
 * Authenticate with Prismatic and return an auth token and info about the authenticated user.
 */
const usePrismaticAuth = (): AuthConfig => {
  const [userinfo, setUserinfo] = React.useState<UserInfoProps>();
  const [authenticated, setAuthenticated] = React.useState<boolean>(false);

  const { data, error } = useSWR<{ token: string }>(
    "/api/prismatic-auth",
    fetcher,
    { refreshInterval: (config.tokenValidSeconds - 30) * 1000 }, // Refresh token 30 seconds before expiration
  );

  const token = useMemo(() => data?.token, [data?.token]);

  if (error) {
    Router.push({
      pathname: "/auth-error",
      query: {
        message:
          "An error occurred when generating your Prismatic auth token. Please check the logs from terminal running this app for more information. This may occur if your signing key is invalid.",
      },
    });
  }

  useEffect(() => {
    let mounted = true;
    if (token) {
      const authenticate = async () => {
        try {
          await prismatic.authenticate({ token });
          if (mounted) {
            setAuthenticated(true);
          }
          const userinfo = await getUserInfo();
          if (mounted) {
            setUserinfo(userinfo);
          }
        } catch (_err) {
          Router.push({
            pathname: "/auth-error",
            query: {
              message:
                "An error occurred when authenticating with Prismatic. Check that the external ID you used for your customer is correct, as well as your organization ID and customer ID.",
            },
          });
        }
        return () => {
          mounted = false;
        };
      };
      authenticate();
    }
  }, [token]);

  return {
    authenticated,
    token,
    userinfo,
  };
};

export default usePrismaticAuth;
