"use client";

import {
  version as reactVersion,
  createContext,
  createElement,
  useContext,
  useEffect,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { loadLayout, normalize, saveLayout, type CachedLayout } from "./cache";
import { FALLBACK_ATTR, LAYER_ATTR, layoutKey, measureBones, type Bone, type BoneLayout, type Rect } from "./measure";
import { autoskeletonCss, injectStyles } from "./styles";

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

export type SkeletonProps<T = unknown> = NodeProps | RenderProps<T>;

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

/**
 * Wrap any UI. While `loading`, the real children are rendered invisibly
 * (and inert), measured, and replaced on screen by a skeleton with the same
 * shape: one bar per line of text, blocks for images/buttons/inputs, and the
 * card surfaces they sit on.
 */
export function Skeleton<T>(props: SkeletonProps<T>): ReactElement {
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
  const [layout, setLayout] = useState<BoneLayout>(EMPTY);
  const [cached, setCached] = useState<CachedLayout | null>(null);
  const [empty, setEmpty] = useState(false);
  const [exiting, setExiting] = useState(false);
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

    if (layoutKey(next) !== layoutKey(layout)) setLayout(next);
  };

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
      window.removeEventListener("resize", schedule);
      fonts?.removeEventListener?.("loadingdone", schedule);
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [showBones]);

  // Fade the skeleton out over the real content when loading ends. Derived
  // during render so the layer element stays mounted and its opacity
  // transition actually runs.
  const fade = config.fade ?? 200;
  const [prevShow, setPrevShow] = useState(showBones);
  if (prevShow !== showBones) {
    setPrevShow(showBones);
    setExiting(!showBones && fade > 0);
    if (!showBones && fade <= 0) setLayout(EMPTY);
  }
  useEffect(() => {
    if (!exiting) return;
    const t = setTimeout(() => {
      setExiting(false);
      setLayout(EMPTY);
    }, fade);
    return () => clearTimeout(t);
  }, [exiting, fade]);

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
  const layer = renderLayer ? (
    <span
      ref={layerRef}
      {...{ [LAYER_ATTR]: "" }}
      data-animation={config.animation ?? "shimmer"}
      data-exiting={exiting && !showBones ? "" : undefined}
      style={layerStyle}
    >
      {config.label && showBones ? (
        <span data-autoskeleton-sr="" role="status">
          {config.label}
        </span>
      ) : null}
      {layout.bones.map((b, i) => (
        <span key={i} data-bone={b.kind} aria-hidden style={boneStyle(b, layout)} />
      ))}
    </span>
  ) : null;

  const Wrapper = props.as ?? "div";
  return (
    <LoadingContext.Provider value={ancestorLoading || loading}>
      <Wrapper
        ref={wrapperRef}
        data-autoskeleton=""
        aria-busy={loading ? "true" : undefined}
        // Not measured yet (server render, before hydration): CSS-only approximation.
        data-pending={showBones && !measured ? "" : undefined}
        className={props.className}
        // Inline so content is hidden even before any stylesheet loads.
        style={{ display: "contents", ...(loading ? { visibility: "hidden" } : null), ...props.style }}
      >
        {injectEnabled && HOISTED_STYLES
          ? createElement("style", { href: "autoskeleton", precedence: "low", nonce: config.nonce }, autoskeletonCss)
          : null}
        {content}
        {useCache ? <div data-autoskeleton-spacer="" aria-hidden style={{ height: cached!.height }} /> : null}
        {showFallback ? (
          <div {...{ [FALLBACK_ATTR]: "" }} data-skeleton="keep" style={{ display: "contents" }}>
            {props.fallback}
          </div>
        ) : null}
        {host || tableAs ? null : layer}
      </Wrapper>
      {host && layer ? createPortal(layer, host) : null}
    </LoadingContext.Provider>
  );
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k in o) if (o[k] !== undefined) out[k] = o[k];
  return out;
}
