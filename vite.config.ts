import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// On GitHub Pages the site lives at /<repo-name>/, so asset URLs need that
// prefix. The deploy workflow sets BASE_PATH; locally it's just "/".
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [react()],
});
