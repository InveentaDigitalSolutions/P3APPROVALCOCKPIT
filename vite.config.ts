import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { powerApps } from "@microsoft/power-apps-vite/plugin";
// @ts-expect-error — plain JS plugin
import { dataverseProxy } from "./scripts/dv-proxy-plugin.mjs";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), powerApps(), dataverseProxy()],
});
