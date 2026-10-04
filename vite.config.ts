/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages serves the app under /duneTournament/; the Docker image sets VITE_BASE=/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_BASE ?? "/duneTournament/",
  test: {
    exclude: ["e2e/**", "node_modules/**", "server/**"],
  },
});
