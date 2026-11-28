var ai = Object.defineProperty;
var Kr = (e) => {
  throw TypeError(e);
};
var si = (e, t, n) => t in e ? ai(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var Vr = (e, t, n) => si(e, typeof t != "symbol" ? t + "" : t, n), qr = (e, t, n) => t.has(e) || Kr("Cannot " + n);
var $t = (e, t, n) => (qr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Jr = (e, t, n) => t.has(e) ? Kr("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Gr = (e, t, n, r) => (qr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as C, jsx as p, Fragment as Ne } from "react/jsx-runtime";
import { useMemo as U, useState as N, useEffect as O, useCallback as L, useRef as _, useLayoutEffect as Le, memo as tn, createContext as nn, useContext as ft, Fragment as Pn, forwardRef as ii, useImperativeHandle as mr, useSyncExternalStore as Mn, Component as ci, Suspense as Sa, lazy as Ta, useId as ka } from "react";
import { requireAdapter as Lt, getReaderAdapters as Oe } from "./adapters.js";
import { resolveReaderDownloadName as li, resolveReaderDownloadUrls as ui, READER_PROGRESS_COPY as Ve, trimString as bn, READER_DOWNLOAD_ACTIONS as di, disabledReason as fi } from "./runtime/state.js";
import { r as mi, b as hi } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as Un, isFinishedJobStatus as Gt } from "@retainpdf/domain/job";
import { n as Ia, d as pi, f as An, k as Xr, b as gi, c as yi, j as Ce, p as lt, g as bi, l as mt, i as vi } from "./reader-regions-BmqHsJ-I.js";
import { fetchDocumentReading as wi } from "@retainpdf/api/documents";
import { isReaderTransportError as Si, createReaderTransportError as Ti } from "./contracts.js";
import { toast as Wn, Toaster as ki } from "sonner";
import { ChevronLeft as Ea, PenLine as vn, ZoomIn as Ii, Check as hr, X as bt, Copy as Ra, ChevronUp as Ei, ChevronDown as wn, History as Ri, LoaderCircle as Pi, Pin as Pa, LogOut as Mi, FileText as Ma, Columns2 as xa, Languages as Na, Radio as xi, ArrowDownToLine as Ni, CheckCircle2 as Ai, ImagePlus as _i, MessageCircle as Aa, Scan as Li, GitCompareArrows as Ci, CodeXml as $i, Highlighter as Di, Eraser as Oi, Undo2 as zi, Trash2 as Fi, BookText as Bi, ChevronRight as _a, Minus as La, Plus as Ca, ArrowLeft as Hi, CircleHelp as ji, Download as Ui, Bookmark as Wi, Star as $a, Contrast as Ki, Search as Da, PinOff as Vi } from "lucide-react";
import { Button as G, Textarea as qi, IconButton as dt, Input as pr } from "@retainpdf/ui";
import { e as Ji, m as Gi, a as Xi, c as Yi } from "./markdown-math-B8jhIfTG.js";
import { createPortal as Zi } from "react-dom";
import { pdfjs as Oa, Page as Qi, Document as ec } from "react-pdf";
const tc = (...e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, nc = "", rc = Object.freeze({
  progress: "retainpdf-reader-progress"
}), oc = (e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, yb = (...e) => {
  var n;
  return (((n = Oe()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, bb = () => {
  var e, t;
  return ((t = (e = Oe()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
}, qe = () => Lt("defaultReaderDataPort"), Yr = () => Lt("defaultReaderPageConfigPort"), vb = {
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
}, za = {
  messageTargetOrigin: () => Yr().messageTargetOrigin(),
  readerJobId: () => Yr().readerJobId()
}, ac = () => {
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
}, sc = (...e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, ic = () => {
  var e, t;
  return ((t = (e = Oe()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, cc = (...e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, lc = (...e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? li(...e);
}, uc = (...e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? ui(...e);
}, dc = (...e) => Lt("downloadProtectedResource")(...e), fc = (...e) => Lt("failDownloadToast")(...e), wb = (e, t) => Lt("resolveMarkdownAssetUrl")(e, t), Zr = "/api/v1";
function mc() {
  const e = () => {
    var r;
    return mi(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = N(e);
  return O(() => {
    var i, c, l, u;
    const r = () => n(e()), o = (c = (i = globalThis.history) == null ? void 0 : i.pushState) == null ? void 0 : c.bind(globalThis.history), a = (u = (l = globalThis.history) == null ? void 0 : l.replaceState) == null ? void 0 : u.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const m = (f) => function(...d) {
          const g = f.apply(this, d);
          return r(), globalThis.dispatchEvent(new Event("pushstate")), globalThis.dispatchEvent(new Event("replacestate")), globalThis.dispatchEvent(new Event("locationchange")), g;
        };
        globalThis.history.pushState = m(o), globalThis.history.replaceState = m(a), s = !0;
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
function hc() {
  const e = mc(), t = U(() => cc(za), [e]), n = U(() => ic(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function pc(e) {
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
  }), [u, m] = N({
    documentId: "",
    jobId: ""
  }), f = c.documentId === t ? c.jobId : "", d = u.documentId === t ? u.jobId : "", g = n || f, [h, y] = N({
    jobId: "",
    documentId: ""
  }), v = h.jobId === g ? h.documentId : "", S = t || v, b = !!t && !g, [T, w] = N(null), R = (T == null ? void 0 : T.sessionIdentity) === r && T.documentId === S ? T : null, M = b || !!R, E = L((A) => {
    const I = `${A.documentId || ""}`.trim();
    if (!I || a.current && a.current !== I) return;
    if (!a.current && s.current)
      y({
        jobId: s.current,
        documentId: I
      });
    else if (!a.current)
      return;
    const k = `${A.revision || ""}`.trim() || `${Date.now()}`;
    w({
      documentId: I,
      revision: k,
      sessionIdentity: o.current
    }), i();
  }, []);
  O(() => {
    w((A) => A && A.sessionIdentity !== r ? null : A);
  }, [r]);
  const D = L((A) => {
    switch (A.type) {
      case "resolved-document-job":
        l({ documentId: A.documentId, jobId: A.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        m({ documentId: A.documentId, jobId: A.jobId });
        break;
      case "resolved-job-document":
        y((I) => I.jobId === A.jobId && I.documentId === A.documentId ? I : { jobId: A.jobId, documentId: A.documentId });
        break;
      case "committed-source":
        w({
          documentId: A.documentId,
          revision: A.revision,
          sessionIdentity: A.sessionIdentity
        });
        break;
    }
  }, []);
  return {
    resolvedDocumentJob: c,
    setResolvedDocumentJob: l,
    missingDocumentJob: u,
    setMissingDocumentJob: m,
    documentJobId: f,
    rejectedDocumentJobId: d,
    sessionJobId: g,
    resolvedJobDocument: h,
    setResolvedJobDocument: y,
    jobDocumentId: v,
    documentId: S,
    sourceOnly: b,
    committedDocumentSource: T,
    setCommittedDocumentSource: w,
    activeCommittedDocumentSource: R,
    sourceViewOnly: M,
    refreshCommittedDocument: E,
    applyIdentityEvent: D
  };
}
function Qr(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function gc(e) {
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
function eo(e, t) {
  return oc(Un(e, t));
}
function yc(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function bc(e, t) {
  const n = e == null ? void 0 : e.book_summary, r = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    n == null ? void 0 : n.title,
    e == null ? void 0 : e.source_file_name,
    n == null ? void 0 : n.source_file_name
  ];
  for (const o of r) {
    const a = `${o || ""}`.trim();
    if (a && !yc(a, t))
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
        type: rc.progress,
        stage: n,
        percent: e,
        text: t
      },
      za.messageTargetOrigin()
    );
  } catch {
  }
}
function Sn(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), Kn({ percent: t, text: n, stage: r });
}
function vc(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = N(null), [l, u] = N(null), [m, f] = N(""), [d, g] = N(0), h = m === n ? i : null, y = m === n ? l : null, v = Qr(h), S = Gt(v), b = L(() => {
    g((D) => D + 1);
  }, []), T = L((D) => {
    c(D.jobPayload), u(D.manifestPayload), f(D.sessionIdentity);
  }, []), w = L((D) => {
    c(null), u(null), f(D);
  }, []), R = _(""), M = _(""), E = L(async () => {
    const D = o.current;
    if (!D || R.current === D) return;
    const A = Ze().loadJobPayload;
    if (typeof A != "function") return;
    const I = a.current.value;
    R.current = D;
    try {
      const k = await A(D);
      if (s.current || a.current.value !== I || o.current !== D || !k || typeof k != "object")
        return;
      const P = Qr(k);
      c(k), f(r.current), !Gt(P) && M.current === D && (M.current = ""), P === "succeeded" && M.current !== D && (M.current = D, g(($) => $ + 1));
    } catch {
    } finally {
      R.current === D && (R.current = "");
    }
  }, []);
  return O(() => {
    M.current = "";
  }, [n]), O(() => {
    if (!t || S || !h) return;
    const D = window.setInterval(() => {
      document.visibilityState !== "hidden" && E();
    }, 1e3);
    return () => window.clearInterval(D);
  }, [S, E, h, t]), {
    jobPayload: i,
    setJobPayload: c,
    manifestPayload: l,
    setManifestPayload: u,
    payloadSessionIdentity: m,
    setPayloadSessionIdentity: f,
    scopedJobPayload: h,
    scopedManifestPayload: y,
    jobStatus: v,
    jobTerminal: S,
    jobRefreshRevision: d,
    refreshJobArtifacts: b,
    refreshJobStatus: E,
    publishPayload: T,
    clearPayload: w
  };
}
function Vn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function wc(e, t) {
  e(t), Vn(t);
}
function Sc(e) {
  const [t, n] = N(e ? "source" : "compare"), r = L((a) => {
    e && a !== "source" || (n(a), Vn(a));
  }, [e]), o = L((a) => {
    wc(n, a);
  }, []);
  return O(() => (e && document.documentElement.classList.add("reader-source-only"), Vn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function to(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function Tc(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: to(n.active_job_id),
    activeVersionId: to(n.active_version_id)
  };
}
function kc(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Ic(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Ec(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Rc = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Pc(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Rc.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const Mc = 48 * 1024 * 1024;
function xc(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Nc = 2, De = /* @__PURE__ */ new Map();
function qn(e, t) {
  De.delete(e), De.set(e, t);
}
function no(e) {
  if (De.size < Nc) return;
  const t = De.keys().next().value;
  t && De.delete(t);
}
async function Ac(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function Fa(e, t = Xt().fetchProtected, n = {}) {
  var u, m, f, d, g, h, y, v, S;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (De.has(r)) {
    const b = De.get(r);
    return qn(r, b), b;
  }
  const o = new AbortController(), a = () => o.abort();
  (u = n.signal) != null && u.aborted && o.abort(), (f = (m = n.signal) == null ? void 0 : m.addEventListener) == null || f.call(m, "abort", a, { once: !0 });
  let s;
  try {
    s = await t(r, { signal: o.signal });
  } finally {
    (g = (d = n.signal) == null ? void 0 : d.removeEventListener) == null || g.call(d, "abort", a);
  }
  if (!s.ok) {
    const b = new Error(`读取 PDF 失败 (${s.status})`);
    b.status = s.status;
    const T = await Ac(s);
    throw T && (b.reason = T), b;
  }
  const i = _c(r, s, t);
  if (i) {
    o.abort();
    const b = { ranged: i };
    return no(), De.set(r, b), b;
  }
  (y = (h = n.signal) == null ? void 0 : h.addEventListener) == null || y.call(h, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (S = (v = n.signal) == null ? void 0 : v.removeEventListener) == null || S.call(v, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return De.has(r) ? qn(r, l) : (no(), De.set(r, l)), l;
}
function _c(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < Mc ? null : {
    url: e,
    length: o,
    async fetchRange(i, c) {
      const l = await n(e, { headers: { Range: `bytes=${i}-${c - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const Lc = { file: null, loading: !1, error: "" }, Cc = { file: null, loading: !0, error: "" };
function $c(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = N(null);
  if (O(() => {
    if (t || !n) return;
    const s = De.get(n);
    if (s) {
      qn(n, s);
      return;
    }
    const i = new AbortController();
    return Fa(n, void 0, { signal: i.signal }).then((c) => {
      i.signal.aborted || o({ url: n, file: c, loading: !1, error: "" });
    }).catch((c) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (c == null ? void 0 : c.message) || String(c) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Lc;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = De.get(n);
  return a ? { file: a, loading: !1, error: "" } : Cc;
}
function Dc(e) {
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
  Sn(s, r, n, "download");
  const i = await Fa(t, Xt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (Sn(s, o, n, "download"), i);
}
async function Oc(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  Sn(o, 25, "正在下载 PDF…", "download");
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
function zc(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Fc({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = wi,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(zc(o.href, t, a)), !0);
}
const sn = {
  regions: null,
  metadata: null
};
function Bc(e) {
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
    publishPayload: m,
    clearPayload: f,
    switchSessionMode: d,
    jobRefreshRevision: g,
    sessionEpochRef: h,
    closingRef: y,
    activeLoadAbortRef: v
  } = e, [S, b] = N(""), [T, w] = N(""), [R, M] = N(null), [E, D] = N(null), [A, I] = N(!1), [k, P] = N(""), [$, z] = N([]), [K, j] = N(!1), [J, oe] = N(() => ({
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
    const ue = new AbortController(), Me = h.current.value, ie = Dc({
      sessionEpochRef: h,
      closingRef: y,
      abort: ue,
      sessionEpoch: Me
    });
    v.current = ue;
    const le = Ze();
    if (y.current)
      return ue.abort(), () => {
        v.current === ue && (v.current = null);
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
      I(!0), B || j(!0), re({
        loading: !1,
        percent: 100,
        text: Ve.ready,
        stage: "ready",
        failed: !1
      }), Kn({ percent: 100, text: Ve.ready, stage: "ready" });
    }
    function de() {
      return l != null && l.documentId ? eo(
        l.documentId,
        l.revision
      ) : tc() ? nc : le.resolveResourceUrl(Un(r));
    }
    async function ne() {
      var H;
      let ee = { activeJobId: "", activeVersionId: "" };
      try {
        const V = await ((H = le.fetchDocument) == null ? void 0 : H.call(le, r));
        V && (ee = Tc(V));
      } catch {
      }
      const Z = kc({
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
        }), d("source")) : d("compare");
        return;
      }
      if (Z.kind === "open-committed-source") {
        if (ie.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: Z.revision,
          sessionIdentity: c
        }), d("source");
        return;
      }
      const fe = de();
      if (ie.isInactive()) return;
      b(fe), w(""), P(""), f(c);
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
            V = await le.fetchDocumentByJobId(Zr, t);
          } catch {
          }
          if (ie.isInactive()) return;
        }
      const me = gc(H.jobPayload) || `${(V == null ? void 0 : V.document_id) || ""}`.trim();
      me && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: me
      });
      const ye = Ic({
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
        }), d("source");
        return;
      }
      const Te = le.resolveReaderSourcePdf(H.manifestPayload), Ae = le.resolveReaderTranslatedPdfUrl(H.jobPayload, H.manifestPayload), ze = typeof Te == "string" ? Te : le.resolveReaderArtifactUrl(Te), He = r || me, Qe = l != null && l.documentId ? eo(
        l.documentId,
        l.revision
      ) : ze || (He ? le.resolveResourceUrl(Un(He)) : ""), $e = l ? "" : Ae || "";
      b(Qe || ""), w($e), P(bc(H.jobPayload, t)), m({
        jobPayload: H.jobPayload || null,
        manifestPayload: H.manifestPayload || null,
        sessionIdentity: c
      });
      const Ke = () => Oc({
        sourceFinal: Qe || "",
        translatedFinal: $e,
        fence: ie,
        setBoot: re
      }), et = !!(Qe || $e), tt = fe && et ? Ke() : null;
      tt == null || tt.catch(() => {
      });
      const St = (F) => {
        ie.isInactive() || (z(l ? [] : Ia(F.regionsPayload)), oe(l ? { source: null, translated: null } : pi(F.readerMetadata)), se(l ? sn : F.readerErrors ?? sn), j(!0));
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
        M(nt.sourceBytes), D(nt.translatedBytes), Y();
      }
    }
    async function Se() {
      I(!1), M(null), D(null), z([]), j(!1), oe({ source: null, translated: null }), se(sn), Sn(re, 8, Ve.metadata, "metadata");
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
        const Z = Number(ee == null ? void 0 : ee.status), fe = `${(ee == null ? void 0 : ee.reason) || ""}`, x = Pc({ status: Z, reason: fe, sessionJobId: t });
        if (x && (await Fc({
          apiPrefix: Zr,
          documentId: x,
          expiredJobId: t
        }) || ie.isClosedOrStale()))
          return;
        if (Ec({
          status: Z,
          reason: fe,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), d("source");
          return;
        }
        const H = ee instanceof Error ? ee.message : Ve.failed;
        W(H, H);
      }
    }
    return Se(), () => {
      ue.abort(), v.current === ue && (v.current = null);
    };
  }, [t, r, o, a, s, i, l, g, n, c, u, m, f, d]), {
    sourceUrl: S,
    translatedUrl: T,
    sourceFile: R,
    translatedFile: E,
    assetsReady: A,
    title: k,
    regions: $,
    regionsSettled: K,
    readerMetadata: J,
    readerErrors: q,
    boot: Ee
  };
}
function Hc() {
  const e = _(!1), t = _(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = hc(), s = _({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = _(a), c = _(""), l = _(""), u = _(() => {
  }), m = L(() => u.current(), []), f = pc({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: i,
    documentIdRef: c,
    sessionJobIdRef: l,
    switchToSourceMode: m
  }), {
    sessionJobId: d,
    documentId: g,
    sourceOnly: h,
    sourceViewOnly: y
  } = f, { mode: v, setMode: S, switchSessionMode: b } = Sc(y);
  u.current = () => {
    b("source");
  }, i.current = a, c.current = g, l.current = d;
  const T = vc({
    sessionJobId: d,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: w,
    scopedManifestPayload: R,
    jobStatus: M,
    jobTerminal: E,
    jobRefreshRevision: D,
    refreshJobArtifacts: A,
    refreshJobStatus: I
  } = T, k = Bc({
    sessionJobId: d,
    jobId: r,
    routeDocumentId: o,
    documentJobId: f.documentJobId,
    rejectedDocumentJobId: f.rejectedDocumentJobId,
    sourceOnly: h,
    locationKey: n,
    sessionIdentity: a,
    committedSource: f.activeCommittedDocumentSource,
    applyIdentityEvent: f.applyIdentityEvent,
    publishPayload: T.publishPayload,
    clearPayload: T.clearPayload,
    switchSessionMode: b,
    jobRefreshRevision: D,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), P = L(() => {
    var z;
    e.current = !0, (z = t.current) == null || z.abort();
  }, []), $ = U(
    () => ({
      fetchProtected: Ze().fetchProtected,
      jobId: d,
      jobPayload: w,
      manifestPayload: R,
      sourceUrl: k.sourceUrl,
      translatedUrl: k.translatedUrl,
      sourceOnly: y
    }),
    [d, w, R, k.sourceUrl, k.translatedUrl, y]
  );
  return {
    jobId: d,
    jobStatus: M,
    workflow: `${(w == null ? void 0 : w.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: E,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: h,
    mode: v,
    setMode: S,
    sourceUrl: k.sourceUrl,
    translatedUrl: k.translatedUrl,
    sourceFile: k.sourceFile,
    translatedFile: k.translatedFile,
    assetsReady: k.assetsReady,
    boot: k.boot,
    title: k.title,
    regions: k.regions,
    regionsSettled: k.regionsSettled,
    readerMetadata: k.readerMetadata,
    readerErrors: k.readerErrors,
    download: $,
    refreshJobArtifacts: A,
    refreshJobStatus: I,
    refreshCommittedDocument: f.refreshCommittedDocument,
    prepareClose: P
  };
}
const jc = 160, Uc = 8, Wc = 0;
function Kc() {
  const e = _(null), [t, n] = N(null), [r, o] = N(Wc), a = L((s) => {
    e.current = s, n(s);
  }, []);
  return O(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (l) => {
      !Number.isFinite(l) || l < jc || o((u) => Math.abs(u - l) < Uc ? u : l);
    }, c = new ResizeObserver((l) => {
      var u, m;
      i(((m = (u = l[0]) == null ? void 0 : u.contentRect) == null ? void 0 : m.width) ?? s.clientWidth);
    });
    return c.observe(s), i(s.clientWidth), () => c.disconnect();
  }, [t]), {
    shellRef: e,
    shellEl: t,
    shellWidth: r,
    bindShell: a
  };
}
function Vc(e) {
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
const _n = { source: 0, translated: 0 };
function qc(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    sourceUrl: a,
    translatedUrl: s,
    sourceFile: i,
    translatedFile: c
  } = e, l = `${(t == null ? void 0 : t.identityKey) || ""}\0${a}\0${s}`, u = _(l);
  u.current = l;
  const [m, f] = N(() => ({
    identity: l,
    pages: _n
  })), [d, g] = N(() => ({ identity: l, tick: 0 })), h = m.identity === l ? m.pages : _n, y = d.identity === l ? d.tick : 0, v = Vc({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: S } = v, b = L((I, k) => {
    u.current === l && f((P) => {
      const $ = P.identity === l ? P.pages : _n;
      return $[k] === I && P.identity === l ? P : {
        identity: l,
        pages: { ...$, [k]: I }
      };
    });
  }, [l]), T = _(null), w = L(() => {
    T.current && clearTimeout(T.current);
    const I = l;
    T.current = setTimeout(() => {
      T.current = null, u.current === I && g((k) => ({
        identity: I,
        tick: k.identity === I ? k.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  O(() => (T.current && (clearTimeout(T.current), T.current = null), f((I) => I.identity === l && I.pages.source === 0 && I.pages.translated === 0 ? I : { identity: l, pages: { source: 0, translated: 0 } }), g((I) => I.identity === l && I.tick === 0 ? I : { identity: l, tick: 0 }), () => {
    T.current && (clearTimeout(T.current), T.current = null);
  }), [l]);
  const R = U(
    () => Math.max(h.source, h.translated),
    [h]
  ), M = S === "translated" ? h.translated : h.source || h.translated, E = t == null ? void 0 : t.userZoom, D = t == null ? void 0 : t.shellWidth, A = `${l}-${y}-${E}-${n}-${h.source}-${h.translated}-${D}`;
  return {
    ...v,
    numPagesByPane: h,
    hudNumPages: R,
    primaryNumPages: M,
    metricsTick: y,
    onNumPages: b,
    onMetrics: w,
    rowSyncRevision: A
  };
}
const Ie = "data-reader-page", we = "data-reader-pane", gr = "data-natural-height", Ba = "reader-react-root", Ha = "reader-react-grid", ja = "reader-react-scroll-shell", rn = "reader-react-pdf-pane", Ua = "reader-react-pdf-page", Tn = "reader-react-pdf-page-placeholder", yr = "reader-react-pdf-page-slot";
function kn(e, t) {
  const n = e != null ? `[${Ie}="${e}"]` : `[${Ie}]`;
  return t ? `${n}[${we}="${t}"]` : n;
}
function br() {
  return `.${yr}[${Ie}]`;
}
function In(e) {
  return Number(e.getAttribute(Ie));
}
const Wa = 0.25, En = 1, Jc = 0.05, on = 0.5, Gc = 16, Xc = 8, Ka = Gc + Xc, Yc = 720;
function Pt() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function Va(e) {
  return Number.isFinite(e) && e < Yc;
}
function Et(e, t = Number.POSITIVE_INFINITY) {
  return Va(t) && (e === "source" || e === "translated") ? En : on;
}
function Xe(e) {
  return Number.isFinite(e) ? Math.min(En, Math.max(Wa, e)) : on;
}
function Yt(e, t) {
  const n = Xe(Number(e) + t * Jc);
  return Math.round(n * 100) / 100;
}
function Zc(e) {
  return Math.round(Xe(e) * 100);
}
function qa(e) {
  const n = (Number(e) || 0) - Ka;
  return Math.max(160, Math.floor(n));
}
function Qc(e, t = on) {
  const n = Xe(t);
  return qa((Number(e) || 0) * n);
}
function el(e, t) {
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
const tl = 8;
function nl(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < tl ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const Ja = 200, rl = [
  "markdown"
], ol = rl;
function Ga(e) {
  return ol.includes(e);
}
const al = "retainpdf:reader:view:v1:", ro = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), sl = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function Xa() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Gn(e) {
  return `${e || ""}`.trim();
}
function il({
  documentId: e,
  jobId: t
}) {
  const n = Gn(e);
  if (n) return `document:${n}`;
  const r = Gn(t);
  return r ? `job:${r}` : "";
}
function Ya(e) {
  const t = Gn(e);
  return t ? `${al}${t}` : "";
}
function cl(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function ll(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!ro.has(t) || !ro.has(n) || t === n))
    return { left: t, right: n };
}
function ul(e) {
  return e === null ? null : Ga(e) ? e : void 0;
}
function dl(e) {
  return sl.has(e) ? e : void 0;
}
function Za(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = cl(t.anchor), r = Number(t.zoom), o = dl(t.mode), a = ll(t.splitLayout), s = ul(t.assistantPanel);
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
function We(e, t = Xa()) {
  const n = Ya(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? Za(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function xn(e, t, n = Xa()) {
  const r = Ya(e);
  if (!r || !n) return null;
  const o = We(e, n), a = Za({
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
function fl(e, t, n = "") {
  var f;
  const [r, o] = N(() => {
    var d;
    return ((d = We(n)) == null ? void 0 : d.zoom) ?? Et(e, Pt());
  }), a = _(r), s = _(n);
  a.current = r;
  const i = _(1), c = _(((f = We(n)) == null ? void 0 : f.zoom) !== void 0);
  O(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const d = (h = We(n)) == null ? void 0 : h.zoom;
    c.current = d !== void 0;
    const g = d ?? Et(e, Pt());
    i.current = 1, a.current = g, o(g);
  }, [e, n]), O(() => {
    if (c.current) return;
    const d = Et(e, Pt()), g = a.current;
    Math.abs(d - g) < 5e-4 || (i.current = 1, a.current = d, o(d));
  }, [e]);
  const l = L((d, g) => {
    const h = Xe(d), y = a.current;
    Math.abs(h - y) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : h / (y || 1), a.current = h, c.current = !0, xn(s.current, { zoom: h }), o(h));
  }, []), u = L((d) => {
    l(Yt(a.current, d));
  }, [l]), m = L((d) => {
    l(Et(d));
  }, [l]);
  return Le(() => {
    const d = i.current;
    Math.abs(d - 1) < 1e-3 || (i.current = 1, el(t == null ? void 0 : t.current, d));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: m };
}
const ml = 160, hl = 3e-3, oo = 50, pl = 16, gl = 800;
function yl(e, t = 0) {
  const n = t === 1 ? pl : t === 2 ? gl : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-oo, Math.min(oo, r));
  return Math.exp(-o * hl);
}
function bl(e, t, n = 0) {
  return Xe(e * yl(t, n));
}
function vl(e) {
  return Math.round(Xe(e) * 100) / 100;
}
function wl(e, t, n) {
  const r = Xe(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return Xe(t) / r;
  const a = (o + Ka) / r;
  return qa(a * Xe(t)) / o;
}
function Sl(e) {
  return Array.from(e.querySelectorAll(br()));
}
function Tl(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function kl(e, t, n) {
  let r = null;
  for (const s of Sl(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const c = Tl(i, t, n);
    if ((!r || c < r.distance) && (r = { el: s, rect: i, distance: c }), c === 0) break;
  }
  if (!r) return null;
  const { el: o, rect: a } = r;
  return {
    page: o.getAttribute(Ie) || "",
    pane: o.getAttribute(we) || "",
    fracX: (t - a.left) / a.width,
    fracY: (n - a.top) / a.height,
    clientX: t,
    clientY: n,
    pageWidth: a.width
  };
}
function Il(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function Qa(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${br()}[${Ie}="${t.page}"][${we}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (Il(n, e).scrollLeft += a);
}
function El(e, t, n, r) {
  const o = e.querySelector(`.${Ha}`);
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
const Rl = 600, Pl = 1e3;
function Ml(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || Qa(e, t);
  });
  a.observe(n);
  const s = (u) => {
    u.type === "wheel" && u.ctrlKey || l();
  }, i = ["wheel", "keydown", "pointerdown", "touchstart"];
  for (const u of i) r.addEventListener(u, s, { capture: !0, passive: !0 });
  const c = r.setTimeout(() => l(), Pl);
  function l() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(c);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return l;
}
function xl(e, t, n) {
  const r = _(t);
  r.current = t;
  const o = _(n);
  o.current = n;
  const a = _(null), s = _(null), i = _(null);
  O(() => {
    if (!e) return;
    const c = () => {
      const u = a.current;
      if (a.current = null, !u) return;
      const m = vl(u.target);
      if (Math.abs(m - r.current) < 5e-3) {
        Dt(u.grid);
        return;
      }
      const f = { anchor: u.anchor, grid: u.grid, fallback: null };
      f.fallback = setTimeout(() => {
        s.current === f && (s.current = null, Dt(f.grid));
      }, Rl), s.current = f, o.current(m, { keepScroll: !1 });
    }, l = (u) => {
      var d, g;
      if (!u.ctrlKey) return;
      u.preventDefault();
      let m = a.current;
      if (!m) {
        (d = i.current) == null || d.call(i), i.current = null;
        const h = s.current;
        h && (h.fallback && clearTimeout(h.fallback), s.current = null, Dt(h.grid)), m = {
          start: r.current,
          target: r.current,
          anchor: kl(e, u.clientX, u.clientY),
          grid: null,
          timer: null
        }, a.current = m;
      }
      m.target = bl(m.target, u.deltaY, u.deltaMode);
      const f = wl(m.start, m.target, ((g = m.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      m.grid = El(e, f, u.clientX, u.clientY) ?? m.grid, m.timer && clearTimeout(m.timer), m.timer = setTimeout(c, ml);
    };
    return e.addEventListener("wheel", l, { passive: !1 }), () => {
      var m;
      e.removeEventListener("wheel", l);
      const u = a.current;
      a.current = null, u != null && u.timer && clearTimeout(u.timer), Dt((u == null ? void 0 : u.grid) ?? null), (m = i.current) == null || m.call(i), i.current = null;
    };
  }, [e]), Le(() => {
    var l;
    const c = s.current;
    c && (s.current = null, c.fallback && clearTimeout(c.fallback), Dt(c.grid), !(!e || !c.anchor) && (Qa(e, c.anchor), (l = i.current) == null || l.call(i), i.current = Ml(e, c.anchor)));
  }, [t, e]);
}
function Nl(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = _(t), a = _(n), s = _(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: L((c) => {
    c !== o.current && (s.current(), a.current(c));
  }, []) };
}
const vr = 56;
function es(e, t = vr) {
  return e.getBoundingClientRect().top + t;
}
function ts(e, t) {
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
      const m = u.getBoundingClientRect();
      return m.height >= 8 && m.width >= 8;
    });
    l && l.getBoundingClientRect().bottom < t && (n = l);
  }
  if (!n)
    return null;
  const o = In(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function Vt(e, t, n = vr) {
  if (!e)
    return null;
  const r = kn(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = es(e, n), i = ts(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function At(e, t, n = "auto", r, o = vr) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(kn(a, r))), i || (i = e.querySelector(kn(a))), !i)
    return !1;
  const c = e.getBoundingClientRect(), l = i.getBoundingClientRect();
  if (c.height <= 0 || l.height < 8 && i.offsetHeight < 8)
    return !1;
  const u = l.height > 0 ? l.height : i.offsetHeight, m = e.scrollTop + (l.top - c.top), f = Math.max(0, m + s * u - o);
  return n === "auto" ? Math.abs(e.scrollTop - f) >= 1 && (e.scrollTop = f) : e.scrollTo({ top: f, behavior: n }), !0;
}
function Al(e, t, n = "smooth", r) {
  return At(
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
    At(
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
function _l(e, t, n) {
  return Xn(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function Rn(e, t) {
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
function Ll(e, t, n = !0, r = "", o) {
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
    const m = kn(void 0, o), f = () => {
      if (c) return;
      const h = Array.from(i.querySelectorAll(m));
      if (!h.length)
        return;
      const y = es(i), v = ts(h, y);
      v && s(v.page);
    }, d = () => {
      c || (u && cancelAnimationFrame(u), u = requestAnimationFrame(() => {
        u = 0, f();
      }));
    }, g = () => {
      if (c) return;
      if (!Array.from(i.querySelectorAll(m)).length) {
        l = setTimeout(g, 120);
        return;
      }
      f(), i.addEventListener("scroll", d, { passive: !0 });
    };
    return g(), () => {
      c = !0, l && clearTimeout(l), u && cancelAnimationFrame(u), i.removeEventListener("scroll", d);
    };
  }, [e, t, n, r, o]), a;
}
const Cl = `canvas, .react-pdf__Page, .${Ua}, .${Tn}`, ao = /* @__PURE__ */ new WeakMap();
function $l(e) {
  const t = Number(e.getAttribute(gr));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = ao.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(Cl), ao.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Dl(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Ol(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(br()).forEach((r) => {
    const o = In(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = $l(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function zl(e, t, n = "", r) {
  const [o, a] = N(() => /* @__PURE__ */ new Map()), s = _(o), i = _(r);
  return i.current = r, Le(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let c = !1, l = 0, u = !1, m = !1;
    const f = () => {
      var w;
      if (c) return;
      const b = e.current;
      if (!b) return;
      const T = Ol(b);
      Dl(s.current, T) || (s.current = T, a(T)), u && !m && (m = !0, (w = i.current) == null || w.call(i));
    }, d = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(f);
      });
    };
    d();
    const g = window.setTimeout(d, 100), h = window.setTimeout(() => {
      u = !0, d();
    }, 300), y = window.setTimeout(d, 700), v = e.current;
    let S = null;
    return v && typeof ResizeObserver < "u" && (S = new ResizeObserver(() => d()), S.observe(v)), () => {
      c = !0, cancelAnimationFrame(l), window.clearTimeout(g), window.clearTimeout(h), window.clearTimeout(y), S == null || S.disconnect();
    };
  }, [e, t, n]), o;
}
const Fl = [0, 48, 140, 320, 560], Bl = 700, Hl = [80, 200, 400], jl = 500, Ul = 50, Wl = /* @__PURE__ */ new Set([
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
]), Kl = 180, so = [0, 48, 140, 320, 700, 1200];
function Vl(e, t) {
  var k;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = _(
    ((k = We(a)) == null ? void 0 : k.anchor) || { page: 1, fraction: 0 }
  ), c = _(null), l = _(!1), u = _(r), m = _(null), f = _(null), d = _(null), g = _(null), h = _(a), y = _(""), v = _(n);
  v.current = n;
  const S = L(() => {
    var P;
    (P = m.current) == null || P.call(m), m.current = null, f.current != null && (clearTimeout(f.current), f.current = null);
  }, []), b = L(() => {
    !l.current && c.current == null || (S(), d.current != null && (clearTimeout(d.current), d.current = null), c.current = null, l.current = !1);
  }, [S]), T = L((P = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const $ = () => {
      g.current = null, xn(h.current, {
        anchor: Fe(i.current)
      });
    };
    P ? $() : g.current = setTimeout($, Kl);
  }, []), w = L((P) => {
    i.current = Fe(P), c.current = null, d.current != null && clearTimeout(d.current), d.current = setTimeout(() => {
      d.current = null, l.current = !1;
    }, Ul);
  }, []);
  O(() => {
    if (!o)
      return;
    let P = !1, $ = null, z = null, K = null;
    const j = () => {
      if (P) return;
      const J = e.current;
      if (!J) {
        K = setTimeout(j, 50);
        return;
      }
      $ = J, z = () => {
        if (l.current)
          return;
        const oe = Vt($, v.current);
        oe && (i.current = oe, T());
      }, $.addEventListener("scroll", z, { passive: !0 }), l.current || z();
    };
    return j(), () => {
      P = !0, K != null && clearTimeout(K), $ && z && $.removeEventListener("scroll", z);
    };
  }, [o, r, n, e, T]), O(() => {
    if (!o) return;
    const P = e.current;
    if (!P) return;
    const $ = (z) => {
      z.metaKey || z.ctrlKey || z.altKey || Wl.has(z.key) && b();
    };
    return P.addEventListener("wheel", b, { passive: !0 }), P.addEventListener("touchmove", b, { passive: !0 }), window.addEventListener("keydown", $), () => {
      P.removeEventListener("wheel", b), P.removeEventListener("touchmove", b), window.removeEventListener("keydown", $);
    };
  }, [o, e, b]), Le(() => {
    var $;
    if (h.current === a) return;
    T(!0), S(), d.current != null && (clearTimeout(d.current), d.current = null), h.current = a, y.current = "";
    const P = ($ = We(a)) == null ? void 0 : $.anchor;
    i.current = P ? Fe(P) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, u.current = r;
  }, [a, r, T, S]), O(() => {
    var $;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const P = Fe(
      (($ = We(a)) == null ? void 0 : $.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = P, c.current = P, l.current = !0, S(), m.current = Xn(
      () => e.current,
      P,
      {
        behavior: "auto",
        pane: v.current,
        delaysMs: so,
        onDone: () => w(P)
      }
    ), f.current = setTimeout(() => {
      f.current = null, w(P);
    }, Math.max(...so) + 160), () => S();
  }, [o, s, a, e, w, S]), O(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, c.current = null, S();
      return;
    }
    const P = c.current ? Fe(c.current) : Fe(i.current);
    return l.current = !0, c.current = P, i.current = P, S(), m.current = Xn(
      () => e.current,
      P,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Fl,
        onDone: () => w(P)
      }
    ), f.current = setTimeout(() => {
      f.current = null, w(P);
    }, Bl), () => {
      S();
    };
  }, [r, o, n, e, w, S]), O(() => () => {
    S(), d.current != null && (clearTimeout(d.current), d.current = null), T(!0);
  }, [S, T]);
  const R = L(() => {
    const P = Vt(
      e.current,
      v.current
    );
    return Fe(P || i.current);
  }, [e]), M = L(() => {
    l.current = !0;
    const P = Vt(
      e.current,
      v.current
    ), $ = Fe(P ?? i.current);
    return i.current = $, c.current = $, T(), $;
  }, [e, T]), E = L((P, $, z) => {
    const K = z || v.current, j = Rn(P, $ || 1), J = { page: j, fraction: 0 };
    i.current = J, l.current = !0, c.current = J, T(), S(), Al(e.current, j, "smooth", K), m.current = _l(
      () => e.current,
      j,
      {
        behavior: "auto",
        pane: K,
        delaysMs: Hl,
        onDone: () => w(J)
      }
    ), f.current = setTimeout(() => {
      f.current = null, w(J);
    }, jl);
  }, [e, w, S, T]), D = L(() => Fe(i.current), []), A = L(() => l.current, []), I = L(() => {
    if (!l.current || !c.current)
      return;
    const P = Fe(c.current);
    At(
      e.current,
      P,
      "auto",
      v.current
    );
  }, [e]);
  return {
    lockFromShell: R,
    beginModeSwitch: M,
    goToPage: E,
    getAnchor: D,
    isRestoring: A,
    repinIfRestoring: I
  };
}
function ql(e, t) {
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
function ns(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const Jl = [0, 80, 200, 400, 800], Gl = 120, Xl = 400;
function Yl(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: c, documentId: l, regionsSettled: u = !0 } = e, m = _(a);
  m.current = a;
  const f = _(s);
  f.current = s;
  const d = _(i);
  d.current = i;
  const g = _(n);
  g.current = n, O(() => {
    var T, w;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = sc(), y = ql(h, f.current);
    if (y == null && (h != null && h.blockId) && !u) return;
    const v = ns(h, y, { jobId: c, documentId: l });
    if (t.current === v)
      return;
    if (y == null) {
      t.current = v, (T = g.current) == null || T.call(g);
      return;
    }
    t.current = v, h && ((w = d.current) == null || w.call(d, h, y));
    const S = [];
    let b = 0;
    for (const R of Jl)
      b = Math.max(b, R), S.push(
        setTimeout(() => {
          m.current(y);
        }, R)
      );
    return S.push(
      setTimeout(() => {
        var R;
        (R = g.current) == null || R.call(g);
      }, b + Gl)
    ), () => {
      for (const R of S) clearTimeout(R);
    };
  }, [r, o, c, l, t, u]);
}
function Zl(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function Ql(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = Xl,
    jobId: i,
    documentId: c,
    applyReaderSearch: l
  } = e, u = _(a);
  u.current = a;
  const m = _(l);
  m.current = l;
  const f = _(0);
  O(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || f.current === o) return;
    const d = setTimeout(() => {
      var v;
      const g = ((v = globalThis.location) == null ? void 0 : v.search) || "", h = hi(g, o, u.current);
      if (f.current = o, h === null) return;
      const y = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = ns(
        { blockId: y },
        o,
        { jobId: i, documentId: c }
      ), (m.current || Zl)(h);
    }, s);
    return () => clearTimeout(d);
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
function eu(e) {
  const t = _(""), [n, r] = N(!1), o = L(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  Yl(a, t, o), Ql(e, t, n);
}
const Ot = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function tu(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function io(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function rs(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = io(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = io(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function nu(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = rs(r, t, n);
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
function ru(e) {
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
function ou(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function au(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function su(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function iu(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const co = [250, 500, 1e3, 2e3, 4e3], Ln = [80, 160, 320, 640, 1e3, 1500], lo = [250, 500, 1e3, 2e3, 4e3, 5e3];
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
function wr(e) {
  return Si(e) ? `${e.code || ""}`.trim() : "";
}
function cn(e, t) {
  const n = wr(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function cu(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (rs(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
        return c;
      a = Ti(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (c) {
      if ((c == null ? void 0 : c.name) === "AbortError") throw c;
      a = c;
      const l = wr(c);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw c;
    }
    const i = Ln[Math.min(s, Ln.length - 1)];
    if (await Yn(i, r), s >= Ln.length + 2) throw a;
  }
}
function lu({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = N(Ot), s = _(o), i = _("");
  s.current = o;
  const c = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = Gt(l) ? l : "";
  return O(() => {
    if (!n || !c) {
      i.current = "", s.current = Ot, a(Ot);
      return;
    }
    const m = r === void 0 ? ac() : r, f = i.current === c;
    if (i.current = c, !m) {
      const b = {
        ...f ? s.current : Ot,
        connection: u ? "terminal" : "unavailable",
        jobStatus: l,
        error: "实时译文暂不可用"
      };
      s.current = b, a(b);
      return;
    }
    const d = new AbortController();
    let g = !1;
    const h = {
      ...f ? s.current : Ot,
      connection: u ? "terminal" : "connecting",
      jobStatus: l,
      error: ""
    };
    s.current = h, a(h);
    const y = (b) => {
      d.signal.aborted || a((T) => {
        const w = b(T);
        return s.current = w, w;
      });
    }, v = async () => {
      let b = 0;
      for (; !d.signal.aborted; )
        try {
          const T = await m.fetchLayout(c, { signal: d.signal });
          g = !0, y((w) => ({
            ...w,
            layoutByPage: tu(T),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (T) {
          if ((T == null ? void 0 : T.name) === "AbortError") return;
          const w = wr(T);
          if (!(w === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !w)) {
            y((M) => ({
              ...M,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: cn(T, "实时译文暂不可用")
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
            error: cn(T, "正在等待 OCR 版面数据")
          })), await Yn(co[Math.min(b, co.length - 1)], d.signal).catch(() => {
          }), b += 1;
        }
    };
    return (async () => {
      if (await v(), !g || d.signal.aborted) return;
      let b = 0;
      for (; !d.signal.aborted; ) {
        u || y((T) => ({
          ...T,
          connection: T.lastSeq > 0 ? "reconnecting" : "connecting",
          jobStatus: l,
          // 保留已有错误：首页还没提交（lastSeq 为 0）时恰恰是最容易出错的阶段，
          // 此前这里把它清成空串，UI 于是一直显示「连接中」，用户看到的是
          // "正在努力"，实际可能已经在反复失败。
          error: T.error
        }));
        try {
          await m.streamEvents(c, {
            afterSeq: s.current.lastSeq,
            signal: d.signal,
            onEvent: async (T) => {
              if (T.seq <= s.current.lastSeq) return;
              let w;
              try {
                w = await cu(
                  c,
                  T,
                  s.current,
                  d.signal,
                  m
                );
              } catch (R) {
                if ((R == null ? void 0 : R.name) === "AbortError" || d.signal.aborted) throw R;
                y((M) => ({
                  ...M,
                  lastSeq: Math.max(M.lastSeq, T.seq),
                  error: cn(R, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((R) => {
                const M = nu(R, T, w);
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
        } catch (T) {
          if ((T == null ? void 0 : T.name) === "AbortError" || d.signal.aborted) return;
          y((w) => ({
            ...w,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: l,
            error: cn(T, "实时译文连接已中断，正在重连")
          }));
        }
        if (d.signal.aborted) return;
        if (u) {
          y((T) => ({
            ...T,
            connection: "terminal",
            jobStatus: l
          }));
          return;
        }
        await Yn(lo[Math.min(b, lo.length - 1)], d.signal).catch(() => {
        }), b += 1;
      }
    })(), () => d.abort();
  }, [n, r, c, u]), o;
}
function uu(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), c = Number(s.count) || 0;
    i && c > 0 && o.set(i, c);
  }
  return o;
}
function du(e, t = !0) {
  const [n, r] = N(() => /* @__PURE__ */ new Map());
  return O(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = Ze().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(uu(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const fu = 4500;
function mu(e) {
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
const hu = /* @__PURE__ */ new Set(["book", "translate"]);
function os(e) {
  return !!(e.jobId && e.sourceUrl && hu.has(e.workflow));
}
function pu(e) {
  return !!(os(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function gu() {
  const e = Hc(), t = os({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = pu({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = _({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Gt(o) && (r.current.running = !0);
  const a = lu({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = Kc(), u = du(e.jobId, !e.sourceOnly), m = il({
    documentId: e.documentId,
    jobId: e.jobId
  }), f = `${m}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: d, onZoomChange: g } = fl(e.mode, s, m);
  xl(i, d, g);
  const h = qc(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: d, shellWidth: c, identityKey: f }
  ), {
    beginModeSwitch: y,
    goToPage: v,
    repinIfRestoring: S
  } = Vl(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: m,
    restoreReady: h.primaryNumPages > 0
  });
  O(() => {
    S();
  }, [c, S]);
  const b = zl(
    s,
    h.compareMode,
    h.rowSyncRevision,
    S
  ), T = Ll(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${d}-${h.metricsTick}`,
    h.primaryPane
  ), w = L((j, J) => {
    var q, se;
    const oe = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((q = h.numPagesByPane) == null ? void 0 : q.source) || 0,
      Number((se = h.numPagesByPane) == null ? void 0 : se.translated) || 0
    );
    v(j, oe, J);
  }, [v, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [R, M] = N(null), E = _(null), D = L((j) => {
    E.current && clearTimeout(E.current), M(j), j && (E.current = setTimeout(() => M(null), fu));
  }, []);
  O(() => () => {
    E.current && clearTimeout(E.current);
  }, []);
  const A = L((j) => {
    const J = An(e.regions, j);
    return J ? Xr(J, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), I = L((j, J) => {
    const oe = J || h.primaryPane, q = typeof j == "object" && j ? `${j.block_id || ""}`.trim() : "", se = typeof j == "object" && j ? `${j.image_url || ""}`.trim() : "", Ee = typeof j == "object" && j ? j.page_idx != null ? Number(j.page_idx) + 1 : j.page != null ? Number(j.page) : null : typeof j == "number" ? j + 1 : null, re = gi(e.regions, se, Ee) || An(e.regions, q) || (typeof j == "object" ? yi(e.regions, j) : null);
    let ue = re ? Xr(re, oe).page : null;
    ue == null && (ue = mu(j)), !(ue == null || ue < 1) && (D(re), w(ue, oe));
  }, [D, w, h.primaryPane, e.regions]);
  eu({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: T,
    goToPage: w,
    resolveBlockPage: A,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (j) => {
      D(An(e.regions, j.blockId));
    }
  });
  const { setModeKeepingPage: k } = Nl({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: y
  });
  O(() => {
    D(null);
  }, [f, D]);
  const P = !e.boot.loading && !e.boot.failed, $ = U(() => ({ bindShell: l, shellEl: i, shellWidth: c, shellRef: s }), [l, i, c, s]), z = U(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), K = U(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: d,
    onZoomChange: g,
    shell: $,
    panes: h,
    sessionFiles: z,
    rowHeights: b,
    goToPage: w,
    activeRegion: R,
    jumpToAnchor: I,
    setModeKeepingPage: k,
    download: e.download,
    showHud: P,
    viewStateKey: m,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, $, h, z, b, w, R, I, k, P, d, g, m, a, n, u]);
  return U(() => ({
    ...K,
    currentPage: T
  }), [K, T]);
}
const yu = [
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
], bu = [
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
function vu(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of yu)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function wu(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const Su = ".reader-notes-panel";
function Tu(e) {
  return e instanceof Element ? !!e.closest(Su) : !1;
}
function ku(e) {
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
    const m = (f) => {
      if (f.defaultPrevented || f.metaKey || f.ctrlKey || f.altKey || wu(f.target) || Tu(f.target))
        return;
      const d = f.key, g = vu(d);
      if (g) {
        if (g.mode) {
          if (n && g.mode !== "source")
            return;
          f.preventDefault(), r(g.mode);
          return;
        }
        if (g.action === "doc-dark") {
          if (!l || f.repeat) return;
          f.preventDefault(), l();
          return;
        }
        if (!(g.requiresPages && i <= 0))
          switch (f.preventDefault(), g.action) {
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
              c(Rn(s + 1, i));
              return;
            case "prev-page":
              c(Rn(s - 1, i));
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
    return window.addEventListener("keydown", m), () => window.removeEventListener("keydown", m);
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
const Pe = { size: 16, strokeWidth: 1.75 }, uo = { size: 12, strokeWidth: 1.75 }, Iu = "retainpdf:soft-reader-close";
function Eu() {
  return new URL("./index.html", window.location.href).href;
}
function Ru() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Iu },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Pu(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Mu() {
  if (!(typeof window > "u") && !Ru()) {
    if (Pu(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Eu());
  }
}
function xu({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function Nu({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ C(xu, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Mu();
  }, children: [
    /* @__PURE__ */ p(Ea, { className: "reader-close-home-icon", ...Pe, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "返回" })
  ] });
}
const Au = 3e3, _u = 8;
async function Lu(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function Cu(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function $u(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = Au;
  const r = [], o = (s, i, c) => {
    const l = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const m = s[u], f = Cu(m == null ? void 0 : m.title);
      if (!f) continue;
      n -= 1;
      const d = c ? `${c}.${u}` : `${u}`, g = { id: d, title: f, page: null, level: i, children: [] };
      r.push({ node: g, dest: m.dest }), l.push(g), i < _u && Array.isArray(m.items) && m.items.length && (g.children = o(m.items, i + 1, d));
    }
    return l;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await Lu(e, i);
  })), a;
}
function as(e) {
  const t = [], n = (r) => {
    for (const o of r)
      t.push(o), n(o.children);
  };
  return n(e), t;
}
function Du(e, t) {
  let n = null;
  for (const r of as(e))
    r.page === null || r.page > t || (!n || r.page > (n.page ?? 0) || r.page === n.page && r.id.startsWith(`${n.id}.`)) && (n = r);
  return (n == null ? void 0 : n.id) ?? null;
}
let fo = !1;
function Ou() {
  if (fo)
    return;
  const e = Xt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (Oa.GlobalWorkerOptions.workerSrc = e, fo = !0);
}
const st = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), zu = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Fu = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Bu = {
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
}, mo = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function Hu(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => mo(o ?? a ?? "", zu)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => mo(o ?? a ?? "", Fu)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Bu[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function ju(e) {
  return st(e.translatedBlockText) || st(e.translated.text) || st(e.source.text);
}
const Uu = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Wu(e) {
  const t = [];
  for (const n of e) {
    if (!Uu(n)) continue;
    const r = Hu(ju(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
const Ku = 24, Vu = 60;
function ho(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - Ku), o = Math.min(e.length, n + t.length + Vu), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function qu(e, t, n = 200) {
  const r = st(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = st(a.translatedBlockText) || st(a.translated.text), c = i ? ho(i, r) : null, l = c ?? ho(st(a.source.text), r);
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
function Ju(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const Gu = /^data-[a-z0-9-]+$/;
function po(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function Xu(e, t, n = "") {
  if (!t.length) return jt(e, n);
  const r = t.filter((s) => s.end > s.start && s.start >= 0 && s.end <= e.length).map((s, i) => ({ mark: s, order: i })).sort((s, i) => s.mark.start - i.mark.start || s.order - i.order).map(({ mark: s }) => s);
  let o = "", a = 0;
  for (const s of r) {
    if (s.start < a) continue;
    o += jt(e.slice(a, s.start), n);
    const i = Object.entries(s.attrs ?? {}).filter(([c]) => Gu.test(c)).map(([c, l]) => ` ${c}="${po(l)}"`).join("");
    o += `<mark class="${po(s.className)}"${i}>${jt(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  }
  return o + jt(e.slice(a), n);
}
function ve(e) {
  return typeof e == "string" ? e : "";
}
function Yu(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function Zu(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function Qu(e) {
  return {
    source: ve(e == null ? void 0 : e.source_text) || ve(e == null ? void 0 : e.unit_source_text),
    translated: ve(e == null ? void 0 : e.protected_translated_text) || ve(e == null ? void 0 : e.translated_text)
  };
}
const ed = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function ss(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function td(e) {
  const t = ss(e).sort((r, o) => ve(r.ts).localeCompare(ve(o.ts)));
  return t.length ? [
    { text: ve(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: ve(r.new_text),
      label: ed[ve(r.source)] || ve(r.source) || "修订",
      ts: ve(r.ts),
      reason: ve(r.reason)
    }))
  ].reverse() : [];
}
function nd(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function rd(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return ve(r.finished_at) || ve(n.finished_at) || "";
}
function od(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = ss(e).sort((a, s) => ve(a.ts).localeCompare(ve(s.ts)));
  for (const a of o) {
    const s = new Date(ve(a.ts)).getTime(), i = ve(a.reader_item_id) || ve(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, ve(a.new_text));
  }
  return n;
}
const ad = {
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
function sd(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = ad[ve(n.kind)] || ve(n.kind) || "问题", o = ve(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const id = /* @__PURE__ */ new Set(["text", "formula"]);
function Sr(e) {
  return id.has(e);
}
function is(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || Sr(Ce(n));
}
function cd(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !Sr(Ce(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const ld = 300, ud = 72;
function dd(e, t) {
  if (e.width >= ld && e.height >= ud)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const fd = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function md(e, t, n) {
  return e.flatMap((r) => {
    if (!fd.has(Ce(r.region))) return [];
    const o = lt(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function go(e, t, n) {
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
async function hd(e) {
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
const pd = "reader-text-hover-copy", gd = "reader-text-hover-edit", yd = "reader-text-hover-zoom", bd = "reader-text-hover-id";
function vd(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const cs = "reader-text-hover-tools";
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
const wd = 26, Sd = 220;
function Td(e, t = Sd) {
  return e.height < wd * 2 || e.width < t;
}
function kd({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? hr : e === "failed" ? bt : Ra, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function Id({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  onZoom: o,
  frameRect: a,
  placement: s,
  tailTop: i = 0
}) {
  const [c, l] = N("idle"), [u, m] = N("idle"), [f] = N(() => vd()), d = _([]), g = (e == null ? void 0 : e.itemId) || "";
  if (O(() => {
    l("idle"), m("idle");
    const w = d.current;
    return () => {
      w.forEach((R) => window.clearTimeout(R)), d.current = [];
    };
  }, [g]), !e) return null;
  const h = bi(e.highlight.region, t), y = Ce(e.highlight.region), v = (w, R) => async (M) => {
    M.preventDefault(), M.stopPropagation();
    const E = await hd(w);
    R(E ? "copied" : "failed"), d.current.push(window.setTimeout(() => R("idle"), 1200));
  }, S = y === "formula" ? "复制 LaTeX" : "复制", b = a || e.rect, T = s || (Td(b) ? "outside" : "inside");
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
          className: cs,
          "data-placement": T,
          style: T === "tail" ? { top: i } : void 0,
          children: [
            f ? /* @__PURE__ */ p(
              un,
              {
                className: bd,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: v(e.itemId, m),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && Sr(y) ? /* @__PURE__ */ p(
              un,
              {
                className: gd,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (w) => {
                  w.preventDefault(), w.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ p(vn, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            h ? /* @__PURE__ */ p(
              un,
              {
                className: pd,
                state: c,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: c === "copied" ? "已复制" : c === "failed" ? "复制失败" : S,
                onClick: v(h, l),
                children: /* @__PURE__ */ p(kd, { state: c })
              }
            ) : null,
            o ? /* @__PURE__ */ p(
              un,
              {
                className: yd,
                state: "idle",
                label: "放大看这一块",
                title: y === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (w) => {
                  w.preventDefault(), w.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ p(Ii, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Ed(e, t) {
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
function Rd(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = lt(
      Ed(e, a),
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
const Pd = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Md = 256, zt = /* @__PURE__ */ new Map();
function xd(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function ls(e) {
  const t = `${e || ""}`, { text: n, slots: r } = Ji(t, { bareLatex: !0 }), o = xd(n), a = Gi(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = zt.get(t);
  if (!s && (s = Xi(o, r), zt.set(t, s), zt.size > Md)) {
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
function Nd(e, t) {
  const n = e.typography, r = Je(t) || 1, o = Je(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = Cn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(s, i * r)), l = Je(n == null ? void 0 : n.fit_min_font_size_pt), u = Je(n == null ? void 0 : n.fit_max_font_size_pt), m = Math.max(3.5, (l || 5.5) * r), f = Math.max(
    m,
    u ? u * r : o ? o * r : c
  ), d = o ? o * r : c, g = Je(n == null ? void 0 : n.leading_em), h = [
    Je(n == null ? void 0 : n.padding_top_pt) || 0,
    Je(n == null ? void 0 : n.padding_right_pt) || 0,
    Je(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Je(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((y) => y * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Pd,
    fontSizePx: Math.max(m, Math.min(f, d)),
    minFontSizePx: m,
    maxFontSizePx: f,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (Cn(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : Cn(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function Ad(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), i = (m) => {
    const f = s.get(m);
    if (f !== void 0) return f;
    const { width: d, height: g } = e(m), h = d <= t + 0.5 && g <= n + 0.5;
    return s.set(m, h), h;
  };
  let c = o, l = a, u = Math.min(r.requestedFontSizePx, l);
  if (i(u)) {
    if (!r.exact) {
      c = u;
      for (let m = 0; m < 6 && l > c; m += 1) {
        const f = (c + l) / 2;
        i(f) ? (u = f, c = f) : l = f;
      }
    }
  } else {
    l = u, u = c;
    for (let m = 0; m < 8 && l > c; m += 1) {
      const f = (c + l) / 2;
      i(f) ? (u = f, c = f) : l = f;
    }
  }
  return Math.max(o, u);
}
const _d = 512, Ft = /* @__PURE__ */ new Map();
let Zn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Zn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Zn += 1;
}));
function Ld(e, t, n, r) {
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
function Tr({ item: e, pageScale: t }) {
  const n = _(null), r = U(
    () => ls(e.translatedText),
    [e.translatedText]
  ), [o, a] = N(r.fallbackHtml), s = U(
    () => Nd(e, t),
    [e, t]
  );
  O(() => {
    let m = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((f) => {
      m && a(f);
    }), () => {
      m = !1;
    };
  }, [r]), Le(() => {
    const m = n.current;
    if (!m) return;
    const [f, d, g, h] = s.padding, y = Math.max(1, e.rect.width - h - d), v = Math.max(1, e.rect.height - f - g), S = Ld(o, y, v, s);
    let b = Ft.get(S);
    if (b === void 0 && (b = Ad(
      (T) => (m.style.fontSize = `${T}px`, { width: m.scrollWidth, height: m.scrollHeight }),
      y,
      v,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), Ft.set(S, b), Ft.size > _d)) {
      const T = Ft.keys().next().value;
      T !== void 0 && Ft.delete(T);
    }
    m.style.fontSize = `${b.toFixed(2)}px`;
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
function Cd({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = U(
    () => Rd(e, t, n, r),
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
        Tr,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const $d = tn(Cd);
function Dd({
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
        Tr,
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
const Od = tn(Dd), us = 24, ot = us * 2 + 4, Ge = 24, zd = 4, Fd = 6, ht = (e) => e.left + e.width, ct = (e) => e.top + e.height;
function Ut(e, t) {
  const n = Math.min(ht(e), ht(t)) - Math.max(e.left, t.left), r = Math.min(ct(e), ct(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const yo = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= ht(t) && r >= t.top && r <= ct(t);
}, Bd = (e) => e.height > 40 && e.height > e.width * 2.5;
function Hd(e, t, n) {
  if (!t.length || e.height < Ge || e.width < n + 8) return null;
  const r = Math.max(...t.map(ct)), o = ht(e) - 4 - n;
  for (const a of [r, ct(e) - 2]) {
    const s = Math.max(e.top, a - Ge), i = { left: o, top: s, width: n, height: Ge };
    if (!t.some((c) => Ut(i, c) > 0)) return s - e.top;
  }
  return null;
}
function jd(e, t) {
  const n = [], r = (a) => {
    const s = us + zd, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: ht(e), top: i, width: s, height: ot } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: ot } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - Ge - 3, width: ot, height: Ge + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: ct(e), width: ot, height: Ge + 3 } }), r(!0);
  const o = Hd(e, t, ot);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: ht(e) - 4 - ot, top: e.top + o, width: ot, height: Ge } }), n;
}
function Ud(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((S) => S.width > 0 && S.height > 0 && !Bd(S)), i = s.filter((S) => yo(S, t)), c = s.filter((S) => !yo(S, t)), l = n.filter((S) => S !== t && Ut(S, t) < t.width * t.height * 0.5), u = jd(t, i).filter(({ box: S, overhang: b }) => {
    const T = b ? Fd : 0;
    return S.left >= -T && ht(S) <= r + T && S.top >= 0 && ct(S) <= o;
  }), m = ({ placement: S, tailTop: b }) => b === void 0 ? { placement: S } : { placement: S, tailTop: b }, f = ({ box: S }) => !c.some((b) => Ut(S, b) > 0), d = u.filter((S) => S.placement !== "tail"), g = d.find((S) => f(S) && !l.some((b) => Ut(S.box, b) > 0));
  if (g) return m(g);
  const h = d.find(f) || u.find((S) => S.placement === "tail" && f(S));
  if (h) return m(h);
  let y = null, v = Number.POSITIVE_INFINITY;
  for (const S of u) {
    const b = c.reduce((T, w) => T + Ut(S.box, w), 0);
    b < v && (y = S, v = b);
  }
  return y ? m(y) : { placement: "outside" };
}
function Wd(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - Ge - 3 : ct(r);
  return t >= r.left - 4 && t <= r.left + ot + 4 && n >= a && n <= a + Ge + 3;
}
const $n = (e) => e.left + e.width, Dn = (e) => e.top + e.height;
function Kd(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const l of t) {
    if (l.width <= 0 || l.height <= 0) continue;
    const u = l.left + l.width / 2, m = l.top + l.height / 2;
    u < e.left || u > $n(e) || m < e.top || m > Dn(e) || (o = Math.min(o, l.left), a = Math.min(a, l.top), s = Math.max(s, $n(l)), i = Math.max(i, Dn(l)));
  }
  if (!Number.isFinite(o)) return e;
  const c = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return c.width = Math.min($n(e) + r, s + n) - c.left, c.height = Math.min(Dn(e) + r, i + n) - c.top, c.width * c.height < e.width * e.height * 0.3 && c.height < 24 ? e : c;
}
function Vd(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function qd(e, t, n, r) {
  const [o, a] = N(null);
  return Le(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? Vd(s) : [], c = Ce(t.highlight.region) === "figure", l = i.length && !c ? Kd(t.rect, i) : t.rect, u = n.filter((f) => f.itemId !== t.itemId).map((f) => f.rect), m = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...Ud({ frame: l, others: u, pageWidth: r, pageHeight: m, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
function Jd({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = N(null), [i, c] = N(!1), [l, u] = N([]), [m, f] = N(""), [d, g] = N(""), [h, y] = N(!1), [v, S] = N(null), [b, T] = N([]), w = r.drafts, R = r.generation, M = L(async (I, k) => {
    if (e)
      try {
        u(td(await e.fetchRevisions(I, k)));
      } catch {
        u([]);
      }
  }, [e]);
  O(() => {
    if (s(null), u([]), S(null), T([]), g(""), !e || !t || !n) return;
    let I = !1;
    return c(!0), e.loadItem(t, n).then((k) => {
      if (I) return;
      const P = k == null ? void 0 : k.item;
      if (!P) throw new Error("找不到这一段的译文。");
      const $ = `${(k == null ? void 0 : k.item_id) || n}`, { source: z, translated: K } = Qu(P);
      s({ readerItemId: n, itemId: $, source: z, current: K }), f(w.get(n) ?? K);
    }).catch((k) => {
      I || S({ tone: "error", message: (k == null ? void 0 : k.message) || "读取这段译文失败。" });
    }).finally(() => {
      I || c(!1);
    }), M(t, n), () => {
      I = !0;
    };
  }, [e, t, n, M]);
  const E = L((I) => {
    f(I), n && w.set(n, I);
  }, [n, w]), D = L(async (I, k) => {
    if (!e || !a || h) return !1;
    const P = I ?? m;
    if (!P.trim()) return !1;
    y(!0), S(null), T([]);
    try {
      const $ = await e.revise(t, a.itemId, {
        translated_text: P,
        source: "user",
        reason: (k ?? d).trim() || "在阅读页手动修改",
        ...R.current != null ? { expected_generation: R.current } : {}
      }), z = Number($ == null ? void 0 : $.generation);
      return Number.isFinite(z) && (R.current = z), w.delete(a.readerItemId), s({ ...a, current: P }), f(P), g(""), ($ == null ? void 0 : $.changed) === !1 ? S({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, P), S({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), M(t, a.readerItemId), !0;
    } catch ($) {
      const z = $;
      return (z == null ? void 0 : z.reason) === "generation_mismatch" && (R.current = null), S({ tone: "error", message: (z == null ? void 0 : z.message) || "保存失败，请稍后再试。" }), T(sd(z == null ? void 0 : z.issues)), !1;
    } finally {
      y(!1);
    }
  }, [e, a, h, m, d, t, o, M, w, R]), A = L(() => {
    n && w.delete(n);
  }, [n, w]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: l,
    draft: m,
    setDraft: E,
    reason: d,
    setReason: g,
    saving: h,
    status: v,
    issues: b,
    save: D,
    discardDraft: A
  };
}
const ds = "reader-inline-edit";
function Gd({ text: e }) {
  const [t, n] = N("");
  return O(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = ls(e);
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
function Xd({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var A;
  const s = e.itemId, i = Jd({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = N(!1), [u, m] = N(!1), f = _(null), d = dd(e.rect, t), g = U(() => cd(o), [o]), h = g.indexOf(s), { loaded: y } = i, v = i.saving || i.loading, S = n.blockedReason, b = !y || i.draft === y.current, { close: T, select: w } = n, R = L((I) => {
    const k = g[h + I];
    k && (w(k), a == null || a(k));
  }, [g, h, w, a]), M = L(() => {
    i.discardDraft(), T();
  }, [i, T]), E = L(async (I, k) => {
    await i.save(I, k) && T();
  }, [i, T]);
  O(() => {
    const I = (k) => {
      !k.altKey || k.key !== "ArrowUp" && k.key !== "ArrowDown" || (k.preventDefault(), R(k.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", I), () => window.removeEventListener("keydown", I);
  }, [R]), Le(() => {
    const I = f.current;
    if (!I) return;
    I.style.height = "auto";
    const k = d.mode === "inline" ? d.minHeight : 0;
    I.style.height = `${Math.max(k, I.scrollHeight + 2)}px`;
  }, [i.draft, y, d.mode, d.mode === "inline" ? d.minHeight : 0]);
  const D = d.mode === "inline" ? { left: d.left, top: d.top, width: d.width } : { left: d.left, width: d.width, top: d.top, bottom: d.bottom };
  return /* @__PURE__ */ C(Ne, { children: [
    d.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ C(
      "div",
      {
        className: `${ds} is-${d.mode}`,
        style: D,
        role: "group",
        "aria-label": `改第 ${((A = n.target) == null ? void 0 : A.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": d.mode,
        onPointerDown: (I) => I.stopPropagation(),
        children: [
          r && (y != null && y.source) ? /* @__PURE__ */ p(
            G,
            {
              className: `reader-inline-edit-source${c ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: c ? "收起原文" : "展开原文",
              onClick: () => l((I) => !I),
              children: y.source
            }
          ) : null,
          S ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: S }) : null,
          i.loading ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          y ? /* @__PURE__ */ p(
            qi,
            {
              ref: f,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: v || !!S,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (I) => i.setDraft(I.target.value),
              onKeyDown: (I) => {
                I.key === "Enter" && (I.metaKey || I.ctrlKey) ? (I.preventDefault(), b || E()) : I.key === "Escape" && (I.preventDefault(), M());
              }
            }
          ) : null,
          y ? /* @__PURE__ */ p(Gd, { text: i.draft }) : null,
          /* @__PURE__ */ C("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(dt, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => R(-1), children: /* @__PURE__ */ p(Ei, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(dt, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= g.length - 1, onClick: () => R(1), children: /* @__PURE__ */ p(wn, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              pr,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: v || !!S || !y,
                onChange: (I) => i.setReason(I.target.value),
                onKeyDown: (I) => {
                  I.key === "Enter" ? (I.preventDefault(), b || E()) : I.key === "Escape" && (I.preventDefault(), M());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ C(
              G,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": u,
                "data-block-edit-action": "history",
                onClick: () => m((I) => !I),
                children: [
                  /* @__PURE__ */ p(Ri, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ p(G, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: M, children: "取消" }),
            /* @__PURE__ */ p(
              G,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: v || !!S || b || !i.draft.trim(),
                pending: i.saving,
                onClick: () => {
                  E();
                },
                children: "保存"
              }
            )
          ] }),
          i.status ? /* @__PURE__ */ p("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ p("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((I) => /* @__PURE__ */ p("li", { children: I }, I)) }) : null,
          u && y && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((I, k) => {
            const P = I.text === y.current, $ = [nd(I.ts), I.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ C("li", { "data-block-edit-history": I.label, "data-current": P ? "true" : void 0, children: [
              /* @__PURE__ */ C("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ C("span", { children: [
                  $,
                  P ? "（现在用的）" : "",
                  I.reason ? ` · ${I.reason}` : ""
                ] }),
                P ? null : /* @__PURE__ */ p(
                  G,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: v || !!S,
                    onClick: () => {
                      E(I.text, `回到「${$.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ p("p", { className: "reader-inline-edit-history-text", children: I.text })
            ] }, `${I.ts}:${k}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const fs = nn(null), ms = nn(null);
function Yd({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(fs.Provider, { value: e, children: /* @__PURE__ */ p(ms.Provider, { value: t, children: n }) });
}
function Be() {
  return ft(fs);
}
function kr() {
  return ft(ms);
}
const hs = 1.414;
function Zd({
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
  regionHighlight: m = null,
  regionTargets: f = [],
  hoveredRegionId: d,
  onHoverRegion: g,
  liveTranslationLayout: h,
  liveTranslationPage: y,
  showLiveTranslation: v = r === "source",
  liveTranslationMissing: S = !1
}) {
  var Z, fe;
  const b = Be(), T = b == null ? void 0 : b.revisedBlocks, w = b == null ? void 0 : b.blockEdit, R = w == null ? void 0 : w.pendingEdits, M = b == null ? void 0 : b.editBlock, E = (b == null ? void 0 : b.findTerm) || "", D = r === "translated" ? "translated" : b != null && b.compareVersion ? "compare" : "source", A = b == null ? void 0 : b.textMarks, I = U(
    () => A ? ({ str: x }) => Xu(x, A(x), E) : E ? ({ str: x }) => jt(x, E) : void 0,
    [E, A]
  ), k = _(c ?? hs), [P, $] = N(k.current);
  O(() => {
    c != null && Math.abs(c - k.current) >= 1e-3 && (k.current = c, $(c));
  }, [c]);
  const z = _(u);
  z.current = u;
  const K = _(null), j = _((x) => {
    var H;
    K.current = x, (H = z.current) == null || H.call(z, x);
  }).current, J = _(null), oe = _(`${t}@${n}`);
  Le(() => {
    const x = `${t}@${n}`;
    oe.current !== x && (oe.current = x, o && ef(K.current, J.current));
  }, [o, n, t]), O(() => {
    o || On(J.current);
  }, [o]), O(() => () => On(J.current), []);
  const q = Math.max(120, Math.floor(t * P)), se = Math.max(q, Math.ceil(s || 0)), Ee = lt(m, t, q), re = U(
    () => md(f, t, q),
    [q, f, t]
  ), [ue, Me] = N(null), ie = typeof g == "function", le = ie ? d ?? null : ue, B = (x) => {
    ie ? x !== (d ?? null) && (g == null || g(x)) : Me((H) => H === x ? H : x);
  }, W = U(
    () => re.find((x) => x.itemId === le) || null,
    [le, re]
  ), Y = r === "translated" && ((Z = w == null ? void 0 : w.target) == null ? void 0 : Z.itemId) || "", de = U(
    () => Y && re.find((x) => x.itemId === Y) || null,
    [Y, re]
  ), ne = qd(K, o ? W : null, re, t), ae = (x) => {
    var Te, Ae, ze, He;
    if (x.pointerType === "touch") return;
    if (b != null && b.pointerTaken) {
      B(null);
      return;
    }
    if (x.buttons !== 0) {
      B(null);
      return;
    }
    if ((Ae = (Te = x.target) == null ? void 0 : Te.closest) != null && Ae.call(Te, `.${cs}`) || (He = (ze = x.target) == null ? void 0 : ze.closest) != null && He.call(ze, `.${ds}`)) return;
    const H = x.currentTarget.getBoundingClientRect(), V = x.clientX - H.left, me = x.clientY - H.top;
    if (Wd(ne, V, me)) return;
    const ye = go(re, V, me);
    B((ye == null ? void 0 : ye.itemId) || null);
  }, Se = (x) => {
    if (x.pointerType === "mouse") return;
    const H = x.currentTarget.getBoundingClientRect(), V = go(
      re,
      x.clientX - H.left,
      x.clientY - H.top
    );
    B((V == null ? void 0 : V.itemId) || null);
  }, ee = (x) => {
    !Number.isFinite(x) || x <= 0 || Math.abs(k.current - x) < 1e-3 || (k.current = x, $(x), l == null || l(e, x));
  };
  return /* @__PURE__ */ C(
    "div",
    {
      ref: j,
      [Ie]: e,
      [we]: r,
      [gr]: q,
      className: yr,
      onPointerMoveCapture: ae,
      onPointerDown: Se,
      onDoubleClick: (x) => {
        const H = b == null ? void 0 : b.zoomBlock;
        !H || b != null && b.pointerTaken || !W || Ce(W.highlight.region) === "figure" && (x.preventDefault(), H(W.itemId));
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
          Qi,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: I,
            renderAnnotationLayer: !1,
            className: Ua,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: Tn,
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
            className: Tn,
            style: { width: t, height: q },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: J, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        Ee ? /* @__PURE__ */ p(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": m == null ? void 0 : m.itemId,
            style: Ee,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && v ? /* @__PURE__ */ p(
          $d,
          {
            layoutPage: h,
            pageState: y,
            width: t,
            height: q
          }
        ) : null,
        o && v && S ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (R != null && R.size) ? /* @__PURE__ */ p(Od, { targets: re, edits: R, width: t, excludeId: de == null ? void 0 : de.itemId }) : null,
        o && de && w ? /* @__PURE__ */ p(
          Xd,
          {
            target: de,
            page: { width: t, height: q },
            edit: w,
            showSource: !!(b != null && b.editShowsSource),
            regions: b == null ? void 0 : b.regions,
            jumpToBlock: b == null ? void 0 : b.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (T != null && T.size) ? /* @__PURE__ */ p("div", { className: "reader-revised-markers", "aria-hidden": "true", children: re.filter((x) => T.has(x.itemId)).map((x) => /* @__PURE__ */ p(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": x.itemId,
            style: { left: x.rect.left, top: x.rect.top, height: x.rect.height }
          },
          x.itemId
        )) }) : null,
        (fe = b == null ? void 0 : b.pageLayers) == null ? void 0 : fe.map((x) => /* @__PURE__ */ p(Pn, { children: x.render({ page: e, width: t, height: q, pane: D, active: o }) }, x.id)),
        /* @__PURE__ */ p(
          Id,
          {
            target: o && !(b != null && b.pointerTaken) && (W == null ? void 0 : W.itemId) !== (de == null ? void 0 : de.itemId) ? W : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: W && (T == null ? void 0 : T.get(W.itemId)) || 0,
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
const Qd = tn(Zd);
function ef(e, t) {
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
const tf = 2 * 1024 * 1024;
function nf(e) {
  const t = new Oa.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const zn = 5, rf = "120% 0px", of = 120, af = "25% 0px";
let bo = 1;
const vo = /* @__PURE__ */ new WeakMap();
function sf(e) {
  if (!e) return 0;
  const t = vo.get(e);
  if (t) return t;
  const n = bo;
  return bo += 1, vo.set(e, n), n;
}
function cf() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const lf = ii(
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
    onLoadSuccess: m,
    onOutline: f,
    onDocument: d,
    onLoadError: g,
    onNumPagesChange: h,
    activeRegion: y = null,
    regions: v = [],
    readerMetadata: S = null,
    hoveredRegionId: b = null,
    onHoverRegion: T,
    liveTranslation: w,
    showLiveTranslation: R = t === "source",
    liveTranslationPendingLabel: M = "",
    paneAction: E
  }, D) {
    Ou();
    const { file: A, loading: I, error: k } = $c(n, r), P = `${n}\0${sf(A)}`, $ = _(P);
    $.current = P;
    const z = U(() => {
      const F = xc(A);
      return F ? "ranged" in F ? { range: nf(F.ranged) } : F : null;
    }, [A, n]), [K, j] = N(0), [J, oe] = N(""), [q, se] = N(null), [Ee, re] = N(480), ue = _(null), Me = _(0), ie = U(() => cf(), []), le = U(() => ({
      cMapUrl: Xt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: Xt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: tf,
      disableAutoFetch: !0
    }), []);
    mr(D, () => q, [q]), O(() => {
      const F = (X) => {
        Me.current = X, re(X);
      }, Q = (X) => {
        const pe = nl(X, Me.current);
        if (pe !== "ignore") {
          if (ue.current && clearTimeout(ue.current), pe === "immediate") {
            F(X);
            return;
          }
          ue.current = setTimeout(() => F(X), Ja);
        }
      }, te = !!(c && c >= 80);
      Q(te ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const ge = !te && i && typeof ResizeObserver < "u" ? new ResizeObserver((X) => {
        var pe, Re;
        Q(((Re = (pe = X[0]) == null ? void 0 : pe.contentRect) == null ? void 0 : Re.width) ?? i.clientWidth);
      }) : null;
      return ge && i && ge.observe(i), () => {
        ge == null || ge.disconnect(), ue.current && clearTimeout(ue.current);
      };
    }, [c, i, a]);
    const B = U(
      () => Qc(Ee, o),
      [Ee, o]
    ), [W, Y] = N(() => /* @__PURE__ */ new Map()), [de, ne] = N(() => /* @__PURE__ */ new Set()), [ae, Se] = N(() => /* @__PURE__ */ new Set()), ee = _(/* @__PURE__ */ new Map()), Z = _(null), fe = _(null), [x, H] = N(() => /* @__PURE__ */ new Set()), V = _(/* @__PURE__ */ new Map()), me = L((F, Q) => {
      Y((te) => {
        if (te.get(F) === Q) return te;
        const ce = new Map(te);
        return ce.set(F, Q), ce;
      });
    }, []), ye = L((F, Q) => {
      const te = ee.current, ce = te.get(F), ge = [Z.current, fe.current];
      if (ce)
        for (const X of ge)
          try {
            X == null || X.unobserve(ce);
          } catch {
          }
      if (Q) {
        te.set(F, Q);
        for (const X of ge)
          try {
            X == null || X.observe(Q);
          } catch {
          }
      } else
        te.delete(F);
    }, []), Te = _(/* @__PURE__ */ new Map()), Ae = L((F) => {
      const Q = Te.current;
      let te = Q.get(F);
      return te || (te = (ce) => ye(F, ce), Q.set(F, te)), te;
    }, [ye]);
    O(() => {
      if (typeof IntersectionObserver > "u") return;
      const F = V.current, Q = new IntersectionObserver(
        (te) => {
          const ce = [], ge = [];
          for (const X of te) {
            const pe = X.target, Re = In(pe);
            Number.isFinite(Re) && (X.isIntersecting ? ce : ge).push(Re);
          }
          if ((ce.length || ge.length) && ne((X) => {
            let pe = null;
            for (const Re of ce)
              X.has(Re) || (pe = pe || new Set(X), pe.add(Re));
            for (const Re of ge)
              X.has(Re) && (pe = pe || new Set(X), pe.delete(Re));
            return pe || X;
          }), ce.length) {
            for (const X of ce) {
              const pe = F.get(X);
              pe && (clearTimeout(pe), F.delete(X));
            }
            Se((X) => {
              let pe = null;
              for (const Re of ce)
                X.has(Re) || (pe = pe || new Set(X), pe.add(Re));
              return pe || X;
            });
          }
          for (const X of ge)
            F.has(X) || F.set(X, setTimeout(() => {
              F.delete(X), Se((pe) => {
                if (!pe.has(X)) return pe;
                const Re = new Set(pe);
                return Re.delete(X), Re;
              });
            }, of));
        },
        { root: i, rootMargin: rf, threshold: 0 }
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
              const X = In(ge.target);
              !Number.isFinite(X) || ge.isIntersecting === te.has(X) || (ce = ce || new Set(te), ge.isIntersecting ? ce.add(X) : ce.delete(X));
            }
            return ce || te;
          });
        },
        { root: i, rootMargin: af, threshold: 0 }
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
    }, [P, h, t]);
    const He = L(
      (F) => {
        if ($.current !== P) return;
        const Q = F.numPages;
        j(Q), oe(""), h == null || h(Q, t), m == null || m({ numPages: Q, pane: t }), d && typeof F.getPage == "function" && d(F, t), f && typeof F.getOutline == "function" && $u(F).then((te) => {
          $.current === P && f(te, t);
        }, () => {
        });
      },
      [P, m, f, d, h, t]
    ), Qe = L(
      (F) => {
        if ($.current !== P) return;
        const Q = (F == null ? void 0 : F.message) || "PDF 解析失败";
        oe(Q), j(0), h == null || h(0, t), g == null || g(F, t);
      },
      [P, g, h, t]
    ), $e = U(
      () => K > 0 ? Array.from({ length: K }, (F, Q) => Q + 1) : [],
      [K]
    );
    O(() => {
      typeof IntersectionObserver < "u" || Se(new Set($e));
    }, [$e]);
    const Ke = U(
      () => mt(y, S, t),
      [y, S, t]
    ), et = U(() => {
      const F = /* @__PURE__ */ new Map();
      for (const Q of v) {
        const te = mt(Q, S, t);
        if (!te) continue;
        const ce = F.get(te.box.page) || [];
        ce.push(te), F.set(te.box.page, ce);
      }
      return F;
    }, [t, S, v]), tt = U(() => {
      const F = /* @__PURE__ */ new Set();
      if (!b) return F;
      for (const [Q, te] of et)
        te.some((ce) => ce.itemId === b) && F.add(Q);
      return F;
    }, [b, et]), St = U(() => {
      if (K === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set($e);
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
    }, [K, $e, i, a, de]), nt = !n || !!k || !!J, be = n && (k || J) || s;
    return /* @__PURE__ */ C(
      "section",
      {
        ref: se,
        className: `reader-panel ${rn}${a ? "" : " is-hidden"}`,
        [we]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (w == null ? void 0 : w.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          E ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: E }) : null,
          M ? /* @__PURE__ */ C("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: M })
          ] }) : null,
          nt && !I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: be }) : null,
          I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          z && !k ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            ec,
            {
              file: z,
              loading: null,
              error: null,
              options: le,
              onLoadSuccess: He,
              onLoadError: Qe,
              className: "reader-react-pdf-document",
              children: $e.map((F) => {
                if (St.has(F))
                  return /* @__PURE__ */ p(
                    Qd,
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
                      sentinelRef: Ae(F),
                      regionHighlight: (Ke == null ? void 0 : Ke.box.page) === F ? Ke : null,
                      regionTargets: et.get(F),
                      hoveredRegionId: b && tt.has(F) ? b : null,
                      onHoverRegion: T,
                      liveTranslationLayout: w == null ? void 0 : w.layoutByPage.get(F - 1),
                      liveTranslationPage: w == null ? void 0 : w.pagesByPage.get(F - 1),
                      showLiveTranslation: R,
                      liveTranslationMissing: au(w, F - 1)
                    },
                    `${t}-${F}`
                  );
                const te = W.get(F) ?? hs, ce = Math.max(120, Math.floor(B * te)), ge = Math.max(ce, Math.ceil((l == null ? void 0 : l.get(F)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: Ae(F),
                    [Ie]: F,
                    [we]: t,
                    [gr]: ce,
                    className: `${yr} is-placeholder`,
                    style: {
                      width: B,
                      height: ge,
                      minHeight: ge
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: Tn,
                        style: { width: B, height: ce },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${F}`
                );
              })
            },
            P
          ) }) : null
        ]
      }
    );
  }
), wo = tn(lf), uf = 2e3, df = 6, ff = 500, So = "reader-react-resizing";
function mf(e, t) {
  const n = _(null), r = _(null);
  Le(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const T = hf(e), w = Vt(e, T);
      if (!w) return;
      s = { pane: T, progress: w, started: performance.now() };
    }
    const { pane: i, progress: c, started: l } = s;
    let u = 0, m = null, f = e.scrollHeight, d = f, g = 0, h = l;
    const y = /* @__PURE__ */ new WeakMap(), v = typeof ResizeObserver > "u" ? null : new ResizeObserver((T) => {
      let w = !1;
      for (const R of T) {
        const M = Math.round(R.contentRect.height);
        y.has(R.target) && y.get(R.target) !== M && (w = !0), y.set(R.target, M);
      }
      w && At(e, c, "auto", i);
    }), S = () => {
      var T;
      m && clearTimeout(m), cancelAnimationFrame(u), v == null || v.disconnect(), e.classList.remove(So);
      for (const w of To) e.removeEventListener(w, S);
      ((T = r.current) == null ? void 0 : T.stop) === S && (r.current = null);
    }, b = () => {
      At(e, c, "auto", i);
      const T = e.scrollHeight;
      g = T === d ? g + 1 : 0, d = T;
      const w = performance.now() - h;
      g >= df && (T !== f || w > ff) || w > uf ? S() : u = requestAnimationFrame(b);
    };
    for (const T of To) e.addEventListener(T, S, { passive: !0 });
    for (const T of Array.from(e.children)) v == null || v.observe(T);
    e.classList.add(So), r.current = { ...s, stop: S }, m = setTimeout(() => {
      m = null, h = performance.now(), f = e.scrollHeight, d = f, g = 0, u = requestAnimationFrame(b);
    }, Ja);
  }, [e, t]), O(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function hf(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Ie}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(we) || null;
  }
  return null;
}
const To = ["wheel", "touchstart", "keydown", "pointerdown"];
function pf(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function gf(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(rn)) && ((n = e.hasAttribute) != null && n.call(e, we)));
}
function yf(e, t) {
  O(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!gf(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${rn}[${we}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const c = pf(a, i);
        if (c === null || Math.abs(i.scrollLeft - c) < 1) continue;
        const l = i.scrollLeft;
        i.scrollLeft = c, Math.abs(i.scrollLeft - l) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function bf(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), c = t - i, l = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: c * l };
}
function vf(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const ko = 12;
function Ir(e) {
  return Array.from(e.querySelectorAll(`.${rn}[${we}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function wf(e) {
  const t = e.getBoundingClientRect();
  return Ir(e).map((n) => {
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
function Sf(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function Tf(e, t) {
  return e ? Ir(e).find((n) => n.getAttribute(we) === t) ?? null : null;
}
function kf({ shellEl: e }) {
  const [t, n] = N([]), r = _(0), o = L(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = wf(e);
      n((i) => Sf(i, s) ? i : s);
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
        for (const m of Ir(e))
          i.observe(m), m.firstElementChild && i.observe(m.firstElementChild);
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
  return a.length ? /* @__PURE__ */ p("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ p(If, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function If({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - ko * 2), r = bf(e, n), o = _(null);
  if (!r) return null;
  const a = (f) => {
    const d = Tf(t, e.pane);
    d && (d.scrollLeft = f);
  }, s = (f) => {
    var d, g;
    f.button === 0 && (f.preventDefault(), f.stopPropagation(), (g = (d = f.currentTarget).setPointerCapture) == null || g.call(d, f.pointerId), o.current = { startX: f.clientX, startScroll: e.scrollLeft, pointerId: f.pointerId });
  }, i = (f) => {
    const d = o.current;
    !d || d.pointerId !== f.pointerId || a(d.startScroll + vf(e, n, r.size, f.clientX - d.startX));
  }, c = (f) => {
    var d, g, h;
    ((d = o.current) == null ? void 0 : d.pointerId) === f.pointerId && (o.current = null, (h = (g = f.currentTarget).releasePointerCapture) == null || h.call(g, f.pointerId));
  }, l = (f) => {
    if (f.button !== 0 || f.target !== f.currentTarget) return;
    f.preventDefault();
    const d = f.currentTarget.getBoundingClientRect(), g = f.clientX - d.left, h = e.width * 0.8;
    a(e.scrollLeft + (g < r.offset ? -h : h));
  }, u = e.pane === "translated" ? "译文栏左右滚动" : "原文栏左右滚动", m = Math.max(0, e.scrollWidth - e.width);
  return /* @__PURE__ */ p(
    "div",
    {
      className: "reader-pane-scrollbar",
      "data-reader-pane-scrollbar": e.pane,
      role: "scrollbar",
      "aria-label": u,
      "aria-orientation": "horizontal",
      "aria-valuemin": 0,
      "aria-valuemax": Math.round(m),
      "aria-valuenow": Math.round(e.scrollLeft),
      style: { left: e.left + ko, width: n },
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
function ps(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Ef(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function Rf({ compare: e, onDone: t }) {
  return /* @__PURE__ */ C("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ p("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ p("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ p("li", { children: /* @__PURE__ */ C(
        G,
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
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: ps(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(hr, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(Pi, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ p("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ C("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ C(
        G,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ p(Pa, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ C(
        G,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ p(Mi, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function Io({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = Ef(t), a = [e === "compare" ? "对比" : "正在读", r, ps(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ C("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function Pf({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = N({ source: null, translated: null });
  return Le(() => {
    if (!e) return;
    const a = () => {
      const i = e.getBoundingClientRect(), c = (l) => {
        const u = e.querySelector(`[${we}="${l}"]`), m = u == null ? void 0 : u.getBoundingClientRect();
        return m && m.width > 0 ? { x: Math.round(m.left + m.width / 2), top: Math.round(i.top + 14) } : null;
      };
      o({ source: c("source"), translated: c("translated") });
    };
    a();
    const s = typeof ResizeObserver > "u" ? null : new ResizeObserver(a);
    return s == null || s.observe(e), e.querySelectorAll(`[${we}]`).forEach((i) => s == null ? void 0 : s.observe(i)), window.addEventListener("resize", a), e.addEventListener("scroll", a, { passive: !0 }), () => {
      s == null || s.disconnect(), window.removeEventListener("resize", a), e.removeEventListener("scroll", a);
    };
  }, [e]), /* @__PURE__ */ C("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(Io, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(Io, { role: "reading", ...n }) }) : null
  ] });
}
const Mf = () => () => {
}, Eo = () => null;
function xf({
  mode: e,
  compareMode: t,
  showSource: n,
  showTranslated: r,
  markdownSplit: o,
  overlayOnSource: a = !1
}) {
  return { mode: e, compareMode: t, showSource: n, showTranslated: r };
}
function Nf(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function Af(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function _f(e) {
  const t = Be(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, m = e.bindShell ?? (t == null ? void 0 : t.bindShell), f = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, d = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? on, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, v = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, b = (t == null ? void 0 : t.compareVersion) ?? null, T = (b == null ? void 0 : b.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", w = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", R = b ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, M = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, E = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), D = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), A = t == null ? void 0 : t.onPdfOutline, I = t == null ? void 0 : t.onPdfDocument, k = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), P = e.regions ?? (t == null ? void 0 : t.regions) ?? [], $ = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), z = (t == null ? void 0 : t.regionHover) ?? null, [K, j] = N(null), J = Mn(
    z ? z.subscribe : Mf,
    z ? () => z.get().itemId : Eo,
    z ? () => z.get().itemId : Eo
  ), oe = z ? J : K, q = L((ue) => {
    z ? z.set(ue, "pdf") : j(ue);
  }, [z]), se = xf({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), re = Number.isFinite(g) && g > 0 ? Nf(
    g,
    // 对照时两栏分书页区，按书页区算（50% = 一栏）；单栏才按两倍算（50% = 铺满剩下的那一栏）。
    (n || r) && !se.compareMode,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return mf(f, re), yf(f, se.compareMode), /* @__PURE__ */ C(
    "div",
    {
      ref: m,
      className: ja,
      "data-reader-region-count": P.length,
      "data-reader-structured-region-count": P.filter(vi).length,
      "data-reader-metadata-ready": $ ? "true" : "false",
      children: [
        /* @__PURE__ */ C(
          "main",
          {
            className: `${Ha} reader-mode-${se.mode}`,
            "data-reader-mode": se.compareMode ? s : n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              y ? /* @__PURE__ */ p(
                wo,
                {
                  pane: "source",
                  url: T,
                  preloadedFile: R,
                  userZoom: d,
                  visible: se.showSource,
                  scrollRoot: f,
                  pageWidthOverride: re,
                  rowHeights: se.compareMode ? h : void 0,
                  onMetrics: E,
                  emptyLabel: S ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: D,
                  onOutline: b ? void 0 : A,
                  onDocument: b ? void 0 : I,
                  activeRegion: k,
                  regions: (b == null ? void 0 : b.regions) ?? P,
                  readerMetadata: $,
                  hoveredRegionId: oe,
                  onHoverRegion: q,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? Af(o) : "",
                  paneAction: u && se.showTranslated ? /* @__PURE__ */ C(Ne, { children: [
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
              v ? /* @__PURE__ */ p(
                wo,
                {
                  pane: "translated",
                  url: w,
                  preloadedFile: M,
                  userZoom: d,
                  visible: se.showTranslated,
                  scrollRoot: f,
                  pageWidthOverride: re,
                  rowHeights: se.compareMode ? h : void 0,
                  onMetrics: E,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: D,
                  onOutline: A,
                  onDocument: I,
                  activeRegion: k,
                  regions: P,
                  readerMetadata: $,
                  hoveredRegionId: oe,
                  onHoverRegion: q,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ p(kf, { shellEl: f }),
        b ? /* @__PURE__ */ p(Pf, { shellEl: f, left: b.left, right: b.right }) : null
      ]
    }
  );
}
const Lf = 72, dn = 1500, Cf = 2e3, $f = 1200;
function Df(e, t) {
  return e - t < Lf;
}
function Of(e) {
  try {
    return e.matches(":focus-visible");
  } catch {
    return !1;
  }
}
function zf(e, t) {
  const [n, r] = N(!0), o = _(null), a = _(!1), s = _(!1), i = L(() => {
    o.current !== null && (window.clearTimeout(o.current), o.current = null);
  }, []), c = L((u) => {
    i(), o.current = window.setTimeout(() => {
      o.current = null, s.current || r(!1);
    }, u);
  }, [i]);
  O(() => {
    var T;
    const u = (T = e.current) == null ? void 0 : T.parentElement;
    if (!u) return;
    let m = u.getBoundingClientRect().top;
    const f = () => {
      m = u.getBoundingClientRect().top;
    }, d = (w) => {
      w.pointerType !== "touch" && (Df(w.clientY, m) ? a.current || (a.current = !0, i(), r(!0)) : a.current && (a.current = !1, c(dn)));
    }, g = () => {
      a.current && (a.current = !1, c(dn));
    }, h = (w) => {
      s.current = w.target instanceof Element && Of(w.target), s.current && (i(), r(!0));
    }, y = (w) => {
      var E;
      const R = w.relatedTarget;
      if (R instanceof Node && ((E = e.current) != null && E.contains(R))) return;
      const M = s.current;
      s.current = !1, M && !a.current && c(dn);
    }, v = () => {
      a.current || (r(!0), c(dn));
    }, S = () => {
      s.current = !1;
    }, b = e.current;
    return c(Cf), b == null || b.addEventListener("focusin", h), b == null || b.addEventListener("focusout", y), b == null || b.addEventListener("pointerdown", S), u.addEventListener("scroll", v, { capture: !0, passive: !0 }), u.addEventListener("pointerenter", f), u.addEventListener("pointermove", d, { passive: !0 }), u.addEventListener("pointerleave", g), window.addEventListener("resize", f), () => {
      i(), b == null || b.removeEventListener("focusin", h), b == null || b.removeEventListener("focusout", y), b == null || b.removeEventListener("pointerdown", S), u.removeEventListener("scroll", v, { capture: !0 }), u.removeEventListener("pointerenter", f), u.removeEventListener("pointermove", d), u.removeEventListener("pointerleave", g), window.removeEventListener("resize", f);
    };
  }, [e, i, c]);
  const l = _(t);
  return O(() => {
    l.current !== t && (l.current = t, !a.current && (r(!0), c($f)));
  }, [t, c]), n;
}
const Ff = [
  { id: "source", label: "原文", Icon: Ma },
  { id: "compare", label: "对照", Icon: xa },
  { id: "translated", label: "译文", Icon: Na }
];
function Bf(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function Hf(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function jf(e) {
  const t = Be(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? Bf(a.state) : "", l = _(null), u = zf(l, n);
  return (
    // 浮在书页区顶上（2026-11-28 用户：「顶部的 bar 不要保留了，用悬浮的方式……更有沉浸感」）：
    // 这一层本身透明、不接点击，只有左上的胶囊和正中的页签接；左右两段同宽，页签在书页区正中。
    // 读的时候藏着，鼠标到书页区顶上才出来（use-topbar-reveal.ts；不藏的几种在 chrome.css）。
    /* @__PURE__ */ C("header", { className: "reader-workspace-bar", ref: l, "data-revealed": u ? "true" : "false", children: [
      /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
      /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
      e.start ? /* @__PURE__ */ p("div", { className: "reader-workspace-start", children: e.start }) : null,
      /* @__PURE__ */ C("div", { className: "reader-workspace-center", children: [
        /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Ff.map(({ id: m, label: f, Icon: d }) => {
          const g = n === m, h = Hf({
            id: m,
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
                "aria-label": f,
                title: h ? `${f} 需要文档任务` : f,
                disabled: h,
                onClick: () => o(m),
                children: /* @__PURE__ */ p(d, { ...Pe, "aria-hidden": !0 })
              }
            ),
            m === "compare" ? e.compareExtra : null
          ] }, m);
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
                /* @__PURE__ */ p(xi, { ...Pe, "aria-hidden": !0 }),
                /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: c })
              ]
            }
          ),
          a.latestPage && a.onJumpToLatest && a.latestPage !== a.currentPage ? /* @__PURE__ */ C(
            G,
            {
              className: "reader-live-translation-toggle reader-live-jump",
              "aria-label": `跳到最新译好的第 ${a.latestPage} 页`,
              title: `跳到最新译好的第 ${a.latestPage} 页`,
              onClick: a.onJumpToLatest,
              children: [
                /* @__PURE__ */ p(Ni, { ...Pe, "aria-hidden": !0 }),
                /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "跳到最新" })
              ]
            }
          ) : null
        ] }) : s ? /* @__PURE__ */ p("div", { className: "reader-live-strip", children: /* @__PURE__ */ C(
          G,
          {
            className: "reader-live-translation-toggle is-done",
            title: "翻译完成，左右对照看最终译文",
            onClick: s.onOpenCompare,
            children: [
              /* @__PURE__ */ p(Ai, { ...Pe, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
            ]
          }
        ) }) : null
      ] }),
      /* @__PURE__ */ p("span", { className: "reader-workspace-end", "aria-hidden": "true" })
    ] })
  );
}
const gs = [];
function Uf() {
  const e = /* @__PURE__ */ new Map(), t = /* @__PURE__ */ new Set();
  let n = gs;
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
function Ro(e, t) {
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
function Wf(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.pageLayer ? [{ id: t, render: n.pageLayer }] : []);
}
function Kf(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.menuSection ? [{ id: t, render: n.menuSection }] : []);
}
function Vf(e) {
  var t;
  return ((t = e.find(({ contribution: n }) => n.takesPointer)) == null ? void 0 : t.id) ?? null;
}
function qf(e) {
  const t = e.flatMap(({ id: n, contribution: r }) => r.textMarks ? [{ id: n, marks: r.textMarks }] : []);
  return t.length ? (n) => t.flatMap(({ id: r, marks: o }) => {
    try {
      return [...o(n)];
    } catch (a) {
      return console.error(`[reader] 扩展 ${r} 的文字层标记出错`, a), [];
    }
  }) : null;
}
function Jf(e) {
  return e.reduce((t, { contribution: n }) => Math.max(t, n.reserveRight || 0), 0);
}
function Gf(e) {
  for (const { contribution: t } of e) if (t.comparedDocument) return t.comparedDocument;
  return null;
}
function Xf(e) {
  return e.flatMap(({ title: t, contribution: n }) => {
    var r;
    return (r = n.shortcuts) != null && r.length ? [{ title: t, items: n.shortcuts }] : [];
  });
}
const Nn = nn(null), ys = nn(null);
function Yf({ api: e, store: t, children: n }) {
  const r = U(() => ({ api: e, store: t }), [e, t]);
  return /* @__PURE__ */ p(Nn.Provider, { value: r, children: n });
}
function Ct() {
  const e = ft(Nn);
  if (!e) throw new Error("useReaderApi 要在 ReaderExtensionsProvider 里面用");
  return e.api;
}
const Zf = () => () => {
}, Po = () => gs;
function Qf(e) {
  return Mn(e.subscribe, e.getSnapshot, e.getSnapshot);
}
function bs() {
  var t;
  const e = (t = ft(Nn)) == null ? void 0 : t.store;
  return Mn((e == null ? void 0 : e.subscribe) ?? Zf, (e == null ? void 0 : e.getSnapshot) ?? Po, (e == null ? void 0 : e.getSnapshot) ?? Po);
}
function an(e) {
  var a;
  const t = (a = ft(Nn)) == null ? void 0 : a.store, n = ft(ys);
  if (!n) throw new Error("useReaderContribution 只能在扩展组件里用");
  const { id: r, title: o } = n;
  O(() => {
    t == null || t.set(r, o, e);
  }, [t, r, o, e]), O(() => () => t == null ? void 0 : t.remove(r), [t, r]);
}
class em extends ci {
  constructor() {
    super(...arguments);
    Vr(this, "state", { failed: !1 });
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
const tm = tn(function({ extensions: t }) {
  return /* @__PURE__ */ p(Ne, { children: t.map(({ id: n, title: r, Component: o }) => /* @__PURE__ */ p(em, { id: n, children: /* @__PURE__ */ p(nm, { id: n, title: r, children: /* @__PURE__ */ p(o, {}) }) }, n)) });
});
function nm({ id: e, title: t, children: n }) {
  const r = U(() => ({ id: e, title: t }), [e, t]);
  return /* @__PURE__ */ p(ys.Provider, { value: r, children: n });
}
function rm({
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
      G,
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
const Mo = 6e3;
function vs(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function ws(e, t, n, r) {
  const o = e.width * t.width, a = e.height * t.height;
  let s = n * r / Math.max(1, o);
  const i = Math.max(o, a) * s;
  return i > Mo && (s *= Mo / i), {
    scale: s,
    offsetX: -e.left * t.width * s,
    offsetY: -e.top * t.height * s,
    canvasWidth: Math.max(1, Math.round(o * s)),
    canvasHeight: Math.max(1, Math.round(a * s)),
    /** 显示高度（CSS 像素），按区域的宽高比。 */
    cssHeight: Math.round(n * (a / Math.max(1, o)))
  };
}
function Ss({
  pdf: e,
  page: t,
  region: n,
  cssWidth: r,
  className: o,
  label: a
}) {
  const s = _(null), [i, c] = N({ status: "loading", cssHeight: 0 }), l = `${t}:${n.left}:${n.top}:${n.width}:${n.height}:${Math.round(r)}`;
  return O(() => {
    let u = !1, m = null;
    return c((f) => ({ status: "loading", cssHeight: f.cssHeight })), (async () => {
      try {
        const f = await e.getPage(t);
        if (u) return;
        const d = f.getViewport({ scale: 1 }), g = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), h = ws(n, d, r, g), y = s.current, v = y == null ? void 0 : y.getContext("2d");
        if (!y || !v) return;
        y.width = h.canvasWidth, y.height = h.canvasHeight, c({ status: "loading", cssHeight: h.cssHeight });
        const S = f.getViewport({ scale: h.scale, offsetX: h.offsetX, offsetY: h.offsetY }), b = f.render({ canvasContext: v, viewport: S });
        m = b, await b.promise, u || c({ status: "ready", cssHeight: h.cssHeight });
      } catch (f) {
        !u && (f == null ? void 0 : f.name) !== "RenderingCancelledException" && c((d) => ({ status: "error", cssHeight: d.cssHeight }));
      }
    })(), () => {
      u = !0, m == null || m.cancel();
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
const om = 1600, Er = { left: 0, top: 0, width: 1, height: 1 };
function Ts(e) {
  return new Promise((t, n) => {
    e.toBlob((r) => r ? t(r) : n(new Error("截图没出来")), "image/png");
  });
}
function am(e, t, n) {
  if (e.width <= 0 || e.height <= 0) return null;
  const r = (l) => Math.min(1, Math.max(0, (l - e.left) / e.width)), o = (l) => Math.min(1, Math.max(0, (l - e.top) / e.height)), a = Math.min(r(t.x), r(n.x)), s = Math.max(r(t.x), r(n.x)), i = Math.min(o(t.y), o(n.y)), c = Math.max(o(t.y), o(n.y));
  return s - a < 0.02 || c - i < 0.02 ? null : { left: a, top: i, width: s - a, height: c - i };
}
async function sm(e, t, n = Er, r = om) {
  const o = await e.getPage(t), a = ws(n, o.getViewport({ scale: 1 }), r, 1), s = document.createElement("canvas");
  s.width = a.canvasWidth, s.height = a.canvasHeight;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.fillStyle = "#fff", i.fillRect(0, 0, s.width, s.height), await o.render({ canvasContext: i, viewport: o.getViewport({ scale: a.scale, offsetX: a.offsetX, offsetY: a.offsetY }) }).promise, Ts(s);
}
async function im(e, t = Er) {
  const n = Math.round(t.left * e.width), r = Math.round(t.top * e.height), o = Math.max(1, Math.round(t.width * e.width)), a = Math.max(1, Math.round(t.height * e.height)), s = document.createElement("canvas");
  s.width = o, s.height = a;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.drawImage(e, n, r, o, a, 0, 0, o, a), Ts(s);
}
function cm(e, t) {
  return t.left === 0 && t.top === 0 && t.width === 1 && t.height === 1 ? `第${e}页.png` : `第${e}页-截图.png`;
}
const lm = /[\u{1D400}-\u{1D7FF}ﬀ-ﬆ]/gu, xo = /[⺀-鿿가-힯豈-﫿＀-￯　-〿]/u;
function um(e) {
  let t = `${e || ""}`.replace(/\r\n?/g, `
`).replace(/­/g, "");
  return t.trim() ? (t = t.replace(lm, (r) => r.normalize("NFKC")), t = t.normalize("NFC"), t.includes("̸") && (t = t.replace(/(\S)?̸[ \t]*(\S)/gu, (r, o, a) => `${o ? `${o} ` : ""}${a}̸`).normalize("NFC")), t.split(/\n[ \t]*\n+/).map((r) => dm(r.split(`
`))).filter(Boolean).join(`
`).trim()) : "";
}
function dm(e) {
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
    t += xo.test(o) || xo.test(a) ? r : ` ${r}`;
  }
  return t;
}
const fm = /[\u{1D400}-\u{1D7FF}Ͱ-Ͽ℀-⅏←-⋿⨀-⫿⟀-⟯⦀-⧿⁰-₟̀-ͯ√±×÷]/u;
function No(e) {
  return fm.test(e);
}
function mm(e) {
  const t = `${e || ""}`;
  return t.trim() ? [...t.trim()].length > 6 ? !1 : !new RegExp("\\p{Ll}{3,}", "u").test(t) : !0;
}
function hm(e, t) {
  const n = e[t];
  if (!n) return null;
  const r = (i) => {
    const c = e[i];
    return !!c && c.line === n.line && (No(c.text) || mm(c.text));
  };
  if (!r(t)) return null;
  let o = t, a = t;
  for (; r(o - 1); ) o -= 1;
  for (; r(a + 1); ) a += 1;
  let s = !1;
  for (let i = o; i <= a; i += 1) No(e[i].text) && (s = !0);
  if (!s) return null;
  for (; o < a && !e[o].text.trim(); ) o += 1;
  for (; a > o && !e[a].text.trim(); ) a -= 1;
  return [o, a];
}
function pm(e) {
  const t = e.filter((a) => a.right - a.left > 0.5 && a.bottom - a.top > 0.5);
  if (!t.length) return [];
  const n = [...t].sort((a, s) => (a.top + a.bottom) / 2 - (s.top + s.bottom) / 2), r = [];
  for (const a of n) {
    const s = r.at(-1), i = s ? Ao(s) : null;
    i && gm(i, a) >= 0.5 * Math.min(i.bottom - i.top, a.bottom - a.top) ? s.push(a) : r.push([a]);
  }
  const o = [];
  for (const a of r) {
    const s = Ao(a), i = s.bottom - s.top, c = [...a].sort((u, m) => u.left - m.left);
    let l = null;
    for (const u of c)
      l && u.left - l.right <= i * 2 ? l.right = Math.max(l.right, u.right) : (l && o.push(l), l = { left: u.left, top: s.top, right: u.right, bottom: s.bottom });
    l && o.push(l);
  }
  return o;
}
function Ao(e) {
  const t = Math.max(...e.map((r) => r.bottom - r.top)), n = e.filter((r) => r.bottom - r.top >= t * 0.75);
  return { top: Math.min(...n.map((r) => r.top)), bottom: Math.max(...n.map((r) => r.bottom)) };
}
function gm(e, t) {
  return Math.min(e.bottom, t.bottom) - Math.max(e.top, t.top);
}
const Qn = ".textLayer, .reader-layout-page, .reader-html-page", fn = ".reader-layout-page", _o = "svg.reader-layout-math";
function er(e) {
  return e ? e.nodeType === 1 ? e : e.parentElement : null;
}
function ym(e) {
  var t, n;
  return ((t = er(e.startContainer)) == null ? void 0 : t.closest(Qn)) ?? ((n = er(e.endContainer)) == null ? void 0 : n.closest(Qn)) ?? null;
}
const bm = /[\p{Script=Latin}\p{N})\].,;:!?%]$/u, vm = /^[\p{Script=Latin}\p{N}(\[$]/u;
function wm(e, t) {
  var s, i, c;
  let n = "", r = null, o = null, a = Number.NaN;
  for (const l of t.querySelectorAll(`text, ${_o}`)) {
    if (!e.intersectsNode(l)) continue;
    let u, m = Number(l.getAttribute("x")), f, d;
    if (l.matches(_o))
      u = `$${l.getAttribute("data-tex") || ""}$`, d = l.getAttribute("data-baseline"), f = m + Number(l.getAttribute("width") || 0);
    else {
      const h = l.textContent || "", y = l.firstChild;
      let v = 0, S = h.length;
      y && y === e.startContainer && (v = e.startOffset), y && y === e.endContainer && (S = e.endOffset), u = h.slice(v, S), d = l.getAttribute("y");
      let b = 0;
      try {
        b = ((s = l.getComputedTextLength) == null ? void 0 : s.call(l)) || 0;
      } catch {
        b = 0;
      }
      f = m + b, v > 0 && (m = Number.NaN);
    }
    if (!u) continue;
    const g = ((i = l.closest("[data-html-block]")) == null ? void 0 : i.getAttribute("data-html-block")) ?? null;
    if (o !== null && g !== o) n += `

`;
    else if (r !== null && d !== r) n += `
`;
    else if (n && Number.isFinite(a) && Number.isFinite(m)) {
      const h = Number((c = l.closest("[font-size]")) == null ? void 0 : c.getAttribute("font-size")) || 10;
      m - a > h * 0.2 && bm.test(n) && vm.test(u) && (n += " ");
    }
    n += u, r = d, o = g, a = f;
  }
  return n;
}
function Sm(e) {
  if (!e.rangeCount) return "";
  const t = e.getRangeAt(0), n = er(t.commonAncestorContainer), r = (n == null ? void 0 : n.closest(fn)) ?? (n != null && n.querySelector(fn) ? n : null);
  if (r) {
    const o = r.matches(fn) ? [r] : [...r.querySelectorAll(fn)].filter((a) => t.intersectsNode(a));
    if (o.length) return o.map((a) => wm(t, a)).filter(Boolean).join(`

`);
  }
  return `${e}`;
}
function ks(e) {
  return um(Sm(e));
}
const Tm = 4e3;
function km(e, t, n) {
  if (e.length) {
    const o = Du(e, n), a = o ? as(e).find((s) => s.id === o) : null;
    if (a) return a.title;
  }
  let r = null;
  for (const o of t)
    !o.headingLevel || o.source.page > n || (!r || o.source.page >= r.source.page) && (r = o);
  return `${(r == null ? void 0 : r.source.text) || (r == null ? void 0 : r.markdown) || ""}`.replace(/\s+/g, " ").trim().slice(0, 80);
}
function Lo(e) {
  var a, s;
  if (!e || e.isCollapsed || !e.rangeCount) return { text: "", element: null, rect: null };
  const t = e.getRangeAt(0), n = t.startContainer, r = ((s = (a = n.nodeType === 1 ? n : n.parentElement) == null ? void 0 : a.closest) == null ? void 0 : s.call(a, `[${Ie}]`)) ?? null;
  return r ? { text: ks(e).slice(0, Tm), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function Im(e, t, n, r, o) {
  let a = null, s = 0.15;
  for (const i of e) {
    const c = mt(i, t, n);
    if (!c || c.box.page !== r) continue;
    const l = lt(c, 1, 1);
    if (!l) continue;
    const u = o.y < l.top ? l.top - o.y : o.y > l.top + l.height ? o.y - l.top - l.height : 0, m = o.x < l.left ? l.left - o.x : o.x > l.left + l.width ? o.x - l.left - l.width : 0, f = u + m * 0.25;
    (f < s || f === 0 && a === null) && (a = i, s = f);
  }
  return a;
}
function Em({
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
  const c = Number(e.getAttribute(Ie)) || 0;
  if (c < 1) return null;
  const l = e.getAttribute(we) === "source" ? "source" : "translated", u = e.getBoundingClientRect(), m = u.width > 0 && u.height > 0 ? { x: Math.min(1, Math.max(0, (t - u.left) / u.width)), y: Math.min(1, Math.max(0, (n - u.top) / u.height)) } : null, d = (r ? a.find((g) => g.itemId === r) ?? null : null) ?? (m ? Im(a, i, l, c, m) : null);
  return {
    pane: l,
    page: c,
    itemId: (d == null ? void 0 : d.itemId) ?? null,
    selection: o,
    sourceText: `${(d == null ? void 0 : d.source.text) || (d == null ? void 0 : d.markdown) || ""}`.trim(),
    translatedText: `${(d == null ? void 0 : d.translatedBlockText) || (d == null ? void 0 : d.translated.text) || ""}`.trim(),
    section: km(s, a, (d == null ? void 0 : d.source.page) ?? c),
    point: m
  };
}
function Rm(e, t, n = document) {
  for (const r of n.elementsFromPoint(e, t)) {
    const o = r.closest(`[${Ie}]`);
    if (!o) continue;
    const a = Number(o.getAttribute(Ie)) || 0, i = (o.closest(`[${we}]`) ?? o).getAttribute(we) === "translated" ? "translated" : "source", c = o.querySelector("canvas");
    if (a && c) return { page: a, pane: i, canvas: c, slot: o };
  }
  return null;
}
function Pm({ onDone: e, onCancel: t }) {
  const [n, r] = N(null), o = _(null), a = _(null);
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
      return Rm(c, l);
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
        var u, m;
        if (c.button !== 0) return;
        const l = s(c.clientX, c.clientY);
        l && (o.current = l, (m = (u = c.currentTarget).setPointerCapture) == null || m.call(u, c.pointerId), r({ from: { x: c.clientX, y: c.clientY }, to: { x: c.clientX, y: c.clientY } }));
      },
      onPointerMove: (c) => {
        n && r({ from: n.from, to: { x: c.clientX, y: c.clientY } });
      },
      onPointerUp: (c) => {
        const l = o.current, u = n == null ? void 0 : n.from;
        if (o.current = null, r(null), !l || !u) return;
        const m = am(l.canvas.getBoundingClientRect(), u, { x: c.clientX, y: c.clientY });
        m && e({ page: l.page, pane: l.pane, region: m, canvas: l.canvas, point: { x: u.x, y: u.y, target: l.slot } });
      },
      children: [
        /* @__PURE__ */ p("p", { className: "reader-ask-crop-hint", children: "在书页上拖出一块，松开就带进提问 · Esc 取消" }),
        i ? /* @__PURE__ */ p("div", { className: "reader-ask-crop-box", style: i }) : null
      ]
    }
  );
}
const Co = 5e4, Mm = 2e4;
function Fn(e, t) {
  const n = `${e || ""}`;
  return n.length > t ? n.slice(0, t) : n;
}
function Sb(e, t) {
  const n = { page: e.page, pane: e.pane, item_ids: e.itemId ? [e.itemId] : [] };
  return t.documentId && (n.document_id = t.documentId), t.jobId && (n.job_id = t.jobId), t.versionId && (n.translation_version = t.versionId), e.selection && (n.selected_text = e.selection), e.section && (n.section = e.section), e.sourceText && (n.source_text = e.sourceText), e.translatedText && (n.translated_text = e.translatedText), n;
}
function xm(e, t = null) {
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
function Nm(e, t) {
  if (!(e != null && e.page)) return null;
  const r = [!!(e.document_id && t && e.document_id !== t) ? "别的书" : "", `第 ${e.page} 页`, e.section || ""].filter(Boolean).join(" · ");
  return { page: e.page, label: r, data: e };
}
function Am(e) {
  var r;
  const t = e == null ? void 0 : e.data, n = ((r = t == null ? void 0 : t.retainpdf) == null ? void 0 : r.selection) ?? (t && typeof t.page == "number" ? t : null);
  return n && n.page ? n : null;
}
function Tb(e, t) {
  var r;
  const n = Am(e);
  return !n || n.document_id && t && n.document_id !== t ? null : ((r = n.item_ids) == null ? void 0 : r[0]) || null;
}
function kb(e) {
  var o, a;
  const t = e.selection.trim();
  return t && !t.endsWith("…") ? t : ((a = (o = [...e.text.matchAll(/```[ \t]*(译文|translation|zh|zh-CN)[ \t]*\n([\s\S]*?)\n```/gi)].at(-1)) == null ? void 0 : o[2]) == null ? void 0 : a.trim()) || null;
}
function _m(e, t) {
  var o;
  if (!t) return;
  const n = e.findIndex((a) => a.message_id === t);
  if (n < 0) return;
  const r = ((o = e[n + 1]) == null ? void 0 : o.role) === "assistant" ? Lm(e[n + 1].text) : "";
  return { question: e[n].text, ...r ? { answer: r } : {} };
}
function Lm(e, t = 160) {
  const n = e.replace(/```[\s\S]*?(```|$)/g, " ").replace(/\$\$[\s\S]*?\$\$/g, " … ").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim(), r = [...n];
  return r.length > t ? `${r.slice(0, t).join("")}…` : n;
}
function Cm(e, t = [], n = "") {
  const r = new Set(t.map((o) => o.covers_to_seq));
  return e.filter((o) => !o.superseded_at).map((o) => {
    const a = r.has(o.seq) ? { compactedBefore: !0 } : {};
    if (o.role === "user") {
      const s = _m(e, o.edited_from);
      return {
        id: o.message_id,
        role: "user",
        text: o.text,
        context: Nm(o.selection, n),
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
function $m(e, t, n, r) {
  var l, u, m;
  const o = ((m = (u = (l = e.context) == null ? void 0 : l.meta) == null ? void 0 : u.retainpdf) == null ? void 0 : m.selection) ?? null, a = (o == null ? void 0 : o.document_id) || t || null, s = e.sessionId && e.sessionId.length <= 256 ? e.sessionId : null, i = { agent_id: e.agentId || null, document_id: a, session_id: s }, c = e.answer.usage && JSON.stringify(e.answer.usage).length <= 4096 ? e.answer.usage : null;
  return [
    { ...i, role: "user", text: Fn(e.question.text, Co), selection: o, client_message_id: `${n}-q`, ...r ? { edited_from: r } : {} },
    {
      ...i,
      role: "assistant",
      text: Fn(e.answer.text, Co),
      thought: e.answer.thought ? Fn(e.answer.thought, Mm) : null,
      usage: c,
      client_message_id: `${n}-a`,
      memory_ids: e.memoryIds.slice(0, 10)
    }
  ];
}
function Dm(e) {
  return new Date(e - 2e3).toISOString().replace(/\.\d+Z$/, "Z");
}
function Om(e, t) {
  return e.filter((n) => n.origin === "agent" && n.status === "active" && !t.has(n.memory_id)).map((n) => ({ id: n.memory_id, scope: n.scope, text: n.text, category: n.category, documentId: n.document_id, created: !0 }));
}
function zm(e, t) {
  if (t.id && e.some((r) => r.message_id === t.id)) return t.id;
  const n = t.text.trim();
  for (let r = e.length - 1; r >= 0; r -= 1) {
    const o = e[r];
    if (o.role === "assistant" && o.text.trim() === n) return o.message_id;
  }
  return null;
}
function Fm(e) {
  const t = e.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().split(new RegExp("(?<=[。！？.!?])"))[0] || "";
  return `深挖：${[...t].slice(0, 30).join("")}${[...t].length > 30 ? "…" : ""}`;
}
const Bm = 50, Bn = { conversation: null, main: null, records: [], compactions: [], hasMore: !1, key: "local", initial: [] };
function Hm() {
  var t, n;
  return `c-${((n = (t = globalThis.crypto) == null ? void 0 : t.randomUUID) == null ? void 0 : n.call(t)) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}
function $o(e) {
  var n, r, o, a;
  const t = e;
  return `${(t == null ? void 0 : t.reason) || ((n = t == null ? void 0 : t.details) == null ? void 0 : n.reason) || ((a = (o = (r = t == null ? void 0 : t.payload) == null ? void 0 : r.error) == null ? void 0 : o.details) == null ? void 0 : a.reason) || (e instanceof Error ? e.message : "")}`;
}
function jm({ port: e, book: t, onAppended: n }) {
  const r = (e == null ? void 0 : e.conversations) ?? null, o = (e == null ? void 0 : e.memories) ?? null, [a, s] = N(!1), [i, c] = N(Bn), [l, u] = N(!1), [m, f] = N(""), [d, g] = N("idle"), [h, y] = N(null), [v, S] = N([]), b = L((B) => {
    y(B), S([]);
  }, []), T = L((B) => S((W) => [...W, B].slice(-2)), []), [w, R] = N(() => /* @__PURE__ */ new Map()), M = _(/* @__PURE__ */ new Set()), E = _(/* @__PURE__ */ new Map()), D = (B) => {
    if (!B) return null;
    const W = E.current.get(B);
    return W || (A.current.records.some((Y) => Y.message_id === B) ? B : null);
  }, A = _(i);
  A.current = i;
  const I = _(t);
  I.current = t;
  const k = _(0), P = L(async (B, W, Y, de = []) => {
    if (!r) return;
    const ne = await r.messages(B.conversation_id, { limit: Bm, ...Y ? { beforeSeq: Y } : {} }), ae = [...ne.messages, ...de];
    k.current += 1, c({
      conversation: B,
      main: W ?? B,
      records: ae,
      compactions: ne.compactions || [],
      hasMore: ne.has_more,
      key: `${B.conversation_id}:${k.current}`,
      initial: Cm(ae, ne.compactions || [], I.current.documentId)
    });
  }, [r]), $ = L(async () => {
    s(!0);
    const B = A.current.conversation;
    if (!(!r || (B == null ? void 0 : B.kind) === "main" && B.status !== "archived")) {
      u(!0), f("");
      try {
        const W = await r.main(I.current.documentId || void 0);
        await P(W, W);
      } catch (W) {
        f(W instanceof Error ? W.message : String(W));
      } finally {
        u(!1);
      }
    }
  }, [r, P]), z = L((B) => {
    b(B), $();
  }, [$]), K = _(t.documentId);
  O(() => {
    K.current !== t.documentId && (K.current = t.documentId, A.current = Bn, c(Bn), b(null), R(/* @__PURE__ */ new Map()), E.current.clear(), a && $());
  }, [t.documentId, a, $]);
  const j = L(async () => {
    const B = A.current, W = B.records[0];
    if (!(!B.conversation || !W || !B.hasMore)) {
      u(!0);
      try {
        await P(B.conversation, B.main, W.seq, B.records);
      } finally {
        u(!1);
      }
    }
  }, [P]), J = L(async (B) => {
    const Y = A.current.conversation;
    if (!r || !Y) return;
    for (const Z of B.memoryIds) M.current.add(Z);
    let de = B.memoryIds;
    if (!de.length && o && B.startedAt) {
      const Z = Om(
        await o.list({ source_conversation_id: Y.conversation_id, created_after: Dm(B.startedAt) }).catch(() => []),
        M.current
      );
      for (const x of Z) M.current.add(x.id);
      de = Z.map((x) => x.id);
      const fe = B.answerId;
      Z.length && fe && R((x) => new Map(x).set(fe, Z));
    }
    const ne = $m({ ...B, memoryIds: de }, I.current.documentId, Hm(), D(B.editedFrom));
    let ae;
    try {
      ae = await r.append(Y.conversation_id, ne);
    } catch (Z) {
      if (Y.kind !== "side" || !/ask_conversation_not_open/.test($o(Z))) throw Z;
      await r.reopen(Y.conversation_id), ae = await r.append(Y.conversation_id, ne);
    }
    const [Se, ee] = ae.messages;
    B.questionId && Se && E.current.set(B.questionId, Se.message_id), B.answerId && ee && E.current.set(B.answerId, ee.message_id), c((Z) => {
      var fe;
      return ((fe = Z.conversation) == null ? void 0 : fe.conversation_id) === Y.conversation_id ? { ...Z, conversation: ae.conversation, records: [...Z.records, ...ae.messages] } : Z;
    }), n == null || n(ae.messages), ae.compaction_due && Y.kind === "main" && r.compact(Y.conversation_id).catch(() => {
    });
  }, [r, o, n]), oe = L(async (B) => {
    const W = A.current.conversation, Y = D(B);
    if (!r || !W || !Y) return null;
    try {
      await r.supersede(W.conversation_id, Y);
    } catch (ae) {
      if (!/ask_message_superseded/.test($o(ae))) throw ae;
    }
    const de = A.current.records.find((ae) => ae.message_id === Y), ne = A.current.records.findIndex((ae) => ae.message_id === Y);
    return c((ae) => ({ ...ae, records: ae.records.map((Se, ee) => ee >= ne && ne >= 0 && !Se.superseded_at ? { ...Se, superseded_at: "now" } : Se) })), (de == null ? void 0 : de.selection) ?? null;
  }, [r]), q = L((B) => {
    J(B).catch((W) => f(`这一轮没存上：${W instanceof Error ? W.message : String(W)}`));
  }, [J]), se = L(async (B) => {
    var de;
    const W = A.current, Y = W.main;
    if (!(!r || !Y || ((de = W.conversation) == null ? void 0 : de.kind) !== "main")) {
      f("");
      try {
        const ne = zm(W.records, B), ae = await r.fork({
          parent_id: Y.conversation_id,
          ...ne ? { forked_from_message_id: ne } : {},
          title: Fm(B.text),
          ...I.current.documentId ? { document_id: I.current.documentId } : {}
        });
        await P(ae, Y);
      } catch (ne) {
        f(`开不了副对话：${ne instanceof Error ? ne.message : String(ne)}`);
      }
    }
  }, [r, P]), Ee = L(async (B) => {
    const W = A.current.main;
    if (r)
      try {
        await P(await r.get(B), W);
      } catch (Y) {
        f(`打不开副对话：${Y instanceof Error ? Y.message : String(Y)}`);
      }
  }, [r, P]), re = L(async () => {
    const B = A.current.main;
    B && await P(B, B).catch(() => {
    });
  }, [P]), ue = L(async () => {
    const B = A.current.conversation;
    if (!(!r || (B == null ? void 0 : B.kind) !== "side")) {
      g("busy");
      try {
        await r.close(B.conversation_id), g("idle"), await re();
      } catch {
        g("failed");
      }
    }
  }, [r, re]), Me = L(async () => r != null && r.archived ? r.archived(I.current.documentId) : [], [r]), ie = L(async (B) => {
    f(""), b(null);
    try {
      await P(B, A.current.main);
    } catch (W) {
      f(`打不开这个对话：${W instanceof Error ? W.message : String(W)}`);
    }
  }, [P, b]), le = L(async () => {
    const B = A.current.main;
    if (!r || !B) return;
    await r.archive(B.conversation_id);
    const W = await r.main(I.current.documentId || void 0);
    await P(W, W);
  }, [r, P]);
  return {
    visible: a,
    view: i,
    loading: l,
    error: m,
    pending: h,
    setPending: b,
    extras: v,
    addExtra: T,
    closingSide: d,
    notices: w,
    persistent: !!r,
    openMain: $,
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
function Do(e, t, n) {
  var c;
  const r = e.selection, o = e.page ?? (r == null ? void 0 : r.page) ?? 0;
  if (e.role !== "user" || !o) return null;
  const a = (e.pane ?? (r == null ? void 0 : r.pane)) === "source" ? "source" : "translated", s = ((c = r == null ? void 0 : r.item_ids) == null ? void 0 : c[0]) ?? null, i = xm({ item_ids: [], ...r, page: o, pane: a }, n(s, a, o));
  return { key: t, anchor: i, messageId: e.message_id, title: e.text.slice(0, 80) };
}
function Um({ port: e, documentId: t, resetKey: n, pointOf: r }) {
  const [o, a] = N([]), s = _(0), i = _(r);
  i.current = r;
  const c = () => (s.current += 1, s.current);
  O(() => {
    var d, g;
    if (a([]), !e || !t) return;
    let m = !1;
    const f = (h) => {
      !m && h.length && a((y) => [...y, ...h]);
    };
    return (d = e.threads) == null || d.list(t).then(
      (h) => f(h.map((y) => ({ key: c(), anchor: y.anchor, threadId: y.threadId, title: y.title }))),
      () => {
      }
    ), (g = e.conversations) == null || g.bookMessages(t).then(
      (h) => f(h.map((y) => Do(y, c(), i.current)).filter((y) => !!y)),
      () => {
      }
    ), () => {
      m = !0;
    };
  }, [e, t, n]);
  const l = L((m) => {
    const f = m.filter((d) => !d.document_id || d.document_id === t).map((d) => Do(d, c(), i.current)).filter((d) => !!d);
    f.length && a((d) => [...d.filter((g) => !f.some((h) => h.messageId === g.messageId)), ...f]);
  }, [t]), u = L((m) => a((f) => f.filter((d) => d.key !== m)), []);
  return { marks: o, addRecords: l, removeMark: u };
}
const Wm = Ta(() => import("./ReaderAskPanel-BNdAJO0I.js"));
function Km({
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
  editBlock: m,
  jumpToBlock: f,
  pdfDocuments: d,
  currentPage: g,
  visibleMode: h,
  activePanel: y = null,
  panelHost: v = null
}) {
  const S = U(() => ({ documentId: t, jobId: n, versionId: r }), [t, n, r]), b = L((x, H, V) => {
    const me = x ? o.find((Ae) => Ae.itemId === x) : null, ye = me ? mt(me, a, H) : null, Te = ye && ye.box.page === V ? lt(ye, 1, 1) : null;
    return Te ? { x: Te.left, y: Te.top } : null;
  }, [o, a]), T = Um({ port: e, documentId: t, resetKey: c, pointOf: b }), w = jm({ port: e, book: S, onAppended: T.addRecords }), [R, M] = N(null), E = L(
    (x, H, V, me) => Em({
      pageElement: (x == null ? void 0 : x.closest(`[${Ie}]`)) ?? null,
      clientX: H,
      clientY: V,
      itemId: i(),
      selection: me,
      regions: o,
      bookmarks: s,
      metadata: a
    }),
    [i, o, s, a]
  ), D = L(() => {
    var H;
    const x = Lo(((H = globalThis.getSelection) == null ? void 0 : H.call(globalThis)) ?? null);
    return !x.text || !x.element || !x.rect ? null : E(x.element, x.rect.left + x.rect.width / 2, x.rect.top + x.rect.height / 2, x.text);
  }, [E]), A = L((x) => {
    M(null), w.ask(x);
  }, [w.ask]);
  O(() => {
    if (!e) return;
    const x = (H) => {
      var ye;
      if (H.key !== "?" || H.metaKey || H.ctrlKey || H.altKey || H.defaultPrevented) return;
      const V = H.target;
      if ((ye = V == null ? void 0 : V.closest) != null && ye.call(V, "input, textarea, select, [contenteditable='true']")) return;
      const me = D();
      me && (H.preventDefault(), H.stopImmediatePropagation(), A(me));
    };
    return window.addEventListener("keydown", x, !0), () => window.removeEventListener("keydown", x, !0);
  }, [e, D, A]);
  const I = _(d);
  I.current = d;
  const k = L(async ({ page: x, pane: H, region: V, canvas: me }) => {
    const ye = I.current[H];
    let Te;
    if (ye)
      Te = await sm(ye, x, V);
    else {
      const Ae = me ?? document.querySelector(`[${we}="${H}"] [${Ie}="${x}"] canvas`);
      if (!Ae) throw new Error(`第 ${x} 页还没画出来，翻到那一页再试`);
      Te = await im(Ae, V);
    }
    return new File([Te], cm(x, V), { type: "image/png" });
  }, []), [P, $] = N(null), z = _(w.pending);
  z.current = w.pending;
  const K = U(() => [{
    key: "page",
    label: "带上这一页",
    title: "带上这一页的截图（问的那一页，没有就是现在读的这页）：公式、图表、表格让 AI 直接看图",
    icon: /* @__PURE__ */ p(_i, { size: 14, "aria-hidden": !0 }),
    run: () => {
      const x = z.current, H = (x == null ? void 0 : x.pane) || (h === "translated" ? "translated" : "source");
      return k({ page: (x == null ? void 0 : x.page) || g() || 1, pane: H, region: Er });
    }
  }], [k, g, h]), [j, J] = N(!1), [oe, q] = N(""), se = L(async (x) => {
    J(!1), q("");
    try {
      const H = await k(x), V = E(x.point.target, x.point.x, x.point.y, "");
      $((me) => ({ id: ((me == null ? void 0 : me.id) || 0) + 1, files: [H] })), V ? A({ ...V, itemId: null, sourceText: "", translatedText: "" }) : w.openMain();
    } catch (H) {
      q(H instanceof Error ? H.message : String(H));
    }
  }, [k, E, A]), Ee = L(() => J(!1), []), re = L(() => {
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
    M(null), w.openMain();
  }, [e, t, w.openMain]), Me = L((x) => {
    var me;
    if (!e) return [];
    const H = Lo(((me = globalThis.getSelection) == null ? void 0 : me.call(globalThis)) ?? null), V = E(x.target, x.clientX, x.clientY, H.element ? H.text : "");
    return V ? [{
      key: "ask",
      label: V.selection ? "问这段" : "在这里提问",
      hint: V.selection ? "?" : void 0,
      // 选着字时也出现在选字浮条上（「复制 · 收藏 · 提问」，ReaderSelectionLayer）。
      inSelectionBar: V.selection ? "提问" : void 0,
      onSelect: () => A(V)
    }, {
      key: "crop",
      label: "截一块问",
      onSelect: () => {
        q(""), J(!0);
      }
    }] : [];
  }, [e, E, A]), ie = R ? {
    anchor: R.anchor,
    messages: R.messages,
    onClose: () => M(null),
    onDelete: e != null && e.threads && R.mark.threadId ? () => {
      e.threads.remove(t, R.mark.threadId).catch(() => {
      }), T.removeMark(R.mark.key), M(null);
    } : void 0
  } : null, le = U(() => m ? (x, H) => {
    m(x, H ?? void 0), requestAnimationFrame(() => f(x, "translated"));
  } : null, [m, f]), B = L((x) => is(o, x), [o]), [W, Y] = N(0), de = L(({ mode: x, width: H }) => {
    Y(x === "dock" ? Math.round(H) : 0);
  }, []), ne = !w.persistent || !!w.view.conversation || !!w.error, ae = e && (w.visible && ne || R) ? /* @__PURE__ */ p(Sa, { fallback: null, children: /* @__PURE__ */ p(
    Wm,
    {
      port: e,
      jobId: n,
      book: S,
      ask: w,
      legacy: ie,
      onShowSelection: ({ page: x, pane: H }) => l(x, H),
      onJumpToPage: (x) => l(x),
      pageCount: u,
      onLayout: de,
      dockTaken: y !== null,
      dockHost: v,
      onEditBlock: le,
      canEditBlock: B,
      attachTools: K,
      attachRequest: P
    }
  ) }) : null, Se = j || oe ? /* @__PURE__ */ C(Ne, { children: [
    j ? /* @__PURE__ */ p(Pm, { onDone: (x) => void se(x), onCancel: Ee }) : null,
    oe ? /* @__PURE__ */ C("p", { className: "reader-ask-crop-error", role: "alert", onClick: () => q(""), children: [
      "截图没成：",
      oe
    ] }) : null
  ] }) : null, ee = w.visible && ne || !!R, Z = w.close, fe = L(() => {
    if (ee) {
      M(null), Z();
      return;
    }
    w.openMain();
  }, [ee, Z, w.openMain]);
  return { marks: T.marks, onMark: ue, menuItems: Me, panel: ae, overlay: Se, cropping: j, toggleCrop: re, open: w.openMain, toggle: fe, showing: ee, reserveRight: ee ? W : 0, enabled: !!e };
}
const Vm = [{ keys: "选字 + ?", desc: "问选中的这段" }];
function qm() {
  const e = Ct(), t = U(() => {
    try {
      return Ze().ask ?? null;
    } catch {
      return null;
    }
  }, []), n = Km({
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
  }), { marks: r, onMark: o, menuItems: a, panel: s, overlay: i, cropping: c, toggleCrop: l, enabled: u, toggle: m, showing: f, reserveRight: d } = n, g = U(() => u ? {
    toolbarItems: [{
      key: "ask",
      label: "提问",
      title: "提问：问整本书、翻这本书以前的对话（问某一段：书页上右键，或选字按 ?）",
      Icon: Aa,
      pressed: f,
      onClick: m
    }, {
      // 底栏右边：框出书页上的一块，截图带进提问（和右键「截一块问」一样）。
      key: "crop",
      label: "截图",
      title: "截图：在书页上框出一块，带进提问（Esc 取消）",
      Icon: Li,
      place: "bottom",
      pressed: c,
      onClick: l
    }],
    menuItems: a,
    pageLayer: r.length ? ({ page: h, height: y }) => /* @__PURE__ */ p(rm, { marks: r, page: h, height: y, onOpen: o }) : void 0,
    shortcuts: Vm,
    reserveRight: d,
    // 「截一块问」时占着书页上的指针：不出悬停框、不选字。
    takesPointer: c
  } : {}, [u, a, r, o, m, f, d, c, l]);
  return an(g), /* @__PURE__ */ C(Ne, { children: [
    s,
    i
  ] });
}
const Jm = { id: "ask", title: "提问", Component: qm };
function tr() {
  try {
    return Ze().translationVersions ?? null;
  } catch {
    return null;
  }
}
function Gm(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function Xm(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function Ym(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function Zm({ documentId: e, jobId: t }) {
  const [n, r] = N([]), [o, a] = N(null);
  O(() => {
    r([]);
    const i = tr();
    if (!i || !e) return;
    let c = !1;
    return i.list(e).then((l) => {
      c || (r(l.versions), a(l.currentVersionId));
    }).catch(() => {
    }), () => {
      c = !0;
    };
  }, [e, t]);
  const s = Xm(n, t, o);
  return U(() => ({ versions: n, readingVersionId: s }), [n, s]);
}
function Qm({ documentId: e, jobId: t, versions: n, readingVersionId: r }) {
  const [o, a] = N(null), [s, i] = N(""), [c, l] = N(""), u = _(0);
  O(() => {
    u.current += 1, a(null), i(""), l("");
  }, [e, t]);
  const m = L((g) => {
    const h = tr(), y = n.find((S) => S.versionId === g);
    if (!h || !y || !e) return;
    const v = ++u.current;
    i(g), l(""), (async () => {
      const S = Ze(), b = await h.resolveJob(e, g);
      if (!b) throw new Error("这一份还没有能读的译文。");
      const T = await S.loadReaderPayload(b, { includeOptionalArtifacts: !0 }), w = S.resolveReaderTranslatedPdfUrl(T.jobPayload, T.manifestPayload);
      if (!w) throw new Error("这一份没有译文 PDF。");
      return { versionId: g, name: y.name, jobId: b, url: w, regions: Gm(Ia(T.regionsPayload)) };
    })().then((S) => {
      v === u.current && a(S);
    }).catch((S) => {
      v === u.current && l((S == null ? void 0 : S.message) || "这一份打不开。");
    }).finally(() => {
      v === u.current && i("");
    });
  }, [e, n]), f = L(() => {
    u.current += 1, a(null), i(""), l("");
  }, []), d = L(async () => {
    var y, v;
    const g = tr();
    if (!g || !o || !e) return;
    try {
      await g.select(e, o.versionId);
    } catch (S) {
      l((S == null ? void 0 : S.message) || "换不过去，请稍后再试。");
      return;
    }
    const h = (y = globalThis.location) == null ? void 0 : y.href;
    h && ((v = globalThis.history) == null || v.replaceState(globalThis.history.state, "", Ym(h, o.jobId))), a(null);
  }, [o, e]);
  return U(() => ({
    available: n.length >= 2,
    versions: n,
    readingVersionId: r,
    compared: o,
    loading: s,
    error: c,
    choose: m,
    clear: f,
    adopt: d
  }), [n, r, o, s, c, m, f, d]);
}
function eh(e) {
  return e.available ? {
    key: "compare",
    label: "对比版本",
    title: "对比版本：左边换成这本书的另一份译文",
    Icon: Ci,
    place: "compare",
    pressed: !!(e.compared || e.loading),
    popup: (t) => /* @__PURE__ */ p(Rf, { compare: e, onDone: t })
  } : null;
}
function th(e) {
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
function nh() {
  var i;
  const e = Ct(), t = Qm({
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
    const c = eh(t);
    return { toolbarItems: c ? [c] : [], comparedDocument: th(t) };
  }, [t]);
  return an(s), null;
}
const rh = { id: "compare", title: "对比版本", Component: nh }, ke = (e) => {
  const t = Number(e);
  return Number.isFinite(t) ? t : 0;
}, Oo = (e) => {
  const t = Array.isArray(e) ? e : [];
  return [ke(t[0]), ke(t[1]), ke(t[2])];
};
function zo([e, t, n]) {
  const r = Math.max(e, t, n) > 1 ? 1 : 255, o = (a) => Math.round(Math.min(255, Math.max(0, a * r)));
  return `rgb(${o(e)}, ${o(t)}, ${o(n)})`;
}
function oh(e, t = []) {
  const n = e && typeof e == "object" ? e : null;
  if (!n || !`${n.schema || ""}`.startsWith("rpr_layout_")) return null;
  const r = /* @__PURE__ */ new Map();
  for (const o of Array.isArray(n.pages) ? n.pages : []) {
    const a = o, s = Math.floor(ke(a.index));
    if (s < 0 || !(ke(a.width) > 0) || !(ke(a.height) > 0)) continue;
    const i = (Array.isArray(a.covers) ? a.covers : []).flatMap((l) => {
      const u = l, m = Array.isArray(u.rect) ? u.rect.map(ke) : [];
      return m.length === 4 && m[2] > m[0] && m[3] > m[1] ? [{ block: `${u.block || ""}`, rect: m, fill: Oo(u.fill) }] : [];
    }), c = (Array.isArray(a.blocks) ? a.blocks : []).flatMap((l) => {
      const u = l, m = ke(u.fontSize);
      if (!(m > 0)) return [];
      const f = (Array.isArray(u.lines) ? u.lines : []).map((d) => {
        const g = d, h = (Array.isArray(g.items) ? g.items : []).flatMap((y) => {
          const v = y;
          return typeof v.tex == "string" ? [{ x: ke(v.x), tex: v.tex, display: !!v.display, w: ke(v.w), h: ke(v.h), d: ke(v.d) }] : typeof v.t == "string" && v.t ? [v.mode === "dflt" ? { x: ke(v.x), t: v.t, mode: "dflt" } : { x: ke(v.x), t: v.t }] : [];
        });
        return { text: `${g.text || ""}`, x: ke(g.x), baseline: ke(g.baseline), width: ke(g.width), justified: !!g.justified, items: h };
      });
      return [{ id: `${u.id || ""}`, fontSize: m, weight: u.weight === "bold" ? "bold" : "regular", color: Oo(u.color), lines: f }];
    });
    r.set(s + 1, { index: s, width: ke(a.width), height: ke(a.height), covers: i, blocks: c });
  }
  return { schema: `${n.schema}`, pages: r, fonts: t };
}
async function ah(e, t = fetch) {
  var s;
  const n = new URL(e, (s = globalThis.location) == null ? void 0 : s.href), r = await (await t(n.href)).json(), o = (r.fonts || []).flatMap((i) => i.family && i.url ? [{ family: i.family, weight: ke(i.weight) || 400, url: new URL(i.url, n).href }] : []), a = await (await t(new URL(r.layout || "layout.json", n).href)).json();
  return oh(a, o);
}
function sh(e) {
  return [...[...new Set(e.map((n) => n.family))].map((n) => `"${n.replace(/"/g, "")}"`), "serif"].join(", ");
}
const Fo = /* @__PURE__ */ new Set();
async function ih(e) {
  const t = `${e.family}|${e.weight}|${e.url}`;
  if (Fo.has(t)) return !0;
  for (let n = 0; n < 2; n += 1)
    try {
      const r = new FontFace(e.family, `url(${JSON.stringify(e.url)})`, { weight: `${e.weight}` });
      return document.fonts.add(await r.load()), Fo.add(t), !0;
    } catch (r) {
      n === 1 && console.warn("[render-layout] 字体没装上：", e.family, e.url, r);
    }
  return !1;
}
async function ch(e) {
  var r;
  if (typeof FontFace > "u" || typeof document > "u" || !document.fonts) return !1;
  const t = (r = e[0]) == null ? void 0 : r.family, n = await Promise.all(e.map(async (o) => ({ font: o, ok: await ih(o) })));
  return !!t && n.every(({ font: o, ok: a }) => a || o.family !== t);
}
function lh() {
  var e;
  try {
    return new URLSearchParams(((e = globalThis.location) == null ? void 0 : e.search) || "").get("render_layout") || "";
  } catch {
    return "";
  }
}
function uh() {
  const [e, t] = N(null);
  return O(() => {
    const n = lh();
    if (!n) return;
    let r = !0;
    return ah(n).then(async (o) => {
      if (!o) return;
      if (!await ch(o.fonts)) {
        console.warn("[render-layout] 主字体没装全，HTML 页退回按 OCR 的框塞字");
        return;
      }
      r && t(o);
    }).catch((o) => console.warn("[render-layout] 版面没读到：", n, o)), () => {
      r = !1;
    };
  }, []), e;
}
const dh = '"Times New Roman", "Tinos", "Liberation Serif", "Source Han Serif SC", "Noto Serif CJK SC", serif', mn = 1.5;
function fh(e, t) {
  const n = Ce(e);
  if (n === "formula") {
    const o = `${e.markdown || e.source.text || ""}`.trim();
    return o ? { kind: "display_formula", content: o } : null;
  }
  if (n !== "text") return null;
  const r = t === "translated" ? `${e.translatedBlockText || e.markdown || e.translated.text || ""}`.trim() : `${e.source.text || ""}`.trim();
  return r ? { kind: e.regionType || "text", content: r } : null;
}
function mh(e) {
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
function hh({ page: e, width: t, height: n, regions: r, metadata: o, text: a, arrivedAt: s }) {
  const { items: i, scale: c } = U(() => {
    var f;
    const l = [];
    let u = 0;
    const m = [...r].sort((d, g) => (d.readingOrder ?? 0) - (g.readingOrder ?? 0));
    for (const d of m) {
      const g = fh(d, a);
      if (!g) continue;
      const h = mt(d, o, "source");
      if (!h || h.box.page !== e) continue;
      const y = lt(h, t, n);
      !y || y.width < 2 || y.height < 2 || (!u && ((f = h.pageSize) != null && f.width) && (u = t / h.pageSize.width), l.push({
        order: l.length,
        item: {
          itemId: d.itemId,
          translatedText: g.content,
          status: "html",
          kind: g.kind,
          sourceText: d.source.text || "",
          typography: a === "source" && g.kind !== "display_formula" ? { font_family: dh } : void 0,
          rect: {
            left: y.left - mn,
            top: y.top - mn,
            width: y.width + mn * 2,
            height: y.height + mn * 2
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
      children: /* @__PURE__ */ p(Tr, { item: l, pageScale: c })
    },
    `${l.itemId}:${l.changedAtSeq}`
  )) }) : null;
}
function ph(e) {
  var r;
  if (!e) return null;
  const t = /<svg([^>]*)>([\s\S]*)<\/svg>/i.exec(e);
  if (!t) return null;
  const n = (r = /viewBox="([^"]+)"/i.exec(t[1])) == null ? void 0 : r[1];
  return n ? { viewBox: n, inner: t[2] } : null;
}
const Bt = /* @__PURE__ */ new Map(), gh = 512;
function yh(e) {
  let t = Bt.get(e);
  if (!t && (t = Yi(e, !1).then(ph), Bt.set(e, t), Bt.size > gh)) {
    const n = Bt.keys().next().value;
    n !== void 0 && Bt.delete(n);
  }
  return t;
}
function bh(e) {
  var n;
  let t = e.querySelector('g[data-mml-node="math"]');
  for (; t && t.children.length === 1 && ((n = t.firstElementChild) != null && n.hasAttribute("data-mml-node")); ) t = t.firstElementChild;
  return t ? [...t.children] : [];
}
const Bo = "rgb(40, 110, 215)", vh = () => {
  var e;
  try {
    return ((e = globalThis.matchMedia) == null ? void 0 : e.call(globalThis, "(prefers-reduced-motion: reduce)").matches) ?? !1;
  } catch {
    return !1;
  }
};
function wh(e) {
  if (vh() || typeof e.animate != "function") return;
  const t = bh(e), n = Math.min(220, 1200 / Math.max(1, t.length));
  t.forEach((r, o) => {
    var a;
    (a = r.animate) == null || a.call(
      r,
      [{ opacity: 0, transform: "translate(0px, -600px)" }, { opacity: 1, transform: "translate(0px, 0px)" }],
      { duration: 460, delay: o * n, easing: "cubic-bezier(.2, .75, .25, 1)", fill: "backwards" }
    );
  }), e.animate(
    [{ color: Bo }, { color: Bo, offset: 0.75 }, { color: "currentColor" }],
    { duration: t.length * n + 900, easing: "ease-out" }
  );
}
function Sh({ page: e, width: t, height: n, fontFamily: r, arrivedAt: o, charRise: a = !1 }) {
  const s = U(() => {
    const d = /* @__PURE__ */ new Set();
    for (const g of e.blocks) for (const h of g.lines) for (const y of h.items) "tex" in y && d.add(y.tex);
    return [...d];
  }, [e]), i = U(() => {
    const d = /* @__PURE__ */ new Map();
    for (const g of e.blocks) {
      let h = 0;
      d.set(g.id, g.lines.map((y) => {
        const v = h;
        return h += y.items.length, v;
      }));
    }
    return d;
  }, [e]), [c, l] = N(() => /* @__PURE__ */ new Map());
  O(() => {
    let d = !0;
    return Promise.all(s.map(async (g) => [g, await yh(g)])).then((g) => {
      d && l(new Map(g));
    }), () => {
      d = !1;
    };
  }, [s]);
  const u = Date.now() - o < 1500, m = _(null);
  O(() => {
    const d = m.current;
    if (!a || !d || typeof IntersectionObserver > "u") return;
    const g = [...d.querySelectorAll(".reader-layout-block")];
    for (const y of g) y.removeAttribute("data-risen");
    const h = new IntersectionObserver((y) => {
      for (const v of y)
        v.isIntersecting && (v.target.setAttribute("data-risen", ""), h.unobserve(v.target));
    }, { threshold: 0.2 });
    for (const y of g) h.observe(y);
    return () => h.disconnect();
  }, [a, e]);
  const f = (d) => {
    var g;
    `${((g = globalThis.getSelection) == null ? void 0 : g.call(globalThis)) || ""}`.trim() || wh(d.currentTarget);
  };
  return /* @__PURE__ */ C(
    "svg",
    {
      ref: m,
      className: `reader-layout-page${a ? " is-char-rise" : ""}`,
      "data-html-page": e.index + 1,
      viewBox: `0 0 ${e.width} ${e.height}`,
      width: t,
      height: n,
      preserveAspectRatio: "none",
      style: { fontFamily: r },
      children: [
        e.covers.map((d, g) => /* @__PURE__ */ p(
          "rect",
          {
            x: d.rect[0],
            y: d.rect[1],
            width: d.rect[2] - d.rect[0],
            height: d.rect[3] - d.rect[1],
            fill: zo(d.fill)
          },
          `${d.block}:${g}`
        )),
        e.blocks.map((d, g) => {
          const h = zo(d.color);
          return /* @__PURE__ */ p(
            "g",
            {
              className: `reader-layout-block${u ? " is-arriving" : ""}`,
              "data-html-block": d.id,
              fill: h,
              fontSize: d.fontSize,
              fontWeight: d.weight === "bold" ? 700 : 400,
              style: { "--reader-html-order": g, color: h },
              children: d.lines.map((y, v) => y.items.map((S, b) => {
                var R;
                const T = `${v}:${b}`, w = (((R = i.get(d.id)) == null ? void 0 : R[v]) ?? 0) + b;
                if ("tex" in S) {
                  const M = c.get(S.tex), E = d.fontSize;
                  return M ? /* @__PURE__ */ p(
                    "svg",
                    {
                      className: "reader-layout-math",
                      x: S.x,
                      y: y.baseline - S.h * E,
                      width: Math.max(0.01, S.w * E),
                      height: Math.max(0.01, (S.h + S.d) * E),
                      viewBox: M.viewBox,
                      preserveAspectRatio: "none",
                      "data-tex": S.tex,
                      "data-baseline": y.baseline,
                      style: { "--i": w },
                      onClick: f,
                      dangerouslySetInnerHTML: { __html: M.inner }
                    },
                    T
                  ) : null;
                }
                return /* @__PURE__ */ p("text", { x: S.x, y: y.baseline, lang: S.mode === "dflt" ? "en" : "zh-Hans", style: { "--i": w }, children: S.t }, T);
              }))
            },
            `${d.id}:${o}:${a ? "rise" : ""}`
          );
        })
      ]
    }
  );
}
const Th = [
  { value: null, label: "关", hint: "看原来的 PDF" },
  { value: "translated", label: "画译文", hint: "原文页上按 OCR 的框用 HTML 画译文" },
  { value: "source", label: "画原文", hint: "原文页上按 OCR 的框用 HTML 重画原文" }
];
function kh() {
  const e = Ct(), [t, n] = N(null), [r, o] = N(0), [a, s] = N(!1), i = U(() => mh(e.regions), [e.regions]), c = uh(), l = U(() => sh((c == null ? void 0 : c.fonts) ?? []), [c]), u = !e.sourceOnly, { metadata: m, visibleMode: f, setWorkspace: d } = e, g = U(() => {
    const h = (y) => {
      n(y), o(Date.now()), y && f === "translated" && d("source");
    };
    return {
      toolbarItems: [{
        key: "html-page",
        label: "HTML 页",
        title: t ? `HTML 页：${t === "translated" ? c ? "画译文（照排版引擎的版面）" : "画译文" : "画原文"}（点开换）` : "HTML 页：把书页用 HTML 画出来",
        Icon: $i,
        pressed: !!t,
        popup: (y) => /* @__PURE__ */ C("div", { className: "reader-html-page-menu reader-floating-surface", role: "menu", "aria-label": "HTML 页", children: [
          Th.filter((v) => v.value !== "translated" || u).map((v) => /* @__PURE__ */ p(
            G,
            {
              className: "reader-html-page-choice",
              role: "menuitemradio",
              "aria-checked": t === v.value,
              title: v.hint,
              onClick: () => {
                h(v.value), y();
              },
              children: v.label
            },
            v.label
          )),
          c ? /* @__PURE__ */ C(Ne, { children: [
            /* @__PURE__ */ p("span", { className: "reader-html-page-menu-sep", "aria-hidden": !0 }),
            /* @__PURE__ */ p(
              G,
              {
                className: "reader-html-page-choice",
                role: "menuitemcheckbox",
                "aria-checked": a,
                title: "一段话滚进来时，字一个接一个浮上来",
                onClick: () => {
                  s((v) => !v), t || h("translated"), y();
                },
                children: "逐字浮现"
              }
            ),
            /* @__PURE__ */ p("p", { className: "reader-html-page-menu-note", children: "点公式会分步展开" })
          ] }) : null
        ] })
      }],
      pageLayer: t ? ({ page: y, width: v, height: S, pane: b, active: T }) => {
        if (!T || b !== "source") return null;
        if (t === "translated" && c) {
          const w = c.pages.get(y);
          return w ? /* @__PURE__ */ p(Sh, { page: w, width: v, height: S, fontFamily: l, arrivedAt: r, charRise: a }) : null;
        }
        return /* @__PURE__ */ p(
          hh,
          {
            page: y,
            width: v,
            height: S,
            regions: i.get(y) ?? [],
            metadata: m,
            text: t,
            arrivedAt: r
          }
        );
      } : void 0
    };
  }, [t, r, i, m, u, f, d, c, l, a]);
  return an(g), null;
}
const Ih = { id: "html-page", title: "HTML 页", Component: kh }, Is = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], Ho = { pen: 35e-4, highlighter: 0.018 }, jo = 0.015, nr = "retainpdf.reader.ink.v1:";
function Uo(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(nr + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function Eh(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(nr + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(nr + e);
    } catch {
    }
}
function Rh(e, t, n, r, o, a) {
  const s = jo * jo;
  return e.filter((i) => Es(i, t, n) && i.points.some(([c, l]) => (c - r) ** 2 + ((l - o) * a) ** 2 <= s)).map((i) => i.id);
}
function Es(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function Ph(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function Mh(e) {
  const [t, n] = N(null), [r, o] = N(Is[0].key), [a, s] = N(() => Uo(e)), i = _(a), c = _([]);
  O(() => {
    const h = Uo(e);
    i.current = h, s(h), c.current = [];
  }, [e]);
  const l = L((h) => {
    i.current = h, s(h), Eh(e, h);
  }, [e]), u = L((h) => {
    const y = i.current, v = h(y);
    v !== y && (c.current = [...c.current.slice(-49), y], l(v));
  }, [l]), m = L((h) => {
    h.points.length < 1 || u((y) => [...y, { ...h, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [u]), f = L((h) => {
    h.length && u((y) => y.filter((v) => !h.includes(v.id)));
  }, [u]), d = L((h) => {
    u((y) => y.some((v) => v.page === h) ? y.filter((v) => v.page !== h) : y);
  }, [u]), g = L(() => {
    const h = c.current.pop();
    h && l(h);
  }, [l]);
  return U(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: m, erase: f, undo: g, clearPage: d }),
    [t, r, a, m, f, g, d]
  );
}
const xh = [
  { tool: "pen", label: "画笔", Icon: vn },
  { tool: "highlighter", label: "荧光笔", Icon: Di },
  { tool: "eraser", label: "橡皮", Icon: Oi }
];
function Nh(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Ah({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ C(Ne, { children: [
    xh.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
      G,
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
    Is.map((o) => /* @__PURE__ */ p(
      G,
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
    /* @__PURE__ */ p(G, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(zi, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      G,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p(Fi, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null,
    e.tool ? /* @__PURE__ */ p(
      G,
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
function Wo({ ink: e, page: t, onPick: n }) {
  return /* @__PURE__ */ p("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ p(Ah, { ink: e, page: t, onPick: n }) });
}
function _h(e) {
  const t = _(e);
  t.current = e, O(() => {
    const n = (r) => {
      if (Nh(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
const Lh = "reader-ink-layer";
function Ch(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function Ko({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: Ch(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function $h({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = N(null), i = _(!1), c = o.strokes.filter((h) => Es(h, e, t)), l = !!o.tool;
  if (!l && !c.length) return null;
  const u = (h) => {
    const y = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - y.left) / Math.max(1, y.width))),
      Math.min(1, Math.max(0, (h.clientY - y.top) / Math.max(1, y.height)))
    ];
  }, m = (h, y) => o.erase(Rh(o.strokes, e, t, h, y, r / Math.max(1, n))), f = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [y, v] = u(h);
    o.tool === "eraser" ? m(y, v) : s([[y, v]]);
  }, d = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [y, v] = u(h);
    o.tool === "eraser" ? m(y, v) : s((S) => S ? Ph(S, y, v) : [[y, v]]);
  }, g = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: Ho[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ C(
    "svg",
    {
      className: Lh,
      "data-ink-active": l ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: f,
      onPointerMove: d,
      onPointerUp: g,
      onPointerCancel: g,
      children: [
        c.map((h) => /* @__PURE__ */ p(Ko, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(Ko, { stroke: { tool: o.tool, color: o.color, width: Ho[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
const Dh = [
  { keys: "P", desc: "进入 / 退出画笔（书页上右键也能选笔和颜色）" },
  { keys: "Esc", desc: "退出画笔" },
  { keys: "⌘Z / Ctrl+Z", desc: "画笔模式下撤销" }
];
function Oh(e) {
  return {
    toolbarItems: [{
      key: "ink",
      label: "画笔",
      title: "画笔（P；书页上右键也能选笔和颜色）",
      Icon: vn,
      // 钢笔图标，右下角一个当前笔色的小点（2026-11-28：两条栏只用图标，单一个圆点认不出是画笔）。
      mark: /* @__PURE__ */ C("span", { className: "reader-ink-mark", "aria-hidden": !0, children: [
        /* @__PURE__ */ p(vn, { ...Pe }),
        /* @__PURE__ */ p("span", { className: "reader-ink-dot", style: { background: `var(--${e.color})` } })
      ] }),
      place: "bottom",
      pressed: !!e.tool,
      onClick: () => e.setTool(e.tool ? null : "pen"),
      dropdown: (t) => /* @__PURE__ */ p(Wo, { ink: e, onPick: t })
    }],
    menuSection: ({ page: t, close: n }) => /* @__PURE__ */ p(Wo, { ink: e, page: t, onPick: n }),
    // 离视口远的页只是占位，笔迹先不画（和以前一样只画 active 的页）。
    pageLayer: ({ page: t, pane: n, width: r, height: o, active: a }) => a ? /* @__PURE__ */ p($h, { page: t, pane: n, width: r, height: o, ink: e }) : null,
    takesPointer: !!e.tool,
    shortcuts: Dh
  };
}
function zh() {
  const e = Ct(), t = Mh(e.resetKey);
  _h(t);
  const n = U(() => Oh(t), [t]);
  return an(n), null;
}
const Fh = { id: "ink", title: "画笔", Component: zh };
function Bh(e) {
  const t = _(!1);
  return e && (t.current = !0), t.current;
}
const Hh = Ta(() => import("./ReaderMarkdownPanel-C7iXULL0.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), Rs = { id: "markdown", label: "Markdown", short: "MD", Icon: Bi, needsJob: !0 };
function jh() {
  const e = Ct(), t = e.activePanel === Rs.id;
  if (!Bh(t)) return null;
  const r = /* @__PURE__ */ p(Sa, { fallback: null, children: /* @__PURE__ */ p(Hh, { open: t, jobId: e.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: e.closePanel }) });
  return e.panelHost ? Zi(r, e.panelHost) : r;
}
const Uh = {
  id: "markdown",
  title: "Markdown",
  Component: jh,
  panels: [Rs]
}, Ps = "reader-xref", rr = "data-xref", Wt = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, Wh = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${Wt})`), Kh = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function or(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function Vh(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function qh(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function Jh(e, t, n) {
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
function Gh(e, t, n) {
  return (e.find((o) => Ce(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function Xh(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = Ce(r), s = qh(r);
    if (a === "formula") {
      for (const g of s.matchAll(Kh)) {
        const h = or(g[1]);
        h && n({ key: `equation:${h}`, kind: "equation", label: h, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = Wh.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const l = Vh(i[1]), u = or(i[2]), m = Jh(e, o, l), f = [...m.map((g) => g.itemId), r.itemId], d = new Map(e.map((g, h) => [g.itemId, h]));
    f.sort((g, h) => (d.get(g) ?? 0) - (d.get(h) ?? 0)), n({ key: `${l}:${u}`, kind: l, label: u, itemId: Gh(m, r, l), itemIds: f, captionId: r.itemId });
  }), t;
}
const Yh = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${Wt})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${Wt})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${Wt})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${Wt})\s*[）)]`, "g"), kind: () => "equation" }
];
function Zh(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of Yh) {
    o.lastIndex = 0;
    for (const s of e.matchAll(o)) {
      const i = s.length > 2 ? s[1] : "", c = or(s[s.length - 1]), l = `${a(i)}:${c}`;
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
function Qh(e, t) {
  return Zh(e, t).map((n) => ({ start: n.start, end: n.end, className: Ps, attrs: { [rr]: n.key } }));
}
const ep = { figure: "图", table: "表", equation: "式" };
function Vo(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${ep[e.kind]} ${e.label}`;
}
const qo = { figure: "图", table: "表", formula: "公式", text: "文字" }, rt = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function tp(e, t, n) {
  const r = mt(e, t, n), o = r ? lt(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = vs({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function np(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, c = null;
  for (const u of e) {
    const m = mt(u, t, n), f = m ? lt(m, 1, 1) : null;
    !m || !f || (r || (r = m.box.page, c = m.pageSize), m.box.page === r && (o = Math.min(o, f.left), a = Math.min(a, f.top), s = Math.max(s, f.left + f.width), i = Math.max(i, f.top + f.height)));
  }
  if (!r || !c) return null;
  const l = vs({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: l, aspect: l.height * c.height / Math.max(1e-6, l.width * c.width) };
}
function rp(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function op(e, t) {
  const n = (o) => {
    const a = Ce(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function ap({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var D;
  const i = t.find((A) => A.itemId === e) ?? null, c = U(() => i ? op(t, i) : [], [t, i]), l = i ? c.indexOf(i) : -1, [u, m] = N(rt.indexOf(1)), f = rt[u], d = _(null), [g, h] = N(0);
  Le(() => {
    const A = d.current;
    if (!A) return;
    const I = () => h(A.clientWidth);
    I();
    const k = typeof ResizeObserver == "function" ? new ResizeObserver(I) : null;
    return k == null || k.observe(A), () => k == null ? void 0 : k.disconnect();
  }, []);
  const y = L((A) => {
    const I = c[l + A];
    I && a(I.itemId);
  }, [c, l, a]);
  O(() => {
    const A = (I) => {
      if (I.key === "Escape")
        I.preventDefault(), s();
      else if (I.key === "ArrowLeft")
        I.preventDefault(), y(-1);
      else if (I.key === "ArrowRight")
        I.preventDefault(), y(1);
      else if (I.key === "+" || I.key === "=")
        I.preventDefault(), m((k) => Math.min(rt.length - 1, k + 1));
      else if (I.key === "-" || I.key === "_")
        I.preventDefault(), m((k) => Math.max(0, k - 1));
      else if (I.key === "0")
        I.preventDefault(), m(rt.indexOf(1));
      else
        return;
      I.stopPropagation();
    };
    return window.addEventListener("keydown", A, !0), () => window.removeEventListener("keydown", A, !0);
  }, [s, y]), O(() => {
    const A = d.current;
    if (!A) return;
    const I = (k) => {
      !k.ctrlKey && !k.metaKey || (k.preventDefault(), m((P) => Math.max(0, Math.min(rt.length - 1, P + (k.deltaY < 0 ? 1 : -1)))));
    };
    return A.addEventListener("wheel", I, { passive: !1 }), () => A.removeEventListener("wheel", I);
  }, []);
  const v = _(null);
  if (!i) return null;
  const S = Ce(i), b = o.map((A) => ({ pane: A, pdf: r[A] ?? null, where: tp(i, n, A) })).filter((A) => !!(A.pdf && A.where)), T = 16, w = typeof window > "u" ? 800 : window.innerHeight, R = Math.min(880, w * 0.9) - 56 - 32 - (b.length > 1 ? 26 : 0), M = b.length ? rp(Math.max(120, (g - T * (b.length - 1) - 32) / b.length), R, b.map((A) => A.where.aspect)) : 0, E = ((D = b[0]) == null ? void 0 : D.where.page) ?? i.source.page;
  return /* @__PURE__ */ C("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${qo[S] ?? "这一块"}`, children: [
    /* @__PURE__ */ p("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ C("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ C("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ C("span", { className: "reader-zoom-title", children: [
          qo[S] ?? "这一块",
          " · 第 ",
          E,
          " 页"
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-zoom-count", children: l >= 0 ? `${l + 1} / ${c.length}` : "" }),
        /* @__PURE__ */ C("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ p(dt, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: l <= 0, onClick: () => y(-1), children: /* @__PURE__ */ p(Ea, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(dt, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: l < 0 || l >= c.length - 1, onClick: () => y(1), children: /* @__PURE__ */ p(_a, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(dt, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => m((A) => Math.max(0, A - 1)), children: /* @__PURE__ */ p(La, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ C(G, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => m(rt.indexOf(1)), children: [
            Math.round(f * 100),
            "%"
          ] }),
          /* @__PURE__ */ p(dt, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === rt.length - 1, onClick: () => m((A) => Math.min(rt.length - 1, A + 1)), children: /* @__PURE__ */ p(Ca, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(dt, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: s, children: /* @__PURE__ */ p(bt, { size: 16, "aria-hidden": !0 }) })
        ] })
      ] }),
      /* @__PURE__ */ p(
        "div",
        {
          ref: d,
          className: "reader-zoom-body",
          onPointerDown: (A) => {
            const I = d.current;
            !I || A.button !== 0 || (v.current = { x: A.clientX, y: A.clientY, left: I.scrollLeft, top: I.scrollTop }, I.setPointerCapture(A.pointerId));
          },
          onPointerMove: (A) => {
            const I = d.current, k = v.current;
            !I || !k || (I.scrollLeft = k.left - (A.clientX - k.x), I.scrollTop = k.top - (A.clientY - k.y));
          },
          onPointerUp: () => {
            v.current = null;
          },
          children: b.length && g ? /* @__PURE__ */ p("div", { className: "reader-zoom-columns", style: { gap: T }, children: b.map(({ pane: A, pdf: I, where: k }) => /* @__PURE__ */ C("figure", { className: "reader-zoom-column", children: [
            b.length > 1 ? /* @__PURE__ */ p("figcaption", { children: A === "source" ? "原文" : "译文" }) : null,
            /* @__PURE__ */ p(
              Ss,
              {
                className: "reader-zoom-canvas",
                pdf: I,
                page: k.page,
                region: k.fraction,
                cssWidth: M * f,
                label: `${A === "source" ? "原文" : "译文"}第 ${k.page} 页`
              }
            )
          ] }, A)) }) : /* @__PURE__ */ p("p", { className: "reader-zoom-empty", children: g ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
const sp = 380, ip = 320, Tt = 8;
function cp(e, t, n) {
  const r = Math.max(Tt, Math.min(e.left, n.width - t.width - Tt)), o = e.bottom + Tt, a = o + t.height <= n.height - Tt ? o : Math.max(Tt, e.top - Tt - t.height);
  return { left: r, top: a };
}
function lp({
  preview: e,
  regions: t,
  metadata: n,
  documents: r
}) {
  const o = e.target.itemIds.map((f) => t.find((d) => d.itemId === f)).filter((f) => !!f);
  if (!o.length) return null;
  const a = e.pane === "source" ? ["source", "translated"] : ["translated", "source"];
  let s = null;
  for (const f of a) {
    const d = r[f], g = d ? np(o, n, f) : null;
    if (d && g) {
      s = { pdf: d, where: g };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min(sp, ip / Math.max(0.05, s.where.aspect))), c = Math.round(i * s.where.aspect) + 30, l = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: m } = cp(e.anchor, { width: Math.max(i, 160) + 16, height: c + 16 }, l);
  return /* @__PURE__ */ C("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: m }, children: [
    /* @__PURE__ */ C("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ p("span", { children: Vo(e.target) }),
      /* @__PURE__ */ C("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ p(Ss, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: Vo(e.target) })
  ] });
}
const up = 250;
function dp(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function fp(e, t, n) {
  const r = n === "back" ? e.back : e.forward;
  if (!r.length) return null;
  const o = r[r.length - 1], a = r.slice(0, -1), s = n === "back" ? { back: a, forward: [...e.forward, t] } : { back: [...e.back, t], forward: a };
  return { to: o, history: s };
}
function mp(e) {
  var n;
  const t = e;
  return !!((n = t == null ? void 0 : t.closest) != null && n.call(t, "input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
function hp({
  shellEl: e,
  index: t,
  primaryPane: n,
  follow: r
}) {
  const [o, a] = N(null), [s, i] = N({ back: [], forward: [] }), c = _(s);
  c.current = s;
  const l = _(null), u = _({ index: t, primaryPane: n, follow: r, shellEl: e });
  u.current = { index: t, primaryPane: n, follow: r, shellEl: e };
  const m = L(() => {
    const { shellEl: d, primaryPane: g } = u.current;
    return Vt(d, g);
  }, []);
  O(() => {
    if (!e) return;
    const d = (b) => {
      var T, w;
      return (w = (T = b.target) == null ? void 0 : T.closest) == null ? void 0 : w.call(T, `.${Ps}`);
    }, g = () => {
      l.current != null && window.clearTimeout(l.current), l.current = null;
    }, h = (b) => {
      var M;
      const T = d(b);
      if (!T) return;
      const w = u.current.index.get(T.getAttribute(rr) || "");
      if (!w) return;
      const R = ((M = T.closest("[data-reader-pane]")) == null ? void 0 : M.getAttribute("data-reader-pane")) || u.current.primaryPane;
      g(), l.current = window.setTimeout(() => {
        const E = T.getBoundingClientRect();
        a({ target: w, pane: R, anchor: { left: E.left, top: E.top, right: E.right, bottom: E.bottom } });
      }, up);
    }, y = (b) => {
      const T = d(b);
      !T || T.contains(b.relatedTarget) || (g(), a(null));
    }, v = (b) => {
      var E, D;
      const T = d(b);
      if (!T || b.button !== 0 || b.metaKey || b.ctrlKey || b.shiftKey || `${((E = window.getSelection) == null ? void 0 : E.call(window)) || ""}`.trim()) return;
      const w = u.current.index.get(T.getAttribute(rr) || "");
      if (!w) return;
      b.preventDefault(), b.stopPropagation(), g(), a(null);
      const R = ((D = T.closest("[data-reader-pane]")) == null ? void 0 : D.getAttribute("data-reader-pane")) || u.current.primaryPane, M = m();
      M && i((A) => dp(A, M)), u.current.follow(w, R);
    }, S = () => {
      g(), a(null);
    };
    return e.addEventListener("pointerover", h), e.addEventListener("pointerout", y), e.addEventListener("click", v, !0), e.addEventListener("scroll", S, { passive: !0 }), () => {
      g(), e.removeEventListener("pointerover", h), e.removeEventListener("pointerout", y), e.removeEventListener("click", v, !0), e.removeEventListener("scroll", S);
    };
  }, [e, m]);
  const f = L((d) => {
    const g = m();
    if (!g) return !1;
    const h = fp(c.current, g, d);
    if (!h) return !1;
    const { shellEl: y, primaryPane: v } = u.current;
    return At(y, h.to, "auto", v) ? (i(h.history), !0) : !1;
  }, [m]);
  return O(() => {
    const d = (g) => {
      if (!g.altKey || g.metaKey || g.ctrlKey || g.shiftKey || g.defaultPrevented || g.key !== "ArrowLeft" && g.key !== "ArrowRight" || mp(g.target)) return;
      f(g.key === "ArrowLeft" ? "back" : "forward") && g.preventDefault();
    };
    return window.addEventListener("keydown", d), () => window.removeEventListener("keydown", d);
  }, [f]), {
    preview: o,
    closePreview: L(() => a(null), []),
    canGoBack: s.back.length > 0,
    backPage: s.back.length ? s.back[s.back.length - 1].page : null,
    goBack: L(() => f("back"), [f])
  };
}
const pp = [
  { keys: "Alt+←", desc: "点了引用跳过去以后，回到原处" },
  { keys: "Alt+→", desc: "再跳回去" }
];
function gp() {
  const e = Ct(), t = U(() => Xh(e.regions), [e.regions]), { jumpToBlock: n } = e, r = L((s, i) => n(s.itemId, i), [n]), o = hp({ shellEl: e.shellEl, index: t, primaryPane: e.primaryPane, follow: r }), a = U(() => ({
    // 书里一个认得出去处的引用都没有，就不改文字层（react-pdf 照原样画，不多一遍 innerHTML）。
    textMarks: t.size ? (s) => Qh(s, t) : void 0,
    shortcuts: pp
  }), [t]);
  return an(a), /* @__PURE__ */ C(Ne, { children: [
    o.preview ? /* @__PURE__ */ p(lp, { preview: o.preview, regions: e.regions, metadata: e.metadata, documents: e.pdfDocuments }) : null,
    o.canGoBack ? /* @__PURE__ */ C(G, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => o.goBack(), children: [
      /* @__PURE__ */ p(Hi, { size: 14, "aria-hidden": !0 }),
      " 回到第 ",
      o.backPage,
      " 页"
    ] }) : null
  ] });
}
const yp = { id: "xrefs", title: "引用（「图 2.1」「式 (3.21)」）", Component: gp }, Rr = [Fh, Uh, rh, yp, Jm, Ih];
function Pr(e = Rr) {
  return e.flatMap((t) => (t.panels ?? []).map(({ id: n, label: r, short: o, Icon: a, needsJob: s }) => ({ id: n, label: r, short: o, Icon: a, needsJob: s })));
}
function bp(e) {
  const t = Be(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(Ne, { children: (e.tabs ?? Pr()).map(({ id: s, label: i, Icon: c, needsJob: l }) => {
    const u = n === s, m = l && r, f = u ? `收起${i}` : `打开${i}`;
    return /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: "reader-panel-toggle",
        "aria-label": f,
        "aria-pressed": u,
        title: m ? `${i} 需打开任务阅读` : i,
        disabled: m,
        onClick: () => u ? a() : o(s),
        children: /* @__PURE__ */ p(c, { className: "reader-close-home-icon", ...Pe, "aria-hidden": !0 })
      },
      s
    );
  }) });
}
function vp(e) {
  const t = Be(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = Pr().map(({ id: c, label: l, short: u, Icon: m, needsJob: f }) => ({
    key: c,
    label: l,
    short: u,
    Icon: m,
    disabled: f && o,
    selected: n === c,
    badge: r == null ? void 0 : r[c],
    onClick: () => a(c)
  }));
  return n ? /* @__PURE__ */ C("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ p("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: c, label: l, Icon: u, disabled: m, selected: f, badge: d, onClick: g }) => /* @__PURE__ */ C(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": f,
        className: `reader-assistant-dock-tab${f ? " is-active" : ""}`,
        title: m ? `${l} 需打开任务阅读` : l,
        disabled: m,
        onClick: g,
        children: [
          /* @__PURE__ */ p(u, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
          /* @__PURE__ */ p("span", { className: "reader-assistant-dock-tab-label", children: l }),
          d ? /* @__PURE__ */ p("span", { className: "reader-assistant-dock-badge", children: d }) : null
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
function wp(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Sp(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Tp(e) {
  return e / 100 * window.innerHeight;
}
function kp(e) {
  return e / 100 * window.innerWidth;
}
function Ip(e) {
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
  const [o, a] = Ip(n);
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
      r = Sp(t, o);
      break;
    }
    case "em": {
      r = wp(t, o);
      break;
    }
    case "vh": {
      r = Tp(o);
      break;
    }
    case "vw": {
      r = kp(o);
      break;
    }
  }
  return r;
}
function _e(e) {
  return parseFloat(e.toFixed(3));
}
function _t({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function ar(e) {
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
function sr(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? Ep : Rp
  );
}
function Ep(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function Rp(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function Ms(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function xs(e, t) {
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
function Pp({
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
    const { x: i, y: c } = xs(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return he(o, "No rect found"), o;
}
let hn;
function Mp() {
  return hn === void 0 && (typeof matchMedia == "function" ? hn = !!matchMedia("(pointer:coarse)").matches : hn = !1), hn;
}
function Ns(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = sr(
    n,
    Array.from(t.children).filter(Ms).map((g) => ({ element: g }))
  ).map(({ element: g }) => g), s = [];
  let i = !1, c = !1, l = -1, u = -1, m = 0, f, d = [];
  {
    let g = -1;
    for (const h of a)
      h.hasAttribute("data-panel") && (g++, h.hasAttribute("data-disabled") || (m++, l === -1 && (l = g), u = g));
  }
  if (m > 1) {
    let g = -1;
    for (const h of a)
      if (h.hasAttribute("data-panel")) {
        g++;
        const y = r.find(
          (v) => v.element === h
        );
        if (y) {
          if (f) {
            const v = f.element.getBoundingClientRect(), S = h.getBoundingClientRect();
            let b;
            if (c) {
              const T = n === "horizontal" ? new DOMRect(
                v.right,
                v.top,
                0,
                v.height
              ) : new DOMRect(
                v.left,
                v.bottom,
                v.width,
                0
              ), w = n === "horizontal" ? new DOMRect(S.left, S.top, 0, S.height) : new DOMRect(S.left, S.top, S.width, 0);
              switch (d.length) {
                case 0: {
                  b = [
                    T,
                    w
                  ];
                  break;
                }
                case 1: {
                  const R = d[0], M = Pp({
                    orientation: n,
                    rects: [v, S],
                    targetRect: R.element.getBoundingClientRect()
                  });
                  b = [
                    R,
                    M === v ? w : T
                  ];
                  break;
                }
                default: {
                  b = d;
                  break;
                }
              }
            } else
              d.length ? b = d : b = [
                n === "horizontal" ? new DOMRect(
                  v.right,
                  S.top,
                  S.left - v.right,
                  S.height
                ) : new DOMRect(
                  S.left,
                  v.bottom,
                  S.width,
                  S.top - v.bottom
                )
              ];
            for (const T of b) {
              let w = "width" in T ? T : T.element.getBoundingClientRect();
              const R = Mp() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (w.width < R) {
                const E = R - w.width;
                w = new DOMRect(
                  w.x - E / 2,
                  w.y,
                  w.width + E,
                  w.height
                );
              }
              if (w.height < R) {
                const E = R - w.height;
                w = new DOMRect(
                  w.x,
                  w.y - E / 2,
                  w.width,
                  w.height + E
                );
              }
              const M = g <= l || g > u;
              !i && !M && s.push({
                group: e,
                groupSize: _t({ group: e }),
                panels: [f, y],
                separator: "width" in T ? void 0 : T,
                rect: w
              }), i = !1;
            }
          }
          c = !1, f = y, d = [];
        }
      } else if (h.hasAttribute("data-separator")) {
        h.ariaDisabled !== null && (i = !0);
        const y = o.find(
          (v) => v.element === h
        );
        y ? d.push(y) : (f = void 0, d = []);
      } else
        c = !0;
  }
  return s;
}
var at;
class As {
  constructor() {
    Jr(this, at, {});
  }
  addListener(t, n) {
    const r = $t(this, at)[t];
    return r === void 0 ? $t(this, at)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = $t(this, at)[t];
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
    Gr(this, at, {});
  }
  removeListener(t, n) {
    const r = $t(this, at)[t];
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
const Mr = new As();
function pt() {
  return Mt;
}
function xp(e) {
  return Mr.addListener("change", e);
}
function Np(e) {
  const t = Mt, n = { ...Mt };
  n.cursorFlags = e, Mt = n, Mr.emit("change", {
    prev: t,
    next: n
  });
}
function xt(e) {
  const t = Mt;
  Mt = e, Mr.emit("change", {
    prev: t,
    next: e
  });
}
const Ap = (e) => e, Hn = () => {
}, _s = 1, Ls = 2, Cs = 4, $s = 8, Jo = 3, Go = 12;
let pn;
function Xo() {
  return pn === void 0 && (pn = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (pn = !0)), pn;
}
function _p({
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
        if (e && Xo()) {
          const a = (e & _s) !== 0, s = (e & Ls) !== 0, i = (e & Cs) !== 0, c = (e & $s) !== 0;
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
    return Xo() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const Yo = /* @__PURE__ */ new WeakMap();
function xr(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = Yo.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = pt();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = _p({
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
  Yo.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Ue = /* @__PURE__ */ new Map();
const Ds = new As();
function Lp(e) {
  Ue = new Map(Ue), Ue.delete(e);
}
function Zo(e, t) {
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
function Nr(e, t) {
  return Ds.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Ye(e, t, n) {
  const r = Ue.get(e);
  Ue = new Map(Ue), Ue.set(e, t), Ds.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function Os(e) {
  const t = pt();
  let n = !1;
  switch (t.state) {
    case "active":
      xt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (xr(e), n = !0, t.hitRegions.forEach((r) => {
        const o = it(r.group.id, !0);
        Ye(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function Qo(e) {
  e.defaultPrevented || Os(e.currentTarget);
}
function Cp(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = xs(n, a.rect);
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
function $p(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Dp(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: na(e),
    b: na(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  he(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: ta(ea(n.a)),
    b: ta(ea(n.b))
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
const Op = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function zp(e) {
  const t = getComputedStyle(zs(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function Fp(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || zp(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || Op.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function ea(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (he(n, "Missing node"), Fp(n)) return n;
  }
  return null;
}
function ta(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function na(e) {
  const t = [];
  for (; e; )
    t.push(e), e = zs(e);
  return t;
}
function zs(e) {
  const { parentNode: t } = e;
  return $p(t) ? t.host : t;
}
function Bp(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Hp({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!Ms(n) || n.contains(e) || e.contains(n))
    return !0;
  if (Dp(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Bp(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function Ar(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = Ns(o), s = Cp(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Hp({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function jp(e, t) {
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
  const s = a === "imperative-api", i = Object.values(t), c = Object.values(o), l = [...i], [u, m] = r;
  he(u != null, "Invalid first pivot index"), he(m != null, "Invalid second pivot index");
  let f = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? m : u, y = n[h];
        he(
          y,
          `Panel constraints not found for index ${h}`
        );
        const {
          collapsedSize: v = 0,
          collapsible: S,
          minSize: b = 0
        } = y;
        if (S) {
          const T = i[h];
          if (he(
            T != null,
            `Previous layout not found for panel index ${h}`
          ), xe(T, v)) {
            const w = b - T;
            je(w, Math.abs(e)) > 0 && (e = e < 0 ? 0 - w : w);
          }
        }
      }
      {
        const h = e < 0 ? u : m, y = n[h];
        he(
          y,
          `No panel constraints found for index ${h}`
        );
        const {
          collapsedSize: v = 0,
          collapsible: S,
          minSize: b = 0
        } = y;
        if (S) {
          const T = i[h];
          if (he(
            T != null,
            `Previous layout not found for panel index ${h}`
          ), xe(T, b)) {
            const w = T - v;
            je(w, Math.abs(e)) > 0 && (e = e < 0 ? 0 - w : w);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? m : u, y = n[h];
      he(
        y,
        `Panel constraints not found for index ${h}`
      );
      const v = i[h], { collapsible: S, collapsedSize: b, minSize: T } = y;
      if (S && je(v, T) < 0)
        if (e > 0) {
          const w = T - b, R = w / 2, M = v + e;
          je(M, T) < 0 && (e = je(e, R) <= 0 ? 0 : w);
        } else {
          const w = T - b, R = 100 - w / 2, M = v - e;
          je(M, T) < 0 && (e = je(100 + e, R) > 0 ? 0 : -w);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let y = e < 0 ? m : u, v = 0;
    for (; ; ) {
      const b = i[y];
      he(
        b != null,
        `Previous layout not found for panel index ${y}`
      );
      const T = Rt({
        overrideDisabledPanels: s,
        panelConstraints: n[y],
        prevSize: b,
        size: 100
      }) - b;
      if (v += T, y += h, y < 0 || y >= n.length)
        break;
    }
    const S = Math.min(Math.abs(e), Math.abs(v));
    e = e < 0 ? 0 - S : S;
  }
  {
    let h = e < 0 ? u : m;
    for (; h >= 0 && h < n.length; ) {
      const y = Math.abs(e) - Math.abs(f), v = i[h];
      he(
        v != null,
        `Previous layout not found for panel index ${h}`
      );
      const S = v - y, b = Rt({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: v,
        size: S
      });
      if (!xe(v, b) && (f += v - b, l[h] = b, f.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (jp(c, l))
    return o;
  {
    const h = e < 0 ? m : u, y = i[h];
    he(
      y != null,
      `Previous layout not found for panel index ${h}`
    );
    const v = y + f, S = Rt({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: y,
      size: v
    });
    if (l[h] = S, !xe(S, v)) {
      let b = v - S, T = e < 0 ? m : u;
      for (; T >= 0 && T < n.length; ) {
        const w = l[T];
        he(
          w != null,
          `Previous layout not found for panel index ${T}`
        );
        const R = w + b, M = Rt({
          overrideDisabledPanels: s,
          panelConstraints: n[T],
          prevSize: w,
          size: R
        });
        if (xe(w, M) || (b -= M - w, l[T] = M), xe(b, 0))
          break;
        e > 0 ? T-- : T++;
      }
    }
  }
  const d = Object.values(l).reduce(
    (h, y) => y + h,
    0
  );
  if (!xe(d, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return l.reduce((h, y, v) => (h[g[v]] = y, h), {});
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
function Fs({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const c = vt();
    for (const [
      l,
      {
        defaultLayoutDeferred: u,
        derivedPanelConstraints: m,
        layout: f,
        groupSize: d,
        separatorToPanels: g
      }
    ] of c)
      if (l.id === e)
        return {
          defaultLayoutDeferred: u,
          derivedPanelConstraints: m,
          group: l,
          groupSize: d,
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
    derivedPanelConstraints: m
  }) => {
    const f = a(), d = l.findIndex((y) => y.id === t), g = d === 0, h = d === l.length - 1;
    if (h && c < f && (g || l.slice(0, d).every((y, v) => {
      const S = m[v];
      return (S == null ? void 0 : S.collapsible) && xe(S.collapsedSize, u[S.panelId]);
    }))) {
      const y = l.slice(0, d).reduce((v, S) => v + u[S.id], 0);
      return {
        ...u,
        [t]: _e(100 - y)
      };
    }
    return Zt({
      delta: h ? f - c : c - f,
      initialLayout: u,
      panelConstraints: m,
      pivotIndices: h ? [d - 1, d] : [d, d + 1],
      prevLayout: u,
      trigger: "imperative-api"
    });
  }, i = (c) => {
    const l = a();
    if (c === l)
      return;
    const {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: m,
      group: f,
      groupSize: d,
      layout: g,
      separatorToPanels: h
    } = n(), y = s({
      nextSize: c,
      panels: f.panels,
      prevLayout: g,
      derivedPanelConstraints: m
    }), v = yt({
      layout: y,
      panelConstraints: m
    });
    gt(g, v) || Ye(f, {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: m,
      groupSize: d,
      layout: v,
      separatorToPanels: h
    });
  };
  return {
    collapse: () => {
      const { collapsible: c, collapsedSize: l } = r(), { mutableValues: u } = o(), m = a();
      c && m !== l && (u.expandToSize = m, i(l));
    },
    expand: () => {
      const { collapsible: c, collapsedSize: l, minSize: u } = r(), { mutableValues: m } = o(), f = a();
      if (c && f === l) {
        let d = m.expandToSize ?? u;
        d === 0 && (d = 1), i(d);
      }
    },
    getSize: () => {
      const { group: c } = n(), l = a(), { element: u } = o(), m = c.orientation === "horizontal" ? u.offsetWidth : u.offsetHeight;
      return {
        asPercentage: l,
        inPixels: m
      };
    },
    isCollapsed: () => {
      const { collapsible: c, collapsedSize: l } = r(), u = a();
      return c && xe(l, u);
    },
    resize: (c) => {
      const { group: l } = n(), { element: u } = o(), m = _t({ group: l }), f = Kt({
        groupSize: m,
        panelElement: u,
        styleProp: c
      }), d = _e(f / m * 100);
      i(d);
    }
  };
}
function ra(e) {
  if (e.defaultPrevented)
    return;
  const t = vt();
  Ar(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = Fs({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function gn(e) {
  const t = vt();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function Bs({
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
  const n = gn(e), r = it(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  he(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  he(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), i = Bs({ groupId: n.id }).getLayout(), c = Zt({
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
function oa(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = gn(t);
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
        const r = gn(t), o = it(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, c = r.separators.find(
          (f) => f.element === t
        );
        he(c, "Matching separator not found");
        const l = i.get(c);
        he(l, "Matching panels not found");
        const u = l[0], m = a.find(
          (f) => f.panelId === u.id
        );
        if (he(m, "Panel metadata not found"), m.collapsible) {
          const f = s[u.id], d = m.collapsedSize === f ? r.mutableState.expandedPanelSizes[u.id] ?? m.minSize : m.collapsedSize;
          ut(t, d - f);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = gn(t).separators.map(
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
function aa(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = vt(), n = Ar(e, t), r = /* @__PURE__ */ new Map();
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
function Hs({
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
    const { group: u, groupSize: m } = l, { orientation: f, panels: d } = u, { disableCursor: g } = u.mutableState;
    let h = 0;
    a ? f === "horizontal" ? h = (t.clientX - a.x) / m * 100 : h = (t.clientY - a.y) / m * 100 : f === "horizontal" ? h = t.clientX < 0 ? -100 : 100 : h = t.clientY < 0 ? -100 : 100;
    const y = r.get(u), v = o.get(u);
    if (!y || !v)
      return;
    const {
      defaultLayoutDeferred: S,
      derivedPanelConstraints: b,
      groupSize: T,
      layout: w,
      separatorToPanels: R
    } = v;
    if (b && w && R) {
      const M = Zt({
        delta: h,
        initialLayout: y,
        panelConstraints: b,
        pivotIndices: l.panels.map((E) => d.indexOf(E)),
        prevLayout: w,
        trigger: "mouse-or-touch"
      });
      if (gt(M, w)) {
        if (h !== 0 && !g)
          switch (f) {
            case "horizontal": {
              i |= h < 0 ? _s : Ls;
              break;
            }
            case "vertical": {
              i |= h < 0 ? Cs : $s;
              break;
            }
          }
      } else
        Ye(l.group, {
          defaultLayoutDeferred: S,
          derivedPanelConstraints: b,
          groupSize: T,
          layout: M,
          separatorToPanels: R
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & Jo : c |= i & Jo, t.movementY === 0 ? c |= s & Go : c |= i & Go, Np(c), xr(e);
}
function sa(e) {
  const t = vt(), n = pt();
  switch (n.state) {
    case "active":
      Hs({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function ia(e) {
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
      Hs({
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
      const a = Ar(e, n);
      a.length === 0 ? t.state !== "inactive" && xt({
        cursorFlags: 0,
        state: "inactive"
      }) : xt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), xr(e.currentTarget);
      break;
    }
  }
}
function ca(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (pt().state) {
      case "hover":
        xt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function la(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || Os(e.currentTarget) && e.preventDefault();
}
function ua(e) {
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
function Up(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((c) => c.element === t);
  if (!r || !r.onResize)
    return;
  const o = _t({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: _e(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function Wp(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function Kp({
  group: e,
  nextGroupSize: t,
  prevGroupSize: n,
  prevLayout: r
}) {
  if (n <= 0 || t <= 0 || n === t)
    return r;
  let o = 0, a = 0, s = !1;
  const i = /* @__PURE__ */ new Map(), c = [];
  for (const m of e.panels) {
    const f = r[m.id] ?? 0;
    switch (m.panelConstraints.groupResizeBehavior) {
      case "preserve-pixel-size": {
        s = !0;
        const d = f / 100 * n, g = _e(
          d / t * 100
        );
        i.set(m.id, g), o += g;
        break;
      }
      case "preserve-relative-size":
      default: {
        c.push(m.id), a += f;
        break;
      }
    }
  }
  if (!s || c.length === 0)
    return r;
  const l = 100 - o, u = { ...r };
  if (i.forEach((m, f) => {
    u[f] = m;
  }), a > 0)
    for (const m of c) {
      const f = r[m] ?? 0;
      u[m] = _e(
        f / a * l
      );
    }
  else {
    const m = _e(
      l / c.length
    );
    for (const f of c)
      u[f] = m;
  }
  return u;
}
function Vp(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const kt = /* @__PURE__ */ new Map();
function qp(e) {
  let t = !0;
  he(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const h of g) {
      const { borderBoxSize: y, target: v } = h;
      if (v === e.element) {
        if (t) {
          const S = _t({ group: e });
          if (S === 0)
            return;
          const b = it(e.id);
          if (!b)
            return;
          const T = ar(e), w = b.defaultLayoutDeferred ? ua(T) : b.layout, R = Kp({
            group: e,
            nextGroupSize: S,
            prevGroupSize: b.groupSize,
            prevLayout: w
          }), M = yt({
            layout: R,
            panelConstraints: T
          });
          if (!b.defaultLayoutDeferred && gt(b.layout, M) && Wp(
            b.derivedPanelConstraints,
            T
          ) && b.groupSize === S)
            return;
          Ye(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: T,
            groupSize: S,
            layout: M,
            separatorToPanels: b.separatorToPanels
          });
        }
      } else
        Up(e, v, y);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    he(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = _t({ group: e }), i = ar(e), c = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (Vp(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[c] ?? l ?? ua(i), m = yt({
    layout: u,
    panelConstraints: i
  }), f = e.element.ownerDocument;
  kt.set(
    f,
    (kt.get(f) ?? 0) + 1
  );
  const d = /* @__PURE__ */ new Map();
  return Ns(e).forEach((g) => {
    g.separator && d.set(g.separator, g.panels);
  }), Ye(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: m,
    separatorToPanels: d
  }), e.separators.forEach((g) => {
    he(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", oa);
  }), kt.get(f) === 1 && (f.addEventListener("contextmenu", Qo, !0), f.addEventListener("dblclick", ra, !0), f.addEventListener("pointerdown", aa, !0), f.addEventListener("pointerleave", sa), f.addEventListener("pointermove", ia), f.addEventListener("pointerout", ca), f.addEventListener("pointerup", la, !0)), function() {
    t = !1, kt.set(
      f,
      Math.max(0, (kt.get(f) ?? 0) - 1)
    ), Lp(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", oa);
    }), kt.get(f) || (f.removeEventListener(
      "contextmenu",
      Qo,
      !0
    ), f.removeEventListener(
      "dblclick",
      ra,
      !0
    ), f.removeEventListener(
      "pointerdown",
      aa,
      !0
    ), f.removeEventListener("pointerleave", sa), f.removeEventListener("pointermove", ia), f.removeEventListener("pointerout", ca), f.removeEventListener("pointerup", la, !0)), a.disconnect();
  };
}
function Jp() {
  const [e, t] = N({}), n = L(() => t({}), []);
  return [e, n];
}
function _r(e) {
  const t = ka();
  return `${e ?? t}`;
}
const wt = typeof window < "u" ? Le : O;
function qt(e) {
  const t = _(e);
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
function Lr(...e) {
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
function Cr(e) {
  const t = _({ ...e });
  return wt(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const js = nn(null);
function Gp(e, t) {
  const n = _({
    getLayout: () => ({}),
    setLayout: Ap
  });
  mr(t, () => n.current, []), wt(() => {
    Object.assign(
      n.current,
      Bs({ groupId: e })
    );
  });
}
function Us({
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
  resizeTargetMinimumSize: m = {
    coarse: 20,
    fine: 10
  },
  style: f,
  ...d
}) {
  const g = _({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), h = qt((I) => {
    gt(g.current.onLayoutChange, I) || (g.current.onLayoutChange = I, c == null || c(I));
  }), y = qt(
    (I, k) => {
      gt(g.current.onLayoutChanged, I) || (g.current.onLayoutChanged = I, l == null || l(I, { isUserInteraction: k }));
    }
  ), v = _r(i), S = _(null), [b, T] = Jp(), w = _({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: m,
    separators: []
  }), R = Lr(S, a);
  Gp(v, s);
  const M = qt(
    (I, k) => {
      const P = pt(), $ = Zo(I), z = it(I);
      if (z) {
        let K = !1;
        switch (P.state) {
          case "active": {
            K = P.hitRegions.some(
              (j) => j.group === $
            );
            break;
          }
        }
        return {
          flexGrow: z.layout[k] ?? 1,
          pointerEvents: K ? "none" : void 0
        };
      }
      if (n != null && n[k])
        return {
          flexGrow: n == null ? void 0 : n[k]
        };
    }
  ), E = Cr({
    defaultLayout: n,
    disableCursor: r
  }), D = U(
    () => ({
      get disableCursor() {
        return !!E.disableCursor;
      },
      getPanelStyles: M,
      id: v,
      orientation: u,
      registerPanel: (I) => {
        const k = w.current;
        return k.panels = sr(u, [
          ...k.panels,
          I
        ]), T(), () => {
          k.panels = k.panels.filter(
            (P) => P !== I
          ), T();
        };
      },
      registerSeparator: (I) => {
        const k = w.current;
        return k.separators = sr(u, [
          ...k.separators,
          I
        ]), T(), () => {
          k.separators = k.separators.filter(
            (P) => P !== I
          ), T();
        };
      },
      updatePanelProps: (I, { disabled: k }) => {
        const P = w.current.panels.find(
          (K) => K.id === I
        );
        P && (P.panelConstraints.disabled = k);
        const $ = Zo(v), z = it(v);
        $ && z && Ye($, {
          ...z,
          derivedPanelConstraints: ar($)
        });
      },
      updateSeparatorProps: (I, {
        disabled: k,
        disableDoubleClick: P
      }) => {
        const $ = w.current.separators.find(
          (z) => z.id === I
        );
        $ && ($.disabled = k, $.disableDoubleClick = P);
      }
    }),
    [M, v, T, u, E]
  ), A = _(null);
  return wt(() => {
    const I = S.current;
    if (I === null)
      return;
    const k = w.current;
    let P;
    if (E.defaultLayout !== void 0 && Object.keys(E.defaultLayout).length === k.panels.length) {
      P = {};
      for (const q of k.panels) {
        const se = E.defaultLayout[q.id];
        se !== void 0 && (P[q.id] = se);
      }
    }
    const $ = {
      disabled: !!o,
      element: I,
      id: v,
      mutableState: {
        defaultLayout: P,
        disableCursor: !!E.disableCursor,
        expandedPanelSizes: w.current.lastExpandedPanelSizes,
        layouts: w.current.layouts
      },
      orientation: u,
      panels: k.panels,
      resizeTargetMinimumSize: k.resizeTargetMinimumSize,
      separators: k.separators
    };
    A.current = $;
    const z = qp($), { defaultLayoutDeferred: K, derivedPanelConstraints: j, layout: J } = it($.id, !0);
    !K && j.length > 0 && (h(J), y(J, !1));
    const oe = Nr(v, (q) => {
      const { defaultLayoutDeferred: se, derivedPanelConstraints: Ee, layout: re } = q.next;
      if (se || Ee.length === 0)
        return;
      const ue = $.panels.map(({ id: ie }) => ie).join(",");
      $.mutableState.layouts[ue] = re, Ee.forEach((ie) => {
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
            B && !W && ($.mutableState.expandedPanelSizes[ie.panelId] = le[ie.panelId]);
          }
        }
      });
      const Me = pt().state !== "active";
      h(re), Me && y(re, q.isUserInteraction);
    });
    return () => {
      A.current = null, z(), oe();
    };
  }, [
    o,
    v,
    y,
    h,
    u,
    b,
    E
  ]), O(() => {
    const I = A.current;
    I && (I.mutableState.defaultLayout = n, I.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(js.Provider, { value: D, children: /* @__PURE__ */ p(
    "div",
    {
      ...d,
      className: t,
      "data-group": !0,
      "data-testid": v,
      id: v,
      ref: R,
      style: {
        height: "100%",
        width: "100%",
        overflow: "hidden",
        ...f,
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
Us.displayName = "Group";
function $r() {
  const e = ft(js);
  return he(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Xp(e, t) {
  const { id: n } = $r(), r = _({
    collapse: Hn,
    expand: Hn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Hn
  });
  mr(t, () => r.current, []), wt(() => {
    Object.assign(
      r.current,
      Fs({ groupId: n, panelId: e })
    );
  });
}
function ir({
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
  onResize: m,
  panelRef: f,
  style: d,
  ...g
}) {
  const h = !!c, y = _r(c), v = Cr({
    disabled: a
  }), S = _(null), b = Lr(S, s), {
    getPanelStyles: T,
    id: w,
    orientation: R,
    registerPanel: M,
    updatePanelProps: E
  } = $r(), D = m !== null, A = qt(
    ($, z, K) => {
      m == null || m($, c, K);
    }
  );
  wt(() => {
    const $ = S.current;
    if ($ !== null) {
      const z = {
        element: $,
        id: y,
        idIsStable: h,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: D ? A : void 0,
        panelConstraints: {
          groupResizeBehavior: i,
          collapsedSize: n,
          collapsible: r,
          defaultSize: o,
          disabled: v.disabled,
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
    D,
    y,
    h,
    l,
    u,
    A,
    M,
    v
  ]), O(() => {
    E(y, { disabled: a });
  }, [a, y, E]), Xp(y, f);
  const I = () => {
    const $ = T(w, y);
    if ($)
      return JSON.stringify($);
  }, k = Mn(
    ($) => Nr(w, $),
    I,
    I
  );
  let P;
  return k ? P = JSON.parse(k) : o !== void 0 ? P = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : P = { flexGrow: 1 }, /* @__PURE__ */ p(
    "div",
    {
      ...g,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": y,
      id: y,
      ref: b,
      style: {
        ...Yp,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...P
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
            ...d,
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
ir.displayName = "Panel";
const Yp = {
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
function Zp({
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
function Ws({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const c = _r(a), l = Cr({
    disabled: n,
    disableDoubleClick: r
  }), [u, m] = N({}), [f, d] = N("inactive"), [g, h] = N(!1), y = _(null), v = Lr(y, o), {
    disableCursor: S,
    id: b,
    orientation: T,
    registerSeparator: w,
    updateSeparatorProps: R
  } = $r(), M = T === "horizontal" ? "vertical" : "horizontal";
  wt(() => {
    const A = y.current;
    if (A !== null) {
      const I = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: A,
        id: c
      }, k = w(I), P = xp(
        (z) => {
          d(
            z.next.state !== "inactive" && z.next.hitRegions.some(
              (K) => K.separator === I
            ) ? z.next.state : "inactive"
          );
        }
      ), $ = Nr(
        b,
        (z) => {
          const { derivedPanelConstraints: K, layout: j, separatorToPanels: J } = z.next, oe = J.get(I);
          if (oe) {
            const q = oe[0], se = oe.indexOf(q);
            m(
              Zp({
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
        P(), $(), k();
      };
    }
  }, [b, c, w, l]), O(() => {
    R(c, { disabled: n, disableDoubleClick: r });
  }, [n, r, c, R]);
  let E;
  n && !S && (E = "not-allowed");
  let D;
  if (n)
    D = "disabled";
  else
    switch (f) {
      case "active": {
        D = "active";
        break;
      }
      default:
        g ? D = "focus" : D = f;
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
      "data-separator": D,
      "data-testid": c,
      id: c,
      onBlur: () => h(!1),
      onFocus: () => h(!0),
      ref: v,
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
Ws.displayName = "Separator";
const Dr = 30, Or = 65, Qt = 50, Qp = 100 - Or, eg = 100 - Dr;
function tg(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(Or, Math.max(Dr, t)) : Qt;
}
function zr(e) {
  return 100 - e;
}
function It(e) {
  return `${e}%`;
}
const Fr = "reader-document", en = "reader-assistant", Ks = "retainpdf.reader.ai-split-layout.v1", ng = {
  [Fr]: zr(Qt),
  [en]: Qt
};
function Br(e) {
  const t = tg(e == null ? void 0 : e[en]);
  return {
    [Fr]: zr(t),
    [en]: t
  };
}
function rg() {
  try {
    const e = JSON.parse(localStorage.getItem(Ks) || "null");
    return Br(e);
  } catch {
    return ng;
  }
}
function og(e) {
  try {
    localStorage.setItem(Ks, JSON.stringify(Br(e)));
  } catch {
  }
}
function jn(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Br(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[en]}vw`
  );
}
function ag() {
  const e = _(null), [t] = N(rg);
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
    jn(e.current, o), a.isUserInteraction && og(o);
  }, []);
  return /* @__PURE__ */ C(
    Us,
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
          ir,
          {
            id: Fr,
            defaultSize: It(zr(Qt)),
            minSize: It(Qp),
            maxSize: It(eg)
          }
        ),
        /* @__PURE__ */ p(
          Ws,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ p("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ p(
          ir,
          {
            id: en,
            defaultSize: It(Qt),
            minSize: It(Dr),
            maxSize: It(Or)
          }
        )
      ]
    }
  );
}
function sg({
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
    n ? /* @__PURE__ */ p(G, { className: "reader-error-notice-retry", "data-reader-retry": "optional", onClick: n, children: "重试" }) : null,
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
function ig({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(sg, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ C(Ne, { children: [
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
      s ? /* @__PURE__ */ p(G, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function cg(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function lg() {
  const [e, t] = N(!1), n = ka(), r = _(null), o = bs(), a = U(() => [...bu, ...Xf(o)], [o]);
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
      if (i.defaultPrevented || i.metaKey || i.ctrlKey || i.altKey || cg(i.target)) return;
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
        children: /* @__PURE__ */ p(ji, { ...Pe, "aria-hidden": !0 })
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
const ug = ["source", "sideBySide", "translated"], dg = { source: "", translated: "", sideBySide: "" };
function fg(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = bn(e.sourceUrl), n = bn(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return uc({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function mg(e) {
  const [t, n] = N(() => /* @__PURE__ */ new Set()), r = U(
    () => e ? fg(e) : dg,
    [e]
  ), o = U(
    () => ug.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = L(async (s) => {
    if (!e) return;
    const i = bn(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? lc(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await dc(
          e.fetchProtected,
          i,
          c,
          c,
          null,
          (l) => n((u) => {
            const m = new Set(u);
            return l ? m.add(s) : m.delete(s), m;
          })
        );
      } catch (c) {
        const l = c instanceof Error ? c.message : "下载失败";
        fc(l), n((u) => {
          const m = new Set(u);
          return m.delete(s), m;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const hg = {
  source: Ma,
  sideBySide: xa,
  translated: Na
}, pg = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function gg(e) {
  const t = Be(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = mg(n), i = _(null);
  return O(() => {
    const c = () => {
      var m;
      (m = i.current) != null && m.open && (i.current.open = !1);
    }, l = (m) => {
      i.current && !i.current.contains(m.target) && c();
    }, u = (m) => {
      m.key === "Escape" && c();
    };
    return document.addEventListener("pointerdown", l), document.addEventListener("keydown", u), () => {
      document.removeEventListener("pointerdown", l), document.removeEventListener("keydown", u);
    };
  }, []), /* @__PURE__ */ C("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ C("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ p(Ui, { ...Pe, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = di[c], u = bn(r[c]), m = a.has(c), f = !!u && !m, d = f ? "" : fi(c, r), g = hg[c];
      return /* @__PURE__ */ C(
        "button",
        {
          type: "button",
          id: `reader-download-${c}`,
          className: `reader-download-action${m ? " is-busy" : ""}`,
          disabled: !f,
          "aria-label": f ? `下载${l.label}` : d,
          onClick: () => {
            i.current && (i.current.open = !1), s(c);
          },
          children: [
            /* @__PURE__ */ p(g, { ...Pe, "aria-hidden": !0 }),
            /* @__PURE__ */ C("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ C("span", { className: "reader-download-action-label", children: [
                pg[c],
                " PDF"
              ] }),
              d ? /* @__PURE__ */ p("span", { className: "reader-download-action-reason", children: d }) : null
            ] })
          ]
        },
        c
      );
    }) })
  ] });
}
const yg = "retainpdf:reader:bookmarks:v1:", bg = 200;
function Hr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Vs(e) {
  const t = `${e || ""}`.trim();
  return t ? `${yg}${t}` : "";
}
function vg(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Jt(e, t = Hr()) {
  const n = Vs(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = vg(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
const cr = /* @__PURE__ */ new Set();
function wg(e, t) {
  const n = (r) => {
    r === e && t();
  };
  return cr.add(n), () => {
    cr.delete(n);
  };
}
function lr(e, t, n) {
  const r = Vs(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, bg);
  if (r && n)
    try {
      n.setItem(r, JSON.stringify(o));
    } catch {
    }
  for (const a of [...cr]) a(e);
  return o;
}
function Sg(e, t, n = "", { storage: r = Hr(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Jt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? lr(e, a.filter((i) => i.page !== s), r) : lr(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Tg(e, t, n = Hr()) {
  return lr(e, Jt(e, n).filter((r) => r.page !== t), n);
}
function kg(e, t) {
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
function qs(e, t) {
  const [n, r] = N(() => Jt(e));
  O(() => (r(Jt(e)), wg(e, () => r(Jt(e)))), [e]);
  const o = L((s) => {
    r(Sg(e, s, kg(t, s)));
  }, [e, t]), a = L((s) => r(Tg(e, s)), [e]);
  return { bookmarks: n, toggle: o, remove: a };
}
const Ig = "retainpdf:reader:favorites:v1:", Eg = 500, jr = 2e3;
function Ur() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Js(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Ig}${t}` : "";
}
function Rg(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page)), r = `${t.text || ""}`.trim().slice(0, jr), o = `${t.id || ""}`.trim();
  return !o || !r || !Number.isFinite(n) || n < 1 ? null : { id: o, text: r, page: n, pane: t.pane === "translated" ? "translated" : "source", createdAt: `${t.createdAt || ""}` };
}
function Nt(e, t = Ur()) {
  const n = Js(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Set(), a = [];
    for (const s of Array.isArray(r) ? r : []) {
      const i = Rg(s);
      i && !o.has(i.id) && (o.add(i.id), a.push(i));
    }
    return a;
  } catch {
    return [];
  }
}
const ur = /* @__PURE__ */ new Set();
function Pg(e, t) {
  const n = (r) => {
    r === e && t();
  };
  return ur.add(n), () => {
    ur.delete(n);
  };
}
function Gs(e, t, n) {
  const r = Js(e), o = t.slice(0, Eg);
  if (r && n)
    try {
      n.setItem(r, JSON.stringify(o));
    } catch {
    }
  for (const a of [...ur]) a(e);
  return o;
}
function Wr(e, t, n) {
  const r = `${t || ""}`.trim().slice(0, jr);
  return e.find((o) => o.page === n && o.text === r) ?? null;
}
function Xs(e, t, { storage: n = Ur(), now: r = () => (/* @__PURE__ */ new Date()).toISOString(), makeId: o = xg } = {}) {
  const a = Nt(e, n), s = `${t.text || ""}`.trim().slice(0, jr), i = Math.floor(Number(t.page));
  return !s || !Number.isFinite(i) || i < 1 || Wr(a, s, i) ? a : Gs(e, [{ id: o(), text: s, page: i, pane: t.pane === "translated" ? "translated" : "source", createdAt: r() }, ...a], n);
}
function Mg(e, t, n = Ur()) {
  return Gs(e, Nt(e, n).filter((r) => r.id !== t), n);
}
function xg() {
  var e;
  try {
    if ((e = globalThis.crypto) != null && e.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
function Ys(e) {
  const [t, n] = N(() => Nt(e));
  O(() => (n(Nt(e)), Pg(e, () => n(Nt(e)))), [e]);
  const r = L(
    (a) => n(Xs(e, a)),
    [e]
  ), o = L((a) => n(Mg(e, a)), [e]);
  return { favorites: t, add: r, remove: o };
}
function Ng({ filled: e }) {
  return /* @__PURE__ */ p(Wi, { ...Pe, fill: e ? "currentColor" : "none", "aria-hidden": !0 });
}
function Ag({ scope: e, currentPage: t, numPages: n, regions: r }) {
  const { bookmarks: o, toggle: a } = qs(e, r);
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
        children: /* @__PURE__ */ p(Ng, { filled: i })
      }
    ),
    /* @__PURE__ */ p(_g, { scope: e })
  ] });
}
function _g({ scope: e }) {
  var c;
  const [t, n] = N(!1), r = _(null), { favorites: o, remove: a } = Ys(e), s = (c = Be()) == null ? void 0 : c.goToPage;
  O(() => {
    if (!t) return;
    const l = (m) => {
      var f;
      (f = r.current) != null && f.contains(m.target) || n(!1);
    }, u = (m) => {
      m.key === "Escape" && n(!1);
    };
    return document.addEventListener("pointerdown", l, !0), document.addEventListener("keydown", u), () => {
      document.removeEventListener("pointerdown", l, !0), document.removeEventListener("keydown", u);
    };
  }, [t]);
  const i = o.length;
  return /* @__PURE__ */ C("span", { className: "reader-favorites", ref: r, children: [
    /* @__PURE__ */ p(
      G,
      {
        className: "reader-react-hud-btn reader-favorites-toggle",
        "aria-expanded": t,
        "aria-haspopup": "dialog",
        "aria-label": i ? `收藏（${i} 段）` : "收藏",
        title: i ? `收藏的段落（${i} 段）` : "收藏：书页上选一段字，点浮条上的「收藏」",
        onClick: () => n((l) => !l),
        children: /* @__PURE__ */ p($a, { ...Pe, fill: i ? "currentColor" : "none", "aria-hidden": !0 })
      }
    ),
    t ? /* @__PURE__ */ C("div", { className: "reader-favorites-card reader-floating-surface", role: "dialog", "aria-label": "收藏", children: [
      /* @__PURE__ */ C("strong", { children: [
        "收藏",
        i ? /* @__PURE__ */ p("span", { className: "reader-favorites-count", children: i }) : null
      ] }),
      i ? /* @__PURE__ */ p("ul", { className: "reader-favorites-list", children: o.map((l) => /* @__PURE__ */ C("li", { children: [
        /* @__PURE__ */ C(
          G,
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
          G,
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
function Lg(e) {
  const t = Be(), n = kr(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? on, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = Zc(a), m = a > Wa + 1e-3, f = a < En - 1e-3, d = Et(r, Pt()), g = d >= En ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", [h, y] = N(!1), [v, S] = N(`${i}`);
  O(() => {
    h || S(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, h]);
  const b = () => {
    if (y(!1), !l || c <= 0)
      return;
    const T = Number(`${v}`.trim());
    l(Rn(T, c));
  };
  return /* @__PURE__ */ C("footer", { className: "reader-bottombar", "data-reader-hud": "true", children: [
    /* @__PURE__ */ C("div", { className: "reader-bottombar-start", children: [
      e.startSlot,
      e.bookmarkScope ? /* @__PURE__ */ p(
        Ag,
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
          onSubmit: (T) => {
            T.preventDefault(), b();
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
                value: v,
                autoFocus: !0,
                onChange: (T) => S(T.target.value.replace(/[^\d]/g, "")),
                onBlur: b,
                onKeyDown: (T) => {
                  T.key === "Escape" && (T.preventDefault(), y(!1), S(`${i}`));
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
        G,
        {
          className: "reader-react-hud-btn reader-react-hud-doc-dark",
          "aria-pressed": t.docDark ? "true" : "false",
          "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
          title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
          onClick: t.toggleDocDark,
          children: /* @__PURE__ */ p(Ki, { ...Pe, "aria-hidden": !0 })
        }
      ) }) : null,
      /* @__PURE__ */ C("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
        /* @__PURE__ */ p(
          "button",
          {
            type: "button",
            className: "reader-react-hud-btn",
            "aria-label": "缩小",
            disabled: !m,
            onClick: () => s(Yt(a, -1)),
            children: /* @__PURE__ */ p(La, { ...Pe, "aria-hidden": !0 })
          }
        ),
        /* @__PURE__ */ C(
          "button",
          {
            type: "button",
            className: "reader-react-hud-btn reader-react-hud-zoom-label",
            "aria-label": `${u}%，点击${g}`,
            title: g,
            onClick: () => s(d),
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
            disabled: !f,
            onClick: () => s(Yt(a, 1)),
            children: /* @__PURE__ */ p(Ca, { ...Pe, "aria-hidden": !0 })
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ C("div", { className: "reader-bottombar-end", children: [
      e.toolsSlot,
      /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(lg, {}) })
    ] })
  ] });
}
function da(e) {
  var t, n;
  return Ga(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function Cg(e) {
  const [t, n] = N(() => ({
    scope: e,
    panel: da(We(e))
  }));
  O(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: da(We(e))
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
const dr = "download-toast";
function $g({
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
function Dg(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    Wn.dismiss(dr);
    return;
  }
  Wn.custom(
    () => /* @__PURE__ */ p($g, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: dr, duration: 1 / 0 }
  );
}
function Og() {
  const e = L((t) => {
    t && (t.setState = Dg, t.hide = () => Wn.dismiss(dr));
  }, []);
  return /* @__PURE__ */ C(Ne, { children: [
    /* @__PURE__ */ p(ki, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
const fa = { itemId: null, origin: null };
function zg() {
  let e = fa;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? fa : { itemId: n, origin: r };
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
const ma = ["ask"];
function Fg(e) {
  const t = (n) => {
    const r = ma.indexOf(n.id);
    return r < 0 ? ma.length : r;
  };
  return [...e].sort((n, r) => t(n) - t(r));
}
function fr({
  place: e,
  active: t = null,
  extensions: n = Rr
}) {
  const r = e === "side" ? Fg(n) : n, [o, a] = N(null), s = bs(), i = (f) => {
    var d;
    return (((d = s.find((g) => g.id === f)) == null ? void 0 : d.contribution.toolbarItems) ?? []).filter((g) => (g.place ?? "side") === e);
  }, c = () => a(null), l = (() => {
    if (!o) return null;
    for (const { id: f } of r)
      for (const d of i(f)) {
        if (`${f}:${d.key}:popup` === o && d.popup) return d.popup(c);
        if (`${f}:${d.key}:dropdown` === o && d.dropdown) return d.dropdown(c);
      }
    return null;
  })(), u = _(null);
  O(() => {
    if (!o) return;
    const f = (g) => {
      var h;
      (h = u.current) != null && h.contains(g.target) || c();
    }, d = (g) => {
      g.key === "Escape" && c();
    };
    return document.addEventListener("pointerdown", f, !0), document.addEventListener("keydown", d), () => {
      document.removeEventListener("pointerdown", f, !0), document.removeEventListener("keydown", d);
    };
  }, [o]);
  const m = r.map((f) => {
    const d = i(f.id), g = e === "side" ? Pr([f]) : [];
    return !d.length && !g.length ? null : /* @__PURE__ */ C(Pn, { children: [
      d.map((h) => {
        const y = `${f.id}:${h.key}`, v = h.Icon;
        return /* @__PURE__ */ C("span", { className: "reader-bar-tool-group", "data-has-dropdown": h.dropdown ? "true" : void 0, children: [
          /* @__PURE__ */ p(
            G,
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
              children: e === "compare" ? /* @__PURE__ */ p(wn, { ...uo, "aria-hidden": !0 }) : h.mark ?? /* @__PURE__ */ p(v, { ...Pe, "aria-hidden": !0 })
            }
          ),
          h.dropdown ? /* @__PURE__ */ p(
            G,
            {
              className: "reader-bar-tool-caret",
              "aria-label": `${h.label}：选项`,
              title: `${h.label}的选项`,
              "aria-expanded": o === `${y}:dropdown`,
              "data-bar-tool-caret": h.key,
              onClick: () => a((S) => S === `${y}:dropdown` ? null : `${y}:dropdown`),
              children: /* @__PURE__ */ p(wn, { ...uo, "aria-hidden": !0 })
            }
          ) : null
        ] }, y);
      }),
      g.length ? /* @__PURE__ */ p(bp, { active: t, tabs: g }) : null
    ] }, f.id);
  }).filter(Boolean);
  return m.length ? /* @__PURE__ */ C("div", { className: `reader-bar-tools is-${e}`, ref: u, role: "group", "aria-label": e === "side" ? "面板" : e === "compare" ? "对比版本" : "书页工具", children: [
    m,
    l ? /* @__PURE__ */ p("div", { className: "reader-bar-tools-popup", children: l }) : null
  ] }) : null;
}
const ha = { search: "搜索", bookmarks: "书签", issues: "待改" }, Bg = [];
function Hg({
  open: e,
  onToggle: t,
  issueCount: n = 0,
  children: r
}) {
  const o = `在全文搜索，书签${n ? `、待改 ${n} 处` : ""}（⌘F）`;
  return /* @__PURE__ */ C("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ C(G, { className: "reader-finder-toggle", "aria-label": "左栏：搜索、书签、待改", "aria-pressed": !!e, title: o, onClick: t, children: [
      /* @__PURE__ */ p(Da, { ...Pe, "aria-hidden": !0 }),
      n ? /* @__PURE__ */ p("span", { className: "reader-finder-toggle-count", "aria-label": `待改 ${n} 处`, children: n }) : null
    ] }),
    r
  ] });
}
function jg({
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
  issueCount: m = 0
}) {
  var M;
  const f = ((M = Be()) == null ? void 0 : M.regions) ?? Bg, d = U(() => qu(f, s), [f, s]), [g, h] = N(-1);
  O(() => h(-1), [s]);
  const y = _(null), v = _(null), S = _(n);
  S.current = n, O(() => {
    if (c) return;
    const E = (A) => {
      var k, P;
      const I = A.target;
      !I || (k = v.current) != null && k.contains(I) || (P = I.closest) != null && P.call(I, ".reader-finder-toggles, [data-finder-toggle]") || S.current();
    }, D = (A) => {
      A.key === "Escape" && S.current();
    };
    return document.addEventListener("pointerdown", E, !0), document.addEventListener("keydown", D), () => {
      document.removeEventListener("pointerdown", E, !0), document.removeEventListener("keydown", D);
    };
  }, [c]);
  const b = _(null);
  O(() => {
    var E;
    e === "search" && ((E = y.current) == null || E.focus());
  }, [e, i]), O(() => {
    var E, D, A;
    e === "search" && g >= 0 && ((A = (D = (E = b.current) == null ? void 0 : E.querySelector('[aria-current="true"]')) == null ? void 0 : D.scrollIntoView) == null || A.call(D, { block: "nearest" }));
  }, [e, g]);
  const T = (E) => {
    const D = d[E];
    D && (h(E), r(D.itemId));
  }, w = ["search", ...l ? ["bookmarks"] : [], ...u ? ["issues"] : []], R = w.includes(e) ? e : "search";
  return /* @__PURE__ */ C("aside", { ref: v, className: "reader-finder", "data-finder-tab": R, "data-pinned": c ? "true" : void 0, "aria-label": `左栏：${ha[R]}`, children: [
    /* @__PURE__ */ C("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ p("div", { className: "reader-finder-tabs", role: "tablist", children: w.map((E) => /* @__PURE__ */ C(G, { className: "reader-finder-tab", role: "tab", "aria-selected": R === E, onClick: () => t(E), children: [
        ha[E],
        E === "issues" && m ? /* @__PURE__ */ p("span", { className: "reader-finder-tab-count", children: m }) : null
      ] }, E)) }),
      /* @__PURE__ */ p(G, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(bt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    R === "bookmarks" ? l : R === "issues" ? u : null,
    R !== "search" ? null : /* @__PURE__ */ C(Ne, { children: [
      /* @__PURE__ */ C("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          pr,
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
              E.key === "Enter" ? (E.preventDefault(), T(Ju(g, d.length, E.shiftKey))) : E.key === "Escape" && (E.preventDefault(), c ? E.currentTarget.blur() : n()), E.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: d.length === 0 ? "没有找到" : `${g >= 0 ? `第 ${g + 1} / ` : ""}${d.length >= 200 ? "200+ 处，只列前 200 处" : `${d.length} 处`}${g < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { ref: b, className: "reader-finder-list", children: d.map((E, D) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ C(G, { className: "reader-finder-entry is-hit", "aria-current": D === g ? "true" : void 0, onClick: () => T(D), children: [
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
function Zs(e, t = []) {
  for (const n of e)
    t.push(n), Zs(n.children, t);
  return t;
}
const Ug = 24, Ht = 28, pa = 15;
function Qs(e) {
  return e.reduce((t, n) => t + 1 + n.children.length, 0);
}
function Wg(e, t) {
  if (e.length)
    return (e.length === 1 && e[0].children.length ? e[0].children : e).map((o) => ({
      id: o.id,
      title: o.title,
      page: o.page,
      depth: 1,
      children: Zs(o.children).map((a) => ({ id: a.id, title: a.title, page: a.page, depth: a.level - o.level + 1 }))
    }));
  const n = [];
  for (const r of t) {
    const o = { id: r.itemId, title: r.text, page: r.page, itemId: r.itemId }, a = n[n.length - 1];
    r.level > 1 && a ? a.children.push({ ...o, depth: 2 }) : n.push({ ...o, depth: 1, children: [] });
  }
  return n;
}
function Kg(e, t) {
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
function Vg(e, t) {
  const n = Qs(e) > Ug, r = Math.max(1, Math.ceil(e.length / Ht)), o = [];
  if (e.forEach((i, c) => {
    const l = i.id === t.chapterId;
    if (!(c % r !== 0 && !l) && (o.push({ id: i.id, kind: "h1", state: i.id === t.nodeId ? "current" : l ? "chapter" : "" }), !(n && !l)))
      for (const u of i.children)
        u.depth > 2 && !l || o.push({ id: u.id, kind: "h2", state: u.id === t.nodeId ? "current" : "" });
  }), o.length <= Ht) return o;
  const a = Math.max(0, o.findIndex((i) => i.state === "current")), s = Math.min(Math.max(0, a - Math.floor(Ht / 2)), o.length - Ht);
  return o.slice(s, s + Ht);
}
function qg(e, t) {
  const n = t.trim().toLowerCase();
  if (!n) return [...e];
  const r = [];
  for (const o of e) {
    const a = o.title.toLowerCase().includes(n), s = o.children.filter((i) => i.title.toLowerCase().includes(n));
    a ? r.push(o) : s.length && r.push({ ...o, children: s });
  }
  return r;
}
const Jg = [];
function ga({ bookmarks: e, onJumpPage: t, onJumpBlock: n, pinned: r = !1, docked: o = !1, onPinChange: a }) {
  var A, I;
  const s = ((A = Be()) == null ? void 0 : A.regions) ?? Jg, i = ((I = kr()) == null ? void 0 : I.currentPage) ?? 1, c = U(() => Wg(e, Wu(s)), [e, s]), l = U(() => Kg(c, i), [c, i]), u = U(() => Vg(c, l), [c, l]), m = Qs(c), [f, d] = N(""), g = U(() => qg(c, f), [c, f]), [h, y] = N(() => /* @__PURE__ */ new Set()), v = _(null), S = _(!1), b = () => {
    l.chapterId && !h.has(l.chapterId) && y((k) => new Set(k).add(l.chapterId)), S.current = !0;
  };
  if (O(() => {
    (r || o) && b();
  }, [r, o]), Le(() => {
    var k, P, $;
    S.current && (S.current = !1, ($ = (P = (k = v.current) == null ? void 0 : k.querySelector('[aria-current="location"]')) == null ? void 0 : P.scrollIntoView) == null || $.call(P, { block: "center" }));
  }), !c.length) return null;
  const T = (k) => y((P) => {
    const $ = new Set(P);
    return $.has(k) ? $.delete(k) : $.add(k), $;
  }), w = (k, P) => {
    y(($) => $.has(P) ? $ : new Set($).add(P)), k.itemId ? n(k.itemId) : k.page !== null && t(k.page);
  }, R = !!f.trim(), M = (k, P) => /* @__PURE__ */ C(
    G,
    {
      className: "reader-toc-entry",
      "data-depth": Math.min(k.depth, 3),
      "aria-current": k.id === l.nodeId ? "location" : void 0,
      disabled: !k.itemId && k.page === null,
      title: k.page === null ? "这条书签没有指到页" : `${k.title}（第 ${k.page} 页）`,
      onClick: () => w(k, P),
      children: [
        /* @__PURE__ */ p("span", { className: "reader-toc-title", children: k.title }),
        k.page !== null ? /* @__PURE__ */ C("span", { className: "reader-toc-page", children: [
          "p.",
          k.page
        ] }) : null
      ]
    }
  ), E = r ? "取消固定" : "固定在左边", D = /* @__PURE__ */ C(Ne, { children: [
    /* @__PURE__ */ C("div", { className: "reader-toc-head", children: [
      /* @__PURE__ */ p("span", { className: "reader-toc-head-title", children: "目录" }),
      /* @__PURE__ */ p(G, { className: "reader-toc-pin", "aria-label": E, title: E, "aria-pressed": r, onClick: () => a == null ? void 0 : a(!r), children: r ? /* @__PURE__ */ p(Vi, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }) : /* @__PURE__ */ p(Pa, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }) })
    ] }),
    m > pa ? /* @__PURE__ */ C("div", { className: "reader-toc-filter", children: [
      /* @__PURE__ */ p(Da, { size: 13, "aria-hidden": !0 }),
      /* @__PURE__ */ p(
        pr,
        {
          size: "sm",
          className: "reader-toc-filter-input",
          value: f,
          placeholder: "过滤章节标题或节号…",
          "aria-label": "过滤目录",
          onChange: (k) => d(k.target.value),
          onKeyDown: (k) => {
            k.stopPropagation(), k.key === "Escape" && (f ? d("") : (k.currentTarget.blur(), r && !o && (a == null || a(!1))));
          }
        }
      ),
      f ? /* @__PURE__ */ p(G, { className: "reader-toc-filter-clear", "aria-label": "清掉", onClick: () => d(""), children: /* @__PURE__ */ p(bt, { size: 12, "aria-hidden": !0 }) }) : null
    ] }) : null,
    /* @__PURE__ */ p("div", { className: "reader-toc-list", ref: v, children: g.length ? g.map((k) => {
      const P = R || h.has(k.id);
      return /* @__PURE__ */ C("div", { className: "reader-toc-chapter", children: [
        /* @__PURE__ */ C("div", { className: "reader-toc-chapter-row", children: [
          k.children.length ? /* @__PURE__ */ p(
            G,
            {
              className: "reader-toc-caret",
              "aria-expanded": P,
              "aria-label": `${P ? "收起" : "展开"}「${k.title}」`,
              onClick: () => T(k.id),
              children: P ? /* @__PURE__ */ p(wn, { size: 12, "aria-hidden": !0 }) : /* @__PURE__ */ p(_a, { size: 12, "aria-hidden": !0 })
            }
          ) : /* @__PURE__ */ p("span", { className: "reader-toc-caret-space" }),
          M(k, k.id)
        ] }),
        P ? k.children.map(($) => /* @__PURE__ */ p("div", { children: M($, k.id) }, $.id)) : null
      ] }, k.id);
    }) : /* @__PURE__ */ p("p", { className: "reader-toc-empty", children: "没有匹配的章节" }) })
  ] });
  return o ? /* @__PURE__ */ p("nav", { className: "reader-toc-dock", "aria-label": "目录", children: D }) : /* @__PURE__ */ C(
    "nav",
    {
      className: "reader-toc-minimap",
      "aria-label": "目录",
      "data-pinned": r ? "true" : void 0,
      onPointerEnter: r ? void 0 : b,
      onKeyDown: (k) => {
        r && k.key === "Escape" && (a == null || a(!1));
      },
      onFocus: (k) => {
        !r && !k.currentTarget.contains(k.relatedTarget) && b();
      },
      children: [
        /* @__PURE__ */ p("div", { className: "reader-toc-bars", tabIndex: 0, "aria-label": `目录，${m} 条（移上去或按 Tab 展开）`, children: u.map((k) => /* @__PURE__ */ p("span", { className: "reader-toc-bar", "data-kind": k.kind, "data-state": k.state || void 0, "aria-hidden": !0 }, k.id)) }),
        /* @__PURE__ */ p("div", { className: "reader-toc-card", "data-compact": m <= pa ? "true" : void 0, children: D })
      ]
    }
  );
}
function Gg({ active: e }) {
  return /* @__PURE__ */ C("div", { className: "reader-side-rail", role: "toolbar", "aria-orientation": "vertical", "aria-label": "面板和下载", children: [
    /* @__PURE__ */ p(fr, { place: "side", active: e }),
    /* @__PURE__ */ p("span", { className: "reader-side-rail-sep", "aria-hidden": !0 }),
    /* @__PURE__ */ p(gg, {})
  ] });
}
const Xg = ".textLayer", ya = 8, Yg = 34, Zg = 56;
function Qg(e) {
  return e ? e.nodeType === 1 ? e : e.parentElement : null;
}
function yn(e = ((t) => (t = globalThis.getSelection) == null ? void 0 : t.call(globalThis))() ?? null) {
  if (!e || e.isCollapsed || !e.rangeCount) return null;
  const n = e.getRangeAt(0), r = ym(n);
  if (!r) return null;
  const o = ks(e);
  if (!o) return null;
  const a = r.closest(`[${Ie}]`);
  return {
    text: o,
    page: Math.max(1, Number(a == null ? void 0 : a.getAttribute(Ie)) || 1),
    pane: (a == null ? void 0 : a.getAttribute(we)) === "translated" ? "translated" : "source",
    layer: r
  };
}
async function ei(e) {
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
const ti = typeof navigator < "u" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
function ey(e) {
  const t = yn();
  if (!t) return [];
  const n = [{ key: "copy", label: "复制", hint: ti ? "⌘C" : "Ctrl+C", onSelect: () => {
    ei(t.text);
  } }];
  if (e) {
    const r = Wr(Nt(e), t.text, t.page);
    n.push({
      key: "favorite",
      label: r ? "已收藏（在左下角「收藏」里）" : "收藏这段",
      onSelect: () => {
        Xs(e, t);
      }
    });
  }
  return n;
}
function ty(e) {
  return [...e.querySelectorAll("span")].filter((t) => !t.classList.contains("markedContent") && !t.querySelector("span"));
}
function ny(e) {
  let t = 0, n = null;
  return e.map((r) => {
    const o = r.getBoundingClientRect(), a = o.top + o.height / 2;
    return n && Math.abs(a - n.center) > Math.max(o.height, n.height) / 2 && (t += 1), n = { center: a, height: o.height || (n == null ? void 0 : n.height) || 0 }, { text: r.textContent || "", line: t };
  });
}
function ry(e) {
  const t = [], n = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
  for (let r = n.nextNode(); r; r = n.nextNode()) t.push(r);
  return t;
}
function ba(e, t) {
  const n = Qg(e), r = n == null ? void 0 : n.closest(Xg), o = n == null ? void 0 : n.closest("span");
  if (!r || !o) return null;
  const a = ty(r), s = a.indexOf(o);
  if (s < 0) return null;
  const i = Math.max(0, s - 60), c = a.slice(i, Math.min(a.length, s + 61)), l = hm(ny(c), s - i);
  if (!l) return null;
  const u = ry(c[t === "start" ? l[0] : l[1]]);
  return u.length ? t === "start" ? { node: u[0], offset: 0 } : { node: u[u.length - 1], offset: u[u.length - 1].length } : null;
}
function oy(e) {
  if (!e || e.isCollapsed || !e.rangeCount) return !1;
  const t = e.getRangeAt(0), n = ba(t.startContainer, "start"), r = ba(t.endContainer, "end");
  if (!n && !r) return !1;
  const o = t.cloneRange();
  return n && t.comparePoint(n.node, n.offset) <= 0 && o.setStart(n.node, n.offset), r && t.comparePoint(r.node, r.offset) >= 0 && o.setEnd(r.node, r.offset), o.compareBoundaryPoints(Range.START_TO_START, t) === 0 && o.compareBoundaryPoints(Range.END_TO_END, t) === 0 ? !1 : (e.removeAllRanges(), e.addRange(o), !0);
}
function ay(e) {
  var i;
  if (!e || e.isCollapsed || !e.rangeCount) return [];
  const t = e.getRangeAt(0), n = t.commonAncestorContainer, r = n.nodeType === 3 ? [n] : (() => {
    const c = [], l = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
    for (let u = l.nextNode(); u; u = l.nextNode()) t.intersectsNode(u) && c.push(u);
    return c;
  })(), o = [], a = /* @__PURE__ */ new Map();
  for (const c of r) {
    const l = (i = c.parentElement) == null ? void 0 : i.closest(Qn);
    if (!l) continue;
    const u = l.closest(`.${rn}`) ?? l;
    let m = a.get(u);
    m || (m = u.getBoundingClientRect(), a.set(u, m));
    const f = document.createRange();
    if (f.selectNodeContents(c), c === t.startContainer && f.setStart(c, t.startOffset), c === t.endContainer && f.setEnd(c, t.endOffset), !!f.toString().trim())
      for (const d of f.getClientRects()) {
        const g = Math.max(d.left, m.left), h = Math.min(d.right, m.right);
        h - g > 0.5 && o.push({ left: g, top: d.top, right: h, bottom: d.bottom });
      }
  }
  const s = n.nodeType === 1 ? n : n.parentElement;
  for (const c of (s == null ? void 0 : s.querySelectorAll(".reader-layout-page svg.reader-layout-math")) ?? []) {
    if (!t.intersectsNode(c)) continue;
    const l = c.getBoundingClientRect();
    l.width > 0.5 && o.push({ left: l.left, top: l.top, right: l.right, bottom: l.bottom });
  }
  return pm(o);
}
function sy({ scope: e, menuItemsAt: t }) {
  const n = _(null), r = _(!1), o = _(!1), a = _(0), s = _(t);
  s.current = t;
  const [i, c] = N(null), l = _(null), u = L(() => {
    var R;
    a.current = 0;
    const f = n.current;
    if (!f) return;
    const d = ((R = globalThis.getSelection) == null ? void 0 : R.call(globalThis)) ?? null, g = ay(d), h = f.getBoundingClientRect();
    for (; f.children.length > g.length; ) f.lastElementChild.remove();
    if (g.forEach((M, E) => {
      const D = f.children[E] ?? f.appendChild(document.createElement("div"));
      D.className = "reader-selection-band", D.style.left = `${M.left - h.left}px`, D.style.top = `${M.top - h.top}px`, D.style.width = `${M.right - M.left}px`, D.style.height = `${M.bottom - M.top}px`;
    }), !r.current) return;
    const y = yn(d);
    if (!y || !g.length) {
      r.current = !1, c(null);
      return;
    }
    const v = g[0], S = g[g.length - 1], b = (Math.min(...g.map((M) => M.left)) + Math.max(...g.map((M) => M.right))) / 2 - h.left, T = v.top - h.top - ya - Yg, w = T >= Zg ? T : S.bottom - h.top + ya;
    c((M) => {
      var I;
      const E = M && M.text === y.text ? M.actions : s.current({
        target: y.layer,
        clientX: (v.left + v.right) / 2,
        clientY: (v.top + v.bottom) / 2,
        page: y.page
      }).filter((k) => k.inSelectionBar), D = ((I = l.current) == null ? void 0 : I.offsetWidth) || 220, A = Math.min(Math.max(b, D / 2 + 8), h.width - D / 2 - 8);
      return M && M.text === y.text && Math.abs(M.left - A) < 0.5 && Math.abs(M.top - w) < 0.5 ? M : { left: A, top: w, text: y.text, page: y.page, pane: y.pane, actions: E };
    });
  }, []), m = L(() => {
    a.current || (a.current = requestAnimationFrame(u));
  }, [u]);
  return O(() => {
    const f = n.current, d = f == null ? void 0 : f.parentElement, g = f == null ? void 0 : f.closest(`.${Ba}`);
    if (!f || !d) return;
    const h = () => {
      g && delete g.dataset.selectPane;
    }, y = (T) => {
      var M, E, D;
      const w = T.target;
      if (w && ((M = l.current) != null && M.contains(w))) return;
      r.current = !1, c(null);
      const R = (D = (E = w == null ? void 0 : w.closest) == null ? void 0 : E.call(w, `[${Ie}][${we}]`)) == null ? void 0 : D.getAttribute(we);
      o.current = !!R && T.button === 0, g && R && T.button === 0 && (g.dataset.selectPane = R);
    }, v = (T) => {
      var M;
      h();
      const w = o.current;
      if (o.current = !1, T.button !== 0 || !w) return;
      const R = ((M = globalThis.getSelection) == null ? void 0 : M.call(globalThis)) ?? null;
      yn(R) && (oy(R), r.current = !0, m());
    }, S = (T) => {
      const w = yn();
      !w || !T.clipboardData || (T.clipboardData.setData("text/plain", w.text), T.preventDefault());
    }, b = (T) => {
      T.key === "Escape" && r.current && (r.current = !1, c(null));
    };
    return d.addEventListener("pointerdown", y, !0), window.addEventListener("pointerup", v), window.addEventListener("pointercancel", h), document.addEventListener("selectionchange", m), document.addEventListener("copy", S), document.addEventListener("keydown", b), d.addEventListener("scroll", m, { capture: !0, passive: !0 }), window.addEventListener("resize", m), () => {
      h(), a.current && cancelAnimationFrame(a.current), d.removeEventListener("pointerdown", y, !0), window.removeEventListener("pointerup", v), window.removeEventListener("pointercancel", h), document.removeEventListener("selectionchange", m), document.removeEventListener("copy", S), document.removeEventListener("keydown", b), d.removeEventListener("scroll", m, { capture: !0 }), window.removeEventListener("resize", m);
    };
  }, [m]), /* @__PURE__ */ C(Ne, { children: [
    /* @__PURE__ */ p("div", { className: "reader-selection-paint", ref: n, "aria-hidden": "true" }),
    i ? /* @__PURE__ */ p(
      iy,
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
function iy({ bar: e, scope: t, onDone: n, ref: r }) {
  const { favorites: o, add: a } = Ys(t), s = !!t && !!Wr(o, e.text, e.page), [i, c] = N(!1);
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
          G,
          {
            className: "reader-selection-action",
            title: ti ? "复制（⌘C）" : "复制（Ctrl+C）",
            onClick: () => {
              ei(e.text).then((l) => c(l));
            },
            children: [
              i ? /* @__PURE__ */ p(hr, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }) : /* @__PURE__ */ p(Ra, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { children: i ? "已复制" : "复制" })
            ]
          }
        ),
        t ? /* @__PURE__ */ C(
          G,
          {
            className: "reader-selection-action",
            "aria-pressed": s,
            title: s ? "已收藏，在左下角「收藏」（星）里" : "收藏这段，在左下角「收藏」（星）里翻回来",
            onClick: () => {
              s || a({ text: e.text, page: e.page, pane: e.pane });
            },
            children: [
              /* @__PURE__ */ p($a, { size: 14, strokeWidth: 1.75, fill: s ? "currentColor" : "none", "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { children: s ? "已收藏" : "收藏" })
            ]
          }
        ) : null,
        e.actions.map((l) => /* @__PURE__ */ C(
          G,
          {
            className: "reader-selection-action",
            title: l.hint ? `${l.label}（${l.hint}）` : l.label,
            onClick: () => {
              n(), l.onSelect();
            },
            children: [
              /* @__PURE__ */ p(Aa, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { children: l.inSelectionBar })
            ]
          },
          l.key
        ))
      ]
    }
  );
}
function cy(e) {
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
function ly(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const uy = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, dy = ["failed", "content", "layout"];
function fy(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function my(e, t, n) {
  const r = cy(e), [o, a] = N(-1);
  O(() => a(-1), [r]);
  const s = L((c) => {
    const l = r[c];
    !l || !n || (a(c), n(l.readerItemId));
  }, [r, n]), i = _({ issues: r, last: o, currentPage: t, goTo: s });
  return i.current = { issues: r, last: o, currentPage: t, goTo: s }, O(() => {
    const c = (l) => {
      if (l.key.toLowerCase() !== "n" || l.metaKey || l.ctrlKey || l.altKey || fy(l.target)) return;
      const { issues: u, last: m, currentPage: f, goTo: d } = i.current, g = ly(u, m, f, l.shiftKey);
      g < 0 || (l.preventDefault(), d(g));
    };
    return document.addEventListener("keydown", c), () => document.removeEventListener("keydown", c);
  }, []), { issues: r, last: o, goTo: s };
}
function hy(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function py(e) {
  var r;
  if (e.shiftKey || hy(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${ja}`))) return null;
  const n = Number((r = t.closest(`[${Ie}]`)) == null ? void 0 : r.getAttribute(Ie)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function gy({
  menu: e,
  onClose: t,
  actions: n,
  sections: r
}) {
  const o = _(null);
  if (O(() => {
    if (!e) return;
    const c = (u) => {
      var m;
      (m = o.current) != null && m.contains(u.target) || t();
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
      G,
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
function yy({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ p("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ C("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
    /* @__PURE__ */ p("span", { children: n.phase === "failed" ? n.message : `改了 ${t} 处，还没排进 PDF` }),
    t ? /* @__PURE__ */ p(
      G,
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
const ni = "retainpdf:reader:doc-theme:v1", va = "data-reader-doc";
function ri() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function by(e = ri()) {
  try {
    return (e == null ? void 0 : e.getItem(ni)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function vy(e, t = ri()) {
  try {
    t == null || t.setItem(ni, e);
  } catch {
  }
}
function wa(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(va, "dark") : t.removeAttribute(va));
}
function wy() {
  const [e, t] = N(() => by());
  O(() => {
    wa(e);
  }, [e]), O(() => () => wa("light"), []);
  const n = L(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return vy(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
function Sy({ scope: e, regions: t, currentPage: n, numPages: r, onJumpPage: o }) {
  const { bookmarks: a, remove: s } = qs(e, t);
  return a.length ? /* @__PURE__ */ p("ol", { className: "reader-finder-list reader-bookmark-list", children: a.map((i) => /* @__PURE__ */ C("li", { className: i.page === n ? "is-current" : "", children: [
    /* @__PURE__ */ C(
      G,
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
    /* @__PURE__ */ p(G, { className: "reader-bookmark-remove", "aria-label": `删除第 ${i.page} 页的书签`, title: "删除这个书签", onClick: () => s(i.page), children: "×" })
  ] }, i.page)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: "还没有书签。左下角的书签按钮给眼下这一页加一个。" });
}
function Ty({ nav: e }) {
  const { issues: t, last: n, goTo: r } = e;
  return /* @__PURE__ */ C("div", { className: "reader-issues", children: [
    /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
    dy.map((o) => {
      const a = t.map((s, i) => ({ issue: s, index: i })).filter(({ issue: s }) => s.kind === o);
      return a.length ? /* @__PURE__ */ C("section", { className: "reader-issues-group", "data-issue-kind": o, children: [
        /* @__PURE__ */ C("h4", { children: [
          uy[o],
          /* @__PURE__ */ p("span", { children: a.length })
        ] }),
        /* @__PURE__ */ p("ol", { children: a.map(({ issue: s, index: i }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ C(G, { className: "reader-issues-item", "aria-current": i === n ? "true" : void 0, onClick: () => r(i), children: [
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
function ky({ state: e, bookmarkScope: t, issues: n }) {
  const { finder: r, setFinder: o, findQuery: a, setFindQuery: s, findTerm: i, findFocus: c, jumpFromFinder: l, jumpToPageFromFinder: u, pinned: m } = e, f = Be(), d = kr(), g = (d == null ? void 0 : d.currentPage) ?? 1, h = n.issues.length;
  return /* @__PURE__ */ p(Ne, { children: r ? /* @__PURE__ */ p(
    jg,
    {
      tab: r,
      onTab: o,
      onClose: () => o(null),
      onJump: l,
      query: a,
      onQuery: s,
      term: i,
      focusSignal: c,
      pinned: m,
      bookmarkPane: t ? /* @__PURE__ */ p(
        Sy,
        {
          scope: t,
          regions: f == null ? void 0 : f.regions,
          currentPage: g,
          numPages: (d == null ? void 0 : d.numPages) ?? 0,
          onJumpPage: u
        }
      ) : void 0,
      issuesPane: h ? /* @__PURE__ */ p(Ty, { nav: n }) : void 0,
      issueCount: h
    }
  ) : null });
}
function Iy({
  session: e,
  zoomDocuments: t,
  zoomItem: n,
  setZoomItem: r,
  closeZoom: o,
  visiblePdfMode: a
}) {
  return /* @__PURE__ */ p(Ne, { children: n ? /* @__PURE__ */ p(
    ap,
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
function Ey(e) {
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
const Ry = 720;
function Py(e, t) {
  return !t || !Number.isFinite(e) || e <= 0 ? !0 : e >= Ry;
}
function My(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function xy(e, t, n = !0) {
  const { sessionFiles: r } = e, [o, a] = N(!1), s = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, i = Ey({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: s,
    liveTranslationVisible: o,
    assistantOpen: t,
    compareFits: n
  }), c = ru({
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
  const m = _(null);
  return O(() => {
    m.current !== e.viewStateKey && su({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: l,
      jobTerminal: e.session.jobTerminal
    }) && (m.current = e.viewStateKey, a(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, l]), { liveTranslationVisible: o, setLiveTranslationVisible: a, paneComposition: i, liveToggles: c, sourceViewOnly: l, visiblePdfMode: u };
}
function Ny(e, { liveTranslationVisible: t, setLiveTranslationVisible: n, liveToggles: r, sourceViewOnly: o, visiblePdfMode: a }) {
  const s = ou(e.liveTranslation), i = L(() => {
    s && e.goToPage(s, "source");
  }, [e.goToPage, s]), [c, l] = N(null);
  O(() => {
    a === "compare" && e.session.jobTerminal && l(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, a]);
  const u = c !== e.viewStateKey && iu({
    state: e.liveTranslation,
    sourceViewOnly: o,
    visibleMode: a
  }), m = U(() => r.sourcePaneToggle ? /* @__PURE__ */ p(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${t ? " is-active" : ""}`,
      onClick: () => n((f) => !f),
      "aria-pressed": t,
      title: t ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [r.sourcePaneToggle, t]);
  return { latestLivePage: s, jumpToLatestLivePage: i, offerCompletion: u, setCompletionDismissedKey: l, sourcePaneAction: m };
}
function Ay() {
  const [e] = N(Uf), t = Qf(e), n = Jf(t);
  return { contributionStore: e, contributions: t, reserveRight: n };
}
function _y(e, t, n) {
  const r = _(e);
  O(() => {
    const o = e > 0 && r.current <= 0;
    r.current = e, o && t && n();
  }, [e]);
}
function Ly(e, t, {
  translationVersions: n,
  bookmarks: r,
  regionHover: o,
  assistantPanel: a,
  closeAssistant: s,
  visiblePdfMode: i,
  changeWorkspace: c,
  jumpToBlockIn: l,
  zoomDocuments: u,
  editBlock: m,
  panelHost: f = null
}) {
  const { session: d, panes: g } = e, h = _(e.currentPage);
  h.current = e.currentPage;
  const y = L(() => h.current, []), v = U(() => ({
    documentId: d.documentId || "",
    jobId: d.jobId,
    versionId: n.readingVersionId || null,
    translationVersions: n.versions,
    regions: d.regions,
    metadata: d.readerMetadata,
    bookmarks: r,
    pageCount: g.hudNumPages || 0,
    resetKey: e.viewStateKey,
    hoveredItemId: () => o.get().itemId,
    goToPage: e.goToPage,
    sourceOnly: e.sourceOnly,
    activePanel: a,
    closePanel: s,
    panelHost: f,
    visibleMode: i,
    setWorkspace: c,
    jumpToBlock: l,
    shellEl: e.shell.shellEl,
    primaryPane: e.panes.primaryPane,
    pdfDocuments: u,
    editBlock: m,
    currentPage: y
  }), [
    d.documentId,
    d.jobId,
    n,
    d.regions,
    d.readerMetadata,
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
    m,
    f
  ]), { contributionStore: S, contributions: b, reserveRight: T } = t, w = U(() => Wf(b), [b]), R = U(() => Gf(b), [b]), M = U(() => qf(b), [b]), E = U(() => Kf(b), [b]), D = Vf(b);
  return { readerApi: v, contributionStore: S, contributions: b, pageLayers: w, compareVersion: R, textMarks: M, menuSections: E, pointerTakenId: D, reserveRight: T };
}
function Cy() {
  try {
    return Ze().translationEdit ?? null;
  } catch {
    return null;
  }
}
const $y = "这本书正在处理（翻译或排版），处理完才能改。", Dy = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function Oy({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = Cy(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = Yu(s), l = !t || Gt(t), u = rd(n), [m, f] = N(""), [d, g] = N(null), [h, y] = N(() => /* @__PURE__ */ new Map()), [v, S] = N(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [b, T] = N(() => /* @__PURE__ */ new Map()), [w, R] = N({ phase: "idle" }), M = _({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  O(() => {
    g(null), M.drafts.clear(), M.generation.current = null, T(/* @__PURE__ */ new Map()), R({ phase: "idle" });
  }, [s]), O(() => {
    if (f(""), !i || c || !a) return;
    let z = !1;
    return a.resolveOwnerJobId(s).then((K) => {
      z || f(`${K || s}`.trim() || s);
    }).catch(() => {
      z || f(s);
    }), () => {
      z = !0;
    };
  }, [i, c, a, s]), O(() => {
    if (y(/* @__PURE__ */ new Map()), !a || !m || !u || !l) return;
    let z = !1;
    return a.fetchRevisions(m).then((K) => {
      z || y(od(K, u));
    }).catch(() => {
    }), () => {
      z = !0;
    };
  }, [a, m, u, l]);
  const E = w.phase === "running" && w.seenActive;
  O(() => {
    if (w.phase === "running") {
      if (!l) {
        E || R({ phase: "running", seenActive: !0 });
        return;
      }
      E && R(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [w.phase, E, l, t]);
  const D = U(() => {
    const z = new Map(h);
    if (v.renderedAt === u)
      for (const [K, j] of v.edits) z.set(K, j);
    return z;
  }, [h, v, u]), A = L((z) => {
    const K = `${z || ""}`.trim();
    K && g({ itemId: K, page: Zu(K) });
  }, []), I = L(() => g(null), []), k = L((z, K) => {
    S((j) => {
      const J = new Map(j.renderedAt === u ? j.edits : []);
      return J.set(z, K), { renderedAt: u, edits: J };
    }), T((j) => new Map(j).set(z, (j.get(z) || 0) + 1));
  }, [u]), P = L(async () => {
    if (!(!a || !s || w.phase === "submitting" || w.phase === "running")) {
      R({ phase: "submitting" });
      try {
        await a.rerender(s), R({ phase: "running", seenActive: !1 }), await o();
      } catch (z) {
        R({ phase: "failed", message: (z == null ? void 0 : z.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, w.phase, o]), $ = c ? Dy : !l || w.phase === "running" || w.phase === "submitting" ? $y : "";
  return U(() => ({
    available: i,
    blockedReason: $,
    port: a,
    ownerJobId: m,
    target: d,
    select: A,
    close: I,
    memory: M,
    pendingEdits: D,
    savedCounts: b,
    markSaved: k,
    rerender: w,
    startRerender: P
  }), [i, $, a, m, d, A, I, M, D, b, k, w, P]);
}
function zy(e, t) {
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
function Fy(e, t, n) {
  const { session: r, sessionFiles: o } = e, a = Oy({
    jobId: r.jobId,
    jobStatus: r.jobStatus,
    jobPayload: r.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!o.translatedUrl,
    refreshJobStatus: r.refreshJobStatus
  }), s = a.select, i = e.setModeKeepingPage, c = r.regions, l = a.memory.drafts, u = L((f, d) => {
    is(c, f) && (t === "source" && i("compare"), d != null && d.trim() && l.set(f, d), s(f));
  }, [c, s, t, i, l]);
  zy(a.available ? u : null, n);
  const m = U(() => {
    if (!a.savedCounts.size) return e.revisedBlocks;
    const f = new Map(e.revisedBlocks);
    for (const [d, g] of a.savedCounts) f.set(d, (f.get(d) || 0) + g);
    return f;
  }, [e.revisedBlocks, a.savedCounts]);
  return { blockEdit: a, editBlock: u, revisedBlocks: m };
}
const By = "reader-finder-input";
function Hy(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function jy(e, t = typeof window > "u" ? null : window) {
  O(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!Hy(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(By) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
const oi = "retainpdf.reader.sidebar.v1", Uy = ["search", "bookmarks", "issues"], Wy = 900;
function Ky() {
  var e;
  try {
    const t = JSON.parse(((e = globalThis.localStorage) == null ? void 0 : e.getItem(oi)) || "{}");
    return { tab: Uy.includes(t == null ? void 0 : t.tab) ? t.tab : "search" };
  } catch {
    return { tab: "search" };
  }
}
function Vy(e) {
  var t;
  try {
    (t = globalThis.localStorage) == null || t.setItem(oi, JSON.stringify(e));
  } catch {
  }
}
function qy() {
  const e = `(min-width: ${Wy}px)`, [t, n] = N(() => typeof window > "u" || !window.matchMedia ? !0 : window.matchMedia(e).matches);
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
function Jy(e) {
  const [t] = N(Ky), [n, r] = N(null), [o, a] = N(t.tab), i = qy(), c = L((w) => {
    r(w), w && a(w);
  }, []);
  O(() => {
    Vy({ tab: n || o });
  }, [n, o]);
  const l = L(() => r((w) => w ? null : o), [o]), u = L((w) => {
    r((R) => R === w ? null : w), a(w);
  }, []), [m, f] = N(""), [d, g] = N("");
  O(() => {
    const w = m.replace(/\s+/gu, " ").trim(), R = window.setTimeout(() => g(w), w ? 150 : 0);
    return () => window.clearTimeout(R);
  }, [m]);
  const [h, y] = N(0), v = L(() => {
    c("search"), y((w) => w + 1);
  }, [c]);
  jy(v);
  const S = L(() => {
    i || r(null);
  }, [i]), b = L((w) => {
    e.jumpToAnchor({ block_id: w }), S();
  }, [e.jumpToAnchor, S]), T = L((w) => {
    e.goToPage(w), S();
  }, [e.goToPage, S]);
  return {
    finder: n,
    setFinder: c,
    toggleFinder: u,
    toggleSidebar: l,
    pinned: i,
    findQuery: m,
    setFindQuery: f,
    findTerm: d,
    findFocus: h,
    jumpFromFinder: b,
    jumpToPageFromFinder: T
  };
}
function Gy(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : Va(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Xy(e, t) {
  return t === null || e !== t;
}
function Yy(e, t) {
  const { boot: n } = e, r = _(null), o = _(null);
  O(() => {
    if (!(n.loading || n.failed)) {
      if (r.current !== e.viewStateKey) {
        r.current = e.viewStateKey;
        const a = We(e.viewStateKey), s = Gy({
          savedMode: a == null ? void 0 : a.mode,
          sourceViewOnly: t,
          viewportWidth: Pt()
        });
        o.current = s.auto ? s.mode : null, s.mode && s.mode !== e.mode && e.setModeKeepingPage(s.mode);
        return;
      }
      Xy(e.mode, o.current) && (o.current = null, xn(e.viewStateKey, { mode: e.mode }));
    }
  }, [n.failed, n.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, t]);
}
const Zy = [];
function Qy(e) {
  const { sessionFiles: t } = e, [n, r] = N({}), o = _({ source: t.sourceUrl, translated: t.translatedUrl });
  o.current = { source: t.sourceUrl, translated: t.translatedUrl };
  const a = L((y, v) => {
    r((S) => ({ ...S, [v]: { url: o.current[v], nodes: y } }));
  }, []), s = U(() => {
    const y = n.source;
    if (y && y.url === t.sourceUrl && y.nodes.length) return y.nodes;
    const v = n.translated;
    return v && v.url === t.translatedUrl && v.nodes.length ? v.nodes : Zy;
  }, [n, t.sourceUrl, t.translatedUrl]), i = _({}), [c, l] = N(0), u = L((y, v) => {
    i.current[v] = { url: o.current[v], pdf: y }, l((S) => S + 1);
  }, []), [m, f] = N(null), d = L((y) => f(y), []), g = L(() => f(null), []);
  O(() => f(null), [e.viewStateKey]);
  const h = U(() => {
    const y = (v, S) => {
      const b = i.current[v];
      return b && b.url === S ? b.pdf : null;
    };
    return { source: y("source", t.sourceUrl), translated: y("translated", t.translatedUrl) };
  }, [c, t.sourceUrl, t.translatedUrl]);
  return { bookmarks: s, onPdfOutline: a, onPdfDocument: u, zoomItem: m, setZoomItem: f, zoomBlock: d, closeZoom: g, zoomDocuments: h };
}
function eb() {
  const e = gu(), { boot: t, panes: n, session: r } = e, o = Cg(e.viewStateKey), a = o.panel, s = o.setPanel, i = a !== null, c = Ay(), { reserveRight: l } = c, u = i || l > 0, m = Jy(e), { finder: f, findTerm: d } = m, g = !!f && m.pinned, [h, y] = N(!1), v = h && m.pinned, S = L(() => {
    s(null);
  }, []);
  _y(l, a, S);
  const { liveTranslationVisible: b, setLiveTranslationVisible: T, paneComposition: w, liveToggles: R, sourceViewOnly: M, visiblePdfMode: E } = xy(
    e,
    i,
    Py(e.shell.shellWidth, u || g || v)
  );
  Yy(e, M);
  const D = a || (e.mode === "compare" ? "compare" : "reading"), { docDark: A, toggleDocDark: I } = wy();
  ku({
    toggleDocDark: I,
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
  const { latestLivePage: k, jumpToLatestLivePage: P, offerCompletion: $, setCompletionDismissedKey: z, sourcePaneAction: K } = Ny(e, {
    liveTranslationVisible: b,
    setLiveTranslationVisible: T,
    liveToggles: R,
    sourceViewOnly: M,
    visiblePdfMode: E
  }), j = L((be) => {
    const F = My(be, e.liveTranslationAvailable);
    F !== null && T(F), e.setModeKeepingPage(be);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), J = L((be) => {
    s(be);
  }, []), [oe] = N(zg), q = L((be) => e.jumpToAnchor({ block_id: be }), [e.jumpToAnchor]), se = my(e.sourceOnly ? "" : r.jobId, e.currentPage, q), [Ee, re] = N(null), ue = L((be, F) => e.jumpToAnchor({ block_id: be }, F), [e.jumpToAnchor]), { bookmarks: Me, onPdfOutline: ie, onPdfDocument: le, zoomItem: B, setZoomItem: W, zoomBlock: Y, closeZoom: de, zoomDocuments: ne } = Qy(e), { blockEdit: ae, editBlock: Se, revisedBlocks: ee } = Fy(e, E, oe), [Z, fe] = N(null), x = L(() => fe(null), []), H = Zm({ documentId: r.documentId, jobId: r.jobId }), {
    readerApi: V,
    contributionStore: me,
    contributions: ye,
    pageLayers: Te,
    compareVersion: Ae,
    textMarks: ze,
    menuSections: He,
    pointerTakenId: Qe
  } = Ly(e, c, {
    translationVersions: H,
    bookmarks: Me,
    regionHover: oe,
    assistantPanel: a,
    closeAssistant: S,
    visiblePdfMode: E,
    changeWorkspace: j,
    jumpToBlockIn: ue,
    zoomDocuments: ne,
    editBlock: ae.available && !ae.blockedReason ? Se : null,
    panelHost: Ee
  }), $e = !!Qe, [Ke, et] = N([]), tt = U(() => ({
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
    pageLayers: Te,
    editBlock: ae.available ? Se : void 0,
    blockEdit: ae,
    editShowsSource: E !== "compare",
    findTerm: f === "search" ? d : "",
    compareVersion: Ae,
    pointerTaken: $e,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: M,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: J, close: S },
    docDark: A,
    toggleDocDark: I
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
    Te,
    ae,
    Se,
    E,
    f,
    d,
    Ae,
    $e,
    e.sourceOnly,
    M,
    e.download,
    e.goToPage,
    J,
    S,
    A,
    I
  ]), St = U(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), nt = [
    Ba,
    `is-workspace-${D}`,
    i ? "is-assistant-open" : "",
    f ? "is-finder-open" : "",
    g ? "is-sidebar-pinned" : "",
    v ? "is-toc-docked" : "",
    w.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(Yf, { api: V, store: me, children: /* @__PURE__ */ p(Yd, { value: tt, hud: St, children: /* @__PURE__ */ C(
    "div",
    {
      className: nt,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": D,
      "data-pointer-taken": Qe || void 0,
      onContextMenu: (be) => {
        const F = py(be);
        if (!F) return;
        const Q = [
          ...ey(e.viewStateKey),
          ...Ro(ye, { target: be.target, clientX: be.clientX, clientY: be.clientY, page: F.page })
        ];
        !Q.length && !He.length || (be.preventDefault(), et(Q), fe(F));
      },
      children: [
        /* @__PURE__ */ C("div", { className: "reader-workspace", children: [
          v ? /* @__PURE__ */ p(ga, { bookmarks: Me, onJumpPage: e.goToPage, onJumpBlock: q, pinned: !0, docked: !0, onPinChange: y }) : null,
          /* @__PURE__ */ p(ky, { state: m, bookmarkScope: e.viewStateKey, issues: se }),
          /* @__PURE__ */ C("div", { className: "reader-stage", children: [
            /* @__PURE__ */ p(
              jf,
              {
                mode: E,
                documentReady: !!r.jobId,
                sourceViewOnly: M,
                onModeChange: j,
                compareExtra: /* @__PURE__ */ p(fr, { place: "compare" }),
                liveTranslation: R.topBarPill ? {
                  visible: b,
                  state: e.liveTranslation,
                  onToggle: () => T((be) => !be),
                  latestPage: b ? k : null,
                  currentPage: e.currentPage,
                  onJumpToLatest: P
                } : null,
                completion: $ ? {
                  onOpenCompare: () => {
                    z(e.viewStateKey), j("compare");
                  }
                } : null,
                start: /* @__PURE__ */ p(Nu, { onBeforeClose: r.prepareClose })
              }
            ),
            v ? null : /* @__PURE__ */ p(ga, { bookmarks: Me, onJumpPage: e.goToPage, onJumpBlock: q, pinned: h, onPinChange: y }),
            /* @__PURE__ */ p(Gg, { active: a }),
            /* @__PURE__ */ p(sy, { scope: e.viewStateKey, menuItemsAt: (be) => Ro(ye, be) }),
            /* @__PURE__ */ p(_f, { paneComposition: w, markdownSplit: i, assistantSplit: u, liveTranslation: e.liveTranslation, sourcePaneAction: K }),
            /* @__PURE__ */ p(ig, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!r.readerErrors.regions, metadataError: !!r.readerErrors.metadata, onRetry: r.refreshJobArtifacts }),
            /* @__PURE__ */ p(
              Lg,
              {
                mode: E,
                modeControls: null,
                bookmarkScope: e.viewStateKey,
                startSlot: /* @__PURE__ */ p(Hg, { open: f, onToggle: m.toggleSidebar, issueCount: se.issues.length }),
                leftSlot: /* @__PURE__ */ p(yy, { edit: ae }),
                toolsSlot: /* @__PURE__ */ p(fr, { place: "bottom" })
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
                /* @__PURE__ */ p(vp, { active: a }),
                /* @__PURE__ */ p("div", { className: "reader-dock-body", ref: re })
              ]
            }
          )
        ] }),
        i ? /* @__PURE__ */ p(ag, {}) : null,
        /* @__PURE__ */ p(
          Iy,
          {
            session: r,
            zoomDocuments: ne,
            zoomItem: B,
            setZoomItem: W,
            closeZoom: de,
            visiblePdfMode: E
          }
        ),
        /* @__PURE__ */ p(gy, { menu: Z, onClose: x, actions: Ke, sections: He }),
        /* @__PURE__ */ p(tm, { extensions: Rr }),
        /* @__PURE__ */ p(Og, {})
      ]
    }
  ) }) });
}
function Ib() {
  return /* @__PURE__ */ p(eb, {});
}
export {
  Ib as R,
  eb as a,
  Sb as b,
  Tb as c,
  xm as d,
  Am as e,
  vb as f,
  wb as g,
  yb as h,
  bb as r,
  kb as s,
  Be as u
};
//# sourceMappingURL=ReaderApp-CWsPq-Wj.js.map
