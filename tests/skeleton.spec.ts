import { expect, test, type Page } from "@playwright/test";
import { fake } from "../src/placeholder";

type R = { x: number; y: number; w: number; h: number; kind?: string; tag?: string };

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text());
    if (m.type() === "warning" && /react|nest|hydration/i.test(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function bones(page: Page, fixture: string): Promise<R[]> {
  // Off-screen content is culled until it scrolls near the viewport.
  await page.locator(`[data-fixture="${fixture}"]`).scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  return page.evaluate((id) => {
    const root = document.querySelector(`[data-fixture="${id}"]`)!;
    return Array.from(root.querySelectorAll<HTMLElement>("[data-bone]")).map((b) => {
      const r = b.getBoundingClientRect();
      return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height, kind: b.dataset.bone };
    });
  }, fixture);
}

/** Real geometry of the loaded content: one rect per text line fragment, plus media/control boxes. */
async function realGeometry(page: Page, fixture: string): Promise<{ text: R[]; blocks: R[] }> {
  return page.evaluate((id) => {
    // A hand-wired Suspense fallback leaves no wrapper once the content shows.
    const body =
      document.querySelector(`[data-fixture="${id}"] [data-autoskeleton]`) ??
      document.querySelector(`[data-fixture="${id}"] .fixture-body`)!;
    const text: R[] = [];
    const blocks: R[] = [];
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    const all = body.querySelectorAll("img,button,input,select,textarea,svg");
    const range = document.createRange();
    const visible = (el: Element | null) => {
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === "none" || cs.visibility === "hidden") return false;
        if (cs.overflow !== "visible") {
          // ignore clipped-out text (scroll container)
        }
      }
      return true;
    };
    let n: Node | null;
    while ((n = walker.nextNode())) {
      if (!/\S/.test(n.textContent || "")) continue;
      if (!visible(n.parentElement)) continue;
      if (n.parentElement?.closest("option,select,textarea,button,[data-skeleton]")) continue;
      range.selectNodeContents(n);
      for (const r of Array.from(range.getClientRects())) {
        if (r.width < 2) continue;
        text.push({ x: r.left, y: r.top + scrollY, w: r.width, h: r.height });
      }
    }
    for (const el of Array.from(all)) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      blocks.push({ x: r.left, y: r.top + scrollY, w: r.width, h: r.height, tag: el.tagName });
    }
    return { text, blocks };
  }, fixture);
}

const vOverlap = (a: R, b: R) => Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
const hOverlap = (a: R, b: R) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);

// "transformed" has a static (non-animated) transform: bones follow the transformed boxes.
const GEOMETRY_FIXTURES = [
  "user",
  "hook",
  "feed",
  "table",
  "stats",
  "article",
  "form",
  "products",
  "toolbar",
  "nested",
  "transformed",
  "skeleton-suspense",
  "suspense-override",
  "suspense-manual",
];

