// Measures how long one layout pass takes for long lists. Needs `npm run dev` running.
// Usage: node scripts/bench.mjs
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome" });
for (const n of [50, 200, 1000]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:5173/?perf=${n}`);
  await page.waitForSelector("[data-bone]");
  const load = Date.now() - t0;
  const r = await page.evaluate(() => {
    const w = document.querySelector("[data-autoskeleton]");
    const roots = Array.from(w.childNodes).filter((n) => !(n instanceof Element && n.hasAttribute("data-autoskeleton-layer")));
    const runs = [];
    for (let i = 0; i < 5; i++) {
      const t = performance.now();
      const m = innerHeight; const l = window.__measureBones(roots, { left: 0, top: 0 }, { cull: { left: -m, top: -m, right: innerWidth + m, bottom: innerHeight * 2 } });
      runs.push([performance.now() - t, l.bones.length]);
    }
    return { ms: runs.map((x) => x[0].toFixed(1)).join(","), bones: runs[0][1], rendered: document.querySelectorAll("[data-bone]").length };
  });
  console.log(n, "posts:", r, "pageload ms", load);
  await page.close();
}
await browser.close();
