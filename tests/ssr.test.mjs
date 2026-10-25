// Server rendering smoke test against the built package: `npm run build && node tests/ssr.test.mjs`.
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { Writable } from "node:stream";
import { renderToPipeableStream, renderToString } from "react-dom/server";
import { Skeleton, SkeletonList, SkeletonSuspense, fake, usePlaceholder, useSkeleton, useSuspenseData } from "../dist/index.js";

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

// SkeletonSuspense: the fallback is the child rendering its placeholder data.
const postsPh = [{ title: fake.sentence(5) }];
const list = (posts) => h("ul", null, posts.map((p, i) => h("li", { key: i }, p.title)));
/** Reads the promise with useSuspenseData; marks whether it ran inside the skeleton. */
function Posts({ promise, placeholder }) {
  const posts = useSuspenseData(promise, placeholder);
  return h("section", { "data-skeleton-render": String(useSkeleton()) }, list(posts));
}
// The typed form: no `fallback`, the call passes its own placeholder.
const typed = (promise) => h(SkeletonSuspense, null, h(Posts, { promise, placeholder: postsPh }));
// The untyped shorthand: the boundary's `fallback` for calls without one.
const suspense = (promise, extra) => h(SkeletonSuspense, { fallback: postsPh, ...extra }, h(Posts, { promise }));
const fallbackHtml = renderToString(typed(new Promise(() => {})));
// Inside a Suspense boundary (renderToString can't wait, so it's left for the client).
assert.match(fallbackHtml, /<!--\$[!?]-->(<template[^>]*><\/template>)?<div data-autoskeleton="" aria-busy="true"/);
// The same child, rendered with the placeholder, hidden, inside a loading skeleton.
assert.match(
  fallbackHtml,
  new RegExp(`aria-busy="true" data-pending="" style="display:contents;visibility:hidden">(<!--\\$-->)?<section data-skeleton-render="true"><ul><li>${fake.sentence(5)}</li>`),
);
// The shorthand renders the same skeleton.
assert.equal(renderToString(suspense(new Promise(() => {}))), fallbackHtml);
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
// In an outer skeleton, an inner boundary without `fallback` uses the outer one's for untyped calls.
const inherited = renderToString(
  h(
    SkeletonSuspense,
    { fallback: userPh },
    h(Posts, { promise: new Promise(() => {}), placeholder: postsPh }),
    h(SkeletonSuspense, null, h(User, { promise: new Promise(() => {}) })),
  ),
);
assert.ok(inherited.includes(`<b>${fake.name(3)}</b>`));
// No placeholder anywhere: the call suspends inside the skeleton (no crash, nothing rendered for it).
const missing = renderToString(
  h(SkeletonSuspense, null, h(User, { promise: new Promise(() => {}) }), h(Posts, { promise: new Promise(() => {}), placeholder: postsPh })),
);
assert.match(missing, /aria-busy="true"/);
assert.doesNotMatch(missing, /<b>/);
// Nothing suspends: the content directly, no fallback.
const ready = Object.assign(Promise.resolve([{ title: "Done" }]), { status: "fulfilled", value: [{ title: "Done" }] });
const readyHtml = renderToString(suspense(ready));
assert.match(readyHtml, /<div data-autoskeleton="" style="display:contents"><section data-skeleton-render="false"><ul><li>Done<\/li>/);
assert.ok(!readyHtml.includes(fake.sentence(5)));

// SkeletonSuspense forwards HTML attributes (not `id`) and renders `label` as
// one named status, outside the inert skeleton.
const Items = ({ promise }) => useSuspenseData(promise, postsPh).map((p, i) => h("li", { key: i }, p.title));
const attrsProps = { as: "ul", id: "ssr-suspense-key", "aria-label": "Posts", "data-x": "1", label: "Loading posts" };
const attrsFallback = renderToString(h(SkeletonSuspense, attrsProps, h(Items, { promise: new Promise(() => {}) })));
assert.match(attrsFallback, /<ul aria-label="Posts" data-x="1" data-autoskeleton="" aria-busy="true"/);
assert.equal(attrsFallback.match(/role="status"/g)?.length, 1);
assert.match(attrsFallback, /<\/ul><span data-autoskeleton-sr="" role="status" aria-label="Loading posts">Loading posts<\/span>/);
assert.doesNotMatch(attrsFallback, /id="ssr-suspense-key"/);
const attrsReady = renderToString(h(SkeletonSuspense, attrsProps, h(Items, { promise: ready })));
assert.match(attrsReady, /<ul aria-label="Posts" data-x="1" data-autoskeleton="" style="display:contents"><li>Done<\/li>/);
assert.doesNotMatch(attrsReady, /role="status"| aria-busy=/);

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
  h("main", null, typed(later)),
  () => resolvePosts([{ title: "Streamed" }]),
);
assert.match(streamed.shell, new RegExp(`<!--\\$\\?-->.*aria-busy="true".*data-skeleton-render="true"><ul><li>${fake.sentence(5)}</li>`));
assert.doesNotMatch(streamed.shell, /Streamed/);
// The content's wrapper streams in, then the child's segment fills it.
assert.match(streamed.all, /<div hidden id="S:\d+"><div data-autoskeleton="" style="display:contents">/);
assert.match(streamed.all, /<section data-skeleton-render="false"><ul><li>Streamed<\/li>/);
assert.deepEqual(streamed.errors, []);

