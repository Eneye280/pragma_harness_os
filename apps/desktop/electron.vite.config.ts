import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ["better-sqlite3", "hono", "chokidar", "simple-git", "dockerode", "@hono/node-server"]
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        external: []
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        "@": resolve("src/renderer"),
        "@main": resolve("src/main")
      }
    },
    plugins: [react(), tailwindcss()]
  }
});
