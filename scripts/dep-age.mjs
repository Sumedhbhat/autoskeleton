// Prints installed version vs. newest version at least 14 days old (dependency policy).
// Usage: node scripts/dep-age.mjs <pkg...>
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
const pkgs = process.argv.slice(2);
const now = Date.now();
for (const name of pkgs) {
  let installed = "-";
  try {
    installed = JSON.parse(readFileSync(`node_modules/${name}/package.json`, "utf8")).version;
  } catch {
    // not installed
  }
  let time = JSON.parse(execSync(`npm view ${name} time --json`, { stdio: ["ignore", "pipe", "ignore"] }).toString());
  if (Array.isArray(time)) time = time[0];
  const age = (v) => (now - Date.parse(time[v])) / 86400000;
  // newest stable version at least 14 days old
  const ok = Object.keys(time)
    .filter((v) => /^\d+\.\d+\.\d+$/.test(v) && age(v) >= 14)
    .sort((a, b) => Date.parse(time[b]) - Date.parse(time[a]))[0];
  console.log(`${name}\tinstalled ${installed} (${age(installed).toFixed(1)}d)\tnewest>=14d: ${ok} (${age(ok).toFixed(1)}d)`);
}