// The same with the shorthand.
let resolveShort;
const laterShort = new Promise((r) => (resolveShort = r));
const short = await stream(h("main", null, suspense(laterShort)), () => resolveShort([{ title: "Short" }]));
assert.match(short.shell, new RegExp(`<!--\\$\\?-->.*data-skeleton-render="true"><ul><li>${fake.sentence(5)}</li>`));
assert.match(short.all, /<li>Short<\/li>/);

// No placeholder anywhere: the shell still renders, and the stream finishes once the promise settles.
let resolveUser;
const laterUser = new Promise((r) => (resolveUser = r));
const noPh = await stream(h("main", null, h(SkeletonSuspense, null, h(User, { promise: laterUser }))), () =>
  resolveUser({ name: "Streamed user" }),
);
assert.match(noPh.shell, /aria-busy="true"/);
assert.match(noPh.all, /<b>Streamed user<\/b>/);
assert.deepEqual(noPh.errors, []);

// Rejection: reported through onError, the fallback stays for the client to retry and throw.
let rejectPosts;
const failing = new Promise((_, r) => (rejectPosts = r));
const failed = await stream(
  h("main", null, typed(failing)),
  () => rejectPosts(new Error("boom")),
);
assert.equal(failed.errors[0]?.message, "boom");
assert.match(failed.shell, /aria-busy="true"/);

// SkeletonList: one placeholder item rendered `count` times, then the real items.
const rowPh = { id: "row", title: fake.sentence(4) };
const li = (r) => h("li", { key: r.id }, r.title);
const tr = (r) => h("tr", { key: r.id }, h("td", null, r.title));
const phLi = `<li>${fake.sentence(4)}</li>`;

const pendingList = renderToString(h(SkeletonList, { as: "ul", items: null, placeholder: rowPh, count: 4 }, li));
assert.match(pendingList, new RegExp(`<ul data-autoskeleton="" aria-busy="true" data-pending="" style="display:contents;visibility:hidden">(${phLi}){4}`));
// Default count is 3, and a lazy placeholder works the same.
assert.equal(renderToString(h(SkeletonList, { as: "ul", placeholder: () => rowPh }, li)).split(phLi).length - 1, 3);
// Loaded items render as-is, not busy.
const loadedList = renderToString(h(SkeletonList, { as: "ul", items: [{ id: "a", title: "A" }, { id: "b", title: "B" }], placeholder: rowPh }, li));
assert.match(loadedList, /<ul data-autoskeleton="" style="display:contents"><li>A<\/li><li>B<\/li><\/ul>/);
// Explicit loading over stale items (refetch): the stale rows, hidden.
assert.match(
  renderToString(h(SkeletonList, { as: "ul", items: [{ id: "a", title: "A" }], loading: true, placeholder: rowPh }, li)),
  /aria-busy="true"[^>]*><li>A<\/li><span data-autoskeleton-layer/,
);
// Table: rows straight in the tbody, no layer inside it.
const tableList = renderToString(h("table", null, h(SkeletonList, { as: "tbody", placeholder: rowPh, count: 2 }, tr)));
assert.match(tableList, new RegExp(`<tbody data-autoskeleton="" aria-busy="true"[^>]*>(<tr><td>${fake.sentence(4)}</td></tr>){2}</tbody>`));
assert.doesNotMatch(tableList, /<tbody[^>]*>.*data-autoskeleton-layer.*<\/tbody>/);
// As a SkeletonSuspense fallback: placeholder rows in the shell, one layer
// (the boundary's; the nested list doesn't draw its own), then the streamed rows.
const listFallback = h(SkeletonList, { as: "ul", loading: true, placeholder: rowPh, count: 2 }, li);
const suspenseList = (promise) => h(SkeletonSuspense, { fallback: listFallback }, h(Posts, { promise }));
const pendingSuspenseList = renderToString(suspenseList(new Promise(() => {})));
assert.match(
  pendingSuspenseList,
  new RegExp(`<div data-autoskeleton="" aria-busy="true" data-pending=""[^>]*><ul data-autoskeleton="" aria-busy="true" style="display:contents;visibility:hidden">(${phLi}){2}</ul><span data-autoskeleton-layer`),
);
assert.equal(pendingSuspenseList.match(/<span data-autoskeleton-layer/g)?.length, 1);
let resolveRows;
const rowsLater = new Promise((r) => (resolveRows = r));
const streamedList = await stream(h("main", null, suspenseList(rowsLater)), () => resolveRows([{ title: "Streamed row" }]));
assert.match(streamedList.shell, new RegExp(`<!--\\$\\?-->.*aria-busy="true"[^>]*>(${phLi}){2}`));
assert.doesNotMatch(streamedList.shell, /Streamed row/);
assert.match(streamedList.all, /<ul><li>Streamed row<\/li><\/ul>/);
assert.deepEqual(streamedList.errors, []);

console.log("ssr ok");
