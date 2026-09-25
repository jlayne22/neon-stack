import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const built = resolve(root, "dist-single/index.html");
const out = resolve(root, "NeonStack.html");

const vite = spawnSync(
  process.execPath,
  [resolve(root, "node_modules/vite/bin/vite.js"), "build", "--config", "vite.singlefile.config.ts"],
  { cwd: root, stdio: "inherit" },
);

if (vite.status !== 0) process.exit(vite.status ?? 1);

const favicon = readFileSync(resolve(root, "public/favicon.svg"), "utf8")
  .replace(/\s+/g, " ")
  .trim();
const faviconHref = `data:image/svg+xml,${encodeURIComponent(favicon)}`;

let html = readFileSync(built, "utf8");
html = html.replace(/href="[^"]*favicon\.svg"/, `href="${faviconHref}"`);

// Vite inlines the bundle in <head>. A classic script there runs before <body>
// exists, so move it to the end of <body> (same place as the dev index.html).
const scriptMatch = html.match(/<script\b[^>]*>[\s\S]*?<\/script>/);
if (!scriptMatch) throw new Error("Packed HTML is missing its script");
const code = scriptMatch[0].replace(/^<script\b[^>]*>/, "").replace(/<\/script>$/, "");
if (/\bimport\s|\bexport\s|import\.meta/.test(code)) {
  throw new Error("Bundle still has module syntax; file:// would fail");
}
html = html.replace(scriptMatch[0], "");
html = html.replace("</body>", `<script>${code}</script>\n  </body>`);

writeFileSync(out, html);
console.log(`Wrote ${out} (${html.length} bytes)`);
