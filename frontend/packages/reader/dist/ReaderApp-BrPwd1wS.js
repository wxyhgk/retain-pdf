var as = Object.defineProperty;
var kr = (e) => {
  throw TypeError(e);
};
var ss = (e, t, n) => t in e ? as(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var Ir = (e, t, n) => ss(e, typeof t != "symbol" ? t + "" : t, n), Tr = (e, t, n) => t.has(e) || kr("Cannot " + n);
var _t = (e, t, n) => (Tr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Rr = (e, t, n) => t.has(e) ? kr("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Er = (e, t, n, r) => (Tr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as D, jsx as g, Fragment as De } from "react/jsx-runtime";
import { useMemo as K, useState as _, useEffect as C, useCallback as L, useRef as N, useLayoutEffect as Re, memo as Vt, createContext as qt, useContext as st, Fragment as Xn, forwardRef as Oo, useImperativeHandle as Zn, useSyncExternalStore as hn, Component as is, Suspense as $o, lazy as zo, useId as Fo } from "react";
import { requireAdapter as Mt, getReaderAdapters as _e } from "./adapters.js";
import { resolveReaderDownloadName as cs, resolveReaderDownloadUrls as ls, READER_PROGRESS_COPY as Be, trimString as an, READER_DOWNLOAD_ACTIONS as us, disabledReason as ds } from "./runtime/state.js";
import { r as fs, b as ms } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as An, isFinishedJobStatus as Bt } from "@retainpdf/domain/job";
import { n as Bo, d as hs, f as vn, k as Pr, b as ps, c as gs, j as Ne, p as dt, g as bs, l as Rt, i as ys } from "./reader-regions-BmqHsJ-I.js";
import { fetchDocumentReading as vs } from "@retainpdf/api/documents";
import { isReaderTransportError as ws, createReaderTransportError as Ss } from "./contracts.js";
import { toast as xn, Toaster as ks } from "sonner";
import { X as ft, PenLine as Yn, ZoomIn as Is, Check as jo, Copy as Ts, ChevronUp as Rs, ChevronDown as Ho, History as Es, LoaderCircle as Ps, Pin as Ms, LogOut as _s, FileText as Uo, Columns2 as Wo, Languages as Ko, Radio as Ns, ArrowDownToLine as As, CheckCircle2 as xs, GitCompareArrows as Ls, Highlighter as Ds, Eraser as Cs, Undo2 as Os, Trash2 as $s, ChevronLeft as zs, ChevronRight as Vo, Minus as Fs, Plus as Bs, ArrowLeft as js, Keyboard as Hs, Download as Us, ListOrdered as Ws, TriangleAlert as Ks, Search as Vs, ListTree as qs, LayoutGrid as Js } from "lucide-react";
import { Button as ee, Textarea as Gs, IconButton as at, Input as qo } from "@retainpdf/ui";
import { pdfjs as Jo, Page as Xs, Document as Zs } from "react-pdf";
import { e as Ys, m as Qs, a as ei } from "./markdown-math-XkF5urpn.js";
const ti = (...e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, ni = "", ri = Object.freeze({
  progress: "retainpdf-reader-progress"
}), oi = (e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, Qp = (...e) => {
  var n;
  return (((n = _e()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, eg = () => {
  var e, t;
  return ((t = (e = _e()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
}, je = () => Mt("defaultReaderDataPort"), Mr = () => Mt("defaultReaderPageConfigPort"), tg = {
  get apiPrefix() {
    return je().apiPrefix;
  },
  fetchProtected: (...e) => je().fetchProtected(...e),
  loadMarkdownPayload: (e) => je().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => je().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => je().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => je().loadJobPayload(e),
  loadReaderPayload: (e, t) => je().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => je().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return je().liveTranslation;
  }
}, Go = {
  messageTargetOrigin: () => Mr().messageTargetOrigin(),
  readerJobId: () => Mr().readerJobId()
}, ai = () => {
  var e;
  return ((e = _e()) == null ? void 0 : e.liveTranslation) ?? null;
}, jt = () => {
  var t;
  const e = _e();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, Ve = () => {
  const e = _e();
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
  return ((n = (t = _e()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, ii = () => {
  var e, t;
  return ((t = (e = _e()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, ci = (...e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, li = (...e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? cs(...e);
}, ui = (...e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? ls(...e);
}, di = (...e) => Mt("downloadProtectedResource")(...e), fi = (...e) => Mt("failDownloadToast")(...e), ng = (e, t) => Mt("resolveMarkdownAssetUrl")(e, t), _r = "/api/v1";
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
  const e = mi(), t = K(() => ci(Go), [e]), n = K(() => ii(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
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
  }), w = h.jobId === p ? h.documentId : "", v = t || w, y = !!t && !p, [S, k] = _(null), E = (S == null ? void 0 : S.sessionIdentity) === r && S.documentId === v ? S : null, x = y || !!E, $ = L((A) => {
    const I = `${A.documentId || ""}`.trim();
    if (!I || a.current && a.current !== I) return;
    if (!a.current && s.current)
      b({
        jobId: s.current,
        documentId: I
      });
    else if (!a.current)
      return;
    const T = `${A.revision || ""}`.trim() || `${Date.now()}`;
    k({
      documentId: I,
      revision: T,
      sessionIdentity: o.current
    }), i();
  }, []);
  C(() => {
    k((A) => A && A.sessionIdentity !== r ? null : A);
  }, [r]);
  const O = L((A) => {
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
    sourceViewOnly: x,
    refreshCommittedDocument: $,
    applyIdentityEvent: O
  };
}
function Nr(e) {
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
function Ar(e, t) {
  return oi(An(e, t));
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
function Ln({
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
      Go.messageTargetOrigin()
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
function vi(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = _(null), [l, u] = _(null), [m, d] = _(""), [f, p] = _(0), h = m === n ? i : null, b = m === n ? l : null, w = Nr(h), v = Bt(w), y = L(() => {
    p((O) => O + 1);
  }, []), S = L((O) => {
    c(O.jobPayload), u(O.manifestPayload), d(O.sessionIdentity);
  }, []), k = L((O) => {
    c(null), u(null), d(O);
  }, []), E = N(""), x = N(""), $ = L(async () => {
    const O = o.current;
    if (!O || E.current === O) return;
    const A = Ve().loadJobPayload;
    if (typeof A != "function") return;
    const I = a.current.value;
    E.current = O;
    try {
      const T = await A(O);
      if (s.current || a.current.value !== I || o.current !== O || !T || typeof T != "object")
        return;
      const P = Nr(T);
      c(T), d(r.current), !Bt(P) && x.current === O && (x.current = ""), P === "succeeded" && x.current !== O && (x.current = O, p((R) => R + 1));
    } catch {
    } finally {
      E.current === O && (E.current = "");
    }
  }, []);
  return C(() => {
    x.current = "";
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
function Dn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function wi(e, t) {
  e(t), Dn(t);
}
function Si(e) {
  const [t, n] = _(e ? "source" : "compare"), r = L((a) => {
    e && a !== "source" || (n(a), Dn(a));
  }, [e]), o = L((a) => {
    wi(n, a);
  }, []);
  return C(() => (e && document.documentElement.classList.add("reader-source-only"), Dn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function xr(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function ki(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: xr(n.active_job_id),
    activeVersionId: xr(n.active_version_id)
  };
}
function Ii(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Ti(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Ri(e) {
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
const Ni = 2, Me = /* @__PURE__ */ new Map();
function Cn(e, t) {
  Me.delete(e), Me.set(e, t);
}
function Lr(e) {
  if (Me.size < Ni) return;
  const t = Me.keys().next().value;
  t && Me.delete(t);
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
async function Xo(e, t = jt().fetchProtected, n = {}) {
  var u, m, d, f, p, h, b, w, v;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (Me.has(r)) {
    const y = Me.get(r);
    return Cn(r, y), y;
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
  const i = xi(r, s, t);
  if (i) {
    o.abort();
    const y = { ranged: i };
    return Lr(), Me.set(r, y), y;
  }
  (b = (h = n.signal) == null ? void 0 : h.addEventListener) == null || b.call(h, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (v = (w = n.signal) == null ? void 0 : w.removeEventListener) == null || v.call(w, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return Me.has(r) ? Cn(r, l) : (Lr(), Me.set(r, l)), l;
}
function xi(e, t, n) {
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
const Li = { file: null, loading: !1, error: "" }, Di = { file: null, loading: !0, error: "" };
function Ci(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = _(null);
  if (C(() => {
    if (t || !n) return;
    const s = Me.get(n);
    if (s) {
      Cn(n, s);
      return;
    }
    const i = new AbortController();
    return Xo(n, void 0, { signal: i.signal }).then((c) => {
      i.signal.aborted || o({ url: n, file: c, loading: !1, error: "" });
    }).catch((c) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (c == null ? void 0 : c.message) || String(c) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Li;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = Me.get(n);
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
async function On(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  sn(s, r, n, "download");
  const i = await Xo(t, jt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (sn(s, o, n, "download"), i);
}
async function $i(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  sn(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    On({
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
    On({
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
const Yt = {
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
  } = e, [v, y] = _(""), [S, k] = _(""), [E, x] = _(null), [$, O] = _(null), [A, I] = _(!1), [T, P] = _(""), [R, M] = _([]), [z, F] = _(!1), [J, te] = _(() => ({
    source: null,
    translated: null
  })), [Z, re] = _(
    Yt
  ), [H, U] = _({
    loading: !0,
    percent: 4,
    text: Be.boot,
    stage: "progress",
    failed: !1
  });
  return C(() => {
    const W = new AbortController(), he = h.current.value, V = Oi({
      sessionEpochRef: h,
      closingRef: b,
      abort: W,
      sessionEpoch: he
    });
    w.current = W;
    const q = Ve();
    if (b.current)
      return W.abort(), () => {
        w.current === W && (w.current = null);
      };
    let de = !1;
    function se(oe, fe) {
      V.markFailed(), F(!0), U({
        loading: !1,
        percent: 100,
        text: oe,
        stage: "failed",
        failed: !0
      }), Ln({ percent: 100, text: fe, stage: "failed" });
    }
    function le() {
      I(!0), de || F(!0), U({
        loading: !1,
        percent: 100,
        text: Be.ready,
        stage: "ready",
        failed: !1
      }), Ln({ percent: 100, text: Be.ready, stage: "ready" });
    }
    function be() {
      return l != null && l.documentId ? Ar(
        l.documentId,
        l.revision
      ) : ti() ? ni : q.resolveResourceUrl(An(r));
    }
    async function pe() {
      var Q;
      let oe = { activeJobId: "", activeVersionId: "" };
      try {
        const ae = await ((Q = q.fetchDocument) == null ? void 0 : Q.call(q, r));
        ae && (oe = ki(ae));
      } catch {
      }
      const fe = Ii({
        link: oe,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (fe.kind === "follow-active-job") {
        if (V.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: fe.jobId
        }), fe.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: fe.activeVersionId,
          sessionIdentity: c
        }), f("source")) : f("compare");
        return;
      }
      if (fe.kind === "open-committed-source") {
        if (V.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: fe.revision,
          sessionIdentity: c
        }), f("source");
        return;
      }
      const ye = be();
      if (V.isInactive()) return;
      y(ye), k(""), P(""), d(c);
      const j = await On({
        url: ye,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: V,
        setBoot: U
      });
      if (!V.isInactive()) {
        if (!j) {
          se("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        x(j), le();
      }
    }
    async function nt() {
      var Zt;
      const oe = !l, fe = !!(oe && q.loadSessionSnapshot && q.loadReaderOptionalArtifacts), ye = fe ? q.loadReaderOptionalArtifacts(t) : null, j = await ((Zt = q.loadSessionSnapshot) == null ? void 0 : Zt.call(q, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: oe && !fe
      })), Q = j ? {
        jobPayload: j.sourcePayload,
        manifestPayload: j.manifestPayload,
        readerMetadata: j.readerMetadata,
        regionsPayload: j.regions,
        readerErrors: j.readerErrors
      } : await q.loadReaderPayload(t, {
        includeOptionalArtifacts: oe
      });
      if (V.isInactive()) return;
      let ae = null;
      if (n && !r)
        if (j && j.linkedDocument !== void 0)
          ae = j.linkedDocument;
        else {
          try {
            ae = await q.fetchDocumentByJobId(_r, t);
          } catch {
          }
          if (V.isInactive()) return;
        }
      const xe = gi(Q.jobPayload) || `${(ae == null ? void 0 : ae.document_id) || ""}`.trim();
      xe && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: xe
      });
      const Ee = Ti({
        payloadDocumentId: xe,
        linkedActiveJobId: `${(ae == null ? void 0 : ae.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(ae == null ? void 0 : ae.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (Ee.kind === "restore-committed-source") {
        if (V.isInactive()) return;
        u({
          type: "committed-source",
          documentId: Ee.documentId,
          revision: Ee.revision,
          sessionIdentity: c
        }), f("source");
        return;
      }
      const Pe = q.resolveReaderSourcePdf(Q.manifestPayload), ze = q.resolveReaderTranslatedPdfUrl(Q.jobPayload, Q.manifestPayload), me = typeof Pe == "string" ? Pe : q.resolveReaderArtifactUrl(Pe), we = r || xe, Je = l != null && l.documentId ? Ar(
        l.documentId,
        l.revision
      ) : me || (we ? q.resolveResourceUrl(An(we)) : ""), Fe = l ? "" : ze || "";
      y(Je || ""), k(Fe), P(yi(Q.jobPayload, t)), m({
        jobPayload: Q.jobPayload || null,
        manifestPayload: Q.manifestPayload || null,
        sessionIdentity: c
      });
      const rt = () => $i({
        sourceFinal: Je || "",
        translatedFinal: Fe,
        fence: V,
        setBoot: U
      }), pt = !!(Je || Fe), gt = ye && pt ? rt() : null;
      gt == null || gt.catch(() => {
      });
      const Xt = (B) => {
        V.isInactive() || (M(l ? [] : Bo(B.regionsPayload)), te(l ? { source: null, translated: null } : hs(B.readerMetadata)), re(l ? Yt : B.readerErrors ?? Yt), F(!0));
      };
      if (ye ? (de = !0, ye.then(Xt)) : Xt(Q), !pt) {
        se(Be.failed, Be.failed);
        return;
      }
      const bt = await (gt ?? rt());
      if (bt.status !== "inactive") {
        if (bt.status === "incomplete") {
          se("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        x(bt.sourceBytes), O(bt.translatedBytes), le();
      }
    }
    async function Ae() {
      I(!1), x(null), O(null), M([]), F(!1), te({ source: null, translated: null }), re(Yt), sn(U, 8, Be.metadata, "metadata");
      try {
        if (s) {
          await pe();
          return;
        }
        if (!t) {
          se(Be.failed, Be.failed);
          return;
        }
        await nt();
      } catch (oe) {
        if (V.isClosedOrStale() || (oe == null ? void 0 : oe.name) === "AbortError") return;
        V.markFailed();
        const fe = Number(oe == null ? void 0 : oe.status), ye = `${(oe == null ? void 0 : oe.reason) || ""}`, j = Pi({ status: fe, reason: ye, sessionJobId: t });
        if (j && (await Fi({
          apiPrefix: _r,
          documentId: j,
          expiredJobId: t
        }) || V.isClosedOrStale()))
          return;
        if (Ri({
          status: fe,
          reason: ye,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), f("source");
          return;
        }
        const Q = oe instanceof Error ? oe.message : Be.failed;
        se(Q, Q);
      }
    }
    return Ae(), () => {
      W.abort(), w.current === W && (w.current = null);
    };
  }, [t, r, o, a, s, i, l, p, n, c, u, m, d, f]), {
    sourceUrl: v,
    translatedUrl: S,
    sourceFile: E,
    translatedFile: $,
    assetsReady: A,
    title: T,
    regions: R,
    regionsSettled: z,
    readerMetadata: J,
    readerErrors: Z,
    boot: H
  };
}
function ji() {
  const e = N(!1), t = N(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = hi(), s = N({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = N(a), c = N(""), l = N(""), u = N(() => {
  }), m = L(() => u.current(), []), d = pi({
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
    jobStatus: x,
    jobTerminal: $,
    jobRefreshRevision: O,
    refreshJobArtifacts: A,
    refreshJobStatus: I
  } = S, T = Bi({
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
  }), P = L(() => {
    var M;
    e.current = !0, (M = t.current) == null || M.abort();
  }, []), R = K(
    () => ({
      fetchProtected: Ve().fetchProtected,
      jobId: f,
      jobPayload: k,
      manifestPayload: E,
      sourceUrl: T.sourceUrl,
      translatedUrl: T.translatedUrl,
      sourceOnly: b
    }),
    [f, k, E, T.sourceUrl, T.translatedUrl, b]
  );
  return {
    jobId: f,
    jobStatus: x,
    workflow: `${(k == null ? void 0 : k.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: $,
    documentId: p,
    sessionIdentity: a,
    sourceOnly: h,
    mode: w,
    setMode: v,
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
    download: R,
    refreshJobArtifacts: A,
    refreshJobStatus: I,
    refreshCommittedDocument: d.refreshCommittedDocument,
    prepareClose: P
  };
}
const Hi = 160, Ui = 8, Wi = 0;
function Ki() {
  const e = N(null), [t, n] = _(null), [r, o] = _(Wi), a = L((s) => {
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
const wn = { source: 0, translated: 0 };
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
    pages: wn
  })), [f, p] = _(() => ({ identity: l, tick: 0 })), h = m.identity === l ? m.pages : wn, b = f.identity === l ? f.tick : 0, w = Vi({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: v } = w, y = L((I, T) => {
    u.current === l && d((P) => {
      const R = P.identity === l ? P.pages : wn;
      return R[T] === I && P.identity === l ? P : {
        identity: l,
        pages: { ...R, [T]: I }
      };
    });
  }, [l]), S = N(null), k = L(() => {
    S.current && clearTimeout(S.current);
    const I = l;
    S.current = setTimeout(() => {
      S.current = null, u.current === I && p((T) => ({
        identity: I,
        tick: T.identity === I ? T.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  C(() => (S.current && (clearTimeout(S.current), S.current = null), d((I) => I.identity === l && I.pages.source === 0 && I.pages.translated === 0 ? I : { identity: l, pages: { source: 0, translated: 0 } }), p((I) => I.identity === l && I.tick === 0 ? I : { identity: l, tick: 0 }), () => {
    S.current && (clearTimeout(S.current), S.current = null);
  }), [l]);
  const E = K(
    () => Math.max(h.source, h.translated),
    [h]
  ), x = v === "translated" ? h.translated : h.source || h.translated, $ = t == null ? void 0 : t.userZoom, O = t == null ? void 0 : t.shellWidth, A = `${l}-${b}-${$}-${n}-${h.source}-${h.translated}-${O}`;
  return {
    ...w,
    numPagesByPane: h,
    hudNumPages: E,
    primaryNumPages: x,
    metricsTick: b,
    onNumPages: y,
    onMetrics: k,
    rowSyncRevision: A
  };
}
const Te = "data-reader-page", ke = "data-reader-pane", Qn = "data-natural-height", Ji = "reader-react-root", Zo = "reader-react-grid", Yo = "reader-react-scroll-shell", pn = "reader-react-pdf-pane", Qo = "reader-react-pdf-page", cn = "reader-react-pdf-page-placeholder", er = "reader-react-pdf-page-slot";
function ln(e, t) {
  const n = e != null ? `[${Te}="${e}"]` : `[${Te}]`;
  return t ? `${n}[${ke}="${t}"]` : n;
}
function tr() {
  return `.${er}[${Te}]`;
}
function un(e) {
  return Number(e.getAttribute(Te));
}
const ea = 0.25, dn = 1, Gi = 0.05, Jt = 0.5, Xi = 16, Zi = 8, ta = Xi + Zi, Yi = 720;
function Qe() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function na(e) {
  return Number.isFinite(e) && e < Yi;
}
function St(e, t = Number.POSITIVE_INFINITY) {
  return na(t) && (e === "source" || e === "translated") ? dn : Jt;
}
function We(e) {
  return Number.isFinite(e) ? Math.min(dn, Math.max(ea, e)) : Jt;
}
function Ht(e, t) {
  const n = We(Number(e) + t * Gi);
  return Math.round(n * 100) / 100;
}
function Qi(e) {
  return Math.round(We(e) * 100);
}
function ra(e) {
  const n = (Number(e) || 0) - ta;
  return Math.max(160, Math.floor(n));
}
function ec(e, t = Jt) {
  const n = We(t);
  return ra((Number(e) || 0) * n);
}
function tc(e, t) {
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
const nc = 8;
function rc(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < nc ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const oa = 200, oc = [
  "markdown"
], ac = oc;
function aa(e) {
  return ac.includes(e);
}
const sc = "retainpdf:reader:view:v1:", Dr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), ic = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function sa() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function $n(e) {
  return `${e || ""}`.trim();
}
function cc({
  documentId: e,
  jobId: t
}) {
  const n = $n(e);
  if (n) return `document:${n}`;
  const r = $n(t);
  return r ? `job:${r}` : "";
}
function ia(e) {
  const t = $n(e);
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
  if (!(!Dr.has(t) || !Dr.has(n) || t === n))
    return { left: t, right: n };
}
function dc(e) {
  return e === null ? null : aa(e) ? e : void 0;
}
function fc(e) {
  return ic.has(e) ? e : void 0;
}
function ca(e) {
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
function $e(e, t = sa()) {
  const n = ia(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? ca(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function gn(e, t, n = sa()) {
  const r = ia(e);
  if (!r || !n) return null;
  const o = $e(e, n), a = ca({
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
    return ((f = $e(n)) == null ? void 0 : f.zoom) ?? St(e, Qe());
  }), a = N(r), s = N(n);
  a.current = r;
  const i = N(1), c = N(((d = $e(n)) == null ? void 0 : d.zoom) !== void 0);
  C(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const f = (h = $e(n)) == null ? void 0 : h.zoom;
    c.current = f !== void 0;
    const p = f ?? St(e, Qe());
    i.current = 1, a.current = p, o(p);
  }, [e, n]), C(() => {
    if (c.current) return;
    const f = St(e, Qe()), p = a.current;
    Math.abs(f - p) < 5e-4 || (i.current = 1, a.current = f, o(f));
  }, [e]);
  const l = L((f, p) => {
    const h = We(f), b = a.current;
    Math.abs(h - b) < 5e-4 || (i.current = (p == null ? void 0 : p.keepScroll) === !1 ? 1 : h / (b || 1), a.current = h, c.current = !0, gn(s.current, { zoom: h }), o(h));
  }, []), u = L((f) => {
    l(Ht(a.current, f));
  }, [l]), m = L((f) => {
    l(St(f));
  }, [l]);
  return Re(() => {
    const f = i.current;
    Math.abs(f - 1) < 1e-3 || (i.current = 1, tc(t == null ? void 0 : t.current, f));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: m };
}
const hc = 160, pc = 3e-3, Cr = 50, gc = 16, bc = 800;
function yc(e, t = 0) {
  const n = t === 1 ? gc : t === 2 ? bc : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-Cr, Math.min(Cr, r));
  return Math.exp(-o * pc);
}
function vc(e, t, n = 0) {
  return We(e * yc(t, n));
}
function wc(e) {
  return Math.round(We(e) * 100) / 100;
}
function Sc(e, t, n) {
  const r = We(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return We(t) / r;
  const a = (o + ta) / r;
  return ra(a * We(t)) / o;
}
function kc(e) {
  return Array.from(e.querySelectorAll(tr()));
}
function Ic(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function Tc(e, t, n) {
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
    page: o.getAttribute(Te) || "",
    pane: o.getAttribute(ke) || "",
    fracX: (t - a.left) / a.width,
    fracY: (n - a.top) / a.height,
    clientX: t,
    clientY: n,
    pageWidth: a.width
  };
}
function Rc(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function la(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${tr()}[${Te}="${t.page}"][${ke}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (Rc(n, e).scrollLeft += a);
}
function Ec(e, t, n, r) {
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
const Pc = 600, Mc = 1e3;
function _c(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || la(e, t);
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
          anchor: Tc(e, u.clientX, u.clientY),
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
  }, [e]), Re(() => {
    var l;
    const c = s.current;
    c && (s.current = null, c.fallback && clearTimeout(c.fallback), Nt(c.grid), !(!e || !c.anchor) && (la(e, c.anchor), (l = i.current) == null || l.call(i), i.current = _c(e, c.anchor)));
  }, [t, e]);
}
function Ac(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = N(t), a = N(n), s = N(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: L((c) => {
    c !== o.current && (s.current(), a.current(c));
  }, []) };
}
const nr = 48;
function ua(e, t = nr) {
  return e.getBoundingClientRect().top + t;
}
function da(e, t) {
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
  const s = ua(e, n), i = da(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function Et(e, t, n = "auto", r, o = nr) {
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
function xc(e, t, n = "smooth", r) {
  return Et(
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
function Lc(e, t, n) {
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
function Le(e) {
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
    const m = ln(void 0, o), d = () => {
      if (c) return;
      const h = Array.from(i.querySelectorAll(m));
      if (!h.length)
        return;
      const b = ua(i), w = da(h, b);
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
const Cc = `canvas, .react-pdf__Page, .${Qo}, .${cn}`, Or = /* @__PURE__ */ new WeakMap();
function Oc(e) {
  const t = Number(e.getAttribute(Qn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Or.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(Cc), Or.set(e, n)), n) {
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
  e.querySelectorAll(tr()).forEach((r) => {
    const o = un(r);
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
  return i.current = r, Re(() => {
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
]), Vc = 180, $r = [0, 48, 140, 320, 700, 1200];
function qc(e, t) {
  var T;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = N(
    ((T = $e(a)) == null ? void 0 : T.anchor) || { page: 1, fraction: 0 }
  ), c = N(null), l = N(!1), u = N(r), m = N(null), d = N(null), f = N(null), p = N(null), h = N(a), b = N(""), w = N(n);
  w.current = n;
  const v = L(() => {
    var P;
    (P = m.current) == null || P.call(m), m.current = null, d.current != null && (clearTimeout(d.current), d.current = null);
  }, []), y = L(() => {
    !l.current && c.current == null || (v(), f.current != null && (clearTimeout(f.current), f.current = null), c.current = null, l.current = !1);
  }, [v]), S = L((P = !1) => {
    p.current != null && (clearTimeout(p.current), p.current = null);
    const R = () => {
      p.current = null, gn(h.current, {
        anchor: Le(i.current)
      });
    };
    P ? R() : p.current = setTimeout(R, Vc);
  }, []), k = L((P) => {
    i.current = Le(P), c.current = null, f.current != null && clearTimeout(f.current), f.current = setTimeout(() => {
      f.current = null, l.current = !1;
    }, Wc);
  }, []);
  C(() => {
    if (!o)
      return;
    let P = !1, R = null, M = null, z = null;
    const F = () => {
      if (P) return;
      const J = e.current;
      if (!J) {
        z = setTimeout(F, 50);
        return;
      }
      R = J, M = () => {
        if (l.current)
          return;
        const te = zt(R, w.current);
        te && (i.current = te, S());
      }, R.addEventListener("scroll", M, { passive: !0 }), l.current || M();
    };
    return F(), () => {
      P = !0, z != null && clearTimeout(z), R && M && R.removeEventListener("scroll", M);
    };
  }, [o, r, n, e, S]), C(() => {
    if (!o) return;
    const P = e.current;
    if (!P) return;
    const R = (M) => {
      M.metaKey || M.ctrlKey || M.altKey || Kc.has(M.key) && y();
    };
    return P.addEventListener("wheel", y, { passive: !0 }), P.addEventListener("touchmove", y, { passive: !0 }), window.addEventListener("keydown", R), () => {
      P.removeEventListener("wheel", y), P.removeEventListener("touchmove", y), window.removeEventListener("keydown", R);
    };
  }, [o, e, y]), Re(() => {
    var R;
    if (h.current === a) return;
    S(!0), v(), f.current != null && (clearTimeout(f.current), f.current = null), h.current = a, b.current = "";
    const P = (R = $e(a)) == null ? void 0 : R.anchor;
    i.current = P ? Le(P) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, u.current = r;
  }, [a, r, S, v]), C(() => {
    var R;
    if (!o || !s || !a || b.current === a) return;
    b.current = a;
    const P = Le(
      ((R = $e(a)) == null ? void 0 : R.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = P, c.current = P, l.current = !0, v(), m.current = zn(
      () => e.current,
      P,
      {
        behavior: "auto",
        pane: w.current,
        delaysMs: $r,
        onDone: () => k(P)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(P);
    }, Math.max(...$r) + 160), () => v();
  }, [o, s, a, e, k, v]), C(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, c.current = null, v();
      return;
    }
    const P = c.current ? Le(c.current) : Le(i.current);
    return l.current = !0, c.current = P, i.current = P, v(), m.current = zn(
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
  const E = L(() => {
    const P = zt(
      e.current,
      w.current
    );
    return Le(P || i.current);
  }, [e]), x = L(() => {
    l.current = !0;
    const P = zt(
      e.current,
      w.current
    ), R = Le(P ?? i.current);
    return i.current = R, c.current = R, S(), R;
  }, [e, S]), $ = L((P, R, M) => {
    const z = M || w.current, F = fn(P, R || 1), J = { page: F, fraction: 0 };
    i.current = J, l.current = !0, c.current = J, S(), v(), xc(e.current, F, "smooth", z), m.current = Lc(
      () => e.current,
      F,
      {
        behavior: "auto",
        pane: z,
        delaysMs: Hc,
        onDone: () => k(J)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(J);
    }, Uc);
  }, [e, k, v, S]), O = L(() => Le(i.current), []), A = L(() => l.current, []), I = L(() => {
    if (!l.current || !c.current)
      return;
    const P = Le(c.current);
    Et(
      e.current,
      P,
      "auto",
      w.current
    );
  }, [e]);
  return {
    lockFromShell: E,
    beginModeSwitch: x,
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
function fa(e, t, n) {
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
    const w = fa(h, b, { jobId: c, documentId: l });
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
      t.current = fa(
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
  const t = N(""), [n, r] = _(!1), o = L(() => r(!0), []), a = {
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
function zr(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function ma(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = zr(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = zr(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function rl(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = ma(r, t, n);
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
const Fr = [250, 500, 1e3, 2e3, 4e3], Sn = [80, 160, 320, 640, 1e3, 1500], Br = [250, 500, 1e3, 2e3, 4e3, 5e3];
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
  return ws(e) ? `${e.code || ""}`.trim() : "";
}
function Qt(e, t) {
  const n = rr(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function ll(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (ma(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
        return c;
      a = Ss(
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
          const k = rr(S);
          if (!(k === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !k)) {
            b((x) => ({
              ...x,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: Qt(S, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            b((x) => ({
              ...x,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          b((x) => ({
            ...x,
            connection: "connecting",
            jobStatus: l,
            error: Qt(S, "正在等待 OCR 版面数据")
          })), await Fn(Fr[Math.min(y, Fr.length - 1)], f.signal).catch(() => {
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
                b((x) => ({
                  ...x,
                  lastSeq: Math.max(x.lastSeq, S.seq),
                  error: Qt(E, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              b((E) => {
                const x = rl(E, S, k);
                return u ? {
                  ...x,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...x,
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
            error: Qt(S, "实时译文连接已中断，正在重连")
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
        await Fn(Br[Math.min(y, Br.length - 1)], f.signal).catch(() => {
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
    const a = Ve().fetchRevisionGroups;
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
function ha(e) {
  return !!(e.jobId && e.sourceUrl && pl.has(e.workflow));
}
function gl(e) {
  return !!(ha(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function bl() {
  const e = ji(), t = ha({
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
  ), k = L((F, J) => {
    var Z, re;
    const te = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((Z = h.numPagesByPane) == null ? void 0 : Z.source) || 0,
      Number((re = h.numPagesByPane) == null ? void 0 : re.translated) || 0
    );
    w(F, te, J);
  }, [w, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [E, x] = _(null), $ = N(null), O = L((F) => {
    $.current && clearTimeout($.current), x(F), F && ($.current = setTimeout(() => x(null), ml));
  }, []);
  C(() => () => {
    $.current && clearTimeout($.current);
  }, []);
  const A = L((F) => {
    const J = vn(e.regions, F);
    return J ? Pr(J, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), I = L((F, J) => {
    const te = J || h.primaryPane, Z = typeof F == "object" && F ? `${F.block_id || ""}`.trim() : "", re = typeof F == "object" && F ? `${F.image_url || ""}`.trim() : "", H = typeof F == "object" && F ? F.page_idx != null ? Number(F.page_idx) + 1 : F.page != null ? Number(F.page) : null : typeof F == "number" ? F + 1 : null, U = ps(e.regions, re, H) || vn(e.regions, Z) || (typeof F == "object" ? gs(e.regions, F) : null);
    let W = U ? Pr(U, te).page : null;
    W == null && (W = hl(F)), !(W == null || W < 1) && (O(U), k(W, te));
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
    onAnchorApplied: (F) => {
      O(vn(e.regions, F.blockId));
    }
  });
  const { setModeKeepingPage: T } = Ac({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: b
  });
  C(() => {
    O(null);
  }, [d, O]);
  const P = !e.boot.loading && !e.boot.failed, R = K(() => ({ bindShell: l, shellEl: i, shellWidth: c, shellRef: s }), [l, i, c, s]), M = K(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), z = K(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: f,
    onZoomChange: p,
    shell: R,
    panes: h,
    sessionFiles: M,
    rowHeights: y,
    goToPage: k,
    activeRegion: E,
    jumpToAnchor: I,
    setModeKeepingPage: T,
    download: e.download,
    showHud: P,
    viewStateKey: m,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, R, h, M, y, k, E, I, T, P, f, p, m, a, n, u]);
  return K(() => ({
    ...z,
    currentPage: S
  }), [z, S]);
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
function Tl(e) {
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
              a(St(t, Qe()));
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
const Rl = "retainpdf:soft-reader-close";
function El() {
  return new URL("./index.html", window.location.href).href;
}
function Pl() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Rl },
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
const xl = 3e3, Ll = 8;
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
  let n = xl;
  const r = [], o = (s, i, c) => {
    const l = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const m = s[u], d = Cl(m == null ? void 0 : m.title);
      if (!d) continue;
      n -= 1;
      const f = c ? `${c}.${u}` : `${u}`, p = { id: f, title: d, page: null, level: i, children: [] };
      r.push({ node: p, dest: m.dest }), l.push(p), i < Ll && Array.isArray(m.items) && m.items.length && (p.children = o(m.items, i + 1, f));
    }
    return l;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await Dl(e, i);
  })), a;
}
function pa(e) {
  const t = [], n = (r) => {
    for (const o of r)
      t.push(o), n(o.children);
  };
  return n(e), t;
}
function ga(e, t) {
  let n = null;
  for (const r of pa(e))
    r.page === null || r.page > t || (!n || r.page > (n.page ?? 0) || r.page === n.page && r.id.startsWith(`${n.id}.`)) && (n = r);
  return (n == null ? void 0 : n.id) ?? null;
}
function jr(e) {
  if (!e) return [];
  const t = e.split(".");
  return t.slice(0, -1).map((n, r) => t.slice(0, r + 1).join("."));
}
let Hr = !1;
function $l() {
  if (Hr)
    return;
  const e = jt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (Jo.GlobalWorkerOptions.workerSrc = e, Hr = !0);
}
const Ye = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), zl = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Fl = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Bl = {
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
}, Ur = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function jl(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Ur(o ?? a ?? "", zl)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Ur(o ?? a ?? "", Fl)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Bl[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Hl(e) {
  return Ye(e.translatedBlockText) || Ye(e.translated.text) || Ye(e.source.text);
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
function Wr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - Vl), o = Math.min(e.length, n + t.length + ql), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function Jl(e, t, n = 200) {
  const r = Ye(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = Ye(a.translatedBlockText) || Ye(a.translated.text), c = i ? Wr(i, r) : null, l = c ?? Wr(Ye(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: c ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
function en(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function Dt(e, t) {
  const n = Ye(t).toLowerCase();
  if (!n || !e) return en(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${en(e.slice(a, s))}<mark class="reader-find-mark">${en(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + en(e.slice(a));
}
function Gl(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const Xl = /^data-[a-z0-9-]+$/;
function Kr(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function Zl(e, t, n = "") {
  if (!t.length) return Dt(e, n);
  const r = t.filter((s) => s.end > s.start && s.start >= 0 && s.end <= e.length).map((s, i) => ({ mark: s, order: i })).sort((s, i) => s.mark.start - i.mark.start || s.order - i.order).map(({ mark: s }) => s);
  let o = "", a = 0;
  for (const s of r) {
    if (s.start < a) continue;
    o += Dt(e.slice(a, s.start), n);
    const i = Object.entries(s.attrs ?? {}).filter(([c]) => Xl.test(c)).map(([c, l]) => ` ${c}="${Kr(l)}"`).join("");
    o += `<mark class="${Kr(s.className)}"${i}>${Dt(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  }
  return o + Dt(e.slice(a), n);
}
function ge(e) {
  return typeof e == "string" ? e : "";
}
function Yl(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function Ql(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function eu(e) {
  return {
    source: ge(e == null ? void 0 : e.source_text) || ge(e == null ? void 0 : e.unit_source_text),
    translated: ge(e == null ? void 0 : e.protected_translated_text) || ge(e == null ? void 0 : e.translated_text)
  };
}
const tu = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function ba(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function nu(e) {
  const t = ba(e).sort((r, o) => ge(r.ts).localeCompare(ge(o.ts)));
  return t.length ? [
    { text: ge(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: ge(r.new_text),
      label: tu[ge(r.source)] || ge(r.source) || "修订",
      ts: ge(r.ts),
      reason: ge(r.reason)
    }))
  ].reverse() : [];
}
function ru(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function ou(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return ge(r.finished_at) || ge(n.finished_at) || "";
}
function au(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = ba(e).sort((a, s) => ge(a.ts).localeCompare(ge(s.ts)));
  for (const a of o) {
    const s = new Date(ge(a.ts)).getTime(), i = ge(a.reader_item_id) || ge(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, ge(a.new_text));
  }
  return n;
}
const su = {
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
function iu(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = su[ge(n.kind)] || ge(n.kind) || "问题", o = ge(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const cu = /* @__PURE__ */ new Set(["text", "formula"]);
function or(e) {
  return cu.has(e);
}
function lu(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || or(Ne(n));
}
function uu(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !or(Ne(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const du = 300, fu = 72;
function mu(e, t) {
  if (e.width >= du && e.height >= fu)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const hu = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function pu(e, t, n) {
  return e.flatMap((r) => {
    if (!hu.has(Ne(r.region))) return [];
    const o = dt(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function Vr(e, t, n) {
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
async function gu(e) {
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
const bu = "reader-text-hover-copy", yu = "reader-text-hover-edit", vu = "reader-text-hover-zoom", wu = "reader-text-hover-id";
function Su(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const ya = "reader-text-hover-tools";
function tn({
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
const ku = 26, Iu = 220;
function Tu(e, t = Iu) {
  return e.height < ku * 2 || e.width < t;
}
function Ru({ state: e }) {
  return /* @__PURE__ */ g(e === "copied" ? jo : e === "failed" ? ft : Ts, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function Eu({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  onZoom: o,
  frameRect: a,
  placement: s,
  tailTop: i = 0
}) {
  const [c, l] = _("idle"), [u, m] = _("idle"), [d] = _(() => Su()), f = N([]), p = (e == null ? void 0 : e.itemId) || "";
  if (C(() => {
    l("idle"), m("idle");
    const k = f.current;
    return () => {
      k.forEach((E) => window.clearTimeout(E)), f.current = [];
    };
  }, [p]), !e) return null;
  const h = bs(e.highlight.region, t), b = Ne(e.highlight.region), w = (k, E) => async (x) => {
    x.preventDefault(), x.stopPropagation();
    const $ = await gu(k);
    E($ ? "copied" : "failed"), f.current.push(window.setTimeout(() => E("idle"), 1200));
  }, v = b === "formula" ? "复制 LaTeX" : "复制", y = a || e.rect, S = s || (Tu(y) ? "outside" : "inside");
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
          className: ya,
          "data-placement": S,
          style: S === "tail" ? { top: i } : void 0,
          children: [
            d ? /* @__PURE__ */ g(
              tn,
              {
                className: wu,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: w(e.itemId, m),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && or(b) ? /* @__PURE__ */ g(
              tn,
              {
                className: yu,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (k) => {
                  k.preventDefault(), k.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ g(Yn, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            h ? /* @__PURE__ */ g(
              tn,
              {
                className: bu,
                state: c,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: c === "copied" ? "已复制" : c === "failed" ? "复制失败" : v,
                onClick: w(h, l),
                children: /* @__PURE__ */ g(Ru, { state: c })
              }
            ) : null,
            o ? /* @__PURE__ */ g(
              tn,
              {
                className: vu,
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
function Pu(e, t) {
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
function Mu(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = dt(
      Pu(e, a),
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
const _u = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Nu = 256, xt = /* @__PURE__ */ new Map();
function Au(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function va(e) {
  const t = `${e || ""}`, { text: n, slots: r } = Ys(t, { bareLatex: !0 }), o = Au(n), a = Qs(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = xt.get(t);
  if (!s && (s = ei(o, r), xt.set(t, s), xt.size > Nu)) {
    const i = xt.keys().next().value;
    i !== void 0 && xt.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function kn(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function He(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function xu(e, t) {
  const n = e.typography, r = He(t) || 1, o = He(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = kn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(s, i * r)), l = He(n == null ? void 0 : n.fit_min_font_size_pt), u = He(n == null ? void 0 : n.fit_max_font_size_pt), m = Math.max(3.5, (l || 5.5) * r), d = Math.max(
    m,
    u ? u * r : o ? o * r : c
  ), f = o ? o * r : c, p = He(n == null ? void 0 : n.leading_em), h = [
    He(n == null ? void 0 : n.padding_top_pt) || 0,
    He(n == null ? void 0 : n.padding_right_pt) || 0,
    He(n == null ? void 0 : n.padding_bottom_pt) || 0,
    He(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((b) => b * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || _u,
    fontSizePx: Math.max(m, Math.min(d, f)),
    minFontSizePx: m,
    maxFontSizePx: d,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: p ? 1 + p : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (kn(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : kn(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function Lu(e, t, n, r) {
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
const Du = 512, Lt = /* @__PURE__ */ new Map();
let Bn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Bn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Bn += 1;
}));
function Cu(e, t, n, r) {
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
function wa({ item: e, pageScale: t }) {
  const n = N(null), r = K(
    () => va(e.translatedText),
    [e.translatedText]
  ), [o, a] = _(r.fallbackHtml), s = K(
    () => xu(e, t),
    [e, t]
  );
  C(() => {
    let m = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((d) => {
      m && a(d);
    }), () => {
      m = !1;
    };
  }, [r]), Re(() => {
    const m = n.current;
    if (!m) return;
    const [d, f, p, h] = s.padding, b = Math.max(1, e.rect.width - h - f), w = Math.max(1, e.rect.height - d - p), v = Cu(o, b, w, s);
    let y = Lt.get(v);
    if (y === void 0 && (y = Lu(
      (S) => (m.style.fontSize = `${S}px`, { width: m.scrollWidth, height: m.scrollHeight }),
      b,
      w,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), Lt.set(v, y), Lt.size > Du)) {
      const S = Lt.keys().next().value;
      S !== void 0 && Lt.delete(S);
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
function Ou({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = K(
    () => Mu(e, t, n, r),
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
        wa,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const $u = Vt(Ou);
function zu({
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
        wa,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: Ne(a.highlight.region),
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
const Fu = Vt(zu), Sa = 24, Xe = Sa * 2 + 4, Ue = 24, Bu = 4, ju = 6, it = (e) => e.left + e.width, tt = (e) => e.top + e.height;
function Ct(e, t) {
  const n = Math.min(it(e), it(t)) - Math.max(e.left, t.left), r = Math.min(tt(e), tt(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const qr = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= it(t) && r >= t.top && r <= tt(t);
}, Hu = (e) => e.height > 40 && e.height > e.width * 2.5;
function Uu(e, t, n) {
  if (!t.length || e.height < Ue || e.width < n + 8) return null;
  const r = Math.max(...t.map(tt)), o = it(e) - 4 - n;
  for (const a of [r, tt(e) - 2]) {
    const s = Math.max(e.top, a - Ue), i = { left: o, top: s, width: n, height: Ue };
    if (!t.some((c) => Ct(i, c) > 0)) return s - e.top;
  }
  return null;
}
function Wu(e, t) {
  const n = [], r = (a) => {
    const s = Sa + Bu, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: it(e), top: i, width: s, height: Xe } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: Xe } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - Ue - 3, width: Xe, height: Ue + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: tt(e), width: Xe, height: Ue + 3 } }), r(!0);
  const o = Uu(e, t, Xe);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: it(e) - 4 - Xe, top: e.top + o, width: Xe, height: Ue } }), n;
}
function Ku(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((v) => v.width > 0 && v.height > 0 && !Hu(v)), i = s.filter((v) => qr(v, t)), c = s.filter((v) => !qr(v, t)), l = n.filter((v) => v !== t && Ct(v, t) < t.width * t.height * 0.5), u = Wu(t, i).filter(({ box: v, overhang: y }) => {
    const S = y ? ju : 0;
    return v.left >= -S && it(v) <= r + S && v.top >= 0 && tt(v) <= o;
  }), m = ({ placement: v, tailTop: y }) => y === void 0 ? { placement: v } : { placement: v, tailTop: y }, d = ({ box: v }) => !c.some((y) => Ct(v, y) > 0), f = u.filter((v) => v.placement !== "tail"), p = f.find((v) => d(v) && !l.some((y) => Ct(v.box, y) > 0));
  if (p) return m(p);
  const h = f.find(d) || u.find((v) => v.placement === "tail" && d(v));
  if (h) return m(h);
  let b = null, w = Number.POSITIVE_INFINITY;
  for (const v of u) {
    const y = c.reduce((S, k) => S + Ct(v.box, k), 0);
    y < w && (b = v, w = y);
  }
  return b ? m(b) : { placement: "outside" };
}
function Vu(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - Ue - 3 : tt(r);
  return t >= r.left - 4 && t <= r.left + Xe + 4 && n >= a && n <= a + Ue + 3;
}
const In = (e) => e.left + e.width, Tn = (e) => e.top + e.height;
function qu(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const l of t) {
    if (l.width <= 0 || l.height <= 0) continue;
    const u = l.left + l.width / 2, m = l.top + l.height / 2;
    u < e.left || u > In(e) || m < e.top || m > Tn(e) || (o = Math.min(o, l.left), a = Math.min(a, l.top), s = Math.max(s, In(l)), i = Math.max(i, Tn(l)));
  }
  if (!Number.isFinite(o)) return e;
  const c = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return c.width = Math.min(In(e) + r, s + n) - c.left, c.height = Math.min(Tn(e) + r, i + n) - c.top, c.width * c.height < e.width * e.height * 0.3 && c.height < 24 ? e : c;
}
function Ju(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function Gu(e, t, n, r) {
  const [o, a] = _(null);
  return Re(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? Ju(s) : [], c = Ne(t.highlight.region) === "figure", l = i.length && !c ? qu(t.rect, i) : t.rect, u = n.filter((d) => d.itemId !== t.itemId).map((d) => d.rect), m = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...Ku({ frame: l, others: u, pageWidth: r, pageHeight: m, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
function Xu({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = _(null), [i, c] = _(!1), [l, u] = _([]), [m, d] = _(""), [f, p] = _(""), [h, b] = _(!1), [w, v] = _(null), [y, S] = _([]), k = r.drafts, E = r.generation, x = L(async (I, T) => {
    if (e)
      try {
        u(nu(await e.fetchRevisions(I, T)));
      } catch {
        u([]);
      }
  }, [e]);
  C(() => {
    if (s(null), u([]), v(null), S([]), p(""), !e || !t || !n) return;
    let I = !1;
    return c(!0), e.loadItem(t, n).then((T) => {
      if (I) return;
      const P = T == null ? void 0 : T.item;
      if (!P) throw new Error("找不到这一段的译文。");
      const R = `${(T == null ? void 0 : T.item_id) || n}`, { source: M, translated: z } = eu(P);
      s({ readerItemId: n, itemId: R, source: M, current: z }), d(k.get(n) ?? z);
    }).catch((T) => {
      I || v({ tone: "error", message: (T == null ? void 0 : T.message) || "读取这段译文失败。" });
    }).finally(() => {
      I || c(!1);
    }), x(t, n), () => {
      I = !0;
    };
  }, [e, t, n, x]);
  const $ = L((I) => {
    d(I), n && k.set(n, I);
  }, [n, k]), O = L(async (I, T) => {
    if (!e || !a || h) return !1;
    const P = I ?? m;
    if (!P.trim()) return !1;
    b(!0), v(null), S([]);
    try {
      const R = await e.revise(t, a.itemId, {
        translated_text: P,
        source: "user",
        reason: (T ?? f).trim() || "在阅读页手动修改",
        ...E.current != null ? { expected_generation: E.current } : {}
      }), M = Number(R == null ? void 0 : R.generation);
      return Number.isFinite(M) && (E.current = M), k.delete(a.readerItemId), s({ ...a, current: P }), d(P), p(""), (R == null ? void 0 : R.changed) === !1 ? v({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, P), v({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), x(t, a.readerItemId), !0;
    } catch (R) {
      const M = R;
      return (M == null ? void 0 : M.reason) === "generation_mismatch" && (E.current = null), v({ tone: "error", message: (M == null ? void 0 : M.message) || "保存失败，请稍后再试。" }), S(iu(M == null ? void 0 : M.issues)), !1;
    } finally {
      b(!1);
    }
  }, [e, a, h, m, f, t, o, x, k, E]), A = L(() => {
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
const ka = "reader-inline-edit";
function Zu({ text: e }) {
  const [t, n] = _("");
  return C(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = va(e);
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
function Yu({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var A;
  const s = e.itemId, i = Xu({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = _(!1), [u, m] = _(!1), d = N(null), f = mu(e.rect, t), p = K(() => uu(o), [o]), h = p.indexOf(s), { loaded: b } = i, w = i.saving || i.loading, v = n.blockedReason, y = !b || i.draft === b.current, { close: S, select: k } = n, E = L((I) => {
    const T = p[h + I];
    T && (k(T), a == null || a(T));
  }, [p, h, k, a]), x = L(() => {
    i.discardDraft(), S();
  }, [i, S]), $ = L(async (I, T) => {
    await i.save(I, T) && S();
  }, [i, S]);
  C(() => {
    const I = (T) => {
      !T.altKey || T.key !== "ArrowUp" && T.key !== "ArrowDown" || (T.preventDefault(), E(T.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", I), () => window.removeEventListener("keydown", I);
  }, [E]), Re(() => {
    const I = d.current;
    if (!I) return;
    I.style.height = "auto";
    const T = f.mode === "inline" ? f.minHeight : 0;
    I.style.height = `${Math.max(T, I.scrollHeight + 2)}px`;
  }, [i.draft, b, f.mode, f.mode === "inline" ? f.minHeight : 0]);
  const O = f.mode === "inline" ? { left: f.left, top: f.top, width: f.width } : { left: f.left, width: f.width, top: f.top, bottom: f.bottom };
  return /* @__PURE__ */ D(De, { children: [
    f.mode === "popout" ? /* @__PURE__ */ g("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ D(
      "div",
      {
        className: `${ka} is-${f.mode}`,
        style: O,
        role: "group",
        "aria-label": `改第 ${((A = n.target) == null ? void 0 : A.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": f.mode,
        onPointerDown: (I) => I.stopPropagation(),
        children: [
          r && (b != null && b.source) ? /* @__PURE__ */ g(
            ee,
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
                I.key === "Enter" && (I.metaKey || I.ctrlKey) ? (I.preventDefault(), y || $()) : I.key === "Escape" && (I.preventDefault(), x());
              }
            }
          ) : null,
          b ? /* @__PURE__ */ g(Zu, { text: i.draft }) : null,
          /* @__PURE__ */ D("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ g(at, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => E(-1), children: /* @__PURE__ */ g(Rs, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ g(at, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= p.length - 1, onClick: () => E(1), children: /* @__PURE__ */ g(Ho, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ g(
              qo,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: w || !!v || !b,
                onChange: (I) => i.setReason(I.target.value),
                onKeyDown: (I) => {
                  I.key === "Enter" ? (I.preventDefault(), y || $()) : I.key === "Escape" && (I.preventDefault(), x());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ D(
              ee,
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
            /* @__PURE__ */ g(ee, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: x, children: "取消" }),
            /* @__PURE__ */ g(
              ee,
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
          u && b && i.history.length ? /* @__PURE__ */ g("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((I, T) => {
            const P = I.text === b.current, R = [ru(I.ts), I.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ D("li", { "data-block-edit-history": I.label, "data-current": P ? "true" : void 0, children: [
              /* @__PURE__ */ D("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ D("span", { children: [
                  R,
                  P ? "（现在用的）" : "",
                  I.reason ? ` · ${I.reason}` : ""
                ] }),
                P ? null : /* @__PURE__ */ g(
                  ee,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: w || !!v,
                    onClick: () => {
                      $(I.text, `回到「${R.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ g("p", { className: "reader-inline-edit-history-text", children: I.text })
            ] }, `${I.ts}:${T}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const Ia = qt(null), Ta = qt(null);
function Qu({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ g(Ia.Provider, { value: e, children: /* @__PURE__ */ g(Ta.Provider, { value: t, children: n }) });
}
function qe() {
  return st(Ia);
}
function Ra() {
  return st(Ta);
}
const Ea = 1.414;
function ed({
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
  var fe, ye;
  const y = qe(), S = y == null ? void 0 : y.revisedBlocks, k = y == null ? void 0 : y.blockEdit, E = k == null ? void 0 : k.pendingEdits, x = y == null ? void 0 : y.editBlock, $ = (y == null ? void 0 : y.findTerm) || "", O = r === "translated" ? "translated" : y != null && y.compareVersion ? "compare" : "source", A = y == null ? void 0 : y.textMarks, I = K(
    () => A ? ({ str: j }) => Zl(j, A(j), $) : $ ? ({ str: j }) => Dt(j, $) : void 0,
    [$, A]
  ), T = N(c ?? Ea), [P, R] = _(T.current);
  C(() => {
    c != null && Math.abs(c - T.current) >= 1e-3 && (T.current = c, R(c));
  }, [c]);
  const M = N(u);
  M.current = u;
  const z = N(null), F = N((j) => {
    var Q;
    z.current = j, (Q = M.current) == null || Q.call(M, j);
  }).current, J = N(null), te = N(`${t}@${n}`);
  Re(() => {
    const j = `${t}@${n}`;
    te.current !== j && (te.current = j, o && nd(z.current, J.current));
  }, [o, n, t]), C(() => {
    o || Rn(J.current);
  }, [o]), C(() => () => Rn(J.current), []);
  const Z = Math.max(120, Math.floor(t * P)), re = Math.max(Z, Math.ceil(s || 0)), H = dt(m, t, Z), U = K(
    () => pu(d, t, Z),
    [Z, d, t]
  ), [W, he] = _(null), V = typeof p == "function", q = V ? f ?? null : W, de = (j) => {
    V ? j !== (f ?? null) && (p == null || p(j)) : he((Q) => Q === j ? Q : j);
  }, se = K(
    () => U.find((j) => j.itemId === q) || null,
    [q, U]
  ), le = r === "translated" && ((fe = k == null ? void 0 : k.target) == null ? void 0 : fe.itemId) || "", be = K(
    () => le && U.find((j) => j.itemId === le) || null,
    [le, U]
  ), pe = Gu(z, o ? se : null, U, t), nt = (j) => {
    var Pe, ze, me, we;
    if (j.pointerType === "touch") return;
    if (y != null && y.pointerTaken) {
      de(null);
      return;
    }
    if (j.buttons !== 0) {
      de(null);
      return;
    }
    if ((ze = (Pe = j.target) == null ? void 0 : Pe.closest) != null && ze.call(Pe, `.${ya}`) || (we = (me = j.target) == null ? void 0 : me.closest) != null && we.call(me, `.${ka}`)) return;
    const Q = j.currentTarget.getBoundingClientRect(), ae = j.clientX - Q.left, xe = j.clientY - Q.top;
    if (Vu(pe, ae, xe)) return;
    const Ee = Vr(U, ae, xe);
    de((Ee == null ? void 0 : Ee.itemId) || null);
  }, Ae = (j) => {
    if (j.pointerType === "mouse") return;
    const Q = j.currentTarget.getBoundingClientRect(), ae = Vr(
      U,
      j.clientX - Q.left,
      j.clientY - Q.top
    );
    de((ae == null ? void 0 : ae.itemId) || null);
  }, oe = (j) => {
    !Number.isFinite(j) || j <= 0 || Math.abs(T.current - j) < 1e-3 || (T.current = j, R(j), l == null || l(e, j));
  };
  return /* @__PURE__ */ D(
    "div",
    {
      ref: F,
      [Te]: e,
      [ke]: r,
      [Qn]: Z,
      className: er,
      onPointerMoveCapture: nt,
      onPointerDown: Ae,
      onDoubleClick: (j) => {
        const Q = y == null ? void 0 : y.zoomBlock;
        !Q || y != null && y.pointerTaken || !se || Ne(se.highlight.region) === "figure" && (j.preventDefault(), Q(se.itemId));
      },
      onPointerLeave: (j) => {
        j.pointerType === "mouse" && de(null);
      },
      style: {
        width: t,
        height: re,
        minHeight: re
      },
      children: [
        o ? /* @__PURE__ */ g(
          Xs,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: I,
            renderAnnotationLayer: !1,
            className: Qo,
            loading: /* @__PURE__ */ g(
              "div",
              {
                className: cn,
                style: { width: t, height: Z }
              }
            ),
            onLoadSuccess: (j) => {
              try {
                const Q = j.getViewport({ scale: 1 });
                if (Q.width > 0) {
                  const ae = Q.height / Q.width;
                  oe(ae);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              Rn(J.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ g(
          "div",
          {
            className: cn,
            style: { width: t, height: Z },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ g("div", { ref: J, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        H ? /* @__PURE__ */ g(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": m == null ? void 0 : m.itemId,
            style: H,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && w ? /* @__PURE__ */ g(
          $u,
          {
            layoutPage: h,
            pageState: b,
            width: t,
            height: Z
          }
        ) : null,
        o && w && v ? /* @__PURE__ */ g("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (E != null && E.size) ? /* @__PURE__ */ g(Fu, { targets: U, edits: E, width: t, excludeId: be == null ? void 0 : be.itemId }) : null,
        o && be && k ? /* @__PURE__ */ g(
          Yu,
          {
            target: be,
            page: { width: t, height: Z },
            edit: k,
            showSource: !!(y != null && y.editShowsSource),
            regions: y == null ? void 0 : y.regions,
            jumpToBlock: y == null ? void 0 : y.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (S != null && S.size) ? /* @__PURE__ */ g("div", { className: "reader-revised-markers", "aria-hidden": "true", children: U.filter((j) => S.has(j.itemId)).map((j) => /* @__PURE__ */ g(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": j.itemId,
            style: { left: j.rect.left, top: j.rect.top, height: j.rect.height }
          },
          j.itemId
        )) }) : null,
        (ye = y == null ? void 0 : y.pageLayers) == null ? void 0 : ye.map((j) => /* @__PURE__ */ g(Xn, { children: j.render({ page: e, width: t, height: Z, pane: O, active: o }) }, j.id)),
        /* @__PURE__ */ g(
          Eu,
          {
            target: o && !(y != null && y.pointerTaken) && (se == null ? void 0 : se.itemId) !== (be == null ? void 0 : be.itemId) ? se : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: se && (S == null ? void 0 : S.get(se.itemId)) || 0,
            onEdit: x,
            onZoom: y == null ? void 0 : y.zoomBlock,
            frameRect: pe == null ? void 0 : pe.rect,
            placement: pe == null ? void 0 : pe.placement,
            tailTop: pe == null ? void 0 : pe.tailTop
          }
        )
      ]
    }
  );
}
const td = Vt(ed);
function nd(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function Rn(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const rd = 2 * 1024 * 1024;
function od(e) {
  const t = new Jo.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const En = 5, ad = "120% 0px", sd = 120, id = "25% 0px";
let Jr = 1;
const Gr = /* @__PURE__ */ new WeakMap();
function cd(e) {
  if (!e) return 0;
  const t = Gr.get(e);
  if (t) return t;
  const n = Jr;
  return Jr += 1, Gr.set(e, n), n;
}
function ld() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const ud = Oo(
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
    liveTranslationPendingLabel: x = "",
    paneAction: $
  }, O) {
    $l();
    const { file: A, loading: I, error: T } = Ci(n, r), P = `${n}\0${cd(A)}`, R = N(P);
    R.current = P;
    const M = K(() => {
      const B = _i(A);
      return B ? "ranged" in B ? { range: od(B.ranged) } : B : null;
    }, [A, n]), [z, F] = _(0), [J, te] = _(""), [Z, re] = _(null), [H, U] = _(480), W = N(null), he = N(0), V = K(() => ld(), []), q = K(() => ({
      cMapUrl: jt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: jt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: rd,
      disableAutoFetch: !0
    }), []);
    Zn(O, () => Z, [Z]), C(() => {
      const B = (G) => {
        he.current = G, U(G);
      }, Y = (G) => {
        const ce = rc(G, he.current);
        if (ce !== "ignore") {
          if (W.current && clearTimeout(W.current), ce === "immediate") {
            B(G);
            return;
          }
          W.current = setTimeout(() => B(G), oa);
        }
      }, X = !!(c && c >= 80);
      Y(X ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const ue = !X && i && typeof ResizeObserver < "u" ? new ResizeObserver((G) => {
        var ce, ve;
        Y(((ve = (ce = G[0]) == null ? void 0 : ce.contentRect) == null ? void 0 : ve.width) ?? i.clientWidth);
      }) : null;
      return ue && i && ue.observe(i), () => {
        ue == null || ue.disconnect(), W.current && clearTimeout(W.current);
      };
    }, [c, i, a]);
    const de = K(
      () => ec(H, o),
      [H, o]
    ), [se, le] = _(() => /* @__PURE__ */ new Map()), [be, pe] = _(() => /* @__PURE__ */ new Set()), [nt, Ae] = _(() => /* @__PURE__ */ new Set()), oe = N(/* @__PURE__ */ new Map()), fe = N(null), ye = N(null), [j, Q] = _(() => /* @__PURE__ */ new Set()), ae = N(/* @__PURE__ */ new Map()), xe = L((B, Y) => {
      le((X) => {
        if (X.get(B) === Y) return X;
        const ne = new Map(X);
        return ne.set(B, Y), ne;
      });
    }, []), Ee = L((B, Y) => {
      const X = oe.current, ne = X.get(B), ue = [fe.current, ye.current];
      if (ne)
        for (const G of ue)
          try {
            G == null || G.unobserve(ne);
          } catch {
          }
      if (Y) {
        X.set(B, Y);
        for (const G of ue)
          try {
            G == null || G.observe(Y);
          } catch {
          }
      } else
        X.delete(B);
    }, []), Pe = N(/* @__PURE__ */ new Map()), ze = L((B) => {
      const Y = Pe.current;
      let X = Y.get(B);
      return X || (X = (ne) => Ee(B, ne), Y.set(B, X)), X;
    }, [Ee]);
    C(() => {
      if (typeof IntersectionObserver > "u") return;
      const B = ae.current, Y = new IntersectionObserver(
        (X) => {
          const ne = [], ue = [];
          for (const G of X) {
            const ce = G.target, ve = un(ce);
            Number.isFinite(ve) && (G.isIntersecting ? ne : ue).push(ve);
          }
          if ((ne.length || ue.length) && pe((G) => {
            let ce = null;
            for (const ve of ne)
              G.has(ve) || (ce = ce || new Set(G), ce.add(ve));
            for (const ve of ue)
              G.has(ve) && (ce = ce || new Set(G), ce.delete(ve));
            return ce || G;
          }), ne.length) {
            for (const G of ne) {
              const ce = B.get(G);
              ce && (clearTimeout(ce), B.delete(G));
            }
            Ae((G) => {
              let ce = null;
              for (const ve of ne)
                G.has(ve) || (ce = ce || new Set(G), ce.add(ve));
              return ce || G;
            });
          }
          for (const G of ue)
            B.has(G) || B.set(G, setTimeout(() => {
              B.delete(G), Ae((ce) => {
                if (!ce.has(G)) return ce;
                const ve = new Set(ce);
                return ve.delete(G), ve;
              });
            }, sd));
        },
        { root: i, rootMargin: ad, threshold: 0 }
      );
      fe.current = Y;
      for (const X of oe.current.values())
        try {
          Y.observe(X);
        } catch {
        }
      return () => {
        Y.disconnect(), fe.current === Y && (fe.current = null);
        for (const X of B.values()) clearTimeout(X);
        B.clear();
      };
    }, [i]), C(() => {
      if (typeof IntersectionObserver > "u") return;
      const B = new IntersectionObserver(
        (Y) => {
          Q((X) => {
            let ne = null;
            for (const ue of Y) {
              const G = un(ue.target);
              !Number.isFinite(G) || ue.isIntersecting === X.has(G) || (ne = ne || new Set(X), ue.isIntersecting ? ne.add(G) : ne.delete(G));
            }
            return ne || X;
          });
        },
        { root: i, rootMargin: id, threshold: 0 }
      );
      ye.current = B;
      for (const Y of oe.current.values())
        try {
          B.observe(Y);
        } catch {
        }
      return () => {
        B.disconnect(), ye.current === B && (ye.current = null);
      };
    }, [i]);
    const me = !!i && typeof IntersectionObserver < "u";
    Re(() => {
      F(0), te(""), pe(/* @__PURE__ */ new Set()), Ae(/* @__PURE__ */ new Set()), le(/* @__PURE__ */ new Map()), oe.current.clear();
      const B = ae.current;
      for (const Y of B.values()) clearTimeout(Y);
      B.clear(), h == null || h(0, t);
    }, [P, h, t]);
    const we = L(
      (B) => {
        if (R.current !== P) return;
        const Y = B.numPages;
        F(Y), te(""), h == null || h(Y, t), m == null || m({ numPages: Y, pane: t }), f && typeof B.getPage == "function" && f(B, t), d && typeof B.getOutline == "function" && Ol(B).then((X) => {
          R.current === P && d(X, t);
        }, () => {
        });
      },
      [P, m, d, f, h, t]
    ), Je = L(
      (B) => {
        if (R.current !== P) return;
        const Y = (B == null ? void 0 : B.message) || "PDF 解析失败";
        te(Y), F(0), h == null || h(0, t), p == null || p(B, t);
      },
      [P, p, h, t]
    ), Fe = K(
      () => z > 0 ? Array.from({ length: z }, (B, Y) => Y + 1) : [],
      [z]
    );
    C(() => {
      typeof IntersectionObserver < "u" || Ae(new Set(Fe));
    }, [Fe]);
    const rt = K(
      () => Rt(b, v, t),
      [b, v, t]
    ), pt = K(() => {
      const B = /* @__PURE__ */ new Map();
      for (const Y of w) {
        const X = Rt(Y, v, t);
        if (!X) continue;
        const ne = B.get(X.box.page) || [];
        ne.push(X), B.set(X.box.page, ne);
      }
      return B;
    }, [t, v, w]), gt = K(() => {
      const B = /* @__PURE__ */ new Set();
      if (!y) return B;
      for (const [Y, X] of pt)
        X.some((ne) => ne.itemId === y) && B.add(Y);
      return B;
    }, [y, pt]), Xt = K(() => {
      if (z === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(Fe);
      if (be.size === 0) {
        const X = Math.min(z, En * 2 + 1);
        return new Set(Array.from({ length: X }, (ne, ue) => ue + 1));
      }
      const Y = /* @__PURE__ */ new Set();
      for (const X of be)
        for (let ne = -En; ne <= En; ne++) {
          const ue = X + ne;
          ue >= 1 && ue <= z && Y.add(ue);
        }
      return Y;
    }, [z, Fe, i, a, be]), bt = !n || !!T || !!J, Zt = n && (T || J) || s;
    return /* @__PURE__ */ D(
      "section",
      {
        ref: re,
        className: `reader-panel ${pn}${a ? "" : " is-hidden"}`,
        [ke]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (k == null ? void 0 : k.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          $ ? /* @__PURE__ */ g("div", { className: "reader-react-pdf-pane-action", children: $ }) : null,
          x ? /* @__PURE__ */ D("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ g("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ g("span", { children: x })
          ] }) : null,
          bt && !I ? /* @__PURE__ */ g("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: Zt }) : null,
          I ? /* @__PURE__ */ g("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          M && !T ? /* @__PURE__ */ g("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ g(
            Zs,
            {
              file: M,
              loading: null,
              error: null,
              options: q,
              onLoadSuccess: we,
              onLoadError: Je,
              className: "reader-react-pdf-document",
              children: Fe.map((B) => {
                if (Xt.has(B))
                  return /* @__PURE__ */ g(
                    td,
                    {
                      pane: t,
                      pageNumber: B,
                      width: de,
                      devicePixelRatio: V,
                      active: nt.has(B),
                      textLayer: !me || j.has(B),
                      syncedMinHeight: (l == null ? void 0 : l.get(B)) || 0,
                      onMetrics: u,
                      cachedAspect: se.get(B),
                      onAspectChange: xe,
                      sentinelRef: ze(B),
                      regionHighlight: (rt == null ? void 0 : rt.box.page) === B ? rt : null,
                      regionTargets: pt.get(B),
                      hoveredRegionId: y && gt.has(B) ? y : null,
                      onHoverRegion: S,
                      liveTranslationLayout: k == null ? void 0 : k.layoutByPage.get(B - 1),
                      liveTranslationPage: k == null ? void 0 : k.pagesByPage.get(B - 1),
                      showLiveTranslation: E,
                      liveTranslationMissing: sl(k, B - 1)
                    },
                    `${t}-${B}`
                  );
                const X = se.get(B) ?? Ea, ne = Math.max(120, Math.floor(de * X)), ue = Math.max(ne, Math.ceil((l == null ? void 0 : l.get(B)) || 0));
                return /* @__PURE__ */ g(
                  "div",
                  {
                    ref: ze(B),
                    [Te]: B,
                    [ke]: t,
                    [Qn]: ne,
                    className: `${er} is-placeholder`,
                    style: {
                      width: de,
                      height: ue,
                      minHeight: ue
                    },
                    children: /* @__PURE__ */ g(
                      "div",
                      {
                        className: cn,
                        style: { width: de, height: ne },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${B}`
                );
              })
            },
            P
          ) }) : null
        ]
      }
    );
  }
), Xr = Vt(ud), dd = 2e3, fd = 6, md = 500, Zr = "reader-react-resizing";
function hd(e, t) {
  const n = N(null), r = N(null);
  Re(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const S = pd(e), k = zt(e, S);
      if (!k) return;
      s = { pane: S, progress: k, started: performance.now() };
    }
    const { pane: i, progress: c, started: l } = s;
    let u = 0, m = null, d = e.scrollHeight, f = d, p = 0, h = l;
    const b = /* @__PURE__ */ new WeakMap(), w = typeof ResizeObserver > "u" ? null : new ResizeObserver((S) => {
      let k = !1;
      for (const E of S) {
        const x = Math.round(E.contentRect.height);
        b.has(E.target) && b.get(E.target) !== x && (k = !0), b.set(E.target, x);
      }
      k && Et(e, c, "auto", i);
    }), v = () => {
      var S;
      m && clearTimeout(m), cancelAnimationFrame(u), w == null || w.disconnect(), e.classList.remove(Zr);
      for (const k of Yr) e.removeEventListener(k, v);
      ((S = r.current) == null ? void 0 : S.stop) === v && (r.current = null);
    }, y = () => {
      Et(e, c, "auto", i);
      const S = e.scrollHeight;
      p = S === f ? p + 1 : 0, f = S;
      const k = performance.now() - h;
      p >= fd && (S !== d || k > md) || k > dd ? v() : u = requestAnimationFrame(y);
    };
    for (const S of Yr) e.addEventListener(S, v, { passive: !0 });
    for (const S of Array.from(e.children)) w == null || w.observe(S);
    e.classList.add(Zr), r.current = { ...s, stop: v }, m = setTimeout(() => {
      m = null, h = performance.now(), d = e.scrollHeight, f = d, p = 0, u = requestAnimationFrame(y);
    }, oa);
  }, [e, t]), C(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function pd(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Te}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(ke) || null;
  }
  return null;
}
const Yr = ["wheel", "touchstart", "keydown", "pointerdown"];
function gd(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function bd(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(pn)) && ((n = e.hasAttribute) != null && n.call(e, ke)));
}
function yd(e, t) {
  C(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!bd(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${pn}[${ke}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const c = gd(a, i);
        if (c === null || Math.abs(i.scrollLeft - c) < 1) continue;
        const l = i.scrollLeft;
        i.scrollLeft = c, Math.abs(i.scrollLeft - l) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function vd(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), c = t - i, l = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: c * l };
}
function wd(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const Qr = 12;
function ar(e) {
  return Array.from(e.querySelectorAll(`.${pn}[${ke}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function Sd(e) {
  const t = e.getBoundingClientRect();
  return ar(e).map((n) => {
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
function kd(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function Id(e, t) {
  return e ? ar(e).find((n) => n.getAttribute(ke) === t) ?? null : null;
}
function Td({ shellEl: e }) {
  const [t, n] = _([]), r = N(0), o = L(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = Sd(e);
      n((i) => kd(i, s) ? i : s);
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
  return a.length ? /* @__PURE__ */ g("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ g(Rd, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function Rd({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - Qr * 2), r = vd(e, n), o = N(null);
  if (!r) return null;
  const a = (d) => {
    const f = Id(t, e.pane);
    f && (f.scrollLeft = d);
  }, s = (d) => {
    var f, p;
    d.button === 0 && (d.preventDefault(), d.stopPropagation(), (p = (f = d.currentTarget).setPointerCapture) == null || p.call(f, d.pointerId), o.current = { startX: d.clientX, startScroll: e.scrollLeft, pointerId: d.pointerId });
  }, i = (d) => {
    const f = o.current;
    !f || f.pointerId !== d.pointerId || a(f.startScroll + wd(e, n, r.size, d.clientX - f.startX));
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
      style: { left: e.left + Qr, width: n },
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
function Pa(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Ed(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function Pd({ compare: e, onDone: t }) {
  return /* @__PURE__ */ D("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ g("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ g("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ g("li", { children: /* @__PURE__ */ D(
        ee,
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
            /* @__PURE__ */ g("span", { className: "reader-version-compare-time", children: Pa(n.createdAt) }),
            r ? /* @__PURE__ */ g("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ g(jo, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ g(Ps, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ g("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ D("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ D(
        ee,
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
        ee,
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
function eo({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = Ed(t), a = [e === "compare" ? "对比" : "正在读", r, Pa(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ D("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ g("em", { children: "RetainPDF" }),
    /* @__PURE__ */ g("strong", { children: o }),
    /* @__PURE__ */ g("span", { children: a })
  ] });
}
function Md({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = _({ source: null, translated: null });
  return Re(() => {
    if (!e) return;
    const a = () => {
      const i = e.getBoundingClientRect(), c = (l) => {
        const u = e.querySelector(`[${ke}="${l}"]`), m = u == null ? void 0 : u.getBoundingClientRect();
        return m && m.width > 0 ? { x: Math.round(m.left + m.width / 2), top: Math.round(i.top + 14) } : null;
      };
      o({ source: c("source"), translated: c("translated") });
    };
    a();
    const s = typeof ResizeObserver > "u" ? null : new ResizeObserver(a);
    return s == null || s.observe(e), e.querySelectorAll(`[${ke}]`).forEach((i) => s == null ? void 0 : s.observe(i)), window.addEventListener("resize", a), e.addEventListener("scroll", a, { passive: !0 }), () => {
      s == null || s.disconnect(), window.removeEventListener("resize", a), e.removeEventListener("scroll", a);
    };
  }, [e]), /* @__PURE__ */ D("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ g("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ g(eo, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ g("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ g(eo, { role: "reading", ...n }) }) : null
  ] });
}
const _d = () => () => {
}, to = () => null;
function Nd({
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
function Ad(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function xd(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Ld(e) {
  const t = qe(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, m = e.bindShell ?? (t == null ? void 0 : t.bindShell), d = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, f = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Jt, p = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), b = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, w = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, v = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, y = (t == null ? void 0 : t.compareVersion) ?? null, S = (y == null ? void 0 : y.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", k = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", E = y ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, x = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, $ = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), O = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), A = t == null ? void 0 : t.onPdfOutline, I = t == null ? void 0 : t.onPdfDocument, T = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), P = e.regions ?? (t == null ? void 0 : t.regions) ?? [], R = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), M = (t == null ? void 0 : t.regionHover) ?? null, [z, F] = _(null), J = hn(
    M ? M.subscribe : _d,
    M ? () => M.get().itemId : to,
    M ? () => M.get().itemId : to
  ), te = M ? J : z, Z = L((W) => {
    M ? M.set(W, "pdf") : F(W);
  }, [M]), re = Nd({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), U = Number.isFinite(p) && p > 0 ? Ad(
    p,
    n || r,
    typeof document > "u" ? p * 2 : document.documentElement.clientWidth
  ) : null;
  return hd(d, U), yd(d, re.compareMode), /* @__PURE__ */ D(
    "div",
    {
      ref: m,
      className: Yo,
      "data-reader-region-count": P.length,
      "data-reader-structured-region-count": P.filter(ys).length,
      "data-reader-metadata-ready": R ? "true" : "false",
      children: [
        /* @__PURE__ */ D(
          "main",
          {
            className: `${Zo} reader-mode-${re.mode}`,
            "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              b ? /* @__PURE__ */ g(
                Xr,
                {
                  pane: "source",
                  url: S,
                  preloadedFile: E,
                  userZoom: f,
                  visible: re.showSource,
                  scrollRoot: d,
                  pageWidthOverride: U,
                  rowHeights: re.compareMode ? h : void 0,
                  onMetrics: $,
                  emptyLabel: v ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: O,
                  onOutline: y ? void 0 : A,
                  onDocument: y ? void 0 : I,
                  activeRegion: T,
                  regions: (y == null ? void 0 : y.regions) ?? P,
                  readerMetadata: R,
                  hoveredRegionId: te,
                  onHoverRegion: Z,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? xd(o) : "",
                  paneAction: u && re.showTranslated ? /* @__PURE__ */ D(De, { children: [
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
                Xr,
                {
                  pane: "translated",
                  url: k,
                  preloadedFile: x,
                  userZoom: f,
                  visible: re.showTranslated,
                  scrollRoot: d,
                  pageWidthOverride: U,
                  rowHeights: re.compareMode ? h : void 0,
                  onMetrics: $,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: O,
                  onOutline: A,
                  onDocument: I,
                  activeRegion: T,
                  regions: P,
                  readerMetadata: R,
                  hoveredRegionId: te,
                  onHoverRegion: Z,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ g(Td, { shellEl: d }),
        y ? /* @__PURE__ */ g(Md, { shellEl: d, left: y.left, right: y.right }) : null
      ]
    }
  );
}
const Dd = [
  { id: "source", label: "原文", Icon: Uo },
  { id: "compare", label: "对照", Icon: Wo },
  { id: "translated", label: "译文", Icon: Ko }
];
function Cd(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function Od(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function $d(e) {
  const t = qe(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? Cd(a.state) : "";
  return /* @__PURE__ */ D("header", { className: "reader-workspace-bar", children: [
    /* @__PURE__ */ g("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
    /* @__PURE__ */ g("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
    /* @__PURE__ */ D("div", { className: "reader-workspace-center", children: [
      /* @__PURE__ */ g("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Dd.map(({ id: l, label: u, Icon: m }) => {
        const d = n === l, f = Od({
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
          ee,
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
        ee,
        {
          className: "reader-live-translation-toggle is-done",
          title: "翻译完成，左右对照看最终译文",
          onClick: s.onOpenCompare,
          children: [
            /* @__PURE__ */ g(xs, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ g("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
          ]
        }
      ) }) : null
    ] })
  ] });
}
const Ma = [];
function zd() {
  const e = /* @__PURE__ */ new Map(), t = /* @__PURE__ */ new Set();
  let n = Ma;
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
function Fd(e, t) {
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
function Bd(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.pageLayer ? [{ id: t, render: n.pageLayer }] : []);
}
function jd(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.menuSection ? [{ id: t, render: n.menuSection }] : []);
}
function Hd(e) {
  var t;
  return ((t = e.find(({ contribution: n }) => n.takesPointer)) == null ? void 0 : t.id) ?? null;
}
function Ud(e) {
  const t = e.flatMap(({ id: n, contribution: r }) => r.textMarks ? [{ id: n, marks: r.textMarks }] : []);
  return t.length ? (n) => t.flatMap(({ id: r, marks: o }) => {
    try {
      return [...o(n)];
    } catch (a) {
      return console.error(`[reader] 扩展 ${r} 的文字层标记出错`, a), [];
    }
  }) : null;
}
function Wd(e) {
  for (const { contribution: t } of e) if (t.comparedDocument) return t.comparedDocument;
  return null;
}
function Kd(e) {
  return e.flatMap(({ title: t, contribution: n }) => {
    var r;
    return (r = n.shortcuts) != null && r.length ? [{ title: t, items: n.shortcuts }] : [];
  });
}
const bn = qt(null), _a = qt(null);
function Vd({ api: e, store: t, children: n }) {
  const r = K(() => ({ api: e, store: t }), [e, t]);
  return /* @__PURE__ */ g(bn.Provider, { value: r, children: n });
}
function Gt() {
  const e = st(bn);
  if (!e) throw new Error("useReaderApi 要在 ReaderExtensionsProvider 里面用");
  return e.api;
}
const qd = () => () => {
}, no = () => Ma;
function Jd(e) {
  return hn(e.subscribe, e.getSnapshot, e.getSnapshot);
}
function Na() {
  var t;
  const e = (t = st(bn)) == null ? void 0 : t.store;
  return hn((e == null ? void 0 : e.subscribe) ?? qd, (e == null ? void 0 : e.getSnapshot) ?? no, (e == null ? void 0 : e.getSnapshot) ?? no);
}
function yn(e) {
  var a;
  const t = (a = st(bn)) == null ? void 0 : a.store, n = st(_a);
  if (!n) throw new Error("useReaderContribution 只能在扩展组件里用");
  const { id: r, title: o } = n;
  C(() => {
    t == null || t.set(r, o, e);
  }, [t, r, o, e]), C(() => () => t == null ? void 0 : t.remove(r), [t, r]);
}
class Gd extends is {
  constructor() {
    super(...arguments);
    Ir(this, "state", { failed: !1 });
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
const Xd = Vt(function({ extensions: t }) {
  return /* @__PURE__ */ g(De, { children: t.map(({ id: n, title: r, Component: o }) => /* @__PURE__ */ g(Gd, { id: n, children: /* @__PURE__ */ g(Zd, { id: n, title: r, children: /* @__PURE__ */ g(o, {}) }) }, n)) });
});
function Zd({ id: e, title: t, children: n }) {
  const r = K(() => ({ id: e, title: t }), [e, t]);
  return /* @__PURE__ */ g(_a.Provider, { value: r, children: n });
}
function Yd({
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
      ee,
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
const Qd = 4e3;
function ef(e, t, n) {
  if (e.length) {
    const o = ga(e, n), a = o ? pa(e).find((s) => s.id === o) : null;
    if (a) return a.title;
  }
  let r = null;
  for (const o of t)
    !o.headingLevel || o.source.page > n || (!r || o.source.page >= r.source.page) && (r = o);
  return `${(r == null ? void 0 : r.source.text) || (r == null ? void 0 : r.markdown) || ""}`.replace(/\s+/g, " ").trim().slice(0, 80);
}
function ro(e) {
  var a, s;
  if (!e || e.isCollapsed || !e.rangeCount) return { text: "", element: null, rect: null };
  const t = e.getRangeAt(0), n = t.startContainer, r = ((s = (a = n.nodeType === 1 ? n : n.parentElement) == null ? void 0 : a.closest) == null ? void 0 : s.call(a, `[${Te}]`)) ?? null;
  return r ? { text: `${e}`.replace(/\s+\n/g, `
`).trim().slice(0, Qd), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function tf(e, t, n, r, o) {
  let a = null, s = 0.15;
  for (const i of e) {
    const c = Rt(i, t, n);
    if (!c || c.box.page !== r) continue;
    const l = dt(c, 1, 1);
    if (!l) continue;
    const u = o.y < l.top ? l.top - o.y : o.y > l.top + l.height ? o.y - l.top - l.height : 0, m = o.x < l.left ? l.left - o.x : o.x > l.left + l.width ? o.x - l.left - l.width : 0, d = u + m * 0.25;
    (d < s || d === 0 && a === null) && (a = i, s = d);
  }
  return a;
}
function nf({
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
  const l = e.getAttribute(ke) === "source" ? "source" : "translated", u = e.getBoundingClientRect(), m = u.width > 0 && u.height > 0 ? { x: Math.min(1, Math.max(0, (t - u.left) / u.width)), y: Math.min(1, Math.max(0, (n - u.top) / u.height)) } : null, f = (r ? a.find((p) => p.itemId === r) ?? null : null) ?? (m ? tf(a, i, l, c, m) : null);
  return {
    pane: l,
    page: c,
    itemId: (f == null ? void 0 : f.itemId) ?? null,
    selection: o,
    sourceText: `${(f == null ? void 0 : f.source.text) || (f == null ? void 0 : f.markdown) || ""}`.trim(),
    translatedText: `${(f == null ? void 0 : f.translatedBlockText) || (f == null ? void 0 : f.translated.text) || ""}`.trim(),
    section: ef(s, a, (f == null ? void 0 : f.source.page) ?? c),
    point: m
  };
}
const oo = 5e4, rf = 2e4;
function Pn(e, t) {
  const n = `${e || ""}`;
  return n.length > t ? n.slice(0, t) : n;
}
function rg(e, t) {
  const n = { page: e.page, pane: e.pane, item_ids: e.itemId ? [e.itemId] : [] };
  return t.documentId && (n.document_id = t.documentId), t.jobId && (n.job_id = t.jobId), t.versionId && (n.translation_version = t.versionId), e.selection && (n.selected_text = e.selection), e.section && (n.section = e.section), e.sourceText && (n.source_text = e.sourceText), e.translatedText && (n.translated_text = e.translatedText), n;
}
function of(e, t = null) {
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
function af(e, t) {
  if (!(e != null && e.page)) return null;
  const r = [!!(e.document_id && t && e.document_id !== t) ? "别的书" : "", `第 ${e.page} 页`, e.section || ""].filter(Boolean).join(" · ");
  return { page: e.page, label: r, data: e };
}
function sf(e, t) {
  var o;
  if (!t) return;
  const n = e.findIndex((a) => a.message_id === t);
  if (n < 0) return;
  const r = ((o = e[n + 1]) == null ? void 0 : o.role) === "assistant" ? cf(e[n + 1].text) : "";
  return { question: e[n].text, ...r ? { answer: r } : {} };
}
function cf(e, t = 160) {
  const n = e.replace(/```[\s\S]*?(```|$)/g, " ").replace(/\$\$[\s\S]*?\$\$/g, " … ").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim(), r = [...n];
  return r.length > t ? `${r.slice(0, t).join("")}…` : n;
}
function lf(e, t = [], n = "") {
  const r = new Set(t.map((o) => o.covers_to_seq));
  return e.filter((o) => !o.superseded_at).map((o) => {
    const a = r.has(o.seq) ? { compactedBefore: !0 } : {};
    if (o.role === "user") {
      const s = sf(e, o.edited_from);
      return {
        id: o.message_id,
        role: "user",
        text: o.text,
        context: af(o.selection, n),
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
function uf(e, t, n, r) {
  var l, u, m;
  const o = ((m = (u = (l = e.context) == null ? void 0 : l.meta) == null ? void 0 : u.retainpdf) == null ? void 0 : m.selection) ?? null, a = (o == null ? void 0 : o.document_id) || t || null, s = e.sessionId && e.sessionId.length <= 256 ? e.sessionId : null, i = { agent_id: e.agentId || null, document_id: a, session_id: s }, c = e.answer.usage && JSON.stringify(e.answer.usage).length <= 4096 ? e.answer.usage : null;
  return [
    { ...i, role: "user", text: Pn(e.question.text, oo), selection: o, client_message_id: `${n}-q`, ...r ? { edited_from: r } : {} },
    {
      ...i,
      role: "assistant",
      text: Pn(e.answer.text, oo),
      thought: e.answer.thought ? Pn(e.answer.thought, rf) : null,
      usage: c,
      client_message_id: `${n}-a`,
      memory_ids: e.memoryIds.slice(0, 10)
    }
  ];
}
function df(e) {
  return new Date(e - 2e3).toISOString().replace(/\.\d+Z$/, "Z");
}
function ff(e, t) {
  return e.filter((n) => n.origin === "agent" && n.status === "active" && !t.has(n.memory_id)).map((n) => ({ id: n.memory_id, scope: n.scope, text: n.text, category: n.category, documentId: n.document_id, created: !0 }));
}
function mf(e, t) {
  if (t.id && e.some((r) => r.message_id === t.id)) return t.id;
  const n = t.text.trim();
  for (let r = e.length - 1; r >= 0; r -= 1) {
    const o = e[r];
    if (o.role === "assistant" && o.text.trim() === n) return o.message_id;
  }
  return null;
}
function hf(e) {
  const t = e.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().split(new RegExp("(?<=[。！？.!?])"))[0] || "";
  return `深挖：${[...t].slice(0, 30).join("")}${[...t].length > 30 ? "…" : ""}`;
}
const pf = 50, Mn = { conversation: null, main: null, records: [], compactions: [], hasMore: !1, key: "local", initial: [] };
function gf() {
  var t, n;
  return `c-${((n = (t = globalThis.crypto) == null ? void 0 : t.randomUUID) == null ? void 0 : n.call(t)) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}
function ao(e) {
  var n, r, o, a;
  const t = e;
  return `${(t == null ? void 0 : t.reason) || ((n = t == null ? void 0 : t.details) == null ? void 0 : n.reason) || ((a = (o = (r = t == null ? void 0 : t.payload) == null ? void 0 : r.error) == null ? void 0 : o.details) == null ? void 0 : a.reason) || (e instanceof Error ? e.message : "")}`;
}
function bf({ port: e, book: t, onAppended: n }) {
  const r = (e == null ? void 0 : e.conversations) ?? null, o = (e == null ? void 0 : e.memories) ?? null, [a, s] = _(!1), [i, c] = _(Mn), [l, u] = _(!1), [m, d] = _(""), [f, p] = _("idle"), [h, b] = _(null), [w, v] = _(() => /* @__PURE__ */ new Map()), y = N(/* @__PURE__ */ new Set()), S = N(/* @__PURE__ */ new Map()), k = (H) => {
    if (!H) return null;
    const U = S.current.get(H);
    return U || (E.current.records.some((W) => W.message_id === H) ? H : null);
  }, E = N(i);
  E.current = i;
  const x = N(t);
  x.current = t;
  const $ = N(0), O = L(async (H, U, W, he = []) => {
    if (!r) return;
    const V = await r.messages(H.conversation_id, { limit: pf, ...W ? { beforeSeq: W } : {} }), q = [...V.messages, ...he];
    $.current += 1, c({
      conversation: H,
      main: U ?? H,
      records: q,
      compactions: V.compactions || [],
      hasMore: V.has_more,
      key: `${H.conversation_id}:${$.current}`,
      initial: lf(q, V.compactions || [], x.current.documentId)
    });
  }, [r]), A = L(async () => {
    var H;
    if (s(!0), !(!r || ((H = E.current.conversation) == null ? void 0 : H.kind) === "main")) {
      u(!0), d("");
      try {
        const U = await r.main(x.current.documentId || void 0);
        await O(U, U);
      } catch (U) {
        d(U instanceof Error ? U.message : String(U));
      } finally {
        u(!1);
      }
    }
  }, [r, O]), I = L((H) => {
    b(H), A();
  }, [A]), T = N(t.documentId);
  C(() => {
    T.current !== t.documentId && (T.current = t.documentId, E.current = Mn, c(Mn), b(null), v(/* @__PURE__ */ new Map()), S.current.clear(), a && A());
  }, [t.documentId, a, A]);
  const P = L(async () => {
    const H = E.current, U = H.records[0];
    if (!(!H.conversation || !U || !H.hasMore)) {
      u(!0);
      try {
        await O(H.conversation, H.main, U.seq, H.records);
      } finally {
        u(!1);
      }
    }
  }, [O]), R = L(async (H) => {
    const W = E.current.conversation;
    if (!r || !W) return;
    for (const le of H.memoryIds) y.current.add(le);
    let he = H.memoryIds;
    if (!he.length && o && H.startedAt) {
      const le = ff(
        await o.list({ source_conversation_id: W.conversation_id, created_after: df(H.startedAt) }).catch(() => []),
        y.current
      );
      for (const pe of le) y.current.add(pe.id);
      he = le.map((pe) => pe.id);
      const be = H.answerId;
      le.length && be && v((pe) => new Map(pe).set(be, le));
    }
    const V = uf({ ...H, memoryIds: he }, x.current.documentId, gf(), k(H.editedFrom));
    let q;
    try {
      q = await r.append(W.conversation_id, V);
    } catch (le) {
      if (W.kind !== "side" || !/ask_conversation_not_open/.test(ao(le))) throw le;
      await r.reopen(W.conversation_id), q = await r.append(W.conversation_id, V);
    }
    const [de, se] = q.messages;
    H.questionId && de && S.current.set(H.questionId, de.message_id), H.answerId && se && S.current.set(H.answerId, se.message_id), c((le) => {
      var be;
      return ((be = le.conversation) == null ? void 0 : be.conversation_id) === W.conversation_id ? { ...le, conversation: q.conversation, records: [...le.records, ...q.messages] } : le;
    }), n == null || n(q.messages), q.compaction_due && W.kind === "main" && r.compact(W.conversation_id).catch(() => {
    });
  }, [r, o, n]), M = L(async (H) => {
    const U = E.current.conversation, W = k(H);
    if (!r || !U || !W) return null;
    try {
      await r.supersede(U.conversation_id, W);
    } catch (q) {
      if (!/ask_message_superseded/.test(ao(q))) throw q;
    }
    const he = E.current.records.find((q) => q.message_id === W), V = E.current.records.findIndex((q) => q.message_id === W);
    return c((q) => ({ ...q, records: q.records.map((de, se) => se >= V && V >= 0 && !de.superseded_at ? { ...de, superseded_at: "now" } : de) })), (he == null ? void 0 : he.selection) ?? null;
  }, [r]), z = L((H) => {
    R(H).catch((U) => d(`这一轮没存上：${U instanceof Error ? U.message : String(U)}`));
  }, [R]), F = L(async (H) => {
    var he;
    const U = E.current, W = U.main;
    if (!(!r || !W || ((he = U.conversation) == null ? void 0 : he.kind) !== "main")) {
      d("");
      try {
        const V = mf(U.records, H), q = await r.fork({
          parent_id: W.conversation_id,
          ...V ? { forked_from_message_id: V } : {},
          title: hf(H.text),
          ...x.current.documentId ? { document_id: x.current.documentId } : {}
        });
        await O(q, W);
      } catch (V) {
        d(`开不了副对话：${V instanceof Error ? V.message : String(V)}`);
      }
    }
  }, [r, O]), J = L(async (H) => {
    const U = E.current.main;
    if (r)
      try {
        await O(await r.get(H), U);
      } catch (W) {
        d(`打不开副对话：${W instanceof Error ? W.message : String(W)}`);
      }
  }, [r, O]), te = L(async () => {
    const H = E.current.main;
    H && await O(H, H).catch(() => {
    });
  }, [O]), Z = L(async () => {
    const H = E.current.conversation;
    if (!(!r || (H == null ? void 0 : H.kind) !== "side")) {
      p("busy");
      try {
        await r.close(H.conversation_id), p("idle"), await te();
      } catch {
        p("failed");
      }
    }
  }, [r, te]), re = L(async () => {
    const H = E.current.main;
    if (!r || !H) return;
    await r.archive(H.conversation_id);
    const U = await r.main(x.current.documentId || void 0);
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
    close: L(() => s(!1), []),
    loadEarlier: P,
    onTurn: z,
    rewrite: M,
    fork: F,
    openSide: J,
    backToMain: te,
    closeSide: Z,
    archiveMain: re,
    forgetMemory: r ? r.forgetMemory : void 0
  };
}
function so(e, t, n) {
  var c;
  const r = e.selection, o = e.page ?? (r == null ? void 0 : r.page) ?? 0;
  if (e.role !== "user" || !o) return null;
  const a = (e.pane ?? (r == null ? void 0 : r.pane)) === "source" ? "source" : "translated", s = ((c = r == null ? void 0 : r.item_ids) == null ? void 0 : c[0]) ?? null, i = of({ item_ids: [], ...r, page: o, pane: a }, n(s, a, o));
  return { key: t, anchor: i, messageId: e.message_id, title: e.text.slice(0, 80) };
}
function yf({ port: e, documentId: t, resetKey: n, pointOf: r }) {
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
      (h) => d(h.map((b) => so(b, c(), i.current)).filter((b) => !!b)),
      () => {
      }
    ), () => {
      m = !0;
    };
  }, [e, t, n]);
  const l = L((m) => {
    const d = m.filter((f) => !f.document_id || f.document_id === t).map((f) => so(f, c(), i.current)).filter((f) => !!f);
    d.length && a((f) => [...f.filter((p) => !d.some((h) => h.messageId === p.messageId)), ...d]);
  }, [t]), u = L((m) => a((d) => d.filter((f) => f.key !== m)), []);
  return { marks: o, addRecords: l, removeMark: u };
}
const vf = zo(() => import("./ReaderAskPanel-ChZxShcE.js"));
function wf({
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
  const m = K(() => ({ documentId: t, jobId: n, versionId: r }), [t, n, r]), d = L((R, M, z) => {
    const F = R ? o.find((Z) => Z.itemId === R) : null, J = F ? Rt(F, a, M) : null, te = J && J.box.page === z ? dt(J, 1, 1) : null;
    return te ? { x: te.left, y: te.top } : null;
  }, [o, a]), f = yf({ port: e, documentId: t, resetKey: c, pointOf: d }), p = bf({ port: e, book: m, onAppended: f.addRecords }), [h, b] = _(null), w = L(
    (R, M, z, F) => nf({
      pageElement: (R == null ? void 0 : R.closest(`[${Te}]`)) ?? null,
      clientX: M,
      clientY: z,
      itemId: i(),
      selection: F,
      regions: o,
      bookmarks: s,
      metadata: a
    }),
    [i, o, s, a]
  ), v = L(() => {
    var M;
    const R = ro(((M = globalThis.getSelection) == null ? void 0 : M.call(globalThis)) ?? null);
    return !R.text || !R.element || !R.rect ? null : w(R.element, R.rect.left + R.rect.width / 2, R.rect.top + R.rect.height / 2, R.text);
  }, [w]), y = L((R) => {
    b(null), p.ask(R);
  }, [p.ask]);
  C(() => {
    if (!e) return;
    const R = (M) => {
      var J;
      if (M.key !== "?" || M.metaKey || M.ctrlKey || M.altKey || M.defaultPrevented) return;
      const z = M.target;
      if ((J = z == null ? void 0 : z.closest) != null && J.call(z, "input, textarea, select, [contenteditable='true']")) return;
      const F = v();
      F && (M.preventDefault(), M.stopImmediatePropagation(), y(F));
    };
    return window.addEventListener("keydown", R, !0), () => window.removeEventListener("keydown", R, !0);
  }, [e, v, y]);
  const S = N(""), k = ((P = p.pending) == null ? void 0 : P.selection) || "";
  C(() => {
    k && (S.current = k);
  }, [k]);
  const E = p.visible && !h, x = p.setPending;
  C(() => {
    if (!E) return;
    let R = null;
    const M = () => {
      R && clearTimeout(R), R = setTimeout(() => {
        const z = v();
        z && z.selection !== S.current && x(z);
      }, 250);
    };
    return document.addEventListener("selectionchange", M), () => {
      R && clearTimeout(R), document.removeEventListener("selectionchange", M);
    };
  }, [E, v, x]);
  const $ = L(async (R) => {
    if (R.threadId && (e != null && e.threads) && t) {
      try {
        const M = await e.threads.get(t, R.threadId);
        b({ anchor: M.anchor || R.anchor, messages: M.messages || [], mark: R });
      } catch {
        b({ anchor: R.anchor, messages: [], mark: R });
      }
      return;
    }
    b(null), p.openMain();
  }, [e, t, p.openMain]), O = L((R) => {
    var F;
    if (!e) return [];
    const M = ro(((F = globalThis.getSelection) == null ? void 0 : F.call(globalThis)) ?? null), z = w(R.target, R.clientX, R.clientY, M.element ? M.text : "");
    return z ? [{
      key: "ask",
      label: z.selection ? "问这段" : "在这里提问",
      hint: z.selection ? "?" : void 0,
      onSelect: () => y(z)
    }] : [];
  }, [e, w, y]), A = h ? {
    anchor: h.anchor,
    messages: h.messages,
    onClose: () => b(null),
    onDelete: e != null && e.threads && h.mark.threadId ? () => {
      e.threads.remove(t, h.mark.threadId).catch(() => {
      }), f.removeMark(h.mark.key), b(null);
    } : void 0
  } : null, I = !p.persistent || !!p.view.conversation || !!p.error, T = e && (p.visible && I || h) ? /* @__PURE__ */ g($o, { fallback: null, children: /* @__PURE__ */ g(
    vf,
    {
      port: e,
      jobId: n,
      book: m,
      ask: p,
      legacy: A,
      onShowSelection: ({ page: R, pane: M }) => l(R, M),
      onJumpToPage: (R) => l(R),
      pageCount: u
    }
  ) }) : null;
  return { marks: f.marks, onMark: $, menuItems: O, panel: T, open: p.openMain, enabled: !!e };
}
const Sf = [{ keys: "选字 + ?", desc: "问选中的这段" }];
function kf() {
  const e = Gt(), t = K(() => {
    try {
      return Ve().ask ?? null;
    } catch {
      return null;
    }
  }, []), n = wf({
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
  }), { marks: r, onMark: o, menuItems: a, panel: s, enabled: i } = n, c = K(() => i ? {
    menuItems: a,
    pageLayer: r.length ? ({ page: l, height: u }) => /* @__PURE__ */ g(Yd, { marks: r, page: l, height: u, onOpen: o }) : void 0,
    shortcuts: Sf
  } : {}, [i, a, r, o]);
  return yn(c), s;
}
const If = { id: "ask", title: "提问", Component: kf };
function jn() {
  try {
    return Ve().translationVersions ?? null;
  } catch {
    return null;
  }
}
function Tf(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function Rf(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function Ef(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function Pf({ documentId: e, jobId: t }) {
  const [n, r] = _([]), [o, a] = _(null);
  C(() => {
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
  const s = Rf(n, t, o);
  return K(() => ({ versions: n, readingVersionId: s }), [n, s]);
}
function Mf({ documentId: e, jobId: t, versions: n, readingVersionId: r }) {
  const [o, a] = _(null), [s, i] = _(""), [c, l] = _(""), u = N(0);
  C(() => {
    u.current += 1, a(null), i(""), l("");
  }, [e, t]);
  const m = L((p) => {
    const h = jn(), b = n.find((v) => v.versionId === p);
    if (!h || !b || !e) return;
    const w = ++u.current;
    i(p), l(""), (async () => {
      const v = Ve(), y = await h.resolveJob(e, p);
      if (!y) throw new Error("这一份还没有能读的译文。");
      const S = await v.loadReaderPayload(y, { includeOptionalArtifacts: !0 }), k = v.resolveReaderTranslatedPdfUrl(S.jobPayload, S.manifestPayload);
      if (!k) throw new Error("这一份没有译文 PDF。");
      return { versionId: p, name: b.name, jobId: y, url: k, regions: Tf(Bo(S.regionsPayload)) };
    })().then((v) => {
      w === u.current && a(v);
    }).catch((v) => {
      w === u.current && l((v == null ? void 0 : v.message) || "这一份打不开。");
    }).finally(() => {
      w === u.current && i("");
    });
  }, [e, n]), d = L(() => {
    u.current += 1, a(null), i(""), l("");
  }, []), f = L(async () => {
    var b, w;
    const p = jn();
    if (!p || !o || !e) return;
    try {
      await p.select(e, o.versionId);
    } catch (v) {
      l((v == null ? void 0 : v.message) || "换不过去，请稍后再试。");
      return;
    }
    const h = (b = globalThis.location) == null ? void 0 : b.href;
    h && ((w = globalThis.history) == null || w.replaceState(globalThis.history.state, "", Ef(h, o.jobId))), a(null);
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
function _f(e) {
  return e.available ? {
    key: "compare",
    label: "对比版本",
    title: "对比版本：左边换成这本书的另一份译文",
    Icon: Ls,
    pressed: !!(e.compared || e.loading),
    popup: (t) => /* @__PURE__ */ g(Pd, { compare: e, onDone: t })
  } : null;
}
function Nf(e) {
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
function Af() {
  var i;
  const e = Gt(), t = Mf({
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
  const s = K(() => {
    const c = _f(t);
    return { toolbarItems: c ? [c] : [], comparedDocument: Nf(t) };
  }, [t]);
  return yn(s), null;
}
const xf = { id: "compare", title: "对比版本", Component: Af }, Aa = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], io = { pen: 35e-4, highlighter: 0.018 }, co = 0.015, Hn = "retainpdf.reader.ink.v1:";
function lo(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(Hn + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function Lf(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(Hn + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(Hn + e);
    } catch {
    }
}
function Df(e, t, n, r, o, a) {
  const s = co * co;
  return e.filter((i) => xa(i, t, n) && i.points.some(([c, l]) => (c - r) ** 2 + ((l - o) * a) ** 2 <= s)).map((i) => i.id);
}
function xa(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function Cf(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function Of(e) {
  const [t, n] = _(null), [r, o] = _(Aa[0].key), [a, s] = _(() => lo(e)), i = N(a), c = N([]);
  C(() => {
    const h = lo(e);
    i.current = h, s(h), c.current = [];
  }, [e]);
  const l = L((h) => {
    i.current = h, s(h), Lf(e, h);
  }, [e]), u = L((h) => {
    const b = i.current, w = h(b);
    w !== b && (c.current = [...c.current.slice(-49), b], l(w));
  }, [l]), m = L((h) => {
    h.points.length < 1 || u((b) => [...b, { ...h, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [u]), d = L((h) => {
    h.length && u((b) => b.filter((w) => !h.includes(w.id)));
  }, [u]), f = L((h) => {
    u((b) => b.some((w) => w.page === h) ? b.filter((w) => w.page !== h) : b);
  }, [u]), p = L(() => {
    const h = c.current.pop();
    h && l(h);
  }, [l]);
  return K(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: m, erase: d, undo: p, clearPage: f }),
    [t, r, a, m, d, p, f]
  );
}
const $f = [
  { tool: "pen", label: "画笔", Icon: Yn },
  { tool: "highlighter", label: "荧光笔", Icon: Ds },
  { tool: "eraser", label: "橡皮", Icon: Cs }
];
function zf(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function La({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ D(De, { children: [
    $f.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ g(
      ee,
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
    Aa.map((o) => /* @__PURE__ */ g(
      ee,
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
    /* @__PURE__ */ g(ee, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ g(Os, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ g(
      ee,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ g($s, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null,
    e.tool ? /* @__PURE__ */ g(
      ee,
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
function Ff({ ink: e, page: t, onPick: n }) {
  return /* @__PURE__ */ g("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ g(La, { ink: e, page: t, onPick: n }) });
}
function Bf({ ink: e }) {
  return e.tool ? /* @__PURE__ */ g("div", { className: "reader-ink-bar is-dock", role: "toolbar", "aria-label": "画笔", "data-ink-dock": "true", children: /* @__PURE__ */ g(La, { ink: e }) }) : null;
}
function jf(e) {
  const t = N(e);
  t.current = e, C(() => {
    const n = (r) => {
      if (zf(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
const Hf = "reader-ink-layer";
function Uf(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function uo({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ g(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: Uf(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function Wf({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = _(null), i = N(!1), c = o.strokes.filter((h) => xa(h, e, t)), l = !!o.tool;
  if (!l && !c.length) return null;
  const u = (h) => {
    const b = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - b.left) / Math.max(1, b.width))),
      Math.min(1, Math.max(0, (h.clientY - b.top) / Math.max(1, b.height)))
    ];
  }, m = (h, b) => o.erase(Df(o.strokes, e, t, h, b, r / Math.max(1, n))), d = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [b, w] = u(h);
    o.tool === "eraser" ? m(b, w) : s([[b, w]]);
  }, f = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [b, w] = u(h);
    o.tool === "eraser" ? m(b, w) : s((v) => v ? Cf(v, b, w) : [[b, w]]);
  }, p = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: io[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ D(
    "svg",
    {
      className: Hf,
      "data-ink-active": l ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: d,
      onPointerMove: f,
      onPointerUp: p,
      onPointerCancel: p,
      children: [
        c.map((h) => /* @__PURE__ */ g(uo, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ g(uo, { stroke: { tool: o.tool, color: o.color, width: io[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
const Kf = [
  { keys: "P", desc: "进入 / 退出画笔（书页上右键也能选笔和颜色）" },
  { keys: "Esc", desc: "退出画笔" },
  { keys: "⌘Z / Ctrl+Z", desc: "画笔模式下撤销" }
];
function Vf(e) {
  return {
    toolbarItems: [{
      key: "ink",
      label: "画笔",
      title: "画笔（P；书页上右键也能选笔和颜色）",
      Icon: Yn,
      pressed: !!e.tool,
      onClick: () => e.setTool(e.tool ? null : "pen")
    }],
    menuSection: ({ page: t, close: n }) => /* @__PURE__ */ g(Ff, { ink: e, page: t, onPick: n }),
    // 离视口远的页只是占位，笔迹先不画（和以前一样只画 active 的页）。
    pageLayer: ({ page: t, pane: n, width: r, height: o, active: a }) => a ? /* @__PURE__ */ g(Wf, { page: t, pane: n, width: r, height: o, ink: e }) : null,
    takesPointer: !!e.tool,
    shortcuts: Kf
  };
}
function qf() {
  const e = Gt(), t = Of(e.resetKey);
  jf(t);
  const n = K(() => Vf(t), [t]);
  return yn(n), /* @__PURE__ */ g(Bf, { ink: t });
}
const Jf = { id: "ink", title: "画笔", Component: qf }, Gf = Oo(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
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
}), Xf = Gf;
function Zf(e) {
  const t = N(!1);
  return e && (t.current = !0), t.current;
}
const Yf = zo(() => import("./ReaderMarkdownPanel-fBDGxRYv.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), Da = { id: "markdown", label: "Markdown", short: "MD", Icon: Xf, needsJob: !0 };
function Qf() {
  const e = Gt(), t = e.activePanel === Da.id;
  return Zf(t) ? /* @__PURE__ */ g($o, { fallback: null, children: /* @__PURE__ */ g(Yf, { open: t, jobId: e.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: e.closePanel }) }) : null;
}
const em = {
  id: "markdown",
  title: "Markdown",
  Component: Qf,
  panels: [Da]
}, Ca = "reader-xref", Un = "data-xref", Ot = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, tm = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${Ot})`), nm = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function Wn(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function rm(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function om(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function am(e, t, n) {
  const r = e[t], o = (i) => {
    if (!i || i.source.page !== r.source.page) return !1;
    const c = Ne(i);
    return c === "figure" || c === "table" || c === "formula";
  }, a = (i) => {
    const c = [];
    for (let l = t + i; o(e[l]) && c.length < 40; l += i) c.push(e[l]);
    return i < 0 ? c.reverse() : c;
  }, s = a(n === "table" ? 1 : -1);
  return s.length ? s : a(n === "table" ? -1 : 1);
}
function sm(e, t, n) {
  return (e.find((o) => Ne(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function im(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = Ne(r), s = om(r);
    if (a === "formula") {
      for (const p of s.matchAll(nm)) {
        const h = Wn(p[1]);
        h && n({ key: `equation:${h}`, kind: "equation", label: h, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = tm.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const l = rm(i[1]), u = Wn(i[2]), m = am(e, o, l), d = [...m.map((p) => p.itemId), r.itemId], f = new Map(e.map((p, h) => [p.itemId, h]));
    d.sort((p, h) => (f.get(p) ?? 0) - (f.get(h) ?? 0)), n({ key: `${l}:${u}`, kind: l, label: u, itemId: sm(m, r, l), itemIds: d, captionId: r.itemId });
  }), t;
}
const cm = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${Ot})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${Ot})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${Ot})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${Ot})\s*[）)]`, "g"), kind: () => "equation" }
];
function lm(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of cm) {
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
function um(e, t) {
  return lm(e, t).map((n) => ({ start: n.start, end: n.end, className: Ca, attrs: { [Un]: n.key } }));
}
const dm = { figure: "图", table: "表", equation: "式" };
function fo(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${dm[e.kind]} ${e.label}`;
}
const mo = 6e3;
function Oa(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function fm(e, t, n, r) {
  const o = e.width * t.width, a = e.height * t.height;
  let s = n * r / Math.max(1, o);
  const i = Math.max(o, a) * s;
  return i > mo && (s *= mo / i), {
    scale: s,
    offsetX: -e.left * t.width * s,
    offsetY: -e.top * t.height * s,
    canvasWidth: Math.max(1, Math.round(o * s)),
    canvasHeight: Math.max(1, Math.round(a * s)),
    /** 显示高度（CSS 像素），按区域的宽高比。 */
    cssHeight: Math.round(n * (a / Math.max(1, o)))
  };
}
function $a({
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
        const f = d.getViewport({ scale: 1 }), p = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), h = fm(n, f, r, p), b = s.current, w = b == null ? void 0 : b.getContext("2d");
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
const ho = { figure: "图", table: "表", formula: "公式", text: "文字" }, Ge = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function mm(e, t, n) {
  const r = Rt(e, t, n), o = r ? dt(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = Oa({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function hm(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, c = null;
  for (const u of e) {
    const m = Rt(u, t, n), d = m ? dt(m, 1, 1) : null;
    !m || !d || (r || (r = m.box.page, c = m.pageSize), m.box.page === r && (o = Math.min(o, d.left), a = Math.min(a, d.top), s = Math.max(s, d.left + d.width), i = Math.max(i, d.top + d.height)));
  }
  if (!r || !c) return null;
  const l = Oa({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: l, aspect: l.height * c.height / Math.max(1e-6, l.width * c.width) };
}
function pm(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function gm(e, t) {
  const n = (o) => {
    const a = Ne(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function bm({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var O;
  const i = t.find((A) => A.itemId === e) ?? null, c = K(() => i ? gm(t, i) : [], [t, i]), l = i ? c.indexOf(i) : -1, [u, m] = _(Ge.indexOf(1)), d = Ge[u], f = N(null), [p, h] = _(0);
  Re(() => {
    const A = f.current;
    if (!A) return;
    const I = () => h(A.clientWidth);
    I();
    const T = typeof ResizeObserver == "function" ? new ResizeObserver(I) : null;
    return T == null || T.observe(A), () => T == null ? void 0 : T.disconnect();
  }, []);
  const b = L((A) => {
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
        I.preventDefault(), m((T) => Math.min(Ge.length - 1, T + 1));
      else if (I.key === "-" || I.key === "_")
        I.preventDefault(), m((T) => Math.max(0, T - 1));
      else if (I.key === "0")
        I.preventDefault(), m(Ge.indexOf(1));
      else
        return;
      I.stopPropagation();
    };
    return window.addEventListener("keydown", A, !0), () => window.removeEventListener("keydown", A, !0);
  }, [s, b]), C(() => {
    const A = f.current;
    if (!A) return;
    const I = (T) => {
      !T.ctrlKey && !T.metaKey || (T.preventDefault(), m((P) => Math.max(0, Math.min(Ge.length - 1, P + (T.deltaY < 0 ? 1 : -1)))));
    };
    return A.addEventListener("wheel", I, { passive: !1 }), () => A.removeEventListener("wheel", I);
  }, []);
  const w = N(null);
  if (!i) return null;
  const v = Ne(i), y = o.map((A) => ({ pane: A, pdf: r[A] ?? null, where: mm(i, n, A) })).filter((A) => !!(A.pdf && A.where)), S = 16, k = typeof window > "u" ? 800 : window.innerHeight, E = Math.min(880, k * 0.9) - 56 - 32 - (y.length > 1 ? 26 : 0), x = y.length ? pm(Math.max(120, (p - S * (y.length - 1) - 32) / y.length), E, y.map((A) => A.where.aspect)) : 0, $ = ((O = y[0]) == null ? void 0 : O.where.page) ?? i.source.page;
  return /* @__PURE__ */ D("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${ho[v] ?? "这一块"}`, children: [
    /* @__PURE__ */ g("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ D("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ D("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ D("span", { className: "reader-zoom-title", children: [
          ho[v] ?? "这一块",
          " · 第 ",
          $,
          " 页"
        ] }),
        /* @__PURE__ */ g("span", { className: "reader-zoom-count", children: l >= 0 ? `${l + 1} / ${c.length}` : "" }),
        /* @__PURE__ */ D("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ g(at, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: l <= 0, onClick: () => b(-1), children: /* @__PURE__ */ g(zs, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ g(at, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: l < 0 || l >= c.length - 1, onClick: () => b(1), children: /* @__PURE__ */ g(Vo, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ g(at, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => m((A) => Math.max(0, A - 1)), children: /* @__PURE__ */ g(Fs, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ D(ee, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => m(Ge.indexOf(1)), children: [
            Math.round(d * 100),
            "%"
          ] }),
          /* @__PURE__ */ g(at, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === Ge.length - 1, onClick: () => m((A) => Math.min(Ge.length - 1, A + 1)), children: /* @__PURE__ */ g(Bs, { size: 16, "aria-hidden": !0 }) }),
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
            const I = f.current, T = w.current;
            !I || !T || (I.scrollLeft = T.left - (A.clientX - T.x), I.scrollTop = T.top - (A.clientY - T.y));
          },
          onPointerUp: () => {
            w.current = null;
          },
          children: y.length && p ? /* @__PURE__ */ g("div", { className: "reader-zoom-columns", style: { gap: S }, children: y.map(({ pane: A, pdf: I, where: T }) => /* @__PURE__ */ D("figure", { className: "reader-zoom-column", children: [
            y.length > 1 ? /* @__PURE__ */ g("figcaption", { children: A === "source" ? "原文" : "译文" }) : null,
            /* @__PURE__ */ g(
              $a,
              {
                className: "reader-zoom-canvas",
                pdf: I,
                page: T.page,
                region: T.fraction,
                cssWidth: x * d,
                label: `${A === "source" ? "原文" : "译文"}第 ${T.page} 页`
              }
            )
          ] }, A)) }) : /* @__PURE__ */ g("p", { className: "reader-zoom-empty", children: p ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
const ym = 380, vm = 320, yt = 8;
function wm(e, t, n) {
  const r = Math.max(yt, Math.min(e.left, n.width - t.width - yt)), o = e.bottom + yt, a = o + t.height <= n.height - yt ? o : Math.max(yt, e.top - yt - t.height);
  return { left: r, top: a };
}
function Sm({
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
    const f = r[d], p = f ? hm(o, n, d) : null;
    if (f && p) {
      s = { pdf: f, where: p };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min(ym, vm / Math.max(0.05, s.where.aspect))), c = Math.round(i * s.where.aspect) + 30, l = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: m } = wm(e.anchor, { width: Math.max(i, 160) + 16, height: c + 16 }, l);
  return /* @__PURE__ */ D("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: m }, children: [
    /* @__PURE__ */ D("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ g("span", { children: fo(e.target) }),
      /* @__PURE__ */ D("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ g($a, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: fo(e.target) })
  ] });
}
const km = 250;
function Im(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function Tm(e, t, n) {
  const r = n === "back" ? e.back : e.forward;
  if (!r.length) return null;
  const o = r[r.length - 1], a = r.slice(0, -1), s = n === "back" ? { back: a, forward: [...e.forward, t] } : { back: [...e.back, t], forward: a };
  return { to: o, history: s };
}
function Rm(e) {
  var n;
  const t = e;
  return !!((n = t == null ? void 0 : t.closest) != null && n.call(t, "input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
function Em({
  shellEl: e,
  index: t,
  primaryPane: n,
  follow: r
}) {
  const [o, a] = _(null), [s, i] = _({ back: [], forward: [] }), c = N(s);
  c.current = s;
  const l = N(null), u = N({ index: t, primaryPane: n, follow: r, shellEl: e });
  u.current = { index: t, primaryPane: n, follow: r, shellEl: e };
  const m = L(() => {
    const { shellEl: f, primaryPane: p } = u.current;
    return zt(f, p);
  }, []);
  C(() => {
    if (!e) return;
    const f = (y) => {
      var S, k;
      return (k = (S = y.target) == null ? void 0 : S.closest) == null ? void 0 : k.call(S, `.${Ca}`);
    }, p = () => {
      l.current != null && window.clearTimeout(l.current), l.current = null;
    }, h = (y) => {
      var x;
      const S = f(y);
      if (!S) return;
      const k = u.current.index.get(S.getAttribute(Un) || "");
      if (!k) return;
      const E = ((x = S.closest("[data-reader-pane]")) == null ? void 0 : x.getAttribute("data-reader-pane")) || u.current.primaryPane;
      p(), l.current = window.setTimeout(() => {
        const $ = S.getBoundingClientRect();
        a({ target: k, pane: E, anchor: { left: $.left, top: $.top, right: $.right, bottom: $.bottom } });
      }, km);
    }, b = (y) => {
      const S = f(y);
      !S || S.contains(y.relatedTarget) || (p(), a(null));
    }, w = (y) => {
      var $, O;
      const S = f(y);
      if (!S || y.button !== 0 || y.metaKey || y.ctrlKey || y.shiftKey || `${(($ = window.getSelection) == null ? void 0 : $.call(window)) || ""}`.trim()) return;
      const k = u.current.index.get(S.getAttribute(Un) || "");
      if (!k) return;
      y.preventDefault(), y.stopPropagation(), p(), a(null);
      const E = ((O = S.closest("[data-reader-pane]")) == null ? void 0 : O.getAttribute("data-reader-pane")) || u.current.primaryPane, x = m();
      x && i((A) => Im(A, x)), u.current.follow(k, E);
    }, v = () => {
      p(), a(null);
    };
    return e.addEventListener("pointerover", h), e.addEventListener("pointerout", b), e.addEventListener("click", w, !0), e.addEventListener("scroll", v, { passive: !0 }), () => {
      p(), e.removeEventListener("pointerover", h), e.removeEventListener("pointerout", b), e.removeEventListener("click", w, !0), e.removeEventListener("scroll", v);
    };
  }, [e, m]);
  const d = L((f) => {
    const p = m();
    if (!p) return !1;
    const h = Tm(c.current, p, f);
    if (!h) return !1;
    const { shellEl: b, primaryPane: w } = u.current;
    return Et(b, h.to, "auto", w) ? (i(h.history), !0) : !1;
  }, [m]);
  return C(() => {
    const f = (p) => {
      if (!p.altKey || p.metaKey || p.ctrlKey || p.shiftKey || p.defaultPrevented || p.key !== "ArrowLeft" && p.key !== "ArrowRight" || Rm(p.target)) return;
      d(p.key === "ArrowLeft" ? "back" : "forward") && p.preventDefault();
    };
    return window.addEventListener("keydown", f), () => window.removeEventListener("keydown", f);
  }, [d]), {
    preview: o,
    closePreview: L(() => a(null), []),
    canGoBack: s.back.length > 0,
    backPage: s.back.length ? s.back[s.back.length - 1].page : null,
    goBack: L(() => d("back"), [d])
  };
}
const Pm = [
  { keys: "Alt+←", desc: "点了引用跳过去以后，回到原处" },
  { keys: "Alt+→", desc: "再跳回去" }
];
function Mm() {
  const e = Gt(), t = K(() => im(e.regions), [e.regions]), { jumpToBlock: n } = e, r = L((s, i) => n(s.itemId, i), [n]), o = Em({ shellEl: e.shellEl, index: t, primaryPane: e.primaryPane, follow: r }), a = K(() => ({
    // 书里一个认得出去处的引用都没有，就不改文字层（react-pdf 照原样画，不多一遍 innerHTML）。
    textMarks: t.size ? (s) => um(s, t) : void 0,
    shortcuts: Pm
  }), [t]);
  return yn(a), /* @__PURE__ */ D(De, { children: [
    o.preview ? /* @__PURE__ */ g(Sm, { preview: o.preview, regions: e.regions, metadata: e.metadata, documents: e.pdfDocuments }) : null,
    o.canGoBack ? /* @__PURE__ */ D(ee, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => o.goBack(), children: [
      /* @__PURE__ */ g(js, { size: 14, "aria-hidden": !0 }),
      " 回到第 ",
      o.backPage,
      " 页"
    ] }) : null
  ] });
}
const _m = { id: "xrefs", title: "引用（「图 2.1」「式 (3.21)」）", Component: Mm }, sr = [Jf, em, xf, _m, If];
function ir(e = sr) {
  return e.flatMap((t) => (t.panels ?? []).map(({ id: n, label: r, short: o, Icon: a, needsJob: s }) => ({ id: n, label: r, short: o, Icon: a, needsJob: s })));
}
function Nm(e) {
  const t = qe(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ g(De, { children: (e.tabs ?? ir()).map(({ id: s, label: i, Icon: c, needsJob: l }) => {
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
function Am(e) {
  const t = qe(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = ir().map(({ id: c, label: l, short: u, Icon: m, needsJob: d }) => ({
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
function xm(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Lm(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Dm(e) {
  return e / 100 * window.innerHeight;
}
function Cm(e) {
  return e / 100 * window.innerWidth;
}
function Om(e) {
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
  const [o, a] = Om(n);
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
      r = Lm(t, o);
      break;
    }
    case "em": {
      r = xm(t, o);
      break;
    }
    case "vh": {
      r = Dm(o);
      break;
    }
    case "vw": {
      r = Cm(o);
      break;
    }
  }
  return r;
}
function Ie(e) {
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
      const u = $t({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = Ie(u / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const u = $t({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = Ie(u / n * 100);
    }
    let c = 0;
    if (a.minSize !== void 0) {
      const u = $t({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      c = Ie(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = $t({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      l = Ie(u / n * 100);
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
function ie(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function Vn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? $m : zm
  );
}
function $m(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function zm(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function za(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Fa(e, t) {
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
function Fm({
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
    const { x: i, y: c } = Fa(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return ie(o, "No rect found"), o;
}
let nn;
function Bm() {
  return nn === void 0 && (typeof matchMedia == "function" ? nn = !!matchMedia("(pointer:coarse)").matches : nn = !1), nn;
}
function Ba(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Vn(
    n,
    Array.from(t.children).filter(za).map((p) => ({ element: p }))
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
                  const E = f[0], x = Fm({
                    orientation: n,
                    rects: [w, v],
                    targetRect: E.element.getBoundingClientRect()
                  });
                  y = [
                    E,
                    x === w ? k : S
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
              const E = Bm() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
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
              const x = p <= l || p > u;
              !i && !x && s.push({
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
var Ze;
class ja {
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
    Er(this, Ze, {});
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
const cr = new ja();
function ct() {
  return It;
}
function jm(e) {
  return cr.addListener("change", e);
}
function Hm(e) {
  const t = It, n = { ...It };
  n.cursorFlags = e, It = n, cr.emit("change", {
    prev: t,
    next: n
  });
}
function Tt(e) {
  const t = It;
  It = e, cr.emit("change", {
    prev: t,
    next: e
  });
}
const Um = (e) => e, _n = () => {
}, Ha = 1, Ua = 2, Wa = 4, Ka = 8, po = 3, go = 12;
let rn;
function bo() {
  return rn === void 0 && (rn = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (rn = !0)), rn;
}
function Wm({
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
        if (e && bo()) {
          const a = (e & Ha) !== 0, s = (e & Ua) !== 0, i = (e & Wa) !== 0, c = (e & Ka) !== 0;
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
    return bo() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const yo = /* @__PURE__ */ new WeakMap();
function lr(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = yo.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = ct();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = Wm({
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
  yo.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Oe = /* @__PURE__ */ new Map();
const Va = new ja();
function Km(e) {
  Oe = new Map(Oe), Oe.delete(e);
}
function vo(e, t) {
  for (const [n] of Oe)
    if (n.id === e)
      return n;
}
function et(e, t) {
  for (const [n, r] of Oe)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function mt() {
  return Oe;
}
function ur(e, t) {
  return Va.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Ke(e, t, n) {
  const r = Oe.get(e);
  Oe = new Map(Oe), Oe.set(e, t), Va.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function qa(e) {
  const t = ct();
  let n = !1;
  switch (t.state) {
    case "active":
      Tt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (lr(e), n = !0, t.hitRegions.forEach((r) => {
        const o = et(r.group.id, !0);
        Ke(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function wo(e) {
  e.defaultPrevented || qa(e.currentTarget);
}
function Vm(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Fa(n, a.rect);
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
function qm(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Jm(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: Io(e),
    b: Io(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  ie(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: ko(So(n.a)),
    b: ko(So(n.b))
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
const Gm = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function Xm(e) {
  const t = getComputedStyle(Ja(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function Zm(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || Xm(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || Gm.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function So(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (ie(n, "Missing node"), Zm(n)) return n;
  }
  return null;
}
function ko(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Io(e) {
  const t = [];
  for (; e; )
    t.push(e), e = Ja(e);
  return t;
}
function Ja(e) {
  const { parentNode: t } = e;
  return qm(t) ? t.host : t;
}
function Ym(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Qm({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!za(n) || n.contains(e) || e.contains(n))
    return !0;
  if (Jm(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Ym(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function dr(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = Ba(o), s = Vm(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Qm({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function eh(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function Se(e, t, n = 0) {
  return Math.abs(Ie(e) - Ie(t)) <= n;
}
function Ce(e, t) {
  return Se(e, t) ? 0 : e > t ? 1 : -1;
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
  if (Ce(r, c) < 0)
    if (a) {
      const l = (o + c) / 2;
      Ce(r, l) < 0 ? r = o : r = c;
    } else
      r = c;
  return r = Math.min(i, r), r = Ie(r), r;
}
function Ut({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (Se(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), c = Object.values(o), l = [...i], [u, m] = r;
  ie(u != null, "Invalid first pivot index"), ie(m != null, "Invalid second pivot index");
  let d = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? m : u, b = n[h];
        ie(
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
          if (ie(
            S != null,
            `Previous layout not found for panel index ${h}`
          ), Se(S, w)) {
            const k = y - S;
            Ce(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      {
        const h = e < 0 ? u : m, b = n[h];
        ie(
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
          if (ie(
            S != null,
            `Previous layout not found for panel index ${h}`
          ), Se(S, y)) {
            const k = S - w;
            Ce(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? m : u, b = n[h];
      ie(
        b,
        `Panel constraints not found for index ${h}`
      );
      const w = i[h], { collapsible: v, collapsedSize: y, minSize: S } = b;
      if (v && Ce(w, S) < 0)
        if (e > 0) {
          const k = S - y, E = k / 2, x = w + e;
          Ce(x, S) < 0 && (e = Ce(e, E) <= 0 ? 0 : k);
        } else {
          const k = S - y, E = 100 - k / 2, x = w - e;
          Ce(x, S) < 0 && (e = Ce(100 + e, E) > 0 ? 0 : -k);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let b = e < 0 ? m : u, w = 0;
    for (; ; ) {
      const y = i[b];
      ie(
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
      ie(
        w != null,
        `Previous layout not found for panel index ${h}`
      );
      const v = w - b, y = kt({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: w,
        size: v
      });
      if (!Se(w, y) && (d += w - y, l[h] = y, d.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (eh(c, l))
    return o;
  {
    const h = e < 0 ? m : u, b = i[h];
    ie(
      b != null,
      `Previous layout not found for panel index ${h}`
    );
    const w = b + d, v = kt({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: b,
      size: w
    });
    if (l[h] = v, !Se(v, w)) {
      let y = w - v, S = e < 0 ? m : u;
      for (; S >= 0 && S < n.length; ) {
        const k = l[S];
        ie(
          k != null,
          `Previous layout not found for panel index ${S}`
        );
        const E = k + y, x = kt({
          overrideDisabledPanels: s,
          panelConstraints: n[S],
          prevSize: k,
          size: E
        });
        if (Se(k, x) || (y -= x - k, l[S] = x), Se(y, 0))
          break;
        e > 0 ? S-- : S++;
      }
    }
  }
  const f = Object.values(l).reduce(
    (h, b) => b + h,
    0
  );
  if (!Se(f, 100, 0.1))
    return o;
  const p = Object.keys(o);
  return l.reduce((h, b, w) => (h[p[w]] = b, h), {});
}
function lt(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || Ce(e[n], t[n]) !== 0)
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
  if (!Se(o, 100) && r.length > 0)
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      ie(c != null, `No layout data found for index ${i}`);
      const l = 100 / o * c;
      r[i] = l;
    }
  let a = 0;
  for (let i = 0; i < t.length; i++) {
    const c = n[i];
    ie(c != null, `No layout data found for index ${i}`);
    const l = r[i];
    ie(l != null, `No layout data found for index ${i}`);
    const u = kt({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: c,
      size: l
    });
    l != u && (a += l - u, r[i] = u);
  }
  if (!Se(a, 0))
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      ie(c != null, `No layout data found for index ${i}`);
      const l = c + a, u = kt({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: c,
        size: l
      });
      if (c !== u && (a -= u - c, r[i] = u, Se(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, c, l) => (i[s[l]] = c, i), {});
}
function Ga({
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
      return (v == null ? void 0 : v.collapsible) && Se(v.collapsedSize, u[v.panelId]);
    }))) {
      const b = l.slice(0, f).reduce((w, v) => w + u[v.id], 0);
      return {
        ...u,
        [t]: Ie(100 - b)
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
    lt(p, w) || Ke(d, {
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
      return c && Se(l, u);
    },
    resize: (c) => {
      const { group: l } = n(), { element: u } = o(), m = Pt({ group: l }), d = $t({
        groupSize: m,
        panelElement: u,
        styleProp: c
      }), f = Ie(d / m * 100);
      i(f);
    }
  };
}
function To(e) {
  if (e.defaultPrevented)
    return;
  const t = mt();
  dr(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = Ga({
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
function Xa({
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
      return r ? i : (lt(i, l) || Ke(a, {
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
  const n = on(e), r = et(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  ie(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  ie(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), i = Xa({ groupId: n.id }).getLayout(), c = Ut({
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
  lt(i, l) || Ke(
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
        const r = on(t), o = et(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, c = r.separators.find(
          (d) => d.element === t
        );
        ie(c, "Matching separator not found");
        const l = i.get(c);
        ie(l, "Matching panels not found");
        const u = l[0], m = a.find(
          (d) => d.panelId === u.id
        );
        if (ie(m, "Panel metadata not found"), m.collapsible) {
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
        ie(o !== null, "Index not found");
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
function Eo(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = mt(), n = dr(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), Tt({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function Za({
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
      const x = Ut({
        delta: h,
        initialLayout: b,
        panelConstraints: y,
        pivotIndices: l.panels.map(($) => f.indexOf($)),
        prevLayout: k,
        trigger: "mouse-or-touch"
      });
      if (lt(x, k)) {
        if (h !== 0 && !p)
          switch (d) {
            case "horizontal": {
              i |= h < 0 ? Ha : Ua;
              break;
            }
            case "vertical": {
              i |= h < 0 ? Wa : Ka;
              break;
            }
          }
      } else
        Ke(l.group, {
          defaultLayoutDeferred: v,
          derivedPanelConstraints: y,
          groupSize: S,
          layout: x,
          separatorToPanels: E
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & po : c |= i & po, t.movementY === 0 ? c |= s & go : c |= i & go, Hm(c), lr(e);
}
function Po(e) {
  const t = mt(), n = ct();
  switch (n.state) {
    case "active":
      Za({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function Mo(e) {
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
        Tt({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = et(a.group.id, !0);
          Ke(a.group, s, {
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
      Za({
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
      const a = dr(e, n);
      a.length === 0 ? t.state !== "inactive" && Tt({
        cursorFlags: 0,
        state: "inactive"
      }) : Tt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), lr(e.currentTarget);
      break;
    }
  }
}
function _o(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (ct().state) {
      case "hover":
        Tt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function No(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || qa(e.currentTarget) && e.preventDefault();
}
function Ao(e) {
  let t = 0, n = 0;
  const r = {};
  for (const a of e)
    if (a.defaultSize !== void 0) {
      t++;
      const s = Ie(a.defaultSize);
      n += s, r[a.panelId] = s;
    } else
      r[a.panelId] = void 0;
  const o = e.length - t;
  if (o !== 0) {
    const a = Ie((100 - n) / o);
    for (const s of e)
      s.defaultSize === void 0 && (r[s.panelId] = a);
  }
  return r;
}
function th(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((c) => c.element === t);
  if (!r || !r.onResize)
    return;
  const o = Pt({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: Ie(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function nh(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function rh({
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
        const f = d / 100 * n, p = Ie(
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
      u[m] = Ie(
        d / a * l
      );
    }
  else {
    const m = Ie(
      l / c.length
    );
    for (const d of c)
      u[d] = m;
  }
  return u;
}
function oh(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const vt = /* @__PURE__ */ new Map();
function ah(e) {
  let t = !0;
  ie(
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
          const y = et(e.id);
          if (!y)
            return;
          const S = Kn(e), k = y.defaultLayoutDeferred ? Ao(S) : y.layout, E = rh({
            group: e,
            nextGroupSize: v,
            prevGroupSize: y.groupSize,
            prevLayout: k
          }), x = ut({
            layout: E,
            panelConstraints: S
          });
          if (!y.defaultLayoutDeferred && lt(y.layout, x) && nh(
            y.derivedPanelConstraints,
            S
          ) && y.groupSize === v)
            return;
          Ke(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: S,
            groupSize: v,
            layout: x,
            separatorToPanels: y.separatorToPanels
          });
        }
      } else
        th(e, w, b);
    }
  });
  a.observe(e.element), e.panels.forEach((p) => {
    ie(
      !r.has(p.id),
      `Panel ids must be unique; id "${p.id}" was used more than once`
    ), r.add(p.id), p.onResize && a.observe(p.element);
  });
  const s = Pt({ group: e }), i = Kn(e), c = e.panels.map(({ id: p }) => p).join(",");
  let l = e.mutableState.defaultLayout;
  l && (oh(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[c] ?? l ?? Ao(i), m = ut({
    layout: u,
    panelConstraints: i
  }), d = e.element.ownerDocument;
  vt.set(
    d,
    (vt.get(d) ?? 0) + 1
  );
  const f = /* @__PURE__ */ new Map();
  return Ba(e).forEach((p) => {
    p.separator && f.set(p.separator, p.panels);
  }), Ke(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: m,
    separatorToPanels: f
  }), e.separators.forEach((p) => {
    ie(
      !o.has(p.id),
      `Separator ids must be unique; id "${p.id}" was used more than once`
    ), o.add(p.id), p.element.addEventListener("keydown", Ro);
  }), vt.get(d) === 1 && (d.addEventListener("contextmenu", wo, !0), d.addEventListener("dblclick", To, !0), d.addEventListener("pointerdown", Eo, !0), d.addEventListener("pointerleave", Po), d.addEventListener("pointermove", Mo), d.addEventListener("pointerout", _o), d.addEventListener("pointerup", No, !0)), function() {
    t = !1, vt.set(
      d,
      Math.max(0, (vt.get(d) ?? 0) - 1)
    ), Km(e), e.separators.forEach((p) => {
      p.element.removeEventListener("keydown", Ro);
    }), vt.get(d) || (d.removeEventListener(
      "contextmenu",
      wo,
      !0
    ), d.removeEventListener(
      "dblclick",
      To,
      !0
    ), d.removeEventListener(
      "pointerdown",
      Eo,
      !0
    ), d.removeEventListener("pointerleave", Po), d.removeEventListener("pointermove", Mo), d.removeEventListener("pointerout", _o), d.removeEventListener("pointerup", No, !0)), a.disconnect();
  };
}
function sh() {
  const [e, t] = _({}), n = L(() => t({}), []);
  return [e, n];
}
function fr(e) {
  const t = Fo();
  return `${e ?? t}`;
}
const ht = typeof window < "u" ? Re : C;
function Ft(e) {
  const t = N(e);
  return ht(() => {
    t.current = e;
  }, [e]), L(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function mr(...e) {
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
function hr(e) {
  const t = N({ ...e });
  return ht(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const Ya = qt(null);
function ih(e, t) {
  const n = N({
    getLayout: () => ({}),
    setLayout: Um
  });
  Zn(t, () => n.current, []), ht(() => {
    Object.assign(
      n.current,
      Xa({ groupId: e })
    );
  });
}
function Qa({
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
    (I, T) => {
      lt(p.current.onLayoutChanged, I) || (p.current.onLayoutChanged = I, l == null || l(I, { isUserInteraction: T }));
    }
  ), w = fr(i), v = N(null), [y, S] = sh(), k = N({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: m,
    separators: []
  }), E = mr(v, a);
  ih(w, s);
  const x = Ft(
    (I, T) => {
      const P = ct(), R = vo(I), M = et(I);
      if (M) {
        let z = !1;
        switch (P.state) {
          case "active": {
            z = P.hitRegions.some(
              (F) => F.group === R
            );
            break;
          }
        }
        return {
          flexGrow: M.layout[T] ?? 1,
          pointerEvents: z ? "none" : void 0
        };
      }
      if (n != null && n[T])
        return {
          flexGrow: n == null ? void 0 : n[T]
        };
    }
  ), $ = hr({
    defaultLayout: n,
    disableCursor: r
  }), O = K(
    () => ({
      get disableCursor() {
        return !!$.disableCursor;
      },
      getPanelStyles: x,
      id: w,
      orientation: u,
      registerPanel: (I) => {
        const T = k.current;
        return T.panels = Vn(u, [
          ...T.panels,
          I
        ]), S(), () => {
          T.panels = T.panels.filter(
            (P) => P !== I
          ), S();
        };
      },
      registerSeparator: (I) => {
        const T = k.current;
        return T.separators = Vn(u, [
          ...T.separators,
          I
        ]), S(), () => {
          T.separators = T.separators.filter(
            (P) => P !== I
          ), S();
        };
      },
      updatePanelProps: (I, { disabled: T }) => {
        const P = k.current.panels.find(
          (z) => z.id === I
        );
        P && (P.panelConstraints.disabled = T);
        const R = vo(w), M = et(w);
        R && M && Ke(R, {
          ...M,
          derivedPanelConstraints: Kn(R)
        });
      },
      updateSeparatorProps: (I, {
        disabled: T,
        disableDoubleClick: P
      }) => {
        const R = k.current.separators.find(
          (M) => M.id === I
        );
        R && (R.disabled = T, R.disableDoubleClick = P);
      }
    }),
    [x, w, S, u, $]
  ), A = N(null);
  return ht(() => {
    const I = v.current;
    if (I === null)
      return;
    const T = k.current;
    let P;
    if ($.defaultLayout !== void 0 && Object.keys($.defaultLayout).length === T.panels.length) {
      P = {};
      for (const Z of T.panels) {
        const re = $.defaultLayout[Z.id];
        re !== void 0 && (P[Z.id] = re);
      }
    }
    const R = {
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
      panels: T.panels,
      resizeTargetMinimumSize: T.resizeTargetMinimumSize,
      separators: T.separators
    };
    A.current = R;
    const M = ah(R), { defaultLayoutDeferred: z, derivedPanelConstraints: F, layout: J } = et(R.id, !0);
    !z && F.length > 0 && (h(J), b(J, !1));
    const te = ur(w, (Z) => {
      const { defaultLayoutDeferred: re, derivedPanelConstraints: H, layout: U } = Z.next;
      if (re || H.length === 0)
        return;
      const W = R.panels.map(({ id: V }) => V).join(",");
      R.mutableState.layouts[W] = U, H.forEach((V) => {
        if (V.collapsible) {
          const { layout: q } = Z.prev ?? {};
          if (q) {
            const de = Se(
              V.collapsedSize,
              U[V.panelId]
            ), se = Se(
              V.collapsedSize,
              q[V.panelId]
            );
            de && !se && (R.mutableState.expandedPanelSizes[V.panelId] = q[V.panelId]);
          }
        }
      });
      const he = ct().state !== "active";
      h(U), he && b(U, Z.isUserInteraction);
    });
    return () => {
      A.current = null, M(), te();
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
  }), /* @__PURE__ */ g(Ya.Provider, { value: O, children: /* @__PURE__ */ g(
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
Qa.displayName = "Group";
function pr() {
  const e = st(Ya);
  return ie(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function ch(e, t) {
  const { id: n } = pr(), r = N({
    collapse: _n,
    expand: _n,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: _n
  });
  Zn(t, () => r.current, []), ht(() => {
    Object.assign(
      r.current,
      Ga({ groupId: n, panelId: e })
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
  ...p
}) {
  const h = !!c, b = fr(c), w = hr({
    disabled: a
  }), v = N(null), y = mr(v, s), {
    getPanelStyles: S,
    id: k,
    orientation: E,
    registerPanel: x,
    updatePanelProps: $
  } = pr(), O = m !== null, A = Ft(
    (R, M, z) => {
      m == null || m(R, c, z);
    }
  );
  ht(() => {
    const R = v.current;
    if (R !== null) {
      const M = {
        element: R,
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
      return x(M);
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
    x,
    w
  ]), C(() => {
    $(b, { disabled: a });
  }, [a, b, $]), ch(b, d);
  const I = () => {
    const R = S(k, b);
    if (R)
      return JSON.stringify(R);
  }, T = hn(
    (R) => ur(k, R),
    I,
    I
  );
  let P;
  return T ? P = JSON.parse(T) : o !== void 0 ? P = {
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
        ...lh,
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
qn.displayName = "Panel";
const lh = {
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
function uh({
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
function es({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const c = fr(a), l = hr({
    disabled: n,
    disableDoubleClick: r
  }), [u, m] = _({}), [d, f] = _("inactive"), [p, h] = _(!1), b = N(null), w = mr(b, o), {
    disableCursor: v,
    id: y,
    orientation: S,
    registerSeparator: k,
    updateSeparatorProps: E
  } = pr(), x = S === "horizontal" ? "vertical" : "horizontal";
  ht(() => {
    const A = b.current;
    if (A !== null) {
      const I = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: A,
        id: c
      }, T = k(I), P = jm(
        (M) => {
          f(
            M.next.state !== "inactive" && M.next.hitRegions.some(
              (z) => z.separator === I
            ) ? M.next.state : "inactive"
          );
        }
      ), R = ur(
        y,
        (M) => {
          const { derivedPanelConstraints: z, layout: F, separatorToPanels: J } = M.next, te = J.get(I);
          if (te) {
            const Z = te[0], re = te.indexOf(Z);
            m(
              uh({
                layout: F,
                panelConstraints: z,
                panelId: Z.id,
                panelIndex: re
              })
            );
          }
        }
      );
      return () => {
        P(), R(), T();
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
      "aria-orientation": x,
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
es.displayName = "Separator";
const gr = 30, br = 65, Wt = 50, dh = 100 - br, fh = 100 - gr;
function mh(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(br, Math.max(gr, t)) : Wt;
}
function yr(e) {
  return 100 - e;
}
function wt(e) {
  return `${e}%`;
}
const vr = "reader-document", Kt = "reader-assistant", ts = "retainpdf.reader.ai-split-layout.v1", hh = {
  [vr]: yr(Wt),
  [Kt]: Wt
};
function wr(e) {
  const t = mh(e == null ? void 0 : e[Kt]);
  return {
    [vr]: yr(t),
    [Kt]: t
  };
}
function ph() {
  try {
    const e = JSON.parse(localStorage.getItem(ts) || "null");
    return wr(e);
  } catch {
    return hh;
  }
}
function gh(e) {
  try {
    localStorage.setItem(ts, JSON.stringify(wr(e)));
  } catch {
  }
}
function Nn(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = wr(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[Kt]}vw`
  );
}
function bh() {
  const e = N(null), [t] = _(ph);
  Re(() => {
    const o = e.current;
    return Nn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = L((o) => {
    Nn(e.current, o);
  }, []), r = L((o, a) => {
    Nn(e.current, o), a.isUserInteraction && gh(o);
  }, []);
  return /* @__PURE__ */ D(
    Qa,
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
          qn,
          {
            id: vr,
            defaultSize: wt(yr(Wt)),
            minSize: wt(dh),
            maxSize: wt(fh)
          }
        ),
        /* @__PURE__ */ g(
          es,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ g("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ g(
          qn,
          {
            id: Kt,
            defaultSize: wt(Wt),
            minSize: wt(gr),
            maxSize: wt(br)
          }
        )
      ]
    }
  );
}
function yh({
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
    n ? /* @__PURE__ */ g(ee, { className: "reader-error-notice-retry", "data-reader-retry": "optional", onClick: n, children: "重试" }) : null,
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
function vh({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ g(yh, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ D(De, { children: [
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
      s ? /* @__PURE__ */ g(ee, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function wh(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Sh() {
  const [e, t] = _(!1), n = Fo(), r = N(null), o = Na(), a = K(() => [...vl, ...Kd(o)], [o]);
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
      if (i.defaultPrevented || i.metaKey || i.ctrlKey || i.altKey || wh(i.target)) return;
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
        children: /* @__PURE__ */ g(Hs, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
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
const kh = ["source", "sideBySide", "translated"], Ih = { source: "", translated: "", sideBySide: "" };
function Th(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = an(e.sourceUrl), n = an(e.translatedUrl);
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
function Rh(e) {
  const [t, n] = _(() => /* @__PURE__ */ new Set()), r = K(
    () => e ? Th(e) : Ih,
    [e]
  ), o = K(
    () => kh.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = L(async (s) => {
    if (!e) return;
    const i = an(r[s]);
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
const Eh = {
  source: Uo,
  sideBySide: Wo,
  translated: Ko
}, Ph = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function Mh(e) {
  const t = qe(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Rh(n), i = N(null);
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
      /* @__PURE__ */ g(Us, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ g("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ g(Ho, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ g("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = us[c], u = an(r[c]), m = a.has(c), d = !!u && !m, f = d ? "" : ds(c, r), p = Eh[c];
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
                Ph[c],
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
const _h = "retainpdf:reader:bookmarks:v1:", Nh = 200;
function Sr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function ns(e) {
  const t = `${e || ""}`.trim();
  return t ? `${_h}${t}` : "";
}
function Ah(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function mn(e, t = Sr()) {
  const n = ns(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = Ah(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function Jn(e, t, n) {
  const r = ns(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, Nh);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function xh(e, t, n = "", { storage: r = Sr(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = mn(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? Jn(e, a.filter((i) => i.page !== s), r) : Jn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Lh(e, t, n = Sr()) {
  return Jn(e, mn(e, n).filter((r) => r.page !== t), n);
}
function Dh(e, t) {
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
function Ch({ filled: e }) {
  return /* @__PURE__ */ g("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ g("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function Oh({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = _(() => mn(e)), [i, c] = _(!1), l = N(null);
  if (C(() => {
    s(mn(e)), c(!1);
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
        onClick: () => s(xh(e, u, Dh(r, u))),
        children: /* @__PURE__ */ g(Ch, { filled: m })
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
          /* @__PURE__ */ g(Ws, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
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
          onClick: () => s(Lh(e, d.page)),
          children: "×"
        }
      )
    ] }, d.page)) }) }) : null
  ] });
}
function $h(e) {
  const [t, n] = _([]);
  return C(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = Ve().loadIssues;
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
function zh(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const Fh = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, Bh = ["failed", "content", "layout"];
function jh(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Hh({ jobId: e, currentPage: t }) {
  var m;
  const n = $h(e), r = (m = qe()) == null ? void 0 : m.jumpToBlock, [o, a] = _(!1), [s, i] = _(-1), c = N(null);
  C(() => i(-1), [n]);
  const l = (d) => {
    const f = n[d];
    !f || !r || (i(d), r(f.readerItemId));
  }, u = N({ issues: n, last: s, currentPage: t, goTo: l });
  return u.current = { issues: n, last: s, currentPage: t, goTo: l }, C(() => {
    const d = (f) => {
      if (f.key.toLowerCase() !== "n" || f.metaKey || f.ctrlKey || f.altKey || jh(f.target)) return;
      const { issues: p, last: h, currentPage: b, goTo: w } = u.current, v = zh(p, h, b, f.shiftKey);
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
      ee,
      {
        className: "reader-react-hud-btn reader-issues-toggle",
        "aria-expanded": o,
        "aria-haspopup": "true",
        "aria-label": `待处理 ${n.length} 处`,
        title: "这次翻译里要人看一眼的段落（N 下一处，Shift+N 上一处）",
        onClick: () => a((d) => !d),
        children: [
          /* @__PURE__ */ g(Ks, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ g("span", { children: n.length })
        ]
      }
    ),
    o ? /* @__PURE__ */ D("div", { className: "reader-issues-popover", role: "dialog", "aria-label": "待处理", children: [
      /* @__PURE__ */ g("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
      Bh.map((d) => {
        const f = n.map((p, h) => ({ issue: p, index: h })).filter(({ issue: p }) => p.kind === d);
        return f.length ? /* @__PURE__ */ D("section", { className: "reader-issues-group", "data-issue-kind": d, children: [
          /* @__PURE__ */ D("h4", { children: [
            Fh[d],
            /* @__PURE__ */ g("span", { children: f.length })
          ] }),
          /* @__PURE__ */ g("ol", { children: f.map(({ issue: p, index: h }) => /* @__PURE__ */ g("li", { children: /* @__PURE__ */ D(
            ee,
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
const Uh = 48, Wh = 96, Kh = 700;
function Vh(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= Uh, downSoFar: r };
}
function qh(e) {
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
      if (!(f instanceof Element) || (i.has(f) || i.set(f, !!f.querySelector(`[${Te}]`)), !i.get(f))) return;
      const p = f.scrollTop, h = o.get(f);
      if (o.set(f, p), h === void 0 || Date.now() - a > Kh) return;
      const b = Vh(!1, r.current, p - h);
      r.current = b.downSoFar, p - h < -4 ? n(!1) : b.hidden && !c() && n(!0);
    }, u = (d) => {
      d.clientY >= window.innerHeight - Wh && (r.current = 0, n(!1));
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
function Jh(e) {
  const t = qe(), n = Ra(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Jt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = Qi(a), m = a > ea + 1e-3, d = a < dn - 1e-3, f = St(r, Qe()), p = f >= dn ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", h = N(null), b = qh(h), [w, v] = _(!1), [y, S] = _(`${i}`);
  C(() => {
    w || S(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, w]);
  const k = () => {
    if (v(!1), !l || c <= 0)
      return;
    const E = Number(`${y}`.trim());
    l(fn(E, c));
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
      Oh,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: c,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
      }
    ) : null,
    e.issuesJobId ? /* @__PURE__ */ g(Hh, { jobId: e.issuesJobId, currentPage: i }) : null,
    t != null && t.toggleDocDark ? /* @__PURE__ */ g("div", { className: "reader-react-hud-group", "aria-label": "显示", children: /* @__PURE__ */ g(
      ee,
      {
        className: "reader-react-hud-btn reader-react-hud-doc-dark",
        "aria-pressed": t.docDark ? "true" : "false",
        "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
        title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
        onClick: t.toggleDocDark,
        children: /* @__PURE__ */ g(Gh, {})
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
    /* @__PURE__ */ g("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ g(Sh, {}) })
  ] });
}
function Gh() {
  return /* @__PURE__ */ D("svg", { width: "14", height: "14", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: [
    /* @__PURE__ */ g("circle", { cx: "8", cy: "8", r: "6.25", fill: "none", stroke: "currentColor", strokeWidth: "1.5" }),
    /* @__PURE__ */ g("path", { d: "M8 1.75a6.25 6.25 0 0 1 0 12.5z", fill: "currentColor" })
  ] });
}
function xo(e) {
  var t, n;
  return aa(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function Xh(e) {
  const [t, n] = _(() => ({
    scope: e,
    panel: xo($e(e))
  }));
  C(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: xo($e(e))
    });
  }, [e]), C(() => {
    t.scope === e && gn(t.scope, {
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
const Gn = "download-toast";
function Zh({
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
function Yh(e = {}) {
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
    () => /* @__PURE__ */ g(Zh, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: Gn, duration: 1 / 0 }
  );
}
function Qh() {
  const e = L((t) => {
    t && (t.setState = Yh, t.hide = () => xn.dismiss(Gn));
  }, []);
  return /* @__PURE__ */ D(De, { children: [
    /* @__PURE__ */ g(ks, { position: "bottom-right" }),
    /* @__PURE__ */ g("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
const Lo = { itemId: null, origin: null };
function ep() {
  let e = Lo;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? Lo : { itemId: n, origin: r };
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
function tp({
  nodes: e,
  currentPage: t,
  onJumpPage: n
}) {
  const r = K(() => ga(e, t), [e, t]), [o, a] = _(() => /* @__PURE__ */ new Set([...jr(r), ...r ? [r] : []]));
  C(() => {
    a(/* @__PURE__ */ new Set([...jr(r), ...r ? [r] : []]));
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
          ee,
          {
            className: `reader-bookmark-toggle${m ? " is-open" : ""}`,
            "aria-label": m ? `收起「${u.title}」` : `展开「${u.title}」`,
            "aria-expanded": m,
            onClick: () => i(u.id),
            children: /* @__PURE__ */ g(Vo, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 })
          }
        ) : /* @__PURE__ */ g("span", { className: "reader-bookmark-spacer", "aria-hidden": "true" }),
        /* @__PURE__ */ D(
          ee,
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
const np = [], rp = [];
function op({
  open: e,
  onToggle: t,
  children: n
}) {
  return /* @__PURE__ */ D("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ g(ee, { className: "reader-finder-toggle", "aria-label": "目录", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: /* @__PURE__ */ g(qs, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }) }),
    n
  ] });
}
function ap({ open: e, onToggle: t }) {
  return /* @__PURE__ */ g(
    ee,
    {
      className: "reader-react-hud-btn reader-search-toggle",
      "data-finder-toggle": "search",
      "aria-label": "在书里搜索",
      "aria-pressed": e === "search",
      title: "在书里搜索（原文和译文，⌘F）",
      onClick: () => t("search"),
      children: /* @__PURE__ */ g(Vs, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 })
    }
  );
}
function sp({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0,
  bookmarks: c = rp,
  onJumpPage: l
}) {
  var A, I;
  const u = ((A = qe()) == null ? void 0 : A.regions) ?? np, m = ((I = Ra()) == null ? void 0 : I.currentPage) ?? 1, d = K(() => Wl(u), [u]), f = c.length > 0 && !!l, [p, h] = _("bookmarks"), b = f && (p === "bookmarks" || !d.length), w = Kl(d, m), v = K(() => Jl(u, s), [u, s]), [y, S] = _(-1);
  C(() => S(-1), [s]);
  const k = N(null), E = N(null), x = N(n);
  x.current = n, C(() => {
    const T = (R) => {
      var z, F;
      const M = R.target;
      !M || (z = E.current) != null && z.contains(M) || (F = M.closest) != null && F.call(M, ".reader-finder-toggles, [data-finder-toggle]") || x.current();
    }, P = (R) => {
      R.key === "Escape" && x.current();
    };
    return document.addEventListener("pointerdown", T, !0), document.addEventListener("keydown", P), () => {
      document.removeEventListener("pointerdown", T, !0), document.removeEventListener("keydown", P);
    };
  }, []);
  const $ = N(null);
  C(() => {
    var T, P, R;
    e === "search" ? (T = k.current) == null || T.focus() : (R = (P = $.current) == null ? void 0 : P.querySelector('[aria-current="location"]')) == null || R.scrollIntoView({ block: "center" });
  }, [e, i]), C(() => {
    var T, P;
    e === "search" && y >= 0 && ((P = (T = $.current) == null ? void 0 : T.querySelector('[aria-current="true"]')) == null || P.scrollIntoView({ block: "nearest" }));
  }, [e, y]);
  const O = (T) => {
    const P = v[T];
    P && (S(T), r(P.itemId));
  };
  return /* @__PURE__ */ D("aside", { ref: E, className: "reader-finder", "data-finder-tab": e, "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ D("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ D("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ g(ee, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ g(ee, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ g(ee, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ g(ft, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" && f && d.length ? /* @__PURE__ */ D("div", { className: "reader-finder-switch", role: "radiogroup", "aria-label": "目录按什么列", children: [
      /* @__PURE__ */ g(ee, { className: "reader-finder-switch-option", role: "radio", "aria-checked": b, onClick: () => h("bookmarks"), children: "按书签" }),
      /* @__PURE__ */ g(ee, { className: "reader-finder-switch-option", role: "radio", "aria-checked": !b, onClick: () => h("headings"), children: "按标题" })
    ] }) : null,
    e === "outline" && b && l ? /* @__PURE__ */ g(tp, { nodes: c, currentPage: m, onJumpPage: l }) : e === "outline" ? d.length ? /* @__PURE__ */ g("ol", { ref: $, className: "reader-finder-list", children: d.map((T, P) => /* @__PURE__ */ g("li", { children: /* @__PURE__ */ D(
      ee,
      {
        className: "reader-finder-entry",
        "data-level": T.level,
        "aria-current": P === w ? "location" : void 0,
        onClick: () => r(T.itemId),
        children: [
          /* @__PURE__ */ g("span", { className: "reader-finder-entry-text", children: T.text }),
          /* @__PURE__ */ g("span", { className: "reader-finder-entry-page", children: T.page })
        ]
      }
    ) }, T.itemId)) }) : /* @__PURE__ */ g("p", { className: "reader-finder-empty", children: u.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ D(De, { children: [
      /* @__PURE__ */ D("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ g(
          qo,
          {
            ref: k,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "原文、译文里的字",
            "aria-label": "在书里搜索",
            value: o,
            onChange: (T) => a(T.target.value),
            onKeyDown: (T) => {
              T.key === "Enter" ? (T.preventDefault(), O(Gl(y, v.length, T.shiftKey))) : T.key === "Escape" && (T.preventDefault(), n()), T.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ g("p", { className: "reader-finder-count", "aria-live": "polite", children: v.length === 0 ? "没有找到" : `${y >= 0 ? `第 ${y + 1} / ` : ""}${v.length >= 200 ? "200+ 处，只列前 200 处" : `${v.length} 处`}${y < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ g("ol", { className: "reader-finder-list", children: v.map((T, P) => /* @__PURE__ */ g("li", { children: /* @__PURE__ */ D(ee, { className: "reader-finder-entry is-hit", "aria-current": P === y ? "true" : void 0, onClick: () => O(P), children: [
        /* @__PURE__ */ D("span", { className: "reader-finder-entry-text", children: [
          T.snippet.slice(0, T.at),
          /* @__PURE__ */ g("mark", { children: T.snippet.slice(T.at, T.at + T.length) }),
          T.snippet.slice(T.at + T.length)
        ] }),
        /* @__PURE__ */ g("span", { className: "reader-finder-entry-page", children: T.page })
      ] }) }, T.itemId)) })
    ] })
  ] });
}
function ip({
  active: e,
  extensions: t = sr
}) {
  const [n, r] = _(!1), [o, a] = _(null), s = Na(), i = (d) => {
    var f;
    return ((f = s.find((p) => p.id === d)) == null ? void 0 : f.contribution.toolbarItems) ?? [];
  }, c = t.some(({ id: d }) => i(d).some((f) => f.pressed)), l = t.flatMap((d) => [...i(d.id).map((f) => f.label), ...(d.panels ?? []).map((f) => f.label)]), u = (() => {
    if (!o) return null;
    for (const { id: d } of t) {
      const f = i(d).find((p) => `${d}:${p.key}` === o);
      if (f != null && f.popup) return f.popup(() => {
        a(null), r(!1);
      });
    }
    return null;
  })(), m = N(null);
  return C(() => {
    if (!n && !o) return;
    const d = () => {
      r(!1), a(null);
    }, f = (h) => {
      var b;
      (b = m.current) != null && b.contains(h.target) || d();
    }, p = (h) => {
      h.key === "Escape" && d();
    };
    return document.addEventListener("pointerdown", f, !0), document.addEventListener("keydown", p), () => {
      document.removeEventListener("pointerdown", f, !0), document.removeEventListener("keydown", p);
    };
  }, [n, o]), /* @__PURE__ */ D("div", { className: "reader-toolball", ref: m, "data-open": n ? "true" : void 0, children: [
    u,
    n ? /* @__PURE__ */ g("div", { className: "reader-toolball-stack", role: "group", "aria-label": "工具", children: t.map((d) => {
      const f = ir([d]);
      return /* @__PURE__ */ D(Xn, { children: [
        i(d.id).map((p) => {
          const h = `${d.id}:${p.key}`, b = p.Icon;
          return /* @__PURE__ */ g(
            ee,
            {
              className: "reader-toolball-item",
              "aria-label": p.label,
              title: p.title || p.label,
              "aria-pressed": !!p.pressed || o === h,
              "data-toolball-item": p.key,
              onClick: () => {
                var w;
                if (p.popup) {
                  a((v) => v === h ? null : h);
                  return;
                }
                (w = p.onClick) == null || w.call(p), r(!1);
              },
              children: /* @__PURE__ */ g(b, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
            },
            h
          );
        }),
        f.length ? /* @__PURE__ */ g(Nm, { active: e, tabs: f }) : null
      ] }, d.id);
    }) }) : null,
    /* @__PURE__ */ g(
      ee,
      {
        className: "reader-toolball-ball",
        "aria-label": n ? "收起工具" : `工具：${l.join("、")}`,
        title: n ? "收起" : "工具",
        "aria-expanded": n,
        "data-active": e || c ? "true" : void 0,
        onClick: () => {
          r((d) => !d), a(null);
        },
        children: n ? /* @__PURE__ */ g(ft, { size: 20, strokeWidth: 2.2, "aria-hidden": !0 }) : /* @__PURE__ */ g(Js, { size: 20, strokeWidth: 2.1, "aria-hidden": !0 })
      }
    )
  ] });
}
function cp(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function lp(e) {
  var r;
  if (e.shiftKey || cp(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${Yo}`))) return null;
  const n = Number((r = t.closest(`[${Te}]`)) == null ? void 0 : r.getAttribute(Te)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function up({
  menu: e,
  onClose: t,
  actions: n,
  sections: r
}) {
  const o = N(null);
  if (C(() => {
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
  return /* @__PURE__ */ D("div", { ref: o, className: "reader-ink-menu", style: { left: s, top: i }, "data-ink-menu": "true", children: [
    n.length ? /* @__PURE__ */ g("div", { className: "reader-ink-menu-actions", role: "menu", "aria-label": "书页", children: n.map((c) => /* @__PURE__ */ D(
      ee,
      {
        className: "reader-ink-menu-action",
        role: "menuitem",
        title: c.hint,
        onClick: () => {
          c.onSelect(), t();
        },
        children: [
          c.label,
          c.hint ? /* @__PURE__ */ g("kbd", { children: c.hint }) : null
        ]
      },
      c.key
    )) }) : null,
    r.map((c) => /* @__PURE__ */ g(Xn, { children: c.render({ page: e.page, close: t }) }, c.id))
  ] });
}
function dp({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ g("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ D("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
    /* @__PURE__ */ g("span", { children: n.phase === "failed" ? n.message : `改了 ${t} 处，还没排进 PDF` }),
    t ? /* @__PURE__ */ g(
      ee,
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
const rs = "retainpdf:reader:doc-theme:v1", Do = "data-reader-doc";
function os() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function fp(e = os()) {
  try {
    return (e == null ? void 0 : e.getItem(rs)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function mp(e, t = os()) {
  try {
    t == null || t.setItem(rs, e);
  } catch {
  }
}
function Co(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(Do, "dark") : t.removeAttribute(Do));
}
function hp() {
  const [e, t] = _(() => fp());
  C(() => {
    Co(e);
  }, [e]), C(() => () => Co("light"), []);
  const n = L(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return mp(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
function pp({ state: e, bookmarks: t }) {
  const { finder: n, setFinder: r, toggleFinder: o, findQuery: a, setFindQuery: s, findTerm: i, findFocus: c, jumpFromFinder: l, jumpToPageFromFinder: u } = e;
  return /* @__PURE__ */ D(De, { children: [
    /* @__PURE__ */ g(op, { open: n, onToggle: o }),
    n ? /* @__PURE__ */ g(
      sp,
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
function gp({
  session: e,
  zoomDocuments: t,
  zoomItem: n,
  setZoomItem: r,
  closeZoom: o,
  visiblePdfMode: a
}) {
  return /* @__PURE__ */ g(De, { children: n ? /* @__PURE__ */ g(
    bm,
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
function bp(e) {
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
function yp(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function vp(e, t) {
  const { sessionFiles: n } = e, [r, o] = _(!1), a = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, s = bp({
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
function wp(e, { liveTranslationVisible: t, setLiveTranslationVisible: n, liveToggles: r, sourceViewOnly: o, visiblePdfMode: a }) {
  const s = al(e.liveTranslation), i = L(() => {
    s && e.goToPage(s, "source");
  }, [e.goToPage, s]), [c, l] = _(null);
  C(() => {
    a === "compare" && e.session.jobTerminal && l(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, a]);
  const u = c !== e.viewStateKey && cl({
    state: e.liveTranslation,
    sourceViewOnly: o,
    visibleMode: a
  }), m = K(() => r.sourcePaneToggle ? /* @__PURE__ */ g(
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
function Sp(e, {
  translationVersions: t,
  bookmarks: n,
  regionHover: r,
  assistantPanel: o,
  closeAssistant: a,
  visiblePdfMode: s,
  changeWorkspace: i,
  jumpToBlockIn: c,
  zoomDocuments: l
}) {
  const { session: u, panes: m } = e, d = K(() => ({
    documentId: u.documentId || "",
    jobId: u.jobId,
    versionId: t.readingVersionId || null,
    translationVersions: t.versions,
    regions: u.regions,
    metadata: u.readerMetadata,
    bookmarks: n,
    pageCount: m.hudNumPages || 0,
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
    pdfDocuments: l
  }), [
    u.documentId,
    u.jobId,
    t,
    u.regions,
    u.readerMetadata,
    n,
    m.hudNumPages,
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
    l
  ]), [f] = _(zd), p = Jd(f), h = K(() => Bd(p), [p]), b = K(() => Wd(p), [p]), w = K(() => Ud(p), [p]), v = K(() => jd(p), [p]), y = Hd(p);
  return { readerApi: d, contributionStore: f, contributions: p, pageLayers: h, compareVersion: b, textMarks: w, menuSections: v, pointerTakenId: y };
}
function kp() {
  try {
    return Ve().translationEdit ?? null;
  } catch {
    return null;
  }
}
const Ip = "这本书正在处理（翻译或排版），处理完才能改。", Tp = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function Rp({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = kp(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = Yl(s), l = !t || Bt(t), u = ou(n), [m, d] = _(""), [f, p] = _(null), [h, b] = _(() => /* @__PURE__ */ new Map()), [w, v] = _(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [y, S] = _(() => /* @__PURE__ */ new Map()), [k, E] = _({ phase: "idle" }), x = N({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  C(() => {
    p(null), x.drafts.clear(), x.generation.current = null, S(/* @__PURE__ */ new Map()), E({ phase: "idle" });
  }, [s]), C(() => {
    if (d(""), !i || c || !a) return;
    let M = !1;
    return a.resolveOwnerJobId(s).then((z) => {
      M || d(`${z || s}`.trim() || s);
    }).catch(() => {
      M || d(s);
    }), () => {
      M = !0;
    };
  }, [i, c, a, s]), C(() => {
    if (b(/* @__PURE__ */ new Map()), !a || !m || !u || !l) return;
    let M = !1;
    return a.fetchRevisions(m).then((z) => {
      M || b(au(z, u));
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
  const O = K(() => {
    const M = new Map(h);
    if (w.renderedAt === u)
      for (const [z, F] of w.edits) M.set(z, F);
    return M;
  }, [h, w, u]), A = L((M) => {
    const z = `${M || ""}`.trim();
    z && p({ itemId: z, page: Ql(z) });
  }, []), I = L(() => p(null), []), T = L((M, z) => {
    v((F) => {
      const J = new Map(F.renderedAt === u ? F.edits : []);
      return J.set(M, z), { renderedAt: u, edits: J };
    }), S((F) => new Map(F).set(M, (F.get(M) || 0) + 1));
  }, [u]), P = L(async () => {
    if (!(!a || !s || k.phase === "submitting" || k.phase === "running")) {
      E({ phase: "submitting" });
      try {
        await a.rerender(s), E({ phase: "running", seenActive: !1 }), await o();
      } catch (M) {
        E({ phase: "failed", message: (M == null ? void 0 : M.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, k.phase, o]), R = c ? Tp : !l || k.phase === "running" || k.phase === "submitting" ? Ip : "";
  return K(() => ({
    available: i,
    blockedReason: R,
    port: a,
    ownerJobId: m,
    target: f,
    select: A,
    close: I,
    memory: x,
    pendingEdits: O,
    savedCounts: y,
    markSaved: T,
    rerender: k,
    startRerender: P
  }), [i, R, a, m, f, A, I, x, O, y, T, k, P]);
}
function Ep(e, t) {
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
function Pp(e, t, n) {
  const { session: r, sessionFiles: o } = e, a = Rp({
    jobId: r.jobId,
    jobStatus: r.jobStatus,
    jobPayload: r.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!o.translatedUrl,
    refreshJobStatus: r.refreshJobStatus
  }), s = a.select, i = e.setModeKeepingPage, c = r.regions, l = L((m) => {
    lu(c, m) && (t === "source" && i("compare"), s(m));
  }, [c, s, t, i]);
  Ep(a.available ? l : null, n);
  const u = K(() => {
    if (!a.savedCounts.size) return e.revisedBlocks;
    const m = new Map(e.revisedBlocks);
    for (const [d, f] of a.savedCounts) m.set(d, (m.get(d) || 0) + f);
    return m;
  }, [e.revisedBlocks, a.savedCounts]);
  return { blockEdit: a, editBlock: l, revisedBlocks: u };
}
const Mp = "reader-finder-input";
function _p(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function Np(e, t = typeof window > "u" ? null : window) {
  C(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!_p(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(Mp) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function Ap(e) {
  const [t, n] = _(null), r = L((f) => n((p) => p === f ? null : f), []), [o, a] = _(""), [s, i] = _("");
  C(() => {
    const f = o.replace(/\s+/gu, " ").trim(), p = window.setTimeout(() => i(f), f ? 150 : 0);
    return () => window.clearTimeout(p);
  }, [o]);
  const [c, l] = _(0), u = L(() => {
    n("search"), l((f) => f + 1);
  }, []);
  Np(u);
  const m = L((f) => {
    e.jumpToAnchor({ block_id: f }), (t === "outline" || Qe() < 900) && n(null);
  }, [e.jumpToAnchor, t]), d = L((f) => {
    e.goToPage(f), (t === "outline" || Qe() < 900) && n(null);
  }, [e.goToPage, t]);
  return { finder: t, setFinder: n, toggleFinder: r, findQuery: o, setFindQuery: a, findTerm: s, findFocus: c, jumpFromFinder: m, jumpToPageFromFinder: d };
}
function xp(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : na(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Lp(e, t) {
  return t === null || e !== t;
}
function Dp(e, t) {
  const { boot: n } = e, r = N(null), o = N(null);
  C(() => {
    if (!(n.loading || n.failed)) {
      if (r.current !== e.viewStateKey) {
        r.current = e.viewStateKey;
        const a = $e(e.viewStateKey), s = xp({
          savedMode: a == null ? void 0 : a.mode,
          sourceViewOnly: t,
          viewportWidth: Qe()
        });
        o.current = s.auto ? s.mode : null, s.mode && s.mode !== e.mode && e.setModeKeepingPage(s.mode);
        return;
      }
      Lp(e.mode, o.current) && (o.current = null, gn(e.viewStateKey, { mode: e.mode }));
    }
  }, [n.failed, n.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, t]);
}
const Cp = [];
function Op(e) {
  const { sessionFiles: t } = e, [n, r] = _({}), o = N({ source: t.sourceUrl, translated: t.translatedUrl });
  o.current = { source: t.sourceUrl, translated: t.translatedUrl };
  const a = L((b, w) => {
    r((v) => ({ ...v, [w]: { url: o.current[w], nodes: b } }));
  }, []), s = K(() => {
    const b = n.source;
    if (b && b.url === t.sourceUrl && b.nodes.length) return b.nodes;
    const w = n.translated;
    return w && w.url === t.translatedUrl && w.nodes.length ? w.nodes : Cp;
  }, [n, t.sourceUrl, t.translatedUrl]), i = N({}), [c, l] = _(0), u = L((b, w) => {
    i.current[w] = { url: o.current[w], pdf: b }, l((v) => v + 1);
  }, []), [m, d] = _(null), f = L((b) => d(b), []), p = L(() => d(null), []);
  C(() => d(null), [e.viewStateKey]);
  const h = K(() => {
    const b = (w, v) => {
      const y = i.current[w];
      return y && y.url === v ? y.pdf : null;
    };
    return { source: b("source", t.sourceUrl), translated: b("translated", t.translatedUrl) };
  }, [c, t.sourceUrl, t.translatedUrl]);
  return { bookmarks: s, onPdfOutline: a, onPdfDocument: u, zoomItem: m, setZoomItem: d, zoomBlock: f, closeZoom: p, zoomDocuments: h };
}
function $p() {
  const e = bl(), { boot: t, panes: n, session: r } = e, o = Xh(e.viewStateKey), a = o.panel, s = o.setPanel, i = a !== null, { liveTranslationVisible: c, setLiveTranslationVisible: l, paneComposition: u, liveToggles: m, sourceViewOnly: d, visiblePdfMode: f } = vp(e, i);
  Dp(e, d);
  const p = a || (e.mode === "compare" ? "compare" : "reading"), { docDark: h, toggleDocDark: b } = hp();
  Tl({
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
  const w = L(() => {
    s(null);
  }, []), { latestLivePage: v, jumpToLatestLivePage: y, offerCompletion: S, setCompletionDismissedKey: k, sourcePaneAction: E } = wp(e, {
    liveTranslationVisible: c,
    setLiveTranslationVisible: l,
    liveToggles: m,
    sourceViewOnly: d,
    visiblePdfMode: f
  }), x = L((me) => {
    const we = yp(me, e.liveTranslationAvailable);
    we !== null && l(we), e.setModeKeepingPage(me);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), $ = L((me) => {
    s(me);
  }, []), [O] = _(ep), A = Ap(e), { finder: I, toggleFinder: T, findTerm: P } = A, R = L((me) => e.jumpToAnchor({ block_id: me }), [e.jumpToAnchor]), M = L((me, we) => e.jumpToAnchor({ block_id: me }, we), [e.jumpToAnchor]), { bookmarks: z, onPdfOutline: F, onPdfDocument: J, zoomItem: te, setZoomItem: Z, zoomBlock: re, closeZoom: H, zoomDocuments: U } = Op(e), { blockEdit: W, editBlock: he, revisedBlocks: V } = Pp(e, f, O), [q, de] = _(null), se = L(() => de(null), []), le = Pf({ documentId: r.documentId, jobId: r.jobId }), {
    readerApi: be,
    contributionStore: pe,
    contributions: nt,
    pageLayers: Ae,
    compareVersion: oe,
    textMarks: fe,
    menuSections: ye,
    pointerTakenId: j
  } = Sp(e, {
    translationVersions: le,
    bookmarks: z,
    regionHover: O,
    assistantPanel: a,
    closeAssistant: w,
    visiblePdfMode: f,
    changeWorkspace: x,
    jumpToBlockIn: M,
    zoomDocuments: U
  }), Q = !!j, [ae, xe] = _([]), Ee = K(() => ({
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
    jumpToBlock: R,
    revisedBlocks: V,
    onPdfOutline: F,
    onPdfDocument: J,
    zoomBlock: re,
    textMarks: fe,
    pageLayers: Ae,
    editBlock: W.available ? he : void 0,
    blockEdit: W,
    editShowsSource: f !== "compare",
    findTerm: I === "search" ? P : "",
    compareVersion: oe,
    pointerTaken: Q,
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
    R,
    V,
    F,
    J,
    re,
    fe,
    Ae,
    W,
    he,
    f,
    I,
    P,
    oe,
    Q,
    e.sourceOnly,
    d,
    e.download,
    e.goToPage,
    $,
    w,
    h,
    b
  ]), Pe = K(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), ze = [
    Ji,
    `is-workspace-${p}`,
    i ? "is-assistant-open" : "",
    I ? "is-finder-open" : "",
    u.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ g(Vd, { api: be, store: pe, children: /* @__PURE__ */ g(Qu, { value: Ee, hud: Pe, children: /* @__PURE__ */ D(
    "div",
    {
      className: ze,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": p,
      "data-pointer-taken": j || void 0,
      onContextMenu: (me) => {
        const we = lp(me);
        if (!we) return;
        const Je = Fd(nt, { target: me.target, clientX: me.clientX, clientY: me.clientY, page: we.page });
        !Je.length && !ye.length || (me.preventDefault(), xe(Je), de(we));
      },
      children: [
        /* @__PURE__ */ g(vh, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!r.readerErrors.regions, metadataError: !!r.readerErrors.metadata, onRetry: r.refreshJobArtifacts }),
        /* @__PURE__ */ g(pp, { state: A, bookmarks: z }),
        /* @__PURE__ */ D("div", { className: "reader-chrome-tray", children: [
          /* @__PURE__ */ g(Mh, {}),
          /* @__PURE__ */ g(Al, { onBeforeClose: r.prepareClose })
        ] }),
        /* @__PURE__ */ g(
          $d,
          {
            mode: f,
            documentReady: !!r.jobId,
            sourceViewOnly: d,
            onModeChange: x,
            liveTranslation: m.topBarPill ? {
              visible: c,
              state: e.liveTranslation,
              onToggle: () => l((me) => !me),
              latestPage: c ? v : null,
              currentPage: e.currentPage,
              onJumpToLatest: y
            } : null,
            completion: S ? {
              onOpenCompare: () => {
                k(e.viewStateKey), x("compare");
              }
            } : null
          }
        ),
        /* @__PURE__ */ g(Am, { active: a }),
        i ? /* @__PURE__ */ g(bh, {}) : null,
        /* @__PURE__ */ g(Ld, { paneComposition: u, markdownSplit: i, assistantSplit: i, liveTranslation: e.liveTranslation, sourcePaneAction: E }),
        e.showHud ? /* @__PURE__ */ g(
          Jh,
          {
            mode: f,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            issuesJobId: e.sourceOnly ? "" : r.jobId,
            searchSlot: /* @__PURE__ */ g(ap, { open: I, onToggle: T })
          }
        ) : null,
        /* @__PURE__ */ g(
          gp,
          {
            session: r,
            zoomDocuments: U,
            zoomItem: te,
            setZoomItem: Z,
            closeZoom: H,
            visiblePdfMode: f
          }
        ),
        /* @__PURE__ */ g(ip, { active: a }),
        /* @__PURE__ */ g(up, { menu: q, onClose: se, actions: ae, sections: ye }),
        /* @__PURE__ */ g(Xd, { extensions: sr }),
        /* @__PURE__ */ g(dp, { edit: W }),
        /* @__PURE__ */ g(Qh, {})
      ]
    }
  ) }) });
}
function og() {
  return /* @__PURE__ */ g($p, {});
}
export {
  og as R,
  $p as a,
  rg as b,
  ng as c,
  tg as d,
  Qp as f,
  eg as r,
  of as s,
  qe as u
};
//# sourceMappingURL=ReaderApp-BrPwd1wS.js.map
