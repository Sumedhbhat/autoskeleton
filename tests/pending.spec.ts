// The CSS-only approximation shown before hydration (`data-pending`), checked
// on server-rendered markup with JavaScript disabled.
import { expect, test } from "@playwright/test";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { Skeleton } from "../src/Skeleton";
import { autoskeletonCss } from "../src/styles";

test.use({ javaScriptEnabled: false });

const BONE = "rgba(128, 128, 128, 0.18)";
const ORANGE = "#ff6600";

function card() {
  return h(
    "div",
    { className: "card", style: { background: "#fff", border: "1px solid #ddd", padding: 16, width: 360 } },
    h(
      "div",
      { style: { display: "flex", gap: 8, alignItems: "center" } },
      // Avatar: a small brand-coloured box with initials.
      h(
        "div",
        { className: "avatar", style: { width: 32, height: 32, borderRadius: "50%", background: ORANGE, display: "grid", placeItems: "center", color: "#fff" } },
        h("span", null, "AB"),
      ),
      h("strong", null, "Ada Lovelace"),
      h("span", { className: "chip", style: { background: ORANGE, border: "1px solid #cc5200", padding: "2px 6px", borderRadius: 999 } }, "tag"),
      h("a", { className: "cta", href: "#", style: { backgroundImage: `linear-gradient(${ORANGE}, #cc5200)`, padding: "4px 8px", boxShadow: "0 1px 2px #000" } }, "Go ", h("b", null, "now")),
      h("button", { className: "btn", style: { background: ORANGE } }, h("span", null, "Follow")),
    ),
    h("p", { className: "text" }, "Some text"),
  );
}

test("data-pending: small chrome boxes become bone-coloured, card surfaces stay", async ({ page }) => {
  const body = renderToString(h(Skeleton, { loading: true }, card()));
  expect(body).toContain("data-pending");
  await page.setContent(`<!doctype html><html><head><style>${autoskeletonCss}</style></head><body>${body}</body></html>`);
  const style = (sel: string) =>
    page.locator(sel).first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, image: cs.backgroundImage, border: cs.borderTopColor, shadow: cs.boxShadow, radius: cs.borderTopLeftRadius, color: cs.color };
    });

  // Brand-coloured avatar: neutral bone, still round, no pill inside it.
  const avatar = await style(".avatar");
  expect(avatar.bg).toBe(BONE);
  expect(avatar.radius).toBe("50%");
  expect((await style(".avatar span")).bg).toBe("rgba(0, 0, 0, 0)");
  // Chips, gradient links and buttons: bone, no brand border/gradient/shadow.
  const chip = await style(".chip");
  expect(chip.bg).toBe(BONE);
  expect(chip.border).toBe("rgba(0, 0, 0, 0)");
  const cta = await style(".cta");
  expect(cta.bg).toBe(BONE);
  expect(cta.image).toBe("none");
  expect(cta.shadow).toBe("none");
  expect((await style(".cta b")).bg).toBe("rgba(0, 0, 0, 0)");
  expect((await style(".btn")).bg).toBe(BONE);
  expect((await style(".btn span")).bg).toBe("rgba(0, 0, 0, 0)");
  // Leaf text is a bar, text itself is transparent.
  expect((await style(".text")).bg).toBe(BONE);
  expect((await style("strong")).color).toBe("rgba(0, 0, 0, 0)");
  // The card is a surface, as in the measured skeleton: real background and border.
  const surface = await style(".card");
  expect(surface.bg).toBe("rgb(255, 255, 255)");
  expect(surface.border).toBe("rgb(221, 221, 221)");
});
