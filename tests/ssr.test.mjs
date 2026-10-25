// Server rendering smoke test against the built package: `npm run build && node tests/ssr.test.mjs`.
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { Skeleton, fake, usePlaceholder } from "../dist/index.js";

// usePlaceholder: nested fields straight in JSX, no children function.
let lazyCalls = 0;
const lazyProfile = () => (lazyCalls++, { user: { name: fake.name(7) } });
function Profile({ data }) {
  const { data: d, loading } = usePlaceholder(data, lazyProfile);
  return h(Skeleton, { loading }, h("i", null, d.user.name));
}

const html = renderToString(
  h(
    "div",
    null,
    h(Skeleton, { loading: true }, h("p", null, "Hello")),
    h(Skeleton, { data: undefined, placeholder: { name: fake.name() } }, (u) => h("b", null, u.name)),
    h(Skeleton, { data: { name: "Real" } }, (u) => h("b", null, u.name)),
    h(Profile, { data: undefined }),
    h(Profile, { data: { user: { name: "Loaded" } } }),
    h("table", null, h(Skeleton, { as: "tbody", loading: true }, h("tr", null, h("td", null, "x")))),
  ),
);

// Loading content is hidden inline, so it never flashes before CSS loads.
assert.match(html, /aria-busy="true" data-pending="" style="display:contents;visibility:hidden"><p>Hello<\/p>/);
// Placeholder data renders on the server, deterministically.
assert.ok(html.includes(`<b>${fake.name()}</b>`));
// Loaded content is visible and not busy.
assert.match(html, /<div data-autoskeleton="" style="display:contents"><b>Real<\/b>/);
// usePlaceholder: placeholder while loading (lazy form only called when needed), real data after.
assert.match(html, new RegExp(`aria-busy="true"[^>]*><i>${fake.name(7)}</i>`));
assert.match(html, /<div data-autoskeleton="" style="display:contents"><i>Loaded<\/i>/);
assert.equal(lazyCalls, 1);
// No layer element inside table internals.
assert.doesNotMatch(html, /<tbody[^>]*>.*data-autoskeleton-layer.*<\/tbody>/);
// React 19 hoists the stylesheet exactly once.
if (parseInt((await import("react")).version, 10) >= 19) {
  assert.equal(html.match(/data-href="autoskeleton"/g)?.length, 1);
}
console.log("ssr ok");
