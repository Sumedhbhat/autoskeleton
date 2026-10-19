// Grades one eval run directory.
// Usage: node evals/grade.mjs <runDir> [port]
import { chromium } from "@playwright/test";
import { execSync, spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const runDir = process.argv[2];
const port = Number(process.argv[3] ?? 5300 + Math.floor(Math.random() * 500));
const report = { run: runDir, checks: {}, sections: {}, notes: [] };
const check = (name, ok, detail) => (report.checks[name] = { ok: !!ok, ...(detail !== undefined ? { detail } : {}) });

// ---------------------------------------------------------------- static
function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}
const src = files(join(runDir, "src")).filter((f) => /\.(tsx?|css)$/.test(f));
const code = Object.fromEntries(src.map((f) => [f.slice(runDir.length + 1), readFileSync(f, "utf8")]));
const allTsx = Object.entries(code).filter(([f]) => /\.tsx?$/.test(f));
const joined = allTsx.map(([, c]) => c).join("\n");

try {
  execSync("npx tsc --noEmit", { cwd: runDir, stdio: "pipe" });
  check("typecheck", true);
} catch (e) {
  check("typecheck", false, String(e.stdout).slice(0, 2000));
}
check("imports autoskeleton", /from ["']autoskeleton["']/.test(joined));
const handSkeletonUsed = allTsx.some(
  ([f, c]) => !/Skeleton\.tsx$/.test(f) && /import[^;]*\b(ProfileHeaderSkeleton|ProductGridSkeleton|ProductCardSkeleton)\b/.test(c),
);
check("hand-written skeletons no longer used", !handSkeletonUsed);
check("hand-written skeleton files deleted", !existsSync(join(runDir, "src/components/ProfileHeaderSkeleton.tsx")) && !existsSync(join(runDir, "src/components/ProductCardSkeleton.tsx")));
check("no manual .sk markup", !/className=["'`][^"'`]*\bsk\b/.test(joined));
check("all data-section kept", ["profile", "orders", "notifications", "products", "activity"].every((s) => joined.includes(`data-section="${s}"`)));

// ---------------------------------------------------------------- runtime
const server = spawn("npx", ["vite", "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd: runDir, stdio: "pipe" });
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch(base);
    if (r.ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 250));
}

const browser = await chromium.launch({ channel: "chrome" });
const SECTIONS = ["profile", "orders", "notifications", "products", "activity"];
const MIN_BONES = { profile: 8, orders: 15, notifications: 6, products: 18, activity: 8 };

async function sectionState(page) {
  return page.evaluate((ids) => {
    const out = {};
    for (const id of ids) {
      const s = document.querySelector(`[data-section="${id}"]`);
      if (!s) {
        out[id] = null;
        continue;
      }
      const r = s.getBoundingClientRect();
      const text = s.innerText || "";
      out[id] = {
        height: Math.round(r.height),
        bones: s.querySelectorAll("[data-bone]").length,
        blockBones: s.querySelectorAll('[data-bone="block"]').length,
        busy: !!s.querySelector('[aria-busy="true"]'),
        spinner: !!s.querySelector(".spinner,[role=status]:not([data-autoskeleton-sr])"),
        loadingText: /loading/i.test(text.replace(/Happening now|Recommended for you|Recent orders|Notifications/g, "")),
        handSk: s.querySelectorAll(".sk").length,
      };
    }
    return out;
  }, SECTIONS);
}

try {
  // 1. Held loading state.
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text()) && errors.push(m.text()));
  await page.goto(`${base}/?hold=1`);
  await page.waitForTimeout(1200);
  const held = await sectionState(page);
  const heldAnalytics = await page.evaluate(() => window.__analytics.length);
  await page.screenshot({ path: join(runDir, "grade-loading.png"), fullPage: true });

  // 2. Real load with latency: measure layout shift.
  const p2 = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
  p2.on("pageerror", (e) => errors.push(e.message));
  p2.on("console", (m) => m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text()) && errors.push(m.text()));
  await p2.goto(`${base}/?delay=1500`);
  await p2.waitForTimeout(500);
  const during = await sectionState(p2);
  await p2.waitForTimeout(2200);
  const after = await sectionState(p2);
  const analytics = await p2.evaluate(() => window.__analytics);
  await p2.screenshot({ path: join(runDir, "grade-loaded.png"), fullPage: true });

  for (const id of SECTIONS) {
    const h = held[id];
    const d = during[id];
    const a = after[id];
    if (!h || !a || !d) {
      report.sections[id] = { missing: true };
      continue;
    }
    const shift = a.height ? Math.abs(d.height - a.height) / a.height : 1;
    report.sections[id] = {
      bonesWhileLoading: h.bones,
      skeletonShown: h.bones >= MIN_BONES[id] && !h.spinner && !h.loadingText && h.handSk === 0,
      heightLoading: d.height,
      heightLoaded: a.height,
      layoutShift: Math.round(shift * 100) / 100,
      cleanAfterLoad: a.bones === 0 && !a.busy,
      spinnerOrLoadingText: h.spinner || h.loadingText,
    };
  }
  const secs = Object.values(report.sections);
  check("every section shows an auto skeleton while loading", secs.every((s) => s.skeletonShown), Object.fromEntries(SECTIONS.map((id) => [id, report.sections[id]?.bonesWhileLoading])));
  check("no layout shift > 15% when data arrives", secs.every((s) => s.layoutShift !== undefined && s.layoutShift <= 0.15), Object.fromEntries(SECTIONS.map((id) => [id, report.sections[id]?.layoutShift])));
  check("skeleton removed after load", secs.every((s) => s.cleanAfterLoad));
  check("no analytics fired on placeholder data", heldAnalytics === 0, heldAnalytics);
  const impressions = analytics.filter((e) => e.event === "activity_impressions");
  check("real analytics still fires once loaded", impressions.length >= 1 && JSON.stringify(impressions.at(-1).payload) === JSON.stringify(["a1", "a2", "a3", "a4"]), analytics);
  check("no runtime errors", errors.length === 0, errors.slice(0, 5));
} catch (e) {
  report.notes.push(`runtime grading failed: ${e.message}`);
} finally {
  await browser.close();
  server.kill();
}

const checks = Object.values(report.checks);
report.score = `${checks.filter((c) => c.ok).length}/${checks.length}`;
writeFileSync(join(runDir, "grade.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(0);
