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

/** Roughly `length` characters of word-like text. */
function text(length = 24, seed = length): string {
  const r = rng(seed * 7919 + 13);
  let out = "";
  while (out.length < length) {
    const w = WORDS[Math.floor(r() * WORDS.length)]!;
    out = out ? `${out} ${w}` : w;
  }
  return cap(out.slice(0, Math.max(1, length)).trimEnd());
}

/** A sentence of `words` words, ending in a period. */
function sentence(words = 10, seed = words): string {
  const r = rng(seed * 104729 + 7);
  const out: string[] = [];
  for (let i = 0; i < words; i++) out.push(WORDS[Math.floor(r() * WORDS.length)]!);
  return `${cap(out.join(" "))}.`;
}

/** A paragraph of `sentences` sentences with varied lengths. */
function paragraph(sentences = 3, seed = sentences): string {
  const r = rng(seed * 31337 + 3);
  const out: string[] = [];
  for (let i = 0; i < sentences; i++) out.push(sentence(6 + Math.floor(r() * 10), seed * 100 + i));
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

/** Build `count` items; `make` gets the index so items can vary. */
function list<T>(count: number, make: (index: number) => T): T[] {
  return Array.from({ length: count }, (_, i) => make(i));
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
  return type === "number" ? -1 - (Math.abs(Math.trunc(seed)) || 0) : `skeleton-${seed}`;
}

export const fake = { text, sentence, paragraph, name, email, number, image, list, date, id };
