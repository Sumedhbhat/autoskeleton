/**
 * Turns rendered DOM into a flat list of "bones": rectangles positioned
 * relative to an origin point. Pure DOM in, plain data out, so it can be
 * cached, serialized and tested on its own.
 */

export type BoneKind = "text" | "block" | "surface";

export interface Bone {
  kind: BoneKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** CSS border-radius. */
  r?: string;
  /** Surface chrome copied from the real element (cards, panels). */
  bg?: string;
  border?: string;
  shadow?: string;
}

export interface BoneLayout {
  bones: Bone[];
  /** Bounding size of all measured content, relative to the origin. */
  width: number;
  height: number;
  /** Top-left of the content box relative to the origin. */
  left: number;
  top: number;
  /** True if some content was skipped by `cull` (re-measure on scroll). */
  culled?: boolean;
}

export interface MeasureOptions {
  /**
   * Text bar height as a fraction of the font size. Real text lines are
   * ~1.2em tall; a bar of ~0.7em reads as "a line of text".
   */
  textHeight?: number;
  /** Radius for text bars. */
  textRadius?: string;
  /** Copy card/panel backgrounds, borders and shadows into the skeleton. */
  surfaces?: boolean;
  /** Treat small chrome'd leaf elements (buttons, chips, badges) as one block. */
  maxControlHeight?: number;
  /** Initial clip rect (viewport coords), e.g. from a scrolling ancestor. */
  clip?: Rect | null;
  /**
   * Skip subtrees entirely outside this rect (viewport coords). They still
   * count toward the layout size. Keeps long lists cheap.
   */
  cull?: Rect | null;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A clip rect from an overflow:hidden ancestor, with its corner radii (tl, tr, br, bl). */
interface Clip extends Rect {
  radii?: [number, number, number, number];
}

function cornerRadii(cs: CSSStyleDeclaration, rect: Rect): [number, number, number, number] {
  const w = rect.right - rect.left;
  const h = rect.bottom - rect.top;
  const px = (v: string) => {
    const first = v.split(" ")[0] || "0";
    return first.endsWith("%") ? (parseFloat(first) / 100) * Math.min(w, h) : parseFloat(first) || 0;
  };
  return [px(cs.borderTopLeftRadius), px(cs.borderTopRightRadius), px(cs.borderBottomRightRadius), px(cs.borderBottomLeftRadius)];
}

/**
 * A bone touching a corner of a rounded clipping ancestor (an image at the
 * top of a card with overflow:hidden) inherits that corner's rounding.
 */
function clipRadius(own: string | undefined, rect: Rect, clip: Clip | null): string | undefined {
  if (!clip?.radii || own === "9999px") return own;
  const [ctl, ctr, cbr, cbl] = clip.radii;
  const near = (a: number, b: number) => Math.abs(a - b) < 1.5;
  const t = near(rect.top, clip.top);
  const b = near(rect.bottom, clip.bottom);
  const l = near(rect.left, clip.left);
  const r = near(rect.right, clip.right);
  if (!((t || b) && (l || r))) return own;
  const base = own ? own.split(" ").map((v) => parseFloat(v) || 0) : [0];
  const o = base.length === 4 ? base : [base[0]!, base[0]!, base[0]!, base[0]!];
  const out = [
    t && l ? Math.max(o[0]!, ctl) : o[0]!,
    t && r ? Math.max(o[1]!, ctr) : o[1]!,
    b && r ? Math.max(o[2]!, cbr) : o[2]!,
    b && l ? Math.max(o[3]!, cbl) : o[3]!,
  ];
  if (out.every((v) => v === 0)) return own;
  return out.map((v) => `${v}px`).join(" ");
}

interface TextRect extends Rect {
  fontSize: number;
  /** Id of the inline formatting context the text belongs to. */
  block: number;
}

/** Elements that become one solid block and are not descended into. */
const BLOCK_TAGS = new Set([
  "IMG",
  "SVG",
  "VIDEO",
  "CANVAS",
  "PICTURE",
  "IFRAME",
  "EMBED",
  "OBJECT",
  "INPUT",
  "TEXTAREA",
  "SELECT",
  "BUTTON",
  "PROGRESS",
  "METER",
  "HR",
]);

const CONTROL_ROLES = new Set(["button", "tab", "link", "menuitem", "option", "switch", "checkbox", "radio"]);

/** Elements whose content is never rendered as visible layout. */
const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "TEMPLATE",
  "NOSCRIPT",
  "HEAD",
  "TITLE",
  "META",
  "LINK",
  "DATALIST",
  "OPTION",
]);

