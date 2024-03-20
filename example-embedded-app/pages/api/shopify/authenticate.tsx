import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import config from "../../../prismatic/config";

// https://shopify.dev/docs/apps/auth/get-access-tokens/authorization-code-grant/getting-started#step-3-validate-authorization-code

interface ShopifyAuthRequest {
  hmac: string;
  host: string;
  shop: string;
  state: string;
  timestamp: string;
}

const SHOPIFY_INTEGRATION_QUERY = `{
  marketplaceIntegrations(name: "Shopify") {
    nodes {
      requiredConfigVariables(key: "Shopify Connection") {
        nodes {
          inputs {
            nodes {
              name
              value
            }
          }
        }
      }
    }
  }
}`;

const getShopifyClientSecret = async (): Promise<string> => {
  const { prismaticRefreshToken, prismaticUrl } = config;
  const authResponse = await fetch(`${prismaticUrl}/auth/refresh`, {
    method: "POST",
    body: JSON.stringify({ refresh_token: prismaticRefreshToken }),
    headers: {
      "Content-Type": "application/json",
    },
  });
  const { access_token } = await authResponse.json();
  const integrationResponse = await fetch(`${prismaticUrl}/api`, {
    method: "POST",
    body: JSON.stringify({
      query: SHOPIFY_INTEGRATION_QUERY,
    }),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${access_token}`,
    },
  });
  const integrationResponseData = await integrationResponse.json();
  const connectionInputs =
    integrationResponseData.data.marketplaceIntegrations.nodes[0]
      .requiredConfigVariables.nodes[0].inputs.nodes;
  const clientSecret = connectionInputs.find(
    (input) => input.name === "clientSecret",
  ).value;
  return clientSecret;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { hmac, ...rest } = req.query as unknown as ShopifyAuthRequest;

  // Verify the installation request
  const searchParams = new URLSearchParams(rest).toString();
  const secret = await getShopifyClientSecret();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(searchParams)
    .digest("hex");

  if (signature !== hmac) {
    return res.status(403).json({ message: "Invalid signature" });
  }

  res.redirect(`/shopify/install?${searchParams}`);
}
