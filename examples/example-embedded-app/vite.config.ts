import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { acmeChatBotPlugin } from "./server/acme-chat-bot.ts";
import { prismaticAuthPlugin } from "./server/prismatic-auth.ts";

const config = defineConfig(({ command }) => ({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    ...(command === "serve"
      ? [prismaticAuthPlugin(), acmeChatBotPlugin()]
      : []),
    tailwindcss(),
    tanstackStart({ srcDirectory: "frontend" }),
    viteReact(),
  ],
}));

export default config;
