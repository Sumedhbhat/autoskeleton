"use client";

import {
  version as reactVersion,
  createContext,
  createElement,
  Suspense,
  useContext,
  useEffect,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { loadLayout, normalize, saveLayout, type CachedLayout } from "./cache";
import { FALLBACK_ATTR, LAYER_ATTR, layoutKey, measureBones, type Bone, type BoneLayout, type Rect } from "./measure";
import { autoskeletonCss, injectStyles } from "./styles";
import { createSlot, DEV, PlaceholderContext, type PlaceholderSlot } from "./suspenseData";

// React 19 can hoist and dedupe <style precedence> (also during SSR).
const HOISTED_STYLES = parseInt(reactVersion, 10) >= 19;

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type SkeletonAnimation = "shimmer" | "pulse" | "none";

export interface SkeletonConfig {
  /** Default: "shimmer". */
  animation?: SkeletonAnimation;
  /** Text bar height as a fraction of font size. Default: 0.72. */
  textHeight?: number;
  /** Copy card backgrounds/borders/shadows into the skeleton. Default: true. */
  surfaces?: boolean;
  /** Fade-out duration in ms when loading finishes. Default: 200. */
  fade?: number;
  /** Persist `id` layouts to localStorage. Default: true. */
  persist?: boolean;
  /** Inject the stylesheet at runtime. Set false if you import `autoskeleton/styles.css`. Default: true. */
  injectStyles?: boolean;
  /** CSP nonce for the injected <style>. */
  nonce?: string;
}

const ConfigContext = createContext<SkeletonConfig>({});
const LoadingContext = createContext(false);

/** Sets defaults for every <Skeleton> below it. */
export function SkeletonProvider({ children, ...config }: SkeletonConfig & { children?: ReactNode }): ReactElement {
  const parent = useContext(ConfigContext);
  return createElement(ConfigContext.Provider, { value: { ...parent, ...config } }, children);
}

/**
 * True while any enclosing <Skeleton> is loading. Use it inside components
 * to skip side effects (fetches, analytics, autoplay) while they're being
 * rendered with placeholder data.
 */
export function useSkeleton(): boolean {
  return useContext(LoadingContext);
}

/**
 * Standard HTML attributes (`aria-*`, `data-*`, `role`, `title`, event
 * handlers, ...) forwarded to the wrapper element. Not forwarded: `id` (the
 * cache key), `children`, `nonce` (used for the injected <style>) and
 * `inert`/`aria-busy` while loading (set by the skeleton).
 */
export type SkeletonHTMLAttributes = Omit<HTMLAttributes<HTMLElement>, "id" | "children" | "nonce" | "inert" | "className" | "style"> & {
  [data: `data-${string}`]: string | number | boolean | undefined;
};

/** Props that configure the skeleton; everything else goes to the wrapper element. */
const OWN_PROPS = new Set([
  "loading",
  "id",
  "fallback",
  "label",
  "as",
  "className",
  "style",
  "children",
  "data",
  "placeholder",
  "animation",
  "textHeight",
  "surfaces",
  "fade",
  "persist",
  "injectStyles",
  "nonce",
  "inert",
  // Internal to SkeletonSuspense.
  "handoff",
]);

function htmlAttributes(props: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) if (!OWN_PROPS.has(k)) out[k] = v;
  return out;
}

interface BaseProps extends SkeletonConfig {
  /**
   * Show the skeleton instead of the content. Optional when you pass `data`:
   * then it defaults to `data == null`.
   */
  loading?: boolean;
  /**
   * Cache key. The measured layout is remembered (memory + localStorage), so
   * the skeleton can still be drawn when the children can't render at all
   * while loading (no placeholder data, first paint before data exists).
   * Not forwarded as the wrapper's DOM `id`.
   */
  id?: string;
  /** Rendered (visibly) when there's nothing to measure and nothing cached. */
  fallback?: ReactNode;
  /** Screen-reader text announced while loading (role="status"). Off by default. */
  label?: string;
  /** Element used for the wrapper. It is `display: contents`, so it doesn't affect layout. Default: "div". */
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
}

