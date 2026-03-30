import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { powerApps } from "@microsoft/power-apps-vite/plugin";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const XLSX_PATH = resolve(__dirname, "Input_Freigabecockpit_V2.xlsx");

/**
 * Watches Input_Freigabecockpit.xlsx and re-generates src/data/records.generated.ts
 * whenever the Excel file changes during dev.
 */
function excelWatcherPlugin(): Plugin {
  return {
    name: "excel-watcher",
    configureServer(server) {
      server.watcher.add(XLSX_PATH);
      server.watcher.on("change", (changedPath) => {
        if (resolve(changedPath) === XLSX_PATH) {
          console.log("\n📊 Freigabecockpit.xlsx changed — regenerating data…");
          try {
            execSync("node scripts/excel-to-ts.mjs", {
              cwd: __dirname,
              stdio: "inherit",
            });
          } catch {
            console.error("❌ Failed to regenerate data from Excel");
          }
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), powerApps(), excelWatcherPlugin()],
});
