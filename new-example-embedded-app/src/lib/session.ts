import { getRouteApi } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { loadPrismaticConfig } from "@/plugins/prismatic-config.ts";

export interface Session {
  userName: string;
  userInitials: string;
  customerName: string;
  customerExternalId: string;
  configured: boolean;
}

const UNCONFIGURED: Session = {
  userName: "Guest",
  userInitials: "?",
  customerName: "Not configured",
  customerExternalId: "",
  configured: false,
};

function toInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts;
  return letters.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

/**
 * The signed-in user comes from the same .env values that sign the JWT, so the
 * app shell and the Prismatic token always agree on who is using the app.
 */
export const getSession = createServerFn({ method: "GET" }).handler(
  (): Session => {
    try {
      const config = loadPrismaticConfig(process.cwd(), import.meta.env.MODE);
      return {
        userName: config.userName,
        userInitials: toInitials(config.userName),
        customerName: config.customerName,
        customerExternalId: config.customerExternalId,
        configured: true,
      };
    } catch {
      return UNCONFIGURED;
    }
  },
);

const rootRoute = getRouteApi("__root__");

export const useSession = (): Session => rootRoute.useLoaderData();
