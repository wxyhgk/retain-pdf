var gi = Object.defineProperty;
var Gr = (e) => {
  throw TypeError(e);
};
var yi = (e, t, n) => t in e ? gi(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var Xr = (e, t, n) => yi(e, typeof t != "symbol" ? t + "" : t, n), Yr = (e, t, n) => t.has(e) || Gr("Cannot " + n);
var Dt = (e, t, n) => (Yr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Zr = (e, t, n) => t.has(e) ? Gr("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Qr = (e, t, n, r) => (Yr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as C, jsx as p, Fragment as Re } from "react/jsx-runtime";
import { useMemo as U, useState as A, useEffect as O, useCallback as L, useRef as _, useLayoutEffect as Le, memo as tn, createContext as nn, useContext as ft, Fragment as Mn, forwardRef as bi, useImperativeHandle as pr, useSyncExternalStore as xn, Component as vi, Suspense as Na, lazy as Aa, useId as _a } from "react";
import { requireAdapter as Ct, getReaderAdapters as Oe } from "./adapters.js";
import { resolveReaderDownloadName as wi, resolveReaderDownloadUrls as Si, READER_PROGRESS_COPY as Ve, trimString as bn, READER_DOWNLOAD_ACTIONS as ki, disabledReason as Ti } from "./runtime/state.js";
import { r as Ii, b as Ei } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as Kn, isFinishedJobStatus as Xt } from "@retainpdf/domain/job";
import { n as La, d as Ri, f as Ln, k as eo, b as Pi, c as Mi, j as Ce, p as lt, g as xi, l as mt, i as Ni } from "./reader-regions-BmqHsJ-I.js";
import { fetchDocumentReading as Ai } from "@retainpdf/api/documents";
import { isReaderTransportError as _i, createReaderTransportError as Li } from "./contracts.js";
import { toast as Vn, Toaster as Ci } from "sonner";
import { ChevronLeft as Ca, PenLine as vn, ZoomIn as $i, Check as gr, X as bt, Copy as $a, ChevronUp as Di, ChevronDown as wn, History as Oi, LoaderCircle as zi, Pin as Da, LogOut as Fi, FileText as Oa, Columns2 as za, Languages as Fa, Radio as Bi, ArrowDownToLine as Hi, CheckCircle2 as ji, ImagePlus as Ui, MessageCircle as Ba, Scan as Wi, GitCompareArrows as Ki, CodeXml as Vi, Highlighter as qi, Eraser as Ji, Undo2 as Gi, Trash2 as Xi, BookText as Yi, ChevronRight as Ha, Minus as ja, Plus as Ua, ArrowLeft as Zi, CircleHelp as Qi, Download as ec, Bookmark as tc, Star as Wa, Contrast as nc, Search as Ka, PinOff as rc } from "lucide-react";
import { Button as G, Textarea as oc, IconButton as dt, Input as yr } from "@retainpdf/ui";
import { e as ac, m as sc, a as ic, c as cc } from "./markdown-math-B8jhIfTG.js";
import { pdfjs as Sn, Page as lc, Document as uc } from "react-pdf";
import { createPortal as dc } from "react-dom";
const fc = (...e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, mc = "", hc = Object.freeze({
  progress: "retainpdf-reader-progress"
}), br = (e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, _b = (...e) => {
  var n;
  return (((n = Oe()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Lb = () => {
  var e, t;
  return ((t = (e = Oe()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
}, qe = () => Ct("defaultReaderDataPort"), to = () => Ct("defaultReaderPageConfigPort"), no = {
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
}, Va = {
  messageTargetOrigin: () => to().messageTargetOrigin(),
  readerJobId: () => to().readerJobId()
}, pc = () => {
  var e;
  return ((e = Oe()) == null ? void 0 : e.liveTranslation) ?? null;
}, At = () => {
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
    fetchDocumentByJobId: (...n) => Ct("fetchDocumentByJobId")(...n),
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
}, gc = (...e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, yc = () => {
  var e, t;
  return ((t = (e = Oe()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, bc = (...e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, vc = (...e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? wi(...e);
}, wc = (...e) => {
  var t, n;
  return ((n = (t = Oe()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? Si(...e);
}, Sc = (...e) => Ct("downloadProtectedResource")(...e), kc = (...e) => Ct("failDownloadToast")(...e), Cb = (e, t) => Ct("resolveMarkdownAssetUrl")(e, t), ro = "/api/v1";
function Tc() {
  const e = () => {
    var r;
    return Ii(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = A(e);
  return O(() => {
    var i, c, l, u;
    const r = () => n(e()), o = (c = (i = globalThis.history) == null ? void 0 : i.pushState) == null ? void 0 : c.bind(globalThis.history), a = (u = (l = globalThis.history) == null ? void 0 : l.replaceState) == null ? void 0 : u.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const f = (d) => function(...h) {
          const g = d.apply(this, h);
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
function Ic() {
  const e = Tc(), t = U(() => bc(Va), [e]), n = U(() => yc(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function Ec(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: i
  } = e, [c, l] = A({
    documentId: "",
    jobId: ""
  }), [u, f] = A({
    documentId: "",
    jobId: ""
  }), d = c.documentId === t ? c.jobId : "", h = u.documentId === t ? u.jobId : "", g = n || d, [m, y] = A({
    jobId: "",
    documentId: ""
  }), v = m.jobId === g ? m.documentId : "", w = t || v, b = !!t && !g, [k, S] = A(null), P = (k == null ? void 0 : k.sessionIdentity) === r && k.documentId === w ? k : null, R = b || !!P, E = L((x) => {
    const T = `${x.documentId || ""}`.trim();
    if (!T || a.current && a.current !== T) return;
    if (!a.current && s.current)
      y({
        jobId: s.current,
        documentId: T
      });
    else if (!a.current)
      return;
    const I = `${x.revision || ""}`.trim() || `${Date.now()}`;
    S({
      documentId: T,
      revision: I,
      sessionIdentity: o.current
    }), i();
  }, []);
  O(() => {
    S((x) => x && x.sessionIdentity !== r ? null : x);
  }, [r]);
  const D = L((x) => {
    switch (x.type) {
      case "resolved-document-job":
        l({ documentId: x.documentId, jobId: x.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        f({ documentId: x.documentId, jobId: x.jobId });
        break;
      case "resolved-job-document":
        y((T) => T.jobId === x.jobId && T.documentId === x.documentId ? T : { jobId: x.jobId, documentId: x.documentId });
        break;
      case "committed-source":
        S({
          documentId: x.documentId,
          revision: x.revision,
          sessionIdentity: x.sessionIdentity
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
    rejectedDocumentJobId: h,
    sessionJobId: g,
    resolvedJobDocument: m,
    setResolvedJobDocument: y,
    jobDocumentId: v,
    documentId: w,
    sourceOnly: b,
    committedDocumentSource: k,
    setCommittedDocumentSource: S,
    activeCommittedDocumentSource: P,
    sourceViewOnly: R,
    refreshCommittedDocument: E,
    applyIdentityEvent: D
  };
}
function oo(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function Rc(e) {
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
function ao(e, t) {
  return br(Kn(e, t));
}
function Pc(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function Mc(e, t) {
  const n = e == null ? void 0 : e.book_summary, r = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    n == null ? void 0 : n.title,
    e == null ? void 0 : e.source_file_name,
    n == null ? void 0 : n.source_file_name
  ];
  for (const o of r) {
    const a = `${o || ""}`.trim();
    if (a && !Pc(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function qn({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: hc.progress,
        stage: n,
        percent: e,
        text: t
      },
      Va.messageTargetOrigin()
    );
  } catch {
  }
}
function kn(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), qn({ percent: t, text: n, stage: r });
}
function xc(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = A(null), [l, u] = A(null), [f, d] = A(""), [h, g] = A(0), m = f === n ? i : null, y = f === n ? l : null, v = oo(m), w = Xt(v), b = L(() => {
    g((D) => D + 1);
  }, []), k = L((D) => {
    c(D.jobPayload), u(D.manifestPayload), d(D.sessionIdentity);
  }, []), S = L((D) => {
    c(null), u(null), d(D);
  }, []), P = _(""), R = _(""), E = L(async () => {
    const D = o.current;
    if (!D || P.current === D) return;
    const x = Ze().loadJobPayload;
    if (typeof x != "function") return;
    const T = a.current.value;
    P.current = D;
    try {
      const I = await x(D);
      if (s.current || a.current.value !== T || o.current !== D || !I || typeof I != "object")
        return;
      const M = oo(I);
      c(I), d(r.current), !Xt(M) && R.current === D && (R.current = ""), M === "succeeded" && R.current !== D && (R.current = D, g(($) => $ + 1));
    } catch {
    } finally {
      P.current === D && (P.current = "");
    }
  }, []);
  return O(() => {
    R.current = "";
  }, [n]), O(() => {
    if (!t || w || !m) return;
    const D = window.setInterval(() => {
      document.visibilityState !== "hidden" && E();
    }, 1e3);
    return () => window.clearInterval(D);
  }, [w, E, m, t]), {
    jobPayload: i,
    setJobPayload: c,
    manifestPayload: l,
    setManifestPayload: u,
    payloadSessionIdentity: f,
    setPayloadSessionIdentity: d,
    scopedJobPayload: m,
    scopedManifestPayload: y,
    jobStatus: v,
    jobTerminal: w,
    jobRefreshRevision: h,
    refreshJobArtifacts: b,
    refreshJobStatus: E,
    publishPayload: k,
    clearPayload: S
  };
}
function Jn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function Nc(e, t) {
  e(t), Jn(t);
}
function Ac(e) {
  const [t, n] = A(e ? "source" : "compare"), r = L((a) => {
    e && a !== "source" || (n(a), Jn(a));
  }, [e]), o = L((a) => {
    Nc(n, a);
  }, []);
  return O(() => (e && document.documentElement.classList.add("reader-source-only"), Jn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function so(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function _c(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: so(n.active_job_id),
    activeVersionId: so(n.active_version_id)
  };
}
function Lc(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Cc(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function $c(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Dc = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Oc(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Dc.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const zc = 48 * 1024 * 1024;
function Fc(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Bc = 2, De = /* @__PURE__ */ new Map();
function Gn(e, t) {
  De.delete(e), De.set(e, t);
}
function io(e) {
  if (De.size < Bc) return;
  const t = De.keys().next().value;
  t && De.delete(t);
}
async function Hc(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function vr(e, t = At().fetchProtected, n = {}) {
  var u, f, d, h, g, m, y, v, w;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (De.has(r)) {
    const b = De.get(r);
    return Gn(r, b), b;
  }
  const o = new AbortController(), a = () => o.abort();
  (u = n.signal) != null && u.aborted && o.abort(), (d = (f = n.signal) == null ? void 0 : f.addEventListener) == null || d.call(f, "abort", a, { once: !0 });
  let s;
  try {
    s = await t(r, { signal: o.signal });
  } finally {
    (g = (h = n.signal) == null ? void 0 : h.removeEventListener) == null || g.call(h, "abort", a);
  }
  if (!s.ok) {
    const b = new Error(`读取 PDF 失败 (${s.status})`);
    b.status = s.status;
    const k = await Hc(s);
    throw k && (b.reason = k), b;
  }
  const i = jc(r, s, t);
  if (i) {
    o.abort();
    const b = { ranged: i };
    return io(), De.set(r, b), b;
  }
  (y = (m = n.signal) == null ? void 0 : m.addEventListener) == null || y.call(m, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (w = (v = n.signal) == null ? void 0 : v.removeEventListener) == null || w.call(v, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return De.has(r) ? Gn(r, l) : (io(), De.set(r, l)), l;
}
function jc(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < zc ? null : {
    url: e,
    length: o,
    async fetchRange(i, c) {
      const l = await n(e, { headers: { Range: `bytes=${i}-${c - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const Uc = { file: null, loading: !1, error: "" }, Wc = { file: null, loading: !0, error: "" };
function Kc(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = A(null);
  if (O(() => {
    if (t || !n) return;
    const s = De.get(n);
    if (s) {
      Gn(n, s);
      return;
    }
    const i = new AbortController();
    return vr(n, void 0, { signal: i.signal }).then((c) => {
      i.signal.aborted || o({ url: n, file: c, loading: !1, error: "" });
    }).catch((c) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (c == null ? void 0 : c.message) || String(c) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Uc;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = De.get(n);
  return a ? { file: a, loading: !1, error: "" } : Wc;
}
function Vc(e) {
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
async function Xn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  kn(s, r, n, "download");
  const i = await vr(t, At().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (kn(s, o, n, "download"), i);
}
async function qc(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  kn(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    Xn({
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
    Xn({
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
function Jc(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Gc({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = Ai,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(Jc(o.href, t, a)), !0);
}
const sn = {
  regions: null,
  metadata: null
};
function Xc(e) {
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
    switchSessionMode: h,
    jobRefreshRevision: g,
    sessionEpochRef: m,
    closingRef: y,
    activeLoadAbortRef: v
  } = e, [w, b] = A(""), [k, S] = A(""), [P, R] = A(null), [E, D] = A(null), [x, T] = A(!1), [I, M] = A(""), [$, z] = A([]), [K, j] = A(!1), [J, oe] = A(() => ({
    source: null,
    translated: null
  })), [q, se] = A(
    sn
  ), [Ee, re] = A({
    loading: !0,
    percent: 4,
    text: Ve.boot,
    stage: "progress",
    failed: !1
  });
  return O(() => {
    const ue = new AbortController(), xe = m.current.value, ie = Vc({
      sessionEpochRef: m,
      closingRef: y,
      abort: ue,
      sessionEpoch: xe
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
      }), qn({ percent: 100, text: Z, stage: "failed" });
    }
    function Y() {
      T(!0), B || j(!0), re({
        loading: !1,
        percent: 100,
        text: Ve.ready,
        stage: "ready",
        failed: !1
      }), qn({ percent: 100, text: Ve.ready, stage: "ready" });
    }
    function de() {
      return l != null && l.documentId ? ao(
        l.documentId,
        l.revision
      ) : fc() ? mc : le.resolveResourceUrl(Kn(r));
    }
    async function ne() {
      var H;
      let ee = { activeJobId: "", activeVersionId: "" };
      try {
        const V = await ((H = le.fetchDocument) == null ? void 0 : H.call(le, r));
        V && (ee = _c(V));
      } catch {
      }
      const Z = Lc({
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
        }), h("source")) : h("compare");
        return;
      }
      if (Z.kind === "open-committed-source") {
        if (ie.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: Z.revision,
          sessionIdentity: c
        }), h("source");
        return;
      }
      const fe = de();
      if (ie.isInactive()) return;
      b(fe), S(""), M(""), d(c);
      const N = await Xn({
        url: fe,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: ie,
        setBoot: re
      });
      if (!ie.isInactive()) {
        if (!N) {
          W("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        R(N), Y();
      }
    }
    async function ae() {
      var be;
      const ee = !l, Z = !!(ee && le.loadSessionSnapshot && le.loadReaderOptionalArtifacts), fe = Z ? le.loadReaderOptionalArtifacts(t) : null, N = await ((be = le.loadSessionSnapshot) == null ? void 0 : be.call(le, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: ee && !Z
      })), H = N ? {
        jobPayload: N.sourcePayload,
        manifestPayload: N.manifestPayload,
        readerMetadata: N.readerMetadata,
        regionsPayload: N.regions,
        readerErrors: N.readerErrors
      } : await le.loadReaderPayload(t, {
        includeOptionalArtifacts: ee
      });
      if (ie.isInactive()) return;
      let V = null;
      if (n && !r)
        if (N && N.linkedDocument !== void 0)
          V = N.linkedDocument;
        else {
          try {
            V = await le.fetchDocumentByJobId(ro, t);
          } catch {
          }
          if (ie.isInactive()) return;
        }
      const me = Rc(H.jobPayload) || `${(V == null ? void 0 : V.document_id) || ""}`.trim();
      me && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: me
      });
      const ye = Cc({
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
        }), h("source");
        return;
      }
      const Te = le.resolveReaderSourcePdf(H.manifestPayload), Ae = le.resolveReaderTranslatedPdfUrl(H.jobPayload, H.manifestPayload), ze = typeof Te == "string" ? Te : le.resolveReaderArtifactUrl(Te), He = r || me, Qe = l != null && l.documentId ? ao(
        l.documentId,
        l.revision
      ) : ze || (He ? le.resolveResourceUrl(Kn(He)) : ""), $e = l ? "" : Ae || "";
      b(Qe || ""), S($e), M(Mc(H.jobPayload, t)), f({
        jobPayload: H.jobPayload || null,
        manifestPayload: H.manifestPayload || null,
        sessionIdentity: c
      });
      const Ke = () => qc({
        sourceFinal: Qe || "",
        translatedFinal: $e,
        fence: ie,
        setBoot: re
      }), et = !!(Qe || $e), tt = fe && et ? Ke() : null;
      tt == null || tt.catch(() => {
      });
      const St = (F) => {
        ie.isInactive() || (z(l ? [] : La(F.regionsPayload)), oe(l ? { source: null, translated: null } : Ri(F.readerMetadata)), se(l ? sn : F.readerErrors ?? sn), j(!0));
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
        R(nt.sourceBytes), D(nt.translatedBytes), Y();
      }
    }
    async function ke() {
      T(!1), R(null), D(null), z([]), j(!1), oe({ source: null, translated: null }), se(sn), kn(re, 8, Ve.metadata, "metadata");
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
        const Z = Number(ee == null ? void 0 : ee.status), fe = `${(ee == null ? void 0 : ee.reason) || ""}`, N = Oc({ status: Z, reason: fe, sessionJobId: t });
        if (N && (await Gc({
          apiPrefix: ro,
          documentId: N,
          expiredJobId: t
        }) || ie.isClosedOrStale()))
          return;
        if ($c({
          status: Z,
          reason: fe,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), h("source");
          return;
        }
        const H = ee instanceof Error ? ee.message : Ve.failed;
        W(H, H);
      }
    }
    return ke(), () => {
      ue.abort(), v.current === ue && (v.current = null);
    };
  }, [t, r, o, a, s, i, l, g, n, c, u, f, d, h]), {
    sourceUrl: w,
    translatedUrl: k,
    sourceFile: P,
    translatedFile: E,
    assetsReady: x,
    title: I,
    regions: $,
    regionsSettled: K,
    readerMetadata: J,
    readerErrors: q,
    boot: Ee
  };
}
function Yc() {
  const e = _(!1), t = _(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = Ic(), s = _({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = _(a), c = _(""), l = _(""), u = _(() => {
  }), f = L(() => u.current(), []), d = Ec({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: i,
    documentIdRef: c,
    sessionJobIdRef: l,
    switchToSourceMode: f
  }), {
    sessionJobId: h,
    documentId: g,
    sourceOnly: m,
    sourceViewOnly: y
  } = d, { mode: v, setMode: w, switchSessionMode: b } = Ac(y);
  u.current = () => {
    b("source");
  }, i.current = a, c.current = g, l.current = h;
  const k = xc({
    sessionJobId: h,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: S,
    scopedManifestPayload: P,
    jobStatus: R,
    jobTerminal: E,
    jobRefreshRevision: D,
    refreshJobArtifacts: x,
    refreshJobStatus: T
  } = k, I = Xc({
    sessionJobId: h,
    jobId: r,
    routeDocumentId: o,
    documentJobId: d.documentJobId,
    rejectedDocumentJobId: d.rejectedDocumentJobId,
    sourceOnly: m,
    locationKey: n,
    sessionIdentity: a,
    committedSource: d.activeCommittedDocumentSource,
    applyIdentityEvent: d.applyIdentityEvent,
    publishPayload: k.publishPayload,
    clearPayload: k.clearPayload,
    switchSessionMode: b,
    jobRefreshRevision: D,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), M = L(() => {
    var z;
    e.current = !0, (z = t.current) == null || z.abort();
  }, []), $ = U(
    () => ({
      fetchProtected: Ze().fetchProtected,
      jobId: h,
      jobPayload: S,
      manifestPayload: P,
      sourceUrl: I.sourceUrl,
      translatedUrl: I.translatedUrl,
      sourceOnly: y
    }),
    [h, S, P, I.sourceUrl, I.translatedUrl, y]
  );
  return {
    jobId: h,
    jobStatus: R,
    workflow: `${(S == null ? void 0 : S.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: E,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: m,
    mode: v,
    setMode: w,
    sourceUrl: I.sourceUrl,
    translatedUrl: I.translatedUrl,
    sourceFile: I.sourceFile,
    translatedFile: I.translatedFile,
    assetsReady: I.assetsReady,
    boot: I.boot,
    title: I.title,
    regions: I.regions,
    regionsSettled: I.regionsSettled,
    readerMetadata: I.readerMetadata,
    readerErrors: I.readerErrors,
    download: $,
    refreshJobArtifacts: x,
    refreshJobStatus: T,
    refreshCommittedDocument: d.refreshCommittedDocument,
    prepareClose: M
  };
}
const Zc = 160, Qc = 8, el = 0;
function tl() {
  const e = _(null), [t, n] = A(null), [r, o] = A(el), a = L((s) => {
    e.current = s, n(s);
  }, []);
  return O(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (l) => {
      !Number.isFinite(l) || l < Zc || o((u) => Math.abs(u - l) < Qc ? u : l);
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
function nl(e) {
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
const Cn = { source: 0, translated: 0 };
function rl(e, t) {
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
  const [f, d] = A(() => ({
    identity: l,
    pages: Cn
  })), [h, g] = A(() => ({ identity: l, tick: 0 })), m = f.identity === l ? f.pages : Cn, y = h.identity === l ? h.tick : 0, v = nl({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: w } = v, b = L((T, I) => {
    u.current === l && d((M) => {
      const $ = M.identity === l ? M.pages : Cn;
      return $[I] === T && M.identity === l ? M : {
        identity: l,
        pages: { ...$, [I]: T }
      };
    });
  }, [l]), k = _(null), S = L(() => {
    k.current && clearTimeout(k.current);
    const T = l;
    k.current = setTimeout(() => {
      k.current = null, u.current === T && g((I) => ({
        identity: T,
        tick: I.identity === T ? I.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  O(() => (k.current && (clearTimeout(k.current), k.current = null), d((T) => T.identity === l && T.pages.source === 0 && T.pages.translated === 0 ? T : { identity: l, pages: { source: 0, translated: 0 } }), g((T) => T.identity === l && T.tick === 0 ? T : { identity: l, tick: 0 }), () => {
    k.current && (clearTimeout(k.current), k.current = null);
  }), [l]);
  const P = U(
    () => Math.max(m.source, m.translated),
    [m]
  ), R = w === "translated" ? m.translated : m.source || m.translated, E = t == null ? void 0 : t.userZoom, D = t == null ? void 0 : t.shellWidth, x = `${l}-${y}-${E}-${n}-${m.source}-${m.translated}-${D}`;
  return {
    ...v,
    numPagesByPane: m,
    hudNumPages: P,
    primaryNumPages: R,
    metricsTick: y,
    onNumPages: b,
    onMetrics: S,
    rowSyncRevision: x
  };
}
const Ie = "data-reader-page", Se = "data-reader-pane", wr = "data-natural-height", qa = "reader-react-root", Ja = "reader-react-grid", Ga = "reader-react-scroll-shell", rn = "reader-react-pdf-pane", Xa = "reader-react-pdf-page", Tn = "reader-react-pdf-page-placeholder", Sr = "reader-react-pdf-page-slot";
function In(e, t) {
  const n = e != null ? `[${Ie}="${e}"]` : `[${Ie}]`;
  return t ? `${n}[${Se}="${t}"]` : n;
}
function kr() {
  return `.${Sr}[${Ie}]`;
}
function En(e) {
  return Number(e.getAttribute(Ie));
}
const Ya = 0.25, Rn = 1, ol = 0.05, on = 0.5, al = 16, sl = 8, Za = al + sl, il = 720;
function Pt() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function Qa(e) {
  return Number.isFinite(e) && e < il;
}
function Et(e, t = Number.POSITIVE_INFINITY) {
  return Qa(t) && (e === "source" || e === "translated") ? Rn : on;
}
function Xe(e) {
  return Number.isFinite(e) ? Math.min(Rn, Math.max(Ya, e)) : on;
}
function Yt(e, t) {
  const n = Xe(Number(e) + t * ol);
  return Math.round(n * 100) / 100;
}
function cl(e) {
  return Math.round(Xe(e) * 100);
}
function es(e) {
  const n = (Number(e) || 0) - Za;
  return Math.max(160, Math.floor(n));
}
function ll(e, t = on) {
  const n = Xe(t);
  return es((Number(e) || 0) * n);
}
function ul(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${Se}]`)
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
const dl = 8;
function fl(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < dl ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const ts = 200, ml = [
  "markdown"
], hl = ml;
function ns(e) {
  return hl.includes(e);
}
const pl = "retainpdf:reader:view:v1:", co = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), gl = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function rs() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Yn(e) {
  return `${e || ""}`.trim();
}
function yl({
  documentId: e,
  jobId: t
}) {
  const n = Yn(e);
  if (n) return `document:${n}`;
  const r = Yn(t);
  return r ? `job:${r}` : "";
}
function os(e) {
  const t = Yn(e);
  return t ? `${pl}${t}` : "";
}
function bl(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function vl(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!co.has(t) || !co.has(n) || t === n))
    return { left: t, right: n };
}
function wl(e) {
  return e === null ? null : ns(e) ? e : void 0;
}
function Sl(e) {
  return gl.has(e) ? e : void 0;
}
function as(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = bl(t.anchor), r = Number(t.zoom), o = Sl(t.mode), a = vl(t.splitLayout), s = wl(t.assistantPanel);
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
function We(e, t = rs()) {
  const n = os(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? as(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function Nn(e, t, n = rs()) {
  const r = os(e);
  if (!r || !n) return null;
  const o = We(e, n), a = as({
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
function kl(e, t, n = "") {
  var d;
  const [r, o] = A(() => {
    var h;
    return ((h = We(n)) == null ? void 0 : h.zoom) ?? Et(e, Pt());
  }), a = _(r), s = _(n);
  a.current = r;
  const i = _(1), c = _(((d = We(n)) == null ? void 0 : d.zoom) !== void 0);
  O(() => {
    var m;
    if (s.current === n) return;
    s.current = n;
    const h = (m = We(n)) == null ? void 0 : m.zoom;
    c.current = h !== void 0;
    const g = h ?? Et(e, Pt());
    i.current = 1, a.current = g, o(g);
  }, [e, n]), O(() => {
    if (c.current) return;
    const h = Et(e, Pt()), g = a.current;
    Math.abs(h - g) < 5e-4 || (i.current = 1, a.current = h, o(h));
  }, [e]);
  const l = L((h, g) => {
    const m = Xe(h), y = a.current;
    Math.abs(m - y) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : m / (y || 1), a.current = m, c.current = !0, Nn(s.current, { zoom: m }), o(m));
  }, []), u = L((h) => {
    l(Yt(a.current, h));
  }, [l]), f = L((h) => {
    l(Et(h));
  }, [l]);
  return Le(() => {
    const h = i.current;
    Math.abs(h - 1) < 1e-3 || (i.current = 1, ul(t == null ? void 0 : t.current, h));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: f };
}
const Tl = 160, Il = 3e-3, lo = 50, El = 16, Rl = 800;
function Pl(e, t = 0) {
  const n = t === 1 ? El : t === 2 ? Rl : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-lo, Math.min(lo, r));
  return Math.exp(-o * Il);
}
function Ml(e, t, n = 0) {
  return Xe(e * Pl(t, n));
}
function xl(e) {
  return Math.round(Xe(e) * 100) / 100;
}
function Nl(e, t, n) {
  const r = Xe(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return Xe(t) / r;
  const a = (o + Za) / r;
  return es(a * Xe(t)) / o;
}
function Al(e) {
  return Array.from(e.querySelectorAll(kr()));
}
function _l(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function Ll(e, t, n) {
  let r = null;
  for (const s of Al(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const c = _l(i, t, n);
    if ((!r || c < r.distance) && (r = { el: s, rect: i, distance: c }), c === 0) break;
  }
  if (!r) return null;
  const { el: o, rect: a } = r;
  return {
    page: o.getAttribute(Ie) || "",
    pane: o.getAttribute(Se) || "",
    fracX: (t - a.left) / a.width,
    fracY: (n - a.top) / a.height,
    clientX: t,
    clientY: n,
    pageWidth: a.width
  };
}
function Cl(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function ss(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${kr()}[${Ie}="${t.page}"][${Se}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (Cl(n, e).scrollLeft += a);
}
function $l(e, t, n, r) {
  const o = e.querySelector(`.${Ja}`);
  if (!o) return null;
  if (!o.style.transformOrigin) {
    const a = o.getBoundingClientRect();
    o.style.transformOrigin = `${n - a.left}px ${r - a.top}px`, o.style.willChange = "transform";
  }
  return o.style.transform = `scale(${t})`, o;
}
function Ot(e) {
  e && (e.style.transform = "", e.style.transformOrigin = "", e.style.willChange = "");
}
const Dl = 600, Ol = 1e3;
function zl(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || ss(e, t);
  });
  a.observe(n);
  const s = (u) => {
    u.type === "wheel" && u.ctrlKey || l();
  }, i = ["wheel", "keydown", "pointerdown", "touchstart"];
  for (const u of i) r.addEventListener(u, s, { capture: !0, passive: !0 });
  const c = r.setTimeout(() => l(), Ol);
  function l() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(c);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return l;
}
function Fl(e, t, n) {
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
      const f = xl(u.target);
      if (Math.abs(f - r.current) < 5e-3) {
        Ot(u.grid);
        return;
      }
      const d = { anchor: u.anchor, grid: u.grid, fallback: null };
      d.fallback = setTimeout(() => {
        s.current === d && (s.current = null, Ot(d.grid));
      }, Dl), s.current = d, o.current(f, { keepScroll: !1 });
    }, l = (u) => {
      var h, g;
      if (!u.ctrlKey) return;
      u.preventDefault();
      let f = a.current;
      if (!f) {
        (h = i.current) == null || h.call(i), i.current = null;
        const m = s.current;
        m && (m.fallback && clearTimeout(m.fallback), s.current = null, Ot(m.grid)), f = {
          start: r.current,
          target: r.current,
          anchor: Ll(e, u.clientX, u.clientY),
          grid: null,
          timer: null
        }, a.current = f;
      }
      f.target = Ml(f.target, u.deltaY, u.deltaMode);
      const d = Nl(f.start, f.target, ((g = f.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      f.grid = $l(e, d, u.clientX, u.clientY) ?? f.grid, f.timer && clearTimeout(f.timer), f.timer = setTimeout(c, Tl);
    };
    return e.addEventListener("wheel", l, { passive: !1 }), () => {
      var f;
      e.removeEventListener("wheel", l);
      const u = a.current;
      a.current = null, u != null && u.timer && clearTimeout(u.timer), Ot((u == null ? void 0 : u.grid) ?? null), (f = i.current) == null || f.call(i), i.current = null;
    };
  }, [e]), Le(() => {
    var l;
    const c = s.current;
    c && (s.current = null, c.fallback && clearTimeout(c.fallback), Ot(c.grid), !(!e || !c.anchor) && (ss(e, c.anchor), (l = i.current) == null || l.call(i), i.current = zl(e, c.anchor)));
  }, [t, e]);
}
function Bl(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = _(t), a = _(n), s = _(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: L((c) => {
    c !== o.current && (s.current(), a.current(c));
  }, []) };
}
const Tr = 56;
function is(e, t = Tr) {
  return e.getBoundingClientRect().top + t;
}
function cs(e, t) {
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
  const o = En(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function qt(e, t, n = Tr) {
  if (!e)
    return null;
  const r = In(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = is(e, n), i = cs(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function _t(e, t, n = "auto", r, o = Tr) {
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
function Hl(e, t, n = "smooth", r) {
  return _t(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function Zn(e, t, n) {
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
function jl(e, t, n) {
  return Zn(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function Pn(e, t) {
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
function Ul(e, t, n = !0, r = "", o) {
  const [a, s] = A(1);
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
      const m = Array.from(i.querySelectorAll(f));
      if (!m.length)
        return;
      const y = is(i), v = cs(m, y);
      v && s(v.page);
    }, h = () => {
      c || (u && cancelAnimationFrame(u), u = requestAnimationFrame(() => {
        u = 0, d();
      }));
    }, g = () => {
      if (c) return;
      if (!Array.from(i.querySelectorAll(f)).length) {
        l = setTimeout(g, 120);
        return;
      }
      d(), i.addEventListener("scroll", h, { passive: !0 });
    };
    return g(), () => {
      c = !0, l && clearTimeout(l), u && cancelAnimationFrame(u), i.removeEventListener("scroll", h);
    };
  }, [e, t, n, r, o]), a;
}
const Wl = `canvas, .react-pdf__Page, .${Xa}, .${Tn}`, uo = /* @__PURE__ */ new WeakMap();
function Kl(e) {
  const t = Number(e.getAttribute(wr));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = uo.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(Wl), uo.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Vl(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function ql(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(kr()).forEach((r) => {
    const o = En(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = Kl(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Jl(e, t, n = "", r) {
  const [o, a] = A(() => /* @__PURE__ */ new Map()), s = _(o), i = _(r);
  return i.current = r, Le(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let c = !1, l = 0, u = !1, f = !1;
    const d = () => {
      var S;
      if (c) return;
      const b = e.current;
      if (!b) return;
      const k = ql(b);
      Vl(s.current, k) || (s.current = k, a(k)), u && !f && (f = !0, (S = i.current) == null || S.call(i));
    }, h = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(d);
      });
    };
    h();
    const g = window.setTimeout(h, 100), m = window.setTimeout(() => {
      u = !0, h();
    }, 300), y = window.setTimeout(h, 700), v = e.current;
    let w = null;
    return v && typeof ResizeObserver < "u" && (w = new ResizeObserver(() => h()), w.observe(v)), () => {
      c = !0, cancelAnimationFrame(l), window.clearTimeout(g), window.clearTimeout(m), window.clearTimeout(y), w == null || w.disconnect();
    };
  }, [e, t, n]), o;
}
const Gl = [0, 48, 140, 320, 560], Xl = 700, Yl = [80, 200, 400], Zl = 500, Ql = 50, eu = /* @__PURE__ */ new Set([
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
]), tu = 180, fo = [0, 48, 140, 320, 700, 1200];
function nu(e, t) {
  var I;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = _(
    ((I = We(a)) == null ? void 0 : I.anchor) || { page: 1, fraction: 0 }
  ), c = _(null), l = _(!1), u = _(r), f = _(null), d = _(null), h = _(null), g = _(null), m = _(a), y = _(""), v = _(n);
  v.current = n;
  const w = L(() => {
    var M;
    (M = f.current) == null || M.call(f), f.current = null, d.current != null && (clearTimeout(d.current), d.current = null);
  }, []), b = L(() => {
    !l.current && c.current == null || (w(), h.current != null && (clearTimeout(h.current), h.current = null), c.current = null, l.current = !1);
  }, [w]), k = L((M = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const $ = () => {
      g.current = null, Nn(m.current, {
        anchor: Fe(i.current)
      });
    };
    M ? $() : g.current = setTimeout($, tu);
  }, []), S = L((M) => {
    i.current = Fe(M), c.current = null, h.current != null && clearTimeout(h.current), h.current = setTimeout(() => {
      h.current = null, l.current = !1;
    }, Ql);
  }, []);
  O(() => {
    if (!o)
      return;
    let M = !1, $ = null, z = null, K = null;
    const j = () => {
      if (M) return;
      const J = e.current;
      if (!J) {
        K = setTimeout(j, 50);
        return;
      }
      $ = J, z = () => {
        if (l.current)
          return;
        const oe = qt($, v.current);
        oe && (i.current = oe, k());
      }, $.addEventListener("scroll", z, { passive: !0 }), l.current || z();
    };
    return j(), () => {
      M = !0, K != null && clearTimeout(K), $ && z && $.removeEventListener("scroll", z);
    };
  }, [o, r, n, e, k]), O(() => {
    if (!o) return;
    const M = e.current;
    if (!M) return;
    const $ = (z) => {
      z.metaKey || z.ctrlKey || z.altKey || eu.has(z.key) && b();
    };
    return M.addEventListener("wheel", b, { passive: !0 }), M.addEventListener("touchmove", b, { passive: !0 }), window.addEventListener("keydown", $), () => {
      M.removeEventListener("wheel", b), M.removeEventListener("touchmove", b), window.removeEventListener("keydown", $);
    };
  }, [o, e, b]), Le(() => {
    var $;
    if (m.current === a) return;
    k(!0), w(), h.current != null && (clearTimeout(h.current), h.current = null), m.current = a, y.current = "";
    const M = ($ = We(a)) == null ? void 0 : $.anchor;
    i.current = M ? Fe(M) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, u.current = r;
  }, [a, r, k, w]), O(() => {
    var $;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const M = Fe(
      (($ = We(a)) == null ? void 0 : $.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = M, c.current = M, l.current = !0, w(), f.current = Zn(
      () => e.current,
      M,
      {
        behavior: "auto",
        pane: v.current,
        delaysMs: fo,
        onDone: () => S(M)
      }
    ), d.current = setTimeout(() => {
      d.current = null, S(M);
    }, Math.max(...fo) + 160), () => w();
  }, [o, s, a, e, S, w]), O(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, c.current = null, w();
      return;
    }
    const M = c.current ? Fe(c.current) : Fe(i.current);
    return l.current = !0, c.current = M, i.current = M, w(), f.current = Zn(
      () => e.current,
      M,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Gl,
        onDone: () => S(M)
      }
    ), d.current = setTimeout(() => {
      d.current = null, S(M);
    }, Xl), () => {
      w();
    };
  }, [r, o, n, e, S, w]), O(() => () => {
    w(), h.current != null && (clearTimeout(h.current), h.current = null), k(!0);
  }, [w, k]);
  const P = L(() => {
    const M = qt(
      e.current,
      v.current
    );
    return Fe(M || i.current);
  }, [e]), R = L(() => {
    l.current = !0;
    const M = qt(
      e.current,
      v.current
    ), $ = Fe(M ?? i.current);
    return i.current = $, c.current = $, k(), $;
  }, [e, k]), E = L((M, $, z) => {
    const K = z || v.current, j = Pn(M, $ || 1), J = { page: j, fraction: 0 };
    i.current = J, l.current = !0, c.current = J, k(), w(), Hl(e.current, j, "smooth", K), f.current = jl(
      () => e.current,
      j,
      {
        behavior: "auto",
        pane: K,
        delaysMs: Yl,
        onDone: () => S(J)
      }
    ), d.current = setTimeout(() => {
      d.current = null, S(J);
    }, Zl);
  }, [e, S, w, k]), D = L(() => Fe(i.current), []), x = L(() => l.current, []), T = L(() => {
    if (!l.current || !c.current)
      return;
    const M = Fe(c.current);
    _t(
      e.current,
      M,
      "auto",
      v.current
    );
  }, [e]);
  return {
    lockFromShell: P,
    beginModeSwitch: R,
    goToPage: E,
    getAnchor: D,
    isRestoring: x,
    repinIfRestoring: T
  };
}
function ru(e, t) {
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
function ls(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const ou = [0, 80, 200, 400, 800], au = 120, su = 400;
function iu(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: c, documentId: l, regionsSettled: u = !0 } = e, f = _(a);
  f.current = a;
  const d = _(s);
  d.current = s;
  const h = _(i);
  h.current = i;
  const g = _(n);
  g.current = n, O(() => {
    var k, S;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const m = gc(), y = ru(m, d.current);
    if (y == null && (m != null && m.blockId) && !u) return;
    const v = ls(m, y, { jobId: c, documentId: l });
    if (t.current === v)
      return;
    if (y == null) {
      t.current = v, (k = g.current) == null || k.call(g);
      return;
    }
    t.current = v, m && ((S = h.current) == null || S.call(h, m, y));
    const w = [];
    let b = 0;
    for (const P of ou)
      b = Math.max(b, P), w.push(
        setTimeout(() => {
          f.current(y);
        }, P)
      );
    return w.push(
      setTimeout(() => {
        var P;
        (P = g.current) == null || P.call(g);
      }, b + au)
    ), () => {
      for (const P of w) clearTimeout(P);
    };
  }, [r, o, c, l, t, u]);
}
function cu(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function lu(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = su,
    jobId: i,
    documentId: c,
    applyReaderSearch: l
  } = e, u = _(a);
  u.current = a;
  const f = _(l);
  f.current = l;
  const d = _(0);
  O(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || d.current === o) return;
    const h = setTimeout(() => {
      var v;
      const g = ((v = globalThis.location) == null ? void 0 : v.search) || "", m = Ei(g, o, u.current);
      if (d.current = o, m === null) return;
      const y = `${new URLSearchParams(m).get("block_id") || ""}`.trim();
      t.current = ls(
        { blockId: y },
        o,
        { jobId: i, documentId: c }
      ), (f.current || cu)(m);
    }, s);
    return () => clearTimeout(h);
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
function uu(e) {
  const t = _(""), [n, r] = A(!1), o = L(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  iu(a, t, o), lu(e, t, n);
}
const zt = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function du(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function mo(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function us(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = mo(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = mo(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function fu(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = us(r, t, n);
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
function mu(e) {
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
function hu(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function pu(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function gu(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function yu(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const ho = [250, 500, 1e3, 2e3, 4e3], $n = [80, 160, 320, 640, 1e3, 1500], po = [250, 500, 1e3, 2e3, 4e3, 5e3];
function Qn(e, t) {
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
function Ir(e) {
  return _i(e) ? `${e.code || ""}`.trim() : "";
}
function cn(e, t) {
  const n = Ir(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function bu(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (us(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
        return c;
      a = Li(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (c) {
      if ((c == null ? void 0 : c.name) === "AbortError") throw c;
      a = c;
      const l = Ir(c);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw c;
    }
    const i = $n[Math.min(s, $n.length - 1)];
    if (await Qn(i, r), s >= $n.length + 2) throw a;
  }
}
function vu({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = A(zt), s = _(o), i = _("");
  s.current = o;
  const c = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = Xt(l) ? l : "";
  return O(() => {
    if (!n || !c) {
      i.current = "", s.current = zt, a(zt);
      return;
    }
    const f = r === void 0 ? pc() : r, d = i.current === c;
    if (i.current = c, !f) {
      const b = {
        ...d ? s.current : zt,
        connection: u ? "terminal" : "unavailable",
        jobStatus: l,
        error: "实时译文暂不可用"
      };
      s.current = b, a(b);
      return;
    }
    const h = new AbortController();
    let g = !1;
    const m = {
      ...d ? s.current : zt,
      connection: u ? "terminal" : "connecting",
      jobStatus: l,
      error: ""
    };
    s.current = m, a(m);
    const y = (b) => {
      h.signal.aborted || a((k) => {
        const S = b(k);
        return s.current = S, S;
      });
    }, v = async () => {
      let b = 0;
      for (; !h.signal.aborted; )
        try {
          const k = await f.fetchLayout(c, { signal: h.signal });
          g = !0, y((S) => ({
            ...S,
            layoutByPage: du(k),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (k) {
          if ((k == null ? void 0 : k.name) === "AbortError") return;
          const S = Ir(k);
          if (!(S === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !S)) {
            y((R) => ({
              ...R,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: cn(k, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            y((R) => ({
              ...R,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          y((R) => ({
            ...R,
            connection: "connecting",
            jobStatus: l,
            error: cn(k, "正在等待 OCR 版面数据")
          })), await Qn(ho[Math.min(b, ho.length - 1)], h.signal).catch(() => {
          }), b += 1;
        }
    };
    return (async () => {
      if (await v(), !g || h.signal.aborted) return;
      let b = 0;
      for (; !h.signal.aborted; ) {
        u || y((k) => ({
          ...k,
          connection: k.lastSeq > 0 ? "reconnecting" : "connecting",
          jobStatus: l,
          // 保留已有错误：首页还没提交（lastSeq 为 0）时恰恰是最容易出错的阶段，
          // 此前这里把它清成空串，UI 于是一直显示「连接中」，用户看到的是
          // "正在努力"，实际可能已经在反复失败。
          error: k.error
        }));
        try {
          await f.streamEvents(c, {
            afterSeq: s.current.lastSeq,
            signal: h.signal,
            onEvent: async (k) => {
              if (k.seq <= s.current.lastSeq) return;
              let S;
              try {
                S = await bu(
                  c,
                  k,
                  s.current,
                  h.signal,
                  f
                );
              } catch (P) {
                if ((P == null ? void 0 : P.name) === "AbortError" || h.signal.aborted) throw P;
                y((R) => ({
                  ...R,
                  lastSeq: Math.max(R.lastSeq, k.seq),
                  error: cn(P, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((P) => {
                const R = fu(P, k, S);
                return u ? {
                  ...R,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...R,
                  jobStatus: l
                };
              }), b = 0;
            }
          });
        } catch (k) {
          if ((k == null ? void 0 : k.name) === "AbortError" || h.signal.aborted) return;
          y((S) => ({
            ...S,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: l,
            error: cn(k, "实时译文连接已中断，正在重连")
          }));
        }
        if (h.signal.aborted) return;
        if (u) {
          y((k) => ({
            ...k,
            connection: "terminal",
            jobStatus: l
          }));
          return;
        }
        await Qn(po[Math.min(b, po.length - 1)], h.signal).catch(() => {
        }), b += 1;
      }
    })(), () => h.abort();
  }, [n, r, c, u]), o;
}
function wu(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), c = Number(s.count) || 0;
    i && c > 0 && o.set(i, c);
  }
  return o;
}
function Su(e, t = !0) {
  const [n, r] = A(() => /* @__PURE__ */ new Map());
  return O(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = Ze().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(wu(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const ku = 4500;
function Tu(e) {
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
const Iu = /* @__PURE__ */ new Set(["book", "translate"]);
function ds(e) {
  return !!(e.jobId && e.sourceUrl && Iu.has(e.workflow));
}
function Eu(e) {
  return !!(ds(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function Ru() {
  const e = Yc(), t = ds({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = Eu({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = _({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Xt(o) && (r.current.running = !0);
  const a = vu({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = tl(), u = Su(e.jobId, !e.sourceOnly), f = yl({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: h, onZoomChange: g } = kl(e.mode, s, f);
  Fl(i, h, g);
  const m = rl(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: h, shellWidth: c, identityKey: d }
  ), {
    beginModeSwitch: y,
    goToPage: v,
    repinIfRestoring: w
  } = nu(s, {
    primaryPane: m.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: m.primaryNumPages > 0
  });
  O(() => {
    w();
  }, [c, w]);
  const b = Jl(
    s,
    m.compareMode,
    m.rowSyncRevision,
    w
  ), k = Ul(
    s,
    m.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${h}-${m.metricsTick}`,
    m.primaryPane
  ), S = L((j, J) => {
    var q, se;
    const oe = Math.max(
      Number(m.hudNumPages) || 0,
      Number(m.primaryNumPages) || 0,
      Number((q = m.numPagesByPane) == null ? void 0 : q.source) || 0,
      Number((se = m.numPagesByPane) == null ? void 0 : se.translated) || 0
    );
    v(j, oe, J);
  }, [v, m.hudNumPages, m.primaryNumPages, m.numPagesByPane]), [P, R] = A(null), E = _(null), D = L((j) => {
    E.current && clearTimeout(E.current), R(j), j && (E.current = setTimeout(() => R(null), ku));
  }, []);
  O(() => () => {
    E.current && clearTimeout(E.current);
  }, []);
  const x = L((j) => {
    const J = Ln(e.regions, j);
    return J ? eo(J, m.primaryPane).page : null;
  }, [e.regions, m.primaryPane]), T = L((j, J) => {
    const oe = J || m.primaryPane, q = typeof j == "object" && j ? `${j.block_id || ""}`.trim() : "", se = typeof j == "object" && j ? `${j.image_url || ""}`.trim() : "", Ee = typeof j == "object" && j ? j.page_idx != null ? Number(j.page_idx) + 1 : j.page != null ? Number(j.page) : null : typeof j == "number" ? j + 1 : null, re = Pi(e.regions, se, Ee) || Ln(e.regions, q) || (typeof j == "object" ? Mi(e.regions, j) : null);
    let ue = re ? eo(re, oe).page : null;
    ue == null && (ue = Tu(j)), !(ue == null || ue < 1) && (D(re), S(ue, oe));
  }, [D, S, m.primaryPane, e.regions]);
  uu({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: m.hudNumPages || 0,
    currentPage: k,
    goToPage: S,
    resolveBlockPage: x,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (j) => {
      D(Ln(e.regions, j.blockId));
    }
  });
  const { setModeKeepingPage: I } = Bl({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: y
  });
  O(() => {
    D(null);
  }, [d, D]);
  const M = !e.boot.loading && !e.boot.failed, $ = U(() => ({ bindShell: l, shellEl: i, shellWidth: c, shellRef: s }), [l, i, c, s]), z = U(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), K = U(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: h,
    onZoomChange: g,
    shell: $,
    panes: m,
    sessionFiles: z,
    rowHeights: b,
    goToPage: S,
    activeRegion: P,
    jumpToAnchor: T,
    setModeKeepingPage: I,
    download: e.download,
    showHud: M,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, $, m, z, b, S, P, T, I, M, h, g, f, a, n, u]);
  return U(() => ({
    ...K,
    currentPage: k
  }), [K, k]);
}
const Pu = [
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
], Mu = [
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
function xu(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of Pu)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Nu(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const Au = ".reader-notes-panel";
function _u(e) {
  return e instanceof Element ? !!e.closest(Au) : !1;
}
function Lu(e) {
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
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || Nu(d.target) || _u(d.target))
        return;
      const h = d.key, g = xu(h);
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
              c(Pn(s + 1, i));
              return;
            case "prev-page":
              c(Pn(s - 1, i));
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
const Me = { size: 16, strokeWidth: 1.75 }, go = { size: 12, strokeWidth: 1.75 }, Cu = "retainpdf:soft-reader-close";
function $u() {
  return new URL("./index.html", window.location.href).href;
}
function Du() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Cu },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Ou(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function zu() {
  if (!(typeof window > "u") && !Du()) {
    if (Ou(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign($u());
  }
}
function Fu({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function Bu({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ C(Fu, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), zu();
  }, children: [
    /* @__PURE__ */ p(Ca, { className: "reader-close-home-icon", ...Me, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "返回" })
  ] });
}
const Hu = 3e3, ju = 8;
async function Uu(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function Wu(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function Ku(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = Hu;
  const r = [], o = (s, i, c) => {
    const l = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const f = s[u], d = Wu(f == null ? void 0 : f.title);
      if (!d) continue;
      n -= 1;
      const h = c ? `${c}.${u}` : `${u}`, g = { id: h, title: d, page: null, level: i, children: [] };
      r.push({ node: g, dest: f.dest }), l.push(g), i < ju && Array.isArray(f.items) && f.items.length && (g.children = o(f.items, i + 1, h));
    }
    return l;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await Uu(e, i);
  })), a;
}
function fs(e) {
  const t = [], n = (r) => {
    for (const o of r)
      t.push(o), n(o.children);
  };
  return n(e), t;
}
function Vu(e, t) {
  let n = null;
  for (const r of fs(e))
    r.page === null || r.page > t || (!n || r.page > (n.page ?? 0) || r.page === n.page && r.id.startsWith(`${n.id}.`)) && (n = r);
  return (n == null ? void 0 : n.id) ?? null;
}
let yo = !1;
function ms() {
  if (yo)
    return;
  const e = At().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (Sn.GlobalWorkerOptions.workerSrc = e, yo = !0);
}
const st = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), qu = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Ju = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Gu = {
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
}, bo = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function Xu(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => bo(o ?? a ?? "", qu)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => bo(o ?? a ?? "", Ju)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Gu[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Yu(e) {
  return st(e.translatedBlockText) || st(e.translated.text) || st(e.source.text);
}
const Zu = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Qu(e) {
  const t = [];
  for (const n of e) {
    if (!Zu(n)) continue;
    const r = Xu(Yu(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
const ed = 24, td = 60;
function vo(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - ed), o = Math.min(e.length, n + t.length + td), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function nd(e, t, n = 200) {
  const r = st(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = st(a.translatedBlockText) || st(a.translated.text), c = i ? vo(i, r) : null, l = c ?? vo(st(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: c ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
function ln(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function Ut(e, t) {
  const n = st(t).toLowerCase();
  if (!n || !e) return ln(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${ln(e.slice(a, s))}<mark class="reader-find-mark">${ln(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + ln(e.slice(a));
}
function rd(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const od = /^data-[a-z0-9-]+$/;
function wo(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function ad(e, t, n = "") {
  if (!t.length) return Ut(e, n);
  const r = t.filter((s) => s.end > s.start && s.start >= 0 && s.end <= e.length).map((s, i) => ({ mark: s, order: i })).sort((s, i) => s.mark.start - i.mark.start || s.order - i.order).map(({ mark: s }) => s);
  let o = "", a = 0;
  for (const s of r) {
    if (s.start < a) continue;
    o += Ut(e.slice(a, s.start), n);
    const i = Object.entries(s.attrs ?? {}).filter(([c]) => od.test(c)).map(([c, l]) => ` ${c}="${wo(l)}"`).join("");
    o += `<mark class="${wo(s.className)}"${i}>${Ut(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  }
  return o + Ut(e.slice(a), n);
}
function ve(e) {
  return typeof e == "string" ? e : "";
}
function sd(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function id(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function cd(e) {
  return {
    source: ve(e == null ? void 0 : e.source_text) || ve(e == null ? void 0 : e.unit_source_text),
    translated: ve(e == null ? void 0 : e.protected_translated_text) || ve(e == null ? void 0 : e.translated_text)
  };
}
const ld = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function hs(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function ud(e) {
  const t = hs(e).sort((r, o) => ve(r.ts).localeCompare(ve(o.ts)));
  return t.length ? [
    { text: ve(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: ve(r.new_text),
      label: ld[ve(r.source)] || ve(r.source) || "修订",
      ts: ve(r.ts),
      reason: ve(r.reason)
    }))
  ].reverse() : [];
}
function dd(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function fd(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return ve(r.finished_at) || ve(n.finished_at) || "";
}
function md(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = hs(e).sort((a, s) => ve(a.ts).localeCompare(ve(s.ts)));
  for (const a of o) {
    const s = new Date(ve(a.ts)).getTime(), i = ve(a.reader_item_id) || ve(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, ve(a.new_text));
  }
  return n;
}
const hd = {
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
function pd(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = hd[ve(n.kind)] || ve(n.kind) || "问题", o = ve(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const gd = /* @__PURE__ */ new Set(["text", "formula"]);
function Er(e) {
  return gd.has(e);
}
function ps(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || Er(Ce(n));
}
function yd(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !Er(Ce(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const bd = 300, vd = 72;
function wd(e, t) {
  if (e.width >= bd && e.height >= vd)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const Sd = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function kd(e, t, n) {
  return e.flatMap((r) => {
    if (!Sd.has(Ce(r.region))) return [];
    const o = lt(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function So(e, t, n) {
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
async function Td(e) {
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
const Id = "reader-text-hover-copy", Ed = "reader-text-hover-edit", Rd = "reader-text-hover-zoom", Pd = "reader-text-hover-id";
function Md(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const gs = "reader-text-hover-tools";
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
const xd = 26, Nd = 220;
function Ad(e, t = Nd) {
  return e.height < xd * 2 || e.width < t;
}
function _d({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? gr : e === "failed" ? bt : $a, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function Ld({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  onZoom: o,
  frameRect: a,
  placement: s,
  tailTop: i = 0
}) {
  const [c, l] = A("idle"), [u, f] = A("idle"), [d] = A(() => Md()), h = _([]), g = (e == null ? void 0 : e.itemId) || "";
  if (O(() => {
    l("idle"), f("idle");
    const S = h.current;
    return () => {
      S.forEach((P) => window.clearTimeout(P)), h.current = [];
    };
  }, [g]), !e) return null;
  const m = xi(e.highlight.region, t), y = Ce(e.highlight.region), v = (S, P) => async (R) => {
    R.preventDefault(), R.stopPropagation();
    const E = await Td(S);
    P(E ? "copied" : "failed"), h.current.push(window.setTimeout(() => P("idle"), 1200));
  }, w = y === "formula" ? "复制 LaTeX" : "复制", b = a || e.rect, k = s || (Ad(b) ? "outside" : "inside");
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
          className: gs,
          "data-placement": k,
          style: k === "tail" ? { top: i } : void 0,
          children: [
            d ? /* @__PURE__ */ p(
              un,
              {
                className: Pd,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: v(e.itemId, f),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && Er(y) ? /* @__PURE__ */ p(
              un,
              {
                className: Ed,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (S) => {
                  S.preventDefault(), S.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ p(vn, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            m ? /* @__PURE__ */ p(
              un,
              {
                className: Id,
                state: c,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: c === "copied" ? "已复制" : c === "failed" ? "复制失败" : w,
                onClick: v(m, l),
                children: /* @__PURE__ */ p(_d, { state: c })
              }
            ) : null,
            o ? /* @__PURE__ */ p(
              un,
              {
                className: Rd,
                state: "idle",
                label: "放大看这一块",
                title: y === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (S) => {
                  S.preventDefault(), S.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ p($i, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Cd(e, t) {
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
function $d(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = lt(
      Cd(e, a),
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
const Dd = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Od = 256, Ft = /* @__PURE__ */ new Map();
function zd(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function ys(e) {
  const t = `${e || ""}`, { text: n, slots: r } = ac(t, { bareLatex: !0 }), o = zd(n), a = sc(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = Ft.get(t);
  if (!s && (s = ic(o, r), Ft.set(t, s), Ft.size > Od)) {
    const i = Ft.keys().next().value;
    i !== void 0 && Ft.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function Dn(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Je(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Fd(e, t) {
  const n = e.typography, r = Je(t) || 1, o = Je(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = Dn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(s, i * r)), l = Je(n == null ? void 0 : n.fit_min_font_size_pt), u = Je(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (l || 5.5) * r), d = Math.max(
    f,
    u ? u * r : o ? o * r : c
  ), h = o ? o * r : c, g = Je(n == null ? void 0 : n.leading_em), m = [
    Je(n == null ? void 0 : n.padding_top_pt) || 0,
    Je(n == null ? void 0 : n.padding_right_pt) || 0,
    Je(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Je(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((y) => y * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Dd,
    fontSizePx: Math.max(f, Math.min(d, h)),
    minFontSizePx: f,
    maxFontSizePx: d,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (Dn(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : Dn(e.kind) ? "center" : "justify",
    padding: m,
    exact: !!o
  };
}
function Bd(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), i = (f) => {
    const d = s.get(f);
    if (d !== void 0) return d;
    const { width: h, height: g } = e(f), m = h <= t + 0.5 && g <= n + 0.5;
    return s.set(f, m), m;
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
const Hd = 512, Bt = /* @__PURE__ */ new Map();
let er = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  er += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  er += 1;
}));
function jd(e, t, n, r) {
  return [
    er,
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
function Rr({ item: e, pageScale: t }) {
  const n = _(null), r = U(
    () => ys(e.translatedText),
    [e.translatedText]
  ), [o, a] = A(r.fallbackHtml), s = U(
    () => Fd(e, t),
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
    const [d, h, g, m] = s.padding, y = Math.max(1, e.rect.width - m - h), v = Math.max(1, e.rect.height - d - g), w = jd(o, y, v, s);
    let b = Bt.get(w);
    if (b === void 0 && (b = Bd(
      (k) => (f.style.fontSize = `${k}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      y,
      v,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), Bt.set(w, b), Bt.size > Hd)) {
      const k = Bt.keys().next().value;
      k !== void 0 && Bt.delete(k);
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
function Ud({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = U(
    () => $d(e, t, n, r),
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
        Rr,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Wd = tn(Ud);
function Kd({
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
        Rr,
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
const Vd = tn(Kd), bs = 24, ot = bs * 2 + 4, Ge = 24, qd = 4, Jd = 6, ht = (e) => e.left + e.width, ct = (e) => e.top + e.height;
function Wt(e, t) {
  const n = Math.min(ht(e), ht(t)) - Math.max(e.left, t.left), r = Math.min(ct(e), ct(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const ko = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= ht(t) && r >= t.top && r <= ct(t);
}, Gd = (e) => e.height > 40 && e.height > e.width * 2.5;
function Xd(e, t, n) {
  if (!t.length || e.height < Ge || e.width < n + 8) return null;
  const r = Math.max(...t.map(ct)), o = ht(e) - 4 - n;
  for (const a of [r, ct(e) - 2]) {
    const s = Math.max(e.top, a - Ge), i = { left: o, top: s, width: n, height: Ge };
    if (!t.some((c) => Wt(i, c) > 0)) return s - e.top;
  }
  return null;
}
function Yd(e, t) {
  const n = [], r = (a) => {
    const s = bs + qd, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: ht(e), top: i, width: s, height: ot } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: ot } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - Ge - 3, width: ot, height: Ge + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: ct(e), width: ot, height: Ge + 3 } }), r(!0);
  const o = Xd(e, t, ot);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: ht(e) - 4 - ot, top: e.top + o, width: ot, height: Ge } }), n;
}
function Zd(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((w) => w.width > 0 && w.height > 0 && !Gd(w)), i = s.filter((w) => ko(w, t)), c = s.filter((w) => !ko(w, t)), l = n.filter((w) => w !== t && Wt(w, t) < t.width * t.height * 0.5), u = Yd(t, i).filter(({ box: w, overhang: b }) => {
    const k = b ? Jd : 0;
    return w.left >= -k && ht(w) <= r + k && w.top >= 0 && ct(w) <= o;
  }), f = ({ placement: w, tailTop: b }) => b === void 0 ? { placement: w } : { placement: w, tailTop: b }, d = ({ box: w }) => !c.some((b) => Wt(w, b) > 0), h = u.filter((w) => w.placement !== "tail"), g = h.find((w) => d(w) && !l.some((b) => Wt(w.box, b) > 0));
  if (g) return f(g);
  const m = h.find(d) || u.find((w) => w.placement === "tail" && d(w));
  if (m) return f(m);
  let y = null, v = Number.POSITIVE_INFINITY;
  for (const w of u) {
    const b = c.reduce((k, S) => k + Wt(w.box, S), 0);
    b < v && (y = w, v = b);
  }
  return y ? f(y) : { placement: "outside" };
}
function Qd(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - Ge - 3 : ct(r);
  return t >= r.left - 4 && t <= r.left + ot + 4 && n >= a && n <= a + Ge + 3;
}
const On = (e) => e.left + e.width, zn = (e) => e.top + e.height;
function ef(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const l of t) {
    if (l.width <= 0 || l.height <= 0) continue;
    const u = l.left + l.width / 2, f = l.top + l.height / 2;
    u < e.left || u > On(e) || f < e.top || f > zn(e) || (o = Math.min(o, l.left), a = Math.min(a, l.top), s = Math.max(s, On(l)), i = Math.max(i, zn(l)));
  }
  if (!Number.isFinite(o)) return e;
  const c = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return c.width = Math.min(On(e) + r, s + n) - c.left, c.height = Math.min(zn(e) + r, i + n) - c.top, c.width * c.height < e.width * e.height * 0.3 && c.height < 24 ? e : c;
}
function tf(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function nf(e, t, n, r) {
  const [o, a] = A(null);
  return Le(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? tf(s) : [], c = Ce(t.highlight.region) === "figure", l = i.length && !c ? ef(t.rect, i) : t.rect, u = n.filter((d) => d.itemId !== t.itemId).map((d) => d.rect), f = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...Zd({ frame: l, others: u, pageWidth: r, pageHeight: f, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
function rf({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = A(null), [i, c] = A(!1), [l, u] = A([]), [f, d] = A(""), [h, g] = A(""), [m, y] = A(!1), [v, w] = A(null), [b, k] = A([]), S = r.drafts, P = r.generation, R = L(async (T, I) => {
    if (e)
      try {
        u(ud(await e.fetchRevisions(T, I)));
      } catch {
        u([]);
      }
  }, [e]);
  O(() => {
    if (s(null), u([]), w(null), k([]), g(""), !e || !t || !n) return;
    let T = !1;
    return c(!0), e.loadItem(t, n).then((I) => {
      if (T) return;
      const M = I == null ? void 0 : I.item;
      if (!M) throw new Error("找不到这一段的译文。");
      const $ = `${(I == null ? void 0 : I.item_id) || n}`, { source: z, translated: K } = cd(M);
      s({ readerItemId: n, itemId: $, source: z, current: K }), d(S.get(n) ?? K);
    }).catch((I) => {
      T || w({ tone: "error", message: (I == null ? void 0 : I.message) || "读取这段译文失败。" });
    }).finally(() => {
      T || c(!1);
    }), R(t, n), () => {
      T = !0;
    };
  }, [e, t, n, R]);
  const E = L((T) => {
    d(T), n && S.set(n, T);
  }, [n, S]), D = L(async (T, I) => {
    if (!e || !a || m) return !1;
    const M = T ?? f;
    if (!M.trim()) return !1;
    y(!0), w(null), k([]);
    try {
      const $ = await e.revise(t, a.itemId, {
        translated_text: M,
        source: "user",
        reason: (I ?? h).trim() || "在阅读页手动修改",
        ...P.current != null ? { expected_generation: P.current } : {}
      }), z = Number($ == null ? void 0 : $.generation);
      return Number.isFinite(z) && (P.current = z), S.delete(a.readerItemId), s({ ...a, current: M }), d(M), g(""), ($ == null ? void 0 : $.changed) === !1 ? w({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, M), w({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), R(t, a.readerItemId), !0;
    } catch ($) {
      const z = $;
      return (z == null ? void 0 : z.reason) === "generation_mismatch" && (P.current = null), w({ tone: "error", message: (z == null ? void 0 : z.message) || "保存失败，请稍后再试。" }), k(pd(z == null ? void 0 : z.issues)), !1;
    } finally {
      y(!1);
    }
  }, [e, a, m, f, h, t, o, R, S, P]), x = L(() => {
    n && S.delete(n);
  }, [n, S]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: l,
    draft: f,
    setDraft: E,
    reason: h,
    setReason: g,
    saving: m,
    status: v,
    issues: b,
    save: D,
    discardDraft: x
  };
}
const vs = "reader-inline-edit";
function of({ text: e }) {
  const [t, n] = A("");
  return O(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = ys(e);
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
function af({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var x;
  const s = e.itemId, i = rf({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = A(!1), [u, f] = A(!1), d = _(null), h = wd(e.rect, t), g = U(() => yd(o), [o]), m = g.indexOf(s), { loaded: y } = i, v = i.saving || i.loading, w = n.blockedReason, b = !y || i.draft === y.current, { close: k, select: S } = n, P = L((T) => {
    const I = g[m + T];
    I && (S(I), a == null || a(I));
  }, [g, m, S, a]), R = L(() => {
    i.discardDraft(), k();
  }, [i, k]), E = L(async (T, I) => {
    await i.save(T, I) && k();
  }, [i, k]);
  O(() => {
    const T = (I) => {
      !I.altKey || I.key !== "ArrowUp" && I.key !== "ArrowDown" || (I.preventDefault(), P(I.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", T), () => window.removeEventListener("keydown", T);
  }, [P]), Le(() => {
    const T = d.current;
    if (!T) return;
    T.style.height = "auto";
    const I = h.mode === "inline" ? h.minHeight : 0;
    T.style.height = `${Math.max(I, T.scrollHeight + 2)}px`;
  }, [i.draft, y, h.mode, h.mode === "inline" ? h.minHeight : 0]);
  const D = h.mode === "inline" ? { left: h.left, top: h.top, width: h.width } : { left: h.left, width: h.width, top: h.top, bottom: h.bottom };
  return /* @__PURE__ */ C(Re, { children: [
    h.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ C(
      "div",
      {
        className: `${vs} is-${h.mode}`,
        style: D,
        role: "group",
        "aria-label": `改第 ${((x = n.target) == null ? void 0 : x.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": h.mode,
        onPointerDown: (T) => T.stopPropagation(),
        children: [
          r && (y != null && y.source) ? /* @__PURE__ */ p(
            G,
            {
              className: `reader-inline-edit-source${c ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: c ? "收起原文" : "展开原文",
              onClick: () => l((T) => !T),
              children: y.source
            }
          ) : null,
          w ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: w }) : null,
          i.loading ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          y ? /* @__PURE__ */ p(
            oc,
            {
              ref: d,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: v || !!w,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (T) => i.setDraft(T.target.value),
              onKeyDown: (T) => {
                T.key === "Enter" && (T.metaKey || T.ctrlKey) ? (T.preventDefault(), b || E()) : T.key === "Escape" && (T.preventDefault(), R());
              }
            }
          ) : null,
          y ? /* @__PURE__ */ p(of, { text: i.draft }) : null,
          /* @__PURE__ */ C("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(dt, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: m <= 0, onClick: () => P(-1), children: /* @__PURE__ */ p(Di, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(dt, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: m < 0 || m >= g.length - 1, onClick: () => P(1), children: /* @__PURE__ */ p(wn, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              yr,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: v || !!w || !y,
                onChange: (T) => i.setReason(T.target.value),
                onKeyDown: (T) => {
                  T.key === "Enter" ? (T.preventDefault(), b || E()) : T.key === "Escape" && (T.preventDefault(), R());
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
                onClick: () => f((T) => !T),
                children: [
                  /* @__PURE__ */ p(Oi, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ p(G, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: R, children: "取消" }),
            /* @__PURE__ */ p(
              G,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: v || !!w || b || !i.draft.trim(),
                pending: i.saving,
                onClick: () => {
                  E();
                },
                children: "保存"
              }
            )
          ] }),
          i.status ? /* @__PURE__ */ p("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ p("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((T) => /* @__PURE__ */ p("li", { children: T }, T)) }) : null,
          u && y && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((T, I) => {
            const M = T.text === y.current, $ = [dd(T.ts), T.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ C("li", { "data-block-edit-history": T.label, "data-current": M ? "true" : void 0, children: [
              /* @__PURE__ */ C("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ C("span", { children: [
                  $,
                  M ? "（现在用的）" : "",
                  T.reason ? ` · ${T.reason}` : ""
                ] }),
                M ? null : /* @__PURE__ */ p(
                  G,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: v || !!w,
                    onClick: () => {
                      E(T.text, `回到「${$.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ p("p", { className: "reader-inline-edit-history-text", children: T.text })
            ] }, `${T.ts}:${I}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const ws = nn(null), Ss = nn(null);
function sf({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(ws.Provider, { value: e, children: /* @__PURE__ */ p(Ss.Provider, { value: t, children: n }) });
}
function Be() {
  return ft(ws);
}
function Pr() {
  return ft(Ss);
}
const ks = 1.414;
function cf({
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
  hoveredRegionId: h,
  onHoverRegion: g,
  liveTranslationLayout: m,
  liveTranslationPage: y,
  showLiveTranslation: v = r === "source",
  liveTranslationMissing: w = !1
}) {
  var Z, fe;
  const b = Be(), k = b == null ? void 0 : b.revisedBlocks, S = b == null ? void 0 : b.blockEdit, P = S == null ? void 0 : S.pendingEdits, R = b == null ? void 0 : b.editBlock, E = (b == null ? void 0 : b.findTerm) || "", D = r === "translated" ? "translated" : b != null && b.compareVersion ? "compare" : "source", x = b == null ? void 0 : b.textMarks, T = U(
    () => x ? ({ str: N }) => ad(N, x(N), E) : E ? ({ str: N }) => Ut(N, E) : void 0,
    [E, x]
  ), I = _(c ?? ks), [M, $] = A(I.current);
  O(() => {
    c != null && Math.abs(c - I.current) >= 1e-3 && (I.current = c, $(c));
  }, [c]);
  const z = _(u);
  z.current = u;
  const K = _(null), j = _((N) => {
    var H;
    K.current = N, (H = z.current) == null || H.call(z, N);
  }).current, J = _(null), oe = _(`${t}@${n}`);
  Le(() => {
    const N = `${t}@${n}`;
    oe.current !== N && (oe.current = N, o && uf(K.current, J.current));
  }, [o, n, t]), O(() => {
    o || Fn(J.current);
  }, [o]), O(() => () => Fn(J.current), []);
  const q = Math.max(120, Math.floor(t * M)), se = Math.max(q, Math.ceil(s || 0)), Ee = lt(f, t, q), re = U(
    () => kd(d, t, q),
    [q, d, t]
  ), [ue, xe] = A(null), ie = typeof g == "function", le = ie ? h ?? null : ue, B = (N) => {
    ie ? N !== (h ?? null) && (g == null || g(N)) : xe((H) => H === N ? H : N);
  }, W = U(
    () => re.find((N) => N.itemId === le) || null,
    [le, re]
  ), Y = r === "translated" && ((Z = S == null ? void 0 : S.target) == null ? void 0 : Z.itemId) || "", de = U(
    () => Y && re.find((N) => N.itemId === Y) || null,
    [Y, re]
  ), ne = nf(K, o ? W : null, re, t), ae = (N) => {
    var Te, Ae, ze, He;
    if (N.pointerType === "touch") return;
    if (b != null && b.pointerTaken) {
      B(null);
      return;
    }
    if (N.buttons !== 0) {
      B(null);
      return;
    }
    if ((Ae = (Te = N.target) == null ? void 0 : Te.closest) != null && Ae.call(Te, `.${gs}`) || (He = (ze = N.target) == null ? void 0 : ze.closest) != null && He.call(ze, `.${vs}`)) return;
    const H = N.currentTarget.getBoundingClientRect(), V = N.clientX - H.left, me = N.clientY - H.top;
    if (Qd(ne, V, me)) return;
    const ye = So(re, V, me);
    B((ye == null ? void 0 : ye.itemId) || null);
  }, ke = (N) => {
    if (N.pointerType === "mouse") return;
    const H = N.currentTarget.getBoundingClientRect(), V = So(
      re,
      N.clientX - H.left,
      N.clientY - H.top
    );
    B((V == null ? void 0 : V.itemId) || null);
  }, ee = (N) => {
    !Number.isFinite(N) || N <= 0 || Math.abs(I.current - N) < 1e-3 || (I.current = N, $(N), l == null || l(e, N));
  };
  return /* @__PURE__ */ C(
    "div",
    {
      ref: j,
      [Ie]: e,
      [Se]: r,
      [wr]: q,
      className: Sr,
      onPointerMoveCapture: ae,
      onPointerDown: ke,
      onDoubleClick: (N) => {
        const H = b == null ? void 0 : b.zoomBlock;
        !H || b != null && b.pointerTaken || !W || Ce(W.highlight.region) === "figure" && (N.preventDefault(), H(W.itemId));
      },
      onPointerLeave: (N) => {
        N.pointerType === "mouse" && B(null);
      },
      style: {
        width: t,
        height: se,
        minHeight: se
      },
      children: [
        o ? /* @__PURE__ */ p(
          lc,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: T,
            renderAnnotationLayer: !1,
            className: Xa,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: Tn,
                style: { width: t, height: q }
              }
            ),
            onLoadSuccess: (N) => {
              try {
                const H = N.getViewport({ scale: 1 });
                if (H.width > 0) {
                  const V = H.height / H.width;
                  ee(V);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              Fn(J.current), i == null || i();
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
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: Ee,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && v ? /* @__PURE__ */ p(
          Wd,
          {
            layoutPage: m,
            pageState: y,
            width: t,
            height: q
          }
        ) : null,
        o && v && w ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (P != null && P.size) ? /* @__PURE__ */ p(Vd, { targets: re, edits: P, width: t, excludeId: de == null ? void 0 : de.itemId }) : null,
        o && de && S ? /* @__PURE__ */ p(
          af,
          {
            target: de,
            page: { width: t, height: q },
            edit: S,
            showSource: !!(b != null && b.editShowsSource),
            regions: b == null ? void 0 : b.regions,
            jumpToBlock: b == null ? void 0 : b.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (k != null && k.size) ? /* @__PURE__ */ p("div", { className: "reader-revised-markers", "aria-hidden": "true", children: re.filter((N) => k.has(N.itemId)).map((N) => /* @__PURE__ */ p(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": N.itemId,
            style: { left: N.rect.left, top: N.rect.top, height: N.rect.height }
          },
          N.itemId
        )) }) : null,
        (fe = b == null ? void 0 : b.pageLayers) == null ? void 0 : fe.map((N) => /* @__PURE__ */ p(Mn, { children: N.render({ page: e, width: t, height: q, pane: D, active: o }) }, N.id)),
        /* @__PURE__ */ p(
          Ld,
          {
            target: o && !(b != null && b.pointerTaken) && (W == null ? void 0 : W.itemId) !== (de == null ? void 0 : de.itemId) ? W : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: W && (k == null ? void 0 : k.get(W.itemId)) || 0,
            onEdit: R,
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
const lf = tn(cf);
function uf(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function Fn(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const Ts = 2 * 1024 * 1024;
function Is(e) {
  const t = new Sn.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const Bn = 5, df = "120% 0px", ff = 120, mf = "25% 0px";
let To = 1;
const Io = /* @__PURE__ */ new WeakMap();
function hf(e) {
  if (!e) return 0;
  const t = Io.get(e);
  if (t) return t;
  const n = To;
  return To += 1, Io.set(e, n), n;
}
function pf() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const gf = bi(
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
    onDocument: h,
    onLoadError: g,
    onNumPagesChange: m,
    activeRegion: y = null,
    regions: v = [],
    readerMetadata: w = null,
    hoveredRegionId: b = null,
    onHoverRegion: k,
    liveTranslation: S,
    showLiveTranslation: P = t === "source",
    liveTranslationPendingLabel: R = "",
    paneAction: E
  }, D) {
    ms();
    const { file: x, loading: T, error: I } = Kc(n, r), M = `${n}\0${hf(x)}`, $ = _(M);
    $.current = M;
    const z = U(() => {
      const F = Fc(x);
      return F ? "ranged" in F ? { range: Is(F.ranged) } : F : null;
    }, [x, n]), [K, j] = A(0), [J, oe] = A(""), [q, se] = A(null), [Ee, re] = A(480), ue = _(null), xe = _(0), ie = U(() => pf(), []), le = U(() => ({
      cMapUrl: At().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: At().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: Ts,
      disableAutoFetch: !0
    }), []);
    pr(D, () => q, [q]), O(() => {
      const F = (X) => {
        xe.current = X, re(X);
      }, Q = (X) => {
        const pe = fl(X, xe.current);
        if (pe !== "ignore") {
          if (ue.current && clearTimeout(ue.current), pe === "immediate") {
            F(X);
            return;
          }
          ue.current = setTimeout(() => F(X), ts);
        }
      }, te = !!(c && c >= 80);
      Q(te ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const ge = !te && i && typeof ResizeObserver < "u" ? new ResizeObserver((X) => {
        var pe, Pe;
        Q(((Pe = (pe = X[0]) == null ? void 0 : pe.contentRect) == null ? void 0 : Pe.width) ?? i.clientWidth);
      }) : null;
      return ge && i && ge.observe(i), () => {
        ge == null || ge.disconnect(), ue.current && clearTimeout(ue.current);
      };
    }, [c, i, a]);
    const B = U(
      () => ll(Ee, o),
      [Ee, o]
    ), [W, Y] = A(() => /* @__PURE__ */ new Map()), [de, ne] = A(() => /* @__PURE__ */ new Set()), [ae, ke] = A(() => /* @__PURE__ */ new Set()), ee = _(/* @__PURE__ */ new Map()), Z = _(null), fe = _(null), [N, H] = A(() => /* @__PURE__ */ new Set()), V = _(/* @__PURE__ */ new Map()), me = L((F, Q) => {
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
            const pe = X.target, Pe = En(pe);
            Number.isFinite(Pe) && (X.isIntersecting ? ce : ge).push(Pe);
          }
          if ((ce.length || ge.length) && ne((X) => {
            let pe = null;
            for (const Pe of ce)
              X.has(Pe) || (pe = pe || new Set(X), pe.add(Pe));
            for (const Pe of ge)
              X.has(Pe) && (pe = pe || new Set(X), pe.delete(Pe));
            return pe || X;
          }), ce.length) {
            for (const X of ce) {
              const pe = F.get(X);
              pe && (clearTimeout(pe), F.delete(X));
            }
            ke((X) => {
              let pe = null;
              for (const Pe of ce)
                X.has(Pe) || (pe = pe || new Set(X), pe.add(Pe));
              return pe || X;
            });
          }
          for (const X of ge)
            F.has(X) || F.set(X, setTimeout(() => {
              F.delete(X), ke((pe) => {
                if (!pe.has(X)) return pe;
                const Pe = new Set(pe);
                return Pe.delete(X), Pe;
              });
            }, ff));
        },
        { root: i, rootMargin: df, threshold: 0 }
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
              const X = En(ge.target);
              !Number.isFinite(X) || ge.isIntersecting === te.has(X) || (ce = ce || new Set(te), ge.isIntersecting ? ce.add(X) : ce.delete(X));
            }
            return ce || te;
          });
        },
        { root: i, rootMargin: mf, threshold: 0 }
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
      j(0), oe(""), ne(/* @__PURE__ */ new Set()), ke(/* @__PURE__ */ new Set()), Y(/* @__PURE__ */ new Map()), ee.current.clear();
      const F = V.current;
      for (const Q of F.values()) clearTimeout(Q);
      F.clear(), m == null || m(0, t);
    }, [M, m, t]);
    const He = L(
      (F) => {
        if ($.current !== M) return;
        const Q = F.numPages;
        j(Q), oe(""), m == null || m(Q, t), f == null || f({ numPages: Q, pane: t }), h && typeof F.getPage == "function" && h(F, t), d && typeof F.getOutline == "function" && Ku(F).then((te) => {
          $.current === M && d(te, t);
        }, () => {
        });
      },
      [M, f, d, h, m, t]
    ), Qe = L(
      (F) => {
        if ($.current !== M) return;
        const Q = (F == null ? void 0 : F.message) || "PDF 解析失败";
        oe(Q), j(0), m == null || m(0, t), g == null || g(F, t);
      },
      [M, g, m, t]
    ), $e = U(
      () => K > 0 ? Array.from({ length: K }, (F, Q) => Q + 1) : [],
      [K]
    );
    O(() => {
      typeof IntersectionObserver < "u" || ke(new Set($e));
    }, [$e]);
    const Ke = U(
      () => mt(y, w, t),
      [y, w, t]
    ), et = U(() => {
      const F = /* @__PURE__ */ new Map();
      for (const Q of v) {
        const te = mt(Q, w, t);
        if (!te) continue;
        const ce = F.get(te.box.page) || [];
        ce.push(te), F.set(te.box.page, ce);
      }
      return F;
    }, [t, w, v]), tt = U(() => {
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
        const te = Math.min(K, Bn * 2 + 1);
        return new Set(Array.from({ length: te }, (ce, ge) => ge + 1));
      }
      const Q = /* @__PURE__ */ new Set();
      for (const te of de)
        for (let ce = -Bn; ce <= Bn; ce++) {
          const ge = te + ce;
          ge >= 1 && ge <= K && Q.add(ge);
        }
      return Q;
    }, [K, $e, i, a, de]), nt = !n || !!I || !!J, be = n && (I || J) || s;
    return /* @__PURE__ */ C(
      "section",
      {
        ref: se,
        className: `reader-panel ${rn}${a ? "" : " is-hidden"}`,
        [Se]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (S == null ? void 0 : S.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          E ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: E }) : null,
          R ? /* @__PURE__ */ C("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: R })
          ] }) : null,
          nt && !T ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: be }) : null,
          T ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          z && !I ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            uc,
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
                    lf,
                    {
                      pane: t,
                      pageNumber: F,
                      width: B,
                      devicePixelRatio: ie,
                      active: ae.has(F),
                      textLayer: !ze || N.has(F),
                      syncedMinHeight: (l == null ? void 0 : l.get(F)) || 0,
                      onMetrics: u,
                      cachedAspect: W.get(F),
                      onAspectChange: me,
                      sentinelRef: Ae(F),
                      regionHighlight: (Ke == null ? void 0 : Ke.box.page) === F ? Ke : null,
                      regionTargets: et.get(F),
                      hoveredRegionId: b && tt.has(F) ? b : null,
                      onHoverRegion: k,
                      liveTranslationLayout: S == null ? void 0 : S.layoutByPage.get(F - 1),
                      liveTranslationPage: S == null ? void 0 : S.pagesByPage.get(F - 1),
                      showLiveTranslation: P,
                      liveTranslationMissing: pu(S, F - 1)
                    },
                    `${t}-${F}`
                  );
                const te = W.get(F) ?? ks, ce = Math.max(120, Math.floor(B * te)), ge = Math.max(ce, Math.ceil((l == null ? void 0 : l.get(F)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: Ae(F),
                    [Ie]: F,
                    [Se]: t,
                    [wr]: ce,
                    className: `${Sr} is-placeholder`,
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
            M
          ) }) : null
        ]
      }
    );
  }
), Eo = tn(gf), yf = 2e3, bf = 6, vf = 500, Ro = "reader-react-resizing";
function wf(e, t) {
  const n = _(null), r = _(null);
  Le(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const k = Sf(e), S = qt(e, k);
      if (!S) return;
      s = { pane: k, progress: S, started: performance.now() };
    }
    const { pane: i, progress: c, started: l } = s;
    let u = 0, f = null, d = e.scrollHeight, h = d, g = 0, m = l;
    const y = /* @__PURE__ */ new WeakMap(), v = typeof ResizeObserver > "u" ? null : new ResizeObserver((k) => {
      let S = !1;
      for (const P of k) {
        const R = Math.round(P.contentRect.height);
        y.has(P.target) && y.get(P.target) !== R && (S = !0), y.set(P.target, R);
      }
      S && _t(e, c, "auto", i);
    }), w = () => {
      var k;
      f && clearTimeout(f), cancelAnimationFrame(u), v == null || v.disconnect(), e.classList.remove(Ro);
      for (const S of Po) e.removeEventListener(S, w);
      ((k = r.current) == null ? void 0 : k.stop) === w && (r.current = null);
    }, b = () => {
      _t(e, c, "auto", i);
      const k = e.scrollHeight;
      g = k === h ? g + 1 : 0, h = k;
      const S = performance.now() - m;
      g >= bf && (k !== d || S > vf) || S > yf ? w() : u = requestAnimationFrame(b);
    };
    for (const k of Po) e.addEventListener(k, w, { passive: !0 });
    for (const k of Array.from(e.children)) v == null || v.observe(k);
    e.classList.add(Ro), r.current = { ...s, stop: w }, f = setTimeout(() => {
      f = null, m = performance.now(), d = e.scrollHeight, h = d, g = 0, u = requestAnimationFrame(b);
    }, ts);
  }, [e, t]), O(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Sf(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Ie}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(Se) || null;
  }
  return null;
}
const Po = ["wheel", "touchstart", "keydown", "pointerdown"];
function kf(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function Tf(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(rn)) && ((n = e.hasAttribute) != null && n.call(e, Se)));
}
function If(e, t) {
  O(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!Tf(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${rn}[${Se}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const c = kf(a, i);
        if (c === null || Math.abs(i.scrollLeft - c) < 1) continue;
        const l = i.scrollLeft;
        i.scrollLeft = c, Math.abs(i.scrollLeft - l) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function Ef(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), c = t - i, l = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: c * l };
}
function Rf(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const Mo = 12;
function Mr(e) {
  return Array.from(e.querySelectorAll(`.${rn}[${Se}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function Pf(e) {
  const t = e.getBoundingClientRect();
  return Mr(e).map((n) => {
    const r = n.getBoundingClientRect();
    return {
      pane: n.getAttribute(Se) || "",
      left: r.left - t.left,
      width: n.clientWidth,
      scrollWidth: n.scrollWidth,
      scrollLeft: n.scrollLeft
    };
  });
}
function Mf(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function xf(e, t) {
  return e ? Mr(e).find((n) => n.getAttribute(Se) === t) ?? null : null;
}
function Nf({ shellEl: e }) {
  const [t, n] = A([]), r = _(0), o = L(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = Pf(e);
      n((i) => Mf(i, s) ? i : s);
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
        for (const f of Mr(e))
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
  return a.length ? /* @__PURE__ */ p("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ p(Af, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function Af({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - Mo * 2), r = Ef(e, n), o = _(null);
  if (!r) return null;
  const a = (d) => {
    const h = xf(t, e.pane);
    h && (h.scrollLeft = d);
  }, s = (d) => {
    var h, g;
    d.button === 0 && (d.preventDefault(), d.stopPropagation(), (g = (h = d.currentTarget).setPointerCapture) == null || g.call(h, d.pointerId), o.current = { startX: d.clientX, startScroll: e.scrollLeft, pointerId: d.pointerId });
  }, i = (d) => {
    const h = o.current;
    !h || h.pointerId !== d.pointerId || a(h.startScroll + Rf(e, n, r.size, d.clientX - h.startX));
  }, c = (d) => {
    var h, g, m;
    ((h = o.current) == null ? void 0 : h.pointerId) === d.pointerId && (o.current = null, (m = (g = d.currentTarget).releasePointerCapture) == null || m.call(g, d.pointerId));
  }, l = (d) => {
    if (d.button !== 0 || d.target !== d.currentTarget) return;
    d.preventDefault();
    const h = d.currentTarget.getBoundingClientRect(), g = d.clientX - h.left, m = e.width * 0.8;
    a(e.scrollLeft + (g < r.offset ? -m : m));
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
      style: { left: e.left + Mo, width: n },
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
function Es(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function _f(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function Lf({ compare: e, onDone: t }) {
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
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: Es(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(gr, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(zi, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
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
            /* @__PURE__ */ p(Da, { size: 13, "aria-hidden": !0 }),
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
            /* @__PURE__ */ p(Fi, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function xo({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = _f(t), a = [e === "compare" ? "对比" : "正在读", r, Es(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ C("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function Cf({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = A({ source: null, translated: null });
  return Le(() => {
    if (!e) return;
    const a = () => {
      const i = e.getBoundingClientRect(), c = (l) => {
        const u = e.querySelector(`[${Se}="${l}"]`), f = u == null ? void 0 : u.getBoundingClientRect();
        return f && f.width > 0 ? { x: Math.round(f.left + f.width / 2), top: Math.round(i.top + 14) } : null;
      };
      o({ source: c("source"), translated: c("translated") });
    };
    a();
    const s = typeof ResizeObserver > "u" ? null : new ResizeObserver(a);
    return s == null || s.observe(e), e.querySelectorAll(`[${Se}]`).forEach((i) => s == null ? void 0 : s.observe(i)), window.addEventListener("resize", a), e.addEventListener("scroll", a, { passive: !0 }), () => {
      s == null || s.disconnect(), window.removeEventListener("resize", a), e.removeEventListener("scroll", a);
    };
  }, [e]), /* @__PURE__ */ C("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(xo, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(xo, { role: "reading", ...n }) }) : null
  ] });
}
const $f = () => () => {
}, No = () => null;
function Df({
  mode: e,
  compareMode: t,
  showSource: n,
  showTranslated: r,
  markdownSplit: o,
  overlayOnSource: a = !1
}) {
  return { mode: e, compareMode: t, showSource: n, showTranslated: r };
}
function Of(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function zf(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Ff(e) {
  const t = Be(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), d = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, h = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? on, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, m = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, v = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, w = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, b = (t == null ? void 0 : t.compareVersion) ?? null, k = (b == null ? void 0 : b.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", S = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", P = b ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, R = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, E = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), D = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), x = t == null ? void 0 : t.onPdfOutline, T = t == null ? void 0 : t.onPdfDocument, I = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), M = e.regions ?? (t == null ? void 0 : t.regions) ?? [], $ = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), z = (t == null ? void 0 : t.regionHover) ?? null, [K, j] = A(null), J = xn(
    z ? z.subscribe : $f,
    z ? () => z.get().itemId : No,
    z ? () => z.get().itemId : No
  ), oe = z ? J : K, q = L((ue) => {
    z ? z.set(ue, "pdf") : j(ue);
  }, [z]), se = Df({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), re = Number.isFinite(g) && g > 0 ? Of(
    g,
    // 对照时两栏分书页区，按书页区算（50% = 一栏）；单栏才按两倍算（50% = 铺满剩下的那一栏）。
    (n || r) && !se.compareMode,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return wf(d, re), If(d, se.compareMode), /* @__PURE__ */ C(
    "div",
    {
      ref: f,
      className: Ga,
      "data-reader-region-count": M.length,
      "data-reader-structured-region-count": M.filter(Ni).length,
      "data-reader-metadata-ready": $ ? "true" : "false",
      children: [
        /* @__PURE__ */ C(
          "main",
          {
            className: `${Ja} reader-mode-${se.mode}`,
            "data-reader-mode": se.compareMode ? s : n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              y ? /* @__PURE__ */ p(
                Eo,
                {
                  pane: "source",
                  url: k,
                  preloadedFile: P,
                  userZoom: h,
                  visible: se.showSource,
                  scrollRoot: d,
                  pageWidthOverride: re,
                  rowHeights: se.compareMode ? m : void 0,
                  onMetrics: E,
                  emptyLabel: w ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: D,
                  onOutline: b ? void 0 : x,
                  onDocument: b ? void 0 : T,
                  activeRegion: I,
                  regions: (b == null ? void 0 : b.regions) ?? M,
                  readerMetadata: $,
                  hoveredRegionId: oe,
                  onHoverRegion: q,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? zf(o) : "",
                  paneAction: u && se.showTranslated ? /* @__PURE__ */ C(Re, { children: [
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
                Eo,
                {
                  pane: "translated",
                  url: S,
                  preloadedFile: R,
                  userZoom: h,
                  visible: se.showTranslated,
                  scrollRoot: d,
                  pageWidthOverride: re,
                  rowHeights: se.compareMode ? m : void 0,
                  onMetrics: E,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: D,
                  onOutline: x,
                  onDocument: T,
                  activeRegion: I,
                  regions: M,
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
        /* @__PURE__ */ p(Nf, { shellEl: d }),
        b ? /* @__PURE__ */ p(Cf, { shellEl: d, left: b.left, right: b.right }) : null
      ]
    }
  );
}
const Bf = 72, dn = 1500, Hf = 2e3, jf = 1200;
function Uf(e, t) {
  return e - t < Bf;
}
function Wf(e) {
  try {
    return e.matches(":focus-visible");
  } catch {
    return !1;
  }
}
function Kf(e, t) {
  const [n, r] = A(!0), o = _(null), a = _(!1), s = _(!1), i = L(() => {
    o.current !== null && (window.clearTimeout(o.current), o.current = null);
  }, []), c = L((u) => {
    i(), o.current = window.setTimeout(() => {
      o.current = null, s.current || r(!1);
    }, u);
  }, [i]);
  O(() => {
    var k;
    const u = (k = e.current) == null ? void 0 : k.parentElement;
    if (!u) return;
    let f = u.getBoundingClientRect().top;
    const d = () => {
      f = u.getBoundingClientRect().top;
    }, h = (S) => {
      S.pointerType !== "touch" && (Uf(S.clientY, f) ? a.current || (a.current = !0, i(), r(!0)) : a.current && (a.current = !1, c(dn)));
    }, g = () => {
      a.current && (a.current = !1, c(dn));
    }, m = (S) => {
      s.current = S.target instanceof Element && Wf(S.target), s.current && (i(), r(!0));
    }, y = (S) => {
      var E;
      const P = S.relatedTarget;
      if (P instanceof Node && ((E = e.current) != null && E.contains(P))) return;
      const R = s.current;
      s.current = !1, R && !a.current && c(dn);
    }, v = () => {
      a.current || (r(!0), c(dn));
    }, w = () => {
      s.current = !1;
    }, b = e.current;
    return c(Hf), b == null || b.addEventListener("focusin", m), b == null || b.addEventListener("focusout", y), b == null || b.addEventListener("pointerdown", w), u.addEventListener("scroll", v, { capture: !0, passive: !0 }), u.addEventListener("pointerenter", d), u.addEventListener("pointermove", h, { passive: !0 }), u.addEventListener("pointerleave", g), window.addEventListener("resize", d), () => {
      i(), b == null || b.removeEventListener("focusin", m), b == null || b.removeEventListener("focusout", y), b == null || b.removeEventListener("pointerdown", w), u.removeEventListener("scroll", v, { capture: !0 }), u.removeEventListener("pointerenter", d), u.removeEventListener("pointermove", h), u.removeEventListener("pointerleave", g), window.removeEventListener("resize", d);
    };
  }, [e, i, c]);
  const l = _(t);
  return O(() => {
    l.current !== t && (l.current = t, !a.current && (r(!0), c(jf)));
  }, [t, c]), n;
}
const Vf = [
  { id: "source", label: "原文", Icon: Oa },
  { id: "compare", label: "对照", Icon: za },
  { id: "translated", label: "译文", Icon: Fa }
];
function qf(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function Jf(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function Gf(e) {
  const t = Be(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? qf(a.state) : "", l = _(null), u = Kf(l, n);
  return (
    // 浮在书页区顶上（2026-11-28 用户：「顶部的 bar 不要保留了，用悬浮的方式……更有沉浸感」）：
    // 这一层本身透明、不接点击，只有左上的胶囊和正中的页签接；左右两段同宽，页签在书页区正中。
    // 读的时候藏着，鼠标到书页区顶上才出来（use-topbar-reveal.ts；不藏的几种在 chrome.css）。
    /* @__PURE__ */ C("header", { className: "reader-workspace-bar", ref: l, "data-revealed": u ? "true" : "false", children: [
      /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
      /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
      e.start ? /* @__PURE__ */ p("div", { className: "reader-workspace-start", children: e.start }) : null,
      /* @__PURE__ */ C("div", { className: "reader-workspace-center", children: [
        /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Vf.map(({ id: f, label: d, Icon: h }) => {
          const g = n === f, m = Jf({
            id: f,
            documentReady: r,
            sourceViewOnly: i,
            liveTranslationAvailable: !!a
          });
          return /* @__PURE__ */ C(Mn, { children: [
            /* @__PURE__ */ p(
              "button",
              {
                type: "button",
                className: `reader-workspace-tab${g ? " is-active" : ""}`,
                role: "tab",
                "aria-selected": g,
                "aria-label": d,
                title: m ? `${d} 需要文档任务` : d,
                disabled: m,
                onClick: () => o(f),
                children: /* @__PURE__ */ p(h, { ...Me, "aria-hidden": !0 })
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
                /* @__PURE__ */ p(Bi, { ...Me, "aria-hidden": !0 }),
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
                /* @__PURE__ */ p(Hi, { ...Me, "aria-hidden": !0 }),
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
              /* @__PURE__ */ p(ji, { ...Me, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
            ]
          }
        ) }) : null
      ] }),
      /* @__PURE__ */ p("span", { className: "reader-workspace-end", "aria-hidden": "true" })
    ] })
  );
}
const Rs = [];
function Xf() {
  const e = /* @__PURE__ */ new Map(), t = /* @__PURE__ */ new Set();
  let n = Rs;
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
function Ao(e, t) {
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
function Yf(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.pageLayer ? [{ id: t, render: n.pageLayer }] : []);
}
function Zf(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.menuSection ? [{ id: t, render: n.menuSection }] : []);
}
function Qf(e) {
  var t;
  return ((t = e.find(({ contribution: n }) => n.takesPointer)) == null ? void 0 : t.id) ?? null;
}
function em(e) {
  const t = e.flatMap(({ id: n, contribution: r }) => r.textMarks ? [{ id: n, marks: r.textMarks }] : []);
  return t.length ? (n) => t.flatMap(({ id: r, marks: o }) => {
    try {
      return [...o(n)];
    } catch (a) {
      return console.error(`[reader] 扩展 ${r} 的文字层标记出错`, a), [];
    }
  }) : null;
}
function tm(e) {
  return e.reduce((t, { contribution: n }) => Math.max(t, n.reserveRight || 0), 0);
}
function nm(e) {
  for (const { contribution: t } of e) if (t.comparedDocument) return t.comparedDocument;
  return null;
}
function rm(e) {
  return e.flatMap(({ title: t, contribution: n }) => {
    var r;
    return (r = n.shortcuts) != null && r.length ? [{ title: t, items: n.shortcuts }] : [];
  });
}
const An = nn(null), Ps = nn(null);
function om({ api: e, store: t, children: n }) {
  const r = U(() => ({ api: e, store: t }), [e, t]);
  return /* @__PURE__ */ p(An.Provider, { value: r, children: n });
}
function $t() {
  const e = ft(An);
  if (!e) throw new Error("useReaderApi 要在 ReaderExtensionsProvider 里面用");
  return e.api;
}
const am = () => () => {
}, _o = () => Rs;
function sm(e) {
  return xn(e.subscribe, e.getSnapshot, e.getSnapshot);
}
function Ms() {
  var t;
  const e = (t = ft(An)) == null ? void 0 : t.store;
  return xn((e == null ? void 0 : e.subscribe) ?? am, (e == null ? void 0 : e.getSnapshot) ?? _o, (e == null ? void 0 : e.getSnapshot) ?? _o);
}
function an(e) {
  var a;
  const t = (a = ft(An)) == null ? void 0 : a.store, n = ft(Ps);
  if (!n) throw new Error("useReaderContribution 只能在扩展组件里用");
  const { id: r, title: o } = n;
  O(() => {
    t == null || t.set(r, o, e);
  }, [t, r, o, e]), O(() => () => t == null ? void 0 : t.remove(r), [t, r]);
}
class im extends vi {
  constructor() {
    super(...arguments);
    Xr(this, "state", { failed: !1 });
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
const cm = tn(function({ extensions: t }) {
  return /* @__PURE__ */ p(Re, { children: t.map(({ id: n, title: r, Component: o }) => /* @__PURE__ */ p(im, { id: n, children: /* @__PURE__ */ p(lm, { id: n, title: r, children: /* @__PURE__ */ p(o, {}) }) }, n)) });
});
function lm({ id: e, title: t, children: n }) {
  const r = U(() => ({ id: e, title: t }), [e, t]);
  return /* @__PURE__ */ p(Ps.Provider, { value: r, children: n });
}
function um({
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
const Lo = 6e3;
function xs(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function Ns(e, t, n, r) {
  const o = e.width * t.width, a = e.height * t.height;
  let s = n * r / Math.max(1, o);
  const i = Math.max(o, a) * s;
  return i > Lo && (s *= Lo / i), {
    scale: s,
    offsetX: -e.left * t.width * s,
    offsetY: -e.top * t.height * s,
    canvasWidth: Math.max(1, Math.round(o * s)),
    canvasHeight: Math.max(1, Math.round(a * s)),
    /** 显示高度（CSS 像素），按区域的宽高比。 */
    cssHeight: Math.round(n * (a / Math.max(1, o)))
  };
}
function xr({
  pdf: e,
  page: t,
  region: n,
  cssWidth: r,
  className: o,
  label: a
}) {
  const s = _(null), [i, c] = A({ status: "loading", cssHeight: 0 }), l = `${t}:${n.left}:${n.top}:${n.width}:${n.height}:${Math.round(r)}`;
  return O(() => {
    let u = !1, f = null;
    return c((d) => ({ status: "loading", cssHeight: d.cssHeight })), (async () => {
      try {
        const d = await e.getPage(t);
        if (u) return;
        const h = d.getViewport({ scale: 1 }), g = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), m = Ns(n, h, r, g), y = s.current, v = y == null ? void 0 : y.getContext("2d");
        if (!y || !v) return;
        y.width = m.canvasWidth, y.height = m.canvasHeight, c({ status: "loading", cssHeight: m.cssHeight });
        const w = d.getViewport({ scale: m.scale, offsetX: m.offsetX, offsetY: m.offsetY }), b = d.render({ canvasContext: v, viewport: w });
        f = b, await b.promise, u || c({ status: "ready", cssHeight: m.cssHeight });
      } catch (d) {
        !u && (d == null ? void 0 : d.name) !== "RenderingCancelledException" && c((h) => ({ status: "error", cssHeight: h.cssHeight }));
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
const dm = 1600, _n = { left: 0, top: 0, width: 1, height: 1 };
function As(e) {
  return new Promise((t, n) => {
    e.toBlob((r) => r ? t(r) : n(new Error("截图没出来")), "image/png");
  });
}
function fm(e, t, n) {
  if (e.width <= 0 || e.height <= 0) return null;
  const r = (l) => Math.min(1, Math.max(0, (l - e.left) / e.width)), o = (l) => Math.min(1, Math.max(0, (l - e.top) / e.height)), a = Math.min(r(t.x), r(n.x)), s = Math.max(r(t.x), r(n.x)), i = Math.min(o(t.y), o(n.y)), c = Math.max(o(t.y), o(n.y));
  return s - a < 0.02 || c - i < 0.02 ? null : { left: a, top: i, width: s - a, height: c - i };
}
async function mm(e, t, n = _n, r = dm) {
  const o = await e.getPage(t), a = Ns(n, o.getViewport({ scale: 1 }), r, 1), s = document.createElement("canvas");
  s.width = a.canvasWidth, s.height = a.canvasHeight;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.fillStyle = "#fff", i.fillRect(0, 0, s.width, s.height), await o.render({ canvasContext: i, viewport: o.getViewport({ scale: a.scale, offsetX: a.offsetX, offsetY: a.offsetY }) }).promise, As(s);
}
async function hm(e, t = _n) {
  const n = Math.round(t.left * e.width), r = Math.round(t.top * e.height), o = Math.max(1, Math.round(t.width * e.width)), a = Math.max(1, Math.round(t.height * e.height)), s = document.createElement("canvas");
  s.width = o, s.height = a;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.drawImage(e, n, r, o, a, 0, 0, o, a), As(s);
}
function pm(e, t) {
  return t.left === 0 && t.top === 0 && t.width === 1 && t.height === 1 ? `第${e}页.png` : `第${e}页-截图.png`;
}
const gm = /[\u{1D400}-\u{1D7FF}ﬀ-ﬆ]/gu, Co = /[⺀-鿿가-힯豈-﫿＀-￯　-〿]/u;
function ym(e) {
  let t = `${e || ""}`.replace(/\r\n?/g, `
`).replace(/­/g, "");
  return t.trim() ? (t = t.replace(gm, (r) => r.normalize("NFKC")), t = t.normalize("NFC"), t.includes("̸") && (t = t.replace(/(\S)?̸[ \t]*(\S)/gu, (r, o, a) => `${o ? `${o} ` : ""}${a}̸`).normalize("NFC")), t.split(/\n[ \t]*\n+/).map((r) => bm(r.split(`
`))).filter(Boolean).join(`
`).trim()) : "";
}
function bm(e) {
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
    t += Co.test(o) || Co.test(a) ? r : ` ${r}`;
  }
  return t;
}
const vm = /[\u{1D400}-\u{1D7FF}Ͱ-Ͽ℀-⅏←-⋿⨀-⫿⟀-⟯⦀-⧿⁰-₟̀-ͯ√±×÷]/u;
function $o(e) {
  return vm.test(e);
}
function wm(e) {
  const t = `${e || ""}`;
  return t.trim() ? [...t.trim()].length > 6 ? !1 : !new RegExp("\\p{Ll}{3,}", "u").test(t) : !0;
}
function Sm(e, t) {
  const n = e[t];
  if (!n) return null;
  const r = (i) => {
    const c = e[i];
    return !!c && c.line === n.line && ($o(c.text) || wm(c.text));
  };
  if (!r(t)) return null;
  let o = t, a = t;
  for (; r(o - 1); ) o -= 1;
  for (; r(a + 1); ) a += 1;
  let s = !1;
  for (let i = o; i <= a; i += 1) $o(e[i].text) && (s = !0);
  if (!s) return null;
  for (; o < a && !e[o].text.trim(); ) o += 1;
  for (; a > o && !e[a].text.trim(); ) a -= 1;
  return [o, a];
}
function km(e) {
  const t = e.filter((a) => a.right - a.left > 0.5 && a.bottom - a.top > 0.5);
  if (!t.length) return [];
  const n = [...t].sort((a, s) => (a.top + a.bottom) / 2 - (s.top + s.bottom) / 2), r = [];
  for (const a of n) {
    const s = r.at(-1), i = s ? Do(s) : null;
    i && Tm(i, a) >= 0.5 * Math.min(i.bottom - i.top, a.bottom - a.top) ? s.push(a) : r.push([a]);
  }
  const o = [];
  for (const a of r) {
    const s = Do(a), i = s.bottom - s.top, c = [...a].sort((u, f) => u.left - f.left);
    let l = null;
    for (const u of c)
      l && u.left - l.right <= i * 2 ? l.right = Math.max(l.right, u.right) : (l && o.push(l), l = { left: u.left, top: s.top, right: u.right, bottom: s.bottom });
    l && o.push(l);
  }
  return o;
}
function Do(e) {
  const t = Math.max(...e.map((r) => r.bottom - r.top)), n = e.filter((r) => r.bottom - r.top >= t * 0.75);
  return { top: Math.min(...n.map((r) => r.top)), bottom: Math.max(...n.map((r) => r.bottom)) };
}
function Tm(e, t) {
  return Math.min(e.bottom, t.bottom) - Math.max(e.top, t.top);
}
const tr = ".textLayer, .reader-layout-page, .reader-html-page", fn = ".reader-layout-page", Oo = "svg.reader-layout-math";
function nr(e) {
  return e ? e.nodeType === 1 ? e : e.parentElement : null;
}
function Im(e) {
  var t, n;
  return ((t = nr(e.startContainer)) == null ? void 0 : t.closest(tr)) ?? ((n = nr(e.endContainer)) == null ? void 0 : n.closest(tr)) ?? null;
}
const Em = /[\p{Script=Latin}\p{N})\].,;:!?%]$/u, Rm = /^[\p{Script=Latin}\p{N}(\[$]/u;
function Pm(e, t) {
  var s, i, c;
  let n = "", r = null, o = null, a = Number.NaN;
  for (const l of t.querySelectorAll(`text, ${Oo}`)) {
    if (!e.intersectsNode(l)) continue;
    let u, f = Number(l.getAttribute("x")), d, h;
    if (l.matches(Oo))
      u = `$${l.getAttribute("data-tex") || ""}$`, h = l.getAttribute("data-baseline"), d = f + Number(l.getAttribute("width") || 0);
    else {
      const m = l.textContent || "", y = l.firstChild;
      let v = 0, w = m.length;
      y && y === e.startContainer && (v = e.startOffset), y && y === e.endContainer && (w = e.endOffset), u = m.slice(v, w), h = l.getAttribute("y");
      let b = 0;
      try {
        b = ((s = l.getComputedTextLength) == null ? void 0 : s.call(l)) || 0;
      } catch {
        b = 0;
      }
      d = f + b, v > 0 && (f = Number.NaN);
    }
    if (!u) continue;
    const g = ((i = l.closest("[data-html-block]")) == null ? void 0 : i.getAttribute("data-html-block")) ?? null;
    if (o !== null && g !== o) n += `

`;
    else if (r !== null && h !== r) n += `
`;
    else if (n && Number.isFinite(a) && Number.isFinite(f)) {
      const m = Number((c = l.closest("[font-size]")) == null ? void 0 : c.getAttribute("font-size")) || 10;
      f - a > m * 0.2 && Em.test(n) && Rm.test(u) && (n += " ");
    }
    n += u, r = h, o = g, a = d;
  }
  return n;
}
function Mm(e) {
  if (!e.rangeCount) return "";
  const t = e.getRangeAt(0), n = nr(t.commonAncestorContainer), r = (n == null ? void 0 : n.closest(fn)) ?? (n != null && n.querySelector(fn) ? n : null);
  if (r) {
    const o = r.matches(fn) ? [r] : [...r.querySelectorAll(fn)].filter((a) => t.intersectsNode(a));
    if (o.length) return o.map((a) => Pm(t, a)).filter(Boolean).join(`

`);
  }
  return `${e}`;
}
function _s(e) {
  return ym(Mm(e));
}
const xm = 4e3;
function Nm(e, t, n) {
  if (e.length) {
    const o = Vu(e, n), a = o ? fs(e).find((s) => s.id === o) : null;
    if (a) return a.title;
  }
  let r = null;
  for (const o of t)
    !o.headingLevel || o.source.page > n || (!r || o.source.page >= r.source.page) && (r = o);
  return `${(r == null ? void 0 : r.source.text) || (r == null ? void 0 : r.markdown) || ""}`.replace(/\s+/g, " ").trim().slice(0, 80);
}
function zo(e) {
  var a, s;
  if (!e || e.isCollapsed || !e.rangeCount) return { text: "", element: null, rect: null };
  const t = e.getRangeAt(0), n = t.startContainer, r = ((s = (a = n.nodeType === 1 ? n : n.parentElement) == null ? void 0 : a.closest) == null ? void 0 : s.call(a, `[${Ie}]`)) ?? null;
  return r ? { text: _s(e).slice(0, xm), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function Am(e, t, n, r, o) {
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
function _m({
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
  const l = e.getAttribute(Se) === "source" ? "source" : "translated", u = e.getBoundingClientRect(), f = u.width > 0 && u.height > 0 ? { x: Math.min(1, Math.max(0, (t - u.left) / u.width)), y: Math.min(1, Math.max(0, (n - u.top) / u.height)) } : null, h = (r ? a.find((g) => g.itemId === r) ?? null : null) ?? (f ? Am(a, i, l, c, f) : null);
  return {
    pane: l,
    page: c,
    itemId: (h == null ? void 0 : h.itemId) ?? null,
    selection: o,
    sourceText: `${(h == null ? void 0 : h.source.text) || (h == null ? void 0 : h.markdown) || ""}`.trim(),
    translatedText: `${(h == null ? void 0 : h.translatedBlockText) || (h == null ? void 0 : h.translated.text) || ""}`.trim(),
    section: Nm(s, a, (h == null ? void 0 : h.source.page) ?? c),
    point: f
  };
}
function Lm(e, t, n = document) {
  for (const r of n.elementsFromPoint(e, t)) {
    const o = r.closest(`[${Ie}]`);
    if (!o) continue;
    const a = Number(o.getAttribute(Ie)) || 0, i = (o.closest(`[${Se}]`) ?? o).getAttribute(Se) === "translated" ? "translated" : "source", c = o.querySelector("canvas");
    if (a && c) return { page: a, pane: i, canvas: c, slot: o };
  }
  return null;
}
function Cm({ onDone: e, onCancel: t }) {
  const [n, r] = A(null), o = _(null), a = _(null);
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
      return Lm(c, l);
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
        const f = fm(l.canvas.getBoundingClientRect(), u, { x: c.clientX, y: c.clientY });
        f && e({ page: l.page, pane: l.pane, region: f, canvas: l.canvas, point: { x: u.x, y: u.y, target: l.slot } });
      },
      children: [
        /* @__PURE__ */ p("p", { className: "reader-ask-crop-hint", children: "在书页上拖出一块，松开就带进提问 · Esc 取消" }),
        i ? /* @__PURE__ */ p("div", { className: "reader-ask-crop-box", style: i }) : null
      ]
    }
  );
}
const Fo = 5e4, $m = 2e4;
function Hn(e, t) {
  const n = `${e || ""}`;
  return n.length > t ? n.slice(0, t) : n;
}
function $b(e, t) {
  const n = { page: e.page, pane: e.pane, item_ids: e.itemId ? [e.itemId] : [] };
  return t.documentId && (n.document_id = t.documentId), t.jobId && (n.job_id = t.jobId), t.versionId && (n.translation_version = t.versionId), e.selection && (n.selected_text = e.selection), e.section && (n.section = e.section), e.sourceText && (n.source_text = e.sourceText), e.translatedText && (n.translated_text = e.translatedText), n;
}
function Dm(e, t = null) {
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
function Om(e, t) {
  if (!(e != null && e.page)) return null;
  const r = [!!(e.document_id && t && e.document_id !== t) ? "别的书" : "", `第 ${e.page} 页`, e.section || ""].filter(Boolean).join(" · ");
  return { page: e.page, label: r, data: e };
}
function zm(e) {
  var r;
  const t = e == null ? void 0 : e.data, n = ((r = t == null ? void 0 : t.retainpdf) == null ? void 0 : r.selection) ?? (t && typeof t.page == "number" ? t : null);
  return n && n.page ? n : null;
}
function Db(e, t) {
  var r;
  const n = zm(e);
  return !n || n.document_id && t && n.document_id !== t ? null : ((r = n.item_ids) == null ? void 0 : r[0]) || null;
}
function Ob(e) {
  var o, a;
  const t = e.selection.trim();
  return t && !t.endsWith("…") ? t : ((a = (o = [...e.text.matchAll(/```[ \t]*(译文|translation|zh|zh-CN)[ \t]*\n([\s\S]*?)\n```/gi)].at(-1)) == null ? void 0 : o[2]) == null ? void 0 : a.trim()) || null;
}
function Fm(e, t) {
  var o;
  if (!t) return;
  const n = e.findIndex((a) => a.message_id === t);
  if (n < 0) return;
  const r = ((o = e[n + 1]) == null ? void 0 : o.role) === "assistant" ? Bm(e[n + 1].text) : "";
  return { question: e[n].text, ...r ? { answer: r } : {} };
}
function Bm(e, t = 160) {
  const n = e.replace(/```[\s\S]*?(```|$)/g, " ").replace(/\$\$[\s\S]*?\$\$/g, " … ").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim(), r = [...n];
  return r.length > t ? `${r.slice(0, t).join("")}…` : n;
}
function Hm(e, t = [], n = "") {
  const r = new Set(t.map((o) => o.covers_to_seq));
  return e.filter((o) => !o.superseded_at).map((o) => {
    const a = r.has(o.seq) ? { compactedBefore: !0 } : {};
    if (o.role === "user") {
      const s = Fm(e, o.edited_from);
      return {
        id: o.message_id,
        role: "user",
        text: o.text,
        context: Om(o.selection, n),
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
function jm(e, t, n, r) {
  var l, u, f;
  const o = ((f = (u = (l = e.context) == null ? void 0 : l.meta) == null ? void 0 : u.retainpdf) == null ? void 0 : f.selection) ?? null, a = (o == null ? void 0 : o.document_id) || t || null, s = e.sessionId && e.sessionId.length <= 256 ? e.sessionId : null, i = { agent_id: e.agentId || null, document_id: a, session_id: s }, c = e.answer.usage && JSON.stringify(e.answer.usage).length <= 4096 ? e.answer.usage : null;
  return [
    { ...i, role: "user", text: Hn(e.question.text, Fo), selection: o, client_message_id: `${n}-q`, ...r ? { edited_from: r } : {} },
    {
      ...i,
      role: "assistant",
      text: Hn(e.answer.text, Fo),
      thought: e.answer.thought ? Hn(e.answer.thought, $m) : null,
      usage: c,
      client_message_id: `${n}-a`,
      memory_ids: e.memoryIds.slice(0, 10)
    }
  ];
}
function Um(e) {
  return new Date(e - 2e3).toISOString().replace(/\.\d+Z$/, "Z");
}
function Wm(e, t) {
  return e.filter((n) => n.origin === "agent" && n.status === "active" && !t.has(n.memory_id)).map((n) => ({ id: n.memory_id, scope: n.scope, text: n.text, category: n.category, documentId: n.document_id, created: !0 }));
}
function Km(e, t) {
  if (t.id && e.some((r) => r.message_id === t.id)) return t.id;
  const n = t.text.trim();
  for (let r = e.length - 1; r >= 0; r -= 1) {
    const o = e[r];
    if (o.role === "assistant" && o.text.trim() === n) return o.message_id;
  }
  return null;
}
function Vm(e) {
  const t = e.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().split(new RegExp("(?<=[。！？.!?])"))[0] || "";
  return `深挖：${[...t].slice(0, 30).join("")}${[...t].length > 30 ? "…" : ""}`;
}
const qm = 50, jn = { conversation: null, main: null, records: [], compactions: [], hasMore: !1, key: "local", initial: [] };
function Jm() {
  var t, n;
  return `c-${((n = (t = globalThis.crypto) == null ? void 0 : t.randomUUID) == null ? void 0 : n.call(t)) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}
function Bo(e) {
  var n, r, o, a;
  const t = e;
  return `${(t == null ? void 0 : t.reason) || ((n = t == null ? void 0 : t.details) == null ? void 0 : n.reason) || ((a = (o = (r = t == null ? void 0 : t.payload) == null ? void 0 : r.error) == null ? void 0 : o.details) == null ? void 0 : a.reason) || (e instanceof Error ? e.message : "")}`;
}
function Gm({ port: e, book: t, onAppended: n }) {
  const r = (e == null ? void 0 : e.conversations) ?? null, o = (e == null ? void 0 : e.memories) ?? null, [a, s] = A(!1), [i, c] = A(jn), [l, u] = A(!1), [f, d] = A(""), [h, g] = A("idle"), [m, y] = A(null), [v, w] = A([]), b = L((B) => {
    y(B), w([]);
  }, []), k = L((B) => w((W) => [...W, B].slice(-2)), []), [S, P] = A(() => /* @__PURE__ */ new Map()), R = _(/* @__PURE__ */ new Set()), E = _(/* @__PURE__ */ new Map()), D = (B) => {
    if (!B) return null;
    const W = E.current.get(B);
    return W || (x.current.records.some((Y) => Y.message_id === B) ? B : null);
  }, x = _(i);
  x.current = i;
  const T = _(t);
  T.current = t;
  const I = _(0), M = L(async (B, W, Y, de = []) => {
    if (!r) return;
    const ne = await r.messages(B.conversation_id, { limit: qm, ...Y ? { beforeSeq: Y } : {} }), ae = [...ne.messages, ...de];
    I.current += 1, c({
      conversation: B,
      main: W ?? B,
      records: ae,
      compactions: ne.compactions || [],
      hasMore: ne.has_more,
      key: `${B.conversation_id}:${I.current}`,
      initial: Hm(ae, ne.compactions || [], T.current.documentId)
    });
  }, [r]), $ = L(async () => {
    s(!0);
    const B = x.current.conversation;
    if (!(!r || (B == null ? void 0 : B.kind) === "main" && B.status !== "archived")) {
      u(!0), d("");
      try {
        const W = await r.main(T.current.documentId || void 0);
        await M(W, W);
      } catch (W) {
        d(W instanceof Error ? W.message : String(W));
      } finally {
        u(!1);
      }
    }
  }, [r, M]), z = L((B) => {
    b(B), $();
  }, [$]), K = _(t.documentId);
  O(() => {
    K.current !== t.documentId && (K.current = t.documentId, x.current = jn, c(jn), b(null), P(/* @__PURE__ */ new Map()), E.current.clear(), a && $());
  }, [t.documentId, a, $]);
  const j = L(async () => {
    const B = x.current, W = B.records[0];
    if (!(!B.conversation || !W || !B.hasMore)) {
      u(!0);
      try {
        await M(B.conversation, B.main, W.seq, B.records);
      } finally {
        u(!1);
      }
    }
  }, [M]), J = L(async (B) => {
    const Y = x.current.conversation;
    if (!r || !Y) return;
    for (const Z of B.memoryIds) R.current.add(Z);
    let de = B.memoryIds;
    if (!de.length && o && B.startedAt) {
      const Z = Wm(
        await o.list({ source_conversation_id: Y.conversation_id, created_after: Um(B.startedAt) }).catch(() => []),
        R.current
      );
      for (const N of Z) R.current.add(N.id);
      de = Z.map((N) => N.id);
      const fe = B.answerId;
      Z.length && fe && P((N) => new Map(N).set(fe, Z));
    }
    const ne = jm({ ...B, memoryIds: de }, T.current.documentId, Jm(), D(B.editedFrom));
    let ae;
    try {
      ae = await r.append(Y.conversation_id, ne);
    } catch (Z) {
      if (Y.kind !== "side" || !/ask_conversation_not_open/.test(Bo(Z))) throw Z;
      await r.reopen(Y.conversation_id), ae = await r.append(Y.conversation_id, ne);
    }
    const [ke, ee] = ae.messages;
    B.questionId && ke && E.current.set(B.questionId, ke.message_id), B.answerId && ee && E.current.set(B.answerId, ee.message_id), c((Z) => {
      var fe;
      return ((fe = Z.conversation) == null ? void 0 : fe.conversation_id) === Y.conversation_id ? { ...Z, conversation: ae.conversation, records: [...Z.records, ...ae.messages] } : Z;
    }), n == null || n(ae.messages), ae.compaction_due && Y.kind === "main" && r.compact(Y.conversation_id).catch(() => {
    });
  }, [r, o, n]), oe = L(async (B) => {
    const W = x.current.conversation, Y = D(B);
    if (!r || !W || !Y) return null;
    try {
      await r.supersede(W.conversation_id, Y);
    } catch (ae) {
      if (!/ask_message_superseded/.test(Bo(ae))) throw ae;
    }
    const de = x.current.records.find((ae) => ae.message_id === Y), ne = x.current.records.findIndex((ae) => ae.message_id === Y);
    return c((ae) => ({ ...ae, records: ae.records.map((ke, ee) => ee >= ne && ne >= 0 && !ke.superseded_at ? { ...ke, superseded_at: "now" } : ke) })), (de == null ? void 0 : de.selection) ?? null;
  }, [r]), q = L((B) => {
    J(B).catch((W) => d(`这一轮没存上：${W instanceof Error ? W.message : String(W)}`));
  }, [J]), se = L(async (B) => {
    var de;
    const W = x.current, Y = W.main;
    if (!(!r || !Y || ((de = W.conversation) == null ? void 0 : de.kind) !== "main")) {
      d("");
      try {
        const ne = Km(W.records, B), ae = await r.fork({
          parent_id: Y.conversation_id,
          ...ne ? { forked_from_message_id: ne } : {},
          title: Vm(B.text),
          ...T.current.documentId ? { document_id: T.current.documentId } : {}
        });
        await M(ae, Y);
      } catch (ne) {
        d(`开不了副对话：${ne instanceof Error ? ne.message : String(ne)}`);
      }
    }
  }, [r, M]), Ee = L(async (B) => {
    const W = x.current.main;
    if (r)
      try {
        await M(await r.get(B), W);
      } catch (Y) {
        d(`打不开副对话：${Y instanceof Error ? Y.message : String(Y)}`);
      }
  }, [r, M]), re = L(async () => {
    const B = x.current.main;
    B && await M(B, B).catch(() => {
    });
  }, [M]), ue = L(async () => {
    const B = x.current.conversation;
    if (!(!r || (B == null ? void 0 : B.kind) !== "side")) {
      g("busy");
      try {
        await r.close(B.conversation_id), g("idle"), await re();
      } catch {
        g("failed");
      }
    }
  }, [r, re]), xe = L(async () => r != null && r.archived ? r.archived(T.current.documentId) : [], [r]), ie = L(async (B) => {
    d(""), b(null);
    try {
      await M(B, x.current.main);
    } catch (W) {
      d(`打不开这个对话：${W instanceof Error ? W.message : String(W)}`);
    }
  }, [M, b]), le = L(async () => {
    const B = x.current.main;
    if (!r || !B) return;
    await r.archive(B.conversation_id);
    const W = await r.main(T.current.documentId || void 0);
    await M(W, W);
  }, [r, M]);
  return {
    visible: a,
    view: i,
    loading: l,
    error: f,
    pending: m,
    setPending: b,
    extras: v,
    addExtra: k,
    closingSide: h,
    notices: S,
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
    listArchived: xe,
    viewArchived: ie,
    forgetMemory: r ? r.forgetMemory : void 0
  };
}
function Ho(e, t, n) {
  var c;
  const r = e.selection, o = e.page ?? (r == null ? void 0 : r.page) ?? 0;
  if (e.role !== "user" || !o) return null;
  const a = (e.pane ?? (r == null ? void 0 : r.pane)) === "source" ? "source" : "translated", s = ((c = r == null ? void 0 : r.item_ids) == null ? void 0 : c[0]) ?? null, i = Dm({ item_ids: [], ...r, page: o, pane: a }, n(s, a, o));
  return { key: t, anchor: i, messageId: e.message_id, title: e.text.slice(0, 80) };
}
function Xm({ port: e, documentId: t, resetKey: n, pointOf: r }) {
  const [o, a] = A([]), s = _(0), i = _(r);
  i.current = r;
  const c = () => (s.current += 1, s.current);
  O(() => {
    var h, g;
    if (a([]), !e || !t) return;
    let f = !1;
    const d = (m) => {
      !f && m.length && a((y) => [...y, ...m]);
    };
    return (h = e.threads) == null || h.list(t).then(
      (m) => d(m.map((y) => ({ key: c(), anchor: y.anchor, threadId: y.threadId, title: y.title }))),
      () => {
      }
    ), (g = e.conversations) == null || g.bookMessages(t).then(
      (m) => d(m.map((y) => Ho(y, c(), i.current)).filter((y) => !!y)),
      () => {
      }
    ), () => {
      f = !0;
    };
  }, [e, t, n]);
  const l = L((f) => {
    const d = f.filter((h) => !h.document_id || h.document_id === t).map((h) => Ho(h, c(), i.current)).filter((h) => !!h);
    d.length && a((h) => [...h.filter((g) => !d.some((m) => m.messageId === g.messageId)), ...d]);
  }, [t]), u = L((f) => a((d) => d.filter((h) => h.key !== f)), []);
  return { marks: o, addRecords: l, removeMark: u };
}
const Ym = Aa(() => import("./ReaderAskPanel-DH4MNO8u.js"));
function Zm({
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
  pdfDocuments: h,
  currentPage: g,
  visibleMode: m,
  activePanel: y = null,
  panelHost: v = null
}) {
  const w = U(() => ({ documentId: t, jobId: n, versionId: r }), [t, n, r]), b = L((N, H, V) => {
    const me = N ? o.find((Ae) => Ae.itemId === N) : null, ye = me ? mt(me, a, H) : null, Te = ye && ye.box.page === V ? lt(ye, 1, 1) : null;
    return Te ? { x: Te.left, y: Te.top } : null;
  }, [o, a]), k = Xm({ port: e, documentId: t, resetKey: c, pointOf: b }), S = Gm({ port: e, book: w, onAppended: k.addRecords }), [P, R] = A(null), E = L(
    (N, H, V, me) => _m({
      pageElement: (N == null ? void 0 : N.closest(`[${Ie}]`)) ?? null,
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
    const N = zo(((H = globalThis.getSelection) == null ? void 0 : H.call(globalThis)) ?? null);
    return !N.text || !N.element || !N.rect ? null : E(N.element, N.rect.left + N.rect.width / 2, N.rect.top + N.rect.height / 2, N.text);
  }, [E]), x = L((N) => {
    R(null), S.ask(N);
  }, [S.ask]);
  O(() => {
    if (!e) return;
    const N = (H) => {
      var ye;
      if (H.key !== "?" || H.metaKey || H.ctrlKey || H.altKey || H.defaultPrevented) return;
      const V = H.target;
      if ((ye = V == null ? void 0 : V.closest) != null && ye.call(V, "input, textarea, select, [contenteditable='true']")) return;
      const me = D();
      me && (H.preventDefault(), H.stopImmediatePropagation(), x(me));
    };
    return window.addEventListener("keydown", N, !0), () => window.removeEventListener("keydown", N, !0);
  }, [e, D, x]);
  const T = _(h);
  T.current = h;
  const I = L(async ({ page: N, pane: H, region: V, canvas: me }) => {
    const ye = T.current[H];
    let Te;
    if (ye)
      Te = await mm(ye, N, V);
    else {
      const Ae = me ?? document.querySelector(`[${Se}="${H}"] [${Ie}="${N}"] canvas`);
      if (!Ae) throw new Error(`第 ${N} 页还没画出来，翻到那一页再试`);
      Te = await hm(Ae, V);
    }
    return new File([Te], pm(N, V), { type: "image/png" });
  }, []), [M, $] = A(null), z = _(S.pending);
  z.current = S.pending;
  const K = U(() => [{
    key: "page",
    label: "带上这一页",
    title: "带上这一页的截图（问的那一页，没有就是现在读的这页）：公式、图表、表格让 AI 直接看图",
    icon: /* @__PURE__ */ p(Ui, { size: 14, "aria-hidden": !0 }),
    run: () => {
      const N = z.current, H = (N == null ? void 0 : N.pane) || (m === "translated" ? "translated" : "source");
      return I({ page: (N == null ? void 0 : N.page) || g() || 1, pane: H, region: _n });
    }
  }], [I, g, m]), [j, J] = A(!1), [oe, q] = A(""), se = L(async (N) => {
    J(!1), q("");
    try {
      const H = await I(N), V = E(N.point.target, N.point.x, N.point.y, "");
      $((me) => ({ id: ((me == null ? void 0 : me.id) || 0) + 1, files: [H] })), V ? x({ ...V, itemId: null, sourceText: "", translatedText: "" }) : S.openMain();
    } catch (H) {
      q(H instanceof Error ? H.message : String(H));
    }
  }, [I, E, x]), Ee = L(() => J(!1), []), re = L(() => {
    q(""), J((N) => !N);
  }, []), ue = L(async (N) => {
    if (N.threadId && (e != null && e.threads) && t) {
      try {
        const H = await e.threads.get(t, N.threadId);
        R({ anchor: H.anchor || N.anchor, messages: H.messages || [], mark: N });
      } catch {
        R({ anchor: N.anchor, messages: [], mark: N });
      }
      return;
    }
    R(null), S.openMain();
  }, [e, t, S.openMain]), xe = L((N) => {
    var me;
    if (!e) return [];
    const H = zo(((me = globalThis.getSelection) == null ? void 0 : me.call(globalThis)) ?? null), V = E(N.target, N.clientX, N.clientY, H.element ? H.text : "");
    return V ? [{
      key: "ask",
      label: V.selection ? "问这段" : "在这里提问",
      hint: V.selection ? "?" : void 0,
      // 选着字时也出现在选字浮条上（「复制 · 收藏 · 提问」，ReaderSelectionLayer）。
      inSelectionBar: V.selection ? "提问" : void 0,
      onSelect: () => x(V)
    }, {
      key: "crop",
      label: "截一块问",
      onSelect: () => {
        q(""), J(!0);
      }
    }] : [];
  }, [e, E, x]), ie = P ? {
    anchor: P.anchor,
    messages: P.messages,
    onClose: () => R(null),
    onDelete: e != null && e.threads && P.mark.threadId ? () => {
      e.threads.remove(t, P.mark.threadId).catch(() => {
      }), k.removeMark(P.mark.key), R(null);
    } : void 0
  } : null, le = U(() => f ? (N, H) => {
    f(N, H ?? void 0), requestAnimationFrame(() => d(N, "translated"));
  } : null, [f, d]), B = L((N) => ps(o, N), [o]), [W, Y] = A(0), de = L(({ mode: N, width: H }) => {
    Y(N === "dock" ? Math.round(H) : 0);
  }, []), ne = !S.persistent || !!S.view.conversation || !!S.error, ae = e && (S.visible && ne || P) ? /* @__PURE__ */ p(Na, { fallback: null, children: /* @__PURE__ */ p(
    Ym,
    {
      port: e,
      jobId: n,
      book: w,
      ask: S,
      legacy: ie,
      onShowSelection: ({ page: N, pane: H }) => l(N, H),
      onJumpToPage: (N) => l(N),
      pageCount: u,
      onLayout: de,
      dockTaken: y !== null,
      dockHost: v,
      onEditBlock: le,
      canEditBlock: B,
      attachTools: K,
      attachRequest: M
    }
  ) }) : null, ke = j || oe ? /* @__PURE__ */ C(Re, { children: [
    j ? /* @__PURE__ */ p(Cm, { onDone: (N) => void se(N), onCancel: Ee }) : null,
    oe ? /* @__PURE__ */ C("p", { className: "reader-ask-crop-error", role: "alert", onClick: () => q(""), children: [
      "截图没成：",
      oe
    ] }) : null
  ] }) : null, ee = S.visible && ne || !!P, Z = S.close, fe = L(() => {
    if (ee) {
      R(null), Z();
      return;
    }
    S.openMain();
  }, [ee, Z, S.openMain]);
  return { marks: k.marks, onMark: ue, menuItems: xe, panel: ae, overlay: ke, cropping: j, toggleCrop: re, open: S.openMain, toggle: fe, showing: ee, reserveRight: ee ? W : 0, enabled: !!e };
}
const Qm = [{ keys: "选字 + ?", desc: "问选中的这段" }];
function eh() {
  const e = $t(), t = U(() => {
    try {
      return Ze().ask ?? null;
    } catch {
      return null;
    }
  }, []), n = Zm({
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
  }), { marks: r, onMark: o, menuItems: a, panel: s, overlay: i, cropping: c, toggleCrop: l, enabled: u, toggle: f, showing: d, reserveRight: h } = n, g = U(() => u ? {
    toolbarItems: [{
      key: "ask",
      label: "提问",
      title: "提问：问整本书、翻这本书以前的对话（问某一段：书页上右键，或选字按 ?）",
      Icon: Ba,
      pressed: d,
      onClick: f
    }, {
      // 底栏右边：框出书页上的一块，截图带进提问（和右键「截一块问」一样）。
      key: "crop",
      label: "截图",
      title: "截图：在书页上框出一块，带进提问（Esc 取消）",
      Icon: Wi,
      place: "bottom",
      pressed: c,
      onClick: l
    }],
    menuItems: a,
    pageLayer: r.length ? ({ page: m, height: y }) => /* @__PURE__ */ p(um, { marks: r, page: m, height: y, onOpen: o }) : void 0,
    shortcuts: Qm,
    reserveRight: h,
    // 「截一块问」时占着书页上的指针：不出悬停框、不选字。
    takesPointer: c
  } : {}, [u, a, r, o, f, d, h, c, l]);
  return an(g), /* @__PURE__ */ C(Re, { children: [
    s,
    i
  ] });
}
const th = { id: "ask", title: "提问", Component: eh };
function rr() {
  try {
    return Ze().translationVersions ?? null;
  } catch {
    return null;
  }
}
function nh(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function rh(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function oh(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function ah({ documentId: e, jobId: t }) {
  const [n, r] = A([]), [o, a] = A(null);
  O(() => {
    r([]);
    const i = rr();
    if (!i || !e) return;
    let c = !1;
    return i.list(e).then((l) => {
      c || (r(l.versions), a(l.currentVersionId));
    }).catch(() => {
    }), () => {
      c = !0;
    };
  }, [e, t]);
  const s = rh(n, t, o);
  return U(() => ({ versions: n, readingVersionId: s }), [n, s]);
}
function sh({ documentId: e, jobId: t, versions: n, readingVersionId: r }) {
  const [o, a] = A(null), [s, i] = A(""), [c, l] = A(""), u = _(0);
  O(() => {
    u.current += 1, a(null), i(""), l("");
  }, [e, t]);
  const f = L((g) => {
    const m = rr(), y = n.find((w) => w.versionId === g);
    if (!m || !y || !e) return;
    const v = ++u.current;
    i(g), l(""), (async () => {
      const w = Ze(), b = await m.resolveJob(e, g);
      if (!b) throw new Error("这一份还没有能读的译文。");
      const k = await w.loadReaderPayload(b, { includeOptionalArtifacts: !0 }), S = w.resolveReaderTranslatedPdfUrl(k.jobPayload, k.manifestPayload);
      if (!S) throw new Error("这一份没有译文 PDF。");
      return { versionId: g, name: y.name, jobId: b, url: S, regions: nh(La(k.regionsPayload)) };
    })().then((w) => {
      v === u.current && a(w);
    }).catch((w) => {
      v === u.current && l((w == null ? void 0 : w.message) || "这一份打不开。");
    }).finally(() => {
      v === u.current && i("");
    });
  }, [e, n]), d = L(() => {
    u.current += 1, a(null), i(""), l("");
  }, []), h = L(async () => {
    var y, v;
    const g = rr();
    if (!g || !o || !e) return;
    try {
      await g.select(e, o.versionId);
    } catch (w) {
      l((w == null ? void 0 : w.message) || "换不过去，请稍后再试。");
      return;
    }
    const m = (y = globalThis.location) == null ? void 0 : y.href;
    m && ((v = globalThis.history) == null || v.replaceState(globalThis.history.state, "", oh(m, o.jobId))), a(null);
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
    adopt: h
  }), [n, r, o, s, c, f, d, h]);
}
function ih(e) {
  return e.available ? {
    key: "compare",
    label: "对比版本",
    title: "对比版本：左边换成这本书的另一份译文",
    Icon: Ki,
    place: "compare",
    pressed: !!(e.compared || e.loading),
    popup: (t) => /* @__PURE__ */ p(Lf, { compare: e, onDone: t })
  } : null;
}
function ch(e) {
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
function lh() {
  var i;
  const e = $t(), t = sh({
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
    const c = ih(t);
    return { toolbarItems: c ? [c] : [], comparedDocument: ch(t) };
  }, [t]);
  return an(s), null;
}
const uh = { id: "compare", title: "对比版本", Component: lh }, we = (e) => {
  const t = Number(e);
  return Number.isFinite(t) ? t : 0;
}, jo = (e) => {
  const t = Array.isArray(e) ? e : [];
  return [we(t[0]), we(t[1]), we(t[2])];
};
function Uo([e, t, n]) {
  const r = Math.max(e, t, n) > 1 ? 1 : 255, o = (a) => Math.round(Math.min(255, Math.max(0, a * r)));
  return `rgb(${o(e)}, ${o(t)}, ${o(n)})`;
}
function Ls(e) {
  const t = e && typeof e == "object" ? e : null;
  if (!t) return null;
  const n = Math.floor(we(t.index));
  if (n < 0 || !(we(t.width) > 0) || !(we(t.height) > 0)) return null;
  const r = (Array.isArray(t.covers) ? t.covers : []).flatMap((a) => {
    const s = a, i = Array.isArray(s.rect) ? s.rect.map(we) : [];
    return i.length === 4 && i[2] > i[0] && i[3] > i[1] ? [{ block: `${s.block || ""}`, rect: i, fill: jo(s.fill) }] : [];
  }), o = (Array.isArray(t.blocks) ? t.blocks : []).flatMap((a) => {
    const s = a, i = we(s.fontSize);
    if (!(i > 0)) return [];
    const c = (Array.isArray(s.lines) ? s.lines : []).map((l) => {
      const u = l, f = (Array.isArray(u.items) ? u.items : []).flatMap((d) => {
        const h = d;
        return typeof h.tex == "string" ? [{
          x: we(h.x),
          tex: h.tex,
          display: !!h.display,
          w: we(h.w),
          h: we(h.h),
          d: we(h.d),
          ...typeof h.svg == "string" && h.svg ? { svg: h.svg } : {}
        }] : typeof h.t == "string" && h.t ? [{
          x: we(h.x),
          t: h.t,
          ...h.mode === "dflt" ? { mode: "dflt" } : {},
          ...typeof h.font == "string" && h.font ? { font: h.font } : {}
        }] : [];
      });
      return { text: `${u.text || ""}`, x: we(u.x), baseline: we(u.baseline), width: we(u.width), justified: !!u.justified, items: f };
    });
    return [{ id: `${s.id || ""}`, fontSize: i, weight: s.weight === "bold" ? "bold" : "regular", color: jo(s.color), lines: c }];
  });
  return { index: n, width: we(t.width), height: we(t.height), covers: r, blocks: o };
}
function dh(e, t = []) {
  const n = e && typeof e == "object" ? e : null;
  if (!n || !`${n.schema || ""}`.startsWith("rpr_layout_")) return null;
  const r = /* @__PURE__ */ new Map();
  for (const o of Array.isArray(n.pages) ? n.pages : []) {
    const a = Ls(o);
    a && r.set(a.index + 1, a);
  }
  return { schema: `${n.schema}`, pages: r, fonts: t };
}
async function fh(e, t = fetch) {
  var s;
  const n = new URL(e, (s = globalThis.location) == null ? void 0 : s.href), r = await (await t(n.href)).json(), o = (r.fonts || []).flatMap((i) => i.family && i.url ? [{ family: i.family, weight: we(i.weight) || 400, url: new URL(i.url, n).href }] : []), a = await (await t(new URL(r.layout || "layout.json", n).href)).json();
  return dh(a, o);
}
const mh = /* @__PURE__ */ new Set(["no_translated_pdf", "not_engine_route", "unsupported_render", "merged_reading", "not_kept"]);
function hh(e) {
  const t = `${e || ""}`.trim();
  return mh.has(t) ? t : "not_kept";
}
const Wo = (e) => {
  const t = e && typeof e == "object" ? e : null;
  return (t && t.data && typeof t.data == "object" ? t.data : null) ?? t;
}, ph = (e) => `RPR ${e}`;
async function Ko(e, { apiPrefix: t = "/api/v1", fetcher: n }) {
  const r = `${t.replace(/\/$/, "")}/jobs/${encodeURIComponent(e)}/reader/layout`, o = await n(r);
  if (!o.ok) throw new Error(`版面清单 HTTP ${o.status}`);
  const a = Wo(await o.json()) ?? {}, s = a.generate && typeof a.generate == "object" ? a.generate : null, i = s && s.url ? { method: `${s.method || "POST"}`, url: `${s.url}`, body: s.body ?? null } : null;
  if (!a.available) return { available: !1, reason: hh(a.reason), generate: i, source: null };
  const c = /* @__PURE__ */ new Map();
  for (const y of Array.isArray(a.pages) ? a.pages : []) {
    const v = y, w = Math.floor(we(v.index));
    w >= 0 && c.set(w + 1, `${v.url || `${r}/pages/${w}`}`);
  }
  const l = (Array.isArray(a.fonts) ? a.fonts : []).flatMap((y) => {
    const v = y;
    return v.family && v.url ? [{ key: `${v.key || ""}` || void 0, family: ph(`${v.family}`), weight: we(v.weight) || 400, url: `${v.url}` }] : [];
  }), u = a.background && typeof a.background == "object" ? a.background : null, f = Array.isArray(u == null ? void 0 : u.pages) ? u.pages.map((y) => Math.floor(we(y))) : [], d = u != null && u.url ? {
    url: `${u.url}`,
    pageFor(y) {
      const v = f.indexOf(y - 1);
      return v >= 0 ? v + 1 : null;
    }
  } : null, h = /* @__PURE__ */ new Map(), g = /* @__PURE__ */ new Map(), m = {
    schema: `${a.schema || "rpr_layout_v1"}`,
    pages: new Set(c.keys()),
    fonts: l,
    background: d,
    loadPage(y) {
      const v = c.get(y);
      if (!v) return Promise.resolve(null);
      let w = h.get(y);
      return w || (w = n(v).then(async (b) => b.ok ? Ls(Wo(await b.json())) : null).catch(() => null), h.set(y, w)), w;
    },
    loadMath(y) {
      let v = g.get(y);
      return v || (v = n(`${r}/${y.replace(/^\/+/, "")}`).then(async (w) => w.ok ? w.text() : null).catch(() => null), g.set(y, v)), v;
    },
    async loadFont(y) {
      const v = await n(y.url);
      if (!v.ok) throw new Error(`字体 HTTP ${v.status}`);
      return v.arrayBuffer();
    }
  };
  return { available: !0, reason: null, generate: i, source: m };
}
function gh(e, t = fetch) {
  return {
    schema: e.schema,
    pages: new Set(e.pages.keys()),
    fonts: e.fonts,
    background: null,
    loadPage: (n) => Promise.resolve(e.pages.get(n) ?? null),
    loadMath: () => Promise.resolve(null),
    async loadFont(n) {
      const r = await t(n.url);
      if (!r.ok) throw new Error(`字体 HTTP ${r.status}`);
      return r.arrayBuffer();
    }
  };
}
function yh(e) {
  return [...[...new Set(e.map((n) => n.family))].map((n) => `"${n.replace(/"/g, "")}"`), "serif"].join(", ");
}
const Vo = /* @__PURE__ */ new Set();
async function bh(e, t) {
  const n = `${e.family}|${e.weight}|${e.url}`;
  if (Vo.has(n)) return !0;
  for (let r = 0; r < 2; r += 1)
    try {
      const o = new FontFace(e.family, await t(e), { weight: `${e.weight}` });
      return document.fonts.add(await o.load()), Vo.add(n), !0;
    } catch (o) {
      r === 1 && console.warn("[render-layout] 字体没装上：", e.family, e.url, o);
    }
  return !1;
}
async function vh(e, t) {
  var o;
  if (typeof FontFace > "u" || typeof document > "u" || !document.fonts) return !1;
  const n = (o = e[0]) == null ? void 0 : o.family, r = await Promise.all(e.map(async (a) => ({ font: a, ok: await bh(a, t) })));
  return !!n && r.every(({ font: a, ok: s }) => s || a.family !== n);
}
function wh() {
  var e;
  try {
    return new URLSearchParams(((e = globalThis.location) == null ? void 0 : e.search) || "").get("render_layout") || "";
  } catch {
    return "";
  }
}
const Sh = 5e3, kh = 120;
function Th() {
  try {
    const e = no.fetchProtected;
    return {
      apiPrefix: no.apiPrefix,
      fetchProtected: ((t, n) => e(typeof t == "string" ? br(t) : t, n))
    };
  } catch {
    return null;
  }
}
function Ih(e, t) {
  const [n, r] = A({ status: "idle" }), [o, a] = A(0), s = _(wh()).current, i = _(Th()).current;
  O(() => {
    if (!s && (!t || !e || !i)) return;
    let u = !0;
    return r((f) => f.status === "generating" ? f : { status: "loading" }), (async () => {
      let f = null;
      if (s) {
        const g = await fh(s);
        f = g ? gh(g) : null;
      } else {
        const g = await Ko(e, { apiPrefix: i.apiPrefix || "/api/v1", fetcher: i.fetchProtected });
        if (!g.source) {
          u && r((m) => m.status === "generating" ? m : { status: "unavailable", reason: g.reason || "not_kept", generate: g.generate });
          return;
        }
        f = g.source;
      }
      if (!f) {
        u && r({ status: "unavailable", reason: "failed", generate: null });
        return;
      }
      const d = f, h = await vh(d.fonts, (g) => d.loadFont(g));
      if (u) {
        if (!h) {
          console.warn("[render-layout] 版面的字体没有或没装全，HTML 页退回按 OCR 的框塞字"), r({ status: "unavailable", reason: "no_fonts", generate: null });
          return;
        }
        r({ status: "ready", source: d, fontFamily: yh(d.fonts) });
      }
    })().catch((f) => {
      console.warn("[render-layout] 版面没读到：", f), u && r({ status: "unavailable", reason: "failed", generate: null });
    }), () => {
      u = !1;
    };
  }, [s, t, e, i, o]);
  const c = n.status === "unavailable" ? n.generate : null, l = L(() => {
    !c || !i || (r({ status: "generating" }), i.fetchProtected(c.url, {
      method: c.method || "POST",
      headers: { "Content-Type": "application/json" },
      body: c.body == null ? void 0 : JSON.stringify(c.body)
    }).then((u) => {
      if (!u.ok) throw new Error(`补排 HTTP ${u.status}`);
    }).catch((u) => {
      console.warn("[render-layout] 补排没发出去：", u), r({ status: "unavailable", reason: "failed", generate: c });
    }));
  }, [c, i]);
  return O(() => {
    if (n.status !== "generating" || !i) return;
    let u = 0;
    const f = setInterval(() => {
      if (u += 1, u > kh) {
        clearInterval(f), r({ status: "unavailable", reason: "failed", generate: null });
        return;
      }
      Ko(e, { apiPrefix: i.apiPrefix || "/api/v1", fetcher: i.fetchProtected }).then((d) => {
        d.available && (clearInterval(f), r({ status: "loading" }), a((h) => h + 1));
      }).catch(() => {
      });
    }, Sh);
    return () => clearInterval(f);
  }, [n.status, e, i]), { ...n, generateNow: l };
}
const Eh = '"Times New Roman", "Tinos", "Liberation Serif", "Source Han Serif SC", "Noto Serif CJK SC", serif', mn = 1.5;
function Rh(e, t) {
  const n = Ce(e);
  if (n === "formula") {
    const o = `${e.markdown || e.source.text || ""}`.trim();
    return o ? { kind: "display_formula", content: o } : null;
  }
  if (n !== "text") return null;
  const r = t === "translated" ? `${e.translatedBlockText || e.markdown || e.translated.text || ""}`.trim() : `${e.source.text || ""}`.trim();
  return r ? { kind: e.regionType || "text", content: r } : null;
}
function Ph(e) {
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
function Mh({ page: e, width: t, height: n, regions: r, metadata: o, text: a, arrivedAt: s }) {
  const { items: i, scale: c } = U(() => {
    var d;
    const l = [];
    let u = 0;
    const f = [...r].sort((h, g) => (h.readingOrder ?? 0) - (g.readingOrder ?? 0));
    for (const h of f) {
      const g = Rh(h, a);
      if (!g) continue;
      const m = mt(h, o, "source");
      if (!m || m.box.page !== e) continue;
      const y = lt(m, t, n);
      !y || y.width < 2 || y.height < 2 || (!u && ((d = m.pageSize) != null && d.width) && (u = t / m.pageSize.width), l.push({
        order: l.length,
        item: {
          itemId: h.itemId,
          translatedText: g.content,
          status: "html",
          kind: g.kind,
          sourceText: h.source.text || "",
          typography: a === "source" && g.kind !== "display_formula" ? { font_family: Eh } : void 0,
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
      children: /* @__PURE__ */ p(Rr, { item: l, pageScale: c })
    },
    `${l.itemId}:${l.changedAtSeq}`
  )) }) : null;
}
function Cs(e) {
  var r;
  if (!e) return null;
  const t = /<svg([^>]*)>([\s\S]*)<\/svg>/i.exec(e);
  if (!t) return null;
  const n = (r = /viewBox="([^"]+)"/i.exec(t[1])) == null ? void 0 : r[1];
  return n ? { viewBox: n, inner: t[2] } : null;
}
const Ht = /* @__PURE__ */ new Map(), xh = 512;
function qo(e) {
  let t = Ht.get(e);
  if (!t && (t = cc(e, !1).then(Cs), Ht.set(e, t), Ht.size > xh)) {
    const n = Ht.keys().next().value;
    n !== void 0 && Ht.delete(n);
  }
  return t;
}
function Nh(e) {
  var n;
  let t = e.querySelector('g[data-mml-node="math"]');
  for (; t && t.children.length === 1 && ((n = t.firstElementChild) != null && n.hasAttribute("data-mml-node")); ) t = t.firstElementChild;
  return t ? [...t.children] : [];
}
const Jo = "rgb(40, 110, 215)", Ah = () => {
  var e;
  try {
    return ((e = globalThis.matchMedia) == null ? void 0 : e.call(globalThis, "(prefers-reduced-motion: reduce)").matches) ?? !1;
  } catch {
    return !1;
  }
};
function _h(e) {
  if (Ah() || typeof e.animate != "function") return;
  const t = Nh(e), n = Math.min(220, 1200 / Math.max(1, t.length));
  t.forEach((r, o) => {
    var a;
    (a = r.animate) == null || a.call(
      r,
      [{ opacity: 0, transform: "translate(0px, -600px)" }, { opacity: 1, transform: "translate(0px, 0px)" }],
      { duration: 460, delay: o * n, easing: "cubic-bezier(.2, .75, .25, 1)", fill: "backwards" }
    );
  }), e.animate(
    [{ color: Jo }, { color: Jo, offset: 0.75 }, { color: "currentColor" }],
    { duration: t.length * n + 900, easing: "ease-out" }
  );
}
function Lh(e, t, n) {
  return !t || !n ? qo(e) : n(t).then((r) => Cs(r) ?? qo(e));
}
function Ch({ page: e, width: t, height: n, fontFamily: r, arrivedAt: o, charRise: a = !1, loadMath: s, fontByKey: i }) {
  const c = U(() => {
    const m = /* @__PURE__ */ new Map();
    for (const y of e.blocks) for (const v of y.lines) for (const w of v.items) "tex" in w && m.set(w.tex, w.svg);
    return [...m];
  }, [e]), l = U(() => {
    const m = /* @__PURE__ */ new Map();
    for (const y of e.blocks) {
      let v = 0;
      m.set(y.id, y.lines.map((w) => {
        const b = v;
        return v += w.items.length, b;
      }));
    }
    return m;
  }, [e]), [u, f] = A(() => /* @__PURE__ */ new Map());
  O(() => {
    let m = !0;
    return Promise.all(c.map(async ([y, v]) => [y, await Lh(y, v, s)])).then((y) => {
      m && f(new Map(y));
    }), () => {
      m = !1;
    };
  }, [c, s]);
  const d = Date.now() - o < 1500, h = _(null);
  O(() => {
    const m = h.current;
    if (!a || !m || typeof IntersectionObserver > "u") return;
    const y = [...m.querySelectorAll(".reader-layout-block")];
    for (const w of y) w.removeAttribute("data-risen");
    const v = new IntersectionObserver((w) => {
      for (const b of w)
        b.isIntersecting && (b.target.setAttribute("data-risen", ""), v.unobserve(b.target));
    }, { threshold: 0.2 });
    for (const w of y) v.observe(w);
    return () => v.disconnect();
  }, [a, e]);
  const g = (m) => {
    var y;
    `${((y = globalThis.getSelection) == null ? void 0 : y.call(globalThis)) || ""}`.trim() || _h(m.currentTarget);
  };
  return /* @__PURE__ */ C(
    "svg",
    {
      ref: h,
      className: `reader-layout-page${a ? " is-char-rise" : ""}`,
      "data-html-page": e.index + 1,
      viewBox: `0 0 ${e.width} ${e.height}`,
      width: t,
      height: n,
      preserveAspectRatio: "none",
      style: { fontFamily: r },
      children: [
        e.covers.map((m, y) => /* @__PURE__ */ p(
          "rect",
          {
            x: m.rect[0],
            y: m.rect[1],
            width: m.rect[2] - m.rect[0],
            height: m.rect[3] - m.rect[1],
            fill: Uo(m.fill)
          },
          `${m.block}:${y}`
        )),
        e.blocks.map((m, y) => {
          const v = Uo(m.color);
          return /* @__PURE__ */ p(
            "g",
            {
              className: `reader-layout-block${d ? " is-arriving" : ""}`,
              "data-html-block": m.id,
              fill: v,
              fontSize: m.fontSize,
              fontWeight: m.weight === "bold" ? 700 : 400,
              style: { "--reader-html-order": y, color: v },
              children: m.lines.map((w, b) => w.items.map((k, S) => {
                var E;
                const P = `${b}:${S}`, R = (((E = l.get(m.id)) == null ? void 0 : E[b]) ?? 0) + S;
                if ("tex" in k) {
                  const D = u.get(k.tex), x = m.fontSize;
                  return D ? /* @__PURE__ */ p(
                    "svg",
                    {
                      className: "reader-layout-math",
                      x: k.x,
                      y: w.baseline - k.h * x,
                      width: Math.max(0.01, k.w * x),
                      height: Math.max(0.01, (k.h + k.d) * x),
                      viewBox: D.viewBox,
                      preserveAspectRatio: "none",
                      "data-tex": k.tex,
                      "data-baseline": w.baseline,
                      style: { "--i": R },
                      onClick: g,
                      dangerouslySetInnerHTML: { __html: D.inner }
                    },
                    P
                  ) : null;
                }
                return /* @__PURE__ */ p(
                  "text",
                  {
                    x: k.x,
                    y: w.baseline,
                    lang: k.mode === "dflt" ? "en" : "zh-Hans",
                    fontFamily: k.font && (i != null && i.get(k.font)) ? `"${i.get(k.font)}", ${r}` : void 0,
                    style: { "--i": R },
                    children: k.t
                  },
                  P
                );
              }))
            },
            `${m.id}:${o}:${a ? "rise" : ""}`
          );
        })
      ]
    }
  );
}
function $h({ source: e, page: t, width: n, height: r, fontFamily: o, arrivedAt: a, charRise: s, backgroundPdf: i }) {
  var g;
  const [c, l] = A(null), u = e.pages.has(t);
  O(() => {
    if (!u) return;
    let m = !0;
    return e.loadPage(t).then((y) => {
      m && l(y);
    }), () => {
      m = !1;
    };
  }, [e, t, u]);
  const f = U(() => new Map(e.fonts.flatMap((m) => m.key ? [[m.key, m.family]] : [])), [e]), d = U(() => (m) => e.loadMath(m), [e]);
  if (!u || !c) return null;
  const h = ((g = e.background) == null ? void 0 : g.pageFor(t)) ?? null;
  return /* @__PURE__ */ C(Re, { children: [
    i && h ? /* @__PURE__ */ p(xr, { pdf: i, page: h, region: _n, cssWidth: n, className: "reader-layout-background", label: "底图" }) : null,
    /* @__PURE__ */ p(
      Ch,
      {
        page: c,
        width: n,
        height: r,
        fontFamily: o,
        arrivedAt: a,
        charRise: s,
        loadMath: d,
        fontByKey: f
      }
    )
  ] });
}
async function Dh(e, t) {
  ms();
  const n = await vr(br(e), void 0, { signal: t });
  if (!n || t != null && t.aborted) return null;
  const r = At(), o = {
    cMapUrl: r.resolvePdfjsVendorUrl("cmaps/"),
    cMapPacked: !0,
    standardFontDataUrl: r.resolvePdfjsVendorUrl("standard_fonts/"),
    rangeChunkSize: Ts,
    disableAutoFetch: !0
  };
  return await ("ranged" in n ? Sn.getDocument({ ...o, range: Is(n.ranged) }) : Sn.getDocument({ ...o, data: n.data })).promise;
}
const Oh = [
  { value: null, label: "关", hint: "看原来的 PDF" },
  { value: "translated", label: "画译文", hint: "原文页上按 OCR 的框用 HTML 画译文" },
  { value: "source", label: "画原文", hint: "原文页上按 OCR 的框用 HTML 重画原文" }
], Go = {
  no_translated_pdf: "还没有译文 PDF（或正在重新渲染）",
  not_engine_route: "这次的译文是 Typst 排的，没有版面",
  unsupported_render: "这本书的排版设置引擎排不了（双栏对照、字体不是思源宋体）",
  merged_reading: "合并阅读的书没有版面",
  not_kept: "版面没留下来（以前排的书）",
  no_fonts: "版面还没有字体（以前排的书）",
  failed: "版面没要到"
};
function zh() {
  var S;
  const e = $t(), [t, n] = A(null), [r, o] = A(0), [a, s] = A(!1), i = U(() => Ph(e.regions), [e.regions]), c = Ih(e.jobId, t === "translated"), l = c.status === "ready" ? c : null, { generateNow: u } = c, f = c.status === "unavailable" ? c : null, d = c.status === "generating", h = ((S = l == null ? void 0 : l.source.background) == null ? void 0 : S.url) || "", [g, m] = A(null);
  O(() => {
    if (m(null), !h) return;
    const P = new AbortController();
    return Dh(h, P.signal).then((R) => {
      !P.signal.aborted && R && m(R);
    }).catch((R) => {
      P.signal.aborted || console.warn("[html-page] 底图没读到，用原文页做底：", R);
    }), () => P.abort();
  }, [h]);
  const y = !e.sourceOnly, { metadata: v, visibleMode: w, setWorkspace: b } = e, k = U(() => {
    const P = (R) => {
      n(R), o(Date.now()), R && w === "translated" && b("source");
    };
    return {
      toolbarItems: [{
        key: "html-page",
        label: "HTML 页",
        title: t ? `HTML 页：${t === "translated" ? l ? "画译文（照排版引擎的版面）" : "画译文（按识别的框）" : "画原文"}（点开换）` : "HTML 页：把书页用 HTML 画出来",
        Icon: Vi,
        pressed: !!t,
        popup: (R) => /* @__PURE__ */ C("div", { className: "reader-html-page-menu reader-floating-surface", role: "menu", "aria-label": "HTML 页", children: [
          Oh.filter((E) => E.value !== "translated" || y).map((E) => /* @__PURE__ */ p(
            G,
            {
              className: "reader-html-page-choice",
              role: "menuitemradio",
              "aria-checked": t === E.value,
              title: E.hint,
              onClick: () => {
                P(E.value), R();
              },
              children: E.label
            },
            E.label
          )),
          t === "translated" && f ? /* @__PURE__ */ C(Re, { children: [
            /* @__PURE__ */ p("span", { className: "reader-html-page-menu-sep", "aria-hidden": !0 }),
            /* @__PURE__ */ C("p", { className: "reader-html-page-menu-note", children: [
              "现在按识别的框画：",
              Go[f.reason] || Go.not_kept,
              "。"
            ] }),
            f.generate ? /* @__PURE__ */ p(
              G,
              {
                className: "reader-html-page-choice",
                title: "照排版引擎重新排一次版面（不重新翻译、不花钱），排好自动换上，和译文 PDF 一样",
                onClick: () => {
                  u(), R();
                },
                children: "生成 HTML 排版"
              }
            ) : null
          ] }) : null,
          t === "translated" && d ? /* @__PURE__ */ C(Re, { children: [
            /* @__PURE__ */ p("span", { className: "reader-html-page-menu-sep", "aria-hidden": !0 }),
            /* @__PURE__ */ p("p", { className: "reader-html-page-menu-note", children: "正在排版，排好自动换上…" })
          ] }) : null,
          l ? /* @__PURE__ */ C(Re, { children: [
            /* @__PURE__ */ p("span", { className: "reader-html-page-menu-sep", "aria-hidden": !0 }),
            /* @__PURE__ */ p(
              G,
              {
                className: "reader-html-page-choice",
                role: "menuitemcheckbox",
                "aria-checked": a,
                title: "一段话滚进来时，字一个接一个浮上来",
                onClick: () => {
                  s((E) => !E), t || P("translated"), R();
                },
                children: "逐字浮现"
              }
            ),
            /* @__PURE__ */ p("p", { className: "reader-html-page-menu-note", children: "点公式会分步展开" })
          ] }) : null
        ] })
      }],
      pageLayer: t ? ({ page: R, width: E, height: D, pane: x, active: T }) => !T || x !== "source" ? null : t === "translated" && l ? /* @__PURE__ */ p(
        $h,
        {
          source: l.source,
          page: R,
          width: E,
          height: D,
          fontFamily: l.fontFamily,
          arrivedAt: r,
          charRise: a,
          backgroundPdf: g
        }
      ) : /* @__PURE__ */ p(
        Mh,
        {
          page: R,
          width: E,
          height: D,
          regions: i.get(R) ?? [],
          metadata: v,
          text: t,
          arrivedAt: r
        }
      ) : void 0
    };
  }, [t, r, i, v, y, w, b, l, a, f, d, u, g]);
  return an(k), null;
}
const Fh = { id: "html-page", title: "HTML 页", Component: zh }, $s = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], Xo = { pen: 35e-4, highlighter: 0.018 }, Yo = 0.015, or = "retainpdf.reader.ink.v1:";
function Zo(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(or + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function Bh(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(or + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(or + e);
    } catch {
    }
}
function Hh(e, t, n, r, o, a) {
  const s = Yo * Yo;
  return e.filter((i) => Ds(i, t, n) && i.points.some(([c, l]) => (c - r) ** 2 + ((l - o) * a) ** 2 <= s)).map((i) => i.id);
}
function Ds(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function jh(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function Uh(e) {
  const [t, n] = A(null), [r, o] = A($s[0].key), [a, s] = A(() => Zo(e)), i = _(a), c = _([]);
  O(() => {
    const m = Zo(e);
    i.current = m, s(m), c.current = [];
  }, [e]);
  const l = L((m) => {
    i.current = m, s(m), Bh(e, m);
  }, [e]), u = L((m) => {
    const y = i.current, v = m(y);
    v !== y && (c.current = [...c.current.slice(-49), y], l(v));
  }, [l]), f = L((m) => {
    m.points.length < 1 || u((y) => [...y, { ...m, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [u]), d = L((m) => {
    m.length && u((y) => y.filter((v) => !m.includes(v.id)));
  }, [u]), h = L((m) => {
    u((y) => y.some((v) => v.page === m) ? y.filter((v) => v.page !== m) : y);
  }, [u]), g = L(() => {
    const m = c.current.pop();
    m && l(m);
  }, [l]);
  return U(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: d, undo: g, clearPage: h }),
    [t, r, a, f, d, g, h]
  );
}
const Wh = [
  { tool: "pen", label: "画笔", Icon: vn },
  { tool: "highlighter", label: "荧光笔", Icon: qi },
  { tool: "eraser", label: "橡皮", Icon: Ji }
];
function Kh(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Vh({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ C(Re, { children: [
    Wh.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
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
    $s.map((o) => /* @__PURE__ */ p(
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
    /* @__PURE__ */ p(G, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(Gi, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      G,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p(Xi, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
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
function Qo({ ink: e, page: t, onPick: n }) {
  return /* @__PURE__ */ p("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ p(Vh, { ink: e, page: t, onPick: n }) });
}
function qh(e) {
  const t = _(e);
  t.current = e, O(() => {
    const n = (r) => {
      if (Kh(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
const Jh = "reader-ink-layer";
function Gh(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function ea({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: Gh(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function Xh({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = A(null), i = _(!1), c = o.strokes.filter((m) => Ds(m, e, t)), l = !!o.tool;
  if (!l && !c.length) return null;
  const u = (m) => {
    const y = m.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (m.clientX - y.left) / Math.max(1, y.width))),
      Math.min(1, Math.max(0, (m.clientY - y.top) / Math.max(1, y.height)))
    ];
  }, f = (m, y) => o.erase(Hh(o.strokes, e, t, m, y, r / Math.max(1, n))), d = (m) => {
    if (!o.tool || m.button !== 0) return;
    m.preventDefault(), m.stopPropagation(), m.currentTarget.setPointerCapture(m.pointerId), i.current = !0;
    const [y, v] = u(m);
    o.tool === "eraser" ? f(y, v) : s([[y, v]]);
  }, h = (m) => {
    if (!i.current || !o.tool) return;
    m.stopPropagation();
    const [y, v] = u(m);
    o.tool === "eraser" ? f(y, v) : s((w) => w ? jh(w, y, v) : [[y, v]]);
  }, g = (m) => {
    i.current && (i.current = !1, m.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: Xo[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ C(
    "svg",
    {
      className: Jh,
      "data-ink-active": l ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: d,
      onPointerMove: h,
      onPointerUp: g,
      onPointerCancel: g,
      children: [
        c.map((m) => /* @__PURE__ */ p(ea, { stroke: m, width: n, height: r }, m.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(ea, { stroke: { tool: o.tool, color: o.color, width: Xo[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
const Yh = [
  { keys: "P", desc: "进入 / 退出画笔（书页上右键也能选笔和颜色）" },
  { keys: "Esc", desc: "退出画笔" },
  { keys: "⌘Z / Ctrl+Z", desc: "画笔模式下撤销" }
];
function Zh(e) {
  return {
    toolbarItems: [{
      key: "ink",
      label: "画笔",
      title: "画笔（P；书页上右键也能选笔和颜色）",
      Icon: vn,
      // 钢笔图标，右下角一个当前笔色的小点（2026-11-28：两条栏只用图标，单一个圆点认不出是画笔）。
      mark: /* @__PURE__ */ C("span", { className: "reader-ink-mark", "aria-hidden": !0, children: [
        /* @__PURE__ */ p(vn, { ...Me }),
        /* @__PURE__ */ p("span", { className: "reader-ink-dot", style: { background: `var(--${e.color})` } })
      ] }),
      place: "bottom",
      pressed: !!e.tool,
      onClick: () => e.setTool(e.tool ? null : "pen"),
      dropdown: (t) => /* @__PURE__ */ p(Qo, { ink: e, onPick: t })
    }],
    menuSection: ({ page: t, close: n }) => /* @__PURE__ */ p(Qo, { ink: e, page: t, onPick: n }),
    // 离视口远的页只是占位，笔迹先不画（和以前一样只画 active 的页）。
    pageLayer: ({ page: t, pane: n, width: r, height: o, active: a }) => a ? /* @__PURE__ */ p(Xh, { page: t, pane: n, width: r, height: o, ink: e }) : null,
    takesPointer: !!e.tool,
    shortcuts: Yh
  };
}
function Qh() {
  const e = $t(), t = Uh(e.resetKey);
  qh(t);
  const n = U(() => Zh(t), [t]);
  return an(n), null;
}
const ep = { id: "ink", title: "画笔", Component: Qh };
function tp(e) {
  const t = _(!1);
  return e && (t.current = !0), t.current;
}
const np = Aa(() => import("./ReaderMarkdownPanel-D5LrYrMS.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), Os = { id: "markdown", label: "Markdown", short: "MD", Icon: Yi, needsJob: !0 };
function rp() {
  const e = $t(), t = e.activePanel === Os.id;
  if (!tp(t)) return null;
  const r = /* @__PURE__ */ p(Na, { fallback: null, children: /* @__PURE__ */ p(np, { open: t, jobId: e.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: e.closePanel }) });
  return e.panelHost ? dc(r, e.panelHost) : r;
}
const op = {
  id: "markdown",
  title: "Markdown",
  Component: rp,
  panels: [Os]
}, zs = "reader-xref", ar = "data-xref", Kt = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, ap = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${Kt})`), sp = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function sr(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function ip(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function cp(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function lp(e, t, n) {
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
function up(e, t, n) {
  return (e.find((o) => Ce(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function dp(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = Ce(r), s = cp(r);
    if (a === "formula") {
      for (const g of s.matchAll(sp)) {
        const m = sr(g[1]);
        m && n({ key: `equation:${m}`, kind: "equation", label: m, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = ap.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const l = ip(i[1]), u = sr(i[2]), f = lp(e, o, l), d = [...f.map((g) => g.itemId), r.itemId], h = new Map(e.map((g, m) => [g.itemId, m]));
    d.sort((g, m) => (h.get(g) ?? 0) - (h.get(m) ?? 0)), n({ key: `${l}:${u}`, kind: l, label: u, itemId: up(f, r, l), itemIds: d, captionId: r.itemId });
  }), t;
}
const fp = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${Kt})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${Kt})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${Kt})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${Kt})\s*[）)]`, "g"), kind: () => "equation" }
];
function mp(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of fp) {
    o.lastIndex = 0;
    for (const s of e.matchAll(o)) {
      const i = s.length > 2 ? s[1] : "", c = sr(s[s.length - 1]), l = `${a(i)}:${c}`;
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
function hp(e, t) {
  return mp(e, t).map((n) => ({ start: n.start, end: n.end, className: zs, attrs: { [ar]: n.key } }));
}
const pp = { figure: "图", table: "表", equation: "式" };
function ta(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${pp[e.kind]} ${e.label}`;
}
const na = { figure: "图", table: "表", formula: "公式", text: "文字" }, rt = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function gp(e, t, n) {
  const r = mt(e, t, n), o = r ? lt(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = xs({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function yp(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, c = null;
  for (const u of e) {
    const f = mt(u, t, n), d = f ? lt(f, 1, 1) : null;
    !f || !d || (r || (r = f.box.page, c = f.pageSize), f.box.page === r && (o = Math.min(o, d.left), a = Math.min(a, d.top), s = Math.max(s, d.left + d.width), i = Math.max(i, d.top + d.height)));
  }
  if (!r || !c) return null;
  const l = xs({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: l, aspect: l.height * c.height / Math.max(1e-6, l.width * c.width) };
}
function bp(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function vp(e, t) {
  const n = (o) => {
    const a = Ce(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function wp({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var D;
  const i = t.find((x) => x.itemId === e) ?? null, c = U(() => i ? vp(t, i) : [], [t, i]), l = i ? c.indexOf(i) : -1, [u, f] = A(rt.indexOf(1)), d = rt[u], h = _(null), [g, m] = A(0);
  Le(() => {
    const x = h.current;
    if (!x) return;
    const T = () => m(x.clientWidth);
    T();
    const I = typeof ResizeObserver == "function" ? new ResizeObserver(T) : null;
    return I == null || I.observe(x), () => I == null ? void 0 : I.disconnect();
  }, []);
  const y = L((x) => {
    const T = c[l + x];
    T && a(T.itemId);
  }, [c, l, a]);
  O(() => {
    const x = (T) => {
      if (T.key === "Escape")
        T.preventDefault(), s();
      else if (T.key === "ArrowLeft")
        T.preventDefault(), y(-1);
      else if (T.key === "ArrowRight")
        T.preventDefault(), y(1);
      else if (T.key === "+" || T.key === "=")
        T.preventDefault(), f((I) => Math.min(rt.length - 1, I + 1));
      else if (T.key === "-" || T.key === "_")
        T.preventDefault(), f((I) => Math.max(0, I - 1));
      else if (T.key === "0")
        T.preventDefault(), f(rt.indexOf(1));
      else
        return;
      T.stopPropagation();
    };
    return window.addEventListener("keydown", x, !0), () => window.removeEventListener("keydown", x, !0);
  }, [s, y]), O(() => {
    const x = h.current;
    if (!x) return;
    const T = (I) => {
      !I.ctrlKey && !I.metaKey || (I.preventDefault(), f((M) => Math.max(0, Math.min(rt.length - 1, M + (I.deltaY < 0 ? 1 : -1)))));
    };
    return x.addEventListener("wheel", T, { passive: !1 }), () => x.removeEventListener("wheel", T);
  }, []);
  const v = _(null);
  if (!i) return null;
  const w = Ce(i), b = o.map((x) => ({ pane: x, pdf: r[x] ?? null, where: gp(i, n, x) })).filter((x) => !!(x.pdf && x.where)), k = 16, S = typeof window > "u" ? 800 : window.innerHeight, P = Math.min(880, S * 0.9) - 56 - 32 - (b.length > 1 ? 26 : 0), R = b.length ? bp(Math.max(120, (g - k * (b.length - 1) - 32) / b.length), P, b.map((x) => x.where.aspect)) : 0, E = ((D = b[0]) == null ? void 0 : D.where.page) ?? i.source.page;
  return /* @__PURE__ */ C("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${na[w] ?? "这一块"}`, children: [
    /* @__PURE__ */ p("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ C("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ C("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ C("span", { className: "reader-zoom-title", children: [
          na[w] ?? "这一块",
          " · 第 ",
          E,
          " 页"
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-zoom-count", children: l >= 0 ? `${l + 1} / ${c.length}` : "" }),
        /* @__PURE__ */ C("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ p(dt, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: l <= 0, onClick: () => y(-1), children: /* @__PURE__ */ p(Ca, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(dt, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: l < 0 || l >= c.length - 1, onClick: () => y(1), children: /* @__PURE__ */ p(Ha, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(dt, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => f((x) => Math.max(0, x - 1)), children: /* @__PURE__ */ p(ja, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ C(G, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => f(rt.indexOf(1)), children: [
            Math.round(d * 100),
            "%"
          ] }),
          /* @__PURE__ */ p(dt, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === rt.length - 1, onClick: () => f((x) => Math.min(rt.length - 1, x + 1)), children: /* @__PURE__ */ p(Ua, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(dt, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: s, children: /* @__PURE__ */ p(bt, { size: 16, "aria-hidden": !0 }) })
        ] })
      ] }),
      /* @__PURE__ */ p(
        "div",
        {
          ref: h,
          className: "reader-zoom-body",
          onPointerDown: (x) => {
            const T = h.current;
            !T || x.button !== 0 || (v.current = { x: x.clientX, y: x.clientY, left: T.scrollLeft, top: T.scrollTop }, T.setPointerCapture(x.pointerId));
          },
          onPointerMove: (x) => {
            const T = h.current, I = v.current;
            !T || !I || (T.scrollLeft = I.left - (x.clientX - I.x), T.scrollTop = I.top - (x.clientY - I.y));
          },
          onPointerUp: () => {
            v.current = null;
          },
          children: b.length && g ? /* @__PURE__ */ p("div", { className: "reader-zoom-columns", style: { gap: k }, children: b.map(({ pane: x, pdf: T, where: I }) => /* @__PURE__ */ C("figure", { className: "reader-zoom-column", children: [
            b.length > 1 ? /* @__PURE__ */ p("figcaption", { children: x === "source" ? "原文" : "译文" }) : null,
            /* @__PURE__ */ p(
              xr,
              {
                className: "reader-zoom-canvas",
                pdf: T,
                page: I.page,
                region: I.fraction,
                cssWidth: R * d,
                label: `${x === "source" ? "原文" : "译文"}第 ${I.page} 页`
              }
            )
          ] }, x)) }) : /* @__PURE__ */ p("p", { className: "reader-zoom-empty", children: g ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
const Sp = 380, kp = 320, kt = 8;
function Tp(e, t, n) {
  const r = Math.max(kt, Math.min(e.left, n.width - t.width - kt)), o = e.bottom + kt, a = o + t.height <= n.height - kt ? o : Math.max(kt, e.top - kt - t.height);
  return { left: r, top: a };
}
function Ip({
  preview: e,
  regions: t,
  metadata: n,
  documents: r
}) {
  const o = e.target.itemIds.map((d) => t.find((h) => h.itemId === d)).filter((d) => !!d);
  if (!o.length) return null;
  const a = e.pane === "source" ? ["source", "translated"] : ["translated", "source"];
  let s = null;
  for (const d of a) {
    const h = r[d], g = h ? yp(o, n, d) : null;
    if (h && g) {
      s = { pdf: h, where: g };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min(Sp, kp / Math.max(0.05, s.where.aspect))), c = Math.round(i * s.where.aspect) + 30, l = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: f } = Tp(e.anchor, { width: Math.max(i, 160) + 16, height: c + 16 }, l);
  return /* @__PURE__ */ C("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: f }, children: [
    /* @__PURE__ */ C("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ p("span", { children: ta(e.target) }),
      /* @__PURE__ */ C("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ p(xr, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: ta(e.target) })
  ] });
}
const Ep = 250;
function Rp(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function Pp(e, t, n) {
  const r = n === "back" ? e.back : e.forward;
  if (!r.length) return null;
  const o = r[r.length - 1], a = r.slice(0, -1), s = n === "back" ? { back: a, forward: [...e.forward, t] } : { back: [...e.back, t], forward: a };
  return { to: o, history: s };
}
function Mp(e) {
  var n;
  const t = e;
  return !!((n = t == null ? void 0 : t.closest) != null && n.call(t, "input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
function xp({
  shellEl: e,
  index: t,
  primaryPane: n,
  follow: r
}) {
  const [o, a] = A(null), [s, i] = A({ back: [], forward: [] }), c = _(s);
  c.current = s;
  const l = _(null), u = _({ index: t, primaryPane: n, follow: r, shellEl: e });
  u.current = { index: t, primaryPane: n, follow: r, shellEl: e };
  const f = L(() => {
    const { shellEl: h, primaryPane: g } = u.current;
    return qt(h, g);
  }, []);
  O(() => {
    if (!e) return;
    const h = (b) => {
      var k, S;
      return (S = (k = b.target) == null ? void 0 : k.closest) == null ? void 0 : S.call(k, `.${zs}`);
    }, g = () => {
      l.current != null && window.clearTimeout(l.current), l.current = null;
    }, m = (b) => {
      var R;
      const k = h(b);
      if (!k) return;
      const S = u.current.index.get(k.getAttribute(ar) || "");
      if (!S) return;
      const P = ((R = k.closest("[data-reader-pane]")) == null ? void 0 : R.getAttribute("data-reader-pane")) || u.current.primaryPane;
      g(), l.current = window.setTimeout(() => {
        const E = k.getBoundingClientRect();
        a({ target: S, pane: P, anchor: { left: E.left, top: E.top, right: E.right, bottom: E.bottom } });
      }, Ep);
    }, y = (b) => {
      const k = h(b);
      !k || k.contains(b.relatedTarget) || (g(), a(null));
    }, v = (b) => {
      var E, D;
      const k = h(b);
      if (!k || b.button !== 0 || b.metaKey || b.ctrlKey || b.shiftKey || `${((E = window.getSelection) == null ? void 0 : E.call(window)) || ""}`.trim()) return;
      const S = u.current.index.get(k.getAttribute(ar) || "");
      if (!S) return;
      b.preventDefault(), b.stopPropagation(), g(), a(null);
      const P = ((D = k.closest("[data-reader-pane]")) == null ? void 0 : D.getAttribute("data-reader-pane")) || u.current.primaryPane, R = f();
      R && i((x) => Rp(x, R)), u.current.follow(S, P);
    }, w = () => {
      g(), a(null);
    };
    return e.addEventListener("pointerover", m), e.addEventListener("pointerout", y), e.addEventListener("click", v, !0), e.addEventListener("scroll", w, { passive: !0 }), () => {
      g(), e.removeEventListener("pointerover", m), e.removeEventListener("pointerout", y), e.removeEventListener("click", v, !0), e.removeEventListener("scroll", w);
    };
  }, [e, f]);
  const d = L((h) => {
    const g = f();
    if (!g) return !1;
    const m = Pp(c.current, g, h);
    if (!m) return !1;
    const { shellEl: y, primaryPane: v } = u.current;
    return _t(y, m.to, "auto", v) ? (i(m.history), !0) : !1;
  }, [f]);
  return O(() => {
    const h = (g) => {
      if (!g.altKey || g.metaKey || g.ctrlKey || g.shiftKey || g.defaultPrevented || g.key !== "ArrowLeft" && g.key !== "ArrowRight" || Mp(g.target)) return;
      d(g.key === "ArrowLeft" ? "back" : "forward") && g.preventDefault();
    };
    return window.addEventListener("keydown", h), () => window.removeEventListener("keydown", h);
  }, [d]), {
    preview: o,
    closePreview: L(() => a(null), []),
    canGoBack: s.back.length > 0,
    backPage: s.back.length ? s.back[s.back.length - 1].page : null,
    goBack: L(() => d("back"), [d])
  };
}
const Np = [
  { keys: "Alt+←", desc: "点了引用跳过去以后，回到原处" },
  { keys: "Alt+→", desc: "再跳回去" }
];
function Ap() {
  const e = $t(), t = U(() => dp(e.regions), [e.regions]), { jumpToBlock: n } = e, r = L((s, i) => n(s.itemId, i), [n]), o = xp({ shellEl: e.shellEl, index: t, primaryPane: e.primaryPane, follow: r }), a = U(() => ({
    // 书里一个认得出去处的引用都没有，就不改文字层（react-pdf 照原样画，不多一遍 innerHTML）。
    textMarks: t.size ? (s) => hp(s, t) : void 0,
    shortcuts: Np
  }), [t]);
  return an(a), /* @__PURE__ */ C(Re, { children: [
    o.preview ? /* @__PURE__ */ p(Ip, { preview: o.preview, regions: e.regions, metadata: e.metadata, documents: e.pdfDocuments }) : null,
    o.canGoBack ? /* @__PURE__ */ C(G, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => o.goBack(), children: [
      /* @__PURE__ */ p(Zi, { size: 14, "aria-hidden": !0 }),
      " 回到第 ",
      o.backPage,
      " 页"
    ] }) : null
  ] });
}
const _p = { id: "xrefs", title: "引用（「图 2.1」「式 (3.21)」）", Component: Ap }, Nr = [ep, op, uh, _p, th, Fh];
function Ar(e = Nr) {
  return e.flatMap((t) => (t.panels ?? []).map(({ id: n, label: r, short: o, Icon: a, needsJob: s }) => ({ id: n, label: r, short: o, Icon: a, needsJob: s })));
}
function Lp(e) {
  const t = Be(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(Re, { children: (e.tabs ?? Ar()).map(({ id: s, label: i, Icon: c, needsJob: l }) => {
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
        children: /* @__PURE__ */ p(c, { className: "reader-close-home-icon", ...Me, "aria-hidden": !0 })
      },
      s
    );
  }) });
}
function Cp(e) {
  const t = Be(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = Ar().map(({ id: c, label: l, short: u, Icon: f, needsJob: d }) => ({
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
    /* @__PURE__ */ p("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: c, label: l, Icon: u, disabled: f, selected: d, badge: h, onClick: g }) => /* @__PURE__ */ C(
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
          h ? /* @__PURE__ */ p("span", { className: "reader-assistant-dock-badge", children: h }) : null
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
function $p(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Dp(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Op(e) {
  return e / 100 * window.innerHeight;
}
function zp(e) {
  return e / 100 * window.innerWidth;
}
function Fp(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function Vt({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = Fp(n);
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
      r = Dp(t, o);
      break;
    }
    case "em": {
      r = $p(t, o);
      break;
    }
    case "vh": {
      r = Op(o);
      break;
    }
    case "vw": {
      r = zp(o);
      break;
    }
  }
  return r;
}
function _e(e) {
  return parseFloat(e.toFixed(3));
}
function Lt({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function ir(e) {
  const { panels: t } = e, n = Lt({ group: e });
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
      const u = Vt({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = _e(u / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const u = Vt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = _e(u / n * 100);
    }
    let c = 0;
    if (a.minSize !== void 0) {
      const u = Vt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      c = _e(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = Vt({
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
function cr(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? Bp : Hp
  );
}
function Bp(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function Hp(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function Fs(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Bs(e, t) {
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
function jp({
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
    const { x: i, y: c } = Bs(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return he(o, "No rect found"), o;
}
let hn;
function Up() {
  return hn === void 0 && (typeof matchMedia == "function" ? hn = !!matchMedia("(pointer:coarse)").matches : hn = !1), hn;
}
function Hs(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = cr(
    n,
    Array.from(t.children).filter(Fs).map((g) => ({ element: g }))
  ).map(({ element: g }) => g), s = [];
  let i = !1, c = !1, l = -1, u = -1, f = 0, d, h = [];
  {
    let g = -1;
    for (const m of a)
      m.hasAttribute("data-panel") && (g++, m.hasAttribute("data-disabled") || (f++, l === -1 && (l = g), u = g));
  }
  if (f > 1) {
    let g = -1;
    for (const m of a)
      if (m.hasAttribute("data-panel")) {
        g++;
        const y = r.find(
          (v) => v.element === m
        );
        if (y) {
          if (d) {
            const v = d.element.getBoundingClientRect(), w = m.getBoundingClientRect();
            let b;
            if (c) {
              const k = n === "horizontal" ? new DOMRect(
                v.right,
                v.top,
                0,
                v.height
              ) : new DOMRect(
                v.left,
                v.bottom,
                v.width,
                0
              ), S = n === "horizontal" ? new DOMRect(w.left, w.top, 0, w.height) : new DOMRect(w.left, w.top, w.width, 0);
              switch (h.length) {
                case 0: {
                  b = [
                    k,
                    S
                  ];
                  break;
                }
                case 1: {
                  const P = h[0], R = jp({
                    orientation: n,
                    rects: [v, w],
                    targetRect: P.element.getBoundingClientRect()
                  });
                  b = [
                    P,
                    R === v ? S : k
                  ];
                  break;
                }
                default: {
                  b = h;
                  break;
                }
              }
            } else
              h.length ? b = h : b = [
                n === "horizontal" ? new DOMRect(
                  v.right,
                  w.top,
                  w.left - v.right,
                  w.height
                ) : new DOMRect(
                  w.left,
                  v.bottom,
                  w.width,
                  w.top - v.bottom
                )
              ];
            for (const k of b) {
              let S = "width" in k ? k : k.element.getBoundingClientRect();
              const P = Up() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (S.width < P) {
                const E = P - S.width;
                S = new DOMRect(
                  S.x - E / 2,
                  S.y,
                  S.width + E,
                  S.height
                );
              }
              if (S.height < P) {
                const E = P - S.height;
                S = new DOMRect(
                  S.x,
                  S.y - E / 2,
                  S.width,
                  S.height + E
                );
              }
              const R = g <= l || g > u;
              !i && !R && s.push({
                group: e,
                groupSize: Lt({ group: e }),
                panels: [d, y],
                separator: "width" in k ? void 0 : k,
                rect: S
              }), i = !1;
            }
          }
          c = !1, d = y, h = [];
        }
      } else if (m.hasAttribute("data-separator")) {
        m.ariaDisabled !== null && (i = !0);
        const y = o.find(
          (v) => v.element === m
        );
        y ? h.push(y) : (d = void 0, h = []);
      } else
        c = !0;
  }
  return s;
}
var at;
class js {
  constructor() {
    Zr(this, at, {});
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
    Qr(this, at, {});
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
const _r = new js();
function pt() {
  return Mt;
}
function Wp(e) {
  return _r.addListener("change", e);
}
function Kp(e) {
  const t = Mt, n = { ...Mt };
  n.cursorFlags = e, Mt = n, _r.emit("change", {
    prev: t,
    next: n
  });
}
function xt(e) {
  const t = Mt;
  Mt = e, _r.emit("change", {
    prev: t,
    next: e
  });
}
const Vp = (e) => e, Un = () => {
}, Us = 1, Ws = 2, Ks = 4, Vs = 8, ra = 3, oa = 12;
let pn;
function aa() {
  return pn === void 0 && (pn = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (pn = !0)), pn;
}
function qp({
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
        if (e && aa()) {
          const a = (e & Us) !== 0, s = (e & Ws) !== 0, i = (e & Ks) !== 0, c = (e & Vs) !== 0;
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
    return aa() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const sa = /* @__PURE__ */ new WeakMap();
function Lr(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = sa.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = pt();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = qp({
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
  sa.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Ue = /* @__PURE__ */ new Map();
const qs = new js();
function Jp(e) {
  Ue = new Map(Ue), Ue.delete(e);
}
function ia(e, t) {
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
function Cr(e, t) {
  return qs.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Ye(e, t, n) {
  const r = Ue.get(e);
  Ue = new Map(Ue), Ue.set(e, t), qs.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function Js(e) {
  const t = pt();
  let n = !1;
  switch (t.state) {
    case "active":
      xt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (Lr(e), n = !0, t.hitRegions.forEach((r) => {
        const o = it(r.group.id, !0);
        Ye(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function ca(e) {
  e.defaultPrevented || Js(e.currentTarget);
}
function Gp(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Bs(n, a.rect);
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
function Xp(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Yp(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: da(e),
    b: da(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  he(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: ua(la(n.a)),
    b: ua(la(n.b))
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
const Zp = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function Qp(e) {
  const t = getComputedStyle(Gs(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function eg(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || Qp(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || Zp.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function la(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (he(n, "Missing node"), eg(n)) return n;
  }
  return null;
}
function ua(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function da(e) {
  const t = [];
  for (; e; )
    t.push(e), e = Gs(e);
  return t;
}
function Gs(e) {
  const { parentNode: t } = e;
  return Xp(t) ? t.host : t;
}
function tg(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function ng({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!Fs(n) || n.contains(e) || e.contains(n))
    return !0;
  if (Yp(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (tg(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function $r(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = Hs(o), s = Gp(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && ng({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function rg(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function Ne(e, t, n = 0) {
  return Math.abs(_e(e) - _e(t)) <= n;
}
function je(e, t) {
  return Ne(e, t) ? 0 : e > t ? 1 : -1;
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
  if (Ne(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), c = Object.values(o), l = [...i], [u, f] = r;
  he(u != null, "Invalid first pivot index"), he(f != null, "Invalid second pivot index");
  let d = 0;
  switch (a) {
    case "keyboard": {
      {
        const m = e < 0 ? f : u, y = n[m];
        he(
          y,
          `Panel constraints not found for index ${m}`
        );
        const {
          collapsedSize: v = 0,
          collapsible: w,
          minSize: b = 0
        } = y;
        if (w) {
          const k = i[m];
          if (he(
            k != null,
            `Previous layout not found for panel index ${m}`
          ), Ne(k, v)) {
            const S = b - k;
            je(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
          }
        }
      }
      {
        const m = e < 0 ? u : f, y = n[m];
        he(
          y,
          `No panel constraints found for index ${m}`
        );
        const {
          collapsedSize: v = 0,
          collapsible: w,
          minSize: b = 0
        } = y;
        if (w) {
          const k = i[m];
          if (he(
            k != null,
            `Previous layout not found for panel index ${m}`
          ), Ne(k, b)) {
            const S = k - v;
            je(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
          }
        }
      }
      break;
    }
    default: {
      const m = e < 0 ? f : u, y = n[m];
      he(
        y,
        `Panel constraints not found for index ${m}`
      );
      const v = i[m], { collapsible: w, collapsedSize: b, minSize: k } = y;
      if (w && je(v, k) < 0)
        if (e > 0) {
          const S = k - b, P = S / 2, R = v + e;
          je(R, k) < 0 && (e = je(e, P) <= 0 ? 0 : S);
        } else {
          const S = k - b, P = 100 - S / 2, R = v - e;
          je(R, k) < 0 && (e = je(100 + e, P) > 0 ? 0 : -S);
        }
      break;
    }
  }
  {
    const m = e < 0 ? 1 : -1;
    let y = e < 0 ? f : u, v = 0;
    for (; ; ) {
      const b = i[y];
      he(
        b != null,
        `Previous layout not found for panel index ${y}`
      );
      const k = Rt({
        overrideDisabledPanels: s,
        panelConstraints: n[y],
        prevSize: b,
        size: 100
      }) - b;
      if (v += k, y += m, y < 0 || y >= n.length)
        break;
    }
    const w = Math.min(Math.abs(e), Math.abs(v));
    e = e < 0 ? 0 - w : w;
  }
  {
    let m = e < 0 ? u : f;
    for (; m >= 0 && m < n.length; ) {
      const y = Math.abs(e) - Math.abs(d), v = i[m];
      he(
        v != null,
        `Previous layout not found for panel index ${m}`
      );
      const w = v - y, b = Rt({
        overrideDisabledPanels: s,
        panelConstraints: n[m],
        prevSize: v,
        size: w
      });
      if (!Ne(v, b) && (d += v - b, l[m] = b, d.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? m-- : m++;
    }
  }
  if (rg(c, l))
    return o;
  {
    const m = e < 0 ? f : u, y = i[m];
    he(
      y != null,
      `Previous layout not found for panel index ${m}`
    );
    const v = y + d, w = Rt({
      overrideDisabledPanels: s,
      panelConstraints: n[m],
      prevSize: y,
      size: v
    });
    if (l[m] = w, !Ne(w, v)) {
      let b = v - w, k = e < 0 ? f : u;
      for (; k >= 0 && k < n.length; ) {
        const S = l[k];
        he(
          S != null,
          `Previous layout not found for panel index ${k}`
        );
        const P = S + b, R = Rt({
          overrideDisabledPanels: s,
          panelConstraints: n[k],
          prevSize: S,
          size: P
        });
        if (Ne(S, R) || (b -= R - S, l[k] = R), Ne(b, 0))
          break;
        e > 0 ? k-- : k++;
      }
    }
  }
  const h = Object.values(l).reduce(
    (m, y) => y + m,
    0
  );
  if (!Ne(h, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return l.reduce((m, y, v) => (m[g[v]] = y, m), {});
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
  if (!Ne(o, 100) && r.length > 0)
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
  if (!Ne(a, 0))
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      he(c != null, `No layout data found for index ${i}`);
      const l = c + a, u = Rt({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: c,
        size: l
      });
      if (c !== u && (a -= u - c, r[i] = u, Ne(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, c, l) => (i[s[l]] = c, i), {});
}
function Xs({
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
        groupSize: h,
        separatorToPanels: g
      }
    ] of c)
      if (l.id === e)
        return {
          defaultLayoutDeferred: u,
          derivedPanelConstraints: f,
          group: l,
          groupSize: h,
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
    const d = a(), h = l.findIndex((y) => y.id === t), g = h === 0, m = h === l.length - 1;
    if (m && c < d && (g || l.slice(0, h).every((y, v) => {
      const w = f[v];
      return (w == null ? void 0 : w.collapsible) && Ne(w.collapsedSize, u[w.panelId]);
    }))) {
      const y = l.slice(0, h).reduce((v, w) => v + u[w.id], 0);
      return {
        ...u,
        [t]: _e(100 - y)
      };
    }
    return Zt({
      delta: m ? d - c : c - d,
      initialLayout: u,
      panelConstraints: f,
      pivotIndices: m ? [h - 1, h] : [h, h + 1],
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
      groupSize: h,
      layout: g,
      separatorToPanels: m
    } = n(), y = s({
      nextSize: c,
      panels: d.panels,
      prevLayout: g,
      derivedPanelConstraints: f
    }), v = yt({
      layout: y,
      panelConstraints: f
    });
    gt(g, v) || Ye(d, {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: f,
      groupSize: h,
      layout: v,
      separatorToPanels: m
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
        let h = f.expandToSize ?? u;
        h === 0 && (h = 1), i(h);
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
      return c && Ne(l, u);
    },
    resize: (c) => {
      const { group: l } = n(), { element: u } = o(), f = Lt({ group: l }), d = Vt({
        groupSize: f,
        panelElement: u,
        styleProp: c
      }), h = _e(d / f * 100);
      i(h);
    }
  };
}
function fa(e) {
  if (e.defaultPrevented)
    return;
  const t = vt();
  $r(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = Xs({
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
function Ys({
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
  const s = a.map((u) => n.panels.indexOf(u)), i = Ys({ groupId: n.id }).getLayout(), c = Zt({
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
function ma(e) {
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
          (d) => d.element === t
        );
        he(c, "Matching separator not found");
        const l = i.get(c);
        he(l, "Matching panels not found");
        const u = l[0], f = a.find(
          (d) => d.panelId === u.id
        );
        if (he(f, "Panel metadata not found"), f.collapsible) {
          const d = s[u.id], h = f.collapsedSize === d ? r.mutableState.expandedPanelSizes[u.id] ?? f.minSize : f.collapsedSize;
          ut(t, h - d);
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
function ha(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = vt(), n = $r(e, t), r = /* @__PURE__ */ new Map();
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
function Zs({
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
    const { group: u, groupSize: f } = l, { orientation: d, panels: h } = u, { disableCursor: g } = u.mutableState;
    let m = 0;
    a ? d === "horizontal" ? m = (t.clientX - a.x) / f * 100 : m = (t.clientY - a.y) / f * 100 : d === "horizontal" ? m = t.clientX < 0 ? -100 : 100 : m = t.clientY < 0 ? -100 : 100;
    const y = r.get(u), v = o.get(u);
    if (!y || !v)
      return;
    const {
      defaultLayoutDeferred: w,
      derivedPanelConstraints: b,
      groupSize: k,
      layout: S,
      separatorToPanels: P
    } = v;
    if (b && S && P) {
      const R = Zt({
        delta: m,
        initialLayout: y,
        panelConstraints: b,
        pivotIndices: l.panels.map((E) => h.indexOf(E)),
        prevLayout: S,
        trigger: "mouse-or-touch"
      });
      if (gt(R, S)) {
        if (m !== 0 && !g)
          switch (d) {
            case "horizontal": {
              i |= m < 0 ? Us : Ws;
              break;
            }
            case "vertical": {
              i |= m < 0 ? Ks : Vs;
              break;
            }
          }
      } else
        Ye(l.group, {
          defaultLayoutDeferred: w,
          derivedPanelConstraints: b,
          groupSize: k,
          layout: R,
          separatorToPanels: P
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & ra : c |= i & ra, t.movementY === 0 ? c |= s & oa : c |= i & oa, Kp(c), Lr(e);
}
function pa(e) {
  const t = vt(), n = pt();
  switch (n.state) {
    case "active":
      Zs({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function ga(e) {
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
      Zs({
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
      const a = $r(e, n);
      a.length === 0 ? t.state !== "inactive" && xt({
        cursorFlags: 0,
        state: "inactive"
      }) : xt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), Lr(e.currentTarget);
      break;
    }
  }
}
function ya(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (pt().state) {
      case "hover":
        xt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function ba(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || Js(e.currentTarget) && e.preventDefault();
}
function va(e) {
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
function og(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((c) => c.element === t);
  if (!r || !r.onResize)
    return;
  const o = Lt({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: _e(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function ag(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function sg({
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
        const h = d / 100 * n, g = _e(
          h / t * 100
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
function ig(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const Tt = /* @__PURE__ */ new Map();
function cg(e) {
  let t = !0;
  he(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const m of g) {
      const { borderBoxSize: y, target: v } = m;
      if (v === e.element) {
        if (t) {
          const w = Lt({ group: e });
          if (w === 0)
            return;
          const b = it(e.id);
          if (!b)
            return;
          const k = ir(e), S = b.defaultLayoutDeferred ? va(k) : b.layout, P = sg({
            group: e,
            nextGroupSize: w,
            prevGroupSize: b.groupSize,
            prevLayout: S
          }), R = yt({
            layout: P,
            panelConstraints: k
          });
          if (!b.defaultLayoutDeferred && gt(b.layout, R) && ag(
            b.derivedPanelConstraints,
            k
          ) && b.groupSize === w)
            return;
          Ye(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: k,
            groupSize: w,
            layout: R,
            separatorToPanels: b.separatorToPanels
          });
        }
      } else
        og(e, v, y);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    he(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = Lt({ group: e }), i = ir(e), c = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (ig(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[c] ?? l ?? va(i), f = yt({
    layout: u,
    panelConstraints: i
  }), d = e.element.ownerDocument;
  Tt.set(
    d,
    (Tt.get(d) ?? 0) + 1
  );
  const h = /* @__PURE__ */ new Map();
  return Hs(e).forEach((g) => {
    g.separator && h.set(g.separator, g.panels);
  }), Ye(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: h
  }), e.separators.forEach((g) => {
    he(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", ma);
  }), Tt.get(d) === 1 && (d.addEventListener("contextmenu", ca, !0), d.addEventListener("dblclick", fa, !0), d.addEventListener("pointerdown", ha, !0), d.addEventListener("pointerleave", pa), d.addEventListener("pointermove", ga), d.addEventListener("pointerout", ya), d.addEventListener("pointerup", ba, !0)), function() {
    t = !1, Tt.set(
      d,
      Math.max(0, (Tt.get(d) ?? 0) - 1)
    ), Jp(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", ma);
    }), Tt.get(d) || (d.removeEventListener(
      "contextmenu",
      ca,
      !0
    ), d.removeEventListener(
      "dblclick",
      fa,
      !0
    ), d.removeEventListener(
      "pointerdown",
      ha,
      !0
    ), d.removeEventListener("pointerleave", pa), d.removeEventListener("pointermove", ga), d.removeEventListener("pointerout", ya), d.removeEventListener("pointerup", ba, !0)), a.disconnect();
  };
}
function lg() {
  const [e, t] = A({}), n = L(() => t({}), []);
  return [e, n];
}
function Dr(e) {
  const t = _a();
  return `${e ?? t}`;
}
const wt = typeof window < "u" ? Le : O;
function Jt(e) {
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
function Or(...e) {
  return Jt((t) => {
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
function zr(e) {
  const t = _({ ...e });
  return wt(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const Qs = nn(null);
function ug(e, t) {
  const n = _({
    getLayout: () => ({}),
    setLayout: Vp
  });
  pr(t, () => n.current, []), wt(() => {
    Object.assign(
      n.current,
      Ys({ groupId: e })
    );
  });
}
function ei({
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
  ...h
}) {
  const g = _({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), m = Jt((T) => {
    gt(g.current.onLayoutChange, T) || (g.current.onLayoutChange = T, c == null || c(T));
  }), y = Jt(
    (T, I) => {
      gt(g.current.onLayoutChanged, T) || (g.current.onLayoutChanged = T, l == null || l(T, { isUserInteraction: I }));
    }
  ), v = Dr(i), w = _(null), [b, k] = lg(), S = _({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), P = Or(w, a);
  ug(v, s);
  const R = Jt(
    (T, I) => {
      const M = pt(), $ = ia(T), z = it(T);
      if (z) {
        let K = !1;
        switch (M.state) {
          case "active": {
            K = M.hitRegions.some(
              (j) => j.group === $
            );
            break;
          }
        }
        return {
          flexGrow: z.layout[I] ?? 1,
          pointerEvents: K ? "none" : void 0
        };
      }
      if (n != null && n[I])
        return {
          flexGrow: n == null ? void 0 : n[I]
        };
    }
  ), E = zr({
    defaultLayout: n,
    disableCursor: r
  }), D = U(
    () => ({
      get disableCursor() {
        return !!E.disableCursor;
      },
      getPanelStyles: R,
      id: v,
      orientation: u,
      registerPanel: (T) => {
        const I = S.current;
        return I.panels = cr(u, [
          ...I.panels,
          T
        ]), k(), () => {
          I.panels = I.panels.filter(
            (M) => M !== T
          ), k();
        };
      },
      registerSeparator: (T) => {
        const I = S.current;
        return I.separators = cr(u, [
          ...I.separators,
          T
        ]), k(), () => {
          I.separators = I.separators.filter(
            (M) => M !== T
          ), k();
        };
      },
      updatePanelProps: (T, { disabled: I }) => {
        const M = S.current.panels.find(
          (K) => K.id === T
        );
        M && (M.panelConstraints.disabled = I);
        const $ = ia(v), z = it(v);
        $ && z && Ye($, {
          ...z,
          derivedPanelConstraints: ir($)
        });
      },
      updateSeparatorProps: (T, {
        disabled: I,
        disableDoubleClick: M
      }) => {
        const $ = S.current.separators.find(
          (z) => z.id === T
        );
        $ && ($.disabled = I, $.disableDoubleClick = M);
      }
    }),
    [R, v, k, u, E]
  ), x = _(null);
  return wt(() => {
    const T = w.current;
    if (T === null)
      return;
    const I = S.current;
    let M;
    if (E.defaultLayout !== void 0 && Object.keys(E.defaultLayout).length === I.panels.length) {
      M = {};
      for (const q of I.panels) {
        const se = E.defaultLayout[q.id];
        se !== void 0 && (M[q.id] = se);
      }
    }
    const $ = {
      disabled: !!o,
      element: T,
      id: v,
      mutableState: {
        defaultLayout: M,
        disableCursor: !!E.disableCursor,
        expandedPanelSizes: S.current.lastExpandedPanelSizes,
        layouts: S.current.layouts
      },
      orientation: u,
      panels: I.panels,
      resizeTargetMinimumSize: I.resizeTargetMinimumSize,
      separators: I.separators
    };
    x.current = $;
    const z = cg($), { defaultLayoutDeferred: K, derivedPanelConstraints: j, layout: J } = it($.id, !0);
    !K && j.length > 0 && (m(J), y(J, !1));
    const oe = Cr(v, (q) => {
      const { defaultLayoutDeferred: se, derivedPanelConstraints: Ee, layout: re } = q.next;
      if (se || Ee.length === 0)
        return;
      const ue = $.panels.map(({ id: ie }) => ie).join(",");
      $.mutableState.layouts[ue] = re, Ee.forEach((ie) => {
        if (ie.collapsible) {
          const { layout: le } = q.prev ?? {};
          if (le) {
            const B = Ne(
              ie.collapsedSize,
              re[ie.panelId]
            ), W = Ne(
              ie.collapsedSize,
              le[ie.panelId]
            );
            B && !W && ($.mutableState.expandedPanelSizes[ie.panelId] = le[ie.panelId]);
          }
        }
      });
      const xe = pt().state !== "active";
      m(re), xe && y(re, q.isUserInteraction);
    });
    return () => {
      x.current = null, z(), oe();
    };
  }, [
    o,
    v,
    y,
    m,
    u,
    b,
    E
  ]), O(() => {
    const T = x.current;
    T && (T.mutableState.defaultLayout = n, T.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(Qs.Provider, { value: D, children: /* @__PURE__ */ p(
    "div",
    {
      ...h,
      className: t,
      "data-group": !0,
      "data-testid": v,
      id: v,
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
ei.displayName = "Group";
function Fr() {
  const e = ft(Qs);
  return he(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function dg(e, t) {
  const { id: n } = Fr(), r = _({
    collapse: Un,
    expand: Un,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Un
  });
  pr(t, () => r.current, []), wt(() => {
    Object.assign(
      r.current,
      Xs({ groupId: n, panelId: e })
    );
  });
}
function lr({
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
  style: h,
  ...g
}) {
  const m = !!c, y = Dr(c), v = zr({
    disabled: a
  }), w = _(null), b = Or(w, s), {
    getPanelStyles: k,
    id: S,
    orientation: P,
    registerPanel: R,
    updatePanelProps: E
  } = Fr(), D = f !== null, x = Jt(
    ($, z, K) => {
      f == null || f($, c, K);
    }
  );
  wt(() => {
    const $ = w.current;
    if ($ !== null) {
      const z = {
        element: $,
        id: y,
        idIsStable: m,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: D ? x : void 0,
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
      return R(z);
    }
  }, [
    i,
    n,
    r,
    o,
    D,
    y,
    m,
    l,
    u,
    x,
    R,
    v
  ]), O(() => {
    E(y, { disabled: a });
  }, [a, y, E]), dg(y, d);
  const T = () => {
    const $ = k(S, y);
    if ($)
      return JSON.stringify($);
  }, I = xn(
    ($) => Cr(S, $),
    T,
    T
  );
  let M;
  return I ? M = JSON.parse(I) : o !== void 0 ? M = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : M = { flexGrow: 1 }, /* @__PURE__ */ p(
    "div",
    {
      ...g,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": y,
      id: y,
      ref: b,
      style: {
        ...fg,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...M
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
            ...h,
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
lr.displayName = "Panel";
const fg = {
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
function mg({
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
function ti({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const c = Dr(a), l = zr({
    disabled: n,
    disableDoubleClick: r
  }), [u, f] = A({}), [d, h] = A("inactive"), [g, m] = A(!1), y = _(null), v = Or(y, o), {
    disableCursor: w,
    id: b,
    orientation: k,
    registerSeparator: S,
    updateSeparatorProps: P
  } = Fr(), R = k === "horizontal" ? "vertical" : "horizontal";
  wt(() => {
    const x = y.current;
    if (x !== null) {
      const T = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: x,
        id: c
      }, I = S(T), M = Wp(
        (z) => {
          h(
            z.next.state !== "inactive" && z.next.hitRegions.some(
              (K) => K.separator === T
            ) ? z.next.state : "inactive"
          );
        }
      ), $ = Cr(
        b,
        (z) => {
          const { derivedPanelConstraints: K, layout: j, separatorToPanels: J } = z.next, oe = J.get(T);
          if (oe) {
            const q = oe[0], se = oe.indexOf(q);
            f(
              mg({
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
        M(), $(), I();
      };
    }
  }, [b, c, S, l]), O(() => {
    P(c, { disabled: n, disableDoubleClick: r });
  }, [n, r, c, P]);
  let E;
  n && !w && (E = "not-allowed");
  let D;
  if (n)
    D = "disabled";
  else
    switch (d) {
      case "active": {
        D = "active";
        break;
      }
      default:
        g ? D = "focus" : D = d;
    }
  return /* @__PURE__ */ p(
    "div",
    {
      ...i,
      "aria-controls": u.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": R,
      "aria-valuemax": u.valueMax,
      "aria-valuemin": u.valueMin,
      "aria-valuenow": u.valueNow,
      children: e,
      className: t,
      "data-separator": D,
      "data-testid": c,
      id: c,
      onBlur: () => m(!1),
      onFocus: () => m(!0),
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
ti.displayName = "Separator";
const Br = 30, Hr = 65, Qt = 50, hg = 100 - Hr, pg = 100 - Br;
function gg(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(Hr, Math.max(Br, t)) : Qt;
}
function jr(e) {
  return 100 - e;
}
function It(e) {
  return `${e}%`;
}
const Ur = "reader-document", en = "reader-assistant", ni = "retainpdf.reader.ai-split-layout.v1", yg = {
  [Ur]: jr(Qt),
  [en]: Qt
};
function Wr(e) {
  const t = gg(e == null ? void 0 : e[en]);
  return {
    [Ur]: jr(t),
    [en]: t
  };
}
function bg() {
  try {
    const e = JSON.parse(localStorage.getItem(ni) || "null");
    return Wr(e);
  } catch {
    return yg;
  }
}
function vg(e) {
  try {
    localStorage.setItem(ni, JSON.stringify(Wr(e)));
  } catch {
  }
}
function Wn(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Wr(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[en]}vw`
  );
}
function wg() {
  const e = _(null), [t] = A(bg);
  Le(() => {
    const o = e.current;
    return Wn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = L((o) => {
    Wn(e.current, o);
  }, []), r = L((o, a) => {
    Wn(e.current, o), a.isUserInteraction && vg(o);
  }, []);
  return /* @__PURE__ */ C(
    ei,
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
          lr,
          {
            id: Ur,
            defaultSize: It(jr(Qt)),
            minSize: It(hg),
            maxSize: It(pg)
          }
        ),
        /* @__PURE__ */ p(
          ti,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ p("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ p(
          lr,
          {
            id: en,
            defaultSize: It(Qt),
            minSize: It(Br),
            maxSize: It(Hr)
          }
        )
      ]
    }
  );
}
function Sg({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = A(!1);
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
function kg({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(Sg, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ C(Re, { children: [
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
function Tg(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Ig() {
  const [e, t] = A(!1), n = _a(), r = _(null), o = Ms(), a = U(() => [...Mu, ...rm(o)], [o]);
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
      if (i.defaultPrevented || i.metaKey || i.ctrlKey || i.altKey || Tg(i.target)) return;
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
        children: /* @__PURE__ */ p(Qi, { ...Me, "aria-hidden": !0 })
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
const Eg = ["source", "sideBySide", "translated"], Rg = { source: "", translated: "", sideBySide: "" };
function Pg(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = bn(e.sourceUrl), n = bn(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return wc({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function Mg(e) {
  const [t, n] = A(() => /* @__PURE__ */ new Set()), r = U(
    () => e ? Pg(e) : Rg,
    [e]
  ), o = U(
    () => Eg.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = L(async (s) => {
    if (!e) return;
    const i = bn(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? vc(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await Sc(
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
        kc(l), n((u) => {
          const f = new Set(u);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const xg = {
  source: Oa,
  sideBySide: za,
  translated: Fa
}, Ng = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function Ag(e) {
  const t = Be(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Mg(n), i = _(null);
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
      /* @__PURE__ */ p(ec, { ...Me, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = ki[c], u = bn(r[c]), f = a.has(c), d = !!u && !f, h = d ? "" : Ti(c, r), g = xg[c];
      return /* @__PURE__ */ C(
        "button",
        {
          type: "button",
          id: `reader-download-${c}`,
          className: `reader-download-action${f ? " is-busy" : ""}`,
          disabled: !d,
          "aria-label": d ? `下载${l.label}` : h,
          onClick: () => {
            i.current && (i.current.open = !1), s(c);
          },
          children: [
            /* @__PURE__ */ p(g, { ...Me, "aria-hidden": !0 }),
            /* @__PURE__ */ C("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ C("span", { className: "reader-download-action-label", children: [
                Ng[c],
                " PDF"
              ] }),
              h ? /* @__PURE__ */ p("span", { className: "reader-download-action-reason", children: h }) : null
            ] })
          ]
        },
        c
      );
    }) })
  ] });
}
const _g = "retainpdf:reader:bookmarks:v1:", Lg = 200;
function Kr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function ri(e) {
  const t = `${e || ""}`.trim();
  return t ? `${_g}${t}` : "";
}
function Cg(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Gt(e, t = Kr()) {
  const n = ri(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = Cg(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
const ur = /* @__PURE__ */ new Set();
function $g(e, t) {
  const n = (r) => {
    r === e && t();
  };
  return ur.add(n), () => {
    ur.delete(n);
  };
}
function dr(e, t, n) {
  const r = ri(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, Lg);
  if (r && n)
    try {
      n.setItem(r, JSON.stringify(o));
    } catch {
    }
  for (const a of [...ur]) a(e);
  return o;
}
function Dg(e, t, n = "", { storage: r = Kr(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Gt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? dr(e, a.filter((i) => i.page !== s), r) : dr(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Og(e, t, n = Kr()) {
  return dr(e, Gt(e, n).filter((r) => r.page !== t), n);
}
function zg(e, t) {
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
function oi(e, t) {
  const [n, r] = A(() => Gt(e));
  O(() => (r(Gt(e)), $g(e, () => r(Gt(e)))), [e]);
  const o = L((s) => {
    r(Dg(e, s, zg(t, s)));
  }, [e, t]), a = L((s) => r(Og(e, s)), [e]);
  return { bookmarks: n, toggle: o, remove: a };
}
const Fg = "retainpdf:reader:favorites:v1:", Bg = 500, Vr = 2e3;
function qr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function ai(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Fg}${t}` : "";
}
function Hg(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page)), r = `${t.text || ""}`.trim().slice(0, Vr), o = `${t.id || ""}`.trim();
  return !o || !r || !Number.isFinite(n) || n < 1 ? null : { id: o, text: r, page: n, pane: t.pane === "translated" ? "translated" : "source", createdAt: `${t.createdAt || ""}` };
}
function Nt(e, t = qr()) {
  const n = ai(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Set(), a = [];
    for (const s of Array.isArray(r) ? r : []) {
      const i = Hg(s);
      i && !o.has(i.id) && (o.add(i.id), a.push(i));
    }
    return a;
  } catch {
    return [];
  }
}
const fr = /* @__PURE__ */ new Set();
function jg(e, t) {
  const n = (r) => {
    r === e && t();
  };
  return fr.add(n), () => {
    fr.delete(n);
  };
}
function si(e, t, n) {
  const r = ai(e), o = t.slice(0, Bg);
  if (r && n)
    try {
      n.setItem(r, JSON.stringify(o));
    } catch {
    }
  for (const a of [...fr]) a(e);
  return o;
}
function Jr(e, t, n) {
  const r = `${t || ""}`.trim().slice(0, Vr);
  return e.find((o) => o.page === n && o.text === r) ?? null;
}
function ii(e, t, { storage: n = qr(), now: r = () => (/* @__PURE__ */ new Date()).toISOString(), makeId: o = Wg } = {}) {
  const a = Nt(e, n), s = `${t.text || ""}`.trim().slice(0, Vr), i = Math.floor(Number(t.page));
  return !s || !Number.isFinite(i) || i < 1 || Jr(a, s, i) ? a : si(e, [{ id: o(), text: s, page: i, pane: t.pane === "translated" ? "translated" : "source", createdAt: r() }, ...a], n);
}
function Ug(e, t, n = qr()) {
  return si(e, Nt(e, n).filter((r) => r.id !== t), n);
}
function Wg() {
  var e;
  try {
    if ((e = globalThis.crypto) != null && e.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
function ci(e) {
  const [t, n] = A(() => Nt(e));
  O(() => (n(Nt(e)), jg(e, () => n(Nt(e)))), [e]);
  const r = L(
    (a) => n(ii(e, a)),
    [e]
  ), o = L((a) => n(Ug(e, a)), [e]);
  return { favorites: t, add: r, remove: o };
}
function Kg({ filled: e }) {
  return /* @__PURE__ */ p(tc, { ...Me, fill: e ? "currentColor" : "none", "aria-hidden": !0 });
}
function Vg({ scope: e, currentPage: t, numPages: n, regions: r }) {
  const { bookmarks: o, toggle: a } = oi(e, r);
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
        children: /* @__PURE__ */ p(Kg, { filled: i })
      }
    ),
    /* @__PURE__ */ p(qg, { scope: e })
  ] });
}
function qg({ scope: e }) {
  var c;
  const [t, n] = A(!1), r = _(null), { favorites: o, remove: a } = ci(e), s = (c = Be()) == null ? void 0 : c.goToPage;
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
      G,
      {
        className: "reader-react-hud-btn reader-favorites-toggle",
        "aria-expanded": t,
        "aria-haspopup": "dialog",
        "aria-label": i ? `收藏（${i} 段）` : "收藏",
        title: i ? `收藏的段落（${i} 段）` : "收藏：书页上选一段字，点浮条上的「收藏」",
        onClick: () => n((l) => !l),
        children: /* @__PURE__ */ p(Wa, { ...Me, fill: i ? "currentColor" : "none", "aria-hidden": !0 })
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
function Jg(e) {
  const t = Be(), n = Pr(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? on, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = cl(a), f = a > Ya + 1e-3, d = a < Rn - 1e-3, h = Et(r, Pt()), g = h >= Rn ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", [m, y] = A(!1), [v, w] = A(`${i}`);
  O(() => {
    m || w(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, m]);
  const b = () => {
    if (y(!1), !l || c <= 0)
      return;
    const k = Number(`${v}`.trim());
    l(Pn(k, c));
  };
  return /* @__PURE__ */ C("footer", { className: "reader-bottombar", "data-reader-hud": "true", children: [
    /* @__PURE__ */ C("div", { className: "reader-bottombar-start", children: [
      e.startSlot,
      e.bookmarkScope ? /* @__PURE__ */ p(
        Vg,
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
      /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "页码", children: m ? /* @__PURE__ */ C(
        "form",
        {
          className: "reader-react-hud-page-form",
          onSubmit: (k) => {
            k.preventDefault(), b();
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
                onChange: (k) => w(k.target.value.replace(/[^\d]/g, "")),
                onBlur: b,
                onKeyDown: (k) => {
                  k.key === "Escape" && (k.preventDefault(), y(!1), w(`${i}`));
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
            !l || c <= 0 || (w(`${i}`), y(!0));
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
          children: /* @__PURE__ */ p(nc, { ...Me, "aria-hidden": !0 })
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
            children: /* @__PURE__ */ p(ja, { ...Me, "aria-hidden": !0 })
          }
        ),
        /* @__PURE__ */ C(
          "button",
          {
            type: "button",
            className: "reader-react-hud-btn reader-react-hud-zoom-label",
            "aria-label": `${u}%，点击${g}`,
            title: g,
            onClick: () => s(h),
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
            children: /* @__PURE__ */ p(Ua, { ...Me, "aria-hidden": !0 })
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ C("div", { className: "reader-bottombar-end", children: [
      e.toolsSlot,
      /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(Ig, {}) })
    ] })
  ] });
}
function wa(e) {
  var t, n;
  return ns(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function Gg(e) {
  const [t, n] = A(() => ({
    scope: e,
    panel: wa(We(e))
  }));
  O(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: wa(We(e))
    });
  }, [e]), O(() => {
    t.scope === e && Nn(t.scope, {
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
const mr = "download-toast";
function Xg({
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
function Yg(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    Vn.dismiss(mr);
    return;
  }
  Vn.custom(
    () => /* @__PURE__ */ p(Xg, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: mr, duration: 1 / 0 }
  );
}
function Zg() {
  const e = L((t) => {
    t && (t.setState = Yg, t.hide = () => Vn.dismiss(mr));
  }, []);
  return /* @__PURE__ */ C(Re, { children: [
    /* @__PURE__ */ p(Ci, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
const Sa = { itemId: null, origin: null };
function Qg() {
  let e = Sa;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? Sa : { itemId: n, origin: r };
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
const ka = ["ask"];
function ey(e) {
  const t = (n) => {
    const r = ka.indexOf(n.id);
    return r < 0 ? ka.length : r;
  };
  return [...e].sort((n, r) => t(n) - t(r));
}
function hr({
  place: e,
  active: t = null,
  extensions: n = Nr
}) {
  const r = e === "side" ? ey(n) : n, [o, a] = A(null), s = Ms(), i = (d) => {
    var h;
    return (((h = s.find((g) => g.id === d)) == null ? void 0 : h.contribution.toolbarItems) ?? []).filter((g) => (g.place ?? "side") === e);
  }, c = () => a(null), l = (() => {
    if (!o) return null;
    for (const { id: d } of r)
      for (const h of i(d)) {
        if (`${d}:${h.key}:popup` === o && h.popup) return h.popup(c);
        if (`${d}:${h.key}:dropdown` === o && h.dropdown) return h.dropdown(c);
      }
    return null;
  })(), u = _(null);
  O(() => {
    if (!o) return;
    const d = (g) => {
      var m;
      (m = u.current) != null && m.contains(g.target) || c();
    }, h = (g) => {
      g.key === "Escape" && c();
    };
    return document.addEventListener("pointerdown", d, !0), document.addEventListener("keydown", h), () => {
      document.removeEventListener("pointerdown", d, !0), document.removeEventListener("keydown", h);
    };
  }, [o]);
  const f = r.map((d) => {
    const h = i(d.id), g = e === "side" ? Ar([d]) : [];
    return !h.length && !g.length ? null : /* @__PURE__ */ C(Mn, { children: [
      h.map((m) => {
        const y = `${d.id}:${m.key}`, v = m.Icon;
        return /* @__PURE__ */ C("span", { className: "reader-bar-tool-group", "data-has-dropdown": m.dropdown ? "true" : void 0, children: [
          /* @__PURE__ */ p(
            G,
            {
              className: e === "compare" ? "reader-bar-tool reader-bar-tool-compare" : "reader-bar-tool",
              "aria-label": m.label,
              title: m.title || m.label,
              "aria-pressed": !!m.pressed || o === `${y}:popup`,
              "aria-expanded": m.popup ? o === `${y}:popup` : void 0,
              "data-bar-tool": m.key,
              onClick: () => {
                var w;
                if (m.popup) {
                  a((b) => b === `${y}:popup` ? null : `${y}:popup`);
                  return;
                }
                (w = m.onClick) == null || w.call(m), c();
              },
              children: e === "compare" ? /* @__PURE__ */ p(wn, { ...go, "aria-hidden": !0 }) : m.mark ?? /* @__PURE__ */ p(v, { ...Me, "aria-hidden": !0 })
            }
          ),
          m.dropdown ? /* @__PURE__ */ p(
            G,
            {
              className: "reader-bar-tool-caret",
              "aria-label": `${m.label}：选项`,
              title: `${m.label}的选项`,
              "aria-expanded": o === `${y}:dropdown`,
              "data-bar-tool-caret": m.key,
              onClick: () => a((w) => w === `${y}:dropdown` ? null : `${y}:dropdown`),
              children: /* @__PURE__ */ p(wn, { ...go, "aria-hidden": !0 })
            }
          ) : null
        ] }, y);
      }),
      g.length ? /* @__PURE__ */ p(Lp, { active: t, tabs: g }) : null
    ] }, d.id);
  }).filter(Boolean);
  return f.length ? /* @__PURE__ */ C("div", { className: `reader-bar-tools is-${e}`, ref: u, role: "group", "aria-label": e === "side" ? "面板" : e === "compare" ? "对比版本" : "书页工具", children: [
    f,
    l ? /* @__PURE__ */ p("div", { className: "reader-bar-tools-popup", children: l }) : null
  ] }) : null;
}
const Ta = { search: "搜索", bookmarks: "书签", issues: "待改" }, ty = [];
function ny({
  open: e,
  onToggle: t,
  issueCount: n = 0,
  children: r
}) {
  const o = `在全文搜索，书签${n ? `、待改 ${n} 处` : ""}（⌘F）`;
  return /* @__PURE__ */ C("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ C(G, { className: "reader-finder-toggle", "aria-label": "左栏：搜索、书签、待改", "aria-pressed": !!e, title: o, onClick: t, children: [
      /* @__PURE__ */ p(Ka, { ...Me, "aria-hidden": !0 }),
      n ? /* @__PURE__ */ p("span", { className: "reader-finder-toggle-count", "aria-label": `待改 ${n} 处`, children: n }) : null
    ] }),
    r
  ] });
}
function ry({
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
  var R;
  const d = ((R = Be()) == null ? void 0 : R.regions) ?? ty, h = U(() => nd(d, s), [d, s]), [g, m] = A(-1);
  O(() => m(-1), [s]);
  const y = _(null), v = _(null), w = _(n);
  w.current = n, O(() => {
    if (c) return;
    const E = (x) => {
      var I, M;
      const T = x.target;
      !T || (I = v.current) != null && I.contains(T) || (M = T.closest) != null && M.call(T, ".reader-finder-toggles, [data-finder-toggle]") || w.current();
    }, D = (x) => {
      x.key === "Escape" && w.current();
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
    var E, D, x;
    e === "search" && g >= 0 && ((x = (D = (E = b.current) == null ? void 0 : E.querySelector('[aria-current="true"]')) == null ? void 0 : D.scrollIntoView) == null || x.call(D, { block: "nearest" }));
  }, [e, g]);
  const k = (E) => {
    const D = h[E];
    D && (m(E), r(D.itemId));
  }, S = ["search", ...l ? ["bookmarks"] : [], ...u ? ["issues"] : []], P = S.includes(e) ? e : "search";
  return /* @__PURE__ */ C("aside", { ref: v, className: "reader-finder", "data-finder-tab": P, "data-pinned": c ? "true" : void 0, "aria-label": `左栏：${Ta[P]}`, children: [
    /* @__PURE__ */ C("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ p("div", { className: "reader-finder-tabs", role: "tablist", children: S.map((E) => /* @__PURE__ */ C(G, { className: "reader-finder-tab", role: "tab", "aria-selected": P === E, onClick: () => t(E), children: [
        Ta[E],
        E === "issues" && f ? /* @__PURE__ */ p("span", { className: "reader-finder-tab-count", children: f }) : null
      ] }, E)) }),
      /* @__PURE__ */ p(G, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(bt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    P === "bookmarks" ? l : P === "issues" ? u : null,
    P !== "search" ? null : /* @__PURE__ */ C(Re, { children: [
      /* @__PURE__ */ C("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          yr,
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
              E.key === "Enter" ? (E.preventDefault(), k(rd(g, h.length, E.shiftKey))) : E.key === "Escape" && (E.preventDefault(), c ? E.currentTarget.blur() : n()), E.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: h.length === 0 ? "没有找到" : `${g >= 0 ? `第 ${g + 1} / ` : ""}${h.length >= 200 ? "200+ 处，只列前 200 处" : `${h.length} 处`}${g < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { ref: b, className: "reader-finder-list", children: h.map((E, D) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ C(G, { className: "reader-finder-entry is-hit", "aria-current": D === g ? "true" : void 0, onClick: () => k(D), children: [
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
function li(e, t = []) {
  for (const n of e)
    t.push(n), li(n.children, t);
  return t;
}
const oy = 24, jt = 28, Ia = 15;
function ui(e) {
  return e.reduce((t, n) => t + 1 + n.children.length, 0);
}
function ay(e, t) {
  if (e.length)
    return (e.length === 1 && e[0].children.length ? e[0].children : e).map((o) => ({
      id: o.id,
      title: o.title,
      page: o.page,
      depth: 1,
      children: li(o.children).map((a) => ({ id: a.id, title: a.title, page: a.page, depth: a.level - o.level + 1 }))
    }));
  const n = [];
  for (const r of t) {
    const o = { id: r.itemId, title: r.text, page: r.page, itemId: r.itemId }, a = n[n.length - 1];
    r.level > 1 && a ? a.children.push({ ...o, depth: 2 }) : n.push({ ...o, depth: 1, children: [] });
  }
  return n;
}
function sy(e, t) {
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
function iy(e, t) {
  const n = ui(e) > oy, r = Math.max(1, Math.ceil(e.length / jt)), o = [];
  if (e.forEach((i, c) => {
    const l = i.id === t.chapterId;
    if (!(c % r !== 0 && !l) && (o.push({ id: i.id, kind: "h1", state: i.id === t.nodeId ? "current" : l ? "chapter" : "" }), !(n && !l)))
      for (const u of i.children)
        u.depth > 2 && !l || o.push({ id: u.id, kind: "h2", state: u.id === t.nodeId ? "current" : "" });
  }), o.length <= jt) return o;
  const a = Math.max(0, o.findIndex((i) => i.state === "current")), s = Math.min(Math.max(0, a - Math.floor(jt / 2)), o.length - jt);
  return o.slice(s, s + jt);
}
function cy(e, t) {
  const n = t.trim().toLowerCase();
  if (!n) return [...e];
  const r = [];
  for (const o of e) {
    const a = o.title.toLowerCase().includes(n), s = o.children.filter((i) => i.title.toLowerCase().includes(n));
    a ? r.push(o) : s.length && r.push({ ...o, children: s });
  }
  return r;
}
const ly = [];
function Ea({ bookmarks: e, onJumpPage: t, onJumpBlock: n, pinned: r = !1, docked: o = !1, onPinChange: a }) {
  var x, T;
  const s = ((x = Be()) == null ? void 0 : x.regions) ?? ly, i = ((T = Pr()) == null ? void 0 : T.currentPage) ?? 1, c = U(() => ay(e, Qu(s)), [e, s]), l = U(() => sy(c, i), [c, i]), u = U(() => iy(c, l), [c, l]), f = ui(c), [d, h] = A(""), g = U(() => cy(c, d), [c, d]), [m, y] = A(() => /* @__PURE__ */ new Set()), v = _(null), w = _(!1), b = () => {
    l.chapterId && !m.has(l.chapterId) && y((I) => new Set(I).add(l.chapterId)), w.current = !0;
  };
  if (O(() => {
    (r || o) && b();
  }, [r, o]), Le(() => {
    var I, M, $;
    w.current && (w.current = !1, ($ = (M = (I = v.current) == null ? void 0 : I.querySelector('[aria-current="location"]')) == null ? void 0 : M.scrollIntoView) == null || $.call(M, { block: "center" }));
  }), !c.length) return null;
  const k = (I) => y((M) => {
    const $ = new Set(M);
    return $.has(I) ? $.delete(I) : $.add(I), $;
  }), S = (I, M) => {
    y(($) => $.has(M) ? $ : new Set($).add(M)), I.itemId ? n(I.itemId) : I.page !== null && t(I.page);
  }, P = !!d.trim(), R = (I, M) => /* @__PURE__ */ C(
    G,
    {
      className: "reader-toc-entry",
      "data-depth": Math.min(I.depth, 3),
      "aria-current": I.id === l.nodeId ? "location" : void 0,
      disabled: !I.itemId && I.page === null,
      title: I.page === null ? "这条书签没有指到页" : `${I.title}（第 ${I.page} 页）`,
      onClick: () => S(I, M),
      children: [
        /* @__PURE__ */ p("span", { className: "reader-toc-title", children: I.title }),
        I.page !== null ? /* @__PURE__ */ C("span", { className: "reader-toc-page", children: [
          "p.",
          I.page
        ] }) : null
      ]
    }
  ), E = r ? "取消固定" : "固定在左边", D = /* @__PURE__ */ C(Re, { children: [
    /* @__PURE__ */ C("div", { className: "reader-toc-head", children: [
      /* @__PURE__ */ p("span", { className: "reader-toc-head-title", children: "目录" }),
      /* @__PURE__ */ p(G, { className: "reader-toc-pin", "aria-label": E, title: E, "aria-pressed": r, onClick: () => a == null ? void 0 : a(!r), children: r ? /* @__PURE__ */ p(rc, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }) : /* @__PURE__ */ p(Da, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }) })
    ] }),
    f > Ia ? /* @__PURE__ */ C("div", { className: "reader-toc-filter", children: [
      /* @__PURE__ */ p(Ka, { size: 13, "aria-hidden": !0 }),
      /* @__PURE__ */ p(
        yr,
        {
          size: "sm",
          className: "reader-toc-filter-input",
          value: d,
          placeholder: "过滤章节标题或节号…",
          "aria-label": "过滤目录",
          onChange: (I) => h(I.target.value),
          onKeyDown: (I) => {
            I.stopPropagation(), I.key === "Escape" && (d ? h("") : (I.currentTarget.blur(), r && !o && (a == null || a(!1))));
          }
        }
      ),
      d ? /* @__PURE__ */ p(G, { className: "reader-toc-filter-clear", "aria-label": "清掉", onClick: () => h(""), children: /* @__PURE__ */ p(bt, { size: 12, "aria-hidden": !0 }) }) : null
    ] }) : null,
    /* @__PURE__ */ p("div", { className: "reader-toc-list", ref: v, children: g.length ? g.map((I) => {
      const M = P || m.has(I.id);
      return /* @__PURE__ */ C("div", { className: "reader-toc-chapter", children: [
        /* @__PURE__ */ C("div", { className: "reader-toc-chapter-row", children: [
          I.children.length ? /* @__PURE__ */ p(
            G,
            {
              className: "reader-toc-caret",
              "aria-expanded": M,
              "aria-label": `${M ? "收起" : "展开"}「${I.title}」`,
              onClick: () => k(I.id),
              children: M ? /* @__PURE__ */ p(wn, { size: 12, "aria-hidden": !0 }) : /* @__PURE__ */ p(Ha, { size: 12, "aria-hidden": !0 })
            }
          ) : /* @__PURE__ */ p("span", { className: "reader-toc-caret-space" }),
          R(I, I.id)
        ] }),
        M ? I.children.map(($) => /* @__PURE__ */ p("div", { children: R($, I.id) }, $.id)) : null
      ] }, I.id);
    }) : /* @__PURE__ */ p("p", { className: "reader-toc-empty", children: "没有匹配的章节" }) })
  ] });
  return o ? /* @__PURE__ */ p("nav", { className: "reader-toc-dock", "aria-label": "目录", children: D }) : /* @__PURE__ */ C(
    "nav",
    {
      className: "reader-toc-minimap",
      "aria-label": "目录",
      "data-pinned": r ? "true" : void 0,
      onPointerEnter: r ? void 0 : b,
      onKeyDown: (I) => {
        r && I.key === "Escape" && (a == null || a(!1));
      },
      onFocus: (I) => {
        !r && !I.currentTarget.contains(I.relatedTarget) && b();
      },
      children: [
        /* @__PURE__ */ p("div", { className: "reader-toc-bars", tabIndex: 0, "aria-label": `目录，${f} 条（移上去或按 Tab 展开）`, children: u.map((I) => /* @__PURE__ */ p("span", { className: "reader-toc-bar", "data-kind": I.kind, "data-state": I.state || void 0, "aria-hidden": !0 }, I.id)) }),
        /* @__PURE__ */ p("div", { className: "reader-toc-card", "data-compact": f <= Ia ? "true" : void 0, children: D })
      ]
    }
  );
}
function uy({ active: e }) {
  return /* @__PURE__ */ C("div", { className: "reader-side-rail", role: "toolbar", "aria-orientation": "vertical", "aria-label": "面板和下载", children: [
    /* @__PURE__ */ p(hr, { place: "side", active: e }),
    /* @__PURE__ */ p("span", { className: "reader-side-rail-sep", "aria-hidden": !0 }),
    /* @__PURE__ */ p(Ag, {})
  ] });
}
const dy = ".textLayer", Ra = 8, fy = 34, my = 56;
function hy(e) {
  return e ? e.nodeType === 1 ? e : e.parentElement : null;
}
function yn(e = ((t) => (t = globalThis.getSelection) == null ? void 0 : t.call(globalThis))() ?? null) {
  if (!e || e.isCollapsed || !e.rangeCount) return null;
  const n = e.getRangeAt(0), r = Im(n);
  if (!r) return null;
  const o = _s(e);
  if (!o) return null;
  const a = r.closest(`[${Ie}]`);
  return {
    text: o,
    page: Math.max(1, Number(a == null ? void 0 : a.getAttribute(Ie)) || 1),
    pane: (a == null ? void 0 : a.getAttribute(Se)) === "translated" ? "translated" : "source",
    layer: r
  };
}
async function di(e) {
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
const fi = typeof navigator < "u" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
function py(e) {
  const t = yn();
  if (!t) return [];
  const n = [{ key: "copy", label: "复制", hint: fi ? "⌘C" : "Ctrl+C", onSelect: () => {
    di(t.text);
  } }];
  if (e) {
    const r = Jr(Nt(e), t.text, t.page);
    n.push({
      key: "favorite",
      label: r ? "已收藏（在左下角「收藏」里）" : "收藏这段",
      onSelect: () => {
        ii(e, t);
      }
    });
  }
  return n;
}
function gy(e) {
  return [...e.querySelectorAll("span")].filter((t) => !t.classList.contains("markedContent") && !t.querySelector("span"));
}
function yy(e) {
  let t = 0, n = null;
  return e.map((r) => {
    const o = r.getBoundingClientRect(), a = o.top + o.height / 2;
    return n && Math.abs(a - n.center) > Math.max(o.height, n.height) / 2 && (t += 1), n = { center: a, height: o.height || (n == null ? void 0 : n.height) || 0 }, { text: r.textContent || "", line: t };
  });
}
function by(e) {
  const t = [], n = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
  for (let r = n.nextNode(); r; r = n.nextNode()) t.push(r);
  return t;
}
function Pa(e, t) {
  const n = hy(e), r = n == null ? void 0 : n.closest(dy), o = n == null ? void 0 : n.closest("span");
  if (!r || !o) return null;
  const a = gy(r), s = a.indexOf(o);
  if (s < 0) return null;
  const i = Math.max(0, s - 60), c = a.slice(i, Math.min(a.length, s + 61)), l = Sm(yy(c), s - i);
  if (!l) return null;
  const u = by(c[t === "start" ? l[0] : l[1]]);
  return u.length ? t === "start" ? { node: u[0], offset: 0 } : { node: u[u.length - 1], offset: u[u.length - 1].length } : null;
}
function vy(e) {
  if (!e || e.isCollapsed || !e.rangeCount) return !1;
  const t = e.getRangeAt(0), n = Pa(t.startContainer, "start"), r = Pa(t.endContainer, "end");
  if (!n && !r) return !1;
  const o = t.cloneRange();
  return n && t.comparePoint(n.node, n.offset) <= 0 && o.setStart(n.node, n.offset), r && t.comparePoint(r.node, r.offset) >= 0 && o.setEnd(r.node, r.offset), o.compareBoundaryPoints(Range.START_TO_START, t) === 0 && o.compareBoundaryPoints(Range.END_TO_END, t) === 0 ? !1 : (e.removeAllRanges(), e.addRange(o), !0);
}
function wy(e) {
  var i;
  if (!e || e.isCollapsed || !e.rangeCount) return [];
  const t = e.getRangeAt(0), n = t.commonAncestorContainer, r = n.nodeType === 3 ? [n] : (() => {
    const c = [], l = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
    for (let u = l.nextNode(); u; u = l.nextNode()) t.intersectsNode(u) && c.push(u);
    return c;
  })(), o = [], a = /* @__PURE__ */ new Map();
  for (const c of r) {
    const l = (i = c.parentElement) == null ? void 0 : i.closest(tr);
    if (!l) continue;
    const u = l.closest(`.${rn}`) ?? l;
    let f = a.get(u);
    f || (f = u.getBoundingClientRect(), a.set(u, f));
    const d = document.createRange();
    if (d.selectNodeContents(c), c === t.startContainer && d.setStart(c, t.startOffset), c === t.endContainer && d.setEnd(c, t.endOffset), !!d.toString().trim())
      for (const h of d.getClientRects()) {
        const g = Math.max(h.left, f.left), m = Math.min(h.right, f.right);
        m - g > 0.5 && o.push({ left: g, top: h.top, right: m, bottom: h.bottom });
      }
  }
  const s = n.nodeType === 1 ? n : n.parentElement;
  for (const c of (s == null ? void 0 : s.querySelectorAll(".reader-layout-page svg.reader-layout-math")) ?? []) {
    if (!t.intersectsNode(c)) continue;
    const l = c.getBoundingClientRect();
    l.width > 0.5 && o.push({ left: l.left, top: l.top, right: l.right, bottom: l.bottom });
  }
  return km(o);
}
function Sy({ scope: e, menuItemsAt: t }) {
  const n = _(null), r = _(!1), o = _(!1), a = _(0), s = _(t);
  s.current = t;
  const [i, c] = A(null), l = _(null), u = L(() => {
    var P;
    a.current = 0;
    const d = n.current;
    if (!d) return;
    const h = ((P = globalThis.getSelection) == null ? void 0 : P.call(globalThis)) ?? null, g = wy(h), m = d.getBoundingClientRect();
    for (; d.children.length > g.length; ) d.lastElementChild.remove();
    if (g.forEach((R, E) => {
      const D = d.children[E] ?? d.appendChild(document.createElement("div"));
      D.className = "reader-selection-band", D.style.left = `${R.left - m.left}px`, D.style.top = `${R.top - m.top}px`, D.style.width = `${R.right - R.left}px`, D.style.height = `${R.bottom - R.top}px`;
    }), !r.current) return;
    const y = yn(h);
    if (!y || !g.length) {
      r.current = !1, c(null);
      return;
    }
    const v = g[0], w = g[g.length - 1], b = (Math.min(...g.map((R) => R.left)) + Math.max(...g.map((R) => R.right))) / 2 - m.left, k = v.top - m.top - Ra - fy, S = k >= my ? k : w.bottom - m.top + Ra;
    c((R) => {
      var T;
      const E = R && R.text === y.text ? R.actions : s.current({
        target: y.layer,
        clientX: (v.left + v.right) / 2,
        clientY: (v.top + v.bottom) / 2,
        page: y.page
      }).filter((I) => I.inSelectionBar), D = ((T = l.current) == null ? void 0 : T.offsetWidth) || 220, x = Math.min(Math.max(b, D / 2 + 8), m.width - D / 2 - 8);
      return R && R.text === y.text && Math.abs(R.left - x) < 0.5 && Math.abs(R.top - S) < 0.5 ? R : { left: x, top: S, text: y.text, page: y.page, pane: y.pane, actions: E };
    });
  }, []), f = L(() => {
    a.current || (a.current = requestAnimationFrame(u));
  }, [u]);
  return O(() => {
    const d = n.current, h = d == null ? void 0 : d.parentElement, g = d == null ? void 0 : d.closest(`.${qa}`);
    if (!d || !h) return;
    const m = () => {
      g && delete g.dataset.selectPane;
    }, y = (k) => {
      var R, E, D;
      const S = k.target;
      if (S && ((R = l.current) != null && R.contains(S))) return;
      r.current = !1, c(null);
      const P = (D = (E = S == null ? void 0 : S.closest) == null ? void 0 : E.call(S, `[${Ie}][${Se}]`)) == null ? void 0 : D.getAttribute(Se);
      o.current = !!P && k.button === 0, g && P && k.button === 0 && (g.dataset.selectPane = P);
    }, v = (k) => {
      var R;
      m();
      const S = o.current;
      if (o.current = !1, k.button !== 0 || !S) return;
      const P = ((R = globalThis.getSelection) == null ? void 0 : R.call(globalThis)) ?? null;
      yn(P) && (vy(P), r.current = !0, f());
    }, w = (k) => {
      const S = yn();
      !S || !k.clipboardData || (k.clipboardData.setData("text/plain", S.text), k.preventDefault());
    }, b = (k) => {
      k.key === "Escape" && r.current && (r.current = !1, c(null));
    };
    return h.addEventListener("pointerdown", y, !0), window.addEventListener("pointerup", v), window.addEventListener("pointercancel", m), document.addEventListener("selectionchange", f), document.addEventListener("copy", w), document.addEventListener("keydown", b), h.addEventListener("scroll", f, { capture: !0, passive: !0 }), window.addEventListener("resize", f), () => {
      m(), a.current && cancelAnimationFrame(a.current), h.removeEventListener("pointerdown", y, !0), window.removeEventListener("pointerup", v), window.removeEventListener("pointercancel", m), document.removeEventListener("selectionchange", f), document.removeEventListener("copy", w), document.removeEventListener("keydown", b), h.removeEventListener("scroll", f, { capture: !0 }), window.removeEventListener("resize", f);
    };
  }, [f]), /* @__PURE__ */ C(Re, { children: [
    /* @__PURE__ */ p("div", { className: "reader-selection-paint", ref: n, "aria-hidden": "true" }),
    i ? /* @__PURE__ */ p(
      ky,
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
function ky({ bar: e, scope: t, onDone: n, ref: r }) {
  const { favorites: o, add: a } = ci(t), s = !!t && !!Jr(o, e.text, e.page), [i, c] = A(!1);
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
            title: fi ? "复制（⌘C）" : "复制（Ctrl+C）",
            onClick: () => {
              di(e.text).then((l) => c(l));
            },
            children: [
              i ? /* @__PURE__ */ p(gr, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }) : /* @__PURE__ */ p($a, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }),
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
              /* @__PURE__ */ p(Wa, { size: 14, strokeWidth: 1.75, fill: s ? "currentColor" : "none", "aria-hidden": !0 }),
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
              /* @__PURE__ */ p(Ba, { size: 14, strokeWidth: 1.75, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { children: l.inSelectionBar })
            ]
          },
          l.key
        ))
      ]
    }
  );
}
function Ty(e) {
  const [t, n] = A([]);
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
function Iy(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const Ey = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, Ry = ["failed", "content", "layout"];
function Py(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function My(e, t, n) {
  const r = Ty(e), [o, a] = A(-1);
  O(() => a(-1), [r]);
  const s = L((c) => {
    const l = r[c];
    !l || !n || (a(c), n(l.readerItemId));
  }, [r, n]), i = _({ issues: r, last: o, currentPage: t, goTo: s });
  return i.current = { issues: r, last: o, currentPage: t, goTo: s }, O(() => {
    const c = (l) => {
      if (l.key.toLowerCase() !== "n" || l.metaKey || l.ctrlKey || l.altKey || Py(l.target)) return;
      const { issues: u, last: f, currentPage: d, goTo: h } = i.current, g = Iy(u, f, d, l.shiftKey);
      g < 0 || (l.preventDefault(), h(g));
    };
    return document.addEventListener("keydown", c), () => document.removeEventListener("keydown", c);
  }, []), { issues: r, last: o, goTo: s };
}
function xy(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Ny(e) {
  var r;
  if (e.shiftKey || xy(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${Ga}`))) return null;
  const n = Number((r = t.closest(`[${Ie}]`)) == null ? void 0 : r.getAttribute(Ie)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Ay({
  menu: e,
  onClose: t,
  actions: n,
  sections: r
}) {
  const o = _(null);
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
    r.map((c) => /* @__PURE__ */ p(Mn, { children: c.render({ page: e.page, close: t }) }, c.id))
  ] });
}
function _y({ edit: e }) {
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
const mi = "retainpdf:reader:doc-theme:v1", Ma = "data-reader-doc";
function hi() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Ly(e = hi()) {
  try {
    return (e == null ? void 0 : e.getItem(mi)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function Cy(e, t = hi()) {
  try {
    t == null || t.setItem(mi, e);
  } catch {
  }
}
function xa(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(Ma, "dark") : t.removeAttribute(Ma));
}
function $y() {
  const [e, t] = A(() => Ly());
  O(() => {
    xa(e);
  }, [e]), O(() => () => xa("light"), []);
  const n = L(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return Cy(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
function Dy({ scope: e, regions: t, currentPage: n, numPages: r, onJumpPage: o }) {
  const { bookmarks: a, remove: s } = oi(e, t);
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
function Oy({ nav: e }) {
  const { issues: t, last: n, goTo: r } = e;
  return /* @__PURE__ */ C("div", { className: "reader-issues", children: [
    /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
    Ry.map((o) => {
      const a = t.map((s, i) => ({ issue: s, index: i })).filter(({ issue: s }) => s.kind === o);
      return a.length ? /* @__PURE__ */ C("section", { className: "reader-issues-group", "data-issue-kind": o, children: [
        /* @__PURE__ */ C("h4", { children: [
          Ey[o],
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
function zy({ state: e, bookmarkScope: t, issues: n }) {
  const { finder: r, setFinder: o, findQuery: a, setFindQuery: s, findTerm: i, findFocus: c, jumpFromFinder: l, jumpToPageFromFinder: u, pinned: f } = e, d = Be(), h = Pr(), g = (h == null ? void 0 : h.currentPage) ?? 1, m = n.issues.length;
  return /* @__PURE__ */ p(Re, { children: r ? /* @__PURE__ */ p(
    ry,
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
        Dy,
        {
          scope: t,
          regions: d == null ? void 0 : d.regions,
          currentPage: g,
          numPages: (h == null ? void 0 : h.numPages) ?? 0,
          onJumpPage: u
        }
      ) : void 0,
      issuesPane: m ? /* @__PURE__ */ p(Oy, { nav: n }) : void 0,
      issueCount: m
    }
  ) : null });
}
function Fy({
  session: e,
  zoomDocuments: t,
  zoomItem: n,
  setZoomItem: r,
  closeZoom: o,
  visiblePdfMode: a
}) {
  return /* @__PURE__ */ p(Re, { children: n ? /* @__PURE__ */ p(
    wp,
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
function By(e) {
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
const Hy = 720;
function jy(e, t) {
  return !t || !Number.isFinite(e) || e <= 0 ? !0 : e >= Hy;
}
function Uy(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function Wy(e, t, n = !0) {
  const { sessionFiles: r } = e, [o, a] = A(!1), s = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, i = By({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: s,
    liveTranslationVisible: o,
    assistantOpen: t,
    compareFits: n
  }), c = mu({
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
  const f = _(null);
  return O(() => {
    f.current !== e.viewStateKey && gu({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: l,
      jobTerminal: e.session.jobTerminal
    }) && (f.current = e.viewStateKey, a(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, l]), { liveTranslationVisible: o, setLiveTranslationVisible: a, paneComposition: i, liveToggles: c, sourceViewOnly: l, visiblePdfMode: u };
}
function Ky(e, { liveTranslationVisible: t, setLiveTranslationVisible: n, liveToggles: r, sourceViewOnly: o, visiblePdfMode: a }) {
  const s = hu(e.liveTranslation), i = L(() => {
    s && e.goToPage(s, "source");
  }, [e.goToPage, s]), [c, l] = A(null);
  O(() => {
    a === "compare" && e.session.jobTerminal && l(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, a]);
  const u = c !== e.viewStateKey && yu({
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
function Vy() {
  const [e] = A(Xf), t = sm(e), n = tm(t);
  return { contributionStore: e, contributions: t, reserveRight: n };
}
function qy(e, t, n) {
  const r = _(e);
  O(() => {
    const o = e > 0 && r.current <= 0;
    r.current = e, o && t && n();
  }, [e]);
}
function Jy(e, t, {
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
  const { session: h, panes: g } = e, m = _(e.currentPage);
  m.current = e.currentPage;
  const y = L(() => m.current, []), v = U(() => ({
    documentId: h.documentId || "",
    jobId: h.jobId,
    versionId: n.readingVersionId || null,
    translationVersions: n.versions,
    regions: h.regions,
    metadata: h.readerMetadata,
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
    h.documentId,
    h.jobId,
    n,
    h.regions,
    h.readerMetadata,
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
  ]), { contributionStore: w, contributions: b, reserveRight: k } = t, S = U(() => Yf(b), [b]), P = U(() => nm(b), [b]), R = U(() => em(b), [b]), E = U(() => Zf(b), [b]), D = Qf(b);
  return { readerApi: v, contributionStore: w, contributions: b, pageLayers: S, compareVersion: P, textMarks: R, menuSections: E, pointerTakenId: D, reserveRight: k };
}
function Gy() {
  try {
    return Ze().translationEdit ?? null;
  } catch {
    return null;
  }
}
const Xy = "这本书正在处理（翻译或排版），处理完才能改。", Yy = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function Zy({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = Gy(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = sd(s), l = !t || Xt(t), u = fd(n), [f, d] = A(""), [h, g] = A(null), [m, y] = A(() => /* @__PURE__ */ new Map()), [v, w] = A(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [b, k] = A(() => /* @__PURE__ */ new Map()), [S, P] = A({ phase: "idle" }), R = _({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  O(() => {
    g(null), R.drafts.clear(), R.generation.current = null, k(/* @__PURE__ */ new Map()), P({ phase: "idle" });
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
      z || y(md(K, u));
    }).catch(() => {
    }), () => {
      z = !0;
    };
  }, [a, f, u, l]);
  const E = S.phase === "running" && S.seenActive;
  O(() => {
    if (S.phase === "running") {
      if (!l) {
        E || P({ phase: "running", seenActive: !0 });
        return;
      }
      E && P(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [S.phase, E, l, t]);
  const D = U(() => {
    const z = new Map(m);
    if (v.renderedAt === u)
      for (const [K, j] of v.edits) z.set(K, j);
    return z;
  }, [m, v, u]), x = L((z) => {
    const K = `${z || ""}`.trim();
    K && g({ itemId: K, page: id(K) });
  }, []), T = L(() => g(null), []), I = L((z, K) => {
    w((j) => {
      const J = new Map(j.renderedAt === u ? j.edits : []);
      return J.set(z, K), { renderedAt: u, edits: J };
    }), k((j) => new Map(j).set(z, (j.get(z) || 0) + 1));
  }, [u]), M = L(async () => {
    if (!(!a || !s || S.phase === "submitting" || S.phase === "running")) {
      P({ phase: "submitting" });
      try {
        await a.rerender(s), P({ phase: "running", seenActive: !1 }), await o();
      } catch (z) {
        P({ phase: "failed", message: (z == null ? void 0 : z.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, S.phase, o]), $ = c ? Yy : !l || S.phase === "running" || S.phase === "submitting" ? Xy : "";
  return U(() => ({
    available: i,
    blockedReason: $,
    port: a,
    ownerJobId: f,
    target: h,
    select: x,
    close: T,
    memory: R,
    pendingEdits: D,
    savedCounts: b,
    markSaved: I,
    rerender: S,
    startRerender: M
  }), [i, $, a, f, h, x, T, R, D, b, I, S, M]);
}
function Qy(e, t) {
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
function eb(e, t, n) {
  const { session: r, sessionFiles: o } = e, a = Zy({
    jobId: r.jobId,
    jobStatus: r.jobStatus,
    jobPayload: r.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!o.translatedUrl,
    refreshJobStatus: r.refreshJobStatus
  }), s = a.select, i = e.setModeKeepingPage, c = r.regions, l = a.memory.drafts, u = L((d, h) => {
    ps(c, d) && (t === "source" && i("compare"), h != null && h.trim() && l.set(d, h), s(d));
  }, [c, s, t, i, l]);
  Qy(a.available ? u : null, n);
  const f = U(() => {
    if (!a.savedCounts.size) return e.revisedBlocks;
    const d = new Map(e.revisedBlocks);
    for (const [h, g] of a.savedCounts) d.set(h, (d.get(h) || 0) + g);
    return d;
  }, [e.revisedBlocks, a.savedCounts]);
  return { blockEdit: a, editBlock: u, revisedBlocks: f };
}
const tb = "reader-finder-input";
function nb(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function rb(e, t = typeof window > "u" ? null : window) {
  O(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!nb(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(tb) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
const pi = "retainpdf.reader.sidebar.v1", ob = ["search", "bookmarks", "issues"], ab = 900;
function sb() {
  var e;
  try {
    const t = JSON.parse(((e = globalThis.localStorage) == null ? void 0 : e.getItem(pi)) || "{}");
    return { tab: ob.includes(t == null ? void 0 : t.tab) ? t.tab : "search" };
  } catch {
    return { tab: "search" };
  }
}
function ib(e) {
  var t;
  try {
    (t = globalThis.localStorage) == null || t.setItem(pi, JSON.stringify(e));
  } catch {
  }
}
function cb() {
  const e = `(min-width: ${ab}px)`, [t, n] = A(() => typeof window > "u" || !window.matchMedia ? !0 : window.matchMedia(e).matches);
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
function lb(e) {
  const [t] = A(sb), [n, r] = A(null), [o, a] = A(t.tab), i = cb(), c = L((S) => {
    r(S), S && a(S);
  }, []);
  O(() => {
    ib({ tab: n || o });
  }, [n, o]);
  const l = L(() => r((S) => S ? null : o), [o]), u = L((S) => {
    r((P) => P === S ? null : S), a(S);
  }, []), [f, d] = A(""), [h, g] = A("");
  O(() => {
    const S = f.replace(/\s+/gu, " ").trim(), P = window.setTimeout(() => g(S), S ? 150 : 0);
    return () => window.clearTimeout(P);
  }, [f]);
  const [m, y] = A(0), v = L(() => {
    c("search"), y((S) => S + 1);
  }, [c]);
  rb(v);
  const w = L(() => {
    i || r(null);
  }, [i]), b = L((S) => {
    e.jumpToAnchor({ block_id: S }), w();
  }, [e.jumpToAnchor, w]), k = L((S) => {
    e.goToPage(S), w();
  }, [e.goToPage, w]);
  return {
    finder: n,
    setFinder: c,
    toggleFinder: u,
    toggleSidebar: l,
    pinned: i,
    findQuery: f,
    setFindQuery: d,
    findTerm: h,
    findFocus: m,
    jumpFromFinder: b,
    jumpToPageFromFinder: k
  };
}
function ub(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : Qa(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function db(e, t) {
  return t === null || e !== t;
}
function fb(e, t) {
  const { boot: n } = e, r = _(null), o = _(null);
  O(() => {
    if (!(n.loading || n.failed)) {
      if (r.current !== e.viewStateKey) {
        r.current = e.viewStateKey;
        const a = We(e.viewStateKey), s = ub({
          savedMode: a == null ? void 0 : a.mode,
          sourceViewOnly: t,
          viewportWidth: Pt()
        });
        o.current = s.auto ? s.mode : null, s.mode && s.mode !== e.mode && e.setModeKeepingPage(s.mode);
        return;
      }
      db(e.mode, o.current) && (o.current = null, Nn(e.viewStateKey, { mode: e.mode }));
    }
  }, [n.failed, n.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, t]);
}
const mb = [];
function hb(e) {
  const { sessionFiles: t } = e, [n, r] = A({}), o = _({ source: t.sourceUrl, translated: t.translatedUrl });
  o.current = { source: t.sourceUrl, translated: t.translatedUrl };
  const a = L((y, v) => {
    r((w) => ({ ...w, [v]: { url: o.current[v], nodes: y } }));
  }, []), s = U(() => {
    const y = n.source;
    if (y && y.url === t.sourceUrl && y.nodes.length) return y.nodes;
    const v = n.translated;
    return v && v.url === t.translatedUrl && v.nodes.length ? v.nodes : mb;
  }, [n, t.sourceUrl, t.translatedUrl]), i = _({}), [c, l] = A(0), u = L((y, v) => {
    i.current[v] = { url: o.current[v], pdf: y }, l((w) => w + 1);
  }, []), [f, d] = A(null), h = L((y) => d(y), []), g = L(() => d(null), []);
  O(() => d(null), [e.viewStateKey]);
  const m = U(() => {
    const y = (v, w) => {
      const b = i.current[v];
      return b && b.url === w ? b.pdf : null;
    };
    return { source: y("source", t.sourceUrl), translated: y("translated", t.translatedUrl) };
  }, [c, t.sourceUrl, t.translatedUrl]);
  return { bookmarks: s, onPdfOutline: a, onPdfDocument: u, zoomItem: f, setZoomItem: d, zoomBlock: h, closeZoom: g, zoomDocuments: m };
}
function pb() {
  const e = Ru(), { boot: t, panes: n, session: r } = e, o = Gg(e.viewStateKey), a = o.panel, s = o.setPanel, i = a !== null, c = Vy(), { reserveRight: l } = c, u = i || l > 0, f = lb(e), { finder: d, findTerm: h } = f, g = !!d && f.pinned, [m, y] = A(!1), v = m && f.pinned, w = L(() => {
    s(null);
  }, []);
  qy(l, a, w);
  const { liveTranslationVisible: b, setLiveTranslationVisible: k, paneComposition: S, liveToggles: P, sourceViewOnly: R, visiblePdfMode: E } = Wy(
    e,
    i,
    jy(e.shell.shellWidth, u || g || v)
  );
  fb(e, R);
  const D = a || (e.mode === "compare" ? "compare" : "reading"), { docDark: x, toggleDocDark: T } = $y();
  Lu({
    toggleDocDark: T,
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
  const { latestLivePage: I, jumpToLatestLivePage: M, offerCompletion: $, setCompletionDismissedKey: z, sourcePaneAction: K } = Ky(e, {
    liveTranslationVisible: b,
    setLiveTranslationVisible: k,
    liveToggles: P,
    sourceViewOnly: R,
    visiblePdfMode: E
  }), j = L((be) => {
    const F = Uy(be, e.liveTranslationAvailable);
    F !== null && k(F), e.setModeKeepingPage(be);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), J = L((be) => {
    s(be);
  }, []), [oe] = A(Qg), q = L((be) => e.jumpToAnchor({ block_id: be }), [e.jumpToAnchor]), se = My(e.sourceOnly ? "" : r.jobId, e.currentPage, q), [Ee, re] = A(null), ue = L((be, F) => e.jumpToAnchor({ block_id: be }, F), [e.jumpToAnchor]), { bookmarks: xe, onPdfOutline: ie, onPdfDocument: le, zoomItem: B, setZoomItem: W, zoomBlock: Y, closeZoom: de, zoomDocuments: ne } = hb(e), { blockEdit: ae, editBlock: ke, revisedBlocks: ee } = eb(e, E, oe), [Z, fe] = A(null), N = L(() => fe(null), []), H = ah({ documentId: r.documentId, jobId: r.jobId }), {
    readerApi: V,
    contributionStore: me,
    contributions: ye,
    pageLayers: Te,
    compareVersion: Ae,
    textMarks: ze,
    menuSections: He,
    pointerTakenId: Qe
  } = Jy(e, c, {
    translationVersions: H,
    bookmarks: xe,
    regionHover: oe,
    assistantPanel: a,
    closeAssistant: w,
    visiblePdfMode: E,
    changeWorkspace: j,
    jumpToBlockIn: ue,
    zoomDocuments: ne,
    editBlock: ae.available && !ae.blockedReason ? ke : null,
    panelHost: Ee
  }), $e = !!Qe, [Ke, et] = A([]), tt = U(() => ({
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
    editBlock: ae.available ? ke : void 0,
    blockEdit: ae,
    editShowsSource: E !== "compare",
    findTerm: d === "search" ? h : "",
    compareVersion: Ae,
    pointerTaken: $e,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: R,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: J, close: w },
    docDark: x,
    toggleDocDark: T
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
    ke,
    E,
    d,
    h,
    Ae,
    $e,
    e.sourceOnly,
    R,
    e.download,
    e.goToPage,
    J,
    w,
    x,
    T
  ]), St = U(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), nt = [
    qa,
    `is-workspace-${D}`,
    i ? "is-assistant-open" : "",
    d ? "is-finder-open" : "",
    g ? "is-sidebar-pinned" : "",
    v ? "is-toc-docked" : "",
    S.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(om, { api: V, store: me, children: /* @__PURE__ */ p(sf, { value: tt, hud: St, children: /* @__PURE__ */ C(
    "div",
    {
      className: nt,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": D,
      "data-pointer-taken": Qe || void 0,
      onContextMenu: (be) => {
        const F = Ny(be);
        if (!F) return;
        const Q = [
          ...py(e.viewStateKey),
          ...Ao(ye, { target: be.target, clientX: be.clientX, clientY: be.clientY, page: F.page })
        ];
        !Q.length && !He.length || (be.preventDefault(), et(Q), fe(F));
      },
      children: [
        /* @__PURE__ */ C("div", { className: "reader-workspace", children: [
          v ? /* @__PURE__ */ p(Ea, { bookmarks: xe, onJumpPage: e.goToPage, onJumpBlock: q, pinned: !0, docked: !0, onPinChange: y }) : null,
          /* @__PURE__ */ p(zy, { state: f, bookmarkScope: e.viewStateKey, issues: se }),
          /* @__PURE__ */ C("div", { className: "reader-stage", children: [
            /* @__PURE__ */ p(
              Gf,
              {
                mode: E,
                documentReady: !!r.jobId,
                sourceViewOnly: R,
                onModeChange: j,
                compareExtra: /* @__PURE__ */ p(hr, { place: "compare" }),
                liveTranslation: P.topBarPill ? {
                  visible: b,
                  state: e.liveTranslation,
                  onToggle: () => k((be) => !be),
                  latestPage: b ? I : null,
                  currentPage: e.currentPage,
                  onJumpToLatest: M
                } : null,
                completion: $ ? {
                  onOpenCompare: () => {
                    z(e.viewStateKey), j("compare");
                  }
                } : null,
                start: /* @__PURE__ */ p(Bu, { onBeforeClose: r.prepareClose })
              }
            ),
            v ? null : /* @__PURE__ */ p(Ea, { bookmarks: xe, onJumpPage: e.goToPage, onJumpBlock: q, pinned: m, onPinChange: y }),
            /* @__PURE__ */ p(uy, { active: a }),
            /* @__PURE__ */ p(Sy, { scope: e.viewStateKey, menuItemsAt: (be) => Ao(ye, be) }),
            /* @__PURE__ */ p(Ff, { paneComposition: S, markdownSplit: i, assistantSplit: u, liveTranslation: e.liveTranslation, sourcePaneAction: K }),
            /* @__PURE__ */ p(kg, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!r.readerErrors.regions, metadataError: !!r.readerErrors.metadata, onRetry: r.refreshJobArtifacts }),
            /* @__PURE__ */ p(
              Jg,
              {
                mode: E,
                modeControls: null,
                bookmarkScope: e.viewStateKey,
                startSlot: /* @__PURE__ */ p(ny, { open: d, onToggle: f.toggleSidebar, issueCount: se.issues.length }),
                leftSlot: /* @__PURE__ */ p(_y, { edit: ae }),
                toolsSlot: /* @__PURE__ */ p(hr, { place: "bottom" })
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
                /* @__PURE__ */ p(Cp, { active: a }),
                /* @__PURE__ */ p("div", { className: "reader-dock-body", ref: re })
              ]
            }
          )
        ] }),
        i ? /* @__PURE__ */ p(wg, {}) : null,
        /* @__PURE__ */ p(
          Fy,
          {
            session: r,
            zoomDocuments: ne,
            zoomItem: B,
            setZoomItem: W,
            closeZoom: de,
            visiblePdfMode: E
          }
        ),
        /* @__PURE__ */ p(Ay, { menu: Z, onClose: N, actions: Ke, sections: He }),
        /* @__PURE__ */ p(cm, { extensions: Nr }),
        /* @__PURE__ */ p(Zg, {})
      ]
    }
  ) }) });
}
function zb() {
  return /* @__PURE__ */ p(pb, {});
}
export {
  zb as R,
  pb as a,
  $b as b,
  Db as c,
  Dm as d,
  zm as e,
  no as f,
  Cb as g,
  _b as h,
  Lb as r,
  Ob as s,
  Be as u
};
//# sourceMappingURL=ReaderApp-vZaBcxEY.js.map
