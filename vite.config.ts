import { defineConfig } from "vite";

// BASE=/cla-do-machado/ no GitHub Pages; "/" no Netlify.
export default defineConfig({ base: process.env.BASE ?? "/" });
