// Grades one v2 ("team workspace") eval run.
// Usage: node evals/grade-v2.mjs <runDir> [port]
import { chromium } from "@playwright/test";
import { execSync, spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const runDir = process.argv[2];
const port = Number(process.argv[3] ?? 5600 + Math.floor(Math.random() * 300));
const report = { run: runDir, checks: {}, sections: {}, notes: [] };
const check = (name, ok, detail) => (report.checks[name] = { ok: !!ok, ...(detail !== undefined ? { detail } : {}) });

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}
const code = files(join(runDir, "src"))
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

try {
  execSync("npx tsc --noEmit", { cwd: runDir, stdio: "pipe" });
  check("typecheck", true);
} catch (e) {
  check("typecheck", false, String(e.stdout).slice(0, 2000));
}
check("imports autoskeleton", /from ["'](@autoskeleton\/react|autoskeleton)["']/.test(code));
check(
  "hand-written skeletons gone",
  !existsSync(join(runDir, "src/components/IssueRowSkeleton.tsx")) && !/IssueRowSkeleton|chart-skeleton|className=["']sk["']/.test(code),
);
check(
  "grader hooks kept",
  ["issues", "chart", "search", "comments"].every((s) => code.includes(`data-section="${s}"`)) &&
    code.includes('data-action="load-more"') &&
    code.includes('data-role="search-input"'),
);

const server = spawn("npx", ["vite", "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd: runDir, stdio: "pipe" });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(base)).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 250));
}

const SECTIONS = ["issues", "chart", "search", "comments"];
const MIN_BONES = { issues: 12, chart: 3, search: 6, comments: 6 };
const REAL_PAGE1 = ["ISS-101", "ISS-102", "ISS-103", "ISS-104", "ISS-105"];
const REAL_PAGE2 = ["ISS-106", "ISS-107", "ISS-108", "ISS-109", "ISS-110"];
const REAL_IDS = new Set([...REAL_PAGE1, ...REAL_PAGE2]);

const state = (page) =>
  page.evaluate((ids) => {
    const out = {};
    for (const id of ids) {
      const s = document.querySelector(`[data-section="${id}"]`);
      if (!s) {
        out[id] = null;
        continue;
      }
      const text = (s.innerText || "").replace(/^.*\n/, "");
      out[id] = {
        height: Math.round(s.getBoundingClientRect().height),
        bones: s.querySelectorAll("[data-bone]").length,
        busy: !!s.querySelector('[aria-busy="true"]'),
        loadingText: /loading|searching/i.test(text),
        handSk: s.querySelectorAll(".sk,.chart-skeleton").length,
      };
    }
    return out;
  }, SECTIONS);

const browser = await chromium.launch({ channel: "chrome" });
const errors = [];
const watch = (p) => {
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text()) && errors.push(m.text()));
};

try {
  // 1. Held loading.
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  watch(page);
  await page.goto(`${base}/?hold=1`);
  await page.waitForTimeout(1200);
  const held = await state(page);
  const heldSeen = await page.evaluate(() => window.__seen);
  const heldAnalytics = await page.evaluate(() => window.__analytics);
  await page.screenshot({ path: join(runDir, "grade-loading.png"), fullPage: true });
  for (const id of SECTIONS) {
    const h = held[id];
    report.sections[id] = { bonesWhileLoading: h?.bones ?? 0, skeletonShown: !!h && h.bones >= MIN_BONES[id] && !h.loadingText && h.handSk === 0 };
  }
  check("every section shows an auto skeleton while loading", SECTIONS.every((id) => report.sections[id].skeletonShown), Object.fromEntries(SECTIONS.map((id) => [id, held[id]])));
  check("no side effects on placeholder data (markSeen / analytics)", heldSeen.length === 0 && heldAnalytics.length === 0, { heldSeen, heldAnalytics });

  // 2. Real load: layout shift + real side effects.
  const p2 = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  watch(p2);
  await p2.goto(`${base}/?delay=1500`);
  await p2.waitForTimeout(500);
  const during = await state(p2);
  await p2.waitForTimeout(2200);
  const after = await state(p2);
  for (const id of SECTIONS) {
    const d = during[id];
    const a = after[id];
    if (!d || !a) continue;
    Object.assign(report.sections[id], {
      heightLoading: d.height,
      heightLoaded: a.height,
      layoutShift: Math.round((Math.abs(d.height - a.height) / a.height) * 100) / 100,
      cleanAfterLoad: a.bones === 0 && !a.busy,
    });
  }
  check("no layout shift > 15% when data arrives", ["issues", "chart", "comments"].every((id) => report.sections[id].layoutShift <= 0.15), Object.fromEntries(SECTIONS.map((id) => [id, report.sections[id].layoutShift])));
  check("skeleton removed after load", SECTIONS.every((id) => report.sections[id].cleanAfterLoad));
  const seen = await p2.evaluate(() => window.__seen);
  const analytics = await p2.evaluate(() => window.__analytics);
  check(
    "real side effects still fire",
    REAL_PAGE1.every((id) => seen.includes(id)) && analytics.some((e) => e.event === "chart_render" && e.payload === 12),
    { seen, analytics },
  );

  // 3. Load more: page 1 stays visible, skeleton only for the new page.
  await p2.locator('[data-action="load-more"]').click();
  await p2.waitForTimeout(400);
  const lm = await p2.evaluate(() => {
    const s = document.querySelector('[data-section="issues"]');
    const firstTitle = Array.from(s.querySelectorAll("li")).find((li) => li.innerText.includes("API returns 500"));
    const visible = !!firstTitle && getComputedStyle(firstTitle).visibility === "visible" && !firstTitle.closest('[aria-busy="true"]');
    return { page1Visible: visible, bones: s.querySelectorAll("[data-bone]").length };
  });
  await p2.waitForTimeout(1900);
  const lmAfter = await p2.evaluate(() => {
    const s = document.querySelector('[data-section="issues"]');
    return { bones: s.querySelectorAll("[data-bone]").length, text: s.innerText.includes("Paginate audit log export") };
  });
  check("load more keeps page 1 visible and skeletons only the new page", lm.page1Visible && lm.bones >= 6 && lmAfter.bones === 0 && lmAfter.text, { during: lm, after: lmAfter });

  // 4. Search refetch: skeleton over results while fetching.
  await p2.locator('[data-role="search-input"]').fill("api");
  await p2.waitForTimeout(400);
  const sDuring = await p2.evaluate(() => {
    const s = document.querySelector('[data-section="search"]');
    return { bones: s.querySelectorAll("[data-bone]").length, text: /searching|loading/i.test(s.innerText.replace(/^.*\n/, "")) };
  });
  await p2.waitForTimeout(1900);
  const sAfter = await p2.evaluate(() => {
    const s = document.querySelector('[data-section="search"]');
    return { bones: s.querySelectorAll("[data-bone]").length, hasApi: s.innerText.includes("Add rate limit headers to public API") };
  });
  check("search refetch shows skeleton, then results", sDuring.bones >= 4 && !sDuring.text && sAfter.bones === 0 && sAfter.hasApi, { during: sDuring, after: sAfter });

  const allSeen = await p2.evaluate(() => window.__seen);
  const fake = allSeen.filter((id) => !REAL_IDS.has(id));
  check("markSeen never called with placeholder ids", fake.length === 0, fake.slice(0, 10));
  await p2.screenshot({ path: join(runDir, "grade-loaded.png"), fullPage: true });
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