interface NodeProps extends BaseProps {
  children?: ReactNode;
  data?: never;
  placeholder?: never;
}

interface RenderProps<T> extends BaseProps {
  /** The real data. While it's null/undefined, `placeholder` is rendered instead and measured. */
  data: T | null | undefined;
  /** Stand-in data with the same shape, used to lay out the skeleton. */
  placeholder?: T | (() => T);
  children: (data: T) => ReactNode;
}

export type SkeletonProps<T = unknown> = (NodeProps | RenderProps<T>) & SkeletonHTMLAttributes;

export interface SkeletonSuspenseProps extends SkeletonConfig {
  /**
   * Placeholder data (or `() => data`, called lazily). While the children
   * suspend, they're rendered again as the skeleton, and every
   * `useSuspenseData()` in them returns this instead of suspending. It must
   * have the shape their promise resolves to. Leave it out to draw the
   * `id`-cached layout instead.
   */
  fallback?: unknown;
  /** The content. Read promises with `useSuspenseData(promise)`. */
  children?: ReactNode;
  /** Passed to `<Suspense name>` (React 19 DevTools). */
  name?: string;
  /** Cache key, as on `<Skeleton>`: the content's layout is remembered for when there's no `fallback`. */
  id?: string;
  /** Screen-reader text announced while suspended (role="status"). Off by default. */
  label?: string;
  /** Element used for both wrappers. They are `display: contents`. Default: "div". */
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
}

interface HandoffEntry {
  layout: BoneLayout;
  /** Where the layer the bones are relative to sat, from the wrapper's parent's corner. */
  x: number;
  y: number;
}

/** The last layout a Suspense fallback drew, kept for the content to fade out. */
interface Handoff {
  save(entry: HandoffEntry): void;
  peek(): HandoffEntry | null;
  clear(): void;
}

function createHandoff(): Handoff {
  let last: HandoffEntry | null = null;
  return {
    save: (entry) => void (last = entry),
    peek: () => last,
    clear: () => void (last = null),
  };
}

type ViewProps<T> = (NodeProps | RenderProps<T>) & { handoff?: Handoff };

const EMPTY: BoneLayout = { bones: [], width: 0, height: 0, left: 0, top: 0 };

