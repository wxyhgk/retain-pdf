var ss = Object.defineProperty;
var Sr = (e) => {
  throw TypeError(e);
};
var is = (e, t, n) => t in e ? ss(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var kr = (e, t, n) => is(e, typeof t != "symbol" ? t + "" : t, n), Ir = (e, t, n) => t.has(e) || Sr("Cannot " + n);
var _t = (e, t, n) => (Ir(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Tr = (e, t, n) => t.has(e) ? Sr("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Rr = (e, t, n, r) => (Ir(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as D, jsx as g, Fragment as Le } from "react/jsx-runtime";
import { useMemo as V, useState as _, useEffect as C, useCallback as L, useRef as N, useLayoutEffect as Ee, memo as Vt, createContext as qt, useContext as at, Fragment as Co, forwardRef as Oo, useImperativeHandle as Gn, useSyncExternalStore as mn, Component as cs, Suspense as $o, lazy as zo, useId as Fo } from "react";
import { requireAdapter as Mt, getReaderAdapters as _e } from "./adapters.js";
import { resolveReaderDownloadName as ls, resolveReaderDownloadUrls as us, READER_PROGRESS_COPY as Fe, trimString as on, READER_DOWNLOAD_ACTIONS as ds, disabledReason as fs } from "./runtime/state.js";
import { r as ms, b as hs } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as Nn, isFinishedJobStatus as Bt } from "@retainpdf/domain/job";
import { n as Bo, d as ps, f as yn, k as Er, b as gs, c as bs, j as Ne, p as ut, g as ys, l as Rt, i as vs } from "./reader-regions-BmqHsJ-I.js";
import { fetchDocumentReading as ws } from "@retainpdf/api/documents";
import { isReaderTransportError as Ss, createReaderTransportError as ks } from "./contracts.js";
import { toast as An, Toaster as Is } from "sonner";
import { X as dt, PenLine as Xn, ZoomIn as Ts, Check as jo, Copy as Rs, ChevronUp as Es, ChevronDown as Ho, History as Ps, LoaderCircle as Ms, Pin as _s, LogOut as Ns, FileText as Uo, Columns2 as Wo, Languages as Ko, Radio as As, ArrowDownToLine as xs, CheckCircle2 as Ls, GitCompareArrows as Ds, ChevronLeft as Cs, ChevronRight as Vo, Minus as Os, Plus as $s, ArrowLeft as zs, Keyboard as Fs, Download as Bs, ListOrdered as js, TriangleAlert as Hs, Search as Us, ListTree as Ws, LayoutGrid as Ks, Highlighter as Vs, Eraser as qs, Undo2 as Js, Trash2 as Gs } from "lucide-react";
import { Button as Q, Textarea as Xs, IconButton as ot, Input as qo } from "@retainpdf/ui";
import { pdfjs as Jo, Page as Zs, Document as Ys } from "react-pdf";
import { e as Qs, m as ei, a as ti } from "./markdown-math-XkF5urpn.js";
const ni = (...e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, ri = "", oi = Object.freeze({
  progress: "retainpdf-reader-progress"
}), ai = (e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, Wp = (...e) => {
  var n;
  return (((n = _e()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Kp = () => {
  var e, t;
  return ((t = (e = _e()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
}, Be = () => Mt("defaultReaderDataPort"), Pr = () => Mt("defaultReaderPageConfigPort"), Vp = {
  get apiPrefix() {
    return Be().apiPrefix;
  },
  fetchProtected: (...e) => Be().fetchProtected(...e),
  loadMarkdownPayload: (e) => Be().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => Be().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => Be().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => Be().loadJobPayload(e),
  loadReaderPayload: (e, t) => Be().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => Be().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return Be().liveTranslation;
  }
}, Go = {
  messageTargetOrigin: () => Pr().messageTargetOrigin(),
  readerJobId: () => Pr().readerJobId()
}, si = () => {
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
}, Ke = () => {
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
}, ii = (...e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, ci = () => {
  var e, t;
  return ((t = (e = _e()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, li = (...e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, ui = (...e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? ls(...e);
}, di = (...e) => {
  var t, n;
  return ((n = (t = _e()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? us(...e);
}, fi = (...e) => Mt("downloadProtectedResource")(...e), mi = (...e) => Mt("failDownloadToast")(...e), qp = (e, t) => Mt("resolveMarkdownAssetUrl")(e, t), Mr = "/api/v1";
function hi() {
  const e = () => {
    var r;
    return ms(
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
function pi() {
  const e = hi(), t = V(() => li(Go), [e]), n = V(() => ci(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function gi(e) {
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
function _r(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function bi(e) {
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
function Nr(e, t) {
  return ai(Nn(e, t));
}
function yi(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function vi(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !yi(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function xn({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: oi.progress,
        stage: n,
        percent: e,
        text: t
      },
      Go.messageTargetOrigin()
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
  }), xn({ percent: t, text: n, stage: r });
}
function wi(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = _(null), [l, u] = _(null), [m, d] = _(""), [f, p] = _(0), h = m === n ? i : null, b = m === n ? l : null, w = _r(h), v = Bt(w), y = L(() => {
    p((O) => O + 1);
  }, []), S = L((O) => {
    c(O.jobPayload), u(O.manifestPayload), d(O.sessionIdentity);
  }, []), k = L((O) => {
    c(null), u(null), d(O);
  }, []), E = N(""), x = N(""), $ = L(async () => {
    const O = o.current;
    if (!O || E.current === O) return;
    const A = Ke().loadJobPayload;
    if (typeof A != "function") return;
    const I = a.current.value;
    E.current = O;
    try {
      const T = await A(O);
      if (s.current || a.current.value !== I || o.current !== O || !T || typeof T != "object")
        return;
      const P = _r(T);
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
function Ln(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function Si(e, t) {
  e(t), Ln(t);
}
function ki(e) {
  const [t, n] = _(e ? "source" : "compare"), r = L((a) => {
    e && a !== "source" || (n(a), Ln(a));
  }, [e]), o = L((a) => {
    Si(n, a);
  }, []);
  return C(() => (e && document.documentElement.classList.add("reader-source-only"), Ln(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Ar(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function Ii(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Ar(n.active_job_id),
    activeVersionId: Ar(n.active_version_id)
  };
}
function Ti(e) {
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
function Ei(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Pi = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Mi(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Pi.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const _i = 48 * 1024 * 1024;
function Ni(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Ai = 2, Me = /* @__PURE__ */ new Map();
function Dn(e, t) {
  Me.delete(e), Me.set(e, t);
}
function xr(e) {
  if (Me.size < Ai) return;
  const t = Me.keys().next().value;
  t && Me.delete(t);
}
async function xi(e) {
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
    return Dn(r, y), y;
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
    const S = await xi(s);
    throw S && (y.reason = S), y;
  }
  const i = Li(r, s, t);
  if (i) {
    o.abort();
    const y = { ranged: i };
    return xr(), Me.set(r, y), y;
  }
  (b = (h = n.signal) == null ? void 0 : h.addEventListener) == null || b.call(h, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (v = (w = n.signal) == null ? void 0 : w.removeEventListener) == null || v.call(w, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return Me.has(r) ? Dn(r, l) : (xr(), Me.set(r, l)), l;
}
function Li(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < _i ? null : {
    url: e,
    length: o,
    async fetchRange(i, c) {
      const l = await n(e, { headers: { Range: `bytes=${i}-${c - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const Di = { file: null, loading: !1, error: "" }, Ci = { file: null, loading: !0, error: "" };
function Oi(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = _(null);
  if (C(() => {
    if (t || !n) return;
    const s = Me.get(n);
    if (s) {
      Dn(n, s);
      return;
    }
    const i = new AbortController();
    return Xo(n, void 0, { signal: i.signal }).then((c) => {
      i.signal.aborted || o({ url: n, file: c, loading: !1, error: "" });
    }).catch((c) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (c == null ? void 0 : c.message) || String(c) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Di;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = Me.get(n);
  return a ? { file: a, loading: !1, error: "" } : Ci;
}
function $i(e) {
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
async function Cn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  an(s, r, n, "download");
  const i = await Xo(t, jt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (an(s, o, n, "download"), i);
}
async function zi(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  an(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    Cn({
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
    Cn({
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
function Fi(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Bi({
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
  return a === n || !o ? !1 : (o.replace(Fi(o.href, t, a)), !0);
}
const Zt = {
  regions: null,
  metadata: null
};
function ji(e) {
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
  } = e, [v, y] = _(""), [S, k] = _(""), [E, x] = _(null), [$, O] = _(null), [A, I] = _(!1), [T, P] = _(""), [R, M] = _([]), [F, z] = _(!1), [G, J] = _(() => ({
    source: null,
    translated: null
  })), [oe, ne] = _(
    Zt
  ), [j, W] = _({
    loading: !0,
    percent: 4,
    text: Fe.boot,
    stage: "progress",
    failed: !1
  });
  return C(() => {
    const K = new AbortController(), fe = h.current.value, q = $i({
      sessionEpochRef: h,
      closingRef: b,
      abort: K,
      sessionEpoch: fe
    });
    w.current = K;
    const U = Ke();
    if (b.current)
      return K.abort(), () => {
        w.current === K && (w.current = null);
      };
    let ie = !1;
    function ge(se, me) {
      q.markFailed(), z(!0), W({
        loading: !1,
        percent: 100,
        text: se,
        stage: "failed",
        failed: !0
      }), xn({ percent: 100, text: me, stage: "failed" });
    }
    function ae() {
      I(!0), ie || z(!0), W({
        loading: !1,
        percent: 100,
        text: Fe.ready,
        stage: "ready",
        failed: !1
      }), xn({ percent: 100, text: Fe.ready, stage: "ready" });
    }
    function ue() {
      return l != null && l.documentId ? Nr(
        l.documentId,
        l.revision
      ) : ni() ? ri : U.resolveResourceUrl(Nn(r));
    }
    async function Re() {
      var ee;
      let se = { activeJobId: "", activeVersionId: "" };
      try {
        const re = await ((ee = U.fetchDocument) == null ? void 0 : ee.call(U, r));
        re && (se = Ii(re));
      } catch {
      }
      const me = Ti({
        link: se,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (me.kind === "follow-active-job") {
        if (q.isInactive()) return;
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
        if (q.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: me.revision,
          sessionIdentity: c
        }), f("source");
        return;
      }
      const be = ue();
      if (q.isInactive()) return;
      y(be), k(""), P(""), d(c);
      const H = await Cn({
        url: be,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: q,
        setBoot: W
      });
      if (!q.isInactive()) {
        if (!H) {
          ge("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        x(H), ae();
      }
    }
    async function qe() {
      var Xt;
      const se = !l, me = !!(se && U.loadSessionSnapshot && U.loadReaderOptionalArtifacts), be = me ? U.loadReaderOptionalArtifacts(t) : null, H = await ((Xt = U.loadSessionSnapshot) == null ? void 0 : Xt.call(U, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: se && !me
      })), ee = H ? {
        jobPayload: H.sourcePayload,
        manifestPayload: H.manifestPayload,
        readerMetadata: H.readerMetadata,
        regionsPayload: H.regions,
        readerErrors: H.readerErrors
      } : await U.loadReaderPayload(t, {
        includeOptionalArtifacts: se
      });
      if (q.isInactive()) return;
      let re = null;
      if (n && !r)
        if (H && H.linkedDocument !== void 0)
          re = H.linkedDocument;
        else {
          try {
            re = await U.fetchDocumentByJobId(Mr, t);
          } catch {
          }
          if (q.isInactive()) return;
        }
      const Ae = bi(ee.jobPayload) || `${(re == null ? void 0 : re.document_id) || ""}`.trim();
      Ae && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Ae
      });
      const Pe = Ri({
        payloadDocumentId: Ae,
        linkedActiveJobId: `${(re == null ? void 0 : re.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(re == null ? void 0 : re.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (Pe.kind === "restore-committed-source") {
        if (q.isInactive()) return;
        u({
          type: "committed-source",
          documentId: Pe.documentId,
          revision: Pe.revision,
          sessionIdentity: c
        }), f("source");
        return;
      }
      const he = U.resolveReaderSourcePdf(ee.manifestPayload), ye = U.resolveReaderTranslatedPdfUrl(ee.jobPayload, ee.manifestPayload), ht = typeof he == "string" ? he : U.resolveReaderArtifactUrl(he), $e = r || Ae, Je = l != null && l.documentId ? Nr(
        l.documentId,
        l.revision
      ) : ht || ($e ? U.resolveResourceUrl(Nn($e)) : ""), ze = l ? "" : ye || "";
      y(Je || ""), k(ze), P(vi(ee.jobPayload, t)), m({
        jobPayload: ee.jobPayload || null,
        manifestPayload: ee.manifestPayload || null,
        sessionIdentity: c
      });
      const nt = () => zi({
        sourceFinal: Je || "",
        translatedFinal: ze,
        fence: q,
        setBoot: W
      }), pt = !!(Je || ze), gt = be && pt ? nt() : null;
      gt == null || gt.catch(() => {
      });
      const Gt = (B) => {
        q.isInactive() || (M(l ? [] : Bo(B.regionsPayload)), J(l ? { source: null, translated: null } : ps(B.readerMetadata)), ne(l ? Zt : B.readerErrors ?? Zt), z(!0));
      };
      if (be ? (ie = !0, be.then(Gt)) : Gt(ee), !pt) {
        ge(Fe.failed, Fe.failed);
        return;
      }
      const bt = await (gt ?? nt());
      if (bt.status !== "inactive") {
        if (bt.status === "incomplete") {
          ge("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        x(bt.sourceBytes), O(bt.translatedBytes), ae();
      }
    }
    async function we() {
      I(!1), x(null), O(null), M([]), z(!1), J({ source: null, translated: null }), ne(Zt), an(W, 8, Fe.metadata, "metadata");
      try {
        if (s) {
          await Re();
          return;
        }
        if (!t) {
          ge(Fe.failed, Fe.failed);
          return;
        }
        await qe();
      } catch (se) {
        if (q.isClosedOrStale() || (se == null ? void 0 : se.name) === "AbortError") return;
        q.markFailed();
        const me = Number(se == null ? void 0 : se.status), be = `${(se == null ? void 0 : se.reason) || ""}`, H = Mi({ status: me, reason: be, sessionJobId: t });
        if (H && (await Bi({
          apiPrefix: Mr,
          documentId: H,
          expiredJobId: t
        }) || q.isClosedOrStale()))
          return;
        if (Ei({
          status: me,
          reason: be,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), f("source");
          return;
        }
        const ee = se instanceof Error ? se.message : Fe.failed;
        ge(ee, ee);
      }
    }
    return we(), () => {
      K.abort(), w.current === K && (w.current = null);
    };
  }, [t, r, o, a, s, i, l, p, n, c, u, m, d, f]), {
    sourceUrl: v,
    translatedUrl: S,
    sourceFile: E,
    translatedFile: $,
    assetsReady: A,
    title: T,
    regions: R,
    regionsSettled: F,
    readerMetadata: G,
    readerErrors: oe,
    boot: j
  };
}
function Hi() {
  const e = N(!1), t = N(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = pi(), s = N({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = N(a), c = N(""), l = N(""), u = N(() => {
  }), m = L(() => u.current(), []), d = gi({
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
  } = d, { mode: w, setMode: v, switchSessionMode: y } = ki(b);
  u.current = () => {
    y("source");
  }, i.current = a, c.current = p, l.current = f;
  const S = wi({
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
  } = S, T = ji({
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
  }, []), R = V(
    () => ({
      fetchProtected: Ke().fetchProtected,
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
const Ui = 160, Wi = 8, Ki = 0;
function Vi() {
  const e = N(null), [t, n] = _(null), [r, o] = _(Ki), a = L((s) => {
    e.current = s, n(s);
  }, []);
  return C(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (l) => {
      !Number.isFinite(l) || l < Ui || o((u) => Math.abs(u - l) < Wi ? u : l);
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
function qi(e) {
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
const vn = { source: 0, translated: 0 };
function Ji(e, t) {
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
    pages: vn
  })), [f, p] = _(() => ({ identity: l, tick: 0 })), h = m.identity === l ? m.pages : vn, b = f.identity === l ? f.tick : 0, w = qi({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: v } = w, y = L((I, T) => {
    u.current === l && d((P) => {
      const R = P.identity === l ? P.pages : vn;
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
  const E = V(
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
const Te = "data-reader-page", ke = "data-reader-pane", Zn = "data-natural-height", Gi = "reader-react-root", Zo = "reader-react-grid", Yo = "reader-react-scroll-shell", hn = "reader-react-pdf-pane", Qo = "reader-react-pdf-page", sn = "reader-react-pdf-page-placeholder", Yn = "reader-react-pdf-page-slot";
function cn(e, t) {
  const n = e != null ? `[${Te}="${e}"]` : `[${Te}]`;
  return t ? `${n}[${ke}="${t}"]` : n;
}
function Qn() {
  return `.${Yn}[${Te}]`;
}
function ln(e) {
  return Number(e.getAttribute(Te));
}
const ea = 0.25, un = 1, Xi = 0.05, Jt = 0.5, Zi = 16, Yi = 8, ta = Zi + Yi, Qi = 720;
function Qe() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function na(e) {
  return Number.isFinite(e) && e < Qi;
}
function St(e, t = Number.POSITIVE_INFINITY) {
  return na(t) && (e === "source" || e === "translated") ? un : Jt;
}
function Ue(e) {
  return Number.isFinite(e) ? Math.min(un, Math.max(ea, e)) : Jt;
}
function Ht(e, t) {
  const n = Ue(Number(e) + t * Xi);
  return Math.round(n * 100) / 100;
}
function ec(e) {
  return Math.round(Ue(e) * 100);
}
function ra(e) {
  const n = (Number(e) || 0) - ta;
  return Math.max(160, Math.floor(n));
}
function tc(e, t = Jt) {
  const n = Ue(t);
  return ra((Number(e) || 0) * n);
}
function nc(e, t) {
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
const rc = 8;
function oc(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < rc ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const oa = 200, ac = [
  "markdown"
], sc = ac;
function aa(e) {
  return sc.includes(e);
}
const ic = "retainpdf:reader:view:v1:", Lr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), cc = /* @__PURE__ */ new Set([
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
function On(e) {
  return `${e || ""}`.trim();
}
function lc({
  documentId: e,
  jobId: t
}) {
  const n = On(e);
  if (n) return `document:${n}`;
  const r = On(t);
  return r ? `job:${r}` : "";
}
function ia(e) {
  const t = On(e);
  return t ? `${ic}${t}` : "";
}
function uc(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function dc(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!Lr.has(t) || !Lr.has(n) || t === n))
    return { left: t, right: n };
}
function fc(e) {
  return e === null ? null : aa(e) ? e : void 0;
}
function mc(e) {
  return cc.has(e) ? e : void 0;
}
function ca(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = uc(t.anchor), r = Number(t.zoom), o = mc(t.mode), a = dc(t.splitLayout), s = fc(t.assistantPanel);
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
function Oe(e, t = sa()) {
  const n = ia(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? ca(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function pn(e, t, n = sa()) {
  const r = ia(e);
  if (!r || !n) return null;
  const o = Oe(e, n), a = ca({
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
function hc(e, t, n = "") {
  var d;
  const [r, o] = _(() => {
    var f;
    return ((f = Oe(n)) == null ? void 0 : f.zoom) ?? St(e, Qe());
  }), a = N(r), s = N(n);
  a.current = r;
  const i = N(1), c = N(((d = Oe(n)) == null ? void 0 : d.zoom) !== void 0);
  C(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const f = (h = Oe(n)) == null ? void 0 : h.zoom;
    c.current = f !== void 0;
    const p = f ?? St(e, Qe());
    i.current = 1, a.current = p, o(p);
  }, [e, n]), C(() => {
    if (c.current) return;
    const f = St(e, Qe()), p = a.current;
    Math.abs(f - p) < 5e-4 || (i.current = 1, a.current = f, o(f));
  }, [e]);
  const l = L((f, p) => {
    const h = Ue(f), b = a.current;
    Math.abs(h - b) < 5e-4 || (i.current = (p == null ? void 0 : p.keepScroll) === !1 ? 1 : h / (b || 1), a.current = h, c.current = !0, pn(s.current, { zoom: h }), o(h));
  }, []), u = L((f) => {
    l(Ht(a.current, f));
  }, [l]), m = L((f) => {
    l(St(f));
  }, [l]);
  return Ee(() => {
    const f = i.current;
    Math.abs(f - 1) < 1e-3 || (i.current = 1, nc(t == null ? void 0 : t.current, f));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: m };
}
const pc = 160, gc = 3e-3, Dr = 50, bc = 16, yc = 800;
function vc(e, t = 0) {
  const n = t === 1 ? bc : t === 2 ? yc : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-Dr, Math.min(Dr, r));
  return Math.exp(-o * gc);
}
function wc(e, t, n = 0) {
  return Ue(e * vc(t, n));
}
function Sc(e) {
  return Math.round(Ue(e) * 100) / 100;
}
function kc(e, t, n) {
  const r = Ue(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return Ue(t) / r;
  const a = (o + ta) / r;
  return ra(a * Ue(t)) / o;
}
function Ic(e) {
  return Array.from(e.querySelectorAll(Qn()));
}
function Tc(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function Rc(e, t, n) {
  let r = null;
  for (const s of Ic(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const c = Tc(i, t, n);
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
function Ec(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function la(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${Qn()}[${Te}="${t.page}"][${ke}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (Ec(n, e).scrollLeft += a);
}
function Pc(e, t, n, r) {
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
const Mc = 600, _c = 1e3;
function Nc(e, t) {
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
  const c = r.setTimeout(() => l(), _c);
  function l() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(c);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return l;
}
function Ac(e, t, n) {
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
      const m = Sc(u.target);
      if (Math.abs(m - r.current) < 5e-3) {
        Nt(u.grid);
        return;
      }
      const d = { anchor: u.anchor, grid: u.grid, fallback: null };
      d.fallback = setTimeout(() => {
        s.current === d && (s.current = null, Nt(d.grid));
      }, Mc), s.current = d, o.current(m, { keepScroll: !1 });
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
      m.target = wc(m.target, u.deltaY, u.deltaMode);
      const d = kc(m.start, m.target, ((p = m.anchor) == null ? void 0 : p.pageWidth) ?? 0);
      m.grid = Pc(e, d, u.clientX, u.clientY) ?? m.grid, m.timer && clearTimeout(m.timer), m.timer = setTimeout(c, pc);
    };
    return e.addEventListener("wheel", l, { passive: !1 }), () => {
      var m;
      e.removeEventListener("wheel", l);
      const u = a.current;
      a.current = null, u != null && u.timer && clearTimeout(u.timer), Nt((u == null ? void 0 : u.grid) ?? null), (m = i.current) == null || m.call(i), i.current = null;
    };
  }, [e]), Ee(() => {
    var l;
    const c = s.current;
    c && (s.current = null, c.fallback && clearTimeout(c.fallback), Nt(c.grid), !(!e || !c.anchor) && (la(e, c.anchor), (l = i.current) == null || l.call(i), i.current = Nc(e, c.anchor)));
  }, [t, e]);
}
function xc(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = N(t), a = N(n), s = N(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: L((c) => {
    c !== o.current && (s.current(), a.current(c));
  }, []) };
}
const er = 48;
function ua(e, t = er) {
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
  const o = ln(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function zt(e, t, n = er) {
  if (!e)
    return null;
  const r = cn(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = ua(e, n), i = da(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function Et(e, t, n = "auto", r, o = er) {
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
function $n(e, t, n) {
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
function Dc(e, t, n) {
  return $n(
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
function xe(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function Cc(e, t, n = !0, r = "", o) {
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
const Oc = `canvas, .react-pdf__Page, .${Qo}, .${sn}`, Cr = /* @__PURE__ */ new WeakMap();
function $c(e) {
  const t = Number(e.getAttribute(Zn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Cr.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(Oc), Cr.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function zc(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Fc(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(Qn()).forEach((r) => {
    const o = ln(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = $c(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Bc(e, t, n = "", r) {
  const [o, a] = _(() => /* @__PURE__ */ new Map()), s = N(o), i = N(r);
  return i.current = r, Ee(() => {
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
      const S = Fc(y);
      zc(s.current, S) || (s.current = S, a(S)), u && !m && (m = !0, (k = i.current) == null || k.call(i));
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
const jc = [0, 48, 140, 320, 560], Hc = 700, Uc = [80, 200, 400], Wc = 500, Kc = 50, Vc = /* @__PURE__ */ new Set([
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
]), qc = 180, Or = [0, 48, 140, 320, 700, 1200];
function Jc(e, t) {
  var T;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = N(
    ((T = Oe(a)) == null ? void 0 : T.anchor) || { page: 1, fraction: 0 }
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
      p.current = null, pn(h.current, {
        anchor: xe(i.current)
      });
    };
    P ? R() : p.current = setTimeout(R, qc);
  }, []), k = L((P) => {
    i.current = xe(P), c.current = null, f.current != null && clearTimeout(f.current), f.current = setTimeout(() => {
      f.current = null, l.current = !1;
    }, Kc);
  }, []);
  C(() => {
    if (!o)
      return;
    let P = !1, R = null, M = null, F = null;
    const z = () => {
      if (P) return;
      const G = e.current;
      if (!G) {
        F = setTimeout(z, 50);
        return;
      }
      R = G, M = () => {
        if (l.current)
          return;
        const J = zt(R, w.current);
        J && (i.current = J, S());
      }, R.addEventListener("scroll", M, { passive: !0 }), l.current || M();
    };
    return z(), () => {
      P = !0, F != null && clearTimeout(F), R && M && R.removeEventListener("scroll", M);
    };
  }, [o, r, n, e, S]), C(() => {
    if (!o) return;
    const P = e.current;
    if (!P) return;
    const R = (M) => {
      M.metaKey || M.ctrlKey || M.altKey || Vc.has(M.key) && y();
    };
    return P.addEventListener("wheel", y, { passive: !0 }), P.addEventListener("touchmove", y, { passive: !0 }), window.addEventListener("keydown", R), () => {
      P.removeEventListener("wheel", y), P.removeEventListener("touchmove", y), window.removeEventListener("keydown", R);
    };
  }, [o, e, y]), Ee(() => {
    var R;
    if (h.current === a) return;
    S(!0), v(), f.current != null && (clearTimeout(f.current), f.current = null), h.current = a, b.current = "";
    const P = (R = Oe(a)) == null ? void 0 : R.anchor;
    i.current = P ? xe(P) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, u.current = r;
  }, [a, r, S, v]), C(() => {
    var R;
    if (!o || !s || !a || b.current === a) return;
    b.current = a;
    const P = xe(
      ((R = Oe(a)) == null ? void 0 : R.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = P, c.current = P, l.current = !0, v(), m.current = $n(
      () => e.current,
      P,
      {
        behavior: "auto",
        pane: w.current,
        delaysMs: Or,
        onDone: () => k(P)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(P);
    }, Math.max(...Or) + 160), () => v();
  }, [o, s, a, e, k, v]), C(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, c.current = null, v();
      return;
    }
    const P = c.current ? xe(c.current) : xe(i.current);
    return l.current = !0, c.current = P, i.current = P, v(), m.current = $n(
      () => e.current,
      P,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: jc,
        onDone: () => k(P)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(P);
    }, Hc), () => {
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
    return xe(P || i.current);
  }, [e]), x = L(() => {
    l.current = !0;
    const P = zt(
      e.current,
      w.current
    ), R = xe(P ?? i.current);
    return i.current = R, c.current = R, S(), R;
  }, [e, S]), $ = L((P, R, M) => {
    const F = M || w.current, z = dn(P, R || 1), G = { page: z, fraction: 0 };
    i.current = G, l.current = !0, c.current = G, S(), v(), Lc(e.current, z, "smooth", F), m.current = Dc(
      () => e.current,
      z,
      {
        behavior: "auto",
        pane: F,
        delaysMs: Uc,
        onDone: () => k(G)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(G);
    }, Wc);
  }, [e, k, v, S]), O = L(() => xe(i.current), []), A = L(() => l.current, []), I = L(() => {
    if (!l.current || !c.current)
      return;
    const P = xe(c.current);
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
function Gc(e, t) {
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
const Xc = [0, 80, 200, 400, 800], Zc = 120, Yc = 400;
function Qc(e, t, n) {
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
    const h = ii(), b = Gc(h, d.current);
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
    for (const E of Xc)
      y = Math.max(y, E), v.push(
        setTimeout(() => {
          m.current(b);
        }, E)
      );
    return v.push(
      setTimeout(() => {
        var E;
        (E = p.current) == null || E.call(p);
      }, y + Zc)
    ), () => {
      for (const E of v) clearTimeout(E);
    };
  }, [r, o, c, l, t, u]);
}
function el(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function tl(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = Yc,
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
      const p = ((w = globalThis.location) == null ? void 0 : w.search) || "", h = hs(p, o, u.current);
      if (d.current = o, h === null) return;
      const b = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = fa(
        { blockId: b },
        o,
        { jobId: i, documentId: c }
      ), (m.current || el)(h);
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
function nl(e) {
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
  Qc(a, t, o), tl(e, t, n);
}
const At = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function rl(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function $r(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function ma(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = $r(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = $r(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function ol(e, t, n) {
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
function al(e) {
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
function sl(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function il(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function cl(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function ll(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const zr = [250, 500, 1e3, 2e3, 4e3], wn = [80, 160, 320, 640, 1e3, 1500], Fr = [250, 500, 1e3, 2e3, 4e3, 5e3];
function zn(e, t) {
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
function tr(e) {
  return Ss(e) ? `${e.code || ""}`.trim() : "";
}
function Yt(e, t) {
  const n = tr(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function ul(e, t, n, r, o) {
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
      const l = tr(c);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw c;
    }
    const i = wn[Math.min(s, wn.length - 1)];
    if (await zn(i, r), s >= wn.length + 2) throw a;
  }
}
function dl({
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
    const m = r === void 0 ? si() : r, d = i.current === c;
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
            layoutByPage: rl(S),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (S) {
          if ((S == null ? void 0 : S.name) === "AbortError") return;
          const k = tr(S);
          if (!(k === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !k)) {
            b((x) => ({
              ...x,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: Yt(S, "实时译文暂不可用")
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
            error: Yt(S, "正在等待 OCR 版面数据")
          })), await zn(zr[Math.min(y, zr.length - 1)], f.signal).catch(() => {
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
                k = await ul(
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
                  error: Yt(E, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              b((E) => {
                const x = ol(E, S, k);
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
        await zn(Fr[Math.min(y, Fr.length - 1)], f.signal).catch(() => {
        }), y += 1;
      }
    })(), () => f.abort();
  }, [n, r, c, u]), o;
}
function fl(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), c = Number(s.count) || 0;
    i && c > 0 && o.set(i, c);
  }
  return o;
}
function ml(e, t = !0) {
  const [n, r] = _(() => /* @__PURE__ */ new Map());
  return C(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = Ke().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(fl(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const hl = 4500;
function pl(e) {
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
const gl = /* @__PURE__ */ new Set(["book", "translate"]);
function ha(e) {
  return !!(e.jobId && e.sourceUrl && gl.has(e.workflow));
}
function bl(e) {
  return !!(ha(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function yl() {
  const e = Hi(), t = ha({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = bl({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = N({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Bt(o) && (r.current.running = !0);
  const a = dl({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = Vi(), u = ml(e.jobId, !e.sourceOnly), m = lc({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${m}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: f, onZoomChange: p } = hc(e.mode, s, m);
  Ac(i, f, p);
  const h = Ji(
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
  } = Jc(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: m,
    restoreReady: h.primaryNumPages > 0
  });
  C(() => {
    v();
  }, [c, v]);
  const y = Bc(
    s,
    h.compareMode,
    h.rowSyncRevision,
    v
  ), S = Cc(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${f}-${h.metricsTick}`,
    h.primaryPane
  ), k = L((z, G) => {
    var oe, ne;
    const J = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((oe = h.numPagesByPane) == null ? void 0 : oe.source) || 0,
      Number((ne = h.numPagesByPane) == null ? void 0 : ne.translated) || 0
    );
    w(z, J, G);
  }, [w, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [E, x] = _(null), $ = N(null), O = L((z) => {
    $.current && clearTimeout($.current), x(z), z && ($.current = setTimeout(() => x(null), hl));
  }, []);
  C(() => () => {
    $.current && clearTimeout($.current);
  }, []);
  const A = L((z) => {
    const G = yn(e.regions, z);
    return G ? Er(G, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), I = L((z, G) => {
    const J = G || h.primaryPane, oe = typeof z == "object" && z ? `${z.block_id || ""}`.trim() : "", ne = typeof z == "object" && z ? `${z.image_url || ""}`.trim() : "", j = typeof z == "object" && z ? z.page_idx != null ? Number(z.page_idx) + 1 : z.page != null ? Number(z.page) : null : typeof z == "number" ? z + 1 : null, W = gs(e.regions, ne, j) || yn(e.regions, oe) || (typeof z == "object" ? bs(e.regions, z) : null);
    let K = W ? Er(W, J).page : null;
    K == null && (K = pl(z)), !(K == null || K < 1) && (O(W), k(K, J));
  }, [O, k, h.primaryPane, e.regions]);
  nl({
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
      O(yn(e.regions, z.blockId));
    }
  });
  const { setModeKeepingPage: T } = xc({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: b
  });
  C(() => {
    O(null);
  }, [d, O]);
  const P = !e.boot.loading && !e.boot.failed, R = V(() => ({ bindShell: l, shellEl: i, shellWidth: c, shellRef: s }), [l, i, c, s]), M = V(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), F = V(() => ({
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
  return V(() => ({
    ...F,
    currentPage: S
  }), [F, S]);
}
const vl = [
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
], wl = [
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
  }
];
function Sl(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of vl)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function kl(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const Il = ".reader-notes-panel";
function Tl(e) {
  return e instanceof Element ? !!e.closest(Il) : !1;
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
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || kl(d.target) || Tl(d.target))
        return;
      const f = d.key, p = Sl(f);
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
const El = "retainpdf:soft-reader-close";
function Pl() {
  return new URL("./index.html", window.location.href).href;
}
function Ml() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: El },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function _l(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Nl() {
  if (!(typeof window > "u") && !Ml()) {
    if (_l(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Pl());
  }
}
function Al({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ g("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function xl({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ D(Al, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Nl();
  }, children: [
    /* @__PURE__ */ g(dt, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ g("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
const Ll = 3e3, Dl = 8;
async function Cl(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function Ol(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function $l(e) {
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
      const m = s[u], d = Ol(m == null ? void 0 : m.title);
      if (!d) continue;
      n -= 1;
      const f = c ? `${c}.${u}` : `${u}`, p = { id: f, title: d, page: null, level: i, children: [] };
      r.push({ node: p, dest: m.dest }), l.push(p), i < Dl && Array.isArray(m.items) && m.items.length && (p.children = o(m.items, i + 1, f));
    }
    return l;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await Cl(e, i);
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
function Br(e) {
  if (!e) return [];
  const t = e.split(".");
  return t.slice(0, -1).map((n, r) => t.slice(0, r + 1).join("."));
}
let jr = !1;
function zl() {
  if (jr)
    return;
  const e = jt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (Jo.GlobalWorkerOptions.workerSrc = e, jr = !0);
}
const Ye = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Fl = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Bl = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, jl = {
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
}, Hr = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function Hl(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Hr(o ?? a ?? "", Fl)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Hr(o ?? a ?? "", Bl)).replace(/\\([a-zA-Z]+)/gu, (r, o) => jl[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Ul(e) {
  return Ye(e.translatedBlockText) || Ye(e.translated.text) || Ye(e.source.text);
}
const Wl = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Kl(e) {
  const t = [];
  for (const n of e) {
    if (!Wl(n)) continue;
    const r = Hl(Ul(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function Vl(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const ql = 24, Jl = 60;
function Ur(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - ql), o = Math.min(e.length, n + t.length + Jl), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function Gl(e, t, n = 200) {
  const r = Ye(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = Ye(a.translatedBlockText) || Ye(a.translated.text), c = i ? Ur(i, r) : null, l = c ?? Ur(Ye(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: c ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
function Qt(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function Dt(e, t) {
  const n = Ye(t).toLowerCase();
  if (!n || !e) return Qt(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${Qt(e.slice(a, s))}<mark class="reader-find-mark">${Qt(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + Qt(e.slice(a));
}
function Xl(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const Zl = /^data-[a-z0-9-]+$/;
function Wr(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function Yl(e, t, n = "") {
  if (!t.length) return Dt(e, n);
  const r = t.filter((s) => s.end > s.start && s.start >= 0 && s.end <= e.length).map((s, i) => ({ mark: s, order: i })).sort((s, i) => s.mark.start - i.mark.start || s.order - i.order).map(({ mark: s }) => s);
  let o = "", a = 0;
  for (const s of r) {
    if (s.start < a) continue;
    o += Dt(e.slice(a, s.start), n);
    const i = Object.entries(s.attrs ?? {}).filter(([c]) => Zl.test(c)).map(([c, l]) => ` ${c}="${Wr(l)}"`).join("");
    o += `<mark class="${Wr(s.className)}"${i}>${Dt(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  }
  return o + Dt(e.slice(a), n);
}
function pe(e) {
  return typeof e == "string" ? e : "";
}
function Ql(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function eu(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function tu(e) {
  return {
    source: pe(e == null ? void 0 : e.source_text) || pe(e == null ? void 0 : e.unit_source_text),
    translated: pe(e == null ? void 0 : e.protected_translated_text) || pe(e == null ? void 0 : e.translated_text)
  };
}
const nu = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function ba(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function ru(e) {
  const t = ba(e).sort((r, o) => pe(r.ts).localeCompare(pe(o.ts)));
  return t.length ? [
    { text: pe(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: pe(r.new_text),
      label: nu[pe(r.source)] || pe(r.source) || "修订",
      ts: pe(r.ts),
      reason: pe(r.reason)
    }))
  ].reverse() : [];
}
function ou(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function au(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return pe(r.finished_at) || pe(n.finished_at) || "";
}
function su(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = ba(e).sort((a, s) => pe(a.ts).localeCompare(pe(s.ts)));
  for (const a of o) {
    const s = new Date(pe(a.ts)).getTime(), i = pe(a.reader_item_id) || pe(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, pe(a.new_text));
  }
  return n;
}
const iu = {
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
function cu(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = iu[pe(n.kind)] || pe(n.kind) || "问题", o = pe(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const lu = /* @__PURE__ */ new Set(["text", "formula"]);
function nr(e) {
  return lu.has(e);
}
function uu(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || nr(Ne(n));
}
function du(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !nr(Ne(r)) || (n.add(o), t.push(o));
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
    if (!pu.has(Ne(r.region))) return [];
    const o = ut(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function Kr(e, t, n) {
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
const ya = "reader-text-hover-tools";
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
const Iu = 26, Tu = 220;
function Ru(e, t = Tu) {
  return e.height < Iu * 2 || e.width < t;
}
function Eu({ state: e }) {
  return /* @__PURE__ */ g(e === "copied" ? jo : e === "failed" ? dt : Rs, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
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
  const [c, l] = _("idle"), [u, m] = _("idle"), [d] = _(() => ku()), f = N([]), p = (e == null ? void 0 : e.itemId) || "";
  if (C(() => {
    l("idle"), m("idle");
    const k = f.current;
    return () => {
      k.forEach((E) => window.clearTimeout(E)), f.current = [];
    };
  }, [p]), !e) return null;
  const h = ys(e.highlight.region, t), b = Ne(e.highlight.region), w = (k, E) => async (x) => {
    x.preventDefault(), x.stopPropagation();
    const $ = await bu(k);
    E($ ? "copied" : "failed"), f.current.push(window.setTimeout(() => E("idle"), 1200));
  }, v = b === "formula" ? "复制 LaTeX" : "复制", y = a || e.rect, S = s || (Ru(y) ? "outside" : "inside");
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
              en,
              {
                className: Su,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: w(e.itemId, m),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && nr(b) ? /* @__PURE__ */ g(
              en,
              {
                className: vu,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (k) => {
                  k.preventDefault(), k.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ g(Xn, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            h ? /* @__PURE__ */ g(
              en,
              {
                className: yu,
                state: c,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: c === "copied" ? "已复制" : c === "failed" ? "复制失败" : v,
                onClick: w(h, l),
                children: /* @__PURE__ */ g(Eu, { state: c })
              }
            ) : null,
            o ? /* @__PURE__ */ g(
              en,
              {
                className: wu,
                state: "idle",
                label: "放大看这一块",
                title: b === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (k) => {
                  k.preventDefault(), k.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ g(Ts, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
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
    const i = ut(
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
function va(e) {
  const t = `${e || ""}`, { text: n, slots: r } = Qs(t, { bareLatex: !0 }), o = xu(n), a = ei(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = xt.get(t);
  if (!s && (s = ti(o, r), xt.set(t, s), xt.size > Au)) {
    const i = xt.keys().next().value;
    i !== void 0 && xt.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function Sn(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function je(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Lu(e, t) {
  const n = e.typography, r = je(t) || 1, o = je(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = Sn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(s, i * r)), l = je(n == null ? void 0 : n.fit_min_font_size_pt), u = je(n == null ? void 0 : n.fit_max_font_size_pt), m = Math.max(3.5, (l || 5.5) * r), d = Math.max(
    m,
    u ? u * r : o ? o * r : c
  ), f = o ? o * r : c, p = je(n == null ? void 0 : n.leading_em), h = [
    je(n == null ? void 0 : n.padding_top_pt) || 0,
    je(n == null ? void 0 : n.padding_right_pt) || 0,
    je(n == null ? void 0 : n.padding_bottom_pt) || 0,
    je(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((b) => b * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Nu,
    fontSizePx: Math.max(m, Math.min(d, f)),
    minFontSizePx: m,
    maxFontSizePx: d,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: p ? 1 + p : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (Sn(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : Sn(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function Du(e, t, n, r) {
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
const Cu = 512, Lt = /* @__PURE__ */ new Map();
let Fn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Fn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Fn += 1;
}));
function Ou(e, t, n, r) {
  return [
    Fn,
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
  const n = N(null), r = V(
    () => va(e.translatedText),
    [e.translatedText]
  ), [o, a] = _(r.fallbackHtml), s = V(
    () => Lu(e, t),
    [e, t]
  );
  C(() => {
    let m = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((d) => {
      m && a(d);
    }), () => {
      m = !1;
    };
  }, [r]), Ee(() => {
    const m = n.current;
    if (!m) return;
    const [d, f, p, h] = s.padding, b = Math.max(1, e.rect.width - h - f), w = Math.max(1, e.rect.height - d - p), v = Ou(o, b, w, s);
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
function $u({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = V(
    () => _u(e, t, n, r),
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
const zu = Vt($u);
function Fu({
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
const Bu = Vt(Fu), Sa = 24, Xe = Sa * 2 + 4, He = 24, ju = 4, Hu = 6, st = (e) => e.left + e.width, tt = (e) => e.top + e.height;
function Ct(e, t) {
  const n = Math.min(st(e), st(t)) - Math.max(e.left, t.left), r = Math.min(tt(e), tt(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const Vr = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= st(t) && r >= t.top && r <= tt(t);
}, Uu = (e) => e.height > 40 && e.height > e.width * 2.5;
function Wu(e, t, n) {
  if (!t.length || e.height < He || e.width < n + 8) return null;
  const r = Math.max(...t.map(tt)), o = st(e) - 4 - n;
  for (const a of [r, tt(e) - 2]) {
    const s = Math.max(e.top, a - He), i = { left: o, top: s, width: n, height: He };
    if (!t.some((c) => Ct(i, c) > 0)) return s - e.top;
  }
  return null;
}
function Ku(e, t) {
  const n = [], r = (a) => {
    const s = Sa + ju, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: st(e), top: i, width: s, height: Xe } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: Xe } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - He - 3, width: Xe, height: He + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: tt(e), width: Xe, height: He + 3 } }), r(!0);
  const o = Wu(e, t, Xe);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: st(e) - 4 - Xe, top: e.top + o, width: Xe, height: He } }), n;
}
function Vu(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((v) => v.width > 0 && v.height > 0 && !Uu(v)), i = s.filter((v) => Vr(v, t)), c = s.filter((v) => !Vr(v, t)), l = n.filter((v) => v !== t && Ct(v, t) < t.width * t.height * 0.5), u = Ku(t, i).filter(({ box: v, overhang: y }) => {
    const S = y ? Hu : 0;
    return v.left >= -S && st(v) <= r + S && v.top >= 0 && tt(v) <= o;
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
function qu(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - He - 3 : tt(r);
  return t >= r.left - 4 && t <= r.left + Xe + 4 && n >= a && n <= a + He + 3;
}
const kn = (e) => e.left + e.width, In = (e) => e.top + e.height;
function Ju(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const l of t) {
    if (l.width <= 0 || l.height <= 0) continue;
    const u = l.left + l.width / 2, m = l.top + l.height / 2;
    u < e.left || u > kn(e) || m < e.top || m > In(e) || (o = Math.min(o, l.left), a = Math.min(a, l.top), s = Math.max(s, kn(l)), i = Math.max(i, In(l)));
  }
  if (!Number.isFinite(o)) return e;
  const c = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return c.width = Math.min(kn(e) + r, s + n) - c.left, c.height = Math.min(In(e) + r, i + n) - c.top, c.width * c.height < e.width * e.height * 0.3 && c.height < 24 ? e : c;
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
  const [o, a] = _(null);
  return Ee(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? Gu(s) : [], c = Ne(t.highlight.region) === "figure", l = i.length && !c ? Ju(t.rect, i) : t.rect, u = n.filter((d) => d.itemId !== t.itemId).map((d) => d.rect), m = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...Vu({ frame: l, others: u, pageWidth: r, pageHeight: m, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
const ka = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], qr = { pen: 35e-4, highlighter: 0.018 }, Jr = 0.015, Bn = "retainpdf.reader.ink.v1:";
function Gr(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(Bn + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function Zu(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(Bn + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(Bn + e);
    } catch {
    }
}
function Yu(e, t, n, r, o, a) {
  const s = Jr * Jr;
  return e.filter((i) => Ia(i, t, n) && i.points.some(([c, l]) => (c - r) ** 2 + ((l - o) * a) ** 2 <= s)).map((i) => i.id);
}
function Ia(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function Qu(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function ed(e) {
  const [t, n] = _(null), [r, o] = _(ka[0].key), [a, s] = _(() => Gr(e)), i = N(a), c = N([]);
  C(() => {
    const h = Gr(e);
    i.current = h, s(h), c.current = [];
  }, [e]);
  const l = L((h) => {
    i.current = h, s(h), Zu(e, h);
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
  return V(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: m, erase: d, undo: p, clearPage: f }),
    [t, r, a, m, d, p, f]
  );
}
const td = "reader-ink-layer";
function nd(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function Xr({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ g(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: nd(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function rd({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = _(null), i = N(!1), c = o.strokes.filter((h) => Ia(h, e, t)), l = !!o.tool;
  if (!l && !c.length) return null;
  const u = (h) => {
    const b = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - b.left) / Math.max(1, b.width))),
      Math.min(1, Math.max(0, (h.clientY - b.top) / Math.max(1, b.height)))
    ];
  }, m = (h, b) => o.erase(Yu(o.strokes, e, t, h, b, r / Math.max(1, n))), d = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [b, w] = u(h);
    o.tool === "eraser" ? m(b, w) : s([[b, w]]);
  }, f = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [b, w] = u(h);
    o.tool === "eraser" ? m(b, w) : s((v) => v ? Qu(v, b, w) : [[b, w]]);
  }, p = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: qr[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ D(
    "svg",
    {
      className: td,
      "data-ink-active": l ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: d,
      onPointerMove: f,
      onPointerUp: p,
      onPointerCancel: p,
      children: [
        c.map((h) => /* @__PURE__ */ g(Xr, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ g(Xr, { stroke: { tool: o.tool, color: o.color, width: qr[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
function od({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = _(null), [i, c] = _(!1), [l, u] = _([]), [m, d] = _(""), [f, p] = _(""), [h, b] = _(!1), [w, v] = _(null), [y, S] = _([]), k = r.drafts, E = r.generation, x = L(async (I, T) => {
    if (e)
      try {
        u(ru(await e.fetchRevisions(I, T)));
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
      const R = `${(T == null ? void 0 : T.item_id) || n}`, { source: M, translated: F } = tu(P);
      s({ readerItemId: n, itemId: R, source: M, current: F }), d(k.get(n) ?? F);
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
      return (M == null ? void 0 : M.reason) === "generation_mismatch" && (E.current = null), v({ tone: "error", message: (M == null ? void 0 : M.message) || "保存失败，请稍后再试。" }), S(cu(M == null ? void 0 : M.issues)), !1;
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
const Ta = "reader-inline-edit";
function ad({ text: e }) {
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
function sd({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var A;
  const s = e.itemId, i = od({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = _(!1), [u, m] = _(!1), d = N(null), f = hu(e.rect, t), p = V(() => du(o), [o]), h = p.indexOf(s), { loaded: b } = i, w = i.saving || i.loading, v = n.blockedReason, y = !b || i.draft === b.current, { close: S, select: k } = n, E = L((I) => {
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
  }, [E]), Ee(() => {
    const I = d.current;
    if (!I) return;
    I.style.height = "auto";
    const T = f.mode === "inline" ? f.minHeight : 0;
    I.style.height = `${Math.max(T, I.scrollHeight + 2)}px`;
  }, [i.draft, b, f.mode, f.mode === "inline" ? f.minHeight : 0]);
  const O = f.mode === "inline" ? { left: f.left, top: f.top, width: f.width } : { left: f.left, width: f.width, top: f.top, bottom: f.bottom };
  return /* @__PURE__ */ D(Le, { children: [
    f.mode === "popout" ? /* @__PURE__ */ g("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ D(
      "div",
      {
        className: `${Ta} is-${f.mode}`,
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
            Xs,
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
          b ? /* @__PURE__ */ g(ad, { text: i.draft }) : null,
          /* @__PURE__ */ D("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ g(ot, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => E(-1), children: /* @__PURE__ */ g(Es, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ g(ot, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= p.length - 1, onClick: () => E(1), children: /* @__PURE__ */ g(Ho, { size: 14, "aria-hidden": !0 }) }),
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
              Q,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": u,
                "data-block-edit-action": "history",
                onClick: () => m((I) => !I),
                children: [
                  /* @__PURE__ */ g(Ps, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ g(Q, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: x, children: "取消" }),
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
          u && b && i.history.length ? /* @__PURE__ */ g("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((I, T) => {
            const P = I.text === b.current, R = [ou(I.ts), I.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ D("li", { "data-block-edit-history": I.label, "data-current": P ? "true" : void 0, children: [
              /* @__PURE__ */ D("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ D("span", { children: [
                  R,
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
const Ra = qt(null), Ea = qt(null);
function id({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ g(Ra.Provider, { value: e, children: /* @__PURE__ */ g(Ea.Provider, { value: t, children: n }) });
}
function Ve() {
  return at(Ra);
}
function Pa() {
  return at(Ea);
}
const Ma = 1.414;
function cd({
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
  var se, me, be;
  const y = Ve(), S = y == null ? void 0 : y.revisedBlocks, k = y == null ? void 0 : y.blockEdit, E = k == null ? void 0 : k.pendingEdits, x = y == null ? void 0 : y.editBlock, $ = (y == null ? void 0 : y.findTerm) || "", O = y == null ? void 0 : y.textMarks, A = V(
    () => O ? ({ str: H }) => Yl(H, O(H), $) : $ ? ({ str: H }) => Dt(H, $) : void 0,
    [$, O]
  ), I = N(c ?? Ma), [T, P] = _(I.current);
  C(() => {
    c != null && Math.abs(c - I.current) >= 1e-3 && (I.current = c, P(c));
  }, [c]);
  const R = N(u);
  R.current = u;
  const M = N(null), F = N((H) => {
    var ee;
    M.current = H, (ee = R.current) == null || ee.call(R, H);
  }).current, z = N(null), G = N(`${t}@${n}`);
  Ee(() => {
    const H = `${t}@${n}`;
    G.current !== H && (G.current = H, o && ud(M.current, z.current));
  }, [o, n, t]), C(() => {
    o || Tn(z.current);
  }, [o]), C(() => () => Tn(z.current), []);
  const J = Math.max(120, Math.floor(t * T)), oe = Math.max(J, Math.ceil(s || 0)), ne = ut(m, t, J), j = V(
    () => gu(d, t, J),
    [J, d, t]
  ), [W, K] = _(null), fe = typeof p == "function", q = fe ? f ?? null : W, U = (H) => {
    fe ? H !== (f ?? null) && (p == null || p(H)) : K((ee) => ee === H ? ee : H);
  }, ie = V(
    () => j.find((H) => H.itemId === q) || null,
    [q, j]
  ), ge = r === "translated" && ((se = k == null ? void 0 : k.target) == null ? void 0 : se.itemId) || "", ae = V(
    () => ge && j.find((H) => H.itemId === ge) || null,
    [ge, j]
  ), ue = Xu(M, o ? ie : null, j, t), Re = (H) => {
    var he, ye, ht, $e, Je;
    if (H.pointerType === "touch") return;
    if ((he = y == null ? void 0 : y.ink) != null && he.tool) {
      U(null);
      return;
    }
    if (H.buttons !== 0) {
      U(null);
      return;
    }
    if ((ht = (ye = H.target) == null ? void 0 : ye.closest) != null && ht.call(ye, `.${ya}`) || (Je = ($e = H.target) == null ? void 0 : $e.closest) != null && Je.call($e, `.${Ta}`)) return;
    const ee = H.currentTarget.getBoundingClientRect(), re = H.clientX - ee.left, Ae = H.clientY - ee.top;
    if (qu(ue, re, Ae)) return;
    const Pe = Kr(j, re, Ae);
    U((Pe == null ? void 0 : Pe.itemId) || null);
  }, qe = (H) => {
    if (H.pointerType === "mouse") return;
    const ee = H.currentTarget.getBoundingClientRect(), re = Kr(
      j,
      H.clientX - ee.left,
      H.clientY - ee.top
    );
    U((re == null ? void 0 : re.itemId) || null);
  }, we = (H) => {
    !Number.isFinite(H) || H <= 0 || Math.abs(I.current - H) < 1e-3 || (I.current = H, P(H), l == null || l(e, H));
  };
  return /* @__PURE__ */ D(
    "div",
    {
      ref: F,
      [Te]: e,
      [ke]: r,
      [Zn]: J,
      className: Yn,
      onPointerMoveCapture: Re,
      onPointerDown: qe,
      onDoubleClick: (H) => {
        var re;
        const ee = y == null ? void 0 : y.zoomBlock;
        !ee || (re = y == null ? void 0 : y.ink) != null && re.tool || !ie || Ne(ie.highlight.region) === "figure" && (H.preventDefault(), ee(ie.itemId));
      },
      onPointerLeave: (H) => {
        H.pointerType === "mouse" && U(null);
      },
      style: {
        width: t,
        height: oe,
        minHeight: oe
      },
      children: [
        o ? /* @__PURE__ */ g(
          Zs,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: A,
            renderAnnotationLayer: !1,
            className: Qo,
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
                  we(re);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              Tn(z.current), i == null || i();
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
        ne ? /* @__PURE__ */ g(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": m == null ? void 0 : m.itemId,
            style: ne,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && w ? /* @__PURE__ */ g(
          zu,
          {
            layoutPage: h,
            pageState: b,
            width: t,
            height: J
          }
        ) : null,
        o && w && v ? /* @__PURE__ */ g("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (E != null && E.size) ? /* @__PURE__ */ g(Bu, { targets: j, edits: E, width: t, excludeId: ae == null ? void 0 : ae.itemId }) : null,
        o && ae && k ? /* @__PURE__ */ g(
          sd,
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
          rd,
          {
            page: e,
            pane: r === "translated" ? "translated" : y.compareVersion ? "compare" : "source",
            width: t,
            height: J,
            ink: y.ink
          }
        ) : null,
        (me = y == null ? void 0 : y.pageLayers) == null ? void 0 : me.map((H) => /* @__PURE__ */ g(Co, { children: H.render({ page: e, height: J }) }, H.id)),
        /* @__PURE__ */ g(
          Pu,
          {
            target: o && !((be = y == null ? void 0 : y.ink) != null && be.tool) && (ie == null ? void 0 : ie.itemId) !== (ae == null ? void 0 : ae.itemId) ? ie : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: ie && (S == null ? void 0 : S.get(ie.itemId)) || 0,
            onEdit: x,
            onZoom: y == null ? void 0 : y.zoomBlock,
            frameRect: ue == null ? void 0 : ue.rect,
            placement: ue == null ? void 0 : ue.placement,
            tailTop: ue == null ? void 0 : ue.tailTop
          }
        )
      ]
    }
  );
}
const ld = Vt(cd);
function ud(e, t) {
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
const dd = 2 * 1024 * 1024;
function fd(e) {
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
const Rn = 5, md = "120% 0px", hd = 120, pd = "25% 0px";
let Zr = 1;
const Yr = /* @__PURE__ */ new WeakMap();
function gd(e) {
  if (!e) return 0;
  const t = Yr.get(e);
  if (t) return t;
  const n = Zr;
  return Zr += 1, Yr.set(e, n), n;
}
function bd() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const yd = Oo(
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
    zl();
    const { file: A, loading: I, error: T } = Oi(n, r), P = `${n}\0${gd(A)}`, R = N(P);
    R.current = P;
    const M = V(() => {
      const B = Ni(A);
      return B ? "ranged" in B ? { range: fd(B.ranged) } : B : null;
    }, [A, n]), [F, z] = _(0), [G, J] = _(""), [oe, ne] = _(null), [j, W] = _(480), K = N(null), fe = N(0), q = V(() => bd(), []), U = V(() => ({
      cMapUrl: jt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: jt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: dd,
      disableAutoFetch: !0
    }), []);
    Gn(O, () => oe, [oe]), C(() => {
      const B = (X) => {
        fe.current = X, W(X);
      }, Y = (X) => {
        const le = oc(X, fe.current);
        if (le !== "ignore") {
          if (K.current && clearTimeout(K.current), le === "immediate") {
            B(X);
            return;
          }
          K.current = setTimeout(() => B(X), oa);
        }
      }, Z = !!(c && c >= 80);
      Y(Z ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const de = !Z && i && typeof ResizeObserver < "u" ? new ResizeObserver((X) => {
        var le, ve;
        Y(((ve = (le = X[0]) == null ? void 0 : le.contentRect) == null ? void 0 : ve.width) ?? i.clientWidth);
      }) : null;
      return de && i && de.observe(i), () => {
        de == null || de.disconnect(), K.current && clearTimeout(K.current);
      };
    }, [c, i, a]);
    const ie = V(
      () => tc(j, o),
      [j, o]
    ), [ge, ae] = _(() => /* @__PURE__ */ new Map()), [ue, Re] = _(() => /* @__PURE__ */ new Set()), [qe, we] = _(() => /* @__PURE__ */ new Set()), se = N(/* @__PURE__ */ new Map()), me = N(null), be = N(null), [H, ee] = _(() => /* @__PURE__ */ new Set()), re = N(/* @__PURE__ */ new Map()), Ae = L((B, Y) => {
      ae((Z) => {
        if (Z.get(B) === Y) return Z;
        const te = new Map(Z);
        return te.set(B, Y), te;
      });
    }, []), Pe = L((B, Y) => {
      const Z = se.current, te = Z.get(B), de = [me.current, be.current];
      if (te)
        for (const X of de)
          try {
            X == null || X.unobserve(te);
          } catch {
          }
      if (Y) {
        Z.set(B, Y);
        for (const X of de)
          try {
            X == null || X.observe(Y);
          } catch {
          }
      } else
        Z.delete(B);
    }, []), he = N(/* @__PURE__ */ new Map()), ye = L((B) => {
      const Y = he.current;
      let Z = Y.get(B);
      return Z || (Z = (te) => Pe(B, te), Y.set(B, Z)), Z;
    }, [Pe]);
    C(() => {
      if (typeof IntersectionObserver > "u") return;
      const B = re.current, Y = new IntersectionObserver(
        (Z) => {
          const te = [], de = [];
          for (const X of Z) {
            const le = X.target, ve = ln(le);
            Number.isFinite(ve) && (X.isIntersecting ? te : de).push(ve);
          }
          if ((te.length || de.length) && Re((X) => {
            let le = null;
            for (const ve of te)
              X.has(ve) || (le = le || new Set(X), le.add(ve));
            for (const ve of de)
              X.has(ve) && (le = le || new Set(X), le.delete(ve));
            return le || X;
          }), te.length) {
            for (const X of te) {
              const le = B.get(X);
              le && (clearTimeout(le), B.delete(X));
            }
            we((X) => {
              let le = null;
              for (const ve of te)
                X.has(ve) || (le = le || new Set(X), le.add(ve));
              return le || X;
            });
          }
          for (const X of de)
            B.has(X) || B.set(X, setTimeout(() => {
              B.delete(X), we((le) => {
                if (!le.has(X)) return le;
                const ve = new Set(le);
                return ve.delete(X), ve;
              });
            }, hd));
        },
        { root: i, rootMargin: md, threshold: 0 }
      );
      me.current = Y;
      for (const Z of se.current.values())
        try {
          Y.observe(Z);
        } catch {
        }
      return () => {
        Y.disconnect(), me.current === Y && (me.current = null);
        for (const Z of B.values()) clearTimeout(Z);
        B.clear();
      };
    }, [i]), C(() => {
      if (typeof IntersectionObserver > "u") return;
      const B = new IntersectionObserver(
        (Y) => {
          ee((Z) => {
            let te = null;
            for (const de of Y) {
              const X = ln(de.target);
              !Number.isFinite(X) || de.isIntersecting === Z.has(X) || (te = te || new Set(Z), de.isIntersecting ? te.add(X) : te.delete(X));
            }
            return te || Z;
          });
        },
        { root: i, rootMargin: pd, threshold: 0 }
      );
      be.current = B;
      for (const Y of se.current.values())
        try {
          B.observe(Y);
        } catch {
        }
      return () => {
        B.disconnect(), be.current === B && (be.current = null);
      };
    }, [i]);
    const ht = !!i && typeof IntersectionObserver < "u";
    Ee(() => {
      z(0), J(""), Re(/* @__PURE__ */ new Set()), we(/* @__PURE__ */ new Set()), ae(/* @__PURE__ */ new Map()), se.current.clear();
      const B = re.current;
      for (const Y of B.values()) clearTimeout(Y);
      B.clear(), h == null || h(0, t);
    }, [P, h, t]);
    const $e = L(
      (B) => {
        if (R.current !== P) return;
        const Y = B.numPages;
        z(Y), J(""), h == null || h(Y, t), m == null || m({ numPages: Y, pane: t }), f && typeof B.getPage == "function" && f(B, t), d && typeof B.getOutline == "function" && $l(B).then((Z) => {
          R.current === P && d(Z, t);
        }, () => {
        });
      },
      [P, m, d, f, h, t]
    ), Je = L(
      (B) => {
        if (R.current !== P) return;
        const Y = (B == null ? void 0 : B.message) || "PDF 解析失败";
        J(Y), z(0), h == null || h(0, t), p == null || p(B, t);
      },
      [P, p, h, t]
    ), ze = V(
      () => F > 0 ? Array.from({ length: F }, (B, Y) => Y + 1) : [],
      [F]
    );
    C(() => {
      typeof IntersectionObserver < "u" || we(new Set(ze));
    }, [ze]);
    const nt = V(
      () => Rt(b, v, t),
      [b, v, t]
    ), pt = V(() => {
      const B = /* @__PURE__ */ new Map();
      for (const Y of w) {
        const Z = Rt(Y, v, t);
        if (!Z) continue;
        const te = B.get(Z.box.page) || [];
        te.push(Z), B.set(Z.box.page, te);
      }
      return B;
    }, [t, v, w]), gt = V(() => {
      const B = /* @__PURE__ */ new Set();
      if (!y) return B;
      for (const [Y, Z] of pt)
        Z.some((te) => te.itemId === y) && B.add(Y);
      return B;
    }, [y, pt]), Gt = V(() => {
      if (F === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(ze);
      if (ue.size === 0) {
        const Z = Math.min(F, Rn * 2 + 1);
        return new Set(Array.from({ length: Z }, (te, de) => de + 1));
      }
      const Y = /* @__PURE__ */ new Set();
      for (const Z of ue)
        for (let te = -Rn; te <= Rn; te++) {
          const de = Z + te;
          de >= 1 && de <= F && Y.add(de);
        }
      return Y;
    }, [F, ze, i, a, ue]), bt = !n || !!T || !!G, Xt = n && (T || G) || s;
    return /* @__PURE__ */ D(
      "section",
      {
        ref: ne,
        className: `reader-panel ${hn}${a ? "" : " is-hidden"}`,
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
          bt && !I ? /* @__PURE__ */ g("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: Xt }) : null,
          I ? /* @__PURE__ */ g("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          M && !T ? /* @__PURE__ */ g("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ g(
            Ys,
            {
              file: M,
              loading: null,
              error: null,
              options: U,
              onLoadSuccess: $e,
              onLoadError: Je,
              className: "reader-react-pdf-document",
              children: ze.map((B) => {
                if (Gt.has(B))
                  return /* @__PURE__ */ g(
                    ld,
                    {
                      pane: t,
                      pageNumber: B,
                      width: ie,
                      devicePixelRatio: q,
                      active: qe.has(B),
                      textLayer: !ht || H.has(B),
                      syncedMinHeight: (l == null ? void 0 : l.get(B)) || 0,
                      onMetrics: u,
                      cachedAspect: ge.get(B),
                      onAspectChange: Ae,
                      sentinelRef: ye(B),
                      regionHighlight: (nt == null ? void 0 : nt.box.page) === B ? nt : null,
                      regionTargets: pt.get(B),
                      hoveredRegionId: y && gt.has(B) ? y : null,
                      onHoverRegion: S,
                      liveTranslationLayout: k == null ? void 0 : k.layoutByPage.get(B - 1),
                      liveTranslationPage: k == null ? void 0 : k.pagesByPage.get(B - 1),
                      showLiveTranslation: E,
                      liveTranslationMissing: il(k, B - 1)
                    },
                    `${t}-${B}`
                  );
                const Z = ge.get(B) ?? Ma, te = Math.max(120, Math.floor(ie * Z)), de = Math.max(te, Math.ceil((l == null ? void 0 : l.get(B)) || 0));
                return /* @__PURE__ */ g(
                  "div",
                  {
                    ref: ye(B),
                    [Te]: B,
                    [ke]: t,
                    [Zn]: te,
                    className: `${Yn} is-placeholder`,
                    style: {
                      width: ie,
                      height: de,
                      minHeight: de
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
), Qr = Vt(yd), vd = 2e3, wd = 6, Sd = 500, eo = "reader-react-resizing";
function kd(e, t) {
  const n = N(null), r = N(null);
  Ee(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const S = Id(e), k = zt(e, S);
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
      m && clearTimeout(m), cancelAnimationFrame(u), w == null || w.disconnect(), e.classList.remove(eo);
      for (const k of to) e.removeEventListener(k, v);
      ((S = r.current) == null ? void 0 : S.stop) === v && (r.current = null);
    }, y = () => {
      Et(e, c, "auto", i);
      const S = e.scrollHeight;
      p = S === f ? p + 1 : 0, f = S;
      const k = performance.now() - h;
      p >= wd && (S !== d || k > Sd) || k > vd ? v() : u = requestAnimationFrame(y);
    };
    for (const S of to) e.addEventListener(S, v, { passive: !0 });
    for (const S of Array.from(e.children)) w == null || w.observe(S);
    e.classList.add(eo), r.current = { ...s, stop: v }, m = setTimeout(() => {
      m = null, h = performance.now(), d = e.scrollHeight, f = d, p = 0, u = requestAnimationFrame(y);
    }, oa);
  }, [e, t]), C(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Id(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Te}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(ke) || null;
  }
  return null;
}
const to = ["wheel", "touchstart", "keydown", "pointerdown"];
function Td(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function Rd(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(hn)) && ((n = e.hasAttribute) != null && n.call(e, ke)));
}
function Ed(e, t) {
  C(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!Rd(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${hn}[${ke}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const c = Td(a, i);
        if (c === null || Math.abs(i.scrollLeft - c) < 1) continue;
        const l = i.scrollLeft;
        i.scrollLeft = c, Math.abs(i.scrollLeft - l) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function Pd(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), c = t - i, l = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: c * l };
}
function Md(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const no = 12;
function rr(e) {
  return Array.from(e.querySelectorAll(`.${hn}[${ke}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function _d(e) {
  const t = e.getBoundingClientRect();
  return rr(e).map((n) => {
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
function Nd(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function Ad(e, t) {
  return e ? rr(e).find((n) => n.getAttribute(ke) === t) ?? null : null;
}
function xd({ shellEl: e }) {
  const [t, n] = _([]), r = N(0), o = L(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = _d(e);
      n((i) => Nd(i, s) ? i : s);
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
        for (const m of rr(e))
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
  return a.length ? /* @__PURE__ */ g("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ g(Ld, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function Ld({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - no * 2), r = Pd(e, n), o = N(null);
  if (!r) return null;
  const a = (d) => {
    const f = Ad(t, e.pane);
    f && (f.scrollLeft = d);
  }, s = (d) => {
    var f, p;
    d.button === 0 && (d.preventDefault(), d.stopPropagation(), (p = (f = d.currentTarget).setPointerCapture) == null || p.call(f, d.pointerId), o.current = { startX: d.clientX, startScroll: e.scrollLeft, pointerId: d.pointerId });
  }, i = (d) => {
    const f = o.current;
    !f || f.pointerId !== d.pointerId || a(f.startScroll + Md(e, n, r.size, d.clientX - f.startX));
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
      style: { left: e.left + no, width: n },
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
function _a(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Dd(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function Cd({ compare: e, onDone: t }) {
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
            /* @__PURE__ */ g("span", { className: "reader-version-compare-time", children: _a(n.createdAt) }),
            r ? /* @__PURE__ */ g("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ g(jo, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ g(Ms, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
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
            /* @__PURE__ */ g(_s, { size: 13, "aria-hidden": !0 }),
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
            /* @__PURE__ */ g(Ns, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function ro({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = Dd(t), a = [e === "compare" ? "对比" : "正在读", r, _a(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ D("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ g("em", { children: "RetainPDF" }),
    /* @__PURE__ */ g("strong", { children: o }),
    /* @__PURE__ */ g("span", { children: a })
  ] });
}
function Od({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = _({ source: null, translated: null });
  return Ee(() => {
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
    r.source ? /* @__PURE__ */ g("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ g(ro, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ g("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ g(ro, { role: "reading", ...n }) }) : null
  ] });
}
const $d = () => () => {
}, oo = () => null;
function zd({
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
function Fd(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function Bd(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function jd(e) {
  const t = Ve(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, m = e.bindShell ?? (t == null ? void 0 : t.bindShell), d = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, f = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Jt, p = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), b = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, w = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, v = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, y = (t == null ? void 0 : t.compareVersion) ?? null, S = (y == null ? void 0 : y.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", k = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", E = y ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, x = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, $ = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), O = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), A = t == null ? void 0 : t.onPdfOutline, I = t == null ? void 0 : t.onPdfDocument, T = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), P = e.regions ?? (t == null ? void 0 : t.regions) ?? [], R = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), M = (t == null ? void 0 : t.regionHover) ?? null, [F, z] = _(null), G = mn(
    M ? M.subscribe : $d,
    M ? () => M.get().itemId : oo,
    M ? () => M.get().itemId : oo
  ), J = M ? G : F, oe = L((K) => {
    M ? M.set(K, "pdf") : z(K);
  }, [M]), ne = zd({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), W = Number.isFinite(p) && p > 0 ? Fd(
    p,
    n || r,
    typeof document > "u" ? p * 2 : document.documentElement.clientWidth
  ) : null;
  return kd(d, W), Ed(d, ne.compareMode), /* @__PURE__ */ D(
    "div",
    {
      ref: m,
      className: Yo,
      "data-reader-region-count": P.length,
      "data-reader-structured-region-count": P.filter(vs).length,
      "data-reader-metadata-ready": R ? "true" : "false",
      children: [
        /* @__PURE__ */ D(
          "main",
          {
            className: `${Zo} reader-mode-${ne.mode}`,
            "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              b ? /* @__PURE__ */ g(
                Qr,
                {
                  pane: "source",
                  url: S,
                  preloadedFile: E,
                  userZoom: f,
                  visible: ne.showSource,
                  scrollRoot: d,
                  pageWidthOverride: W,
                  rowHeights: ne.compareMode ? h : void 0,
                  onMetrics: $,
                  emptyLabel: v ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: O,
                  onOutline: y ? void 0 : A,
                  onDocument: y ? void 0 : I,
                  activeRegion: T,
                  regions: (y == null ? void 0 : y.regions) ?? P,
                  readerMetadata: R,
                  hoveredRegionId: J,
                  onHoverRegion: oe,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? Bd(o) : "",
                  paneAction: u && ne.showTranslated ? /* @__PURE__ */ D(Le, { children: [
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
                Qr,
                {
                  pane: "translated",
                  url: k,
                  preloadedFile: x,
                  userZoom: f,
                  visible: ne.showTranslated,
                  scrollRoot: d,
                  pageWidthOverride: W,
                  rowHeights: ne.compareMode ? h : void 0,
                  onMetrics: $,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: O,
                  onOutline: A,
                  onDocument: I,
                  activeRegion: T,
                  regions: P,
                  readerMetadata: R,
                  hoveredRegionId: J,
                  onHoverRegion: oe,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ g(xd, { shellEl: d }),
        y ? /* @__PURE__ */ g(Od, { shellEl: d, left: y.left, right: y.right }) : null
      ]
    }
  );
}
const Hd = [
  { id: "source", label: "原文", Icon: Uo },
  { id: "compare", label: "对照", Icon: Wo },
  { id: "translated", label: "译文", Icon: Ko }
];
function Ud(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function Wd(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function Kd(e) {
  const t = Ve(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? Ud(a.state) : "";
  return /* @__PURE__ */ D("header", { className: "reader-workspace-bar", children: [
    /* @__PURE__ */ g("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
    /* @__PURE__ */ g("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
    /* @__PURE__ */ D("div", { className: "reader-workspace-center", children: [
      /* @__PURE__ */ g("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Hd.map(({ id: l, label: u, Icon: m }) => {
        const d = n === l, f = Wd({
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
              /* @__PURE__ */ g(As, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
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
              /* @__PURE__ */ g(xs, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
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
const Na = [];
function Vd() {
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
function qd(e, t) {
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
function Jd(e) {
  return e.flatMap(({ id: t, contribution: n }) => n.pageLayer ? [{ id: t, render: n.pageLayer }] : []);
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
  for (const { contribution: t } of e) if (t.comparedDocument) return t.comparedDocument;
  return null;
}
function Zd(e) {
  return e.flatMap(({ title: t, contribution: n }) => {
    var r;
    return (r = n.shortcuts) != null && r.length ? [{ title: t, items: n.shortcuts }] : [];
  });
}
const gn = qt(null), Aa = qt(null);
function Yd({ api: e, store: t, children: n }) {
  const r = V(() => ({ api: e, store: t }), [e, t]);
  return /* @__PURE__ */ g(gn.Provider, { value: r, children: n });
}
function bn() {
  const e = at(gn);
  if (!e) throw new Error("useReaderApi 要在 ReaderExtensionsProvider 里面用");
  return e.api;
}
const Qd = () => () => {
}, ao = () => Na;
function ef(e) {
  return mn(e.subscribe, e.getSnapshot, e.getSnapshot);
}
function xa() {
  var t;
  const e = (t = at(gn)) == null ? void 0 : t.store;
  return mn((e == null ? void 0 : e.subscribe) ?? Qd, (e == null ? void 0 : e.getSnapshot) ?? ao, (e == null ? void 0 : e.getSnapshot) ?? ao);
}
function or(e) {
  var a;
  const t = (a = at(gn)) == null ? void 0 : a.store, n = at(Aa);
  if (!n) throw new Error("useReaderContribution 只能在扩展组件里用");
  const { id: r, title: o } = n;
  C(() => {
    t == null || t.set(r, o, e);
  }, [t, r, o, e]), C(() => () => t == null ? void 0 : t.remove(r), [t, r]);
}
class tf extends cs {
  constructor() {
    super(...arguments);
    kr(this, "state", { failed: !1 });
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
  return /* @__PURE__ */ g(Le, { children: t.map(({ id: n, title: r, Component: o }) => /* @__PURE__ */ g(tf, { id: n, children: /* @__PURE__ */ g(rf, { id: n, title: r, children: /* @__PURE__ */ g(o, {}) }) }, n)) });
});
function rf({ id: e, title: t, children: n }) {
  const r = V(() => ({ id: e, title: t }), [e, t]);
  return /* @__PURE__ */ g(Aa.Provider, { value: r, children: n });
}
function of({
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
const af = 4e3;
function sf(e, t, n) {
  if (e.length) {
    const o = ga(e, n), a = o ? pa(e).find((s) => s.id === o) : null;
    if (a) return a.title;
  }
  let r = null;
  for (const o of t)
    !o.headingLevel || o.source.page > n || (!r || o.source.page >= r.source.page) && (r = o);
  return `${(r == null ? void 0 : r.source.text) || (r == null ? void 0 : r.markdown) || ""}`.replace(/\s+/g, " ").trim().slice(0, 80);
}
function so(e) {
  var a, s;
  if (!e || e.isCollapsed || !e.rangeCount) return { text: "", element: null, rect: null };
  const t = e.getRangeAt(0), n = t.startContainer, r = ((s = (a = n.nodeType === 1 ? n : n.parentElement) == null ? void 0 : a.closest) == null ? void 0 : s.call(a, `[${Te}]`)) ?? null;
  return r ? { text: `${e}`.replace(/\s+\n/g, `
`).trim().slice(0, af), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function cf(e, t, n, r, o) {
  let a = null, s = 0.15;
  for (const i of e) {
    const c = Rt(i, t, n);
    if (!c || c.box.page !== r) continue;
    const l = ut(c, 1, 1);
    if (!l) continue;
    const u = o.y < l.top ? l.top - o.y : o.y > l.top + l.height ? o.y - l.top - l.height : 0, m = o.x < l.left ? l.left - o.x : o.x > l.left + l.width ? o.x - l.left - l.width : 0, d = u + m * 0.25;
    (d < s || d === 0 && a === null) && (a = i, s = d);
  }
  return a;
}
function lf({
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
  const l = e.getAttribute(ke) === "source" ? "source" : "translated", u = e.getBoundingClientRect(), m = u.width > 0 && u.height > 0 ? { x: Math.min(1, Math.max(0, (t - u.left) / u.width)), y: Math.min(1, Math.max(0, (n - u.top) / u.height)) } : null, f = (r ? a.find((p) => p.itemId === r) ?? null : null) ?? (m ? cf(a, i, l, c, m) : null);
  return {
    pane: l,
    page: c,
    itemId: (f == null ? void 0 : f.itemId) ?? null,
    selection: o,
    sourceText: `${(f == null ? void 0 : f.source.text) || (f == null ? void 0 : f.markdown) || ""}`.trim(),
    translatedText: `${(f == null ? void 0 : f.translatedBlockText) || (f == null ? void 0 : f.translated.text) || ""}`.trim(),
    section: sf(s, a, (f == null ? void 0 : f.source.page) ?? c),
    point: m
  };
}
const io = 5e4, uf = 2e4;
function En(e, t) {
  const n = `${e || ""}`;
  return n.length > t ? n.slice(0, t) : n;
}
function Jp(e, t) {
  const n = { page: e.page, pane: e.pane, item_ids: e.itemId ? [e.itemId] : [] };
  return t.documentId && (n.document_id = t.documentId), t.jobId && (n.job_id = t.jobId), t.versionId && (n.translation_version = t.versionId), e.selection && (n.selected_text = e.selection), e.section && (n.section = e.section), e.sourceText && (n.source_text = e.sourceText), e.translatedText && (n.translated_text = e.translatedText), n;
}
function df(e, t = null) {
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
function ff(e, t) {
  if (!(e != null && e.page)) return null;
  const r = [!!(e.document_id && t && e.document_id !== t) ? "别的书" : "", `第 ${e.page} 页`, e.section || ""].filter(Boolean).join(" · ");
  return { page: e.page, label: r, data: e };
}
function mf(e, t) {
  var o;
  if (!t) return;
  const n = e.findIndex((a) => a.message_id === t);
  if (n < 0) return;
  const r = ((o = e[n + 1]) == null ? void 0 : o.role) === "assistant" ? hf(e[n + 1].text) : "";
  return { question: e[n].text, ...r ? { answer: r } : {} };
}
function hf(e, t = 160) {
  const n = e.replace(/```[\s\S]*?(```|$)/g, " ").replace(/\$\$[\s\S]*?\$\$/g, " … ").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim(), r = [...n];
  return r.length > t ? `${r.slice(0, t).join("")}…` : n;
}
function pf(e, t = [], n = "") {
  const r = new Set(t.map((o) => o.covers_to_seq));
  return e.filter((o) => !o.superseded_at).map((o) => {
    const a = r.has(o.seq) ? { compactedBefore: !0 } : {};
    if (o.role === "user") {
      const s = mf(e, o.edited_from);
      return {
        id: o.message_id,
        role: "user",
        text: o.text,
        context: ff(o.selection, n),
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
function gf(e, t, n, r) {
  var l, u, m;
  const o = ((m = (u = (l = e.context) == null ? void 0 : l.meta) == null ? void 0 : u.retainpdf) == null ? void 0 : m.selection) ?? null, a = (o == null ? void 0 : o.document_id) || t || null, s = e.sessionId && e.sessionId.length <= 256 ? e.sessionId : null, i = { agent_id: e.agentId || null, document_id: a, session_id: s }, c = e.answer.usage && JSON.stringify(e.answer.usage).length <= 4096 ? e.answer.usage : null;
  return [
    { ...i, role: "user", text: En(e.question.text, io), selection: o, client_message_id: `${n}-q`, ...r ? { edited_from: r } : {} },
    {
      ...i,
      role: "assistant",
      text: En(e.answer.text, io),
      thought: e.answer.thought ? En(e.answer.thought, uf) : null,
      usage: c,
      client_message_id: `${n}-a`,
      memory_ids: e.memoryIds.slice(0, 10)
    }
  ];
}
function bf(e) {
  return new Date(e - 2e3).toISOString().replace(/\.\d+Z$/, "Z");
}
function yf(e, t) {
  return e.filter((n) => n.origin === "agent" && n.status === "active" && !t.has(n.memory_id)).map((n) => ({ id: n.memory_id, scope: n.scope, text: n.text, category: n.category, documentId: n.document_id, created: !0 }));
}
function vf(e, t) {
  if (t.id && e.some((r) => r.message_id === t.id)) return t.id;
  const n = t.text.trim();
  for (let r = e.length - 1; r >= 0; r -= 1) {
    const o = e[r];
    if (o.role === "assistant" && o.text.trim() === n) return o.message_id;
  }
  return null;
}
function wf(e) {
  const t = e.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().split(new RegExp("(?<=[。！？.!?])"))[0] || "";
  return `深挖：${[...t].slice(0, 30).join("")}${[...t].length > 30 ? "…" : ""}`;
}
const Sf = 50, Pn = { conversation: null, main: null, records: [], compactions: [], hasMore: !1, key: "local", initial: [] };
function kf() {
  var t, n;
  return `c-${((n = (t = globalThis.crypto) == null ? void 0 : t.randomUUID) == null ? void 0 : n.call(t)) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}
function co(e) {
  var n, r, o, a;
  const t = e;
  return `${(t == null ? void 0 : t.reason) || ((n = t == null ? void 0 : t.details) == null ? void 0 : n.reason) || ((a = (o = (r = t == null ? void 0 : t.payload) == null ? void 0 : r.error) == null ? void 0 : o.details) == null ? void 0 : a.reason) || (e instanceof Error ? e.message : "")}`;
}
function If({ port: e, book: t, onAppended: n }) {
  const r = (e == null ? void 0 : e.conversations) ?? null, o = (e == null ? void 0 : e.memories) ?? null, [a, s] = _(!1), [i, c] = _(Pn), [l, u] = _(!1), [m, d] = _(""), [f, p] = _("idle"), [h, b] = _(null), [w, v] = _(() => /* @__PURE__ */ new Map()), y = N(/* @__PURE__ */ new Set()), S = N(/* @__PURE__ */ new Map()), k = (j) => {
    if (!j) return null;
    const W = S.current.get(j);
    return W || (E.current.records.some((K) => K.message_id === j) ? j : null);
  }, E = N(i);
  E.current = i;
  const x = N(t);
  x.current = t;
  const $ = N(0), O = L(async (j, W, K, fe = []) => {
    if (!r) return;
    const q = await r.messages(j.conversation_id, { limit: Sf, ...K ? { beforeSeq: K } : {} }), U = [...q.messages, ...fe];
    $.current += 1, c({
      conversation: j,
      main: W ?? j,
      records: U,
      compactions: q.compactions || [],
      hasMore: q.has_more,
      key: `${j.conversation_id}:${$.current}`,
      initial: pf(U, q.compactions || [], x.current.documentId)
    });
  }, [r]), A = L(async () => {
    var j;
    if (s(!0), !(!r || ((j = E.current.conversation) == null ? void 0 : j.kind) === "main")) {
      u(!0), d("");
      try {
        const W = await r.main(x.current.documentId || void 0);
        await O(W, W);
      } catch (W) {
        d(W instanceof Error ? W.message : String(W));
      } finally {
        u(!1);
      }
    }
  }, [r, O]), I = L((j) => {
    b(j), A();
  }, [A]), T = N(t.documentId);
  C(() => {
    T.current !== t.documentId && (T.current = t.documentId, E.current = Pn, c(Pn), b(null), v(/* @__PURE__ */ new Map()), S.current.clear(), a && A());
  }, [t.documentId, a, A]);
  const P = L(async () => {
    const j = E.current, W = j.records[0];
    if (!(!j.conversation || !W || !j.hasMore)) {
      u(!0);
      try {
        await O(j.conversation, j.main, W.seq, j.records);
      } finally {
        u(!1);
      }
    }
  }, [O]), R = L(async (j) => {
    const K = E.current.conversation;
    if (!r || !K) return;
    for (const ae of j.memoryIds) y.current.add(ae);
    let fe = j.memoryIds;
    if (!fe.length && o && j.startedAt) {
      const ae = yf(
        await o.list({ source_conversation_id: K.conversation_id, created_after: bf(j.startedAt) }).catch(() => []),
        y.current
      );
      for (const Re of ae) y.current.add(Re.id);
      fe = ae.map((Re) => Re.id);
      const ue = j.answerId;
      ae.length && ue && v((Re) => new Map(Re).set(ue, ae));
    }
    const q = gf({ ...j, memoryIds: fe }, x.current.documentId, kf(), k(j.editedFrom));
    let U;
    try {
      U = await r.append(K.conversation_id, q);
    } catch (ae) {
      if (K.kind !== "side" || !/ask_conversation_not_open/.test(co(ae))) throw ae;
      await r.reopen(K.conversation_id), U = await r.append(K.conversation_id, q);
    }
    const [ie, ge] = U.messages;
    j.questionId && ie && S.current.set(j.questionId, ie.message_id), j.answerId && ge && S.current.set(j.answerId, ge.message_id), c((ae) => {
      var ue;
      return ((ue = ae.conversation) == null ? void 0 : ue.conversation_id) === K.conversation_id ? { ...ae, conversation: U.conversation, records: [...ae.records, ...U.messages] } : ae;
    }), n == null || n(U.messages), U.compaction_due && K.kind === "main" && r.compact(K.conversation_id).catch(() => {
    });
  }, [r, o, n]), M = L(async (j) => {
    const W = E.current.conversation, K = k(j);
    if (!r || !W || !K) return null;
    try {
      await r.supersede(W.conversation_id, K);
    } catch (U) {
      if (!/ask_message_superseded/.test(co(U))) throw U;
    }
    const fe = E.current.records.find((U) => U.message_id === K), q = E.current.records.findIndex((U) => U.message_id === K);
    return c((U) => ({ ...U, records: U.records.map((ie, ge) => ge >= q && q >= 0 && !ie.superseded_at ? { ...ie, superseded_at: "now" } : ie) })), (fe == null ? void 0 : fe.selection) ?? null;
  }, [r]), F = L((j) => {
    R(j).catch((W) => d(`这一轮没存上：${W instanceof Error ? W.message : String(W)}`));
  }, [R]), z = L(async (j) => {
    var fe;
    const W = E.current, K = W.main;
    if (!(!r || !K || ((fe = W.conversation) == null ? void 0 : fe.kind) !== "main")) {
      d("");
      try {
        const q = vf(W.records, j), U = await r.fork({
          parent_id: K.conversation_id,
          ...q ? { forked_from_message_id: q } : {},
          title: wf(j.text),
          ...x.current.documentId ? { document_id: x.current.documentId } : {}
        });
        await O(U, K);
      } catch (q) {
        d(`开不了副对话：${q instanceof Error ? q.message : String(q)}`);
      }
    }
  }, [r, O]), G = L(async (j) => {
    const W = E.current.main;
    if (r)
      try {
        await O(await r.get(j), W);
      } catch (K) {
        d(`打不开副对话：${K instanceof Error ? K.message : String(K)}`);
      }
  }, [r, O]), J = L(async () => {
    const j = E.current.main;
    j && await O(j, j).catch(() => {
    });
  }, [O]), oe = L(async () => {
    const j = E.current.conversation;
    if (!(!r || (j == null ? void 0 : j.kind) !== "side")) {
      p("busy");
      try {
        await r.close(j.conversation_id), p("idle"), await J();
      } catch {
        p("failed");
      }
    }
  }, [r, J]), ne = L(async () => {
    const j = E.current.main;
    if (!r || !j) return;
    await r.archive(j.conversation_id);
    const W = await r.main(x.current.documentId || void 0);
    await O(W, W);
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
    onTurn: F,
    rewrite: M,
    fork: z,
    openSide: G,
    backToMain: J,
    closeSide: oe,
    archiveMain: ne,
    forgetMemory: r ? r.forgetMemory : void 0
  };
}
function lo(e, t, n) {
  var c;
  const r = e.selection, o = e.page ?? (r == null ? void 0 : r.page) ?? 0;
  if (e.role !== "user" || !o) return null;
  const a = (e.pane ?? (r == null ? void 0 : r.pane)) === "source" ? "source" : "translated", s = ((c = r == null ? void 0 : r.item_ids) == null ? void 0 : c[0]) ?? null, i = df({ item_ids: [], ...r, page: o, pane: a }, n(s, a, o));
  return { key: t, anchor: i, messageId: e.message_id, title: e.text.slice(0, 80) };
}
function Tf({ port: e, documentId: t, resetKey: n, pointOf: r }) {
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
      (h) => d(h.map((b) => lo(b, c(), i.current)).filter((b) => !!b)),
      () => {
      }
    ), () => {
      m = !0;
    };
  }, [e, t, n]);
  const l = L((m) => {
    const d = m.filter((f) => !f.document_id || f.document_id === t).map((f) => lo(f, c(), i.current)).filter((f) => !!f);
    d.length && a((f) => [...f.filter((p) => !d.some((h) => h.messageId === p.messageId)), ...d]);
  }, [t]), u = L((m) => a((d) => d.filter((f) => f.key !== m)), []);
  return { marks: o, addRecords: l, removeMark: u };
}
const Rf = zo(() => import("./ReaderAskPanel-B18vd7zO.js"));
function Ef({
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
  const m = V(() => ({ documentId: t, jobId: n, versionId: r }), [t, n, r]), d = L((R, M, F) => {
    const z = R ? o.find((oe) => oe.itemId === R) : null, G = z ? Rt(z, a, M) : null, J = G && G.box.page === F ? ut(G, 1, 1) : null;
    return J ? { x: J.left, y: J.top } : null;
  }, [o, a]), f = Tf({ port: e, documentId: t, resetKey: c, pointOf: d }), p = If({ port: e, book: m, onAppended: f.addRecords }), [h, b] = _(null), w = L(
    (R, M, F, z) => lf({
      pageElement: (R == null ? void 0 : R.closest(`[${Te}]`)) ?? null,
      clientX: M,
      clientY: F,
      itemId: i(),
      selection: z,
      regions: o,
      bookmarks: s,
      metadata: a
    }),
    [i, o, s, a]
  ), v = L(() => {
    var M;
    const R = so(((M = globalThis.getSelection) == null ? void 0 : M.call(globalThis)) ?? null);
    return !R.text || !R.element || !R.rect ? null : w(R.element, R.rect.left + R.rect.width / 2, R.rect.top + R.rect.height / 2, R.text);
  }, [w]), y = L((R) => {
    b(null), p.ask(R);
  }, [p.ask]);
  C(() => {
    if (!e) return;
    const R = (M) => {
      var G;
      if (M.key !== "?" || M.metaKey || M.ctrlKey || M.altKey || M.defaultPrevented) return;
      const F = M.target;
      if ((G = F == null ? void 0 : F.closest) != null && G.call(F, "input, textarea, select, [contenteditable='true']")) return;
      const z = v();
      z && (M.preventDefault(), M.stopImmediatePropagation(), y(z));
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
        const F = v();
        F && F.selection !== S.current && x(F);
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
    var z;
    if (!e) return [];
    const M = so(((z = globalThis.getSelection) == null ? void 0 : z.call(globalThis)) ?? null), F = w(R.target, R.clientX, R.clientY, M.element ? M.text : "");
    return F ? [{
      key: "ask",
      label: F.selection ? "问这段" : "在这里提问",
      hint: F.selection ? "?" : void 0,
      onSelect: () => y(F)
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
    Rf,
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
const Pf = [{ keys: "选字 + ?", desc: "问选中的这段" }];
function Mf() {
  const e = bn(), t = V(() => {
    try {
      return Ke().ask ?? null;
    } catch {
      return null;
    }
  }, []), n = Ef({
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
    pageLayer: r.length ? ({ page: l, height: u }) => /* @__PURE__ */ g(of, { marks: r, page: l, height: u, onOpen: o }) : void 0,
    shortcuts: Pf
  } : {}, [i, a, r, o]);
  return or(c), s;
}
const _f = { id: "ask", title: "提问", Component: Mf };
function jn() {
  try {
    return Ke().translationVersions ?? null;
  } catch {
    return null;
  }
}
function Nf(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function Af(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function xf(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function Lf({ documentId: e, jobId: t }) {
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
  const s = Af(n, t, o);
  return V(() => ({ versions: n, readingVersionId: s }), [n, s]);
}
function Df({ documentId: e, jobId: t, versions: n, readingVersionId: r }) {
  const [o, a] = _(null), [s, i] = _(""), [c, l] = _(""), u = N(0);
  C(() => {
    u.current += 1, a(null), i(""), l("");
  }, [e, t]);
  const m = L((p) => {
    const h = jn(), b = n.find((v) => v.versionId === p);
    if (!h || !b || !e) return;
    const w = ++u.current;
    i(p), l(""), (async () => {
      const v = Ke(), y = await h.resolveJob(e, p);
      if (!y) throw new Error("这一份还没有能读的译文。");
      const S = await v.loadReaderPayload(y, { includeOptionalArtifacts: !0 }), k = v.resolveReaderTranslatedPdfUrl(S.jobPayload, S.manifestPayload);
      if (!k) throw new Error("这一份没有译文 PDF。");
      return { versionId: p, name: b.name, jobId: y, url: k, regions: Nf(Bo(S.regionsPayload)) };
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
    h && ((w = globalThis.history) == null || w.replaceState(globalThis.history.state, "", xf(h, o.jobId))), a(null);
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
function Cf(e) {
  return e.available ? {
    key: "compare",
    label: "对比版本",
    title: "对比版本：左边换成这本书的另一份译文",
    Icon: Ds,
    pressed: !!(e.compared || e.loading),
    popup: (t) => /* @__PURE__ */ g(Cd, { compare: e, onDone: t })
  } : null;
}
function Of(e) {
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
function $f() {
  var i;
  const e = bn(), t = Df({
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
    const c = Cf(t);
    return { toolbarItems: c ? [c] : [], comparedDocument: Of(t) };
  }, [t]);
  return or(s), null;
}
const zf = { id: "compare", title: "对比版本", Component: $f }, Ff = Oo(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
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
}), Bf = Ff;
function jf(e) {
  const t = N(!1);
  return e && (t.current = !0), t.current;
}
const Hf = zo(() => import("./ReaderMarkdownPanel-CI7RfVoC.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), La = { id: "markdown", label: "Markdown", short: "MD", Icon: Bf, needsJob: !0 };
function Uf() {
  const e = bn(), t = e.activePanel === La.id;
  return jf(t) ? /* @__PURE__ */ g($o, { fallback: null, children: /* @__PURE__ */ g(Hf, { open: t, jobId: e.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: e.closePanel }) }) : null;
}
const Wf = {
  id: "markdown",
  title: "Markdown",
  Component: Uf,
  panels: [La]
}, Da = "reader-xref", Hn = "data-xref", Ot = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, Kf = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${Ot})`), Vf = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function Un(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function qf(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function Jf(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function Gf(e, t, n) {
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
function Xf(e, t, n) {
  return (e.find((o) => Ne(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function Zf(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = Ne(r), s = Jf(r);
    if (a === "formula") {
      for (const p of s.matchAll(Vf)) {
        const h = Un(p[1]);
        h && n({ key: `equation:${h}`, kind: "equation", label: h, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = Kf.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const l = qf(i[1]), u = Un(i[2]), m = Gf(e, o, l), d = [...m.map((p) => p.itemId), r.itemId], f = new Map(e.map((p, h) => [p.itemId, h]));
    d.sort((p, h) => (f.get(p) ?? 0) - (f.get(h) ?? 0)), n({ key: `${l}:${u}`, kind: l, label: u, itemId: Xf(m, r, l), itemIds: d, captionId: r.itemId });
  }), t;
}
const Yf = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${Ot})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${Ot})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${Ot})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${Ot})\s*[）)]`, "g"), kind: () => "equation" }
];
function Qf(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of Yf) {
    o.lastIndex = 0;
    for (const s of e.matchAll(o)) {
      const i = s.length > 2 ? s[1] : "", c = Un(s[s.length - 1]), l = `${a(i)}:${c}`;
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
function em(e, t) {
  return Qf(e, t).map((n) => ({ start: n.start, end: n.end, className: Da, attrs: { [Hn]: n.key } }));
}
const tm = { figure: "图", table: "表", equation: "式" };
function uo(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${tm[e.kind]} ${e.label}`;
}
const fo = 6e3;
function Ca(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function nm(e, t, n, r) {
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
function Oa({
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
        const f = d.getViewport({ scale: 1 }), p = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), h = nm(n, f, r, p), b = s.current, w = b == null ? void 0 : b.getContext("2d");
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
const mo = { figure: "图", table: "表", formula: "公式", text: "文字" }, Ge = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function rm(e, t, n) {
  const r = Rt(e, t, n), o = r ? ut(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = Ca({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function om(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, c = null;
  for (const u of e) {
    const m = Rt(u, t, n), d = m ? ut(m, 1, 1) : null;
    !m || !d || (r || (r = m.box.page, c = m.pageSize), m.box.page === r && (o = Math.min(o, d.left), a = Math.min(a, d.top), s = Math.max(s, d.left + d.width), i = Math.max(i, d.top + d.height)));
  }
  if (!r || !c) return null;
  const l = Ca({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: l, aspect: l.height * c.height / Math.max(1e-6, l.width * c.width) };
}
function am(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function sm(e, t) {
  const n = (o) => {
    const a = Ne(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function im({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var O;
  const i = t.find((A) => A.itemId === e) ?? null, c = V(() => i ? sm(t, i) : [], [t, i]), l = i ? c.indexOf(i) : -1, [u, m] = _(Ge.indexOf(1)), d = Ge[u], f = N(null), [p, h] = _(0);
  Ee(() => {
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
  const v = Ne(i), y = o.map((A) => ({ pane: A, pdf: r[A] ?? null, where: rm(i, n, A) })).filter((A) => !!(A.pdf && A.where)), S = 16, k = typeof window > "u" ? 800 : window.innerHeight, E = Math.min(880, k * 0.9) - 56 - 32 - (y.length > 1 ? 26 : 0), x = y.length ? am(Math.max(120, (p - S * (y.length - 1) - 32) / y.length), E, y.map((A) => A.where.aspect)) : 0, $ = ((O = y[0]) == null ? void 0 : O.where.page) ?? i.source.page;
  return /* @__PURE__ */ D("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${mo[v] ?? "这一块"}`, children: [
    /* @__PURE__ */ g("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ D("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ D("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ D("span", { className: "reader-zoom-title", children: [
          mo[v] ?? "这一块",
          " · 第 ",
          $,
          " 页"
        ] }),
        /* @__PURE__ */ g("span", { className: "reader-zoom-count", children: l >= 0 ? `${l + 1} / ${c.length}` : "" }),
        /* @__PURE__ */ D("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ g(ot, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: l <= 0, onClick: () => b(-1), children: /* @__PURE__ */ g(Cs, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ g(ot, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: l < 0 || l >= c.length - 1, onClick: () => b(1), children: /* @__PURE__ */ g(Vo, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ g(ot, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => m((A) => Math.max(0, A - 1)), children: /* @__PURE__ */ g(Os, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ D(Q, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => m(Ge.indexOf(1)), children: [
            Math.round(d * 100),
            "%"
          ] }),
          /* @__PURE__ */ g(ot, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === Ge.length - 1, onClick: () => m((A) => Math.min(Ge.length - 1, A + 1)), children: /* @__PURE__ */ g($s, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ g(ot, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: s, children: /* @__PURE__ */ g(dt, { size: 16, "aria-hidden": !0 }) })
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
              Oa,
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
const cm = 380, lm = 320, yt = 8;
function um(e, t, n) {
  const r = Math.max(yt, Math.min(e.left, n.width - t.width - yt)), o = e.bottom + yt, a = o + t.height <= n.height - yt ? o : Math.max(yt, e.top - yt - t.height);
  return { left: r, top: a };
}
function dm({
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
    const f = r[d], p = f ? om(o, n, d) : null;
    if (f && p) {
      s = { pdf: f, where: p };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min(cm, lm / Math.max(0.05, s.where.aspect))), c = Math.round(i * s.where.aspect) + 30, l = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: m } = um(e.anchor, { width: Math.max(i, 160) + 16, height: c + 16 }, l);
  return /* @__PURE__ */ D("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: m }, children: [
    /* @__PURE__ */ D("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ g("span", { children: uo(e.target) }),
      /* @__PURE__ */ D("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ g(Oa, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: uo(e.target) })
  ] });
}
const fm = 250;
function mm(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function hm(e, t, n) {
  const r = n === "back" ? e.back : e.forward;
  if (!r.length) return null;
  const o = r[r.length - 1], a = r.slice(0, -1), s = n === "back" ? { back: a, forward: [...e.forward, t] } : { back: [...e.back, t], forward: a };
  return { to: o, history: s };
}
function pm(e) {
  var n;
  const t = e;
  return !!((n = t == null ? void 0 : t.closest) != null && n.call(t, "input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
function gm({
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
      return (k = (S = y.target) == null ? void 0 : S.closest) == null ? void 0 : k.call(S, `.${Da}`);
    }, p = () => {
      l.current != null && window.clearTimeout(l.current), l.current = null;
    }, h = (y) => {
      var x;
      const S = f(y);
      if (!S) return;
      const k = u.current.index.get(S.getAttribute(Hn) || "");
      if (!k) return;
      const E = ((x = S.closest("[data-reader-pane]")) == null ? void 0 : x.getAttribute("data-reader-pane")) || u.current.primaryPane;
      p(), l.current = window.setTimeout(() => {
        const $ = S.getBoundingClientRect();
        a({ target: k, pane: E, anchor: { left: $.left, top: $.top, right: $.right, bottom: $.bottom } });
      }, fm);
    }, b = (y) => {
      const S = f(y);
      !S || S.contains(y.relatedTarget) || (p(), a(null));
    }, w = (y) => {
      var $, O;
      const S = f(y);
      if (!S || y.button !== 0 || y.metaKey || y.ctrlKey || y.shiftKey || `${(($ = window.getSelection) == null ? void 0 : $.call(window)) || ""}`.trim()) return;
      const k = u.current.index.get(S.getAttribute(Hn) || "");
      if (!k) return;
      y.preventDefault(), y.stopPropagation(), p(), a(null);
      const E = ((O = S.closest("[data-reader-pane]")) == null ? void 0 : O.getAttribute("data-reader-pane")) || u.current.primaryPane, x = m();
      x && i((A) => mm(A, x)), u.current.follow(k, E);
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
    const h = hm(c.current, p, f);
    if (!h) return !1;
    const { shellEl: b, primaryPane: w } = u.current;
    return Et(b, h.to, "auto", w) ? (i(h.history), !0) : !1;
  }, [m]);
  return C(() => {
    const f = (p) => {
      if (!p.altKey || p.metaKey || p.ctrlKey || p.shiftKey || p.defaultPrevented || p.key !== "ArrowLeft" && p.key !== "ArrowRight" || pm(p.target)) return;
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
const bm = [
  { keys: "Alt+←", desc: "点了引用跳过去以后，回到原处" },
  { keys: "Alt+→", desc: "再跳回去" }
];
function ym() {
  const e = bn(), t = V(() => Zf(e.regions), [e.regions]), { jumpToBlock: n } = e, r = L((s, i) => n(s.itemId, i), [n]), o = gm({ shellEl: e.shellEl, index: t, primaryPane: e.primaryPane, follow: r }), a = V(() => ({
    // 书里一个认得出去处的引用都没有，就不改文字层（react-pdf 照原样画，不多一遍 innerHTML）。
    textMarks: t.size ? (s) => em(s, t) : void 0,
    shortcuts: bm
  }), [t]);
  return or(a), /* @__PURE__ */ D(Le, { children: [
    o.preview ? /* @__PURE__ */ g(dm, { preview: o.preview, regions: e.regions, metadata: e.metadata, documents: e.pdfDocuments }) : null,
    o.canGoBack ? /* @__PURE__ */ D(Q, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => o.goBack(), children: [
      /* @__PURE__ */ g(zs, { size: 14, "aria-hidden": !0 }),
      " 回到第 ",
      o.backPage,
      " 页"
    ] }) : null
  ] });
}
const vm = { id: "xrefs", title: "引用（「图 2.1」「式 (3.21)」）", Component: ym }, ar = [Wf, zf, vm, _f];
function sr(e = ar) {
  return e.flatMap((t) => (t.panels ?? []).map(({ id: n, label: r, short: o, Icon: a, needsJob: s }) => ({ id: n, label: r, short: o, Icon: a, needsJob: s })));
}
function wm(e) {
  const t = Ve(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ g(Le, { children: (e.tabs ?? sr()).map(({ id: s, label: i, Icon: c, needsJob: l }) => {
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
function Sm(e) {
  const t = Ve(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = sr().map(({ id: c, label: l, short: u, Icon: m, needsJob: d }) => ({
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
        children: /* @__PURE__ */ g(dt, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function km(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Im(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Tm(e) {
  return e / 100 * window.innerHeight;
}
function Rm(e) {
  return e / 100 * window.innerWidth;
}
function Em(e) {
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
  const [o, a] = Em(n);
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
      r = Im(t, o);
      break;
    }
    case "em": {
      r = km(t, o);
      break;
    }
    case "vh": {
      r = Tm(o);
      break;
    }
    case "vw": {
      r = Rm(o);
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
function Wn(e) {
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
function ce(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function Kn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? Pm : Mm
  );
}
function Pm(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function Mm(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function $a(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function za(e, t) {
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
function _m({
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
    const { x: i, y: c } = za(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return ce(o, "No rect found"), o;
}
let tn;
function Nm() {
  return tn === void 0 && (typeof matchMedia == "function" ? tn = !!matchMedia("(pointer:coarse)").matches : tn = !1), tn;
}
function Fa(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Kn(
    n,
    Array.from(t.children).filter($a).map((p) => ({ element: p }))
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
                  const E = f[0], x = _m({
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
              const E = Nm() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
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
class Ba {
  constructor() {
    Tr(this, Ze, {});
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
    Rr(this, Ze, {});
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
const ir = new Ba();
function it() {
  return It;
}
function Am(e) {
  return ir.addListener("change", e);
}
function xm(e) {
  const t = It, n = { ...It };
  n.cursorFlags = e, It = n, ir.emit("change", {
    prev: t,
    next: n
  });
}
function Tt(e) {
  const t = It;
  It = e, ir.emit("change", {
    prev: t,
    next: e
  });
}
const Lm = (e) => e, Mn = () => {
}, ja = 1, Ha = 2, Ua = 4, Wa = 8, ho = 3, po = 12;
let nn;
function go() {
  return nn === void 0 && (nn = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (nn = !0)), nn;
}
function Dm({
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
        if (e && go()) {
          const a = (e & ja) !== 0, s = (e & Ha) !== 0, i = (e & Ua) !== 0, c = (e & Wa) !== 0;
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
    return go() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const bo = /* @__PURE__ */ new WeakMap();
function cr(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = bo.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = it();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = Dm({
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
  bo.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Ce = /* @__PURE__ */ new Map();
const Ka = new Ba();
function Cm(e) {
  Ce = new Map(Ce), Ce.delete(e);
}
function yo(e, t) {
  for (const [n] of Ce)
    if (n.id === e)
      return n;
}
function et(e, t) {
  for (const [n, r] of Ce)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function ft() {
  return Ce;
}
function lr(e, t) {
  return Ka.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function We(e, t, n) {
  const r = Ce.get(e);
  Ce = new Map(Ce), Ce.set(e, t), Ka.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function Va(e) {
  const t = it();
  let n = !1;
  switch (t.state) {
    case "active":
      Tt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (cr(e), n = !0, t.hitRegions.forEach((r) => {
        const o = et(r.group.id, !0);
        We(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function vo(e) {
  e.defaultPrevented || Va(e.currentTarget);
}
function Om(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = za(n, a.rect);
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
function $m(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function zm(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: ko(e),
    b: ko(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  ce(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: So(wo(n.a)),
    b: So(wo(n.b))
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
const Fm = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function Bm(e) {
  const t = getComputedStyle(qa(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function jm(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || Bm(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || Fm.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function wo(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (ce(n, "Missing node"), jm(n)) return n;
  }
  return null;
}
function So(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function ko(e) {
  const t = [];
  for (; e; )
    t.push(e), e = qa(e);
  return t;
}
function qa(e) {
  const { parentNode: t } = e;
  return $m(t) ? t.host : t;
}
function Hm(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Um({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!$a(n) || n.contains(e) || e.contains(n))
    return !0;
  if (zm(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Hm(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function ur(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = Fa(o), s = Om(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Um({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function Wm(e, t) {
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
function De(e, t) {
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
  if (De(r, c) < 0)
    if (a) {
      const l = (o + c) / 2;
      De(r, l) < 0 ? r = o : r = c;
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
  ce(u != null, "Invalid first pivot index"), ce(m != null, "Invalid second pivot index");
  let d = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? m : u, b = n[h];
        ce(
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
          if (ce(
            S != null,
            `Previous layout not found for panel index ${h}`
          ), Se(S, w)) {
            const k = y - S;
            De(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      {
        const h = e < 0 ? u : m, b = n[h];
        ce(
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
          if (ce(
            S != null,
            `Previous layout not found for panel index ${h}`
          ), Se(S, y)) {
            const k = S - w;
            De(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? m : u, b = n[h];
      ce(
        b,
        `Panel constraints not found for index ${h}`
      );
      const w = i[h], { collapsible: v, collapsedSize: y, minSize: S } = b;
      if (v && De(w, S) < 0)
        if (e > 0) {
          const k = S - y, E = k / 2, x = w + e;
          De(x, S) < 0 && (e = De(e, E) <= 0 ? 0 : k);
        } else {
          const k = S - y, E = 100 - k / 2, x = w - e;
          De(x, S) < 0 && (e = De(100 + e, E) > 0 ? 0 : -k);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let b = e < 0 ? m : u, w = 0;
    for (; ; ) {
      const y = i[b];
      ce(
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
      ce(
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
  if (Wm(c, l))
    return o;
  {
    const h = e < 0 ? m : u, b = i[h];
    ce(
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
        ce(
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
function ct(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || De(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function lt({
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
      ce(c != null, `No layout data found for index ${i}`);
      const l = 100 / o * c;
      r[i] = l;
    }
  let a = 0;
  for (let i = 0; i < t.length; i++) {
    const c = n[i];
    ce(c != null, `No layout data found for index ${i}`);
    const l = r[i];
    ce(l != null, `No layout data found for index ${i}`);
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
      ce(c != null, `No layout data found for index ${i}`);
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
function Ja({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const c = ft();
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
    }), w = lt({
      layout: b,
      panelConstraints: m
    });
    ct(p, w) || We(d, {
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
function Io(e) {
  if (e.defaultPrevented)
    return;
  const t = ft();
  ur(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = Ja({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function rn(e) {
  const t = ft();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function Ga({
  groupId: e
}) {
  const t = () => {
    const n = ft();
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
      } = t(), l = lt({
        layout: n,
        panelConstraints: o
      });
      return r ? i : (ct(i, l) || We(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: l,
        separatorToPanels: c
      }), l);
    }
  };
}
function rt(e, t) {
  const n = rn(e), r = et(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  ce(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  ce(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), i = Ga({ groupId: n.id }).getLayout(), c = Ut({
    delta: t,
    initialLayout: i,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: i,
    trigger: "keyboard"
  }), l = lt({
    layout: c,
    panelConstraints: r.derivedPanelConstraints
  });
  ct(i, l) || We(
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
function To(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = rn(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && rt(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && rt(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && rt(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && rt(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), rt(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = rn(t), o = et(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, c = r.separators.find(
          (d) => d.element === t
        );
        ce(c, "Matching separator not found");
        const l = i.get(c);
        ce(l, "Matching panels not found");
        const u = l[0], m = a.find(
          (d) => d.panelId === u.id
        );
        if (ce(m, "Panel metadata not found"), m.collapsible) {
          const d = s[u.id], f = m.collapsedSize === d ? r.mutableState.expandedPanelSizes[u.id] ?? m.minSize : m.collapsedSize;
          rt(t, f - d);
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
        ce(o !== null, "Index not found");
        const a = e.shiftKey ? o > 0 ? o - 1 : r.length - 1 : o + 1 < r.length ? o + 1 : 0;
        r[a].focus({
          preventScroll: !0
        });
        break;
      }
      case "Home": {
        e.preventDefault(), rt(t, -100);
        break;
      }
    }
}
function Ro(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = ft(), n = ur(e, t), r = /* @__PURE__ */ new Map();
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
function Xa({
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
      if (ct(x, k)) {
        if (h !== 0 && !p)
          switch (d) {
            case "horizontal": {
              i |= h < 0 ? ja : Ha;
              break;
            }
            case "vertical": {
              i |= h < 0 ? Ua : Wa;
              break;
            }
          }
      } else
        We(l.group, {
          defaultLayoutDeferred: v,
          derivedPanelConstraints: y,
          groupSize: S,
          layout: x,
          separatorToPanels: E
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & ho : c |= i & ho, t.movementY === 0 ? c |= s & po : c |= i & po, xm(c), cr(e);
}
function Eo(e) {
  const t = ft(), n = it();
  switch (n.state) {
    case "active":
      Xa({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function Po(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = it(), n = ft();
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
          We(a.group, s, {
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
      Xa({
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
      const a = ur(e, n);
      a.length === 0 ? t.state !== "inactive" && Tt({
        cursorFlags: 0,
        state: "inactive"
      }) : Tt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), cr(e.currentTarget);
      break;
    }
  }
}
function Mo(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (it().state) {
      case "hover":
        Tt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function _o(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || Va(e.currentTarget) && e.preventDefault();
}
function No(e) {
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
function Km(e, t, n) {
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
function Vm(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function qm({
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
function Jm(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const vt = /* @__PURE__ */ new Map();
function Gm(e) {
  let t = !0;
  ce(
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
          const S = Wn(e), k = y.defaultLayoutDeferred ? No(S) : y.layout, E = qm({
            group: e,
            nextGroupSize: v,
            prevGroupSize: y.groupSize,
            prevLayout: k
          }), x = lt({
            layout: E,
            panelConstraints: S
          });
          if (!y.defaultLayoutDeferred && ct(y.layout, x) && Vm(
            y.derivedPanelConstraints,
            S
          ) && y.groupSize === v)
            return;
          We(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: S,
            groupSize: v,
            layout: x,
            separatorToPanels: y.separatorToPanels
          });
        }
      } else
        Km(e, w, b);
    }
  });
  a.observe(e.element), e.panels.forEach((p) => {
    ce(
      !r.has(p.id),
      `Panel ids must be unique; id "${p.id}" was used more than once`
    ), r.add(p.id), p.onResize && a.observe(p.element);
  });
  const s = Pt({ group: e }), i = Wn(e), c = e.panels.map(({ id: p }) => p).join(",");
  let l = e.mutableState.defaultLayout;
  l && (Jm(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[c] ?? l ?? No(i), m = lt({
    layout: u,
    panelConstraints: i
  }), d = e.element.ownerDocument;
  vt.set(
    d,
    (vt.get(d) ?? 0) + 1
  );
  const f = /* @__PURE__ */ new Map();
  return Fa(e).forEach((p) => {
    p.separator && f.set(p.separator, p.panels);
  }), We(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: m,
    separatorToPanels: f
  }), e.separators.forEach((p) => {
    ce(
      !o.has(p.id),
      `Separator ids must be unique; id "${p.id}" was used more than once`
    ), o.add(p.id), p.element.addEventListener("keydown", To);
  }), vt.get(d) === 1 && (d.addEventListener("contextmenu", vo, !0), d.addEventListener("dblclick", Io, !0), d.addEventListener("pointerdown", Ro, !0), d.addEventListener("pointerleave", Eo), d.addEventListener("pointermove", Po), d.addEventListener("pointerout", Mo), d.addEventListener("pointerup", _o, !0)), function() {
    t = !1, vt.set(
      d,
      Math.max(0, (vt.get(d) ?? 0) - 1)
    ), Cm(e), e.separators.forEach((p) => {
      p.element.removeEventListener("keydown", To);
    }), vt.get(d) || (d.removeEventListener(
      "contextmenu",
      vo,
      !0
    ), d.removeEventListener(
      "dblclick",
      Io,
      !0
    ), d.removeEventListener(
      "pointerdown",
      Ro,
      !0
    ), d.removeEventListener("pointerleave", Eo), d.removeEventListener("pointermove", Po), d.removeEventListener("pointerout", Mo), d.removeEventListener("pointerup", _o, !0)), a.disconnect();
  };
}
function Xm() {
  const [e, t] = _({}), n = L(() => t({}), []);
  return [e, n];
}
function dr(e) {
  const t = Fo();
  return `${e ?? t}`;
}
const mt = typeof window < "u" ? Ee : C;
function Ft(e) {
  const t = N(e);
  return mt(() => {
    t.current = e;
  }, [e]), L(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function fr(...e) {
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
function mr(e) {
  const t = N({ ...e });
  return mt(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const Za = qt(null);
function Zm(e, t) {
  const n = N({
    getLayout: () => ({}),
    setLayout: Lm
  });
  Gn(t, () => n.current, []), mt(() => {
    Object.assign(
      n.current,
      Ga({ groupId: e })
    );
  });
}
function Ya({
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
    ct(p.current.onLayoutChange, I) || (p.current.onLayoutChange = I, c == null || c(I));
  }), b = Ft(
    (I, T) => {
      ct(p.current.onLayoutChanged, I) || (p.current.onLayoutChanged = I, l == null || l(I, { isUserInteraction: T }));
    }
  ), w = dr(i), v = N(null), [y, S] = Xm(), k = N({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: m,
    separators: []
  }), E = fr(v, a);
  Zm(w, s);
  const x = Ft(
    (I, T) => {
      const P = it(), R = yo(I), M = et(I);
      if (M) {
        let F = !1;
        switch (P.state) {
          case "active": {
            F = P.hitRegions.some(
              (z) => z.group === R
            );
            break;
          }
        }
        return {
          flexGrow: M.layout[T] ?? 1,
          pointerEvents: F ? "none" : void 0
        };
      }
      if (n != null && n[T])
        return {
          flexGrow: n == null ? void 0 : n[T]
        };
    }
  ), $ = mr({
    defaultLayout: n,
    disableCursor: r
  }), O = V(
    () => ({
      get disableCursor() {
        return !!$.disableCursor;
      },
      getPanelStyles: x,
      id: w,
      orientation: u,
      registerPanel: (I) => {
        const T = k.current;
        return T.panels = Kn(u, [
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
        return T.separators = Kn(u, [
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
          (F) => F.id === I
        );
        P && (P.panelConstraints.disabled = T);
        const R = yo(w), M = et(w);
        R && M && We(R, {
          ...M,
          derivedPanelConstraints: Wn(R)
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
  return mt(() => {
    const I = v.current;
    if (I === null)
      return;
    const T = k.current;
    let P;
    if ($.defaultLayout !== void 0 && Object.keys($.defaultLayout).length === T.panels.length) {
      P = {};
      for (const oe of T.panels) {
        const ne = $.defaultLayout[oe.id];
        ne !== void 0 && (P[oe.id] = ne);
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
    const M = Gm(R), { defaultLayoutDeferred: F, derivedPanelConstraints: z, layout: G } = et(R.id, !0);
    !F && z.length > 0 && (h(G), b(G, !1));
    const J = lr(w, (oe) => {
      const { defaultLayoutDeferred: ne, derivedPanelConstraints: j, layout: W } = oe.next;
      if (ne || j.length === 0)
        return;
      const K = R.panels.map(({ id: q }) => q).join(",");
      R.mutableState.layouts[K] = W, j.forEach((q) => {
        if (q.collapsible) {
          const { layout: U } = oe.prev ?? {};
          if (U) {
            const ie = Se(
              q.collapsedSize,
              W[q.panelId]
            ), ge = Se(
              q.collapsedSize,
              U[q.panelId]
            );
            ie && !ge && (R.mutableState.expandedPanelSizes[q.panelId] = U[q.panelId]);
          }
        }
      });
      const fe = it().state !== "active";
      h(W), fe && b(W, oe.isUserInteraction);
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
  }), /* @__PURE__ */ g(Za.Provider, { value: O, children: /* @__PURE__ */ g(
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
Ya.displayName = "Group";
function hr() {
  const e = at(Za);
  return ce(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Ym(e, t) {
  const { id: n } = hr(), r = N({
    collapse: Mn,
    expand: Mn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Mn
  });
  Gn(t, () => r.current, []), mt(() => {
    Object.assign(
      r.current,
      Ja({ groupId: n, panelId: e })
    );
  });
}
function Vn({
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
  const h = !!c, b = dr(c), w = mr({
    disabled: a
  }), v = N(null), y = fr(v, s), {
    getPanelStyles: S,
    id: k,
    orientation: E,
    registerPanel: x,
    updatePanelProps: $
  } = hr(), O = m !== null, A = Ft(
    (R, M, F) => {
      m == null || m(R, c, F);
    }
  );
  mt(() => {
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
  }, [a, b, $]), Ym(b, d);
  const I = () => {
    const R = S(k, b);
    if (R)
      return JSON.stringify(R);
  }, T = mn(
    (R) => lr(k, R),
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
        ...Qm,
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
Vn.displayName = "Panel";
const Qm = {
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
function eh({
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
    a = lt({
      layout: Ut({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = lt({
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
function Qa({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const c = dr(a), l = mr({
    disabled: n,
    disableDoubleClick: r
  }), [u, m] = _({}), [d, f] = _("inactive"), [p, h] = _(!1), b = N(null), w = fr(b, o), {
    disableCursor: v,
    id: y,
    orientation: S,
    registerSeparator: k,
    updateSeparatorProps: E
  } = hr(), x = S === "horizontal" ? "vertical" : "horizontal";
  mt(() => {
    const A = b.current;
    if (A !== null) {
      const I = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: A,
        id: c
      }, T = k(I), P = Am(
        (M) => {
          f(
            M.next.state !== "inactive" && M.next.hitRegions.some(
              (F) => F.separator === I
            ) ? M.next.state : "inactive"
          );
        }
      ), R = lr(
        y,
        (M) => {
          const { derivedPanelConstraints: F, layout: z, separatorToPanels: G } = M.next, J = G.get(I);
          if (J) {
            const oe = J[0], ne = J.indexOf(oe);
            m(
              eh({
                layout: z,
                panelConstraints: F,
                panelId: oe.id,
                panelIndex: ne
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
Qa.displayName = "Separator";
const pr = 30, gr = 65, Wt = 50, th = 100 - gr, nh = 100 - pr;
function rh(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(gr, Math.max(pr, t)) : Wt;
}
function br(e) {
  return 100 - e;
}
function wt(e) {
  return `${e}%`;
}
const yr = "reader-document", Kt = "reader-assistant", es = "retainpdf.reader.ai-split-layout.v1", oh = {
  [yr]: br(Wt),
  [Kt]: Wt
};
function vr(e) {
  const t = rh(e == null ? void 0 : e[Kt]);
  return {
    [yr]: br(t),
    [Kt]: t
  };
}
function ah() {
  try {
    const e = JSON.parse(localStorage.getItem(es) || "null");
    return vr(e);
  } catch {
    return oh;
  }
}
function sh(e) {
  try {
    localStorage.setItem(es, JSON.stringify(vr(e)));
  } catch {
  }
}
function _n(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = vr(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[Kt]}vw`
  );
}
function ih() {
  const e = N(null), [t] = _(ah);
  Ee(() => {
    const o = e.current;
    return _n(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = L((o) => {
    _n(e.current, o);
  }, []), r = L((o, a) => {
    _n(e.current, o), a.isUserInteraction && sh(o);
  }, []);
  return /* @__PURE__ */ D(
    Ya,
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
          Vn,
          {
            id: yr,
            defaultSize: wt(br(Wt)),
            minSize: wt(th),
            maxSize: wt(nh)
          }
        ),
        /* @__PURE__ */ g(
          Qa,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ g("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ g(
          Vn,
          {
            id: Kt,
            defaultSize: wt(Wt),
            minSize: wt(pr),
            maxSize: wt(gr)
          }
        )
      ]
    }
  );
}
function ch({
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
function lh({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ g(ch, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ D(Le, { children: [
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
function uh(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function dh() {
  const [e, t] = _(!1), n = Fo(), r = N(null), o = xa(), a = V(() => [...wl, ...Zd(o)], [o]);
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
      if (i.defaultPrevented || i.metaKey || i.ctrlKey || i.altKey || uh(i.target)) return;
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
        children: /* @__PURE__ */ g(Fs, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
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
const fh = ["source", "sideBySide", "translated"], mh = { source: "", translated: "", sideBySide: "" };
function hh(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = on(e.sourceUrl), n = on(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return di({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function ph(e) {
  const [t, n] = _(() => /* @__PURE__ */ new Set()), r = V(
    () => e ? hh(e) : mh,
    [e]
  ), o = V(
    () => fh.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = L(async (s) => {
    if (!e) return;
    const i = on(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? ui(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await fi(
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
        mi(l), n((u) => {
          const m = new Set(u);
          return m.delete(s), m;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const gh = {
  source: Uo,
  sideBySide: Wo,
  translated: Ko
}, bh = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function yh(e) {
  const t = Ve(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = ph(n), i = N(null);
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
      /* @__PURE__ */ g(Bs, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ g("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ g(Ho, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ g("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = ds[c], u = on(r[c]), m = a.has(c), d = !!u && !m, f = d ? "" : fs(c, r), p = gh[c];
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
                bh[c],
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
const vh = "retainpdf:reader:bookmarks:v1:", wh = 200;
function wr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function ts(e) {
  const t = `${e || ""}`.trim();
  return t ? `${vh}${t}` : "";
}
function Sh(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function fn(e, t = wr()) {
  const n = ts(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = Sh(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function qn(e, t, n) {
  const r = ts(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, wh);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function kh(e, t, n = "", { storage: r = wr(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = fn(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? qn(e, a.filter((i) => i.page !== s), r) : qn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Ih(e, t, n = wr()) {
  return qn(e, fn(e, n).filter((r) => r.page !== t), n);
}
function Th(e, t) {
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
function Rh({ filled: e }) {
  return /* @__PURE__ */ g("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ g("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function Eh({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
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
        onClick: () => s(kh(e, u, Th(r, u))),
        children: /* @__PURE__ */ g(Rh, { filled: m })
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
          /* @__PURE__ */ g(js, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
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
          onClick: () => s(Ih(e, d.page)),
          children: "×"
        }
      )
    ] }, d.page)) }) }) : null
  ] });
}
function Ph(e) {
  const [t, n] = _([]);
  return C(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = Ke().loadIssues;
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
function Mh(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const _h = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, Nh = ["failed", "content", "layout"];
function Ah(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function xh({ jobId: e, currentPage: t }) {
  var m;
  const n = Ph(e), r = (m = Ve()) == null ? void 0 : m.jumpToBlock, [o, a] = _(!1), [s, i] = _(-1), c = N(null);
  C(() => i(-1), [n]);
  const l = (d) => {
    const f = n[d];
    !f || !r || (i(d), r(f.readerItemId));
  }, u = N({ issues: n, last: s, currentPage: t, goTo: l });
  return u.current = { issues: n, last: s, currentPage: t, goTo: l }, C(() => {
    const d = (f) => {
      if (f.key.toLowerCase() !== "n" || f.metaKey || f.ctrlKey || f.altKey || Ah(f.target)) return;
      const { issues: p, last: h, currentPage: b, goTo: w } = u.current, v = Mh(p, h, b, f.shiftKey);
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
          /* @__PURE__ */ g(Hs, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ g("span", { children: n.length })
        ]
      }
    ),
    o ? /* @__PURE__ */ D("div", { className: "reader-issues-popover", role: "dialog", "aria-label": "待处理", children: [
      /* @__PURE__ */ g("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
      Nh.map((d) => {
        const f = n.map((p, h) => ({ issue: p, index: h })).filter(({ issue: p }) => p.kind === d);
        return f.length ? /* @__PURE__ */ D("section", { className: "reader-issues-group", "data-issue-kind": d, children: [
          /* @__PURE__ */ D("h4", { children: [
            _h[d],
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
const Lh = 48, Dh = 96, Ch = 700;
function Oh(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= Lh, downSoFar: r };
}
function $h(e) {
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
      if (o.set(f, p), h === void 0 || Date.now() - a > Ch) return;
      const b = Oh(!1, r.current, p - h);
      r.current = b.downSoFar, p - h < -4 ? n(!1) : b.hidden && !c() && n(!0);
    }, u = (d) => {
      d.clientY >= window.innerHeight - Dh && (r.current = 0, n(!1));
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
function zh(e) {
  const t = Ve(), n = Pa(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Jt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = ec(a), m = a > ea + 1e-3, d = a < un - 1e-3, f = St(r, Qe()), p = f >= un ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", h = N(null), b = $h(h), [w, v] = _(!1), [y, S] = _(`${i}`);
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
      Eh,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: c,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
      }
    ) : null,
    e.issuesJobId ? /* @__PURE__ */ g(xh, { jobId: e.issuesJobId, currentPage: i }) : null,
    t != null && t.toggleDocDark ? /* @__PURE__ */ g("div", { className: "reader-react-hud-group", "aria-label": "显示", children: /* @__PURE__ */ g(
      Q,
      {
        className: "reader-react-hud-btn reader-react-hud-doc-dark",
        "aria-pressed": t.docDark ? "true" : "false",
        "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
        title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
        onClick: t.toggleDocDark,
        children: /* @__PURE__ */ g(Fh, {})
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
    /* @__PURE__ */ g("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ g(dh, {}) })
  ] });
}
function Fh() {
  return /* @__PURE__ */ D("svg", { width: "14", height: "14", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: [
    /* @__PURE__ */ g("circle", { cx: "8", cy: "8", r: "6.25", fill: "none", stroke: "currentColor", strokeWidth: "1.5" }),
    /* @__PURE__ */ g("path", { d: "M8 1.75a6.25 6.25 0 0 1 0 12.5z", fill: "currentColor" })
  ] });
}
function Ao(e) {
  var t, n;
  return aa(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function Bh(e) {
  const [t, n] = _(() => ({
    scope: e,
    panel: Ao(Oe(e))
  }));
  C(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Ao(Oe(e))
    });
  }, [e]), C(() => {
    t.scope === e && pn(t.scope, {
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
const Jn = "download-toast";
function jh({
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
function Hh(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    An.dismiss(Jn);
    return;
  }
  An.custom(
    () => /* @__PURE__ */ g(jh, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: Jn, duration: 1 / 0 }
  );
}
function Uh() {
  const e = L((t) => {
    t && (t.setState = Hh, t.hide = () => An.dismiss(Jn));
  }, []);
  return /* @__PURE__ */ D(Le, { children: [
    /* @__PURE__ */ g(Is, { position: "bottom-right" }),
    /* @__PURE__ */ g("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
const xo = { itemId: null, origin: null };
function Wh() {
  let e = xo;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? xo : { itemId: n, origin: r };
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
function Kh({
  nodes: e,
  currentPage: t,
  onJumpPage: n
}) {
  const r = V(() => ga(e, t), [e, t]), [o, a] = _(() => /* @__PURE__ */ new Set([...Br(r), ...r ? [r] : []]));
  C(() => {
    a(/* @__PURE__ */ new Set([...Br(r), ...r ? [r] : []]));
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
            children: /* @__PURE__ */ g(Vo, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 })
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
const Vh = [], qh = [];
function Jh({
  open: e,
  onToggle: t,
  children: n
}) {
  return /* @__PURE__ */ D("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ g(Q, { className: "reader-finder-toggle", "aria-label": "目录", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: /* @__PURE__ */ g(Ws, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }) }),
    n
  ] });
}
function Gh({ open: e, onToggle: t }) {
  return /* @__PURE__ */ g(
    Q,
    {
      className: "reader-react-hud-btn reader-search-toggle",
      "data-finder-toggle": "search",
      "aria-label": "在书里搜索",
      "aria-pressed": e === "search",
      title: "在书里搜索（原文和译文，⌘F）",
      onClick: () => t("search"),
      children: /* @__PURE__ */ g(Us, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 })
    }
  );
}
function Xh({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0,
  bookmarks: c = qh,
  onJumpPage: l
}) {
  var A, I;
  const u = ((A = Ve()) == null ? void 0 : A.regions) ?? Vh, m = ((I = Pa()) == null ? void 0 : I.currentPage) ?? 1, d = V(() => Kl(u), [u]), f = c.length > 0 && !!l, [p, h] = _("bookmarks"), b = f && (p === "bookmarks" || !d.length), w = Vl(d, m), v = V(() => Gl(u, s), [u, s]), [y, S] = _(-1);
  C(() => S(-1), [s]);
  const k = N(null), E = N(null), x = N(n);
  x.current = n, C(() => {
    const T = (R) => {
      var F, z;
      const M = R.target;
      !M || (F = E.current) != null && F.contains(M) || (z = M.closest) != null && z.call(M, ".reader-finder-toggles, [data-finder-toggle]") || x.current();
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
        /* @__PURE__ */ g(Q, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ g(Q, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ g(Q, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ g(dt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" && f && d.length ? /* @__PURE__ */ D("div", { className: "reader-finder-switch", role: "radiogroup", "aria-label": "目录按什么列", children: [
      /* @__PURE__ */ g(Q, { className: "reader-finder-switch-option", role: "radio", "aria-checked": b, onClick: () => h("bookmarks"), children: "按书签" }),
      /* @__PURE__ */ g(Q, { className: "reader-finder-switch-option", role: "radio", "aria-checked": !b, onClick: () => h("headings"), children: "按标题" })
    ] }) : null,
    e === "outline" && b && l ? /* @__PURE__ */ g(Kh, { nodes: c, currentPage: m, onJumpPage: l }) : e === "outline" ? d.length ? /* @__PURE__ */ g("ol", { ref: $, className: "reader-finder-list", children: d.map((T, P) => /* @__PURE__ */ g("li", { children: /* @__PURE__ */ D(
      Q,
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
    ) }, T.itemId)) }) : /* @__PURE__ */ g("p", { className: "reader-finder-empty", children: u.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ D(Le, { children: [
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
              T.key === "Enter" ? (T.preventDefault(), O(Xl(y, v.length, T.shiftKey))) : T.key === "Escape" && (T.preventDefault(), n()), T.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ g("p", { className: "reader-finder-count", "aria-live": "polite", children: v.length === 0 ? "没有找到" : `${y >= 0 ? `第 ${y + 1} / ` : ""}${v.length >= 200 ? "200+ 处，只列前 200 处" : `${v.length} 处`}${y < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ g("ol", { className: "reader-finder-list", children: v.map((T, P) => /* @__PURE__ */ g("li", { children: /* @__PURE__ */ D(Q, { className: "reader-finder-entry is-hit", "aria-current": P === y ? "true" : void 0, onClick: () => O(P), children: [
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
function Zh({
  active: e,
  ink: t,
  extensions: n = ar
}) {
  const [r, o] = _(!1), [a, s] = _(null), i = xa(), c = (f) => {
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
          children: /* @__PURE__ */ g(Xn, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null,
      n.map((f) => {
        const p = sr([f]);
        return /* @__PURE__ */ D(Co, { children: [
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
          p.length ? /* @__PURE__ */ g(wm, { active: e, tabs: p }) : null
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
        children: r ? /* @__PURE__ */ g(dt, { size: 20, strokeWidth: 2.2, "aria-hidden": !0 }) : /* @__PURE__ */ g(Ks, { size: 20, strokeWidth: 2.1, "aria-hidden": !0 })
      }
    )
  ] });
}
const Yh = [
  { tool: "pen", label: "画笔", Icon: Xn },
  { tool: "highlighter", label: "荧光笔", Icon: Vs },
  { tool: "eraser", label: "橡皮", Icon: qs }
];
function ns(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function rs({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ D(Le, { children: [
    Yh.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ g(
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
    ka.map((o) => /* @__PURE__ */ g(
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
    /* @__PURE__ */ g(Q, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ g(Js, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ g(
      Q,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ g(Gs, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
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
        children: /* @__PURE__ */ g(dt, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function Qh({
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
    /* @__PURE__ */ g("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ g(rs, { ink: e, page: t.page, onPick: n }) })
  ] });
}
function ep({ ink: e }) {
  return e.tool ? /* @__PURE__ */ g("div", { className: "reader-ink-bar is-dock", role: "toolbar", "aria-label": "画笔", "data-ink-dock": "true", children: /* @__PURE__ */ g(rs, { ink: e }) }) : null;
}
function tp(e) {
  var r;
  if (e.shiftKey || ns(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${Yo}`))) return null;
  const n = Number((r = t.closest(`[${Te}]`)) == null ? void 0 : r.getAttribute(Te)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function np(e) {
  const t = N(e);
  t.current = e, C(() => {
    const n = (r) => {
      if (ns(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
function rp({ edit: e }) {
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
const os = "retainpdf:reader:doc-theme:v1", Lo = "data-reader-doc";
function as() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function op(e = as()) {
  try {
    return (e == null ? void 0 : e.getItem(os)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function ap(e, t = as()) {
  try {
    t == null || t.setItem(os, e);
  } catch {
  }
}
function Do(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(Lo, "dark") : t.removeAttribute(Lo));
}
function sp() {
  const [e, t] = _(() => op());
  C(() => {
    Do(e);
  }, [e]), C(() => () => Do("light"), []);
  const n = L(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return ap(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
function ip({ state: e, bookmarks: t }) {
  const { finder: n, setFinder: r, toggleFinder: o, findQuery: a, setFindQuery: s, findTerm: i, findFocus: c, jumpFromFinder: l, jumpToPageFromFinder: u } = e;
  return /* @__PURE__ */ D(Le, { children: [
    /* @__PURE__ */ g(Jh, { open: n, onToggle: o }),
    n ? /* @__PURE__ */ g(
      Xh,
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
function cp({
  session: e,
  zoomDocuments: t,
  zoomItem: n,
  setZoomItem: r,
  closeZoom: o,
  visiblePdfMode: a
}) {
  return /* @__PURE__ */ g(Le, { children: n ? /* @__PURE__ */ g(
    im,
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
function lp(e) {
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
function up(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function dp(e, t) {
  const { sessionFiles: n } = e, [r, o] = _(!1), a = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, s = lp({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: n.translatedUrl,
    overlayContentAvailable: a,
    liveTranslationVisible: r,
    assistantOpen: t
  }), i = al({
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
    u.current !== e.viewStateKey && cl({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: c,
      jobTerminal: e.session.jobTerminal
    }) && (u.current = e.viewStateKey, o(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, c]), { liveTranslationVisible: r, setLiveTranslationVisible: o, paneComposition: s, liveToggles: i, sourceViewOnly: c, visiblePdfMode: l };
}
function fp(e, { liveTranslationVisible: t, setLiveTranslationVisible: n, liveToggles: r, sourceViewOnly: o, visiblePdfMode: a }) {
  const s = sl(e.liveTranslation), i = L(() => {
    s && e.goToPage(s, "source");
  }, [e.goToPage, s]), [c, l] = _(null);
  C(() => {
    a === "compare" && e.session.jobTerminal && l(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, a]);
  const u = c !== e.viewStateKey && ll({
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
function mp() {
  try {
    return Ke().translationEdit ?? null;
  } catch {
    return null;
  }
}
const hp = "这本书正在处理（翻译或排版），处理完才能改。", pp = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function gp({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = mp(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = Ql(s), l = !t || Bt(t), u = au(n), [m, d] = _(""), [f, p] = _(null), [h, b] = _(() => /* @__PURE__ */ new Map()), [w, v] = _(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [y, S] = _(() => /* @__PURE__ */ new Map()), [k, E] = _({ phase: "idle" }), x = N({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  C(() => {
    p(null), x.drafts.clear(), x.generation.current = null, S(/* @__PURE__ */ new Map()), E({ phase: "idle" });
  }, [s]), C(() => {
    if (d(""), !i || c || !a) return;
    let M = !1;
    return a.resolveOwnerJobId(s).then((F) => {
      M || d(`${F || s}`.trim() || s);
    }).catch(() => {
      M || d(s);
    }), () => {
      M = !0;
    };
  }, [i, c, a, s]), C(() => {
    if (b(/* @__PURE__ */ new Map()), !a || !m || !u || !l) return;
    let M = !1;
    return a.fetchRevisions(m).then((F) => {
      M || b(su(F, u));
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
      for (const [F, z] of w.edits) M.set(F, z);
    return M;
  }, [h, w, u]), A = L((M) => {
    const F = `${M || ""}`.trim();
    F && p({ itemId: F, page: eu(F) });
  }, []), I = L(() => p(null), []), T = L((M, F) => {
    v((z) => {
      const G = new Map(z.renderedAt === u ? z.edits : []);
      return G.set(M, F), { renderedAt: u, edits: G };
    }), S((z) => new Map(z).set(M, (z.get(M) || 0) + 1));
  }, [u]), P = L(async () => {
    if (!(!a || !s || k.phase === "submitting" || k.phase === "running")) {
      E({ phase: "submitting" });
      try {
        await a.rerender(s), E({ phase: "running", seenActive: !1 }), await o();
      } catch (M) {
        E({ phase: "failed", message: (M == null ? void 0 : M.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, k.phase, o]), R = c ? pp : !l || k.phase === "running" || k.phase === "submitting" ? hp : "";
  return V(() => ({
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
function bp(e, t) {
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
function yp(e, t, n) {
  const { session: r, sessionFiles: o } = e, a = gp({
    jobId: r.jobId,
    jobStatus: r.jobStatus,
    jobPayload: r.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!o.translatedUrl,
    refreshJobStatus: r.refreshJobStatus
  }), s = a.select, i = e.setModeKeepingPage, c = r.regions, l = L((m) => {
    uu(c, m) && (t === "source" && i("compare"), s(m));
  }, [c, s, t, i]);
  bp(a.available ? l : null, n);
  const u = V(() => {
    if (!a.savedCounts.size) return e.revisedBlocks;
    const m = new Map(e.revisedBlocks);
    for (const [d, f] of a.savedCounts) m.set(d, (m.get(d) || 0) + f);
    return m;
  }, [e.revisedBlocks, a.savedCounts]);
  return { blockEdit: a, editBlock: l, revisedBlocks: u };
}
const vp = "reader-finder-input";
function wp(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function Sp(e, t = typeof window > "u" ? null : window) {
  C(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!wp(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(vp) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function kp(e) {
  const [t, n] = _(null), r = L((f) => n((p) => p === f ? null : f), []), [o, a] = _(""), [s, i] = _("");
  C(() => {
    const f = o.replace(/\s+/gu, " ").trim(), p = window.setTimeout(() => i(f), f ? 150 : 0);
    return () => window.clearTimeout(p);
  }, [o]);
  const [c, l] = _(0), u = L(() => {
    n("search"), l((f) => f + 1);
  }, []);
  Sp(u);
  const m = L((f) => {
    e.jumpToAnchor({ block_id: f }), (t === "outline" || Qe() < 900) && n(null);
  }, [e.jumpToAnchor, t]), d = L((f) => {
    e.goToPage(f), (t === "outline" || Qe() < 900) && n(null);
  }, [e.goToPage, t]);
  return { finder: t, setFinder: n, toggleFinder: r, findQuery: o, setFindQuery: a, findTerm: s, findFocus: c, jumpFromFinder: m, jumpToPageFromFinder: d };
}
function Ip(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : na(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Tp(e, t) {
  return t === null || e !== t;
}
function Rp(e, t) {
  const { boot: n } = e, r = N(null), o = N(null);
  C(() => {
    if (!(n.loading || n.failed)) {
      if (r.current !== e.viewStateKey) {
        r.current = e.viewStateKey;
        const a = Oe(e.viewStateKey), s = Ip({
          savedMode: a == null ? void 0 : a.mode,
          sourceViewOnly: t,
          viewportWidth: Qe()
        });
        o.current = s.auto ? s.mode : null, s.mode && s.mode !== e.mode && e.setModeKeepingPage(s.mode);
        return;
      }
      Tp(e.mode, o.current) && (o.current = null, pn(e.viewStateKey, { mode: e.mode }));
    }
  }, [n.failed, n.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, t]);
}
const Ep = [];
function Pp(e) {
  const { sessionFiles: t } = e, [n, r] = _({}), o = N({ source: t.sourceUrl, translated: t.translatedUrl });
  o.current = { source: t.sourceUrl, translated: t.translatedUrl };
  const a = L((b, w) => {
    r((v) => ({ ...v, [w]: { url: o.current[w], nodes: b } }));
  }, []), s = V(() => {
    const b = n.source;
    if (b && b.url === t.sourceUrl && b.nodes.length) return b.nodes;
    const w = n.translated;
    return w && w.url === t.translatedUrl && w.nodes.length ? w.nodes : Ep;
  }, [n, t.sourceUrl, t.translatedUrl]), i = N({}), [c, l] = _(0), u = L((b, w) => {
    i.current[w] = { url: o.current[w], pdf: b }, l((v) => v + 1);
  }, []), [m, d] = _(null), f = L((b) => d(b), []), p = L(() => d(null), []);
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
function Mp() {
  const e = yl(), { boot: t, panes: n, session: r } = e, o = Bh(e.viewStateKey), a = o.panel, s = o.setPanel, i = a !== null, { liveTranslationVisible: c, setLiveTranslationVisible: l, paneComposition: u, liveToggles: m, sourceViewOnly: d, visiblePdfMode: f } = dp(e, i);
  Rp(e, d);
  const p = a || (e.mode === "compare" ? "compare" : "reading"), { docDark: h, toggleDocDark: b } = sp();
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
  const w = L(() => {
    s(null);
  }, []), { latestLivePage: v, jumpToLatestLivePage: y, offerCompletion: S, setCompletionDismissedKey: k, sourcePaneAction: E } = fp(e, {
    liveTranslationVisible: c,
    setLiveTranslationVisible: l,
    liveToggles: m,
    sourceViewOnly: d,
    visiblePdfMode: f
  }), x = L((he) => {
    const ye = up(he, e.liveTranslationAvailable);
    ye !== null && l(ye), e.setModeKeepingPage(he);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), $ = L((he) => {
    s(he);
  }, []), [O] = _(Wh), A = kp(e), { finder: I, toggleFinder: T, findTerm: P } = A, R = L((he) => e.jumpToAnchor({ block_id: he }), [e.jumpToAnchor]), M = L((he, ye) => e.jumpToAnchor({ block_id: he }, ye), [e.jumpToAnchor]), { bookmarks: F, onPdfOutline: z, onPdfDocument: G, zoomItem: J, setZoomItem: oe, zoomBlock: ne, closeZoom: j, zoomDocuments: W } = Pp(e), { blockEdit: K, editBlock: fe, revisedBlocks: q } = yp(e, f, O), U = ed(e.viewStateKey);
  np(U);
  const [ie, ge] = _(null), ae = L(() => ge(null), []), ue = Lf({ documentId: r.documentId, jobId: r.jobId }), Re = V(() => ({
    documentId: r.documentId || "",
    jobId: r.jobId,
    versionId: ue.readingVersionId || null,
    translationVersions: ue.versions,
    regions: r.regions,
    metadata: r.readerMetadata,
    bookmarks: F,
    pageCount: n.hudNumPages || 0,
    resetKey: e.viewStateKey,
    hoveredItemId: () => O.get().itemId,
    goToPage: e.goToPage,
    sourceOnly: e.sourceOnly,
    activePanel: a,
    closePanel: w,
    visibleMode: f,
    setWorkspace: x,
    jumpToBlock: M,
    shellEl: e.shell.shellEl,
    primaryPane: e.panes.primaryPane,
    pdfDocuments: W
  }), [
    r.documentId,
    r.jobId,
    ue,
    r.regions,
    r.readerMetadata,
    F,
    n.hudNumPages,
    e.viewStateKey,
    O,
    e.goToPage,
    e.sourceOnly,
    a,
    w,
    f,
    x,
    M,
    e.shell.shellEl,
    e.panes.primaryPane,
    W
  ]), [qe] = _(Vd), we = ef(qe), se = V(() => Jd(we), [we]), me = V(() => Xd(we), [we]), be = V(() => Gd(we), [we]), [H, ee] = _([]), re = V(() => ({
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
    revisedBlocks: q,
    onPdfOutline: z,
    onPdfDocument: G,
    zoomBlock: ne,
    textMarks: be,
    pageLayers: se,
    editBlock: K.available ? fe : void 0,
    blockEdit: K,
    editShowsSource: f !== "compare",
    findTerm: I === "search" ? P : "",
    compareVersion: me,
    ink: U,
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
    q,
    z,
    G,
    ne,
    be,
    se,
    K,
    fe,
    f,
    I,
    P,
    me,
    U,
    e.sourceOnly,
    d,
    e.download,
    e.goToPage,
    $,
    w,
    h,
    b
  ]), Ae = V(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), Pe = [
    Gi,
    `is-workspace-${p}`,
    i ? "is-assistant-open" : "",
    I ? "is-finder-open" : "",
    u.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ g(Yd, { api: Re, store: qe, children: /* @__PURE__ */ g(id, { value: re, hud: Ae, children: /* @__PURE__ */ D(
    "div",
    {
      className: Pe,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": p,
      "data-ink-mode": U.tool || void 0,
      onContextMenu: (he) => {
        const ye = tp(he);
        ye && (he.preventDefault(), ee(qd(we, { target: he.target, clientX: he.clientX, clientY: he.clientY, page: ye.page })), ge(ye));
      },
      children: [
        /* @__PURE__ */ g(lh, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!r.readerErrors.regions, metadataError: !!r.readerErrors.metadata, onRetry: r.refreshJobArtifacts }),
        /* @__PURE__ */ g(ip, { state: A, bookmarks: F }),
        /* @__PURE__ */ D("div", { className: "reader-chrome-tray", children: [
          /* @__PURE__ */ g(yh, {}),
          /* @__PURE__ */ g(xl, { onBeforeClose: r.prepareClose })
        ] }),
        /* @__PURE__ */ g(
          Kd,
          {
            mode: f,
            documentReady: !!r.jobId,
            sourceViewOnly: d,
            onModeChange: x,
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
                k(e.viewStateKey), x("compare");
              }
            } : null
          }
        ),
        /* @__PURE__ */ g(Sm, { active: a }),
        i ? /* @__PURE__ */ g(ih, {}) : null,
        /* @__PURE__ */ g(jd, { paneComposition: u, markdownSplit: i, assistantSplit: i, liveTranslation: e.liveTranslation, sourcePaneAction: E }),
        e.showHud ? /* @__PURE__ */ g(
          zh,
          {
            mode: f,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            issuesJobId: e.sourceOnly ? "" : r.jobId,
            searchSlot: /* @__PURE__ */ g(Gh, { open: I, onToggle: T })
          }
        ) : null,
        /* @__PURE__ */ g(
          cp,
          {
            session: r,
            zoomDocuments: W,
            zoomItem: J,
            setZoomItem: oe,
            closeZoom: j,
            visiblePdfMode: f
          }
        ),
        /* @__PURE__ */ g(Zh, { active: a, ink: U }),
        /* @__PURE__ */ g(
          Qh,
          {
            ink: U,
            menu: ie,
            onClose: ae,
            actions: H
          }
        ),
        /* @__PURE__ */ g(nf, { extensions: ar }),
        /* @__PURE__ */ g(ep, { ink: U }),
        /* @__PURE__ */ g(rp, { edit: K }),
        /* @__PURE__ */ g(Uh, {})
      ]
    }
  ) }) });
}
function Gp() {
  return /* @__PURE__ */ g(Mp, {});
}
export {
  Gp as R,
  Mp as a,
  Jp as b,
  qp as c,
  Vp as d,
  Wp as f,
  Kp as r,
  df as s,
  Ve as u
};
//# sourceMappingURL=ReaderApp-v3jMmlWy.js.map