export const LAYER_ATTR = "data-autoskeleton-layer";
export const HINT_ATTR = "data-skeleton";
export const FALLBACK_ATTR = "data-autoskeleton-fallback";

function isTransparent(color: string): boolean {
  if (!color || color === "transparent") return true;
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1]!.split(/[\s,/]+/).filter(Boolean);
    if (parts.length >= 4) return parseFloat(parts[3]!) === 0;
    return false;
  }
  // color(srgb ... / 0), oklch(... / 0), etc.
  return /\/\s*0(\.0*)?\s*\)$/.test(color);
}

function hasBorder(cs: CSSStyleDeclaration): boolean {
  return (
    (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== "none" && !isTransparent(cs.borderTopColor)) ||
    (parseFloat(cs.borderBottomWidth) > 0 && cs.borderBottomStyle !== "none" && !isTransparent(cs.borderBottomColor)) ||
    (parseFloat(cs.borderLeftWidth) > 0 && cs.borderLeftStyle !== "none" && !isTransparent(cs.borderLeftColor)) ||
    (parseFloat(cs.borderRightWidth) > 0 && cs.borderRightStyle !== "none" && !isTransparent(cs.borderRightColor))
  );
}

function hasChrome(cs: CSSStyleDeclaration): boolean {
  return (
    !isTransparent(cs.backgroundColor) ||
    cs.backgroundImage !== "none" ||
    hasBorder(cs) ||
    (cs.boxShadow !== "none" && cs.boxShadow !== "")
  );
}

function borderCss(cs: CSSStyleDeclaration): string | undefined {
  if (!hasBorder(cs)) return undefined;
  const side = (s: "Top" | "Right" | "Bottom" | "Left") =>
    `${cs[`border${s}Width`]} ${cs[`border${s}Style`]} ${cs[`border${s}Color`]}`;
  const t = side("Top");
  const r = side("Right");
  const b = side("Bottom");
  const l = side("Left");
  if (t === r && r === b && b === l) return t;
  return [t, r, b, l].join("|");
}

function radiusCss(cs: CSSStyleDeclaration, rect: Rect): string | undefined {
  const parts = [
    cs.borderTopLeftRadius,
    cs.borderTopRightRadius,
    cs.borderBottomRightRadius,
    cs.borderBottomLeftRadius,
  ];
  if (parts.every((p) => !p || p === "0px")) return undefined;
  // Fully rounded square-ish elements (avatars) → perfect circle.
  const w = rect.right - rect.left;
  const h = rect.bottom - rect.top;
  const first = parts[0]!;
  if (parts.every((p) => p === first)) {
    if (first.endsWith("%") && parseFloat(first) >= 50) return "9999px";
    if (parseFloat(first) >= Math.min(w, h) / 2) return "9999px";
    return first;
  }
  return parts.join(" ");
}

function intersect(a: Rect, clip: Rect | null): Rect | null {
  if (!clip) return a;
  const r = {
    left: Math.max(a.left, clip.left),
    top: Math.max(a.top, clip.top),
    right: Math.min(a.right, clip.right),
    bottom: Math.min(a.bottom, clip.bottom),
  };
  if (r.right - r.left < 1 || r.bottom - r.top < 1) return null;
  return r;
}

/** Leaf-ish: contains no element children other than icons/svg/br/inline formatting. */
function isLeafish(el: Element): boolean {
  let textLen = 0;
  const stack: Node[] = Array.from(el.childNodes);
  while (stack.length) {
    const n = stack.pop()!;
    if (n.nodeType === 3) {
      textLen += (n.textContent || "").trim().length;
    } else if (n.nodeType === 1) {
      const c = n as Element;
      const tag = c.tagName.toUpperCase();
      if (tag === "SVG" || tag === "IMG" || tag === "BR" || tag === "I") continue;
      const display = getComputedStyle(c).display;
      if (display.startsWith("inline") || display === "contents" || display === "flex" || display === "inline-flex") {
        stack.push(...Array.from(c.childNodes));
      } else {
        return false;
      }
    }
  }
  return textLen <= 40;
}

