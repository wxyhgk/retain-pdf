var ss = Object.defineProperty;
var kr = (e) => {
  throw TypeError(e);
};
var is = (e, t, n) => t in e ? ss(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var Ir = (e, t, n) => is(e, typeof t != "symbol" ? t + "" : t, n), Tr = (e, t, n) => t.has(e) || kr("Cannot " + n);
var _t = (e, t, n) => (Tr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Rr = (e, t, n) => t.has(e) ? kr("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Er = (e, t, n, r) => (Tr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as D, jsx as p, Fragment as Ce } from "react/jsx-runtime";
import { useMemo as q, useState as P, useEffect as O, useCallback as A, useRef as M, useLayoutEffect as Re, memo as Vt, createContext as qt, useContext as st, Fragment as Xn, forwardRef as Oo, useImperativeHandle as Zn, useSyncExternalStore as hn, Component as cs, Suspense as $o, lazy as zo, useId as Fo } from "react";
import { requireAdapter as Mt, getReaderAdapters as Ne } from "./adapters.js";
import { resolveReaderDownloadName as ls, resolveReaderDownloadUrls as us, READER_PROGRESS_COPY as je, trimString as an, READER_DOWNLOAD_ACTIONS as ds, disabledReason as fs } from "./runtime/state.js";
import { r as ms, b as hs } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as An, isFinishedJobStatus as Bt } from "@retainpdf/domain/job";
import { n as Bo, d as ps, f as vn, k as Pr, b as gs, c as bs, j as Ae, p as dt, g as ys, l as Rt, i as vs } from "./reader-regions-BmqHsJ-I.js";
import { fetchDocumentReading as ws } from "@retainpdf/api/documents";
import { isReaderTransportError as Ss, createReaderTransportError as ks } from "./contracts.js";
import { toast as xn, Toaster as Is } from "sonner";
import { X as ft, PenLine as Yn, ZoomIn as Ts, Check as jo, Copy as Rs, ChevronUp as Es, ChevronDown as Ho, History as Ps, LoaderCircle as Ms, Pin as _s, LogOut as Ns, FileText as Uo, Columns2 as Wo, Languages as Ko, Radio as As, ArrowDownToLine as xs, CheckCircle2 as Ls, MessageCircleQuestion as Ds, GitCompareArrows as Cs, Highlighter as Os, Eraser as $s, Undo2 as zs, Trash2 as Fs, ChevronLeft as Bs, ChevronRight as Vo, Minus as js, Plus as Hs, ArrowLeft as Us, Keyboard as Ws, Download as Ks, ListOrdered as Vs, TriangleAlert as qs, Search as Js, ListTree as Gs, LayoutGrid as Xs } from "lucide-react";
import { Button as te, Textarea as Zs, IconButton as at, Input as qo } from "@retainpdf/ui";
import { pdfjs as Jo, Page as Ys, Document as Qs } from "react-pdf";
import { e as ei, m as ti, a as ni } from "./markdown-math-XkF5urpn.js";
const ri = (...e) => {
  var t, n;
  return ((n = (t = Ne()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, oi = "", ai = Object.freeze({
  progress: "retainpdf-reader-progress"
}), si = (e) => {
  var t, n;
  return ((n = (t = Ne()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, ng = (...e) => {
  var n;
  return (((n = Ne()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, rg = () => {
  var e, t;
  return ((t = (e = Ne()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
}, He = () => Mt("defaultReaderDataPort"), Mr = () => Mt("defaultReaderPageConfigPort"), og = {
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
}, Go = {
  messageTargetOrigin: () => Mr().messageTargetOrigin(),
  readerJobId: () => Mr().readerJobId()
}, ii = () => {
  var e;
  return ((e = Ne()) == null ? void 0 : e.liveTranslation) ?? null;
}, jt = () => {
  var t;
  const e = Ne();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, qe = () => {
  const e = Ne();
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
}, ci = (...e) => {
  var t, n;
  return ((n = (t = Ne()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, li = () => {
  var e, t;
  return ((t = (e = Ne()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, ui = (...e) => {
  var t, n;
  return ((n = (t = Ne()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, di = (...e) => {
  var t, n;
  return ((n = (t = Ne()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? ls(...e);
}, fi = (...e) => {
  var t, n;
  return ((n = (t = Ne()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? us(...e);
}, mi = (...e) => Mt("downloadProtectedResource")(...e), hi = (...e) => Mt("failDownloadToast")(...e), ag = (e, t) => Mt("resolveMarkdownAssetUrl")(e, t), _r = "/api/v1";
function pi() {
  const e = () => {
    var r;
    return ms(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = P(e);
  return O(() => {
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
function gi() {
  const e = pi(), t = q(() => ui(Go), [e]), n = q(() => li(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function bi(e) {
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
  }), d = c.documentId === t ? c.jobId : "", f = u.documentId === t ? u.jobId : "", g = n || d, [h, b] = P({
    jobId: "",
    documentId: ""
  }), w = h.jobId === g ? h.documentId : "", v = t || w, y = !!t && !g, [S, k] = P(null), R = (S == null ? void 0 : S.sessionIdentity) === r && S.documentId === v ? S : null, N = y || !!R, z = A((_) => {
    const I = `${_.documentId || ""}`.trim();
    if (!I || a.current && a.current !== I) return;
    if (!a.current && s.current)
      b({
        jobId: s.current,
        documentId: I
      });
    else if (!a.current)
      return;
    const T = `${_.revision || ""}`.trim() || `${Date.now()}`;
    k({
      documentId: I,
      revision: T,
      sessionIdentity: o.current
    }), i();
  }, []);
  O(() => {
    k((_) => _ && _.sessionIdentity !== r ? null : _);
  }, [r]);
  const $ = A((_) => {
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
        b((I) => I.jobId === _.jobId && I.documentId === _.documentId ? I : { jobId: _.jobId, documentId: _.documentId });
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
    setResolvedJobDocument: b,
    jobDocumentId: w,
    documentId: v,
    sourceOnly: y,
    committedDocumentSource: S,
    setCommittedDocumentSource: k,
    activeCommittedDocumentSource: R,
    sourceViewOnly: N,
    refreshCommittedDocument: z,
    applyIdentityEvent: $
  };
}
function Nr(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function yi(e) {
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
  return si(An(e, t));
}
function vi(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function wi(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !vi(a, t))
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
        type: ai.progress,
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
function Si(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = P(null), [l, u] = P(null), [m, d] = P(""), [f, g] = P(0), h = m === n ? i : null, b = m === n ? l : null, w = Nr(h), v = Bt(w), y = A(() => {
    g(($) => $ + 1);
  }, []), S = A(($) => {
    c($.jobPayload), u($.manifestPayload), d($.sessionIdentity);
  }, []), k = A(($) => {
    c(null), u(null), d($);
  }, []), R = M(""), N = M(""), z = A(async () => {
    const $ = o.current;
    if (!$ || R.current === $) return;
    const _ = qe().loadJobPayload;
    if (typeof _ != "function") return;
    const I = a.current.value;
    R.current = $;
    try {
      const T = await _($);
      if (s.current || a.current.value !== I || o.current !== $ || !T || typeof T != "object")
        return;
      const E = Nr(T);
      c(T), d(r.current), !Bt(E) && N.current === $ && (N.current = ""), E === "succeeded" && N.current !== $ && (N.current = $, g((L) => L + 1));
    } catch {
    } finally {
      R.current === $ && (R.current = "");
    }
  }, []);
  return O(() => {
    N.current = "";
  }, [n]), O(() => {
    if (!t || v || !h) return;
    const $ = window.setInterval(() => {
      document.visibilityState !== "hidden" && z();
    }, 1e3);
    return () => window.clearInterval($);
  }, [v, z, h, t]), {
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
    refreshJobStatus: z,
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
function ki(e, t) {
  e(t), Dn(t);
}
function Ii(e) {
  const [t, n] = P(e ? "source" : "compare"), r = A((a) => {
    e && a !== "source" || (n(a), Dn(a));
  }, [e]), o = A((a) => {
    ki(n, a);
  }, []);
  return O(() => (e && document.documentElement.classList.add("reader-source-only"), Dn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function xr(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function Ti(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: xr(n.active_job_id),
    activeVersionId: xr(n.active_version_id)
  };
}
function Ri(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Ei(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Pi(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Mi = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function _i(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Mi.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const Ni = 48 * 1024 * 1024;
function Ai(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const xi = 2, _e = /* @__PURE__ */ new Map();
function Cn(e, t) {
  _e.delete(e), _e.set(e, t);
}
function Lr(e) {
  if (_e.size < xi) return;
  const t = _e.keys().next().value;
  t && _e.delete(t);
}
async function Li(e) {
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
  var u, m, d, f, g, h, b, w, v;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (_e.has(r)) {
    const y = _e.get(r);
    return Cn(r, y), y;
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
    const y = new Error(`读取 PDF 失败 (${s.status})`);
    y.status = s.status;
    const S = await Li(s);
    throw S && (y.reason = S), y;
  }
  const i = Di(r, s, t);
  if (i) {
    o.abort();
    const y = { ranged: i };
    return Lr(), _e.set(r, y), y;
  }
  (b = (h = n.signal) == null ? void 0 : h.addEventListener) == null || b.call(h, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (v = (w = n.signal) == null ? void 0 : w.removeEventListener) == null || v.call(w, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return _e.has(r) ? Cn(r, l) : (Lr(), _e.set(r, l)), l;
}
function Di(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < Ni ? null : {
    url: e,
    length: o,
    async fetchRange(i, c) {
      const l = await n(e, { headers: { Range: `bytes=${i}-${c - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const Ci = { file: null, loading: !1, error: "" }, Oi = { file: null, loading: !0, error: "" };
function $i(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = P(null);
  if (O(() => {
    if (t || !n) return;
    const s = _e.get(n);
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
  if (!n) return Ci;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = _e.get(n);
  return a ? { file: a, loading: !1, error: "" } : Oi;
}
function zi(e) {
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
async function Fi(e) {
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
function Bi(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function ji({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = ws,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(Bi(o.href, t, a)), !0);
}
const Yt = {
  regions: null,
  metadata: null
};
function Hi(e) {
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
    closingRef: b,
    activeLoadAbortRef: w
  } = e, [v, y] = P(""), [S, k] = P(""), [R, N] = P(null), [z, $] = P(null), [_, I] = P(!1), [T, E] = P(""), [L, C] = P([]), [K, U] = P(!1), [G, oe] = P(() => ({
    source: null,
    translated: null
  })), [Z, ne] = P(
    Yt
  ), [j, W] = P({
    loading: !0,
    percent: 4,
    text: je.boot,
    stage: "progress",
    failed: !1
  });
  return O(() => {
    const x = new AbortController(), J = h.current.value, H = zi({
      sessionEpochRef: h,
      closingRef: b,
      abort: x,
      sessionEpoch: J
    });
    w.current = x;
    const V = qe();
    if (b.current)
      return x.abort(), () => {
        w.current === x && (w.current = null);
      };
    let ae = !1;
    function se(ie, me) {
      H.markFailed(), U(!0), W({
        loading: !1,
        percent: 100,
        text: ie,
        stage: "failed",
        failed: !0
      }), Ln({ percent: 100, text: me, stage: "failed" });
    }
    function le() {
      I(!0), ae || U(!0), W({
        loading: !1,
        percent: 100,
        text: je.ready,
        stage: "ready",
        failed: !1
      }), Ln({ percent: 100, text: je.ready, stage: "ready" });
    }
    function be() {
      return l != null && l.documentId ? Ar(
        l.documentId,
        l.revision
      ) : ri() ? oi : V.resolveResourceUrl(An(r));
    }
    async function pe() {
      var Q;
      let ie = { activeJobId: "", activeVersionId: "" };
      try {
        const ce = await ((Q = V.fetchDocument) == null ? void 0 : Q.call(V, r));
        ce && (ie = Ti(ce));
      } catch {
      }
      const me = Ri({
        link: ie,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (me.kind === "follow-active-job") {
        if (H.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: me.jobId
        }), me.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: me.activeVersionId,
          sessionIdentity: c
        }), f("source")) : f("compare");
        return;
      }
      if (me.kind === "open-committed-source") {
        if (H.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: me.revision,
          sessionIdentity: c
        }), f("source");
        return;
      }
      const ye = be();
      if (H.isInactive()) return;
      y(ye), k(""), E(""), d(c);
      const B = await On({
        url: ye,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: H,
        setBoot: W
      });
      if (!H.isInactive()) {
        if (!B) {
          se("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        N(B), le();
      }
    }
    async function nt() {
      var Zt;
      const ie = !l, me = !!(ie && V.loadSessionSnapshot && V.loadReaderOptionalArtifacts), ye = me ? V.loadReaderOptionalArtifacts(t) : null, B = await ((Zt = V.loadSessionSnapshot) == null ? void 0 : Zt.call(V, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: ie && !me
      })), Q = B ? {
        jobPayload: B.sourcePayload,
        manifestPayload: B.manifestPayload,
        readerMetadata: B.readerMetadata,
        regionsPayload: B.regions,
        readerErrors: B.readerErrors
      } : await V.loadReaderPayload(t, {
        includeOptionalArtifacts: ie
      });
      if (H.isInactive()) return;
      let ce = null;
      if (n && !r)
        if (B && B.linkedDocument !== void 0)
          ce = B.linkedDocument;
        else {
          try {
            ce = await V.fetchDocumentByJobId(_r, t);
          } catch {
          }
          if (H.isInactive()) return;
        }
      const Le = yi(Q.jobPayload) || `${(ce == null ? void 0 : ce.document_id) || ""}`.trim();
      Le && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Le
      });
      const Ee = Ei({
        payloadDocumentId: Le,
        linkedActiveJobId: `${(ce == null ? void 0 : ce.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(ce == null ? void 0 : ce.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (Ee.kind === "restore-committed-source") {
        if (H.isInactive()) return;
        u({
          type: "committed-source",
          documentId: Ee.documentId,
          revision: Ee.revision,
          sessionIdentity: c
        }), f("source");
        return;
      }
      const Pe = V.resolveReaderSourcePdf(Q.manifestPayload), Be = V.resolveReaderTranslatedPdfUrl(Q.jobPayload, Q.manifestPayload), Oe = typeof Pe == "string" ? Pe : V.resolveReaderArtifactUrl(Pe), he = r || Le, Te = l != null && l.documentId ? Ar(
        l.documentId,
        l.revision
      ) : Oe || (he ? V.resolveResourceUrl(An(he)) : ""), Me = l ? "" : Be || "";
      y(Te || ""), k(Me), E(wi(Q.jobPayload, t)), m({
        jobPayload: Q.jobPayload || null,
        manifestPayload: Q.manifestPayload || null,
        sessionIdentity: c
      });
      const rt = () => Fi({
        sourceFinal: Te || "",
        translatedFinal: Me,
        fence: H,
        setBoot: W
      }), pt = !!(Te || Me), gt = ye && pt ? rt() : null;
      gt == null || gt.catch(() => {
      });
      const Xt = (F) => {
        H.isInactive() || (C(l ? [] : Bo(F.regionsPayload)), oe(l ? { source: null, translated: null } : ps(F.readerMetadata)), ne(l ? Yt : F.readerErrors ?? Yt), U(!0));
      };
      if (ye ? (ae = !0, ye.then(Xt)) : Xt(Q), !pt) {
        se(je.failed, je.failed);
        return;
      }
      const bt = await (gt ?? rt());
      if (bt.status !== "inactive") {
        if (bt.status === "incomplete") {
          se("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        N(bt.sourceBytes), $(bt.translatedBytes), le();
      }
    }
    async function xe() {
      I(!1), N(null), $(null), C([]), U(!1), oe({ source: null, translated: null }), ne(Yt), sn(W, 8, je.metadata, "metadata");
      try {
        if (s) {
          await pe();
          return;
        }
        if (!t) {
          se(je.failed, je.failed);
          return;
        }
        await nt();
      } catch (ie) {
        if (H.isClosedOrStale() || (ie == null ? void 0 : ie.name) === "AbortError") return;
        H.markFailed();
        const me = Number(ie == null ? void 0 : ie.status), ye = `${(ie == null ? void 0 : ie.reason) || ""}`, B = _i({ status: me, reason: ye, sessionJobId: t });
        if (B && (await ji({
          apiPrefix: _r,
          documentId: B,
          expiredJobId: t
        }) || H.isClosedOrStale()))
          return;
        if (Pi({
          status: me,
          reason: ye,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), f("source");
          return;
        }
        const Q = ie instanceof Error ? ie.message : je.failed;
        se(Q, Q);
      }
    }
    return xe(), () => {
      x.abort(), w.current === x && (w.current = null);
    };
  }, [t, r, o, a, s, i, l, g, n, c, u, m, d, f]), {
    sourceUrl: v,
    translatedUrl: S,
    sourceFile: R,
    translatedFile: z,
    assetsReady: _,
    title: T,
    regions: L,
    regionsSettled: K,
    readerMetadata: G,
    readerErrors: Z,
    boot: j
  };
}
function Ui() {
  const e = M(!1), t = M(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = gi(), s = M({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = M(a), c = M(""), l = M(""), u = M(() => {
  }), m = A(() => u.current(), []), d = bi({
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
    sourceViewOnly: b
  } = d, { mode: w, setMode: v, switchSessionMode: y } = Ii(b);
  u.current = () => {
    y("source");
  }, i.current = a, c.current = g, l.current = f;
  const S = Si({
    sessionJobId: f,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: k,
    scopedManifestPayload: R,
    jobStatus: N,
    jobTerminal: z,
    jobRefreshRevision: $,
    refreshJobArtifacts: _,
    refreshJobStatus: I
  } = S, T = Hi({
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
    jobRefreshRevision: $,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), E = A(() => {
    var C;
    e.current = !0, (C = t.current) == null || C.abort();
  }, []), L = q(
    () => ({
      fetchProtected: qe().fetchProtected,
      jobId: f,
      jobPayload: k,
      manifestPayload: R,
      sourceUrl: T.sourceUrl,
      translatedUrl: T.translatedUrl,
      sourceOnly: b
    }),
    [f, k, R, T.sourceUrl, T.translatedUrl, b]
  );
  return {
    jobId: f,
    jobStatus: N,
    workflow: `${(k == null ? void 0 : k.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: z,
    documentId: g,
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
    download: L,
    refreshJobArtifacts: _,
    refreshJobStatus: I,
    refreshCommittedDocument: d.refreshCommittedDocument,
    prepareClose: E
  };
}
const Wi = 160, Ki = 8, Vi = 0;
function qi() {
  const e = M(null), [t, n] = P(null), [r, o] = P(Vi), a = A((s) => {
    e.current = s, n(s);
  }, []);
  return O(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (l) => {
      !Number.isFinite(l) || l < Wi || o((u) => Math.abs(u - l) < Ki ? u : l);
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
function Ji(e) {
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
function Gi(e, t) {
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
  })), [f, g] = P(() => ({ identity: l, tick: 0 })), h = m.identity === l ? m.pages : wn, b = f.identity === l ? f.tick : 0, w = Ji({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: v } = w, y = A((I, T) => {
    u.current === l && d((E) => {
      const L = E.identity === l ? E.pages : wn;
      return L[T] === I && E.identity === l ? E : {
        identity: l,
        pages: { ...L, [T]: I }
      };
    });
  }, [l]), S = M(null), k = A(() => {
    S.current && clearTimeout(S.current);
    const I = l;
    S.current = setTimeout(() => {
      S.current = null, u.current === I && g((T) => ({
        identity: I,
        tick: T.identity === I ? T.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  O(() => (S.current && (clearTimeout(S.current), S.current = null), d((I) => I.identity === l && I.pages.source === 0 && I.pages.translated === 0 ? I : { identity: l, pages: { source: 0, translated: 0 } }), g((I) => I.identity === l && I.tick === 0 ? I : { identity: l, tick: 0 }), () => {
    S.current && (clearTimeout(S.current), S.current = null);
  }), [l]);
  const R = q(
    () => Math.max(h.source, h.translated),
    [h]
  ), N = v === "translated" ? h.translated : h.source || h.translated, z = t == null ? void 0 : t.userZoom, $ = t == null ? void 0 : t.shellWidth, _ = `${l}-${b}-${z}-${n}-${h.source}-${h.translated}-${$}`;
  return {
    ...w,
    numPagesByPane: h,
    hudNumPages: R,
    primaryNumPages: N,
    metricsTick: b,
    onNumPages: y,
    onMetrics: k,
    rowSyncRevision: _
  };
}
const Ie = "data-reader-page", Se = "data-reader-pane", Qn = "data-natural-height", Xi = "reader-react-root", Zo = "reader-react-grid", Yo = "reader-react-scroll-shell", pn = "reader-react-pdf-pane", Qo = "reader-react-pdf-page", cn = "reader-react-pdf-page-placeholder", er = "reader-react-pdf-page-slot";
function ln(e, t) {
  const n = e != null ? `[${Ie}="${e}"]` : `[${Ie}]`;
  return t ? `${n}[${Se}="${t}"]` : n;
}
function tr() {
  return `.${er}[${Ie}]`;
}
function un(e) {
  return Number(e.getAttribute(Ie));
}
const ea = 0.25, dn = 1, Zi = 0.05, Jt = 0.5, Yi = 16, Qi = 8, ta = Yi + Qi, ec = 720;
function Qe() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function na(e) {
  return Number.isFinite(e) && e < ec;
}
function St(e, t = Number.POSITIVE_INFINITY) {
  return na(t) && (e === "source" || e === "translated") ? dn : Jt;
}
function Ke(e) {
  return Number.isFinite(e) ? Math.min(dn, Math.max(ea, e)) : Jt;
}
function Ht(e, t) {
  const n = Ke(Number(e) + t * Zi);
  return Math.round(n * 100) / 100;
}
function tc(e) {
  return Math.round(Ke(e) * 100);
}
function ra(e) {
  const n = (Number(e) || 0) - ta;
  return Math.max(160, Math.floor(n));
}
function nc(e, t = Jt) {
  const n = Ke(t);
  return ra((Number(e) || 0) * n);
}
function rc(e, t) {
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
const oc = 8;
function ac(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < oc ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const oa = 200, sc = [
  "markdown"
], ic = sc;
function aa(e) {
  return ic.includes(e);
}
const cc = "retainpdf:reader:view:v1:", Dr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), lc = /* @__PURE__ */ new Set([
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
function uc({
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
  return t ? `${cc}${t}` : "";
}
function dc(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function fc(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!Dr.has(t) || !Dr.has(n) || t === n))
    return { left: t, right: n };
}
function mc(e) {
  return e === null ? null : aa(e) ? e : void 0;
}
function hc(e) {
  return lc.has(e) ? e : void 0;
}
function ca(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = dc(t.anchor), r = Number(t.zoom), o = hc(t.mode), a = fc(t.splitLayout), s = mc(t.assistantPanel);
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
function Fe(e, t = sa()) {
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
  const o = Fe(e, n), a = ca({
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
function pc(e, t, n = "") {
  var d;
  const [r, o] = P(() => {
    var f;
    return ((f = Fe(n)) == null ? void 0 : f.zoom) ?? St(e, Qe());
  }), a = M(r), s = M(n);
  a.current = r;
  const i = M(1), c = M(((d = Fe(n)) == null ? void 0 : d.zoom) !== void 0);
  O(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const f = (h = Fe(n)) == null ? void 0 : h.zoom;
    c.current = f !== void 0;
    const g = f ?? St(e, Qe());
    i.current = 1, a.current = g, o(g);
  }, [e, n]), O(() => {
    if (c.current) return;
    const f = St(e, Qe()), g = a.current;
    Math.abs(f - g) < 5e-4 || (i.current = 1, a.current = f, o(f));
  }, [e]);
  const l = A((f, g) => {
    const h = Ke(f), b = a.current;
    Math.abs(h - b) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : h / (b || 1), a.current = h, c.current = !0, gn(s.current, { zoom: h }), o(h));
  }, []), u = A((f) => {
    l(Ht(a.current, f));
  }, [l]), m = A((f) => {
    l(St(f));
  }, [l]);
  return Re(() => {
    const f = i.current;
    Math.abs(f - 1) < 1e-3 || (i.current = 1, rc(t == null ? void 0 : t.current, f));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: m };
}
const gc = 160, bc = 3e-3, Cr = 50, yc = 16, vc = 800;
function wc(e, t = 0) {
  const n = t === 1 ? yc : t === 2 ? vc : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-Cr, Math.min(Cr, r));
  return Math.exp(-o * bc);
}
function Sc(e, t, n = 0) {
  return Ke(e * wc(t, n));
}
function kc(e) {
  return Math.round(Ke(e) * 100) / 100;
}
function Ic(e, t, n) {
  const r = Ke(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return Ke(t) / r;
  const a = (o + ta) / r;
  return ra(a * Ke(t)) / o;
}
function Tc(e) {
  return Array.from(e.querySelectorAll(tr()));
}
function Rc(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function Ec(e, t, n) {
  let r = null;
  for (const s of Tc(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const c = Rc(i, t, n);
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
function Pc(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function la(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${tr()}[${Ie}="${t.page}"][${Se}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (Pc(n, e).scrollLeft += a);
}
function Mc(e, t, n, r) {
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
const _c = 600, Nc = 1e3;
function Ac(e, t) {
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
  const c = r.setTimeout(() => l(), Nc);
  function l() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(c);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return l;
}
function xc(e, t, n) {
  const r = M(t);
  r.current = t;
  const o = M(n);
  o.current = n;
  const a = M(null), s = M(null), i = M(null);
  O(() => {
    if (!e) return;
    const c = () => {
      const u = a.current;
      if (a.current = null, !u) return;
      const m = kc(u.target);
      if (Math.abs(m - r.current) < 5e-3) {
        Nt(u.grid);
        return;
      }
      const d = { anchor: u.anchor, grid: u.grid, fallback: null };
      d.fallback = setTimeout(() => {
        s.current === d && (s.current = null, Nt(d.grid));
      }, _c), s.current = d, o.current(m, { keepScroll: !1 });
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
          anchor: Ec(e, u.clientX, u.clientY),
          grid: null,
          timer: null
        }, a.current = m;
      }
      m.target = Sc(m.target, u.deltaY, u.deltaMode);
      const d = Ic(m.start, m.target, ((g = m.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      m.grid = Mc(e, d, u.clientX, u.clientY) ?? m.grid, m.timer && clearTimeout(m.timer), m.timer = setTimeout(c, gc);
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
    c && (s.current = null, c.fallback && clearTimeout(c.fallback), Nt(c.grid), !(!e || !c.anchor) && (la(e, c.anchor), (l = i.current) == null || l.call(i), i.current = Ac(e, c.anchor)));
  }, [t, e]);
}
function Lc(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = M(t), a = M(n), s = M(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: A((c) => {
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
function Dc(e, t, n = "smooth", r) {
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
function Cc(e, t, n) {
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
function De(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function Oc(e, t, n = !0, r = "", o) {
  const [a, s] = P(1);
  return O(() => {
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
const $c = `canvas, .react-pdf__Page, .${Qo}, .${cn}`, Or = /* @__PURE__ */ new WeakMap();
function zc(e) {
  const t = Number(e.getAttribute(Qn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Or.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector($c), Or.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Fc(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Bc(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(tr()).forEach((r) => {
    const o = un(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = zc(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function jc(e, t, n = "", r) {
  const [o, a] = P(() => /* @__PURE__ */ new Map()), s = M(o), i = M(r);
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
      const S = Bc(y);
      Fc(s.current, S) || (s.current = S, a(S)), u && !m && (m = !0, (k = i.current) == null || k.call(i));
    }, f = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(d);
      });
    };
    f();
    const g = window.setTimeout(f, 100), h = window.setTimeout(() => {
      u = !0, f();
    }, 300), b = window.setTimeout(f, 700), w = e.current;
    let v = null;
    return w && typeof ResizeObserver < "u" && (v = new ResizeObserver(() => f()), v.observe(w)), () => {
      c = !0, cancelAnimationFrame(l), window.clearTimeout(g), window.clearTimeout(h), window.clearTimeout(b), v == null || v.disconnect();
    };
  }, [e, t, n]), o;
}
const Hc = [0, 48, 140, 320, 560], Uc = 700, Wc = [80, 200, 400], Kc = 500, Vc = 50, qc = /* @__PURE__ */ new Set([
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
]), Jc = 180, $r = [0, 48, 140, 320, 700, 1200];
function Gc(e, t) {
  var T;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = M(
    ((T = Fe(a)) == null ? void 0 : T.anchor) || { page: 1, fraction: 0 }
  ), c = M(null), l = M(!1), u = M(r), m = M(null), d = M(null), f = M(null), g = M(null), h = M(a), b = M(""), w = M(n);
  w.current = n;
  const v = A(() => {
    var E;
    (E = m.current) == null || E.call(m), m.current = null, d.current != null && (clearTimeout(d.current), d.current = null);
  }, []), y = A(() => {
    !l.current && c.current == null || (v(), f.current != null && (clearTimeout(f.current), f.current = null), c.current = null, l.current = !1);
  }, [v]), S = A((E = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const L = () => {
      g.current = null, gn(h.current, {
        anchor: De(i.current)
      });
    };
    E ? L() : g.current = setTimeout(L, Jc);
  }, []), k = A((E) => {
    i.current = De(E), c.current = null, f.current != null && clearTimeout(f.current), f.current = setTimeout(() => {
      f.current = null, l.current = !1;
    }, Vc);
  }, []);
  O(() => {
    if (!o)
      return;
    let E = !1, L = null, C = null, K = null;
    const U = () => {
      if (E) return;
      const G = e.current;
      if (!G) {
        K = setTimeout(U, 50);
        return;
      }
      L = G, C = () => {
        if (l.current)
          return;
        const oe = zt(L, w.current);
        oe && (i.current = oe, S());
      }, L.addEventListener("scroll", C, { passive: !0 }), l.current || C();
    };
    return U(), () => {
      E = !0, K != null && clearTimeout(K), L && C && L.removeEventListener("scroll", C);
    };
  }, [o, r, n, e, S]), O(() => {
    if (!o) return;
    const E = e.current;
    if (!E) return;
    const L = (C) => {
      C.metaKey || C.ctrlKey || C.altKey || qc.has(C.key) && y();
    };
    return E.addEventListener("wheel", y, { passive: !0 }), E.addEventListener("touchmove", y, { passive: !0 }), window.addEventListener("keydown", L), () => {
      E.removeEventListener("wheel", y), E.removeEventListener("touchmove", y), window.removeEventListener("keydown", L);
    };
  }, [o, e, y]), Re(() => {
    var L;
    if (h.current === a) return;
    S(!0), v(), f.current != null && (clearTimeout(f.current), f.current = null), h.current = a, b.current = "";
    const E = (L = Fe(a)) == null ? void 0 : L.anchor;
    i.current = E ? De(E) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, u.current = r;
  }, [a, r, S, v]), O(() => {
    var L;
    if (!o || !s || !a || b.current === a) return;
    b.current = a;
    const E = De(
      ((L = Fe(a)) == null ? void 0 : L.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = E, c.current = E, l.current = !0, v(), m.current = zn(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: w.current,
        delaysMs: $r,
        onDone: () => k(E)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(E);
    }, Math.max(...$r) + 160), () => v();
  }, [o, s, a, e, k, v]), O(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, c.current = null, v();
      return;
    }
    const E = c.current ? De(c.current) : De(i.current);
    return l.current = !0, c.current = E, i.current = E, v(), m.current = zn(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Hc,
        onDone: () => k(E)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(E);
    }, Uc), () => {
      v();
    };
  }, [r, o, n, e, k, v]), O(() => () => {
    v(), f.current != null && (clearTimeout(f.current), f.current = null), S(!0);
  }, [v, S]);
  const R = A(() => {
    const E = zt(
      e.current,
      w.current
    );
    return De(E || i.current);
  }, [e]), N = A(() => {
    l.current = !0;
    const E = zt(
      e.current,
      w.current
    ), L = De(E ?? i.current);
    return i.current = L, c.current = L, S(), L;
  }, [e, S]), z = A((E, L, C) => {
    const K = C || w.current, U = fn(E, L || 1), G = { page: U, fraction: 0 };
    i.current = G, l.current = !0, c.current = G, S(), v(), Dc(e.current, U, "smooth", K), m.current = Cc(
      () => e.current,
      U,
      {
        behavior: "auto",
        pane: K,
        delaysMs: Wc,
        onDone: () => k(G)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(G);
    }, Kc);
  }, [e, k, v, S]), $ = A(() => De(i.current), []), _ = A(() => l.current, []), I = A(() => {
    if (!l.current || !c.current)
      return;
    const E = De(c.current);
    Et(
      e.current,
      E,
      "auto",
      w.current
    );
  }, [e]);
  return {
    lockFromShell: R,
    beginModeSwitch: N,
    goToPage: z,
    getAnchor: $,
    isRestoring: _,
    repinIfRestoring: I
  };
}
function Xc(e, t) {
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
const Zc = [0, 80, 200, 400, 800], Yc = 120, Qc = 400;
function el(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: c, documentId: l, regionsSettled: u = !0 } = e, m = M(a);
  m.current = a;
  const d = M(s);
  d.current = s;
  const f = M(i);
  f.current = i;
  const g = M(n);
  g.current = n, O(() => {
    var S, k;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = ci(), b = Xc(h, d.current);
    if (b == null && (h != null && h.blockId) && !u) return;
    const w = fa(h, b, { jobId: c, documentId: l });
    if (t.current === w)
      return;
    if (b == null) {
      t.current = w, (S = g.current) == null || S.call(g);
      return;
    }
    t.current = w, h && ((k = f.current) == null || k.call(f, h, b));
    const v = [];
    let y = 0;
    for (const R of Zc)
      y = Math.max(y, R), v.push(
        setTimeout(() => {
          m.current(b);
        }, R)
      );
    return v.push(
      setTimeout(() => {
        var R;
        (R = g.current) == null || R.call(g);
      }, y + Yc)
    ), () => {
      for (const R of v) clearTimeout(R);
    };
  }, [r, o, c, l, t, u]);
}
function tl(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function nl(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = Qc,
    jobId: i,
    documentId: c,
    applyReaderSearch: l
  } = e, u = M(a);
  u.current = a;
  const m = M(l);
  m.current = l;
  const d = M(0);
  O(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || d.current === o) return;
    const f = setTimeout(() => {
      var w;
      const g = ((w = globalThis.location) == null ? void 0 : w.search) || "", h = hs(g, o, u.current);
      if (d.current = o, h === null) return;
      const b = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = fa(
        { blockId: b },
        o,
        { jobId: i, documentId: c }
      ), (m.current || tl)(h);
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
function rl(e) {
  const t = M(""), [n, r] = P(!1), o = A(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  el(a, t, o), nl(e, t, n);
}
const At = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function ol(e) {
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
function al(e, t, n) {
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
function sl(e) {
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
function il(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function cl(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function ll(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function ul(e) {
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
  return Ss(e) ? `${e.code || ""}`.trim() : "";
}
function Qt(e, t) {
  const n = rr(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function dl(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (ma(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
        return c;
      a = ks(
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
function fl({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = P(At), s = M(o), i = M("");
  s.current = o;
  const c = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = Bt(l) ? l : "";
  return O(() => {
    if (!n || !c) {
      i.current = "", s.current = At, a(At);
      return;
    }
    const m = r === void 0 ? ii() : r, d = i.current === c;
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
    let g = !1;
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
          g = !0, b((k) => ({
            ...k,
            layoutByPage: ol(S),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (S) {
          if ((S == null ? void 0 : S.name) === "AbortError") return;
          const k = rr(S);
          if (!(k === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !k)) {
            b((N) => ({
              ...N,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: Qt(S, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            b((N) => ({
              ...N,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          b((N) => ({
            ...N,
            connection: "connecting",
            jobStatus: l,
            error: Qt(S, "正在等待 OCR 版面数据")
          })), await Fn(Fr[Math.min(y, Fr.length - 1)], f.signal).catch(() => {
          }), y += 1;
        }
    };
    return (async () => {
      if (await w(), !g || f.signal.aborted) return;
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
                k = await dl(
                  c,
                  S,
                  s.current,
                  f.signal,
                  m
                );
              } catch (R) {
                if ((R == null ? void 0 : R.name) === "AbortError" || f.signal.aborted) throw R;
                b((N) => ({
                  ...N,
                  lastSeq: Math.max(N.lastSeq, S.seq),
                  error: Qt(R, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              b((R) => {
                const N = al(R, S, k);
                return u ? {
                  ...N,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...N,
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
function ml(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), c = Number(s.count) || 0;
    i && c > 0 && o.set(i, c);
  }
  return o;
}
function hl(e, t = !0) {
  const [n, r] = P(() => /* @__PURE__ */ new Map());
  return O(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = qe().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(ml(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const pl = 4500;
function gl(e) {
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
const bl = /* @__PURE__ */ new Set(["book", "translate"]);
function ha(e) {
  return !!(e.jobId && e.sourceUrl && bl.has(e.workflow));
}
function yl(e) {
  return !!(ha(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function vl() {
  const e = Ui(), t = ha({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = yl({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = M({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Bt(o) && (r.current.running = !0);
  const a = fl({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = qi(), u = hl(e.jobId, !e.sourceOnly), m = uc({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${m}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: f, onZoomChange: g } = pc(e.mode, s, m);
  xc(i, f, g);
  const h = Gi(
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
  } = Gc(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: m,
    restoreReady: h.primaryNumPages > 0
  });
  O(() => {
    v();
  }, [c, v]);
  const y = jc(
    s,
    h.compareMode,
    h.rowSyncRevision,
    v
  ), S = Oc(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${f}-${h.metricsTick}`,
    h.primaryPane
  ), k = A((U, G) => {
    var Z, ne;
    const oe = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((Z = h.numPagesByPane) == null ? void 0 : Z.source) || 0,
      Number((ne = h.numPagesByPane) == null ? void 0 : ne.translated) || 0
    );
    w(U, oe, G);
  }, [w, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [R, N] = P(null), z = M(null), $ = A((U) => {
    z.current && clearTimeout(z.current), N(U), U && (z.current = setTimeout(() => N(null), pl));
  }, []);
  O(() => () => {
    z.current && clearTimeout(z.current);
  }, []);
  const _ = A((U) => {
    const G = vn(e.regions, U);
    return G ? Pr(G, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), I = A((U, G) => {
    const oe = G || h.primaryPane, Z = typeof U == "object" && U ? `${U.block_id || ""}`.trim() : "", ne = typeof U == "object" && U ? `${U.image_url || ""}`.trim() : "", j = typeof U == "object" && U ? U.page_idx != null ? Number(U.page_idx) + 1 : U.page != null ? Number(U.page) : null : typeof U == "number" ? U + 1 : null, W = gs(e.regions, ne, j) || vn(e.regions, Z) || (typeof U == "object" ? bs(e.regions, U) : null);
    let x = W ? Pr(W, oe).page : null;
    x == null && (x = gl(U)), !(x == null || x < 1) && ($(W), k(x, oe));
  }, [$, k, h.primaryPane, e.regions]);
  rl({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: S,
    goToPage: k,
    resolveBlockPage: _,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (U) => {
      $(vn(e.regions, U.blockId));
    }
  });
  const { setModeKeepingPage: T } = Lc({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: b
  });
  O(() => {
    $(null);
  }, [d, $]);
  const E = !e.boot.loading && !e.boot.failed, L = q(() => ({ bindShell: l, shellEl: i, shellWidth: c, shellRef: s }), [l, i, c, s]), C = q(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), K = q(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: f,
    onZoomChange: g,
    shell: L,
    panes: h,
    sessionFiles: C,
    rowHeights: y,
    goToPage: k,
    activeRegion: R,
    jumpToAnchor: I,
    setModeKeepingPage: T,
    download: e.download,
    showHud: E,
    viewStateKey: m,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, L, h, C, y, k, R, I, T, E, f, g, m, a, n, u]);
  return q(() => ({
    ...K,
    currentPage: S
  }), [K, S]);
}
const wl = [
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
], Sl = [
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
function kl(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of wl)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function Il(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const Tl = ".reader-notes-panel";
function Rl(e) {
  return e instanceof Element ? !!e.closest(Tl) : !1;
}
function El(e) {
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
    const m = (d) => {
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || Il(d.target) || Rl(d.target))
        return;
      const f = d.key, g = kl(f);
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
const Pl = "retainpdf:soft-reader-close";
function Ml() {
  return new URL("./index.html", window.location.href).href;
}
function _l() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Pl },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Nl(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Al() {
  if (!(typeof window > "u") && !_l()) {
    if (Nl(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Ml());
  }
}
function xl({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function Ll({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ D(xl, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Al();
  }, children: [
    /* @__PURE__ */ p(ft, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
const Dl = 3e3, Cl = 8;
async function Ol(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function $l(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function zl(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = Dl;
  const r = [], o = (s, i, c) => {
    const l = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const m = s[u], d = $l(m == null ? void 0 : m.title);
      if (!d) continue;
      n -= 1;
      const f = c ? `${c}.${u}` : `${u}`, g = { id: f, title: d, page: null, level: i, children: [] };
      r.push({ node: g, dest: m.dest }), l.push(g), i < Cl && Array.isArray(m.items) && m.items.length && (g.children = o(m.items, i + 1, f));
    }
    return l;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await Ol(e, i);
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
function Fl() {
  if (Hr)
    return;
  const e = jt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (Jo.GlobalWorkerOptions.workerSrc = e, Hr = !0);
}
const Ye = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Bl = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, jl = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Hl = {
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
function Ul(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Ur(o ?? a ?? "", Bl)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Ur(o ?? a ?? "", jl)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Hl[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Wl(e) {
  return Ye(e.translatedBlockText) || Ye(e.translated.text) || Ye(e.source.text);
}
const Kl = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Vl(e) {
  const t = [];
  for (const n of e) {
    if (!Kl(n)) continue;
    const r = Ul(Wl(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function ql(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const Jl = 24, Gl = 60;
function Wr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - Jl), o = Math.min(e.length, n + t.length + Gl), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function Xl(e, t, n = 200) {
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
function Zl(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const Yl = /^data-[a-z0-9-]+$/;
function Kr(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function Ql(e, t, n = "") {
  if (!t.length) return Dt(e, n);
  const r = t.filter((s) => s.end > s.start && s.start >= 0 && s.end <= e.length).map((s, i) => ({ mark: s, order: i })).sort((s, i) => s.mark.start - i.mark.start || s.order - i.order).map(({ mark: s }) => s);
  let o = "", a = 0;
  for (const s of r) {
    if (s.start < a) continue;
    o += Dt(e.slice(a, s.start), n);
    const i = Object.entries(s.attrs ?? {}).filter(([c]) => Yl.test(c)).map(([c, l]) => ` ${c}="${Kr(l)}"`).join("");
    o += `<mark class="${Kr(s.className)}"${i}>${Dt(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  }
  return o + Dt(e.slice(a), n);
}
function ge(e) {
  return typeof e == "string" ? e : "";
}
function eu(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function tu(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function nu(e) {
  return {
    source: ge(e == null ? void 0 : e.source_text) || ge(e == null ? void 0 : e.unit_source_text),
    translated: ge(e == null ? void 0 : e.protected_translated_text) || ge(e == null ? void 0 : e.translated_text)
  };
}
const ru = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function ba(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function ou(e) {
  const t = ba(e).sort((r, o) => ge(r.ts).localeCompare(ge(o.ts)));
  return t.length ? [
    { text: ge(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: ge(r.new_text),
      label: ru[ge(r.source)] || ge(r.source) || "修订",
      ts: ge(r.ts),
      reason: ge(r.reason)
    }))
  ].reverse() : [];
}
function au(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function su(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return ge(r.finished_at) || ge(n.finished_at) || "";
}
function iu(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = ba(e).sort((a, s) => ge(a.ts).localeCompare(ge(s.ts)));
  for (const a of o) {
    const s = new Date(ge(a.ts)).getTime(), i = ge(a.reader_item_id) || ge(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, ge(a.new_text));
  }
  return n;
}
const cu = {
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
function lu(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = cu[ge(n.kind)] || ge(n.kind) || "问题", o = ge(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const uu = /* @__PURE__ */ new Set(["text", "formula"]);
function or(e) {
  return uu.has(e);
}
function ya(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || or(Ae(n));
}
function du(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !or(Ae(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const fu = 300, mu = 72;
function hu(e, t) {
  if (e.width >= fu && e.height >= mu)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const pu = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function gu(e, t, n) {
  return e.flatMap((r) => {
    if (!pu.has(Ae(r.region))) return [];
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
async function bu(e) {
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
const yu = "reader-text-hover-copy", vu = "reader-text-hover-edit", wu = "reader-text-hover-zoom", Su = "reader-text-hover-id";
function ku(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const va = "reader-text-hover-tools";
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
const Iu = 26, Tu = 220;
function Ru(e, t = Tu) {
  return e.height < Iu * 2 || e.width < t;
}
function Eu({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? jo : e === "failed" ? ft : Rs, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function Pu({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  onZoom: o,
  frameRect: a,
  placement: s,
  tailTop: i = 0
}) {
  const [c, l] = P("idle"), [u, m] = P("idle"), [d] = P(() => ku()), f = M([]), g = (e == null ? void 0 : e.itemId) || "";
  if (O(() => {
    l("idle"), m("idle");
    const k = f.current;
    return () => {
      k.forEach((R) => window.clearTimeout(R)), f.current = [];
    };
  }, [g]), !e) return null;
  const h = ys(e.highlight.region, t), b = Ae(e.highlight.region), w = (k, R) => async (N) => {
    N.preventDefault(), N.stopPropagation();
    const z = await bu(k);
    R(z ? "copied" : "failed"), f.current.push(window.setTimeout(() => R("idle"), 1200));
  }, v = b === "formula" ? "复制 LaTeX" : "复制", y = a || e.rect, S = s || (Ru(y) ? "outside" : "inside");
  return /* @__PURE__ */ p("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ p(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": b,
      style: y,
      children: /* @__PURE__ */ D(
        "div",
        {
          className: va,
          "data-placement": S,
          style: S === "tail" ? { top: i } : void 0,
          children: [
            d ? /* @__PURE__ */ p(
              tn,
              {
                className: Su,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: w(e.itemId, m),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && or(b) ? /* @__PURE__ */ p(
              tn,
              {
                className: vu,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (k) => {
                  k.preventDefault(), k.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ p(Yn, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            h ? /* @__PURE__ */ p(
              tn,
              {
                className: yu,
                state: c,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: c === "copied" ? "已复制" : c === "failed" ? "复制失败" : v,
                onClick: w(h, l),
                children: /* @__PURE__ */ p(Eu, { state: c })
              }
            ) : null,
            o ? /* @__PURE__ */ p(
              tn,
              {
                className: wu,
                state: "idle",
                label: "放大看这一块",
                title: b === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (k) => {
                  k.preventDefault(), k.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ p(Ts, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Mu(e, t) {
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
function _u(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = dt(
      Mu(e, a),
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
const Nu = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Au = 256, xt = /* @__PURE__ */ new Map();
function xu(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function wa(e) {
  const t = `${e || ""}`, { text: n, slots: r } = ei(t, { bareLatex: !0 }), o = xu(n), a = ti(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = xt.get(t);
  if (!s && (s = ni(o, r), xt.set(t, s), xt.size > Au)) {
    const i = xt.keys().next().value;
    i !== void 0 && xt.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function kn(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Ue(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Lu(e, t) {
  const n = e.typography, r = Ue(t) || 1, o = Ue(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = kn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(s, i * r)), l = Ue(n == null ? void 0 : n.fit_min_font_size_pt), u = Ue(n == null ? void 0 : n.fit_max_font_size_pt), m = Math.max(3.5, (l || 5.5) * r), d = Math.max(
    m,
    u ? u * r : o ? o * r : c
  ), f = o ? o * r : c, g = Ue(n == null ? void 0 : n.leading_em), h = [
    Ue(n == null ? void 0 : n.padding_top_pt) || 0,
    Ue(n == null ? void 0 : n.padding_right_pt) || 0,
    Ue(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Ue(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((b) => b * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Nu,
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
function Du(e, t, n, r) {
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
const Cu = 512, Lt = /* @__PURE__ */ new Map();
let Bn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Bn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Bn += 1;
}));
function Ou(e, t, n, r) {
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
function Sa({ item: e, pageScale: t }) {
  const n = M(null), r = q(
    () => wa(e.translatedText),
    [e.translatedText]
  ), [o, a] = P(r.fallbackHtml), s = q(
    () => Lu(e, t),
    [e, t]
  );
  O(() => {
    let m = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((d) => {
      m && a(d);
    }), () => {
      m = !1;
    };
  }, [r]), Re(() => {
    const m = n.current;
    if (!m) return;
    const [d, f, g, h] = s.padding, b = Math.max(1, e.rect.width - h - f), w = Math.max(1, e.rect.height - d - g), v = Ou(o, b, w, s);
    let y = Lt.get(v);
    if (y === void 0 && (y = Du(
      (S) => (m.style.fontSize = `${S}px`, { width: m.scrollWidth, height: m.scrollHeight }),
      b,
      w,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), Lt.set(v, y), Lt.size > Cu)) {
      const S = Lt.keys().next().value;
      S !== void 0 && Lt.delete(S);
    }
    m.style.fontSize = `${y.toFixed(2)}px`;
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
function $u({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = q(
    () => _u(e, t, n, r),
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
        Sa,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const zu = Vt($u);
function Fu({
  targets: e,
  edits: t,
  width: n,
  excludeId: r
}) {
  const o = e.filter((a) => t.has(a.itemId) && a.itemId !== r);
  return o.length ? /* @__PURE__ */ p("div", { className: "reader-live-translation-overlay reader-edited-overlay", "aria-hidden": "true", children: o.map((a) => {
    const s = a.highlight.pageSize.width;
    return /* @__PURE__ */ D("div", { className: "reader-edited-block", "data-reader-edited-id": a.itemId, children: [
      /* @__PURE__ */ p(
        Sa,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: Ae(a.highlight.region),
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
const Bu = Vt(Fu), ka = 24, Xe = ka * 2 + 4, We = 24, ju = 4, Hu = 6, it = (e) => e.left + e.width, tt = (e) => e.top + e.height;
function Ct(e, t) {
  const n = Math.min(it(e), it(t)) - Math.max(e.left, t.left), r = Math.min(tt(e), tt(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const qr = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= it(t) && r >= t.top && r <= tt(t);
}, Uu = (e) => e.height > 40 && e.height > e.width * 2.5;
function Wu(e, t, n) {
  if (!t.length || e.height < We || e.width < n + 8) return null;
  const r = Math.max(...t.map(tt)), o = it(e) - 4 - n;
  for (const a of [r, tt(e) - 2]) {
    const s = Math.max(e.top, a - We), i = { left: o, top: s, width: n, height: We };
    if (!t.some((c) => Ct(i, c) > 0)) return s - e.top;
  }
  return null;
}
function Ku(e, t) {
  const n = [], r = (a) => {
    const s = ka + ju, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: it(e), top: i, width: s, height: Xe } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: Xe } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - We - 3, width: Xe, height: We + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: tt(e), width: Xe, height: We + 3 } }), r(!0);
  const o = Wu(e, t, Xe);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: it(e) - 4 - Xe, top: e.top + o, width: Xe, height: We } }), n;
}
function Vu(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((v) => v.width > 0 && v.height > 0 && !Uu(v)), i = s.filter((v) => qr(v, t)), c = s.filter((v) => !qr(v, t)), l = n.filter((v) => v !== t && Ct(v, t) < t.width * t.height * 0.5), u = Ku(t, i).filter(({ box: v, overhang: y }) => {
    const S = y ? Hu : 0;
    return v.left >= -S && it(v) <= r + S && v.top >= 0 && tt(v) <= o;
  }), m = ({ placement: v, tailTop: y }) => y === void 0 ? { placement: v } : { placement: v, tailTop: y }, d = ({ box: v }) => !c.some((y) => Ct(v, y) > 0), f = u.filter((v) => v.placement !== "tail"), g = f.find((v) => d(v) && !l.some((y) => Ct(v.box, y) > 0));
  if (g) return m(g);
  const h = f.find(d) || u.find((v) => v.placement === "tail" && d(v));
  if (h) return m(h);
  let b = null, w = Number.POSITIVE_INFINITY;
  for (const v of u) {
    const y = c.reduce((S, k) => S + Ct(v.box, k), 0);
    y < w && (b = v, w = y);
  }
  return b ? m(b) : { placement: "outside" };
}
function qu(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - We - 3 : tt(r);
  return t >= r.left - 4 && t <= r.left + Xe + 4 && n >= a && n <= a + We + 3;
}
const In = (e) => e.left + e.width, Tn = (e) => e.top + e.height;
function Ju(e, t, n = 3, r = 6) {
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
function Gu(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function Xu(e, t, n, r) {
  const [o, a] = P(null);
  return Re(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? Gu(s) : [], c = Ae(t.highlight.region) === "figure", l = i.length && !c ? Ju(t.rect, i) : t.rect, u = n.filter((d) => d.itemId !== t.itemId).map((d) => d.rect), m = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...Vu({ frame: l, others: u, pageWidth: r, pageHeight: m, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
function Zu({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = P(null), [i, c] = P(!1), [l, u] = P([]), [m, d] = P(""), [f, g] = P(""), [h, b] = P(!1), [w, v] = P(null), [y, S] = P([]), k = r.drafts, R = r.generation, N = A(async (I, T) => {
    if (e)
      try {
        u(ou(await e.fetchRevisions(I, T)));
      } catch {
        u([]);
      }
  }, [e]);
  O(() => {
    if (s(null), u([]), v(null), S([]), g(""), !e || !t || !n) return;
    let I = !1;
    return c(!0), e.loadItem(t, n).then((T) => {
      if (I) return;
      const E = T == null ? void 0 : T.item;
      if (!E) throw new Error("找不到这一段的译文。");
      const L = `${(T == null ? void 0 : T.item_id) || n}`, { source: C, translated: K } = nu(E);
      s({ readerItemId: n, itemId: L, source: C, current: K }), d(k.get(n) ?? K);
    }).catch((T) => {
      I || v({ tone: "error", message: (T == null ? void 0 : T.message) || "读取这段译文失败。" });
    }).finally(() => {
      I || c(!1);
    }), N(t, n), () => {
      I = !0;
    };
  }, [e, t, n, N]);
  const z = A((I) => {
    d(I), n && k.set(n, I);
  }, [n, k]), $ = A(async (I, T) => {
    if (!e || !a || h) return !1;
    const E = I ?? m;
    if (!E.trim()) return !1;
    b(!0), v(null), S([]);
    try {
      const L = await e.revise(t, a.itemId, {
        translated_text: E,
        source: "user",
        reason: (T ?? f).trim() || "在阅读页手动修改",
        ...R.current != null ? { expected_generation: R.current } : {}
      }), C = Number(L == null ? void 0 : L.generation);
      return Number.isFinite(C) && (R.current = C), k.delete(a.readerItemId), s({ ...a, current: E }), d(E), g(""), (L == null ? void 0 : L.changed) === !1 ? v({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, E), v({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), N(t, a.readerItemId), !0;
    } catch (L) {
      const C = L;
      return (C == null ? void 0 : C.reason) === "generation_mismatch" && (R.current = null), v({ tone: "error", message: (C == null ? void 0 : C.message) || "保存失败，请稍后再试。" }), S(lu(C == null ? void 0 : C.issues)), !1;
    } finally {
      b(!1);
    }
  }, [e, a, h, m, f, t, o, N, k, R]), _ = A(() => {
    n && k.delete(n);
  }, [n, k]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: l,
    draft: m,
    setDraft: z,
    reason: f,
    setReason: g,
    saving: h,
    status: w,
    issues: y,
    save: $,
    discardDraft: _
  };
}
const Ia = "reader-inline-edit";
function Yu({ text: e }) {
  const [t, n] = P("");
  return O(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = wa(e);
      n(a.fallbackHtml), a.richHtml.then((s) => {
        r && n(s);
      });
    }, 250);
    return () => {
      r = !1, window.clearTimeout(o);
    };
  }, [e]), t ? /* @__PURE__ */ D("div", { className: "reader-inline-edit-preview", "data-inline-edit-preview": "true", children: [
    /* @__PURE__ */ p("span", { className: "reader-inline-edit-preview-label", children: "预览" }),
    /* @__PURE__ */ p("div", { className: "reader-live-translation-content", dangerouslySetInnerHTML: { __html: t } })
  ] }) : null;
}
function Qu({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var _;
  const s = e.itemId, i = Zu({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = P(!1), [u, m] = P(!1), d = M(null), f = hu(e.rect, t), g = q(() => du(o), [o]), h = g.indexOf(s), { loaded: b } = i, w = i.saving || i.loading, v = n.blockedReason, y = !b || i.draft === b.current, { close: S, select: k } = n, R = A((I) => {
    const T = g[h + I];
    T && (k(T), a == null || a(T));
  }, [g, h, k, a]), N = A(() => {
    i.discardDraft(), S();
  }, [i, S]), z = A(async (I, T) => {
    await i.save(I, T) && S();
  }, [i, S]);
  O(() => {
    const I = (T) => {
      !T.altKey || T.key !== "ArrowUp" && T.key !== "ArrowDown" || (T.preventDefault(), R(T.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", I), () => window.removeEventListener("keydown", I);
  }, [R]), Re(() => {
    const I = d.current;
    if (!I) return;
    I.style.height = "auto";
    const T = f.mode === "inline" ? f.minHeight : 0;
    I.style.height = `${Math.max(T, I.scrollHeight + 2)}px`;
  }, [i.draft, b, f.mode, f.mode === "inline" ? f.minHeight : 0]);
  const $ = f.mode === "inline" ? { left: f.left, top: f.top, width: f.width } : { left: f.left, width: f.width, top: f.top, bottom: f.bottom };
  return /* @__PURE__ */ D(Ce, { children: [
    f.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ D(
      "div",
      {
        className: `${Ia} is-${f.mode}`,
        style: $,
        role: "group",
        "aria-label": `改第 ${((_ = n.target) == null ? void 0 : _.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": f.mode,
        onPointerDown: (I) => I.stopPropagation(),
        children: [
          r && (b != null && b.source) ? /* @__PURE__ */ p(
            te,
            {
              className: `reader-inline-edit-source${c ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: c ? "收起原文" : "展开原文",
              onClick: () => l((I) => !I),
              children: b.source
            }
          ) : null,
          v ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: v }) : null,
          i.loading ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          b ? /* @__PURE__ */ p(
            Zs,
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
                I.key === "Enter" && (I.metaKey || I.ctrlKey) ? (I.preventDefault(), y || z()) : I.key === "Escape" && (I.preventDefault(), N());
              }
            }
          ) : null,
          b ? /* @__PURE__ */ p(Yu, { text: i.draft }) : null,
          /* @__PURE__ */ D("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(at, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => R(-1), children: /* @__PURE__ */ p(Es, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(at, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= g.length - 1, onClick: () => R(1), children: /* @__PURE__ */ p(Ho, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
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
                  I.key === "Enter" ? (I.preventDefault(), y || z()) : I.key === "Escape" && (I.preventDefault(), N());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ D(
              te,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": u,
                "data-block-edit-action": "history",
                onClick: () => m((I) => !I),
                children: [
                  /* @__PURE__ */ p(Ps, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ p(te, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: N, children: "取消" }),
            /* @__PURE__ */ p(
              te,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: w || !!v || y || !i.draft.trim(),
                pending: i.saving,
                onClick: () => {
                  z();
                },
                children: "保存"
              }
            )
          ] }),
          i.status ? /* @__PURE__ */ p("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ p("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((I) => /* @__PURE__ */ p("li", { children: I }, I)) }) : null,
          u && b && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((I, T) => {
            const E = I.text === b.current, L = [au(I.ts), I.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ D("li", { "data-block-edit-history": I.label, "data-current": E ? "true" : void 0, children: [
              /* @__PURE__ */ D("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ D("span", { children: [
                  L,
                  E ? "（现在用的）" : "",
                  I.reason ? ` · ${I.reason}` : ""
                ] }),
                E ? null : /* @__PURE__ */ p(
                  te,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: w || !!v,
                    onClick: () => {
                      z(I.text, `回到「${L.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ p("p", { className: "reader-inline-edit-history-text", children: I.text })
            ] }, `${I.ts}:${T}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const Ta = qt(null), Ra = qt(null);
function ed({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(Ta.Provider, { value: e, children: /* @__PURE__ */ p(Ra.Provider, { value: t, children: n }) });
}
function Je() {
  return st(Ta);
}
function Ea() {
  return st(Ra);
}
const Pa = 1.414;
function td({
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
  liveTranslationPage: b,
  showLiveTranslation: w = r === "source",
  liveTranslationMissing: v = !1
}) {
  var me, ye;
  const y = Je(), S = y == null ? void 0 : y.revisedBlocks, k = y == null ? void 0 : y.blockEdit, R = k == null ? void 0 : k.pendingEdits, N = y == null ? void 0 : y.editBlock, z = (y == null ? void 0 : y.findTerm) || "", $ = r === "translated" ? "translated" : y != null && y.compareVersion ? "compare" : "source", _ = y == null ? void 0 : y.textMarks, I = q(
    () => _ ? ({ str: B }) => Ql(B, _(B), z) : z ? ({ str: B }) => Dt(B, z) : void 0,
    [z, _]
  ), T = M(c ?? Pa), [E, L] = P(T.current);
  O(() => {
    c != null && Math.abs(c - T.current) >= 1e-3 && (T.current = c, L(c));
  }, [c]);
  const C = M(u);
  C.current = u;
  const K = M(null), U = M((B) => {
    var Q;
    K.current = B, (Q = C.current) == null || Q.call(C, B);
  }).current, G = M(null), oe = M(`${t}@${n}`);
  Re(() => {
    const B = `${t}@${n}`;
    oe.current !== B && (oe.current = B, o && rd(K.current, G.current));
  }, [o, n, t]), O(() => {
    o || Rn(G.current);
  }, [o]), O(() => () => Rn(G.current), []);
  const Z = Math.max(120, Math.floor(t * E)), ne = Math.max(Z, Math.ceil(s || 0)), j = dt(m, t, Z), W = q(
    () => gu(d, t, Z),
    [Z, d, t]
  ), [x, J] = P(null), H = typeof g == "function", V = H ? f ?? null : x, ae = (B) => {
    H ? B !== (f ?? null) && (g == null || g(B)) : J((Q) => Q === B ? Q : B);
  }, se = q(
    () => W.find((B) => B.itemId === V) || null,
    [V, W]
  ), le = r === "translated" && ((me = k == null ? void 0 : k.target) == null ? void 0 : me.itemId) || "", be = q(
    () => le && W.find((B) => B.itemId === le) || null,
    [le, W]
  ), pe = Xu(K, o ? se : null, W, t), nt = (B) => {
    var Pe, Be, Oe, he;
    if (B.pointerType === "touch") return;
    if (y != null && y.pointerTaken) {
      ae(null);
      return;
    }
    if (B.buttons !== 0) {
      ae(null);
      return;
    }
    if ((Be = (Pe = B.target) == null ? void 0 : Pe.closest) != null && Be.call(Pe, `.${va}`) || (he = (Oe = B.target) == null ? void 0 : Oe.closest) != null && he.call(Oe, `.${Ia}`)) return;
    const Q = B.currentTarget.getBoundingClientRect(), ce = B.clientX - Q.left, Le = B.clientY - Q.top;
    if (qu(pe, ce, Le)) return;
    const Ee = Vr(W, ce, Le);
    ae((Ee == null ? void 0 : Ee.itemId) || null);
  }, xe = (B) => {
    if (B.pointerType === "mouse") return;
    const Q = B.currentTarget.getBoundingClientRect(), ce = Vr(
      W,
      B.clientX - Q.left,
      B.clientY - Q.top
    );
    ae((ce == null ? void 0 : ce.itemId) || null);
  }, ie = (B) => {
    !Number.isFinite(B) || B <= 0 || Math.abs(T.current - B) < 1e-3 || (T.current = B, L(B), l == null || l(e, B));
  };
  return /* @__PURE__ */ D(
    "div",
    {
      ref: U,
      [Ie]: e,
      [Se]: r,
      [Qn]: Z,
      className: er,
      onPointerMoveCapture: nt,
      onPointerDown: xe,
      onDoubleClick: (B) => {
        const Q = y == null ? void 0 : y.zoomBlock;
        !Q || y != null && y.pointerTaken || !se || Ae(se.highlight.region) === "figure" && (B.preventDefault(), Q(se.itemId));
      },
      onPointerLeave: (B) => {
        B.pointerType === "mouse" && ae(null);
      },
      style: {
        width: t,
        height: ne,
        minHeight: ne
      },
      children: [
        o ? /* @__PURE__ */ p(
          Ys,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: I,
            renderAnnotationLayer: !1,
            className: Qo,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: cn,
                style: { width: t, height: Z }
              }
            ),
            onLoadSuccess: (B) => {
              try {
                const Q = B.getViewport({ scale: 1 });
                if (Q.width > 0) {
                  const ce = Q.height / Q.width;
                  ie(ce);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              Rn(G.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ p(
          "div",
          {
            className: cn,
            style: { width: t, height: Z },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: G, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
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
          zu,
          {
            layoutPage: h,
            pageState: b,
            width: t,
            height: Z
          }
        ) : null,
        o && w && v ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (R != null && R.size) ? /* @__PURE__ */ p(Bu, { targets: W, edits: R, width: t, excludeId: be == null ? void 0 : be.itemId }) : null,
        o && be && k ? /* @__PURE__ */ p(
          Qu,
          {
            target: be,
            page: { width: t, height: Z },
            edit: k,
            showSource: !!(y != null && y.editShowsSource),
            regions: y == null ? void 0 : y.regions,
            jumpToBlock: y == null ? void 0 : y.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (S != null && S.size) ? /* @__PURE__ */ p("div", { className: "reader-revised-markers", "aria-hidden": "true", children: W.filter((B) => S.has(B.itemId)).map((B) => /* @__PURE__ */ p(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": B.itemId,
            style: { left: B.rect.left, top: B.rect.top, height: B.rect.height }
          },
          B.itemId
        )) }) : null,
        (ye = y == null ? void 0 : y.pageLayers) == null ? void 0 : ye.map((B) => /* @__PURE__ */ p(Xn, { children: B.render({ page: e, width: t, height: Z, pane: $, active: o }) }, B.id)),
        /* @__PURE__ */ p(
          Pu,
          {
            target: o && !(y != null && y.pointerTaken) && (se == null ? void 0 : se.itemId) !== (be == null ? void 0 : be.itemId) ? se : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: se && (S == null ? void 0 : S.get(se.itemId)) || 0,
            onEdit: N,
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
const nd = Vt(td);
function rd(e, t) {
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
const od = 2 * 1024 * 1024;
function ad(e) {
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
const En = 5, sd = "120% 0px", id = 120, cd = "25% 0px";
let Jr = 1;
const Gr = /* @__PURE__ */ new WeakMap();
function ld(e) {
  if (!e) return 0;
  const t = Gr.get(e);
  if (t) return t;
  const n = Jr;
  return Jr += 1, Gr.set(e, n), n;
}
function ud() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const dd = Oo(
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
    activeRegion: b = null,
    regions: w = [],
    readerMetadata: v = null,
    hoveredRegionId: y = null,
    onHoverRegion: S,
    liveTranslation: k,
    showLiveTranslation: R = t === "source",
    liveTranslationPendingLabel: N = "",
    paneAction: z
  }, $) {
    Fl();
    const { file: _, loading: I, error: T } = $i(n, r), E = `${n}\0${ld(_)}`, L = M(E);
    L.current = E;
    const C = q(() => {
      const F = Ai(_);
      return F ? "ranged" in F ? { range: ad(F.ranged) } : F : null;
    }, [_, n]), [K, U] = P(0), [G, oe] = P(""), [Z, ne] = P(null), [j, W] = P(480), x = M(null), J = M(0), H = q(() => ud(), []), V = q(() => ({
      cMapUrl: jt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: jt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: od,
      disableAutoFetch: !0
    }), []);
    Zn($, () => Z, [Z]), O(() => {
      const F = (X) => {
        J.current = X, W(X);
      }, ee = (X) => {
        const de = ac(X, J.current);
        if (de !== "ignore") {
          if (x.current && clearTimeout(x.current), de === "immediate") {
            F(X);
            return;
          }
          x.current = setTimeout(() => F(X), oa);
        }
      }, Y = !!(c && c >= 80);
      ee(Y ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const fe = !Y && i && typeof ResizeObserver < "u" ? new ResizeObserver((X) => {
        var de, ve;
        ee(((ve = (de = X[0]) == null ? void 0 : de.contentRect) == null ? void 0 : ve.width) ?? i.clientWidth);
      }) : null;
      return fe && i && fe.observe(i), () => {
        fe == null || fe.disconnect(), x.current && clearTimeout(x.current);
      };
    }, [c, i, a]);
    const ae = q(
      () => nc(j, o),
      [j, o]
    ), [se, le] = P(() => /* @__PURE__ */ new Map()), [be, pe] = P(() => /* @__PURE__ */ new Set()), [nt, xe] = P(() => /* @__PURE__ */ new Set()), ie = M(/* @__PURE__ */ new Map()), me = M(null), ye = M(null), [B, Q] = P(() => /* @__PURE__ */ new Set()), ce = M(/* @__PURE__ */ new Map()), Le = A((F, ee) => {
      le((Y) => {
        if (Y.get(F) === ee) return Y;
        const re = new Map(Y);
        return re.set(F, ee), re;
      });
    }, []), Ee = A((F, ee) => {
      const Y = ie.current, re = Y.get(F), fe = [me.current, ye.current];
      if (re)
        for (const X of fe)
          try {
            X == null || X.unobserve(re);
          } catch {
          }
      if (ee) {
        Y.set(F, ee);
        for (const X of fe)
          try {
            X == null || X.observe(ee);
          } catch {
          }
      } else
        Y.delete(F);
    }, []), Pe = M(/* @__PURE__ */ new Map()), Be = A((F) => {
      const ee = Pe.current;
      let Y = ee.get(F);
      return Y || (Y = (re) => Ee(F, re), ee.set(F, Y)), Y;
    }, [Ee]);
    O(() => {
      if (typeof IntersectionObserver > "u") return;
      const F = ce.current, ee = new IntersectionObserver(
        (Y) => {
          const re = [], fe = [];
          for (const X of Y) {
            const de = X.target, ve = un(de);
            Number.isFinite(ve) && (X.isIntersecting ? re : fe).push(ve);
          }
          if ((re.length || fe.length) && pe((X) => {
            let de = null;
            for (const ve of re)
              X.has(ve) || (de = de || new Set(X), de.add(ve));
            for (const ve of fe)
              X.has(ve) && (de = de || new Set(X), de.delete(ve));
            return de || X;
          }), re.length) {
            for (const X of re) {
              const de = F.get(X);
              de && (clearTimeout(de), F.delete(X));
            }
            xe((X) => {
              let de = null;
              for (const ve of re)
                X.has(ve) || (de = de || new Set(X), de.add(ve));
              return de || X;
            });
          }
          for (const X of fe)
            F.has(X) || F.set(X, setTimeout(() => {
              F.delete(X), xe((de) => {
                if (!de.has(X)) return de;
                const ve = new Set(de);
                return ve.delete(X), ve;
              });
            }, id));
        },
        { root: i, rootMargin: sd, threshold: 0 }
      );
      me.current = ee;
      for (const Y of ie.current.values())
        try {
          ee.observe(Y);
        } catch {
        }
      return () => {
        ee.disconnect(), me.current === ee && (me.current = null);
        for (const Y of F.values()) clearTimeout(Y);
        F.clear();
      };
    }, [i]), O(() => {
      if (typeof IntersectionObserver > "u") return;
      const F = new IntersectionObserver(
        (ee) => {
          Q((Y) => {
            let re = null;
            for (const fe of ee) {
              const X = un(fe.target);
              !Number.isFinite(X) || fe.isIntersecting === Y.has(X) || (re = re || new Set(Y), fe.isIntersecting ? re.add(X) : re.delete(X));
            }
            return re || Y;
          });
        },
        { root: i, rootMargin: cd, threshold: 0 }
      );
      ye.current = F;
      for (const ee of ie.current.values())
        try {
          F.observe(ee);
        } catch {
        }
      return () => {
        F.disconnect(), ye.current === F && (ye.current = null);
      };
    }, [i]);
    const Oe = !!i && typeof IntersectionObserver < "u";
    Re(() => {
      U(0), oe(""), pe(/* @__PURE__ */ new Set()), xe(/* @__PURE__ */ new Set()), le(/* @__PURE__ */ new Map()), ie.current.clear();
      const F = ce.current;
      for (const ee of F.values()) clearTimeout(ee);
      F.clear(), h == null || h(0, t);
    }, [E, h, t]);
    const he = A(
      (F) => {
        if (L.current !== E) return;
        const ee = F.numPages;
        U(ee), oe(""), h == null || h(ee, t), m == null || m({ numPages: ee, pane: t }), f && typeof F.getPage == "function" && f(F, t), d && typeof F.getOutline == "function" && zl(F).then((Y) => {
          L.current === E && d(Y, t);
        }, () => {
        });
      },
      [E, m, d, f, h, t]
    ), Te = A(
      (F) => {
        if (L.current !== E) return;
        const ee = (F == null ? void 0 : F.message) || "PDF 解析失败";
        oe(ee), U(0), h == null || h(0, t), g == null || g(F, t);
      },
      [E, g, h, t]
    ), Me = q(
      () => K > 0 ? Array.from({ length: K }, (F, ee) => ee + 1) : [],
      [K]
    );
    O(() => {
      typeof IntersectionObserver < "u" || xe(new Set(Me));
    }, [Me]);
    const rt = q(
      () => Rt(b, v, t),
      [b, v, t]
    ), pt = q(() => {
      const F = /* @__PURE__ */ new Map();
      for (const ee of w) {
        const Y = Rt(ee, v, t);
        if (!Y) continue;
        const re = F.get(Y.box.page) || [];
        re.push(Y), F.set(Y.box.page, re);
      }
      return F;
    }, [t, v, w]), gt = q(() => {
      const F = /* @__PURE__ */ new Set();
      if (!y) return F;
      for (const [ee, Y] of pt)
        Y.some((re) => re.itemId === y) && F.add(ee);
      return F;
    }, [y, pt]), Xt = q(() => {
      if (K === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(Me);
      if (be.size === 0) {
        const Y = Math.min(K, En * 2 + 1);
        return new Set(Array.from({ length: Y }, (re, fe) => fe + 1));
      }
      const ee = /* @__PURE__ */ new Set();
      for (const Y of be)
        for (let re = -En; re <= En; re++) {
          const fe = Y + re;
          fe >= 1 && fe <= K && ee.add(fe);
        }
      return ee;
    }, [K, Me, i, a, be]), bt = !n || !!T || !!G, Zt = n && (T || G) || s;
    return /* @__PURE__ */ D(
      "section",
      {
        ref: ne,
        className: `reader-panel ${pn}${a ? "" : " is-hidden"}`,
        [Se]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (k == null ? void 0 : k.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          z ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: z }) : null,
          N ? /* @__PURE__ */ D("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: N })
          ] }) : null,
          bt && !I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: Zt }) : null,
          I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          C && !T ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            Qs,
            {
              file: C,
              loading: null,
              error: null,
              options: V,
              onLoadSuccess: he,
              onLoadError: Te,
              className: "reader-react-pdf-document",
              children: Me.map((F) => {
                if (Xt.has(F))
                  return /* @__PURE__ */ p(
                    nd,
                    {
                      pane: t,
                      pageNumber: F,
                      width: ae,
                      devicePixelRatio: H,
                      active: nt.has(F),
                      textLayer: !Oe || B.has(F),
                      syncedMinHeight: (l == null ? void 0 : l.get(F)) || 0,
                      onMetrics: u,
                      cachedAspect: se.get(F),
                      onAspectChange: Le,
                      sentinelRef: Be(F),
                      regionHighlight: (rt == null ? void 0 : rt.box.page) === F ? rt : null,
                      regionTargets: pt.get(F),
                      hoveredRegionId: y && gt.has(F) ? y : null,
                      onHoverRegion: S,
                      liveTranslationLayout: k == null ? void 0 : k.layoutByPage.get(F - 1),
                      liveTranslationPage: k == null ? void 0 : k.pagesByPage.get(F - 1),
                      showLiveTranslation: R,
                      liveTranslationMissing: cl(k, F - 1)
                    },
                    `${t}-${F}`
                  );
                const Y = se.get(F) ?? Pa, re = Math.max(120, Math.floor(ae * Y)), fe = Math.max(re, Math.ceil((l == null ? void 0 : l.get(F)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: Be(F),
                    [Ie]: F,
                    [Se]: t,
                    [Qn]: re,
                    className: `${er} is-placeholder`,
                    style: {
                      width: ae,
                      height: fe,
                      minHeight: fe
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: cn,
                        style: { width: ae, height: re },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${F}`
                );
              })
            },
            E
          ) }) : null
        ]
      }
    );
  }
), Xr = Vt(dd), fd = 2e3, md = 6, hd = 500, Zr = "reader-react-resizing";
function pd(e, t) {
  const n = M(null), r = M(null);
  Re(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const S = gd(e), k = zt(e, S);
      if (!k) return;
      s = { pane: S, progress: k, started: performance.now() };
    }
    const { pane: i, progress: c, started: l } = s;
    let u = 0, m = null, d = e.scrollHeight, f = d, g = 0, h = l;
    const b = /* @__PURE__ */ new WeakMap(), w = typeof ResizeObserver > "u" ? null : new ResizeObserver((S) => {
      let k = !1;
      for (const R of S) {
        const N = Math.round(R.contentRect.height);
        b.has(R.target) && b.get(R.target) !== N && (k = !0), b.set(R.target, N);
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
      g = S === f ? g + 1 : 0, f = S;
      const k = performance.now() - h;
      g >= md && (S !== d || k > hd) || k > fd ? v() : u = requestAnimationFrame(y);
    };
    for (const S of Yr) e.addEventListener(S, v, { passive: !0 });
    for (const S of Array.from(e.children)) w == null || w.observe(S);
    e.classList.add(Zr), r.current = { ...s, stop: v }, m = setTimeout(() => {
      m = null, h = performance.now(), d = e.scrollHeight, f = d, g = 0, u = requestAnimationFrame(y);
    }, oa);
  }, [e, t]), O(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function gd(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Ie}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(Se) || null;
  }
  return null;
}
const Yr = ["wheel", "touchstart", "keydown", "pointerdown"];
function bd(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function yd(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(pn)) && ((n = e.hasAttribute) != null && n.call(e, Se)));
}
function vd(e, t) {
  O(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!yd(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${pn}[${Se}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const c = bd(a, i);
        if (c === null || Math.abs(i.scrollLeft - c) < 1) continue;
        const l = i.scrollLeft;
        i.scrollLeft = c, Math.abs(i.scrollLeft - l) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function wd(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), c = t - i, l = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: c * l };
}
function Sd(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const Qr = 12;
function ar(e) {
  return Array.from(e.querySelectorAll(`.${pn}[${Se}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function kd(e) {
  const t = e.getBoundingClientRect();
  return ar(e).map((n) => {
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
function Id(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function Td(e, t) {
  return e ? ar(e).find((n) => n.getAttribute(Se) === t) ?? null : null;
}
function Rd({ shellEl: e }) {
  const [t, n] = P([]), r = M(0), o = A(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = kd(e);
      n((i) => Id(i, s) ? i : s);
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
  return a.length ? /* @__PURE__ */ p("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ p(Ed, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function Ed({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - Qr * 2), r = wd(e, n), o = M(null);
  if (!r) return null;
  const a = (d) => {
    const f = Td(t, e.pane);
    f && (f.scrollLeft = d);
  }, s = (d) => {
    var f, g;
    d.button === 0 && (d.preventDefault(), d.stopPropagation(), (g = (f = d.currentTarget).setPointerCapture) == null || g.call(f, d.pointerId), o.current = { startX: d.clientX, startScroll: e.scrollLeft, pointerId: d.pointerId });
  }, i = (d) => {
    const f = o.current;
    !f || f.pointerId !== d.pointerId || a(f.startScroll + Sd(e, n, r.size, d.clientX - f.startX));
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
      style: { left: e.left + Qr, width: n },
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
function Ma(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Pd(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function Md({ compare: e, onDone: t }) {
  return /* @__PURE__ */ D("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ p("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ p("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ p("li", { children: /* @__PURE__ */ D(
        te,
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
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: Ma(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(jo, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(Ms, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ p("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ D("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ D(
        te,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ p(_s, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ D(
        te,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ p(Ns, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function eo({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = Pd(t), a = [e === "compare" ? "对比" : "正在读", r, Ma(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ D("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function _d({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = P({ source: null, translated: null });
  return Re(() => {
    if (!e) return;
    const a = () => {
      const i = e.getBoundingClientRect(), c = (l) => {
        const u = e.querySelector(`[${Se}="${l}"]`), m = u == null ? void 0 : u.getBoundingClientRect();
        return m && m.width > 0 ? { x: Math.round(m.left + m.width / 2), top: Math.round(i.top + 14) } : null;
      };
      o({ source: c("source"), translated: c("translated") });
    };
    a();
    const s = typeof ResizeObserver > "u" ? null : new ResizeObserver(a);
    return s == null || s.observe(e), e.querySelectorAll(`[${Se}]`).forEach((i) => s == null ? void 0 : s.observe(i)), window.addEventListener("resize", a), e.addEventListener("scroll", a, { passive: !0 }), () => {
      s == null || s.disconnect(), window.removeEventListener("resize", a), e.removeEventListener("scroll", a);
    };
  }, [e]), /* @__PURE__ */ D("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(eo, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(eo, { role: "reading", ...n }) }) : null
  ] });
}
const Nd = () => () => {
}, to = () => null;
function Ad({
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
function xd(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function Ld(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Dd(e) {
  const t = Je(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, m = e.bindShell ?? (t == null ? void 0 : t.bindShell), d = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, f = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Jt, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), b = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, w = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, v = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, y = (t == null ? void 0 : t.compareVersion) ?? null, S = (y == null ? void 0 : y.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", k = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", R = y ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, N = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, z = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), $ = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), _ = t == null ? void 0 : t.onPdfOutline, I = t == null ? void 0 : t.onPdfDocument, T = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), E = e.regions ?? (t == null ? void 0 : t.regions) ?? [], L = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), C = (t == null ? void 0 : t.regionHover) ?? null, [K, U] = P(null), G = hn(
    C ? C.subscribe : Nd,
    C ? () => C.get().itemId : to,
    C ? () => C.get().itemId : to
  ), oe = C ? G : K, Z = A((x) => {
    C ? C.set(x, "pdf") : U(x);
  }, [C]), ne = Ad({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), W = Number.isFinite(g) && g > 0 ? xd(
    g,
    n || r,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return pd(d, W), vd(d, ne.compareMode), /* @__PURE__ */ D(
    "div",
    {
      ref: m,
      className: Yo,
      "data-reader-region-count": E.length,
      "data-reader-structured-region-count": E.filter(vs).length,
      "data-reader-metadata-ready": L ? "true" : "false",
      children: [
        /* @__PURE__ */ D(
          "main",
          {
            className: `${Zo} reader-mode-${ne.mode}`,
            "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              b ? /* @__PURE__ */ p(
                Xr,
                {
                  pane: "source",
                  url: S,
                  preloadedFile: R,
                  userZoom: f,
                  visible: ne.showSource,
                  scrollRoot: d,
                  pageWidthOverride: W,
                  rowHeights: ne.compareMode ? h : void 0,
                  onMetrics: z,
                  emptyLabel: v ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: $,
                  onOutline: y ? void 0 : _,
                  onDocument: y ? void 0 : I,
                  activeRegion: T,
                  regions: (y == null ? void 0 : y.regions) ?? E,
                  readerMetadata: L,
                  hoveredRegionId: oe,
                  onHoverRegion: Z,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? Ld(o) : "",
                  paneAction: u && ne.showTranslated ? /* @__PURE__ */ D(Ce, { children: [
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
                Xr,
                {
                  pane: "translated",
                  url: k,
                  preloadedFile: N,
                  userZoom: f,
                  visible: ne.showTranslated,
                  scrollRoot: d,
                  pageWidthOverride: W,
                  rowHeights: ne.compareMode ? h : void 0,
                  onMetrics: z,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: $,
                  onOutline: _,
                  onDocument: I,
                  activeRegion: T,
                  regions: E,
                  readerMetadata: L,
                  hoveredRegionId: oe,
                  onHoverRegion: Z,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ p(Rd, { shellEl: d }),
        y ? /* @__PURE__ */ p(_d, { shellEl: d, left: y.left, right: y.right }) : null
      ]
    }
  );
}
const Cd = [
  { id: "source", label: "原文", Icon: Uo },
  { id: "compare", label: "对照", Icon: Wo },
  { id: "translated", label: "译文", Icon: Ko }
];
function Od(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function $d(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function zd(e) {
  const t = Je(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? Od(a.state) : "";
  return /* @__PURE__ */ D("header", { className: "reader-workspace-bar", children: [
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
    /* @__PURE__ */ D("div", { className: "reader-workspace-center", children: [
      /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Cd.map(({ id: l, label: u, Icon: m }) => {
        const d = n === l, f = $d({
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
              /* @__PURE__ */ p(m, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-workspace-tab-label", children: u })
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
              /* @__PURE__ */ p(As, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: c })
            ]
          }
        ),
        a.latestPage && a.onJumpToLatest && a.latestPage !== a.currentPage ? /* @__PURE__ */ D(
          te,
          {
            className: "reader-live-translation-toggle reader-live-jump",
            "aria-label": `跳到最新译好的第 ${a.latestPage} 页`,
            title: `跳到最新译好的第 ${a.latestPage} 页`,
            onClick: a.onJumpToLatest,
            children: [
              /* @__PURE__ */ p(xs, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "跳到最新" })
            ]
          }
        ) : null
      ] }) : s ? /* @__PURE__ */ p("div", { className: "reader-live-strip", children: /* @__PURE__ */ D(
        te,
        {
          className: "reader-live-translation-toggle is-done",
          title: "翻译完成，左右对照看最终译文",
          onClick: s.onOpenCompare,
          children: [
            /* @__PURE__ */ p(Ls, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
          ]
        }
      ) }) : null
    ] })
  ] });
}
const _a = [];
function Fd() {
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
function Bd(e, t) {
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
function jd(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.pageLayer ? [{ id: t, render: n.pageLayer }] : []);
}
function Hd(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.menuSection ? [{ id: t, render: n.menuSection }] : []);
}
function Ud(e) {
  var t;
  return ((t = e.find(({ contribution: n }) => n.takesPointer)) == null ? void 0 : t.id) ?? null;
}
function Wd(e) {
  const t = e.flatMap(({ id: n, contribution: r }) => r.textMarks ? [{ id: n, marks: r.textMarks }] : []);
  return t.length ? (n) => t.flatMap(({ id: r, marks: o }) => {
    try {
      return [...o(n)];
    } catch (a) {
      return console.error(`[reader] 扩展 ${r} 的文字层标记出错`, a), [];
    }
  }) : null;
}
function Kd(e) {
  return e.reduce((t, { contribution: n }) => Math.max(t, n.reserveRight || 0), 0);
}
function Vd(e) {
  for (const { contribution: t } of e) if (t.comparedDocument) return t.comparedDocument;
  return null;
}
function qd(e) {
  return e.flatMap(({ title: t, contribution: n }) => {
    var r;
    return (r = n.shortcuts) != null && r.length ? [{ title: t, items: n.shortcuts }] : [];
  });
}
const bn = qt(null), Na = qt(null);
function Jd({ api: e, store: t, children: n }) {
  const r = q(() => ({ api: e, store: t }), [e, t]);
  return /* @__PURE__ */ p(bn.Provider, { value: r, children: n });
}
function Gt() {
  const e = st(bn);
  if (!e) throw new Error("useReaderApi 要在 ReaderExtensionsProvider 里面用");
  return e.api;
}
const Gd = () => () => {
}, no = () => _a;
function Xd(e) {
  return hn(e.subscribe, e.getSnapshot, e.getSnapshot);
}
function Aa() {
  var t;
  const e = (t = st(bn)) == null ? void 0 : t.store;
  return hn((e == null ? void 0 : e.subscribe) ?? Gd, (e == null ? void 0 : e.getSnapshot) ?? no, (e == null ? void 0 : e.getSnapshot) ?? no);
}
function yn(e) {
  var a;
  const t = (a = st(bn)) == null ? void 0 : a.store, n = st(Na);
  if (!n) throw new Error("useReaderContribution 只能在扩展组件里用");
  const { id: r, title: o } = n;
  O(() => {
    t == null || t.set(r, o, e);
  }, [t, r, o, e]), O(() => () => t == null ? void 0 : t.remove(r), [t, r]);
}
class Zd extends cs {
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
const Yd = Vt(function({ extensions: t }) {
  return /* @__PURE__ */ p(Ce, { children: t.map(({ id: n, title: r, Component: o }) => /* @__PURE__ */ p(Zd, { id: n, children: /* @__PURE__ */ p(Qd, { id: n, title: r, children: /* @__PURE__ */ p(o, {}) }) }, n)) });
});
function Qd({ id: e, title: t, children: n }) {
  const r = q(() => ({ id: e, title: t }), [e, t]);
  return /* @__PURE__ */ p(Na.Provider, { value: r, children: n });
}
function ef({
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
      te,
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
const tf = 4e3;
function nf(e, t, n) {
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
  const t = e.getRangeAt(0), n = t.startContainer, r = ((s = (a = n.nodeType === 1 ? n : n.parentElement) == null ? void 0 : a.closest) == null ? void 0 : s.call(a, `[${Ie}]`)) ?? null;
  return r ? { text: `${e}`.replace(/\s+\n/g, `
`).trim().slice(0, tf), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function rf(e, t, n, r, o) {
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
function of({
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
  const l = e.getAttribute(Se) === "source" ? "source" : "translated", u = e.getBoundingClientRect(), m = u.width > 0 && u.height > 0 ? { x: Math.min(1, Math.max(0, (t - u.left) / u.width)), y: Math.min(1, Math.max(0, (n - u.top) / u.height)) } : null, f = (r ? a.find((g) => g.itemId === r) ?? null : null) ?? (m ? rf(a, i, l, c, m) : null);
  return {
    pane: l,
    page: c,
    itemId: (f == null ? void 0 : f.itemId) ?? null,
    selection: o,
    sourceText: `${(f == null ? void 0 : f.source.text) || (f == null ? void 0 : f.markdown) || ""}`.trim(),
    translatedText: `${(f == null ? void 0 : f.translatedBlockText) || (f == null ? void 0 : f.translated.text) || ""}`.trim(),
    section: nf(s, a, (f == null ? void 0 : f.source.page) ?? c),
    point: m
  };
}
const oo = 5e4, af = 2e4;
function Pn(e, t) {
  const n = `${e || ""}`;
  return n.length > t ? n.slice(0, t) : n;
}
function sg(e, t) {
  const n = { page: e.page, pane: e.pane, item_ids: e.itemId ? [e.itemId] : [] };
  return t.documentId && (n.document_id = t.documentId), t.jobId && (n.job_id = t.jobId), t.versionId && (n.translation_version = t.versionId), e.selection && (n.selected_text = e.selection), e.section && (n.section = e.section), e.sourceText && (n.source_text = e.sourceText), e.translatedText && (n.translated_text = e.translatedText), n;
}
function sf(e, t = null) {
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
function cf(e, t) {
  if (!(e != null && e.page)) return null;
  const r = [!!(e.document_id && t && e.document_id !== t) ? "别的书" : "", `第 ${e.page} 页`, e.section || ""].filter(Boolean).join(" · ");
  return { page: e.page, label: r, data: e };
}
function lf(e) {
  var r;
  const t = e == null ? void 0 : e.data, n = ((r = t == null ? void 0 : t.retainpdf) == null ? void 0 : r.selection) ?? (t && typeof t.page == "number" ? t : null);
  return n && n.page ? n : null;
}
function ig(e, t) {
  var r;
  const n = lf(e);
  return !n || n.document_id && t && n.document_id !== t ? null : ((r = n.item_ids) == null ? void 0 : r[0]) || null;
}
function cg(e) {
  var o, a;
  const t = e.selection.trim();
  return t && !t.endsWith("…") ? t : ((a = (o = [...e.text.matchAll(/```[ \t]*(译文|translation|zh|zh-CN)[ \t]*\n([\s\S]*?)\n```/gi)].at(-1)) == null ? void 0 : o[2]) == null ? void 0 : a.trim()) || null;
}
function uf(e, t) {
  var o;
  if (!t) return;
  const n = e.findIndex((a) => a.message_id === t);
  if (n < 0) return;
  const r = ((o = e[n + 1]) == null ? void 0 : o.role) === "assistant" ? df(e[n + 1].text) : "";
  return { question: e[n].text, ...r ? { answer: r } : {} };
}
function df(e, t = 160) {
  const n = e.replace(/```[\s\S]*?(```|$)/g, " ").replace(/\$\$[\s\S]*?\$\$/g, " … ").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim(), r = [...n];
  return r.length > t ? `${r.slice(0, t).join("")}…` : n;
}
function ff(e, t = [], n = "") {
  const r = new Set(t.map((o) => o.covers_to_seq));
  return e.filter((o) => !o.superseded_at).map((o) => {
    const a = r.has(o.seq) ? { compactedBefore: !0 } : {};
    if (o.role === "user") {
      const s = uf(e, o.edited_from);
      return {
        id: o.message_id,
        role: "user",
        text: o.text,
        context: cf(o.selection, n),
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
function mf(e, t, n, r) {
  var l, u, m;
  const o = ((m = (u = (l = e.context) == null ? void 0 : l.meta) == null ? void 0 : u.retainpdf) == null ? void 0 : m.selection) ?? null, a = (o == null ? void 0 : o.document_id) || t || null, s = e.sessionId && e.sessionId.length <= 256 ? e.sessionId : null, i = { agent_id: e.agentId || null, document_id: a, session_id: s }, c = e.answer.usage && JSON.stringify(e.answer.usage).length <= 4096 ? e.answer.usage : null;
  return [
    { ...i, role: "user", text: Pn(e.question.text, oo), selection: o, client_message_id: `${n}-q`, ...r ? { edited_from: r } : {} },
    {
      ...i,
      role: "assistant",
      text: Pn(e.answer.text, oo),
      thought: e.answer.thought ? Pn(e.answer.thought, af) : null,
      usage: c,
      client_message_id: `${n}-a`,
      memory_ids: e.memoryIds.slice(0, 10)
    }
  ];
}
function hf(e) {
  return new Date(e - 2e3).toISOString().replace(/\.\d+Z$/, "Z");
}
function pf(e, t) {
  return e.filter((n) => n.origin === "agent" && n.status === "active" && !t.has(n.memory_id)).map((n) => ({ id: n.memory_id, scope: n.scope, text: n.text, category: n.category, documentId: n.document_id, created: !0 }));
}
function gf(e, t) {
  if (t.id && e.some((r) => r.message_id === t.id)) return t.id;
  const n = t.text.trim();
  for (let r = e.length - 1; r >= 0; r -= 1) {
    const o = e[r];
    if (o.role === "assistant" && o.text.trim() === n) return o.message_id;
  }
  return null;
}
function bf(e) {
  const t = e.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().split(new RegExp("(?<=[。！？.!?])"))[0] || "";
  return `深挖：${[...t].slice(0, 30).join("")}${[...t].length > 30 ? "…" : ""}`;
}
const yf = 50, Mn = { conversation: null, main: null, records: [], compactions: [], hasMore: !1, key: "local", initial: [] };
function vf() {
  var t, n;
  return `c-${((n = (t = globalThis.crypto) == null ? void 0 : t.randomUUID) == null ? void 0 : n.call(t)) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}
function ao(e) {
  var n, r, o, a;
  const t = e;
  return `${(t == null ? void 0 : t.reason) || ((n = t == null ? void 0 : t.details) == null ? void 0 : n.reason) || ((a = (o = (r = t == null ? void 0 : t.payload) == null ? void 0 : r.error) == null ? void 0 : o.details) == null ? void 0 : a.reason) || (e instanceof Error ? e.message : "")}`;
}
function wf({ port: e, book: t, onAppended: n }) {
  const r = (e == null ? void 0 : e.conversations) ?? null, o = (e == null ? void 0 : e.memories) ?? null, [a, s] = P(!1), [i, c] = P(Mn), [l, u] = P(!1), [m, d] = P(""), [f, g] = P("idle"), [h, b] = P(null), [w, v] = P(() => /* @__PURE__ */ new Map()), y = M(/* @__PURE__ */ new Set()), S = M(/* @__PURE__ */ new Map()), k = (j) => {
    if (!j) return null;
    const W = S.current.get(j);
    return W || (R.current.records.some((x) => x.message_id === j) ? j : null);
  }, R = M(i);
  R.current = i;
  const N = M(t);
  N.current = t;
  const z = M(0), $ = A(async (j, W, x, J = []) => {
    if (!r) return;
    const H = await r.messages(j.conversation_id, { limit: yf, ...x ? { beforeSeq: x } : {} }), V = [...H.messages, ...J];
    z.current += 1, c({
      conversation: j,
      main: W ?? j,
      records: V,
      compactions: H.compactions || [],
      hasMore: H.has_more,
      key: `${j.conversation_id}:${z.current}`,
      initial: ff(V, H.compactions || [], N.current.documentId)
    });
  }, [r]), _ = A(async () => {
    var j;
    if (s(!0), !(!r || ((j = R.current.conversation) == null ? void 0 : j.kind) === "main")) {
      u(!0), d("");
      try {
        const W = await r.main(N.current.documentId || void 0);
        await $(W, W);
      } catch (W) {
        d(W instanceof Error ? W.message : String(W));
      } finally {
        u(!1);
      }
    }
  }, [r, $]), I = A((j) => {
    b(j), _();
  }, [_]), T = M(t.documentId);
  O(() => {
    T.current !== t.documentId && (T.current = t.documentId, R.current = Mn, c(Mn), b(null), v(/* @__PURE__ */ new Map()), S.current.clear(), a && _());
  }, [t.documentId, a, _]);
  const E = A(async () => {
    const j = R.current, W = j.records[0];
    if (!(!j.conversation || !W || !j.hasMore)) {
      u(!0);
      try {
        await $(j.conversation, j.main, W.seq, j.records);
      } finally {
        u(!1);
      }
    }
  }, [$]), L = A(async (j) => {
    const x = R.current.conversation;
    if (!r || !x) return;
    for (const le of j.memoryIds) y.current.add(le);
    let J = j.memoryIds;
    if (!J.length && o && j.startedAt) {
      const le = pf(
        await o.list({ source_conversation_id: x.conversation_id, created_after: hf(j.startedAt) }).catch(() => []),
        y.current
      );
      for (const pe of le) y.current.add(pe.id);
      J = le.map((pe) => pe.id);
      const be = j.answerId;
      le.length && be && v((pe) => new Map(pe).set(be, le));
    }
    const H = mf({ ...j, memoryIds: J }, N.current.documentId, vf(), k(j.editedFrom));
    let V;
    try {
      V = await r.append(x.conversation_id, H);
    } catch (le) {
      if (x.kind !== "side" || !/ask_conversation_not_open/.test(ao(le))) throw le;
      await r.reopen(x.conversation_id), V = await r.append(x.conversation_id, H);
    }
    const [ae, se] = V.messages;
    j.questionId && ae && S.current.set(j.questionId, ae.message_id), j.answerId && se && S.current.set(j.answerId, se.message_id), c((le) => {
      var be;
      return ((be = le.conversation) == null ? void 0 : be.conversation_id) === x.conversation_id ? { ...le, conversation: V.conversation, records: [...le.records, ...V.messages] } : le;
    }), n == null || n(V.messages), V.compaction_due && x.kind === "main" && r.compact(x.conversation_id).catch(() => {
    });
  }, [r, o, n]), C = A(async (j) => {
    const W = R.current.conversation, x = k(j);
    if (!r || !W || !x) return null;
    try {
      await r.supersede(W.conversation_id, x);
    } catch (V) {
      if (!/ask_message_superseded/.test(ao(V))) throw V;
    }
    const J = R.current.records.find((V) => V.message_id === x), H = R.current.records.findIndex((V) => V.message_id === x);
    return c((V) => ({ ...V, records: V.records.map((ae, se) => se >= H && H >= 0 && !ae.superseded_at ? { ...ae, superseded_at: "now" } : ae) })), (J == null ? void 0 : J.selection) ?? null;
  }, [r]), K = A((j) => {
    L(j).catch((W) => d(`这一轮没存上：${W instanceof Error ? W.message : String(W)}`));
  }, [L]), U = A(async (j) => {
    var J;
    const W = R.current, x = W.main;
    if (!(!r || !x || ((J = W.conversation) == null ? void 0 : J.kind) !== "main")) {
      d("");
      try {
        const H = gf(W.records, j), V = await r.fork({
          parent_id: x.conversation_id,
          ...H ? { forked_from_message_id: H } : {},
          title: bf(j.text),
          ...N.current.documentId ? { document_id: N.current.documentId } : {}
        });
        await $(V, x);
      } catch (H) {
        d(`开不了副对话：${H instanceof Error ? H.message : String(H)}`);
      }
    }
  }, [r, $]), G = A(async (j) => {
    const W = R.current.main;
    if (r)
      try {
        await $(await r.get(j), W);
      } catch (x) {
        d(`打不开副对话：${x instanceof Error ? x.message : String(x)}`);
      }
  }, [r, $]), oe = A(async () => {
    const j = R.current.main;
    j && await $(j, j).catch(() => {
    });
  }, [$]), Z = A(async () => {
    const j = R.current.conversation;
    if (!(!r || (j == null ? void 0 : j.kind) !== "side")) {
      g("busy");
      try {
        await r.close(j.conversation_id), g("idle"), await oe();
      } catch {
        g("failed");
      }
    }
  }, [r, oe]), ne = A(async () => {
    const j = R.current.main;
    if (!r || !j) return;
    await r.archive(j.conversation_id);
    const W = await r.main(N.current.documentId || void 0);
    await $(W, W);
  }, [r, $]);
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
    openMain: _,
    ask: I,
    close: A(() => s(!1), []),
    loadEarlier: E,
    onTurn: K,
    rewrite: C,
    fork: U,
    openSide: G,
    backToMain: oe,
    closeSide: Z,
    archiveMain: ne,
    forgetMemory: r ? r.forgetMemory : void 0
  };
}
function so(e, t, n) {
  var c;
  const r = e.selection, o = e.page ?? (r == null ? void 0 : r.page) ?? 0;
  if (e.role !== "user" || !o) return null;
  const a = (e.pane ?? (r == null ? void 0 : r.pane)) === "source" ? "source" : "translated", s = ((c = r == null ? void 0 : r.item_ids) == null ? void 0 : c[0]) ?? null, i = sf({ item_ids: [], ...r, page: o, pane: a }, n(s, a, o));
  return { key: t, anchor: i, messageId: e.message_id, title: e.text.slice(0, 80) };
}
function Sf({ port: e, documentId: t, resetKey: n, pointOf: r }) {
  const [o, a] = P([]), s = M(0), i = M(r);
  i.current = r;
  const c = () => (s.current += 1, s.current);
  O(() => {
    var f, g;
    if (a([]), !e || !t) return;
    let m = !1;
    const d = (h) => {
      !m && h.length && a((b) => [...b, ...h]);
    };
    return (f = e.threads) == null || f.list(t).then(
      (h) => d(h.map((b) => ({ key: c(), anchor: b.anchor, threadId: b.threadId, title: b.title }))),
      () => {
      }
    ), (g = e.conversations) == null || g.bookMessages(t).then(
      (h) => d(h.map((b) => so(b, c(), i.current)).filter((b) => !!b)),
      () => {
      }
    ), () => {
      m = !0;
    };
  }, [e, t, n]);
  const l = A((m) => {
    const d = m.filter((f) => !f.document_id || f.document_id === t).map((f) => so(f, c(), i.current)).filter((f) => !!f);
    d.length && a((f) => [...f.filter((g) => !d.some((h) => h.messageId === g.messageId)), ...d]);
  }, [t]), u = A((m) => a((d) => d.filter((f) => f.key !== m)), []);
  return { marks: o, addRecords: l, removeMark: u };
}
const kf = zo(() => import("./ReaderAskPanel-CdOsuxxw.js"));
function If({
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
  jumpToBlock: d
}) {
  var W;
  const f = q(() => ({ documentId: t, jobId: n, versionId: r }), [t, n, r]), g = A((x, J, H) => {
    const V = x ? o.find((le) => le.itemId === x) : null, ae = V ? Rt(V, a, J) : null, se = ae && ae.box.page === H ? dt(ae, 1, 1) : null;
    return se ? { x: se.left, y: se.top } : null;
  }, [o, a]), h = Sf({ port: e, documentId: t, resetKey: c, pointOf: g }), b = wf({ port: e, book: f, onAppended: h.addRecords }), [w, v] = P(null), y = A(
    (x, J, H, V) => of({
      pageElement: (x == null ? void 0 : x.closest(`[${Ie}]`)) ?? null,
      clientX: J,
      clientY: H,
      itemId: i(),
      selection: V,
      regions: o,
      bookmarks: s,
      metadata: a
    }),
    [i, o, s, a]
  ), S = A(() => {
    var J;
    const x = ro(((J = globalThis.getSelection) == null ? void 0 : J.call(globalThis)) ?? null);
    return !x.text || !x.element || !x.rect ? null : y(x.element, x.rect.left + x.rect.width / 2, x.rect.top + x.rect.height / 2, x.text);
  }, [y]), k = A((x) => {
    v(null), b.ask(x);
  }, [b.ask]);
  O(() => {
    if (!e) return;
    const x = (J) => {
      var ae;
      if (J.key !== "?" || J.metaKey || J.ctrlKey || J.altKey || J.defaultPrevented) return;
      const H = J.target;
      if ((ae = H == null ? void 0 : H.closest) != null && ae.call(H, "input, textarea, select, [contenteditable='true']")) return;
      const V = S();
      V && (J.preventDefault(), J.stopImmediatePropagation(), k(V));
    };
    return window.addEventListener("keydown", x, !0), () => window.removeEventListener("keydown", x, !0);
  }, [e, S, k]);
  const R = M(""), N = ((W = b.pending) == null ? void 0 : W.selection) || "";
  O(() => {
    N && (R.current = N);
  }, [N]);
  const z = b.visible && !w, $ = b.setPending;
  O(() => {
    if (!z) return;
    let x = null;
    const J = () => {
      x && clearTimeout(x), x = setTimeout(() => {
        const H = S();
        H && H.selection !== R.current && $(H);
      }, 250);
    };
    return document.addEventListener("selectionchange", J), () => {
      x && clearTimeout(x), document.removeEventListener("selectionchange", J);
    };
  }, [z, S, $]);
  const _ = A(async (x) => {
    if (x.threadId && (e != null && e.threads) && t) {
      try {
        const J = await e.threads.get(t, x.threadId);
        v({ anchor: J.anchor || x.anchor, messages: J.messages || [], mark: x });
      } catch {
        v({ anchor: x.anchor, messages: [], mark: x });
      }
      return;
    }
    v(null), b.openMain();
  }, [e, t, b.openMain]), I = A((x) => {
    var V;
    if (!e) return [];
    const J = ro(((V = globalThis.getSelection) == null ? void 0 : V.call(globalThis)) ?? null), H = y(x.target, x.clientX, x.clientY, J.element ? J.text : "");
    return H ? [{
      key: "ask",
      label: H.selection ? "问这段" : "在这里提问",
      hint: H.selection ? "?" : void 0,
      onSelect: () => k(H)
    }] : [];
  }, [e, y, k]), T = w ? {
    anchor: w.anchor,
    messages: w.messages,
    onClose: () => v(null),
    onDelete: e != null && e.threads && w.mark.threadId ? () => {
      e.threads.remove(t, w.mark.threadId).catch(() => {
      }), h.removeMark(w.mark.key), v(null);
    } : void 0
  } : null, E = q(() => m ? (x, J) => {
    m(x, J ?? void 0), requestAnimationFrame(() => d(x, "translated"));
  } : null, [m, d]), L = A((x) => ya(o, x), [o]), [C, K] = P(0), U = A(({ mode: x, width: J }) => {
    const H = globalThis.innerWidth || 0;
    K(x === "dock" && H - J >= 480 ? Math.round(J) : 0);
  }, []), G = !b.persistent || !!b.view.conversation || !!b.error, oe = e && (b.visible && G || w) ? /* @__PURE__ */ p($o, { fallback: null, children: /* @__PURE__ */ p(
    kf,
    {
      port: e,
      jobId: n,
      book: f,
      ask: b,
      legacy: T,
      onShowSelection: ({ page: x, pane: J }) => l(x, J),
      onJumpToPage: (x) => l(x),
      pageCount: u,
      onLayout: U,
      onEditBlock: E,
      canEditBlock: L
    }
  ) }) : null, Z = b.visible && G || !!w, ne = b.close, j = A(() => {
    if (Z) {
      v(null), ne();
      return;
    }
    b.openMain();
  }, [Z, ne, b.openMain]);
  return { marks: h.marks, onMark: _, menuItems: I, panel: oe, open: b.openMain, toggle: j, showing: Z, reserveRight: Z ? C : 0, enabled: !!e };
}
const Tf = [{ keys: "选字 + ?", desc: "问选中的这段" }];
function Rf() {
  const e = Gt(), t = q(() => {
    try {
      return qe().ask ?? null;
    } catch {
      return null;
    }
  }, []), n = If({
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
    jumpToBlock: e.jumpToBlock
  }), { marks: r, onMark: o, menuItems: a, panel: s, enabled: i, toggle: c, showing: l, reserveRight: u } = n, m = q(() => i ? {
    toolbarItems: [{
      key: "ask",
      label: "提问",
      title: "提问：问整本书、翻这本书以前的对话（问某一段：书页上右键，或选字按 ?）",
      Icon: Ds,
      pressed: l,
      onClick: c
    }],
    menuItems: a,
    pageLayer: r.length ? ({ page: d, height: f }) => /* @__PURE__ */ p(ef, { marks: r, page: d, height: f, onOpen: o }) : void 0,
    shortcuts: Tf,
    reserveRight: u
  } : {}, [i, a, r, o, c, l, u]);
  return yn(m), s;
}
const Ef = { id: "ask", title: "提问", Component: Rf };
function jn() {
  try {
    return qe().translationVersions ?? null;
  } catch {
    return null;
  }
}
function Pf(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function Mf(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function _f(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function Nf({ documentId: e, jobId: t }) {
  const [n, r] = P([]), [o, a] = P(null);
  O(() => {
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
  const s = Mf(n, t, o);
  return q(() => ({ versions: n, readingVersionId: s }), [n, s]);
}
function Af({ documentId: e, jobId: t, versions: n, readingVersionId: r }) {
  const [o, a] = P(null), [s, i] = P(""), [c, l] = P(""), u = M(0);
  O(() => {
    u.current += 1, a(null), i(""), l("");
  }, [e, t]);
  const m = A((g) => {
    const h = jn(), b = n.find((v) => v.versionId === g);
    if (!h || !b || !e) return;
    const w = ++u.current;
    i(g), l(""), (async () => {
      const v = qe(), y = await h.resolveJob(e, g);
      if (!y) throw new Error("这一份还没有能读的译文。");
      const S = await v.loadReaderPayload(y, { includeOptionalArtifacts: !0 }), k = v.resolveReaderTranslatedPdfUrl(S.jobPayload, S.manifestPayload);
      if (!k) throw new Error("这一份没有译文 PDF。");
      return { versionId: g, name: b.name, jobId: y, url: k, regions: Pf(Bo(S.regionsPayload)) };
    })().then((v) => {
      w === u.current && a(v);
    }).catch((v) => {
      w === u.current && l((v == null ? void 0 : v.message) || "这一份打不开。");
    }).finally(() => {
      w === u.current && i("");
    });
  }, [e, n]), d = A(() => {
    u.current += 1, a(null), i(""), l("");
  }, []), f = A(async () => {
    var b, w;
    const g = jn();
    if (!g || !o || !e) return;
    try {
      await g.select(e, o.versionId);
    } catch (v) {
      l((v == null ? void 0 : v.message) || "换不过去，请稍后再试。");
      return;
    }
    const h = (b = globalThis.location) == null ? void 0 : b.href;
    h && ((w = globalThis.history) == null || w.replaceState(globalThis.history.state, "", _f(h, o.jobId))), a(null);
  }, [o, e]);
  return q(() => ({
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
function xf(e) {
  return e.available ? {
    key: "compare",
    label: "对比版本",
    title: "对比版本：左边换成这本书的另一份译文",
    Icon: Cs,
    pressed: !!(e.compared || e.loading),
    popup: (t) => /* @__PURE__ */ p(Md, { compare: e, onDone: t })
  } : null;
}
function Lf(e) {
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
function Df() {
  var i;
  const e = Gt(), t = Af({
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
  const s = q(() => {
    const c = xf(t);
    return { toolbarItems: c ? [c] : [], comparedDocument: Lf(t) };
  }, [t]);
  return yn(s), null;
}
const Cf = { id: "compare", title: "对比版本", Component: Df }, xa = [
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
function Of(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(Hn + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(Hn + e);
    } catch {
    }
}
function $f(e, t, n, r, o, a) {
  const s = co * co;
  return e.filter((i) => La(i, t, n) && i.points.some(([c, l]) => (c - r) ** 2 + ((l - o) * a) ** 2 <= s)).map((i) => i.id);
}
function La(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function zf(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function Ff(e) {
  const [t, n] = P(null), [r, o] = P(xa[0].key), [a, s] = P(() => lo(e)), i = M(a), c = M([]);
  O(() => {
    const h = lo(e);
    i.current = h, s(h), c.current = [];
  }, [e]);
  const l = A((h) => {
    i.current = h, s(h), Of(e, h);
  }, [e]), u = A((h) => {
    const b = i.current, w = h(b);
    w !== b && (c.current = [...c.current.slice(-49), b], l(w));
  }, [l]), m = A((h) => {
    h.points.length < 1 || u((b) => [...b, { ...h, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [u]), d = A((h) => {
    h.length && u((b) => b.filter((w) => !h.includes(w.id)));
  }, [u]), f = A((h) => {
    u((b) => b.some((w) => w.page === h) ? b.filter((w) => w.page !== h) : b);
  }, [u]), g = A(() => {
    const h = c.current.pop();
    h && l(h);
  }, [l]);
  return q(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: m, erase: d, undo: g, clearPage: f }),
    [t, r, a, m, d, g, f]
  );
}
const Bf = [
  { tool: "pen", label: "画笔", Icon: Yn },
  { tool: "highlighter", label: "荧光笔", Icon: Os },
  { tool: "eraser", label: "橡皮", Icon: $s }
];
function jf(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Da({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ D(Ce, { children: [
    Bf.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
      te,
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
    xa.map((o) => /* @__PURE__ */ p(
      te,
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
    /* @__PURE__ */ p(te, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(zs, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      te,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p(Fs, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null,
    e.tool ? /* @__PURE__ */ p(
      te,
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
function Hf({ ink: e, page: t, onPick: n }) {
  return /* @__PURE__ */ p("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ p(Da, { ink: e, page: t, onPick: n }) });
}
function Uf({ ink: e }) {
  return e.tool ? /* @__PURE__ */ p("div", { className: "reader-ink-bar is-dock", role: "toolbar", "aria-label": "画笔", "data-ink-dock": "true", children: /* @__PURE__ */ p(Da, { ink: e }) }) : null;
}
function Wf(e) {
  const t = M(e);
  t.current = e, O(() => {
    const n = (r) => {
      if (jf(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
const Kf = "reader-ink-layer";
function Vf(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function uo({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: Vf(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function qf({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = P(null), i = M(!1), c = o.strokes.filter((h) => La(h, e, t)), l = !!o.tool;
  if (!l && !c.length) return null;
  const u = (h) => {
    const b = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - b.left) / Math.max(1, b.width))),
      Math.min(1, Math.max(0, (h.clientY - b.top) / Math.max(1, b.height)))
    ];
  }, m = (h, b) => o.erase($f(o.strokes, e, t, h, b, r / Math.max(1, n))), d = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [b, w] = u(h);
    o.tool === "eraser" ? m(b, w) : s([[b, w]]);
  }, f = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [b, w] = u(h);
    o.tool === "eraser" ? m(b, w) : s((v) => v ? zf(v, b, w) : [[b, w]]);
  }, g = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: io[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ D(
    "svg",
    {
      className: Kf,
      "data-ink-active": l ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: d,
      onPointerMove: f,
      onPointerUp: g,
      onPointerCancel: g,
      children: [
        c.map((h) => /* @__PURE__ */ p(uo, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(uo, { stroke: { tool: o.tool, color: o.color, width: io[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
const Jf = [
  { keys: "P", desc: "进入 / 退出画笔（书页上右键也能选笔和颜色）" },
  { keys: "Esc", desc: "退出画笔" },
  { keys: "⌘Z / Ctrl+Z", desc: "画笔模式下撤销" }
];
function Gf(e) {
  return {
    toolbarItems: [{
      key: "ink",
      label: "画笔",
      title: "画笔（P；书页上右键也能选笔和颜色）",
      Icon: Yn,
      pressed: !!e.tool,
      onClick: () => e.setTool(e.tool ? null : "pen")
    }],
    menuSection: ({ page: t, close: n }) => /* @__PURE__ */ p(Hf, { ink: e, page: t, onPick: n }),
    // 离视口远的页只是占位，笔迹先不画（和以前一样只画 active 的页）。
    pageLayer: ({ page: t, pane: n, width: r, height: o, active: a }) => a ? /* @__PURE__ */ p(qf, { page: t, pane: n, width: r, height: o, ink: e }) : null,
    takesPointer: !!e.tool,
    shortcuts: Jf
  };
}
function Xf() {
  const e = Gt(), t = Ff(e.resetKey);
  Wf(t);
  const n = q(() => Gf(t), [t]);
  return yn(n), /* @__PURE__ */ p(Uf, { ink: t });
}
const Zf = { id: "ink", title: "画笔", Component: Xf }, Yf = Oo(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
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
        /* @__PURE__ */ p("rect", { x: "2", y: "5", width: "20", height: "14", rx: "2.5" }),
        /* @__PURE__ */ p("path", { d: "M6 15V9l2.5 3L11 9v6" }),
        /* @__PURE__ */ p("path", { d: "M16.5 9v6M14.5 13l2 2 2-2" })
      ]
    }
  );
}), Qf = Yf;
function em(e) {
  const t = M(!1);
  return e && (t.current = !0), t.current;
}
const tm = zo(() => import("./ReaderMarkdownPanel-DJiUysbO.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), Ca = { id: "markdown", label: "Markdown", short: "MD", Icon: Qf, needsJob: !0 };
function nm() {
  const e = Gt(), t = e.activePanel === Ca.id;
  return em(t) ? /* @__PURE__ */ p($o, { fallback: null, children: /* @__PURE__ */ p(tm, { open: t, jobId: e.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: e.closePanel }) }) : null;
}
const rm = {
  id: "markdown",
  title: "Markdown",
  Component: nm,
  panels: [Ca]
}, Oa = "reader-xref", Un = "data-xref", Ot = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, om = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${Ot})`), am = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function Wn(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function sm(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function im(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function cm(e, t, n) {
  const r = e[t], o = (i) => {
    if (!i || i.source.page !== r.source.page) return !1;
    const c = Ae(i);
    return c === "figure" || c === "table" || c === "formula";
  }, a = (i) => {
    const c = [];
    for (let l = t + i; o(e[l]) && c.length < 40; l += i) c.push(e[l]);
    return i < 0 ? c.reverse() : c;
  }, s = a(n === "table" ? 1 : -1);
  return s.length ? s : a(n === "table" ? -1 : 1);
}
function lm(e, t, n) {
  return (e.find((o) => Ae(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function um(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = Ae(r), s = im(r);
    if (a === "formula") {
      for (const g of s.matchAll(am)) {
        const h = Wn(g[1]);
        h && n({ key: `equation:${h}`, kind: "equation", label: h, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = om.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const l = sm(i[1]), u = Wn(i[2]), m = cm(e, o, l), d = [...m.map((g) => g.itemId), r.itemId], f = new Map(e.map((g, h) => [g.itemId, h]));
    d.sort((g, h) => (f.get(g) ?? 0) - (f.get(h) ?? 0)), n({ key: `${l}:${u}`, kind: l, label: u, itemId: lm(m, r, l), itemIds: d, captionId: r.itemId });
  }), t;
}
const dm = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${Ot})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${Ot})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${Ot})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${Ot})\s*[）)]`, "g"), kind: () => "equation" }
];
function fm(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of dm) {
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
function mm(e, t) {
  return fm(e, t).map((n) => ({ start: n.start, end: n.end, className: Oa, attrs: { [Un]: n.key } }));
}
const hm = { figure: "图", table: "表", equation: "式" };
function fo(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${hm[e.kind]} ${e.label}`;
}
const mo = 6e3;
function $a(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function pm(e, t, n, r) {
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
function za({
  pdf: e,
  page: t,
  region: n,
  cssWidth: r,
  className: o,
  label: a
}) {
  const s = M(null), [i, c] = P({ status: "loading", cssHeight: 0 }), l = `${t}:${n.left}:${n.top}:${n.width}:${n.height}:${Math.round(r)}`;
  return O(() => {
    let u = !1, m = null;
    return c((d) => ({ status: "loading", cssHeight: d.cssHeight })), (async () => {
      try {
        const d = await e.getPage(t);
        if (u) return;
        const f = d.getViewport({ scale: 1 }), g = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), h = pm(n, f, r, g), b = s.current, w = b == null ? void 0 : b.getContext("2d");
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
        /* @__PURE__ */ p("canvas", { ref: s, role: "img", "aria-label": a ?? `第 ${t} 页的一块`, style: { width: r, height: i.cssHeight || void 0 } }),
        i.status === "error" ? /* @__PURE__ */ p("p", { className: "reader-region-canvas-error", children: "这一块没画出来。" }) : null
      ]
    }
  );
}
const ho = { figure: "图", table: "表", formula: "公式", text: "文字" }, Ge = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function gm(e, t, n) {
  const r = Rt(e, t, n), o = r ? dt(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = $a({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function bm(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, c = null;
  for (const u of e) {
    const m = Rt(u, t, n), d = m ? dt(m, 1, 1) : null;
    !m || !d || (r || (r = m.box.page, c = m.pageSize), m.box.page === r && (o = Math.min(o, d.left), a = Math.min(a, d.top), s = Math.max(s, d.left + d.width), i = Math.max(i, d.top + d.height)));
  }
  if (!r || !c) return null;
  const l = $a({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: l, aspect: l.height * c.height / Math.max(1e-6, l.width * c.width) };
}
function ym(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function vm(e, t) {
  const n = (o) => {
    const a = Ae(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function wm({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var $;
  const i = t.find((_) => _.itemId === e) ?? null, c = q(() => i ? vm(t, i) : [], [t, i]), l = i ? c.indexOf(i) : -1, [u, m] = P(Ge.indexOf(1)), d = Ge[u], f = M(null), [g, h] = P(0);
  Re(() => {
    const _ = f.current;
    if (!_) return;
    const I = () => h(_.clientWidth);
    I();
    const T = typeof ResizeObserver == "function" ? new ResizeObserver(I) : null;
    return T == null || T.observe(_), () => T == null ? void 0 : T.disconnect();
  }, []);
  const b = A((_) => {
    const I = c[l + _];
    I && a(I.itemId);
  }, [c, l, a]);
  O(() => {
    const _ = (I) => {
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
    return window.addEventListener("keydown", _, !0), () => window.removeEventListener("keydown", _, !0);
  }, [s, b]), O(() => {
    const _ = f.current;
    if (!_) return;
    const I = (T) => {
      !T.ctrlKey && !T.metaKey || (T.preventDefault(), m((E) => Math.max(0, Math.min(Ge.length - 1, E + (T.deltaY < 0 ? 1 : -1)))));
    };
    return _.addEventListener("wheel", I, { passive: !1 }), () => _.removeEventListener("wheel", I);
  }, []);
  const w = M(null);
  if (!i) return null;
  const v = Ae(i), y = o.map((_) => ({ pane: _, pdf: r[_] ?? null, where: gm(i, n, _) })).filter((_) => !!(_.pdf && _.where)), S = 16, k = typeof window > "u" ? 800 : window.innerHeight, R = Math.min(880, k * 0.9) - 56 - 32 - (y.length > 1 ? 26 : 0), N = y.length ? ym(Math.max(120, (g - S * (y.length - 1) - 32) / y.length), R, y.map((_) => _.where.aspect)) : 0, z = (($ = y[0]) == null ? void 0 : $.where.page) ?? i.source.page;
  return /* @__PURE__ */ D("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${ho[v] ?? "这一块"}`, children: [
    /* @__PURE__ */ p("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ D("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ D("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ D("span", { className: "reader-zoom-title", children: [
          ho[v] ?? "这一块",
          " · 第 ",
          z,
          " 页"
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-zoom-count", children: l >= 0 ? `${l + 1} / ${c.length}` : "" }),
        /* @__PURE__ */ D("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ p(at, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: l <= 0, onClick: () => b(-1), children: /* @__PURE__ */ p(Bs, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(at, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: l < 0 || l >= c.length - 1, onClick: () => b(1), children: /* @__PURE__ */ p(Vo, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(at, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => m((_) => Math.max(0, _ - 1)), children: /* @__PURE__ */ p(js, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ D(te, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => m(Ge.indexOf(1)), children: [
            Math.round(d * 100),
            "%"
          ] }),
          /* @__PURE__ */ p(at, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === Ge.length - 1, onClick: () => m((_) => Math.min(Ge.length - 1, _ + 1)), children: /* @__PURE__ */ p(Hs, { size: 16, "aria-hidden": !0 }) }),
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
            const I = f.current, T = w.current;
            !I || !T || (I.scrollLeft = T.left - (_.clientX - T.x), I.scrollTop = T.top - (_.clientY - T.y));
          },
          onPointerUp: () => {
            w.current = null;
          },
          children: y.length && g ? /* @__PURE__ */ p("div", { className: "reader-zoom-columns", style: { gap: S }, children: y.map(({ pane: _, pdf: I, where: T }) => /* @__PURE__ */ D("figure", { className: "reader-zoom-column", children: [
            y.length > 1 ? /* @__PURE__ */ p("figcaption", { children: _ === "source" ? "原文" : "译文" }) : null,
            /* @__PURE__ */ p(
              za,
              {
                className: "reader-zoom-canvas",
                pdf: I,
                page: T.page,
                region: T.fraction,
                cssWidth: N * d,
                label: `${_ === "source" ? "原文" : "译文"}第 ${T.page} 页`
              }
            )
          ] }, _)) }) : /* @__PURE__ */ p("p", { className: "reader-zoom-empty", children: g ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
const Sm = 380, km = 320, yt = 8;
function Im(e, t, n) {
  const r = Math.max(yt, Math.min(e.left, n.width - t.width - yt)), o = e.bottom + yt, a = o + t.height <= n.height - yt ? o : Math.max(yt, e.top - yt - t.height);
  return { left: r, top: a };
}
function Tm({
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
    const f = r[d], g = f ? bm(o, n, d) : null;
    if (f && g) {
      s = { pdf: f, where: g };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min(Sm, km / Math.max(0.05, s.where.aspect))), c = Math.round(i * s.where.aspect) + 30, l = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: m } = Im(e.anchor, { width: Math.max(i, 160) + 16, height: c + 16 }, l);
  return /* @__PURE__ */ D("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: m }, children: [
    /* @__PURE__ */ D("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ p("span", { children: fo(e.target) }),
      /* @__PURE__ */ D("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ p(za, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: fo(e.target) })
  ] });
}
const Rm = 250;
function Em(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function Pm(e, t, n) {
  const r = n === "back" ? e.back : e.forward;
  if (!r.length) return null;
  const o = r[r.length - 1], a = r.slice(0, -1), s = n === "back" ? { back: a, forward: [...e.forward, t] } : { back: [...e.back, t], forward: a };
  return { to: o, history: s };
}
function Mm(e) {
  var n;
  const t = e;
  return !!((n = t == null ? void 0 : t.closest) != null && n.call(t, "input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
function _m({
  shellEl: e,
  index: t,
  primaryPane: n,
  follow: r
}) {
  const [o, a] = P(null), [s, i] = P({ back: [], forward: [] }), c = M(s);
  c.current = s;
  const l = M(null), u = M({ index: t, primaryPane: n, follow: r, shellEl: e });
  u.current = { index: t, primaryPane: n, follow: r, shellEl: e };
  const m = A(() => {
    const { shellEl: f, primaryPane: g } = u.current;
    return zt(f, g);
  }, []);
  O(() => {
    if (!e) return;
    const f = (y) => {
      var S, k;
      return (k = (S = y.target) == null ? void 0 : S.closest) == null ? void 0 : k.call(S, `.${Oa}`);
    }, g = () => {
      l.current != null && window.clearTimeout(l.current), l.current = null;
    }, h = (y) => {
      var N;
      const S = f(y);
      if (!S) return;
      const k = u.current.index.get(S.getAttribute(Un) || "");
      if (!k) return;
      const R = ((N = S.closest("[data-reader-pane]")) == null ? void 0 : N.getAttribute("data-reader-pane")) || u.current.primaryPane;
      g(), l.current = window.setTimeout(() => {
        const z = S.getBoundingClientRect();
        a({ target: k, pane: R, anchor: { left: z.left, top: z.top, right: z.right, bottom: z.bottom } });
      }, Rm);
    }, b = (y) => {
      const S = f(y);
      !S || S.contains(y.relatedTarget) || (g(), a(null));
    }, w = (y) => {
      var z, $;
      const S = f(y);
      if (!S || y.button !== 0 || y.metaKey || y.ctrlKey || y.shiftKey || `${((z = window.getSelection) == null ? void 0 : z.call(window)) || ""}`.trim()) return;
      const k = u.current.index.get(S.getAttribute(Un) || "");
      if (!k) return;
      y.preventDefault(), y.stopPropagation(), g(), a(null);
      const R = (($ = S.closest("[data-reader-pane]")) == null ? void 0 : $.getAttribute("data-reader-pane")) || u.current.primaryPane, N = m();
      N && i((_) => Em(_, N)), u.current.follow(k, R);
    }, v = () => {
      g(), a(null);
    };
    return e.addEventListener("pointerover", h), e.addEventListener("pointerout", b), e.addEventListener("click", w, !0), e.addEventListener("scroll", v, { passive: !0 }), () => {
      g(), e.removeEventListener("pointerover", h), e.removeEventListener("pointerout", b), e.removeEventListener("click", w, !0), e.removeEventListener("scroll", v);
    };
  }, [e, m]);
  const d = A((f) => {
    const g = m();
    if (!g) return !1;
    const h = Pm(c.current, g, f);
    if (!h) return !1;
    const { shellEl: b, primaryPane: w } = u.current;
    return Et(b, h.to, "auto", w) ? (i(h.history), !0) : !1;
  }, [m]);
  return O(() => {
    const f = (g) => {
      if (!g.altKey || g.metaKey || g.ctrlKey || g.shiftKey || g.defaultPrevented || g.key !== "ArrowLeft" && g.key !== "ArrowRight" || Mm(g.target)) return;
      d(g.key === "ArrowLeft" ? "back" : "forward") && g.preventDefault();
    };
    return window.addEventListener("keydown", f), () => window.removeEventListener("keydown", f);
  }, [d]), {
    preview: o,
    closePreview: A(() => a(null), []),
    canGoBack: s.back.length > 0,
    backPage: s.back.length ? s.back[s.back.length - 1].page : null,
    goBack: A(() => d("back"), [d])
  };
}
const Nm = [
  { keys: "Alt+←", desc: "点了引用跳过去以后，回到原处" },
  { keys: "Alt+→", desc: "再跳回去" }
];
function Am() {
  const e = Gt(), t = q(() => um(e.regions), [e.regions]), { jumpToBlock: n } = e, r = A((s, i) => n(s.itemId, i), [n]), o = _m({ shellEl: e.shellEl, index: t, primaryPane: e.primaryPane, follow: r }), a = q(() => ({
    // 书里一个认得出去处的引用都没有，就不改文字层（react-pdf 照原样画，不多一遍 innerHTML）。
    textMarks: t.size ? (s) => mm(s, t) : void 0,
    shortcuts: Nm
  }), [t]);
  return yn(a), /* @__PURE__ */ D(Ce, { children: [
    o.preview ? /* @__PURE__ */ p(Tm, { preview: o.preview, regions: e.regions, metadata: e.metadata, documents: e.pdfDocuments }) : null,
    o.canGoBack ? /* @__PURE__ */ D(te, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => o.goBack(), children: [
      /* @__PURE__ */ p(Us, { size: 14, "aria-hidden": !0 }),
      " 回到第 ",
      o.backPage,
      " 页"
    ] }) : null
  ] });
}
const xm = { id: "xrefs", title: "引用（「图 2.1」「式 (3.21)」）", Component: Am }, sr = [Zf, rm, Cf, xm, Ef];
function ir(e = sr) {
  return e.flatMap((t) => (t.panels ?? []).map(({ id: n, label: r, short: o, Icon: a, needsJob: s }) => ({ id: n, label: r, short: o, Icon: a, needsJob: s })));
}
function Lm(e) {
  const t = Je(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(Ce, { children: (e.tabs ?? ir()).map(({ id: s, label: i, Icon: c, needsJob: l }) => {
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
          /* @__PURE__ */ p(c, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
          /* @__PURE__ */ p("span", { className: "reader-panel-toggle-label", "aria-hidden": "true", children: i })
        ]
      },
      s
    );
  }) });
}
function Dm(e) {
  const t = Je(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
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
    /* @__PURE__ */ p("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: c, label: l, Icon: u, disabled: m, selected: d, badge: f, onClick: g }) => /* @__PURE__ */ D(
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
function Cm(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Om(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function $m(e) {
  return e / 100 * window.innerHeight;
}
function zm(e) {
  return e / 100 * window.innerWidth;
}
function Fm(e) {
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
  const [o, a] = Fm(n);
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
      r = Om(t, o);
      break;
    }
    case "em": {
      r = Cm(t, o);
      break;
    }
    case "vh": {
      r = $m(o);
      break;
    }
    case "vw": {
      r = zm(o);
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
function ue(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function Vn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? Bm : jm
  );
}
function Bm(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function jm(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function Fa(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Ba(e, t) {
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
function Hm({
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
    const { x: i, y: c } = Ba(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return ue(o, "No rect found"), o;
}
let nn;
function Um() {
  return nn === void 0 && (typeof matchMedia == "function" ? nn = !!matchMedia("(pointer:coarse)").matches : nn = !1), nn;
}
function ja(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Vn(
    n,
    Array.from(t.children).filter(Fa).map((g) => ({ element: g }))
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
                  const R = f[0], N = Hm({
                    orientation: n,
                    rects: [w, v],
                    targetRect: R.element.getBoundingClientRect()
                  });
                  y = [
                    R,
                    N === w ? k : S
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
              const R = Um() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (k.width < R) {
                const z = R - k.width;
                k = new DOMRect(
                  k.x - z / 2,
                  k.y,
                  k.width + z,
                  k.height
                );
              }
              if (k.height < R) {
                const z = R - k.height;
                k = new DOMRect(
                  k.x,
                  k.y - z / 2,
                  k.width,
                  k.height + z
                );
              }
              const N = g <= l || g > u;
              !i && !N && s.push({
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
class Ha {
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
const cr = new Ha();
function ct() {
  return It;
}
function Wm(e) {
  return cr.addListener("change", e);
}
function Km(e) {
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
const Vm = (e) => e, _n = () => {
}, Ua = 1, Wa = 2, Ka = 4, Va = 8, po = 3, go = 12;
let rn;
function bo() {
  return rn === void 0 && (rn = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (rn = !0)), rn;
}
function qm({
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
          const a = (e & Ua) !== 0, s = (e & Wa) !== 0, i = (e & Ka) !== 0, c = (e & Va) !== 0;
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
      const o = qm({
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
let ze = /* @__PURE__ */ new Map();
const qa = new Ha();
function Jm(e) {
  ze = new Map(ze), ze.delete(e);
}
function vo(e, t) {
  for (const [n] of ze)
    if (n.id === e)
      return n;
}
function et(e, t) {
  for (const [n, r] of ze)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function mt() {
  return ze;
}
function ur(e, t) {
  return qa.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Ve(e, t, n) {
  const r = ze.get(e);
  ze = new Map(ze), ze.set(e, t), qa.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function Ja(e) {
  const t = ct();
  let n = !1;
  switch (t.state) {
    case "active":
      Tt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (lr(e), n = !0, t.hitRegions.forEach((r) => {
        const o = et(r.group.id, !0);
        Ve(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function wo(e) {
  e.defaultPrevented || Ja(e.currentTarget);
}
function Gm(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Ba(n, a.rect);
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
function Xm(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Zm(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: Io(e),
    b: Io(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  ue(
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
const Ym = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function Qm(e) {
  const t = getComputedStyle(Ga(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function eh(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || Qm(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || Ym.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function So(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (ue(n, "Missing node"), eh(n)) return n;
  }
  return null;
}
function ko(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Io(e) {
  const t = [];
  for (; e; )
    t.push(e), e = Ga(e);
  return t;
}
function Ga(e) {
  const { parentNode: t } = e;
  return Xm(t) ? t.host : t;
}
function th(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function nh({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!Fa(n) || n.contains(e) || e.contains(n))
    return !0;
  if (Zm(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (th(r.getBoundingClientRect(), t))
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
    const a = ja(o), s = Gm(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && nh({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function rh(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function we(e, t, n = 0) {
  return Math.abs(ke(e) - ke(t)) <= n;
}
function $e(e, t) {
  return we(e, t) ? 0 : e > t ? 1 : -1;
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
  if ($e(r, c) < 0)
    if (a) {
      const l = (o + c) / 2;
      $e(r, l) < 0 ? r = o : r = c;
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
  if (we(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), c = Object.values(o), l = [...i], [u, m] = r;
  ue(u != null, "Invalid first pivot index"), ue(m != null, "Invalid second pivot index");
  let d = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? m : u, b = n[h];
        ue(
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
          if (ue(
            S != null,
            `Previous layout not found for panel index ${h}`
          ), we(S, w)) {
            const k = y - S;
            $e(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      {
        const h = e < 0 ? u : m, b = n[h];
        ue(
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
          if (ue(
            S != null,
            `Previous layout not found for panel index ${h}`
          ), we(S, y)) {
            const k = S - w;
            $e(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? m : u, b = n[h];
      ue(
        b,
        `Panel constraints not found for index ${h}`
      );
      const w = i[h], { collapsible: v, collapsedSize: y, minSize: S } = b;
      if (v && $e(w, S) < 0)
        if (e > 0) {
          const k = S - y, R = k / 2, N = w + e;
          $e(N, S) < 0 && (e = $e(e, R) <= 0 ? 0 : k);
        } else {
          const k = S - y, R = 100 - k / 2, N = w - e;
          $e(N, S) < 0 && (e = $e(100 + e, R) > 0 ? 0 : -k);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let b = e < 0 ? m : u, w = 0;
    for (; ; ) {
      const y = i[b];
      ue(
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
      ue(
        w != null,
        `Previous layout not found for panel index ${h}`
      );
      const v = w - b, y = kt({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: w,
        size: v
      });
      if (!we(w, y) && (d += w - y, l[h] = y, d.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (rh(c, l))
    return o;
  {
    const h = e < 0 ? m : u, b = i[h];
    ue(
      b != null,
      `Previous layout not found for panel index ${h}`
    );
    const w = b + d, v = kt({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: b,
      size: w
    });
    if (l[h] = v, !we(v, w)) {
      let y = w - v, S = e < 0 ? m : u;
      for (; S >= 0 && S < n.length; ) {
        const k = l[S];
        ue(
          k != null,
          `Previous layout not found for panel index ${S}`
        );
        const R = k + y, N = kt({
          overrideDisabledPanels: s,
          panelConstraints: n[S],
          prevSize: k,
          size: R
        });
        if (we(k, N) || (y -= N - k, l[S] = N), we(y, 0))
          break;
        e > 0 ? S-- : S++;
      }
    }
  }
  const f = Object.values(l).reduce(
    (h, b) => b + h,
    0
  );
  if (!we(f, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return l.reduce((h, b, w) => (h[g[w]] = b, h), {});
}
function lt(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || $e(e[n], t[n]) !== 0)
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
  if (!we(o, 100) && r.length > 0)
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      ue(c != null, `No layout data found for index ${i}`);
      const l = 100 / o * c;
      r[i] = l;
    }
  let a = 0;
  for (let i = 0; i < t.length; i++) {
    const c = n[i];
    ue(c != null, `No layout data found for index ${i}`);
    const l = r[i];
    ue(l != null, `No layout data found for index ${i}`);
    const u = kt({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: c,
      size: l
    });
    l != u && (a += l - u, r[i] = u);
  }
  if (!we(a, 0))
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      ue(c != null, `No layout data found for index ${i}`);
      const l = c + a, u = kt({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: c,
        size: l
      });
      if (c !== u && (a -= u - c, r[i] = u, we(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, c, l) => (i[s[l]] = c, i), {});
}
function Xa({
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
    const d = a(), f = l.findIndex((b) => b.id === t), g = f === 0, h = f === l.length - 1;
    if (h && c < d && (g || l.slice(0, f).every((b, w) => {
      const v = m[w];
      return (v == null ? void 0 : v.collapsible) && we(v.collapsedSize, u[v.panelId]);
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
      layout: g,
      separatorToPanels: h
    } = n(), b = s({
      nextSize: c,
      panels: d.panels,
      prevLayout: g,
      derivedPanelConstraints: m
    }), w = ut({
      layout: b,
      panelConstraints: m
    });
    lt(g, w) || Ve(d, {
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
      return c && we(l, u);
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
        const o = r.panelConstraints.defaultSize, a = Xa({
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
function Za({
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
  const n = on(e), r = et(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  ue(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  ue(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), i = Za({ groupId: n.id }).getLayout(), c = Ut({
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
        ue(c, "Matching separator not found");
        const l = i.get(c);
        ue(l, "Matching panels not found");
        const u = l[0], m = a.find(
          (d) => d.panelId === u.id
        );
        if (ue(m, "Panel metadata not found"), m.collapsible) {
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
        ue(o !== null, "Index not found");
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
function Ya({
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
    const b = r.get(u), w = o.get(u);
    if (!b || !w)
      return;
    const {
      defaultLayoutDeferred: v,
      derivedPanelConstraints: y,
      groupSize: S,
      layout: k,
      separatorToPanels: R
    } = w;
    if (y && k && R) {
      const N = Ut({
        delta: h,
        initialLayout: b,
        panelConstraints: y,
        pivotIndices: l.panels.map((z) => f.indexOf(z)),
        prevLayout: k,
        trigger: "mouse-or-touch"
      });
      if (lt(N, k)) {
        if (h !== 0 && !g)
          switch (d) {
            case "horizontal": {
              i |= h < 0 ? Ua : Wa;
              break;
            }
            case "vertical": {
              i |= h < 0 ? Ka : Va;
              break;
            }
          }
      } else
        Ve(l.group, {
          defaultLayoutDeferred: v,
          derivedPanelConstraints: y,
          groupSize: S,
          layout: N,
          separatorToPanels: R
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & po : c |= i & po, t.movementY === 0 ? c |= s & go : c |= i & go, Km(c), lr(e);
}
function Po(e) {
  const t = mt(), n = ct();
  switch (n.state) {
    case "active":
      Ya({
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
      Ya({
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
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || Ja(e.currentTarget) && e.preventDefault();
}
function Ao(e) {
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
function oh(e, t, n) {
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
function ah(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function sh({
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
        const f = d / 100 * n, g = ke(
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
function ih(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const vt = /* @__PURE__ */ new Map();
function ch(e) {
  let t = !0;
  ue(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const h of g) {
      const { borderBoxSize: b, target: w } = h;
      if (w === e.element) {
        if (t) {
          const v = Pt({ group: e });
          if (v === 0)
            return;
          const y = et(e.id);
          if (!y)
            return;
          const S = Kn(e), k = y.defaultLayoutDeferred ? Ao(S) : y.layout, R = sh({
            group: e,
            nextGroupSize: v,
            prevGroupSize: y.groupSize,
            prevLayout: k
          }), N = ut({
            layout: R,
            panelConstraints: S
          });
          if (!y.defaultLayoutDeferred && lt(y.layout, N) && ah(
            y.derivedPanelConstraints,
            S
          ) && y.groupSize === v)
            return;
          Ve(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: S,
            groupSize: v,
            layout: N,
            separatorToPanels: y.separatorToPanels
          });
        }
      } else
        oh(e, w, b);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    ue(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = Pt({ group: e }), i = Kn(e), c = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (ih(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[c] ?? l ?? Ao(i), m = ut({
    layout: u,
    panelConstraints: i
  }), d = e.element.ownerDocument;
  vt.set(
    d,
    (vt.get(d) ?? 0) + 1
  );
  const f = /* @__PURE__ */ new Map();
  return ja(e).forEach((g) => {
    g.separator && f.set(g.separator, g.panels);
  }), Ve(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: m,
    separatorToPanels: f
  }), e.separators.forEach((g) => {
    ue(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", Ro);
  }), vt.get(d) === 1 && (d.addEventListener("contextmenu", wo, !0), d.addEventListener("dblclick", To, !0), d.addEventListener("pointerdown", Eo, !0), d.addEventListener("pointerleave", Po), d.addEventListener("pointermove", Mo), d.addEventListener("pointerout", _o), d.addEventListener("pointerup", No, !0)), function() {
    t = !1, vt.set(
      d,
      Math.max(0, (vt.get(d) ?? 0) - 1)
    ), Jm(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", Ro);
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
function lh() {
  const [e, t] = P({}), n = A(() => t({}), []);
  return [e, n];
}
function fr(e) {
  const t = Fo();
  return `${e ?? t}`;
}
const ht = typeof window < "u" ? Re : O;
function Ft(e) {
  const t = M(e);
  return ht(() => {
    t.current = e;
  }, [e]), A(
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
  const t = M({ ...e });
  return ht(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const Qa = qt(null);
function uh(e, t) {
  const n = M({
    getLayout: () => ({}),
    setLayout: Vm
  });
  Zn(t, () => n.current, []), ht(() => {
    Object.assign(
      n.current,
      Za({ groupId: e })
    );
  });
}
function es({
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
  }), b = Ft(
    (I, T) => {
      lt(g.current.onLayoutChanged, I) || (g.current.onLayoutChanged = I, l == null || l(I, { isUserInteraction: T }));
    }
  ), w = fr(i), v = M(null), [y, S] = lh(), k = M({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: m,
    separators: []
  }), R = mr(v, a);
  uh(w, s);
  const N = Ft(
    (I, T) => {
      const E = ct(), L = vo(I), C = et(I);
      if (C) {
        let K = !1;
        switch (E.state) {
          case "active": {
            K = E.hitRegions.some(
              (U) => U.group === L
            );
            break;
          }
        }
        return {
          flexGrow: C.layout[T] ?? 1,
          pointerEvents: K ? "none" : void 0
        };
      }
      if (n != null && n[T])
        return {
          flexGrow: n == null ? void 0 : n[T]
        };
    }
  ), z = hr({
    defaultLayout: n,
    disableCursor: r
  }), $ = q(
    () => ({
      get disableCursor() {
        return !!z.disableCursor;
      },
      getPanelStyles: N,
      id: w,
      orientation: u,
      registerPanel: (I) => {
        const T = k.current;
        return T.panels = Vn(u, [
          ...T.panels,
          I
        ]), S(), () => {
          T.panels = T.panels.filter(
            (E) => E !== I
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
            (E) => E !== I
          ), S();
        };
      },
      updatePanelProps: (I, { disabled: T }) => {
        const E = k.current.panels.find(
          (K) => K.id === I
        );
        E && (E.panelConstraints.disabled = T);
        const L = vo(w), C = et(w);
        L && C && Ve(L, {
          ...C,
          derivedPanelConstraints: Kn(L)
        });
      },
      updateSeparatorProps: (I, {
        disabled: T,
        disableDoubleClick: E
      }) => {
        const L = k.current.separators.find(
          (C) => C.id === I
        );
        L && (L.disabled = T, L.disableDoubleClick = E);
      }
    }),
    [N, w, S, u, z]
  ), _ = M(null);
  return ht(() => {
    const I = v.current;
    if (I === null)
      return;
    const T = k.current;
    let E;
    if (z.defaultLayout !== void 0 && Object.keys(z.defaultLayout).length === T.panels.length) {
      E = {};
      for (const Z of T.panels) {
        const ne = z.defaultLayout[Z.id];
        ne !== void 0 && (E[Z.id] = ne);
      }
    }
    const L = {
      disabled: !!o,
      element: I,
      id: w,
      mutableState: {
        defaultLayout: E,
        disableCursor: !!z.disableCursor,
        expandedPanelSizes: k.current.lastExpandedPanelSizes,
        layouts: k.current.layouts
      },
      orientation: u,
      panels: T.panels,
      resizeTargetMinimumSize: T.resizeTargetMinimumSize,
      separators: T.separators
    };
    _.current = L;
    const C = ch(L), { defaultLayoutDeferred: K, derivedPanelConstraints: U, layout: G } = et(L.id, !0);
    !K && U.length > 0 && (h(G), b(G, !1));
    const oe = ur(w, (Z) => {
      const { defaultLayoutDeferred: ne, derivedPanelConstraints: j, layout: W } = Z.next;
      if (ne || j.length === 0)
        return;
      const x = L.panels.map(({ id: H }) => H).join(",");
      L.mutableState.layouts[x] = W, j.forEach((H) => {
        if (H.collapsible) {
          const { layout: V } = Z.prev ?? {};
          if (V) {
            const ae = we(
              H.collapsedSize,
              W[H.panelId]
            ), se = we(
              H.collapsedSize,
              V[H.panelId]
            );
            ae && !se && (L.mutableState.expandedPanelSizes[H.panelId] = V[H.panelId]);
          }
        }
      });
      const J = ct().state !== "active";
      h(W), J && b(W, Z.isUserInteraction);
    });
    return () => {
      _.current = null, C(), oe();
    };
  }, [
    o,
    w,
    b,
    h,
    u,
    y,
    z
  ]), O(() => {
    const I = _.current;
    I && (I.mutableState.defaultLayout = n, I.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(Qa.Provider, { value: $, children: /* @__PURE__ */ p(
    "div",
    {
      ...f,
      className: t,
      "data-group": !0,
      "data-testid": w,
      id: w,
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
es.displayName = "Group";
function pr() {
  const e = st(Qa);
  return ue(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function dh(e, t) {
  const { id: n } = pr(), r = M({
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
      Xa({ groupId: n, panelId: e })
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
  const h = !!c, b = fr(c), w = hr({
    disabled: a
  }), v = M(null), y = mr(v, s), {
    getPanelStyles: S,
    id: k,
    orientation: R,
    registerPanel: N,
    updatePanelProps: z
  } = pr(), $ = m !== null, _ = Ft(
    (L, C, K) => {
      m == null || m(L, c, K);
    }
  );
  ht(() => {
    const L = v.current;
    if (L !== null) {
      const C = {
        element: L,
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
      return N(C);
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
    N,
    w
  ]), O(() => {
    z(b, { disabled: a });
  }, [a, b, z]), dh(b, d);
  const I = () => {
    const L = S(k, b);
    if (L)
      return JSON.stringify(L);
  }, T = hn(
    (L) => ur(k, L),
    I,
    I
  );
  let E;
  return T ? E = JSON.parse(T) : o !== void 0 ? E = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : E = { flexGrow: 1 }, /* @__PURE__ */ p(
    "div",
    {
      ...g,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": b,
      id: b,
      ref: y,
      style: {
        ...fh,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...E
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
const fh = {
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
function mh({
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
function ts({
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
  }), [u, m] = P({}), [d, f] = P("inactive"), [g, h] = P(!1), b = M(null), w = mr(b, o), {
    disableCursor: v,
    id: y,
    orientation: S,
    registerSeparator: k,
    updateSeparatorProps: R
  } = pr(), N = S === "horizontal" ? "vertical" : "horizontal";
  ht(() => {
    const _ = b.current;
    if (_ !== null) {
      const I = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: _,
        id: c
      }, T = k(I), E = Wm(
        (C) => {
          f(
            C.next.state !== "inactive" && C.next.hitRegions.some(
              (K) => K.separator === I
            ) ? C.next.state : "inactive"
          );
        }
      ), L = ur(
        y,
        (C) => {
          const { derivedPanelConstraints: K, layout: U, separatorToPanels: G } = C.next, oe = G.get(I);
          if (oe) {
            const Z = oe[0], ne = oe.indexOf(Z);
            m(
              mh({
                layout: U,
                panelConstraints: K,
                panelId: Z.id,
                panelIndex: ne
              })
            );
          }
        }
      );
      return () => {
        E(), L(), T();
      };
    }
  }, [y, c, k, l]), O(() => {
    R(c, { disabled: n, disableDoubleClick: r });
  }, [n, r, c, R]);
  let z;
  n && !v && (z = "not-allowed");
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
      "aria-orientation": N,
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
        cursor: z,
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
ts.displayName = "Separator";
const gr = 30, br = 65, Wt = 50, hh = 100 - br, ph = 100 - gr;
function gh(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(br, Math.max(gr, t)) : Wt;
}
function yr(e) {
  return 100 - e;
}
function wt(e) {
  return `${e}%`;
}
const vr = "reader-document", Kt = "reader-assistant", ns = "retainpdf.reader.ai-split-layout.v1", bh = {
  [vr]: yr(Wt),
  [Kt]: Wt
};
function wr(e) {
  const t = gh(e == null ? void 0 : e[Kt]);
  return {
    [vr]: yr(t),
    [Kt]: t
  };
}
function yh() {
  try {
    const e = JSON.parse(localStorage.getItem(ns) || "null");
    return wr(e);
  } catch {
    return bh;
  }
}
function vh(e) {
  try {
    localStorage.setItem(ns, JSON.stringify(wr(e)));
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
function wh() {
  const e = M(null), [t] = P(yh);
  Re(() => {
    const o = e.current;
    return Nn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = A((o) => {
    Nn(e.current, o);
  }, []), r = A((o, a) => {
    Nn(e.current, o), a.isUserInteraction && vh(o);
  }, []);
  return /* @__PURE__ */ D(
    es,
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
            id: vr,
            defaultSize: wt(yr(Wt)),
            minSize: wt(hh),
            maxSize: wt(ph)
          }
        ),
        /* @__PURE__ */ p(
          ts,
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
            minSize: wt(gr),
            maxSize: wt(br)
          }
        )
      ]
    }
  );
}
function Sh({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = P(!1);
  if (O(() => {
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
    n ? /* @__PURE__ */ p(te, { className: "reader-error-notice-retry", "data-reader-retry": "optional", onClick: n, children: "重试" }) : null,
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
function kh({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(Sh, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ D(Ce, { children: [
    e ? /* @__PURE__ */ p("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ D("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ p(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ D("div", { className: "reader-react-error", role: "alert", children: [
      /* @__PURE__ */ p("span", { className: "reader-react-error-text", children: n }),
      s ? /* @__PURE__ */ p(te, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function Ih(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Th() {
  const [e, t] = P(!1), n = Fo(), r = M(null), o = Aa(), a = q(() => [...Sl, ...qd(o)], [o]);
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
      if (i.defaultPrevented || i.metaKey || i.ctrlKey || i.altKey || Ih(i.target)) return;
      const c = i.key;
      if (c === "?" || c === "h" || c === "H" || c === "/") {
        if (c === "/" && !i.shiftKey)
          return;
        i.preventDefault(), t((l) => !l);
      }
    };
    return window.addEventListener("keydown", s), () => window.removeEventListener("keydown", s);
  }, []), /* @__PURE__ */ D("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
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
        children: /* @__PURE__ */ p(Ws, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
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
          /* @__PURE__ */ p("div", { className: "reader-react-shortcuts-body", children: a.map((s) => /* @__PURE__ */ D("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ p("h3", { children: s.title }),
            /* @__PURE__ */ p("ul", { children: s.items.map((i) => /* @__PURE__ */ D("li", { children: [
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
const Rh = ["source", "sideBySide", "translated"], Eh = { source: "", translated: "", sideBySide: "" };
function Ph(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = an(e.sourceUrl), n = an(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return fi({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function Mh(e) {
  const [t, n] = P(() => /* @__PURE__ */ new Set()), r = q(
    () => e ? Ph(e) : Eh,
    [e]
  ), o = q(
    () => Rh.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = A(async (s) => {
    if (!e) return;
    const i = an(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? di(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await mi(
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
        hi(l), n((u) => {
          const m = new Set(u);
          return m.delete(s), m;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const _h = {
  source: Uo,
  sideBySide: Wo,
  translated: Ko
}, Nh = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function Ah(e) {
  const t = Je(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Mh(n), i = M(null);
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
  }, []), /* @__PURE__ */ D("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ D("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ p(Ks, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ p(Ho, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = ds[c], u = an(r[c]), m = a.has(c), d = !!u && !m, f = d ? "" : fs(c, r), g = _h[c];
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
            /* @__PURE__ */ p(g, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ D("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ D("span", { className: "reader-download-action-label", children: [
                Nh[c],
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
const xh = "retainpdf:reader:bookmarks:v1:", Lh = 200;
function Sr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function rs(e) {
  const t = `${e || ""}`.trim();
  return t ? `${xh}${t}` : "";
}
function Dh(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function mn(e, t = Sr()) {
  const n = rs(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = Dh(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function Jn(e, t, n) {
  const r = rs(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, Lh);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function Ch(e, t, n = "", { storage: r = Sr(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = mn(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? Jn(e, a.filter((i) => i.page !== s), r) : Jn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Oh(e, t, n = Sr()) {
  return Jn(e, mn(e, n).filter((r) => r.page !== t), n);
}
function $h(e, t) {
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
function zh({ filled: e }) {
  return /* @__PURE__ */ p("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ p("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function Fh({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = P(() => mn(e)), [i, c] = P(!1), l = M(null);
  if (O(() => {
    s(mn(e)), c(!1);
  }, [e]), O(() => {
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
  return /* @__PURE__ */ D("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: l, children: [
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${m ? " is-marked" : ""}`,
        "aria-pressed": m,
        "aria-label": m ? `取消第 ${u} 页的书签` : `给第 ${u} 页加书签`,
        title: m ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(Ch(e, u, $h(r, u))),
        children: /* @__PURE__ */ p(zh, { filled: m })
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
          /* @__PURE__ */ p(Vs, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { className: "reader-bookmark-count", children: a.length })
        ]
      }
    ) : null,
    i && a.length ? /* @__PURE__ */ p("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ p("ol", { className: "reader-bookmark-list", children: a.map((d) => /* @__PURE__ */ D("li", { className: d.page === u ? "is-current" : "", children: [
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
          onClick: () => s(Oh(e, d.page)),
          children: "×"
        }
      )
    ] }, d.page)) }) }) : null
  ] });
}
function Bh(e) {
  const [t, n] = P([]);
  return O(() => {
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
function jh(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const Hh = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, Uh = ["failed", "content", "layout"];
function Wh(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Kh({ jobId: e, currentPage: t }) {
  var m;
  const n = Bh(e), r = (m = Je()) == null ? void 0 : m.jumpToBlock, [o, a] = P(!1), [s, i] = P(-1), c = M(null);
  O(() => i(-1), [n]);
  const l = (d) => {
    const f = n[d];
    !f || !r || (i(d), r(f.readerItemId));
  }, u = M({ issues: n, last: s, currentPage: t, goTo: l });
  return u.current = { issues: n, last: s, currentPage: t, goTo: l }, O(() => {
    const d = (f) => {
      if (f.key.toLowerCase() !== "n" || f.metaKey || f.ctrlKey || f.altKey || Wh(f.target)) return;
      const { issues: g, last: h, currentPage: b, goTo: w } = u.current, v = jh(g, h, b, f.shiftKey);
      v < 0 || (f.preventDefault(), w(v));
    };
    return document.addEventListener("keydown", d), () => document.removeEventListener("keydown", d);
  }, []), O(() => {
    if (!o) return;
    const d = (f) => {
      var g;
      (g = c.current) != null && g.contains(f.target) || a(!1);
    };
    return document.addEventListener("pointerdown", d, !0), () => document.removeEventListener("pointerdown", d, !0);
  }, [o]), n.length ? /* @__PURE__ */ D("div", { className: "reader-react-hud-group reader-issues", ref: c, "aria-label": "待处理", children: [
    /* @__PURE__ */ D(
      te,
      {
        className: "reader-react-hud-btn reader-issues-toggle",
        "aria-expanded": o,
        "aria-haspopup": "true",
        "aria-label": `待处理 ${n.length} 处`,
        title: "这次翻译里要人看一眼的段落（N 下一处，Shift+N 上一处）",
        onClick: () => a((d) => !d),
        children: [
          /* @__PURE__ */ p(qs, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { children: n.length })
        ]
      }
    ),
    o ? /* @__PURE__ */ D("div", { className: "reader-issues-popover", role: "dialog", "aria-label": "待处理", children: [
      /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
      Uh.map((d) => {
        const f = n.map((g, h) => ({ issue: g, index: h })).filter(({ issue: g }) => g.kind === d);
        return f.length ? /* @__PURE__ */ D("section", { className: "reader-issues-group", "data-issue-kind": d, children: [
          /* @__PURE__ */ D("h4", { children: [
            Hh[d],
            /* @__PURE__ */ p("span", { children: f.length })
          ] }),
          /* @__PURE__ */ p("ol", { children: f.map(({ issue: g, index: h }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ D(
            te,
            {
              className: "reader-issues-item",
              "aria-current": h === s ? "true" : void 0,
              onClick: () => {
                l(h), a(!1);
              },
              children: [
                /* @__PURE__ */ p("span", { className: "reader-issues-title", children: g.title }),
                /* @__PURE__ */ D("span", { className: "reader-issues-page", children: [
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
const Vh = 48, qh = 96, Jh = 700;
function Gh(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= Vh, downSoFar: r };
}
function Xh(e) {
  const [t, n] = P(!1), r = M(0);
  return O(() => {
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
      const g = f.scrollTop, h = o.get(f);
      if (o.set(f, g), h === void 0 || Date.now() - a > Jh) return;
      const b = Gh(!1, r.current, g - h);
      r.current = b.downSoFar, g - h < -4 ? n(!1) : b.hidden && !c() && n(!0);
    }, u = (d) => {
      d.clientY >= window.innerHeight - qh && (r.current = 0, n(!1));
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
function Zh(e) {
  const t = Je(), n = Ea(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Jt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = tc(a), m = a > ea + 1e-3, d = a < dn - 1e-3, f = St(r, Qe()), g = f >= dn ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", h = M(null), b = Xh(h), [w, v] = P(!1), [y, S] = P(`${i}`);
  O(() => {
    w || S(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, w]);
  const k = () => {
    if (v(!1), !l || c <= 0)
      return;
    const R = Number(`${y}`.trim());
    l(fn(R, c));
  };
  return /* @__PURE__ */ D("div", { ref: h, className: "reader-react-hud", "data-reader-hud": "true", "data-hud-hidden": b ? "true" : void 0, children: [
    o ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "页码", children: w ? /* @__PURE__ */ D(
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
              value: y,
              autoFocus: !0,
              onChange: (R) => S(R.target.value.replace(/[^\d]/g, "")),
              onBlur: k,
              onKeyDown: (R) => {
                R.key === "Escape" && (R.preventDefault(), v(!1), S(`${i}`));
              }
            }
          ),
          /* @__PURE__ */ D("span", { className: "reader-react-hud-page-suffix", children: [
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
          !l || c <= 0 || (S(`${i}`), v(!0));
        },
        children: c > 0 ? `${Math.min(i, c)} / ${c}` : "—"
      }
    ) }),
    e.searchSlot ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "搜索", children: e.searchSlot }) : null,
    e.bookmarkScope ? /* @__PURE__ */ p(
      Fh,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: c,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
      }
    ) : null,
    e.issuesJobId ? /* @__PURE__ */ p(Kh, { jobId: e.issuesJobId, currentPage: i }) : null,
    t != null && t.toggleDocDark ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "显示", children: /* @__PURE__ */ p(
      te,
      {
        className: "reader-react-hud-btn reader-react-hud-doc-dark",
        "aria-pressed": t.docDark ? "true" : "false",
        "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
        title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
        onClick: t.toggleDocDark,
        children: /* @__PURE__ */ p(Yh, {})
      }
    ) }) : null,
    /* @__PURE__ */ D("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
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
      /* @__PURE__ */ D(
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
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(Th, {}) })
  ] });
}
function Yh() {
  return /* @__PURE__ */ D("svg", { width: "14", height: "14", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: [
    /* @__PURE__ */ p("circle", { cx: "8", cy: "8", r: "6.25", fill: "none", stroke: "currentColor", strokeWidth: "1.5" }),
    /* @__PURE__ */ p("path", { d: "M8 1.75a6.25 6.25 0 0 1 0 12.5z", fill: "currentColor" })
  ] });
}
function xo(e) {
  var t, n;
  return aa(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function Qh(e) {
  const [t, n] = P(() => ({
    scope: e,
    panel: xo(Fe(e))
  }));
  O(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: xo(Fe(e))
    });
  }, [e]), O(() => {
    t.scope === e && gn(t.scope, {
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
const Gn = "download-toast";
function ep({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ D("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ D("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ p("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ p("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ p("div", { className: "download-toast-track", children: /* @__PURE__ */ p("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ p("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function tp(e = {}) {
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
    () => /* @__PURE__ */ p(ep, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: Gn, duration: 1 / 0 }
  );
}
function np() {
  const e = A((t) => {
    t && (t.setState = tp, t.hide = () => xn.dismiss(Gn));
  }, []);
  return /* @__PURE__ */ D(Ce, { children: [
    /* @__PURE__ */ p(Is, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
const Lo = { itemId: null, origin: null };
function rp() {
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
function op({
  nodes: e,
  currentPage: t,
  onJumpPage: n
}) {
  const r = q(() => ga(e, t), [e, t]), [o, a] = P(() => /* @__PURE__ */ new Set([...jr(r), ...r ? [r] : []]));
  O(() => {
    a(/* @__PURE__ */ new Set([...jr(r), ...r ? [r] : []]));
  }, [e]);
  const s = M(null);
  O(() => {
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
        d ? /* @__PURE__ */ p(
          te,
          {
            className: `reader-bookmark-toggle${m ? " is-open" : ""}`,
            "aria-label": m ? `收起「${u.title}」` : `展开「${u.title}」`,
            "aria-expanded": m,
            onClick: () => i(u.id),
            children: /* @__PURE__ */ p(Vo, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 })
          }
        ) : /* @__PURE__ */ p("span", { className: "reader-bookmark-spacer", "aria-hidden": "true" }),
        /* @__PURE__ */ D(
          te,
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
const ap = [], sp = [];
function ip({
  open: e,
  onToggle: t,
  children: n
}) {
  return /* @__PURE__ */ D("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ p(te, { className: "reader-finder-toggle", "aria-label": "目录", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: /* @__PURE__ */ p(Gs, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }) }),
    n
  ] });
}
function cp({ open: e, onToggle: t }) {
  return /* @__PURE__ */ p(
    te,
    {
      className: "reader-react-hud-btn reader-search-toggle",
      "data-finder-toggle": "search",
      "aria-label": "在书里搜索",
      "aria-pressed": e === "search",
      title: "在书里搜索（原文和译文，⌘F）",
      onClick: () => t("search"),
      children: /* @__PURE__ */ p(Js, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 })
    }
  );
}
function lp({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0,
  bookmarks: c = sp,
  onJumpPage: l
}) {
  var _, I;
  const u = ((_ = Je()) == null ? void 0 : _.regions) ?? ap, m = ((I = Ea()) == null ? void 0 : I.currentPage) ?? 1, d = q(() => Vl(u), [u]), f = c.length > 0 && !!l, [g, h] = P("bookmarks"), b = f && (g === "bookmarks" || !d.length), w = ql(d, m), v = q(() => Xl(u, s), [u, s]), [y, S] = P(-1);
  O(() => S(-1), [s]);
  const k = M(null), R = M(null), N = M(n);
  N.current = n, O(() => {
    const T = (L) => {
      var K, U;
      const C = L.target;
      !C || (K = R.current) != null && K.contains(C) || (U = C.closest) != null && U.call(C, ".reader-finder-toggles, [data-finder-toggle]") || N.current();
    }, E = (L) => {
      L.key === "Escape" && N.current();
    };
    return document.addEventListener("pointerdown", T, !0), document.addEventListener("keydown", E), () => {
      document.removeEventListener("pointerdown", T, !0), document.removeEventListener("keydown", E);
    };
  }, []);
  const z = M(null);
  O(() => {
    var T, E, L;
    e === "search" ? (T = k.current) == null || T.focus() : (L = (E = z.current) == null ? void 0 : E.querySelector('[aria-current="location"]')) == null || L.scrollIntoView({ block: "center" });
  }, [e, i]), O(() => {
    var T, E;
    e === "search" && y >= 0 && ((E = (T = z.current) == null ? void 0 : T.querySelector('[aria-current="true"]')) == null || E.scrollIntoView({ block: "nearest" }));
  }, [e, y]);
  const $ = (T) => {
    const E = v[T];
    E && (S(T), r(E.itemId));
  };
  return /* @__PURE__ */ D("aside", { ref: R, className: "reader-finder", "data-finder-tab": e, "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ D("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ D("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ p(te, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ p(te, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ p(te, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(ft, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" && f && d.length ? /* @__PURE__ */ D("div", { className: "reader-finder-switch", role: "radiogroup", "aria-label": "目录按什么列", children: [
      /* @__PURE__ */ p(te, { className: "reader-finder-switch-option", role: "radio", "aria-checked": b, onClick: () => h("bookmarks"), children: "按书签" }),
      /* @__PURE__ */ p(te, { className: "reader-finder-switch-option", role: "radio", "aria-checked": !b, onClick: () => h("headings"), children: "按标题" })
    ] }) : null,
    e === "outline" && b && l ? /* @__PURE__ */ p(op, { nodes: c, currentPage: m, onJumpPage: l }) : e === "outline" ? d.length ? /* @__PURE__ */ p("ol", { ref: z, className: "reader-finder-list", children: d.map((T, E) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ D(
      te,
      {
        className: "reader-finder-entry",
        "data-level": T.level,
        "aria-current": E === w ? "location" : void 0,
        onClick: () => r(T.itemId),
        children: [
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-text", children: T.text }),
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: T.page })
        ]
      }
    ) }, T.itemId)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: u.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ D(Ce, { children: [
      /* @__PURE__ */ D("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
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
              T.key === "Enter" ? (T.preventDefault(), $(Zl(y, v.length, T.shiftKey))) : T.key === "Escape" && (T.preventDefault(), n()), T.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: v.length === 0 ? "没有找到" : `${y >= 0 ? `第 ${y + 1} / ` : ""}${v.length >= 200 ? "200+ 处，只列前 200 处" : `${v.length} 处`}${y < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { className: "reader-finder-list", children: v.map((T, E) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ D(te, { className: "reader-finder-entry is-hit", "aria-current": E === y ? "true" : void 0, onClick: () => $(E), children: [
        /* @__PURE__ */ D("span", { className: "reader-finder-entry-text", children: [
          T.snippet.slice(0, T.at),
          /* @__PURE__ */ p("mark", { children: T.snippet.slice(T.at, T.at + T.length) }),
          T.snippet.slice(T.at + T.length)
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: T.page })
      ] }) }, T.itemId)) })
    ] })
  ] });
}
function up({
  active: e,
  extensions: t = sr
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
  })(), m = M(null);
  return O(() => {
    if (!n && !o) return;
    const d = () => {
      r(!1), a(null);
    }, f = (h) => {
      var b;
      (b = m.current) != null && b.contains(h.target) || d();
    }, g = (h) => {
      h.key === "Escape" && d();
    };
    return document.addEventListener("pointerdown", f, !0), document.addEventListener("keydown", g), () => {
      document.removeEventListener("pointerdown", f, !0), document.removeEventListener("keydown", g);
    };
  }, [n, o]), /* @__PURE__ */ D("div", { className: "reader-toolball", ref: m, "data-open": n ? "true" : void 0, children: [
    u,
    n ? /* @__PURE__ */ p("div", { className: "reader-toolball-stack", role: "group", "aria-label": "工具", children: t.map((d) => {
      const f = ir([d]);
      return /* @__PURE__ */ D(Xn, { children: [
        i(d.id).map((g) => {
          const h = `${d.id}:${g.key}`, b = g.Icon;
          return /* @__PURE__ */ p(
            te,
            {
              className: "reader-toolball-item",
              "aria-label": g.label,
              title: g.title || g.label,
              "aria-pressed": !!g.pressed || o === h,
              "data-toolball-item": g.key,
              onClick: () => {
                var w;
                if (g.popup) {
                  a((v) => v === h ? null : h);
                  return;
                }
                (w = g.onClick) == null || w.call(g), r(!1);
              },
              children: /* @__PURE__ */ p(b, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
            },
            h
          );
        }),
        f.length ? /* @__PURE__ */ p(Lm, { active: e, tabs: f }) : null
      ] }, d.id);
    }) }) : null,
    /* @__PURE__ */ p(
      te,
      {
        className: "reader-toolball-ball",
        "aria-label": n ? "收起工具" : `工具：${l.join("、")}`,
        title: n ? "收起" : "工具",
        "aria-expanded": n,
        "data-active": e || c ? "true" : void 0,
        onClick: () => {
          r((d) => !d), a(null);
        },
        children: n ? /* @__PURE__ */ p(ft, { size: 20, strokeWidth: 2.2, "aria-hidden": !0 }) : /* @__PURE__ */ p(Xs, { size: 20, strokeWidth: 2.1, "aria-hidden": !0 })
      }
    )
  ] });
}
function dp(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function fp(e) {
  var r;
  if (e.shiftKey || dp(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${Yo}`))) return null;
  const n = Number((r = t.closest(`[${Ie}]`)) == null ? void 0 : r.getAttribute(Ie)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function mp({
  menu: e,
  onClose: t,
  actions: n,
  sections: r
}) {
  const o = M(null);
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
  return /* @__PURE__ */ D("div", { ref: o, className: "reader-ink-menu", style: { left: s, top: i }, "data-ink-menu": "true", children: [
    n.length ? /* @__PURE__ */ p("div", { className: "reader-ink-menu-actions", role: "menu", "aria-label": "书页", children: n.map((c) => /* @__PURE__ */ D(
      te,
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
function hp({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ p("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ D("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
    /* @__PURE__ */ p("span", { children: n.phase === "failed" ? n.message : `改了 ${t} 处，还没排进 PDF` }),
    t ? /* @__PURE__ */ p(
      te,
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
const os = "retainpdf:reader:doc-theme:v1", Do = "data-reader-doc";
function as() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function pp(e = as()) {
  try {
    return (e == null ? void 0 : e.getItem(os)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function gp(e, t = as()) {
  try {
    t == null || t.setItem(os, e);
  } catch {
  }
}
function Co(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(Do, "dark") : t.removeAttribute(Do));
}
function bp() {
  const [e, t] = P(() => pp());
  O(() => {
    Co(e);
  }, [e]), O(() => () => Co("light"), []);
  const n = A(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return gp(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
function yp({ state: e, bookmarks: t }) {
  const { finder: n, setFinder: r, toggleFinder: o, findQuery: a, setFindQuery: s, findTerm: i, findFocus: c, jumpFromFinder: l, jumpToPageFromFinder: u } = e;
  return /* @__PURE__ */ D(Ce, { children: [
    /* @__PURE__ */ p(ip, { open: n, onToggle: o }),
    n ? /* @__PURE__ */ p(
      lp,
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
function vp({
  session: e,
  zoomDocuments: t,
  zoomItem: n,
  setZoomItem: r,
  closeZoom: o,
  visiblePdfMode: a
}) {
  return /* @__PURE__ */ p(Ce, { children: n ? /* @__PURE__ */ p(
    wm,
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
function wp(e) {
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
function Sp(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function kp(e, t) {
  const { sessionFiles: n } = e, [r, o] = P(!1), a = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, s = wp({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: n.translatedUrl,
    overlayContentAvailable: a,
    liveTranslationVisible: r,
    assistantOpen: t
  }), i = sl({
    hasOverlayContent: a,
    connection: e.liveTranslation.connection,
    showSource: s.showSource,
    liveTranslationVisible: r,
    assistantOpen: t
  }), c = s.sourceViewOnly, l = s.visibleMode;
  O(() => {
    o(!1);
  }, [e.viewStateKey]), O(() => {
    e.session.jobTerminal && o(!1);
  }, [e.session.jobTerminal]);
  const u = M(null);
  return O(() => {
    u.current !== e.viewStateKey && ll({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: c,
      jobTerminal: e.session.jobTerminal
    }) && (u.current = e.viewStateKey, o(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, c]), { liveTranslationVisible: r, setLiveTranslationVisible: o, paneComposition: s, liveToggles: i, sourceViewOnly: c, visiblePdfMode: l };
}
function Ip(e, { liveTranslationVisible: t, setLiveTranslationVisible: n, liveToggles: r, sourceViewOnly: o, visiblePdfMode: a }) {
  const s = il(e.liveTranslation), i = A(() => {
    s && e.goToPage(s, "source");
  }, [e.goToPage, s]), [c, l] = P(null);
  O(() => {
    a === "compare" && e.session.jobTerminal && l(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, a]);
  const u = c !== e.viewStateKey && ul({
    state: e.liveTranslation,
    sourceViewOnly: o,
    visibleMode: a
  }), m = q(() => r.sourcePaneToggle ? /* @__PURE__ */ p(
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
function Tp(e, {
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
  const { session: m, panes: d } = e, f = q(() => ({
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
    editBlock: u
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
  ]), [g] = P(Fd), h = Xd(g), b = q(() => jd(h), [h]), w = q(() => Vd(h), [h]), v = q(() => Wd(h), [h]), y = q(() => Hd(h), [h]), S = Ud(h), k = Kd(h);
  return { readerApi: f, contributionStore: g, contributions: h, pageLayers: b, compareVersion: w, textMarks: v, menuSections: y, pointerTakenId: S, reserveRight: k };
}
function Rp() {
  try {
    return qe().translationEdit ?? null;
  } catch {
    return null;
  }
}
const Ep = "这本书正在处理（翻译或排版），处理完才能改。", Pp = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function Mp({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = Rp(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = eu(s), l = !t || Bt(t), u = su(n), [m, d] = P(""), [f, g] = P(null), [h, b] = P(() => /* @__PURE__ */ new Map()), [w, v] = P(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [y, S] = P(() => /* @__PURE__ */ new Map()), [k, R] = P({ phase: "idle" }), N = M({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  O(() => {
    g(null), N.drafts.clear(), N.generation.current = null, S(/* @__PURE__ */ new Map()), R({ phase: "idle" });
  }, [s]), O(() => {
    if (d(""), !i || c || !a) return;
    let C = !1;
    return a.resolveOwnerJobId(s).then((K) => {
      C || d(`${K || s}`.trim() || s);
    }).catch(() => {
      C || d(s);
    }), () => {
      C = !0;
    };
  }, [i, c, a, s]), O(() => {
    if (b(/* @__PURE__ */ new Map()), !a || !m || !u || !l) return;
    let C = !1;
    return a.fetchRevisions(m).then((K) => {
      C || b(iu(K, u));
    }).catch(() => {
    }), () => {
      C = !0;
    };
  }, [a, m, u, l]);
  const z = k.phase === "running" && k.seenActive;
  O(() => {
    if (k.phase === "running") {
      if (!l) {
        z || R({ phase: "running", seenActive: !0 });
        return;
      }
      z && R(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [k.phase, z, l, t]);
  const $ = q(() => {
    const C = new Map(h);
    if (w.renderedAt === u)
      for (const [K, U] of w.edits) C.set(K, U);
    return C;
  }, [h, w, u]), _ = A((C) => {
    const K = `${C || ""}`.trim();
    K && g({ itemId: K, page: tu(K) });
  }, []), I = A(() => g(null), []), T = A((C, K) => {
    v((U) => {
      const G = new Map(U.renderedAt === u ? U.edits : []);
      return G.set(C, K), { renderedAt: u, edits: G };
    }), S((U) => new Map(U).set(C, (U.get(C) || 0) + 1));
  }, [u]), E = A(async () => {
    if (!(!a || !s || k.phase === "submitting" || k.phase === "running")) {
      R({ phase: "submitting" });
      try {
        await a.rerender(s), R({ phase: "running", seenActive: !1 }), await o();
      } catch (C) {
        R({ phase: "failed", message: (C == null ? void 0 : C.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, k.phase, o]), L = c ? Pp : !l || k.phase === "running" || k.phase === "submitting" ? Ep : "";
  return q(() => ({
    available: i,
    blockedReason: L,
    port: a,
    ownerJobId: m,
    target: f,
    select: _,
    close: I,
    memory: N,
    pendingEdits: $,
    savedCounts: y,
    markSaved: T,
    rerender: k,
    startRerender: E
  }), [i, L, a, m, f, _, I, N, $, y, T, k, E]);
}
function _p(e, t) {
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
function Np(e, t, n) {
  const { session: r, sessionFiles: o } = e, a = Mp({
    jobId: r.jobId,
    jobStatus: r.jobStatus,
    jobPayload: r.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!o.translatedUrl,
    refreshJobStatus: r.refreshJobStatus
  }), s = a.select, i = e.setModeKeepingPage, c = r.regions, l = a.memory.drafts, u = A((d, f) => {
    ya(c, d) && (t === "source" && i("compare"), f != null && f.trim() && l.set(d, f), s(d));
  }, [c, s, t, i, l]);
  _p(a.available ? u : null, n);
  const m = q(() => {
    if (!a.savedCounts.size) return e.revisedBlocks;
    const d = new Map(e.revisedBlocks);
    for (const [f, g] of a.savedCounts) d.set(f, (d.get(f) || 0) + g);
    return d;
  }, [e.revisedBlocks, a.savedCounts]);
  return { blockEdit: a, editBlock: u, revisedBlocks: m };
}
const Ap = "reader-finder-input";
function xp(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function Lp(e, t = typeof window > "u" ? null : window) {
  O(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!xp(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(Ap) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function Dp(e) {
  const [t, n] = P(null), r = A((f) => n((g) => g === f ? null : f), []), [o, a] = P(""), [s, i] = P("");
  O(() => {
    const f = o.replace(/\s+/gu, " ").trim(), g = window.setTimeout(() => i(f), f ? 150 : 0);
    return () => window.clearTimeout(g);
  }, [o]);
  const [c, l] = P(0), u = A(() => {
    n("search"), l((f) => f + 1);
  }, []);
  Lp(u);
  const m = A((f) => {
    e.jumpToAnchor({ block_id: f }), (t === "outline" || Qe() < 900) && n(null);
  }, [e.jumpToAnchor, t]), d = A((f) => {
    e.goToPage(f), (t === "outline" || Qe() < 900) && n(null);
  }, [e.goToPage, t]);
  return { finder: t, setFinder: n, toggleFinder: r, findQuery: o, setFindQuery: a, findTerm: s, findFocus: c, jumpFromFinder: m, jumpToPageFromFinder: d };
}
function Cp(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : na(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Op(e, t) {
  return t === null || e !== t;
}
function $p(e, t) {
  const { boot: n } = e, r = M(null), o = M(null);
  O(() => {
    if (!(n.loading || n.failed)) {
      if (r.current !== e.viewStateKey) {
        r.current = e.viewStateKey;
        const a = Fe(e.viewStateKey), s = Cp({
          savedMode: a == null ? void 0 : a.mode,
          sourceViewOnly: t,
          viewportWidth: Qe()
        });
        o.current = s.auto ? s.mode : null, s.mode && s.mode !== e.mode && e.setModeKeepingPage(s.mode);
        return;
      }
      Op(e.mode, o.current) && (o.current = null, gn(e.viewStateKey, { mode: e.mode }));
    }
  }, [n.failed, n.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, t]);
}
const zp = [];
function Fp(e) {
  const { sessionFiles: t } = e, [n, r] = P({}), o = M({ source: t.sourceUrl, translated: t.translatedUrl });
  o.current = { source: t.sourceUrl, translated: t.translatedUrl };
  const a = A((b, w) => {
    r((v) => ({ ...v, [w]: { url: o.current[w], nodes: b } }));
  }, []), s = q(() => {
    const b = n.source;
    if (b && b.url === t.sourceUrl && b.nodes.length) return b.nodes;
    const w = n.translated;
    return w && w.url === t.translatedUrl && w.nodes.length ? w.nodes : zp;
  }, [n, t.sourceUrl, t.translatedUrl]), i = M({}), [c, l] = P(0), u = A((b, w) => {
    i.current[w] = { url: o.current[w], pdf: b }, l((v) => v + 1);
  }, []), [m, d] = P(null), f = A((b) => d(b), []), g = A(() => d(null), []);
  O(() => d(null), [e.viewStateKey]);
  const h = q(() => {
    const b = (w, v) => {
      const y = i.current[w];
      return y && y.url === v ? y.pdf : null;
    };
    return { source: b("source", t.sourceUrl), translated: b("translated", t.translatedUrl) };
  }, [c, t.sourceUrl, t.translatedUrl]);
  return { bookmarks: s, onPdfOutline: a, onPdfDocument: u, zoomItem: m, setZoomItem: d, zoomBlock: f, closeZoom: g, zoomDocuments: h };
}
function Bp() {
  const e = vl(), { boot: t, panes: n, session: r } = e, o = Qh(e.viewStateKey), a = o.panel, s = o.setPanel, i = a !== null, { liveTranslationVisible: c, setLiveTranslationVisible: l, paneComposition: u, liveToggles: m, sourceViewOnly: d, visiblePdfMode: f } = kp(e, i);
  $p(e, d);
  const g = a || (e.mode === "compare" ? "compare" : "reading"), { docDark: h, toggleDocDark: b } = bp();
  El({
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
  const w = A(() => {
    s(null);
  }, []), { latestLivePage: v, jumpToLatestLivePage: y, offerCompletion: S, setCompletionDismissedKey: k, sourcePaneAction: R } = Ip(e, {
    liveTranslationVisible: c,
    setLiveTranslationVisible: l,
    liveToggles: m,
    sourceViewOnly: d,
    visiblePdfMode: f
  }), N = A((he) => {
    const Te = Sp(he, e.liveTranslationAvailable);
    Te !== null && l(Te), e.setModeKeepingPage(he);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), z = A((he) => {
    s(he);
  }, []), [$] = P(rp), _ = Dp(e), { finder: I, toggleFinder: T, findTerm: E } = _, L = A((he) => e.jumpToAnchor({ block_id: he }), [e.jumpToAnchor]), C = A((he, Te) => e.jumpToAnchor({ block_id: he }, Te), [e.jumpToAnchor]), { bookmarks: K, onPdfOutline: U, onPdfDocument: G, zoomItem: oe, setZoomItem: Z, zoomBlock: ne, closeZoom: j, zoomDocuments: W } = Fp(e), { blockEdit: x, editBlock: J, revisedBlocks: H } = Np(e, f, $), [V, ae] = P(null), se = A(() => ae(null), []), le = Nf({ documentId: r.documentId, jobId: r.jobId }), {
    readerApi: be,
    contributionStore: pe,
    contributions: nt,
    pageLayers: xe,
    compareVersion: ie,
    textMarks: me,
    menuSections: ye,
    pointerTakenId: B,
    reserveRight: Q
  } = Tp(e, {
    translationVersions: le,
    bookmarks: K,
    regionHover: $,
    assistantPanel: a,
    closeAssistant: w,
    visiblePdfMode: f,
    changeWorkspace: N,
    jumpToBlockIn: C,
    zoomDocuments: W,
    editBlock: x.available && !x.blockedReason ? J : null
  }), ce = !!B, [Le, Ee] = P([]), Pe = q(() => ({
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
    regionHover: $,
    jumpToBlock: L,
    revisedBlocks: H,
    onPdfOutline: U,
    onPdfDocument: G,
    zoomBlock: ne,
    textMarks: me,
    pageLayers: xe,
    editBlock: x.available ? J : void 0,
    blockEdit: x,
    editShowsSource: f !== "compare",
    findTerm: I === "search" ? E : "",
    compareVersion: ie,
    pointerTaken: ce,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: d,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: z, close: w },
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
    $,
    L,
    H,
    U,
    G,
    ne,
    me,
    xe,
    x,
    J,
    f,
    I,
    E,
    ie,
    ce,
    e.sourceOnly,
    d,
    e.download,
    e.goToPage,
    z,
    w,
    h,
    b
  ]), Be = q(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), Oe = [
    Xi,
    `is-workspace-${g}`,
    i ? "is-assistant-open" : "",
    I ? "is-finder-open" : "",
    u.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(Jd, { api: be, store: pe, children: /* @__PURE__ */ p(ed, { value: Pe, hud: Be, children: /* @__PURE__ */ D(
    "div",
    {
      className: Oe,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": g,
      "data-pointer-taken": B || void 0,
      "data-right-inset": Q ? "true" : void 0,
      style: Q ? { "--reader-right-inset": `${Q}px` } : void 0,
      onContextMenu: (he) => {
        const Te = fp(he);
        if (!Te) return;
        const Me = Bd(nt, { target: he.target, clientX: he.clientX, clientY: he.clientY, page: Te.page });
        !Me.length && !ye.length || (he.preventDefault(), Ee(Me), ae(Te));
      },
      children: [
        /* @__PURE__ */ p(kh, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!r.readerErrors.regions, metadataError: !!r.readerErrors.metadata, onRetry: r.refreshJobArtifacts }),
        /* @__PURE__ */ p(yp, { state: _, bookmarks: K }),
        /* @__PURE__ */ D("div", { className: "reader-chrome-tray", children: [
          /* @__PURE__ */ p(Ah, {}),
          /* @__PURE__ */ p(Ll, { onBeforeClose: r.prepareClose })
        ] }),
        /* @__PURE__ */ p(
          zd,
          {
            mode: f,
            documentReady: !!r.jobId,
            sourceViewOnly: d,
            onModeChange: N,
            liveTranslation: m.topBarPill ? {
              visible: c,
              state: e.liveTranslation,
              onToggle: () => l((he) => !he),
              latestPage: c ? v : null,
              currentPage: e.currentPage,
              onJumpToLatest: y
            } : null,
            completion: S ? {
              onOpenCompare: () => {
                k(e.viewStateKey), N("compare");
              }
            } : null
          }
        ),
        /* @__PURE__ */ p(Dm, { active: a }),
        i ? /* @__PURE__ */ p(wh, {}) : null,
        /* @__PURE__ */ p(Dd, { paneComposition: u, markdownSplit: i, assistantSplit: i, liveTranslation: e.liveTranslation, sourcePaneAction: R }),
        e.showHud ? /* @__PURE__ */ p(
          Zh,
          {
            mode: f,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            issuesJobId: e.sourceOnly ? "" : r.jobId,
            searchSlot: /* @__PURE__ */ p(cp, { open: I, onToggle: T })
          }
        ) : null,
        /* @__PURE__ */ p(
          vp,
          {
            session: r,
            zoomDocuments: W,
            zoomItem: oe,
            setZoomItem: Z,
            closeZoom: j,
            visiblePdfMode: f
          }
        ),
        /* @__PURE__ */ p(up, { active: a }),
        /* @__PURE__ */ p(mp, { menu: V, onClose: se, actions: Le, sections: ye }),
        /* @__PURE__ */ p(Yd, { extensions: sr }),
        /* @__PURE__ */ p(hp, { edit: x }),
        /* @__PURE__ */ p(np, {})
      ]
    }
  ) }) });
}
function lg() {
  return /* @__PURE__ */ p(Bp, {});
}
export {
  lg as R,
  Bp as a,
  sg as b,
  ig as c,
  sf as d,
  lf as e,
  og as f,
  ag as g,
  ng as h,
  rg as r,
  cg as s,
  Je as u
};
//# sourceMappingURL=ReaderApp-xMiGCGmE.js.map
