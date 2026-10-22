import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

// The version comes from package.json only. Release CI sets the nightly
// version in its checkout before building, so this always matches npm.
const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["react", "react-dom"],
  define: { __AUTOSKELETON_VERSION__: JSON.stringify(version) },
  banner: { js: '"use client";' },
});