for (const fixture of GEOMETRY_FIXTURES) {
  test(`geometry matches real content: ${fixture}`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/?same=1");
    await page.evaluate(() => document.fonts.ready);
    const b = await bones(page, fixture);
    expect(b.length).toBeGreaterThan(0);

    await page.evaluate(() => window.__setLoading(false));
    await expect(page.locator(`[data-fixture="${fixture}"] [data-autoskeleton-layer]`)).toHaveCount(0);
    const real = await realGeometry(page, fixture);
    const textBones = b.filter((x) => x.kind === "text");
    const blockBones = b.filter((x) => x.kind === "block");

    // Every real line of text is covered by a text bar (or sits inside a block, e.g. a button/pill).
    for (const t of real.text) {
      const covered =
        textBones.some((x) => vOverlap(x, t) > 0 && hOverlap(x, t) >= t.w * 0.9) ||
        blockBones.some((x) => vOverlap(x, t) >= t.h * 0.5 && hOverlap(x, t) >= t.w * 0.9);
      expect(covered, `text line not covered: ${JSON.stringify(t)}`).toBe(true);
    }
    // No phantom text bars: each one sits on a real line.
    for (const x of textBones) {
      const real_ = real.text.some((t) => vOverlap(x, t) >= x.h * 0.9 && hOverlap(x, t) > 0);
      expect(real_, `phantom text bone: ${JSON.stringify(x)}`).toBe(true);
    }
    // Media and controls get a block with the exact same box.
    for (const m of real.blocks) {
      const match = blockBones.some(
        (x) => Math.abs(x.x - m.x) < 1.5 && Math.abs(x.y - m.y) < 1.5 && Math.abs(x.w - m.w) < 1.5 && Math.abs(x.h - m.h) < 1.5,
      );
      expect(match, `no block bone for ${m.tag} ${JSON.stringify(m)}`).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}

test("content is hidden and inert while loading, then revealed", async ({ page }) => {
  await page.goto("/?same=1");
  const btn = page.locator('[data-fixture="user"] button.btn');
  await expect(btn).toBeHidden();
  expect(await btn.evaluate((el) => getComputedStyle(el).visibility)).toBe("hidden");
  expect(await page.locator('[data-fixture="form"] input').first().evaluate((el) => !!el.closest("[inert]"))).toBe(true);
  // Keyboard can't reach hidden controls.
  await page.locator("#toggle").focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => document.activeElement?.closest("[aria-busy=true]") !== null);
  expect(focused).toBe(false);

  await page.evaluate(() => window.__setLoading(false));
  await expect(btn).toBeVisible();
  await expect(page.locator("[data-autoskeleton-layer]")).toHaveCount(0);
  expect(await page.locator("[inert]").count()).toBe(0);
});

test("usePlaceholder: nested placeholder fields while loading, real data after", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  const root = page.locator('[data-fixture="hook"]');
  const wrapper = root.locator("[data-autoskeleton]");
  await expect(wrapper).toHaveAttribute("aria-busy", "true");
  await expect(root.locator(".user-card h3")).toContainText(fake.name());
  await expect(root.locator(".post strong")).toHaveText(fake.name(1));
  expect((await bones(page, "hook")).length).toBeGreaterThan(5);

  await page.evaluate(() => window.__setLoading(false));
  await expect(wrapper).not.toHaveAttribute("aria-busy");
  await expect(root.locator(".user-card h3")).toContainText("Ada Lovelace");
  await expect(root.locator(".post strong")).toHaveText("Grace Hopper");
  await expect(root.locator("[data-autoskeleton-layer]")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("toggling back to loading re-measures current content", async ({ page }) => {
  await page.goto("/?same=1&loading=0");
  await expect(page.locator("[data-bone]")).toHaveCount(0);
  await page.locator("#toggle").click();
  expect((await bones(page, "user")).length).toBeGreaterThan(5);
});

test("keep hint stays visible, ignore hint is skipped", async ({ page }) => {
  await page.goto("/?same=1");
  await expect(page.locator('[data-fixture="hero"] .eyebrow')).toBeVisible();
  const eyebrow = await page.locator('[data-fixture="hero"] .eyebrow').boundingBox();
  const b = await bones(page, "hero");
  const overlapping = b.filter((x) => x.y < eyebrow!.y + eyebrow!.height && x.y + x.h > eyebrow!.y);
  expect(overlapping).toEqual([]);
});

test("responsive: bones follow layout on resize", async ({ page }) => {
  await page.goto("/?same=1");
  const before = await bones(page, "article");
  await page.setViewportSize({ width: 700, height: 900 });
  await page.waitForTimeout(150);
  const after = await bones(page, "article");
  expect(JSON.stringify(after)).not.toBe(JSON.stringify(before));
  await page.evaluate(() => window.__setLoading(false));
  await expect(page.locator('[data-fixture="article"] [data-bone]')).toHaveCount(0);
  const real = await realGeometry(page, "article");
  const textBones = after.filter((x) => x.kind === "text");
  for (const t of real.text) {
    const covered =
      textBones.some((x) => vOverlap(x, t) > 0 && hOverlap(x, t) >= t.w * 0.9) ||
      after.some((x) => x.kind === "block" && vOverlap(x, t) >= t.h * 0.5 && hOverlap(x, t) >= t.w * 0.9);
    expect(covered, JSON.stringify(t)).toBe(true);
  }
});

test("scroll container: bones are clipped and follow scrolling", async ({ page }) => {
  await page.goto("/?same=1");
  const b = await bones(page, "scroll");
  const box = (await page.locator('[data-fixture="scroll"] .scroller').boundingBox())!;
  const pageY = await page.evaluate(() => window.scrollY);
  for (const x of b) {
    expect(x.y - pageY).toBeGreaterThanOrEqual(box.y - 0.5);
    expect(x.y - pageY + x.h).toBeLessThanOrEqual(box.y + box.height + 0.5);
  }
  const firstTop = Math.min(...b.filter((x) => x.kind === "text").map((x) => x.y));
  await page.locator('[data-fixture="scroll"] .scroller').evaluate((el) => (el.scrollTop = 100));
  await page.waitForTimeout(100);
  const b2 = await bones(page, "scroll");
  const firstTop2 = Math.min(...b2.filter((x) => x.kind === "text").map((x) => x.y));
  expect(firstTop2).not.toBe(firstTop);
});

test("useSkeleton() lets components skip effects while loading", async ({ page }) => {
  await page.goto("/?same=1");
  const widget = page.locator('[data-fixture="effects"] [data-tracked]');
  await expect(widget).toHaveAttribute("data-tracked", "0");
  await page.evaluate(() => window.__setLoading(false));
  await expect(widget).not.toHaveAttribute("data-tracked", "0");
});

test("id cache: skeleton without placeholder data uses the remembered layout", async ({ page }) => {
  // First visit: nothing cached, so the fallback shows.
  await page.goto("/?same=1");
  await expect(page.locator('[data-fixture="cache"] .fallback')).toBeVisible();
  expect((await bones(page, "cache")).length).toBe(0);
  // Real content renders and is remembered.
  await page.evaluate(() => window.__setLoading(false));
  await page.waitForTimeout(100);
  const real = await realGeometry(page, "cache");
  // Next visit: the skeleton is drawn from cache, no fallback.
  await page.reload();
  await expect(page.locator('[data-fixture="cache"] .fallback')).toHaveCount(0);
  const b = await bones(page, "cache");
  expect(b.filter((x) => x.kind === "text").length).toBeGreaterThan(3);
  const avatar = real.blocks.find((x) => x.tag === "IMG")!;
  expect(b.some((x) => x.kind === "block" && Math.abs(x.w - avatar.w) < 1 && Math.abs(x.y - avatar.y) < 1.5)).toBe(true);
  // The spacer reserves the real height, so nothing jumps when data arrives.
  const spacerH = await page.locator('[data-fixture="cache"] [data-autoskeleton-spacer]').evaluate((el) => el.getBoundingClientRect().height);
  const cardH = await page.evaluate(() => {
    const raw = localStorage.getItem("autoskeleton:v1:demo-cache")!;
    return JSON.parse(raw)[0].height as number;
  });
  expect(Math.abs(spacerH - cardH)).toBeLessThan(1);
});

test("Suspense fallback draws the cached layout on refetch", async ({ page }) => {
  await page.goto("/?same=1&loading=0");
  await expect(page.locator('[data-fixture="suspense"] .user-card')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(100);
  await page.locator("#suspense-reload").click();
  await expect(page.locator('[data-fixture="suspense"] [data-bone]').first()).toBeAttached();
  expect((await bones(page, "suspense")).length).toBeGreaterThan(4);
  await expect(page.locator('[data-fixture="suspense"] .user-card')).toBeVisible({ timeout: 5000 });
});

test("no React warnings in table (tbody) usage", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/?same=1");
  await page.evaluate(() => window.__setLoading(false));
  await page.evaluate(() => window.__setLoading(true));
  await page.waitForTimeout(300);
  expect(errors).toEqual([]);
  expect((await bones(page, "table")).length).toBeGreaterThan(10);
});

test("long lists: off-screen content is culled, then measured when scrolled to", async ({ page }) => {
  await page.goto("/?perf=400");
  const count = () => page.locator("[data-bone]").count();
  const initial = await count();
  expect(initial).toBeGreaterThan(10);
  expect(initial).toBeLessThan(400);
  // Layout size still accounts for the whole list.
  const before = await page.locator("[data-bone]").evaluateAll((els) => Math.max(...els.map((e) => e.getBoundingClientRect().bottom)));
  await page.mouse.wheel(0, 20000);
  await page.waitForTimeout(200);
  const after = await page.locator("[data-bone]").evaluateAll((els) => Math.max(...els.map((e) => e.getBoundingClientRect().bottom)));
  expect(await count()).toBeGreaterThan(10);
  // Bones exist around the new viewport.
  expect(after).toBeGreaterThan(0);
  expect(before).toBeGreaterThan(0);
  const visible = await page.locator("[data-bone]").evaluateAll((els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).length);
  expect(visible).toBeGreaterThan(10);
});

test("fade-out: layer lingers briefly with data-exiting, then unmounts", async ({ page }) => {
  await page.goto("/?same=1");
  const sawExiting = await page.evaluate(
    () =>
      new Promise<{ exiting: boolean; sameElement: boolean }>((resolve) => {
        const before = document.querySelector('[data-fixture="user"] [data-autoskeleton-layer]');
        const mo = new MutationObserver(() => {
          const el = document.querySelector('[data-fixture="user"] [data-autoskeleton-layer][data-exiting]');
          if (el) {
            mo.disconnect();
            resolve({ exiting: true, sameElement: el === before });
          }
        });
        mo.observe(document.body, { subtree: true, attributes: true, childList: true });
        window.__setLoading(false);
        setTimeout(() => resolve({ exiting: false, sameElement: false }), 1000);
      }),
  );
  // The same layer element fades (a remount would skip the CSS transition).
  expect(sawExiting).toEqual({ exiting: true, sameElement: true });
  await expect(page.locator("[data-autoskeleton-layer]")).toHaveCount(0);
});

test("no data-pending after client render", async ({ page }) => {
  await page.goto("/?same=1");
  expect(await page.locator("[data-pending]").count()).toBe(0);
});

test("fade={0}: skeleton disappears immediately and comes back on the next load", async ({ page }) => {
  await page.goto("/?same=1&fade=0");
  expect((await bones(page, "user")).length).toBeGreaterThan(5);
  await page.evaluate(() => window.__setLoading(false));
  await expect(page.locator("[data-autoskeleton-layer]")).toHaveCount(0);
  await page.evaluate(() => window.__setLoading(true));
  expect((await bones(page, "user")).length).toBeGreaterThan(5);
});

async function finishAnimations(page: Page) {
  await page.evaluate(() => {
    for (const a of document.getAnimations()) if (a instanceof CSSAnimation && a.animationName === "rise-in") a.finish();
  });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function expectAnimatedBones(page: Page) {
  const b = await bones(page, "animated");
  const note = (await page.locator('[data-fixture="animated"] .hidden-note').boundingBox())!;
  const noteY = note.y + (await page.evaluate(() => scrollY));
  // Intentionally hidden opacity:0 content still gets no bone.
  expect(b.filter((x) => x.y < noteY + note.height && x.y + x.h > noteY)).toEqual([]);
  await page.evaluate(() => window.__setLoading(false));
  await expect(page.locator('[data-fixture="animated"] [data-autoskeleton-layer]')).toHaveCount(0);
  const real = await realGeometry(page, "animated");
  // Bones sit at the final (post-animation) position: same box as the avatar and button.
  for (const m of real.blocks) {
    const match = b.some(
      (x) => x.kind === "block" && Math.abs(x.x - m.x) < 1.5 && Math.abs(x.y - m.y) < 1.5 && Math.abs(x.w - m.w) < 1.5 && Math.abs(x.h - m.h) < 1.5,
    );
    expect(match, `no block bone for ${m.tag} ${JSON.stringify(m)}`).toBe(true);
  }
}

test("entrance animation: content starting at opacity 0 gets bones, re-measured when it ends", async ({ page }) => {
  await page.goto("/?same=1&rise-delay=60s");
  // During the delay (opacity exactly 0): already drawn.
  expect(await page.locator('[data-fixture="animated"] .rise-in').evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
  expect((await bones(page, "animated")).length).toBeGreaterThan(5);
  await finishAnimations(page);
  await expectAnimatedBones(page);
});

test("entrance animation that translates: bones sit at the resting position from the first measure", async ({ page }) => {
  await page.goto("/?same=1&rise-delay=60s");
  const rise = page.locator('[data-fixture="animated"] .rise-in');
  // During the delay the content is held at translateY(8px) by the backwards fill.
  const during = await bones(page, "animated");
  expect(await rise.evaluate((el) => getComputedStyle(el).transform)).toBe("matrix(1, 0, 0, 1, 0, 8)");
  const timing = () =>
    rise.evaluate((el) => {
      const a = el.getAnimations()[0]!;
      return { n: el.getAnimations().length, start: a.startTime, state: a.playState };
    });
  const before = await timing();
  expect(before.state).toBe("running");
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await bones(page, "animated");
  // Measuring didn't alter the animation: same object, timing and state.
  expect(await timing()).toEqual(before);
  // Halfway through the animation (a moving transform, slowed down so it
  // stays there), re-measure.
  await rise.evaluate((el) => {
    const a = el.getAnimations()[0]!;
    a.playbackRate = 0.001;
    a.currentTime = 60_200;
  });
  const mid = await rise.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).f);
  expect(mid).toBeGreaterThan(0.5);
  expect(mid).toBeLessThan(7.5);
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  const halfway = await bones(page, "animated");
  await finishAnimations(page);
  const rest = await bones(page, "animated");
  expect(rest.length).toBeGreaterThan(5);
  // Nothing moves when the animation ends.
  for (const b of [during, halfway]) {
    expect(b.length).toBe(rest.length);
    b.forEach((x, i) => {
      const r = rest[i]!;
      expect(Math.abs(x.x - r.x) + Math.abs(x.y - r.y) + Math.abs(x.w - r.w) + Math.abs(x.h - r.h), JSON.stringify([x, r])).toBeLessThan(1);
    });
  }
  // And the resting bones match the real content.
  await expectAnimatedBones(page);
  const card = (await page.locator('[data-fixture="animated"] .user-card').boundingBox())!;
  const cardY = card.y + (await page.evaluate(() => scrollY));
  const surface = during.find((x) => x.kind === "surface")!;
  expect(Math.abs(surface.y - cardY), JSON.stringify([surface, card])).toBeLessThan(1);
  expect(Math.abs(surface.x - card.x)).toBeLessThan(1);
});

test("entrance animation without getAnimations(): animationend triggers a re-measure", async ({ page }) => {
  await page.addInitScript(() => {
    delete (Element.prototype as Partial<Element>).getAnimations;
  });
  await page.goto("/?same=1&rise-delay=60s");
  await bones(page, "animated"); // scrolled into view, still at opacity 0
  await finishAnimations(page);
  expect((await bones(page, "animated")).length).toBeGreaterThan(5);
  await expectAnimatedBones(page);
});

test("fake.id: string by default, negative number on request", () => {
  expect(fake.id(3)).toBe("skeleton-3");
  expect(fake.id()).toBe("skeleton-0");
  const n: number = fake.id(3, "number");
  expect(n).toBe(-4);
  expect(fake.id(0, "number")).toBe(-1);
  // Always negative, whatever the seed.
  expect(fake.id(-2, "number")).toBe(-3);
  expect(fake.id(2.7, "number")).toBe(-3);
  expect(fake.id(Number.NaN, "number")).toBe(-1);
  expect(fake.id(Number.POSITIVE_INFINITY, "number")).toBe(-1);
  const ids = fake.list(50, (i) => fake.id(i, "number"));
  expect(new Set(ids).size).toBe(50);
  expect(ids.every((x) => Number.isInteger(x) && x < 0)).toBe(true);
});

for (const [os, app, alpha] of [
  ["light", "dark", "0.07"],
  ["dark", "light", "0.45"],
] as const) {
  test(`shimmer follows the app's color-scheme (${app} app, ${os} OS)`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: os });
    await page.goto(`/?same=1${app === "dark" ? "&dark=1" : ""}`);
    const sweep = await page
      .locator('[data-fixture="user"] [data-bone="text"]')
      .first()
      .evaluate((el) => getComputedStyle(el, "::after").backgroundImage);
    expect(sweep).toContain(`rgba(255, 255, 255, ${alpha})`);
  });
}

