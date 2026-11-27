var ls = Object.defineProperty;
var Ir = (e) => {
  throw TypeError(e);
};
var us = (e, t, n) => t in e ? ls(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var Er = (e, t, n) => us(e, typeof t != "symbol" ? t + "" : t, n), Tr = (e, t, n) => t.has(e) || Ir("Cannot " + n);
var _t = (e, t, n) => (Tr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Rr = (e, t, n) => t.has(e) ? Ir("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Pr = (e, t, n, r) => (Tr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as x, jsx as p, Fragment as xe } from "react/jsx-runtime";
import { useMemo as V, useState as P, useEffect as D, useCallback as N, useRef as M, useLayoutEffect as Ne, memo as Vt, createContext as qt, useContext as st, Fragment as Xn, forwardRef as Oo, useImperativeHandle as Yn, useSyncExternalStore as hn, Component as ds, Suspense as zo, lazy as Fo, useId as Bo } from "react";
import { requireAdapter as Mt, getReaderAdapters as De } from "./adapters.js";
import { resolveReaderDownloadName as fs, resolveReaderDownloadUrls as ms, READER_PROGRESS_COPY as He, trimString as an, READER_DOWNLOAD_ACTIONS as hs, disabledReason as ps } from "./runtime/state.js";
import { r as gs, b as bs } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as An, isFinishedJobStatus as Bt } from "@retainpdf/domain/job";
import { n as jo, d as ys, f as vn, k as Mr, b as vs, c as ws, j as $e, p as dt, g as Ss, l as Tt, i as ks } from "./reader-regions-BmqHsJ-I.js";
import { fetchDocumentReading as Is } from "@retainpdf/api/documents";
import { isReaderTransportError as Es, createReaderTransportError as Ts } from "./contracts.js";
import { toast as xn, Toaster as Rs } from "sonner";
import { X as ft, PenLine as Zn, ZoomIn as Ps, Check as Ho, Copy as Ms, ChevronUp as _s, ChevronDown as Uo, History as Ns, LoaderCircle as As, Pin as xs, LogOut as Ls, FileText as Wo, Columns2 as Ko, Languages as Vo, Radio as Cs, ArrowDownToLine as Ds, CheckCircle2 as $s, ImagePlus as Os, MessageCircleQuestion as zs, GitCompareArrows as Fs, Highlighter as Bs, Eraser as js, Undo2 as Hs, Trash2 as Us, ChevronLeft as Ws, ChevronRight as qo, Minus as Ks, Plus as Vs, ArrowLeft as qs, Keyboard as Js, Download as Gs, ListOrdered as Xs, TriangleAlert as Ys, Search as Zs, ListTree as Qs, LayoutGrid as ei } from "lucide-react";
import { Button as re, Textarea as ti, IconButton as at, Input as Jo } from "@retainpdf/ui";
import { pdfjs as Go, Page as ni, Document as ri } from "react-pdf";
import { e as oi, m as ai, a as si } from "./markdown-math-XkF5urpn.js";
const ii = (...e) => {
  var t, n;
  return ((n = (t = De()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, ci = "", li = Object.freeze({
  progress: "retainpdf-reader-progress"
}), ui = (e) => {
  var t, n;
  return ((n = (t = De()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, fg = (...e) => {
  var n;
  return (((n = De()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, mg = () => {
  var e, t;
  return ((t = (e = De()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
}, Ue = () => Mt("defaultReaderDataPort"), _r = () => Mt("defaultReaderPageConfigPort"), hg = {
  get apiPrefix() {
    return Ue().apiPrefix;
  },
  fetchProtected: (...e) => Ue().fetchProtected(...e),
  loadMarkdownPayload: (e) => Ue().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => Ue().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => Ue().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => Ue().loadJobPayload(e),
  loadReaderPayload: (e, t) => Ue().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => Ue().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return Ue().liveTranslation;
  }
}, Xo = {
  messageTargetOrigin: () => _r().messageTargetOrigin(),
  readerJobId: () => _r().readerJobId()
}, di = () => {
  var e;
  return ((e = De()) == null ? void 0 : e.liveTranslation) ?? null;
}, jt = () => {
  var t;
  const e = De();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, Je = () => {
  const e = De();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => Mt("fetchDocumentByJobId")(...n),
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
}, fi = (...e) => {
  var t, n;
  return ((n = (t = De()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, mi = () => {
  var e, t;
  return ((t = (e = De()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, hi = (...e) => {
  var t, n;
  return ((n = (t = De()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, pi = (...e) => {
  var t, n;
  return ((n = (t = De()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? fs(...e);
}, gi = (...e) => {
  var t, n;
  return ((n = (t = De()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? ms(...e);
}, bi = (...e) => Mt("downloadProtectedResource")(...e), yi = (...e) => Mt("failDownloadToast")(...e), pg = (e, t) => Mt("resolveMarkdownAssetUrl")(e, t), Nr = "/api/v1";
function vi() {
  const e = () => {
    var r;
    return gs(
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
function wi() {
  const e = vi(), t = V(() => hi(Xo), [e]), n = V(() => mi(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function Si(e) {
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
  }), w = h.jobId === g ? h.documentId : "", S = t || w, b = !!t && !g, [v, k] = P(null), T = (v == null ? void 0 : v.sessionIdentity) === r && v.documentId === S ? v : null, A = b || !!T, O = N((_) => {
    const I = `${_.documentId || ""}`.trim();
    if (!I || a.current && a.current !== I) return;
    if (!a.current && s.current)
      y({
        jobId: s.current,
        documentId: I
      });
    else if (!a.current)
      return;
    const E = `${_.revision || ""}`.trim() || `${Date.now()}`;
    k({
      documentId: I,
      revision: E,
      sessionIdentity: o.current
    }), i();
  }, []);
  D(() => {
    k((_) => _ && _.sessionIdentity !== r ? null : _);
  }, [r]);
  const z = N((_) => {
    switch (_.type) {
      case "resolved-document-job":
        l({ documentId: _.documentId, jobId: _.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        m({ documentId: _.documentId, jobId: _.jobId });
        break;
      case "resolved-job-document":
        y((I) => I.jobId === _.jobId && I.documentId === _.documentId ? I : { jobId: _.jobId, documentId: _.documentId });
        break;
      case "committed-source":
        k({
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
    setMissingDocumentJob: m,
    documentJobId: d,
    rejectedDocumentJobId: f,
    sessionJobId: g,
    resolvedJobDocument: h,
    setResolvedJobDocument: y,
    jobDocumentId: w,
    documentId: S,
    sourceOnly: b,
    committedDocumentSource: v,
    setCommittedDocumentSource: k,
    activeCommittedDocumentSource: T,
    sourceViewOnly: A,
    refreshCommittedDocument: O,
    applyIdentityEvent: z
  };
}
function Ar(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function ki(e) {
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
function xr(e, t) {
  return ui(An(e, t));
}
function Ii(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function Ei(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !Ii(a, t))
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
        type: li.progress,
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
function Ti(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = P(null), [l, u] = P(null), [m, d] = P(""), [f, g] = P(0), h = m === n ? i : null, y = m === n ? l : null, w = Ar(h), S = Bt(w), b = N(() => {
    g((z) => z + 1);
  }, []), v = N((z) => {
    c(z.jobPayload), u(z.manifestPayload), d(z.sessionIdentity);
  }, []), k = N((z) => {
    c(null), u(null), d(z);
  }, []), T = M(""), A = M(""), O = N(async () => {
    const z = o.current;
    if (!z || T.current === z) return;
    const _ = Je().loadJobPayload;
    if (typeof _ != "function") return;
    const I = a.current.value;
    T.current = z;
    try {
      const E = await _(z);
      if (s.current || a.current.value !== I || o.current !== z || !E || typeof E != "object")
        return;
      const R = Ar(E);
      c(E), d(r.current), !Bt(R) && A.current === z && (A.current = ""), R === "succeeded" && A.current !== z && (A.current = z, g((L) => L + 1));
    } catch {
    } finally {
      T.current === z && (T.current = "");
    }
  }, []);
  return D(() => {
    A.current = "";
  }, [n]), D(() => {
    if (!t || S || !h) return;
    const z = window.setInterval(() => {
      document.visibilityState !== "hidden" && O();
    }, 1e3);
    return () => window.clearInterval(z);
  }, [S, O, h, t]), {
    jobPayload: i,
    setJobPayload: c,
    manifestPayload: l,
    setManifestPayload: u,
    payloadSessionIdentity: m,
    setPayloadSessionIdentity: d,
    scopedJobPayload: h,
    scopedManifestPayload: y,
    jobStatus: w,
    jobTerminal: S,
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
function Ri(e, t) {
  e(t), Cn(t);
}
function Pi(e) {
  const [t, n] = P(e ? "source" : "compare"), r = N((a) => {
    e && a !== "source" || (n(a), Cn(a));
  }, [e]), o = N((a) => {
    Ri(n, a);
  }, []);
  return D(() => (e && document.documentElement.classList.add("reader-source-only"), Cn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Lr(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function Mi(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Lr(n.active_job_id),
    activeVersionId: Lr(n.active_version_id)
  };
}
function _i(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Ni(e) {
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
const xi = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Li(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = xi.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const Ci = 48 * 1024 * 1024;
function Di(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const $i = 2, Ce = /* @__PURE__ */ new Map();
function Dn(e, t) {
  Ce.delete(e), Ce.set(e, t);
}
function Cr(e) {
  if (Ce.size < $i) return;
  const t = Ce.keys().next().value;
  t && Ce.delete(t);
}
async function Oi(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function Yo(e, t = jt().fetchProtected, n = {}) {
  var u, m, d, f, g, h, y, w, S;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (Ce.has(r)) {
    const b = Ce.get(r);
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
    const v = await Oi(s);
    throw v && (b.reason = v), b;
  }
  const i = zi(r, s, t);
  if (i) {
    o.abort();
    const b = { ranged: i };
    return Cr(), Ce.set(r, b), b;
  }
  (y = (h = n.signal) == null ? void 0 : h.addEventListener) == null || y.call(h, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (S = (w = n.signal) == null ? void 0 : w.removeEventListener) == null || S.call(w, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return Ce.has(r) ? Dn(r, l) : (Cr(), Ce.set(r, l)), l;
}
function zi(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < Ci ? null : {
    url: e,
    length: o,
    async fetchRange(i, c) {
      const l = await n(e, { headers: { Range: `bytes=${i}-${c - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const Fi = { file: null, loading: !1, error: "" }, Bi = { file: null, loading: !0, error: "" };
function ji(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = P(null);
  if (D(() => {
    if (t || !n) return;
    const s = Ce.get(n);
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
  if (!n) return Fi;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = Ce.get(n);
  return a ? { file: a, loading: !1, error: "" } : Bi;
}
function Hi(e) {
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
  const i = await Yo(t, jt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (sn(s, o, n, "download"), i);
}
async function Ui(e) {
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
function Wi(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Ki({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = Is,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(Wi(o.href, t, a)), !0);
}
const Zt = {
  regions: null,
  metadata: null
};
function Vi(e) {
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
    activeLoadAbortRef: w
  } = e, [S, b] = P(""), [v, k] = P(""), [T, A] = P(null), [O, z] = P(null), [_, I] = P(!1), [E, R] = P(""), [L, C] = P([]), [W, H] = P(!1), [Y, oe] = P(() => ({
    source: null,
    translated: null
  })), [Q, ae] = P(
    Zt
  ), [j, U] = P({
    loading: !0,
    percent: 4,
    text: He.boot,
    stage: "progress",
    failed: !1
  });
  return D(() => {
    const K = new AbortController(), he = h.current.value, J = Hi({
      sessionEpochRef: h,
      closingRef: y,
      abort: K,
      sessionEpoch: he
    });
    w.current = K;
    const G = Je();
    if (y.current)
      return K.abort(), () => {
        w.current === K && (w.current = null);
      };
    let pe = !1;
    function ce(ie, le) {
      J.markFailed(), H(!0), U({
        loading: !1,
        percent: 100,
        text: ie,
        stage: "failed",
        failed: !0
      }), Ln({ percent: 100, text: le, stage: "failed" });
    }
    function fe() {
      I(!0), pe || H(!0), U({
        loading: !1,
        percent: 100,
        text: He.ready,
        stage: "ready",
        failed: !1
      }), Ln({ percent: 100, text: He.ready, stage: "ready" });
    }
    function ve() {
      return l != null && l.documentId ? xr(
        l.documentId,
        l.revision
      ) : ii() ? ci : G.resolveResourceUrl(An(r));
    }
    async function ye() {
      var Z;
      let ie = { activeJobId: "", activeVersionId: "" };
      try {
        const $ = await ((Z = G.fetchDocument) == null ? void 0 : Z.call(G, r));
        $ && (ie = Mi($));
      } catch {
      }
      const le = _i({
        link: ie,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (le.kind === "follow-active-job") {
        if (J.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: le.jobId
        }), le.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: le.activeVersionId,
          sessionIdentity: c
        }), f("source")) : f("compare");
        return;
      }
      if (le.kind === "open-committed-source") {
        if (J.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: le.revision,
          sessionIdentity: c
        }), f("source");
        return;
      }
      const we = ve();
      if (J.isInactive()) return;
      b(we), k(""), R(""), d(c);
      const F = await $n({
        url: we,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: J,
        setBoot: U
      });
      if (!J.isInactive()) {
        if (!F) {
          ce("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        A(F), fe();
      }
    }
    async function ze() {
      var Yt;
      const ie = !l, le = !!(ie && G.loadSessionSnapshot && G.loadReaderOptionalArtifacts), we = le ? G.loadReaderOptionalArtifacts(t) : null, F = await ((Yt = G.loadSessionSnapshot) == null ? void 0 : Yt.call(G, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: ie && !le
      })), Z = F ? {
        jobPayload: F.sourcePayload,
        manifestPayload: F.manifestPayload,
        readerMetadata: F.readerMetadata,
        regionsPayload: F.regions,
        readerErrors: F.readerErrors
      } : await G.loadReaderPayload(t, {
        includeOptionalArtifacts: ie
      });
      if (J.isInactive()) return;
      let $ = null;
      if (n && !r)
        if (F && F.linkedDocument !== void 0)
          $ = F.linkedDocument;
        else {
          try {
            $ = await G.fetchDocumentByJobId(Nr, t);
          } catch {
          }
          if (J.isInactive()) return;
        }
      const q = ki(Z.jobPayload) || `${($ == null ? void 0 : $.document_id) || ""}`.trim();
      q && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: q
      });
      const ee = Ni({
        payloadDocumentId: q,
        linkedActiveJobId: `${($ == null ? void 0 : $.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${($ == null ? void 0 : $.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (ee.kind === "restore-committed-source") {
        if (J.isInactive()) return;
        u({
          type: "committed-source",
          documentId: ee.documentId,
          revision: ee.revision,
          sessionIdentity: c
        }), f("source");
        return;
      }
      const ue = G.resolveReaderSourcePdf(Z.manifestPayload), ke = G.resolveReaderTranslatedPdfUrl(Z.jobPayload, Z.manifestPayload), Ee = typeof ue == "string" ? ue : G.resolveReaderArtifactUrl(ue), de = r || q, _e = l != null && l.documentId ? xr(
        l.documentId,
        l.revision
      ) : Ee || (de ? G.resolveResourceUrl(An(de)) : ""), Le = l ? "" : ke || "";
      b(_e || ""), k(Le), R(Ei(Z.jobPayload, t)), m({
        jobPayload: Z.jobPayload || null,
        manifestPayload: Z.manifestPayload || null,
        sessionIdentity: c
      });
      const rt = () => Ui({
        sourceFinal: _e || "",
        translatedFinal: Le,
        fence: J,
        setBoot: U
      }), pt = !!(_e || Le), gt = we && pt ? rt() : null;
      gt == null || gt.catch(() => {
      });
      const Xt = (B) => {
        J.isInactive() || (C(l ? [] : jo(B.regionsPayload)), oe(l ? { source: null, translated: null } : ys(B.readerMetadata)), ae(l ? Zt : B.readerErrors ?? Zt), H(!0));
      };
      if (we ? (pe = !0, we.then(Xt)) : Xt(Z), !pt) {
        ce(He.failed, He.failed);
        return;
      }
      const bt = await (gt ?? rt());
      if (bt.status !== "inactive") {
        if (bt.status === "incomplete") {
          ce("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        A(bt.sourceBytes), z(bt.translatedBytes), fe();
      }
    }
    async function Ae() {
      I(!1), A(null), z(null), C([]), H(!1), oe({ source: null, translated: null }), ae(Zt), sn(U, 8, He.metadata, "metadata");
      try {
        if (s) {
          await ye();
          return;
        }
        if (!t) {
          ce(He.failed, He.failed);
          return;
        }
        await ze();
      } catch (ie) {
        if (J.isClosedOrStale() || (ie == null ? void 0 : ie.name) === "AbortError") return;
        J.markFailed();
        const le = Number(ie == null ? void 0 : ie.status), we = `${(ie == null ? void 0 : ie.reason) || ""}`, F = Li({ status: le, reason: we, sessionJobId: t });
        if (F && (await Ki({
          apiPrefix: Nr,
          documentId: F,
          expiredJobId: t
        }) || J.isClosedOrStale()))
          return;
        if (Ai({
          status: le,
          reason: we,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), f("source");
          return;
        }
        const Z = ie instanceof Error ? ie.message : He.failed;
        ce(Z, Z);
      }
    }
    return Ae(), () => {
      K.abort(), w.current === K && (w.current = null);
    };
  }, [t, r, o, a, s, i, l, g, n, c, u, m, d, f]), {
    sourceUrl: S,
    translatedUrl: v,
    sourceFile: T,
    translatedFile: O,
    assetsReady: _,
    title: E,
    regions: L,
    regionsSettled: W,
    readerMetadata: Y,
    readerErrors: Q,
    boot: j
  };
}
function qi() {
  const e = M(!1), t = M(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = wi(), s = M({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = M(a), c = M(""), l = M(""), u = M(() => {
  }), m = N(() => u.current(), []), d = Si({
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
  } = d, { mode: w, setMode: S, switchSessionMode: b } = Pi(y);
  u.current = () => {
    b("source");
  }, i.current = a, c.current = g, l.current = f;
  const v = Ti({
    sessionJobId: f,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: k,
    scopedManifestPayload: T,
    jobStatus: A,
    jobTerminal: O,
    jobRefreshRevision: z,
    refreshJobArtifacts: _,
    refreshJobStatus: I
  } = v, E = Vi({
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
    jobRefreshRevision: z,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), R = N(() => {
    var C;
    e.current = !0, (C = t.current) == null || C.abort();
  }, []), L = V(
    () => ({
      fetchProtected: Je().fetchProtected,
      jobId: f,
      jobPayload: k,
      manifestPayload: T,
      sourceUrl: E.sourceUrl,
      translatedUrl: E.translatedUrl,
      sourceOnly: y
    }),
    [f, k, T, E.sourceUrl, E.translatedUrl, y]
  );
  return {
    jobId: f,
    jobStatus: A,
    workflow: `${(k == null ? void 0 : k.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: O,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: h,
    mode: w,
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
    download: L,
    refreshJobArtifacts: _,
    refreshJobStatus: I,
    refreshCommittedDocument: d.refreshCommittedDocument,
    prepareClose: R
  };
}
const Ji = 160, Gi = 8, Xi = 0;
function Yi() {
  const e = M(null), [t, n] = P(null), [r, o] = P(Xi), a = N((s) => {
    e.current = s, n(s);
  }, []);
  return D(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (l) => {
      !Number.isFinite(l) || l < Ji || o((u) => Math.abs(u - l) < Gi ? u : l);
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
function Zi(e) {
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
function Qi(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    sourceUrl: a,
    translatedUrl: s,
    sourceFile: i,
    translatedFile: c
  } = e, l = `${(t == null ? void 0 : t.identityKey) || ""}\0${a}\0${s}`, u = M(l);
  u.current = l;
  const [m, d] = P(() => ({
    identity: l,
    pages: wn
  })), [f, g] = P(() => ({ identity: l, tick: 0 })), h = m.identity === l ? m.pages : wn, y = f.identity === l ? f.tick : 0, w = Zi({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: S } = w, b = N((I, E) => {
    u.current === l && d((R) => {
      const L = R.identity === l ? R.pages : wn;
      return L[E] === I && R.identity === l ? R : {
        identity: l,
        pages: { ...L, [E]: I }
      };
    });
  }, [l]), v = M(null), k = N(() => {
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
  const T = V(
    () => Math.max(h.source, h.translated),
    [h]
  ), A = S === "translated" ? h.translated : h.source || h.translated, O = t == null ? void 0 : t.userZoom, z = t == null ? void 0 : t.shellWidth, _ = `${l}-${y}-${O}-${n}-${h.source}-${h.translated}-${z}`;
  return {
    ...w,
    numPagesByPane: h,
    hudNumPages: T,
    primaryNumPages: A,
    metricsTick: y,
    onNumPages: b,
    onMetrics: k,
    rowSyncRevision: _
  };
}
const Te = "data-reader-page", Ie = "data-reader-pane", Qn = "data-natural-height", ec = "reader-react-root", Zo = "reader-react-grid", Qo = "reader-react-scroll-shell", pn = "reader-react-pdf-pane", ea = "reader-react-pdf-page", cn = "reader-react-pdf-page-placeholder", er = "reader-react-pdf-page-slot";
function ln(e, t) {
  const n = e != null ? `[${Te}="${e}"]` : `[${Te}]`;
  return t ? `${n}[${Ie}="${t}"]` : n;
}
function tr() {
  return `.${er}[${Te}]`;
}
function un(e) {
  return Number(e.getAttribute(Te));
}
const ta = 0.25, dn = 1, tc = 0.05, Jt = 0.5, nc = 16, rc = 8, na = nc + rc, oc = 720;
function et() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function ra(e) {
  return Number.isFinite(e) && e < oc;
}
function St(e, t = Number.POSITIVE_INFINITY) {
  return ra(t) && (e === "source" || e === "translated") ? dn : Jt;
}
function Ve(e) {
  return Number.isFinite(e) ? Math.min(dn, Math.max(ta, e)) : Jt;
}
function Ht(e, t) {
  const n = Ve(Number(e) + t * tc);
  return Math.round(n * 100) / 100;
}
function ac(e) {
  return Math.round(Ve(e) * 100);
}
function oa(e) {
  const n = (Number(e) || 0) - na;
  return Math.max(160, Math.floor(n));
}
function sc(e, t = Jt) {
  const n = Ve(t);
  return oa((Number(e) || 0) * n);
}
function ic(e, t) {
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
const cc = 8;
function lc(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < cc ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const aa = 200, uc = [
  "markdown"
], dc = uc;
function sa(e) {
  return dc.includes(e);
}
const fc = "retainpdf:reader:view:v1:", Dr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), mc = /* @__PURE__ */ new Set([
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
function hc({
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
  return t ? `${fc}${t}` : "";
}
function pc(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function gc(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!Dr.has(t) || !Dr.has(n) || t === n))
    return { left: t, right: n };
}
function bc(e) {
  return e === null ? null : sa(e) ? e : void 0;
}
function yc(e) {
  return mc.has(e) ? e : void 0;
}
function la(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = pc(t.anchor), r = Number(t.zoom), o = yc(t.mode), a = gc(t.splitLayout), s = bc(t.assistantPanel);
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
function je(e, t = ia()) {
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
  const o = je(e, n), a = la({
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
function vc(e, t, n = "") {
  var d;
  const [r, o] = P(() => {
    var f;
    return ((f = je(n)) == null ? void 0 : f.zoom) ?? St(e, et());
  }), a = M(r), s = M(n);
  a.current = r;
  const i = M(1), c = M(((d = je(n)) == null ? void 0 : d.zoom) !== void 0);
  D(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const f = (h = je(n)) == null ? void 0 : h.zoom;
    c.current = f !== void 0;
    const g = f ?? St(e, et());
    i.current = 1, a.current = g, o(g);
  }, [e, n]), D(() => {
    if (c.current) return;
    const f = St(e, et()), g = a.current;
    Math.abs(f - g) < 5e-4 || (i.current = 1, a.current = f, o(f));
  }, [e]);
  const l = N((f, g) => {
    const h = Ve(f), y = a.current;
    Math.abs(h - y) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : h / (y || 1), a.current = h, c.current = !0, gn(s.current, { zoom: h }), o(h));
  }, []), u = N((f) => {
    l(Ht(a.current, f));
  }, [l]), m = N((f) => {
    l(St(f));
  }, [l]);
  return Ne(() => {
    const f = i.current;
    Math.abs(f - 1) < 1e-3 || (i.current = 1, ic(t == null ? void 0 : t.current, f));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: m };
}
const wc = 160, Sc = 3e-3, $r = 50, kc = 16, Ic = 800;
function Ec(e, t = 0) {
  const n = t === 1 ? kc : t === 2 ? Ic : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-$r, Math.min($r, r));
  return Math.exp(-o * Sc);
}
function Tc(e, t, n = 0) {
  return Ve(e * Ec(t, n));
}
function Rc(e) {
  return Math.round(Ve(e) * 100) / 100;
}
function Pc(e, t, n) {
  const r = Ve(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return Ve(t) / r;
  const a = (o + na) / r;
  return oa(a * Ve(t)) / o;
}
function Mc(e) {
  return Array.from(e.querySelectorAll(tr()));
}
function _c(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function Nc(e, t, n) {
  let r = null;
  for (const s of Mc(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const c = _c(i, t, n);
    if ((!r || c < r.distance) && (r = { el: s, rect: i, distance: c }), c === 0) break;
  }
  if (!r) return null;
  const { el: o, rect: a } = r;
  return {
    page: o.getAttribute(Te) || "",
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
    `${tr()}[${Te}="${t.page}"][${Ie}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (Ac(n, e).scrollLeft += a);
}
function xc(e, t, n, r) {
  const o = e.querySelector(`.${Zo}`);
  if (!o) return null;
  if (!o.style.transformOrigin) {
    const a = o.getBoundingClientRect();
    o.style.transformOrigin = `${n - a.left}px ${r - a.top}px`, o.style.willChange = "transform";
  }
  return o.style.transform = `scale(${t})`, o;
}
function Nt(e) {
  e && (e.style.transform = "", e.style.transformOrigin = "", e.style.willChange = "");
}
const Lc = 600, Cc = 1e3;
function Dc(e, t) {
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
  const c = r.setTimeout(() => l(), Cc);
  function l() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(c);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return l;
}
function $c(e, t, n) {
  const r = M(t);
  r.current = t;
  const o = M(n);
  o.current = n;
  const a = M(null), s = M(null), i = M(null);
  D(() => {
    if (!e) return;
    const c = () => {
      const u = a.current;
      if (a.current = null, !u) return;
      const m = Rc(u.target);
      if (Math.abs(m - r.current) < 5e-3) {
        Nt(u.grid);
        return;
      }
      const d = { anchor: u.anchor, grid: u.grid, fallback: null };
      d.fallback = setTimeout(() => {
        s.current === d && (s.current = null, Nt(d.grid));
      }, Lc), s.current = d, o.current(m, { keepScroll: !1 });
    }, l = (u) => {
      var f, g;
      if (!u.ctrlKey) return;
      u.preventDefault();
      let m = a.current;
      if (!m) {
        (f = i.current) == null || f.call(i), i.current = null;
        const h = s.current;
        h && (h.fallback && clearTimeout(h.fallback), s.current = null, Nt(h.grid)), m = {
          start: r.current,
          target: r.current,
          anchor: Nc(e, u.clientX, u.clientY),
          grid: null,
          timer: null
        }, a.current = m;
      }
      m.target = Tc(m.target, u.deltaY, u.deltaMode);
      const d = Pc(m.start, m.target, ((g = m.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      m.grid = xc(e, d, u.clientX, u.clientY) ?? m.grid, m.timer && clearTimeout(m.timer), m.timer = setTimeout(c, wc);
    };
    return e.addEventListener("wheel", l, { passive: !1 }), () => {
      var m;
      e.removeEventListener("wheel", l);
      const u = a.current;
      a.current = null, u != null && u.timer && clearTimeout(u.timer), Nt((u == null ? void 0 : u.grid) ?? null), (m = i.current) == null || m.call(i), i.current = null;
    };
  }, [e]), Ne(() => {
    var l;
    const c = s.current;
    c && (s.current = null, c.fallback && clearTimeout(c.fallback), Nt(c.grid), !(!e || !c.anchor) && (ua(e, c.anchor), (l = i.current) == null || l.call(i), i.current = Dc(e, c.anchor)));
  }, [t, e]);
}
function Oc(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = M(t), a = M(n), s = M(r);
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
function zt(e, t, n = nr) {
  if (!e)
    return null;
  const r = ln(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = da(e, n), i = fa(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function Rt(e, t, n = "auto", r, o = nr) {
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
function zc(e, t, n = "smooth", r) {
  return Rt(
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
    Rt(
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
function Fc(e, t, n) {
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
function Oe(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function Bc(e, t, n = !0, r = "", o) {
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
      const y = da(i), w = fa(h, y);
      w && s(w.page);
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
const jc = `canvas, .react-pdf__Page, .${ea}, .${cn}`, Or = /* @__PURE__ */ new WeakMap();
function Hc(e) {
  const t = Number(e.getAttribute(Qn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Or.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(jc), Or.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Uc(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Wc(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(tr()).forEach((r) => {
    const o = un(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = Hc(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Kc(e, t, n = "", r) {
  const [o, a] = P(() => /* @__PURE__ */ new Map()), s = M(o), i = M(r);
  return i.current = r, Ne(() => {
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
      const v = Wc(b);
      Uc(s.current, v) || (s.current = v, a(v)), u && !m && (m = !0, (k = i.current) == null || k.call(i));
    }, f = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(d);
      });
    };
    f();
    const g = window.setTimeout(f, 100), h = window.setTimeout(() => {
      u = !0, f();
    }, 300), y = window.setTimeout(f, 700), w = e.current;
    let S = null;
    return w && typeof ResizeObserver < "u" && (S = new ResizeObserver(() => f()), S.observe(w)), () => {
      c = !0, cancelAnimationFrame(l), window.clearTimeout(g), window.clearTimeout(h), window.clearTimeout(y), S == null || S.disconnect();
    };
  }, [e, t, n]), o;
}
const Vc = [0, 48, 140, 320, 560], qc = 700, Jc = [80, 200, 400], Gc = 500, Xc = 50, Yc = /* @__PURE__ */ new Set([
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
]), Zc = 180, zr = [0, 48, 140, 320, 700, 1200];
function Qc(e, t) {
  var E;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = M(
    ((E = je(a)) == null ? void 0 : E.anchor) || { page: 1, fraction: 0 }
  ), c = M(null), l = M(!1), u = M(r), m = M(null), d = M(null), f = M(null), g = M(null), h = M(a), y = M(""), w = M(n);
  w.current = n;
  const S = N(() => {
    var R;
    (R = m.current) == null || R.call(m), m.current = null, d.current != null && (clearTimeout(d.current), d.current = null);
  }, []), b = N(() => {
    !l.current && c.current == null || (S(), f.current != null && (clearTimeout(f.current), f.current = null), c.current = null, l.current = !1);
  }, [S]), v = N((R = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const L = () => {
      g.current = null, gn(h.current, {
        anchor: Oe(i.current)
      });
    };
    R ? L() : g.current = setTimeout(L, Zc);
  }, []), k = N((R) => {
    i.current = Oe(R), c.current = null, f.current != null && clearTimeout(f.current), f.current = setTimeout(() => {
      f.current = null, l.current = !1;
    }, Xc);
  }, []);
  D(() => {
    if (!o)
      return;
    let R = !1, L = null, C = null, W = null;
    const H = () => {
      if (R) return;
      const Y = e.current;
      if (!Y) {
        W = setTimeout(H, 50);
        return;
      }
      L = Y, C = () => {
        if (l.current)
          return;
        const oe = zt(L, w.current);
        oe && (i.current = oe, v());
      }, L.addEventListener("scroll", C, { passive: !0 }), l.current || C();
    };
    return H(), () => {
      R = !0, W != null && clearTimeout(W), L && C && L.removeEventListener("scroll", C);
    };
  }, [o, r, n, e, v]), D(() => {
    if (!o) return;
    const R = e.current;
    if (!R) return;
    const L = (C) => {
      C.metaKey || C.ctrlKey || C.altKey || Yc.has(C.key) && b();
    };
    return R.addEventListener("wheel", b, { passive: !0 }), R.addEventListener("touchmove", b, { passive: !0 }), window.addEventListener("keydown", L), () => {
      R.removeEventListener("wheel", b), R.removeEventListener("touchmove", b), window.removeEventListener("keydown", L);
    };
  }, [o, e, b]), Ne(() => {
    var L;
    if (h.current === a) return;
    v(!0), S(), f.current != null && (clearTimeout(f.current), f.current = null), h.current = a, y.current = "";
    const R = (L = je(a)) == null ? void 0 : L.anchor;
    i.current = R ? Oe(R) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, u.current = r;
  }, [a, r, v, S]), D(() => {
    var L;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const R = Oe(
      ((L = je(a)) == null ? void 0 : L.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = R, c.current = R, l.current = !0, S(), m.current = zn(
      () => e.current,
      R,
      {
        behavior: "auto",
        pane: w.current,
        delaysMs: zr,
        onDone: () => k(R)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(R);
    }, Math.max(...zr) + 160), () => S();
  }, [o, s, a, e, k, S]), D(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, c.current = null, S();
      return;
    }
    const R = c.current ? Oe(c.current) : Oe(i.current);
    return l.current = !0, c.current = R, i.current = R, S(), m.current = zn(
      () => e.current,
      R,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Vc,
        onDone: () => k(R)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(R);
    }, qc), () => {
      S();
    };
  }, [r, o, n, e, k, S]), D(() => () => {
    S(), f.current != null && (clearTimeout(f.current), f.current = null), v(!0);
  }, [S, v]);
  const T = N(() => {
    const R = zt(
      e.current,
      w.current
    );
    return Oe(R || i.current);
  }, [e]), A = N(() => {
    l.current = !0;
    const R = zt(
      e.current,
      w.current
    ), L = Oe(R ?? i.current);
    return i.current = L, c.current = L, v(), L;
  }, [e, v]), O = N((R, L, C) => {
    const W = C || w.current, H = fn(R, L || 1), Y = { page: H, fraction: 0 };
    i.current = Y, l.current = !0, c.current = Y, v(), S(), zc(e.current, H, "smooth", W), m.current = Fc(
      () => e.current,
      H,
      {
        behavior: "auto",
        pane: W,
        delaysMs: Jc,
        onDone: () => k(Y)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(Y);
    }, Gc);
  }, [e, k, S, v]), z = N(() => Oe(i.current), []), _ = N(() => l.current, []), I = N(() => {
    if (!l.current || !c.current)
      return;
    const R = Oe(c.current);
    Rt(
      e.current,
      R,
      "auto",
      w.current
    );
  }, [e]);
  return {
    lockFromShell: T,
    beginModeSwitch: A,
    goToPage: O,
    getAnchor: z,
    isRestoring: _,
    repinIfRestoring: I
  };
}
function el(e, t) {
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
const tl = [0, 80, 200, 400, 800], nl = 120, rl = 400;
function ol(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: c, documentId: l, regionsSettled: u = !0 } = e, m = M(a);
  m.current = a;
  const d = M(s);
  d.current = s;
  const f = M(i);
  f.current = i;
  const g = M(n);
  g.current = n, D(() => {
    var v, k;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = fi(), y = el(h, d.current);
    if (y == null && (h != null && h.blockId) && !u) return;
    const w = ma(h, y, { jobId: c, documentId: l });
    if (t.current === w)
      return;
    if (y == null) {
      t.current = w, (v = g.current) == null || v.call(g);
      return;
    }
    t.current = w, h && ((k = f.current) == null || k.call(f, h, y));
    const S = [];
    let b = 0;
    for (const T of tl)
      b = Math.max(b, T), S.push(
        setTimeout(() => {
          m.current(y);
        }, T)
      );
    return S.push(
      setTimeout(() => {
        var T;
        (T = g.current) == null || T.call(g);
      }, b + nl)
    ), () => {
      for (const T of S) clearTimeout(T);
    };
  }, [r, o, c, l, t, u]);
}
function al(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function sl(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = rl,
    jobId: i,
    documentId: c,
    applyReaderSearch: l
  } = e, u = M(a);
  u.current = a;
  const m = M(l);
  m.current = l;
  const d = M(0);
  D(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || d.current === o) return;
    const f = setTimeout(() => {
      var w;
      const g = ((w = globalThis.location) == null ? void 0 : w.search) || "", h = bs(g, o, u.current);
      if (d.current = o, h === null) return;
      const y = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = ma(
        { blockId: y },
        o,
        { jobId: i, documentId: c }
      ), (m.current || al)(h);
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
function il(e) {
  const t = M(""), [n, r] = P(!1), o = N(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  ol(a, t, o), sl(e, t, n);
}
const At = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function cl(e) {
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
function ll(e, t, n) {
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
function ul(e) {
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
function dl(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function fl(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function ml(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function hl(e) {
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
  return Es(e) ? `${e.code || ""}`.trim() : "";
}
function Qt(e, t) {
  const n = rr(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function pl(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (ha(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
        return c;
      a = Ts(
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
function gl({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = P(At), s = M(o), i = M("");
  s.current = o;
  const c = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = Bt(l) ? l : "";
  return D(() => {
    if (!n || !c) {
      i.current = "", s.current = At, a(At);
      return;
    }
    const m = r === void 0 ? di() : r, d = i.current === c;
    if (i.current = c, !m) {
      const b = {
        ...d ? s.current : At,
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
      ...d ? s.current : At,
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
    }, w = async () => {
      let b = 0;
      for (; !f.signal.aborted; )
        try {
          const v = await m.fetchLayout(c, { signal: f.signal });
          g = !0, y((k) => ({
            ...k,
            layoutByPage: cl(v),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (v) {
          if ((v == null ? void 0 : v.name) === "AbortError") return;
          const k = rr(v);
          if (!(k === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !k)) {
            y((A) => ({
              ...A,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: Qt(v, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            y((A) => ({
              ...A,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          y((A) => ({
            ...A,
            connection: "connecting",
            jobStatus: l,
            error: Qt(v, "正在等待 OCR 版面数据")
          })), await Fn(Br[Math.min(b, Br.length - 1)], f.signal).catch(() => {
          }), b += 1;
        }
    };
    return (async () => {
      if (await w(), !g || f.signal.aborted) return;
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
                k = await pl(
                  c,
                  v,
                  s.current,
                  f.signal,
                  m
                );
              } catch (T) {
                if ((T == null ? void 0 : T.name) === "AbortError" || f.signal.aborted) throw T;
                y((A) => ({
                  ...A,
                  lastSeq: Math.max(A.lastSeq, v.seq),
                  error: Qt(T, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((T) => {
                const A = ll(T, v, k);
                return u ? {
                  ...A,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...A,
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
function bl(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), c = Number(s.count) || 0;
    i && c > 0 && o.set(i, c);
  }
  return o;
}
function yl(e, t = !0) {
  const [n, r] = P(() => /* @__PURE__ */ new Map());
  return D(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = Je().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(bl(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const vl = 4500;
function wl(e) {
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
const Sl = /* @__PURE__ */ new Set(["book", "translate"]);
function pa(e) {
  return !!(e.jobId && e.sourceUrl && Sl.has(e.workflow));
}
function kl(e) {
  return !!(pa(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function Il() {
  const e = qi(), t = pa({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = kl({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = M({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Bt(o) && (r.current.running = !0);
  const a = gl({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = Yi(), u = yl(e.jobId, !e.sourceOnly), m = hc({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${m}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: f, onZoomChange: g } = vc(e.mode, s, m);
  $c(i, f, g);
  const h = Qi(
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
    goToPage: w,
    repinIfRestoring: S
  } = Qc(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: m,
    restoreReady: h.primaryNumPages > 0
  });
  D(() => {
    S();
  }, [c, S]);
  const b = Kc(
    s,
    h.compareMode,
    h.rowSyncRevision,
    S
  ), v = Bc(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${f}-${h.metricsTick}`,
    h.primaryPane
  ), k = N((H, Y) => {
    var Q, ae;
    const oe = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((Q = h.numPagesByPane) == null ? void 0 : Q.source) || 0,
      Number((ae = h.numPagesByPane) == null ? void 0 : ae.translated) || 0
    );
    w(H, oe, Y);
  }, [w, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [T, A] = P(null), O = M(null), z = N((H) => {
    O.current && clearTimeout(O.current), A(H), H && (O.current = setTimeout(() => A(null), vl));
  }, []);
  D(() => () => {
    O.current && clearTimeout(O.current);
  }, []);
  const _ = N((H) => {
    const Y = vn(e.regions, H);
    return Y ? Mr(Y, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), I = N((H, Y) => {
    const oe = Y || h.primaryPane, Q = typeof H == "object" && H ? `${H.block_id || ""}`.trim() : "", ae = typeof H == "object" && H ? `${H.image_url || ""}`.trim() : "", j = typeof H == "object" && H ? H.page_idx != null ? Number(H.page_idx) + 1 : H.page != null ? Number(H.page) : null : typeof H == "number" ? H + 1 : null, U = vs(e.regions, ae, j) || vn(e.regions, Q) || (typeof H == "object" ? ws(e.regions, H) : null);
    let K = U ? Mr(U, oe).page : null;
    K == null && (K = wl(H)), !(K == null || K < 1) && (z(U), k(K, oe));
  }, [z, k, h.primaryPane, e.regions]);
  il({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: v,
    goToPage: k,
    resolveBlockPage: _,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (H) => {
      z(vn(e.regions, H.blockId));
    }
  });
  const { setModeKeepingPage: E } = Oc({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: y
  });
  D(() => {
    z(null);
  }, [d, z]);
  const R = !e.boot.loading && !e.boot.failed, L = V(() => ({ bindShell: l, shellEl: i, shellWidth: c, shellRef: s }), [l, i, c, s]), C = V(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), W = V(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: f,
    onZoomChange: g,
    shell: L,
    panes: h,
    sessionFiles: C,
    rowHeights: b,
    goToPage: k,
    activeRegion: T,
    jumpToAnchor: I,
    setModeKeepingPage: E,
    download: e.download,
    showHud: R,
    viewStateKey: m,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, L, h, C, b, k, T, I, E, R, f, g, m, a, n, u]);
  return V(() => ({
    ...W,
    currentPage: v
  }), [W, v]);
}
const El = [
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
], Tl = [
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
function Rl(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of El)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Pl(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const Ml = ".reader-notes-panel";
function _l(e) {
  return e instanceof Element ? !!e.closest(Ml) : !1;
}
function Nl(e) {
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
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || Pl(d.target) || _l(d.target))
        return;
      const f = d.key, g = Rl(f);
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
              a(Ht(o, 1));
              return;
            case "zoom-out":
              a(Ht(o, -1));
              return;
            case "zoom-reset":
              a(St(t, et()));
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
function xl() {
  return new URL("./index.html", window.location.href).href;
}
function Ll() {
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
function Cl(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Dl() {
  if (!(typeof window > "u") && !Ll()) {
    if (Cl(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(xl());
  }
}
function $l({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function Ol({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ x($l, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Dl();
  }, children: [
    /* @__PURE__ */ p(ft, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
const zl = 3e3, Fl = 8;
async function Bl(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function jl(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function Hl(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = zl;
  const r = [], o = (s, i, c) => {
    const l = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const m = s[u], d = jl(m == null ? void 0 : m.title);
      if (!d) continue;
      n -= 1;
      const f = c ? `${c}.${u}` : `${u}`, g = { id: f, title: d, page: null, level: i, children: [] };
      r.push({ node: g, dest: m.dest }), l.push(g), i < Fl && Array.isArray(m.items) && m.items.length && (g.children = o(m.items, i + 1, f));
    }
    return l;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await Bl(e, i);
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
function Ul() {
  if (Ur)
    return;
  const e = jt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (Go.GlobalWorkerOptions.workerSrc = e, Ur = !0);
}
const Qe = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Wl = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Kl = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Vl = {
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
function ql(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Wr(o ?? a ?? "", Wl)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Wr(o ?? a ?? "", Kl)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Vl[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Jl(e) {
  return Qe(e.translatedBlockText) || Qe(e.translated.text) || Qe(e.source.text);
}
const Gl = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Xl(e) {
  const t = [];
  for (const n of e) {
    if (!Gl(n)) continue;
    const r = ql(Jl(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function Yl(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const Zl = 24, Ql = 60;
function Kr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - Zl), o = Math.min(e.length, n + t.length + Ql), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function eu(e, t, n = 200) {
  const r = Qe(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = Qe(a.translatedBlockText) || Qe(a.translated.text), c = i ? Kr(i, r) : null, l = c ?? Kr(Qe(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: c ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
function en(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function Ct(e, t) {
  const n = Qe(t).toLowerCase();
  if (!n || !e) return en(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${en(e.slice(a, s))}<mark class="reader-find-mark">${en(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + en(e.slice(a));
}
function tu(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const nu = /^data-[a-z0-9-]+$/;
function Vr(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function ru(e, t, n = "") {
  if (!t.length) return Ct(e, n);
  const r = t.filter((s) => s.end > s.start && s.start >= 0 && s.end <= e.length).map((s, i) => ({ mark: s, order: i })).sort((s, i) => s.mark.start - i.mark.start || s.order - i.order).map(({ mark: s }) => s);
  let o = "", a = 0;
  for (const s of r) {
    if (s.start < a) continue;
    o += Ct(e.slice(a, s.start), n);
    const i = Object.entries(s.attrs ?? {}).filter(([c]) => nu.test(c)).map(([c, l]) => ` ${c}="${Vr(l)}"`).join("");
    o += `<mark class="${Vr(s.className)}"${i}>${Ct(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  }
  return o + Ct(e.slice(a), n);
}
function Se(e) {
  return typeof e == "string" ? e : "";
}
function ou(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function au(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function su(e) {
  return {
    source: Se(e == null ? void 0 : e.source_text) || Se(e == null ? void 0 : e.unit_source_text),
    translated: Se(e == null ? void 0 : e.protected_translated_text) || Se(e == null ? void 0 : e.translated_text)
  };
}
const iu = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function ya(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function cu(e) {
  const t = ya(e).sort((r, o) => Se(r.ts).localeCompare(Se(o.ts)));
  return t.length ? [
    { text: Se(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: Se(r.new_text),
      label: iu[Se(r.source)] || Se(r.source) || "修订",
      ts: Se(r.ts),
      reason: Se(r.reason)
    }))
  ].reverse() : [];
}
function lu(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function uu(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return Se(r.finished_at) || Se(n.finished_at) || "";
}
function du(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = ya(e).sort((a, s) => Se(a.ts).localeCompare(Se(s.ts)));
  for (const a of o) {
    const s = new Date(Se(a.ts)).getTime(), i = Se(a.reader_item_id) || Se(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, Se(a.new_text));
  }
  return n;
}
const fu = {
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
function mu(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = fu[Se(n.kind)] || Se(n.kind) || "问题", o = Se(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const hu = /* @__PURE__ */ new Set(["text", "formula"]);
function or(e) {
  return hu.has(e);
}
function va(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || or($e(n));
}
function pu(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !or($e(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const gu = 300, bu = 72;
function yu(e, t) {
  if (e.width >= gu && e.height >= bu)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const vu = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function wu(e, t, n) {
  return e.flatMap((r) => {
    if (!vu.has($e(r.region))) return [];
    const o = dt(r, t, n);
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
async function Su(e) {
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
const ku = "reader-text-hover-copy", Iu = "reader-text-hover-edit", Eu = "reader-text-hover-zoom", Tu = "reader-text-hover-id";
function Ru(e = typeof window > "u" ? "" : window.location.search) {
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
const Pu = 26, Mu = 220;
function _u(e, t = Mu) {
  return e.height < Pu * 2 || e.width < t;
}
function Nu({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? Ho : e === "failed" ? ft : Ms, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
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
  const [c, l] = P("idle"), [u, m] = P("idle"), [d] = P(() => Ru()), f = M([]), g = (e == null ? void 0 : e.itemId) || "";
  if (D(() => {
    l("idle"), m("idle");
    const k = f.current;
    return () => {
      k.forEach((T) => window.clearTimeout(T)), f.current = [];
    };
  }, [g]), !e) return null;
  const h = Ss(e.highlight.region, t), y = $e(e.highlight.region), w = (k, T) => async (A) => {
    A.preventDefault(), A.stopPropagation();
    const O = await Su(k);
    T(O ? "copied" : "failed"), f.current.push(window.setTimeout(() => T("idle"), 1200));
  }, S = y === "formula" ? "复制 LaTeX" : "复制", b = a || e.rect, v = s || (_u(b) ? "outside" : "inside");
  return /* @__PURE__ */ p("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ p(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": y,
      style: b,
      children: /* @__PURE__ */ x(
        "div",
        {
          className: wa,
          "data-placement": v,
          style: v === "tail" ? { top: i } : void 0,
          children: [
            d ? /* @__PURE__ */ p(
              tn,
              {
                className: Tu,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: w(e.itemId, m),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && or(y) ? /* @__PURE__ */ p(
              tn,
              {
                className: Iu,
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
                className: ku,
                state: c,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: c === "copied" ? "已复制" : c === "failed" ? "复制失败" : S,
                onClick: w(h, l),
                children: /* @__PURE__ */ p(Nu, { state: c })
              }
            ) : null,
            o ? /* @__PURE__ */ p(
              tn,
              {
                className: Eu,
                state: "idle",
                label: "放大看这一块",
                title: y === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (k) => {
                  k.preventDefault(), k.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ p(Ps, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function xu(e, t) {
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
function Lu(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = dt(
      xu(e, a),
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
const Cu = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Du = 256, xt = /* @__PURE__ */ new Map();
function $u(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Sa(e) {
  const t = `${e || ""}`, { text: n, slots: r } = oi(t, { bareLatex: !0 }), o = $u(n), a = ai(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = xt.get(t);
  if (!s && (s = si(o, r), xt.set(t, s), xt.size > Du)) {
    const i = xt.keys().next().value;
    i !== void 0 && xt.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function kn(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function We(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Ou(e, t) {
  const n = e.typography, r = We(t) || 1, o = We(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = kn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(s, i * r)), l = We(n == null ? void 0 : n.fit_min_font_size_pt), u = We(n == null ? void 0 : n.fit_max_font_size_pt), m = Math.max(3.5, (l || 5.5) * r), d = Math.max(
    m,
    u ? u * r : o ? o * r : c
  ), f = o ? o * r : c, g = We(n == null ? void 0 : n.leading_em), h = [
    We(n == null ? void 0 : n.padding_top_pt) || 0,
    We(n == null ? void 0 : n.padding_right_pt) || 0,
    We(n == null ? void 0 : n.padding_bottom_pt) || 0,
    We(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((y) => y * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Cu,
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
function zu(e, t, n, r) {
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
const Fu = 512, Lt = /* @__PURE__ */ new Map();
let Bn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Bn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Bn += 1;
}));
function Bu(e, t, n, r) {
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
  const n = M(null), r = V(
    () => Sa(e.translatedText),
    [e.translatedText]
  ), [o, a] = P(r.fallbackHtml), s = V(
    () => Ou(e, t),
    [e, t]
  );
  D(() => {
    let m = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((d) => {
      m && a(d);
    }), () => {
      m = !1;
    };
  }, [r]), Ne(() => {
    const m = n.current;
    if (!m) return;
    const [d, f, g, h] = s.padding, y = Math.max(1, e.rect.width - h - f), w = Math.max(1, e.rect.height - d - g), S = Bu(o, y, w, s);
    let b = Lt.get(S);
    if (b === void 0 && (b = zu(
      (v) => (m.style.fontSize = `${v}px`, { width: m.scrollWidth, height: m.scrollHeight }),
      y,
      w,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), Lt.set(S, b), Lt.size > Fu)) {
      const v = Lt.keys().next().value;
      v !== void 0 && Lt.delete(v);
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
function ju({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = V(
    () => Lu(e, t, n, r),
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
const Hu = Vt(ju);
function Uu({
  targets: e,
  edits: t,
  width: n,
  excludeId: r
}) {
  const o = e.filter((a) => t.has(a.itemId) && a.itemId !== r);
  return o.length ? /* @__PURE__ */ p("div", { className: "reader-live-translation-overlay reader-edited-overlay", "aria-hidden": "true", children: o.map((a) => {
    const s = a.highlight.pageSize.width;
    return /* @__PURE__ */ x("div", { className: "reader-edited-block", "data-reader-edited-id": a.itemId, children: [
      /* @__PURE__ */ p(
        ka,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: $e(a.highlight.region),
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
const Wu = Vt(Uu), Ia = 24, Ye = Ia * 2 + 4, Ke = 24, Ku = 4, Vu = 6, it = (e) => e.left + e.width, nt = (e) => e.top + e.height;
function Dt(e, t) {
  const n = Math.min(it(e), it(t)) - Math.max(e.left, t.left), r = Math.min(nt(e), nt(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const Jr = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= it(t) && r >= t.top && r <= nt(t);
}, qu = (e) => e.height > 40 && e.height > e.width * 2.5;
function Ju(e, t, n) {
  if (!t.length || e.height < Ke || e.width < n + 8) return null;
  const r = Math.max(...t.map(nt)), o = it(e) - 4 - n;
  for (const a of [r, nt(e) - 2]) {
    const s = Math.max(e.top, a - Ke), i = { left: o, top: s, width: n, height: Ke };
    if (!t.some((c) => Dt(i, c) > 0)) return s - e.top;
  }
  return null;
}
function Gu(e, t) {
  const n = [], r = (a) => {
    const s = Ia + Ku, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: it(e), top: i, width: s, height: Ye } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: Ye } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - Ke - 3, width: Ye, height: Ke + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: nt(e), width: Ye, height: Ke + 3 } }), r(!0);
  const o = Ju(e, t, Ye);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: it(e) - 4 - Ye, top: e.top + o, width: Ye, height: Ke } }), n;
}
function Xu(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((S) => S.width > 0 && S.height > 0 && !qu(S)), i = s.filter((S) => Jr(S, t)), c = s.filter((S) => !Jr(S, t)), l = n.filter((S) => S !== t && Dt(S, t) < t.width * t.height * 0.5), u = Gu(t, i).filter(({ box: S, overhang: b }) => {
    const v = b ? Vu : 0;
    return S.left >= -v && it(S) <= r + v && S.top >= 0 && nt(S) <= o;
  }), m = ({ placement: S, tailTop: b }) => b === void 0 ? { placement: S } : { placement: S, tailTop: b }, d = ({ box: S }) => !c.some((b) => Dt(S, b) > 0), f = u.filter((S) => S.placement !== "tail"), g = f.find((S) => d(S) && !l.some((b) => Dt(S.box, b) > 0));
  if (g) return m(g);
  const h = f.find(d) || u.find((S) => S.placement === "tail" && d(S));
  if (h) return m(h);
  let y = null, w = Number.POSITIVE_INFINITY;
  for (const S of u) {
    const b = c.reduce((v, k) => v + Dt(S.box, k), 0);
    b < w && (y = S, w = b);
  }
  return y ? m(y) : { placement: "outside" };
}
function Yu(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - Ke - 3 : nt(r);
  return t >= r.left - 4 && t <= r.left + Ye + 4 && n >= a && n <= a + Ke + 3;
}
const In = (e) => e.left + e.width, En = (e) => e.top + e.height;
function Zu(e, t, n = 3, r = 6) {
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
function Qu(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function ed(e, t, n, r) {
  const [o, a] = P(null);
  return Ne(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? Qu(s) : [], c = $e(t.highlight.region) === "figure", l = i.length && !c ? Zu(t.rect, i) : t.rect, u = n.filter((d) => d.itemId !== t.itemId).map((d) => d.rect), m = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...Xu({ frame: l, others: u, pageWidth: r, pageHeight: m, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
function td({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = P(null), [i, c] = P(!1), [l, u] = P([]), [m, d] = P(""), [f, g] = P(""), [h, y] = P(!1), [w, S] = P(null), [b, v] = P([]), k = r.drafts, T = r.generation, A = N(async (I, E) => {
    if (e)
      try {
        u(cu(await e.fetchRevisions(I, E)));
      } catch {
        u([]);
      }
  }, [e]);
  D(() => {
    if (s(null), u([]), S(null), v([]), g(""), !e || !t || !n) return;
    let I = !1;
    return c(!0), e.loadItem(t, n).then((E) => {
      if (I) return;
      const R = E == null ? void 0 : E.item;
      if (!R) throw new Error("找不到这一段的译文。");
      const L = `${(E == null ? void 0 : E.item_id) || n}`, { source: C, translated: W } = su(R);
      s({ readerItemId: n, itemId: L, source: C, current: W }), d(k.get(n) ?? W);
    }).catch((E) => {
      I || S({ tone: "error", message: (E == null ? void 0 : E.message) || "读取这段译文失败。" });
    }).finally(() => {
      I || c(!1);
    }), A(t, n), () => {
      I = !0;
    };
  }, [e, t, n, A]);
  const O = N((I) => {
    d(I), n && k.set(n, I);
  }, [n, k]), z = N(async (I, E) => {
    if (!e || !a || h) return !1;
    const R = I ?? m;
    if (!R.trim()) return !1;
    y(!0), S(null), v([]);
    try {
      const L = await e.revise(t, a.itemId, {
        translated_text: R,
        source: "user",
        reason: (E ?? f).trim() || "在阅读页手动修改",
        ...T.current != null ? { expected_generation: T.current } : {}
      }), C = Number(L == null ? void 0 : L.generation);
      return Number.isFinite(C) && (T.current = C), k.delete(a.readerItemId), s({ ...a, current: R }), d(R), g(""), (L == null ? void 0 : L.changed) === !1 ? S({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, R), S({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), A(t, a.readerItemId), !0;
    } catch (L) {
      const C = L;
      return (C == null ? void 0 : C.reason) === "generation_mismatch" && (T.current = null), S({ tone: "error", message: (C == null ? void 0 : C.message) || "保存失败，请稍后再试。" }), v(mu(C == null ? void 0 : C.issues)), !1;
    } finally {
      y(!1);
    }
  }, [e, a, h, m, f, t, o, A, k, T]), _ = N(() => {
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
    status: w,
    issues: b,
    save: z,
    discardDraft: _
  };
}
const Ea = "reader-inline-edit";
function nd({ text: e }) {
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
  }, [e]), t ? /* @__PURE__ */ x("div", { className: "reader-inline-edit-preview", "data-inline-edit-preview": "true", children: [
    /* @__PURE__ */ p("span", { className: "reader-inline-edit-preview-label", children: "预览" }),
    /* @__PURE__ */ p("div", { className: "reader-live-translation-content", dangerouslySetInnerHTML: { __html: t } })
  ] }) : null;
}
function rd({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var _;
  const s = e.itemId, i = td({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = P(!1), [u, m] = P(!1), d = M(null), f = yu(e.rect, t), g = V(() => pu(o), [o]), h = g.indexOf(s), { loaded: y } = i, w = i.saving || i.loading, S = n.blockedReason, b = !y || i.draft === y.current, { close: v, select: k } = n, T = N((I) => {
    const E = g[h + I];
    E && (k(E), a == null || a(E));
  }, [g, h, k, a]), A = N(() => {
    i.discardDraft(), v();
  }, [i, v]), O = N(async (I, E) => {
    await i.save(I, E) && v();
  }, [i, v]);
  D(() => {
    const I = (E) => {
      !E.altKey || E.key !== "ArrowUp" && E.key !== "ArrowDown" || (E.preventDefault(), T(E.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", I), () => window.removeEventListener("keydown", I);
  }, [T]), Ne(() => {
    const I = d.current;
    if (!I) return;
    I.style.height = "auto";
    const E = f.mode === "inline" ? f.minHeight : 0;
    I.style.height = `${Math.max(E, I.scrollHeight + 2)}px`;
  }, [i.draft, y, f.mode, f.mode === "inline" ? f.minHeight : 0]);
  const z = f.mode === "inline" ? { left: f.left, top: f.top, width: f.width } : { left: f.left, width: f.width, top: f.top, bottom: f.bottom };
  return /* @__PURE__ */ x(xe, { children: [
    f.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ x(
      "div",
      {
        className: `${Ea} is-${f.mode}`,
        style: z,
        role: "group",
        "aria-label": `改第 ${((_ = n.target) == null ? void 0 : _.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": f.mode,
        onPointerDown: (I) => I.stopPropagation(),
        children: [
          r && (y != null && y.source) ? /* @__PURE__ */ p(
            re,
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
            ti,
            {
              ref: d,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: w || !!S,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (I) => i.setDraft(I.target.value),
              onKeyDown: (I) => {
                I.key === "Enter" && (I.metaKey || I.ctrlKey) ? (I.preventDefault(), b || O()) : I.key === "Escape" && (I.preventDefault(), A());
              }
            }
          ) : null,
          y ? /* @__PURE__ */ p(nd, { text: i.draft }) : null,
          /* @__PURE__ */ x("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(at, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => T(-1), children: /* @__PURE__ */ p(_s, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(at, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= g.length - 1, onClick: () => T(1), children: /* @__PURE__ */ p(Uo, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              Jo,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: w || !!S || !y,
                onChange: (I) => i.setReason(I.target.value),
                onKeyDown: (I) => {
                  I.key === "Enter" ? (I.preventDefault(), b || O()) : I.key === "Escape" && (I.preventDefault(), A());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ x(
              re,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": u,
                "data-block-edit-action": "history",
                onClick: () => m((I) => !I),
                children: [
                  /* @__PURE__ */ p(Ns, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ p(re, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: A, children: "取消" }),
            /* @__PURE__ */ p(
              re,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: w || !!S || b || !i.draft.trim(),
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
            const R = I.text === y.current, L = [lu(I.ts), I.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ x("li", { "data-block-edit-history": I.label, "data-current": R ? "true" : void 0, children: [
              /* @__PURE__ */ x("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ x("span", { children: [
                  L,
                  R ? "（现在用的）" : "",
                  I.reason ? ` · ${I.reason}` : ""
                ] }),
                R ? null : /* @__PURE__ */ p(
                  re,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: w || !!S,
                    onClick: () => {
                      O(I.text, `回到「${L.replace(" · ", " ")}」那一版`);
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
const Ta = qt(null), Ra = qt(null);
function od({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(Ta.Provider, { value: e, children: /* @__PURE__ */ p(Ra.Provider, { value: t, children: n }) });
}
function Ge() {
  return st(Ta);
}
function Pa() {
  return st(Ra);
}
const Ma = 1.414;
function ad({
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
  showLiveTranslation: w = r === "source",
  liveTranslationMissing: S = !1
}) {
  var le, we;
  const b = Ge(), v = b == null ? void 0 : b.revisedBlocks, k = b == null ? void 0 : b.blockEdit, T = k == null ? void 0 : k.pendingEdits, A = b == null ? void 0 : b.editBlock, O = (b == null ? void 0 : b.findTerm) || "", z = r === "translated" ? "translated" : b != null && b.compareVersion ? "compare" : "source", _ = b == null ? void 0 : b.textMarks, I = V(
    () => _ ? ({ str: F }) => ru(F, _(F), O) : O ? ({ str: F }) => Ct(F, O) : void 0,
    [O, _]
  ), E = M(c ?? Ma), [R, L] = P(E.current);
  D(() => {
    c != null && Math.abs(c - E.current) >= 1e-3 && (E.current = c, L(c));
  }, [c]);
  const C = M(u);
  C.current = u;
  const W = M(null), H = M((F) => {
    var Z;
    W.current = F, (Z = C.current) == null || Z.call(C, F);
  }).current, Y = M(null), oe = M(`${t}@${n}`);
  Ne(() => {
    const F = `${t}@${n}`;
    oe.current !== F && (oe.current = F, o && id(W.current, Y.current));
  }, [o, n, t]), D(() => {
    o || Tn(Y.current);
  }, [o]), D(() => () => Tn(Y.current), []);
  const Q = Math.max(120, Math.floor(t * R)), ae = Math.max(Q, Math.ceil(s || 0)), j = dt(m, t, Q), U = V(
    () => wu(d, t, Q),
    [Q, d, t]
  ), [K, he] = P(null), J = typeof g == "function", G = J ? f ?? null : K, pe = (F) => {
    J ? F !== (f ?? null) && (g == null || g(F)) : he((Z) => Z === F ? Z : F);
  }, ce = V(
    () => U.find((F) => F.itemId === G) || null,
    [G, U]
  ), fe = r === "translated" && ((le = k == null ? void 0 : k.target) == null ? void 0 : le.itemId) || "", ve = V(
    () => fe && U.find((F) => F.itemId === fe) || null,
    [fe, U]
  ), ye = ed(W, o ? ce : null, U, t), ze = (F) => {
    var ue, ke, Ee, de;
    if (F.pointerType === "touch") return;
    if (b != null && b.pointerTaken) {
      pe(null);
      return;
    }
    if (F.buttons !== 0) {
      pe(null);
      return;
    }
    if ((ke = (ue = F.target) == null ? void 0 : ue.closest) != null && ke.call(ue, `.${wa}`) || (de = (Ee = F.target) == null ? void 0 : Ee.closest) != null && de.call(Ee, `.${Ea}`)) return;
    const Z = F.currentTarget.getBoundingClientRect(), $ = F.clientX - Z.left, q = F.clientY - Z.top;
    if (Yu(ye, $, q)) return;
    const ee = qr(U, $, q);
    pe((ee == null ? void 0 : ee.itemId) || null);
  }, Ae = (F) => {
    if (F.pointerType === "mouse") return;
    const Z = F.currentTarget.getBoundingClientRect(), $ = qr(
      U,
      F.clientX - Z.left,
      F.clientY - Z.top
    );
    pe(($ == null ? void 0 : $.itemId) || null);
  }, ie = (F) => {
    !Number.isFinite(F) || F <= 0 || Math.abs(E.current - F) < 1e-3 || (E.current = F, L(F), l == null || l(e, F));
  };
  return /* @__PURE__ */ x(
    "div",
    {
      ref: H,
      [Te]: e,
      [Ie]: r,
      [Qn]: Q,
      className: er,
      onPointerMoveCapture: ze,
      onPointerDown: Ae,
      onDoubleClick: (F) => {
        const Z = b == null ? void 0 : b.zoomBlock;
        !Z || b != null && b.pointerTaken || !ce || $e(ce.highlight.region) === "figure" && (F.preventDefault(), Z(ce.itemId));
      },
      onPointerLeave: (F) => {
        F.pointerType === "mouse" && pe(null);
      },
      style: {
        width: t,
        height: ae,
        minHeight: ae
      },
      children: [
        o ? /* @__PURE__ */ p(
          ni,
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
                style: { width: t, height: Q }
              }
            ),
            onLoadSuccess: (F) => {
              try {
                const Z = F.getViewport({ scale: 1 });
                if (Z.width > 0) {
                  const $ = Z.height / Z.width;
                  ie($);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              Tn(Y.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ p(
          "div",
          {
            className: cn,
            style: { width: t, height: Q },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: Y, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        j ? /* @__PURE__ */ p(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": m == null ? void 0 : m.itemId,
            style: j,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && w ? /* @__PURE__ */ p(
          Hu,
          {
            layoutPage: h,
            pageState: y,
            width: t,
            height: Q
          }
        ) : null,
        o && w && S ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (T != null && T.size) ? /* @__PURE__ */ p(Wu, { targets: U, edits: T, width: t, excludeId: ve == null ? void 0 : ve.itemId }) : null,
        o && ve && k ? /* @__PURE__ */ p(
          rd,
          {
            target: ve,
            page: { width: t, height: Q },
            edit: k,
            showSource: !!(b != null && b.editShowsSource),
            regions: b == null ? void 0 : b.regions,
            jumpToBlock: b == null ? void 0 : b.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (v != null && v.size) ? /* @__PURE__ */ p("div", { className: "reader-revised-markers", "aria-hidden": "true", children: U.filter((F) => v.has(F.itemId)).map((F) => /* @__PURE__ */ p(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": F.itemId,
            style: { left: F.rect.left, top: F.rect.top, height: F.rect.height }
          },
          F.itemId
        )) }) : null,
        (we = b == null ? void 0 : b.pageLayers) == null ? void 0 : we.map((F) => /* @__PURE__ */ p(Xn, { children: F.render({ page: e, width: t, height: Q, pane: z, active: o }) }, F.id)),
        /* @__PURE__ */ p(
          Au,
          {
            target: o && !(b != null && b.pointerTaken) && (ce == null ? void 0 : ce.itemId) !== (ve == null ? void 0 : ve.itemId) ? ce : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: ce && (v == null ? void 0 : v.get(ce.itemId)) || 0,
            onEdit: A,
            onZoom: b == null ? void 0 : b.zoomBlock,
            frameRect: ye == null ? void 0 : ye.rect,
            placement: ye == null ? void 0 : ye.placement,
            tailTop: ye == null ? void 0 : ye.tailTop
          }
        )
      ]
    }
  );
}
const sd = Vt(ad);
function id(e, t) {
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
const cd = 2 * 1024 * 1024;
function ld(e) {
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
const Rn = 5, ud = "120% 0px", dd = 120, fd = "25% 0px";
let Gr = 1;
const Xr = /* @__PURE__ */ new WeakMap();
function md(e) {
  if (!e) return 0;
  const t = Xr.get(e);
  if (t) return t;
  const n = Gr;
  return Gr += 1, Xr.set(e, n), n;
}
function hd() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const pd = Oo(
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
    regions: w = [],
    readerMetadata: S = null,
    hoveredRegionId: b = null,
    onHoverRegion: v,
    liveTranslation: k,
    showLiveTranslation: T = t === "source",
    liveTranslationPendingLabel: A = "",
    paneAction: O
  }, z) {
    Ul();
    const { file: _, loading: I, error: E } = ji(n, r), R = `${n}\0${md(_)}`, L = M(R);
    L.current = R;
    const C = V(() => {
      const B = Di(_);
      return B ? "ranged" in B ? { range: ld(B.ranged) } : B : null;
    }, [_, n]), [W, H] = P(0), [Y, oe] = P(""), [Q, ae] = P(null), [j, U] = P(480), K = M(null), he = M(0), J = V(() => hd(), []), G = V(() => ({
      cMapUrl: jt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: jt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: cd,
      disableAutoFetch: !0
    }), []);
    Yn(z, () => Q, [Q]), D(() => {
      const B = (X) => {
        he.current = X, U(X);
      }, ne = (X) => {
        const ge = lc(X, he.current);
        if (ge !== "ignore") {
          if (K.current && clearTimeout(K.current), ge === "immediate") {
            B(X);
            return;
          }
          K.current = setTimeout(() => B(X), aa);
        }
      }, te = !!(c && c >= 80);
      ne(te ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const be = !te && i && typeof ResizeObserver < "u" ? new ResizeObserver((X) => {
        var ge, Re;
        ne(((Re = (ge = X[0]) == null ? void 0 : ge.contentRect) == null ? void 0 : Re.width) ?? i.clientWidth);
      }) : null;
      return be && i && be.observe(i), () => {
        be == null || be.disconnect(), K.current && clearTimeout(K.current);
      };
    }, [c, i, a]);
    const pe = V(
      () => sc(j, o),
      [j, o]
    ), [ce, fe] = P(() => /* @__PURE__ */ new Map()), [ve, ye] = P(() => /* @__PURE__ */ new Set()), [ze, Ae] = P(() => /* @__PURE__ */ new Set()), ie = M(/* @__PURE__ */ new Map()), le = M(null), we = M(null), [F, Z] = P(() => /* @__PURE__ */ new Set()), $ = M(/* @__PURE__ */ new Map()), q = N((B, ne) => {
      fe((te) => {
        if (te.get(B) === ne) return te;
        const se = new Map(te);
        return se.set(B, ne), se;
      });
    }, []), ee = N((B, ne) => {
      const te = ie.current, se = te.get(B), be = [le.current, we.current];
      if (se)
        for (const X of be)
          try {
            X == null || X.unobserve(se);
          } catch {
          }
      if (ne) {
        te.set(B, ne);
        for (const X of be)
          try {
            X == null || X.observe(ne);
          } catch {
          }
      } else
        te.delete(B);
    }, []), ue = M(/* @__PURE__ */ new Map()), ke = N((B) => {
      const ne = ue.current;
      let te = ne.get(B);
      return te || (te = (se) => ee(B, se), ne.set(B, te)), te;
    }, [ee]);
    D(() => {
      if (typeof IntersectionObserver > "u") return;
      const B = $.current, ne = new IntersectionObserver(
        (te) => {
          const se = [], be = [];
          for (const X of te) {
            const ge = X.target, Re = un(ge);
            Number.isFinite(Re) && (X.isIntersecting ? se : be).push(Re);
          }
          if ((se.length || be.length) && ye((X) => {
            let ge = null;
            for (const Re of se)
              X.has(Re) || (ge = ge || new Set(X), ge.add(Re));
            for (const Re of be)
              X.has(Re) && (ge = ge || new Set(X), ge.delete(Re));
            return ge || X;
          }), se.length) {
            for (const X of se) {
              const ge = B.get(X);
              ge && (clearTimeout(ge), B.delete(X));
            }
            Ae((X) => {
              let ge = null;
              for (const Re of se)
                X.has(Re) || (ge = ge || new Set(X), ge.add(Re));
              return ge || X;
            });
          }
          for (const X of be)
            B.has(X) || B.set(X, setTimeout(() => {
              B.delete(X), Ae((ge) => {
                if (!ge.has(X)) return ge;
                const Re = new Set(ge);
                return Re.delete(X), Re;
              });
            }, dd));
        },
        { root: i, rootMargin: ud, threshold: 0 }
      );
      le.current = ne;
      for (const te of ie.current.values())
        try {
          ne.observe(te);
        } catch {
        }
      return () => {
        ne.disconnect(), le.current === ne && (le.current = null);
        for (const te of B.values()) clearTimeout(te);
        B.clear();
      };
    }, [i]), D(() => {
      if (typeof IntersectionObserver > "u") return;
      const B = new IntersectionObserver(
        (ne) => {
          Z((te) => {
            let se = null;
            for (const be of ne) {
              const X = un(be.target);
              !Number.isFinite(X) || be.isIntersecting === te.has(X) || (se = se || new Set(te), be.isIntersecting ? se.add(X) : se.delete(X));
            }
            return se || te;
          });
        },
        { root: i, rootMargin: fd, threshold: 0 }
      );
      we.current = B;
      for (const ne of ie.current.values())
        try {
          B.observe(ne);
        } catch {
        }
      return () => {
        B.disconnect(), we.current === B && (we.current = null);
      };
    }, [i]);
    const Ee = !!i && typeof IntersectionObserver < "u";
    Ne(() => {
      H(0), oe(""), ye(/* @__PURE__ */ new Set()), Ae(/* @__PURE__ */ new Set()), fe(/* @__PURE__ */ new Map()), ie.current.clear();
      const B = $.current;
      for (const ne of B.values()) clearTimeout(ne);
      B.clear(), h == null || h(0, t);
    }, [R, h, t]);
    const de = N(
      (B) => {
        if (L.current !== R) return;
        const ne = B.numPages;
        H(ne), oe(""), h == null || h(ne, t), m == null || m({ numPages: ne, pane: t }), f && typeof B.getPage == "function" && f(B, t), d && typeof B.getOutline == "function" && Hl(B).then((te) => {
          L.current === R && d(te, t);
        }, () => {
        });
      },
      [R, m, d, f, h, t]
    ), _e = N(
      (B) => {
        if (L.current !== R) return;
        const ne = (B == null ? void 0 : B.message) || "PDF 解析失败";
        oe(ne), H(0), h == null || h(0, t), g == null || g(B, t);
      },
      [R, g, h, t]
    ), Le = V(
      () => W > 0 ? Array.from({ length: W }, (B, ne) => ne + 1) : [],
      [W]
    );
    D(() => {
      typeof IntersectionObserver < "u" || Ae(new Set(Le));
    }, [Le]);
    const rt = V(
      () => Tt(y, S, t),
      [y, S, t]
    ), pt = V(() => {
      const B = /* @__PURE__ */ new Map();
      for (const ne of w) {
        const te = Tt(ne, S, t);
        if (!te) continue;
        const se = B.get(te.box.page) || [];
        se.push(te), B.set(te.box.page, se);
      }
      return B;
    }, [t, S, w]), gt = V(() => {
      const B = /* @__PURE__ */ new Set();
      if (!b) return B;
      for (const [ne, te] of pt)
        te.some((se) => se.itemId === b) && B.add(ne);
      return B;
    }, [b, pt]), Xt = V(() => {
      if (W === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(Le);
      if (ve.size === 0) {
        const te = Math.min(W, Rn * 2 + 1);
        return new Set(Array.from({ length: te }, (se, be) => be + 1));
      }
      const ne = /* @__PURE__ */ new Set();
      for (const te of ve)
        for (let se = -Rn; se <= Rn; se++) {
          const be = te + se;
          be >= 1 && be <= W && ne.add(be);
        }
      return ne;
    }, [W, Le, i, a, ve]), bt = !n || !!E || !!Y, Yt = n && (E || Y) || s;
    return /* @__PURE__ */ x(
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
          A ? /* @__PURE__ */ x("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: A })
          ] }) : null,
          bt && !I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: Yt }) : null,
          I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          C && !E ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            ri,
            {
              file: C,
              loading: null,
              error: null,
              options: G,
              onLoadSuccess: de,
              onLoadError: _e,
              className: "reader-react-pdf-document",
              children: Le.map((B) => {
                if (Xt.has(B))
                  return /* @__PURE__ */ p(
                    sd,
                    {
                      pane: t,
                      pageNumber: B,
                      width: pe,
                      devicePixelRatio: J,
                      active: ze.has(B),
                      textLayer: !Ee || F.has(B),
                      syncedMinHeight: (l == null ? void 0 : l.get(B)) || 0,
                      onMetrics: u,
                      cachedAspect: ce.get(B),
                      onAspectChange: q,
                      sentinelRef: ke(B),
                      regionHighlight: (rt == null ? void 0 : rt.box.page) === B ? rt : null,
                      regionTargets: pt.get(B),
                      hoveredRegionId: b && gt.has(B) ? b : null,
                      onHoverRegion: v,
                      liveTranslationLayout: k == null ? void 0 : k.layoutByPage.get(B - 1),
                      liveTranslationPage: k == null ? void 0 : k.pagesByPage.get(B - 1),
                      showLiveTranslation: T,
                      liveTranslationMissing: fl(k, B - 1)
                    },
                    `${t}-${B}`
                  );
                const te = ce.get(B) ?? Ma, se = Math.max(120, Math.floor(pe * te)), be = Math.max(se, Math.ceil((l == null ? void 0 : l.get(B)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: ke(B),
                    [Te]: B,
                    [Ie]: t,
                    [Qn]: se,
                    className: `${er} is-placeholder`,
                    style: {
                      width: pe,
                      height: be,
                      minHeight: be
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: cn,
                        style: { width: pe, height: se },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${B}`
                );
              })
            },
            R
          ) }) : null
        ]
      }
    );
  }
), Yr = Vt(pd), gd = 2e3, bd = 6, yd = 500, Zr = "reader-react-resizing";
function vd(e, t) {
  const n = M(null), r = M(null);
  Ne(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const v = wd(e), k = zt(e, v);
      if (!k) return;
      s = { pane: v, progress: k, started: performance.now() };
    }
    const { pane: i, progress: c, started: l } = s;
    let u = 0, m = null, d = e.scrollHeight, f = d, g = 0, h = l;
    const y = /* @__PURE__ */ new WeakMap(), w = typeof ResizeObserver > "u" ? null : new ResizeObserver((v) => {
      let k = !1;
      for (const T of v) {
        const A = Math.round(T.contentRect.height);
        y.has(T.target) && y.get(T.target) !== A && (k = !0), y.set(T.target, A);
      }
      k && Rt(e, c, "auto", i);
    }), S = () => {
      var v;
      m && clearTimeout(m), cancelAnimationFrame(u), w == null || w.disconnect(), e.classList.remove(Zr);
      for (const k of Qr) e.removeEventListener(k, S);
      ((v = r.current) == null ? void 0 : v.stop) === S && (r.current = null);
    }, b = () => {
      Rt(e, c, "auto", i);
      const v = e.scrollHeight;
      g = v === f ? g + 1 : 0, f = v;
      const k = performance.now() - h;
      g >= bd && (v !== d || k > yd) || k > gd ? S() : u = requestAnimationFrame(b);
    };
    for (const v of Qr) e.addEventListener(v, S, { passive: !0 });
    for (const v of Array.from(e.children)) w == null || w.observe(v);
    e.classList.add(Zr), r.current = { ...s, stop: S }, m = setTimeout(() => {
      m = null, h = performance.now(), d = e.scrollHeight, f = d, g = 0, u = requestAnimationFrame(b);
    }, aa);
  }, [e, t]), D(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function wd(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Te}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(Ie) || null;
  }
  return null;
}
const Qr = ["wheel", "touchstart", "keydown", "pointerdown"];
function Sd(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function kd(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(pn)) && ((n = e.hasAttribute) != null && n.call(e, Ie)));
}
function Id(e, t) {
  D(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!kd(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${pn}[${Ie}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const c = Sd(a, i);
        if (c === null || Math.abs(i.scrollLeft - c) < 1) continue;
        const l = i.scrollLeft;
        i.scrollLeft = c, Math.abs(i.scrollLeft - l) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function Ed(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), c = t - i, l = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: c * l };
}
function Td(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const eo = 12;
function ar(e) {
  return Array.from(e.querySelectorAll(`.${pn}[${Ie}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function Rd(e) {
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
function Pd(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function Md(e, t) {
  return e ? ar(e).find((n) => n.getAttribute(Ie) === t) ?? null : null;
}
function _d({ shellEl: e }) {
  const [t, n] = P([]), r = M(0), o = N(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = Rd(e);
      n((i) => Pd(i, s) ? i : s);
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
  return a.length ? /* @__PURE__ */ p("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ p(Nd, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function Nd({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - eo * 2), r = Ed(e, n), o = M(null);
  if (!r) return null;
  const a = (d) => {
    const f = Md(t, e.pane);
    f && (f.scrollLeft = d);
  }, s = (d) => {
    var f, g;
    d.button === 0 && (d.preventDefault(), d.stopPropagation(), (g = (f = d.currentTarget).setPointerCapture) == null || g.call(f, d.pointerId), o.current = { startX: d.clientX, startScroll: e.scrollLeft, pointerId: d.pointerId });
  }, i = (d) => {
    const f = o.current;
    !f || f.pointerId !== d.pointerId || a(f.startScroll + Td(e, n, r.size, d.clientX - f.startX));
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
function xd({ compare: e, onDone: t }) {
  return /* @__PURE__ */ x("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ p("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ p("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ p("li", { children: /* @__PURE__ */ x(
        re,
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
    e.compared ? /* @__PURE__ */ x("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ x(
        re,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ p(xs, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ x(
        re,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ p(Ls, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function to({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = Ad(t), a = [e === "compare" ? "对比" : "正在读", r, _a(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ x("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function Ld({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = P({ source: null, translated: null });
  return Ne(() => {
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
  }, [e]), /* @__PURE__ */ x("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(to, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(to, { role: "reading", ...n }) }) : null
  ] });
}
const Cd = () => () => {
}, no = () => null;
function Dd({
  mode: e,
  compareMode: t,
  showSource: n,
  showTranslated: r,
  markdownSplit: o,
  overlayOnSource: a = !1
}) {
  const s = o && e === "compare";
  return {
    mode: s ? "source" : e,
    compareMode: t && !o,
    showSource: s ? !0 : n,
    showTranslated: s ? !1 : r
  };
}
function $d(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function Od(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function zd(e) {
  const t = Ge(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, m = e.bindShell ?? (t == null ? void 0 : t.bindShell), d = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, f = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Jt, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, w = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, b = (t == null ? void 0 : t.compareVersion) ?? null, v = (b == null ? void 0 : b.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", k = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", T = b ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, A = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, O = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), z = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), _ = t == null ? void 0 : t.onPdfOutline, I = t == null ? void 0 : t.onPdfDocument, E = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), R = e.regions ?? (t == null ? void 0 : t.regions) ?? [], L = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), C = (t == null ? void 0 : t.regionHover) ?? null, [W, H] = P(null), Y = hn(
    C ? C.subscribe : Cd,
    C ? () => C.get().itemId : no,
    C ? () => C.get().itemId : no
  ), oe = C ? Y : W, Q = N((K) => {
    C ? C.set(K, "pdf") : H(K);
  }, [C]), ae = Dd({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), U = Number.isFinite(g) && g > 0 ? $d(
    g,
    n || r,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return vd(d, U), Id(d, ae.compareMode), /* @__PURE__ */ x(
    "div",
    {
      ref: m,
      className: Qo,
      "data-reader-region-count": R.length,
      "data-reader-structured-region-count": R.filter(ks).length,
      "data-reader-metadata-ready": L ? "true" : "false",
      children: [
        /* @__PURE__ */ x(
          "main",
          {
            className: `${Zo} reader-mode-${ae.mode}`,
            "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              y ? /* @__PURE__ */ p(
                Yr,
                {
                  pane: "source",
                  url: v,
                  preloadedFile: T,
                  userZoom: f,
                  visible: ae.showSource,
                  scrollRoot: d,
                  pageWidthOverride: U,
                  rowHeights: ae.compareMode ? h : void 0,
                  onMetrics: O,
                  emptyLabel: S ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: z,
                  onOutline: b ? void 0 : _,
                  onDocument: b ? void 0 : I,
                  activeRegion: E,
                  regions: (b == null ? void 0 : b.regions) ?? R,
                  readerMetadata: L,
                  hoveredRegionId: oe,
                  onHoverRegion: Q,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? Od(o) : "",
                  paneAction: u && ae.showTranslated ? /* @__PURE__ */ x(xe, { children: [
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
              w ? /* @__PURE__ */ p(
                Yr,
                {
                  pane: "translated",
                  url: k,
                  preloadedFile: A,
                  userZoom: f,
                  visible: ae.showTranslated,
                  scrollRoot: d,
                  pageWidthOverride: U,
                  rowHeights: ae.compareMode ? h : void 0,
                  onMetrics: O,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: z,
                  onOutline: _,
                  onDocument: I,
                  activeRegion: E,
                  regions: R,
                  readerMetadata: L,
                  hoveredRegionId: oe,
                  onHoverRegion: Q,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ p(_d, { shellEl: d }),
        b ? /* @__PURE__ */ p(Ld, { shellEl: d, left: b.left, right: b.right }) : null
      ]
    }
  );
}
const Fd = [
  { id: "source", label: "原文", Icon: Wo },
  { id: "compare", label: "对照", Icon: Ko },
  { id: "translated", label: "译文", Icon: Vo }
];
function Bd(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function jd(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function Hd(e) {
  const t = Ge(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? Bd(a.state) : "";
  return /* @__PURE__ */ x("header", { className: "reader-workspace-bar", children: [
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
    /* @__PURE__ */ x("div", { className: "reader-workspace-center", children: [
      /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Fd.map(({ id: l, label: u, Icon: m }) => {
        const d = n === l, f = jd({
          id: l,
          documentReady: r,
          sourceViewOnly: i,
          liveTranslationAvailable: !!a
        });
        return /* @__PURE__ */ x(
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
      a ? /* @__PURE__ */ x("div", { className: "reader-live-strip", children: [
        /* @__PURE__ */ x(
          "button",
          {
            type: "button",
            className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
            "aria-pressed": a.visible,
            "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
            title: a.state.error || `${c}，${a.visible ? "点一下看原文" : "点一下叠上译文"}`,
            onClick: a.onToggle,
            children: [
              /* @__PURE__ */ p(Cs, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: c })
            ]
          }
        ),
        a.latestPage && a.onJumpToLatest && a.latestPage !== a.currentPage ? /* @__PURE__ */ x(
          re,
          {
            className: "reader-live-translation-toggle reader-live-jump",
            "aria-label": `跳到最新译好的第 ${a.latestPage} 页`,
            title: `跳到最新译好的第 ${a.latestPage} 页`,
            onClick: a.onJumpToLatest,
            children: [
              /* @__PURE__ */ p(Ds, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "跳到最新" })
            ]
          }
        ) : null
      ] }) : s ? /* @__PURE__ */ p("div", { className: "reader-live-strip", children: /* @__PURE__ */ x(
        re,
        {
          className: "reader-live-translation-toggle is-done",
          title: "翻译完成，左右对照看最终译文",
          onClick: s.onOpenCompare,
          children: [
            /* @__PURE__ */ p($s, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
          ]
        }
      ) }) : null
    ] })
  ] });
}
const Na = [];
function Ud() {
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
function Wd(e, t) {
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
function Kd(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.pageLayer ? [{ id: t, render: n.pageLayer }] : []);
}
function Vd(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.menuSection ? [{ id: t, render: n.menuSection }] : []);
}
function qd(e) {
  var t;
  return ((t = e.find(({ contribution: n }) => n.takesPointer)) == null ? void 0 : t.id) ?? null;
}
function Jd(e) {
  const t = e.flatMap(({ id: n, contribution: r }) => r.textMarks ? [{ id: n, marks: r.textMarks }] : []);
  return t.length ? (n) => t.flatMap(({ id: r, marks: o }) => {
    try {
      return [...o(n)];
    } catch (a) {
      return console.error(`[reader] 扩展 ${r} 的文字层标记出错`, a), [];
    }
  }) : null;
}
function Gd(e) {
  return e.reduce((t, { contribution: n }) => Math.max(t, n.reserveRight || 0), 0);
}
function Xd(e) {
  for (const { contribution: t } of e) if (t.comparedDocument) return t.comparedDocument;
  return null;
}
function Yd(e) {
  return e.flatMap(({ title: t, contribution: n }) => {
    var r;
    return (r = n.shortcuts) != null && r.length ? [{ title: t, items: n.shortcuts }] : [];
  });
}
const bn = qt(null), Aa = qt(null);
function Zd({ api: e, store: t, children: n }) {
  const r = V(() => ({ api: e, store: t }), [e, t]);
  return /* @__PURE__ */ p(bn.Provider, { value: r, children: n });
}
function Gt() {
  const e = st(bn);
  if (!e) throw new Error("useReaderApi 要在 ReaderExtensionsProvider 里面用");
  return e.api;
}
const Qd = () => () => {
}, ro = () => Na;
function ef(e) {
  return hn(e.subscribe, e.getSnapshot, e.getSnapshot);
}
function xa() {
  var t;
  const e = (t = st(bn)) == null ? void 0 : t.store;
  return hn((e == null ? void 0 : e.subscribe) ?? Qd, (e == null ? void 0 : e.getSnapshot) ?? ro, (e == null ? void 0 : e.getSnapshot) ?? ro);
}
function yn(e) {
  var a;
  const t = (a = st(bn)) == null ? void 0 : a.store, n = st(Aa);
  if (!n) throw new Error("useReaderContribution 只能在扩展组件里用");
  const { id: r, title: o } = n;
  D(() => {
    t == null || t.set(r, o, e);
  }, [t, r, o, e]), D(() => () => t == null ? void 0 : t.remove(r), [t, r]);
}
class tf extends ds {
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
const nf = Vt(function({ extensions: t }) {
  return /* @__PURE__ */ p(xe, { children: t.map(({ id: n, title: r, Component: o }) => /* @__PURE__ */ p(tf, { id: n, children: /* @__PURE__ */ p(rf, { id: n, title: r, children: /* @__PURE__ */ p(o, {}) }) }, n)) });
});
function rf({ id: e, title: t, children: n }) {
  const r = V(() => ({ id: e, title: t }), [e, t]);
  return /* @__PURE__ */ p(Aa.Provider, { value: r, children: n });
}
function of({
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
      re,
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
  const s = M(null), [i, c] = P({ status: "loading", cssHeight: 0 }), l = `${t}:${n.left}:${n.top}:${n.width}:${n.height}:${Math.round(r)}`;
  return D(() => {
    let u = !1, m = null;
    return c((d) => ({ status: "loading", cssHeight: d.cssHeight })), (async () => {
      try {
        const d = await e.getPage(t);
        if (u) return;
        const f = d.getViewport({ scale: 1 }), g = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), h = Ca(n, f, r, g), y = s.current, w = y == null ? void 0 : y.getContext("2d");
        if (!y || !w) return;
        y.width = h.canvasWidth, y.height = h.canvasHeight, c({ status: "loading", cssHeight: h.cssHeight });
        const S = d.getViewport({ scale: h.scale, offsetX: h.offsetX, offsetY: h.offsetY }), b = d.render({ canvasContext: w, viewport: S });
        m = b, await b.promise, u || c({ status: "ready", cssHeight: h.cssHeight });
      } catch (d) {
        !u && (d == null ? void 0 : d.name) !== "RenderingCancelledException" && c((f) => ({ status: "error", cssHeight: f.cssHeight }));
      }
    })(), () => {
      u = !0, m == null || m.cancel();
    };
  }, [e, l]), /* @__PURE__ */ x(
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
const af = 1600, sr = { left: 0, top: 0, width: 1, height: 1 };
function $a(e) {
  return new Promise((t, n) => {
    e.toBlob((r) => r ? t(r) : n(new Error("截图没出来")), "image/png");
  });
}
function sf(e, t, n) {
  if (e.width <= 0 || e.height <= 0) return null;
  const r = (l) => Math.min(1, Math.max(0, (l - e.left) / e.width)), o = (l) => Math.min(1, Math.max(0, (l - e.top) / e.height)), a = Math.min(r(t.x), r(n.x)), s = Math.max(r(t.x), r(n.x)), i = Math.min(o(t.y), o(n.y)), c = Math.max(o(t.y), o(n.y));
  return s - a < 0.02 || c - i < 0.02 ? null : { left: a, top: i, width: s - a, height: c - i };
}
async function cf(e, t, n = sr, r = af) {
  const o = await e.getPage(t), a = Ca(n, o.getViewport({ scale: 1 }), r, 1), s = document.createElement("canvas");
  s.width = a.canvasWidth, s.height = a.canvasHeight;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.fillStyle = "#fff", i.fillRect(0, 0, s.width, s.height), await o.render({ canvasContext: i, viewport: o.getViewport({ scale: a.scale, offsetX: a.offsetX, offsetY: a.offsetY }) }).promise, $a(s);
}
async function lf(e, t = sr) {
  const n = Math.round(t.left * e.width), r = Math.round(t.top * e.height), o = Math.max(1, Math.round(t.width * e.width)), a = Math.max(1, Math.round(t.height * e.height)), s = document.createElement("canvas");
  s.width = o, s.height = a;
  const i = s.getContext("2d");
  if (!i) throw new Error("截图没出来");
  return i.drawImage(e, n, r, o, a, 0, 0, o, a), $a(s);
}
function uf(e, t) {
  return t.left === 0 && t.top === 0 && t.width === 1 && t.height === 1 ? `第${e}页.png` : `第${e}页-截图.png`;
}
const df = 4e3;
function ff(e, t, n) {
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
  const t = e.getRangeAt(0), n = t.startContainer, r = ((s = (a = n.nodeType === 1 ? n : n.parentElement) == null ? void 0 : a.closest) == null ? void 0 : s.call(a, `[${Te}]`)) ?? null;
  return r ? { text: `${e}`.replace(/\s+\n/g, `
`).trim().slice(0, df), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function mf(e, t, n, r, o) {
  let a = null, s = 0.15;
  for (const i of e) {
    const c = Tt(i, t, n);
    if (!c || c.box.page !== r) continue;
    const l = dt(c, 1, 1);
    if (!l) continue;
    const u = o.y < l.top ? l.top - o.y : o.y > l.top + l.height ? o.y - l.top - l.height : 0, m = o.x < l.left ? l.left - o.x : o.x > l.left + l.width ? o.x - l.left - l.width : 0, d = u + m * 0.25;
    (d < s || d === 0 && a === null) && (a = i, s = d);
  }
  return a;
}
function hf({
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
  const l = e.getAttribute(Ie) === "source" ? "source" : "translated", u = e.getBoundingClientRect(), m = u.width > 0 && u.height > 0 ? { x: Math.min(1, Math.max(0, (t - u.left) / u.width)), y: Math.min(1, Math.max(0, (n - u.top) / u.height)) } : null, f = (r ? a.find((g) => g.itemId === r) ?? null : null) ?? (m ? mf(a, i, l, c, m) : null);
  return {
    pane: l,
    page: c,
    itemId: (f == null ? void 0 : f.itemId) ?? null,
    selection: o,
    sourceText: `${(f == null ? void 0 : f.source.text) || (f == null ? void 0 : f.markdown) || ""}`.trim(),
    translatedText: `${(f == null ? void 0 : f.translatedBlockText) || (f == null ? void 0 : f.translated.text) || ""}`.trim(),
    section: ff(s, a, (f == null ? void 0 : f.source.page) ?? c),
    point: m
  };
}
function pf(e, t, n = document) {
  for (const r of n.elementsFromPoint(e, t)) {
    const o = r.closest(`[${Te}]`);
    if (!o) continue;
    const a = Number(o.getAttribute(Te)) || 0, i = (o.closest(`[${Ie}]`) ?? o).getAttribute(Ie) === "translated" ? "translated" : "source", c = o.querySelector("canvas");
    if (a && c) return { page: a, pane: i, canvas: c, slot: o };
  }
  return null;
}
function gf({ onDone: e, onCancel: t }) {
  const [n, r] = P(null), o = M(null), a = M(null);
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
      return pf(c, l);
    } finally {
      u && (u.style.pointerEvents = "");
    }
  }, i = n ? { left: Math.min(n.from.x, n.to.x), top: Math.min(n.from.y, n.to.y), width: Math.abs(n.to.x - n.from.x), height: Math.abs(n.to.y - n.from.y) } : null;
  return /* @__PURE__ */ x(
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
        const m = sf(l.canvas.getBoundingClientRect(), u, { x: c.clientX, y: c.clientY });
        m && e({ page: l.page, pane: l.pane, region: m, canvas: l.canvas, point: { x: u.x, y: u.y, target: l.slot } });
      },
      children: [
        /* @__PURE__ */ p("p", { className: "reader-ask-crop-hint", children: "在书页上拖出一块，松开就带进提问 · Esc 取消" }),
        i ? /* @__PURE__ */ p("div", { className: "reader-ask-crop-box", style: i }) : null
      ]
    }
  );
}
const so = 5e4, bf = 2e4;
function Pn(e, t) {
  const n = `${e || ""}`;
  return n.length > t ? n.slice(0, t) : n;
}
function gg(e, t) {
  const n = { page: e.page, pane: e.pane, item_ids: e.itemId ? [e.itemId] : [] };
  return t.documentId && (n.document_id = t.documentId), t.jobId && (n.job_id = t.jobId), t.versionId && (n.translation_version = t.versionId), e.selection && (n.selected_text = e.selection), e.section && (n.section = e.section), e.sourceText && (n.source_text = e.sourceText), e.translatedText && (n.translated_text = e.translatedText), n;
}
function yf(e, t = null) {
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
function vf(e, t) {
  if (!(e != null && e.page)) return null;
  const r = [!!(e.document_id && t && e.document_id !== t) ? "别的书" : "", `第 ${e.page} 页`, e.section || ""].filter(Boolean).join(" · ");
  return { page: e.page, label: r, data: e };
}
function wf(e) {
  var r;
  const t = e == null ? void 0 : e.data, n = ((r = t == null ? void 0 : t.retainpdf) == null ? void 0 : r.selection) ?? (t && typeof t.page == "number" ? t : null);
  return n && n.page ? n : null;
}
function bg(e, t) {
  var r;
  const n = wf(e);
  return !n || n.document_id && t && n.document_id !== t ? null : ((r = n.item_ids) == null ? void 0 : r[0]) || null;
}
function yg(e) {
  var o, a;
  const t = e.selection.trim();
  return t && !t.endsWith("…") ? t : ((a = (o = [...e.text.matchAll(/```[ \t]*(译文|translation|zh|zh-CN)[ \t]*\n([\s\S]*?)\n```/gi)].at(-1)) == null ? void 0 : o[2]) == null ? void 0 : a.trim()) || null;
}
function Sf(e, t) {
  var o;
  if (!t) return;
  const n = e.findIndex((a) => a.message_id === t);
  if (n < 0) return;
  const r = ((o = e[n + 1]) == null ? void 0 : o.role) === "assistant" ? kf(e[n + 1].text) : "";
  return { question: e[n].text, ...r ? { answer: r } : {} };
}
function kf(e, t = 160) {
  const n = e.replace(/```[\s\S]*?(```|$)/g, " ").replace(/\$\$[\s\S]*?\$\$/g, " … ").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim(), r = [...n];
  return r.length > t ? `${r.slice(0, t).join("")}…` : n;
}
function If(e, t = [], n = "") {
  const r = new Set(t.map((o) => o.covers_to_seq));
  return e.filter((o) => !o.superseded_at).map((o) => {
    const a = r.has(o.seq) ? { compactedBefore: !0 } : {};
    if (o.role === "user") {
      const s = Sf(e, o.edited_from);
      return {
        id: o.message_id,
        role: "user",
        text: o.text,
        context: vf(o.selection, n),
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
function Ef(e, t, n, r) {
  var l, u, m;
  const o = ((m = (u = (l = e.context) == null ? void 0 : l.meta) == null ? void 0 : u.retainpdf) == null ? void 0 : m.selection) ?? null, a = (o == null ? void 0 : o.document_id) || t || null, s = e.sessionId && e.sessionId.length <= 256 ? e.sessionId : null, i = { agent_id: e.agentId || null, document_id: a, session_id: s }, c = e.answer.usage && JSON.stringify(e.answer.usage).length <= 4096 ? e.answer.usage : null;
  return [
    { ...i, role: "user", text: Pn(e.question.text, so), selection: o, client_message_id: `${n}-q`, ...r ? { edited_from: r } : {} },
    {
      ...i,
      role: "assistant",
      text: Pn(e.answer.text, so),
      thought: e.answer.thought ? Pn(e.answer.thought, bf) : null,
      usage: c,
      client_message_id: `${n}-a`,
      memory_ids: e.memoryIds.slice(0, 10)
    }
  ];
}
function Tf(e) {
  return new Date(e - 2e3).toISOString().replace(/\.\d+Z$/, "Z");
}
function Rf(e, t) {
  return e.filter((n) => n.origin === "agent" && n.status === "active" && !t.has(n.memory_id)).map((n) => ({ id: n.memory_id, scope: n.scope, text: n.text, category: n.category, documentId: n.document_id, created: !0 }));
}
function Pf(e, t) {
  if (t.id && e.some((r) => r.message_id === t.id)) return t.id;
  const n = t.text.trim();
  for (let r = e.length - 1; r >= 0; r -= 1) {
    const o = e[r];
    if (o.role === "assistant" && o.text.trim() === n) return o.message_id;
  }
  return null;
}
function Mf(e) {
  const t = e.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().split(new RegExp("(?<=[。！？.!?])"))[0] || "";
  return `深挖：${[...t].slice(0, 30).join("")}${[...t].length > 30 ? "…" : ""}`;
}
const _f = 50, Mn = { conversation: null, main: null, records: [], compactions: [], hasMore: !1, key: "local", initial: [] };
function Nf() {
  var t, n;
  return `c-${((n = (t = globalThis.crypto) == null ? void 0 : t.randomUUID) == null ? void 0 : n.call(t)) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}
function io(e) {
  var n, r, o, a;
  const t = e;
  return `${(t == null ? void 0 : t.reason) || ((n = t == null ? void 0 : t.details) == null ? void 0 : n.reason) || ((a = (o = (r = t == null ? void 0 : t.payload) == null ? void 0 : r.error) == null ? void 0 : o.details) == null ? void 0 : a.reason) || (e instanceof Error ? e.message : "")}`;
}
function Af({ port: e, book: t, onAppended: n }) {
  const r = (e == null ? void 0 : e.conversations) ?? null, o = (e == null ? void 0 : e.memories) ?? null, [a, s] = P(!1), [i, c] = P(Mn), [l, u] = P(!1), [m, d] = P(""), [f, g] = P("idle"), [h, y] = P(null), [w, S] = P(() => /* @__PURE__ */ new Map()), b = M(/* @__PURE__ */ new Set()), v = M(/* @__PURE__ */ new Map()), k = (j) => {
    if (!j) return null;
    const U = v.current.get(j);
    return U || (T.current.records.some((K) => K.message_id === j) ? j : null);
  }, T = M(i);
  T.current = i;
  const A = M(t);
  A.current = t;
  const O = M(0), z = N(async (j, U, K, he = []) => {
    if (!r) return;
    const J = await r.messages(j.conversation_id, { limit: _f, ...K ? { beforeSeq: K } : {} }), G = [...J.messages, ...he];
    O.current += 1, c({
      conversation: j,
      main: U ?? j,
      records: G,
      compactions: J.compactions || [],
      hasMore: J.has_more,
      key: `${j.conversation_id}:${O.current}`,
      initial: If(G, J.compactions || [], A.current.documentId)
    });
  }, [r]), _ = N(async () => {
    var j;
    if (s(!0), !(!r || ((j = T.current.conversation) == null ? void 0 : j.kind) === "main")) {
      u(!0), d("");
      try {
        const U = await r.main(A.current.documentId || void 0);
        await z(U, U);
      } catch (U) {
        d(U instanceof Error ? U.message : String(U));
      } finally {
        u(!1);
      }
    }
  }, [r, z]), I = N((j) => {
    y(j), _();
  }, [_]), E = M(t.documentId);
  D(() => {
    E.current !== t.documentId && (E.current = t.documentId, T.current = Mn, c(Mn), y(null), S(/* @__PURE__ */ new Map()), v.current.clear(), a && _());
  }, [t.documentId, a, _]);
  const R = N(async () => {
    const j = T.current, U = j.records[0];
    if (!(!j.conversation || !U || !j.hasMore)) {
      u(!0);
      try {
        await z(j.conversation, j.main, U.seq, j.records);
      } finally {
        u(!1);
      }
    }
  }, [z]), L = N(async (j) => {
    const K = T.current.conversation;
    if (!r || !K) return;
    for (const fe of j.memoryIds) b.current.add(fe);
    let he = j.memoryIds;
    if (!he.length && o && j.startedAt) {
      const fe = Rf(
        await o.list({ source_conversation_id: K.conversation_id, created_after: Tf(j.startedAt) }).catch(() => []),
        b.current
      );
      for (const ye of fe) b.current.add(ye.id);
      he = fe.map((ye) => ye.id);
      const ve = j.answerId;
      fe.length && ve && S((ye) => new Map(ye).set(ve, fe));
    }
    const J = Ef({ ...j, memoryIds: he }, A.current.documentId, Nf(), k(j.editedFrom));
    let G;
    try {
      G = await r.append(K.conversation_id, J);
    } catch (fe) {
      if (K.kind !== "side" || !/ask_conversation_not_open/.test(io(fe))) throw fe;
      await r.reopen(K.conversation_id), G = await r.append(K.conversation_id, J);
    }
    const [pe, ce] = G.messages;
    j.questionId && pe && v.current.set(j.questionId, pe.message_id), j.answerId && ce && v.current.set(j.answerId, ce.message_id), c((fe) => {
      var ve;
      return ((ve = fe.conversation) == null ? void 0 : ve.conversation_id) === K.conversation_id ? { ...fe, conversation: G.conversation, records: [...fe.records, ...G.messages] } : fe;
    }), n == null || n(G.messages), G.compaction_due && K.kind === "main" && r.compact(K.conversation_id).catch(() => {
    });
  }, [r, o, n]), C = N(async (j) => {
    const U = T.current.conversation, K = k(j);
    if (!r || !U || !K) return null;
    try {
      await r.supersede(U.conversation_id, K);
    } catch (G) {
      if (!/ask_message_superseded/.test(io(G))) throw G;
    }
    const he = T.current.records.find((G) => G.message_id === K), J = T.current.records.findIndex((G) => G.message_id === K);
    return c((G) => ({ ...G, records: G.records.map((pe, ce) => ce >= J && J >= 0 && !pe.superseded_at ? { ...pe, superseded_at: "now" } : pe) })), (he == null ? void 0 : he.selection) ?? null;
  }, [r]), W = N((j) => {
    L(j).catch((U) => d(`这一轮没存上：${U instanceof Error ? U.message : String(U)}`));
  }, [L]), H = N(async (j) => {
    var he;
    const U = T.current, K = U.main;
    if (!(!r || !K || ((he = U.conversation) == null ? void 0 : he.kind) !== "main")) {
      d("");
      try {
        const J = Pf(U.records, j), G = await r.fork({
          parent_id: K.conversation_id,
          ...J ? { forked_from_message_id: J } : {},
          title: Mf(j.text),
          ...A.current.documentId ? { document_id: A.current.documentId } : {}
        });
        await z(G, K);
      } catch (J) {
        d(`开不了副对话：${J instanceof Error ? J.message : String(J)}`);
      }
    }
  }, [r, z]), Y = N(async (j) => {
    const U = T.current.main;
    if (r)
      try {
        await z(await r.get(j), U);
      } catch (K) {
        d(`打不开副对话：${K instanceof Error ? K.message : String(K)}`);
      }
  }, [r, z]), oe = N(async () => {
    const j = T.current.main;
    j && await z(j, j).catch(() => {
    });
  }, [z]), Q = N(async () => {
    const j = T.current.conversation;
    if (!(!r || (j == null ? void 0 : j.kind) !== "side")) {
      g("busy");
      try {
        await r.close(j.conversation_id), g("idle"), await oe();
      } catch {
        g("failed");
      }
    }
  }, [r, oe]), ae = N(async () => {
    const j = T.current.main;
    if (!r || !j) return;
    await r.archive(j.conversation_id);
    const U = await r.main(A.current.documentId || void 0);
    await z(U, U);
  }, [r, z]);
  return {
    visible: a,
    view: i,
    loading: l,
    error: m,
    pending: h,
    setPending: y,
    closingSide: f,
    notices: w,
    persistent: !!r,
    openMain: _,
    ask: I,
    close: N(() => s(!1), []),
    loadEarlier: R,
    onTurn: W,
    rewrite: C,
    fork: H,
    openSide: Y,
    backToMain: oe,
    closeSide: Q,
    archiveMain: ae,
    forgetMemory: r ? r.forgetMemory : void 0
  };
}
function co(e, t, n) {
  var c;
  const r = e.selection, o = e.page ?? (r == null ? void 0 : r.page) ?? 0;
  if (e.role !== "user" || !o) return null;
  const a = (e.pane ?? (r == null ? void 0 : r.pane)) === "source" ? "source" : "translated", s = ((c = r == null ? void 0 : r.item_ids) == null ? void 0 : c[0]) ?? null, i = yf({ item_ids: [], ...r, page: o, pane: a }, n(s, a, o));
  return { key: t, anchor: i, messageId: e.message_id, title: e.text.slice(0, 80) };
}
function xf({ port: e, documentId: t, resetKey: n, pointOf: r }) {
  const [o, a] = P([]), s = M(0), i = M(r);
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
const Lf = Fo(() => import("./ReaderAskPanel-D5JWA5rv.js"));
function Cf({
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
  visibleMode: h
}) {
  var Z;
  const y = V(() => ({ documentId: t, jobId: n, versionId: r }), [t, n, r]), w = N(($, q, ee) => {
    const ue = $ ? o.find((de) => de.itemId === $) : null, ke = ue ? Tt(ue, a, q) : null, Ee = ke && ke.box.page === ee ? dt(ke, 1, 1) : null;
    return Ee ? { x: Ee.left, y: Ee.top } : null;
  }, [o, a]), S = xf({ port: e, documentId: t, resetKey: c, pointOf: w }), b = Af({ port: e, book: y, onAppended: S.addRecords }), [v, k] = P(null), T = N(
    ($, q, ee, ue) => hf({
      pageElement: ($ == null ? void 0 : $.closest(`[${Te}]`)) ?? null,
      clientX: q,
      clientY: ee,
      itemId: i(),
      selection: ue,
      regions: o,
      bookmarks: s,
      metadata: a
    }),
    [i, o, s, a]
  ), A = N(() => {
    var q;
    const $ = ao(((q = globalThis.getSelection) == null ? void 0 : q.call(globalThis)) ?? null);
    return !$.text || !$.element || !$.rect ? null : T($.element, $.rect.left + $.rect.width / 2, $.rect.top + $.rect.height / 2, $.text);
  }, [T]), O = N(($) => {
    k(null), b.ask($);
  }, [b.ask]);
  D(() => {
    if (!e) return;
    const $ = (q) => {
      var ke;
      if (q.key !== "?" || q.metaKey || q.ctrlKey || q.altKey || q.defaultPrevented) return;
      const ee = q.target;
      if ((ke = ee == null ? void 0 : ee.closest) != null && ke.call(ee, "input, textarea, select, [contenteditable='true']")) return;
      const ue = A();
      ue && (q.preventDefault(), q.stopImmediatePropagation(), O(ue));
    };
    return window.addEventListener("keydown", $, !0), () => window.removeEventListener("keydown", $, !0);
  }, [e, A, O]);
  const z = M(""), _ = ((Z = b.pending) == null ? void 0 : Z.selection) || "";
  D(() => {
    _ && (z.current = _);
  }, [_]);
  const I = b.visible && !v, E = b.setPending;
  D(() => {
    if (!I) return;
    let $ = null;
    const q = () => {
      $ && clearTimeout($), $ = setTimeout(() => {
        const ee = A();
        ee && ee.selection !== z.current && E(ee);
      }, 250);
    };
    return document.addEventListener("selectionchange", q), () => {
      $ && clearTimeout($), document.removeEventListener("selectionchange", q);
    };
  }, [I, A, E]);
  const R = M(f);
  R.current = f;
  const L = N(async ({ page: $, pane: q, region: ee, canvas: ue }) => {
    const ke = R.current[q];
    let Ee;
    if (ke)
      Ee = await cf(ke, $, ee);
    else {
      const de = ue ?? document.querySelector(`[${Ie}="${q}"] [${Te}="${$}"] canvas`);
      if (!de) throw new Error(`第 ${$} 页还没画出来，翻到那一页再试`);
      Ee = await lf(de, ee);
    }
    return new File([Ee], uf($, ee), { type: "image/png" });
  }, []), [C, W] = P(null), H = M(b.pending);
  H.current = b.pending;
  const Y = V(() => [{
    key: "page",
    label: "带上这一页",
    title: "带上这一页的截图（问的那一页，没有就是现在读的这页）：公式、图表、表格让 AI 直接看图",
    icon: /* @__PURE__ */ p(Os, { size: 14, "aria-hidden": !0 }),
    run: () => {
      const $ = H.current, q = ($ == null ? void 0 : $.pane) || (h === "translated" ? "translated" : "source");
      return L({ page: ($ == null ? void 0 : $.page) || g() || 1, pane: q, region: sr });
    }
  }], [L, g, h]), [oe, Q] = P(!1), [ae, j] = P(""), U = N(async ($) => {
    Q(!1), j("");
    try {
      const q = await L($), ee = T($.point.target, $.point.x, $.point.y, "");
      W((ue) => ({ id: ((ue == null ? void 0 : ue.id) || 0) + 1, files: [q] })), ee ? O({ ...ee, itemId: null, sourceText: "", translatedText: "" }) : b.openMain();
    } catch (q) {
      j(q instanceof Error ? q.message : String(q));
    }
  }, [L, T, O]), K = N(() => Q(!1), []), he = N(async ($) => {
    if ($.threadId && (e != null && e.threads) && t) {
      try {
        const q = await e.threads.get(t, $.threadId);
        k({ anchor: q.anchor || $.anchor, messages: q.messages || [], mark: $ });
      } catch {
        k({ anchor: $.anchor, messages: [], mark: $ });
      }
      return;
    }
    k(null), b.openMain();
  }, [e, t, b.openMain]), J = N(($) => {
    var ue;
    if (!e) return [];
    const q = ao(((ue = globalThis.getSelection) == null ? void 0 : ue.call(globalThis)) ?? null), ee = T($.target, $.clientX, $.clientY, q.element ? q.text : "");
    return ee ? [{
      key: "ask",
      label: ee.selection ? "问这段" : "在这里提问",
      hint: ee.selection ? "?" : void 0,
      onSelect: () => O(ee)
    }, {
      key: "crop",
      label: "截一块问",
      onSelect: () => {
        j(""), Q(!0);
      }
    }] : [];
  }, [e, T, O]), G = v ? {
    anchor: v.anchor,
    messages: v.messages,
    onClose: () => k(null),
    onDelete: e != null && e.threads && v.mark.threadId ? () => {
      e.threads.remove(t, v.mark.threadId).catch(() => {
      }), S.removeMark(v.mark.key), k(null);
    } : void 0
  } : null, pe = V(() => m ? ($, q) => {
    m($, q ?? void 0), requestAnimationFrame(() => d($, "translated"));
  } : null, [m, d]), ce = N(($) => va(o, $), [o]), [fe, ve] = P(0), ye = N(({ mode: $, width: q }) => {
    const ee = globalThis.innerWidth || 0;
    ve($ === "dock" && ee - q >= 480 ? Math.round(q) : 0);
  }, []), ze = !b.persistent || !!b.view.conversation || !!b.error, Ae = e && (b.visible && ze || v) ? /* @__PURE__ */ p(zo, { fallback: null, children: /* @__PURE__ */ p(
    Lf,
    {
      port: e,
      jobId: n,
      book: y,
      ask: b,
      legacy: G,
      onShowSelection: ({ page: $, pane: q }) => l($, q),
      onJumpToPage: ($) => l($),
      pageCount: u,
      onLayout: ye,
      onEditBlock: pe,
      canEditBlock: ce,
      attachTools: Y,
      attachRequest: C
    }
  ) }) : null, ie = oe || ae ? /* @__PURE__ */ x(xe, { children: [
    oe ? /* @__PURE__ */ p(gf, { onDone: ($) => void U($), onCancel: K }) : null,
    ae ? /* @__PURE__ */ x("p", { className: "reader-ask-crop-error", role: "alert", onClick: () => j(""), children: [
      "截图没成：",
      ae
    ] }) : null
  ] }) : null, le = b.visible && ze || !!v, we = b.close, F = N(() => {
    if (le) {
      k(null), we();
      return;
    }
    b.openMain();
  }, [le, we, b.openMain]);
  return { marks: S.marks, onMark: he, menuItems: J, panel: Ae, overlay: ie, cropping: oe, open: b.openMain, toggle: F, showing: le, reserveRight: le ? fe : 0, enabled: !!e };
}
const Df = [{ keys: "选字 + ?", desc: "问选中的这段" }];
function $f() {
  const e = Gt(), t = V(() => {
    try {
      return Je().ask ?? null;
    } catch {
      return null;
    }
  }, []), n = Cf({
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
    visibleMode: e.visibleMode
  }), { marks: r, onMark: o, menuItems: a, panel: s, overlay: i, cropping: c, enabled: l, toggle: u, showing: m, reserveRight: d } = n, f = V(() => l ? {
    toolbarItems: [{
      key: "ask",
      label: "提问",
      title: "提问：问整本书、翻这本书以前的对话（问某一段：书页上右键，或选字按 ?）",
      Icon: zs,
      pressed: m,
      onClick: u
    }],
    menuItems: a,
    pageLayer: r.length ? ({ page: g, height: h }) => /* @__PURE__ */ p(of, { marks: r, page: g, height: h, onOpen: o }) : void 0,
    shortcuts: Df,
    reserveRight: d,
    // 「截一块问」时占着书页上的指针：不出悬停框、不选字。
    takesPointer: c
  } : {}, [l, a, r, o, u, m, d, c]);
  return yn(f), /* @__PURE__ */ x(xe, { children: [
    s,
    i
  ] });
}
const Of = { id: "ask", title: "提问", Component: $f };
function jn() {
  try {
    return Je().translationVersions ?? null;
  } catch {
    return null;
  }
}
function zf(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function Ff(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function Bf(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function jf({ documentId: e, jobId: t }) {
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
  const s = Ff(n, t, o);
  return V(() => ({ versions: n, readingVersionId: s }), [n, s]);
}
function Hf({ documentId: e, jobId: t, versions: n, readingVersionId: r }) {
  const [o, a] = P(null), [s, i] = P(""), [c, l] = P(""), u = M(0);
  D(() => {
    u.current += 1, a(null), i(""), l("");
  }, [e, t]);
  const m = N((g) => {
    const h = jn(), y = n.find((S) => S.versionId === g);
    if (!h || !y || !e) return;
    const w = ++u.current;
    i(g), l(""), (async () => {
      const S = Je(), b = await h.resolveJob(e, g);
      if (!b) throw new Error("这一份还没有能读的译文。");
      const v = await S.loadReaderPayload(b, { includeOptionalArtifacts: !0 }), k = S.resolveReaderTranslatedPdfUrl(v.jobPayload, v.manifestPayload);
      if (!k) throw new Error("这一份没有译文 PDF。");
      return { versionId: g, name: y.name, jobId: b, url: k, regions: zf(jo(v.regionsPayload)) };
    })().then((S) => {
      w === u.current && a(S);
    }).catch((S) => {
      w === u.current && l((S == null ? void 0 : S.message) || "这一份打不开。");
    }).finally(() => {
      w === u.current && i("");
    });
  }, [e, n]), d = N(() => {
    u.current += 1, a(null), i(""), l("");
  }, []), f = N(async () => {
    var y, w;
    const g = jn();
    if (!g || !o || !e) return;
    try {
      await g.select(e, o.versionId);
    } catch (S) {
      l((S == null ? void 0 : S.message) || "换不过去，请稍后再试。");
      return;
    }
    const h = (y = globalThis.location) == null ? void 0 : y.href;
    h && ((w = globalThis.history) == null || w.replaceState(globalThis.history.state, "", Bf(h, o.jobId))), a(null);
  }, [o, e]);
  return V(() => ({
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
function Uf(e) {
  return e.available ? {
    key: "compare",
    label: "对比版本",
    title: "对比版本：左边换成这本书的另一份译文",
    Icon: Fs,
    pressed: !!(e.compared || e.loading),
    popup: (t) => /* @__PURE__ */ p(xd, { compare: e, onDone: t })
  } : null;
}
function Wf(e) {
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
function Kf() {
  var i;
  const e = Gt(), t = Hf({
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
  const s = V(() => {
    const c = Uf(t);
    return { toolbarItems: c ? [c] : [], comparedDocument: Wf(t) };
  }, [t]);
  return yn(s), null;
}
const Vf = { id: "compare", title: "对比版本", Component: Kf }, Oa = [
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
function qf(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(Hn + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(Hn + e);
    } catch {
    }
}
function Jf(e, t, n, r, o, a) {
  const s = uo * uo;
  return e.filter((i) => za(i, t, n) && i.points.some(([c, l]) => (c - r) ** 2 + ((l - o) * a) ** 2 <= s)).map((i) => i.id);
}
function za(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function Gf(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function Xf(e) {
  const [t, n] = P(null), [r, o] = P(Oa[0].key), [a, s] = P(() => fo(e)), i = M(a), c = M([]);
  D(() => {
    const h = fo(e);
    i.current = h, s(h), c.current = [];
  }, [e]);
  const l = N((h) => {
    i.current = h, s(h), qf(e, h);
  }, [e]), u = N((h) => {
    const y = i.current, w = h(y);
    w !== y && (c.current = [...c.current.slice(-49), y], l(w));
  }, [l]), m = N((h) => {
    h.points.length < 1 || u((y) => [...y, { ...h, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [u]), d = N((h) => {
    h.length && u((y) => y.filter((w) => !h.includes(w.id)));
  }, [u]), f = N((h) => {
    u((y) => y.some((w) => w.page === h) ? y.filter((w) => w.page !== h) : y);
  }, [u]), g = N(() => {
    const h = c.current.pop();
    h && l(h);
  }, [l]);
  return V(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: m, erase: d, undo: g, clearPage: f }),
    [t, r, a, m, d, g, f]
  );
}
const Yf = [
  { tool: "pen", label: "画笔", Icon: Zn },
  { tool: "highlighter", label: "荧光笔", Icon: Bs },
  { tool: "eraser", label: "橡皮", Icon: js }
];
function Zf(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Fa({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ x(xe, { children: [
    Yf.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
      re,
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
    Oa.map((o) => /* @__PURE__ */ p(
      re,
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
    /* @__PURE__ */ p(re, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(Hs, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      re,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p(Us, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null,
    e.tool ? /* @__PURE__ */ p(
      re,
      {
        className: "reader-ink-tool",
        "aria-label": "退出画笔",
        title: "退出画笔（Esc）",
        "data-ink-exit": "true",
        onClick: () => {
          e.setTool(null), r();
        },
        children: /* @__PURE__ */ p(ft, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function Qf({ ink: e, page: t, onPick: n }) {
  return /* @__PURE__ */ p("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ p(Fa, { ink: e, page: t, onPick: n }) });
}
function em({ ink: e }) {
  return e.tool ? /* @__PURE__ */ p("div", { className: "reader-ink-bar is-dock", role: "toolbar", "aria-label": "画笔", "data-ink-dock": "true", children: /* @__PURE__ */ p(Fa, { ink: e }) }) : null;
}
function tm(e) {
  const t = M(e);
  t.current = e, D(() => {
    const n = (r) => {
      if (Zf(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
const nm = "reader-ink-layer";
function rm(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function mo({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: rm(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function om({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = P(null), i = M(!1), c = o.strokes.filter((h) => za(h, e, t)), l = !!o.tool;
  if (!l && !c.length) return null;
  const u = (h) => {
    const y = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - y.left) / Math.max(1, y.width))),
      Math.min(1, Math.max(0, (h.clientY - y.top) / Math.max(1, y.height)))
    ];
  }, m = (h, y) => o.erase(Jf(o.strokes, e, t, h, y, r / Math.max(1, n))), d = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [y, w] = u(h);
    o.tool === "eraser" ? m(y, w) : s([[y, w]]);
  }, f = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [y, w] = u(h);
    o.tool === "eraser" ? m(y, w) : s((S) => S ? Gf(S, y, w) : [[y, w]]);
  }, g = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: lo[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ x(
    "svg",
    {
      className: nm,
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
const am = [
  { keys: "P", desc: "进入 / 退出画笔（书页上右键也能选笔和颜色）" },
  { keys: "Esc", desc: "退出画笔" },
  { keys: "⌘Z / Ctrl+Z", desc: "画笔模式下撤销" }
];
function sm(e) {
  return {
    toolbarItems: [{
      key: "ink",
      label: "画笔",
      title: "画笔（P；书页上右键也能选笔和颜色）",
      Icon: Zn,
      pressed: !!e.tool,
      onClick: () => e.setTool(e.tool ? null : "pen")
    }],
    menuSection: ({ page: t, close: n }) => /* @__PURE__ */ p(Qf, { ink: e, page: t, onPick: n }),
    // 离视口远的页只是占位，笔迹先不画（和以前一样只画 active 的页）。
    pageLayer: ({ page: t, pane: n, width: r, height: o, active: a }) => a ? /* @__PURE__ */ p(om, { page: t, pane: n, width: r, height: o, ink: e }) : null,
    takesPointer: !!e.tool,
    shortcuts: am
  };
}
function im() {
  const e = Gt(), t = Xf(e.resetKey);
  tm(t);
  const n = V(() => sm(t), [t]);
  return yn(n), /* @__PURE__ */ p(em, { ink: t });
}
const cm = { id: "ink", title: "画笔", Component: im }, lm = Oo(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
  return /* @__PURE__ */ x(
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
}), um = lm;
function dm(e) {
  const t = M(!1);
  return e && (t.current = !0), t.current;
}
const fm = Fo(() => import("./ReaderMarkdownPanel-C6SvdxCG.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), Ba = { id: "markdown", label: "Markdown", short: "MD", Icon: um, needsJob: !0 };
function mm() {
  const e = Gt(), t = e.activePanel === Ba.id;
  return dm(t) ? /* @__PURE__ */ p(zo, { fallback: null, children: /* @__PURE__ */ p(fm, { open: t, jobId: e.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: e.closePanel }) }) : null;
}
const hm = {
  id: "markdown",
  title: "Markdown",
  Component: mm,
  panels: [Ba]
}, ja = "reader-xref", Un = "data-xref", $t = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, pm = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${$t})`), gm = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function Wn(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function bm(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function ym(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function vm(e, t, n) {
  const r = e[t], o = (i) => {
    if (!i || i.source.page !== r.source.page) return !1;
    const c = $e(i);
    return c === "figure" || c === "table" || c === "formula";
  }, a = (i) => {
    const c = [];
    for (let l = t + i; o(e[l]) && c.length < 40; l += i) c.push(e[l]);
    return i < 0 ? c.reverse() : c;
  }, s = a(n === "table" ? 1 : -1);
  return s.length ? s : a(n === "table" ? -1 : 1);
}
function wm(e, t, n) {
  return (e.find((o) => $e(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function Sm(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = $e(r), s = ym(r);
    if (a === "formula") {
      for (const g of s.matchAll(gm)) {
        const h = Wn(g[1]);
        h && n({ key: `equation:${h}`, kind: "equation", label: h, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = pm.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const l = bm(i[1]), u = Wn(i[2]), m = vm(e, o, l), d = [...m.map((g) => g.itemId), r.itemId], f = new Map(e.map((g, h) => [g.itemId, h]));
    d.sort((g, h) => (f.get(g) ?? 0) - (f.get(h) ?? 0)), n({ key: `${l}:${u}`, kind: l, label: u, itemId: wm(m, r, l), itemIds: d, captionId: r.itemId });
  }), t;
}
const km = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${$t})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${$t})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${$t})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${$t})\s*[）)]`, "g"), kind: () => "equation" }
];
function Im(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of km) {
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
function Em(e, t) {
  return Im(e, t).map((n) => ({ start: n.start, end: n.end, className: ja, attrs: { [Un]: n.key } }));
}
const Tm = { figure: "图", table: "表", equation: "式" };
function ho(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${Tm[e.kind]} ${e.label}`;
}
const po = { figure: "图", table: "表", formula: "公式", text: "文字" }, Xe = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function Rm(e, t, n) {
  const r = Tt(e, t, n), o = r ? dt(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = La({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function Pm(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, c = null;
  for (const u of e) {
    const m = Tt(u, t, n), d = m ? dt(m, 1, 1) : null;
    !m || !d || (r || (r = m.box.page, c = m.pageSize), m.box.page === r && (o = Math.min(o, d.left), a = Math.min(a, d.top), s = Math.max(s, d.left + d.width), i = Math.max(i, d.top + d.height)));
  }
  if (!r || !c) return null;
  const l = La({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: l, aspect: l.height * c.height / Math.max(1e-6, l.width * c.width) };
}
function Mm(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function _m(e, t) {
  const n = (o) => {
    const a = $e(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function Nm({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var z;
  const i = t.find((_) => _.itemId === e) ?? null, c = V(() => i ? _m(t, i) : [], [t, i]), l = i ? c.indexOf(i) : -1, [u, m] = P(Xe.indexOf(1)), d = Xe[u], f = M(null), [g, h] = P(0);
  Ne(() => {
    const _ = f.current;
    if (!_) return;
    const I = () => h(_.clientWidth);
    I();
    const E = typeof ResizeObserver == "function" ? new ResizeObserver(I) : null;
    return E == null || E.observe(_), () => E == null ? void 0 : E.disconnect();
  }, []);
  const y = N((_) => {
    const I = c[l + _];
    I && a(I.itemId);
  }, [c, l, a]);
  D(() => {
    const _ = (I) => {
      if (I.key === "Escape")
        I.preventDefault(), s();
      else if (I.key === "ArrowLeft")
        I.preventDefault(), y(-1);
      else if (I.key === "ArrowRight")
        I.preventDefault(), y(1);
      else if (I.key === "+" || I.key === "=")
        I.preventDefault(), m((E) => Math.min(Xe.length - 1, E + 1));
      else if (I.key === "-" || I.key === "_")
        I.preventDefault(), m((E) => Math.max(0, E - 1));
      else if (I.key === "0")
        I.preventDefault(), m(Xe.indexOf(1));
      else
        return;
      I.stopPropagation();
    };
    return window.addEventListener("keydown", _, !0), () => window.removeEventListener("keydown", _, !0);
  }, [s, y]), D(() => {
    const _ = f.current;
    if (!_) return;
    const I = (E) => {
      !E.ctrlKey && !E.metaKey || (E.preventDefault(), m((R) => Math.max(0, Math.min(Xe.length - 1, R + (E.deltaY < 0 ? 1 : -1)))));
    };
    return _.addEventListener("wheel", I, { passive: !1 }), () => _.removeEventListener("wheel", I);
  }, []);
  const w = M(null);
  if (!i) return null;
  const S = $e(i), b = o.map((_) => ({ pane: _, pdf: r[_] ?? null, where: Rm(i, n, _) })).filter((_) => !!(_.pdf && _.where)), v = 16, k = typeof window > "u" ? 800 : window.innerHeight, T = Math.min(880, k * 0.9) - 56 - 32 - (b.length > 1 ? 26 : 0), A = b.length ? Mm(Math.max(120, (g - v * (b.length - 1) - 32) / b.length), T, b.map((_) => _.where.aspect)) : 0, O = ((z = b[0]) == null ? void 0 : z.where.page) ?? i.source.page;
  return /* @__PURE__ */ x("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${po[S] ?? "这一块"}`, children: [
    /* @__PURE__ */ p("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ x("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ x("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ x("span", { className: "reader-zoom-title", children: [
          po[S] ?? "这一块",
          " · 第 ",
          O,
          " 页"
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-zoom-count", children: l >= 0 ? `${l + 1} / ${c.length}` : "" }),
        /* @__PURE__ */ x("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ p(at, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: l <= 0, onClick: () => y(-1), children: /* @__PURE__ */ p(Ws, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(at, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: l < 0 || l >= c.length - 1, onClick: () => y(1), children: /* @__PURE__ */ p(qo, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(at, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => m((_) => Math.max(0, _ - 1)), children: /* @__PURE__ */ p(Ks, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ x(re, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => m(Xe.indexOf(1)), children: [
            Math.round(d * 100),
            "%"
          ] }),
          /* @__PURE__ */ p(at, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === Xe.length - 1, onClick: () => m((_) => Math.min(Xe.length - 1, _ + 1)), children: /* @__PURE__ */ p(Vs, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(at, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: s, children: /* @__PURE__ */ p(ft, { size: 16, "aria-hidden": !0 }) })
        ] })
      ] }),
      /* @__PURE__ */ p(
        "div",
        {
          ref: f,
          className: "reader-zoom-body",
          onPointerDown: (_) => {
            const I = f.current;
            !I || _.button !== 0 || (w.current = { x: _.clientX, y: _.clientY, left: I.scrollLeft, top: I.scrollTop }, I.setPointerCapture(_.pointerId));
          },
          onPointerMove: (_) => {
            const I = f.current, E = w.current;
            !I || !E || (I.scrollLeft = E.left - (_.clientX - E.x), I.scrollTop = E.top - (_.clientY - E.y));
          },
          onPointerUp: () => {
            w.current = null;
          },
          children: b.length && g ? /* @__PURE__ */ p("div", { className: "reader-zoom-columns", style: { gap: v }, children: b.map(({ pane: _, pdf: I, where: E }) => /* @__PURE__ */ x("figure", { className: "reader-zoom-column", children: [
            b.length > 1 ? /* @__PURE__ */ p("figcaption", { children: _ === "source" ? "原文" : "译文" }) : null,
            /* @__PURE__ */ p(
              Da,
              {
                className: "reader-zoom-canvas",
                pdf: I,
                page: E.page,
                region: E.fraction,
                cssWidth: A * d,
                label: `${_ === "source" ? "原文" : "译文"}第 ${E.page} 页`
              }
            )
          ] }, _)) }) : /* @__PURE__ */ p("p", { className: "reader-zoom-empty", children: g ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
const Am = 380, xm = 320, yt = 8;
function Lm(e, t, n) {
  const r = Math.max(yt, Math.min(e.left, n.width - t.width - yt)), o = e.bottom + yt, a = o + t.height <= n.height - yt ? o : Math.max(yt, e.top - yt - t.height);
  return { left: r, top: a };
}
function Cm({
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
    const f = r[d], g = f ? Pm(o, n, d) : null;
    if (f && g) {
      s = { pdf: f, where: g };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min(Am, xm / Math.max(0.05, s.where.aspect))), c = Math.round(i * s.where.aspect) + 30, l = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: m } = Lm(e.anchor, { width: Math.max(i, 160) + 16, height: c + 16 }, l);
  return /* @__PURE__ */ x("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: m }, children: [
    /* @__PURE__ */ x("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ p("span", { children: ho(e.target) }),
      /* @__PURE__ */ x("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ p(Da, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: ho(e.target) })
  ] });
}
const Dm = 250;
function $m(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function Om(e, t, n) {
  const r = n === "back" ? e.back : e.forward;
  if (!r.length) return null;
  const o = r[r.length - 1], a = r.slice(0, -1), s = n === "back" ? { back: a, forward: [...e.forward, t] } : { back: [...e.back, t], forward: a };
  return { to: o, history: s };
}
function zm(e) {
  var n;
  const t = e;
  return !!((n = t == null ? void 0 : t.closest) != null && n.call(t, "input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
function Fm({
  shellEl: e,
  index: t,
  primaryPane: n,
  follow: r
}) {
  const [o, a] = P(null), [s, i] = P({ back: [], forward: [] }), c = M(s);
  c.current = s;
  const l = M(null), u = M({ index: t, primaryPane: n, follow: r, shellEl: e });
  u.current = { index: t, primaryPane: n, follow: r, shellEl: e };
  const m = N(() => {
    const { shellEl: f, primaryPane: g } = u.current;
    return zt(f, g);
  }, []);
  D(() => {
    if (!e) return;
    const f = (b) => {
      var v, k;
      return (k = (v = b.target) == null ? void 0 : v.closest) == null ? void 0 : k.call(v, `.${ja}`);
    }, g = () => {
      l.current != null && window.clearTimeout(l.current), l.current = null;
    }, h = (b) => {
      var A;
      const v = f(b);
      if (!v) return;
      const k = u.current.index.get(v.getAttribute(Un) || "");
      if (!k) return;
      const T = ((A = v.closest("[data-reader-pane]")) == null ? void 0 : A.getAttribute("data-reader-pane")) || u.current.primaryPane;
      g(), l.current = window.setTimeout(() => {
        const O = v.getBoundingClientRect();
        a({ target: k, pane: T, anchor: { left: O.left, top: O.top, right: O.right, bottom: O.bottom } });
      }, Dm);
    }, y = (b) => {
      const v = f(b);
      !v || v.contains(b.relatedTarget) || (g(), a(null));
    }, w = (b) => {
      var O, z;
      const v = f(b);
      if (!v || b.button !== 0 || b.metaKey || b.ctrlKey || b.shiftKey || `${((O = window.getSelection) == null ? void 0 : O.call(window)) || ""}`.trim()) return;
      const k = u.current.index.get(v.getAttribute(Un) || "");
      if (!k) return;
      b.preventDefault(), b.stopPropagation(), g(), a(null);
      const T = ((z = v.closest("[data-reader-pane]")) == null ? void 0 : z.getAttribute("data-reader-pane")) || u.current.primaryPane, A = m();
      A && i((_) => $m(_, A)), u.current.follow(k, T);
    }, S = () => {
      g(), a(null);
    };
    return e.addEventListener("pointerover", h), e.addEventListener("pointerout", y), e.addEventListener("click", w, !0), e.addEventListener("scroll", S, { passive: !0 }), () => {
      g(), e.removeEventListener("pointerover", h), e.removeEventListener("pointerout", y), e.removeEventListener("click", w, !0), e.removeEventListener("scroll", S);
    };
  }, [e, m]);
  const d = N((f) => {
    const g = m();
    if (!g) return !1;
    const h = Om(c.current, g, f);
    if (!h) return !1;
    const { shellEl: y, primaryPane: w } = u.current;
    return Rt(y, h.to, "auto", w) ? (i(h.history), !0) : !1;
  }, [m]);
  return D(() => {
    const f = (g) => {
      if (!g.altKey || g.metaKey || g.ctrlKey || g.shiftKey || g.defaultPrevented || g.key !== "ArrowLeft" && g.key !== "ArrowRight" || zm(g.target)) return;
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
const Bm = [
  { keys: "Alt+←", desc: "点了引用跳过去以后，回到原处" },
  { keys: "Alt+→", desc: "再跳回去" }
];
function jm() {
  const e = Gt(), t = V(() => Sm(e.regions), [e.regions]), { jumpToBlock: n } = e, r = N((s, i) => n(s.itemId, i), [n]), o = Fm({ shellEl: e.shellEl, index: t, primaryPane: e.primaryPane, follow: r }), a = V(() => ({
    // 书里一个认得出去处的引用都没有，就不改文字层（react-pdf 照原样画，不多一遍 innerHTML）。
    textMarks: t.size ? (s) => Em(s, t) : void 0,
    shortcuts: Bm
  }), [t]);
  return yn(a), /* @__PURE__ */ x(xe, { children: [
    o.preview ? /* @__PURE__ */ p(Cm, { preview: o.preview, regions: e.regions, metadata: e.metadata, documents: e.pdfDocuments }) : null,
    o.canGoBack ? /* @__PURE__ */ x(re, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => o.goBack(), children: [
      /* @__PURE__ */ p(qs, { size: 14, "aria-hidden": !0 }),
      " 回到第 ",
      o.backPage,
      " 页"
    ] }) : null
  ] });
}
const Hm = { id: "xrefs", title: "引用（「图 2.1」「式 (3.21)」）", Component: jm }, ir = [cm, hm, Vf, Hm, Of];
function cr(e = ir) {
  return e.flatMap((t) => (t.panels ?? []).map(({ id: n, label: r, short: o, Icon: a, needsJob: s }) => ({ id: n, label: r, short: o, Icon: a, needsJob: s })));
}
function Um(e) {
  const t = Ge(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(xe, { children: (e.tabs ?? cr()).map(({ id: s, label: i, Icon: c, needsJob: l }) => {
    const u = n === s, m = l && r, d = u ? `收起${i}` : `打开${i}`;
    return /* @__PURE__ */ x(
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
function Wm(e) {
  const t = Ge(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
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
  return n ? /* @__PURE__ */ x("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ p("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: c, label: l, Icon: u, disabled: m, selected: d, badge: f, onClick: g }) => /* @__PURE__ */ x(
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
        children: /* @__PURE__ */ p(ft, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function Km(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Vm(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function qm(e) {
  return e / 100 * window.innerHeight;
}
function Jm(e) {
  return e / 100 * window.innerWidth;
}
function Gm(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function Ot({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = Gm(n);
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
      r = Vm(t, o);
      break;
    }
    case "em": {
      r = Km(t, o);
      break;
    }
    case "vh": {
      r = qm(o);
      break;
    }
    case "vw": {
      r = Jm(o);
      break;
    }
  }
  return r;
}
function Me(e) {
  return parseFloat(e.toFixed(3));
}
function Pt({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function Kn(e) {
  const { panels: t } = e, n = Pt({ group: e });
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
      const u = Ot({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = Me(u / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const u = Ot({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = Me(u / n * 100);
    }
    let c = 0;
    if (a.minSize !== void 0) {
      const u = Ot({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      c = Me(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = Ot({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      l = Me(u / n * 100);
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
function me(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function Vn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? Xm : Ym
  );
}
function Xm(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function Ym(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function Ha(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Ua(e, t) {
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
function Zm({
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
    const { x: i, y: c } = Ua(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return me(o, "No rect found"), o;
}
let nn;
function Qm() {
  return nn === void 0 && (typeof matchMedia == "function" ? nn = !!matchMedia("(pointer:coarse)").matches : nn = !1), nn;
}
function Wa(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Vn(
    n,
    Array.from(t.children).filter(Ha).map((g) => ({ element: g }))
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
          (w) => w.element === h
        );
        if (y) {
          if (d) {
            const w = d.element.getBoundingClientRect(), S = h.getBoundingClientRect();
            let b;
            if (c) {
              const v = n === "horizontal" ? new DOMRect(
                w.right,
                w.top,
                0,
                w.height
              ) : new DOMRect(
                w.left,
                w.bottom,
                w.width,
                0
              ), k = n === "horizontal" ? new DOMRect(S.left, S.top, 0, S.height) : new DOMRect(S.left, S.top, S.width, 0);
              switch (f.length) {
                case 0: {
                  b = [
                    v,
                    k
                  ];
                  break;
                }
                case 1: {
                  const T = f[0], A = Zm({
                    orientation: n,
                    rects: [w, S],
                    targetRect: T.element.getBoundingClientRect()
                  });
                  b = [
                    T,
                    A === w ? k : v
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
                  w.right,
                  S.top,
                  S.left - w.right,
                  S.height
                ) : new DOMRect(
                  S.left,
                  w.bottom,
                  S.width,
                  S.top - w.bottom
                )
              ];
            for (const v of b) {
              let k = "width" in v ? v : v.element.getBoundingClientRect();
              const T = Qm() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (k.width < T) {
                const O = T - k.width;
                k = new DOMRect(
                  k.x - O / 2,
                  k.y,
                  k.width + O,
                  k.height
                );
              }
              if (k.height < T) {
                const O = T - k.height;
                k = new DOMRect(
                  k.x,
                  k.y - O / 2,
                  k.width,
                  k.height + O
                );
              }
              const A = g <= l || g > u;
              !i && !A && s.push({
                group: e,
                groupSize: Pt({ group: e }),
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
          (w) => w.element === h
        );
        y ? f.push(y) : (d = void 0, f = []);
      } else
        c = !0;
  }
  return s;
}
var Ze;
class Ka {
  constructor() {
    Rr(this, Ze, {});
  }
  addListener(t, n) {
    const r = _t(this, Ze)[t];
    return r === void 0 ? _t(this, Ze)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = _t(this, Ze)[t];
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
    Pr(this, Ze, {});
  }
  removeListener(t, n) {
    const r = _t(this, Ze)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
Ze = new WeakMap();
let It = {
  cursorFlags: 0,
  state: "inactive"
};
const lr = new Ka();
function ct() {
  return It;
}
function eh(e) {
  return lr.addListener("change", e);
}
function th(e) {
  const t = It, n = { ...It };
  n.cursorFlags = e, It = n, lr.emit("change", {
    prev: t,
    next: n
  });
}
function Et(e) {
  const t = It;
  It = e, lr.emit("change", {
    prev: t,
    next: e
  });
}
const nh = (e) => e, _n = () => {
}, Va = 1, qa = 2, Ja = 4, Ga = 8, go = 3, bo = 12;
let rn;
function yo() {
  return rn === void 0 && (rn = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (rn = !0)), rn;
}
function rh({
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
          const a = (e & Va) !== 0, s = (e & qa) !== 0, i = (e & Ja) !== 0, c = (e & Ga) !== 0;
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
  const r = ct();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = rh({
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
let Be = /* @__PURE__ */ new Map();
const Xa = new Ka();
function oh(e) {
  Be = new Map(Be), Be.delete(e);
}
function wo(e, t) {
  for (const [n] of Be)
    if (n.id === e)
      return n;
}
function tt(e, t) {
  for (const [n, r] of Be)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function mt() {
  return Be;
}
function dr(e, t) {
  return Xa.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function qe(e, t, n) {
  const r = Be.get(e);
  Be = new Map(Be), Be.set(e, t), Xa.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function Ya(e) {
  const t = ct();
  let n = !1;
  switch (t.state) {
    case "active":
      Et({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (ur(e), n = !0, t.hitRegions.forEach((r) => {
        const o = tt(r.group.id, !0);
        qe(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function So(e) {
  e.defaultPrevented || Ya(e.currentTarget);
}
function ah(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Ua(n, a.rect);
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
function sh(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function ih(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: Eo(e),
    b: Eo(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  me(
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
const ch = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function lh(e) {
  const t = getComputedStyle(Za(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function uh(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || lh(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || ch.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function ko(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (me(n, "Missing node"), uh(n)) return n;
  }
  return null;
}
function Io(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Eo(e) {
  const t = [];
  for (; e; )
    t.push(e), e = Za(e);
  return t;
}
function Za(e) {
  const { parentNode: t } = e;
  return sh(t) ? t.host : t;
}
function dh(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function fh({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!Ha(n) || n.contains(e) || e.contains(n))
    return !0;
  if (ih(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (dh(r.getBoundingClientRect(), t))
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
    const a = Wa(o), s = ah(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && fh({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function mh(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function Pe(e, t, n = 0) {
  return Math.abs(Me(e) - Me(t)) <= n;
}
function Fe(e, t) {
  return Pe(e, t) ? 0 : e > t ? 1 : -1;
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
  if (Fe(r, c) < 0)
    if (a) {
      const l = (o + c) / 2;
      Fe(r, l) < 0 ? r = o : r = c;
    } else
      r = c;
  return r = Math.min(i, r), r = Me(r), r;
}
function Ut({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (Pe(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), c = Object.values(o), l = [...i], [u, m] = r;
  me(u != null, "Invalid first pivot index"), me(m != null, "Invalid second pivot index");
  let d = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? m : u, y = n[h];
        me(
          y,
          `Panel constraints not found for index ${h}`
        );
        const {
          collapsedSize: w = 0,
          collapsible: S,
          minSize: b = 0
        } = y;
        if (S) {
          const v = i[h];
          if (me(
            v != null,
            `Previous layout not found for panel index ${h}`
          ), Pe(v, w)) {
            const k = b - v;
            Fe(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      {
        const h = e < 0 ? u : m, y = n[h];
        me(
          y,
          `No panel constraints found for index ${h}`
        );
        const {
          collapsedSize: w = 0,
          collapsible: S,
          minSize: b = 0
        } = y;
        if (S) {
          const v = i[h];
          if (me(
            v != null,
            `Previous layout not found for panel index ${h}`
          ), Pe(v, b)) {
            const k = v - w;
            Fe(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? m : u, y = n[h];
      me(
        y,
        `Panel constraints not found for index ${h}`
      );
      const w = i[h], { collapsible: S, collapsedSize: b, minSize: v } = y;
      if (S && Fe(w, v) < 0)
        if (e > 0) {
          const k = v - b, T = k / 2, A = w + e;
          Fe(A, v) < 0 && (e = Fe(e, T) <= 0 ? 0 : k);
        } else {
          const k = v - b, T = 100 - k / 2, A = w - e;
          Fe(A, v) < 0 && (e = Fe(100 + e, T) > 0 ? 0 : -k);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let y = e < 0 ? m : u, w = 0;
    for (; ; ) {
      const b = i[y];
      me(
        b != null,
        `Previous layout not found for panel index ${y}`
      );
      const v = kt({
        overrideDisabledPanels: s,
        panelConstraints: n[y],
        prevSize: b,
        size: 100
      }) - b;
      if (w += v, y += h, y < 0 || y >= n.length)
        break;
    }
    const S = Math.min(Math.abs(e), Math.abs(w));
    e = e < 0 ? 0 - S : S;
  }
  {
    let h = e < 0 ? u : m;
    for (; h >= 0 && h < n.length; ) {
      const y = Math.abs(e) - Math.abs(d), w = i[h];
      me(
        w != null,
        `Previous layout not found for panel index ${h}`
      );
      const S = w - y, b = kt({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: w,
        size: S
      });
      if (!Pe(w, b) && (d += w - b, l[h] = b, d.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (mh(c, l))
    return o;
  {
    const h = e < 0 ? m : u, y = i[h];
    me(
      y != null,
      `Previous layout not found for panel index ${h}`
    );
    const w = y + d, S = kt({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: y,
      size: w
    });
    if (l[h] = S, !Pe(S, w)) {
      let b = w - S, v = e < 0 ? m : u;
      for (; v >= 0 && v < n.length; ) {
        const k = l[v];
        me(
          k != null,
          `Previous layout not found for panel index ${v}`
        );
        const T = k + b, A = kt({
          overrideDisabledPanels: s,
          panelConstraints: n[v],
          prevSize: k,
          size: T
        });
        if (Pe(k, A) || (b -= A - k, l[v] = A), Pe(b, 0))
          break;
        e > 0 ? v-- : v++;
      }
    }
  }
  const f = Object.values(l).reduce(
    (h, y) => y + h,
    0
  );
  if (!Pe(f, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return l.reduce((h, y, w) => (h[g[w]] = y, h), {});
}
function lt(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || Fe(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function ut({
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
  if (!Pe(o, 100) && r.length > 0)
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      me(c != null, `No layout data found for index ${i}`);
      const l = 100 / o * c;
      r[i] = l;
    }
  let a = 0;
  for (let i = 0; i < t.length; i++) {
    const c = n[i];
    me(c != null, `No layout data found for index ${i}`);
    const l = r[i];
    me(l != null, `No layout data found for index ${i}`);
    const u = kt({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: c,
      size: l
    });
    l != u && (a += l - u, r[i] = u);
  }
  if (!Pe(a, 0))
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      me(c != null, `No layout data found for index ${i}`);
      const l = c + a, u = kt({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: c,
        size: l
      });
      if (c !== u && (a -= u - c, r[i] = u, Pe(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, c, l) => (i[s[l]] = c, i), {});
}
function Qa({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const c = mt();
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
    if (h && c < d && (g || l.slice(0, f).every((y, w) => {
      const S = m[w];
      return (S == null ? void 0 : S.collapsible) && Pe(S.collapsedSize, u[S.panelId]);
    }))) {
      const y = l.slice(0, f).reduce((w, S) => w + u[S.id], 0);
      return {
        ...u,
        [t]: Me(100 - y)
      };
    }
    return Ut({
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
    }), w = ut({
      layout: y,
      panelConstraints: m
    });
    lt(g, w) || qe(d, {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: m,
      groupSize: f,
      layout: w,
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
      return c && Pe(l, u);
    },
    resize: (c) => {
      const { group: l } = n(), { element: u } = o(), m = Pt({ group: l }), d = Ot({
        groupSize: m,
        panelElement: u,
        styleProp: c
      }), f = Me(d / m * 100);
      i(f);
    }
  };
}
function To(e) {
  if (e.defaultPrevented)
    return;
  const t = mt();
  fr(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = Qa({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function on(e) {
  const t = mt();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function es({
  groupId: e
}) {
  const t = () => {
    const n = mt();
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
      } = t(), l = ut({
        layout: n,
        panelConstraints: o
      });
      return r ? i : (lt(i, l) || qe(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: l,
        separatorToPanels: c
      }), l);
    }
  };
}
function ot(e, t) {
  const n = on(e), r = tt(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  me(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  me(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), i = es({ groupId: n.id }).getLayout(), c = Ut({
    delta: t,
    initialLayout: i,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: i,
    trigger: "keyboard"
  }), l = ut({
    layout: c,
    panelConstraints: r.derivedPanelConstraints
  });
  lt(i, l) || qe(
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
        e.preventDefault(), n.orientation === "vertical" && ot(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && ot(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && ot(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && ot(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), ot(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = on(t), o = tt(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, c = r.separators.find(
          (d) => d.element === t
        );
        me(c, "Matching separator not found");
        const l = i.get(c);
        me(l, "Matching panels not found");
        const u = l[0], m = a.find(
          (d) => d.panelId === u.id
        );
        if (me(m, "Panel metadata not found"), m.collapsible) {
          const d = s[u.id], f = m.collapsedSize === d ? r.mutableState.expandedPanelSizes[u.id] ?? m.minSize : m.collapsedSize;
          ot(t, f - d);
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
        me(o !== null, "Index not found");
        const a = e.shiftKey ? o > 0 ? o - 1 : r.length - 1 : o + 1 < r.length ? o + 1 : 0;
        r[a].focus({
          preventScroll: !0
        });
        break;
      }
      case "Home": {
        e.preventDefault(), ot(t, -100);
        break;
      }
    }
}
function Po(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = mt(), n = fr(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), Et({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function ts({
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
    const y = r.get(u), w = o.get(u);
    if (!y || !w)
      return;
    const {
      defaultLayoutDeferred: S,
      derivedPanelConstraints: b,
      groupSize: v,
      layout: k,
      separatorToPanels: T
    } = w;
    if (b && k && T) {
      const A = Ut({
        delta: h,
        initialLayout: y,
        panelConstraints: b,
        pivotIndices: l.panels.map((O) => f.indexOf(O)),
        prevLayout: k,
        trigger: "mouse-or-touch"
      });
      if (lt(A, k)) {
        if (h !== 0 && !g)
          switch (d) {
            case "horizontal": {
              i |= h < 0 ? Va : qa;
              break;
            }
            case "vertical": {
              i |= h < 0 ? Ja : Ga;
              break;
            }
          }
      } else
        qe(l.group, {
          defaultLayoutDeferred: S,
          derivedPanelConstraints: b,
          groupSize: v,
          layout: A,
          separatorToPanels: T
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & go : c |= i & go, t.movementY === 0 ? c |= s & bo : c |= i & bo, th(c), ur(e);
}
function Mo(e) {
  const t = mt(), n = ct();
  switch (n.state) {
    case "active":
      ts({
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
  const t = ct(), n = mt();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        Et({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = tt(a.group.id, !0);
          qe(a.group, s, {
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
      ts({
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
      a.length === 0 ? t.state !== "inactive" && Et({
        cursorFlags: 0,
        state: "inactive"
      }) : Et({
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
    switch (ct().state) {
      case "hover":
        Et({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function Ao(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || Ya(e.currentTarget) && e.preventDefault();
}
function xo(e) {
  let t = 0, n = 0;
  const r = {};
  for (const a of e)
    if (a.defaultSize !== void 0) {
      t++;
      const s = Me(a.defaultSize);
      n += s, r[a.panelId] = s;
    } else
      r[a.panelId] = void 0;
  const o = e.length - t;
  if (o !== 0) {
    const a = Me((100 - n) / o);
    for (const s of e)
      s.defaultSize === void 0 && (r[s.panelId] = a);
  }
  return r;
}
function hh(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((c) => c.element === t);
  if (!r || !r.onResize)
    return;
  const o = Pt({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: Me(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function ph(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function gh({
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
        const f = d / 100 * n, g = Me(
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
      u[m] = Me(
        d / a * l
      );
    }
  else {
    const m = Me(
      l / c.length
    );
    for (const d of c)
      u[d] = m;
  }
  return u;
}
function bh(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const vt = /* @__PURE__ */ new Map();
function yh(e) {
  let t = !0;
  me(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const h of g) {
      const { borderBoxSize: y, target: w } = h;
      if (w === e.element) {
        if (t) {
          const S = Pt({ group: e });
          if (S === 0)
            return;
          const b = tt(e.id);
          if (!b)
            return;
          const v = Kn(e), k = b.defaultLayoutDeferred ? xo(v) : b.layout, T = gh({
            group: e,
            nextGroupSize: S,
            prevGroupSize: b.groupSize,
            prevLayout: k
          }), A = ut({
            layout: T,
            panelConstraints: v
          });
          if (!b.defaultLayoutDeferred && lt(b.layout, A) && ph(
            b.derivedPanelConstraints,
            v
          ) && b.groupSize === S)
            return;
          qe(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: v,
            groupSize: S,
            layout: A,
            separatorToPanels: b.separatorToPanels
          });
        }
      } else
        hh(e, w, y);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    me(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = Pt({ group: e }), i = Kn(e), c = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (bh(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[c] ?? l ?? xo(i), m = ut({
    layout: u,
    panelConstraints: i
  }), d = e.element.ownerDocument;
  vt.set(
    d,
    (vt.get(d) ?? 0) + 1
  );
  const f = /* @__PURE__ */ new Map();
  return Wa(e).forEach((g) => {
    g.separator && f.set(g.separator, g.panels);
  }), qe(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: m,
    separatorToPanels: f
  }), e.separators.forEach((g) => {
    me(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", Ro);
  }), vt.get(d) === 1 && (d.addEventListener("contextmenu", So, !0), d.addEventListener("dblclick", To, !0), d.addEventListener("pointerdown", Po, !0), d.addEventListener("pointerleave", Mo), d.addEventListener("pointermove", _o), d.addEventListener("pointerout", No), d.addEventListener("pointerup", Ao, !0)), function() {
    t = !1, vt.set(
      d,
      Math.max(0, (vt.get(d) ?? 0) - 1)
    ), oh(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", Ro);
    }), vt.get(d) || (d.removeEventListener(
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
    ), d.removeEventListener("pointerleave", Mo), d.removeEventListener("pointermove", _o), d.removeEventListener("pointerout", No), d.removeEventListener("pointerup", Ao, !0)), a.disconnect();
  };
}
function vh() {
  const [e, t] = P({}), n = N(() => t({}), []);
  return [e, n];
}
function mr(e) {
  const t = Bo();
  return `${e ?? t}`;
}
const ht = typeof window < "u" ? Ne : D;
function Ft(e) {
  const t = M(e);
  return ht(() => {
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
  return Ft((t) => {
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
  const t = M({ ...e });
  return ht(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const ns = qt(null);
function wh(e, t) {
  const n = M({
    getLayout: () => ({}),
    setLayout: nh
  });
  Yn(t, () => n.current, []), ht(() => {
    Object.assign(
      n.current,
      es({ groupId: e })
    );
  });
}
function rs({
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
  const g = M({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), h = Ft((I) => {
    lt(g.current.onLayoutChange, I) || (g.current.onLayoutChange = I, c == null || c(I));
  }), y = Ft(
    (I, E) => {
      lt(g.current.onLayoutChanged, I) || (g.current.onLayoutChanged = I, l == null || l(I, { isUserInteraction: E }));
    }
  ), w = mr(i), S = M(null), [b, v] = vh(), k = M({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: m,
    separators: []
  }), T = hr(S, a);
  wh(w, s);
  const A = Ft(
    (I, E) => {
      const R = ct(), L = wo(I), C = tt(I);
      if (C) {
        let W = !1;
        switch (R.state) {
          case "active": {
            W = R.hitRegions.some(
              (H) => H.group === L
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
  }), z = V(
    () => ({
      get disableCursor() {
        return !!O.disableCursor;
      },
      getPanelStyles: A,
      id: w,
      orientation: u,
      registerPanel: (I) => {
        const E = k.current;
        return E.panels = Vn(u, [
          ...E.panels,
          I
        ]), v(), () => {
          E.panels = E.panels.filter(
            (R) => R !== I
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
            (R) => R !== I
          ), v();
        };
      },
      updatePanelProps: (I, { disabled: E }) => {
        const R = k.current.panels.find(
          (W) => W.id === I
        );
        R && (R.panelConstraints.disabled = E);
        const L = wo(w), C = tt(w);
        L && C && qe(L, {
          ...C,
          derivedPanelConstraints: Kn(L)
        });
      },
      updateSeparatorProps: (I, {
        disabled: E,
        disableDoubleClick: R
      }) => {
        const L = k.current.separators.find(
          (C) => C.id === I
        );
        L && (L.disabled = E, L.disableDoubleClick = R);
      }
    }),
    [A, w, v, u, O]
  ), _ = M(null);
  return ht(() => {
    const I = S.current;
    if (I === null)
      return;
    const E = k.current;
    let R;
    if (O.defaultLayout !== void 0 && Object.keys(O.defaultLayout).length === E.panels.length) {
      R = {};
      for (const Q of E.panels) {
        const ae = O.defaultLayout[Q.id];
        ae !== void 0 && (R[Q.id] = ae);
      }
    }
    const L = {
      disabled: !!o,
      element: I,
      id: w,
      mutableState: {
        defaultLayout: R,
        disableCursor: !!O.disableCursor,
        expandedPanelSizes: k.current.lastExpandedPanelSizes,
        layouts: k.current.layouts
      },
      orientation: u,
      panels: E.panels,
      resizeTargetMinimumSize: E.resizeTargetMinimumSize,
      separators: E.separators
    };
    _.current = L;
    const C = yh(L), { defaultLayoutDeferred: W, derivedPanelConstraints: H, layout: Y } = tt(L.id, !0);
    !W && H.length > 0 && (h(Y), y(Y, !1));
    const oe = dr(w, (Q) => {
      const { defaultLayoutDeferred: ae, derivedPanelConstraints: j, layout: U } = Q.next;
      if (ae || j.length === 0)
        return;
      const K = L.panels.map(({ id: J }) => J).join(",");
      L.mutableState.layouts[K] = U, j.forEach((J) => {
        if (J.collapsible) {
          const { layout: G } = Q.prev ?? {};
          if (G) {
            const pe = Pe(
              J.collapsedSize,
              U[J.panelId]
            ), ce = Pe(
              J.collapsedSize,
              G[J.panelId]
            );
            pe && !ce && (L.mutableState.expandedPanelSizes[J.panelId] = G[J.panelId]);
          }
        }
      });
      const he = ct().state !== "active";
      h(U), he && y(U, Q.isUserInteraction);
    });
    return () => {
      _.current = null, C(), oe();
    };
  }, [
    o,
    w,
    y,
    h,
    u,
    b,
    O
  ]), D(() => {
    const I = _.current;
    I && (I.mutableState.defaultLayout = n, I.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(ns.Provider, { value: z, children: /* @__PURE__ */ p(
    "div",
    {
      ...f,
      className: t,
      "data-group": !0,
      "data-testid": w,
      id: w,
      ref: T,
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
rs.displayName = "Group";
function gr() {
  const e = st(ns);
  return me(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Sh(e, t) {
  const { id: n } = gr(), r = M({
    collapse: _n,
    expand: _n,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: _n
  });
  Yn(t, () => r.current, []), ht(() => {
    Object.assign(
      r.current,
      Qa({ groupId: n, panelId: e })
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
  const h = !!c, y = mr(c), w = pr({
    disabled: a
  }), S = M(null), b = hr(S, s), {
    getPanelStyles: v,
    id: k,
    orientation: T,
    registerPanel: A,
    updatePanelProps: O
  } = gr(), z = m !== null, _ = Ft(
    (L, C, W) => {
      m == null || m(L, c, W);
    }
  );
  ht(() => {
    const L = S.current;
    if (L !== null) {
      const C = {
        element: L,
        id: y,
        idIsStable: h,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: z ? _ : void 0,
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
      return A(C);
    }
  }, [
    i,
    n,
    r,
    o,
    z,
    y,
    h,
    l,
    u,
    _,
    A,
    w
  ]), D(() => {
    O(y, { disabled: a });
  }, [a, y, O]), Sh(y, d);
  const I = () => {
    const L = v(k, y);
    if (L)
      return JSON.stringify(L);
  }, E = hn(
    (L) => dr(k, L),
    I,
    I
  );
  let R;
  return E ? R = JSON.parse(E) : o !== void 0 ? R = {
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
        ...kh,
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
            ...f,
            // Inform the browser that the library is handling touch events for this element
            // but still allow users to scroll content within panels in the non-resizing direction
            // NOTE This is not an inherited style
            // See github.com/bvaughn/react-resizable-panels/issues/662
            touchAction: T === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
qn.displayName = "Panel";
const kh = {
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
function Ih({
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
    a = ut({
      layout: Ut({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = ut({
      layout: Ut({
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
function os({
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
  }), [u, m] = P({}), [d, f] = P("inactive"), [g, h] = P(!1), y = M(null), w = hr(y, o), {
    disableCursor: S,
    id: b,
    orientation: v,
    registerSeparator: k,
    updateSeparatorProps: T
  } = gr(), A = v === "horizontal" ? "vertical" : "horizontal";
  ht(() => {
    const _ = y.current;
    if (_ !== null) {
      const I = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: _,
        id: c
      }, E = k(I), R = eh(
        (C) => {
          f(
            C.next.state !== "inactive" && C.next.hitRegions.some(
              (W) => W.separator === I
            ) ? C.next.state : "inactive"
          );
        }
      ), L = dr(
        b,
        (C) => {
          const { derivedPanelConstraints: W, layout: H, separatorToPanels: Y } = C.next, oe = Y.get(I);
          if (oe) {
            const Q = oe[0], ae = oe.indexOf(Q);
            m(
              Ih({
                layout: H,
                panelConstraints: W,
                panelId: Q.id,
                panelIndex: ae
              })
            );
          }
        }
      );
      return () => {
        R(), L(), E();
      };
    }
  }, [b, c, k, l]), D(() => {
    T(c, { disabled: n, disableDoubleClick: r });
  }, [n, r, c, T]);
  let O;
  n && !S && (O = "not-allowed");
  let z;
  if (n)
    z = "disabled";
  else
    switch (d) {
      case "active": {
        z = "active";
        break;
      }
      default:
        g ? z = "focus" : z = d;
    }
  return /* @__PURE__ */ p(
    "div",
    {
      ...i,
      "aria-controls": u.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": A,
      "aria-valuemax": u.valueMax,
      "aria-valuemin": u.valueMin,
      "aria-valuenow": u.valueNow,
      children: e,
      className: t,
      "data-separator": z,
      "data-testid": c,
      id: c,
      onBlur: () => h(!1),
      onFocus: () => h(!0),
      ref: w,
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
os.displayName = "Separator";
const br = 30, yr = 65, Wt = 50, Eh = 100 - yr, Th = 100 - br;
function Rh(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(yr, Math.max(br, t)) : Wt;
}
function vr(e) {
  return 100 - e;
}
function wt(e) {
  return `${e}%`;
}
const wr = "reader-document", Kt = "reader-assistant", as = "retainpdf.reader.ai-split-layout.v1", Ph = {
  [wr]: vr(Wt),
  [Kt]: Wt
};
function Sr(e) {
  const t = Rh(e == null ? void 0 : e[Kt]);
  return {
    [wr]: vr(t),
    [Kt]: t
  };
}
function Mh() {
  try {
    const e = JSON.parse(localStorage.getItem(as) || "null");
    return Sr(e);
  } catch {
    return Ph;
  }
}
function _h(e) {
  try {
    localStorage.setItem(as, JSON.stringify(Sr(e)));
  } catch {
  }
}
function Nn(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = Sr(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[Kt]}vw`
  );
}
function Nh() {
  const e = M(null), [t] = P(Mh);
  Ne(() => {
    const o = e.current;
    return Nn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = N((o) => {
    Nn(e.current, o);
  }, []), r = N((o, a) => {
    Nn(e.current, o), a.isUserInteraction && _h(o);
  }, []);
  return /* @__PURE__ */ x(
    rs,
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
            defaultSize: wt(vr(Wt)),
            minSize: wt(Eh),
            maxSize: wt(Th)
          }
        ),
        /* @__PURE__ */ p(
          os,
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
            id: Kt,
            defaultSize: wt(Wt),
            minSize: wt(br),
            maxSize: wt(yr)
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
  return /* @__PURE__ */ x("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ x("span", { className: "reader-error-notice-text", children: [
      a.join("、"),
      "加载失败，正文仍可正常阅读。"
    ] }),
    n ? /* @__PURE__ */ p(re, { className: "reader-error-notice-retry", "data-reader-retry": "optional", onClick: n, children: "重试" }) : null,
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
function xh({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(Ah, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ x(xe, { children: [
    e ? /* @__PURE__ */ p("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ x("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ p(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ x("div", { className: "reader-react-error", role: "alert", children: [
      /* @__PURE__ */ p("span", { className: "reader-react-error-text", children: n }),
      s ? /* @__PURE__ */ p(re, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function Lh(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Ch() {
  const [e, t] = P(!1), n = Bo(), r = M(null), o = xa(), a = V(() => [...Tl, ...Yd(o)], [o]);
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
      if (i.defaultPrevented || i.metaKey || i.ctrlKey || i.altKey || Lh(i.target)) return;
      const c = i.key;
      if (c === "?" || c === "h" || c === "H" || c === "/") {
        if (c === "/" && !i.shiftKey)
          return;
        i.preventDefault(), t((l) => !l);
      }
    };
    return window.addEventListener("keydown", s), () => window.removeEventListener("keydown", s);
  }, []), /* @__PURE__ */ x("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
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
        children: /* @__PURE__ */ p(Js, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ x(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ x("div", { className: "reader-react-shortcuts-head", children: [
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
          /* @__PURE__ */ p("div", { className: "reader-react-shortcuts-body", children: a.map((s) => /* @__PURE__ */ x("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ p("h3", { children: s.title }),
            /* @__PURE__ */ p("ul", { children: s.items.map((i) => /* @__PURE__ */ x("li", { children: [
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
const Dh = ["source", "sideBySide", "translated"], $h = { source: "", translated: "", sideBySide: "" };
function Oh(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = an(e.sourceUrl), n = an(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return gi({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function zh(e) {
  const [t, n] = P(() => /* @__PURE__ */ new Set()), r = V(
    () => e ? Oh(e) : $h,
    [e]
  ), o = V(
    () => Dh.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = N(async (s) => {
    if (!e) return;
    const i = an(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? pi(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await bi(
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
        yi(l), n((u) => {
          const m = new Set(u);
          return m.delete(s), m;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const Fh = {
  source: Wo,
  sideBySide: Ko,
  translated: Vo
}, Bh = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function jh(e) {
  const t = Ge(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = zh(n), i = M(null);
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
  }, []), /* @__PURE__ */ x("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ x("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ p(Gs, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ p(Uo, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = hs[c], u = an(r[c]), m = a.has(c), d = !!u && !m, f = d ? "" : ps(c, r), g = Fh[c];
      return /* @__PURE__ */ x(
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
            /* @__PURE__ */ x("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ x("span", { className: "reader-download-action-label", children: [
                Bh[c],
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
const Hh = "retainpdf:reader:bookmarks:v1:", Uh = 200;
function kr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function ss(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Hh}${t}` : "";
}
function Wh(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function mn(e, t = kr()) {
  const n = ss(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = Wh(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function Jn(e, t, n) {
  const r = ss(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, Uh);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function Kh(e, t, n = "", { storage: r = kr(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = mn(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? Jn(e, a.filter((i) => i.page !== s), r) : Jn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Vh(e, t, n = kr()) {
  return Jn(e, mn(e, n).filter((r) => r.page !== t), n);
}
function qh(e, t) {
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
function Jh({ filled: e }) {
  return /* @__PURE__ */ p("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ p("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function Gh({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = P(() => mn(e)), [i, c] = P(!1), l = M(null);
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
  return /* @__PURE__ */ x("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: l, children: [
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${m ? " is-marked" : ""}`,
        "aria-pressed": m,
        "aria-label": m ? `取消第 ${u} 页的书签` : `给第 ${u} 页加书签`,
        title: m ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(Kh(e, u, qh(r, u))),
        children: /* @__PURE__ */ p(Jh, { filled: m })
      }
    ),
    a.length ? /* @__PURE__ */ x(
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
          /* @__PURE__ */ p(Xs, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { className: "reader-bookmark-count", children: a.length })
        ]
      }
    ) : null,
    i && a.length ? /* @__PURE__ */ p("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ p("ol", { className: "reader-bookmark-list", children: a.map((d) => /* @__PURE__ */ x("li", { className: d.page === u ? "is-current" : "", children: [
      /* @__PURE__ */ x(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(d.page, n)), c(!1);
          },
          children: [
            /* @__PURE__ */ x("span", { className: "reader-bookmark-page", children: [
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
          onClick: () => s(Vh(e, d.page)),
          children: "×"
        }
      )
    ] }, d.page)) }) }) : null
  ] });
}
function Xh(e) {
  const [t, n] = P([]);
  return D(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = Je().loadIssues;
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
function Yh(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const Zh = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, Qh = ["failed", "content", "layout"];
function ep(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function tp({ jobId: e, currentPage: t }) {
  var m;
  const n = Xh(e), r = (m = Ge()) == null ? void 0 : m.jumpToBlock, [o, a] = P(!1), [s, i] = P(-1), c = M(null);
  D(() => i(-1), [n]);
  const l = (d) => {
    const f = n[d];
    !f || !r || (i(d), r(f.readerItemId));
  }, u = M({ issues: n, last: s, currentPage: t, goTo: l });
  return u.current = { issues: n, last: s, currentPage: t, goTo: l }, D(() => {
    const d = (f) => {
      if (f.key.toLowerCase() !== "n" || f.metaKey || f.ctrlKey || f.altKey || ep(f.target)) return;
      const { issues: g, last: h, currentPage: y, goTo: w } = u.current, S = Yh(g, h, y, f.shiftKey);
      S < 0 || (f.preventDefault(), w(S));
    };
    return document.addEventListener("keydown", d), () => document.removeEventListener("keydown", d);
  }, []), D(() => {
    if (!o) return;
    const d = (f) => {
      var g;
      (g = c.current) != null && g.contains(f.target) || a(!1);
    };
    return document.addEventListener("pointerdown", d, !0), () => document.removeEventListener("pointerdown", d, !0);
  }, [o]), n.length ? /* @__PURE__ */ x("div", { className: "reader-react-hud-group reader-issues", ref: c, "aria-label": "待处理", children: [
    /* @__PURE__ */ x(
      re,
      {
        className: "reader-react-hud-btn reader-issues-toggle",
        "aria-expanded": o,
        "aria-haspopup": "true",
        "aria-label": `待处理 ${n.length} 处`,
        title: "这次翻译里要人看一眼的段落（N 下一处，Shift+N 上一处）",
        onClick: () => a((d) => !d),
        children: [
          /* @__PURE__ */ p(Ys, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { children: n.length })
        ]
      }
    ),
    o ? /* @__PURE__ */ x("div", { className: "reader-issues-popover", role: "dialog", "aria-label": "待处理", children: [
      /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
      Qh.map((d) => {
        const f = n.map((g, h) => ({ issue: g, index: h })).filter(({ issue: g }) => g.kind === d);
        return f.length ? /* @__PURE__ */ x("section", { className: "reader-issues-group", "data-issue-kind": d, children: [
          /* @__PURE__ */ x("h4", { children: [
            Zh[d],
            /* @__PURE__ */ p("span", { children: f.length })
          ] }),
          /* @__PURE__ */ p("ol", { children: f.map(({ issue: g, index: h }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ x(
            re,
            {
              className: "reader-issues-item",
              "aria-current": h === s ? "true" : void 0,
              onClick: () => {
                l(h), a(!1);
              },
              children: [
                /* @__PURE__ */ p("span", { className: "reader-issues-title", children: g.title }),
                /* @__PURE__ */ x("span", { className: "reader-issues-page", children: [
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
const np = 48, rp = 96, op = 700;
function ap(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= np, downSoFar: r };
}
function sp(e) {
  const [t, n] = P(!1), r = M(0);
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
      if (!(f instanceof Element) || (i.has(f) || i.set(f, !!f.querySelector(`[${Te}]`)), !i.get(f))) return;
      const g = f.scrollTop, h = o.get(f);
      if (o.set(f, g), h === void 0 || Date.now() - a > op) return;
      const y = ap(!1, r.current, g - h);
      r.current = y.downSoFar, g - h < -4 ? n(!1) : y.hidden && !c() && n(!0);
    }, u = (d) => {
      d.clientY >= window.innerHeight - rp && (r.current = 0, n(!1));
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
function ip(e) {
  const t = Ge(), n = Pa(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Jt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = ac(a), m = a > ta + 1e-3, d = a < dn - 1e-3, f = St(r, et()), g = f >= dn ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", h = M(null), y = sp(h), [w, S] = P(!1), [b, v] = P(`${i}`);
  D(() => {
    w || v(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, w]);
  const k = () => {
    if (S(!1), !l || c <= 0)
      return;
    const T = Number(`${b}`.trim());
    l(fn(T, c));
  };
  return /* @__PURE__ */ x("div", { ref: h, className: "reader-react-hud", "data-reader-hud": "true", "data-hud-hidden": y ? "true" : void 0, children: [
    o ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "页码", children: w ? /* @__PURE__ */ x(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (T) => {
          T.preventDefault(), k();
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
              onChange: (T) => v(T.target.value.replace(/[^\d]/g, "")),
              onBlur: k,
              onKeyDown: (T) => {
                T.key === "Escape" && (T.preventDefault(), S(!1), v(`${i}`));
              }
            }
          ),
          /* @__PURE__ */ x("span", { className: "reader-react-hud-page-suffix", children: [
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
          !l || c <= 0 || (v(`${i}`), S(!0));
        },
        children: c > 0 ? `${Math.min(i, c)} / ${c}` : "—"
      }
    ) }),
    e.searchSlot ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "搜索", children: e.searchSlot }) : null,
    e.bookmarkScope ? /* @__PURE__ */ p(
      Gh,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: c,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
      }
    ) : null,
    e.issuesJobId ? /* @__PURE__ */ p(tp, { jobId: e.issuesJobId, currentPage: i }) : null,
    t != null && t.toggleDocDark ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "显示", children: /* @__PURE__ */ p(
      re,
      {
        className: "reader-react-hud-btn reader-react-hud-doc-dark",
        "aria-pressed": t.docDark ? "true" : "false",
        "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
        title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
        onClick: t.toggleDocDark,
        children: /* @__PURE__ */ p(cp, {})
      }
    ) }) : null,
    /* @__PURE__ */ x("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ p(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !m,
          onClick: () => s(Ht(a, -1)),
          children: "−"
        }
      ),
      /* @__PURE__ */ x(
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
          onClick: () => s(Ht(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(Ch, {}) })
  ] });
}
function cp() {
  return /* @__PURE__ */ x("svg", { width: "14", height: "14", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: [
    /* @__PURE__ */ p("circle", { cx: "8", cy: "8", r: "6.25", fill: "none", stroke: "currentColor", strokeWidth: "1.5" }),
    /* @__PURE__ */ p("path", { d: "M8 1.75a6.25 6.25 0 0 1 0 12.5z", fill: "currentColor" })
  ] });
}
function Lo(e) {
  var t, n;
  return sa(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function lp(e) {
  const [t, n] = P(() => ({
    scope: e,
    panel: Lo(je(e))
  }));
  D(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Lo(je(e))
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
function up({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ x("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ x("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ p("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ p("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ p("div", { className: "download-toast-track", children: /* @__PURE__ */ p("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ p("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function dp(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    xn.dismiss(Gn);
    return;
  }
  xn.custom(
    () => /* @__PURE__ */ p(up, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: Gn, duration: 1 / 0 }
  );
}
function fp() {
  const e = N((t) => {
    t && (t.setState = dp, t.hide = () => xn.dismiss(Gn));
  }, []);
  return /* @__PURE__ */ x(xe, { children: [
    /* @__PURE__ */ p(Rs, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
const Co = { itemId: null, origin: null };
function mp() {
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
function hp({
  nodes: e,
  currentPage: t,
  onJumpPage: n
}) {
  const r = V(() => ba(e, t), [e, t]), [o, a] = P(() => /* @__PURE__ */ new Set([...Hr(r), ...r ? [r] : []]));
  D(() => {
    a(/* @__PURE__ */ new Set([...Hr(r), ...r ? [r] : []]));
  }, [e]);
  const s = M(null);
  D(() => {
    var l, u;
    (u = (l = s.current) == null ? void 0 : l.querySelector('[aria-current="location"]')) == null || u.scrollIntoView({ block: "center" });
  }, [e]);
  const i = (l) => a((u) => {
    const m = new Set(u);
    return m.has(l) ? m.delete(l) : m.add(l), m;
  }), c = (l) => l.map((u) => {
    const m = o.has(u.id), d = u.children.length > 0;
    return /* @__PURE__ */ x("li", { className: "reader-bookmark", "data-level": u.level, children: [
      /* @__PURE__ */ x("div", { className: "reader-bookmark-row", children: [
        d ? /* @__PURE__ */ p(
          re,
          {
            className: `reader-bookmark-toggle${m ? " is-open" : ""}`,
            "aria-label": m ? `收起「${u.title}」` : `展开「${u.title}」`,
            "aria-expanded": m,
            onClick: () => i(u.id),
            children: /* @__PURE__ */ p(qo, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 })
          }
        ) : /* @__PURE__ */ p("span", { className: "reader-bookmark-spacer", "aria-hidden": "true" }),
        /* @__PURE__ */ x(
          re,
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
const pp = [], gp = [];
function bp({
  open: e,
  onToggle: t,
  children: n
}) {
  return /* @__PURE__ */ x("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ p(re, { className: "reader-finder-toggle", "aria-label": "目录", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: /* @__PURE__ */ p(Qs, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }) }),
    n
  ] });
}
function yp({ open: e, onToggle: t }) {
  return /* @__PURE__ */ p(
    re,
    {
      className: "reader-react-hud-btn reader-search-toggle",
      "data-finder-toggle": "search",
      "aria-label": "在书里搜索",
      "aria-pressed": e === "search",
      title: "在书里搜索（原文和译文，⌘F）",
      onClick: () => t("search"),
      children: /* @__PURE__ */ p(Zs, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 })
    }
  );
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
  bookmarks: c = gp,
  onJumpPage: l
}) {
  var _, I;
  const u = ((_ = Ge()) == null ? void 0 : _.regions) ?? pp, m = ((I = Pa()) == null ? void 0 : I.currentPage) ?? 1, d = V(() => Xl(u), [u]), f = c.length > 0 && !!l, [g, h] = P("bookmarks"), y = f && (g === "bookmarks" || !d.length), w = Yl(d, m), S = V(() => eu(u, s), [u, s]), [b, v] = P(-1);
  D(() => v(-1), [s]);
  const k = M(null), T = M(null), A = M(n);
  A.current = n, D(() => {
    const E = (L) => {
      var W, H;
      const C = L.target;
      !C || (W = T.current) != null && W.contains(C) || (H = C.closest) != null && H.call(C, ".reader-finder-toggles, [data-finder-toggle]") || A.current();
    }, R = (L) => {
      L.key === "Escape" && A.current();
    };
    return document.addEventListener("pointerdown", E, !0), document.addEventListener("keydown", R), () => {
      document.removeEventListener("pointerdown", E, !0), document.removeEventListener("keydown", R);
    };
  }, []);
  const O = M(null);
  D(() => {
    var E, R, L;
    e === "search" ? (E = k.current) == null || E.focus() : (L = (R = O.current) == null ? void 0 : R.querySelector('[aria-current="location"]')) == null || L.scrollIntoView({ block: "center" });
  }, [e, i]), D(() => {
    var E, R;
    e === "search" && b >= 0 && ((R = (E = O.current) == null ? void 0 : E.querySelector('[aria-current="true"]')) == null || R.scrollIntoView({ block: "nearest" }));
  }, [e, b]);
  const z = (E) => {
    const R = S[E];
    R && (v(E), r(R.itemId));
  };
  return /* @__PURE__ */ x("aside", { ref: T, className: "reader-finder", "data-finder-tab": e, "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ x("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ x("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ p(re, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ p(re, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ p(re, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(ft, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" && f && d.length ? /* @__PURE__ */ x("div", { className: "reader-finder-switch", role: "radiogroup", "aria-label": "目录按什么列", children: [
      /* @__PURE__ */ p(re, { className: "reader-finder-switch-option", role: "radio", "aria-checked": y, onClick: () => h("bookmarks"), children: "按书签" }),
      /* @__PURE__ */ p(re, { className: "reader-finder-switch-option", role: "radio", "aria-checked": !y, onClick: () => h("headings"), children: "按标题" })
    ] }) : null,
    e === "outline" && y && l ? /* @__PURE__ */ p(hp, { nodes: c, currentPage: m, onJumpPage: l }) : e === "outline" ? d.length ? /* @__PURE__ */ p("ol", { ref: O, className: "reader-finder-list", children: d.map((E, R) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ x(
      re,
      {
        className: "reader-finder-entry",
        "data-level": E.level,
        "aria-current": R === w ? "location" : void 0,
        onClick: () => r(E.itemId),
        children: [
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-text", children: E.text }),
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: E.page })
        ]
      }
    ) }, E.itemId)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: u.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ x(xe, { children: [
      /* @__PURE__ */ x("div", { className: "reader-finder-search", children: [
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
              E.key === "Enter" ? (E.preventDefault(), z(tu(b, S.length, E.shiftKey))) : E.key === "Escape" && (E.preventDefault(), n()), E.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: S.length === 0 ? "没有找到" : `${b >= 0 ? `第 ${b + 1} / ` : ""}${S.length >= 200 ? "200+ 处，只列前 200 处" : `${S.length} 处`}${b < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { className: "reader-finder-list", children: S.map((E, R) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ x(re, { className: "reader-finder-entry is-hit", "aria-current": R === b ? "true" : void 0, onClick: () => z(R), children: [
        /* @__PURE__ */ x("span", { className: "reader-finder-entry-text", children: [
          E.snippet.slice(0, E.at),
          /* @__PURE__ */ p("mark", { children: E.snippet.slice(E.at, E.at + E.length) }),
          E.snippet.slice(E.at + E.length)
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: E.page })
      ] }) }, E.itemId)) })
    ] })
  ] });
}
function wp({
  active: e,
  extensions: t = ir
}) {
  const [n, r] = P(!1), [o, a] = P(null), s = xa(), i = (d) => {
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
  })(), m = M(null);
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
  }, [n, o]), /* @__PURE__ */ x("div", { className: "reader-toolball", ref: m, "data-open": n ? "true" : void 0, children: [
    u,
    n ? /* @__PURE__ */ p("div", { className: "reader-toolball-stack", role: "group", "aria-label": "工具", children: t.map((d) => {
      const f = cr([d]);
      return /* @__PURE__ */ x(Xn, { children: [
        i(d.id).map((g) => {
          const h = `${d.id}:${g.key}`, y = g.Icon;
          return /* @__PURE__ */ p(
            re,
            {
              className: "reader-toolball-item",
              "aria-label": g.label,
              title: g.title || g.label,
              "aria-pressed": !!g.pressed || o === h,
              "data-toolball-item": g.key,
              onClick: () => {
                var w;
                if (g.popup) {
                  a((S) => S === h ? null : h);
                  return;
                }
                (w = g.onClick) == null || w.call(g), r(!1);
              },
              children: /* @__PURE__ */ p(y, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
            },
            h
          );
        }),
        f.length ? /* @__PURE__ */ p(Um, { active: e, tabs: f }) : null
      ] }, d.id);
    }) }) : null,
    /* @__PURE__ */ p(
      re,
      {
        className: "reader-toolball-ball",
        "aria-label": n ? "收起工具" : `工具：${l.join("、")}`,
        title: n ? "收起" : "工具",
        "aria-expanded": n,
        "data-active": e || c ? "true" : void 0,
        onClick: () => {
          r((d) => !d), a(null);
        },
        children: n ? /* @__PURE__ */ p(ft, { size: 20, strokeWidth: 2.2, "aria-hidden": !0 }) : /* @__PURE__ */ p(ei, { size: 20, strokeWidth: 2.1, "aria-hidden": !0 })
      }
    )
  ] });
}
function Sp(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function kp(e) {
  var r;
  if (e.shiftKey || Sp(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${Qo}`))) return null;
  const n = Number((r = t.closest(`[${Te}]`)) == null ? void 0 : r.getAttribute(Te)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Ip({
  menu: e,
  onClose: t,
  actions: n,
  sections: r
}) {
  const o = M(null);
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
  return /* @__PURE__ */ x("div", { ref: o, className: "reader-ink-menu", style: { left: s, top: i }, "data-ink-menu": "true", children: [
    n.length ? /* @__PURE__ */ p("div", { className: "reader-ink-menu-actions", role: "menu", "aria-label": "书页", children: n.map((c) => /* @__PURE__ */ x(
      re,
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
function Ep({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ p("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ x("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
    /* @__PURE__ */ p("span", { children: n.phase === "failed" ? n.message : `改了 ${t} 处，还没排进 PDF` }),
    t ? /* @__PURE__ */ p(
      re,
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
const is = "retainpdf:reader:doc-theme:v1", Do = "data-reader-doc";
function cs() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Tp(e = cs()) {
  try {
    return (e == null ? void 0 : e.getItem(is)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function Rp(e, t = cs()) {
  try {
    t == null || t.setItem(is, e);
  } catch {
  }
}
function $o(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(Do, "dark") : t.removeAttribute(Do));
}
function Pp() {
  const [e, t] = P(() => Tp());
  D(() => {
    $o(e);
  }, [e]), D(() => () => $o("light"), []);
  const n = N(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return Rp(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
function Mp({ state: e, bookmarks: t }) {
  const { finder: n, setFinder: r, toggleFinder: o, findQuery: a, setFindQuery: s, findTerm: i, findFocus: c, jumpFromFinder: l, jumpToPageFromFinder: u } = e;
  return /* @__PURE__ */ x(xe, { children: [
    /* @__PURE__ */ p(bp, { open: n, onToggle: o }),
    n ? /* @__PURE__ */ p(
      vp,
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
function _p({
  session: e,
  zoomDocuments: t,
  zoomItem: n,
  setZoomItem: r,
  closeZoom: o,
  visiblePdfMode: a
}) {
  return /* @__PURE__ */ p(xe, { children: n ? /* @__PURE__ */ p(
    Nm,
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
function Np(e) {
  const t = e.sourceOnly || !e.translatedUrl, n = !!(e.overlayContentAvailable && e.liveTranslationVisible && !e.assistantOpen), o = e.assistantOpen && e.mode === "compare" ? "source" : e.mode, a = !t && (o === "translated" || o === "compare");
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
function Ap(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function xp(e, t) {
  const { sessionFiles: n } = e, [r, o] = P(!1), a = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, s = Np({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: n.translatedUrl,
    overlayContentAvailable: a,
    liveTranslationVisible: r,
    assistantOpen: t
  }), i = ul({
    hasOverlayContent: a,
    connection: e.liveTranslation.connection,
    showSource: s.showSource,
    liveTranslationVisible: r,
    assistantOpen: t
  }), c = s.sourceViewOnly, l = s.visibleMode;
  D(() => {
    o(!1);
  }, [e.viewStateKey]), D(() => {
    e.session.jobTerminal && o(!1);
  }, [e.session.jobTerminal]);
  const u = M(null);
  return D(() => {
    u.current !== e.viewStateKey && ml({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: c,
      jobTerminal: e.session.jobTerminal
    }) && (u.current = e.viewStateKey, o(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, c]), { liveTranslationVisible: r, setLiveTranslationVisible: o, paneComposition: s, liveToggles: i, sourceViewOnly: c, visiblePdfMode: l };
}
function Lp(e, { liveTranslationVisible: t, setLiveTranslationVisible: n, liveToggles: r, sourceViewOnly: o, visiblePdfMode: a }) {
  const s = dl(e.liveTranslation), i = N(() => {
    s && e.goToPage(s, "source");
  }, [e.goToPage, s]), [c, l] = P(null);
  D(() => {
    a === "compare" && e.session.jobTerminal && l(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, a]);
  const u = c !== e.viewStateKey && hl({
    state: e.liveTranslation,
    sourceViewOnly: o,
    visibleMode: a
  }), m = V(() => r.sourcePaneToggle ? /* @__PURE__ */ p(
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
function Cp(e, {
  translationVersions: t,
  bookmarks: n,
  regionHover: r,
  assistantPanel: o,
  closeAssistant: a,
  visiblePdfMode: s,
  changeWorkspace: i,
  jumpToBlockIn: c,
  zoomDocuments: l,
  editBlock: u
}) {
  const { session: m, panes: d } = e, f = M(e.currentPage);
  f.current = e.currentPage;
  const g = N(() => f.current, []), h = V(() => ({
    documentId: m.documentId || "",
    jobId: m.jobId,
    versionId: t.readingVersionId || null,
    translationVersions: t.versions,
    regions: m.regions,
    metadata: m.readerMetadata,
    bookmarks: n,
    pageCount: d.hudNumPages || 0,
    resetKey: e.viewStateKey,
    hoveredItemId: () => r.get().itemId,
    goToPage: e.goToPage,
    sourceOnly: e.sourceOnly,
    activePanel: o,
    closePanel: a,
    visibleMode: s,
    setWorkspace: i,
    jumpToBlock: c,
    shellEl: e.shell.shellEl,
    primaryPane: e.panes.primaryPane,
    pdfDocuments: l,
    editBlock: u,
    currentPage: g
  }), [
    m.documentId,
    m.jobId,
    t,
    m.regions,
    m.readerMetadata,
    n,
    d.hudNumPages,
    e.viewStateKey,
    r,
    e.goToPage,
    e.sourceOnly,
    o,
    a,
    s,
    i,
    c,
    e.shell.shellEl,
    e.panes.primaryPane,
    l,
    u
  ]), [y] = P(Ud), w = ef(y), S = V(() => Kd(w), [w]), b = V(() => Xd(w), [w]), v = V(() => Jd(w), [w]), k = V(() => Vd(w), [w]), T = qd(w), A = Gd(w);
  return { readerApi: h, contributionStore: y, contributions: w, pageLayers: S, compareVersion: b, textMarks: v, menuSections: k, pointerTakenId: T, reserveRight: A };
}
function Dp() {
  try {
    return Je().translationEdit ?? null;
  } catch {
    return null;
  }
}
const $p = "这本书正在处理（翻译或排版），处理完才能改。", Op = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function zp({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = Dp(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = ou(s), l = !t || Bt(t), u = uu(n), [m, d] = P(""), [f, g] = P(null), [h, y] = P(() => /* @__PURE__ */ new Map()), [w, S] = P(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [b, v] = P(() => /* @__PURE__ */ new Map()), [k, T] = P({ phase: "idle" }), A = M({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  D(() => {
    g(null), A.drafts.clear(), A.generation.current = null, v(/* @__PURE__ */ new Map()), T({ phase: "idle" });
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
      C || y(du(W, u));
    }).catch(() => {
    }), () => {
      C = !0;
    };
  }, [a, m, u, l]);
  const O = k.phase === "running" && k.seenActive;
  D(() => {
    if (k.phase === "running") {
      if (!l) {
        O || T({ phase: "running", seenActive: !0 });
        return;
      }
      O && T(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [k.phase, O, l, t]);
  const z = V(() => {
    const C = new Map(h);
    if (w.renderedAt === u)
      for (const [W, H] of w.edits) C.set(W, H);
    return C;
  }, [h, w, u]), _ = N((C) => {
    const W = `${C || ""}`.trim();
    W && g({ itemId: W, page: au(W) });
  }, []), I = N(() => g(null), []), E = N((C, W) => {
    S((H) => {
      const Y = new Map(H.renderedAt === u ? H.edits : []);
      return Y.set(C, W), { renderedAt: u, edits: Y };
    }), v((H) => new Map(H).set(C, (H.get(C) || 0) + 1));
  }, [u]), R = N(async () => {
    if (!(!a || !s || k.phase === "submitting" || k.phase === "running")) {
      T({ phase: "submitting" });
      try {
        await a.rerender(s), T({ phase: "running", seenActive: !1 }), await o();
      } catch (C) {
        T({ phase: "failed", message: (C == null ? void 0 : C.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, k.phase, o]), L = c ? Op : !l || k.phase === "running" || k.phase === "submitting" ? $p : "";
  return V(() => ({
    available: i,
    blockedReason: L,
    port: a,
    ownerJobId: m,
    target: f,
    select: _,
    close: I,
    memory: A,
    pendingEdits: z,
    savedCounts: b,
    markSaved: E,
    rerender: k,
    startRerender: R
  }), [i, L, a, m, f, _, I, A, z, b, E, k, R]);
}
function Fp(e, t) {
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
function Bp(e, t, n) {
  const { session: r, sessionFiles: o } = e, a = zp({
    jobId: r.jobId,
    jobStatus: r.jobStatus,
    jobPayload: r.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!o.translatedUrl,
    refreshJobStatus: r.refreshJobStatus
  }), s = a.select, i = e.setModeKeepingPage, c = r.regions, l = a.memory.drafts, u = N((d, f) => {
    va(c, d) && (t === "source" && i("compare"), f != null && f.trim() && l.set(d, f), s(d));
  }, [c, s, t, i, l]);
  Fp(a.available ? u : null, n);
  const m = V(() => {
    if (!a.savedCounts.size) return e.revisedBlocks;
    const d = new Map(e.revisedBlocks);
    for (const [f, g] of a.savedCounts) d.set(f, (d.get(f) || 0) + g);
    return d;
  }, [e.revisedBlocks, a.savedCounts]);
  return { blockEdit: a, editBlock: u, revisedBlocks: m };
}
const jp = "reader-finder-input";
function Hp(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function Up(e, t = typeof window > "u" ? null : window) {
  D(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!Hp(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(jp) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function Wp(e) {
  const [t, n] = P(null), r = N((f) => n((g) => g === f ? null : f), []), [o, a] = P(""), [s, i] = P("");
  D(() => {
    const f = o.replace(/\s+/gu, " ").trim(), g = window.setTimeout(() => i(f), f ? 150 : 0);
    return () => window.clearTimeout(g);
  }, [o]);
  const [c, l] = P(0), u = N(() => {
    n("search"), l((f) => f + 1);
  }, []);
  Up(u);
  const m = N((f) => {
    e.jumpToAnchor({ block_id: f }), (t === "outline" || et() < 900) && n(null);
  }, [e.jumpToAnchor, t]), d = N((f) => {
    e.goToPage(f), (t === "outline" || et() < 900) && n(null);
  }, [e.goToPage, t]);
  return { finder: t, setFinder: n, toggleFinder: r, findQuery: o, setFindQuery: a, findTerm: s, findFocus: c, jumpFromFinder: m, jumpToPageFromFinder: d };
}
function Kp(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : ra(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Vp(e, t) {
  return t === null || e !== t;
}
function qp(e, t) {
  const { boot: n } = e, r = M(null), o = M(null);
  D(() => {
    if (!(n.loading || n.failed)) {
      if (r.current !== e.viewStateKey) {
        r.current = e.viewStateKey;
        const a = je(e.viewStateKey), s = Kp({
          savedMode: a == null ? void 0 : a.mode,
          sourceViewOnly: t,
          viewportWidth: et()
        });
        o.current = s.auto ? s.mode : null, s.mode && s.mode !== e.mode && e.setModeKeepingPage(s.mode);
        return;
      }
      Vp(e.mode, o.current) && (o.current = null, gn(e.viewStateKey, { mode: e.mode }));
    }
  }, [n.failed, n.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, t]);
}
const Jp = [];
function Gp(e) {
  const { sessionFiles: t } = e, [n, r] = P({}), o = M({ source: t.sourceUrl, translated: t.translatedUrl });
  o.current = { source: t.sourceUrl, translated: t.translatedUrl };
  const a = N((y, w) => {
    r((S) => ({ ...S, [w]: { url: o.current[w], nodes: y } }));
  }, []), s = V(() => {
    const y = n.source;
    if (y && y.url === t.sourceUrl && y.nodes.length) return y.nodes;
    const w = n.translated;
    return w && w.url === t.translatedUrl && w.nodes.length ? w.nodes : Jp;
  }, [n, t.sourceUrl, t.translatedUrl]), i = M({}), [c, l] = P(0), u = N((y, w) => {
    i.current[w] = { url: o.current[w], pdf: y }, l((S) => S + 1);
  }, []), [m, d] = P(null), f = N((y) => d(y), []), g = N(() => d(null), []);
  D(() => d(null), [e.viewStateKey]);
  const h = V(() => {
    const y = (w, S) => {
      const b = i.current[w];
      return b && b.url === S ? b.pdf : null;
    };
    return { source: y("source", t.sourceUrl), translated: y("translated", t.translatedUrl) };
  }, [c, t.sourceUrl, t.translatedUrl]);
  return { bookmarks: s, onPdfOutline: a, onPdfDocument: u, zoomItem: m, setZoomItem: d, zoomBlock: f, closeZoom: g, zoomDocuments: h };
}
function Xp() {
  const e = Il(), { boot: t, panes: n, session: r } = e, o = lp(e.viewStateKey), a = o.panel, s = o.setPanel, i = a !== null, { liveTranslationVisible: c, setLiveTranslationVisible: l, paneComposition: u, liveToggles: m, sourceViewOnly: d, visiblePdfMode: f } = xp(e, i);
  qp(e, d);
  const g = a || (e.mode === "compare" ? "compare" : "reading"), { docDark: h, toggleDocDark: y } = Pp();
  Nl({
    toggleDocDark: y,
    mode: f,
    sourceOnly: e.sourceOnly,
    setMode: e.setModeKeepingPage,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    currentPage: e.currentPage,
    numPages: n.hudNumPages,
    goToPage: e.goToPage,
    enabled: e.showHud
  });
  const w = N(() => {
    s(null);
  }, []), { latestLivePage: S, jumpToLatestLivePage: b, offerCompletion: v, setCompletionDismissedKey: k, sourcePaneAction: T } = Lp(e, {
    liveTranslationVisible: c,
    setLiveTranslationVisible: l,
    liveToggles: m,
    sourceViewOnly: d,
    visiblePdfMode: f
  }), A = N((de) => {
    const _e = Ap(de, e.liveTranslationAvailable);
    _e !== null && l(_e), e.setModeKeepingPage(de);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), O = N((de) => {
    s(de);
  }, []), [z] = P(mp), _ = Wp(e), { finder: I, toggleFinder: E, findTerm: R } = _, L = N((de) => e.jumpToAnchor({ block_id: de }), [e.jumpToAnchor]), C = N((de, _e) => e.jumpToAnchor({ block_id: de }, _e), [e.jumpToAnchor]), { bookmarks: W, onPdfOutline: H, onPdfDocument: Y, zoomItem: oe, setZoomItem: Q, zoomBlock: ae, closeZoom: j, zoomDocuments: U } = Gp(e), { blockEdit: K, editBlock: he, revisedBlocks: J } = Bp(e, f, z), [G, pe] = P(null), ce = N(() => pe(null), []), fe = jf({ documentId: r.documentId, jobId: r.jobId }), {
    readerApi: ve,
    contributionStore: ye,
    contributions: ze,
    pageLayers: Ae,
    compareVersion: ie,
    textMarks: le,
    menuSections: we,
    pointerTakenId: F,
    reserveRight: Z
  } = Cp(e, {
    translationVersions: fe,
    bookmarks: W,
    regionHover: z,
    assistantPanel: a,
    closeAssistant: w,
    visiblePdfMode: f,
    changeWorkspace: A,
    jumpToBlockIn: C,
    zoomDocuments: U,
    editBlock: K.available && !K.blockedReason ? he : null
  }), $ = !!F, [q, ee] = P([]), ue = V(() => ({
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
    regionHover: z,
    jumpToBlock: L,
    revisedBlocks: J,
    onPdfOutline: H,
    onPdfDocument: Y,
    zoomBlock: ae,
    textMarks: le,
    pageLayers: Ae,
    editBlock: K.available ? he : void 0,
    blockEdit: K,
    editShowsSource: f !== "compare",
    findTerm: I === "search" ? R : "",
    compareVersion: ie,
    pointerTaken: $,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: d,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: O, close: w },
    docDark: h,
    toggleDocDark: y
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
    z,
    L,
    J,
    H,
    Y,
    ae,
    le,
    Ae,
    K,
    he,
    f,
    I,
    R,
    ie,
    $,
    e.sourceOnly,
    d,
    e.download,
    e.goToPage,
    O,
    w,
    h,
    y
  ]), ke = V(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), Ee = [
    ec,
    `is-workspace-${g}`,
    i ? "is-assistant-open" : "",
    I ? "is-finder-open" : "",
    u.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(Zd, { api: ve, store: ye, children: /* @__PURE__ */ p(od, { value: ue, hud: ke, children: /* @__PURE__ */ x(
    "div",
    {
      className: Ee,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": g,
      "data-pointer-taken": F || void 0,
      "data-right-inset": Z ? "true" : void 0,
      style: Z ? { "--reader-right-inset": `${Z}px` } : void 0,
      onContextMenu: (de) => {
        const _e = kp(de);
        if (!_e) return;
        const Le = Wd(ze, { target: de.target, clientX: de.clientX, clientY: de.clientY, page: _e.page });
        !Le.length && !we.length || (de.preventDefault(), ee(Le), pe(_e));
      },
      children: [
        /* @__PURE__ */ p(xh, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!r.readerErrors.regions, metadataError: !!r.readerErrors.metadata, onRetry: r.refreshJobArtifacts }),
        /* @__PURE__ */ p(Mp, { state: _, bookmarks: W }),
        /* @__PURE__ */ x("div", { className: "reader-chrome-tray", children: [
          /* @__PURE__ */ p(jh, {}),
          /* @__PURE__ */ p(Ol, { onBeforeClose: r.prepareClose })
        ] }),
        /* @__PURE__ */ p(
          Hd,
          {
            mode: f,
            documentReady: !!r.jobId,
            sourceViewOnly: d,
            onModeChange: A,
            liveTranslation: m.topBarPill ? {
              visible: c,
              state: e.liveTranslation,
              onToggle: () => l((de) => !de),
              latestPage: c ? S : null,
              currentPage: e.currentPage,
              onJumpToLatest: b
            } : null,
            completion: v ? {
              onOpenCompare: () => {
                k(e.viewStateKey), A("compare");
              }
            } : null
          }
        ),
        /* @__PURE__ */ p(Wm, { active: a }),
        i ? /* @__PURE__ */ p(Nh, {}) : null,
        /* @__PURE__ */ p(zd, { paneComposition: u, markdownSplit: i, assistantSplit: i, liveTranslation: e.liveTranslation, sourcePaneAction: T }),
        e.showHud ? /* @__PURE__ */ p(
          ip,
          {
            mode: f,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            issuesJobId: e.sourceOnly ? "" : r.jobId,
            searchSlot: /* @__PURE__ */ p(yp, { open: I, onToggle: E })
          }
        ) : null,
        /* @__PURE__ */ p(
          _p,
          {
            session: r,
            zoomDocuments: U,
            zoomItem: oe,
            setZoomItem: Q,
            closeZoom: j,
            visiblePdfMode: f
          }
        ),
        /* @__PURE__ */ p(wp, { active: a }),
        /* @__PURE__ */ p(Ip, { menu: G, onClose: ce, actions: q, sections: we }),
        /* @__PURE__ */ p(nf, { extensions: ir }),
        /* @__PURE__ */ p(Ep, { edit: K }),
        /* @__PURE__ */ p(fp, {})
      ]
    }
  ) }) });
}
function vg() {
  return /* @__PURE__ */ p(Xp, {});
}
export {
  vg as R,
  Xp as a,
  gg as b,
  bg as c,
  yf as d,
  wf as e,
  hg as f,
  pg as g,
  fg as h,
  mg as r,
  yg as s,
  Ge as u
};
//# sourceMappingURL=ReaderApp-CNjz7-Fe.js.map
