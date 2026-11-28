var ni = Object.defineProperty;
var Wr = (e) => {
  throw TypeError(e);
};
var ri = (e, t, n) => t in e ? ni(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var Kr = (e, t, n) => ri(e, typeof t != "symbol" ? t + "" : t, n), Vr = (e, t, n) => t.has(e) || Wr("Cannot " + n);
var Dt = (e, t, n) => (Vr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), qr = (e, t, n) => t.has(e) ? Wr("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Jr = (e, t, n, r) => (Vr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as C, jsx as p, Fragment as Ae } from "react/jsx-runtime";
import { useMemo as U, useState as N, useEffect as O, useCallback as L, useRef as A, useLayoutEffect as Le, memo as tn, createContext as nn, useContext as ft, Fragment as Pn, forwardRef as oi, useImperativeHandle as fr, useSyncExternalStore as Mn, Component as ai, Suspense as ba, lazy as va, useId as wa } from "react";
import { requireAdapter as Lt, getReaderAdapters as Oe } from "./adapters.js";
import { resolveReaderDownloadName as si, resolveReaderDownloadUrls as ii, READER_PROGRESS_COPY as Ve, trimString as yn, READER_DOWNLOAD_ACTIONS as ci, disabledReason as li } from "./runtime/state.js";
import { r as ui, b as di } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as Un, isFinishedJobStatus as Gt } from "@retainpdf/domain/job";
import { n as Sa, d as fi, f as _n, k as Gr, b as mi, c as hi, j as Ce, p as lt, g as pi, l as mt, i as gi } from "./reader-regions-BmqHsJ-I.js";
import { fetchDocumentReading as yi } from "@retainpdf/api/documents";
import { isReaderTransportError as bi, createReaderTransportError as vi } from "./contracts.js";
import { toast as Wn, Toaster as wi } from "sonner";
import { ChevronLeft as Ia, PenLine as bn, ZoomIn as Si, Check as mr, X as bt, Copy as Ta, ChevronUp as Ii, ChevronDown as vn, History as Ti, LoaderCircle as ki, Pin as ka, LogOut as Ei, FileText as Ea, Columns2 as Ra, Languages as Pa, Radio as Ri, ArrowDownToLine as Pi, CheckCircle2 as Mi, ImagePlus as xi, MessageCircle as Ma, Scan as Ni, GitCompareArrows as _i, CodeXml as Ai, Highlighter as Li, Eraser as Ci, Undo2 as Di, Trash2 as $i, BookText as Oi, ChevronRight as xa, Minus as Na, Plus as _a, ArrowLeft as zi, CircleHelp as Fi, Download as Bi, Bookmark as Hi, Star as Aa, Contrast as ji, Search as La, PinOff as Ui } from "lucide-react";
import { Button as X, Textarea as Wi, IconButton as dt, Input as hr } from "@retainpdf/ui";
import { e as Ki, m as Vi, a as qi, c as Ji } from "./markdown-math-B8jhIfTG.js";
import { createPortal as Gi } from "react-dom";
import { pdfjs as Ca, Page as Xi, Document as Yi } from "react-pdf";
const Zi = (...e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, Qi = "", ec = Object.freeze({
  progress: "retainpdf-reader-progress"
}), tc = (e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, rb = (...e) => {
  var n;
  return (((n = Oe()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, ob = () => {
  var e, t;
  return ((t = (e = Oe()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
}, qe = () => Lt("defaultReaderDataPort"), Xr = () => Lt("defaultReaderPageConfigPort"), ab = {
  get apiPrefix() {
    return qe().apiPrefix;
  },
  fetchProtected: (...e) => qe().fetchProtected(...e),
  loadMarkdownPayload: (e) => qe().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => qe().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => qe().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => qe().loadJobPayload(e),
  loadReaderPayload: (e, t) => qe().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => qe().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return qe().liveTranslation;
  }
}, Da = {
  messageTargetOrigin: () => Xr().messageTargetOrigin(),
  readerJobId: () => Xr().readerJobId()
}, nc = () => {
  var e;
  return ((e = Oe()) == null ? void 0 : e.liveTranslation) ?? null;
}, Xt = () => {
  var t;
  const e = Oe();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, Ze = () => {
  const e = Oe();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => Lt("fetchDocumentByJobId")(...n),
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
}, rc = (...e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, oc = () => {
  var e, t;
  return ((t = (e = Oe()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, ac = (...e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, sc = (...e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? si(...e);
}, ic = (...e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? ii(...e);
}, cc = (...e) => Lt("downloadProtectedResource")(...e), lc = (...e) => Lt("failDownloadToast")(...e), sb = (e, t) => Lt("resolveMarkdownAssetUrl")(e, t), Yr = "/api/v1";
function uc() {
  const e = () => {
    var r;
    return ui(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = N(e);
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
function dc() {
  const e = uc(), t = U(() => ac(Da), [e]), n = U(() => oc(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function fc(e) {
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
  }), d = c.documentId === t ? c.jobId : "", m = u.documentId === t ? u.jobId : "", g = n || d, [h, b] = N({
    jobId: "",
    documentId: ""
  }), w = h.jobId === g ? h.documentId : "", I = t || w, y = !!t && !g, [S, v] = N(null), P = (S == null ? void 0 : S.sessionIdentity) === r && S.documentId === I ? S : null, M = y || !!P, E = L((_) => {
    const k = `${_.documentId || ""}`.trim();
    if (!k || a.current && a.current !== k) return;
    if (!a.current && s.current)
      b({
        jobId: s.current,
        documentId: k
      });
    else if (!a.current)
      return;
    const T = `${_.revision || ""}`.trim() || `${Date.now()}`;
    v({
      documentId: k,
      revision: T,
      sessionIdentity: o.current
    }), i();
  }, []);
  O(() => {
    v((_) => _ && _.sessionIdentity !== r ? null : _);
  }, [r]);
  const $ = L((_) => {
    switch (_.type) {
      case "resolved-document-job":
        l({ documentId: _.documentId, jobId: _.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        f({ documentId: _.documentId, jobId: _.jobId });
        break;
      case "resolved-job-document":
        b((k) => k.jobId === _.jobId && k.documentId === _.documentId ? k : { jobId: _.jobId, documentId: _.documentId });
        break;
      case "committed-source":
        v({
          documentId: _.documentId,
          revision: _.revision,
          sessionIdentity: _.sessionIdentity
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
    setResolvedJobDocument: b,
    jobDocumentId: w,
    documentId: I,
    sourceOnly: y,
    committedDocumentSource: S,
    setCommittedDocumentSource: v,
    activeCommittedDocumentSource: P,
    sourceViewOnly: M,
    refreshCommittedDocument: E,
    applyIdentityEvent: $
  };
}
function Zr(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function mc(e) {
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
function Qr(e, t) {
  return tc(Un(e, t));
}
function hc(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function pc(e, t) {
  const n = e == null ? void 0 : e.book_summary, r = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    n == null ? void 0 : n.title,
    e == null ? void 0 : e.source_file_name,
    n == null ? void 0 : n.source_file_name
  ];
  for (const o of r) {
    const a = `${o || ""}`.trim();
    if (a && !hc(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function Kn({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: ec.progress,
        stage: n,
        percent: e,
        text: t
      },
      Da.messageTargetOrigin()
    );
  } catch {
  }
}
function wn(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), Kn({ percent: t, text: n, stage: r });
}
function gc(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = N(null), [l, u] = N(null), [f, d] = N(""), [m, g] = N(0), h = f === n ? i : null, b = f === n ? l : null, w = Zr(h), I = Gt(w), y = L(() => {
    g(($) => $ + 1);
  }, []), S = L(($) => {
    c($.jobPayload), u($.manifestPayload), d($.sessionIdentity);
  }, []), v = L(($) => {
    c(null), u(null), d($);
  }, []), P = A(""), M = A(""), E = L(async () => {
    const $ = o.current;
    if (!$ || P.current === $) return;
    const _ = Ze().loadJobPayload;
    if (typeof _ != "function") return;
    const k = a.current.value;
    P.current = $;
    try {
      const T = await _($);
      if (s.current || a.current.value !== k || o.current !== $ || !T || typeof T != "object")
        return;
      const R = Zr(T);
      c(T), d(r.current), !Gt(R) && M.current === $ && (M.current = ""), R === "succeeded" && M.current !== $ && (M.current = $, g((D) => D + 1));
    } catch {
    } finally {
      P.current === $ && (P.current = "");
    }
  }, []);
  return O(() => {
    M.current = "";
  }, [n]), O(() => {
    if (!t || I || !h) return;
    const $ = window.setInterval(() => {
      document.visibilityState !== "hidden" && E();
    }, 1e3);
    return () => window.clearInterval($);
  }, [I, E, h, t]), {
    jobPayload: i,
    setJobPayload: c,
    manifestPayload: l,
    setManifestPayload: u,
    payloadSessionIdentity: f,
    setPayloadSessionIdentity: d,
    scopedJobPayload: h,
    scopedManifestPayload: b,
    jobStatus: w,
    jobTerminal: I,
    jobRefreshRevision: m,
    refreshJobArtifacts: y,
    refreshJobStatus: E,
    publishPayload: S,
    clearPayload: v
  };
}
function Vn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function yc(e, t) {
  e(t), Vn(t);
}
function bc(e) {
  const [t, n] = N(e ? "source" : "compare"), r = L((a) => {
    e && a !== "source" || (n(a), Vn(a));
  }, [e]), o = L((a) => {
    yc(n, a);
  }, []);
  return O(() => (e && document.documentElement.classList.add("reader-source-only"), Vn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function eo(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function vc(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: eo(n.active_job_id),
    activeVersionId: eo(n.active_version_id)
  };
}
function wc(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Sc(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Ic(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Tc = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function kc(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Tc.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const Ec = 48 * 1024 * 1024;
function Rc(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Pc = 2, $e = /* @__PURE__ */ new Map();
function qn(e, t) {
  $e.delete(e), $e.set(e, t);
}
function to(e) {
  if ($e.size < Pc) return;
  const t = $e.keys().next().value;
  t && $e.delete(t);
}
async function Mc(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function $a(e, t = Xt().fetchProtected, n = {}) {
  var u, f, d, m, g, h, b, w, I;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if ($e.has(r)) {
    const y = $e.get(r);
    return qn(r, y), y;
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
    const y = new Error(`读取 PDF 失败 (${s.status})`);
    y.status = s.status;
    const S = await Mc(s);
    throw S && (y.reason = S), y;
  }
  const i = xc(r, s, t);
  if (i) {
    o.abort();
    const y = { ranged: i };
    return to(), $e.set(r, y), y;
  }
  (b = (h = n.signal) == null ? void 0 : h.addEventListener) == null || b.call(h, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (I = (w = n.signal) == null ? void 0 : w.removeEventListener) == null || I.call(w, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return $e.has(r) ? qn(r, l) : (to(), $e.set(r, l)), l;
}
function xc(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < Ec ? null : {
    url: e,
    length: o,
    async fetchRange(i, c) {
      const l = await n(e, { headers: { Range: `bytes=${i}-${c - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const Nc = { file: null, loading: !1, error: "" }, _c = { file: null, loading: !0, error: "" };
function Ac(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = N(null);
  if (O(() => {
    if (t || !n) return;
    const s = $e.get(n);
    if (s) {
      qn(n, s);
      return;
    }
    const i = new AbortController();
    return $a(n, void 0, { signal: i.signal }).then((c) => {
      i.signal.aborted || o({ url: n, file: c, loading: !1, error: "" });
    }).catch((c) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (c == null ? void 0 : c.message) || String(c) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Nc;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = $e.get(n);
  return a ? { file: a, loading: !1, error: "" } : _c;
}
function Lc(e) {
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
async function Jn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  wn(s, r, n, "download");
  const i = await $a(t, Xt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (wn(s, o, n, "download"), i);
}
async function Cc(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  wn(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    Jn({
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
    Jn({
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
function Dc(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function $c({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = yi,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(Dc(o.href, t, a)), !0);
}
const sn = {
  regions: null,
  metadata: null
};
function Oc(e) {
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
    closingRef: b,
    activeLoadAbortRef: w
  } = e, [I, y] = N(""), [S, v] = N(""), [P, M] = N(null), [E, $] = N(null), [_, k] = N(!1), [T, R] = N(""), [D, z] = N([]), [K, j] = N(!1), [J, oe] = N(() => ({
    source: null,
    translated: null
  })), [q, se] = N(
    sn
  ), [Ee, re] = N({
    loading: !0,
    percent: 4,
    text: Ve.boot,
    stage: "progress",
    failed: !1
  });
  return O(() => {
    const ue = new AbortController(), Me = h.current.value, ie = Lc({
      sessionEpochRef: h,
      closingRef: b,
      abort: ue,
      sessionEpoch: Me
    });
    w.current = ue;
    const le = Ze();
    if (b.current)
      return ue.abort(), () => {
        w.current === ue && (w.current = null);
      };
    let B = !1;
    function W(ee, Z) {
      ie.markFailed(), j(!0), re({
        loading: !1,
        percent: 100,
        text: ee,
        stage: "failed",
        failed: !0
      }), Kn({ percent: 100, text: Z, stage: "failed" });
    }
    function Y() {
      k(!0), B || j(!0), re({
        loading: !1,
        percent: 100,
        text: Ve.ready,
        stage: "ready",
        failed: !1
      }), Kn({ percent: 100, text: Ve.ready, stage: "ready" });
    }
    function de() {
      return l != null && l.documentId ? Qr(
        l.documentId,
        l.revision
      ) : Zi() ? Qi : le.resolveResourceUrl(Un(r));
    }
    async function ne() {
      var H;
      let ee = { activeJobId: "", activeVersionId: "" };
      try {
        const V = await ((H = le.fetchDocument) == null ? void 0 : H.call(le, r));
        V && (ee = vc(V));
      } catch {
      }
      const Z = wc({
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
      y(fe), v(""), R(""), d(c);
      const x = await Jn({
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
      var be;
      const ee = !l, Z = !!(ee && le.loadSessionSnapshot && le.loadReaderOptionalArtifacts), fe = Z ? le.loadReaderOptionalArtifacts(t) : null, x = await ((be = le.loadSessionSnapshot) == null ? void 0 : be.call(le, {
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
            V = await le.fetchDocumentByJobId(Yr, t);
          } catch {
          }
          if (ie.isInactive()) return;
        }
      const me = mc(H.jobPayload) || `${(V == null ? void 0 : V.document_id) || ""}`.trim();
      me && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: me
      });
      const ye = Sc({
        payloadDocumentId: me,
        linkedActiveJobId: `${(V == null ? void 0 : V.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(V == null ? void 0 : V.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (ye.kind === "restore-committed-source") {
        if (ie.isInactive()) return;
        u({
          type: "committed-source",
          documentId: ye.documentId,
          revision: ye.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const Ie = le.resolveReaderSourcePdf(H.manifestPayload), Ne = le.resolveReaderTranslatedPdfUrl(H.jobPayload, H.manifestPayload), ze = typeof Ie == "string" ? Ie : le.resolveReaderArtifactUrl(Ie), He = r || me, Qe = l != null && l.documentId ? Qr(
        l.documentId,
        l.revision
      ) : ze || (He ? le.resolveResourceUrl(Un(He)) : ""), De = l ? "" : Ne || "";
      y(Qe || ""), v(De), R(pc(H.jobPayload, t)), f({
        jobPayload: H.jobPayload || null,
        manifestPayload: H.manifestPayload || null,
        sessionIdentity: c
      });
      const Ke = () => Cc({
        sourceFinal: Qe || "",
        translatedFinal: De,
        fence: ie,
        setBoot: re
      }), et = !!(Qe || De), tt = fe && et ? Ke() : null;
      tt == null || tt.catch(() => {
      });
      const St = (F) => {
        ie.isInactive() || (z(l ? [] : Sa(F.regionsPayload)), oe(l ? { source: null, translated: null } : fi(F.readerMetadata)), se(l ? sn : F.readerErrors ?? sn), j(!0));
      };
      if (fe ? (B = !0, fe.then(St)) : St(H), !et) {
        W(Ve.failed, Ve.failed);
        return;
      }
      const nt = await (tt ?? Ke());
      if (nt.status !== "inactive") {
        if (nt.status === "incomplete") {
          W("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        M(nt.sourceBytes), $(nt.translatedBytes), Y();
      }
    }
    async function Se() {
      k(!1), M(null), $(null), z([]), j(!1), oe({ source: null, translated: null }), se(sn), wn(re, 8, Ve.metadata, "metadata");
      try {
        if (s) {
          await ne();
          return;
        }
        if (!t) {
          W(Ve.failed, Ve.failed);
          return;
        }
        await ae();
      } catch (ee) {
        if (ie.isClosedOrStale() || (ee == null ? void 0 : ee.name) === "AbortError") return;
        ie.markFailed();
        const Z = Number(ee == null ? void 0 : ee.status), fe = `${(ee == null ? void 0 : ee.reason) || ""}`, x = kc({ status: Z, reason: fe, sessionJobId: t });
        if (x && (await $c({
          apiPrefix: Yr,
          documentId: x,
          expiredJobId: t
        }) || ie.isClosedOrStale()))
          return;
        if (Ic({
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
        const H = ee instanceof Error ? ee.message : Ve.failed;
        W(H, H);
      }
    }
    return Se(), () => {
      ue.abort(), w.current === ue && (w.current = null);
    };
  }, [t, r, o, a, s, i, l, g, n, c, u, f, d, m]), {
    sourceUrl: I,
    translatedUrl: S,
    sourceFile: P,
    translatedFile: E,
    assetsReady: _,
    title: T,
    regions: D,
    regionsSettled: K,
    readerMetadata: J,
    readerErrors: q,
    boot: Ee
  };
}
function zc() {
  const e = A(!1), t = A(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = dc(), s = A({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = A(a), c = A(""), l = A(""), u = A(() => {
  }), f = L(() => u.current(), []), d = fc({
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
    sourceViewOnly: b
  } = d, { mode: w, setMode: I, switchSessionMode: y } = bc(b);
  u.current = () => {
    y("source");
  }, i.current = a, c.current = g, l.current = m;
  const S = gc({
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
    refreshJobArtifacts: _,
    refreshJobStatus: k
  } = S, T = Oc({
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
    publishPayload: S.publishPayload,
    clearPayload: S.clearPayload,
    switchSessionMode: y,
    jobRefreshRevision: $,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), R = L(() => {
    var z;
    e.current = !0, (z = t.current) == null || z.abort();
  }, []), D = U(
    () => ({
      fetchProtected: Ze().fetchProtected,
      jobId: m,
      jobPayload: v,
      manifestPayload: P,
      sourceUrl: T.sourceUrl,
      translatedUrl: T.translatedUrl,
      sourceOnly: b
    }),
    [m, v, P, T.sourceUrl, T.translatedUrl, b]
  );
  return {
    jobId: m,
    jobStatus: M,
    workflow: `${(v == null ? void 0 : v.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: E,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: h,
    mode: w,
    setMode: I,
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
    refreshJobArtifacts: _,
    refreshJobStatus: k,
    refreshCommittedDocument: d.refreshCommittedDocument,
    prepareClose: R
  };
}
const Fc = 160, Bc = 8, Hc = 0;
function jc() {
  const e = A(null), [t, n] = N(null), [r, o] = N(Hc), a = L((s) => {
    e.current = s, n(s);
  }, []);
  return O(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (l) => {
      !Number.isFinite(l) || l < Fc || o((u) => Math.abs(u - l) < Bc ? u : l);
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
function Uc(e) {
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
const An = { source: 0, translated: 0 };
function Wc(e, t) {
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
  const [f, d] = N(() => ({
    identity: l,
    pages: An
  })), [m, g] = N(() => ({ identity: l, tick: 0 })), h = f.identity === l ? f.pages : An, b = m.identity === l ? m.tick : 0, w = Uc({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: I } = w, y = L((k, T) => {
    u.current === l && d((R) => {
      const D = R.identity === l ? R.pages : An;
      return D[T] === k && R.identity === l ? R : {
        identity: l,
        pages: { ...D, [T]: k }
      };
    });
  }, [l]), S = A(null), v = L(() => {
    S.current && clearTimeout(S.current);
    const k = l;
    S.current = setTimeout(() => {
      S.current = null, u.current === k && g((T) => ({
        identity: k,
        tick: T.identity === k ? T.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  O(() => (S.current && (clearTimeout(S.current), S.current = null), d((k) => k.identity === l && k.pages.source === 0 && k.pages.translated === 0 ? k : { identity: l, pages: { source: 0, translated: 0 } }), g((k) => k.identity === l && k.tick === 0 ? k : { identity: l, tick: 0 }), () => {
    S.current && (clearTimeout(S.current), S.current = null);
  }), [l]);
  const P = U(
    () => Math.max(h.source, h.translated),
    [h]
  ), M = I === "translated" ? h.translated : h.source || h.translated, E = t == null ? void 0 : t.userZoom, $ = t == null ? void 0 : t.shellWidth, _ = `${l}-${b}-${E}-${n}-${h.source}-${h.translated}-${$}`;
  return {
    ...w,
    numPagesByPane: h,
    hudNumPages: P,
    primaryNumPages: M,
    metricsTick: b,
    onNumPages: y,
    onMetrics: v,
    rowSyncRevision: _
  };
}
const ke = "data-reader-page", we = "data-reader-pane", pr = "data-natural-height", Oa = "reader-react-root", za = "reader-react-grid", Fa = "reader-react-scroll-shell", rn = "reader-react-pdf-pane", Ba = "reader-react-pdf-page", Sn = "reader-react-pdf-page-placeholder", gr = "reader-react-pdf-page-slot";
function In(e, t) {
  const n = e != null ? `[${ke}="${e}"]` : `[${ke}]`;
  return t ? `${n}[${we}="${t}"]` : n;
}
function yr() {
  return `.${gr}[${ke}]`;
}
function Tn(e) {
  return Number(e.getAttribute(ke));
}
const Ha = 0.25, kn = 1, Kc = 0.05, on = 0.5, Vc = 16, qc = 8, ja = Vc + qc, Jc = 720;
function Pt() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function Ua(e) {
  return Number.isFinite(e) && e < Jc;
}
function Et(e, t = Number.POSITIVE_INFINITY) {
  return Ua(t) && (e === "source" || e === "translated") ? kn : on;
}
function Xe(e) {
  return Number.isFinite(e) ? Math.min(kn, Math.max(Ha, e)) : on;
}
function Yt(e, t) {
  const n = Xe(Number(e) + t * Kc);
  return Math.round(n * 100) / 100;
}
function Gc(e) {
  return Math.round(Xe(e) * 100);
}
function Wa(e) {
  const n = (Number(e) || 0) - ja;
  return Math.max(160, Math.floor(n));
}
function Xc(e, t = on) {
  const n = Xe(t);
  return Wa((Number(e) || 0) * n);
}
function Yc(e, t) {
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
const Zc = 8;
function Qc(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < Zc ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const Ka = 200, el = [
  "markdown"
], tl = el;
function Va(e) {
  return tl.includes(e);
}
const nl = "retainpdf:reader:view:v1:", no = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), rl = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function qa() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Gn(e) {
  return `${e || ""}`.trim();
}
function ol({
  documentId: e,
  jobId: t
}) {
  const n = Gn(e);
  if (n) return `document:${n}`;
  const r = Gn(t);
  return r ? `job:${r}` : "";
}
function Ja(e) {
  const t = Gn(e);
  return t ? `${nl}${t}` : "";
}
function al(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function sl(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!no.has(t) || !no.has(n) || t === n))
    return { left: t, right: n };
}
function il(e) {
  return e === null ? null : Va(e) ? e : void 0;
}
function cl(e) {
  return rl.has(e) ? e : void 0;
}
function Ga(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = al(t.anchor), r = Number(t.zoom), o = cl(t.mode), a = sl(t.splitLayout), s = il(t.assistantPanel);
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
function We(e, t = qa()) {
  const n = Ja(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? Ga(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function xn(e, t, n = qa()) {
  const r = Ja(e);
  if (!r || !n) return null;
  const o = We(e, n), a = Ga({
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
function ll(e, t, n = "") {
  var d;
  const [r, o] = N(() => {
    var m;
    return ((m = We(n)) == null ? void 0 : m.zoom) ?? Et(e, Pt());
  }), a = A(r), s = A(n);
  a.current = r;
  const i = A(1), c = A(((d = We(n)) == null ? void 0 : d.zoom) !== void 0);
  O(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const m = (h = We(n)) == null ? void 0 : h.zoom;
    c.current = m !== void 0;
    const g = m ?? Et(e, Pt());
    i.current = 1, a.current = g, o(g);
  }, [e, n]), O(() => {
    if (c.current) return;
    const m = Et(e, Pt()), g = a.current;
    Math.abs(m - g) < 5e-4 || (i.current = 1, a.current = m, o(m));
  }, [e]);
  const l = L((m, g) => {
    const h = Xe(m), b = a.current;
    Math.abs(h - b) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : h / (b || 1), a.current = h, c.current = !0, xn(s.current, { zoom: h }), o(h));
  }, []), u = L((m) => {
    l(Yt(a.current, m));
  }, [l]), f = L((m) => {
    l(Et(m));
  }, [l]);
  return Le(() => {
    const m = i.current;
    Math.abs(m - 1) < 1e-3 || (i.current = 1, Yc(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: f };
}
const ul = 160, dl = 3e-3, ro = 50, fl = 16, ml = 800;
function hl(e, t = 0) {
  const n = t === 1 ? fl : t === 2 ? ml : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-ro, Math.min(ro, r));
  return Math.exp(-o * dl);
}
function pl(e, t, n = 0) {
  return Xe(e * hl(t, n));
}
function gl(e) {
  return Math.round(Xe(e) * 100) / 100;
}
function yl(e, t, n) {
  const r = Xe(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return Xe(t) / r;
  const a = (o + ja) / r;
  return Wa(a * Xe(t)) / o;
}
function bl(e) {
  return Array.from(e.querySelectorAll(yr()));
}
function vl(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function wl(e, t, n) {
  let r = null;
  for (const s of bl(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const c = vl(i, t, n);
    if ((!r || c < r.distance) && (r = { el: s, rect: i, distance: c }), c === 0) break;
  }
  if (!r) return null;
  const { el: o, rect: a } = r;
  return {
    page: o.getAttribute(ke) || "",
    pane: o.getAttribute(we) || "",
    fracX: (t - a.left) / a.width,
    fracY: (n - a.top) / a.height,
    clientX: t,
    clientY: n,
    pageWidth: a.width
  };
}
function Sl(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function Xa(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${yr()}[${ke}="${t.page}"][${we}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (Sl(n, e).scrollLeft += a);
}
function Il(e, t, n, r) {
  const o = e.querySelector(`.${za}`);
  if (!o) return null;
  if (!o.style.transformOrigin) {
    const a = o.getBoundingClientRect();
    o.style.transformOrigin = `${n - a.left}px ${r - a.top}px`, o.style.willChange = "transform";
  }
  return o.style.transform = `scale(${t})`, o;
}
function $t(e) {
  e && (e.style.transform = "", e.style.transformOrigin = "", e.style.willChange = "");
}
const Tl = 600, kl = 1e3;
function El(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || Xa(e, t);
  });
  a.observe(n);
  const s = (u) => {
    u.type === "wheel" && u.ctrlKey || l();
  }, i = ["wheel", "keydown", "pointerdown", "touchstart"];
  for (const u of i) r.addEventListener(u, s, { capture: !0, passive: !0 });
  const c = r.setTimeout(() => l(), kl);
  function l() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(c);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return l;
}
function Rl(e, t, n) {
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
      const f = gl(u.target);
      if (Math.abs(f - r.current) < 5e-3) {
        $t(u.grid);
        return;
      }
      const d = { anchor: u.anchor, grid: u.grid, fallback: null };
      d.fallback = setTimeout(() => {
        s.current === d && (s.current = null, $t(d.grid));
      }, Tl), s.current = d, o.current(f, { keepScroll: !1 });
    }, l = (u) => {
      var m, g;
      if (!u.ctrlKey) return;
      u.preventDefault();
      let f = a.current;
      if (!f) {
        (m = i.current) == null || m.call(i), i.current = null;
        const h = s.current;
        h && (h.fallback && clearTimeout(h.fallback), s.current = null, $t(h.grid)), f = {
          start: r.current,
          target: r.current,
          anchor: wl(e, u.clientX, u.clientY),
          grid: null,
          timer: null
        }, a.current = f;
      }
      f.target = pl(f.target, u.deltaY, u.deltaMode);
      const d = yl(f.start, f.target, ((g = f.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      f.grid = Il(e, d, u.clientX, u.clientY) ?? f.grid, f.timer && clearTimeout(f.timer), f.timer = setTimeout(c, ul);
    };
    return e.addEventListener("wheel", l, { passive: !1 }), () => {
      var f;
      e.removeEventListener("wheel", l);
      const u = a.current;
      a.current = null, u != null && u.timer && clearTimeout(u.timer), $t((u == null ? void 0 : u.grid) ?? null), (f = i.current) == null || f.call(i), i.current = null;
    };
  }, [e]), Le(() => {
    var l;
    const c = s.current;
    c && (s.current = null, c.fallback && clearTimeout(c.fallback), $t(c.grid), !(!e || !c.anchor) && (Xa(e, c.anchor), (l = i.current) == null || l.call(i), i.current = El(e, c.anchor)));
  }, [t, e]);
}
function Pl(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = A(t), a = A(n), s = A(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: L((c) => {
    c !== o.current && (s.current(), a.current(c));
  }, []) };
}
const br = 56;
function Ya(e, t = br) {
  return e.getBoundingClientRect().top + t;
}
function Za(e, t) {
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
  const o = Tn(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function Vt(e, t, n = br) {
  if (!e)
    return null;
  const r = In(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = Ya(e, n), i = Za(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function _t(e, t, n = "auto", r, o = br) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(In(a, r))), i || (i = e.querySelector(In(a))), !i)
    return !1;
  const c = e.getBoundingClientRect(), l = i.getBoundingClientRect();
  if (c.height <= 0 || l.height < 8 && i.offsetHeight < 8)
    return !1;
  const u = l.height > 0 ? l.height : i.offsetHeight, f = e.scrollTop + (l.top - c.top), d = Math.max(0, f + s * u - o);
  return n === "auto" ? Math.abs(e.scrollTop - d) >= 1 && (e.scrollTop = d) : e.scrollTo({ top: d, behavior: n }), !0;
}
function Ml(e, t, n = "smooth", r) {
  return _t(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function Xn(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const i = [], c = () => {
    var u;
    if (a) return;
    _t(
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
function xl(e, t, n) {
  return Xn(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function En(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function Fe(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function Nl(e, t, n = !0, r = "", o) {
  const [a, s] = N(1);
  return O(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const i = e.current;
    if (!i)
      return;
    let c = !1, l = null, u = 0;
    const f = In(void 0, o), d = () => {
      if (c) return;
      const h = Array.from(i.querySelectorAll(f));
      if (!h.length)
        return;
      const b = Ya(i), w = Za(h, b);
      w && s(w.page);
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
const _l = `canvas, .react-pdf__Page, .${Ba}, .${Sn}`, oo = /* @__PURE__ */ new WeakMap();
function Al(e) {
  const t = Number(e.getAttribute(pr));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = oo.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(_l), oo.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Ll(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Cl(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(yr()).forEach((r) => {
    const o = Tn(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = Al(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Dl(e, t, n = "", r) {
  const [o, a] = N(() => /* @__PURE__ */ new Map()), s = A(o), i = A(r);
  return i.current = r, Le(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let c = !1, l = 0, u = !1, f = !1;
    const d = () => {
      var v;
      if (c) return;
      const y = e.current;
      if (!y) return;
      const S = Cl(y);
      Ll(s.current, S) || (s.current = S, a(S)), u && !f && (f = !0, (v = i.current) == null || v.call(i));
    }, m = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(d);
      });
    };
    m();
    const g = window.setTimeout(m, 100), h = window.setTimeout(() => {
      u = !0, m();
    }, 300), b = window.setTimeout(m, 700), w = e.current;
    let I = null;
    return w && typeof ResizeObserver < "u" && (I = new ResizeObserver(() => m()), I.observe(w)), () => {
      c = !0, cancelAnimationFrame(l), window.clearTimeout(g), window.clearTimeout(h), window.clearTimeout(b), I == null || I.disconnect();
    };
  }, [e, t, n]), o;
}
const $l = [0, 48, 140, 320, 560], Ol = 700, zl = [80, 200, 400], Fl = 500, Bl = 50, Hl = /* @__PURE__ */ new Set([
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
]), jl = 180, ao = [0, 48, 140, 320, 700, 1200];
function Ul(e, t) {
  var T;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = A(
    ((T = We(a)) == null ? void 0 : T.anchor) || { page: 1, fraction: 0 }
  ), c = A(null), l = A(!1), u = A(r), f = A(null), d = A(null), m = A(null), g = A(null), h = A(a), b = A(""), w = A(n);
  w.current = n;
  const I = L(() => {
    var R;
    (R = f.current) == null || R.call(f), f.current = null, d.current != null && (clearTimeout(d.current), d.current = null);
  }, []), y = L(() => {
    !l.current && c.current == null || (I(), m.current != null && (clearTimeout(m.current), m.current = null), c.current = null, l.current = !1);
  }, [I]), S = L((R = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const D = () => {
      g.current = null, xn(h.current, {
        anchor: Fe(i.current)
      });
    };
    R ? D() : g.current = setTimeout(D, jl);
  }, []), v = L((R) => {
    i.current = Fe(R), c.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, l.current = !1;
    }, Bl);
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
        const oe = Vt(D, w.current);
        oe && (i.current = oe, S());
      }, D.addEventListener("scroll", z, { passive: !0 }), l.current || z();
    };
    return j(), () => {
      R = !0, K != null && clearTimeout(K), D && z && D.removeEventListener("scroll", z);
    };
  }, [o, r, n, e, S]), O(() => {
    if (!o) return;
    const R = e.current;
    if (!R) return;
    const D = (z) => {
      z.metaKey || z.ctrlKey || z.altKey || Hl.has(z.key) && y();
    };
    return R.addEventListener("wheel", y, { passive: !0 }), R.addEventListener("touchmove", y, { passive: !0 }), window.addEventListener("keydown", D), () => {
      R.removeEventListener("wheel", y), R.removeEventListener("touchmove", y), window.removeEventListener("keydown", D);
    };
  }, [o, e, y]), Le(() => {
    var D;
    if (h.current === a) return;
    S(!0), I(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, b.current = "";
    const R = (D = We(a)) == null ? void 0 : D.anchor;
    i.current = R ? Fe(R) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, u.current = r;
  }, [a, r, S, I]), O(() => {
    var D;
    if (!o || !s || !a || b.current === a) return;
    b.current = a;
    const R = Fe(
      ((D = We(a)) == null ? void 0 : D.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = R, c.current = R, l.current = !0, I(), f.current = Xn(
      () => e.current,
      R,
      {
        behavior: "auto",
        pane: w.current,
        delaysMs: ao,
        onDone: () => v(R)
      }
    ), d.current = setTimeout(() => {
      d.current = null, v(R);
    }, Math.max(...ao) + 160), () => I();
  }, [o, s, a, e, v, I]), O(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, c.current = null, I();
      return;
    }
    const R = c.current ? Fe(c.current) : Fe(i.current);
    return l.current = !0, c.current = R, i.current = R, I(), f.current = Xn(
      () => e.current,
      R,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: $l,
        onDone: () => v(R)
      }
    ), d.current = setTimeout(() => {
      d.current = null, v(R);
    }, Ol), () => {
      I();
    };
  }, [r, o, n, e, v, I]), O(() => () => {
    I(), m.current != null && (clearTimeout(m.current), m.current = null), S(!0);
  }, [I, S]);
  const P = L(() => {
    const R = Vt(
      e.current,
      w.current
    );
    return Fe(R || i.current);
  }, [e]), M = L(() => {
    l.current = !0;
    const R = Vt(
      e.current,
      w.current
    ), D = Fe(R ?? i.current);
    return i.current = D, c.current = D, S(), D;
  }, [e, S]), E = L((R, D, z) => {
    const K = z || w.current, j = En(R, D || 1), J = { page: j, fraction: 0 };
    i.current = J, l.current = !0, c.current = J, S(), I(), Ml(e.current, j, "smooth", K), f.current = xl(
      () => e.current,
      j,
      {
        behavior: "auto",
        pane: K,
        delaysMs: zl,
        onDone: () => v(J)
      }
    ), d.current = setTimeout(() => {
      d.current = null, v(J);
    }, Fl);
  }, [e, v, I, S]), $ = L(() => Fe(i.current), []), _ = L(() => l.current, []), k = L(() => {
    if (!l.current || !c.current)
      return;
    const R = Fe(c.current);
    _t(
      e.current,
      R,
      "auto",
      w.current
    );
  }, [e]);
  return {
    lockFromShell: P,
    beginModeSwitch: M,
    goToPage: E,
    getAnchor: $,
    isRestoring: _,
    repinIfRestoring: k
  };
}
function Wl(e, t) {
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
function Qa(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const Kl = [0, 80, 200, 400, 800], Vl = 120, ql = 400;
function Jl(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: c, documentId: l, regionsSettled: u = !0 } = e, f = A(a);
  f.current = a;
  const d = A(s);
  d.current = s;
  const m = A(i);
  m.current = i;
  const g = A(n);
  g.current = n, O(() => {
    var S, v;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = rc(), b = Wl(h, d.current);
    if (b == null && (h != null && h.blockId) && !u) return;
    const w = Qa(h, b, { jobId: c, documentId: l });
    if (t.current === w)
      return;
    if (b == null) {
      t.current = w, (S = g.current) == null || S.call(g);
      return;
    }
    t.current = w, h && ((v = m.current) == null || v.call(m, h, b));
    const I = [];
    let y = 0;
    for (const P of Kl)
      y = Math.max(y, P), I.push(
        setTimeout(() => {
          f.current(b);
        }, P)
      );
    return I.push(
      setTimeout(() => {
        var P;
        (P = g.current) == null || P.call(g);
      }, y + Vl)
    ), () => {
      for (const P of I) clearTimeout(P);
    };
  }, [r, o, c, l, t, u]);
}
function Gl(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function Xl(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = ql,
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
      var w;
      const g = ((w = globalThis.location) == null ? void 0 : w.search) || "", h = di(g, o, u.current);
      if (d.current = o, h === null) return;
      const b = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = Qa(
        { blockId: b },
        o,
        { jobId: i, documentId: c }
      ), (f.current || Gl)(h);
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
function Yl(e) {
  const t = A(""), [n, r] = N(!1), o = L(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  Jl(a, t, o), Xl(e, t, n);
}
const Ot = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function Zl(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function so(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function es(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = so(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = so(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function Ql(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = es(r, t, n);
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
function eu(e) {
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
function tu(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function nu(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function ru(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function ou(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const io = [250, 500, 1e3, 2e3, 4e3], Ln = [80, 160, 320, 640, 1e3, 1500], co = [250, 500, 1e3, 2e3, 4e3, 5e3];
function Yn(e, t) {
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
function vr(e) {
  return bi(e) ? `${e.code || ""}`.trim() : "";
}
function cn(e, t) {
  const n = vr(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function au(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (es(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
        return c;
      a = vi(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (c) {
      if ((c == null ? void 0 : c.name) === "AbortError") throw c;
      a = c;
      const l = vr(c);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw c;
    }
    const i = Ln[Math.min(s, Ln.length - 1)];
    if (await Yn(i, r), s >= Ln.length + 2) throw a;
  }
}
function su({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = N(Ot), s = A(o), i = A("");
  s.current = o;
  const c = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = Gt(l) ? l : "";
  return O(() => {
    if (!n || !c) {
      i.current = "", s.current = Ot, a(Ot);
      return;
    }
    const f = r === void 0 ? nc() : r, d = i.current === c;
    if (i.current = c, !f) {
      const y = {
        ...d ? s.current : Ot,
        connection: u ? "terminal" : "unavailable",
        jobStatus: l,
        error: "实时译文暂不可用"
      };
      s.current = y, a(y);
      return;
    }
    const m = new AbortController();
    let g = !1;
    const h = {
      ...d ? s.current : Ot,
      connection: u ? "terminal" : "connecting",
      jobStatus: l,
      error: ""
    };
    s.current = h, a(h);
    const b = (y) => {
      m.signal.aborted || a((S) => {
        const v = y(S);
        return s.current = v, v;
      });
    }, w = async () => {
      let y = 0;
      for (; !m.signal.aborted; )
        try {
          const S = await f.fetchLayout(c, { signal: m.signal });
          g = !0, b((v) => ({
            ...v,
            layoutByPage: Zl(S),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (S) {
          if ((S == null ? void 0 : S.name) === "AbortError") return;
          const v = vr(S);
          if (!(v === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !v)) {
            b((M) => ({
              ...M,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: cn(S, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            b((M) => ({
              ...M,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          b((M) => ({
            ...M,
            connection: "connecting",
            jobStatus: l,
            error: cn(S, "正在等待 OCR 版面数据")
          })), await Yn(io[Math.min(y, io.length - 1)], m.signal).catch(() => {
          }), y += 1;
        }
    };
    return (async () => {
      if (await w(), !g || m.signal.aborted) return;
      let y = 0;
      for (; !m.signal.aborted; ) {
        u || b((S) => ({
          ...S,
          connection: S.lastSeq > 0 ? "reconnecting" : "connecting",
          jobStatus: l,
          // 保留已有错误：首页还没提交（lastSeq 为 0）时恰恰是最容易出错的阶段，
          // 此前这里把它清成空串，UI 于是一直显示「连接中」，用户看到的是
          // "正在努力"，实际可能已经在反复失败。
          error: S.error
        }));
        try {
          await f.streamEvents(c, {
            afterSeq: s.current.lastSeq,
            signal: m.signal,
            onEvent: async (S) => {
              if (S.seq <= s.current.lastSeq) return;
              let v;
              try {
                v = await au(
                  c,
                  S,
                  s.current,
                  m.signal,
                  f
                );
              } catch (P) {
                if ((P == null ? void 0 : P.name) === "AbortError" || m.signal.aborted) throw P;
                b((M) => ({
                  ...M,
                  lastSeq: Math.max(M.lastSeq, S.seq),
                  error: cn(P, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              b((P) => {
                const M = Ql(P, S, v);
                return u ? {
                  ...M,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...M,
                  jobStatus: l
                };
              }), y = 0;
            }
          });
        } catch (S) {
          if ((S == null ? void 0 : S.name) === "AbortError" || m.signal.aborted) return;
          b((v) => ({
            ...v,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: l,
            error: cn(S, "实时译文连接已中断，正在重连")
          }));
        }
        if (m.signal.aborted) return;
        if (u) {
          b((S) => ({
            ...S,
            connection: "terminal",
            jobStatus: l
          }));
          return;
        }
        await Yn(co[Math.min(y, co.length - 1)], m.signal).catch(() => {
        }), y += 1;
      }
    })(), () => m.abort();
  }, [n, r, c, u]), o;
}
function iu(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), c = Number(s.count) || 0;
    i && c > 0 && o.set(i, c);
  }
  return o;
}
function cu(e, t = !0) {
  const [n, r] = N(() => /* @__PURE__ */ new Map());
  return O(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = Ze().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(iu(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const lu = 4500;
function uu(e) {
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
const du = /* @__PURE__ */ new Set(["book", "translate"]);
function ts(e) {
  return !!(e.jobId && e.sourceUrl && du.has(e.workflow));
}
function fu(e) {
  return !!(ts(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function mu() {
  const e = zc(), t = ts({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = fu({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = A({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Gt(o) && (r.current.running = !0);
  const a = su({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = jc(), u = cu(e.jobId, !e.sourceOnly), f = ol({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: g } = ll(e.mode, s, f);
  Rl(i, m, g);
  const h = Wc(
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
    beginModeSwitch: b,
    goToPage: w,
    repinIfRestoring: I
  } = Ul(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: h.primaryNumPages > 0
  });
  O(() => {
    I();
  }, [c, I]);
  const y = Dl(
    s,
    h.compareMode,
    h.rowSyncRevision,
    I
  ), S = Nl(
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
    w(j, oe, J);
  }, [w, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [P, M] = N(null), E = A(null), $ = L((j) => {
    E.current && clearTimeout(E.current), M(j), j && (E.current = setTimeout(() => M(null), lu));
  }, []);
  O(() => () => {
    E.current && clearTimeout(E.current);
  }, []);
  const _ = L((j) => {
    const J = _n(e.regions, j);
    return J ? Gr(J, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), k = L((j, J) => {
    const oe = J || h.primaryPane, q = typeof j == "object" && j ? `${j.block_id || ""}`.trim() : "", se = typeof j == "object" && j ? `${j.image_url || ""}`.trim() : "", Ee = typeof j == "object" && j ? j.page_idx != null ? Number(j.page_idx) + 1 : j.page != null ? Number(j.page) : null : typeof j == "number" ? j + 1 : null, re = mi(e.regions, se, Ee) || _n(e.regions, q) || (typeof j == "object" ? hi(e.regions, j) : null);
    let ue = re ? Gr(re, oe).page : null;
    ue == null && (ue = uu(j)), !(ue == null || ue < 1) && ($(re), v(ue, oe));
  }, [$, v, h.primaryPane, e.regions]);
  Yl({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: S,
    goToPage: v,
    resolveBlockPage: _,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (j) => {
      $(_n(e.regions, j.blockId));
    }
  });
  const { setModeKeepingPage: T } = Pl({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: b
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
    rowHeights: y,
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
  }), [e, D, h, z, y, v, P, k, T, R, m, g, f, a, n, u]);
  return U(() => ({
    ...K,
    currentPage: S
  }), [K, S]);
}
const hu = [
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
], pu = [
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
function gu(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of hu)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function yu(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const bu = ".reader-notes-panel";
function vu(e) {
  return e instanceof Element ? !!e.closest(bu) : !1;
}
function wu(e) {
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
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || yu(d.target) || vu(d.target))
        return;
      const m = d.key, g = gu(m);
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
              a(Yt(o, 1));
              return;
            case "zoom-out":
              a(Yt(o, -1));
              return;
            case "zoom-reset":
              a(Et(t, Pt()));
              return;
            case "next-page":
              c(En(s + 1, i));
              return;
            case "prev-page":
              c(En(s - 1, i));
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
const Pe = { size: 16, strokeWidth: 1.75 }, lo = { size: 12, strokeWidth: 1.75 }, Su = "retainpdf:soft-reader-close";
function Iu() {
  return new URL("./index.html", window.location.href).href;
}
function Tu() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Su },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function ku(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Eu() {
  if (!(typeof window > "u") && !Tu()) {
    if (ku(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Iu());
  }
}
function Ru({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function Pu({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ C(Ru, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Eu();
  }, children: [
    /* @__PURE__ */ p(Ia, { className: "reader-close-home-icon", ...Pe, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "返回" })
  ] });
}
const Mu = 3e3, xu = 8;
async function Nu(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function _u(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function Au(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = Mu;
  const r = [], o = (s, i, c) => {
    const l = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const f = s[u], d = _u(f == null ? void 0 : f.title);
      if (!d) continue;
      n -= 1;
      const m = c ? `${c}.${u}` : `${u}`, g = { id: m, title: d, page: null, level: i, children: [] };
      r.push({ node: g, dest: f.dest }), l.push(g), i < xu && Array.isArray(f.items) && f.items.length && (g.children = o(f.items, i + 1, m));
    }
    return l;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await Nu(e, i);
  })), a;
}
function ns(e) {
  const t = [], n = (r) => {
    for (const o of r)
      t.push(o), n(o.children);
  };
  return n(e), t;
}
function Lu(e, t) {
  let n = null;
  for (const r of ns(e))
    r.page === null || r.page > t || (!n || r.page > (n.page ?? 0) || r.page === n.page && r.id.startsWith(`${n.id}.`)) && (n = r);
  return (n == null ? void 0 : n.id) ?? null;
}
let uo = !1;
function Cu() {
  if (uo)
    return;
  const e = Xt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (Ca.GlobalWorkerOptions.workerSrc = e, uo = !0);
}
const st = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Du = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, $u = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Ou = {
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
}, fo = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function zu(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => fo(o ?? a ?? "", Du)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => fo(o ?? a ?? "", $u)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Ou[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Fu(e) {
  return st(e.translatedBlockText) || st(e.translated.text) || st(e.source.text);
}
const Bu = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Hu(e) {
  const t = [];
  for (const n of e) {
    if (!Bu(n)) continue;
    const r = zu(Fu(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
const ju = 24, Uu = 60;
function mo(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - ju), o = Math.min(e.length, n + t.length + Uu), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function Wu(e, t, n = 200) {
  const r = st(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = st(a.translatedBlockText) || st(a.translated.text), c = i ? mo(i, r) : null, l = c ?? mo(st(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: c ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
function ln(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function jt(e, t) {
  const n = st(t).toLowerCase();
  if (!n || !e) return ln(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${ln(e.slice(a, s))}<mark class="reader-find-mark">${ln(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + ln(e.slice(a));
}
function Ku(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const Vu = /^data-[a-z0-9-]+$/;
function ho(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function qu(e, t, n = "") {
  if (!t.length) return jt(e, n);
  const r = t.filter((s) => s.end > s.start && s.start >= 0 && s.end <= e.length).map((s, i) => ({ mark: s, order: i })).sort((s, i) => s.mark.start - i.mark.start || s.order - i.order).map(({ mark: s }) => s);
  let o = "", a = 0;
  for (const s of r) {
    if (s.start < a) continue;
    o += jt(e.slice(a, s.start), n);
    const i = Object.entries(s.attrs ?? {}).filter(([c]) => Vu.test(c)).map(([c, l]) => ` ${c}="${ho(l)}"`).join("");
    o += `<mark class="${ho(s.className)}"${i}>${jt(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  }
  return o + jt(e.slice(a), n);
}
function ve(e) {
  return typeof e == "string" ? e : "";
}
function Ju(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function Gu(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function Xu(e) {
  return {
    source: ve(e == null ? void 0 : e.source_text) || ve(e == null ? void 0 : e.unit_source_text),
    translated: ve(e == null ? void 0 : e.protected_translated_text) || ve(e == null ? void 0 : e.translated_text)
  };
}
const Yu = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function rs(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function Zu(e) {
  const t = rs(e).sort((r, o) => ve(r.ts).localeCompare(ve(o.ts)));
  return t.length ? [
    { text: ve(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: ve(r.new_text),
      label: Yu[ve(r.source)] || ve(r.source) || "修订",
      ts: ve(r.ts),
      reason: ve(r.reason)
    }))
  ].reverse() : [];
}
function Qu(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function ed(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return ve(r.finished_at) || ve(n.finished_at) || "";
}
function td(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = rs(e).sort((a, s) => ve(a.ts).localeCompare(ve(s.ts)));
  for (const a of o) {
    const s = new Date(ve(a.ts)).getTime(), i = ve(a.reader_item_id) || ve(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, ve(a.new_text));
  }
  return n;
}
const nd = {
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
function rd(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = nd[ve(n.kind)] || ve(n.kind) || "问题", o = ve(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const od = /* @__PURE__ */ new Set(["text", "formula"]);
function wr(e) {
  return od.has(e);
}
function os(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || wr(Ce(n));
}
function ad(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !wr(Ce(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const sd = 300, id = 72;
function cd(e, t) {
  if (e.width >= sd && e.height >= id)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const ld = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function ud(e, t, n) {
  return e.flatMap((r) => {
    if (!ld.has(Ce(r.region))) return [];
    const o = lt(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function po(e, t, n) {
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
async function dd(e) {
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
const fd = "reader-text-hover-copy", md = "reader-text-hover-edit", hd = "reader-text-hover-zoom", pd = "reader-text-hover-id";
function gd(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const as = "reader-text-hover-tools";
function un({
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
const yd = 26, bd = 220;
function vd(e, t = bd) {
  return e.height < yd * 2 || e.width < t;
}
function wd({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? mr : e === "failed" ? bt : Ta, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function Sd({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  onZoom: o,
  frameRect: a,
  placement: s,
  tailTop: i = 0
}) {
  const [c, l] = N("idle"), [u, f] = N("idle"), [d] = N(() => gd()), m = A([]), g = (e == null ? void 0 : e.itemId) || "";
  if (O(() => {
    l("idle"), f("idle");
    const v = m.current;
    return () => {
      v.forEach((P) => window.clearTimeout(P)), m.current = [];
    };
  }, [g]), !e) return null;
  const h = pi(e.highlight.region, t), b = Ce(e.highlight.region), w = (v, P) => async (M) => {
    M.preventDefault(), M.stopPropagation();
    const E = await dd(v);
    P(E ? "copied" : "failed"), m.current.push(window.setTimeout(() => P("idle"), 1200));
  }, I = b === "formula" ? "复制 LaTeX" : "复制", y = a || e.rect, S = s || (vd(y) ? "outside" : "inside");
  return /* @__PURE__ */ p("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ p(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": b,
      style: y,
      children: /* @__PURE__ */ C(
        "div",
        {
          className: as,
          "data-placement": S,
          style: S === "tail" ? { top: i } : void 0,
          children: [
            d ? /* @__PURE__ */ p(
              un,
              {
                className: pd,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: w(e.itemId, f),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && wr(b) ? /* @__PURE__ */ p(
              un,
              {
                className: md,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (v) => {
                  v.preventDefault(), v.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ p(bn, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            h ? /* @__PURE__ */ p(
              un,
              {
                className: fd,
                state: c,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: c === "copied" ? "已复制" : c === "failed" ? "复制失败" : I,
                onClick: w(h, l),
                children: /* @__PURE__ */ p(wd, { state: c })
              }
            ) : null,
            o ? /* @__PURE__ */ p(
              un,
              {
                className: hd,
                state: "idle",
                label: "放大看这一块",
                title: b === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (v) => {
                  v.preventDefault(), v.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ p(Si, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Id(e, t) {
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
function Td(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = lt(
      Id(e, a),
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
const kd = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Ed = 256, zt = /* @__PURE__ */ new Map();
function Rd(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function ss(e) {
  const t = `${e || ""}`, { text: n, slots: r } = Ki(t, { bareLatex: !0 }), o = Rd(n), a = Vi(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = zt.get(t);
  if (!s && (s = qi(o, r), zt.set(t, s), zt.size > Ed)) {
    const i = zt.keys().next().value;
    i !== void 0 && zt.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function Cn(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Je(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Pd(e, t) {
  const n = e.typography, r = Je(t) || 1, o = Je(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = Cn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(s, i * r)), l = Je(n == null ? void 0 : n.fit_min_font_size_pt), u = Je(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (l || 5.5) * r), d = Math.max(
    f,
    u ? u * r : o ? o * r : c
  ), m = o ? o * r : c, g = Je(n == null ? void 0 : n.leading_em), h = [
    Je(n == null ? void 0 : n.padding_top_pt) || 0,
    Je(n == null ? void 0 : n.padding_right_pt) || 0,
    Je(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Je(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((b) => b * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || kd,
    fontSizePx: Math.max(f, Math.min(d, m)),
    minFontSizePx: f,
    maxFontSizePx: d,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (Cn(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : Cn(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function Md(e, t, n, r) {
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
const xd = 512, Ft = /* @__PURE__ */ new Map();
let Zn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Zn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Zn += 1;
}));
function Nd(e, t, n, r) {
  return [
    Zn,
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
function Sr({ item: e, pageScale: t }) {
  const n = A(null), r = U(
    () => ss(e.translatedText),
    [e.translatedText]
  ), [o, a] = N(r.fallbackHtml), s = U(
    () => Pd(e, t),
    [e, t]
  );
  O(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((d) => {
      f && a(d);
    }), () => {
      f = !1;
    };
  }, [r]), Le(() => {
    const f = n.current;
    if (!f) return;
    const [d, m, g, h] = s.padding, b = Math.max(1, e.rect.width - h - m), w = Math.max(1, e.rect.height - d - g), I = Nd(o, b, w, s);
    let y = Ft.get(I);
    if (y === void 0 && (y = Md(
      (S) => (f.style.fontSize = `${S}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      b,
      w,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), Ft.set(I, y), Ft.size > xd)) {
      const S = Ft.keys().next().value;
      S !== void 0 && Ft.delete(S);
    }
    f.style.fontSize = `${y.toFixed(2)}px`;
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
function _d({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = U(
    () => Td(e, t, n, r),
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
        Sr,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Ad = tn(_d);
function Ld({
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
        Sr,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: Ce(a.highlight.region),
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
const Cd = tn(Ld), is = 24, ot = is * 2 + 4, Ge = 24, Dd = 4, $d = 6, ht = (e) => e.left + e.width, ct = (e) => e.top + e.height;
function Ut(e, t) {
  const n = Math.min(ht(e), ht(t)) - Math.max(e.left, t.left), r = Math.min(ct(e), ct(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const go = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= ht(t) && r >= t.top && r <= ct(t);
}, Od = (e) => e.height > 40 && e.height > e.width * 2.5;
function zd(e, t, n) {
  if (!t.length || e.height < Ge || e.width < n + 8) return null;
  const r = Math.max(...t.map(ct)), o = ht(e) - 4 - n;
  for (const a of [r, ct(e) - 2]) {
    const s = Math.max(e.top, a - Ge), i = { left: o, top: s, width: n, height: Ge };
    if (!t.some((c) => Ut(i, c) > 0)) return s - e.top;
  }
  return null;
}
function Fd(e, t) {
  const n = [], r = (a) => {
    const s = is + Dd, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: ht(e), top: i, width: s, height: ot } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: ot } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - Ge - 3, width: ot, height: Ge + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: ct(e), width: ot, height: Ge + 3 } }), r(!0);
  const o = zd(e, t, ot);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: ht(e) - 4 - ot, top: e.top + o, width: ot, height: Ge } }), n;
}
function Bd(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((I) => I.width > 0 && I.height > 0 && !Od(I)), i = s.filter((I) => go(I, t)), c = s.filter((I) => !go(I, t)), l = n.filter((I) => I !== t && Ut(I, t) < t.width * t.height * 0.5), u = Fd(t, i).filter(({ box: I, overhang: y }) => {
    const S = y ? $d : 0;
    return I.left >= -S && ht(I) <= r + S && I.top >= 0 && ct(I) <= o;
  }), f = ({ placement: I, tailTop: y }) => y === void 0 ? { placement: I } : { placement: I, tailTop: y }, d = ({ box: I }) => !c.some((y) => Ut(I, y) > 0), m = u.filter((I) => I.placement !== "tail"), g = m.find((I) => d(I) && !l.some((y) => Ut(I.box, y) > 0));
  if (g) return f(g);
  const h = m.find(d) || u.find((I) => I.placement === "tail" && d(I));
  if (h) return f(h);
  let b = null, w = Number.POSITIVE_INFINITY;
  for (const I of u) {
    const y = c.reduce((S, v) => S + Ut(I.box, v), 0);
    y < w && (b = I, w = y);
  }
  return b ? f(b) : { placement: "outside" };
}
function Hd(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - Ge - 3 : ct(r);
  return t >= r.left - 4 && t <= r.left + ot + 4 && n >= a && n <= a + Ge + 3;
}
const Dn = (e) => e.left + e.width, $n = (e) => e.top + e.height;
function jd(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const l of t) {
    if (l.width <= 0 || l.height <= 0) continue;
    const u = l.left + l.width / 2, f = l.top + l.height / 2;
    u < e.left || u > Dn(e) || f < e.top || f > $n(e) || (o = Math.min(o, l.left), a = Math.min(a, l.top), s = Math.max(s, Dn(l)), i = Math.max(i, $n(l)));
  }
  if (!Number.isFinite(o)) return e;
  const c = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return c.width = Math.min(Dn(e) + r, s + n) - c.left, c.height = Math.min($n(e) + r, i + n) - c.top, c.width * c.height < e.width * e.height * 0.3 && c.height < 24 ? e : c;
}
function Ud(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function Wd(e, t, n, r) {
  const [o, a] = N(null);
  return Le(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? Ud(s) : [], c = Ce(t.highlight.region) === "figure", l = i.length && !c ? jd(t.rect, i) : t.rect, u = n.filter((d) => d.itemId !== t.itemId).map((d) => d.rect), f = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...Bd({ frame: l, others: u, pageWidth: r, pageHeight: f, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
function Kd({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = N(null), [i, c] = N(!1), [l, u] = N([]), [f, d] = N(""), [m, g] = N(""), [h, b] = N(!1), [w, I] = N(null), [y, S] = N([]), v = r.drafts, P = r.generation, M = L(async (k, T) => {
    if (e)
      try {
        u(Zu(await e.fetchRevisions(k, T)));
      } catch {
        u([]);
      }
  }, [e]);
  O(() => {
    if (s(null), u([]), I(null), S([]), g(""), !e || !t || !n) return;
    let k = !1;
    return c(!0), e.loadItem(t, n).then((T) => {
      if (k) return;
      const R = T == null ? void 0 : T.item;
      if (!R) throw new Error("找不到这一段的译文。");
      const D = `${(T == null ? void 0 : T.item_id) || n}`, { source: z, translated: K } = Xu(R);
      s({ readerItemId: n, itemId: D, source: z, current: K }), d(v.get(n) ?? K);
    }).catch((T) => {
      k || I({ tone: "error", message: (T == null ? void 0 : T.message) || "读取这段译文失败。" });
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
    b(!0), I(null), S([]);
    try {
      const D = await e.revise(t, a.itemId, {
        translated_text: R,
        source: "user",
        reason: (T ?? m).trim() || "在阅读页手动修改",
        ...P.current != null ? { expected_generation: P.current } : {}
      }), z = Number(D == null ? void 0 : D.generation);
      return Number.isFinite(z) && (P.current = z), v.delete(a.readerItemId), s({ ...a, current: R }), d(R), g(""), (D == null ? void 0 : D.changed) === !1 ? I({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, R), I({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), M(t, a.readerItemId), !0;
    } catch (D) {
      const z = D;
      return (z == null ? void 0 : z.reason) === "generation_mismatch" && (P.current = null), I({ tone: "error", message: (z == null ? void 0 : z.message) || "保存失败，请稍后再试。" }), S(rd(z == null ? void 0 : z.issues)), !1;
    } finally {
      b(!1);
    }
  }, [e, a, h, f, m, t, o, M, v, P]), _ = L(() => {
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
    status: w,
    issues: y,
    save: $,
    discardDraft: _
  };
}
const cs = "reader-inline-edit";
function Vd({ text: e }) {
  const [t, n] = N("");
  return O(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = ss(e);
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
function qd({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var _;
  const s = e.itemId, i = Kd({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = N(!1), [u, f] = N(!1), d = A(null), m = cd(e.rect, t), g = U(() => ad(o), [o]), h = g.indexOf(s), { loaded: b } = i, w = i.saving || i.loading, I = n.blockedReason, y = !b || i.draft === b.current, { close: S, select: v } = n, P = L((k) => {
    const T = g[h + k];
    T && (v(T), a == null || a(T));
  }, [g, h, v, a]), M = L(() => {
    i.discardDraft(), S();
  }, [i, S]), E = L(async (k, T) => {
    await i.save(k, T) && S();
  }, [i, S]);
  O(() => {
    const k = (T) => {
      !T.altKey || T.key !== "ArrowUp" && T.key !== "ArrowDown" || (T.preventDefault(), P(T.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", k), () => window.removeEventListener("keydown", k);
  }, [P]), Le(() => {
    const k = d.current;
    if (!k) return;
    k.style.height = "auto";
    const T = m.mode === "inline" ? m.minHeight : 0;
    k.style.height = `${Math.max(T, k.scrollHeight + 2)}px`;
  }, [i.draft, b, m.mode, m.mode === "inline" ? m.minHeight : 0]);
  const $ = m.mode === "inline" ? { left: m.left, top: m.top, width: m.width } : { left: m.left, width: m.width, top: m.top, bottom: m.bottom };
  return /* @__PURE__ */ C(Ae, { children: [
    m.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ C(
      "div",
      {
        className: `${cs} is-${m.mode}`,
        style: $,
        role: "group",
        "aria-label": `改第 ${((_ = n.target) == null ? void 0 : _.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": m.mode,
        onPointerDown: (k) => k.stopPropagation(),
        children: [
          r && (b != null && b.source) ? /* @__PURE__ */ p(
            X,
            {
              className: `reader-inline-edit-source${c ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: c ? "收起原文" : "展开原文",
              onClick: () => l((k) => !k),
              children: b.source
            }
          ) : null,
          I ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: I }) : null,
          i.loading ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          b ? /* @__PURE__ */ p(
            Wi,
            {
              ref: d,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: w || !!I,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (k) => i.setDraft(k.target.value),
              onKeyDown: (k) => {
                k.key === "Enter" && (k.metaKey || k.ctrlKey) ? (k.preventDefault(), y || E()) : k.key === "Escape" && (k.preventDefault(), M());
              }
            }
          ) : null,
          b ? /* @__PURE__ */ p(Vd, { text: i.draft }) : null,
          /* @__PURE__ */ C("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(dt, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => P(-1), children: /* @__PURE__ */ p(Ii, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(dt, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= g.length - 1, onClick: () => P(1), children: /* @__PURE__ */ p(vn, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              hr,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: w || !!I || !b,
                onChange: (k) => i.setReason(k.target.value),
                onKeyDown: (k) => {
                  k.key === "Enter" ? (k.preventDefault(), y || E()) : k.key === "Escape" && (k.preventDefault(), M());
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
                  /* @__PURE__ */ p(Ti, { size: 13, "aria-hidden": !0 }),
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
                disabled: w || !!I || y || !i.draft.trim(),
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
          u && b && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((k, T) => {
            const R = k.text === b.current, D = [Qu(k.ts), k.label].filter(Boolean).join(" · ");
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
                    disabled: w || !!I,
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
const ls = nn(null), us = nn(null);
function Jd({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(ls.Provider, { value: e, children: /* @__PURE__ */ p(us.Provider, { value: t, children: n }) });
}
function Be() {
  return ft(ls);
}
function Ir() {
  return ft(us);
}
const ds = 1.414;
function Gd({
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
  liveTranslationPage: b,
  showLiveTranslation: w = r === "source",
  liveTranslationMissing: I = !1
}) {
  var Z, fe;
  const y = Be(), S = y == null ? void 0 : y.revisedBlocks, v = y == null ? void 0 : y.blockEdit, P = v == null ? void 0 : v.pendingEdits, M = y == null ? void 0 : y.editBlock, E = (y == null ? void 0 : y.findTerm) || "", $ = r === "translated" ? "translated" : y != null && y.compareVersion ? "compare" : "source", _ = y == null ? void 0 : y.textMarks, k = U(
    () => _ ? ({ str: x }) => qu(x, _(x), E) : E ? ({ str: x }) => jt(x, E) : void 0,
    [E, _]
  ), T = A(c ?? ds), [R, D] = N(T.current);
  O(() => {
    c != null && Math.abs(c - T.current) >= 1e-3 && (T.current = c, D(c));
  }, [c]);
  const z = A(u);
  z.current = u;
  const K = A(null), j = A((x) => {
    var H;
    K.current = x, (H = z.current) == null || H.call(z, x);
  }).current, J = A(null), oe = A(`${t}@${n}`);
  Le(() => {
    const x = `${t}@${n}`;
    oe.current !== x && (oe.current = x, o && Yd(K.current, J.current));
  }, [o, n, t]), O(() => {
    o || On(J.current);
  }, [o]), O(() => () => On(J.current), []);
  const q = Math.max(120, Math.floor(t * R)), se = Math.max(q, Math.ceil(s || 0)), Ee = lt(f, t, q), re = U(
    () => ud(d, t, q),
    [q, d, t]
  ), [ue, Me] = N(null), ie = typeof g == "function", le = ie ? m ?? null : ue, B = (x) => {
    ie ? x !== (m ?? null) && (g == null || g(x)) : Me((H) => H === x ? H : x);
  }, W = U(
    () => re.find((x) => x.itemId === le) || null,
    [le, re]
  ), Y = r === "translated" && ((Z = v == null ? void 0 : v.target) == null ? void 0 : Z.itemId) || "", de = U(
    () => Y && re.find((x) => x.itemId === Y) || null,
    [Y, re]
  ), ne = Wd(K, o ? W : null, re, t), ae = (x) => {
    var Ie, Ne, ze, He;
    if (x.pointerType === "touch") return;
    if (y != null && y.pointerTaken) {
      B(null);
      return;
    }
    if (x.buttons !== 0) {
      B(null);
      return;
    }
    if ((Ne = (Ie = x.target) == null ? void 0 : Ie.closest) != null && Ne.call(Ie, `.${as}`) || (He = (ze = x.target) == null ? void 0 : ze.closest) != null && He.call(ze, `.${cs}`)) return;
    const H = x.currentTarget.getBoundingClientRect(), V = x.clientX - H.left, me = x.clientY - H.top;
    if (Hd(ne, V, me)) return;
    const ye = po(re, V, me);
    B((ye == null ? void 0 : ye.itemId) || null);
  }, Se = (x) => {
    if (x.pointerType === "mouse") return;
    const H = x.currentTarget.getBoundingClientRect(), V = po(
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
      [ke]: e,
      [we]: r,
      [pr]: q,
      className: gr,
      onPointerMoveCapture: ae,
      onPointerDown: Se,
      onDoubleClick: (x) => {
        const H = y == null ? void 0 : y.zoomBlock;
        !H || y != null && y.pointerTaken || !W || Ce(W.highlight.region) === "figure" && (x.preventDefault(), H(W.itemId));
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
          Xi,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: k,
            renderAnnotationLayer: !1,
            className: Ba,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: Sn,
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
              On(J.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ p(
          "div",
          {
            className: Sn,
            style: { width: t, height: q },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: J, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        Ee ? /* @__PURE__ */ p(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: Ee,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && w ? /* @__PURE__ */ p(
          Ad,
          {
            layoutPage: h,
            pageState: b,
            width: t,
            height: q
          }
        ) : null,
        o && w && I ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (P != null && P.size) ? /* @__PURE__ */ p(Cd, { targets: re, edits: P, width: t, excludeId: de == null ? void 0 : de.itemId }) : null,
        o && de && v ? /* @__PURE__ */ p(
          qd,
          {
            target: de,
            page: { width: t, height: q },
            edit: v,
            showSource: !!(y != null && y.editShowsSource),
            regions: y == null ? void 0 : y.regions,
            jumpToBlock: y == null ? void 0 : y.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (S != null && S.size) ? /* @__PURE__ */ p("div", { className: "reader-revised-markers", "aria-hidden": "true", children: re.filter((x) => S.has(x.itemId)).map((x) => /* @__PURE__ */ p(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": x.itemId,
            style: { left: x.rect.left, top: x.rect.top, height: x.rect.height }
          },
          x.itemId
        )) }) : null,
        (fe = y == null ? void 0 : y.pageLayers) == null ? void 0 : fe.map((x) => /* @__PURE__ */ p(Pn, { children: x.render({ page: e, width: t, height: q, pane: $, active: o }) }, x.id)),
        /* @__PURE__ */ p(
          Sd,
          {
            target: o && !(y != null && y.pointerTaken) && (W == null ? void 0 : W.itemId) !== (de == null ? void 0 : de.itemId) ? W : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: W && (S == null ? void 0 : S.get(W.itemId)) || 0,
            onEdit: M,
            onZoom: y == null ? void 0 : y.zoomBlock,
            frameRect: ne == null ? void 0 : ne.rect,
            placement: ne == null ? void 0 : ne.placement,
            tailTop: ne == null ? void 0 : ne.tailTop
          }
        )
      ]
    }
  );
}
const Xd = tn(Gd);
function Yd(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function On(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const Zd = 2 * 1024 * 1024;
function Qd(e) {
  const t = new Ca.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const zn = 5, ef = "120% 0px", tf = 120, nf = "25% 0px";
let yo = 1;
const bo = /* @__PURE__ */ new WeakMap();
function rf(e) {
  if (!e) return 0;
  const t = bo.get(e);
  if (t) return t;
  const n = yo;
  return yo += 1, bo.set(e, n), n;
}
function of() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const af = oi(
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
    activeRegion: b = null,
    regions: w = [],
    readerMetadata: I = null,
    hoveredRegionId: y = null,
    onHoverRegion: S,
    liveTranslation: v,
    showLiveTranslation: P = t === "source",
    liveTranslationPendingLabel: M = "",
    paneAction: E
  }, $) {
    Cu();
    const { file: _, loading: k, error: T } = Ac(n, r), R = `${n}\0${rf(_)}`, D = A(R);
    D.current = R;
    const z = U(() => {
      const F = Rc(_);
      return F ? "ranged" in F ? { range: Qd(F.ranged) } : F : null;
    }, [_, n]), [K, j] = N(0), [J, oe] = N(""), [q, se] = N(null), [Ee, re] = N(480), ue = A(null), Me = A(0), ie = U(() => of(), []), le = U(() => ({
      cMapUrl: Xt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: Xt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: Zd,
      disableAutoFetch: !0
    }), []);
    fr($, () => q, [q]), O(() => {
      const F = (G) => {
        Me.current = G, re(G);
      }, Q = (G) => {
        const pe = Qc(G, Me.current);
        if (pe !== "ignore") {
          if (ue.current && clearTimeout(ue.current), pe === "immediate") {
            F(G);
            return;
          }
          ue.current = setTimeout(() => F(G), Ka);
        }
      }, te = !!(c && c >= 80);
      Q(te ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const ge = !te && i && typeof ResizeObserver < "u" ? new ResizeObserver((G) => {
        var pe, Re;
        Q(((Re = (pe = G[0]) == null ? void 0 : pe.contentRect) == null ? void 0 : Re.width) ?? i.clientWidth);
      }) : null;
      return ge && i && ge.observe(i), () => {
        ge == null || ge.disconnect(), ue.current && clearTimeout(ue.current);
      };
    }, [c, i, a]);
    const B = U(
      () => Xc(Ee, o),
      [Ee, o]
    ), [W, Y] = N(() => /* @__PURE__ */ new Map()), [de, ne] = N(() => /* @__PURE__ */ new Set()), [ae, Se] = N(() => /* @__PURE__ */ new Set()), ee = A(/* @__PURE__ */ new Map()), Z = A(null), fe = A(null), [x, H] = N(() => /* @__PURE__ */ new Set()), V = A(/* @__PURE__ */ new Map()), me = L((F, Q) => {
      Y((te) => {
        if (te.get(F) === Q) return te;
        const ce = new Map(te);
        return ce.set(F, Q), ce;
      });
    }, []), ye = L((F, Q) => {
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
    }, []), Ie = A(/* @__PURE__ */ new Map()), Ne = L((F) => {
      const Q = Ie.current;
      let te = Q.get(F);
      return te || (te = (ce) => ye(F, ce), Q.set(F, te)), te;
    }, [ye]);
    O(() => {
      if (typeof IntersectionObserver > "u") return;
      const F = V.current, Q = new IntersectionObserver(
        (te) => {
          const ce = [], ge = [];
          for (const G of te) {
            const pe = G.target, Re = Tn(pe);
            Number.isFinite(Re) && (G.isIntersecting ? ce : ge).push(Re);
          }
          if ((ce.length || ge.length) && ne((G) => {
            let pe = null;
            for (const Re of ce)
              G.has(Re) || (pe = pe || new Set(G), pe.add(Re));
            for (const Re of ge)
              G.has(Re) && (pe = pe || new Set(G), pe.delete(Re));
            return pe || G;
          }), ce.length) {
            for (const G of ce) {
              const pe = F.get(G);
              pe && (clearTimeout(pe), F.delete(G));
            }
            Se((G) => {
              let pe = null;
              for (const Re of ce)
                G.has(Re) || (pe = pe || new Set(G), pe.add(Re));
              return pe || G;
            });
          }
          for (const G of ge)
            F.has(G) || F.set(G, setTimeout(() => {
              F.delete(G), Se((pe) => {
                if (!pe.has(G)) return pe;
                const Re = new Set(pe);
                return Re.delete(G), Re;
              });
            }, tf));
        },
        { root: i, rootMargin: ef, threshold: 0 }
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
              const G = Tn(ge.target);
              !Number.isFinite(G) || ge.isIntersecting === te.has(G) || (ce = ce || new Set(te), ge.isIntersecting ? ce.add(G) : ce.delete(G));
            }
            return ce || te;
          });
        },
        { root: i, rootMargin: nf, threshold: 0 }
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
    const ze = !!i && typeof IntersectionObserver < "u";
    Le(() => {
      j(0), oe(""), ne(/* @__PURE__ */ new Set()), Se(/* @__PURE__ */ new Set()), Y(/* @__PURE__ */ new Map()), ee.current.clear();
      const F = V.current;
      for (const Q of F.values()) clearTimeout(Q);
      F.clear(), h == null || h(0, t);
    }, [R, h, t]);
    const He = L(
      (F) => {
        if (D.current !== R) return;
        const Q = F.numPages;
        j(Q), oe(""), h == null || h(Q, t), f == null || f({ numPages: Q, pane: t }), m && typeof F.getPage == "function" && m(F, t), d && typeof F.getOutline == "function" && Au(F).then((te) => {
          D.current === R && d(te, t);
        }, () => {
        });
      },
      [R, f, d, m, h, t]
    ), Qe = L(
      (F) => {
        if (D.current !== R) return;
        const Q = (F == null ? void 0 : F.message) || "PDF 解析失败";
        oe(Q), j(0), h == null || h(0, t), g == null || g(F, t);
      },
      [R, g, h, t]
    ), De = U(
      () => K > 0 ? Array.from({ length: K }, (F, Q) => Q + 1) : [],
      [K]
    );
    O(() => {
      typeof IntersectionObserver < "u" || Se(new Set(De));
    }, [De]);
    const Ke = U(
      () => mt(b, I, t),
      [b, I, t]
    ), et = U(() => {
      const F = /* @__PURE__ */ new Map();
      for (const Q of w) {
        const te = mt(Q, I, t);
        if (!te) continue;
        const ce = F.get(te.box.page) || [];
        ce.push(te), F.set(te.box.page, ce);
      }
      return F;
    }, [t, I, w]), tt = U(() => {
      const F = /* @__PURE__ */ new Set();
      if (!y) return F;
      for (const [Q, te] of et)
        te.some((ce) => ce.itemId === y) && F.add(Q);
      return F;
    }, [y, et]), St = U(() => {
      if (K === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(De);
      if (de.size === 0) {
        const te = Math.min(K, zn * 2 + 1);
        return new Set(Array.from({ length: te }, (ce, ge) => ge + 1));
      }
      const Q = /* @__PURE__ */ new Set();
      for (const te of de)
        for (let ce = -zn; ce <= zn; ce++) {
          const ge = te + ce;
          ge >= 1 && ge <= K && Q.add(ge);
        }
      return Q;
    }, [K, De, i, a, de]), nt = !n || !!T || !!J, be = n && (T || J) || s;
    return /* @__PURE__ */ C(
      "section",
      {
        ref: se,
        className: `reader-panel ${rn}${a ? "" : " is-hidden"}`,
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
          nt && !k ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: be }) : null,
          k ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          z && !T ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            Yi,
            {
              file: z,
              loading: null,
              error: null,
              options: le,
              onLoadSuccess: He,
              onLoadError: Qe,
              className: "reader-react-pdf-document",
              children: De.map((F) => {
                if (St.has(F))
                  return /* @__PURE__ */ p(
                    Xd,
                    {
                      pane: t,
                      pageNumber: F,
                      width: B,
                      devicePixelRatio: ie,
                      active: ae.has(F),
                      textLayer: !ze || x.has(F),
                      syncedMinHeight: (l == null ? void 0 : l.get(F)) || 0,
                      onMetrics: u,
                      cachedAspect: W.get(F),
                      onAspectChange: me,
                      sentinelRef: Ne(F),
                      regionHighlight: (Ke == null ? void 0 : Ke.box.page) === F ? Ke : null,
                      regionTargets: et.get(F),
                      hoveredRegionId: y && tt.has(F) ? y : null,
                      onHoverRegion: S,
                      liveTranslationLayout: v == null ? void 0 : v.layoutByPage.get(F - 1),
                      liveTranslationPage: v == null ? void 0 : v.pagesByPage.get(F - 1),
                      showLiveTranslation: P,
                      liveTranslationMissing: nu(v, F - 1)
                    },
                    `${t}-${F}`
                  );
                const te = W.get(F) ?? ds, ce = Math.max(120, Math.floor(B * te)), ge = Math.max(ce, Math.ceil((l == null ? void 0 : l.get(F)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: Ne(F),
                    [ke]: F,
                    [we]: t,
                    [pr]: ce,
                    className: `${gr} is-placeholder`,
                    style: {
                      width: B,
                      height: ge,
                      minHeight: ge
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: Sn,
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
), vo = tn(af), sf = 2e3, cf = 6, lf = 500, wo = "reader-react-resizing";
function uf(e, t) {
  const n = A(null), r = A(null);
  Le(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const S = df(e), v = Vt(e, S);
      if (!v) return;
      s = { pane: S, progress: v, started: performance.now() };
    }
    const { pane: i, progress: c, started: l } = s;
    let u = 0, f = null, d = e.scrollHeight, m = d, g = 0, h = l;
    const b = /* @__PURE__ */ new WeakMap(), w = typeof ResizeObserver > "u" ? null : new ResizeObserver((S) => {
      let v = !1;
      for (const P of S) {
        const M = Math.round(P.contentRect.height);
        b.has(P.target) && b.get(P.target) !== M && (v = !0), b.set(P.target, M);
      }
      v && _t(e, c, "auto", i);
    }), I = () => {
      var S;
      f && clearTimeout(f), cancelAnimationFrame(u), w == null || w.disconnect(), e.classList.remove(wo);
      for (const v of So) e.removeEventListener(v, I);
      ((S = r.current) == null ? void 0 : S.stop) === I && (r.current = null);
    }, y = () => {
      _t(e, c, "auto", i);
      const S = e.scrollHeight;
      g = S === m ? g + 1 : 0, m = S;
      const v = performance.now() - h;
      g >= cf && (S !== d || v > lf) || v > sf ? I() : u = requestAnimationFrame(y);
    };
    for (const S of So) e.addEventListener(S, I, { passive: !0 });
    for (const S of Array.from(e.children)) w == null || w.observe(S);
    e.classList.add(wo), r.current = { ...s, stop: I }, f = setTimeout(() => {
      f = null, h = performance.now(), d = e.scrollHeight, m = d, g = 0, u = requestAnimationFrame(y);
    }, Ka);
  }, [e, t]), O(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function df(e) {
  for (const t of Array.from(e.querySelectorAll(`[${ke}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(we) || null;
  }
  return null;
}
const So = ["wheel", "touchstart", "keydown", "pointerdown"];
function ff(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function mf(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(rn)) && ((n = e.hasAttribute) != null && n.call(e, we)));
}
function hf(e, t) {
  O(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!mf(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${rn}[${we}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const c = ff(a, i);
        if (c === null || Math.abs(i.scrollLeft - c) < 1) continue;
        const l = i.scrollLeft;
        i.scrollLeft = c, Math.abs(i.scrollLeft - l) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function pf(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), c = t - i, l = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: c * l };
}
function gf(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const Io = 12;
function Tr(e) {
  return Array.from(e.querySelectorAll(`.${rn}[${we}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function yf(e) {
  const t = e.getBoundingClientRect();
  return Tr(e).map((n) => {
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
function bf(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function vf(e, t) {
  return e ? Tr(e).find((n) => n.getAttribute(we) === t) ?? null : null;
}
function wf({ shellEl: e }) {
  const [t, n] = N([]), r = A(0), o = L(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = yf(e);
      n((i) => bf(i, s) ? i : s);
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
        for (const f of Tr(e))
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
  return a.length ? /* @__PURE__ */ p("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ p(Sf, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function Sf({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - Io * 2), r = pf(e, n), o = A(null);
  if (!r) return null;
  const a = (d) => {
    const m = vf(t, e.pane);
    m && (m.scrollLeft = d);
  }, s = (d) => {
    var m, g;
    d.button === 0 && (d.preventDefault(), d.stopPropagation(), (g = (m = d.currentTarget).setPointerCapture) == null || g.call(m, d.pointerId), o.current = { startX: d.clientX, startScroll: e.scrollLeft, pointerId: d.pointerId });
  }, i = (d) => {
    const m = o.current;
    !m || m.pointerId !== d.pointerId || a(m.startScroll + gf(e, n, r.size, d.clientX - m.startX));
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
      style: { left: e.left + Io, width: n },
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
function fs(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function If(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function Tf({ compare: e, onDone: t }) {
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
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: fs(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(mr, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(ki, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
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
            /* @__PURE__ */ p(ka, { size: 13, "aria-hidden": !0 }),
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
            /* @__PURE__ */ p(Ei, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function To({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = If(t), a = [e === "compare" ? "对比" : "正在读", r, fs(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ C("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function kf({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = N({ source: null, translated: null });
  return Le(() => {
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
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(To, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(To, { role: "reading", ...n }) }) : null
  ] });
}
const Ef = () => () => {
}, ko = () => null;
function Rf({
  mode: e,
  compareMode: t,
  showSource: n,
  showTranslated: r,
  markdownSplit: o,
  overlayOnSource: a = !1
}) {
  return { mode: e, compareMode: t, showSource: n, showTranslated: r };
}
function Pf(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function Mf(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function xf(e) {
  const t = Be(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), d = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? on, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), b = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, w = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, I = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, y = (t == null ? void 0 : t.compareVersion) ?? null, S = (y == null ? void 0 : y.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", v = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", P = y ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, M = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, E = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), $ = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), _ = t == null ? void 0 : t.onPdfOutline, k = t == null ? void 0 : t.onPdfDocument, T = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), R = e.regions ?? (t == null ? void 0 : t.regions) ?? [], D = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), z = (t == null ? void 0 : t.regionHover) ?? null, [K, j] = N(null), J = Mn(
    z ? z.subscribe : Ef,
    z ? () => z.get().itemId : ko,
    z ? () => z.get().itemId : ko
  ), oe = z ? J : K, q = L((ue) => {
    z ? z.set(ue, "pdf") : j(ue);
  }, [z]), se = Rf({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), re = Number.isFinite(g) && g > 0 ? Pf(
    g,
    // 对照时两栏分书页区，按书页区算（50% = 一栏）；单栏才按两倍算（50% = 铺满剩下的那一栏）。
    (n || r) && !se.compareMode,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return uf(d, re), hf(d, se.compareMode), /* @__PURE__ */ C(
    "div",
    {
      ref: f,
      className: Fa,
      "data-reader-region-count": R.length,
      "data-reader-structured-region-count": R.filter(gi).length,
      "data-reader-metadata-ready": D ? "true" : "false",
      children: [
        /* @__PURE__ */ C(
          "main",
          {
            className: `${za} reader-mode-${se.mode}`,
            "data-reader-mode": se.compareMode ? s : n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              b ? /* @__PURE__ */ p(
                vo,
                {
                  pane: "source",
                  url: S,
                  preloadedFile: P,
                  userZoom: m,
                  visible: se.showSource,
                  scrollRoot: d,
                  pageWidthOverride: re,
                  rowHeights: se.compareMode ? h : void 0,
                  onMetrics: E,
                  emptyLabel: I ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: $,
                  onOutline: y ? void 0 : _,
                  onDocument: y ? void 0 : k,
                  activeRegion: T,
                  regions: (y == null ? void 0 : y.regions) ?? R,
                  readerMetadata: D,
                  hoveredRegionId: oe,
                  onHoverRegion: q,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? Mf(o) : "",
                  paneAction: u && se.showTranslated ? /* @__PURE__ */ C(Ae, { children: [
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
                y ? `compare:${y.url}` : "source"
              ) : null,
              w ? /* @__PURE__ */ p(
                vo,
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
                  onOutline: _,
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
        /* @__PURE__ */ p(wf, { shellEl: d }),
        y ? /* @__PURE__ */ p(kf, { shellEl: d, left: y.left, right: y.right }) : null
      ]
    }
  );
}
const Nf = 72, dn = 1500, _f = 2e3, Af = 1200;
function Lf(e, t) {
  return e - t < Nf;
}
function Cf(e) {
  try {
    return e.matches(":focus-visible");
  } catch {
    return !1;
  }
}
function Df(e, t) {
  const [n, r] = N(!0), o = A(null), a = A(!1), s = A(!1), i = L(() => {
    o.current !== null && (window.clearTimeout(o.current), o.current = null);
  }, []), c = L((u) => {
    i(), o.current = window.setTimeout(() => {
      o.current = null, s.current || r(!1);
    }, u);
  }, [i]);
  O(() => {
    var S;
    const u = (S = e.current) == null ? void 0 : S.parentElement;
    if (!u) return;
    let f = u.getBoundingClientRect().top;
    const d = () => {
      f = u.getBoundingClientRect().top;
    }, m = (v) => {
      v.pointerType !== "touch" && (Lf(v.clientY, f) ? a.current || (a.current = !0, i(), r(!0)) : a.current && (a.current = !1, c(dn)));
    }, g = () => {
      a.current && (a.current = !1, c(dn));
    }, h = (v) => {
      s.current = v.target instanceof Element && Cf(v.target), s.current && (i(), r(!0));
    }, b = (v) => {
      var E;
      const P = v.relatedTarget;
      if (P instanceof Node && ((E = e.current) != null && E.contains(P))) return;
      const M = s.current;
      s.current = !1, M && !a.current && c(dn);
    }, w = () => {
      a.current || (r(!0), c(dn));
    }, I = () => {
      s.current = !1;
    }, y = e.current;
    return c(_f), y == null || y.addEventListener("focusin", h), y == null || y.addEventListener("focusout", b), y == null || y.addEventListener("pointerdown", I), u.addEventListener("scroll", w, { capture: !0, passive: !0 }), u.addEventListener("pointerenter", d), u.addEventListener("pointermove", m, { passive: !0 }), u.addEventListener("pointerleave", g), window.addEventListener("resize", d), () => {
      i(), y == null || y.removeEventListener("focusin", h), y == null || y.removeEventListener("focusout", b), y == null || y.removeEventListener("pointerdown", I), u.removeEventListener("scroll", w, { capture: !0 }), u.removeEventListener("pointerenter", d), u.removeEventListener("pointermove", m), u.removeEventListener("pointerleave", g), window.removeEventListener("resize", d);
    };
  }, [e, i, c]);
  const l = A(t);
  return O(() => {
    l.current !== t && (l.current = t, !a.current && (r(!0), c(Af)));
  }, [t, c]), n;
}
const $f = [
  { id: "source", label: "原文", Icon: Ea },
  { id: "compare", label: "对照", Icon: Ra },
  { id: "translated", label: "译文", Icon: Pa }
];
function Of(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function zf(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function Ff(e) {
  const t = Be(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? Of(a.state) : "", l = A(null), u = Df(l, n);
  return (
    // 浮在书页区顶上（2026-11-28 用户：「顶部的 bar 不要保留了，用悬浮的方式……更有沉浸感」）：
    // 这一层本身透明、不接点击，只有左上的胶囊和正中的页签接；左右两段同宽，页签在书页区正中。
    // 读的时候藏着，鼠标到书页区顶上才出来（use-topbar-reveal.ts；不藏的几种在 chrome.css）。
    /* @__PURE__ */ C("header", { className: "reader-workspace-bar", ref: l, "data-revealed": u ? "true" : "false", children: [
      /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
      /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
      e.start ? /* @__PURE__ */ p("div", { className: "reader-workspace-start", children: e.start }) : null,
      /* @__PURE__ */ C("div", { className: "reader-workspace-center", children: [
        /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: $f.map(({ id: f, label: d, Icon: m }) => {
          const g = n === f, h = zf({
            id: f,
            documentReady: r,
            sourceViewOnly: i,
            liveTranslationAvailable: !!a
          });
          return /* @__PURE__ */ C(Pn, { children: [
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
                children: /* @__PURE__ */ p(m, { ...Pe, "aria-hidden": !0 })
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
                /* @__PURE__ */ p(Ri, { ...Pe, "aria-hidden": !0 }),
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
                /* @__PURE__ */ p(Pi, { ...Pe, "aria-hidden": !0 }),
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
              /* @__PURE__ */ p(Mi, { ...Pe, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
            ]
          }
        ) }) : null
      ] }),
      /* @__PURE__ */ p("span", { className: "reader-workspace-end", "aria-hidden": "true" })
    ] })
  );
}
const ms = [];
function Bf() {
  const e = /* @__PURE__ */ new Map(), t = /* @__PURE__ */ new Set();
  let n = ms;
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
function Eo(e, t) {
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
function Hf(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.pageLayer ? [{ id: t, render: n.pageLayer }] : []);
}
function jf(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.menuSection ? [{ id: t, render: n.menuSection }] : []);
}
function Uf(e) {
  var t;
  return ((t = e.find(({ contribution: n }) => n.takesPointer)) == null ? void 0 : t.id) ?? null;
}
function Wf(e) {
  const t = e.flatMap(({ id: n, contribution: r }) => r.textMarks ? [{ id: n, marks: r.textMarks }] : []);
  return t.length ? (n) => t.flatMap(({ id: r, marks: o }) => {
    try {
      return [...o(n)];
    } catch (a) {
      return console.error(`[reader] 扩展 ${r} 的文字层标记出错`, a), [];
    }
  }) : null;
}
function Kf(e) {
  return e.reduce((t, { contribution: n }) => Math.max(t, n.reserveRight || 0), 0);
}
function Vf(e) {
  for (const { contribution: t } of e) if (t.comparedDocument) return t.comparedDocument;
  return null;
}
function qf(e) {
  return e.flatMap(({ title: t, contribution: n }) => {
    var r;
    return (r = n.shortcuts) != null && r.length ? [{ title: t, items: n.shortcuts }] : [];
  });
}
const Nn = nn(null), hs = nn(null);
function Jf({ api: e, store: t, children: n }) {
  const r = U(() => ({ api: e, store: t }), [e, t]);
  return /* @__PURE__ */ p(Nn.Provider, { value: r, children: n });
}
function Ct() {
  const e = ft(Nn);
  if (!e) throw new Error("useReaderApi 要在 ReaderExtensionsProvider 里面用");
  return e.api;
}
const Gf = () => () => {
}, Ro = () => ms;
function Xf(e) {
  return Mn(e.subscribe, e.getSnapshot, e.getSnapshot);
}
function ps() {
  var t;
  const e = (t = ft(Nn)) == null ? void 0 : t.store;
  return Mn((e == null ? void 0 : e.subscribe) ?? Gf, (e == null ? void 0 : e.getSnapshot) ?? Ro, (e == null ? void 0 : e.getSnapshot) ?? Ro);
}
function an(e) {
  var a;
  const t = (a = ft(Nn)) == null ? void 0 : a.store, n = ft(hs);
  if (!n) throw new Error("useReaderContribution 只能在扩展组件里用");
  const { id: r, title: o } = n;
  O(() => {
    t == null || t.set(r, o, e);
  }, [t, r, o, e]), O(() => () => t == null ? void 0 : t.remove(r), [t, r]);
}
class Yf extends ai {
  constructor() {
    super(...arguments);
    Kr(this, "state", { failed: !1 });
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
const Zf = tn(function({ extensions: t }) {
  return /* @__PURE__ */ p(Ae, { children: t.map(({ id: n, title: r, Component: o }) => /* @__PURE__ */ p(Yf, { id: n, children: /* @__PURE__ */ p(Qf, { id: n, title: r, children: /* @__PURE__ */ p(o, {}) }) }, n)) });
});
function Qf({ id: e, title: t, children: n }) {
  const r = U(() => ({ id: e, title: t }), [e, t]);
  return /* @__PURE__ */ p(hs.Provider, { value: r, children: n });
}
function em({
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
const Po = 6e3;
function gs(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function ys(e, t, n, r) {
  const o = e.width * t.width, a = e.height * t.height;
  let s = n * r / Math.max(1, o);
  const i = Math.max(o, a) * s;
  return i > Po && (s *= Po / i), {
    scale: s,
    offsetX: -e.left * t.width * s,
    offsetY: -e.top * t.height * s,
    canvasWidth: Math.max(1, Math.round(o * s)),
    canvasHeight: Math.max(1, Math.round(a * s)),
    /** 显示高度（CSS 像素），按区域的宽高比。 */
    cssHeight: Math.round(n * (a / Math.max(1, o)))
  };
}
function bs({
  pdf: e,
  page: t,
  region: n,
  cssWidth: r,
  className: o,
  label: a
}) {
  const s = A(null), [i, c] = N({ status: "loading", cssHeight: 0 }), l = `${t}:${n.left}:${n.top}:${n.width}:${n.height}:${Math.round(r)}`;
  return O(() => {
    let u = !1, f = null;
    return c((d) => ({ status: "loading", cssHeight: d.cssHeight })), (async () => {
      try {
        const d = await e.getPage(t);
        if (u) return;
        const m = d.getViewport({ scale: 1 }), g = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), h = ys(n, m, r, g), b = s.current, w = b == null ? void 0 : b.getContext("2d");
        if (!b || !w) return;
        b.width = h.canvasWidth, b.height = h.canvasHeight, c({ status: "loading", cssHeight: h.cssHeight });
        const I = d.getViewport({ scale: h.scale, offsetX: h.offsetX, offsetY: h.offsetY }), y = d.render({ canvasContext: w, viewport: I });
        f = y, await y.promise, u || c({ status: "ready", cssHeight: h.cssHeight });
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
const tm = 1600, kr = { left: 0, top: 0, width: 1, height: 1 };
function vs(e) {
  return new Promise((t, n) => {
    e.toBlob((r) => r ? t(r) : n(new Error("截图没出来")), "image/png");
  });
}
function nm(e, t, n) {
  if (e.width <= 0 || e.height <= 0) return null;
  const r = (l) => Math.min(1, Math.max(0, (l - e.left) / e.width)), o = (l) => Math.min(1, Math.max(0, (l - e.top) / e.height)), a = Math.min(r(t.x), r(n.x)), s = Math.max(r(t.x), r(n.x)), i = Math.min(o(t.y), o(n.y)), c = Math.max(o(t.y), o(n.y));
  return s - a < 0.02 || c - i < 0.02 ? null : { left: a, top: i, width: s - a, height: c - i };
}
async function rm(e, t, n = kr, r = tm) {
  const o = await e.getPage(t), a = ys(n, o.getViewport({ scale: 1 }), r, 1), s = document.createElement("canvas");
  s.width = a.canvasWidth, s.height = a.canvasHeight;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.fillStyle = "#fff", i.fillRect(0, 0, s.width, s.height), await o.render({ canvasContext: i, viewport: o.getViewport({ scale: a.scale, offsetX: a.offsetX, offsetY: a.offsetY }) }).promise, vs(s);
}
async function om(e, t = kr) {
  const n = Math.round(t.left * e.width), r = Math.round(t.top * e.height), o = Math.max(1, Math.round(t.width * e.width)), a = Math.max(1, Math.round(t.height * e.height)), s = document.createElement("canvas");
  s.width = o, s.height = a;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.drawImage(e, n, r, o, a, 0, 0, o, a), vs(s);
}
function am(e, t) {
  return t.left === 0 && t.top === 0 && t.width === 1 && t.height === 1 ? `第${e}页.png` : `第${e}页-截图.png`;
}
const sm = /[\u{1D400}-\u{1D7FF}ﬀ-ﬆ]/gu, Mo = /[⺀-鿿가-힯豈-﫿＀-￯　-〿]/u;
function ws(e) {
  let t = `${e || ""}`.replace(/\r\n?/g, `
`).replace(/­/g, "");
  return t.trim() ? (t = t.replace(sm, (r) => r.normalize("NFKC")), t = t.normalize("NFC"), t.includes("̸") && (t = t.replace(/(\S)?̸[ \t]*(\S)/gu, (r, o, a) => `${o ? `${o} ` : ""}${a}̸`).normalize("NFC")), t.split(/\n[ \t]*\n+/).map((r) => im(r.split(`
`))).filter(Boolean).join(`
`).trim()) : "";
}
function im(e) {
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
    t += Mo.test(o) || Mo.test(a) ? r : ` ${r}`;
  }
  return t;
}
const cm = /[\u{1D400}-\u{1D7FF}Ͱ-Ͽ℀-⅏←-⋿⨀-⫿⟀-⟯⦀-⧿⁰-₟̀-ͯ√±×÷]/u;
function xo(e) {
  return cm.test(e);
}
function lm(e) {
  const t = `${e || ""}`;
  return t.trim() ? [...t.trim()].length > 6 ? !1 : !new RegExp("\\p{Ll}{3,}", "u").test(t) : !0;
}
function um(e, t) {
  const n = e[t];
  if (!n) return null;
  const r = (i) => {
    const c = e[i];
    return !!c && c.line === n.line && (xo(c.text) || lm(c.text));
  };
  if (!r(t)) return null;
  let o = t, a = t;
  for (; r(o - 1); ) o -= 1;
  for (; r(a + 1); ) a += 1;
  let s = !1;
  for (let i = o; i <= a; i += 1) xo(e[i].text) && (s = !0);
  if (!s) return null;
  for (; o < a && !e[o].text.trim(); ) o += 1;
  for (; a > o && !e[a].text.trim(); ) a -= 1;
  return [o, a];
}
function dm(e) {
  const t = e.filter((a) => a.right - a.left > 0.5 && a.bottom - a.top > 0.5);
  if (!t.length) return [];
  const n = [...t].sort((a, s) => (a.top + a.bottom) / 2 - (s.top + s.bottom) / 2), r = [];
  for (const a of n) {
    const s = r.at(-1), i = s ? No(s) : null;
    i && fm(i, a) >= 0.5 * Math.min(i.bottom - i.top, a.bottom - a.top) ? s.push(a) : r.push([a]);
  }
  const o = [];
  for (const a of r) {
    const s = No(a), i = s.bottom - s.top, c = [...a].sort((u, f) => u.left - f.left);
    let l = null;
    for (const u of c)
      l && u.left - l.right <= i * 2 ? l.right = Math.max(l.right, u.right) : (l && o.push(l), l = { left: u.left, top: s.top, right: u.right, bottom: s.bottom });
    l && o.push(l);
  }
  return o;
}
function No(e) {
  const t = Math.max(...e.map((r) => r.bottom - r.top)), n = e.filter((r) => r.bottom - r.top >= t * 0.75);
  return { top: Math.min(...n.map((r) => r.top)), bottom: Math.max(...n.map((r) => r.bottom)) };
}
function fm(e, t) {
  return Math.min(e.bottom, t.bottom) - Math.max(e.top, t.top);
}
const mm = 4e3;
function hm(e, t, n) {
  if (e.length) {
    const o = Lu(e, n), a = o ? ns(e).find((s) => s.id === o) : null;
    if (a) return a.title;
  }
  let r = null;
  for (const o of t)
    !o.headingLevel || o.source.page > n || (!r || o.source.page >= r.source.page) && (r = o);
  return `${(r == null ? void 0 : r.source.text) || (r == null ? void 0 : r.markdown) || ""}`.replace(/\s+/g, " ").trim().slice(0, 80);
}
function _o(e) {
  var a, s;
  if (!e || e.isCollapsed || !e.rangeCount) return { text: "", element: null, rect: null };
  const t = e.getRangeAt(0), n = t.startContainer, r = ((s = (a = n.nodeType === 1 ? n : n.parentElement) == null ? void 0 : a.closest) == null ? void 0 : s.call(a, `[${ke}]`)) ?? null;
  return r ? { text: ws(`${e}`).slice(0, mm), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function pm(e, t, n, r, o) {
  let a = null, s = 0.15;
  for (const i of e) {
    const c = mt(i, t, n);
    if (!c || c.box.page !== r) continue;
    const l = lt(c, 1, 1);
    if (!l) continue;
    const u = o.y < l.top ? l.top - o.y : o.y > l.top + l.height ? o.y - l.top - l.height : 0, f = o.x < l.left ? l.left - o.x : o.x > l.left + l.width ? o.x - l.left - l.width : 0, d = u + f * 0.25;
    (d < s || d === 0 && a === null) && (a = i, s = d);
  }
  return a;
}
function gm({
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
  const c = Number(e.getAttribute(ke)) || 0;
  if (c < 1) return null;
  const l = e.getAttribute(we) === "source" ? "source" : "translated", u = e.getBoundingClientRect(), f = u.width > 0 && u.height > 0 ? { x: Math.min(1, Math.max(0, (t - u.left) / u.width)), y: Math.min(1, Math.max(0, (n - u.top) / u.height)) } : null, m = (r ? a.find((g) => g.itemId === r) ?? null : null) ?? (f ? pm(a, i, l, c, f) : null);
  return {
    pane: l,
    page: c,
    itemId: (m == null ? void 0 : m.itemId) ?? null,
    selection: o,
    sourceText: `${(m == null ? void 0 : m.source.text) || (m == null ? void 0 : m.markdown) || ""}`.trim(),
    translatedText: `${(m == null ? void 0 : m.translatedBlockText) || (m == null ? void 0 : m.translated.text) || ""}`.trim(),
    section: hm(s, a, (m == null ? void 0 : m.source.page) ?? c),
    point: f
  };
}
function ym(e, t, n = document) {
  for (const r of n.elementsFromPoint(e, t)) {
    const o = r.closest(`[${ke}]`);
    if (!o) continue;
    const a = Number(o.getAttribute(ke)) || 0, i = (o.closest(`[${we}]`) ?? o).getAttribute(we) === "translated" ? "translated" : "source", c = o.querySelector("canvas");
    if (a && c) return { page: a, pane: i, canvas: c, slot: o };
  }
  return null;
}
function bm({ onDone: e, onCancel: t }) {
  const [n, r] = N(null), o = A(null), a = A(null);
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
      return ym(c, l);
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
        const f = nm(l.canvas.getBoundingClientRect(), u, { x: c.clientX, y: c.clientY });
        f && e({ page: l.page, pane: l.pane, region: f, canvas: l.canvas, point: { x: u.x, y: u.y, target: l.slot } });
      },
      children: [
        /* @__PURE__ */ p("p", { className: "reader-ask-crop-hint", children: "在书页上拖出一块，松开就带进提问 · Esc 取消" }),
        i ? /* @__PURE__ */ p("div", { className: "reader-ask-crop-box", style: i }) : null
      ]
    }
  );
}
const Ao = 5e4, vm = 2e4;
function Fn(e, t) {
  const n = `${e || ""}`;
  return n.length > t ? n.slice(0, t) : n;
}
function ib(e, t) {
  const n = { page: e.page, pane: e.pane, item_ids: e.itemId ? [e.itemId] : [] };
  return t.documentId && (n.document_id = t.documentId), t.jobId && (n.job_id = t.jobId), t.versionId && (n.translation_version = t.versionId), e.selection && (n.selected_text = e.selection), e.section && (n.section = e.section), e.sourceText && (n.source_text = e.sourceText), e.translatedText && (n.translated_text = e.translatedText), n;
}
function wm(e, t = null) {
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
function Sm(e, t) {
  if (!(e != null && e.page)) return null;
  const r = [!!(e.document_id && t && e.document_id !== t) ? "别的书" : "", `第 ${e.page} 页`, e.section || ""].filter(Boolean).join(" · ");
  return { page: e.page, label: r, data: e };
}
function Im(e) {
  var r;
  const t = e == null ? void 0 : e.data, n = ((r = t == null ? void 0 : t.retainpdf) == null ? void 0 : r.selection) ?? (t && typeof t.page == "number" ? t : null);
  return n && n.page ? n : null;
}
function cb(e, t) {
  var r;
  const n = Im(e);
  return !n || n.document_id && t && n.document_id !== t ? null : ((r = n.item_ids) == null ? void 0 : r[0]) || null;
}
function lb(e) {
  var o, a;
  const t = e.selection.trim();
  return t && !t.endsWith("…") ? t : ((a = (o = [...e.text.matchAll(/```[ \t]*(译文|translation|zh|zh-CN)[ \t]*\n([\s\S]*?)\n```/gi)].at(-1)) == null ? void 0 : o[2]) == null ? void 0 : a.trim()) || null;
}
function Tm(e, t) {
  var o;
  if (!t) return;
  const n = e.findIndex((a) => a.message_id === t);
  if (n < 0) return;
  const r = ((o = e[n + 1]) == null ? void 0 : o.role) === "assistant" ? km(e[n + 1].text) : "";
  return { question: e[n].text, ...r ? { answer: r } : {} };
}
function km(e, t = 160) {
  const n = e.replace(/```[\s\S]*?(```|$)/g, " ").replace(/\$\$[\s\S]*?\$\$/g, " … ").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim(), r = [...n];
  return r.length > t ? `${r.slice(0, t).join("")}…` : n;
}
function Em(e, t = [], n = "") {
  const r = new Set(t.map((o) => o.covers_to_seq));
  return e.filter((o) => !o.superseded_at).map((o) => {
    const a = r.has(o.seq) ? { compactedBefore: !0 } : {};
    if (o.role === "user") {
      const s = Tm(e, o.edited_from);
      return {
        id: o.message_id,
        role: "user",
        text: o.text,
        context: Sm(o.selection, n),
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
function Rm(e, t, n, r) {
  var l, u, f;
  const o = ((f = (u = (l = e.context) == null ? void 0 : l.meta) == null ? void 0 : u.retainpdf) == null ? void 0 : f.selection) ?? null, a = (o == null ? void 0 : o.document_id) || t || null, s = e.sessionId && e.sessionId.length <= 256 ? e.sessionId : null, i = { agent_id: e.agentId || null, document_id: a, session_id: s }, c = e.answer.usage && JSON.stringify(e.answer.usage).length <= 4096 ? e.answer.usage : null;
  return [
    { ...i, role: "user", text: Fn(e.question.text, Ao), selection: o, client_message_id: `${n}-q`, ...r ? { edited_from: r } : {} },
    {
      ...i,
      role: "assistant",
      text: Fn(e.answer.text, Ao),
      thought: e.answer.thought ? Fn(e.answer.thought, vm) : null,
      usage: c,
      client_message_id: `${n}-a`,
      memory_ids: e.memoryIds.slice(0, 10)
    }
  ];
}
function Pm(e) {
  return new Date(e - 2e3).toISOString().replace(/\.\d+Z$/, "Z");
}
function Mm(e, t) {
  return e.filter((n) => n.origin === "agent" && n.status === "active" && !t.has(n.memory_id)).map((n) => ({ id: n.memory_id, scope: n.scope, text: n.text, category: n.category, documentId: n.document_id, created: !0 }));
}
function xm(e, t) {
  if (t.id && e.some((r) => r.message_id === t.id)) return t.id;
  const n = t.text.trim();
  for (let r = e.length - 1; r >= 0; r -= 1) {
    const o = e[r];
    if (o.role === "assistant" && o.text.trim() === n) return o.message_id;
  }
  return null;
}
function Nm(e) {
  const t = e.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().split(new RegExp("(?<=[。！？.!?])"))[0] || "";
  return `深挖：${[...t].slice(0, 30).join("")}${[...t].length > 30 ? "…" : ""}`;
}
const _m = 50, Bn = { conversation: null, main: null, records: [], compactions: [], hasMore: !1, key: "local", initial: [] };
function Am() {
  var t, n;
  return `c-${((n = (t = globalThis.crypto) == null ? void 0 : t.randomUUID) == null ? void 0 : n.call(t)) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}
function Lo(e) {
  var n, r, o, a;
  const t = e;
  return `${(t == null ? void 0 : t.reason) || ((n = t == null ? void 0 : t.details) == null ? void 0 : n.reason) || ((a = (o = (r = t == null ? void 0 : t.payload) == null ? void 0 : r.error) == null ? void 0 : o.details) == null ? void 0 : a.reason) || (e instanceof Error ? e.message : "")}`;
}
function Lm({ port: e, book: t, onAppended: n }) {
  const r = (e == null ? void 0 : e.conversations) ?? null, o = (e == null ? void 0 : e.memories) ?? null, [a, s] = N(!1), [i, c] = N(Bn), [l, u] = N(!1), [f, d] = N(""), [m, g] = N("idle"), [h, b] = N(null), [w, I] = N([]), y = L((B) => {
    b(B), I([]);
  }, []), S = L((B) => I((W) => [...W, B].slice(-2)), []), [v, P] = N(() => /* @__PURE__ */ new Map()), M = A(/* @__PURE__ */ new Set()), E = A(/* @__PURE__ */ new Map()), $ = (B) => {
    if (!B) return null;
    const W = E.current.get(B);
    return W || (_.current.records.some((Y) => Y.message_id === B) ? B : null);
  }, _ = A(i);
  _.current = i;
  const k = A(t);
  k.current = t;
  const T = A(0), R = L(async (B, W, Y, de = []) => {
    if (!r) return;
    const ne = await r.messages(B.conversation_id, { limit: _m, ...Y ? { beforeSeq: Y } : {} }), ae = [...ne.messages, ...de];
    T.current += 1, c({
      conversation: B,
      main: W ?? B,
      records: ae,
      compactions: ne.compactions || [],
      hasMore: ne.has_more,
      key: `${B.conversation_id}:${T.current}`,
      initial: Em(ae, ne.compactions || [], k.current.documentId)
    });
  }, [r]), D = L(async () => {
    s(!0);
    const B = _.current.conversation;
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
    y(B), D();
  }, [D]), K = A(t.documentId);
  O(() => {
    K.current !== t.documentId && (K.current = t.documentId, _.current = Bn, c(Bn), y(null), P(/* @__PURE__ */ new Map()), E.current.clear(), a && D());
  }, [t.documentId, a, D]);
  const j = L(async () => {
    const B = _.current, W = B.records[0];
    if (!(!B.conversation || !W || !B.hasMore)) {
      u(!0);
      try {
        await R(B.conversation, B.main, W.seq, B.records);
      } finally {
        u(!1);
      }
    }
  }, [R]), J = L(async (B) => {
    const Y = _.current.conversation;
    if (!r || !Y) return;
    for (const Z of B.memoryIds) M.current.add(Z);
    let de = B.memoryIds;
    if (!de.length && o && B.startedAt) {
      const Z = Mm(
        await o.list({ source_conversation_id: Y.conversation_id, created_after: Pm(B.startedAt) }).catch(() => []),
        M.current
      );
      for (const x of Z) M.current.add(x.id);
      de = Z.map((x) => x.id);
      const fe = B.answerId;
      Z.length && fe && P((x) => new Map(x).set(fe, Z));
    }
    const ne = Rm({ ...B, memoryIds: de }, k.current.documentId, Am(), $(B.editedFrom));
    let ae;
    try {
      ae = await r.append(Y.conversation_id, ne);
    } catch (Z) {
      if (Y.kind !== "side" || !/ask_conversation_not_open/.test(Lo(Z))) throw Z;
      await r.reopen(Y.conversation_id), ae = await r.append(Y.conversation_id, ne);
    }
    const [Se, ee] = ae.messages;
    B.questionId && Se && E.current.set(B.questionId, Se.message_id), B.answerId && ee && E.current.set(B.answerId, ee.message_id), c((Z) => {
      var fe;
      return ((fe = Z.conversation) == null ? void 0 : fe.conversation_id) === Y.conversation_id ? { ...Z, conversation: ae.conversation, records: [...Z.records, ...ae.messages] } : Z;
    }), n == null || n(ae.messages), ae.compaction_due && Y.kind === "main" && r.compact(Y.conversation_id).catch(() => {
    });
  }, [r, o, n]), oe = L(async (B) => {
    const W = _.current.conversation, Y = $(B);
    if (!r || !W || !Y) return null;
    try {
      await r.supersede(W.conversation_id, Y);
    } catch (ae) {
      if (!/ask_message_superseded/.test(Lo(ae))) throw ae;
    }
    const de = _.current.records.find((ae) => ae.message_id === Y), ne = _.current.records.findIndex((ae) => ae.message_id === Y);
    return c((ae) => ({ ...ae, records: ae.records.map((Se, ee) => ee >= ne && ne >= 0 && !Se.superseded_at ? { ...Se, superseded_at: "now" } : Se) })), (de == null ? void 0 : de.selection) ?? null;
  }, [r]), q = L((B) => {
    J(B).catch((W) => d(`这一轮没存上：${W instanceof Error ? W.message : String(W)}`));
  }, [J]), se = L(async (B) => {
    var de;
    const W = _.current, Y = W.main;
    if (!(!r || !Y || ((de = W.conversation) == null ? void 0 : de.kind) !== "main")) {
      d("");
      try {
        const ne = xm(W.records, B), ae = await r.fork({
          parent_id: Y.conversation_id,
          ...ne ? { forked_from_message_id: ne } : {},
          title: Nm(B.text),
          ...k.current.documentId ? { document_id: k.current.documentId } : {}
        });
        await R(ae, Y);
      } catch (ne) {
        d(`开不了副对话：${ne instanceof Error ? ne.message : String(ne)}`);
      }
    }
  }, [r, R]), Ee = L(async (B) => {
    const W = _.current.main;
    if (r)
      try {
        await R(await r.get(B), W);
      } catch (Y) {
        d(`打不开副对话：${Y instanceof Error ? Y.message : String(Y)}`);
      }
  }, [r, R]), re = L(async () => {
    const B = _.current.main;
    B && await R(B, B).catch(() => {
    });
  }, [R]), ue = L(async () => {
    const B = _.current.conversation;
    if (!(!r || (B == null ? void 0 : B.kind) !== "side")) {
      g("busy");
      try {
        await r.close(B.conversation_id), g("idle"), await re();
      } catch {
        g("failed");
      }
    }
  }, [r, re]), Me = L(async () => r != null && r.archived ? r.archived(k.current.documentId) : [], [r]), ie = L(async (B) => {
    d(""), y(null);
    try {
      await R(B, _.current.main);
    } catch (W) {
      d(`打不开这个对话：${W instanceof Error ? W.message : String(W)}`);
    }
  }, [R, y]), le = L(async () => {
    const B = _.current.main;
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
    setPending: y,
    extras: w,
    addExtra: S,
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
    openSide: Ee,
    backToMain: re,
    closeSide: ue,
    archiveMain: le,
    listArchived: Me,
    viewArchived: ie,
    forgetMemory: r ? r.forgetMemory : void 0
  };
}
function Co(e, t, n) {
  var c;
  const r = e.selection, o = e.page ?? (r == null ? void 0 : r.page) ?? 0;
  if (e.role !== "user" || !o) return null;
  const a = (e.pane ?? (r == null ? void 0 : r.pane)) === "source" ? "source" : "translated", s = ((c = r == null ? void 0 : r.item_ids) == null ? void 0 : c[0]) ?? null, i = wm({ item_ids: [], ...r, page: o, pane: a }, n(s, a, o));
  return { key: t, anchor: i, messageId: e.message_id, title: e.text.slice(0, 80) };
}
function Cm({ port: e, documentId: t, resetKey: n, pointOf: r }) {
  const [o, a] = N([]), s = A(0), i = A(r);
  i.current = r;
  const c = () => (s.current += 1, s.current);
  O(() => {
    var m, g;
    if (a([]), !e || !t) return;
    let f = !1;
    const d = (h) => {
      !f && h.length && a((b) => [...b, ...h]);
    };
    return (m = e.threads) == null || m.list(t).then(
      (h) => d(h.map((b) => ({ key: c(), anchor: b.anchor, threadId: b.threadId, title: b.title }))),
      () => {
      }
    ), (g = e.conversations) == null || g.bookMessages(t).then(
      (h) => d(h.map((b) => Co(b, c(), i.current)).filter((b) => !!b)),
      () => {
      }
    ), () => {
      f = !0;
    };
  }, [e, t, n]);
  const l = L((f) => {
    const d = f.filter((m) => !m.document_id || m.document_id === t).map((m) => Co(m, c(), i.current)).filter((m) => !!m);
    d.length && a((m) => [...m.filter((g) => !d.some((h) => h.messageId === g.messageId)), ...d]);
  }, [t]), u = L((f) => a((d) => d.filter((m) => m.key !== f)), []);
  return { marks: o, addRecords: l, removeMark: u };
}
const Dm = va(() => import("./ReaderAskPanel-DedPBtoT.js"));
function $m({
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
  activePanel: b = null,
  panelHost: w = null
}) {
  const I = U(() => ({ documentId: t, jobId: n, versionId: r }), [t, n, r]), y = L((x, H, V) => {
    const me = x ? o.find((Ne) => Ne.itemId === x) : null, ye = me ? mt(me, a, H) : null, Ie = ye && ye.box.page === V ? lt(ye, 1, 1) : null;
    return Ie ? { x: Ie.left, y: Ie.top } : null;
  }, [o, a]), S = Cm({ port: e, documentId: t, resetKey: c, pointOf: y }), v = Lm({ port: e, book: I, onAppended: S.addRecords }), [P, M] = N(null), E = L(
    (x, H, V, me) => gm({
      pageElement: (x == null ? void 0 : x.closest(`[${ke}]`)) ?? null,
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
    const x = _o(((H = globalThis.getSelection) == null ? void 0 : H.call(globalThis)) ?? null);
    return !x.text || !x.element || !x.rect ? null : E(x.element, x.rect.left + x.rect.width / 2, x.rect.top + x.rect.height / 2, x.text);
  }, [E]), _ = L((x) => {
    M(null), v.ask(x);
  }, [v.ask]);
  O(() => {
    if (!e) return;
    const x = (H) => {
      var ye;
      if (H.key !== "?" || H.metaKey || H.ctrlKey || H.altKey || H.defaultPrevented) return;
      const V = H.target;
      if ((ye = V == null ? void 0 : V.closest) != null && ye.call(V, "input, textarea, select, [contenteditable='true']")) return;
      const me = $();
      me && (H.preventDefault(), H.stopImmediatePropagation(), _(me));
    };
    return window.addEventListener("keydown", x, !0), () => window.removeEventListener("keydown", x, !0);
  }, [e, $, _]);
  const k = A(m);
  k.current = m;
  const T = L(async ({ page: x, pane: H, region: V, canvas: me }) => {
    const ye = k.current[H];
    let Ie;
    if (ye)
      Ie = await rm(ye, x, V);
    else {
      const Ne = me ?? document.querySelector(`[${we}="${H}"] [${ke}="${x}"] canvas`);
      if (!Ne) throw new Error(`第 ${x} 页还没画出来，翻到那一页再试`);
      Ie = await om(Ne, V);
    }
    return new File([Ie], am(x, V), { type: "image/png" });
  }, []), [R, D] = N(null), z = A(v.pending);
  z.current = v.pending;
  const K = U(() => [{
    key: "page",
    label: "带上这一页",
    title: "带上这一页的截图（问的那一页，没有就是现在读的这页）：公式、图表、表格让 AI 直接看图",
    icon: /* @__PURE__ */ p(xi, { size: 14, "aria-hidden": !0 }),
    run: () => {
      const x = z.current, H = (x == null ? void 0 : x.pane) || (h === "translated" ? "translated" : "source");
      return T({ page: (x == null ? void 0 : x.page) || g() || 1, pane: H, region: kr });
    }
  }], [T, g, h]), [j, J] = N(!1), [oe, q] = N(""), se = L(async (x) => {
    J(!1), q("");
    try {
      const H = await T(x), V = E(x.point.target, x.point.x, x.point.y, "");
      D((me) => ({ id: ((me == null ? void 0 : me.id) || 0) + 1, files: [H] })), V ? _({ ...V, itemId: null, sourceText: "", translatedText: "" }) : v.openMain();
    } catch (H) {
      q(H instanceof Error ? H.message : String(H));
    }
  }, [T, E, _]), Ee = L(() => J(!1), []), re = L(() => {
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
  }, [e, t, v.openMain]), Me = L((x) => {
    var me;
    if (!e) return [];
    const H = _o(((me = globalThis.getSelection) == null ? void 0 : me.call(globalThis)) ?? null), V = E(x.target, x.clientX, x.clientY, H.element ? H.text : "");
    return V ? [{
      key: "ask",
      label: V.selection ? "问这段" : "在这里提问",
      hint: V.selection ? "?" : void 0,
      // 选着字时也出现在选字浮条上（「复制 · 收藏 · 提问」，ReaderSelectionLayer）。
      inSelectionBar: V.selection ? "提问" : void 0,
      onSelect: () => _(V)
    }, {
      key: "crop",
      label: "截一块问",
      onSelect: () => {
        q(""), J(!0);
      }
    }] : [];
  }, [e, E, _]), ie = P ? {
    anchor: P.anchor,
    messages: P.messages,
    onClose: () => M(null),
    onDelete: e != null && e.threads && P.mark.threadId ? () => {
      e.threads.remove(t, P.mark.threadId).catch(() => {
      }), S.removeMark(P.mark.key), M(null);
    } : void 0
  } : null, le = U(() => f ? (x, H) => {
    f(x, H ?? void 0), requestAnimationFrame(() => d(x, "translated"));
  } : null, [f, d]), B = L((x) => os(o, x), [o]), [W, Y] = N(0), de = L(({ mode: x, width: H }) => {
    Y(x === "dock" ? Math.round(H) : 0);
  }, []), ne = !v.persistent || !!v.view.conversation || !!v.error, ae = e && (v.visible && ne || P) ? /* @__PURE__ */ p(ba, { fallback: null, children: /* @__PURE__ */ p(
    Dm,
    {
      port: e,
      jobId: n,
      book: I,
      ask: v,
      legacy: ie,
      onShowSelection: ({ page: x, pane: H }) => l(x, H),
      onJumpToPage: (x) => l(x),
      pageCount: u,
      onLayout: de,
      dockTaken: b !== null,
      dockHost: w,
      onEditBlock: le,
      canEditBlock: B,
      attachTools: K,
      attachRequest: R
    }
  ) }) : null, Se = j || oe ? /* @__PURE__ */ C(Ae, { children: [
    j ? /* @__PURE__ */ p(bm, { onDone: (x) => void se(x), onCancel: Ee }) : null,
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
  return { marks: S.marks, onMark: ue, menuItems: Me, panel: ae, overlay: Se, cropping: j, toggleCrop: re, open: v.openMain, toggle: fe, showing: ee, reserveRight: ee ? W : 0, enabled: !!e };
}
const Om = [{ keys: "选字 + ?", desc: "问选中的这段" }];
function zm() {
  const e = Ct(), t = U(() => {
    try {
      return Ze().ask ?? null;
    } catch {
      return null;
    }
  }, []), n = $m({
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
      Icon: Ma,
      pressed: d,
      onClick: f
    }, {
      // 底栏右边：框出书页上的一块，截图带进提问（和右键「截一块问」一样）。
      key: "crop",
      label: "截图",
      title: "截图：在书页上框出一块，带进提问（Esc 取消）",
      Icon: Ni,
      place: "bottom",
      pressed: c,
      onClick: l
    }],
    menuItems: a,
    pageLayer: r.length ? ({ page: h, height: b }) => /* @__PURE__ */ p(em, { marks: r, page: h, height: b, onOpen: o }) : void 0,
    shortcuts: Om,
    reserveRight: m,
    // 「截一块问」时占着书页上的指针：不出悬停框、不选字。
    takesPointer: c
  } : {}, [u, a, r, o, f, d, m, c, l]);
  return an(g), /* @__PURE__ */ C(Ae, { children: [
    s,
    i
  ] });
}
const Fm = { id: "ask", title: "提问", Component: zm };
function Qn() {
  try {
    return Ze().translationVersions ?? null;
  } catch {
    return null;
  }
}
function Bm(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function Hm(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function jm(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function Um({ documentId: e, jobId: t }) {
  const [n, r] = N([]), [o, a] = N(null);
  O(() => {
    r([]);
    const i = Qn();
    if (!i || !e) return;
    let c = !1;
    return i.list(e).then((l) => {
      c || (r(l.versions), a(l.currentVersionId));
    }).catch(() => {
    }), () => {
      c = !0;
    };
  }, [e, t]);
  const s = Hm(n, t, o);
  return U(() => ({ versions: n, readingVersionId: s }), [n, s]);
}
function Wm({ documentId: e, jobId: t, versions: n, readingVersionId: r }) {
  const [o, a] = N(null), [s, i] = N(""), [c, l] = N(""), u = A(0);
  O(() => {
    u.current += 1, a(null), i(""), l("");
  }, [e, t]);
  const f = L((g) => {
    const h = Qn(), b = n.find((I) => I.versionId === g);
    if (!h || !b || !e) return;
    const w = ++u.current;
    i(g), l(""), (async () => {
      const I = Ze(), y = await h.resolveJob(e, g);
      if (!y) throw new Error("这一份还没有能读的译文。");
      const S = await I.loadReaderPayload(y, { includeOptionalArtifacts: !0 }), v = I.resolveReaderTranslatedPdfUrl(S.jobPayload, S.manifestPayload);
      if (!v) throw new Error("这一份没有译文 PDF。");
      return { versionId: g, name: b.name, jobId: y, url: v, regions: Bm(Sa(S.regionsPayload)) };
    })().then((I) => {
      w === u.current && a(I);
    }).catch((I) => {
      w === u.current && l((I == null ? void 0 : I.message) || "这一份打不开。");
    }).finally(() => {
      w === u.current && i("");
    });
  }, [e, n]), d = L(() => {
    u.current += 1, a(null), i(""), l("");
  }, []), m = L(async () => {
    var b, w;
    const g = Qn();
    if (!g || !o || !e) return;
    try {
      await g.select(e, o.versionId);
    } catch (I) {
      l((I == null ? void 0 : I.message) || "换不过去，请稍后再试。");
      return;
    }
    const h = (b = globalThis.location) == null ? void 0 : b.href;
    h && ((w = globalThis.history) == null || w.replaceState(globalThis.history.state, "", jm(h, o.jobId))), a(null);
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
function Km(e) {
  return e.available ? {
    key: "compare",
    label: "对比版本",
    title: "对比版本：左边换成这本书的另一份译文",
    Icon: _i,
    place: "compare",
    pressed: !!(e.compared || e.loading),
    popup: (t) => /* @__PURE__ */ p(Tf, { compare: e, onDone: t })
  } : null;
}
function Vm(e) {
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
function qm() {
  var i;
  const e = Ct(), t = Wm({
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
    const c = Km(t);
    return { toolbarItems: c ? [c] : [], comparedDocument: Vm(t) };
  }, [t]);
  return an(s), null;
}
const Jm = { id: "compare", title: "对比版本", Component: qm }, Te = (e) => {
  const t = Number(e);
  return Number.isFinite(t) ? t : 0;
}, Do = (e) => {
  const t = Array.isArray(e) ? e : [];
  return [Te(t[0]), Te(t[1]), Te(t[2])];
};
function $o([e, t, n]) {
  const r = Math.max(e, t, n) > 1 ? 1 : 255, o = (a) => Math.round(Math.min(255, Math.max(0, a * r)));
  return `rgb(${o(e)}, ${o(t)}, ${o(n)})`;
}
function Gm(e, t = []) {
  const n = e && typeof e == "object" ? e : null;
  if (!n || !`${n.schema || ""}`.startsWith("rpr_layout_")) return null;
  const r = /* @__PURE__ */ new Map();
  for (const o of Array.isArray(n.pages) ? n.pages : []) {
    const a = o, s = Math.floor(Te(a.index));
    if (s < 0 || !(Te(a.width) > 0) || !(Te(a.height) > 0)) continue;
    const i = (Array.isArray(a.covers) ? a.covers : []).flatMap((l) => {
      const u = l, f = Array.isArray(u.rect) ? u.rect.map(Te) : [];
      return f.length === 4 && f[2] > f[0] && f[3] > f[1] ? [{ block: `${u.block || ""}`, rect: f, fill: Do(u.fill) }] : [];
    }), c = (Array.isArray(a.blocks) ? a.blocks : []).flatMap((l) => {
      const u = l, f = Te(u.fontSize);
      if (!(f > 0)) return [];
      const d = (Array.isArray(u.lines) ? u.lines : []).map((m) => {
        const g = m, h = (Array.isArray(g.items) ? g.items : []).flatMap((b) => {
          const w = b;
          return typeof w.tex == "string" ? [{ x: Te(w.x), tex: w.tex, display: !!w.display, w: Te(w.w), h: Te(w.h), d: Te(w.d) }] : typeof w.t == "string" && w.t ? [w.mode === "dflt" ? { x: Te(w.x), t: w.t, mode: "dflt" } : { x: Te(w.x), t: w.t }] : [];
        });
        return { text: `${g.text || ""}`, x: Te(g.x), baseline: Te(g.baseline), width: Te(g.width), justified: !!g.justified, items: h };
      });
      return [{ id: `${u.id || ""}`, fontSize: f, weight: u.weight === "bold" ? "bold" : "regular", color: Do(u.color), lines: d }];
    });
    r.set(s + 1, { index: s, width: Te(a.width), height: Te(a.height), covers: i, blocks: c });
  }
  return { schema: `${n.schema}`, pages: r, fonts: t };
}
async function Xm(e, t = fetch) {
  var s;
  const n = new URL(e, (s = globalThis.location) == null ? void 0 : s.href), r = await (await t(n.href)).json(), o = (r.fonts || []).flatMap((i) => i.family && i.url ? [{ family: i.family, weight: Te(i.weight) || 400, url: new URL(i.url, n).href }] : []), a = await (await t(new URL(r.layout || "layout.json", n).href)).json();
  return Gm(a, o);
}
function Ym(e) {
  return [...[...new Set(e.map((n) => n.family))].map((n) => `"${n.replace(/"/g, "")}"`), "serif"].join(", ");
}
const Oo = /* @__PURE__ */ new Set();
async function Zm(e) {
  const t = `${e.family}|${e.weight}|${e.url}`;
  if (Oo.has(t)) return !0;
  for (let n = 0; n < 2; n += 1)
    try {
      const r = new FontFace(e.family, `url(${JSON.stringify(e.url)})`, { weight: `${e.weight}` });
      return document.fonts.add(await r.load()), Oo.add(t), !0;
    } catch (r) {
      n === 1 && console.warn("[render-layout] 字体没装上：", e.family, e.url, r);
    }
  return !1;
}
async function Qm(e) {
  var r;
  if (typeof FontFace > "u" || typeof document > "u" || !document.fonts) return !1;
  const t = (r = e[0]) == null ? void 0 : r.family, n = await Promise.all(e.map(async (o) => ({ font: o, ok: await Zm(o) })));
  return !!t && n.every(({ font: o, ok: a }) => a || o.family !== t);
}
function eh() {
  var e;
  try {
    return new URLSearchParams(((e = globalThis.location) == null ? void 0 : e.search) || "").get("render_layout") || "";
  } catch {
    return "";
  }
}
function th() {
  const [e, t] = N(null);
  return O(() => {
    const n = eh();
    if (!n) return;
    let r = !0;
    return Xm(n).then(async (o) => {
      if (!o) return;
      if (!await Qm(o.fonts)) {
        console.warn("[render-layout] 主字体没装全，HTML 页退回按 OCR 的框塞字");
        return;
      }
      r && t(o);
    }).catch((o) => console.warn("[render-layout] 版面没读到：", n, o)), () => {
      r = !1;
    };
  }, []), e;
}
const nh = '"Times New Roman", "Tinos", "Liberation Serif", "Source Han Serif SC", "Noto Serif CJK SC", serif', fn = 1.5;
function rh(e, t) {
  const n = Ce(e);
  if (n === "formula") {
    const o = `${e.markdown || e.source.text || ""}`.trim();
    return o ? { kind: "display_formula", content: o } : null;
  }
  if (n !== "text") return null;
  const r = t === "translated" ? `${e.translatedBlockText || e.markdown || e.translated.text || ""}`.trim() : `${e.source.text || ""}`.trim();
  return r ? { kind: e.regionType || "text", content: r } : null;
}
function oh(e) {
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
function ah({ page: e, width: t, height: n, regions: r, metadata: o, text: a, arrivedAt: s }) {
  const { items: i, scale: c } = U(() => {
    var d;
    const l = [];
    let u = 0;
    const f = [...r].sort((m, g) => (m.readingOrder ?? 0) - (g.readingOrder ?? 0));
    for (const m of f) {
      const g = rh(m, a);
      if (!g) continue;
      const h = mt(m, o, "source");
      if (!h || h.box.page !== e) continue;
      const b = lt(h, t, n);
      !b || b.width < 2 || b.height < 2 || (!u && ((d = h.pageSize) != null && d.width) && (u = t / h.pageSize.width), l.push({
        order: l.length,
        item: {
          itemId: m.itemId,
          translatedText: g.content,
          status: "html",
          kind: g.kind,
          sourceText: m.source.text || "",
          typography: a === "source" && g.kind !== "display_formula" ? { font_family: nh } : void 0,
          rect: {
            left: b.left - fn,
            top: b.top - fn,
            width: b.width + fn * 2,
            height: b.height + fn * 2
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
      children: /* @__PURE__ */ p(Sr, { item: l, pageScale: c })
    },
    `${l.itemId}:${l.changedAtSeq}`
  )) }) : null;
}
function sh(e) {
  var r;
  if (!e) return null;
  const t = /<svg([^>]*)>([\s\S]*)<\/svg>/i.exec(e);
  if (!t) return null;
  const n = (r = /viewBox="([^"]+)"/i.exec(t[1])) == null ? void 0 : r[1];
  return n ? { viewBox: n, inner: t[2] } : null;
}
const Bt = /* @__PURE__ */ new Map(), ih = 512;
function ch(e) {
  let t = Bt.get(e);
  if (!t && (t = Ji(e, !1).then(sh), Bt.set(e, t), Bt.size > ih)) {
    const n = Bt.keys().next().value;
    n !== void 0 && Bt.delete(n);
  }
  return t;
}
function lh({ page: e, width: t, height: n, fontFamily: r, arrivedAt: o }) {
  const a = U(() => {
    const l = /* @__PURE__ */ new Set();
    for (const u of e.blocks) for (const f of u.lines) for (const d of f.items) "tex" in d && l.add(d.tex);
    return [...l];
  }, [e]), [s, i] = N(() => /* @__PURE__ */ new Map());
  O(() => {
    let l = !0;
    return Promise.all(a.map(async (u) => [u, await ch(u)])).then((u) => {
      l && i(new Map(u));
    }), () => {
      l = !1;
    };
  }, [a]);
  const c = Date.now() - o < 1500;
  return /* @__PURE__ */ C(
    "svg",
    {
      className: "reader-layout-page",
      "data-html-page": e.index + 1,
      viewBox: `0 0 ${e.width} ${e.height}`,
      width: t,
      height: n,
      preserveAspectRatio: "none",
      style: { fontFamily: r },
      children: [
        e.covers.map((l, u) => /* @__PURE__ */ p(
          "rect",
          {
            x: l.rect[0],
            y: l.rect[1],
            width: l.rect[2] - l.rect[0],
            height: l.rect[3] - l.rect[1],
            fill: $o(l.fill)
          },
          `${l.block}:${u}`
        )),
        e.blocks.map((l, u) => {
          const f = $o(l.color);
          return /* @__PURE__ */ p(
            "g",
            {
              className: `reader-layout-block${c ? " is-arriving" : ""}`,
              "data-html-block": l.id,
              fill: f,
              fontSize: l.fontSize,
              fontWeight: l.weight === "bold" ? 700 : 400,
              style: { "--reader-html-order": u, color: f },
              children: l.lines.map((d, m) => d.items.map((g, h) => {
                const b = `${m}:${h}`;
                if ("tex" in g) {
                  const w = s.get(g.tex), I = l.fontSize;
                  return w ? /* @__PURE__ */ p(
                    "svg",
                    {
                      className: "reader-layout-math",
                      x: g.x,
                      y: d.baseline - g.h * I,
                      width: Math.max(0.01, g.w * I),
                      height: Math.max(0.01, (g.h + g.d) * I),
                      viewBox: w.viewBox,
                      preserveAspectRatio: "none",
                      "data-tex": g.tex,
                      dangerouslySetInnerHTML: { __html: w.inner }
                    },
                    b
                  ) : null;
                }
                return /* @__PURE__ */ p("text", { x: g.x, y: d.baseline, lang: g.mode === "dflt" ? "en" : "zh-Hans", children: g.t }, b);
              }))
            },
            `${l.id}:${o}`
          );
        })
      ]
    }
  );
}
const uh = [
  { value: null, label: "关", hint: "看原来的 PDF" },
  { value: "translated", label: "画译文", hint: "原文页上按 OCR 的框用 HTML 画译文" },
  { value: "source", label: "画原文", hint: "原文页上按 OCR 的框用 HTML 重画原文" }
];
function dh() {
  const e = Ct(), [t, n] = N(null), [r, o] = N(0), a = U(() => oh(e.regions), [e.regions]), s = th(), i = U(() => Ym((s == null ? void 0 : s.fonts) ?? []), [s]), c = !e.sourceOnly, { metadata: l, visibleMode: u, setWorkspace: f } = e, d = U(() => {
    const m = (g) => {
      n(g), o(Date.now()), g && u === "translated" && f("source");
    };
    return {
      toolbarItems: [{
        key: "html-page",
        label: "HTML 页",
        title: t ? `HTML 页：${t === "translated" ? s ? "画译文（照排版引擎的版面）" : "画译文" : "画原文"}（点开换）` : "HTML 页：把书页用 HTML 画出来",
        Icon: Ai,
        pressed: !!t,
        popup: (g) => /* @__PURE__ */ p("div", { className: "reader-html-page-menu reader-floating-surface", role: "menu", "aria-label": "HTML 页", children: uh.filter((h) => h.value !== "translated" || c).map((h) => /* @__PURE__ */ p(
          X,
          {
            className: "reader-html-page-choice",
            role: "menuitemradio",
            "aria-checked": t === h.value,
            title: h.hint,
            onClick: () => {
              m(h.value), g();
            },
            children: h.label
          },
          h.label
        )) })
      }],
      pageLayer: t ? ({ page: g, width: h, height: b, pane: w, active: I }) => {
        if (!I || w !== "source") return null;
        if (t === "translated" && s) {
          const y = s.pages.get(g);
          return y ? /* @__PURE__ */ p(lh, { page: y, width: h, height: b, fontFamily: i, arrivedAt: r }) : null;
        }
        return /* @__PURE__ */ p(
          ah,
          {
            page: g,
            width: h,
            height: b,
            regions: a.get(g) ?? [],
            metadata: l,
            text: t,
            arrivedAt: r
          }
        );
      } : void 0
    };
  }, [t, r, a, l, c, u, f, s, i]);
  return an(d), null;
}
const fh = { id: "html-page", title: "HTML 页", Component: dh }, Ss = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], zo = { pen: 35e-4, highlighter: 0.018 }, Fo = 0.015, er = "retainpdf.reader.ink.v1:";
function Bo(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(er + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function mh(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(er + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(er + e);
    } catch {
    }
}
function hh(e, t, n, r, o, a) {
  const s = Fo * Fo;
  return e.filter((i) => Is(i, t, n) && i.points.some(([c, l]) => (c - r) ** 2 + ((l - o) * a) ** 2 <= s)).map((i) => i.id);
}
function Is(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function ph(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function gh(e) {
  const [t, n] = N(null), [r, o] = N(Ss[0].key), [a, s] = N(() => Bo(e)), i = A(a), c = A([]);
  O(() => {
    const h = Bo(e);
    i.current = h, s(h), c.current = [];
  }, [e]);
  const l = L((h) => {
    i.current = h, s(h), mh(e, h);
  }, [e]), u = L((h) => {
    const b = i.current, w = h(b);
    w !== b && (c.current = [...c.current.slice(-49), b], l(w));
  }, [l]), f = L((h) => {
    h.points.length < 1 || u((b) => [...b, { ...h, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [u]), d = L((h) => {
    h.length && u((b) => b.filter((w) => !h.includes(w.id)));
  }, [u]), m = L((h) => {
    u((b) => b.some((w) => w.page === h) ? b.filter((w) => w.page !== h) : b);
  }, [u]), g = L(() => {
    const h = c.current.pop();
    h && l(h);
  }, [l]);
  return U(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: d, undo: g, clearPage: m }),
    [t, r, a, f, d, g, m]
  );
}
const yh = [
  { tool: "pen", label: "画笔", Icon: bn },
  { tool: "highlighter", label: "荧光笔", Icon: Li },
  { tool: "eraser", label: "橡皮", Icon: Ci }
];
function bh(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function vh({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ C(Ae, { children: [
    yh.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
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
    Ss.map((o) => /* @__PURE__ */ p(
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
    /* @__PURE__ */ p(X, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(Di, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      X,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p($i, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
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
function Ho({ ink: e, page: t, onPick: n }) {
  return /* @__PURE__ */ p("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ p(vh, { ink: e, page: t, onPick: n }) });
}
function wh(e) {
  const t = A(e);
  t.current = e, O(() => {
    const n = (r) => {
      if (bh(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
const Sh = "reader-ink-layer";
function Ih(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function jo({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: Ih(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function Th({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = N(null), i = A(!1), c = o.strokes.filter((h) => Is(h, e, t)), l = !!o.tool;
  if (!l && !c.length) return null;
  const u = (h) => {
    const b = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - b.left) / Math.max(1, b.width))),
      Math.min(1, Math.max(0, (h.clientY - b.top) / Math.max(1, b.height)))
    ];
  }, f = (h, b) => o.erase(hh(o.strokes, e, t, h, b, r / Math.max(1, n))), d = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [b, w] = u(h);
    o.tool === "eraser" ? f(b, w) : s([[b, w]]);
  }, m = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [b, w] = u(h);
    o.tool === "eraser" ? f(b, w) : s((I) => I ? ph(I, b, w) : [[b, w]]);
  }, g = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: zo[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ C(
    "svg",
    {
      className: Sh,
      "data-ink-active": l ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: d,
      onPointerMove: m,
      onPointerUp: g,
      onPointerCancel: g,
      children: [
        c.map((h) => /* @__PURE__ */ p(jo, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(jo, { stroke: { tool: o.tool, color: o.color, width: zo[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
const kh = [
  { keys: "P", desc: "进入 / 退出画笔（书页上右键也能选笔和颜色）" },
  { keys: "Esc", desc: "退出画笔" },
  { keys: "⌘Z / Ctrl+Z", desc: "画笔模式下撤销" }
];
function Eh(e) {
  return {
    toolbarItems: [{
      key: "ink",
      label: "画笔",
      title: "画笔（P；书页上右键也能选笔和颜色）",
      Icon: bn,
      // 钢笔图标，右下角一个当前笔色的小点（2026-11-28：两条栏只用图标，单一个圆点认不出是画笔）。
      mark: /* @__PURE__ */ C("span", { className: "reader-ink-mark", "aria-hidden": !0, children: [
        /* @__PURE__ */ p(bn, { ...Pe }),
        /* @__PURE__ */ p("span", { className: "reader-ink-dot", style: { background: `var(--${e.color})` } })
      ] }),
      place: "bottom",
      pressed: !!e.tool,
      onClick: () => e.setTool(e.tool ? null : "pen"),
      dropdown: (t) => /* @__PURE__ */ p(Ho, { ink: e, onPick: t })
    }],
    menuSection: ({ page: t, close: n }) => /* @__PURE__ */ p(Ho, { ink: e, page: t, onPick: n }),
    // 离视口远的页只是占位，笔迹先不画（和以前一样只画 active 的页）。
    pageLayer: ({ page: t, pane: n, width: r, height: o, active: a }) => a ? /* @__PURE__ */ p(Th, { page: t, pane: n, width: r, height: o, ink: e }) : null,
    takesPointer: !!e.tool,
    shortcuts: kh
  };
}
function Rh() {
  const e = Ct(), t = gh(e.resetKey);
  wh(t);
  const n = U(() => Eh(t), [t]);
  return an(n), null;
}
const Ph = { id: "ink", title: "画笔", Component: Rh };
function Mh(e) {
  const t = A(!1);
  return e && (t.current = !0), t.current;
}
const xh = va(() => import("./ReaderMarkdownPanel-D4Ek2MBv.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), Ts = { id: "markdown", label: "Markdown", short: "MD", Icon: Oi, needsJob: !0 };
function Nh() {
  const e = Ct(), t = e.activePanel === Ts.id;
  if (!Mh(t)) return null;
  const r = /* @__PURE__ */ p(ba, { fallback: null, children: /* @__PURE__ */ p(xh, { open: t, jobId: e.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: e.closePanel }) });
  return e.panelHost ? Gi(r, e.panelHost) : r;
}
const _h = {
  id: "markdown",
  title: "Markdown",
  Component: Nh,
  panels: [Ts]
}, ks = "reader-xref", tr = "data-xref", Wt = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, Ah = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${Wt})`), Lh = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function nr(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function Ch(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function Dh(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function $h(e, t, n) {
  const r = e[t], o = (i) => {
    if (!i || i.source.page !== r.source.page) return !1;
    const c = Ce(i);
    return c === "figure" || c === "table" || c === "formula";
  }, a = (i) => {
    const c = [];
    for (let l = t + i; o(e[l]) && c.length < 40; l += i) c.push(e[l]);
    return i < 0 ? c.reverse() : c;
  }, s = a(n === "table" ? 1 : -1);
  return s.length ? s : a(n === "table" ? -1 : 1);
}
function Oh(e, t, n) {
  return (e.find((o) => Ce(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function zh(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = Ce(r), s = Dh(r);
    if (a === "formula") {
      for (const g of s.matchAll(Lh)) {
        const h = nr(g[1]);
        h && n({ key: `equation:${h}`, kind: "equation", label: h, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = Ah.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const l = Ch(i[1]), u = nr(i[2]), f = $h(e, o, l), d = [...f.map((g) => g.itemId), r.itemId], m = new Map(e.map((g, h) => [g.itemId, h]));
    d.sort((g, h) => (m.get(g) ?? 0) - (m.get(h) ?? 0)), n({ key: `${l}:${u}`, kind: l, label: u, itemId: Oh(f, r, l), itemIds: d, captionId: r.itemId });
  }), t;
}
const Fh = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${Wt})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${Wt})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${Wt})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${Wt})\s*[）)]`, "g"), kind: () => "equation" }
];
function Bh(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of Fh) {
    o.lastIndex = 0;
    for (const s of e.matchAll(o)) {
      const i = s.length > 2 ? s[1] : "", c = nr(s[s.length - 1]), l = `${a(i)}:${c}`;
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
function Hh(e, t) {
  return Bh(e, t).map((n) => ({ start: n.start, end: n.end, className: ks, attrs: { [tr]: n.key } }));
}
const jh = { figure: "图", table: "表", equation: "式" };
function Uo(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${jh[e.kind]} ${e.label}`;
}
const Wo = { figure: "图", table: "表", formula: "公式", text: "文字" }, rt = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function Uh(e, t, n) {
  const r = mt(e, t, n), o = r ? lt(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = gs({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function Wh(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, c = null;
  for (const u of e) {
    const f = mt(u, t, n), d = f ? lt(f, 1, 1) : null;
    !f || !d || (r || (r = f.box.page, c = f.pageSize), f.box.page === r && (o = Math.min(o, d.left), a = Math.min(a, d.top), s = Math.max(s, d.left + d.width), i = Math.max(i, d.top + d.height)));
  }
  if (!r || !c) return null;
  const l = gs({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: l, aspect: l.height * c.height / Math.max(1e-6, l.width * c.width) };
}
function Kh(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function Vh(e, t) {
  const n = (o) => {
    const a = Ce(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function qh({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var $;
  const i = t.find((_) => _.itemId === e) ?? null, c = U(() => i ? Vh(t, i) : [], [t, i]), l = i ? c.indexOf(i) : -1, [u, f] = N(rt.indexOf(1)), d = rt[u], m = A(null), [g, h] = N(0);
  Le(() => {
    const _ = m.current;
    if (!_) return;
    const k = () => h(_.clientWidth);
    k();
    const T = typeof ResizeObserver == "function" ? new ResizeObserver(k) : null;
    return T == null || T.observe(_), () => T == null ? void 0 : T.disconnect();
  }, []);
  const b = L((_) => {
    const k = c[l + _];
    k && a(k.itemId);
  }, [c, l, a]);
  O(() => {
    const _ = (k) => {
      if (k.key === "Escape")
        k.preventDefault(), s();
      else if (k.key === "ArrowLeft")
        k.preventDefault(), b(-1);
      else if (k.key === "ArrowRight")
        k.preventDefault(), b(1);
      else if (k.key === "+" || k.key === "=")
        k.preventDefault(), f((T) => Math.min(rt.length - 1, T + 1));
      else if (k.key === "-" || k.key === "_")
        k.preventDefault(), f((T) => Math.max(0, T - 1));
      else if (k.key === "0")
        k.preventDefault(), f(rt.indexOf(1));
      else
        return;
      k.stopPropagation();
    };
    return window.addEventListener("keydown", _, !0), () => window.removeEventListener("keydown", _, !0);
  }, [s, b]), O(() => {
    const _ = m.current;
    if (!_) return;
    const k = (T) => {
      !T.ctrlKey && !T.metaKey || (T.preventDefault(), f((R) => Math.max(0, Math.min(rt.length - 1, R + (T.deltaY < 0 ? 1 : -1)))));
    };
    return _.addEventListener("wheel", k, { passive: !1 }), () => _.removeEventListener("wheel", k);
  }, []);
  const w = A(null);
  if (!i) return null;
  const I = Ce(i), y = o.map((_) => ({ pane: _, pdf: r[_] ?? null, where: Uh(i, n, _) })).filter((_) => !!(_.pdf && _.where)), S = 16, v = typeof window > "u" ? 800 : window.innerHeight, P = Math.min(880, v * 0.9) - 56 - 32 - (y.length > 1 ? 26 : 0), M = y.length ? Kh(Math.max(120, (g - S * (y.length - 1) - 32) / y.length), P, y.map((_) => _.where.aspect)) : 0, E = (($ = y[0]) == null ? void 0 : $.where.page) ?? i.source.page;
  return /* @__PURE__ */ C("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${Wo[I] ?? "这一块"}`, children: [
    /* @__PURE__ */ p("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ C("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ C("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ C("span", { className: "reader-zoom-title", children: [
          Wo[I] ?? "这一块",
          " · 第 ",
          E,
          " 页"
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-zoom-count", children: l >= 0 ? `${l + 1} / ${c.length}` : "" }),
        /* @__PURE__ */ C("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ p(dt, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: l <= 0, onClick: () => b(-1), children: /* @__PURE__ */ p(Ia, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(dt, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: l < 0 || l >= c.length - 1, onClick: () => b(1), children: /* @__PURE__ */ p(xa, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(dt, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => f((_) => Math.max(0, _ - 1)), children: /* @__PURE__ */ p(Na, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ C(X, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => f(rt.indexOf(1)), children: [
            Math.round(d * 100),
            "%"
          ] }),
          /* @__PURE__ */ p(dt, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === rt.length - 1, onClick: () => f((_) => Math.min(rt.length - 1, _ + 1)), children: /* @__PURE__ */ p(_a, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(dt, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: s, children: /* @__PURE__ */ p(bt, { size: 16, "aria-hidden": !0 }) })
        ] })
      ] }),
      /* @__PURE__ */ p(
        "div",
        {
          ref: m,
          className: "reader-zoom-body",
          onPointerDown: (_) => {
            const k = m.current;
            !k || _.button !== 0 || (w.current = { x: _.clientX, y: _.clientY, left: k.scrollLeft, top: k.scrollTop }, k.setPointerCapture(_.pointerId));
          },
          onPointerMove: (_) => {
            const k = m.current, T = w.current;
            !k || !T || (k.scrollLeft = T.left - (_.clientX - T.x), k.scrollTop = T.top - (_.clientY - T.y));
          },
          onPointerUp: () => {
            w.current = null;
          },
          children: y.length && g ? /* @__PURE__ */ p("div", { className: "reader-zoom-columns", style: { gap: S }, children: y.map(({ pane: _, pdf: k, where: T }) => /* @__PURE__ */ C("figure", { className: "reader-zoom-column", children: [
            y.length > 1 ? /* @__PURE__ */ p("figcaption", { children: _ === "source" ? "原文" : "译文" }) : null,
            /* @__PURE__ */ p(
              bs,
              {
                className: "reader-zoom-canvas",
                pdf: k,
                page: T.page,
                region: T.fraction,
                cssWidth: M * d,
                label: `${_ === "source" ? "原文" : "译文"}第 ${T.page} 页`
              }
            )
          ] }, _)) }) : /* @__PURE__ */ p("p", { className: "reader-zoom-empty", children: g ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
const Jh = 380, Gh = 320, It = 8;
function Xh(e, t, n) {
  const r = Math.max(It, Math.min(e.left, n.width - t.width - It)), o = e.bottom + It, a = o + t.height <= n.height - It ? o : Math.max(It, e.top - It - t.height);
  return { left: r, top: a };
}
function Yh({
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
    const m = r[d], g = m ? Wh(o, n, d) : null;
    if (m && g) {
      s = { pdf: m, where: g };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min(Jh, Gh / Math.max(0.05, s.where.aspect))), c = Math.round(i * s.where.aspect) + 30, l = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: f } = Xh(e.anchor, { width: Math.max(i, 160) + 16, height: c + 16 }, l);
  return /* @__PURE__ */ C("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: f }, children: [
    /* @__PURE__ */ C("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ p("span", { children: Uo(e.target) }),
      /* @__PURE__ */ C("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ p(bs, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: Uo(e.target) })
  ] });
}
const Zh = 250;
function Qh(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function ep(e, t, n) {
  const r = n === "back" ? e.back : e.forward;
  if (!r.length) return null;
  const o = r[r.length - 1], a = r.slice(0, -1), s = n === "back" ? { back: a, forward: [...e.forward, t] } : { back: [...e.back, t], forward: a };
  return { to: o, history: s };
}
function tp(e) {
  var n;
  const t = e;
  return !!((n = t == null ? void 0 : t.closest) != null && n.call(t, "input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
function np({
  shellEl: e,
  index: t,
  primaryPane: n,
  follow: r
}) {
  const [o, a] = N(null), [s, i] = N({ back: [], forward: [] }), c = A(s);
  c.current = s;
  const l = A(null), u = A({ index: t, primaryPane: n, follow: r, shellEl: e });
  u.current = { index: t, primaryPane: n, follow: r, shellEl: e };
  const f = L(() => {
    const { shellEl: m, primaryPane: g } = u.current;
    return Vt(m, g);
  }, []);
  O(() => {
    if (!e) return;
    const m = (y) => {
      var S, v;
      return (v = (S = y.target) == null ? void 0 : S.closest) == null ? void 0 : v.call(S, `.${ks}`);
    }, g = () => {
      l.current != null && window.clearTimeout(l.current), l.current = null;
    }, h = (y) => {
      var M;
      const S = m(y);
      if (!S) return;
      const v = u.current.index.get(S.getAttribute(tr) || "");
      if (!v) return;
      const P = ((M = S.closest("[data-reader-pane]")) == null ? void 0 : M.getAttribute("data-reader-pane")) || u.current.primaryPane;
      g(), l.current = window.setTimeout(() => {
        const E = S.getBoundingClientRect();
        a({ target: v, pane: P, anchor: { left: E.left, top: E.top, right: E.right, bottom: E.bottom } });
      }, Zh);
    }, b = (y) => {
      const S = m(y);
      !S || S.contains(y.relatedTarget) || (g(), a(null));
    }, w = (y) => {
      var E, $;
      const S = m(y);
      if (!S || y.button !== 0 || y.metaKey || y.ctrlKey || y.shiftKey || `${((E = window.getSelection) == null ? void 0 : E.call(window)) || ""}`.trim()) return;
      const v = u.current.index.get(S.getAttribute(tr) || "");
      if (!v) return;
      y.preventDefault(), y.stopPropagation(), g(), a(null);
      const P = (($ = S.closest("[data-reader-pane]")) == null ? void 0 : $.getAttribute("data-reader-pane")) || u.current.primaryPane, M = f();
      M && i((_) => Qh(_, M)), u.current.follow(v, P);
    }, I = () => {
      g(), a(null);
    };
    return e.addEventListener("pointerover", h), e.addEventListener("pointerout", b), e.addEventListener("click", w, !0), e.addEventListener("scroll", I, { passive: !0 }), () => {
      g(), e.removeEventListener("pointerover", h), e.removeEventListener("pointerout", b), e.removeEventListener("click", w, !0), e.removeEventListener("scroll", I);
    };
  }, [e, f]);
  const d = L((m) => {
    const g = f();
    if (!g) return !1;
    const h = ep(c.current, g, m);
    if (!h) return !1;
    const { shellEl: b, primaryPane: w } = u.current;
    return _t(b, h.to, "auto", w) ? (i(h.history), !0) : !1;
  }, [f]);
  return O(() => {
    const m = (g) => {
      if (!g.altKey || g.metaKey || g.ctrlKey || g.shiftKey || g.defaultPrevented || g.key !== "ArrowLeft" && g.key !== "ArrowRight" || tp(g.target)) return;
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
const rp = [
  { keys: "Alt+←", desc: "点了引用跳过去以后，回到原处" },
  { keys: "Alt+→", desc: "再跳回去" }
];
function op() {
  const e = Ct(), t = U(() => zh(e.regions), [e.regions]), { jumpToBlock: n } = e, r = L((s, i) => n(s.itemId, i), [n]), o = np({ shellEl: e.shellEl, index: t, primaryPane: e.primaryPane, follow: r }), a = U(() => ({
    // 书里一个认得出去处的引用都没有，就不改文字层（react-pdf 照原样画，不多一遍 innerHTML）。
    textMarks: t.size ? (s) => Hh(s, t) : void 0,
    shortcuts: rp
  }), [t]);
  return an(a), /* @__PURE__ */ C(Ae, { children: [
    o.preview ? /* @__PURE__ */ p(Yh, { preview: o.preview, regions: e.regions, metadata: e.metadata, documents: e.pdfDocuments }) : null,
    o.canGoBack ? /* @__PURE__ */ C(X, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => o.goBack(), children: [
      /* @__PURE__ */ p(zi, { size: 14, "aria-hidden": !0 }),
      " 回到第 ",
      o.backPage,
      " 页"
    ] }) : null
  ] });
}
const ap = { id: "xrefs", title: "引用（「图 2.1」「式 (3.21)」）", Component: op }, Er = [Ph, _h, Jm, ap, Fm, fh];
function Rr(e = Er) {
  return e.flatMap((t) => (t.panels ?? []).map(({ id: n, label: r, short: o, Icon: a, needsJob: s }) => ({ id: n, label: r, short: o, Icon: a, needsJob: s })));
}
function sp(e) {
  const t = Be(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(Ae, { children: (e.tabs ?? Rr()).map(({ id: s, label: i, Icon: c, needsJob: l }) => {
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
        children: /* @__PURE__ */ p(c, { className: "reader-close-home-icon", ...Pe, "aria-hidden": !0 })
      },
      s
    );
  }) });
}
function ip(e) {
  const t = Be(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = Rr().map(({ id: c, label: l, short: u, Icon: f, needsJob: d }) => ({
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
function cp(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function lp(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function up(e) {
  return e / 100 * window.innerHeight;
}
function dp(e) {
  return e / 100 * window.innerWidth;
}
function fp(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function Kt({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = fp(n);
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
      r = lp(t, o);
      break;
    }
    case "em": {
      r = cp(t, o);
      break;
    }
    case "vh": {
      r = up(o);
      break;
    }
    case "vw": {
      r = dp(o);
      break;
    }
  }
  return r;
}
function _e(e) {
  return parseFloat(e.toFixed(3));
}
function At({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function rr(e) {
  const { panels: t } = e, n = At({ group: e });
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
      const u = Kt({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = _e(u / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const u = Kt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = _e(u / n * 100);
    }
    let c = 0;
    if (a.minSize !== void 0) {
      const u = Kt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      c = _e(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = Kt({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      l = _e(u / n * 100);
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
function or(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? mp : hp
  );
}
function mp(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function hp(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function Es(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Rs(e, t) {
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
function pp({
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
    const { x: i, y: c } = Rs(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return he(o, "No rect found"), o;
}
let mn;
function gp() {
  return mn === void 0 && (typeof matchMedia == "function" ? mn = !!matchMedia("(pointer:coarse)").matches : mn = !1), mn;
}
function Ps(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = or(
    n,
    Array.from(t.children).filter(Es).map((g) => ({ element: g }))
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
        const b = r.find(
          (w) => w.element === h
        );
        if (b) {
          if (d) {
            const w = d.element.getBoundingClientRect(), I = h.getBoundingClientRect();
            let y;
            if (c) {
              const S = n === "horizontal" ? new DOMRect(
                w.right,
                w.top,
                0,
                w.height
              ) : new DOMRect(
                w.left,
                w.bottom,
                w.width,
                0
              ), v = n === "horizontal" ? new DOMRect(I.left, I.top, 0, I.height) : new DOMRect(I.left, I.top, I.width, 0);
              switch (m.length) {
                case 0: {
                  y = [
                    S,
                    v
                  ];
                  break;
                }
                case 1: {
                  const P = m[0], M = pp({
                    orientation: n,
                    rects: [w, I],
                    targetRect: P.element.getBoundingClientRect()
                  });
                  y = [
                    P,
                    M === w ? v : S
                  ];
                  break;
                }
                default: {
                  y = m;
                  break;
                }
              }
            } else
              m.length ? y = m : y = [
                n === "horizontal" ? new DOMRect(
                  w.right,
                  I.top,
                  I.left - w.right,
                  I.height
                ) : new DOMRect(
                  I.left,
                  w.bottom,
                  I.width,
                  I.top - w.bottom
                )
              ];
            for (const S of y) {
              let v = "width" in S ? S : S.element.getBoundingClientRect();
              const P = gp() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
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
                groupSize: At({ group: e }),
                panels: [d, b],
                separator: "width" in S ? void 0 : S,
                rect: v
              }), i = !1;
            }
          }
          c = !1, d = b, m = [];
        }
      } else if (h.hasAttribute("data-separator")) {
        h.ariaDisabled !== null && (i = !0);
        const b = o.find(
          (w) => w.element === h
        );
        b ? m.push(b) : (d = void 0, m = []);
      } else
        c = !0;
  }
  return s;
}
var at;
class Ms {
  constructor() {
    qr(this, at, {});
  }
  addListener(t, n) {
    const r = Dt(this, at)[t];
    return r === void 0 ? Dt(this, at)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = Dt(this, at)[t];
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
    Jr(this, at, {});
  }
  removeListener(t, n) {
    const r = Dt(this, at)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
at = new WeakMap();
let Mt = {
  cursorFlags: 0,
  state: "inactive"
};
const Pr = new Ms();
function pt() {
  return Mt;
}
function yp(e) {
  return Pr.addListener("change", e);
}
function bp(e) {
  const t = Mt, n = { ...Mt };
  n.cursorFlags = e, Mt = n, Pr.emit("change", {
    prev: t,
    next: n
  });
}
function xt(e) {
  const t = Mt;
  Mt = e, Pr.emit("change", {
    prev: t,
    next: e
  });
}
const vp = (e) => e, Hn = () => {
}, xs = 1, Ns = 2, _s = 4, As = 8, Ko = 3, Vo = 12;
let hn;
function qo() {
  return hn === void 0 && (hn = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (hn = !0)), hn;
}
function wp({
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
        if (e && qo()) {
          const a = (e & xs) !== 0, s = (e & Ns) !== 0, i = (e & _s) !== 0, c = (e & As) !== 0;
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
    return qo() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const Jo = /* @__PURE__ */ new WeakMap();
function Mr(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = Jo.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = pt();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = wp({
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
  Jo.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Ue = /* @__PURE__ */ new Map();
const Ls = new Ms();
function Sp(e) {
  Ue = new Map(Ue), Ue.delete(e);
}
function Go(e, t) {
  for (const [n] of Ue)
    if (n.id === e)
      return n;
}
function it(e, t) {
  for (const [n, r] of Ue)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function vt() {
  return Ue;
}
function xr(e, t) {
  return Ls.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Ye(e, t, n) {
  const r = Ue.get(e);
  Ue = new Map(Ue), Ue.set(e, t), Ls.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function Cs(e) {
  const t = pt();
  let n = !1;
  switch (t.state) {
    case "active":
      xt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (Mr(e), n = !0, t.hitRegions.forEach((r) => {
        const o = it(r.group.id, !0);
        Ye(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function Xo(e) {
  e.defaultPrevented || Cs(e.currentTarget);
}
function Ip(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Rs(n, a.rect);
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
function Tp(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function kp(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: Qo(e),
    b: Qo(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  he(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: Zo(Yo(n.a)),
    b: Zo(Yo(n.b))
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
const Ep = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function Rp(e) {
  const t = getComputedStyle(Ds(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function Pp(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || Rp(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || Ep.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function Yo(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (he(n, "Missing node"), Pp(n)) return n;
  }
  return null;
}
function Zo(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Qo(e) {
  const t = [];
  for (; e; )
    t.push(e), e = Ds(e);
  return t;
}
function Ds(e) {
  const { parentNode: t } = e;
  return Tp(t) ? t.host : t;
}
function Mp(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function xp({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!Es(n) || n.contains(e) || e.contains(n))
    return !0;
  if (kp(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Mp(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function Nr(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = Ps(o), s = Ip(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && xp({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function Np(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function xe(e, t, n = 0) {
  return Math.abs(_e(e) - _e(t)) <= n;
}
function je(e, t) {
  return xe(e, t) ? 0 : e > t ? 1 : -1;
}
function Rt({
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
  if (je(r, c) < 0)
    if (a) {
      const l = (o + c) / 2;
      je(r, l) < 0 ? r = o : r = c;
    } else
      r = c;
  return r = Math.min(i, r), r = _e(r), r;
}
function Zt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (xe(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), c = Object.values(o), l = [...i], [u, f] = r;
  he(u != null, "Invalid first pivot index"), he(f != null, "Invalid second pivot index");
  let d = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? f : u, b = n[h];
        he(
          b,
          `Panel constraints not found for index ${h}`
        );
        const {
          collapsedSize: w = 0,
          collapsible: I,
          minSize: y = 0
        } = b;
        if (I) {
          const S = i[h];
          if (he(
            S != null,
            `Previous layout not found for panel index ${h}`
          ), xe(S, w)) {
            const v = y - S;
            je(v, Math.abs(e)) > 0 && (e = e < 0 ? 0 - v : v);
          }
        }
      }
      {
        const h = e < 0 ? u : f, b = n[h];
        he(
          b,
          `No panel constraints found for index ${h}`
        );
        const {
          collapsedSize: w = 0,
          collapsible: I,
          minSize: y = 0
        } = b;
        if (I) {
          const S = i[h];
          if (he(
            S != null,
            `Previous layout not found for panel index ${h}`
          ), xe(S, y)) {
            const v = S - w;
            je(v, Math.abs(e)) > 0 && (e = e < 0 ? 0 - v : v);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? f : u, b = n[h];
      he(
        b,
        `Panel constraints not found for index ${h}`
      );
      const w = i[h], { collapsible: I, collapsedSize: y, minSize: S } = b;
      if (I && je(w, S) < 0)
        if (e > 0) {
          const v = S - y, P = v / 2, M = w + e;
          je(M, S) < 0 && (e = je(e, P) <= 0 ? 0 : v);
        } else {
          const v = S - y, P = 100 - v / 2, M = w - e;
          je(M, S) < 0 && (e = je(100 + e, P) > 0 ? 0 : -v);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let b = e < 0 ? f : u, w = 0;
    for (; ; ) {
      const y = i[b];
      he(
        y != null,
        `Previous layout not found for panel index ${b}`
      );
      const S = Rt({
        overrideDisabledPanels: s,
        panelConstraints: n[b],
        prevSize: y,
        size: 100
      }) - y;
      if (w += S, b += h, b < 0 || b >= n.length)
        break;
    }
    const I = Math.min(Math.abs(e), Math.abs(w));
    e = e < 0 ? 0 - I : I;
  }
  {
    let h = e < 0 ? u : f;
    for (; h >= 0 && h < n.length; ) {
      const b = Math.abs(e) - Math.abs(d), w = i[h];
      he(
        w != null,
        `Previous layout not found for panel index ${h}`
      );
      const I = w - b, y = Rt({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: w,
        size: I
      });
      if (!xe(w, y) && (d += w - y, l[h] = y, d.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (Np(c, l))
    return o;
  {
    const h = e < 0 ? f : u, b = i[h];
    he(
      b != null,
      `Previous layout not found for panel index ${h}`
    );
    const w = b + d, I = Rt({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: b,
      size: w
    });
    if (l[h] = I, !xe(I, w)) {
      let y = w - I, S = e < 0 ? f : u;
      for (; S >= 0 && S < n.length; ) {
        const v = l[S];
        he(
          v != null,
          `Previous layout not found for panel index ${S}`
        );
        const P = v + y, M = Rt({
          overrideDisabledPanels: s,
          panelConstraints: n[S],
          prevSize: v,
          size: P
        });
        if (xe(v, M) || (y -= M - v, l[S] = M), xe(y, 0))
          break;
        e > 0 ? S-- : S++;
      }
    }
  }
  const m = Object.values(l).reduce(
    (h, b) => b + h,
    0
  );
  if (!xe(m, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return l.reduce((h, b, w) => (h[g[w]] = b, h), {});
}
function gt(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || je(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function yt({
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
  if (!xe(o, 100) && r.length > 0)
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
    const u = Rt({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: c,
      size: l
    });
    l != u && (a += l - u, r[i] = u);
  }
  if (!xe(a, 0))
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      he(c != null, `No layout data found for index ${i}`);
      const l = c + a, u = Rt({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: c,
        size: l
      });
      if (c !== u && (a -= u - c, r[i] = u, xe(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, c, l) => (i[s[l]] = c, i), {});
}
function $s({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const c = vt();
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
    const d = a(), m = l.findIndex((b) => b.id === t), g = m === 0, h = m === l.length - 1;
    if (h && c < d && (g || l.slice(0, m).every((b, w) => {
      const I = f[w];
      return (I == null ? void 0 : I.collapsible) && xe(I.collapsedSize, u[I.panelId]);
    }))) {
      const b = l.slice(0, m).reduce((w, I) => w + u[I.id], 0);
      return {
        ...u,
        [t]: _e(100 - b)
      };
    }
    return Zt({
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
    } = n(), b = s({
      nextSize: c,
      panels: d.panels,
      prevLayout: g,
      derivedPanelConstraints: f
    }), w = yt({
      layout: b,
      panelConstraints: f
    });
    gt(g, w) || Ye(d, {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: f,
      groupSize: m,
      layout: w,
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
      return c && xe(l, u);
    },
    resize: (c) => {
      const { group: l } = n(), { element: u } = o(), f = At({ group: l }), d = Kt({
        groupSize: f,
        panelElement: u,
        styleProp: c
      }), m = _e(d / f * 100);
      i(m);
    }
  };
}
function ea(e) {
  if (e.defaultPrevented)
    return;
  const t = vt();
  Nr(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = $s({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function pn(e) {
  const t = vt();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function Os({
  groupId: e
}) {
  const t = () => {
    const n = vt();
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
      } = t(), l = yt({
        layout: n,
        panelConstraints: o
      });
      return r ? i : (gt(i, l) || Ye(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: l,
        separatorToPanels: c
      }), l);
    }
  };
}
function ut(e, t) {
  const n = pn(e), r = it(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  he(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  he(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), i = Os({ groupId: n.id }).getLayout(), c = Zt({
    delta: t,
    initialLayout: i,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: i,
    trigger: "keyboard"
  }), l = yt({
    layout: c,
    panelConstraints: r.derivedPanelConstraints
  });
  gt(i, l) || Ye(
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
function ta(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = pn(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && ut(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && ut(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && ut(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && ut(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), ut(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = pn(t), o = it(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, c = r.separators.find(
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
          ut(t, m - d);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = pn(t).separators.map(
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
        e.preventDefault(), ut(t, -100);
        break;
      }
    }
}
function na(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = vt(), n = Nr(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), xt({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function zs({
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
    const b = r.get(u), w = o.get(u);
    if (!b || !w)
      return;
    const {
      defaultLayoutDeferred: I,
      derivedPanelConstraints: y,
      groupSize: S,
      layout: v,
      separatorToPanels: P
    } = w;
    if (y && v && P) {
      const M = Zt({
        delta: h,
        initialLayout: b,
        panelConstraints: y,
        pivotIndices: l.panels.map((E) => m.indexOf(E)),
        prevLayout: v,
        trigger: "mouse-or-touch"
      });
      if (gt(M, v)) {
        if (h !== 0 && !g)
          switch (d) {
            case "horizontal": {
              i |= h < 0 ? xs : Ns;
              break;
            }
            case "vertical": {
              i |= h < 0 ? _s : As;
              break;
            }
          }
      } else
        Ye(l.group, {
          defaultLayoutDeferred: I,
          derivedPanelConstraints: y,
          groupSize: S,
          layout: M,
          separatorToPanels: P
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & Ko : c |= i & Ko, t.movementY === 0 ? c |= s & Vo : c |= i & Vo, bp(c), Mr(e);
}
function ra(e) {
  const t = vt(), n = pt();
  switch (n.state) {
    case "active":
      zs({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function oa(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = pt(), n = vt();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        xt({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = it(a.group.id, !0);
          Ye(a.group, s, {
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
      zs({
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
      const a = Nr(e, n);
      a.length === 0 ? t.state !== "inactive" && xt({
        cursorFlags: 0,
        state: "inactive"
      }) : xt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), Mr(e.currentTarget);
      break;
    }
  }
}
function aa(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (pt().state) {
      case "hover":
        xt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function sa(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || Cs(e.currentTarget) && e.preventDefault();
}
function ia(e) {
  let t = 0, n = 0;
  const r = {};
  for (const a of e)
    if (a.defaultSize !== void 0) {
      t++;
      const s = _e(a.defaultSize);
      n += s, r[a.panelId] = s;
    } else
      r[a.panelId] = void 0;
  const o = e.length - t;
  if (o !== 0) {
    const a = _e((100 - n) / o);
    for (const s of e)
      s.defaultSize === void 0 && (r[s.panelId] = a);
  }
  return r;
}
function _p(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((c) => c.element === t);
  if (!r || !r.onResize)
    return;
  const o = At({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: _e(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function Ap(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function Lp({
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
        const m = d / 100 * n, g = _e(
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
      u[f] = _e(
        d / a * l
      );
    }
  else {
    const f = _e(
      l / c.length
    );
    for (const d of c)
      u[d] = f;
  }
  return u;
}
function Cp(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const Tt = /* @__PURE__ */ new Map();
function Dp(e) {
  let t = !0;
  he(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const h of g) {
      const { borderBoxSize: b, target: w } = h;
      if (w === e.element) {
        if (t) {
          const I = At({ group: e });
          if (I === 0)
            return;
          const y = it(e.id);
          if (!y)
            return;
          const S = rr(e), v = y.defaultLayoutDeferred ? ia(S) : y.layout, P = Lp({
            group: e,
            nextGroupSize: I,
            prevGroupSize: y.groupSize,
            prevLayout: v
          }), M = yt({
            layout: P,
            panelConstraints: S
          });
          if (!y.defaultLayoutDeferred && gt(y.layout, M) && Ap(
            y.derivedPanelConstraints,
            S
          ) && y.groupSize === I)
            return;
          Ye(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: S,
            groupSize: I,
            layout: M,
            separatorToPanels: y.separatorToPanels
          });
        }
      } else
        _p(e, w, b);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    he(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = At({ group: e }), i = rr(e), c = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (Cp(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[c] ?? l ?? ia(i), f = yt({
    layout: u,
    panelConstraints: i
  }), d = e.element.ownerDocument;
  Tt.set(
    d,
    (Tt.get(d) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return Ps(e).forEach((g) => {
    g.separator && m.set(g.separator, g.panels);
  }), Ye(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: m
  }), e.separators.forEach((g) => {
    he(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", ta);
  }), Tt.get(d) === 1 && (d.addEventListener("contextmenu", Xo, !0), d.addEventListener("dblclick", ea, !0), d.addEventListener("pointerdown", na, !0), d.addEventListener("pointerleave", ra), d.addEventListener("pointermove", oa), d.addEventListener("pointerout", aa), d.addEventListener("pointerup", sa, !0)), function() {
    t = !1, Tt.set(
      d,
      Math.max(0, (Tt.get(d) ?? 0) - 1)
    ), Sp(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", ta);
    }), Tt.get(d) || (d.removeEventListener(
      "contextmenu",
      Xo,
      !0
    ), d.removeEventListener(
      "dblclick",
      ea,
      !0
    ), d.removeEventListener(
      "pointerdown",
      na,
      !0
    ), d.removeEventListener("pointerleave", ra), d.removeEventListener("pointermove", oa), d.removeEventListener("pointerout", aa), d.removeEventListener("pointerup", sa, !0)), a.disconnect();
  };
}
function $p() {
  const [e, t] = N({}), n = L(() => t({}), []);
  return [e, n];
}
function _r(e) {
  const t = wa();
  return `${e ?? t}`;
}
const wt = typeof window < "u" ? Le : O;
function qt(e) {
  const t = A(e);
  return wt(() => {
    t.current = e;
  }, [e]), L(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function Ar(...e) {
  return qt((t) => {
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
function Lr(e) {
  const t = A({ ...e });
  return wt(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const Fs = nn(null);
function Op(e, t) {
  const n = A({
    getLayout: () => ({}),
    setLayout: vp
  });
  fr(t, () => n.current, []), wt(() => {
    Object.assign(
      n.current,
      Os({ groupId: e })
    );
  });
}
function Bs({
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
  }), h = qt((k) => {
    gt(g.current.onLayoutChange, k) || (g.current.onLayoutChange = k, c == null || c(k));
  }), b = qt(
    (k, T) => {
      gt(g.current.onLayoutChanged, k) || (g.current.onLayoutChanged = k, l == null || l(k, { isUserInteraction: T }));
    }
  ), w = _r(i), I = A(null), [y, S] = $p(), v = A({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), P = Ar(I, a);
  Op(w, s);
  const M = qt(
    (k, T) => {
      const R = pt(), D = Go(k), z = it(k);
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
  ), E = Lr({
    defaultLayout: n,
    disableCursor: r
  }), $ = U(
    () => ({
      get disableCursor() {
        return !!E.disableCursor;
      },
      getPanelStyles: M,
      id: w,
      orientation: u,
      registerPanel: (k) => {
        const T = v.current;
        return T.panels = or(u, [
          ...T.panels,
          k
        ]), S(), () => {
          T.panels = T.panels.filter(
            (R) => R !== k
          ), S();
        };
      },
      registerSeparator: (k) => {
        const T = v.current;
        return T.separators = or(u, [
          ...T.separators,
          k
        ]), S(), () => {
          T.separators = T.separators.filter(
            (R) => R !== k
          ), S();
        };
      },
      updatePanelProps: (k, { disabled: T }) => {
        const R = v.current.panels.find(
          (K) => K.id === k
        );
        R && (R.panelConstraints.disabled = T);
        const D = Go(w), z = it(w);
        D && z && Ye(D, {
          ...z,
          derivedPanelConstraints: rr(D)
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
    [M, w, S, u, E]
  ), _ = A(null);
  return wt(() => {
    const k = I.current;
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
      id: w,
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
    _.current = D;
    const z = Dp(D), { defaultLayoutDeferred: K, derivedPanelConstraints: j, layout: J } = it(D.id, !0);
    !K && j.length > 0 && (h(J), b(J, !1));
    const oe = xr(w, (q) => {
      const { defaultLayoutDeferred: se, derivedPanelConstraints: Ee, layout: re } = q.next;
      if (se || Ee.length === 0)
        return;
      const ue = D.panels.map(({ id: ie }) => ie).join(",");
      D.mutableState.layouts[ue] = re, Ee.forEach((ie) => {
        if (ie.collapsible) {
          const { layout: le } = q.prev ?? {};
          if (le) {
            const B = xe(
              ie.collapsedSize,
              re[ie.panelId]
            ), W = xe(
              ie.collapsedSize,
              le[ie.panelId]
            );
            B && !W && (D.mutableState.expandedPanelSizes[ie.panelId] = le[ie.panelId]);
          }
        }
      });
      const Me = pt().state !== "active";
      h(re), Me && b(re, q.isUserInteraction);
    });
    return () => {
      _.current = null, z(), oe();
    };
  }, [
    o,
    w,
    b,
    h,
    u,
    y,
    E
  ]), O(() => {
    const k = _.current;
    k && (k.mutableState.defaultLayout = n, k.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(Fs.Provider, { value: $, children: /* @__PURE__ */ p(
    "div",
    {
      ...m,
      className: t,
      "data-group": !0,
      "data-testid": w,
      id: w,
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
Bs.displayName = "Group";
function Cr() {
  const e = ft(Fs);
  return he(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function zp(e, t) {
  const { id: n } = Cr(), r = A({
    collapse: Hn,
    expand: Hn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Hn
  });
  fr(t, () => r.current, []), wt(() => {
    Object.assign(
      r.current,
      $s({ groupId: n, panelId: e })
    );
  });
}
function ar({
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
  const h = !!c, b = _r(c), w = Lr({
    disabled: a
  }), I = A(null), y = Ar(I, s), {
    getPanelStyles: S,
    id: v,
    orientation: P,
    registerPanel: M,
    updatePanelProps: E
  } = Cr(), $ = f !== null, _ = qt(
    (D, z, K) => {
      f == null || f(D, c, K);
    }
  );
  wt(() => {
    const D = I.current;
    if (D !== null) {
      const z = {
        element: D,
        id: b,
        idIsStable: h,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: $ ? _ : void 0,
        panelConstraints: {
          groupResizeBehavior: i,
          collapsedSize: n,
          collapsible: r,
          defaultSize: o,
          disabled: w.disabled,
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
    b,
    h,
    l,
    u,
    _,
    M,
    w
  ]), O(() => {
    E(b, { disabled: a });
  }, [a, b, E]), zp(b, d);
  const k = () => {
    const D = S(v, b);
    if (D)
      return JSON.stringify(D);
  }, T = Mn(
    (D) => xr(v, D),
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
      "data-testid": b,
      id: b,
      ref: y,
      style: {
        ...Fp,
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
ar.displayName = "Panel";
const Fp = {
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
function Bp({
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
    a = yt({
      layout: Zt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = yt({
      layout: Zt({
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
function Hs({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const c = _r(a), l = Lr({
    disabled: n,
    disableDoubleClick: r
  }), [u, f] = N({}), [d, m] = N("inactive"), [g, h] = N(!1), b = A(null), w = Ar(b, o), {
    disableCursor: I,
    id: y,
    orientation: S,
    registerSeparator: v,
    updateSeparatorProps: P
  } = Cr(), M = S === "horizontal" ? "vertical" : "horizontal";
  wt(() => {
    const _ = b.current;
    if (_ !== null) {
      const k = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: _,
        id: c
      }, T = v(k), R = yp(
        (z) => {
          m(
            z.next.state !== "inactive" && z.next.hitRegions.some(
              (K) => K.separator === k
            ) ? z.next.state : "inactive"
          );
        }
      ), D = xr(
        y,
        (z) => {
          const { derivedPanelConstraints: K, layout: j, separatorToPanels: J } = z.next, oe = J.get(k);
          if (oe) {
            const q = oe[0], se = oe.indexOf(q);
            f(
              Bp({
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
  }, [y, c, v, l]), O(() => {
    P(c, { disabled: n, disableDoubleClick: r });
  }, [n, r, c, P]);
  let E;
  n && !I && (E = "not-allowed");
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
      ref: w,
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
Hs.displayName = "Separator";
const Dr = 30, $r = 65, Qt = 50, Hp = 100 - $r, jp = 100 - Dr;
function Up(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min($r, Math.max(Dr, t)) : Qt;
}
function Or(e) {
  return 100 - e;
}
function kt(e) {
  return `${e}%`;
}
const zr = "reader-document", en = "reader-assistant", js = "retainpdf.reader.ai-split-layout.v1", Wp = {
  [zr]: Or(Qt),
  [en]: Qt
};
function Fr(e) {
  const t = Up(e == null ? void 0 : e[en]);
  return {
    [zr]: Or(t),
    [en]: t
  };
}
function Kp() {
  try {
    const e = JSON.parse(localStorage.getItem(js) || "null");
    return Fr(e);
  } catch {
    return Wp;
  }
}
function Vp(e) {
  try {
    localStorage.setItem(js, JSON.stringify(Fr(e)));
  } catch {
  }
}
function jn(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Fr(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[en]}vw`
  );
}
function qp() {
  const e = A(null), [t] = N(Kp);
  Le(() => {
    const o = e.current;
    return jn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = L((o) => {
    jn(e.current, o);
  }, []), r = L((o, a) => {
    jn(e.current, o), a.isUserInteraction && Vp(o);
  }, []);
  return /* @__PURE__ */ C(
    Bs,
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
          ar,
          {
            id: zr,
            defaultSize: kt(Or(Qt)),
            minSize: kt(Hp),
            maxSize: kt(jp)
          }
        ),
        /* @__PURE__ */ p(
          Hs,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ p("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ p(
          ar,
          {
            id: en,
            defaultSize: kt(Qt),
            minSize: kt(Dr),
            maxSize: kt($r)
          }
        )
      ]
    }
  );
}
function Jp({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = N(!1);
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
function Gp({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(Jp, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ C(Ae, { children: [
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
function Xp(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Yp() {
  const [e, t] = N(!1), n = wa(), r = A(null), o = ps(), a = U(() => [...pu, ...qf(o)], [o]);
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
      if (i.defaultPrevented || i.metaKey || i.ctrlKey || i.altKey || Xp(i.target)) return;
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
        children: /* @__PURE__ */ p(Fi, { ...Pe, "aria-hidden": !0 })
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
const Zp = ["source", "sideBySide", "translated"], Qp = { source: "", translated: "", sideBySide: "" };
function eg(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = yn(e.sourceUrl), n = yn(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return ic({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function tg(e) {
  const [t, n] = N(() => /* @__PURE__ */ new Set()), r = U(
    () => e ? eg(e) : Qp,
    [e]
  ), o = U(
    () => Zp.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = L(async (s) => {
    if (!e) return;
    const i = yn(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? sc(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await cc(
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
        lc(l), n((u) => {
          const f = new Set(u);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const ng = {
  source: Ea,
  sideBySide: Ra,
  translated: Pa
}, rg = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function og(e) {
  const t = Be(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = tg(n), i = A(null);
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
      /* @__PURE__ */ p(Bi, { ...Pe, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = ci[c], u = yn(r[c]), f = a.has(c), d = !!u && !f, m = d ? "" : li(c, r), g = ng[c];
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
            /* @__PURE__ */ p(g, { ...Pe, "aria-hidden": !0 }),
            /* @__PURE__ */ C("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ C("span", { className: "reader-download-action-label", children: [
                rg[c],
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
const ag = "retainpdf:reader:bookmarks:v1:", sg = 200;
function Br() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Us(e) {
  const t = `${e || ""}`.trim();
  return t ? `${ag}${t}` : "";
}
function ig(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Jt(e, t = Br()) {
  const n = Us(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = ig(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
const sr = /* @__PURE__ */ new Set();
function cg(e, t) {
  const n = (r) => {
    r === e && t();
  };
  return sr.add(n), () => {
    sr.delete(n);
  };
}
function ir(e, t, n) {
  const r = Us(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, sg);
  if (r && n)
    try {
      n.setItem(r, JSON.stringify(o));
    } catch {
    }
  for (const a of [...sr]) a(e);
  return o;
}
function lg(e, t, n = "", { storage: r = Br(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Jt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? ir(e, a.filter((i) => i.page !== s), r) : ir(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function ug(e, t, n = Br()) {
  return ir(e, Jt(e, n).filter((r) => r.page !== t), n);
}
function dg(e, t) {
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
function Ws(e, t) {
  const [n, r] = N(() => Jt(e));
  O(() => (r(Jt(e)), cg(e, () => r(Jt(e)))), [e]);
  const o = L((s) => {
    r(lg(e, s, dg(t, s)));
  }, [e, t]), a = L((s) => r(ug(e, s)), [e]);
  return { bookmarks: n, toggle: o, remove: a };
}
const fg = "retainpdf:reader:favorites:v1:", mg = 500, Hr = 2e3;
function jr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Ks(e) {
  const t = `${e || ""}`.trim();
  return t ? `${fg}${t}` : "";
}
function hg(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page)), r = `${t.text || ""}`.trim().slice(0, Hr), o = `${t.id || ""}`.trim();
  return !o || !r || !Number.isFinite(n) || n < 1 ? null : { id: o, text: r, page: n, pane: t.pane === "translated" ? "translated" : "source", createdAt: `${t.createdAt || ""}` };
}
function Nt(e, t = jr()) {
  const n = Ks(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Set(), a = [];
    for (const s of Array.isArray(r) ? r : []) {
      const i = hg(s);
      i && !o.has(i.id) && (o.add(i.id), a.push(i));
    }
    return a;
  } catch {
    return [];
  }
}
const cr = /* @__PURE__ */ new Set();
function pg(e, t) {
  const n = (r) => {
    r === e && t();
  };
  return cr.add(n), () => {
    cr.delete(n);
  };
}
function Vs(e, t, n) {
  const r = Ks(e), o = t.slice(0, mg);
  if (r && n)
    try {
      n.setItem(r, JSON.stringify(o));
    } catch {
    }
  for (const a of [...cr]) a(e);
  return o;
}
function Ur(e, t, n) {
  const r = `${t || ""}`.trim().slice(0, Hr);
  return e.find((o) => o.page === n && o.text === r) ?? null;
}
function qs(e, t, { storage: n = jr(), now: r = () => (/* @__PURE__ */ new Date()).toISOString(), makeId: o = yg } = {}) {
  const a = Nt(e, n), s = `${t.text || ""}`.trim().slice(0, Hr), i = Math.floor(Number(t.page));
  return !s || !Number.isFinite(i) || i < 1 || Ur(a, s, i) ? a : Vs(e, [{ id: o(), text: s, page: i, pane: t.pane === "translated" ? "translated" : "source", createdAt: r() }, ...a], n);
}
function gg(e, t, n = jr()) {
  return Vs(e, Nt(e, n).filter((r) => r.id !== t), n);
}
function yg() {
  var e;
  try {
    if ((e = globalThis.crypto) != null && e.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
function Js(e) {
  const [t, n] = N(() => Nt(e));
  O(() => (n(Nt(e)), pg(e, () => n(Nt(e)))), [e]);
  const r = L(
    (a) => n(qs(e, a)),
    [e]
  ), o = L((a) => n(gg(e, a)), [e]);
  return { favorites: t, add: r, remove: o };
}
function bg({ filled: e }) {
  return /* @__PURE__ */ p(Hi, { ...Pe, fill: e ? "currentColor" : "none", "aria-hidden": !0 });
}
function vg({ scope: e, currentPage: t, numPages: n, regions: r }) {
  const { bookmarks: o, toggle: a } = Ws(e, r);
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
        children: /* @__PURE__ */ p(bg, { filled: i })
      }
    ),
    /* @__PURE__ */ p(wg, { scope: e })
  ] });
}
function wg({ scope: e }) {
  var c;
  const [t, n] = N(!1), r = A(null), { favorites: o, remove: a } = Js(e), s = (c = Be()) == null ? void 0 : c.goToPage;
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
        children: /* @__PURE__ */ p(Aa, { ...Pe, fill: i ? "currentColor" : "none", "aria-hidden": !0 })
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
function Sg(e) {
  const t = Be(), n = Ir(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? on, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = Gc(a), f = a > Ha + 1e-3, d = a < kn - 1e-3, m = Et(r, Pt()), g = m >= kn ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", [h, b] = N(!1), [w, I] = N(`${i}`);
  O(() => {
    h || I(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, h]);
  const y = () => {
    if (b(!1), !l || c <= 0)
      return;
    const S = Number(`${w}`.trim());
    l(En(S, c));
  };
  return /* @__PURE__ */ C("footer", { className: "reader-bottombar", "data-reader-hud": "true", children: [
    /* @__PURE__ */ C("div", { className: "reader-bottombar-start", children: [
      e.startSlot,
      e.bookmarkScope ? /* @__PURE__ */ p(
        vg,
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
          onSubmit: (S) => {
            S.preventDefault(), y();
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
                value: w,
                autoFocus: !0,
                onChange: (S) => I(S.target.value.replace(/[^\d]/g, "")),
                onBlur: y,
                onKeyDown: (S) => {
                  S.key === "Escape" && (S.preventDefault(), b(!1), I(`${i}`));
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
            !l || c <= 0 || (I(`${i}`), b(!0));
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
          children: /* @__PURE__ */ p(ji, { ...Pe, "aria-hidden": !0 })
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
            onClick: () => s(Yt(a, -1)),
            children: /* @__PURE__ */ p(Na, { ...Pe, "aria-hidden": !0 })
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
            onClick: () => s(Yt(a, 1)),
            children: /* @__PURE__ */ p(_a, { ...Pe, "aria-hidden": !0 })
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ C("div", { className: "reader-bottombar-end", children: [
      e.toolsSlot,
      /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(Yp, {}) })
    ] })
  ] });
}
function ca(e) {
  var t, n;
  return Va(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function Ig(e) {
  const [t, n] = N(() => ({
    scope: e,
    panel: ca(We(e))
  }));
  O(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: ca(We(e))
    });
  }, [e]), O(() => {
    t.scope === e && xn(t.scope, {
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
const lr = "download-toast";
function Tg({
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
function kg(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    Wn.dismiss(lr);
    return;
  }
  Wn.custom(
    () => /* @__PURE__ */ p(Tg, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: lr, duration: 1 / 0 }
  );
}
function Eg() {
  const e = L((t) => {
    t && (t.setState = kg, t.hide = () => Wn.dismiss(lr));
  }, []);
  return /* @__PURE__ */ C(Ae, { children: [
    /* @__PURE__ */ p(wi, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
const la = { itemId: null, origin: null };
function Rg() {
  let e = la;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? la : { itemId: n, origin: r };
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
const ua = ["ask"];
function Pg(e) {
  const t = (n) => {
    const r = ua.indexOf(n.id);
    return r < 0 ? ua.length : r;
  };
  return [...e].sort((n, r) => t(n) - t(r));
}
function ur({
  place: e,
  active: t = null,
  extensions: n = Er
}) {
  const r = e === "side" ? Pg(n) : n, [o, a] = N(null), s = ps(), i = (d) => {
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
    const m = i(d.id), g = e === "side" ? Rr([d]) : [];
    return !m.length && !g.length ? null : /* @__PURE__ */ C(Pn, { children: [
      m.map((h) => {
        const b = `${d.id}:${h.key}`, w = h.Icon;
        return /* @__PURE__ */ C("span", { className: "reader-bar-tool-group", "data-has-dropdown": h.dropdown ? "true" : void 0, children: [
          /* @__PURE__ */ p(
            X,
            {
              className: e === "compare" ? "reader-bar-tool reader-bar-tool-compare" : "reader-bar-tool",
              "aria-label": h.label,
              title: h.title || h.label,
              "aria-pressed": !!h.pressed || o === `${b}:popup`,
              "aria-expanded": h.popup ? o === `${b}:popup` : void 0,
              "data-bar-tool": h.key,
              onClick: () => {
                var I;
                if (h.popup) {
                  a((y) => y === `${b}:popup` ? null : `${b}:popup`);
                  return;
                }
                (I = h.onClick) == null || I.call(h), c();
              },
              children: e === "compare" ? /* @__PURE__ */ p(vn, { ...lo, "aria-hidden": !0 }) : h.mark ?? /* @__PURE__ */ p(w, { ...Pe, "aria-hidden": !0 })
            }
          ),
          h.dropdown ? /* @__PURE__ */ p(
            X,
            {
              className: "reader-bar-tool-caret",
              "aria-label": `${h.label}：选项`,
              title: `${h.label}的选项`,
              "aria-expanded": o === `${b}:dropdown`,
              "data-bar-tool-caret": h.key,
              onClick: () => a((I) => I === `${b}:dropdown` ? null : `${b}:dropdown`),
              children: /* @__PURE__ */ p(vn, { ...lo, "aria-hidden": !0 })
            }
          ) : null
        ] }, b);
      }),
      g.length ? /* @__PURE__ */ p(sp, { active: t, tabs: g }) : null
    ] }, d.id);
  }).filter(Boolean);
  return f.length ? /* @__PURE__ */ C("div", { className: `reader-bar-tools is-${e}`, ref: u, role: "group", "aria-label": e === "side" ? "面板" : e === "compare" ? "对比版本" : "书页工具", children: [
    f,
    l ? /* @__PURE__ */ p("div", { className: "reader-bar-tools-popup", children: l }) : null
  ] }) : null;
}
const da = { search: "搜索", bookmarks: "书签", issues: "待改" }, Mg = [];
function xg({
  open: e,
  onToggle: t,
  issueCount: n = 0,
  children: r
}) {
  const o = `在全文搜索，书签${n ? `、待改 ${n} 处` : ""}（⌘F）`;
  return /* @__PURE__ */ C("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ C(X, { className: "reader-finder-toggle", "aria-label": "左栏：搜索、书签、待改", "aria-pressed": !!e, title: o, onClick: t, children: [
      /* @__PURE__ */ p(La, { ...Pe, "aria-hidden": !0 }),
      n ? /* @__PURE__ */ p("span", { className: "reader-finder-toggle-count", "aria-label": `待改 ${n} 处`, children: n }) : null
    ] }),
    r
  ] });
}
function Ng({
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
  const d = ((M = Be()) == null ? void 0 : M.regions) ?? Mg, m = U(() => Wu(d, s), [d, s]), [g, h] = N(-1);
  O(() => h(-1), [s]);
  const b = A(null), w = A(null), I = A(n);
  I.current = n, O(() => {
    if (c) return;
    const E = (_) => {
      var T, R;
      const k = _.target;
      !k || (T = w.current) != null && T.contains(k) || (R = k.closest) != null && R.call(k, ".reader-finder-toggles, [data-finder-toggle]") || I.current();
    }, $ = (_) => {
      _.key === "Escape" && I.current();
    };
    return document.addEventListener("pointerdown", E, !0), document.addEventListener("keydown", $), () => {
      document.removeEventListener("pointerdown", E, !0), document.removeEventListener("keydown", $);
    };
  }, [c]);
  const y = A(null);
  O(() => {
    var E;
    e === "search" && ((E = b.current) == null || E.focus());
  }, [e, i]), O(() => {
    var E, $, _;
    e === "search" && g >= 0 && ((_ = ($ = (E = y.current) == null ? void 0 : E.querySelector('[aria-current="true"]')) == null ? void 0 : $.scrollIntoView) == null || _.call($, { block: "nearest" }));
  }, [e, g]);
  const S = (E) => {
    const $ = m[E];
    $ && (h(E), r($.itemId));
  }, v = ["search", ...l ? ["bookmarks"] : [], ...u ? ["issues"] : []], P = v.includes(e) ? e : "search";
  return /* @__PURE__ */ C("aside", { ref: w, className: "reader-finder", "data-finder-tab": P, "data-pinned": c ? "true" : void 0, "aria-label": `左栏：${da[P]}`, children: [
    /* @__PURE__ */ C("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ p("div", { className: "reader-finder-tabs", role: "tablist", children: v.map((E) => /* @__PURE__ */ C(X, { className: "reader-finder-tab", role: "tab", "aria-selected": P === E, onClick: () => t(E), children: [
        da[E],
        E === "issues" && f ? /* @__PURE__ */ p("span", { className: "reader-finder-tab-count", children: f }) : null
      ] }, E)) }),
      /* @__PURE__ */ p(X, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(bt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    P === "bookmarks" ? l : P === "issues" ? u : null,
    P !== "search" ? null : /* @__PURE__ */ C(Ae, { children: [
      /* @__PURE__ */ C("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          hr,
          {
            ref: b,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "搜原文或译文（⌘F）",
            "aria-label": "在书里搜索",
            value: o,
            onChange: (E) => a(E.target.value),
            onKeyDown: (E) => {
              E.key === "Enter" ? (E.preventDefault(), S(Ku(g, m.length, E.shiftKey))) : E.key === "Escape" && (E.preventDefault(), c ? E.currentTarget.blur() : n()), E.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: m.length === 0 ? "没有找到" : `${g >= 0 ? `第 ${g + 1} / ` : ""}${m.length >= 200 ? "200+ 处，只列前 200 处" : `${m.length} 处`}${g < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { ref: y, className: "reader-finder-list", children: m.map((E, $) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ C(X, { className: "reader-finder-entry is-hit", "aria-current": $ === g ? "true" : void 0, onClick: () => S($), children: [
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
function Gs(e, t = []) {
  for (const n of e)
    t.push(n), Gs(n.children, t);
  return t;
}
const _g = 24, Ht = 28, fa = 15;
function Xs(e) {
  return e.reduce((t, n) => t + 1 + n.children.length, 0);
}
function Ag(e, t) {
  if (e.length)
    return (e.length === 1 && e[0].children.length ? e[0].children : e).map((o) => ({
      id: o.id,
      title: o.title,
      page: o.page,
      depth: 1,
      children: Gs(o.children).map((a) => ({ id: a.id, title: a.title, page: a.page, depth: a.level - o.level + 1 }))
    }));
  const n = [];
  for (const r of t) {
    const o = { id: r.itemId, title: r.text, page: r.page, itemId: r.itemId }, a = n[n.length - 1];
    r.level > 1 && a ? a.children.push({ ...o, depth: 2 }) : n.push({ ...o, depth: 1, children: [] });
  }
  return n;
}
function Lg(e, t) {
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
function Cg(e, t) {
  const n = Xs(e) > _g, r = Math.max(1, Math.ceil(e.length / Ht)), o = [];
  if (e.forEach((i, c) => {
    const l = i.id === t.chapterId;
    if (!(c % r !== 0 && !l) && (o.push({ id: i.id, kind: "h1", state: i.id === t.nodeId ? "current" : l ? "chapter" : "" }), !(n && !l)))
      for (const u of i.children)
        u.depth > 2 && !l || o.push({ id: u.id, kind: "h2", state: u.id === t.nodeId ? "current" : "" });
  }), o.length <= Ht) return o;
  const a = Math.max(0, o.findIndex((i) => i.state === "current")), s = Math.min(Math.max(0, a - Math.floor(Ht / 2)), o.length - Ht);
  return o.slice(s, s + Ht);
}
function Dg(e, t) {
  const n = t.trim().toLowerCase();
  if (!n) return [...e];
  const r = [];
  for (const o of e) {
    const a = o.title.toLowerCase().includes(n), s = o.children.filter((i) => i.title.toLowerCase().includes(n));
    a ? r.push(o) : s.length && r.push({ ...o, children: s });
  }
  return r;
}
const $g = [];
function ma({ bookmarks: e, onJumpPage: t, onJumpBlock: n, pinned: r = !1, docked: o = !1, onPinChange: a }) {
  var _, k;
  const s = ((_ = Be()) == null ? void 0 : _.regions) ?? $g, i = ((k = Ir()) == null ? void 0 : k.currentPage) ?? 1, c = U(() => Ag(e, Hu(s)), [e, s]), l = U(() => Lg(c, i), [c, i]), u = U(() => Cg(c, l), [c, l]), f = Xs(c), [d, m] = N(""), g = U(() => Dg(c, d), [c, d]), [h, b] = N(() => /* @__PURE__ */ new Set()), w = A(null), I = A(!1), y = () => {
    l.chapterId && !h.has(l.chapterId) && b((T) => new Set(T).add(l.chapterId)), I.current = !0;
  };
  if (O(() => {
    (r || o) && y();
  }, [r, o]), Le(() => {
    var T, R, D;
    I.current && (I.current = !1, (D = (R = (T = w.current) == null ? void 0 : T.querySelector('[aria-current="location"]')) == null ? void 0 : R.scrollIntoView) == null || D.call(R, { block: "center" }));
  }), !c.length) return null;
  const S = (T) => b((R) => {
    const D = new Set(R);
    return D.has(T) ? D.delete(T) : D.add(T), D;
  }), v = (T, R) => {
    b((D) => D.has(R) ? D : new Set(D).add(R)), T.itemId ? n(T.itemId) : T.page !== null && t(T.page);
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
  ), E = r ? "取消固定" : "固定在左边", $ = /* @__PURE__ */ C(Ae, { children: [
    /* @__PURE__ */ C("div", { className: "reader-toc-head", children: [
      /* @__PURE__ */ p("span", { className: "reader-toc-head-title", children: "目录" }),
      /* @__PURE__ */ p(X, { className: "reader-toc-pin", "aria-label": E, title: E, "aria-pressed": r, onClick: () => a == null ? void 0 : a(!r), children: r ? /* @__PURE__ */ p(Ui, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }) : /* @__PURE__ */ p(ka, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }) })
    ] }),
    f > fa ? /* @__PURE__ */ C("div", { className: "reader-toc-filter", children: [
      /* @__PURE__ */ p(La, { size: 13, "aria-hidden": !0 }),
      /* @__PURE__ */ p(
        hr,
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
    /* @__PURE__ */ p("div", { className: "reader-toc-list", ref: w, children: g.length ? g.map((T) => {
      const R = P || h.has(T.id);
      return /* @__PURE__ */ C("div", { className: "reader-toc-chapter", children: [
        /* @__PURE__ */ C("div", { className: "reader-toc-chapter-row", children: [
          T.children.length ? /* @__PURE__ */ p(
            X,
            {
              className: "reader-toc-caret",
              "aria-expanded": R,
              "aria-label": `${R ? "收起" : "展开"}「${T.title}」`,
              onClick: () => S(T.id),
              children: R ? /* @__PURE__ */ p(vn, { size: 12, "aria-hidden": !0 }) : /* @__PURE__ */ p(xa, { size: 12, "aria-hidden": !0 })
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
      onPointerEnter: r ? void 0 : y,
      onKeyDown: (T) => {
        r && T.key === "Escape" && (a == null || a(!1));
      },
      onFocus: (T) => {
        !r && !T.currentTarget.contains(T.relatedTarget) && y();
      },
      children: [
        /* @__PURE__ */ p("div", { className: "reader-toc-bars", tabIndex: 0, "aria-label": `目录，${f} 条（移上去或按 Tab 展开）`, children: u.map((T) => /* @__PURE__ */ p("span", { className: "reader-toc-bar", "data-kind": T.kind, "data-state": T.state || void 0, "aria-hidden": !0 }, T.id)) }),
        /* @__PURE__ */ p("div", { className: "reader-toc-card", "data-compact": f <= fa ? "true" : void 0, children: $ })
      ]
    }
  );
}
function Og({ active: e }) {
  return /* @__PURE__ */ C("div", { className: "reader-side-rail", role: "toolbar", "aria-orientation": "vertical", "aria-label": "面板和下载", children: [
    /* @__PURE__ */ p(ur, { place: "side", active: e }),
    /* @__PURE__ */ p("span", { className: "reader-side-rail-sep", "aria-hidden": !0 }),
    /* @__PURE__ */ p(og, {})
  ] });
}
const Rn = ".textLayer", ha = 8, zg = 34, Fg = 56;
function dr(e) {
  return e ? e.nodeType === 1 ? e : e.parentElement : null;
}
function gn(e = ((t) => (t = globalThis.getSelection) == null ? void 0 : t.call(globalThis))() ?? null) {
  var s, i;
  if (!e || e.isCollapsed || !e.rangeCount) return null;
  const n = e.getRangeAt(0), r = ((s = dr(n.startContainer)) == null ? void 0 : s.closest(Rn)) ?? ((i = dr(n.endContainer)) == null ? void 0 : i.closest(Rn));
  if (!r) return null;
  const o = ws(`${e}`);
  if (!o) return null;
  const a = r.closest(`[${ke}]`);
  return {
    text: o,
    page: Math.max(1, Number(a == null ? void 0 : a.getAttribute(ke)) || 1),
    pane: (a == null ? void 0 : a.getAttribute(we)) === "translated" ? "translated" : "source",
    layer: r
  };
}
async function Ys(e) {
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
const Zs = typeof navigator < "u" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
function Bg(e) {
  const t = gn();
  if (!t) return [];
  const n = [{ key: "copy", label: "复制", hint: Zs ? "⌘C" : "Ctrl+C", onSelect: () => {
    Ys(t.text);
  } }];
  if (e) {
    const r = Ur(Nt(e), t.text, t.page);
    n.push({
      key: "favorite",
      label: r ? "已收藏（在左下角「收藏」里）" : "收藏这段",
      onSelect: () => {
        qs(e, t);
      }
    });
  }
  return n;
}
function Hg(e) {
  return [...e.querySelectorAll("span")].filter((t) => !t.classList.contains("markedContent") && !t.querySelector("span"));
}
function jg(e) {
  let t = 0, n = null;
  return e.map((r) => {
    const o = r.getBoundingClientRect(), a = o.top + o.height / 2;
    return n && Math.abs(a - n.center) > Math.max(o.height, n.height) / 2 && (t += 1), n = { center: a, height: o.height || (n == null ? void 0 : n.height) || 0 }, { text: r.textContent || "", line: t };
  });
}
function Ug(e) {
  const t = [], n = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
  for (let r = n.nextNode(); r; r = n.nextNode()) t.push(r);
  return t;
}
function pa(e, t) {
  const n = dr(e), r = n == null ? void 0 : n.closest(Rn), o = n == null ? void 0 : n.closest("span");
  if (!r || !o) return null;
  const a = Hg(r), s = a.indexOf(o);
  if (s < 0) return null;
  const i = Math.max(0, s - 60), c = a.slice(i, Math.min(a.length, s + 61)), l = um(jg(c), s - i);
  if (!l) return null;
  const u = Ug(c[t === "start" ? l[0] : l[1]]);
  return u.length ? t === "start" ? { node: u[0], offset: 0 } : { node: u[u.length - 1], offset: u[u.length - 1].length } : null;
}
function Wg(e) {
  if (!e || e.isCollapsed || !e.rangeCount) return !1;
  const t = e.getRangeAt(0), n = pa(t.startContainer, "start"), r = pa(t.endContainer, "end");
  if (!n && !r) return !1;
  const o = t.cloneRange();
  return n && t.comparePoint(n.node, n.offset) <= 0 && o.setStart(n.node, n.offset), r && t.comparePoint(r.node, r.offset) >= 0 && o.setEnd(r.node, r.offset), o.compareBoundaryPoints(Range.START_TO_START, t) === 0 && o.compareBoundaryPoints(Range.END_TO_END, t) === 0 ? !1 : (e.removeAllRanges(), e.addRange(o), !0);
}
function Kg(e) {
  var s;
  if (!e || e.isCollapsed || !e.rangeCount) return [];
  const t = e.getRangeAt(0), n = t.commonAncestorContainer, r = n.nodeType === 3 ? [n] : (() => {
    const i = [], c = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
    for (let l = c.nextNode(); l; l = c.nextNode()) t.intersectsNode(l) && i.push(l);
    return i;
  })(), o = [], a = /* @__PURE__ */ new Map();
  for (const i of r) {
    const c = (s = i.parentElement) == null ? void 0 : s.closest(Rn);
    if (!c) continue;
    const l = c.closest(`.${rn}`) ?? c;
    let u = a.get(l);
    u || (u = l.getBoundingClientRect(), a.set(l, u));
    const f = document.createRange();
    if (f.selectNodeContents(i), i === t.startContainer && f.setStart(i, t.startOffset), i === t.endContainer && f.setEnd(i, t.endOffset), !!f.toString().trim())
      for (const d of f.getClientRects()) {
        const m = Math.max(d.left, u.left), g = Math.min(d.right, u.right);
        g - m > 0.5 && o.push({ left: m, top: d.top, right: g, bottom: d.bottom });
      }
  }
  return dm(o);
}
function Vg({ scope: e, menuItemsAt: t }) {
  const n = A(null), r = A(!1), o = A(!1), a = A(0), s = A(t);
  s.current = t;
  const [i, c] = N(null), l = A(null), u = L(() => {
    var P;
    a.current = 0;
    const d = n.current;
    if (!d) return;
    const m = ((P = globalThis.getSelection) == null ? void 0 : P.call(globalThis)) ?? null, g = Kg(m), h = d.getBoundingClientRect();
    for (; d.children.length > g.length; ) d.lastElementChild.remove();
    if (g.forEach((M, E) => {
      const $ = d.children[E] ?? d.appendChild(document.createElement("div"));
      $.className = "reader-selection-band", $.style.left = `${M.left - h.left}px`, $.style.top = `${M.top - h.top}px`, $.style.width = `${M.right - M.left}px`, $.style.height = `${M.bottom - M.top}px`;
    }), !r.current) return;
    const b = gn(m);
    if (!b || !g.length) {
      r.current = !1, c(null);
      return;
    }
    const w = g[0], I = g[g.length - 1], y = (Math.min(...g.map((M) => M.left)) + Math.max(...g.map((M) => M.right))) / 2 - h.left, S = w.top - h.top - ha - zg, v = S >= Fg ? S : I.bottom - h.top + ha;
    c((M) => {
      var k;
      const E = M && M.text === b.text ? M.actions : s.current({
        target: b.layer,
        clientX: (w.left + w.right) / 2,
        clientY: (w.top + w.bottom) / 2,
        page: b.page
      }).filter((T) => T.inSelectionBar), $ = ((k = l.current) == null ? void 0 : k.offsetWidth) || 220, _ = Math.min(Math.max(y, $ / 2 + 8), h.width - $ / 2 - 8);
      return M && M.text === b.text && Math.abs(M.left - _) < 0.5 && Math.abs(M.top - v) < 0.5 ? M : { left: _, top: v, text: b.text, page: b.page, pane: b.pane, actions: E };
    });
  }, []), f = L(() => {
    a.current || (a.current = requestAnimationFrame(u));
  }, [u]);
  return O(() => {
    const d = n.current, m = d == null ? void 0 : d.parentElement, g = d == null ? void 0 : d.closest(`.${Oa}`);
    if (!d || !m) return;
    const h = () => {
      g && delete g.dataset.selectPane;
    }, b = (S) => {
      var M, E, $;
      const v = S.target;
      if (v && ((M = l.current) != null && M.contains(v))) return;
      r.current = !1, c(null);
      const P = ($ = (E = v == null ? void 0 : v.closest) == null ? void 0 : E.call(v, `[${ke}][${we}]`)) == null ? void 0 : $.getAttribute(we);
      o.current = !!P && S.button === 0, g && P && S.button === 0 && (g.dataset.selectPane = P);
    }, w = (S) => {
      var M;
      h();
      const v = o.current;
      if (o.current = !1, S.button !== 0 || !v) return;
      const P = ((M = globalThis.getSelection) == null ? void 0 : M.call(globalThis)) ?? null;
      gn(P) && (Wg(P), r.current = !0, f());
    }, I = (S) => {
      const v = gn();
      !v || !S.clipboardData || (S.clipboardData.setData("text/plain", v.text), S.preventDefault());
    }, y = (S) => {
      S.key === "Escape" && r.current && (r.current = !1, c(null));
    };
    return m.addEventListener("pointerdown", b, !0), window.addEventListener("pointerup", w), window.addEventListener("pointercancel", h), document.addEventListener("selectionchange", f), document.addEventListener("copy", I), document.addEventListener("keydown", y), m.addEventListener("scroll", f, { capture: !0, passive: !0 }), window.addEventListener("resize", f), () => {
      h(), a.current && cancelAnimationFrame(a.current), m.removeEventListener("pointerdown", b, !0), window.removeEventListener("pointerup", w), window.removeEventListener("pointercancel", h), document.removeEventListener("selectionchange", f), document.removeEventListener("copy", I), document.removeEventListener("keydown", y), m.removeEventListener("scroll", f, { capture: !0 }), window.removeEventListener("resize", f);
    };
  }, [f]), /* @__PURE__ */ C(Ae, { children: [
    /* @__PURE__ */ p("div", { className: "reader-selection-paint", ref: n, "aria-hidden": "true" }),
    i ? /* @__PURE__ */ p(
      qg,
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
function qg({ bar: e, scope: t, onDone: n, ref: r }) {
  const { favorites: o, add: a } = Js(t), s = !!t && !!Ur(o, e.text, e.page), [i, c] = N(!1);
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
            title: Zs ? "复制（⌘C）" : "复制（Ctrl+C）",
            onClick: () => {
              Ys(e.text).then((l) => c(l));
            },
            children: [
              i ? /* @__PURE__ */ p(mr, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }) : /* @__PURE__ */ p(Ta, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }),
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
              /* @__PURE__ */ p(Aa, { size: 14, strokeWidth: 1.75, fill: s ? "currentColor" : "none", "aria-hidden": !0 }),
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
              /* @__PURE__ */ p(Ma, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { children: l.inSelectionBar })
            ]
          },
          l.key
        ))
      ]
    }
  );
}
function Jg(e) {
  const [t, n] = N([]);
  return O(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = Ze().loadIssues;
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
function Gg(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const Xg = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, Yg = ["failed", "content", "layout"];
function Zg(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Qg(e, t, n) {
  const r = Jg(e), [o, a] = N(-1);
  O(() => a(-1), [r]);
  const s = L((c) => {
    const l = r[c];
    !l || !n || (a(c), n(l.readerItemId));
  }, [r, n]), i = A({ issues: r, last: o, currentPage: t, goTo: s });
  return i.current = { issues: r, last: o, currentPage: t, goTo: s }, O(() => {
    const c = (l) => {
      if (l.key.toLowerCase() !== "n" || l.metaKey || l.ctrlKey || l.altKey || Zg(l.target)) return;
      const { issues: u, last: f, currentPage: d, goTo: m } = i.current, g = Gg(u, f, d, l.shiftKey);
      g < 0 || (l.preventDefault(), m(g));
    };
    return document.addEventListener("keydown", c), () => document.removeEventListener("keydown", c);
  }, []), { issues: r, last: o, goTo: s };
}
function ey(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function ty(e) {
  var r;
  if (e.shiftKey || ey(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${Fa}`))) return null;
  const n = Number((r = t.closest(`[${ke}]`)) == null ? void 0 : r.getAttribute(ke)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function ny({
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
    r.map((c) => /* @__PURE__ */ p(Pn, { children: c.render({ page: e.page, close: t }) }, c.id))
  ] });
}
function ry({ edit: e }) {
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
const Qs = "retainpdf:reader:doc-theme:v1", ga = "data-reader-doc";
function ei() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function oy(e = ei()) {
  try {
    return (e == null ? void 0 : e.getItem(Qs)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function ay(e, t = ei()) {
  try {
    t == null || t.setItem(Qs, e);
  } catch {
  }
}
function ya(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(ga, "dark") : t.removeAttribute(ga));
}
function sy() {
  const [e, t] = N(() => oy());
  O(() => {
    ya(e);
  }, [e]), O(() => () => ya("light"), []);
  const n = L(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return ay(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
function iy({ scope: e, regions: t, currentPage: n, numPages: r, onJumpPage: o }) {
  const { bookmarks: a, remove: s } = Ws(e, t);
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
function cy({ nav: e }) {
  const { issues: t, last: n, goTo: r } = e;
  return /* @__PURE__ */ C("div", { className: "reader-issues", children: [
    /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
    Yg.map((o) => {
      const a = t.map((s, i) => ({ issue: s, index: i })).filter(({ issue: s }) => s.kind === o);
      return a.length ? /* @__PURE__ */ C("section", { className: "reader-issues-group", "data-issue-kind": o, children: [
        /* @__PURE__ */ C("h4", { children: [
          Xg[o],
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
function ly({ state: e, bookmarkScope: t, issues: n }) {
  const { finder: r, setFinder: o, findQuery: a, setFindQuery: s, findTerm: i, findFocus: c, jumpFromFinder: l, jumpToPageFromFinder: u, pinned: f } = e, d = Be(), m = Ir(), g = (m == null ? void 0 : m.currentPage) ?? 1, h = n.issues.length;
  return /* @__PURE__ */ p(Ae, { children: r ? /* @__PURE__ */ p(
    Ng,
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
        iy,
        {
          scope: t,
          regions: d == null ? void 0 : d.regions,
          currentPage: g,
          numPages: (m == null ? void 0 : m.numPages) ?? 0,
          onJumpPage: u
        }
      ) : void 0,
      issuesPane: h ? /* @__PURE__ */ p(cy, { nav: n }) : void 0,
      issueCount: h
    }
  ) : null });
}
function uy({
  session: e,
  zoomDocuments: t,
  zoomItem: n,
  setZoomItem: r,
  closeZoom: o,
  visiblePdfMode: a
}) {
  return /* @__PURE__ */ p(Ae, { children: n ? /* @__PURE__ */ p(
    qh,
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
function dy(e) {
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
const fy = 720;
function my(e, t) {
  return !t || !Number.isFinite(e) || e <= 0 ? !0 : e >= fy;
}
function hy(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function py(e, t, n = !0) {
  const { sessionFiles: r } = e, [o, a] = N(!1), s = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, i = dy({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: s,
    liveTranslationVisible: o,
    assistantOpen: t,
    compareFits: n
  }), c = eu({
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
    f.current !== e.viewStateKey && ru({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: l,
      jobTerminal: e.session.jobTerminal
    }) && (f.current = e.viewStateKey, a(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, l]), { liveTranslationVisible: o, setLiveTranslationVisible: a, paneComposition: i, liveToggles: c, sourceViewOnly: l, visiblePdfMode: u };
}
function gy(e, { liveTranslationVisible: t, setLiveTranslationVisible: n, liveToggles: r, sourceViewOnly: o, visiblePdfMode: a }) {
  const s = tu(e.liveTranslation), i = L(() => {
    s && e.goToPage(s, "source");
  }, [e.goToPage, s]), [c, l] = N(null);
  O(() => {
    a === "compare" && e.session.jobTerminal && l(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, a]);
  const u = c !== e.viewStateKey && ou({
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
function yy() {
  const [e] = N(Bf), t = Xf(e), n = Kf(t);
  return { contributionStore: e, contributions: t, reserveRight: n };
}
function by(e, t, n) {
  const r = A(e);
  O(() => {
    const o = e > 0 && r.current <= 0;
    r.current = e, o && t && n();
  }, [e]);
}
function vy(e, t, {
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
  const b = L(() => h.current, []), w = U(() => ({
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
    currentPage: b
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
  ]), { contributionStore: I, contributions: y, reserveRight: S } = t, v = U(() => Hf(y), [y]), P = U(() => Vf(y), [y]), M = U(() => Wf(y), [y]), E = U(() => jf(y), [y]), $ = Uf(y);
  return { readerApi: w, contributionStore: I, contributions: y, pageLayers: v, compareVersion: P, textMarks: M, menuSections: E, pointerTakenId: $, reserveRight: S };
}
function wy() {
  try {
    return Ze().translationEdit ?? null;
  } catch {
    return null;
  }
}
const Sy = "这本书正在处理（翻译或排版），处理完才能改。", Iy = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function Ty({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = wy(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = Ju(s), l = !t || Gt(t), u = ed(n), [f, d] = N(""), [m, g] = N(null), [h, b] = N(() => /* @__PURE__ */ new Map()), [w, I] = N(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [y, S] = N(() => /* @__PURE__ */ new Map()), [v, P] = N({ phase: "idle" }), M = A({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  O(() => {
    g(null), M.drafts.clear(), M.generation.current = null, S(/* @__PURE__ */ new Map()), P({ phase: "idle" });
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
    if (b(/* @__PURE__ */ new Map()), !a || !f || !u || !l) return;
    let z = !1;
    return a.fetchRevisions(f).then((K) => {
      z || b(td(K, u));
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
    if (w.renderedAt === u)
      for (const [K, j] of w.edits) z.set(K, j);
    return z;
  }, [h, w, u]), _ = L((z) => {
    const K = `${z || ""}`.trim();
    K && g({ itemId: K, page: Gu(K) });
  }, []), k = L(() => g(null), []), T = L((z, K) => {
    I((j) => {
      const J = new Map(j.renderedAt === u ? j.edits : []);
      return J.set(z, K), { renderedAt: u, edits: J };
    }), S((j) => new Map(j).set(z, (j.get(z) || 0) + 1));
  }, [u]), R = L(async () => {
    if (!(!a || !s || v.phase === "submitting" || v.phase === "running")) {
      P({ phase: "submitting" });
      try {
        await a.rerender(s), P({ phase: "running", seenActive: !1 }), await o();
      } catch (z) {
        P({ phase: "failed", message: (z == null ? void 0 : z.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, v.phase, o]), D = c ? Iy : !l || v.phase === "running" || v.phase === "submitting" ? Sy : "";
  return U(() => ({
    available: i,
    blockedReason: D,
    port: a,
    ownerJobId: f,
    target: m,
    select: _,
    close: k,
    memory: M,
    pendingEdits: $,
    savedCounts: y,
    markSaved: T,
    rerender: v,
    startRerender: R
  }), [i, D, a, f, m, _, k, M, $, y, T, v, R]);
}
function ky(e, t) {
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
function Ey(e, t, n) {
  const { session: r, sessionFiles: o } = e, a = Ty({
    jobId: r.jobId,
    jobStatus: r.jobStatus,
    jobPayload: r.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!o.translatedUrl,
    refreshJobStatus: r.refreshJobStatus
  }), s = a.select, i = e.setModeKeepingPage, c = r.regions, l = a.memory.drafts, u = L((d, m) => {
    os(c, d) && (t === "source" && i("compare"), m != null && m.trim() && l.set(d, m), s(d));
  }, [c, s, t, i, l]);
  ky(a.available ? u : null, n);
  const f = U(() => {
    if (!a.savedCounts.size) return e.revisedBlocks;
    const d = new Map(e.revisedBlocks);
    for (const [m, g] of a.savedCounts) d.set(m, (d.get(m) || 0) + g);
    return d;
  }, [e.revisedBlocks, a.savedCounts]);
  return { blockEdit: a, editBlock: u, revisedBlocks: f };
}
const Ry = "reader-finder-input";
function Py(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function My(e, t = typeof window > "u" ? null : window) {
  O(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!Py(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(Ry) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
const ti = "retainpdf.reader.sidebar.v1", xy = ["search", "bookmarks", "issues"], Ny = 900;
function _y() {
  var e;
  try {
    const t = JSON.parse(((e = globalThis.localStorage) == null ? void 0 : e.getItem(ti)) || "{}");
    return { tab: xy.includes(t == null ? void 0 : t.tab) ? t.tab : "search" };
  } catch {
    return { tab: "search" };
  }
}
function Ay(e) {
  var t;
  try {
    (t = globalThis.localStorage) == null || t.setItem(ti, JSON.stringify(e));
  } catch {
  }
}
function Ly() {
  const e = `(min-width: ${Ny}px)`, [t, n] = N(() => typeof window > "u" || !window.matchMedia ? !0 : window.matchMedia(e).matches);
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
function Cy(e) {
  const [t] = N(_y), [n, r] = N(null), [o, a] = N(t.tab), i = Ly(), c = L((v) => {
    r(v), v && a(v);
  }, []);
  O(() => {
    Ay({ tab: n || o });
  }, [n, o]);
  const l = L(() => r((v) => v ? null : o), [o]), u = L((v) => {
    r((P) => P === v ? null : v), a(v);
  }, []), [f, d] = N(""), [m, g] = N("");
  O(() => {
    const v = f.replace(/\s+/gu, " ").trim(), P = window.setTimeout(() => g(v), v ? 150 : 0);
    return () => window.clearTimeout(P);
  }, [f]);
  const [h, b] = N(0), w = L(() => {
    c("search"), b((v) => v + 1);
  }, [c]);
  My(w);
  const I = L(() => {
    i || r(null);
  }, [i]), y = L((v) => {
    e.jumpToAnchor({ block_id: v }), I();
  }, [e.jumpToAnchor, I]), S = L((v) => {
    e.goToPage(v), I();
  }, [e.goToPage, I]);
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
    jumpFromFinder: y,
    jumpToPageFromFinder: S
  };
}
function Dy(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : Ua(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function $y(e, t) {
  return t === null || e !== t;
}
function Oy(e, t) {
  const { boot: n } = e, r = A(null), o = A(null);
  O(() => {
    if (!(n.loading || n.failed)) {
      if (r.current !== e.viewStateKey) {
        r.current = e.viewStateKey;
        const a = We(e.viewStateKey), s = Dy({
          savedMode: a == null ? void 0 : a.mode,
          sourceViewOnly: t,
          viewportWidth: Pt()
        });
        o.current = s.auto ? s.mode : null, s.mode && s.mode !== e.mode && e.setModeKeepingPage(s.mode);
        return;
      }
      $y(e.mode, o.current) && (o.current = null, xn(e.viewStateKey, { mode: e.mode }));
    }
  }, [n.failed, n.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, t]);
}
const zy = [];
function Fy(e) {
  const { sessionFiles: t } = e, [n, r] = N({}), o = A({ source: t.sourceUrl, translated: t.translatedUrl });
  o.current = { source: t.sourceUrl, translated: t.translatedUrl };
  const a = L((b, w) => {
    r((I) => ({ ...I, [w]: { url: o.current[w], nodes: b } }));
  }, []), s = U(() => {
    const b = n.source;
    if (b && b.url === t.sourceUrl && b.nodes.length) return b.nodes;
    const w = n.translated;
    return w && w.url === t.translatedUrl && w.nodes.length ? w.nodes : zy;
  }, [n, t.sourceUrl, t.translatedUrl]), i = A({}), [c, l] = N(0), u = L((b, w) => {
    i.current[w] = { url: o.current[w], pdf: b }, l((I) => I + 1);
  }, []), [f, d] = N(null), m = L((b) => d(b), []), g = L(() => d(null), []);
  O(() => d(null), [e.viewStateKey]);
  const h = U(() => {
    const b = (w, I) => {
      const y = i.current[w];
      return y && y.url === I ? y.pdf : null;
    };
    return { source: b("source", t.sourceUrl), translated: b("translated", t.translatedUrl) };
  }, [c, t.sourceUrl, t.translatedUrl]);
  return { bookmarks: s, onPdfOutline: a, onPdfDocument: u, zoomItem: f, setZoomItem: d, zoomBlock: m, closeZoom: g, zoomDocuments: h };
}
function By() {
  const e = mu(), { boot: t, panes: n, session: r } = e, o = Ig(e.viewStateKey), a = o.panel, s = o.setPanel, i = a !== null, c = yy(), { reserveRight: l } = c, u = i || l > 0, f = Cy(e), { finder: d, findTerm: m } = f, g = !!d && f.pinned, [h, b] = N(!1), w = h && f.pinned, I = L(() => {
    s(null);
  }, []);
  by(l, a, I);
  const { liveTranslationVisible: y, setLiveTranslationVisible: S, paneComposition: v, liveToggles: P, sourceViewOnly: M, visiblePdfMode: E } = py(
    e,
    i,
    my(e.shell.shellWidth, u || g || w)
  );
  Oy(e, M);
  const $ = a || (e.mode === "compare" ? "compare" : "reading"), { docDark: _, toggleDocDark: k } = sy();
  wu({
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
  const { latestLivePage: T, jumpToLatestLivePage: R, offerCompletion: D, setCompletionDismissedKey: z, sourcePaneAction: K } = gy(e, {
    liveTranslationVisible: y,
    setLiveTranslationVisible: S,
    liveToggles: P,
    sourceViewOnly: M,
    visiblePdfMode: E
  }), j = L((be) => {
    const F = hy(be, e.liveTranslationAvailable);
    F !== null && S(F), e.setModeKeepingPage(be);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), J = L((be) => {
    s(be);
  }, []), [oe] = N(Rg), q = L((be) => e.jumpToAnchor({ block_id: be }), [e.jumpToAnchor]), se = Qg(e.sourceOnly ? "" : r.jobId, e.currentPage, q), [Ee, re] = N(null), ue = L((be, F) => e.jumpToAnchor({ block_id: be }, F), [e.jumpToAnchor]), { bookmarks: Me, onPdfOutline: ie, onPdfDocument: le, zoomItem: B, setZoomItem: W, zoomBlock: Y, closeZoom: de, zoomDocuments: ne } = Fy(e), { blockEdit: ae, editBlock: Se, revisedBlocks: ee } = Ey(e, E, oe), [Z, fe] = N(null), x = L(() => fe(null), []), H = Um({ documentId: r.documentId, jobId: r.jobId }), {
    readerApi: V,
    contributionStore: me,
    contributions: ye,
    pageLayers: Ie,
    compareVersion: Ne,
    textMarks: ze,
    menuSections: He,
    pointerTakenId: Qe
  } = vy(e, c, {
    translationVersions: H,
    bookmarks: Me,
    regionHover: oe,
    assistantPanel: a,
    closeAssistant: I,
    visiblePdfMode: E,
    changeWorkspace: j,
    jumpToBlockIn: ue,
    zoomDocuments: ne,
    editBlock: ae.available && !ae.blockedReason ? Se : null,
    panelHost: Ee
  }), De = !!Qe, [Ke, et] = N([]), tt = U(() => ({
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
    textMarks: ze,
    pageLayers: Ie,
    editBlock: ae.available ? Se : void 0,
    blockEdit: ae,
    editShowsSource: E !== "compare",
    findTerm: d === "search" ? m : "",
    compareVersion: Ne,
    pointerTaken: De,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: M,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: J, close: I },
    docDark: _,
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
    ze,
    Ie,
    ae,
    Se,
    E,
    d,
    m,
    Ne,
    De,
    e.sourceOnly,
    M,
    e.download,
    e.goToPage,
    J,
    I,
    _,
    k
  ]), St = U(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), nt = [
    Oa,
    `is-workspace-${$}`,
    i ? "is-assistant-open" : "",
    d ? "is-finder-open" : "",
    g ? "is-sidebar-pinned" : "",
    w ? "is-toc-docked" : "",
    v.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(Jf, { api: V, store: me, children: /* @__PURE__ */ p(Jd, { value: tt, hud: St, children: /* @__PURE__ */ C(
    "div",
    {
      className: nt,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": $,
      "data-pointer-taken": Qe || void 0,
      onContextMenu: (be) => {
        const F = ty(be);
        if (!F) return;
        const Q = [
          ...Bg(e.viewStateKey),
          ...Eo(ye, { target: be.target, clientX: be.clientX, clientY: be.clientY, page: F.page })
        ];
        !Q.length && !He.length || (be.preventDefault(), et(Q), fe(F));
      },
      children: [
        /* @__PURE__ */ C("div", { className: "reader-workspace", children: [
          w ? /* @__PURE__ */ p(ma, { bookmarks: Me, onJumpPage: e.goToPage, onJumpBlock: q, pinned: !0, docked: !0, onPinChange: b }) : null,
          /* @__PURE__ */ p(ly, { state: f, bookmarkScope: e.viewStateKey, issues: se }),
          /* @__PURE__ */ C("div", { className: "reader-stage", children: [
            /* @__PURE__ */ p(
              Ff,
              {
                mode: E,
                documentReady: !!r.jobId,
                sourceViewOnly: M,
                onModeChange: j,
                compareExtra: /* @__PURE__ */ p(ur, { place: "compare" }),
                liveTranslation: P.topBarPill ? {
                  visible: y,
                  state: e.liveTranslation,
                  onToggle: () => S((be) => !be),
                  latestPage: y ? T : null,
                  currentPage: e.currentPage,
                  onJumpToLatest: R
                } : null,
                completion: D ? {
                  onOpenCompare: () => {
                    z(e.viewStateKey), j("compare");
                  }
                } : null,
                start: /* @__PURE__ */ p(Pu, { onBeforeClose: r.prepareClose })
              }
            ),
            w ? null : /* @__PURE__ */ p(ma, { bookmarks: Me, onJumpPage: e.goToPage, onJumpBlock: q, pinned: h, onPinChange: b }),
            /* @__PURE__ */ p(Og, { active: a }),
            /* @__PURE__ */ p(Vg, { scope: e.viewStateKey, menuItemsAt: (be) => Eo(ye, be) }),
            /* @__PURE__ */ p(xf, { paneComposition: v, markdownSplit: i, assistantSplit: u, liveTranslation: e.liveTranslation, sourcePaneAction: K }),
            /* @__PURE__ */ p(Gp, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!r.readerErrors.regions, metadataError: !!r.readerErrors.metadata, onRetry: r.refreshJobArtifacts }),
            /* @__PURE__ */ p(
              Sg,
              {
                mode: E,
                modeControls: null,
                bookmarkScope: e.viewStateKey,
                startSlot: /* @__PURE__ */ p(xg, { open: d, onToggle: f.toggleSidebar, issueCount: se.issues.length }),
                leftSlot: /* @__PURE__ */ p(ry, { edit: ae }),
                toolsSlot: /* @__PURE__ */ p(ur, { place: "bottom" })
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
                /* @__PURE__ */ p(ip, { active: a }),
                /* @__PURE__ */ p("div", { className: "reader-dock-body", ref: re })
              ]
            }
          )
        ] }),
        i ? /* @__PURE__ */ p(qp, {}) : null,
        /* @__PURE__ */ p(
          uy,
          {
            session: r,
            zoomDocuments: ne,
            zoomItem: B,
            setZoomItem: W,
            closeZoom: de,
            visiblePdfMode: E
          }
        ),
        /* @__PURE__ */ p(ny, { menu: Z, onClose: x, actions: Ke, sections: He }),
        /* @__PURE__ */ p(Zf, { extensions: Er }),
        /* @__PURE__ */ p(Eg, {})
      ]
    }
  ) }) });
}
function ub() {
  return /* @__PURE__ */ p(By, {});
}
export {
  ub as R,
  By as a,
  ib as b,
  cb as c,
  wm as d,
  Im as e,
  ab as f,
  sb as g,
  rb as h,
  ob as r,
  lb as s,
  Be as u
};
//# sourceMappingURL=ReaderApp-LQ7phB4s.js.map