function ancestorClip(wrapper: Element, layer: HTMLElement): Rect | null {
  const stop = layer.offsetParent;
  let clip: Rect | null = null;
  let el = wrapper.parentElement;
  while (el && el !== stop && el !== document.body) {
    const cs = getComputedStyle(el);
    if (cs.overflowX !== "visible" || cs.overflowY !== "visible") {
      const r = el.getBoundingClientRect();
      clip = clip
        ? {
            left: Math.max(clip.left, r.left),
            top: Math.max(clip.top, r.top),
            right: Math.min(clip.right, r.right),
            bottom: Math.min(clip.bottom, r.bottom),
          }
        : { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }
    el = el.parentElement;
  }
  return clip;
}

function containerWidth(wrapper: Element): number {
  const p = wrapper.parentElement;
  if (!p) return 0;
  const cs = getComputedStyle(p);
  return Math.round(p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
}

function contentRoots(wrapper: Element): Node[] {
  return Array.from(wrapper.childNodes).filter(
    (n) =>
      !(
        n instanceof Element &&
        (n.hasAttribute(LAYER_ATTR) || n.hasAttribute("data-autoskeleton-spacer") || n.hasAttribute(FALLBACK_ATTR))
      ),
  );
}

const MOTION_END = ["animationend", "transitionend"] as const;

const TABLE_PARTS = new Set(["TABLE", "THEAD", "TBODY", "TFOOT", "TR", "COLGROUP"]);

/**
 * Where the bone layer lives. Normally inside the wrapper; inside table
 * internals (where only rows/cells are valid children) it's portaled next to
 * the table instead. Bones are positioned relative to the layer's own box,
 * so the host doesn't change the result.
 */
function tableHost(wrapper: Element): Element | null {
  if (!TABLE_PARTS.has(wrapper.tagName) && !TABLE_PARTS.has(wrapper.parentElement?.tagName ?? "")) return null;
  return wrapper.closest("table")?.parentElement ?? null;
}

function boneStyle(b: Bone, layout: BoneLayout): CSSProperties {
  const s: Record<string, string | number> = {
    left: b.x,
    top: b.y,
    width: b.w,
    height: b.h,
    "--sk-x": `${b.x - layout.left}px`,
  };
  if (b.r) s.borderRadius = b.r;
  if (b.kind === "surface") {
    if (b.bg) s.background = b.bg;
    if (b.border) {
      const parts = b.border.split("|");
      if (parts.length === 4) {
        s.borderTop = parts[0]!;
        s.borderRight = parts[1]!;
        s.borderBottom = parts[2]!;
        s.borderLeft = parts[3]!;
      } else s.border = b.border;
    }
    if (b.shadow) s.boxShadow = b.shadow;
  }
  return s as CSSProperties;
}

function shift(l: BoneLayout, dx: number, dy: number): BoneLayout {
  if (!dx && !dy) return l;
  return { ...l, left: l.left + dx, top: l.top + dy, bones: l.bones.map((b) => ({ ...b, x: b.x + dx, y: b.y + dy })) };
}

/**
 * Wrap any UI. While `loading`, the real children are rendered invisibly
 * (and inert), measured, and replaced on screen by a skeleton with the same
 * shape: one bar per line of text, blocks for images/buttons/inputs, and the
 * card surfaces they sit on.
 */
export function Skeleton<T>(props: SkeletonProps<T>): ReactElement {
  return <SkeletonView<T> {...props} />;
}

/**
 * A `<Suspense>` boundary whose fallback is the children themselves, rendered
 * with placeholder data and drawn as a skeleton. `fallback` is the data:
 * `useSuspenseData(promise)` returns it inside the fallback and reads the
 * promise everywhere else. When the content shows, the fallback's bones fade
 * out over it.
 */
export function SkeletonSuspense({ fallback, children, name, ...view }: SkeletonSuspenseProps): ReactElement {
  // Outlives the fallback, so the content can fade out the fallback's bones.
  const [handoff] = useState(createHandoff);
  const slot = useMemo(() => (fallback === undefined ? null : createSlot(fallback)), [fallback]);
  // Inside another boundary's fallback: be a fallback too (nearest placeholder
  // wins), without starting or waiting on this boundary's promises.
  const inFallback = useContext(PlaceholderContext) !== null;
  if (inFallback) {
    return (
      <SuspenseFallback slot={slot} view={view}>
        {children}
      </SuspenseFallback>
    );
  }
  const skeleton = (
    <SuspenseFallback slot={slot} view={view} handoff={handoff}>
      {children}
    </SuspenseFallback>
  );
  // React 18's <Suspense> ignores `name`.
  return (
    <Suspense fallback={skeleton} name={name}>
      <SkeletonView {...view} loading={false} handoff={handoff}>
        {children}
      </SkeletonView>
    </Suspense>
  );
}

function SuspenseFallback({
  slot,
  view,
  handoff,
  children,
}: {
  slot: PlaceholderSlot | null;
  view: BaseProps;
  handoff?: Handoff;
  children: ReactNode;
}): ReactElement {
  // After the whole fallback rendered: was the placeholder read at all?
  useEffect(() => {
    if (!DEV || !slot?.unused()) return;
    console.warn(
      "autoskeleton: <SkeletonSuspense> got a `fallback`, but no useSuspenseData() call in its children " +
        "returned it, so the skeleton has no placeholder data. Read the children's promises with useSuspenseData(promise).",
    );
  });
  return (
    <PlaceholderContext.Provider value={slot}>
      <SkeletonView {...view} loading handoff={handoff}>
        {/* A child that suspends some other way (useSuspenseQuery, lazy) would
            suspend the fallback too, and the boundary above would show
            instead. Contain it: that part is left out of the skeleton. */}
        {slot ? <Suspense fallback={null}>{children}</Suspense> : null}
      </SkeletonView>
    </PlaceholderContext.Provider>
  );
}

function SkeletonView<T>(props: ViewProps<T>): ReactElement {
  const config = { ...useContext(ConfigContext), ...stripUndefined(props) };
  const ancestorLoading = useContext(LoadingContext);
  const isRenderProp = typeof props.children === "function";
  const loading = props.loading ?? (isRenderProp ? props.data == null : false);
  const showBones = loading && !ancestorLoading;

  let content: ReactNode;
  if (isRenderProp) {
    const p = props as RenderProps<T>;
    let value: T | null | undefined = p.data;
    if (loading && value == null && p.placeholder !== undefined) {
      value = typeof p.placeholder === "function" ? (p.placeholder as () => T)() : p.placeholder;
    }
    content = value == null ? null : p.children(value);
  } else {
    content = props.children as ReactNode;
  }

  const wrapperRef = useRef<HTMLElement>(null);
  const layerRef = useRef<HTMLSpanElement>(null);
  const fade = config.fade ?? 200;
  const handoff = props.handoff;
  const [layout, setLayout] = useState<BoneLayout>(EMPTY);
  const [cached, setCached] = useState<CachedLayout | null>(null);
  const [empty, setEmpty] = useState(false);
  const [exiting, setExiting] = useState(false);
  // Bones handed over by a Suspense fallback, waiting to be anchored here.
  const [entry, setEntry] = useState<HandoffEntry | null>(null);
  // One frame at full opacity before `data-exiting`, so the transition runs.
  const [entering, setEntering] = useState(false);
  const [host, setHost] = useState<Element | null>(null);

  const latest = useRef({ config, showBones, cached });

  const injectEnabled = config.injectStyles !== false;
  useInsertionEffect(() => {
    if (injectEnabled && !HOISTED_STYLES) injectStyles(config.nonce);
  }, [injectEnabled, config.nonce]);
  const [measured, setMeasured] = useState(false);

  const culledRef = useRef(false);
  const measureRef = useRef<() => void>(() => {});
  const measure = () => {
    const wrapper = wrapperRef.current;
    const layer = layerRef.current;
    const { config: cfg, showBones: show, cached: cache } = latest.current;
    if (!wrapper || !layer || !show) return;
    if (!measured) setMeasured(true);
    const origin = layer.getBoundingClientRect();
    const clip = ancestorClip(wrapper, layer);
    const margin = window.innerHeight;
    let next = measureBones(contentRoots(wrapper), origin, {
      textHeight: cfg.textHeight,
      surfaces: cfg.surfaces,
      clip,
      cull: { left: -margin, top: -margin, right: window.innerWidth + margin, bottom: window.innerHeight * 2 },
    });
    culledRef.current = !!next.culled;

    if (next.bones.length === 0) {
      // Nothing renderable to measure: fall back to a remembered layout.
      const hit = cfg.id ? loadLayout(cfg.id, containerWidth(wrapper)) : null;
      if (!hit) {
        if (!empty) setEmpty(true);
        if (cache) setCached(null);
      } else {
        if (empty) setEmpty(false);
        if (!cache || cache.height !== hit.height || cache.containerWidth !== hit.containerWidth) setCached(hit);
        const spacer = wrapper.querySelector(":scope > [data-autoskeleton-spacer]");
        if (spacer) {
          const sr = spacer.getBoundingClientRect();
          const dx = sr.left - origin.left;
          const dy = sr.top - origin.top;
          next = {
            bones: hit.bones.map((b) => ({ ...b, x: b.x + dx, y: b.y + dy })),
            left: dx,
            top: dy,
            width: hit.width,
            height: hit.height,
          };
        }
      }
    } else {
      if (empty) setEmpty(false);
      if (cache) setCached(null);
      if (cfg.id) saveLayout(cfg.id, normalize(next, containerWidth(wrapper)), cfg.persist !== false);
    }

    if (handoff && next.bones.length && wrapper.parentElement) {
      const p = wrapper.parentElement.getBoundingClientRect();
      handoff.save({ layout: next, x: origin.left - p.left, y: origin.top - p.top });
    }
    if (layoutKey(next) !== layoutKey(layout)) setLayout(next);
  };

  // Content revealed by a Suspense boundary (first mount, or shown again
  // after a refetch): pick up the fallback's last bones and fade them out
  // over the content, as if it were the same skeleton.
  useIsoLayoutEffect(() => {
    const h = handoff?.peek();
    if (!h) return;
    handoff!.clear();
    if (showBones || fade <= 0) return;
    setEntry(h);
    setLayout(h.layout);
    setExiting(true);
    setEntering(true);
    // Runs on mount, and again when React reveals hidden content.
  }, [handoff]);

  useIsoLayoutEffect(() => {
    if (!entry || !entering) return;
    const layer = layerRef.current;
    const parent = wrapperRef.current?.parentElement;
    if (layer && parent) {
      // This layer isn't where the fallback's was (that one sat after the
      // placeholder content): re-anchor the bones to where they were drawn.
      const o = layer.getBoundingClientRect();
      const p = parent.getBoundingClientRect();
      setLayout(shift(entry.layout, entry.x - (o.left - p.left), entry.y - (o.top - p.top)));
    }
    let raf = requestAnimationFrame(() => (raf = requestAnimationFrame(() => setEntering(false))));
    return () => cancelAnimationFrame(raf);
  }, [entry, entering]);

  useIsoLayoutEffect(() => {
    const w = wrapperRef.current;
    if (!w) return;
    const h = tableHost(w);
    if (h !== host) setHost(h);
  });

  // Measure synchronously after every render while loading, before paint:
  // the user never sees the hidden content or an empty frame. Observers and
  // timers below call the latest version through measureRef.
  useIsoLayoutEffect(() => {
    latest.current = { config, showBones, cached };
    measureRef.current = measure;
    if (showBones) measure();
  });

  useIsoLayoutEffect(() => {
    const w = wrapperRef.current as (HTMLElement & { inert?: boolean }) | null;
    if (!w) return;
    if (loading) w.setAttribute("inert", "");
    else w.removeAttribute("inert");
  }, [loading]);

  // Re-measure when anything that affects layout changes.
  useEffect(() => {
    if (!showBones) return;
    const wrapper = wrapperRef.current;
    const layer = layerRef.current;
    if (!wrapper || !layer) return;
    let raf = 0;
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(() => ((raf = 0), measureRef.current()));
    };
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    const observeChildren = () => {
      if (!ro) return;
      ro.disconnect();
      if (wrapper.parentElement) ro.observe(wrapper.parentElement);
      for (const n of contentRoots(wrapper)) if (n instanceof Element) ro.observe(n);
    };
    observeChildren();
    const mo = new MutationObserver((records) => {
      if (records.every((r) => layer.contains(r.target))) return;
      if (records.some((r) => r.type === "childList" && r.target === wrapper)) observeChildren();
      schedule();
    });
    mo.observe(wrapper, { subtree: true, childList: true, characterData: true, attributes: true });
    wrapper.addEventListener("load", schedule, true);
    // Entrance animations/transitions (opacity, transform) end without any
    // resize or mutation; re-measure at their final position.
    const onMotionEnd = (e: Event) => {
      if (!(e.target instanceof Node && layer.contains(e.target))) schedule();
    };
    for (const t of MOTION_END) wrapper.addEventListener(t, onMotionEnd, true);
    window.addEventListener("resize", schedule);
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    fonts?.addEventListener?.("loadingdone", schedule);
    // Re-measure on scroll when bones depend on scroll position: clipped by a
    // scrolling ancestor, or partly culled because the content is huge.
    const clipped = ancestorClip(wrapper, layer) !== null;
    const onScroll = () => {
      if (clipped || culledRef.current) schedule();
    };
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      mo.disconnect();
      wrapper.removeEventListener("load", schedule, true);
      for (const t of MOTION_END) wrapper.removeEventListener(t, onMotionEnd, true);
      window.removeEventListener("resize", schedule);
      fonts?.removeEventListener?.("loadingdone", schedule);
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [showBones]);

  // Fade the skeleton out over the real content when loading ends. Derived
  // during render so the layer element stays mounted and its opacity
  // transition actually runs.
  const [prevShow, setPrevShow] = useState(showBones);
  if (prevShow !== showBones) {
    setPrevShow(showBones);
    setExiting(!showBones && fade > 0);
    if (!showBones && fade <= 0) setLayout(EMPTY);
  }
  useEffect(() => {
    if (!exiting || entering) return;
    const t = setTimeout(() => {
      setExiting(false);
      setEntry(null);
      setLayout(EMPTY);
    }, fade);
    return () => clearTimeout(t);
  }, [exiting, entering, fade]);

  // Remember the real content's layout so `id` skeletons match it next time.
  const id = config.id;
  const persist = config.persist !== false;
  useEffect(() => {
    if (loading || !id) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const raf = requestAnimationFrame(() => {
      const l = measureBones(contentRoots(wrapper), { left: 0, top: 0 }, { textHeight: latest.current.config.textHeight });
      if (l.bones.length) saveLayout(id, normalize(l, containerWidth(wrapper)), persist);
    });
    return () => cancelAnimationFrame(raf);
  }, [loading, id, persist]);

  const renderLayer = showBones || exiting;
  const useCache = showBones && content == null && cached !== null;
  const showFallback = showBones && content == null && cached === null && empty && props.fallback !== undefined;

  const layerStyle = { "--sk-w": `${Math.max(layout.width, 1)}px` } as CSSProperties;

  const tableAs = typeof props.as === "string" && TABLE_PARTS.has(props.as.toUpperCase());
  // The content is inert (hidden from assistive tech), so the status lives
  // outside it: next to the wrapper, or in the portaled layer inside tables.
  // aria-label gives it an accessible name; the text is what gets announced.
  const status =
    config.label && showBones ? (
      <span data-autoskeleton-sr="" role="status" aria-label={config.label}>
        {config.label}
      </span>
    ) : null;
  const layer = renderLayer ? (
    <span
      ref={layerRef}
      {...{ [LAYER_ATTR]: "" }}
      data-animation={config.animation ?? "shimmer"}
      data-exiting={exiting && !showBones && !entering ? "" : undefined}
      style={layerStyle}
    >
      {host ? status : null}
      {layout.bones.map((b, i) => (
        <span key={i} data-bone={b.kind} aria-hidden style={boneStyle(b, layout)} />
      ))}
    </span>
  ) : null;

  const Wrapper = props.as ?? "div";
  const attrs = htmlAttributes(props);
  return (
    <LoadingContext.Provider value={ancestorLoading || loading}>
      <Wrapper
        {...attrs}
        ref={wrapperRef}
        data-autoskeleton=""
        aria-busy={loading ? "true" : attrs["aria-busy"]}
        // Not measured yet (server render, before hydration): CSS-only approximation.
        data-pending={showBones && !measured ? "" : undefined}
        className={props.className}
        // Inline so content is hidden even before any stylesheet loads.
        style={{ display: "contents", ...(loading ? { visibility: "hidden" } : null), ...props.style }}
      >
        {injectEnabled && HOISTED_STYLES
          ? createElement("style", { href: "autoskeleton", precedence: "low", nonce: config.nonce }, autoskeletonCss)
          : null}
        {/* Handed-over bones are anchored once, before the content, so they stay put
            if the content's height changes while they fade. */}
        {entry && !host && !tableAs ? layer : null}
        {content}
        {useCache ? <div data-autoskeleton-spacer="" aria-hidden style={{ height: cached!.height }} /> : null}
        {showFallback ? (
          <div {...{ [FALLBACK_ATTR]: "" }} data-skeleton="keep" style={{ display: "contents" }}>
            {props.fallback}
          </div>
        ) : null}
        {entry || host || tableAs ? null : layer}
      </Wrapper>
      {host || tableAs ? null : status}
      {host && layer ? createPortal(layer, host) : null}
    </LoadingContext.Provider>
  );
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k in o) if (o[k] !== undefined) out[k] = o[k];
  return out;
}
