import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createMiddleware } from "@mswjs/http-middleware";
import express from "express";
import { http, HttpResponse } from "msw";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const distDir = resolve(repoRoot, "dist");

const HARNESS_HTML = `<!DOCTYPE html>
<html lang="en"><head><title>@prismatic-io/embedded — smoke test harness</title></head><body></body></html>`;

const INTEGRATION_MARKETPLACE_STUB = `<!DOCTYPE html>
<html lang="en"><head><title>stub-marketplace</title></head><body>
<script>window.parent.postMessage({ event: "PRISMATIC_INITIALIZED" }, "*");</script>
</body></html>`;

const EMBEDDED_PRELOAD_STUB = '<!DOCTYPE html><html lang="en"></html>';

const handlers = [
  http.get("/", () => HttpResponse.html(HARNESS_HTML)),
  http.post(
    "/embedded/authenticate",
    () => new HttpResponse(null, { status: 200 }),
  ),
  http.post("/api", () =>
    HttpResponse.json({
      data: {
        authenticatedUser: {
          customer: { allowEmbeddedDesigner: false },
        },
      },
    }),
  ),
  http.get("/integration-marketplace/*", () =>
    HttpResponse.html(INTEGRATION_MARKETPLACE_STUB),
  ),
  http.get("/embedded", () => HttpResponse.html(EMBEDDED_PRELOAD_STUB)),
  http.get("/embedded/*", () => HttpResponse.html(EMBEDDED_PRELOAD_STUB)),
];

export const startStubServer = async (): Promise<{
  url: string;
  close: () => Promise<void>;
}> => {
  const app = express();
  app.use(createMiddleware(...handlers));
  app.use("/dist", express.static(distDir));

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: promisify(server.close.bind(server)),
  };
};
