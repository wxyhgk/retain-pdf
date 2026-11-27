var as = Object.defineProperty;
var wr = (e) => {
  throw TypeError(e);
};
var ss = (e, t, n) => t in e ? as(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var Sr = (e, t, n) => ss(e, typeof t != "symbol" ? t + "" : t, n), kr = (e, t, n) => t.has(e) || wr("Cannot " + n);
var _t = (e, t, n) => (kr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Ir = (e, t, n) => t.has(e) ? wr("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Rr = (e, t, n, r) => (kr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as D, jsx as g, Fragment as $e } from "react/jsx-runtime";
import { useMemo as V, useState as _, useEffect as C, useCallback as x, useRef as N, useLayoutEffect as Te, memo as Vt, createContext as qt, useContext as st, Fragment as xo, forwardRef as Do, useImperativeHandle as Jn, useSyncExternalStore as mn, Component as is, Suspense as Co, lazy as Oo, useId as $o } from "react";
import { requireAdapter as Mt, getReaderAdapters as Me } from "./adapters.js";
import { resolveReaderDownloadName as cs, resolveReaderDownloadUrls as ls, READER_PROGRESS_COPY as je, trimString as on, READER_DOWNLOAD_ACTIONS as us, disabledReason as ds } from "./runtime/state.js";
import { r as fs, b as ms } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as _n, isFinishedJobStatus as Bt } from "@retainpdf/domain/job";
import { n as zo, d as hs, f as bn, k as Tr, b as ps, c as gs, j as _e, p as dt, g as bs, l as Tt, i as ys } from "./reader-regions-BmqHsJ-I.js";
import { fetchDocumentReading as vs } from "@retainpdf/api/documents";
import { isReaderTransportError as ws, createReaderTransportError as Ss } from "./contracts.js";
import { toast as Nn, Toaster as ks } from "sonner";
import { X as ft, PenLine as Gn, ZoomIn as Is, Check as Fo, Copy as Rs, ChevronUp as Ts, ChevronDown as Bo, History as Es, LoaderCircle as Ps, Pin as Ms, LogOut as _s, FileText as jo, Columns2 as Ho, Languages as Uo, Radio as Ns, ArrowDownToLine as As, CheckCircle2 as Ls, GitCompareArrows as xs, Keyboard as Ds, Download as Cs, ListOrdered as Os, TriangleAlert as $s, ChevronRight as Wo, Search as zs, ListTree as Fs, LayoutGrid as Bs, Highlighter as js, Eraser as Hs, Undo2 as Us, Trash2 as Ws, ChevronLeft as Ks, Minus as Vs, Plus as qs, ArrowLeft as Js } from "lucide-react";
import { Button as Q, Textarea as Gs, IconButton as at, Input as Ko } from "@retainpdf/ui";
import { pdfjs as Vo, Page as Xs, Document as Zs } from "react-pdf";
import { e as Ys, m as Qs, a as ei } from "./markdown-math-XkF5urpn.js";
const ti = (...e) => {
  var t, n;
  return ((n = (t = Me()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, ni = "", ri = Object.freeze({
  progress: "retainpdf-reader-progress"
}), oi = (e) => {
  var t, n;
  return ((n = (t = Me()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, zp = (...e) => {
  var n;
  return (((n = Me()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Fp = () => {
  var e, t;
  return ((t = (e = Me()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
}, He = () => Mt("defaultReaderDataPort"), Er = () => Mt("defaultReaderPageConfigPort"), Bp = {
  get apiPrefix() {
    return He().apiPrefix;
  },
  fetchProtected: (...e) => He().fetchProtected(...e),
  loadMarkdownPayload: (e) => He().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => He().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => He().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => He().loadJobPayload(e),
  loadReaderPayload: (e, t) => He().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => He().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return He().liveTranslation;
  }
}, qo = {
  messageTargetOrigin: () => Er().messageTargetOrigin(),
  readerJobId: () => Er().readerJobId()
}, ai = () => {
  var e;
  return ((e = Me()) == null ? void 0 : e.liveTranslation) ?? null;
}, jt = () => {
  var t;
  const e = Me();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, qe = () => {
  const e = Me();
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
}, si = (...e) => {
  var t, n;
  return ((n = (t = Me()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, ii = () => {
  var e, t;
  return ((t = (e = Me()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, ci = (...e) => {
  var t, n;
  return ((n = (t = Me()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, li = (...e) => {
  var t, n;
  return ((n = (t = Me()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? cs(...e);
}, ui = (...e) => {
  var t, n;
  return ((n = (t = Me()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? ls(...e);
}, di = (...e) => Mt("downloadProtectedResource")(...e), fi = (...e) => Mt("failDownloadToast")(...e), jp = (e, t) => Mt("resolveMarkdownAssetUrl")(e, t), Pr = "/api/v1";
function mi() {
  const e = () => {
    var r;
    return fs(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = _(e);
  return C(() => {
    var i, c, l, u;
    const r = () => n(e()), o = (c = (i = globalThis.history) == null ? void 0 : i.pushState) == null ? void 0 : c.bind(globalThis.history), a = (u = (l = globalThis.history) == null ? void 0 : l.replaceState) == null ? void 0 : u.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const m = (d) => function(...f) {
          const p = d.apply(this, f);
          return r(), globalThis.dispatchEvent(new Event("pushstate")), globalThis.dispatchEvent(new Event("replacestate")), globalThis.dispatchEvent(new Event("locationchange")), p;
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
function hi() {
  const e = mi(), t = V(() => ci(qo), [e]), n = V(() => ii(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function pi(e) {
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
  }), [u, m] = _({
    documentId: "",
    jobId: ""
  }), d = c.documentId === t ? c.jobId : "", f = u.documentId === t ? u.jobId : "", p = n || d, [h, b] = _({
    jobId: "",
    documentId: ""
  }), w = h.jobId === p ? h.documentId : "", v = t || w, y = !!t && !p, [S, k] = _(null), E = (S == null ? void 0 : S.sessionIdentity) === r && S.documentId === v ? S : null, L = y || !!E, $ = x((A) => {
    const I = `${A.documentId || ""}`.trim();
    if (!I || a.current && a.current !== I) return;
    if (!a.current && s.current)
      b({
        jobId: s.current,
        documentId: I
      });
    else if (!a.current)
      return;
    const R = `${A.revision || ""}`.trim() || `${Date.now()}`;
    k({
      documentId: I,
      revision: R,
      sessionIdentity: o.current
    }), i();
  }, []);
  C(() => {
    k((A) => A && A.sessionIdentity !== r ? null : A);
  }, [r]);
  const O = x((A) => {
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
        b((I) => I.jobId === A.jobId && I.documentId === A.documentId ? I : { jobId: A.jobId, documentId: A.documentId });
        break;
      case "committed-source":
        k({
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
    documentJobId: d,
    rejectedDocumentJobId: f,
    sessionJobId: p,
    resolvedJobDocument: h,
    setResolvedJobDocument: b,
    jobDocumentId: w,
    documentId: v,
    sourceOnly: y,
    committedDocumentSource: S,
    setCommittedDocumentSource: k,
    activeCommittedDocumentSource: E,
    sourceViewOnly: L,
    refreshCommittedDocument: $,
    applyIdentityEvent: O
  };
}
function Mr(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function gi(e) {
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
function _r(e, t) {
  return oi(_n(e, t));
}
function bi(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function yi(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !bi(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function An({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: ri.progress,
        stage: n,
        percent: e,
        text: t
      },
      qo.messageTargetOrigin()
    );
  } catch {
  }
}
function an(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), An({ percent: t, text: n, stage: r });
}
function vi(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = _(null), [l, u] = _(null), [m, d] = _(""), [f, p] = _(0), h = m === n ? i : null, b = m === n ? l : null, w = Mr(h), v = Bt(w), y = x(() => {
    p((O) => O + 1);
  }, []), S = x((O) => {
    c(O.jobPayload), u(O.manifestPayload), d(O.sessionIdentity);
  }, []), k = x((O) => {
    c(null), u(null), d(O);
  }, []), E = N(""), L = N(""), $ = x(async () => {
    const O = o.current;
    if (!O || E.current === O) return;
    const A = qe().loadJobPayload;
    if (typeof A != "function") return;
    const I = a.current.value;
    E.current = O;
    try {
      const R = await A(O);
      if (s.current || a.current.value !== I || o.current !== O || !R || typeof R != "object")
        return;
      const P = Mr(R);
      c(R), d(r.current), !Bt(P) && L.current === O && (L.current = ""), P === "succeeded" && L.current !== O && (L.current = O, p((T) => T + 1));
    } catch {
    } finally {
      E.current === O && (E.current = "");
    }
  }, []);
  return C(() => {
    L.current = "";
  }, [n]), C(() => {
    if (!t || v || !h) return;
    const O = window.setInterval(() => {
      document.visibilityState !== "hidden" && $();
    }, 1e3);
    return () => window.clearInterval(O);
  }, [v, $, h, t]), {
    jobPayload: i,
    setJobPayload: c,
    manifestPayload: l,
    setManifestPayload: u,
    payloadSessionIdentity: m,
    setPayloadSessionIdentity: d,
    scopedJobPayload: h,
    scopedManifestPayload: b,
    jobStatus: w,
    jobTerminal: v,
    jobRefreshRevision: f,
    refreshJobArtifacts: y,
    refreshJobStatus: $,
    publishPayload: S,
    clearPayload: k
  };
}
function Ln(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function wi(e, t) {
  e(t), Ln(t);
}
function Si(e) {
  const [t, n] = _(e ? "source" : "compare"), r = x((a) => {
    e && a !== "source" || (n(a), Ln(a));
  }, [e]), o = x((a) => {
    wi(n, a);
  }, []);
  return C(() => (e && document.documentElement.classList.add("reader-source-only"), Ln(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Nr(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function ki(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Nr(n.active_job_id),
    activeVersionId: Nr(n.active_version_id)
  };
}
function Ii(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Ri(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Ti(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Ei = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Pi(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Ei.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const Mi = 48 * 1024 * 1024;
function _i(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Ni = 2, Pe = /* @__PURE__ */ new Map();
function xn(e, t) {
  Pe.delete(e), Pe.set(e, t);
}
function Ar(e) {
  if (Pe.size < Ni) return;
  const t = Pe.keys().next().value;
  t && Pe.delete(t);
}
async function Ai(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function Jo(e, t = jt().fetchProtected, n = {}) {
  var u, m, d, f, p, h, b, w, v;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (Pe.has(r)) {
    const y = Pe.get(r);
    return xn(r, y), y;
  }
  const o = new AbortController(), a = () => o.abort();
  (u = n.signal) != null && u.aborted && o.abort(), (d = (m = n.signal) == null ? void 0 : m.addEventListener) == null || d.call(m, "abort", a, { once: !0 });
  let s;
  try {
    s = await t(r, { signal: o.signal });
  } finally {
    (p = (f = n.signal) == null ? void 0 : f.removeEventListener) == null || p.call(f, "abort", a);
  }
  if (!s.ok) {
    const y = new Error(`读取 PDF 失败 (${s.status})`);
    y.status = s.status;
    const S = await Ai(s);
    throw S && (y.reason = S), y;
  }
  const i = Li(r, s, t);
  if (i) {
    o.abort();
    const y = { ranged: i };
    return Ar(), Pe.set(r, y), y;
  }
  (b = (h = n.signal) == null ? void 0 : h.addEventListener) == null || b.call(h, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (v = (w = n.signal) == null ? void 0 : w.removeEventListener) == null || v.call(w, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return Pe.has(r) ? xn(r, l) : (Ar(), Pe.set(r, l)), l;
}
function Li(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < Mi ? null : {
    url: e,
    length: o,
    async fetchRange(i, c) {
      const l = await n(e, { headers: { Range: `bytes=${i}-${c - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const xi = { file: null, loading: !1, error: "" }, Di = { file: null, loading: !0, error: "" };
function Ci(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = _(null);
  if (C(() => {
    if (t || !n) return;
    const s = Pe.get(n);
    if (s) {
      xn(n, s);
      return;
    }
    const i = new AbortController();
    return Jo(n, void 0, { signal: i.signal }).then((c) => {
      i.signal.aborted || o({ url: n, file: c, loading: !1, error: "" });
    }).catch((c) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (c == null ? void 0 : c.message) || String(c) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return xi;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = Pe.get(n);
  return a ? { file: a, loading: !1, error: "" } : Di;
}
function Oi(e) {
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
async function Dn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  an(s, r, n, "download");
  const i = await Jo(t, jt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (an(s, o, n, "download"), i);
}
async function $i(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  an(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    Dn({
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
    Dn({
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
function zi(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Fi({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = vs,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(zi(o.href, t, a)), !0);
}
const Zt = {
  regions: null,
  metadata: null
};
function Bi(e) {
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
    jobRefreshRevision: p,
    sessionEpochRef: h,
    closingRef: b,
    activeLoadAbortRef: w
  } = e, [v, y] = _(""), [S, k] = _(""), [E, L] = _(null), [$, O] = _(null), [A, I] = _(!1), [R, P] = _(""), [T, M] = _([]), [B, z] = _(!1), [G, J] = _(() => ({
    source: null,
    translated: null
  })), [ne, oe] = _(
    Zt
  ), [j, U] = _({
    loading: !0,
    percent: 4,
    text: je.boot,
    stage: "progress",
    failed: !1
  });
  return C(() => {
    const W = new AbortController(), pe = h.current.value, q = Oi({
      sessionEpochRef: h,
      closingRef: b,
      abort: W,
      sessionEpoch: pe
    });
    w.current = W;
    const K = qe();
    if (b.current)
      return W.abort(), () => {
        w.current === W && (w.current = null);
      };
    let ie = !1;
    function ue(se, ce) {
      q.markFailed(), z(!0), U({
        loading: !1,
        percent: 100,
        text: se,
        stage: "failed",
        failed: !0
      }), An({ percent: 100, text: ce, stage: "failed" });
    }
    function ae() {
      I(!0), ie || z(!0), U({
        loading: !1,
        percent: 100,
        text: je.ready,
        stage: "ready",
        failed: !1
      }), An({ percent: 100, text: je.ready, stage: "ready" });
    }
    function he() {
      return l != null && l.documentId ? _r(
        l.documentId,
        l.revision
      ) : ti() ? ni : K.resolveResourceUrl(_n(r));
    }
    async function Re() {
      var ee;
      let se = { activeJobId: "", activeVersionId: "" };
      try {
        const re = await ((ee = K.fetchDocument) == null ? void 0 : ee.call(K, r));
        re && (se = ki(re));
      } catch {
      }
      const ce = Ii({
        link: se,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (ce.kind === "follow-active-job") {
        if (q.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: ce.jobId
        }), ce.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: ce.activeVersionId,
          sessionIdentity: c
        }), f("source")) : f("compare");
        return;
      }
      if (ce.kind === "open-committed-source") {
        if (q.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: ce.revision,
          sessionIdentity: c
        }), f("source");
        return;
      }
      const be = he();
      if (q.isInactive()) return;
      y(be), k(""), P(""), d(c);
      const H = await Dn({
        url: be,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: q,
        setBoot: U
      });
      if (!q.isInactive()) {
        if (!H) {
          ue("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        L(H), ae();
      }
    }
    async function ze() {
      var Xt;
      const se = !l, ce = !!(se && K.loadSessionSnapshot && K.loadReaderOptionalArtifacts), be = ce ? K.loadReaderOptionalArtifacts(t) : null, H = await ((Xt = K.loadSessionSnapshot) == null ? void 0 : Xt.call(K, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: se && !ce
      })), ee = H ? {
        jobPayload: H.sourcePayload,
        manifestPayload: H.manifestPayload,
        readerMetadata: H.readerMetadata,
        regionsPayload: H.regions,
        readerErrors: H.readerErrors
      } : await K.loadReaderPayload(t, {
        includeOptionalArtifacts: se
      });
      if (q.isInactive()) return;
      let re = null;
      if (n && !r)
        if (H && H.linkedDocument !== void 0)
          re = H.linkedDocument;
        else {
          try {
            re = await K.fetchDocumentByJobId(Pr, t);
          } catch {
          }
          if (q.isInactive()) return;
        }
      const Ne = gi(ee.jobPayload) || `${(re == null ? void 0 : re.document_id) || ""}`.trim();
      Ne && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Ne
      });
      const Ee = Ri({
        payloadDocumentId: Ne,
        linkedActiveJobId: `${(re == null ? void 0 : re.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(re == null ? void 0 : re.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (Ee.kind === "restore-committed-source") {
        if (q.isInactive()) return;
        u({
          type: "committed-source",
          documentId: Ee.documentId,
          revision: Ee.revision,
          sessionIdentity: c
        }), f("source");
        return;
      }
      const xe = K.resolveReaderSourcePdf(ee.manifestPayload), fe = K.resolveReaderTranslatedPdfUrl(ee.jobPayload, ee.manifestPayload), Se = typeof xe == "string" ? xe : K.resolveReaderArtifactUrl(xe), Fe = r || Ne, Ge = l != null && l.documentId ? _r(
        l.documentId,
        l.revision
      ) : Se || (Fe ? K.resolveResourceUrl(_n(Fe)) : ""), Be = l ? "" : fe || "";
      y(Ge || ""), k(Be), P(yi(ee.jobPayload, t)), m({
        jobPayload: ee.jobPayload || null,
        manifestPayload: ee.manifestPayload || null,
        sessionIdentity: c
      });
      const rt = () => $i({
        sourceFinal: Ge || "",
        translatedFinal: Be,
        fence: q,
        setBoot: U
      }), pt = !!(Ge || Be), gt = be && pt ? rt() : null;
      gt == null || gt.catch(() => {
      });
      const Gt = (F) => {
        q.isInactive() || (M(l ? [] : zo(F.regionsPayload)), J(l ? { source: null, translated: null } : hs(F.readerMetadata)), oe(l ? Zt : F.readerErrors ?? Zt), z(!0));
      };
      if (be ? (ie = !0, be.then(Gt)) : Gt(ee), !pt) {
        ue(je.failed, je.failed);
        return;
      }
      const bt = await (gt ?? rt());
      if (bt.status !== "inactive") {
        if (bt.status === "incomplete") {
          ue("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        L(bt.sourceBytes), O(bt.translatedBytes), ae();
      }
    }
    async function Le() {
      I(!1), L(null), O(null), M([]), z(!1), J({ source: null, translated: null }), oe(Zt), an(U, 8, je.metadata, "metadata");
      try {
        if (s) {
          await Re();
          return;
        }
        if (!t) {
          ue(je.failed, je.failed);
          return;
        }
        await ze();
      } catch (se) {
        if (q.isClosedOrStale() || (se == null ? void 0 : se.name) === "AbortError") return;
        q.markFailed();
        const ce = Number(se == null ? void 0 : se.status), be = `${(se == null ? void 0 : se.reason) || ""}`, H = Pi({ status: ce, reason: be, sessionJobId: t });
        if (H && (await Fi({
          apiPrefix: Pr,
          documentId: H,
          expiredJobId: t
        }) || q.isClosedOrStale()))
          return;
        if (Ti({
          status: ce,
          reason: be,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), f("source");
          return;
        }
        const ee = se instanceof Error ? se.message : je.failed;
        ue(ee, ee);
      }
    }
    return Le(), () => {
      W.abort(), w.current === W && (w.current = null);
    };
  }, [t, r, o, a, s, i, l, p, n, c, u, m, d, f]), {
    sourceUrl: v,
    translatedUrl: S,
    sourceFile: E,
    translatedFile: $,
    assetsReady: A,
    title: R,
    regions: T,
    regionsSettled: B,
    readerMetadata: G,
    readerErrors: ne,
    boot: j
  };
}
function ji() {
  const e = N(!1), t = N(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = hi(), s = N({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = N(a), c = N(""), l = N(""), u = N(() => {
  }), m = x(() => u.current(), []), d = pi({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: i,
    documentIdRef: c,
    sessionJobIdRef: l,
    switchToSourceMode: m
  }), {
    sessionJobId: f,
    documentId: p,
    sourceOnly: h,
    sourceViewOnly: b
  } = d, { mode: w, setMode: v, switchSessionMode: y } = Si(b);
  u.current = () => {
    y("source");
  }, i.current = a, c.current = p, l.current = f;
  const S = vi({
    sessionJobId: f,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: k,
    scopedManifestPayload: E,
    jobStatus: L,
    jobTerminal: $,
    jobRefreshRevision: O,
    refreshJobArtifacts: A,
    refreshJobStatus: I
  } = S, R = Bi({
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
    publishPayload: S.publishPayload,
    clearPayload: S.clearPayload,
    switchSessionMode: y,
    jobRefreshRevision: O,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), P = x(() => {
    var M;
    e.current = !0, (M = t.current) == null || M.abort();
  }, []), T = V(
    () => ({
      fetchProtected: qe().fetchProtected,
      jobId: f,
      jobPayload: k,
      manifestPayload: E,
      sourceUrl: R.sourceUrl,
      translatedUrl: R.translatedUrl,
      sourceOnly: b
    }),
    [f, k, E, R.sourceUrl, R.translatedUrl, b]
  );
  return {
    jobId: f,
    jobStatus: L,
    workflow: `${(k == null ? void 0 : k.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: $,
    documentId: p,
    sessionIdentity: a,
    sourceOnly: h,
    mode: w,
    setMode: v,
    sourceUrl: R.sourceUrl,
    translatedUrl: R.translatedUrl,
    sourceFile: R.sourceFile,
    translatedFile: R.translatedFile,
    assetsReady: R.assetsReady,
    boot: R.boot,
    title: R.title,
    regions: R.regions,
    regionsSettled: R.regionsSettled,
    readerMetadata: R.readerMetadata,
    readerErrors: R.readerErrors,
    download: T,
    refreshJobArtifacts: A,
    refreshJobStatus: I,
    refreshCommittedDocument: d.refreshCommittedDocument,
    prepareClose: P
  };
}
const Hi = 160, Ui = 8, Wi = 0;
function Ki() {
  const e = N(null), [t, n] = _(null), [r, o] = _(Wi), a = x((s) => {
    e.current = s, n(s);
  }, []);
  return C(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (l) => {
      !Number.isFinite(l) || l < Hi || o((u) => Math.abs(u - l) < Ui ? u : l);
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
function Vi(e) {
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
const yn = { source: 0, translated: 0 };
function qi(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    sourceUrl: a,
    translatedUrl: s,
    sourceFile: i,
    translatedFile: c
  } = e, l = `${(t == null ? void 0 : t.identityKey) || ""}\0${a}\0${s}`, u = N(l);
  u.current = l;
  const [m, d] = _(() => ({
    identity: l,
    pages: yn
  })), [f, p] = _(() => ({ identity: l, tick: 0 })), h = m.identity === l ? m.pages : yn, b = f.identity === l ? f.tick : 0, w = Vi({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: v } = w, y = x((I, R) => {
    u.current === l && d((P) => {
      const T = P.identity === l ? P.pages : yn;
      return T[R] === I && P.identity === l ? P : {
        identity: l,
        pages: { ...T, [R]: I }
      };
    });
  }, [l]), S = N(null), k = x(() => {
    S.current && clearTimeout(S.current);
    const I = l;
    S.current = setTimeout(() => {
      S.current = null, u.current === I && p((R) => ({
        identity: I,
        tick: R.identity === I ? R.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  C(() => (S.current && (clearTimeout(S.current), S.current = null), d((I) => I.identity === l && I.pages.source === 0 && I.pages.translated === 0 ? I : { identity: l, pages: { source: 0, translated: 0 } }), p((I) => I.identity === l && I.tick === 0 ? I : { identity: l, tick: 0 }), () => {
    S.current && (clearTimeout(S.current), S.current = null);
  }), [l]);
  const E = V(
    () => Math.max(h.source, h.translated),
    [h]
  ), L = v === "translated" ? h.translated : h.source || h.translated, $ = t == null ? void 0 : t.userZoom, O = t == null ? void 0 : t.shellWidth, A = `${l}-${b}-${$}-${n}-${h.source}-${h.translated}-${O}`;
  return {
    ...w,
    numPagesByPane: h,
    hudNumPages: E,
    primaryNumPages: L,
    metricsTick: b,
    onNumPages: y,
    onMetrics: k,
    rowSyncRevision: A
  };
}
const Ie = "data-reader-page", we = "data-reader-pane", Xn = "data-natural-height", Ji = "reader-react-root", Go = "reader-react-grid", Xo = "reader-react-scroll-shell", hn = "reader-react-pdf-pane", Zo = "reader-react-pdf-page", sn = "reader-react-pdf-page-placeholder", Zn = "reader-react-pdf-page-slot";
function cn(e, t) {
  const n = e != null ? `[${Ie}="${e}"]` : `[${Ie}]`;
  return t ? `${n}[${we}="${t}"]` : n;
}
function Yn() {
  return `.${Zn}[${Ie}]`;
}
function ln(e) {
  return Number(e.getAttribute(Ie));
}
const Yo = 0.25, un = 1, Gi = 0.05, Jt = 0.5, Xi = 16, Zi = 8, Qo = Xi + Zi, Yi = 720;
function et() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function ea(e) {
  return Number.isFinite(e) && e < Yi;
}
function St(e, t = Number.POSITIVE_INFINITY) {
  return ea(t) && (e === "source" || e === "translated") ? un : Jt;
}
function Ke(e) {
  return Number.isFinite(e) ? Math.min(un, Math.max(Yo, e)) : Jt;
}
function Ht(e, t) {
  const n = Ke(Number(e) + t * Gi);
  return Math.round(n * 100) / 100;
}
function Qi(e) {
  return Math.round(Ke(e) * 100);
}
function ta(e) {
  const n = (Number(e) || 0) - Qo;
  return Math.max(160, Math.floor(n));
}
function ec(e, t = Jt) {
  const n = Ke(t);
  return ta((Number(e) || 0) * n);
}
function tc(e, t) {
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
const nc = 8;
function rc(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < nc ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const na = 200, oc = [
  "markdown"
], ac = oc;
function ra(e) {
  return ac.includes(e);
}
const sc = "retainpdf:reader:view:v1:", Lr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), ic = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function oa() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Cn(e) {
  return `${e || ""}`.trim();
}
function cc({
  documentId: e,
  jobId: t
}) {
  const n = Cn(e);
  if (n) return `document:${n}`;
  const r = Cn(t);
  return r ? `job:${r}` : "";
}
function aa(e) {
  const t = Cn(e);
  return t ? `${sc}${t}` : "";
}
function lc(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function uc(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!Lr.has(t) || !Lr.has(n) || t === n))
    return { left: t, right: n };
}
function dc(e) {
  return e === null ? null : ra(e) ? e : void 0;
}
function fc(e) {
  return ic.has(e) ? e : void 0;
}
function sa(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = lc(t.anchor), r = Number(t.zoom), o = fc(t.mode), a = uc(t.splitLayout), s = dc(t.assistantPanel);
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
function Oe(e, t = oa()) {
  const n = aa(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? sa(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function pn(e, t, n = oa()) {
  const r = aa(e);
  if (!r || !n) return null;
  const o = Oe(e, n), a = sa({
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
function mc(e, t, n = "") {
  var d;
  const [r, o] = _(() => {
    var f;
    return ((f = Oe(n)) == null ? void 0 : f.zoom) ?? St(e, et());
  }), a = N(r), s = N(n);
  a.current = r;
  const i = N(1), c = N(((d = Oe(n)) == null ? void 0 : d.zoom) !== void 0);
  C(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const f = (h = Oe(n)) == null ? void 0 : h.zoom;
    c.current = f !== void 0;
    const p = f ?? St(e, et());
    i.current = 1, a.current = p, o(p);
  }, [e, n]), C(() => {
    if (c.current) return;
    const f = St(e, et()), p = a.current;
    Math.abs(f - p) < 5e-4 || (i.current = 1, a.current = f, o(f));
  }, [e]);
  const l = x((f, p) => {
    const h = Ke(f), b = a.current;
    Math.abs(h - b) < 5e-4 || (i.current = (p == null ? void 0 : p.keepScroll) === !1 ? 1 : h / (b || 1), a.current = h, c.current = !0, pn(s.current, { zoom: h }), o(h));
  }, []), u = x((f) => {
    l(Ht(a.current, f));
  }, [l]), m = x((f) => {
    l(St(f));
  }, [l]);
  return Te(() => {
    const f = i.current;
    Math.abs(f - 1) < 1e-3 || (i.current = 1, tc(t == null ? void 0 : t.current, f));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: m };
}
const hc = 160, pc = 3e-3, xr = 50, gc = 16, bc = 800;
function yc(e, t = 0) {
  const n = t === 1 ? gc : t === 2 ? bc : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-xr, Math.min(xr, r));
  return Math.exp(-o * pc);
}
function vc(e, t, n = 0) {
  return Ke(e * yc(t, n));
}
function wc(e) {
  return Math.round(Ke(e) * 100) / 100;
}
function Sc(e, t, n) {
  const r = Ke(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return Ke(t) / r;
  const a = (o + Qo) / r;
  return ta(a * Ke(t)) / o;
}
function kc(e) {
  return Array.from(e.querySelectorAll(Yn()));
}
function Ic(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function Rc(e, t, n) {
  let r = null;
  for (const s of kc(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const c = Ic(i, t, n);
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
function Tc(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function ia(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${Yn()}[${Ie}="${t.page}"][${we}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (Tc(n, e).scrollLeft += a);
}
function Ec(e, t, n, r) {
  const o = e.querySelector(`.${Go}`);
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
const Pc = 600, Mc = 1e3;
function _c(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || ia(e, t);
  });
  a.observe(n);
  const s = (u) => {
    u.type === "wheel" && u.ctrlKey || l();
  }, i = ["wheel", "keydown", "pointerdown", "touchstart"];
  for (const u of i) r.addEventListener(u, s, { capture: !0, passive: !0 });
  const c = r.setTimeout(() => l(), Mc);
  function l() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(c);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return l;
}
function Nc(e, t, n) {
  const r = N(t);
  r.current = t;
  const o = N(n);
  o.current = n;
  const a = N(null), s = N(null), i = N(null);
  C(() => {
    if (!e) return;
    const c = () => {
      const u = a.current;
      if (a.current = null, !u) return;
      const m = wc(u.target);
      if (Math.abs(m - r.current) < 5e-3) {
        Nt(u.grid);
        return;
      }
      const d = { anchor: u.anchor, grid: u.grid, fallback: null };
      d.fallback = setTimeout(() => {
        s.current === d && (s.current = null, Nt(d.grid));
      }, Pc), s.current = d, o.current(m, { keepScroll: !1 });
    }, l = (u) => {
      var f, p;
      if (!u.ctrlKey) return;
      u.preventDefault();
      let m = a.current;
      if (!m) {
        (f = i.current) == null || f.call(i), i.current = null;
        const h = s.current;
        h && (h.fallback && clearTimeout(h.fallback), s.current = null, Nt(h.grid)), m = {
          start: r.current,
          target: r.current,
          anchor: Rc(e, u.clientX, u.clientY),
          grid: null,
          timer: null
        }, a.current = m;
      }
      m.target = vc(m.target, u.deltaY, u.deltaMode);
      const d = Sc(m.start, m.target, ((p = m.anchor) == null ? void 0 : p.pageWidth) ?? 0);
      m.grid = Ec(e, d, u.clientX, u.clientY) ?? m.grid, m.timer && clearTimeout(m.timer), m.timer = setTimeout(c, hc);
    };
    return e.addEventListener("wheel", l, { passive: !1 }), () => {
      var m;
      e.removeEventListener("wheel", l);
      const u = a.current;
      a.current = null, u != null && u.timer && clearTimeout(u.timer), Nt((u == null ? void 0 : u.grid) ?? null), (m = i.current) == null || m.call(i), i.current = null;
    };
  }, [e]), Te(() => {
    var l;
    const c = s.current;
    c && (s.current = null, c.fallback && clearTimeout(c.fallback), Nt(c.grid), !(!e || !c.anchor) && (ia(e, c.anchor), (l = i.current) == null || l.call(i), i.current = _c(e, c.anchor)));
  }, [t, e]);
}
function Ac(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = N(t), a = N(n), s = N(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: x((c) => {
    c !== o.current && (s.current(), a.current(c));
  }, []) };
}
const Qn = 48;
function ca(e, t = Qn) {
  return e.getBoundingClientRect().top + t;
}
function la(e, t) {
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
  const o = ln(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function zt(e, t, n = Qn) {
  if (!e)
    return null;
  const r = cn(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = ca(e, n), i = la(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function Et(e, t, n = "auto", r, o = Qn) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(cn(a, r))), i || (i = e.querySelector(cn(a))), !i)
    return !1;
  const c = e.getBoundingClientRect(), l = i.getBoundingClientRect();
  if (c.height <= 0 || l.height < 8 && i.offsetHeight < 8)
    return !1;
  const u = l.height > 0 ? l.height : i.offsetHeight, m = e.scrollTop + (l.top - c.top), d = Math.max(0, m + s * u - o);
  return n === "auto" ? Math.abs(e.scrollTop - d) >= 1 && (e.scrollTop = d) : e.scrollTo({ top: d, behavior: n }), !0;
}
function Lc(e, t, n = "smooth", r) {
  return Et(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function On(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const i = [], c = () => {
    var u;
    if (a) return;
    Et(
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
function xc(e, t, n) {
  return On(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function dn(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function Ae(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function Dc(e, t, n = !0, r = "", o) {
  const [a, s] = _(1);
  return C(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const i = e.current;
    if (!i)
      return;
    let c = !1, l = null, u = 0;
    const m = cn(void 0, o), d = () => {
      if (c) return;
      const h = Array.from(i.querySelectorAll(m));
      if (!h.length)
        return;
      const b = ca(i), w = la(h, b);
      w && s(w.page);
    }, f = () => {
      c || (u && cancelAnimationFrame(u), u = requestAnimationFrame(() => {
        u = 0, d();
      }));
    }, p = () => {
      if (c) return;
      if (!Array.from(i.querySelectorAll(m)).length) {
        l = setTimeout(p, 120);
        return;
      }
      d(), i.addEventListener("scroll", f, { passive: !0 });
    };
    return p(), () => {
      c = !0, l && clearTimeout(l), u && cancelAnimationFrame(u), i.removeEventListener("scroll", f);
    };
  }, [e, t, n, r, o]), a;
}
const Cc = `canvas, .react-pdf__Page, .${Zo}, .${sn}`, Dr = /* @__PURE__ */ new WeakMap();
function Oc(e) {
  const t = Number(e.getAttribute(Xn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Dr.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(Cc), Dr.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function $c(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function zc(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(Yn()).forEach((r) => {
    const o = ln(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = Oc(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Fc(e, t, n = "", r) {
  const [o, a] = _(() => /* @__PURE__ */ new Map()), s = N(o), i = N(r);
  return i.current = r, Te(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let c = !1, l = 0, u = !1, m = !1;
    const d = () => {
      var k;
      if (c) return;
      const y = e.current;
      if (!y) return;
      const S = zc(y);
      $c(s.current, S) || (s.current = S, a(S)), u && !m && (m = !0, (k = i.current) == null || k.call(i));
    }, f = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(d);
      });
    };
    f();
    const p = window.setTimeout(f, 100), h = window.setTimeout(() => {
      u = !0, f();
    }, 300), b = window.setTimeout(f, 700), w = e.current;
    let v = null;
    return w && typeof ResizeObserver < "u" && (v = new ResizeObserver(() => f()), v.observe(w)), () => {
      c = !0, cancelAnimationFrame(l), window.clearTimeout(p), window.clearTimeout(h), window.clearTimeout(b), v == null || v.disconnect();
    };
  }, [e, t, n]), o;
}
const Bc = [0, 48, 140, 320, 560], jc = 700, Hc = [80, 200, 400], Uc = 500, Wc = 50, Kc = /* @__PURE__ */ new Set([
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
]), Vc = 180, Cr = [0, 48, 140, 320, 700, 1200];
function qc(e, t) {
  var R;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = N(
    ((R = Oe(a)) == null ? void 0 : R.anchor) || { page: 1, fraction: 0 }
  ), c = N(null), l = N(!1), u = N(r), m = N(null), d = N(null), f = N(null), p = N(null), h = N(a), b = N(""), w = N(n);
  w.current = n;
  const v = x(() => {
    var P;
    (P = m.current) == null || P.call(m), m.current = null, d.current != null && (clearTimeout(d.current), d.current = null);
  }, []), y = x(() => {
    !l.current && c.current == null || (v(), f.current != null && (clearTimeout(f.current), f.current = null), c.current = null, l.current = !1);
  }, [v]), S = x((P = !1) => {
    p.current != null && (clearTimeout(p.current), p.current = null);
    const T = () => {
      p.current = null, pn(h.current, {
        anchor: Ae(i.current)
      });
    };
    P ? T() : p.current = setTimeout(T, Vc);
  }, []), k = x((P) => {
    i.current = Ae(P), c.current = null, f.current != null && clearTimeout(f.current), f.current = setTimeout(() => {
      f.current = null, l.current = !1;
    }, Wc);
  }, []);
  C(() => {
    if (!o)
      return;
    let P = !1, T = null, M = null, B = null;
    const z = () => {
      if (P) return;
      const G = e.current;
      if (!G) {
        B = setTimeout(z, 50);
        return;
      }
      T = G, M = () => {
        if (l.current)
          return;
        const J = zt(T, w.current);
        J && (i.current = J, S());
      }, T.addEventListener("scroll", M, { passive: !0 }), l.current || M();
    };
    return z(), () => {
      P = !0, B != null && clearTimeout(B), T && M && T.removeEventListener("scroll", M);
    };
  }, [o, r, n, e, S]), C(() => {
    if (!o) return;
    const P = e.current;
    if (!P) return;
    const T = (M) => {
      M.metaKey || M.ctrlKey || M.altKey || Kc.has(M.key) && y();
    };
    return P.addEventListener("wheel", y, { passive: !0 }), P.addEventListener("touchmove", y, { passive: !0 }), window.addEventListener("keydown", T), () => {
      P.removeEventListener("wheel", y), P.removeEventListener("touchmove", y), window.removeEventListener("keydown", T);
    };
  }, [o, e, y]), Te(() => {
    var T;
    if (h.current === a) return;
    S(!0), v(), f.current != null && (clearTimeout(f.current), f.current = null), h.current = a, b.current = "";
    const P = (T = Oe(a)) == null ? void 0 : T.anchor;
    i.current = P ? Ae(P) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, u.current = r;
  }, [a, r, S, v]), C(() => {
    var T;
    if (!o || !s || !a || b.current === a) return;
    b.current = a;
    const P = Ae(
      ((T = Oe(a)) == null ? void 0 : T.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = P, c.current = P, l.current = !0, v(), m.current = On(
      () => e.current,
      P,
      {
        behavior: "auto",
        pane: w.current,
        delaysMs: Cr,
        onDone: () => k(P)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(P);
    }, Math.max(...Cr) + 160), () => v();
  }, [o, s, a, e, k, v]), C(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, c.current = null, v();
      return;
    }
    const P = c.current ? Ae(c.current) : Ae(i.current);
    return l.current = !0, c.current = P, i.current = P, v(), m.current = On(
      () => e.current,
      P,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Bc,
        onDone: () => k(P)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(P);
    }, jc), () => {
      v();
    };
  }, [r, o, n, e, k, v]), C(() => () => {
    v(), f.current != null && (clearTimeout(f.current), f.current = null), S(!0);
  }, [v, S]);
  const E = x(() => {
    const P = zt(
      e.current,
      w.current
    );
    return Ae(P || i.current);
  }, [e]), L = x(() => {
    l.current = !0;
    const P = zt(
      e.current,
      w.current
    ), T = Ae(P ?? i.current);
    return i.current = T, c.current = T, S(), T;
  }, [e, S]), $ = x((P, T, M) => {
    const B = M || w.current, z = dn(P, T || 1), G = { page: z, fraction: 0 };
    i.current = G, l.current = !0, c.current = G, S(), v(), Lc(e.current, z, "smooth", B), m.current = xc(
      () => e.current,
      z,
      {
        behavior: "auto",
        pane: B,
        delaysMs: Hc,
        onDone: () => k(G)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(G);
    }, Uc);
  }, [e, k, v, S]), O = x(() => Ae(i.current), []), A = x(() => l.current, []), I = x(() => {
    if (!l.current || !c.current)
      return;
    const P = Ae(c.current);
    Et(
      e.current,
      P,
      "auto",
      w.current
    );
  }, [e]);
  return {
    lockFromShell: E,
    beginModeSwitch: L,
    goToPage: $,
    getAnchor: O,
    isRestoring: A,
    repinIfRestoring: I
  };
}
function Jc(e, t) {
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
function ua(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const Gc = [0, 80, 200, 400, 800], Xc = 120, Zc = 400;
function Yc(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: c, documentId: l, regionsSettled: u = !0 } = e, m = N(a);
  m.current = a;
  const d = N(s);
  d.current = s;
  const f = N(i);
  f.current = i;
  const p = N(n);
  p.current = n, C(() => {
    var S, k;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = si(), b = Jc(h, d.current);
    if (b == null && (h != null && h.blockId) && !u) return;
    const w = ua(h, b, { jobId: c, documentId: l });
    if (t.current === w)
      return;
    if (b == null) {
      t.current = w, (S = p.current) == null || S.call(p);
      return;
    }
    t.current = w, h && ((k = f.current) == null || k.call(f, h, b));
    const v = [];
    let y = 0;
    for (const E of Gc)
      y = Math.max(y, E), v.push(
        setTimeout(() => {
          m.current(b);
        }, E)
      );
    return v.push(
      setTimeout(() => {
        var E;
        (E = p.current) == null || E.call(p);
      }, y + Xc)
    ), () => {
      for (const E of v) clearTimeout(E);
    };
  }, [r, o, c, l, t, u]);
}
function Qc(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function el(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = Zc,
    jobId: i,
    documentId: c,
    applyReaderSearch: l
  } = e, u = N(a);
  u.current = a;
  const m = N(l);
  m.current = l;
  const d = N(0);
  C(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || d.current === o) return;
    const f = setTimeout(() => {
      var w;
      const p = ((w = globalThis.location) == null ? void 0 : w.search) || "", h = ms(p, o, u.current);
      if (d.current = o, h === null) return;
      const b = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = ua(
        { blockId: b },
        o,
        { jobId: i, documentId: c }
      ), (m.current || Qc)(h);
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
function tl(e) {
  const t = N(""), [n, r] = _(!1), o = x(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  Yc(a, t, o), el(e, t, n);
}
const At = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function nl(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function Or(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function da(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = Or(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = Or(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function rl(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = da(r, t, n);
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
function ol(e) {
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
function al(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function sl(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function il(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function cl(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const $r = [250, 500, 1e3, 2e3, 4e3], vn = [80, 160, 320, 640, 1e3, 1500], zr = [250, 500, 1e3, 2e3, 4e3, 5e3];
function $n(e, t) {
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
function er(e) {
  return ws(e) ? `${e.code || ""}`.trim() : "";
}
function Yt(e, t) {
  const n = er(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function ll(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (da(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
        return c;
      a = Ss(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (c) {
      if ((c == null ? void 0 : c.name) === "AbortError") throw c;
      a = c;
      const l = er(c);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw c;
    }
    const i = vn[Math.min(s, vn.length - 1)];
    if (await $n(i, r), s >= vn.length + 2) throw a;
  }
}
function ul({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = _(At), s = N(o), i = N("");
  s.current = o;
  const c = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = Bt(l) ? l : "";
  return C(() => {
    if (!n || !c) {
      i.current = "", s.current = At, a(At);
      return;
    }
    const m = r === void 0 ? ai() : r, d = i.current === c;
    if (i.current = c, !m) {
      const y = {
        ...d ? s.current : At,
        connection: u ? "terminal" : "unavailable",
        jobStatus: l,
        error: "实时译文暂不可用"
      };
      s.current = y, a(y);
      return;
    }
    const f = new AbortController();
    let p = !1;
    const h = {
      ...d ? s.current : At,
      connection: u ? "terminal" : "connecting",
      jobStatus: l,
      error: ""
    };
    s.current = h, a(h);
    const b = (y) => {
      f.signal.aborted || a((S) => {
        const k = y(S);
        return s.current = k, k;
      });
    }, w = async () => {
      let y = 0;
      for (; !f.signal.aborted; )
        try {
          const S = await m.fetchLayout(c, { signal: f.signal });
          p = !0, b((k) => ({
            ...k,
            layoutByPage: nl(S),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (S) {
          if ((S == null ? void 0 : S.name) === "AbortError") return;
          const k = er(S);
          if (!(k === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !k)) {
            b((L) => ({
              ...L,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: Yt(S, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            b((L) => ({
              ...L,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          b((L) => ({
            ...L,
            connection: "connecting",
            jobStatus: l,
            error: Yt(S, "正在等待 OCR 版面数据")
          })), await $n($r[Math.min(y, $r.length - 1)], f.signal).catch(() => {
          }), y += 1;
        }
    };
    return (async () => {
      if (await w(), !p || f.signal.aborted) return;
      let y = 0;
      for (; !f.signal.aborted; ) {
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
          await m.streamEvents(c, {
            afterSeq: s.current.lastSeq,
            signal: f.signal,
            onEvent: async (S) => {
              if (S.seq <= s.current.lastSeq) return;
              let k;
              try {
                k = await ll(
                  c,
                  S,
                  s.current,
                  f.signal,
                  m
                );
              } catch (E) {
                if ((E == null ? void 0 : E.name) === "AbortError" || f.signal.aborted) throw E;
                b((L) => ({
                  ...L,
                  lastSeq: Math.max(L.lastSeq, S.seq),
                  error: Yt(E, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              b((E) => {
                const L = rl(E, S, k);
                return u ? {
                  ...L,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...L,
                  jobStatus: l
                };
              }), y = 0;
            }
          });
        } catch (S) {
          if ((S == null ? void 0 : S.name) === "AbortError" || f.signal.aborted) return;
          b((k) => ({
            ...k,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: l,
            error: Yt(S, "实时译文连接已中断，正在重连")
          }));
        }
        if (f.signal.aborted) return;
        if (u) {
          b((S) => ({
            ...S,
            connection: "terminal",
            jobStatus: l
          }));
          return;
        }
        await $n(zr[Math.min(y, zr.length - 1)], f.signal).catch(() => {
        }), y += 1;
      }
    })(), () => f.abort();
  }, [n, r, c, u]), o;
}
function dl(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), c = Number(s.count) || 0;
    i && c > 0 && o.set(i, c);
  }
  return o;
}
function fl(e, t = !0) {
  const [n, r] = _(() => /* @__PURE__ */ new Map());
  return C(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = qe().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(dl(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const ml = 4500;
function hl(e) {
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
const pl = /* @__PURE__ */ new Set(["book", "translate"]);
function fa(e) {
  return !!(e.jobId && e.sourceUrl && pl.has(e.workflow));
}
function gl(e) {
  return !!(fa(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function bl() {
  const e = ji(), t = fa({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = gl({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = N({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Bt(o) && (r.current.running = !0);
  const a = ul({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = Ki(), u = fl(e.jobId, !e.sourceOnly), m = cc({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${m}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: f, onZoomChange: p } = mc(e.mode, s, m);
  Nc(i, f, p);
  const h = qi(
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
    beginModeSwitch: b,
    goToPage: w,
    repinIfRestoring: v
  } = qc(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: m,
    restoreReady: h.primaryNumPages > 0
  });
  C(() => {
    v();
  }, [c, v]);
  const y = Fc(
    s,
    h.compareMode,
    h.rowSyncRevision,
    v
  ), S = Dc(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${f}-${h.metricsTick}`,
    h.primaryPane
  ), k = x((z, G) => {
    var ne, oe;
    const J = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((ne = h.numPagesByPane) == null ? void 0 : ne.source) || 0,
      Number((oe = h.numPagesByPane) == null ? void 0 : oe.translated) || 0
    );
    w(z, J, G);
  }, [w, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [E, L] = _(null), $ = N(null), O = x((z) => {
    $.current && clearTimeout($.current), L(z), z && ($.current = setTimeout(() => L(null), ml));
  }, []);
  C(() => () => {
    $.current && clearTimeout($.current);
  }, []);
  const A = x((z) => {
    const G = bn(e.regions, z);
    return G ? Tr(G, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), I = x((z, G) => {
    const J = G || h.primaryPane, ne = typeof z == "object" && z ? `${z.block_id || ""}`.trim() : "", oe = typeof z == "object" && z ? `${z.image_url || ""}`.trim() : "", j = typeof z == "object" && z ? z.page_idx != null ? Number(z.page_idx) + 1 : z.page != null ? Number(z.page) : null : typeof z == "number" ? z + 1 : null, U = ps(e.regions, oe, j) || bn(e.regions, ne) || (typeof z == "object" ? gs(e.regions, z) : null);
    let W = U ? Tr(U, J).page : null;
    W == null && (W = hl(z)), !(W == null || W < 1) && (O(U), k(W, J));
  }, [O, k, h.primaryPane, e.regions]);
  tl({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: S,
    goToPage: k,
    resolveBlockPage: A,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (z) => {
      O(bn(e.regions, z.blockId));
    }
  });
  const { setModeKeepingPage: R } = Ac({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: b
  });
  C(() => {
    O(null);
  }, [d, O]);
  const P = !e.boot.loading && !e.boot.failed, T = V(() => ({ bindShell: l, shellEl: i, shellWidth: c, shellRef: s }), [l, i, c, s]), M = V(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), B = V(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: f,
    onZoomChange: p,
    shell: T,
    panes: h,
    sessionFiles: M,
    rowHeights: y,
    goToPage: k,
    activeRegion: E,
    jumpToAnchor: I,
    setModeKeepingPage: R,
    download: e.download,
    showHud: P,
    viewStateKey: m,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, T, h, M, y, k, E, I, R, P, f, p, m, a, n, u]);
  return V(() => ({
    ...B,
    currentPage: S
  }), [B, S]);
}
const yl = [
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
], vl = [
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
    title: "画笔",
    items: [
      { actions: [], keys: "P", desc: "进入 / 退出画笔（书页上右键也能选笔和颜色）" },
      { actions: [], keys: "Esc", desc: "退出画笔" },
      { actions: [], keys: "⌘Z / Ctrl+Z", desc: "画笔模式下撤销" },
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
  },
  {
    title: "引用（「图 2.1」「式 (3.21)」）",
    items: [
      { actions: [], keys: "Alt+←", desc: "点了引用跳过去以后，回到原处" },
      { actions: [], keys: "Alt+→", desc: "再跳回去" }
    ]
  }
];
function wl(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of yl)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Sl(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const kl = ".reader-notes-panel";
function Il(e) {
  return e instanceof Element ? !!e.closest(kl) : !1;
}
function Rl(e) {
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
  C(() => {
    if (!u)
      return;
    const m = (d) => {
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || Sl(d.target) || Il(d.target))
        return;
      const f = d.key, p = wl(f);
      if (p) {
        if (p.mode) {
          if (n && p.mode !== "source")
            return;
          d.preventDefault(), r(p.mode);
          return;
        }
        if (p.action === "doc-dark") {
          if (!l || d.repeat) return;
          d.preventDefault(), l();
          return;
        }
        if (!(p.requiresPages && i <= 0))
          switch (d.preventDefault(), p.action) {
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
              c(dn(s + 1, i));
              return;
            case "prev-page":
              c(dn(s - 1, i));
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
const Tl = "retainpdf:soft-reader-close";
function El() {
  return new URL("./index.html", window.location.href).href;
}
function Pl() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Tl },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Ml(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function _l() {
  if (!(typeof window > "u") && !Pl()) {
    if (Ml(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(El());
  }
}
function Nl({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ g("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function Al({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ D(Nl, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), _l();
  }, children: [
    /* @__PURE__ */ g(ft, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ g("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
const Ll = 3e3, xl = 8;
async function Dl(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function Cl(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function Ol(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = Ll;
  const r = [], o = (s, i, c) => {
    const l = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const m = s[u], d = Cl(m == null ? void 0 : m.title);
      if (!d) continue;
      n -= 1;
      const f = c ? `${c}.${u}` : `${u}`, p = { id: f, title: d, page: null, level: i, children: [] };
      r.push({ node: p, dest: m.dest }), l.push(p), i < xl && Array.isArray(m.items) && m.items.length && (p.children = o(m.items, i + 1, f));
    }
    return l;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await Dl(e, i);
  })), a;
}
function ma(e) {
  const t = [], n = (r) => {
    for (const o of r)
      t.push(o), n(o.children);
  };
  return n(e), t;
}
function ha(e, t) {
  let n = null;
  for (const r of ma(e))
    r.page === null || r.page > t || (!n || r.page > (n.page ?? 0) || r.page === n.page && r.id.startsWith(`${n.id}.`)) && (n = r);
  return (n == null ? void 0 : n.id) ?? null;
}
function Fr(e) {
  if (!e) return [];
  const t = e.split(".");
  return t.slice(0, -1).map((n, r) => t.slice(0, r + 1).join("."));
}
let Br = !1;
function $l() {
  if (Br)
    return;
  const e = jt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (Vo.GlobalWorkerOptions.workerSrc = e, Br = !0);
}
const Qe = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), zl = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Fl = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Bl = {
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
}, jr = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function jl(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => jr(o ?? a ?? "", zl)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => jr(o ?? a ?? "", Fl)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Bl[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Hl(e) {
  return Qe(e.translatedBlockText) || Qe(e.translated.text) || Qe(e.source.text);
}
const Ul = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Wl(e) {
  const t = [];
  for (const n of e) {
    if (!Ul(n)) continue;
    const r = jl(Hl(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function Kl(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const Vl = 24, ql = 60;
function Hr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - Vl), o = Math.min(e.length, n + t.length + ql), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function Jl(e, t, n = 200) {
  const r = Qe(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = Qe(a.translatedBlockText) || Qe(a.translated.text), c = i ? Hr(i, r) : null, l = c ?? Hr(Qe(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: c ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
function Qt(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function Dt(e, t) {
  const n = Qe(t).toLowerCase();
  if (!n || !e) return Qt(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${Qt(e.slice(a, s))}<mark class="reader-find-mark">${Qt(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + Qt(e.slice(a));
}
function Gl(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const pa = "reader-xref", zn = "data-xref", Ct = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, Xl = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${Ct})`), Zl = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function Fn(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function Yl(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function Ql(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function eu(e, t, n) {
  const r = e[t], o = (i) => {
    if (!i || i.source.page !== r.source.page) return !1;
    const c = _e(i);
    return c === "figure" || c === "table" || c === "formula";
  }, a = (i) => {
    const c = [];
    for (let l = t + i; o(e[l]) && c.length < 40; l += i) c.push(e[l]);
    return i < 0 ? c.reverse() : c;
  }, s = a(n === "table" ? 1 : -1);
  return s.length ? s : a(n === "table" ? -1 : 1);
}
function tu(e, t, n) {
  return (e.find((o) => _e(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function nu(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = _e(r), s = Ql(r);
    if (a === "formula") {
      for (const p of s.matchAll(Zl)) {
        const h = Fn(p[1]);
        h && n({ key: `equation:${h}`, kind: "equation", label: h, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = Xl.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const l = Yl(i[1]), u = Fn(i[2]), m = eu(e, o, l), d = [...m.map((p) => p.itemId), r.itemId], f = new Map(e.map((p, h) => [p.itemId, h]));
    d.sort((p, h) => (f.get(p) ?? 0) - (f.get(h) ?? 0)), n({ key: `${l}:${u}`, kind: l, label: u, itemId: tu(m, r, l), itemIds: d, captionId: r.itemId });
  }), t;
}
const ru = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${Ct})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${Ct})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${Ct})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${Ct})\s*[）)]`, "g"), kind: () => "equation" }
];
function ou(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of ru) {
    o.lastIndex = 0;
    for (const s of e.matchAll(o)) {
      const i = s.length > 2 ? s[1] : "", c = Fn(s[s.length - 1]), l = `${a(i)}:${c}`;
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
function au(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function su(e, t, n = "") {
  const r = ou(e, t);
  if (!r.length) return Dt(e, n);
  let o = "", a = 0;
  for (const s of r)
    o += Dt(e.slice(a, s.start), n), o += `<mark class="${pa}" ${zn}="${au(s.key)}">${Dt(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  return o + Dt(e.slice(a), n);
}
const iu = { figure: "图", table: "表", equation: "式" };
function Ur(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${iu[e.kind]} ${e.label}`;
}
function ge(e) {
  return typeof e == "string" ? e : "";
}
function cu(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function lu(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function uu(e) {
  return {
    source: ge(e == null ? void 0 : e.source_text) || ge(e == null ? void 0 : e.unit_source_text),
    translated: ge(e == null ? void 0 : e.protected_translated_text) || ge(e == null ? void 0 : e.translated_text)
  };
}
const du = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function ga(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function fu(e) {
  const t = ga(e).sort((r, o) => ge(r.ts).localeCompare(ge(o.ts)));
  return t.length ? [
    { text: ge(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: ge(r.new_text),
      label: du[ge(r.source)] || ge(r.source) || "修订",
      ts: ge(r.ts),
      reason: ge(r.reason)
    }))
  ].reverse() : [];
}
function mu(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function hu(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return ge(r.finished_at) || ge(n.finished_at) || "";
}
function pu(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = ga(e).sort((a, s) => ge(a.ts).localeCompare(ge(s.ts)));
  for (const a of o) {
    const s = new Date(ge(a.ts)).getTime(), i = ge(a.reader_item_id) || ge(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, ge(a.new_text));
  }
  return n;
}
const gu = {
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
function bu(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = gu[ge(n.kind)] || ge(n.kind) || "问题", o = ge(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const yu = /* @__PURE__ */ new Set(["text", "formula"]);
function tr(e) {
  return yu.has(e);
}
function vu(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || tr(_e(n));
}
function wu(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !tr(_e(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const Su = 300, ku = 72;
function Iu(e, t) {
  if (e.width >= Su && e.height >= ku)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const Ru = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function Tu(e, t, n) {
  return e.flatMap((r) => {
    if (!Ru.has(_e(r.region))) return [];
    const o = dt(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function Wr(e, t, n) {
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
async function Eu(e) {
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
const Pu = "reader-text-hover-copy", Mu = "reader-text-hover-edit", _u = "reader-text-hover-zoom", Nu = "reader-text-hover-id";
function Au(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const ba = "reader-text-hover-tools";
function en({
  className: e,
  state: t,
  label: n,
  title: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ g(
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
const Lu = 26, xu = 220;
function Du(e, t = xu) {
  return e.height < Lu * 2 || e.width < t;
}
function Cu({ state: e }) {
  return /* @__PURE__ */ g(e === "copied" ? Fo : e === "failed" ? ft : Rs, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function Ou({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  onZoom: o,
  frameRect: a,
  placement: s,
  tailTop: i = 0
}) {
  const [c, l] = _("idle"), [u, m] = _("idle"), [d] = _(() => Au()), f = N([]), p = (e == null ? void 0 : e.itemId) || "";
  if (C(() => {
    l("idle"), m("idle");
    const k = f.current;
    return () => {
      k.forEach((E) => window.clearTimeout(E)), f.current = [];
    };
  }, [p]), !e) return null;
  const h = bs(e.highlight.region, t), b = _e(e.highlight.region), w = (k, E) => async (L) => {
    L.preventDefault(), L.stopPropagation();
    const $ = await Eu(k);
    E($ ? "copied" : "failed"), f.current.push(window.setTimeout(() => E("idle"), 1200));
  }, v = b === "formula" ? "复制 LaTeX" : "复制", y = a || e.rect, S = s || (Du(y) ? "outside" : "inside");
  return /* @__PURE__ */ g("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ g(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": b,
      style: y,
      children: /* @__PURE__ */ D(
        "div",
        {
          className: ba,
          "data-placement": S,
          style: S === "tail" ? { top: i } : void 0,
          children: [
            d ? /* @__PURE__ */ g(
              en,
              {
                className: Nu,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: w(e.itemId, m),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && tr(b) ? /* @__PURE__ */ g(
              en,
              {
                className: Mu,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (k) => {
                  k.preventDefault(), k.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ g(Gn, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            h ? /* @__PURE__ */ g(
              en,
              {
                className: Pu,
                state: c,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: c === "copied" ? "已复制" : c === "failed" ? "复制失败" : v,
                onClick: w(h, l),
                children: /* @__PURE__ */ g(Cu, { state: c })
              }
            ) : null,
            o ? /* @__PURE__ */ g(
              en,
              {
                className: _u,
                state: "idle",
                label: "放大看这一块",
                title: b === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (k) => {
                  k.preventDefault(), k.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ g(Is, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function $u(e, t) {
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
function zu(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = dt(
      $u(e, a),
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
const Fu = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Bu = 256, Lt = /* @__PURE__ */ new Map();
function ju(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function ya(e) {
  const t = `${e || ""}`, { text: n, slots: r } = Ys(t, { bareLatex: !0 }), o = ju(n), a = Qs(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = Lt.get(t);
  if (!s && (s = ei(o, r), Lt.set(t, s), Lt.size > Bu)) {
    const i = Lt.keys().next().value;
    i !== void 0 && Lt.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function wn(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Ue(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Hu(e, t) {
  const n = e.typography, r = Ue(t) || 1, o = Ue(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = wn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(s, i * r)), l = Ue(n == null ? void 0 : n.fit_min_font_size_pt), u = Ue(n == null ? void 0 : n.fit_max_font_size_pt), m = Math.max(3.5, (l || 5.5) * r), d = Math.max(
    m,
    u ? u * r : o ? o * r : c
  ), f = o ? o * r : c, p = Ue(n == null ? void 0 : n.leading_em), h = [
    Ue(n == null ? void 0 : n.padding_top_pt) || 0,
    Ue(n == null ? void 0 : n.padding_right_pt) || 0,
    Ue(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Ue(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((b) => b * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Fu,
    fontSizePx: Math.max(m, Math.min(d, f)),
    minFontSizePx: m,
    maxFontSizePx: d,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: p ? 1 + p : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (wn(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : wn(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function Uu(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), i = (m) => {
    const d = s.get(m);
    if (d !== void 0) return d;
    const { width: f, height: p } = e(m), h = f <= t + 0.5 && p <= n + 0.5;
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
const Wu = 512, xt = /* @__PURE__ */ new Map();
let Bn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Bn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Bn += 1;
}));
function Ku(e, t, n, r) {
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
function va({ item: e, pageScale: t }) {
  const n = N(null), r = V(
    () => ya(e.translatedText),
    [e.translatedText]
  ), [o, a] = _(r.fallbackHtml), s = V(
    () => Hu(e, t),
    [e, t]
  );
  C(() => {
    let m = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((d) => {
      m && a(d);
    }), () => {
      m = !1;
    };
  }, [r]), Te(() => {
    const m = n.current;
    if (!m) return;
    const [d, f, p, h] = s.padding, b = Math.max(1, e.rect.width - h - f), w = Math.max(1, e.rect.height - d - p), v = Ku(o, b, w, s);
    let y = xt.get(v);
    if (y === void 0 && (y = Uu(
      (S) => (m.style.fontSize = `${S}px`, { width: m.scrollWidth, height: m.scrollHeight }),
      b,
      w,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), xt.set(v, y), xt.size > Wu)) {
      const S = xt.keys().next().value;
      S !== void 0 && xt.delete(S);
    }
    m.style.fontSize = `${y.toFixed(2)}px`;
  }, [o, e.rect.height, e.rect.width, s]);
  const [i, c, l, u] = s.padding;
  return /* @__PURE__ */ g(
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
      children: /* @__PURE__ */ g(
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
function Vu({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = V(
    () => zu(e, t, n, r),
    [r, e, t, n]
  );
  return o.length ? /* @__PURE__ */ g(
    "div",
    {
      className: "reader-live-translation-overlay",
      "data-live-translation-page": e == null ? void 0 : e.page_idx,
      "data-live-translation-generation": t == null ? void 0 : t.generation,
      "aria-hidden": "true",
      children: o.map((a) => /* @__PURE__ */ g(
        va,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const qu = Vt(Vu);
function Ju({
  targets: e,
  edits: t,
  width: n,
  excludeId: r
}) {
  const o = e.filter((a) => t.has(a.itemId) && a.itemId !== r);
  return o.length ? /* @__PURE__ */ g("div", { className: "reader-live-translation-overlay reader-edited-overlay", "aria-hidden": "true", children: o.map((a) => {
    const s = a.highlight.pageSize.width;
    return /* @__PURE__ */ D("div", { className: "reader-edited-block", "data-reader-edited-id": a.itemId, children: [
      /* @__PURE__ */ g(
        va,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: _e(a.highlight.region),
            sourceText: a.highlight.box.text || "",
            rect: a.rect,
            changedAtSeq: 0,
            changedNow: !1
          },
          pageScale: s > 0 ? n / s : 1
        }
      ),
      /* @__PURE__ */ g("span", { className: "reader-edited-badge", style: { left: a.rect.left, top: a.rect.top }, children: "待排版" })
    ] }, a.itemId);
  }) }) : null;
}
const Gu = Vt(Ju), wa = 24, Ze = wa * 2 + 4, We = 24, Xu = 4, Zu = 6, it = (e) => e.left + e.width, nt = (e) => e.top + e.height;
function Ot(e, t) {
  const n = Math.min(it(e), it(t)) - Math.max(e.left, t.left), r = Math.min(nt(e), nt(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const Kr = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= it(t) && r >= t.top && r <= nt(t);
}, Yu = (e) => e.height > 40 && e.height > e.width * 2.5;
function Qu(e, t, n) {
  if (!t.length || e.height < We || e.width < n + 8) return null;
  const r = Math.max(...t.map(nt)), o = it(e) - 4 - n;
  for (const a of [r, nt(e) - 2]) {
    const s = Math.max(e.top, a - We), i = { left: o, top: s, width: n, height: We };
    if (!t.some((c) => Ot(i, c) > 0)) return s - e.top;
  }
  return null;
}
function ed(e, t) {
  const n = [], r = (a) => {
    const s = wa + Xu, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: it(e), top: i, width: s, height: Ze } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: Ze } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - We - 3, width: Ze, height: We + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: nt(e), width: Ze, height: We + 3 } }), r(!0);
  const o = Qu(e, t, Ze);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: it(e) - 4 - Ze, top: e.top + o, width: Ze, height: We } }), n;
}
function td(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((v) => v.width > 0 && v.height > 0 && !Yu(v)), i = s.filter((v) => Kr(v, t)), c = s.filter((v) => !Kr(v, t)), l = n.filter((v) => v !== t && Ot(v, t) < t.width * t.height * 0.5), u = ed(t, i).filter(({ box: v, overhang: y }) => {
    const S = y ? Zu : 0;
    return v.left >= -S && it(v) <= r + S && v.top >= 0 && nt(v) <= o;
  }), m = ({ placement: v, tailTop: y }) => y === void 0 ? { placement: v } : { placement: v, tailTop: y }, d = ({ box: v }) => !c.some((y) => Ot(v, y) > 0), f = u.filter((v) => v.placement !== "tail"), p = f.find((v) => d(v) && !l.some((y) => Ot(v.box, y) > 0));
  if (p) return m(p);
  const h = f.find(d) || u.find((v) => v.placement === "tail" && d(v));
  if (h) return m(h);
  let b = null, w = Number.POSITIVE_INFINITY;
  for (const v of u) {
    const y = c.reduce((S, k) => S + Ot(v.box, k), 0);
    y < w && (b = v, w = y);
  }
  return b ? m(b) : { placement: "outside" };
}
function nd(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - We - 3 : nt(r);
  return t >= r.left - 4 && t <= r.left + Ze + 4 && n >= a && n <= a + We + 3;
}
const Sn = (e) => e.left + e.width, kn = (e) => e.top + e.height;
function rd(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const l of t) {
    if (l.width <= 0 || l.height <= 0) continue;
    const u = l.left + l.width / 2, m = l.top + l.height / 2;
    u < e.left || u > Sn(e) || m < e.top || m > kn(e) || (o = Math.min(o, l.left), a = Math.min(a, l.top), s = Math.max(s, Sn(l)), i = Math.max(i, kn(l)));
  }
  if (!Number.isFinite(o)) return e;
  const c = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return c.width = Math.min(Sn(e) + r, s + n) - c.left, c.height = Math.min(kn(e) + r, i + n) - c.top, c.width * c.height < e.width * e.height * 0.3 && c.height < 24 ? e : c;
}
function od(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function ad(e, t, n, r) {
  const [o, a] = _(null);
  return Te(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? od(s) : [], c = _e(t.highlight.region) === "figure", l = i.length && !c ? rd(t.rect, i) : t.rect, u = n.filter((d) => d.itemId !== t.itemId).map((d) => d.rect), m = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...td({ frame: l, others: u, pageWidth: r, pageHeight: m, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
const Sa = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], Vr = { pen: 35e-4, highlighter: 0.018 }, qr = 0.015, jn = "retainpdf.reader.ink.v1:";
function Jr(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(jn + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function sd(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(jn + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(jn + e);
    } catch {
    }
}
function id(e, t, n, r, o, a) {
  const s = qr * qr;
  return e.filter((i) => ka(i, t, n) && i.points.some(([c, l]) => (c - r) ** 2 + ((l - o) * a) ** 2 <= s)).map((i) => i.id);
}
function ka(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function cd(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function ld(e) {
  const [t, n] = _(null), [r, o] = _(Sa[0].key), [a, s] = _(() => Jr(e)), i = N(a), c = N([]);
  C(() => {
    const h = Jr(e);
    i.current = h, s(h), c.current = [];
  }, [e]);
  const l = x((h) => {
    i.current = h, s(h), sd(e, h);
  }, [e]), u = x((h) => {
    const b = i.current, w = h(b);
    w !== b && (c.current = [...c.current.slice(-49), b], l(w));
  }, [l]), m = x((h) => {
    h.points.length < 1 || u((b) => [...b, { ...h, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [u]), d = x((h) => {
    h.length && u((b) => b.filter((w) => !h.includes(w.id)));
  }, [u]), f = x((h) => {
    u((b) => b.some((w) => w.page === h) ? b.filter((w) => w.page !== h) : b);
  }, [u]), p = x(() => {
    const h = c.current.pop();
    h && l(h);
  }, [l]);
  return V(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: m, erase: d, undo: p, clearPage: f }),
    [t, r, a, m, d, p, f]
  );
}
const ud = "reader-ink-layer";
function dd(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function Gr({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ g(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: dd(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function fd({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = _(null), i = N(!1), c = o.strokes.filter((h) => ka(h, e, t)), l = !!o.tool;
  if (!l && !c.length) return null;
  const u = (h) => {
    const b = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - b.left) / Math.max(1, b.width))),
      Math.min(1, Math.max(0, (h.clientY - b.top) / Math.max(1, b.height)))
    ];
  }, m = (h, b) => o.erase(id(o.strokes, e, t, h, b, r / Math.max(1, n))), d = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [b, w] = u(h);
    o.tool === "eraser" ? m(b, w) : s([[b, w]]);
  }, f = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [b, w] = u(h);
    o.tool === "eraser" ? m(b, w) : s((v) => v ? cd(v, b, w) : [[b, w]]);
  }, p = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: Vr[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ D(
    "svg",
    {
      className: ud,
      "data-ink-active": l ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: d,
      onPointerMove: f,
      onPointerUp: p,
      onPointerCancel: p,
      children: [
        c.map((h) => /* @__PURE__ */ g(Gr, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ g(Gr, { stroke: { tool: o.tool, color: o.color, width: Vr[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
function md({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = _(null), [i, c] = _(!1), [l, u] = _([]), [m, d] = _(""), [f, p] = _(""), [h, b] = _(!1), [w, v] = _(null), [y, S] = _([]), k = r.drafts, E = r.generation, L = x(async (I, R) => {
    if (e)
      try {
        u(fu(await e.fetchRevisions(I, R)));
      } catch {
        u([]);
      }
  }, [e]);
  C(() => {
    if (s(null), u([]), v(null), S([]), p(""), !e || !t || !n) return;
    let I = !1;
    return c(!0), e.loadItem(t, n).then((R) => {
      if (I) return;
      const P = R == null ? void 0 : R.item;
      if (!P) throw new Error("找不到这一段的译文。");
      const T = `${(R == null ? void 0 : R.item_id) || n}`, { source: M, translated: B } = uu(P);
      s({ readerItemId: n, itemId: T, source: M, current: B }), d(k.get(n) ?? B);
    }).catch((R) => {
      I || v({ tone: "error", message: (R == null ? void 0 : R.message) || "读取这段译文失败。" });
    }).finally(() => {
      I || c(!1);
    }), L(t, n), () => {
      I = !0;
    };
  }, [e, t, n, L]);
  const $ = x((I) => {
    d(I), n && k.set(n, I);
  }, [n, k]), O = x(async (I, R) => {
    if (!e || !a || h) return !1;
    const P = I ?? m;
    if (!P.trim()) return !1;
    b(!0), v(null), S([]);
    try {
      const T = await e.revise(t, a.itemId, {
        translated_text: P,
        source: "user",
        reason: (R ?? f).trim() || "在阅读页手动修改",
        ...E.current != null ? { expected_generation: E.current } : {}
      }), M = Number(T == null ? void 0 : T.generation);
      return Number.isFinite(M) && (E.current = M), k.delete(a.readerItemId), s({ ...a, current: P }), d(P), p(""), (T == null ? void 0 : T.changed) === !1 ? v({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, P), v({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), L(t, a.readerItemId), !0;
    } catch (T) {
      const M = T;
      return (M == null ? void 0 : M.reason) === "generation_mismatch" && (E.current = null), v({ tone: "error", message: (M == null ? void 0 : M.message) || "保存失败，请稍后再试。" }), S(bu(M == null ? void 0 : M.issues)), !1;
    } finally {
      b(!1);
    }
  }, [e, a, h, m, f, t, o, L, k, E]), A = x(() => {
    n && k.delete(n);
  }, [n, k]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: l,
    draft: m,
    setDraft: $,
    reason: f,
    setReason: p,
    saving: h,
    status: w,
    issues: y,
    save: O,
    discardDraft: A
  };
}
const Ia = "reader-inline-edit";
function hd({ text: e }) {
  const [t, n] = _("");
  return C(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = ya(e);
      n(a.fallbackHtml), a.richHtml.then((s) => {
        r && n(s);
      });
    }, 250);
    return () => {
      r = !1, window.clearTimeout(o);
    };
  }, [e]), t ? /* @__PURE__ */ D("div", { className: "reader-inline-edit-preview", "data-inline-edit-preview": "true", children: [
    /* @__PURE__ */ g("span", { className: "reader-inline-edit-preview-label", children: "预览" }),
    /* @__PURE__ */ g("div", { className: "reader-live-translation-content", dangerouslySetInnerHTML: { __html: t } })
  ] }) : null;
}
function pd({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var A;
  const s = e.itemId, i = md({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = _(!1), [u, m] = _(!1), d = N(null), f = Iu(e.rect, t), p = V(() => wu(o), [o]), h = p.indexOf(s), { loaded: b } = i, w = i.saving || i.loading, v = n.blockedReason, y = !b || i.draft === b.current, { close: S, select: k } = n, E = x((I) => {
    const R = p[h + I];
    R && (k(R), a == null || a(R));
  }, [p, h, k, a]), L = x(() => {
    i.discardDraft(), S();
  }, [i, S]), $ = x(async (I, R) => {
    await i.save(I, R) && S();
  }, [i, S]);
  C(() => {
    const I = (R) => {
      !R.altKey || R.key !== "ArrowUp" && R.key !== "ArrowDown" || (R.preventDefault(), E(R.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", I), () => window.removeEventListener("keydown", I);
  }, [E]), Te(() => {
    const I = d.current;
    if (!I) return;
    I.style.height = "auto";
    const R = f.mode === "inline" ? f.minHeight : 0;
    I.style.height = `${Math.max(R, I.scrollHeight + 2)}px`;
  }, [i.draft, b, f.mode, f.mode === "inline" ? f.minHeight : 0]);
  const O = f.mode === "inline" ? { left: f.left, top: f.top, width: f.width } : { left: f.left, width: f.width, top: f.top, bottom: f.bottom };
  return /* @__PURE__ */ D($e, { children: [
    f.mode === "popout" ? /* @__PURE__ */ g("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ D(
      "div",
      {
        className: `${Ia} is-${f.mode}`,
        style: O,
        role: "group",
        "aria-label": `改第 ${((A = n.target) == null ? void 0 : A.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": f.mode,
        onPointerDown: (I) => I.stopPropagation(),
        children: [
          r && (b != null && b.source) ? /* @__PURE__ */ g(
            Q,
            {
              className: `reader-inline-edit-source${c ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: c ? "收起原文" : "展开原文",
              onClick: () => l((I) => !I),
              children: b.source
            }
          ) : null,
          v ? /* @__PURE__ */ g("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: v }) : null,
          i.loading ? /* @__PURE__ */ g("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          b ? /* @__PURE__ */ g(
            Gs,
            {
              ref: d,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: w || !!v,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (I) => i.setDraft(I.target.value),
              onKeyDown: (I) => {
                I.key === "Enter" && (I.metaKey || I.ctrlKey) ? (I.preventDefault(), y || $()) : I.key === "Escape" && (I.preventDefault(), L());
              }
            }
          ) : null,
          b ? /* @__PURE__ */ g(hd, { text: i.draft }) : null,
          /* @__PURE__ */ D("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ g(at, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => E(-1), children: /* @__PURE__ */ g(Ts, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ g(at, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= p.length - 1, onClick: () => E(1), children: /* @__PURE__ */ g(Bo, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ g(
              Ko,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: w || !!v || !b,
                onChange: (I) => i.setReason(I.target.value),
                onKeyDown: (I) => {
                  I.key === "Enter" ? (I.preventDefault(), y || $()) : I.key === "Escape" && (I.preventDefault(), L());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ D(
              Q,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": u,
                "data-block-edit-action": "history",
                onClick: () => m((I) => !I),
                children: [
                  /* @__PURE__ */ g(Es, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ g(Q, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: L, children: "取消" }),
            /* @__PURE__ */ g(
              Q,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: w || !!v || y || !i.draft.trim(),
                pending: i.saving,
                onClick: () => {
                  $();
                },
                children: "保存"
              }
            )
          ] }),
          i.status ? /* @__PURE__ */ g("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ g("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((I) => /* @__PURE__ */ g("li", { children: I }, I)) }) : null,
          u && b && i.history.length ? /* @__PURE__ */ g("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((I, R) => {
            const P = I.text === b.current, T = [mu(I.ts), I.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ D("li", { "data-block-edit-history": I.label, "data-current": P ? "true" : void 0, children: [
              /* @__PURE__ */ D("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ D("span", { children: [
                  T,
                  P ? "（现在用的）" : "",
                  I.reason ? ` · ${I.reason}` : ""
                ] }),
                P ? null : /* @__PURE__ */ g(
                  Q,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: w || !!v,
                    onClick: () => {
                      $(I.text, `回到「${T.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ g("p", { className: "reader-inline-edit-history-text", children: I.text })
            ] }, `${I.ts}:${R}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const Ra = qt(null), Ta = qt(null);
function gd({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ g(Ra.Provider, { value: e, children: /* @__PURE__ */ g(Ta.Provider, { value: t, children: n }) });
}
function Je() {
  return st(Ra);
}
function Ea() {
  return st(Ta);
}
const Pa = 1.414;
function bd({
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
  onHoverRegion: p,
  liveTranslationLayout: h,
  liveTranslationPage: b,
  showLiveTranslation: w = r === "source",
  liveTranslationMissing: v = !1
}) {
  var se, ce, be;
  const y = Je(), S = y == null ? void 0 : y.revisedBlocks, k = y == null ? void 0 : y.blockEdit, E = k == null ? void 0 : k.pendingEdits, L = y == null ? void 0 : y.editBlock, $ = (y == null ? void 0 : y.findTerm) || "", O = y == null ? void 0 : y.xrefIndex, A = V(
    () => O != null && O.size ? ({ str: H }) => su(H, O, $) : $ ? ({ str: H }) => Dt(H, $) : void 0,
    [$, O]
  ), I = N(c ?? Pa), [R, P] = _(I.current);
  C(() => {
    c != null && Math.abs(c - I.current) >= 1e-3 && (I.current = c, P(c));
  }, [c]);
  const T = N(u);
  T.current = u;
  const M = N(null), B = N((H) => {
    var ee;
    M.current = H, (ee = T.current) == null || ee.call(T, H);
  }).current, z = N(null), G = N(`${t}@${n}`);
  Te(() => {
    const H = `${t}@${n}`;
    G.current !== H && (G.current = H, o && vd(M.current, z.current));
  }, [o, n, t]), C(() => {
    o || In(z.current);
  }, [o]), C(() => () => In(z.current), []);
  const J = Math.max(120, Math.floor(t * R)), ne = Math.max(J, Math.ceil(s || 0)), oe = dt(m, t, J), j = V(
    () => Tu(d, t, J),
    [J, d, t]
  ), [U, W] = _(null), pe = typeof p == "function", q = pe ? f ?? null : U, K = (H) => {
    pe ? H !== (f ?? null) && (p == null || p(H)) : W((ee) => ee === H ? ee : H);
  }, ie = V(
    () => j.find((H) => H.itemId === q) || null,
    [q, j]
  ), ue = r === "translated" && ((se = k == null ? void 0 : k.target) == null ? void 0 : se.itemId) || "", ae = V(
    () => ue && j.find((H) => H.itemId === ue) || null,
    [ue, j]
  ), he = ad(M, o ? ie : null, j, t), Re = (H) => {
    var xe, fe, Se, Fe, Ge;
    if (H.pointerType === "touch") return;
    if ((xe = y == null ? void 0 : y.ink) != null && xe.tool) {
      K(null);
      return;
    }
    if (H.buttons !== 0) {
      K(null);
      return;
    }
    if ((Se = (fe = H.target) == null ? void 0 : fe.closest) != null && Se.call(fe, `.${ba}`) || (Ge = (Fe = H.target) == null ? void 0 : Fe.closest) != null && Ge.call(Fe, `.${Ia}`)) return;
    const ee = H.currentTarget.getBoundingClientRect(), re = H.clientX - ee.left, Ne = H.clientY - ee.top;
    if (nd(he, re, Ne)) return;
    const Ee = Wr(j, re, Ne);
    K((Ee == null ? void 0 : Ee.itemId) || null);
  }, ze = (H) => {
    if (H.pointerType === "mouse") return;
    const ee = H.currentTarget.getBoundingClientRect(), re = Wr(
      j,
      H.clientX - ee.left,
      H.clientY - ee.top
    );
    K((re == null ? void 0 : re.itemId) || null);
  }, Le = (H) => {
    !Number.isFinite(H) || H <= 0 || Math.abs(I.current - H) < 1e-3 || (I.current = H, P(H), l == null || l(e, H));
  };
  return /* @__PURE__ */ D(
    "div",
    {
      ref: B,
      [Ie]: e,
      [we]: r,
      [Xn]: J,
      className: Zn,
      onPointerMoveCapture: Re,
      onPointerDown: ze,
      onDoubleClick: (H) => {
        var re;
        const ee = y == null ? void 0 : y.zoomBlock;
        !ee || (re = y == null ? void 0 : y.ink) != null && re.tool || !ie || _e(ie.highlight.region) === "figure" && (H.preventDefault(), ee(ie.itemId));
      },
      onPointerLeave: (H) => {
        H.pointerType === "mouse" && K(null);
      },
      style: {
        width: t,
        height: ne,
        minHeight: ne
      },
      children: [
        o ? /* @__PURE__ */ g(
          Xs,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: A,
            renderAnnotationLayer: !1,
            className: Zo,
            loading: /* @__PURE__ */ g(
              "div",
              {
                className: sn,
                style: { width: t, height: J }
              }
            ),
            onLoadSuccess: (H) => {
              try {
                const ee = H.getViewport({ scale: 1 });
                if (ee.width > 0) {
                  const re = ee.height / ee.width;
                  Le(re);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              In(z.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ g(
          "div",
          {
            className: sn,
            style: { width: t, height: J },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ g("div", { ref: z, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        oe ? /* @__PURE__ */ g(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": m == null ? void 0 : m.itemId,
            style: oe,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && w ? /* @__PURE__ */ g(
          qu,
          {
            layoutPage: h,
            pageState: b,
            width: t,
            height: J
          }
        ) : null,
        o && w && v ? /* @__PURE__ */ g("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (E != null && E.size) ? /* @__PURE__ */ g(Gu, { targets: j, edits: E, width: t, excludeId: ae == null ? void 0 : ae.itemId }) : null,
        o && ae && k ? /* @__PURE__ */ g(
          pd,
          {
            target: ae,
            page: { width: t, height: J },
            edit: k,
            showSource: !!(y != null && y.editShowsSource),
            regions: y == null ? void 0 : y.regions,
            jumpToBlock: y == null ? void 0 : y.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (S != null && S.size) ? /* @__PURE__ */ g("div", { className: "reader-revised-markers", "aria-hidden": "true", children: j.filter((H) => S.has(H.itemId)).map((H) => /* @__PURE__ */ g(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": H.itemId,
            style: { left: H.rect.left, top: H.rect.top, height: H.rect.height }
          },
          H.itemId
        )) }) : null,
        o && (y != null && y.ink) ? /* @__PURE__ */ g(
          fd,
          {
            page: e,
            pane: r === "translated" ? "translated" : y.compareVersion ? "compare" : "source",
            width: t,
            height: J,
            ink: y.ink
          }
        ) : null,
        (ce = y == null ? void 0 : y.pageLayers) == null ? void 0 : ce.map((H) => /* @__PURE__ */ g(xo, { children: H.render({ page: e, height: J }) }, H.id)),
        /* @__PURE__ */ g(
          Ou,
          {
            target: o && !((be = y == null ? void 0 : y.ink) != null && be.tool) && (ie == null ? void 0 : ie.itemId) !== (ae == null ? void 0 : ae.itemId) ? ie : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: ie && (S == null ? void 0 : S.get(ie.itemId)) || 0,
            onEdit: L,
            onZoom: y == null ? void 0 : y.zoomBlock,
            frameRect: he == null ? void 0 : he.rect,
            placement: he == null ? void 0 : he.placement,
            tailTop: he == null ? void 0 : he.tailTop
          }
        )
      ]
    }
  );
}
const yd = Vt(bd);
function vd(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function In(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const wd = 2 * 1024 * 1024;
function Sd(e) {
  const t = new Vo.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const Rn = 5, kd = "120% 0px", Id = 120, Rd = "25% 0px";
let Xr = 1;
const Zr = /* @__PURE__ */ new WeakMap();
function Td(e) {
  if (!e) return 0;
  const t = Zr.get(e);
  if (t) return t;
  const n = Xr;
  return Xr += 1, Zr.set(e, n), n;
}
function Ed() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Pd = Do(
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
    onLoadError: p,
    onNumPagesChange: h,
    activeRegion: b = null,
    regions: w = [],
    readerMetadata: v = null,
    hoveredRegionId: y = null,
    onHoverRegion: S,
    liveTranslation: k,
    showLiveTranslation: E = t === "source",
    liveTranslationPendingLabel: L = "",
    paneAction: $
  }, O) {
    $l();
    const { file: A, loading: I, error: R } = Ci(n, r), P = `${n}\0${Td(A)}`, T = N(P);
    T.current = P;
    const M = V(() => {
      const F = _i(A);
      return F ? "ranged" in F ? { range: Sd(F.ranged) } : F : null;
    }, [A, n]), [B, z] = _(0), [G, J] = _(""), [ne, oe] = _(null), [j, U] = _(480), W = N(null), pe = N(0), q = V(() => Ed(), []), K = V(() => ({
      cMapUrl: jt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: jt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: wd,
      disableAutoFetch: !0
    }), []);
    Jn(O, () => ne, [ne]), C(() => {
      const F = (X) => {
        pe.current = X, U(X);
      }, Y = (X) => {
        const de = rc(X, pe.current);
        if (de !== "ignore") {
          if (W.current && clearTimeout(W.current), de === "immediate") {
            F(X);
            return;
          }
          W.current = setTimeout(() => F(X), na);
        }
      }, Z = !!(c && c >= 80);
      Y(Z ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const me = !Z && i && typeof ResizeObserver < "u" ? new ResizeObserver((X) => {
        var de, ye;
        Y(((ye = (de = X[0]) == null ? void 0 : de.contentRect) == null ? void 0 : ye.width) ?? i.clientWidth);
      }) : null;
      return me && i && me.observe(i), () => {
        me == null || me.disconnect(), W.current && clearTimeout(W.current);
      };
    }, [c, i, a]);
    const ie = V(
      () => ec(j, o),
      [j, o]
    ), [ue, ae] = _(() => /* @__PURE__ */ new Map()), [he, Re] = _(() => /* @__PURE__ */ new Set()), [ze, Le] = _(() => /* @__PURE__ */ new Set()), se = N(/* @__PURE__ */ new Map()), ce = N(null), be = N(null), [H, ee] = _(() => /* @__PURE__ */ new Set()), re = N(/* @__PURE__ */ new Map()), Ne = x((F, Y) => {
      ae((Z) => {
        if (Z.get(F) === Y) return Z;
        const te = new Map(Z);
        return te.set(F, Y), te;
      });
    }, []), Ee = x((F, Y) => {
      const Z = se.current, te = Z.get(F), me = [ce.current, be.current];
      if (te)
        for (const X of me)
          try {
            X == null || X.unobserve(te);
          } catch {
          }
      if (Y) {
        Z.set(F, Y);
        for (const X of me)
          try {
            X == null || X.observe(Y);
          } catch {
          }
      } else
        Z.delete(F);
    }, []), xe = N(/* @__PURE__ */ new Map()), fe = x((F) => {
      const Y = xe.current;
      let Z = Y.get(F);
      return Z || (Z = (te) => Ee(F, te), Y.set(F, Z)), Z;
    }, [Ee]);
    C(() => {
      if (typeof IntersectionObserver > "u") return;
      const F = re.current, Y = new IntersectionObserver(
        (Z) => {
          const te = [], me = [];
          for (const X of Z) {
            const de = X.target, ye = ln(de);
            Number.isFinite(ye) && (X.isIntersecting ? te : me).push(ye);
          }
          if ((te.length || me.length) && Re((X) => {
            let de = null;
            for (const ye of te)
              X.has(ye) || (de = de || new Set(X), de.add(ye));
            for (const ye of me)
              X.has(ye) && (de = de || new Set(X), de.delete(ye));
            return de || X;
          }), te.length) {
            for (const X of te) {
              const de = F.get(X);
              de && (clearTimeout(de), F.delete(X));
            }
            Le((X) => {
              let de = null;
              for (const ye of te)
                X.has(ye) || (de = de || new Set(X), de.add(ye));
              return de || X;
            });
          }
          for (const X of me)
            F.has(X) || F.set(X, setTimeout(() => {
              F.delete(X), Le((de) => {
                if (!de.has(X)) return de;
                const ye = new Set(de);
                return ye.delete(X), ye;
              });
            }, Id));
        },
        { root: i, rootMargin: kd, threshold: 0 }
      );
      ce.current = Y;
      for (const Z of se.current.values())
        try {
          Y.observe(Z);
        } catch {
        }
      return () => {
        Y.disconnect(), ce.current === Y && (ce.current = null);
        for (const Z of F.values()) clearTimeout(Z);
        F.clear();
      };
    }, [i]), C(() => {
      if (typeof IntersectionObserver > "u") return;
      const F = new IntersectionObserver(
        (Y) => {
          ee((Z) => {
            let te = null;
            for (const me of Y) {
              const X = ln(me.target);
              !Number.isFinite(X) || me.isIntersecting === Z.has(X) || (te = te || new Set(Z), me.isIntersecting ? te.add(X) : te.delete(X));
            }
            return te || Z;
          });
        },
        { root: i, rootMargin: Rd, threshold: 0 }
      );
      be.current = F;
      for (const Y of se.current.values())
        try {
          F.observe(Y);
        } catch {
        }
      return () => {
        F.disconnect(), be.current === F && (be.current = null);
      };
    }, [i]);
    const Se = !!i && typeof IntersectionObserver < "u";
    Te(() => {
      z(0), J(""), Re(/* @__PURE__ */ new Set()), Le(/* @__PURE__ */ new Set()), ae(/* @__PURE__ */ new Map()), se.current.clear();
      const F = re.current;
      for (const Y of F.values()) clearTimeout(Y);
      F.clear(), h == null || h(0, t);
    }, [P, h, t]);
    const Fe = x(
      (F) => {
        if (T.current !== P) return;
        const Y = F.numPages;
        z(Y), J(""), h == null || h(Y, t), m == null || m({ numPages: Y, pane: t }), f && typeof F.getPage == "function" && f(F, t), d && typeof F.getOutline == "function" && Ol(F).then((Z) => {
          T.current === P && d(Z, t);
        }, () => {
        });
      },
      [P, m, d, f, h, t]
    ), Ge = x(
      (F) => {
        if (T.current !== P) return;
        const Y = (F == null ? void 0 : F.message) || "PDF 解析失败";
        J(Y), z(0), h == null || h(0, t), p == null || p(F, t);
      },
      [P, p, h, t]
    ), Be = V(
      () => B > 0 ? Array.from({ length: B }, (F, Y) => Y + 1) : [],
      [B]
    );
    C(() => {
      typeof IntersectionObserver < "u" || Le(new Set(Be));
    }, [Be]);
    const rt = V(
      () => Tt(b, v, t),
      [b, v, t]
    ), pt = V(() => {
      const F = /* @__PURE__ */ new Map();
      for (const Y of w) {
        const Z = Tt(Y, v, t);
        if (!Z) continue;
        const te = F.get(Z.box.page) || [];
        te.push(Z), F.set(Z.box.page, te);
      }
      return F;
    }, [t, v, w]), gt = V(() => {
      const F = /* @__PURE__ */ new Set();
      if (!y) return F;
      for (const [Y, Z] of pt)
        Z.some((te) => te.itemId === y) && F.add(Y);
      return F;
    }, [y, pt]), Gt = V(() => {
      if (B === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(Be);
      if (he.size === 0) {
        const Z = Math.min(B, Rn * 2 + 1);
        return new Set(Array.from({ length: Z }, (te, me) => me + 1));
      }
      const Y = /* @__PURE__ */ new Set();
      for (const Z of he)
        for (let te = -Rn; te <= Rn; te++) {
          const me = Z + te;
          me >= 1 && me <= B && Y.add(me);
        }
      return Y;
    }, [B, Be, i, a, he]), bt = !n || !!R || !!G, Xt = n && (R || G) || s;
    return /* @__PURE__ */ D(
      "section",
      {
        ref: oe,
        className: `reader-panel ${hn}${a ? "" : " is-hidden"}`,
        [we]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (k == null ? void 0 : k.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          $ ? /* @__PURE__ */ g("div", { className: "reader-react-pdf-pane-action", children: $ }) : null,
          L ? /* @__PURE__ */ D("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ g("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ g("span", { children: L })
          ] }) : null,
          bt && !I ? /* @__PURE__ */ g("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: Xt }) : null,
          I ? /* @__PURE__ */ g("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          M && !R ? /* @__PURE__ */ g("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ g(
            Zs,
            {
              file: M,
              loading: null,
              error: null,
              options: K,
              onLoadSuccess: Fe,
              onLoadError: Ge,
              className: "reader-react-pdf-document",
              children: Be.map((F) => {
                if (Gt.has(F))
                  return /* @__PURE__ */ g(
                    yd,
                    {
                      pane: t,
                      pageNumber: F,
                      width: ie,
                      devicePixelRatio: q,
                      active: ze.has(F),
                      textLayer: !Se || H.has(F),
                      syncedMinHeight: (l == null ? void 0 : l.get(F)) || 0,
                      onMetrics: u,
                      cachedAspect: ue.get(F),
                      onAspectChange: Ne,
                      sentinelRef: fe(F),
                      regionHighlight: (rt == null ? void 0 : rt.box.page) === F ? rt : null,
                      regionTargets: pt.get(F),
                      hoveredRegionId: y && gt.has(F) ? y : null,
                      onHoverRegion: S,
                      liveTranslationLayout: k == null ? void 0 : k.layoutByPage.get(F - 1),
                      liveTranslationPage: k == null ? void 0 : k.pagesByPage.get(F - 1),
                      showLiveTranslation: E,
                      liveTranslationMissing: sl(k, F - 1)
                    },
                    `${t}-${F}`
                  );
                const Z = ue.get(F) ?? Pa, te = Math.max(120, Math.floor(ie * Z)), me = Math.max(te, Math.ceil((l == null ? void 0 : l.get(F)) || 0));
                return /* @__PURE__ */ g(
                  "div",
                  {
                    ref: fe(F),
                    [Ie]: F,
                    [we]: t,
                    [Xn]: te,
                    className: `${Zn} is-placeholder`,
                    style: {
                      width: ie,
                      height: me,
                      minHeight: me
                    },
                    children: /* @__PURE__ */ g(
                      "div",
                      {
                        className: sn,
                        style: { width: ie, height: te },
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
), Yr = Vt(Pd), Md = 2e3, _d = 6, Nd = 500, Qr = "reader-react-resizing";
function Ad(e, t) {
  const n = N(null), r = N(null);
  Te(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const S = Ld(e), k = zt(e, S);
      if (!k) return;
      s = { pane: S, progress: k, started: performance.now() };
    }
    const { pane: i, progress: c, started: l } = s;
    let u = 0, m = null, d = e.scrollHeight, f = d, p = 0, h = l;
    const b = /* @__PURE__ */ new WeakMap(), w = typeof ResizeObserver > "u" ? null : new ResizeObserver((S) => {
      let k = !1;
      for (const E of S) {
        const L = Math.round(E.contentRect.height);
        b.has(E.target) && b.get(E.target) !== L && (k = !0), b.set(E.target, L);
      }
      k && Et(e, c, "auto", i);
    }), v = () => {
      var S;
      m && clearTimeout(m), cancelAnimationFrame(u), w == null || w.disconnect(), e.classList.remove(Qr);
      for (const k of eo) e.removeEventListener(k, v);
      ((S = r.current) == null ? void 0 : S.stop) === v && (r.current = null);
    }, y = () => {
      Et(e, c, "auto", i);
      const S = e.scrollHeight;
      p = S === f ? p + 1 : 0, f = S;
      const k = performance.now() - h;
      p >= _d && (S !== d || k > Nd) || k > Md ? v() : u = requestAnimationFrame(y);
    };
    for (const S of eo) e.addEventListener(S, v, { passive: !0 });
    for (const S of Array.from(e.children)) w == null || w.observe(S);
    e.classList.add(Qr), r.current = { ...s, stop: v }, m = setTimeout(() => {
      m = null, h = performance.now(), d = e.scrollHeight, f = d, p = 0, u = requestAnimationFrame(y);
    }, na);
  }, [e, t]), C(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Ld(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Ie}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(we) || null;
  }
  return null;
}
const eo = ["wheel", "touchstart", "keydown", "pointerdown"];
function xd(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function Dd(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(hn)) && ((n = e.hasAttribute) != null && n.call(e, we)));
}
function Cd(e, t) {
  C(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!Dd(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${hn}[${we}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const c = xd(a, i);
        if (c === null || Math.abs(i.scrollLeft - c) < 1) continue;
        const l = i.scrollLeft;
        i.scrollLeft = c, Math.abs(i.scrollLeft - l) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function Od(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), c = t - i, l = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: c * l };
}
function $d(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const to = 12;
function nr(e) {
  return Array.from(e.querySelectorAll(`.${hn}[${we}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function zd(e) {
  const t = e.getBoundingClientRect();
  return nr(e).map((n) => {
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
function Fd(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function Bd(e, t) {
  return e ? nr(e).find((n) => n.getAttribute(we) === t) ?? null : null;
}
function jd({ shellEl: e }) {
  const [t, n] = _([]), r = N(0), o = x(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = zd(e);
      n((i) => Fd(i, s) ? i : s);
    }));
  }, [e]);
  C(() => {
    if (!e) return;
    o();
    const s = e.ownerDocument.defaultView;
    e.addEventListener("scroll", o, { capture: !0, passive: !0 });
    const i = s && typeof s.ResizeObserver < "u" ? new s.ResizeObserver(o) : null, c = () => {
      if (i) {
        i.disconnect(), i.observe(e);
        for (const m of nr(e))
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
  return a.length ? /* @__PURE__ */ g("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ g(Hd, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function Hd({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - to * 2), r = Od(e, n), o = N(null);
  if (!r) return null;
  const a = (d) => {
    const f = Bd(t, e.pane);
    f && (f.scrollLeft = d);
  }, s = (d) => {
    var f, p;
    d.button === 0 && (d.preventDefault(), d.stopPropagation(), (p = (f = d.currentTarget).setPointerCapture) == null || p.call(f, d.pointerId), o.current = { startX: d.clientX, startScroll: e.scrollLeft, pointerId: d.pointerId });
  }, i = (d) => {
    const f = o.current;
    !f || f.pointerId !== d.pointerId || a(f.startScroll + $d(e, n, r.size, d.clientX - f.startX));
  }, c = (d) => {
    var f, p, h;
    ((f = o.current) == null ? void 0 : f.pointerId) === d.pointerId && (o.current = null, (h = (p = d.currentTarget).releasePointerCapture) == null || h.call(p, d.pointerId));
  }, l = (d) => {
    if (d.button !== 0 || d.target !== d.currentTarget) return;
    d.preventDefault();
    const f = d.currentTarget.getBoundingClientRect(), p = d.clientX - f.left, h = e.width * 0.8;
    a(e.scrollLeft + (p < r.offset ? -h : h));
  }, u = e.pane === "translated" ? "译文栏左右滚动" : "原文栏左右滚动", m = Math.max(0, e.scrollWidth - e.width);
  return /* @__PURE__ */ g(
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
      style: { left: e.left + to, width: n },
      onPointerDown: l,
      children: /* @__PURE__ */ g(
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
function Ma(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Ud(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function Wd({ compare: e, onDone: t }) {
  return /* @__PURE__ */ D("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ g("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ g("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ g("li", { children: /* @__PURE__ */ D(
        Q,
        {
          className: "reader-version-compare-item",
          "data-version-id": n.versionId,
          "aria-current": o ? "true" : void 0,
          disabled: r,
          onClick: () => {
            e.choose(n.versionId), t();
          },
          children: [
            /* @__PURE__ */ g("span", { className: "reader-version-compare-name", children: n.name }),
            /* @__PURE__ */ g("span", { className: "reader-version-compare-time", children: Ma(n.createdAt) }),
            r ? /* @__PURE__ */ g("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ g(Fo, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ g(Ps, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ g("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ D("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ D(
        Q,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ g(Ms, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ D(
        Q,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ g(_s, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function no({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = Ud(t), a = [e === "compare" ? "对比" : "正在读", r, Ma(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ D("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ g("em", { children: "RetainPDF" }),
    /* @__PURE__ */ g("strong", { children: o }),
    /* @__PURE__ */ g("span", { children: a })
  ] });
}
function Kd({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = _({ source: null, translated: null });
  return Te(() => {
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
  }, [e]), /* @__PURE__ */ D("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ g("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ g(no, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ g("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ g(no, { role: "reading", ...n }) }) : null
  ] });
}
const Vd = () => () => {
}, ro = () => null;
function qd({
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
function Jd(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function Gd(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Xd(e) {
  const t = Je(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, m = e.bindShell ?? (t == null ? void 0 : t.bindShell), d = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, f = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Jt, p = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), b = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, w = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, v = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, y = (t == null ? void 0 : t.compareVersion) ?? null, S = (y == null ? void 0 : y.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", k = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", E = y ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, L = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, $ = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), O = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), A = t == null ? void 0 : t.onPdfOutline, I = t == null ? void 0 : t.onPdfDocument, R = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), P = e.regions ?? (t == null ? void 0 : t.regions) ?? [], T = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), M = (t == null ? void 0 : t.regionHover) ?? null, [B, z] = _(null), G = mn(
    M ? M.subscribe : Vd,
    M ? () => M.get().itemId : ro,
    M ? () => M.get().itemId : ro
  ), J = M ? G : B, ne = x((W) => {
    M ? M.set(W, "pdf") : z(W);
  }, [M]), oe = qd({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), U = Number.isFinite(p) && p > 0 ? Jd(
    p,
    n || r,
    typeof document > "u" ? p * 2 : document.documentElement.clientWidth
  ) : null;
  return Ad(d, U), Cd(d, oe.compareMode), /* @__PURE__ */ D(
    "div",
    {
      ref: m,
      className: Xo,
      "data-reader-region-count": P.length,
      "data-reader-structured-region-count": P.filter(ys).length,
      "data-reader-metadata-ready": T ? "true" : "false",
      children: [
        /* @__PURE__ */ D(
          "main",
          {
            className: `${Go} reader-mode-${oe.mode}`,
            "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              b ? /* @__PURE__ */ g(
                Yr,
                {
                  pane: "source",
                  url: S,
                  preloadedFile: E,
                  userZoom: f,
                  visible: oe.showSource,
                  scrollRoot: d,
                  pageWidthOverride: U,
                  rowHeights: oe.compareMode ? h : void 0,
                  onMetrics: $,
                  emptyLabel: v ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: O,
                  onOutline: y ? void 0 : A,
                  onDocument: y ? void 0 : I,
                  activeRegion: R,
                  regions: (y == null ? void 0 : y.regions) ?? P,
                  readerMetadata: T,
                  hoveredRegionId: J,
                  onHoverRegion: ne,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? Gd(o) : "",
                  paneAction: u && oe.showTranslated ? /* @__PURE__ */ D($e, { children: [
                    e.sourcePaneAction,
                    /* @__PURE__ */ g(
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
              w ? /* @__PURE__ */ g(
                Yr,
                {
                  pane: "translated",
                  url: k,
                  preloadedFile: L,
                  userZoom: f,
                  visible: oe.showTranslated,
                  scrollRoot: d,
                  pageWidthOverride: U,
                  rowHeights: oe.compareMode ? h : void 0,
                  onMetrics: $,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: O,
                  onOutline: A,
                  onDocument: I,
                  activeRegion: R,
                  regions: P,
                  readerMetadata: T,
                  hoveredRegionId: J,
                  onHoverRegion: ne,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ g(jd, { shellEl: d }),
        y ? /* @__PURE__ */ g(Kd, { shellEl: d, left: y.left, right: y.right }) : null
      ]
    }
  );
}
const Zd = [
  { id: "source", label: "原文", Icon: jo },
  { id: "compare", label: "对照", Icon: Ho },
  { id: "translated", label: "译文", Icon: Uo }
];
function Yd(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function Qd(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function ef(e) {
  const t = Je(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? Yd(a.state) : "";
  return /* @__PURE__ */ D("header", { className: "reader-workspace-bar", children: [
    /* @__PURE__ */ g("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
    /* @__PURE__ */ g("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
    /* @__PURE__ */ D("div", { className: "reader-workspace-center", children: [
      /* @__PURE__ */ g("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Zd.map(({ id: l, label: u, Icon: m }) => {
        const d = n === l, f = Qd({
          id: l,
          documentReady: r,
          sourceViewOnly: i,
          liveTranslationAvailable: !!a
        });
        return /* @__PURE__ */ D(
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
              /* @__PURE__ */ g(m, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ g("span", { className: "reader-workspace-tab-label", children: u })
            ]
          },
          l
        );
      }) }),
      a ? /* @__PURE__ */ D("div", { className: "reader-live-strip", children: [
        /* @__PURE__ */ D(
          "button",
          {
            type: "button",
            className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
            "aria-pressed": a.visible,
            "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
            title: a.state.error || `${c}，${a.visible ? "点一下看原文" : "点一下叠上译文"}`,
            onClick: a.onToggle,
            children: [
              /* @__PURE__ */ g(Ns, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ g("span", { className: "reader-live-translation-toggle-label", children: c })
            ]
          }
        ),
        a.latestPage && a.onJumpToLatest && a.latestPage !== a.currentPage ? /* @__PURE__ */ D(
          Q,
          {
            className: "reader-live-translation-toggle reader-live-jump",
            "aria-label": `跳到最新译好的第 ${a.latestPage} 页`,
            title: `跳到最新译好的第 ${a.latestPage} 页`,
            onClick: a.onJumpToLatest,
            children: [
              /* @__PURE__ */ g(As, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ g("span", { className: "reader-live-translation-toggle-label", children: "跳到最新" })
            ]
          }
        ) : null
      ] }) : s ? /* @__PURE__ */ g("div", { className: "reader-live-strip", children: /* @__PURE__ */ D(
        Q,
        {
          className: "reader-live-translation-toggle is-done",
          title: "翻译完成，左右对照看最终译文",
          onClick: s.onOpenCompare,
          children: [
            /* @__PURE__ */ g(Ls, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ g("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
          ]
        }
      ) }) : null
    ] })
  ] });
}
const _a = [];
function tf() {
  const e = /* @__PURE__ */ new Map(), t = /* @__PURE__ */ new Set();
  let n = _a;
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
function nf(e, t) {
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
function rf(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.pageLayer ? [{ id: t, render: n.pageLayer }] : []);
}
function of(e) {
  for (const { contribution: t } of e) if (t.comparedDocument) return t.comparedDocument;
  return null;
}
function af(e) {
  return e.flatMap(({ title: t, contribution: n }) => {
    var r;
    return (r = n.shortcuts) != null && r.length ? [{ title: t, items: n.shortcuts }] : [];
  });
}
const gn = qt(null), Na = qt(null);
function sf({ api: e, store: t, children: n }) {
  const r = V(() => ({ api: e, store: t }), [e, t]);
  return /* @__PURE__ */ g(gn.Provider, { value: r, children: n });
}
function rr() {
  const e = st(gn);
  if (!e) throw new Error("useReaderApi 要在 ReaderExtensionsProvider 里面用");
  return e.api;
}
const cf = () => () => {
}, oo = () => _a;
function lf(e) {
  return mn(e.subscribe, e.getSnapshot, e.getSnapshot);
}
function Aa() {
  var t;
  const e = (t = st(gn)) == null ? void 0 : t.store;
  return mn((e == null ? void 0 : e.subscribe) ?? cf, (e == null ? void 0 : e.getSnapshot) ?? oo, (e == null ? void 0 : e.getSnapshot) ?? oo);
}
function La(e) {
  var a;
  const t = (a = st(gn)) == null ? void 0 : a.store, n = st(Na);
  if (!n) throw new Error("useReaderContribution 只能在扩展组件里用");
  const { id: r, title: o } = n;
  C(() => {
    t == null || t.set(r, o, e);
  }, [t, r, o, e]), C(() => () => t == null ? void 0 : t.remove(r), [t, r]);
}
class uf extends is {
  constructor() {
    super(...arguments);
    Sr(this, "state", { failed: !1 });
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
const df = Vt(function({ extensions: t }) {
  return /* @__PURE__ */ g($e, { children: t.map(({ id: n, title: r, Component: o }) => /* @__PURE__ */ g(uf, { id: n, children: /* @__PURE__ */ g(ff, { id: n, title: r, children: /* @__PURE__ */ g(o, {}) }) }, n)) });
});
function ff({ id: e, title: t, children: n }) {
  const r = V(() => ({ id: e, title: t }), [e, t]);
  return /* @__PURE__ */ g(Na.Provider, { value: r, children: n });
}
function mf({
  marks: e,
  page: t,
  height: n,
  onOpen: r
}) {
  const o = e.filter((a) => a.anchor.page === t);
  return o.length ? /* @__PURE__ */ g("div", { className: "reader-ask-marks", "aria-label": "这一页问过的地方", children: o.map((a) => {
    var i;
    const s = a.title || a.anchor.selection || a.anchor.sourceText || `第 ${t} 页`;
    return /* @__PURE__ */ g(
      Q,
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
const hf = 4e3;
function pf(e, t, n) {
  if (e.length) {
    const o = ha(e, n), a = o ? ma(e).find((s) => s.id === o) : null;
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
  const t = e.getRangeAt(0), n = t.startContainer, r = ((s = (a = n.nodeType === 1 ? n : n.parentElement) == null ? void 0 : a.closest) == null ? void 0 : s.call(a, `[${Ie}]`)) ?? null;
  return r ? { text: `${e}`.replace(/\s+\n/g, `
`).trim().slice(0, hf), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function gf(e, t, n, r, o) {
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
function bf({
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
  const l = e.getAttribute(we) === "source" ? "source" : "translated", u = e.getBoundingClientRect(), m = u.width > 0 && u.height > 0 ? { x: Math.min(1, Math.max(0, (t - u.left) / u.width)), y: Math.min(1, Math.max(0, (n - u.top) / u.height)) } : null, f = (r ? a.find((p) => p.itemId === r) ?? null : null) ?? (m ? gf(a, i, l, c, m) : null);
  return {
    pane: l,
    page: c,
    itemId: (f == null ? void 0 : f.itemId) ?? null,
    selection: o,
    sourceText: `${(f == null ? void 0 : f.source.text) || (f == null ? void 0 : f.markdown) || ""}`.trim(),
    translatedText: `${(f == null ? void 0 : f.translatedBlockText) || (f == null ? void 0 : f.translated.text) || ""}`.trim(),
    section: pf(s, a, (f == null ? void 0 : f.source.page) ?? c),
    point: m
  };
}
const so = 5e4, yf = 2e4;
function Tn(e, t) {
  const n = `${e || ""}`;
  return n.length > t ? n.slice(0, t) : n;
}
function Hp(e, t) {
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
function Rf(e, t, n, r) {
  var l, u, m;
  const o = ((m = (u = (l = e.context) == null ? void 0 : l.meta) == null ? void 0 : u.retainpdf) == null ? void 0 : m.selection) ?? null, a = (o == null ? void 0 : o.document_id) || t || null, s = e.sessionId && e.sessionId.length <= 256 ? e.sessionId : null, i = { agent_id: e.agentId || null, document_id: a, session_id: s }, c = e.answer.usage && JSON.stringify(e.answer.usage).length <= 4096 ? e.answer.usage : null;
  return [
    { ...i, role: "user", text: Tn(e.question.text, so), selection: o, client_message_id: `${n}-q`, ...r ? { edited_from: r } : {} },
    {
      ...i,
      role: "assistant",
      text: Tn(e.answer.text, so),
      thought: e.answer.thought ? Tn(e.answer.thought, yf) : null,
      usage: c,
      client_message_id: `${n}-a`,
      memory_ids: e.memoryIds.slice(0, 10)
    }
  ];
}
function Tf(e) {
  return new Date(e - 2e3).toISOString().replace(/\.\d+Z$/, "Z");
}
function Ef(e, t) {
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
const _f = 50, En = { conversation: null, main: null, records: [], compactions: [], hasMore: !1, key: "local", initial: [] };
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
  const r = (e == null ? void 0 : e.conversations) ?? null, o = (e == null ? void 0 : e.memories) ?? null, [a, s] = _(!1), [i, c] = _(En), [l, u] = _(!1), [m, d] = _(""), [f, p] = _("idle"), [h, b] = _(null), [w, v] = _(() => /* @__PURE__ */ new Map()), y = N(/* @__PURE__ */ new Set()), S = N(/* @__PURE__ */ new Map()), k = (j) => {
    if (!j) return null;
    const U = S.current.get(j);
    return U || (E.current.records.some((W) => W.message_id === j) ? j : null);
  }, E = N(i);
  E.current = i;
  const L = N(t);
  L.current = t;
  const $ = N(0), O = x(async (j, U, W, pe = []) => {
    if (!r) return;
    const q = await r.messages(j.conversation_id, { limit: _f, ...W ? { beforeSeq: W } : {} }), K = [...q.messages, ...pe];
    $.current += 1, c({
      conversation: j,
      main: U ?? j,
      records: K,
      compactions: q.compactions || [],
      hasMore: q.has_more,
      key: `${j.conversation_id}:${$.current}`,
      initial: If(K, q.compactions || [], L.current.documentId)
    });
  }, [r]), A = x(async () => {
    var j;
    if (s(!0), !(!r || ((j = E.current.conversation) == null ? void 0 : j.kind) === "main")) {
      u(!0), d("");
      try {
        const U = await r.main(L.current.documentId || void 0);
        await O(U, U);
      } catch (U) {
        d(U instanceof Error ? U.message : String(U));
      } finally {
        u(!1);
      }
    }
  }, [r, O]), I = x((j) => {
    b(j), A();
  }, [A]), R = N(t.documentId);
  C(() => {
    R.current !== t.documentId && (R.current = t.documentId, E.current = En, c(En), b(null), v(/* @__PURE__ */ new Map()), S.current.clear(), a && A());
  }, [t.documentId, a, A]);
  const P = x(async () => {
    const j = E.current, U = j.records[0];
    if (!(!j.conversation || !U || !j.hasMore)) {
      u(!0);
      try {
        await O(j.conversation, j.main, U.seq, j.records);
      } finally {
        u(!1);
      }
    }
  }, [O]), T = x(async (j) => {
    const W = E.current.conversation;
    if (!r || !W) return;
    for (const ae of j.memoryIds) y.current.add(ae);
    let pe = j.memoryIds;
    if (!pe.length && o && j.startedAt) {
      const ae = Ef(
        await o.list({ source_conversation_id: W.conversation_id, created_after: Tf(j.startedAt) }).catch(() => []),
        y.current
      );
      for (const Re of ae) y.current.add(Re.id);
      pe = ae.map((Re) => Re.id);
      const he = j.answerId;
      ae.length && he && v((Re) => new Map(Re).set(he, ae));
    }
    const q = Rf({ ...j, memoryIds: pe }, L.current.documentId, Nf(), k(j.editedFrom));
    let K;
    try {
      K = await r.append(W.conversation_id, q);
    } catch (ae) {
      if (W.kind !== "side" || !/ask_conversation_not_open/.test(io(ae))) throw ae;
      await r.reopen(W.conversation_id), K = await r.append(W.conversation_id, q);
    }
    const [ie, ue] = K.messages;
    j.questionId && ie && S.current.set(j.questionId, ie.message_id), j.answerId && ue && S.current.set(j.answerId, ue.message_id), c((ae) => {
      var he;
      return ((he = ae.conversation) == null ? void 0 : he.conversation_id) === W.conversation_id ? { ...ae, conversation: K.conversation, records: [...ae.records, ...K.messages] } : ae;
    }), n == null || n(K.messages), K.compaction_due && W.kind === "main" && r.compact(W.conversation_id).catch(() => {
    });
  }, [r, o, n]), M = x(async (j) => {
    const U = E.current.conversation, W = k(j);
    if (!r || !U || !W) return null;
    try {
      await r.supersede(U.conversation_id, W);
    } catch (K) {
      if (!/ask_message_superseded/.test(io(K))) throw K;
    }
    const pe = E.current.records.find((K) => K.message_id === W), q = E.current.records.findIndex((K) => K.message_id === W);
    return c((K) => ({ ...K, records: K.records.map((ie, ue) => ue >= q && q >= 0 && !ie.superseded_at ? { ...ie, superseded_at: "now" } : ie) })), (pe == null ? void 0 : pe.selection) ?? null;
  }, [r]), B = x((j) => {
    T(j).catch((U) => d(`这一轮没存上：${U instanceof Error ? U.message : String(U)}`));
  }, [T]), z = x(async (j) => {
    var pe;
    const U = E.current, W = U.main;
    if (!(!r || !W || ((pe = U.conversation) == null ? void 0 : pe.kind) !== "main")) {
      d("");
      try {
        const q = Pf(U.records, j), K = await r.fork({
          parent_id: W.conversation_id,
          ...q ? { forked_from_message_id: q } : {},
          title: Mf(j.text),
          ...L.current.documentId ? { document_id: L.current.documentId } : {}
        });
        await O(K, W);
      } catch (q) {
        d(`开不了副对话：${q instanceof Error ? q.message : String(q)}`);
      }
    }
  }, [r, O]), G = x(async (j) => {
    const U = E.current.main;
    if (r)
      try {
        await O(await r.get(j), U);
      } catch (W) {
        d(`打不开副对话：${W instanceof Error ? W.message : String(W)}`);
      }
  }, [r, O]), J = x(async () => {
    const j = E.current.main;
    j && await O(j, j).catch(() => {
    });
  }, [O]), ne = x(async () => {
    const j = E.current.conversation;
    if (!(!r || (j == null ? void 0 : j.kind) !== "side")) {
      p("busy");
      try {
        await r.close(j.conversation_id), p("idle"), await J();
      } catch {
        p("failed");
      }
    }
  }, [r, J]), oe = x(async () => {
    const j = E.current.main;
    if (!r || !j) return;
    await r.archive(j.conversation_id);
    const U = await r.main(L.current.documentId || void 0);
    await O(U, U);
  }, [r, O]);
  return {
    visible: a,
    view: i,
    loading: l,
    error: m,
    pending: h,
    setPending: b,
    closingSide: f,
    notices: w,
    persistent: !!r,
    openMain: A,
    ask: I,
    close: x(() => s(!1), []),
    loadEarlier: P,
    onTurn: B,
    rewrite: M,
    fork: z,
    openSide: G,
    backToMain: J,
    closeSide: ne,
    archiveMain: oe,
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
  const [o, a] = _([]), s = N(0), i = N(r);
  i.current = r;
  const c = () => (s.current += 1, s.current);
  C(() => {
    var f, p;
    if (a([]), !e || !t) return;
    let m = !1;
    const d = (h) => {
      !m && h.length && a((b) => [...b, ...h]);
    };
    return (f = e.threads) == null || f.list(t).then(
      (h) => d(h.map((b) => ({ key: c(), anchor: b.anchor, threadId: b.threadId, title: b.title }))),
      () => {
      }
    ), (p = e.conversations) == null || p.bookMessages(t).then(
      (h) => d(h.map((b) => co(b, c(), i.current)).filter((b) => !!b)),
      () => {
      }
    ), () => {
      m = !0;
    };
  }, [e, t, n]);
  const l = x((m) => {
    const d = m.filter((f) => !f.document_id || f.document_id === t).map((f) => co(f, c(), i.current)).filter((f) => !!f);
    d.length && a((f) => [...f.filter((p) => !d.some((h) => h.messageId === p.messageId)), ...d]);
  }, [t]), u = x((m) => a((d) => d.filter((f) => f.key !== m)), []);
  return { marks: o, addRecords: l, removeMark: u };
}
const xf = Oo(() => import("./ReaderAskPanel-B9MTocS1.js"));
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
  pageCount: u
}) {
  var P;
  const m = V(() => ({ documentId: t, jobId: n, versionId: r }), [t, n, r]), d = x((T, M, B) => {
    const z = T ? o.find((ne) => ne.itemId === T) : null, G = z ? Tt(z, a, M) : null, J = G && G.box.page === B ? dt(G, 1, 1) : null;
    return J ? { x: J.left, y: J.top } : null;
  }, [o, a]), f = Lf({ port: e, documentId: t, resetKey: c, pointOf: d }), p = Af({ port: e, book: m, onAppended: f.addRecords }), [h, b] = _(null), w = x(
    (T, M, B, z) => bf({
      pageElement: (T == null ? void 0 : T.closest(`[${Ie}]`)) ?? null,
      clientX: M,
      clientY: B,
      itemId: i(),
      selection: z,
      regions: o,
      bookmarks: s,
      metadata: a
    }),
    [i, o, s, a]
  ), v = x(() => {
    var M;
    const T = ao(((M = globalThis.getSelection) == null ? void 0 : M.call(globalThis)) ?? null);
    return !T.text || !T.element || !T.rect ? null : w(T.element, T.rect.left + T.rect.width / 2, T.rect.top + T.rect.height / 2, T.text);
  }, [w]), y = x((T) => {
    b(null), p.ask(T);
  }, [p.ask]);
  C(() => {
    if (!e) return;
    const T = (M) => {
      var G;
      if (M.key !== "?" || M.metaKey || M.ctrlKey || M.altKey || M.defaultPrevented) return;
      const B = M.target;
      if ((G = B == null ? void 0 : B.closest) != null && G.call(B, "input, textarea, select, [contenteditable='true']")) return;
      const z = v();
      z && (M.preventDefault(), M.stopImmediatePropagation(), y(z));
    };
    return window.addEventListener("keydown", T, !0), () => window.removeEventListener("keydown", T, !0);
  }, [e, v, y]);
  const S = N(""), k = ((P = p.pending) == null ? void 0 : P.selection) || "";
  C(() => {
    k && (S.current = k);
  }, [k]);
  const E = p.visible && !h, L = p.setPending;
  C(() => {
    if (!E) return;
    let T = null;
    const M = () => {
      T && clearTimeout(T), T = setTimeout(() => {
        const B = v();
        B && B.selection !== S.current && L(B);
      }, 250);
    };
    return document.addEventListener("selectionchange", M), () => {
      T && clearTimeout(T), document.removeEventListener("selectionchange", M);
    };
  }, [E, v, L]);
  const $ = x(async (T) => {
    if (T.threadId && (e != null && e.threads) && t) {
      try {
        const M = await e.threads.get(t, T.threadId);
        b({ anchor: M.anchor || T.anchor, messages: M.messages || [], mark: T });
      } catch {
        b({ anchor: T.anchor, messages: [], mark: T });
      }
      return;
    }
    b(null), p.openMain();
  }, [e, t, p.openMain]), O = x((T) => {
    var z;
    if (!e) return [];
    const M = ao(((z = globalThis.getSelection) == null ? void 0 : z.call(globalThis)) ?? null), B = w(T.target, T.clientX, T.clientY, M.element ? M.text : "");
    return B ? [{
      key: "ask",
      label: B.selection ? "问这段" : "在这里提问",
      hint: B.selection ? "?" : void 0,
      onSelect: () => y(B)
    }] : [];
  }, [e, w, y]), A = h ? {
    anchor: h.anchor,
    messages: h.messages,
    onClose: () => b(null),
    onDelete: e != null && e.threads && h.mark.threadId ? () => {
      e.threads.remove(t, h.mark.threadId).catch(() => {
      }), f.removeMark(h.mark.key), b(null);
    } : void 0
  } : null, I = !p.persistent || !!p.view.conversation || !!p.error, R = e && (p.visible && I || h) ? /* @__PURE__ */ g(Co, { fallback: null, children: /* @__PURE__ */ g(
    xf,
    {
      port: e,
      jobId: n,
      book: m,
      ask: p,
      legacy: A,
      onShowSelection: ({ page: T, pane: M }) => l(T, M),
      onJumpToPage: (T) => l(T),
      pageCount: u
    }
  ) }) : null;
  return { marks: f.marks, onMark: $, menuItems: O, panel: R, open: p.openMain, enabled: !!e };
}
const Cf = [{ keys: "选字 + ?", desc: "问选中的这段" }];
function Of() {
  const e = rr(), t = V(() => {
    try {
      return qe().ask ?? null;
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
    pageCount: e.pageCount
  }), { marks: r, onMark: o, menuItems: a, panel: s, enabled: i } = n, c = V(() => i ? {
    menuItems: a,
    pageLayer: r.length ? ({ page: l, height: u }) => /* @__PURE__ */ g(mf, { marks: r, page: l, height: u, onOpen: o }) : void 0,
    shortcuts: Cf
  } : {}, [i, a, r, o]);
  return La(c), s;
}
const $f = { id: "ask", title: "提问", Component: Of };
function Hn() {
  try {
    return qe().translationVersions ?? null;
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
  const [n, r] = _([]), [o, a] = _(null);
  C(() => {
    r([]);
    const i = Hn();
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
  const [o, a] = _(null), [s, i] = _(""), [c, l] = _(""), u = N(0);
  C(() => {
    u.current += 1, a(null), i(""), l("");
  }, [e, t]);
  const m = x((p) => {
    const h = Hn(), b = n.find((v) => v.versionId === p);
    if (!h || !b || !e) return;
    const w = ++u.current;
    i(p), l(""), (async () => {
      const v = qe(), y = await h.resolveJob(e, p);
      if (!y) throw new Error("这一份还没有能读的译文。");
      const S = await v.loadReaderPayload(y, { includeOptionalArtifacts: !0 }), k = v.resolveReaderTranslatedPdfUrl(S.jobPayload, S.manifestPayload);
      if (!k) throw new Error("这一份没有译文 PDF。");
      return { versionId: p, name: b.name, jobId: y, url: k, regions: zf(zo(S.regionsPayload)) };
    })().then((v) => {
      w === u.current && a(v);
    }).catch((v) => {
      w === u.current && l((v == null ? void 0 : v.message) || "这一份打不开。");
    }).finally(() => {
      w === u.current && i("");
    });
  }, [e, n]), d = x(() => {
    u.current += 1, a(null), i(""), l("");
  }, []), f = x(async () => {
    var b, w;
    const p = Hn();
    if (!p || !o || !e) return;
    try {
      await p.select(e, o.versionId);
    } catch (v) {
      l((v == null ? void 0 : v.message) || "换不过去，请稍后再试。");
      return;
    }
    const h = (b = globalThis.location) == null ? void 0 : b.href;
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
    Icon: xs,
    pressed: !!(e.compared || e.loading),
    popup: (t) => /* @__PURE__ */ g(Wd, { compare: e, onDone: t })
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
  const e = rr(), t = Hf({
    documentId: e.documentId,
    jobId: e.jobId,
    versions: e.translationVersions,
    readingVersionId: e.versionId || ""
  }), { visibleMode: n, setWorkspace: r } = e, o = ((i = t.compared) == null ? void 0 : i.url) || "";
  C(() => {
    o && n !== "compare" && r("compare");
  }, [o]);
  const a = t.clear;
  C(() => {
    n !== "compare" && a();
  }, [n, a]);
  const s = V(() => {
    const c = Uf(t);
    return { toolbarItems: c ? [c] : [], comparedDocument: Wf(t) };
  }, [t]);
  return La(s), null;
}
const Vf = { id: "compare", title: "对比版本", Component: Kf }, qf = Do(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
  return /* @__PURE__ */ D(
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
        /* @__PURE__ */ g("rect", { x: "2", y: "5", width: "20", height: "14", rx: "2.5" }),
        /* @__PURE__ */ g("path", { d: "M6 15V9l2.5 3L11 9v6" }),
        /* @__PURE__ */ g("path", { d: "M16.5 9v6M14.5 13l2 2 2-2" })
      ]
    }
  );
}), Jf = qf;
function Gf(e) {
  const t = N(!1);
  return e && (t.current = !0), t.current;
}
const Xf = Oo(() => import("./ReaderMarkdownPanel-CAMFW-S4.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), xa = { id: "markdown", label: "Markdown", short: "MD", Icon: Jf, needsJob: !0 };
function Zf() {
  const e = rr(), t = e.activePanel === xa.id;
  return Gf(t) ? /* @__PURE__ */ g(Co, { fallback: null, children: /* @__PURE__ */ g(Xf, { open: t, jobId: e.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: e.closePanel }) }) : null;
}
const Yf = {
  id: "markdown",
  title: "Markdown",
  Component: Zf,
  panels: [xa]
}, or = [Yf, Vf, $f];
function ar(e = or) {
  return e.flatMap((t) => (t.panels ?? []).map(({ id: n, label: r, short: o, Icon: a, needsJob: s }) => ({ id: n, label: r, short: o, Icon: a, needsJob: s })));
}
function Qf(e) {
  const t = Je(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ g($e, { children: (e.tabs ?? ar()).map(({ id: s, label: i, Icon: c, needsJob: l }) => {
    const u = n === s, m = l && r, d = u ? `收起${i}` : `打开${i}`;
    return /* @__PURE__ */ D(
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
          /* @__PURE__ */ g(c, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
          /* @__PURE__ */ g("span", { className: "reader-panel-toggle-label", "aria-hidden": "true", children: i })
        ]
      },
      s
    );
  }) });
}
function em(e) {
  const t = Je(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = ar().map(({ id: c, label: l, short: u, Icon: m, needsJob: d }) => ({
    key: c,
    label: l,
    short: u,
    Icon: m,
    disabled: d && o,
    selected: n === c,
    badge: r == null ? void 0 : r[c],
    onClick: () => a(c)
  }));
  return n ? /* @__PURE__ */ D("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ g("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: c, label: l, Icon: u, disabled: m, selected: d, badge: f, onClick: p }) => /* @__PURE__ */ D(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": d,
        className: `reader-assistant-dock-tab${d ? " is-active" : ""}`,
        title: m ? `${l} 需打开任务阅读` : l,
        disabled: m,
        onClick: p,
        children: [
          /* @__PURE__ */ g(u, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
          /* @__PURE__ */ g("span", { className: "reader-assistant-dock-tab-label", children: l }),
          f ? /* @__PURE__ */ g("span", { className: "reader-assistant-dock-badge", children: f }) : null
        ]
      },
      c
    )) }),
    /* @__PURE__ */ g(
      "button",
      {
        type: "button",
        className: "reader-assistant-dock-close",
        "aria-label": "关闭阅读辅助面板",
        title: "关闭辅助面板",
        onClick: s,
        children: /* @__PURE__ */ g(ft, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function tm(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function nm(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function rm(e) {
  return e / 100 * window.innerHeight;
}
function om(e) {
  return e / 100 * window.innerWidth;
}
function am(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function $t({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = am(n);
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
      r = nm(t, o);
      break;
    }
    case "em": {
      r = tm(t, o);
      break;
    }
    case "vh": {
      r = rm(o);
      break;
    }
    case "vw": {
      r = om(o);
      break;
    }
  }
  return r;
}
function ke(e) {
  return parseFloat(e.toFixed(3));
}
function Pt({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function Un(e) {
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
      const u = $t({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = ke(u / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const u = $t({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = ke(u / n * 100);
    }
    let c = 0;
    if (a.minSize !== void 0) {
      const u = $t({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      c = ke(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = $t({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      l = ke(u / n * 100);
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
function le(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function Wn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? sm : im
  );
}
function sm(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function im(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function Da(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Ca(e, t) {
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
function cm({
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
    const { x: i, y: c } = Ca(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return le(o, "No rect found"), o;
}
let tn;
function lm() {
  return tn === void 0 && (typeof matchMedia == "function" ? tn = !!matchMedia("(pointer:coarse)").matches : tn = !1), tn;
}
function Oa(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Wn(
    n,
    Array.from(t.children).filter(Da).map((p) => ({ element: p }))
  ).map(({ element: p }) => p), s = [];
  let i = !1, c = !1, l = -1, u = -1, m = 0, d, f = [];
  {
    let p = -1;
    for (const h of a)
      h.hasAttribute("data-panel") && (p++, h.hasAttribute("data-disabled") || (m++, l === -1 && (l = p), u = p));
  }
  if (m > 1) {
    let p = -1;
    for (const h of a)
      if (h.hasAttribute("data-panel")) {
        p++;
        const b = r.find(
          (w) => w.element === h
        );
        if (b) {
          if (d) {
            const w = d.element.getBoundingClientRect(), v = h.getBoundingClientRect();
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
              ), k = n === "horizontal" ? new DOMRect(v.left, v.top, 0, v.height) : new DOMRect(v.left, v.top, v.width, 0);
              switch (f.length) {
                case 0: {
                  y = [
                    S,
                    k
                  ];
                  break;
                }
                case 1: {
                  const E = f[0], L = cm({
                    orientation: n,
                    rects: [w, v],
                    targetRect: E.element.getBoundingClientRect()
                  });
                  y = [
                    E,
                    L === w ? k : S
                  ];
                  break;
                }
                default: {
                  y = f;
                  break;
                }
              }
            } else
              f.length ? y = f : y = [
                n === "horizontal" ? new DOMRect(
                  w.right,
                  v.top,
                  v.left - w.right,
                  v.height
                ) : new DOMRect(
                  v.left,
                  w.bottom,
                  v.width,
                  v.top - w.bottom
                )
              ];
            for (const S of y) {
              let k = "width" in S ? S : S.element.getBoundingClientRect();
              const E = lm() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (k.width < E) {
                const $ = E - k.width;
                k = new DOMRect(
                  k.x - $ / 2,
                  k.y,
                  k.width + $,
                  k.height
                );
              }
              if (k.height < E) {
                const $ = E - k.height;
                k = new DOMRect(
                  k.x,
                  k.y - $ / 2,
                  k.width,
                  k.height + $
                );
              }
              const L = p <= l || p > u;
              !i && !L && s.push({
                group: e,
                groupSize: Pt({ group: e }),
                panels: [d, b],
                separator: "width" in S ? void 0 : S,
                rect: k
              }), i = !1;
            }
          }
          c = !1, d = b, f = [];
        }
      } else if (h.hasAttribute("data-separator")) {
        h.ariaDisabled !== null && (i = !0);
        const b = o.find(
          (w) => w.element === h
        );
        b ? f.push(b) : (d = void 0, f = []);
      } else
        c = !0;
  }
  return s;
}
var Ye;
class $a {
  constructor() {
    Ir(this, Ye, {});
  }
  addListener(t, n) {
    const r = _t(this, Ye)[t];
    return r === void 0 ? _t(this, Ye)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = _t(this, Ye)[t];
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
    Rr(this, Ye, {});
  }
  removeListener(t, n) {
    const r = _t(this, Ye)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
Ye = new WeakMap();
let It = {
  cursorFlags: 0,
  state: "inactive"
};
const sr = new $a();
function ct() {
  return It;
}
function um(e) {
  return sr.addListener("change", e);
}
function dm(e) {
  const t = It, n = { ...It };
  n.cursorFlags = e, It = n, sr.emit("change", {
    prev: t,
    next: n
  });
}
function Rt(e) {
  const t = It;
  It = e, sr.emit("change", {
    prev: t,
    next: e
  });
}
const fm = (e) => e, Pn = () => {
}, za = 1, Fa = 2, Ba = 4, ja = 8, lo = 3, uo = 12;
let nn;
function fo() {
  return nn === void 0 && (nn = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (nn = !0)), nn;
}
function mm({
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
        if (e && fo()) {
          const a = (e & za) !== 0, s = (e & Fa) !== 0, i = (e & Ba) !== 0, c = (e & ja) !== 0;
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
    return fo() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const mo = /* @__PURE__ */ new WeakMap();
function ir(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = mo.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = ct();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = mm({
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
  mo.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Ce = /* @__PURE__ */ new Map();
const Ha = new $a();
function hm(e) {
  Ce = new Map(Ce), Ce.delete(e);
}
function ho(e, t) {
  for (const [n] of Ce)
    if (n.id === e)
      return n;
}
function tt(e, t) {
  for (const [n, r] of Ce)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function mt() {
  return Ce;
}
function cr(e, t) {
  return Ha.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Ve(e, t, n) {
  const r = Ce.get(e);
  Ce = new Map(Ce), Ce.set(e, t), Ha.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function Ua(e) {
  const t = ct();
  let n = !1;
  switch (t.state) {
    case "active":
      Rt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (ir(e), n = !0, t.hitRegions.forEach((r) => {
        const o = tt(r.group.id, !0);
        Ve(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function po(e) {
  e.defaultPrevented || Ua(e.currentTarget);
}
function pm(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Ca(n, a.rect);
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
function gm(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function bm(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: yo(e),
    b: yo(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  le(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: bo(go(n.a)),
    b: bo(go(n.b))
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
const ym = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function vm(e) {
  const t = getComputedStyle(Wa(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function wm(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || vm(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || ym.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function go(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (le(n, "Missing node"), wm(n)) return n;
  }
  return null;
}
function bo(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function yo(e) {
  const t = [];
  for (; e; )
    t.push(e), e = Wa(e);
  return t;
}
function Wa(e) {
  const { parentNode: t } = e;
  return gm(t) ? t.host : t;
}
function Sm(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function km({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!Da(n) || n.contains(e) || e.contains(n))
    return !0;
  if (bm(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Sm(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function lr(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = Oa(o), s = pm(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && km({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function Im(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function ve(e, t, n = 0) {
  return Math.abs(ke(e) - ke(t)) <= n;
}
function De(e, t) {
  return ve(e, t) ? 0 : e > t ? 1 : -1;
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
  if (De(r, c) < 0)
    if (a) {
      const l = (o + c) / 2;
      De(r, l) < 0 ? r = o : r = c;
    } else
      r = c;
  return r = Math.min(i, r), r = ke(r), r;
}
function Ut({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (ve(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), c = Object.values(o), l = [...i], [u, m] = r;
  le(u != null, "Invalid first pivot index"), le(m != null, "Invalid second pivot index");
  let d = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? m : u, b = n[h];
        le(
          b,
          `Panel constraints not found for index ${h}`
        );
        const {
          collapsedSize: w = 0,
          collapsible: v,
          minSize: y = 0
        } = b;
        if (v) {
          const S = i[h];
          if (le(
            S != null,
            `Previous layout not found for panel index ${h}`
          ), ve(S, w)) {
            const k = y - S;
            De(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      {
        const h = e < 0 ? u : m, b = n[h];
        le(
          b,
          `No panel constraints found for index ${h}`
        );
        const {
          collapsedSize: w = 0,
          collapsible: v,
          minSize: y = 0
        } = b;
        if (v) {
          const S = i[h];
          if (le(
            S != null,
            `Previous layout not found for panel index ${h}`
          ), ve(S, y)) {
            const k = S - w;
            De(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? m : u, b = n[h];
      le(
        b,
        `Panel constraints not found for index ${h}`
      );
      const w = i[h], { collapsible: v, collapsedSize: y, minSize: S } = b;
      if (v && De(w, S) < 0)
        if (e > 0) {
          const k = S - y, E = k / 2, L = w + e;
          De(L, S) < 0 && (e = De(e, E) <= 0 ? 0 : k);
        } else {
          const k = S - y, E = 100 - k / 2, L = w - e;
          De(L, S) < 0 && (e = De(100 + e, E) > 0 ? 0 : -k);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let b = e < 0 ? m : u, w = 0;
    for (; ; ) {
      const y = i[b];
      le(
        y != null,
        `Previous layout not found for panel index ${b}`
      );
      const S = kt({
        overrideDisabledPanels: s,
        panelConstraints: n[b],
        prevSize: y,
        size: 100
      }) - y;
      if (w += S, b += h, b < 0 || b >= n.length)
        break;
    }
    const v = Math.min(Math.abs(e), Math.abs(w));
    e = e < 0 ? 0 - v : v;
  }
  {
    let h = e < 0 ? u : m;
    for (; h >= 0 && h < n.length; ) {
      const b = Math.abs(e) - Math.abs(d), w = i[h];
      le(
        w != null,
        `Previous layout not found for panel index ${h}`
      );
      const v = w - b, y = kt({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: w,
        size: v
      });
      if (!ve(w, y) && (d += w - y, l[h] = y, d.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (Im(c, l))
    return o;
  {
    const h = e < 0 ? m : u, b = i[h];
    le(
      b != null,
      `Previous layout not found for panel index ${h}`
    );
    const w = b + d, v = kt({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: b,
      size: w
    });
    if (l[h] = v, !ve(v, w)) {
      let y = w - v, S = e < 0 ? m : u;
      for (; S >= 0 && S < n.length; ) {
        const k = l[S];
        le(
          k != null,
          `Previous layout not found for panel index ${S}`
        );
        const E = k + y, L = kt({
          overrideDisabledPanels: s,
          panelConstraints: n[S],
          prevSize: k,
          size: E
        });
        if (ve(k, L) || (y -= L - k, l[S] = L), ve(y, 0))
          break;
        e > 0 ? S-- : S++;
      }
    }
  }
  const f = Object.values(l).reduce(
    (h, b) => b + h,
    0
  );
  if (!ve(f, 100, 0.1))
    return o;
  const p = Object.keys(o);
  return l.reduce((h, b, w) => (h[p[w]] = b, h), {});
}
function lt(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || De(e[n], t[n]) !== 0)
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
  if (!ve(o, 100) && r.length > 0)
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      le(c != null, `No layout data found for index ${i}`);
      const l = 100 / o * c;
      r[i] = l;
    }
  let a = 0;
  for (let i = 0; i < t.length; i++) {
    const c = n[i];
    le(c != null, `No layout data found for index ${i}`);
    const l = r[i];
    le(l != null, `No layout data found for index ${i}`);
    const u = kt({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: c,
      size: l
    });
    l != u && (a += l - u, r[i] = u);
  }
  if (!ve(a, 0))
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      le(c != null, `No layout data found for index ${i}`);
      const l = c + a, u = kt({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: c,
        size: l
      });
      if (c !== u && (a -= u - c, r[i] = u, ve(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, c, l) => (i[s[l]] = c, i), {});
}
function Ka({
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
        separatorToPanels: p
      }
    ] of c)
      if (l.id === e)
        return {
          defaultLayoutDeferred: u,
          derivedPanelConstraints: m,
          group: l,
          groupSize: f,
          layout: d,
          separatorToPanels: p
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
    const d = a(), f = l.findIndex((b) => b.id === t), p = f === 0, h = f === l.length - 1;
    if (h && c < d && (p || l.slice(0, f).every((b, w) => {
      const v = m[w];
      return (v == null ? void 0 : v.collapsible) && ve(v.collapsedSize, u[v.panelId]);
    }))) {
      const b = l.slice(0, f).reduce((w, v) => w + u[v.id], 0);
      return {
        ...u,
        [t]: ke(100 - b)
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
      layout: p,
      separatorToPanels: h
    } = n(), b = s({
      nextSize: c,
      panels: d.panels,
      prevLayout: p,
      derivedPanelConstraints: m
    }), w = ut({
      layout: b,
      panelConstraints: m
    });
    lt(p, w) || Ve(d, {
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
      return c && ve(l, u);
    },
    resize: (c) => {
      const { group: l } = n(), { element: u } = o(), m = Pt({ group: l }), d = $t({
        groupSize: m,
        panelElement: u,
        styleProp: c
      }), f = ke(d / m * 100);
      i(f);
    }
  };
}
function vo(e) {
  if (e.defaultPrevented)
    return;
  const t = mt();
  lr(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = Ka({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function rn(e) {
  const t = mt();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function Va({
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
      return r ? i : (lt(i, l) || Ve(a, {
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
  const n = rn(e), r = tt(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  le(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  le(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), i = Va({ groupId: n.id }).getLayout(), c = Ut({
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
  lt(i, l) || Ve(
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
function wo(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = rn(t);
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
        const r = rn(t), o = tt(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, c = r.separators.find(
          (d) => d.element === t
        );
        le(c, "Matching separator not found");
        const l = i.get(c);
        le(l, "Matching panels not found");
        const u = l[0], m = a.find(
          (d) => d.panelId === u.id
        );
        if (le(m, "Panel metadata not found"), m.collapsible) {
          const d = s[u.id], f = m.collapsedSize === d ? r.mutableState.expandedPanelSizes[u.id] ?? m.minSize : m.collapsedSize;
          ot(t, f - d);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = rn(t).separators.map(
          (s) => s.element
        ), o = Array.from(r).findIndex(
          (s) => s === e.currentTarget
        );
        le(o !== null, "Index not found");
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
function So(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = mt(), n = lr(e, t), r = /* @__PURE__ */ new Map();
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
function qa({
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
    const { group: u, groupSize: m } = l, { orientation: d, panels: f } = u, { disableCursor: p } = u.mutableState;
    let h = 0;
    a ? d === "horizontal" ? h = (t.clientX - a.x) / m * 100 : h = (t.clientY - a.y) / m * 100 : d === "horizontal" ? h = t.clientX < 0 ? -100 : 100 : h = t.clientY < 0 ? -100 : 100;
    const b = r.get(u), w = o.get(u);
    if (!b || !w)
      return;
    const {
      defaultLayoutDeferred: v,
      derivedPanelConstraints: y,
      groupSize: S,
      layout: k,
      separatorToPanels: E
    } = w;
    if (y && k && E) {
      const L = Ut({
        delta: h,
        initialLayout: b,
        panelConstraints: y,
        pivotIndices: l.panels.map(($) => f.indexOf($)),
        prevLayout: k,
        trigger: "mouse-or-touch"
      });
      if (lt(L, k)) {
        if (h !== 0 && !p)
          switch (d) {
            case "horizontal": {
              i |= h < 0 ? za : Fa;
              break;
            }
            case "vertical": {
              i |= h < 0 ? Ba : ja;
              break;
            }
          }
      } else
        Ve(l.group, {
          defaultLayoutDeferred: v,
          derivedPanelConstraints: y,
          groupSize: S,
          layout: L,
          separatorToPanels: E
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & lo : c |= i & lo, t.movementY === 0 ? c |= s & uo : c |= i & uo, dm(c), ir(e);
}
function ko(e) {
  const t = mt(), n = ct();
  switch (n.state) {
    case "active":
      qa({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function Io(e) {
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
        Rt({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = tt(a.group.id, !0);
          Ve(a.group, s, {
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
      qa({
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
      const a = lr(e, n);
      a.length === 0 ? t.state !== "inactive" && Rt({
        cursorFlags: 0,
        state: "inactive"
      }) : Rt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), ir(e.currentTarget);
      break;
    }
  }
}
function Ro(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (ct().state) {
      case "hover":
        Rt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function To(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || Ua(e.currentTarget) && e.preventDefault();
}
function Eo(e) {
  let t = 0, n = 0;
  const r = {};
  for (const a of e)
    if (a.defaultSize !== void 0) {
      t++;
      const s = ke(a.defaultSize);
      n += s, r[a.panelId] = s;
    } else
      r[a.panelId] = void 0;
  const o = e.length - t;
  if (o !== 0) {
    const a = ke((100 - n) / o);
    for (const s of e)
      s.defaultSize === void 0 && (r[s.panelId] = a);
  }
  return r;
}
function Rm(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((c) => c.element === t);
  if (!r || !r.onResize)
    return;
  const o = Pt({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: ke(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function Tm(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function Em({
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
        const f = d / 100 * n, p = ke(
          f / t * 100
        );
        i.set(m.id, p), o += p;
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
      u[m] = ke(
        d / a * l
      );
    }
  else {
    const m = ke(
      l / c.length
    );
    for (const d of c)
      u[d] = m;
  }
  return u;
}
function Pm(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const yt = /* @__PURE__ */ new Map();
function Mm(e) {
  let t = !0;
  le(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((p) => {
    for (const h of p) {
      const { borderBoxSize: b, target: w } = h;
      if (w === e.element) {
        if (t) {
          const v = Pt({ group: e });
          if (v === 0)
            return;
          const y = tt(e.id);
          if (!y)
            return;
          const S = Un(e), k = y.defaultLayoutDeferred ? Eo(S) : y.layout, E = Em({
            group: e,
            nextGroupSize: v,
            prevGroupSize: y.groupSize,
            prevLayout: k
          }), L = ut({
            layout: E,
            panelConstraints: S
          });
          if (!y.defaultLayoutDeferred && lt(y.layout, L) && Tm(
            y.derivedPanelConstraints,
            S
          ) && y.groupSize === v)
            return;
          Ve(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: S,
            groupSize: v,
            layout: L,
            separatorToPanels: y.separatorToPanels
          });
        }
      } else
        Rm(e, w, b);
    }
  });
  a.observe(e.element), e.panels.forEach((p) => {
    le(
      !r.has(p.id),
      `Panel ids must be unique; id "${p.id}" was used more than once`
    ), r.add(p.id), p.onResize && a.observe(p.element);
  });
  const s = Pt({ group: e }), i = Un(e), c = e.panels.map(({ id: p }) => p).join(",");
  let l = e.mutableState.defaultLayout;
  l && (Pm(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[c] ?? l ?? Eo(i), m = ut({
    layout: u,
    panelConstraints: i
  }), d = e.element.ownerDocument;
  yt.set(
    d,
    (yt.get(d) ?? 0) + 1
  );
  const f = /* @__PURE__ */ new Map();
  return Oa(e).forEach((p) => {
    p.separator && f.set(p.separator, p.panels);
  }), Ve(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: m,
    separatorToPanels: f
  }), e.separators.forEach((p) => {
    le(
      !o.has(p.id),
      `Separator ids must be unique; id "${p.id}" was used more than once`
    ), o.add(p.id), p.element.addEventListener("keydown", wo);
  }), yt.get(d) === 1 && (d.addEventListener("contextmenu", po, !0), d.addEventListener("dblclick", vo, !0), d.addEventListener("pointerdown", So, !0), d.addEventListener("pointerleave", ko), d.addEventListener("pointermove", Io), d.addEventListener("pointerout", Ro), d.addEventListener("pointerup", To, !0)), function() {
    t = !1, yt.set(
      d,
      Math.max(0, (yt.get(d) ?? 0) - 1)
    ), hm(e), e.separators.forEach((p) => {
      p.element.removeEventListener("keydown", wo);
    }), yt.get(d) || (d.removeEventListener(
      "contextmenu",
      po,
      !0
    ), d.removeEventListener(
      "dblclick",
      vo,
      !0
    ), d.removeEventListener(
      "pointerdown",
      So,
      !0
    ), d.removeEventListener("pointerleave", ko), d.removeEventListener("pointermove", Io), d.removeEventListener("pointerout", Ro), d.removeEventListener("pointerup", To, !0)), a.disconnect();
  };
}
function _m() {
  const [e, t] = _({}), n = x(() => t({}), []);
  return [e, n];
}
function ur(e) {
  const t = $o();
  return `${e ?? t}`;
}
const ht = typeof window < "u" ? Te : C;
function Ft(e) {
  const t = N(e);
  return ht(() => {
    t.current = e;
  }, [e]), x(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function dr(...e) {
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
function fr(e) {
  const t = N({ ...e });
  return ht(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const Ja = qt(null);
function Nm(e, t) {
  const n = N({
    getLayout: () => ({}),
    setLayout: fm
  });
  Jn(t, () => n.current, []), ht(() => {
    Object.assign(
      n.current,
      Va({ groupId: e })
    );
  });
}
function Ga({
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
  const p = N({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), h = Ft((I) => {
    lt(p.current.onLayoutChange, I) || (p.current.onLayoutChange = I, c == null || c(I));
  }), b = Ft(
    (I, R) => {
      lt(p.current.onLayoutChanged, I) || (p.current.onLayoutChanged = I, l == null || l(I, { isUserInteraction: R }));
    }
  ), w = ur(i), v = N(null), [y, S] = _m(), k = N({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: m,
    separators: []
  }), E = dr(v, a);
  Nm(w, s);
  const L = Ft(
    (I, R) => {
      const P = ct(), T = ho(I), M = tt(I);
      if (M) {
        let B = !1;
        switch (P.state) {
          case "active": {
            B = P.hitRegions.some(
              (z) => z.group === T
            );
            break;
          }
        }
        return {
          flexGrow: M.layout[R] ?? 1,
          pointerEvents: B ? "none" : void 0
        };
      }
      if (n != null && n[R])
        return {
          flexGrow: n == null ? void 0 : n[R]
        };
    }
  ), $ = fr({
    defaultLayout: n,
    disableCursor: r
  }), O = V(
    () => ({
      get disableCursor() {
        return !!$.disableCursor;
      },
      getPanelStyles: L,
      id: w,
      orientation: u,
      registerPanel: (I) => {
        const R = k.current;
        return R.panels = Wn(u, [
          ...R.panels,
          I
        ]), S(), () => {
          R.panels = R.panels.filter(
            (P) => P !== I
          ), S();
        };
      },
      registerSeparator: (I) => {
        const R = k.current;
        return R.separators = Wn(u, [
          ...R.separators,
          I
        ]), S(), () => {
          R.separators = R.separators.filter(
            (P) => P !== I
          ), S();
        };
      },
      updatePanelProps: (I, { disabled: R }) => {
        const P = k.current.panels.find(
          (B) => B.id === I
        );
        P && (P.panelConstraints.disabled = R);
        const T = ho(w), M = tt(w);
        T && M && Ve(T, {
          ...M,
          derivedPanelConstraints: Un(T)
        });
      },
      updateSeparatorProps: (I, {
        disabled: R,
        disableDoubleClick: P
      }) => {
        const T = k.current.separators.find(
          (M) => M.id === I
        );
        T && (T.disabled = R, T.disableDoubleClick = P);
      }
    }),
    [L, w, S, u, $]
  ), A = N(null);
  return ht(() => {
    const I = v.current;
    if (I === null)
      return;
    const R = k.current;
    let P;
    if ($.defaultLayout !== void 0 && Object.keys($.defaultLayout).length === R.panels.length) {
      P = {};
      for (const ne of R.panels) {
        const oe = $.defaultLayout[ne.id];
        oe !== void 0 && (P[ne.id] = oe);
      }
    }
    const T = {
      disabled: !!o,
      element: I,
      id: w,
      mutableState: {
        defaultLayout: P,
        disableCursor: !!$.disableCursor,
        expandedPanelSizes: k.current.lastExpandedPanelSizes,
        layouts: k.current.layouts
      },
      orientation: u,
      panels: R.panels,
      resizeTargetMinimumSize: R.resizeTargetMinimumSize,
      separators: R.separators
    };
    A.current = T;
    const M = Mm(T), { defaultLayoutDeferred: B, derivedPanelConstraints: z, layout: G } = tt(T.id, !0);
    !B && z.length > 0 && (h(G), b(G, !1));
    const J = cr(w, (ne) => {
      const { defaultLayoutDeferred: oe, derivedPanelConstraints: j, layout: U } = ne.next;
      if (oe || j.length === 0)
        return;
      const W = T.panels.map(({ id: q }) => q).join(",");
      T.mutableState.layouts[W] = U, j.forEach((q) => {
        if (q.collapsible) {
          const { layout: K } = ne.prev ?? {};
          if (K) {
            const ie = ve(
              q.collapsedSize,
              U[q.panelId]
            ), ue = ve(
              q.collapsedSize,
              K[q.panelId]
            );
            ie && !ue && (T.mutableState.expandedPanelSizes[q.panelId] = K[q.panelId]);
          }
        }
      });
      const pe = ct().state !== "active";
      h(U), pe && b(U, ne.isUserInteraction);
    });
    return () => {
      A.current = null, M(), J();
    };
  }, [
    o,
    w,
    b,
    h,
    u,
    y,
    $
  ]), C(() => {
    const I = A.current;
    I && (I.mutableState.defaultLayout = n, I.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ g(Ja.Provider, { value: O, children: /* @__PURE__ */ g(
    "div",
    {
      ...f,
      className: t,
      "data-group": !0,
      "data-testid": w,
      id: w,
      ref: E,
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
Ga.displayName = "Group";
function mr() {
  const e = st(Ja);
  return le(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Am(e, t) {
  const { id: n } = mr(), r = N({
    collapse: Pn,
    expand: Pn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Pn
  });
  Jn(t, () => r.current, []), ht(() => {
    Object.assign(
      r.current,
      Ka({ groupId: n, panelId: e })
    );
  });
}
function Kn({
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
  ...p
}) {
  const h = !!c, b = ur(c), w = fr({
    disabled: a
  }), v = N(null), y = dr(v, s), {
    getPanelStyles: S,
    id: k,
    orientation: E,
    registerPanel: L,
    updatePanelProps: $
  } = mr(), O = m !== null, A = Ft(
    (T, M, B) => {
      m == null || m(T, c, B);
    }
  );
  ht(() => {
    const T = v.current;
    if (T !== null) {
      const M = {
        element: T,
        id: b,
        idIsStable: h,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: O ? A : void 0,
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
      return L(M);
    }
  }, [
    i,
    n,
    r,
    o,
    O,
    b,
    h,
    l,
    u,
    A,
    L,
    w
  ]), C(() => {
    $(b, { disabled: a });
  }, [a, b, $]), Am(b, d);
  const I = () => {
    const T = S(k, b);
    if (T)
      return JSON.stringify(T);
  }, R = mn(
    (T) => cr(k, T),
    I,
    I
  );
  let P;
  return R ? P = JSON.parse(R) : o !== void 0 ? P = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : P = { flexGrow: 1 }, /* @__PURE__ */ g(
    "div",
    {
      ...p,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": b,
      id: b,
      ref: y,
      style: {
        ...Lm,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...P
      },
      children: /* @__PURE__ */ g(
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
            touchAction: E === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
Kn.displayName = "Panel";
const Lm = {
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
function xm({
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
function Xa({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const c = ur(a), l = fr({
    disabled: n,
    disableDoubleClick: r
  }), [u, m] = _({}), [d, f] = _("inactive"), [p, h] = _(!1), b = N(null), w = dr(b, o), {
    disableCursor: v,
    id: y,
    orientation: S,
    registerSeparator: k,
    updateSeparatorProps: E
  } = mr(), L = S === "horizontal" ? "vertical" : "horizontal";
  ht(() => {
    const A = b.current;
    if (A !== null) {
      const I = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: A,
        id: c
      }, R = k(I), P = um(
        (M) => {
          f(
            M.next.state !== "inactive" && M.next.hitRegions.some(
              (B) => B.separator === I
            ) ? M.next.state : "inactive"
          );
        }
      ), T = cr(
        y,
        (M) => {
          const { derivedPanelConstraints: B, layout: z, separatorToPanels: G } = M.next, J = G.get(I);
          if (J) {
            const ne = J[0], oe = J.indexOf(ne);
            m(
              xm({
                layout: z,
                panelConstraints: B,
                panelId: ne.id,
                panelIndex: oe
              })
            );
          }
        }
      );
      return () => {
        P(), T(), R();
      };
    }
  }, [y, c, k, l]), C(() => {
    E(c, { disabled: n, disableDoubleClick: r });
  }, [n, r, c, E]);
  let $;
  n && !v && ($ = "not-allowed");
  let O;
  if (n)
    O = "disabled";
  else
    switch (d) {
      case "active": {
        O = "active";
        break;
      }
      default:
        p ? O = "focus" : O = d;
    }
  return /* @__PURE__ */ g(
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
      "data-separator": O,
      "data-testid": c,
      id: c,
      onBlur: () => h(!1),
      onFocus: () => h(!0),
      ref: w,
      role: "separator",
      style: {
        flexBasis: "auto",
        cursor: $,
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
Xa.displayName = "Separator";
const hr = 30, pr = 65, Wt = 50, Dm = 100 - pr, Cm = 100 - hr;
function Om(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(pr, Math.max(hr, t)) : Wt;
}
function gr(e) {
  return 100 - e;
}
function vt(e) {
  return `${e}%`;
}
const br = "reader-document", Kt = "reader-assistant", Za = "retainpdf.reader.ai-split-layout.v1", $m = {
  [br]: gr(Wt),
  [Kt]: Wt
};
function yr(e) {
  const t = Om(e == null ? void 0 : e[Kt]);
  return {
    [br]: gr(t),
    [Kt]: t
  };
}
function zm() {
  try {
    const e = JSON.parse(localStorage.getItem(Za) || "null");
    return yr(e);
  } catch {
    return $m;
  }
}
function Fm(e) {
  try {
    localStorage.setItem(Za, JSON.stringify(yr(e)));
  } catch {
  }
}
function Mn(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = yr(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[Kt]}vw`
  );
}
function Bm() {
  const e = N(null), [t] = _(zm);
  Te(() => {
    const o = e.current;
    return Mn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = x((o) => {
    Mn(e.current, o);
  }, []), r = x((o, a) => {
    Mn(e.current, o), a.isUserInteraction && Fm(o);
  }, []);
  return /* @__PURE__ */ D(
    Ga,
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
        /* @__PURE__ */ g(
          Kn,
          {
            id: br,
            defaultSize: vt(gr(Wt)),
            minSize: vt(Dm),
            maxSize: vt(Cm)
          }
        ),
        /* @__PURE__ */ g(
          Xa,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ g("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ g(
          Kn,
          {
            id: Kt,
            defaultSize: vt(Wt),
            minSize: vt(hr),
            maxSize: vt(pr)
          }
        )
      ]
    }
  );
}
function jm({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = _(!1);
  if (C(() => {
    !e && !t && o(!1);
  }, [e, t]), r || !e && !t)
    return null;
  const a = [
    e ? "译文区域" : "",
    t ? "阅读元数据" : ""
  ].filter(Boolean);
  return /* @__PURE__ */ D("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ D("span", { className: "reader-error-notice-text", children: [
      a.join("、"),
      "加载失败，正文仍可正常阅读。"
    ] }),
    n ? /* @__PURE__ */ g(Q, { className: "reader-error-notice-retry", "data-reader-retry": "optional", onClick: n, children: "重试" }) : null,
    /* @__PURE__ */ g(
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
function Hm({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ g(jm, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ D($e, { children: [
    e ? /* @__PURE__ */ g("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ D("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ g("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ g("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ g(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ D("div", { className: "reader-react-error", role: "alert", children: [
      /* @__PURE__ */ g("span", { className: "reader-react-error-text", children: n }),
      s ? /* @__PURE__ */ g(Q, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function Um(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Wm() {
  const [e, t] = _(!1), n = $o(), r = N(null), o = Aa(), a = V(() => [...vl, ...af(o)], [o]);
  return C(() => {
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
  }, [e]), C(() => {
    const s = (i) => {
      if (i.defaultPrevented || i.metaKey || i.ctrlKey || i.altKey || Um(i.target)) return;
      const c = i.key;
      if (c === "?" || c === "h" || c === "H" || c === "/") {
        if (c === "/" && !i.shiftKey)
          return;
        i.preventDefault(), t((l) => !l);
      }
    };
    return window.addEventListener("keydown", s), () => window.removeEventListener("keydown", s);
  }, []), /* @__PURE__ */ D("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
    /* @__PURE__ */ g(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-react-shortcuts-btn${e ? " is-active" : ""}`,
        "aria-label": "快捷键说明",
        "aria-expanded": e,
        "aria-controls": n,
        title: "快捷键（H 或 ?）",
        onClick: () => t((s) => !s),
        children: /* @__PURE__ */ g(Ds, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ D(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ D("div", { className: "reader-react-shortcuts-head", children: [
            /* @__PURE__ */ g("strong", { children: "快捷键" }),
            /* @__PURE__ */ g(
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
          /* @__PURE__ */ g("div", { className: "reader-react-shortcuts-body", children: a.map((s) => /* @__PURE__ */ D("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ g("h3", { children: s.title }),
            /* @__PURE__ */ g("ul", { children: s.items.map((i) => /* @__PURE__ */ D("li", { children: [
              /* @__PURE__ */ g("kbd", { children: i.keys }),
              /* @__PURE__ */ g("span", { children: i.desc })
            ] }, `${s.title}-${i.keys}`)) })
          ] }, s.title)) }),
          /* @__PURE__ */ g("p", { className: "reader-react-shortcuts-foot", children: "在输入框内不会触发快捷键" })
        ]
      }
    ) : null
  ] });
}
const Km = ["source", "sideBySide", "translated"], Vm = { source: "", translated: "", sideBySide: "" };
function qm(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = on(e.sourceUrl), n = on(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return ui({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function Jm(e) {
  const [t, n] = _(() => /* @__PURE__ */ new Set()), r = V(
    () => e ? qm(e) : Vm,
    [e]
  ), o = V(
    () => Km.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = x(async (s) => {
    if (!e) return;
    const i = on(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? li(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await di(
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
        fi(l), n((u) => {
          const m = new Set(u);
          return m.delete(s), m;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const Gm = {
  source: jo,
  sideBySide: Ho,
  translated: Uo
}, Xm = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function Zm(e) {
  const t = Je(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Jm(n), i = N(null);
  return C(() => {
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
  }, []), /* @__PURE__ */ D("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ D("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ g(Cs, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ g("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ g(Bo, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ g("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = us[c], u = on(r[c]), m = a.has(c), d = !!u && !m, f = d ? "" : ds(c, r), p = Gm[c];
      return /* @__PURE__ */ D(
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
            /* @__PURE__ */ g(p, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ D("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ D("span", { className: "reader-download-action-label", children: [
                Xm[c],
                " PDF"
              ] }),
              f ? /* @__PURE__ */ g("span", { className: "reader-download-action-reason", children: f }) : null
            ] })
          ]
        },
        c
      );
    }) })
  ] });
}
const Ym = "retainpdf:reader:bookmarks:v1:", Qm = 200;
function vr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Ya(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Ym}${t}` : "";
}
function eh(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function fn(e, t = vr()) {
  const n = Ya(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = eh(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function Vn(e, t, n) {
  const r = Ya(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, Qm);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function th(e, t, n = "", { storage: r = vr(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = fn(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? Vn(e, a.filter((i) => i.page !== s), r) : Vn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function nh(e, t, n = vr()) {
  return Vn(e, fn(e, n).filter((r) => r.page !== t), n);
}
function rh(e, t) {
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
function oh({ filled: e }) {
  return /* @__PURE__ */ g("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ g("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function ah({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = _(() => fn(e)), [i, c] = _(!1), l = N(null);
  if (C(() => {
    s(fn(e)), c(!1);
  }, [e]), C(() => {
    if (!i) return;
    const d = (p) => {
      l.current && !l.current.contains(p.target) && c(!1);
    }, f = (p) => {
      p.key === "Escape" && c(!1);
    };
    return document.addEventListener("pointerdown", d), document.addEventListener("keydown", f), () => {
      document.removeEventListener("pointerdown", d), document.removeEventListener("keydown", f);
    };
  }, [i]), !e || n <= 0) return null;
  const u = Math.min(Math.max(t, 1), n), m = a.some((d) => d.page === u);
  return /* @__PURE__ */ D("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: l, children: [
    /* @__PURE__ */ g(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${m ? " is-marked" : ""}`,
        "aria-pressed": m,
        "aria-label": m ? `取消第 ${u} 页的书签` : `给第 ${u} 页加书签`,
        title: m ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(th(e, u, rh(r, u))),
        children: /* @__PURE__ */ g(oh, { filled: m })
      }
    ),
    a.length ? /* @__PURE__ */ D(
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
          /* @__PURE__ */ g(Os, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ g("span", { className: "reader-bookmark-count", children: a.length })
        ]
      }
    ) : null,
    i && a.length ? /* @__PURE__ */ g("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ g("ol", { className: "reader-bookmark-list", children: a.map((d) => /* @__PURE__ */ D("li", { className: d.page === u ? "is-current" : "", children: [
      /* @__PURE__ */ D(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(d.page, n)), c(!1);
          },
          children: [
            /* @__PURE__ */ D("span", { className: "reader-bookmark-page", children: [
              "第 ",
              d.page,
              " 页"
            ] }),
            d.label ? /* @__PURE__ */ g("span", { className: "reader-bookmark-label", children: d.label }) : null
          ]
        }
      ),
      /* @__PURE__ */ g(
        "button",
        {
          type: "button",
          className: "reader-bookmark-remove",
          "aria-label": `删除第 ${d.page} 页的书签`,
          onClick: () => s(nh(e, d.page)),
          children: "×"
        }
      )
    ] }, d.page)) }) }) : null
  ] });
}
function sh(e) {
  const [t, n] = _([]);
  return C(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = qe().loadIssues;
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
function ih(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const ch = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, lh = ["failed", "content", "layout"];
function uh(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function dh({ jobId: e, currentPage: t }) {
  var m;
  const n = sh(e), r = (m = Je()) == null ? void 0 : m.jumpToBlock, [o, a] = _(!1), [s, i] = _(-1), c = N(null);
  C(() => i(-1), [n]);
  const l = (d) => {
    const f = n[d];
    !f || !r || (i(d), r(f.readerItemId));
  }, u = N({ issues: n, last: s, currentPage: t, goTo: l });
  return u.current = { issues: n, last: s, currentPage: t, goTo: l }, C(() => {
    const d = (f) => {
      if (f.key.toLowerCase() !== "n" || f.metaKey || f.ctrlKey || f.altKey || uh(f.target)) return;
      const { issues: p, last: h, currentPage: b, goTo: w } = u.current, v = ih(p, h, b, f.shiftKey);
      v < 0 || (f.preventDefault(), w(v));
    };
    return document.addEventListener("keydown", d), () => document.removeEventListener("keydown", d);
  }, []), C(() => {
    if (!o) return;
    const d = (f) => {
      var p;
      (p = c.current) != null && p.contains(f.target) || a(!1);
    };
    return document.addEventListener("pointerdown", d, !0), () => document.removeEventListener("pointerdown", d, !0);
  }, [o]), n.length ? /* @__PURE__ */ D("div", { className: "reader-react-hud-group reader-issues", ref: c, "aria-label": "待处理", children: [
    /* @__PURE__ */ D(
      Q,
      {
        className: "reader-react-hud-btn reader-issues-toggle",
        "aria-expanded": o,
        "aria-haspopup": "true",
        "aria-label": `待处理 ${n.length} 处`,
        title: "这次翻译里要人看一眼的段落（N 下一处，Shift+N 上一处）",
        onClick: () => a((d) => !d),
        children: [
          /* @__PURE__ */ g($s, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ g("span", { children: n.length })
        ]
      }
    ),
    o ? /* @__PURE__ */ D("div", { className: "reader-issues-popover", role: "dialog", "aria-label": "待处理", children: [
      /* @__PURE__ */ g("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
      lh.map((d) => {
        const f = n.map((p, h) => ({ issue: p, index: h })).filter(({ issue: p }) => p.kind === d);
        return f.length ? /* @__PURE__ */ D("section", { className: "reader-issues-group", "data-issue-kind": d, children: [
          /* @__PURE__ */ D("h4", { children: [
            ch[d],
            /* @__PURE__ */ g("span", { children: f.length })
          ] }),
          /* @__PURE__ */ g("ol", { children: f.map(({ issue: p, index: h }) => /* @__PURE__ */ g("li", { children: /* @__PURE__ */ D(
            Q,
            {
              className: "reader-issues-item",
              "aria-current": h === s ? "true" : void 0,
              onClick: () => {
                l(h), a(!1);
              },
              children: [
                /* @__PURE__ */ g("span", { className: "reader-issues-title", children: p.title }),
                /* @__PURE__ */ D("span", { className: "reader-issues-page", children: [
                  "第 ",
                  p.page,
                  " 页"
                ] }),
                p.detail ? /* @__PURE__ */ g("span", { className: "reader-issues-detail", children: p.detail }) : null
              ]
            }
          ) }, `${p.kind}:${p.readerItemId}`)) })
        ] }, d) : null;
      })
    ] }) : null
  ] }) : null;
}
const fh = 48, mh = 96, hh = 700;
function ph(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= fh, downSoFar: r };
}
function gh(e) {
  const [t, n] = _(!1), r = N(0);
  return C(() => {
    const o = /* @__PURE__ */ new WeakMap();
    let a = 0;
    const s = () => {
      a = Date.now();
    }, i = /* @__PURE__ */ new WeakMap(), c = () => {
      const d = e.current;
      return !!(d && (d.querySelector(":focus-visible") || d.querySelector("[aria-expanded='true']")));
    }, l = (d) => {
      const f = d.target;
      if (!(f instanceof Element) || (i.has(f) || i.set(f, !!f.querySelector(`[${Ie}]`)), !i.get(f))) return;
      const p = f.scrollTop, h = o.get(f);
      if (o.set(f, p), h === void 0 || Date.now() - a > hh) return;
      const b = ph(!1, r.current, p - h);
      r.current = b.downSoFar, p - h < -4 ? n(!1) : b.hidden && !c() && n(!0);
    }, u = (d) => {
      d.clientY >= window.innerHeight - mh && (r.current = 0, n(!1));
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
function bh(e) {
  const t = Je(), n = Ea(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Jt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = Qi(a), m = a > Yo + 1e-3, d = a < un - 1e-3, f = St(r, et()), p = f >= un ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", h = N(null), b = gh(h), [w, v] = _(!1), [y, S] = _(`${i}`);
  C(() => {
    w || S(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, w]);
  const k = () => {
    if (v(!1), !l || c <= 0)
      return;
    const E = Number(`${y}`.trim());
    l(dn(E, c));
  };
  return /* @__PURE__ */ D("div", { ref: h, className: "reader-react-hud", "data-reader-hud": "true", "data-hud-hidden": b ? "true" : void 0, children: [
    o ? /* @__PURE__ */ g("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ g("div", { className: "reader-react-hud-group", "aria-label": "页码", children: w ? /* @__PURE__ */ D(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (E) => {
          E.preventDefault(), k();
        },
        children: [
          /* @__PURE__ */ g(
            "input",
            {
              className: "reader-react-hud-page-input",
              type: "text",
              inputMode: "numeric",
              pattern: "[0-9]*",
              "aria-label": "跳转到页码",
              value: y,
              autoFocus: !0,
              onChange: (E) => S(E.target.value.replace(/[^\d]/g, "")),
              onBlur: k,
              onKeyDown: (E) => {
                E.key === "Escape" && (E.preventDefault(), v(!1), S(`${i}`));
              }
            }
          ),
          /* @__PURE__ */ D("span", { className: "reader-react-hud-page-suffix", children: [
            "/ ",
            c || "—"
          ] })
        ]
      }
    ) : /* @__PURE__ */ g(
      "button",
      {
        type: "button",
        className: "reader-react-hud-page reader-react-hud-page-btn",
        "aria-label": c > 0 ? `跳转页码，当前第 ${i} 页，共 ${c} 页` : "页码",
        title: c > 0 ? "点击输入页码跳转" : void 0,
        disabled: !l || c <= 0,
        onClick: () => {
          !l || c <= 0 || (S(`${i}`), v(!0));
        },
        children: c > 0 ? `${Math.min(i, c)} / ${c}` : "—"
      }
    ) }),
    e.searchSlot ? /* @__PURE__ */ g("div", { className: "reader-react-hud-group", "aria-label": "搜索", children: e.searchSlot }) : null,
    e.bookmarkScope ? /* @__PURE__ */ g(
      ah,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: c,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
      }
    ) : null,
    e.issuesJobId ? /* @__PURE__ */ g(dh, { jobId: e.issuesJobId, currentPage: i }) : null,
    t != null && t.toggleDocDark ? /* @__PURE__ */ g("div", { className: "reader-react-hud-group", "aria-label": "显示", children: /* @__PURE__ */ g(
      Q,
      {
        className: "reader-react-hud-btn reader-react-hud-doc-dark",
        "aria-pressed": t.docDark ? "true" : "false",
        "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
        title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
        onClick: t.toggleDocDark,
        children: /* @__PURE__ */ g(yh, {})
      }
    ) }) : null,
    /* @__PURE__ */ D("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ g(
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
      /* @__PURE__ */ D(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn reader-react-hud-zoom-label",
          "aria-label": `${u}%，点击${p}`,
          title: p,
          onClick: () => s(f),
          children: [
            u,
            "%"
          ]
        }
      ),
      /* @__PURE__ */ g(
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
    /* @__PURE__ */ g("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ g(Wm, {}) })
  ] });
}
function yh() {
  return /* @__PURE__ */ D("svg", { width: "14", height: "14", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: [
    /* @__PURE__ */ g("circle", { cx: "8", cy: "8", r: "6.25", fill: "none", stroke: "currentColor", strokeWidth: "1.5" }),
    /* @__PURE__ */ g("path", { d: "M8 1.75a6.25 6.25 0 0 1 0 12.5z", fill: "currentColor" })
  ] });
}
function Po(e) {
  var t, n;
  return ra(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function vh(e) {
  const [t, n] = _(() => ({
    scope: e,
    panel: Po(Oe(e))
  }));
  C(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Po(Oe(e))
    });
  }, [e]), C(() => {
    t.scope === e && pn(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = x((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const qn = "download-toast";
function wh({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ D("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ D("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ g("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ g("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ g("div", { className: "download-toast-track", children: /* @__PURE__ */ g("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ g("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function Sh(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    Nn.dismiss(qn);
    return;
  }
  Nn.custom(
    () => /* @__PURE__ */ g(wh, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: qn, duration: 1 / 0 }
  );
}
function kh() {
  const e = x((t) => {
    t && (t.setState = Sh, t.hide = () => Nn.dismiss(qn));
  }, []);
  return /* @__PURE__ */ D($e, { children: [
    /* @__PURE__ */ g(ks, { position: "bottom-right" }),
    /* @__PURE__ */ g("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
const Mo = { itemId: null, origin: null };
function Ih() {
  let e = Mo;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? Mo : { itemId: n, origin: r };
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
function Rh({
  nodes: e,
  currentPage: t,
  onJumpPage: n
}) {
  const r = V(() => ha(e, t), [e, t]), [o, a] = _(() => /* @__PURE__ */ new Set([...Fr(r), ...r ? [r] : []]));
  C(() => {
    a(/* @__PURE__ */ new Set([...Fr(r), ...r ? [r] : []]));
  }, [e]);
  const s = N(null);
  C(() => {
    var l, u;
    (u = (l = s.current) == null ? void 0 : l.querySelector('[aria-current="location"]')) == null || u.scrollIntoView({ block: "center" });
  }, [e]);
  const i = (l) => a((u) => {
    const m = new Set(u);
    return m.has(l) ? m.delete(l) : m.add(l), m;
  }), c = (l) => l.map((u) => {
    const m = o.has(u.id), d = u.children.length > 0;
    return /* @__PURE__ */ D("li", { className: "reader-bookmark", "data-level": u.level, children: [
      /* @__PURE__ */ D("div", { className: "reader-bookmark-row", children: [
        d ? /* @__PURE__ */ g(
          Q,
          {
            className: `reader-bookmark-toggle${m ? " is-open" : ""}`,
            "aria-label": m ? `收起「${u.title}」` : `展开「${u.title}」`,
            "aria-expanded": m,
            onClick: () => i(u.id),
            children: /* @__PURE__ */ g(Wo, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 })
          }
        ) : /* @__PURE__ */ g("span", { className: "reader-bookmark-spacer", "aria-hidden": "true" }),
        /* @__PURE__ */ D(
          Q,
          {
            className: "reader-finder-entry reader-bookmark-entry",
            "data-level": u.level,
            "aria-current": u.id === r ? "location" : void 0,
            disabled: u.page === null,
            title: u.page === null ? "这条书签没有指到页" : `${u.title} · 第 ${u.page} 页`,
            onClick: () => u.page !== null && n(u.page),
            children: [
              /* @__PURE__ */ g("span", { className: "reader-finder-entry-text", children: u.title }),
              u.page !== null ? /* @__PURE__ */ g("span", { className: "reader-finder-entry-page", children: u.page }) : null
            ]
          }
        )
      ] }),
      d && m ? /* @__PURE__ */ g("ol", { className: "reader-bookmark-children", children: c(u.children) }) : null
    ] }, u.id);
  });
  return /* @__PURE__ */ g("ol", { ref: s, className: "reader-finder-list reader-bookmark-tree", "aria-label": "书签", children: c(e) });
}
const Th = [], Eh = [];
function Ph({
  open: e,
  onToggle: t,
  children: n
}) {
  return /* @__PURE__ */ D("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ g(Q, { className: "reader-finder-toggle", "aria-label": "目录", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: /* @__PURE__ */ g(Fs, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }) }),
    n
  ] });
}
function Mh({ open: e, onToggle: t }) {
  return /* @__PURE__ */ g(
    Q,
    {
      className: "reader-react-hud-btn reader-search-toggle",
      "data-finder-toggle": "search",
      "aria-label": "在书里搜索",
      "aria-pressed": e === "search",
      title: "在书里搜索（原文和译文，⌘F）",
      onClick: () => t("search"),
      children: /* @__PURE__ */ g(zs, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 })
    }
  );
}
function _h({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0,
  bookmarks: c = Eh,
  onJumpPage: l
}) {
  var A, I;
  const u = ((A = Je()) == null ? void 0 : A.regions) ?? Th, m = ((I = Ea()) == null ? void 0 : I.currentPage) ?? 1, d = V(() => Wl(u), [u]), f = c.length > 0 && !!l, [p, h] = _("bookmarks"), b = f && (p === "bookmarks" || !d.length), w = Kl(d, m), v = V(() => Jl(u, s), [u, s]), [y, S] = _(-1);
  C(() => S(-1), [s]);
  const k = N(null), E = N(null), L = N(n);
  L.current = n, C(() => {
    const R = (T) => {
      var B, z;
      const M = T.target;
      !M || (B = E.current) != null && B.contains(M) || (z = M.closest) != null && z.call(M, ".reader-finder-toggles, [data-finder-toggle]") || L.current();
    }, P = (T) => {
      T.key === "Escape" && L.current();
    };
    return document.addEventListener("pointerdown", R, !0), document.addEventListener("keydown", P), () => {
      document.removeEventListener("pointerdown", R, !0), document.removeEventListener("keydown", P);
    };
  }, []);
  const $ = N(null);
  C(() => {
    var R, P, T;
    e === "search" ? (R = k.current) == null || R.focus() : (T = (P = $.current) == null ? void 0 : P.querySelector('[aria-current="location"]')) == null || T.scrollIntoView({ block: "center" });
  }, [e, i]), C(() => {
    var R, P;
    e === "search" && y >= 0 && ((P = (R = $.current) == null ? void 0 : R.querySelector('[aria-current="true"]')) == null || P.scrollIntoView({ block: "nearest" }));
  }, [e, y]);
  const O = (R) => {
    const P = v[R];
    P && (S(R), r(P.itemId));
  };
  return /* @__PURE__ */ D("aside", { ref: E, className: "reader-finder", "data-finder-tab": e, "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ D("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ D("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ g(Q, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ g(Q, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ g(Q, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ g(ft, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" && f && d.length ? /* @__PURE__ */ D("div", { className: "reader-finder-switch", role: "radiogroup", "aria-label": "目录按什么列", children: [
      /* @__PURE__ */ g(Q, { className: "reader-finder-switch-option", role: "radio", "aria-checked": b, onClick: () => h("bookmarks"), children: "按书签" }),
      /* @__PURE__ */ g(Q, { className: "reader-finder-switch-option", role: "radio", "aria-checked": !b, onClick: () => h("headings"), children: "按标题" })
    ] }) : null,
    e === "outline" && b && l ? /* @__PURE__ */ g(Rh, { nodes: c, currentPage: m, onJumpPage: l }) : e === "outline" ? d.length ? /* @__PURE__ */ g("ol", { ref: $, className: "reader-finder-list", children: d.map((R, P) => /* @__PURE__ */ g("li", { children: /* @__PURE__ */ D(
      Q,
      {
        className: "reader-finder-entry",
        "data-level": R.level,
        "aria-current": P === w ? "location" : void 0,
        onClick: () => r(R.itemId),
        children: [
          /* @__PURE__ */ g("span", { className: "reader-finder-entry-text", children: R.text }),
          /* @__PURE__ */ g("span", { className: "reader-finder-entry-page", children: R.page })
        ]
      }
    ) }, R.itemId)) }) : /* @__PURE__ */ g("p", { className: "reader-finder-empty", children: u.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ D($e, { children: [
      /* @__PURE__ */ D("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ g(
          Ko,
          {
            ref: k,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "原文、译文里的字",
            "aria-label": "在书里搜索",
            value: o,
            onChange: (R) => a(R.target.value),
            onKeyDown: (R) => {
              R.key === "Enter" ? (R.preventDefault(), O(Gl(y, v.length, R.shiftKey))) : R.key === "Escape" && (R.preventDefault(), n()), R.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ g("p", { className: "reader-finder-count", "aria-live": "polite", children: v.length === 0 ? "没有找到" : `${y >= 0 ? `第 ${y + 1} / ` : ""}${v.length >= 200 ? "200+ 处，只列前 200 处" : `${v.length} 处`}${y < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ g("ol", { className: "reader-finder-list", children: v.map((R, P) => /* @__PURE__ */ g("li", { children: /* @__PURE__ */ D(Q, { className: "reader-finder-entry is-hit", "aria-current": P === y ? "true" : void 0, onClick: () => O(P), children: [
        /* @__PURE__ */ D("span", { className: "reader-finder-entry-text", children: [
          R.snippet.slice(0, R.at),
          /* @__PURE__ */ g("mark", { children: R.snippet.slice(R.at, R.at + R.length) }),
          R.snippet.slice(R.at + R.length)
        ] }),
        /* @__PURE__ */ g("span", { className: "reader-finder-entry-page", children: R.page })
      ] }) }, R.itemId)) })
    ] })
  ] });
}
function Nh({
  active: e,
  ink: t,
  extensions: n = or
}) {
  const [r, o] = _(!1), [a, s] = _(null), i = Aa(), c = (f) => {
    var p;
    return ((p = i.find((h) => h.id === f)) == null ? void 0 : p.contribution.toolbarItems) ?? [];
  }, l = n.some(({ id: f }) => c(f).some((p) => p.pressed)), u = n.flatMap((f) => [...c(f.id).map((p) => p.label), ...(f.panels ?? []).map((p) => p.label)]), m = (() => {
    if (!a) return null;
    for (const { id: f } of n) {
      const p = c(f).find((h) => `${f}:${h.key}` === a);
      if (p != null && p.popup) return p.popup(() => {
        s(null), o(!1);
      });
    }
    return null;
  })(), d = N(null);
  return C(() => {
    if (!r && !a) return;
    const f = () => {
      o(!1), s(null);
    }, p = (b) => {
      var w;
      (w = d.current) != null && w.contains(b.target) || f();
    }, h = (b) => {
      b.key === "Escape" && f();
    };
    return document.addEventListener("pointerdown", p, !0), document.addEventListener("keydown", h), () => {
      document.removeEventListener("pointerdown", p, !0), document.removeEventListener("keydown", h);
    };
  }, [r, a]), /* @__PURE__ */ D("div", { className: "reader-toolball", ref: d, "data-open": r ? "true" : void 0, children: [
    m,
    r ? /* @__PURE__ */ D("div", { className: "reader-toolball-stack", role: "group", "aria-label": "工具", children: [
      t ? /* @__PURE__ */ g(
        Q,
        {
          className: "reader-toolball-item",
          "aria-label": "画笔",
          title: "画笔（P；书页上右键也能选笔和颜色）",
          "aria-pressed": !!t.tool,
          "data-toolball-item": "ink",
          onClick: () => {
            t.setTool(t.tool ? null : "pen"), o(!1);
          },
          children: /* @__PURE__ */ g(Gn, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null,
      n.map((f) => {
        const p = ar([f]);
        return /* @__PURE__ */ D(xo, { children: [
          c(f.id).map((h) => {
            const b = `${f.id}:${h.key}`, w = h.Icon;
            return /* @__PURE__ */ g(
              Q,
              {
                className: "reader-toolball-item",
                "aria-label": h.label,
                title: h.title || h.label,
                "aria-pressed": !!h.pressed || a === b,
                "data-toolball-item": h.key,
                onClick: () => {
                  var v;
                  if (h.popup) {
                    s((y) => y === b ? null : b);
                    return;
                  }
                  (v = h.onClick) == null || v.call(h), o(!1);
                },
                children: /* @__PURE__ */ g(w, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
              },
              b
            );
          }),
          p.length ? /* @__PURE__ */ g(Qf, { active: e, tabs: p }) : null
        ] }, f.id);
      })
    ] }) : null,
    /* @__PURE__ */ g(
      Q,
      {
        className: "reader-toolball-ball",
        "aria-label": r ? "收起工具" : `工具：${[...t ? ["画笔"] : [], ...u].join("、")}`,
        title: r ? "收起" : "工具",
        "aria-expanded": r,
        "data-active": e || l ? "true" : void 0,
        onClick: () => {
          o((f) => !f), s(null);
        },
        children: r ? /* @__PURE__ */ g(ft, { size: 20, strokeWidth: 2.2, "aria-hidden": !0 }) : /* @__PURE__ */ g(Bs, { size: 20, strokeWidth: 2.1, "aria-hidden": !0 })
      }
    )
  ] });
}
const Ah = [
  { tool: "pen", label: "画笔", Icon: Gn },
  { tool: "highlighter", label: "荧光笔", Icon: js },
  { tool: "eraser", label: "橡皮", Icon: Hs }
];
function Qa(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function es({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ D($e, { children: [
    Ah.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ g(
      Q,
      {
        className: "reader-ink-tool",
        "aria-label": a,
        title: a,
        "aria-pressed": e.tool === o,
        "data-ink-tool": o,
        onClick: () => {
          e.setTool(e.tool === o ? null : o), r();
        },
        children: /* @__PURE__ */ g(s, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      },
      o
    )),
    /* @__PURE__ */ g("span", { className: "reader-ink-sep", "aria-hidden": !0 }),
    Sa.map((o) => /* @__PURE__ */ g(
      Q,
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
        children: /* @__PURE__ */ g("span", { "aria-hidden": !0 })
      },
      o.key
    )),
    /* @__PURE__ */ g("span", { className: "reader-ink-sep", "aria-hidden": !0 }),
    /* @__PURE__ */ g(Q, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ g(Us, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ g(
      Q,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ g(Ws, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null,
    e.tool ? /* @__PURE__ */ g(
      Q,
      {
        className: "reader-ink-tool",
        "aria-label": "退出画笔",
        title: "退出画笔（Esc）",
        "data-ink-exit": "true",
        onClick: () => {
          e.setTool(null), r();
        },
        children: /* @__PURE__ */ g(ft, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function Lh({
  ink: e,
  menu: t,
  onClose: n,
  actions: r = []
}) {
  const o = N(null);
  if (C(() => {
    if (!t) return;
    const c = (u) => {
      var m;
      (m = o.current) != null && m.contains(u.target) || n();
    }, l = (u) => {
      u.key === "Escape" && n();
    };
    return document.addEventListener("pointerdown", c, !0), document.addEventListener("keydown", l), () => {
      document.removeEventListener("pointerdown", c, !0), document.removeEventListener("keydown", l);
    };
  }, [t, n]), !t) return null;
  const a = 380, s = Math.max(8, Math.min(t.x, (globalThis.innerWidth || a) - a - 8)), i = Math.max(68, Math.min(t.y, (globalThis.innerHeight || 600) - 60 - (r.length ? 40 : 0)));
  return /* @__PURE__ */ D("div", { ref: o, className: "reader-ink-menu", style: { left: s, top: i }, "data-ink-menu": "true", children: [
    r.length ? /* @__PURE__ */ g("div", { className: "reader-ink-menu-actions", role: "menu", "aria-label": "书页", children: r.map((c) => /* @__PURE__ */ D(
      Q,
      {
        className: "reader-ink-menu-action",
        role: "menuitem",
        title: c.hint,
        onClick: () => {
          c.onSelect(), n();
        },
        children: [
          c.label,
          c.hint ? /* @__PURE__ */ g("kbd", { children: c.hint }) : null
        ]
      },
      c.key
    )) }) : null,
    /* @__PURE__ */ g("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ g(es, { ink: e, page: t.page, onPick: n }) })
  ] });
}
function xh({ ink: e }) {
  return e.tool ? /* @__PURE__ */ g("div", { className: "reader-ink-bar is-dock", role: "toolbar", "aria-label": "画笔", "data-ink-dock": "true", children: /* @__PURE__ */ g(es, { ink: e }) }) : null;
}
function Dh(e) {
  var r;
  if (e.shiftKey || Qa(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${Xo}`))) return null;
  const n = Number((r = t.closest(`[${Ie}]`)) == null ? void 0 : r.getAttribute(Ie)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Ch(e) {
  const t = N(e);
  t.current = e, C(() => {
    const n = (r) => {
      if (Qa(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
function Oh({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ g("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ D("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
    /* @__PURE__ */ g("span", { children: n.phase === "failed" ? n.message : `改了 ${t} 处，还没排进 PDF` }),
    t ? /* @__PURE__ */ g(
      Q,
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
const ts = "retainpdf:reader:doc-theme:v1", _o = "data-reader-doc";
function ns() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function $h(e = ns()) {
  try {
    return (e == null ? void 0 : e.getItem(ts)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function zh(e, t = ns()) {
  try {
    t == null || t.setItem(ts, e);
  } catch {
  }
}
function No(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(_o, "dark") : t.removeAttribute(_o));
}
function Fh() {
  const [e, t] = _(() => $h());
  C(() => {
    No(e);
  }, [e]), C(() => () => No("light"), []);
  const n = x(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return zh(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
const Bh = 250;
function jh(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function Hh(e, t, n) {
  const r = n === "back" ? e.back : e.forward;
  if (!r.length) return null;
  const o = r[r.length - 1], a = r.slice(0, -1), s = n === "back" ? { back: a, forward: [...e.forward, t] } : { back: [...e.back, t], forward: a };
  return { to: o, history: s };
}
function Uh(e) {
  var n;
  const t = e;
  return !!((n = t == null ? void 0 : t.closest) != null && n.call(t, "input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
function Wh({
  shellEl: e,
  index: t,
  primaryPane: n,
  follow: r
}) {
  const [o, a] = _(null), [s, i] = _({ back: [], forward: [] }), c = N(s);
  c.current = s;
  const l = N(null), u = N({ index: t, primaryPane: n, follow: r, shellEl: e });
  u.current = { index: t, primaryPane: n, follow: r, shellEl: e };
  const m = x(() => {
    const { shellEl: f, primaryPane: p } = u.current;
    return zt(f, p);
  }, []);
  C(() => {
    if (!e) return;
    const f = (y) => {
      var S, k;
      return (k = (S = y.target) == null ? void 0 : S.closest) == null ? void 0 : k.call(S, `.${pa}`);
    }, p = () => {
      l.current != null && window.clearTimeout(l.current), l.current = null;
    }, h = (y) => {
      var L;
      const S = f(y);
      if (!S) return;
      const k = u.current.index.get(S.getAttribute(zn) || "");
      if (!k) return;
      const E = ((L = S.closest("[data-reader-pane]")) == null ? void 0 : L.getAttribute("data-reader-pane")) || u.current.primaryPane;
      p(), l.current = window.setTimeout(() => {
        const $ = S.getBoundingClientRect();
        a({ target: k, pane: E, anchor: { left: $.left, top: $.top, right: $.right, bottom: $.bottom } });
      }, Bh);
    }, b = (y) => {
      const S = f(y);
      !S || S.contains(y.relatedTarget) || (p(), a(null));
    }, w = (y) => {
      var $, O;
      const S = f(y);
      if (!S || y.button !== 0 || y.metaKey || y.ctrlKey || y.shiftKey || `${(($ = window.getSelection) == null ? void 0 : $.call(window)) || ""}`.trim()) return;
      const k = u.current.index.get(S.getAttribute(zn) || "");
      if (!k) return;
      y.preventDefault(), y.stopPropagation(), p(), a(null);
      const E = ((O = S.closest("[data-reader-pane]")) == null ? void 0 : O.getAttribute("data-reader-pane")) || u.current.primaryPane, L = m();
      L && i((A) => jh(A, L)), u.current.follow(k, E);
    }, v = () => {
      p(), a(null);
    };
    return e.addEventListener("pointerover", h), e.addEventListener("pointerout", b), e.addEventListener("click", w, !0), e.addEventListener("scroll", v, { passive: !0 }), () => {
      p(), e.removeEventListener("pointerover", h), e.removeEventListener("pointerout", b), e.removeEventListener("click", w, !0), e.removeEventListener("scroll", v);
    };
  }, [e, m]);
  const d = x((f) => {
    const p = m();
    if (!p) return !1;
    const h = Hh(c.current, p, f);
    if (!h) return !1;
    const { shellEl: b, primaryPane: w } = u.current;
    return Et(b, h.to, "auto", w) ? (i(h.history), !0) : !1;
  }, [m]);
  return C(() => {
    const f = (p) => {
      if (!p.altKey || p.metaKey || p.ctrlKey || p.shiftKey || p.defaultPrevented || p.key !== "ArrowLeft" && p.key !== "ArrowRight" || Uh(p.target)) return;
      d(p.key === "ArrowLeft" ? "back" : "forward") && p.preventDefault();
    };
    return window.addEventListener("keydown", f), () => window.removeEventListener("keydown", f);
  }, [d]), {
    preview: o,
    closePreview: x(() => a(null), []),
    canGoBack: s.back.length > 0,
    backPage: s.back.length ? s.back[s.back.length - 1].page : null,
    goBack: x(() => d("back"), [d])
  };
}
function Kh({ state: e, bookmarks: t }) {
  const { finder: n, setFinder: r, toggleFinder: o, findQuery: a, setFindQuery: s, findTerm: i, findFocus: c, jumpFromFinder: l, jumpToPageFromFinder: u } = e;
  return /* @__PURE__ */ D($e, { children: [
    /* @__PURE__ */ g(Ph, { open: n, onToggle: o }),
    n ? /* @__PURE__ */ g(
      _h,
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
const Ao = 6e3;
function rs(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function Vh(e, t, n, r) {
  const o = e.width * t.width, a = e.height * t.height;
  let s = n * r / Math.max(1, o);
  const i = Math.max(o, a) * s;
  return i > Ao && (s *= Ao / i), {
    scale: s,
    offsetX: -e.left * t.width * s,
    offsetY: -e.top * t.height * s,
    canvasWidth: Math.max(1, Math.round(o * s)),
    canvasHeight: Math.max(1, Math.round(a * s)),
    /** 显示高度（CSS 像素），按区域的宽高比。 */
    cssHeight: Math.round(n * (a / Math.max(1, o)))
  };
}
function os({
  pdf: e,
  page: t,
  region: n,
  cssWidth: r,
  className: o,
  label: a
}) {
  const s = N(null), [i, c] = _({ status: "loading", cssHeight: 0 }), l = `${t}:${n.left}:${n.top}:${n.width}:${n.height}:${Math.round(r)}`;
  return C(() => {
    let u = !1, m = null;
    return c((d) => ({ status: "loading", cssHeight: d.cssHeight })), (async () => {
      try {
        const d = await e.getPage(t);
        if (u) return;
        const f = d.getViewport({ scale: 1 }), p = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), h = Vh(n, f, r, p), b = s.current, w = b == null ? void 0 : b.getContext("2d");
        if (!b || !w) return;
        b.width = h.canvasWidth, b.height = h.canvasHeight, c({ status: "loading", cssHeight: h.cssHeight });
        const v = d.getViewport({ scale: h.scale, offsetX: h.offsetX, offsetY: h.offsetY }), y = d.render({ canvasContext: w, viewport: v });
        m = y, await y.promise, u || c({ status: "ready", cssHeight: h.cssHeight });
      } catch (d) {
        !u && (d == null ? void 0 : d.name) !== "RenderingCancelledException" && c((f) => ({ status: "error", cssHeight: f.cssHeight }));
      }
    })(), () => {
      u = !0, m == null || m.cancel();
    };
  }, [e, l]), /* @__PURE__ */ D(
    "div",
    {
      className: `reader-region-canvas${o ? ` ${o}` : ""}`,
      "data-status": i.status,
      style: { width: r, height: i.cssHeight || void 0 },
      children: [
        /* @__PURE__ */ g("canvas", { ref: s, role: "img", "aria-label": a ?? `第 ${t} 页的一块`, style: { width: r, height: i.cssHeight || void 0 } }),
        i.status === "error" ? /* @__PURE__ */ g("p", { className: "reader-region-canvas-error", children: "这一块没画出来。" }) : null
      ]
    }
  );
}
const Lo = { figure: "图", table: "表", formula: "公式", text: "文字" }, Xe = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function qh(e, t, n) {
  const r = Tt(e, t, n), o = r ? dt(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = rs({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function Jh(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, c = null;
  for (const u of e) {
    const m = Tt(u, t, n), d = m ? dt(m, 1, 1) : null;
    !m || !d || (r || (r = m.box.page, c = m.pageSize), m.box.page === r && (o = Math.min(o, d.left), a = Math.min(a, d.top), s = Math.max(s, d.left + d.width), i = Math.max(i, d.top + d.height)));
  }
  if (!r || !c) return null;
  const l = rs({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: l, aspect: l.height * c.height / Math.max(1e-6, l.width * c.width) };
}
function Gh(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function Xh(e, t) {
  const n = (o) => {
    const a = _e(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function Zh({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var O;
  const i = t.find((A) => A.itemId === e) ?? null, c = V(() => i ? Xh(t, i) : [], [t, i]), l = i ? c.indexOf(i) : -1, [u, m] = _(Xe.indexOf(1)), d = Xe[u], f = N(null), [p, h] = _(0);
  Te(() => {
    const A = f.current;
    if (!A) return;
    const I = () => h(A.clientWidth);
    I();
    const R = typeof ResizeObserver == "function" ? new ResizeObserver(I) : null;
    return R == null || R.observe(A), () => R == null ? void 0 : R.disconnect();
  }, []);
  const b = x((A) => {
    const I = c[l + A];
    I && a(I.itemId);
  }, [c, l, a]);
  C(() => {
    const A = (I) => {
      if (I.key === "Escape")
        I.preventDefault(), s();
      else if (I.key === "ArrowLeft")
        I.preventDefault(), b(-1);
      else if (I.key === "ArrowRight")
        I.preventDefault(), b(1);
      else if (I.key === "+" || I.key === "=")
        I.preventDefault(), m((R) => Math.min(Xe.length - 1, R + 1));
      else if (I.key === "-" || I.key === "_")
        I.preventDefault(), m((R) => Math.max(0, R - 1));
      else if (I.key === "0")
        I.preventDefault(), m(Xe.indexOf(1));
      else
        return;
      I.stopPropagation();
    };
    return window.addEventListener("keydown", A, !0), () => window.removeEventListener("keydown", A, !0);
  }, [s, b]), C(() => {
    const A = f.current;
    if (!A) return;
    const I = (R) => {
      !R.ctrlKey && !R.metaKey || (R.preventDefault(), m((P) => Math.max(0, Math.min(Xe.length - 1, P + (R.deltaY < 0 ? 1 : -1)))));
    };
    return A.addEventListener("wheel", I, { passive: !1 }), () => A.removeEventListener("wheel", I);
  }, []);
  const w = N(null);
  if (!i) return null;
  const v = _e(i), y = o.map((A) => ({ pane: A, pdf: r[A] ?? null, where: qh(i, n, A) })).filter((A) => !!(A.pdf && A.where)), S = 16, k = typeof window > "u" ? 800 : window.innerHeight, E = Math.min(880, k * 0.9) - 56 - 32 - (y.length > 1 ? 26 : 0), L = y.length ? Gh(Math.max(120, (p - S * (y.length - 1) - 32) / y.length), E, y.map((A) => A.where.aspect)) : 0, $ = ((O = y[0]) == null ? void 0 : O.where.page) ?? i.source.page;
  return /* @__PURE__ */ D("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${Lo[v] ?? "这一块"}`, children: [
    /* @__PURE__ */ g("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ D("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ D("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ D("span", { className: "reader-zoom-title", children: [
          Lo[v] ?? "这一块",
          " · 第 ",
          $,
          " 页"
        ] }),
        /* @__PURE__ */ g("span", { className: "reader-zoom-count", children: l >= 0 ? `${l + 1} / ${c.length}` : "" }),
        /* @__PURE__ */ D("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ g(at, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: l <= 0, onClick: () => b(-1), children: /* @__PURE__ */ g(Ks, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ g(at, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: l < 0 || l >= c.length - 1, onClick: () => b(1), children: /* @__PURE__ */ g(Wo, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ g(at, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => m((A) => Math.max(0, A - 1)), children: /* @__PURE__ */ g(Vs, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ D(Q, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => m(Xe.indexOf(1)), children: [
            Math.round(d * 100),
            "%"
          ] }),
          /* @__PURE__ */ g(at, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === Xe.length - 1, onClick: () => m((A) => Math.min(Xe.length - 1, A + 1)), children: /* @__PURE__ */ g(qs, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ g(at, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: s, children: /* @__PURE__ */ g(ft, { size: 16, "aria-hidden": !0 }) })
        ] })
      ] }),
      /* @__PURE__ */ g(
        "div",
        {
          ref: f,
          className: "reader-zoom-body",
          onPointerDown: (A) => {
            const I = f.current;
            !I || A.button !== 0 || (w.current = { x: A.clientX, y: A.clientY, left: I.scrollLeft, top: I.scrollTop }, I.setPointerCapture(A.pointerId));
          },
          onPointerMove: (A) => {
            const I = f.current, R = w.current;
            !I || !R || (I.scrollLeft = R.left - (A.clientX - R.x), I.scrollTop = R.top - (A.clientY - R.y));
          },
          onPointerUp: () => {
            w.current = null;
          },
          children: y.length && p ? /* @__PURE__ */ g("div", { className: "reader-zoom-columns", style: { gap: S }, children: y.map(({ pane: A, pdf: I, where: R }) => /* @__PURE__ */ D("figure", { className: "reader-zoom-column", children: [
            y.length > 1 ? /* @__PURE__ */ g("figcaption", { children: A === "source" ? "原文" : "译文" }) : null,
            /* @__PURE__ */ g(
              os,
              {
                className: "reader-zoom-canvas",
                pdf: I,
                page: R.page,
                region: R.fraction,
                cssWidth: L * d,
                label: `${A === "source" ? "原文" : "译文"}第 ${R.page} 页`
              }
            )
          ] }, A)) }) : /* @__PURE__ */ g("p", { className: "reader-zoom-empty", children: p ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
const Yh = 380, Qh = 320, wt = 8;
function ep(e, t, n) {
  const r = Math.max(wt, Math.min(e.left, n.width - t.width - wt)), o = e.bottom + wt, a = o + t.height <= n.height - wt ? o : Math.max(wt, e.top - wt - t.height);
  return { left: r, top: a };
}
function tp({
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
    const f = r[d], p = f ? Jh(o, n, d) : null;
    if (f && p) {
      s = { pdf: f, where: p };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min(Yh, Qh / Math.max(0.05, s.where.aspect))), c = Math.round(i * s.where.aspect) + 30, l = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: m } = ep(e.anchor, { width: Math.max(i, 160) + 16, height: c + 16 }, l);
  return /* @__PURE__ */ D("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: m }, children: [
    /* @__PURE__ */ D("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ g("span", { children: Ur(e.target) }),
      /* @__PURE__ */ D("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ g(os, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: Ur(e.target) })
  ] });
}
function np({
  session: e,
  xrefs: t,
  zoomDocuments: n,
  zoomItem: r,
  setZoomItem: o,
  closeZoom: a,
  visiblePdfMode: s
}) {
  return /* @__PURE__ */ D($e, { children: [
    t.preview ? /* @__PURE__ */ g(tp, { preview: t.preview, regions: e.regions, metadata: e.readerMetadata, documents: n }) : null,
    t.canGoBack ? /* @__PURE__ */ D(Q, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => t.goBack(), children: [
      /* @__PURE__ */ g(Js, { size: 14, "aria-hidden": !0 }),
      " 回到第 ",
      t.backPage,
      " 页"
    ] }) : null,
    r ? /* @__PURE__ */ g(
      Zh,
      {
        itemId: r,
        regions: e.regions,
        metadata: e.readerMetadata,
        documents: n,
        panes: s === "compare" ? ["source", "translated"] : s === "translated" ? ["translated"] : ["source"],
        onNavigate: o,
        onClose: a
      }
    ) : null
  ] });
}
function rp(e) {
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
function op(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function ap(e, t) {
  const { sessionFiles: n } = e, [r, o] = _(!1), a = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, s = rp({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: n.translatedUrl,
    overlayContentAvailable: a,
    liveTranslationVisible: r,
    assistantOpen: t
  }), i = ol({
    hasOverlayContent: a,
    connection: e.liveTranslation.connection,
    showSource: s.showSource,
    liveTranslationVisible: r,
    assistantOpen: t
  }), c = s.sourceViewOnly, l = s.visibleMode;
  C(() => {
    o(!1);
  }, [e.viewStateKey]), C(() => {
    e.session.jobTerminal && o(!1);
  }, [e.session.jobTerminal]);
  const u = N(null);
  return C(() => {
    u.current !== e.viewStateKey && il({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: c,
      jobTerminal: e.session.jobTerminal
    }) && (u.current = e.viewStateKey, o(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, c]), { liveTranslationVisible: r, setLiveTranslationVisible: o, paneComposition: s, liveToggles: i, sourceViewOnly: c, visiblePdfMode: l };
}
function sp(e, { liveTranslationVisible: t, setLiveTranslationVisible: n, liveToggles: r, sourceViewOnly: o, visiblePdfMode: a }) {
  const s = al(e.liveTranslation), i = x(() => {
    s && e.goToPage(s, "source");
  }, [e.goToPage, s]), [c, l] = _(null);
  C(() => {
    a === "compare" && e.session.jobTerminal && l(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, a]);
  const u = c !== e.viewStateKey && cl({
    state: e.liveTranslation,
    sourceViewOnly: o,
    visibleMode: a
  }), m = V(() => r.sourcePaneToggle ? /* @__PURE__ */ g(
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
function ip() {
  try {
    return qe().translationEdit ?? null;
  } catch {
    return null;
  }
}
const cp = "这本书正在处理（翻译或排版），处理完才能改。", lp = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function up({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = ip(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = cu(s), l = !t || Bt(t), u = hu(n), [m, d] = _(""), [f, p] = _(null), [h, b] = _(() => /* @__PURE__ */ new Map()), [w, v] = _(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [y, S] = _(() => /* @__PURE__ */ new Map()), [k, E] = _({ phase: "idle" }), L = N({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  C(() => {
    p(null), L.drafts.clear(), L.generation.current = null, S(/* @__PURE__ */ new Map()), E({ phase: "idle" });
  }, [s]), C(() => {
    if (d(""), !i || c || !a) return;
    let M = !1;
    return a.resolveOwnerJobId(s).then((B) => {
      M || d(`${B || s}`.trim() || s);
    }).catch(() => {
      M || d(s);
    }), () => {
      M = !0;
    };
  }, [i, c, a, s]), C(() => {
    if (b(/* @__PURE__ */ new Map()), !a || !m || !u || !l) return;
    let M = !1;
    return a.fetchRevisions(m).then((B) => {
      M || b(pu(B, u));
    }).catch(() => {
    }), () => {
      M = !0;
    };
  }, [a, m, u, l]);
  const $ = k.phase === "running" && k.seenActive;
  C(() => {
    if (k.phase === "running") {
      if (!l) {
        $ || E({ phase: "running", seenActive: !0 });
        return;
      }
      $ && E(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [k.phase, $, l, t]);
  const O = V(() => {
    const M = new Map(h);
    if (w.renderedAt === u)
      for (const [B, z] of w.edits) M.set(B, z);
    return M;
  }, [h, w, u]), A = x((M) => {
    const B = `${M || ""}`.trim();
    B && p({ itemId: B, page: lu(B) });
  }, []), I = x(() => p(null), []), R = x((M, B) => {
    v((z) => {
      const G = new Map(z.renderedAt === u ? z.edits : []);
      return G.set(M, B), { renderedAt: u, edits: G };
    }), S((z) => new Map(z).set(M, (z.get(M) || 0) + 1));
  }, [u]), P = x(async () => {
    if (!(!a || !s || k.phase === "submitting" || k.phase === "running")) {
      E({ phase: "submitting" });
      try {
        await a.rerender(s), E({ phase: "running", seenActive: !1 }), await o();
      } catch (M) {
        E({ phase: "failed", message: (M == null ? void 0 : M.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, k.phase, o]), T = c ? lp : !l || k.phase === "running" || k.phase === "submitting" ? cp : "";
  return V(() => ({
    available: i,
    blockedReason: T,
    port: a,
    ownerJobId: m,
    target: f,
    select: A,
    close: I,
    memory: L,
    pendingEdits: O,
    savedCounts: y,
    markSaved: R,
    rerender: k,
    startRerender: P
  }), [i, T, a, m, f, A, I, L, O, y, R, k, P]);
}
function dp(e, t) {
  C(() => {
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
function fp(e, t, n) {
  const { session: r, sessionFiles: o } = e, a = up({
    jobId: r.jobId,
    jobStatus: r.jobStatus,
    jobPayload: r.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!o.translatedUrl,
    refreshJobStatus: r.refreshJobStatus
  }), s = a.select, i = e.setModeKeepingPage, c = r.regions, l = x((m) => {
    vu(c, m) && (t === "source" && i("compare"), s(m));
  }, [c, s, t, i]);
  dp(a.available ? l : null, n);
  const u = V(() => {
    if (!a.savedCounts.size) return e.revisedBlocks;
    const m = new Map(e.revisedBlocks);
    for (const [d, f] of a.savedCounts) m.set(d, (m.get(d) || 0) + f);
    return m;
  }, [e.revisedBlocks, a.savedCounts]);
  return { blockEdit: a, editBlock: l, revisedBlocks: u };
}
const mp = "reader-finder-input";
function hp(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function pp(e, t = typeof window > "u" ? null : window) {
  C(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!hp(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(mp) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function gp(e) {
  const [t, n] = _(null), r = x((f) => n((p) => p === f ? null : f), []), [o, a] = _(""), [s, i] = _("");
  C(() => {
    const f = o.replace(/\s+/gu, " ").trim(), p = window.setTimeout(() => i(f), f ? 150 : 0);
    return () => window.clearTimeout(p);
  }, [o]);
  const [c, l] = _(0), u = x(() => {
    n("search"), l((f) => f + 1);
  }, []);
  pp(u);
  const m = x((f) => {
    e.jumpToAnchor({ block_id: f }), (t === "outline" || et() < 900) && n(null);
  }, [e.jumpToAnchor, t]), d = x((f) => {
    e.goToPage(f), (t === "outline" || et() < 900) && n(null);
  }, [e.goToPage, t]);
  return { finder: t, setFinder: n, toggleFinder: r, findQuery: o, setFindQuery: a, findTerm: s, findFocus: c, jumpFromFinder: m, jumpToPageFromFinder: d };
}
function bp(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : ea(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function yp(e, t) {
  return t === null || e !== t;
}
function vp(e, t) {
  const { boot: n } = e, r = N(null), o = N(null);
  C(() => {
    if (!(n.loading || n.failed)) {
      if (r.current !== e.viewStateKey) {
        r.current = e.viewStateKey;
        const a = Oe(e.viewStateKey), s = bp({
          savedMode: a == null ? void 0 : a.mode,
          sourceViewOnly: t,
          viewportWidth: et()
        });
        o.current = s.auto ? s.mode : null, s.mode && s.mode !== e.mode && e.setModeKeepingPage(s.mode);
        return;
      }
      yp(e.mode, o.current) && (o.current = null, pn(e.viewStateKey, { mode: e.mode }));
    }
  }, [n.failed, n.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, t]);
}
const wp = [];
function Sp(e) {
  const { sessionFiles: t } = e, [n, r] = _({}), o = N({ source: t.sourceUrl, translated: t.translatedUrl });
  o.current = { source: t.sourceUrl, translated: t.translatedUrl };
  const a = x((b, w) => {
    r((v) => ({ ...v, [w]: { url: o.current[w], nodes: b } }));
  }, []), s = V(() => {
    const b = n.source;
    if (b && b.url === t.sourceUrl && b.nodes.length) return b.nodes;
    const w = n.translated;
    return w && w.url === t.translatedUrl && w.nodes.length ? w.nodes : wp;
  }, [n, t.sourceUrl, t.translatedUrl]), i = N({}), [c, l] = _(0), u = x((b, w) => {
    i.current[w] = { url: o.current[w], pdf: b }, l((v) => v + 1);
  }, []), [m, d] = _(null), f = x((b) => d(b), []), p = x(() => d(null), []);
  C(() => d(null), [e.viewStateKey]);
  const h = V(() => {
    const b = (w, v) => {
      const y = i.current[w];
      return y && y.url === v ? y.pdf : null;
    };
    return { source: b("source", t.sourceUrl), translated: b("translated", t.translatedUrl) };
  }, [c, t.sourceUrl, t.translatedUrl]);
  return { bookmarks: s, onPdfOutline: a, onPdfDocument: u, zoomItem: m, setZoomItem: d, zoomBlock: f, closeZoom: p, zoomDocuments: h };
}
function kp() {
  const e = bl(), { boot: t, panes: n, session: r } = e, o = vh(e.viewStateKey), a = o.panel, s = o.setPanel, i = a !== null, { liveTranslationVisible: c, setLiveTranslationVisible: l, paneComposition: u, liveToggles: m, sourceViewOnly: d, visiblePdfMode: f } = ap(e, i);
  vp(e, d);
  const p = a || (e.mode === "compare" ? "compare" : "reading"), { docDark: h, toggleDocDark: b } = Fh();
  Rl({
    toggleDocDark: b,
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
  const w = x(() => {
    s(null);
  }, []), { latestLivePage: v, jumpToLatestLivePage: y, offerCompletion: S, setCompletionDismissedKey: k, sourcePaneAction: E } = sp(e, {
    liveTranslationVisible: c,
    setLiveTranslationVisible: l,
    liveToggles: m,
    sourceViewOnly: d,
    visiblePdfMode: f
  }), L = x((fe) => {
    const Se = op(fe, e.liveTranslationAvailable);
    Se !== null && l(Se), e.setModeKeepingPage(fe);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), $ = x((fe) => {
    s(fe);
  }, []), [O] = _(Ih), A = gp(e), { finder: I, toggleFinder: R, findTerm: P } = A, T = x((fe) => e.jumpToAnchor({ block_id: fe }), [e.jumpToAnchor]), { bookmarks: M, onPdfOutline: B, onPdfDocument: z, zoomItem: G, setZoomItem: J, zoomBlock: ne, closeZoom: oe, zoomDocuments: j } = Sp(e), U = V(() => nu(r.regions), [r.regions]), W = x(
    (fe, Se) => e.jumpToAnchor({ block_id: fe.itemId }, Se),
    [e.jumpToAnchor]
  ), pe = Wh({ shellEl: e.shell.shellEl, index: U, primaryPane: e.panes.primaryPane, follow: W }), { blockEdit: q, editBlock: K, revisedBlocks: ie } = fp(e, f, O), ue = ld(e.viewStateKey);
  Ch(ue);
  const [ae, he] = _(null), Re = x(() => he(null), []), ze = jf({ documentId: r.documentId, jobId: r.jobId }), Le = V(() => ({
    documentId: r.documentId || "",
    jobId: r.jobId,
    versionId: ze.readingVersionId || null,
    translationVersions: ze.versions,
    regions: r.regions,
    metadata: r.readerMetadata,
    bookmarks: M,
    pageCount: n.hudNumPages || 0,
    resetKey: e.viewStateKey,
    hoveredItemId: () => O.get().itemId,
    goToPage: e.goToPage,
    sourceOnly: e.sourceOnly,
    activePanel: a,
    closePanel: w,
    visibleMode: f,
    setWorkspace: L
  }), [
    r.documentId,
    r.jobId,
    ze,
    r.regions,
    r.readerMetadata,
    M,
    n.hudNumPages,
    e.viewStateKey,
    O,
    e.goToPage,
    e.sourceOnly,
    a,
    w,
    f,
    L
  ]), [se] = _(tf), ce = lf(se), be = V(() => rf(ce), [ce]), H = V(() => of(ce), [ce]), [ee, re] = _([]), Ne = V(() => ({
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
    regionHover: O,
    jumpToBlock: T,
    revisedBlocks: ie,
    onPdfOutline: B,
    onPdfDocument: z,
    zoomBlock: ne,
    xrefIndex: U,
    pageLayers: be,
    editBlock: q.available ? K : void 0,
    blockEdit: q,
    editShowsSource: f !== "compare",
    findTerm: I === "search" ? P : "",
    compareVersion: H,
    ink: ue,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: d,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: $, close: w },
    docDark: h,
    toggleDocDark: b
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
    O,
    T,
    ie,
    B,
    z,
    ne,
    U,
    be,
    q,
    K,
    f,
    I,
    P,
    H,
    ue,
    e.sourceOnly,
    d,
    e.download,
    e.goToPage,
    $,
    w,
    h,
    b
  ]), Ee = V(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), xe = [
    Ji,
    `is-workspace-${p}`,
    i ? "is-assistant-open" : "",
    I ? "is-finder-open" : "",
    u.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ g(sf, { api: Le, store: se, children: /* @__PURE__ */ g(gd, { value: Ne, hud: Ee, children: /* @__PURE__ */ D(
    "div",
    {
      className: xe,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": p,
      "data-ink-mode": ue.tool || void 0,
      onContextMenu: (fe) => {
        const Se = Dh(fe);
        Se && (fe.preventDefault(), re(nf(ce, { target: fe.target, clientX: fe.clientX, clientY: fe.clientY, page: Se.page })), he(Se));
      },
      children: [
        /* @__PURE__ */ g(Hm, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!r.readerErrors.regions, metadataError: !!r.readerErrors.metadata, onRetry: r.refreshJobArtifacts }),
        /* @__PURE__ */ g(Kh, { state: A, bookmarks: M }),
        /* @__PURE__ */ D("div", { className: "reader-chrome-tray", children: [
          /* @__PURE__ */ g(Zm, {}),
          /* @__PURE__ */ g(Al, { onBeforeClose: r.prepareClose })
        ] }),
        /* @__PURE__ */ g(
          ef,
          {
            mode: f,
            documentReady: !!r.jobId,
            sourceViewOnly: d,
            onModeChange: L,
            liveTranslation: m.topBarPill ? {
              visible: c,
              state: e.liveTranslation,
              onToggle: () => l((fe) => !fe),
              latestPage: c ? v : null,
              currentPage: e.currentPage,
              onJumpToLatest: y
            } : null,
            completion: S ? {
              onOpenCompare: () => {
                k(e.viewStateKey), L("compare");
              }
            } : null
          }
        ),
        /* @__PURE__ */ g(em, { active: a }),
        i ? /* @__PURE__ */ g(Bm, {}) : null,
        /* @__PURE__ */ g(Xd, { paneComposition: u, markdownSplit: i, assistantSplit: i, liveTranslation: e.liveTranslation, sourcePaneAction: E }),
        e.showHud ? /* @__PURE__ */ g(
          bh,
          {
            mode: f,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            issuesJobId: e.sourceOnly ? "" : r.jobId,
            searchSlot: /* @__PURE__ */ g(Mh, { open: I, onToggle: R })
          }
        ) : null,
        /* @__PURE__ */ g(
          np,
          {
            session: r,
            xrefs: pe,
            zoomDocuments: j,
            zoomItem: G,
            setZoomItem: J,
            closeZoom: oe,
            visiblePdfMode: f
          }
        ),
        /* @__PURE__ */ g(Nh, { active: a, ink: ue }),
        /* @__PURE__ */ g(
          Lh,
          {
            ink: ue,
            menu: ae,
            onClose: Re,
            actions: ee
          }
        ),
        /* @__PURE__ */ g(df, { extensions: or }),
        /* @__PURE__ */ g(xh, { ink: ue }),
        /* @__PURE__ */ g(Oh, { edit: q }),
        /* @__PURE__ */ g(kh, {})
      ]
    }
  ) }) });
}
function Up() {
  return /* @__PURE__ */ g(kp, {});
}
export {
  Up as R,
  kp as a,
  Hp as b,
  jp as c,
  Bp as d,
  zp as f,
  Fp as r,
  vf as s,
  Je as u
};
//# sourceMappingURL=ReaderApp-CF7Nwzex.js.map
