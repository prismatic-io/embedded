import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { apiPlugin } from "./server/api-plugin";

export default defineConfig({
  plugins: [react(), apiPlugin()],
  optimizeDeps: {
    include: ["@prismatic-io/embedded"],
  },
});
