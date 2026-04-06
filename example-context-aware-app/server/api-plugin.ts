import type { Plugin } from "vite";
import jsonwebtoken from "jsonwebtoken";
import config from "../prismatic/config";

export function apiPlugin(): Plugin {
  return {
    name: "api-routes",
    configureServer(server) {
      server.middlewares.use("/api/authenticate", (_req, res) => {
        const currentTime = Math.floor(Date.now() / 1000);
        const token = jsonwebtoken.sign(
          {
            sub: config.sub,
            external_id: config.external_id,
            name: config.name,
            organization: config.organization,
            customer: config.customer,
            customer_name: config.customerName,
            nbf: currentTime,
            iat: currentTime,
            exp: currentTime + config.tokenValidSeconds,
            role: config.role,
          },
          config.signingKey,
          { algorithm: "RS256" }
        );
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ token }));
      });
    },
  };
}