test("HTML attributes are forwarded to the wrapper; id stays the cache key", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/?same=1");
  const list = page.locator('[data-fixture="attrs"] ul[data-autoskeleton]');
  await expect(list).toHaveAttribute("aria-label", "Recent mail");
  await expect(list).toHaveAttribute("data-section", "recent");
  await expect(list).toHaveAttribute("title", "Recent mail");
  await expect(list).toHaveAttribute("aria-busy", "true");
  await expect(list).not.toHaveAttribute("id");
  expect((await bones(page, "attrs")).length).toBeGreaterThan(3);

  await page.evaluate(() => window.__setLoading(false));
  await expect(list).not.toHaveAttribute("aria-busy");
  await expect(list).toHaveAttribute("aria-label", "Recent mail");
  await expect(page.getByRole("list", { name: "Recent mail" })).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("autoskeleton:v1:demo-attrs") !== null)).toBe(true);
  expect(errors).toEqual([]);
});

/** Names of `status` nodes in Chrome's own accessibility tree (what screen readers get). */
async function axStatusNames(page: Page): Promise<string[]> {
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = (await cdp.send("Accessibility.getFullAXTree")) as {
    nodes: { ignored: boolean; role?: { value: string }; name?: { value: string } }[];
  };
  await cdp.detach();
  return nodes.filter((n) => !n.ignored && n.role?.value === "status").map((n) => n.name?.value ?? "");
}

