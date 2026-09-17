import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { acmeChatBotPlugin } from "#/plugins/acme-chat-bot.ts";
import { prismaticAuthPlugin } from "./src/plugins/prismatic-auth.ts";

const config = defineConfig(({ command }) => ({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    ...(command === "serve"
      ? [prismaticAuthPlugin(), acmeChatBotPlugin()]
      : []),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
}));

export default config;
