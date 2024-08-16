import useSWR from "swr";
import axios from "axios";
import Router from "next/router";
import prismatic from "@prismatic-io/embedded";
import React, { useEffect, useMemo } from "react";
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
  const response = await axios.get(uri, {});
  return response.data;
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
  const result = await prismatic.graphqlRequest({ query });
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
        } catch (err) {
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