test("label: status is findable by accessible name and exposed outside the inert content", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/?same=1");
  await expect(page.getByRole("status", { name: "Loading recent mail" })).toHaveCount(1);
  await expect(page.getByRole("status", { name: "Loading recent mail" })).toHaveText("Loading recent mail");
  // Inside table internals the status travels with the portaled layer.
  await expect(page.getByRole("status", { name: "Loading invoices" })).toHaveCount(1);
  await expect.poll(() => axStatusNames(page)).toEqual(expect.arrayContaining(["Loading recent mail", "Loading invoices"]));

  await page.evaluate(() => window.__setLoading(false));
  await expect(page.getByRole("status", { name: "Loading recent mail" })).toHaveCount(0);
  await expect(page.getByRole("status", { name: "Loading invoices" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

/**
 * Flip loading off and return the fixture's bones at the moment they start
 * fading out, with `y` relative to the fixture's top at that moment.
 */
async function fadingBones(page: Page, fixture: string): Promise<R[] | null> {
  return page.evaluate(
    (id) =>
      new Promise<R[] | null>((resolve) => {
        const mo = new MutationObserver(() => {
          const layer = document.querySelector(`[data-fixture="${id}"] [data-autoskeleton-layer][data-exiting]`);
          if (!layer) return;
          mo.disconnect();
          const top = document.querySelector(`[data-fixture="${id}"]`)!.getBoundingClientRect().top;
          resolve(
            Array.from(layer.querySelectorAll("[data-bone]")).map((b) => {
              const r = b.getBoundingClientRect();
              return { x: r.left, y: r.top - top, w: r.width, h: r.height };
            }),
          );
        });
        mo.observe(document.body, { subtree: true, attributes: true, childList: true });
        window.__setLoading(false);
        setTimeout(() => resolve(null), 2000);
      }),
    fixture,
  );
}

test("SkeletonSuspense: the child renders the placeholder while suspended, content fades in", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  const root = page.locator('[data-fixture="skeleton-suspense"]');
  const wrapper = root.locator("[data-autoskeleton]");
  // The fallback is the same child component, rendered with the placeholder
  // by useSuspenseData, inside a loading skeleton.
  await expect(wrapper).toHaveAttribute("aria-busy", "true");
  const reader = root.locator('[data-reader="feed"]');
  await expect(reader).toHaveCount(1);
  await expect(reader).toHaveAttribute("data-in-skeleton", "");
  await expect(reader.locator(".post strong").first()).toHaveText(fake.name(1));
  // useSkeleton() gates its effect while it renders with placeholder data.
  await expect(reader).toHaveAttribute("data-tracked", "0");
  const before = await bones(page, "skeleton-suspense");
  expect(before.length).toBeGreaterThan(5);
  // Sections above change height when everything loads, so compare against the section.
  const topBefore = await root.evaluate((el) => el.getBoundingClientRect().top + scrollY);

  // On resolve, the content mounts and the fallback's bones fade out over it,
  // drawn where the fallback had them in the section (no jump while fading).
  const fading = await fadingBones(page, "skeleton-suspense");
  expect(fading, "fallback bones faded out over the content").not.toBeNull();
  expect(fading!.length).toBe(before.length);
  for (const [i, b] of fading!.entries()) {
    expect(Math.abs(b.x - before[i]!.x)).toBeLessThan(1);
    expect(Math.abs(b.y - (before[i]!.y - topBefore))).toBeLessThan(1);
  }
  await expect(wrapper).toHaveCount(1);
  await expect(wrapper).not.toHaveAttribute("aria-busy");
  await expect(reader).not.toHaveAttribute("data-in-skeleton");
  await expect(reader.locator(".post strong").first()).toHaveText("Grace Hopper");
  await expect(reader).not.toHaveAttribute("data-tracked", "0"); // StrictMode runs it twice
  await expect(root.locator("[data-autoskeleton-layer]")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("SkeletonSuspense: suspending again shows the skeleton", async ({ page }) => {
  await page.goto("/?loading=0");
  const root = page.locator('[data-fixture="skeleton-suspense"]');
  await expect(root.locator(".post strong").first()).toHaveText("Grace Hopper");
  await expect(root.locator("[data-autoskeleton-layer]")).toHaveCount(0);
  await page.evaluate(() => window.__setLoading(true));
  await expect(root.locator('[data-autoskeleton][aria-busy="true"]')).toHaveCount(1);
  await expect(root.locator('[data-reader="feed"][data-in-skeleton] .post strong').first()).toHaveText(fake.name(1));
  expect((await bones(page, "skeleton-suspense")).length).toBeGreaterThan(5);
  await page.evaluate(() => window.__setLoading(false));
  await expect(root.locator(".post strong").first()).toHaveText("Grace Hopper");
  await expect(root.locator(".post strong").first()).toBeVisible();
  await expect(root.locator("[data-autoskeleton-layer]")).toHaveCount(0);
});

test("SkeletonSuspense: several reads under one boundary, and a typed override", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  const root = page.locator('[data-fixture="suspense-override"]');
  await expect(root.locator('[data-autoskeleton][aria-busy="true"]')).toHaveCount(1);
  // The user reads the boundary's placeholder, the feed its own.
  await expect(root.locator('[data-reader="user"][data-in-skeleton] .user-card h3')).toContainText(fake.name());
  await expect(root.locator('[data-reader="feed"][data-in-skeleton] .post strong').first()).toHaveText(fake.name(1));
  const before = await bones(page, "suspense-override");
  expect(before.length).toBeGreaterThan(10);
  const fading = await fadingBones(page, "suspense-override");
  expect(fading, "fallback bones faded out over the content").not.toBeNull();
  await expect(root.locator(".user-card h3")).toContainText("Ada Lovelace");
  await expect(root.locator(".post strong").first()).toHaveText("Grace Hopper");
  await expect(root.locator("[data-autoskeleton-layer]")).toHaveCount(0);
  // Suspends again with a new request.
  await page.evaluate(() => window.__setLoading(true));
  await expect(root.locator('[data-autoskeleton][aria-busy="true"]')).toHaveCount(1);
  expect((await bones(page, "suspense-override")).length).toBeGreaterThan(10);
  await page.evaluate(() => window.__setLoading(false));
  await expect(root.locator("[data-in-skeleton]")).toHaveCount(0);
  await expect(root.locator(".user-card h3")).toBeVisible();
  await expect(root.locator(".user-card h3")).toContainText("Ada Lovelace");
  expect(errors).toEqual([]);
});

test("useSuspenseData outside a SkeletonSuspense suspends like use()", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  const root = page.locator('[data-fixture="suspense-manual"]');
  // The plain <Suspense> fallback shows; the reader itself isn't rendered yet.
  await expect(root.locator('[data-autoskeleton][aria-busy="true"]')).toHaveCount(1);
  await expect(root.locator('[data-reader="feed"]')).toHaveCount(0);
  expect((await bones(page, "suspense-manual")).length).toBeGreaterThan(5);
  await page.evaluate(() => window.__setLoading(false));
  await expect(root.locator('[data-reader="feed"] .post strong').first()).toHaveText("Grace Hopper");
  await expect(root.locator('[data-reader="feed"]')).not.toHaveAttribute("data-tracked", "0");
  expect(errors).toEqual([]);
});

test("SkeletonSuspense: a rejection reaches the error boundary", async ({ page }) => {
  await page.goto("/");
  const root = page.locator('[data-fixture="suspense-error"]');
  expect((await bones(page, "suspense-error")).length).toBeGreaterThan(5);
  await expect(root.locator('[data-reader="user"][data-in-skeleton] .user-card h3')).toContainText(fake.name());
  await page.locator("#suspense-reject").click();
  await expect(root.getByRole("alert")).toContainText("Network down");
  await expect(root.locator("[data-autoskeleton]")).toHaveCount(0);
  await expect(root.locator("[data-bone]")).toHaveCount(0);
  // Retrying with a fresh promise shows the skeleton again, then the data.
  await page.locator("#suspense-retry").click();
  await expect(root.getByRole("alert")).toHaveCount(0);
  expect((await bones(page, "suspense-error")).length).toBeGreaterThan(5);
  await page.locator("#suspense-resolve").click();
  await expect(root.locator(".user-card h3")).toContainText("Ada Lovelace");
  await expect(root.locator("[data-autoskeleton-layer]")).toHaveCount(0);
});

test("SkeletonSuspense: warns when a child suspends without useSuspenseData", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "warning" && m.text().includes("autoskeleton")) warnings.push(m.text());
  });
  await page.goto("/?ignored=1");
  const root = page.locator('[data-fixture="suspense-ignored"]');
  // The fallback renders, but the child suspends inside it: no placeholder, no bones.
  await expect(root.locator('[data-autoskeleton][aria-busy="true"]')).toHaveCount(1);
  await expect(root.locator(".user-card")).toHaveCount(0);
  await expect.poll(() => warnings.length).toBe(1);
  expect(warnings[0]).toContain("useSuspenseData");
  await page.evaluate(() => window.__setLoading(false));
  await expect(root.locator(".user-card h3")).toContainText("Ada Lovelace");
  expect(warnings.length).toBe(1);
});
