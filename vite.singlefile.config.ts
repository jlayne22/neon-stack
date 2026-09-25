import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

/** Production bundle inlined into one HTML file for file:// / double-click. */
export default defineConfig({
  base: "./",
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    outDir: "dist-single",
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
  },
});
