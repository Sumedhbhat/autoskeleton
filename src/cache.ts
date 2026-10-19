import type { Bone, BoneLayout } from "./measure";

/**
 * Remembered layouts, keyed by the `id` you give a <Skeleton>. Used when the
 * children cannot render at all while loading (no placeholder data, Suspense
 * fallbacks): we draw the bones from the last time this skeleton (or its real
 * content) was on screen.
 */
export interface CachedLayout {
  /** Width of the box the content was laid out in. */
  containerWidth: number;
  width: number;
  height: number;
  /** Bones relative to the content's top-left corner. */
  bones: Bone[];
}

const PREFIX = "autoskeleton:v1:";
const MAX_WIDTHS = 4;
const memory = new Map<string, CachedLayout[]>();

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function read(id: string): CachedLayout[] {
  const hit = memory.get(id);
  if (hit) return hit;
  const s = storage();
  if (!s) return [];
  try {
    const raw = s.getItem(PREFIX + id);
    const parsed = raw ? (JSON.parse(raw) as CachedLayout[]) : [];
    memory.set(id, parsed);
    return parsed;
  } catch {
    return [];
  }
}

export function normalize(layout: BoneLayout, containerWidth: number): CachedLayout {
  return {
    containerWidth,
    width: layout.width,
    height: layout.height,
    bones: layout.bones.map((b) => ({ ...b, x: b.x - layout.left, y: b.y - layout.top })),
  };
}

export function saveLayout(id: string, entry: CachedLayout, persist: boolean): void {
  if (!entry.bones.length) return;
  const list = read(id).filter((e) => Math.abs(e.containerWidth - entry.containerWidth) > 24);
  list.unshift(entry);
  list.length = Math.min(list.length, MAX_WIDTHS);
  memory.set(id, list);
  if (!persist) return;
  const s = storage();
  try {
    s?.setItem(PREFIX + id, JSON.stringify(list));
  } catch {
    // Quota exceeded or storage disabled: memory cache still works.
  }
}

/** The cached layout closest to `containerWidth`, scaled horizontally to fit. */
export function loadLayout(id: string, containerWidth: number): CachedLayout | null {
  const list = read(id);
  if (!list.length) return null;
  let best = list[0]!;
  for (const e of list) {
    if (Math.abs(e.containerWidth - containerWidth) < Math.abs(best.containerWidth - containerWidth)) best = e;
  }
  if (!containerWidth || Math.abs(best.containerWidth - containerWidth) < 1) return best;
  const sx = containerWidth / best.containerWidth;
  return {
    containerWidth,
    width: best.width * sx,
    height: best.height,
    bones: best.bones.map((b) => ({ ...b, x: b.x * sx, w: b.w * sx })),
  };
}

export function clearSkeletonCache(id?: string): void {
  const s = storage();
  if (id) {
    memory.delete(id);
    s?.removeItem(PREFIX + id);
    return;
  }
  memory.clear();
  if (!s) return;
  for (let i = s.length - 1; i >= 0; i--) {
    const k = s.key(i);
    if (k?.startsWith(PREFIX)) s.removeItem(k);
  }
}