export function measureBones(roots: Iterable<Node>, origin: { left: number; top: number }, opts: MeasureOptions = {}): BoneLayout {
  const textHeight = opts.textHeight ?? 0.72;
  const surfaces = opts.surfaces ?? true;
  const maxControlHeight = opts.maxControlHeight ?? 56;

  const blocks: Bone[] = [];
  const surfaceBones: Bone[] = [];
  const texts: TextRect[] = [];
  const bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  const range = typeof document !== "undefined" ? document.createRange() : null;

  const grow = (r: Rect) => {
    if (r.left < bounds.left) bounds.left = r.left;
    if (r.top < bounds.top) bounds.top = r.top;
    if (r.right > bounds.right) bounds.right = r.right;
    if (r.bottom > bounds.bottom) bounds.bottom = r.bottom;
  };

  const pushBlock = (rect: Rect, cs: CSSStyleDeclaration | null, clip: Clip | null, kind: BoneKind = "block") => {
    const b: Bone = {
      kind,
      x: rect.left - origin.left,
      y: rect.top - origin.top,
      w: rect.right - rect.left,
      h: rect.bottom - rect.top,
    };
    const r = clipRadius(cs ? radiusCss(cs, rect) : undefined, rect, clip);
    if (r) b.r = r;
    blocks.push(b);
  };

  let blockSeq = 0;
  const cull = opts.cull ?? null;
  let culled = false;
  const walk = (node: Node, clip: Clip | null, fontSize: number, block: number) => {
    if (node.nodeType === 3) {
      if (!range || !/\S/.test(node.textContent || "")) return;
      range.selectNodeContents(node);
      const rects = range.getClientRects();
      for (let i = 0; i < rects.length; i++) {
        const cr = rects[i]!;
        if (cr.width < 1 || cr.height < 1) continue;
        const r = intersect({ left: cr.left, top: cr.top, right: cr.right, bottom: cr.bottom }, clip);
        if (!r) continue;
        texts.push({ ...r, fontSize, block });
        grow(r);
      }
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    const tag = el.tagName.toUpperCase();
    if (SKIP_TAGS.has(tag) || el.hasAttribute(LAYER_ATTR)) return;
    const hint = el.getAttribute(HINT_ATTR);
    if (hint === "ignore") return;

    const cs = getComputedStyle(el);
    if (cs.display === "none") return;
    if (el.hasAttribute(FALLBACK_ATTR)) return;

    if (cs.display === "contents" && hint !== "keep") {
      for (const child of Array.from(el.childNodes)) walk(child, clip, fontSize, block);
      return;
    }

    const br = el.getBoundingClientRect();
    if (cull && (br.bottom < cull.top || br.top > cull.bottom || br.right < cull.left || br.left > cull.right)) {
      if (br.width || br.height) {
        grow(br);
        culled = true;
      }
      return;
    }
    const rect = intersect({ left: br.left, top: br.top, right: br.right, bottom: br.bottom }, clip);
    const ownFont = parseFloat(cs.fontSize) || fontSize;

    if (hint === "keep") {
      // Rendered for real (made visible by CSS); counts toward bounds only.
      if (rect) grow(rect);
      return;
    }
    if (parseFloat(cs.opacity) === 0) return;

    if (hint === "block" || BLOCK_TAGS.has(tag) || el.getAttribute("role") === "img") {
      if (rect) {
        if (tag === "INPUT" && (el as HTMLInputElement).type === "hidden") return;
        pushBlock(rect, cs, clip);
        grow(rect);
      }
      return;
    }

    if (hint === "text") {
      // Force the whole element to be a single text bar.
      if (rect) {
        texts.push({ ...rect, fontSize: ownFont, block: ++blockSeq });
        grow(rect);
      }
      return;
    }

    // Single-line inline elements with chrome: pills, badges, tags.
    if (rect && cs.display === "inline" && hint !== "surface" && hasChrome(cs) && el.getClientRects().length === 1) {
      if (rect.bottom - rect.top <= maxControlHeight && isLeafish(el)) {
        pushBlock(rect, cs, clip);
        grow(rect);
        return;
      }
    }

    // Other inline elements (<b>, <a>, <code>, <mark>) can wrap across lines;
    // their bounding box would cover the whole paragraph. Treat as text.
    const chrome = cs.display !== "inline" && hasChrome(cs);
    if (rect && chrome) {
      const h = rect.bottom - rect.top;
      const w = rect.right - rect.left;
      const tableish = cs.display.startsWith("table") || cs.display === "list-item";
      const isControl =
        !tableish &&
        h <= maxControlHeight &&
        isLeafish(el) &&
        (cs.display.startsWith("inline") || w <= 240 || CONTROL_ROLES.has(el.getAttribute("role") || ""));
      if (isControl && hint !== "surface") {
        // Buttons, chips, badges, pills: one rounded block.
        pushBlock(rect, cs, clip);
        grow(rect);
        return;
      }
      if (surfaces) {
        const s: Bone = {
          kind: "surface",
          x: rect.left - origin.left,
          y: rect.top - origin.top,
          w: rect.right - rect.left,
          h,
        };
        const r = clipRadius(radiusCss(cs, rect), rect, clip);
        if (r) s.r = r;
        if (!isTransparent(cs.backgroundColor)) s.bg = cs.backgroundColor;
        const border = borderCss(cs);
        if (border) s.border = border;
        if (cs.boxShadow && cs.boxShadow !== "none") s.shadow = cs.boxShadow;
        surfaceBones.push(s);
      }
      grow(rect);
    }

    let nextClip = clip;
    if (cs.overflowX !== "visible" || cs.overflowY !== "visible") {
      nextClip = rect ? { ...rect, radii: cornerRadii(cs, rect) } : { left: 0, top: 0, right: 0, bottom: 0 };
    }
    if (!rect && nextClip !== clip) return;
    // Anything that isn't plain inline starts a new inline formatting context:
    // text inside it never merges with text outside it.
    const nextBlock = cs.display === "inline" ? block : ++blockSeq;
    for (const child of Array.from(el.childNodes)) walk(child, nextClip, ownFont, nextBlock);
    // Open shadow roots (web components).
    if (el.shadowRoot) for (const child of Array.from(el.shadowRoot.childNodes)) walk(child, nextClip, ownFont, nextBlock);
  };

  const rootFont = typeof document !== "undefined" ? parseFloat(getComputedStyle(document.documentElement).fontSize) || 16 : 16;
  for (const root of roots) {
    const parentFont =
      root.parentElement ? parseFloat(getComputedStyle(root.parentElement).fontSize) || rootFont : rootFont;
    walk(root, opts.clip ?? null, parentFont, ++blockSeq);
  }

  const textBones = mergeTextLines(texts).map((t): Bone => {
    const lineH = t.bottom - t.top;
    const barH = Math.min(lineH, Math.max(4, t.fontSize * textHeight));
    return {
      kind: "text",
      x: t.left - origin.left,
      y: t.top - origin.top + (lineH - barH) / 2,
      w: t.right - t.left,
      h: barH,
      ...(opts.textRadius ? { r: opts.textRadius } : {}),
    };
  });

  const bones = [...surfaceBones, ...blocks, ...textBones].map(roundBone);
  if (bounds.left === Infinity) return { bones, width: 0, height: 0, left: 0, top: 0 };
  return {
    bones,
    ...(culled ? { culled } : {}),
    left: round(bounds.left - origin.left),
    top: round(bounds.top - origin.top),
    width: round(bounds.right - bounds.left),
    height: round(bounds.bottom - bounds.top),
  };
}

/**
 * Text arrives as one rect per line *fragment* (each inline element, each
 * wrapped line). Merge fragments that sit on the same visual line and touch,
 * so "Posted by <b>Ada</b> · 2h" becomes a single bar.
 */
export function mergeTextLines(texts: TextRect[]): TextRect[] {
  const sorted = [...texts].sort((a, b) => a.block - b.block || a.top - b.top || a.left - b.left);
  const out: TextRect[] = [];
  let groupStart = 0;
  for (const t of sorted) {
    if (out.length && out[out.length - 1]!.block !== t.block) groupStart = out.length;
    let merged = false;
    for (let i = out.length - 1; i >= groupStart; i--) {
      const o = out[i]!;
      const overlap = Math.min(o.bottom, t.bottom) - Math.max(o.top, t.top);
      if (overlap < Math.min(o.bottom - o.top, t.bottom - t.top) * 0.5) continue;
      const gap = t.left >= o.right ? t.left - o.right : o.left >= t.right ? o.left - t.right : 0;
      if (gap <= Math.max(o.fontSize, t.fontSize) * 1.2) {
        o.left = Math.min(o.left, t.left);
        o.right = Math.max(o.right, t.right);
        o.top = Math.min(o.top, t.top);
        o.bottom = Math.max(o.bottom, t.bottom);
        o.fontSize = Math.max(o.fontSize, t.fontSize);
        merged = true;
        break;
      }
    }
    if (!merged) out.push({ ...t });
  }
  return out;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function roundBone(b: Bone): Bone {
  b.x = round(b.x);
  b.y = round(b.y);
  b.w = round(b.w);
  b.h = round(b.h);
  return b;
}

/** Stable string key for change detection. */
export function layoutKey(l: BoneLayout): string {
  let s = `${l.width}x${l.height}:`;
  for (const b of l.bones) s += `${b.kind[0]}${b.x},${b.y},${b.w},${b.h},${b.r ?? ""},${b.bg ?? ""};`;
  return s;
}
