import { jsxs as y, jsx as u } from "react/jsx-runtime";
import { useState as S, useRef as L, useEffect as P, useCallback as b } from "react";
import { GripHorizontal as C, X as G } from "lucide-react";
const c = 12, O = 4;
function m(o, r, l) {
  if (typeof window > "u") return { x: o, y: r };
  const i = Math.min(l, window.innerWidth - c * 2), w = Math.max(c, window.innerWidth - i - c), p = Math.min(window.innerHeight * 0.9, 860), x = Math.max(c, window.innerHeight - p - c);
  return {
    x: Math.min(w, Math.max(c, o)),
    y: Math.min(x, Math.max(c, r))
  };
}
function W(o) {
  if (typeof window > "u") return { x: 24, y: 72 };
  const r = Math.min(o, window.innerWidth - c * 2);
  return m(window.innerWidth - r - 20, 72, o);
}
function T(o, r) {
  try {
    const l = localStorage.getItem(o);
    if (!l) return W(r);
    const i = JSON.parse(l);
    if (typeof i.x == "number" && typeof i.y == "number")
      return m(i.x, i.y, r);
  } catch {
  }
  return W(r);
}
function j(o, r) {
  try {
    localStorage.setItem(o, JSON.stringify(r));
  } catch {
  }
}
function U({
  id: o,
  open: r,
  title: l,
  subtitle: i = "拖动标题可移动",
  titleIcon: w,
  storageKey: p,
  ariaLabel: x,
  className: Y = "",
  width: a = 360,
  placement: I = "floating",
  showHeader: E = !0,
  onClose: k,
  toolbar: M,
  children: $
}) {
  const N = I === "workspace", X = I === "dock-right", s = X || N, [f, h] = S(() => T(p, a)), [v, D] = S(!1), g = L(null);
  P(() => {
    !r || s || h((e) => m(e.x, e.y, a));
  }, [s, r, a]), P(() => {
    if (!r || s) return;
    const e = () => h((n) => m(n.x, n.y, a));
    return window.addEventListener("resize", e), () => window.removeEventListener("resize", e);
  }, [s, r, a]), P(() => {
    if (!r) return;
    const e = (n) => {
      var d;
      if (n.key !== "Escape") return;
      const t = n.target;
      (d = t == null ? void 0 : t.closest) != null && d.call(t, "textarea, input, select, [contenteditable='true']") || (n.preventDefault(), k());
    };
    return window.addEventListener("keydown", e), () => window.removeEventListener("keydown", e);
  }, [r, k]);
  const z = b((e) => {
    var n, t;
    s || e.button === 0 && ((t = (n = e.target) == null ? void 0 : n.closest) != null && t.call(n, "button") || (e.currentTarget.setPointerCapture(e.pointerId), g.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: f.x,
      originY: f.y,
      moved: !1
    }, D(!0)));
  }, [s, f.x, f.y]), H = b((e) => {
    const n = g.current;
    if (!n || n.pointerId !== e.pointerId) return;
    const t = e.clientX - n.startX, d = e.clientY - n.startY;
    !n.moved && Math.hypot(t, d) < O || (n.moved = !0, h(m(n.originX + t, n.originY + d, a)));
  }, [a]), R = b((e) => {
    const n = g.current;
    if (!(!n || n.pointerId !== e.pointerId)) {
      g.current = null, D(!1);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
      }
      n.moved && h((t) => {
        const d = m(t.x, t.y, a);
        return j(p, d), d;
      });
    }
  }, [p, a]);
  return r ? /* @__PURE__ */ y(
    "aside",
    {
      id: o,
      className: `reader-notes-panel reader-notes-panel--${N ? "workspace" : X ? "docked" : "float"}${s ? "" : " reader-floating-surface"}${E ? " has-panel-header" : " is-headerless"}${M ? " has-panel-toolbar" : ""}${v ? " is-dragging" : ""} ${Y}`.trim(),
      style: s ? void 0 : { left: f.x, top: f.y, width: Math.min(a, typeof window < "u" ? window.innerWidth - 24 : a) },
      "aria-label": x,
      role: "dialog",
      "aria-modal": "false",
      children: [
        E ? /* @__PURE__ */ y(
          "header",
          {
            className: "reader-notes-panel-head",
            onPointerDown: z,
            onPointerMove: H,
            onPointerUp: R,
            onPointerCancel: R,
            children: [
              s ? null : /* @__PURE__ */ u("div", { className: "reader-notes-panel-drag", "aria-hidden": "true", children: /* @__PURE__ */ u(C, { size: 14, strokeWidth: 2.25 }) }),
              /* @__PURE__ */ y("div", { className: "reader-notes-panel-head-text", children: [
                /* @__PURE__ */ y("strong", { children: [
                  w,
                  l
                ] }),
                i ? /* @__PURE__ */ u("span", { children: i }) : null
              ] }),
              /* @__PURE__ */ u("button", { type: "button", className: "reader-notes-close reader-floating-close", "aria-label": `关闭${l}`, onClick: k, children: /* @__PURE__ */ u(G, { size: 14, strokeWidth: 2.5, "aria-hidden": !0 }) })
            ]
          }
        ) : null,
        M ? /* @__PURE__ */ u("div", { className: "reader-notes-panel-toolbar", children: M }) : null,
        /* @__PURE__ */ u("div", { className: "reader-notes-panel-body", children: $ })
      ]
    }
  ) : null;
}
export {
  U as R
};
//# sourceMappingURL=ReaderFloatShell-DTFWp_bv.js.map
