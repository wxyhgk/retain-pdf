let v = 0, b = null, w = null, C = !1;
function $(t = Date.now()) {
  return t < v;
}
function D(t = 700) {
  const a = Date.now() + Math.max(0, t);
  a > v && (v = a);
}
function j() {
  v = 0, b == null || b(), b = null, _();
}
function I() {
  if (typeof document > "u") return null;
  if (w && w.isConnected) return w;
  const t = document.createElement("div");
  t.setAttribute("data-reader-ai-pointer-shield", "1"), t.setAttribute("aria-hidden", "true"), Object.assign(t.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483000",
    cursor: "progress",
    background: "transparent",
    // 只作为切会话期间的状态标记，不再成为全屏命中目标。
    // 真正需要阻止的是引用/链接导航；编辑器、按钮和文本选择必须可用。
    pointerEvents: "none"
  });
  const a = (e) => {
    var r;
    e.preventDefault(), e.stopPropagation(), (r = e.stopImmediatePropagation) == null || r.call(e);
  };
  for (const e of [
    "pointerdown",
    "pointerup",
    "mousedown",
    "mouseup",
    "click",
    "auxclick",
    "dblclick",
    "contextmenu",
    "touchstart",
    "touchend"
  ])
    t.addEventListener(e, a, { capture: !0, passive: !1 });
  return document.documentElement.appendChild(t), w = t, t;
}
function _() {
  if (w) {
    try {
      w.remove();
    } catch {
    }
    w = null;
  }
}
function F(t = 700, a = {}) {
  if (D(t), typeof document > "u") return;
  b == null || b(), b = null;
  const e = Date.now() + Math.max(0, t), r = Math.max(0, Number(a.overlayDelayMs) || 0);
  let n = null;
  r === 0 ? I() : n = setTimeout(() => {
    n = null, Date.now() < e && I();
  }, r);
  const o = (i) => {
    var d;
    if (Date.now() >= e) {
      s();
      return;
    }
    const l = i.target;
    l instanceof Element && l.closest(
      "[data-reader-ai-sessions], [data-reader-ai-actions], [data-reader-ai-composer], .aui-composer, input, textarea, select, [contenteditable='true']"
    ) || (i.preventDefault(), i.stopPropagation(), (d = i.stopImmediatePropagation) == null || d.call(i));
  }, c = { capture: !0, passive: !1 }, u = ["click", "auxclick", "dblclick", "pointerup", "mouseup"], s = () => {
    n != null && (clearTimeout(n), n = null);
    for (const i of u)
      document.removeEventListener(i, o, c);
    _(), b === s && (b = null);
  };
  for (const i of u)
    document.addEventListener(i, o, c);
  b = s, window.setTimeout(s, Math.max(0, t) + 48);
}
function M(t) {
  return $() ? !0 : t ? typeof MouseEvent < "u" && t instanceof MouseEvent && t.isTrusted === !1 : !1;
}
function q() {
  if (typeof window > "u" || typeof window.open != "function")
    return () => {
    };
  if (C) return () => {
  };
  C = !0, j();
  const t = window.open.bind(window);
  window.open = ((e, r, n) => $() ? null : t(e, r, n));
  const a = (e) => {
    if (!$()) return;
    const r = e.target;
    if (!(r instanceof Element) || r.closest("[data-reader-ai-sessions]")) return;
    r.closest("a[href]") && (e.preventDefault(), e.stopPropagation());
  };
  return document.addEventListener("click", a, !0), () => {
    window.open = t, document.removeEventListener("click", a, !0), C = !1, j();
  };
}
let N = (t) => `${t ?? ""}`.trim(), U = globalThis.fetch ?? (async () => {
  throw new Error("fetch not available");
});
function O(t = {}) {
  t.resolveResourceUrl && (N = t.resolveResourceUrl), t.fetchProtected && (U = t.fetchProtected);
}
function G() {
  N = (t) => `${t ?? ""}`.trim(), U = globalThis.fetch ?? (async () => {
    throw new Error("fetch not available");
  });
}
function T(t) {
  try {
    return N(t) || `${t ?? ""}`.trim();
  } catch {
    return `${t ?? ""}`.trim();
  }
}
function R(t) {
  return !!t && typeof t == "object" && `${t.block_id || ""}`.trim() !== "";
}
function A(t) {
  if (!t || typeof t != "object") return null;
  const a = t.page_idx;
  if (a != null && `${a}`.trim() !== "") {
    const n = Number(a);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  const e = t.page;
  if (e != null && `${e}`.trim() !== "") {
    const n = Number(e);
    if (Number.isFinite(n) && n >= 1) return Math.floor(n) - 1;
  }
  const r = `${t.block_id || ""}`.match(/(?:^|[^0-9])p0*([1-9]\d*)(?:-|_|\b)/i);
  if (r) {
    const n = Number(r[1]);
    if (Number.isFinite(n) && n >= 1) return n - 1;
  }
  return null;
}
function L(t) {
  const a = A(t);
  return a === null ? null : a + 1;
}
function H(t) {
  if (!Array.isArray(t)) return [];
  const a = [];
  for (const e of t) {
    if (!e || typeof e != "object") continue;
    const r = e, n = `${r.block_id || ""}`.trim();
    if (!n) continue;
    const o = A(r);
    a.push({
      ...r,
      block_id: n,
      ref: r.ref,
      page_idx: o === null ? void 0 : o,
      job_id: `${r.job_id || ""}`.trim(),
      document_id: `${r.document_id || ""}`.trim(),
      snippet: `${r.snippet || ""}`.trim()
    });
  }
  return a;
}
function E(t = "", a = 72) {
  const e = `${t}`.replace(/\s+/g, " ").trim();
  return e.length <= a ? e : `${e.slice(0, a).trim()}…`;
}
function S(t, a, { max: e = 5 } = {}) {
  const r = a.filter(R).map((i) => ({
    ...i,
    page_idx: A(i) ?? i.page_idx
  }));
  if (!r.length) return [];
  const n = /* @__PURE__ */ new Map();
  for (const i of r)
    n.set(`${i.ref}`, i);
  const o = [], c = /* @__PURE__ */ new Set();
  for (const i of `${t || ""}`.matchAll(/\[(\d+)\]/g)) {
    const l = i[1];
    c.has(l) || n.has(l) && (c.add(l), o.push(l));
  }
  if (o.length)
    return o.slice(0, e).map((i) => n.get(i));
  const u = [], s = /* @__PURE__ */ new Set();
  for (const i of r) {
    const l = A(i);
    if (l !== null) {
      if (s.has(l)) continue;
      s.add(l);
    }
    if (u.push(i), u.length >= Math.min(3, e)) break;
  }
  return u;
}
function K(t, a) {
  if (!a.size || !t) return t;
  const e = (r) => r.split(/(`+[^`\n]*?`+)/g).map((n, o) => o % 2 === 1 ? n : n.replace(new RegExp("(?<!!)\\[(\\d+)\\](?!\\s*\\()", "g"), (c, u) => a.has(u) ? `[${u}](#retainpdf-citation-${u})` : c)).join("");
  return t.split(/(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$))/g).map((r, n) => n % 2 === 1 ? r : e(r)).join("");
}
function Q(t, a, e = "translated", r = {}) {
  const n = r.resolveResourceUrl ?? T, o = `${t || ""}`.trim(), c = Math.max(1, Math.floor(Number(a) || 0) + 1);
  if (!o) return "";
  const u = `/api/v1/jobs/${encodeURIComponent(o)}/preview/pages/${c}?kind=${e}&width=240`;
  try {
    return n(u) || u;
  } catch {
    return u;
  }
}
function P(t, a, e = {}) {
  const r = e.resolveResourceUrl ?? T, n = `${t || ""}`.trim();
  let o = `${a || ""}`.trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (!n || !o || o.startsWith("/") || o.startsWith("//") || /^[a-z][a-z\d+.-]*:/i.test(o))
    return "";
  for (; o.startsWith("images/"); )
    o = o.slice(7);
  const c = [];
  for (const s of o.split("/")) {
    if (!s) continue;
    let i = s;
    try {
      i = decodeURIComponent(s);
    } catch {
      return "";
    }
    if (!i || i === "." || i === ".." || /[\\/]/.test(i)) return "";
    c.push(encodeURIComponent(i));
  }
  if (!c.length || !/^page-\d+$/i.test(decodeURIComponent(c[0]))) return "";
  const u = `/api/v1/jobs/${encodeURIComponent(n)}/markdown/images/${c.join("/")}`;
  try {
    return r(u) || u;
  } catch {
    return u;
  }
}
function x(t, a, e = {}) {
  var s;
  const r = `${t || ""}`.trim(), n = `${a || ""}`.trim();
  if (!r || !n || r.startsWith("//")) return "";
  if (/^(?:\.\/)?(?:images\/)?page-\d+\//i.test(r))
    return P(n, r, e);
  let o;
  try {
    o = new URL(r, ((s = globalThis.location) == null ? void 0 : s.href) || "http://localhost/");
  } catch {
    return "";
  }
  const c = o.pathname.match(/^\/api\/v1\/jobs\/([^/]+)\/markdown\/images\/(.+)$/i);
  if (!c) return "";
  let u = "";
  try {
    u = decodeURIComponent(c[1]);
  } catch {
    return "";
  }
  return u !== n ? "" : P(n, c[2], e);
}
function W(t) {
  const a = [
    t.image_url,
    ...Array.isArray(t.image_urls) ? t.image_urls : [],
    ...Array.isArray(t.asset_image_urls) ? t.asset_image_urls : []
  ];
  if (Array.isArray(t.assets))
    for (const n of t.assets)
      n && typeof n == "object" && a.push(n.image_url);
  const e = /* @__PURE__ */ new Set(), r = [];
  for (const n of a) {
    const o = `${n || ""}`.trim();
    !o || e.has(o) || (e.add(o), r.push(o));
  }
  return r;
}
function z(t) {
  var n;
  let a = `${t || ""}`.trim();
  try {
    a = decodeURIComponent(new URL(a, ((n = globalThis.location) == null ? void 0 : n.href) || "http://localhost/").pathname);
  } catch {
    try {
      a = decodeURIComponent(a);
    } catch {
    }
  }
  const e = a.match(/(?:^|\/)page-(\d+)(?:\/|$)/i);
  if (!e) return null;
  const r = Number(e[1]);
  return Number.isFinite(r) && r >= 1 ? Math.floor(r) : null;
}
function V(t, a, e) {
  const r = x(t, e);
  if (!r) return null;
  for (const o of a)
    for (const c of W(o))
      if (x(c, e) === r) return o;
  const n = z(r);
  return n == null ? null : a.find((o) => L(o) === n) || null;
}
function X(t, a, { jobId: e, documentRef: r = t.ownerDocument }) {
  const n = r.createElement("template");
  n.innerHTML = `${a || ""}`;
  let o = 0;
  return n.content.querySelectorAll("img").forEach((c) => {
    var i;
    const u = c.getAttribute("data-ai-src") || c.getAttribute("src") || "", s = x(u, e);
    if (c.removeAttribute("src"), c.removeAttribute("srcset"), !s) {
      const l = r.createElement("span");
      l.className = "aui-image-blocked", l.textContent = (i = c.getAttribute("alt")) != null && i.trim() ? `[图片不可用：${c.getAttribute("alt").trim()}]` : "[图片不可用]", c.replaceWith(l);
      return;
    }
    c.setAttribute("data-ai-src", s), c.setAttribute("loading", "lazy"), c.setAttribute("decoding", "async"), o += 1;
  }), t.replaceChildren(n.content), o;
}
function Y(t, {
  onOpen: a,
  documentRef: e = globalThis.document
} = {}) {
  var o, c;
  if (!t || !e) return;
  const r = [...((o = t.querySelectorAll) == null ? void 0 : o.call(t, "a[href]")) || []];
  for (const u of r) {
    const s = u, i = `${s.getAttribute("href") || ""}`.trim(), l = e.createElement("span");
    for (l.className = `aui-md-extlink${s.className ? ` ${s.className}` : ""}`.trim(); s.firstChild; )
      l.appendChild(s.firstChild);
    if (!((c = l.textContent) != null && c.trim()) && i && (l.textContent = i), i && !i.startsWith("#") && !/^\s*javascript:/i.test(i)) {
      l.dataset.href = i, l.setAttribute("role", "link"), l.tabIndex = 0, l.title = `打开链接：${i}`;
      const d = (f) => {
        f.preventDefault(), f.stopPropagation(), !M(f) && ($() || f instanceof MouseEvent && (f.button !== 0 || f.detail === 0) || a == null || a(i, f));
      };
      l.addEventListener("click", d), l.addEventListener("auxclick", (f) => {
        f.preventDefault(), f.stopPropagation();
      }), l.addEventListener("keydown", (f) => {
        f.key !== "Enter" && f.key !== " " || (f.preventDefault(), d(f));
      });
    } else
      l.removeAttribute("role");
    s.replaceWith(l);
  }
  const n = t;
  n instanceof Element && !n.dataset.auiLinkGuard && (n.dataset.auiLinkGuard = "1", n.addEventListener(
    "click",
    (u) => {
      const s = u.target;
      if (!(s instanceof Element)) return;
      const i = s.closest("a[href]");
      !i || !n.contains(i) || (u.preventDefault(), u.stopPropagation());
    },
    !0
  ));
}
function Z(t, a, e, r = globalThis.document) {
  var c, u, s, i;
  if (!a.size || !t) return;
  (c = t.querySelectorAll) == null || c.call(t, "button.reader-ai-citation-ref").forEach((l) => {
    var f;
    const d = l.parentNode;
    d && (d.replaceChild(r.createTextNode(l.textContent || ""), l), (f = d.normalize) == null || f.call(d));
  });
  const n = ((u = r.createTreeWalker) == null ? void 0 : u.call(r, t, 4)) || null, o = [];
  if (n) {
    let l = n.nextNode();
    for (; l; )
      (i = (s = l.parentElement) == null ? void 0 : s.closest) != null && i.call(s, "code, pre, .reader-ai-citation-ref, button, a, .aui-msg-actions") || o.push(l), l = n.nextNode();
  }
  for (const l of o) {
    const d = `${l.textContent || ""}`;
    if (!/\[\d+\]/.test(d)) continue;
    const f = r.createDocumentFragment();
    for (const g of d.split(/(\[\d+\])/)) {
      if (!g) continue;
      const p = g.match(/^\[(\d+)\]$/), m = p ? a.get(p[1]) : null;
      if (m) {
        const h = r.createElement("button");
        h.type = "button", h.className = "reader-ai-citation-ref", h.textContent = g;
        const y = L(m);
        h.title = y ? `跳到第 ${y} 页 · ${E(m.snippet || "", 60)}` : E(m.snippet || "相关片段", 60), y != null && (h.dataset.page = `${y}`), h.addEventListener("click", (k) => {
          k.preventDefault(), k.stopPropagation(), e == null || e(m);
        }), f.appendChild(h);
      } else
        f.appendChild(r.createTextNode(g));
    }
    l.replaceWith(f);
  }
}
function B(t) {
  var r, n;
  if (!t) return;
  const a = t, e = [
    ...(r = a.matches) != null && r.call(a, "img.is-hydrated") ? [a] : [],
    ...((n = a.querySelectorAll) == null ? void 0 : n.call(a, "img.is-hydrated")) || []
  ];
  for (const o of e) {
    const c = o, u = c.src || "";
    if (u.startsWith("blob:"))
      try {
        URL.revokeObjectURL(u);
      } catch {
      }
    c.classList.remove("is-hydrated"), u.startsWith("blob:") && c.removeAttribute("src");
  }
}
async function J(t, { fetchImpl: a = U, signal: e } = {}) {
  var o, c;
  const r = t, n = [
    ...(o = r.matches) != null && o.call(r, "img[data-ai-src]") ? [r] : [],
    ...((c = r.querySelectorAll) == null ? void 0 : c.call(r, "img[data-ai-src]")) || []
  ];
  await Promise.allSettled(n.map(async (u) => {
    var l;
    const s = u;
    if (e != null && e.aborted || !s.isConnected) return;
    const i = s.getAttribute("data-ai-src") || "";
    if (i)
      try {
        const d = await a(i, e ? { signal: e } : void 0);
        if (e != null && e.aborted || !s.isConnected) {
          try {
            const p = await ((l = d == null ? void 0 : d.blob) == null ? void 0 : l.call(d));
            if (p) {
              const m = URL.createObjectURL(p);
              URL.revokeObjectURL(m);
            }
          } catch {
          }
          return;
        }
        if (!(d != null && d.ok)) throw new Error(`HTTP ${(d == null ? void 0 : d.status) || 0}`);
        const f = URL.createObjectURL(await d.blob());
        if (e != null && e.aborted || !s.isConnected) {
          try {
            URL.revokeObjectURL(f);
          } catch {
          }
          return;
        }
        const g = s.src || "";
        if (g.startsWith("blob:"))
          try {
            URL.revokeObjectURL(g);
          } catch {
          }
        s.src = f, s.classList.add("is-hydrated"), s.classList.remove("is-missing");
      } catch {
        if (e != null && e.aborted || !s.isConnected) return;
        s.classList.add("is-missing"), s.alt = s.alt || "图片暂不可用";
      }
  }));
}
function tt(t, a, {
  onJump: e = null,
  answerText: r = "",
  max: n = 5,
  documentRef: o = globalThis.document
} = {}) {
  var l;
  (l = t.querySelector(".reader-ai-citations")) == null || l.remove();
  const c = S(r, a, { max: n });
  if (!c.length) return;
  const u = o.createElement("div");
  u.className = "reader-ai-citations", u.setAttribute("aria-label", "引用来源");
  const s = o.createElement("div");
  s.className = "reader-ai-citations-head", s.textContent = "来源", u.appendChild(s);
  const i = o.createElement("div");
  i.className = "reader-ai-citations-list";
  for (const d of c) {
    const f = L(d), g = f != null ? `p.${f}` : "", p = o.createElement("button");
    p.type = "button", p.className = "reader-ai-citation-item", f != null && (p.dataset.page = `${f}`), p.title = f != null ? `跳到第 ${f} 页` : "定位来源", p.addEventListener("click", (k) => {
      k.preventDefault(), k.stopPropagation(), e == null || e(d);
    });
    const m = o.createElement("span");
    m.className = "reader-ai-citation-refno", m.textContent = `[${d.ref ?? "?"}]`;
    const h = o.createElement("span");
    h.className = "reader-ai-citation-meta", h.textContent = g || "—";
    const y = o.createElement("span");
    y.className = "reader-ai-citation-copy", y.textContent = E(d.snippet || "相关片段", 64), p.append(m, h, y), i.appendChild(p);
  }
  u.appendChild(i), t.appendChild(u);
}
export {
  L as a,
  x as b,
  B as c,
  K as d,
  tt as e,
  V as f,
  q as g,
  J as h,
  R as i,
  j,
  F as k,
  P as l,
  Q as m,
  E as n,
  Z as o,
  $ as p,
  D as q,
  G as r,
  O as s,
  X as t,
  Y as u,
  H as v,
  S as w,
  A as x,
  M as y
};
//# sourceMappingURL=answer-enhance-W8TBaAUL.js.map
