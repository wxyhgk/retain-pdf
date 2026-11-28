var Ys = Object.defineProperty;
var jr = (e) => {
  throw TypeError(e);
};
var Zs = (e, t, n) => t in e ? Ys(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var Ur = (e, t, n) => Zs(e, typeof t != "symbol" ? t + "" : t, n), Wr = (e, t, n) => t.has(e) || jr("Cannot " + n);
var Ct = (e, t, n) => (Wr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Kr = (e, t, n) => t.has(e) ? jr("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Vr = (e, t, n, r) => (Wr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as C, jsx as p, Fragment as _e } from "react/jsx-runtime";
import { useMemo as U, useState as _, useEffect as O, useCallback as L, useRef as A, useLayoutEffect as Ae, memo as Qt, createContext as en, useContext as dt, Fragment as En, forwardRef as Qs, useImperativeHandle as ur, useSyncExternalStore as Rn, Component as ei, Suspense as ma, lazy as ha, useId as pa } from "react";
import { requireAdapter as At, getReaderAdapters as $e } from "./adapters.js";
import { resolveReaderDownloadName as ti, resolveReaderDownloadUrls as ni, READER_PROGRESS_COPY as Ke, trimString as pn, READER_DOWNLOAD_ACTIONS as ri, disabledReason as oi } from "./runtime/state.js";
import { r as ai, b as si } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as Hn, isFinishedJobStatus as qt } from "@retainpdf/domain/job";
import { n as ga, d as ii, f as xn, k as qr, b as ci, c as li, j as Le, p as ct, g as ui, l as ft, i as di } from "./reader-regions-BmqHsJ-I.js";
import { fetchDocumentReading as fi } from "@retainpdf/api/documents";
import { isReaderTransportError as mi, createReaderTransportError as hi } from "./contracts.js";
import { toast as jn, Toaster as pi } from "sonner";
import { ChevronLeft as ba, PenLine as gn, ZoomIn as gi, Check as dr, X as bt, Copy as ya, ChevronUp as bi, ChevronDown as bn, History as yi, LoaderCircle as vi, Pin as va, LogOut as wi, FileText as wa, Columns2 as Sa, Languages as Ia, Radio as Si, ArrowDownToLine as Ii, CheckCircle2 as Ti, ImagePlus as ki, MessageCircle as Ta, Scan as Ei, GitCompareArrows as Ri, CodeXml as Pi, Highlighter as Mi, Eraser as xi, Undo2 as Ni, Trash2 as _i, BookText as Ai, ChevronRight as ka, Minus as Ea, Plus as Ra, ArrowLeft as Li, CircleHelp as Ci, Download as Di, Bookmark as $i, Star as Pa, Contrast as Oi, Search as Ma, PinOff as zi } from "lucide-react";
import { Button as X, Textarea as Fi, IconButton as ut, Input as fr } from "@retainpdf/ui";
import { e as Bi, m as Hi, a as ji } from "./markdown-math-XkF5urpn.js";
import { createPortal as Ui } from "react-dom";
import { pdfjs as xa, Page as Wi, Document as Ki } from "react-pdf";
const Vi = (...e) => {
  var t, n;
  return ((n = (t = $e()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, qi = "", Ji = Object.freeze({
  progress: "retainpdf-reader-progress"
}), Gi = (e) => {
  var t, n;
  return ((n = (t = $e()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, Bb = (...e) => {
  var n;
  return (((n = $e()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Hb = () => {
  var e, t;
  return ((t = (e = $e()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
}, Ve = () => At("defaultReaderDataPort"), Jr = () => At("defaultReaderPageConfigPort"), jb = {
  get apiPrefix() {
    return Ve().apiPrefix;
  },
  fetchProtected: (...e) => Ve().fetchProtected(...e),
  loadMarkdownPayload: (e) => Ve().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => Ve().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => Ve().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => Ve().loadJobPayload(e),
  loadReaderPayload: (e, t) => Ve().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => Ve().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return Ve().liveTranslation;
  }
}, Na = {
  messageTargetOrigin: () => Jr().messageTargetOrigin(),
  readerJobId: () => Jr().readerJobId()
}, Xi = () => {
  var e;
  return ((e = $e()) == null ? void 0 : e.liveTranslation) ?? null;
}, Jt = () => {
  var t;
  const e = $e();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, Ye = () => {
  const e = $e();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => At("fetchDocumentByJobId")(...n),
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
}, Yi = (...e) => {
  var t, n;
  return ((n = (t = $e()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, Zi = () => {
  var e, t;
  return ((t = (e = $e()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, Qi = (...e) => {
  var t, n;
  return ((n = (t = $e()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, ec = (...e) => {
  var t, n;
  return ((n = (t = $e()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? ti(...e);
}, tc = (...e) => {
  var t, n;
  return ((n = (t = $e()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? ni(...e);
}, nc = (...e) => At("downloadProtectedResource")(...e), rc = (...e) => At("failDownloadToast")(...e), Ub = (e, t) => At("resolveMarkdownAssetUrl")(e, t), Gr = "/api/v1";
function oc() {
  const e = () => {
    var r;
    return ai(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = _(e);
  return O(() => {
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
function ac() {
  const e = oc(), t = U(() => Qi(Na), [e]), n = U(() => Zi(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function sc(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: i
  } = e, [c, l] = _({
    documentId: "",
    jobId: ""
  }), [u, f] = _({
    documentId: "",
    jobId: ""
  }), d = c.documentId === t ? c.jobId : "", m = u.documentId === t ? u.jobId : "", g = n || d, [h, y] = _({
    jobId: "",
    documentId: ""
  }), I = h.jobId === g ? h.documentId : "", S = t || I, b = !!t && !g, [w, v] = _(null), P = (w == null ? void 0 : w.sessionIdentity) === r && w.documentId === S ? w : null, M = b || !!P, E = L((N) => {
    const k = `${N.documentId || ""}`.trim();
    if (!k || a.current && a.current !== k) return;
    if (!a.current && s.current)
      y({
        jobId: s.current,
        documentId: k
      });
    else if (!a.current)
      return;
    const T = `${N.revision || ""}`.trim() || `${Date.now()}`;
    v({
      documentId: k,
      revision: T,
      sessionIdentity: o.current
    }), i();
  }, []);
  O(() => {
    v((N) => N && N.sessionIdentity !== r ? null : N);
  }, [r]);
  const $ = L((N) => {
    switch (N.type) {
      case "resolved-document-job":
        l({ documentId: N.documentId, jobId: N.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        f({ documentId: N.documentId, jobId: N.jobId });
        break;
      case "resolved-job-document":
        y((k) => k.jobId === N.jobId && k.documentId === N.documentId ? k : { jobId: N.jobId, documentId: N.documentId });
        break;
      case "committed-source":
        v({
          documentId: N.documentId,
          revision: N.revision,
          sessionIdentity: N.sessionIdentity
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
    activeCommittedDocumentSource: P,
    sourceViewOnly: M,
    refreshCommittedDocument: E,
    applyIdentityEvent: $
  };
}
function Xr(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function ic(e) {
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
function Yr(e, t) {
  return Gi(Hn(e, t));
}
function cc(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function lc(e, t) {
  const n = e == null ? void 0 : e.book_summary, r = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    n == null ? void 0 : n.title,
    e == null ? void 0 : e.source_file_name,
    n == null ? void 0 : n.source_file_name
  ];
  for (const o of r) {
    const a = `${o || ""}`.trim();
    if (a && !cc(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function Un({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: Ji.progress,
        stage: n,
        percent: e,
        text: t
      },
      Na.messageTargetOrigin()
    );
  } catch {
  }
}
function yn(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), Un({ percent: t, text: n, stage: r });
}
function uc(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = _(null), [l, u] = _(null), [f, d] = _(""), [m, g] = _(0), h = f === n ? i : null, y = f === n ? l : null, I = Xr(h), S = qt(I), b = L(() => {
    g(($) => $ + 1);
  }, []), w = L(($) => {
    c($.jobPayload), u($.manifestPayload), d($.sessionIdentity);
  }, []), v = L(($) => {
    c(null), u(null), d($);
  }, []), P = A(""), M = A(""), E = L(async () => {
    const $ = o.current;
    if (!$ || P.current === $) return;
    const N = Ye().loadJobPayload;
    if (typeof N != "function") return;
    const k = a.current.value;
    P.current = $;
    try {
      const T = await N($);
      if (s.current || a.current.value !== k || o.current !== $ || !T || typeof T != "object")
        return;
      const R = Xr(T);
      c(T), d(r.current), !qt(R) && M.current === $ && (M.current = ""), R === "succeeded" && M.current !== $ && (M.current = $, g((D) => D + 1));
    } catch {
    } finally {
      P.current === $ && (P.current = "");
    }
  }, []);
  return O(() => {
    M.current = "";
  }, [n]), O(() => {
    if (!t || S || !h) return;
    const $ = window.setInterval(() => {
      document.visibilityState !== "hidden" && E();
    }, 1e3);
    return () => window.clearInterval($);
  }, [S, E, h, t]), {
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
    refreshJobStatus: E,
    publishPayload: w,
    clearPayload: v
  };
}
function Wn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function dc(e, t) {
  e(t), Wn(t);
}
function fc(e) {
  const [t, n] = _(e ? "source" : "compare"), r = L((a) => {
    e && a !== "source" || (n(a), Wn(a));
  }, [e]), o = L((a) => {
    dc(n, a);
  }, []);
  return O(() => (e && document.documentElement.classList.add("reader-source-only"), Wn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Zr(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function mc(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Zr(n.active_job_id),
    activeVersionId: Zr(n.active_version_id)
  };
}
function hc(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function pc(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function gc(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const bc = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function yc(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = bc.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const vc = 48 * 1024 * 1024;
function wc(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Sc = 2, De = /* @__PURE__ */ new Map();
function Kn(e, t) {
  De.delete(e), De.set(e, t);
}
function Qr(e) {
  if (De.size < Sc) return;
  const t = De.keys().next().value;
  t && De.delete(t);
}
async function Ic(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function _a(e, t = Jt().fetchProtected, n = {}) {
  var u, f, d, m, g, h, y, I, S;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (De.has(r)) {
    const b = De.get(r);
    return Kn(r, b), b;
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
    const w = await Ic(s);
    throw w && (b.reason = w), b;
  }
  const i = Tc(r, s, t);
  if (i) {
    o.abort();
    const b = { ranged: i };
    return Qr(), De.set(r, b), b;
  }
  (y = (h = n.signal) == null ? void 0 : h.addEventListener) == null || y.call(h, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (S = (I = n.signal) == null ? void 0 : I.removeEventListener) == null || S.call(I, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return De.has(r) ? Kn(r, l) : (Qr(), De.set(r, l)), l;
}
function Tc(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < vc ? null : {
    url: e,
    length: o,
    async fetchRange(i, c) {
      const l = await n(e, { headers: { Range: `bytes=${i}-${c - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const kc = { file: null, loading: !1, error: "" }, Ec = { file: null, loading: !0, error: "" };
function Rc(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = _(null);
  if (O(() => {
    if (t || !n) return;
    const s = De.get(n);
    if (s) {
      Kn(n, s);
      return;
    }
    const i = new AbortController();
    return _a(n, void 0, { signal: i.signal }).then((c) => {
      i.signal.aborted || o({ url: n, file: c, loading: !1, error: "" });
    }).catch((c) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (c == null ? void 0 : c.message) || String(c) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return kc;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = De.get(n);
  return a ? { file: a, loading: !1, error: "" } : Ec;
}
function Pc(e) {
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
async function Vn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  yn(s, r, n, "download");
  const i = await _a(t, Jt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (yn(s, o, n, "download"), i);
}
async function Mc(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  yn(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    Vn({
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
    Vn({
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
function xc(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Nc({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = fi,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(xc(o.href, t, a)), !0);
}
const on = {
  regions: null,
  metadata: null
};
function _c(e) {
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
  } = e, [S, b] = _(""), [w, v] = _(""), [P, M] = _(null), [E, $] = _(null), [N, k] = _(!1), [T, R] = _(""), [D, z] = _([]), [K, j] = _(!1), [J, oe] = _(() => ({
    source: null,
    translated: null
  })), [q, se] = _(
    on
  ), [ke, re] = _({
    loading: !0,
    percent: 4,
    text: Ke.boot,
    stage: "progress",
    failed: !1
  });
  return O(() => {
    const ue = new AbortController(), Pe = h.current.value, ie = Pc({
      sessionEpochRef: h,
      closingRef: y,
      abort: ue,
      sessionEpoch: Pe
    });
    I.current = ue;
    const le = Ye();
    if (y.current)
      return ue.abort(), () => {
        I.current === ue && (I.current = null);
      };
    let B = !1;
    function W(ee, Z) {
      ie.markFailed(), j(!0), re({
        loading: !1,
        percent: 100,
        text: ee,
        stage: "failed",
        failed: !0
      }), Un({ percent: 100, text: Z, stage: "failed" });
    }
    function Y() {
      k(!0), B || j(!0), re({
        loading: !1,
        percent: 100,
        text: Ke.ready,
        stage: "ready",
        failed: !1
      }), Un({ percent: 100, text: Ke.ready, stage: "ready" });
    }
    function de() {
      return l != null && l.documentId ? Yr(
        l.documentId,
        l.revision
      ) : Vi() ? qi : le.resolveResourceUrl(Hn(r));
    }
    async function ne() {
      var H;
      let ee = { activeJobId: "", activeVersionId: "" };
      try {
        const V = await ((H = le.fetchDocument) == null ? void 0 : H.call(le, r));
        V && (ee = mc(V));
      } catch {
      }
      const Z = hc({
        link: ee,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (Z.kind === "follow-active-job") {
        if (ie.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: Z.jobId
        }), Z.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: Z.activeVersionId,
          sessionIdentity: c
        }), m("source")) : m("compare");
        return;
      }
      if (Z.kind === "open-committed-source") {
        if (ie.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: Z.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const fe = de();
      if (ie.isInactive()) return;
      b(fe), v(""), R(""), d(c);
      const x = await Vn({
        url: fe,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: ie,
        setBoot: re
      });
      if (!ie.isInactive()) {
        if (!x) {
          W("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        M(x), Y();
      }
    }
    async function ae() {
      var ye;
      const ee = !l, Z = !!(ee && le.loadSessionSnapshot && le.loadReaderOptionalArtifacts), fe = Z ? le.loadReaderOptionalArtifacts(t) : null, x = await ((ye = le.loadSessionSnapshot) == null ? void 0 : ye.call(le, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: ee && !Z
      })), H = x ? {
        jobPayload: x.sourcePayload,
        manifestPayload: x.manifestPayload,
        readerMetadata: x.readerMetadata,
        regionsPayload: x.regions,
        readerErrors: x.readerErrors
      } : await le.loadReaderPayload(t, {
        includeOptionalArtifacts: ee
      });
      if (ie.isInactive()) return;
      let V = null;
      if (n && !r)
        if (x && x.linkedDocument !== void 0)
          V = x.linkedDocument;
        else {
          try {
            V = await le.fetchDocumentByJobId(Gr, t);
          } catch {
          }
          if (ie.isInactive()) return;
        }
      const me = ic(H.jobPayload) || `${(V == null ? void 0 : V.document_id) || ""}`.trim();
      me && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: me
      });
      const be = pc({
        payloadDocumentId: me,
        linkedActiveJobId: `${(V == null ? void 0 : V.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(V == null ? void 0 : V.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (be.kind === "restore-committed-source") {
        if (ie.isInactive()) return;
        u({
          type: "committed-source",
          documentId: be.documentId,
          revision: be.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const Ie = le.resolveReaderSourcePdf(H.manifestPayload), xe = le.resolveReaderTranslatedPdfUrl(H.jobPayload, H.manifestPayload), Oe = typeof Ie == "string" ? Ie : le.resolveReaderArtifactUrl(Ie), Be = r || me, Ze = l != null && l.documentId ? Yr(
        l.documentId,
        l.revision
      ) : Oe || (Be ? le.resolveResourceUrl(Hn(Be)) : ""), Ce = l ? "" : xe || "";
      b(Ze || ""), v(Ce), R(lc(H.jobPayload, t)), f({
        jobPayload: H.jobPayload || null,
        manifestPayload: H.manifestPayload || null,
        sessionIdentity: c
      });
      const We = () => Mc({
        sourceFinal: Ze || "",
        translatedFinal: Ce,
        fence: ie,
        setBoot: re
      }), Qe = !!(Ze || Ce), et = fe && Qe ? We() : null;
      et == null || et.catch(() => {
      });
      const wt = (F) => {
        ie.isInactive() || (z(l ? [] : ga(F.regionsPayload)), oe(l ? { source: null, translated: null } : ii(F.readerMetadata)), se(l ? on : F.readerErrors ?? on), j(!0));
      };
      if (fe ? (B = !0, fe.then(wt)) : wt(H), !Qe) {
        W(Ke.failed, Ke.failed);
        return;
      }
      const tt = await (et ?? We());
      if (tt.status !== "inactive") {
        if (tt.status === "incomplete") {
          W("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        M(tt.sourceBytes), $(tt.translatedBytes), Y();
      }
    }
    async function Se() {
      k(!1), M(null), $(null), z([]), j(!1), oe({ source: null, translated: null }), se(on), yn(re, 8, Ke.metadata, "metadata");
      try {
        if (s) {
          await ne();
          return;
        }
        if (!t) {
          W(Ke.failed, Ke.failed);
          return;
        }
        await ae();
      } catch (ee) {
        if (ie.isClosedOrStale() || (ee == null ? void 0 : ee.name) === "AbortError") return;
        ie.markFailed();
        const Z = Number(ee == null ? void 0 : ee.status), fe = `${(ee == null ? void 0 : ee.reason) || ""}`, x = yc({ status: Z, reason: fe, sessionJobId: t });
        if (x && (await Nc({
          apiPrefix: Gr,
          documentId: x,
          expiredJobId: t
        }) || ie.isClosedOrStale()))
          return;
        if (gc({
          status: Z,
          reason: fe,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const H = ee instanceof Error ? ee.message : Ke.failed;
        W(H, H);
      }
    }
    return Se(), () => {
      ue.abort(), I.current === ue && (I.current = null);
    };
  }, [t, r, o, a, s, i, l, g, n, c, u, f, d, m]), {
    sourceUrl: S,
    translatedUrl: w,
    sourceFile: P,
    translatedFile: E,
    assetsReady: N,
    title: T,
    regions: D,
    regionsSettled: K,
    readerMetadata: J,
    readerErrors: q,
    boot: ke
  };
}
function Ac() {
  const e = A(!1), t = A(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = ac(), s = A({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = A(a), c = A(""), l = A(""), u = A(() => {
  }), f = L(() => u.current(), []), d = sc({
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
  } = d, { mode: I, setMode: S, switchSessionMode: b } = fc(y);
  u.current = () => {
    b("source");
  }, i.current = a, c.current = g, l.current = m;
  const w = uc({
    sessionJobId: m,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: v,
    scopedManifestPayload: P,
    jobStatus: M,
    jobTerminal: E,
    jobRefreshRevision: $,
    refreshJobArtifacts: N,
    refreshJobStatus: k
  } = w, T = _c({
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
    jobRefreshRevision: $,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), R = L(() => {
    var z;
    e.current = !0, (z = t.current) == null || z.abort();
  }, []), D = U(
    () => ({
      fetchProtected: Ye().fetchProtected,
      jobId: m,
      jobPayload: v,
      manifestPayload: P,
      sourceUrl: T.sourceUrl,
      translatedUrl: T.translatedUrl,
      sourceOnly: y
    }),
    [m, v, P, T.sourceUrl, T.translatedUrl, y]
  );
  return {
    jobId: m,
    jobStatus: M,
    workflow: `${(v == null ? void 0 : v.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: E,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: h,
    mode: I,
    setMode: S,
    sourceUrl: T.sourceUrl,
    translatedUrl: T.translatedUrl,
    sourceFile: T.sourceFile,
    translatedFile: T.translatedFile,
    assetsReady: T.assetsReady,
    boot: T.boot,
    title: T.title,
    regions: T.regions,
    regionsSettled: T.regionsSettled,
    readerMetadata: T.readerMetadata,
    readerErrors: T.readerErrors,
    download: D,
    refreshJobArtifacts: N,
    refreshJobStatus: k,
    refreshCommittedDocument: d.refreshCommittedDocument,
    prepareClose: R
  };
}
const Lc = 160, Cc = 8, Dc = 0;
function $c() {
  const e = A(null), [t, n] = _(null), [r, o] = _(Dc), a = L((s) => {
    e.current = s, n(s);
  }, []);
  return O(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (l) => {
      !Number.isFinite(l) || l < Lc || o((u) => Math.abs(u - l) < Cc ? u : l);
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
function Oc(e) {
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
const Nn = { source: 0, translated: 0 };
function zc(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    sourceUrl: a,
    translatedUrl: s,
    sourceFile: i,
    translatedFile: c
  } = e, l = `${(t == null ? void 0 : t.identityKey) || ""}\0${a}\0${s}`, u = A(l);
  u.current = l;
  const [f, d] = _(() => ({
    identity: l,
    pages: Nn
  })), [m, g] = _(() => ({ identity: l, tick: 0 })), h = f.identity === l ? f.pages : Nn, y = m.identity === l ? m.tick : 0, I = Oc({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: S } = I, b = L((k, T) => {
    u.current === l && d((R) => {
      const D = R.identity === l ? R.pages : Nn;
      return D[T] === k && R.identity === l ? R : {
        identity: l,
        pages: { ...D, [T]: k }
      };
    });
  }, [l]), w = A(null), v = L(() => {
    w.current && clearTimeout(w.current);
    const k = l;
    w.current = setTimeout(() => {
      w.current = null, u.current === k && g((T) => ({
        identity: k,
        tick: T.identity === k ? T.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  O(() => (w.current && (clearTimeout(w.current), w.current = null), d((k) => k.identity === l && k.pages.source === 0 && k.pages.translated === 0 ? k : { identity: l, pages: { source: 0, translated: 0 } }), g((k) => k.identity === l && k.tick === 0 ? k : { identity: l, tick: 0 }), () => {
    w.current && (clearTimeout(w.current), w.current = null);
  }), [l]);
  const P = U(
    () => Math.max(h.source, h.translated),
    [h]
  ), M = S === "translated" ? h.translated : h.source || h.translated, E = t == null ? void 0 : t.userZoom, $ = t == null ? void 0 : t.shellWidth, N = `${l}-${y}-${E}-${n}-${h.source}-${h.translated}-${$}`;
  return {
    ...I,
    numPagesByPane: h,
    hudNumPages: P,
    primaryNumPages: M,
    metricsTick: y,
    onNumPages: b,
    onMetrics: v,
    rowSyncRevision: N
  };
}
const Te = "data-reader-page", we = "data-reader-pane", mr = "data-natural-height", Aa = "reader-react-root", La = "reader-react-grid", Ca = "reader-react-scroll-shell", tn = "reader-react-pdf-pane", Da = "reader-react-pdf-page", vn = "reader-react-pdf-page-placeholder", hr = "reader-react-pdf-page-slot";
function wn(e, t) {
  const n = e != null ? `[${Te}="${e}"]` : `[${Te}]`;
  return t ? `${n}[${we}="${t}"]` : n;
}
function pr() {
  return `.${hr}[${Te}]`;
}
function Sn(e) {
  return Number(e.getAttribute(Te));
}
const $a = 0.25, In = 1, Fc = 0.05, nn = 0.5, Bc = 16, Hc = 8, Oa = Bc + Hc, jc = 720;
function Rt() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function za(e) {
  return Number.isFinite(e) && e < jc;
}
function kt(e, t = Number.POSITIVE_INFINITY) {
  return za(t) && (e === "source" || e === "translated") ? In : nn;
}
function Ge(e) {
  return Number.isFinite(e) ? Math.min(In, Math.max($a, e)) : nn;
}
function Gt(e, t) {
  const n = Ge(Number(e) + t * Fc);
  return Math.round(n * 100) / 100;
}
function Uc(e) {
  return Math.round(Ge(e) * 100);
}
function Fa(e) {
  const n = (Number(e) || 0) - Oa;
  return Math.max(160, Math.floor(n));
}
function Wc(e, t = nn) {
  const n = Ge(t);
  return Fa((Number(e) || 0) * n);
}
function Kc(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${we}]`)
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
const Vc = 8;
function qc(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < Vc ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const Ba = 200, Jc = [
  "markdown"
], Gc = Jc;
function Ha(e) {
  return Gc.includes(e);
}
const Xc = "retainpdf:reader:view:v1:", eo = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), Yc = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function ja() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function qn(e) {
  return `${e || ""}`.trim();
}
function Zc({
  documentId: e,
  jobId: t
}) {
  const n = qn(e);
  if (n) return `document:${n}`;
  const r = qn(t);
  return r ? `job:${r}` : "";
}
function Ua(e) {
  const t = qn(e);
  return t ? `${Xc}${t}` : "";
}
function Qc(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function el(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!eo.has(t) || !eo.has(n) || t === n))
    return { left: t, right: n };
}
function tl(e) {
  return e === null ? null : Ha(e) ? e : void 0;
}
function nl(e) {
  return Yc.has(e) ? e : void 0;
}
function Wa(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = Qc(t.anchor), r = Number(t.zoom), o = nl(t.mode), a = el(t.splitLayout), s = tl(t.assistantPanel);
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
function Ue(e, t = ja()) {
  const n = Ua(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? Wa(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function Pn(e, t, n = ja()) {
  const r = Ua(e);
  if (!r || !n) return null;
  const o = Ue(e, n), a = Wa({
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
function rl(e, t, n = "") {
  var d;
  const [r, o] = _(() => {
    var m;
    return ((m = Ue(n)) == null ? void 0 : m.zoom) ?? kt(e, Rt());
  }), a = A(r), s = A(n);
  a.current = r;
  const i = A(1), c = A(((d = Ue(n)) == null ? void 0 : d.zoom) !== void 0);
  O(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const m = (h = Ue(n)) == null ? void 0 : h.zoom;
    c.current = m !== void 0;
    const g = m ?? kt(e, Rt());
    i.current = 1, a.current = g, o(g);
  }, [e, n]), O(() => {
    if (c.current) return;
    const m = kt(e, Rt()), g = a.current;
    Math.abs(m - g) < 5e-4 || (i.current = 1, a.current = m, o(m));
  }, [e]);
  const l = L((m, g) => {
    const h = Ge(m), y = a.current;
    Math.abs(h - y) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : h / (y || 1), a.current = h, c.current = !0, Pn(s.current, { zoom: h }), o(h));
  }, []), u = L((m) => {
    l(Gt(a.current, m));
  }, [l]), f = L((m) => {
    l(kt(m));
  }, [l]);
  return Ae(() => {
    const m = i.current;
    Math.abs(m - 1) < 1e-3 || (i.current = 1, Kc(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: f };
}
const ol = 160, al = 3e-3, to = 50, sl = 16, il = 800;
function cl(e, t = 0) {
  const n = t === 1 ? sl : t === 2 ? il : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-to, Math.min(to, r));
  return Math.exp(-o * al);
}
function ll(e, t, n = 0) {
  return Ge(e * cl(t, n));
}
function ul(e) {
  return Math.round(Ge(e) * 100) / 100;
}
function dl(e, t, n) {
  const r = Ge(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return Ge(t) / r;
  const a = (o + Oa) / r;
  return Fa(a * Ge(t)) / o;
}
function fl(e) {
  return Array.from(e.querySelectorAll(pr()));
}
function ml(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function hl(e, t, n) {
  let r = null;
  for (const s of fl(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const c = ml(i, t, n);
    if ((!r || c < r.distance) && (r = { el: s, rect: i, distance: c }), c === 0) break;
  }
  if (!r) return null;
  const { el: o, rect: a } = r;
  return {
    page: o.getAttribute(Te) || "",
    pane: o.getAttribute(we) || "",
    fracX: (t - a.left) / a.width,
    fracY: (n - a.top) / a.height,
    clientX: t,
    clientY: n,
    pageWidth: a.width
  };
}
function pl(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function Ka(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${pr()}[${Te}="${t.page}"][${we}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (pl(n, e).scrollLeft += a);
}
function gl(e, t, n, r) {
  const o = e.querySelector(`.${La}`);
  if (!o) return null;
  if (!o.style.transformOrigin) {
    const a = o.getBoundingClientRect();
    o.style.transformOrigin = `${n - a.left}px ${r - a.top}px`, o.style.willChange = "transform";
  }
  return o.style.transform = `scale(${t})`, o;
}
function Dt(e) {
  e && (e.style.transform = "", e.style.transformOrigin = "", e.style.willChange = "");
}
const bl = 600, yl = 1e3;
function vl(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || Ka(e, t);
  });
  a.observe(n);
  const s = (u) => {
    u.type === "wheel" && u.ctrlKey || l();
  }, i = ["wheel", "keydown", "pointerdown", "touchstart"];
  for (const u of i) r.addEventListener(u, s, { capture: !0, passive: !0 });
  const c = r.setTimeout(() => l(), yl);
  function l() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(c);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return l;
}
function wl(e, t, n) {
  const r = A(t);
  r.current = t;
  const o = A(n);
  o.current = n;
  const a = A(null), s = A(null), i = A(null);
  O(() => {
    if (!e) return;
    const c = () => {
      const u = a.current;
      if (a.current = null, !u) return;
      const f = ul(u.target);
      if (Math.abs(f - r.current) < 5e-3) {
        Dt(u.grid);
        return;
      }
      const d = { anchor: u.anchor, grid: u.grid, fallback: null };
      d.fallback = setTimeout(() => {
        s.current === d && (s.current = null, Dt(d.grid));
      }, bl), s.current = d, o.current(f, { keepScroll: !1 });
    }, l = (u) => {
      var m, g;
      if (!u.ctrlKey) return;
      u.preventDefault();
      let f = a.current;
      if (!f) {
        (m = i.current) == null || m.call(i), i.current = null;
        const h = s.current;
        h && (h.fallback && clearTimeout(h.fallback), s.current = null, Dt(h.grid)), f = {
          start: r.current,
          target: r.current,
          anchor: hl(e, u.clientX, u.clientY),
          grid: null,
          timer: null
        }, a.current = f;
      }
      f.target = ll(f.target, u.deltaY, u.deltaMode);
      const d = dl(f.start, f.target, ((g = f.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      f.grid = gl(e, d, u.clientX, u.clientY) ?? f.grid, f.timer && clearTimeout(f.timer), f.timer = setTimeout(c, ol);
    };
    return e.addEventListener("wheel", l, { passive: !1 }), () => {
      var f;
      e.removeEventListener("wheel", l);
      const u = a.current;
      a.current = null, u != null && u.timer && clearTimeout(u.timer), Dt((u == null ? void 0 : u.grid) ?? null), (f = i.current) == null || f.call(i), i.current = null;
    };
  }, [e]), Ae(() => {
    var l;
    const c = s.current;
    c && (s.current = null, c.fallback && clearTimeout(c.fallback), Dt(c.grid), !(!e || !c.anchor) && (Ka(e, c.anchor), (l = i.current) == null || l.call(i), i.current = vl(e, c.anchor)));
  }, [t, e]);
}
function Sl(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = A(t), a = A(n), s = A(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: L((c) => {
    c !== o.current && (s.current(), a.current(c));
  }, []) };
}
const gr = 56;
function Va(e, t = gr) {
  return e.getBoundingClientRect().top + t;
}
function qa(e, t) {
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
  const o = Sn(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function Wt(e, t, n = gr) {
  if (!e)
    return null;
  const r = wn(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = Va(e, n), i = qa(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function Nt(e, t, n = "auto", r, o = gr) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(wn(a, r))), i || (i = e.querySelector(wn(a))), !i)
    return !1;
  const c = e.getBoundingClientRect(), l = i.getBoundingClientRect();
  if (c.height <= 0 || l.height < 8 && i.offsetHeight < 8)
    return !1;
  const u = l.height > 0 ? l.height : i.offsetHeight, f = e.scrollTop + (l.top - c.top), d = Math.max(0, f + s * u - o);
  return n === "auto" ? Math.abs(e.scrollTop - d) >= 1 && (e.scrollTop = d) : e.scrollTo({ top: d, behavior: n }), !0;
}
function Il(e, t, n = "smooth", r) {
  return Nt(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function Jn(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const i = [], c = () => {
    var u;
    if (a) return;
    Nt(
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
function Tl(e, t, n) {
  return Jn(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function Tn(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function ze(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function kl(e, t, n = !0, r = "", o) {
  const [a, s] = _(1);
  return O(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const i = e.current;
    if (!i)
      return;
    let c = !1, l = null, u = 0;
    const f = wn(void 0, o), d = () => {
      if (c) return;
      const h = Array.from(i.querySelectorAll(f));
      if (!h.length)
        return;
      const y = Va(i), I = qa(h, y);
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
const El = `canvas, .react-pdf__Page, .${Da}, .${vn}`, no = /* @__PURE__ */ new WeakMap();
function Rl(e) {
  const t = Number(e.getAttribute(mr));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = no.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(El), no.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Pl(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Ml(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(pr()).forEach((r) => {
    const o = Sn(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = Rl(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function xl(e, t, n = "", r) {
  const [o, a] = _(() => /* @__PURE__ */ new Map()), s = A(o), i = A(r);
  return i.current = r, Ae(() => {
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
      const w = Ml(b);
      Pl(s.current, w) || (s.current = w, a(w)), u && !f && (f = !0, (v = i.current) == null || v.call(i));
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
const Nl = [0, 48, 140, 320, 560], _l = 700, Al = [80, 200, 400], Ll = 500, Cl = 50, Dl = /* @__PURE__ */ new Set([
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
]), $l = 180, ro = [0, 48, 140, 320, 700, 1200];
function Ol(e, t) {
  var T;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = A(
    ((T = Ue(a)) == null ? void 0 : T.anchor) || { page: 1, fraction: 0 }
  ), c = A(null), l = A(!1), u = A(r), f = A(null), d = A(null), m = A(null), g = A(null), h = A(a), y = A(""), I = A(n);
  I.current = n;
  const S = L(() => {
    var R;
    (R = f.current) == null || R.call(f), f.current = null, d.current != null && (clearTimeout(d.current), d.current = null);
  }, []), b = L(() => {
    !l.current && c.current == null || (S(), m.current != null && (clearTimeout(m.current), m.current = null), c.current = null, l.current = !1);
  }, [S]), w = L((R = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const D = () => {
      g.current = null, Pn(h.current, {
        anchor: ze(i.current)
      });
    };
    R ? D() : g.current = setTimeout(D, $l);
  }, []), v = L((R) => {
    i.current = ze(R), c.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, l.current = !1;
    }, Cl);
  }, []);
  O(() => {
    if (!o)
      return;
    let R = !1, D = null, z = null, K = null;
    const j = () => {
      if (R) return;
      const J = e.current;
      if (!J) {
        K = setTimeout(j, 50);
        return;
      }
      D = J, z = () => {
        if (l.current)
          return;
        const oe = Wt(D, I.current);
        oe && (i.current = oe, w());
      }, D.addEventListener("scroll", z, { passive: !0 }), l.current || z();
    };
    return j(), () => {
      R = !0, K != null && clearTimeout(K), D && z && D.removeEventListener("scroll", z);
    };
  }, [o, r, n, e, w]), O(() => {
    if (!o) return;
    const R = e.current;
    if (!R) return;
    const D = (z) => {
      z.metaKey || z.ctrlKey || z.altKey || Dl.has(z.key) && b();
    };
    return R.addEventListener("wheel", b, { passive: !0 }), R.addEventListener("touchmove", b, { passive: !0 }), window.addEventListener("keydown", D), () => {
      R.removeEventListener("wheel", b), R.removeEventListener("touchmove", b), window.removeEventListener("keydown", D);
    };
  }, [o, e, b]), Ae(() => {
    var D;
    if (h.current === a) return;
    w(!0), S(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, y.current = "";
    const R = (D = Ue(a)) == null ? void 0 : D.anchor;
    i.current = R ? ze(R) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, u.current = r;
  }, [a, r, w, S]), O(() => {
    var D;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const R = ze(
      ((D = Ue(a)) == null ? void 0 : D.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = R, c.current = R, l.current = !0, S(), f.current = Jn(
      () => e.current,
      R,
      {
        behavior: "auto",
        pane: I.current,
        delaysMs: ro,
        onDone: () => v(R)
      }
    ), d.current = setTimeout(() => {
      d.current = null, v(R);
    }, Math.max(...ro) + 160), () => S();
  }, [o, s, a, e, v, S]), O(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, c.current = null, S();
      return;
    }
    const R = c.current ? ze(c.current) : ze(i.current);
    return l.current = !0, c.current = R, i.current = R, S(), f.current = Jn(
      () => e.current,
      R,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Nl,
        onDone: () => v(R)
      }
    ), d.current = setTimeout(() => {
      d.current = null, v(R);
    }, _l), () => {
      S();
    };
  }, [r, o, n, e, v, S]), O(() => () => {
    S(), m.current != null && (clearTimeout(m.current), m.current = null), w(!0);
  }, [S, w]);
  const P = L(() => {
    const R = Wt(
      e.current,
      I.current
    );
    return ze(R || i.current);
  }, [e]), M = L(() => {
    l.current = !0;
    const R = Wt(
      e.current,
      I.current
    ), D = ze(R ?? i.current);
    return i.current = D, c.current = D, w(), D;
  }, [e, w]), E = L((R, D, z) => {
    const K = z || I.current, j = Tn(R, D || 1), J = { page: j, fraction: 0 };
    i.current = J, l.current = !0, c.current = J, w(), S(), Il(e.current, j, "smooth", K), f.current = Tl(
      () => e.current,
      j,
      {
        behavior: "auto",
        pane: K,
        delaysMs: Al,
        onDone: () => v(J)
      }
    ), d.current = setTimeout(() => {
      d.current = null, v(J);
    }, Ll);
  }, [e, v, S, w]), $ = L(() => ze(i.current), []), N = L(() => l.current, []), k = L(() => {
    if (!l.current || !c.current)
      return;
    const R = ze(c.current);
    Nt(
      e.current,
      R,
      "auto",
      I.current
    );
  }, [e]);
  return {
    lockFromShell: P,
    beginModeSwitch: M,
    goToPage: E,
    getAnchor: $,
    isRestoring: N,
    repinIfRestoring: k
  };
}
function zl(e, t) {
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
function Ja(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const Fl = [0, 80, 200, 400, 800], Bl = 120, Hl = 400;
function jl(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: c, documentId: l, regionsSettled: u = !0 } = e, f = A(a);
  f.current = a;
  const d = A(s);
  d.current = s;
  const m = A(i);
  m.current = i;
  const g = A(n);
  g.current = n, O(() => {
    var w, v;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = Yi(), y = zl(h, d.current);
    if (y == null && (h != null && h.blockId) && !u) return;
    const I = Ja(h, y, { jobId: c, documentId: l });
    if (t.current === I)
      return;
    if (y == null) {
      t.current = I, (w = g.current) == null || w.call(g);
      return;
    }
    t.current = I, h && ((v = m.current) == null || v.call(m, h, y));
    const S = [];
    let b = 0;
    for (const P of Fl)
      b = Math.max(b, P), S.push(
        setTimeout(() => {
          f.current(y);
        }, P)
      );
    return S.push(
      setTimeout(() => {
        var P;
        (P = g.current) == null || P.call(g);
      }, b + Bl)
    ), () => {
      for (const P of S) clearTimeout(P);
    };
  }, [r, o, c, l, t, u]);
}
function Ul(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function Wl(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = Hl,
    jobId: i,
    documentId: c,
    applyReaderSearch: l
  } = e, u = A(a);
  u.current = a;
  const f = A(l);
  f.current = l;
  const d = A(0);
  O(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || d.current === o) return;
    const m = setTimeout(() => {
      var I;
      const g = ((I = globalThis.location) == null ? void 0 : I.search) || "", h = si(g, o, u.current);
      if (d.current = o, h === null) return;
      const y = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = Ja(
        { blockId: y },
        o,
        { jobId: i, documentId: c }
      ), (f.current || Ul)(h);
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
function Kl(e) {
  const t = A(""), [n, r] = _(!1), o = L(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  jl(a, t, o), Wl(e, t, n);
}
const $t = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function Vl(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function oo(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function Ga(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = oo(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = oo(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function ql(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = Ga(r, t, n);
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
function Jl(e) {
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
function Gl(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function Xl(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function Yl(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function Zl(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const ao = [250, 500, 1e3, 2e3, 4e3], _n = [80, 160, 320, 640, 1e3, 1500], so = [250, 500, 1e3, 2e3, 4e3, 5e3];
function Gn(e, t) {
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
function br(e) {
  return mi(e) ? `${e.code || ""}`.trim() : "";
}
function an(e, t) {
  const n = br(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function Ql(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (Ga(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
        return c;
      a = hi(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (c) {
      if ((c == null ? void 0 : c.name) === "AbortError") throw c;
      a = c;
      const l = br(c);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw c;
    }
    const i = _n[Math.min(s, _n.length - 1)];
    if (await Gn(i, r), s >= _n.length + 2) throw a;
  }
}
function eu({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = _($t), s = A(o), i = A("");
  s.current = o;
  const c = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = qt(l) ? l : "";
  return O(() => {
    if (!n || !c) {
      i.current = "", s.current = $t, a($t);
      return;
    }
    const f = r === void 0 ? Xi() : r, d = i.current === c;
    if (i.current = c, !f) {
      const b = {
        ...d ? s.current : $t,
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
      ...d ? s.current : $t,
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
            layoutByPage: Vl(w),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (w) {
          if ((w == null ? void 0 : w.name) === "AbortError") return;
          const v = br(w);
          if (!(v === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !v)) {
            y((M) => ({
              ...M,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: an(w, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            y((M) => ({
              ...M,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          y((M) => ({
            ...M,
            connection: "connecting",
            jobStatus: l,
            error: an(w, "正在等待 OCR 版面数据")
          })), await Gn(ao[Math.min(b, ao.length - 1)], m.signal).catch(() => {
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
                v = await Ql(
                  c,
                  w,
                  s.current,
                  m.signal,
                  f
                );
              } catch (P) {
                if ((P == null ? void 0 : P.name) === "AbortError" || m.signal.aborted) throw P;
                y((M) => ({
                  ...M,
                  lastSeq: Math.max(M.lastSeq, w.seq),
                  error: an(P, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((P) => {
                const M = ql(P, w, v);
                return u ? {
                  ...M,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...M,
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
            error: an(w, "实时译文连接已中断，正在重连")
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
        await Gn(so[Math.min(b, so.length - 1)], m.signal).catch(() => {
        }), b += 1;
      }
    })(), () => m.abort();
  }, [n, r, c, u]), o;
}
function tu(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), c = Number(s.count) || 0;
    i && c > 0 && o.set(i, c);
  }
  return o;
}
function nu(e, t = !0) {
  const [n, r] = _(() => /* @__PURE__ */ new Map());
  return O(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = Ye().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(tu(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const ru = 4500;
function ou(e) {
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
const au = /* @__PURE__ */ new Set(["book", "translate"]);
function Xa(e) {
  return !!(e.jobId && e.sourceUrl && au.has(e.workflow));
}
function su(e) {
  return !!(Xa(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function iu() {
  const e = Ac(), t = Xa({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = su({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = A({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !qt(o) && (r.current.running = !0);
  const a = eu({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = $c(), u = nu(e.jobId, !e.sourceOnly), f = Zc({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: g } = rl(e.mode, s, f);
  wl(i, m, g);
  const h = zc(
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
  } = Ol(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: h.primaryNumPages > 0
  });
  O(() => {
    S();
  }, [c, S]);
  const b = xl(
    s,
    h.compareMode,
    h.rowSyncRevision,
    S
  ), w = kl(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${m}-${h.metricsTick}`,
    h.primaryPane
  ), v = L((j, J) => {
    var q, se;
    const oe = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((q = h.numPagesByPane) == null ? void 0 : q.source) || 0,
      Number((se = h.numPagesByPane) == null ? void 0 : se.translated) || 0
    );
    I(j, oe, J);
  }, [I, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [P, M] = _(null), E = A(null), $ = L((j) => {
    E.current && clearTimeout(E.current), M(j), j && (E.current = setTimeout(() => M(null), ru));
  }, []);
  O(() => () => {
    E.current && clearTimeout(E.current);
  }, []);
  const N = L((j) => {
    const J = xn(e.regions, j);
    return J ? qr(J, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), k = L((j, J) => {
    const oe = J || h.primaryPane, q = typeof j == "object" && j ? `${j.block_id || ""}`.trim() : "", se = typeof j == "object" && j ? `${j.image_url || ""}`.trim() : "", ke = typeof j == "object" && j ? j.page_idx != null ? Number(j.page_idx) + 1 : j.page != null ? Number(j.page) : null : typeof j == "number" ? j + 1 : null, re = ci(e.regions, se, ke) || xn(e.regions, q) || (typeof j == "object" ? li(e.regions, j) : null);
    let ue = re ? qr(re, oe).page : null;
    ue == null && (ue = ou(j)), !(ue == null || ue < 1) && ($(re), v(ue, oe));
  }, [$, v, h.primaryPane, e.regions]);
  Kl({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: w,
    goToPage: v,
    resolveBlockPage: N,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (j) => {
      $(xn(e.regions, j.blockId));
    }
  });
  const { setModeKeepingPage: T } = Sl({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: y
  });
  O(() => {
    $(null);
  }, [d, $]);
  const R = !e.boot.loading && !e.boot.failed, D = U(() => ({ bindShell: l, shellEl: i, shellWidth: c, shellRef: s }), [l, i, c, s]), z = U(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), K = U(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: m,
    onZoomChange: g,
    shell: D,
    panes: h,
    sessionFiles: z,
    rowHeights: b,
    goToPage: v,
    activeRegion: P,
    jumpToAnchor: k,
    setModeKeepingPage: T,
    download: e.download,
    showHud: R,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, D, h, z, b, v, P, k, T, R, m, g, f, a, n, u]);
  return U(() => ({
    ...K,
    currentPage: w
  }), [K, w]);
}
const cu = [
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
], lu = [
  {
    title: "翻页",
    items: [
      { actions: ["next-page"], keys: "J · ↓ · PgDn", desc: "下一页" },
      { actions: ["prev-page"], keys: "K · ↑ · PgUp", desc: "上一页" },
      { actions: ["first-page", "last-page"], keys: "Home / End", desc: "首页 / 末页" },
      { actions: [], keys: "点底下的页码", desc: "输入页码跳转" }
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
      { actions: [], keys: "N / Shift+N", desc: "跳到下一处 / 上一处要看一眼的段落（左栏「待改」）" }
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
function uu(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of cu)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function du(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const fu = ".reader-notes-panel";
function mu(e) {
  return e instanceof Element ? !!e.closest(fu) : !1;
}
function hu(e) {
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
  O(() => {
    if (!u)
      return;
    const f = (d) => {
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || du(d.target) || mu(d.target))
        return;
      const m = d.key, g = uu(m);
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
              a(Gt(o, 1));
              return;
            case "zoom-out":
              a(Gt(o, -1));
              return;
            case "zoom-reset":
              a(kt(t, Rt()));
              return;
            case "next-page":
              c(Tn(s + 1, i));
              return;
            case "prev-page":
              c(Tn(s - 1, i));
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
const Re = { size: 16, strokeWidth: 1.75 }, io = { size: 12, strokeWidth: 1.75 }, pu = "retainpdf:soft-reader-close";
function gu() {
  return new URL("./index.html", window.location.href).href;
}
function bu() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: pu },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function yu(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function vu() {
  if (!(typeof window > "u") && !bu()) {
    if (yu(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(gu());
  }
}
function wu({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function Su({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ C(wu, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), vu();
  }, children: [
    /* @__PURE__ */ p(ba, { className: "reader-close-home-icon", ...Re, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "返回" })
  ] });
}
const Iu = 3e3, Tu = 8;
async function ku(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function Eu(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function Ru(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = Iu;
  const r = [], o = (s, i, c) => {
    const l = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const f = s[u], d = Eu(f == null ? void 0 : f.title);
      if (!d) continue;
      n -= 1;
      const m = c ? `${c}.${u}` : `${u}`, g = { id: m, title: d, page: null, level: i, children: [] };
      r.push({ node: g, dest: f.dest }), l.push(g), i < Tu && Array.isArray(f.items) && f.items.length && (g.children = o(f.items, i + 1, m));
    }
    return l;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await ku(e, i);
  })), a;
}
function Ya(e) {
  const t = [], n = (r) => {
    for (const o of r)
      t.push(o), n(o.children);
  };
  return n(e), t;
}
function Pu(e, t) {
  let n = null;
  for (const r of Ya(e))
    r.page === null || r.page > t || (!n || r.page > (n.page ?? 0) || r.page === n.page && r.id.startsWith(`${n.id}.`)) && (n = r);
  return (n == null ? void 0 : n.id) ?? null;
}
let co = !1;
function Mu() {
  if (co)
    return;
  const e = Jt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (xa.GlobalWorkerOptions.workerSrc = e, co = !0);
}
const at = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), xu = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Nu = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, _u = {
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
}, lo = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function Au(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => lo(o ?? a ?? "", xu)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => lo(o ?? a ?? "", Nu)).replace(/\\([a-zA-Z]+)/gu, (r, o) => _u[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Lu(e) {
  return at(e.translatedBlockText) || at(e.translated.text) || at(e.source.text);
}
const Cu = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Du(e) {
  const t = [];
  for (const n of e) {
    if (!Cu(n)) continue;
    const r = Au(Lu(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
const $u = 24, Ou = 60;
function uo(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - $u), o = Math.min(e.length, n + t.length + Ou), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function zu(e, t, n = 200) {
  const r = at(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = at(a.translatedBlockText) || at(a.translated.text), c = i ? uo(i, r) : null, l = c ?? uo(at(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: c ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
function sn(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function Bt(e, t) {
  const n = at(t).toLowerCase();
  if (!n || !e) return sn(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${sn(e.slice(a, s))}<mark class="reader-find-mark">${sn(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + sn(e.slice(a));
}
function Fu(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const Bu = /^data-[a-z0-9-]+$/;
function fo(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function Hu(e, t, n = "") {
  if (!t.length) return Bt(e, n);
  const r = t.filter((s) => s.end > s.start && s.start >= 0 && s.end <= e.length).map((s, i) => ({ mark: s, order: i })).sort((s, i) => s.mark.start - i.mark.start || s.order - i.order).map(({ mark: s }) => s);
  let o = "", a = 0;
  for (const s of r) {
    if (s.start < a) continue;
    o += Bt(e.slice(a, s.start), n);
    const i = Object.entries(s.attrs ?? {}).filter(([c]) => Bu.test(c)).map(([c, l]) => ` ${c}="${fo(l)}"`).join("");
    o += `<mark class="${fo(s.className)}"${i}>${Bt(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  }
  return o + Bt(e.slice(a), n);
}
function ve(e) {
  return typeof e == "string" ? e : "";
}
function ju(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function Uu(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function Wu(e) {
  return {
    source: ve(e == null ? void 0 : e.source_text) || ve(e == null ? void 0 : e.unit_source_text),
    translated: ve(e == null ? void 0 : e.protected_translated_text) || ve(e == null ? void 0 : e.translated_text)
  };
}
const Ku = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function Za(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function Vu(e) {
  const t = Za(e).sort((r, o) => ve(r.ts).localeCompare(ve(o.ts)));
  return t.length ? [
    { text: ve(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: ve(r.new_text),
      label: Ku[ve(r.source)] || ve(r.source) || "修订",
      ts: ve(r.ts),
      reason: ve(r.reason)
    }))
  ].reverse() : [];
}
function qu(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Ju(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return ve(r.finished_at) || ve(n.finished_at) || "";
}
function Gu(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = Za(e).sort((a, s) => ve(a.ts).localeCompare(ve(s.ts)));
  for (const a of o) {
    const s = new Date(ve(a.ts)).getTime(), i = ve(a.reader_item_id) || ve(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, ve(a.new_text));
  }
  return n;
}
const Xu = {
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
function Yu(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = Xu[ve(n.kind)] || ve(n.kind) || "问题", o = ve(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const Zu = /* @__PURE__ */ new Set(["text", "formula"]);
function yr(e) {
  return Zu.has(e);
}
function Qa(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || yr(Le(n));
}
function Qu(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !yr(Le(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const ed = 300, td = 72;
function nd(e, t) {
  if (e.width >= ed && e.height >= td)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const rd = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function od(e, t, n) {
  return e.flatMap((r) => {
    if (!rd.has(Le(r.region))) return [];
    const o = ct(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function mo(e, t, n) {
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
async function ad(e) {
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
const sd = "reader-text-hover-copy", id = "reader-text-hover-edit", cd = "reader-text-hover-zoom", ld = "reader-text-hover-id";
function ud(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const es = "reader-text-hover-tools";
function cn({
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
const dd = 26, fd = 220;
function md(e, t = fd) {
  return e.height < dd * 2 || e.width < t;
}
function hd({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? dr : e === "failed" ? bt : ya, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function pd({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  onZoom: o,
  frameRect: a,
  placement: s,
  tailTop: i = 0
}) {
  const [c, l] = _("idle"), [u, f] = _("idle"), [d] = _(() => ud()), m = A([]), g = (e == null ? void 0 : e.itemId) || "";
  if (O(() => {
    l("idle"), f("idle");
    const v = m.current;
    return () => {
      v.forEach((P) => window.clearTimeout(P)), m.current = [];
    };
  }, [g]), !e) return null;
  const h = ui(e.highlight.region, t), y = Le(e.highlight.region), I = (v, P) => async (M) => {
    M.preventDefault(), M.stopPropagation();
    const E = await ad(v);
    P(E ? "copied" : "failed"), m.current.push(window.setTimeout(() => P("idle"), 1200));
  }, S = y === "formula" ? "复制 LaTeX" : "复制", b = a || e.rect, w = s || (md(b) ? "outside" : "inside");
  return /* @__PURE__ */ p("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ p(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": y,
      style: b,
      children: /* @__PURE__ */ C(
        "div",
        {
          className: es,
          "data-placement": w,
          style: w === "tail" ? { top: i } : void 0,
          children: [
            d ? /* @__PURE__ */ p(
              cn,
              {
                className: ld,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: I(e.itemId, f),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && yr(y) ? /* @__PURE__ */ p(
              cn,
              {
                className: id,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (v) => {
                  v.preventDefault(), v.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ p(gn, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            h ? /* @__PURE__ */ p(
              cn,
              {
                className: sd,
                state: c,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: c === "copied" ? "已复制" : c === "failed" ? "复制失败" : S,
                onClick: I(h, l),
                children: /* @__PURE__ */ p(hd, { state: c })
              }
            ) : null,
            o ? /* @__PURE__ */ p(
              cn,
              {
                className: cd,
                state: "idle",
                label: "放大看这一块",
                title: y === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (v) => {
                  v.preventDefault(), v.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ p(gi, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function gd(e, t) {
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
function bd(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = ct(
      gd(e, a),
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
const yd = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', vd = 256, Ot = /* @__PURE__ */ new Map();
function wd(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function ts(e) {
  const t = `${e || ""}`, { text: n, slots: r } = Bi(t, { bareLatex: !0 }), o = wd(n), a = Hi(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = Ot.get(t);
  if (!s && (s = ji(o, r), Ot.set(t, s), Ot.size > vd)) {
    const i = Ot.keys().next().value;
    i !== void 0 && Ot.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function An(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function qe(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Sd(e, t) {
  const n = e.typography, r = qe(t) || 1, o = qe(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = An(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(s, i * r)), l = qe(n == null ? void 0 : n.fit_min_font_size_pt), u = qe(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (l || 5.5) * r), d = Math.max(
    f,
    u ? u * r : o ? o * r : c
  ), m = o ? o * r : c, g = qe(n == null ? void 0 : n.leading_em), h = [
    qe(n == null ? void 0 : n.padding_top_pt) || 0,
    qe(n == null ? void 0 : n.padding_right_pt) || 0,
    qe(n == null ? void 0 : n.padding_bottom_pt) || 0,
    qe(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((y) => y * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || yd,
    fontSizePx: Math.max(f, Math.min(d, m)),
    minFontSizePx: f,
    maxFontSizePx: d,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (An(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : An(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function Id(e, t, n, r) {
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
const Td = 512, zt = /* @__PURE__ */ new Map();
let Xn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Xn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Xn += 1;
}));
function kd(e, t, n, r) {
  return [
    Xn,
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
function vr({ item: e, pageScale: t }) {
  const n = A(null), r = U(
    () => ts(e.translatedText),
    [e.translatedText]
  ), [o, a] = _(r.fallbackHtml), s = U(
    () => Sd(e, t),
    [e, t]
  );
  O(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((d) => {
      f && a(d);
    }), () => {
      f = !1;
    };
  }, [r]), Ae(() => {
    const f = n.current;
    if (!f) return;
    const [d, m, g, h] = s.padding, y = Math.max(1, e.rect.width - h - m), I = Math.max(1, e.rect.height - d - g), S = kd(o, y, I, s);
    let b = zt.get(S);
    if (b === void 0 && (b = Id(
      (w) => (f.style.fontSize = `${w}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      y,
      I,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), zt.set(S, b), zt.size > Td)) {
      const w = zt.keys().next().value;
      w !== void 0 && zt.delete(w);
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
function Ed({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = U(
    () => bd(e, t, n, r),
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
        vr,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Rd = Qt(Ed);
function Pd({
  targets: e,
  edits: t,
  width: n,
  excludeId: r
}) {
  const o = e.filter((a) => t.has(a.itemId) && a.itemId !== r);
  return o.length ? /* @__PURE__ */ p("div", { className: "reader-live-translation-overlay reader-edited-overlay", "aria-hidden": "true", children: o.map((a) => {
    const s = a.highlight.pageSize.width;
    return /* @__PURE__ */ C("div", { className: "reader-edited-block", "data-reader-edited-id": a.itemId, children: [
      /* @__PURE__ */ p(
        vr,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: Le(a.highlight.region),
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
const Md = Qt(Pd), ns = 24, rt = ns * 2 + 4, Je = 24, xd = 4, Nd = 6, mt = (e) => e.left + e.width, it = (e) => e.top + e.height;
function Ht(e, t) {
  const n = Math.min(mt(e), mt(t)) - Math.max(e.left, t.left), r = Math.min(it(e), it(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const ho = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= mt(t) && r >= t.top && r <= it(t);
}, _d = (e) => e.height > 40 && e.height > e.width * 2.5;
function Ad(e, t, n) {
  if (!t.length || e.height < Je || e.width < n + 8) return null;
  const r = Math.max(...t.map(it)), o = mt(e) - 4 - n;
  for (const a of [r, it(e) - 2]) {
    const s = Math.max(e.top, a - Je), i = { left: o, top: s, width: n, height: Je };
    if (!t.some((c) => Ht(i, c) > 0)) return s - e.top;
  }
  return null;
}
function Ld(e, t) {
  const n = [], r = (a) => {
    const s = ns + xd, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: mt(e), top: i, width: s, height: rt } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: rt } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - Je - 3, width: rt, height: Je + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: it(e), width: rt, height: Je + 3 } }), r(!0);
  const o = Ad(e, t, rt);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: mt(e) - 4 - rt, top: e.top + o, width: rt, height: Je } }), n;
}
function Cd(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((S) => S.width > 0 && S.height > 0 && !_d(S)), i = s.filter((S) => ho(S, t)), c = s.filter((S) => !ho(S, t)), l = n.filter((S) => S !== t && Ht(S, t) < t.width * t.height * 0.5), u = Ld(t, i).filter(({ box: S, overhang: b }) => {
    const w = b ? Nd : 0;
    return S.left >= -w && mt(S) <= r + w && S.top >= 0 && it(S) <= o;
  }), f = ({ placement: S, tailTop: b }) => b === void 0 ? { placement: S } : { placement: S, tailTop: b }, d = ({ box: S }) => !c.some((b) => Ht(S, b) > 0), m = u.filter((S) => S.placement !== "tail"), g = m.find((S) => d(S) && !l.some((b) => Ht(S.box, b) > 0));
  if (g) return f(g);
  const h = m.find(d) || u.find((S) => S.placement === "tail" && d(S));
  if (h) return f(h);
  let y = null, I = Number.POSITIVE_INFINITY;
  for (const S of u) {
    const b = c.reduce((w, v) => w + Ht(S.box, v), 0);
    b < I && (y = S, I = b);
  }
  return y ? f(y) : { placement: "outside" };
}
function Dd(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - Je - 3 : it(r);
  return t >= r.left - 4 && t <= r.left + rt + 4 && n >= a && n <= a + Je + 3;
}
const Ln = (e) => e.left + e.width, Cn = (e) => e.top + e.height;
function $d(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const l of t) {
    if (l.width <= 0 || l.height <= 0) continue;
    const u = l.left + l.width / 2, f = l.top + l.height / 2;
    u < e.left || u > Ln(e) || f < e.top || f > Cn(e) || (o = Math.min(o, l.left), a = Math.min(a, l.top), s = Math.max(s, Ln(l)), i = Math.max(i, Cn(l)));
  }
  if (!Number.isFinite(o)) return e;
  const c = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return c.width = Math.min(Ln(e) + r, s + n) - c.left, c.height = Math.min(Cn(e) + r, i + n) - c.top, c.width * c.height < e.width * e.height * 0.3 && c.height < 24 ? e : c;
}
function Od(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function zd(e, t, n, r) {
  const [o, a] = _(null);
  return Ae(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? Od(s) : [], c = Le(t.highlight.region) === "figure", l = i.length && !c ? $d(t.rect, i) : t.rect, u = n.filter((d) => d.itemId !== t.itemId).map((d) => d.rect), f = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...Cd({ frame: l, others: u, pageWidth: r, pageHeight: f, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
function Fd({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = _(null), [i, c] = _(!1), [l, u] = _([]), [f, d] = _(""), [m, g] = _(""), [h, y] = _(!1), [I, S] = _(null), [b, w] = _([]), v = r.drafts, P = r.generation, M = L(async (k, T) => {
    if (e)
      try {
        u(Vu(await e.fetchRevisions(k, T)));
      } catch {
        u([]);
      }
  }, [e]);
  O(() => {
    if (s(null), u([]), S(null), w([]), g(""), !e || !t || !n) return;
    let k = !1;
    return c(!0), e.loadItem(t, n).then((T) => {
      if (k) return;
      const R = T == null ? void 0 : T.item;
      if (!R) throw new Error("找不到这一段的译文。");
      const D = `${(T == null ? void 0 : T.item_id) || n}`, { source: z, translated: K } = Wu(R);
      s({ readerItemId: n, itemId: D, source: z, current: K }), d(v.get(n) ?? K);
    }).catch((T) => {
      k || S({ tone: "error", message: (T == null ? void 0 : T.message) || "读取这段译文失败。" });
    }).finally(() => {
      k || c(!1);
    }), M(t, n), () => {
      k = !0;
    };
  }, [e, t, n, M]);
  const E = L((k) => {
    d(k), n && v.set(n, k);
  }, [n, v]), $ = L(async (k, T) => {
    if (!e || !a || h) return !1;
    const R = k ?? f;
    if (!R.trim()) return !1;
    y(!0), S(null), w([]);
    try {
      const D = await e.revise(t, a.itemId, {
        translated_text: R,
        source: "user",
        reason: (T ?? m).trim() || "在阅读页手动修改",
        ...P.current != null ? { expected_generation: P.current } : {}
      }), z = Number(D == null ? void 0 : D.generation);
      return Number.isFinite(z) && (P.current = z), v.delete(a.readerItemId), s({ ...a, current: R }), d(R), g(""), (D == null ? void 0 : D.changed) === !1 ? S({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, R), S({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), M(t, a.readerItemId), !0;
    } catch (D) {
      const z = D;
      return (z == null ? void 0 : z.reason) === "generation_mismatch" && (P.current = null), S({ tone: "error", message: (z == null ? void 0 : z.message) || "保存失败，请稍后再试。" }), w(Yu(z == null ? void 0 : z.issues)), !1;
    } finally {
      y(!1);
    }
  }, [e, a, h, f, m, t, o, M, v, P]), N = L(() => {
    n && v.delete(n);
  }, [n, v]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: l,
    draft: f,
    setDraft: E,
    reason: m,
    setReason: g,
    saving: h,
    status: I,
    issues: b,
    save: $,
    discardDraft: N
  };
}
const rs = "reader-inline-edit";
function Bd({ text: e }) {
  const [t, n] = _("");
  return O(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = ts(e);
      n(a.fallbackHtml), a.richHtml.then((s) => {
        r && n(s);
      });
    }, 250);
    return () => {
      r = !1, window.clearTimeout(o);
    };
  }, [e]), t ? /* @__PURE__ */ C("div", { className: "reader-inline-edit-preview", "data-inline-edit-preview": "true", children: [
    /* @__PURE__ */ p("span", { className: "reader-inline-edit-preview-label", children: "预览" }),
    /* @__PURE__ */ p("div", { className: "reader-live-translation-content", dangerouslySetInnerHTML: { __html: t } })
  ] }) : null;
}
function Hd({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var N;
  const s = e.itemId, i = Fd({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = _(!1), [u, f] = _(!1), d = A(null), m = nd(e.rect, t), g = U(() => Qu(o), [o]), h = g.indexOf(s), { loaded: y } = i, I = i.saving || i.loading, S = n.blockedReason, b = !y || i.draft === y.current, { close: w, select: v } = n, P = L((k) => {
    const T = g[h + k];
    T && (v(T), a == null || a(T));
  }, [g, h, v, a]), M = L(() => {
    i.discardDraft(), w();
  }, [i, w]), E = L(async (k, T) => {
    await i.save(k, T) && w();
  }, [i, w]);
  O(() => {
    const k = (T) => {
      !T.altKey || T.key !== "ArrowUp" && T.key !== "ArrowDown" || (T.preventDefault(), P(T.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", k), () => window.removeEventListener("keydown", k);
  }, [P]), Ae(() => {
    const k = d.current;
    if (!k) return;
    k.style.height = "auto";
    const T = m.mode === "inline" ? m.minHeight : 0;
    k.style.height = `${Math.max(T, k.scrollHeight + 2)}px`;
  }, [i.draft, y, m.mode, m.mode === "inline" ? m.minHeight : 0]);
  const $ = m.mode === "inline" ? { left: m.left, top: m.top, width: m.width } : { left: m.left, width: m.width, top: m.top, bottom: m.bottom };
  return /* @__PURE__ */ C(_e, { children: [
    m.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ C(
      "div",
      {
        className: `${rs} is-${m.mode}`,
        style: $,
        role: "group",
        "aria-label": `改第 ${((N = n.target) == null ? void 0 : N.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": m.mode,
        onPointerDown: (k) => k.stopPropagation(),
        children: [
          r && (y != null && y.source) ? /* @__PURE__ */ p(
            X,
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
            Fi,
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
                k.key === "Enter" && (k.metaKey || k.ctrlKey) ? (k.preventDefault(), b || E()) : k.key === "Escape" && (k.preventDefault(), M());
              }
            }
          ) : null,
          y ? /* @__PURE__ */ p(Bd, { text: i.draft }) : null,
          /* @__PURE__ */ C("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(ut, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => P(-1), children: /* @__PURE__ */ p(bi, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(ut, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= g.length - 1, onClick: () => P(1), children: /* @__PURE__ */ p(bn, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              fr,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: I || !!S || !y,
                onChange: (k) => i.setReason(k.target.value),
                onKeyDown: (k) => {
                  k.key === "Enter" ? (k.preventDefault(), b || E()) : k.key === "Escape" && (k.preventDefault(), M());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ C(
              X,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": u,
                "data-block-edit-action": "history",
                onClick: () => f((k) => !k),
                children: [
                  /* @__PURE__ */ p(yi, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ p(X, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: M, children: "取消" }),
            /* @__PURE__ */ p(
              X,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: I || !!S || b || !i.draft.trim(),
                pending: i.saving,
                onClick: () => {
                  E();
                },
                children: "保存"
              }
            )
          ] }),
          i.status ? /* @__PURE__ */ p("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ p("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((k) => /* @__PURE__ */ p("li", { children: k }, k)) }) : null,
          u && y && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((k, T) => {
            const R = k.text === y.current, D = [qu(k.ts), k.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ C("li", { "data-block-edit-history": k.label, "data-current": R ? "true" : void 0, children: [
              /* @__PURE__ */ C("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ C("span", { children: [
                  D,
                  R ? "（现在用的）" : "",
                  k.reason ? ` · ${k.reason}` : ""
                ] }),
                R ? null : /* @__PURE__ */ p(
                  X,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: I || !!S,
                    onClick: () => {
                      E(k.text, `回到「${D.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ p("p", { className: "reader-inline-edit-history-text", children: k.text })
            ] }, `${k.ts}:${T}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const os = en(null), as = en(null);
function jd({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(os.Provider, { value: e, children: /* @__PURE__ */ p(as.Provider, { value: t, children: n }) });
}
function Fe() {
  return dt(os);
}
function wr() {
  return dt(as);
}
const ss = 1.414;
function Ud({
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
  var Z, fe;
  const b = Fe(), w = b == null ? void 0 : b.revisedBlocks, v = b == null ? void 0 : b.blockEdit, P = v == null ? void 0 : v.pendingEdits, M = b == null ? void 0 : b.editBlock, E = (b == null ? void 0 : b.findTerm) || "", $ = r === "translated" ? "translated" : b != null && b.compareVersion ? "compare" : "source", N = b == null ? void 0 : b.textMarks, k = U(
    () => N ? ({ str: x }) => Hu(x, N(x), E) : E ? ({ str: x }) => Bt(x, E) : void 0,
    [E, N]
  ), T = A(c ?? ss), [R, D] = _(T.current);
  O(() => {
    c != null && Math.abs(c - T.current) >= 1e-3 && (T.current = c, D(c));
  }, [c]);
  const z = A(u);
  z.current = u;
  const K = A(null), j = A((x) => {
    var H;
    K.current = x, (H = z.current) == null || H.call(z, x);
  }).current, J = A(null), oe = A(`${t}@${n}`);
  Ae(() => {
    const x = `${t}@${n}`;
    oe.current !== x && (oe.current = x, o && Kd(K.current, J.current));
  }, [o, n, t]), O(() => {
    o || Dn(J.current);
  }, [o]), O(() => () => Dn(J.current), []);
  const q = Math.max(120, Math.floor(t * R)), se = Math.max(q, Math.ceil(s || 0)), ke = ct(f, t, q), re = U(
    () => od(d, t, q),
    [q, d, t]
  ), [ue, Pe] = _(null), ie = typeof g == "function", le = ie ? m ?? null : ue, B = (x) => {
    ie ? x !== (m ?? null) && (g == null || g(x)) : Pe((H) => H === x ? H : x);
  }, W = U(
    () => re.find((x) => x.itemId === le) || null,
    [le, re]
  ), Y = r === "translated" && ((Z = v == null ? void 0 : v.target) == null ? void 0 : Z.itemId) || "", de = U(
    () => Y && re.find((x) => x.itemId === Y) || null,
    [Y, re]
  ), ne = zd(K, o ? W : null, re, t), ae = (x) => {
    var Ie, xe, Oe, Be;
    if (x.pointerType === "touch") return;
    if (b != null && b.pointerTaken) {
      B(null);
      return;
    }
    if (x.buttons !== 0) {
      B(null);
      return;
    }
    if ((xe = (Ie = x.target) == null ? void 0 : Ie.closest) != null && xe.call(Ie, `.${es}`) || (Be = (Oe = x.target) == null ? void 0 : Oe.closest) != null && Be.call(Oe, `.${rs}`)) return;
    const H = x.currentTarget.getBoundingClientRect(), V = x.clientX - H.left, me = x.clientY - H.top;
    if (Dd(ne, V, me)) return;
    const be = mo(re, V, me);
    B((be == null ? void 0 : be.itemId) || null);
  }, Se = (x) => {
    if (x.pointerType === "mouse") return;
    const H = x.currentTarget.getBoundingClientRect(), V = mo(
      re,
      x.clientX - H.left,
      x.clientY - H.top
    );
    B((V == null ? void 0 : V.itemId) || null);
  }, ee = (x) => {
    !Number.isFinite(x) || x <= 0 || Math.abs(T.current - x) < 1e-3 || (T.current = x, D(x), l == null || l(e, x));
  };
  return /* @__PURE__ */ C(
    "div",
    {
      ref: j,
      [Te]: e,
      [we]: r,
      [mr]: q,
      className: hr,
      onPointerMoveCapture: ae,
      onPointerDown: Se,
      onDoubleClick: (x) => {
        const H = b == null ? void 0 : b.zoomBlock;
        !H || b != null && b.pointerTaken || !W || Le(W.highlight.region) === "figure" && (x.preventDefault(), H(W.itemId));
      },
      onPointerLeave: (x) => {
        x.pointerType === "mouse" && B(null);
      },
      style: {
        width: t,
        height: se,
        minHeight: se
      },
      children: [
        o ? /* @__PURE__ */ p(
          Wi,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: k,
            renderAnnotationLayer: !1,
            className: Da,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: vn,
                style: { width: t, height: q }
              }
            ),
            onLoadSuccess: (x) => {
              try {
                const H = x.getViewport({ scale: 1 });
                if (H.width > 0) {
                  const V = H.height / H.width;
                  ee(V);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              Dn(J.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ p(
          "div",
          {
            className: vn,
            style: { width: t, height: q },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: J, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        ke ? /* @__PURE__ */ p(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: ke,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && I ? /* @__PURE__ */ p(
          Rd,
          {
            layoutPage: h,
            pageState: y,
            width: t,
            height: q
          }
        ) : null,
        o && I && S ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (P != null && P.size) ? /* @__PURE__ */ p(Md, { targets: re, edits: P, width: t, excludeId: de == null ? void 0 : de.itemId }) : null,
        o && de && v ? /* @__PURE__ */ p(
          Hd,
          {
            target: de,
            page: { width: t, height: q },
            edit: v,
            showSource: !!(b != null && b.editShowsSource),
            regions: b == null ? void 0 : b.regions,
            jumpToBlock: b == null ? void 0 : b.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (w != null && w.size) ? /* @__PURE__ */ p("div", { className: "reader-revised-markers", "aria-hidden": "true", children: re.filter((x) => w.has(x.itemId)).map((x) => /* @__PURE__ */ p(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": x.itemId,
            style: { left: x.rect.left, top: x.rect.top, height: x.rect.height }
          },
          x.itemId
        )) }) : null,
        (fe = b == null ? void 0 : b.pageLayers) == null ? void 0 : fe.map((x) => /* @__PURE__ */ p(En, { children: x.render({ page: e, width: t, height: q, pane: $, active: o }) }, x.id)),
        /* @__PURE__ */ p(
          pd,
          {
            target: o && !(b != null && b.pointerTaken) && (W == null ? void 0 : W.itemId) !== (de == null ? void 0 : de.itemId) ? W : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: W && (w == null ? void 0 : w.get(W.itemId)) || 0,
            onEdit: M,
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
const Wd = Qt(Ud);
function Kd(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function Dn(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const Vd = 2 * 1024 * 1024;
function qd(e) {
  const t = new xa.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const $n = 5, Jd = "120% 0px", Gd = 120, Xd = "25% 0px";
let po = 1;
const go = /* @__PURE__ */ new WeakMap();
function Yd(e) {
  if (!e) return 0;
  const t = go.get(e);
  if (t) return t;
  const n = po;
  return po += 1, go.set(e, n), n;
}
function Zd() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Qd = Qs(
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
    showLiveTranslation: P = t === "source",
    liveTranslationPendingLabel: M = "",
    paneAction: E
  }, $) {
    Mu();
    const { file: N, loading: k, error: T } = Rc(n, r), R = `${n}\0${Yd(N)}`, D = A(R);
    D.current = R;
    const z = U(() => {
      const F = wc(N);
      return F ? "ranged" in F ? { range: qd(F.ranged) } : F : null;
    }, [N, n]), [K, j] = _(0), [J, oe] = _(""), [q, se] = _(null), [ke, re] = _(480), ue = A(null), Pe = A(0), ie = U(() => Zd(), []), le = U(() => ({
      cMapUrl: Jt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: Jt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: Vd,
      disableAutoFetch: !0
    }), []);
    ur($, () => q, [q]), O(() => {
      const F = (G) => {
        Pe.current = G, re(G);
      }, Q = (G) => {
        const pe = qc(G, Pe.current);
        if (pe !== "ignore") {
          if (ue.current && clearTimeout(ue.current), pe === "immediate") {
            F(G);
            return;
          }
          ue.current = setTimeout(() => F(G), Ba);
        }
      }, te = !!(c && c >= 80);
      Q(te ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const ge = !te && i && typeof ResizeObserver < "u" ? new ResizeObserver((G) => {
        var pe, Ee;
        Q(((Ee = (pe = G[0]) == null ? void 0 : pe.contentRect) == null ? void 0 : Ee.width) ?? i.clientWidth);
      }) : null;
      return ge && i && ge.observe(i), () => {
        ge == null || ge.disconnect(), ue.current && clearTimeout(ue.current);
      };
    }, [c, i, a]);
    const B = U(
      () => Wc(ke, o),
      [ke, o]
    ), [W, Y] = _(() => /* @__PURE__ */ new Map()), [de, ne] = _(() => /* @__PURE__ */ new Set()), [ae, Se] = _(() => /* @__PURE__ */ new Set()), ee = A(/* @__PURE__ */ new Map()), Z = A(null), fe = A(null), [x, H] = _(() => /* @__PURE__ */ new Set()), V = A(/* @__PURE__ */ new Map()), me = L((F, Q) => {
      Y((te) => {
        if (te.get(F) === Q) return te;
        const ce = new Map(te);
        return ce.set(F, Q), ce;
      });
    }, []), be = L((F, Q) => {
      const te = ee.current, ce = te.get(F), ge = [Z.current, fe.current];
      if (ce)
        for (const G of ge)
          try {
            G == null || G.unobserve(ce);
          } catch {
          }
      if (Q) {
        te.set(F, Q);
        for (const G of ge)
          try {
            G == null || G.observe(Q);
          } catch {
          }
      } else
        te.delete(F);
    }, []), Ie = A(/* @__PURE__ */ new Map()), xe = L((F) => {
      const Q = Ie.current;
      let te = Q.get(F);
      return te || (te = (ce) => be(F, ce), Q.set(F, te)), te;
    }, [be]);
    O(() => {
      if (typeof IntersectionObserver > "u") return;
      const F = V.current, Q = new IntersectionObserver(
        (te) => {
          const ce = [], ge = [];
          for (const G of te) {
            const pe = G.target, Ee = Sn(pe);
            Number.isFinite(Ee) && (G.isIntersecting ? ce : ge).push(Ee);
          }
          if ((ce.length || ge.length) && ne((G) => {
            let pe = null;
            for (const Ee of ce)
              G.has(Ee) || (pe = pe || new Set(G), pe.add(Ee));
            for (const Ee of ge)
              G.has(Ee) && (pe = pe || new Set(G), pe.delete(Ee));
            return pe || G;
          }), ce.length) {
            for (const G of ce) {
              const pe = F.get(G);
              pe && (clearTimeout(pe), F.delete(G));
            }
            Se((G) => {
              let pe = null;
              for (const Ee of ce)
                G.has(Ee) || (pe = pe || new Set(G), pe.add(Ee));
              return pe || G;
            });
          }
          for (const G of ge)
            F.has(G) || F.set(G, setTimeout(() => {
              F.delete(G), Se((pe) => {
                if (!pe.has(G)) return pe;
                const Ee = new Set(pe);
                return Ee.delete(G), Ee;
              });
            }, Gd));
        },
        { root: i, rootMargin: Jd, threshold: 0 }
      );
      Z.current = Q;
      for (const te of ee.current.values())
        try {
          Q.observe(te);
        } catch {
        }
      return () => {
        Q.disconnect(), Z.current === Q && (Z.current = null);
        for (const te of F.values()) clearTimeout(te);
        F.clear();
      };
    }, [i]), O(() => {
      if (typeof IntersectionObserver > "u") return;
      const F = new IntersectionObserver(
        (Q) => {
          H((te) => {
            let ce = null;
            for (const ge of Q) {
              const G = Sn(ge.target);
              !Number.isFinite(G) || ge.isIntersecting === te.has(G) || (ce = ce || new Set(te), ge.isIntersecting ? ce.add(G) : ce.delete(G));
            }
            return ce || te;
          });
        },
        { root: i, rootMargin: Xd, threshold: 0 }
      );
      fe.current = F;
      for (const Q of ee.current.values())
        try {
          F.observe(Q);
        } catch {
        }
      return () => {
        F.disconnect(), fe.current === F && (fe.current = null);
      };
    }, [i]);
    const Oe = !!i && typeof IntersectionObserver < "u";
    Ae(() => {
      j(0), oe(""), ne(/* @__PURE__ */ new Set()), Se(/* @__PURE__ */ new Set()), Y(/* @__PURE__ */ new Map()), ee.current.clear();
      const F = V.current;
      for (const Q of F.values()) clearTimeout(Q);
      F.clear(), h == null || h(0, t);
    }, [R, h, t]);
    const Be = L(
      (F) => {
        if (D.current !== R) return;
        const Q = F.numPages;
        j(Q), oe(""), h == null || h(Q, t), f == null || f({ numPages: Q, pane: t }), m && typeof F.getPage == "function" && m(F, t), d && typeof F.getOutline == "function" && Ru(F).then((te) => {
          D.current === R && d(te, t);
        }, () => {
        });
      },
      [R, f, d, m, h, t]
    ), Ze = L(
      (F) => {
        if (D.current !== R) return;
        const Q = (F == null ? void 0 : F.message) || "PDF 解析失败";
        oe(Q), j(0), h == null || h(0, t), g == null || g(F, t);
      },
      [R, g, h, t]
    ), Ce = U(
      () => K > 0 ? Array.from({ length: K }, (F, Q) => Q + 1) : [],
      [K]
    );
    O(() => {
      typeof IntersectionObserver < "u" || Se(new Set(Ce));
    }, [Ce]);
    const We = U(
      () => ft(y, S, t),
      [y, S, t]
    ), Qe = U(() => {
      const F = /* @__PURE__ */ new Map();
      for (const Q of I) {
        const te = ft(Q, S, t);
        if (!te) continue;
        const ce = F.get(te.box.page) || [];
        ce.push(te), F.set(te.box.page, ce);
      }
      return F;
    }, [t, S, I]), et = U(() => {
      const F = /* @__PURE__ */ new Set();
      if (!b) return F;
      for (const [Q, te] of Qe)
        te.some((ce) => ce.itemId === b) && F.add(Q);
      return F;
    }, [b, Qe]), wt = U(() => {
      if (K === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(Ce);
      if (de.size === 0) {
        const te = Math.min(K, $n * 2 + 1);
        return new Set(Array.from({ length: te }, (ce, ge) => ge + 1));
      }
      const Q = /* @__PURE__ */ new Set();
      for (const te of de)
        for (let ce = -$n; ce <= $n; ce++) {
          const ge = te + ce;
          ge >= 1 && ge <= K && Q.add(ge);
        }
      return Q;
    }, [K, Ce, i, a, de]), tt = !n || !!T || !!J, ye = n && (T || J) || s;
    return /* @__PURE__ */ C(
      "section",
      {
        ref: se,
        className: `reader-panel ${tn}${a ? "" : " is-hidden"}`,
        [we]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (v == null ? void 0 : v.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          E ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: E }) : null,
          M ? /* @__PURE__ */ C("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: M })
          ] }) : null,
          tt && !k ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: ye }) : null,
          k ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          z && !T ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            Ki,
            {
              file: z,
              loading: null,
              error: null,
              options: le,
              onLoadSuccess: Be,
              onLoadError: Ze,
              className: "reader-react-pdf-document",
              children: Ce.map((F) => {
                if (wt.has(F))
                  return /* @__PURE__ */ p(
                    Wd,
                    {
                      pane: t,
                      pageNumber: F,
                      width: B,
                      devicePixelRatio: ie,
                      active: ae.has(F),
                      textLayer: !Oe || x.has(F),
                      syncedMinHeight: (l == null ? void 0 : l.get(F)) || 0,
                      onMetrics: u,
                      cachedAspect: W.get(F),
                      onAspectChange: me,
                      sentinelRef: xe(F),
                      regionHighlight: (We == null ? void 0 : We.box.page) === F ? We : null,
                      regionTargets: Qe.get(F),
                      hoveredRegionId: b && et.has(F) ? b : null,
                      onHoverRegion: w,
                      liveTranslationLayout: v == null ? void 0 : v.layoutByPage.get(F - 1),
                      liveTranslationPage: v == null ? void 0 : v.pagesByPage.get(F - 1),
                      showLiveTranslation: P,
                      liveTranslationMissing: Xl(v, F - 1)
                    },
                    `${t}-${F}`
                  );
                const te = W.get(F) ?? ss, ce = Math.max(120, Math.floor(B * te)), ge = Math.max(ce, Math.ceil((l == null ? void 0 : l.get(F)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: xe(F),
                    [Te]: F,
                    [we]: t,
                    [mr]: ce,
                    className: `${hr} is-placeholder`,
                    style: {
                      width: B,
                      height: ge,
                      minHeight: ge
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: vn,
                        style: { width: B, height: ce },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${F}`
                );
              })
            },
            R
          ) }) : null
        ]
      }
    );
  }
), bo = Qt(Qd), ef = 2e3, tf = 6, nf = 500, yo = "reader-react-resizing";
function rf(e, t) {
  const n = A(null), r = A(null);
  Ae(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const w = of(e), v = Wt(e, w);
      if (!v) return;
      s = { pane: w, progress: v, started: performance.now() };
    }
    const { pane: i, progress: c, started: l } = s;
    let u = 0, f = null, d = e.scrollHeight, m = d, g = 0, h = l;
    const y = /* @__PURE__ */ new WeakMap(), I = typeof ResizeObserver > "u" ? null : new ResizeObserver((w) => {
      let v = !1;
      for (const P of w) {
        const M = Math.round(P.contentRect.height);
        y.has(P.target) && y.get(P.target) !== M && (v = !0), y.set(P.target, M);
      }
      v && Nt(e, c, "auto", i);
    }), S = () => {
      var w;
      f && clearTimeout(f), cancelAnimationFrame(u), I == null || I.disconnect(), e.classList.remove(yo);
      for (const v of vo) e.removeEventListener(v, S);
      ((w = r.current) == null ? void 0 : w.stop) === S && (r.current = null);
    }, b = () => {
      Nt(e, c, "auto", i);
      const w = e.scrollHeight;
      g = w === m ? g + 1 : 0, m = w;
      const v = performance.now() - h;
      g >= tf && (w !== d || v > nf) || v > ef ? S() : u = requestAnimationFrame(b);
    };
    for (const w of vo) e.addEventListener(w, S, { passive: !0 });
    for (const w of Array.from(e.children)) I == null || I.observe(w);
    e.classList.add(yo), r.current = { ...s, stop: S }, f = setTimeout(() => {
      f = null, h = performance.now(), d = e.scrollHeight, m = d, g = 0, u = requestAnimationFrame(b);
    }, Ba);
  }, [e, t]), O(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function of(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Te}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(we) || null;
  }
  return null;
}
const vo = ["wheel", "touchstart", "keydown", "pointerdown"];
function af(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function sf(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(tn)) && ((n = e.hasAttribute) != null && n.call(e, we)));
}
function cf(e, t) {
  O(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!sf(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${tn}[${we}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const c = af(a, i);
        if (c === null || Math.abs(i.scrollLeft - c) < 1) continue;
        const l = i.scrollLeft;
        i.scrollLeft = c, Math.abs(i.scrollLeft - l) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function lf(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), c = t - i, l = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: c * l };
}
function uf(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const wo = 12;
function Sr(e) {
  return Array.from(e.querySelectorAll(`.${tn}[${we}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function df(e) {
  const t = e.getBoundingClientRect();
  return Sr(e).map((n) => {
    const r = n.getBoundingClientRect();
    return {
      pane: n.getAttribute(we) || "",
      left: r.left - t.left,
      width: n.clientWidth,
      scrollWidth: n.scrollWidth,
      scrollLeft: n.scrollLeft
    };
  });
}
function ff(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function mf(e, t) {
  return e ? Sr(e).find((n) => n.getAttribute(we) === t) ?? null : null;
}
function hf({ shellEl: e }) {
  const [t, n] = _([]), r = A(0), o = L(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = df(e);
      n((i) => ff(i, s) ? i : s);
    }));
  }, [e]);
  O(() => {
    if (!e) return;
    o();
    const s = e.ownerDocument.defaultView;
    e.addEventListener("scroll", o, { capture: !0, passive: !0 });
    const i = s && typeof s.ResizeObserver < "u" ? new s.ResizeObserver(o) : null, c = () => {
      if (i) {
        i.disconnect(), i.observe(e);
        for (const f of Sr(e))
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
  return a.length ? /* @__PURE__ */ p("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ p(pf, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function pf({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - wo * 2), r = lf(e, n), o = A(null);
  if (!r) return null;
  const a = (d) => {
    const m = mf(t, e.pane);
    m && (m.scrollLeft = d);
  }, s = (d) => {
    var m, g;
    d.button === 0 && (d.preventDefault(), d.stopPropagation(), (g = (m = d.currentTarget).setPointerCapture) == null || g.call(m, d.pointerId), o.current = { startX: d.clientX, startScroll: e.scrollLeft, pointerId: d.pointerId });
  }, i = (d) => {
    const m = o.current;
    !m || m.pointerId !== d.pointerId || a(m.startScroll + uf(e, n, r.size, d.clientX - m.startX));
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
      style: { left: e.left + wo, width: n },
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
function is(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function gf(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function bf({ compare: e, onDone: t }) {
  return /* @__PURE__ */ C("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ p("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ p("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ p("li", { children: /* @__PURE__ */ C(
        X,
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
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: is(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(dr, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(vi, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ p("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ C("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ C(
        X,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ p(va, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ C(
        X,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ p(wi, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function So({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = gf(t), a = [e === "compare" ? "对比" : "正在读", r, is(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ C("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function yf({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = _({ source: null, translated: null });
  return Ae(() => {
    if (!e) return;
    const a = () => {
      const i = e.getBoundingClientRect(), c = (l) => {
        const u = e.querySelector(`[${we}="${l}"]`), f = u == null ? void 0 : u.getBoundingClientRect();
        return f && f.width > 0 ? { x: Math.round(f.left + f.width / 2), top: Math.round(i.top + 14) } : null;
      };
      o({ source: c("source"), translated: c("translated") });
    };
    a();
    const s = typeof ResizeObserver > "u" ? null : new ResizeObserver(a);
    return s == null || s.observe(e), e.querySelectorAll(`[${we}]`).forEach((i) => s == null ? void 0 : s.observe(i)), window.addEventListener("resize", a), e.addEventListener("scroll", a, { passive: !0 }), () => {
      s == null || s.disconnect(), window.removeEventListener("resize", a), e.removeEventListener("scroll", a);
    };
  }, [e]), /* @__PURE__ */ C("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(So, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(So, { role: "reading", ...n }) }) : null
  ] });
}
const vf = () => () => {
}, Io = () => null;
function wf({
  mode: e,
  compareMode: t,
  showSource: n,
  showTranslated: r,
  markdownSplit: o,
  overlayOnSource: a = !1
}) {
  return { mode: e, compareMode: t, showSource: n, showTranslated: r };
}
function Sf(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function If(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Tf(e) {
  const t = Fe(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), d = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? nn, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, I = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, b = (t == null ? void 0 : t.compareVersion) ?? null, w = (b == null ? void 0 : b.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", v = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", P = b ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, M = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, E = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), $ = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), N = t == null ? void 0 : t.onPdfOutline, k = t == null ? void 0 : t.onPdfDocument, T = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), R = e.regions ?? (t == null ? void 0 : t.regions) ?? [], D = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), z = (t == null ? void 0 : t.regionHover) ?? null, [K, j] = _(null), J = Rn(
    z ? z.subscribe : vf,
    z ? () => z.get().itemId : Io,
    z ? () => z.get().itemId : Io
  ), oe = z ? J : K, q = L((ue) => {
    z ? z.set(ue, "pdf") : j(ue);
  }, [z]), se = wf({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), re = Number.isFinite(g) && g > 0 ? Sf(
    g,
    // 对照时两栏分书页区，按书页区算（50% = 一栏）；单栏才按两倍算（50% = 铺满剩下的那一栏）。
    (n || r) && !se.compareMode,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return rf(d, re), cf(d, se.compareMode), /* @__PURE__ */ C(
    "div",
    {
      ref: f,
      className: Ca,
      "data-reader-region-count": R.length,
      "data-reader-structured-region-count": R.filter(di).length,
      "data-reader-metadata-ready": D ? "true" : "false",
      children: [
        /* @__PURE__ */ C(
          "main",
          {
            className: `${La} reader-mode-${se.mode}`,
            "data-reader-mode": se.compareMode ? s : n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              y ? /* @__PURE__ */ p(
                bo,
                {
                  pane: "source",
                  url: w,
                  preloadedFile: P,
                  userZoom: m,
                  visible: se.showSource,
                  scrollRoot: d,
                  pageWidthOverride: re,
                  rowHeights: se.compareMode ? h : void 0,
                  onMetrics: E,
                  emptyLabel: S ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: $,
                  onOutline: b ? void 0 : N,
                  onDocument: b ? void 0 : k,
                  activeRegion: T,
                  regions: (b == null ? void 0 : b.regions) ?? R,
                  readerMetadata: D,
                  hoveredRegionId: oe,
                  onHoverRegion: q,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? If(o) : "",
                  paneAction: u && se.showTranslated ? /* @__PURE__ */ C(_e, { children: [
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
                bo,
                {
                  pane: "translated",
                  url: v,
                  preloadedFile: M,
                  userZoom: m,
                  visible: se.showTranslated,
                  scrollRoot: d,
                  pageWidthOverride: re,
                  rowHeights: se.compareMode ? h : void 0,
                  onMetrics: E,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: $,
                  onOutline: N,
                  onDocument: k,
                  activeRegion: T,
                  regions: R,
                  readerMetadata: D,
                  hoveredRegionId: oe,
                  onHoverRegion: q,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ p(hf, { shellEl: d }),
        b ? /* @__PURE__ */ p(yf, { shellEl: d, left: b.left, right: b.right }) : null
      ]
    }
  );
}
const kf = 72, ln = 1500, Ef = 2e3, Rf = 1200;
function Pf(e, t) {
  return e - t < kf;
}
function Mf(e) {
  try {
    return e.matches(":focus-visible");
  } catch {
    return !1;
  }
}
function xf(e, t) {
  const [n, r] = _(!0), o = A(null), a = A(!1), s = A(!1), i = L(() => {
    o.current !== null && (window.clearTimeout(o.current), o.current = null);
  }, []), c = L((u) => {
    i(), o.current = window.setTimeout(() => {
      o.current = null, s.current || r(!1);
    }, u);
  }, [i]);
  O(() => {
    var w;
    const u = (w = e.current) == null ? void 0 : w.parentElement;
    if (!u) return;
    let f = u.getBoundingClientRect().top;
    const d = () => {
      f = u.getBoundingClientRect().top;
    }, m = (v) => {
      v.pointerType !== "touch" && (Pf(v.clientY, f) ? a.current || (a.current = !0, i(), r(!0)) : a.current && (a.current = !1, c(ln)));
    }, g = () => {
      a.current && (a.current = !1, c(ln));
    }, h = (v) => {
      s.current = v.target instanceof Element && Mf(v.target), s.current && (i(), r(!0));
    }, y = (v) => {
      var E;
      const P = v.relatedTarget;
      if (P instanceof Node && ((E = e.current) != null && E.contains(P))) return;
      const M = s.current;
      s.current = !1, M && !a.current && c(ln);
    }, I = () => {
      a.current || (r(!0), c(ln));
    }, S = () => {
      s.current = !1;
    }, b = e.current;
    return c(Ef), b == null || b.addEventListener("focusin", h), b == null || b.addEventListener("focusout", y), b == null || b.addEventListener("pointerdown", S), u.addEventListener("scroll", I, { capture: !0, passive: !0 }), u.addEventListener("pointerenter", d), u.addEventListener("pointermove", m, { passive: !0 }), u.addEventListener("pointerleave", g), window.addEventListener("resize", d), () => {
      i(), b == null || b.removeEventListener("focusin", h), b == null || b.removeEventListener("focusout", y), b == null || b.removeEventListener("pointerdown", S), u.removeEventListener("scroll", I, { capture: !0 }), u.removeEventListener("pointerenter", d), u.removeEventListener("pointermove", m), u.removeEventListener("pointerleave", g), window.removeEventListener("resize", d);
    };
  }, [e, i, c]);
  const l = A(t);
  return O(() => {
    l.current !== t && (l.current = t, !a.current && (r(!0), c(Rf)));
  }, [t, c]), n;
}
const Nf = [
  { id: "source", label: "原文", Icon: wa },
  { id: "compare", label: "对照", Icon: Sa },
  { id: "translated", label: "译文", Icon: Ia }
];
function _f(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function Af(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function Lf(e) {
  const t = Fe(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? _f(a.state) : "", l = A(null), u = xf(l, n);
  return (
    // 浮在书页区顶上（2026-11-28 用户：「顶部的 bar 不要保留了，用悬浮的方式……更有沉浸感」）：
    // 这一层本身透明、不接点击，只有左上的胶囊和正中的页签接；左右两段同宽，页签在书页区正中。
    // 读的时候藏着，鼠标到书页区顶上才出来（use-topbar-reveal.ts；不藏的几种在 chrome.css）。
    /* @__PURE__ */ C("header", { className: "reader-workspace-bar", ref: l, "data-revealed": u ? "true" : "false", children: [
      /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
      /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
      e.start ? /* @__PURE__ */ p("div", { className: "reader-workspace-start", children: e.start }) : null,
      /* @__PURE__ */ C("div", { className: "reader-workspace-center", children: [
        /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Nf.map(({ id: f, label: d, Icon: m }) => {
          const g = n === f, h = Af({
            id: f,
            documentReady: r,
            sourceViewOnly: i,
            liveTranslationAvailable: !!a
          });
          return /* @__PURE__ */ C(En, { children: [
            /* @__PURE__ */ p(
              "button",
              {
                type: "button",
                className: `reader-workspace-tab${g ? " is-active" : ""}`,
                role: "tab",
                "aria-selected": g,
                "aria-label": d,
                title: h ? `${d} 需要文档任务` : d,
                disabled: h,
                onClick: () => o(f),
                children: /* @__PURE__ */ p(m, { ...Re, "aria-hidden": !0 })
              }
            ),
            f === "compare" ? e.compareExtra : null
          ] }, f);
        }) }),
        a ? /* @__PURE__ */ C("div", { className: "reader-live-strip", children: [
          /* @__PURE__ */ C(
            "button",
            {
              type: "button",
              className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
              "aria-pressed": a.visible,
              "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
              title: a.state.error || `${c}，${a.visible ? "点一下看原文" : "点一下叠上译文"}`,
              onClick: a.onToggle,
              children: [
                /* @__PURE__ */ p(Si, { ...Re, "aria-hidden": !0 }),
                /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: c })
              ]
            }
          ),
          a.latestPage && a.onJumpToLatest && a.latestPage !== a.currentPage ? /* @__PURE__ */ C(
            X,
            {
              className: "reader-live-translation-toggle reader-live-jump",
              "aria-label": `跳到最新译好的第 ${a.latestPage} 页`,
              title: `跳到最新译好的第 ${a.latestPage} 页`,
              onClick: a.onJumpToLatest,
              children: [
                /* @__PURE__ */ p(Ii, { ...Re, "aria-hidden": !0 }),
                /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "跳到最新" })
              ]
            }
          ) : null
        ] }) : s ? /* @__PURE__ */ p("div", { className: "reader-live-strip", children: /* @__PURE__ */ C(
          X,
          {
            className: "reader-live-translation-toggle is-done",
            title: "翻译完成，左右对照看最终译文",
            onClick: s.onOpenCompare,
            children: [
              /* @__PURE__ */ p(Ti, { ...Re, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
            ]
          }
        ) }) : null
      ] }),
      /* @__PURE__ */ p("span", { className: "reader-workspace-end", "aria-hidden": "true" })
    ] })
  );
}
const cs = [];
function Cf() {
  const e = /* @__PURE__ */ new Map(), t = /* @__PURE__ */ new Set();
  let n = cs;
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
function To(e, t) {
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
function Df(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.pageLayer ? [{ id: t, render: n.pageLayer }] : []);
}
function $f(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.menuSection ? [{ id: t, render: n.menuSection }] : []);
}
function Of(e) {
  var t;
  return ((t = e.find(({ contribution: n }) => n.takesPointer)) == null ? void 0 : t.id) ?? null;
}
function zf(e) {
  const t = e.flatMap(({ id: n, contribution: r }) => r.textMarks ? [{ id: n, marks: r.textMarks }] : []);
  return t.length ? (n) => t.flatMap(({ id: r, marks: o }) => {
    try {
      return [...o(n)];
    } catch (a) {
      return console.error(`[reader] 扩展 ${r} 的文字层标记出错`, a), [];
    }
  }) : null;
}
function Ff(e) {
  return e.reduce((t, { contribution: n }) => Math.max(t, n.reserveRight || 0), 0);
}
function Bf(e) {
  for (const { contribution: t } of e) if (t.comparedDocument) return t.comparedDocument;
  return null;
}
function Hf(e) {
  return e.flatMap(({ title: t, contribution: n }) => {
    var r;
    return (r = n.shortcuts) != null && r.length ? [{ title: t, items: n.shortcuts }] : [];
  });
}
const Mn = en(null), ls = en(null);
function jf({ api: e, store: t, children: n }) {
  const r = U(() => ({ api: e, store: t }), [e, t]);
  return /* @__PURE__ */ p(Mn.Provider, { value: r, children: n });
}
function Lt() {
  const e = dt(Mn);
  if (!e) throw new Error("useReaderApi 要在 ReaderExtensionsProvider 里面用");
  return e.api;
}
const Uf = () => () => {
}, ko = () => cs;
function Wf(e) {
  return Rn(e.subscribe, e.getSnapshot, e.getSnapshot);
}
function us() {
  var t;
  const e = (t = dt(Mn)) == null ? void 0 : t.store;
  return Rn((e == null ? void 0 : e.subscribe) ?? Uf, (e == null ? void 0 : e.getSnapshot) ?? ko, (e == null ? void 0 : e.getSnapshot) ?? ko);
}
function rn(e) {
  var a;
  const t = (a = dt(Mn)) == null ? void 0 : a.store, n = dt(ls);
  if (!n) throw new Error("useReaderContribution 只能在扩展组件里用");
  const { id: r, title: o } = n;
  O(() => {
    t == null || t.set(r, o, e);
  }, [t, r, o, e]), O(() => () => t == null ? void 0 : t.remove(r), [t, r]);
}
class Kf extends ei {
  constructor() {
    super(...arguments);
    Ur(this, "state", { failed: !1 });
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
const Vf = Qt(function({ extensions: t }) {
  return /* @__PURE__ */ p(_e, { children: t.map(({ id: n, title: r, Component: o }) => /* @__PURE__ */ p(Kf, { id: n, children: /* @__PURE__ */ p(qf, { id: n, title: r, children: /* @__PURE__ */ p(o, {}) }) }, n)) });
});
function qf({ id: e, title: t, children: n }) {
  const r = U(() => ({ id: e, title: t }), [e, t]);
  return /* @__PURE__ */ p(ls.Provider, { value: r, children: n });
}
function Jf({
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
      X,
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
const Eo = 6e3;
function ds(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function fs(e, t, n, r) {
  const o = e.width * t.width, a = e.height * t.height;
  let s = n * r / Math.max(1, o);
  const i = Math.max(o, a) * s;
  return i > Eo && (s *= Eo / i), {
    scale: s,
    offsetX: -e.left * t.width * s,
    offsetY: -e.top * t.height * s,
    canvasWidth: Math.max(1, Math.round(o * s)),
    canvasHeight: Math.max(1, Math.round(a * s)),
    /** 显示高度（CSS 像素），按区域的宽高比。 */
    cssHeight: Math.round(n * (a / Math.max(1, o)))
  };
}
function ms({
  pdf: e,
  page: t,
  region: n,
  cssWidth: r,
  className: o,
  label: a
}) {
  const s = A(null), [i, c] = _({ status: "loading", cssHeight: 0 }), l = `${t}:${n.left}:${n.top}:${n.width}:${n.height}:${Math.round(r)}`;
  return O(() => {
    let u = !1, f = null;
    return c((d) => ({ status: "loading", cssHeight: d.cssHeight })), (async () => {
      try {
        const d = await e.getPage(t);
        if (u) return;
        const m = d.getViewport({ scale: 1 }), g = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), h = fs(n, m, r, g), y = s.current, I = y == null ? void 0 : y.getContext("2d");
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
  }, [e, l]), /* @__PURE__ */ C(
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
const Gf = 1600, Ir = { left: 0, top: 0, width: 1, height: 1 };
function hs(e) {
  return new Promise((t, n) => {
    e.toBlob((r) => r ? t(r) : n(new Error("截图没出来")), "image/png");
  });
}
function Xf(e, t, n) {
  if (e.width <= 0 || e.height <= 0) return null;
  const r = (l) => Math.min(1, Math.max(0, (l - e.left) / e.width)), o = (l) => Math.min(1, Math.max(0, (l - e.top) / e.height)), a = Math.min(r(t.x), r(n.x)), s = Math.max(r(t.x), r(n.x)), i = Math.min(o(t.y), o(n.y)), c = Math.max(o(t.y), o(n.y));
  return s - a < 0.02 || c - i < 0.02 ? null : { left: a, top: i, width: s - a, height: c - i };
}
async function Yf(e, t, n = Ir, r = Gf) {
  const o = await e.getPage(t), a = fs(n, o.getViewport({ scale: 1 }), r, 1), s = document.createElement("canvas");
  s.width = a.canvasWidth, s.height = a.canvasHeight;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.fillStyle = "#fff", i.fillRect(0, 0, s.width, s.height), await o.render({ canvasContext: i, viewport: o.getViewport({ scale: a.scale, offsetX: a.offsetX, offsetY: a.offsetY }) }).promise, hs(s);
}
async function Zf(e, t = Ir) {
  const n = Math.round(t.left * e.width), r = Math.round(t.top * e.height), o = Math.max(1, Math.round(t.width * e.width)), a = Math.max(1, Math.round(t.height * e.height)), s = document.createElement("canvas");
  s.width = o, s.height = a;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.drawImage(e, n, r, o, a, 0, 0, o, a), hs(s);
}
function Qf(e, t) {
  return t.left === 0 && t.top === 0 && t.width === 1 && t.height === 1 ? `第${e}页.png` : `第${e}页-截图.png`;
}
const em = /[\u{1D400}-\u{1D7FF}ﬀ-ﬆ]/gu, Ro = /[⺀-鿿가-힯豈-﫿＀-￯　-〿]/u;
function ps(e) {
  let t = `${e || ""}`.replace(/\r\n?/g, `
`).replace(/­/g, "");
  return t.trim() ? (t = t.replace(em, (r) => r.normalize("NFKC")), t = t.normalize("NFC"), t.includes("̸") && (t = t.replace(/(\S)?̸[ \t]*(\S)/gu, (r, o, a) => `${o ? `${o} ` : ""}${a}̸`).normalize("NFC")), t.split(/\n[ \t]*\n+/).map((r) => tm(r.split(`
`))).filter(Boolean).join(`
`).trim()) : "";
}
function tm(e) {
  let t = "";
  for (const n of e) {
    const r = n.replace(/[ \t ]+/g, " ").trim();
    if (!r) continue;
    if (!t) {
      t = r;
      continue;
    }
    if (new RegExp("\\p{L}-$", "u").test(t) && new RegExp("^\\p{Ll}", "u").test(r)) {
      t = t.slice(0, -1) + r;
      continue;
    }
    if (new RegExp("\\p{L}-$", "u").test(t) && /^[\p{Lu}\p{N}]/u.test(r)) {
      t += r;
      continue;
    }
    const o = t.slice(-1), a = r.charAt(0);
    t += Ro.test(o) || Ro.test(a) ? r : ` ${r}`;
  }
  return t;
}
const nm = /[\u{1D400}-\u{1D7FF}Ͱ-Ͽ℀-⅏←-⋿⨀-⫿⟀-⟯⦀-⧿⁰-₟̀-ͯ√±×÷]/u;
function Po(e) {
  return nm.test(e);
}
function rm(e) {
  const t = `${e || ""}`;
  return t.trim() ? [...t.trim()].length > 6 ? !1 : !new RegExp("\\p{Ll}{3,}", "u").test(t) : !0;
}
function om(e, t) {
  const n = e[t];
  if (!n) return null;
  const r = (i) => {
    const c = e[i];
    return !!c && c.line === n.line && (Po(c.text) || rm(c.text));
  };
  if (!r(t)) return null;
  let o = t, a = t;
  for (; r(o - 1); ) o -= 1;
  for (; r(a + 1); ) a += 1;
  let s = !1;
  for (let i = o; i <= a; i += 1) Po(e[i].text) && (s = !0);
  if (!s) return null;
  for (; o < a && !e[o].text.trim(); ) o += 1;
  for (; a > o && !e[a].text.trim(); ) a -= 1;
  return [o, a];
}
function am(e) {
  const t = e.filter((a) => a.right - a.left > 0.5 && a.bottom - a.top > 0.5);
  if (!t.length) return [];
  const n = [...t].sort((a, s) => (a.top + a.bottom) / 2 - (s.top + s.bottom) / 2), r = [];
  for (const a of n) {
    const s = r.at(-1), i = s ? Mo(s) : null;
    i && sm(i, a) >= 0.5 * Math.min(i.bottom - i.top, a.bottom - a.top) ? s.push(a) : r.push([a]);
  }
  const o = [];
  for (const a of r) {
    const s = Mo(a), i = s.bottom - s.top, c = [...a].sort((u, f) => u.left - f.left);
    let l = null;
    for (const u of c)
      l && u.left - l.right <= i * 2 ? l.right = Math.max(l.right, u.right) : (l && o.push(l), l = { left: u.left, top: s.top, right: u.right, bottom: s.bottom });
    l && o.push(l);
  }
  return o;
}
function Mo(e) {
  const t = Math.max(...e.map((r) => r.bottom - r.top)), n = e.filter((r) => r.bottom - r.top >= t * 0.75);
  return { top: Math.min(...n.map((r) => r.top)), bottom: Math.max(...n.map((r) => r.bottom)) };
}
function sm(e, t) {
  return Math.min(e.bottom, t.bottom) - Math.max(e.top, t.top);
}
const im = 4e3;
function cm(e, t, n) {
  if (e.length) {
    const o = Pu(e, n), a = o ? Ya(e).find((s) => s.id === o) : null;
    if (a) return a.title;
  }
  let r = null;
  for (const o of t)
    !o.headingLevel || o.source.page > n || (!r || o.source.page >= r.source.page) && (r = o);
  return `${(r == null ? void 0 : r.source.text) || (r == null ? void 0 : r.markdown) || ""}`.replace(/\s+/g, " ").trim().slice(0, 80);
}
function xo(e) {
  var a, s;
  if (!e || e.isCollapsed || !e.rangeCount) return { text: "", element: null, rect: null };
  const t = e.getRangeAt(0), n = t.startContainer, r = ((s = (a = n.nodeType === 1 ? n : n.parentElement) == null ? void 0 : a.closest) == null ? void 0 : s.call(a, `[${Te}]`)) ?? null;
  return r ? { text: ps(`${e}`).slice(0, im), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function lm(e, t, n, r, o) {
  let a = null, s = 0.15;
  for (const i of e) {
    const c = ft(i, t, n);
    if (!c || c.box.page !== r) continue;
    const l = ct(c, 1, 1);
    if (!l) continue;
    const u = o.y < l.top ? l.top - o.y : o.y > l.top + l.height ? o.y - l.top - l.height : 0, f = o.x < l.left ? l.left - o.x : o.x > l.left + l.width ? o.x - l.left - l.width : 0, d = u + f * 0.25;
    (d < s || d === 0 && a === null) && (a = i, s = d);
  }
  return a;
}
function um({
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
  const c = Number(e.getAttribute(Te)) || 0;
  if (c < 1) return null;
  const l = e.getAttribute(we) === "source" ? "source" : "translated", u = e.getBoundingClientRect(), f = u.width > 0 && u.height > 0 ? { x: Math.min(1, Math.max(0, (t - u.left) / u.width)), y: Math.min(1, Math.max(0, (n - u.top) / u.height)) } : null, m = (r ? a.find((g) => g.itemId === r) ?? null : null) ?? (f ? lm(a, i, l, c, f) : null);
  return {
    pane: l,
    page: c,
    itemId: (m == null ? void 0 : m.itemId) ?? null,
    selection: o,
    sourceText: `${(m == null ? void 0 : m.source.text) || (m == null ? void 0 : m.markdown) || ""}`.trim(),
    translatedText: `${(m == null ? void 0 : m.translatedBlockText) || (m == null ? void 0 : m.translated.text) || ""}`.trim(),
    section: cm(s, a, (m == null ? void 0 : m.source.page) ?? c),
    point: f
  };
}
function dm(e, t, n = document) {
  for (const r of n.elementsFromPoint(e, t)) {
    const o = r.closest(`[${Te}]`);
    if (!o) continue;
    const a = Number(o.getAttribute(Te)) || 0, i = (o.closest(`[${we}]`) ?? o).getAttribute(we) === "translated" ? "translated" : "source", c = o.querySelector("canvas");
    if (a && c) return { page: a, pane: i, canvas: c, slot: o };
  }
  return null;
}
function fm({ onDone: e, onCancel: t }) {
  const [n, r] = _(null), o = A(null), a = A(null);
  O(() => {
    const c = (l) => {
      l.key === "Escape" && (l.preventDefault(), l.stopImmediatePropagation(), t());
    };
    return window.addEventListener("keydown", c, !0), () => window.removeEventListener("keydown", c, !0);
  }, [t]);
  const s = (c, l) => {
    const u = a.current;
    u && (u.style.pointerEvents = "none");
    try {
      return dm(c, l);
    } finally {
      u && (u.style.pointerEvents = "");
    }
  }, i = n ? { left: Math.min(n.from.x, n.to.x), top: Math.min(n.from.y, n.to.y), width: Math.abs(n.to.x - n.from.x), height: Math.abs(n.to.y - n.from.y) } : null;
  return /* @__PURE__ */ C(
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
        const f = Xf(l.canvas.getBoundingClientRect(), u, { x: c.clientX, y: c.clientY });
        f && e({ page: l.page, pane: l.pane, region: f, canvas: l.canvas, point: { x: u.x, y: u.y, target: l.slot } });
      },
      children: [
        /* @__PURE__ */ p("p", { className: "reader-ask-crop-hint", children: "在书页上拖出一块，松开就带进提问 · Esc 取消" }),
        i ? /* @__PURE__ */ p("div", { className: "reader-ask-crop-box", style: i }) : null
      ]
    }
  );
}
const No = 5e4, mm = 2e4;
function On(e, t) {
  const n = `${e || ""}`;
  return n.length > t ? n.slice(0, t) : n;
}
function Wb(e, t) {
  const n = { page: e.page, pane: e.pane, item_ids: e.itemId ? [e.itemId] : [] };
  return t.documentId && (n.document_id = t.documentId), t.jobId && (n.job_id = t.jobId), t.versionId && (n.translation_version = t.versionId), e.selection && (n.selected_text = e.selection), e.section && (n.section = e.section), e.sourceText && (n.source_text = e.sourceText), e.translatedText && (n.translated_text = e.translatedText), n;
}
function hm(e, t = null) {
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
function pm(e, t) {
  if (!(e != null && e.page)) return null;
  const r = [!!(e.document_id && t && e.document_id !== t) ? "别的书" : "", `第 ${e.page} 页`, e.section || ""].filter(Boolean).join(" · ");
  return { page: e.page, label: r, data: e };
}
function gm(e) {
  var r;
  const t = e == null ? void 0 : e.data, n = ((r = t == null ? void 0 : t.retainpdf) == null ? void 0 : r.selection) ?? (t && typeof t.page == "number" ? t : null);
  return n && n.page ? n : null;
}
function Kb(e, t) {
  var r;
  const n = gm(e);
  return !n || n.document_id && t && n.document_id !== t ? null : ((r = n.item_ids) == null ? void 0 : r[0]) || null;
}
function Vb(e) {
  var o, a;
  const t = e.selection.trim();
  return t && !t.endsWith("…") ? t : ((a = (o = [...e.text.matchAll(/```[ \t]*(译文|translation|zh|zh-CN)[ \t]*\n([\s\S]*?)\n```/gi)].at(-1)) == null ? void 0 : o[2]) == null ? void 0 : a.trim()) || null;
}
function bm(e, t) {
  var o;
  if (!t) return;
  const n = e.findIndex((a) => a.message_id === t);
  if (n < 0) return;
  const r = ((o = e[n + 1]) == null ? void 0 : o.role) === "assistant" ? ym(e[n + 1].text) : "";
  return { question: e[n].text, ...r ? { answer: r } : {} };
}
function ym(e, t = 160) {
  const n = e.replace(/```[\s\S]*?(```|$)/g, " ").replace(/\$\$[\s\S]*?\$\$/g, " … ").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim(), r = [...n];
  return r.length > t ? `${r.slice(0, t).join("")}…` : n;
}
function vm(e, t = [], n = "") {
  const r = new Set(t.map((o) => o.covers_to_seq));
  return e.filter((o) => !o.superseded_at).map((o) => {
    const a = r.has(o.seq) ? { compactedBefore: !0 } : {};
    if (o.role === "user") {
      const s = bm(e, o.edited_from);
      return {
        id: o.message_id,
        role: "user",
        text: o.text,
        context: pm(o.selection, n),
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
function wm(e, t, n, r) {
  var l, u, f;
  const o = ((f = (u = (l = e.context) == null ? void 0 : l.meta) == null ? void 0 : u.retainpdf) == null ? void 0 : f.selection) ?? null, a = (o == null ? void 0 : o.document_id) || t || null, s = e.sessionId && e.sessionId.length <= 256 ? e.sessionId : null, i = { agent_id: e.agentId || null, document_id: a, session_id: s }, c = e.answer.usage && JSON.stringify(e.answer.usage).length <= 4096 ? e.answer.usage : null;
  return [
    { ...i, role: "user", text: On(e.question.text, No), selection: o, client_message_id: `${n}-q`, ...r ? { edited_from: r } : {} },
    {
      ...i,
      role: "assistant",
      text: On(e.answer.text, No),
      thought: e.answer.thought ? On(e.answer.thought, mm) : null,
      usage: c,
      client_message_id: `${n}-a`,
      memory_ids: e.memoryIds.slice(0, 10)
    }
  ];
}
function Sm(e) {
  return new Date(e - 2e3).toISOString().replace(/\.\d+Z$/, "Z");
}
function Im(e, t) {
  return e.filter((n) => n.origin === "agent" && n.status === "active" && !t.has(n.memory_id)).map((n) => ({ id: n.memory_id, scope: n.scope, text: n.text, category: n.category, documentId: n.document_id, created: !0 }));
}
function Tm(e, t) {
  if (t.id && e.some((r) => r.message_id === t.id)) return t.id;
  const n = t.text.trim();
  for (let r = e.length - 1; r >= 0; r -= 1) {
    const o = e[r];
    if (o.role === "assistant" && o.text.trim() === n) return o.message_id;
  }
  return null;
}
function km(e) {
  const t = e.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().split(new RegExp("(?<=[。！？.!?])"))[0] || "";
  return `深挖：${[...t].slice(0, 30).join("")}${[...t].length > 30 ? "…" : ""}`;
}
const Em = 50, zn = { conversation: null, main: null, records: [], compactions: [], hasMore: !1, key: "local", initial: [] };
function Rm() {
  var t, n;
  return `c-${((n = (t = globalThis.crypto) == null ? void 0 : t.randomUUID) == null ? void 0 : n.call(t)) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}
function _o(e) {
  var n, r, o, a;
  const t = e;
  return `${(t == null ? void 0 : t.reason) || ((n = t == null ? void 0 : t.details) == null ? void 0 : n.reason) || ((a = (o = (r = t == null ? void 0 : t.payload) == null ? void 0 : r.error) == null ? void 0 : o.details) == null ? void 0 : a.reason) || (e instanceof Error ? e.message : "")}`;
}
function Pm({ port: e, book: t, onAppended: n }) {
  const r = (e == null ? void 0 : e.conversations) ?? null, o = (e == null ? void 0 : e.memories) ?? null, [a, s] = _(!1), [i, c] = _(zn), [l, u] = _(!1), [f, d] = _(""), [m, g] = _("idle"), [h, y] = _(null), [I, S] = _([]), b = L((B) => {
    y(B), S([]);
  }, []), w = L((B) => S((W) => [...W, B].slice(-2)), []), [v, P] = _(() => /* @__PURE__ */ new Map()), M = A(/* @__PURE__ */ new Set()), E = A(/* @__PURE__ */ new Map()), $ = (B) => {
    if (!B) return null;
    const W = E.current.get(B);
    return W || (N.current.records.some((Y) => Y.message_id === B) ? B : null);
  }, N = A(i);
  N.current = i;
  const k = A(t);
  k.current = t;
  const T = A(0), R = L(async (B, W, Y, de = []) => {
    if (!r) return;
    const ne = await r.messages(B.conversation_id, { limit: Em, ...Y ? { beforeSeq: Y } : {} }), ae = [...ne.messages, ...de];
    T.current += 1, c({
      conversation: B,
      main: W ?? B,
      records: ae,
      compactions: ne.compactions || [],
      hasMore: ne.has_more,
      key: `${B.conversation_id}:${T.current}`,
      initial: vm(ae, ne.compactions || [], k.current.documentId)
    });
  }, [r]), D = L(async () => {
    s(!0);
    const B = N.current.conversation;
    if (!(!r || (B == null ? void 0 : B.kind) === "main" && B.status !== "archived")) {
      u(!0), d("");
      try {
        const W = await r.main(k.current.documentId || void 0);
        await R(W, W);
      } catch (W) {
        d(W instanceof Error ? W.message : String(W));
      } finally {
        u(!1);
      }
    }
  }, [r, R]), z = L((B) => {
    b(B), D();
  }, [D]), K = A(t.documentId);
  O(() => {
    K.current !== t.documentId && (K.current = t.documentId, N.current = zn, c(zn), b(null), P(/* @__PURE__ */ new Map()), E.current.clear(), a && D());
  }, [t.documentId, a, D]);
  const j = L(async () => {
    const B = N.current, W = B.records[0];
    if (!(!B.conversation || !W || !B.hasMore)) {
      u(!0);
      try {
        await R(B.conversation, B.main, W.seq, B.records);
      } finally {
        u(!1);
      }
    }
  }, [R]), J = L(async (B) => {
    const Y = N.current.conversation;
    if (!r || !Y) return;
    for (const Z of B.memoryIds) M.current.add(Z);
    let de = B.memoryIds;
    if (!de.length && o && B.startedAt) {
      const Z = Im(
        await o.list({ source_conversation_id: Y.conversation_id, created_after: Sm(B.startedAt) }).catch(() => []),
        M.current
      );
      for (const x of Z) M.current.add(x.id);
      de = Z.map((x) => x.id);
      const fe = B.answerId;
      Z.length && fe && P((x) => new Map(x).set(fe, Z));
    }
    const ne = wm({ ...B, memoryIds: de }, k.current.documentId, Rm(), $(B.editedFrom));
    let ae;
    try {
      ae = await r.append(Y.conversation_id, ne);
    } catch (Z) {
      if (Y.kind !== "side" || !/ask_conversation_not_open/.test(_o(Z))) throw Z;
      await r.reopen(Y.conversation_id), ae = await r.append(Y.conversation_id, ne);
    }
    const [Se, ee] = ae.messages;
    B.questionId && Se && E.current.set(B.questionId, Se.message_id), B.answerId && ee && E.current.set(B.answerId, ee.message_id), c((Z) => {
      var fe;
      return ((fe = Z.conversation) == null ? void 0 : fe.conversation_id) === Y.conversation_id ? { ...Z, conversation: ae.conversation, records: [...Z.records, ...ae.messages] } : Z;
    }), n == null || n(ae.messages), ae.compaction_due && Y.kind === "main" && r.compact(Y.conversation_id).catch(() => {
    });
  }, [r, o, n]), oe = L(async (B) => {
    const W = N.current.conversation, Y = $(B);
    if (!r || !W || !Y) return null;
    try {
      await r.supersede(W.conversation_id, Y);
    } catch (ae) {
      if (!/ask_message_superseded/.test(_o(ae))) throw ae;
    }
    const de = N.current.records.find((ae) => ae.message_id === Y), ne = N.current.records.findIndex((ae) => ae.message_id === Y);
    return c((ae) => ({ ...ae, records: ae.records.map((Se, ee) => ee >= ne && ne >= 0 && !Se.superseded_at ? { ...Se, superseded_at: "now" } : Se) })), (de == null ? void 0 : de.selection) ?? null;
  }, [r]), q = L((B) => {
    J(B).catch((W) => d(`这一轮没存上：${W instanceof Error ? W.message : String(W)}`));
  }, [J]), se = L(async (B) => {
    var de;
    const W = N.current, Y = W.main;
    if (!(!r || !Y || ((de = W.conversation) == null ? void 0 : de.kind) !== "main")) {
      d("");
      try {
        const ne = Tm(W.records, B), ae = await r.fork({
          parent_id: Y.conversation_id,
          ...ne ? { forked_from_message_id: ne } : {},
          title: km(B.text),
          ...k.current.documentId ? { document_id: k.current.documentId } : {}
        });
        await R(ae, Y);
      } catch (ne) {
        d(`开不了副对话：${ne instanceof Error ? ne.message : String(ne)}`);
      }
    }
  }, [r, R]), ke = L(async (B) => {
    const W = N.current.main;
    if (r)
      try {
        await R(await r.get(B), W);
      } catch (Y) {
        d(`打不开副对话：${Y instanceof Error ? Y.message : String(Y)}`);
      }
  }, [r, R]), re = L(async () => {
    const B = N.current.main;
    B && await R(B, B).catch(() => {
    });
  }, [R]), ue = L(async () => {
    const B = N.current.conversation;
    if (!(!r || (B == null ? void 0 : B.kind) !== "side")) {
      g("busy");
      try {
        await r.close(B.conversation_id), g("idle"), await re();
      } catch {
        g("failed");
      }
    }
  }, [r, re]), Pe = L(async () => r != null && r.archived ? r.archived(k.current.documentId) : [], [r]), ie = L(async (B) => {
    d(""), b(null);
    try {
      await R(B, N.current.main);
    } catch (W) {
      d(`打不开这个对话：${W instanceof Error ? W.message : String(W)}`);
    }
  }, [R, b]), le = L(async () => {
    const B = N.current.main;
    if (!r || !B) return;
    await r.archive(B.conversation_id);
    const W = await r.main(k.current.documentId || void 0);
    await R(W, W);
  }, [r, R]);
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
    ask: z,
    close: L(() => s(!1), []),
    loadEarlier: j,
    onTurn: q,
    rewrite: oe,
    fork: se,
    openSide: ke,
    backToMain: re,
    closeSide: ue,
    archiveMain: le,
    listArchived: Pe,
    viewArchived: ie,
    forgetMemory: r ? r.forgetMemory : void 0
  };
}
function Ao(e, t, n) {
  var c;
  const r = e.selection, o = e.page ?? (r == null ? void 0 : r.page) ?? 0;
  if (e.role !== "user" || !o) return null;
  const a = (e.pane ?? (r == null ? void 0 : r.pane)) === "source" ? "source" : "translated", s = ((c = r == null ? void 0 : r.item_ids) == null ? void 0 : c[0]) ?? null, i = hm({ item_ids: [], ...r, page: o, pane: a }, n(s, a, o));
  return { key: t, anchor: i, messageId: e.message_id, title: e.text.slice(0, 80) };
}
function Mm({ port: e, documentId: t, resetKey: n, pointOf: r }) {
  const [o, a] = _([]), s = A(0), i = A(r);
  i.current = r;
  const c = () => (s.current += 1, s.current);
  O(() => {
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
      (h) => d(h.map((y) => Ao(y, c(), i.current)).filter((y) => !!y)),
      () => {
      }
    ), () => {
      f = !0;
    };
  }, [e, t, n]);
  const l = L((f) => {
    const d = f.filter((m) => !m.document_id || m.document_id === t).map((m) => Ao(m, c(), i.current)).filter((m) => !!m);
    d.length && a((m) => [...m.filter((g) => !d.some((h) => h.messageId === g.messageId)), ...d]);
  }, [t]), u = L((f) => a((d) => d.filter((m) => m.key !== f)), []);
  return { marks: o, addRecords: l, removeMark: u };
}
const xm = ha(() => import("./ReaderAskPanel-CKlTyBwQ.js"));
function Nm({
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
  const S = U(() => ({ documentId: t, jobId: n, versionId: r }), [t, n, r]), b = L((x, H, V) => {
    const me = x ? o.find((xe) => xe.itemId === x) : null, be = me ? ft(me, a, H) : null, Ie = be && be.box.page === V ? ct(be, 1, 1) : null;
    return Ie ? { x: Ie.left, y: Ie.top } : null;
  }, [o, a]), w = Mm({ port: e, documentId: t, resetKey: c, pointOf: b }), v = Pm({ port: e, book: S, onAppended: w.addRecords }), [P, M] = _(null), E = L(
    (x, H, V, me) => um({
      pageElement: (x == null ? void 0 : x.closest(`[${Te}]`)) ?? null,
      clientX: H,
      clientY: V,
      itemId: i(),
      selection: me,
      regions: o,
      bookmarks: s,
      metadata: a
    }),
    [i, o, s, a]
  ), $ = L(() => {
    var H;
    const x = xo(((H = globalThis.getSelection) == null ? void 0 : H.call(globalThis)) ?? null);
    return !x.text || !x.element || !x.rect ? null : E(x.element, x.rect.left + x.rect.width / 2, x.rect.top + x.rect.height / 2, x.text);
  }, [E]), N = L((x) => {
    M(null), v.ask(x);
  }, [v.ask]);
  O(() => {
    if (!e) return;
    const x = (H) => {
      var be;
      if (H.key !== "?" || H.metaKey || H.ctrlKey || H.altKey || H.defaultPrevented) return;
      const V = H.target;
      if ((be = V == null ? void 0 : V.closest) != null && be.call(V, "input, textarea, select, [contenteditable='true']")) return;
      const me = $();
      me && (H.preventDefault(), H.stopImmediatePropagation(), N(me));
    };
    return window.addEventListener("keydown", x, !0), () => window.removeEventListener("keydown", x, !0);
  }, [e, $, N]);
  const k = A(m);
  k.current = m;
  const T = L(async ({ page: x, pane: H, region: V, canvas: me }) => {
    const be = k.current[H];
    let Ie;
    if (be)
      Ie = await Yf(be, x, V);
    else {
      const xe = me ?? document.querySelector(`[${we}="${H}"] [${Te}="${x}"] canvas`);
      if (!xe) throw new Error(`第 ${x} 页还没画出来，翻到那一页再试`);
      Ie = await Zf(xe, V);
    }
    return new File([Ie], Qf(x, V), { type: "image/png" });
  }, []), [R, D] = _(null), z = A(v.pending);
  z.current = v.pending;
  const K = U(() => [{
    key: "page",
    label: "带上这一页",
    title: "带上这一页的截图（问的那一页，没有就是现在读的这页）：公式、图表、表格让 AI 直接看图",
    icon: /* @__PURE__ */ p(ki, { size: 14, "aria-hidden": !0 }),
    run: () => {
      const x = z.current, H = (x == null ? void 0 : x.pane) || (h === "translated" ? "translated" : "source");
      return T({ page: (x == null ? void 0 : x.page) || g() || 1, pane: H, region: Ir });
    }
  }], [T, g, h]), [j, J] = _(!1), [oe, q] = _(""), se = L(async (x) => {
    J(!1), q("");
    try {
      const H = await T(x), V = E(x.point.target, x.point.x, x.point.y, "");
      D((me) => ({ id: ((me == null ? void 0 : me.id) || 0) + 1, files: [H] })), V ? N({ ...V, itemId: null, sourceText: "", translatedText: "" }) : v.openMain();
    } catch (H) {
      q(H instanceof Error ? H.message : String(H));
    }
  }, [T, E, N]), ke = L(() => J(!1), []), re = L(() => {
    q(""), J((x) => !x);
  }, []), ue = L(async (x) => {
    if (x.threadId && (e != null && e.threads) && t) {
      try {
        const H = await e.threads.get(t, x.threadId);
        M({ anchor: H.anchor || x.anchor, messages: H.messages || [], mark: x });
      } catch {
        M({ anchor: x.anchor, messages: [], mark: x });
      }
      return;
    }
    M(null), v.openMain();
  }, [e, t, v.openMain]), Pe = L((x) => {
    var me;
    if (!e) return [];
    const H = xo(((me = globalThis.getSelection) == null ? void 0 : me.call(globalThis)) ?? null), V = E(x.target, x.clientX, x.clientY, H.element ? H.text : "");
    return V ? [{
      key: "ask",
      label: V.selection ? "问这段" : "在这里提问",
      hint: V.selection ? "?" : void 0,
      // 选着字时也出现在选字浮条上（「复制 · 收藏 · 提问」，ReaderSelectionLayer）。
      inSelectionBar: V.selection ? "提问" : void 0,
      onSelect: () => N(V)
    }, {
      key: "crop",
      label: "截一块问",
      onSelect: () => {
        q(""), J(!0);
      }
    }] : [];
  }, [e, E, N]), ie = P ? {
    anchor: P.anchor,
    messages: P.messages,
    onClose: () => M(null),
    onDelete: e != null && e.threads && P.mark.threadId ? () => {
      e.threads.remove(t, P.mark.threadId).catch(() => {
      }), w.removeMark(P.mark.key), M(null);
    } : void 0
  } : null, le = U(() => f ? (x, H) => {
    f(x, H ?? void 0), requestAnimationFrame(() => d(x, "translated"));
  } : null, [f, d]), B = L((x) => Qa(o, x), [o]), [W, Y] = _(0), de = L(({ mode: x, width: H }) => {
    Y(x === "dock" ? Math.round(H) : 0);
  }, []), ne = !v.persistent || !!v.view.conversation || !!v.error, ae = e && (v.visible && ne || P) ? /* @__PURE__ */ p(ma, { fallback: null, children: /* @__PURE__ */ p(
    xm,
    {
      port: e,
      jobId: n,
      book: S,
      ask: v,
      legacy: ie,
      onShowSelection: ({ page: x, pane: H }) => l(x, H),
      onJumpToPage: (x) => l(x),
      pageCount: u,
      onLayout: de,
      dockTaken: y !== null,
      dockHost: I,
      onEditBlock: le,
      canEditBlock: B,
      attachTools: K,
      attachRequest: R
    }
  ) }) : null, Se = j || oe ? /* @__PURE__ */ C(_e, { children: [
    j ? /* @__PURE__ */ p(fm, { onDone: (x) => void se(x), onCancel: ke }) : null,
    oe ? /* @__PURE__ */ C("p", { className: "reader-ask-crop-error", role: "alert", onClick: () => q(""), children: [
      "截图没成：",
      oe
    ] }) : null
  ] }) : null, ee = v.visible && ne || !!P, Z = v.close, fe = L(() => {
    if (ee) {
      M(null), Z();
      return;
    }
    v.openMain();
  }, [ee, Z, v.openMain]);
  return { marks: w.marks, onMark: ue, menuItems: Pe, panel: ae, overlay: Se, cropping: j, toggleCrop: re, open: v.openMain, toggle: fe, showing: ee, reserveRight: ee ? W : 0, enabled: !!e };
}
const _m = [{ keys: "选字 + ?", desc: "问选中的这段" }];
function Am() {
  const e = Lt(), t = U(() => {
    try {
      return Ye().ask ?? null;
    } catch {
      return null;
    }
  }, []), n = Nm({
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
  }), { marks: r, onMark: o, menuItems: a, panel: s, overlay: i, cropping: c, toggleCrop: l, enabled: u, toggle: f, showing: d, reserveRight: m } = n, g = U(() => u ? {
    toolbarItems: [{
      key: "ask",
      label: "提问",
      title: "提问：问整本书、翻这本书以前的对话（问某一段：书页上右键，或选字按 ?）",
      Icon: Ta,
      pressed: d,
      onClick: f
    }, {
      // 底栏右边：框出书页上的一块，截图带进提问（和右键「截一块问」一样）。
      key: "crop",
      label: "截图",
      title: "截图：在书页上框出一块，带进提问（Esc 取消）",
      Icon: Ei,
      place: "bottom",
      pressed: c,
      onClick: l
    }],
    menuItems: a,
    pageLayer: r.length ? ({ page: h, height: y }) => /* @__PURE__ */ p(Jf, { marks: r, page: h, height: y, onOpen: o }) : void 0,
    shortcuts: _m,
    reserveRight: m,
    // 「截一块问」时占着书页上的指针：不出悬停框、不选字。
    takesPointer: c
  } : {}, [u, a, r, o, f, d, m, c, l]);
  return rn(g), /* @__PURE__ */ C(_e, { children: [
    s,
    i
  ] });
}
const Lm = { id: "ask", title: "提问", Component: Am };
function Yn() {
  try {
    return Ye().translationVersions ?? null;
  } catch {
    return null;
  }
}
function Cm(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function Dm(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function $m(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function Om({ documentId: e, jobId: t }) {
  const [n, r] = _([]), [o, a] = _(null);
  O(() => {
    r([]);
    const i = Yn();
    if (!i || !e) return;
    let c = !1;
    return i.list(e).then((l) => {
      c || (r(l.versions), a(l.currentVersionId));
    }).catch(() => {
    }), () => {
      c = !0;
    };
  }, [e, t]);
  const s = Dm(n, t, o);
  return U(() => ({ versions: n, readingVersionId: s }), [n, s]);
}
function zm({ documentId: e, jobId: t, versions: n, readingVersionId: r }) {
  const [o, a] = _(null), [s, i] = _(""), [c, l] = _(""), u = A(0);
  O(() => {
    u.current += 1, a(null), i(""), l("");
  }, [e, t]);
  const f = L((g) => {
    const h = Yn(), y = n.find((S) => S.versionId === g);
    if (!h || !y || !e) return;
    const I = ++u.current;
    i(g), l(""), (async () => {
      const S = Ye(), b = await h.resolveJob(e, g);
      if (!b) throw new Error("这一份还没有能读的译文。");
      const w = await S.loadReaderPayload(b, { includeOptionalArtifacts: !0 }), v = S.resolveReaderTranslatedPdfUrl(w.jobPayload, w.manifestPayload);
      if (!v) throw new Error("这一份没有译文 PDF。");
      return { versionId: g, name: y.name, jobId: b, url: v, regions: Cm(ga(w.regionsPayload)) };
    })().then((S) => {
      I === u.current && a(S);
    }).catch((S) => {
      I === u.current && l((S == null ? void 0 : S.message) || "这一份打不开。");
    }).finally(() => {
      I === u.current && i("");
    });
  }, [e, n]), d = L(() => {
    u.current += 1, a(null), i(""), l("");
  }, []), m = L(async () => {
    var y, I;
    const g = Yn();
    if (!g || !o || !e) return;
    try {
      await g.select(e, o.versionId);
    } catch (S) {
      l((S == null ? void 0 : S.message) || "换不过去，请稍后再试。");
      return;
    }
    const h = (y = globalThis.location) == null ? void 0 : y.href;
    h && ((I = globalThis.history) == null || I.replaceState(globalThis.history.state, "", $m(h, o.jobId))), a(null);
  }, [o, e]);
  return U(() => ({
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
function Fm(e) {
  return e.available ? {
    key: "compare",
    label: "对比版本",
    title: "对比版本：左边换成这本书的另一份译文",
    Icon: Ri,
    place: "compare",
    pressed: !!(e.compared || e.loading),
    popup: (t) => /* @__PURE__ */ p(bf, { compare: e, onDone: t })
  } : null;
}
function Bm(e) {
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
function Hm() {
  var i;
  const e = Lt(), t = zm({
    documentId: e.documentId,
    jobId: e.jobId,
    versions: e.translationVersions,
    readingVersionId: e.versionId || ""
  }), { visibleMode: n, setWorkspace: r } = e, o = ((i = t.compared) == null ? void 0 : i.url) || "";
  O(() => {
    o && n !== "compare" && r("compare");
  }, [o]);
  const a = t.clear;
  O(() => {
    n !== "compare" && a();
  }, [n, a]);
  const s = U(() => {
    const c = Fm(t);
    return { toolbarItems: c ? [c] : [], comparedDocument: Bm(t) };
  }, [t]);
  return rn(s), null;
}
const jm = { id: "compare", title: "对比版本", Component: Hm }, Um = '"Times New Roman", "Tinos", "Liberation Serif", "Source Han Serif SC", "Noto Serif CJK SC", serif', un = 1.5;
function Wm(e, t) {
  const n = Le(e);
  if (n === "formula") {
    const o = `${e.markdown || e.source.text || ""}`.trim();
    return o ? { kind: "display_formula", content: o } : null;
  }
  if (n !== "text") return null;
  const r = t === "translated" ? `${e.translatedBlockText || e.markdown || e.translated.text || ""}`.trim() : `${e.source.text || ""}`.trim();
  return r ? { kind: e.regionType || "text", content: r } : null;
}
function Km(e) {
  var n;
  const t = /* @__PURE__ */ new Map();
  for (const r of e) {
    const o = Number((n = r.source) == null ? void 0 : n.page);
    if (!Number.isFinite(o)) continue;
    const a = t.get(o);
    a ? a.push(r) : t.set(o, [r]);
  }
  return t;
}
function Vm({ page: e, width: t, height: n, regions: r, metadata: o, text: a, arrivedAt: s }) {
  const { items: i, scale: c } = U(() => {
    var d;
    const l = [];
    let u = 0;
    const f = [...r].sort((m, g) => (m.readingOrder ?? 0) - (g.readingOrder ?? 0));
    for (const m of f) {
      const g = Wm(m, a);
      if (!g) continue;
      const h = ft(m, o, "source");
      if (!h || h.box.page !== e) continue;
      const y = ct(h, t, n);
      !y || y.width < 2 || y.height < 2 || (!u && ((d = h.pageSize) != null && d.width) && (u = t / h.pageSize.width), l.push({
        order: l.length,
        item: {
          itemId: m.itemId,
          translatedText: g.content,
          status: "html",
          kind: g.kind,
          sourceText: m.source.text || "",
          typography: a === "source" && g.kind !== "display_formula" ? { font_family: Um } : void 0,
          rect: {
            left: y.left - un,
            top: y.top - un,
            width: y.width + un * 2,
            height: y.height + un * 2
          },
          changedAtSeq: s,
          changedNow: Date.now() - s < 1500
        }
      }));
    }
    return { items: l, scale: u || 1 };
  }, [r, o, a, e, t, n, s]);
  return i.length ? /* @__PURE__ */ p("div", { className: "reader-html-page", "data-html-page": e, "data-html-text": a, children: i.map(({ item: l, order: u }) => /* @__PURE__ */ p(
    "div",
    {
      className: "reader-html-block",
      "data-html-block": l.itemId,
      "data-html-kind": l.kind,
      style: { "--reader-html-order": u },
      children: /* @__PURE__ */ p(vr, { item: l, pageScale: c })
    },
    `${l.itemId}:${l.changedAtSeq}`
  )) }) : null;
}
const qm = [
  { value: null, label: "关", hint: "看原来的 PDF" },
  { value: "translated", label: "画译文", hint: "原文页上按 OCR 的框用 HTML 画译文" },
  { value: "source", label: "画原文", hint: "原文页上按 OCR 的框用 HTML 重画原文" }
];
function Jm() {
  const e = Lt(), [t, n] = _(null), [r, o] = _(0), a = U(() => Km(e.regions), [e.regions]), s = !e.sourceOnly, { metadata: i, visibleMode: c, setWorkspace: l } = e, u = U(() => {
    const f = (d) => {
      n(d), o(Date.now()), d && c === "translated" && l("source");
    };
    return {
      toolbarItems: [{
        key: "html-page",
        label: "HTML 页",
        title: t ? `HTML 页：${t === "translated" ? "画译文" : "画原文"}（点开换）` : "HTML 页：按 OCR 的框把书页用 HTML 画出来",
        Icon: Pi,
        pressed: !!t,
        popup: (d) => /* @__PURE__ */ p("div", { className: "reader-html-page-menu reader-floating-surface", role: "menu", "aria-label": "HTML 页", children: qm.filter((m) => m.value !== "translated" || s).map((m) => /* @__PURE__ */ p(
          X,
          {
            className: "reader-html-page-choice",
            role: "menuitemradio",
            "aria-checked": t === m.value,
            title: m.hint,
            onClick: () => {
              f(m.value), d();
            },
            children: m.label
          },
          m.label
        )) })
      }],
      pageLayer: t ? ({ page: d, width: m, height: g, pane: h, active: y }) => y && h === "source" ? /* @__PURE__ */ p(
        Vm,
        {
          page: d,
          width: m,
          height: g,
          regions: a.get(d) ?? [],
          metadata: i,
          text: t,
          arrivedAt: r
        }
      ) : null : void 0
    };
  }, [t, r, a, i, s, c, l]);
  return rn(u), null;
}
const Gm = { id: "html-page", title: "HTML 页", Component: Jm }, gs = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], Lo = { pen: 35e-4, highlighter: 0.018 }, Co = 0.015, Zn = "retainpdf.reader.ink.v1:";
function Do(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(Zn + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function Xm(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(Zn + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(Zn + e);
    } catch {
    }
}
function Ym(e, t, n, r, o, a) {
  const s = Co * Co;
  return e.filter((i) => bs(i, t, n) && i.points.some(([c, l]) => (c - r) ** 2 + ((l - o) * a) ** 2 <= s)).map((i) => i.id);
}
function bs(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function Zm(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function Qm(e) {
  const [t, n] = _(null), [r, o] = _(gs[0].key), [a, s] = _(() => Do(e)), i = A(a), c = A([]);
  O(() => {
    const h = Do(e);
    i.current = h, s(h), c.current = [];
  }, [e]);
  const l = L((h) => {
    i.current = h, s(h), Xm(e, h);
  }, [e]), u = L((h) => {
    const y = i.current, I = h(y);
    I !== y && (c.current = [...c.current.slice(-49), y], l(I));
  }, [l]), f = L((h) => {
    h.points.length < 1 || u((y) => [...y, { ...h, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [u]), d = L((h) => {
    h.length && u((y) => y.filter((I) => !h.includes(I.id)));
  }, [u]), m = L((h) => {
    u((y) => y.some((I) => I.page === h) ? y.filter((I) => I.page !== h) : y);
  }, [u]), g = L(() => {
    const h = c.current.pop();
    h && l(h);
  }, [l]);
  return U(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: d, undo: g, clearPage: m }),
    [t, r, a, f, d, g, m]
  );
}
const eh = [
  { tool: "pen", label: "画笔", Icon: gn },
  { tool: "highlighter", label: "荧光笔", Icon: Mi },
  { tool: "eraser", label: "橡皮", Icon: xi }
];
function th(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function nh({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ C(_e, { children: [
    eh.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
      X,
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
    gs.map((o) => /* @__PURE__ */ p(
      X,
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
    /* @__PURE__ */ p(X, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(Ni, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      X,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p(_i, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null,
    e.tool ? /* @__PURE__ */ p(
      X,
      {
        className: "reader-ink-tool",
        "aria-label": "退出画笔",
        title: "退出画笔（Esc）",
        "data-ink-exit": "true",
        onClick: () => {
          e.setTool(null), r();
        },
        children: /* @__PURE__ */ p(bt, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function $o({ ink: e, page: t, onPick: n }) {
  return /* @__PURE__ */ p("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ p(nh, { ink: e, page: t, onPick: n }) });
}
function rh(e) {
  const t = A(e);
  t.current = e, O(() => {
    const n = (r) => {
      if (th(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
const oh = "reader-ink-layer";
function ah(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function Oo({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: ah(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function sh({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = _(null), i = A(!1), c = o.strokes.filter((h) => bs(h, e, t)), l = !!o.tool;
  if (!l && !c.length) return null;
  const u = (h) => {
    const y = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - y.left) / Math.max(1, y.width))),
      Math.min(1, Math.max(0, (h.clientY - y.top) / Math.max(1, y.height)))
    ];
  }, f = (h, y) => o.erase(Ym(o.strokes, e, t, h, y, r / Math.max(1, n))), d = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [y, I] = u(h);
    o.tool === "eraser" ? f(y, I) : s([[y, I]]);
  }, m = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [y, I] = u(h);
    o.tool === "eraser" ? f(y, I) : s((S) => S ? Zm(S, y, I) : [[y, I]]);
  }, g = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: Lo[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ C(
    "svg",
    {
      className: oh,
      "data-ink-active": l ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: d,
      onPointerMove: m,
      onPointerUp: g,
      onPointerCancel: g,
      children: [
        c.map((h) => /* @__PURE__ */ p(Oo, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(Oo, { stroke: { tool: o.tool, color: o.color, width: Lo[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
const ih = [
  { keys: "P", desc: "进入 / 退出画笔（书页上右键也能选笔和颜色）" },
  { keys: "Esc", desc: "退出画笔" },
  { keys: "⌘Z / Ctrl+Z", desc: "画笔模式下撤销" }
];
function ch(e) {
  return {
    toolbarItems: [{
      key: "ink",
      label: "画笔",
      title: "画笔（P；书页上右键也能选笔和颜色）",
      Icon: gn,
      // 钢笔图标，右下角一个当前笔色的小点（2026-11-28：两条栏只用图标，单一个圆点认不出是画笔）。
      mark: /* @__PURE__ */ C("span", { className: "reader-ink-mark", "aria-hidden": !0, children: [
        /* @__PURE__ */ p(gn, { ...Re }),
        /* @__PURE__ */ p("span", { className: "reader-ink-dot", style: { background: `var(--${e.color})` } })
      ] }),
      place: "bottom",
      pressed: !!e.tool,
      onClick: () => e.setTool(e.tool ? null : "pen"),
      dropdown: (t) => /* @__PURE__ */ p($o, { ink: e, onPick: t })
    }],
    menuSection: ({ page: t, close: n }) => /* @__PURE__ */ p($o, { ink: e, page: t, onPick: n }),
    // 离视口远的页只是占位，笔迹先不画（和以前一样只画 active 的页）。
    pageLayer: ({ page: t, pane: n, width: r, height: o, active: a }) => a ? /* @__PURE__ */ p(sh, { page: t, pane: n, width: r, height: o, ink: e }) : null,
    takesPointer: !!e.tool,
    shortcuts: ih
  };
}
function lh() {
  const e = Lt(), t = Qm(e.resetKey);
  rh(t);
  const n = U(() => ch(t), [t]);
  return rn(n), null;
}
const uh = { id: "ink", title: "画笔", Component: lh };
function dh(e) {
  const t = A(!1);
  return e && (t.current = !0), t.current;
}
const fh = ha(() => import("./ReaderMarkdownPanel-C63MnvOY.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), ys = { id: "markdown", label: "Markdown", short: "MD", Icon: Ai, needsJob: !0 };
function mh() {
  const e = Lt(), t = e.activePanel === ys.id;
  if (!dh(t)) return null;
  const r = /* @__PURE__ */ p(ma, { fallback: null, children: /* @__PURE__ */ p(fh, { open: t, jobId: e.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: e.closePanel }) });
  return e.panelHost ? Ui(r, e.panelHost) : r;
}
const hh = {
  id: "markdown",
  title: "Markdown",
  Component: mh,
  panels: [ys]
}, vs = "reader-xref", Qn = "data-xref", jt = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, ph = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${jt})`), gh = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function er(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function bh(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function yh(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function vh(e, t, n) {
  const r = e[t], o = (i) => {
    if (!i || i.source.page !== r.source.page) return !1;
    const c = Le(i);
    return c === "figure" || c === "table" || c === "formula";
  }, a = (i) => {
    const c = [];
    for (let l = t + i; o(e[l]) && c.length < 40; l += i) c.push(e[l]);
    return i < 0 ? c.reverse() : c;
  }, s = a(n === "table" ? 1 : -1);
  return s.length ? s : a(n === "table" ? -1 : 1);
}
function wh(e, t, n) {
  return (e.find((o) => Le(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function Sh(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = Le(r), s = yh(r);
    if (a === "formula") {
      for (const g of s.matchAll(gh)) {
        const h = er(g[1]);
        h && n({ key: `equation:${h}`, kind: "equation", label: h, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = ph.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const l = bh(i[1]), u = er(i[2]), f = vh(e, o, l), d = [...f.map((g) => g.itemId), r.itemId], m = new Map(e.map((g, h) => [g.itemId, h]));
    d.sort((g, h) => (m.get(g) ?? 0) - (m.get(h) ?? 0)), n({ key: `${l}:${u}`, kind: l, label: u, itemId: wh(f, r, l), itemIds: d, captionId: r.itemId });
  }), t;
}
const Ih = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${jt})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${jt})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${jt})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${jt})\s*[）)]`, "g"), kind: () => "equation" }
];
function Th(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of Ih) {
    o.lastIndex = 0;
    for (const s of e.matchAll(o)) {
      const i = s.length > 2 ? s[1] : "", c = er(s[s.length - 1]), l = `${a(i)}:${c}`;
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
function kh(e, t) {
  return Th(e, t).map((n) => ({ start: n.start, end: n.end, className: vs, attrs: { [Qn]: n.key } }));
}
const Eh = { figure: "图", table: "表", equation: "式" };
function zo(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${Eh[e.kind]} ${e.label}`;
}
const Fo = { figure: "图", table: "表", formula: "公式", text: "文字" }, nt = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function Rh(e, t, n) {
  const r = ft(e, t, n), o = r ? ct(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = ds({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function Ph(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, c = null;
  for (const u of e) {
    const f = ft(u, t, n), d = f ? ct(f, 1, 1) : null;
    !f || !d || (r || (r = f.box.page, c = f.pageSize), f.box.page === r && (o = Math.min(o, d.left), a = Math.min(a, d.top), s = Math.max(s, d.left + d.width), i = Math.max(i, d.top + d.height)));
  }
  if (!r || !c) return null;
  const l = ds({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: l, aspect: l.height * c.height / Math.max(1e-6, l.width * c.width) };
}
function Mh(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function xh(e, t) {
  const n = (o) => {
    const a = Le(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function Nh({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var $;
  const i = t.find((N) => N.itemId === e) ?? null, c = U(() => i ? xh(t, i) : [], [t, i]), l = i ? c.indexOf(i) : -1, [u, f] = _(nt.indexOf(1)), d = nt[u], m = A(null), [g, h] = _(0);
  Ae(() => {
    const N = m.current;
    if (!N) return;
    const k = () => h(N.clientWidth);
    k();
    const T = typeof ResizeObserver == "function" ? new ResizeObserver(k) : null;
    return T == null || T.observe(N), () => T == null ? void 0 : T.disconnect();
  }, []);
  const y = L((N) => {
    const k = c[l + N];
    k && a(k.itemId);
  }, [c, l, a]);
  O(() => {
    const N = (k) => {
      if (k.key === "Escape")
        k.preventDefault(), s();
      else if (k.key === "ArrowLeft")
        k.preventDefault(), y(-1);
      else if (k.key === "ArrowRight")
        k.preventDefault(), y(1);
      else if (k.key === "+" || k.key === "=")
        k.preventDefault(), f((T) => Math.min(nt.length - 1, T + 1));
      else if (k.key === "-" || k.key === "_")
        k.preventDefault(), f((T) => Math.max(0, T - 1));
      else if (k.key === "0")
        k.preventDefault(), f(nt.indexOf(1));
      else
        return;
      k.stopPropagation();
    };
    return window.addEventListener("keydown", N, !0), () => window.removeEventListener("keydown", N, !0);
  }, [s, y]), O(() => {
    const N = m.current;
    if (!N) return;
    const k = (T) => {
      !T.ctrlKey && !T.metaKey || (T.preventDefault(), f((R) => Math.max(0, Math.min(nt.length - 1, R + (T.deltaY < 0 ? 1 : -1)))));
    };
    return N.addEventListener("wheel", k, { passive: !1 }), () => N.removeEventListener("wheel", k);
  }, []);
  const I = A(null);
  if (!i) return null;
  const S = Le(i), b = o.map((N) => ({ pane: N, pdf: r[N] ?? null, where: Rh(i, n, N) })).filter((N) => !!(N.pdf && N.where)), w = 16, v = typeof window > "u" ? 800 : window.innerHeight, P = Math.min(880, v * 0.9) - 56 - 32 - (b.length > 1 ? 26 : 0), M = b.length ? Mh(Math.max(120, (g - w * (b.length - 1) - 32) / b.length), P, b.map((N) => N.where.aspect)) : 0, E = (($ = b[0]) == null ? void 0 : $.where.page) ?? i.source.page;
  return /* @__PURE__ */ C("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${Fo[S] ?? "这一块"}`, children: [
    /* @__PURE__ */ p("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ C("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ C("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ C("span", { className: "reader-zoom-title", children: [
          Fo[S] ?? "这一块",
          " · 第 ",
          E,
          " 页"
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-zoom-count", children: l >= 0 ? `${l + 1} / ${c.length}` : "" }),
        /* @__PURE__ */ C("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: l <= 0, onClick: () => y(-1), children: /* @__PURE__ */ p(ba, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: l < 0 || l >= c.length - 1, onClick: () => y(1), children: /* @__PURE__ */ p(ka, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => f((N) => Math.max(0, N - 1)), children: /* @__PURE__ */ p(Ea, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ C(X, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => f(nt.indexOf(1)), children: [
            Math.round(d * 100),
            "%"
          ] }),
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === nt.length - 1, onClick: () => f((N) => Math.min(nt.length - 1, N + 1)), children: /* @__PURE__ */ p(Ra, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: s, children: /* @__PURE__ */ p(bt, { size: 16, "aria-hidden": !0 }) })
        ] })
      ] }),
      /* @__PURE__ */ p(
        "div",
        {
          ref: m,
          className: "reader-zoom-body",
          onPointerDown: (N) => {
            const k = m.current;
            !k || N.button !== 0 || (I.current = { x: N.clientX, y: N.clientY, left: k.scrollLeft, top: k.scrollTop }, k.setPointerCapture(N.pointerId));
          },
          onPointerMove: (N) => {
            const k = m.current, T = I.current;
            !k || !T || (k.scrollLeft = T.left - (N.clientX - T.x), k.scrollTop = T.top - (N.clientY - T.y));
          },
          onPointerUp: () => {
            I.current = null;
          },
          children: b.length && g ? /* @__PURE__ */ p("div", { className: "reader-zoom-columns", style: { gap: w }, children: b.map(({ pane: N, pdf: k, where: T }) => /* @__PURE__ */ C("figure", { className: "reader-zoom-column", children: [
            b.length > 1 ? /* @__PURE__ */ p("figcaption", { children: N === "source" ? "原文" : "译文" }) : null,
            /* @__PURE__ */ p(
              ms,
              {
                className: "reader-zoom-canvas",
                pdf: k,
                page: T.page,
                region: T.fraction,
                cssWidth: M * d,
                label: `${N === "source" ? "原文" : "译文"}第 ${T.page} 页`
              }
            )
          ] }, N)) }) : /* @__PURE__ */ p("p", { className: "reader-zoom-empty", children: g ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
const _h = 380, Ah = 320, St = 8;
function Lh(e, t, n) {
  const r = Math.max(St, Math.min(e.left, n.width - t.width - St)), o = e.bottom + St, a = o + t.height <= n.height - St ? o : Math.max(St, e.top - St - t.height);
  return { left: r, top: a };
}
function Ch({
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
    const m = r[d], g = m ? Ph(o, n, d) : null;
    if (m && g) {
      s = { pdf: m, where: g };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min(_h, Ah / Math.max(0.05, s.where.aspect))), c = Math.round(i * s.where.aspect) + 30, l = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: f } = Lh(e.anchor, { width: Math.max(i, 160) + 16, height: c + 16 }, l);
  return /* @__PURE__ */ C("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: f }, children: [
    /* @__PURE__ */ C("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ p("span", { children: zo(e.target) }),
      /* @__PURE__ */ C("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ p(ms, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: zo(e.target) })
  ] });
}
const Dh = 250;
function $h(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function Oh(e, t, n) {
  const r = n === "back" ? e.back : e.forward;
  if (!r.length) return null;
  const o = r[r.length - 1], a = r.slice(0, -1), s = n === "back" ? { back: a, forward: [...e.forward, t] } : { back: [...e.back, t], forward: a };
  return { to: o, history: s };
}
function zh(e) {
  var n;
  const t = e;
  return !!((n = t == null ? void 0 : t.closest) != null && n.call(t, "input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
function Fh({
  shellEl: e,
  index: t,
  primaryPane: n,
  follow: r
}) {
  const [o, a] = _(null), [s, i] = _({ back: [], forward: [] }), c = A(s);
  c.current = s;
  const l = A(null), u = A({ index: t, primaryPane: n, follow: r, shellEl: e });
  u.current = { index: t, primaryPane: n, follow: r, shellEl: e };
  const f = L(() => {
    const { shellEl: m, primaryPane: g } = u.current;
    return Wt(m, g);
  }, []);
  O(() => {
    if (!e) return;
    const m = (b) => {
      var w, v;
      return (v = (w = b.target) == null ? void 0 : w.closest) == null ? void 0 : v.call(w, `.${vs}`);
    }, g = () => {
      l.current != null && window.clearTimeout(l.current), l.current = null;
    }, h = (b) => {
      var M;
      const w = m(b);
      if (!w) return;
      const v = u.current.index.get(w.getAttribute(Qn) || "");
      if (!v) return;
      const P = ((M = w.closest("[data-reader-pane]")) == null ? void 0 : M.getAttribute("data-reader-pane")) || u.current.primaryPane;
      g(), l.current = window.setTimeout(() => {
        const E = w.getBoundingClientRect();
        a({ target: v, pane: P, anchor: { left: E.left, top: E.top, right: E.right, bottom: E.bottom } });
      }, Dh);
    }, y = (b) => {
      const w = m(b);
      !w || w.contains(b.relatedTarget) || (g(), a(null));
    }, I = (b) => {
      var E, $;
      const w = m(b);
      if (!w || b.button !== 0 || b.metaKey || b.ctrlKey || b.shiftKey || `${((E = window.getSelection) == null ? void 0 : E.call(window)) || ""}`.trim()) return;
      const v = u.current.index.get(w.getAttribute(Qn) || "");
      if (!v) return;
      b.preventDefault(), b.stopPropagation(), g(), a(null);
      const P = (($ = w.closest("[data-reader-pane]")) == null ? void 0 : $.getAttribute("data-reader-pane")) || u.current.primaryPane, M = f();
      M && i((N) => $h(N, M)), u.current.follow(v, P);
    }, S = () => {
      g(), a(null);
    };
    return e.addEventListener("pointerover", h), e.addEventListener("pointerout", y), e.addEventListener("click", I, !0), e.addEventListener("scroll", S, { passive: !0 }), () => {
      g(), e.removeEventListener("pointerover", h), e.removeEventListener("pointerout", y), e.removeEventListener("click", I, !0), e.removeEventListener("scroll", S);
    };
  }, [e, f]);
  const d = L((m) => {
    const g = f();
    if (!g) return !1;
    const h = Oh(c.current, g, m);
    if (!h) return !1;
    const { shellEl: y, primaryPane: I } = u.current;
    return Nt(y, h.to, "auto", I) ? (i(h.history), !0) : !1;
  }, [f]);
  return O(() => {
    const m = (g) => {
      if (!g.altKey || g.metaKey || g.ctrlKey || g.shiftKey || g.defaultPrevented || g.key !== "ArrowLeft" && g.key !== "ArrowRight" || zh(g.target)) return;
      d(g.key === "ArrowLeft" ? "back" : "forward") && g.preventDefault();
    };
    return window.addEventListener("keydown", m), () => window.removeEventListener("keydown", m);
  }, [d]), {
    preview: o,
    closePreview: L(() => a(null), []),
    canGoBack: s.back.length > 0,
    backPage: s.back.length ? s.back[s.back.length - 1].page : null,
    goBack: L(() => d("back"), [d])
  };
}
const Bh = [
  { keys: "Alt+←", desc: "点了引用跳过去以后，回到原处" },
  { keys: "Alt+→", desc: "再跳回去" }
];
function Hh() {
  const e = Lt(), t = U(() => Sh(e.regions), [e.regions]), { jumpToBlock: n } = e, r = L((s, i) => n(s.itemId, i), [n]), o = Fh({ shellEl: e.shellEl, index: t, primaryPane: e.primaryPane, follow: r }), a = U(() => ({
    // 书里一个认得出去处的引用都没有，就不改文字层（react-pdf 照原样画，不多一遍 innerHTML）。
    textMarks: t.size ? (s) => kh(s, t) : void 0,
    shortcuts: Bh
  }), [t]);
  return rn(a), /* @__PURE__ */ C(_e, { children: [
    o.preview ? /* @__PURE__ */ p(Ch, { preview: o.preview, regions: e.regions, metadata: e.metadata, documents: e.pdfDocuments }) : null,
    o.canGoBack ? /* @__PURE__ */ C(X, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => o.goBack(), children: [
      /* @__PURE__ */ p(Li, { size: 14, "aria-hidden": !0 }),
      " 回到第 ",
      o.backPage,
      " 页"
    ] }) : null
  ] });
}
const jh = { id: "xrefs", title: "引用（「图 2.1」「式 (3.21)」）", Component: Hh }, Tr = [uh, hh, jm, jh, Lm, Gm];
function kr(e = Tr) {
  return e.flatMap((t) => (t.panels ?? []).map(({ id: n, label: r, short: o, Icon: a, needsJob: s }) => ({ id: n, label: r, short: o, Icon: a, needsJob: s })));
}
function Uh(e) {
  const t = Fe(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(_e, { children: (e.tabs ?? kr()).map(({ id: s, label: i, Icon: c, needsJob: l }) => {
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
        children: /* @__PURE__ */ p(c, { className: "reader-close-home-icon", ...Re, "aria-hidden": !0 })
      },
      s
    );
  }) });
}
function Wh(e) {
  const t = Fe(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = kr().map(({ id: c, label: l, short: u, Icon: f, needsJob: d }) => ({
    key: c,
    label: l,
    short: u,
    Icon: f,
    disabled: d && o,
    selected: n === c,
    badge: r == null ? void 0 : r[c],
    onClick: () => a(c)
  }));
  return n ? /* @__PURE__ */ C("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ p("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: c, label: l, Icon: u, disabled: f, selected: d, badge: m, onClick: g }) => /* @__PURE__ */ C(
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
        children: /* @__PURE__ */ p(bt, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function Kh(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Vh(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function qh(e) {
  return e / 100 * window.innerHeight;
}
function Jh(e) {
  return e / 100 * window.innerWidth;
}
function Gh(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function Ut({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = Gh(n);
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
      r = Vh(t, o);
      break;
    }
    case "em": {
      r = Kh(t, o);
      break;
    }
    case "vh": {
      r = qh(o);
      break;
    }
    case "vw": {
      r = Jh(o);
      break;
    }
  }
  return r;
}
function Ne(e) {
  return parseFloat(e.toFixed(3));
}
function _t({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function tr(e) {
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
      const u = Ut({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = Ne(u / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const u = Ut({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = Ne(u / n * 100);
    }
    let c = 0;
    if (a.minSize !== void 0) {
      const u = Ut({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      c = Ne(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = Ut({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      l = Ne(u / n * 100);
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
function he(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function nr(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? Xh : Yh
  );
}
function Xh(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function Yh(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function ws(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Ss(e, t) {
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
function Zh({
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
    const { x: i, y: c } = Ss(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return he(o, "No rect found"), o;
}
let dn;
function Qh() {
  return dn === void 0 && (typeof matchMedia == "function" ? dn = !!matchMedia("(pointer:coarse)").matches : dn = !1), dn;
}
function Is(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = nr(
    n,
    Array.from(t.children).filter(ws).map((g) => ({ element: g }))
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
                  const P = m[0], M = Zh({
                    orientation: n,
                    rects: [I, S],
                    targetRect: P.element.getBoundingClientRect()
                  });
                  b = [
                    P,
                    M === I ? v : w
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
              const P = Qh() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (v.width < P) {
                const E = P - v.width;
                v = new DOMRect(
                  v.x - E / 2,
                  v.y,
                  v.width + E,
                  v.height
                );
              }
              if (v.height < P) {
                const E = P - v.height;
                v = new DOMRect(
                  v.x,
                  v.y - E / 2,
                  v.width,
                  v.height + E
                );
              }
              const M = g <= l || g > u;
              !i && !M && s.push({
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
var ot;
class Ts {
  constructor() {
    Kr(this, ot, {});
  }
  addListener(t, n) {
    const r = Ct(this, ot)[t];
    return r === void 0 ? Ct(this, ot)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = Ct(this, ot)[t];
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
    Vr(this, ot, {});
  }
  removeListener(t, n) {
    const r = Ct(this, ot)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
ot = new WeakMap();
let Pt = {
  cursorFlags: 0,
  state: "inactive"
};
const Er = new Ts();
function ht() {
  return Pt;
}
function ep(e) {
  return Er.addListener("change", e);
}
function tp(e) {
  const t = Pt, n = { ...Pt };
  n.cursorFlags = e, Pt = n, Er.emit("change", {
    prev: t,
    next: n
  });
}
function Mt(e) {
  const t = Pt;
  Pt = e, Er.emit("change", {
    prev: t,
    next: e
  });
}
const np = (e) => e, Fn = () => {
}, ks = 1, Es = 2, Rs = 4, Ps = 8, Bo = 3, Ho = 12;
let fn;
function jo() {
  return fn === void 0 && (fn = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (fn = !0)), fn;
}
function rp({
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
        if (e && jo()) {
          const a = (e & ks) !== 0, s = (e & Es) !== 0, i = (e & Rs) !== 0, c = (e & Ps) !== 0;
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
    return jo() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const Uo = /* @__PURE__ */ new WeakMap();
function Rr(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = Uo.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = ht();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = rp({
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
  Uo.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let je = /* @__PURE__ */ new Map();
const Ms = new Ts();
function op(e) {
  je = new Map(je), je.delete(e);
}
function Wo(e, t) {
  for (const [n] of je)
    if (n.id === e)
      return n;
}
function st(e, t) {
  for (const [n, r] of je)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function yt() {
  return je;
}
function Pr(e, t) {
  return Ms.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Xe(e, t, n) {
  const r = je.get(e);
  je = new Map(je), je.set(e, t), Ms.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function xs(e) {
  const t = ht();
  let n = !1;
  switch (t.state) {
    case "active":
      Mt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (Rr(e), n = !0, t.hitRegions.forEach((r) => {
        const o = st(r.group.id, !0);
        Xe(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function Ko(e) {
  e.defaultPrevented || xs(e.currentTarget);
}
function ap(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Ss(n, a.rect);
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
function sp(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function ip(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: Jo(e),
    b: Jo(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  he(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: qo(Vo(n.a)),
    b: qo(Vo(n.b))
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
const cp = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function lp(e) {
  const t = getComputedStyle(Ns(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function up(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || lp(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || cp.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function Vo(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (he(n, "Missing node"), up(n)) return n;
  }
  return null;
}
function qo(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Jo(e) {
  const t = [];
  for (; e; )
    t.push(e), e = Ns(e);
  return t;
}
function Ns(e) {
  const { parentNode: t } = e;
  return sp(t) ? t.host : t;
}
function dp(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function fp({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!ws(n) || n.contains(e) || e.contains(n))
    return !0;
  if (ip(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (dp(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function Mr(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = Is(o), s = ap(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && fp({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function mp(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function Me(e, t, n = 0) {
  return Math.abs(Ne(e) - Ne(t)) <= n;
}
function He(e, t) {
  return Me(e, t) ? 0 : e > t ? 1 : -1;
}
function Et({
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
  if (He(r, c) < 0)
    if (a) {
      const l = (o + c) / 2;
      He(r, l) < 0 ? r = o : r = c;
    } else
      r = c;
  return r = Math.min(i, r), r = Ne(r), r;
}
function Xt({
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
  he(u != null, "Invalid first pivot index"), he(f != null, "Invalid second pivot index");
  let d = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? f : u, y = n[h];
        he(
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
          if (he(
            w != null,
            `Previous layout not found for panel index ${h}`
          ), Me(w, I)) {
            const v = b - w;
            He(v, Math.abs(e)) > 0 && (e = e < 0 ? 0 - v : v);
          }
        }
      }
      {
        const h = e < 0 ? u : f, y = n[h];
        he(
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
          if (he(
            w != null,
            `Previous layout not found for panel index ${h}`
          ), Me(w, b)) {
            const v = w - I;
            He(v, Math.abs(e)) > 0 && (e = e < 0 ? 0 - v : v);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? f : u, y = n[h];
      he(
        y,
        `Panel constraints not found for index ${h}`
      );
      const I = i[h], { collapsible: S, collapsedSize: b, minSize: w } = y;
      if (S && He(I, w) < 0)
        if (e > 0) {
          const v = w - b, P = v / 2, M = I + e;
          He(M, w) < 0 && (e = He(e, P) <= 0 ? 0 : v);
        } else {
          const v = w - b, P = 100 - v / 2, M = I - e;
          He(M, w) < 0 && (e = He(100 + e, P) > 0 ? 0 : -v);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let y = e < 0 ? f : u, I = 0;
    for (; ; ) {
      const b = i[y];
      he(
        b != null,
        `Previous layout not found for panel index ${y}`
      );
      const w = Et({
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
      he(
        I != null,
        `Previous layout not found for panel index ${h}`
      );
      const S = I - y, b = Et({
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
  if (mp(c, l))
    return o;
  {
    const h = e < 0 ? f : u, y = i[h];
    he(
      y != null,
      `Previous layout not found for panel index ${h}`
    );
    const I = y + d, S = Et({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: y,
      size: I
    });
    if (l[h] = S, !Me(S, I)) {
      let b = I - S, w = e < 0 ? f : u;
      for (; w >= 0 && w < n.length; ) {
        const v = l[w];
        he(
          v != null,
          `Previous layout not found for panel index ${w}`
        );
        const P = v + b, M = Et({
          overrideDisabledPanels: s,
          panelConstraints: n[w],
          prevSize: v,
          size: P
        });
        if (Me(v, M) || (b -= M - v, l[w] = M), Me(b, 0))
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
function pt(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || He(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function gt({
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
      he(c != null, `No layout data found for index ${i}`);
      const l = 100 / o * c;
      r[i] = l;
    }
  let a = 0;
  for (let i = 0; i < t.length; i++) {
    const c = n[i];
    he(c != null, `No layout data found for index ${i}`);
    const l = r[i];
    he(l != null, `No layout data found for index ${i}`);
    const u = Et({
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
      he(c != null, `No layout data found for index ${i}`);
      const l = c + a, u = Et({
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
function _s({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const c = yt();
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
        [t]: Ne(100 - y)
      };
    }
    return Xt({
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
    }), I = gt({
      layout: y,
      panelConstraints: f
    });
    pt(g, I) || Xe(d, {
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
      const { group: l } = n(), { element: u } = o(), f = _t({ group: l }), d = Ut({
        groupSize: f,
        panelElement: u,
        styleProp: c
      }), m = Ne(d / f * 100);
      i(m);
    }
  };
}
function Go(e) {
  if (e.defaultPrevented)
    return;
  const t = yt();
  Mr(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = _s({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function mn(e) {
  const t = yt();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function As({
  groupId: e
}) {
  const t = () => {
    const n = yt();
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
      } = t(), l = gt({
        layout: n,
        panelConstraints: o
      });
      return r ? i : (pt(i, l) || Xe(a, {
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
  const n = mn(e), r = st(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  he(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  he(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), i = As({ groupId: n.id }).getLayout(), c = Xt({
    delta: t,
    initialLayout: i,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: i,
    trigger: "keyboard"
  }), l = gt({
    layout: c,
    panelConstraints: r.derivedPanelConstraints
  });
  pt(i, l) || Xe(
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
function Xo(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = mn(t);
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
        const r = mn(t), o = st(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, c = r.separators.find(
          (d) => d.element === t
        );
        he(c, "Matching separator not found");
        const l = i.get(c);
        he(l, "Matching panels not found");
        const u = l[0], f = a.find(
          (d) => d.panelId === u.id
        );
        if (he(f, "Panel metadata not found"), f.collapsible) {
          const d = s[u.id], m = f.collapsedSize === d ? r.mutableState.expandedPanelSizes[u.id] ?? f.minSize : f.collapsedSize;
          lt(t, m - d);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = mn(t).separators.map(
          (s) => s.element
        ), o = Array.from(r).findIndex(
          (s) => s === e.currentTarget
        );
        he(o !== null, "Index not found");
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
function Yo(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = yt(), n = Mr(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), Mt({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function Ls({
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
      separatorToPanels: P
    } = I;
    if (b && v && P) {
      const M = Xt({
        delta: h,
        initialLayout: y,
        panelConstraints: b,
        pivotIndices: l.panels.map((E) => m.indexOf(E)),
        prevLayout: v,
        trigger: "mouse-or-touch"
      });
      if (pt(M, v)) {
        if (h !== 0 && !g)
          switch (d) {
            case "horizontal": {
              i |= h < 0 ? ks : Es;
              break;
            }
            case "vertical": {
              i |= h < 0 ? Rs : Ps;
              break;
            }
          }
      } else
        Xe(l.group, {
          defaultLayoutDeferred: S,
          derivedPanelConstraints: b,
          groupSize: w,
          layout: M,
          separatorToPanels: P
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & Bo : c |= i & Bo, t.movementY === 0 ? c |= s & Ho : c |= i & Ho, tp(c), Rr(e);
}
function Zo(e) {
  const t = yt(), n = ht();
  switch (n.state) {
    case "active":
      Ls({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function Qo(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = ht(), n = yt();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        Mt({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = st(a.group.id, !0);
          Xe(a.group, s, {
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
      Ls({
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
      const a = Mr(e, n);
      a.length === 0 ? t.state !== "inactive" && Mt({
        cursorFlags: 0,
        state: "inactive"
      }) : Mt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), Rr(e.currentTarget);
      break;
    }
  }
}
function ea(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (ht().state) {
      case "hover":
        Mt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function ta(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || xs(e.currentTarget) && e.preventDefault();
}
function na(e) {
  let t = 0, n = 0;
  const r = {};
  for (const a of e)
    if (a.defaultSize !== void 0) {
      t++;
      const s = Ne(a.defaultSize);
      n += s, r[a.panelId] = s;
    } else
      r[a.panelId] = void 0;
  const o = e.length - t;
  if (o !== 0) {
    const a = Ne((100 - n) / o);
    for (const s of e)
      s.defaultSize === void 0 && (r[s.panelId] = a);
  }
  return r;
}
function hp(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((c) => c.element === t);
  if (!r || !r.onResize)
    return;
  const o = _t({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: Ne(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function pp(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function gp({
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
        const m = d / 100 * n, g = Ne(
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
      u[f] = Ne(
        d / a * l
      );
    }
  else {
    const f = Ne(
      l / c.length
    );
    for (const d of c)
      u[d] = f;
  }
  return u;
}
function bp(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const It = /* @__PURE__ */ new Map();
function yp(e) {
  let t = !0;
  he(
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
          const b = st(e.id);
          if (!b)
            return;
          const w = tr(e), v = b.defaultLayoutDeferred ? na(w) : b.layout, P = gp({
            group: e,
            nextGroupSize: S,
            prevGroupSize: b.groupSize,
            prevLayout: v
          }), M = gt({
            layout: P,
            panelConstraints: w
          });
          if (!b.defaultLayoutDeferred && pt(b.layout, M) && pp(
            b.derivedPanelConstraints,
            w
          ) && b.groupSize === S)
            return;
          Xe(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: w,
            groupSize: S,
            layout: M,
            separatorToPanels: b.separatorToPanels
          });
        }
      } else
        hp(e, I, y);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    he(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = _t({ group: e }), i = tr(e), c = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (bp(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[c] ?? l ?? na(i), f = gt({
    layout: u,
    panelConstraints: i
  }), d = e.element.ownerDocument;
  It.set(
    d,
    (It.get(d) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return Is(e).forEach((g) => {
    g.separator && m.set(g.separator, g.panels);
  }), Xe(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: m
  }), e.separators.forEach((g) => {
    he(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", Xo);
  }), It.get(d) === 1 && (d.addEventListener("contextmenu", Ko, !0), d.addEventListener("dblclick", Go, !0), d.addEventListener("pointerdown", Yo, !0), d.addEventListener("pointerleave", Zo), d.addEventListener("pointermove", Qo), d.addEventListener("pointerout", ea), d.addEventListener("pointerup", ta, !0)), function() {
    t = !1, It.set(
      d,
      Math.max(0, (It.get(d) ?? 0) - 1)
    ), op(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", Xo);
    }), It.get(d) || (d.removeEventListener(
      "contextmenu",
      Ko,
      !0
    ), d.removeEventListener(
      "dblclick",
      Go,
      !0
    ), d.removeEventListener(
      "pointerdown",
      Yo,
      !0
    ), d.removeEventListener("pointerleave", Zo), d.removeEventListener("pointermove", Qo), d.removeEventListener("pointerout", ea), d.removeEventListener("pointerup", ta, !0)), a.disconnect();
  };
}
function vp() {
  const [e, t] = _({}), n = L(() => t({}), []);
  return [e, n];
}
function xr(e) {
  const t = pa();
  return `${e ?? t}`;
}
const vt = typeof window < "u" ? Ae : O;
function Kt(e) {
  const t = A(e);
  return vt(() => {
    t.current = e;
  }, [e]), L(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function Nr(...e) {
  return Kt((t) => {
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
function _r(e) {
  const t = A({ ...e });
  return vt(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const Cs = en(null);
function wp(e, t) {
  const n = A({
    getLayout: () => ({}),
    setLayout: np
  });
  ur(t, () => n.current, []), vt(() => {
    Object.assign(
      n.current,
      As({ groupId: e })
    );
  });
}
function Ds({
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
  const g = A({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), h = Kt((k) => {
    pt(g.current.onLayoutChange, k) || (g.current.onLayoutChange = k, c == null || c(k));
  }), y = Kt(
    (k, T) => {
      pt(g.current.onLayoutChanged, k) || (g.current.onLayoutChanged = k, l == null || l(k, { isUserInteraction: T }));
    }
  ), I = xr(i), S = A(null), [b, w] = vp(), v = A({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), P = Nr(S, a);
  wp(I, s);
  const M = Kt(
    (k, T) => {
      const R = ht(), D = Wo(k), z = st(k);
      if (z) {
        let K = !1;
        switch (R.state) {
          case "active": {
            K = R.hitRegions.some(
              (j) => j.group === D
            );
            break;
          }
        }
        return {
          flexGrow: z.layout[T] ?? 1,
          pointerEvents: K ? "none" : void 0
        };
      }
      if (n != null && n[T])
        return {
          flexGrow: n == null ? void 0 : n[T]
        };
    }
  ), E = _r({
    defaultLayout: n,
    disableCursor: r
  }), $ = U(
    () => ({
      get disableCursor() {
        return !!E.disableCursor;
      },
      getPanelStyles: M,
      id: I,
      orientation: u,
      registerPanel: (k) => {
        const T = v.current;
        return T.panels = nr(u, [
          ...T.panels,
          k
        ]), w(), () => {
          T.panels = T.panels.filter(
            (R) => R !== k
          ), w();
        };
      },
      registerSeparator: (k) => {
        const T = v.current;
        return T.separators = nr(u, [
          ...T.separators,
          k
        ]), w(), () => {
          T.separators = T.separators.filter(
            (R) => R !== k
          ), w();
        };
      },
      updatePanelProps: (k, { disabled: T }) => {
        const R = v.current.panels.find(
          (K) => K.id === k
        );
        R && (R.panelConstraints.disabled = T);
        const D = Wo(I), z = st(I);
        D && z && Xe(D, {
          ...z,
          derivedPanelConstraints: tr(D)
        });
      },
      updateSeparatorProps: (k, {
        disabled: T,
        disableDoubleClick: R
      }) => {
        const D = v.current.separators.find(
          (z) => z.id === k
        );
        D && (D.disabled = T, D.disableDoubleClick = R);
      }
    }),
    [M, I, w, u, E]
  ), N = A(null);
  return vt(() => {
    const k = S.current;
    if (k === null)
      return;
    const T = v.current;
    let R;
    if (E.defaultLayout !== void 0 && Object.keys(E.defaultLayout).length === T.panels.length) {
      R = {};
      for (const q of T.panels) {
        const se = E.defaultLayout[q.id];
        se !== void 0 && (R[q.id] = se);
      }
    }
    const D = {
      disabled: !!o,
      element: k,
      id: I,
      mutableState: {
        defaultLayout: R,
        disableCursor: !!E.disableCursor,
        expandedPanelSizes: v.current.lastExpandedPanelSizes,
        layouts: v.current.layouts
      },
      orientation: u,
      panels: T.panels,
      resizeTargetMinimumSize: T.resizeTargetMinimumSize,
      separators: T.separators
    };
    N.current = D;
    const z = yp(D), { defaultLayoutDeferred: K, derivedPanelConstraints: j, layout: J } = st(D.id, !0);
    !K && j.length > 0 && (h(J), y(J, !1));
    const oe = Pr(I, (q) => {
      const { defaultLayoutDeferred: se, derivedPanelConstraints: ke, layout: re } = q.next;
      if (se || ke.length === 0)
        return;
      const ue = D.panels.map(({ id: ie }) => ie).join(",");
      D.mutableState.layouts[ue] = re, ke.forEach((ie) => {
        if (ie.collapsible) {
          const { layout: le } = q.prev ?? {};
          if (le) {
            const B = Me(
              ie.collapsedSize,
              re[ie.panelId]
            ), W = Me(
              ie.collapsedSize,
              le[ie.panelId]
            );
            B && !W && (D.mutableState.expandedPanelSizes[ie.panelId] = le[ie.panelId]);
          }
        }
      });
      const Pe = ht().state !== "active";
      h(re), Pe && y(re, q.isUserInteraction);
    });
    return () => {
      N.current = null, z(), oe();
    };
  }, [
    o,
    I,
    y,
    h,
    u,
    b,
    E
  ]), O(() => {
    const k = N.current;
    k && (k.mutableState.defaultLayout = n, k.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(Cs.Provider, { value: $, children: /* @__PURE__ */ p(
    "div",
    {
      ...m,
      className: t,
      "data-group": !0,
      "data-testid": I,
      id: I,
      ref: P,
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
Ds.displayName = "Group";
function Ar() {
  const e = dt(Cs);
  return he(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Sp(e, t) {
  const { id: n } = Ar(), r = A({
    collapse: Fn,
    expand: Fn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Fn
  });
  ur(t, () => r.current, []), vt(() => {
    Object.assign(
      r.current,
      _s({ groupId: n, panelId: e })
    );
  });
}
function rr({
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
  const h = !!c, y = xr(c), I = _r({
    disabled: a
  }), S = A(null), b = Nr(S, s), {
    getPanelStyles: w,
    id: v,
    orientation: P,
    registerPanel: M,
    updatePanelProps: E
  } = Ar(), $ = f !== null, N = Kt(
    (D, z, K) => {
      f == null || f(D, c, K);
    }
  );
  vt(() => {
    const D = S.current;
    if (D !== null) {
      const z = {
        element: D,
        id: y,
        idIsStable: h,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: $ ? N : void 0,
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
      return M(z);
    }
  }, [
    i,
    n,
    r,
    o,
    $,
    y,
    h,
    l,
    u,
    N,
    M,
    I
  ]), O(() => {
    E(y, { disabled: a });
  }, [a, y, E]), Sp(y, d);
  const k = () => {
    const D = w(v, y);
    if (D)
      return JSON.stringify(D);
  }, T = Rn(
    (D) => Pr(v, D),
    k,
    k
  );
  let R;
  return T ? R = JSON.parse(T) : o !== void 0 ? R = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : R = { flexGrow: 1 }, /* @__PURE__ */ p(
    "div",
    {
      ...g,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": y,
      id: y,
      ref: b,
      style: {
        ...Ip,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...R
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
            touchAction: P === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
rr.displayName = "Panel";
const Ip = {
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
function Tp({
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
    a = gt({
      layout: Xt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = gt({
      layout: Xt({
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
function $s({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const c = xr(a), l = _r({
    disabled: n,
    disableDoubleClick: r
  }), [u, f] = _({}), [d, m] = _("inactive"), [g, h] = _(!1), y = A(null), I = Nr(y, o), {
    disableCursor: S,
    id: b,
    orientation: w,
    registerSeparator: v,
    updateSeparatorProps: P
  } = Ar(), M = w === "horizontal" ? "vertical" : "horizontal";
  vt(() => {
    const N = y.current;
    if (N !== null) {
      const k = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: N,
        id: c
      }, T = v(k), R = ep(
        (z) => {
          m(
            z.next.state !== "inactive" && z.next.hitRegions.some(
              (K) => K.separator === k
            ) ? z.next.state : "inactive"
          );
        }
      ), D = Pr(
        b,
        (z) => {
          const { derivedPanelConstraints: K, layout: j, separatorToPanels: J } = z.next, oe = J.get(k);
          if (oe) {
            const q = oe[0], se = oe.indexOf(q);
            f(
              Tp({
                layout: j,
                panelConstraints: K,
                panelId: q.id,
                panelIndex: se
              })
            );
          }
        }
      );
      return () => {
        R(), D(), T();
      };
    }
  }, [b, c, v, l]), O(() => {
    P(c, { disabled: n, disableDoubleClick: r });
  }, [n, r, c, P]);
  let E;
  n && !S && (E = "not-allowed");
  let $;
  if (n)
    $ = "disabled";
  else
    switch (d) {
      case "active": {
        $ = "active";
        break;
      }
      default:
        g ? $ = "focus" : $ = d;
    }
  return /* @__PURE__ */ p(
    "div",
    {
      ...i,
      "aria-controls": u.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": M,
      "aria-valuemax": u.valueMax,
      "aria-valuemin": u.valueMin,
      "aria-valuenow": u.valueNow,
      children: e,
      className: t,
      "data-separator": $,
      "data-testid": c,
      id: c,
      onBlur: () => h(!1),
      onFocus: () => h(!0),
      ref: I,
      role: "separator",
      style: {
        flexBasis: "auto",
        cursor: E,
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
$s.displayName = "Separator";
const Lr = 30, Cr = 65, Yt = 50, kp = 100 - Cr, Ep = 100 - Lr;
function Rp(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(Cr, Math.max(Lr, t)) : Yt;
}
function Dr(e) {
  return 100 - e;
}
function Tt(e) {
  return `${e}%`;
}
const $r = "reader-document", Zt = "reader-assistant", Os = "retainpdf.reader.ai-split-layout.v1", Pp = {
  [$r]: Dr(Yt),
  [Zt]: Yt
};
function Or(e) {
  const t = Rp(e == null ? void 0 : e[Zt]);
  return {
    [$r]: Dr(t),
    [Zt]: t
  };
}
function Mp() {
  try {
    const e = JSON.parse(localStorage.getItem(Os) || "null");
    return Or(e);
  } catch {
    return Pp;
  }
}
function xp(e) {
  try {
    localStorage.setItem(Os, JSON.stringify(Or(e)));
  } catch {
  }
}
function Bn(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Or(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[Zt]}vw`
  );
}
function Np() {
  const e = A(null), [t] = _(Mp);
  Ae(() => {
    const o = e.current;
    return Bn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = L((o) => {
    Bn(e.current, o);
  }, []), r = L((o, a) => {
    Bn(e.current, o), a.isUserInteraction && xp(o);
  }, []);
  return /* @__PURE__ */ C(
    Ds,
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
          rr,
          {
            id: $r,
            defaultSize: Tt(Dr(Yt)),
            minSize: Tt(kp),
            maxSize: Tt(Ep)
          }
        ),
        /* @__PURE__ */ p(
          $s,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ p("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ p(
          rr,
          {
            id: Zt,
            defaultSize: Tt(Yt),
            minSize: Tt(Lr),
            maxSize: Tt(Cr)
          }
        )
      ]
    }
  );
}
function _p({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = _(!1);
  if (O(() => {
    !e && !t && o(!1);
  }, [e, t]), r || !e && !t)
    return null;
  const a = [
    e ? "译文区域" : "",
    t ? "阅读元数据" : ""
  ].filter(Boolean);
  return /* @__PURE__ */ C("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ C("span", { className: "reader-error-notice-text", children: [
      a.join("、"),
      "加载失败，正文仍可正常阅读。"
    ] }),
    n ? /* @__PURE__ */ p(X, { className: "reader-error-notice-retry", "data-reader-retry": "optional", onClick: n, children: "重试" }) : null,
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
function Ap({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(_p, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ C(_e, { children: [
    e ? /* @__PURE__ */ p("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ C("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ p(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ C("div", { className: "reader-react-error", role: "alert", children: [
      /* @__PURE__ */ p("span", { className: "reader-react-error-text", children: n }),
      s ? /* @__PURE__ */ p(X, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function Lp(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Cp() {
  const [e, t] = _(!1), n = pa(), r = A(null), o = us(), a = U(() => [...lu, ...Hf(o)], [o]);
  return O(() => {
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
  }, [e]), O(() => {
    const s = (i) => {
      if (i.defaultPrevented || i.metaKey || i.ctrlKey || i.altKey || Lp(i.target)) return;
      const c = i.key;
      if (c === "?" || c === "h" || c === "H" || c === "/") {
        if (c === "/" && !i.shiftKey)
          return;
        i.preventDefault(), t((l) => !l);
      }
    };
    return window.addEventListener("keydown", s), () => window.removeEventListener("keydown", s);
  }, []), /* @__PURE__ */ C("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
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
        children: /* @__PURE__ */ p(Ci, { ...Re, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ C(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ C("div", { className: "reader-react-shortcuts-head", children: [
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
          /* @__PURE__ */ p("div", { className: "reader-react-shortcuts-body", children: a.map((s) => /* @__PURE__ */ C("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ p("h3", { children: s.title }),
            /* @__PURE__ */ p("ul", { children: s.items.map((i) => /* @__PURE__ */ C("li", { children: [
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
const Dp = ["source", "sideBySide", "translated"], $p = { source: "", translated: "", sideBySide: "" };
function Op(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = pn(e.sourceUrl), n = pn(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return tc({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function zp(e) {
  const [t, n] = _(() => /* @__PURE__ */ new Set()), r = U(
    () => e ? Op(e) : $p,
    [e]
  ), o = U(
    () => Dp.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = L(async (s) => {
    if (!e) return;
    const i = pn(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? ec(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await nc(
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
        rc(l), n((u) => {
          const f = new Set(u);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const Fp = {
  source: wa,
  sideBySide: Sa,
  translated: Ia
}, Bp = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function Hp(e) {
  const t = Fe(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = zp(n), i = A(null);
  return O(() => {
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
  }, []), /* @__PURE__ */ C("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ C("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ p(Di, { ...Re, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = ri[c], u = pn(r[c]), f = a.has(c), d = !!u && !f, m = d ? "" : oi(c, r), g = Fp[c];
      return /* @__PURE__ */ C(
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
            /* @__PURE__ */ p(g, { ...Re, "aria-hidden": !0 }),
            /* @__PURE__ */ C("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ C("span", { className: "reader-download-action-label", children: [
                Bp[c],
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
const jp = "retainpdf:reader:bookmarks:v1:", Up = 200;
function zr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function zs(e) {
  const t = `${e || ""}`.trim();
  return t ? `${jp}${t}` : "";
}
function Wp(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Vt(e, t = zr()) {
  const n = zs(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = Wp(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
const or = /* @__PURE__ */ new Set();
function Kp(e, t) {
  const n = (r) => {
    r === e && t();
  };
  return or.add(n), () => {
    or.delete(n);
  };
}
function ar(e, t, n) {
  const r = zs(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, Up);
  if (r && n)
    try {
      n.setItem(r, JSON.stringify(o));
    } catch {
    }
  for (const a of [...or]) a(e);
  return o;
}
function Vp(e, t, n = "", { storage: r = zr(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Vt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? ar(e, a.filter((i) => i.page !== s), r) : ar(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function qp(e, t, n = zr()) {
  return ar(e, Vt(e, n).filter((r) => r.page !== t), n);
}
function Jp(e, t) {
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
function Fs(e, t) {
  const [n, r] = _(() => Vt(e));
  O(() => (r(Vt(e)), Kp(e, () => r(Vt(e)))), [e]);
  const o = L((s) => {
    r(Vp(e, s, Jp(t, s)));
  }, [e, t]), a = L((s) => r(qp(e, s)), [e]);
  return { bookmarks: n, toggle: o, remove: a };
}
const Gp = "retainpdf:reader:favorites:v1:", Xp = 500, Fr = 2e3;
function Br() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Bs(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Gp}${t}` : "";
}
function Yp(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page)), r = `${t.text || ""}`.trim().slice(0, Fr), o = `${t.id || ""}`.trim();
  return !o || !r || !Number.isFinite(n) || n < 1 ? null : { id: o, text: r, page: n, pane: t.pane === "translated" ? "translated" : "source", createdAt: `${t.createdAt || ""}` };
}
function xt(e, t = Br()) {
  const n = Bs(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Set(), a = [];
    for (const s of Array.isArray(r) ? r : []) {
      const i = Yp(s);
      i && !o.has(i.id) && (o.add(i.id), a.push(i));
    }
    return a;
  } catch {
    return [];
  }
}
const sr = /* @__PURE__ */ new Set();
function Zp(e, t) {
  const n = (r) => {
    r === e && t();
  };
  return sr.add(n), () => {
    sr.delete(n);
  };
}
function Hs(e, t, n) {
  const r = Bs(e), o = t.slice(0, Xp);
  if (r && n)
    try {
      n.setItem(r, JSON.stringify(o));
    } catch {
    }
  for (const a of [...sr]) a(e);
  return o;
}
function Hr(e, t, n) {
  const r = `${t || ""}`.trim().slice(0, Fr);
  return e.find((o) => o.page === n && o.text === r) ?? null;
}
function js(e, t, { storage: n = Br(), now: r = () => (/* @__PURE__ */ new Date()).toISOString(), makeId: o = eg } = {}) {
  const a = xt(e, n), s = `${t.text || ""}`.trim().slice(0, Fr), i = Math.floor(Number(t.page));
  return !s || !Number.isFinite(i) || i < 1 || Hr(a, s, i) ? a : Hs(e, [{ id: o(), text: s, page: i, pane: t.pane === "translated" ? "translated" : "source", createdAt: r() }, ...a], n);
}
function Qp(e, t, n = Br()) {
  return Hs(e, xt(e, n).filter((r) => r.id !== t), n);
}
function eg() {
  var e;
  try {
    if ((e = globalThis.crypto) != null && e.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
function Us(e) {
  const [t, n] = _(() => xt(e));
  O(() => (n(xt(e)), Zp(e, () => n(xt(e)))), [e]);
  const r = L(
    (a) => n(js(e, a)),
    [e]
  ), o = L((a) => n(Qp(e, a)), [e]);
  return { favorites: t, add: r, remove: o };
}
function tg({ filled: e }) {
  return /* @__PURE__ */ p($i, { ...Re, fill: e ? "currentColor" : "none", "aria-hidden": !0 });
}
function ng({ scope: e, currentPage: t, numPages: n, regions: r }) {
  const { bookmarks: o, toggle: a } = Fs(e, r);
  if (!e || n <= 0) return null;
  const s = Math.min(Math.max(t, 1), n), i = o.some((c) => c.page === s);
  return /* @__PURE__ */ C("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", children: [
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-mark${i ? " is-marked" : ""}`,
        "aria-pressed": i,
        "aria-label": i ? `取消第 ${s} 页的书签` : `给第 ${s} 页加书签`,
        title: i ? "取消这一页的书签（书签都在左栏「书签」里）" : "给这一页加书签（书签都在左栏「书签」里）",
        onClick: () => a(s),
        children: /* @__PURE__ */ p(tg, { filled: i })
      }
    ),
    /* @__PURE__ */ p(rg, { scope: e })
  ] });
}
function rg({ scope: e }) {
  var c;
  const [t, n] = _(!1), r = A(null), { favorites: o, remove: a } = Us(e), s = (c = Fe()) == null ? void 0 : c.goToPage;
  O(() => {
    if (!t) return;
    const l = (f) => {
      var d;
      (d = r.current) != null && d.contains(f.target) || n(!1);
    }, u = (f) => {
      f.key === "Escape" && n(!1);
    };
    return document.addEventListener("pointerdown", l, !0), document.addEventListener("keydown", u), () => {
      document.removeEventListener("pointerdown", l, !0), document.removeEventListener("keydown", u);
    };
  }, [t]);
  const i = o.length;
  return /* @__PURE__ */ C("span", { className: "reader-favorites", ref: r, children: [
    /* @__PURE__ */ p(
      X,
      {
        className: "reader-react-hud-btn reader-favorites-toggle",
        "aria-expanded": t,
        "aria-haspopup": "dialog",
        "aria-label": i ? `收藏（${i} 段）` : "收藏",
        title: i ? `收藏的段落（${i} 段）` : "收藏：书页上选一段字，点浮条上的「收藏」",
        onClick: () => n((l) => !l),
        children: /* @__PURE__ */ p(Pa, { ...Re, fill: i ? "currentColor" : "none", "aria-hidden": !0 })
      }
    ),
    t ? /* @__PURE__ */ C("div", { className: "reader-favorites-card reader-floating-surface", role: "dialog", "aria-label": "收藏", children: [
      /* @__PURE__ */ C("strong", { children: [
        "收藏",
        i ? /* @__PURE__ */ p("span", { className: "reader-favorites-count", children: i }) : null
      ] }),
      i ? /* @__PURE__ */ p("ul", { className: "reader-favorites-list", children: o.map((l) => /* @__PURE__ */ C("li", { children: [
        /* @__PURE__ */ C(
          X,
          {
            className: "reader-favorites-jump",
            title: `翻到第 ${l.page} 页`,
            onClick: () => {
              s == null || s(l.page, l.pane), n(!1);
            },
            children: [
              /* @__PURE__ */ p("span", { className: "reader-favorites-text", children: l.text }),
              /* @__PURE__ */ C("span", { className: "reader-favorites-page", children: [
                "p.",
                l.page,
                l.pane === "translated" ? " · 译文" : ""
              ] })
            ]
          }
        ),
        /* @__PURE__ */ p(
          X,
          {
            className: "reader-favorites-remove",
            "aria-label": `删掉第 ${l.page} 页这段收藏`,
            title: "删掉",
            onClick: () => a(l.id),
            children: /* @__PURE__ */ p(bt, { size: 13, "aria-hidden": !0 })
          }
        )
      ] }, l.id)) }) : /* @__PURE__ */ p("p", { children: "还没有收藏。在书页上选一段字，点浮条上的「收藏」（或右键「收藏这段」），就收在这里，随时翻回来。" })
    ] }) : null
  ] });
}
function og(e) {
  const t = Fe(), n = wr(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? nn, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = Uc(a), f = a > $a + 1e-3, d = a < In - 1e-3, m = kt(r, Rt()), g = m >= In ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", [h, y] = _(!1), [I, S] = _(`${i}`);
  O(() => {
    h || S(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, h]);
  const b = () => {
    if (y(!1), !l || c <= 0)
      return;
    const w = Number(`${I}`.trim());
    l(Tn(w, c));
  };
  return /* @__PURE__ */ C("footer", { className: "reader-bottombar", "data-reader-hud": "true", children: [
    /* @__PURE__ */ C("div", { className: "reader-bottombar-start", children: [
      e.startSlot,
      e.bookmarkScope ? /* @__PURE__ */ p(
        ng,
        {
          scope: e.bookmarkScope,
          currentPage: i,
          numPages: c,
          regions: t == null ? void 0 : t.regions
        }
      ) : null,
      e.leftSlot
    ] }),
    /* @__PURE__ */ C("div", { className: "reader-bottombar-center", children: [
      o ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
      /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "页码", children: h ? /* @__PURE__ */ C(
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
            /* @__PURE__ */ C("span", { className: "reader-react-hud-page-suffix", children: [
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
        X,
        {
          className: "reader-react-hud-btn reader-react-hud-doc-dark",
          "aria-pressed": t.docDark ? "true" : "false",
          "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
          title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
          onClick: t.toggleDocDark,
          children: /* @__PURE__ */ p(Oi, { ...Re, "aria-hidden": !0 })
        }
      ) }) : null,
      /* @__PURE__ */ C("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
        /* @__PURE__ */ p(
          "button",
          {
            type: "button",
            className: "reader-react-hud-btn",
            "aria-label": "缩小",
            disabled: !f,
            onClick: () => s(Gt(a, -1)),
            children: /* @__PURE__ */ p(Ea, { ...Re, "aria-hidden": !0 })
          }
        ),
        /* @__PURE__ */ C(
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
            onClick: () => s(Gt(a, 1)),
            children: /* @__PURE__ */ p(Ra, { ...Re, "aria-hidden": !0 })
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ C("div", { className: "reader-bottombar-end", children: [
      e.toolsSlot,
      /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(Cp, {}) })
    ] })
  ] });
}
function ra(e) {
  var t, n;
  return Ha(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function ag(e) {
  const [t, n] = _(() => ({
    scope: e,
    panel: ra(Ue(e))
  }));
  O(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: ra(Ue(e))
    });
  }, [e]), O(() => {
    t.scope === e && Pn(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = L((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const ir = "download-toast";
function sg({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ C("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ C("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ p("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ p("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ p("div", { className: "download-toast-track", children: /* @__PURE__ */ p("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ p("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function ig(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    jn.dismiss(ir);
    return;
  }
  jn.custom(
    () => /* @__PURE__ */ p(sg, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: ir, duration: 1 / 0 }
  );
}
function cg() {
  const e = L((t) => {
    t && (t.setState = ig, t.hide = () => jn.dismiss(ir));
  }, []);
  return /* @__PURE__ */ C(_e, { children: [
    /* @__PURE__ */ p(pi, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
const oa = { itemId: null, origin: null };
function lg() {
  let e = oa;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? oa : { itemId: n, origin: r };
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
const aa = ["ask"];
function ug(e) {
  const t = (n) => {
    const r = aa.indexOf(n.id);
    return r < 0 ? aa.length : r;
  };
  return [...e].sort((n, r) => t(n) - t(r));
}
function cr({
  place: e,
  active: t = null,
  extensions: n = Tr
}) {
  const r = e === "side" ? ug(n) : n, [o, a] = _(null), s = us(), i = (d) => {
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
  })(), u = A(null);
  O(() => {
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
    const m = i(d.id), g = e === "side" ? kr([d]) : [];
    return !m.length && !g.length ? null : /* @__PURE__ */ C(En, { children: [
      m.map((h) => {
        const y = `${d.id}:${h.key}`, I = h.Icon;
        return /* @__PURE__ */ C("span", { className: "reader-bar-tool-group", "data-has-dropdown": h.dropdown ? "true" : void 0, children: [
          /* @__PURE__ */ p(
            X,
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
              children: e === "compare" ? /* @__PURE__ */ p(bn, { ...io, "aria-hidden": !0 }) : h.mark ?? /* @__PURE__ */ p(I, { ...Re, "aria-hidden": !0 })
            }
          ),
          h.dropdown ? /* @__PURE__ */ p(
            X,
            {
              className: "reader-bar-tool-caret",
              "aria-label": `${h.label}：选项`,
              title: `${h.label}的选项`,
              "aria-expanded": o === `${y}:dropdown`,
              "data-bar-tool-caret": h.key,
              onClick: () => a((S) => S === `${y}:dropdown` ? null : `${y}:dropdown`),
              children: /* @__PURE__ */ p(bn, { ...io, "aria-hidden": !0 })
            }
          ) : null
        ] }, y);
      }),
      g.length ? /* @__PURE__ */ p(Uh, { active: t, tabs: g }) : null
    ] }, d.id);
  }).filter(Boolean);
  return f.length ? /* @__PURE__ */ C("div", { className: `reader-bar-tools is-${e}`, ref: u, role: "group", "aria-label": e === "side" ? "面板" : e === "compare" ? "对比版本" : "书页工具", children: [
    f,
    l ? /* @__PURE__ */ p("div", { className: "reader-bar-tools-popup", children: l }) : null
  ] }) : null;
}
const sa = { search: "搜索", bookmarks: "书签", issues: "待改" }, dg = [];
function fg({
  open: e,
  onToggle: t,
  issueCount: n = 0,
  children: r
}) {
  const o = `在全文搜索，书签${n ? `、待改 ${n} 处` : ""}（⌘F）`;
  return /* @__PURE__ */ C("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ C(X, { className: "reader-finder-toggle", "aria-label": "左栏：搜索、书签、待改", "aria-pressed": !!e, title: o, onClick: t, children: [
      /* @__PURE__ */ p(Ma, { ...Re, "aria-hidden": !0 }),
      n ? /* @__PURE__ */ p("span", { className: "reader-finder-toggle-count", "aria-label": `待改 ${n} 处`, children: n }) : null
    ] }),
    r
  ] });
}
function mg({
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
  var M;
  const d = ((M = Fe()) == null ? void 0 : M.regions) ?? dg, m = U(() => zu(d, s), [d, s]), [g, h] = _(-1);
  O(() => h(-1), [s]);
  const y = A(null), I = A(null), S = A(n);
  S.current = n, O(() => {
    if (c) return;
    const E = (N) => {
      var T, R;
      const k = N.target;
      !k || (T = I.current) != null && T.contains(k) || (R = k.closest) != null && R.call(k, ".reader-finder-toggles, [data-finder-toggle]") || S.current();
    }, $ = (N) => {
      N.key === "Escape" && S.current();
    };
    return document.addEventListener("pointerdown", E, !0), document.addEventListener("keydown", $), () => {
      document.removeEventListener("pointerdown", E, !0), document.removeEventListener("keydown", $);
    };
  }, [c]);
  const b = A(null);
  O(() => {
    var E;
    e === "search" && ((E = y.current) == null || E.focus());
  }, [e, i]), O(() => {
    var E, $, N;
    e === "search" && g >= 0 && ((N = ($ = (E = b.current) == null ? void 0 : E.querySelector('[aria-current="true"]')) == null ? void 0 : $.scrollIntoView) == null || N.call($, { block: "nearest" }));
  }, [e, g]);
  const w = (E) => {
    const $ = m[E];
    $ && (h(E), r($.itemId));
  }, v = ["search", ...l ? ["bookmarks"] : [], ...u ? ["issues"] : []], P = v.includes(e) ? e : "search";
  return /* @__PURE__ */ C("aside", { ref: I, className: "reader-finder", "data-finder-tab": P, "data-pinned": c ? "true" : void 0, "aria-label": `左栏：${sa[P]}`, children: [
    /* @__PURE__ */ C("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ p("div", { className: "reader-finder-tabs", role: "tablist", children: v.map((E) => /* @__PURE__ */ C(X, { className: "reader-finder-tab", role: "tab", "aria-selected": P === E, onClick: () => t(E), children: [
        sa[E],
        E === "issues" && f ? /* @__PURE__ */ p("span", { className: "reader-finder-tab-count", children: f }) : null
      ] }, E)) }),
      /* @__PURE__ */ p(X, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(bt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    P === "bookmarks" ? l : P === "issues" ? u : null,
    P !== "search" ? null : /* @__PURE__ */ C(_e, { children: [
      /* @__PURE__ */ C("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          fr,
          {
            ref: y,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "搜原文或译文（⌘F）",
            "aria-label": "在书里搜索",
            value: o,
            onChange: (E) => a(E.target.value),
            onKeyDown: (E) => {
              E.key === "Enter" ? (E.preventDefault(), w(Fu(g, m.length, E.shiftKey))) : E.key === "Escape" && (E.preventDefault(), c ? E.currentTarget.blur() : n()), E.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: m.length === 0 ? "没有找到" : `${g >= 0 ? `第 ${g + 1} / ` : ""}${m.length >= 200 ? "200+ 处，只列前 200 处" : `${m.length} 处`}${g < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { ref: b, className: "reader-finder-list", children: m.map((E, $) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ C(X, { className: "reader-finder-entry is-hit", "aria-current": $ === g ? "true" : void 0, onClick: () => w($), children: [
        /* @__PURE__ */ C("span", { className: "reader-finder-entry-text", children: [
          E.snippet.slice(0, E.at),
          /* @__PURE__ */ p("mark", { children: E.snippet.slice(E.at, E.at + E.length) }),
          E.snippet.slice(E.at + E.length)
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: E.page })
      ] }) }, E.itemId)) })
    ] })
  ] });
}
function Ws(e, t = []) {
  for (const n of e)
    t.push(n), Ws(n.children, t);
  return t;
}
const hg = 24, Ft = 28, ia = 15;
function Ks(e) {
  return e.reduce((t, n) => t + 1 + n.children.length, 0);
}
function pg(e, t) {
  if (e.length)
    return (e.length === 1 && e[0].children.length ? e[0].children : e).map((o) => ({
      id: o.id,
      title: o.title,
      page: o.page,
      depth: 1,
      children: Ws(o.children).map((a) => ({ id: a.id, title: a.title, page: a.page, depth: a.level - o.level + 1 }))
    }));
  const n = [];
  for (const r of t) {
    const o = { id: r.itemId, title: r.text, page: r.page, itemId: r.itemId }, a = n[n.length - 1];
    r.level > 1 && a ? a.children.push({ ...o, depth: 2 }) : n.push({ ...o, depth: 1, children: [] });
  }
  return n;
}
function gg(e, t) {
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
function bg(e, t) {
  const n = Ks(e) > hg, r = Math.max(1, Math.ceil(e.length / Ft)), o = [];
  if (e.forEach((i, c) => {
    const l = i.id === t.chapterId;
    if (!(c % r !== 0 && !l) && (o.push({ id: i.id, kind: "h1", state: i.id === t.nodeId ? "current" : l ? "chapter" : "" }), !(n && !l)))
      for (const u of i.children)
        u.depth > 2 && !l || o.push({ id: u.id, kind: "h2", state: u.id === t.nodeId ? "current" : "" });
  }), o.length <= Ft) return o;
  const a = Math.max(0, o.findIndex((i) => i.state === "current")), s = Math.min(Math.max(0, a - Math.floor(Ft / 2)), o.length - Ft);
  return o.slice(s, s + Ft);
}
function yg(e, t) {
  const n = t.trim().toLowerCase();
  if (!n) return [...e];
  const r = [];
  for (const o of e) {
    const a = o.title.toLowerCase().includes(n), s = o.children.filter((i) => i.title.toLowerCase().includes(n));
    a ? r.push(o) : s.length && r.push({ ...o, children: s });
  }
  return r;
}
const vg = [];
function ca({ bookmarks: e, onJumpPage: t, onJumpBlock: n, pinned: r = !1, docked: o = !1, onPinChange: a }) {
  var N, k;
  const s = ((N = Fe()) == null ? void 0 : N.regions) ?? vg, i = ((k = wr()) == null ? void 0 : k.currentPage) ?? 1, c = U(() => pg(e, Du(s)), [e, s]), l = U(() => gg(c, i), [c, i]), u = U(() => bg(c, l), [c, l]), f = Ks(c), [d, m] = _(""), g = U(() => yg(c, d), [c, d]), [h, y] = _(() => /* @__PURE__ */ new Set()), I = A(null), S = A(!1), b = () => {
    l.chapterId && !h.has(l.chapterId) && y((T) => new Set(T).add(l.chapterId)), S.current = !0;
  };
  if (O(() => {
    (r || o) && b();
  }, [r, o]), Ae(() => {
    var T, R, D;
    S.current && (S.current = !1, (D = (R = (T = I.current) == null ? void 0 : T.querySelector('[aria-current="location"]')) == null ? void 0 : R.scrollIntoView) == null || D.call(R, { block: "center" }));
  }), !c.length) return null;
  const w = (T) => y((R) => {
    const D = new Set(R);
    return D.has(T) ? D.delete(T) : D.add(T), D;
  }), v = (T, R) => {
    y((D) => D.has(R) ? D : new Set(D).add(R)), T.itemId ? n(T.itemId) : T.page !== null && t(T.page);
  }, P = !!d.trim(), M = (T, R) => /* @__PURE__ */ C(
    X,
    {
      className: "reader-toc-entry",
      "data-depth": Math.min(T.depth, 3),
      "aria-current": T.id === l.nodeId ? "location" : void 0,
      disabled: !T.itemId && T.page === null,
      title: T.page === null ? "这条书签没有指到页" : `${T.title}（第 ${T.page} 页）`,
      onClick: () => v(T, R),
      children: [
        /* @__PURE__ */ p("span", { className: "reader-toc-title", children: T.title }),
        T.page !== null ? /* @__PURE__ */ C("span", { className: "reader-toc-page", children: [
          "p.",
          T.page
        ] }) : null
      ]
    }
  ), E = r ? "取消固定" : "固定在左边", $ = /* @__PURE__ */ C(_e, { children: [
    /* @__PURE__ */ C("div", { className: "reader-toc-head", children: [
      /* @__PURE__ */ p("span", { className: "reader-toc-head-title", children: "目录" }),
      /* @__PURE__ */ p(X, { className: "reader-toc-pin", "aria-label": E, title: E, "aria-pressed": r, onClick: () => a == null ? void 0 : a(!r), children: r ? /* @__PURE__ */ p(zi, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }) : /* @__PURE__ */ p(va, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }) })
    ] }),
    f > ia ? /* @__PURE__ */ C("div", { className: "reader-toc-filter", children: [
      /* @__PURE__ */ p(Ma, { size: 13, "aria-hidden": !0 }),
      /* @__PURE__ */ p(
        fr,
        {
          size: "sm",
          className: "reader-toc-filter-input",
          value: d,
          placeholder: "过滤章节标题或节号…",
          "aria-label": "过滤目录",
          onChange: (T) => m(T.target.value),
          onKeyDown: (T) => {
            T.stopPropagation(), T.key === "Escape" && (d ? m("") : (T.currentTarget.blur(), r && !o && (a == null || a(!1))));
          }
        }
      ),
      d ? /* @__PURE__ */ p(X, { className: "reader-toc-filter-clear", "aria-label": "清掉", onClick: () => m(""), children: /* @__PURE__ */ p(bt, { size: 12, "aria-hidden": !0 }) }) : null
    ] }) : null,
    /* @__PURE__ */ p("div", { className: "reader-toc-list", ref: I, children: g.length ? g.map((T) => {
      const R = P || h.has(T.id);
      return /* @__PURE__ */ C("div", { className: "reader-toc-chapter", children: [
        /* @__PURE__ */ C("div", { className: "reader-toc-chapter-row", children: [
          T.children.length ? /* @__PURE__ */ p(
            X,
            {
              className: "reader-toc-caret",
              "aria-expanded": R,
              "aria-label": `${R ? "收起" : "展开"}「${T.title}」`,
              onClick: () => w(T.id),
              children: R ? /* @__PURE__ */ p(bn, { size: 12, "aria-hidden": !0 }) : /* @__PURE__ */ p(ka, { size: 12, "aria-hidden": !0 })
            }
          ) : /* @__PURE__ */ p("span", { className: "reader-toc-caret-space" }),
          M(T, T.id)
        ] }),
        R ? T.children.map((D) => /* @__PURE__ */ p("div", { children: M(D, T.id) }, D.id)) : null
      ] }, T.id);
    }) : /* @__PURE__ */ p("p", { className: "reader-toc-empty", children: "没有匹配的章节" }) })
  ] });
  return o ? /* @__PURE__ */ p("nav", { className: "reader-toc-dock", "aria-label": "目录", children: $ }) : /* @__PURE__ */ C(
    "nav",
    {
      className: "reader-toc-minimap",
      "aria-label": "目录",
      "data-pinned": r ? "true" : void 0,
      onPointerEnter: r ? void 0 : b,
      onKeyDown: (T) => {
        r && T.key === "Escape" && (a == null || a(!1));
      },
      onFocus: (T) => {
        !r && !T.currentTarget.contains(T.relatedTarget) && b();
      },
      children: [
        /* @__PURE__ */ p("div", { className: "reader-toc-bars", tabIndex: 0, "aria-label": `目录，${f} 条（移上去或按 Tab 展开）`, children: u.map((T) => /* @__PURE__ */ p("span", { className: "reader-toc-bar", "data-kind": T.kind, "data-state": T.state || void 0, "aria-hidden": !0 }, T.id)) }),
        /* @__PURE__ */ p("div", { className: "reader-toc-card", "data-compact": f <= ia ? "true" : void 0, children: $ })
      ]
    }
  );
}
function wg({ active: e }) {
  return /* @__PURE__ */ C("div", { className: "reader-side-rail", role: "toolbar", "aria-orientation": "vertical", "aria-label": "面板和下载", children: [
    /* @__PURE__ */ p(cr, { place: "side", active: e }),
    /* @__PURE__ */ p("span", { className: "reader-side-rail-sep", "aria-hidden": !0 }),
    /* @__PURE__ */ p(Hp, {})
  ] });
}
const kn = ".textLayer", la = 8, Sg = 34, Ig = 56;
function lr(e) {
  return e ? e.nodeType === 1 ? e : e.parentElement : null;
}
function hn(e = ((t) => (t = globalThis.getSelection) == null ? void 0 : t.call(globalThis))() ?? null) {
  var s, i;
  if (!e || e.isCollapsed || !e.rangeCount) return null;
  const n = e.getRangeAt(0), r = ((s = lr(n.startContainer)) == null ? void 0 : s.closest(kn)) ?? ((i = lr(n.endContainer)) == null ? void 0 : i.closest(kn));
  if (!r) return null;
  const o = ps(`${e}`);
  if (!o) return null;
  const a = r.closest(`[${Te}]`);
  return {
    text: o,
    page: Math.max(1, Number(a == null ? void 0 : a.getAttribute(Te)) || 1),
    pane: (a == null ? void 0 : a.getAttribute(we)) === "translated" ? "translated" : "source",
    layer: r
  };
}
async function Vs(e) {
  var t, n;
  try {
    if ((n = (t = globalThis.navigator) == null ? void 0 : t.clipboard) != null && n.writeText)
      return await globalThis.navigator.clipboard.writeText(e), !0;
  } catch {
  }
  try {
    return document.execCommand("copy");
  } catch {
    return !1;
  }
}
const qs = typeof navigator < "u" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
function Tg(e) {
  const t = hn();
  if (!t) return [];
  const n = [{ key: "copy", label: "复制", hint: qs ? "⌘C" : "Ctrl+C", onSelect: () => {
    Vs(t.text);
  } }];
  if (e) {
    const r = Hr(xt(e), t.text, t.page);
    n.push({
      key: "favorite",
      label: r ? "已收藏（在左下角「收藏」里）" : "收藏这段",
      onSelect: () => {
        js(e, t);
      }
    });
  }
  return n;
}
function kg(e) {
  return [...e.querySelectorAll("span")].filter((t) => !t.classList.contains("markedContent") && !t.querySelector("span"));
}
function Eg(e) {
  let t = 0, n = null;
  return e.map((r) => {
    const o = r.getBoundingClientRect(), a = o.top + o.height / 2;
    return n && Math.abs(a - n.center) > Math.max(o.height, n.height) / 2 && (t += 1), n = { center: a, height: o.height || (n == null ? void 0 : n.height) || 0 }, { text: r.textContent || "", line: t };
  });
}
function Rg(e) {
  const t = [], n = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
  for (let r = n.nextNode(); r; r = n.nextNode()) t.push(r);
  return t;
}
function ua(e, t) {
  const n = lr(e), r = n == null ? void 0 : n.closest(kn), o = n == null ? void 0 : n.closest("span");
  if (!r || !o) return null;
  const a = kg(r), s = a.indexOf(o);
  if (s < 0) return null;
  const i = Math.max(0, s - 60), c = a.slice(i, Math.min(a.length, s + 61)), l = om(Eg(c), s - i);
  if (!l) return null;
  const u = Rg(c[t === "start" ? l[0] : l[1]]);
  return u.length ? t === "start" ? { node: u[0], offset: 0 } : { node: u[u.length - 1], offset: u[u.length - 1].length } : null;
}
function Pg(e) {
  if (!e || e.isCollapsed || !e.rangeCount) return !1;
  const t = e.getRangeAt(0), n = ua(t.startContainer, "start"), r = ua(t.endContainer, "end");
  if (!n && !r) return !1;
  const o = t.cloneRange();
  return n && t.comparePoint(n.node, n.offset) <= 0 && o.setStart(n.node, n.offset), r && t.comparePoint(r.node, r.offset) >= 0 && o.setEnd(r.node, r.offset), o.compareBoundaryPoints(Range.START_TO_START, t) === 0 && o.compareBoundaryPoints(Range.END_TO_END, t) === 0 ? !1 : (e.removeAllRanges(), e.addRange(o), !0);
}
function Mg(e) {
  var s;
  if (!e || e.isCollapsed || !e.rangeCount) return [];
  const t = e.getRangeAt(0), n = t.commonAncestorContainer, r = n.nodeType === 3 ? [n] : (() => {
    const i = [], c = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
    for (let l = c.nextNode(); l; l = c.nextNode()) t.intersectsNode(l) && i.push(l);
    return i;
  })(), o = [], a = /* @__PURE__ */ new Map();
  for (const i of r) {
    const c = (s = i.parentElement) == null ? void 0 : s.closest(kn);
    if (!c) continue;
    const l = c.closest(`.${tn}`) ?? c;
    let u = a.get(l);
    u || (u = l.getBoundingClientRect(), a.set(l, u));
    const f = document.createRange();
    if (f.selectNodeContents(i), i === t.startContainer && f.setStart(i, t.startOffset), i === t.endContainer && f.setEnd(i, t.endOffset), !!f.toString().trim())
      for (const d of f.getClientRects()) {
        const m = Math.max(d.left, u.left), g = Math.min(d.right, u.right);
        g - m > 0.5 && o.push({ left: m, top: d.top, right: g, bottom: d.bottom });
      }
  }
  return am(o);
}
function xg({ scope: e, menuItemsAt: t }) {
  const n = A(null), r = A(!1), o = A(!1), a = A(0), s = A(t);
  s.current = t;
  const [i, c] = _(null), l = A(null), u = L(() => {
    var P;
    a.current = 0;
    const d = n.current;
    if (!d) return;
    const m = ((P = globalThis.getSelection) == null ? void 0 : P.call(globalThis)) ?? null, g = Mg(m), h = d.getBoundingClientRect();
    for (; d.children.length > g.length; ) d.lastElementChild.remove();
    if (g.forEach((M, E) => {
      const $ = d.children[E] ?? d.appendChild(document.createElement("div"));
      $.className = "reader-selection-band", $.style.left = `${M.left - h.left}px`, $.style.top = `${M.top - h.top}px`, $.style.width = `${M.right - M.left}px`, $.style.height = `${M.bottom - M.top}px`;
    }), !r.current) return;
    const y = hn(m);
    if (!y || !g.length) {
      r.current = !1, c(null);
      return;
    }
    const I = g[0], S = g[g.length - 1], b = (Math.min(...g.map((M) => M.left)) + Math.max(...g.map((M) => M.right))) / 2 - h.left, w = I.top - h.top - la - Sg, v = w >= Ig ? w : S.bottom - h.top + la;
    c((M) => {
      var k;
      const E = M && M.text === y.text ? M.actions : s.current({
        target: y.layer,
        clientX: (I.left + I.right) / 2,
        clientY: (I.top + I.bottom) / 2,
        page: y.page
      }).filter((T) => T.inSelectionBar), $ = ((k = l.current) == null ? void 0 : k.offsetWidth) || 220, N = Math.min(Math.max(b, $ / 2 + 8), h.width - $ / 2 - 8);
      return M && M.text === y.text && Math.abs(M.left - N) < 0.5 && Math.abs(M.top - v) < 0.5 ? M : { left: N, top: v, text: y.text, page: y.page, pane: y.pane, actions: E };
    });
  }, []), f = L(() => {
    a.current || (a.current = requestAnimationFrame(u));
  }, [u]);
  return O(() => {
    const d = n.current, m = d == null ? void 0 : d.parentElement, g = d == null ? void 0 : d.closest(`.${Aa}`);
    if (!d || !m) return;
    const h = () => {
      g && delete g.dataset.selectPane;
    }, y = (w) => {
      var M, E, $;
      const v = w.target;
      if (v && ((M = l.current) != null && M.contains(v))) return;
      r.current = !1, c(null);
      const P = ($ = (E = v == null ? void 0 : v.closest) == null ? void 0 : E.call(v, `[${Te}][${we}]`)) == null ? void 0 : $.getAttribute(we);
      o.current = !!P && w.button === 0, g && P && w.button === 0 && (g.dataset.selectPane = P);
    }, I = (w) => {
      var M;
      h();
      const v = o.current;
      if (o.current = !1, w.button !== 0 || !v) return;
      const P = ((M = globalThis.getSelection) == null ? void 0 : M.call(globalThis)) ?? null;
      hn(P) && (Pg(P), r.current = !0, f());
    }, S = (w) => {
      const v = hn();
      !v || !w.clipboardData || (w.clipboardData.setData("text/plain", v.text), w.preventDefault());
    }, b = (w) => {
      w.key === "Escape" && r.current && (r.current = !1, c(null));
    };
    return m.addEventListener("pointerdown", y, !0), window.addEventListener("pointerup", I), window.addEventListener("pointercancel", h), document.addEventListener("selectionchange", f), document.addEventListener("copy", S), document.addEventListener("keydown", b), m.addEventListener("scroll", f, { capture: !0, passive: !0 }), window.addEventListener("resize", f), () => {
      h(), a.current && cancelAnimationFrame(a.current), m.removeEventListener("pointerdown", y, !0), window.removeEventListener("pointerup", I), window.removeEventListener("pointercancel", h), document.removeEventListener("selectionchange", f), document.removeEventListener("copy", S), document.removeEventListener("keydown", b), m.removeEventListener("scroll", f, { capture: !0 }), window.removeEventListener("resize", f);
    };
  }, [f]), /* @__PURE__ */ C(_e, { children: [
    /* @__PURE__ */ p("div", { className: "reader-selection-paint", ref: n, "aria-hidden": "true" }),
    i ? /* @__PURE__ */ p(
      Ng,
      {
        ref: l,
        bar: i,
        scope: e,
        onDone: () => {
          r.current = !1, c(null);
        }
      }
    ) : null
  ] });
}
function Ng({ bar: e, scope: t, onDone: n, ref: r }) {
  const { favorites: o, add: a } = Us(t), s = !!t && !!Hr(o, e.text, e.page), [i, c] = _(!1);
  return O(() => {
    if (!i) return;
    const l = setTimeout(() => c(!1), 1200);
    return () => clearTimeout(l);
  }, [i]), /* @__PURE__ */ C(
    "div",
    {
      ref: r,
      className: "reader-selection-bar",
      role: "toolbar",
      "aria-label": "选中的字",
      style: { left: e.left, top: e.top },
      onPointerDown: (l) => l.preventDefault(),
      children: [
        /* @__PURE__ */ C(
          X,
          {
            className: "reader-selection-action",
            title: qs ? "复制（⌘C）" : "复制（Ctrl+C）",
            onClick: () => {
              Vs(e.text).then((l) => c(l));
            },
            children: [
              i ? /* @__PURE__ */ p(dr, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }) : /* @__PURE__ */ p(ya, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { children: i ? "已复制" : "复制" })
            ]
          }
        ),
        t ? /* @__PURE__ */ C(
          X,
          {
            className: "reader-selection-action",
            "aria-pressed": s,
            title: s ? "已收藏，在左下角「收藏」（星）里" : "收藏这段，在左下角「收藏」（星）里翻回来",
            onClick: () => {
              s || a({ text: e.text, page: e.page, pane: e.pane });
            },
            children: [
              /* @__PURE__ */ p(Pa, { size: 14, strokeWidth: 1.75, fill: s ? "currentColor" : "none", "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { children: s ? "已收藏" : "收藏" })
            ]
          }
        ) : null,
        e.actions.map((l) => /* @__PURE__ */ C(
          X,
          {
            className: "reader-selection-action",
            title: l.hint ? `${l.label}（${l.hint}）` : l.label,
            onClick: () => {
              n(), l.onSelect();
            },
            children: [
              /* @__PURE__ */ p(Ta, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { children: l.inSelectionBar })
            ]
          },
          l.key
        ))
      ]
    }
  );
}
function _g(e) {
  const [t, n] = _([]);
  return O(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = Ye().loadIssues;
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
function Ag(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const Lg = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, Cg = ["failed", "content", "layout"];
function Dg(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function $g(e, t, n) {
  const r = _g(e), [o, a] = _(-1);
  O(() => a(-1), [r]);
  const s = L((c) => {
    const l = r[c];
    !l || !n || (a(c), n(l.readerItemId));
  }, [r, n]), i = A({ issues: r, last: o, currentPage: t, goTo: s });
  return i.current = { issues: r, last: o, currentPage: t, goTo: s }, O(() => {
    const c = (l) => {
      if (l.key.toLowerCase() !== "n" || l.metaKey || l.ctrlKey || l.altKey || Dg(l.target)) return;
      const { issues: u, last: f, currentPage: d, goTo: m } = i.current, g = Ag(u, f, d, l.shiftKey);
      g < 0 || (l.preventDefault(), m(g));
    };
    return document.addEventListener("keydown", c), () => document.removeEventListener("keydown", c);
  }, []), { issues: r, last: o, goTo: s };
}
function Og(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function zg(e) {
  var r;
  if (e.shiftKey || Og(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${Ca}`))) return null;
  const n = Number((r = t.closest(`[${Te}]`)) == null ? void 0 : r.getAttribute(Te)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Fg({
  menu: e,
  onClose: t,
  actions: n,
  sections: r
}) {
  const o = A(null);
  if (O(() => {
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
  return /* @__PURE__ */ C("div", { ref: o, className: "reader-ink-menu", style: { left: s, top: i }, "data-ink-menu": "true", children: [
    n.length ? /* @__PURE__ */ p("div", { className: "reader-ink-menu-actions", role: "menu", "aria-label": "书页", children: n.map((c) => /* @__PURE__ */ C(
      X,
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
    r.map((c) => /* @__PURE__ */ p(En, { children: c.render({ page: e.page, close: t }) }, c.id))
  ] });
}
function Bg({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ p("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ C("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
    /* @__PURE__ */ p("span", { children: n.phase === "failed" ? n.message : `改了 ${t} 处，还没排进 PDF` }),
    t ? /* @__PURE__ */ p(
      X,
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
const Js = "retainpdf:reader:doc-theme:v1", da = "data-reader-doc";
function Gs() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Hg(e = Gs()) {
  try {
    return (e == null ? void 0 : e.getItem(Js)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function jg(e, t = Gs()) {
  try {
    t == null || t.setItem(Js, e);
  } catch {
  }
}
function fa(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(da, "dark") : t.removeAttribute(da));
}
function Ug() {
  const [e, t] = _(() => Hg());
  O(() => {
    fa(e);
  }, [e]), O(() => () => fa("light"), []);
  const n = L(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return jg(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
function Wg({ scope: e, regions: t, currentPage: n, numPages: r, onJumpPage: o }) {
  const { bookmarks: a, remove: s } = Fs(e, t);
  return a.length ? /* @__PURE__ */ p("ol", { className: "reader-finder-list reader-bookmark-list", children: a.map((i) => /* @__PURE__ */ C("li", { className: i.page === n ? "is-current" : "", children: [
    /* @__PURE__ */ C(
      X,
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
    /* @__PURE__ */ p(X, { className: "reader-bookmark-remove", "aria-label": `删除第 ${i.page} 页的书签`, title: "删除这个书签", onClick: () => s(i.page), children: "×" })
  ] }, i.page)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: "还没有书签。左下角的书签按钮给眼下这一页加一个。" });
}
function Kg({ nav: e }) {
  const { issues: t, last: n, goTo: r } = e;
  return /* @__PURE__ */ C("div", { className: "reader-issues", children: [
    /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
    Cg.map((o) => {
      const a = t.map((s, i) => ({ issue: s, index: i })).filter(({ issue: s }) => s.kind === o);
      return a.length ? /* @__PURE__ */ C("section", { className: "reader-issues-group", "data-issue-kind": o, children: [
        /* @__PURE__ */ C("h4", { children: [
          Lg[o],
          /* @__PURE__ */ p("span", { children: a.length })
        ] }),
        /* @__PURE__ */ p("ol", { children: a.map(({ issue: s, index: i }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ C(X, { className: "reader-issues-item", "aria-current": i === n ? "true" : void 0, onClick: () => r(i), children: [
          /* @__PURE__ */ p("span", { className: "reader-issues-title", children: s.title }),
          /* @__PURE__ */ C("span", { className: "reader-issues-page", children: [
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
function Vg({ state: e, bookmarkScope: t, issues: n }) {
  const { finder: r, setFinder: o, findQuery: a, setFindQuery: s, findTerm: i, findFocus: c, jumpFromFinder: l, jumpToPageFromFinder: u, pinned: f } = e, d = Fe(), m = wr(), g = (m == null ? void 0 : m.currentPage) ?? 1, h = n.issues.length;
  return /* @__PURE__ */ p(_e, { children: r ? /* @__PURE__ */ p(
    mg,
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
        Wg,
        {
          scope: t,
          regions: d == null ? void 0 : d.regions,
          currentPage: g,
          numPages: (m == null ? void 0 : m.numPages) ?? 0,
          onJumpPage: u
        }
      ) : void 0,
      issuesPane: h ? /* @__PURE__ */ p(Kg, { nav: n }) : void 0,
      issueCount: h
    }
  ) : null });
}
function qg({
  session: e,
  zoomDocuments: t,
  zoomItem: n,
  setZoomItem: r,
  closeZoom: o,
  visiblePdfMode: a
}) {
  return /* @__PURE__ */ p(_e, { children: n ? /* @__PURE__ */ p(
    Nh,
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
function Jg(e) {
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
const Gg = 720;
function Xg(e, t) {
  return !t || !Number.isFinite(e) || e <= 0 ? !0 : e >= Gg;
}
function Yg(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function Zg(e, t, n = !0) {
  const { sessionFiles: r } = e, [o, a] = _(!1), s = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, i = Jg({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: s,
    liveTranslationVisible: o,
    assistantOpen: t,
    compareFits: n
  }), c = Jl({
    hasOverlayContent: s,
    connection: e.liveTranslation.connection,
    showSource: i.showSource,
    liveTranslationVisible: o,
    assistantOpen: t
  }), l = i.sourceViewOnly, u = i.visibleMode;
  O(() => {
    a(!1);
  }, [e.viewStateKey]), O(() => {
    e.session.jobTerminal && a(!1);
  }, [e.session.jobTerminal]);
  const f = A(null);
  return O(() => {
    f.current !== e.viewStateKey && Yl({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: l,
      jobTerminal: e.session.jobTerminal
    }) && (f.current = e.viewStateKey, a(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, l]), { liveTranslationVisible: o, setLiveTranslationVisible: a, paneComposition: i, liveToggles: c, sourceViewOnly: l, visiblePdfMode: u };
}
function Qg(e, { liveTranslationVisible: t, setLiveTranslationVisible: n, liveToggles: r, sourceViewOnly: o, visiblePdfMode: a }) {
  const s = Gl(e.liveTranslation), i = L(() => {
    s && e.goToPage(s, "source");
  }, [e.goToPage, s]), [c, l] = _(null);
  O(() => {
    a === "compare" && e.session.jobTerminal && l(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, a]);
  const u = c !== e.viewStateKey && Zl({
    state: e.liveTranslation,
    sourceViewOnly: o,
    visibleMode: a
  }), f = U(() => r.sourcePaneToggle ? /* @__PURE__ */ p(
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
function eb() {
  const [e] = _(Cf), t = Wf(e), n = Ff(t);
  return { contributionStore: e, contributions: t, reserveRight: n };
}
function tb(e, t, n) {
  const r = A(e);
  O(() => {
    const o = e > 0 && r.current <= 0;
    r.current = e, o && t && n();
  }, [e]);
}
function nb(e, t, {
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
  const { session: m, panes: g } = e, h = A(e.currentPage);
  h.current = e.currentPage;
  const y = L(() => h.current, []), I = U(() => ({
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
  ]), { contributionStore: S, contributions: b, reserveRight: w } = t, v = U(() => Df(b), [b]), P = U(() => Bf(b), [b]), M = U(() => zf(b), [b]), E = U(() => $f(b), [b]), $ = Of(b);
  return { readerApi: I, contributionStore: S, contributions: b, pageLayers: v, compareVersion: P, textMarks: M, menuSections: E, pointerTakenId: $, reserveRight: w };
}
function rb() {
  try {
    return Ye().translationEdit ?? null;
  } catch {
    return null;
  }
}
const ob = "这本书正在处理（翻译或排版），处理完才能改。", ab = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function sb({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = rb(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = ju(s), l = !t || qt(t), u = Ju(n), [f, d] = _(""), [m, g] = _(null), [h, y] = _(() => /* @__PURE__ */ new Map()), [I, S] = _(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [b, w] = _(() => /* @__PURE__ */ new Map()), [v, P] = _({ phase: "idle" }), M = A({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  O(() => {
    g(null), M.drafts.clear(), M.generation.current = null, w(/* @__PURE__ */ new Map()), P({ phase: "idle" });
  }, [s]), O(() => {
    if (d(""), !i || c || !a) return;
    let z = !1;
    return a.resolveOwnerJobId(s).then((K) => {
      z || d(`${K || s}`.trim() || s);
    }).catch(() => {
      z || d(s);
    }), () => {
      z = !0;
    };
  }, [i, c, a, s]), O(() => {
    if (y(/* @__PURE__ */ new Map()), !a || !f || !u || !l) return;
    let z = !1;
    return a.fetchRevisions(f).then((K) => {
      z || y(Gu(K, u));
    }).catch(() => {
    }), () => {
      z = !0;
    };
  }, [a, f, u, l]);
  const E = v.phase === "running" && v.seenActive;
  O(() => {
    if (v.phase === "running") {
      if (!l) {
        E || P({ phase: "running", seenActive: !0 });
        return;
      }
      E && P(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [v.phase, E, l, t]);
  const $ = U(() => {
    const z = new Map(h);
    if (I.renderedAt === u)
      for (const [K, j] of I.edits) z.set(K, j);
    return z;
  }, [h, I, u]), N = L((z) => {
    const K = `${z || ""}`.trim();
    K && g({ itemId: K, page: Uu(K) });
  }, []), k = L(() => g(null), []), T = L((z, K) => {
    S((j) => {
      const J = new Map(j.renderedAt === u ? j.edits : []);
      return J.set(z, K), { renderedAt: u, edits: J };
    }), w((j) => new Map(j).set(z, (j.get(z) || 0) + 1));
  }, [u]), R = L(async () => {
    if (!(!a || !s || v.phase === "submitting" || v.phase === "running")) {
      P({ phase: "submitting" });
      try {
        await a.rerender(s), P({ phase: "running", seenActive: !1 }), await o();
      } catch (z) {
        P({ phase: "failed", message: (z == null ? void 0 : z.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, v.phase, o]), D = c ? ab : !l || v.phase === "running" || v.phase === "submitting" ? ob : "";
  return U(() => ({
    available: i,
    blockedReason: D,
    port: a,
    ownerJobId: f,
    target: m,
    select: N,
    close: k,
    memory: M,
    pendingEdits: $,
    savedCounts: b,
    markSaved: T,
    rerender: v,
    startRerender: R
  }), [i, D, a, f, m, N, k, M, $, b, T, v, R]);
}
function ib(e, t) {
  O(() => {
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
function cb(e, t, n) {
  const { session: r, sessionFiles: o } = e, a = sb({
    jobId: r.jobId,
    jobStatus: r.jobStatus,
    jobPayload: r.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!o.translatedUrl,
    refreshJobStatus: r.refreshJobStatus
  }), s = a.select, i = e.setModeKeepingPage, c = r.regions, l = a.memory.drafts, u = L((d, m) => {
    Qa(c, d) && (t === "source" && i("compare"), m != null && m.trim() && l.set(d, m), s(d));
  }, [c, s, t, i, l]);
  ib(a.available ? u : null, n);
  const f = U(() => {
    if (!a.savedCounts.size) return e.revisedBlocks;
    const d = new Map(e.revisedBlocks);
    for (const [m, g] of a.savedCounts) d.set(m, (d.get(m) || 0) + g);
    return d;
  }, [e.revisedBlocks, a.savedCounts]);
  return { blockEdit: a, editBlock: u, revisedBlocks: f };
}
const lb = "reader-finder-input";
function ub(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function db(e, t = typeof window > "u" ? null : window) {
  O(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!ub(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(lb) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
const Xs = "retainpdf.reader.sidebar.v1", fb = ["search", "bookmarks", "issues"], mb = 900;
function hb() {
  var e;
  try {
    const t = JSON.parse(((e = globalThis.localStorage) == null ? void 0 : e.getItem(Xs)) || "{}");
    return { tab: fb.includes(t == null ? void 0 : t.tab) ? t.tab : "search" };
  } catch {
    return { tab: "search" };
  }
}
function pb(e) {
  var t;
  try {
    (t = globalThis.localStorage) == null || t.setItem(Xs, JSON.stringify(e));
  } catch {
  }
}
function gb() {
  const e = `(min-width: ${mb}px)`, [t, n] = _(() => typeof window > "u" || !window.matchMedia ? !0 : window.matchMedia(e).matches);
  return O(() => {
    var a;
    if (typeof window > "u" || !window.matchMedia) return;
    const r = window.matchMedia(e), o = () => n(r.matches);
    return o(), (a = r.addEventListener) == null || a.call(r, "change", o), () => {
      var s;
      return (s = r.removeEventListener) == null ? void 0 : s.call(r, "change", o);
    };
  }, [e]), t;
}
function bb(e) {
  const [t] = _(hb), [n, r] = _(null), [o, a] = _(t.tab), i = gb(), c = L((v) => {
    r(v), v && a(v);
  }, []);
  O(() => {
    pb({ tab: n || o });
  }, [n, o]);
  const l = L(() => r((v) => v ? null : o), [o]), u = L((v) => {
    r((P) => P === v ? null : v), a(v);
  }, []), [f, d] = _(""), [m, g] = _("");
  O(() => {
    const v = f.replace(/\s+/gu, " ").trim(), P = window.setTimeout(() => g(v), v ? 150 : 0);
    return () => window.clearTimeout(P);
  }, [f]);
  const [h, y] = _(0), I = L(() => {
    c("search"), y((v) => v + 1);
  }, [c]);
  db(I);
  const S = L(() => {
    i || r(null);
  }, [i]), b = L((v) => {
    e.jumpToAnchor({ block_id: v }), S();
  }, [e.jumpToAnchor, S]), w = L((v) => {
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
function yb(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : za(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function vb(e, t) {
  return t === null || e !== t;
}
function wb(e, t) {
  const { boot: n } = e, r = A(null), o = A(null);
  O(() => {
    if (!(n.loading || n.failed)) {
      if (r.current !== e.viewStateKey) {
        r.current = e.viewStateKey;
        const a = Ue(e.viewStateKey), s = yb({
          savedMode: a == null ? void 0 : a.mode,
          sourceViewOnly: t,
          viewportWidth: Rt()
        });
        o.current = s.auto ? s.mode : null, s.mode && s.mode !== e.mode && e.setModeKeepingPage(s.mode);
        return;
      }
      vb(e.mode, o.current) && (o.current = null, Pn(e.viewStateKey, { mode: e.mode }));
    }
  }, [n.failed, n.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, t]);
}
const Sb = [];
function Ib(e) {
  const { sessionFiles: t } = e, [n, r] = _({}), o = A({ source: t.sourceUrl, translated: t.translatedUrl });
  o.current = { source: t.sourceUrl, translated: t.translatedUrl };
  const a = L((y, I) => {
    r((S) => ({ ...S, [I]: { url: o.current[I], nodes: y } }));
  }, []), s = U(() => {
    const y = n.source;
    if (y && y.url === t.sourceUrl && y.nodes.length) return y.nodes;
    const I = n.translated;
    return I && I.url === t.translatedUrl && I.nodes.length ? I.nodes : Sb;
  }, [n, t.sourceUrl, t.translatedUrl]), i = A({}), [c, l] = _(0), u = L((y, I) => {
    i.current[I] = { url: o.current[I], pdf: y }, l((S) => S + 1);
  }, []), [f, d] = _(null), m = L((y) => d(y), []), g = L(() => d(null), []);
  O(() => d(null), [e.viewStateKey]);
  const h = U(() => {
    const y = (I, S) => {
      const b = i.current[I];
      return b && b.url === S ? b.pdf : null;
    };
    return { source: y("source", t.sourceUrl), translated: y("translated", t.translatedUrl) };
  }, [c, t.sourceUrl, t.translatedUrl]);
  return { bookmarks: s, onPdfOutline: a, onPdfDocument: u, zoomItem: f, setZoomItem: d, zoomBlock: m, closeZoom: g, zoomDocuments: h };
}
function Tb() {
  const e = iu(), { boot: t, panes: n, session: r } = e, o = ag(e.viewStateKey), a = o.panel, s = o.setPanel, i = a !== null, c = eb(), { reserveRight: l } = c, u = i || l > 0, f = bb(e), { finder: d, findTerm: m } = f, g = !!d && f.pinned, [h, y] = _(!1), I = h && f.pinned, S = L(() => {
    s(null);
  }, []);
  tb(l, a, S);
  const { liveTranslationVisible: b, setLiveTranslationVisible: w, paneComposition: v, liveToggles: P, sourceViewOnly: M, visiblePdfMode: E } = Zg(
    e,
    i,
    Xg(e.shell.shellWidth, u || g || I)
  );
  wb(e, M);
  const $ = a || (e.mode === "compare" ? "compare" : "reading"), { docDark: N, toggleDocDark: k } = Ug();
  hu({
    toggleDocDark: k,
    mode: E,
    sourceOnly: e.sourceOnly,
    setMode: e.setModeKeepingPage,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    currentPage: e.currentPage,
    numPages: n.hudNumPages,
    goToPage: e.goToPage,
    enabled: e.showHud
  });
  const { latestLivePage: T, jumpToLatestLivePage: R, offerCompletion: D, setCompletionDismissedKey: z, sourcePaneAction: K } = Qg(e, {
    liveTranslationVisible: b,
    setLiveTranslationVisible: w,
    liveToggles: P,
    sourceViewOnly: M,
    visiblePdfMode: E
  }), j = L((ye) => {
    const F = Yg(ye, e.liveTranslationAvailable);
    F !== null && w(F), e.setModeKeepingPage(ye);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), J = L((ye) => {
    s(ye);
  }, []), [oe] = _(lg), q = L((ye) => e.jumpToAnchor({ block_id: ye }), [e.jumpToAnchor]), se = $g(e.sourceOnly ? "" : r.jobId, e.currentPage, q), [ke, re] = _(null), ue = L((ye, F) => e.jumpToAnchor({ block_id: ye }, F), [e.jumpToAnchor]), { bookmarks: Pe, onPdfOutline: ie, onPdfDocument: le, zoomItem: B, setZoomItem: W, zoomBlock: Y, closeZoom: de, zoomDocuments: ne } = Ib(e), { blockEdit: ae, editBlock: Se, revisedBlocks: ee } = cb(e, E, oe), [Z, fe] = _(null), x = L(() => fe(null), []), H = Om({ documentId: r.documentId, jobId: r.jobId }), {
    readerApi: V,
    contributionStore: me,
    contributions: be,
    pageLayers: Ie,
    compareVersion: xe,
    textMarks: Oe,
    menuSections: Be,
    pointerTakenId: Ze
  } = nb(e, c, {
    translationVersions: H,
    bookmarks: Pe,
    regionHover: oe,
    assistantPanel: a,
    closeAssistant: S,
    visiblePdfMode: E,
    changeWorkspace: j,
    jumpToBlockIn: ue,
    zoomDocuments: ne,
    editBlock: ae.available && !ae.blockedReason ? Se : null,
    panelHost: ke
  }), Ce = !!Ze, [We, Qe] = _([]), et = U(() => ({
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
    regionHover: oe,
    jumpToBlock: q,
    revisedBlocks: ee,
    onPdfOutline: ie,
    onPdfDocument: le,
    zoomBlock: Y,
    textMarks: Oe,
    pageLayers: Ie,
    editBlock: ae.available ? Se : void 0,
    blockEdit: ae,
    editShowsSource: E !== "compare",
    findTerm: d === "search" ? m : "",
    compareVersion: xe,
    pointerTaken: Ce,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: M,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: J, close: S },
    docDark: N,
    toggleDocDark: k
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
    oe,
    q,
    ee,
    ie,
    le,
    Y,
    Oe,
    Ie,
    ae,
    Se,
    E,
    d,
    m,
    xe,
    Ce,
    e.sourceOnly,
    M,
    e.download,
    e.goToPage,
    J,
    S,
    N,
    k
  ]), wt = U(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), tt = [
    Aa,
    `is-workspace-${$}`,
    i ? "is-assistant-open" : "",
    d ? "is-finder-open" : "",
    g ? "is-sidebar-pinned" : "",
    I ? "is-toc-docked" : "",
    v.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(jf, { api: V, store: me, children: /* @__PURE__ */ p(jd, { value: et, hud: wt, children: /* @__PURE__ */ C(
    "div",
    {
      className: tt,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": $,
      "data-pointer-taken": Ze || void 0,
      onContextMenu: (ye) => {
        const F = zg(ye);
        if (!F) return;
        const Q = [
          ...Tg(e.viewStateKey),
          ...To(be, { target: ye.target, clientX: ye.clientX, clientY: ye.clientY, page: F.page })
        ];
        !Q.length && !Be.length || (ye.preventDefault(), Qe(Q), fe(F));
      },
      children: [
        /* @__PURE__ */ C("div", { className: "reader-workspace", children: [
          I ? /* @__PURE__ */ p(ca, { bookmarks: Pe, onJumpPage: e.goToPage, onJumpBlock: q, pinned: !0, docked: !0, onPinChange: y }) : null,
          /* @__PURE__ */ p(Vg, { state: f, bookmarkScope: e.viewStateKey, issues: se }),
          /* @__PURE__ */ C("div", { className: "reader-stage", children: [
            /* @__PURE__ */ p(
              Lf,
              {
                mode: E,
                documentReady: !!r.jobId,
                sourceViewOnly: M,
                onModeChange: j,
                compareExtra: /* @__PURE__ */ p(cr, { place: "compare" }),
                liveTranslation: P.topBarPill ? {
                  visible: b,
                  state: e.liveTranslation,
                  onToggle: () => w((ye) => !ye),
                  latestPage: b ? T : null,
                  currentPage: e.currentPage,
                  onJumpToLatest: R
                } : null,
                completion: D ? {
                  onOpenCompare: () => {
                    z(e.viewStateKey), j("compare");
                  }
                } : null,
                start: /* @__PURE__ */ p(Su, { onBeforeClose: r.prepareClose })
              }
            ),
            I ? null : /* @__PURE__ */ p(ca, { bookmarks: Pe, onJumpPage: e.goToPage, onJumpBlock: q, pinned: h, onPinChange: y }),
            /* @__PURE__ */ p(wg, { active: a }),
            /* @__PURE__ */ p(xg, { scope: e.viewStateKey, menuItemsAt: (ye) => To(be, ye) }),
            /* @__PURE__ */ p(Tf, { paneComposition: v, markdownSplit: i, assistantSplit: u, liveTranslation: e.liveTranslation, sourcePaneAction: K }),
            /* @__PURE__ */ p(Ap, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!r.readerErrors.regions, metadataError: !!r.readerErrors.metadata, onRetry: r.refreshJobArtifacts }),
            /* @__PURE__ */ p(
              og,
              {
                mode: E,
                modeControls: null,
                bookmarkScope: e.viewStateKey,
                startSlot: /* @__PURE__ */ p(fg, { open: d, onToggle: f.toggleSidebar, issueCount: se.issues.length }),
                leftSlot: /* @__PURE__ */ p(Bg, { edit: ae }),
                toolsSlot: /* @__PURE__ */ p(cr, { place: "bottom" })
              }
            )
          ] }),
          /* @__PURE__ */ C(
            "aside",
            {
              className: "reader-dock",
              hidden: !u,
              "data-dock": i ? "panel" : l ? "extension" : void 0,
              style: !i && l ? { "--reader-dock-width": `${l}px` } : void 0,
              "aria-label": "阅读辅助面板",
              children: [
                /* @__PURE__ */ p(Wh, { active: a }),
                /* @__PURE__ */ p("div", { className: "reader-dock-body", ref: re })
              ]
            }
          )
        ] }),
        i ? /* @__PURE__ */ p(Np, {}) : null,
        /* @__PURE__ */ p(
          qg,
          {
            session: r,
            zoomDocuments: ne,
            zoomItem: B,
            setZoomItem: W,
            closeZoom: de,
            visiblePdfMode: E
          }
        ),
        /* @__PURE__ */ p(Fg, { menu: Z, onClose: x, actions: We, sections: Be }),
        /* @__PURE__ */ p(Vf, { extensions: Tr }),
        /* @__PURE__ */ p(cg, {})
      ]
    }
  ) }) });
}
function qb() {
  return /* @__PURE__ */ p(Tb, {});
}
export {
  qb as R,
  Tb as a,
  Wb as b,
  Kb as c,
  hm as d,
  gm as e,
  jb as f,
  Ub as g,
  Bb as h,
  Hb as r,
  Vb as s,
  Fe as u
};
//# sourceMappingURL=ReaderApp-DsGxaPuB.js.map
