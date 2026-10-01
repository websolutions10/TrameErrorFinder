import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function makeOfflinePlugin(): Plugin {
  return {
    name: "make-offline",
    apply: "build",
    closeBundle() {
      const htmlPath = path.resolve(__dirname, "dist/index.html");
      if (!fs.existsSync(htmlPath)) return;

      let html = fs.readFileSync(htmlPath, "utf-8");

      // Juste retirer type="module" et crossorigin du tag script
      html = html.replace(
        / type="module" crossorigin>/g,
        ">"
      );
      html = html.replace(
        / type="module">/g,
        ">"
      );

      fs.writeFileSync(htmlPath, html, "utf-8");
      console.log("[make-offline] ✓ type=module retiré");
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteSingleFile(),
    makeOfflinePlugin(),
  ],
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        format: "iife",
      },
    },
  },
});
