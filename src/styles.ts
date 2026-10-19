/**
 * All styling lives in one stylesheet, injected once on the client (or
 * shipped as `autoskeleton/styles.css` for SSR / strict CSP setups).
 *
 * Theme with CSS variables on any ancestor:
 *   --autoskeleton-color       bone color
 *   --autoskeleton-highlight   shimmer highlight
 *   --autoskeleton-radius      block radius fallback
 *   --autoskeleton-text-radius text bar radius
 *   --autoskeleton-duration    animation duration
 */
export const autoskeletonCss = `
[data-autoskeleton][aria-busy="true"]{visibility:hidden}
[data-autoskeleton][data-pending]{visibility:visible!important}
[data-autoskeleton][data-pending] *{color:transparent!important;text-decoration-color:transparent!important;visibility:visible!important}
[data-autoskeleton][data-pending] :where(img,svg,video,canvas,iframe,input,textarea,select,button,progress,meter,[role=img]){background:var(--autoskeleton-color,rgba(128,128,128,.18))!important;border-color:transparent!important;object-position:-99999px 0;fill:transparent;stroke:transparent}
[data-autoskeleton][data-pending] :where(p,h1,h2,h3,h4,h5,h6,span,a,label,small,strong,b,em,code,figcaption,blockquote):not(:has(*)){background:var(--autoskeleton-color,rgba(128,128,128,.18))!important;border-radius:var(--autoskeleton-text-radius,4px)}
[data-autoskeleton][aria-busy="true"] [data-skeleton="keep"]{visibility:visible}
[data-autoskeleton-layer]{display:block;position:absolute;width:0;height:0;overflow:visible;visibility:visible;pointer-events:none;z-index:var(--autoskeleton-z,1);transition:opacity var(--autoskeleton-fade,200ms) ease}
[data-autoskeleton-layer][data-exiting]{opacity:0}
[data-autoskeleton-layer] [data-bone]{display:block;position:absolute;box-sizing:border-box;overflow:hidden;background:var(--autoskeleton-color,rgba(128,128,128,.18));border-radius:var(--autoskeleton-radius,4px)}
[data-autoskeleton-layer] [data-bone="text"]{border-radius:var(--autoskeleton-text-radius,4px)}
[data-autoskeleton-layer] [data-bone="surface"]{background:transparent;overflow:visible}
[data-autoskeleton-layer] [data-bone]:not([data-bone="surface"])::after{content:"";position:absolute;top:0;bottom:0;left:calc(var(--sk-x,0px) * -1);width:var(--sk-w,100vw);min-width:200px;background:linear-gradient(90deg,transparent 0,transparent 35%,var(--autoskeleton-highlight,var(--sk-hl)) 50%,transparent 65%,transparent 100%);transform:translateX(-100%);animation:autoskeleton-shimmer var(--autoskeleton-duration,1.6s) ease-in-out infinite}
[data-autoskeleton-layer][data-animation="pulse"] [data-bone]:not([data-bone="surface"])::after{content:none}
[data-autoskeleton-layer][data-animation="pulse"] [data-bone]:not([data-bone="surface"]){animation:autoskeleton-pulse var(--autoskeleton-duration,1.6s) ease-in-out infinite}
[data-autoskeleton-layer][data-animation="none"] [data-bone]::after{content:none}
[data-autoskeleton-sr]{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
[data-autoskeleton-spacer]{display:block;width:100%;visibility:hidden}
@keyframes autoskeleton-shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
@keyframes autoskeleton-pulse{0%,100%{opacity:1}50%{opacity:.45}}
[data-autoskeleton-layer]{--sk-hl:rgba(255,255,255,.45)}
@media (prefers-color-scheme:dark){[data-autoskeleton-layer]{--sk-hl:rgba(255,255,255,.07)}}
@media (prefers-reduced-motion:reduce){[data-autoskeleton-layer] [data-bone]::after{content:none}[data-autoskeleton-layer] [data-bone]{animation:none!important}}
`.trim();

const STYLE_ID = "autoskeleton-styles";

export function injectStyles(nonce?: string): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  if (nonce) el.nonce = nonce;
  el.textContent = autoskeletonCss;
  // Prepend so user styles (and CSS variables) win on equal specificity.
  document.head.insertBefore(el, document.head.firstChild);
}
