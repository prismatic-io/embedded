/**
 * The backend. It signs the embedded JWT, because the signing key must never
 * reach the browser. In your app, this is a route on your real backend.
 *
 * `bun run server` loads .env.local and serves http://localhost:3001.
 * The Angular dev server proxies /api to it (see proxy.conf.json).
 */
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import jsonwebtoken from "jsonwebtoken";

const TOKEN_VALID_SECONDS = 3600;

function signPrismaticJwt() {
  const env = process.env;
  const now = Math.floor(Date.now() / 1000);
  return jsonwebtoken.sign(
    {
      sub: env.PRISMATIC_USER_ID,
      external_id: env.PRISMATIC_USER_ID,
      name: env.PRISMATIC_USER_NAME,
      organization: env.PRISMATIC_ORGANIZATION,
      customer: env.PRISMATIC_CUSTOMER_EXTERNAL_ID,
      customer_name: env.PRISMATIC_CUSTOMER_NAME,
      role: env.PRISMATIC_ROLE,
      nbf: now,
      iat: now,
      exp: now + TOKEN_VALID_SECONDS,
    },
    readFileSync(env.PRISMATIC_SIGNING_KEY_PATH ?? "", "utf8"),
    { algorithm: "RS256" },
  );
}

createServer((req, res) => {
  if (req.url !== "/api/prismatic-auth") {
    res.writeHead(404).end();
    return;
  }
  // Authenticate your own user here before you sign a token for them.
  try {
    const body = {
      token: signPrismaticJwt(),
      expiresIn: TOKEN_VALID_SECONDS,
      prismaticUrl: process.env.PRISMATIC_URL,
    };
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  } catch (error) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: String(error) }));
  }
}).listen(3001, () => console.log("Auth server on http://localhost:3001"));
