var Es = Object.defineProperty;
var Nr = (e) => {
  throw TypeError(e);
};
var Ps = (e, t, n) => t in e ? Es(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var Ar = (e, t, n) => Ps(e, typeof t != "symbol" ? t + "" : t, n), xr = (e, t, n) => t.has(e) || Nr("Cannot " + n);
var xt = (e, t, n) => (xr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Lr = (e, t, n) => t.has(e) ? Nr("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Cr = (e, t, n, r) => (xr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as L, jsx as p, Fragment as $e } from "react/jsx-runtime";
import { useMemo as W, useState as N, useEffect as z, useCallback as A, useRef as x, useLayoutEffect as xe, memo as Yt, createContext as Zt, useContext as dt, Fragment as yn, forwardRef as Rs, useImperativeHandle as rr, useSyncExternalStore as vn, Component as Ms, Suspense as Jo, lazy as Go, useId as Xo } from "react";
import { requireAdapter as Nt, getReaderAdapters as He } from "./adapters.js";
import { resolveReaderDownloadName as _s, resolveReaderDownloadUrls as Ns, READER_PROGRESS_COPY as Xe, trimString as ln, READER_DOWNLOAD_ACTIONS as As, disabledReason as xs } from "./runtime/state.js";
import { r as Ls, b as Cs } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as $n, isFinishedJobStatus as Wt } from "@retainpdf/domain/job";
import { n as Yo, d as Ds, f as Tn, k as Dr, b as $s, c as Os, j as Ue, p as gt, g as zs, l as Rt, i as Fs } from "./reader-regions-BmqHsJ-I.js";
import { fetchDocumentReading as Bs } from "@retainpdf/api/documents";
import { isReaderTransportError as js, createReaderTransportError as Hs } from "./contracts.js";
import { toast as On, Toaster as Us } from "sonner";
import { ChevronLeft as Zo, PenLine as un, ZoomIn as Ks, Check as Qo, X as At, Copy as Ws, ChevronUp as Vs, ChevronDown as dn, History as qs, LoaderCircle as Js, Pin as Gs, LogOut as Xs, FileText as ea, Columns2 as ta, Languages as na, Radio as Ys, ArrowDownToLine as Zs, CheckCircle2 as Qs, ImagePlus as ei, MessageCircle as ti, Scan as ni, GitCompareArrows as ri, Highlighter as oi, Eraser as ai, Undo2 as si, Trash2 as ii, BookText as ci, ChevronRight as ra, Minus as oa, Plus as aa, ArrowLeft as li, CircleHelp as ui, Download as di, Bookmark as fi, Star as mi, Contrast as hi, Search as sa, ListTree as pi } from "lucide-react";
import { Button as oe, Textarea as gi, IconButton as ut, Input as or } from "@retainpdf/ui";
import { createPortal as bi } from "react-dom";
import { pdfjs as ia, Page as yi, Document as vi } from "react-pdf";
import { e as wi, m as Si, a as Ii } from "./markdown-math-XkF5urpn.js";
const ki = (...e) => {
  var t, n;
  return ((n = (t = He()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, Ti = "", Ei = Object.freeze({
  progress: "retainpdf-reader-progress"
}), Pi = (e) => {
  var t, n;
  return ((n = (t = He()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, Og = (...e) => {
  var n;
  return (((n = He()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, zg = () => {
  var e, t;
  return ((t = (e = He()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
}, Ye = () => Nt("defaultReaderDataPort"), $r = () => Nt("defaultReaderPageConfigPort"), Fg = {
  get apiPrefix() {
    return Ye().apiPrefix;
  },
  fetchProtected: (...e) => Ye().fetchProtected(...e),
  loadMarkdownPayload: (e) => Ye().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => Ye().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => Ye().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => Ye().loadJobPayload(e),
  loadReaderPayload: (e, t) => Ye().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => Ye().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return Ye().liveTranslation;
  }
}, ca = {
  messageTargetOrigin: () => $r().messageTargetOrigin(),
  readerJobId: () => $r().readerJobId()
}, Ri = () => {
  var e;
  return ((e = He()) == null ? void 0 : e.liveTranslation) ?? null;
}, Vt = () => {
  var t;
  const e = He();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, nt = () => {
  const e = He();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => Nt("fetchDocumentByJobId")(...n),
    fetchProtected: t.fetchProtected,
    resolveResourceUrl: e.resolveResourceUrl ?? ((n) => n),
    resolveReaderSourcePdf: (n) => {
      var r;
      return ((r = e.resolveReaderSourcePdf) == null ? void 0 : r.call(e, n)) ?? null;
    },
    resolveReaderTranslatedPdfUrl: (n, r) => {
      var o;
      return ((o = e.resolveReaderTranslatedPdfUrl) == null ? void 0 : o.call(e, n, r)) ?? "";
    },
    resolveReaderArtifactUrl: (n) => {
      var r;
      return ((r = e.resolveReaderArtifactUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, Mi = (...e) => {
  var t, n;
  return ((n = (t = He()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, _i = () => {
  var e, t;
  return ((t = (e = He()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, Ni = (...e) => {
  var t, n;
  return ((n = (t = He()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, Ai = (...e) => {
  var t, n;
  return ((n = (t = He()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? _s(...e);
}, xi = (...e) => {
  var t, n;
  return ((n = (t = He()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? Ns(...e);
}, Li = (...e) => Nt("downloadProtectedResource")(...e), Ci = (...e) => Nt("failDownloadToast")(...e), Bg = (e, t) => Nt("resolveMarkdownAssetUrl")(e, t), Or = "/api/v1";
function Di() {
  const e = () => {
    var r;
    return Ls(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = N(e);
  return z(() => {
    var i, c, l, u;
    const r = () => n(e()), o = (c = (i = globalThis.history) == null ? void 0 : i.pushState) == null ? void 0 : c.bind(globalThis.history), a = (u = (l = globalThis.history) == null ? void 0 : l.replaceState) == null ? void 0 : u.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const f = (d) => function(...m) {
          const g = d.apply(this, m);
          return r(), globalThis.dispatchEvent(new Event("pushstate")), globalThis.dispatchEvent(new Event("replacestate")), globalThis.dispatchEvent(new Event("locationchange")), g;
        };
        globalThis.history.pushState = f(o), globalThis.history.replaceState = f(a), s = !0;
      } catch {
      }
    return window.addEventListener("popstate", r), window.addEventListener("hashchange", r), window.addEventListener("pushstate", r), window.addEventListener("replacestate", r), window.addEventListener("locationchange", r), () => {
      if (window.removeEventListener("popstate", r), window.removeEventListener("hashchange", r), window.removeEventListener("pushstate", r), window.removeEventListener("replacestate", r), window.removeEventListener("locationchange", r), s && o && a)
        try {
          globalThis.history.pushState = o, globalThis.history.replaceState = a;
        } catch {
        }
    };
  }, []), t;
}
function $i() {
  const e = Di(), t = W(() => Ni(ca), [e]), n = W(() => _i(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function Oi(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: i
  } = e, [c, l] = N({
    documentId: "",
    jobId: ""
  }), [u, f] = N({
    documentId: "",
    jobId: ""
  }), d = c.documentId === t ? c.jobId : "", m = u.documentId === t ? u.jobId : "", g = n || d, [h, y] = N({
    jobId: "",
    documentId: ""
  }), I = h.jobId === g ? h.documentId : "", S = t || I, b = !!t && !g, [w, v] = N(null), R = (w == null ? void 0 : w.sessionIdentity) === r && w.documentId === S ? w : null, C = b || !!R, M = A((T) => {
    const k = `${T.documentId || ""}`.trim();
    if (!k || a.current && a.current !== k) return;
    if (!a.current && s.current)
      y({
        jobId: s.current,
        documentId: k
      });
    else if (!a.current)
      return;
    const E = `${T.revision || ""}`.trim() || `${Date.now()}`;
    v({
      documentId: k,
      revision: E,
      sessionIdentity: o.current
    }), i();
  }, []);
  z(() => {
    v((T) => T && T.sessionIdentity !== r ? null : T);
  }, [r]);
  const P = A((T) => {
    switch (T.type) {
      case "resolved-document-job":
        l({ documentId: T.documentId, jobId: T.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        f({ documentId: T.documentId, jobId: T.jobId });
        break;
      case "resolved-job-document":
        y((k) => k.jobId === T.jobId && k.documentId === T.documentId ? k : { jobId: T.jobId, documentId: T.documentId });
        break;
      case "committed-source":
        v({
          documentId: T.documentId,
          revision: T.revision,
          sessionIdentity: T.sessionIdentity
        });
        break;
    }
  }, []);
  return {
    resolvedDocumentJob: c,
    setResolvedDocumentJob: l,
    missingDocumentJob: u,
    setMissingDocumentJob: f,
    documentJobId: d,
    rejectedDocumentJobId: m,
    sessionJobId: g,
    resolvedJobDocument: h,
    setResolvedJobDocument: y,
    jobDocumentId: I,
    documentId: S,
    sourceOnly: b,
    committedDocumentSource: w,
    setCommittedDocumentSource: v,
    activeCommittedDocumentSource: R,
    sourceViewOnly: C,
    refreshCommittedDocument: M,
    applyIdentityEvent: P
  };
}
function zr(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function zi(e) {
  var r, o, a, s;
  if (!e || typeof e != "object") return "";
  const t = e, n = [
    t.document_id,
    t.documentId,
    (r = t.document) == null ? void 0 : r.document_id,
    (o = t.book_summary) == null ? void 0 : o.document_id,
    (s = (a = t.request_payload) == null ? void 0 : a.source) == null ? void 0 : s.document_id
  ];
  for (const i of n) {
    const c = `${i || ""}`.trim();
    if (c) return c;
  }
  return "";
}
function Fr(e, t) {
  return Pi($n(e, t));
}
function Fi(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function Bi(e, t) {
  const n = e == null ? void 0 : e.book_summary, r = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    n == null ? void 0 : n.title,
    e == null ? void 0 : e.source_file_name,
    n == null ? void 0 : n.source_file_name
  ];
  for (const o of r) {
    const a = `${o || ""}`.trim();
    if (a && !Fi(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function zn({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: Ei.progress,
        stage: n,
        percent: e,
        text: t
      },
      ca.messageTargetOrigin()
    );
  } catch {
  }
}
function fn(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), zn({ percent: t, text: n, stage: r });
}
function ji(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = N(null), [l, u] = N(null), [f, d] = N(""), [m, g] = N(0), h = f === n ? i : null, y = f === n ? l : null, I = zr(h), S = Wt(I), b = A(() => {
    g((P) => P + 1);
  }, []), w = A((P) => {
    c(P.jobPayload), u(P.manifestPayload), d(P.sessionIdentity);
  }, []), v = A((P) => {
    c(null), u(null), d(P);
  }, []), R = x(""), C = x(""), M = A(async () => {
    const P = o.current;
    if (!P || R.current === P) return;
    const T = nt().loadJobPayload;
    if (typeof T != "function") return;
    const k = a.current.value;
    R.current = P;
    try {
      const E = await T(P);
      if (s.current || a.current.value !== k || o.current !== P || !E || typeof E != "object")
        return;
      const _ = zr(E);
      c(E), d(r.current), !Wt(_) && C.current === P && (C.current = ""), _ === "succeeded" && C.current !== P && (C.current = P, g((D) => D + 1));
    } catch {
    } finally {
      R.current === P && (R.current = "");
    }
  }, []);
  return z(() => {
    C.current = "";
  }, [n]), z(() => {
    if (!t || S || !h) return;
    const P = window.setInterval(() => {
      document.visibilityState !== "hidden" && M();
    }, 1e3);
    return () => window.clearInterval(P);
  }, [S, M, h, t]), {
    jobPayload: i,
    setJobPayload: c,
    manifestPayload: l,
    setManifestPayload: u,
    payloadSessionIdentity: f,
    setPayloadSessionIdentity: d,
    scopedJobPayload: h,
    scopedManifestPayload: y,
    jobStatus: I,
    jobTerminal: S,
    jobRefreshRevision: m,
    refreshJobArtifacts: b,
    refreshJobStatus: M,
    publishPayload: w,
    clearPayload: v
  };
}
function Fn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function Hi(e, t) {
  e(t), Fn(t);
}
function Ui(e) {
  const [t, n] = N(e ? "source" : "compare"), r = A((a) => {
    e && a !== "source" || (n(a), Fn(a));
  }, [e]), o = A((a) => {
    Hi(n, a);
  }, []);
  return z(() => (e && document.documentElement.classList.add("reader-source-only"), Fn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Br(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function Ki(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Br(n.active_job_id),
    activeVersionId: Br(n.active_version_id)
  };
}
function Wi(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Vi(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function qi(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Ji = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Gi(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Ji.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const Xi = 48 * 1024 * 1024;
function Yi(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Zi = 2, je = /* @__PURE__ */ new Map();
function Bn(e, t) {
  je.delete(e), je.set(e, t);
}
function jr(e) {
  if (je.size < Zi) return;
  const t = je.keys().next().value;
  t && je.delete(t);
}
async function Qi(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function la(e, t = Vt().fetchProtected, n = {}) {
  var u, f, d, m, g, h, y, I, S;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (je.has(r)) {
    const b = je.get(r);
    return Bn(r, b), b;
  }
  const o = new AbortController(), a = () => o.abort();
  (u = n.signal) != null && u.aborted && o.abort(), (d = (f = n.signal) == null ? void 0 : f.addEventListener) == null || d.call(f, "abort", a, { once: !0 });
  let s;
  try {
    s = await t(r, { signal: o.signal });
  } finally {
    (g = (m = n.signal) == null ? void 0 : m.removeEventListener) == null || g.call(m, "abort", a);
  }
  if (!s.ok) {
    const b = new Error(`读取 PDF 失败 (${s.status})`);
    b.status = s.status;
    const w = await Qi(s);
    throw w && (b.reason = w), b;
  }
  const i = ec(r, s, t);
  if (i) {
    o.abort();
    const b = { ranged: i };
    return jr(), je.set(r, b), b;
  }
  (y = (h = n.signal) == null ? void 0 : h.addEventListener) == null || y.call(h, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (S = (I = n.signal) == null ? void 0 : I.removeEventListener) == null || S.call(I, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return je.has(r) ? Bn(r, l) : (jr(), je.set(r, l)), l;
}
function ec(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < Xi ? null : {
    url: e,
    length: o,
    async fetchRange(i, c) {
      const l = await n(e, { headers: { Range: `bytes=${i}-${c - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const tc = { file: null, loading: !1, error: "" }, nc = { file: null, loading: !0, error: "" };
function rc(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = N(null);
  if (z(() => {
    if (t || !n) return;
    const s = je.get(n);
    if (s) {
      Bn(n, s);
      return;
    }
    const i = new AbortController();
    return la(n, void 0, { signal: i.signal }).then((c) => {
      i.signal.aborted || o({ url: n, file: c, loading: !1, error: "" });
    }).catch((c) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (c == null ? void 0 : c.message) || String(c) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return tc;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = je.get(n);
  return a ? { file: a, loading: !1, error: "" } : nc;
}
function oc(e) {
  const { sessionEpochRef: t, closingRef: n, abort: r, sessionEpoch: o } = e;
  let a = !1;
  const s = () => r.signal.aborted || n.current || t.current.value !== o;
  return {
    signal: r.signal,
    isClosedOrStale: s,
    isInactive: () => a || s(),
    markFailed: () => {
      a = !0;
    }
  };
}
async function jn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  fn(s, r, n, "download");
  const i = await la(t, Vt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (fn(s, o, n, "download"), i);
}
async function ac(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  fn(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    jn({
      url: t,
      label: "正在下载原文 PDF…",
      percentStart: 30,
      percentEnd: 55,
      fence: r,
      setBoot: o
    }).then((u) => {
      s = u;
    })
  ), n && a.push(
    jn({
      url: n,
      label: "正在下载译文 PDF…",
      percentStart: 55,
      percentEnd: 85,
      fence: r,
      setBoot: o
    }).then((u) => {
      i = u;
    })
  ), await Promise.all(a), r.isInactive() ? { status: "inactive" } : !!t && !s || !!n && !i ? { status: "incomplete" } : { status: "downloaded", sourceBytes: s, translatedBytes: i };
}
function sc(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function ic({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = Bs,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(sc(o.href, t, a)), !0);
}
const tn = {
  regions: null,
  metadata: null
};
function cc(e) {
  const {
    sessionJobId: t,
    jobId: n,
    routeDocumentId: r,
    documentJobId: o,
    rejectedDocumentJobId: a,
    sourceOnly: s,
    locationKey: i,
    sessionIdentity: c,
    committedSource: l,
    applyIdentityEvent: u,
    publishPayload: f,
    clearPayload: d,
    switchSessionMode: m,
    jobRefreshRevision: g,
    sessionEpochRef: h,
    closingRef: y,
    activeLoadAbortRef: I
  } = e, [S, b] = N(""), [w, v] = N(""), [R, C] = N(null), [M, P] = N(null), [T, k] = N(!1), [E, _] = N(""), [D, $] = N([]), [K, H] = N(!1), [J, le] = N(() => ({
    source: null,
    translated: null
  })), [ee, ie] = N(
    tn
  ), [Se, Z] = N({
    loading: !0,
    percent: 4,
    text: Xe.boot,
    stage: "progress",
    failed: !1
  });
  return z(() => {
    const de = new AbortController(), Le = h.current.value, ae = oc({
      sessionEpochRef: h,
      closingRef: y,
      abort: de,
      sessionEpoch: Le
    });
    I.current = de;
    const fe = nt();
    if (y.current)
      return de.abort(), () => {
        I.current === de && (I.current = null);
      };
    let B = !1;
    function U(re, Q) {
      ae.markFailed(), H(!0), Z({
        loading: !1,
        percent: 100,
        text: re,
        stage: "failed",
        failed: !0
      }), zn({ percent: 100, text: Q, stage: "failed" });
    }
    function G() {
      k(!0), B || H(!0), Z({
        loading: !1,
        percent: 100,
        text: Xe.ready,
        stage: "ready",
        failed: !1
      }), zn({ percent: 100, text: Xe.ready, stage: "ready" });
    }
    function se() {
      return l != null && l.documentId ? Fr(
        l.documentId,
        l.revision
      ) : ki() ? Ti : fe.resolveResourceUrl($n(r));
    }
    async function ne() {
      var te;
      let re = { activeJobId: "", activeVersionId: "" };
      try {
        const he = await ((te = fe.fetchDocument) == null ? void 0 : te.call(fe, r));
        he && (re = Ki(he));
      } catch {
      }
      const Q = Wi({
        link: re,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (Q.kind === "follow-active-job") {
        if (ae.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: Q.jobId
        }), Q.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: Q.activeVersionId,
          sessionIdentity: c
        }), m("source")) : m("compare");
        return;
      }
      if (Q.kind === "open-committed-source") {
        if (ae.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: Q.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const ge = se();
      if (ae.isInactive()) return;
      b(ge), v(""), _(""), d(c);
      const F = await jn({
        url: ge,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: ae,
        setBoot: Z
      });
      if (!ae.isInactive()) {
        if (!F) {
          U("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        C(F), G();
      }
    }
    async function me() {
      var Re;
      const re = !l, Q = !!(re && fe.loadSessionSnapshot && fe.loadReaderOptionalArtifacts), ge = Q ? fe.loadReaderOptionalArtifacts(t) : null, F = await ((Re = fe.loadSessionSnapshot) == null ? void 0 : Re.call(fe, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: re && !Q
      })), te = F ? {
        jobPayload: F.sourcePayload,
        manifestPayload: F.manifestPayload,
        readerMetadata: F.readerMetadata,
        regionsPayload: F.regions,
        readerErrors: F.readerErrors
      } : await fe.loadReaderPayload(t, {
        includeOptionalArtifacts: re
      });
      if (ae.isInactive()) return;
      let he = null;
      if (n && !r)
        if (F && F.linkedDocument !== void 0)
          he = F.linkedDocument;
        else {
          try {
            he = await fe.fetchDocumentByJobId(Or, t);
          } catch {
          }
          if (ae.isInactive()) return;
        }
      const Oe = zi(te.jobPayload) || `${(he == null ? void 0 : he.document_id) || ""}`.trim();
      Oe && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Oe
      });
      const Ce = Vi({
        payloadDocumentId: Oe,
        linkedActiveJobId: `${(he == null ? void 0 : he.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(he == null ? void 0 : he.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (Ce.kind === "restore-committed-source") {
        if (ae.isInactive()) return;
        u({
          type: "committed-source",
          documentId: Ce.documentId,
          revision: Ce.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const _e = fe.resolveReaderSourcePdf(te.manifestPayload), Be = fe.resolveReaderTranslatedPdfUrl(te.jobPayload, te.manifestPayload), ze = typeof _e == "string" ? _e : fe.resolveReaderArtifactUrl(_e), Ne = r || Oe, Ke = l != null && l.documentId ? Fr(
        l.documentId,
        l.revision
      ) : ze || (Ne ? fe.resolveResourceUrl($n(Ne)) : ""), De = l ? "" : Be || "";
      b(Ke || ""), v(De), _(Bi(te.jobPayload, t)), f({
        jobPayload: te.jobPayload || null,
        manifestPayload: te.manifestPayload || null,
        sessionIdentity: c
      });
      const Fe = () => ac({
        sourceFinal: Ke || "",
        translatedFinal: De,
        fence: ae,
        setBoot: Z
      }), j = !!(Ke || De), q = ge && j ? Fe() : null;
      q == null || q.catch(() => {
      });
      const ue = (O) => {
        ae.isInactive() || ($(l ? [] : Yo(O.regionsPayload)), le(l ? { source: null, translated: null } : Ds(O.readerMetadata)), ie(l ? tn : O.readerErrors ?? tn), H(!0));
      };
      if (ge ? (B = !0, ge.then(ue)) : ue(te), !j) {
        U(Xe.failed, Xe.failed);
        return;
      }
      const ve = await (q ?? Fe());
      if (ve.status !== "inactive") {
        if (ve.status === "incomplete") {
          U("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        C(ve.sourceBytes), P(ve.translatedBytes), G();
      }
    }
    async function we() {
      k(!1), C(null), P(null), $([]), H(!1), le({ source: null, translated: null }), ie(tn), fn(Z, 8, Xe.metadata, "metadata");
      try {
        if (s) {
          await ne();
          return;
        }
        if (!t) {
          U(Xe.failed, Xe.failed);
          return;
        }
        await me();
      } catch (re) {
        if (ae.isClosedOrStale() || (re == null ? void 0 : re.name) === "AbortError") return;
        ae.markFailed();
        const Q = Number(re == null ? void 0 : re.status), ge = `${(re == null ? void 0 : re.reason) || ""}`, F = Gi({ status: Q, reason: ge, sessionJobId: t });
        if (F && (await ic({
          apiPrefix: Or,
          documentId: F,
          expiredJobId: t
        }) || ae.isClosedOrStale()))
          return;
        if (qi({
          status: Q,
          reason: ge,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const te = re instanceof Error ? re.message : Xe.failed;
        U(te, te);
      }
    }
    return we(), () => {
      de.abort(), I.current === de && (I.current = null);
    };
  }, [t, r, o, a, s, i, l, g, n, c, u, f, d, m]), {
    sourceUrl: S,
    translatedUrl: w,
    sourceFile: R,
    translatedFile: M,
    assetsReady: T,
    title: E,
    regions: D,
    regionsSettled: K,
    readerMetadata: J,
    readerErrors: ee,
    boot: Se
  };
}
function lc() {
  const e = x(!1), t = x(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = $i(), s = x({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = x(a), c = x(""), l = x(""), u = x(() => {
  }), f = A(() => u.current(), []), d = Oi({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: i,
    documentIdRef: c,
    sessionJobIdRef: l,
    switchToSourceMode: f
  }), {
    sessionJobId: m,
    documentId: g,
    sourceOnly: h,
    sourceViewOnly: y
  } = d, { mode: I, setMode: S, switchSessionMode: b } = Ui(y);
  u.current = () => {
    b("source");
  }, i.current = a, c.current = g, l.current = m;
  const w = ji({
    sessionJobId: m,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: v,
    scopedManifestPayload: R,
    jobStatus: C,
    jobTerminal: M,
    jobRefreshRevision: P,
    refreshJobArtifacts: T,
    refreshJobStatus: k
  } = w, E = cc({
    sessionJobId: m,
    jobId: r,
    routeDocumentId: o,
    documentJobId: d.documentJobId,
    rejectedDocumentJobId: d.rejectedDocumentJobId,
    sourceOnly: h,
    locationKey: n,
    sessionIdentity: a,
    committedSource: d.activeCommittedDocumentSource,
    applyIdentityEvent: d.applyIdentityEvent,
    publishPayload: w.publishPayload,
    clearPayload: w.clearPayload,
    switchSessionMode: b,
    jobRefreshRevision: P,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), _ = A(() => {
    var $;
    e.current = !0, ($ = t.current) == null || $.abort();
  }, []), D = W(
    () => ({
      fetchProtected: nt().fetchProtected,
      jobId: m,
      jobPayload: v,
      manifestPayload: R,
      sourceUrl: E.sourceUrl,
      translatedUrl: E.translatedUrl,
      sourceOnly: y
    }),
    [m, v, R, E.sourceUrl, E.translatedUrl, y]
  );
  return {
    jobId: m,
    jobStatus: C,
    workflow: `${(v == null ? void 0 : v.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: M,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: h,
    mode: I,
    setMode: S,
    sourceUrl: E.sourceUrl,
    translatedUrl: E.translatedUrl,
    sourceFile: E.sourceFile,
    translatedFile: E.translatedFile,
    assetsReady: E.assetsReady,
    boot: E.boot,
    title: E.title,
    regions: E.regions,
    regionsSettled: E.regionsSettled,
    readerMetadata: E.readerMetadata,
    readerErrors: E.readerErrors,
    download: D,
    refreshJobArtifacts: T,
    refreshJobStatus: k,
    refreshCommittedDocument: d.refreshCommittedDocument,
    prepareClose: _
  };
}
const uc = 160, dc = 8, fc = 0;
function mc() {
  const e = x(null), [t, n] = N(null), [r, o] = N(fc), a = A((s) => {
    e.current = s, n(s);
  }, []);
  return z(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (l) => {
      !Number.isFinite(l) || l < uc || o((u) => Math.abs(u - l) < dc ? u : l);
    }, c = new ResizeObserver((l) => {
      var u, f;
      i(((f = (u = l[0]) == null ? void 0 : u.contentRect) == null ? void 0 : f.width) ?? s.clientWidth);
    });
    return c.observe(s), i(s.clientWidth), () => c.disconnect();
  }, [t]), {
    shellRef: e,
    shellEl: t,
    shellWidth: r,
    bindShell: a
  };
}
function hc(e) {
  const { mode: t, sourceOnly: n, assetsReady: r, hasSource: o, hasTranslated: a } = e, s = r && o, i = r && a && !n, c = t === "source" || t === "compare", l = !n && (t === "translated" || t === "compare");
  return {
    mountSource: s,
    mountTranslated: i,
    showSource: c,
    showTranslated: l,
    compareMode: t === "compare" && c && l && s && i,
    primaryPane: t === "translated" ? "translated" : "source"
  };
}
const En = { source: 0, translated: 0 };
function pc(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    sourceUrl: a,
    translatedUrl: s,
    sourceFile: i,
    translatedFile: c
  } = e, l = `${(t == null ? void 0 : t.identityKey) || ""}\0${a}\0${s}`, u = x(l);
  u.current = l;
  const [f, d] = N(() => ({
    identity: l,
    pages: En
  })), [m, g] = N(() => ({ identity: l, tick: 0 })), h = f.identity === l ? f.pages : En, y = m.identity === l ? m.tick : 0, I = hc({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: S } = I, b = A((k, E) => {
    u.current === l && d((_) => {
      const D = _.identity === l ? _.pages : En;
      return D[E] === k && _.identity === l ? _ : {
        identity: l,
        pages: { ...D, [E]: k }
      };
    });
  }, [l]), w = x(null), v = A(() => {
    w.current && clearTimeout(w.current);
    const k = l;
    w.current = setTimeout(() => {
      w.current = null, u.current === k && g((E) => ({
        identity: k,
        tick: E.identity === k ? E.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  z(() => (w.current && (clearTimeout(w.current), w.current = null), d((k) => k.identity === l && k.pages.source === 0 && k.pages.translated === 0 ? k : { identity: l, pages: { source: 0, translated: 0 } }), g((k) => k.identity === l && k.tick === 0 ? k : { identity: l, tick: 0 }), () => {
    w.current && (clearTimeout(w.current), w.current = null);
  }), [l]);
  const R = W(
    () => Math.max(h.source, h.translated),
    [h]
  ), C = S === "translated" ? h.translated : h.source || h.translated, M = t == null ? void 0 : t.userZoom, P = t == null ? void 0 : t.shellWidth, T = `${l}-${y}-${M}-${n}-${h.source}-${h.translated}-${P}`;
  return {
    ...I,
    numPagesByPane: h,
    hudNumPages: R,
    primaryNumPages: C,
    metricsTick: y,
    onNumPages: b,
    onMetrics: v,
    rowSyncRevision: T
  };
}
const Pe = "data-reader-page", ke = "data-reader-pane", ar = "data-natural-height", gc = "reader-react-root", ua = "reader-react-grid", da = "reader-react-scroll-shell", wn = "reader-react-pdf-pane", fa = "reader-react-pdf-page", mn = "reader-react-pdf-page-placeholder", sr = "reader-react-pdf-page-slot";
function hn(e, t) {
  const n = e != null ? `[${Pe}="${e}"]` : `[${Pe}]`;
  return t ? `${n}[${ke}="${t}"]` : n;
}
function ir() {
  return `.${sr}[${Pe}]`;
}
function pn(e) {
  return Number(e.getAttribute(Pe));
}
const ma = 0.25, gn = 1, bc = 0.05, Qt = 0.5, yc = 16, vc = 8, ha = yc + vc, wc = 720;
function Tt() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function pa(e) {
  return Number.isFinite(e) && e < wc;
}
function It(e, t = Number.POSITIVE_INFINITY) {
  return pa(t) && (e === "source" || e === "translated") ? gn : Qt;
}
function et(e) {
  return Number.isFinite(e) ? Math.min(gn, Math.max(ma, e)) : Qt;
}
function qt(e, t) {
  const n = et(Number(e) + t * bc);
  return Math.round(n * 100) / 100;
}
function Sc(e) {
  return Math.round(et(e) * 100);
}
function ga(e) {
  const n = (Number(e) || 0) - ha;
  return Math.max(160, Math.floor(n));
}
function Ic(e, t = Qt) {
  const n = et(t);
  return ga((Number(e) || 0) * n);
}
function kc(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${ke}]`)
  ).map((s) => ({
    pane: s,
    cx: s.scrollLeft + s.clientWidth / 2,
    hadOverflow: s.scrollWidth > s.clientWidth + 1
  })), a = () => {
    e.scrollLeft = Math.max(0, n * t - e.clientWidth / 2), e.scrollTop = Math.max(0, r * t - e.clientHeight / 2);
    for (const { pane: s, cx: i, hadOverflow: c } of o) {
      const l = Math.max(0, s.scrollWidth - s.clientWidth);
      if (l <= 0) {
        s.scrollLeft = 0;
        continue;
      }
      c ? s.scrollLeft = Math.min(
        l,
        Math.max(0, i * t - s.clientWidth / 2)
      ) : s.scrollLeft = l / 2;
    }
  };
  requestAnimationFrame(() => {
    requestAnimationFrame(a);
  });
}
const Tc = 8;
function Ec(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < Tc ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const ba = 200, Pc = [
  "markdown"
], Rc = Pc;
function ya(e) {
  return Rc.includes(e);
}
const Mc = "retainpdf:reader:view:v1:", Hr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), _c = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function va() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Hn(e) {
  return `${e || ""}`.trim();
}
function Nc({
  documentId: e,
  jobId: t
}) {
  const n = Hn(e);
  if (n) return `document:${n}`;
  const r = Hn(t);
  return r ? `job:${r}` : "";
}
function wa(e) {
  const t = Hn(e);
  return t ? `${Mc}${t}` : "";
}
function Ac(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function xc(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!Hr.has(t) || !Hr.has(n) || t === n))
    return { left: t, right: n };
}
function Lc(e) {
  return e === null ? null : ya(e) ? e : void 0;
}
function Cc(e) {
  return _c.has(e) ? e : void 0;
}
function Sa(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = Ac(t.anchor), r = Number(t.zoom), o = Cc(t.mode), a = xc(t.splitLayout), s = Lc(t.assistantPanel);
  return {
    schema: "retainpdf_reader_view_v1",
    ...n ? { anchor: n } : {},
    ...Number.isFinite(r) ? { zoom: Math.max(0.25, Math.min(1, r)) } : {},
    ...o !== void 0 ? { mode: o } : {},
    ...a !== void 0 ? { splitLayout: a } : {},
    ...s !== void 0 ? { assistantPanel: s } : {},
    updatedAt: Number.isFinite(Number(t.updatedAt)) ? Number(t.updatedAt) : 0
  };
}
function Je(e, t = va()) {
  const n = wa(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? Sa(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function Sn(e, t, n = va()) {
  const r = wa(e);
  if (!r || !n) return null;
  const o = Je(e, n), a = Sa({
    schema: "retainpdf_reader_view_v1",
    ...o || {},
    ...t,
    updatedAt: Date.now()
  });
  if (!a) return null;
  try {
    return n.setItem(r, JSON.stringify(a)), a;
  } catch {
    return null;
  }
}
function Dc(e, t, n = "") {
  var d;
  const [r, o] = N(() => {
    var m;
    return ((m = Je(n)) == null ? void 0 : m.zoom) ?? It(e, Tt());
  }), a = x(r), s = x(n);
  a.current = r;
  const i = x(1), c = x(((d = Je(n)) == null ? void 0 : d.zoom) !== void 0);
  z(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const m = (h = Je(n)) == null ? void 0 : h.zoom;
    c.current = m !== void 0;
    const g = m ?? It(e, Tt());
    i.current = 1, a.current = g, o(g);
  }, [e, n]), z(() => {
    if (c.current) return;
    const m = It(e, Tt()), g = a.current;
    Math.abs(m - g) < 5e-4 || (i.current = 1, a.current = m, o(m));
  }, [e]);
  const l = A((m, g) => {
    const h = et(m), y = a.current;
    Math.abs(h - y) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : h / (y || 1), a.current = h, c.current = !0, Sn(s.current, { zoom: h }), o(h));
  }, []), u = A((m) => {
    l(qt(a.current, m));
  }, [l]), f = A((m) => {
    l(It(m));
  }, [l]);
  return xe(() => {
    const m = i.current;
    Math.abs(m - 1) < 1e-3 || (i.current = 1, kc(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: f };
}
const $c = 160, Oc = 3e-3, Ur = 50, zc = 16, Fc = 800;
function Bc(e, t = 0) {
  const n = t === 1 ? zc : t === 2 ? Fc : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-Ur, Math.min(Ur, r));
  return Math.exp(-o * Oc);
}
function jc(e, t, n = 0) {
  return et(e * Bc(t, n));
}
function Hc(e) {
  return Math.round(et(e) * 100) / 100;
}
function Uc(e, t, n) {
  const r = et(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return et(t) / r;
  const a = (o + ha) / r;
  return ga(a * et(t)) / o;
}
function Kc(e) {
  return Array.from(e.querySelectorAll(ir()));
}
function Wc(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function Vc(e, t, n) {
  let r = null;
  for (const s of Kc(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const c = Wc(i, t, n);
    if ((!r || c < r.distance) && (r = { el: s, rect: i, distance: c }), c === 0) break;
  }
  if (!r) return null;
  const { el: o, rect: a } = r;
  return {
    page: o.getAttribute(Pe) || "",
    pane: o.getAttribute(ke) || "",
    fracX: (t - a.left) / a.width,
    fracY: (n - a.top) / a.height,
    clientX: t,
    clientY: n,
    pageWidth: a.width
  };
}
function qc(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function Ia(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${ir()}[${Pe}="${t.page}"][${ke}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (qc(n, e).scrollLeft += a);
}
function Jc(e, t, n, r) {
  const o = e.querySelector(`.${ua}`);
  if (!o) return null;
  if (!o.style.transformOrigin) {
    const a = o.getBoundingClientRect();
    o.style.transformOrigin = `${n - a.left}px ${r - a.top}px`, o.style.willChange = "transform";
  }
  return o.style.transform = `scale(${t})`, o;
}
function Lt(e) {
  e && (e.style.transform = "", e.style.transformOrigin = "", e.style.willChange = "");
}
const Gc = 600, Xc = 1e3;
function Yc(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || Ia(e, t);
  });
  a.observe(n);
  const s = (u) => {
    u.type === "wheel" && u.ctrlKey || l();
  }, i = ["wheel", "keydown", "pointerdown", "touchstart"];
  for (const u of i) r.addEventListener(u, s, { capture: !0, passive: !0 });
  const c = r.setTimeout(() => l(), Xc);
  function l() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(c);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return l;
}
function Zc(e, t, n) {
  const r = x(t);
  r.current = t;
  const o = x(n);
  o.current = n;
  const a = x(null), s = x(null), i = x(null);
  z(() => {
    if (!e) return;
    const c = () => {
      const u = a.current;
      if (a.current = null, !u) return;
      const f = Hc(u.target);
      if (Math.abs(f - r.current) < 5e-3) {
        Lt(u.grid);
        return;
      }
      const d = { anchor: u.anchor, grid: u.grid, fallback: null };
      d.fallback = setTimeout(() => {
        s.current === d && (s.current = null, Lt(d.grid));
      }, Gc), s.current = d, o.current(f, { keepScroll: !1 });
    }, l = (u) => {
      var m, g;
      if (!u.ctrlKey) return;
      u.preventDefault();
      let f = a.current;
      if (!f) {
        (m = i.current) == null || m.call(i), i.current = null;
        const h = s.current;
        h && (h.fallback && clearTimeout(h.fallback), s.current = null, Lt(h.grid)), f = {
          start: r.current,
          target: r.current,
          anchor: Vc(e, u.clientX, u.clientY),
          grid: null,
          timer: null
        }, a.current = f;
      }
      f.target = jc(f.target, u.deltaY, u.deltaMode);
      const d = Uc(f.start, f.target, ((g = f.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      f.grid = Jc(e, d, u.clientX, u.clientY) ?? f.grid, f.timer && clearTimeout(f.timer), f.timer = setTimeout(c, $c);
    };
    return e.addEventListener("wheel", l, { passive: !1 }), () => {
      var f;
      e.removeEventListener("wheel", l);
      const u = a.current;
      a.current = null, u != null && u.timer && clearTimeout(u.timer), Lt((u == null ? void 0 : u.grid) ?? null), (f = i.current) == null || f.call(i), i.current = null;
    };
  }, [e]), xe(() => {
    var l;
    const c = s.current;
    c && (s.current = null, c.fallback && clearTimeout(c.fallback), Lt(c.grid), !(!e || !c.anchor) && (Ia(e, c.anchor), (l = i.current) == null || l.call(i), i.current = Yc(e, c.anchor)));
  }, [t, e]);
}
function Qc(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = x(t), a = x(n), s = x(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: A((c) => {
    c !== o.current && (s.current(), a.current(c));
  }, []) };
}
const cr = 48;
function ka(e, t = cr) {
  return e.getBoundingClientRect().top + t;
}
function Ta(e, t) {
  if (!e.length)
    return null;
  let n = null, r = -1 / 0;
  for (const c of e) {
    const l = c.getBoundingClientRect();
    l.height < 8 || l.width < 8 || l.top <= t + 1 && l.top >= r && (n = c, r = l.top);
  }
  if (!n && (n = e.find((l) => {
    const u = l.getBoundingClientRect();
    return u.height >= 8 && u.width >= 8;
  }) ?? null, n)) {
    const l = [...e].reverse().find((u) => {
      const f = u.getBoundingClientRect();
      return f.height >= 8 && f.width >= 8;
    });
    l && l.getBoundingClientRect().bottom < t && (n = l);
  }
  if (!n)
    return null;
  const o = pn(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function Ht(e, t, n = cr) {
  if (!e)
    return null;
  const r = hn(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = ka(e, n), i = Ta(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function Mt(e, t, n = "auto", r, o = cr) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(hn(a, r))), i || (i = e.querySelector(hn(a))), !i)
    return !1;
  const c = e.getBoundingClientRect(), l = i.getBoundingClientRect();
  if (c.height <= 0 || l.height < 8 && i.offsetHeight < 8)
    return !1;
  const u = l.height > 0 ? l.height : i.offsetHeight, f = e.scrollTop + (l.top - c.top), d = Math.max(0, f + s * u - o);
  return n === "auto" ? Math.abs(e.scrollTop - d) >= 1 && (e.scrollTop = d) : e.scrollTo({ top: d, behavior: n }), !0;
}
function el(e, t, n = "smooth", r) {
  return Mt(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function Un(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const i = [], c = () => {
    var u;
    if (a) return;
    Mt(
      e(),
      t,
      r,
      n == null ? void 0 : n.pane
    ) && !s && (s = !0, (u = n == null ? void 0 : n.onDone) == null || u.call(n));
  };
  for (const l of o)
    l <= 0 ? requestAnimationFrame(() => {
      requestAnimationFrame(c);
    }) : i.push(setTimeout(c, l));
  return () => {
    a = !0;
    for (const l of i)
      clearTimeout(l);
  };
}
function tl(e, t, n) {
  return Un(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function bn(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function We(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function nl(e, t, n = !0, r = "", o) {
  const [a, s] = N(1);
  return z(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const i = e.current;
    if (!i)
      return;
    let c = !1, l = null, u = 0;
    const f = hn(void 0, o), d = () => {
      if (c) return;
      const h = Array.from(i.querySelectorAll(f));
      if (!h.length)
        return;
      const y = ka(i), I = Ta(h, y);
      I && s(I.page);
    }, m = () => {
      c || (u && cancelAnimationFrame(u), u = requestAnimationFrame(() => {
        u = 0, d();
      }));
    }, g = () => {
      if (c) return;
      if (!Array.from(i.querySelectorAll(f)).length) {
        l = setTimeout(g, 120);
        return;
      }
      d(), i.addEventListener("scroll", m, { passive: !0 });
    };
    return g(), () => {
      c = !0, l && clearTimeout(l), u && cancelAnimationFrame(u), i.removeEventListener("scroll", m);
    };
  }, [e, t, n, r, o]), a;
}
const rl = `canvas, .react-pdf__Page, .${fa}, .${mn}`, Kr = /* @__PURE__ */ new WeakMap();
function ol(e) {
  const t = Number(e.getAttribute(ar));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Kr.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(rl), Kr.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function al(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function sl(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(ir()).forEach((r) => {
    const o = pn(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = ol(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function il(e, t, n = "", r) {
  const [o, a] = N(() => /* @__PURE__ */ new Map()), s = x(o), i = x(r);
  return i.current = r, xe(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let c = !1, l = 0, u = !1, f = !1;
    const d = () => {
      var v;
      if (c) return;
      const b = e.current;
      if (!b) return;
      const w = sl(b);
      al(s.current, w) || (s.current = w, a(w)), u && !f && (f = !0, (v = i.current) == null || v.call(i));
    }, m = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(d);
      });
    };
    m();
    const g = window.setTimeout(m, 100), h = window.setTimeout(() => {
      u = !0, m();
    }, 300), y = window.setTimeout(m, 700), I = e.current;
    let S = null;
    return I && typeof ResizeObserver < "u" && (S = new ResizeObserver(() => m()), S.observe(I)), () => {
      c = !0, cancelAnimationFrame(l), window.clearTimeout(g), window.clearTimeout(h), window.clearTimeout(y), S == null || S.disconnect();
    };
  }, [e, t, n]), o;
}
const cl = [0, 48, 140, 320, 560], ll = 700, ul = [80, 200, 400], dl = 500, fl = 50, ml = /* @__PURE__ */ new Set([
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
  "Spacebar",
  "j",
  "k"
]), hl = 180, Wr = [0, 48, 140, 320, 700, 1200];
function pl(e, t) {
  var E;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = x(
    ((E = Je(a)) == null ? void 0 : E.anchor) || { page: 1, fraction: 0 }
  ), c = x(null), l = x(!1), u = x(r), f = x(null), d = x(null), m = x(null), g = x(null), h = x(a), y = x(""), I = x(n);
  I.current = n;
  const S = A(() => {
    var _;
    (_ = f.current) == null || _.call(f), f.current = null, d.current != null && (clearTimeout(d.current), d.current = null);
  }, []), b = A(() => {
    !l.current && c.current == null || (S(), m.current != null && (clearTimeout(m.current), m.current = null), c.current = null, l.current = !1);
  }, [S]), w = A((_ = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const D = () => {
      g.current = null, Sn(h.current, {
        anchor: We(i.current)
      });
    };
    _ ? D() : g.current = setTimeout(D, hl);
  }, []), v = A((_) => {
    i.current = We(_), c.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, l.current = !1;
    }, fl);
  }, []);
  z(() => {
    if (!o)
      return;
    let _ = !1, D = null, $ = null, K = null;
    const H = () => {
      if (_) return;
      const J = e.current;
      if (!J) {
        K = setTimeout(H, 50);
        return;
      }
      D = J, $ = () => {
        if (l.current)
          return;
        const le = Ht(D, I.current);
        le && (i.current = le, w());
      }, D.addEventListener("scroll", $, { passive: !0 }), l.current || $();
    };
    return H(), () => {
      _ = !0, K != null && clearTimeout(K), D && $ && D.removeEventListener("scroll", $);
    };
  }, [o, r, n, e, w]), z(() => {
    if (!o) return;
    const _ = e.current;
    if (!_) return;
    const D = ($) => {
      $.metaKey || $.ctrlKey || $.altKey || ml.has($.key) && b();
    };
    return _.addEventListener("wheel", b, { passive: !0 }), _.addEventListener("touchmove", b, { passive: !0 }), window.addEventListener("keydown", D), () => {
      _.removeEventListener("wheel", b), _.removeEventListener("touchmove", b), window.removeEventListener("keydown", D);
    };
  }, [o, e, b]), xe(() => {
    var D;
    if (h.current === a) return;
    w(!0), S(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, y.current = "";
    const _ = (D = Je(a)) == null ? void 0 : D.anchor;
    i.current = _ ? We(_) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, u.current = r;
  }, [a, r, w, S]), z(() => {
    var D;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const _ = We(
      ((D = Je(a)) == null ? void 0 : D.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = _, c.current = _, l.current = !0, S(), f.current = Un(
      () => e.current,
      _,
      {
        behavior: "auto",
        pane: I.current,
        delaysMs: Wr,
        onDone: () => v(_)
      }
    ), d.current = setTimeout(() => {
      d.current = null, v(_);
    }, Math.max(...Wr) + 160), () => S();
  }, [o, s, a, e, v, S]), z(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, c.current = null, S();
      return;
    }
    const _ = c.current ? We(c.current) : We(i.current);
    return l.current = !0, c.current = _, i.current = _, S(), f.current = Un(
      () => e.current,
      _,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: cl,
        onDone: () => v(_)
      }
    ), d.current = setTimeout(() => {
      d.current = null, v(_);
    }, ll), () => {
      S();
    };
  }, [r, o, n, e, v, S]), z(() => () => {
    S(), m.current != null && (clearTimeout(m.current), m.current = null), w(!0);
  }, [S, w]);
  const R = A(() => {
    const _ = Ht(
      e.current,
      I.current
    );
    return We(_ || i.current);
  }, [e]), C = A(() => {
    l.current = !0;
    const _ = Ht(
      e.current,
      I.current
    ), D = We(_ ?? i.current);
    return i.current = D, c.current = D, w(), D;
  }, [e, w]), M = A((_, D, $) => {
    const K = $ || I.current, H = bn(_, D || 1), J = { page: H, fraction: 0 };
    i.current = J, l.current = !0, c.current = J, w(), S(), el(e.current, H, "smooth", K), f.current = tl(
      () => e.current,
      H,
      {
        behavior: "auto",
        pane: K,
        delaysMs: ul,
        onDone: () => v(J)
      }
    ), d.current = setTimeout(() => {
      d.current = null, v(J);
    }, dl);
  }, [e, v, S, w]), P = A(() => We(i.current), []), T = A(() => l.current, []), k = A(() => {
    if (!l.current || !c.current)
      return;
    const _ = We(c.current);
    Mt(
      e.current,
      _,
      "auto",
      I.current
    );
  }, [e]);
  return {
    lockFromShell: R,
    beginModeSwitch: C,
    goToPage: M,
    getAnchor: P,
    isRestoring: T,
    repinIfRestoring: k
  };
}
function gl(e, t) {
  if (!e) return null;
  if (e.blockId && t) {
    const o = t(e.blockId);
    if (o != null && Number.isFinite(o) && o >= 1)
      return Math.floor(o);
  }
  if (e.pageIdx === null || e.pageIdx === void 0) return null;
  const n = Number(e.pageIdx);
  if (!Number.isFinite(n)) return null;
  const r = Math.floor(n) + 1;
  return r >= 1 ? r : null;
}
function Ea(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const bl = [0, 80, 200, 400, 800], yl = 120, vl = 400;
function wl(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: c, documentId: l, regionsSettled: u = !0 } = e, f = x(a);
  f.current = a;
  const d = x(s);
  d.current = s;
  const m = x(i);
  m.current = i;
  const g = x(n);
  g.current = n, z(() => {
    var w, v;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = Mi(), y = gl(h, d.current);
    if (y == null && (h != null && h.blockId) && !u) return;
    const I = Ea(h, y, { jobId: c, documentId: l });
    if (t.current === I)
      return;
    if (y == null) {
      t.current = I, (w = g.current) == null || w.call(g);
      return;
    }
    t.current = I, h && ((v = m.current) == null || v.call(m, h, y));
    const S = [];
    let b = 0;
    for (const R of bl)
      b = Math.max(b, R), S.push(
        setTimeout(() => {
          f.current(y);
        }, R)
      );
    return S.push(
      setTimeout(() => {
        var R;
        (R = g.current) == null || R.call(g);
      }, b + yl)
    ), () => {
      for (const R of S) clearTimeout(R);
    };
  }, [r, o, c, l, t, u]);
}
function Sl(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function Il(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = vl,
    jobId: i,
    documentId: c,
    applyReaderSearch: l
  } = e, u = x(a);
  u.current = a;
  const f = x(l);
  f.current = l;
  const d = x(0);
  z(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || d.current === o) return;
    const m = setTimeout(() => {
      var I;
      const g = ((I = globalThis.location) == null ? void 0 : I.search) || "", h = Cs(g, o, u.current);
      if (d.current = o, h === null) return;
      const y = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = Ea(
        { blockId: y },
        o,
        { jobId: i, documentId: c }
      ), (f.current || Sl)(h);
    }, s);
    return () => clearTimeout(m);
  }, [
    n,
    r,
    o,
    s,
    i,
    c,
    t
  ]);
}
function kl(e) {
  const t = x(""), [n, r] = N(!1), o = A(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  wl(a, t, o), Il(e, t, n);
}
const Ct = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function Tl(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function Vr(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function Pa(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = Vr(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = Vr(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function El(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = Pa(r, t, n);
  if (o === "retry") return e;
  if (o === "ignore")
    return { ...e, lastSeq: t.seq, connection: "live", error: "" };
  const a = new Map(n.items.map((c) => [c.item_id, c])), s = new Map((r == null ? void 0 : r.changedAtSeqById) || []);
  for (const c of t.changed_item_ids)
    a.has(c) && s.set(c, t.seq);
  const i = new Map(e.pagesByPage);
  return i.set(t.page_idx, {
    attempt: n.attempt,
    generation: n.generation,
    pageHash: n.page_hash,
    itemsById: a,
    changedAtSeqById: s,
    lastEventSeq: t.seq
  }), {
    ...e,
    pagesByPage: i,
    lastSeq: t.seq,
    connection: "live",
    error: ""
  };
}
function Pl(e) {
  const { hasOverlayContent: t, connection: n, showSource: r } = e;
  return {
    topBarPill: t && n !== "terminal",
    // 顶栏 pill 在的时候它就是开关（还带进度），源栏不再另放一颗「译文」：
    // 两颗管同一件事的按钮并排在屏幕上，看着像两个功能。
    sourcePaneToggle: t && r && n === "terminal",
    // 和 resolveReaderPaneComposition 的 overlayOnSource 同一套条件，外加
    // 「源文栏得在台面上」——否则叠层没有落脚的地方。
    overlayRenderable: t && r && e.liveTranslationVisible && !e.assistantOpen
  };
}
function Rl(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function Ml(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function _l(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function Nl(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const qr = [250, 500, 1e3, 2e3, 4e3], Pn = [80, 160, 320, 640, 1e3, 1500], Jr = [250, 500, 1e3, 2e3, 4e3, 5e3];
function Kn(e, t) {
  return new Promise((n, r) => {
    if (t.aborted) {
      r(new DOMException("Aborted", "AbortError"));
      return;
    }
    const o = () => {
      clearTimeout(a), r(new DOMException("Aborted", "AbortError"));
    }, a = setTimeout(() => {
      t.removeEventListener("abort", o), n();
    }, e);
    t.addEventListener("abort", o, { once: !0 });
  });
}
function lr(e) {
  return js(e) ? `${e.code || ""}`.trim() : "";
}
function nn(e, t) {
  const n = lr(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function Al(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (Pa(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
        return c;
      a = Hs(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (c) {
      if ((c == null ? void 0 : c.name) === "AbortError") throw c;
      a = c;
      const l = lr(c);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw c;
    }
    const i = Pn[Math.min(s, Pn.length - 1)];
    if (await Kn(i, r), s >= Pn.length + 2) throw a;
  }
}
function xl({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = N(Ct), s = x(o), i = x("");
  s.current = o;
  const c = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = Wt(l) ? l : "";
  return z(() => {
    if (!n || !c) {
      i.current = "", s.current = Ct, a(Ct);
      return;
    }
    const f = r === void 0 ? Ri() : r, d = i.current === c;
    if (i.current = c, !f) {
      const b = {
        ...d ? s.current : Ct,
        connection: u ? "terminal" : "unavailable",
        jobStatus: l,
        error: "实时译文暂不可用"
      };
      s.current = b, a(b);
      return;
    }
    const m = new AbortController();
    let g = !1;
    const h = {
      ...d ? s.current : Ct,
      connection: u ? "terminal" : "connecting",
      jobStatus: l,
      error: ""
    };
    s.current = h, a(h);
    const y = (b) => {
      m.signal.aborted || a((w) => {
        const v = b(w);
        return s.current = v, v;
      });
    }, I = async () => {
      let b = 0;
      for (; !m.signal.aborted; )
        try {
          const w = await f.fetchLayout(c, { signal: m.signal });
          g = !0, y((v) => ({
            ...v,
            layoutByPage: Tl(w),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (w) {
          if ((w == null ? void 0 : w.name) === "AbortError") return;
          const v = lr(w);
          if (!(v === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !v)) {
            y((C) => ({
              ...C,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: nn(w, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            y((C) => ({
              ...C,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          y((C) => ({
            ...C,
            connection: "connecting",
            jobStatus: l,
            error: nn(w, "正在等待 OCR 版面数据")
          })), await Kn(qr[Math.min(b, qr.length - 1)], m.signal).catch(() => {
          }), b += 1;
        }
    };
    return (async () => {
      if (await I(), !g || m.signal.aborted) return;
      let b = 0;
      for (; !m.signal.aborted; ) {
        u || y((w) => ({
          ...w,
          connection: w.lastSeq > 0 ? "reconnecting" : "connecting",
          jobStatus: l,
          // 保留已有错误：首页还没提交（lastSeq 为 0）时恰恰是最容易出错的阶段，
          // 此前这里把它清成空串，UI 于是一直显示「连接中」，用户看到的是
          // "正在努力"，实际可能已经在反复失败。
          error: w.error
        }));
        try {
          await f.streamEvents(c, {
            afterSeq: s.current.lastSeq,
            signal: m.signal,
            onEvent: async (w) => {
              if (w.seq <= s.current.lastSeq) return;
              let v;
              try {
                v = await Al(
                  c,
                  w,
                  s.current,
                  m.signal,
                  f
                );
              } catch (R) {
                if ((R == null ? void 0 : R.name) === "AbortError" || m.signal.aborted) throw R;
                y((C) => ({
                  ...C,
                  lastSeq: Math.max(C.lastSeq, w.seq),
                  error: nn(R, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((R) => {
                const C = El(R, w, v);
                return u ? {
                  ...C,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...C,
                  jobStatus: l
                };
              }), b = 0;
            }
          });
        } catch (w) {
          if ((w == null ? void 0 : w.name) === "AbortError" || m.signal.aborted) return;
          y((v) => ({
            ...v,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: l,
            error: nn(w, "实时译文连接已中断，正在重连")
          }));
        }
        if (m.signal.aborted) return;
        if (u) {
          y((w) => ({
            ...w,
            connection: "terminal",
            jobStatus: l
          }));
          return;
        }
        await Kn(Jr[Math.min(b, Jr.length - 1)], m.signal).catch(() => {
        }), b += 1;
      }
    })(), () => m.abort();
  }, [n, r, c, u]), o;
}
function Ll(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), c = Number(s.count) || 0;
    i && c > 0 && o.set(i, c);
  }
  return o;
}
function Cl(e, t = !0) {
  const [n, r] = N(() => /* @__PURE__ */ new Map());
  return z(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = nt().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(Ll(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const Dl = 4500;
function $l(e) {
  if (typeof e == "number") {
    const r = Number(e);
    return !Number.isFinite(r) || r < 0 ? null : Math.floor(r) + 1;
  }
  if (!e || typeof e != "object") return null;
  const t = e.page_idx;
  if (t != null && `${t}`.trim() !== "") {
    const r = Number(t);
    return !Number.isFinite(r) || r < 0 ? null : Math.floor(r) + 1;
  }
  const n = e.page;
  if (n != null && `${n}`.trim() !== "") {
    const r = Number(n);
    return !Number.isFinite(r) || r < 1 ? null : Math.floor(r);
  }
  return null;
}
const Ol = /* @__PURE__ */ new Set(["book", "translate"]);
function Ra(e) {
  return !!(e.jobId && e.sourceUrl && Ol.has(e.workflow));
}
function zl(e) {
  return !!(Ra(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function Fl() {
  const e = lc(), t = Ra({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = zl({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = x({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Wt(o) && (r.current.running = !0);
  const a = xl({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = mc(), u = Cl(e.jobId, !e.sourceOnly), f = Nc({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: g } = Dc(e.mode, s, f);
  Zc(i, m, g);
  const h = pc(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: m, shellWidth: c, identityKey: d }
  ), {
    beginModeSwitch: y,
    goToPage: I,
    repinIfRestoring: S
  } = pl(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: h.primaryNumPages > 0
  });
  z(() => {
    S();
  }, [c, S]);
  const b = il(
    s,
    h.compareMode,
    h.rowSyncRevision,
    S
  ), w = nl(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${m}-${h.metricsTick}`,
    h.primaryPane
  ), v = A((H, J) => {
    var ee, ie;
    const le = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((ee = h.numPagesByPane) == null ? void 0 : ee.source) || 0,
      Number((ie = h.numPagesByPane) == null ? void 0 : ie.translated) || 0
    );
    I(H, le, J);
  }, [I, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [R, C] = N(null), M = x(null), P = A((H) => {
    M.current && clearTimeout(M.current), C(H), H && (M.current = setTimeout(() => C(null), Dl));
  }, []);
  z(() => () => {
    M.current && clearTimeout(M.current);
  }, []);
  const T = A((H) => {
    const J = Tn(e.regions, H);
    return J ? Dr(J, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), k = A((H, J) => {
    const le = J || h.primaryPane, ee = typeof H == "object" && H ? `${H.block_id || ""}`.trim() : "", ie = typeof H == "object" && H ? `${H.image_url || ""}`.trim() : "", Se = typeof H == "object" && H ? H.page_idx != null ? Number(H.page_idx) + 1 : H.page != null ? Number(H.page) : null : typeof H == "number" ? H + 1 : null, Z = $s(e.regions, ie, Se) || Tn(e.regions, ee) || (typeof H == "object" ? Os(e.regions, H) : null);
    let de = Z ? Dr(Z, le).page : null;
    de == null && (de = $l(H)), !(de == null || de < 1) && (P(Z), v(de, le));
  }, [P, v, h.primaryPane, e.regions]);
  kl({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: w,
    goToPage: v,
    resolveBlockPage: T,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (H) => {
      P(Tn(e.regions, H.blockId));
    }
  });
  const { setModeKeepingPage: E } = Qc({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: y
  });
  z(() => {
    P(null);
  }, [d, P]);
  const _ = !e.boot.loading && !e.boot.failed, D = W(() => ({ bindShell: l, shellEl: i, shellWidth: c, shellRef: s }), [l, i, c, s]), $ = W(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), K = W(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: m,
    onZoomChange: g,
    shell: D,
    panes: h,
    sessionFiles: $,
    rowHeights: b,
    goToPage: v,
    activeRegion: R,
    jumpToAnchor: k,
    setModeKeepingPage: E,
    download: e.download,
    showHud: _,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, D, h, $, b, v, R, k, E, _, m, g, f, a, n, u]);
  return W(() => ({
    ...K,
    currentPage: w
  }), [K, w]);
}
const Bl = [
  { action: "mode-source", keys: ["1"], mode: "source" },
  { action: "mode-compare", keys: ["2"], mode: "compare" },
  { action: "mode-translated", keys: ["3"], mode: "translated" },
  { action: "zoom-in", keys: ["+", "="] },
  { action: "zoom-out", keys: ["-", "_"] },
  { action: "zoom-reset", keys: ["0"] },
  { action: "next-page", keys: ["j", "ArrowDown", "PageDown"], requiresPages: !0 },
  { action: "prev-page", keys: ["k", "ArrowUp", "PageUp"], requiresPages: !0 },
  { action: "first-page", keys: ["Home"], requiresPages: !0 },
  { action: "last-page", keys: ["End"], requiresPages: !0 },
  { action: "doc-dark", keys: ["d"] }
], jl = [
  {
    title: "翻页",
    items: [
      { actions: ["next-page"], keys: "J · ↓ · PgDn", desc: "下一页" },
      { actions: ["prev-page"], keys: "K · ↑ · PgUp", desc: "上一页" },
      { actions: ["first-page", "last-page"], keys: "Home / End", desc: "首页 / 末页" },
      { actions: [], keys: "点底栏页码", desc: "输入页码跳转" }
    ]
  },
  {
    title: "缩放",
    items: [
      { actions: ["zoom-in", "zoom-out"], keys: "+ / −", desc: "放大 / 缩小" },
      { actions: ["zoom-reset"], keys: "0", desc: "重置为模式默认" },
      { actions: [], keys: "Ctrl + 滚轮 · 触控板捏合", desc: "以鼠标所在处为中心放大 / 缩小" },
      { actions: [], keys: "点百分比", desc: "重置为模式默认" }
    ]
  },
  {
    title: "显示",
    items: [
      { actions: ["doc-dark"], keys: "D", desc: "深色文档（书页黑底白字），再按一次换回来" }
    ]
  },
  {
    title: "搜索",
    items: [
      { actions: [], keys: "⌘F / Ctrl+F", desc: "在书里搜索（光标已在搜索框时再按，用浏览器自己的查找）" },
      { actions: [], keys: "Enter / Shift+Enter", desc: "下一处 / 上一处" },
      { actions: [], keys: "Esc", desc: "收起搜索" }
    ]
  },
  {
    // 画笔、提问这些扩展自己的快捷键由扩展登记（快捷键说明里排在这几组后面）。
    title: "右键",
    items: [
      { actions: [], keys: "Shift+右键", desc: "浏览器自己的右键菜单" }
    ]
  },
  {
    title: "待处理",
    items: [
      { actions: [], keys: "N / Shift+N", desc: "跳到下一处 / 上一处要看一眼的段落（底栏「待处理」）" }
    ]
  },
  {
    title: "模式",
    items: [
      { actions: ["mode-source"], keys: "1", desc: "原文" },
      { actions: ["mode-compare"], keys: "2", desc: "对照" },
      { actions: ["mode-translated"], keys: "3", desc: "译文" }
    ]
  },
  {
    title: "改译文",
    items: [
      { actions: [], keys: "E", desc: "改鼠标停着的那一段" },
      { actions: [], keys: "Alt+↑ / Alt+↓", desc: "改上一段 / 下一段" },
      { actions: [], keys: "⌘Enter / Ctrl+Enter", desc: "保存" }
    ]
  }
];
function Hl(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of Bl)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Ul(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const Kl = ".reader-notes-panel";
function Wl(e) {
  return e instanceof Element ? !!e.closest(Kl) : !1;
}
function Vl(e) {
  const {
    mode: t,
    sourceOnly: n,
    setMode: r,
    userZoom: o,
    onZoomChange: a,
    currentPage: s,
    numPages: i,
    goToPage: c,
    toggleDocDark: l,
    enabled: u = !0
  } = e;
  z(() => {
    if (!u)
      return;
    const f = (d) => {
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || Ul(d.target) || Wl(d.target))
        return;
      const m = d.key, g = Hl(m);
      if (g) {
        if (g.mode) {
          if (n && g.mode !== "source")
            return;
          d.preventDefault(), r(g.mode);
          return;
        }
        if (g.action === "doc-dark") {
          if (!l || d.repeat) return;
          d.preventDefault(), l();
          return;
        }
        if (!(g.requiresPages && i <= 0))
          switch (d.preventDefault(), g.action) {
            case "zoom-in":
              a(qt(o, 1));
              return;
            case "zoom-out":
              a(qt(o, -1));
              return;
            case "zoom-reset":
              a(It(t, Tt()));
              return;
            case "next-page":
              c(bn(s + 1, i));
              return;
            case "prev-page":
              c(bn(s - 1, i));
              return;
            case "first-page":
              c(1);
              return;
            case "last-page":
              c(i);
              return;
          }
      }
    };
    return window.addEventListener("keydown", f), () => window.removeEventListener("keydown", f);
  }, [
    u,
    t,
    n,
    r,
    o,
    a,
    s,
    i,
    c,
    l
  ]);
}
const Te = { size: 16, strokeWidth: 1.75 }, Gr = { size: 12, strokeWidth: 1.75 }, ql = "retainpdf:soft-reader-close";
function Jl() {
  return new URL("./index.html", window.location.href).href;
}
function Gl() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: ql },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Xl(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Yl() {
  if (!(typeof window > "u") && !Gl()) {
    if (Xl(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Jl());
  }
}
function Zl({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function Ql({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ L(Zl, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Yl();
  }, children: [
    /* @__PURE__ */ p(Zo, { className: "reader-close-home-icon", ...Te, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "返回" })
  ] });
}
const eu = 3e3, tu = 8;
async function nu(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function ru(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function ou(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = eu;
  const r = [], o = (s, i, c) => {
    const l = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const f = s[u], d = ru(f == null ? void 0 : f.title);
      if (!d) continue;
      n -= 1;
      const m = c ? `${c}.${u}` : `${u}`, g = { id: m, title: d, page: null, level: i, children: [] };
      r.push({ node: g, dest: f.dest }), l.push(g), i < tu && Array.isArray(f.items) && f.items.length && (g.children = o(f.items, i + 1, m));
    }
    return l;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await nu(e, i);
  })), a;
}
function Ma(e) {
  const t = [], n = (r) => {
    for (const o of r)
      t.push(o), n(o.children);
  };
  return n(e), t;
}
function au(e, t) {
  let n = null;
  for (const r of Ma(e))
    r.page === null || r.page > t || (!n || r.page > (n.page ?? 0) || r.page === n.page && r.id.startsWith(`${n.id}.`)) && (n = r);
  return (n == null ? void 0 : n.id) ?? null;
}
let Xr = !1;
function su() {
  if (Xr)
    return;
  const e = Vt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (ia.GlobalWorkerOptions.workerSrc = e, Xr = !0);
}
const st = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), iu = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, cu = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, lu = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ε",
  varepsilon: "ε",
  zeta: "ζ",
  eta: "η",
  theta: "θ",
  kappa: "κ",
  lambda: "λ",
  mu: "μ",
  nu: "ν",
  xi: "ξ",
  pi: "π",
  rho: "ρ",
  sigma: "σ",
  tau: "τ",
  phi: "φ",
  varphi: "φ",
  chi: "χ",
  psi: "ψ",
  omega: "ω",
  Gamma: "Γ",
  Delta: "Δ",
  Theta: "Θ",
  Lambda: "Λ",
  Xi: "Ξ",
  Pi: "Π",
  Sigma: "Σ",
  Phi: "Φ",
  Psi: "Ψ",
  Omega: "Ω"
}, Yr = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function uu(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Yr(o ?? a ?? "", iu)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Yr(o ?? a ?? "", cu)).replace(/\\([a-zA-Z]+)/gu, (r, o) => lu[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function du(e) {
  return st(e.translatedBlockText) || st(e.translated.text) || st(e.source.text);
}
const fu = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function _a(e) {
  const t = [];
  for (const n of e) {
    if (!fu(n)) continue;
    const r = uu(du(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
const mu = 24, hu = 60;
function Zr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - mu), o = Math.min(e.length, n + t.length + hu), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function pu(e, t, n = 200) {
  const r = st(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = st(a.translatedBlockText) || st(a.translated.text), c = i ? Zr(i, r) : null, l = c ?? Zr(st(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: c ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
function rn(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function zt(e, t) {
  const n = st(t).toLowerCase();
  if (!n || !e) return rn(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${rn(e.slice(a, s))}<mark class="reader-find-mark">${rn(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + rn(e.slice(a));
}
function gu(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const bu = /^data-[a-z0-9-]+$/;
function Qr(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function yu(e, t, n = "") {
  if (!t.length) return zt(e, n);
  const r = t.filter((s) => s.end > s.start && s.start >= 0 && s.end <= e.length).map((s, i) => ({ mark: s, order: i })).sort((s, i) => s.mark.start - i.mark.start || s.order - i.order).map(({ mark: s }) => s);
  let o = "", a = 0;
  for (const s of r) {
    if (s.start < a) continue;
    o += zt(e.slice(a, s.start), n);
    const i = Object.entries(s.attrs ?? {}).filter(([c]) => bu.test(c)).map(([c, l]) => ` ${c}="${Qr(l)}"`).join("");
    o += `<mark class="${Qr(s.className)}"${i}>${zt(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  }
  return o + zt(e.slice(a), n);
}
function Ie(e) {
  return typeof e == "string" ? e : "";
}
function vu(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function wu(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function Su(e) {
  return {
    source: Ie(e == null ? void 0 : e.source_text) || Ie(e == null ? void 0 : e.unit_source_text),
    translated: Ie(e == null ? void 0 : e.protected_translated_text) || Ie(e == null ? void 0 : e.translated_text)
  };
}
const Iu = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function Na(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function ku(e) {
  const t = Na(e).sort((r, o) => Ie(r.ts).localeCompare(Ie(o.ts)));
  return t.length ? [
    { text: Ie(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: Ie(r.new_text),
      label: Iu[Ie(r.source)] || Ie(r.source) || "修订",
      ts: Ie(r.ts),
      reason: Ie(r.reason)
    }))
  ].reverse() : [];
}
function Tu(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Eu(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return Ie(r.finished_at) || Ie(n.finished_at) || "";
}
function Pu(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = Na(e).sort((a, s) => Ie(a.ts).localeCompare(Ie(s.ts)));
  for (const a of o) {
    const s = new Date(Ie(a.ts)).getTime(), i = Ie(a.reader_item_id) || Ie(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, Ie(a.new_text));
  }
  return n;
}
const Ru = {
  empty_translation: "译文是空的",
  math_delimiter_unbalanced: "公式的 $ 或括号不成对",
  unexpected_placeholder: "多出了原文里没有的占位符",
  placeholder_inventory_mismatch: "占位符（公式、引用）和原文对不上，可能删掉或改坏了",
  english_residue: "还留着没翻的英文",
  mixed_english_residue: "中英文混在一起",
  protocol_shell_output: "混进了模型输出的格式标记",
  truncated_translation: "译文像是被截断了",
  context_bleed: "混进了别的段落的内容",
  formula_commands_dropped: "公式里的命令丢了",
  glossary_term_missing: "没用术语表规定的译法"
};
function Mu(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = Ru[Ie(n.kind)] || Ie(n.kind) || "问题", o = Ie(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const _u = /* @__PURE__ */ new Set(["text", "formula"]);
function ur(e) {
  return _u.has(e);
}
function Aa(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || ur(Ue(n));
}
function Nu(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !ur(Ue(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const Au = 300, xu = 72;
function Lu(e, t) {
  if (e.width >= Au && e.height >= xu)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const Cu = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function Du(e, t, n) {
  return e.flatMap((r) => {
    if (!Cu.has(Ue(r.region))) return [];
    const o = gt(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function eo(e, t, n) {
  let r = null, o = Number.POSITIVE_INFINITY;
  for (const a of e) {
    const { rect: s } = a;
    if (t < s.left || t > s.left + s.width || n < s.top || n > s.top + s.height)
      continue;
    const i = s.width * s.height;
    i < o && (r = a, o = i);
  }
  return r;
}
async function $u(e) {
  var n;
  const t = `${e || ""}`;
  if (!t.trim()) return !1;
  try {
    if ((n = navigator.clipboard) != null && n.writeText)
      return await navigator.clipboard.writeText(t), !0;
  } catch {
  }
  try {
    const r = document.createElement("textarea");
    r.value = t, r.setAttribute("readonly", ""), r.style.position = "fixed", r.style.opacity = "0", document.body.appendChild(r), r.select();
    const o = document.execCommand("copy");
    return r.remove(), o;
  } catch {
    return !1;
  }
}
const Ou = "reader-text-hover-copy", zu = "reader-text-hover-edit", Fu = "reader-text-hover-zoom", Bu = "reader-text-hover-id";
function ju(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const xa = "reader-text-hover-tools";
function on({
  className: e,
  state: t,
  label: n,
  title: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p(
    "button",
    {
      type: "button",
      className: e,
      "data-copy-state": t,
      "aria-label": n,
      title: r,
      onPointerDown: (s) => s.stopPropagation(),
      onClick: o,
      children: a
    }
  );
}
const Hu = 26, Uu = 220;
function Ku(e, t = Uu) {
  return e.height < Hu * 2 || e.width < t;
}
function Wu({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? Qo : e === "failed" ? At : Ws, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function Vu({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  onZoom: o,
  frameRect: a,
  placement: s,
  tailTop: i = 0
}) {
  const [c, l] = N("idle"), [u, f] = N("idle"), [d] = N(() => ju()), m = x([]), g = (e == null ? void 0 : e.itemId) || "";
  if (z(() => {
    l("idle"), f("idle");
    const v = m.current;
    return () => {
      v.forEach((R) => window.clearTimeout(R)), m.current = [];
    };
  }, [g]), !e) return null;
  const h = zs(e.highlight.region, t), y = Ue(e.highlight.region), I = (v, R) => async (C) => {
    C.preventDefault(), C.stopPropagation();
    const M = await $u(v);
    R(M ? "copied" : "failed"), m.current.push(window.setTimeout(() => R("idle"), 1200));
  }, S = y === "formula" ? "复制 LaTeX" : "复制", b = a || e.rect, w = s || (Ku(b) ? "outside" : "inside");
  return /* @__PURE__ */ p("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ p(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": y,
      style: b,
      children: /* @__PURE__ */ L(
        "div",
        {
          className: xa,
          "data-placement": w,
          style: w === "tail" ? { top: i } : void 0,
          children: [
            d ? /* @__PURE__ */ p(
              on,
              {
                className: Bu,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: I(e.itemId, f),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && ur(y) ? /* @__PURE__ */ p(
              on,
              {
                className: zu,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (v) => {
                  v.preventDefault(), v.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ p(un, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            h ? /* @__PURE__ */ p(
              on,
              {
                className: Ou,
                state: c,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: c === "copied" ? "已复制" : c === "failed" ? "复制失败" : S,
                onClick: I(h, l),
                children: /* @__PURE__ */ p(Wu, { state: c })
              }
            ) : null,
            o ? /* @__PURE__ */ p(
              on,
              {
                className: Fu,
                state: "idle",
                label: "放大看这一块",
                title: y === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (v) => {
                  v.preventDefault(), v.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ p(Ks, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function qu(e, t) {
  const n = e.page_idx + 1, r = {
    page: n,
    bbox: t.bbox,
    unit: "pdf_point",
    origin: "top_left",
    text: t.source_text
  }, o = {
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
    region: o,
    box: r,
    pageSize: { page: n, width: e.width, height: e.height }
  };
}
function Ju(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = gt(
      qu(e, a),
      n,
      r
    );
    i && o.push({
      itemId: a.item_id,
      translatedText: s.translated_text,
      status: s.status,
      kind: a.kind,
      sourceText: a.source_text,
      typography: a.typography,
      rect: i,
      changedAtSeq: t.changedAtSeqById.get(a.item_id) || 0,
      changedNow: t.changedAtSeqById.get(a.item_id) === t.lastEventSeq
    });
  }
  return o;
}
const Gu = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Xu = 256, Dt = /* @__PURE__ */ new Map();
function Yu(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function La(e) {
  const t = `${e || ""}`, { text: n, slots: r } = wi(t, { bareLatex: !0 }), o = Yu(n), a = Si(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = Dt.get(t);
  if (!s && (s = Ii(o, r), Dt.set(t, s), Dt.size > Xu)) {
    const i = Dt.keys().next().value;
    i !== void 0 && Dt.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function Rn(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Ze(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Zu(e, t) {
  const n = e.typography, r = Ze(t) || 1, o = Ze(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = Rn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(s, i * r)), l = Ze(n == null ? void 0 : n.fit_min_font_size_pt), u = Ze(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (l || 5.5) * r), d = Math.max(
    f,
    u ? u * r : o ? o * r : c
  ), m = o ? o * r : c, g = Ze(n == null ? void 0 : n.leading_em), h = [
    Ze(n == null ? void 0 : n.padding_top_pt) || 0,
    Ze(n == null ? void 0 : n.padding_right_pt) || 0,
    Ze(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Ze(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((y) => y * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Gu,
    fontSizePx: Math.max(f, Math.min(d, m)),
    minFontSizePx: f,
    maxFontSizePx: d,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (Rn(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : Rn(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function Qu(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), i = (f) => {
    const d = s.get(f);
    if (d !== void 0) return d;
    const { width: m, height: g } = e(f), h = m <= t + 0.5 && g <= n + 0.5;
    return s.set(f, h), h;
  };
  let c = o, l = a, u = Math.min(r.requestedFontSizePx, l);
  if (i(u)) {
    if (!r.exact) {
      c = u;
      for (let f = 0; f < 6 && l > c; f += 1) {
        const d = (c + l) / 2;
        i(d) ? (u = d, c = d) : l = d;
      }
    }
  } else {
    l = u, u = c;
    for (let f = 0; f < 8 && l > c; f += 1) {
      const d = (c + l) / 2;
      i(d) ? (u = d, c = d) : l = d;
    }
  }
  return Math.max(o, u);
}
const ed = 512, $t = /* @__PURE__ */ new Map();
let Wn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Wn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Wn += 1;
}));
function td(e, t, n, r) {
  return [
    Wn,
    r.fontFamily,
    r.fontWeight,
    r.lineHeight,
    r.textAlign,
    r.minFontSizePx,
    r.maxFontSizePx,
    r.fontSizePx,
    r.exact ? 1 : 0,
    t,
    n,
    e
  ].join("");
}
function Ca({ item: e, pageScale: t }) {
  const n = x(null), r = W(
    () => La(e.translatedText),
    [e.translatedText]
  ), [o, a] = N(r.fallbackHtml), s = W(
    () => Zu(e, t),
    [e, t]
  );
  z(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((d) => {
      f && a(d);
    }), () => {
      f = !1;
    };
  }, [r]), xe(() => {
    const f = n.current;
    if (!f) return;
    const [d, m, g, h] = s.padding, y = Math.max(1, e.rect.width - h - m), I = Math.max(1, e.rect.height - d - g), S = td(o, y, I, s);
    let b = $t.get(S);
    if (b === void 0 && (b = Qu(
      (w) => (f.style.fontSize = `${w}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      y,
      I,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), $t.set(S, b), $t.size > ed)) {
      const w = $t.keys().next().value;
      w !== void 0 && $t.delete(w);
    }
    f.style.fontSize = `${b.toFixed(2)}px`;
  }, [o, e.rect.height, e.rect.width, s]);
  const [i, c, l, u] = s.padding;
  return /* @__PURE__ */ p(
    "div",
    {
      className: `reader-live-translation-item${e.changedNow ? " is-changed" : ""}`,
      "data-live-translation-item": e.itemId,
      "data-live-translation-kind": e.kind,
      "data-live-translation-status": e.status,
      "data-live-translation-typography": s.exact ? "typst" : "fitted",
      style: {
        ...e.rect,
        padding: `${i}px ${c}px ${l}px ${u}px`
      },
      children: /* @__PURE__ */ p(
        "div",
        {
          ref: n,
          className: "reader-live-translation-content",
          style: {
            fontFamily: s.fontFamily,
            fontSize: s.fontSizePx,
            fontWeight: s.fontWeight,
            lineHeight: s.lineHeight,
            textAlign: s.textAlign
          },
          dangerouslySetInnerHTML: { __html: o }
        }
      )
    }
  );
}
function nd({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = W(
    () => Ju(e, t, n, r),
    [r, e, t, n]
  );
  return o.length ? /* @__PURE__ */ p(
    "div",
    {
      className: "reader-live-translation-overlay",
      "data-live-translation-page": e == null ? void 0 : e.page_idx,
      "data-live-translation-generation": t == null ? void 0 : t.generation,
      "aria-hidden": "true",
      children: o.map((a) => /* @__PURE__ */ p(
        Ca,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const rd = Yt(nd);
function od({
  targets: e,
  edits: t,
  width: n,
  excludeId: r
}) {
  const o = e.filter((a) => t.has(a.itemId) && a.itemId !== r);
  return o.length ? /* @__PURE__ */ p("div", { className: "reader-live-translation-overlay reader-edited-overlay", "aria-hidden": "true", children: o.map((a) => {
    const s = a.highlight.pageSize.width;
    return /* @__PURE__ */ L("div", { className: "reader-edited-block", "data-reader-edited-id": a.itemId, children: [
      /* @__PURE__ */ p(
        Ca,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: Ue(a.highlight.region),
            sourceText: a.highlight.box.text || "",
            rect: a.rect,
            changedAtSeq: 0,
            changedNow: !1
          },
          pageScale: s > 0 ? n / s : 1
        }
      ),
      /* @__PURE__ */ p("span", { className: "reader-edited-badge", style: { left: a.rect.left, top: a.rect.top }, children: "待排版" })
    ] }, a.itemId);
  }) }) : null;
}
const ad = Yt(od), Da = 24, ot = Da * 2 + 4, Qe = 24, sd = 4, id = 6, ft = (e) => e.left + e.width, ct = (e) => e.top + e.height;
function Ft(e, t) {
  const n = Math.min(ft(e), ft(t)) - Math.max(e.left, t.left), r = Math.min(ct(e), ct(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const to = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= ft(t) && r >= t.top && r <= ct(t);
}, cd = (e) => e.height > 40 && e.height > e.width * 2.5;
function ld(e, t, n) {
  if (!t.length || e.height < Qe || e.width < n + 8) return null;
  const r = Math.max(...t.map(ct)), o = ft(e) - 4 - n;
  for (const a of [r, ct(e) - 2]) {
    const s = Math.max(e.top, a - Qe), i = { left: o, top: s, width: n, height: Qe };
    if (!t.some((c) => Ft(i, c) > 0)) return s - e.top;
  }
  return null;
}
function ud(e, t) {
  const n = [], r = (a) => {
    const s = Da + sd, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: ft(e), top: i, width: s, height: ot } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: ot } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - Qe - 3, width: ot, height: Qe + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: ct(e), width: ot, height: Qe + 3 } }), r(!0);
  const o = ld(e, t, ot);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: ft(e) - 4 - ot, top: e.top + o, width: ot, height: Qe } }), n;
}
function dd(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((S) => S.width > 0 && S.height > 0 && !cd(S)), i = s.filter((S) => to(S, t)), c = s.filter((S) => !to(S, t)), l = n.filter((S) => S !== t && Ft(S, t) < t.width * t.height * 0.5), u = ud(t, i).filter(({ box: S, overhang: b }) => {
    const w = b ? id : 0;
    return S.left >= -w && ft(S) <= r + w && S.top >= 0 && ct(S) <= o;
  }), f = ({ placement: S, tailTop: b }) => b === void 0 ? { placement: S } : { placement: S, tailTop: b }, d = ({ box: S }) => !c.some((b) => Ft(S, b) > 0), m = u.filter((S) => S.placement !== "tail"), g = m.find((S) => d(S) && !l.some((b) => Ft(S.box, b) > 0));
  if (g) return f(g);
  const h = m.find(d) || u.find((S) => S.placement === "tail" && d(S));
  if (h) return f(h);
  let y = null, I = Number.POSITIVE_INFINITY;
  for (const S of u) {
    const b = c.reduce((w, v) => w + Ft(S.box, v), 0);
    b < I && (y = S, I = b);
  }
  return y ? f(y) : { placement: "outside" };
}
function fd(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - Qe - 3 : ct(r);
  return t >= r.left - 4 && t <= r.left + ot + 4 && n >= a && n <= a + Qe + 3;
}
const Mn = (e) => e.left + e.width, _n = (e) => e.top + e.height;
function md(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const l of t) {
    if (l.width <= 0 || l.height <= 0) continue;
    const u = l.left + l.width / 2, f = l.top + l.height / 2;
    u < e.left || u > Mn(e) || f < e.top || f > _n(e) || (o = Math.min(o, l.left), a = Math.min(a, l.top), s = Math.max(s, Mn(l)), i = Math.max(i, _n(l)));
  }
  if (!Number.isFinite(o)) return e;
  const c = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return c.width = Math.min(Mn(e) + r, s + n) - c.left, c.height = Math.min(_n(e) + r, i + n) - c.top, c.width * c.height < e.width * e.height * 0.3 && c.height < 24 ? e : c;
}
function hd(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function pd(e, t, n, r) {
  const [o, a] = N(null);
  return xe(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? hd(s) : [], c = Ue(t.highlight.region) === "figure", l = i.length && !c ? md(t.rect, i) : t.rect, u = n.filter((d) => d.itemId !== t.itemId).map((d) => d.rect), f = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...dd({ frame: l, others: u, pageWidth: r, pageHeight: f, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
function gd({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = N(null), [i, c] = N(!1), [l, u] = N([]), [f, d] = N(""), [m, g] = N(""), [h, y] = N(!1), [I, S] = N(null), [b, w] = N([]), v = r.drafts, R = r.generation, C = A(async (k, E) => {
    if (e)
      try {
        u(ku(await e.fetchRevisions(k, E)));
      } catch {
        u([]);
      }
  }, [e]);
  z(() => {
    if (s(null), u([]), S(null), w([]), g(""), !e || !t || !n) return;
    let k = !1;
    return c(!0), e.loadItem(t, n).then((E) => {
      if (k) return;
      const _ = E == null ? void 0 : E.item;
      if (!_) throw new Error("找不到这一段的译文。");
      const D = `${(E == null ? void 0 : E.item_id) || n}`, { source: $, translated: K } = Su(_);
      s({ readerItemId: n, itemId: D, source: $, current: K }), d(v.get(n) ?? K);
    }).catch((E) => {
      k || S({ tone: "error", message: (E == null ? void 0 : E.message) || "读取这段译文失败。" });
    }).finally(() => {
      k || c(!1);
    }), C(t, n), () => {
      k = !0;
    };
  }, [e, t, n, C]);
  const M = A((k) => {
    d(k), n && v.set(n, k);
  }, [n, v]), P = A(async (k, E) => {
    if (!e || !a || h) return !1;
    const _ = k ?? f;
    if (!_.trim()) return !1;
    y(!0), S(null), w([]);
    try {
      const D = await e.revise(t, a.itemId, {
        translated_text: _,
        source: "user",
        reason: (E ?? m).trim() || "在阅读页手动修改",
        ...R.current != null ? { expected_generation: R.current } : {}
      }), $ = Number(D == null ? void 0 : D.generation);
      return Number.isFinite($) && (R.current = $), v.delete(a.readerItemId), s({ ...a, current: _ }), d(_), g(""), (D == null ? void 0 : D.changed) === !1 ? S({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, _), S({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), C(t, a.readerItemId), !0;
    } catch (D) {
      const $ = D;
      return ($ == null ? void 0 : $.reason) === "generation_mismatch" && (R.current = null), S({ tone: "error", message: ($ == null ? void 0 : $.message) || "保存失败，请稍后再试。" }), w(Mu($ == null ? void 0 : $.issues)), !1;
    } finally {
      y(!1);
    }
  }, [e, a, h, f, m, t, o, C, v, R]), T = A(() => {
    n && v.delete(n);
  }, [n, v]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: l,
    draft: f,
    setDraft: M,
    reason: m,
    setReason: g,
    saving: h,
    status: I,
    issues: b,
    save: P,
    discardDraft: T
  };
}
const $a = "reader-inline-edit";
function bd({ text: e }) {
  const [t, n] = N("");
  return z(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = La(e);
      n(a.fallbackHtml), a.richHtml.then((s) => {
        r && n(s);
      });
    }, 250);
    return () => {
      r = !1, window.clearTimeout(o);
    };
  }, [e]), t ? /* @__PURE__ */ L("div", { className: "reader-inline-edit-preview", "data-inline-edit-preview": "true", children: [
    /* @__PURE__ */ p("span", { className: "reader-inline-edit-preview-label", children: "预览" }),
    /* @__PURE__ */ p("div", { className: "reader-live-translation-content", dangerouslySetInnerHTML: { __html: t } })
  ] }) : null;
}
function yd({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var T;
  const s = e.itemId, i = gd({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = N(!1), [u, f] = N(!1), d = x(null), m = Lu(e.rect, t), g = W(() => Nu(o), [o]), h = g.indexOf(s), { loaded: y } = i, I = i.saving || i.loading, S = n.blockedReason, b = !y || i.draft === y.current, { close: w, select: v } = n, R = A((k) => {
    const E = g[h + k];
    E && (v(E), a == null || a(E));
  }, [g, h, v, a]), C = A(() => {
    i.discardDraft(), w();
  }, [i, w]), M = A(async (k, E) => {
    await i.save(k, E) && w();
  }, [i, w]);
  z(() => {
    const k = (E) => {
      !E.altKey || E.key !== "ArrowUp" && E.key !== "ArrowDown" || (E.preventDefault(), R(E.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", k), () => window.removeEventListener("keydown", k);
  }, [R]), xe(() => {
    const k = d.current;
    if (!k) return;
    k.style.height = "auto";
    const E = m.mode === "inline" ? m.minHeight : 0;
    k.style.height = `${Math.max(E, k.scrollHeight + 2)}px`;
  }, [i.draft, y, m.mode, m.mode === "inline" ? m.minHeight : 0]);
  const P = m.mode === "inline" ? { left: m.left, top: m.top, width: m.width } : { left: m.left, width: m.width, top: m.top, bottom: m.bottom };
  return /* @__PURE__ */ L($e, { children: [
    m.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ L(
      "div",
      {
        className: `${$a} is-${m.mode}`,
        style: P,
        role: "group",
        "aria-label": `改第 ${((T = n.target) == null ? void 0 : T.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": m.mode,
        onPointerDown: (k) => k.stopPropagation(),
        children: [
          r && (y != null && y.source) ? /* @__PURE__ */ p(
            oe,
            {
              className: `reader-inline-edit-source${c ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: c ? "收起原文" : "展开原文",
              onClick: () => l((k) => !k),
              children: y.source
            }
          ) : null,
          S ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: S }) : null,
          i.loading ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          y ? /* @__PURE__ */ p(
            gi,
            {
              ref: d,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: I || !!S,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (k) => i.setDraft(k.target.value),
              onKeyDown: (k) => {
                k.key === "Enter" && (k.metaKey || k.ctrlKey) ? (k.preventDefault(), b || M()) : k.key === "Escape" && (k.preventDefault(), C());
              }
            }
          ) : null,
          y ? /* @__PURE__ */ p(bd, { text: i.draft }) : null,
          /* @__PURE__ */ L("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(ut, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => R(-1), children: /* @__PURE__ */ p(Vs, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(ut, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= g.length - 1, onClick: () => R(1), children: /* @__PURE__ */ p(dn, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              or,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: I || !!S || !y,
                onChange: (k) => i.setReason(k.target.value),
                onKeyDown: (k) => {
                  k.key === "Enter" ? (k.preventDefault(), b || M()) : k.key === "Escape" && (k.preventDefault(), C());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ L(
              oe,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": u,
                "data-block-edit-action": "history",
                onClick: () => f((k) => !k),
                children: [
                  /* @__PURE__ */ p(qs, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ p(oe, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: C, children: "取消" }),
            /* @__PURE__ */ p(
              oe,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: I || !!S || b || !i.draft.trim(),
                pending: i.saving,
                onClick: () => {
                  M();
                },
                children: "保存"
              }
            )
          ] }),
          i.status ? /* @__PURE__ */ p("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ p("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((k) => /* @__PURE__ */ p("li", { children: k }, k)) }) : null,
          u && y && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((k, E) => {
            const _ = k.text === y.current, D = [Tu(k.ts), k.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ L("li", { "data-block-edit-history": k.label, "data-current": _ ? "true" : void 0, children: [
              /* @__PURE__ */ L("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ L("span", { children: [
                  D,
                  _ ? "（现在用的）" : "",
                  k.reason ? ` · ${k.reason}` : ""
                ] }),
                _ ? null : /* @__PURE__ */ p(
                  oe,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: I || !!S,
                    onClick: () => {
                      M(k.text, `回到「${D.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ p("p", { className: "reader-inline-edit-history-text", children: k.text })
            ] }, `${k.ts}:${E}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const Oa = Zt(null), za = Zt(null);
function vd({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(Oa.Provider, { value: e, children: /* @__PURE__ */ p(za.Provider, { value: t, children: n }) });
}
function Ge() {
  return dt(Oa);
}
function dr() {
  return dt(za);
}
const Fa = 1.414;
function wd({
  pageNumber: e,
  width: t,
  devicePixelRatio: n,
  pane: r,
  active: o = !1,
  textLayer: a = !0,
  syncedMinHeight: s = 0,
  onMetrics: i,
  cachedAspect: c,
  onAspectChange: l,
  sentinelRef: u,
  regionHighlight: f = null,
  regionTargets: d = [],
  hoveredRegionId: m,
  onHoverRegion: g,
  liveTranslationLayout: h,
  liveTranslationPage: y,
  showLiveTranslation: I = r === "source",
  liveTranslationMissing: S = !1
}) {
  var Q, ge;
  const b = Ge(), w = b == null ? void 0 : b.revisedBlocks, v = b == null ? void 0 : b.blockEdit, R = v == null ? void 0 : v.pendingEdits, C = b == null ? void 0 : b.editBlock, M = (b == null ? void 0 : b.findTerm) || "", P = r === "translated" ? "translated" : b != null && b.compareVersion ? "compare" : "source", T = b == null ? void 0 : b.textMarks, k = W(
    () => T ? ({ str: F }) => yu(F, T(F), M) : M ? ({ str: F }) => zt(F, M) : void 0,
    [M, T]
  ), E = x(c ?? Fa), [_, D] = N(E.current);
  z(() => {
    c != null && Math.abs(c - E.current) >= 1e-3 && (E.current = c, D(c));
  }, [c]);
  const $ = x(u);
  $.current = u;
  const K = x(null), H = x((F) => {
    var te;
    K.current = F, (te = $.current) == null || te.call($, F);
  }).current, J = x(null), le = x(`${t}@${n}`);
  xe(() => {
    const F = `${t}@${n}`;
    le.current !== F && (le.current = F, o && Id(K.current, J.current));
  }, [o, n, t]), z(() => {
    o || Nn(J.current);
  }, [o]), z(() => () => Nn(J.current), []);
  const ee = Math.max(120, Math.floor(t * _)), ie = Math.max(ee, Math.ceil(s || 0)), Se = gt(f, t, ee), Z = W(
    () => Du(d, t, ee),
    [ee, d, t]
  ), [de, Le] = N(null), ae = typeof g == "function", fe = ae ? m ?? null : de, B = (F) => {
    ae ? F !== (m ?? null) && (g == null || g(F)) : Le((te) => te === F ? te : F);
  }, U = W(
    () => Z.find((F) => F.itemId === fe) || null,
    [fe, Z]
  ), G = r === "translated" && ((Q = v == null ? void 0 : v.target) == null ? void 0 : Q.itemId) || "", se = W(
    () => G && Z.find((F) => F.itemId === G) || null,
    [G, Z]
  ), ne = pd(K, o ? U : null, Z, t), me = (F) => {
    var _e, Be, ze, Ne;
    if (F.pointerType === "touch") return;
    if (b != null && b.pointerTaken) {
      B(null);
      return;
    }
    if (F.buttons !== 0) {
      B(null);
      return;
    }
    if ((Be = (_e = F.target) == null ? void 0 : _e.closest) != null && Be.call(_e, `.${xa}`) || (Ne = (ze = F.target) == null ? void 0 : ze.closest) != null && Ne.call(ze, `.${$a}`)) return;
    const te = F.currentTarget.getBoundingClientRect(), he = F.clientX - te.left, Oe = F.clientY - te.top;
    if (fd(ne, he, Oe)) return;
    const Ce = eo(Z, he, Oe);
    B((Ce == null ? void 0 : Ce.itemId) || null);
  }, we = (F) => {
    if (F.pointerType === "mouse") return;
    const te = F.currentTarget.getBoundingClientRect(), he = eo(
      Z,
      F.clientX - te.left,
      F.clientY - te.top
    );
    B((he == null ? void 0 : he.itemId) || null);
  }, re = (F) => {
    !Number.isFinite(F) || F <= 0 || Math.abs(E.current - F) < 1e-3 || (E.current = F, D(F), l == null || l(e, F));
  };
  return /* @__PURE__ */ L(
    "div",
    {
      ref: H,
      [Pe]: e,
      [ke]: r,
      [ar]: ee,
      className: sr,
      onPointerMoveCapture: me,
      onPointerDown: we,
      onDoubleClick: (F) => {
        const te = b == null ? void 0 : b.zoomBlock;
        !te || b != null && b.pointerTaken || !U || Ue(U.highlight.region) === "figure" && (F.preventDefault(), te(U.itemId));
      },
      onPointerLeave: (F) => {
        F.pointerType === "mouse" && B(null);
      },
      style: {
        width: t,
        height: ie,
        minHeight: ie
      },
      children: [
        o ? /* @__PURE__ */ p(
          yi,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: k,
            renderAnnotationLayer: !1,
            className: fa,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: mn,
                style: { width: t, height: ee }
              }
            ),
            onLoadSuccess: (F) => {
              try {
                const te = F.getViewport({ scale: 1 });
                if (te.width > 0) {
                  const he = te.height / te.width;
                  re(he);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              Nn(J.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ p(
          "div",
          {
            className: mn,
            style: { width: t, height: ee },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: J, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        Se ? /* @__PURE__ */ p(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: Se,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && I ? /* @__PURE__ */ p(
          rd,
          {
            layoutPage: h,
            pageState: y,
            width: t,
            height: ee
          }
        ) : null,
        o && I && S ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (R != null && R.size) ? /* @__PURE__ */ p(ad, { targets: Z, edits: R, width: t, excludeId: se == null ? void 0 : se.itemId }) : null,
        o && se && v ? /* @__PURE__ */ p(
          yd,
          {
            target: se,
            page: { width: t, height: ee },
            edit: v,
            showSource: !!(b != null && b.editShowsSource),
            regions: b == null ? void 0 : b.regions,
            jumpToBlock: b == null ? void 0 : b.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (w != null && w.size) ? /* @__PURE__ */ p("div", { className: "reader-revised-markers", "aria-hidden": "true", children: Z.filter((F) => w.has(F.itemId)).map((F) => /* @__PURE__ */ p(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": F.itemId,
            style: { left: F.rect.left, top: F.rect.top, height: F.rect.height }
          },
          F.itemId
        )) }) : null,
        (ge = b == null ? void 0 : b.pageLayers) == null ? void 0 : ge.map((F) => /* @__PURE__ */ p(yn, { children: F.render({ page: e, width: t, height: ee, pane: P, active: o }) }, F.id)),
        /* @__PURE__ */ p(
          Vu,
          {
            target: o && !(b != null && b.pointerTaken) && (U == null ? void 0 : U.itemId) !== (se == null ? void 0 : se.itemId) ? U : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: U && (w == null ? void 0 : w.get(U.itemId)) || 0,
            onEdit: C,
            onZoom: b == null ? void 0 : b.zoomBlock,
            frameRect: ne == null ? void 0 : ne.rect,
            placement: ne == null ? void 0 : ne.placement,
            tailTop: ne == null ? void 0 : ne.tailTop
          }
        )
      ]
    }
  );
}
const Sd = Yt(wd);
function Id(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function Nn(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const kd = 2 * 1024 * 1024;
function Td(e) {
  const t = new ia.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const An = 5, Ed = "120% 0px", Pd = 120, Rd = "25% 0px";
let no = 1;
const ro = /* @__PURE__ */ new WeakMap();
function Md(e) {
  if (!e) return 0;
  const t = ro.get(e);
  if (t) return t;
  const n = no;
  return no += 1, ro.set(e, n), n;
}
function _d() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Nd = Rs(
  function({
    pane: t,
    url: n = "",
    preloadedFile: r = null,
    userZoom: o = 1,
    visible: a = !0,
    emptyLabel: s = "暂无 PDF",
    scrollRoot: i = null,
    pageWidthOverride: c = null,
    rowHeights: l,
    onMetrics: u,
    onLoadSuccess: f,
    onOutline: d,
    onDocument: m,
    onLoadError: g,
    onNumPagesChange: h,
    activeRegion: y = null,
    regions: I = [],
    readerMetadata: S = null,
    hoveredRegionId: b = null,
    onHoverRegion: w,
    liveTranslation: v,
    showLiveTranslation: R = t === "source",
    liveTranslationPendingLabel: C = "",
    paneAction: M
  }, P) {
    su();
    const { file: T, loading: k, error: E } = rc(n, r), _ = `${n}\0${Md(T)}`, D = x(_);
    D.current = _;
    const $ = W(() => {
      const O = Yi(T);
      return O ? "ranged" in O ? { range: Td(O.ranged) } : O : null;
    }, [T, n]), [K, H] = N(0), [J, le] = N(""), [ee, ie] = N(null), [Se, Z] = N(480), de = x(null), Le = x(0), ae = W(() => _d(), []), fe = W(() => ({
      cMapUrl: Vt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: Vt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: kd,
      disableAutoFetch: !0
    }), []);
    rr(P, () => ee, [ee]), z(() => {
      const O = (Y) => {
        Le.current = Y, Z(Y);
      }, V = (Y) => {
        const be = Ec(Y, Le.current);
        if (be !== "ignore") {
          if (de.current && clearTimeout(de.current), be === "immediate") {
            O(Y);
            return;
          }
          de.current = setTimeout(() => O(Y), ba);
        }
      }, X = !!(c && c >= 80);
      V(X ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const ye = !X && i && typeof ResizeObserver < "u" ? new ResizeObserver((Y) => {
        var be, Ee;
        V(((Ee = (be = Y[0]) == null ? void 0 : be.contentRect) == null ? void 0 : Ee.width) ?? i.clientWidth);
      }) : null;
      return ye && i && ye.observe(i), () => {
        ye == null || ye.disconnect(), de.current && clearTimeout(de.current);
      };
    }, [c, i, a]);
    const B = W(
      () => Ic(Se, o),
      [Se, o]
    ), [U, G] = N(() => /* @__PURE__ */ new Map()), [se, ne] = N(() => /* @__PURE__ */ new Set()), [me, we] = N(() => /* @__PURE__ */ new Set()), re = x(/* @__PURE__ */ new Map()), Q = x(null), ge = x(null), [F, te] = N(() => /* @__PURE__ */ new Set()), he = x(/* @__PURE__ */ new Map()), Oe = A((O, V) => {
      G((X) => {
        if (X.get(O) === V) return X;
        const ce = new Map(X);
        return ce.set(O, V), ce;
      });
    }, []), Ce = A((O, V) => {
      const X = re.current, ce = X.get(O), ye = [Q.current, ge.current];
      if (ce)
        for (const Y of ye)
          try {
            Y == null || Y.unobserve(ce);
          } catch {
          }
      if (V) {
        X.set(O, V);
        for (const Y of ye)
          try {
            Y == null || Y.observe(V);
          } catch {
          }
      } else
        X.delete(O);
    }, []), _e = x(/* @__PURE__ */ new Map()), Be = A((O) => {
      const V = _e.current;
      let X = V.get(O);
      return X || (X = (ce) => Ce(O, ce), V.set(O, X)), X;
    }, [Ce]);
    z(() => {
      if (typeof IntersectionObserver > "u") return;
      const O = he.current, V = new IntersectionObserver(
        (X) => {
          const ce = [], ye = [];
          for (const Y of X) {
            const be = Y.target, Ee = pn(be);
            Number.isFinite(Ee) && (Y.isIntersecting ? ce : ye).push(Ee);
          }
          if ((ce.length || ye.length) && ne((Y) => {
            let be = null;
            for (const Ee of ce)
              Y.has(Ee) || (be = be || new Set(Y), be.add(Ee));
            for (const Ee of ye)
              Y.has(Ee) && (be = be || new Set(Y), be.delete(Ee));
            return be || Y;
          }), ce.length) {
            for (const Y of ce) {
              const be = O.get(Y);
              be && (clearTimeout(be), O.delete(Y));
            }
            we((Y) => {
              let be = null;
              for (const Ee of ce)
                Y.has(Ee) || (be = be || new Set(Y), be.add(Ee));
              return be || Y;
            });
          }
          for (const Y of ye)
            O.has(Y) || O.set(Y, setTimeout(() => {
              O.delete(Y), we((be) => {
                if (!be.has(Y)) return be;
                const Ee = new Set(be);
                return Ee.delete(Y), Ee;
              });
            }, Pd));
        },
        { root: i, rootMargin: Ed, threshold: 0 }
      );
      Q.current = V;
      for (const X of re.current.values())
        try {
          V.observe(X);
        } catch {
        }
      return () => {
        V.disconnect(), Q.current === V && (Q.current = null);
        for (const X of O.values()) clearTimeout(X);
        O.clear();
      };
    }, [i]), z(() => {
      if (typeof IntersectionObserver > "u") return;
      const O = new IntersectionObserver(
        (V) => {
          te((X) => {
            let ce = null;
            for (const ye of V) {
              const Y = pn(ye.target);
              !Number.isFinite(Y) || ye.isIntersecting === X.has(Y) || (ce = ce || new Set(X), ye.isIntersecting ? ce.add(Y) : ce.delete(Y));
            }
            return ce || X;
          });
        },
        { root: i, rootMargin: Rd, threshold: 0 }
      );
      ge.current = O;
      for (const V of re.current.values())
        try {
          O.observe(V);
        } catch {
        }
      return () => {
        O.disconnect(), ge.current === O && (ge.current = null);
      };
    }, [i]);
    const ze = !!i && typeof IntersectionObserver < "u";
    xe(() => {
      H(0), le(""), ne(/* @__PURE__ */ new Set()), we(/* @__PURE__ */ new Set()), G(/* @__PURE__ */ new Map()), re.current.clear();
      const O = he.current;
      for (const V of O.values()) clearTimeout(V);
      O.clear(), h == null || h(0, t);
    }, [_, h, t]);
    const Ne = A(
      (O) => {
        if (D.current !== _) return;
        const V = O.numPages;
        H(V), le(""), h == null || h(V, t), f == null || f({ numPages: V, pane: t }), m && typeof O.getPage == "function" && m(O, t), d && typeof O.getOutline == "function" && ou(O).then((X) => {
          D.current === _ && d(X, t);
        }, () => {
        });
      },
      [_, f, d, m, h, t]
    ), Ke = A(
      (O) => {
        if (D.current !== _) return;
        const V = (O == null ? void 0 : O.message) || "PDF 解析失败";
        le(V), H(0), h == null || h(0, t), g == null || g(O, t);
      },
      [_, g, h, t]
    ), De = W(
      () => K > 0 ? Array.from({ length: K }, (O, V) => V + 1) : [],
      [K]
    );
    z(() => {
      typeof IntersectionObserver < "u" || we(new Set(De));
    }, [De]);
    const Fe = W(
      () => Rt(y, S, t),
      [y, S, t]
    ), j = W(() => {
      const O = /* @__PURE__ */ new Map();
      for (const V of I) {
        const X = Rt(V, S, t);
        if (!X) continue;
        const ce = O.get(X.box.page) || [];
        ce.push(X), O.set(X.box.page, ce);
      }
      return O;
    }, [t, S, I]), q = W(() => {
      const O = /* @__PURE__ */ new Set();
      if (!b) return O;
      for (const [V, X] of j)
        X.some((ce) => ce.itemId === b) && O.add(V);
      return O;
    }, [b, j]), ue = W(() => {
      if (K === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(De);
      if (se.size === 0) {
        const X = Math.min(K, An * 2 + 1);
        return new Set(Array.from({ length: X }, (ce, ye) => ye + 1));
      }
      const V = /* @__PURE__ */ new Set();
      for (const X of se)
        for (let ce = -An; ce <= An; ce++) {
          const ye = X + ce;
          ye >= 1 && ye <= K && V.add(ye);
        }
      return V;
    }, [K, De, i, a, se]), ve = !n || !!E || !!J, Re = n && (E || J) || s;
    return /* @__PURE__ */ L(
      "section",
      {
        ref: ie,
        className: `reader-panel ${wn}${a ? "" : " is-hidden"}`,
        [ke]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (v == null ? void 0 : v.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          M ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: M }) : null,
          C ? /* @__PURE__ */ L("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: C })
          ] }) : null,
          ve && !k ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: Re }) : null,
          k ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          $ && !E ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            vi,
            {
              file: $,
              loading: null,
              error: null,
              options: fe,
              onLoadSuccess: Ne,
              onLoadError: Ke,
              className: "reader-react-pdf-document",
              children: De.map((O) => {
                if (ue.has(O))
                  return /* @__PURE__ */ p(
                    Sd,
                    {
                      pane: t,
                      pageNumber: O,
                      width: B,
                      devicePixelRatio: ae,
                      active: me.has(O),
                      textLayer: !ze || F.has(O),
                      syncedMinHeight: (l == null ? void 0 : l.get(O)) || 0,
                      onMetrics: u,
                      cachedAspect: U.get(O),
                      onAspectChange: Oe,
                      sentinelRef: Be(O),
                      regionHighlight: (Fe == null ? void 0 : Fe.box.page) === O ? Fe : null,
                      regionTargets: j.get(O),
                      hoveredRegionId: b && q.has(O) ? b : null,
                      onHoverRegion: w,
                      liveTranslationLayout: v == null ? void 0 : v.layoutByPage.get(O - 1),
                      liveTranslationPage: v == null ? void 0 : v.pagesByPage.get(O - 1),
                      showLiveTranslation: R,
                      liveTranslationMissing: Ml(v, O - 1)
                    },
                    `${t}-${O}`
                  );
                const X = U.get(O) ?? Fa, ce = Math.max(120, Math.floor(B * X)), ye = Math.max(ce, Math.ceil((l == null ? void 0 : l.get(O)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: Be(O),
                    [Pe]: O,
                    [ke]: t,
                    [ar]: ce,
                    className: `${sr} is-placeholder`,
                    style: {
                      width: B,
                      height: ye,
                      minHeight: ye
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: mn,
                        style: { width: B, height: ce },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${O}`
                );
              })
            },
            _
          ) }) : null
        ]
      }
    );
  }
), oo = Yt(Nd), Ad = 2e3, xd = 6, Ld = 500, ao = "reader-react-resizing";
function Cd(e, t) {
  const n = x(null), r = x(null);
  xe(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const w = Dd(e), v = Ht(e, w);
      if (!v) return;
      s = { pane: w, progress: v, started: performance.now() };
    }
    const { pane: i, progress: c, started: l } = s;
    let u = 0, f = null, d = e.scrollHeight, m = d, g = 0, h = l;
    const y = /* @__PURE__ */ new WeakMap(), I = typeof ResizeObserver > "u" ? null : new ResizeObserver((w) => {
      let v = !1;
      for (const R of w) {
        const C = Math.round(R.contentRect.height);
        y.has(R.target) && y.get(R.target) !== C && (v = !0), y.set(R.target, C);
      }
      v && Mt(e, c, "auto", i);
    }), S = () => {
      var w;
      f && clearTimeout(f), cancelAnimationFrame(u), I == null || I.disconnect(), e.classList.remove(ao);
      for (const v of so) e.removeEventListener(v, S);
      ((w = r.current) == null ? void 0 : w.stop) === S && (r.current = null);
    }, b = () => {
      Mt(e, c, "auto", i);
      const w = e.scrollHeight;
      g = w === m ? g + 1 : 0, m = w;
      const v = performance.now() - h;
      g >= xd && (w !== d || v > Ld) || v > Ad ? S() : u = requestAnimationFrame(b);
    };
    for (const w of so) e.addEventListener(w, S, { passive: !0 });
    for (const w of Array.from(e.children)) I == null || I.observe(w);
    e.classList.add(ao), r.current = { ...s, stop: S }, f = setTimeout(() => {
      f = null, h = performance.now(), d = e.scrollHeight, m = d, g = 0, u = requestAnimationFrame(b);
    }, ba);
  }, [e, t]), z(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Dd(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Pe}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(ke) || null;
  }
  return null;
}
const so = ["wheel", "touchstart", "keydown", "pointerdown"];
function $d(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function Od(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(wn)) && ((n = e.hasAttribute) != null && n.call(e, ke)));
}
function zd(e, t) {
  z(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!Od(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${wn}[${ke}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const c = $d(a, i);
        if (c === null || Math.abs(i.scrollLeft - c) < 1) continue;
        const l = i.scrollLeft;
        i.scrollLeft = c, Math.abs(i.scrollLeft - l) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function Fd(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), c = t - i, l = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: c * l };
}
function Bd(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const io = 12;
function fr(e) {
  return Array.from(e.querySelectorAll(`.${wn}[${ke}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function jd(e) {
  const t = e.getBoundingClientRect();
  return fr(e).map((n) => {
    const r = n.getBoundingClientRect();
    return {
      pane: n.getAttribute(ke) || "",
      left: r.left - t.left,
      width: n.clientWidth,
      scrollWidth: n.scrollWidth,
      scrollLeft: n.scrollLeft
    };
  });
}
function Hd(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function Ud(e, t) {
  return e ? fr(e).find((n) => n.getAttribute(ke) === t) ?? null : null;
}
function Kd({ shellEl: e }) {
  const [t, n] = N([]), r = x(0), o = A(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = jd(e);
      n((i) => Hd(i, s) ? i : s);
    }));
  }, [e]);
  z(() => {
    if (!e) return;
    o();
    const s = e.ownerDocument.defaultView;
    e.addEventListener("scroll", o, { capture: !0, passive: !0 });
    const i = s && typeof s.ResizeObserver < "u" ? new s.ResizeObserver(o) : null, c = () => {
      if (i) {
        i.disconnect(), i.observe(e);
        for (const f of fr(e))
          i.observe(f), f.firstElementChild && i.observe(f.firstElementChild);
      }
    };
    c();
    const l = s && typeof s.MutationObserver < "u" ? new s.MutationObserver(() => {
      c(), o();
    }) : null, u = e.firstElementChild;
    return l && u && l.observe(u, { childList: !0, attributes: !0, attributeFilter: ["class"], subtree: !1 }), () => {
      e.removeEventListener("scroll", o, { capture: !0 }), i == null || i.disconnect(), l == null || l.disconnect(), r.current && cancelAnimationFrame(r.current), r.current = 0;
    };
  }, [e, o]);
  const a = t.filter((s) => s.scrollWidth - s.width > 1);
  return a.length ? /* @__PURE__ */ p("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ p(Wd, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function Wd({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - io * 2), r = Fd(e, n), o = x(null);
  if (!r) return null;
  const a = (d) => {
    const m = Ud(t, e.pane);
    m && (m.scrollLeft = d);
  }, s = (d) => {
    var m, g;
    d.button === 0 && (d.preventDefault(), d.stopPropagation(), (g = (m = d.currentTarget).setPointerCapture) == null || g.call(m, d.pointerId), o.current = { startX: d.clientX, startScroll: e.scrollLeft, pointerId: d.pointerId });
  }, i = (d) => {
    const m = o.current;
    !m || m.pointerId !== d.pointerId || a(m.startScroll + Bd(e, n, r.size, d.clientX - m.startX));
  }, c = (d) => {
    var m, g, h;
    ((m = o.current) == null ? void 0 : m.pointerId) === d.pointerId && (o.current = null, (h = (g = d.currentTarget).releasePointerCapture) == null || h.call(g, d.pointerId));
  }, l = (d) => {
    if (d.button !== 0 || d.target !== d.currentTarget) return;
    d.preventDefault();
    const m = d.currentTarget.getBoundingClientRect(), g = d.clientX - m.left, h = e.width * 0.8;
    a(e.scrollLeft + (g < r.offset ? -h : h));
  }, u = e.pane === "translated" ? "译文栏左右滚动" : "原文栏左右滚动", f = Math.max(0, e.scrollWidth - e.width);
  return /* @__PURE__ */ p(
    "div",
    {
      className: "reader-pane-scrollbar",
      "data-reader-pane-scrollbar": e.pane,
      role: "scrollbar",
      "aria-label": u,
      "aria-orientation": "horizontal",
      "aria-valuemin": 0,
      "aria-valuemax": Math.round(f),
      "aria-valuenow": Math.round(e.scrollLeft),
      style: { left: e.left + io, width: n },
      onPointerDown: l,
      children: /* @__PURE__ */ p(
        "div",
        {
          className: "reader-pane-scrollbar-thumb",
          style: { width: r.size, transform: `translateX(${r.offset}px)` },
          onPointerDown: s,
          onPointerMove: i,
          onPointerUp: c,
          onPointerCancel: c
        }
      )
    }
  );
}
function Ba(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Vd(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function qd({ compare: e, onDone: t }) {
  return /* @__PURE__ */ L("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ p("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ p("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(
        oe,
        {
          className: "reader-version-compare-item",
          "data-version-id": n.versionId,
          "aria-current": o ? "true" : void 0,
          disabled: r,
          onClick: () => {
            e.choose(n.versionId), t();
          },
          children: [
            /* @__PURE__ */ p("span", { className: "reader-version-compare-name", children: n.name }),
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: Ba(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(Qo, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(Js, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ p("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ L("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ L(
        oe,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ p(Gs, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ L(
        oe,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ p(Xs, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function co({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = Vd(t), a = [e === "compare" ? "对比" : "正在读", r, Ba(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ L("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function Jd({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = N({ source: null, translated: null });
  return xe(() => {
    if (!e) return;
    const a = () => {
      const i = e.getBoundingClientRect(), c = (l) => {
        const u = e.querySelector(`[${ke}="${l}"]`), f = u == null ? void 0 : u.getBoundingClientRect();
        return f && f.width > 0 ? { x: Math.round(f.left + f.width / 2), top: Math.round(i.top + 14) } : null;
      };
      o({ source: c("source"), translated: c("translated") });
    };
    a();
    const s = typeof ResizeObserver > "u" ? null : new ResizeObserver(a);
    return s == null || s.observe(e), e.querySelectorAll(`[${ke}]`).forEach((i) => s == null ? void 0 : s.observe(i)), window.addEventListener("resize", a), e.addEventListener("scroll", a, { passive: !0 }), () => {
      s == null || s.disconnect(), window.removeEventListener("resize", a), e.removeEventListener("scroll", a);
    };
  }, [e]), /* @__PURE__ */ L("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(co, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(co, { role: "reading", ...n }) }) : null
  ] });
}
const Gd = () => () => {
}, lo = () => null;
function Xd({
  mode: e,
  compareMode: t,
  showSource: n,
  showTranslated: r,
  markdownSplit: o,
  overlayOnSource: a = !1
}) {
  return { mode: e, compareMode: t, showSource: n, showTranslated: r };
}
function Yd(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function Zd(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Qd(e) {
  const t = Ge(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), d = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Qt, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, I = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, b = (t == null ? void 0 : t.compareVersion) ?? null, w = (b == null ? void 0 : b.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", v = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", R = b ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, C = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, M = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), P = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), T = t == null ? void 0 : t.onPdfOutline, k = t == null ? void 0 : t.onPdfDocument, E = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), _ = e.regions ?? (t == null ? void 0 : t.regions) ?? [], D = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), $ = (t == null ? void 0 : t.regionHover) ?? null, [K, H] = N(null), J = vn(
    $ ? $.subscribe : Gd,
    $ ? () => $.get().itemId : lo,
    $ ? () => $.get().itemId : lo
  ), le = $ ? J : K, ee = A((de) => {
    $ ? $.set(de, "pdf") : H(de);
  }, [$]), ie = Xd({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), Z = Number.isFinite(g) && g > 0 ? Yd(
    g,
    // 对照时两栏分书页区，按书页区算（50% = 一栏）；单栏才按两倍算（50% = 铺满剩下的那一栏）。
    (n || r) && !ie.compareMode,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return Cd(d, Z), zd(d, ie.compareMode), /* @__PURE__ */ L(
    "div",
    {
      ref: f,
      className: da,
      "data-reader-region-count": _.length,
      "data-reader-structured-region-count": _.filter(Fs).length,
      "data-reader-metadata-ready": D ? "true" : "false",
      children: [
        /* @__PURE__ */ L(
          "main",
          {
            className: `${ua} reader-mode-${ie.mode}`,
            "data-reader-mode": ie.compareMode ? s : n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              y ? /* @__PURE__ */ p(
                oo,
                {
                  pane: "source",
                  url: w,
                  preloadedFile: R,
                  userZoom: m,
                  visible: ie.showSource,
                  scrollRoot: d,
                  pageWidthOverride: Z,
                  rowHeights: ie.compareMode ? h : void 0,
                  onMetrics: M,
                  emptyLabel: S ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: P,
                  onOutline: b ? void 0 : T,
                  onDocument: b ? void 0 : k,
                  activeRegion: E,
                  regions: (b == null ? void 0 : b.regions) ?? _,
                  readerMetadata: D,
                  hoveredRegionId: le,
                  onHoverRegion: ee,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? Zd(o) : "",
                  paneAction: u && ie.showTranslated ? /* @__PURE__ */ L($e, { children: [
                    e.sourcePaneAction,
                    /* @__PURE__ */ p(
                      "span",
                      {
                        className: "reader-source-overlay-badge",
                        "data-source-overlay-badge": "true",
                        title: "源栏正在叠加实时译文，右栏为最终译文 PDF",
                        children: "原文+实时译文叠加"
                      }
                    )
                  ] }) : e.sourcePaneAction
                },
                b ? `compare:${b.url}` : "source"
              ) : null,
              I ? /* @__PURE__ */ p(
                oo,
                {
                  pane: "translated",
                  url: v,
                  preloadedFile: C,
                  userZoom: m,
                  visible: ie.showTranslated,
                  scrollRoot: d,
                  pageWidthOverride: Z,
                  rowHeights: ie.compareMode ? h : void 0,
                  onMetrics: M,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: P,
                  onOutline: T,
                  onDocument: k,
                  activeRegion: E,
                  regions: _,
                  readerMetadata: D,
                  hoveredRegionId: le,
                  onHoverRegion: ee,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ p(Kd, { shellEl: d }),
        b ? /* @__PURE__ */ p(Jd, { shellEl: d, left: b.left, right: b.right }) : null
      ]
    }
  );
}
const ef = [
  { id: "source", label: "原文", Icon: ea },
  { id: "compare", label: "对照", Icon: ta },
  { id: "translated", label: "译文", Icon: na }
];
function tf(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function nf(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function rf(e) {
  const t = Ge(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? tf(a.state) : "";
  return /* @__PURE__ */ L("header", { className: "reader-workspace-bar", children: [
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
    /* @__PURE__ */ p("div", { className: "reader-workspace-start", children: e.start }),
    /* @__PURE__ */ L("div", { className: "reader-workspace-center", children: [
      /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: ef.map(({ id: l, label: u, Icon: f }) => {
        const d = n === l, m = nf({
          id: l,
          documentReady: r,
          sourceViewOnly: i,
          liveTranslationAvailable: !!a
        });
        return /* @__PURE__ */ L(yn, { children: [
          /* @__PURE__ */ p(
            "button",
            {
              type: "button",
              className: `reader-workspace-tab${d ? " is-active" : ""}`,
              role: "tab",
              "aria-selected": d,
              "aria-label": u,
              title: m ? `${u} 需要文档任务` : u,
              disabled: m,
              onClick: () => o(l),
              children: /* @__PURE__ */ p(f, { ...Te, "aria-hidden": !0 })
            }
          ),
          l === "compare" ? e.compareExtra : null
        ] }, l);
      }) }),
      a ? /* @__PURE__ */ L("div", { className: "reader-live-strip", children: [
        /* @__PURE__ */ L(
          "button",
          {
            type: "button",
            className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
            "aria-pressed": a.visible,
            "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
            title: a.state.error || `${c}，${a.visible ? "点一下看原文" : "点一下叠上译文"}`,
            onClick: a.onToggle,
            children: [
              /* @__PURE__ */ p(Ys, { ...Te, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: c })
            ]
          }
        ),
        a.latestPage && a.onJumpToLatest && a.latestPage !== a.currentPage ? /* @__PURE__ */ L(
          oe,
          {
            className: "reader-live-translation-toggle reader-live-jump",
            "aria-label": `跳到最新译好的第 ${a.latestPage} 页`,
            title: `跳到最新译好的第 ${a.latestPage} 页`,
            onClick: a.onJumpToLatest,
            children: [
              /* @__PURE__ */ p(Zs, { ...Te, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "跳到最新" })
            ]
          }
        ) : null
      ] }) : s ? /* @__PURE__ */ p("div", { className: "reader-live-strip", children: /* @__PURE__ */ L(
        oe,
        {
          className: "reader-live-translation-toggle is-done",
          title: "翻译完成，左右对照看最终译文",
          onClick: s.onOpenCompare,
          children: [
            /* @__PURE__ */ p(Qs, { ...Te, "aria-hidden": !0 }),
            /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
          ]
        }
      ) }) : null
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-workspace-end", children: e.end })
  ] });
}
const ja = [];
function of() {
  const e = /* @__PURE__ */ new Map(), t = /* @__PURE__ */ new Set();
  let n = ja;
  const r = () => {
    n = [...e].map(([o, a]) => ({ id: o, ...a }));
    for (const o of t) o();
  };
  return {
    set: (o, a, s) => {
      e.set(o, { title: a, contribution: s }), r();
    },
    remove: (o) => {
      e.delete(o) && r();
    },
    subscribe: (o) => (t.add(o), () => t.delete(o)),
    getSnapshot: () => n
  };
}
function af(e, t) {
  const n = [];
  for (const { id: r, contribution: o } of e)
    if (o.menuItems)
      try {
        for (const a of o.menuItems(t)) n.push({ ...a, key: `${r}:${a.key}` });
      } catch (a) {
        console.error(`[reader] 扩展 ${r} 的右键菜单出错`, a);
      }
  return n;
}
function sf(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.pageLayer ? [{ id: t, render: n.pageLayer }] : []);
}
function cf(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.menuSection ? [{ id: t, render: n.menuSection }] : []);
}
function lf(e) {
  var t;
  return ((t = e.find(({ contribution: n }) => n.takesPointer)) == null ? void 0 : t.id) ?? null;
}
function uf(e) {
  const t = e.flatMap(({ id: n, contribution: r }) => r.textMarks ? [{ id: n, marks: r.textMarks }] : []);
  return t.length ? (n) => t.flatMap(({ id: r, marks: o }) => {
    try {
      return [...o(n)];
    } catch (a) {
      return console.error(`[reader] 扩展 ${r} 的文字层标记出错`, a), [];
    }
  }) : null;
}
function df(e) {
  return e.reduce((t, { contribution: n }) => Math.max(t, n.reserveRight || 0), 0);
}
function ff(e) {
  for (const { contribution: t } of e) if (t.comparedDocument) return t.comparedDocument;
  return null;
}
function mf(e) {
  return e.flatMap(({ title: t, contribution: n }) => {
    var r;
    return (r = n.shortcuts) != null && r.length ? [{ title: t, items: n.shortcuts }] : [];
  });
}
const In = Zt(null), Ha = Zt(null);
function hf({ api: e, store: t, children: n }) {
  const r = W(() => ({ api: e, store: t }), [e, t]);
  return /* @__PURE__ */ p(In.Provider, { value: r, children: n });
}
function en() {
  const e = dt(In);
  if (!e) throw new Error("useReaderApi 要在 ReaderExtensionsProvider 里面用");
  return e.api;
}
const pf = () => () => {
}, uo = () => ja;
function gf(e) {
  return vn(e.subscribe, e.getSnapshot, e.getSnapshot);
}
function Ua() {
  var t;
  const e = (t = dt(In)) == null ? void 0 : t.store;
  return vn((e == null ? void 0 : e.subscribe) ?? pf, (e == null ? void 0 : e.getSnapshot) ?? uo, (e == null ? void 0 : e.getSnapshot) ?? uo);
}
function kn(e) {
  var a;
  const t = (a = dt(In)) == null ? void 0 : a.store, n = dt(Ha);
  if (!n) throw new Error("useReaderContribution 只能在扩展组件里用");
  const { id: r, title: o } = n;
  z(() => {
    t == null || t.set(r, o, e);
  }, [t, r, o, e]), z(() => () => t == null ? void 0 : t.remove(r), [t, r]);
}
class bf extends Ms {
  constructor() {
    super(...arguments);
    Ar(this, "state", { failed: !1 });
  }
  static getDerivedStateFromError() {
    return { failed: !0 };
  }
  componentDidCatch(n, r) {
    console.error(`[reader] 扩展 ${this.props.id} 出错，已停用`, n, r.componentStack);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
const yf = Yt(function({ extensions: t }) {
  return /* @__PURE__ */ p($e, { children: t.map(({ id: n, title: r, Component: o }) => /* @__PURE__ */ p(bf, { id: n, children: /* @__PURE__ */ p(vf, { id: n, title: r, children: /* @__PURE__ */ p(o, {}) }) }, n)) });
});
function vf({ id: e, title: t, children: n }) {
  const r = W(() => ({ id: e, title: t }), [e, t]);
  return /* @__PURE__ */ p(Ha.Provider, { value: r, children: n });
}
function wf({
  marks: e,
  page: t,
  height: n,
  onOpen: r
}) {
  const o = e.filter((a) => a.anchor.page === t);
  return o.length ? /* @__PURE__ */ p("div", { className: "reader-ask-marks", "aria-label": "这一页问过的地方", children: o.map((a) => {
    var i;
    const s = a.title || a.anchor.selection || a.anchor.sourceText || `第 ${t} 页`;
    return /* @__PURE__ */ p(
      oe,
      {
        className: "reader-ask-mark",
        style: { top: Math.round((((i = a.anchor.point) == null ? void 0 : i.y) ?? 0) * n) },
        "aria-label": `打开在这里的提问：${s.slice(0, 40)}`,
        title: `在这里问过：${s.slice(0, 80)}`,
        onPointerDown: (c) => c.stopPropagation(),
        onClick: () => r(a),
        children: "?"
      },
      a.key
    );
  }) }) : null;
}
const fo = 6e3;
function Ka(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function Wa(e, t, n, r) {
  const o = e.width * t.width, a = e.height * t.height;
  let s = n * r / Math.max(1, o);
  const i = Math.max(o, a) * s;
  return i > fo && (s *= fo / i), {
    scale: s,
    offsetX: -e.left * t.width * s,
    offsetY: -e.top * t.height * s,
    canvasWidth: Math.max(1, Math.round(o * s)),
    canvasHeight: Math.max(1, Math.round(a * s)),
    /** 显示高度（CSS 像素），按区域的宽高比。 */
    cssHeight: Math.round(n * (a / Math.max(1, o)))
  };
}
function Va({
  pdf: e,
  page: t,
  region: n,
  cssWidth: r,
  className: o,
  label: a
}) {
  const s = x(null), [i, c] = N({ status: "loading", cssHeight: 0 }), l = `${t}:${n.left}:${n.top}:${n.width}:${n.height}:${Math.round(r)}`;
  return z(() => {
    let u = !1, f = null;
    return c((d) => ({ status: "loading", cssHeight: d.cssHeight })), (async () => {
      try {
        const d = await e.getPage(t);
        if (u) return;
        const m = d.getViewport({ scale: 1 }), g = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), h = Wa(n, m, r, g), y = s.current, I = y == null ? void 0 : y.getContext("2d");
        if (!y || !I) return;
        y.width = h.canvasWidth, y.height = h.canvasHeight, c({ status: "loading", cssHeight: h.cssHeight });
        const S = d.getViewport({ scale: h.scale, offsetX: h.offsetX, offsetY: h.offsetY }), b = d.render({ canvasContext: I, viewport: S });
        f = b, await b.promise, u || c({ status: "ready", cssHeight: h.cssHeight });
      } catch (d) {
        !u && (d == null ? void 0 : d.name) !== "RenderingCancelledException" && c((m) => ({ status: "error", cssHeight: m.cssHeight }));
      }
    })(), () => {
      u = !0, f == null || f.cancel();
    };
  }, [e, l]), /* @__PURE__ */ L(
    "div",
    {
      className: `reader-region-canvas${o ? ` ${o}` : ""}`,
      "data-status": i.status,
      style: { width: r, height: i.cssHeight || void 0 },
      children: [
        /* @__PURE__ */ p("canvas", { ref: s, role: "img", "aria-label": a ?? `第 ${t} 页的一块`, style: { width: r, height: i.cssHeight || void 0 } }),
        i.status === "error" ? /* @__PURE__ */ p("p", { className: "reader-region-canvas-error", children: "这一块没画出来。" }) : null
      ]
    }
  );
}
const Sf = 1600, mr = { left: 0, top: 0, width: 1, height: 1 };
function qa(e) {
  return new Promise((t, n) => {
    e.toBlob((r) => r ? t(r) : n(new Error("截图没出来")), "image/png");
  });
}
function If(e, t, n) {
  if (e.width <= 0 || e.height <= 0) return null;
  const r = (l) => Math.min(1, Math.max(0, (l - e.left) / e.width)), o = (l) => Math.min(1, Math.max(0, (l - e.top) / e.height)), a = Math.min(r(t.x), r(n.x)), s = Math.max(r(t.x), r(n.x)), i = Math.min(o(t.y), o(n.y)), c = Math.max(o(t.y), o(n.y));
  return s - a < 0.02 || c - i < 0.02 ? null : { left: a, top: i, width: s - a, height: c - i };
}
async function kf(e, t, n = mr, r = Sf) {
  const o = await e.getPage(t), a = Wa(n, o.getViewport({ scale: 1 }), r, 1), s = document.createElement("canvas");
  s.width = a.canvasWidth, s.height = a.canvasHeight;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.fillStyle = "#fff", i.fillRect(0, 0, s.width, s.height), await o.render({ canvasContext: i, viewport: o.getViewport({ scale: a.scale, offsetX: a.offsetX, offsetY: a.offsetY }) }).promise, qa(s);
}
async function Tf(e, t = mr) {
  const n = Math.round(t.left * e.width), r = Math.round(t.top * e.height), o = Math.max(1, Math.round(t.width * e.width)), a = Math.max(1, Math.round(t.height * e.height)), s = document.createElement("canvas");
  s.width = o, s.height = a;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.drawImage(e, n, r, o, a, 0, 0, o, a), qa(s);
}
function Ef(e, t) {
  return t.left === 0 && t.top === 0 && t.width === 1 && t.height === 1 ? `第${e}页.png` : `第${e}页-截图.png`;
}
const Pf = 4e3;
function Rf(e, t, n) {
  if (e.length) {
    const o = au(e, n), a = o ? Ma(e).find((s) => s.id === o) : null;
    if (a) return a.title;
  }
  let r = null;
  for (const o of t)
    !o.headingLevel || o.source.page > n || (!r || o.source.page >= r.source.page) && (r = o);
  return `${(r == null ? void 0 : r.source.text) || (r == null ? void 0 : r.markdown) || ""}`.replace(/\s+/g, " ").trim().slice(0, 80);
}
function mo(e) {
  var a, s;
  if (!e || e.isCollapsed || !e.rangeCount) return { text: "", element: null, rect: null };
  const t = e.getRangeAt(0), n = t.startContainer, r = ((s = (a = n.nodeType === 1 ? n : n.parentElement) == null ? void 0 : a.closest) == null ? void 0 : s.call(a, `[${Pe}]`)) ?? null;
  return r ? { text: `${e}`.replace(/\s+\n/g, `
`).trim().slice(0, Pf), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function Mf(e, t, n, r, o) {
  let a = null, s = 0.15;
  for (const i of e) {
    const c = Rt(i, t, n);
    if (!c || c.box.page !== r) continue;
    const l = gt(c, 1, 1);
    if (!l) continue;
    const u = o.y < l.top ? l.top - o.y : o.y > l.top + l.height ? o.y - l.top - l.height : 0, f = o.x < l.left ? l.left - o.x : o.x > l.left + l.width ? o.x - l.left - l.width : 0, d = u + f * 0.25;
    (d < s || d === 0 && a === null) && (a = i, s = d);
  }
  return a;
}
function _f({
  pageElement: e,
  clientX: t,
  clientY: n,
  itemId: r,
  selection: o,
  regions: a,
  bookmarks: s,
  metadata: i = null
}) {
  if (!e) return null;
  const c = Number(e.getAttribute(Pe)) || 0;
  if (c < 1) return null;
  const l = e.getAttribute(ke) === "source" ? "source" : "translated", u = e.getBoundingClientRect(), f = u.width > 0 && u.height > 0 ? { x: Math.min(1, Math.max(0, (t - u.left) / u.width)), y: Math.min(1, Math.max(0, (n - u.top) / u.height)) } : null, m = (r ? a.find((g) => g.itemId === r) ?? null : null) ?? (f ? Mf(a, i, l, c, f) : null);
  return {
    pane: l,
    page: c,
    itemId: (m == null ? void 0 : m.itemId) ?? null,
    selection: o,
    sourceText: `${(m == null ? void 0 : m.source.text) || (m == null ? void 0 : m.markdown) || ""}`.trim(),
    translatedText: `${(m == null ? void 0 : m.translatedBlockText) || (m == null ? void 0 : m.translated.text) || ""}`.trim(),
    section: Rf(s, a, (m == null ? void 0 : m.source.page) ?? c),
    point: f
  };
}
function Nf(e, t, n = document) {
  for (const r of n.elementsFromPoint(e, t)) {
    const o = r.closest(`[${Pe}]`);
    if (!o) continue;
    const a = Number(o.getAttribute(Pe)) || 0, i = (o.closest(`[${ke}]`) ?? o).getAttribute(ke) === "translated" ? "translated" : "source", c = o.querySelector("canvas");
    if (a && c) return { page: a, pane: i, canvas: c, slot: o };
  }
  return null;
}
function Af({ onDone: e, onCancel: t }) {
  const [n, r] = N(null), o = x(null), a = x(null);
  z(() => {
    const c = (l) => {
      l.key === "Escape" && (l.preventDefault(), l.stopImmediatePropagation(), t());
    };
    return window.addEventListener("keydown", c, !0), () => window.removeEventListener("keydown", c, !0);
  }, [t]);
  const s = (c, l) => {
    const u = a.current;
    u && (u.style.pointerEvents = "none");
    try {
      return Nf(c, l);
    } finally {
      u && (u.style.pointerEvents = "");
    }
  }, i = n ? { left: Math.min(n.from.x, n.to.x), top: Math.min(n.from.y, n.to.y), width: Math.abs(n.to.x - n.from.x), height: Math.abs(n.to.y - n.from.y) } : null;
  return /* @__PURE__ */ L(
    "div",
    {
      ref: a,
      className: "reader-ask-crop",
      role: "presentation",
      onContextMenu: (c) => {
        c.preventDefault(), t();
      },
      onPointerDown: (c) => {
        var u, f;
        if (c.button !== 0) return;
        const l = s(c.clientX, c.clientY);
        l && (o.current = l, (f = (u = c.currentTarget).setPointerCapture) == null || f.call(u, c.pointerId), r({ from: { x: c.clientX, y: c.clientY }, to: { x: c.clientX, y: c.clientY } }));
      },
      onPointerMove: (c) => {
        n && r({ from: n.from, to: { x: c.clientX, y: c.clientY } });
      },
      onPointerUp: (c) => {
        const l = o.current, u = n == null ? void 0 : n.from;
        if (o.current = null, r(null), !l || !u) return;
        const f = If(l.canvas.getBoundingClientRect(), u, { x: c.clientX, y: c.clientY });
        f && e({ page: l.page, pane: l.pane, region: f, canvas: l.canvas, point: { x: u.x, y: u.y, target: l.slot } });
      },
      children: [
        /* @__PURE__ */ p("p", { className: "reader-ask-crop-hint", children: "在书页上拖出一块，松开就带进提问 · Esc 取消" }),
        i ? /* @__PURE__ */ p("div", { className: "reader-ask-crop-box", style: i }) : null
      ]
    }
  );
}
const ho = 5e4, xf = 2e4;
function xn(e, t) {
  const n = `${e || ""}`;
  return n.length > t ? n.slice(0, t) : n;
}
function jg(e, t) {
  const n = { page: e.page, pane: e.pane, item_ids: e.itemId ? [e.itemId] : [] };
  return t.documentId && (n.document_id = t.documentId), t.jobId && (n.job_id = t.jobId), t.versionId && (n.translation_version = t.versionId), e.selection && (n.selected_text = e.selection), e.section && (n.section = e.section), e.sourceText && (n.source_text = e.sourceText), e.translatedText && (n.translated_text = e.translatedText), n;
}
function Lf(e, t = null) {
  var n;
  return {
    pane: e.pane === "source" ? "source" : "translated",
    page: e.page,
    itemId: ((n = e.item_ids) == null ? void 0 : n[0]) ?? null,
    selection: e.selected_text || "",
    sourceText: e.source_text || "",
    translatedText: e.translated_text || "",
    section: e.section || "",
    point: t
  };
}
function Cf(e, t) {
  if (!(e != null && e.page)) return null;
  const r = [!!(e.document_id && t && e.document_id !== t) ? "别的书" : "", `第 ${e.page} 页`, e.section || ""].filter(Boolean).join(" · ");
  return { page: e.page, label: r, data: e };
}
function Df(e) {
  var r;
  const t = e == null ? void 0 : e.data, n = ((r = t == null ? void 0 : t.retainpdf) == null ? void 0 : r.selection) ?? (t && typeof t.page == "number" ? t : null);
  return n && n.page ? n : null;
}
function Hg(e, t) {
  var r;
  const n = Df(e);
  return !n || n.document_id && t && n.document_id !== t ? null : ((r = n.item_ids) == null ? void 0 : r[0]) || null;
}
function Ug(e) {
  var o, a;
  const t = e.selection.trim();
  return t && !t.endsWith("…") ? t : ((a = (o = [...e.text.matchAll(/```[ \t]*(译文|translation|zh|zh-CN)[ \t]*\n([\s\S]*?)\n```/gi)].at(-1)) == null ? void 0 : o[2]) == null ? void 0 : a.trim()) || null;
}
function $f(e, t) {
  var o;
  if (!t) return;
  const n = e.findIndex((a) => a.message_id === t);
  if (n < 0) return;
  const r = ((o = e[n + 1]) == null ? void 0 : o.role) === "assistant" ? Of(e[n + 1].text) : "";
  return { question: e[n].text, ...r ? { answer: r } : {} };
}
function Of(e, t = 160) {
  const n = e.replace(/```[\s\S]*?(```|$)/g, " ").replace(/\$\$[\s\S]*?\$\$/g, " … ").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim(), r = [...n];
  return r.length > t ? `${r.slice(0, t).join("")}…` : n;
}
function zf(e, t = [], n = "") {
  const r = new Set(t.map((o) => o.covers_to_seq));
  return e.filter((o) => !o.superseded_at).map((o) => {
    const a = r.has(o.seq) ? { compactedBefore: !0 } : {};
    if (o.role === "user") {
      const s = $f(e, o.edited_from);
      return {
        id: o.message_id,
        role: "user",
        text: o.text,
        context: Cf(o.selection, n),
        ...s ? { marks: { rewrote: s } } : {}
      };
    }
    return o.role === "side_summary" ? {
      id: o.message_id,
      role: "assistant",
      text: `**深挖的结论**

${o.text}`,
      marks: { sideSummary: { sideId: o.side_conversation_id }, ...a }
    } : {
      id: o.message_id,
      role: "assistant",
      text: o.text,
      thought: o.thought,
      usage: o.usage ?? null,
      ...a.compactedBefore ? { marks: a } : {}
    };
  });
}
function Ff(e, t, n, r) {
  var l, u, f;
  const o = ((f = (u = (l = e.context) == null ? void 0 : l.meta) == null ? void 0 : u.retainpdf) == null ? void 0 : f.selection) ?? null, a = (o == null ? void 0 : o.document_id) || t || null, s = e.sessionId && e.sessionId.length <= 256 ? e.sessionId : null, i = { agent_id: e.agentId || null, document_id: a, session_id: s }, c = e.answer.usage && JSON.stringify(e.answer.usage).length <= 4096 ? e.answer.usage : null;
  return [
    { ...i, role: "user", text: xn(e.question.text, ho), selection: o, client_message_id: `${n}-q`, ...r ? { edited_from: r } : {} },
    {
      ...i,
      role: "assistant",
      text: xn(e.answer.text, ho),
      thought: e.answer.thought ? xn(e.answer.thought, xf) : null,
      usage: c,
      client_message_id: `${n}-a`,
      memory_ids: e.memoryIds.slice(0, 10)
    }
  ];
}
function Bf(e) {
  return new Date(e - 2e3).toISOString().replace(/\.\d+Z$/, "Z");
}
function jf(e, t) {
  return e.filter((n) => n.origin === "agent" && n.status === "active" && !t.has(n.memory_id)).map((n) => ({ id: n.memory_id, scope: n.scope, text: n.text, category: n.category, documentId: n.document_id, created: !0 }));
}
function Hf(e, t) {
  if (t.id && e.some((r) => r.message_id === t.id)) return t.id;
  const n = t.text.trim();
  for (let r = e.length - 1; r >= 0; r -= 1) {
    const o = e[r];
    if (o.role === "assistant" && o.text.trim() === n) return o.message_id;
  }
  return null;
}
function Uf(e) {
  const t = e.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().split(new RegExp("(?<=[。！？.!?])"))[0] || "";
  return `深挖：${[...t].slice(0, 30).join("")}${[...t].length > 30 ? "…" : ""}`;
}
const Kf = 50, Ja = 2, Ln = { conversation: null, main: null, records: [], compactions: [], hasMore: !1, key: "local", initial: [] };
function Wf() {
  var t, n;
  return `c-${((n = (t = globalThis.crypto) == null ? void 0 : t.randomUUID) == null ? void 0 : n.call(t)) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}
function po(e) {
  var n, r, o, a;
  const t = e;
  return `${(t == null ? void 0 : t.reason) || ((n = t == null ? void 0 : t.details) == null ? void 0 : n.reason) || ((a = (o = (r = t == null ? void 0 : t.payload) == null ? void 0 : r.error) == null ? void 0 : o.details) == null ? void 0 : a.reason) || (e instanceof Error ? e.message : "")}`;
}
function Vf({ port: e, book: t, onAppended: n }) {
  const r = (e == null ? void 0 : e.conversations) ?? null, o = (e == null ? void 0 : e.memories) ?? null, [a, s] = N(!1), [i, c] = N(Ln), [l, u] = N(!1), [f, d] = N(""), [m, g] = N("idle"), [h, y] = N(null), [I, S] = N([]), b = A((B) => {
    y(B), S([]);
  }, []), w = A((B) => S((U) => [...U, B].slice(-Ja)), []), [v, R] = N(() => /* @__PURE__ */ new Map()), C = x(/* @__PURE__ */ new Set()), M = x(/* @__PURE__ */ new Map()), P = (B) => {
    if (!B) return null;
    const U = M.current.get(B);
    return U || (T.current.records.some((G) => G.message_id === B) ? B : null);
  }, T = x(i);
  T.current = i;
  const k = x(t);
  k.current = t;
  const E = x(0), _ = A(async (B, U, G, se = []) => {
    if (!r) return;
    const ne = await r.messages(B.conversation_id, { limit: Kf, ...G ? { beforeSeq: G } : {} }), me = [...ne.messages, ...se];
    E.current += 1, c({
      conversation: B,
      main: U ?? B,
      records: me,
      compactions: ne.compactions || [],
      hasMore: ne.has_more,
      key: `${B.conversation_id}:${E.current}`,
      initial: zf(me, ne.compactions || [], k.current.documentId)
    });
  }, [r]), D = A(async () => {
    s(!0);
    const B = T.current.conversation;
    if (!(!r || (B == null ? void 0 : B.kind) === "main" && B.status !== "archived")) {
      u(!0), d("");
      try {
        const U = await r.main(k.current.documentId || void 0);
        await _(U, U);
      } catch (U) {
        d(U instanceof Error ? U.message : String(U));
      } finally {
        u(!1);
      }
    }
  }, [r, _]), $ = A((B) => {
    b(B), D();
  }, [D]), K = x(t.documentId);
  z(() => {
    K.current !== t.documentId && (K.current = t.documentId, T.current = Ln, c(Ln), b(null), R(/* @__PURE__ */ new Map()), M.current.clear(), a && D());
  }, [t.documentId, a, D]);
  const H = A(async () => {
    const B = T.current, U = B.records[0];
    if (!(!B.conversation || !U || !B.hasMore)) {
      u(!0);
      try {
        await _(B.conversation, B.main, U.seq, B.records);
      } finally {
        u(!1);
      }
    }
  }, [_]), J = A(async (B) => {
    const G = T.current.conversation;
    if (!r || !G) return;
    for (const Q of B.memoryIds) C.current.add(Q);
    let se = B.memoryIds;
    if (!se.length && o && B.startedAt) {
      const Q = jf(
        await o.list({ source_conversation_id: G.conversation_id, created_after: Bf(B.startedAt) }).catch(() => []),
        C.current
      );
      for (const F of Q) C.current.add(F.id);
      se = Q.map((F) => F.id);
      const ge = B.answerId;
      Q.length && ge && R((F) => new Map(F).set(ge, Q));
    }
    const ne = Ff({ ...B, memoryIds: se }, k.current.documentId, Wf(), P(B.editedFrom));
    let me;
    try {
      me = await r.append(G.conversation_id, ne);
    } catch (Q) {
      if (G.kind !== "side" || !/ask_conversation_not_open/.test(po(Q))) throw Q;
      await r.reopen(G.conversation_id), me = await r.append(G.conversation_id, ne);
    }
    const [we, re] = me.messages;
    B.questionId && we && M.current.set(B.questionId, we.message_id), B.answerId && re && M.current.set(B.answerId, re.message_id), c((Q) => {
      var ge;
      return ((ge = Q.conversation) == null ? void 0 : ge.conversation_id) === G.conversation_id ? { ...Q, conversation: me.conversation, records: [...Q.records, ...me.messages] } : Q;
    }), n == null || n(me.messages), me.compaction_due && G.kind === "main" && r.compact(G.conversation_id).catch(() => {
    });
  }, [r, o, n]), le = A(async (B) => {
    const U = T.current.conversation, G = P(B);
    if (!r || !U || !G) return null;
    try {
      await r.supersede(U.conversation_id, G);
    } catch (me) {
      if (!/ask_message_superseded/.test(po(me))) throw me;
    }
    const se = T.current.records.find((me) => me.message_id === G), ne = T.current.records.findIndex((me) => me.message_id === G);
    return c((me) => ({ ...me, records: me.records.map((we, re) => re >= ne && ne >= 0 && !we.superseded_at ? { ...we, superseded_at: "now" } : we) })), (se == null ? void 0 : se.selection) ?? null;
  }, [r]), ee = A((B) => {
    J(B).catch((U) => d(`这一轮没存上：${U instanceof Error ? U.message : String(U)}`));
  }, [J]), ie = A(async (B) => {
    var se;
    const U = T.current, G = U.main;
    if (!(!r || !G || ((se = U.conversation) == null ? void 0 : se.kind) !== "main")) {
      d("");
      try {
        const ne = Hf(U.records, B), me = await r.fork({
          parent_id: G.conversation_id,
          ...ne ? { forked_from_message_id: ne } : {},
          title: Uf(B.text),
          ...k.current.documentId ? { document_id: k.current.documentId } : {}
        });
        await _(me, G);
      } catch (ne) {
        d(`开不了副对话：${ne instanceof Error ? ne.message : String(ne)}`);
      }
    }
  }, [r, _]), Se = A(async (B) => {
    const U = T.current.main;
    if (r)
      try {
        await _(await r.get(B), U);
      } catch (G) {
        d(`打不开副对话：${G instanceof Error ? G.message : String(G)}`);
      }
  }, [r, _]), Z = A(async () => {
    const B = T.current.main;
    B && await _(B, B).catch(() => {
    });
  }, [_]), de = A(async () => {
    const B = T.current.conversation;
    if (!(!r || (B == null ? void 0 : B.kind) !== "side")) {
      g("busy");
      try {
        await r.close(B.conversation_id), g("idle"), await Z();
      } catch {
        g("failed");
      }
    }
  }, [r, Z]), Le = A(async () => r != null && r.archived ? r.archived(k.current.documentId) : [], [r]), ae = A(async (B) => {
    d(""), b(null);
    try {
      await _(B, T.current.main);
    } catch (U) {
      d(`打不开这个对话：${U instanceof Error ? U.message : String(U)}`);
    }
  }, [_, b]), fe = A(async () => {
    const B = T.current.main;
    if (!r || !B) return;
    await r.archive(B.conversation_id);
    const U = await r.main(k.current.documentId || void 0);
    await _(U, U);
  }, [r, _]);
  return {
    visible: a,
    view: i,
    loading: l,
    error: f,
    pending: h,
    setPending: b,
    extras: I,
    addExtra: w,
    closingSide: m,
    notices: v,
    persistent: !!r,
    openMain: D,
    ask: $,
    close: A(() => s(!1), []),
    loadEarlier: H,
    onTurn: ee,
    rewrite: le,
    fork: ie,
    openSide: Se,
    backToMain: Z,
    closeSide: de,
    archiveMain: fe,
    listArchived: Le,
    viewArchived: ae,
    forgetMemory: r ? r.forgetMemory : void 0
  };
}
function go(e, t, n) {
  var c;
  const r = e.selection, o = e.page ?? (r == null ? void 0 : r.page) ?? 0;
  if (e.role !== "user" || !o) return null;
  const a = (e.pane ?? (r == null ? void 0 : r.pane)) === "source" ? "source" : "translated", s = ((c = r == null ? void 0 : r.item_ids) == null ? void 0 : c[0]) ?? null, i = Lf({ item_ids: [], ...r, page: o, pane: a }, n(s, a, o));
  return { key: t, anchor: i, messageId: e.message_id, title: e.text.slice(0, 80) };
}
function qf({ port: e, documentId: t, resetKey: n, pointOf: r }) {
  const [o, a] = N([]), s = x(0), i = x(r);
  i.current = r;
  const c = () => (s.current += 1, s.current);
  z(() => {
    var m, g;
    if (a([]), !e || !t) return;
    let f = !1;
    const d = (h) => {
      !f && h.length && a((y) => [...y, ...h]);
    };
    return (m = e.threads) == null || m.list(t).then(
      (h) => d(h.map((y) => ({ key: c(), anchor: y.anchor, threadId: y.threadId, title: y.title }))),
      () => {
      }
    ), (g = e.conversations) == null || g.bookMessages(t).then(
      (h) => d(h.map((y) => go(y, c(), i.current)).filter((y) => !!y)),
      () => {
      }
    ), () => {
      f = !0;
    };
  }, [e, t, n]);
  const l = A((f) => {
    const d = f.filter((m) => !m.document_id || m.document_id === t).map((m) => go(m, c(), i.current)).filter((m) => !!m);
    d.length && a((m) => [...m.filter((g) => !d.some((h) => h.messageId === g.messageId)), ...d]);
  }, [t]), u = A((f) => a((d) => d.filter((m) => m.key !== f)), []);
  return { marks: o, addRecords: l, removeMark: u };
}
const Jf = Go(() => import("./ReaderAskPanel-C7wQHK9U.js"));
function Gf({
  port: e,
  documentId: t,
  jobId: n,
  versionId: r,
  regions: o,
  metadata: a,
  bookmarks: s,
  hoveredItemId: i,
  resetKey: c,
  goToPage: l,
  pageCount: u,
  editBlock: f,
  jumpToBlock: d,
  pdfDocuments: m,
  currentPage: g,
  visibleMode: h,
  activePanel: y = null,
  panelHost: I = null
}) {
  var Fe;
  const S = W(() => ({ documentId: t, jobId: n, versionId: r }), [t, n, r]), b = A((j, q, ue) => {
    const ve = j ? o.find((V) => V.itemId === j) : null, Re = ve ? Rt(ve, a, q) : null, O = Re && Re.box.page === ue ? gt(Re, 1, 1) : null;
    return O ? { x: O.left, y: O.top } : null;
  }, [o, a]), w = qf({ port: e, documentId: t, resetKey: c, pointOf: b }), v = Vf({ port: e, book: S, onAppended: w.addRecords }), [R, C] = N(null), M = A(
    (j, q, ue, ve) => _f({
      pageElement: (j == null ? void 0 : j.closest(`[${Pe}]`)) ?? null,
      clientX: q,
      clientY: ue,
      itemId: i(),
      selection: ve,
      regions: o,
      bookmarks: s,
      metadata: a
    }),
    [i, o, s, a]
  ), P = A(() => {
    var q;
    const j = mo(((q = globalThis.getSelection) == null ? void 0 : q.call(globalThis)) ?? null);
    return !j.text || !j.element || !j.rect ? null : M(j.element, j.rect.left + j.rect.width / 2, j.rect.top + j.rect.height / 2, j.text);
  }, [M]), T = A((j) => {
    C(null), v.ask(j);
  }, [v.ask]);
  z(() => {
    if (!e) return;
    const j = (q) => {
      var Re;
      if (q.key !== "?" || q.metaKey || q.ctrlKey || q.altKey || q.defaultPrevented) return;
      const ue = q.target;
      if ((Re = ue == null ? void 0 : ue.closest) != null && Re.call(ue, "input, textarea, select, [contenteditable='true']")) return;
      const ve = P();
      ve && (q.preventDefault(), q.stopImmediatePropagation(), T(ve));
    };
    return window.addEventListener("keydown", j, !0), () => window.removeEventListener("keydown", j, !0);
  }, [e, P, T]);
  const k = x(/* @__PURE__ */ new Set()), E = ((Fe = v.pending) == null ? void 0 : Fe.selection) || "";
  z(() => {
    E && k.current.add(E);
  }, [E]);
  const _ = v.visible && !R, D = v.setPending, [$, K] = N(null), H = !!v.pending;
  z(() => {
    H || K(null);
  }, [H]);
  const J = x(v.pending);
  J.current = v.pending, z(() => {
    if (!_) return;
    let j = null;
    const q = () => {
      j && clearTimeout(j), j = setTimeout(() => {
        const ue = P();
        !ue || k.current.has(ue.selection) || (J.current ? K(ue) : D(ue));
      }, 250);
    };
    return document.addEventListener("selectionchange", q), () => {
      j && clearTimeout(j), document.removeEventListener("selectionchange", q);
    };
  }, [_, P, D]);
  const le = v.addExtra, ee = v.extras.length, ie = W(() => {
    if (!$) return null;
    const j = () => {
      k.current.add($.selection), K(null);
    };
    return {
      label: `第 ${$.page} 页 · ${[...$.selection].length} 字`,
      replace: () => {
        j(), D($);
      },
      ...ee < Ja ? { add: () => {
        j(), le($);
      } } : {},
      dismiss: j
    };
  }, [$, ee, D, le]), Se = x(m);
  Se.current = m;
  const Z = A(async ({ page: j, pane: q, region: ue, canvas: ve }) => {
    const Re = Se.current[q];
    let O;
    if (Re)
      O = await kf(Re, j, ue);
    else {
      const V = ve ?? document.querySelector(`[${ke}="${q}"] [${Pe}="${j}"] canvas`);
      if (!V) throw new Error(`第 ${j} 页还没画出来，翻到那一页再试`);
      O = await Tf(V, ue);
    }
    return new File([O], Ef(j, ue), { type: "image/png" });
  }, []), [de, Le] = N(null), ae = x(v.pending);
  ae.current = v.pending;
  const fe = W(() => [{
    key: "page",
    label: "带上这一页",
    title: "带上这一页的截图（问的那一页，没有就是现在读的这页）：公式、图表、表格让 AI 直接看图",
    icon: /* @__PURE__ */ p(ei, { size: 14, "aria-hidden": !0 }),
    run: () => {
      const j = ae.current, q = (j == null ? void 0 : j.pane) || (h === "translated" ? "translated" : "source");
      return Z({ page: (j == null ? void 0 : j.page) || g() || 1, pane: q, region: mr });
    }
  }], [Z, g, h]), [B, U] = N(!1), [G, se] = N(""), ne = A(async (j) => {
    U(!1), se("");
    try {
      const q = await Z(j), ue = M(j.point.target, j.point.x, j.point.y, "");
      Le((ve) => ({ id: ((ve == null ? void 0 : ve.id) || 0) + 1, files: [q] })), ue ? T({ ...ue, itemId: null, sourceText: "", translatedText: "" }) : v.openMain();
    } catch (q) {
      se(q instanceof Error ? q.message : String(q));
    }
  }, [Z, M, T]), me = A(() => U(!1), []), we = A(() => {
    se(""), U((j) => !j);
  }, []), re = A(async (j) => {
    if (j.threadId && (e != null && e.threads) && t) {
      try {
        const q = await e.threads.get(t, j.threadId);
        C({ anchor: q.anchor || j.anchor, messages: q.messages || [], mark: j });
      } catch {
        C({ anchor: j.anchor, messages: [], mark: j });
      }
      return;
    }
    C(null), v.openMain();
  }, [e, t, v.openMain]), Q = A((j) => {
    var ve;
    if (!e) return [];
    const q = mo(((ve = globalThis.getSelection) == null ? void 0 : ve.call(globalThis)) ?? null), ue = M(j.target, j.clientX, j.clientY, q.element ? q.text : "");
    return ue ? [{
      key: "ask",
      label: ue.selection ? "问这段" : "在这里提问",
      hint: ue.selection ? "?" : void 0,
      onSelect: () => T(ue)
    }, {
      key: "crop",
      label: "截一块问",
      onSelect: () => {
        se(""), U(!0);
      }
    }] : [];
  }, [e, M, T]), ge = R ? {
    anchor: R.anchor,
    messages: R.messages,
    onClose: () => C(null),
    onDelete: e != null && e.threads && R.mark.threadId ? () => {
      e.threads.remove(t, R.mark.threadId).catch(() => {
      }), w.removeMark(R.mark.key), C(null);
    } : void 0
  } : null, F = W(() => f ? (j, q) => {
    f(j, q ?? void 0), requestAnimationFrame(() => d(j, "translated"));
  } : null, [f, d]), te = A((j) => Aa(o, j), [o]), [he, Oe] = N(0), Ce = A(({ mode: j, width: q }) => {
    Oe(j === "dock" ? Math.round(q) : 0);
  }, []), _e = !v.persistent || !!v.view.conversation || !!v.error, Be = e && (v.visible && _e || R) ? /* @__PURE__ */ p(Jo, { fallback: null, children: /* @__PURE__ */ p(
    Jf,
    {
      port: e,
      jobId: n,
      book: S,
      ask: v,
      legacy: ge,
      onShowSelection: ({ page: j, pane: q }) => l(j, q),
      onJumpToPage: (j) => l(j),
      pageCount: u,
      onLayout: Ce,
      dockTaken: y !== null,
      dockHost: I,
      onEditBlock: F,
      canEditBlock: te,
      attachTools: fe,
      attachRequest: de,
      contextOffer: ie
    }
  ) }) : null, ze = B || G ? /* @__PURE__ */ L($e, { children: [
    B ? /* @__PURE__ */ p(Af, { onDone: (j) => void ne(j), onCancel: me }) : null,
    G ? /* @__PURE__ */ L("p", { className: "reader-ask-crop-error", role: "alert", onClick: () => se(""), children: [
      "截图没成：",
      G
    ] }) : null
  ] }) : null, Ne = v.visible && _e || !!R, Ke = v.close, De = A(() => {
    if (Ne) {
      C(null), Ke();
      return;
    }
    v.openMain();
  }, [Ne, Ke, v.openMain]);
  return { marks: w.marks, onMark: re, menuItems: Q, panel: Be, overlay: ze, cropping: B, toggleCrop: we, open: v.openMain, toggle: De, showing: Ne, reserveRight: Ne ? he : 0, enabled: !!e };
}
const Xf = [{ keys: "选字 + ?", desc: "问选中的这段" }];
function Yf() {
  const e = en(), t = W(() => {
    try {
      return nt().ask ?? null;
    } catch {
      return null;
    }
  }, []), n = Gf({
    port: t,
    documentId: e.documentId,
    jobId: e.jobId,
    versionId: e.versionId,
    regions: e.regions,
    metadata: e.metadata,
    bookmarks: e.bookmarks,
    hoveredItemId: e.hoveredItemId,
    resetKey: e.resetKey,
    goToPage: e.goToPage,
    pageCount: e.pageCount,
    editBlock: e.editBlock,
    jumpToBlock: e.jumpToBlock,
    pdfDocuments: e.pdfDocuments,
    currentPage: e.currentPage,
    visibleMode: e.visibleMode,
    activePanel: e.activePanel,
    panelHost: e.panelHost
  }), { marks: r, onMark: o, menuItems: a, panel: s, overlay: i, cropping: c, toggleCrop: l, enabled: u, toggle: f, showing: d, reserveRight: m } = n, g = W(() => u ? {
    toolbarItems: [{
      key: "ask",
      label: "提问",
      title: "提问：问整本书、翻这本书以前的对话（问某一段：书页上右键，或选字按 ?）",
      Icon: ti,
      pressed: d,
      onClick: f
    }, {
      // 底栏右边：框出书页上的一块，截图带进提问（和右键「截一块问」一样）。
      key: "crop",
      label: "截图",
      title: "截图：在书页上框出一块，带进提问（Esc 取消）",
      Icon: ni,
      place: "bottom",
      pressed: c,
      onClick: l
    }],
    menuItems: a,
    pageLayer: r.length ? ({ page: h, height: y }) => /* @__PURE__ */ p(wf, { marks: r, page: h, height: y, onOpen: o }) : void 0,
    shortcuts: Xf,
    reserveRight: m,
    // 「截一块问」时占着书页上的指针：不出悬停框、不选字。
    takesPointer: c
  } : {}, [u, a, r, o, f, d, m, c, l]);
  return kn(g), /* @__PURE__ */ L($e, { children: [
    s,
    i
  ] });
}
const Zf = { id: "ask", title: "提问", Component: Yf };
function Vn() {
  try {
    return nt().translationVersions ?? null;
  } catch {
    return null;
  }
}
function Qf(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function em(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function tm(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function nm({ documentId: e, jobId: t }) {
  const [n, r] = N([]), [o, a] = N(null);
  z(() => {
    r([]);
    const i = Vn();
    if (!i || !e) return;
    let c = !1;
    return i.list(e).then((l) => {
      c || (r(l.versions), a(l.currentVersionId));
    }).catch(() => {
    }), () => {
      c = !0;
    };
  }, [e, t]);
  const s = em(n, t, o);
  return W(() => ({ versions: n, readingVersionId: s }), [n, s]);
}
function rm({ documentId: e, jobId: t, versions: n, readingVersionId: r }) {
  const [o, a] = N(null), [s, i] = N(""), [c, l] = N(""), u = x(0);
  z(() => {
    u.current += 1, a(null), i(""), l("");
  }, [e, t]);
  const f = A((g) => {
    const h = Vn(), y = n.find((S) => S.versionId === g);
    if (!h || !y || !e) return;
    const I = ++u.current;
    i(g), l(""), (async () => {
      const S = nt(), b = await h.resolveJob(e, g);
      if (!b) throw new Error("这一份还没有能读的译文。");
      const w = await S.loadReaderPayload(b, { includeOptionalArtifacts: !0 }), v = S.resolveReaderTranslatedPdfUrl(w.jobPayload, w.manifestPayload);
      if (!v) throw new Error("这一份没有译文 PDF。");
      return { versionId: g, name: y.name, jobId: b, url: v, regions: Qf(Yo(w.regionsPayload)) };
    })().then((S) => {
      I === u.current && a(S);
    }).catch((S) => {
      I === u.current && l((S == null ? void 0 : S.message) || "这一份打不开。");
    }).finally(() => {
      I === u.current && i("");
    });
  }, [e, n]), d = A(() => {
    u.current += 1, a(null), i(""), l("");
  }, []), m = A(async () => {
    var y, I;
    const g = Vn();
    if (!g || !o || !e) return;
    try {
      await g.select(e, o.versionId);
    } catch (S) {
      l((S == null ? void 0 : S.message) || "换不过去，请稍后再试。");
      return;
    }
    const h = (y = globalThis.location) == null ? void 0 : y.href;
    h && ((I = globalThis.history) == null || I.replaceState(globalThis.history.state, "", tm(h, o.jobId))), a(null);
  }, [o, e]);
  return W(() => ({
    available: n.length >= 2,
    versions: n,
    readingVersionId: r,
    compared: o,
    loading: s,
    error: c,
    choose: f,
    clear: d,
    adopt: m
  }), [n, r, o, s, c, f, d, m]);
}
function om(e) {
  return e.available ? {
    key: "compare",
    label: "对比版本",
    title: "对比版本：左边换成这本书的另一份译文",
    Icon: ri,
    place: "compare",
    pressed: !!(e.compared || e.loading),
    popup: (t) => /* @__PURE__ */ p(qd, { compare: e, onDone: t })
  } : null;
}
function am(e) {
  const { compared: t, versions: n, readingVersionId: r } = e;
  if (!t) return null;
  const o = n.find((s) => s.versionId === t.versionId), a = n.find((s) => s.versionId === r);
  return {
    url: t.url,
    regions: t.regions,
    left: { name: t.name, createdAt: (o == null ? void 0 : o.createdAt) || "" },
    right: { name: (a == null ? void 0 : a.name) || "当前译文", createdAt: (a == null ? void 0 : a.createdAt) || "" }
  };
}
function sm() {
  var i;
  const e = en(), t = rm({
    documentId: e.documentId,
    jobId: e.jobId,
    versions: e.translationVersions,
    readingVersionId: e.versionId || ""
  }), { visibleMode: n, setWorkspace: r } = e, o = ((i = t.compared) == null ? void 0 : i.url) || "";
  z(() => {
    o && n !== "compare" && r("compare");
  }, [o]);
  const a = t.clear;
  z(() => {
    n !== "compare" && a();
  }, [n, a]);
  const s = W(() => {
    const c = om(t);
    return { toolbarItems: c ? [c] : [], comparedDocument: am(t) };
  }, [t]);
  return kn(s), null;
}
const im = { id: "compare", title: "对比版本", Component: sm }, Ga = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], bo = { pen: 35e-4, highlighter: 0.018 }, yo = 0.015, qn = "retainpdf.reader.ink.v1:";
function vo(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(qn + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function cm(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(qn + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(qn + e);
    } catch {
    }
}
function lm(e, t, n, r, o, a) {
  const s = yo * yo;
  return e.filter((i) => Xa(i, t, n) && i.points.some(([c, l]) => (c - r) ** 2 + ((l - o) * a) ** 2 <= s)).map((i) => i.id);
}
function Xa(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function um(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function dm(e) {
  const [t, n] = N(null), [r, o] = N(Ga[0].key), [a, s] = N(() => vo(e)), i = x(a), c = x([]);
  z(() => {
    const h = vo(e);
    i.current = h, s(h), c.current = [];
  }, [e]);
  const l = A((h) => {
    i.current = h, s(h), cm(e, h);
  }, [e]), u = A((h) => {
    const y = i.current, I = h(y);
    I !== y && (c.current = [...c.current.slice(-49), y], l(I));
  }, [l]), f = A((h) => {
    h.points.length < 1 || u((y) => [...y, { ...h, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [u]), d = A((h) => {
    h.length && u((y) => y.filter((I) => !h.includes(I.id)));
  }, [u]), m = A((h) => {
    u((y) => y.some((I) => I.page === h) ? y.filter((I) => I.page !== h) : y);
  }, [u]), g = A(() => {
    const h = c.current.pop();
    h && l(h);
  }, [l]);
  return W(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: d, undo: g, clearPage: m }),
    [t, r, a, f, d, g, m]
  );
}
const fm = [
  { tool: "pen", label: "画笔", Icon: un },
  { tool: "highlighter", label: "荧光笔", Icon: oi },
  { tool: "eraser", label: "橡皮", Icon: ai }
];
function mm(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function hm({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ L($e, { children: [
    fm.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
      oe,
      {
        className: "reader-ink-tool",
        "aria-label": a,
        title: a,
        "aria-pressed": e.tool === o,
        "data-ink-tool": o,
        onClick: () => {
          e.setTool(e.tool === o ? null : o), r();
        },
        children: /* @__PURE__ */ p(s, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      },
      o
    )),
    /* @__PURE__ */ p("span", { className: "reader-ink-sep", "aria-hidden": !0 }),
    Ga.map((o) => /* @__PURE__ */ p(
      oe,
      {
        className: "reader-ink-color",
        "aria-label": `${o.label}色`,
        title: `${o.label}色`,
        "aria-pressed": e.color === o.key,
        "data-ink-color": o.key,
        style: { color: `var(--${o.key})` },
        onClick: () => {
          e.setColor(o.key), (!e.tool || e.tool === "eraser") && e.setTool("pen"), r();
        },
        children: /* @__PURE__ */ p("span", { "aria-hidden": !0 })
      },
      o.key
    )),
    /* @__PURE__ */ p("span", { className: "reader-ink-sep", "aria-hidden": !0 }),
    /* @__PURE__ */ p(oe, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(si, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      oe,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p(ii, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null,
    e.tool ? /* @__PURE__ */ p(
      oe,
      {
        className: "reader-ink-tool",
        "aria-label": "退出画笔",
        title: "退出画笔（Esc）",
        "data-ink-exit": "true",
        onClick: () => {
          e.setTool(null), r();
        },
        children: /* @__PURE__ */ p(At, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function wo({ ink: e, page: t, onPick: n }) {
  return /* @__PURE__ */ p("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ p(hm, { ink: e, page: t, onPick: n }) });
}
function pm(e) {
  const t = x(e);
  t.current = e, z(() => {
    const n = (r) => {
      if (mm(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
const gm = "reader-ink-layer";
function bm(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function So({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: bm(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function ym({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = N(null), i = x(!1), c = o.strokes.filter((h) => Xa(h, e, t)), l = !!o.tool;
  if (!l && !c.length) return null;
  const u = (h) => {
    const y = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - y.left) / Math.max(1, y.width))),
      Math.min(1, Math.max(0, (h.clientY - y.top) / Math.max(1, y.height)))
    ];
  }, f = (h, y) => o.erase(lm(o.strokes, e, t, h, y, r / Math.max(1, n))), d = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [y, I] = u(h);
    o.tool === "eraser" ? f(y, I) : s([[y, I]]);
  }, m = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [y, I] = u(h);
    o.tool === "eraser" ? f(y, I) : s((S) => S ? um(S, y, I) : [[y, I]]);
  }, g = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: bo[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ L(
    "svg",
    {
      className: gm,
      "data-ink-active": l ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: d,
      onPointerMove: m,
      onPointerUp: g,
      onPointerCancel: g,
      children: [
        c.map((h) => /* @__PURE__ */ p(So, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(So, { stroke: { tool: o.tool, color: o.color, width: bo[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
const vm = [
  { keys: "P", desc: "进入 / 退出画笔（书页上右键也能选笔和颜色）" },
  { keys: "Esc", desc: "退出画笔" },
  { keys: "⌘Z / Ctrl+Z", desc: "画笔模式下撤销" }
];
function wm(e) {
  return {
    toolbarItems: [{
      key: "ink",
      label: "画笔",
      title: "画笔（P；书页上右键也能选笔和颜色）",
      Icon: un,
      // 钢笔图标，右下角一个当前笔色的小点（2026-11-28：两条栏只用图标，单一个圆点认不出是画笔）。
      mark: /* @__PURE__ */ L("span", { className: "reader-ink-mark", "aria-hidden": !0, children: [
        /* @__PURE__ */ p(un, { ...Te }),
        /* @__PURE__ */ p("span", { className: "reader-ink-dot", style: { background: `var(--${e.color})` } })
      ] }),
      place: "bottom",
      pressed: !!e.tool,
      onClick: () => e.setTool(e.tool ? null : "pen"),
      dropdown: (t) => /* @__PURE__ */ p(wo, { ink: e, onPick: t })
    }],
    menuSection: ({ page: t, close: n }) => /* @__PURE__ */ p(wo, { ink: e, page: t, onPick: n }),
    // 离视口远的页只是占位，笔迹先不画（和以前一样只画 active 的页）。
    pageLayer: ({ page: t, pane: n, width: r, height: o, active: a }) => a ? /* @__PURE__ */ p(ym, { page: t, pane: n, width: r, height: o, ink: e }) : null,
    takesPointer: !!e.tool,
    shortcuts: vm
  };
}
function Sm() {
  const e = en(), t = dm(e.resetKey);
  pm(t);
  const n = W(() => wm(t), [t]);
  return kn(n), null;
}
const Im = { id: "ink", title: "画笔", Component: Sm };
function km(e) {
  const t = x(!1);
  return e && (t.current = !0), t.current;
}
const Tm = Go(() => import("./ReaderMarkdownPanel-C6InSxpu.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), Ya = { id: "markdown", label: "Markdown", short: "MD", Icon: ci, needsJob: !0 };
function Em() {
  const e = en(), t = e.activePanel === Ya.id;
  if (!km(t)) return null;
  const r = /* @__PURE__ */ p(Jo, { fallback: null, children: /* @__PURE__ */ p(Tm, { open: t, jobId: e.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: e.closePanel }) });
  return e.panelHost ? bi(r, e.panelHost) : r;
}
const Pm = {
  id: "markdown",
  title: "Markdown",
  Component: Em,
  panels: [Ya]
}, Za = "reader-xref", Jn = "data-xref", Bt = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, Rm = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${Bt})`), Mm = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function Gn(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function _m(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function Nm(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function Am(e, t, n) {
  const r = e[t], o = (i) => {
    if (!i || i.source.page !== r.source.page) return !1;
    const c = Ue(i);
    return c === "figure" || c === "table" || c === "formula";
  }, a = (i) => {
    const c = [];
    for (let l = t + i; o(e[l]) && c.length < 40; l += i) c.push(e[l]);
    return i < 0 ? c.reverse() : c;
  }, s = a(n === "table" ? 1 : -1);
  return s.length ? s : a(n === "table" ? -1 : 1);
}
function xm(e, t, n) {
  return (e.find((o) => Ue(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function Lm(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = Ue(r), s = Nm(r);
    if (a === "formula") {
      for (const g of s.matchAll(Mm)) {
        const h = Gn(g[1]);
        h && n({ key: `equation:${h}`, kind: "equation", label: h, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = Rm.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const l = _m(i[1]), u = Gn(i[2]), f = Am(e, o, l), d = [...f.map((g) => g.itemId), r.itemId], m = new Map(e.map((g, h) => [g.itemId, h]));
    d.sort((g, h) => (m.get(g) ?? 0) - (m.get(h) ?? 0)), n({ key: `${l}:${u}`, kind: l, label: u, itemId: xm(f, r, l), itemIds: d, captionId: r.itemId });
  }), t;
}
const Cm = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${Bt})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${Bt})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${Bt})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${Bt})\s*[）)]`, "g"), kind: () => "equation" }
];
function Dm(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of Cm) {
    o.lastIndex = 0;
    for (const s of e.matchAll(o)) {
      const i = s.length > 2 ? s[1] : "", c = Gn(s[s.length - 1]), l = `${a(i)}:${c}`;
      if (!t.has(l)) continue;
      const u = s.index ?? 0;
      n.push({ start: u, end: u + s[0].length, key: l });
    }
  }
  n.sort((o, a) => o.start - a.start);
  const r = [];
  for (const o of n)
    (!r.length || o.start >= r[r.length - 1].end) && r.push(o);
  return r;
}
function $m(e, t) {
  return Dm(e, t).map((n) => ({ start: n.start, end: n.end, className: Za, attrs: { [Jn]: n.key } }));
}
const Om = { figure: "图", table: "表", equation: "式" };
function Io(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${Om[e.kind]} ${e.label}`;
}
const ko = { figure: "图", table: "表", formula: "公式", text: "文字" }, rt = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function zm(e, t, n) {
  const r = Rt(e, t, n), o = r ? gt(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = Ka({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function Fm(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, c = null;
  for (const u of e) {
    const f = Rt(u, t, n), d = f ? gt(f, 1, 1) : null;
    !f || !d || (r || (r = f.box.page, c = f.pageSize), f.box.page === r && (o = Math.min(o, d.left), a = Math.min(a, d.top), s = Math.max(s, d.left + d.width), i = Math.max(i, d.top + d.height)));
  }
  if (!r || !c) return null;
  const l = Ka({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: l, aspect: l.height * c.height / Math.max(1e-6, l.width * c.width) };
}
function Bm(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function jm(e, t) {
  const n = (o) => {
    const a = Ue(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function Hm({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var P;
  const i = t.find((T) => T.itemId === e) ?? null, c = W(() => i ? jm(t, i) : [], [t, i]), l = i ? c.indexOf(i) : -1, [u, f] = N(rt.indexOf(1)), d = rt[u], m = x(null), [g, h] = N(0);
  xe(() => {
    const T = m.current;
    if (!T) return;
    const k = () => h(T.clientWidth);
    k();
    const E = typeof ResizeObserver == "function" ? new ResizeObserver(k) : null;
    return E == null || E.observe(T), () => E == null ? void 0 : E.disconnect();
  }, []);
  const y = A((T) => {
    const k = c[l + T];
    k && a(k.itemId);
  }, [c, l, a]);
  z(() => {
    const T = (k) => {
      if (k.key === "Escape")
        k.preventDefault(), s();
      else if (k.key === "ArrowLeft")
        k.preventDefault(), y(-1);
      else if (k.key === "ArrowRight")
        k.preventDefault(), y(1);
      else if (k.key === "+" || k.key === "=")
        k.preventDefault(), f((E) => Math.min(rt.length - 1, E + 1));
      else if (k.key === "-" || k.key === "_")
        k.preventDefault(), f((E) => Math.max(0, E - 1));
      else if (k.key === "0")
        k.preventDefault(), f(rt.indexOf(1));
      else
        return;
      k.stopPropagation();
    };
    return window.addEventListener("keydown", T, !0), () => window.removeEventListener("keydown", T, !0);
  }, [s, y]), z(() => {
    const T = m.current;
    if (!T) return;
    const k = (E) => {
      !E.ctrlKey && !E.metaKey || (E.preventDefault(), f((_) => Math.max(0, Math.min(rt.length - 1, _ + (E.deltaY < 0 ? 1 : -1)))));
    };
    return T.addEventListener("wheel", k, { passive: !1 }), () => T.removeEventListener("wheel", k);
  }, []);
  const I = x(null);
  if (!i) return null;
  const S = Ue(i), b = o.map((T) => ({ pane: T, pdf: r[T] ?? null, where: zm(i, n, T) })).filter((T) => !!(T.pdf && T.where)), w = 16, v = typeof window > "u" ? 800 : window.innerHeight, R = Math.min(880, v * 0.9) - 56 - 32 - (b.length > 1 ? 26 : 0), C = b.length ? Bm(Math.max(120, (g - w * (b.length - 1) - 32) / b.length), R, b.map((T) => T.where.aspect)) : 0, M = ((P = b[0]) == null ? void 0 : P.where.page) ?? i.source.page;
  return /* @__PURE__ */ L("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${ko[S] ?? "这一块"}`, children: [
    /* @__PURE__ */ p("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ L("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ L("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ L("span", { className: "reader-zoom-title", children: [
          ko[S] ?? "这一块",
          " · 第 ",
          M,
          " 页"
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-zoom-count", children: l >= 0 ? `${l + 1} / ${c.length}` : "" }),
        /* @__PURE__ */ L("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: l <= 0, onClick: () => y(-1), children: /* @__PURE__ */ p(Zo, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: l < 0 || l >= c.length - 1, onClick: () => y(1), children: /* @__PURE__ */ p(ra, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => f((T) => Math.max(0, T - 1)), children: /* @__PURE__ */ p(oa, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ L(oe, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => f(rt.indexOf(1)), children: [
            Math.round(d * 100),
            "%"
          ] }),
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === rt.length - 1, onClick: () => f((T) => Math.min(rt.length - 1, T + 1)), children: /* @__PURE__ */ p(aa, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: s, children: /* @__PURE__ */ p(At, { size: 16, "aria-hidden": !0 }) })
        ] })
      ] }),
      /* @__PURE__ */ p(
        "div",
        {
          ref: m,
          className: "reader-zoom-body",
          onPointerDown: (T) => {
            const k = m.current;
            !k || T.button !== 0 || (I.current = { x: T.clientX, y: T.clientY, left: k.scrollLeft, top: k.scrollTop }, k.setPointerCapture(T.pointerId));
          },
          onPointerMove: (T) => {
            const k = m.current, E = I.current;
            !k || !E || (k.scrollLeft = E.left - (T.clientX - E.x), k.scrollTop = E.top - (T.clientY - E.y));
          },
          onPointerUp: () => {
            I.current = null;
          },
          children: b.length && g ? /* @__PURE__ */ p("div", { className: "reader-zoom-columns", style: { gap: w }, children: b.map(({ pane: T, pdf: k, where: E }) => /* @__PURE__ */ L("figure", { className: "reader-zoom-column", children: [
            b.length > 1 ? /* @__PURE__ */ p("figcaption", { children: T === "source" ? "原文" : "译文" }) : null,
            /* @__PURE__ */ p(
              Va,
              {
                className: "reader-zoom-canvas",
                pdf: k,
                page: E.page,
                region: E.fraction,
                cssWidth: C * d,
                label: `${T === "source" ? "原文" : "译文"}第 ${E.page} 页`
              }
            )
          ] }, T)) }) : /* @__PURE__ */ p("p", { className: "reader-zoom-empty", children: g ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
const Um = 380, Km = 320, vt = 8;
function Wm(e, t, n) {
  const r = Math.max(vt, Math.min(e.left, n.width - t.width - vt)), o = e.bottom + vt, a = o + t.height <= n.height - vt ? o : Math.max(vt, e.top - vt - t.height);
  return { left: r, top: a };
}
function Vm({
  preview: e,
  regions: t,
  metadata: n,
  documents: r
}) {
  const o = e.target.itemIds.map((d) => t.find((m) => m.itemId === d)).filter((d) => !!d);
  if (!o.length) return null;
  const a = e.pane === "source" ? ["source", "translated"] : ["translated", "source"];
  let s = null;
  for (const d of a) {
    const m = r[d], g = m ? Fm(o, n, d) : null;
    if (m && g) {
      s = { pdf: m, where: g };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min(Um, Km / Math.max(0.05, s.where.aspect))), c = Math.round(i * s.where.aspect) + 30, l = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: f } = Wm(e.anchor, { width: Math.max(i, 160) + 16, height: c + 16 }, l);
  return /* @__PURE__ */ L("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: f }, children: [
    /* @__PURE__ */ L("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ p("span", { children: Io(e.target) }),
      /* @__PURE__ */ L("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ p(Va, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: Io(e.target) })
  ] });
}
const qm = 250;
function Jm(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function Gm(e, t, n) {
  const r = n === "back" ? e.back : e.forward;
  if (!r.length) return null;
  const o = r[r.length - 1], a = r.slice(0, -1), s = n === "back" ? { back: a, forward: [...e.forward, t] } : { back: [...e.back, t], forward: a };
  return { to: o, history: s };
}
function Xm(e) {
  var n;
  const t = e;
  return !!((n = t == null ? void 0 : t.closest) != null && n.call(t, "input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
function Ym({
  shellEl: e,
  index: t,
  primaryPane: n,
  follow: r
}) {
  const [o, a] = N(null), [s, i] = N({ back: [], forward: [] }), c = x(s);
  c.current = s;
  const l = x(null), u = x({ index: t, primaryPane: n, follow: r, shellEl: e });
  u.current = { index: t, primaryPane: n, follow: r, shellEl: e };
  const f = A(() => {
    const { shellEl: m, primaryPane: g } = u.current;
    return Ht(m, g);
  }, []);
  z(() => {
    if (!e) return;
    const m = (b) => {
      var w, v;
      return (v = (w = b.target) == null ? void 0 : w.closest) == null ? void 0 : v.call(w, `.${Za}`);
    }, g = () => {
      l.current != null && window.clearTimeout(l.current), l.current = null;
    }, h = (b) => {
      var C;
      const w = m(b);
      if (!w) return;
      const v = u.current.index.get(w.getAttribute(Jn) || "");
      if (!v) return;
      const R = ((C = w.closest("[data-reader-pane]")) == null ? void 0 : C.getAttribute("data-reader-pane")) || u.current.primaryPane;
      g(), l.current = window.setTimeout(() => {
        const M = w.getBoundingClientRect();
        a({ target: v, pane: R, anchor: { left: M.left, top: M.top, right: M.right, bottom: M.bottom } });
      }, qm);
    }, y = (b) => {
      const w = m(b);
      !w || w.contains(b.relatedTarget) || (g(), a(null));
    }, I = (b) => {
      var M, P;
      const w = m(b);
      if (!w || b.button !== 0 || b.metaKey || b.ctrlKey || b.shiftKey || `${((M = window.getSelection) == null ? void 0 : M.call(window)) || ""}`.trim()) return;
      const v = u.current.index.get(w.getAttribute(Jn) || "");
      if (!v) return;
      b.preventDefault(), b.stopPropagation(), g(), a(null);
      const R = ((P = w.closest("[data-reader-pane]")) == null ? void 0 : P.getAttribute("data-reader-pane")) || u.current.primaryPane, C = f();
      C && i((T) => Jm(T, C)), u.current.follow(v, R);
    }, S = () => {
      g(), a(null);
    };
    return e.addEventListener("pointerover", h), e.addEventListener("pointerout", y), e.addEventListener("click", I, !0), e.addEventListener("scroll", S, { passive: !0 }), () => {
      g(), e.removeEventListener("pointerover", h), e.removeEventListener("pointerout", y), e.removeEventListener("click", I, !0), e.removeEventListener("scroll", S);
    };
  }, [e, f]);
  const d = A((m) => {
    const g = f();
    if (!g) return !1;
    const h = Gm(c.current, g, m);
    if (!h) return !1;
    const { shellEl: y, primaryPane: I } = u.current;
    return Mt(y, h.to, "auto", I) ? (i(h.history), !0) : !1;
  }, [f]);
  return z(() => {
    const m = (g) => {
      if (!g.altKey || g.metaKey || g.ctrlKey || g.shiftKey || g.defaultPrevented || g.key !== "ArrowLeft" && g.key !== "ArrowRight" || Xm(g.target)) return;
      d(g.key === "ArrowLeft" ? "back" : "forward") && g.preventDefault();
    };
    return window.addEventListener("keydown", m), () => window.removeEventListener("keydown", m);
  }, [d]), {
    preview: o,
    closePreview: A(() => a(null), []),
    canGoBack: s.back.length > 0,
    backPage: s.back.length ? s.back[s.back.length - 1].page : null,
    goBack: A(() => d("back"), [d])
  };
}
const Zm = [
  { keys: "Alt+←", desc: "点了引用跳过去以后，回到原处" },
  { keys: "Alt+→", desc: "再跳回去" }
];
function Qm() {
  const e = en(), t = W(() => Lm(e.regions), [e.regions]), { jumpToBlock: n } = e, r = A((s, i) => n(s.itemId, i), [n]), o = Ym({ shellEl: e.shellEl, index: t, primaryPane: e.primaryPane, follow: r }), a = W(() => ({
    // 书里一个认得出去处的引用都没有，就不改文字层（react-pdf 照原样画，不多一遍 innerHTML）。
    textMarks: t.size ? (s) => $m(s, t) : void 0,
    shortcuts: Zm
  }), [t]);
  return kn(a), /* @__PURE__ */ L($e, { children: [
    o.preview ? /* @__PURE__ */ p(Vm, { preview: o.preview, regions: e.regions, metadata: e.metadata, documents: e.pdfDocuments }) : null,
    o.canGoBack ? /* @__PURE__ */ L(oe, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => o.goBack(), children: [
      /* @__PURE__ */ p(li, { size: 14, "aria-hidden": !0 }),
      " 回到第 ",
      o.backPage,
      " 页"
    ] }) : null
  ] });
}
const eh = { id: "xrefs", title: "引用（「图 2.1」「式 (3.21)」）", Component: Qm }, hr = [Im, Pm, im, eh, Zf];
function pr(e = hr) {
  return e.flatMap((t) => (t.panels ?? []).map(({ id: n, label: r, short: o, Icon: a, needsJob: s }) => ({ id: n, label: r, short: o, Icon: a, needsJob: s })));
}
function th(e) {
  const t = Ge(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p($e, { children: (e.tabs ?? pr()).map(({ id: s, label: i, Icon: c, needsJob: l }) => {
    const u = n === s, f = l && r, d = u ? `收起${i}` : `打开${i}`;
    return /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: "reader-panel-toggle",
        "aria-label": d,
        "aria-pressed": u,
        title: f ? `${i} 需打开任务阅读` : i,
        disabled: f,
        onClick: () => u ? a() : o(s),
        children: /* @__PURE__ */ p(c, { className: "reader-close-home-icon", ...Te, "aria-hidden": !0 })
      },
      s
    );
  }) });
}
function nh(e) {
  const t = Ge(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = pr().map(({ id: c, label: l, short: u, Icon: f, needsJob: d }) => ({
    key: c,
    label: l,
    short: u,
    Icon: f,
    disabled: d && o,
    selected: n === c,
    badge: r == null ? void 0 : r[c],
    onClick: () => a(c)
  }));
  return n ? /* @__PURE__ */ L("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ p("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: c, label: l, Icon: u, disabled: f, selected: d, badge: m, onClick: g }) => /* @__PURE__ */ L(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": d,
        className: `reader-assistant-dock-tab${d ? " is-active" : ""}`,
        title: f ? `${l} 需打开任务阅读` : l,
        disabled: f,
        onClick: g,
        children: [
          /* @__PURE__ */ p(u, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
          /* @__PURE__ */ p("span", { className: "reader-assistant-dock-tab-label", children: l }),
          m ? /* @__PURE__ */ p("span", { className: "reader-assistant-dock-badge", children: m }) : null
        ]
      },
      c
    )) }),
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: "reader-assistant-dock-close",
        "aria-label": "关闭阅读辅助面板",
        title: "关闭辅助面板",
        onClick: s,
        children: /* @__PURE__ */ p(At, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function rh(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function oh(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function ah(e) {
  return e / 100 * window.innerHeight;
}
function sh(e) {
  return e / 100 * window.innerWidth;
}
function ih(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function jt({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = ih(n);
  switch (a) {
    case "%": {
      r = o / 100 * e;
      break;
    }
    case "px": {
      r = o;
      break;
    }
    case "rem": {
      r = oh(t, o);
      break;
    }
    case "em": {
      r = rh(t, o);
      break;
    }
    case "vh": {
      r = ah(o);
      break;
    }
    case "vw": {
      r = sh(o);
      break;
    }
  }
  return r;
}
function Ae(e) {
  return parseFloat(e.toFixed(3));
}
function _t({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function Xn(e) {
  const { panels: t } = e, n = _t({ group: e });
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
    const { element: o, panelConstraints: a } = r;
    let s = 0;
    if (a.collapsedSize !== void 0) {
      const u = jt({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = Ae(u / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const u = jt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = Ae(u / n * 100);
    }
    let c = 0;
    if (a.minSize !== void 0) {
      const u = jt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      c = Ae(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = jt({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      l = Ae(u / n * 100);
    }
    return {
      groupResizeBehavior: a.groupResizeBehavior,
      collapsedSize: s,
      collapsible: a.collapsible === !0,
      defaultSize: i,
      disabled: a.disabled,
      minSize: c,
      maxSize: l,
      panelId: r.id
    };
  });
}
function pe(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function Yn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? ch : lh
  );
}
function ch(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function lh(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function Qa(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function es(e, t) {
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
function uh({
  orientation: e,
  rects: t,
  targetRect: n
}) {
  const r = {
    x: n.x + n.width / 2,
    y: n.y + n.height / 2
  };
  let o, a = Number.MAX_VALUE;
  for (const s of t) {
    const { x: i, y: c } = es(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return pe(o, "No rect found"), o;
}
let an;
function dh() {
  return an === void 0 && (typeof matchMedia == "function" ? an = !!matchMedia("(pointer:coarse)").matches : an = !1), an;
}
function ts(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Yn(
    n,
    Array.from(t.children).filter(Qa).map((g) => ({ element: g }))
  ).map(({ element: g }) => g), s = [];
  let i = !1, c = !1, l = -1, u = -1, f = 0, d, m = [];
  {
    let g = -1;
    for (const h of a)
      h.hasAttribute("data-panel") && (g++, h.hasAttribute("data-disabled") || (f++, l === -1 && (l = g), u = g));
  }
  if (f > 1) {
    let g = -1;
    for (const h of a)
      if (h.hasAttribute("data-panel")) {
        g++;
        const y = r.find(
          (I) => I.element === h
        );
        if (y) {
          if (d) {
            const I = d.element.getBoundingClientRect(), S = h.getBoundingClientRect();
            let b;
            if (c) {
              const w = n === "horizontal" ? new DOMRect(
                I.right,
                I.top,
                0,
                I.height
              ) : new DOMRect(
                I.left,
                I.bottom,
                I.width,
                0
              ), v = n === "horizontal" ? new DOMRect(S.left, S.top, 0, S.height) : new DOMRect(S.left, S.top, S.width, 0);
              switch (m.length) {
                case 0: {
                  b = [
                    w,
                    v
                  ];
                  break;
                }
                case 1: {
                  const R = m[0], C = uh({
                    orientation: n,
                    rects: [I, S],
                    targetRect: R.element.getBoundingClientRect()
                  });
                  b = [
                    R,
                    C === I ? v : w
                  ];
                  break;
                }
                default: {
                  b = m;
                  break;
                }
              }
            } else
              m.length ? b = m : b = [
                n === "horizontal" ? new DOMRect(
                  I.right,
                  S.top,
                  S.left - I.right,
                  S.height
                ) : new DOMRect(
                  S.left,
                  I.bottom,
                  S.width,
                  S.top - I.bottom
                )
              ];
            for (const w of b) {
              let v = "width" in w ? w : w.element.getBoundingClientRect();
              const R = dh() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (v.width < R) {
                const M = R - v.width;
                v = new DOMRect(
                  v.x - M / 2,
                  v.y,
                  v.width + M,
                  v.height
                );
              }
              if (v.height < R) {
                const M = R - v.height;
                v = new DOMRect(
                  v.x,
                  v.y - M / 2,
                  v.width,
                  v.height + M
                );
              }
              const C = g <= l || g > u;
              !i && !C && s.push({
                group: e,
                groupSize: _t({ group: e }),
                panels: [d, y],
                separator: "width" in w ? void 0 : w,
                rect: v
              }), i = !1;
            }
          }
          c = !1, d = y, m = [];
        }
      } else if (h.hasAttribute("data-separator")) {
        h.ariaDisabled !== null && (i = !0);
        const y = o.find(
          (I) => I.element === h
        );
        y ? m.push(y) : (d = void 0, m = []);
      } else
        c = !0;
  }
  return s;
}
var at;
class ns {
  constructor() {
    Lr(this, at, {});
  }
  addListener(t, n) {
    const r = xt(this, at)[t];
    return r === void 0 ? xt(this, at)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = xt(this, at)[t];
    if (r !== void 0)
      if (r.length === 1)
        r[0].call(null, n);
      else {
        let o = !1, a = null;
        const s = Array.from(r);
        for (let i = 0; i < s.length; i++) {
          const c = s[i];
          try {
            c.call(null, n);
          } catch (l) {
            a === null && (o = !0, a = l);
          }
        }
        if (o)
          throw a;
      }
  }
  removeAllListeners() {
    Cr(this, at, {});
  }
  removeListener(t, n) {
    const r = xt(this, at)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
at = new WeakMap();
let Et = {
  cursorFlags: 0,
  state: "inactive"
};
const gr = new ns();
function mt() {
  return Et;
}
function fh(e) {
  return gr.addListener("change", e);
}
function mh(e) {
  const t = Et, n = { ...Et };
  n.cursorFlags = e, Et = n, gr.emit("change", {
    prev: t,
    next: n
  });
}
function Pt(e) {
  const t = Et;
  Et = e, gr.emit("change", {
    prev: t,
    next: e
  });
}
const hh = (e) => e, Cn = () => {
}, rs = 1, os = 2, as = 4, ss = 8, To = 3, Eo = 12;
let sn;
function Po() {
  return sn === void 0 && (sn = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (sn = !0)), sn;
}
function ph({
  cursorFlags: e,
  groups: t,
  state: n
}) {
  let r = 0, o = 0;
  switch (n) {
    case "active":
    case "hover":
      t.forEach((a) => {
        if (!a.mutableState.disableCursor)
          switch (a.orientation) {
            case "horizontal": {
              r++;
              break;
            }
            case "vertical": {
              o++;
              break;
            }
          }
      });
  }
  if (!(r === 0 && o === 0)) {
    switch (n) {
      case "active": {
        if (e && Po()) {
          const a = (e & rs) !== 0, s = (e & os) !== 0, i = (e & as) !== 0, c = (e & ss) !== 0;
          if (a)
            return i ? "se-resize" : c ? "ne-resize" : "e-resize";
          if (s)
            return i ? "sw-resize" : c ? "nw-resize" : "w-resize";
          if (i)
            return "s-resize";
          if (c)
            return "n-resize";
        }
        break;
      }
    }
    return Po() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const Ro = /* @__PURE__ */ new WeakMap();
function br(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = Ro.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = mt();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = ph({
        cursorFlags: r.cursorFlags,
        groups: r.hitRegions.map((s) => s.group),
        state: r.state
      }), a = `*, *:hover {cursor: ${o} !important; }`;
      if (t === a)
        return;
      t = a, o ? n.cssRules.length === 0 ? n.insertRule(a) : n.replaceSync(a) : n.cssRules.length === 1 && n.deleteRule(0);
      break;
    }
    case "inactive": {
      t = void 0, n.cssRules.length === 1 && n.deleteRule(0);
      break;
    }
  }
  Ro.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let qe = /* @__PURE__ */ new Map();
const is = new ns();
function gh(e) {
  qe = new Map(qe), qe.delete(e);
}
function Mo(e, t) {
  for (const [n] of qe)
    if (n.id === e)
      return n;
}
function it(e, t) {
  for (const [n, r] of qe)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function bt() {
  return qe;
}
function yr(e, t) {
  return is.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function tt(e, t, n) {
  const r = qe.get(e);
  qe = new Map(qe), qe.set(e, t), is.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function cs(e) {
  const t = mt();
  let n = !1;
  switch (t.state) {
    case "active":
      Pt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (br(e), n = !0, t.hitRegions.forEach((r) => {
        const o = it(r.group.id, !0);
        tt(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function _o(e) {
  e.defaultPrevented || cs(e.currentTarget);
}
function bh(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = es(n, a.rect);
    switch (e) {
      case "horizontal": {
        s.x <= o.x && (r = a, o = s);
        break;
      }
      case "vertical": {
        s.y <= o.y && (r = a, o = s);
        break;
      }
    }
  }
  return r ? {
    distance: o,
    hitRegion: r
  } : void 0;
}
function yh(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function vh(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: xo(e),
    b: xo(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  pe(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: Ao(No(n.a)),
    b: Ao(No(n.b))
  };
  if (o.a === o.b) {
    const a = r.childNodes, s = {
      a: n.a.at(-1),
      b: n.b.at(-1)
    };
    let i = a.length;
    for (; i--; ) {
      const c = a[i];
      if (c === s.a) return 1;
      if (c === s.b) return -1;
    }
  }
  return Math.sign(o.a - o.b);
}
const wh = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function Sh(e) {
  const t = getComputedStyle(ls(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function Ih(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || Sh(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || wh.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function No(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (pe(n, "Missing node"), Ih(n)) return n;
  }
  return null;
}
function Ao(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function xo(e) {
  const t = [];
  for (; e; )
    t.push(e), e = ls(e);
  return t;
}
function ls(e) {
  const { parentNode: t } = e;
  return yh(t) ? t.host : t;
}
function kh(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Th({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!Qa(n) || n.contains(e) || e.contains(n))
    return !0;
  if (vh(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (kh(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function vr(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = ts(o), s = bh(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Th({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function Eh(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function Me(e, t, n = 0) {
  return Math.abs(Ae(e) - Ae(t)) <= n;
}
function Ve(e, t) {
  return Me(e, t) ? 0 : e > t ? 1 : -1;
}
function kt({
  overrideDisabledPanels: e,
  panelConstraints: t,
  prevSize: n,
  size: r
}) {
  const {
    collapsedSize: o = 0,
    collapsible: a,
    disabled: s,
    maxSize: i = 100,
    minSize: c = 0
  } = t;
  if (s && !e)
    return n;
  if (Ve(r, c) < 0)
    if (a) {
      const l = (o + c) / 2;
      Ve(r, l) < 0 ? r = o : r = c;
    } else
      r = c;
  return r = Math.min(i, r), r = Ae(r), r;
}
function Jt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (Me(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), c = Object.values(o), l = [...i], [u, f] = r;
  pe(u != null, "Invalid first pivot index"), pe(f != null, "Invalid second pivot index");
  let d = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? f : u, y = n[h];
        pe(
          y,
          `Panel constraints not found for index ${h}`
        );
        const {
          collapsedSize: I = 0,
          collapsible: S,
          minSize: b = 0
        } = y;
        if (S) {
          const w = i[h];
          if (pe(
            w != null,
            `Previous layout not found for panel index ${h}`
          ), Me(w, I)) {
            const v = b - w;
            Ve(v, Math.abs(e)) > 0 && (e = e < 0 ? 0 - v : v);
          }
        }
      }
      {
        const h = e < 0 ? u : f, y = n[h];
        pe(
          y,
          `No panel constraints found for index ${h}`
        );
        const {
          collapsedSize: I = 0,
          collapsible: S,
          minSize: b = 0
        } = y;
        if (S) {
          const w = i[h];
          if (pe(
            w != null,
            `Previous layout not found for panel index ${h}`
          ), Me(w, b)) {
            const v = w - I;
            Ve(v, Math.abs(e)) > 0 && (e = e < 0 ? 0 - v : v);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? f : u, y = n[h];
      pe(
        y,
        `Panel constraints not found for index ${h}`
      );
      const I = i[h], { collapsible: S, collapsedSize: b, minSize: w } = y;
      if (S && Ve(I, w) < 0)
        if (e > 0) {
          const v = w - b, R = v / 2, C = I + e;
          Ve(C, w) < 0 && (e = Ve(e, R) <= 0 ? 0 : v);
        } else {
          const v = w - b, R = 100 - v / 2, C = I - e;
          Ve(C, w) < 0 && (e = Ve(100 + e, R) > 0 ? 0 : -v);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let y = e < 0 ? f : u, I = 0;
    for (; ; ) {
      const b = i[y];
      pe(
        b != null,
        `Previous layout not found for panel index ${y}`
      );
      const w = kt({
        overrideDisabledPanels: s,
        panelConstraints: n[y],
        prevSize: b,
        size: 100
      }) - b;
      if (I += w, y += h, y < 0 || y >= n.length)
        break;
    }
    const S = Math.min(Math.abs(e), Math.abs(I));
    e = e < 0 ? 0 - S : S;
  }
  {
    let h = e < 0 ? u : f;
    for (; h >= 0 && h < n.length; ) {
      const y = Math.abs(e) - Math.abs(d), I = i[h];
      pe(
        I != null,
        `Previous layout not found for panel index ${h}`
      );
      const S = I - y, b = kt({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: I,
        size: S
      });
      if (!Me(I, b) && (d += I - b, l[h] = b, d.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (Eh(c, l))
    return o;
  {
    const h = e < 0 ? f : u, y = i[h];
    pe(
      y != null,
      `Previous layout not found for panel index ${h}`
    );
    const I = y + d, S = kt({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: y,
      size: I
    });
    if (l[h] = S, !Me(S, I)) {
      let b = I - S, w = e < 0 ? f : u;
      for (; w >= 0 && w < n.length; ) {
        const v = l[w];
        pe(
          v != null,
          `Previous layout not found for panel index ${w}`
        );
        const R = v + b, C = kt({
          overrideDisabledPanels: s,
          panelConstraints: n[w],
          prevSize: v,
          size: R
        });
        if (Me(v, C) || (b -= C - v, l[w] = C), Me(b, 0))
          break;
        e > 0 ? w-- : w++;
      }
    }
  }
  const m = Object.values(l).reduce(
    (h, y) => y + h,
    0
  );
  if (!Me(m, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return l.reduce((h, y, I) => (h[g[I]] = y, h), {});
}
function ht(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || Ve(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function pt({
  layout: e,
  panelConstraints: t
}) {
  const n = Object.values(e), r = [...n], o = r.reduce(
    (i, c) => i + c,
    0
  );
  if (r.length !== t.length)
    throw Error(
      `Invalid ${t.length} panel layout: ${r.map((i) => `${i}%`).join(", ")}`
    );
  if (!Me(o, 100) && r.length > 0)
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      pe(c != null, `No layout data found for index ${i}`);
      const l = 100 / o * c;
      r[i] = l;
    }
  let a = 0;
  for (let i = 0; i < t.length; i++) {
    const c = n[i];
    pe(c != null, `No layout data found for index ${i}`);
    const l = r[i];
    pe(l != null, `No layout data found for index ${i}`);
    const u = kt({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: c,
      size: l
    });
    l != u && (a += l - u, r[i] = u);
  }
  if (!Me(a, 0))
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      pe(c != null, `No layout data found for index ${i}`);
      const l = c + a, u = kt({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: c,
        size: l
      });
      if (c !== u && (a -= u - c, r[i] = u, Me(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, c, l) => (i[s[l]] = c, i), {});
}
function us({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const c = bt();
    for (const [
      l,
      {
        defaultLayoutDeferred: u,
        derivedPanelConstraints: f,
        layout: d,
        groupSize: m,
        separatorToPanels: g
      }
    ] of c)
      if (l.id === e)
        return {
          defaultLayoutDeferred: u,
          derivedPanelConstraints: f,
          group: l,
          groupSize: m,
          layout: d,
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
  }, o = () => {
    const c = n().group.panels.find((l) => l.id === t);
    if (c !== void 0)
      return c;
    throw Error(`Layout not found for Panel ${t}`);
  }, a = () => {
    const c = n().layout[t];
    if (c !== void 0)
      return c;
    throw Error(`Layout not found for Panel ${t}`);
  }, s = ({
    nextSize: c,
    panels: l,
    prevLayout: u,
    derivedPanelConstraints: f
  }) => {
    const d = a(), m = l.findIndex((y) => y.id === t), g = m === 0, h = m === l.length - 1;
    if (h && c < d && (g || l.slice(0, m).every((y, I) => {
      const S = f[I];
      return (S == null ? void 0 : S.collapsible) && Me(S.collapsedSize, u[S.panelId]);
    }))) {
      const y = l.slice(0, m).reduce((I, S) => I + u[S.id], 0);
      return {
        ...u,
        [t]: Ae(100 - y)
      };
    }
    return Jt({
      delta: h ? d - c : c - d,
      initialLayout: u,
      panelConstraints: f,
      pivotIndices: h ? [m - 1, m] : [m, m + 1],
      prevLayout: u,
      trigger: "imperative-api"
    });
  }, i = (c) => {
    const l = a();
    if (c === l)
      return;
    const {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: f,
      group: d,
      groupSize: m,
      layout: g,
      separatorToPanels: h
    } = n(), y = s({
      nextSize: c,
      panels: d.panels,
      prevLayout: g,
      derivedPanelConstraints: f
    }), I = pt({
      layout: y,
      panelConstraints: f
    });
    ht(g, I) || tt(d, {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: f,
      groupSize: m,
      layout: I,
      separatorToPanels: h
    });
  };
  return {
    collapse: () => {
      const { collapsible: c, collapsedSize: l } = r(), { mutableValues: u } = o(), f = a();
      c && f !== l && (u.expandToSize = f, i(l));
    },
    expand: () => {
      const { collapsible: c, collapsedSize: l, minSize: u } = r(), { mutableValues: f } = o(), d = a();
      if (c && d === l) {
        let m = f.expandToSize ?? u;
        m === 0 && (m = 1), i(m);
      }
    },
    getSize: () => {
      const { group: c } = n(), l = a(), { element: u } = o(), f = c.orientation === "horizontal" ? u.offsetWidth : u.offsetHeight;
      return {
        asPercentage: l,
        inPixels: f
      };
    },
    isCollapsed: () => {
      const { collapsible: c, collapsedSize: l } = r(), u = a();
      return c && Me(l, u);
    },
    resize: (c) => {
      const { group: l } = n(), { element: u } = o(), f = _t({ group: l }), d = jt({
        groupSize: f,
        panelElement: u,
        styleProp: c
      }), m = Ae(d / f * 100);
      i(m);
    }
  };
}
function Lo(e) {
  if (e.defaultPrevented)
    return;
  const t = bt();
  vr(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = us({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function cn(e) {
  const t = bt();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function ds({
  groupId: e
}) {
  const t = () => {
    const n = bt();
    for (const [r, o] of n)
      if (r.id === e)
        return { group: r, ...o };
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
        derivedPanelConstraints: o,
        group: a,
        groupSize: s,
        layout: i,
        separatorToPanels: c
      } = t(), l = pt({
        layout: n,
        panelConstraints: o
      });
      return r ? i : (ht(i, l) || tt(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: l,
        separatorToPanels: c
      }), l);
    }
  };
}
function lt(e, t) {
  const n = cn(e), r = it(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  pe(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  pe(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), i = ds({ groupId: n.id }).getLayout(), c = Jt({
    delta: t,
    initialLayout: i,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: i,
    trigger: "keyboard"
  }), l = pt({
    layout: c,
    panelConstraints: r.derivedPanelConstraints
  });
  ht(i, l) || tt(
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
function Co(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = cn(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && lt(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && lt(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && lt(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && lt(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), lt(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = cn(t), o = it(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, c = r.separators.find(
          (d) => d.element === t
        );
        pe(c, "Matching separator not found");
        const l = i.get(c);
        pe(l, "Matching panels not found");
        const u = l[0], f = a.find(
          (d) => d.panelId === u.id
        );
        if (pe(f, "Panel metadata not found"), f.collapsible) {
          const d = s[u.id], m = f.collapsedSize === d ? r.mutableState.expandedPanelSizes[u.id] ?? f.minSize : f.collapsedSize;
          lt(t, m - d);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = cn(t).separators.map(
          (s) => s.element
        ), o = Array.from(r).findIndex(
          (s) => s === e.currentTarget
        );
        pe(o !== null, "Index not found");
        const a = e.shiftKey ? o > 0 ? o - 1 : r.length - 1 : o + 1 < r.length ? o + 1 : 0;
        r[a].focus({
          preventScroll: !0
        });
        break;
      }
      case "Home": {
        e.preventDefault(), lt(t, -100);
        break;
      }
    }
}
function Do(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = bt(), n = vr(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), Pt({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function fs({
  document: e,
  event: t,
  hitRegions: n,
  initialLayoutMap: r,
  mountedGroups: o,
  pointerDownAtPoint: a,
  prevCursorFlags: s
}) {
  let i = 0;
  n.forEach((l) => {
    const { group: u, groupSize: f } = l, { orientation: d, panels: m } = u, { disableCursor: g } = u.mutableState;
    let h = 0;
    a ? d === "horizontal" ? h = (t.clientX - a.x) / f * 100 : h = (t.clientY - a.y) / f * 100 : d === "horizontal" ? h = t.clientX < 0 ? -100 : 100 : h = t.clientY < 0 ? -100 : 100;
    const y = r.get(u), I = o.get(u);
    if (!y || !I)
      return;
    const {
      defaultLayoutDeferred: S,
      derivedPanelConstraints: b,
      groupSize: w,
      layout: v,
      separatorToPanels: R
    } = I;
    if (b && v && R) {
      const C = Jt({
        delta: h,
        initialLayout: y,
        panelConstraints: b,
        pivotIndices: l.panels.map((M) => m.indexOf(M)),
        prevLayout: v,
        trigger: "mouse-or-touch"
      });
      if (ht(C, v)) {
        if (h !== 0 && !g)
          switch (d) {
            case "horizontal": {
              i |= h < 0 ? rs : os;
              break;
            }
            case "vertical": {
              i |= h < 0 ? as : ss;
              break;
            }
          }
      } else
        tt(l.group, {
          defaultLayoutDeferred: S,
          derivedPanelConstraints: b,
          groupSize: w,
          layout: C,
          separatorToPanels: R
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & To : c |= i & To, t.movementY === 0 ? c |= s & Eo : c |= i & Eo, mh(c), br(e);
}
function $o(e) {
  const t = bt(), n = mt();
  switch (n.state) {
    case "active":
      fs({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function Oo(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = mt(), n = bt();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        Pt({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = it(a.group.id, !0);
          tt(a.group, s, {
            isUserInteraction: !0
          });
        });
        return;
      }
      for (const a of t.hitRegions)
        if (a.separator) {
          const { element: s } = a.separator;
          (r = s.hasPointerCapture) != null && r.call(s, e.pointerId) || ((o = s.setPointerCapture) == null || o.call(s, e.pointerId));
        }
      fs({
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
      const a = vr(e, n);
      a.length === 0 ? t.state !== "inactive" && Pt({
        cursorFlags: 0,
        state: "inactive"
      }) : Pt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), br(e.currentTarget);
      break;
    }
  }
}
function zo(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (mt().state) {
      case "hover":
        Pt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function Fo(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || cs(e.currentTarget) && e.preventDefault();
}
function Bo(e) {
  let t = 0, n = 0;
  const r = {};
  for (const a of e)
    if (a.defaultSize !== void 0) {
      t++;
      const s = Ae(a.defaultSize);
      n += s, r[a.panelId] = s;
    } else
      r[a.panelId] = void 0;
  const o = e.length - t;
  if (o !== 0) {
    const a = Ae((100 - n) / o);
    for (const s of e)
      s.defaultSize === void 0 && (r[s.panelId] = a);
  }
  return r;
}
function Ph(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((c) => c.element === t);
  if (!r || !r.onResize)
    return;
  const o = _t({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: Ae(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function Rh(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function Mh({
  group: e,
  nextGroupSize: t,
  prevGroupSize: n,
  prevLayout: r
}) {
  if (n <= 0 || t <= 0 || n === t)
    return r;
  let o = 0, a = 0, s = !1;
  const i = /* @__PURE__ */ new Map(), c = [];
  for (const f of e.panels) {
    const d = r[f.id] ?? 0;
    switch (f.panelConstraints.groupResizeBehavior) {
      case "preserve-pixel-size": {
        s = !0;
        const m = d / 100 * n, g = Ae(
          m / t * 100
        );
        i.set(f.id, g), o += g;
        break;
      }
      case "preserve-relative-size":
      default: {
        c.push(f.id), a += d;
        break;
      }
    }
  }
  if (!s || c.length === 0)
    return r;
  const l = 100 - o, u = { ...r };
  if (i.forEach((f, d) => {
    u[d] = f;
  }), a > 0)
    for (const f of c) {
      const d = r[f] ?? 0;
      u[f] = Ae(
        d / a * l
      );
    }
  else {
    const f = Ae(
      l / c.length
    );
    for (const d of c)
      u[d] = f;
  }
  return u;
}
function _h(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const wt = /* @__PURE__ */ new Map();
function Nh(e) {
  let t = !0;
  pe(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const h of g) {
      const { borderBoxSize: y, target: I } = h;
      if (I === e.element) {
        if (t) {
          const S = _t({ group: e });
          if (S === 0)
            return;
          const b = it(e.id);
          if (!b)
            return;
          const w = Xn(e), v = b.defaultLayoutDeferred ? Bo(w) : b.layout, R = Mh({
            group: e,
            nextGroupSize: S,
            prevGroupSize: b.groupSize,
            prevLayout: v
          }), C = pt({
            layout: R,
            panelConstraints: w
          });
          if (!b.defaultLayoutDeferred && ht(b.layout, C) && Rh(
            b.derivedPanelConstraints,
            w
          ) && b.groupSize === S)
            return;
          tt(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: w,
            groupSize: S,
            layout: C,
            separatorToPanels: b.separatorToPanels
          });
        }
      } else
        Ph(e, I, y);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    pe(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = _t({ group: e }), i = Xn(e), c = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (_h(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[c] ?? l ?? Bo(i), f = pt({
    layout: u,
    panelConstraints: i
  }), d = e.element.ownerDocument;
  wt.set(
    d,
    (wt.get(d) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return ts(e).forEach((g) => {
    g.separator && m.set(g.separator, g.panels);
  }), tt(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: m
  }), e.separators.forEach((g) => {
    pe(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", Co);
  }), wt.get(d) === 1 && (d.addEventListener("contextmenu", _o, !0), d.addEventListener("dblclick", Lo, !0), d.addEventListener("pointerdown", Do, !0), d.addEventListener("pointerleave", $o), d.addEventListener("pointermove", Oo), d.addEventListener("pointerout", zo), d.addEventListener("pointerup", Fo, !0)), function() {
    t = !1, wt.set(
      d,
      Math.max(0, (wt.get(d) ?? 0) - 1)
    ), gh(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", Co);
    }), wt.get(d) || (d.removeEventListener(
      "contextmenu",
      _o,
      !0
    ), d.removeEventListener(
      "dblclick",
      Lo,
      !0
    ), d.removeEventListener(
      "pointerdown",
      Do,
      !0
    ), d.removeEventListener("pointerleave", $o), d.removeEventListener("pointermove", Oo), d.removeEventListener("pointerout", zo), d.removeEventListener("pointerup", Fo, !0)), a.disconnect();
  };
}
function Ah() {
  const [e, t] = N({}), n = A(() => t({}), []);
  return [e, n];
}
function wr(e) {
  const t = Xo();
  return `${e ?? t}`;
}
const yt = typeof window < "u" ? xe : z;
function Ut(e) {
  const t = x(e);
  return yt(() => {
    t.current = e;
  }, [e]), A(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function Sr(...e) {
  return Ut((t) => {
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
function Ir(e) {
  const t = x({ ...e });
  return yt(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const ms = Zt(null);
function xh(e, t) {
  const n = x({
    getLayout: () => ({}),
    setLayout: hh
  });
  rr(t, () => n.current, []), yt(() => {
    Object.assign(
      n.current,
      ds({ groupId: e })
    );
  });
}
function hs({
  children: e,
  className: t,
  defaultLayout: n,
  disableCursor: r,
  disabled: o,
  elementRef: a,
  groupRef: s,
  id: i,
  onLayoutChange: c,
  onLayoutChanged: l,
  orientation: u = "horizontal",
  resizeTargetMinimumSize: f = {
    coarse: 20,
    fine: 10
  },
  style: d,
  ...m
}) {
  const g = x({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), h = Ut((k) => {
    ht(g.current.onLayoutChange, k) || (g.current.onLayoutChange = k, c == null || c(k));
  }), y = Ut(
    (k, E) => {
      ht(g.current.onLayoutChanged, k) || (g.current.onLayoutChanged = k, l == null || l(k, { isUserInteraction: E }));
    }
  ), I = wr(i), S = x(null), [b, w] = Ah(), v = x({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), R = Sr(S, a);
  xh(I, s);
  const C = Ut(
    (k, E) => {
      const _ = mt(), D = Mo(k), $ = it(k);
      if ($) {
        let K = !1;
        switch (_.state) {
          case "active": {
            K = _.hitRegions.some(
              (H) => H.group === D
            );
            break;
          }
        }
        return {
          flexGrow: $.layout[E] ?? 1,
          pointerEvents: K ? "none" : void 0
        };
      }
      if (n != null && n[E])
        return {
          flexGrow: n == null ? void 0 : n[E]
        };
    }
  ), M = Ir({
    defaultLayout: n,
    disableCursor: r
  }), P = W(
    () => ({
      get disableCursor() {
        return !!M.disableCursor;
      },
      getPanelStyles: C,
      id: I,
      orientation: u,
      registerPanel: (k) => {
        const E = v.current;
        return E.panels = Yn(u, [
          ...E.panels,
          k
        ]), w(), () => {
          E.panels = E.panels.filter(
            (_) => _ !== k
          ), w();
        };
      },
      registerSeparator: (k) => {
        const E = v.current;
        return E.separators = Yn(u, [
          ...E.separators,
          k
        ]), w(), () => {
          E.separators = E.separators.filter(
            (_) => _ !== k
          ), w();
        };
      },
      updatePanelProps: (k, { disabled: E }) => {
        const _ = v.current.panels.find(
          (K) => K.id === k
        );
        _ && (_.panelConstraints.disabled = E);
        const D = Mo(I), $ = it(I);
        D && $ && tt(D, {
          ...$,
          derivedPanelConstraints: Xn(D)
        });
      },
      updateSeparatorProps: (k, {
        disabled: E,
        disableDoubleClick: _
      }) => {
        const D = v.current.separators.find(
          ($) => $.id === k
        );
        D && (D.disabled = E, D.disableDoubleClick = _);
      }
    }),
    [C, I, w, u, M]
  ), T = x(null);
  return yt(() => {
    const k = S.current;
    if (k === null)
      return;
    const E = v.current;
    let _;
    if (M.defaultLayout !== void 0 && Object.keys(M.defaultLayout).length === E.panels.length) {
      _ = {};
      for (const ee of E.panels) {
        const ie = M.defaultLayout[ee.id];
        ie !== void 0 && (_[ee.id] = ie);
      }
    }
    const D = {
      disabled: !!o,
      element: k,
      id: I,
      mutableState: {
        defaultLayout: _,
        disableCursor: !!M.disableCursor,
        expandedPanelSizes: v.current.lastExpandedPanelSizes,
        layouts: v.current.layouts
      },
      orientation: u,
      panels: E.panels,
      resizeTargetMinimumSize: E.resizeTargetMinimumSize,
      separators: E.separators
    };
    T.current = D;
    const $ = Nh(D), { defaultLayoutDeferred: K, derivedPanelConstraints: H, layout: J } = it(D.id, !0);
    !K && H.length > 0 && (h(J), y(J, !1));
    const le = yr(I, (ee) => {
      const { defaultLayoutDeferred: ie, derivedPanelConstraints: Se, layout: Z } = ee.next;
      if (ie || Se.length === 0)
        return;
      const de = D.panels.map(({ id: ae }) => ae).join(",");
      D.mutableState.layouts[de] = Z, Se.forEach((ae) => {
        if (ae.collapsible) {
          const { layout: fe } = ee.prev ?? {};
          if (fe) {
            const B = Me(
              ae.collapsedSize,
              Z[ae.panelId]
            ), U = Me(
              ae.collapsedSize,
              fe[ae.panelId]
            );
            B && !U && (D.mutableState.expandedPanelSizes[ae.panelId] = fe[ae.panelId]);
          }
        }
      });
      const Le = mt().state !== "active";
      h(Z), Le && y(Z, ee.isUserInteraction);
    });
    return () => {
      T.current = null, $(), le();
    };
  }, [
    o,
    I,
    y,
    h,
    u,
    b,
    M
  ]), z(() => {
    const k = T.current;
    k && (k.mutableState.defaultLayout = n, k.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(ms.Provider, { value: P, children: /* @__PURE__ */ p(
    "div",
    {
      ...m,
      className: t,
      "data-group": !0,
      "data-testid": I,
      id: I,
      ref: R,
      style: {
        height: "100%",
        width: "100%",
        overflow: "hidden",
        ...d,
        display: "flex",
        flexDirection: u === "horizontal" ? "row" : "column",
        flexWrap: "nowrap",
        // Inform the browser that the library is handling touch events for this element
        // but still allow users to scroll content within panels in the non-resizing direction
        // NOTE This is not an inherited style
        // See github.com/bvaughn/react-resizable-panels/issues/662
        touchAction: u === "horizontal" ? "pan-y" : "pan-x"
      },
      children: e
    }
  ) });
}
hs.displayName = "Group";
function kr() {
  const e = dt(ms);
  return pe(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Lh(e, t) {
  const { id: n } = kr(), r = x({
    collapse: Cn,
    expand: Cn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Cn
  });
  rr(t, () => r.current, []), yt(() => {
    Object.assign(
      r.current,
      us({ groupId: n, panelId: e })
    );
  });
}
function Zn({
  children: e,
  className: t,
  collapsedSize: n = "0%",
  collapsible: r = !1,
  defaultSize: o,
  disabled: a,
  elementRef: s,
  groupResizeBehavior: i = "preserve-relative-size",
  id: c,
  maxSize: l = "100%",
  minSize: u = "0%",
  onResize: f,
  panelRef: d,
  style: m,
  ...g
}) {
  const h = !!c, y = wr(c), I = Ir({
    disabled: a
  }), S = x(null), b = Sr(S, s), {
    getPanelStyles: w,
    id: v,
    orientation: R,
    registerPanel: C,
    updatePanelProps: M
  } = kr(), P = f !== null, T = Ut(
    (D, $, K) => {
      f == null || f(D, c, K);
    }
  );
  yt(() => {
    const D = S.current;
    if (D !== null) {
      const $ = {
        element: D,
        id: y,
        idIsStable: h,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: P ? T : void 0,
        panelConstraints: {
          groupResizeBehavior: i,
          collapsedSize: n,
          collapsible: r,
          defaultSize: o,
          disabled: I.disabled,
          maxSize: l,
          minSize: u
        }
      };
      return C($);
    }
  }, [
    i,
    n,
    r,
    o,
    P,
    y,
    h,
    l,
    u,
    T,
    C,
    I
  ]), z(() => {
    M(y, { disabled: a });
  }, [a, y, M]), Lh(y, d);
  const k = () => {
    const D = w(v, y);
    if (D)
      return JSON.stringify(D);
  }, E = vn(
    (D) => yr(v, D),
    k,
    k
  );
  let _;
  return E ? _ = JSON.parse(E) : o !== void 0 ? _ = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : _ = { flexGrow: 1 }, /* @__PURE__ */ p(
    "div",
    {
      ...g,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": y,
      id: y,
      ref: b,
      style: {
        ...Ch,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ..._
      },
      children: /* @__PURE__ */ p(
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
            touchAction: R === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
Zn.displayName = "Panel";
const Ch = {
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
function Dh({
  layout: e,
  panelConstraints: t,
  panelId: n,
  panelIndex: r
}) {
  let o, a;
  const s = e[n], i = t.find(
    (c) => c.panelId === n
  );
  if (i) {
    const c = i.maxSize, l = i.collapsible ? i.collapsedSize : i.minSize, u = [r, r + 1];
    a = pt({
      layout: Jt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = pt({
      layout: Jt({
        delta: c - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n];
  }
  return {
    valueControls: n,
    valueMax: o,
    valueMin: a,
    valueNow: s
  };
}
function ps({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const c = wr(a), l = Ir({
    disabled: n,
    disableDoubleClick: r
  }), [u, f] = N({}), [d, m] = N("inactive"), [g, h] = N(!1), y = x(null), I = Sr(y, o), {
    disableCursor: S,
    id: b,
    orientation: w,
    registerSeparator: v,
    updateSeparatorProps: R
  } = kr(), C = w === "horizontal" ? "vertical" : "horizontal";
  yt(() => {
    const T = y.current;
    if (T !== null) {
      const k = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: T,
        id: c
      }, E = v(k), _ = fh(
        ($) => {
          m(
            $.next.state !== "inactive" && $.next.hitRegions.some(
              (K) => K.separator === k
            ) ? $.next.state : "inactive"
          );
        }
      ), D = yr(
        b,
        ($) => {
          const { derivedPanelConstraints: K, layout: H, separatorToPanels: J } = $.next, le = J.get(k);
          if (le) {
            const ee = le[0], ie = le.indexOf(ee);
            f(
              Dh({
                layout: H,
                panelConstraints: K,
                panelId: ee.id,
                panelIndex: ie
              })
            );
          }
        }
      );
      return () => {
        _(), D(), E();
      };
    }
  }, [b, c, v, l]), z(() => {
    R(c, { disabled: n, disableDoubleClick: r });
  }, [n, r, c, R]);
  let M;
  n && !S && (M = "not-allowed");
  let P;
  if (n)
    P = "disabled";
  else
    switch (d) {
      case "active": {
        P = "active";
        break;
      }
      default:
        g ? P = "focus" : P = d;
    }
  return /* @__PURE__ */ p(
    "div",
    {
      ...i,
      "aria-controls": u.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": C,
      "aria-valuemax": u.valueMax,
      "aria-valuemin": u.valueMin,
      "aria-valuenow": u.valueNow,
      children: e,
      className: t,
      "data-separator": P,
      "data-testid": c,
      id: c,
      onBlur: () => h(!1),
      onFocus: () => h(!0),
      ref: I,
      role: "separator",
      style: {
        flexBasis: "auto",
        cursor: M,
        ...s,
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
ps.displayName = "Separator";
const Tr = 30, Er = 65, Gt = 50, $h = 100 - Er, Oh = 100 - Tr;
function zh(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(Er, Math.max(Tr, t)) : Gt;
}
function Pr(e) {
  return 100 - e;
}
function St(e) {
  return `${e}%`;
}
const Rr = "reader-document", Xt = "reader-assistant", gs = "retainpdf.reader.ai-split-layout.v1", Fh = {
  [Rr]: Pr(Gt),
  [Xt]: Gt
};
function Mr(e) {
  const t = zh(e == null ? void 0 : e[Xt]);
  return {
    [Rr]: Pr(t),
    [Xt]: t
  };
}
function Bh() {
  try {
    const e = JSON.parse(localStorage.getItem(gs) || "null");
    return Mr(e);
  } catch {
    return Fh;
  }
}
function jh(e) {
  try {
    localStorage.setItem(gs, JSON.stringify(Mr(e)));
  } catch {
  }
}
function Dn(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Mr(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[Xt]}vw`
  );
}
function Hh() {
  const e = x(null), [t] = N(Bh);
  xe(() => {
    const o = e.current;
    return Dn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = A((o) => {
    Dn(e.current, o);
  }, []), r = A((o, a) => {
    Dn(e.current, o), a.isUserInteraction && jh(o);
  }, []);
  return /* @__PURE__ */ L(
    hs,
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
        /* @__PURE__ */ p(
          Zn,
          {
            id: Rr,
            defaultSize: St(Pr(Gt)),
            minSize: St($h),
            maxSize: St(Oh)
          }
        ),
        /* @__PURE__ */ p(
          ps,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ p("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ p(
          Zn,
          {
            id: Xt,
            defaultSize: St(Gt),
            minSize: St(Tr),
            maxSize: St(Er)
          }
        )
      ]
    }
  );
}
function Uh({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = N(!1);
  if (z(() => {
    !e && !t && o(!1);
  }, [e, t]), r || !e && !t)
    return null;
  const a = [
    e ? "译文区域" : "",
    t ? "阅读元数据" : ""
  ].filter(Boolean);
  return /* @__PURE__ */ L("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ L("span", { className: "reader-error-notice-text", children: [
      a.join("、"),
      "加载失败，正文仍可正常阅读。"
    ] }),
    n ? /* @__PURE__ */ p(oe, { className: "reader-error-notice-retry", "data-reader-retry": "optional", onClick: n, children: "重试" }) : null,
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: "reader-error-notice-dismiss",
        "aria-label": "关闭提示",
        onClick: () => o(!0),
        children: "×"
      }
    )
  ] });
}
function Kh({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(Uh, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ L($e, { children: [
    e ? /* @__PURE__ */ p("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ L("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ p(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ L("div", { className: "reader-react-error", role: "alert", children: [
      /* @__PURE__ */ p("span", { className: "reader-react-error-text", children: n }),
      s ? /* @__PURE__ */ p(oe, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function Wh(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Vh() {
  const [e, t] = N(!1), n = Xo(), r = x(null), o = Ua(), a = W(() => [...jl, ...mf(o)], [o]);
  return z(() => {
    if (!e) return;
    const s = (c) => {
      const l = r.current;
      l && c.target instanceof Node && !l.contains(c.target) && t(!1);
    }, i = (c) => {
      c.key === "Escape" && (c.preventDefault(), t(!1));
    };
    return document.addEventListener("mousedown", s), window.addEventListener("keydown", i), () => {
      document.removeEventListener("mousedown", s), window.removeEventListener("keydown", i);
    };
  }, [e]), z(() => {
    const s = (i) => {
      if (i.defaultPrevented || i.metaKey || i.ctrlKey || i.altKey || Wh(i.target)) return;
      const c = i.key;
      if (c === "?" || c === "h" || c === "H" || c === "/") {
        if (c === "/" && !i.shiftKey)
          return;
        i.preventDefault(), t((l) => !l);
      }
    };
    return window.addEventListener("keydown", s), () => window.removeEventListener("keydown", s);
  }, []), /* @__PURE__ */ L("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-react-shortcuts-btn${e ? " is-active" : ""}`,
        "aria-label": "快捷键说明",
        "aria-expanded": e,
        "aria-controls": n,
        title: "快捷键（H 或 ?）",
        onClick: () => t((s) => !s),
        children: /* @__PURE__ */ p(ui, { ...Te, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ L(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ L("div", { className: "reader-react-shortcuts-head", children: [
            /* @__PURE__ */ p("strong", { children: "快捷键" }),
            /* @__PURE__ */ p(
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
          /* @__PURE__ */ p("div", { className: "reader-react-shortcuts-body", children: a.map((s) => /* @__PURE__ */ L("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ p("h3", { children: s.title }),
            /* @__PURE__ */ p("ul", { children: s.items.map((i) => /* @__PURE__ */ L("li", { children: [
              /* @__PURE__ */ p("kbd", { children: i.keys }),
              /* @__PURE__ */ p("span", { children: i.desc })
            ] }, `${s.title}-${i.keys}`)) })
          ] }, s.title)) }),
          /* @__PURE__ */ p("p", { className: "reader-react-shortcuts-foot", children: "在输入框内不会触发快捷键" })
        ]
      }
    ) : null
  ] });
}
const qh = ["source", "sideBySide", "translated"], Jh = { source: "", translated: "", sideBySide: "" };
function Gh(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = ln(e.sourceUrl), n = ln(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return xi({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function Xh(e) {
  const [t, n] = N(() => /* @__PURE__ */ new Set()), r = W(
    () => e ? Gh(e) : Jh,
    [e]
  ), o = W(
    () => qh.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = A(async (s) => {
    if (!e) return;
    const i = ln(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? Ai(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await Li(
          e.fetchProtected,
          i,
          c,
          c,
          null,
          (l) => n((u) => {
            const f = new Set(u);
            return l ? f.add(s) : f.delete(s), f;
          })
        );
      } catch (c) {
        const l = c instanceof Error ? c.message : "下载失败";
        Ci(l), n((u) => {
          const f = new Set(u);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const Yh = {
  source: ea,
  sideBySide: ta,
  translated: na
}, Zh = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function Qh(e) {
  const t = Ge(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Xh(n), i = x(null);
  return z(() => {
    const c = () => {
      var f;
      (f = i.current) != null && f.open && (i.current.open = !1);
    }, l = (f) => {
      i.current && !i.current.contains(f.target) && c();
    }, u = (f) => {
      f.key === "Escape" && c();
    };
    return document.addEventListener("pointerdown", l), document.addEventListener("keydown", u), () => {
      document.removeEventListener("pointerdown", l), document.removeEventListener("keydown", u);
    };
  }, []), /* @__PURE__ */ L("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ L("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ p(di, { ...Te, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = As[c], u = ln(r[c]), f = a.has(c), d = !!u && !f, m = d ? "" : xs(c, r), g = Yh[c];
      return /* @__PURE__ */ L(
        "button",
        {
          type: "button",
          id: `reader-download-${c}`,
          className: `reader-download-action${f ? " is-busy" : ""}`,
          disabled: !d,
          "aria-label": d ? `下载${l.label}` : m,
          onClick: () => {
            i.current && (i.current.open = !1), s(c);
          },
          children: [
            /* @__PURE__ */ p(g, { ...Te, "aria-hidden": !0 }),
            /* @__PURE__ */ L("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ L("span", { className: "reader-download-action-label", children: [
                Zh[c],
                " PDF"
              ] }),
              m ? /* @__PURE__ */ p("span", { className: "reader-download-action-reason", children: m }) : null
            ] })
          ]
        },
        c
      );
    }) })
  ] });
}
const ep = "retainpdf:reader:bookmarks:v1:", tp = 200;
function _r() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function bs(e) {
  const t = `${e || ""}`.trim();
  return t ? `${ep}${t}` : "";
}
function np(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Kt(e, t = _r()) {
  const n = bs(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = np(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
const Qn = /* @__PURE__ */ new Set();
function rp(e, t) {
  const n = (r) => {
    r === e && t();
  };
  return Qn.add(n), () => {
    Qn.delete(n);
  };
}
function er(e, t, n) {
  const r = bs(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, tp);
  if (r && n)
    try {
      n.setItem(r, JSON.stringify(o));
    } catch {
    }
  for (const a of [...Qn]) a(e);
  return o;
}
function op(e, t, n = "", { storage: r = _r(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Kt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? er(e, a.filter((i) => i.page !== s), r) : er(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function ap(e, t, n = _r()) {
  return er(e, Kt(e, n).filter((r) => r.page !== t), n);
}
function sp(e, t) {
  var r, o, a, s;
  let n = null;
  for (const i of e || []) {
    if (`${(i == null ? void 0 : i.regionType) || ""}` != "heading") continue;
    const c = Number(((r = i.source) == null ? void 0 : r.page) ?? ((o = i.translated) == null ? void 0 : o.page));
    if (!Number.isFinite(c) || c > t) continue;
    const l = `${((a = i.translated) == null ? void 0 : a.text) || i.markdown || ((s = i.source) == null ? void 0 : s.text) || ""}`.replace(/\s+/g, " ").trim();
    if (!l) continue;
    const u = Number(i.readingOrder) || 0;
    (!n || c > n.page || c === n.page && u >= n.order) && (n = { page: c, order: u, text: l });
  }
  return n ? n.text.slice(0, 60) : "";
}
function ys(e, t) {
  const [n, r] = N(() => Kt(e));
  z(() => (r(Kt(e)), rp(e, () => r(Kt(e)))), [e]);
  const o = A((s) => {
    r(op(e, s, sp(t, s)));
  }, [e, t]), a = A((s) => r(ap(e, s)), [e]);
  return { bookmarks: n, toggle: o, remove: a };
}
function ip({ filled: e }) {
  return /* @__PURE__ */ p(fi, { ...Te, fill: e ? "currentColor" : "none", "aria-hidden": !0 });
}
function cp({ scope: e, currentPage: t, numPages: n, regions: r }) {
  const { bookmarks: o, toggle: a } = ys(e, r);
  if (!e || n <= 0) return null;
  const s = Math.min(Math.max(t, 1), n), i = o.some((c) => c.page === s);
  return /* @__PURE__ */ L("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", children: [
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-mark${i ? " is-marked" : ""}`,
        "aria-pressed": i,
        "aria-label": i ? `取消第 ${s} 页的书签` : `给第 ${s} 页加书签`,
        title: i ? "取消这一页的书签（书签都在左栏「书签」里）" : "给这一页加书签（书签都在左栏「书签」里）",
        onClick: () => a(s),
        children: /* @__PURE__ */ p(ip, { filled: i })
      }
    ),
    /* @__PURE__ */ p(lp, {})
  ] });
}
function lp() {
  const [e, t] = N(!1), n = x(null);
  return z(() => {
    if (!e) return;
    const r = (a) => {
      var s;
      (s = n.current) != null && s.contains(a.target) || t(!1);
    }, o = (a) => {
      a.key === "Escape" && t(!1);
    };
    return document.addEventListener("pointerdown", r, !0), document.addEventListener("keydown", o), () => {
      document.removeEventListener("pointerdown", r, !0), document.removeEventListener("keydown", o);
    };
  }, [e]), /* @__PURE__ */ L("span", { className: "reader-favorites", ref: n, children: [
    /* @__PURE__ */ p(
      oe,
      {
        className: "reader-react-hud-btn reader-favorites-toggle",
        "aria-expanded": e,
        "aria-haspopup": "dialog",
        "aria-label": "收藏",
        title: "收藏（还在做）",
        onClick: () => t((r) => !r),
        children: /* @__PURE__ */ p(mi, { ...Te, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ L("div", { className: "reader-favorites-card reader-floating-surface", role: "dialog", "aria-label": "收藏", children: [
      /* @__PURE__ */ p("strong", { children: "收藏" }),
      /* @__PURE__ */ p("p", { children: "还在做：以后可以把喜欢的段落、整页收在这里，按书分好，随时翻回来。现在先用「书签」记页。" })
    ] }) : null
  ] });
}
function up(e) {
  const t = Ge(), n = dr(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Qt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = Sc(a), f = a > ma + 1e-3, d = a < gn - 1e-3, m = It(r, Tt()), g = m >= gn ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", [h, y] = N(!1), [I, S] = N(`${i}`);
  z(() => {
    h || S(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, h]);
  const b = () => {
    if (y(!1), !l || c <= 0)
      return;
    const w = Number(`${I}`.trim());
    l(bn(w, c));
  };
  return /* @__PURE__ */ L("footer", { className: "reader-bottombar", "data-reader-hud": "true", children: [
    /* @__PURE__ */ L("div", { className: "reader-bottombar-start", children: [
      e.bookmarkScope ? /* @__PURE__ */ p(
        cp,
        {
          scope: e.bookmarkScope,
          currentPage: i,
          numPages: c,
          regions: t == null ? void 0 : t.regions
        }
      ) : null,
      e.leftSlot
    ] }),
    /* @__PURE__ */ L("div", { className: "reader-bottombar-center", children: [
      o ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
      /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "页码", children: h ? /* @__PURE__ */ L(
        "form",
        {
          className: "reader-react-hud-page-form",
          onSubmit: (w) => {
            w.preventDefault(), b();
          },
          children: [
            /* @__PURE__ */ p(
              "input",
              {
                className: "reader-react-hud-page-input",
                type: "text",
                inputMode: "numeric",
                pattern: "[0-9]*",
                "aria-label": "跳转到页码",
                value: I,
                autoFocus: !0,
                onChange: (w) => S(w.target.value.replace(/[^\d]/g, "")),
                onBlur: b,
                onKeyDown: (w) => {
                  w.key === "Escape" && (w.preventDefault(), y(!1), S(`${i}`));
                }
              }
            ),
            /* @__PURE__ */ L("span", { className: "reader-react-hud-page-suffix", children: [
              "/ ",
              c || "—"
            ] })
          ]
        }
      ) : /* @__PURE__ */ p(
        "button",
        {
          type: "button",
          className: "reader-react-hud-page reader-react-hud-page-btn",
          "aria-label": c > 0 ? `跳转页码，当前第 ${i} 页，共 ${c} 页` : "页码",
          title: c > 0 ? "点击输入页码跳转" : void 0,
          disabled: !l || c <= 0,
          onClick: () => {
            !l || c <= 0 || (S(`${i}`), y(!0));
          },
          children: c > 0 ? `${Math.min(i, c)} / ${c}` : "—"
        }
      ) }),
      e.searchSlot ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "搜索", children: e.searchSlot }) : null,
      t != null && t.toggleDocDark ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "显示", children: /* @__PURE__ */ p(
        oe,
        {
          className: "reader-react-hud-btn reader-react-hud-doc-dark",
          "aria-pressed": t.docDark ? "true" : "false",
          "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
          title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
          onClick: t.toggleDocDark,
          children: /* @__PURE__ */ p(hi, { ...Te, "aria-hidden": !0 })
        }
      ) }) : null,
      /* @__PURE__ */ L("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
        /* @__PURE__ */ p(
          "button",
          {
            type: "button",
            className: "reader-react-hud-btn",
            "aria-label": "缩小",
            disabled: !f,
            onClick: () => s(qt(a, -1)),
            children: /* @__PURE__ */ p(oa, { ...Te, "aria-hidden": !0 })
          }
        ),
        /* @__PURE__ */ L(
          "button",
          {
            type: "button",
            className: "reader-react-hud-btn reader-react-hud-zoom-label",
            "aria-label": `${u}%，点击${g}`,
            title: g,
            onClick: () => s(m),
            children: [
              u,
              "%"
            ]
          }
        ),
        /* @__PURE__ */ p(
          "button",
          {
            type: "button",
            className: "reader-react-hud-btn",
            "aria-label": "放大",
            disabled: !d,
            onClick: () => s(qt(a, 1)),
            children: /* @__PURE__ */ p(aa, { ...Te, "aria-hidden": !0 })
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ L("div", { className: "reader-bottombar-end", children: [
      e.toolsSlot,
      /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(Vh, {}) })
    ] })
  ] });
}
function jo(e) {
  var t, n;
  return ya(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function dp(e) {
  const [t, n] = N(() => ({
    scope: e,
    panel: jo(Je(e))
  }));
  z(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: jo(Je(e))
    });
  }, [e]), z(() => {
    t.scope === e && Sn(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = A((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const tr = "download-toast";
function fp({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ L("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ L("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ p("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ p("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ p("div", { className: "download-toast-track", children: /* @__PURE__ */ p("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ p("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function mp(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    On.dismiss(tr);
    return;
  }
  On.custom(
    () => /* @__PURE__ */ p(fp, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: tr, duration: 1 / 0 }
  );
}
function hp() {
  const e = A((t) => {
    t && (t.setState = mp, t.hide = () => On.dismiss(tr));
  }, []);
  return /* @__PURE__ */ L($e, { children: [
    /* @__PURE__ */ p(Us, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
const Ho = { itemId: null, origin: null };
function pp() {
  let e = Ho;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? Ho : { itemId: n, origin: r };
        for (const o of t) o();
      }
    },
    subscribe(n) {
      return t.add(n), () => {
        t.delete(n);
      };
    }
  };
}
const Uo = ["ask"];
function gp(e) {
  const t = (n) => {
    const r = Uo.indexOf(n.id);
    return r < 0 ? Uo.length : r;
  };
  return [...e].sort((n, r) => t(n) - t(r));
}
function nr({
  place: e,
  active: t = null,
  extensions: n = hr
}) {
  const r = e === "side" ? gp(n) : n, [o, a] = N(null), s = Ua(), i = (d) => {
    var m;
    return (((m = s.find((g) => g.id === d)) == null ? void 0 : m.contribution.toolbarItems) ?? []).filter((g) => (g.place ?? "side") === e);
  }, c = () => a(null), l = (() => {
    if (!o) return null;
    for (const { id: d } of r)
      for (const m of i(d)) {
        if (`${d}:${m.key}:popup` === o && m.popup) return m.popup(c);
        if (`${d}:${m.key}:dropdown` === o && m.dropdown) return m.dropdown(c);
      }
    return null;
  })(), u = x(null);
  z(() => {
    if (!o) return;
    const d = (g) => {
      var h;
      (h = u.current) != null && h.contains(g.target) || c();
    }, m = (g) => {
      g.key === "Escape" && c();
    };
    return document.addEventListener("pointerdown", d, !0), document.addEventListener("keydown", m), () => {
      document.removeEventListener("pointerdown", d, !0), document.removeEventListener("keydown", m);
    };
  }, [o]);
  const f = r.map((d) => {
    const m = i(d.id), g = e === "side" ? pr([d]) : [];
    return !m.length && !g.length ? null : /* @__PURE__ */ L(yn, { children: [
      m.map((h) => {
        const y = `${d.id}:${h.key}`, I = h.Icon;
        return /* @__PURE__ */ L("span", { className: "reader-bar-tool-group", "data-has-dropdown": h.dropdown ? "true" : void 0, children: [
          /* @__PURE__ */ p(
            oe,
            {
              className: e === "compare" ? "reader-bar-tool reader-bar-tool-compare" : "reader-bar-tool",
              "aria-label": h.label,
              title: h.title || h.label,
              "aria-pressed": !!h.pressed || o === `${y}:popup`,
              "aria-expanded": h.popup ? o === `${y}:popup` : void 0,
              "data-bar-tool": h.key,
              onClick: () => {
                var S;
                if (h.popup) {
                  a((b) => b === `${y}:popup` ? null : `${y}:popup`);
                  return;
                }
                (S = h.onClick) == null || S.call(h), c();
              },
              children: e === "compare" ? /* @__PURE__ */ p(dn, { ...Gr, "aria-hidden": !0 }) : h.mark ?? /* @__PURE__ */ p(I, { ...Te, "aria-hidden": !0 })
            }
          ),
          h.dropdown ? /* @__PURE__ */ p(
            oe,
            {
              className: "reader-bar-tool-caret",
              "aria-label": `${h.label}：选项`,
              title: `${h.label}的选项`,
              "aria-expanded": o === `${y}:dropdown`,
              "data-bar-tool-caret": h.key,
              onClick: () => a((S) => S === `${y}:dropdown` ? null : `${y}:dropdown`),
              children: /* @__PURE__ */ p(dn, { ...Gr, "aria-hidden": !0 })
            }
          ) : null
        ] }, y);
      }),
      g.length ? /* @__PURE__ */ p(th, { active: t, tabs: g }) : null
    ] }, d.id);
  }).filter(Boolean);
  return f.length ? /* @__PURE__ */ L("div", { className: `reader-bar-tools is-${e}`, ref: u, role: "group", "aria-label": e === "side" ? "面板" : e === "compare" ? "对比版本" : "书页工具", children: [
    f,
    l ? /* @__PURE__ */ p("div", { className: "reader-bar-tools-popup", children: l }) : null
  ] }) : null;
}
const Ko = { search: "搜索", bookmarks: "书签", issues: "待改" }, bp = [];
function yp({
  open: e,
  onToggle: t,
  issueCount: n = 0,
  children: r
}) {
  const o = `在全文搜索，书签${n ? `、待改 ${n} 处` : ""}（⌘F）`;
  return /* @__PURE__ */ L("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ L(oe, { className: "reader-finder-toggle", "aria-label": "左栏：搜索、书签、待改", "aria-pressed": !!e, title: o, onClick: t, children: [
      /* @__PURE__ */ p(sa, { ...Te, "aria-hidden": !0 }),
      n ? /* @__PURE__ */ p("span", { className: "reader-finder-toggle-count", "aria-label": `待改 ${n} 处`, children: n }) : null
    ] }),
    r
  ] });
}
function vp({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0,
  pinned: c = !1,
  bookmarkPane: l,
  issuesPane: u,
  issueCount: f = 0
}) {
  var C;
  const d = ((C = Ge()) == null ? void 0 : C.regions) ?? bp, m = W(() => pu(d, s), [d, s]), [g, h] = N(-1);
  z(() => h(-1), [s]);
  const y = x(null), I = x(null), S = x(n);
  S.current = n, z(() => {
    if (c) return;
    const M = (T) => {
      var E, _;
      const k = T.target;
      !k || (E = I.current) != null && E.contains(k) || (_ = k.closest) != null && _.call(k, ".reader-finder-toggles, [data-finder-toggle]") || S.current();
    }, P = (T) => {
      T.key === "Escape" && S.current();
    };
    return document.addEventListener("pointerdown", M, !0), document.addEventListener("keydown", P), () => {
      document.removeEventListener("pointerdown", M, !0), document.removeEventListener("keydown", P);
    };
  }, [c]);
  const b = x(null);
  z(() => {
    var M;
    e === "search" && ((M = y.current) == null || M.focus());
  }, [e, i]), z(() => {
    var M, P, T;
    e === "search" && g >= 0 && ((T = (P = (M = b.current) == null ? void 0 : M.querySelector('[aria-current="true"]')) == null ? void 0 : P.scrollIntoView) == null || T.call(P, { block: "nearest" }));
  }, [e, g]);
  const w = (M) => {
    const P = m[M];
    P && (h(M), r(P.itemId));
  }, v = ["search", ...l ? ["bookmarks"] : [], ...u ? ["issues"] : []], R = v.includes(e) ? e : "search";
  return /* @__PURE__ */ L("aside", { ref: I, className: "reader-finder", "data-finder-tab": R, "data-pinned": c ? "true" : void 0, "aria-label": `左栏：${Ko[R]}`, children: [
    /* @__PURE__ */ L("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ p("div", { className: "reader-finder-tabs", role: "tablist", children: v.map((M) => /* @__PURE__ */ L(oe, { className: "reader-finder-tab", role: "tab", "aria-selected": R === M, onClick: () => t(M), children: [
        Ko[M],
        M === "issues" && f ? /* @__PURE__ */ p("span", { className: "reader-finder-tab-count", children: f }) : null
      ] }, M)) }),
      /* @__PURE__ */ p(oe, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(At, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    R === "bookmarks" ? l : R === "issues" ? u : null,
    R !== "search" ? null : /* @__PURE__ */ L($e, { children: [
      /* @__PURE__ */ L("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          or,
          {
            ref: y,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "搜原文或译文（⌘F）",
            "aria-label": "在书里搜索",
            value: o,
            onChange: (M) => a(M.target.value),
            onKeyDown: (M) => {
              M.key === "Enter" ? (M.preventDefault(), w(gu(g, m.length, M.shiftKey))) : M.key === "Escape" && (M.preventDefault(), c ? M.currentTarget.blur() : n()), M.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: m.length === 0 ? "没有找到" : `${g >= 0 ? `第 ${g + 1} / ` : ""}${m.length >= 200 ? "200+ 处，只列前 200 处" : `${m.length} 处`}${g < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { ref: b, className: "reader-finder-list", children: m.map((M, P) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(oe, { className: "reader-finder-entry is-hit", "aria-current": P === g ? "true" : void 0, onClick: () => w(P), children: [
        /* @__PURE__ */ L("span", { className: "reader-finder-entry-text", children: [
          M.snippet.slice(0, M.at),
          /* @__PURE__ */ p("mark", { children: M.snippet.slice(M.at, M.at + M.length) }),
          M.snippet.slice(M.at + M.length)
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: M.page })
      ] }) }, M.itemId)) })
    ] })
  ] });
}
function vs(e, t = []) {
  for (const n of e)
    t.push(n), vs(n.children, t);
  return t;
}
const wp = 24, Ot = 28, Wo = 15;
function ws(e) {
  return e.reduce((t, n) => t + 1 + n.children.length, 0);
}
function Ss(e, t) {
  if (e.length)
    return (e.length === 1 && e[0].children.length ? e[0].children : e).map((o) => ({
      id: o.id,
      title: o.title,
      page: o.page,
      depth: 1,
      children: vs(o.children).map((a) => ({ id: a.id, title: a.title, page: a.page, depth: a.level - o.level + 1 }))
    }));
  const n = [];
  for (const r of t) {
    const o = { id: r.itemId, title: r.text, page: r.page, itemId: r.itemId }, a = n[n.length - 1];
    r.level > 1 && a ? a.children.push({ ...o, depth: 2 }) : n.push({ ...o, depth: 1, children: [] });
  }
  return n;
}
function Sp(e, t) {
  let n = null, r = null, o = !1;
  for (const a of e) {
    const s = (i, c) => {
      if (i.page === null || i.page > t) return;
      const l = !c && o && (r == null ? void 0 : r.id) === a.id;
      (!r || i.page > (r.page ?? 0) || i.page === r.page && l) && (r = i, o = c, n = a.id);
    };
    s(a, !0);
    for (const i of a.children) s(i, !1);
  }
  return { chapterId: n, nodeId: (r == null ? void 0 : r.id) ?? null };
}
function Ip(e, t) {
  const n = ws(e) > wp, r = Math.max(1, Math.ceil(e.length / Ot)), o = [];
  if (e.forEach((i, c) => {
    const l = i.id === t.chapterId;
    if (!(c % r !== 0 && !l) && (o.push({ id: i.id, kind: "h1", state: i.id === t.nodeId ? "current" : l ? "chapter" : "" }), !(n && !l)))
      for (const u of i.children)
        u.depth > 2 && !l || o.push({ id: u.id, kind: "h2", state: u.id === t.nodeId ? "current" : "" });
  }), o.length <= Ot) return o;
  const a = Math.max(0, o.findIndex((i) => i.state === "current")), s = Math.min(Math.max(0, a - Math.floor(Ot / 2)), o.length - Ot);
  return o.slice(s, s + Ot);
}
function kp(e, t) {
  const n = t.trim().toLowerCase();
  if (!n) return [...e];
  const r = [];
  for (const o of e) {
    const a = o.title.toLowerCase().includes(n), s = o.children.filter((i) => i.title.toLowerCase().includes(n));
    a ? r.push(o) : s.length && r.push({ ...o, children: s });
  }
  return r;
}
const Tp = [];
function Ep({ pinned: e, available: t, onToggle: n }) {
  return /* @__PURE__ */ p(
    oe,
    {
      className: "reader-toc-toggle",
      "aria-label": "目录",
      "aria-pressed": e,
      disabled: !t,
      title: t ? e ? "收起目录" : "展开目录（钉住，移开鼠标也不收）" : "这本书没有目录",
      onClick: n,
      children: /* @__PURE__ */ p(pi, { ...Te, "aria-hidden": !0 })
    }
  );
}
function Pp({ bookmarks: e, onJumpPage: t, onJumpBlock: n, pinned: r = !1, onUnpin: o }) {
  var C, M;
  const a = ((C = Ge()) == null ? void 0 : C.regions) ?? Tp, s = ((M = dr()) == null ? void 0 : M.currentPage) ?? 1, i = W(() => Ss(e, _a(a)), [e, a]), c = W(() => Sp(i, s), [i, s]), l = W(() => Ip(i, c), [i, c]), u = ws(i), [f, d] = N(""), m = W(() => kp(i, f), [i, f]), [g, h] = N(() => /* @__PURE__ */ new Set()), y = x(null), I = x(!1), S = () => {
    c.chapterId && !g.has(c.chapterId) && h((P) => new Set(P).add(c.chapterId)), I.current = !0;
  };
  if (z(() => {
    r && S();
  }, [r]), xe(() => {
    var P, T, k;
    I.current && (I.current = !1, (k = (T = (P = y.current) == null ? void 0 : P.querySelector('[aria-current="location"]')) == null ? void 0 : T.scrollIntoView) == null || k.call(T, { block: "center" }));
  }), !i.length) return null;
  const b = (P) => h((T) => {
    const k = new Set(T);
    return k.has(P) ? k.delete(P) : k.add(P), k;
  }), w = (P, T) => {
    h((k) => k.has(T) ? k : new Set(k).add(T)), P.itemId ? n(P.itemId) : P.page !== null && t(P.page);
  }, v = !!f.trim(), R = (P, T) => /* @__PURE__ */ L(
    oe,
    {
      className: "reader-toc-entry",
      "data-depth": Math.min(P.depth, 3),
      "aria-current": P.id === c.nodeId ? "location" : void 0,
      disabled: !P.itemId && P.page === null,
      title: P.page === null ? "这条书签没有指到页" : `${P.title}（第 ${P.page} 页）`,
      onClick: () => w(P, T),
      children: [
        /* @__PURE__ */ p("span", { className: "reader-toc-title", children: P.title }),
        P.page !== null ? /* @__PURE__ */ L("span", { className: "reader-toc-page", children: [
          "p.",
          P.page
        ] }) : null
      ]
    }
  );
  return /* @__PURE__ */ L(
    "nav",
    {
      className: "reader-toc-minimap",
      "aria-label": "目录",
      "data-pinned": r ? "true" : void 0,
      onPointerEnter: r ? void 0 : S,
      onKeyDown: (P) => {
        r && P.key === "Escape" && (o == null || o());
      },
      onFocus: (P) => {
        !r && !P.currentTarget.contains(P.relatedTarget) && S();
      },
      children: [
        /* @__PURE__ */ p("div", { className: "reader-toc-bars", tabIndex: 0, "aria-label": `目录，${u} 条（移上去或按 Tab 展开）`, children: l.map((P) => /* @__PURE__ */ p("span", { className: "reader-toc-bar", "data-kind": P.kind, "data-state": P.state || void 0, "aria-hidden": !0 }, P.id)) }),
        /* @__PURE__ */ L("div", { className: "reader-toc-card", "data-compact": u <= Wo ? "true" : void 0, children: [
          u > Wo ? /* @__PURE__ */ L("div", { className: "reader-toc-filter", children: [
            /* @__PURE__ */ p(sa, { size: 13, "aria-hidden": !0 }),
            /* @__PURE__ */ p(
              or,
              {
                size: "sm",
                className: "reader-toc-filter-input",
                value: f,
                placeholder: "过滤章节标题或节号…",
                "aria-label": "过滤目录",
                onChange: (P) => d(P.target.value),
                onKeyDown: (P) => {
                  P.stopPropagation(), P.key === "Escape" && (f ? d("") : (P.currentTarget.blur(), r && (o == null || o())));
                }
              }
            ),
            f ? /* @__PURE__ */ p(oe, { className: "reader-toc-filter-clear", "aria-label": "清掉", onClick: () => d(""), children: /* @__PURE__ */ p(At, { size: 12, "aria-hidden": !0 }) }) : null
          ] }) : null,
          /* @__PURE__ */ p("div", { className: "reader-toc-list", ref: y, children: m.length ? m.map((P) => {
            const T = v || g.has(P.id);
            return /* @__PURE__ */ L("div", { className: "reader-toc-chapter", children: [
              /* @__PURE__ */ L("div", { className: "reader-toc-chapter-row", children: [
                P.children.length ? /* @__PURE__ */ p(
                  oe,
                  {
                    className: "reader-toc-caret",
                    "aria-expanded": T,
                    "aria-label": `${T ? "收起" : "展开"}「${P.title}」`,
                    onClick: () => b(P.id),
                    children: T ? /* @__PURE__ */ p(dn, { size: 12, "aria-hidden": !0 }) : /* @__PURE__ */ p(ra, { size: 12, "aria-hidden": !0 })
                  }
                ) : /* @__PURE__ */ p("span", { className: "reader-toc-caret-space" }),
                R(P, P.id)
              ] }),
              T ? P.children.map((k) => /* @__PURE__ */ p("div", { children: R(k, P.id) }, k.id)) : null
            ] }, P.id);
          }) : /* @__PURE__ */ p("p", { className: "reader-toc-empty", children: "没有匹配的章节" }) })
        ] })
      ]
    }
  );
}
function Rp({ active: e }) {
  return /* @__PURE__ */ L("div", { className: "reader-side-rail", role: "toolbar", "aria-orientation": "vertical", "aria-label": "面板和下载", children: [
    /* @__PURE__ */ p(nr, { place: "side", active: e }),
    /* @__PURE__ */ p("span", { className: "reader-side-rail-sep", "aria-hidden": !0 }),
    /* @__PURE__ */ p(Qh, {})
  ] });
}
function Mp(e) {
  const [t, n] = N([]);
  return z(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = nt().loadIssues;
    } catch {
      o = void 0;
    }
    if (!r || !o) return;
    let a = !1;
    return o(r).then((s) => {
      a || n(Array.isArray(s) ? s : []);
    }).catch(() => {
    }), () => {
      a = !0;
    };
  }, [e]), t;
}
function _p(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const Np = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, Ap = ["failed", "content", "layout"];
function xp(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Lp(e, t, n) {
  const r = Mp(e), [o, a] = N(-1);
  z(() => a(-1), [r]);
  const s = A((c) => {
    const l = r[c];
    !l || !n || (a(c), n(l.readerItemId));
  }, [r, n]), i = x({ issues: r, last: o, currentPage: t, goTo: s });
  return i.current = { issues: r, last: o, currentPage: t, goTo: s }, z(() => {
    const c = (l) => {
      if (l.key.toLowerCase() !== "n" || l.metaKey || l.ctrlKey || l.altKey || xp(l.target)) return;
      const { issues: u, last: f, currentPage: d, goTo: m } = i.current, g = _p(u, f, d, l.shiftKey);
      g < 0 || (l.preventDefault(), m(g));
    };
    return document.addEventListener("keydown", c), () => document.removeEventListener("keydown", c);
  }, []), { issues: r, last: o, goTo: s };
}
function Cp(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Dp(e) {
  var r;
  if (e.shiftKey || Cp(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${da}`))) return null;
  const n = Number((r = t.closest(`[${Pe}]`)) == null ? void 0 : r.getAttribute(Pe)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function $p({
  menu: e,
  onClose: t,
  actions: n,
  sections: r
}) {
  const o = x(null);
  if (z(() => {
    if (!e) return;
    const c = (u) => {
      var f;
      (f = o.current) != null && f.contains(u.target) || t();
    }, l = (u) => {
      u.key === "Escape" && t();
    };
    return document.addEventListener("pointerdown", c, !0), document.addEventListener("keydown", l), () => {
      document.removeEventListener("pointerdown", c, !0), document.removeEventListener("keydown", l);
    };
  }, [e, t]), !e) return null;
  const a = 380, s = Math.max(8, Math.min(e.x, (globalThis.innerWidth || a) - a - 8)), i = Math.max(68, Math.min(e.y, (globalThis.innerHeight || 600) - 60 - (n.length ? 40 : 0)));
  return /* @__PURE__ */ L("div", { ref: o, className: "reader-ink-menu", style: { left: s, top: i }, "data-ink-menu": "true", children: [
    n.length ? /* @__PURE__ */ p("div", { className: "reader-ink-menu-actions", role: "menu", "aria-label": "书页", children: n.map((c) => /* @__PURE__ */ L(
      oe,
      {
        className: "reader-ink-menu-action",
        role: "menuitem",
        title: c.hint,
        onClick: () => {
          c.onSelect(), t();
        },
        children: [
          c.label,
          c.hint ? /* @__PURE__ */ p("kbd", { children: c.hint }) : null
        ]
      },
      c.key
    )) }) : null,
    r.map((c) => /* @__PURE__ */ p(yn, { children: c.render({ page: e.page, close: t }) }, c.id))
  ] });
}
function Op({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ p("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ L("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
    /* @__PURE__ */ p("span", { children: n.phase === "failed" ? n.message : `改了 ${t} 处，还没排进 PDF` }),
    t ? /* @__PURE__ */ p(
      oe,
      {
        className: "reader-pending-edits-act",
        size: "sm",
        variant: "primary",
        "data-block-edit-action": "rerender",
        onClick: () => {
          e.startRerender();
        },
        children: "重新排版"
      }
    ) : null
  ] });
}
const Is = "retainpdf:reader:doc-theme:v1", Vo = "data-reader-doc";
function ks() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function zp(e = ks()) {
  try {
    return (e == null ? void 0 : e.getItem(Is)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function Fp(e, t = ks()) {
  try {
    t == null || t.setItem(Is, e);
  } catch {
  }
}
function qo(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(Vo, "dark") : t.removeAttribute(Vo));
}
function Bp() {
  const [e, t] = N(() => zp());
  z(() => {
    qo(e);
  }, [e]), z(() => () => qo("light"), []);
  const n = A(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return Fp(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
function jp({ scope: e, regions: t, currentPage: n, numPages: r, onJumpPage: o }) {
  const { bookmarks: a, remove: s } = ys(e, t);
  return a.length ? /* @__PURE__ */ p("ol", { className: "reader-finder-list reader-bookmark-list", children: a.map((i) => /* @__PURE__ */ L("li", { className: i.page === n ? "is-current" : "", children: [
    /* @__PURE__ */ L(
      oe,
      {
        className: "reader-finder-entry reader-bookmark-jump",
        "aria-current": i.page === n ? "location" : void 0,
        onClick: () => o(r > 0 ? Math.min(i.page, r) : i.page),
        children: [
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-text", children: i.label || `第 ${i.page} 页` }),
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: i.page })
        ]
      }
    ),
    /* @__PURE__ */ p(oe, { className: "reader-bookmark-remove", "aria-label": `删除第 ${i.page} 页的书签`, title: "删除这个书签", onClick: () => s(i.page), children: "×" })
  ] }, i.page)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: "还没有书签。底栏的书签按钮给眼下这一页加一个。" });
}
function Hp({ nav: e }) {
  const { issues: t, last: n, goTo: r } = e;
  return /* @__PURE__ */ L("div", { className: "reader-issues", children: [
    /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
    Ap.map((o) => {
      const a = t.map((s, i) => ({ issue: s, index: i })).filter(({ issue: s }) => s.kind === o);
      return a.length ? /* @__PURE__ */ L("section", { className: "reader-issues-group", "data-issue-kind": o, children: [
        /* @__PURE__ */ L("h4", { children: [
          Np[o],
          /* @__PURE__ */ p("span", { children: a.length })
        ] }),
        /* @__PURE__ */ p("ol", { children: a.map(({ issue: s, index: i }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(oe, { className: "reader-issues-item", "aria-current": i === n ? "true" : void 0, onClick: () => r(i), children: [
          /* @__PURE__ */ p("span", { className: "reader-issues-title", children: s.title }),
          /* @__PURE__ */ L("span", { className: "reader-issues-page", children: [
            "第 ",
            s.page,
            " 页"
          ] }),
          s.detail ? /* @__PURE__ */ p("span", { className: "reader-issues-detail", children: s.detail }) : null
        ] }) }, `${s.kind}:${s.readerItemId}`)) })
      ] }, o) : null;
    })
  ] });
}
function Up({ state: e, bookmarkScope: t, issues: n }) {
  const { finder: r, setFinder: o, findQuery: a, setFindQuery: s, findTerm: i, findFocus: c, jumpFromFinder: l, jumpToPageFromFinder: u, pinned: f } = e, d = Ge(), m = dr(), g = (m == null ? void 0 : m.currentPage) ?? 1, h = n.issues.length;
  return /* @__PURE__ */ p($e, { children: r ? /* @__PURE__ */ p(
    vp,
    {
      tab: r,
      onTab: o,
      onClose: () => o(null),
      onJump: l,
      query: a,
      onQuery: s,
      term: i,
      focusSignal: c,
      pinned: f,
      bookmarkPane: t ? /* @__PURE__ */ p(
        jp,
        {
          scope: t,
          regions: d == null ? void 0 : d.regions,
          currentPage: g,
          numPages: (m == null ? void 0 : m.numPages) ?? 0,
          onJumpPage: u
        }
      ) : void 0,
      issuesPane: h ? /* @__PURE__ */ p(Hp, { nav: n }) : void 0,
      issueCount: h
    }
  ) : null });
}
function Kp({
  session: e,
  zoomDocuments: t,
  zoomItem: n,
  setZoomItem: r,
  closeZoom: o,
  visiblePdfMode: a
}) {
  return /* @__PURE__ */ p($e, { children: n ? /* @__PURE__ */ p(
    Hm,
    {
      itemId: n,
      regions: e.regions,
      metadata: e.readerMetadata,
      documents: t,
      panes: a === "compare" ? ["source", "translated"] : a === "translated" ? ["translated"] : ["source"],
      onNavigate: r,
      onClose: o
    }
  ) : null });
}
function Wp(e) {
  const t = e.sourceOnly || !e.translatedUrl, n = !!(e.overlayContentAvailable && e.liveTranslationVisible && !e.assistantOpen), o = e.compareFits === !1 && e.mode === "compare" ? "source" : e.mode, a = !t && (o === "translated" || o === "compare");
  return {
    kind: n ? "live-overlay" : o === "compare" ? "final-compare" : o === "translated" ? "translated-only" : "source-only",
    visibleMode: o,
    compareMode: o === "compare" && a,
    showSource: n || o !== "translated" || !a,
    showTranslated: a,
    overlayOnSource: n,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: t
  };
}
const Vp = 720;
function qp(e, t) {
  return !t || !Number.isFinite(e) || e <= 0 ? !0 : e >= Vp;
}
function Jp(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function Gp(e, t, n = !0) {
  const { sessionFiles: r } = e, [o, a] = N(!1), s = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, i = Wp({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: s,
    liveTranslationVisible: o,
    assistantOpen: t,
    compareFits: n
  }), c = Pl({
    hasOverlayContent: s,
    connection: e.liveTranslation.connection,
    showSource: i.showSource,
    liveTranslationVisible: o,
    assistantOpen: t
  }), l = i.sourceViewOnly, u = i.visibleMode;
  z(() => {
    a(!1);
  }, [e.viewStateKey]), z(() => {
    e.session.jobTerminal && a(!1);
  }, [e.session.jobTerminal]);
  const f = x(null);
  return z(() => {
    f.current !== e.viewStateKey && _l({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: l,
      jobTerminal: e.session.jobTerminal
    }) && (f.current = e.viewStateKey, a(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, l]), { liveTranslationVisible: o, setLiveTranslationVisible: a, paneComposition: i, liveToggles: c, sourceViewOnly: l, visiblePdfMode: u };
}
function Xp(e, { liveTranslationVisible: t, setLiveTranslationVisible: n, liveToggles: r, sourceViewOnly: o, visiblePdfMode: a }) {
  const s = Rl(e.liveTranslation), i = A(() => {
    s && e.goToPage(s, "source");
  }, [e.goToPage, s]), [c, l] = N(null);
  z(() => {
    a === "compare" && e.session.jobTerminal && l(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, a]);
  const u = c !== e.viewStateKey && Nl({
    state: e.liveTranslation,
    sourceViewOnly: o,
    visibleMode: a
  }), f = W(() => r.sourcePaneToggle ? /* @__PURE__ */ p(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${t ? " is-active" : ""}`,
      onClick: () => n((d) => !d),
      "aria-pressed": t,
      title: t ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [r.sourcePaneToggle, t]);
  return { latestLivePage: s, jumpToLatestLivePage: i, offerCompletion: u, setCompletionDismissedKey: l, sourcePaneAction: f };
}
function Yp() {
  const [e] = N(of), t = gf(e), n = df(t);
  return { contributionStore: e, contributions: t, reserveRight: n };
}
function Zp(e, t, n) {
  const r = x(e);
  z(() => {
    const o = e > 0 && r.current <= 0;
    r.current = e, o && t && n();
  }, [e]);
}
function Qp(e, t, {
  translationVersions: n,
  bookmarks: r,
  regionHover: o,
  assistantPanel: a,
  closeAssistant: s,
  visiblePdfMode: i,
  changeWorkspace: c,
  jumpToBlockIn: l,
  zoomDocuments: u,
  editBlock: f,
  panelHost: d = null
}) {
  const { session: m, panes: g } = e, h = x(e.currentPage);
  h.current = e.currentPage;
  const y = A(() => h.current, []), I = W(() => ({
    documentId: m.documentId || "",
    jobId: m.jobId,
    versionId: n.readingVersionId || null,
    translationVersions: n.versions,
    regions: m.regions,
    metadata: m.readerMetadata,
    bookmarks: r,
    pageCount: g.hudNumPages || 0,
    resetKey: e.viewStateKey,
    hoveredItemId: () => o.get().itemId,
    goToPage: e.goToPage,
    sourceOnly: e.sourceOnly,
    activePanel: a,
    closePanel: s,
    panelHost: d,
    visibleMode: i,
    setWorkspace: c,
    jumpToBlock: l,
    shellEl: e.shell.shellEl,
    primaryPane: e.panes.primaryPane,
    pdfDocuments: u,
    editBlock: f,
    currentPage: y
  }), [
    m.documentId,
    m.jobId,
    n,
    m.regions,
    m.readerMetadata,
    r,
    g.hudNumPages,
    e.viewStateKey,
    o,
    e.goToPage,
    e.sourceOnly,
    a,
    s,
    i,
    c,
    l,
    e.shell.shellEl,
    e.panes.primaryPane,
    u,
    f,
    d
  ]), { contributionStore: S, contributions: b, reserveRight: w } = t, v = W(() => sf(b), [b]), R = W(() => ff(b), [b]), C = W(() => uf(b), [b]), M = W(() => cf(b), [b]), P = lf(b);
  return { readerApi: I, contributionStore: S, contributions: b, pageLayers: v, compareVersion: R, textMarks: C, menuSections: M, pointerTakenId: P, reserveRight: w };
}
function eg() {
  try {
    return nt().translationEdit ?? null;
  } catch {
    return null;
  }
}
const tg = "这本书正在处理（翻译或排版），处理完才能改。", ng = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function rg({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = eg(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = vu(s), l = !t || Wt(t), u = Eu(n), [f, d] = N(""), [m, g] = N(null), [h, y] = N(() => /* @__PURE__ */ new Map()), [I, S] = N(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [b, w] = N(() => /* @__PURE__ */ new Map()), [v, R] = N({ phase: "idle" }), C = x({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  z(() => {
    g(null), C.drafts.clear(), C.generation.current = null, w(/* @__PURE__ */ new Map()), R({ phase: "idle" });
  }, [s]), z(() => {
    if (d(""), !i || c || !a) return;
    let $ = !1;
    return a.resolveOwnerJobId(s).then((K) => {
      $ || d(`${K || s}`.trim() || s);
    }).catch(() => {
      $ || d(s);
    }), () => {
      $ = !0;
    };
  }, [i, c, a, s]), z(() => {
    if (y(/* @__PURE__ */ new Map()), !a || !f || !u || !l) return;
    let $ = !1;
    return a.fetchRevisions(f).then((K) => {
      $ || y(Pu(K, u));
    }).catch(() => {
    }), () => {
      $ = !0;
    };
  }, [a, f, u, l]);
  const M = v.phase === "running" && v.seenActive;
  z(() => {
    if (v.phase === "running") {
      if (!l) {
        M || R({ phase: "running", seenActive: !0 });
        return;
      }
      M && R(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [v.phase, M, l, t]);
  const P = W(() => {
    const $ = new Map(h);
    if (I.renderedAt === u)
      for (const [K, H] of I.edits) $.set(K, H);
    return $;
  }, [h, I, u]), T = A(($) => {
    const K = `${$ || ""}`.trim();
    K && g({ itemId: K, page: wu(K) });
  }, []), k = A(() => g(null), []), E = A(($, K) => {
    S((H) => {
      const J = new Map(H.renderedAt === u ? H.edits : []);
      return J.set($, K), { renderedAt: u, edits: J };
    }), w((H) => new Map(H).set($, (H.get($) || 0) + 1));
  }, [u]), _ = A(async () => {
    if (!(!a || !s || v.phase === "submitting" || v.phase === "running")) {
      R({ phase: "submitting" });
      try {
        await a.rerender(s), R({ phase: "running", seenActive: !1 }), await o();
      } catch ($) {
        R({ phase: "failed", message: ($ == null ? void 0 : $.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, v.phase, o]), D = c ? ng : !l || v.phase === "running" || v.phase === "submitting" ? tg : "";
  return W(() => ({
    available: i,
    blockedReason: D,
    port: a,
    ownerJobId: f,
    target: m,
    select: T,
    close: k,
    memory: C,
    pendingEdits: P,
    savedCounts: b,
    markSaved: E,
    rerender: v,
    startRerender: _
  }), [i, D, a, f, m, T, k, C, P, b, E, v, _]);
}
function og(e, t) {
  z(() => {
    if (!e) return;
    const n = (r) => {
      var s;
      if (r.key !== "e" && r.key !== "E" || r.metaKey || r.ctrlKey || r.altKey || r.repeat) return;
      const o = r.target;
      if ((s = o == null ? void 0 : o.closest) != null && s.call(o, "input, textarea, select, [contenteditable='true']")) return;
      const a = t.get().itemId;
      a && (r.preventDefault(), e(a));
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, [e, t]);
}
function ag(e, t, n) {
  const { session: r, sessionFiles: o } = e, a = rg({
    jobId: r.jobId,
    jobStatus: r.jobStatus,
    jobPayload: r.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!o.translatedUrl,
    refreshJobStatus: r.refreshJobStatus
  }), s = a.select, i = e.setModeKeepingPage, c = r.regions, l = a.memory.drafts, u = A((d, m) => {
    Aa(c, d) && (t === "source" && i("compare"), m != null && m.trim() && l.set(d, m), s(d));
  }, [c, s, t, i, l]);
  og(a.available ? u : null, n);
  const f = W(() => {
    if (!a.savedCounts.size) return e.revisedBlocks;
    const d = new Map(e.revisedBlocks);
    for (const [m, g] of a.savedCounts) d.set(m, (d.get(m) || 0) + g);
    return d;
  }, [e.revisedBlocks, a.savedCounts]);
  return { blockEdit: a, editBlock: u, revisedBlocks: f };
}
const sg = "reader-finder-input";
function ig(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function cg(e, t = typeof window > "u" ? null : window) {
  z(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!ig(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(sg) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
const Ts = "retainpdf.reader.sidebar.v1", lg = ["search", "bookmarks", "issues"], ug = 900;
function dg() {
  var e;
  try {
    const t = JSON.parse(((e = globalThis.localStorage) == null ? void 0 : e.getItem(Ts)) || "{}");
    return { tab: lg.includes(t == null ? void 0 : t.tab) ? t.tab : "search" };
  } catch {
    return { tab: "search" };
  }
}
function fg(e) {
  var t;
  try {
    (t = globalThis.localStorage) == null || t.setItem(Ts, JSON.stringify(e));
  } catch {
  }
}
function mg() {
  const e = `(min-width: ${ug}px)`, [t, n] = N(() => typeof window > "u" || !window.matchMedia ? !0 : window.matchMedia(e).matches);
  return z(() => {
    var a;
    if (typeof window > "u" || !window.matchMedia) return;
    const r = window.matchMedia(e), o = () => n(r.matches);
    return o(), (a = r.addEventListener) == null || a.call(r, "change", o), () => {
      var s;
      return (s = r.removeEventListener) == null ? void 0 : s.call(r, "change", o);
    };
  }, [e]), t;
}
function hg(e) {
  const [t] = N(dg), [n, r] = N(null), [o, a] = N(t.tab), i = mg(), c = A((v) => {
    r(v), v && a(v);
  }, []);
  z(() => {
    fg({ tab: n || o });
  }, [n, o]);
  const l = A(() => r((v) => v ? null : o), [o]), u = A((v) => {
    r((R) => R === v ? null : v), a(v);
  }, []), [f, d] = N(""), [m, g] = N("");
  z(() => {
    const v = f.replace(/\s+/gu, " ").trim(), R = window.setTimeout(() => g(v), v ? 150 : 0);
    return () => window.clearTimeout(R);
  }, [f]);
  const [h, y] = N(0), I = A(() => {
    c("search"), y((v) => v + 1);
  }, [c]);
  cg(I);
  const S = A(() => {
    i || r(null);
  }, [i]), b = A((v) => {
    e.jumpToAnchor({ block_id: v }), S();
  }, [e.jumpToAnchor, S]), w = A((v) => {
    e.goToPage(v), S();
  }, [e.goToPage, S]);
  return {
    finder: n,
    setFinder: c,
    toggleFinder: u,
    toggleSidebar: l,
    pinned: i,
    findQuery: f,
    setFindQuery: d,
    findTerm: m,
    findFocus: h,
    jumpFromFinder: b,
    jumpToPageFromFinder: w
  };
}
function pg(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : pa(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function gg(e, t) {
  return t === null || e !== t;
}
function bg(e, t) {
  const { boot: n } = e, r = x(null), o = x(null);
  z(() => {
    if (!(n.loading || n.failed)) {
      if (r.current !== e.viewStateKey) {
        r.current = e.viewStateKey;
        const a = Je(e.viewStateKey), s = pg({
          savedMode: a == null ? void 0 : a.mode,
          sourceViewOnly: t,
          viewportWidth: Tt()
        });
        o.current = s.auto ? s.mode : null, s.mode && s.mode !== e.mode && e.setModeKeepingPage(s.mode);
        return;
      }
      gg(e.mode, o.current) && (o.current = null, Sn(e.viewStateKey, { mode: e.mode }));
    }
  }, [n.failed, n.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, t]);
}
const yg = [];
function vg(e) {
  const { sessionFiles: t } = e, [n, r] = N({}), o = x({ source: t.sourceUrl, translated: t.translatedUrl });
  o.current = { source: t.sourceUrl, translated: t.translatedUrl };
  const a = A((y, I) => {
    r((S) => ({ ...S, [I]: { url: o.current[I], nodes: y } }));
  }, []), s = W(() => {
    const y = n.source;
    if (y && y.url === t.sourceUrl && y.nodes.length) return y.nodes;
    const I = n.translated;
    return I && I.url === t.translatedUrl && I.nodes.length ? I.nodes : yg;
  }, [n, t.sourceUrl, t.translatedUrl]), i = x({}), [c, l] = N(0), u = A((y, I) => {
    i.current[I] = { url: o.current[I], pdf: y }, l((S) => S + 1);
  }, []), [f, d] = N(null), m = A((y) => d(y), []), g = A(() => d(null), []);
  z(() => d(null), [e.viewStateKey]);
  const h = W(() => {
    const y = (I, S) => {
      const b = i.current[I];
      return b && b.url === S ? b.pdf : null;
    };
    return { source: y("source", t.sourceUrl), translated: y("translated", t.translatedUrl) };
  }, [c, t.sourceUrl, t.translatedUrl]);
  return { bookmarks: s, onPdfOutline: a, onPdfDocument: u, zoomItem: f, setZoomItem: d, zoomBlock: m, closeZoom: g, zoomDocuments: h };
}
function wg() {
  const e = Fl(), { boot: t, panes: n, session: r } = e, o = dp(e.viewStateKey), a = o.panel, s = o.setPanel, i = a !== null, c = Yp(), { reserveRight: l } = c, u = i || l > 0, f = hg(e), { finder: d, findTerm: m } = f, g = !!d && f.pinned, h = A(() => {
    s(null);
  }, []);
  Zp(l, a, h);
  const { liveTranslationVisible: y, setLiveTranslationVisible: I, paneComposition: S, liveToggles: b, sourceViewOnly: w, visiblePdfMode: v } = Gp(
    e,
    i,
    qp(e.shell.shellWidth, u || g)
  );
  bg(e, w);
  const R = a || (e.mode === "compare" ? "compare" : "reading"), { docDark: C, toggleDocDark: M } = Bp();
  Vl({
    toggleDocDark: M,
    mode: v,
    sourceOnly: e.sourceOnly,
    setMode: e.setModeKeepingPage,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    currentPage: e.currentPage,
    numPages: n.hudNumPages,
    goToPage: e.goToPage,
    enabled: e.showHud
  });
  const { latestLivePage: P, jumpToLatestLivePage: T, offerCompletion: k, setCompletionDismissedKey: E, sourcePaneAction: _ } = Xp(e, {
    liveTranslationVisible: y,
    setLiveTranslationVisible: I,
    liveToggles: b,
    sourceViewOnly: w,
    visiblePdfMode: v
  }), D = A((O) => {
    const V = Jp(O, e.liveTranslationAvailable);
    V !== null && I(V), e.setModeKeepingPage(O);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), $ = A((O) => {
    s(O);
  }, []), [K] = N(pp), H = A((O) => e.jumpToAnchor({ block_id: O }), [e.jumpToAnchor]), J = Lp(e.sourceOnly ? "" : r.jobId, e.currentPage, H), [le, ee] = N(null), ie = A((O, V) => e.jumpToAnchor({ block_id: O }, V), [e.jumpToAnchor]), { bookmarks: Se, onPdfOutline: Z, onPdfDocument: de, zoomItem: Le, setZoomItem: ae, zoomBlock: fe, closeZoom: B, zoomDocuments: U } = vg(e), G = W(() => Ss(Se, _a(r.regions)).length > 0, [Se, r.regions]), [se, ne] = N(!1), me = A(() => ne(!1), []), { blockEdit: we, editBlock: re, revisedBlocks: Q } = ag(e, v, K), [ge, F] = N(null), te = A(() => F(null), []), he = nm({ documentId: r.documentId, jobId: r.jobId }), {
    readerApi: Oe,
    contributionStore: Ce,
    contributions: _e,
    pageLayers: Be,
    compareVersion: ze,
    textMarks: Ne,
    menuSections: Ke,
    pointerTakenId: De
  } = Qp(e, c, {
    translationVersions: he,
    bookmarks: Se,
    regionHover: K,
    assistantPanel: a,
    closeAssistant: h,
    visiblePdfMode: v,
    changeWorkspace: D,
    jumpToBlockIn: ie,
    zoomDocuments: U,
    editBlock: we.available && !we.blockedReason ? re : null,
    panelHost: le
  }), Fe = !!De, [j, q] = N([]), ue = W(() => ({
    bindShell: e.shell.bindShell,
    shellEl: e.shell.shellEl,
    shellWidth: e.shell.shellWidth,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    rowHeights: e.rowHeights,
    mountSource: e.panes.mountSource,
    mountTranslated: e.panes.mountTranslated,
    onMetrics: e.panes.onMetrics,
    onNumPagesChange: e.panes.onNumPages,
    sourceUrl: e.sessionFiles.sourceUrl,
    translatedUrl: e.sessionFiles.translatedUrl,
    sourceFile: e.sessionFiles.sourceFile,
    translatedFile: e.sessionFiles.translatedFile,
    regions: r.regions,
    readerMetadata: r.readerMetadata,
    activeRegion: e.activeRegion,
    regionHover: K,
    jumpToBlock: H,
    revisedBlocks: Q,
    onPdfOutline: Z,
    onPdfDocument: de,
    zoomBlock: fe,
    textMarks: Ne,
    pageLayers: Be,
    editBlock: we.available ? re : void 0,
    blockEdit: we,
    editShowsSource: v !== "compare",
    findTerm: d === "search" ? m : "",
    compareVersion: ze,
    pointerTaken: Fe,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: w,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: $, close: h },
    docDark: C,
    toggleDocDark: M
  }), [
    e.shell,
    e.userZoom,
    e.onZoomChange,
    e.rowHeights,
    e.panes,
    e.sessionFiles,
    r.regions,
    r.readerMetadata,
    e.activeRegion,
    K,
    H,
    Q,
    Z,
    de,
    fe,
    Ne,
    Be,
    we,
    re,
    v,
    d,
    m,
    ze,
    Fe,
    e.sourceOnly,
    w,
    e.download,
    e.goToPage,
    $,
    h,
    C,
    M
  ]), ve = W(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), Re = [
    gc,
    `is-workspace-${R}`,
    i ? "is-assistant-open" : "",
    d ? "is-finder-open" : "",
    g ? "is-sidebar-pinned" : "",
    S.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(hf, { api: Oe, store: Ce, children: /* @__PURE__ */ p(vd, { value: ue, hud: ve, children: /* @__PURE__ */ L(
    "div",
    {
      className: Re,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": R,
      "data-pointer-taken": De || void 0,
      onContextMenu: (O) => {
        const V = Dp(O);
        if (!V) return;
        const X = af(_e, { target: O.target, clientX: O.clientX, clientY: O.clientY, page: V.page });
        !X.length && !Ke.length || (O.preventDefault(), q(X), F(V));
      },
      children: [
        /* @__PURE__ */ p(
          rf,
          {
            mode: v,
            documentReady: !!r.jobId,
            sourceViewOnly: w,
            onModeChange: D,
            compareExtra: /* @__PURE__ */ p(nr, { place: "compare" }),
            liveTranslation: b.topBarPill ? {
              visible: y,
              state: e.liveTranslation,
              onToggle: () => I((O) => !O),
              latestPage: y ? P : null,
              currentPage: e.currentPage,
              onJumpToLatest: T
            } : null,
            completion: k ? {
              onOpenCompare: () => {
                E(e.viewStateKey), D("compare");
              }
            } : null,
            start: /* @__PURE__ */ L($e, { children: [
              /* @__PURE__ */ p(Ql, { onBeforeClose: r.prepareClose }),
              /* @__PURE__ */ p(Ep, { pinned: se && G, available: G, onToggle: () => ne((O) => !O) }),
              /* @__PURE__ */ p(yp, { open: d, onToggle: f.toggleSidebar, issueCount: J.issues.length }),
              r.title ? /* @__PURE__ */ p("span", { className: "reader-workspace-title", title: r.title, children: r.title }) : null
            ] })
          }
        ),
        /* @__PURE__ */ L("div", { className: "reader-workspace", children: [
          /* @__PURE__ */ p(Up, { state: f, bookmarkScope: e.viewStateKey, issues: J }),
          /* @__PURE__ */ L("div", { className: "reader-stage", children: [
            /* @__PURE__ */ p(Pp, { bookmarks: Se, onJumpPage: e.goToPage, onJumpBlock: H, pinned: se, onUnpin: me }),
            /* @__PURE__ */ p(Rp, { active: a }),
            /* @__PURE__ */ p(Qd, { paneComposition: S, markdownSplit: i, assistantSplit: u, liveTranslation: e.liveTranslation, sourcePaneAction: _ }),
            /* @__PURE__ */ p(Kh, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!r.readerErrors.regions, metadataError: !!r.readerErrors.metadata, onRetry: r.refreshJobArtifacts })
          ] }),
          /* @__PURE__ */ L(
            "aside",
            {
              className: "reader-dock",
              hidden: !u,
              "data-dock": i ? "panel" : l ? "extension" : void 0,
              style: !i && l ? { "--reader-dock-width": `${l}px` } : void 0,
              "aria-label": "阅读辅助面板",
              children: [
                /* @__PURE__ */ p(nh, { active: a }),
                /* @__PURE__ */ p("div", { className: "reader-dock-body", ref: ee })
              ]
            }
          )
        ] }),
        i ? /* @__PURE__ */ p(Hh, {}) : null,
        /* @__PURE__ */ p(
          up,
          {
            mode: v,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            leftSlot: /* @__PURE__ */ p(Op, { edit: we }),
            toolsSlot: /* @__PURE__ */ p(nr, { place: "bottom" })
          }
        ),
        /* @__PURE__ */ p(
          Kp,
          {
            session: r,
            zoomDocuments: U,
            zoomItem: Le,
            setZoomItem: ae,
            closeZoom: B,
            visiblePdfMode: v
          }
        ),
        /* @__PURE__ */ p($p, { menu: ge, onClose: te, actions: j, sections: Ke }),
        /* @__PURE__ */ p(yf, { extensions: hr }),
        /* @__PURE__ */ p(hp, {})
      ]
    }
  ) }) });
}
function Kg() {
  return /* @__PURE__ */ p(wg, {});
}
export {
  Kg as R,
  wg as a,
  jg as b,
  Hg as c,
  Lf as d,
  Df as e,
  Fg as f,
  Bg as g,
  Og as h,
  zg as r,
  Ug as s,
  Ge as u
};
//# sourceMappingURL=ReaderApp-B_m6tFQf.js.map
