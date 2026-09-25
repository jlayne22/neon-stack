import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/game/verify.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: "dist-verify/verify.mjs",
  logLevel: "silent",
});

await import("../dist-verify/verify.mjs");
