/**
 * Deterministic placeholder data. Skeletons are measured from your real
 * component rendered with stand-in data, so the stand-in only needs the right
 * *shape* and roughly the right *length*. Everything here is pure and
 * seed-stable, so server and client render identical markup.
 */

const WORDS =
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum".split(
    " ",
  );

function rng(seed: number): () => number {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * A length: an exact number, or a `[min, max]` range. A range picks a whole
 * number in it from the seed, so rows seeded by their index vary in length
 * but render the same on the server and the client.
 */
export type Length = number | readonly [min: number, max: number];

function size(length: Length, seed: number): number {
  if (typeof length === "number") return length;
  const lo = Math.round(Math.min(length[0], length[1]));
  const hi = Math.round(Math.max(length[0], length[1]));
  return lo + Math.floor(rng(seed * 2246822519 + 29)() * (hi - lo + 1));
}

const first = (length: Length): number => (typeof length === "number" ? length : length[0]);

/** Roughly `length` characters of word-like text. */
function text(length: Length = 24, seed = first(length)): string {
  const chars = size(length, seed);
  const r = rng(seed * 7919 + 13);
  let out = "";
  while (out.length < chars) {
    const w = WORDS[Math.floor(r() * WORDS.length)]!;
    out = out ? `${out} ${w}` : w;
  }
  return cap(out.slice(0, Math.max(1, chars)).trimEnd());
}

/** A sentence of `words` words, ending in a period. */
function sentence(words: Length = 10, seed = first(words)): string {
  const count = size(words, seed);
  const r = rng(seed * 104729 + 7);
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(WORDS[Math.floor(r() * WORDS.length)]!);
  return `${cap(out.join(" "))}.`;
}

/** A paragraph of `sentences` sentences with varied lengths. */
function paragraph(sentences: Length = 3, seed = first(sentences)): string {
  const count = size(sentences, seed);
  const r = rng(seed * 31337 + 3);
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(sentence(6 + Math.floor(r() * 10), seed * 100 + i));
  return out.join(" ");
}

/** A two-word person name. */
function name(seed = 1): string {
  const r = rng(seed * 4241 + 1);
  const pick = () => cap(WORDS[Math.floor(r() * WORDS.length)]!);
  return `${pick()} ${pick()}`;
}

function email(seed = 1): string {
  return `${name(seed).toLowerCase().replace(" ", ".")}@example.com`;
}

/** A digit string of `digits` length (as a number). */
function number(digits = 3): number {
  return Number("8".repeat(Math.max(1, digits)));
}

/**
 * A transparent image URL with real intrinsic dimensions, so an <img>
 * without explicit width/height still lays out at the right size.
 */
function image(width = 400, height = 300): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"/>`,
  )}`;
}

/** Options for `fake.list`. */
export interface ListOptions<T> {
  /**
   * The field that keys each row. Default: `"id"`. `false` keeps every
   * field as written, e.g. an id that is shown on screen (`"INV-001"`).
   */
  key?: keyof T | false;
}

const isRecord = (value: unknown): value is Record<PropertyKey, unknown> => {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/**
 * `count` placeholder rows, each with its own id. `item` is one row (copied
 * per row) or `(index) => row`, so rows can vary, e.g. `fake.sentence([6, 12], i)`.
 *
 * When a row has the `key` field (`id` by default), the list overwrites it
 * with a unique id of the same type: `fake.id(i, "number")` (`-1`, `-2`, …)
 * for a number, `fake.id(i)` (`"skeleton-0"`, …) otherwise. So rows key
 * cleanly and never match a real record.
 */
function list<T>(count: number, item: T | ((index: number) => T), options?: ListOptions<T>): T[] {
  const key = options?.key ?? "id";
  return Array.from({ length: count }, (_, i) => {
    const row = typeof item === "function" ? (item as (index: number) => T)(i) : item;
    if (!isRecord(row)) return row;
    if (key === false || !(key in row)) return { ...row } as T;
    return { ...row, [key]: typeof row[key] === "number" ? id(i, "number") : id(i) } as T;
  });
}

/** A fixed ISO date string (stable across server and client). */
function date(): string {
  return "2024-01-01T00:00:00.000Z";
}

/**
 * A unique, stable placeholder id: `"skeleton-<seed>"`, or with `"number"`
 * a negative number (`-1 - seed`) that can't collide with real (positive)
 * numeric ids. Seeds are indices: the sign and any fraction are dropped, so
 * the numeric id is always a negative integer.
 */
function id(seed?: number): string;
function id(seed: number, type: "number"): number;
function id(seed = 0, type?: "number"): string | number {
  return type === "number" ? -1 - (Number.isFinite(seed) ? Math.abs(Math.trunc(seed)) : 0) : `skeleton-${seed}`;
}

export const fake = { text, sentence, paragraph, name, email, number, image, list, date, id };
