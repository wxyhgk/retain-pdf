var us = Object.defineProperty;
var Ir = (e) => {
  throw TypeError(e);
};
var ds = (e, t, n) => t in e ? us(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var Er = (e, t, n) => ds(e, typeof t != "symbol" ? t + "" : t, n), Tr = (e, t, n) => t.has(e) || Ir("Cannot " + n);
var xt = (e, t, n) => (Tr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Rr = (e, t, n) => t.has(e) ? Ir("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Pr = (e, t, n, r) => (Tr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as A, jsx as p, Fragment as Oe } from "react/jsx-runtime";
import { useMemo as K, useState as P, useEffect as D, useCallback as N, useRef as _, useLayoutEffect as De, memo as Jt, createContext as Gt, useContext as dt, Fragment as Xn, forwardRef as Oo, useImperativeHandle as Yn, useSyncExternalStore as hn, Component as fs, Suspense as zo, lazy as Fo, useId as Bo } from "react";
import { requireAdapter as Nt, getReaderAdapters as Fe } from "./adapters.js";
import { resolveReaderDownloadName as ms, resolveReaderDownloadUrls as hs, READER_PROGRESS_COPY as Je, trimString as an, READER_DOWNLOAD_ACTIONS as ps, disabledReason as gs } from "./runtime/state.js";
import { r as bs, b as ys } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as xn, isFinishedJobStatus as Ht } from "@retainpdf/domain/job";
import { n as jo, d as vs, f as vn, k as Mr, b as ws, c as Ss, j as Be, p as gt, g as ks, l as Pt, i as Is } from "./reader-regions-BmqHsJ-I.js";
import { fetchDocumentReading as Es } from "@retainpdf/api/documents";
import { isReaderTransportError as Ts, createReaderTransportError as Rs } from "./contracts.js";
import { toast as An, Toaster as Ps } from "sonner";
import { X as bt, PenLine as Zn, ZoomIn as Ms, Check as Ho, Copy as _s, ChevronUp as Ns, ChevronDown as Uo, History as xs, LoaderCircle as As, Pin as Ls, LogOut as Cs, FileText as Wo, Columns2 as Ko, Languages as Vo, Radio as Ds, ArrowDownToLine as $s, CheckCircle2 as Os, ImagePlus as zs, MessageCircleQuestion as Fs, GitCompareArrows as Bs, Highlighter as js, Eraser as Hs, Undo2 as Us, Trash2 as Ws, ChevronLeft as Ks, ChevronRight as qo, Minus as Vs, Plus as qs, ArrowLeft as Js, Keyboard as Gs, Download as Xs, ListOrdered as Ys, TriangleAlert as Zs, Search as Qs, ListTree as ei, LayoutGrid as ti } from "lucide-react";
import { Button as oe, Textarea as ni, IconButton as ut, Input as Jo } from "@retainpdf/ui";
import { pdfjs as Go, Page as ri, Document as oi } from "react-pdf";
import { e as ai, m as si, a as ii } from "./markdown-math-XkF5urpn.js";
const ci = (...e) => {
  var t, n;
  return ((n = (t = Fe()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, li = "", ui = Object.freeze({
  progress: "retainpdf-reader-progress"
}), di = (e) => {
  var t, n;
  return ((n = (t = Fe()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, bg = (...e) => {
  var n;
  return (((n = Fe()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, yg = () => {
  var e, t;
  return ((t = (e = Fe()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
}, Ge = () => Nt("defaultReaderDataPort"), _r = () => Nt("defaultReaderPageConfigPort"), vg = {
  get apiPrefix() {
    return Ge().apiPrefix;
  },
  fetchProtected: (...e) => Ge().fetchProtected(...e),
  loadMarkdownPayload: (e) => Ge().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => Ge().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => Ge().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => Ge().loadJobPayload(e),
  loadReaderPayload: (e, t) => Ge().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => Ge().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return Ge().liveTranslation;
  }
}, Xo = {
  messageTargetOrigin: () => _r().messageTargetOrigin(),
  readerJobId: () => _r().readerJobId()
}, fi = () => {
  var e;
  return ((e = Fe()) == null ? void 0 : e.liveTranslation) ?? null;
}, Ut = () => {
  var t;
  const e = Fe();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, et = () => {
  const e = Fe();
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
}, mi = (...e) => {
  var t, n;
  return ((n = (t = Fe()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, hi = () => {
  var e, t;
  return ((t = (e = Fe()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, pi = (...e) => {
  var t, n;
  return ((n = (t = Fe()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, gi = (...e) => {
  var t, n;
  return ((n = (t = Fe()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? ms(...e);
}, bi = (...e) => {
  var t, n;
  return ((n = (t = Fe()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? hs(...e);
}, yi = (...e) => Nt("downloadProtectedResource")(...e), vi = (...e) => Nt("failDownloadToast")(...e), wg = (e, t) => Nt("resolveMarkdownAssetUrl")(e, t), Nr = "/api/v1";
function wi() {
  const e = () => {
    var r;
    return bs(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = P(e);
  return D(() => {
    var i, c, l, u;
    const r = () => n(e()), o = (c = (i = globalThis.history) == null ? void 0 : i.pushState) == null ? void 0 : c.bind(globalThis.history), a = (u = (l = globalThis.history) == null ? void 0 : l.replaceState) == null ? void 0 : u.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const m = (d) => function(...f) {
          const g = d.apply(this, f);
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
function Si() {
  const e = wi(), t = K(() => pi(Xo), [e]), n = K(() => hi(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function ki(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: i
  } = e, [c, l] = P({
    documentId: "",
    jobId: ""
  }), [u, m] = P({
    documentId: "",
    jobId: ""
  }), d = c.documentId === t ? c.jobId : "", f = u.documentId === t ? u.jobId : "", g = n || d, [h, y] = P({
    jobId: "",
    documentId: ""
  }), S = h.jobId === g ? h.documentId : "", w = t || S, b = !!t && !g, [v, k] = P(null), R = (v == null ? void 0 : v.sessionIdentity) === r && v.documentId === w ? v : null, L = b || !!R, O = N((M) => {
    const I = `${M.documentId || ""}`.trim();
    if (!I || a.current && a.current !== I) return;
    if (!a.current && s.current)
      y({
        jobId: s.current,
        documentId: I
      });
    else if (!a.current)
      return;
    const E = `${M.revision || ""}`.trim() || `${Date.now()}`;
    k({
      documentId: I,
      revision: E,
      sessionIdentity: o.current
    }), i();
  }, []);
  D(() => {
    k((M) => M && M.sessionIdentity !== r ? null : M);
  }, [r]);
  const B = N((M) => {
    switch (M.type) {
      case "resolved-document-job":
        l({ documentId: M.documentId, jobId: M.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        m({ documentId: M.documentId, jobId: M.jobId });
        break;
      case "resolved-job-document":
        y((I) => I.jobId === M.jobId && I.documentId === M.documentId ? I : { jobId: M.jobId, documentId: M.documentId });
        break;
      case "committed-source":
        k({
          documentId: M.documentId,
          revision: M.revision,
          sessionIdentity: M.sessionIdentity
        });
        break;
    }
  }, []);
  return {
    resolvedDocumentJob: c,
    setResolvedDocumentJob: l,
    missingDocumentJob: u,
    setMissingDocumentJob: m,
    documentJobId: d,
    rejectedDocumentJobId: f,
    sessionJobId: g,
    resolvedJobDocument: h,
    setResolvedJobDocument: y,
    jobDocumentId: S,
    documentId: w,
    sourceOnly: b,
    committedDocumentSource: v,
    setCommittedDocumentSource: k,
    activeCommittedDocumentSource: R,
    sourceViewOnly: L,
    refreshCommittedDocument: O,
    applyIdentityEvent: B
  };
}
function xr(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function Ii(e) {
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
function Ar(e, t) {
  return di(xn(e, t));
}
function Ei(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function Ti(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !Ei(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function Ln({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: ui.progress,
        stage: n,
        percent: e,
        text: t
      },
      Xo.messageTargetOrigin()
    );
  } catch {
  }
}
function sn(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), Ln({ percent: t, text: n, stage: r });
}
function Ri(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = P(null), [l, u] = P(null), [m, d] = P(""), [f, g] = P(0), h = m === n ? i : null, y = m === n ? l : null, S = xr(h), w = Ht(S), b = N(() => {
    g((B) => B + 1);
  }, []), v = N((B) => {
    c(B.jobPayload), u(B.manifestPayload), d(B.sessionIdentity);
  }, []), k = N((B) => {
    c(null), u(null), d(B);
  }, []), R = _(""), L = _(""), O = N(async () => {
    const B = o.current;
    if (!B || R.current === B) return;
    const M = et().loadJobPayload;
    if (typeof M != "function") return;
    const I = a.current.value;
    R.current = B;
    try {
      const E = await M(B);
      if (s.current || a.current.value !== I || o.current !== B || !E || typeof E != "object")
        return;
      const T = xr(E);
      c(E), d(r.current), !Ht(T) && L.current === B && (L.current = ""), T === "succeeded" && L.current !== B && (L.current = B, g((x) => x + 1));
    } catch {
    } finally {
      R.current === B && (R.current = "");
    }
  }, []);
  return D(() => {
    L.current = "";
  }, [n]), D(() => {
    if (!t || w || !h) return;
    const B = window.setInterval(() => {
      document.visibilityState !== "hidden" && O();
    }, 1e3);
    return () => window.clearInterval(B);
  }, [w, O, h, t]), {
    jobPayload: i,
    setJobPayload: c,
    manifestPayload: l,
    setManifestPayload: u,
    payloadSessionIdentity: m,
    setPayloadSessionIdentity: d,
    scopedJobPayload: h,
    scopedManifestPayload: y,
    jobStatus: S,
    jobTerminal: w,
    jobRefreshRevision: f,
    refreshJobArtifacts: b,
    refreshJobStatus: O,
    publishPayload: v,
    clearPayload: k
  };
}
function Cn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function Pi(e, t) {
  e(t), Cn(t);
}
function Mi(e) {
  const [t, n] = P(e ? "source" : "compare"), r = N((a) => {
    e && a !== "source" || (n(a), Cn(a));
  }, [e]), o = N((a) => {
    Pi(n, a);
  }, []);
  return D(() => (e && document.documentElement.classList.add("reader-source-only"), Cn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Lr(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function _i(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Lr(n.active_job_id),
    activeVersionId: Lr(n.active_version_id)
  };
}
function Ni(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function xi(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Ai(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Li = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Ci(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Li.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const Di = 48 * 1024 * 1024;
function $i(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Oi = 2, ze = /* @__PURE__ */ new Map();
function Dn(e, t) {
  ze.delete(e), ze.set(e, t);
}
function Cr(e) {
  if (ze.size < Oi) return;
  const t = ze.keys().next().value;
  t && ze.delete(t);
}
async function zi(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function Yo(e, t = Ut().fetchProtected, n = {}) {
  var u, m, d, f, g, h, y, S, w;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (ze.has(r)) {
    const b = ze.get(r);
    return Dn(r, b), b;
  }
  const o = new AbortController(), a = () => o.abort();
  (u = n.signal) != null && u.aborted && o.abort(), (d = (m = n.signal) == null ? void 0 : m.addEventListener) == null || d.call(m, "abort", a, { once: !0 });
  let s;
  try {
    s = await t(r, { signal: o.signal });
  } finally {
    (g = (f = n.signal) == null ? void 0 : f.removeEventListener) == null || g.call(f, "abort", a);
  }
  if (!s.ok) {
    const b = new Error(`读取 PDF 失败 (${s.status})`);
    b.status = s.status;
    const v = await zi(s);
    throw v && (b.reason = v), b;
  }
  const i = Fi(r, s, t);
  if (i) {
    o.abort();
    const b = { ranged: i };
    return Cr(), ze.set(r, b), b;
  }
  (y = (h = n.signal) == null ? void 0 : h.addEventListener) == null || y.call(h, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (w = (S = n.signal) == null ? void 0 : S.removeEventListener) == null || w.call(S, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return ze.has(r) ? Dn(r, l) : (Cr(), ze.set(r, l)), l;
}
function Fi(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < Di ? null : {
    url: e,
    length: o,
    async fetchRange(i, c) {
      const l = await n(e, { headers: { Range: `bytes=${i}-${c - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const Bi = { file: null, loading: !1, error: "" }, ji = { file: null, loading: !0, error: "" };
function Hi(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = P(null);
  if (D(() => {
    if (t || !n) return;
    const s = ze.get(n);
    if (s) {
      Dn(n, s);
      return;
    }
    const i = new AbortController();
    return Yo(n, void 0, { signal: i.signal }).then((c) => {
      i.signal.aborted || o({ url: n, file: c, loading: !1, error: "" });
    }).catch((c) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (c == null ? void 0 : c.message) || String(c) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Bi;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = ze.get(n);
  return a ? { file: a, loading: !1, error: "" } : ji;
}
function Ui(e) {
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
async function $n(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  sn(s, r, n, "download");
  const i = await Yo(t, Ut().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (sn(s, o, n, "download"), i);
}
async function Wi(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  sn(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    $n({
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
    $n({
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
function Ki(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Vi({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = Es,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(Ki(o.href, t, a)), !0);
}
const Zt = {
  regions: null,
  metadata: null
};
function qi(e) {
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
    clearPayload: d,
    switchSessionMode: f,
    jobRefreshRevision: g,
    sessionEpochRef: h,
    closingRef: y,
    activeLoadAbortRef: S
  } = e, [w, b] = P(""), [v, k] = P(""), [R, L] = P(null), [O, B] = P(null), [M, I] = P(!1), [E, T] = P(""), [x, C] = P([]), [W, H] = P(!1), [J, ue] = P(() => ({
    source: null,
    translated: null
  })), [Y, ae] = P(
    Zt
  ), [Se, te] = P({
    loading: !0,
    percent: 4,
    text: Je.boot,
    stage: "progress",
    failed: !1
  });
  return D(() => {
    const de = new AbortController(), Pe = h.current.value, ie = Ui({
      sessionEpochRef: h,
      closingRef: y,
      abort: de,
      sessionEpoch: Pe
    });
    S.current = de;
    const ne = et();
    if (y.current)
      return de.abort(), () => {
        S.current === de && (S.current = null);
      };
    let z = !1;
    function U(ce, X) {
      ie.markFailed(), H(!0), te({
        loading: !1,
        percent: 100,
        text: ce,
        stage: "failed",
        failed: !0
      }), Ln({ percent: 100, text: X, stage: "failed" });
    }
    function q() {
      I(!0), z || H(!0), te({
        loading: !1,
        percent: 100,
        text: Je.ready,
        stage: "ready",
        failed: !1
      }), Ln({ percent: 100, text: Je.ready, stage: "ready" });
    }
    function fe() {
      return l != null && l.documentId ? Ar(
        l.documentId,
        l.revision
      ) : ci() ? li : ne.resolveResourceUrl(xn(r));
    }
    async function se() {
      var Z;
      let ce = { activeJobId: "", activeVersionId: "" };
      try {
        const he = await ((Z = ne.fetchDocument) == null ? void 0 : Z.call(ne, r));
        he && (ce = _i(he));
      } catch {
      }
      const X = Ni({
        link: ce,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (X.kind === "follow-active-job") {
        if (ie.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: X.jobId
        }), X.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: X.activeVersionId,
          sessionIdentity: c
        }), f("source")) : f("compare");
        return;
      }
      if (X.kind === "open-committed-source") {
        if (ie.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: X.revision,
          sessionIdentity: c
        }), f("source");
        return;
      }
      const pe = fe();
      if (ie.isInactive()) return;
      b(pe), k(""), T(""), d(c);
      const F = await $n({
        url: pe,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: ie,
        setBoot: te
      });
      if (!ie.isInactive()) {
        if (!F) {
          U("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        L(F), q();
      }
    }
    async function me() {
      var qe;
      const ce = !l, X = !!(ce && ne.loadSessionSnapshot && ne.loadReaderOptionalArtifacts), pe = X ? ne.loadReaderOptionalArtifacts(t) : null, F = await ((qe = ne.loadSessionSnapshot) == null ? void 0 : qe.call(ne, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: ce && !X
      })), Z = F ? {
        jobPayload: F.sourcePayload,
        manifestPayload: F.manifestPayload,
        readerMetadata: F.readerMetadata,
        regionsPayload: F.regions,
        readerErrors: F.readerErrors
      } : await ne.loadReaderPayload(t, {
        includeOptionalArtifacts: ce
      });
      if (ie.isInactive()) return;
      let he = null;
      if (n && !r)
        if (F && F.linkedDocument !== void 0)
          he = F.linkedDocument;
        else {
          try {
            he = await ne.fetchDocumentByJobId(Nr, t);
          } catch {
          }
          if (ie.isInactive()) return;
        }
      const Me = Ii(Z.jobPayload) || `${(he == null ? void 0 : he.document_id) || ""}`.trim();
      Me && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Me
      });
      const _e = xi({
        payloadDocumentId: Me,
        linkedActiveJobId: `${(he == null ? void 0 : he.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(he == null ? void 0 : he.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (_e.kind === "restore-committed-source") {
        if (ie.isInactive()) return;
        u({
          type: "committed-source",
          documentId: _e.documentId,
          revision: _e.revision,
          sessionIdentity: c
        }), f("source");
        return;
      }
      const xe = ne.resolveReaderSourcePdf(Z.manifestPayload), Ae = ne.resolveReaderTranslatedPdfUrl(Z.jobPayload, Z.manifestPayload), $e = typeof xe == "string" ? xe : ne.resolveReaderArtifactUrl(xe), je = r || Me, Ue = l != null && l.documentId ? Ar(
        l.documentId,
        l.revision
      ) : $e || (je ? ne.resolveResourceUrl(xn(je)) : ""), $ = l ? "" : Ae || "";
      b(Ue || ""), k($), T(Ti(Z.jobPayload, t)), m({
        jobPayload: Z.jobPayload || null,
        manifestPayload: Z.manifestPayload || null,
        sessionIdentity: c
      });
      const V = () => Wi({
        sourceFinal: Ue || "",
        translatedFinal: $,
        fence: ie,
        setBoot: te
      }), re = !!(Ue || $), ve = pe && re ? V() : null;
      ve == null || ve.catch(() => {
      });
      const Le = (j) => {
        ie.isInactive() || (C(l ? [] : jo(j.regionsPayload)), ue(l ? { source: null, translated: null } : vs(j.readerMetadata)), ae(l ? Zt : j.readerErrors ?? Zt), H(!0));
      };
      if (pe ? (z = !0, pe.then(Le)) : Le(Z), !re) {
        U(Je.failed, Je.failed);
        return;
      }
      const Ce = await (ve ?? V());
      if (Ce.status !== "inactive") {
        if (Ce.status === "incomplete") {
          U("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        L(Ce.sourceBytes), B(Ce.translatedBytes), q();
      }
    }
    async function ke() {
      I(!1), L(null), B(null), C([]), H(!1), ue({ source: null, translated: null }), ae(Zt), sn(te, 8, Je.metadata, "metadata");
      try {
        if (s) {
          await se();
          return;
        }
        if (!t) {
          U(Je.failed, Je.failed);
          return;
        }
        await me();
      } catch (ce) {
        if (ie.isClosedOrStale() || (ce == null ? void 0 : ce.name) === "AbortError") return;
        ie.markFailed();
        const X = Number(ce == null ? void 0 : ce.status), pe = `${(ce == null ? void 0 : ce.reason) || ""}`, F = Ci({ status: X, reason: pe, sessionJobId: t });
        if (F && (await Vi({
          apiPrefix: Nr,
          documentId: F,
          expiredJobId: t
        }) || ie.isClosedOrStale()))
          return;
        if (Ai({
          status: X,
          reason: pe,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), f("source");
          return;
        }
        const Z = ce instanceof Error ? ce.message : Je.failed;
        U(Z, Z);
      }
    }
    return ke(), () => {
      de.abort(), S.current === de && (S.current = null);
    };
  }, [t, r, o, a, s, i, l, g, n, c, u, m, d, f]), {
    sourceUrl: w,
    translatedUrl: v,
    sourceFile: R,
    translatedFile: O,
    assetsReady: M,
    title: E,
    regions: x,
    regionsSettled: W,
    readerMetadata: J,
    readerErrors: Y,
    boot: Se
  };
}
function Ji() {
  const e = _(!1), t = _(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = Si(), s = _({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = _(a), c = _(""), l = _(""), u = _(() => {
  }), m = N(() => u.current(), []), d = ki({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: i,
    documentIdRef: c,
    sessionJobIdRef: l,
    switchToSourceMode: m
  }), {
    sessionJobId: f,
    documentId: g,
    sourceOnly: h,
    sourceViewOnly: y
  } = d, { mode: S, setMode: w, switchSessionMode: b } = Mi(y);
  u.current = () => {
    b("source");
  }, i.current = a, c.current = g, l.current = f;
  const v = Ri({
    sessionJobId: f,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: k,
    scopedManifestPayload: R,
    jobStatus: L,
    jobTerminal: O,
    jobRefreshRevision: B,
    refreshJobArtifacts: M,
    refreshJobStatus: I
  } = v, E = qi({
    sessionJobId: f,
    jobId: r,
    routeDocumentId: o,
    documentJobId: d.documentJobId,
    rejectedDocumentJobId: d.rejectedDocumentJobId,
    sourceOnly: h,
    locationKey: n,
    sessionIdentity: a,
    committedSource: d.activeCommittedDocumentSource,
    applyIdentityEvent: d.applyIdentityEvent,
    publishPayload: v.publishPayload,
    clearPayload: v.clearPayload,
    switchSessionMode: b,
    jobRefreshRevision: B,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), T = N(() => {
    var C;
    e.current = !0, (C = t.current) == null || C.abort();
  }, []), x = K(
    () => ({
      fetchProtected: et().fetchProtected,
      jobId: f,
      jobPayload: k,
      manifestPayload: R,
      sourceUrl: E.sourceUrl,
      translatedUrl: E.translatedUrl,
      sourceOnly: y
    }),
    [f, k, R, E.sourceUrl, E.translatedUrl, y]
  );
  return {
    jobId: f,
    jobStatus: L,
    workflow: `${(k == null ? void 0 : k.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: O,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: h,
    mode: S,
    setMode: w,
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
    download: x,
    refreshJobArtifacts: M,
    refreshJobStatus: I,
    refreshCommittedDocument: d.refreshCommittedDocument,
    prepareClose: T
  };
}
const Gi = 160, Xi = 8, Yi = 0;
function Zi() {
  const e = _(null), [t, n] = P(null), [r, o] = P(Yi), a = N((s) => {
    e.current = s, n(s);
  }, []);
  return D(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (l) => {
      !Number.isFinite(l) || l < Gi || o((u) => Math.abs(u - l) < Xi ? u : l);
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
function Qi(e) {
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
const wn = { source: 0, translated: 0 };
function ec(e, t) {
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
  const [m, d] = P(() => ({
    identity: l,
    pages: wn
  })), [f, g] = P(() => ({ identity: l, tick: 0 })), h = m.identity === l ? m.pages : wn, y = f.identity === l ? f.tick : 0, S = Qi({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: w } = S, b = N((I, E) => {
    u.current === l && d((T) => {
      const x = T.identity === l ? T.pages : wn;
      return x[E] === I && T.identity === l ? T : {
        identity: l,
        pages: { ...x, [E]: I }
      };
    });
  }, [l]), v = _(null), k = N(() => {
    v.current && clearTimeout(v.current);
    const I = l;
    v.current = setTimeout(() => {
      v.current = null, u.current === I && g((E) => ({
        identity: I,
        tick: E.identity === I ? E.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  D(() => (v.current && (clearTimeout(v.current), v.current = null), d((I) => I.identity === l && I.pages.source === 0 && I.pages.translated === 0 ? I : { identity: l, pages: { source: 0, translated: 0 } }), g((I) => I.identity === l && I.tick === 0 ? I : { identity: l, tick: 0 }), () => {
    v.current && (clearTimeout(v.current), v.current = null);
  }), [l]);
  const R = K(
    () => Math.max(h.source, h.translated),
    [h]
  ), L = w === "translated" ? h.translated : h.source || h.translated, O = t == null ? void 0 : t.userZoom, B = t == null ? void 0 : t.shellWidth, M = `${l}-${y}-${O}-${n}-${h.source}-${h.translated}-${B}`;
  return {
    ...S,
    numPagesByPane: h,
    hudNumPages: R,
    primaryNumPages: L,
    metricsTick: y,
    onNumPages: b,
    onMetrics: k,
    rowSyncRevision: M
  };
}
const Ee = "data-reader-page", Ie = "data-reader-pane", Qn = "data-natural-height", tc = "reader-react-root", Zo = "reader-react-grid", Qo = "reader-react-scroll-shell", pn = "reader-react-pdf-pane", ea = "reader-react-pdf-page", cn = "reader-react-pdf-page-placeholder", er = "reader-react-pdf-page-slot";
function ln(e, t) {
  const n = e != null ? `[${Ee}="${e}"]` : `[${Ee}]`;
  return t ? `${n}[${Ie}="${t}"]` : n;
}
function tr() {
  return `.${er}[${Ee}]`;
}
function un(e) {
  return Number(e.getAttribute(Ee));
}
const ta = 0.25, dn = 1, nc = 0.05, Xt = 0.5, rc = 16, oc = 8, na = rc + oc, ac = 720;
function st() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function ra(e) {
  return Number.isFinite(e) && e < ac;
}
function It(e, t = Number.POSITIVE_INFINITY) {
  return ra(t) && (e === "source" || e === "translated") ? dn : Xt;
}
function Ze(e) {
  return Number.isFinite(e) ? Math.min(dn, Math.max(ta, e)) : Xt;
}
function Wt(e, t) {
  const n = Ze(Number(e) + t * nc);
  return Math.round(n * 100) / 100;
}
function sc(e) {
  return Math.round(Ze(e) * 100);
}
function oa(e) {
  const n = (Number(e) || 0) - na;
  return Math.max(160, Math.floor(n));
}
function ic(e, t = Xt) {
  const n = Ze(t);
  return oa((Number(e) || 0) * n);
}
function cc(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${Ie}]`)
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
const lc = 8;
function uc(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < lc ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const aa = 200, dc = [
  "markdown"
], fc = dc;
function sa(e) {
  return fc.includes(e);
}
const mc = "retainpdf:reader:view:v1:", Dr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), hc = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function ia() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function On(e) {
  return `${e || ""}`.trim();
}
function pc({
  documentId: e,
  jobId: t
}) {
  const n = On(e);
  if (n) return `document:${n}`;
  const r = On(t);
  return r ? `job:${r}` : "";
}
function ca(e) {
  const t = On(e);
  return t ? `${mc}${t}` : "";
}
function gc(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function bc(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!Dr.has(t) || !Dr.has(n) || t === n))
    return { left: t, right: n };
}
function yc(e) {
  return e === null ? null : sa(e) ? e : void 0;
}
function vc(e) {
  return hc.has(e) ? e : void 0;
}
function la(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = gc(t.anchor), r = Number(t.zoom), o = vc(t.mode), a = bc(t.splitLayout), s = yc(t.assistantPanel);
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
function Ve(e, t = ia()) {
  const n = ca(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? la(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function gn(e, t, n = ia()) {
  const r = ca(e);
  if (!r || !n) return null;
  const o = Ve(e, n), a = la({
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
function wc(e, t, n = "") {
  var d;
  const [r, o] = P(() => {
    var f;
    return ((f = Ve(n)) == null ? void 0 : f.zoom) ?? It(e, st());
  }), a = _(r), s = _(n);
  a.current = r;
  const i = _(1), c = _(((d = Ve(n)) == null ? void 0 : d.zoom) !== void 0);
  D(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const f = (h = Ve(n)) == null ? void 0 : h.zoom;
    c.current = f !== void 0;
    const g = f ?? It(e, st());
    i.current = 1, a.current = g, o(g);
  }, [e, n]), D(() => {
    if (c.current) return;
    const f = It(e, st()), g = a.current;
    Math.abs(f - g) < 5e-4 || (i.current = 1, a.current = f, o(f));
  }, [e]);
  const l = N((f, g) => {
    const h = Ze(f), y = a.current;
    Math.abs(h - y) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : h / (y || 1), a.current = h, c.current = !0, gn(s.current, { zoom: h }), o(h));
  }, []), u = N((f) => {
    l(Wt(a.current, f));
  }, [l]), m = N((f) => {
    l(It(f));
  }, [l]);
  return De(() => {
    const f = i.current;
    Math.abs(f - 1) < 1e-3 || (i.current = 1, cc(t == null ? void 0 : t.current, f));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: m };
}
const Sc = 160, kc = 3e-3, $r = 50, Ic = 16, Ec = 800;
function Tc(e, t = 0) {
  const n = t === 1 ? Ic : t === 2 ? Ec : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-$r, Math.min($r, r));
  return Math.exp(-o * kc);
}
function Rc(e, t, n = 0) {
  return Ze(e * Tc(t, n));
}
function Pc(e) {
  return Math.round(Ze(e) * 100) / 100;
}
function Mc(e, t, n) {
  const r = Ze(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return Ze(t) / r;
  const a = (o + na) / r;
  return oa(a * Ze(t)) / o;
}
function _c(e) {
  return Array.from(e.querySelectorAll(tr()));
}
function Nc(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function xc(e, t, n) {
  let r = null;
  for (const s of _c(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const c = Nc(i, t, n);
    if ((!r || c < r.distance) && (r = { el: s, rect: i, distance: c }), c === 0) break;
  }
  if (!r) return null;
  const { el: o, rect: a } = r;
  return {
    page: o.getAttribute(Ee) || "",
    pane: o.getAttribute(Ie) || "",
    fracX: (t - a.left) / a.width,
    fracY: (n - a.top) / a.height,
    clientX: t,
    clientY: n,
    pageWidth: a.width
  };
}
function Ac(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function ua(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${tr()}[${Ee}="${t.page}"][${Ie}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (Ac(n, e).scrollLeft += a);
}
function Lc(e, t, n, r) {
  const o = e.querySelector(`.${Zo}`);
  if (!o) return null;
  if (!o.style.transformOrigin) {
    const a = o.getBoundingClientRect();
    o.style.transformOrigin = `${n - a.left}px ${r - a.top}px`, o.style.willChange = "transform";
  }
  return o.style.transform = `scale(${t})`, o;
}
function At(e) {
  e && (e.style.transform = "", e.style.transformOrigin = "", e.style.willChange = "");
}
const Cc = 600, Dc = 1e3;
function $c(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || ua(e, t);
  });
  a.observe(n);
  const s = (u) => {
    u.type === "wheel" && u.ctrlKey || l();
  }, i = ["wheel", "keydown", "pointerdown", "touchstart"];
  for (const u of i) r.addEventListener(u, s, { capture: !0, passive: !0 });
  const c = r.setTimeout(() => l(), Dc);
  function l() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(c);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return l;
}
function Oc(e, t, n) {
  const r = _(t);
  r.current = t;
  const o = _(n);
  o.current = n;
  const a = _(null), s = _(null), i = _(null);
  D(() => {
    if (!e) return;
    const c = () => {
      const u = a.current;
      if (a.current = null, !u) return;
      const m = Pc(u.target);
      if (Math.abs(m - r.current) < 5e-3) {
        At(u.grid);
        return;
      }
      const d = { anchor: u.anchor, grid: u.grid, fallback: null };
      d.fallback = setTimeout(() => {
        s.current === d && (s.current = null, At(d.grid));
      }, Cc), s.current = d, o.current(m, { keepScroll: !1 });
    }, l = (u) => {
      var f, g;
      if (!u.ctrlKey) return;
      u.preventDefault();
      let m = a.current;
      if (!m) {
        (f = i.current) == null || f.call(i), i.current = null;
        const h = s.current;
        h && (h.fallback && clearTimeout(h.fallback), s.current = null, At(h.grid)), m = {
          start: r.current,
          target: r.current,
          anchor: xc(e, u.clientX, u.clientY),
          grid: null,
          timer: null
        }, a.current = m;
      }
      m.target = Rc(m.target, u.deltaY, u.deltaMode);
      const d = Mc(m.start, m.target, ((g = m.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      m.grid = Lc(e, d, u.clientX, u.clientY) ?? m.grid, m.timer && clearTimeout(m.timer), m.timer = setTimeout(c, Sc);
    };
    return e.addEventListener("wheel", l, { passive: !1 }), () => {
      var m;
      e.removeEventListener("wheel", l);
      const u = a.current;
      a.current = null, u != null && u.timer && clearTimeout(u.timer), At((u == null ? void 0 : u.grid) ?? null), (m = i.current) == null || m.call(i), i.current = null;
    };
  }, [e]), De(() => {
    var l;
    const c = s.current;
    c && (s.current = null, c.fallback && clearTimeout(c.fallback), At(c.grid), !(!e || !c.anchor) && (ua(e, c.anchor), (l = i.current) == null || l.call(i), i.current = $c(e, c.anchor)));
  }, [t, e]);
}
function zc(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = _(t), a = _(n), s = _(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: N((c) => {
    c !== o.current && (s.current(), a.current(c));
  }, []) };
}
const nr = 48;
function da(e, t = nr) {
  return e.getBoundingClientRect().top + t;
}
function fa(e, t) {
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
  const o = un(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function Bt(e, t, n = nr) {
  if (!e)
    return null;
  const r = ln(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = da(e, n), i = fa(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function Mt(e, t, n = "auto", r, o = nr) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(ln(a, r))), i || (i = e.querySelector(ln(a))), !i)
    return !1;
  const c = e.getBoundingClientRect(), l = i.getBoundingClientRect();
  if (c.height <= 0 || l.height < 8 && i.offsetHeight < 8)
    return !1;
  const u = l.height > 0 ? l.height : i.offsetHeight, m = e.scrollTop + (l.top - c.top), d = Math.max(0, m + s * u - o);
  return n === "auto" ? Math.abs(e.scrollTop - d) >= 1 && (e.scrollTop = d) : e.scrollTo({ top: d, behavior: n }), !0;
}
function Fc(e, t, n = "smooth", r) {
  return Mt(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function zn(e, t, n) {
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
function Bc(e, t, n) {
  return zn(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function fn(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function He(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function jc(e, t, n = !0, r = "", o) {
  const [a, s] = P(1);
  return D(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const i = e.current;
    if (!i)
      return;
    let c = !1, l = null, u = 0;
    const m = ln(void 0, o), d = () => {
      if (c) return;
      const h = Array.from(i.querySelectorAll(m));
      if (!h.length)
        return;
      const y = da(i), S = fa(h, y);
      S && s(S.page);
    }, f = () => {
      c || (u && cancelAnimationFrame(u), u = requestAnimationFrame(() => {
        u = 0, d();
      }));
    }, g = () => {
      if (c) return;
      if (!Array.from(i.querySelectorAll(m)).length) {
        l = setTimeout(g, 120);
        return;
      }
      d(), i.addEventListener("scroll", f, { passive: !0 });
    };
    return g(), () => {
      c = !0, l && clearTimeout(l), u && cancelAnimationFrame(u), i.removeEventListener("scroll", f);
    };
  }, [e, t, n, r, o]), a;
}
const Hc = `canvas, .react-pdf__Page, .${ea}, .${cn}`, Or = /* @__PURE__ */ new WeakMap();
function Uc(e) {
  const t = Number(e.getAttribute(Qn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Or.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(Hc), Or.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Wc(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Kc(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(tr()).forEach((r) => {
    const o = un(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = Uc(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Vc(e, t, n = "", r) {
  const [o, a] = P(() => /* @__PURE__ */ new Map()), s = _(o), i = _(r);
  return i.current = r, De(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let c = !1, l = 0, u = !1, m = !1;
    const d = () => {
      var k;
      if (c) return;
      const b = e.current;
      if (!b) return;
      const v = Kc(b);
      Wc(s.current, v) || (s.current = v, a(v)), u && !m && (m = !0, (k = i.current) == null || k.call(i));
    }, f = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(d);
      });
    };
    f();
    const g = window.setTimeout(f, 100), h = window.setTimeout(() => {
      u = !0, f();
    }, 300), y = window.setTimeout(f, 700), S = e.current;
    let w = null;
    return S && typeof ResizeObserver < "u" && (w = new ResizeObserver(() => f()), w.observe(S)), () => {
      c = !0, cancelAnimationFrame(l), window.clearTimeout(g), window.clearTimeout(h), window.clearTimeout(y), w == null || w.disconnect();
    };
  }, [e, t, n]), o;
}
const qc = [0, 48, 140, 320, 560], Jc = 700, Gc = [80, 200, 400], Xc = 500, Yc = 50, Zc = /* @__PURE__ */ new Set([
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
]), Qc = 180, zr = [0, 48, 140, 320, 700, 1200];
function el(e, t) {
  var E;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = _(
    ((E = Ve(a)) == null ? void 0 : E.anchor) || { page: 1, fraction: 0 }
  ), c = _(null), l = _(!1), u = _(r), m = _(null), d = _(null), f = _(null), g = _(null), h = _(a), y = _(""), S = _(n);
  S.current = n;
  const w = N(() => {
    var T;
    (T = m.current) == null || T.call(m), m.current = null, d.current != null && (clearTimeout(d.current), d.current = null);
  }, []), b = N(() => {
    !l.current && c.current == null || (w(), f.current != null && (clearTimeout(f.current), f.current = null), c.current = null, l.current = !1);
  }, [w]), v = N((T = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const x = () => {
      g.current = null, gn(h.current, {
        anchor: He(i.current)
      });
    };
    T ? x() : g.current = setTimeout(x, Qc);
  }, []), k = N((T) => {
    i.current = He(T), c.current = null, f.current != null && clearTimeout(f.current), f.current = setTimeout(() => {
      f.current = null, l.current = !1;
    }, Yc);
  }, []);
  D(() => {
    if (!o)
      return;
    let T = !1, x = null, C = null, W = null;
    const H = () => {
      if (T) return;
      const J = e.current;
      if (!J) {
        W = setTimeout(H, 50);
        return;
      }
      x = J, C = () => {
        if (l.current)
          return;
        const ue = Bt(x, S.current);
        ue && (i.current = ue, v());
      }, x.addEventListener("scroll", C, { passive: !0 }), l.current || C();
    };
    return H(), () => {
      T = !0, W != null && clearTimeout(W), x && C && x.removeEventListener("scroll", C);
    };
  }, [o, r, n, e, v]), D(() => {
    if (!o) return;
    const T = e.current;
    if (!T) return;
    const x = (C) => {
      C.metaKey || C.ctrlKey || C.altKey || Zc.has(C.key) && b();
    };
    return T.addEventListener("wheel", b, { passive: !0 }), T.addEventListener("touchmove", b, { passive: !0 }), window.addEventListener("keydown", x), () => {
      T.removeEventListener("wheel", b), T.removeEventListener("touchmove", b), window.removeEventListener("keydown", x);
    };
  }, [o, e, b]), De(() => {
    var x;
    if (h.current === a) return;
    v(!0), w(), f.current != null && (clearTimeout(f.current), f.current = null), h.current = a, y.current = "";
    const T = (x = Ve(a)) == null ? void 0 : x.anchor;
    i.current = T ? He(T) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, u.current = r;
  }, [a, r, v, w]), D(() => {
    var x;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const T = He(
      ((x = Ve(a)) == null ? void 0 : x.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = T, c.current = T, l.current = !0, w(), m.current = zn(
      () => e.current,
      T,
      {
        behavior: "auto",
        pane: S.current,
        delaysMs: zr,
        onDone: () => k(T)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(T);
    }, Math.max(...zr) + 160), () => w();
  }, [o, s, a, e, k, w]), D(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, c.current = null, w();
      return;
    }
    const T = c.current ? He(c.current) : He(i.current);
    return l.current = !0, c.current = T, i.current = T, w(), m.current = zn(
      () => e.current,
      T,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: qc,
        onDone: () => k(T)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(T);
    }, Jc), () => {
      w();
    };
  }, [r, o, n, e, k, w]), D(() => () => {
    w(), f.current != null && (clearTimeout(f.current), f.current = null), v(!0);
  }, [w, v]);
  const R = N(() => {
    const T = Bt(
      e.current,
      S.current
    );
    return He(T || i.current);
  }, [e]), L = N(() => {
    l.current = !0;
    const T = Bt(
      e.current,
      S.current
    ), x = He(T ?? i.current);
    return i.current = x, c.current = x, v(), x;
  }, [e, v]), O = N((T, x, C) => {
    const W = C || S.current, H = fn(T, x || 1), J = { page: H, fraction: 0 };
    i.current = J, l.current = !0, c.current = J, v(), w(), Fc(e.current, H, "smooth", W), m.current = Bc(
      () => e.current,
      H,
      {
        behavior: "auto",
        pane: W,
        delaysMs: Gc,
        onDone: () => k(J)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(J);
    }, Xc);
  }, [e, k, w, v]), B = N(() => He(i.current), []), M = N(() => l.current, []), I = N(() => {
    if (!l.current || !c.current)
      return;
    const T = He(c.current);
    Mt(
      e.current,
      T,
      "auto",
      S.current
    );
  }, [e]);
  return {
    lockFromShell: R,
    beginModeSwitch: L,
    goToPage: O,
    getAnchor: B,
    isRestoring: M,
    repinIfRestoring: I
  };
}
function tl(e, t) {
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
function ma(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const nl = [0, 80, 200, 400, 800], rl = 120, ol = 400;
function al(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: c, documentId: l, regionsSettled: u = !0 } = e, m = _(a);
  m.current = a;
  const d = _(s);
  d.current = s;
  const f = _(i);
  f.current = i;
  const g = _(n);
  g.current = n, D(() => {
    var v, k;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = mi(), y = tl(h, d.current);
    if (y == null && (h != null && h.blockId) && !u) return;
    const S = ma(h, y, { jobId: c, documentId: l });
    if (t.current === S)
      return;
    if (y == null) {
      t.current = S, (v = g.current) == null || v.call(g);
      return;
    }
    t.current = S, h && ((k = f.current) == null || k.call(f, h, y));
    const w = [];
    let b = 0;
    for (const R of nl)
      b = Math.max(b, R), w.push(
        setTimeout(() => {
          m.current(y);
        }, R)
      );
    return w.push(
      setTimeout(() => {
        var R;
        (R = g.current) == null || R.call(g);
      }, b + rl)
    ), () => {
      for (const R of w) clearTimeout(R);
    };
  }, [r, o, c, l, t, u]);
}
function sl(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function il(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = ol,
    jobId: i,
    documentId: c,
    applyReaderSearch: l
  } = e, u = _(a);
  u.current = a;
  const m = _(l);
  m.current = l;
  const d = _(0);
  D(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || d.current === o) return;
    const f = setTimeout(() => {
      var S;
      const g = ((S = globalThis.location) == null ? void 0 : S.search) || "", h = ys(g, o, u.current);
      if (d.current = o, h === null) return;
      const y = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = ma(
        { blockId: y },
        o,
        { jobId: i, documentId: c }
      ), (m.current || sl)(h);
    }, s);
    return () => clearTimeout(f);
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
function cl(e) {
  const t = _(""), [n, r] = P(!1), o = N(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  al(a, t, o), il(e, t, n);
}
const Lt = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function ll(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function Fr(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function ha(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = Fr(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = Fr(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function ul(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = ha(r, t, n);
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
function dl(e) {
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
function fl(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function ml(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function hl(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function pl(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const Br = [250, 500, 1e3, 2e3, 4e3], Sn = [80, 160, 320, 640, 1e3, 1500], jr = [250, 500, 1e3, 2e3, 4e3, 5e3];
function Fn(e, t) {
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
function rr(e) {
  return Ts(e) ? `${e.code || ""}`.trim() : "";
}
function Qt(e, t) {
  const n = rr(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function gl(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (ha(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
        return c;
      a = Rs(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (c) {
      if ((c == null ? void 0 : c.name) === "AbortError") throw c;
      a = c;
      const l = rr(c);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw c;
    }
    const i = Sn[Math.min(s, Sn.length - 1)];
    if (await Fn(i, r), s >= Sn.length + 2) throw a;
  }
}
function bl({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = P(Lt), s = _(o), i = _("");
  s.current = o;
  const c = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = Ht(l) ? l : "";
  return D(() => {
    if (!n || !c) {
      i.current = "", s.current = Lt, a(Lt);
      return;
    }
    const m = r === void 0 ? fi() : r, d = i.current === c;
    if (i.current = c, !m) {
      const b = {
        ...d ? s.current : Lt,
        connection: u ? "terminal" : "unavailable",
        jobStatus: l,
        error: "实时译文暂不可用"
      };
      s.current = b, a(b);
      return;
    }
    const f = new AbortController();
    let g = !1;
    const h = {
      ...d ? s.current : Lt,
      connection: u ? "terminal" : "connecting",
      jobStatus: l,
      error: ""
    };
    s.current = h, a(h);
    const y = (b) => {
      f.signal.aborted || a((v) => {
        const k = b(v);
        return s.current = k, k;
      });
    }, S = async () => {
      let b = 0;
      for (; !f.signal.aborted; )
        try {
          const v = await m.fetchLayout(c, { signal: f.signal });
          g = !0, y((k) => ({
            ...k,
            layoutByPage: ll(v),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (v) {
          if ((v == null ? void 0 : v.name) === "AbortError") return;
          const k = rr(v);
          if (!(k === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !k)) {
            y((L) => ({
              ...L,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: Qt(v, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            y((L) => ({
              ...L,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          y((L) => ({
            ...L,
            connection: "connecting",
            jobStatus: l,
            error: Qt(v, "正在等待 OCR 版面数据")
          })), await Fn(Br[Math.min(b, Br.length - 1)], f.signal).catch(() => {
          }), b += 1;
        }
    };
    return (async () => {
      if (await S(), !g || f.signal.aborted) return;
      let b = 0;
      for (; !f.signal.aborted; ) {
        u || y((v) => ({
          ...v,
          connection: v.lastSeq > 0 ? "reconnecting" : "connecting",
          jobStatus: l,
          // 保留已有错误：首页还没提交（lastSeq 为 0）时恰恰是最容易出错的阶段，
          // 此前这里把它清成空串，UI 于是一直显示「连接中」，用户看到的是
          // "正在努力"，实际可能已经在反复失败。
          error: v.error
        }));
        try {
          await m.streamEvents(c, {
            afterSeq: s.current.lastSeq,
            signal: f.signal,
            onEvent: async (v) => {
              if (v.seq <= s.current.lastSeq) return;
              let k;
              try {
                k = await gl(
                  c,
                  v,
                  s.current,
                  f.signal,
                  m
                );
              } catch (R) {
                if ((R == null ? void 0 : R.name) === "AbortError" || f.signal.aborted) throw R;
                y((L) => ({
                  ...L,
                  lastSeq: Math.max(L.lastSeq, v.seq),
                  error: Qt(R, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((R) => {
                const L = ul(R, v, k);
                return u ? {
                  ...L,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...L,
                  jobStatus: l
                };
              }), b = 0;
            }
          });
        } catch (v) {
          if ((v == null ? void 0 : v.name) === "AbortError" || f.signal.aborted) return;
          y((k) => ({
            ...k,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: l,
            error: Qt(v, "实时译文连接已中断，正在重连")
          }));
        }
        if (f.signal.aborted) return;
        if (u) {
          y((v) => ({
            ...v,
            connection: "terminal",
            jobStatus: l
          }));
          return;
        }
        await Fn(jr[Math.min(b, jr.length - 1)], f.signal).catch(() => {
        }), b += 1;
      }
    })(), () => f.abort();
  }, [n, r, c, u]), o;
}
function yl(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), c = Number(s.count) || 0;
    i && c > 0 && o.set(i, c);
  }
  return o;
}
function vl(e, t = !0) {
  const [n, r] = P(() => /* @__PURE__ */ new Map());
  return D(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = et().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(yl(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const wl = 4500;
function Sl(e) {
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
const kl = /* @__PURE__ */ new Set(["book", "translate"]);
function pa(e) {
  return !!(e.jobId && e.sourceUrl && kl.has(e.workflow));
}
function Il(e) {
  return !!(pa(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function El() {
  const e = Ji(), t = pa({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = Il({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = _({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Ht(o) && (r.current.running = !0);
  const a = bl({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = Zi(), u = vl(e.jobId, !e.sourceOnly), m = pc({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${m}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: f, onZoomChange: g } = wc(e.mode, s, m);
  Oc(i, f, g);
  const h = ec(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: f, shellWidth: c, identityKey: d }
  ), {
    beginModeSwitch: y,
    goToPage: S,
    repinIfRestoring: w
  } = el(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: m,
    restoreReady: h.primaryNumPages > 0
  });
  D(() => {
    w();
  }, [c, w]);
  const b = Vc(
    s,
    h.compareMode,
    h.rowSyncRevision,
    w
  ), v = jc(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${f}-${h.metricsTick}`,
    h.primaryPane
  ), k = N((H, J) => {
    var Y, ae;
    const ue = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((Y = h.numPagesByPane) == null ? void 0 : Y.source) || 0,
      Number((ae = h.numPagesByPane) == null ? void 0 : ae.translated) || 0
    );
    S(H, ue, J);
  }, [S, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [R, L] = P(null), O = _(null), B = N((H) => {
    O.current && clearTimeout(O.current), L(H), H && (O.current = setTimeout(() => L(null), wl));
  }, []);
  D(() => () => {
    O.current && clearTimeout(O.current);
  }, []);
  const M = N((H) => {
    const J = vn(e.regions, H);
    return J ? Mr(J, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), I = N((H, J) => {
    const ue = J || h.primaryPane, Y = typeof H == "object" && H ? `${H.block_id || ""}`.trim() : "", ae = typeof H == "object" && H ? `${H.image_url || ""}`.trim() : "", Se = typeof H == "object" && H ? H.page_idx != null ? Number(H.page_idx) + 1 : H.page != null ? Number(H.page) : null : typeof H == "number" ? H + 1 : null, te = ws(e.regions, ae, Se) || vn(e.regions, Y) || (typeof H == "object" ? Ss(e.regions, H) : null);
    let de = te ? Mr(te, ue).page : null;
    de == null && (de = Sl(H)), !(de == null || de < 1) && (B(te), k(de, ue));
  }, [B, k, h.primaryPane, e.regions]);
  cl({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: v,
    goToPage: k,
    resolveBlockPage: M,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (H) => {
      B(vn(e.regions, H.blockId));
    }
  });
  const { setModeKeepingPage: E } = zc({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: y
  });
  D(() => {
    B(null);
  }, [d, B]);
  const T = !e.boot.loading && !e.boot.failed, x = K(() => ({ bindShell: l, shellEl: i, shellWidth: c, shellRef: s }), [l, i, c, s]), C = K(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), W = K(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: f,
    onZoomChange: g,
    shell: x,
    panes: h,
    sessionFiles: C,
    rowHeights: b,
    goToPage: k,
    activeRegion: R,
    jumpToAnchor: I,
    setModeKeepingPage: E,
    download: e.download,
    showHud: T,
    viewStateKey: m,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, x, h, C, b, k, R, I, E, T, f, g, m, a, n, u]);
  return K(() => ({
    ...W,
    currentPage: v
  }), [W, v]);
}
const Tl = [
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
], Rl = [
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
function Pl(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of Tl)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Ml(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const _l = ".reader-notes-panel";
function Nl(e) {
  return e instanceof Element ? !!e.closest(_l) : !1;
}
function xl(e) {
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
  D(() => {
    if (!u)
      return;
    const m = (d) => {
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || Ml(d.target) || Nl(d.target))
        return;
      const f = d.key, g = Pl(f);
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
              a(Wt(o, 1));
              return;
            case "zoom-out":
              a(Wt(o, -1));
              return;
            case "zoom-reset":
              a(It(t, st()));
              return;
            case "next-page":
              c(fn(s + 1, i));
              return;
            case "prev-page":
              c(fn(s - 1, i));
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
const Al = "retainpdf:soft-reader-close";
function Ll() {
  return new URL("./index.html", window.location.href).href;
}
function Cl() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Al },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Dl(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function $l() {
  if (!(typeof window > "u") && !Cl()) {
    if (Dl(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Ll());
  }
}
function Ol({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function zl({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ A(Ol, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), $l();
  }, children: [
    /* @__PURE__ */ p(bt, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
const Fl = 3e3, Bl = 8;
async function jl(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function Hl(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function Ul(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = Fl;
  const r = [], o = (s, i, c) => {
    const l = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const m = s[u], d = Hl(m == null ? void 0 : m.title);
      if (!d) continue;
      n -= 1;
      const f = c ? `${c}.${u}` : `${u}`, g = { id: f, title: d, page: null, level: i, children: [] };
      r.push({ node: g, dest: m.dest }), l.push(g), i < Bl && Array.isArray(m.items) && m.items.length && (g.children = o(m.items, i + 1, f));
    }
    return l;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await jl(e, i);
  })), a;
}
function ga(e) {
  const t = [], n = (r) => {
    for (const o of r)
      t.push(o), n(o.children);
  };
  return n(e), t;
}
function ba(e, t) {
  let n = null;
  for (const r of ga(e))
    r.page === null || r.page > t || (!n || r.page > (n.page ?? 0) || r.page === n.page && r.id.startsWith(`${n.id}.`)) && (n = r);
  return (n == null ? void 0 : n.id) ?? null;
}
function Hr(e) {
  if (!e) return [];
  const t = e.split(".");
  return t.slice(0, -1).map((n, r) => t.slice(0, r + 1).join("."));
}
let Ur = !1;
function Wl() {
  if (Ur)
    return;
  const e = Ut().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (Go.GlobalWorkerOptions.workerSrc = e, Ur = !0);
}
const at = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Kl = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Vl = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, ql = {
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
}, Wr = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function Jl(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Wr(o ?? a ?? "", Kl)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Wr(o ?? a ?? "", Vl)).replace(/\\([a-zA-Z]+)/gu, (r, o) => ql[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Gl(e) {
  return at(e.translatedBlockText) || at(e.translated.text) || at(e.source.text);
}
const Xl = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Yl(e) {
  const t = [];
  for (const n of e) {
    if (!Xl(n)) continue;
    const r = Jl(Gl(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function Zl(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const Ql = 24, eu = 60;
function Kr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - Ql), o = Math.min(e.length, n + t.length + eu), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function tu(e, t, n = 200) {
  const r = at(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = at(a.translatedBlockText) || at(a.translated.text), c = i ? Kr(i, r) : null, l = c ?? Kr(at(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: c ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
function en(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function $t(e, t) {
  const n = at(t).toLowerCase();
  if (!n || !e) return en(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${en(e.slice(a, s))}<mark class="reader-find-mark">${en(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + en(e.slice(a));
}
function nu(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const ru = /^data-[a-z0-9-]+$/;
function Vr(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function ou(e, t, n = "") {
  if (!t.length) return $t(e, n);
  const r = t.filter((s) => s.end > s.start && s.start >= 0 && s.end <= e.length).map((s, i) => ({ mark: s, order: i })).sort((s, i) => s.mark.start - i.mark.start || s.order - i.order).map(({ mark: s }) => s);
  let o = "", a = 0;
  for (const s of r) {
    if (s.start < a) continue;
    o += $t(e.slice(a, s.start), n);
    const i = Object.entries(s.attrs ?? {}).filter(([c]) => ru.test(c)).map(([c, l]) => ` ${c}="${Vr(l)}"`).join("");
    o += `<mark class="${Vr(s.className)}"${i}>${$t(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  }
  return o + $t(e.slice(a), n);
}
function we(e) {
  return typeof e == "string" ? e : "";
}
function au(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function su(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function iu(e) {
  return {
    source: we(e == null ? void 0 : e.source_text) || we(e == null ? void 0 : e.unit_source_text),
    translated: we(e == null ? void 0 : e.protected_translated_text) || we(e == null ? void 0 : e.translated_text)
  };
}
const cu = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function ya(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function lu(e) {
  const t = ya(e).sort((r, o) => we(r.ts).localeCompare(we(o.ts)));
  return t.length ? [
    { text: we(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: we(r.new_text),
      label: cu[we(r.source)] || we(r.source) || "修订",
      ts: we(r.ts),
      reason: we(r.reason)
    }))
  ].reverse() : [];
}
function uu(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function du(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return we(r.finished_at) || we(n.finished_at) || "";
}
function fu(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = ya(e).sort((a, s) => we(a.ts).localeCompare(we(s.ts)));
  for (const a of o) {
    const s = new Date(we(a.ts)).getTime(), i = we(a.reader_item_id) || we(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, we(a.new_text));
  }
  return n;
}
const mu = {
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
function hu(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = mu[we(n.kind)] || we(n.kind) || "问题", o = we(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const pu = /* @__PURE__ */ new Set(["text", "formula"]);
function or(e) {
  return pu.has(e);
}
function va(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || or(Be(n));
}
function gu(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !or(Be(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const bu = 300, yu = 72;
function vu(e, t) {
  if (e.width >= bu && e.height >= yu)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const wu = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function Su(e, t, n) {
  return e.flatMap((r) => {
    if (!wu.has(Be(r.region))) return [];
    const o = gt(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function qr(e, t, n) {
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
async function ku(e) {
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
const Iu = "reader-text-hover-copy", Eu = "reader-text-hover-edit", Tu = "reader-text-hover-zoom", Ru = "reader-text-hover-id";
function Pu(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const wa = "reader-text-hover-tools";
function tn({
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
const Mu = 26, _u = 220;
function Nu(e, t = _u) {
  return e.height < Mu * 2 || e.width < t;
}
function xu({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? Ho : e === "failed" ? bt : _s, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function Au({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  onZoom: o,
  frameRect: a,
  placement: s,
  tailTop: i = 0
}) {
  const [c, l] = P("idle"), [u, m] = P("idle"), [d] = P(() => Pu()), f = _([]), g = (e == null ? void 0 : e.itemId) || "";
  if (D(() => {
    l("idle"), m("idle");
    const k = f.current;
    return () => {
      k.forEach((R) => window.clearTimeout(R)), f.current = [];
    };
  }, [g]), !e) return null;
  const h = ks(e.highlight.region, t), y = Be(e.highlight.region), S = (k, R) => async (L) => {
    L.preventDefault(), L.stopPropagation();
    const O = await ku(k);
    R(O ? "copied" : "failed"), f.current.push(window.setTimeout(() => R("idle"), 1200));
  }, w = y === "formula" ? "复制 LaTeX" : "复制", b = a || e.rect, v = s || (Nu(b) ? "outside" : "inside");
  return /* @__PURE__ */ p("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ p(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": y,
      style: b,
      children: /* @__PURE__ */ A(
        "div",
        {
          className: wa,
          "data-placement": v,
          style: v === "tail" ? { top: i } : void 0,
          children: [
            d ? /* @__PURE__ */ p(
              tn,
              {
                className: Ru,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: S(e.itemId, m),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && or(y) ? /* @__PURE__ */ p(
              tn,
              {
                className: Eu,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (k) => {
                  k.preventDefault(), k.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ p(Zn, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            h ? /* @__PURE__ */ p(
              tn,
              {
                className: Iu,
                state: c,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: c === "copied" ? "已复制" : c === "failed" ? "复制失败" : w,
                onClick: S(h, l),
                children: /* @__PURE__ */ p(xu, { state: c })
              }
            ) : null,
            o ? /* @__PURE__ */ p(
              tn,
              {
                className: Tu,
                state: "idle",
                label: "放大看这一块",
                title: y === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (k) => {
                  k.preventDefault(), k.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ p(Ms, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Lu(e, t) {
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
function Cu(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = gt(
      Lu(e, a),
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
const Du = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', $u = 256, Ct = /* @__PURE__ */ new Map();
function Ou(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Sa(e) {
  const t = `${e || ""}`, { text: n, slots: r } = ai(t, { bareLatex: !0 }), o = Ou(n), a = si(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = Ct.get(t);
  if (!s && (s = ii(o, r), Ct.set(t, s), Ct.size > $u)) {
    const i = Ct.keys().next().value;
    i !== void 0 && Ct.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function kn(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Xe(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function zu(e, t) {
  const n = e.typography, r = Xe(t) || 1, o = Xe(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = kn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(s, i * r)), l = Xe(n == null ? void 0 : n.fit_min_font_size_pt), u = Xe(n == null ? void 0 : n.fit_max_font_size_pt), m = Math.max(3.5, (l || 5.5) * r), d = Math.max(
    m,
    u ? u * r : o ? o * r : c
  ), f = o ? o * r : c, g = Xe(n == null ? void 0 : n.leading_em), h = [
    Xe(n == null ? void 0 : n.padding_top_pt) || 0,
    Xe(n == null ? void 0 : n.padding_right_pt) || 0,
    Xe(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Xe(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((y) => y * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Du,
    fontSizePx: Math.max(m, Math.min(d, f)),
    minFontSizePx: m,
    maxFontSizePx: d,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (kn(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : kn(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function Fu(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), i = (m) => {
    const d = s.get(m);
    if (d !== void 0) return d;
    const { width: f, height: g } = e(m), h = f <= t + 0.5 && g <= n + 0.5;
    return s.set(m, h), h;
  };
  let c = o, l = a, u = Math.min(r.requestedFontSizePx, l);
  if (i(u)) {
    if (!r.exact) {
      c = u;
      for (let m = 0; m < 6 && l > c; m += 1) {
        const d = (c + l) / 2;
        i(d) ? (u = d, c = d) : l = d;
      }
    }
  } else {
    l = u, u = c;
    for (let m = 0; m < 8 && l > c; m += 1) {
      const d = (c + l) / 2;
      i(d) ? (u = d, c = d) : l = d;
    }
  }
  return Math.max(o, u);
}
const Bu = 512, Dt = /* @__PURE__ */ new Map();
let Bn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Bn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Bn += 1;
}));
function ju(e, t, n, r) {
  return [
    Bn,
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
function ka({ item: e, pageScale: t }) {
  const n = _(null), r = K(
    () => Sa(e.translatedText),
    [e.translatedText]
  ), [o, a] = P(r.fallbackHtml), s = K(
    () => zu(e, t),
    [e, t]
  );
  D(() => {
    let m = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((d) => {
      m && a(d);
    }), () => {
      m = !1;
    };
  }, [r]), De(() => {
    const m = n.current;
    if (!m) return;
    const [d, f, g, h] = s.padding, y = Math.max(1, e.rect.width - h - f), S = Math.max(1, e.rect.height - d - g), w = ju(o, y, S, s);
    let b = Dt.get(w);
    if (b === void 0 && (b = Fu(
      (v) => (m.style.fontSize = `${v}px`, { width: m.scrollWidth, height: m.scrollHeight }),
      y,
      S,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), Dt.set(w, b), Dt.size > Bu)) {
      const v = Dt.keys().next().value;
      v !== void 0 && Dt.delete(v);
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
function Hu({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = K(
    () => Cu(e, t, n, r),
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
        ka,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Uu = Jt(Hu);
function Wu({
  targets: e,
  edits: t,
  width: n,
  excludeId: r
}) {
  const o = e.filter((a) => t.has(a.itemId) && a.itemId !== r);
  return o.length ? /* @__PURE__ */ p("div", { className: "reader-live-translation-overlay reader-edited-overlay", "aria-hidden": "true", children: o.map((a) => {
    const s = a.highlight.pageSize.width;
    return /* @__PURE__ */ A("div", { className: "reader-edited-block", "data-reader-edited-id": a.itemId, children: [
      /* @__PURE__ */ p(
        ka,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: Be(a.highlight.region),
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
const Ku = Jt(Wu), Ia = 24, rt = Ia * 2 + 4, Ye = 24, Vu = 4, qu = 6, ft = (e) => e.left + e.width, ct = (e) => e.top + e.height;
function Ot(e, t) {
  const n = Math.min(ft(e), ft(t)) - Math.max(e.left, t.left), r = Math.min(ct(e), ct(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const Jr = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= ft(t) && r >= t.top && r <= ct(t);
}, Ju = (e) => e.height > 40 && e.height > e.width * 2.5;
function Gu(e, t, n) {
  if (!t.length || e.height < Ye || e.width < n + 8) return null;
  const r = Math.max(...t.map(ct)), o = ft(e) - 4 - n;
  for (const a of [r, ct(e) - 2]) {
    const s = Math.max(e.top, a - Ye), i = { left: o, top: s, width: n, height: Ye };
    if (!t.some((c) => Ot(i, c) > 0)) return s - e.top;
  }
  return null;
}
function Xu(e, t) {
  const n = [], r = (a) => {
    const s = Ia + Vu, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: ft(e), top: i, width: s, height: rt } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: rt } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - Ye - 3, width: rt, height: Ye + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: ct(e), width: rt, height: Ye + 3 } }), r(!0);
  const o = Gu(e, t, rt);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: ft(e) - 4 - rt, top: e.top + o, width: rt, height: Ye } }), n;
}
function Yu(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((w) => w.width > 0 && w.height > 0 && !Ju(w)), i = s.filter((w) => Jr(w, t)), c = s.filter((w) => !Jr(w, t)), l = n.filter((w) => w !== t && Ot(w, t) < t.width * t.height * 0.5), u = Xu(t, i).filter(({ box: w, overhang: b }) => {
    const v = b ? qu : 0;
    return w.left >= -v && ft(w) <= r + v && w.top >= 0 && ct(w) <= o;
  }), m = ({ placement: w, tailTop: b }) => b === void 0 ? { placement: w } : { placement: w, tailTop: b }, d = ({ box: w }) => !c.some((b) => Ot(w, b) > 0), f = u.filter((w) => w.placement !== "tail"), g = f.find((w) => d(w) && !l.some((b) => Ot(w.box, b) > 0));
  if (g) return m(g);
  const h = f.find(d) || u.find((w) => w.placement === "tail" && d(w));
  if (h) return m(h);
  let y = null, S = Number.POSITIVE_INFINITY;
  for (const w of u) {
    const b = c.reduce((v, k) => v + Ot(w.box, k), 0);
    b < S && (y = w, S = b);
  }
  return y ? m(y) : { placement: "outside" };
}
function Zu(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - Ye - 3 : ct(r);
  return t >= r.left - 4 && t <= r.left + rt + 4 && n >= a && n <= a + Ye + 3;
}
const In = (e) => e.left + e.width, En = (e) => e.top + e.height;
function Qu(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const l of t) {
    if (l.width <= 0 || l.height <= 0) continue;
    const u = l.left + l.width / 2, m = l.top + l.height / 2;
    u < e.left || u > In(e) || m < e.top || m > En(e) || (o = Math.min(o, l.left), a = Math.min(a, l.top), s = Math.max(s, In(l)), i = Math.max(i, En(l)));
  }
  if (!Number.isFinite(o)) return e;
  const c = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return c.width = Math.min(In(e) + r, s + n) - c.left, c.height = Math.min(En(e) + r, i + n) - c.top, c.width * c.height < e.width * e.height * 0.3 && c.height < 24 ? e : c;
}
function ed(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function td(e, t, n, r) {
  const [o, a] = P(null);
  return De(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? ed(s) : [], c = Be(t.highlight.region) === "figure", l = i.length && !c ? Qu(t.rect, i) : t.rect, u = n.filter((d) => d.itemId !== t.itemId).map((d) => d.rect), m = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...Yu({ frame: l, others: u, pageWidth: r, pageHeight: m, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
function nd({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = P(null), [i, c] = P(!1), [l, u] = P([]), [m, d] = P(""), [f, g] = P(""), [h, y] = P(!1), [S, w] = P(null), [b, v] = P([]), k = r.drafts, R = r.generation, L = N(async (I, E) => {
    if (e)
      try {
        u(lu(await e.fetchRevisions(I, E)));
      } catch {
        u([]);
      }
  }, [e]);
  D(() => {
    if (s(null), u([]), w(null), v([]), g(""), !e || !t || !n) return;
    let I = !1;
    return c(!0), e.loadItem(t, n).then((E) => {
      if (I) return;
      const T = E == null ? void 0 : E.item;
      if (!T) throw new Error("找不到这一段的译文。");
      const x = `${(E == null ? void 0 : E.item_id) || n}`, { source: C, translated: W } = iu(T);
      s({ readerItemId: n, itemId: x, source: C, current: W }), d(k.get(n) ?? W);
    }).catch((E) => {
      I || w({ tone: "error", message: (E == null ? void 0 : E.message) || "读取这段译文失败。" });
    }).finally(() => {
      I || c(!1);
    }), L(t, n), () => {
      I = !0;
    };
  }, [e, t, n, L]);
  const O = N((I) => {
    d(I), n && k.set(n, I);
  }, [n, k]), B = N(async (I, E) => {
    if (!e || !a || h) return !1;
    const T = I ?? m;
    if (!T.trim()) return !1;
    y(!0), w(null), v([]);
    try {
      const x = await e.revise(t, a.itemId, {
        translated_text: T,
        source: "user",
        reason: (E ?? f).trim() || "在阅读页手动修改",
        ...R.current != null ? { expected_generation: R.current } : {}
      }), C = Number(x == null ? void 0 : x.generation);
      return Number.isFinite(C) && (R.current = C), k.delete(a.readerItemId), s({ ...a, current: T }), d(T), g(""), (x == null ? void 0 : x.changed) === !1 ? w({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, T), w({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), L(t, a.readerItemId), !0;
    } catch (x) {
      const C = x;
      return (C == null ? void 0 : C.reason) === "generation_mismatch" && (R.current = null), w({ tone: "error", message: (C == null ? void 0 : C.message) || "保存失败，请稍后再试。" }), v(hu(C == null ? void 0 : C.issues)), !1;
    } finally {
      y(!1);
    }
  }, [e, a, h, m, f, t, o, L, k, R]), M = N(() => {
    n && k.delete(n);
  }, [n, k]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: l,
    draft: m,
    setDraft: O,
    reason: f,
    setReason: g,
    saving: h,
    status: S,
    issues: b,
    save: B,
    discardDraft: M
  };
}
const Ea = "reader-inline-edit";
function rd({ text: e }) {
  const [t, n] = P("");
  return D(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = Sa(e);
      n(a.fallbackHtml), a.richHtml.then((s) => {
        r && n(s);
      });
    }, 250);
    return () => {
      r = !1, window.clearTimeout(o);
    };
  }, [e]), t ? /* @__PURE__ */ A("div", { className: "reader-inline-edit-preview", "data-inline-edit-preview": "true", children: [
    /* @__PURE__ */ p("span", { className: "reader-inline-edit-preview-label", children: "预览" }),
    /* @__PURE__ */ p("div", { className: "reader-live-translation-content", dangerouslySetInnerHTML: { __html: t } })
  ] }) : null;
}
function od({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var M;
  const s = e.itemId, i = nd({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = P(!1), [u, m] = P(!1), d = _(null), f = vu(e.rect, t), g = K(() => gu(o), [o]), h = g.indexOf(s), { loaded: y } = i, S = i.saving || i.loading, w = n.blockedReason, b = !y || i.draft === y.current, { close: v, select: k } = n, R = N((I) => {
    const E = g[h + I];
    E && (k(E), a == null || a(E));
  }, [g, h, k, a]), L = N(() => {
    i.discardDraft(), v();
  }, [i, v]), O = N(async (I, E) => {
    await i.save(I, E) && v();
  }, [i, v]);
  D(() => {
    const I = (E) => {
      !E.altKey || E.key !== "ArrowUp" && E.key !== "ArrowDown" || (E.preventDefault(), R(E.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", I), () => window.removeEventListener("keydown", I);
  }, [R]), De(() => {
    const I = d.current;
    if (!I) return;
    I.style.height = "auto";
    const E = f.mode === "inline" ? f.minHeight : 0;
    I.style.height = `${Math.max(E, I.scrollHeight + 2)}px`;
  }, [i.draft, y, f.mode, f.mode === "inline" ? f.minHeight : 0]);
  const B = f.mode === "inline" ? { left: f.left, top: f.top, width: f.width } : { left: f.left, width: f.width, top: f.top, bottom: f.bottom };
  return /* @__PURE__ */ A(Oe, { children: [
    f.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ A(
      "div",
      {
        className: `${Ea} is-${f.mode}`,
        style: B,
        role: "group",
        "aria-label": `改第 ${((M = n.target) == null ? void 0 : M.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": f.mode,
        onPointerDown: (I) => I.stopPropagation(),
        children: [
          r && (y != null && y.source) ? /* @__PURE__ */ p(
            oe,
            {
              className: `reader-inline-edit-source${c ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: c ? "收起原文" : "展开原文",
              onClick: () => l((I) => !I),
              children: y.source
            }
          ) : null,
          w ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: w }) : null,
          i.loading ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          y ? /* @__PURE__ */ p(
            ni,
            {
              ref: d,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: S || !!w,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (I) => i.setDraft(I.target.value),
              onKeyDown: (I) => {
                I.key === "Enter" && (I.metaKey || I.ctrlKey) ? (I.preventDefault(), b || O()) : I.key === "Escape" && (I.preventDefault(), L());
              }
            }
          ) : null,
          y ? /* @__PURE__ */ p(rd, { text: i.draft }) : null,
          /* @__PURE__ */ A("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(ut, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => R(-1), children: /* @__PURE__ */ p(Ns, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(ut, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= g.length - 1, onClick: () => R(1), children: /* @__PURE__ */ p(Uo, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              Jo,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: S || !!w || !y,
                onChange: (I) => i.setReason(I.target.value),
                onKeyDown: (I) => {
                  I.key === "Enter" ? (I.preventDefault(), b || O()) : I.key === "Escape" && (I.preventDefault(), L());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ A(
              oe,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": u,
                "data-block-edit-action": "history",
                onClick: () => m((I) => !I),
                children: [
                  /* @__PURE__ */ p(xs, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ p(oe, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: L, children: "取消" }),
            /* @__PURE__ */ p(
              oe,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: S || !!w || b || !i.draft.trim(),
                pending: i.saving,
                onClick: () => {
                  O();
                },
                children: "保存"
              }
            )
          ] }),
          i.status ? /* @__PURE__ */ p("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ p("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((I) => /* @__PURE__ */ p("li", { children: I }, I)) }) : null,
          u && y && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((I, E) => {
            const T = I.text === y.current, x = [uu(I.ts), I.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ A("li", { "data-block-edit-history": I.label, "data-current": T ? "true" : void 0, children: [
              /* @__PURE__ */ A("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ A("span", { children: [
                  x,
                  T ? "（现在用的）" : "",
                  I.reason ? ` · ${I.reason}` : ""
                ] }),
                T ? null : /* @__PURE__ */ p(
                  oe,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: S || !!w,
                    onClick: () => {
                      O(I.text, `回到「${x.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ p("p", { className: "reader-inline-edit-history-text", children: I.text })
            ] }, `${I.ts}:${E}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const Ta = Gt(null), Ra = Gt(null);
function ad({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(Ta.Provider, { value: e, children: /* @__PURE__ */ p(Ra.Provider, { value: t, children: n }) });
}
function tt() {
  return dt(Ta);
}
function Pa() {
  return dt(Ra);
}
const Ma = 1.414;
function sd({
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
  regionTargets: d = [],
  hoveredRegionId: f,
  onHoverRegion: g,
  liveTranslationLayout: h,
  liveTranslationPage: y,
  showLiveTranslation: S = r === "source",
  liveTranslationMissing: w = !1
}) {
  var X, pe;
  const b = tt(), v = b == null ? void 0 : b.revisedBlocks, k = b == null ? void 0 : b.blockEdit, R = k == null ? void 0 : k.pendingEdits, L = b == null ? void 0 : b.editBlock, O = (b == null ? void 0 : b.findTerm) || "", B = r === "translated" ? "translated" : b != null && b.compareVersion ? "compare" : "source", M = b == null ? void 0 : b.textMarks, I = K(
    () => M ? ({ str: F }) => ou(F, M(F), O) : O ? ({ str: F }) => $t(F, O) : void 0,
    [O, M]
  ), E = _(c ?? Ma), [T, x] = P(E.current);
  D(() => {
    c != null && Math.abs(c - E.current) >= 1e-3 && (E.current = c, x(c));
  }, [c]);
  const C = _(u);
  C.current = u;
  const W = _(null), H = _((F) => {
    var Z;
    W.current = F, (Z = C.current) == null || Z.call(C, F);
  }).current, J = _(null), ue = _(`${t}@${n}`);
  De(() => {
    const F = `${t}@${n}`;
    ue.current !== F && (ue.current = F, o && cd(W.current, J.current));
  }, [o, n, t]), D(() => {
    o || Tn(J.current);
  }, [o]), D(() => () => Tn(J.current), []);
  const Y = Math.max(120, Math.floor(t * T)), ae = Math.max(Y, Math.ceil(s || 0)), Se = gt(m, t, Y), te = K(
    () => Su(d, t, Y),
    [Y, d, t]
  ), [de, Pe] = P(null), ie = typeof g == "function", ne = ie ? f ?? null : de, z = (F) => {
    ie ? F !== (f ?? null) && (g == null || g(F)) : Pe((Z) => Z === F ? Z : F);
  }, U = K(
    () => te.find((F) => F.itemId === ne) || null,
    [ne, te]
  ), q = r === "translated" && ((X = k == null ? void 0 : k.target) == null ? void 0 : X.itemId) || "", fe = K(
    () => q && te.find((F) => F.itemId === q) || null,
    [q, te]
  ), se = td(W, o ? U : null, te, t), me = (F) => {
    var xe, Ae, $e, je;
    if (F.pointerType === "touch") return;
    if (b != null && b.pointerTaken) {
      z(null);
      return;
    }
    if (F.buttons !== 0) {
      z(null);
      return;
    }
    if ((Ae = (xe = F.target) == null ? void 0 : xe.closest) != null && Ae.call(xe, `.${wa}`) || (je = ($e = F.target) == null ? void 0 : $e.closest) != null && je.call($e, `.${Ea}`)) return;
    const Z = F.currentTarget.getBoundingClientRect(), he = F.clientX - Z.left, Me = F.clientY - Z.top;
    if (Zu(se, he, Me)) return;
    const _e = qr(te, he, Me);
    z((_e == null ? void 0 : _e.itemId) || null);
  }, ke = (F) => {
    if (F.pointerType === "mouse") return;
    const Z = F.currentTarget.getBoundingClientRect(), he = qr(
      te,
      F.clientX - Z.left,
      F.clientY - Z.top
    );
    z((he == null ? void 0 : he.itemId) || null);
  }, ce = (F) => {
    !Number.isFinite(F) || F <= 0 || Math.abs(E.current - F) < 1e-3 || (E.current = F, x(F), l == null || l(e, F));
  };
  return /* @__PURE__ */ A(
    "div",
    {
      ref: H,
      [Ee]: e,
      [Ie]: r,
      [Qn]: Y,
      className: er,
      onPointerMoveCapture: me,
      onPointerDown: ke,
      onDoubleClick: (F) => {
        const Z = b == null ? void 0 : b.zoomBlock;
        !Z || b != null && b.pointerTaken || !U || Be(U.highlight.region) === "figure" && (F.preventDefault(), Z(U.itemId));
      },
      onPointerLeave: (F) => {
        F.pointerType === "mouse" && z(null);
      },
      style: {
        width: t,
        height: ae,
        minHeight: ae
      },
      children: [
        o ? /* @__PURE__ */ p(
          ri,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: I,
            renderAnnotationLayer: !1,
            className: ea,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: cn,
                style: { width: t, height: Y }
              }
            ),
            onLoadSuccess: (F) => {
              try {
                const Z = F.getViewport({ scale: 1 });
                if (Z.width > 0) {
                  const he = Z.height / Z.width;
                  ce(he);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              Tn(J.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ p(
          "div",
          {
            className: cn,
            style: { width: t, height: Y },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: J, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        Se ? /* @__PURE__ */ p(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": m == null ? void 0 : m.itemId,
            style: Se,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && S ? /* @__PURE__ */ p(
          Uu,
          {
            layoutPage: h,
            pageState: y,
            width: t,
            height: Y
          }
        ) : null,
        o && S && w ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (R != null && R.size) ? /* @__PURE__ */ p(Ku, { targets: te, edits: R, width: t, excludeId: fe == null ? void 0 : fe.itemId }) : null,
        o && fe && k ? /* @__PURE__ */ p(
          od,
          {
            target: fe,
            page: { width: t, height: Y },
            edit: k,
            showSource: !!(b != null && b.editShowsSource),
            regions: b == null ? void 0 : b.regions,
            jumpToBlock: b == null ? void 0 : b.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (v != null && v.size) ? /* @__PURE__ */ p("div", { className: "reader-revised-markers", "aria-hidden": "true", children: te.filter((F) => v.has(F.itemId)).map((F) => /* @__PURE__ */ p(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": F.itemId,
            style: { left: F.rect.left, top: F.rect.top, height: F.rect.height }
          },
          F.itemId
        )) }) : null,
        (pe = b == null ? void 0 : b.pageLayers) == null ? void 0 : pe.map((F) => /* @__PURE__ */ p(Xn, { children: F.render({ page: e, width: t, height: Y, pane: B, active: o }) }, F.id)),
        /* @__PURE__ */ p(
          Au,
          {
            target: o && !(b != null && b.pointerTaken) && (U == null ? void 0 : U.itemId) !== (fe == null ? void 0 : fe.itemId) ? U : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: U && (v == null ? void 0 : v.get(U.itemId)) || 0,
            onEdit: L,
            onZoom: b == null ? void 0 : b.zoomBlock,
            frameRect: se == null ? void 0 : se.rect,
            placement: se == null ? void 0 : se.placement,
            tailTop: se == null ? void 0 : se.tailTop
          }
        )
      ]
    }
  );
}
const id = Jt(sd);
function cd(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function Tn(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const ld = 2 * 1024 * 1024;
function ud(e) {
  const t = new Go.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const Rn = 5, dd = "120% 0px", fd = 120, md = "25% 0px";
let Gr = 1;
const Xr = /* @__PURE__ */ new WeakMap();
function hd(e) {
  if (!e) return 0;
  const t = Xr.get(e);
  if (t) return t;
  const n = Gr;
  return Gr += 1, Xr.set(e, n), n;
}
function pd() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const gd = Oo(
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
    onOutline: d,
    onDocument: f,
    onLoadError: g,
    onNumPagesChange: h,
    activeRegion: y = null,
    regions: S = [],
    readerMetadata: w = null,
    hoveredRegionId: b = null,
    onHoverRegion: v,
    liveTranslation: k,
    showLiveTranslation: R = t === "source",
    liveTranslationPendingLabel: L = "",
    paneAction: O
  }, B) {
    Wl();
    const { file: M, loading: I, error: E } = Hi(n, r), T = `${n}\0${hd(M)}`, x = _(T);
    x.current = T;
    const C = K(() => {
      const j = $i(M);
      return j ? "ranged" in j ? { range: ud(j.ranged) } : j : null;
    }, [M, n]), [W, H] = P(0), [J, ue] = P(""), [Y, ae] = P(null), [Se, te] = P(480), de = _(null), Pe = _(0), ie = K(() => pd(), []), ne = K(() => ({
      cMapUrl: Ut().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: Ut().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: ld,
      disableAutoFetch: !0
    }), []);
    Yn(B, () => Y, [Y]), D(() => {
      const j = (G) => {
        Pe.current = G, te(G);
      }, ee = (G) => {
        const be = uc(G, Pe.current);
        if (be !== "ignore") {
          if (de.current && clearTimeout(de.current), be === "immediate") {
            j(G);
            return;
          }
          de.current = setTimeout(() => j(G), aa);
        }
      }, Q = !!(c && c >= 80);
      ee(Q ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const ye = !Q && i && typeof ResizeObserver < "u" ? new ResizeObserver((G) => {
        var be, Te;
        ee(((Te = (be = G[0]) == null ? void 0 : be.contentRect) == null ? void 0 : Te.width) ?? i.clientWidth);
      }) : null;
      return ye && i && ye.observe(i), () => {
        ye == null || ye.disconnect(), de.current && clearTimeout(de.current);
      };
    }, [c, i, a]);
    const z = K(
      () => ic(Se, o),
      [Se, o]
    ), [U, q] = P(() => /* @__PURE__ */ new Map()), [fe, se] = P(() => /* @__PURE__ */ new Set()), [me, ke] = P(() => /* @__PURE__ */ new Set()), ce = _(/* @__PURE__ */ new Map()), X = _(null), pe = _(null), [F, Z] = P(() => /* @__PURE__ */ new Set()), he = _(/* @__PURE__ */ new Map()), Me = N((j, ee) => {
      q((Q) => {
        if (Q.get(j) === ee) return Q;
        const le = new Map(Q);
        return le.set(j, ee), le;
      });
    }, []), _e = N((j, ee) => {
      const Q = ce.current, le = Q.get(j), ye = [X.current, pe.current];
      if (le)
        for (const G of ye)
          try {
            G == null || G.unobserve(le);
          } catch {
          }
      if (ee) {
        Q.set(j, ee);
        for (const G of ye)
          try {
            G == null || G.observe(ee);
          } catch {
          }
      } else
        Q.delete(j);
    }, []), xe = _(/* @__PURE__ */ new Map()), Ae = N((j) => {
      const ee = xe.current;
      let Q = ee.get(j);
      return Q || (Q = (le) => _e(j, le), ee.set(j, Q)), Q;
    }, [_e]);
    D(() => {
      if (typeof IntersectionObserver > "u") return;
      const j = he.current, ee = new IntersectionObserver(
        (Q) => {
          const le = [], ye = [];
          for (const G of Q) {
            const be = G.target, Te = un(be);
            Number.isFinite(Te) && (G.isIntersecting ? le : ye).push(Te);
          }
          if ((le.length || ye.length) && se((G) => {
            let be = null;
            for (const Te of le)
              G.has(Te) || (be = be || new Set(G), be.add(Te));
            for (const Te of ye)
              G.has(Te) && (be = be || new Set(G), be.delete(Te));
            return be || G;
          }), le.length) {
            for (const G of le) {
              const be = j.get(G);
              be && (clearTimeout(be), j.delete(G));
            }
            ke((G) => {
              let be = null;
              for (const Te of le)
                G.has(Te) || (be = be || new Set(G), be.add(Te));
              return be || G;
            });
          }
          for (const G of ye)
            j.has(G) || j.set(G, setTimeout(() => {
              j.delete(G), ke((be) => {
                if (!be.has(G)) return be;
                const Te = new Set(be);
                return Te.delete(G), Te;
              });
            }, fd));
        },
        { root: i, rootMargin: dd, threshold: 0 }
      );
      X.current = ee;
      for (const Q of ce.current.values())
        try {
          ee.observe(Q);
        } catch {
        }
      return () => {
        ee.disconnect(), X.current === ee && (X.current = null);
        for (const Q of j.values()) clearTimeout(Q);
        j.clear();
      };
    }, [i]), D(() => {
      if (typeof IntersectionObserver > "u") return;
      const j = new IntersectionObserver(
        (ee) => {
          Z((Q) => {
            let le = null;
            for (const ye of ee) {
              const G = un(ye.target);
              !Number.isFinite(G) || ye.isIntersecting === Q.has(G) || (le = le || new Set(Q), ye.isIntersecting ? le.add(G) : le.delete(G));
            }
            return le || Q;
          });
        },
        { root: i, rootMargin: md, threshold: 0 }
      );
      pe.current = j;
      for (const ee of ce.current.values())
        try {
          j.observe(ee);
        } catch {
        }
      return () => {
        j.disconnect(), pe.current === j && (pe.current = null);
      };
    }, [i]);
    const $e = !!i && typeof IntersectionObserver < "u";
    De(() => {
      H(0), ue(""), se(/* @__PURE__ */ new Set()), ke(/* @__PURE__ */ new Set()), q(/* @__PURE__ */ new Map()), ce.current.clear();
      const j = he.current;
      for (const ee of j.values()) clearTimeout(ee);
      j.clear(), h == null || h(0, t);
    }, [T, h, t]);
    const je = N(
      (j) => {
        if (x.current !== T) return;
        const ee = j.numPages;
        H(ee), ue(""), h == null || h(ee, t), m == null || m({ numPages: ee, pane: t }), f && typeof j.getPage == "function" && f(j, t), d && typeof j.getOutline == "function" && Ul(j).then((Q) => {
          x.current === T && d(Q, t);
        }, () => {
        });
      },
      [T, m, d, f, h, t]
    ), Ue = N(
      (j) => {
        if (x.current !== T) return;
        const ee = (j == null ? void 0 : j.message) || "PDF 解析失败";
        ue(ee), H(0), h == null || h(0, t), g == null || g(j, t);
      },
      [T, g, h, t]
    ), $ = K(
      () => W > 0 ? Array.from({ length: W }, (j, ee) => ee + 1) : [],
      [W]
    );
    D(() => {
      typeof IntersectionObserver < "u" || ke(new Set($));
    }, [$]);
    const V = K(
      () => Pt(y, w, t),
      [y, w, t]
    ), re = K(() => {
      const j = /* @__PURE__ */ new Map();
      for (const ee of S) {
        const Q = Pt(ee, w, t);
        if (!Q) continue;
        const le = j.get(Q.box.page) || [];
        le.push(Q), j.set(Q.box.page, le);
      }
      return j;
    }, [t, w, S]), ve = K(() => {
      const j = /* @__PURE__ */ new Set();
      if (!b) return j;
      for (const [ee, Q] of re)
        Q.some((le) => le.itemId === b) && j.add(ee);
      return j;
    }, [b, re]), Le = K(() => {
      if (W === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set($);
      if (fe.size === 0) {
        const Q = Math.min(W, Rn * 2 + 1);
        return new Set(Array.from({ length: Q }, (le, ye) => ye + 1));
      }
      const ee = /* @__PURE__ */ new Set();
      for (const Q of fe)
        for (let le = -Rn; le <= Rn; le++) {
          const ye = Q + le;
          ye >= 1 && ye <= W && ee.add(ye);
        }
      return ee;
    }, [W, $, i, a, fe]), Ce = !n || !!E || !!J, qe = n && (E || J) || s;
    return /* @__PURE__ */ A(
      "section",
      {
        ref: ae,
        className: `reader-panel ${pn}${a ? "" : " is-hidden"}`,
        [Ie]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (k == null ? void 0 : k.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          O ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: O }) : null,
          L ? /* @__PURE__ */ A("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: L })
          ] }) : null,
          Ce && !I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: qe }) : null,
          I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          C && !E ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            oi,
            {
              file: C,
              loading: null,
              error: null,
              options: ne,
              onLoadSuccess: je,
              onLoadError: Ue,
              className: "reader-react-pdf-document",
              children: $.map((j) => {
                if (Le.has(j))
                  return /* @__PURE__ */ p(
                    id,
                    {
                      pane: t,
                      pageNumber: j,
                      width: z,
                      devicePixelRatio: ie,
                      active: me.has(j),
                      textLayer: !$e || F.has(j),
                      syncedMinHeight: (l == null ? void 0 : l.get(j)) || 0,
                      onMetrics: u,
                      cachedAspect: U.get(j),
                      onAspectChange: Me,
                      sentinelRef: Ae(j),
                      regionHighlight: (V == null ? void 0 : V.box.page) === j ? V : null,
                      regionTargets: re.get(j),
                      hoveredRegionId: b && ve.has(j) ? b : null,
                      onHoverRegion: v,
                      liveTranslationLayout: k == null ? void 0 : k.layoutByPage.get(j - 1),
                      liveTranslationPage: k == null ? void 0 : k.pagesByPage.get(j - 1),
                      showLiveTranslation: R,
                      liveTranslationMissing: ml(k, j - 1)
                    },
                    `${t}-${j}`
                  );
                const Q = U.get(j) ?? Ma, le = Math.max(120, Math.floor(z * Q)), ye = Math.max(le, Math.ceil((l == null ? void 0 : l.get(j)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: Ae(j),
                    [Ee]: j,
                    [Ie]: t,
                    [Qn]: le,
                    className: `${er} is-placeholder`,
                    style: {
                      width: z,
                      height: ye,
                      minHeight: ye
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: cn,
                        style: { width: z, height: le },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${j}`
                );
              })
            },
            T
          ) }) : null
        ]
      }
    );
  }
), Yr = Jt(gd), bd = 2e3, yd = 6, vd = 500, Zr = "reader-react-resizing";
function wd(e, t) {
  const n = _(null), r = _(null);
  De(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const v = Sd(e), k = Bt(e, v);
      if (!k) return;
      s = { pane: v, progress: k, started: performance.now() };
    }
    const { pane: i, progress: c, started: l } = s;
    let u = 0, m = null, d = e.scrollHeight, f = d, g = 0, h = l;
    const y = /* @__PURE__ */ new WeakMap(), S = typeof ResizeObserver > "u" ? null : new ResizeObserver((v) => {
      let k = !1;
      for (const R of v) {
        const L = Math.round(R.contentRect.height);
        y.has(R.target) && y.get(R.target) !== L && (k = !0), y.set(R.target, L);
      }
      k && Mt(e, c, "auto", i);
    }), w = () => {
      var v;
      m && clearTimeout(m), cancelAnimationFrame(u), S == null || S.disconnect(), e.classList.remove(Zr);
      for (const k of Qr) e.removeEventListener(k, w);
      ((v = r.current) == null ? void 0 : v.stop) === w && (r.current = null);
    }, b = () => {
      Mt(e, c, "auto", i);
      const v = e.scrollHeight;
      g = v === f ? g + 1 : 0, f = v;
      const k = performance.now() - h;
      g >= yd && (v !== d || k > vd) || k > bd ? w() : u = requestAnimationFrame(b);
    };
    for (const v of Qr) e.addEventListener(v, w, { passive: !0 });
    for (const v of Array.from(e.children)) S == null || S.observe(v);
    e.classList.add(Zr), r.current = { ...s, stop: w }, m = setTimeout(() => {
      m = null, h = performance.now(), d = e.scrollHeight, f = d, g = 0, u = requestAnimationFrame(b);
    }, aa);
  }, [e, t]), D(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Sd(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Ee}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(Ie) || null;
  }
  return null;
}
const Qr = ["wheel", "touchstart", "keydown", "pointerdown"];
function kd(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function Id(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(pn)) && ((n = e.hasAttribute) != null && n.call(e, Ie)));
}
function Ed(e, t) {
  D(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!Id(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${pn}[${Ie}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const c = kd(a, i);
        if (c === null || Math.abs(i.scrollLeft - c) < 1) continue;
        const l = i.scrollLeft;
        i.scrollLeft = c, Math.abs(i.scrollLeft - l) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function Td(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), c = t - i, l = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: c * l };
}
function Rd(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const eo = 12;
function ar(e) {
  return Array.from(e.querySelectorAll(`.${pn}[${Ie}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function Pd(e) {
  const t = e.getBoundingClientRect();
  return ar(e).map((n) => {
    const r = n.getBoundingClientRect();
    return {
      pane: n.getAttribute(Ie) || "",
      left: r.left - t.left,
      width: n.clientWidth,
      scrollWidth: n.scrollWidth,
      scrollLeft: n.scrollLeft
    };
  });
}
function Md(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function _d(e, t) {
  return e ? ar(e).find((n) => n.getAttribute(Ie) === t) ?? null : null;
}
function Nd({ shellEl: e }) {
  const [t, n] = P([]), r = _(0), o = N(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = Pd(e);
      n((i) => Md(i, s) ? i : s);
    }));
  }, [e]);
  D(() => {
    if (!e) return;
    o();
    const s = e.ownerDocument.defaultView;
    e.addEventListener("scroll", o, { capture: !0, passive: !0 });
    const i = s && typeof s.ResizeObserver < "u" ? new s.ResizeObserver(o) : null, c = () => {
      if (i) {
        i.disconnect(), i.observe(e);
        for (const m of ar(e))
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
  return a.length ? /* @__PURE__ */ p("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ p(xd, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function xd({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - eo * 2), r = Td(e, n), o = _(null);
  if (!r) return null;
  const a = (d) => {
    const f = _d(t, e.pane);
    f && (f.scrollLeft = d);
  }, s = (d) => {
    var f, g;
    d.button === 0 && (d.preventDefault(), d.stopPropagation(), (g = (f = d.currentTarget).setPointerCapture) == null || g.call(f, d.pointerId), o.current = { startX: d.clientX, startScroll: e.scrollLeft, pointerId: d.pointerId });
  }, i = (d) => {
    const f = o.current;
    !f || f.pointerId !== d.pointerId || a(f.startScroll + Rd(e, n, r.size, d.clientX - f.startX));
  }, c = (d) => {
    var f, g, h;
    ((f = o.current) == null ? void 0 : f.pointerId) === d.pointerId && (o.current = null, (h = (g = d.currentTarget).releasePointerCapture) == null || h.call(g, d.pointerId));
  }, l = (d) => {
    if (d.button !== 0 || d.target !== d.currentTarget) return;
    d.preventDefault();
    const f = d.currentTarget.getBoundingClientRect(), g = d.clientX - f.left, h = e.width * 0.8;
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
      style: { left: e.left + eo, width: n },
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
function _a(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Ad(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function Ld({ compare: e, onDone: t }) {
  return /* @__PURE__ */ A("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ p("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ p("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ p("li", { children: /* @__PURE__ */ A(
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
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: _a(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(Ho, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(As, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ p("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ A("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ A(
        oe,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ p(Ls, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ A(
        oe,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ p(Cs, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function to({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = Ad(t), a = [e === "compare" ? "对比" : "正在读", r, _a(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ A("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function Cd({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = P({ source: null, translated: null });
  return De(() => {
    if (!e) return;
    const a = () => {
      const i = e.getBoundingClientRect(), c = (l) => {
        const u = e.querySelector(`[${Ie}="${l}"]`), m = u == null ? void 0 : u.getBoundingClientRect();
        return m && m.width > 0 ? { x: Math.round(m.left + m.width / 2), top: Math.round(i.top + 14) } : null;
      };
      o({ source: c("source"), translated: c("translated") });
    };
    a();
    const s = typeof ResizeObserver > "u" ? null : new ResizeObserver(a);
    return s == null || s.observe(e), e.querySelectorAll(`[${Ie}]`).forEach((i) => s == null ? void 0 : s.observe(i)), window.addEventListener("resize", a), e.addEventListener("scroll", a, { passive: !0 }), () => {
      s == null || s.disconnect(), window.removeEventListener("resize", a), e.removeEventListener("scroll", a);
    };
  }, [e]), /* @__PURE__ */ A("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(to, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(to, { role: "reading", ...n }) }) : null
  ] });
}
const Dd = () => () => {
}, no = () => null;
function $d({
  mode: e,
  compareMode: t,
  showSource: n,
  showTranslated: r,
  markdownSplit: o,
  overlayOnSource: a = !1
}) {
  return { mode: e, compareMode: t, showSource: n, showTranslated: r };
}
function Od(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function zd(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Fd(e) {
  const t = tt(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, m = e.bindShell ?? (t == null ? void 0 : t.bindShell), d = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, f = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Xt, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, S = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, w = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, b = (t == null ? void 0 : t.compareVersion) ?? null, v = (b == null ? void 0 : b.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", k = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", R = b ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, L = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, O = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), B = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), M = t == null ? void 0 : t.onPdfOutline, I = t == null ? void 0 : t.onPdfDocument, E = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), T = e.regions ?? (t == null ? void 0 : t.regions) ?? [], x = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), C = (t == null ? void 0 : t.regionHover) ?? null, [W, H] = P(null), J = hn(
    C ? C.subscribe : Dd,
    C ? () => C.get().itemId : no,
    C ? () => C.get().itemId : no
  ), ue = C ? J : W, Y = N((de) => {
    C ? C.set(de, "pdf") : H(de);
  }, [C]), ae = $d({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), te = Number.isFinite(g) && g > 0 ? Od(
    g,
    // 对照时两栏分书页区，按书页区算（50% = 一栏）；单栏才按两倍算（50% = 铺满剩下的那一栏）。
    (n || r) && !ae.compareMode,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return wd(d, te), Ed(d, ae.compareMode), /* @__PURE__ */ A(
    "div",
    {
      ref: m,
      className: Qo,
      "data-reader-region-count": T.length,
      "data-reader-structured-region-count": T.filter(Is).length,
      "data-reader-metadata-ready": x ? "true" : "false",
      children: [
        /* @__PURE__ */ A(
          "main",
          {
            className: `${Zo} reader-mode-${ae.mode}`,
            "data-reader-mode": ae.compareMode ? s : n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              y ? /* @__PURE__ */ p(
                Yr,
                {
                  pane: "source",
                  url: v,
                  preloadedFile: R,
                  userZoom: f,
                  visible: ae.showSource,
                  scrollRoot: d,
                  pageWidthOverride: te,
                  rowHeights: ae.compareMode ? h : void 0,
                  onMetrics: O,
                  emptyLabel: w ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: B,
                  onOutline: b ? void 0 : M,
                  onDocument: b ? void 0 : I,
                  activeRegion: E,
                  regions: (b == null ? void 0 : b.regions) ?? T,
                  readerMetadata: x,
                  hoveredRegionId: ue,
                  onHoverRegion: Y,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? zd(o) : "",
                  paneAction: u && ae.showTranslated ? /* @__PURE__ */ A(Oe, { children: [
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
              S ? /* @__PURE__ */ p(
                Yr,
                {
                  pane: "translated",
                  url: k,
                  preloadedFile: L,
                  userZoom: f,
                  visible: ae.showTranslated,
                  scrollRoot: d,
                  pageWidthOverride: te,
                  rowHeights: ae.compareMode ? h : void 0,
                  onMetrics: O,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: B,
                  onOutline: M,
                  onDocument: I,
                  activeRegion: E,
                  regions: T,
                  readerMetadata: x,
                  hoveredRegionId: ue,
                  onHoverRegion: Y,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ p(Nd, { shellEl: d }),
        b ? /* @__PURE__ */ p(Cd, { shellEl: d, left: b.left, right: b.right }) : null
      ]
    }
  );
}
const Bd = [
  { id: "source", label: "原文", Icon: Wo },
  { id: "compare", label: "对照", Icon: Ko },
  { id: "translated", label: "译文", Icon: Vo }
];
function jd(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function Hd(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function Ud(e) {
  const t = tt(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? jd(a.state) : "";
  return /* @__PURE__ */ A("header", { className: "reader-workspace-bar", children: [
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
    /* @__PURE__ */ A("div", { className: "reader-workspace-center", children: [
      /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Bd.map(({ id: l, label: u, Icon: m }) => {
        const d = n === l, f = Hd({
          id: l,
          documentReady: r,
          sourceViewOnly: i,
          liveTranslationAvailable: !!a
        });
        return /* @__PURE__ */ A(
          "button",
          {
            type: "button",
            className: `reader-workspace-tab${d ? " is-active" : ""}`,
            role: "tab",
            "aria-selected": d,
            "aria-label": u,
            title: f ? `${u} 需要文档任务` : u,
            disabled: f,
            onClick: () => o(l),
            children: [
              /* @__PURE__ */ p(m, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-workspace-tab-label", children: u })
            ]
          },
          l
        );
      }) }),
      a ? /* @__PURE__ */ A("div", { className: "reader-live-strip", children: [
        /* @__PURE__ */ A(
          "button",
          {
            type: "button",
            className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
            "aria-pressed": a.visible,
            "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
            title: a.state.error || `${c}，${a.visible ? "点一下看原文" : "点一下叠上译文"}`,
            onClick: a.onToggle,
            children: [
              /* @__PURE__ */ p(Ds, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: c })
            ]
          }
        ),
        a.latestPage && a.onJumpToLatest && a.latestPage !== a.currentPage ? /* @__PURE__ */ A(
          oe,
          {
            className: "reader-live-translation-toggle reader-live-jump",
            "aria-label": `跳到最新译好的第 ${a.latestPage} 页`,
            title: `跳到最新译好的第 ${a.latestPage} 页`,
            onClick: a.onJumpToLatest,
            children: [
              /* @__PURE__ */ p($s, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "跳到最新" })
            ]
          }
        ) : null
      ] }) : s ? /* @__PURE__ */ p("div", { className: "reader-live-strip", children: /* @__PURE__ */ A(
        oe,
        {
          className: "reader-live-translation-toggle is-done",
          title: "翻译完成，左右对照看最终译文",
          onClick: s.onOpenCompare,
          children: [
            /* @__PURE__ */ p(Os, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
          ]
        }
      ) }) : null
    ] })
  ] });
}
const Na = [];
function Wd() {
  const e = /* @__PURE__ */ new Map(), t = /* @__PURE__ */ new Set();
  let n = Na;
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
function Kd(e, t) {
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
function Vd(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.pageLayer ? [{ id: t, render: n.pageLayer }] : []);
}
function qd(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.menuSection ? [{ id: t, render: n.menuSection }] : []);
}
function Jd(e) {
  var t;
  return ((t = e.find(({ contribution: n }) => n.takesPointer)) == null ? void 0 : t.id) ?? null;
}
function Gd(e) {
  const t = e.flatMap(({ id: n, contribution: r }) => r.textMarks ? [{ id: n, marks: r.textMarks }] : []);
  return t.length ? (n) => t.flatMap(({ id: r, marks: o }) => {
    try {
      return [...o(n)];
    } catch (a) {
      return console.error(`[reader] 扩展 ${r} 的文字层标记出错`, a), [];
    }
  }) : null;
}
function Xd(e) {
  return e.reduce((t, { contribution: n }) => Math.max(t, n.reserveRight || 0), 0);
}
function Yd(e) {
  for (const { contribution: t } of e) if (t.comparedDocument) return t.comparedDocument;
  return null;
}
function Zd(e) {
  return e.flatMap(({ title: t, contribution: n }) => {
    var r;
    return (r = n.shortcuts) != null && r.length ? [{ title: t, items: n.shortcuts }] : [];
  });
}
const bn = Gt(null), xa = Gt(null);
function Qd({ api: e, store: t, children: n }) {
  const r = K(() => ({ api: e, store: t }), [e, t]);
  return /* @__PURE__ */ p(bn.Provider, { value: r, children: n });
}
function Yt() {
  const e = dt(bn);
  if (!e) throw new Error("useReaderApi 要在 ReaderExtensionsProvider 里面用");
  return e.api;
}
const ef = () => () => {
}, ro = () => Na;
function tf(e) {
  return hn(e.subscribe, e.getSnapshot, e.getSnapshot);
}
function Aa() {
  var t;
  const e = (t = dt(bn)) == null ? void 0 : t.store;
  return hn((e == null ? void 0 : e.subscribe) ?? ef, (e == null ? void 0 : e.getSnapshot) ?? ro, (e == null ? void 0 : e.getSnapshot) ?? ro);
}
function yn(e) {
  var a;
  const t = (a = dt(bn)) == null ? void 0 : a.store, n = dt(xa);
  if (!n) throw new Error("useReaderContribution 只能在扩展组件里用");
  const { id: r, title: o } = n;
  D(() => {
    t == null || t.set(r, o, e);
  }, [t, r, o, e]), D(() => () => t == null ? void 0 : t.remove(r), [t, r]);
}
class nf extends fs {
  constructor() {
    super(...arguments);
    Er(this, "state", { failed: !1 });
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
const rf = Jt(function({ extensions: t }) {
  return /* @__PURE__ */ p(Oe, { children: t.map(({ id: n, title: r, Component: o }) => /* @__PURE__ */ p(nf, { id: n, children: /* @__PURE__ */ p(of, { id: n, title: r, children: /* @__PURE__ */ p(o, {}) }) }, n)) });
});
function of({ id: e, title: t, children: n }) {
  const r = K(() => ({ id: e, title: t }), [e, t]);
  return /* @__PURE__ */ p(xa.Provider, { value: r, children: n });
}
function af({
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
const oo = 6e3;
function La(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function Ca(e, t, n, r) {
  const o = e.width * t.width, a = e.height * t.height;
  let s = n * r / Math.max(1, o);
  const i = Math.max(o, a) * s;
  return i > oo && (s *= oo / i), {
    scale: s,
    offsetX: -e.left * t.width * s,
    offsetY: -e.top * t.height * s,
    canvasWidth: Math.max(1, Math.round(o * s)),
    canvasHeight: Math.max(1, Math.round(a * s)),
    /** 显示高度（CSS 像素），按区域的宽高比。 */
    cssHeight: Math.round(n * (a / Math.max(1, o)))
  };
}
function Da({
  pdf: e,
  page: t,
  region: n,
  cssWidth: r,
  className: o,
  label: a
}) {
  const s = _(null), [i, c] = P({ status: "loading", cssHeight: 0 }), l = `${t}:${n.left}:${n.top}:${n.width}:${n.height}:${Math.round(r)}`;
  return D(() => {
    let u = !1, m = null;
    return c((d) => ({ status: "loading", cssHeight: d.cssHeight })), (async () => {
      try {
        const d = await e.getPage(t);
        if (u) return;
        const f = d.getViewport({ scale: 1 }), g = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), h = Ca(n, f, r, g), y = s.current, S = y == null ? void 0 : y.getContext("2d");
        if (!y || !S) return;
        y.width = h.canvasWidth, y.height = h.canvasHeight, c({ status: "loading", cssHeight: h.cssHeight });
        const w = d.getViewport({ scale: h.scale, offsetX: h.offsetX, offsetY: h.offsetY }), b = d.render({ canvasContext: S, viewport: w });
        m = b, await b.promise, u || c({ status: "ready", cssHeight: h.cssHeight });
      } catch (d) {
        !u && (d == null ? void 0 : d.name) !== "RenderingCancelledException" && c((f) => ({ status: "error", cssHeight: f.cssHeight }));
      }
    })(), () => {
      u = !0, m == null || m.cancel();
    };
  }, [e, l]), /* @__PURE__ */ A(
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
const sf = 1600, sr = { left: 0, top: 0, width: 1, height: 1 };
function $a(e) {
  return new Promise((t, n) => {
    e.toBlob((r) => r ? t(r) : n(new Error("截图没出来")), "image/png");
  });
}
function cf(e, t, n) {
  if (e.width <= 0 || e.height <= 0) return null;
  const r = (l) => Math.min(1, Math.max(0, (l - e.left) / e.width)), o = (l) => Math.min(1, Math.max(0, (l - e.top) / e.height)), a = Math.min(r(t.x), r(n.x)), s = Math.max(r(t.x), r(n.x)), i = Math.min(o(t.y), o(n.y)), c = Math.max(o(t.y), o(n.y));
  return s - a < 0.02 || c - i < 0.02 ? null : { left: a, top: i, width: s - a, height: c - i };
}
async function lf(e, t, n = sr, r = sf) {
  const o = await e.getPage(t), a = Ca(n, o.getViewport({ scale: 1 }), r, 1), s = document.createElement("canvas");
  s.width = a.canvasWidth, s.height = a.canvasHeight;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.fillStyle = "#fff", i.fillRect(0, 0, s.width, s.height), await o.render({ canvasContext: i, viewport: o.getViewport({ scale: a.scale, offsetX: a.offsetX, offsetY: a.offsetY }) }).promise, $a(s);
}
async function uf(e, t = sr) {
  const n = Math.round(t.left * e.width), r = Math.round(t.top * e.height), o = Math.max(1, Math.round(t.width * e.width)), a = Math.max(1, Math.round(t.height * e.height)), s = document.createElement("canvas");
  s.width = o, s.height = a;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.drawImage(e, n, r, o, a, 0, 0, o, a), $a(s);
}
function df(e, t) {
  return t.left === 0 && t.top === 0 && t.width === 1 && t.height === 1 ? `第${e}页.png` : `第${e}页-截图.png`;
}
const ff = 4e3;
function mf(e, t, n) {
  if (e.length) {
    const o = ba(e, n), a = o ? ga(e).find((s) => s.id === o) : null;
    if (a) return a.title;
  }
  let r = null;
  for (const o of t)
    !o.headingLevel || o.source.page > n || (!r || o.source.page >= r.source.page) && (r = o);
  return `${(r == null ? void 0 : r.source.text) || (r == null ? void 0 : r.markdown) || ""}`.replace(/\s+/g, " ").trim().slice(0, 80);
}
function ao(e) {
  var a, s;
  if (!e || e.isCollapsed || !e.rangeCount) return { text: "", element: null, rect: null };
  const t = e.getRangeAt(0), n = t.startContainer, r = ((s = (a = n.nodeType === 1 ? n : n.parentElement) == null ? void 0 : a.closest) == null ? void 0 : s.call(a, `[${Ee}]`)) ?? null;
  return r ? { text: `${e}`.replace(/\s+\n/g, `
`).trim().slice(0, ff), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function hf(e, t, n, r, o) {
  let a = null, s = 0.15;
  for (const i of e) {
    const c = Pt(i, t, n);
    if (!c || c.box.page !== r) continue;
    const l = gt(c, 1, 1);
    if (!l) continue;
    const u = o.y < l.top ? l.top - o.y : o.y > l.top + l.height ? o.y - l.top - l.height : 0, m = o.x < l.left ? l.left - o.x : o.x > l.left + l.width ? o.x - l.left - l.width : 0, d = u + m * 0.25;
    (d < s || d === 0 && a === null) && (a = i, s = d);
  }
  return a;
}
function pf({
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
  const c = Number(e.getAttribute(Ee)) || 0;
  if (c < 1) return null;
  const l = e.getAttribute(Ie) === "source" ? "source" : "translated", u = e.getBoundingClientRect(), m = u.width > 0 && u.height > 0 ? { x: Math.min(1, Math.max(0, (t - u.left) / u.width)), y: Math.min(1, Math.max(0, (n - u.top) / u.height)) } : null, f = (r ? a.find((g) => g.itemId === r) ?? null : null) ?? (m ? hf(a, i, l, c, m) : null);
  return {
    pane: l,
    page: c,
    itemId: (f == null ? void 0 : f.itemId) ?? null,
    selection: o,
    sourceText: `${(f == null ? void 0 : f.source.text) || (f == null ? void 0 : f.markdown) || ""}`.trim(),
    translatedText: `${(f == null ? void 0 : f.translatedBlockText) || (f == null ? void 0 : f.translated.text) || ""}`.trim(),
    section: mf(s, a, (f == null ? void 0 : f.source.page) ?? c),
    point: m
  };
}
function gf(e, t, n = document) {
  for (const r of n.elementsFromPoint(e, t)) {
    const o = r.closest(`[${Ee}]`);
    if (!o) continue;
    const a = Number(o.getAttribute(Ee)) || 0, i = (o.closest(`[${Ie}]`) ?? o).getAttribute(Ie) === "translated" ? "translated" : "source", c = o.querySelector("canvas");
    if (a && c) return { page: a, pane: i, canvas: c, slot: o };
  }
  return null;
}
function bf({ onDone: e, onCancel: t }) {
  const [n, r] = P(null), o = _(null), a = _(null);
  D(() => {
    const c = (l) => {
      l.key === "Escape" && (l.preventDefault(), l.stopImmediatePropagation(), t());
    };
    return window.addEventListener("keydown", c, !0), () => window.removeEventListener("keydown", c, !0);
  }, [t]);
  const s = (c, l) => {
    const u = a.current;
    u && (u.style.pointerEvents = "none");
    try {
      return gf(c, l);
    } finally {
      u && (u.style.pointerEvents = "");
    }
  }, i = n ? { left: Math.min(n.from.x, n.to.x), top: Math.min(n.from.y, n.to.y), width: Math.abs(n.to.x - n.from.x), height: Math.abs(n.to.y - n.from.y) } : null;
  return /* @__PURE__ */ A(
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
        const m = cf(l.canvas.getBoundingClientRect(), u, { x: c.clientX, y: c.clientY });
        m && e({ page: l.page, pane: l.pane, region: m, canvas: l.canvas, point: { x: u.x, y: u.y, target: l.slot } });
      },
      children: [
        /* @__PURE__ */ p("p", { className: "reader-ask-crop-hint", children: "在书页上拖出一块，松开就带进提问 · Esc 取消" }),
        i ? /* @__PURE__ */ p("div", { className: "reader-ask-crop-box", style: i }) : null
      ]
    }
  );
}
const so = 5e4, yf = 2e4;
function Pn(e, t) {
  const n = `${e || ""}`;
  return n.length > t ? n.slice(0, t) : n;
}
function Sg(e, t) {
  const n = { page: e.page, pane: e.pane, item_ids: e.itemId ? [e.itemId] : [] };
  return t.documentId && (n.document_id = t.documentId), t.jobId && (n.job_id = t.jobId), t.versionId && (n.translation_version = t.versionId), e.selection && (n.selected_text = e.selection), e.section && (n.section = e.section), e.sourceText && (n.source_text = e.sourceText), e.translatedText && (n.translated_text = e.translatedText), n;
}
function vf(e, t = null) {
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
function wf(e, t) {
  if (!(e != null && e.page)) return null;
  const r = [!!(e.document_id && t && e.document_id !== t) ? "别的书" : "", `第 ${e.page} 页`, e.section || ""].filter(Boolean).join(" · ");
  return { page: e.page, label: r, data: e };
}
function Sf(e) {
  var r;
  const t = e == null ? void 0 : e.data, n = ((r = t == null ? void 0 : t.retainpdf) == null ? void 0 : r.selection) ?? (t && typeof t.page == "number" ? t : null);
  return n && n.page ? n : null;
}
function kg(e, t) {
  var r;
  const n = Sf(e);
  return !n || n.document_id && t && n.document_id !== t ? null : ((r = n.item_ids) == null ? void 0 : r[0]) || null;
}
function Ig(e) {
  var o, a;
  const t = e.selection.trim();
  return t && !t.endsWith("…") ? t : ((a = (o = [...e.text.matchAll(/```[ \t]*(译文|translation|zh|zh-CN)[ \t]*\n([\s\S]*?)\n```/gi)].at(-1)) == null ? void 0 : o[2]) == null ? void 0 : a.trim()) || null;
}
function kf(e, t) {
  var o;
  if (!t) return;
  const n = e.findIndex((a) => a.message_id === t);
  if (n < 0) return;
  const r = ((o = e[n + 1]) == null ? void 0 : o.role) === "assistant" ? If(e[n + 1].text) : "";
  return { question: e[n].text, ...r ? { answer: r } : {} };
}
function If(e, t = 160) {
  const n = e.replace(/```[\s\S]*?(```|$)/g, " ").replace(/\$\$[\s\S]*?\$\$/g, " … ").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim(), r = [...n];
  return r.length > t ? `${r.slice(0, t).join("")}…` : n;
}
function Ef(e, t = [], n = "") {
  const r = new Set(t.map((o) => o.covers_to_seq));
  return e.filter((o) => !o.superseded_at).map((o) => {
    const a = r.has(o.seq) ? { compactedBefore: !0 } : {};
    if (o.role === "user") {
      const s = kf(e, o.edited_from);
      return {
        id: o.message_id,
        role: "user",
        text: o.text,
        context: wf(o.selection, n),
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
function Tf(e, t, n, r) {
  var l, u, m;
  const o = ((m = (u = (l = e.context) == null ? void 0 : l.meta) == null ? void 0 : u.retainpdf) == null ? void 0 : m.selection) ?? null, a = (o == null ? void 0 : o.document_id) || t || null, s = e.sessionId && e.sessionId.length <= 256 ? e.sessionId : null, i = { agent_id: e.agentId || null, document_id: a, session_id: s }, c = e.answer.usage && JSON.stringify(e.answer.usage).length <= 4096 ? e.answer.usage : null;
  return [
    { ...i, role: "user", text: Pn(e.question.text, so), selection: o, client_message_id: `${n}-q`, ...r ? { edited_from: r } : {} },
    {
      ...i,
      role: "assistant",
      text: Pn(e.answer.text, so),
      thought: e.answer.thought ? Pn(e.answer.thought, yf) : null,
      usage: c,
      client_message_id: `${n}-a`,
      memory_ids: e.memoryIds.slice(0, 10)
    }
  ];
}
function Rf(e) {
  return new Date(e - 2e3).toISOString().replace(/\.\d+Z$/, "Z");
}
function Pf(e, t) {
  return e.filter((n) => n.origin === "agent" && n.status === "active" && !t.has(n.memory_id)).map((n) => ({ id: n.memory_id, scope: n.scope, text: n.text, category: n.category, documentId: n.document_id, created: !0 }));
}
function Mf(e, t) {
  if (t.id && e.some((r) => r.message_id === t.id)) return t.id;
  const n = t.text.trim();
  for (let r = e.length - 1; r >= 0; r -= 1) {
    const o = e[r];
    if (o.role === "assistant" && o.text.trim() === n) return o.message_id;
  }
  return null;
}
function _f(e) {
  const t = e.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().split(new RegExp("(?<=[。！？.!?])"))[0] || "";
  return `深挖：${[...t].slice(0, 30).join("")}${[...t].length > 30 ? "…" : ""}`;
}
const Nf = 50, Oa = 2, Mn = { conversation: null, main: null, records: [], compactions: [], hasMore: !1, key: "local", initial: [] };
function xf() {
  var t, n;
  return `c-${((n = (t = globalThis.crypto) == null ? void 0 : t.randomUUID) == null ? void 0 : n.call(t)) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}
function io(e) {
  var n, r, o, a;
  const t = e;
  return `${(t == null ? void 0 : t.reason) || ((n = t == null ? void 0 : t.details) == null ? void 0 : n.reason) || ((a = (o = (r = t == null ? void 0 : t.payload) == null ? void 0 : r.error) == null ? void 0 : o.details) == null ? void 0 : a.reason) || (e instanceof Error ? e.message : "")}`;
}
function Af({ port: e, book: t, onAppended: n }) {
  const r = (e == null ? void 0 : e.conversations) ?? null, o = (e == null ? void 0 : e.memories) ?? null, [a, s] = P(!1), [i, c] = P(Mn), [l, u] = P(!1), [m, d] = P(""), [f, g] = P("idle"), [h, y] = P(null), [S, w] = P([]), b = N((z) => {
    y(z), w([]);
  }, []), v = N((z) => w((U) => [...U, z].slice(-Oa)), []), [k, R] = P(() => /* @__PURE__ */ new Map()), L = _(/* @__PURE__ */ new Set()), O = _(/* @__PURE__ */ new Map()), B = (z) => {
    if (!z) return null;
    const U = O.current.get(z);
    return U || (M.current.records.some((q) => q.message_id === z) ? z : null);
  }, M = _(i);
  M.current = i;
  const I = _(t);
  I.current = t;
  const E = _(0), T = N(async (z, U, q, fe = []) => {
    if (!r) return;
    const se = await r.messages(z.conversation_id, { limit: Nf, ...q ? { beforeSeq: q } : {} }), me = [...se.messages, ...fe];
    E.current += 1, c({
      conversation: z,
      main: U ?? z,
      records: me,
      compactions: se.compactions || [],
      hasMore: se.has_more,
      key: `${z.conversation_id}:${E.current}`,
      initial: Ef(me, se.compactions || [], I.current.documentId)
    });
  }, [r]), x = N(async () => {
    s(!0);
    const z = M.current.conversation;
    if (!(!r || (z == null ? void 0 : z.kind) === "main" && z.status !== "archived")) {
      u(!0), d("");
      try {
        const U = await r.main(I.current.documentId || void 0);
        await T(U, U);
      } catch (U) {
        d(U instanceof Error ? U.message : String(U));
      } finally {
        u(!1);
      }
    }
  }, [r, T]), C = N((z) => {
    b(z), x();
  }, [x]), W = _(t.documentId);
  D(() => {
    W.current !== t.documentId && (W.current = t.documentId, M.current = Mn, c(Mn), b(null), R(/* @__PURE__ */ new Map()), O.current.clear(), a && x());
  }, [t.documentId, a, x]);
  const H = N(async () => {
    const z = M.current, U = z.records[0];
    if (!(!z.conversation || !U || !z.hasMore)) {
      u(!0);
      try {
        await T(z.conversation, z.main, U.seq, z.records);
      } finally {
        u(!1);
      }
    }
  }, [T]), J = N(async (z) => {
    const q = M.current.conversation;
    if (!r || !q) return;
    for (const X of z.memoryIds) L.current.add(X);
    let fe = z.memoryIds;
    if (!fe.length && o && z.startedAt) {
      const X = Pf(
        await o.list({ source_conversation_id: q.conversation_id, created_after: Rf(z.startedAt) }).catch(() => []),
        L.current
      );
      for (const F of X) L.current.add(F.id);
      fe = X.map((F) => F.id);
      const pe = z.answerId;
      X.length && pe && R((F) => new Map(F).set(pe, X));
    }
    const se = Tf({ ...z, memoryIds: fe }, I.current.documentId, xf(), B(z.editedFrom));
    let me;
    try {
      me = await r.append(q.conversation_id, se);
    } catch (X) {
      if (q.kind !== "side" || !/ask_conversation_not_open/.test(io(X))) throw X;
      await r.reopen(q.conversation_id), me = await r.append(q.conversation_id, se);
    }
    const [ke, ce] = me.messages;
    z.questionId && ke && O.current.set(z.questionId, ke.message_id), z.answerId && ce && O.current.set(z.answerId, ce.message_id), c((X) => {
      var pe;
      return ((pe = X.conversation) == null ? void 0 : pe.conversation_id) === q.conversation_id ? { ...X, conversation: me.conversation, records: [...X.records, ...me.messages] } : X;
    }), n == null || n(me.messages), me.compaction_due && q.kind === "main" && r.compact(q.conversation_id).catch(() => {
    });
  }, [r, o, n]), ue = N(async (z) => {
    const U = M.current.conversation, q = B(z);
    if (!r || !U || !q) return null;
    try {
      await r.supersede(U.conversation_id, q);
    } catch (me) {
      if (!/ask_message_superseded/.test(io(me))) throw me;
    }
    const fe = M.current.records.find((me) => me.message_id === q), se = M.current.records.findIndex((me) => me.message_id === q);
    return c((me) => ({ ...me, records: me.records.map((ke, ce) => ce >= se && se >= 0 && !ke.superseded_at ? { ...ke, superseded_at: "now" } : ke) })), (fe == null ? void 0 : fe.selection) ?? null;
  }, [r]), Y = N((z) => {
    J(z).catch((U) => d(`这一轮没存上：${U instanceof Error ? U.message : String(U)}`));
  }, [J]), ae = N(async (z) => {
    var fe;
    const U = M.current, q = U.main;
    if (!(!r || !q || ((fe = U.conversation) == null ? void 0 : fe.kind) !== "main")) {
      d("");
      try {
        const se = Mf(U.records, z), me = await r.fork({
          parent_id: q.conversation_id,
          ...se ? { forked_from_message_id: se } : {},
          title: _f(z.text),
          ...I.current.documentId ? { document_id: I.current.documentId } : {}
        });
        await T(me, q);
      } catch (se) {
        d(`开不了副对话：${se instanceof Error ? se.message : String(se)}`);
      }
    }
  }, [r, T]), Se = N(async (z) => {
    const U = M.current.main;
    if (r)
      try {
        await T(await r.get(z), U);
      } catch (q) {
        d(`打不开副对话：${q instanceof Error ? q.message : String(q)}`);
      }
  }, [r, T]), te = N(async () => {
    const z = M.current.main;
    z && await T(z, z).catch(() => {
    });
  }, [T]), de = N(async () => {
    const z = M.current.conversation;
    if (!(!r || (z == null ? void 0 : z.kind) !== "side")) {
      g("busy");
      try {
        await r.close(z.conversation_id), g("idle"), await te();
      } catch {
        g("failed");
      }
    }
  }, [r, te]), Pe = N(async () => r != null && r.archived ? r.archived(I.current.documentId) : [], [r]), ie = N(async (z) => {
    d(""), b(null);
    try {
      await T(z, M.current.main);
    } catch (U) {
      d(`打不开这个对话：${U instanceof Error ? U.message : String(U)}`);
    }
  }, [T, b]), ne = N(async () => {
    const z = M.current.main;
    if (!r || !z) return;
    await r.archive(z.conversation_id);
    const U = await r.main(I.current.documentId || void 0);
    await T(U, U);
  }, [r, T]);
  return {
    visible: a,
    view: i,
    loading: l,
    error: m,
    pending: h,
    setPending: b,
    extras: S,
    addExtra: v,
    closingSide: f,
    notices: k,
    persistent: !!r,
    openMain: x,
    ask: C,
    close: N(() => s(!1), []),
    loadEarlier: H,
    onTurn: Y,
    rewrite: ue,
    fork: ae,
    openSide: Se,
    backToMain: te,
    closeSide: de,
    archiveMain: ne,
    listArchived: Pe,
    viewArchived: ie,
    forgetMemory: r ? r.forgetMemory : void 0
  };
}
function co(e, t, n) {
  var c;
  const r = e.selection, o = e.page ?? (r == null ? void 0 : r.page) ?? 0;
  if (e.role !== "user" || !o) return null;
  const a = (e.pane ?? (r == null ? void 0 : r.pane)) === "source" ? "source" : "translated", s = ((c = r == null ? void 0 : r.item_ids) == null ? void 0 : c[0]) ?? null, i = vf({ item_ids: [], ...r, page: o, pane: a }, n(s, a, o));
  return { key: t, anchor: i, messageId: e.message_id, title: e.text.slice(0, 80) };
}
function Lf({ port: e, documentId: t, resetKey: n, pointOf: r }) {
  const [o, a] = P([]), s = _(0), i = _(r);
  i.current = r;
  const c = () => (s.current += 1, s.current);
  D(() => {
    var f, g;
    if (a([]), !e || !t) return;
    let m = !1;
    const d = (h) => {
      !m && h.length && a((y) => [...y, ...h]);
    };
    return (f = e.threads) == null || f.list(t).then(
      (h) => d(h.map((y) => ({ key: c(), anchor: y.anchor, threadId: y.threadId, title: y.title }))),
      () => {
      }
    ), (g = e.conversations) == null || g.bookMessages(t).then(
      (h) => d(h.map((y) => co(y, c(), i.current)).filter((y) => !!y)),
      () => {
      }
    ), () => {
      m = !0;
    };
  }, [e, t, n]);
  const l = N((m) => {
    const d = m.filter((f) => !f.document_id || f.document_id === t).map((f) => co(f, c(), i.current)).filter((f) => !!f);
    d.length && a((f) => [...f.filter((g) => !d.some((h) => h.messageId === g.messageId)), ...d]);
  }, [t]), u = N((m) => a((d) => d.filter((f) => f.key !== m)), []);
  return { marks: o, addRecords: l, removeMark: u };
}
const Cf = Fo(() => import("./ReaderAskPanel-B3fwakn2.js"));
function Df({
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
  jumpToBlock: d,
  pdfDocuments: f,
  currentPage: g,
  visibleMode: h,
  activePanel: y = null
}) {
  var Ue;
  const S = K(() => ({ documentId: t, jobId: n, versionId: r }), [t, n, r]), w = N(($, V, re) => {
    const ve = $ ? o.find((qe) => qe.itemId === $) : null, Le = ve ? Pt(ve, a, V) : null, Ce = Le && Le.box.page === re ? gt(Le, 1, 1) : null;
    return Ce ? { x: Ce.left, y: Ce.top } : null;
  }, [o, a]), b = Lf({ port: e, documentId: t, resetKey: c, pointOf: w }), v = Af({ port: e, book: S, onAppended: b.addRecords }), [k, R] = P(null), L = N(
    ($, V, re, ve) => pf({
      pageElement: ($ == null ? void 0 : $.closest(`[${Ee}]`)) ?? null,
      clientX: V,
      clientY: re,
      itemId: i(),
      selection: ve,
      regions: o,
      bookmarks: s,
      metadata: a
    }),
    [i, o, s, a]
  ), O = N(() => {
    var V;
    const $ = ao(((V = globalThis.getSelection) == null ? void 0 : V.call(globalThis)) ?? null);
    return !$.text || !$.element || !$.rect ? null : L($.element, $.rect.left + $.rect.width / 2, $.rect.top + $.rect.height / 2, $.text);
  }, [L]), B = N(($) => {
    R(null), v.ask($);
  }, [v.ask]);
  D(() => {
    if (!e) return;
    const $ = (V) => {
      var Le;
      if (V.key !== "?" || V.metaKey || V.ctrlKey || V.altKey || V.defaultPrevented) return;
      const re = V.target;
      if ((Le = re == null ? void 0 : re.closest) != null && Le.call(re, "input, textarea, select, [contenteditable='true']")) return;
      const ve = O();
      ve && (V.preventDefault(), V.stopImmediatePropagation(), B(ve));
    };
    return window.addEventListener("keydown", $, !0), () => window.removeEventListener("keydown", $, !0);
  }, [e, O, B]);
  const M = _(/* @__PURE__ */ new Set()), I = ((Ue = v.pending) == null ? void 0 : Ue.selection) || "";
  D(() => {
    I && M.current.add(I);
  }, [I]);
  const E = v.visible && !k, T = v.setPending, [x, C] = P(null), W = !!v.pending;
  D(() => {
    W || C(null);
  }, [W]);
  const H = _(v.pending);
  H.current = v.pending, D(() => {
    if (!E) return;
    let $ = null;
    const V = () => {
      $ && clearTimeout($), $ = setTimeout(() => {
        const re = O();
        !re || M.current.has(re.selection) || (H.current ? C(re) : T(re));
      }, 250);
    };
    return document.addEventListener("selectionchange", V), () => {
      $ && clearTimeout($), document.removeEventListener("selectionchange", V);
    };
  }, [E, O, T]);
  const J = v.addExtra, ue = v.extras.length, Y = K(() => {
    if (!x) return null;
    const $ = () => {
      M.current.add(x.selection), C(null);
    };
    return {
      label: `第 ${x.page} 页 · ${[...x.selection].length} 字`,
      replace: () => {
        $(), T(x);
      },
      ...ue < Oa ? { add: () => {
        $(), J(x);
      } } : {},
      dismiss: $
    };
  }, [x, ue, T, J]), ae = _(f);
  ae.current = f;
  const Se = N(async ({ page: $, pane: V, region: re, canvas: ve }) => {
    const Le = ae.current[V];
    let Ce;
    if (Le)
      Ce = await lf(Le, $, re);
    else {
      const qe = ve ?? document.querySelector(`[${Ie}="${V}"] [${Ee}="${$}"] canvas`);
      if (!qe) throw new Error(`第 ${$} 页还没画出来，翻到那一页再试`);
      Ce = await uf(qe, re);
    }
    return new File([Ce], df($, re), { type: "image/png" });
  }, []), [te, de] = P(null), Pe = _(v.pending);
  Pe.current = v.pending;
  const ie = K(() => [{
    key: "page",
    label: "带上这一页",
    title: "带上这一页的截图（问的那一页，没有就是现在读的这页）：公式、图表、表格让 AI 直接看图",
    icon: /* @__PURE__ */ p(zs, { size: 14, "aria-hidden": !0 }),
    run: () => {
      const $ = Pe.current, V = ($ == null ? void 0 : $.pane) || (h === "translated" ? "translated" : "source");
      return Se({ page: ($ == null ? void 0 : $.page) || g() || 1, pane: V, region: sr });
    }
  }], [Se, g, h]), [ne, z] = P(!1), [U, q] = P(""), fe = N(async ($) => {
    z(!1), q("");
    try {
      const V = await Se($), re = L($.point.target, $.point.x, $.point.y, "");
      de((ve) => ({ id: ((ve == null ? void 0 : ve.id) || 0) + 1, files: [V] })), re ? B({ ...re, itemId: null, sourceText: "", translatedText: "" }) : v.openMain();
    } catch (V) {
      q(V instanceof Error ? V.message : String(V));
    }
  }, [Se, L, B]), se = N(() => z(!1), []), me = N(async ($) => {
    if ($.threadId && (e != null && e.threads) && t) {
      try {
        const V = await e.threads.get(t, $.threadId);
        R({ anchor: V.anchor || $.anchor, messages: V.messages || [], mark: $ });
      } catch {
        R({ anchor: $.anchor, messages: [], mark: $ });
      }
      return;
    }
    R(null), v.openMain();
  }, [e, t, v.openMain]), ke = N(($) => {
    var ve;
    if (!e) return [];
    const V = ao(((ve = globalThis.getSelection) == null ? void 0 : ve.call(globalThis)) ?? null), re = L($.target, $.clientX, $.clientY, V.element ? V.text : "");
    return re ? [{
      key: "ask",
      label: re.selection ? "问这段" : "在这里提问",
      hint: re.selection ? "?" : void 0,
      onSelect: () => B(re)
    }, {
      key: "crop",
      label: "截一块问",
      onSelect: () => {
        q(""), z(!0);
      }
    }] : [];
  }, [e, L, B]), ce = k ? {
    anchor: k.anchor,
    messages: k.messages,
    onClose: () => R(null),
    onDelete: e != null && e.threads && k.mark.threadId ? () => {
      e.threads.remove(t, k.mark.threadId).catch(() => {
      }), b.removeMark(k.mark.key), R(null);
    } : void 0
  } : null, X = K(() => m ? ($, V) => {
    m($, V ?? void 0), requestAnimationFrame(() => d($, "translated"));
  } : null, [m, d]), pe = N(($) => va(o, $), [o]), [F, Z] = P(0), he = N(({ mode: $, width: V }) => {
    const re = globalThis.innerWidth || 0;
    Z($ === "dock" && re - V >= 480 ? Math.round(V) : 0);
  }, []), Me = !v.persistent || !!v.view.conversation || !!v.error, _e = e && (v.visible && Me || k) ? /* @__PURE__ */ p(zo, { fallback: null, children: /* @__PURE__ */ p(
    Cf,
    {
      port: e,
      jobId: n,
      book: S,
      ask: v,
      legacy: ce,
      onShowSelection: ({ page: $, pane: V }) => l($, V),
      onJumpToPage: ($) => l($),
      pageCount: u,
      onLayout: he,
      dockTaken: y !== null,
      onEditBlock: X,
      canEditBlock: pe,
      attachTools: ie,
      attachRequest: te,
      contextOffer: Y
    }
  ) }) : null, xe = ne || U ? /* @__PURE__ */ A(Oe, { children: [
    ne ? /* @__PURE__ */ p(bf, { onDone: ($) => void fe($), onCancel: se }) : null,
    U ? /* @__PURE__ */ A("p", { className: "reader-ask-crop-error", role: "alert", onClick: () => q(""), children: [
      "截图没成：",
      U
    ] }) : null
  ] }) : null, Ae = v.visible && Me || !!k, $e = v.close, je = N(() => {
    if (Ae) {
      R(null), $e();
      return;
    }
    v.openMain();
  }, [Ae, $e, v.openMain]);
  return { marks: b.marks, onMark: me, menuItems: ke, panel: _e, overlay: xe, cropping: ne, open: v.openMain, toggle: je, showing: Ae, reserveRight: Ae ? F : 0, enabled: !!e };
}
const $f = [{ keys: "选字 + ?", desc: "问选中的这段" }];
function Of() {
  const e = Yt(), t = K(() => {
    try {
      return et().ask ?? null;
    } catch {
      return null;
    }
  }, []), n = Df({
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
    activePanel: e.activePanel
  }), { marks: r, onMark: o, menuItems: a, panel: s, overlay: i, cropping: c, enabled: l, toggle: u, showing: m, reserveRight: d } = n, f = K(() => l ? {
    toolbarItems: [{
      key: "ask",
      label: "提问",
      title: "提问：问整本书、翻这本书以前的对话（问某一段：书页上右键，或选字按 ?）",
      Icon: Fs,
      pressed: m,
      onClick: u
    }],
    menuItems: a,
    pageLayer: r.length ? ({ page: g, height: h }) => /* @__PURE__ */ p(af, { marks: r, page: g, height: h, onOpen: o }) : void 0,
    shortcuts: $f,
    reserveRight: d,
    // 「截一块问」时占着书页上的指针：不出悬停框、不选字。
    takesPointer: c
  } : {}, [l, a, r, o, u, m, d, c]);
  return yn(f), /* @__PURE__ */ A(Oe, { children: [
    s,
    i
  ] });
}
const zf = { id: "ask", title: "提问", Component: Of };
function jn() {
  try {
    return et().translationVersions ?? null;
  } catch {
    return null;
  }
}
function Ff(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function Bf(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function jf(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function Hf({ documentId: e, jobId: t }) {
  const [n, r] = P([]), [o, a] = P(null);
  D(() => {
    r([]);
    const i = jn();
    if (!i || !e) return;
    let c = !1;
    return i.list(e).then((l) => {
      c || (r(l.versions), a(l.currentVersionId));
    }).catch(() => {
    }), () => {
      c = !0;
    };
  }, [e, t]);
  const s = Bf(n, t, o);
  return K(() => ({ versions: n, readingVersionId: s }), [n, s]);
}
function Uf({ documentId: e, jobId: t, versions: n, readingVersionId: r }) {
  const [o, a] = P(null), [s, i] = P(""), [c, l] = P(""), u = _(0);
  D(() => {
    u.current += 1, a(null), i(""), l("");
  }, [e, t]);
  const m = N((g) => {
    const h = jn(), y = n.find((w) => w.versionId === g);
    if (!h || !y || !e) return;
    const S = ++u.current;
    i(g), l(""), (async () => {
      const w = et(), b = await h.resolveJob(e, g);
      if (!b) throw new Error("这一份还没有能读的译文。");
      const v = await w.loadReaderPayload(b, { includeOptionalArtifacts: !0 }), k = w.resolveReaderTranslatedPdfUrl(v.jobPayload, v.manifestPayload);
      if (!k) throw new Error("这一份没有译文 PDF。");
      return { versionId: g, name: y.name, jobId: b, url: k, regions: Ff(jo(v.regionsPayload)) };
    })().then((w) => {
      S === u.current && a(w);
    }).catch((w) => {
      S === u.current && l((w == null ? void 0 : w.message) || "这一份打不开。");
    }).finally(() => {
      S === u.current && i("");
    });
  }, [e, n]), d = N(() => {
    u.current += 1, a(null), i(""), l("");
  }, []), f = N(async () => {
    var y, S;
    const g = jn();
    if (!g || !o || !e) return;
    try {
      await g.select(e, o.versionId);
    } catch (w) {
      l((w == null ? void 0 : w.message) || "换不过去，请稍后再试。");
      return;
    }
    const h = (y = globalThis.location) == null ? void 0 : y.href;
    h && ((S = globalThis.history) == null || S.replaceState(globalThis.history.state, "", jf(h, o.jobId))), a(null);
  }, [o, e]);
  return K(() => ({
    available: n.length >= 2,
    versions: n,
    readingVersionId: r,
    compared: o,
    loading: s,
    error: c,
    choose: m,
    clear: d,
    adopt: f
  }), [n, r, o, s, c, m, d, f]);
}
function Wf(e) {
  return e.available ? {
    key: "compare",
    label: "对比版本",
    title: "对比版本：左边换成这本书的另一份译文",
    Icon: Bs,
    pressed: !!(e.compared || e.loading),
    popup: (t) => /* @__PURE__ */ p(Ld, { compare: e, onDone: t })
  } : null;
}
function Kf(e) {
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
function Vf() {
  var i;
  const e = Yt(), t = Uf({
    documentId: e.documentId,
    jobId: e.jobId,
    versions: e.translationVersions,
    readingVersionId: e.versionId || ""
  }), { visibleMode: n, setWorkspace: r } = e, o = ((i = t.compared) == null ? void 0 : i.url) || "";
  D(() => {
    o && n !== "compare" && r("compare");
  }, [o]);
  const a = t.clear;
  D(() => {
    n !== "compare" && a();
  }, [n, a]);
  const s = K(() => {
    const c = Wf(t);
    return { toolbarItems: c ? [c] : [], comparedDocument: Kf(t) };
  }, [t]);
  return yn(s), null;
}
const qf = { id: "compare", title: "对比版本", Component: Vf }, za = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], lo = { pen: 35e-4, highlighter: 0.018 }, uo = 0.015, Hn = "retainpdf.reader.ink.v1:";
function fo(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(Hn + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function Jf(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(Hn + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(Hn + e);
    } catch {
    }
}
function Gf(e, t, n, r, o, a) {
  const s = uo * uo;
  return e.filter((i) => Fa(i, t, n) && i.points.some(([c, l]) => (c - r) ** 2 + ((l - o) * a) ** 2 <= s)).map((i) => i.id);
}
function Fa(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function Xf(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function Yf(e) {
  const [t, n] = P(null), [r, o] = P(za[0].key), [a, s] = P(() => fo(e)), i = _(a), c = _([]);
  D(() => {
    const h = fo(e);
    i.current = h, s(h), c.current = [];
  }, [e]);
  const l = N((h) => {
    i.current = h, s(h), Jf(e, h);
  }, [e]), u = N((h) => {
    const y = i.current, S = h(y);
    S !== y && (c.current = [...c.current.slice(-49), y], l(S));
  }, [l]), m = N((h) => {
    h.points.length < 1 || u((y) => [...y, { ...h, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [u]), d = N((h) => {
    h.length && u((y) => y.filter((S) => !h.includes(S.id)));
  }, [u]), f = N((h) => {
    u((y) => y.some((S) => S.page === h) ? y.filter((S) => S.page !== h) : y);
  }, [u]), g = N(() => {
    const h = c.current.pop();
    h && l(h);
  }, [l]);
  return K(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: m, erase: d, undo: g, clearPage: f }),
    [t, r, a, m, d, g, f]
  );
}
const Zf = [
  { tool: "pen", label: "画笔", Icon: Zn },
  { tool: "highlighter", label: "荧光笔", Icon: js },
  { tool: "eraser", label: "橡皮", Icon: Hs }
];
function Qf(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Ba({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ A(Oe, { children: [
    Zf.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
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
    za.map((o) => /* @__PURE__ */ p(
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
    /* @__PURE__ */ p(oe, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(Us, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      oe,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p(Ws, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
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
        children: /* @__PURE__ */ p(bt, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function em({ ink: e, page: t, onPick: n }) {
  return /* @__PURE__ */ p("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ p(Ba, { ink: e, page: t, onPick: n }) });
}
function tm({ ink: e }) {
  return e.tool ? /* @__PURE__ */ p("div", { className: "reader-ink-bar is-dock", role: "toolbar", "aria-label": "画笔", "data-ink-dock": "true", children: /* @__PURE__ */ p(Ba, { ink: e }) }) : null;
}
function nm(e) {
  const t = _(e);
  t.current = e, D(() => {
    const n = (r) => {
      if (Qf(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
const rm = "reader-ink-layer";
function om(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function mo({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: om(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function am({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = P(null), i = _(!1), c = o.strokes.filter((h) => Fa(h, e, t)), l = !!o.tool;
  if (!l && !c.length) return null;
  const u = (h) => {
    const y = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - y.left) / Math.max(1, y.width))),
      Math.min(1, Math.max(0, (h.clientY - y.top) / Math.max(1, y.height)))
    ];
  }, m = (h, y) => o.erase(Gf(o.strokes, e, t, h, y, r / Math.max(1, n))), d = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [y, S] = u(h);
    o.tool === "eraser" ? m(y, S) : s([[y, S]]);
  }, f = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [y, S] = u(h);
    o.tool === "eraser" ? m(y, S) : s((w) => w ? Xf(w, y, S) : [[y, S]]);
  }, g = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: lo[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ A(
    "svg",
    {
      className: rm,
      "data-ink-active": l ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: d,
      onPointerMove: f,
      onPointerUp: g,
      onPointerCancel: g,
      children: [
        c.map((h) => /* @__PURE__ */ p(mo, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(mo, { stroke: { tool: o.tool, color: o.color, width: lo[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
const sm = [
  { keys: "P", desc: "进入 / 退出画笔（书页上右键也能选笔和颜色）" },
  { keys: "Esc", desc: "退出画笔" },
  { keys: "⌘Z / Ctrl+Z", desc: "画笔模式下撤销" }
];
function im(e) {
  return {
    toolbarItems: [{
      key: "ink",
      label: "画笔",
      title: "画笔（P；书页上右键也能选笔和颜色）",
      Icon: Zn,
      pressed: !!e.tool,
      onClick: () => e.setTool(e.tool ? null : "pen")
    }],
    menuSection: ({ page: t, close: n }) => /* @__PURE__ */ p(em, { ink: e, page: t, onPick: n }),
    // 离视口远的页只是占位，笔迹先不画（和以前一样只画 active 的页）。
    pageLayer: ({ page: t, pane: n, width: r, height: o, active: a }) => a ? /* @__PURE__ */ p(am, { page: t, pane: n, width: r, height: o, ink: e }) : null,
    takesPointer: !!e.tool,
    shortcuts: sm
  };
}
function cm() {
  const e = Yt(), t = Yf(e.resetKey);
  nm(t);
  const n = K(() => im(t), [t]);
  return yn(n), /* @__PURE__ */ p(tm, { ink: t });
}
const lm = { id: "ink", title: "画笔", Component: cm }, um = Oo(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
  return /* @__PURE__ */ A(
    "svg",
    {
      ref: s,
      xmlns: "http://www.w3.org/2000/svg",
      width: t,
      height: t,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: r,
      strokeWidth: n,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className: o,
      ...a,
      children: [
        /* @__PURE__ */ p("rect", { x: "2", y: "5", width: "20", height: "14", rx: "2.5" }),
        /* @__PURE__ */ p("path", { d: "M6 15V9l2.5 3L11 9v6" }),
        /* @__PURE__ */ p("path", { d: "M16.5 9v6M14.5 13l2 2 2-2" })
      ]
    }
  );
}), dm = um;
function fm(e) {
  const t = _(!1);
  return e && (t.current = !0), t.current;
}
const mm = Fo(() => import("./ReaderMarkdownPanel-YOvJURRG.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), ja = { id: "markdown", label: "Markdown", short: "MD", Icon: dm, needsJob: !0 };
function hm() {
  const e = Yt(), t = e.activePanel === ja.id;
  return fm(t) ? /* @__PURE__ */ p(zo, { fallback: null, children: /* @__PURE__ */ p(mm, { open: t, jobId: e.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: e.closePanel }) }) : null;
}
const pm = {
  id: "markdown",
  title: "Markdown",
  Component: hm,
  panels: [ja]
}, Ha = "reader-xref", Un = "data-xref", zt = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, gm = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${zt})`), bm = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function Wn(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function ym(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function vm(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function wm(e, t, n) {
  const r = e[t], o = (i) => {
    if (!i || i.source.page !== r.source.page) return !1;
    const c = Be(i);
    return c === "figure" || c === "table" || c === "formula";
  }, a = (i) => {
    const c = [];
    for (let l = t + i; o(e[l]) && c.length < 40; l += i) c.push(e[l]);
    return i < 0 ? c.reverse() : c;
  }, s = a(n === "table" ? 1 : -1);
  return s.length ? s : a(n === "table" ? -1 : 1);
}
function Sm(e, t, n) {
  return (e.find((o) => Be(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function km(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = Be(r), s = vm(r);
    if (a === "formula") {
      for (const g of s.matchAll(bm)) {
        const h = Wn(g[1]);
        h && n({ key: `equation:${h}`, kind: "equation", label: h, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = gm.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const l = ym(i[1]), u = Wn(i[2]), m = wm(e, o, l), d = [...m.map((g) => g.itemId), r.itemId], f = new Map(e.map((g, h) => [g.itemId, h]));
    d.sort((g, h) => (f.get(g) ?? 0) - (f.get(h) ?? 0)), n({ key: `${l}:${u}`, kind: l, label: u, itemId: Sm(m, r, l), itemIds: d, captionId: r.itemId });
  }), t;
}
const Im = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${zt})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${zt})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${zt})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${zt})\s*[）)]`, "g"), kind: () => "equation" }
];
function Em(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of Im) {
    o.lastIndex = 0;
    for (const s of e.matchAll(o)) {
      const i = s.length > 2 ? s[1] : "", c = Wn(s[s.length - 1]), l = `${a(i)}:${c}`;
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
function Tm(e, t) {
  return Em(e, t).map((n) => ({ start: n.start, end: n.end, className: Ha, attrs: { [Un]: n.key } }));
}
const Rm = { figure: "图", table: "表", equation: "式" };
function ho(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${Rm[e.kind]} ${e.label}`;
}
const po = { figure: "图", table: "表", formula: "公式", text: "文字" }, nt = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function Pm(e, t, n) {
  const r = Pt(e, t, n), o = r ? gt(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = La({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function Mm(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, c = null;
  for (const u of e) {
    const m = Pt(u, t, n), d = m ? gt(m, 1, 1) : null;
    !m || !d || (r || (r = m.box.page, c = m.pageSize), m.box.page === r && (o = Math.min(o, d.left), a = Math.min(a, d.top), s = Math.max(s, d.left + d.width), i = Math.max(i, d.top + d.height)));
  }
  if (!r || !c) return null;
  const l = La({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: l, aspect: l.height * c.height / Math.max(1e-6, l.width * c.width) };
}
function _m(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function Nm(e, t) {
  const n = (o) => {
    const a = Be(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function xm({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var B;
  const i = t.find((M) => M.itemId === e) ?? null, c = K(() => i ? Nm(t, i) : [], [t, i]), l = i ? c.indexOf(i) : -1, [u, m] = P(nt.indexOf(1)), d = nt[u], f = _(null), [g, h] = P(0);
  De(() => {
    const M = f.current;
    if (!M) return;
    const I = () => h(M.clientWidth);
    I();
    const E = typeof ResizeObserver == "function" ? new ResizeObserver(I) : null;
    return E == null || E.observe(M), () => E == null ? void 0 : E.disconnect();
  }, []);
  const y = N((M) => {
    const I = c[l + M];
    I && a(I.itemId);
  }, [c, l, a]);
  D(() => {
    const M = (I) => {
      if (I.key === "Escape")
        I.preventDefault(), s();
      else if (I.key === "ArrowLeft")
        I.preventDefault(), y(-1);
      else if (I.key === "ArrowRight")
        I.preventDefault(), y(1);
      else if (I.key === "+" || I.key === "=")
        I.preventDefault(), m((E) => Math.min(nt.length - 1, E + 1));
      else if (I.key === "-" || I.key === "_")
        I.preventDefault(), m((E) => Math.max(0, E - 1));
      else if (I.key === "0")
        I.preventDefault(), m(nt.indexOf(1));
      else
        return;
      I.stopPropagation();
    };
    return window.addEventListener("keydown", M, !0), () => window.removeEventListener("keydown", M, !0);
  }, [s, y]), D(() => {
    const M = f.current;
    if (!M) return;
    const I = (E) => {
      !E.ctrlKey && !E.metaKey || (E.preventDefault(), m((T) => Math.max(0, Math.min(nt.length - 1, T + (E.deltaY < 0 ? 1 : -1)))));
    };
    return M.addEventListener("wheel", I, { passive: !1 }), () => M.removeEventListener("wheel", I);
  }, []);
  const S = _(null);
  if (!i) return null;
  const w = Be(i), b = o.map((M) => ({ pane: M, pdf: r[M] ?? null, where: Pm(i, n, M) })).filter((M) => !!(M.pdf && M.where)), v = 16, k = typeof window > "u" ? 800 : window.innerHeight, R = Math.min(880, k * 0.9) - 56 - 32 - (b.length > 1 ? 26 : 0), L = b.length ? _m(Math.max(120, (g - v * (b.length - 1) - 32) / b.length), R, b.map((M) => M.where.aspect)) : 0, O = ((B = b[0]) == null ? void 0 : B.where.page) ?? i.source.page;
  return /* @__PURE__ */ A("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${po[w] ?? "这一块"}`, children: [
    /* @__PURE__ */ p("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ A("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ A("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ A("span", { className: "reader-zoom-title", children: [
          po[w] ?? "这一块",
          " · 第 ",
          O,
          " 页"
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-zoom-count", children: l >= 0 ? `${l + 1} / ${c.length}` : "" }),
        /* @__PURE__ */ A("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: l <= 0, onClick: () => y(-1), children: /* @__PURE__ */ p(Ks, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: l < 0 || l >= c.length - 1, onClick: () => y(1), children: /* @__PURE__ */ p(qo, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => m((M) => Math.max(0, M - 1)), children: /* @__PURE__ */ p(Vs, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ A(oe, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => m(nt.indexOf(1)), children: [
            Math.round(d * 100),
            "%"
          ] }),
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === nt.length - 1, onClick: () => m((M) => Math.min(nt.length - 1, M + 1)), children: /* @__PURE__ */ p(qs, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(ut, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: s, children: /* @__PURE__ */ p(bt, { size: 16, "aria-hidden": !0 }) })
        ] })
      ] }),
      /* @__PURE__ */ p(
        "div",
        {
          ref: f,
          className: "reader-zoom-body",
          onPointerDown: (M) => {
            const I = f.current;
            !I || M.button !== 0 || (S.current = { x: M.clientX, y: M.clientY, left: I.scrollLeft, top: I.scrollTop }, I.setPointerCapture(M.pointerId));
          },
          onPointerMove: (M) => {
            const I = f.current, E = S.current;
            !I || !E || (I.scrollLeft = E.left - (M.clientX - E.x), I.scrollTop = E.top - (M.clientY - E.y));
          },
          onPointerUp: () => {
            S.current = null;
          },
          children: b.length && g ? /* @__PURE__ */ p("div", { className: "reader-zoom-columns", style: { gap: v }, children: b.map(({ pane: M, pdf: I, where: E }) => /* @__PURE__ */ A("figure", { className: "reader-zoom-column", children: [
            b.length > 1 ? /* @__PURE__ */ p("figcaption", { children: M === "source" ? "原文" : "译文" }) : null,
            /* @__PURE__ */ p(
              Da,
              {
                className: "reader-zoom-canvas",
                pdf: I,
                page: E.page,
                region: E.fraction,
                cssWidth: L * d,
                label: `${M === "source" ? "原文" : "译文"}第 ${E.page} 页`
              }
            )
          ] }, M)) }) : /* @__PURE__ */ p("p", { className: "reader-zoom-empty", children: g ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
const Am = 380, Lm = 320, wt = 8;
function Cm(e, t, n) {
  const r = Math.max(wt, Math.min(e.left, n.width - t.width - wt)), o = e.bottom + wt, a = o + t.height <= n.height - wt ? o : Math.max(wt, e.top - wt - t.height);
  return { left: r, top: a };
}
function Dm({
  preview: e,
  regions: t,
  metadata: n,
  documents: r
}) {
  const o = e.target.itemIds.map((d) => t.find((f) => f.itemId === d)).filter((d) => !!d);
  if (!o.length) return null;
  const a = e.pane === "source" ? ["source", "translated"] : ["translated", "source"];
  let s = null;
  for (const d of a) {
    const f = r[d], g = f ? Mm(o, n, d) : null;
    if (f && g) {
      s = { pdf: f, where: g };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min(Am, Lm / Math.max(0.05, s.where.aspect))), c = Math.round(i * s.where.aspect) + 30, l = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: m } = Cm(e.anchor, { width: Math.max(i, 160) + 16, height: c + 16 }, l);
  return /* @__PURE__ */ A("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: m }, children: [
    /* @__PURE__ */ A("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ p("span", { children: ho(e.target) }),
      /* @__PURE__ */ A("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ p(Da, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: ho(e.target) })
  ] });
}
const $m = 250;
function Om(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function zm(e, t, n) {
  const r = n === "back" ? e.back : e.forward;
  if (!r.length) return null;
  const o = r[r.length - 1], a = r.slice(0, -1), s = n === "back" ? { back: a, forward: [...e.forward, t] } : { back: [...e.back, t], forward: a };
  return { to: o, history: s };
}
function Fm(e) {
  var n;
  const t = e;
  return !!((n = t == null ? void 0 : t.closest) != null && n.call(t, "input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
function Bm({
  shellEl: e,
  index: t,
  primaryPane: n,
  follow: r
}) {
  const [o, a] = P(null), [s, i] = P({ back: [], forward: [] }), c = _(s);
  c.current = s;
  const l = _(null), u = _({ index: t, primaryPane: n, follow: r, shellEl: e });
  u.current = { index: t, primaryPane: n, follow: r, shellEl: e };
  const m = N(() => {
    const { shellEl: f, primaryPane: g } = u.current;
    return Bt(f, g);
  }, []);
  D(() => {
    if (!e) return;
    const f = (b) => {
      var v, k;
      return (k = (v = b.target) == null ? void 0 : v.closest) == null ? void 0 : k.call(v, `.${Ha}`);
    }, g = () => {
      l.current != null && window.clearTimeout(l.current), l.current = null;
    }, h = (b) => {
      var L;
      const v = f(b);
      if (!v) return;
      const k = u.current.index.get(v.getAttribute(Un) || "");
      if (!k) return;
      const R = ((L = v.closest("[data-reader-pane]")) == null ? void 0 : L.getAttribute("data-reader-pane")) || u.current.primaryPane;
      g(), l.current = window.setTimeout(() => {
        const O = v.getBoundingClientRect();
        a({ target: k, pane: R, anchor: { left: O.left, top: O.top, right: O.right, bottom: O.bottom } });
      }, $m);
    }, y = (b) => {
      const v = f(b);
      !v || v.contains(b.relatedTarget) || (g(), a(null));
    }, S = (b) => {
      var O, B;
      const v = f(b);
      if (!v || b.button !== 0 || b.metaKey || b.ctrlKey || b.shiftKey || `${((O = window.getSelection) == null ? void 0 : O.call(window)) || ""}`.trim()) return;
      const k = u.current.index.get(v.getAttribute(Un) || "");
      if (!k) return;
      b.preventDefault(), b.stopPropagation(), g(), a(null);
      const R = ((B = v.closest("[data-reader-pane]")) == null ? void 0 : B.getAttribute("data-reader-pane")) || u.current.primaryPane, L = m();
      L && i((M) => Om(M, L)), u.current.follow(k, R);
    }, w = () => {
      g(), a(null);
    };
    return e.addEventListener("pointerover", h), e.addEventListener("pointerout", y), e.addEventListener("click", S, !0), e.addEventListener("scroll", w, { passive: !0 }), () => {
      g(), e.removeEventListener("pointerover", h), e.removeEventListener("pointerout", y), e.removeEventListener("click", S, !0), e.removeEventListener("scroll", w);
    };
  }, [e, m]);
  const d = N((f) => {
    const g = m();
    if (!g) return !1;
    const h = zm(c.current, g, f);
    if (!h) return !1;
    const { shellEl: y, primaryPane: S } = u.current;
    return Mt(y, h.to, "auto", S) ? (i(h.history), !0) : !1;
  }, [m]);
  return D(() => {
    const f = (g) => {
      if (!g.altKey || g.metaKey || g.ctrlKey || g.shiftKey || g.defaultPrevented || g.key !== "ArrowLeft" && g.key !== "ArrowRight" || Fm(g.target)) return;
      d(g.key === "ArrowLeft" ? "back" : "forward") && g.preventDefault();
    };
    return window.addEventListener("keydown", f), () => window.removeEventListener("keydown", f);
  }, [d]), {
    preview: o,
    closePreview: N(() => a(null), []),
    canGoBack: s.back.length > 0,
    backPage: s.back.length ? s.back[s.back.length - 1].page : null,
    goBack: N(() => d("back"), [d])
  };
}
const jm = [
  { keys: "Alt+←", desc: "点了引用跳过去以后，回到原处" },
  { keys: "Alt+→", desc: "再跳回去" }
];
function Hm() {
  const e = Yt(), t = K(() => km(e.regions), [e.regions]), { jumpToBlock: n } = e, r = N((s, i) => n(s.itemId, i), [n]), o = Bm({ shellEl: e.shellEl, index: t, primaryPane: e.primaryPane, follow: r }), a = K(() => ({
    // 书里一个认得出去处的引用都没有，就不改文字层（react-pdf 照原样画，不多一遍 innerHTML）。
    textMarks: t.size ? (s) => Tm(s, t) : void 0,
    shortcuts: jm
  }), [t]);
  return yn(a), /* @__PURE__ */ A(Oe, { children: [
    o.preview ? /* @__PURE__ */ p(Dm, { preview: o.preview, regions: e.regions, metadata: e.metadata, documents: e.pdfDocuments }) : null,
    o.canGoBack ? /* @__PURE__ */ A(oe, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => o.goBack(), children: [
      /* @__PURE__ */ p(Js, { size: 14, "aria-hidden": !0 }),
      " 回到第 ",
      o.backPage,
      " 页"
    ] }) : null
  ] });
}
const Um = { id: "xrefs", title: "引用（「图 2.1」「式 (3.21)」）", Component: Hm }, ir = [lm, pm, qf, Um, zf];
function cr(e = ir) {
  return e.flatMap((t) => (t.panels ?? []).map(({ id: n, label: r, short: o, Icon: a, needsJob: s }) => ({ id: n, label: r, short: o, Icon: a, needsJob: s })));
}
function Wm(e) {
  const t = tt(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(Oe, { children: (e.tabs ?? cr()).map(({ id: s, label: i, Icon: c, needsJob: l }) => {
    const u = n === s, m = l && r, d = u ? `收起${i}` : `打开${i}`;
    return /* @__PURE__ */ A(
      "button",
      {
        type: "button",
        className: "reader-panel-toggle",
        "aria-label": d,
        "aria-pressed": u,
        title: m ? `${i} 需打开任务阅读` : i,
        disabled: m,
        onClick: () => u ? a() : o(s),
        children: [
          /* @__PURE__ */ p(c, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
          /* @__PURE__ */ p("span", { className: "reader-panel-toggle-label", "aria-hidden": "true", children: i })
        ]
      },
      s
    );
  }) });
}
function Km(e) {
  const t = tt(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = cr().map(({ id: c, label: l, short: u, Icon: m, needsJob: d }) => ({
    key: c,
    label: l,
    short: u,
    Icon: m,
    disabled: d && o,
    selected: n === c,
    badge: r == null ? void 0 : r[c],
    onClick: () => a(c)
  }));
  return n ? /* @__PURE__ */ A("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ p("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: c, label: l, Icon: u, disabled: m, selected: d, badge: f, onClick: g }) => /* @__PURE__ */ A(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": d,
        className: `reader-assistant-dock-tab${d ? " is-active" : ""}`,
        title: m ? `${l} 需打开任务阅读` : l,
        disabled: m,
        onClick: g,
        children: [
          /* @__PURE__ */ p(u, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
          /* @__PURE__ */ p("span", { className: "reader-assistant-dock-tab-label", children: l }),
          f ? /* @__PURE__ */ p("span", { className: "reader-assistant-dock-badge", children: f }) : null
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
function Vm(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function qm(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Jm(e) {
  return e / 100 * window.innerHeight;
}
function Gm(e) {
  return e / 100 * window.innerWidth;
}
function Xm(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function Ft({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = Xm(n);
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
      r = qm(t, o);
      break;
    }
    case "em": {
      r = Vm(t, o);
      break;
    }
    case "vh": {
      r = Jm(o);
      break;
    }
    case "vw": {
      r = Gm(o);
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
function Kn(e) {
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
      const u = Ft({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = Ne(u / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const u = Ft({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = Ne(u / n * 100);
    }
    let c = 0;
    if (a.minSize !== void 0) {
      const u = Ft({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      c = Ne(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = Ft({
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
function ge(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function Vn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? Ym : Zm
  );
}
function Ym(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function Zm(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function Ua(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Wa(e, t) {
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
function Qm({
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
    const { x: i, y: c } = Wa(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return ge(o, "No rect found"), o;
}
let nn;
function eh() {
  return nn === void 0 && (typeof matchMedia == "function" ? nn = !!matchMedia("(pointer:coarse)").matches : nn = !1), nn;
}
function Ka(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Vn(
    n,
    Array.from(t.children).filter(Ua).map((g) => ({ element: g }))
  ).map(({ element: g }) => g), s = [];
  let i = !1, c = !1, l = -1, u = -1, m = 0, d, f = [];
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
          (S) => S.element === h
        );
        if (y) {
          if (d) {
            const S = d.element.getBoundingClientRect(), w = h.getBoundingClientRect();
            let b;
            if (c) {
              const v = n === "horizontal" ? new DOMRect(
                S.right,
                S.top,
                0,
                S.height
              ) : new DOMRect(
                S.left,
                S.bottom,
                S.width,
                0
              ), k = n === "horizontal" ? new DOMRect(w.left, w.top, 0, w.height) : new DOMRect(w.left, w.top, w.width, 0);
              switch (f.length) {
                case 0: {
                  b = [
                    v,
                    k
                  ];
                  break;
                }
                case 1: {
                  const R = f[0], L = Qm({
                    orientation: n,
                    rects: [S, w],
                    targetRect: R.element.getBoundingClientRect()
                  });
                  b = [
                    R,
                    L === S ? k : v
                  ];
                  break;
                }
                default: {
                  b = f;
                  break;
                }
              }
            } else
              f.length ? b = f : b = [
                n === "horizontal" ? new DOMRect(
                  S.right,
                  w.top,
                  w.left - S.right,
                  w.height
                ) : new DOMRect(
                  w.left,
                  S.bottom,
                  w.width,
                  w.top - S.bottom
                )
              ];
            for (const v of b) {
              let k = "width" in v ? v : v.element.getBoundingClientRect();
              const R = eh() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (k.width < R) {
                const O = R - k.width;
                k = new DOMRect(
                  k.x - O / 2,
                  k.y,
                  k.width + O,
                  k.height
                );
              }
              if (k.height < R) {
                const O = R - k.height;
                k = new DOMRect(
                  k.x,
                  k.y - O / 2,
                  k.width,
                  k.height + O
                );
              }
              const L = g <= l || g > u;
              !i && !L && s.push({
                group: e,
                groupSize: _t({ group: e }),
                panels: [d, y],
                separator: "width" in v ? void 0 : v,
                rect: k
              }), i = !1;
            }
          }
          c = !1, d = y, f = [];
        }
      } else if (h.hasAttribute("data-separator")) {
        h.ariaDisabled !== null && (i = !0);
        const y = o.find(
          (S) => S.element === h
        );
        y ? f.push(y) : (d = void 0, f = []);
      } else
        c = !0;
  }
  return s;
}
var ot;
class Va {
  constructor() {
    Rr(this, ot, {});
  }
  addListener(t, n) {
    const r = xt(this, ot)[t];
    return r === void 0 ? xt(this, ot)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = xt(this, ot)[t];
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
    Pr(this, ot, {});
  }
  removeListener(t, n) {
    const r = xt(this, ot)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
ot = new WeakMap();
let Tt = {
  cursorFlags: 0,
  state: "inactive"
};
const lr = new Va();
function mt() {
  return Tt;
}
function th(e) {
  return lr.addListener("change", e);
}
function nh(e) {
  const t = Tt, n = { ...Tt };
  n.cursorFlags = e, Tt = n, lr.emit("change", {
    prev: t,
    next: n
  });
}
function Rt(e) {
  const t = Tt;
  Tt = e, lr.emit("change", {
    prev: t,
    next: e
  });
}
const rh = (e) => e, _n = () => {
}, qa = 1, Ja = 2, Ga = 4, Xa = 8, go = 3, bo = 12;
let rn;
function yo() {
  return rn === void 0 && (rn = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (rn = !0)), rn;
}
function oh({
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
        if (e && yo()) {
          const a = (e & qa) !== 0, s = (e & Ja) !== 0, i = (e & Ga) !== 0, c = (e & Xa) !== 0;
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
    return yo() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const vo = /* @__PURE__ */ new WeakMap();
function ur(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = vo.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = mt();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = oh({
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
  vo.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Ke = /* @__PURE__ */ new Map();
const Ya = new Va();
function ah(e) {
  Ke = new Map(Ke), Ke.delete(e);
}
function wo(e, t) {
  for (const [n] of Ke)
    if (n.id === e)
      return n;
}
function it(e, t) {
  for (const [n, r] of Ke)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function yt() {
  return Ke;
}
function dr(e, t) {
  return Ya.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Qe(e, t, n) {
  const r = Ke.get(e);
  Ke = new Map(Ke), Ke.set(e, t), Ya.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function Za(e) {
  const t = mt();
  let n = !1;
  switch (t.state) {
    case "active":
      Rt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (ur(e), n = !0, t.hitRegions.forEach((r) => {
        const o = it(r.group.id, !0);
        Qe(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function So(e) {
  e.defaultPrevented || Za(e.currentTarget);
}
function sh(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Wa(n, a.rect);
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
function ih(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function ch(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: Eo(e),
    b: Eo(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  ge(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: Io(ko(n.a)),
    b: Io(ko(n.b))
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
const lh = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function uh(e) {
  const t = getComputedStyle(Qa(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function dh(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || uh(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || lh.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function ko(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (ge(n, "Missing node"), dh(n)) return n;
  }
  return null;
}
function Io(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Eo(e) {
  const t = [];
  for (; e; )
    t.push(e), e = Qa(e);
  return t;
}
function Qa(e) {
  const { parentNode: t } = e;
  return ih(t) ? t.host : t;
}
function fh(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function mh({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!Ua(n) || n.contains(e) || e.contains(n))
    return !0;
  if (ch(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (fh(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function fr(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = Ka(o), s = sh(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && mh({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function hh(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function Re(e, t, n = 0) {
  return Math.abs(Ne(e) - Ne(t)) <= n;
}
function We(e, t) {
  return Re(e, t) ? 0 : e > t ? 1 : -1;
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
  if (We(r, c) < 0)
    if (a) {
      const l = (o + c) / 2;
      We(r, l) < 0 ? r = o : r = c;
    } else
      r = c;
  return r = Math.min(i, r), r = Ne(r), r;
}
function Kt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (Re(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), c = Object.values(o), l = [...i], [u, m] = r;
  ge(u != null, "Invalid first pivot index"), ge(m != null, "Invalid second pivot index");
  let d = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? m : u, y = n[h];
        ge(
          y,
          `Panel constraints not found for index ${h}`
        );
        const {
          collapsedSize: S = 0,
          collapsible: w,
          minSize: b = 0
        } = y;
        if (w) {
          const v = i[h];
          if (ge(
            v != null,
            `Previous layout not found for panel index ${h}`
          ), Re(v, S)) {
            const k = b - v;
            We(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      {
        const h = e < 0 ? u : m, y = n[h];
        ge(
          y,
          `No panel constraints found for index ${h}`
        );
        const {
          collapsedSize: S = 0,
          collapsible: w,
          minSize: b = 0
        } = y;
        if (w) {
          const v = i[h];
          if (ge(
            v != null,
            `Previous layout not found for panel index ${h}`
          ), Re(v, b)) {
            const k = v - S;
            We(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? m : u, y = n[h];
      ge(
        y,
        `Panel constraints not found for index ${h}`
      );
      const S = i[h], { collapsible: w, collapsedSize: b, minSize: v } = y;
      if (w && We(S, v) < 0)
        if (e > 0) {
          const k = v - b, R = k / 2, L = S + e;
          We(L, v) < 0 && (e = We(e, R) <= 0 ? 0 : k);
        } else {
          const k = v - b, R = 100 - k / 2, L = S - e;
          We(L, v) < 0 && (e = We(100 + e, R) > 0 ? 0 : -k);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let y = e < 0 ? m : u, S = 0;
    for (; ; ) {
      const b = i[y];
      ge(
        b != null,
        `Previous layout not found for panel index ${y}`
      );
      const v = Et({
        overrideDisabledPanels: s,
        panelConstraints: n[y],
        prevSize: b,
        size: 100
      }) - b;
      if (S += v, y += h, y < 0 || y >= n.length)
        break;
    }
    const w = Math.min(Math.abs(e), Math.abs(S));
    e = e < 0 ? 0 - w : w;
  }
  {
    let h = e < 0 ? u : m;
    for (; h >= 0 && h < n.length; ) {
      const y = Math.abs(e) - Math.abs(d), S = i[h];
      ge(
        S != null,
        `Previous layout not found for panel index ${h}`
      );
      const w = S - y, b = Et({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: S,
        size: w
      });
      if (!Re(S, b) && (d += S - b, l[h] = b, d.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (hh(c, l))
    return o;
  {
    const h = e < 0 ? m : u, y = i[h];
    ge(
      y != null,
      `Previous layout not found for panel index ${h}`
    );
    const S = y + d, w = Et({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: y,
      size: S
    });
    if (l[h] = w, !Re(w, S)) {
      let b = S - w, v = e < 0 ? m : u;
      for (; v >= 0 && v < n.length; ) {
        const k = l[v];
        ge(
          k != null,
          `Previous layout not found for panel index ${v}`
        );
        const R = k + b, L = Et({
          overrideDisabledPanels: s,
          panelConstraints: n[v],
          prevSize: k,
          size: R
        });
        if (Re(k, L) || (b -= L - k, l[v] = L), Re(b, 0))
          break;
        e > 0 ? v-- : v++;
      }
    }
  }
  const f = Object.values(l).reduce(
    (h, y) => y + h,
    0
  );
  if (!Re(f, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return l.reduce((h, y, S) => (h[g[S]] = y, h), {});
}
function ht(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || We(e[n], t[n]) !== 0)
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
  if (!Re(o, 100) && r.length > 0)
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      ge(c != null, `No layout data found for index ${i}`);
      const l = 100 / o * c;
      r[i] = l;
    }
  let a = 0;
  for (let i = 0; i < t.length; i++) {
    const c = n[i];
    ge(c != null, `No layout data found for index ${i}`);
    const l = r[i];
    ge(l != null, `No layout data found for index ${i}`);
    const u = Et({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: c,
      size: l
    });
    l != u && (a += l - u, r[i] = u);
  }
  if (!Re(a, 0))
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      ge(c != null, `No layout data found for index ${i}`);
      const l = c + a, u = Et({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: c,
        size: l
      });
      if (c !== u && (a -= u - c, r[i] = u, Re(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, c, l) => (i[s[l]] = c, i), {});
}
function es({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const c = yt();
    for (const [
      l,
      {
        defaultLayoutDeferred: u,
        derivedPanelConstraints: m,
        layout: d,
        groupSize: f,
        separatorToPanels: g
      }
    ] of c)
      if (l.id === e)
        return {
          defaultLayoutDeferred: u,
          derivedPanelConstraints: m,
          group: l,
          groupSize: f,
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
    derivedPanelConstraints: m
  }) => {
    const d = a(), f = l.findIndex((y) => y.id === t), g = f === 0, h = f === l.length - 1;
    if (h && c < d && (g || l.slice(0, f).every((y, S) => {
      const w = m[S];
      return (w == null ? void 0 : w.collapsible) && Re(w.collapsedSize, u[w.panelId]);
    }))) {
      const y = l.slice(0, f).reduce((S, w) => S + u[w.id], 0);
      return {
        ...u,
        [t]: Ne(100 - y)
      };
    }
    return Kt({
      delta: h ? d - c : c - d,
      initialLayout: u,
      panelConstraints: m,
      pivotIndices: h ? [f - 1, f] : [f, f + 1],
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
      group: d,
      groupSize: f,
      layout: g,
      separatorToPanels: h
    } = n(), y = s({
      nextSize: c,
      panels: d.panels,
      prevLayout: g,
      derivedPanelConstraints: m
    }), S = pt({
      layout: y,
      panelConstraints: m
    });
    ht(g, S) || Qe(d, {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: m,
      groupSize: f,
      layout: S,
      separatorToPanels: h
    });
  };
  return {
    collapse: () => {
      const { collapsible: c, collapsedSize: l } = r(), { mutableValues: u } = o(), m = a();
      c && m !== l && (u.expandToSize = m, i(l));
    },
    expand: () => {
      const { collapsible: c, collapsedSize: l, minSize: u } = r(), { mutableValues: m } = o(), d = a();
      if (c && d === l) {
        let f = m.expandToSize ?? u;
        f === 0 && (f = 1), i(f);
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
      return c && Re(l, u);
    },
    resize: (c) => {
      const { group: l } = n(), { element: u } = o(), m = _t({ group: l }), d = Ft({
        groupSize: m,
        panelElement: u,
        styleProp: c
      }), f = Ne(d / m * 100);
      i(f);
    }
  };
}
function To(e) {
  if (e.defaultPrevented)
    return;
  const t = yt();
  fr(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = es({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function on(e) {
  const t = yt();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function ts({
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
      } = t(), l = pt({
        layout: n,
        panelConstraints: o
      });
      return r ? i : (ht(i, l) || Qe(a, {
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
  const n = on(e), r = it(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  ge(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  ge(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), i = ts({ groupId: n.id }).getLayout(), c = Kt({
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
  ht(i, l) || Qe(
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
function Ro(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = on(t);
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
        const r = on(t), o = it(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, c = r.separators.find(
          (d) => d.element === t
        );
        ge(c, "Matching separator not found");
        const l = i.get(c);
        ge(l, "Matching panels not found");
        const u = l[0], m = a.find(
          (d) => d.panelId === u.id
        );
        if (ge(m, "Panel metadata not found"), m.collapsible) {
          const d = s[u.id], f = m.collapsedSize === d ? r.mutableState.expandedPanelSizes[u.id] ?? m.minSize : m.collapsedSize;
          lt(t, f - d);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = on(t).separators.map(
          (s) => s.element
        ), o = Array.from(r).findIndex(
          (s) => s === e.currentTarget
        );
        ge(o !== null, "Index not found");
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
function Po(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = yt(), n = fr(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), Rt({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function ns({
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
    const { group: u, groupSize: m } = l, { orientation: d, panels: f } = u, { disableCursor: g } = u.mutableState;
    let h = 0;
    a ? d === "horizontal" ? h = (t.clientX - a.x) / m * 100 : h = (t.clientY - a.y) / m * 100 : d === "horizontal" ? h = t.clientX < 0 ? -100 : 100 : h = t.clientY < 0 ? -100 : 100;
    const y = r.get(u), S = o.get(u);
    if (!y || !S)
      return;
    const {
      defaultLayoutDeferred: w,
      derivedPanelConstraints: b,
      groupSize: v,
      layout: k,
      separatorToPanels: R
    } = S;
    if (b && k && R) {
      const L = Kt({
        delta: h,
        initialLayout: y,
        panelConstraints: b,
        pivotIndices: l.panels.map((O) => f.indexOf(O)),
        prevLayout: k,
        trigger: "mouse-or-touch"
      });
      if (ht(L, k)) {
        if (h !== 0 && !g)
          switch (d) {
            case "horizontal": {
              i |= h < 0 ? qa : Ja;
              break;
            }
            case "vertical": {
              i |= h < 0 ? Ga : Xa;
              break;
            }
          }
      } else
        Qe(l.group, {
          defaultLayoutDeferred: w,
          derivedPanelConstraints: b,
          groupSize: v,
          layout: L,
          separatorToPanels: R
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & go : c |= i & go, t.movementY === 0 ? c |= s & bo : c |= i & bo, nh(c), ur(e);
}
function Mo(e) {
  const t = yt(), n = mt();
  switch (n.state) {
    case "active":
      ns({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function _o(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = mt(), n = yt();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        Rt({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = it(a.group.id, !0);
          Qe(a.group, s, {
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
      ns({
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
      const a = fr(e, n);
      a.length === 0 ? t.state !== "inactive" && Rt({
        cursorFlags: 0,
        state: "inactive"
      }) : Rt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), ur(e.currentTarget);
      break;
    }
  }
}
function No(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (mt().state) {
      case "hover":
        Rt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function xo(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || Za(e.currentTarget) && e.preventDefault();
}
function Ao(e) {
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
function ph(e, t, n) {
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
function gh(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function bh({
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
    const d = r[m.id] ?? 0;
    switch (m.panelConstraints.groupResizeBehavior) {
      case "preserve-pixel-size": {
        s = !0;
        const f = d / 100 * n, g = Ne(
          f / t * 100
        );
        i.set(m.id, g), o += g;
        break;
      }
      case "preserve-relative-size":
      default: {
        c.push(m.id), a += d;
        break;
      }
    }
  }
  if (!s || c.length === 0)
    return r;
  const l = 100 - o, u = { ...r };
  if (i.forEach((m, d) => {
    u[d] = m;
  }), a > 0)
    for (const m of c) {
      const d = r[m] ?? 0;
      u[m] = Ne(
        d / a * l
      );
    }
  else {
    const m = Ne(
      l / c.length
    );
    for (const d of c)
      u[d] = m;
  }
  return u;
}
function yh(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const St = /* @__PURE__ */ new Map();
function vh(e) {
  let t = !0;
  ge(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const h of g) {
      const { borderBoxSize: y, target: S } = h;
      if (S === e.element) {
        if (t) {
          const w = _t({ group: e });
          if (w === 0)
            return;
          const b = it(e.id);
          if (!b)
            return;
          const v = Kn(e), k = b.defaultLayoutDeferred ? Ao(v) : b.layout, R = bh({
            group: e,
            nextGroupSize: w,
            prevGroupSize: b.groupSize,
            prevLayout: k
          }), L = pt({
            layout: R,
            panelConstraints: v
          });
          if (!b.defaultLayoutDeferred && ht(b.layout, L) && gh(
            b.derivedPanelConstraints,
            v
          ) && b.groupSize === w)
            return;
          Qe(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: v,
            groupSize: w,
            layout: L,
            separatorToPanels: b.separatorToPanels
          });
        }
      } else
        ph(e, S, y);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    ge(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = _t({ group: e }), i = Kn(e), c = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (yh(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[c] ?? l ?? Ao(i), m = pt({
    layout: u,
    panelConstraints: i
  }), d = e.element.ownerDocument;
  St.set(
    d,
    (St.get(d) ?? 0) + 1
  );
  const f = /* @__PURE__ */ new Map();
  return Ka(e).forEach((g) => {
    g.separator && f.set(g.separator, g.panels);
  }), Qe(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: m,
    separatorToPanels: f
  }), e.separators.forEach((g) => {
    ge(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", Ro);
  }), St.get(d) === 1 && (d.addEventListener("contextmenu", So, !0), d.addEventListener("dblclick", To, !0), d.addEventListener("pointerdown", Po, !0), d.addEventListener("pointerleave", Mo), d.addEventListener("pointermove", _o), d.addEventListener("pointerout", No), d.addEventListener("pointerup", xo, !0)), function() {
    t = !1, St.set(
      d,
      Math.max(0, (St.get(d) ?? 0) - 1)
    ), ah(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", Ro);
    }), St.get(d) || (d.removeEventListener(
      "contextmenu",
      So,
      !0
    ), d.removeEventListener(
      "dblclick",
      To,
      !0
    ), d.removeEventListener(
      "pointerdown",
      Po,
      !0
    ), d.removeEventListener("pointerleave", Mo), d.removeEventListener("pointermove", _o), d.removeEventListener("pointerout", No), d.removeEventListener("pointerup", xo, !0)), a.disconnect();
  };
}
function wh() {
  const [e, t] = P({}), n = N(() => t({}), []);
  return [e, n];
}
function mr(e) {
  const t = Bo();
  return `${e ?? t}`;
}
const vt = typeof window < "u" ? De : D;
function jt(e) {
  const t = _(e);
  return vt(() => {
    t.current = e;
  }, [e]), N(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function hr(...e) {
  return jt((t) => {
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
function pr(e) {
  const t = _({ ...e });
  return vt(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const rs = Gt(null);
function Sh(e, t) {
  const n = _({
    getLayout: () => ({}),
    setLayout: rh
  });
  Yn(t, () => n.current, []), vt(() => {
    Object.assign(
      n.current,
      ts({ groupId: e })
    );
  });
}
function os({
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
  style: d,
  ...f
}) {
  const g = _({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), h = jt((I) => {
    ht(g.current.onLayoutChange, I) || (g.current.onLayoutChange = I, c == null || c(I));
  }), y = jt(
    (I, E) => {
      ht(g.current.onLayoutChanged, I) || (g.current.onLayoutChanged = I, l == null || l(I, { isUserInteraction: E }));
    }
  ), S = mr(i), w = _(null), [b, v] = wh(), k = _({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: m,
    separators: []
  }), R = hr(w, a);
  Sh(S, s);
  const L = jt(
    (I, E) => {
      const T = mt(), x = wo(I), C = it(I);
      if (C) {
        let W = !1;
        switch (T.state) {
          case "active": {
            W = T.hitRegions.some(
              (H) => H.group === x
            );
            break;
          }
        }
        return {
          flexGrow: C.layout[E] ?? 1,
          pointerEvents: W ? "none" : void 0
        };
      }
      if (n != null && n[E])
        return {
          flexGrow: n == null ? void 0 : n[E]
        };
    }
  ), O = pr({
    defaultLayout: n,
    disableCursor: r
  }), B = K(
    () => ({
      get disableCursor() {
        return !!O.disableCursor;
      },
      getPanelStyles: L,
      id: S,
      orientation: u,
      registerPanel: (I) => {
        const E = k.current;
        return E.panels = Vn(u, [
          ...E.panels,
          I
        ]), v(), () => {
          E.panels = E.panels.filter(
            (T) => T !== I
          ), v();
        };
      },
      registerSeparator: (I) => {
        const E = k.current;
        return E.separators = Vn(u, [
          ...E.separators,
          I
        ]), v(), () => {
          E.separators = E.separators.filter(
            (T) => T !== I
          ), v();
        };
      },
      updatePanelProps: (I, { disabled: E }) => {
        const T = k.current.panels.find(
          (W) => W.id === I
        );
        T && (T.panelConstraints.disabled = E);
        const x = wo(S), C = it(S);
        x && C && Qe(x, {
          ...C,
          derivedPanelConstraints: Kn(x)
        });
      },
      updateSeparatorProps: (I, {
        disabled: E,
        disableDoubleClick: T
      }) => {
        const x = k.current.separators.find(
          (C) => C.id === I
        );
        x && (x.disabled = E, x.disableDoubleClick = T);
      }
    }),
    [L, S, v, u, O]
  ), M = _(null);
  return vt(() => {
    const I = w.current;
    if (I === null)
      return;
    const E = k.current;
    let T;
    if (O.defaultLayout !== void 0 && Object.keys(O.defaultLayout).length === E.panels.length) {
      T = {};
      for (const Y of E.panels) {
        const ae = O.defaultLayout[Y.id];
        ae !== void 0 && (T[Y.id] = ae);
      }
    }
    const x = {
      disabled: !!o,
      element: I,
      id: S,
      mutableState: {
        defaultLayout: T,
        disableCursor: !!O.disableCursor,
        expandedPanelSizes: k.current.lastExpandedPanelSizes,
        layouts: k.current.layouts
      },
      orientation: u,
      panels: E.panels,
      resizeTargetMinimumSize: E.resizeTargetMinimumSize,
      separators: E.separators
    };
    M.current = x;
    const C = vh(x), { defaultLayoutDeferred: W, derivedPanelConstraints: H, layout: J } = it(x.id, !0);
    !W && H.length > 0 && (h(J), y(J, !1));
    const ue = dr(S, (Y) => {
      const { defaultLayoutDeferred: ae, derivedPanelConstraints: Se, layout: te } = Y.next;
      if (ae || Se.length === 0)
        return;
      const de = x.panels.map(({ id: ie }) => ie).join(",");
      x.mutableState.layouts[de] = te, Se.forEach((ie) => {
        if (ie.collapsible) {
          const { layout: ne } = Y.prev ?? {};
          if (ne) {
            const z = Re(
              ie.collapsedSize,
              te[ie.panelId]
            ), U = Re(
              ie.collapsedSize,
              ne[ie.panelId]
            );
            z && !U && (x.mutableState.expandedPanelSizes[ie.panelId] = ne[ie.panelId]);
          }
        }
      });
      const Pe = mt().state !== "active";
      h(te), Pe && y(te, Y.isUserInteraction);
    });
    return () => {
      M.current = null, C(), ue();
    };
  }, [
    o,
    S,
    y,
    h,
    u,
    b,
    O
  ]), D(() => {
    const I = M.current;
    I && (I.mutableState.defaultLayout = n, I.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(rs.Provider, { value: B, children: /* @__PURE__ */ p(
    "div",
    {
      ...f,
      className: t,
      "data-group": !0,
      "data-testid": S,
      id: S,
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
os.displayName = "Group";
function gr() {
  const e = dt(rs);
  return ge(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function kh(e, t) {
  const { id: n } = gr(), r = _({
    collapse: _n,
    expand: _n,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: _n
  });
  Yn(t, () => r.current, []), vt(() => {
    Object.assign(
      r.current,
      es({ groupId: n, panelId: e })
    );
  });
}
function qn({
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
  panelRef: d,
  style: f,
  ...g
}) {
  const h = !!c, y = mr(c), S = pr({
    disabled: a
  }), w = _(null), b = hr(w, s), {
    getPanelStyles: v,
    id: k,
    orientation: R,
    registerPanel: L,
    updatePanelProps: O
  } = gr(), B = m !== null, M = jt(
    (x, C, W) => {
      m == null || m(x, c, W);
    }
  );
  vt(() => {
    const x = w.current;
    if (x !== null) {
      const C = {
        element: x,
        id: y,
        idIsStable: h,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: B ? M : void 0,
        panelConstraints: {
          groupResizeBehavior: i,
          collapsedSize: n,
          collapsible: r,
          defaultSize: o,
          disabled: S.disabled,
          maxSize: l,
          minSize: u
        }
      };
      return L(C);
    }
  }, [
    i,
    n,
    r,
    o,
    B,
    y,
    h,
    l,
    u,
    M,
    L,
    S
  ]), D(() => {
    O(y, { disabled: a });
  }, [a, y, O]), kh(y, d);
  const I = () => {
    const x = v(k, y);
    if (x)
      return JSON.stringify(x);
  }, E = hn(
    (x) => dr(k, x),
    I,
    I
  );
  let T;
  return E ? T = JSON.parse(E) : o !== void 0 ? T = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : T = { flexGrow: 1 }, /* @__PURE__ */ p(
    "div",
    {
      ...g,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": y,
      id: y,
      ref: b,
      style: {
        ...Ih,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...T
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
            ...f,
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
qn.displayName = "Panel";
const Ih = {
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
function Eh({
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
      layout: Kt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = pt({
      layout: Kt({
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
function as({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const c = mr(a), l = pr({
    disabled: n,
    disableDoubleClick: r
  }), [u, m] = P({}), [d, f] = P("inactive"), [g, h] = P(!1), y = _(null), S = hr(y, o), {
    disableCursor: w,
    id: b,
    orientation: v,
    registerSeparator: k,
    updateSeparatorProps: R
  } = gr(), L = v === "horizontal" ? "vertical" : "horizontal";
  vt(() => {
    const M = y.current;
    if (M !== null) {
      const I = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: M,
        id: c
      }, E = k(I), T = th(
        (C) => {
          f(
            C.next.state !== "inactive" && C.next.hitRegions.some(
              (W) => W.separator === I
            ) ? C.next.state : "inactive"
          );
        }
      ), x = dr(
        b,
        (C) => {
          const { derivedPanelConstraints: W, layout: H, separatorToPanels: J } = C.next, ue = J.get(I);
          if (ue) {
            const Y = ue[0], ae = ue.indexOf(Y);
            m(
              Eh({
                layout: H,
                panelConstraints: W,
                panelId: Y.id,
                panelIndex: ae
              })
            );
          }
        }
      );
      return () => {
        T(), x(), E();
      };
    }
  }, [b, c, k, l]), D(() => {
    R(c, { disabled: n, disableDoubleClick: r });
  }, [n, r, c, R]);
  let O;
  n && !w && (O = "not-allowed");
  let B;
  if (n)
    B = "disabled";
  else
    switch (d) {
      case "active": {
        B = "active";
        break;
      }
      default:
        g ? B = "focus" : B = d;
    }
  return /* @__PURE__ */ p(
    "div",
    {
      ...i,
      "aria-controls": u.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": L,
      "aria-valuemax": u.valueMax,
      "aria-valuemin": u.valueMin,
      "aria-valuenow": u.valueNow,
      children: e,
      className: t,
      "data-separator": B,
      "data-testid": c,
      id: c,
      onBlur: () => h(!1),
      onFocus: () => h(!0),
      ref: S,
      role: "separator",
      style: {
        flexBasis: "auto",
        cursor: O,
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
as.displayName = "Separator";
const br = 30, yr = 65, Vt = 50, Th = 100 - yr, Rh = 100 - br;
function Ph(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(yr, Math.max(br, t)) : Vt;
}
function vr(e) {
  return 100 - e;
}
function kt(e) {
  return `${e}%`;
}
const wr = "reader-document", qt = "reader-assistant", ss = "retainpdf.reader.ai-split-layout.v1", Mh = {
  [wr]: vr(Vt),
  [qt]: Vt
};
function Sr(e) {
  const t = Ph(e == null ? void 0 : e[qt]);
  return {
    [wr]: vr(t),
    [qt]: t
  };
}
function _h() {
  try {
    const e = JSON.parse(localStorage.getItem(ss) || "null");
    return Sr(e);
  } catch {
    return Mh;
  }
}
function Nh(e) {
  try {
    localStorage.setItem(ss, JSON.stringify(Sr(e)));
  } catch {
  }
}
function Nn(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Sr(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[qt]}vw`
  );
}
function xh() {
  const e = _(null), [t] = P(_h);
  De(() => {
    const o = e.current;
    return Nn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = N((o) => {
    Nn(e.current, o);
  }, []), r = N((o, a) => {
    Nn(e.current, o), a.isUserInteraction && Nh(o);
  }, []);
  return /* @__PURE__ */ A(
    os,
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
          qn,
          {
            id: wr,
            defaultSize: kt(vr(Vt)),
            minSize: kt(Th),
            maxSize: kt(Rh)
          }
        ),
        /* @__PURE__ */ p(
          as,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ p("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ p(
          qn,
          {
            id: qt,
            defaultSize: kt(Vt),
            minSize: kt(br),
            maxSize: kt(yr)
          }
        )
      ]
    }
  );
}
function Ah({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = P(!1);
  if (D(() => {
    !e && !t && o(!1);
  }, [e, t]), r || !e && !t)
    return null;
  const a = [
    e ? "译文区域" : "",
    t ? "阅读元数据" : ""
  ].filter(Boolean);
  return /* @__PURE__ */ A("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ A("span", { className: "reader-error-notice-text", children: [
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
function Lh({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(Ah, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ A(Oe, { children: [
    e ? /* @__PURE__ */ p("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ A("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ p(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ A("div", { className: "reader-react-error", role: "alert", children: [
      /* @__PURE__ */ p("span", { className: "reader-react-error-text", children: n }),
      s ? /* @__PURE__ */ p(oe, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function Ch(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Dh() {
  const [e, t] = P(!1), n = Bo(), r = _(null), o = Aa(), a = K(() => [...Rl, ...Zd(o)], [o]);
  return D(() => {
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
  }, [e]), D(() => {
    const s = (i) => {
      if (i.defaultPrevented || i.metaKey || i.ctrlKey || i.altKey || Ch(i.target)) return;
      const c = i.key;
      if (c === "?" || c === "h" || c === "H" || c === "/") {
        if (c === "/" && !i.shiftKey)
          return;
        i.preventDefault(), t((l) => !l);
      }
    };
    return window.addEventListener("keydown", s), () => window.removeEventListener("keydown", s);
  }, []), /* @__PURE__ */ A("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
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
        children: /* @__PURE__ */ p(Gs, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ A(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ A("div", { className: "reader-react-shortcuts-head", children: [
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
          /* @__PURE__ */ p("div", { className: "reader-react-shortcuts-body", children: a.map((s) => /* @__PURE__ */ A("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ p("h3", { children: s.title }),
            /* @__PURE__ */ p("ul", { children: s.items.map((i) => /* @__PURE__ */ A("li", { children: [
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
const $h = ["source", "sideBySide", "translated"], Oh = { source: "", translated: "", sideBySide: "" };
function zh(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = an(e.sourceUrl), n = an(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return bi({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function Fh(e) {
  const [t, n] = P(() => /* @__PURE__ */ new Set()), r = K(
    () => e ? zh(e) : Oh,
    [e]
  ), o = K(
    () => $h.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = N(async (s) => {
    if (!e) return;
    const i = an(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? gi(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await yi(
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
        vi(l), n((u) => {
          const m = new Set(u);
          return m.delete(s), m;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const Bh = {
  source: Wo,
  sideBySide: Ko,
  translated: Vo
}, jh = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function Hh(e) {
  const t = tt(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Fh(n), i = _(null);
  return D(() => {
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
  }, []), /* @__PURE__ */ A("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ A("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ p(Xs, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ p(Uo, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = ps[c], u = an(r[c]), m = a.has(c), d = !!u && !m, f = d ? "" : gs(c, r), g = Bh[c];
      return /* @__PURE__ */ A(
        "button",
        {
          type: "button",
          id: `reader-download-${c}`,
          className: `reader-download-action${m ? " is-busy" : ""}`,
          disabled: !d,
          "aria-label": d ? `下载${l.label}` : f,
          onClick: () => {
            i.current && (i.current.open = !1), s(c);
          },
          children: [
            /* @__PURE__ */ p(g, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ A("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ A("span", { className: "reader-download-action-label", children: [
                jh[c],
                " PDF"
              ] }),
              f ? /* @__PURE__ */ p("span", { className: "reader-download-action-reason", children: f }) : null
            ] })
          ]
        },
        c
      );
    }) })
  ] });
}
const Uh = "retainpdf:reader:bookmarks:v1:", Wh = 200;
function kr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function is(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Uh}${t}` : "";
}
function Kh(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function mn(e, t = kr()) {
  const n = is(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = Kh(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function Jn(e, t, n) {
  const r = is(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, Wh);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function Vh(e, t, n = "", { storage: r = kr(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = mn(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? Jn(e, a.filter((i) => i.page !== s), r) : Jn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function qh(e, t, n = kr()) {
  return Jn(e, mn(e, n).filter((r) => r.page !== t), n);
}
function Jh(e, t) {
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
function Gh({ filled: e }) {
  return /* @__PURE__ */ p("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ p("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function Xh({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = P(() => mn(e)), [i, c] = P(!1), l = _(null);
  if (D(() => {
    s(mn(e)), c(!1);
  }, [e]), D(() => {
    if (!i) return;
    const d = (g) => {
      l.current && !l.current.contains(g.target) && c(!1);
    }, f = (g) => {
      g.key === "Escape" && c(!1);
    };
    return document.addEventListener("pointerdown", d), document.addEventListener("keydown", f), () => {
      document.removeEventListener("pointerdown", d), document.removeEventListener("keydown", f);
    };
  }, [i]), !e || n <= 0) return null;
  const u = Math.min(Math.max(t, 1), n), m = a.some((d) => d.page === u);
  return /* @__PURE__ */ A("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: l, children: [
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${m ? " is-marked" : ""}`,
        "aria-pressed": m,
        "aria-label": m ? `取消第 ${u} 页的书签` : `给第 ${u} 页加书签`,
        title: m ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(Vh(e, u, Jh(r, u))),
        children: /* @__PURE__ */ p(Gh, { filled: m })
      }
    ),
    a.length ? /* @__PURE__ */ A(
      "button",
      {
        type: "button",
        className: "reader-react-hud-btn reader-bookmark-list-btn",
        "aria-expanded": i,
        "aria-haspopup": "true",
        "aria-label": `书签列表，共 ${a.length} 个`,
        title: "书签列表",
        onClick: () => c((d) => !d),
        children: [
          /* @__PURE__ */ p(Ys, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { className: "reader-bookmark-count", children: a.length })
        ]
      }
    ) : null,
    i && a.length ? /* @__PURE__ */ p("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ p("ol", { className: "reader-bookmark-list", children: a.map((d) => /* @__PURE__ */ A("li", { className: d.page === u ? "is-current" : "", children: [
      /* @__PURE__ */ A(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(d.page, n)), c(!1);
          },
          children: [
            /* @__PURE__ */ A("span", { className: "reader-bookmark-page", children: [
              "第 ",
              d.page,
              " 页"
            ] }),
            d.label ? /* @__PURE__ */ p("span", { className: "reader-bookmark-label", children: d.label }) : null
          ]
        }
      ),
      /* @__PURE__ */ p(
        "button",
        {
          type: "button",
          className: "reader-bookmark-remove",
          "aria-label": `删除第 ${d.page} 页的书签`,
          onClick: () => s(qh(e, d.page)),
          children: "×"
        }
      )
    ] }, d.page)) }) }) : null
  ] });
}
function Yh(e) {
  const [t, n] = P([]);
  return D(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = et().loadIssues;
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
function Zh(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const Qh = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, ep = ["failed", "content", "layout"];
function tp(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function np({ jobId: e, currentPage: t }) {
  var m;
  const n = Yh(e), r = (m = tt()) == null ? void 0 : m.jumpToBlock, [o, a] = P(!1), [s, i] = P(-1), c = _(null);
  D(() => i(-1), [n]);
  const l = (d) => {
    const f = n[d];
    !f || !r || (i(d), r(f.readerItemId));
  }, u = _({ issues: n, last: s, currentPage: t, goTo: l });
  return u.current = { issues: n, last: s, currentPage: t, goTo: l }, D(() => {
    const d = (f) => {
      if (f.key.toLowerCase() !== "n" || f.metaKey || f.ctrlKey || f.altKey || tp(f.target)) return;
      const { issues: g, last: h, currentPage: y, goTo: S } = u.current, w = Zh(g, h, y, f.shiftKey);
      w < 0 || (f.preventDefault(), S(w));
    };
    return document.addEventListener("keydown", d), () => document.removeEventListener("keydown", d);
  }, []), D(() => {
    if (!o) return;
    const d = (f) => {
      var g;
      (g = c.current) != null && g.contains(f.target) || a(!1);
    };
    return document.addEventListener("pointerdown", d, !0), () => document.removeEventListener("pointerdown", d, !0);
  }, [o]), n.length ? /* @__PURE__ */ A("div", { className: "reader-react-hud-group reader-issues", ref: c, "aria-label": "待处理", children: [
    /* @__PURE__ */ A(
      oe,
      {
        className: "reader-react-hud-btn reader-issues-toggle",
        "aria-expanded": o,
        "aria-haspopup": "true",
        "aria-label": `待处理 ${n.length} 处`,
        title: "这次翻译里要人看一眼的段落（N 下一处，Shift+N 上一处）",
        onClick: () => a((d) => !d),
        children: [
          /* @__PURE__ */ p(Zs, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { children: n.length })
        ]
      }
    ),
    o ? /* @__PURE__ */ A("div", { className: "reader-issues-popover", role: "dialog", "aria-label": "待处理", children: [
      /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
      ep.map((d) => {
        const f = n.map((g, h) => ({ issue: g, index: h })).filter(({ issue: g }) => g.kind === d);
        return f.length ? /* @__PURE__ */ A("section", { className: "reader-issues-group", "data-issue-kind": d, children: [
          /* @__PURE__ */ A("h4", { children: [
            Qh[d],
            /* @__PURE__ */ p("span", { children: f.length })
          ] }),
          /* @__PURE__ */ p("ol", { children: f.map(({ issue: g, index: h }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ A(
            oe,
            {
              className: "reader-issues-item",
              "aria-current": h === s ? "true" : void 0,
              onClick: () => {
                l(h), a(!1);
              },
              children: [
                /* @__PURE__ */ p("span", { className: "reader-issues-title", children: g.title }),
                /* @__PURE__ */ A("span", { className: "reader-issues-page", children: [
                  "第 ",
                  g.page,
                  " 页"
                ] }),
                g.detail ? /* @__PURE__ */ p("span", { className: "reader-issues-detail", children: g.detail }) : null
              ]
            }
          ) }, `${g.kind}:${g.readerItemId}`)) })
        ] }, d) : null;
      })
    ] }) : null
  ] }) : null;
}
const rp = 48, op = 96, ap = 700;
function sp(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= rp, downSoFar: r };
}
function ip(e) {
  const [t, n] = P(!1), r = _(0);
  return D(() => {
    const o = /* @__PURE__ */ new WeakMap();
    let a = 0;
    const s = () => {
      a = Date.now();
    }, i = /* @__PURE__ */ new WeakMap(), c = () => {
      const d = e.current;
      return !!(d && (d.querySelector(":focus-visible") || d.querySelector("[aria-expanded='true']")));
    }, l = (d) => {
      const f = d.target;
      if (!(f instanceof Element) || (i.has(f) || i.set(f, !!f.querySelector(`[${Ee}]`)), !i.get(f))) return;
      const g = f.scrollTop, h = o.get(f);
      if (o.set(f, g), h === void 0 || Date.now() - a > ap) return;
      const y = sp(!1, r.current, g - h);
      r.current = y.downSoFar, g - h < -4 ? n(!1) : y.hidden && !c() && n(!0);
    }, u = (d) => {
      d.clientY >= window.innerHeight - op && (r.current = 0, n(!1));
    }, m = () => {
      c() && n(!1);
    };
    document.addEventListener("scroll", l, { capture: !0, passive: !0 }), window.addEventListener("pointermove", u, { passive: !0 }), document.addEventListener("focusin", m);
    for (const d of ["wheel", "touchmove", "keydown"]) window.addEventListener(d, s, { passive: !0, capture: !0 });
    return () => {
      for (const d of ["wheel", "touchmove", "keydown"]) window.removeEventListener(d, s, { capture: !0 });
      document.removeEventListener("scroll", l, { capture: !0 }), window.removeEventListener("pointermove", u), document.removeEventListener("focusin", m);
    };
  }, [e]), t;
}
function cp(e) {
  const t = tt(), n = Pa(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Xt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = sc(a), m = a > ta + 1e-3, d = a < dn - 1e-3, f = It(r, st()), g = f >= dn ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", h = _(null), y = ip(h), [S, w] = P(!1), [b, v] = P(`${i}`);
  D(() => {
    S || v(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, S]);
  const k = () => {
    if (w(!1), !l || c <= 0)
      return;
    const R = Number(`${b}`.trim());
    l(fn(R, c));
  };
  return /* @__PURE__ */ A("div", { ref: h, className: "reader-react-hud", "data-reader-hud": "true", "data-hud-hidden": y ? "true" : void 0, children: [
    o ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "页码", children: S ? /* @__PURE__ */ A(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (R) => {
          R.preventDefault(), k();
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
              value: b,
              autoFocus: !0,
              onChange: (R) => v(R.target.value.replace(/[^\d]/g, "")),
              onBlur: k,
              onKeyDown: (R) => {
                R.key === "Escape" && (R.preventDefault(), w(!1), v(`${i}`));
              }
            }
          ),
          /* @__PURE__ */ A("span", { className: "reader-react-hud-page-suffix", children: [
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
          !l || c <= 0 || (v(`${i}`), w(!0));
        },
        children: c > 0 ? `${Math.min(i, c)} / ${c}` : "—"
      }
    ) }),
    e.searchSlot ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "搜索", children: e.searchSlot }) : null,
    e.bookmarkScope ? /* @__PURE__ */ p(
      Xh,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: c,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
      }
    ) : null,
    e.issuesJobId ? /* @__PURE__ */ p(np, { jobId: e.issuesJobId, currentPage: i }) : null,
    t != null && t.toggleDocDark ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "显示", children: /* @__PURE__ */ p(
      oe,
      {
        className: "reader-react-hud-btn reader-react-hud-doc-dark",
        "aria-pressed": t.docDark ? "true" : "false",
        "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
        title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
        onClick: t.toggleDocDark,
        children: /* @__PURE__ */ p(lp, {})
      }
    ) }) : null,
    /* @__PURE__ */ A("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ p(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !m,
          onClick: () => s(Wt(a, -1)),
          children: "−"
        }
      ),
      /* @__PURE__ */ A(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn reader-react-hud-zoom-label",
          "aria-label": `${u}%，点击${g}`,
          title: g,
          onClick: () => s(f),
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
          onClick: () => s(Wt(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(Dh, {}) })
  ] });
}
function lp() {
  return /* @__PURE__ */ A("svg", { width: "14", height: "14", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: [
    /* @__PURE__ */ p("circle", { cx: "8", cy: "8", r: "6.25", fill: "none", stroke: "currentColor", strokeWidth: "1.5" }),
    /* @__PURE__ */ p("path", { d: "M8 1.75a6.25 6.25 0 0 1 0 12.5z", fill: "currentColor" })
  ] });
}
function Lo(e) {
  var t, n;
  return sa(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function up(e) {
  const [t, n] = P(() => ({
    scope: e,
    panel: Lo(Ve(e))
  }));
  D(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Lo(Ve(e))
    });
  }, [e]), D(() => {
    t.scope === e && gn(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = N((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const Gn = "download-toast";
function dp({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ A("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ A("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ p("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ p("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ p("div", { className: "download-toast-track", children: /* @__PURE__ */ p("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ p("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function fp(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    An.dismiss(Gn);
    return;
  }
  An.custom(
    () => /* @__PURE__ */ p(dp, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: Gn, duration: 1 / 0 }
  );
}
function mp() {
  const e = N((t) => {
    t && (t.setState = fp, t.hide = () => An.dismiss(Gn));
  }, []);
  return /* @__PURE__ */ A(Oe, { children: [
    /* @__PURE__ */ p(Ps, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
const Co = { itemId: null, origin: null };
function hp() {
  let e = Co;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? Co : { itemId: n, origin: r };
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
function pp({
  nodes: e,
  currentPage: t,
  onJumpPage: n
}) {
  const r = K(() => ba(e, t), [e, t]), [o, a] = P(() => /* @__PURE__ */ new Set([...Hr(r), ...r ? [r] : []]));
  D(() => {
    a(/* @__PURE__ */ new Set([...Hr(r), ...r ? [r] : []]));
  }, [e]);
  const s = _(null);
  D(() => {
    var l, u;
    (u = (l = s.current) == null ? void 0 : l.querySelector('[aria-current="location"]')) == null || u.scrollIntoView({ block: "center" });
  }, [e]);
  const i = (l) => a((u) => {
    const m = new Set(u);
    return m.has(l) ? m.delete(l) : m.add(l), m;
  }), c = (l) => l.map((u) => {
    const m = o.has(u.id), d = u.children.length > 0;
    return /* @__PURE__ */ A("li", { className: "reader-bookmark", "data-level": u.level, children: [
      /* @__PURE__ */ A("div", { className: "reader-bookmark-row", children: [
        d ? /* @__PURE__ */ p(
          oe,
          {
            className: `reader-bookmark-toggle${m ? " is-open" : ""}`,
            "aria-label": m ? `收起「${u.title}」` : `展开「${u.title}」`,
            "aria-expanded": m,
            onClick: () => i(u.id),
            children: /* @__PURE__ */ p(qo, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 })
          }
        ) : /* @__PURE__ */ p("span", { className: "reader-bookmark-spacer", "aria-hidden": "true" }),
        /* @__PURE__ */ A(
          oe,
          {
            className: "reader-finder-entry reader-bookmark-entry",
            "data-level": u.level,
            "aria-current": u.id === r ? "location" : void 0,
            disabled: u.page === null,
            title: u.page === null ? "这条书签没有指到页" : `${u.title} · 第 ${u.page} 页`,
            onClick: () => u.page !== null && n(u.page),
            children: [
              /* @__PURE__ */ p("span", { className: "reader-finder-entry-text", children: u.title }),
              u.page !== null ? /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: u.page }) : null
            ]
          }
        )
      ] }),
      d && m ? /* @__PURE__ */ p("ol", { className: "reader-bookmark-children", children: c(u.children) }) : null
    ] }, u.id);
  });
  return /* @__PURE__ */ p("ol", { ref: s, className: "reader-finder-list reader-bookmark-tree", "aria-label": "书签", children: c(e) });
}
const gp = [], bp = [];
function yp({
  open: e,
  onToggle: t,
  children: n
}) {
  return /* @__PURE__ */ A("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ p(oe, { className: "reader-finder-toggle", "aria-label": "目录", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: /* @__PURE__ */ p(ei, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }) }),
    n
  ] });
}
function vp({ open: e, onToggle: t }) {
  return /* @__PURE__ */ p(
    oe,
    {
      className: "reader-react-hud-btn reader-search-toggle",
      "data-finder-toggle": "search",
      "aria-label": "在书里搜索",
      "aria-pressed": e === "search",
      title: "在书里搜索（原文和译文，⌘F）",
      onClick: () => t("search"),
      children: /* @__PURE__ */ p(Qs, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 })
    }
  );
}
function wp({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0,
  bookmarks: c = bp,
  onJumpPage: l
}) {
  var M, I;
  const u = ((M = tt()) == null ? void 0 : M.regions) ?? gp, m = ((I = Pa()) == null ? void 0 : I.currentPage) ?? 1, d = K(() => Yl(u), [u]), f = c.length > 0 && !!l, [g, h] = P("bookmarks"), y = f && (g === "bookmarks" || !d.length), S = Zl(d, m), w = K(() => tu(u, s), [u, s]), [b, v] = P(-1);
  D(() => v(-1), [s]);
  const k = _(null), R = _(null), L = _(n);
  L.current = n, D(() => {
    const E = (x) => {
      var W, H;
      const C = x.target;
      !C || (W = R.current) != null && W.contains(C) || (H = C.closest) != null && H.call(C, ".reader-finder-toggles, [data-finder-toggle]") || L.current();
    }, T = (x) => {
      x.key === "Escape" && L.current();
    };
    return document.addEventListener("pointerdown", E, !0), document.addEventListener("keydown", T), () => {
      document.removeEventListener("pointerdown", E, !0), document.removeEventListener("keydown", T);
    };
  }, []);
  const O = _(null);
  D(() => {
    var E, T, x;
    e === "search" ? (E = k.current) == null || E.focus() : (x = (T = O.current) == null ? void 0 : T.querySelector('[aria-current="location"]')) == null || x.scrollIntoView({ block: "center" });
  }, [e, i]), D(() => {
    var E, T;
    e === "search" && b >= 0 && ((T = (E = O.current) == null ? void 0 : E.querySelector('[aria-current="true"]')) == null || T.scrollIntoView({ block: "nearest" }));
  }, [e, b]);
  const B = (E) => {
    const T = w[E];
    T && (v(E), r(T.itemId));
  };
  return /* @__PURE__ */ A("aside", { ref: R, className: "reader-finder", "data-finder-tab": e, "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ A("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ A("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ p(oe, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ p(oe, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ p(oe, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(bt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" && f && d.length ? /* @__PURE__ */ A("div", { className: "reader-finder-switch", role: "radiogroup", "aria-label": "目录按什么列", children: [
      /* @__PURE__ */ p(oe, { className: "reader-finder-switch-option", role: "radio", "aria-checked": y, onClick: () => h("bookmarks"), children: "按书签" }),
      /* @__PURE__ */ p(oe, { className: "reader-finder-switch-option", role: "radio", "aria-checked": !y, onClick: () => h("headings"), children: "按标题" })
    ] }) : null,
    e === "outline" && y && l ? /* @__PURE__ */ p(pp, { nodes: c, currentPage: m, onJumpPage: l }) : e === "outline" ? d.length ? /* @__PURE__ */ p("ol", { ref: O, className: "reader-finder-list", children: d.map((E, T) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ A(
      oe,
      {
        className: "reader-finder-entry",
        "data-level": E.level,
        "aria-current": T === S ? "location" : void 0,
        onClick: () => r(E.itemId),
        children: [
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-text", children: E.text }),
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: E.page })
        ]
      }
    ) }, E.itemId)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: u.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ A(Oe, { children: [
      /* @__PURE__ */ A("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          Jo,
          {
            ref: k,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "原文、译文里的字",
            "aria-label": "在书里搜索",
            value: o,
            onChange: (E) => a(E.target.value),
            onKeyDown: (E) => {
              E.key === "Enter" ? (E.preventDefault(), B(nu(b, w.length, E.shiftKey))) : E.key === "Escape" && (E.preventDefault(), n()), E.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: w.length === 0 ? "没有找到" : `${b >= 0 ? `第 ${b + 1} / ` : ""}${w.length >= 200 ? "200+ 处，只列前 200 处" : `${w.length} 处`}${b < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { className: "reader-finder-list", children: w.map((E, T) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ A(oe, { className: "reader-finder-entry is-hit", "aria-current": T === b ? "true" : void 0, onClick: () => B(T), children: [
        /* @__PURE__ */ A("span", { className: "reader-finder-entry-text", children: [
          E.snippet.slice(0, E.at),
          /* @__PURE__ */ p("mark", { children: E.snippet.slice(E.at, E.at + E.length) }),
          E.snippet.slice(E.at + E.length)
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: E.page })
      ] }) }, E.itemId)) })
    ] })
  ] });
}
function Sp({
  active: e,
  extensions: t = ir
}) {
  const [n, r] = P(!1), [o, a] = P(null), s = Aa(), i = (d) => {
    var f;
    return ((f = s.find((g) => g.id === d)) == null ? void 0 : f.contribution.toolbarItems) ?? [];
  }, c = t.some(({ id: d }) => i(d).some((f) => f.pressed)), l = t.flatMap((d) => [...i(d.id).map((f) => f.label), ...(d.panels ?? []).map((f) => f.label)]), u = (() => {
    if (!o) return null;
    for (const { id: d } of t) {
      const f = i(d).find((g) => `${d}:${g.key}` === o);
      if (f != null && f.popup) return f.popup(() => {
        a(null), r(!1);
      });
    }
    return null;
  })(), m = _(null);
  return D(() => {
    if (!n && !o) return;
    const d = () => {
      r(!1), a(null);
    }, f = (h) => {
      var y;
      (y = m.current) != null && y.contains(h.target) || d();
    }, g = (h) => {
      h.key === "Escape" && d();
    };
    return document.addEventListener("pointerdown", f, !0), document.addEventListener("keydown", g), () => {
      document.removeEventListener("pointerdown", f, !0), document.removeEventListener("keydown", g);
    };
  }, [n, o]), /* @__PURE__ */ A("div", { className: "reader-toolball", ref: m, "data-open": n ? "true" : void 0, children: [
    u,
    n ? /* @__PURE__ */ p("div", { className: "reader-toolball-stack", role: "group", "aria-label": "工具", children: t.map((d) => {
      const f = cr([d]);
      return /* @__PURE__ */ A(Xn, { children: [
        i(d.id).map((g) => {
          const h = `${d.id}:${g.key}`, y = g.Icon;
          return /* @__PURE__ */ p(
            oe,
            {
              className: "reader-toolball-item",
              "aria-label": g.label,
              title: g.title || g.label,
              "aria-pressed": !!g.pressed || o === h,
              "data-toolball-item": g.key,
              onClick: () => {
                var S;
                if (g.popup) {
                  a((w) => w === h ? null : h);
                  return;
                }
                (S = g.onClick) == null || S.call(g), r(!1);
              },
              children: /* @__PURE__ */ p(y, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
            },
            h
          );
        }),
        f.length ? /* @__PURE__ */ p(Wm, { active: e, tabs: f }) : null
      ] }, d.id);
    }) }) : null,
    /* @__PURE__ */ p(
      oe,
      {
        className: "reader-toolball-ball",
        "aria-label": n ? "收起工具" : `工具：${l.join("、")}`,
        title: n ? "收起" : "工具",
        "aria-expanded": n,
        "data-active": e || c ? "true" : void 0,
        onClick: () => {
          r((d) => !d), a(null);
        },
        children: n ? /* @__PURE__ */ p(bt, { size: 20, strokeWidth: 2.2, "aria-hidden": !0 }) : /* @__PURE__ */ p(ti, { size: 20, strokeWidth: 2.1, "aria-hidden": !0 })
      }
    )
  ] });
}
function kp(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Ip(e) {
  var r;
  if (e.shiftKey || kp(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${Qo}`))) return null;
  const n = Number((r = t.closest(`[${Ee}]`)) == null ? void 0 : r.getAttribute(Ee)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Ep({
  menu: e,
  onClose: t,
  actions: n,
  sections: r
}) {
  const o = _(null);
  if (D(() => {
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
  return /* @__PURE__ */ A("div", { ref: o, className: "reader-ink-menu", style: { left: s, top: i }, "data-ink-menu": "true", children: [
    n.length ? /* @__PURE__ */ p("div", { className: "reader-ink-menu-actions", role: "menu", "aria-label": "书页", children: n.map((c) => /* @__PURE__ */ A(
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
    r.map((c) => /* @__PURE__ */ p(Xn, { children: c.render({ page: e.page, close: t }) }, c.id))
  ] });
}
function Tp({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ p("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ A("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
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
const cs = "retainpdf:reader:doc-theme:v1", Do = "data-reader-doc";
function ls() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Rp(e = ls()) {
  try {
    return (e == null ? void 0 : e.getItem(cs)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function Pp(e, t = ls()) {
  try {
    t == null || t.setItem(cs, e);
  } catch {
  }
}
function $o(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(Do, "dark") : t.removeAttribute(Do));
}
function Mp() {
  const [e, t] = P(() => Rp());
  D(() => {
    $o(e);
  }, [e]), D(() => () => $o("light"), []);
  const n = N(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return Pp(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
function _p({ state: e, bookmarks: t }) {
  const { finder: n, setFinder: r, toggleFinder: o, findQuery: a, setFindQuery: s, findTerm: i, findFocus: c, jumpFromFinder: l, jumpToPageFromFinder: u } = e;
  return /* @__PURE__ */ A(Oe, { children: [
    /* @__PURE__ */ p(yp, { open: n, onToggle: o }),
    n ? /* @__PURE__ */ p(
      wp,
      {
        tab: n,
        onTab: r,
        onClose: () => r(null),
        onJump: l,
        bookmarks: t,
        onJumpPage: u,
        query: a,
        onQuery: s,
        term: i,
        focusSignal: c
      }
    ) : null
  ] });
}
function Np({
  session: e,
  zoomDocuments: t,
  zoomItem: n,
  setZoomItem: r,
  closeZoom: o,
  visiblePdfMode: a
}) {
  return /* @__PURE__ */ p(Oe, { children: n ? /* @__PURE__ */ p(
    xm,
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
function xp(e) {
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
const Ap = 720;
function Lp(e, t) {
  return !t || !Number.isFinite(e) || e <= 0 ? !0 : e >= Ap;
}
function Cp(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function Dp(e, t, n = !0) {
  const { sessionFiles: r } = e, [o, a] = P(!1), s = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, i = xp({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: s,
    liveTranslationVisible: o,
    assistantOpen: t,
    compareFits: n
  }), c = dl({
    hasOverlayContent: s,
    connection: e.liveTranslation.connection,
    showSource: i.showSource,
    liveTranslationVisible: o,
    assistantOpen: t
  }), l = i.sourceViewOnly, u = i.visibleMode;
  D(() => {
    a(!1);
  }, [e.viewStateKey]), D(() => {
    e.session.jobTerminal && a(!1);
  }, [e.session.jobTerminal]);
  const m = _(null);
  return D(() => {
    m.current !== e.viewStateKey && hl({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: l,
      jobTerminal: e.session.jobTerminal
    }) && (m.current = e.viewStateKey, a(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, l]), { liveTranslationVisible: o, setLiveTranslationVisible: a, paneComposition: i, liveToggles: c, sourceViewOnly: l, visiblePdfMode: u };
}
function $p(e, { liveTranslationVisible: t, setLiveTranslationVisible: n, liveToggles: r, sourceViewOnly: o, visiblePdfMode: a }) {
  const s = fl(e.liveTranslation), i = N(() => {
    s && e.goToPage(s, "source");
  }, [e.goToPage, s]), [c, l] = P(null);
  D(() => {
    a === "compare" && e.session.jobTerminal && l(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, a]);
  const u = c !== e.viewStateKey && pl({
    state: e.liveTranslation,
    sourceViewOnly: o,
    visibleMode: a
  }), m = K(() => r.sourcePaneToggle ? /* @__PURE__ */ p(
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
  return { latestLivePage: s, jumpToLatestLivePage: i, offerCompletion: u, setCompletionDismissedKey: l, sourcePaneAction: m };
}
function Op() {
  const [e] = P(Wd), t = tf(e), n = Xd(t);
  return { contributionStore: e, contributions: t, reserveRight: n };
}
function zp(e, t, n) {
  const r = _(e);
  D(() => {
    const o = e > 0 && r.current <= 0;
    r.current = e, o && t && n();
  }, [e]);
}
function Fp(e, t, {
  translationVersions: n,
  bookmarks: r,
  regionHover: o,
  assistantPanel: a,
  closeAssistant: s,
  visiblePdfMode: i,
  changeWorkspace: c,
  jumpToBlockIn: l,
  zoomDocuments: u,
  editBlock: m
}) {
  const { session: d, panes: f } = e, g = _(e.currentPage);
  g.current = e.currentPage;
  const h = N(() => g.current, []), y = K(() => ({
    documentId: d.documentId || "",
    jobId: d.jobId,
    versionId: n.readingVersionId || null,
    translationVersions: n.versions,
    regions: d.regions,
    metadata: d.readerMetadata,
    bookmarks: r,
    pageCount: f.hudNumPages || 0,
    resetKey: e.viewStateKey,
    hoveredItemId: () => o.get().itemId,
    goToPage: e.goToPage,
    sourceOnly: e.sourceOnly,
    activePanel: a,
    closePanel: s,
    visibleMode: i,
    setWorkspace: c,
    jumpToBlock: l,
    shellEl: e.shell.shellEl,
    primaryPane: e.panes.primaryPane,
    pdfDocuments: u,
    editBlock: m,
    currentPage: h
  }), [
    d.documentId,
    d.jobId,
    n,
    d.regions,
    d.readerMetadata,
    r,
    f.hudNumPages,
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
    m
  ]), { contributionStore: S, contributions: w, reserveRight: b } = t, v = K(() => Vd(w), [w]), k = K(() => Yd(w), [w]), R = K(() => Gd(w), [w]), L = K(() => qd(w), [w]), O = Jd(w);
  return { readerApi: y, contributionStore: S, contributions: w, pageLayers: v, compareVersion: k, textMarks: R, menuSections: L, pointerTakenId: O, reserveRight: b };
}
function Bp() {
  try {
    return et().translationEdit ?? null;
  } catch {
    return null;
  }
}
const jp = "这本书正在处理（翻译或排版），处理完才能改。", Hp = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function Up({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = Bp(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = au(s), l = !t || Ht(t), u = du(n), [m, d] = P(""), [f, g] = P(null), [h, y] = P(() => /* @__PURE__ */ new Map()), [S, w] = P(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [b, v] = P(() => /* @__PURE__ */ new Map()), [k, R] = P({ phase: "idle" }), L = _({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  D(() => {
    g(null), L.drafts.clear(), L.generation.current = null, v(/* @__PURE__ */ new Map()), R({ phase: "idle" });
  }, [s]), D(() => {
    if (d(""), !i || c || !a) return;
    let C = !1;
    return a.resolveOwnerJobId(s).then((W) => {
      C || d(`${W || s}`.trim() || s);
    }).catch(() => {
      C || d(s);
    }), () => {
      C = !0;
    };
  }, [i, c, a, s]), D(() => {
    if (y(/* @__PURE__ */ new Map()), !a || !m || !u || !l) return;
    let C = !1;
    return a.fetchRevisions(m).then((W) => {
      C || y(fu(W, u));
    }).catch(() => {
    }), () => {
      C = !0;
    };
  }, [a, m, u, l]);
  const O = k.phase === "running" && k.seenActive;
  D(() => {
    if (k.phase === "running") {
      if (!l) {
        O || R({ phase: "running", seenActive: !0 });
        return;
      }
      O && R(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [k.phase, O, l, t]);
  const B = K(() => {
    const C = new Map(h);
    if (S.renderedAt === u)
      for (const [W, H] of S.edits) C.set(W, H);
    return C;
  }, [h, S, u]), M = N((C) => {
    const W = `${C || ""}`.trim();
    W && g({ itemId: W, page: su(W) });
  }, []), I = N(() => g(null), []), E = N((C, W) => {
    w((H) => {
      const J = new Map(H.renderedAt === u ? H.edits : []);
      return J.set(C, W), { renderedAt: u, edits: J };
    }), v((H) => new Map(H).set(C, (H.get(C) || 0) + 1));
  }, [u]), T = N(async () => {
    if (!(!a || !s || k.phase === "submitting" || k.phase === "running")) {
      R({ phase: "submitting" });
      try {
        await a.rerender(s), R({ phase: "running", seenActive: !1 }), await o();
      } catch (C) {
        R({ phase: "failed", message: (C == null ? void 0 : C.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, k.phase, o]), x = c ? Hp : !l || k.phase === "running" || k.phase === "submitting" ? jp : "";
  return K(() => ({
    available: i,
    blockedReason: x,
    port: a,
    ownerJobId: m,
    target: f,
    select: M,
    close: I,
    memory: L,
    pendingEdits: B,
    savedCounts: b,
    markSaved: E,
    rerender: k,
    startRerender: T
  }), [i, x, a, m, f, M, I, L, B, b, E, k, T]);
}
function Wp(e, t) {
  D(() => {
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
function Kp(e, t, n) {
  const { session: r, sessionFiles: o } = e, a = Up({
    jobId: r.jobId,
    jobStatus: r.jobStatus,
    jobPayload: r.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!o.translatedUrl,
    refreshJobStatus: r.refreshJobStatus
  }), s = a.select, i = e.setModeKeepingPage, c = r.regions, l = a.memory.drafts, u = N((d, f) => {
    va(c, d) && (t === "source" && i("compare"), f != null && f.trim() && l.set(d, f), s(d));
  }, [c, s, t, i, l]);
  Wp(a.available ? u : null, n);
  const m = K(() => {
    if (!a.savedCounts.size) return e.revisedBlocks;
    const d = new Map(e.revisedBlocks);
    for (const [f, g] of a.savedCounts) d.set(f, (d.get(f) || 0) + g);
    return d;
  }, [e.revisedBlocks, a.savedCounts]);
  return { blockEdit: a, editBlock: u, revisedBlocks: m };
}
const Vp = "reader-finder-input";
function qp(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function Jp(e, t = typeof window > "u" ? null : window) {
  D(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!qp(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(Vp) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function Gp(e) {
  const [t, n] = P(null), r = N((f) => n((g) => g === f ? null : f), []), [o, a] = P(""), [s, i] = P("");
  D(() => {
    const f = o.replace(/\s+/gu, " ").trim(), g = window.setTimeout(() => i(f), f ? 150 : 0);
    return () => window.clearTimeout(g);
  }, [o]);
  const [c, l] = P(0), u = N(() => {
    n("search"), l((f) => f + 1);
  }, []);
  Jp(u);
  const m = N((f) => {
    e.jumpToAnchor({ block_id: f }), (t === "outline" || st() < 900) && n(null);
  }, [e.jumpToAnchor, t]), d = N((f) => {
    e.goToPage(f), (t === "outline" || st() < 900) && n(null);
  }, [e.goToPage, t]);
  return { finder: t, setFinder: n, toggleFinder: r, findQuery: o, setFindQuery: a, findTerm: s, findFocus: c, jumpFromFinder: m, jumpToPageFromFinder: d };
}
function Xp(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : ra(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Yp(e, t) {
  return t === null || e !== t;
}
function Zp(e, t) {
  const { boot: n } = e, r = _(null), o = _(null);
  D(() => {
    if (!(n.loading || n.failed)) {
      if (r.current !== e.viewStateKey) {
        r.current = e.viewStateKey;
        const a = Ve(e.viewStateKey), s = Xp({
          savedMode: a == null ? void 0 : a.mode,
          sourceViewOnly: t,
          viewportWidth: st()
        });
        o.current = s.auto ? s.mode : null, s.mode && s.mode !== e.mode && e.setModeKeepingPage(s.mode);
        return;
      }
      Yp(e.mode, o.current) && (o.current = null, gn(e.viewStateKey, { mode: e.mode }));
    }
  }, [n.failed, n.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, t]);
}
const Qp = [];
function eg(e) {
  const { sessionFiles: t } = e, [n, r] = P({}), o = _({ source: t.sourceUrl, translated: t.translatedUrl });
  o.current = { source: t.sourceUrl, translated: t.translatedUrl };
  const a = N((y, S) => {
    r((w) => ({ ...w, [S]: { url: o.current[S], nodes: y } }));
  }, []), s = K(() => {
    const y = n.source;
    if (y && y.url === t.sourceUrl && y.nodes.length) return y.nodes;
    const S = n.translated;
    return S && S.url === t.translatedUrl && S.nodes.length ? S.nodes : Qp;
  }, [n, t.sourceUrl, t.translatedUrl]), i = _({}), [c, l] = P(0), u = N((y, S) => {
    i.current[S] = { url: o.current[S], pdf: y }, l((w) => w + 1);
  }, []), [m, d] = P(null), f = N((y) => d(y), []), g = N(() => d(null), []);
  D(() => d(null), [e.viewStateKey]);
  const h = K(() => {
    const y = (S, w) => {
      const b = i.current[S];
      return b && b.url === w ? b.pdf : null;
    };
    return { source: y("source", t.sourceUrl), translated: y("translated", t.translatedUrl) };
  }, [c, t.sourceUrl, t.translatedUrl]);
  return { bookmarks: s, onPdfOutline: a, onPdfDocument: u, zoomItem: m, setZoomItem: d, zoomBlock: f, closeZoom: g, zoomDocuments: h };
}
function tg() {
  const e = El(), { boot: t, panes: n, session: r } = e, o = up(e.viewStateKey), a = o.panel, s = o.setPanel, i = a !== null, c = Op(), { reserveRight: l } = c, u = i || l > 0, m = N(() => {
    s(null);
  }, []);
  zp(l, a, m);
  const { liveTranslationVisible: d, setLiveTranslationVisible: f, paneComposition: g, liveToggles: h, sourceViewOnly: y, visiblePdfMode: S } = Dp(
    e,
    i,
    Lp(e.shell.shellWidth, u)
  );
  Zp(e, y);
  const w = a || (e.mode === "compare" ? "compare" : "reading"), { docDark: b, toggleDocDark: v } = Mp();
  xl({
    toggleDocDark: v,
    mode: S,
    sourceOnly: e.sourceOnly,
    setMode: e.setModeKeepingPage,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    currentPage: e.currentPage,
    numPages: n.hudNumPages,
    goToPage: e.goToPage,
    enabled: e.showHud
  });
  const { latestLivePage: k, jumpToLatestLivePage: R, offerCompletion: L, setCompletionDismissedKey: O, sourcePaneAction: B } = $p(e, {
    liveTranslationVisible: d,
    setLiveTranslationVisible: f,
    liveToggles: h,
    sourceViewOnly: y,
    visiblePdfMode: S
  }), M = N(($) => {
    const V = Cp($, e.liveTranslationAvailable);
    V !== null && f(V), e.setModeKeepingPage($);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), I = N(($) => {
    s($);
  }, []), [E] = P(hp), T = Gp(e), { finder: x, toggleFinder: C, findTerm: W } = T, H = N(($) => e.jumpToAnchor({ block_id: $ }), [e.jumpToAnchor]), J = N(($, V) => e.jumpToAnchor({ block_id: $ }, V), [e.jumpToAnchor]), { bookmarks: ue, onPdfOutline: Y, onPdfDocument: ae, zoomItem: Se, setZoomItem: te, zoomBlock: de, closeZoom: Pe, zoomDocuments: ie } = eg(e), { blockEdit: ne, editBlock: z, revisedBlocks: U } = Kp(e, S, E), [q, fe] = P(null), se = N(() => fe(null), []), me = Hf({ documentId: r.documentId, jobId: r.jobId }), {
    readerApi: ke,
    contributionStore: ce,
    contributions: X,
    pageLayers: pe,
    compareVersion: F,
    textMarks: Z,
    menuSections: he,
    pointerTakenId: Me
  } = Fp(e, c, {
    translationVersions: me,
    bookmarks: ue,
    regionHover: E,
    assistantPanel: a,
    closeAssistant: m,
    visiblePdfMode: S,
    changeWorkspace: M,
    jumpToBlockIn: J,
    zoomDocuments: ie,
    editBlock: ne.available && !ne.blockedReason ? z : null
  }), _e = !!Me, [xe, Ae] = P([]), $e = K(() => ({
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
    regionHover: E,
    jumpToBlock: H,
    revisedBlocks: U,
    onPdfOutline: Y,
    onPdfDocument: ae,
    zoomBlock: de,
    textMarks: Z,
    pageLayers: pe,
    editBlock: ne.available ? z : void 0,
    blockEdit: ne,
    editShowsSource: S !== "compare",
    findTerm: x === "search" ? W : "",
    compareVersion: F,
    pointerTaken: _e,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: y,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: I, close: m },
    docDark: b,
    toggleDocDark: v
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
    E,
    H,
    U,
    Y,
    ae,
    de,
    Z,
    pe,
    ne,
    z,
    S,
    x,
    W,
    F,
    _e,
    e.sourceOnly,
    y,
    e.download,
    e.goToPage,
    I,
    m,
    b,
    v
  ]), je = K(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), Ue = [
    tc,
    `is-workspace-${w}`,
    i ? "is-assistant-open" : "",
    x ? "is-finder-open" : "",
    g.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(Qd, { api: ke, store: ce, children: /* @__PURE__ */ p(ad, { value: $e, hud: je, children: /* @__PURE__ */ A(
    "div",
    {
      className: Ue,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": w,
      "data-pointer-taken": Me || void 0,
      "data-right-inset": l ? "true" : void 0,
      style: l ? { "--reader-right-inset": `${l}px` } : void 0,
      onContextMenu: ($) => {
        const V = Ip($);
        if (!V) return;
        const re = Kd(X, { target: $.target, clientX: $.clientX, clientY: $.clientY, page: V.page });
        !re.length && !he.length || ($.preventDefault(), Ae(re), fe(V));
      },
      children: [
        /* @__PURE__ */ p(Lh, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!r.readerErrors.regions, metadataError: !!r.readerErrors.metadata, onRetry: r.refreshJobArtifacts }),
        /* @__PURE__ */ p(_p, { state: T, bookmarks: ue }),
        /* @__PURE__ */ A("div", { className: "reader-chrome-tray", children: [
          /* @__PURE__ */ p(Hh, {}),
          /* @__PURE__ */ p(zl, { onBeforeClose: r.prepareClose })
        ] }),
        /* @__PURE__ */ p(
          Ud,
          {
            mode: S,
            documentReady: !!r.jobId,
            sourceViewOnly: y,
            onModeChange: M,
            liveTranslation: h.topBarPill ? {
              visible: d,
              state: e.liveTranslation,
              onToggle: () => f(($) => !$),
              latestPage: d ? k : null,
              currentPage: e.currentPage,
              onJumpToLatest: R
            } : null,
            completion: L ? {
              onOpenCompare: () => {
                O(e.viewStateKey), M("compare");
              }
            } : null
          }
        ),
        /* @__PURE__ */ p(Km, { active: a }),
        i ? /* @__PURE__ */ p(xh, {}) : null,
        /* @__PURE__ */ A("div", { className: "reader-stage", children: [
          /* @__PURE__ */ p(Fd, { paneComposition: g, markdownSplit: i, assistantSplit: u, liveTranslation: e.liveTranslation, sourcePaneAction: B }),
          e.showHud ? /* @__PURE__ */ p(
            cp,
            {
              mode: S,
              modeControls: null,
              bookmarkScope: e.viewStateKey,
              issuesJobId: e.sourceOnly ? "" : r.jobId,
              searchSlot: /* @__PURE__ */ p(vp, { open: x, onToggle: C })
            }
          ) : null,
          /* @__PURE__ */ p(Sp, { active: a })
        ] }),
        /* @__PURE__ */ p(
          Np,
          {
            session: r,
            zoomDocuments: ie,
            zoomItem: Se,
            setZoomItem: te,
            closeZoom: Pe,
            visiblePdfMode: S
          }
        ),
        /* @__PURE__ */ p(Ep, { menu: q, onClose: se, actions: xe, sections: he }),
        /* @__PURE__ */ p(rf, { extensions: ir }),
        /* @__PURE__ */ p(Tp, { edit: ne }),
        /* @__PURE__ */ p(mp, {})
      ]
    }
  ) }) });
}
function Eg() {
  return /* @__PURE__ */ p(tg, {});
}
export {
  Eg as R,
  tg as a,
  Sg as b,
  kg as c,
  vf as d,
  Sf as e,
  vg as f,
  wg as g,
  bg as h,
  yg as r,
  Ig as s,
  tt as u
};
//# sourceMappingURL=ReaderApp-BPgzkOcT.js.map
