import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5183,
    proxy: {
      "/api": "http://localhost:8092",
    },
  },
  preview: {
    port: 4183,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
