import { mkdir, copyFile, cp, readdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "public");
// Only this reproducible build directory is replaced. Never copy the repository wholesale.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const files = [
  "index.html",
  "sales.html",
  "product.html",
  "updates.html",
  "app.html",
  "sample.html",
  "styles.css",
  "navigation.css",
  "navigation.js",
  "pages.css",
  "pages.js",
  "app.js",
  "product.css",
  "product.js",
  "live.css",
  "live-app.js",
];
for (const name of files)
  await copyFile(path.join(root, name), path.join(output, name));
for (const name of ["assets", "demo", "updates"])
  await cp(path.join(root, name), path.join(output, name), {
    recursive: true,
    filter: (source) => !source.endsWith("README.md"),
  });
const forbidden = [".env", "server", "db", "node_modules", "api", "docs"];
for (const name of await readdir(output))
  if (forbidden.some((p) => name.startsWith(p)))
    throw new Error("Private source appeared in public output");
console.log(
  "Public assets staged from explicit allowlist. Private server code, database schema and environment files excluded.",
);
