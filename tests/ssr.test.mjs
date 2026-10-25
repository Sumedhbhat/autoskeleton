// Server rendering smoke test against the built package: `npm run build && node tests/ssr.test.mjs`.
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { Writable } from "node:stream";
import { renderToPipeableStream, renderToString } from "react-dom/server";
import { Skeleton, SkeletonSuspense, fake, usePlaceholder, useSkeleton, useSuspenseData } from "../dist/index.js";

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
    h(Skeleton, { as: "ul", id: "attrs-key", loading: true, "aria-label": "Posts", "data-x": "1", role: "list" }, h("li", null, "x")),
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
// HTML attributes reach the wrapper; `id` is the cache key, not a DOM id.
assert.match(html, /<ul aria-label="Posts" data-x="1" role="list" data-autoskeleton=""/);
assert.doesNotMatch(html, /id="attrs-key"/);
// No layer element inside table internals.
assert.doesNotMatch(html, /<tbody[^>]*>.*data-autoskeleton-layer.*<\/tbody>/);
// React 19 hoists the stylesheet exactly once.
if (parseInt((await import("react")).version, 10) >= 19) {
  assert.equal(html.match(/data-href="autoskeleton"/g)?.length, 1);
}

// SkeletonSuspense: the fallback is the child rendering the placeholder data.
const postsPh = [{ title: fake.sentence(5) }];
const list = (posts) => h("ul", null, posts.map((p, i) => h("li", { key: i }, p.title)));
/** Reads the promise with useSuspenseData; marks whether it ran inside the skeleton. */
function Posts({ promise, placeholder }) {
  const posts = useSuspenseData(promise, placeholder);
  return h("section", { "data-skeleton-render": String(useSkeleton()) }, list(posts));
}
const suspense = (promise, extra) => h(SkeletonSuspense, { fallback: postsPh, ...extra }, h(Posts, { promise }));
const fallbackHtml = renderToString(suspense(new Promise(() => {})));
// Inside a Suspense boundary (renderToString can't wait, so it's left for the client).
assert.match(fallbackHtml, /<!--\$[!?]-->(<template[^>]*><\/template>)?<div data-autoskeleton="" aria-busy="true"/);
// The same child, rendered with the placeholder, hidden, inside a loading skeleton.
assert.match(
  fallbackHtml,
  new RegExp(`aria-busy="true" data-pending="" style="display:contents;visibility:hidden">(<!--\\$-->)?<section data-skeleton-render="true"><ul><li>${fake.sentence(5)}</li>`),
);
// Lazy placeholder, and config options reach the fallback skeleton.
assert.match(
  renderToString(suspense(new Promise(() => {}), { fallback: () => postsPh, as: "section", className: "c" })),
  new RegExp(`<section data-autoskeleton="" aria-busy="true" data-pending="" class="c".*<li>${fake.sentence(5)}</li>`),
);
// Nested boundaries: the nearest fallback wins, and the inner one doesn't suspend the outer fallback.
const userPh = { name: fake.name(3) };
function User({ promise }) {
  return h("b", null, useSuspenseData(promise).name);
}
const nested = renderToString(
  h(
    SkeletonSuspense,
    { fallback: postsPh },
    h(Posts, { promise: new Promise(() => {}) }),
    h(SkeletonSuspense, { fallback: userPh }, h(User, { promise: new Promise(() => {}) })),
  ),
);
assert.ok(nested.includes(`<li>${fake.sentence(5)}</li>`));
assert.ok(nested.includes(`<b>${fake.name(3)}</b>`));
// A typed placeholder on the call wins over the boundary's.
const override = renderToString(
  h(SkeletonSuspense, { fallback: userPh }, h(Posts, { promise: new Promise(() => {}), placeholder: [{ title: "Own" }] })),
);
assert.ok(override.includes("<li>Own</li>"));
// Nothing suspends: the content directly, no fallback.
const ready = Object.assign(Promise.resolve([{ title: "Done" }]), { status: "fulfilled", value: [{ title: "Done" }] });
const readyHtml = renderToString(suspense(ready));
assert.match(readyHtml, /<div data-autoskeleton="" style="display:contents"><section data-skeleton-render="false"><ul><li>Done<\/li>/);
assert.ok(!readyHtml.includes(fake.sentence(5)));

/** Stream a tree; resolve `release` after the shell is out. */
function stream(tree, release) {
  return new Promise((resolve) => {
    const chunks = [];
    const errors = [];
    let shell = "";
    const out = new Writable({
      write(c, _e, cb) {
        chunks.push(c.toString());
        cb();
      },
    });
    const s = renderToPipeableStream(tree, {
      onShellReady() {
        s.pipe(out);
        setImmediate(() => {
          shell = chunks.join("");
          release();
        });
      },
      onAllReady() {
        setImmediate(() => resolve({ shell, all: chunks.join(""), errors }));
      },
      onError(e) {
        errors.push(e);
      },
    });
  });
}

// Streaming: fallback in the shell, the real content streamed in once the child stops suspending.
let resolvePosts;
const later = new Promise((r) => (resolvePosts = r));
const streamed = await stream(
  h("main", null, suspense(later)),
  () => resolvePosts([{ title: "Streamed" }]),
);
assert.match(streamed.shell, new RegExp(`<!--\\$\\?-->.*aria-busy="true".*data-skeleton-render="true"><ul><li>${fake.sentence(5)}</li>`));
assert.doesNotMatch(streamed.shell, /Streamed/);
// The content's wrapper streams in, then the child's segment fills it.
assert.match(streamed.all, /<div hidden id="S:\d+"><div data-autoskeleton="" style="display:contents">/);
assert.match(streamed.all, /<section data-skeleton-render="false"><ul><li>Streamed<\/li>/);
assert.deepEqual(streamed.errors, []);

// Rejection: reported through onError, the fallback stays for the client to retry and throw.
let rejectPosts;
const failing = new Promise((_, r) => (rejectPosts = r));
const failed = await stream(
  h("main", null, suspense(failing)),
  () => rejectPosts(new Error("boom")),
);
assert.equal(failed.errors[0]?.message, "boom");
assert.match(failed.shell, /aria-busy="true"/);

console.log("ssr ok");
