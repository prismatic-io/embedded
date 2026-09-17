import type { ServerResponse } from "node:http";
import jsonwebtoken from "jsonwebtoken";
import type { Plugin, ViteDevServer } from "vite";
import type { PrismaticConfig } from "./prismatic-config.ts";
import { loadPrismaticConfig } from "./prismatic-config.ts";

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

export function generatePrismaticJwt(config: PrismaticConfig) {
  const currentTime = Math.floor(Date.now() / 1000);
  const token = jsonwebtoken.sign(
    {
      sub: config.userId,
      external_id: config.userId,
      name: config.userName,
      organization: config.organization,
      customer: config.customerExternalId,
      customer_name: config.customerName,
      nbf: currentTime,
      iat: currentTime,
      exp: currentTime + config.tokenValidSeconds,
      role: config.role,
    },
    config.signingKey,
    { algorithm: "RS256" },
  );
  return token;
}

export const prismaticAuthPlugin = (): Plugin => ({
  name: "prismatic-auth",
  configureServer: (server: ViteDevServer) => {
    const envDir = server.config.envDir || server.config.root;
    const { mode } = server.config;

    // Warn at start-up, but still register the route so the browser gets the
    // same message.
    try {
      loadPrismaticConfig(envDir, mode);
    } catch (err) {
      server.config.logger.warn(
        `\n[prismatic-auth] ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }

    server.middlewares.use("/api/prismatic-auth", (_req, res) => {
      // Read on every request so an edit to .env.local takes effect at once.
      const config = loadPrismaticConfig(envDir, mode);

      try {
        const token = generatePrismaticJwt(config);
        sendJson(res, 200, {
          token,
          expiresIn: config.tokenValidSeconds,
          prismaticUrl: config.prismaticUrl,
        });
      } catch (err) {
        sendJson(res, 500, {
          error:
            err instanceof Error ? err.message : "Unknown error signing JWT",
        });
      }
    });
  },
});
