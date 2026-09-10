var fn = (e) => {
  throw TypeError(e);
};
var mn = (e, t, n) => t.has(e) || fn("Cannot " + n);
var Je = (e, t, n) => (mn(e, t, "read from private field"), n ? n.call(e) : t.get(e)), pn = (e, t, n) => t.has(e) ? fn("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), hn = (e, t, n, r) => (mn(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as O, jsx as w, Fragment as tr } from "react/jsx-runtime";
import { useMemo as Y, useState as z, useEffect as B, useCallback as _, useRef as N, useLayoutEffect as Ae, memo as Wt, forwardRef as Ur, useImperativeHandle as Ht, useSyncExternalStore as Wr, useId as Jt, createContext as Hr, useContext as Jr, Suspense as Kr, lazy as Kt } from "react";
import { getReaderAdapters as ne, requireAdapter as ve } from "./adapters.js";
import { resolveReaderDownloadName as qr, resolveReaderDownloadUrls as Vr, createReaderServerFavoritesPort as Gr, READER_PROGRESS_COPY as be, trimString as Ve, READER_DOWNLOAD_ACTIONS as Yr, disabledReason as Xr } from "./runtime/state.js";
import { d as Zr } from "./ask-answerer-GNQdzitl.js";
import "@retainpdf/api/conversations";
import { n as gn } from "./block-key-BTxcG28S.js";
import { fetchLiveTranslationLayout as Qr, LiveTranslationApiError as dt, streamLiveTranslationEvents as eo, fetchLiveTranslationPage as to } from "@retainpdf/api/live-translation";
import { toast as At, Toaster as no } from "sonner";
import { X as Ze, Radio as ro, FileText as nr, Columns2 as rr, Languages as or, FileCode2 as ar, Sparkles as qt, Sigma as oo, Table2 as ao, Type as io, Image as so, Check as co, Copy as lo, Keyboard as uo, Bookmark as fo, Download as mo } from "lucide-react";
import { pdfjs as po, Page as ho, Document as go } from "react-pdf";
import { e as bo, m as yo, a as vo } from "./markdown-math-Cb17EyYs.js";
const wo = (...e) => {
  var t, n;
  return ((n = (t = ne()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, So = "", Io = Object.freeze({
  progress: "retainpdf-reader-progress"
}), st = (e) => {
  var t, n;
  return ((n = (t = ne()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, Ro = (...e) => {
  var t, n;
  return ((n = (t = ne()) == null ? void 0 : t.fetchProtected) == null ? void 0 : n.call(t, ...e)) ?? fetch(...e);
}, kt = (e = "") => {
  var t, n;
  return ((n = (t = ne()) == null ? void 0 : t.resolvePdfjsVendorUrl) == null ? void 0 : n.call(t, e)) ?? "";
}, Qe = new Proxy({}, { get: (e, t) => (...n) => {
  var r, a, o;
  return (o = (a = (r = ne()) == null ? void 0 : r.defaultReaderDataPort) == null ? void 0 : a[t]) == null ? void 0 : o.call(a, ...n);
} }), ir = new Proxy({}, { get: (e, t) => (...n) => {
  var r, a, o;
  return (o = (a = (r = ne()) == null ? void 0 : r.defaultReaderPageConfigPort) == null ? void 0 : a[t]) == null ? void 0 : o.call(a, ...n);
} }), To = (...e) => {
  var t, n;
  return ((n = (t = ne()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, xo = () => {
  var e, t;
  return ((t = (e = ne()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, Po = (...e) => {
  var t, n;
  return ((n = (t = ne()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, Mo = (...e) => {
  var t, n;
  return ((n = (t = ne()) == null ? void 0 : t.resolveReaderArtifactUrl) == null ? void 0 : n.call(t, ...e)) ?? "";
}, Eo = (...e) => {
  var t, n;
  return ((n = (t = ne()) == null ? void 0 : t.resolveReaderSourcePdf) == null ? void 0 : n.call(t, ...e)) ?? null;
}, Lo = (...e) => {
  var t, n;
  return ((n = (t = ne()) == null ? void 0 : t.resolveReaderTranslatedPdfUrl) == null ? void 0 : n.call(t, ...e)) ?? "";
}, Ao = (...e) => {
  var t, n;
  return ((n = (t = ne()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? qr(...e);
}, ko = (...e) => {
  var t, n;
  return ((n = (t = ne()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? Vr(...e);
}, No = (...e) => ve("downloadProtectedResource")(...e), zo = (...e) => ve("failDownloadToast")(...e), wc = (e, t) => ve("resolveMarkdownAssetUrl")(e, t), Sc = (e = {}) => {
  const t = ne();
  return Zr({
    apiPrefix: (t == null ? void 0 : t.apiPrefix) || "/api/v1",
    ask: t == null ? void 0 : t.askDocumentAi,
    documentByJobId: t == null ? void 0 : t.fetchDocumentByJobId,
    ...e
  });
}, Vt = "/api/v1", Co = (...e) => ve("fetchDocumentByJobId")(...e), Ic = (e = Vt, t = {}) => {
  var n;
  return ve("fetchFavorites")(
    ((n = ne()) == null ? void 0 : n.apiPrefix) ?? e,
    t
  );
};
function Rc(e = {}) {
  const t = ne();
  return Gr({
    apiPrefix: (t == null ? void 0 : t.apiPrefix) ?? Vt,
    documentByJobId: (...n) => ve("fetchDocumentByJobId")(...n),
    submitFavorite: (...n) => ve("createFavorite")(...n),
    loadFavorites: (...n) => ve("fetchFavorites")(...n),
    removeFavorite: (...n) => ve("deleteFavorite")(...n),
    ...e
  });
}
function _o() {
  const [e, t] = z(
    () => {
      var n, r;
      return ((n = globalThis.location) == null ? void 0 : n.search) || ((r = globalThis.location) == null ? void 0 : r.href) || "";
    }
  );
  return B(() => {
    var i, s, c, l;
    const n = () => {
      var d, u;
      return t(((d = globalThis.location) == null ? void 0 : d.search) || ((u = globalThis.location) == null ? void 0 : u.href) || "");
    }, r = (s = (i = globalThis.history) == null ? void 0 : i.pushState) == null ? void 0 : s.bind(globalThis.history), a = (l = (c = globalThis.history) == null ? void 0 : c.replaceState) == null ? void 0 : l.bind(globalThis.history);
    let o = !1;
    if (r && a)
      try {
        const d = (u) => function(...f) {
          const m = u.apply(this, f);
          return n(), globalThis.dispatchEvent(new Event("pushstate")), globalThis.dispatchEvent(new Event("replacestate")), globalThis.dispatchEvent(new Event("locationchange")), m;
        };
        globalThis.history.pushState = d(r), globalThis.history.replaceState = d(a), o = !0;
      } catch {
      }
    return window.addEventListener("popstate", n), window.addEventListener("hashchange", n), window.addEventListener("pushstate", n), window.addEventListener("replacestate", n), window.addEventListener("locationchange", n), () => {
      if (window.removeEventListener("popstate", n), window.removeEventListener("hashchange", n), window.removeEventListener("pushstate", n), window.removeEventListener("replacestate", n), window.removeEventListener("locationchange", n), o && r && a)
        try {
          globalThis.history.pushState = r, globalThis.history.replaceState = a;
        } catch {
        }
    };
  }, []), e;
}
function Do() {
  const e = _o(), t = Y(() => Po(ir), [e]), n = Y(() => xo(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function Fo(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: a,
    documentIdRef: o,
    sessionJobIdRef: i,
    switchToSourceMode: s
  } = e, [c, l] = z({
    documentId: "",
    jobId: ""
  }), [d, u] = z({
    documentId: "",
    jobId: ""
  }), f = c.documentId === t ? c.jobId : "", m = d.documentId === t ? d.jobId : "", g = n || f, [h, I] = z({
    jobId: "",
    documentId: ""
  }), y = h.jobId === g ? h.documentId : "", b = t || y, R = !!t && !g, [v, p] = z(null), x = (v == null ? void 0 : v.sessionIdentity) === r && v.documentId === b ? v : null, T = R || !!x, M = _((L) => {
    const P = `${L.documentId || ""}`.trim();
    if (!P || o.current && o.current !== P) return;
    if (!o.current && i.current)
      I({
        jobId: i.current,
        documentId: P
      });
    else if (!o.current)
      return;
    const S = `${L.revision || ""}`.trim() || `${Date.now()}`;
    p({
      documentId: P,
      revision: S,
      sessionIdentity: a.current
    }), s();
  }, []);
  B(() => {
    p((L) => L && L.sessionIdentity !== r ? null : L);
  }, [r]);
  const E = _((L) => {
    switch (L.type) {
      case "resolved-document-job":
        l({ documentId: L.documentId, jobId: L.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        u({ documentId: L.documentId, jobId: L.jobId });
        break;
      case "resolved-job-document":
        I((P) => P.jobId === L.jobId && P.documentId === L.documentId ? P : { jobId: L.jobId, documentId: L.documentId });
        break;
      case "committed-source":
        p({
          documentId: L.documentId,
          revision: L.revision,
          sessionIdentity: L.sessionIdentity
        });
        break;
    }
  }, []);
  return {
    resolvedDocumentJob: c,
    setResolvedDocumentJob: l,
    missingDocumentJob: d,
    setMissingDocumentJob: u,
    documentJobId: f,
    rejectedDocumentJobId: m,
    sessionJobId: g,
    resolvedJobDocument: h,
    setResolvedJobDocument: I,
    jobDocumentId: y,
    documentId: b,
    sourceOnly: R,
    committedDocumentSource: v,
    setCommittedDocumentSource: p,
    activeCommittedDocumentSource: x,
    sourceViewOnly: T,
    refreshCommittedDocument: M,
    applyIdentityEvent: E
  };
}
const Oo = /* @__PURE__ */ new Set(["succeeded", "failed", "cancelled", "canceled"]);
function bn(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function $o(e) {
  var r, a, o, i;
  if (!e || typeof e != "object") return "";
  const t = e, n = [
    t.document_id,
    t.documentId,
    (r = t.document) == null ? void 0 : r.document_id,
    (a = t.book_summary) == null ? void 0 : a.document_id,
    (i = (o = t.request_payload) == null ? void 0 : o.source) == null ? void 0 : i.document_id
  ];
  for (const s of n) {
    const c = `${s || ""}`.trim();
    if (c) return c;
  }
  return "";
}
function yn(e, t) {
  const n = `/api/v1/documents/${encodeURIComponent(e)}/source.pdf`, r = `${t || ""}`.trim();
  return st(r ? `${n}?version=${encodeURIComponent(r)}` : n);
}
function jo(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function Bo(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const a of n) {
    const o = `${a || ""}`.trim();
    if (o && !jo(o, t))
      return o.replace(/\.pdf$/i, "");
  }
  return "";
}
function Nt({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: Io.progress,
        stage: n,
        percent: e,
        text: t
      },
      ir.messageTargetOrigin()
    );
  } catch {
  }
}
function ft(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), Nt({ percent: t, text: n, stage: r });
}
function Uo(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: a,
    sessionEpochRef: o,
    closingRef: i
  } = e, [s, c] = z(null), [l, d] = z(null), [u, f] = z(""), [m, g] = z(0), h = u === n ? s : null, I = u === n ? l : null, y = bn(h), b = Oo.has(y), R = _(() => {
    g((E) => E + 1);
  }, []), v = _((E) => {
    c(E.jobPayload), d(E.manifestPayload), f(E.sessionIdentity);
  }, []), p = _((E) => {
    c(null), d(null), f(E);
  }, []), x = N(""), T = N(""), M = _(async () => {
    const E = a.current;
    if (!E || x.current === E) return;
    const L = Qe.loadJobPayload;
    if (typeof L != "function") return;
    const P = o.current.value;
    x.current = E;
    try {
      const S = await L(E);
      if (i.current || o.current.value !== P || a.current !== E || !S || typeof S != "object")
        return;
      const A = bn(S);
      c(S), f(r.current), A === "succeeded" && T.current !== E && (T.current = E, g((C) => C + 1));
    } catch {
    } finally {
      x.current === E && (x.current = "");
    }
  }, []);
  return B(() => {
    if (!t || b || !h) return;
    const E = window.setInterval(() => {
      M();
    }, 1e3);
    return () => window.clearInterval(E);
  }, [b, M, h, t]), {
    jobPayload: s,
    setJobPayload: c,
    manifestPayload: l,
    setManifestPayload: d,
    payloadSessionIdentity: u,
    setPayloadSessionIdentity: f,
    scopedJobPayload: h,
    scopedManifestPayload: I,
    jobStatus: y,
    jobTerminal: b,
    jobRefreshRevision: m,
    refreshJobArtifacts: R,
    refreshJobStatus: M,
    publishPayload: v,
    clearPayload: p
  };
}
function zt(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function Wo(e, t) {
  e(t), zt(t);
}
function Ho(e) {
  const [t, n] = z(e ? "source" : "compare"), r = _((o) => {
    e && o !== "source" || (n(o), zt(o));
  }, [e]), a = _((o) => {
    Wo(n, o);
  }, []);
  return B(() => (e && document.documentElement.classList.add("reader-source-only"), zt(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: a };
}
function Pe(e) {
  return e && typeof e == "object" && !Array.isArray(e) ? e : null;
}
function sr(e) {
  const t = Pe(e);
  return t && "data" in t ? t.data : e;
}
function Ke(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : null;
}
function vn(e) {
  const t = Pe(e);
  if (!t || !Array.isArray(t.bbox) || t.bbox.length !== 4) return null;
  const n = t.bbox.map(Number);
  if (!n.every(Number.isFinite)) return null;
  const r = Ke(t.page);
  if (r == null) return null;
  const [a, o, i, s] = n, c = Math.min(a, i), l = Math.min(o, s), d = Math.max(a, i), u = Math.max(o, s);
  if (d <= c || u <= l) return null;
  const f = `${t.unit || "pdf_point"}`.trim().toLowerCase();
  if (f !== "pdf_point" && f !== "pt") return null;
  const m = `${t.origin || "top_left"}`.trim().toLowerCase();
  return m !== "top_left" && m !== "bottom_left" ? null : {
    page: Math.floor(r),
    bbox: [c, l, d, u],
    unit: "pdf_point",
    origin: m,
    text: `${t.text || ""}`
  };
}
function Jo(e) {
  const t = Pe(sr(e)), n = Array.isArray(t == null ? void 0 : t.items) ? t.items : [], r = [];
  for (const a of n) {
    const o = Pe(a), i = `${(o == null ? void 0 : o.item_id) || (o == null ? void 0 : o.itemId) || ""}`.trim(), s = vn(o == null ? void 0 : o.source), c = vn(o == null ? void 0 : o.translated);
    !i || !s || !c || r.push({
      itemId: i,
      source: s,
      translated: c,
      markdown: `${(o == null ? void 0 : o.markdown) || ""}`,
      regionType: `${(o == null ? void 0 : o.region_type) || (o == null ? void 0 : o.regionType) || ""}`,
      status: `${(o == null ? void 0 : o.status) || ""}`,
      assetIds: (Array.isArray(o == null ? void 0 : o.asset_ids) ? o.asset_ids : []).map((l) => `${l || ""}`.trim()).filter(Boolean),
      assetUrls: (Array.isArray(o == null ? void 0 : o.asset_urls) ? o.asset_urls : []).map((l) => `${l || ""}`.trim()).filter(Boolean)
    });
  }
  return r;
}
function Ko(e) {
  const t = `${e || ""}`.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return t.includes("formula") || t.includes("equation") ? "formula" : t.includes("table") ? "table" : t.includes("figure") || t.includes("image") || t.includes("chart") || t.includes("seal") ? "figure" : t.includes("text") || t.includes("title") || t.includes("paragraph") || t.includes("reference") || t.includes("caption") ? "text" : "region";
}
function Gt(e) {
  const t = Ko(e.regionType);
  if (t !== "region") return t;
  if (e.assetIds.length || e.assetUrls.length) return "figure";
  const n = `${e.markdown || e.source.text || e.translated.text || ""}`.trim();
  return /^<table(?:\s|>)/i.test(n) || /\n\s*\|?\s*:?-{3,}/.test(n) ? "table" : /^\$\$[\s\S]+\$\$$/.test(n) || /^\\\[[\s\S]+\\\]$/.test(n) || /^\\begin\{(?:equation|align|gather|multline)\*?\}/.test(n) ? "formula" : n ? "text" : t;
}
function cr(e) {
  const t = Gt(e);
  return t === "formula" || t === "table" || t === "figure";
}
function lr(e, t) {
  return `${mt(e, t).text || e.markdown || ""}`.trim();
}
function qo(e) {
  let t = `${e || ""}`.trim();
  if (!t) return "";
  const n = t.match(/^```(?:latex|tex|math)?\s*([\s\S]*?)\s*```$/i);
  n && (t = n[1].trim());
  const r = [
    ["$$", "$$"],
    ["\\[", "\\]"],
    ["\\(", "\\)"],
    ["$", "$"]
  ];
  for (const [a, o] of r)
    if (t.startsWith(a) && t.endsWith(o) && t.length > a.length + o.length)
      return t.slice(a.length, -o.length).trim();
  return t;
}
function wn(e) {
  const t = Pe(e);
  if (!t) return null;
  const n = [];
  for (const a of Array.isArray(t.pages) ? t.pages : []) {
    const o = Pe(a), i = Ke(o == null ? void 0 : o.page), s = Ke(o == null ? void 0 : o.width), c = Ke(o == null ? void 0 : o.height);
    i == null || s == null || c == null || n.push({ page: Math.floor(i), width: s, height: c });
  }
  if (!n.length) return null;
  const r = Ke(t.page_count ?? t.pageCount);
  return {
    pageCount: r == null ? n.length : Math.floor(r),
    pages: n
  };
}
function Vo(e) {
  const t = Pe(sr(e));
  return {
    source: wn(t == null ? void 0 : t.source),
    translated: wn(t == null ? void 0 : t.translated)
  };
}
function ct(e, t) {
  const n = gn(t);
  return n && e.find((r) => gn(r.itemId) === n) || null;
}
function lt(e) {
  return `${e || ""}`.normalize("NFKC").toLocaleLowerCase().replace(/[\p{P}\p{S}\s]+/gu, "").trim();
}
function Go(e) {
  const t = `${e || ""}`.trim();
  if (!t) return [];
  const n = t.split(/\n\s*\n/g).map(lt).filter(Boolean), r = t.split(">").map(lt).filter(Boolean), a = [...n.reverse(), ...r.reverse(), lt(t)];
  return [...new Set(a)].filter((o) => o.length >= 16);
}
function Yo(e, t) {
  if (!e || !t) return 0;
  if (e.includes(t)) return 1e4 + t.length;
  const n = Math.min(72, t.length);
  if (n < 24) return 0;
  const r = Math.min(32, Math.max(0, t.length - n));
  for (let a = 0; a <= r; a += 4) {
    const o = t.slice(a, a + n);
    if (o.length >= 24 && e.includes(o))
      return o.length * 100 - a;
  }
  return 0;
}
function Xo(e, t) {
  if (!t) return null;
  const n = ct(e, t.block_id);
  if (n) return n;
  const r = Go(t.snippet);
  if (!r.length) return null;
  const a = t.page_idx != null ? Number(t.page_idx) + 1 : t.page != null ? Number(t.page) : null, o = Number.isFinite(a) && Number(a) >= 1 ? e.filter((l) => l.source.page === Math.floor(Number(a)) || l.translated.page === Math.floor(Number(a))) : e;
  let i = null, s = 0, c = !1;
  for (const l of o) {
    const d = [l.source.text, l.translated.text, l.markdown].map(lt).filter(Boolean);
    let u = 0;
    for (const f of r)
      for (const m of d)
        u = Math.max(u, Yo(m, f));
    u > s ? (i = l, s = u, c = !1) : u > 0 && u === s && (c = !0);
  }
  return s > 0 && !c ? i : null;
}
function Sn(e) {
  let t = `${e || ""}`.trim().replace(/\\/g, "/");
  if (!t) return "";
  try {
    t = decodeURIComponent(new URL(t, "http://retainpdf.local/").pathname);
  } catch {
    try {
      t = decodeURIComponent(t);
    } catch {
    }
  }
  const n = "/markdown/images/", r = t.toLowerCase().indexOf(n);
  return r >= 0 && (t = t.slice(r + n.length)), t.replace(/^\.?\/?(?:images\/)?/i, "").replace(/\/{2,}/g, "/");
}
function Zo(e, t, n) {
  const r = Sn(t);
  if (!r) return null;
  const a = Number(n);
  return (Number.isFinite(a) && a >= 1 ? e.filter((i) => i.source.page === Math.floor(a)) : e).find((i) => [...i.assetUrls, ...i.assetIds].some((s) => {
    const c = Sn(s);
    return !!c && (c === r || r.endsWith(`/${c}`) || c.endsWith(`/${r}`));
  })) || null;
}
function mt(e, t) {
  return t === "translated" ? e.translated : e.source;
}
function In(e, t, n) {
  if (!e || !t) return null;
  const r = mt(e, n), a = n === "translated" ? t.translated : t.source || t.translated, o = a == null ? void 0 : a.pages.find((i) => i.page === r.page);
  return o ? { itemId: e.itemId, region: e, box: r, pageSize: o } : null;
}
function vt(e, t, n) {
  if (!e || t <= 0 || n <= 0) return null;
  const { box: r, pageSize: a } = e;
  if (a.width <= 0 || a.height <= 0) return null;
  const [o, i, s, c] = r.bbox, l = r.origin === "bottom_left" ? a.height - c : i, d = r.origin === "bottom_left" ? a.height - i : c, u = Math.max(0, Math.min(t, o / a.width * t)), f = Math.max(u, Math.min(t, s / a.width * t)), m = Math.max(0, Math.min(n, l / a.height * n)), g = Math.max(m, Math.min(n, d / a.height * n));
  return f <= u || g <= m ? null : { left: u, top: m, width: f - u, height: g - m };
}
function Rn(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function Qo(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Rn(n.active_job_id),
    activeVersionId: Rn(n.active_version_id)
  };
}
function ea(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, a = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return a ? { kind: "follow-active-job", jobId: a, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function ta(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: a,
    hasCommittedSource: o
  } = e;
  return t && r && n === a && !o ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function na(e) {
  return e.status === 404 && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
function ra(e) {
  return e ? { data: e.data.slice() } : null;
}
const oa = 2, me = /* @__PURE__ */ new Map();
function Ct(e, t) {
  me.delete(e), me.set(e, t);
}
function aa(e) {
  if (me.size < oa) return;
  const t = me.keys().next().value;
  t && me.delete(t);
}
function St(e) {
  const t = `${e || ""}`.trim();
  if (!t || !me.has(t)) return null;
  const n = me.get(t);
  return Ct(t, n), n;
}
async function ur(e, t = Ro, n = {}) {
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (me.has(r)) {
    const s = me.get(r);
    return Ct(r, s), s;
  }
  const a = await t(r, { signal: n.signal });
  if (!a.ok) {
    const s = new Error(`读取 PDF 失败 (${a.status})`);
    throw s.status = a.status, s;
  }
  const o = await a.arrayBuffer(), i = { data: new Uint8Array(o) };
  return me.has(r) ? Ct(r, i) : (aa(), me.set(r, i)), i;
}
function ia(e = "", t = null) {
  const [n, r] = z(
    () => t || St(e)
  ), [a, o] = z(
    () => !!`${e || ""}`.trim() && !t && !St(e)
  ), [i, s] = z("");
  return B(() => {
    if (t) {
      r(t), o(!1), s("");
      return;
    }
    const c = `${e || ""}`.trim();
    if (!c) {
      r(null), o(!1), s("");
      return;
    }
    const l = St(c);
    if (l) {
      r(l), o(!1), s("");
      return;
    }
    let d = !1;
    return o(!0), s(""), r(null), ur(c).then((u) => {
      d || (r(u), o(!1));
    }).catch((u) => {
      d || (r(null), o(!1), s((u == null ? void 0 : u.message) || String(u)));
    }), () => {
      d = !0;
    };
  }, [e, t]), { file: n, loading: a, error: i };
}
function sa(e) {
  const { sessionEpochRef: t, closingRef: n, abort: r, sessionEpoch: a } = e;
  let o = !1;
  const i = () => r.signal.aborted || n.current || t.current.value !== a;
  return {
    signal: r.signal,
    isClosedOrStale: i,
    isInactive: () => o || i(),
    markFailed: () => {
      o = !0;
    }
  };
}
async function _t(e) {
  const { url: t, label: n, percentStart: r, percentEnd: a, fence: o, setBoot: i } = e;
  if (!t || o.isInactive())
    return null;
  ft(i, r, n, "download");
  const s = await ur(t, Qe.fetchProtected, {
    signal: o.signal
  });
  return o.isInactive() ? null : (ft(i, a, n, "download"), s);
}
async function ca(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: a } = e;
  ft(a, 25, "正在下载 PDF…", "download");
  const o = [];
  let i = null, s = null;
  return t && o.push(
    _t({
      url: t,
      label: "正在下载原文 PDF…",
      percentStart: 30,
      percentEnd: 55,
      fence: r,
      setBoot: a
    }).then((d) => {
      i = d;
    })
  ), n && o.push(
    _t({
      url: n,
      label: "正在下载译文 PDF…",
      percentStart: 55,
      percentEnd: 85,
      fence: r,
      setBoot: a
    }).then((d) => {
      s = d;
    })
  ), await Promise.all(o), r.isInactive() ? { status: "inactive" } : !!t && !i || !!n && !s ? { status: "incomplete" } : { status: "downloaded", sourceBytes: i, translatedBytes: s };
}
function la(e) {
  const {
    sessionJobId: t,
    jobId: n,
    routeDocumentId: r,
    documentJobId: a,
    rejectedDocumentJobId: o,
    sourceOnly: i,
    locationKey: s,
    sessionIdentity: c,
    committedSource: l,
    applyIdentityEvent: d,
    publishPayload: u,
    clearPayload: f,
    switchSessionMode: m,
    jobRefreshRevision: g,
    sessionEpochRef: h,
    closingRef: I,
    activeLoadAbortRef: y
  } = e, [b, R] = z(""), [v, p] = z(""), [x, T] = z(null), [M, E] = z(null), [L, P] = z(!1), [S, A] = z(""), [C, F] = z([]), [U, k] = z(() => ({
    source: null,
    translated: null
  })), [$, W] = z({
    loading: !0,
    percent: 4,
    text: be.boot,
    stage: "progress",
    failed: !1
  });
  return B(() => {
    const H = new AbortController(), Q = h.current.value, X = sa({
      sessionEpochRef: h,
      closingRef: I,
      abort: H,
      sessionEpoch: Q
    });
    if (y.current = H, I.current)
      return H.abort(), () => {
        y.current === H && (y.current = null);
      };
    function ie(K, J) {
      X.markFailed(), W({
        loading: !1,
        percent: 100,
        text: K,
        stage: "failed",
        failed: !0
      }), Nt({ percent: 100, text: J, stage: "failed" });
    }
    function D() {
      P(!0), W({
        loading: !1,
        percent: 100,
        text: be.ready,
        stage: "ready",
        failed: !1
      }), Nt({ percent: 100, text: be.ready, stage: "ready" });
    }
    function re() {
      return l != null && l.documentId ? yn(
        l.documentId,
        l.revision
      ) : wo() ? So : st(`/api/v1/documents/${encodeURIComponent(r)}/source.pdf`);
    }
    async function ee() {
      let K = { activeJobId: "", activeVersionId: "" };
      try {
        const ue = await Qe.fetchProtected(
          st(`/api/v1/documents/${encodeURIComponent(r)}`)
        );
        if (ue != null && ue.ok) {
          const je = await ue.json().catch(() => null);
          K = Qo(je);
        }
      } catch {
      }
      const J = ea({
        link: K,
        rejectedDocumentJobId: o,
        hasCommittedSource: !!l
      });
      if (J.kind === "follow-active-job") {
        if (X.isInactive()) return;
        d({
          type: "resolved-document-job",
          documentId: r,
          jobId: J.jobId
        }), J.activeVersionId ? (l || d({
          type: "committed-source",
          documentId: r,
          revision: J.activeVersionId,
          sessionIdentity: c
        }), m("source")) : m("compare");
        return;
      }
      if (J.kind === "open-committed-source") {
        if (X.isInactive()) return;
        d({
          type: "committed-source",
          documentId: r,
          revision: J.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const te = re();
      if (X.isInactive()) return;
      R(te), p(""), A(""), f(c);
      const le = await _t({
        url: te,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: X,
        setBoot: W
      });
      if (!X.isInactive()) {
        if (!le) {
          ie("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        T(le), D();
      }
    }
    async function ce() {
      const K = await Qe.loadReaderPayload(t);
      if (X.isInactive()) return;
      let J = null;
      if (n && !r) {
        try {
          J = await Co(Vt, t);
        } catch {
        }
        if (X.isInactive()) return;
      }
      const te = $o(K.jobPayload) || `${(J == null ? void 0 : J.document_id) || ""}`.trim();
      te && !r && d({
        type: "resolved-job-document",
        jobId: t,
        documentId: te
      });
      const le = ta({
        payloadDocumentId: te,
        linkedActiveJobId: `${(J == null ? void 0 : J.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(J == null ? void 0 : J.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (le.kind === "restore-committed-source") {
        if (X.isInactive()) return;
        d({
          type: "committed-source",
          documentId: le.documentId,
          revision: le.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const ue = Eo(K.manifestPayload), je = Lo(K.jobPayload, K.manifestPayload), Be = typeof ue == "string" ? ue : Mo(ue), Te = r || te, Ue = l != null && l.documentId ? yn(
        l.documentId,
        l.revision
      ) : Be || (Te ? st(`/api/v1/documents/${encodeURIComponent(Te)}/source.pdf`) : ""), We = l ? "" : je || "";
      if (R(Ue || ""), p(We), A(Bo(K.jobPayload, t)), u({
        jobPayload: K.jobPayload || null,
        manifestPayload: K.manifestPayload || null,
        sessionIdentity: c
      }), F(l ? [] : Jo(K.regionsPayload)), k(l ? { source: null, translated: null } : Vo(K.readerMetadata)), !Ue && !We) {
        ie(be.failed, be.failed);
        return;
      }
      const ze = await ca({
        sourceFinal: Ue || "",
        translatedFinal: We,
        fence: X,
        setBoot: W
      });
      if (ze.status !== "inactive") {
        if (ze.status === "incomplete") {
          ie("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        T(ze.sourceBytes), E(ze.translatedBytes), D();
      }
    }
    async function de() {
      P(!1), T(null), E(null), F([]), k({ source: null, translated: null }), ft(W, 8, be.metadata, "metadata");
      try {
        if (i) {
          await ee();
          return;
        }
        if (!t) {
          ie(be.failed, be.failed);
          return;
        }
        await ce();
      } catch (K) {
        if (X.isClosedOrStale() || (K == null ? void 0 : K.name) === "AbortError") return;
        X.markFailed();
        const J = Number(K == null ? void 0 : K.status);
        if (na({
          status: J,
          jobId: n,
          routeDocumentId: r,
          documentJobId: a,
          sessionJobId: t
        })) {
          d({ type: "missing-document-job", documentId: r, jobId: t }), d({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const te = K instanceof Error ? K.message : be.failed;
        ie(te, te);
      }
    }
    return de(), () => {
      H.abort(), y.current === H && (y.current = null);
    };
  }, [t, r, a, o, i, s, l, g, n, c, d, u, f, m]), {
    sourceUrl: b,
    translatedUrl: v,
    sourceFile: x,
    translatedFile: M,
    assetsReady: L,
    title: S,
    regions: C,
    readerMetadata: U,
    boot: $
  };
}
function ua() {
  const e = N(!1), t = N(null), { locationKey: n, jobId: r, routeDocumentId: a, sessionIdentity: o } = Do(), i = N({ identity: "", value: 0 });
  i.current.identity !== o && (i.current = {
    identity: o,
    value: i.current.value + 1
  }, e.current = !1);
  const s = N(o), c = N(""), l = N(""), d = N(() => {
  }), u = _(() => d.current(), []), f = Fo({
    routeDocumentId: a,
    jobId: r,
    sessionIdentity: o,
    sessionIdentityRef: s,
    documentIdRef: c,
    sessionJobIdRef: l,
    switchToSourceMode: u
  }), {
    sessionJobId: m,
    documentId: g,
    sourceOnly: h,
    sourceViewOnly: I
  } = f, { mode: y, setMode: b, switchSessionMode: R } = Ho(I);
  d.current = () => {
    R("source");
  }, s.current = o, c.current = g, l.current = m;
  const v = Uo({
    sessionJobId: m,
    sessionIdentity: o,
    sessionIdentityRef: s,
    sessionJobIdRef: l,
    sessionEpochRef: i,
    closingRef: e
  }), {
    scopedJobPayload: p,
    scopedManifestPayload: x,
    jobStatus: T,
    jobTerminal: M,
    jobRefreshRevision: E,
    refreshJobArtifacts: L,
    refreshJobStatus: P
  } = v, S = la({
    sessionJobId: m,
    jobId: r,
    routeDocumentId: a,
    documentJobId: f.documentJobId,
    rejectedDocumentJobId: f.rejectedDocumentJobId,
    sourceOnly: h,
    locationKey: n,
    sessionIdentity: o,
    committedSource: f.activeCommittedDocumentSource,
    applyIdentityEvent: f.applyIdentityEvent,
    publishPayload: v.publishPayload,
    clearPayload: v.clearPayload,
    switchSessionMode: R,
    jobRefreshRevision: E,
    sessionEpochRef: i,
    closingRef: e,
    activeLoadAbortRef: t
  }), A = _(() => {
    var F;
    e.current = !0, (F = t.current) == null || F.abort();
  }, []), C = Y(
    () => ({
      fetchProtected: Qe.fetchProtected,
      jobId: m,
      jobPayload: p,
      manifestPayload: x,
      sourceUrl: S.sourceUrl,
      translatedUrl: S.translatedUrl,
      sourceOnly: I
    }),
    [m, p, x, S.sourceUrl, S.translatedUrl, I]
  );
  return {
    jobId: m,
    jobStatus: T,
    workflow: `${(p == null ? void 0 : p.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: M,
    documentId: g,
    sourceOnly: h,
    mode: y,
    setMode: b,
    sourceUrl: S.sourceUrl,
    translatedUrl: S.translatedUrl,
    sourceFile: S.sourceFile,
    translatedFile: S.translatedFile,
    assetsReady: S.assetsReady,
    boot: S.boot,
    title: S.title,
    regions: S.regions,
    readerMetadata: S.readerMetadata,
    download: C,
    refreshJobArtifacts: L,
    refreshJobStatus: P,
    refreshCommittedDocument: f.refreshCommittedDocument,
    prepareClose: A
  };
}
const dr = 0.25, fr = 1, da = 0.05, Yt = 0.5, fa = 16, ma = 8;
function Ge(e) {
  return Yt;
}
function wt(e) {
  return Number.isFinite(e) ? Math.min(fr, Math.max(dr, e)) : Yt;
}
function et(e, t) {
  const n = wt(Number(e) + t * da);
  return Math.round(n * 100) / 100;
}
function pa(e) {
  return Math.round(wt(e) * 100);
}
function ha(e) {
  const t = Number(e) || 0;
  return Math.max(160, Math.floor((t - 1) / 2));
}
function ga(e) {
  const n = (Number(e) || 0) - fa - ma;
  return Math.max(160, Math.floor(n));
}
function ba(e, t = Yt) {
  const n = wt(t);
  return ga((Number(e) || 0) * n);
}
function ya(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, a = Array.from(
    e.querySelectorAll("[data-reader-pane]")
  ).map((i) => ({
    pane: i,
    cx: i.scrollLeft + i.clientWidth / 2,
    hadOverflow: i.scrollWidth > i.clientWidth + 1
  })), o = () => {
    e.scrollLeft = Math.max(0, n * t - e.clientWidth / 2), e.scrollTop = Math.max(0, r * t - e.clientHeight / 2);
    for (const { pane: i, cx: s, hadOverflow: c } of a) {
      const l = Math.max(0, i.scrollWidth - i.clientWidth);
      if (l <= 0) {
        i.scrollLeft = 0;
        continue;
      }
      c ? i.scrollLeft = Math.min(
        l,
        Math.max(0, s * t - i.clientWidth / 2)
      ) : i.scrollLeft = l / 2;
    }
  };
  requestAnimationFrame(() => {
    requestAnimationFrame(o);
  });
}
const pt = "data-reader-page", va = "data-reader-pane", wa = "reader-scroll-shell", Sa = "reader-react-scroll-shell", Xt = "reader-react-pdf-page-slot";
function ht(e, t) {
  const n = e != null ? `[${pt}="${e}"]` : `[${pt}]`;
  return t ? `${n}[${va}="${t}"]` : n;
}
function Ia() {
  return `.${Xt}[${pt}]`;
}
function mr(e) {
  return Number(e.getAttribute(pt));
}
const Zt = 48;
function pr(e, t = Zt) {
  return e.getBoundingClientRect().top + t;
}
function hr(e, t) {
  if (!e.length)
    return null;
  let n = null, r = -1 / 0;
  for (const c of e) {
    const l = c.getBoundingClientRect();
    l.height < 8 || l.width < 8 || l.top <= t + 1 && l.top >= r && (n = c, r = l.top);
  }
  if (!n && (n = e.find((l) => {
    const d = l.getBoundingClientRect();
    return d.height >= 8 && d.width >= 8;
  }) ?? e[0] ?? null, n)) {
    const l = [...e].reverse().find((d) => {
      const u = d.getBoundingClientRect();
      return u.height >= 8 && u.width >= 8;
    });
    l && l.getBoundingClientRect().bottom < t && (n = l);
  }
  if (!n)
    return null;
  const a = mr(n);
  if (!Number.isFinite(a) || a < 1)
    return null;
  const o = n.getBoundingClientRect(), i = o.height > 0 ? o.height : 1, s = Math.min(1, Math.max(0, (t - o.top) / i));
  return { el: n, page: a, fraction: s };
}
function It(e, t, n = Zt) {
  if (!e)
    return null;
  const r = ht(void 0, t), a = Array.from(e.querySelectorAll(r));
  if (!a.length || e.getBoundingClientRect().height <= 0)
    return null;
  const i = pr(e, n), s = hr(a, i);
  return s ? { page: s.page, fraction: s.fraction } : null;
}
function Qt(e, t, n = "auto", r, a = Zt) {
  if (!e || !t)
    return !1;
  const o = Math.max(1, Math.floor(Number(t.page) || 1)), i = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let s = null;
  if (r && (s = e.querySelector(ht(o, r))), s || (s = e.querySelector(ht(o))), !s)
    return !1;
  const c = e.getBoundingClientRect(), l = s.getBoundingClientRect();
  if (c.height <= 0 || l.height < 8 && s.offsetHeight < 8)
    return !1;
  const d = l.height > 0 ? l.height : s.offsetHeight, u = e.scrollTop + (l.top - c.top), f = Math.max(0, u + i * d - a);
  return n === "auto" ? e.scrollTop = f : e.scrollTo({ top: f, behavior: n }), !0;
}
function Ra(e, t, n = "smooth", r) {
  return Qt(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function Dt(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", a = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let o = !1, i = !1;
  const s = [], c = () => {
    var d;
    if (o) return;
    Qt(
      e(),
      t,
      r,
      n == null ? void 0 : n.pane
    ) && !i && (i = !0, (d = n == null ? void 0 : n.onDone) == null || d.call(n));
  };
  for (const l of a)
    l <= 0 ? requestAnimationFrame(() => {
      requestAnimationFrame(c);
    }) : s.push(setTimeout(c, l));
  return () => {
    o = !0;
    for (const l of s)
      clearTimeout(l);
  };
}
function Ta(e, t, n) {
  return Dt(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function gt(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function fe(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function xa(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Pa(e, t) {
  return e === "1" ? "source" : t ? null : e === "2" ? "compare" : e === "3" ? "translated" : null;
}
function Ma(e) {
  const {
    mode: t,
    sourceOnly: n,
    setMode: r,
    userZoom: a,
    onZoomChange: o,
    currentPage: i,
    numPages: s,
    goToPage: c,
    enabled: l = !0
  } = e;
  B(() => {
    if (!l)
      return;
    const d = (u) => {
      if (u.defaultPrevented || u.metaKey || u.ctrlKey || u.altKey || xa(u.target))
        return;
      const f = u.key, m = f.length === 1 ? f.toLowerCase() : f, g = Pa(m, n);
      if (g) {
        u.preventDefault(), r(g);
        return;
      }
      if (f === "+" || f === "=") {
        u.preventDefault(), o(et(a, 1));
        return;
      }
      if (f === "-" || f === "_") {
        u.preventDefault(), o(et(a, -1));
        return;
      }
      if (m === "0") {
        u.preventDefault(), o(Ge());
        return;
      }
      if (!(s <= 0)) {
        if (m === "j" || f === "ArrowDown" || f === "PageDown") {
          u.preventDefault(), c(gt(i + 1, s));
          return;
        }
        if (m === "k" || f === "ArrowUp" || f === "PageUp") {
          u.preventDefault(), c(gt(i - 1, s));
          return;
        }
        if (f === "Home") {
          u.preventDefault(), c(1);
          return;
        }
        f === "End" && (u.preventDefault(), c(s));
      }
    };
    return window.addEventListener("keydown", d), () => window.removeEventListener("keydown", d);
  }, [
    l,
    t,
    n,
    r,
    a,
    o,
    i,
    s,
    c
  ]);
}
const Ea = 160, La = 8, Aa = 960;
function ka(e) {
  const t = N(null), [n, r] = z(null), [a, o] = z(Aa), i = N(e == null ? void 0 : e.onWidthChange);
  i.current = e == null ? void 0 : e.onWidthChange;
  const s = _((l) => {
    t.current = l, r(l);
  }, []);
  B(() => {
    const l = n;
    if (!l || typeof ResizeObserver > "u")
      return;
    const d = (f) => {
      !Number.isFinite(f) || f < Ea || o((m) => Math.abs(m - f) < La ? m : f);
    }, u = new ResizeObserver((f) => {
      var m, g;
      d(((g = (m = f[0]) == null ? void 0 : m.contentRect) == null ? void 0 : g.width) ?? l.clientWidth);
    });
    return u.observe(l), d(l.clientWidth), () => u.disconnect();
  }, [n]), B(() => {
    var l;
    (l = i.current) == null || l.call(i, a);
  }, [a]);
  const c = ha(a);
  return {
    shellRef: t,
    shellEl: n,
    shellWidth: a,
    compareColWidth: c,
    bindShell: s
  };
}
function Na(e) {
  const { mode: t, sourceOnly: n, assetsReady: r, hasSource: a, hasTranslated: o } = e, i = r && a, s = r && o && !n, c = t === "source" || t === "compare", l = !n && (t === "translated" || t === "compare");
  return {
    mountSource: i,
    mountTranslated: s,
    showSource: c,
    showTranslated: l,
    compareMode: t === "compare" && c && l && i && s,
    primaryPane: t === "translated" ? "translated" : "source"
  };
}
function za(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: a,
    sourceUrl: o,
    translatedUrl: i,
    sourceFile: s,
    translatedFile: c
  } = e, l = `${(t == null ? void 0 : t.identityKey) || ""}\0${o}\0${i}`, d = N(l);
  d.current = l;
  const [u, f] = z(() => ({
    identity: l,
    pages: { source: 0, translated: 0 }
  })), [m, g] = z(() => ({ identity: l, tick: 0 })), h = u.identity === l ? u.pages : { source: 0, translated: 0 }, I = m.identity === l ? m.tick : 0, y = Na({
    mode: n,
    sourceOnly: r,
    assetsReady: a,
    hasSource: !!s || !!o,
    hasTranslated: !!c
  }), { primaryPane: b } = y, R = _((P, S) => {
    d.current === l && f((A) => {
      const C = A.identity === l ? A.pages : { source: 0, translated: 0 };
      return C[S] === P && A.identity === l ? A : {
        identity: l,
        pages: { ...C, [S]: P }
      };
    });
  }, [l]), v = N(null), p = _(() => {
    v.current && clearTimeout(v.current);
    const P = l;
    v.current = setTimeout(() => {
      v.current = null, d.current === P && g((S) => ({
        identity: P,
        tick: S.identity === P ? S.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  B(() => (v.current && (clearTimeout(v.current), v.current = null), f((P) => P.identity === l && P.pages.source === 0 && P.pages.translated === 0 ? P : { identity: l, pages: { source: 0, translated: 0 } }), g((P) => P.identity === l && P.tick === 0 ? P : { identity: l, tick: 0 }), () => {
    v.current && (clearTimeout(v.current), v.current = null);
  }), [l]);
  const x = Y(
    () => Math.max(h.source, h.translated),
    [h]
  ), T = b === "translated" ? h.translated : h.source || h.translated, M = t == null ? void 0 : t.userZoom, E = t == null ? void 0 : t.shellWidth, L = `${l}-${I}-${M}-${n}-${h.source}-${h.translated}-${E}`;
  return {
    ...y,
    numPagesByPane: h,
    hudNumPages: x,
    primaryNumPages: T,
    metricsTick: I,
    onNumPages: R,
    onMetrics: p,
    rowSyncRevision: L
  };
}
const Ca = "retainpdf:reader:view:v1:", Tn = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]);
function gr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Ft(e) {
  return `${e || ""}`.trim();
}
function _a({
  documentId: e,
  jobId: t
}) {
  const n = Ft(e);
  if (n) return `document:${n}`;
  const r = Ft(t);
  return r ? `job:${r}` : "";
}
function br(e) {
  const t = Ft(e);
  return t ? `${Ca}${t}` : "";
}
function Da(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function Fa(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!Tn.has(t) || !Tn.has(n) || t === n))
    return { left: t, right: n };
}
function Oa(e) {
  return e === null ? null : e === "markdown" || e === "ai" ? e : void 0;
}
function yr(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = Da(t.anchor), r = Number(t.zoom), a = Fa(t.splitLayout), o = Oa(t.assistantPanel);
  return {
    schema: "retainpdf_reader_view_v1",
    ...n ? { anchor: n } : {},
    ...Number.isFinite(r) ? { zoom: Math.max(0.25, Math.min(1, r)) } : {},
    ...a !== void 0 ? { splitLayout: a } : {},
    ...o !== void 0 ? { assistantPanel: o } : {},
    updatedAt: Number.isFinite(Number(t.updatedAt)) ? Number(t.updatedAt) : 0
  };
}
function Ie(e, t = gr()) {
  const n = br(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? yr(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function en(e, t, n = gr()) {
  const r = br(e);
  if (!r || !n) return null;
  const a = Ie(e, n), o = yr({
    schema: "retainpdf_reader_view_v1",
    ...a || {},
    ...t,
    updatedAt: Date.now()
  });
  if (!o) return null;
  try {
    return n.setItem(r, JSON.stringify(o)), o;
  } catch {
    return null;
  }
}
function $a(e, t, n = "") {
  const [r, a] = z(() => {
    var u;
    return ((u = Ie(n)) == null ? void 0 : u.zoom) ?? Ge();
  }), o = N(r), i = N(n);
  o.current = r;
  const s = N(1);
  B(() => {
    var f;
    if (i.current === n) return;
    i.current = n;
    const u = ((f = Ie(n)) == null ? void 0 : f.zoom) ?? Ge();
    s.current = 1, o.current = u, a(u);
  }, [e, n]);
  const c = _((u) => {
    const f = wt(u), m = o.current;
    Math.abs(f - m) < 5e-4 || (s.current = f / (m || 1), en(i.current, { zoom: f }), a(f));
  }, []), l = _((u) => {
    c(et(o.current, u));
  }, [c]), d = _((u) => {
    c(Ge());
  }, [c]);
  return Ae(() => {
    const u = s.current;
    Math.abs(u - 1) < 1e-3 || (s.current = 1, ya(t == null ? void 0 : t.current, u));
  }, [r, t]), { userZoom: r, onZoomChange: c, stepZoom: l, resetZoom: d };
}
function ja(e, t = !0) {
  const [n, r] = z(null), a = _(() => {
    var s, c;
    r(null);
    const i = (s = globalThis.getSelection) == null ? void 0 : s.call(globalThis);
    (c = i == null ? void 0 : i.removeAllRanges) == null || c.call(i);
  }, []), o = e.current ?? null;
  return B(() => {
    if (!t)
      return;
    const i = () => {
      var F, U;
      const h = e.current, I = (F = globalThis.getSelection) == null ? void 0 : F.call(globalThis);
      if (!h || !I || I.isCollapsed || !I.rangeCount) {
        r(null);
        return;
      }
      const y = I.getRangeAt(0);
      if (!h.contains(y.commonAncestorContainer)) {
        r(null);
        return;
      }
      const b = `${I.toString() || ""}`.replace(/\s+/g, " ").trim();
      if (b.length < 2) {
        r(null);
        return;
      }
      let R = y.commonAncestorContainer;
      R.nodeType === Node.TEXT_NODE && (R = R.parentElement);
      const v = (U = R == null ? void 0 : R.closest) == null ? void 0 : U.call(
        R,
        "[data-reader-page]"
      );
      if (!v || !h.contains(v)) {
        r(null);
        return;
      }
      const p = Math.max(1, Math.floor(Number(v.getAttribute("data-reader-page")) || 1)), T = v.getAttribute("data-reader-pane") === "translated" ? "translated" : "source", M = y.getClientRects(), E = M[M.length - 1] || y.getBoundingClientRect();
      if (!E || E.width === 0 && E.height === 0) {
        r(null);
        return;
      }
      const L = typeof window < "u" ? window.innerWidth : 800, P = typeof window < "u" ? window.innerHeight : 600, S = 16, A = Math.min(Math.max(S, E.left), L - S), C = Math.min(Math.max(S, E.top), P - S);
      r({
        selectionType: "text",
        quote: b,
        page: p,
        pane: T,
        rect: {
          left: A,
          top: C,
          width: E.width,
          height: E.height
        }
      });
    }, s = () => {
      window.setTimeout(i, 0);
    }, c = () => {
      s();
    }, l = () => s(), d = () => s(), u = () => {
      s();
    }, f = (h) => {
      h.key === "Escape" && a();
    }, m = () => {
      r((h) => h && null);
    };
    document.addEventListener("mouseup", c), document.addEventListener("pointerup", l), document.addEventListener("touchend", d), document.addEventListener("selectionchange", u), document.addEventListener("keyup", f);
    const g = o ?? e.current;
    return g == null || g.addEventListener("scroll", m, { passive: !0 }), window.addEventListener("scroll", m, { passive: !0, capture: !0 }), () => {
      document.removeEventListener("mouseup", c), document.removeEventListener("pointerup", l), document.removeEventListener("touchend", d), document.removeEventListener("selectionchange", u), document.removeEventListener("keyup", f), g == null || g.removeEventListener("scroll", m), window.removeEventListener("scroll", m, !0);
    };
  }, [t, o, a]), { selection: n, clearSelection: a };
}
function Ba(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, a = N(t), o = N(n), i = N(r);
  return a.current = t, o.current = n, i.current = r, { setModeKeepingPage: _((c) => {
    c !== a.current && (i.current(), o.current(c));
  }, []) };
}
function Ua() {
  const [e, t] = z(null), n = _((i) => {
    t(i);
  }, []), r = _((i = null) => {
    t((s) => !i || s === i ? null : s);
  }, []), a = _((i) => {
    t((s) => s === i ? null : i);
  }, []), o = _(
    (i) => e === i,
    [e]
  );
  return { active: e, open: n, close: r, toggle: a, isOpen: o };
}
function Wa(e, t, n = !0, r = "", a) {
  const [o, i] = z(1);
  return B(() => {
    if (!n || t <= 0) {
      i(1);
      return;
    }
    const s = e.current;
    if (!s)
      return;
    let c = !1, l = null, d = 0;
    const u = ht(void 0, a), f = () => {
      if (c) return;
      const h = Array.from(s.querySelectorAll(u));
      if (!h.length)
        return;
      const I = pr(s), y = hr(h, I);
      y && i(y.page);
    }, m = () => {
      c || (d && cancelAnimationFrame(d), d = requestAnimationFrame(() => {
        d = 0, f();
      }));
    }, g = () => {
      if (c) return;
      if (!Array.from(s.querySelectorAll(u)).length) {
        l = setTimeout(g, 120);
        return;
      }
      f(), s.addEventListener("scroll", m, { passive: !0 });
    };
    return g(), () => {
      c = !0, l && clearTimeout(l), d && cancelAnimationFrame(d), s.removeEventListener("scroll", m);
    };
  }, [e, t, n, r, a]), o;
}
function Ha(e) {
  const t = e.querySelector(
    "canvas, .react-pdf__Page, .reader-react-pdf-page, .reader-react-pdf-page-placeholder"
  );
  if (t) {
    const a = t.getBoundingClientRect().height;
    if (Number.isFinite(a) && a > 0)
      return a;
  }
  const n = Number(e.getAttribute("data-natural-height"));
  if (Number.isFinite(n) && n > 0)
    return n;
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Ja(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Ka(e, t, n = "", r) {
  const [a, o] = z(() => /* @__PURE__ */ new Map()), i = N(r);
  return i.current = r, Ae(() => {
    if (!t) {
      o((b) => b.size === 0 ? b : /* @__PURE__ */ new Map());
      return;
    }
    let s = !1, c = 0, l = !1, d = !1;
    const u = () => {
      var p;
      if (s) return;
      const b = e.current;
      if (!b) return;
      const R = /* @__PURE__ */ new Map();
      b.querySelectorAll(Ia()).forEach((x) => {
        const T = mr(x);
        if (!Number.isFinite(T) || T < 1) return;
        const M = Ha(x);
        if (M <= 0) return;
        const E = R.get(T) || { height: 0, count: 0 };
        E.height = Math.max(E.height, M), E.count += 1, R.set(T, E);
      });
      const v = /* @__PURE__ */ new Map();
      R.forEach((x, T) => {
        x.count >= 2 && x.height > 0 && v.set(T, Math.ceil(x.height));
      }), o((x) => Ja(x, v) ? x : v), l && !d && (d = !0, (p = i.current) == null || p.call(i));
    }, f = () => {
      cancelAnimationFrame(c), c = requestAnimationFrame(() => {
        requestAnimationFrame(u);
      });
    };
    f();
    const m = window.setTimeout(f, 100), g = window.setTimeout(() => {
      l = !0, f();
    }, 300), h = window.setTimeout(f, 700), I = e.current;
    let y = null;
    return I && typeof ResizeObserver < "u" && (y = new ResizeObserver(() => f()), y.observe(I)), () => {
      s = !0, cancelAnimationFrame(c), window.clearTimeout(m), window.clearTimeout(g), window.clearTimeout(h), y == null || y.disconnect();
    };
  }, [e, t, n]), a;
}
const qa = [0, 48, 140, 320, 560], Va = 700, Ga = [80, 200, 400], Ya = 500, Xa = 50, Za = 180, xn = [0, 48, 140, 320, 700, 1200];
function Qa(e, t) {
  var P;
  const {
    primaryPane: n,
    mode: r,
    enabled: a = !0,
    persistenceKey: o = "",
    restoreReady: i = !0
  } = t, s = N(
    ((P = Ie(o)) == null ? void 0 : P.anchor) || { page: 1, fraction: 0 }
  ), c = N(null), l = N(!1), d = N(r), u = N(null), f = N(null), m = N(null), g = N(null), h = N(o), I = N(""), y = N(n);
  y.current = n;
  const b = _(() => {
    var S;
    (S = u.current) == null || S.call(u), u.current = null, f.current != null && (clearTimeout(f.current), f.current = null);
  }, []), R = _((S = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const A = () => {
      g.current = null, en(h.current, {
        anchor: fe(s.current)
      });
    };
    S ? A() : g.current = setTimeout(A, Za);
  }, []), v = _((S) => {
    s.current = fe(S), c.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, l.current = !1;
    }, Xa);
  }, []);
  B(() => {
    if (!a)
      return;
    let S = !1, A = null, C = null, F = null;
    const U = () => {
      if (S) return;
      const k = e.current;
      if (!k) {
        F = setTimeout(U, 50);
        return;
      }
      A = k, C = () => {
        if (l.current)
          return;
        const $ = It(A, y.current);
        $ && (s.current = $, R());
      }, A.addEventListener("scroll", C, { passive: !0 }), l.current || C();
    };
    return U(), () => {
      S = !0, F != null && clearTimeout(F), A && C && A.removeEventListener("scroll", C);
    };
  }, [a, r, n, e, R]), Ae(() => {
    var A;
    if (h.current === o) return;
    R(!0), b(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = o, I.current = "";
    const S = (A = Ie(o)) == null ? void 0 : A.anchor;
    s.current = S ? fe(S) : { page: 1, fraction: 0 }, c.current = null, l.current = !!o, d.current = r;
  }, [o, r, R, b]), B(() => {
    var A;
    if (!a || !i || !o || I.current === o) return;
    I.current = o;
    const S = fe(
      ((A = Ie(o)) == null ? void 0 : A.anchor) || { page: 1, fraction: 0 }
    );
    return s.current = S, c.current = S, l.current = !0, b(), u.current = Dt(
      () => e.current,
      S,
      {
        behavior: "auto",
        pane: y.current,
        delaysMs: xn,
        onDone: () => v(S)
      }
    ), f.current = setTimeout(() => {
      f.current = null, v(S);
    }, Math.max(...xn) + 160), () => b();
  }, [a, i, o, e, v, b]), B(() => {
    if (d.current === r)
      return;
    if (d.current = r, !a) {
      l.current = !1, c.current = null, b();
      return;
    }
    const S = c.current ? fe(c.current) : fe(s.current);
    return l.current = !0, c.current = S, s.current = S, b(), u.current = Dt(
      () => e.current,
      S,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: qa,
        onDone: () => v(S)
      }
    ), f.current = setTimeout(() => {
      f.current = null, v(S);
    }, Va), () => {
      b();
    };
  }, [r, a, n, e, v, b]), B(() => () => {
    b(), m.current != null && (clearTimeout(m.current), m.current = null), R(!0);
  }, [b, R]);
  const p = _(() => {
    const S = It(
      e.current,
      y.current
    );
    return fe(S || s.current);
  }, [e]), x = _(() => {
    l.current = !0;
    const S = It(
      e.current,
      y.current
    ), A = fe(S ?? s.current);
    return s.current = A, c.current = A, R(), A;
  }, [e, R]), T = _((S, A, C) => {
    const F = C || y.current, U = gt(S, A || 1), k = { page: U, fraction: 0 };
    s.current = k, l.current = !0, c.current = k, R(), b(), Ra(e.current, U, "smooth", F), u.current = Ta(
      () => e.current,
      U,
      {
        behavior: "auto",
        pane: F,
        delaysMs: Ga,
        onDone: () => v(k)
      }
    ), f.current = setTimeout(() => {
      f.current = null, v(k);
    }, Ya);
  }, [e, v, b, R]), M = _(() => fe(s.current), []), E = _(() => l.current, []), L = _(() => {
    if (!l.current || !c.current)
      return;
    const S = fe(c.current);
    Qt(
      e.current,
      S,
      "auto",
      y.current
    );
  }, [e]);
  return {
    lockFromShell: p,
    beginModeSwitch: x,
    goToPage: T,
    getAnchor: M,
    isRestoring: E,
    repinIfRestoring: L
  };
}
function ei(e, t) {
  if (!e) return null;
  if (e.blockId && t) {
    const a = t(e.blockId);
    if (a != null && Number.isFinite(a) && a >= 1)
      return Math.floor(a);
  }
  if (e.pageIdx === null || e.pageIdx === void 0) return null;
  const n = Number(e.pageIdx);
  if (!Number.isFinite(n)) return null;
  const r = Math.floor(n) + 1;
  return r >= 1 ? r : null;
}
const ti = [0, 80, 200, 400, 800];
function ni(e) {
  const { enabled: t, numPages: n, goToPage: r, resolveBlockPage: a, onAnchorApplied: o } = e, i = N(""), s = N(r);
  s.current = r;
  const c = N(a);
  c.current = a;
  const l = N(o);
  l.current = o, B(() => {
    var g;
    if (!t || !Number.isFinite(n) || n < 1)
      return;
    const d = To(), u = ei(d, c.current), f = u == null ? `none:${(d == null ? void 0 : d.blockId) || ""}` : `p:${u}:b:${(d == null ? void 0 : d.blockId) || ""}`;
    if (i.current === f)
      return;
    if (u == null) {
      i.current = f;
      return;
    }
    i.current = f, d && ((g = l.current) == null || g.call(l, d, u));
    const m = [];
    for (const h of ti)
      m.push(
        setTimeout(() => {
          s.current(u);
        }, h)
      );
    return () => {
      for (const h of m) clearTimeout(h);
    };
  }, [t, n]);
}
const ot = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function ri(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function Pn(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function vr(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = Pn(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const a = Pn(n, e);
  return a < 0 ? "ignore" : a === 0 ? n.page_hash === e.pageHash ? "ignore" : "retry" : "accept";
}
function oi(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), a = vr(r, t, n);
  if (a === "retry") return e;
  if (a === "ignore")
    return { ...e, lastSeq: t.seq, connection: "live", error: "" };
  const o = new Map(n.items.map((c) => [c.item_id, c])), i = new Map((r == null ? void 0 : r.changedAtSeqById) || []);
  for (const c of t.changed_item_ids)
    o.has(c) && i.set(c, t.seq);
  const s = new Map(e.pagesByPage);
  return s.set(t.page_idx, {
    attempt: n.attempt,
    generation: n.generation,
    pageHash: n.page_hash,
    itemsById: o,
    changedAtSeqById: i,
    lastEventSeq: t.seq
  }), {
    ...e,
    pagesByPage: s,
    lastSeq: t.seq,
    connection: "live",
    error: ""
  };
}
const Mn = [250, 500, 1e3, 2e3, 4e3], Rt = [80, 160, 320, 640, 1e3, 1500], En = [250, 500, 1e3, 2e3, 4e3, 5e3], ai = /* @__PURE__ */ new Set(["succeeded", "failed", "cancelled", "canceled"]);
function Ot(e, t) {
  return new Promise((n, r) => {
    if (t.aborted) {
      r(new DOMException("Aborted", "AbortError"));
      return;
    }
    const a = () => {
      clearTimeout(o), r(new DOMException("Aborted", "AbortError"));
    }, o = setTimeout(() => {
      t.removeEventListener("abort", a), n();
    }, e);
    t.addEventListener("abort", a, { once: !0 });
  });
}
function Tt(e, t) {
  if (e instanceof dt) {
    if (e.code === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED")
      return "尚未收到可显示的页面译文";
    if (e.code === "LIVE_TRANSLATION_LAYOUT_NOT_READY")
      return "正在等待 OCR 版面数据";
  }
  return `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function ii(e, t, n, r) {
  let a = null;
  for (let o = 0; ; o += 1) {
    try {
      const s = await to(e, t.page_idx, { signal: r });
      if (vr(n.pagesByPage.get(t.page_idx), t, s) !== "retry")
        return s;
      a = new dt(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (s) {
      if ((s == null ? void 0 : s.name) === "AbortError") throw s;
      a = s;
      const c = s instanceof dt ? s.code : "";
      if (c && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(c)) throw s;
    }
    const i = Rt[Math.min(o, Rt.length - 1)];
    if (await Ot(i, r), o >= Rt.length + 2) throw a;
  }
}
function si({
  jobId: e,
  jobStatus: t,
  enabled: n
}) {
  const [r, a] = z(ot), o = N(r), i = N("");
  o.current = r;
  const s = `${e || ""}`.trim(), c = `${t || ""}`.trim().toLowerCase(), l = ai.has(c) ? c : "";
  return B(() => {
    if (!n || !s) {
      i.current = "", o.current = ot, a(ot);
      return;
    }
    const d = i.current === s;
    i.current = s;
    const u = new AbortController();
    let f = !1;
    const m = {
      ...d ? o.current : ot,
      connection: l ? "terminal" : "connecting",
      jobStatus: c,
      error: ""
    };
    o.current = m, a(m);
    const g = (y) => {
      u.signal.aborted || a((b) => {
        const R = y(b);
        return o.current = R, R;
      });
    }, h = async () => {
      let y = 0;
      for (; !u.signal.aborted; )
        try {
          const b = await Qr(s, { signal: u.signal });
          f = !0, g((R) => ({
            ...R,
            layoutByPage: ri(b),
            jobStatus: c,
            error: ""
          }));
          return;
        } catch (b) {
          if ((b == null ? void 0 : b.name) === "AbortError") return;
          if (!(b instanceof dt && b.code === "LIVE_TRANSLATION_LAYOUT_NOT_READY")) {
            g((v) => ({
              ...v,
              connection: l ? "terminal" : "unavailable",
              jobStatus: c,
              error: Tt(b, "实时译文暂不可用")
            }));
            return;
          }
          if (l) {
            g((v) => ({
              ...v,
              connection: "terminal",
              jobStatus: c,
              error: ""
            }));
            return;
          }
          g((v) => ({
            ...v,
            connection: "connecting",
            jobStatus: c,
            error: Tt(b, "正在等待 OCR 版面数据")
          })), await Ot(Mn[Math.min(y, Mn.length - 1)], u.signal).catch(() => {
          }), y += 1;
        }
    };
    return (async () => {
      if (await h(), !f || u.signal.aborted) return;
      let y = 0;
      for (; !u.signal.aborted; ) {
        l || g((b) => ({
          ...b,
          connection: b.lastSeq > 0 ? "reconnecting" : "connecting",
          jobStatus: c,
          error: b.lastSeq > 0 ? b.error : ""
        }));
        try {
          await eo(s, {
            afterSeq: o.current.lastSeq,
            signal: u.signal,
            onEvent: async (b) => {
              if (b.seq <= o.current.lastSeq) return;
              const R = await ii(
                s,
                b,
                o.current,
                u.signal
              );
              g((v) => {
                const p = oi(v, b, R);
                return l ? {
                  ...p,
                  connection: "terminal",
                  jobStatus: c
                } : {
                  ...p,
                  jobStatus: c
                };
              }), y = 0;
            }
          });
        } catch (b) {
          if ((b == null ? void 0 : b.name) === "AbortError" || u.signal.aborted) return;
          g((R) => ({
            ...R,
            connection: l ? "terminal" : "reconnecting",
            jobStatus: c,
            error: Tt(b, "实时译文连接已中断，正在重连")
          }));
        }
        if (u.signal.aborted) return;
        if (l) {
          g((b) => ({
            ...b,
            connection: "terminal",
            jobStatus: c
          }));
          return;
        }
        await Ot(En[Math.min(y, En.length - 1)], u.signal).catch(() => {
        }), y += 1;
      }
    })(), () => u.abort();
  }, [n, s, l]), r;
}
const ci = 2e3, li = /* @__PURE__ */ new Set(["book", "translate"]);
function wr(e) {
  return !!(e.jobId && e.sourceUrl && li.has(e.workflow));
}
function ui(e) {
  return !!(wr(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function di() {
  const e = ua(), t = wr({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = ui({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = si({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t
  }), a = Ua(), { shellRef: o, shellEl: i, shellWidth: s, compareColWidth: c, bindShell: l } = ka(), d = _a({
    documentId: e.documentId,
    jobId: e.jobId
  }), u = `${d}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: f, onZoomChange: m } = $a(e.mode, o, d), g = za(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: f, shellWidth: s, identityKey: u }
  ), {
    beginModeSwitch: h,
    goToPage: I,
    repinIfRestoring: y
  } = Qa(o, {
    primaryPane: g.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: d,
    restoreReady: g.primaryNumPages > 0
  });
  B(() => {
    y();
  }, [s, y]);
  const b = Ka(
    o,
    g.compareMode,
    g.rowSyncRevision,
    y
  ), R = Wa(
    o,
    g.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${f}-${g.metricsTick}`,
    g.primaryPane
  ), v = _((D, re) => {
    var ce, de;
    const ee = Math.max(
      Number(g.hudNumPages) || 0,
      Number(g.primaryNumPages) || 0,
      Number((ce = g.numPagesByPane) == null ? void 0 : ce.source) || 0,
      Number((de = g.numPagesByPane) == null ? void 0 : de.translated) || 0
    );
    I(D, ee, re);
  }, [I, g.hudNumPages, g.primaryNumPages, g.numPagesByPane]), [p, x] = z(null), T = N(null), M = _((D) => {
    T.current && clearTimeout(T.current), x(D), D && (T.current = setTimeout(() => x(null), ci));
  }, []);
  B(() => () => {
    T.current && clearTimeout(T.current);
  }, []);
  const E = _((D) => {
    const re = ct(e.regions, D);
    return re ? mt(re, g.primaryPane).page : null;
  }, [e.regions, g.primaryPane]), L = _((D, re) => {
    const ee = re || g.primaryPane, ce = typeof D == "object" && D ? `${D.block_id || ""}`.trim() : "", de = typeof D == "object" && D ? `${D.image_url || ""}`.trim() : "", K = typeof D == "object" && D ? D.page_idx != null ? Number(D.page_idx) + 1 : D.page != null ? Number(D.page) : null : typeof D == "number" ? D + 1 : null, J = Zo(e.regions, de, K) || ct(e.regions, ce) || (typeof D == "object" ? Xo(e.regions, D) : null);
    let te = J ? mt(J, ee).page : null;
    if (te == null) {
      const le = typeof D == "number" ? D : (D == null ? void 0 : D.page_idx) ?? (D == null ? void 0 : D.page);
      if (le != null && `${le}`.trim() !== "") {
        const ue = Number(le);
        Number.isFinite(ue) && ue >= 0 && (te = Math.floor(ue) + 1);
      }
    }
    te == null || te < 1 || (M(J), v(te, ee));
  }, [M, v, g.primaryPane, e.regions]);
  ni({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: g.hudNumPages || 0,
    goToPage: v,
    resolveBlockPage: E,
    onAnchorApplied: (D) => {
      M(ct(e.regions, D.blockId));
    }
  });
  const { setModeKeepingPage: P } = Ba({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: h
  }), [S, A] = z(null), {
    selection: C,
    clearSelection: F
  } = ja(o, !e.boot.loading && !e.boot.failed), U = _(() => {
    A(null), F();
  }, [F]), k = _((D) => {
    F(), A(D);
  }, [F]);
  B(() => {
    C && A(null);
  }, [C]), B(() => {
    const D = o.current;
    if (!D) return;
    const re = () => A(null);
    return D.addEventListener("scroll", re, { passive: !0 }), () => D.removeEventListener("scroll", re);
  }, [i, o]);
  const $ = C || S;
  B(() => {
    M(null), U();
  }, [u, M, U]);
  const W = !e.boot.loading && !e.boot.failed;
  Ma({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    setMode: P,
    userZoom: f,
    onZoomChange: m,
    currentPage: R,
    numPages: g.hudNumPages,
    goToPage: v,
    enabled: W
  });
  const H = Y(() => a, [a.active, a.open, a.close, a.toggle, a.isOpen]), Q = Y(() => ({ bindShell: l, shellEl: i, shellWidth: s, compareColWidth: c, shellRef: o }), [l, i, s, c, o]), X = Y(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), ie = Y(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: f,
    onZoomChange: m,
    shell: Q,
    panes: g,
    sessionFiles: X,
    rowHeights: b,
    goToPage: v,
    activeRegion: p,
    jumpToAnchor: L,
    setModeKeepingPage: P,
    download: e.download,
    showHud: W,
    tools: H,
    selection: $,
    clearSelection: U,
    selectRegion: k,
    documentTitle: e.title || "",
    viewStateKey: d,
    liveTranslation: r,
    liveTranslationAvailable: n
  }), [e, Q, g, X, b, v, p, L, P, W, H, $, U, k, f, m, d, r, n]);
  return Y(() => ({
    ...ie,
    currentPage: R
  }), [ie, R]);
}
const fi = "retainpdf:soft-reader-close";
function mi() {
  return new URL("./index.html", window.location.href).href;
}
function pi() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: fi },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function hi(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), a = new URL(e, r);
    return a.origin === r.origin && !/reader\.html$/i.test(a.pathname) && !/detail\.html$/i.test(a.pathname);
  } catch {
    return !1;
  }
}
function gi() {
  if (!(typeof window > "u") && !pi()) {
    if (hi(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(mi());
  }
}
function bi({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ O(
    "button",
    {
      id: "reader-close-home-btn",
      type: "button",
      className: "reader-close-home-btn",
      "aria-label": "返回主页",
      title: "返回主页",
      onClick: () => {
        e == null || e(), gi();
      },
      children: [
        /* @__PURE__ */ w(Ze, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
        /* @__PURE__ */ w("span", { className: "reader-close-home-label", children: "关闭" })
      ]
    }
  );
}
let Ln = !1;
function yi() {
  if (Ln)
    return;
  const e = kt("build/pdf.worker.mjs");
  e && (po.GlobalWorkerOptions.workerSrc = e, Ln = !0);
}
const vi = {
  formula: "公式",
  table: "表格",
  figure: "图片",
  text: "文字",
  region: "区域"
};
function wi({
  pane: e,
  width: t,
  height: n,
  regions: r,
  onSelect: a
}) {
  const o = r.flatMap((i) => {
    if (!cr(i.region)) return [];
    const s = vt(i, t, n);
    return s ? [{ highlight: i, rect: s }] : [];
  });
  return o.length ? /* @__PURE__ */ w("div", { className: "reader-structure-selection-layer", "aria-label": "PDF 结构选择层", children: o.map(({ highlight: i, rect: s }) => {
    const c = i.region, l = Gt(c), d = vi[l];
    return /* @__PURE__ */ O(
      "button",
      {
        type: "button",
        className: `reader-structure-selection-target is-${l}`,
        "data-reader-region-id": c.itemId,
        "data-reader-region-kind": l,
        style: s,
        "aria-label": `${d}区域，点击选择`,
        title: `${d} · 点击选择`,
        onClick: (u) => {
          u.stopPropagation();
          const f = u.currentTarget.getBoundingClientRect();
          a == null || a({
            selectionType: "region",
            region: c,
            kind: l,
            page: i.box.page,
            pane: e,
            rect: {
              left: f.left,
              top: f.top,
              width: f.width,
              height: f.height
            }
          });
        },
        children: [
          /* @__PURE__ */ w("span", { className: "reader-structure-selection-label", "aria-hidden": "true", children: d }),
          /* @__PURE__ */ w("span", { className: "sr-only", children: lr(c, e) })
        ]
      },
      c.itemId
    );
  }) }) : null;
}
function Si(e, t, n) {
  return e.flatMap((r) => {
    if (Gt(r.region) !== "text") return [];
    const a = vt(r, t, n);
    return a ? [{ itemId: r.itemId, highlight: r, rect: a }] : [];
  });
}
function An(e, t, n) {
  let r = null, a = Number.POSITIVE_INFINITY;
  for (const o of e) {
    const { rect: i } = o;
    if (t < i.left || t > i.left + i.width || n < i.top || n > i.top + i.height)
      continue;
    const s = i.width * i.height;
    s < a && (r = o, a = s);
  }
  return r;
}
function Ii({ target: e }) {
  return e ? /* @__PURE__ */ w("div", { className: "reader-text-hover-layer", "aria-hidden": "true", children: /* @__PURE__ */ w(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      style: e.rect,
      children: /* @__PURE__ */ w("span", { className: "reader-text-hover-label", children: "文字" })
    }
  ) }) : null;
}
function Ri(e, t) {
  const n = e.page_idx + 1, r = {
    page: n,
    bbox: t.bbox,
    unit: "pdf_point",
    origin: "top_left",
    text: t.source_text
  }, a = {
    itemId: t.item_id,
    source: r,
    translated: r,
    markdown: t.source_text,
    regionType: t.kind,
    status: "live_translation",
    assetIds: [],
    assetUrls: []
  };
  return {
    itemId: t.item_id,
    region: a,
    box: r,
    pageSize: { page: n, width: e.width, height: e.height }
  };
}
function Ti(e, t, n, r) {
  if (!e || !t) return [];
  const a = [];
  for (const o of e.blocks) {
    const i = t.itemsById.get(o.item_id);
    if (!(i != null && i.translated_text)) continue;
    const s = vt(
      Ri(e, o),
      n,
      r
    );
    s && a.push({
      itemId: o.item_id,
      translatedText: i.translated_text,
      status: i.status,
      kind: o.kind,
      sourceText: o.source_text,
      typography: o.typography,
      rect: s,
      changedAtSeq: t.changedAtSeqById.get(o.item_id) || 0,
      changedNow: t.changedAtSeqById.get(o.item_id) === t.lastEventSeq
    });
  }
  return a;
}
const xi = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', kn = /* @__PURE__ */ new Map();
function Pi(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Mi(e) {
  const t = `${e || ""}`, { text: n, slots: r } = bo(t), a = Pi(n), o = yo(a, r);
  if (!r.length)
    return { fallbackHtml: o, richHtml: Promise.resolve(o), hasMath: !1 };
  let i = kn.get(t);
  return i || (i = vo(a, r), kn.set(t, i)), { fallbackHtml: o, richHtml: i, hasMath: !0 };
}
function xt(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function ye(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Ei(e, t) {
  const n = e.typography, r = ye(t) || 1, a = ye(n == null ? void 0 : n.font_size_pt), o = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), i = e.rect.height / Math.max(1.28, o * 1.18), s = xt(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(i, s * r)), l = ye(n == null ? void 0 : n.fit_min_font_size_pt), d = ye(n == null ? void 0 : n.fit_max_font_size_pt), u = Math.max(3.5, (l || 5.5) * r), f = Math.max(
    u,
    d ? d * r : a ? a * r : c
  ), m = a ? a * r : c, g = ye(n == null ? void 0 : n.leading_em), h = [
    ye(n == null ? void 0 : n.padding_top_pt) || 0,
    ye(n == null ? void 0 : n.padding_right_pt) || 0,
    ye(n == null ? void 0 : n.padding_bottom_pt) || 0,
    ye(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((I) => I * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || xi,
    fontSizePx: Math.max(u, Math.min(f, m)),
    minFontSizePx: u,
    maxFontSizePx: f,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (xt(e.kind) ? 600 : 400),
    textAlign: (n == null ? void 0 : n.text_align) || (xt(e.kind) ? "center" : "justify"),
    padding: h,
    exact: !!a
  };
}
function Li({ item: e, pageScale: t }) {
  const n = N(null), r = Y(
    () => Mi(e.translatedText),
    [e.translatedText]
  ), [a, o] = z(r.fallbackHtml), i = Y(
    () => Ei(e, t),
    [e, t]
  );
  B(() => {
    let u = !0;
    return o(r.fallbackHtml), r.hasMath && r.richHtml.then((f) => {
      u && o(f);
    }), () => {
      u = !1;
    };
  }, [r]), Ae(() => {
    const u = n.current;
    if (!u) return;
    const [f, m, g, h] = i.padding, I = Math.max(1, e.rect.width - h - m), y = Math.max(1, e.rect.height - f - g);
    let b = i.minFontSizePx, R = i.maxFontSizePx, v = Math.min(i.fontSizePx, R);
    const p = (x) => (u.style.fontSize = `${x}px`, u.scrollWidth <= I + 0.5 && u.scrollHeight <= y + 0.5);
    if (p(v)) {
      if (!i.exact) {
        b = v;
        for (let x = 0; x < 6; x += 1) {
          const T = (b + R) / 2;
          p(T) ? (v = T, b = T) : R = T;
        }
      }
    } else {
      R = v, v = b;
      for (let x = 0; x < 8; x += 1) {
        const T = (b + R) / 2;
        p(T) ? (v = T, b = T) : R = T;
      }
    }
    u.style.fontSize = `${Math.max(i.minFontSizePx, v).toFixed(2)}px`;
  }, [a, e.rect.height, e.rect.width, i]);
  const [s, c, l, d] = i.padding;
  return /* @__PURE__ */ w(
    "div",
    {
      className: `reader-live-translation-item${e.changedNow ? " is-changed" : ""}`,
      "data-live-translation-item": e.itemId,
      "data-live-translation-kind": e.kind,
      "data-live-translation-status": e.status,
      "data-live-translation-typography": i.exact ? "typst" : "fitted",
      style: {
        ...e.rect,
        padding: `${s}px ${c}px ${l}px ${d}px`
      },
      children: /* @__PURE__ */ w(
        "div",
        {
          ref: n,
          className: "reader-live-translation-content",
          style: {
            fontFamily: i.fontFamily,
            fontSize: i.fontSizePx,
            fontWeight: i.fontWeight,
            lineHeight: i.lineHeight,
            textAlign: i.textAlign
          },
          dangerouslySetInnerHTML: { __html: a }
        }
      )
    }
  );
}
function Ai({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const a = Y(
    () => Ti(e, t, n, r),
    [r, e, t, n]
  );
  return a.length ? /* @__PURE__ */ w(
    "div",
    {
      className: "reader-live-translation-overlay",
      "data-live-translation-page": e == null ? void 0 : e.page_idx,
      "data-live-translation-generation": t == null ? void 0 : t.generation,
      "aria-hidden": "true",
      children: a.map((o) => /* @__PURE__ */ w(
        Li,
        {
          item: o,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${o.itemId}:${o.changedAtSeq}`
      ))
    }
  ) : null;
}
const ki = Wt(Ai), Sr = 1.414, Ni = "120% 0px", bt = /* @__PURE__ */ new Map();
function zi(e, t, n) {
  let r = bt.get(e);
  if (!r) {
    const a = /* @__PURE__ */ new Map();
    r = { observer: new IntersectionObserver(
      (i) => {
        for (const s of i) {
          const c = a.get(s.target);
          c && c(s.isIntersecting);
        }
      },
      { root: e, rootMargin: Ni, threshold: 0 }
    ), elements: a }, bt.set(e, r);
  }
  return r.elements.set(n, t), r.observer.observe(n), r;
}
function Ci(e, t) {
  const n = bt.get(e);
  n && (n.observer.unobserve(t), n.elements.delete(t), n.elements.size === 0 && (n.observer.disconnect(), bt.delete(e)));
}
function _i({
  pageNumber: e,
  width: t,
  devicePixelRatio: n,
  scrollRoot: r,
  pane: a,
  syncedMinHeight: o = 0,
  onMetrics: i,
  cachedAspect: s,
  onAspectChange: c,
  sentinelRef: l,
  regionHighlight: d = null,
  regionTargets: u = [],
  onSelectRegion: f,
  liveTranslationLayout: m,
  liveTranslationPage: g,
  showLiveTranslation: h = a === "source"
}) {
  const I = N(null), [y, b] = z(!1), [R, v] = z(s ?? Sr);
  B(() => {
    s != null && Math.abs(s - R) >= 1e-3 && v(s);
  }, [s]);
  const p = N(l);
  p.current = l;
  const x = N((k) => {
    var $;
    I.current = k, ($ = p.current) == null || $.call(p, k);
  }).current;
  B(() => {
    const k = I.current;
    if (!k) return;
    if (typeof IntersectionObserver > "u") {
      b(!0);
      return;
    }
    let $ = null;
    return zi(r, (H) => {
      H ? ($ && (clearTimeout($), $ = null), b(!0)) : ($ && clearTimeout($), $ = setTimeout(() => {
        b(!1);
      }, 120));
    }, k), () => {
      $ && clearTimeout($), Ci(r, k);
    };
  }, [r, e]);
  const T = Math.max(120, Math.floor(t * R)), M = Math.max(T, Math.ceil(o || 0)), E = vt(d, t, T), L = Y(
    () => Si(u, t, T),
    [T, u, t]
  ), [P, S] = z(null), A = Y(
    () => L.find((k) => k.itemId === P) || null,
    [P, L]
  ), C = (k) => {
    if (k.buttons !== 0) {
      S(null);
      return;
    }
    const $ = k.currentTarget.getBoundingClientRect(), W = An(
      L,
      k.clientX - $.left,
      k.clientY - $.top
    ), H = (W == null ? void 0 : W.itemId) || null;
    S((Q) => Q === H ? Q : H);
  }, F = (k) => {
    var H, Q, X;
    if (!f || (Q = (H = k.target) == null ? void 0 : H.closest) != null && Q.call(H, ".reader-structure-selection-target") || `${((X = window.getSelection()) == null ? void 0 : X.toString()) || ""}`.trim()) return;
    const $ = k.currentTarget.getBoundingClientRect(), W = An(
      L,
      k.clientX - $.left,
      k.clientY - $.top
    );
    W && f({
      selectionType: "region",
      region: W.highlight.region,
      kind: "text",
      page: W.highlight.box.page,
      pane: a === "translated" ? "translated" : "source",
      rect: {
        left: $.left + W.rect.left,
        top: $.top + W.rect.top,
        width: W.rect.width,
        height: W.rect.height
      }
    });
  }, U = (k) => {
    v(($) => {
      if (Math.abs($ - k) < 1e-3) return $;
      const W = () => c == null ? void 0 : c(e, k);
      return typeof queueMicrotask < "u" ? queueMicrotask(W) : setTimeout(W, 0), k;
    });
  };
  return /* @__PURE__ */ O(
    "div",
    {
      ref: x,
      "data-reader-page": e,
      "data-reader-pane": a,
      "data-natural-height": T,
      className: Xt,
      onPointerMoveCapture: C,
      onClick: F,
      onPointerLeave: () => S(null),
      style: {
        width: t,
        height: M,
        minHeight: M
      },
      children: [
        y ? /* @__PURE__ */ w(
          ho,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: !0,
            renderAnnotationLayer: !1,
            className: "reader-react-pdf-page",
            loading: /* @__PURE__ */ w(
              "div",
              {
                className: "reader-react-pdf-page-placeholder",
                style: { width: t, height: T }
              }
            ),
            onLoadSuccess: (k) => {
              try {
                const $ = k.getViewport({ scale: 1 });
                if ($.width > 0) {
                  const W = $.height / $.width;
                  U(W);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              i == null || i();
            }
          }
        ) : /* @__PURE__ */ w(
          "div",
          {
            className: "reader-react-pdf-page-placeholder",
            style: { width: t, height: T },
            "aria-hidden": !0
          }
        ),
        E ? /* @__PURE__ */ w(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": d == null ? void 0 : d.itemId,
            style: E,
            "aria-hidden": "true"
          }
        ) : null,
        y && h ? /* @__PURE__ */ w(
          ki,
          {
            layoutPage: m,
            pageState: g,
            width: t,
            height: T
          }
        ) : null,
        /* @__PURE__ */ w(Ii, { target: y ? A : null }),
        /* @__PURE__ */ w(
          wi,
          {
            pane: a === "translated" ? "translated" : "source",
            width: t,
            height: T,
            regions: u,
            onSelect: f
          }
        )
      ]
    }
  );
}
const Di = Wt(_i), Pt = 5;
let Nn = 1;
const zn = /* @__PURE__ */ new WeakMap();
function Fi(e) {
  if (!e) return 0;
  const t = zn.get(e);
  if (t) return t;
  const n = Nn;
  return Nn += 1, zn.set(e, n), n;
}
function Oi() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const $i = Ur(
  function({
    pane: t,
    url: n = "",
    preloadedFile: r = null,
    userZoom: a = 1,
    visible: o = !0,
    emptyLabel: i = "暂无 PDF",
    scrollRoot: s = null,
    pageWidthOverride: c = null,
    rowHeights: l,
    onMetrics: d,
    onLoadSuccess: u,
    onLoadError: f,
    onNumPagesChange: m,
    activeRegion: g = null,
    regions: h = [],
    readerMetadata: I = null,
    onSelectRegion: y,
    liveTranslation: b,
    showLiveTranslation: R = t === "source",
    liveTranslationPendingLabel: v = ""
  }, p) {
    yi();
    const { file: x, loading: T, error: M } = ia(n, r), E = `${n}\0${Fi(x)}`, L = N(E);
    L.current = E;
    const P = Y(
      () => ra(x),
      [x, n]
    ), [S, A] = z(0), [C, F] = z(""), [U, k] = z(null), [$, W] = z(480), H = N(null), Q = N(0), X = Y(() => Oi(), []), ie = Y(() => ({
      cMapUrl: kt("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: kt("standard_fonts/")
    }), []);
    Ht(p, () => U, [U]), B(() => {
      const j = (q) => {
        !Number.isFinite(q) || q < 80 || Math.abs(q - Q.current) < 8 || (Q.current = q, W(q));
      }, Z = c && c >= 80 ? c : (s == null ? void 0 : s.clientWidth) || 0;
      if (j(Z), !s || typeof ResizeObserver > "u" || c && c >= 80) return;
      const G = new ResizeObserver((q) => {
        var ge, rt;
        const oe = ((rt = (ge = q[0]) == null ? void 0 : ge.contentRect) == null ? void 0 : rt.width) ?? s.clientWidth;
        !Number.isFinite(oe) || oe < 80 || (H.current && clearTimeout(H.current), H.current = setTimeout(() => j(oe), 80));
      });
      return G.observe(s), () => {
        G.disconnect(), H.current && clearTimeout(H.current);
      };
    }, [c, s, o]);
    const D = Y(
      () => ba($, a),
      [$, a]
    ), [re, ee] = z(() => /* @__PURE__ */ new Map()), [ce, de] = z(() => /* @__PURE__ */ new Set()), K = N(/* @__PURE__ */ new Map()), J = N(null), te = _((j, Z) => {
      ee((G) => {
        if (G.get(j) === Z) return G;
        const q = new Map(G);
        return q.set(j, Z), q;
      });
    }, []), le = _((j, Z) => {
      const G = K.current, q = G.get(j);
      if (q && J.current)
        try {
          J.current.unobserve(q);
        } catch {
        }
      if (Z) {
        if (G.set(j, Z), J.current)
          try {
            J.current.observe(Z);
          } catch {
          }
      } else
        G.delete(j);
    }, []);
    B(() => {
      if (!s || typeof IntersectionObserver > "u") return;
      const j = new IntersectionObserver(
        (Z) => {
          de((G) => {
            const q = new Set(G);
            let oe = !1;
            for (const ge of Z) {
              const rt = ge.target, He = Number(rt.getAttribute("data-reader-page"));
              Number.isFinite(He) && (ge.isIntersecting ? q.has(He) || (q.add(He), oe = !0) : q.has(He) && (q.delete(He), oe = !0));
            }
            return oe ? q : G;
          });
        },
        { root: s, rootMargin: "0px", threshold: 0 }
      );
      J.current = j;
      for (const Z of K.current.values())
        try {
          j.observe(Z);
        } catch {
        }
      return () => {
        j.disconnect(), J.current === j && (J.current = null);
      };
    }, [s]), Ae(() => {
      A(0), F(""), de(/* @__PURE__ */ new Set()), ee(/* @__PURE__ */ new Map()), K.current.clear(), m == null || m(0, t);
    }, [E, m, t]);
    const ue = _(
      ({ numPages: j }) => {
        L.current === E && (A(j), F(""), m == null || m(j, t), u == null || u({ numPages: j, pane: t }));
      },
      [E, u, m, t]
    ), je = _(
      (j) => {
        if (L.current !== E) return;
        const Z = (j == null ? void 0 : j.message) || "PDF 解析失败";
        F(Z), A(0), m == null || m(0, t), f == null || f(j, t);
      },
      [E, f, m, t]
    ), Be = Y(
      () => S > 0 ? Array.from({ length: S }, (j, Z) => Z + 1) : [],
      [S]
    ), Te = Y(
      () => In(g, I, t),
      [g, I, t]
    ), Ue = Y(() => {
      const j = /* @__PURE__ */ new Map();
      for (const Z of h) {
        const G = In(Z, I, t);
        if (!G) continue;
        const q = j.get(G.box.page) || [];
        q.push(G), j.set(G.box.page, q);
      }
      return j;
    }, [t, I, h]), We = Y(() => {
      if (S === 0) return /* @__PURE__ */ new Set();
      if (!(!!s && typeof IntersectionObserver < "u" && o)) return new Set(Be);
      if (ce.size === 0) {
        const G = Math.min(S, Pt * 2 + 1);
        return new Set(Array.from({ length: G }, (q, oe) => oe + 1));
      }
      const Z = /* @__PURE__ */ new Set();
      for (const G of ce)
        for (let q = -Pt; q <= Pt; q++) {
          const oe = G + q;
          oe >= 1 && oe <= S && Z.add(oe);
        }
      return Z;
    }, [S, Be, s, o, ce]), ze = !n || !!M || !!C, Br = n && (M || C) || i;
    return /* @__PURE__ */ O(
      "section",
      {
        ref: k,
        className: `reader-panel reader-react-pdf-pane${o ? "" : " is-hidden"}`,
        "data-reader-pane": t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": o ? "true" : "false",
        "data-live-translation-status": (b == null ? void 0 : b.jobStatus) || void 0,
        "aria-hidden": o ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          v ? /* @__PURE__ */ O("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ w("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ w("span", { children: v })
          ] }) : null,
          ze && !T ? /* @__PURE__ */ w("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: Br }) : null,
          T ? /* @__PURE__ */ w("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          P && !M ? /* @__PURE__ */ w("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ w(
            go,
            {
              file: P,
              loading: null,
              error: null,
              options: ie,
              onLoadSuccess: ue,
              onLoadError: je,
              className: "reader-react-pdf-document",
              children: Be.map((j) => {
                if (We.has(j))
                  return /* @__PURE__ */ w(
                    Di,
                    {
                      pane: t,
                      pageNumber: j,
                      width: D,
                      devicePixelRatio: X,
                      scrollRoot: s,
                      syncedMinHeight: (l == null ? void 0 : l.get(j)) || 0,
                      onMetrics: d,
                      cachedAspect: re.get(j),
                      onAspectChange: te,
                      sentinelRef: (ge) => le(j, ge),
                      regionHighlight: (Te == null ? void 0 : Te.box.page) === j ? Te : null,
                      regionTargets: Ue.get(j),
                      onSelectRegion: y,
                      liveTranslationLayout: b == null ? void 0 : b.layoutByPage.get(j - 1),
                      liveTranslationPage: b == null ? void 0 : b.pagesByPage.get(j - 1),
                      showLiveTranslation: R
                    },
                    `${t}-${j}`
                  );
                const G = re.get(j) ?? Sr, q = Math.max(120, Math.floor(D * G)), oe = Math.max(q, Math.ceil((l == null ? void 0 : l.get(j)) || 0));
                return /* @__PURE__ */ w(
                  "div",
                  {
                    ref: (ge) => le(j, ge),
                    "data-reader-page": j,
                    "data-reader-pane": t,
                    "data-natural-height": q,
                    className: Xt,
                    style: {
                      width: D,
                      height: oe,
                      minHeight: oe
                    },
                    children: /* @__PURE__ */ w(
                      "div",
                      {
                        className: "reader-react-pdf-page-placeholder",
                        style: { width: D, height: q },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${j}`
                );
              })
            },
            E
          ) }) : null
        ]
      }
    );
  }
), Cn = Wt($i);
function ji({
  mode: e,
  compareMode: t,
  showSource: n,
  showTranslated: r,
  markdownSplit: a,
  liveTranslationPair: o = !1
}) {
  if (o)
    return {
      mode: "compare",
      compareMode: !0,
      showSource: !0,
      showTranslated: !0
    };
  const i = a && e === "compare";
  return {
    mode: i ? "source" : e,
    compareMode: t && !a,
    showSource: i ? !0 : n,
    showTranslated: i ? !1 : r
  };
}
function Bi(e, t, n = e * 2) {
  return t ? Math.min(e * 2, n) : e;
}
function Ui(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Wi(e) {
  const {
    mode: t,
    bindShell: n,
    shellEl: r,
    userZoom: a,
    compareMode: o,
    shellWidth: i,
    rowHeights: s,
    mountSource: c,
    mountTranslated: l,
    showSource: d,
    showTranslated: u,
    sourceOnly: f,
    sourceUrl: m,
    translatedUrl: g,
    sourceFile: h,
    translatedFile: I,
    onMetrics: y,
    onNumPagesChange: b,
    activeRegion: R,
    regions: v = [],
    readerMetadata: p,
    onSelectRegion: x,
    markdownSplit: T = !1,
    assistantSplit: M = !1,
    reversePanes: E = !1,
    liveTranslation: L,
    liveTranslationPair: P = !1
  } = e, S = ji({
    mode: t,
    compareMode: o,
    showSource: d,
    showTranslated: u,
    markdownSplit: T,
    liveTranslationPair: P
  }), A = Bi(
    i,
    T || M,
    typeof document > "u" ? i * 2 : document.documentElement.clientWidth
  );
  return /* @__PURE__ */ w(
    "div",
    {
      ref: n,
      id: wa,
      className: Sa,
      "data-reader-scroll-shell": "true",
      "data-reader-region-count": v.length,
      "data-reader-structured-region-count": v.filter(cr).length,
      "data-reader-metadata-ready": p ? "true" : "false",
      children: /* @__PURE__ */ O(
        "main",
        {
          className: `reader-react-grid reader-mode-${S.mode}${E ? " is-reversed" : ""}`,
          "data-reader-mode": T ? "markdown-split" : M ? "assistant-split" : t,
          children: [
            c ? /* @__PURE__ */ w(
              Cn,
              {
                pane: "source",
                url: m,
                preloadedFile: h,
                userZoom: a,
                visible: S.showSource,
                scrollRoot: r,
                pageWidthOverride: A,
                rowHeights: S.compareMode ? s : void 0,
                onMetrics: y,
                emptyLabel: f ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                onNumPagesChange: b,
                activeRegion: R,
                regions: v,
                readerMetadata: p,
                onSelectRegion: x,
                liveTranslation: P ? void 0 : L,
                showLiveTranslation: !P
              }
            ) : null,
            l || P ? /* @__PURE__ */ w(
              Cn,
              {
                pane: "translated",
                url: P ? m : g,
                preloadedFile: P ? h : I,
                userZoom: a,
                visible: S.showTranslated,
                scrollRoot: r,
                pageWidthOverride: A,
                rowHeights: S.compareMode ? s : void 0,
                onMetrics: y,
                emptyLabel: "暂无译文 PDF",
                onNumPagesChange: b,
                activeRegion: R,
                regions: v,
                readerMetadata: p,
                onSelectRegion: x,
                liveTranslation: P ? L : void 0,
                showLiveTranslation: P,
                liveTranslationPendingLabel: P ? Ui(L) : ""
              }
            ) : null
          ]
        }
      )
    }
  );
}
const Hi = [
  { id: "source", label: "源文件", Icon: nr },
  { id: "compare", label: "对照", Icon: rr },
  { id: "translated", label: "翻译文件", Icon: or }
];
function Ji(e) {
  return e.connection === "live" ? `实时译文 · ${e.pagesByPage.size} 页` : e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function Ki(e) {
  return e.id === "translated" ? e.sourceOnly : e.id === "compare" ? !e.documentReady || e.sourceOnly && !e.liveTranslationAvailable : !1;
}
function qi({
  mode: e,
  documentReady: t,
  sourceOnly: n = !1,
  onModeChange: r,
  liveTranslation: a = null
}) {
  const o = a ? Ji(a.state) : "";
  return /* @__PURE__ */ O("header", { className: "reader-workspace-bar", children: [
    a ? /* @__PURE__ */ O(
      "button",
      {
        type: "button",
        className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
        "aria-pressed": a.visible,
        "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
        title: a.state.error || o,
        onClick: a.onToggle,
        children: [
          /* @__PURE__ */ w(ro, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
          /* @__PURE__ */ w("span", { className: "reader-live-translation-toggle-label", children: o })
        ]
      }
    ) : null,
    /* @__PURE__ */ w("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Hi.map(({ id: i, label: s, Icon: c }) => {
      const l = e === i, d = Ki({
        id: i,
        documentReady: t,
        sourceOnly: n,
        liveTranslationAvailable: !!a
      });
      return /* @__PURE__ */ O(
        "button",
        {
          type: "button",
          className: `reader-workspace-tab${l ? " is-active" : ""}`,
          role: "tab",
          "aria-selected": l,
          "aria-label": s,
          title: d ? `${s} 需要文档任务` : s,
          disabled: d,
          onClick: () => r(i),
          children: [
            /* @__PURE__ */ w(c, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ w("span", { className: "reader-workspace-tab-label", children: s })
          ]
        },
        i
      );
    }) })
  ] });
}
const _n = [
  { id: "markdown", label: "Markdown", Icon: ar },
  { id: "ai", label: "AI 问答", Icon: qt }
];
function Vi({
  active: e,
  onSelect: t,
  onClose: n
}) {
  return e ? /* @__PURE__ */ O("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ w("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: _n.map(({ id: r, label: a, Icon: o }) => {
      const i = e === r;
      return /* @__PURE__ */ O(
        "button",
        {
          type: "button",
          role: "tab",
          "aria-selected": i,
          className: `reader-assistant-dock-tab${i ? " is-active" : ""}`,
          onClick: () => t(r),
          children: [
            /* @__PURE__ */ w(o, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
            /* @__PURE__ */ w("span", { children: a })
          ]
        },
        r
      );
    }) }),
    /* @__PURE__ */ w(
      "button",
      {
        type: "button",
        className: "reader-assistant-dock-close",
        "aria-label": "关闭阅读辅助面板",
        title: "关闭辅助面板",
        onClick: n,
        children: /* @__PURE__ */ w(Ze, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : /* @__PURE__ */ w("nav", { className: "reader-assistant-rail", "aria-label": "阅读辅助工具", children: _n.map(({ id: r, label: a, Icon: o }) => /* @__PURE__ */ O(
    "button",
    {
      type: "button",
      className: "reader-assistant-rail-button",
      "aria-label": `打开${a}`,
      title: a,
      onClick: () => t(r),
      children: [
        /* @__PURE__ */ w(o, { size: 18, strokeWidth: 2, "aria-hidden": !0 }),
        /* @__PURE__ */ w("span", { children: a === "AI 问答" ? "AI" : "MD" })
      ]
    },
    r
  )) });
}
function Gi(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Yi(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Xi(e) {
  return e / 100 * window.innerHeight;
}
function Zi(e) {
  return e / 100 * window.innerWidth;
}
function Qi(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function qe({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [a, o] = Qi(n);
  switch (o) {
    case "%": {
      r = a / 100 * e;
      break;
    }
    case "px": {
      r = a;
      break;
    }
    case "rem": {
      r = Yi(t, a);
      break;
    }
    case "em": {
      r = Gi(t, a);
      break;
    }
    case "vh": {
      r = Xi(a);
      break;
    }
    case "vw": {
      r = Zi(a);
      break;
    }
  }
  return r;
}
function se(e) {
  return parseFloat(e.toFixed(3));
}
function $e({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, a) => (r += t === "horizontal" ? a.element.offsetWidth : a.element.offsetHeight, r), 0);
}
function $t(e) {
  const { panels: t } = e, n = $e({ group: e });
  return n === 0 ? t.map((r) => ({
    groupResizeBehavior: r.panelConstraints.groupResizeBehavior,
    collapsedSize: 0,
    collapsible: r.panelConstraints.collapsible === !0,
    defaultSize: void 0,
    disabled: r.panelConstraints.disabled,
    minSize: 0,
    maxSize: 100,
    panelId: r.id
  })) : t.map((r) => {
    const { element: a, panelConstraints: o } = r;
    let i = 0;
    if (o.collapsedSize !== void 0) {
      const d = qe({
        groupSize: n,
        panelElement: a,
        styleProp: o.collapsedSize
      });
      i = se(d / n * 100);
    }
    let s;
    if (o.defaultSize !== void 0) {
      const d = qe({
        groupSize: n,
        panelElement: a,
        styleProp: o.defaultSize
      });
      s = se(d / n * 100);
    }
    let c = 0;
    if (o.minSize !== void 0) {
      const d = qe({
        groupSize: n,
        panelElement: a,
        styleProp: o.minSize
      });
      c = se(d / n * 100);
    }
    let l = 100;
    if (o.maxSize !== void 0) {
      const d = qe({
        groupSize: n,
        panelElement: a,
        styleProp: o.maxSize
      });
      l = se(d / n * 100);
    }
    return {
      groupResizeBehavior: o.groupResizeBehavior,
      collapsedSize: i,
      collapsible: o.collapsible === !0,
      defaultSize: s,
      disabled: o.disabled,
      minSize: c,
      maxSize: l,
      panelId: r.id
    };
  });
}
function V(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function jt(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? es : ts
  );
}
function es(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function ts(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function Ir(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Rr(e, t) {
  return {
    x: e.x >= t.left && e.x <= t.right ? 0 : Math.min(
      Math.abs(e.x - t.left),
      Math.abs(e.x - t.right)
    ),
    y: e.y >= t.top && e.y <= t.bottom ? 0 : Math.min(
      Math.abs(e.y - t.top),
      Math.abs(e.y - t.bottom)
    )
  };
}
function ns({
  orientation: e,
  rects: t,
  targetRect: n
}) {
  const r = {
    x: n.x + n.width / 2,
    y: n.y + n.height / 2
  };
  let a, o = Number.MAX_VALUE;
  for (const i of t) {
    const { x: s, y: c } = Rr(r, i), l = e === "horizontal" ? s : c;
    l < o && (o = l, a = i);
  }
  return V(a, "No rect found"), a;
}
let at;
function rs() {
  return at === void 0 && (typeof matchMedia == "function" ? at = !!matchMedia("(pointer:coarse)").matches : at = !1), at;
}
function Tr(e) {
  const { element: t, orientation: n, panels: r, separators: a } = e, o = jt(
    n,
    Array.from(t.children).filter(Ir).map((g) => ({ element: g }))
  ).map(({ element: g }) => g), i = [];
  let s = !1, c = !1, l = -1, d = -1, u = 0, f, m = [];
  {
    let g = -1;
    for (const h of o)
      h.hasAttribute("data-panel") && (g++, h.hasAttribute("data-disabled") || (u++, l === -1 && (l = g), d = g));
  }
  if (u > 1) {
    let g = -1;
    for (const h of o)
      if (h.hasAttribute("data-panel")) {
        g++;
        const I = r.find(
          (y) => y.element === h
        );
        if (I) {
          if (f) {
            const y = f.element.getBoundingClientRect(), b = h.getBoundingClientRect();
            let R;
            if (c) {
              const v = n === "horizontal" ? new DOMRect(
                y.right,
                y.top,
                0,
                y.height
              ) : new DOMRect(
                y.left,
                y.bottom,
                y.width,
                0
              ), p = n === "horizontal" ? new DOMRect(b.left, b.top, 0, b.height) : new DOMRect(b.left, b.top, b.width, 0);
              switch (m.length) {
                case 0: {
                  R = [
                    v,
                    p
                  ];
                  break;
                }
                case 1: {
                  const x = m[0], T = ns({
                    orientation: n,
                    rects: [y, b],
                    targetRect: x.element.getBoundingClientRect()
                  });
                  R = [
                    x,
                    T === y ? p : v
                  ];
                  break;
                }
                default: {
                  R = m;
                  break;
                }
              }
            } else
              m.length ? R = m : R = [
                n === "horizontal" ? new DOMRect(
                  y.right,
                  b.top,
                  b.left - y.right,
                  b.height
                ) : new DOMRect(
                  b.left,
                  y.bottom,
                  b.width,
                  b.top - y.bottom
                )
              ];
            for (const v of R) {
              let p = "width" in v ? v : v.element.getBoundingClientRect();
              const x = rs() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (p.width < x) {
                const M = x - p.width;
                p = new DOMRect(
                  p.x - M / 2,
                  p.y,
                  p.width + M,
                  p.height
                );
              }
              if (p.height < x) {
                const M = x - p.height;
                p = new DOMRect(
                  p.x,
                  p.y - M / 2,
                  p.width,
                  p.height + M
                );
              }
              const T = g <= l || g > d;
              !s && !T && i.push({
                group: e,
                groupSize: $e({ group: e }),
                panels: [f, I],
                separator: "width" in v ? void 0 : v,
                rect: p
              }), s = !1;
            }
          }
          c = !1, f = I, m = [];
        }
      } else if (h.hasAttribute("data-separator")) {
        h.ariaDisabled !== null && (s = !0);
        const I = a.find(
          (y) => y.element === h
        );
        I ? m.push(I) : (f = void 0, m = []);
      } else
        c = !0;
  }
  return i;
}
var Se;
class xr {
  constructor() {
    pn(this, Se, {});
  }
  addListener(t, n) {
    const r = Je(this, Se)[t];
    return r === void 0 ? Je(this, Se)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = Je(this, Se)[t];
    if (r !== void 0)
      if (r.length === 1)
        r[0].call(null, n);
      else {
        let a = !1, o = null;
        const i = Array.from(r);
        for (let s = 0; s < i.length; s++) {
          const c = i[s];
          try {
            c.call(null, n);
          } catch (l) {
            o === null && (a = !0, o = l);
          }
        }
        if (a)
          throw o;
      }
  }
  removeAllListeners() {
    hn(this, Se, {});
  }
  removeListener(t, n) {
    const r = Je(this, Se)[t];
    if (r !== void 0) {
      const a = r.indexOf(n);
      a >= 0 && r.splice(a, 1);
    }
  }
}
Se = new WeakMap();
let Fe = {
  cursorFlags: 0,
  state: "inactive"
};
const tn = new xr();
function Me() {
  return Fe;
}
function os(e) {
  return tn.addListener("change", e);
}
function as(e) {
  const t = Fe, n = { ...Fe };
  n.cursorFlags = e, Fe = n, tn.emit("change", {
    prev: t,
    next: n
  });
}
function Oe(e) {
  const t = Fe;
  Fe = e, tn.emit("change", {
    prev: t,
    next: e
  });
}
const is = (e) => e, Mt = () => {
}, Pr = 1, Mr = 2, Er = 4, Lr = 8, Dn = 3, Fn = 12;
let it;
function On() {
  return it === void 0 && (it = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (it = !0)), it;
}
function ss({
  cursorFlags: e,
  groups: t,
  state: n
}) {
  let r = 0, a = 0;
  switch (n) {
    case "active":
    case "hover":
      t.forEach((o) => {
        if (!o.mutableState.disableCursor)
          switch (o.orientation) {
            case "horizontal": {
              r++;
              break;
            }
            case "vertical": {
              a++;
              break;
            }
          }
      });
  }
  if (!(r === 0 && a === 0)) {
    switch (n) {
      case "active": {
        if (e && On()) {
          const o = (e & Pr) !== 0, i = (e & Mr) !== 0, s = (e & Er) !== 0, c = (e & Lr) !== 0;
          if (o)
            return s ? "se-resize" : c ? "ne-resize" : "e-resize";
          if (i)
            return s ? "sw-resize" : c ? "nw-resize" : "w-resize";
          if (s)
            return "s-resize";
          if (c)
            return "n-resize";
        }
        break;
      }
    }
    return On() ? r > 0 && a > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && a > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const $n = /* @__PURE__ */ new WeakMap();
function nn(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = $n.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = Me();
  switch (r.state) {
    case "active":
    case "hover": {
      const a = ss({
        cursorFlags: r.cursorFlags,
        groups: r.hitRegions.map((i) => i.group),
        state: r.state
      }), o = `*, *:hover {cursor: ${a} !important; }`;
      if (t === o)
        return;
      t = o, a ? n.cssRules.length === 0 ? n.insertRule(o) : n.replaceSync(o) : n.cssRules.length === 1 && n.deleteRule(0);
      break;
    }
    case "inactive": {
      t = void 0, n.cssRules.length === 1 && n.deleteRule(0);
      break;
    }
  }
  $n.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let he = /* @__PURE__ */ new Map();
const Ar = new xr();
function cs(e) {
  he = new Map(he), he.delete(e);
}
function jn(e, t) {
  for (const [n] of he)
    if (n.id === e)
      return n;
}
function Re(e, t) {
  for (const [n, r] of he)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function ke() {
  return he;
}
function rn(e, t) {
  return Ar.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function we(e, t, n) {
  const r = he.get(e);
  he = new Map(he), he.set(e, t), Ar.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function kr(e) {
  const t = Me();
  let n = !1;
  switch (t.state) {
    case "active":
      Oe({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (nn(e), n = !0, t.hitRegions.forEach((r) => {
        const a = Re(r.group.id, !0);
        we(r.group, a, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function Bn(e) {
  e.defaultPrevented || kr(e.currentTarget);
}
function ls(e, t, n) {
  let r, a = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const o of t) {
    const i = Rr(n, o.rect);
    switch (e) {
      case "horizontal": {
        i.x <= a.x && (r = o, a = i);
        break;
      }
      case "vertical": {
        i.y <= a.y && (r = o, a = i);
        break;
      }
    }
  }
  return r ? {
    distance: a,
    hitRegion: r
  } : void 0;
}
function us(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function ds(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: Hn(e),
    b: Hn(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  V(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const a = {
    a: Wn(Un(n.a)),
    b: Wn(Un(n.b))
  };
  if (a.a === a.b) {
    const o = r.childNodes, i = {
      a: n.a.at(-1),
      b: n.b.at(-1)
    };
    let s = o.length;
    for (; s--; ) {
      const c = o[s];
      if (c === i.a) return 1;
      if (c === i.b) return -1;
    }
  }
  return Math.sign(a.a - a.b);
}
const fs = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function ms(e) {
  const t = getComputedStyle(Nr(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function ps(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || ms(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || fs.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function Un(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (V(n, "Missing node"), ps(n)) return n;
  }
  return null;
}
function Wn(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Hn(e) {
  const t = [];
  for (; e; )
    t.push(e), e = Nr(e);
  return t;
}
function Nr(e) {
  const { parentNode: t } = e;
  return us(t) ? t.host : t;
}
function hs(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function gs({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!Ir(n) || n.contains(e) || e.contains(n))
    return !0;
  if (ds(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (hs(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function on(e, t) {
  const n = [];
  return t.forEach((r, a) => {
    if (a.disabled)
      return;
    const o = Tr(a), i = ls(a.orientation, o, {
      x: e.clientX,
      y: e.clientY
    });
    i && i.distance.x <= 0 && i.distance.y <= 0 && gs({
      groupElement: a.element,
      hitRegion: i.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(i.hitRegion);
  }), n;
}
function bs(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function ae(e, t, n = 0) {
  return Math.abs(se(e) - se(t)) <= n;
}
function pe(e, t) {
  return ae(e, t) ? 0 : e > t ? 1 : -1;
}
function De({
  overrideDisabledPanels: e,
  panelConstraints: t,
  prevSize: n,
  size: r
}) {
  const {
    collapsedSize: a = 0,
    collapsible: o,
    disabled: i,
    maxSize: s = 100,
    minSize: c = 0
  } = t;
  if (i && !e)
    return n;
  if (pe(r, c) < 0)
    if (o) {
      const l = (a + c) / 2;
      pe(r, l) < 0 ? r = a : r = c;
    } else
      r = c;
  return r = Math.min(s, r), r = se(r), r;
}
function tt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: a,
  trigger: o
}) {
  if (ae(e, 0))
    return t;
  const i = o === "imperative-api", s = Object.values(t), c = Object.values(a), l = [...s], [d, u] = r;
  V(d != null, "Invalid first pivot index"), V(u != null, "Invalid second pivot index");
  let f = 0;
  switch (o) {
    case "keyboard": {
      {
        const h = e < 0 ? u : d, I = n[h];
        V(
          I,
          `Panel constraints not found for index ${h}`
        );
        const {
          collapsedSize: y = 0,
          collapsible: b,
          minSize: R = 0
        } = I;
        if (b) {
          const v = s[h];
          if (V(
            v != null,
            `Previous layout not found for panel index ${h}`
          ), ae(v, y)) {
            const p = R - v;
            pe(p, Math.abs(e)) > 0 && (e = e < 0 ? 0 - p : p);
          }
        }
      }
      {
        const h = e < 0 ? d : u, I = n[h];
        V(
          I,
          `No panel constraints found for index ${h}`
        );
        const {
          collapsedSize: y = 0,
          collapsible: b,
          minSize: R = 0
        } = I;
        if (b) {
          const v = s[h];
          if (V(
            v != null,
            `Previous layout not found for panel index ${h}`
          ), ae(v, R)) {
            const p = v - y;
            pe(p, Math.abs(e)) > 0 && (e = e < 0 ? 0 - p : p);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? u : d, I = n[h];
      V(
        I,
        `Panel constraints not found for index ${h}`
      );
      const y = s[h], { collapsible: b, collapsedSize: R, minSize: v } = I;
      if (b && pe(y, v) < 0)
        if (e > 0) {
          const p = v - R, x = p / 2, T = y + e;
          pe(T, v) < 0 && (e = pe(e, x) <= 0 ? 0 : p);
        } else {
          const p = v - R, x = 100 - p / 2, T = y - e;
          pe(T, v) < 0 && (e = pe(100 + e, x) > 0 ? 0 : -p);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let I = e < 0 ? u : d, y = 0;
    for (; ; ) {
      const R = s[I];
      V(
        R != null,
        `Previous layout not found for panel index ${I}`
      );
      const v = De({
        overrideDisabledPanels: i,
        panelConstraints: n[I],
        prevSize: R,
        size: 100
      }) - R;
      if (y += v, I += h, I < 0 || I >= n.length)
        break;
    }
    const b = Math.min(Math.abs(e), Math.abs(y));
    e = e < 0 ? 0 - b : b;
  }
  {
    let h = e < 0 ? d : u;
    for (; h >= 0 && h < n.length; ) {
      const I = Math.abs(e) - Math.abs(f), y = s[h];
      V(
        y != null,
        `Previous layout not found for panel index ${h}`
      );
      const b = y - I, R = De({
        overrideDisabledPanels: i,
        panelConstraints: n[h],
        prevSize: y,
        size: b
      });
      if (!ae(y, R) && (f += y - R, l[h] = R, f.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (bs(c, l))
    return a;
  {
    const h = e < 0 ? u : d, I = s[h];
    V(
      I != null,
      `Previous layout not found for panel index ${h}`
    );
    const y = I + f, b = De({
      overrideDisabledPanels: i,
      panelConstraints: n[h],
      prevSize: I,
      size: y
    });
    if (l[h] = b, !ae(b, y)) {
      let R = y - b, v = e < 0 ? u : d;
      for (; v >= 0 && v < n.length; ) {
        const p = l[v];
        V(
          p != null,
          `Previous layout not found for panel index ${v}`
        );
        const x = p + R, T = De({
          overrideDisabledPanels: i,
          panelConstraints: n[v],
          prevSize: p,
          size: x
        });
        if (ae(p, T) || (R -= T - p, l[v] = T), ae(R, 0))
          break;
        e > 0 ? v-- : v++;
      }
    }
  }
  const m = Object.values(l).reduce(
    (h, I) => I + h,
    0
  );
  if (!ae(m, 100, 0.1))
    return a;
  const g = Object.keys(a);
  return l.reduce((h, I, y) => (h[g[y]] = I, h), {});
}
function Ee(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || pe(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function Le({
  layout: e,
  panelConstraints: t
}) {
  const n = Object.values(e), r = [...n], a = r.reduce(
    (s, c) => s + c,
    0
  );
  if (r.length !== t.length)
    throw Error(
      `Invalid ${t.length} panel layout: ${r.map((s) => `${s}%`).join(", ")}`
    );
  if (!ae(a, 100) && r.length > 0)
    for (let s = 0; s < t.length; s++) {
      const c = r[s];
      V(c != null, `No layout data found for index ${s}`);
      const l = 100 / a * c;
      r[s] = l;
    }
  let o = 0;
  for (let s = 0; s < t.length; s++) {
    const c = n[s];
    V(c != null, `No layout data found for index ${s}`);
    const l = r[s];
    V(l != null, `No layout data found for index ${s}`);
    const d = De({
      overrideDisabledPanels: !0,
      panelConstraints: t[s],
      prevSize: c,
      size: l
    });
    l != d && (o += l - d, r[s] = d);
  }
  if (!ae(o, 0))
    for (let s = 0; s < t.length; s++) {
      const c = r[s];
      V(c != null, `No layout data found for index ${s}`);
      const l = c + o, d = De({
        overrideDisabledPanels: !0,
        panelConstraints: t[s],
        prevSize: c,
        size: l
      });
      if (c !== d && (o -= d - c, r[s] = d, ae(o, 0)))
        break;
    }
  const i = Object.keys(e);
  return r.reduce((s, c, l) => (s[i[l]] = c, s), {});
}
function zr({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const c = ke();
    for (const [
      l,
      {
        defaultLayoutDeferred: d,
        derivedPanelConstraints: u,
        layout: f,
        groupSize: m,
        separatorToPanels: g
      }
    ] of c)
      if (l.id === e)
        return {
          defaultLayoutDeferred: d,
          derivedPanelConstraints: u,
          group: l,
          groupSize: m,
          layout: f,
          separatorToPanels: g
        };
    throw Error(`Group ${e} not found`);
  }, r = () => {
    const c = n().derivedPanelConstraints.find(
      (l) => l.panelId === t
    );
    if (c !== void 0)
      return c;
    throw Error(`Panel constraints not found for Panel ${t}`);
  }, a = () => {
    const c = n().group.panels.find((l) => l.id === t);
    if (c !== void 0)
      return c;
    throw Error(`Layout not found for Panel ${t}`);
  }, o = () => {
    const c = n().layout[t];
    if (c !== void 0)
      return c;
    throw Error(`Layout not found for Panel ${t}`);
  }, i = ({
    nextSize: c,
    panels: l,
    prevLayout: d,
    derivedPanelConstraints: u
  }) => {
    const f = o(), m = l.findIndex((I) => I.id === t), g = m === 0, h = m === l.length - 1;
    if (h && c < f && (g || l.slice(0, m).every((I, y) => {
      const b = u[y];
      return (b == null ? void 0 : b.collapsible) && ae(b.collapsedSize, d[b.panelId]);
    }))) {
      const I = l.slice(0, m).reduce((y, b) => y + d[b.id], 0);
      return {
        ...d,
        [t]: se(100 - I)
      };
    }
    return tt({
      delta: h ? f - c : c - f,
      initialLayout: d,
      panelConstraints: u,
      pivotIndices: h ? [m - 1, m] : [m, m + 1],
      prevLayout: d,
      trigger: "imperative-api"
    });
  }, s = (c) => {
    const l = o();
    if (c === l)
      return;
    const {
      defaultLayoutDeferred: d,
      derivedPanelConstraints: u,
      group: f,
      groupSize: m,
      layout: g,
      separatorToPanels: h
    } = n(), I = i({
      nextSize: c,
      panels: f.panels,
      prevLayout: g,
      derivedPanelConstraints: u
    }), y = Le({
      layout: I,
      panelConstraints: u
    });
    Ee(g, y) || we(f, {
      defaultLayoutDeferred: d,
      derivedPanelConstraints: u,
      groupSize: m,
      layout: y,
      separatorToPanels: h
    });
  };
  return {
    collapse: () => {
      const { collapsible: c, collapsedSize: l } = r(), { mutableValues: d } = a(), u = o();
      c && u !== l && (d.expandToSize = u, s(l));
    },
    expand: () => {
      const { collapsible: c, collapsedSize: l, minSize: d } = r(), { mutableValues: u } = a(), f = o();
      if (c && f === l) {
        let m = u.expandToSize ?? d;
        m === 0 && (m = 1), s(m);
      }
    },
    getSize: () => {
      const { group: c } = n(), l = o(), { element: d } = a(), u = c.orientation === "horizontal" ? d.offsetWidth : d.offsetHeight;
      return {
        asPercentage: l,
        inPixels: u
      };
    },
    isCollapsed: () => {
      const { collapsible: c, collapsedSize: l } = r(), d = o();
      return c && ae(l, d);
    },
    resize: (c) => {
      const { group: l } = n(), { element: d } = a(), u = $e({ group: l }), f = qe({
        groupSize: u,
        panelElement: d,
        styleProp: c
      }), m = se(f / u * 100);
      s(m);
    }
  };
}
function Jn(e) {
  if (e.defaultPrevented)
    return;
  const t = ke();
  on(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (a) => a.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const a = r.panelConstraints.defaultSize, o = zr({
          groupId: n.group.id,
          panelId: r.id
        });
        o && a !== void 0 && (o.resize(a), e.preventDefault());
      }
    }
  });
}
function ut(e) {
  const t = ke();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function Cr({
  groupId: e
}) {
  const t = () => {
    const n = ke();
    for (const [r, a] of n)
      if (r.id === e)
        return { group: r, ...a };
    throw Error(`Could not find Group with id "${e}"`);
  };
  return {
    getLayout() {
      const { defaultLayoutDeferred: n, layout: r } = t();
      return n ? {} : r;
    },
    setLayout(n) {
      const {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: a,
        group: o,
        groupSize: i,
        layout: s,
        separatorToPanels: c
      } = t(), l = Le({
        layout: n,
        panelConstraints: a
      });
      return r ? s : (Ee(s, l) || we(o, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: a,
        groupSize: i,
        layout: l,
        separatorToPanels: c
      }), l);
    }
  };
}
function xe(e, t) {
  const n = ut(e), r = Re(n.id, !0), a = n.separators.find(
    (d) => d.element === e
  );
  V(a, "Matching separator not found");
  const o = r.separatorToPanels.get(a);
  V(o, "Matching panels not found");
  const i = o.map((d) => n.panels.indexOf(d)), s = Cr({ groupId: n.id }).getLayout(), c = tt({
    delta: t,
    initialLayout: s,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: i,
    prevLayout: s,
    trigger: "keyboard"
  }), l = Le({
    layout: c,
    panelConstraints: r.derivedPanelConstraints
  });
  Ee(s, l) || we(
    n,
    {
      defaultLayoutDeferred: r.defaultLayoutDeferred,
      derivedPanelConstraints: r.derivedPanelConstraints,
      groupSize: r.groupSize,
      layout: l,
      separatorToPanels: r.separatorToPanels
    },
    // Keyboard resizes (arrow keys, Home/End, Enter collapse/expand) originate
    // from a real DOM event on the separator, so they are user interactions
    // just like pointer drags. This function is only reached from
    // onDocumentKeyDown. See #716.
    { isUserInteraction: !0 }
  );
}
function Kn(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = ut(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && xe(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && xe(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && xe(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && xe(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), xe(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = ut(t), a = Re(r.id, !0), { derivedPanelConstraints: o, layout: i, separatorToPanels: s } = a, c = r.separators.find(
          (f) => f.element === t
        );
        V(c, "Matching separator not found");
        const l = s.get(c);
        V(l, "Matching panels not found");
        const d = l[0], u = o.find(
          (f) => f.panelId === d.id
        );
        if (V(u, "Panel metadata not found"), u.collapsible) {
          const f = i[d.id], m = u.collapsedSize === f ? r.mutableState.expandedPanelSizes[d.id] ?? u.minSize : u.collapsedSize;
          xe(t, m - f);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = ut(t).separators.map(
          (i) => i.element
        ), a = Array.from(r).findIndex(
          (i) => i === e.currentTarget
        );
        V(a !== null, "Index not found");
        const o = e.shiftKey ? a > 0 ? a - 1 : r.length - 1 : a + 1 < r.length ? a + 1 : 0;
        r[o].focus({
          preventScroll: !0
        });
        break;
      }
      case "Home": {
        e.preventDefault(), xe(t, -100);
        break;
      }
    }
}
function qn(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = ke(), n = on(e, t), r = /* @__PURE__ */ new Map();
  let a = !1;
  n.forEach((o) => {
    o.separator && (a || (a = !0, o.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const i = t.get(o.group);
    i && r.set(o.group, i.layout);
  }), Oe({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function _r({
  document: e,
  event: t,
  hitRegions: n,
  initialLayoutMap: r,
  mountedGroups: a,
  pointerDownAtPoint: o,
  prevCursorFlags: i
}) {
  let s = 0;
  n.forEach((l) => {
    const { group: d, groupSize: u } = l, { orientation: f, panels: m } = d, { disableCursor: g } = d.mutableState;
    let h = 0;
    o ? f === "horizontal" ? h = (t.clientX - o.x) / u * 100 : h = (t.clientY - o.y) / u * 100 : f === "horizontal" ? h = t.clientX < 0 ? -100 : 100 : h = t.clientY < 0 ? -100 : 100;
    const I = r.get(d), y = a.get(d);
    if (!I || !y)
      return;
    const {
      defaultLayoutDeferred: b,
      derivedPanelConstraints: R,
      groupSize: v,
      layout: p,
      separatorToPanels: x
    } = y;
    if (R && p && x) {
      const T = tt({
        delta: h,
        initialLayout: I,
        panelConstraints: R,
        pivotIndices: l.panels.map((M) => m.indexOf(M)),
        prevLayout: p,
        trigger: "mouse-or-touch"
      });
      if (Ee(T, p)) {
        if (h !== 0 && !g)
          switch (f) {
            case "horizontal": {
              s |= h < 0 ? Pr : Mr;
              break;
            }
            case "vertical": {
              s |= h < 0 ? Er : Lr;
              break;
            }
          }
      } else
        we(l.group, {
          defaultLayoutDeferred: b,
          derivedPanelConstraints: R,
          groupSize: v,
          layout: T,
          separatorToPanels: x
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= i & Dn : c |= s & Dn, t.movementY === 0 ? c |= i & Fn : c |= s & Fn, as(c), nn(e);
}
function Vn(e) {
  const t = ke(), n = Me();
  switch (n.state) {
    case "active":
      _r({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function Gn(e) {
  var r, a;
  if (e.defaultPrevented)
    return;
  const t = Me(), n = ke();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        Oe({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((o) => {
          const i = Re(o.group.id, !0);
          we(o.group, i, {
            isUserInteraction: !0
          });
        });
        return;
      }
      for (const o of t.hitRegions)
        if (o.separator) {
          const { element: i } = o.separator;
          (r = i.hasPointerCapture) != null && r.call(i, e.pointerId) || ((a = i.setPointerCapture) == null || a.call(i, e.pointerId));
        }
      _r({
        document: e.currentTarget,
        event: e,
        hitRegions: t.hitRegions,
        initialLayoutMap: t.initialLayoutMap,
        mountedGroups: n,
        pointerDownAtPoint: t.pointerDownAtPoint,
        prevCursorFlags: t.cursorFlags
      });
      break;
    }
    default: {
      const o = on(e, n);
      o.length === 0 ? t.state !== "inactive" && Oe({
        cursorFlags: 0,
        state: "inactive"
      }) : Oe({
        cursorFlags: 0,
        hitRegions: o,
        state: "hover"
      }), nn(e.currentTarget);
      break;
    }
  }
}
function Yn(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (Me().state) {
      case "hover":
        Oe({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function Xn(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || kr(e.currentTarget) && e.preventDefault();
}
function Zn(e) {
  let t = 0, n = 0;
  const r = {};
  for (const o of e)
    if (o.defaultSize !== void 0) {
      t++;
      const i = se(o.defaultSize);
      n += i, r[o.panelId] = i;
    } else
      r[o.panelId] = void 0;
  const a = e.length - t;
  if (a !== 0) {
    const o = se((100 - n) / a);
    for (const i of e)
      i.defaultSize === void 0 && (r[i.panelId] = o);
  }
  return r;
}
function ys(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((c) => c.element === t);
  if (!r || !r.onResize)
    return;
  const a = $e({ group: e }), o = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, i = r.mutableValues.prevSize, s = {
    asPercentage: se(o / a * 100),
    inPixels: o
  };
  r.mutableValues.prevSize = s, r.onResize(s, r.id, i);
}
function vs(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function ws({
  group: e,
  nextGroupSize: t,
  prevGroupSize: n,
  prevLayout: r
}) {
  if (n <= 0 || t <= 0 || n === t)
    return r;
  let a = 0, o = 0, i = !1;
  const s = /* @__PURE__ */ new Map(), c = [];
  for (const u of e.panels) {
    const f = r[u.id] ?? 0;
    switch (u.panelConstraints.groupResizeBehavior) {
      case "preserve-pixel-size": {
        i = !0;
        const m = f / 100 * n, g = se(
          m / t * 100
        );
        s.set(u.id, g), a += g;
        break;
      }
      case "preserve-relative-size":
      default: {
        c.push(u.id), o += f;
        break;
      }
    }
  }
  if (!i || c.length === 0)
    return r;
  const l = 100 - a, d = { ...r };
  if (s.forEach((u, f) => {
    d[f] = u;
  }), o > 0)
    for (const u of c) {
      const f = r[u] ?? 0;
      d[u] = se(
        f / o * l
      );
    }
  else {
    const u = se(
      l / c.length
    );
    for (const f of c)
      d[f] = u;
  }
  return d;
}
function Ss(e, t) {
  const n = e.map((a) => a.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const a of n)
    if (!r.includes(a))
      return !1;
  return !0;
}
const Ce = /* @__PURE__ */ new Map();
function Is(e) {
  let t = !0;
  V(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), a = /* @__PURE__ */ new Set(), o = new n((g) => {
    for (const h of g) {
      const { borderBoxSize: I, target: y } = h;
      if (y === e.element) {
        if (t) {
          const b = $e({ group: e });
          if (b === 0)
            return;
          const R = Re(e.id);
          if (!R)
            return;
          const v = $t(e), p = R.defaultLayoutDeferred ? Zn(v) : R.layout, x = ws({
            group: e,
            nextGroupSize: b,
            prevGroupSize: R.groupSize,
            prevLayout: p
          }), T = Le({
            layout: x,
            panelConstraints: v
          });
          if (!R.defaultLayoutDeferred && Ee(R.layout, T) && vs(
            R.derivedPanelConstraints,
            v
          ) && R.groupSize === b)
            return;
          we(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: v,
            groupSize: b,
            layout: T,
            separatorToPanels: R.separatorToPanels
          });
        }
      } else
        ys(e, y, I);
    }
  });
  o.observe(e.element), e.panels.forEach((g) => {
    V(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && o.observe(g.element);
  });
  const i = $e({ group: e }), s = $t(e), c = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (Ss(e.panels, l) || (l = void 0));
  const d = e.mutableState.layouts[c] ?? l ?? Zn(s), u = Le({
    layout: d,
    panelConstraints: s
  }), f = e.element.ownerDocument;
  Ce.set(
    f,
    (Ce.get(f) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return Tr(e).forEach((g) => {
    g.separator && m.set(g.separator, g.panels);
  }), we(e, {
    defaultLayoutDeferred: i === 0,
    derivedPanelConstraints: s,
    groupSize: i,
    layout: u,
    separatorToPanels: m
  }), e.separators.forEach((g) => {
    V(
      !a.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), a.add(g.id), g.element.addEventListener("keydown", Kn);
  }), Ce.get(f) === 1 && (f.addEventListener("contextmenu", Bn, !0), f.addEventListener("dblclick", Jn, !0), f.addEventListener("pointerdown", qn, !0), f.addEventListener("pointerleave", Vn), f.addEventListener("pointermove", Gn), f.addEventListener("pointerout", Yn), f.addEventListener("pointerup", Xn, !0)), function() {
    t = !1, Ce.set(
      f,
      Math.max(0, (Ce.get(f) ?? 0) - 1)
    ), cs(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", Kn);
    }), Ce.get(f) || (f.removeEventListener(
      "contextmenu",
      Bn,
      !0
    ), f.removeEventListener(
      "dblclick",
      Jn,
      !0
    ), f.removeEventListener(
      "pointerdown",
      qn,
      !0
    ), f.removeEventListener("pointerleave", Vn), f.removeEventListener("pointermove", Gn), f.removeEventListener("pointerout", Yn), f.removeEventListener("pointerup", Xn, !0)), o.disconnect();
  };
}
function Rs() {
  const [e, t] = z({}), n = _(() => t({}), []);
  return [e, n];
}
function an(e) {
  const t = Jt();
  return `${e ?? t}`;
}
const Ne = typeof window < "u" ? Ae : B;
function Ye(e) {
  const t = N(e);
  return Ne(() => {
    t.current = e;
  }, [e]), _(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function sn(...e) {
  return Ye((t) => {
    e.forEach((n) => {
      if (n)
        switch (typeof n) {
          case "function": {
            n(t);
            break;
          }
          case "object": {
            n.current = t;
            break;
          }
        }
    });
  });
}
function cn(e) {
  const t = N({ ...e });
  return Ne(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const Dr = Hr(null);
function Ts(e, t) {
  const n = N({
    getLayout: () => ({}),
    setLayout: is
  });
  Ht(t, () => n.current, []), Ne(() => {
    Object.assign(
      n.current,
      Cr({ groupId: e })
    );
  });
}
function Fr({
  children: e,
  className: t,
  defaultLayout: n,
  disableCursor: r,
  disabled: a,
  elementRef: o,
  groupRef: i,
  id: s,
  onLayoutChange: c,
  onLayoutChanged: l,
  orientation: d = "horizontal",
  resizeTargetMinimumSize: u = {
    coarse: 20,
    fine: 10
  },
  style: f,
  ...m
}) {
  const g = N({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), h = Ye((P) => {
    Ee(g.current.onLayoutChange, P) || (g.current.onLayoutChange = P, c == null || c(P));
  }), I = Ye(
    (P, S) => {
      Ee(g.current.onLayoutChanged, P) || (g.current.onLayoutChanged = P, l == null || l(P, { isUserInteraction: S }));
    }
  ), y = an(s), b = N(null), [R, v] = Rs(), p = N({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: u,
    separators: []
  }), x = sn(b, o);
  Ts(y, i);
  const T = Ye(
    (P, S) => {
      const A = Me(), C = jn(P), F = Re(P);
      if (F) {
        let U = !1;
        switch (A.state) {
          case "active": {
            U = A.hitRegions.some(
              (k) => k.group === C
            );
            break;
          }
        }
        return {
          flexGrow: F.layout[S] ?? 1,
          pointerEvents: U ? "none" : void 0
        };
      }
      if (n != null && n[S])
        return {
          flexGrow: n == null ? void 0 : n[S]
        };
    }
  ), M = cn({
    defaultLayout: n,
    disableCursor: r
  }), E = Y(
    () => ({
      get disableCursor() {
        return !!M.disableCursor;
      },
      getPanelStyles: T,
      id: y,
      orientation: d,
      registerPanel: (P) => {
        const S = p.current;
        return S.panels = jt(d, [
          ...S.panels,
          P
        ]), v(), () => {
          S.panels = S.panels.filter(
            (A) => A !== P
          ), v();
        };
      },
      registerSeparator: (P) => {
        const S = p.current;
        return S.separators = jt(d, [
          ...S.separators,
          P
        ]), v(), () => {
          S.separators = S.separators.filter(
            (A) => A !== P
          ), v();
        };
      },
      updatePanelProps: (P, { disabled: S }) => {
        const A = p.current.panels.find(
          (U) => U.id === P
        );
        A && (A.panelConstraints.disabled = S);
        const C = jn(y), F = Re(y);
        C && F && we(C, {
          ...F,
          derivedPanelConstraints: $t(C)
        });
      },
      updateSeparatorProps: (P, {
        disabled: S,
        disableDoubleClick: A
      }) => {
        const C = p.current.separators.find(
          (F) => F.id === P
        );
        C && (C.disabled = S, C.disableDoubleClick = A);
      }
    }),
    [T, y, v, d, M]
  ), L = N(null);
  return Ne(() => {
    const P = b.current;
    if (P === null)
      return;
    const S = p.current;
    let A;
    if (M.defaultLayout !== void 0 && Object.keys(M.defaultLayout).length === S.panels.length) {
      A = {};
      for (const H of S.panels) {
        const Q = M.defaultLayout[H.id];
        Q !== void 0 && (A[H.id] = Q);
      }
    }
    const C = {
      disabled: !!a,
      element: P,
      id: y,
      mutableState: {
        defaultLayout: A,
        disableCursor: !!M.disableCursor,
        expandedPanelSizes: p.current.lastExpandedPanelSizes,
        layouts: p.current.layouts
      },
      orientation: d,
      panels: S.panels,
      resizeTargetMinimumSize: S.resizeTargetMinimumSize,
      separators: S.separators
    };
    L.current = C;
    const F = Is(C), { defaultLayoutDeferred: U, derivedPanelConstraints: k, layout: $ } = Re(C.id, !0);
    !U && k.length > 0 && (h($), I($, !1));
    const W = rn(y, (H) => {
      const { defaultLayoutDeferred: Q, derivedPanelConstraints: X, layout: ie } = H.next;
      if (Q || X.length === 0)
        return;
      const D = C.panels.map(({ id: ee }) => ee).join(",");
      C.mutableState.layouts[D] = ie, X.forEach((ee) => {
        if (ee.collapsible) {
          const { layout: ce } = H.prev ?? {};
          if (ce) {
            const de = ae(
              ee.collapsedSize,
              ie[ee.panelId]
            ), K = ae(
              ee.collapsedSize,
              ce[ee.panelId]
            );
            de && !K && (C.mutableState.expandedPanelSizes[ee.panelId] = ce[ee.panelId]);
          }
        }
      });
      const re = Me().state !== "active";
      h(ie), re && I(ie, H.isUserInteraction);
    });
    return () => {
      L.current = null, F(), W();
    };
  }, [
    a,
    y,
    I,
    h,
    d,
    R,
    M
  ]), B(() => {
    const P = L.current;
    P && (P.mutableState.defaultLayout = n, P.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ w(Dr.Provider, { value: E, children: /* @__PURE__ */ w(
    "div",
    {
      ...m,
      className: t,
      "data-group": !0,
      "data-testid": y,
      id: y,
      ref: x,
      style: {
        height: "100%",
        width: "100%",
        overflow: "hidden",
        ...f,
        display: "flex",
        flexDirection: d === "horizontal" ? "row" : "column",
        flexWrap: "nowrap",
        // Inform the browser that the library is handling touch events for this element
        // but still allow users to scroll content within panels in the non-resizing direction
        // NOTE This is not an inherited style
        // See github.com/bvaughn/react-resizable-panels/issues/662
        touchAction: d === "horizontal" ? "pan-y" : "pan-x"
      },
      children: e
    }
  ) });
}
Fr.displayName = "Group";
function ln() {
  const e = Jr(Dr);
  return V(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function xs(e, t) {
  const { id: n } = ln(), r = N({
    collapse: Mt,
    expand: Mt,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Mt
  });
  Ht(t, () => r.current, []), Ne(() => {
    Object.assign(
      r.current,
      zr({ groupId: n, panelId: e })
    );
  });
}
function Bt({
  children: e,
  className: t,
  collapsedSize: n = "0%",
  collapsible: r = !1,
  defaultSize: a,
  disabled: o,
  elementRef: i,
  groupResizeBehavior: s = "preserve-relative-size",
  id: c,
  maxSize: l = "100%",
  minSize: d = "0%",
  onResize: u,
  panelRef: f,
  style: m,
  ...g
}) {
  const h = !!c, I = an(c), y = cn({
    disabled: o
  }), b = N(null), R = sn(b, i), {
    getPanelStyles: v,
    id: p,
    orientation: x,
    registerPanel: T,
    updatePanelProps: M
  } = ln(), E = u !== null, L = Ye(
    (C, F, U) => {
      u == null || u(C, c, U);
    }
  );
  Ne(() => {
    const C = b.current;
    if (C !== null) {
      const F = {
        element: C,
        id: I,
        idIsStable: h,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: E ? L : void 0,
        panelConstraints: {
          groupResizeBehavior: s,
          collapsedSize: n,
          collapsible: r,
          defaultSize: a,
          disabled: y.disabled,
          maxSize: l,
          minSize: d
        }
      };
      return T(F);
    }
  }, [
    s,
    n,
    r,
    a,
    E,
    I,
    h,
    l,
    d,
    L,
    T,
    y
  ]), B(() => {
    M(I, { disabled: o });
  }, [o, I, M]), xs(I, f);
  const P = () => {
    const C = v(p, I);
    if (C)
      return JSON.stringify(C);
  }, S = Wr(
    (C) => rn(p, C),
    P,
    P
  );
  let A;
  return S ? A = JSON.parse(S) : a !== void 0 ? A = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: a
  } : A = { flexGrow: 1 }, /* @__PURE__ */ w(
    "div",
    {
      ...g,
      "data-disabled": o || void 0,
      "data-panel": !0,
      "data-testid": I,
      id: I,
      ref: R,
      style: {
        ...Ps,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...A
      },
      children: /* @__PURE__ */ w(
        "div",
        {
          className: t,
          style: {
            maxHeight: "100%",
            maxWidth: "100%",
            flexGrow: 1,
            overflow: "auto",
            ...m,
            // Inform the browser that the library is handling touch events for this element
            // but still allow users to scroll content within panels in the non-resizing direction
            // NOTE This is not an inherited style
            // See github.com/bvaughn/react-resizable-panels/issues/662
            touchAction: x === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
Bt.displayName = "Panel";
const Ps = {
  minHeight: 0,
  maxHeight: "100%",
  height: "auto",
  minWidth: 0,
  maxWidth: "100%",
  width: "auto",
  border: "none",
  borderWidth: 0,
  padding: 0,
  margin: 0
};
function Ms({
  layout: e,
  panelConstraints: t,
  panelId: n,
  panelIndex: r
}) {
  let a, o;
  const i = e[n], s = t.find(
    (c) => c.panelId === n
  );
  if (s) {
    const c = s.maxSize, l = s.collapsible ? s.collapsedSize : s.minSize, d = [r, r + 1];
    o = Le({
      layout: tt({
        delta: l - i,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: d,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], a = Le({
      layout: tt({
        delta: c - i,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: d,
        prevLayout: e
      }),
      panelConstraints: t
    })[n];
  }
  return {
    valueControls: n,
    valueMax: a,
    valueMin: o,
    valueNow: i
  };
}
function Or({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: a,
  id: o,
  style: i,
  ...s
}) {
  const c = an(o), l = cn({
    disabled: n,
    disableDoubleClick: r
  }), [d, u] = z({}), [f, m] = z("inactive"), [g, h] = z(!1), I = N(null), y = sn(I, a), {
    disableCursor: b,
    id: R,
    orientation: v,
    registerSeparator: p,
    updateSeparatorProps: x
  } = ln(), T = v === "horizontal" ? "vertical" : "horizontal";
  Ne(() => {
    const L = I.current;
    if (L !== null) {
      const P = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: L,
        id: c
      }, S = p(P), A = os(
        (F) => {
          m(
            F.next.state !== "inactive" && F.next.hitRegions.some(
              (U) => U.separator === P
            ) ? F.next.state : "inactive"
          );
        }
      ), C = rn(
        R,
        (F) => {
          const { derivedPanelConstraints: U, layout: k, separatorToPanels: $ } = F.next, W = $.get(P);
          if (W) {
            const H = W[0], Q = W.indexOf(H);
            u(
              Ms({
                layout: k,
                panelConstraints: U,
                panelId: H.id,
                panelIndex: Q
              })
            );
          }
        }
      );
      return () => {
        A(), C(), S();
      };
    }
  }, [R, c, p, l]), B(() => {
    x(c, { disabled: n, disableDoubleClick: r });
  }, [n, r, c, x]);
  let M;
  n && !b && (M = "not-allowed");
  let E;
  if (n)
    E = "disabled";
  else
    switch (f) {
      case "active": {
        E = "active";
        break;
      }
      default:
        g ? E = "focus" : E = f;
    }
  return /* @__PURE__ */ w(
    "div",
    {
      ...s,
      "aria-controls": d.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": T,
      "aria-valuemax": d.valueMax,
      "aria-valuemin": d.valueMin,
      "aria-valuenow": d.valueNow,
      children: e,
      className: t,
      "data-separator": E,
      "data-testid": c,
      id: c,
      onBlur: () => h(!1),
      onFocus: () => h(!0),
      ref: y,
      role: "separator",
      style: {
        flexBasis: "auto",
        cursor: M,
        ...i,
        flexGrow: 0,
        flexShrink: 0,
        // Inform the browser that the library is handling touch events for this element
        // See github.com/bvaughn/react-resizable-panels/issues/662
        touchAction: "none"
      },
      tabIndex: n ? void 0 : 0
    }
  );
}
Or.displayName = "Separator";
const un = "reader-document", nt = "reader-assistant", $r = "retainpdf.reader.ai-split-layout.v1", Es = 30, Ls = 65, As = {
  [un]: 50,
  [nt]: 50
};
function dn(e) {
  const t = Number(e == null ? void 0 : e[nt]), n = Number.isFinite(t) ? Math.min(Ls, Math.max(Es, t)) : 50;
  return {
    [un]: 100 - n,
    [nt]: n
  };
}
function ks() {
  try {
    const e = JSON.parse(localStorage.getItem($r) || "null");
    return dn(e);
  } catch {
    return As;
  }
}
function Ns(e) {
  try {
    localStorage.setItem($r, JSON.stringify(dn(e)));
  } catch {
  }
}
function Et(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = dn(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[nt]}vw`
  );
}
function zs() {
  const e = N(null), [t] = z(ks);
  Ae(() => {
    const a = e.current;
    return Et(a, t), () => {
      var o;
      (o = a == null ? void 0 : a.closest(".reader-react-root")) == null || o.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = _((a) => {
    Et(e.current, a);
  }, []), r = _((a, o) => {
    Et(e.current, a), o.isUserInteraction && Ns(a);
  }, []);
  return /* @__PURE__ */ O(
    Fr,
    {
      id: "reader-ai-split",
      className: "reader-ai-split-resizer",
      elementRef: e,
      orientation: "horizontal",
      defaultLayout: t,
      onLayoutChange: n,
      onLayoutChanged: r,
      resizeTargetMinimumSize: { fine: 12, coarse: 28 },
      children: [
        /* @__PURE__ */ w(
          Bt,
          {
            id: un,
            defaultSize: "50%",
            minSize: "35%",
            maxSize: "70%"
          }
        ),
        /* @__PURE__ */ w(
          Or,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ w("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ w(
          Bt,
          {
            id: nt,
            defaultSize: "50%",
            minSize: "30%",
            maxSize: "65%"
          }
        )
      ]
    }
  );
}
function Cs({
  loading: e,
  failed: t,
  text: n,
  percent: r
}) {
  return !e && !t ? null : /* @__PURE__ */ O(tr, { children: [
    e ? /* @__PURE__ */ w("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ O("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ w("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ w("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ w(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ w("div", { className: "reader-react-error", role: "alert", children: n }) : null
  ] });
}
async function _s(e) {
  var a;
  const t = `${e || ""}`;
  if (!t) throw new Error("empty selection");
  try {
    if ((a = navigator.clipboard) != null && a.writeText) {
      await navigator.clipboard.writeText(t);
      return;
    }
  } catch {
  }
  const n = document.createElement("textarea");
  n.value = t, n.setAttribute("readonly", ""), n.style.position = "fixed", n.style.opacity = "0", document.body.appendChild(n), n.select();
  const r = document.execCommand("copy");
  if (n.remove(), !r) throw new Error("copy failed");
}
function Ds({
  selection: e,
  onDismiss: t,
  onAskAi: n
}) {
  const [r, a] = z(!1), o = e ? e.selectionType === "text" ? `${e.pane}:${e.page}:${e.quote}` : `${e.region.itemId}:${e.pane}` : "";
  if (B(() => a(!1), [o]), !e)
    return null;
  const i = typeof window < "u" ? window.innerWidth : 800, s = typeof window < "u" ? window.innerHeight : 600, c = e.rect.left + e.rect.width / 2, l = 120, d = Math.min(Math.max(16 + l, c), i - 16 - l), u = e.rect.top > 72, f = u ? Math.max(12, e.rect.top - 8) : Math.min(s - 12, e.rect.top + e.rect.height + 8), m = u ? "above" : "below", g = e.pane === "translated" ? "译文" : "原文", h = e.selectionType === "text" ? "text" : e.kind, I = e.selectionType === "text" ? e.quote : lr(e.region, e.pane), y = h === "formula" ? "公式" : h === "table" ? "表格" : h === "figure" ? "图片" : h === "text" ? "文字" : "区域", b = h === "formula" ? qo(I) : I, R = h === "formula" ? oo : h === "table" ? ao : h === "text" ? io : so;
  return /* @__PURE__ */ O(
    "div",
    {
      className: `reader-sel-pop reader-sel-pop--${m} reader-sel-pop--region`,
      style: { left: d, top: f },
      role: "toolbar",
      "aria-label": "选区操作",
      onPointerDown: (v) => {
        v.preventDefault();
      },
      children: [
        /* @__PURE__ */ O("div", { className: "reader-sel-pop-card reader-floating-surface", children: [
          /* @__PURE__ */ O("div", { className: "reader-sel-pop-context", children: [
            /* @__PURE__ */ w(R, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ w("span", { children: y }),
            /* @__PURE__ */ w("span", { className: "reader-sel-pop-context-divider", "aria-hidden": !0, children: "·" }),
            /* @__PURE__ */ w("span", { children: g }),
            /* @__PURE__ */ w("span", { className: "reader-sel-pop-context-divider", "aria-hidden": !0, children: "·" }),
            /* @__PURE__ */ O("span", { children: [
              e.page,
              " 页"
            ] })
          ] }),
          /* @__PURE__ */ O("div", { className: "reader-sel-pop-actions", children: [
            b ? /* @__PURE__ */ O(
              "button",
              {
                type: "button",
                className: "reader-sel-pop-btn reader-sel-pop-btn--primary",
                onClick: async () => {
                  try {
                    await _s(b), a(!0), window.setTimeout(() => a(!1), 1400);
                  } catch (v) {
                    console.warn("[reader-selection] copy failed", v);
                  }
                },
                children: [
                  r ? /* @__PURE__ */ w(co, { size: 15, strokeWidth: 2.4, "aria-hidden": !0 }) : /* @__PURE__ */ w(lo, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
                  /* @__PURE__ */ w("span", { children: r ? "已复制" : h === "formula" ? "复制 LaTeX" : "复制" })
                ]
              }
            ) : /* @__PURE__ */ w("span", { className: "reader-sel-pop-selection-hint", children: "已选择图片" }),
            n ? /* @__PURE__ */ O(
              "button",
              {
                type: "button",
                className: "reader-sel-pop-btn reader-sel-pop-btn--secondary",
                onClick: () => n(e),
                children: [
                  /* @__PURE__ */ w(qt, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
                  /* @__PURE__ */ w("span", { children: "问 AI" })
                ]
              }
            ) : null,
            /* @__PURE__ */ w(
              "button",
              {
                type: "button",
                className: "reader-sel-pop-btn reader-sel-pop-btn--ghost",
                onClick: t,
                "aria-label": "取消选区",
                title: "取消",
                children: /* @__PURE__ */ w(Ze, { size: 15, strokeWidth: 2.5, "aria-hidden": !0 })
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ w("span", { className: "reader-sel-pop-caret", "aria-hidden": "true" })
      ]
    }
  );
}
const Fs = [
  {
    title: "翻页",
    items: [
      { keys: "J · ↓ · PgDn", desc: "下一页" },
      { keys: "K · ↑ · PgUp", desc: "上一页" },
      { keys: "Home / End", desc: "首页 / 末页" },
      { keys: "点底栏页码", desc: "输入页码跳转" }
    ]
  },
  {
    title: "缩放",
    items: [
      { keys: "+ / −", desc: "放大 / 缩小" },
      { keys: "0", desc: "重置为模式默认" },
      { keys: "点百分比", desc: "重置为模式默认" }
    ]
  },
  {
    title: "模式",
    items: [
      { keys: "1", desc: "源文件" },
      { keys: "2", desc: "对照" },
      { keys: "3", desc: "翻译文件" }
    ]
  }
];
function Os(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function $s() {
  const [e, t] = z(!1), n = Jt(), r = N(null);
  return B(() => {
    if (!e) return;
    const a = (i) => {
      const s = r.current;
      s && i.target instanceof Node && !s.contains(i.target) && t(!1);
    }, o = (i) => {
      i.key === "Escape" && (i.preventDefault(), t(!1));
    };
    return document.addEventListener("mousedown", a), window.addEventListener("keydown", o), () => {
      document.removeEventListener("mousedown", a), window.removeEventListener("keydown", o);
    };
  }, [e]), B(() => {
    const a = (o) => {
      if (o.defaultPrevented || o.metaKey || o.ctrlKey || o.altKey || Os(o.target)) return;
      const i = o.key;
      if (i === "?" || i === "h" || i === "H" || i === "/") {
        if (i === "/" && !o.shiftKey)
          return;
        o.preventDefault(), t((s) => !s);
      }
    };
    return window.addEventListener("keydown", a), () => window.removeEventListener("keydown", a);
  }, []), /* @__PURE__ */ O("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
    /* @__PURE__ */ w(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-react-shortcuts-btn${e ? " is-active" : ""}`,
        "aria-label": "快捷键说明",
        "aria-expanded": e,
        "aria-controls": n,
        title: "快捷键（H 或 ?）",
        onClick: () => t((a) => !a),
        children: /* @__PURE__ */ w(uo, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ O(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ O("div", { className: "reader-react-shortcuts-head", children: [
            /* @__PURE__ */ w("strong", { children: "快捷键" }),
            /* @__PURE__ */ w(
              "button",
              {
                type: "button",
                className: "reader-react-shortcuts-close reader-floating-close",
                "aria-label": "关闭",
                onClick: () => t(!1),
                children: "×"
              }
            )
          ] }),
          /* @__PURE__ */ w("div", { className: "reader-react-shortcuts-body", children: Fs.map((a) => /* @__PURE__ */ O("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ w("h3", { children: a.title }),
            /* @__PURE__ */ w("ul", { children: a.items.map((o) => /* @__PURE__ */ O("li", { children: [
              /* @__PURE__ */ w("kbd", { children: o.keys }),
              /* @__PURE__ */ w("span", { children: o.desc })
            ] }, `${a.title}-${o.keys}`)) })
          ] }, a.title)) }),
          /* @__PURE__ */ w("p", { className: "reader-react-shortcuts-foot", children: "在输入框内不会触发快捷键" })
        ]
      }
    ) : null
  ] });
}
const js = Object.freeze([
  {
    id: "favorites",
    label: "摘录",
    subIdle: "本书云端收藏",
    subOpen: "关闭悬浮窗",
    needsJob: !1
  },
  {
    id: "markdown",
    label: "Markdown",
    subIdle: "识别 / 译文文本",
    subOpen: "关闭悬浮窗",
    needsJob: !0
  },
  {
    id: "ai",
    label: "AI 问答",
    subIdle: "基于文档提问",
    subOpen: "关闭悬浮窗",
    needsJob: !0
  }
]), Bs = {
  favorites: fo,
  markdown: ar,
  ai: qt
}, jr = "retainpdf.reader.fab.pos.v1", yt = 52, _e = 12, Us = 6, Ws = ["source", "sideBySide", "translated"], Hs = {
  source: nr,
  sideBySide: rr,
  translated: or
}, Js = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
}, Ks = js.filter((e) => e.id === "favorites");
function Xe(e, t) {
  const n = Math.max(_e, window.innerWidth - yt - _e), r = Math.max(_e, window.innerHeight - yt - _e);
  return {
    x: Math.min(n, Math.max(_e, e)),
    y: Math.min(r, Math.max(_e, t))
  };
}
function Qn() {
  return typeof window > "u" ? { x: 24, y: 120 } : Xe(
    window.innerWidth - yt - 20,
    window.innerHeight - yt - 88
  );
}
function qs() {
  try {
    const e = localStorage.getItem(jr);
    if (!e) return Qn();
    const t = JSON.parse(e);
    if (typeof t.x == "number" && typeof t.y == "number")
      return Xe(t.x, t.y);
  } catch {
  }
  return Qn();
}
function Vs(e) {
  try {
    localStorage.setItem(jr, JSON.stringify(e));
  } catch {
  }
}
function Gs(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = Ve(e.sourceUrl), n = Ve(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return ko({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function Ys({
  activeTool: e,
  sourceOnly: t,
  onToggleTool: n,
  download: r
}) {
  const [a, o] = z(() => qs()), [i, s] = z(!1), [c, l] = z(() => /* @__PURE__ */ new Set()), d = N(null), u = N(null), f = Jt(), m = Y(() => Gs(r), [r]);
  B(() => {
    const p = () => o((x) => Xe(x.x, x.y));
    return window.addEventListener("resize", p), () => window.removeEventListener("resize", p);
  }, []), B(() => {
    if (!i) return;
    const p = (T) => {
      const M = d.current;
      M && T.target instanceof Node && !M.contains(T.target) && s(!1);
    }, x = (T) => {
      T.key === "Escape" && (T.preventDefault(), s(!1));
    };
    return document.addEventListener("mousedown", p), window.addEventListener("keydown", x), () => {
      document.removeEventListener("mousedown", p), window.removeEventListener("keydown", x);
    };
  }, [i]);
  const g = _((p) => {
    n(p), s(!1);
  }, [n]), h = _(
    async (p) => {
      const x = Ve(m[p]);
      if (!(!x || c.has(p)))
        try {
          const T = r.jobId ? Ao(p, {
            jobId: r.jobId,
            jobPayload: r.jobPayload,
            manifestPayload: r.manifestPayload
          }) : `${r.sourceOnly ? "document" : "reader"}-${p}.pdf`;
          await No(
            r.fetchProtected,
            x,
            T,
            T,
            null,
            (M) => l((E) => {
              const L = new Set(E);
              return M ? L.add(p) : L.delete(p), L;
            })
          );
        } catch (T) {
          const M = T instanceof Error ? T.message : "下载失败";
          zo(M), l((E) => {
            const L = new Set(E);
            return L.delete(p), L;
          });
        }
    },
    [m, c, r]
  ), I = (p) => {
    p.button === 0 && (p.currentTarget.setPointerCapture(p.pointerId), u.current = {
      pointerId: p.pointerId,
      startX: p.clientX,
      startY: p.clientY,
      originX: a.x,
      originY: a.y,
      moved: !1
    });
  }, y = (p) => {
    const x = u.current;
    if (!x || x.pointerId !== p.pointerId) return;
    const T = p.clientX - x.startX, M = p.clientY - x.startY;
    !x.moved && Math.hypot(T, M) < Us || (x.moved = !0, i && s(!1), o(Xe(x.originX + T, x.originY + M)));
  }, b = (p) => {
    const x = u.current;
    if (!(!x || x.pointerId !== p.pointerId)) {
      u.current = null;
      try {
        p.currentTarget.releasePointerCapture(p.pointerId);
      } catch {
      }
      if (x.moved) {
        o((T) => {
          const M = Xe(T.x, T.y);
          return Vs(M), M;
        });
        return;
      }
      s((T) => !T);
    }
  }, R = typeof window < "u" && a.y > window.innerHeight * 0.55, v = Ws.filter((p) => !(r.sourceOnly && p !== "source"));
  return /* @__PURE__ */ O(
    "div",
    {
      ref: d,
      className: `reader-fab${i ? " is-open" : ""}${R ? " is-open-up" : ""}`,
      style: { left: a.x, top: a.y },
      "data-reader-fab": "",
      children: [
        i ? /* @__PURE__ */ O(
          "div",
          {
            id: f,
            className: "reader-fab-menu reader-floating-surface",
            role: "menu",
            "aria-label": "阅读工具",
            children: [
              /* @__PURE__ */ O("header", { className: "reader-fab-menu-head", children: [
                /* @__PURE__ */ O("div", { className: "reader-fab-menu-head-text", children: [
                  /* @__PURE__ */ w("strong", { children: "工具" }),
                  /* @__PURE__ */ w("span", { children: "拖动圆钮可移动" })
                ] }),
                /* @__PURE__ */ w(
                  "button",
                  {
                    type: "button",
                    className: "reader-fab-menu-close reader-floating-close",
                    "aria-label": "关闭菜单",
                    onClick: () => s(!1),
                    children: /* @__PURE__ */ w(Ze, { size: 14, strokeWidth: 2.5, "aria-hidden": !0 })
                  }
                )
              ] }),
              Ks.map((p, x) => {
                const T = Bs[p.id], M = e === p.id, E = p.needsJob && t;
                let L = M ? p.subOpen : p.subIdle;
                return E && (L = "需打开任务阅读"), /* @__PURE__ */ O(
                  "button",
                  {
                    type: "button",
                    role: "menuitem",
                    className: `reader-fab-row${M ? " is-active" : ""}${E ? " is-disabled" : ""}`,
                    "aria-pressed": M,
                    disabled: E,
                    onClick: () => g(p.id),
                    style: { "--fab-i": x },
                    children: [
                      /* @__PURE__ */ w("span", { className: "reader-fab-row-icon", "aria-hidden": "true", children: /* @__PURE__ */ w(T, { size: 18, strokeWidth: 2 }) }),
                      /* @__PURE__ */ O("span", { className: "reader-fab-row-copy", children: [
                        /* @__PURE__ */ w("span", { className: "reader-fab-row-title", children: p.label }),
                        /* @__PURE__ */ w("span", { className: "reader-fab-row-sub", children: L })
                      ] })
                    ]
                  },
                  p.id
                );
              }),
              /* @__PURE__ */ O("div", { className: "reader-fab-section", role: "group", "aria-label": "下载", children: [
                /* @__PURE__ */ O("div", { className: "reader-fab-section-head", children: [
                  /* @__PURE__ */ w(mo, { size: 12, strokeWidth: 2.5, "aria-hidden": !0 }),
                  /* @__PURE__ */ w("span", { children: "下载 PDF" })
                ] }),
                /* @__PURE__ */ w("div", { className: "reader-fab-download-grid", children: v.map((p, x) => {
                  const T = Yr[p], M = Ve(m[p]), E = c.has(p), L = !!M && !E, P = L ? "" : Xr(p, m), S = Hs[p];
                  return /* @__PURE__ */ O(
                    "button",
                    {
                      type: "button",
                      role: "menuitem",
                      id: `reader-fab-download-${p}`,
                      className: `reader-fab-chip${E ? " is-busy" : ""}${L ? "" : " is-disabled"}`,
                      disabled: !L,
                      title: L ? `下载${T.label}` : P,
                      onClick: () => void h(p),
                      style: { "--fab-i": x },
                      children: [
                        /* @__PURE__ */ w("span", { className: "reader-fab-chip-icon", "aria-hidden": "true", children: /* @__PURE__ */ w(S, { size: 16, strokeWidth: 2 }) }),
                        /* @__PURE__ */ w("span", { className: "reader-fab-chip-label", children: Js[p] }),
                        /* @__PURE__ */ w("span", { className: "reader-fab-chip-state", children: E ? "…" : L ? "↓" : "—" })
                      ]
                    },
                    p
                  );
                }) }),
                v.every((p) => !Ve(m[p])) ? /* @__PURE__ */ w("p", { className: "reader-fab-empty", children: "产物尚未就绪" }) : null
              ] })
            ]
          }
        ) : null,
        /* @__PURE__ */ w(
          "button",
          {
            type: "button",
            className: `reader-fab-trigger${i ? " is-open" : ""}${e ? " has-active-tool" : ""}`,
            "aria-label": i ? "收起工具菜单" : "打开工具菜单",
            "aria-expanded": i,
            "aria-controls": i ? f : void 0,
            "aria-haspopup": "menu",
            onPointerDown: I,
            onPointerMove: y,
            onPointerUp: b,
            onPointerCancel: b,
            children: /* @__PURE__ */ w("span", { className: "reader-fab-icon", "aria-hidden": "true", children: i ? /* @__PURE__ */ w(Ze, { size: 20, strokeWidth: 2.5 }) : /* @__PURE__ */ O("span", { className: "reader-fab-dots", children: [
              /* @__PURE__ */ w("i", {}),
              /* @__PURE__ */ w("i", {}),
              /* @__PURE__ */ w("i", {})
            ] }) })
          }
        )
      ]
    }
  );
}
function Xs({
  userZoom: e,
  onZoomChange: t,
  currentPage: n,
  numPages: r,
  onGoToPage: a,
  mode: o = "compare",
  modeControls: i
}) {
  const s = pa(e), c = e > dr + 1e-3, l = e < fr - 1e-3, d = Ge(), u = "50%（半屏，对照铺满）", [f, m] = z(!1), [g, h] = z(`${n}`);
  B(() => {
    f || h(`${Math.min(Math.max(n, 1), Math.max(r, 1))}`);
  }, [n, r, f]);
  const I = () => {
    if (m(!1), !a || r <= 0)
      return;
    const y = Number(`${g}`.trim());
    a(gt(y, r));
  };
  return /* @__PURE__ */ O("div", { className: "reader-react-hud", "data-reader-hud": "true", children: [
    i ? /* @__PURE__ */ w("div", { className: "reader-react-hud-group reader-react-hud-modes", children: i }) : null,
    /* @__PURE__ */ w("div", { className: "reader-react-hud-group", "aria-label": "页码", children: f ? /* @__PURE__ */ O(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (y) => {
          y.preventDefault(), I();
        },
        children: [
          /* @__PURE__ */ w(
            "input",
            {
              className: "reader-react-hud-page-input",
              type: "text",
              inputMode: "numeric",
              pattern: "[0-9]*",
              "aria-label": "跳转到页码",
              value: g,
              autoFocus: !0,
              onChange: (y) => h(y.target.value.replace(/[^\d]/g, "")),
              onBlur: I,
              onKeyDown: (y) => {
                y.key === "Escape" && (y.preventDefault(), m(!1), h(`${n}`));
              }
            }
          ),
          /* @__PURE__ */ O("span", { className: "reader-react-hud-page-suffix", children: [
            "/ ",
            r || "—"
          ] })
        ]
      }
    ) : /* @__PURE__ */ w(
      "button",
      {
        type: "button",
        className: "reader-react-hud-page reader-react-hud-page-btn",
        "aria-label": r > 0 ? `跳转页码，当前第 ${n} 页，共 ${r} 页` : "页码",
        title: r > 0 ? "点击输入页码跳转" : void 0,
        disabled: !a || r <= 0,
        onClick: () => {
          !a || r <= 0 || (h(`${n}`), m(!0));
        },
        children: r > 0 ? `${Math.min(n, r)} / ${r}` : "—"
      }
    ) }),
    /* @__PURE__ */ O("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ w(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !c,
          onClick: () => t(et(e, -1)),
          children: "−"
        }
      ),
      /* @__PURE__ */ O(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn reader-react-hud-zoom-label",
          "aria-label": `重置为${u}`,
          title: u,
          onClick: () => t(d),
          children: [
            s,
            "%"
          ]
        }
      ),
      /* @__PURE__ */ w(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "放大",
          disabled: !l,
          onClick: () => t(et(e, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ w("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ w($s, {}) })
  ] });
}
const Ut = "download-toast";
function Zs({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: a = "progress"
}) {
  const o = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ O("div", { className: "download-toast-card reader-floating-surface", "data-tone": a, "aria-live": "polite", children: [
    /* @__PURE__ */ O("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ w("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ w("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ w("div", { className: "download-toast-track", children: /* @__PURE__ */ w("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${o}%` } }) }),
    /* @__PURE__ */ w("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function Qs(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: a = "等待响应...",
    percent: o = NaN,
    tone: i = "progress"
  } = e;
  if (!t) {
    At.dismiss(Ut);
    return;
  }
  At.custom(
    () => /* @__PURE__ */ w(Zs, { title: n, status: r, meta: a, percent: o, tone: i }),
    { id: Ut, duration: 1 / 0 }
  );
}
function ec() {
  const e = _((t) => {
    t && (t.setState = Qs, t.hide = () => At.dismiss(Ut));
  }, []);
  return /* @__PURE__ */ O(tr, { children: [
    /* @__PURE__ */ w(no, { position: "bottom-right" }),
    /* @__PURE__ */ w("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
const tc = Kt(() => import("./ReaderFavoritesPanel-_iYMXvnU.js").then((e) => ({ default: e.ReaderFavoritesPanel }))), nc = Kt(() => import("./ReaderMarkdownPanel-CwLJig2X.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), rc = Kt(() => import("./ReaderAiPanel-CEIa3qAz.js").then((e) => ({ default: e.ReaderAiPanel })));
function Lt(e) {
  const t = N(!1);
  return e && (t.current = !0), t.current;
}
function oc(e) {
  return "workspace";
}
function ac(e, t) {
  return t !== null && e === "compare" ? "source" : e;
}
function er(e, t) {
  var n, r, a, o;
  return e === "compare" ? null : (t == null ? void 0 : t.assistantPanel) === "markdown" || (t == null ? void 0 : t.assistantPanel) === "ai" ? t.assistantPanel : ((n = t == null ? void 0 : t.splitLayout) == null ? void 0 : n.left) === "ai" || ((r = t == null ? void 0 : t.splitLayout) == null ? void 0 : r.right) === "ai" ? "ai" : ((a = t == null ? void 0 : t.splitLayout) == null ? void 0 : a.left) === "markdown" || ((o = t == null ? void 0 : t.splitLayout) == null ? void 0 : o.right) === "markdown" ? "markdown" : null;
}
function ic() {
  const e = di(), { boot: t, panes: n, shell: r, sessionFiles: a, tools: o, session: i } = e, s = e.sourceOnly || !a.translatedUrl, [c, l] = z(() => er(e.mode, Ie(e.viewStateKey))), [d, u] = z(null), [f, m] = z(null), [g, h] = z(!0), I = N(e.viewStateKey);
  B(() => {
    m(null), h(!0);
  }, [e.viewStateKey]), B(() => {
    if (!t.loading) {
      if (I.current !== e.viewStateKey) {
        I.current = e.viewStateKey;
        const k = Ie(e.viewStateKey);
        l(er(e.mode, k)), u(null);
        return;
      }
      en(e.viewStateKey, { assistantPanel: c, splitLayout: null });
    }
  }, [c, t.loading, e.mode, e.viewStateKey]);
  const y = c || (e.mode === "compare" ? "compare" : "reading"), b = c !== null, R = Lt(o.isOpen("favorites")), v = Lt(c === "markdown"), p = Lt(c === "ai"), x = d || ac(e.mode, c), T = !!(e.liveTranslationAvailable && g && !b), M = T ? "compare" : x, E = _(() => {
    o.close();
  }, [o]), L = _(() => {
    l(null), u(null), m(null);
  }, []), P = _((k) => {
    const $ = M === "translated" ? "translated" : "source";
    e.jumpToAnchor(k, $);
  }, [e.jumpToAnchor, M]), S = _((k) => {
    i.refreshCommittedDocument(k);
  }, [i.refreshCommittedDocument]), A = _((k) => {
    o.close(), u(null), k === "compare" && e.liveTranslationAvailable ? h(!0) : k !== "compare" && h(!1), e.setModeKeepingPage(k);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage, o]), C = _((k) => {
    l(k), k !== "ai" && m(null);
  }, []), F = _((k) => {
    const $ = k.pane === "translated" && !s ? "translated" : "source";
    m(k), l("ai"), u($), e.clearSelection();
  }, [e.clearSelection, s]), U = [
    "reader-react-root",
    `is-workspace-${y}`,
    b ? "is-assistant-open" : "",
    T ? "is-live-translation-pair" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ O("div", { className: U, "data-reader-engine": "react-pdf", "data-reader-workspace": y, children: [
    /* @__PURE__ */ w(Cs, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent }),
    /* @__PURE__ */ w(bi, { onBeforeClose: i.prepareClose }),
    /* @__PURE__ */ w(
      qi,
      {
        mode: M,
        documentReady: !!i.jobId,
        sourceOnly: s,
        onModeChange: A,
        liveTranslation: e.liveTranslationAvailable ? {
          visible: g,
          state: e.liveTranslation,
          onToggle: () => h((k) => !k)
        } : null
      }
    ),
    /* @__PURE__ */ w(Vi, { active: c, onSelect: C, onClose: L }),
    b ? /* @__PURE__ */ w(zs, {}) : null,
    e.showHud ? /* @__PURE__ */ w(Ys, { activeTool: o.active, sourceOnly: e.sourceOnly, onToggleTool: o.toggle, download: e.download }) : null,
    /* @__PURE__ */ w(Wi, { mode: M, bindShell: r.bindShell, shellEl: r.shellEl, userZoom: e.userZoom, compareMode: M === "compare", shellWidth: r.shellWidth, compareColWidth: r.compareColWidth, rowHeights: e.rowHeights, mountSource: n.mountSource, mountTranslated: n.mountTranslated, showSource: T || M !== "translated", showTranslated: T || M === "translated" || M === "compare", sourceOnly: s, sourceUrl: a.sourceUrl, translatedUrl: a.translatedUrl, sourceFile: a.sourceFile, translatedFile: a.translatedFile, activeRegion: e.activeRegion, regions: i.regions, readerMetadata: i.readerMetadata, onSelectRegion: e.selectRegion, markdownSplit: c === "markdown", assistantSplit: b, onMetrics: n.onMetrics, onNumPagesChange: n.onNumPages, liveTranslation: g ? e.liveTranslation : void 0, liveTranslationPair: T }),
    e.showHud ? /* @__PURE__ */ w(
      Xs,
      {
        userZoom: e.userZoom,
        onZoomChange: e.onZoomChange,
        currentPage: e.currentPage,
        numPages: n.hudNumPages,
        mode: M,
        onGoToPage: e.goToPage,
        modeControls: null
      }
    ) : null,
    /* @__PURE__ */ O(Kr, { fallback: null, children: [
      R ? /* @__PURE__ */ w(tc, { open: o.isOpen("favorites"), jobId: i.jobId, documentId: i.documentId, onClose: E, onJumpPage: e.goToPage }) : null,
      v ? /* @__PURE__ */ w(nc, { open: c === "markdown", jobId: i.jobId, sourceOnly: e.sourceOnly, layout: "workspace", side: "right", onClose: L }) : null,
      p ? /* @__PURE__ */ w(rc, { open: c === "ai", jobId: i.jobId, documentId: i.documentId, layout: oc(e.mode), side: "right", selectionContext: f, onClearSelectionContext: () => m(null), onClose: L, onJumpCitation: P, onDocumentCommitted: S }, i.documentId || i.jobId || "reader-ai-pending") : null
    ] }),
    /* @__PURE__ */ w(Ds, { selection: e.selection, onDismiss: e.clearSelection, onAskAi: F }),
    /* @__PURE__ */ w(ec, {})
  ] });
}
function Tc() {
  return /* @__PURE__ */ w(ic, {});
}
export {
  Vt as A,
  Tc as R,
  ic as a,
  Ro as b,
  Rc as c,
  Qe as d,
  lr as e,
  Ic as f,
  Sc as g,
  wc as r
};
//# sourceMappingURL=ReaderApp-BgACXe1b.js.map
