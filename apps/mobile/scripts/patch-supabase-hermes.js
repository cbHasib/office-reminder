const fs = require("fs");
const path = require("path");

const target = path.join(
  __dirname,
  "..",
  "node_modules",
  "@supabase",
  "supabase-js",
  "dist",
  "index.mjs"
);

if (!fs.existsSync(target)) {
  console.warn("[patch-supabase-hermes] Supabase bundle not found, skipping");
  process.exit(0);
}

const source = fs.readFileSync(target, "utf8");
const marker = "function loadOtel() {";
const start = source.indexOf(marker);
const alreadyPatched = source.includes("otelModulePromise = Promise.resolve(null)");

if (alreadyPatched) {
  console.log("[patch-supabase-hermes] Supabase Hermes patch already applied");
  process.exit(0);
}

if (start === -1) {
  console.warn("[patch-supabase-hermes] Supabase tracing loader not found, skipping");
  process.exit(0);
}

const end = source.indexOf("}\n", start) + 2;
const original = source.slice(start, end);

if (end < 2 || !original.includes("import(") || !original.includes("OTEL_PKG")) {
  console.warn("[patch-supabase-hermes] Supabase tracing loader pattern changed, skipping");
  process.exit(0);
}

const patched = [
  "function loadOtel() {",
  "\tif (otelModulePromise === null) otelModulePromise = Promise.resolve(null);",
  "\treturn otelModulePromise;",
  "}",
].join("\n");

fs.writeFileSync(target, source.slice(0, start) + patched + source.slice(end));
console.log("[patch-supabase-hermes] Removed Hermes-incompatible Supabase optional tracing import");
