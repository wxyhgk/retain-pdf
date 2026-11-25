var Tr = (e) => {
  throw TypeError(e);
};
var Mr = (e, t, n) => t.has(e) || Tr("Cannot " + n);
var Ot = (e, t, n) => (Mr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Nr = (e, t, n) => t.has(e) ? Tr("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Ar = (e, t, n, r) => (Mr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as L, jsx as p, Fragment as St } from "react/jsx-runtime";
import { useMemo as J, useState as T, useEffect as C, useCallback as D, useRef as M, useLayoutEffect as Pe, memo as yn, createContext as Zn, useContext as Yn, forwardRef as zo, useImperativeHandle as Qn, useSyncExternalStore as Oo, useId as $o, Suspense as Lr, lazy as Fo } from "react";
import { requireAdapter as Ct, getReaderAdapters as xe } from "./adapters.js";
import { resolveReaderDownloadName as is, resolveReaderDownloadUrls as ls, READER_PROGRESS_COPY as Xe, trimString as un, READER_DOWNLOAD_ACTIONS as cs, disabledReason as us } from "./runtime/state.js";
import { r as ds, b as fs } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as xn, isFinishedJobStatus as qt } from "@retainpdf/domain/job";
import { n as Bo, d as hs, f as kn, k as _r, b as ms, c as ps, j as De, p as zt, g as gs, l as Gt, i as bs } from "./reader-regions-B6o2DsPy.js";
import { fetchDocumentReading as ys } from "@retainpdf/api/documents";
import { isReaderTransportError as vs, createReaderTransportError as ws } from "./contracts.js";
import { X as kt, PenLine as er, ZoomIn as Ss, Check as jo, Copy as ks, ChevronUp as Is, ChevronDown as Ho, History as Rs, LoaderCircle as Es, Pin as Ps, LogOut as Ts, FileText as Uo, Columns2 as Wo, Languages as Ko, Radio as Ms, ArrowDownToLine as Ns, CheckCircle2 as As, Keyboard as Ls, Download as _s, ListOrdered as xs, TriangleAlert as Ds, ChevronRight as Vo, ListTree as Cs, Search as zs, GitCompareArrows as Os, LayoutGrid as $s, Highlighter as Fs, Eraser as Bs, Undo2 as js, Trash2 as Hs, ChevronLeft as Us, Minus as Ws, Plus as Ks, ArrowLeft as Vs } from "lucide-react";
import { Button as X, Textarea as Js, IconButton as gt, Input as Jo } from "@retainpdf/ui";
import { toast as Dn, Toaster as qs } from "sonner";
import { pdfjs as qo, Page as Gs, Document as Xs } from "react-pdf";
import { e as Zs, m as Ys, a as Qs } from "./markdown-math-XkF5urpn.js";
const ei = (...e) => {
  var t, n;
  return ((n = (t = xe()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, ti = "", ni = Object.freeze({
  progress: "retainpdf-reader-progress"
}), ri = (e) => {
  var t, n;
  return ((n = (t = xe()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, Gm = (...e) => {
  var n;
  return (((n = xe()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Xm = () => {
  var e, t;
  return ((t = (e = xe()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
}, Ze = () => Ct("defaultReaderDataPort"), xr = () => Ct("defaultReaderPageConfigPort"), Zm = {
  get apiPrefix() {
    return Ze().apiPrefix;
  },
  fetchProtected: (...e) => Ze().fetchProtected(...e),
  loadMarkdownPayload: (e) => Ze().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => Ze().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => Ze().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => Ze().loadJobPayload(e),
  loadReaderPayload: (e, t) => Ze().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => Ze().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return Ze().liveTranslation;
  }
}, Go = {
  messageTargetOrigin: () => xr().messageTargetOrigin(),
  readerJobId: () => xr().readerJobId()
}, oi = () => {
  var e;
  return ((e = xe()) == null ? void 0 : e.liveTranslation) ?? null;
}, Xt = () => {
  var t;
  const e = xe();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, nt = () => {
  const e = xe();
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
}, ai = (...e) => {
  var t, n;
  return ((n = (t = xe()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, si = () => {
  var e, t;
  return ((t = (e = xe()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, ii = (...e) => {
  var t, n;
  return ((n = (t = xe()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, li = (...e) => {
  var t, n;
  return ((n = (t = xe()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? is(...e);
}, ci = (...e) => {
  var t, n;
  return ((n = (t = xe()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? ls(...e);
}, ui = (...e) => Ct("downloadProtectedResource")(...e), di = (...e) => Ct("failDownloadToast")(...e), Ym = (e, t) => Ct("resolveMarkdownAssetUrl")(e, t), Dr = "/api/v1";
function fi() {
  const e = () => {
    var r;
    return ds(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = T(e);
  return C(() => {
    var i, l, c, u;
    const r = () => n(e()), o = (l = (i = globalThis.history) == null ? void 0 : i.pushState) == null ? void 0 : l.bind(globalThis.history), a = (u = (c = globalThis.history) == null ? void 0 : c.replaceState) == null ? void 0 : u.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const f = (d) => function(...h) {
          const b = d.apply(this, h);
          return r(), globalThis.dispatchEvent(new Event("pushstate")), globalThis.dispatchEvent(new Event("replacestate")), globalThis.dispatchEvent(new Event("locationchange")), b;
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
function hi() {
  const e = fi(), t = J(() => ii(Go), [e]), n = J(() => si(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function mi(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: i
  } = e, [l, c] = T({
    documentId: "",
    jobId: ""
  }), [u, f] = T({
    documentId: "",
    jobId: ""
  }), d = l.documentId === t ? l.jobId : "", h = u.documentId === t ? u.jobId : "", b = n || d, [m, w] = T({
    jobId: "",
    documentId: ""
  }), k = m.jobId === b ? m.documentId : "", v = t || k, g = !!t && !b, [y, S] = T(null), E = (y == null ? void 0 : y.sessionIdentity) === r && y.documentId === v ? y : null, N = g || !!E, z = D((A) => {
    const I = `${A.documentId || ""}`.trim();
    if (!I || a.current && a.current !== I) return;
    if (!a.current && s.current)
      w({
        jobId: s.current,
        documentId: I
      });
    else if (!a.current)
      return;
    const R = `${A.revision || ""}`.trim() || `${Date.now()}`;
    S({
      documentId: I,
      revision: R,
      sessionIdentity: o.current
    }), i();
  }, []);
  C(() => {
    S((A) => A && A.sessionIdentity !== r ? null : A);
  }, [r]);
  const $ = D((A) => {
    switch (A.type) {
      case "resolved-document-job":
        c({ documentId: A.documentId, jobId: A.jobId });
        break;
      case "cleared-resolved-document-job":
        c({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        f({ documentId: A.documentId, jobId: A.jobId });
        break;
      case "resolved-job-document":
        w((I) => I.jobId === A.jobId && I.documentId === A.documentId ? I : { jobId: A.jobId, documentId: A.documentId });
        break;
      case "committed-source":
        S({
          documentId: A.documentId,
          revision: A.revision,
          sessionIdentity: A.sessionIdentity
        });
        break;
    }
  }, []);
  return {
    resolvedDocumentJob: l,
    setResolvedDocumentJob: c,
    missingDocumentJob: u,
    setMissingDocumentJob: f,
    documentJobId: d,
    rejectedDocumentJobId: h,
    sessionJobId: b,
    resolvedJobDocument: m,
    setResolvedJobDocument: w,
    jobDocumentId: k,
    documentId: v,
    sourceOnly: g,
    committedDocumentSource: y,
    setCommittedDocumentSource: S,
    activeCommittedDocumentSource: E,
    sourceViewOnly: N,
    refreshCommittedDocument: z,
    applyIdentityEvent: $
  };
}
function Cr(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function pi(e) {
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
    const l = `${i || ""}`.trim();
    if (l) return l;
  }
  return "";
}
function zr(e, t) {
  return ri(xn(e, t));
}
function gi(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function bi(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !gi(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function Cn({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: ni.progress,
        stage: n,
        percent: e,
        text: t
      },
      Go.messageTargetOrigin()
    );
  } catch {
  }
}
function dn(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), Cn({ percent: t, text: n, stage: r });
}
function yi(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, l] = T(null), [c, u] = T(null), [f, d] = T(""), [h, b] = T(0), m = f === n ? i : null, w = f === n ? c : null, k = Cr(m), v = qt(k), g = D(() => {
    b(($) => $ + 1);
  }, []), y = D(($) => {
    l($.jobPayload), u($.manifestPayload), d($.sessionIdentity);
  }, []), S = D(($) => {
    l(null), u(null), d($);
  }, []), E = M(""), N = M(""), z = D(async () => {
    const $ = o.current;
    if (!$ || E.current === $) return;
    const A = nt().loadJobPayload;
    if (typeof A != "function") return;
    const I = a.current.value;
    E.current = $;
    try {
      const R = await A($);
      if (s.current || a.current.value !== I || o.current !== $ || !R || typeof R != "object")
        return;
      const P = Cr(R);
      l(R), d(r.current), !qt(P) && N.current === $ && (N.current = ""), P === "succeeded" && N.current !== $ && (N.current = $, b((_) => _ + 1));
    } catch {
    } finally {
      E.current === $ && (E.current = "");
    }
  }, []);
  return C(() => {
    N.current = "";
  }, [n]), C(() => {
    if (!t || v || !m) return;
    const $ = window.setInterval(() => {
      document.visibilityState !== "hidden" && z();
    }, 1e3);
    return () => window.clearInterval($);
  }, [v, z, m, t]), {
    jobPayload: i,
    setJobPayload: l,
    manifestPayload: c,
    setManifestPayload: u,
    payloadSessionIdentity: f,
    setPayloadSessionIdentity: d,
    scopedJobPayload: m,
    scopedManifestPayload: w,
    jobStatus: k,
    jobTerminal: v,
    jobRefreshRevision: h,
    refreshJobArtifacts: g,
    refreshJobStatus: z,
    publishPayload: y,
    clearPayload: S
  };
}
function zn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function vi(e, t) {
  e(t), zn(t);
}
function wi(e) {
  const [t, n] = T(e ? "source" : "compare"), r = D((a) => {
    e && a !== "source" || (n(a), zn(a));
  }, [e]), o = D((a) => {
    vi(n, a);
  }, []);
  return C(() => (e && document.documentElement.classList.add("reader-source-only"), zn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Or(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function Si(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Or(n.active_job_id),
    activeVersionId: Or(n.active_version_id)
  };
}
function ki(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Ii(e) {
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
const Ti = 48 * 1024 * 1024;
function Mi(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Ni = 2, _e = /* @__PURE__ */ new Map();
function On(e, t) {
  _e.delete(e), _e.set(e, t);
}
function $r(e) {
  if (_e.size < Ni) return;
  const t = _e.keys().next().value;
  t && _e.delete(t);
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
async function Xo(e, t = Xt().fetchProtected, n = {}) {
  var u, f, d, h, b, m, w, k, v;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (_e.has(r)) {
    const g = _e.get(r);
    return On(r, g), g;
  }
  const o = new AbortController(), a = () => o.abort();
  (u = n.signal) != null && u.aborted && o.abort(), (d = (f = n.signal) == null ? void 0 : f.addEventListener) == null || d.call(f, "abort", a, { once: !0 });
  let s;
  try {
    s = await t(r, { signal: o.signal });
  } finally {
    (b = (h = n.signal) == null ? void 0 : h.removeEventListener) == null || b.call(h, "abort", a);
  }
  if (!s.ok) {
    const g = new Error(`读取 PDF 失败 (${s.status})`);
    g.status = s.status;
    const y = await Ai(s);
    throw y && (g.reason = y), g;
  }
  const i = Li(r, s, t);
  if (i) {
    o.abort();
    const g = { ranged: i };
    return $r(), _e.set(r, g), g;
  }
  (w = (m = n.signal) == null ? void 0 : m.addEventListener) == null || w.call(m, "abort", a, { once: !0 });
  let l;
  try {
    l = await s.arrayBuffer();
  } finally {
    (v = (k = n.signal) == null ? void 0 : k.removeEventListener) == null || v.call(k, "abort", a);
  }
  const c = { data: new Uint8Array(l) };
  return _e.has(r) ? On(r, c) : ($r(), _e.set(r, c)), c;
}
function Li(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < Ti ? null : {
    url: e,
    length: o,
    async fetchRange(i, l) {
      const c = await n(e, { headers: { Range: `bytes=${i}-${l - 1}` } });
      if (c.status !== 206) throw new Error(`读取 PDF 片段失败 (${c.status})`);
      return new Uint8Array(await c.arrayBuffer());
    }
  };
}
const _i = { file: null, loading: !1, error: "" }, xi = { file: null, loading: !0, error: "" };
function Di(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = T(null);
  if (C(() => {
    if (t || !n) return;
    const s = _e.get(n);
    if (s) {
      On(n, s);
      return;
    }
    const i = new AbortController();
    return Xo(n, void 0, { signal: i.signal }).then((l) => {
      i.signal.aborted || o({ url: n, file: l, loading: !1, error: "" });
    }).catch((l) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (l == null ? void 0 : l.message) || String(l) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return _i;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = _e.get(n);
  return a ? { file: a, loading: !1, error: "" } : xi;
}
function Ci(e) {
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
  dn(s, r, n, "download");
  const i = await Xo(t, Xt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (dn(s, o, n, "download"), i);
}
async function zi(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  dn(o, 25, "正在下载 PDF…", "download");
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
function Oi(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function $i({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = ys,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(Oi(o.href, t, a)), !0);
}
const nn = {
  regions: null,
  metadata: null
};
function Fi(e) {
  const {
    sessionJobId: t,
    jobId: n,
    routeDocumentId: r,
    documentJobId: o,
    rejectedDocumentJobId: a,
    sourceOnly: s,
    locationKey: i,
    sessionIdentity: l,
    committedSource: c,
    applyIdentityEvent: u,
    publishPayload: f,
    clearPayload: d,
    switchSessionMode: h,
    jobRefreshRevision: b,
    sessionEpochRef: m,
    closingRef: w,
    activeLoadAbortRef: k
  } = e, [v, g] = T(""), [y, S] = T(""), [E, N] = T(null), [z, $] = T(null), [A, I] = T(!1), [R, P] = T(""), [_, x] = T([]), [H, F] = T(!1), [G, Z] = T(() => ({
    source: null,
    translated: null
  })), [ae, se] = T(
    nn
  ), [ce, ue] = T({
    loading: !0,
    percent: 4,
    text: Xe.boot,
    stage: "progress",
    failed: !1
  });
  return C(() => {
    const le = new AbortController(), Ce = m.current.value, te = Ci({
      sessionEpochRef: m,
      closingRef: w,
      abort: le,
      sessionEpoch: Ce
    });
    k.current = le;
    const re = nt();
    if (w.current)
      return le.abort(), () => {
        k.current === le && (k.current = null);
      };
    let fe = !1;
    function ve(oe, de) {
      te.markFailed(), F(!0), ue({
        loading: !1,
        percent: 100,
        text: oe,
        stage: "failed",
        failed: !0
      }), Cn({ percent: 100, text: de, stage: "failed" });
    }
    function Se() {
      I(!0), fe || F(!0), ue({
        loading: !1,
        percent: 100,
        text: Xe.ready,
        stage: "ready",
        failed: !1
      }), Cn({ percent: 100, text: Xe.ready, stage: "ready" });
    }
    function pe() {
      return c != null && c.documentId ? zr(
        c.documentId,
        c.revision
      ) : ei() ? ti : re.resolveResourceUrl(xn(r));
    }
    async function Ve() {
      var q;
      let oe = { activeJobId: "", activeVersionId: "" };
      try {
        const ee = await ((q = re.fetchDocument) == null ? void 0 : q.call(re, r));
        ee && (oe = Si(ee));
      } catch {
      }
      const de = ki({
        link: oe,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!c
      });
      if (de.kind === "follow-active-job") {
        if (te.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: de.jobId
        }), de.activeVersionId ? (c || u({
          type: "committed-source",
          documentId: r,
          revision: de.activeVersionId,
          sessionIdentity: l
        }), h("source")) : h("compare");
        return;
      }
      if (de.kind === "open-committed-source") {
        if (te.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: de.revision,
          sessionIdentity: l
        }), h("source");
        return;
      }
      const ge = pe();
      if (te.isInactive()) return;
      g(ge), S(""), P(""), d(l);
      const B = await $n({
        url: ge,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: te,
        setBoot: ue
      });
      if (!te.isInactive()) {
        if (!B) {
          ve("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        N(B), Se();
      }
    }
    async function Je() {
      var ht;
      const oe = !c, de = !!(oe && re.loadSessionSnapshot && re.loadReaderOptionalArtifacts), ge = de ? re.loadReaderOptionalArtifacts(t) : null, B = await ((ht = re.loadSessionSnapshot) == null ? void 0 : ht.call(re, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: c,
        includeOptionalArtifacts: oe && !de
      })), q = B ? {
        jobPayload: B.sourcePayload,
        manifestPayload: B.manifestPayload,
        readerMetadata: B.readerMetadata,
        regionsPayload: B.regions,
        readerErrors: B.readerErrors
      } : await re.loadReaderPayload(t, {
        includeOptionalArtifacts: oe
      });
      if (te.isInactive()) return;
      let ee = null;
      if (n && !r)
        if (B && B.linkedDocument !== void 0)
          ee = B.linkedDocument;
        else {
          try {
            ee = await re.fetchDocumentByJobId(Dr, t);
          } catch {
          }
          if (te.isInactive()) return;
        }
      const Oe = pi(q.jobPayload) || `${(ee == null ? void 0 : ee.document_id) || ""}`.trim();
      Oe && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Oe
      });
      const Te = Ii({
        payloadDocumentId: Oe,
        linkedActiveJobId: `${(ee == null ? void 0 : ee.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(ee == null ? void 0 : ee.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!c
      });
      if (Te.kind === "restore-committed-source") {
        if (te.isInactive()) return;
        u({
          type: "committed-source",
          documentId: Te.documentId,
          revision: Te.revision,
          sessionIdentity: l
        }), h("source");
        return;
      }
      const Me = re.resolveReaderSourcePdf(q.manifestPayload), $e = re.resolveReaderTranslatedPdfUrl(q.jobPayload, q.manifestPayload), Ne = typeof Me == "string" ? Me : re.resolveReaderArtifactUrl(Me), Fe = r || Oe, we = c != null && c.documentId ? zr(
        c.documentId,
        c.revision
      ) : Ne || (Fe ? re.resolveResourceUrl(xn(Fe)) : ""), Ae = c ? "" : $e || "";
      g(we || ""), S(Ae), P(bi(q.jobPayload, t)), f({
        jobPayload: q.jobPayload || null,
        manifestPayload: q.manifestPayload || null,
        sessionIdentity: l
      });
      const je = () => zi({
        sourceFinal: we || "",
        translatedFinal: Ae,
        fence: te,
        setBoot: ue
      }), qe = !!(we || Ae), He = ge && qe ? je() : null;
      He == null || He.catch(() => {
      });
      const Le = (O) => {
        te.isInactive() || (x(c ? [] : Bo(O.regionsPayload)), Z(c ? { source: null, translated: null } : hs(O.readerMetadata)), se(c ? nn : O.readerErrors ?? nn), F(!0));
      };
      if (ge ? (fe = !0, ge.then(Le)) : Le(q), !qe) {
        ve(Xe.failed, Xe.failed);
        return;
      }
      const ot = await (He ?? je());
      if (ot.status !== "inactive") {
        if (ot.status === "incomplete") {
          ve("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        N(ot.sourceBytes), $(ot.translatedBytes), Se();
      }
    }
    async function ze() {
      I(!1), N(null), $(null), x([]), F(!1), Z({ source: null, translated: null }), se(nn), dn(ue, 8, Xe.metadata, "metadata");
      try {
        if (s) {
          await Ve();
          return;
        }
        if (!t) {
          ve(Xe.failed, Xe.failed);
          return;
        }
        await Je();
      } catch (oe) {
        if (te.isClosedOrStale() || (oe == null ? void 0 : oe.name) === "AbortError") return;
        te.markFailed();
        const de = Number(oe == null ? void 0 : oe.status), ge = `${(oe == null ? void 0 : oe.reason) || ""}`, B = Pi({ status: de, reason: ge, sessionJobId: t });
        if (B && (await $i({
          apiPrefix: Dr,
          documentId: B,
          expiredJobId: t
        }) || te.isClosedOrStale()))
          return;
        if (Ri({
          status: de,
          reason: ge,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), h("source");
          return;
        }
        const q = oe instanceof Error ? oe.message : Xe.failed;
        ve(q, q);
      }
    }
    return ze(), () => {
      le.abort(), k.current === le && (k.current = null);
    };
  }, [t, r, o, a, s, i, c, b, n, l, u, f, d, h]), {
    sourceUrl: v,
    translatedUrl: y,
    sourceFile: E,
    translatedFile: z,
    assetsReady: A,
    title: R,
    regions: _,
    regionsSettled: H,
    readerMetadata: G,
    readerErrors: ae,
    boot: ce
  };
}
function Bi() {
  const e = M(!1), t = M(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = hi(), s = M({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = M(a), l = M(""), c = M(""), u = M(() => {
  }), f = D(() => u.current(), []), d = mi({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: i,
    documentIdRef: l,
    sessionJobIdRef: c,
    switchToSourceMode: f
  }), {
    sessionJobId: h,
    documentId: b,
    sourceOnly: m,
    sourceViewOnly: w
  } = d, { mode: k, setMode: v, switchSessionMode: g } = wi(w);
  u.current = () => {
    g("source");
  }, i.current = a, l.current = b, c.current = h;
  const y = yi({
    sessionJobId: h,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: c,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: S,
    scopedManifestPayload: E,
    jobStatus: N,
    jobTerminal: z,
    jobRefreshRevision: $,
    refreshJobArtifacts: A,
    refreshJobStatus: I
  } = y, R = Fi({
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
    publishPayload: y.publishPayload,
    clearPayload: y.clearPayload,
    switchSessionMode: g,
    jobRefreshRevision: $,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), P = D(() => {
    var x;
    e.current = !0, (x = t.current) == null || x.abort();
  }, []), _ = J(
    () => ({
      fetchProtected: nt().fetchProtected,
      jobId: h,
      jobPayload: S,
      manifestPayload: E,
      sourceUrl: R.sourceUrl,
      translatedUrl: R.translatedUrl,
      sourceOnly: w
    }),
    [h, S, E, R.sourceUrl, R.translatedUrl, w]
  );
  return {
    jobId: h,
    jobStatus: N,
    workflow: `${(S == null ? void 0 : S.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: z,
    documentId: b,
    sessionIdentity: a,
    sourceOnly: m,
    mode: k,
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
    download: _,
    refreshJobArtifacts: A,
    refreshJobStatus: I,
    refreshCommittedDocument: d.refreshCommittedDocument,
    prepareClose: P
  };
}
const ji = 160, Hi = 8, Ui = 0;
function Wi() {
  const e = M(null), [t, n] = T(null), [r, o] = T(Ui), a = D((s) => {
    e.current = s, n(s);
  }, []);
  return C(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (c) => {
      !Number.isFinite(c) || c < ji || o((u) => Math.abs(u - c) < Hi ? u : c);
    }, l = new ResizeObserver((c) => {
      var u, f;
      i(((f = (u = c[0]) == null ? void 0 : u.contentRect) == null ? void 0 : f.width) ?? s.clientWidth);
    });
    return l.observe(s), i(s.clientWidth), () => l.disconnect();
  }, [t]), {
    shellRef: e,
    shellEl: t,
    shellWidth: r,
    bindShell: a
  };
}
function Ki(e) {
  const { mode: t, sourceOnly: n, assetsReady: r, hasSource: o, hasTranslated: a } = e, s = r && o, i = r && a && !n, l = t === "source" || t === "compare", c = !n && (t === "translated" || t === "compare");
  return {
    mountSource: s,
    mountTranslated: i,
    showSource: l,
    showTranslated: c,
    compareMode: t === "compare" && l && c && s && i,
    primaryPane: t === "translated" ? "translated" : "source"
  };
}
const In = { source: 0, translated: 0 };
function Vi(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    sourceUrl: a,
    translatedUrl: s,
    sourceFile: i,
    translatedFile: l
  } = e, c = `${(t == null ? void 0 : t.identityKey) || ""}\0${a}\0${s}`, u = M(c);
  u.current = c;
  const [f, d] = T(() => ({
    identity: c,
    pages: In
  })), [h, b] = T(() => ({ identity: c, tick: 0 })), m = f.identity === c ? f.pages : In, w = h.identity === c ? h.tick : 0, k = Ki({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!l
  }), { primaryPane: v } = k, g = D((I, R) => {
    u.current === c && d((P) => {
      const _ = P.identity === c ? P.pages : In;
      return _[R] === I && P.identity === c ? P : {
        identity: c,
        pages: { ..._, [R]: I }
      };
    });
  }, [c]), y = M(null), S = D(() => {
    y.current && clearTimeout(y.current);
    const I = c;
    y.current = setTimeout(() => {
      y.current = null, u.current === I && b((R) => ({
        identity: I,
        tick: R.identity === I ? R.tick + 1 : 1
      }));
    }, 60);
  }, [c]);
  C(() => (y.current && (clearTimeout(y.current), y.current = null), d((I) => I.identity === c && I.pages.source === 0 && I.pages.translated === 0 ? I : { identity: c, pages: { source: 0, translated: 0 } }), b((I) => I.identity === c && I.tick === 0 ? I : { identity: c, tick: 0 }), () => {
    y.current && (clearTimeout(y.current), y.current = null);
  }), [c]);
  const E = J(
    () => Math.max(m.source, m.translated),
    [m]
  ), N = v === "translated" ? m.translated : m.source || m.translated, z = t == null ? void 0 : t.userZoom, $ = t == null ? void 0 : t.shellWidth, A = `${c}-${w}-${z}-${n}-${m.source}-${m.translated}-${$}`;
  return {
    ...k,
    numPagesByPane: m,
    hudNumPages: E,
    primaryNumPages: N,
    metricsTick: w,
    onNumPages: g,
    onMetrics: S,
    rowSyncRevision: A
  };
}
const Ee = "data-reader-page", Ie = "data-reader-pane", tr = "data-natural-height", Ji = "reader-react-root", Zo = "reader-react-grid", Yo = "reader-react-scroll-shell", vn = "reader-react-pdf-pane", Qo = "reader-react-pdf-page", fn = "reader-react-pdf-page-placeholder", nr = "reader-react-pdf-page-slot";
function hn(e, t) {
  const n = e != null ? `[${Ee}="${e}"]` : `[${Ee}]`;
  return t ? `${n}[${Ie}="${t}"]` : n;
}
function rr() {
  return `.${nr}[${Ee}]`;
}
function mn(e) {
  return Number(e.getAttribute(Ee));
}
const ea = 0.25, pn = 1, qi = 0.05, tn = 0.5, Gi = 16, Xi = 8, ta = Gi + Xi, Zi = 720;
function ut() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function na(e) {
  return Number.isFinite(e) && e < Zi;
}
function Nt(e, t = Number.POSITIVE_INFINITY) {
  return na(t) && (e === "source" || e === "translated") ? pn : tn;
}
function et(e) {
  return Number.isFinite(e) ? Math.min(pn, Math.max(ea, e)) : tn;
}
function Zt(e, t) {
  const n = et(Number(e) + t * qi);
  return Math.round(n * 100) / 100;
}
function Yi(e) {
  return Math.round(et(e) * 100);
}
function ra(e) {
  const n = (Number(e) || 0) - ta;
  return Math.max(160, Math.floor(n));
}
function Qi(e, t = tn) {
  const n = et(t);
  return ra((Number(e) || 0) * n);
}
function el(e, t) {
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
    for (const { pane: s, cx: i, hadOverflow: l } of o) {
      const c = Math.max(0, s.scrollWidth - s.clientWidth);
      if (c <= 0) {
        s.scrollLeft = 0;
        continue;
      }
      l ? s.scrollLeft = Math.min(
        c,
        Math.max(0, i * t - s.clientWidth / 2)
      ) : s.scrollLeft = c / 2;
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
const oa = 200, aa = [
  "markdown"
], rl = aa;
function sa(e) {
  return rl.includes(e);
}
const ol = "retainpdf:reader:view:v1:", Fr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), al = /* @__PURE__ */ new Set([
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
function Fn(e) {
  return `${e || ""}`.trim();
}
function sl({
  documentId: e,
  jobId: t
}) {
  const n = Fn(e);
  if (n) return `document:${n}`;
  const r = Fn(t);
  return r ? `job:${r}` : "";
}
function la(e) {
  const t = Fn(e);
  return t ? `${ol}${t}` : "";
}
function il(e) {
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
  if (!(!Fr.has(t) || !Fr.has(n) || t === n))
    return { left: t, right: n };
}
function cl(e) {
  return e === null ? null : sa(e) ? e : void 0;
}
function ul(e) {
  return al.has(e) ? e : void 0;
}
function ca(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = il(t.anchor), r = Number(t.zoom), o = ul(t.mode), a = ll(t.splitLayout), s = cl(t.assistantPanel);
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
function Ke(e, t = ia()) {
  const n = la(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? ca(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function wn(e, t, n = ia()) {
  const r = la(e);
  if (!r || !n) return null;
  const o = Ke(e, n), a = ca({
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
function dl(e, t, n = "") {
  var d;
  const [r, o] = T(() => {
    var h;
    return ((h = Ke(n)) == null ? void 0 : h.zoom) ?? Nt(e, ut());
  }), a = M(r), s = M(n);
  a.current = r;
  const i = M(1), l = M(((d = Ke(n)) == null ? void 0 : d.zoom) !== void 0);
  C(() => {
    var m;
    if (s.current === n) return;
    s.current = n;
    const h = (m = Ke(n)) == null ? void 0 : m.zoom;
    l.current = h !== void 0;
    const b = h ?? Nt(e, ut());
    i.current = 1, a.current = b, o(b);
  }, [e, n]), C(() => {
    if (l.current) return;
    const h = Nt(e, ut()), b = a.current;
    Math.abs(h - b) < 5e-4 || (i.current = 1, a.current = h, o(h));
  }, [e]);
  const c = D((h, b) => {
    const m = et(h), w = a.current;
    Math.abs(m - w) < 5e-4 || (i.current = (b == null ? void 0 : b.keepScroll) === !1 ? 1 : m / (w || 1), a.current = m, l.current = !0, wn(s.current, { zoom: m }), o(m));
  }, []), u = D((h) => {
    c(Zt(a.current, h));
  }, [c]), f = D((h) => {
    c(Nt(h));
  }, [c]);
  return Pe(() => {
    const h = i.current;
    Math.abs(h - 1) < 1e-3 || (i.current = 1, el(t == null ? void 0 : t.current, h));
  }, [r, t]), { userZoom: r, onZoomChange: c, stepZoom: u, resetZoom: f };
}
const fl = 160, hl = 3e-3, Br = 50, ml = 16, pl = 800;
function gl(e, t = 0) {
  const n = t === 1 ? ml : t === 2 ? pl : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-Br, Math.min(Br, r));
  return Math.exp(-o * hl);
}
function bl(e, t, n = 0) {
  return et(e * gl(t, n));
}
function yl(e) {
  return Math.round(et(e) * 100) / 100;
}
function vl(e, t, n) {
  const r = et(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return et(t) / r;
  const a = (o + ta) / r;
  return ra(a * et(t)) / o;
}
function wl(e) {
  return Array.from(e.querySelectorAll(rr()));
}
function Sl(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function kl(e, t, n) {
  let r = null;
  for (const s of wl(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const l = Sl(i, t, n);
    if ((!r || l < r.distance) && (r = { el: s, rect: i, distance: l }), l === 0) break;
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
function Il(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function ua(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${rr()}[${Ee}="${t.page}"][${Ie}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (Il(n, e).scrollLeft += a);
}
function Rl(e, t, n, r) {
  const o = e.querySelector(`.${Zo}`);
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
const El = 600, Pl = 1e3;
function Tl(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || ua(e, t);
  });
  a.observe(n);
  const s = (u) => {
    u.type === "wheel" && u.ctrlKey || c();
  }, i = ["wheel", "keydown", "pointerdown", "touchstart"];
  for (const u of i) r.addEventListener(u, s, { capture: !0, passive: !0 });
  const l = r.setTimeout(() => c(), Pl);
  function c() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(l);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return c;
}
function Ml(e, t, n) {
  const r = M(t);
  r.current = t;
  const o = M(n);
  o.current = n;
  const a = M(null), s = M(null), i = M(null);
  C(() => {
    if (!e) return;
    const l = () => {
      const u = a.current;
      if (a.current = null, !u) return;
      const f = yl(u.target);
      if (Math.abs(f - r.current) < 5e-3) {
        $t(u.grid);
        return;
      }
      const d = { anchor: u.anchor, grid: u.grid, fallback: null };
      d.fallback = setTimeout(() => {
        s.current === d && (s.current = null, $t(d.grid));
      }, El), s.current = d, o.current(f, { keepScroll: !1 });
    }, c = (u) => {
      var h, b;
      if (!u.ctrlKey) return;
      u.preventDefault();
      let f = a.current;
      if (!f) {
        (h = i.current) == null || h.call(i), i.current = null;
        const m = s.current;
        m && (m.fallback && clearTimeout(m.fallback), s.current = null, $t(m.grid)), f = {
          start: r.current,
          target: r.current,
          anchor: kl(e, u.clientX, u.clientY),
          grid: null,
          timer: null
        }, a.current = f;
      }
      f.target = bl(f.target, u.deltaY, u.deltaMode);
      const d = vl(f.start, f.target, ((b = f.anchor) == null ? void 0 : b.pageWidth) ?? 0);
      f.grid = Rl(e, d, u.clientX, u.clientY) ?? f.grid, f.timer && clearTimeout(f.timer), f.timer = setTimeout(l, fl);
    };
    return e.addEventListener("wheel", c, { passive: !1 }), () => {
      var f;
      e.removeEventListener("wheel", c);
      const u = a.current;
      a.current = null, u != null && u.timer && clearTimeout(u.timer), $t((u == null ? void 0 : u.grid) ?? null), (f = i.current) == null || f.call(i), i.current = null;
    };
  }, [e]), Pe(() => {
    var c;
    const l = s.current;
    l && (s.current = null, l.fallback && clearTimeout(l.fallback), $t(l.grid), !(!e || !l.anchor) && (ua(e, l.anchor), (c = i.current) == null || c.call(i), i.current = Tl(e, l.anchor)));
  }, [t, e]);
}
function Nl(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = M(t), a = M(n), s = M(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: D((l) => {
    l !== o.current && (s.current(), a.current(l));
  }, []) };
}
const or = 48;
function da(e, t = or) {
  return e.getBoundingClientRect().top + t;
}
function fa(e, t) {
  if (!e.length)
    return null;
  let n = null, r = -1 / 0;
  for (const l of e) {
    const c = l.getBoundingClientRect();
    c.height < 8 || c.width < 8 || c.top <= t + 1 && c.top >= r && (n = l, r = c.top);
  }
  if (!n && (n = e.find((c) => {
    const u = c.getBoundingClientRect();
    return u.height >= 8 && u.width >= 8;
  }) ?? null, n)) {
    const c = [...e].reverse().find((u) => {
      const f = u.getBoundingClientRect();
      return f.height >= 8 && f.width >= 8;
    });
    c && c.getBoundingClientRect().bottom < t && (n = c);
  }
  if (!n)
    return null;
  const o = mn(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function Vt(e, t, n = or) {
  if (!e)
    return null;
  const r = hn(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = da(e, n), i = fa(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function xt(e, t, n = "auto", r, o = or) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(hn(a, r))), i || (i = e.querySelector(hn(a))), !i)
    return !1;
  const l = e.getBoundingClientRect(), c = i.getBoundingClientRect();
  if (l.height <= 0 || c.height < 8 && i.offsetHeight < 8)
    return !1;
  const u = c.height > 0 ? c.height : i.offsetHeight, f = e.scrollTop + (c.top - l.top), d = Math.max(0, f + s * u - o);
  return n === "auto" ? Math.abs(e.scrollTop - d) >= 1 && (e.scrollTop = d) : e.scrollTo({ top: d, behavior: n }), !0;
}
function Al(e, t, n = "smooth", r) {
  return xt(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function Bn(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const i = [], l = () => {
    var u;
    if (a) return;
    xt(
      e(),
      t,
      r,
      n == null ? void 0 : n.pane
    ) && !s && (s = !0, (u = n == null ? void 0 : n.onDone) == null || u.call(n));
  };
  for (const c of o)
    c <= 0 ? requestAnimationFrame(() => {
      requestAnimationFrame(l);
    }) : i.push(setTimeout(l, c));
  return () => {
    a = !0;
    for (const c of i)
      clearTimeout(c);
  };
}
function Ll(e, t, n) {
  return Bn(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function gn(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function Be(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function _l(e, t, n = !0, r = "", o) {
  const [a, s] = T(1);
  return C(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const i = e.current;
    if (!i)
      return;
    let l = !1, c = null, u = 0;
    const f = hn(void 0, o), d = () => {
      if (l) return;
      const m = Array.from(i.querySelectorAll(f));
      if (!m.length)
        return;
      const w = da(i), k = fa(m, w);
      k && s(k.page);
    }, h = () => {
      l || (u && cancelAnimationFrame(u), u = requestAnimationFrame(() => {
        u = 0, d();
      }));
    }, b = () => {
      if (l) return;
      if (!Array.from(i.querySelectorAll(f)).length) {
        c = setTimeout(b, 120);
        return;
      }
      d(), i.addEventListener("scroll", h, { passive: !0 });
    };
    return b(), () => {
      l = !0, c && clearTimeout(c), u && cancelAnimationFrame(u), i.removeEventListener("scroll", h);
    };
  }, [e, t, n, r, o]), a;
}
const xl = `canvas, .react-pdf__Page, .${Qo}, .${fn}`, jr = /* @__PURE__ */ new WeakMap();
function Dl(e) {
  const t = Number(e.getAttribute(tr));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = jr.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(xl), jr.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Cl(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function zl(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(rr()).forEach((r) => {
    const o = mn(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = Dl(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Ol(e, t, n = "", r) {
  const [o, a] = T(() => /* @__PURE__ */ new Map()), s = M(o), i = M(r);
  return i.current = r, Pe(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let l = !1, c = 0, u = !1, f = !1;
    const d = () => {
      var S;
      if (l) return;
      const g = e.current;
      if (!g) return;
      const y = zl(g);
      Cl(s.current, y) || (s.current = y, a(y)), u && !f && (f = !0, (S = i.current) == null || S.call(i));
    }, h = () => {
      cancelAnimationFrame(c), c = requestAnimationFrame(() => {
        requestAnimationFrame(d);
      });
    };
    h();
    const b = window.setTimeout(h, 100), m = window.setTimeout(() => {
      u = !0, h();
    }, 300), w = window.setTimeout(h, 700), k = e.current;
    let v = null;
    return k && typeof ResizeObserver < "u" && (v = new ResizeObserver(() => h()), v.observe(k)), () => {
      l = !0, cancelAnimationFrame(c), window.clearTimeout(b), window.clearTimeout(m), window.clearTimeout(w), v == null || v.disconnect();
    };
  }, [e, t, n]), o;
}
const $l = [0, 48, 140, 320, 560], Fl = 700, Bl = [80, 200, 400], jl = 500, Hl = 50, Ul = /* @__PURE__ */ new Set([
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
]), Wl = 180, Hr = [0, 48, 140, 320, 700, 1200];
function Kl(e, t) {
  var R;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = M(
    ((R = Ke(a)) == null ? void 0 : R.anchor) || { page: 1, fraction: 0 }
  ), l = M(null), c = M(!1), u = M(r), f = M(null), d = M(null), h = M(null), b = M(null), m = M(a), w = M(""), k = M(n);
  k.current = n;
  const v = D(() => {
    var P;
    (P = f.current) == null || P.call(f), f.current = null, d.current != null && (clearTimeout(d.current), d.current = null);
  }, []), g = D(() => {
    !c.current && l.current == null || (v(), h.current != null && (clearTimeout(h.current), h.current = null), l.current = null, c.current = !1);
  }, [v]), y = D((P = !1) => {
    b.current != null && (clearTimeout(b.current), b.current = null);
    const _ = () => {
      b.current = null, wn(m.current, {
        anchor: Be(i.current)
      });
    };
    P ? _() : b.current = setTimeout(_, Wl);
  }, []), S = D((P) => {
    i.current = Be(P), l.current = null, h.current != null && clearTimeout(h.current), h.current = setTimeout(() => {
      h.current = null, c.current = !1;
    }, Hl);
  }, []);
  C(() => {
    if (!o)
      return;
    let P = !1, _ = null, x = null, H = null;
    const F = () => {
      if (P) return;
      const G = e.current;
      if (!G) {
        H = setTimeout(F, 50);
        return;
      }
      _ = G, x = () => {
        if (c.current)
          return;
        const Z = Vt(_, k.current);
        Z && (i.current = Z, y());
      }, _.addEventListener("scroll", x, { passive: !0 }), c.current || x();
    };
    return F(), () => {
      P = !0, H != null && clearTimeout(H), _ && x && _.removeEventListener("scroll", x);
    };
  }, [o, r, n, e, y]), C(() => {
    if (!o) return;
    const P = e.current;
    if (!P) return;
    const _ = (x) => {
      x.metaKey || x.ctrlKey || x.altKey || Ul.has(x.key) && g();
    };
    return P.addEventListener("wheel", g, { passive: !0 }), P.addEventListener("touchmove", g, { passive: !0 }), window.addEventListener("keydown", _), () => {
      P.removeEventListener("wheel", g), P.removeEventListener("touchmove", g), window.removeEventListener("keydown", _);
    };
  }, [o, e, g]), Pe(() => {
    var _;
    if (m.current === a) return;
    y(!0), v(), h.current != null && (clearTimeout(h.current), h.current = null), m.current = a, w.current = "";
    const P = (_ = Ke(a)) == null ? void 0 : _.anchor;
    i.current = P ? Be(P) : { page: 1, fraction: 0 }, l.current = null, c.current = !!a, u.current = r;
  }, [a, r, y, v]), C(() => {
    var _;
    if (!o || !s || !a || w.current === a) return;
    w.current = a;
    const P = Be(
      ((_ = Ke(a)) == null ? void 0 : _.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = P, l.current = P, c.current = !0, v(), f.current = Bn(
      () => e.current,
      P,
      {
        behavior: "auto",
        pane: k.current,
        delaysMs: Hr,
        onDone: () => S(P)
      }
    ), d.current = setTimeout(() => {
      d.current = null, S(P);
    }, Math.max(...Hr) + 160), () => v();
  }, [o, s, a, e, S, v]), C(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      c.current = !1, l.current = null, v();
      return;
    }
    const P = l.current ? Be(l.current) : Be(i.current);
    return c.current = !0, l.current = P, i.current = P, v(), f.current = Bn(
      () => e.current,
      P,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: $l,
        onDone: () => S(P)
      }
    ), d.current = setTimeout(() => {
      d.current = null, S(P);
    }, Fl), () => {
      v();
    };
  }, [r, o, n, e, S, v]), C(() => () => {
    v(), h.current != null && (clearTimeout(h.current), h.current = null), y(!0);
  }, [v, y]);
  const E = D(() => {
    const P = Vt(
      e.current,
      k.current
    );
    return Be(P || i.current);
  }, [e]), N = D(() => {
    c.current = !0;
    const P = Vt(
      e.current,
      k.current
    ), _ = Be(P ?? i.current);
    return i.current = _, l.current = _, y(), _;
  }, [e, y]), z = D((P, _, x) => {
    const H = x || k.current, F = gn(P, _ || 1), G = { page: F, fraction: 0 };
    i.current = G, c.current = !0, l.current = G, y(), v(), Al(e.current, F, "smooth", H), f.current = Ll(
      () => e.current,
      F,
      {
        behavior: "auto",
        pane: H,
        delaysMs: Bl,
        onDone: () => S(G)
      }
    ), d.current = setTimeout(() => {
      d.current = null, S(G);
    }, jl);
  }, [e, S, v, y]), $ = D(() => Be(i.current), []), A = D(() => c.current, []), I = D(() => {
    if (!c.current || !l.current)
      return;
    const P = Be(l.current);
    xt(
      e.current,
      P,
      "auto",
      k.current
    );
  }, [e]);
  return {
    lockFromShell: E,
    beginModeSwitch: N,
    goToPage: z,
    getAnchor: $,
    isRestoring: A,
    repinIfRestoring: I
  };
}
function Vl(e, t) {
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
function ha(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const Jl = [0, 80, 200, 400, 800], ql = 120, Gl = 400;
function Xl(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: l, documentId: c, regionsSettled: u = !0 } = e, f = M(a);
  f.current = a;
  const d = M(s);
  d.current = s;
  const h = M(i);
  h.current = i;
  const b = M(n);
  b.current = n, C(() => {
    var y, S;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const m = ai(), w = Vl(m, d.current);
    if (w == null && (m != null && m.blockId) && !u) return;
    const k = ha(m, w, { jobId: l, documentId: c });
    if (t.current === k)
      return;
    if (w == null) {
      t.current = k, (y = b.current) == null || y.call(b);
      return;
    }
    t.current = k, m && ((S = h.current) == null || S.call(h, m, w));
    const v = [];
    let g = 0;
    for (const E of Jl)
      g = Math.max(g, E), v.push(
        setTimeout(() => {
          f.current(w);
        }, E)
      );
    return v.push(
      setTimeout(() => {
        var E;
        (E = b.current) == null || E.call(b);
      }, g + ql)
    ), () => {
      for (const E of v) clearTimeout(E);
    };
  }, [r, o, l, c, t, u]);
}
function Zl(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function Yl(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = Gl,
    jobId: i,
    documentId: l,
    applyReaderSearch: c
  } = e, u = M(a);
  u.current = a;
  const f = M(c);
  f.current = c;
  const d = M(0);
  C(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || d.current === o) return;
    const h = setTimeout(() => {
      var k;
      const b = ((k = globalThis.location) == null ? void 0 : k.search) || "", m = fs(b, o, u.current);
      if (d.current = o, m === null) return;
      const w = `${new URLSearchParams(m).get("block_id") || ""}`.trim();
      t.current = ha(
        { blockId: w },
        o,
        { jobId: i, documentId: l }
      ), (f.current || Zl)(m);
    }, s);
    return () => clearTimeout(h);
  }, [
    n,
    r,
    o,
    s,
    i,
    l,
    t
  ]);
}
function Ql(e) {
  const t = M(""), [n, r] = T(!1), o = D(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  Xl(a, t, o), Yl(e, t, n);
}
const Ft = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function ec(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function Ur(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function ma(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = Ur(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = Ur(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function tc(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = ma(r, t, n);
  if (o === "retry") return e;
  if (o === "ignore")
    return { ...e, lastSeq: t.seq, connection: "live", error: "" };
  const a = new Map(n.items.map((l) => [l.item_id, l])), s = new Map((r == null ? void 0 : r.changedAtSeqById) || []);
  for (const l of t.changed_item_ids)
    a.has(l) && s.set(l, t.seq);
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
function nc(e) {
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
function rc(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function oc(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function ac(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function sc(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const Wr = [250, 500, 1e3, 2e3, 4e3], Rn = [80, 160, 320, 640, 1e3, 1500], Kr = [250, 500, 1e3, 2e3, 4e3, 5e3];
function jn(e, t) {
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
function ar(e) {
  return vs(e) ? `${e.code || ""}`.trim() : "";
}
function rn(e, t) {
  const n = ar(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function ic(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const l = await o.fetchPage(e, t.page_idx, { signal: r });
      if (ma(n.pagesByPage.get(t.page_idx), t, l) !== "retry")
        return l;
      a = ws(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (l) {
      if ((l == null ? void 0 : l.name) === "AbortError") throw l;
      a = l;
      const c = ar(l);
      if (c && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(c)) throw l;
    }
    const i = Rn[Math.min(s, Rn.length - 1)];
    if (await jn(i, r), s >= Rn.length + 2) throw a;
  }
}
function lc({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = T(Ft), s = M(o), i = M("");
  s.current = o;
  const l = `${e || ""}`.trim(), c = `${t || ""}`.trim().toLowerCase(), u = qt(c) ? c : "";
  return C(() => {
    if (!n || !l) {
      i.current = "", s.current = Ft, a(Ft);
      return;
    }
    const f = r === void 0 ? oi() : r, d = i.current === l;
    if (i.current = l, !f) {
      const g = {
        ...d ? s.current : Ft,
        connection: u ? "terminal" : "unavailable",
        jobStatus: c,
        error: "实时译文暂不可用"
      };
      s.current = g, a(g);
      return;
    }
    const h = new AbortController();
    let b = !1;
    const m = {
      ...d ? s.current : Ft,
      connection: u ? "terminal" : "connecting",
      jobStatus: c,
      error: ""
    };
    s.current = m, a(m);
    const w = (g) => {
      h.signal.aborted || a((y) => {
        const S = g(y);
        return s.current = S, S;
      });
    }, k = async () => {
      let g = 0;
      for (; !h.signal.aborted; )
        try {
          const y = await f.fetchLayout(l, { signal: h.signal });
          b = !0, w((S) => ({
            ...S,
            layoutByPage: ec(y),
            jobStatus: c,
            error: ""
          }));
          return;
        } catch (y) {
          if ((y == null ? void 0 : y.name) === "AbortError") return;
          const S = ar(y);
          if (!(S === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !S)) {
            w((N) => ({
              ...N,
              connection: u ? "terminal" : "unavailable",
              jobStatus: c,
              error: rn(y, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            w((N) => ({
              ...N,
              connection: "terminal",
              jobStatus: c,
              error: ""
            }));
            return;
          }
          w((N) => ({
            ...N,
            connection: "connecting",
            jobStatus: c,
            error: rn(y, "正在等待 OCR 版面数据")
          })), await jn(Wr[Math.min(g, Wr.length - 1)], h.signal).catch(() => {
          }), g += 1;
        }
    };
    return (async () => {
      if (await k(), !b || h.signal.aborted) return;
      let g = 0;
      for (; !h.signal.aborted; ) {
        u || w((y) => ({
          ...y,
          connection: y.lastSeq > 0 ? "reconnecting" : "connecting",
          jobStatus: c,
          // 保留已有错误：首页还没提交（lastSeq 为 0）时恰恰是最容易出错的阶段，
          // 此前这里把它清成空串，UI 于是一直显示「连接中」，用户看到的是
          // "正在努力"，实际可能已经在反复失败。
          error: y.error
        }));
        try {
          await f.streamEvents(l, {
            afterSeq: s.current.lastSeq,
            signal: h.signal,
            onEvent: async (y) => {
              if (y.seq <= s.current.lastSeq) return;
              let S;
              try {
                S = await ic(
                  l,
                  y,
                  s.current,
                  h.signal,
                  f
                );
              } catch (E) {
                if ((E == null ? void 0 : E.name) === "AbortError" || h.signal.aborted) throw E;
                w((N) => ({
                  ...N,
                  lastSeq: Math.max(N.lastSeq, y.seq),
                  error: rn(E, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              w((E) => {
                const N = tc(E, y, S);
                return u ? {
                  ...N,
                  connection: "terminal",
                  jobStatus: c
                } : {
                  ...N,
                  jobStatus: c
                };
              }), g = 0;
            }
          });
        } catch (y) {
          if ((y == null ? void 0 : y.name) === "AbortError" || h.signal.aborted) return;
          w((S) => ({
            ...S,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: c,
            error: rn(y, "实时译文连接已中断，正在重连")
          }));
        }
        if (h.signal.aborted) return;
        if (u) {
          w((y) => ({
            ...y,
            connection: "terminal",
            jobStatus: c
          }));
          return;
        }
        await jn(Kr[Math.min(g, Kr.length - 1)], h.signal).catch(() => {
        }), g += 1;
      }
    })(), () => h.abort();
  }, [n, r, l, u]), o;
}
function cc(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), l = Number(s.count) || 0;
    i && l > 0 && o.set(i, l);
  }
  return o;
}
function uc(e, t = !0) {
  const [n, r] = T(() => /* @__PURE__ */ new Map());
  return C(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = nt().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(cc(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const dc = 4500;
function fc(e) {
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
const hc = /* @__PURE__ */ new Set(["book", "translate"]);
function pa(e) {
  return !!(e.jobId && e.sourceUrl && hc.has(e.workflow));
}
function mc(e) {
  return !!(pa(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function pc() {
  const e = Bi(), t = pa({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = mc({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = M({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !qt(o) && (r.current.running = !0);
  const a = lc({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: l, bindShell: c } = Wi(), u = uc(e.jobId, !e.sourceOnly), f = sl({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: h, onZoomChange: b } = dl(e.mode, s, f);
  Ml(i, h, b);
  const m = Vi(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: h, shellWidth: l, identityKey: d }
  ), {
    beginModeSwitch: w,
    goToPage: k,
    repinIfRestoring: v
  } = Kl(s, {
    primaryPane: m.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: m.primaryNumPages > 0
  });
  C(() => {
    v();
  }, [l, v]);
  const g = Ol(
    s,
    m.compareMode,
    m.rowSyncRevision,
    v
  ), y = _l(
    s,
    m.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${h}-${m.metricsTick}`,
    m.primaryPane
  ), S = D((F, G) => {
    var ae, se;
    const Z = Math.max(
      Number(m.hudNumPages) || 0,
      Number(m.primaryNumPages) || 0,
      Number((ae = m.numPagesByPane) == null ? void 0 : ae.source) || 0,
      Number((se = m.numPagesByPane) == null ? void 0 : se.translated) || 0
    );
    k(F, Z, G);
  }, [k, m.hudNumPages, m.primaryNumPages, m.numPagesByPane]), [E, N] = T(null), z = M(null), $ = D((F) => {
    z.current && clearTimeout(z.current), N(F), F && (z.current = setTimeout(() => N(null), dc));
  }, []);
  C(() => () => {
    z.current && clearTimeout(z.current);
  }, []);
  const A = D((F) => {
    const G = kn(e.regions, F);
    return G ? _r(G, m.primaryPane).page : null;
  }, [e.regions, m.primaryPane]), I = D((F, G) => {
    const Z = G || m.primaryPane, ae = typeof F == "object" && F ? `${F.block_id || ""}`.trim() : "", se = typeof F == "object" && F ? `${F.image_url || ""}`.trim() : "", ce = typeof F == "object" && F ? F.page_idx != null ? Number(F.page_idx) + 1 : F.page != null ? Number(F.page) : null : typeof F == "number" ? F + 1 : null, ue = ms(e.regions, se, ce) || kn(e.regions, ae) || (typeof F == "object" ? ps(e.regions, F) : null);
    let le = ue ? _r(ue, Z).page : null;
    le == null && (le = fc(F)), !(le == null || le < 1) && ($(ue), S(le, Z));
  }, [$, S, m.primaryPane, e.regions]);
  Ql({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: m.hudNumPages || 0,
    currentPage: y,
    goToPage: S,
    resolveBlockPage: A,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (F) => {
      $(kn(e.regions, F.blockId));
    }
  });
  const { setModeKeepingPage: R } = Nl({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: w
  });
  C(() => {
    $(null);
  }, [d, $]);
  const P = !e.boot.loading && !e.boot.failed, _ = J(() => ({ bindShell: c, shellEl: i, shellWidth: l, shellRef: s }), [c, i, l, s]), x = J(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), H = J(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: h,
    onZoomChange: b,
    shell: _,
    panes: m,
    sessionFiles: x,
    rowHeights: g,
    goToPage: S,
    activeRegion: E,
    jumpToAnchor: I,
    setModeKeepingPage: R,
    download: e.download,
    showHud: P,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, _, m, x, g, S, E, I, R, P, h, b, f, a, n, u]);
  return J(() => ({
    ...H,
    currentPage: y
  }), [H, y]);
}
const gc = [
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
], bc = [
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
function yc(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of gc)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function vc(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const wc = ".reader-notes-panel";
function Sc(e) {
  return e instanceof Element ? !!e.closest(wc) : !1;
}
function kc(e) {
  const {
    mode: t,
    sourceOnly: n,
    setMode: r,
    userZoom: o,
    onZoomChange: a,
    currentPage: s,
    numPages: i,
    goToPage: l,
    toggleDocDark: c,
    enabled: u = !0
  } = e;
  C(() => {
    if (!u)
      return;
    const f = (d) => {
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || vc(d.target) || Sc(d.target))
        return;
      const h = d.key, b = yc(h);
      if (b) {
        if (b.mode) {
          if (n && b.mode !== "source")
            return;
          d.preventDefault(), r(b.mode);
          return;
        }
        if (b.action === "doc-dark") {
          if (!c || d.repeat) return;
          d.preventDefault(), c();
          return;
        }
        if (!(b.requiresPages && i <= 0))
          switch (d.preventDefault(), b.action) {
            case "zoom-in":
              a(Zt(o, 1));
              return;
            case "zoom-out":
              a(Zt(o, -1));
              return;
            case "zoom-reset":
              a(Nt(t, ut()));
              return;
            case "next-page":
              l(gn(s + 1, i));
              return;
            case "prev-page":
              l(gn(s - 1, i));
              return;
            case "first-page":
              l(1);
              return;
            case "last-page":
              l(i);
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
    l,
    c
  ]);
}
const Ic = "retainpdf:soft-reader-close";
function Rc() {
  return new URL("./index.html", window.location.href).href;
}
function Ec() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: Ic },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Pc(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Tc() {
  if (!(typeof window > "u") && !Ec()) {
    if (Pc(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Rc());
  }
}
function Mc({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function Nc({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ L(Mc, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Tc();
  }, children: [
    /* @__PURE__ */ p(kt, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
const Ac = 3e3, Lc = 8;
async function _c(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function xc(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function Dc(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = Ac;
  const r = [], o = (s, i, l) => {
    const c = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const f = s[u], d = xc(f == null ? void 0 : f.title);
      if (!d) continue;
      n -= 1;
      const h = l ? `${l}.${u}` : `${u}`, b = { id: h, title: d, page: null, level: i, children: [] };
      r.push({ node: b, dest: f.dest }), c.push(b), i < Lc && Array.isArray(f.items) && f.items.length && (b.children = o(f.items, i + 1, h));
    }
    return c;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await _c(e, i);
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
function Vr(e) {
  if (!e) return [];
  const t = e.split(".");
  return t.slice(0, -1).map((n, r) => t.slice(0, r + 1).join("."));
}
let Jr = !1;
function Cc() {
  if (Jr)
    return;
  const e = Xt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (qo.GlobalWorkerOptions.workerSrc = e, Jr = !0);
}
function zc({
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
        onPointerDown: (l) => l.stopPropagation(),
        onClick: () => r(a),
        children: "?"
      },
      a.key
    );
  }) }) : null;
}
const ct = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Oc = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, $c = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Fc = {
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
}, qr = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function Bc(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => qr(o ?? a ?? "", Oc)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => qr(o ?? a ?? "", $c)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Fc[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function jc(e) {
  return ct(e.translatedBlockText) || ct(e.translated.text) || ct(e.source.text);
}
const Hc = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Uc(e) {
  const t = [];
  for (const n of e) {
    if (!Hc(n)) continue;
    const r = Bc(jc(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function Wc(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const Kc = 24, Vc = 60;
function Gr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - Kc), o = Math.min(e.length, n + t.length + Vc), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function Jc(e, t, n = 200) {
  const r = ct(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = ct(a.translatedBlockText) || ct(a.translated.text), l = i ? Gr(i, r) : null, c = l ?? Gr(ct(a.source.text), r);
    if (c && (o.push({ itemId: a.itemId, page: s, side: l ? "translated" : "source", ...c }), o.length >= n))
      break;
  }
  return o;
}
function on(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function Ht(e, t) {
  const n = ct(t).toLowerCase();
  if (!n || !e) return on(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${on(e.slice(a, s))}<mark class="reader-find-mark">${on(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + on(e.slice(a));
}
function qc(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const ya = "reader-xref", Hn = "data-xref", Ut = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, Gc = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${Ut})`), Xc = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function Un(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function Zc(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function Yc(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function Qc(e, t, n) {
  const r = e[t], o = (i) => {
    if (!i || i.source.page !== r.source.page) return !1;
    const l = De(i);
    return l === "figure" || l === "table" || l === "formula";
  }, a = (i) => {
    const l = [];
    for (let c = t + i; o(e[c]) && l.length < 40; c += i) l.push(e[c]);
    return i < 0 ? l.reverse() : l;
  }, s = a(n === "table" ? 1 : -1);
  return s.length ? s : a(n === "table" ? -1 : 1);
}
function eu(e, t, n) {
  return (e.find((o) => De(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function tu(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = De(r), s = Yc(r);
    if (a === "formula") {
      for (const b of s.matchAll(Xc)) {
        const m = Un(b[1]);
        m && n({ key: `equation:${m}`, kind: "equation", label: m, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = Gc.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const c = Zc(i[1]), u = Un(i[2]), f = Qc(e, o, c), d = [...f.map((b) => b.itemId), r.itemId], h = new Map(e.map((b, m) => [b.itemId, m]));
    d.sort((b, m) => (h.get(b) ?? 0) - (h.get(m) ?? 0)), n({ key: `${c}:${u}`, kind: c, label: u, itemId: eu(f, r, c), itemIds: d, captionId: r.itemId });
  }), t;
}
const nu = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${Ut})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${Ut})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${Ut})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${Ut})\s*[）)]`, "g"), kind: () => "equation" }
];
function ru(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of nu) {
    o.lastIndex = 0;
    for (const s of e.matchAll(o)) {
      const i = s.length > 2 ? s[1] : "", l = Un(s[s.length - 1]), c = `${a(i)}:${l}`;
      if (!t.has(c)) continue;
      const u = s.index ?? 0;
      n.push({ start: u, end: u + s[0].length, key: c });
    }
  }
  n.sort((o, a) => o.start - a.start);
  const r = [];
  for (const o of n)
    (!r.length || o.start >= r[r.length - 1].end) && r.push(o);
  return r;
}
function ou(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function au(e, t, n = "") {
  const r = ru(e, t);
  if (!r.length) return Ht(e, n);
  let o = "", a = 0;
  for (const s of r)
    o += Ht(e.slice(a, s.start), n), o += `<mark class="${ya}" ${Hn}="${ou(s.key)}">${Ht(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  return o + Ht(e.slice(a), n);
}
const su = { figure: "图", table: "表", equation: "式" };
function Xr(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${su[e.kind]} ${e.label}`;
}
function he(e) {
  return typeof e == "string" ? e : "";
}
function iu(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function lu(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function cu(e) {
  return {
    source: he(e == null ? void 0 : e.source_text) || he(e == null ? void 0 : e.unit_source_text),
    translated: he(e == null ? void 0 : e.protected_translated_text) || he(e == null ? void 0 : e.translated_text)
  };
}
const uu = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function va(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function du(e) {
  const t = va(e).sort((r, o) => he(r.ts).localeCompare(he(o.ts)));
  return t.length ? [
    { text: he(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: he(r.new_text),
      label: uu[he(r.source)] || he(r.source) || "修订",
      ts: he(r.ts),
      reason: he(r.reason)
    }))
  ].reverse() : [];
}
function fu(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function hu(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return he(r.finished_at) || he(n.finished_at) || "";
}
function mu(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = va(e).sort((a, s) => he(a.ts).localeCompare(he(s.ts)));
  for (const a of o) {
    const s = new Date(he(a.ts)).getTime(), i = he(a.reader_item_id) || he(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, he(a.new_text));
  }
  return n;
}
const pu = {
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
function gu(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = pu[he(n.kind)] || he(n.kind) || "问题", o = he(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const bu = /* @__PURE__ */ new Set(["text", "formula"]);
function sr(e) {
  return bu.has(e);
}
function yu(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || sr(De(n));
}
function vu(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !sr(De(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const wu = 300, Su = 72;
function ku(e, t) {
  if (e.width >= wu && e.height >= Su)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const Iu = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function Ru(e, t, n) {
  return e.flatMap((r) => {
    if (!Iu.has(De(r.region))) return [];
    const o = zt(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function Zr(e, t, n) {
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
const Pu = "reader-text-hover-copy", Tu = "reader-text-hover-edit", Mu = "reader-text-hover-zoom", Nu = "reader-text-hover-id";
function Au(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const wa = "reader-text-hover-tools";
function an({
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
const Lu = 26, _u = 220;
function xu(e, t = _u) {
  return e.height < Lu * 2 || e.width < t;
}
function Du({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? jo : e === "failed" ? kt : ks, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function Cu({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  onZoom: o,
  frameRect: a,
  placement: s,
  tailTop: i = 0
}) {
  const [l, c] = T("idle"), [u, f] = T("idle"), [d] = T(() => Au()), h = M([]), b = (e == null ? void 0 : e.itemId) || "";
  if (C(() => {
    c("idle"), f("idle");
    const S = h.current;
    return () => {
      S.forEach((E) => window.clearTimeout(E)), h.current = [];
    };
  }, [b]), !e) return null;
  const m = gs(e.highlight.region, t), w = De(e.highlight.region), k = (S, E) => async (N) => {
    N.preventDefault(), N.stopPropagation();
    const z = await Eu(S);
    E(z ? "copied" : "failed"), h.current.push(window.setTimeout(() => E("idle"), 1200));
  }, v = w === "formula" ? "复制 LaTeX" : "复制", g = a || e.rect, y = s || (xu(g) ? "outside" : "inside");
  return /* @__PURE__ */ p("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ p(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": w,
      style: g,
      children: /* @__PURE__ */ L(
        "div",
        {
          className: wa,
          "data-placement": y,
          style: y === "tail" ? { top: i } : void 0,
          children: [
            d ? /* @__PURE__ */ p(
              an,
              {
                className: Nu,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: k(e.itemId, f),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && sr(w) ? /* @__PURE__ */ p(
              an,
              {
                className: Tu,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (S) => {
                  S.preventDefault(), S.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ p(er, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            m ? /* @__PURE__ */ p(
              an,
              {
                className: Pu,
                state: l,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: l === "copied" ? "已复制" : l === "failed" ? "复制失败" : v,
                onClick: k(m, c),
                children: /* @__PURE__ */ p(Du, { state: l })
              }
            ) : null,
            o ? /* @__PURE__ */ p(
              an,
              {
                className: Mu,
                state: "idle",
                label: "放大看这一块",
                title: w === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (S) => {
                  S.preventDefault(), S.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ p(Ss, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function zu(e, t) {
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
function Ou(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = zt(
      zu(e, a),
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
const $u = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Fu = 256, Bt = /* @__PURE__ */ new Map();
function Bu(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Sa(e) {
  const t = `${e || ""}`, { text: n, slots: r } = Zs(t, { bareLatex: !0 }), o = Bu(n), a = Ys(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = Bt.get(t);
  if (!s && (s = Qs(o, r), Bt.set(t, s), Bt.size > Fu)) {
    const i = Bt.keys().next().value;
    i !== void 0 && Bt.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function En(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Ye(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function ju(e, t) {
  const n = e.typography, r = Ye(t) || 1, o = Ye(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = En(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, l = Math.max(5.5 * r, Math.min(s, i * r)), c = Ye(n == null ? void 0 : n.fit_min_font_size_pt), u = Ye(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (c || 5.5) * r), d = Math.max(
    f,
    u ? u * r : o ? o * r : l
  ), h = o ? o * r : l, b = Ye(n == null ? void 0 : n.leading_em), m = [
    Ye(n == null ? void 0 : n.padding_top_pt) || 0,
    Ye(n == null ? void 0 : n.padding_right_pt) || 0,
    Ye(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Ye(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((w) => w * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || $u,
    fontSizePx: Math.max(f, Math.min(d, h)),
    minFontSizePx: f,
    maxFontSizePx: d,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: b ? 1 + b : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (En(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : En(e.kind) ? "center" : "justify",
    padding: m,
    exact: !!o
  };
}
function Hu(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), i = (f) => {
    const d = s.get(f);
    if (d !== void 0) return d;
    const { width: h, height: b } = e(f), m = h <= t + 0.5 && b <= n + 0.5;
    return s.set(f, m), m;
  };
  let l = o, c = a, u = Math.min(r.requestedFontSizePx, c);
  if (i(u)) {
    if (!r.exact) {
      l = u;
      for (let f = 0; f < 6 && c > l; f += 1) {
        const d = (l + c) / 2;
        i(d) ? (u = d, l = d) : c = d;
      }
    }
  } else {
    c = u, u = l;
    for (let f = 0; f < 8 && c > l; f += 1) {
      const d = (l + c) / 2;
      i(d) ? (u = d, l = d) : c = d;
    }
  }
  return Math.max(o, u);
}
const Uu = 512, jt = /* @__PURE__ */ new Map();
let Wn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Wn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Wn += 1;
}));
function Wu(e, t, n, r) {
  return [
    Wn,
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
  const n = M(null), r = J(
    () => Sa(e.translatedText),
    [e.translatedText]
  ), [o, a] = T(r.fallbackHtml), s = J(
    () => ju(e, t),
    [e, t]
  );
  C(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((d) => {
      f && a(d);
    }), () => {
      f = !1;
    };
  }, [r]), Pe(() => {
    const f = n.current;
    if (!f) return;
    const [d, h, b, m] = s.padding, w = Math.max(1, e.rect.width - m - h), k = Math.max(1, e.rect.height - d - b), v = Wu(o, w, k, s);
    let g = jt.get(v);
    if (g === void 0 && (g = Hu(
      (y) => (f.style.fontSize = `${y}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      w,
      k,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), jt.set(v, g), jt.size > Uu)) {
      const y = jt.keys().next().value;
      y !== void 0 && jt.delete(y);
    }
    f.style.fontSize = `${g.toFixed(2)}px`;
  }, [o, e.rect.height, e.rect.width, s]);
  const [i, l, c, u] = s.padding;
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
        padding: `${i}px ${l}px ${c}px ${u}px`
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
function Ku({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = J(
    () => Ou(e, t, n, r),
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
const Vu = yn(Ku);
function Ju({
  targets: e,
  edits: t,
  width: n,
  excludeId: r
}) {
  const o = e.filter((a) => t.has(a.itemId) && a.itemId !== r);
  return o.length ? /* @__PURE__ */ p("div", { className: "reader-live-translation-overlay reader-edited-overlay", "aria-hidden": "true", children: o.map((a) => {
    const s = a.highlight.pageSize.width;
    return /* @__PURE__ */ L("div", { className: "reader-edited-block", "data-reader-edited-id": a.itemId, children: [
      /* @__PURE__ */ p(
        ka,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: De(a.highlight.region),
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
const qu = yn(Ju), Ia = 24, it = Ia * 2 + 4, Qe = 24, Gu = 4, Xu = 6, bt = (e) => e.left + e.width, ft = (e) => e.top + e.height;
function Wt(e, t) {
  const n = Math.min(bt(e), bt(t)) - Math.max(e.left, t.left), r = Math.min(ft(e), ft(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const Yr = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= bt(t) && r >= t.top && r <= ft(t);
}, Zu = (e) => e.height > 40 && e.height > e.width * 2.5;
function Yu(e, t, n) {
  if (!t.length || e.height < Qe || e.width < n + 8) return null;
  const r = Math.max(...t.map(ft)), o = bt(e) - 4 - n;
  for (const a of [r, ft(e) - 2]) {
    const s = Math.max(e.top, a - Qe), i = { left: o, top: s, width: n, height: Qe };
    if (!t.some((l) => Wt(i, l) > 0)) return s - e.top;
  }
  return null;
}
function Qu(e, t) {
  const n = [], r = (a) => {
    const s = Ia + Gu, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: bt(e), top: i, width: s, height: it } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: it } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - Qe - 3, width: it, height: Qe + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: ft(e), width: it, height: Qe + 3 } }), r(!0);
  const o = Yu(e, t, it);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: bt(e) - 4 - it, top: e.top + o, width: it, height: Qe } }), n;
}
function ed(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((v) => v.width > 0 && v.height > 0 && !Zu(v)), i = s.filter((v) => Yr(v, t)), l = s.filter((v) => !Yr(v, t)), c = n.filter((v) => v !== t && Wt(v, t) < t.width * t.height * 0.5), u = Qu(t, i).filter(({ box: v, overhang: g }) => {
    const y = g ? Xu : 0;
    return v.left >= -y && bt(v) <= r + y && v.top >= 0 && ft(v) <= o;
  }), f = ({ placement: v, tailTop: g }) => g === void 0 ? { placement: v } : { placement: v, tailTop: g }, d = ({ box: v }) => !l.some((g) => Wt(v, g) > 0), h = u.filter((v) => v.placement !== "tail"), b = h.find((v) => d(v) && !c.some((g) => Wt(v.box, g) > 0));
  if (b) return f(b);
  const m = h.find(d) || u.find((v) => v.placement === "tail" && d(v));
  if (m) return f(m);
  let w = null, k = Number.POSITIVE_INFINITY;
  for (const v of u) {
    const g = l.reduce((y, S) => y + Wt(v.box, S), 0);
    g < k && (w = v, k = g);
  }
  return w ? f(w) : { placement: "outside" };
}
function td(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - Qe - 3 : ft(r);
  return t >= r.left - 4 && t <= r.left + it + 4 && n >= a && n <= a + Qe + 3;
}
const Pn = (e) => e.left + e.width, Tn = (e) => e.top + e.height;
function nd(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const c of t) {
    if (c.width <= 0 || c.height <= 0) continue;
    const u = c.left + c.width / 2, f = c.top + c.height / 2;
    u < e.left || u > Pn(e) || f < e.top || f > Tn(e) || (o = Math.min(o, c.left), a = Math.min(a, c.top), s = Math.max(s, Pn(c)), i = Math.max(i, Tn(c)));
  }
  if (!Number.isFinite(o)) return e;
  const l = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return l.width = Math.min(Pn(e) + r, s + n) - l.left, l.height = Math.min(Tn(e) + r, i + n) - l.top, l.width * l.height < e.width * e.height * 0.3 && l.height < 24 ? e : l;
}
function rd(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function od(e, t, n, r) {
  const [o, a] = T(null);
  return Pe(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? rd(s) : [], l = De(t.highlight.region) === "figure", c = i.length && !l ? nd(t.rect, i) : t.rect, u = n.filter((d) => d.itemId !== t.itemId).map((d) => d.rect), f = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: c, ...ed({ frame: c, others: u, pageWidth: r, pageHeight: f, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
const Ra = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], Qr = { pen: 35e-4, highlighter: 0.018 }, eo = 0.015, Kn = "retainpdf.reader.ink.v1:";
function to(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(Kn + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function ad(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(Kn + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(Kn + e);
    } catch {
    }
}
function sd(e, t, n, r, o, a) {
  const s = eo * eo;
  return e.filter((i) => Ea(i, t, n) && i.points.some(([l, c]) => (l - r) ** 2 + ((c - o) * a) ** 2 <= s)).map((i) => i.id);
}
function Ea(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function id(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function ld(e) {
  const [t, n] = T(null), [r, o] = T(Ra[0].key), [a, s] = T(() => to(e)), i = M(a), l = M([]);
  C(() => {
    const m = to(e);
    i.current = m, s(m), l.current = [];
  }, [e]);
  const c = D((m) => {
    i.current = m, s(m), ad(e, m);
  }, [e]), u = D((m) => {
    const w = i.current, k = m(w);
    k !== w && (l.current = [...l.current.slice(-49), w], c(k));
  }, [c]), f = D((m) => {
    m.points.length < 1 || u((w) => [...w, { ...m, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [u]), d = D((m) => {
    m.length && u((w) => w.filter((k) => !m.includes(k.id)));
  }, [u]), h = D((m) => {
    u((w) => w.some((k) => k.page === m) ? w.filter((k) => k.page !== m) : w);
  }, [u]), b = D(() => {
    const m = l.current.pop();
    m && c(m);
  }, [c]);
  return J(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: d, undo: b, clearPage: h }),
    [t, r, a, f, d, b, h]
  );
}
const cd = "reader-ink-layer";
function ud(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function no({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: ud(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function dd({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = T(null), i = M(!1), l = o.strokes.filter((m) => Ea(m, e, t)), c = !!o.tool;
  if (!c && !l.length) return null;
  const u = (m) => {
    const w = m.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (m.clientX - w.left) / Math.max(1, w.width))),
      Math.min(1, Math.max(0, (m.clientY - w.top) / Math.max(1, w.height)))
    ];
  }, f = (m, w) => o.erase(sd(o.strokes, e, t, m, w, r / Math.max(1, n))), d = (m) => {
    if (!o.tool || m.button !== 0) return;
    m.preventDefault(), m.stopPropagation(), m.currentTarget.setPointerCapture(m.pointerId), i.current = !0;
    const [w, k] = u(m);
    o.tool === "eraser" ? f(w, k) : s([[w, k]]);
  }, h = (m) => {
    if (!i.current || !o.tool) return;
    m.stopPropagation();
    const [w, k] = u(m);
    o.tool === "eraser" ? f(w, k) : s((v) => v ? id(v, w, k) : [[w, k]]);
  }, b = (m) => {
    i.current && (i.current = !1, m.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: Qr[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ L(
    "svg",
    {
      className: cd,
      "data-ink-active": c ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: d,
      onPointerMove: h,
      onPointerUp: b,
      onPointerCancel: b,
      children: [
        l.map((m) => /* @__PURE__ */ p(no, { stroke: m, width: n, height: r }, m.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(no, { stroke: { tool: o.tool, color: o.color, width: Qr[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
function fd({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = T(null), [i, l] = T(!1), [c, u] = T([]), [f, d] = T(""), [h, b] = T(""), [m, w] = T(!1), [k, v] = T(null), [g, y] = T([]), S = r.drafts, E = r.generation, N = D(async (I, R) => {
    if (e)
      try {
        u(du(await e.fetchRevisions(I, R)));
      } catch {
        u([]);
      }
  }, [e]);
  C(() => {
    if (s(null), u([]), v(null), y([]), b(""), !e || !t || !n) return;
    let I = !1;
    return l(!0), e.loadItem(t, n).then((R) => {
      if (I) return;
      const P = R == null ? void 0 : R.item;
      if (!P) throw new Error("找不到这一段的译文。");
      const _ = `${(R == null ? void 0 : R.item_id) || n}`, { source: x, translated: H } = cu(P);
      s({ readerItemId: n, itemId: _, source: x, current: H }), d(S.get(n) ?? H);
    }).catch((R) => {
      I || v({ tone: "error", message: (R == null ? void 0 : R.message) || "读取这段译文失败。" });
    }).finally(() => {
      I || l(!1);
    }), N(t, n), () => {
      I = !0;
    };
  }, [e, t, n, N]);
  const z = D((I) => {
    d(I), n && S.set(n, I);
  }, [n, S]), $ = D(async (I, R) => {
    if (!e || !a || m) return !1;
    const P = I ?? f;
    if (!P.trim()) return !1;
    w(!0), v(null), y([]);
    try {
      const _ = await e.revise(t, a.itemId, {
        translated_text: P,
        source: "user",
        reason: (R ?? h).trim() || "在阅读页手动修改",
        ...E.current != null ? { expected_generation: E.current } : {}
      }), x = Number(_ == null ? void 0 : _.generation);
      return Number.isFinite(x) && (E.current = x), S.delete(a.readerItemId), s({ ...a, current: P }), d(P), b(""), (_ == null ? void 0 : _.changed) === !1 ? v({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, P), v({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), N(t, a.readerItemId), !0;
    } catch (_) {
      const x = _;
      return (x == null ? void 0 : x.reason) === "generation_mismatch" && (E.current = null), v({ tone: "error", message: (x == null ? void 0 : x.message) || "保存失败，请稍后再试。" }), y(gu(x == null ? void 0 : x.issues)), !1;
    } finally {
      w(!1);
    }
  }, [e, a, m, f, h, t, o, N, S, E]), A = D(() => {
    n && S.delete(n);
  }, [n, S]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: c,
    draft: f,
    setDraft: z,
    reason: h,
    setReason: b,
    saving: m,
    status: k,
    issues: g,
    save: $,
    discardDraft: A
  };
}
const Pa = "reader-inline-edit";
function hd({ text: e }) {
  const [t, n] = T("");
  return C(() => {
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
  }, [e]), t ? /* @__PURE__ */ L("div", { className: "reader-inline-edit-preview", "data-inline-edit-preview": "true", children: [
    /* @__PURE__ */ p("span", { className: "reader-inline-edit-preview-label", children: "预览" }),
    /* @__PURE__ */ p("div", { className: "reader-live-translation-content", dangerouslySetInnerHTML: { __html: t } })
  ] }) : null;
}
function md({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var A;
  const s = e.itemId, i = fd({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [l, c] = T(!1), [u, f] = T(!1), d = M(null), h = ku(e.rect, t), b = J(() => vu(o), [o]), m = b.indexOf(s), { loaded: w } = i, k = i.saving || i.loading, v = n.blockedReason, g = !w || i.draft === w.current, { close: y, select: S } = n, E = D((I) => {
    const R = b[m + I];
    R && (S(R), a == null || a(R));
  }, [b, m, S, a]), N = D(() => {
    i.discardDraft(), y();
  }, [i, y]), z = D(async (I, R) => {
    await i.save(I, R) && y();
  }, [i, y]);
  C(() => {
    const I = (R) => {
      !R.altKey || R.key !== "ArrowUp" && R.key !== "ArrowDown" || (R.preventDefault(), E(R.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", I), () => window.removeEventListener("keydown", I);
  }, [E]), Pe(() => {
    const I = d.current;
    if (!I) return;
    I.style.height = "auto";
    const R = h.mode === "inline" ? h.minHeight : 0;
    I.style.height = `${Math.max(R, I.scrollHeight + 2)}px`;
  }, [i.draft, w, h.mode, h.mode === "inline" ? h.minHeight : 0]);
  const $ = h.mode === "inline" ? { left: h.left, top: h.top, width: h.width } : { left: h.left, width: h.width, top: h.top, bottom: h.bottom };
  return /* @__PURE__ */ L(St, { children: [
    h.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ L(
      "div",
      {
        className: `${Pa} is-${h.mode}`,
        style: $,
        role: "group",
        "aria-label": `改第 ${((A = n.target) == null ? void 0 : A.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": h.mode,
        onPointerDown: (I) => I.stopPropagation(),
        children: [
          r && (w != null && w.source) ? /* @__PURE__ */ p(
            X,
            {
              className: `reader-inline-edit-source${l ? " is-open" : ""}`,
              "data-block-edit-source": "true",
              title: l ? "收起原文" : "展开原文",
              onClick: () => c((I) => !I),
              children: w.source
            }
          ) : null,
          v ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: v }) : null,
          i.loading ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          w ? /* @__PURE__ */ p(
            Js,
            {
              ref: d,
              id: "reader-block-edit-text",
              className: "reader-inline-edit-text",
              rows: 2,
              value: i.draft,
              disabled: k || !!v,
              "aria-label": "译文",
              autoFocus: !0,
              onChange: (I) => i.setDraft(I.target.value),
              onKeyDown: (I) => {
                I.key === "Enter" && (I.metaKey || I.ctrlKey) ? (I.preventDefault(), g || z()) : I.key === "Escape" && (I.preventDefault(), N());
              }
            }
          ) : null,
          w ? /* @__PURE__ */ p(hd, { text: i.draft }) : null,
          /* @__PURE__ */ L("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(gt, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: m <= 0, onClick: () => E(-1), children: /* @__PURE__ */ p(Is, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(gt, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: m < 0 || m >= b.length - 1, onClick: () => E(1), children: /* @__PURE__ */ p(Ho, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              Jo,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: k || !!v || !w,
                onChange: (I) => i.setReason(I.target.value),
                onKeyDown: (I) => {
                  I.key === "Enter" ? (I.preventDefault(), g || z()) : I.key === "Escape" && (I.preventDefault(), N());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ L(
              X,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": u,
                "data-block-edit-action": "history",
                onClick: () => f((I) => !I),
                children: [
                  /* @__PURE__ */ p(Rs, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ p(X, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: N, children: "取消" }),
            /* @__PURE__ */ p(
              X,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: k || !!v || g || !i.draft.trim(),
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
          u && w && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((I, R) => {
            const P = I.text === w.current, _ = [fu(I.ts), I.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ L("li", { "data-block-edit-history": I.label, "data-current": P ? "true" : void 0, children: [
              /* @__PURE__ */ L("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ L("span", { children: [
                  _,
                  P ? "（现在用的）" : "",
                  I.reason ? ` · ${I.reason}` : ""
                ] }),
                P ? null : /* @__PURE__ */ p(
                  X,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: k || !!v,
                    onClick: () => {
                      z(I.text, `回到「${_.replace(" · ", " ")}」那一版`);
                    },
                    children: "用这版"
                  }
                )
              ] }),
              /* @__PURE__ */ p("p", { className: "reader-inline-edit-history-text", children: I.text })
            ] }, `${I.ts}:${R}`);
          }) }) : null
        ]
      }
    )
  ] });
}
const Ta = Zn(null), Ma = Zn(null);
function pd({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(Ta.Provider, { value: e, children: /* @__PURE__ */ p(Ma.Provider, { value: t, children: n }) });
}
function rt() {
  return Yn(Ta);
}
function Na() {
  return Yn(Ma);
}
const Aa = 1.414;
function gd({
  pageNumber: e,
  width: t,
  devicePixelRatio: n,
  pane: r,
  active: o = !1,
  textLayer: a = !0,
  syncedMinHeight: s = 0,
  onMetrics: i,
  cachedAspect: l,
  onAspectChange: c,
  sentinelRef: u,
  regionHighlight: f = null,
  regionTargets: d = [],
  hoveredRegionId: h,
  onHoverRegion: b,
  liveTranslationLayout: m,
  liveTranslationPage: w,
  showLiveTranslation: k = r === "source",
  liveTranslationMissing: v = !1
}) {
  var oe, de, ge;
  const g = rt(), y = g == null ? void 0 : g.revisedBlocks, S = g == null ? void 0 : g.blockEdit, E = S == null ? void 0 : S.pendingEdits, N = g == null ? void 0 : g.editBlock, z = (g == null ? void 0 : g.findTerm) || "", $ = g == null ? void 0 : g.xrefIndex, A = J(
    () => $ != null && $.size ? ({ str: B }) => au(B, $, z) : z ? ({ str: B }) => Ht(B, z) : void 0,
    [z, $]
  ), I = M(l ?? Aa), [R, P] = T(I.current);
  C(() => {
    l != null && Math.abs(l - I.current) >= 1e-3 && (I.current = l, P(l));
  }, [l]);
  const _ = M(u);
  _.current = u;
  const x = M(null), H = M((B) => {
    var q;
    x.current = B, (q = _.current) == null || q.call(_, B);
  }).current, F = M(null), G = M(`${t}@${n}`);
  Pe(() => {
    const B = `${t}@${n}`;
    G.current !== B && (G.current = B, o && yd(x.current, F.current));
  }, [o, n, t]), C(() => {
    o || Mn(F.current);
  }, [o]), C(() => () => Mn(F.current), []);
  const Z = Math.max(120, Math.floor(t * R)), ae = Math.max(Z, Math.ceil(s || 0)), se = zt(f, t, Z), ce = J(
    () => Ru(d, t, Z),
    [Z, d, t]
  ), [ue, le] = T(null), Ce = typeof b == "function", te = Ce ? h ?? null : ue, re = (B) => {
    Ce ? B !== (h ?? null) && (b == null || b(B)) : le((q) => q === B ? q : B);
  }, fe = J(
    () => ce.find((B) => B.itemId === te) || null,
    [te, ce]
  ), ve = r === "translated" && ((oe = S == null ? void 0 : S.target) == null ? void 0 : oe.itemId) || "", Se = J(
    () => ve && ce.find((B) => B.itemId === ve) || null,
    [ve, ce]
  ), pe = od(x, o ? fe : null, ce, t), Ve = (B) => {
    var Me, $e, Ne, Fe, we;
    if (B.pointerType === "touch") return;
    if ((Me = g == null ? void 0 : g.ink) != null && Me.tool) {
      re(null);
      return;
    }
    if (B.buttons !== 0) {
      re(null);
      return;
    }
    if ((Ne = ($e = B.target) == null ? void 0 : $e.closest) != null && Ne.call($e, `.${wa}`) || (we = (Fe = B.target) == null ? void 0 : Fe.closest) != null && we.call(Fe, `.${Pa}`)) return;
    const q = B.currentTarget.getBoundingClientRect(), ee = B.clientX - q.left, Oe = B.clientY - q.top;
    if (td(pe, ee, Oe)) return;
    const Te = Zr(ce, ee, Oe);
    re((Te == null ? void 0 : Te.itemId) || null);
  }, Je = (B) => {
    if (B.pointerType === "mouse") return;
    const q = B.currentTarget.getBoundingClientRect(), ee = Zr(
      ce,
      B.clientX - q.left,
      B.clientY - q.top
    );
    re((ee == null ? void 0 : ee.itemId) || null);
  }, ze = (B) => {
    !Number.isFinite(B) || B <= 0 || Math.abs(I.current - B) < 1e-3 || (I.current = B, P(B), c == null || c(e, B));
  };
  return /* @__PURE__ */ L(
    "div",
    {
      ref: H,
      [Ee]: e,
      [Ie]: r,
      [tr]: Z,
      className: nr,
      onPointerMoveCapture: Ve,
      onPointerDown: Je,
      onDoubleClick: (B) => {
        var ee;
        const q = g == null ? void 0 : g.zoomBlock;
        !q || (ee = g == null ? void 0 : g.ink) != null && ee.tool || !fe || De(fe.highlight.region) === "figure" && (B.preventDefault(), q(fe.itemId));
      },
      onPointerLeave: (B) => {
        B.pointerType === "mouse" && re(null);
      },
      style: {
        width: t,
        height: ae,
        minHeight: ae
      },
      children: [
        o ? /* @__PURE__ */ p(
          Gs,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: A,
            renderAnnotationLayer: !1,
            className: Qo,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: fn,
                style: { width: t, height: Z }
              }
            ),
            onLoadSuccess: (B) => {
              try {
                const q = B.getViewport({ scale: 1 });
                if (q.width > 0) {
                  const ee = q.height / q.width;
                  ze(ee);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              Mn(F.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ p(
          "div",
          {
            className: fn,
            style: { width: t, height: Z },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: F, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        se ? /* @__PURE__ */ p(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: se,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && k ? /* @__PURE__ */ p(
          Vu,
          {
            layoutPage: m,
            pageState: w,
            width: t,
            height: Z
          }
        ) : null,
        o && k && v ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (E != null && E.size) ? /* @__PURE__ */ p(qu, { targets: ce, edits: E, width: t, excludeId: Se == null ? void 0 : Se.itemId }) : null,
        o && Se && S ? /* @__PURE__ */ p(
          md,
          {
            target: Se,
            page: { width: t, height: Z },
            edit: S,
            showSource: !!(g != null && g.editShowsSource),
            regions: g == null ? void 0 : g.regions,
            jumpToBlock: g == null ? void 0 : g.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (y != null && y.size) ? /* @__PURE__ */ p("div", { className: "reader-revised-markers", "aria-hidden": "true", children: ce.filter((B) => y.has(B.itemId)).map((B) => /* @__PURE__ */ p(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": B.itemId,
            style: { left: B.rect.left, top: B.rect.top, height: B.rect.height }
          },
          B.itemId
        )) }) : null,
        o && (g != null && g.ink) ? /* @__PURE__ */ p(
          dd,
          {
            page: e,
            pane: r === "translated" ? "translated" : g.compareVersion ? "compare" : "source",
            width: t,
            height: Z,
            ink: g.ink
          }
        ) : null,
        (de = g == null ? void 0 : g.askMarks) != null && de.length && g.onAskMark ? /* @__PURE__ */ p(zc, { marks: g.askMarks, page: e, height: Z, onOpen: g.onAskMark }) : null,
        /* @__PURE__ */ p(
          Cu,
          {
            target: o && !((ge = g == null ? void 0 : g.ink) != null && ge.tool) && (fe == null ? void 0 : fe.itemId) !== (Se == null ? void 0 : Se.itemId) ? fe : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: fe && (y == null ? void 0 : y.get(fe.itemId)) || 0,
            onEdit: N,
            onZoom: g == null ? void 0 : g.zoomBlock,
            frameRect: pe == null ? void 0 : pe.rect,
            placement: pe == null ? void 0 : pe.placement,
            tailTop: pe == null ? void 0 : pe.tailTop
          }
        )
      ]
    }
  );
}
const bd = yn(gd);
function yd(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function Mn(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const vd = 2 * 1024 * 1024;
function wd(e) {
  const t = new qo.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const Nn = 5, Sd = "120% 0px", kd = 120, Id = "25% 0px";
let ro = 1;
const oo = /* @__PURE__ */ new WeakMap();
function Rd(e) {
  if (!e) return 0;
  const t = oo.get(e);
  if (t) return t;
  const n = ro;
  return ro += 1, oo.set(e, n), n;
}
function Ed() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Pd = zo(
  function({
    pane: t,
    url: n = "",
    preloadedFile: r = null,
    userZoom: o = 1,
    visible: a = !0,
    emptyLabel: s = "暂无 PDF",
    scrollRoot: i = null,
    pageWidthOverride: l = null,
    rowHeights: c,
    onMetrics: u,
    onLoadSuccess: f,
    onOutline: d,
    onDocument: h,
    onLoadError: b,
    onNumPagesChange: m,
    activeRegion: w = null,
    regions: k = [],
    readerMetadata: v = null,
    hoveredRegionId: g = null,
    onHoverRegion: y,
    liveTranslation: S,
    showLiveTranslation: E = t === "source",
    liveTranslationPendingLabel: N = "",
    paneAction: z
  }, $) {
    Cc();
    const { file: A, loading: I, error: R } = Di(n, r), P = `${n}\0${Rd(A)}`, _ = M(P);
    _.current = P;
    const x = J(() => {
      const O = Mi(A);
      return O ? "ranged" in O ? { range: wd(O.ranged) } : O : null;
    }, [A, n]), [H, F] = T(0), [G, Z] = T(""), [ae, se] = T(null), [ce, ue] = T(480), le = M(null), Ce = M(0), te = J(() => Ed(), []), re = J(() => ({
      cMapUrl: Xt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: Xt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: vd,
      disableAutoFetch: !0
    }), []);
    Qn($, () => ae, [ae]), C(() => {
      const O = (K) => {
        Ce.current = K, ue(K);
      }, W = (K) => {
        const ne = nl(K, Ce.current);
        if (ne !== "ignore") {
          if (le.current && clearTimeout(le.current), ne === "immediate") {
            O(K);
            return;
          }
          le.current = setTimeout(() => O(K), oa);
        }
      }, V = !!(l && l >= 80);
      W(V ? l : (i == null ? void 0 : i.clientWidth) || 0);
      const Q = !V && i && typeof ResizeObserver < "u" ? new ResizeObserver((K) => {
        var ne, be;
        W(((be = (ne = K[0]) == null ? void 0 : ne.contentRect) == null ? void 0 : be.width) ?? i.clientWidth);
      }) : null;
      return Q && i && Q.observe(i), () => {
        Q == null || Q.disconnect(), le.current && clearTimeout(le.current);
      };
    }, [l, i, a]);
    const fe = J(
      () => Qi(ce, o),
      [ce, o]
    ), [ve, Se] = T(() => /* @__PURE__ */ new Map()), [pe, Ve] = T(() => /* @__PURE__ */ new Set()), [Je, ze] = T(() => /* @__PURE__ */ new Set()), oe = M(/* @__PURE__ */ new Map()), de = M(null), ge = M(null), [B, q] = T(() => /* @__PURE__ */ new Set()), ee = M(/* @__PURE__ */ new Map()), Oe = D((O, W) => {
      Se((V) => {
        if (V.get(O) === W) return V;
        const Y = new Map(V);
        return Y.set(O, W), Y;
      });
    }, []), Te = D((O, W) => {
      const V = oe.current, Y = V.get(O), Q = [de.current, ge.current];
      if (Y)
        for (const K of Q)
          try {
            K == null || K.unobserve(Y);
          } catch {
          }
      if (W) {
        V.set(O, W);
        for (const K of Q)
          try {
            K == null || K.observe(W);
          } catch {
          }
      } else
        V.delete(O);
    }, []), Me = M(/* @__PURE__ */ new Map()), $e = D((O) => {
      const W = Me.current;
      let V = W.get(O);
      return V || (V = (Y) => Te(O, Y), W.set(O, V)), V;
    }, [Te]);
    C(() => {
      if (typeof IntersectionObserver > "u") return;
      const O = ee.current, W = new IntersectionObserver(
        (V) => {
          const Y = [], Q = [];
          for (const K of V) {
            const ne = K.target, be = mn(ne);
            Number.isFinite(be) && (K.isIntersecting ? Y : Q).push(be);
          }
          if ((Y.length || Q.length) && Ve((K) => {
            let ne = null;
            for (const be of Y)
              K.has(be) || (ne = ne || new Set(K), ne.add(be));
            for (const be of Q)
              K.has(be) && (ne = ne || new Set(K), ne.delete(be));
            return ne || K;
          }), Y.length) {
            for (const K of Y) {
              const ne = O.get(K);
              ne && (clearTimeout(ne), O.delete(K));
            }
            ze((K) => {
              let ne = null;
              for (const be of Y)
                K.has(be) || (ne = ne || new Set(K), ne.add(be));
              return ne || K;
            });
          }
          for (const K of Q)
            O.has(K) || O.set(K, setTimeout(() => {
              O.delete(K), ze((ne) => {
                if (!ne.has(K)) return ne;
                const be = new Set(ne);
                return be.delete(K), be;
              });
            }, kd));
        },
        { root: i, rootMargin: Sd, threshold: 0 }
      );
      de.current = W;
      for (const V of oe.current.values())
        try {
          W.observe(V);
        } catch {
        }
      return () => {
        W.disconnect(), de.current === W && (de.current = null);
        for (const V of O.values()) clearTimeout(V);
        O.clear();
      };
    }, [i]), C(() => {
      if (typeof IntersectionObserver > "u") return;
      const O = new IntersectionObserver(
        (W) => {
          q((V) => {
            let Y = null;
            for (const Q of W) {
              const K = mn(Q.target);
              !Number.isFinite(K) || Q.isIntersecting === V.has(K) || (Y = Y || new Set(V), Q.isIntersecting ? Y.add(K) : Y.delete(K));
            }
            return Y || V;
          });
        },
        { root: i, rootMargin: Id, threshold: 0 }
      );
      ge.current = O;
      for (const W of oe.current.values())
        try {
          O.observe(W);
        } catch {
        }
      return () => {
        O.disconnect(), ge.current === O && (ge.current = null);
      };
    }, [i]);
    const Ne = !!i && typeof IntersectionObserver < "u";
    Pe(() => {
      F(0), Z(""), Ve(/* @__PURE__ */ new Set()), ze(/* @__PURE__ */ new Set()), Se(/* @__PURE__ */ new Map()), oe.current.clear();
      const O = ee.current;
      for (const W of O.values()) clearTimeout(W);
      O.clear(), m == null || m(0, t);
    }, [P, m, t]);
    const Fe = D(
      (O) => {
        if (_.current !== P) return;
        const W = O.numPages;
        F(W), Z(""), m == null || m(W, t), f == null || f({ numPages: W, pane: t }), h && typeof O.getPage == "function" && h(O, t), d && typeof O.getOutline == "function" && Dc(O).then((V) => {
          _.current === P && d(V, t);
        }, () => {
        });
      },
      [P, f, d, h, m, t]
    ), we = D(
      (O) => {
        if (_.current !== P) return;
        const W = (O == null ? void 0 : O.message) || "PDF 解析失败";
        Z(W), F(0), m == null || m(0, t), b == null || b(O, t);
      },
      [P, b, m, t]
    ), Ae = J(
      () => H > 0 ? Array.from({ length: H }, (O, W) => W + 1) : [],
      [H]
    );
    C(() => {
      typeof IntersectionObserver < "u" || ze(new Set(Ae));
    }, [Ae]);
    const je = J(
      () => Gt(w, v, t),
      [w, v, t]
    ), qe = J(() => {
      const O = /* @__PURE__ */ new Map();
      for (const W of k) {
        const V = Gt(W, v, t);
        if (!V) continue;
        const Y = O.get(V.box.page) || [];
        Y.push(V), O.set(V.box.page, Y);
      }
      return O;
    }, [t, v, k]), He = J(() => {
      const O = /* @__PURE__ */ new Set();
      if (!g) return O;
      for (const [W, V] of qe)
        V.some((Y) => Y.itemId === g) && O.add(W);
      return O;
    }, [g, qe]), Le = J(() => {
      if (H === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(Ae);
      if (pe.size === 0) {
        const V = Math.min(H, Nn * 2 + 1);
        return new Set(Array.from({ length: V }, (Y, Q) => Q + 1));
      }
      const W = /* @__PURE__ */ new Set();
      for (const V of pe)
        for (let Y = -Nn; Y <= Nn; Y++) {
          const Q = V + Y;
          Q >= 1 && Q <= H && W.add(Q);
        }
      return W;
    }, [H, Ae, i, a, pe]), ot = !n || !!R || !!G, ht = n && (R || G) || s;
    return /* @__PURE__ */ L(
      "section",
      {
        ref: se,
        className: `reader-panel ${vn}${a ? "" : " is-hidden"}`,
        [Ie]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (S == null ? void 0 : S.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          z ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: z }) : null,
          N ? /* @__PURE__ */ L("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: N })
          ] }) : null,
          ot && !I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: ht }) : null,
          I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          x && !R ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            Xs,
            {
              file: x,
              loading: null,
              error: null,
              options: re,
              onLoadSuccess: Fe,
              onLoadError: we,
              className: "reader-react-pdf-document",
              children: Ae.map((O) => {
                if (Le.has(O))
                  return /* @__PURE__ */ p(
                    bd,
                    {
                      pane: t,
                      pageNumber: O,
                      width: fe,
                      devicePixelRatio: te,
                      active: Je.has(O),
                      textLayer: !Ne || B.has(O),
                      syncedMinHeight: (c == null ? void 0 : c.get(O)) || 0,
                      onMetrics: u,
                      cachedAspect: ve.get(O),
                      onAspectChange: Oe,
                      sentinelRef: $e(O),
                      regionHighlight: (je == null ? void 0 : je.box.page) === O ? je : null,
                      regionTargets: qe.get(O),
                      hoveredRegionId: g && He.has(O) ? g : null,
                      onHoverRegion: y,
                      liveTranslationLayout: S == null ? void 0 : S.layoutByPage.get(O - 1),
                      liveTranslationPage: S == null ? void 0 : S.pagesByPage.get(O - 1),
                      showLiveTranslation: E,
                      liveTranslationMissing: oc(S, O - 1)
                    },
                    `${t}-${O}`
                  );
                const V = ve.get(O) ?? Aa, Y = Math.max(120, Math.floor(fe * V)), Q = Math.max(Y, Math.ceil((c == null ? void 0 : c.get(O)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: $e(O),
                    [Ee]: O,
                    [Ie]: t,
                    [tr]: Y,
                    className: `${nr} is-placeholder`,
                    style: {
                      width: fe,
                      height: Q,
                      minHeight: Q
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: fn,
                        style: { width: fe, height: Y },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${O}`
                );
              })
            },
            P
          ) }) : null
        ]
      }
    );
  }
), ao = yn(Pd), Td = 2e3, Md = 6, Nd = 500, so = "reader-react-resizing";
function Ad(e, t) {
  const n = M(null), r = M(null);
  Pe(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const y = Ld(e), S = Vt(e, y);
      if (!S) return;
      s = { pane: y, progress: S, started: performance.now() };
    }
    const { pane: i, progress: l, started: c } = s;
    let u = 0, f = null, d = e.scrollHeight, h = d, b = 0, m = c;
    const w = /* @__PURE__ */ new WeakMap(), k = typeof ResizeObserver > "u" ? null : new ResizeObserver((y) => {
      let S = !1;
      for (const E of y) {
        const N = Math.round(E.contentRect.height);
        w.has(E.target) && w.get(E.target) !== N && (S = !0), w.set(E.target, N);
      }
      S && xt(e, l, "auto", i);
    }), v = () => {
      var y;
      f && clearTimeout(f), cancelAnimationFrame(u), k == null || k.disconnect(), e.classList.remove(so);
      for (const S of io) e.removeEventListener(S, v);
      ((y = r.current) == null ? void 0 : y.stop) === v && (r.current = null);
    }, g = () => {
      xt(e, l, "auto", i);
      const y = e.scrollHeight;
      b = y === h ? b + 1 : 0, h = y;
      const S = performance.now() - m;
      b >= Md && (y !== d || S > Nd) || S > Td ? v() : u = requestAnimationFrame(g);
    };
    for (const y of io) e.addEventListener(y, v, { passive: !0 });
    for (const y of Array.from(e.children)) k == null || k.observe(y);
    e.classList.add(so), r.current = { ...s, stop: v }, f = setTimeout(() => {
      f = null, m = performance.now(), d = e.scrollHeight, h = d, b = 0, u = requestAnimationFrame(g);
    }, oa);
  }, [e, t]), C(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Ld(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Ee}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(Ie) || null;
  }
  return null;
}
const io = ["wheel", "touchstart", "keydown", "pointerdown"];
function _d(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function xd(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(vn)) && ((n = e.hasAttribute) != null && n.call(e, Ie)));
}
function Dd(e, t) {
  C(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!xd(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${vn}[${Ie}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const l = _d(a, i);
        if (l === null || Math.abs(i.scrollLeft - l) < 1) continue;
        const c = i.scrollLeft;
        i.scrollLeft = l, Math.abs(i.scrollLeft - c) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function Cd(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), l = t - i, c = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: l * c };
}
function zd(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const lo = 12;
function ir(e) {
  return Array.from(e.querySelectorAll(`.${vn}[${Ie}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function Od(e) {
  const t = e.getBoundingClientRect();
  return ir(e).map((n) => {
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
function $d(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function Fd(e, t) {
  return e ? ir(e).find((n) => n.getAttribute(Ie) === t) ?? null : null;
}
function Bd({ shellEl: e }) {
  const [t, n] = T([]), r = M(0), o = D(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = Od(e);
      n((i) => $d(i, s) ? i : s);
    }));
  }, [e]);
  C(() => {
    if (!e) return;
    o();
    const s = e.ownerDocument.defaultView;
    e.addEventListener("scroll", o, { capture: !0, passive: !0 });
    const i = s && typeof s.ResizeObserver < "u" ? new s.ResizeObserver(o) : null, l = () => {
      if (i) {
        i.disconnect(), i.observe(e);
        for (const f of ir(e))
          i.observe(f), f.firstElementChild && i.observe(f.firstElementChild);
      }
    };
    l();
    const c = s && typeof s.MutationObserver < "u" ? new s.MutationObserver(() => {
      l(), o();
    }) : null, u = e.firstElementChild;
    return c && u && c.observe(u, { childList: !0, attributes: !0, attributeFilter: ["class"], subtree: !1 }), () => {
      e.removeEventListener("scroll", o, { capture: !0 }), i == null || i.disconnect(), c == null || c.disconnect(), r.current && cancelAnimationFrame(r.current), r.current = 0;
    };
  }, [e, o]);
  const a = t.filter((s) => s.scrollWidth - s.width > 1);
  return a.length ? /* @__PURE__ */ p("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ p(jd, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function jd({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - lo * 2), r = Cd(e, n), o = M(null);
  if (!r) return null;
  const a = (d) => {
    const h = Fd(t, e.pane);
    h && (h.scrollLeft = d);
  }, s = (d) => {
    var h, b;
    d.button === 0 && (d.preventDefault(), d.stopPropagation(), (b = (h = d.currentTarget).setPointerCapture) == null || b.call(h, d.pointerId), o.current = { startX: d.clientX, startScroll: e.scrollLeft, pointerId: d.pointerId });
  }, i = (d) => {
    const h = o.current;
    !h || h.pointerId !== d.pointerId || a(h.startScroll + zd(e, n, r.size, d.clientX - h.startX));
  }, l = (d) => {
    var h, b, m;
    ((h = o.current) == null ? void 0 : h.pointerId) === d.pointerId && (o.current = null, (m = (b = d.currentTarget).releasePointerCapture) == null || m.call(b, d.pointerId));
  }, c = (d) => {
    if (d.button !== 0 || d.target !== d.currentTarget) return;
    d.preventDefault();
    const h = d.currentTarget.getBoundingClientRect(), b = d.clientX - h.left, m = e.width * 0.8;
    a(e.scrollLeft + (b < r.offset ? -m : m));
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
      style: { left: e.left + lo, width: n },
      onPointerDown: c,
      children: /* @__PURE__ */ p(
        "div",
        {
          className: "reader-pane-scrollbar-thumb",
          style: { width: r.size, transform: `translateX(${r.offset}px)` },
          onPointerDown: s,
          onPointerMove: i,
          onPointerUp: l,
          onPointerCancel: l
        }
      )
    }
  );
}
function La(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Hd(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function Ud({ compare: e, onDone: t }) {
  return /* @__PURE__ */ L("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ p("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ p("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(
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
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: La(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(jo, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(Es, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ p("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ L("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ L(
        X,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ p(Ps, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ L(
        X,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ p(Ts, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function co({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = Hd(t), a = [e === "compare" ? "对比" : "正在读", r, La(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ L("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function Wd({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = T({ source: null, translated: null });
  return Pe(() => {
    if (!e) return;
    const a = () => {
      const i = e.getBoundingClientRect(), l = (c) => {
        const u = e.querySelector(`[${Ie}="${c}"]`), f = u == null ? void 0 : u.getBoundingClientRect();
        return f && f.width > 0 ? { x: Math.round(f.left + f.width / 2), top: Math.round(i.top + 14) } : null;
      };
      o({ source: l("source"), translated: l("translated") });
    };
    a();
    const s = typeof ResizeObserver > "u" ? null : new ResizeObserver(a);
    return s == null || s.observe(e), e.querySelectorAll(`[${Ie}]`).forEach((i) => s == null ? void 0 : s.observe(i)), window.addEventListener("resize", a), e.addEventListener("scroll", a, { passive: !0 }), () => {
      s == null || s.disconnect(), window.removeEventListener("resize", a), e.removeEventListener("scroll", a);
    };
  }, [e]), /* @__PURE__ */ L("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(co, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(co, { role: "reading", ...n }) }) : null
  ] });
}
const Kd = () => () => {
}, uo = () => null;
function Vd({
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
function qd(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Gd(e) {
  const t = rt(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", l = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, c = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), d = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, h = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? tn, b = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, m = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), w = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, k = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, v = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, g = (t == null ? void 0 : t.compareVersion) ?? null, y = (g == null ? void 0 : g.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", S = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", E = g ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, N = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, z = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), $ = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), A = t == null ? void 0 : t.onPdfOutline, I = t == null ? void 0 : t.onPdfDocument, R = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), P = e.regions ?? (t == null ? void 0 : t.regions) ?? [], _ = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), x = (t == null ? void 0 : t.regionHover) ?? null, [H, F] = T(null), G = Oo(
    x ? x.subscribe : Kd,
    x ? () => x.get().itemId : uo,
    x ? () => x.get().itemId : uo
  ), Z = x ? G : H, ae = D((le) => {
    x ? x.set(le, "pdf") : F(le);
  }, [x]), se = Vd({
    mode: s,
    compareMode: i,
    showSource: l,
    showTranslated: c,
    markdownSplit: n,
    overlayOnSource: u
  }), ue = Number.isFinite(b) && b > 0 ? Jd(
    b,
    n || r,
    typeof document > "u" ? b * 2 : document.documentElement.clientWidth
  ) : null;
  return Ad(d, ue), Dd(d, se.compareMode), /* @__PURE__ */ L(
    "div",
    {
      ref: f,
      className: Yo,
      "data-reader-region-count": P.length,
      "data-reader-structured-region-count": P.filter(bs).length,
      "data-reader-metadata-ready": _ ? "true" : "false",
      children: [
        /* @__PURE__ */ L(
          "main",
          {
            className: `${Zo} reader-mode-${se.mode}`,
            "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              w ? /* @__PURE__ */ p(
                ao,
                {
                  pane: "source",
                  url: y,
                  preloadedFile: E,
                  userZoom: h,
                  visible: se.showSource,
                  scrollRoot: d,
                  pageWidthOverride: ue,
                  rowHeights: se.compareMode ? m : void 0,
                  onMetrics: z,
                  emptyLabel: v ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: $,
                  onOutline: g ? void 0 : A,
                  onDocument: g ? void 0 : I,
                  activeRegion: R,
                  regions: (g == null ? void 0 : g.regions) ?? P,
                  readerMetadata: _,
                  hoveredRegionId: Z,
                  onHoverRegion: ae,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? qd(o) : "",
                  paneAction: u && se.showTranslated ? /* @__PURE__ */ L(St, { children: [
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
                g ? `compare:${g.url}` : "source"
              ) : null,
              k ? /* @__PURE__ */ p(
                ao,
                {
                  pane: "translated",
                  url: S,
                  preloadedFile: N,
                  userZoom: h,
                  visible: se.showTranslated,
                  scrollRoot: d,
                  pageWidthOverride: ue,
                  rowHeights: se.compareMode ? m : void 0,
                  onMetrics: z,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: $,
                  onOutline: A,
                  onDocument: I,
                  activeRegion: R,
                  regions: P,
                  readerMetadata: _,
                  hoveredRegionId: Z,
                  onHoverRegion: ae,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ p(Bd, { shellEl: d }),
        g ? /* @__PURE__ */ p(Wd, { shellEl: d, left: g.left, right: g.right }) : null
      ]
    }
  );
}
const Xd = [
  { id: "source", label: "原文", Icon: Uo },
  { id: "compare", label: "对照", Icon: Wo },
  { id: "translated", label: "译文", Icon: Ko }
];
function Zd(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function Yd(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function Qd(e) {
  const t = rt(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, l = a ? Zd(a.state) : "";
  return /* @__PURE__ */ L("header", { className: "reader-workspace-bar", children: [
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
    /* @__PURE__ */ L("div", { className: "reader-workspace-center", children: [
      /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Xd.map(({ id: c, label: u, Icon: f }) => {
        const d = n === c, h = Yd({
          id: c,
          documentReady: r,
          sourceViewOnly: i,
          liveTranslationAvailable: !!a
        });
        return /* @__PURE__ */ L(
          "button",
          {
            type: "button",
            className: `reader-workspace-tab${d ? " is-active" : ""}`,
            role: "tab",
            "aria-selected": d,
            "aria-label": u,
            title: h ? `${u} 需要文档任务` : u,
            disabled: h,
            onClick: () => o(c),
            children: [
              /* @__PURE__ */ p(f, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-workspace-tab-label", children: u })
            ]
          },
          c
        );
      }) }),
      a ? /* @__PURE__ */ L("div", { className: "reader-live-strip", children: [
        /* @__PURE__ */ L(
          "button",
          {
            type: "button",
            className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
            "aria-pressed": a.visible,
            "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
            title: a.state.error || `${l}，${a.visible ? "点一下看原文" : "点一下叠上译文"}`,
            onClick: a.onToggle,
            children: [
              /* @__PURE__ */ p(Ms, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: l })
            ]
          }
        ),
        a.latestPage && a.onJumpToLatest && a.latestPage !== a.currentPage ? /* @__PURE__ */ L(
          X,
          {
            className: "reader-live-translation-toggle reader-live-jump",
            "aria-label": `跳到最新译好的第 ${a.latestPage} 页`,
            title: `跳到最新译好的第 ${a.latestPage} 页`,
            onClick: a.onJumpToLatest,
            children: [
              /* @__PURE__ */ p(Ns, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "跳到最新" })
            ]
          }
        ) : null
      ] }) : s ? /* @__PURE__ */ p("div", { className: "reader-live-strip", children: /* @__PURE__ */ L(
        X,
        {
          className: "reader-live-translation-toggle is-done",
          title: "翻译完成，左右对照看最终译文",
          onClick: s.onOpenCompare,
          children: [
            /* @__PURE__ */ p(As, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
          ]
        }
      ) }) : null
    ] })
  ] });
}
const ef = zo(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
  return /* @__PURE__ */ L(
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
}), tf = ef, nf = {
  markdown: { label: "Markdown", short: "MD", Icon: tf, needsJob: !0 }
}, rf = aa.map(
  (e) => ({ id: e, ...nf[e] })
);
function _a() {
  return rf.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function of(e) {
  const t = rt(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(St, { children: _a().map(({ id: s, label: i, Icon: l, needsJob: c }) => {
    const u = n === s, f = c && r, d = u ? `收起${i}` : `打开${i}`;
    return /* @__PURE__ */ L(
      "button",
      {
        type: "button",
        className: "reader-panel-toggle",
        "aria-label": d,
        "aria-pressed": u,
        title: f ? `${i} 需打开任务阅读` : i,
        disabled: f,
        onClick: () => u ? a() : o(s),
        children: [
          /* @__PURE__ */ p(l, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
          /* @__PURE__ */ p("span", { className: "reader-panel-toggle-label", "aria-hidden": "true", children: i })
        ]
      },
      s
    );
  }) });
}
function af(e) {
  const t = rt(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = _a().map(({ id: l, label: c, short: u, Icon: f, needsJob: d }) => ({
    key: l,
    label: c,
    short: u,
    Icon: f,
    disabled: d && o,
    selected: n === l,
    badge: r == null ? void 0 : r[l],
    onClick: () => a(l)
  }));
  return n ? /* @__PURE__ */ L("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ p("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: l, label: c, Icon: u, disabled: f, selected: d, badge: h, onClick: b }) => /* @__PURE__ */ L(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": d,
        className: `reader-assistant-dock-tab${d ? " is-active" : ""}`,
        title: f ? `${c} 需打开任务阅读` : c,
        disabled: f,
        onClick: b,
        children: [
          /* @__PURE__ */ p(u, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
          /* @__PURE__ */ p("span", { className: "reader-assistant-dock-tab-label", children: c }),
          h ? /* @__PURE__ */ p("span", { className: "reader-assistant-dock-badge", children: h }) : null
        ]
      },
      l
    )) }),
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: "reader-assistant-dock-close",
        "aria-label": "关闭阅读辅助面板",
        title: "关闭辅助面板",
        onClick: s,
        children: /* @__PURE__ */ p(kt, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function sf(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function lf(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function cf(e) {
  return e / 100 * window.innerHeight;
}
function uf(e) {
  return e / 100 * window.innerWidth;
}
function df(e) {
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
  const [o, a] = df(n);
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
      r = lf(t, o);
      break;
    }
    case "em": {
      r = sf(t, o);
      break;
    }
    case "vh": {
      r = cf(o);
      break;
    }
    case "vw": {
      r = uf(o);
      break;
    }
  }
  return r;
}
function Re(e) {
  return parseFloat(e.toFixed(3));
}
function Dt({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function Vn(e) {
  const { panels: t } = e, n = Dt({ group: e });
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
      s = Re(u / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const u = Kt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = Re(u / n * 100);
    }
    let l = 0;
    if (a.minSize !== void 0) {
      const u = Kt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      l = Re(u / n * 100);
    }
    let c = 100;
    if (a.maxSize !== void 0) {
      const u = Kt({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      c = Re(u / n * 100);
    }
    return {
      groupResizeBehavior: a.groupResizeBehavior,
      collapsedSize: s,
      collapsible: a.collapsible === !0,
      defaultSize: i,
      disabled: a.disabled,
      minSize: l,
      maxSize: c,
      panelId: r.id
    };
  });
}
function ie(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function Jn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? ff : hf
  );
}
function ff(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function hf(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function xa(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Da(e, t) {
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
function mf({
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
    const { x: i, y: l } = Da(r, s), c = e === "horizontal" ? i : l;
    c < a && (a = c, o = s);
  }
  return ie(o, "No rect found"), o;
}
let sn;
function pf() {
  return sn === void 0 && (typeof matchMedia == "function" ? sn = !!matchMedia("(pointer:coarse)").matches : sn = !1), sn;
}
function Ca(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Jn(
    n,
    Array.from(t.children).filter(xa).map((b) => ({ element: b }))
  ).map(({ element: b }) => b), s = [];
  let i = !1, l = !1, c = -1, u = -1, f = 0, d, h = [];
  {
    let b = -1;
    for (const m of a)
      m.hasAttribute("data-panel") && (b++, m.hasAttribute("data-disabled") || (f++, c === -1 && (c = b), u = b));
  }
  if (f > 1) {
    let b = -1;
    for (const m of a)
      if (m.hasAttribute("data-panel")) {
        b++;
        const w = r.find(
          (k) => k.element === m
        );
        if (w) {
          if (d) {
            const k = d.element.getBoundingClientRect(), v = m.getBoundingClientRect();
            let g;
            if (l) {
              const y = n === "horizontal" ? new DOMRect(
                k.right,
                k.top,
                0,
                k.height
              ) : new DOMRect(
                k.left,
                k.bottom,
                k.width,
                0
              ), S = n === "horizontal" ? new DOMRect(v.left, v.top, 0, v.height) : new DOMRect(v.left, v.top, v.width, 0);
              switch (h.length) {
                case 0: {
                  g = [
                    y,
                    S
                  ];
                  break;
                }
                case 1: {
                  const E = h[0], N = mf({
                    orientation: n,
                    rects: [k, v],
                    targetRect: E.element.getBoundingClientRect()
                  });
                  g = [
                    E,
                    N === k ? S : y
                  ];
                  break;
                }
                default: {
                  g = h;
                  break;
                }
              }
            } else
              h.length ? g = h : g = [
                n === "horizontal" ? new DOMRect(
                  k.right,
                  v.top,
                  v.left - k.right,
                  v.height
                ) : new DOMRect(
                  v.left,
                  k.bottom,
                  v.width,
                  v.top - k.bottom
                )
              ];
            for (const y of g) {
              let S = "width" in y ? y : y.element.getBoundingClientRect();
              const E = pf() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (S.width < E) {
                const z = E - S.width;
                S = new DOMRect(
                  S.x - z / 2,
                  S.y,
                  S.width + z,
                  S.height
                );
              }
              if (S.height < E) {
                const z = E - S.height;
                S = new DOMRect(
                  S.x,
                  S.y - z / 2,
                  S.width,
                  S.height + z
                );
              }
              const N = b <= c || b > u;
              !i && !N && s.push({
                group: e,
                groupSize: Dt({ group: e }),
                panels: [d, w],
                separator: "width" in y ? void 0 : y,
                rect: S
              }), i = !1;
            }
          }
          l = !1, d = w, h = [];
        }
      } else if (m.hasAttribute("data-separator")) {
        m.ariaDisabled !== null && (i = !0);
        const w = o.find(
          (k) => k.element === m
        );
        w ? h.push(w) : (d = void 0, h = []);
      } else
        l = !0;
  }
  return s;
}
var lt;
class za {
  constructor() {
    Nr(this, lt, {});
  }
  addListener(t, n) {
    const r = Ot(this, lt)[t];
    return r === void 0 ? Ot(this, lt)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = Ot(this, lt)[t];
    if (r !== void 0)
      if (r.length === 1)
        r[0].call(null, n);
      else {
        let o = !1, a = null;
        const s = Array.from(r);
        for (let i = 0; i < s.length; i++) {
          const l = s[i];
          try {
            l.call(null, n);
          } catch (c) {
            a === null && (o = !0, a = c);
          }
        }
        if (o)
          throw a;
      }
  }
  removeAllListeners() {
    Ar(this, lt, {});
  }
  removeListener(t, n) {
    const r = Ot(this, lt)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
lt = new WeakMap();
let Lt = {
  cursorFlags: 0,
  state: "inactive"
};
const lr = new za();
function yt() {
  return Lt;
}
function gf(e) {
  return lr.addListener("change", e);
}
function bf(e) {
  const t = Lt, n = { ...Lt };
  n.cursorFlags = e, Lt = n, lr.emit("change", {
    prev: t,
    next: n
  });
}
function _t(e) {
  const t = Lt;
  Lt = e, lr.emit("change", {
    prev: t,
    next: e
  });
}
const yf = (e) => e, An = () => {
}, Oa = 1, $a = 2, Fa = 4, Ba = 8, fo = 3, ho = 12;
let ln;
function mo() {
  return ln === void 0 && (ln = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (ln = !0)), ln;
}
function vf({
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
        if (e && mo()) {
          const a = (e & Oa) !== 0, s = (e & $a) !== 0, i = (e & Fa) !== 0, l = (e & Ba) !== 0;
          if (a)
            return i ? "se-resize" : l ? "ne-resize" : "e-resize";
          if (s)
            return i ? "sw-resize" : l ? "nw-resize" : "w-resize";
          if (i)
            return "s-resize";
          if (l)
            return "n-resize";
        }
        break;
      }
    }
    return mo() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const po = /* @__PURE__ */ new WeakMap();
function cr(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = po.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = yt();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = vf({
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
  po.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let We = /* @__PURE__ */ new Map();
const ja = new za();
function wf(e) {
  We = new Map(We), We.delete(e);
}
function go(e, t) {
  for (const [n] of We)
    if (n.id === e)
      return n;
}
function dt(e, t) {
  for (const [n, r] of We)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function It() {
  return We;
}
function ur(e, t) {
  return ja.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function tt(e, t, n) {
  const r = We.get(e);
  We = new Map(We), We.set(e, t), ja.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function Ha(e) {
  const t = yt();
  let n = !1;
  switch (t.state) {
    case "active":
      _t({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (cr(e), n = !0, t.hitRegions.forEach((r) => {
        const o = dt(r.group.id, !0);
        tt(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function bo(e) {
  e.defaultPrevented || Ha(e.currentTarget);
}
function Sf(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Da(n, a.rect);
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
function kf(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function If(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: wo(e),
    b: wo(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  ie(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: vo(yo(n.a)),
    b: vo(yo(n.b))
  };
  if (o.a === o.b) {
    const a = r.childNodes, s = {
      a: n.a.at(-1),
      b: n.b.at(-1)
    };
    let i = a.length;
    for (; i--; ) {
      const l = a[i];
      if (l === s.a) return 1;
      if (l === s.b) return -1;
    }
  }
  return Math.sign(o.a - o.b);
}
const Rf = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function Ef(e) {
  const t = getComputedStyle(Ua(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function Pf(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || Ef(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || Rf.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function yo(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (ie(n, "Missing node"), Pf(n)) return n;
  }
  return null;
}
function vo(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function wo(e) {
  const t = [];
  for (; e; )
    t.push(e), e = Ua(e);
  return t;
}
function Ua(e) {
  const { parentNode: t } = e;
  return kf(t) ? t.host : t;
}
function Tf(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Mf({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!xa(n) || n.contains(e) || e.contains(n))
    return !0;
  if (If(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Tf(r.getBoundingClientRect(), t))
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
    const a = Ca(o), s = Sf(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Mf({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function Nf(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function ke(e, t, n = 0) {
  return Math.abs(Re(e) - Re(t)) <= n;
}
function Ue(e, t) {
  return ke(e, t) ? 0 : e > t ? 1 : -1;
}
function At({
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
    minSize: l = 0
  } = t;
  if (s && !e)
    return n;
  if (Ue(r, l) < 0)
    if (a) {
      const c = (o + l) / 2;
      Ue(r, c) < 0 ? r = o : r = l;
    } else
      r = l;
  return r = Math.min(i, r), r = Re(r), r;
}
function Yt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (ke(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), l = Object.values(o), c = [...i], [u, f] = r;
  ie(u != null, "Invalid first pivot index"), ie(f != null, "Invalid second pivot index");
  let d = 0;
  switch (a) {
    case "keyboard": {
      {
        const m = e < 0 ? f : u, w = n[m];
        ie(
          w,
          `Panel constraints not found for index ${m}`
        );
        const {
          collapsedSize: k = 0,
          collapsible: v,
          minSize: g = 0
        } = w;
        if (v) {
          const y = i[m];
          if (ie(
            y != null,
            `Previous layout not found for panel index ${m}`
          ), ke(y, k)) {
            const S = g - y;
            Ue(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
          }
        }
      }
      {
        const m = e < 0 ? u : f, w = n[m];
        ie(
          w,
          `No panel constraints found for index ${m}`
        );
        const {
          collapsedSize: k = 0,
          collapsible: v,
          minSize: g = 0
        } = w;
        if (v) {
          const y = i[m];
          if (ie(
            y != null,
            `Previous layout not found for panel index ${m}`
          ), ke(y, g)) {
            const S = y - k;
            Ue(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
          }
        }
      }
      break;
    }
    default: {
      const m = e < 0 ? f : u, w = n[m];
      ie(
        w,
        `Panel constraints not found for index ${m}`
      );
      const k = i[m], { collapsible: v, collapsedSize: g, minSize: y } = w;
      if (v && Ue(k, y) < 0)
        if (e > 0) {
          const S = y - g, E = S / 2, N = k + e;
          Ue(N, y) < 0 && (e = Ue(e, E) <= 0 ? 0 : S);
        } else {
          const S = y - g, E = 100 - S / 2, N = k - e;
          Ue(N, y) < 0 && (e = Ue(100 + e, E) > 0 ? 0 : -S);
        }
      break;
    }
  }
  {
    const m = e < 0 ? 1 : -1;
    let w = e < 0 ? f : u, k = 0;
    for (; ; ) {
      const g = i[w];
      ie(
        g != null,
        `Previous layout not found for panel index ${w}`
      );
      const y = At({
        overrideDisabledPanels: s,
        panelConstraints: n[w],
        prevSize: g,
        size: 100
      }) - g;
      if (k += y, w += m, w < 0 || w >= n.length)
        break;
    }
    const v = Math.min(Math.abs(e), Math.abs(k));
    e = e < 0 ? 0 - v : v;
  }
  {
    let m = e < 0 ? u : f;
    for (; m >= 0 && m < n.length; ) {
      const w = Math.abs(e) - Math.abs(d), k = i[m];
      ie(
        k != null,
        `Previous layout not found for panel index ${m}`
      );
      const v = k - w, g = At({
        overrideDisabledPanels: s,
        panelConstraints: n[m],
        prevSize: k,
        size: v
      });
      if (!ke(k, g) && (d += k - g, c[m] = g, d.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? m-- : m++;
    }
  }
  if (Nf(l, c))
    return o;
  {
    const m = e < 0 ? f : u, w = i[m];
    ie(
      w != null,
      `Previous layout not found for panel index ${m}`
    );
    const k = w + d, v = At({
      overrideDisabledPanels: s,
      panelConstraints: n[m],
      prevSize: w,
      size: k
    });
    if (c[m] = v, !ke(v, k)) {
      let g = k - v, y = e < 0 ? f : u;
      for (; y >= 0 && y < n.length; ) {
        const S = c[y];
        ie(
          S != null,
          `Previous layout not found for panel index ${y}`
        );
        const E = S + g, N = At({
          overrideDisabledPanels: s,
          panelConstraints: n[y],
          prevSize: S,
          size: E
        });
        if (ke(S, N) || (g -= N - S, c[y] = N), ke(g, 0))
          break;
        e > 0 ? y-- : y++;
      }
    }
  }
  const h = Object.values(c).reduce(
    (m, w) => w + m,
    0
  );
  if (!ke(h, 100, 0.1))
    return o;
  const b = Object.keys(o);
  return c.reduce((m, w, k) => (m[b[k]] = w, m), {});
}
function vt(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || Ue(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function wt({
  layout: e,
  panelConstraints: t
}) {
  const n = Object.values(e), r = [...n], o = r.reduce(
    (i, l) => i + l,
    0
  );
  if (r.length !== t.length)
    throw Error(
      `Invalid ${t.length} panel layout: ${r.map((i) => `${i}%`).join(", ")}`
    );
  if (!ke(o, 100) && r.length > 0)
    for (let i = 0; i < t.length; i++) {
      const l = r[i];
      ie(l != null, `No layout data found for index ${i}`);
      const c = 100 / o * l;
      r[i] = c;
    }
  let a = 0;
  for (let i = 0; i < t.length; i++) {
    const l = n[i];
    ie(l != null, `No layout data found for index ${i}`);
    const c = r[i];
    ie(c != null, `No layout data found for index ${i}`);
    const u = At({
      overrideDisabledPanels: !0,
      panelConstraints: t[i],
      prevSize: l,
      size: c
    });
    c != u && (a += c - u, r[i] = u);
  }
  if (!ke(a, 0))
    for (let i = 0; i < t.length; i++) {
      const l = r[i];
      ie(l != null, `No layout data found for index ${i}`);
      const c = l + a, u = At({
        overrideDisabledPanels: !0,
        panelConstraints: t[i],
        prevSize: l,
        size: c
      });
      if (l !== u && (a -= u - l, r[i] = u, ke(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((i, l, c) => (i[s[c]] = l, i), {});
}
function Wa({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const l = It();
    for (const [
      c,
      {
        defaultLayoutDeferred: u,
        derivedPanelConstraints: f,
        layout: d,
        groupSize: h,
        separatorToPanels: b
      }
    ] of l)
      if (c.id === e)
        return {
          defaultLayoutDeferred: u,
          derivedPanelConstraints: f,
          group: c,
          groupSize: h,
          layout: d,
          separatorToPanels: b
        };
    throw Error(`Group ${e} not found`);
  }, r = () => {
    const l = n().derivedPanelConstraints.find(
      (c) => c.panelId === t
    );
    if (l !== void 0)
      return l;
    throw Error(`Panel constraints not found for Panel ${t}`);
  }, o = () => {
    const l = n().group.panels.find((c) => c.id === t);
    if (l !== void 0)
      return l;
    throw Error(`Layout not found for Panel ${t}`);
  }, a = () => {
    const l = n().layout[t];
    if (l !== void 0)
      return l;
    throw Error(`Layout not found for Panel ${t}`);
  }, s = ({
    nextSize: l,
    panels: c,
    prevLayout: u,
    derivedPanelConstraints: f
  }) => {
    const d = a(), h = c.findIndex((w) => w.id === t), b = h === 0, m = h === c.length - 1;
    if (m && l < d && (b || c.slice(0, h).every((w, k) => {
      const v = f[k];
      return (v == null ? void 0 : v.collapsible) && ke(v.collapsedSize, u[v.panelId]);
    }))) {
      const w = c.slice(0, h).reduce((k, v) => k + u[v.id], 0);
      return {
        ...u,
        [t]: Re(100 - w)
      };
    }
    return Yt({
      delta: m ? d - l : l - d,
      initialLayout: u,
      panelConstraints: f,
      pivotIndices: m ? [h - 1, h] : [h, h + 1],
      prevLayout: u,
      trigger: "imperative-api"
    });
  }, i = (l) => {
    const c = a();
    if (l === c)
      return;
    const {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: f,
      group: d,
      groupSize: h,
      layout: b,
      separatorToPanels: m
    } = n(), w = s({
      nextSize: l,
      panels: d.panels,
      prevLayout: b,
      derivedPanelConstraints: f
    }), k = wt({
      layout: w,
      panelConstraints: f
    });
    vt(b, k) || tt(d, {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: f,
      groupSize: h,
      layout: k,
      separatorToPanels: m
    });
  };
  return {
    collapse: () => {
      const { collapsible: l, collapsedSize: c } = r(), { mutableValues: u } = o(), f = a();
      l && f !== c && (u.expandToSize = f, i(c));
    },
    expand: () => {
      const { collapsible: l, collapsedSize: c, minSize: u } = r(), { mutableValues: f } = o(), d = a();
      if (l && d === c) {
        let h = f.expandToSize ?? u;
        h === 0 && (h = 1), i(h);
      }
    },
    getSize: () => {
      const { group: l } = n(), c = a(), { element: u } = o(), f = l.orientation === "horizontal" ? u.offsetWidth : u.offsetHeight;
      return {
        asPercentage: c,
        inPixels: f
      };
    },
    isCollapsed: () => {
      const { collapsible: l, collapsedSize: c } = r(), u = a();
      return l && ke(c, u);
    },
    resize: (l) => {
      const { group: c } = n(), { element: u } = o(), f = Dt({ group: c }), d = Kt({
        groupSize: f,
        panelElement: u,
        styleProp: l
      }), h = Re(d / f * 100);
      i(h);
    }
  };
}
function So(e) {
  if (e.defaultPrevented)
    return;
  const t = It();
  dr(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = Wa({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function cn(e) {
  const t = It();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function Ka({
  groupId: e
}) {
  const t = () => {
    const n = It();
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
        separatorToPanels: l
      } = t(), c = wt({
        layout: n,
        panelConstraints: o
      });
      return r ? i : (vt(i, c) || tt(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: c,
        separatorToPanels: l
      }), c);
    }
  };
}
function pt(e, t) {
  const n = cn(e), r = dt(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  ie(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  ie(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), i = Ka({ groupId: n.id }).getLayout(), l = Yt({
    delta: t,
    initialLayout: i,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: i,
    trigger: "keyboard"
  }), c = wt({
    layout: l,
    panelConstraints: r.derivedPanelConstraints
  });
  vt(i, c) || tt(
    n,
    {
      defaultLayoutDeferred: r.defaultLayoutDeferred,
      derivedPanelConstraints: r.derivedPanelConstraints,
      groupSize: r.groupSize,
      layout: c,
      separatorToPanels: r.separatorToPanels
    },
    // Keyboard resizes (arrow keys, Home/End, Enter collapse/expand) originate
    // from a real DOM event on the separator, so they are user interactions
    // just like pointer drags. This function is only reached from
    // onDocumentKeyDown. See #716.
    { isUserInteraction: !0 }
  );
}
function ko(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = cn(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && pt(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && pt(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && pt(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && pt(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), pt(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = cn(t), o = dt(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, l = r.separators.find(
          (d) => d.element === t
        );
        ie(l, "Matching separator not found");
        const c = i.get(l);
        ie(c, "Matching panels not found");
        const u = c[0], f = a.find(
          (d) => d.panelId === u.id
        );
        if (ie(f, "Panel metadata not found"), f.collapsible) {
          const d = s[u.id], h = f.collapsedSize === d ? r.mutableState.expandedPanelSizes[u.id] ?? f.minSize : f.collapsedSize;
          pt(t, h - d);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = cn(t).separators.map(
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
        e.preventDefault(), pt(t, -100);
        break;
      }
    }
}
function Io(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = It(), n = dr(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), _t({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function Va({
  document: e,
  event: t,
  hitRegions: n,
  initialLayoutMap: r,
  mountedGroups: o,
  pointerDownAtPoint: a,
  prevCursorFlags: s
}) {
  let i = 0;
  n.forEach((c) => {
    const { group: u, groupSize: f } = c, { orientation: d, panels: h } = u, { disableCursor: b } = u.mutableState;
    let m = 0;
    a ? d === "horizontal" ? m = (t.clientX - a.x) / f * 100 : m = (t.clientY - a.y) / f * 100 : d === "horizontal" ? m = t.clientX < 0 ? -100 : 100 : m = t.clientY < 0 ? -100 : 100;
    const w = r.get(u), k = o.get(u);
    if (!w || !k)
      return;
    const {
      defaultLayoutDeferred: v,
      derivedPanelConstraints: g,
      groupSize: y,
      layout: S,
      separatorToPanels: E
    } = k;
    if (g && S && E) {
      const N = Yt({
        delta: m,
        initialLayout: w,
        panelConstraints: g,
        pivotIndices: c.panels.map((z) => h.indexOf(z)),
        prevLayout: S,
        trigger: "mouse-or-touch"
      });
      if (vt(N, S)) {
        if (m !== 0 && !b)
          switch (d) {
            case "horizontal": {
              i |= m < 0 ? Oa : $a;
              break;
            }
            case "vertical": {
              i |= m < 0 ? Fa : Ba;
              break;
            }
          }
      } else
        tt(c.group, {
          defaultLayoutDeferred: v,
          derivedPanelConstraints: g,
          groupSize: y,
          layout: N,
          separatorToPanels: E
        });
    }
  });
  let l = 0;
  t.movementX === 0 ? l |= s & fo : l |= i & fo, t.movementY === 0 ? l |= s & ho : l |= i & ho, bf(l), cr(e);
}
function Ro(e) {
  const t = It(), n = yt();
  switch (n.state) {
    case "active":
      Va({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function Eo(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = yt(), n = It();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        _t({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = dt(a.group.id, !0);
          tt(a.group, s, {
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
      Va({
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
      a.length === 0 ? t.state !== "inactive" && _t({
        cursorFlags: 0,
        state: "inactive"
      }) : _t({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), cr(e.currentTarget);
      break;
    }
  }
}
function Po(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (yt().state) {
      case "hover":
        _t({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function To(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || Ha(e.currentTarget) && e.preventDefault();
}
function Mo(e) {
  let t = 0, n = 0;
  const r = {};
  for (const a of e)
    if (a.defaultSize !== void 0) {
      t++;
      const s = Re(a.defaultSize);
      n += s, r[a.panelId] = s;
    } else
      r[a.panelId] = void 0;
  const o = e.length - t;
  if (o !== 0) {
    const a = Re((100 - n) / o);
    for (const s of e)
      s.defaultSize === void 0 && (r[s.panelId] = a);
  }
  return r;
}
function Af(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((l) => l.element === t);
  if (!r || !r.onResize)
    return;
  const o = Dt({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: Re(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function Lf(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function _f({
  group: e,
  nextGroupSize: t,
  prevGroupSize: n,
  prevLayout: r
}) {
  if (n <= 0 || t <= 0 || n === t)
    return r;
  let o = 0, a = 0, s = !1;
  const i = /* @__PURE__ */ new Map(), l = [];
  for (const f of e.panels) {
    const d = r[f.id] ?? 0;
    switch (f.panelConstraints.groupResizeBehavior) {
      case "preserve-pixel-size": {
        s = !0;
        const h = d / 100 * n, b = Re(
          h / t * 100
        );
        i.set(f.id, b), o += b;
        break;
      }
      case "preserve-relative-size":
      default: {
        l.push(f.id), a += d;
        break;
      }
    }
  }
  if (!s || l.length === 0)
    return r;
  const c = 100 - o, u = { ...r };
  if (i.forEach((f, d) => {
    u[d] = f;
  }), a > 0)
    for (const f of l) {
      const d = r[f] ?? 0;
      u[f] = Re(
        d / a * c
      );
    }
  else {
    const f = Re(
      c / l.length
    );
    for (const d of l)
      u[d] = f;
  }
  return u;
}
function xf(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const Pt = /* @__PURE__ */ new Map();
function Df(e) {
  let t = !0;
  ie(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((b) => {
    for (const m of b) {
      const { borderBoxSize: w, target: k } = m;
      if (k === e.element) {
        if (t) {
          const v = Dt({ group: e });
          if (v === 0)
            return;
          const g = dt(e.id);
          if (!g)
            return;
          const y = Vn(e), S = g.defaultLayoutDeferred ? Mo(y) : g.layout, E = _f({
            group: e,
            nextGroupSize: v,
            prevGroupSize: g.groupSize,
            prevLayout: S
          }), N = wt({
            layout: E,
            panelConstraints: y
          });
          if (!g.defaultLayoutDeferred && vt(g.layout, N) && Lf(
            g.derivedPanelConstraints,
            y
          ) && g.groupSize === v)
            return;
          tt(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: y,
            groupSize: v,
            layout: N,
            separatorToPanels: g.separatorToPanels
          });
        }
      } else
        Af(e, k, w);
    }
  });
  a.observe(e.element), e.panels.forEach((b) => {
    ie(
      !r.has(b.id),
      `Panel ids must be unique; id "${b.id}" was used more than once`
    ), r.add(b.id), b.onResize && a.observe(b.element);
  });
  const s = Dt({ group: e }), i = Vn(e), l = e.panels.map(({ id: b }) => b).join(",");
  let c = e.mutableState.defaultLayout;
  c && (xf(e.panels, c) || (c = void 0));
  const u = e.mutableState.layouts[l] ?? c ?? Mo(i), f = wt({
    layout: u,
    panelConstraints: i
  }), d = e.element.ownerDocument;
  Pt.set(
    d,
    (Pt.get(d) ?? 0) + 1
  );
  const h = /* @__PURE__ */ new Map();
  return Ca(e).forEach((b) => {
    b.separator && h.set(b.separator, b.panels);
  }), tt(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: h
  }), e.separators.forEach((b) => {
    ie(
      !o.has(b.id),
      `Separator ids must be unique; id "${b.id}" was used more than once`
    ), o.add(b.id), b.element.addEventListener("keydown", ko);
  }), Pt.get(d) === 1 && (d.addEventListener("contextmenu", bo, !0), d.addEventListener("dblclick", So, !0), d.addEventListener("pointerdown", Io, !0), d.addEventListener("pointerleave", Ro), d.addEventListener("pointermove", Eo), d.addEventListener("pointerout", Po), d.addEventListener("pointerup", To, !0)), function() {
    t = !1, Pt.set(
      d,
      Math.max(0, (Pt.get(d) ?? 0) - 1)
    ), wf(e), e.separators.forEach((b) => {
      b.element.removeEventListener("keydown", ko);
    }), Pt.get(d) || (d.removeEventListener(
      "contextmenu",
      bo,
      !0
    ), d.removeEventListener(
      "dblclick",
      So,
      !0
    ), d.removeEventListener(
      "pointerdown",
      Io,
      !0
    ), d.removeEventListener("pointerleave", Ro), d.removeEventListener("pointermove", Eo), d.removeEventListener("pointerout", Po), d.removeEventListener("pointerup", To, !0)), a.disconnect();
  };
}
function Cf() {
  const [e, t] = T({}), n = D(() => t({}), []);
  return [e, n];
}
function fr(e) {
  const t = $o();
  return `${e ?? t}`;
}
const Rt = typeof window < "u" ? Pe : C;
function Jt(e) {
  const t = M(e);
  return Rt(() => {
    t.current = e;
  }, [e]), D(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function hr(...e) {
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
function mr(e) {
  const t = M({ ...e });
  return Rt(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const Ja = Zn(null);
function zf(e, t) {
  const n = M({
    getLayout: () => ({}),
    setLayout: yf
  });
  Qn(t, () => n.current, []), Rt(() => {
    Object.assign(
      n.current,
      Ka({ groupId: e })
    );
  });
}
function qa({
  children: e,
  className: t,
  defaultLayout: n,
  disableCursor: r,
  disabled: o,
  elementRef: a,
  groupRef: s,
  id: i,
  onLayoutChange: l,
  onLayoutChanged: c,
  orientation: u = "horizontal",
  resizeTargetMinimumSize: f = {
    coarse: 20,
    fine: 10
  },
  style: d,
  ...h
}) {
  const b = M({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), m = Jt((I) => {
    vt(b.current.onLayoutChange, I) || (b.current.onLayoutChange = I, l == null || l(I));
  }), w = Jt(
    (I, R) => {
      vt(b.current.onLayoutChanged, I) || (b.current.onLayoutChanged = I, c == null || c(I, { isUserInteraction: R }));
    }
  ), k = fr(i), v = M(null), [g, y] = Cf(), S = M({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), E = hr(v, a);
  zf(k, s);
  const N = Jt(
    (I, R) => {
      const P = yt(), _ = go(I), x = dt(I);
      if (x) {
        let H = !1;
        switch (P.state) {
          case "active": {
            H = P.hitRegions.some(
              (F) => F.group === _
            );
            break;
          }
        }
        return {
          flexGrow: x.layout[R] ?? 1,
          pointerEvents: H ? "none" : void 0
        };
      }
      if (n != null && n[R])
        return {
          flexGrow: n == null ? void 0 : n[R]
        };
    }
  ), z = mr({
    defaultLayout: n,
    disableCursor: r
  }), $ = J(
    () => ({
      get disableCursor() {
        return !!z.disableCursor;
      },
      getPanelStyles: N,
      id: k,
      orientation: u,
      registerPanel: (I) => {
        const R = S.current;
        return R.panels = Jn(u, [
          ...R.panels,
          I
        ]), y(), () => {
          R.panels = R.panels.filter(
            (P) => P !== I
          ), y();
        };
      },
      registerSeparator: (I) => {
        const R = S.current;
        return R.separators = Jn(u, [
          ...R.separators,
          I
        ]), y(), () => {
          R.separators = R.separators.filter(
            (P) => P !== I
          ), y();
        };
      },
      updatePanelProps: (I, { disabled: R }) => {
        const P = S.current.panels.find(
          (H) => H.id === I
        );
        P && (P.panelConstraints.disabled = R);
        const _ = go(k), x = dt(k);
        _ && x && tt(_, {
          ...x,
          derivedPanelConstraints: Vn(_)
        });
      },
      updateSeparatorProps: (I, {
        disabled: R,
        disableDoubleClick: P
      }) => {
        const _ = S.current.separators.find(
          (x) => x.id === I
        );
        _ && (_.disabled = R, _.disableDoubleClick = P);
      }
    }),
    [N, k, y, u, z]
  ), A = M(null);
  return Rt(() => {
    const I = v.current;
    if (I === null)
      return;
    const R = S.current;
    let P;
    if (z.defaultLayout !== void 0 && Object.keys(z.defaultLayout).length === R.panels.length) {
      P = {};
      for (const ae of R.panels) {
        const se = z.defaultLayout[ae.id];
        se !== void 0 && (P[ae.id] = se);
      }
    }
    const _ = {
      disabled: !!o,
      element: I,
      id: k,
      mutableState: {
        defaultLayout: P,
        disableCursor: !!z.disableCursor,
        expandedPanelSizes: S.current.lastExpandedPanelSizes,
        layouts: S.current.layouts
      },
      orientation: u,
      panels: R.panels,
      resizeTargetMinimumSize: R.resizeTargetMinimumSize,
      separators: R.separators
    };
    A.current = _;
    const x = Df(_), { defaultLayoutDeferred: H, derivedPanelConstraints: F, layout: G } = dt(_.id, !0);
    !H && F.length > 0 && (m(G), w(G, !1));
    const Z = ur(k, (ae) => {
      const { defaultLayoutDeferred: se, derivedPanelConstraints: ce, layout: ue } = ae.next;
      if (se || ce.length === 0)
        return;
      const le = _.panels.map(({ id: te }) => te).join(",");
      _.mutableState.layouts[le] = ue, ce.forEach((te) => {
        if (te.collapsible) {
          const { layout: re } = ae.prev ?? {};
          if (re) {
            const fe = ke(
              te.collapsedSize,
              ue[te.panelId]
            ), ve = ke(
              te.collapsedSize,
              re[te.panelId]
            );
            fe && !ve && (_.mutableState.expandedPanelSizes[te.panelId] = re[te.panelId]);
          }
        }
      });
      const Ce = yt().state !== "active";
      m(ue), Ce && w(ue, ae.isUserInteraction);
    });
    return () => {
      A.current = null, x(), Z();
    };
  }, [
    o,
    k,
    w,
    m,
    u,
    g,
    z
  ]), C(() => {
    const I = A.current;
    I && (I.mutableState.defaultLayout = n, I.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(Ja.Provider, { value: $, children: /* @__PURE__ */ p(
    "div",
    {
      ...h,
      className: t,
      "data-group": !0,
      "data-testid": k,
      id: k,
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
qa.displayName = "Group";
function pr() {
  const e = Yn(Ja);
  return ie(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Of(e, t) {
  const { id: n } = pr(), r = M({
    collapse: An,
    expand: An,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: An
  });
  Qn(t, () => r.current, []), Rt(() => {
    Object.assign(
      r.current,
      Wa({ groupId: n, panelId: e })
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
  id: l,
  maxSize: c = "100%",
  minSize: u = "0%",
  onResize: f,
  panelRef: d,
  style: h,
  ...b
}) {
  const m = !!l, w = fr(l), k = mr({
    disabled: a
  }), v = M(null), g = hr(v, s), {
    getPanelStyles: y,
    id: S,
    orientation: E,
    registerPanel: N,
    updatePanelProps: z
  } = pr(), $ = f !== null, A = Jt(
    (_, x, H) => {
      f == null || f(_, l, H);
    }
  );
  Rt(() => {
    const _ = v.current;
    if (_ !== null) {
      const x = {
        element: _,
        id: w,
        idIsStable: m,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: $ ? A : void 0,
        panelConstraints: {
          groupResizeBehavior: i,
          collapsedSize: n,
          collapsible: r,
          defaultSize: o,
          disabled: k.disabled,
          maxSize: c,
          minSize: u
        }
      };
      return N(x);
    }
  }, [
    i,
    n,
    r,
    o,
    $,
    w,
    m,
    c,
    u,
    A,
    N,
    k
  ]), C(() => {
    z(w, { disabled: a });
  }, [a, w, z]), Of(w, d);
  const I = () => {
    const _ = y(S, w);
    if (_)
      return JSON.stringify(_);
  }, R = Oo(
    (_) => ur(S, _),
    I,
    I
  );
  let P;
  return R ? P = JSON.parse(R) : o !== void 0 ? P = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : P = { flexGrow: 1 }, /* @__PURE__ */ p(
    "div",
    {
      ...b,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": w,
      id: w,
      ref: g,
      style: {
        ...$f,
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
            ...h,
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
const $f = {
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
function Ff({
  layout: e,
  panelConstraints: t,
  panelId: n,
  panelIndex: r
}) {
  let o, a;
  const s = e[n], i = t.find(
    (l) => l.panelId === n
  );
  if (i) {
    const l = i.maxSize, c = i.collapsible ? i.collapsedSize : i.minSize, u = [r, r + 1];
    a = wt({
      layout: Yt({
        delta: c - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = wt({
      layout: Yt({
        delta: l - s,
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
function Ga({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const l = fr(a), c = mr({
    disabled: n,
    disableDoubleClick: r
  }), [u, f] = T({}), [d, h] = T("inactive"), [b, m] = T(!1), w = M(null), k = hr(w, o), {
    disableCursor: v,
    id: g,
    orientation: y,
    registerSeparator: S,
    updateSeparatorProps: E
  } = pr(), N = y === "horizontal" ? "vertical" : "horizontal";
  Rt(() => {
    const A = w.current;
    if (A !== null) {
      const I = {
        disabled: c.disabled,
        disableDoubleClick: c.disableDoubleClick,
        element: A,
        id: l
      }, R = S(I), P = gf(
        (x) => {
          h(
            x.next.state !== "inactive" && x.next.hitRegions.some(
              (H) => H.separator === I
            ) ? x.next.state : "inactive"
          );
        }
      ), _ = ur(
        g,
        (x) => {
          const { derivedPanelConstraints: H, layout: F, separatorToPanels: G } = x.next, Z = G.get(I);
          if (Z) {
            const ae = Z[0], se = Z.indexOf(ae);
            f(
              Ff({
                layout: F,
                panelConstraints: H,
                panelId: ae.id,
                panelIndex: se
              })
            );
          }
        }
      );
      return () => {
        P(), _(), R();
      };
    }
  }, [g, l, S, c]), C(() => {
    E(l, { disabled: n, disableDoubleClick: r });
  }, [n, r, l, E]);
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
        b ? $ = "focus" : $ = d;
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
      "data-testid": l,
      id: l,
      onBlur: () => m(!1),
      onFocus: () => m(!0),
      ref: k,
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
Ga.displayName = "Separator";
const gr = 30, br = 65, Qt = 50, Bf = 100 - br, jf = 100 - gr;
function Hf(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(br, Math.max(gr, t)) : Qt;
}
function yr(e) {
  return 100 - e;
}
function Tt(e) {
  return `${e}%`;
}
const vr = "reader-document", en = "reader-assistant", Xa = "retainpdf.reader.ai-split-layout.v1", Uf = {
  [vr]: yr(Qt),
  [en]: Qt
};
function wr(e) {
  const t = Hf(e == null ? void 0 : e[en]);
  return {
    [vr]: yr(t),
    [en]: t
  };
}
function Wf() {
  try {
    const e = JSON.parse(localStorage.getItem(Xa) || "null");
    return wr(e);
  } catch {
    return Uf;
  }
}
function Kf(e) {
  try {
    localStorage.setItem(Xa, JSON.stringify(wr(e)));
  } catch {
  }
}
function Ln(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = wr(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[en]}vw`
  );
}
function Vf() {
  const e = M(null), [t] = T(Wf);
  Pe(() => {
    const o = e.current;
    return Ln(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = D((o) => {
    Ln(e.current, o);
  }, []), r = D((o, a) => {
    Ln(e.current, o), a.isUserInteraction && Kf(o);
  }, []);
  return /* @__PURE__ */ L(
    qa,
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
            defaultSize: Tt(yr(Qt)),
            minSize: Tt(Bf),
            maxSize: Tt(jf)
          }
        ),
        /* @__PURE__ */ p(
          Ga,
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
            id: en,
            defaultSize: Tt(Qt),
            minSize: Tt(gr),
            maxSize: Tt(br)
          }
        )
      ]
    }
  );
}
function Jf({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = T(!1);
  if (C(() => {
    !e && !t && o(!1);
  }, [e, t]), r || !e && !t)
    return null;
  const a = [
    e ? "译文区域" : "",
    t ? "阅读元数据" : ""
  ].filter(Boolean);
  return /* @__PURE__ */ L("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ L("span", { className: "reader-error-notice-text", children: [
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
function qf({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(Jf, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ L(St, { children: [
    e ? /* @__PURE__ */ p("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ L("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ p(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ L("div", { className: "reader-react-error", role: "alert", children: [
      /* @__PURE__ */ p("span", { className: "reader-react-error-text", children: n }),
      s ? /* @__PURE__ */ p(X, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function Gf(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Xf() {
  const [e, t] = T(!1), n = $o(), r = M(null);
  return C(() => {
    if (!e) return;
    const o = (s) => {
      const i = r.current;
      i && s.target instanceof Node && !i.contains(s.target) && t(!1);
    }, a = (s) => {
      s.key === "Escape" && (s.preventDefault(), t(!1));
    };
    return document.addEventListener("mousedown", o), window.addEventListener("keydown", a), () => {
      document.removeEventListener("mousedown", o), window.removeEventListener("keydown", a);
    };
  }, [e]), C(() => {
    const o = (a) => {
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || Gf(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((i) => !i);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
  }, []), /* @__PURE__ */ L("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-react-shortcuts-btn${e ? " is-active" : ""}`,
        "aria-label": "快捷键说明",
        "aria-expanded": e,
        "aria-controls": n,
        title: "快捷键（H 或 ?）",
        onClick: () => t((o) => !o),
        children: /* @__PURE__ */ p(Ls, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ L(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ L("div", { className: "reader-react-shortcuts-head", children: [
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
          /* @__PURE__ */ p("div", { className: "reader-react-shortcuts-body", children: bc.map((o) => /* @__PURE__ */ L("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ p("h3", { children: o.title }),
            /* @__PURE__ */ p("ul", { children: o.items.map((a) => /* @__PURE__ */ L("li", { children: [
              /* @__PURE__ */ p("kbd", { children: a.keys }),
              /* @__PURE__ */ p("span", { children: a.desc })
            ] }, `${o.title}-${a.keys}`)) })
          ] }, o.title)) }),
          /* @__PURE__ */ p("p", { className: "reader-react-shortcuts-foot", children: "在输入框内不会触发快捷键" })
        ]
      }
    ) : null
  ] });
}
const Zf = ["source", "sideBySide", "translated"], Yf = { source: "", translated: "", sideBySide: "" };
function Qf(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = un(e.sourceUrl), n = un(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return ci({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function eh(e) {
  const [t, n] = T(() => /* @__PURE__ */ new Set()), r = J(
    () => e ? Qf(e) : Yf,
    [e]
  ), o = J(
    () => Zf.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = D(async (s) => {
    if (!e) return;
    const i = un(r[s]);
    if (!(!i || t.has(s)))
      try {
        const l = e.jobId ? li(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await ui(
          e.fetchProtected,
          i,
          l,
          l,
          null,
          (c) => n((u) => {
            const f = new Set(u);
            return c ? f.add(s) : f.delete(s), f;
          })
        );
      } catch (l) {
        const c = l instanceof Error ? l.message : "下载失败";
        di(c), n((u) => {
          const f = new Set(u);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const th = {
  source: Uo,
  sideBySide: Wo,
  translated: Ko
}, nh = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function rh(e) {
  const t = rt(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = eh(n), i = M(null);
  return C(() => {
    const l = () => {
      var f;
      (f = i.current) != null && f.open && (i.current.open = !1);
    }, c = (f) => {
      i.current && !i.current.contains(f.target) && l();
    }, u = (f) => {
      f.key === "Escape" && l();
    };
    return document.addEventListener("pointerdown", c), document.addEventListener("keydown", u), () => {
      document.removeEventListener("pointerdown", c), document.removeEventListener("keydown", u);
    };
  }, []), /* @__PURE__ */ L("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ L("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ p(_s, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ p(Ho, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((l) => {
      const c = cs[l], u = un(r[l]), f = a.has(l), d = !!u && !f, h = d ? "" : us(l, r), b = th[l];
      return /* @__PURE__ */ L(
        "button",
        {
          type: "button",
          id: `reader-download-${l}`,
          className: `reader-download-action${f ? " is-busy" : ""}`,
          disabled: !d,
          "aria-label": d ? `下载${c.label}` : h,
          onClick: () => {
            i.current && (i.current.open = !1), s(l);
          },
          children: [
            /* @__PURE__ */ p(b, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ L("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ L("span", { className: "reader-download-action-label", children: [
                nh[l],
                " PDF"
              ] }),
              h ? /* @__PURE__ */ p("span", { className: "reader-download-action-reason", children: h }) : null
            ] })
          ]
        },
        l
      );
    }) })
  ] });
}
const oh = "retainpdf:reader:bookmarks:v1:", ah = 200;
function Sr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Za(e) {
  const t = `${e || ""}`.trim();
  return t ? `${oh}${t}` : "";
}
function sh(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function bn(e, t = Sr()) {
  const n = Za(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = sh(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function Gn(e, t, n) {
  const r = Za(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, ah);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function ih(e, t, n = "", { storage: r = Sr(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = bn(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? Gn(e, a.filter((i) => i.page !== s), r) : Gn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function lh(e, t, n = Sr()) {
  return Gn(e, bn(e, n).filter((r) => r.page !== t), n);
}
function ch(e, t) {
  var r, o, a, s;
  let n = null;
  for (const i of e || []) {
    if (`${(i == null ? void 0 : i.regionType) || ""}` != "heading") continue;
    const l = Number(((r = i.source) == null ? void 0 : r.page) ?? ((o = i.translated) == null ? void 0 : o.page));
    if (!Number.isFinite(l) || l > t) continue;
    const c = `${((a = i.translated) == null ? void 0 : a.text) || i.markdown || ((s = i.source) == null ? void 0 : s.text) || ""}`.replace(/\s+/g, " ").trim();
    if (!c) continue;
    const u = Number(i.readingOrder) || 0;
    (!n || l > n.page || l === n.page && u >= n.order) && (n = { page: l, order: u, text: c });
  }
  return n ? n.text.slice(0, 60) : "";
}
function uh({ filled: e }) {
  return /* @__PURE__ */ p("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ p("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function dh({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = T(() => bn(e)), [i, l] = T(!1), c = M(null);
  if (C(() => {
    s(bn(e)), l(!1);
  }, [e]), C(() => {
    if (!i) return;
    const d = (b) => {
      c.current && !c.current.contains(b.target) && l(!1);
    }, h = (b) => {
      b.key === "Escape" && l(!1);
    };
    return document.addEventListener("pointerdown", d), document.addEventListener("keydown", h), () => {
      document.removeEventListener("pointerdown", d), document.removeEventListener("keydown", h);
    };
  }, [i]), !e || n <= 0) return null;
  const u = Math.min(Math.max(t, 1), n), f = a.some((d) => d.page === u);
  return /* @__PURE__ */ L("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: c, children: [
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${f ? " is-marked" : ""}`,
        "aria-pressed": f,
        "aria-label": f ? `取消第 ${u} 页的书签` : `给第 ${u} 页加书签`,
        title: f ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(ih(e, u, ch(r, u))),
        children: /* @__PURE__ */ p(uh, { filled: f })
      }
    ),
    a.length ? /* @__PURE__ */ L(
      "button",
      {
        type: "button",
        className: "reader-react-hud-btn reader-bookmark-list-btn",
        "aria-expanded": i,
        "aria-haspopup": "true",
        "aria-label": `书签列表，共 ${a.length} 个`,
        title: "书签列表",
        onClick: () => l((d) => !d),
        children: [
          /* @__PURE__ */ p(xs, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { className: "reader-bookmark-count", children: a.length })
        ]
      }
    ) : null,
    i && a.length ? /* @__PURE__ */ p("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ p("ol", { className: "reader-bookmark-list", children: a.map((d) => /* @__PURE__ */ L("li", { className: d.page === u ? "is-current" : "", children: [
      /* @__PURE__ */ L(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(d.page, n)), l(!1);
          },
          children: [
            /* @__PURE__ */ L("span", { className: "reader-bookmark-page", children: [
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
          onClick: () => s(lh(e, d.page)),
          children: "×"
        }
      )
    ] }, d.page)) }) }) : null
  ] });
}
function fh(e) {
  const [t, n] = T([]);
  return C(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = nt().loadIssues;
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
function hh(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const mh = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, ph = ["failed", "content", "layout"];
function gh(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function bh({ jobId: e, currentPage: t }) {
  var f;
  const n = fh(e), r = (f = rt()) == null ? void 0 : f.jumpToBlock, [o, a] = T(!1), [s, i] = T(-1), l = M(null);
  C(() => i(-1), [n]);
  const c = (d) => {
    const h = n[d];
    !h || !r || (i(d), r(h.readerItemId));
  }, u = M({ issues: n, last: s, currentPage: t, goTo: c });
  return u.current = { issues: n, last: s, currentPage: t, goTo: c }, C(() => {
    const d = (h) => {
      if (h.key.toLowerCase() !== "n" || h.metaKey || h.ctrlKey || h.altKey || gh(h.target)) return;
      const { issues: b, last: m, currentPage: w, goTo: k } = u.current, v = hh(b, m, w, h.shiftKey);
      v < 0 || (h.preventDefault(), k(v));
    };
    return document.addEventListener("keydown", d), () => document.removeEventListener("keydown", d);
  }, []), C(() => {
    if (!o) return;
    const d = (h) => {
      var b;
      (b = l.current) != null && b.contains(h.target) || a(!1);
    };
    return document.addEventListener("pointerdown", d, !0), () => document.removeEventListener("pointerdown", d, !0);
  }, [o]), n.length ? /* @__PURE__ */ L("div", { className: "reader-react-hud-group reader-issues", ref: l, "aria-label": "待处理", children: [
    /* @__PURE__ */ L(
      X,
      {
        className: "reader-react-hud-btn reader-issues-toggle",
        "aria-expanded": o,
        "aria-haspopup": "true",
        "aria-label": `待处理 ${n.length} 处`,
        title: "这次翻译里要人看一眼的段落（N 下一处，Shift+N 上一处）",
        onClick: () => a((d) => !d),
        children: [
          /* @__PURE__ */ p(Ds, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { children: n.length })
        ]
      }
    ),
    o ? /* @__PURE__ */ L("div", { className: "reader-issues-popover", role: "dialog", "aria-label": "待处理", children: [
      /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
      ph.map((d) => {
        const h = n.map((b, m) => ({ issue: b, index: m })).filter(({ issue: b }) => b.kind === d);
        return h.length ? /* @__PURE__ */ L("section", { className: "reader-issues-group", "data-issue-kind": d, children: [
          /* @__PURE__ */ L("h4", { children: [
            mh[d],
            /* @__PURE__ */ p("span", { children: h.length })
          ] }),
          /* @__PURE__ */ p("ol", { children: h.map(({ issue: b, index: m }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(
            X,
            {
              className: "reader-issues-item",
              "aria-current": m === s ? "true" : void 0,
              onClick: () => {
                c(m), a(!1);
              },
              children: [
                /* @__PURE__ */ p("span", { className: "reader-issues-title", children: b.title }),
                /* @__PURE__ */ L("span", { className: "reader-issues-page", children: [
                  "第 ",
                  b.page,
                  " 页"
                ] }),
                b.detail ? /* @__PURE__ */ p("span", { className: "reader-issues-detail", children: b.detail }) : null
              ]
            }
          ) }, `${b.kind}:${b.readerItemId}`)) })
        ] }, d) : null;
      })
    ] }) : null
  ] }) : null;
}
const yh = 48, vh = 96, wh = 700;
function Sh(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= yh, downSoFar: r };
}
function kh(e) {
  const [t, n] = T(!1), r = M(0);
  return C(() => {
    const o = /* @__PURE__ */ new WeakMap();
    let a = 0;
    const s = () => {
      a = Date.now();
    }, i = /* @__PURE__ */ new WeakMap(), l = () => {
      const d = e.current;
      return !!(d && (d.querySelector(":focus-visible") || d.querySelector("[aria-expanded='true']")));
    }, c = (d) => {
      const h = d.target;
      if (!(h instanceof Element) || (i.has(h) || i.set(h, !!h.querySelector(`[${Ee}]`)), !i.get(h))) return;
      const b = h.scrollTop, m = o.get(h);
      if (o.set(h, b), m === void 0 || Date.now() - a > wh) return;
      const w = Sh(!1, r.current, b - m);
      r.current = w.downSoFar, b - m < -4 ? n(!1) : w.hidden && !l() && n(!0);
    }, u = (d) => {
      d.clientY >= window.innerHeight - vh && (r.current = 0, n(!1));
    }, f = () => {
      l() && n(!1);
    };
    document.addEventListener("scroll", c, { capture: !0, passive: !0 }), window.addEventListener("pointermove", u, { passive: !0 }), document.addEventListener("focusin", f);
    for (const d of ["wheel", "touchmove", "keydown"]) window.addEventListener(d, s, { passive: !0, capture: !0 });
    return () => {
      for (const d of ["wheel", "touchmove", "keydown"]) window.removeEventListener(d, s, { capture: !0 });
      document.removeEventListener("scroll", c, { capture: !0 }), window.removeEventListener("pointermove", u), document.removeEventListener("focusin", f);
    };
  }, [e]), t;
}
function Ih(e) {
  const t = rt(), n = Na(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? tn, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, l = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, c = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = Yi(a), f = a > ea + 1e-3, d = a < pn - 1e-3, h = Nt(r, ut()), b = h >= pn ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", m = M(null), w = kh(m), [k, v] = T(!1), [g, y] = T(`${i}`);
  C(() => {
    k || y(`${Math.min(Math.max(i, 1), Math.max(l, 1))}`);
  }, [i, l, k]);
  const S = () => {
    if (v(!1), !c || l <= 0)
      return;
    const E = Number(`${g}`.trim());
    c(gn(E, l));
  };
  return /* @__PURE__ */ L("div", { ref: m, className: "reader-react-hud", "data-reader-hud": "true", "data-hud-hidden": w ? "true" : void 0, children: [
    o ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "页码", children: k ? /* @__PURE__ */ L(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (E) => {
          E.preventDefault(), S();
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
              value: g,
              autoFocus: !0,
              onChange: (E) => y(E.target.value.replace(/[^\d]/g, "")),
              onBlur: S,
              onKeyDown: (E) => {
                E.key === "Escape" && (E.preventDefault(), v(!1), y(`${i}`));
              }
            }
          ),
          /* @__PURE__ */ L("span", { className: "reader-react-hud-page-suffix", children: [
            "/ ",
            l || "—"
          ] })
        ]
      }
    ) : /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: "reader-react-hud-page reader-react-hud-page-btn",
        "aria-label": l > 0 ? `跳转页码，当前第 ${i} 页，共 ${l} 页` : "页码",
        title: l > 0 ? "点击输入页码跳转" : void 0,
        disabled: !c || l <= 0,
        onClick: () => {
          !c || l <= 0 || (y(`${i}`), v(!0));
        },
        children: l > 0 ? `${Math.min(i, l)} / ${l}` : "—"
      }
    ) }),
    e.searchSlot ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "搜索", children: e.searchSlot }) : null,
    e.bookmarkScope ? /* @__PURE__ */ p(
      dh,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: l,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: c
      }
    ) : null,
    e.issuesJobId ? /* @__PURE__ */ p(bh, { jobId: e.issuesJobId, currentPage: i }) : null,
    t != null && t.toggleDocDark ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "显示", children: /* @__PURE__ */ p(
      X,
      {
        className: "reader-react-hud-btn reader-react-hud-doc-dark",
        "aria-pressed": t.docDark ? "true" : "false",
        "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
        title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
        onClick: t.toggleDocDark,
        children: /* @__PURE__ */ p(Rh, {})
      }
    ) }) : null,
    /* @__PURE__ */ L("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ p(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !f,
          onClick: () => s(Zt(a, -1)),
          children: "−"
        }
      ),
      /* @__PURE__ */ L(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn reader-react-hud-zoom-label",
          "aria-label": `${u}%，点击${b}`,
          title: b,
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
          onClick: () => s(Zt(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(Xf, {}) })
  ] });
}
function Rh() {
  return /* @__PURE__ */ L("svg", { width: "14", height: "14", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: [
    /* @__PURE__ */ p("circle", { cx: "8", cy: "8", r: "6.25", fill: "none", stroke: "currentColor", strokeWidth: "1.5" }),
    /* @__PURE__ */ p("path", { d: "M8 1.75a6.25 6.25 0 0 1 0 12.5z", fill: "currentColor" })
  ] });
}
function No(e) {
  var t, n;
  return sa(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function Eh(e) {
  const [t, n] = T(() => ({
    scope: e,
    panel: No(Ke(e))
  }));
  C(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: No(Ke(e))
    });
  }, [e]), C(() => {
    t.scope === e && wn(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = D((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const Xn = "download-toast";
function Ph({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ L("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ L("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ p("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ p("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ p("div", { className: "download-toast-track", children: /* @__PURE__ */ p("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ p("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function Th(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    Dn.dismiss(Xn);
    return;
  }
  Dn.custom(
    () => /* @__PURE__ */ p(Ph, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: Xn, duration: 1 / 0 }
  );
}
function Mh() {
  const e = D((t) => {
    t && (t.setState = Th, t.hide = () => Dn.dismiss(Xn));
  }, []);
  return /* @__PURE__ */ L(St, { children: [
    /* @__PURE__ */ p(qs, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function Nh(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : na(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Ah(e, t) {
  return t === null || e !== t;
}
function Lh(e) {
  const t = M(!1);
  return e && (t.current = !0), t.current;
}
function _h(e, t) {
  const n = e === t;
  return { open: n, mounted: Lh(n) };
}
const Ao = { itemId: null, origin: null };
function xh() {
  let e = Ao;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? Ao : { itemId: n, origin: r };
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
function Dh({
  nodes: e,
  currentPage: t,
  onJumpPage: n
}) {
  const r = J(() => ba(e, t), [e, t]), [o, a] = T(() => /* @__PURE__ */ new Set([...Vr(r), ...r ? [r] : []]));
  C(() => {
    a(/* @__PURE__ */ new Set([...Vr(r), ...r ? [r] : []]));
  }, [e]);
  const s = M(null);
  C(() => {
    var c, u;
    (u = (c = s.current) == null ? void 0 : c.querySelector('[aria-current="location"]')) == null || u.scrollIntoView({ block: "center" });
  }, [e]);
  const i = (c) => a((u) => {
    const f = new Set(u);
    return f.has(c) ? f.delete(c) : f.add(c), f;
  }), l = (c) => c.map((u) => {
    const f = o.has(u.id), d = u.children.length > 0;
    return /* @__PURE__ */ L("li", { className: "reader-bookmark", "data-level": u.level, children: [
      /* @__PURE__ */ L("div", { className: "reader-bookmark-row", children: [
        d ? /* @__PURE__ */ p(
          X,
          {
            className: `reader-bookmark-toggle${f ? " is-open" : ""}`,
            "aria-label": f ? `收起「${u.title}」` : `展开「${u.title}」`,
            "aria-expanded": f,
            onClick: () => i(u.id),
            children: /* @__PURE__ */ p(Vo, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 })
          }
        ) : /* @__PURE__ */ p("span", { className: "reader-bookmark-spacer", "aria-hidden": "true" }),
        /* @__PURE__ */ L(
          X,
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
      d && f ? /* @__PURE__ */ p("ol", { className: "reader-bookmark-children", children: l(u.children) }) : null
    ] }, u.id);
  });
  return /* @__PURE__ */ p("ol", { ref: s, className: "reader-finder-list reader-bookmark-tree", "aria-label": "书签", children: l(e) });
}
const Ch = [], zh = [];
function Oh({
  open: e,
  onToggle: t,
  children: n
}) {
  return /* @__PURE__ */ L("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ p(X, { className: "reader-finder-toggle", "aria-label": "目录", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: /* @__PURE__ */ p(Cs, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }) }),
    n
  ] });
}
function $h({ open: e, onToggle: t }) {
  return /* @__PURE__ */ p(
    X,
    {
      className: "reader-react-hud-btn reader-search-toggle",
      "data-finder-toggle": "search",
      "aria-label": "在书里搜索",
      "aria-pressed": e === "search",
      title: "在书里搜索（原文和译文，⌘F）",
      onClick: () => t("search"),
      children: /* @__PURE__ */ p(zs, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 })
    }
  );
}
function Fh({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0,
  bookmarks: l = zh,
  onJumpPage: c
}) {
  var A, I;
  const u = ((A = rt()) == null ? void 0 : A.regions) ?? Ch, f = ((I = Na()) == null ? void 0 : I.currentPage) ?? 1, d = J(() => Uc(u), [u]), h = l.length > 0 && !!c, [b, m] = T("bookmarks"), w = h && (b === "bookmarks" || !d.length), k = Wc(d, f), v = J(() => Jc(u, s), [u, s]), [g, y] = T(-1);
  C(() => y(-1), [s]);
  const S = M(null), E = M(null), N = M(n);
  N.current = n, C(() => {
    const R = (_) => {
      var H, F;
      const x = _.target;
      !x || (H = E.current) != null && H.contains(x) || (F = x.closest) != null && F.call(x, ".reader-finder-toggles, [data-finder-toggle]") || N.current();
    }, P = (_) => {
      _.key === "Escape" && N.current();
    };
    return document.addEventListener("pointerdown", R, !0), document.addEventListener("keydown", P), () => {
      document.removeEventListener("pointerdown", R, !0), document.removeEventListener("keydown", P);
    };
  }, []);
  const z = M(null);
  C(() => {
    var R, P, _;
    e === "search" ? (R = S.current) == null || R.focus() : (_ = (P = z.current) == null ? void 0 : P.querySelector('[aria-current="location"]')) == null || _.scrollIntoView({ block: "center" });
  }, [e, i]), C(() => {
    var R, P;
    e === "search" && g >= 0 && ((P = (R = z.current) == null ? void 0 : R.querySelector('[aria-current="true"]')) == null || P.scrollIntoView({ block: "nearest" }));
  }, [e, g]);
  const $ = (R) => {
    const P = v[R];
    P && (y(R), r(P.itemId));
  };
  return /* @__PURE__ */ L("aside", { ref: E, className: "reader-finder", "data-finder-tab": e, "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ L("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ L("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ p(X, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ p(X, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ p(X, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(kt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" && h && d.length ? /* @__PURE__ */ L("div", { className: "reader-finder-switch", role: "radiogroup", "aria-label": "目录按什么列", children: [
      /* @__PURE__ */ p(X, { className: "reader-finder-switch-option", role: "radio", "aria-checked": w, onClick: () => m("bookmarks"), children: "按书签" }),
      /* @__PURE__ */ p(X, { className: "reader-finder-switch-option", role: "radio", "aria-checked": !w, onClick: () => m("headings"), children: "按标题" })
    ] }) : null,
    e === "outline" && w && c ? /* @__PURE__ */ p(Dh, { nodes: l, currentPage: f, onJumpPage: c }) : e === "outline" ? d.length ? /* @__PURE__ */ p("ol", { ref: z, className: "reader-finder-list", children: d.map((R, P) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(
      X,
      {
        className: "reader-finder-entry",
        "data-level": R.level,
        "aria-current": P === k ? "location" : void 0,
        onClick: () => r(R.itemId),
        children: [
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-text", children: R.text }),
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: R.page })
        ]
      }
    ) }, R.itemId)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: u.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ L(St, { children: [
      /* @__PURE__ */ L("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          Jo,
          {
            ref: S,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "原文、译文里的字",
            "aria-label": "在书里搜索",
            value: o,
            onChange: (R) => a(R.target.value),
            onKeyDown: (R) => {
              R.key === "Enter" ? (R.preventDefault(), $(qc(g, v.length, R.shiftKey))) : R.key === "Escape" && (R.preventDefault(), n()), R.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: v.length === 0 ? "没有找到" : `${g >= 0 ? `第 ${g + 1} / ` : ""}${v.length >= 200 ? "200+ 处，只列前 200 处" : `${v.length} 处`}${g < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { className: "reader-finder-list", children: v.map((R, P) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ L(X, { className: "reader-finder-entry is-hit", "aria-current": P === g ? "true" : void 0, onClick: () => $(P), children: [
        /* @__PURE__ */ L("span", { className: "reader-finder-entry-text", children: [
          R.snippet.slice(0, R.at),
          /* @__PURE__ */ p("mark", { children: R.snippet.slice(R.at, R.at + R.length) }),
          R.snippet.slice(R.at + R.length)
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: R.page })
      ] }) }, R.itemId)) })
    ] })
  ] });
}
function Bh({ active: e, compare: t, ink: n }) {
  const [r, o] = T(!1), [a, s] = T(!1), i = M(null);
  C(() => {
    if (!r && !a) return;
    const c = () => {
      o(!1), s(!1);
    }, u = (d) => {
      var h;
      (h = i.current) != null && h.contains(d.target) || c();
    }, f = (d) => {
      d.key === "Escape" && c();
    };
    return document.addEventListener("pointerdown", u, !0), document.addEventListener("keydown", f), () => {
      document.removeEventListener("pointerdown", u, !0), document.removeEventListener("keydown", f);
    };
  }, [r, a]);
  const l = !!(t.compared || t.loading);
  return /* @__PURE__ */ L("div", { className: "reader-toolball", ref: i, "data-open": r ? "true" : void 0, children: [
    a ? /* @__PURE__ */ p(Ud, { compare: t, onDone: () => {
      s(!1), o(!1);
    } }) : null,
    r ? /* @__PURE__ */ L("div", { className: "reader-toolball-stack", role: "group", "aria-label": "工具", children: [
      n ? /* @__PURE__ */ p(
        X,
        {
          className: "reader-toolball-item",
          "aria-label": "画笔",
          title: "画笔（P；书页上右键也能选笔和颜色）",
          "aria-pressed": !!n.tool,
          "data-toolball-item": "ink",
          onClick: () => {
            n.setTool(n.tool ? null : "pen"), o(!1);
          },
          children: /* @__PURE__ */ p(er, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null,
      /* @__PURE__ */ p(of, { active: e }),
      t.available ? /* @__PURE__ */ p(
        X,
        {
          className: "reader-toolball-item",
          "aria-label": "对比版本",
          title: "对比版本：左边换成这本书的另一份译文",
          "aria-pressed": l || a,
          "data-toolball-item": "compare",
          onClick: () => s((c) => !c),
          children: /* @__PURE__ */ p(Os, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null
    ] }) : null,
    /* @__PURE__ */ p(
      X,
      {
        className: "reader-toolball-ball",
        "aria-label": r ? "收起工具" : "工具：画笔、Markdown、对比版本",
        title: r ? "收起" : "工具",
        "aria-expanded": r,
        "data-active": e || l ? "true" : void 0,
        onClick: () => {
          o((c) => !c), s(!1);
        },
        children: r ? /* @__PURE__ */ p(kt, { size: 20, strokeWidth: 2.2, "aria-hidden": !0 }) : /* @__PURE__ */ p($s, { size: 20, strokeWidth: 2.1, "aria-hidden": !0 })
      }
    )
  ] });
}
const jh = [
  { tool: "pen", label: "画笔", Icon: er },
  { tool: "highlighter", label: "荧光笔", Icon: Fs },
  { tool: "eraser", label: "橡皮", Icon: Bs }
];
function Ya(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Qa({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ L(St, { children: [
    jh.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
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
    Ra.map((o) => /* @__PURE__ */ p(
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
    /* @__PURE__ */ p(X, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(js, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      X,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p(Hs, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
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
        children: /* @__PURE__ */ p(kt, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function Hh({
  ink: e,
  menu: t,
  onClose: n,
  actions: r = []
}) {
  const o = M(null);
  if (C(() => {
    if (!t) return;
    const l = (u) => {
      var f;
      (f = o.current) != null && f.contains(u.target) || n();
    }, c = (u) => {
      u.key === "Escape" && n();
    };
    return document.addEventListener("pointerdown", l, !0), document.addEventListener("keydown", c), () => {
      document.removeEventListener("pointerdown", l, !0), document.removeEventListener("keydown", c);
    };
  }, [t, n]), !t) return null;
  const a = 380, s = Math.max(8, Math.min(t.x, (globalThis.innerWidth || a) - a - 8)), i = Math.max(68, Math.min(t.y, (globalThis.innerHeight || 600) - 60 - (r.length ? 40 : 0)));
  return /* @__PURE__ */ L("div", { ref: o, className: "reader-ink-menu", style: { left: s, top: i }, "data-ink-menu": "true", children: [
    r.length ? /* @__PURE__ */ p("div", { className: "reader-ink-menu-actions", role: "menu", "aria-label": "书页", children: r.map((l) => /* @__PURE__ */ L(
      X,
      {
        className: "reader-ink-menu-action",
        role: "menuitem",
        title: l.hint,
        onClick: () => {
          l.onSelect(), n();
        },
        children: [
          l.label,
          l.hint ? /* @__PURE__ */ p("kbd", { children: l.hint }) : null
        ]
      },
      l.key
    )) }) : null,
    /* @__PURE__ */ p("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ p(Qa, { ink: e, page: t.page, onPick: n }) })
  ] });
}
function Uh({ ink: e }) {
  return e.tool ? /* @__PURE__ */ p("div", { className: "reader-ink-bar is-dock", role: "toolbar", "aria-label": "画笔", "data-ink-dock": "true", children: /* @__PURE__ */ p(Qa, { ink: e }) }) : null;
}
function Wh(e) {
  var r;
  if (e.shiftKey || Ya(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${Yo}`))) return null;
  const n = Number((r = t.closest(`[${Ee}]`)) == null ? void 0 : r.getAttribute(Ee)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Kh(e) {
  const t = M(e);
  t.current = e, C(() => {
    const n = (r) => {
      if (Ya(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
function _n() {
  try {
    return nt().translationVersions ?? null;
  } catch {
    return null;
  }
}
function Vh(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function Jh(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function qh(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function Gh({ documentId: e, jobId: t }) {
  const [n, r] = T([]), [o, a] = T(null), [s, i] = T(null), [l, c] = T(""), [u, f] = T(""), d = M(0);
  C(() => {
    r([]), i(null), f("");
    const w = _n();
    if (!w || !e) return;
    let k = !1;
    return w.list(e).then((v) => {
      k || (r(v.versions), a(v.currentVersionId));
    }).catch(() => {
    }), () => {
      k = !0;
    };
  }, [e, t]);
  const h = D((w) => {
    const k = _n(), v = n.find((y) => y.versionId === w);
    if (!k || !v || !e) return;
    const g = ++d.current;
    c(w), f(""), (async () => {
      const y = nt(), S = await k.resolveJob(e, w);
      if (!S) throw new Error("这一份还没有能读的译文。");
      const E = await y.loadReaderPayload(S, { includeOptionalArtifacts: !0 }), N = y.resolveReaderTranslatedPdfUrl(E.jobPayload, E.manifestPayload);
      if (!N) throw new Error("这一份没有译文 PDF。");
      return { versionId: w, name: v.name, jobId: S, url: N, regions: Vh(Bo(E.regionsPayload)) };
    })().then((y) => {
      g === d.current && i(y);
    }).catch((y) => {
      g === d.current && f((y == null ? void 0 : y.message) || "这一份打不开。");
    }).finally(() => {
      g === d.current && c("");
    });
  }, [e, n]), b = D(() => {
    d.current += 1, i(null), c(""), f("");
  }, []), m = D(async () => {
    var v, g;
    const w = _n();
    if (!w || !s || !e) return;
    try {
      await w.select(e, s.versionId);
    } catch (y) {
      f((y == null ? void 0 : y.message) || "换不过去，请稍后再试。");
      return;
    }
    const k = (v = globalThis.location) == null ? void 0 : v.href;
    k && ((g = globalThis.history) == null || g.replaceState(globalThis.history.state, "", qh(k, s.jobId))), i(null);
  }, [s, e]);
  return {
    available: n.length >= 2,
    versions: n,
    readingVersionId: Jh(n, t, o),
    compared: s,
    loading: l,
    error: u,
    choose: h,
    clear: b,
    adopt: m
  };
}
const Xh = "reader-finder-input";
function Zh(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function Yh(e, t = typeof window > "u" ? null : window) {
  C(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!Zh(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(Xh) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function Qh() {
  try {
    return nt().translationEdit ?? null;
  } catch {
    return null;
  }
}
const em = "这本书正在处理（翻译或排版），处理完才能改。", tm = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function nm({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = Qh(), s = `${e || ""}`.trim(), i = !!(a && s && r), l = iu(s), c = !t || qt(t), u = hu(n), [f, d] = T(""), [h, b] = T(null), [m, w] = T(() => /* @__PURE__ */ new Map()), [k, v] = T(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [g, y] = T(() => /* @__PURE__ */ new Map()), [S, E] = T({ phase: "idle" }), N = M({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  C(() => {
    b(null), N.drafts.clear(), N.generation.current = null, y(/* @__PURE__ */ new Map()), E({ phase: "idle" });
  }, [s]), C(() => {
    if (d(""), !i || l || !a) return;
    let x = !1;
    return a.resolveOwnerJobId(s).then((H) => {
      x || d(`${H || s}`.trim() || s);
    }).catch(() => {
      x || d(s);
    }), () => {
      x = !0;
    };
  }, [i, l, a, s]), C(() => {
    if (w(/* @__PURE__ */ new Map()), !a || !f || !u || !c) return;
    let x = !1;
    return a.fetchRevisions(f).then((H) => {
      x || w(mu(H, u));
    }).catch(() => {
    }), () => {
      x = !0;
    };
  }, [a, f, u, c]);
  const z = S.phase === "running" && S.seenActive;
  C(() => {
    if (S.phase === "running") {
      if (!c) {
        z || E({ phase: "running", seenActive: !0 });
        return;
      }
      z && E(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [S.phase, z, c, t]);
  const $ = J(() => {
    const x = new Map(m);
    if (k.renderedAt === u)
      for (const [H, F] of k.edits) x.set(H, F);
    return x;
  }, [m, k, u]), A = D((x) => {
    const H = `${x || ""}`.trim();
    H && b({ itemId: H, page: lu(H) });
  }, []), I = D(() => b(null), []), R = D((x, H) => {
    v((F) => {
      const G = new Map(F.renderedAt === u ? F.edits : []);
      return G.set(x, H), { renderedAt: u, edits: G };
    }), y((F) => new Map(F).set(x, (F.get(x) || 0) + 1));
  }, [u]), P = D(async () => {
    if (!(!a || !s || S.phase === "submitting" || S.phase === "running")) {
      E({ phase: "submitting" });
      try {
        await a.rerender(s), E({ phase: "running", seenActive: !1 }), await o();
      } catch (x) {
        E({ phase: "failed", message: (x == null ? void 0 : x.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, S.phase, o]), _ = l ? tm : !c || S.phase === "running" || S.phase === "submitting" ? em : "";
  return J(() => ({
    available: i,
    blockedReason: _,
    port: a,
    ownerJobId: f,
    target: h,
    select: A,
    close: I,
    memory: N,
    pendingEdits: $,
    savedCounts: g,
    markSaved: R,
    rerender: S,
    startRerender: P
  }), [i, _, a, f, h, A, I, N, $, g, R, S, P]);
}
function rm(e, t) {
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
function om({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ p("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ L("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
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
const es = "retainpdf:reader:doc-theme:v1", Lo = "data-reader-doc";
function ts() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function am(e = ts()) {
  try {
    return (e == null ? void 0 : e.getItem(es)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function sm(e, t = ts()) {
  try {
    t == null || t.setItem(es, e);
  } catch {
  }
}
function _o(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(Lo, "dark") : t.removeAttribute(Lo));
}
function im() {
  const [e, t] = T(() => am());
  C(() => {
    _o(e);
  }, [e]), C(() => () => _o("light"), []);
  const n = D(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return sm(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
const xo = 6e3;
function ns(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function lm(e, t, n, r) {
  const o = e.width * t.width, a = e.height * t.height;
  let s = n * r / Math.max(1, o);
  const i = Math.max(o, a) * s;
  return i > xo && (s *= xo / i), {
    scale: s,
    offsetX: -e.left * t.width * s,
    offsetY: -e.top * t.height * s,
    canvasWidth: Math.max(1, Math.round(o * s)),
    canvasHeight: Math.max(1, Math.round(a * s)),
    /** 显示高度（CSS 像素），按区域的宽高比。 */
    cssHeight: Math.round(n * (a / Math.max(1, o)))
  };
}
function rs({
  pdf: e,
  page: t,
  region: n,
  cssWidth: r,
  className: o,
  label: a
}) {
  const s = M(null), [i, l] = T({ status: "loading", cssHeight: 0 }), c = `${t}:${n.left}:${n.top}:${n.width}:${n.height}:${Math.round(r)}`;
  return C(() => {
    let u = !1, f = null;
    return l((d) => ({ status: "loading", cssHeight: d.cssHeight })), (async () => {
      try {
        const d = await e.getPage(t);
        if (u) return;
        const h = d.getViewport({ scale: 1 }), b = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), m = lm(n, h, r, b), w = s.current, k = w == null ? void 0 : w.getContext("2d");
        if (!w || !k) return;
        w.width = m.canvasWidth, w.height = m.canvasHeight, l({ status: "loading", cssHeight: m.cssHeight });
        const v = d.getViewport({ scale: m.scale, offsetX: m.offsetX, offsetY: m.offsetY }), g = d.render({ canvasContext: k, viewport: v });
        f = g, await g.promise, u || l({ status: "ready", cssHeight: m.cssHeight });
      } catch (d) {
        !u && (d == null ? void 0 : d.name) !== "RenderingCancelledException" && l((h) => ({ status: "error", cssHeight: h.cssHeight }));
      }
    })(), () => {
      u = !0, f == null || f.cancel();
    };
  }, [e, c]), /* @__PURE__ */ L(
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
const Do = { figure: "图", table: "表", formula: "公式", text: "文字" }, st = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function cm(e, t, n) {
  const r = Gt(e, t, n), o = r ? zt(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = ns({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function um(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, l = null;
  for (const u of e) {
    const f = Gt(u, t, n), d = f ? zt(f, 1, 1) : null;
    !f || !d || (r || (r = f.box.page, l = f.pageSize), f.box.page === r && (o = Math.min(o, d.left), a = Math.min(a, d.top), s = Math.max(s, d.left + d.width), i = Math.max(i, d.top + d.height)));
  }
  if (!r || !l) return null;
  const c = ns({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: c, aspect: c.height * l.height / Math.max(1e-6, c.width * l.width) };
}
function dm(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function fm(e, t) {
  const n = (o) => {
    const a = De(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function hm({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var $;
  const i = t.find((A) => A.itemId === e) ?? null, l = J(() => i ? fm(t, i) : [], [t, i]), c = i ? l.indexOf(i) : -1, [u, f] = T(st.indexOf(1)), d = st[u], h = M(null), [b, m] = T(0);
  Pe(() => {
    const A = h.current;
    if (!A) return;
    const I = () => m(A.clientWidth);
    I();
    const R = typeof ResizeObserver == "function" ? new ResizeObserver(I) : null;
    return R == null || R.observe(A), () => R == null ? void 0 : R.disconnect();
  }, []);
  const w = D((A) => {
    const I = l[c + A];
    I && a(I.itemId);
  }, [l, c, a]);
  C(() => {
    const A = (I) => {
      if (I.key === "Escape")
        I.preventDefault(), s();
      else if (I.key === "ArrowLeft")
        I.preventDefault(), w(-1);
      else if (I.key === "ArrowRight")
        I.preventDefault(), w(1);
      else if (I.key === "+" || I.key === "=")
        I.preventDefault(), f((R) => Math.min(st.length - 1, R + 1));
      else if (I.key === "-" || I.key === "_")
        I.preventDefault(), f((R) => Math.max(0, R - 1));
      else if (I.key === "0")
        I.preventDefault(), f(st.indexOf(1));
      else
        return;
      I.stopPropagation();
    };
    return window.addEventListener("keydown", A, !0), () => window.removeEventListener("keydown", A, !0);
  }, [s, w]), C(() => {
    const A = h.current;
    if (!A) return;
    const I = (R) => {
      !R.ctrlKey && !R.metaKey || (R.preventDefault(), f((P) => Math.max(0, Math.min(st.length - 1, P + (R.deltaY < 0 ? 1 : -1)))));
    };
    return A.addEventListener("wheel", I, { passive: !1 }), () => A.removeEventListener("wheel", I);
  }, []);
  const k = M(null);
  if (!i) return null;
  const v = De(i), g = o.map((A) => ({ pane: A, pdf: r[A] ?? null, where: cm(i, n, A) })).filter((A) => !!(A.pdf && A.where)), y = 16, S = typeof window > "u" ? 800 : window.innerHeight, E = Math.min(880, S * 0.9) - 56 - 32 - (g.length > 1 ? 26 : 0), N = g.length ? dm(Math.max(120, (b - y * (g.length - 1) - 32) / g.length), E, g.map((A) => A.where.aspect)) : 0, z = (($ = g[0]) == null ? void 0 : $.where.page) ?? i.source.page;
  return /* @__PURE__ */ L("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${Do[v] ?? "这一块"}`, children: [
    /* @__PURE__ */ p("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ L("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ L("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ L("span", { className: "reader-zoom-title", children: [
          Do[v] ?? "这一块",
          " · 第 ",
          z,
          " 页"
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-zoom-count", children: c >= 0 ? `${c + 1} / ${l.length}` : "" }),
        /* @__PURE__ */ L("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ p(gt, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: c <= 0, onClick: () => w(-1), children: /* @__PURE__ */ p(Us, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(gt, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: c < 0 || c >= l.length - 1, onClick: () => w(1), children: /* @__PURE__ */ p(Vo, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(gt, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => f((A) => Math.max(0, A - 1)), children: /* @__PURE__ */ p(Ws, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ L(X, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => f(st.indexOf(1)), children: [
            Math.round(d * 100),
            "%"
          ] }),
          /* @__PURE__ */ p(gt, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === st.length - 1, onClick: () => f((A) => Math.min(st.length - 1, A + 1)), children: /* @__PURE__ */ p(Ks, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(gt, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: s, children: /* @__PURE__ */ p(kt, { size: 16, "aria-hidden": !0 }) })
        ] })
      ] }),
      /* @__PURE__ */ p(
        "div",
        {
          ref: h,
          className: "reader-zoom-body",
          onPointerDown: (A) => {
            const I = h.current;
            !I || A.button !== 0 || (k.current = { x: A.clientX, y: A.clientY, left: I.scrollLeft, top: I.scrollTop }, I.setPointerCapture(A.pointerId));
          },
          onPointerMove: (A) => {
            const I = h.current, R = k.current;
            !I || !R || (I.scrollLeft = R.left - (A.clientX - R.x), I.scrollTop = R.top - (A.clientY - R.y));
          },
          onPointerUp: () => {
            k.current = null;
          },
          children: g.length && b ? /* @__PURE__ */ p("div", { className: "reader-zoom-columns", style: { gap: y }, children: g.map(({ pane: A, pdf: I, where: R }) => /* @__PURE__ */ L("figure", { className: "reader-zoom-column", children: [
            g.length > 1 ? /* @__PURE__ */ p("figcaption", { children: A === "source" ? "原文" : "译文" }) : null,
            /* @__PURE__ */ p(
              rs,
              {
                className: "reader-zoom-canvas",
                pdf: I,
                page: R.page,
                region: R.fraction,
                cssWidth: N * d,
                label: `${A === "source" ? "原文" : "译文"}第 ${R.page} 页`
              }
            )
          ] }, A)) }) : /* @__PURE__ */ p("p", { className: "reader-zoom-empty", children: b ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
const mm = 380, pm = 320, Mt = 8;
function gm(e, t, n) {
  const r = Math.max(Mt, Math.min(e.left, n.width - t.width - Mt)), o = e.bottom + Mt, a = o + t.height <= n.height - Mt ? o : Math.max(Mt, e.top - Mt - t.height);
  return { left: r, top: a };
}
function bm({
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
    const h = r[d], b = h ? um(o, n, d) : null;
    if (h && b) {
      s = { pdf: h, where: b };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min(mm, pm / Math.max(0.05, s.where.aspect))), l = Math.round(i * s.where.aspect) + 30, c = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: f } = gm(e.anchor, { width: Math.max(i, 160) + 16, height: l + 16 }, c);
  return /* @__PURE__ */ L("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: f }, children: [
    /* @__PURE__ */ L("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ p("span", { children: Xr(e.target) }),
      /* @__PURE__ */ L("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ p(rs, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: Xr(e.target) })
  ] });
}
const ym = 4e3;
function vm(e, t, n) {
  if (e.length) {
    const o = ba(e, n), a = o ? ga(e).find((s) => s.id === o) : null;
    if (a) return a.title;
  }
  let r = null;
  for (const o of t)
    !o.headingLevel || o.source.page > n || (!r || o.source.page >= r.source.page) && (r = o);
  return `${(r == null ? void 0 : r.source.text) || (r == null ? void 0 : r.markdown) || ""}`.replace(/\s+/g, " ").trim().slice(0, 80);
}
function Co(e) {
  var a, s;
  if (!e || e.isCollapsed || !e.rangeCount) return { text: "", element: null, rect: null };
  const t = e.getRangeAt(0), n = t.startContainer, r = ((s = (a = n.nodeType === 1 ? n : n.parentElement) == null ? void 0 : a.closest) == null ? void 0 : s.call(a, `[${Ee}]`)) ?? null;
  return r ? { text: `${e}`.replace(/\s+\n/g, `
`).trim().slice(0, ym), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function wm(e, t, n, r, o) {
  let a = null, s = 0.15;
  for (const i of e) {
    const l = Gt(i, t, n);
    if (!l || l.box.page !== r) continue;
    const c = zt(l, 1, 1);
    if (!c) continue;
    const u = o.y < c.top ? c.top - o.y : o.y > c.top + c.height ? o.y - c.top - c.height : 0, f = o.x < c.left ? c.left - o.x : o.x > c.left + c.width ? o.x - c.left - c.width : 0, d = u + f * 0.25;
    (d < s || d === 0 && a === null) && (a = i, s = d);
  }
  return a;
}
function Sm({
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
  const l = Number(e.getAttribute(Ee)) || 0;
  if (l < 1) return null;
  const c = e.getAttribute(Ie) === "source" ? "source" : "translated", u = e.getBoundingClientRect(), f = u.width > 0 && u.height > 0 ? { x: Math.min(1, Math.max(0, (t - u.left) / u.width)), y: Math.min(1, Math.max(0, (n - u.top) / u.height)) } : null, h = (r ? a.find((b) => b.itemId === r) ?? null : null) ?? (f ? wm(a, i, c, l, f) : null);
  return {
    pane: c,
    page: l,
    itemId: (h == null ? void 0 : h.itemId) ?? null,
    selection: o,
    sourceText: `${(h == null ? void 0 : h.source.text) || (h == null ? void 0 : h.markdown) || ""}`.trim(),
    translatedText: `${(h == null ? void 0 : h.translatedBlockText) || (h == null ? void 0 : h.translated.text) || ""}`.trim(),
    section: vm(s, a, (h == null ? void 0 : h.source.page) ?? l),
    point: f
  };
}
function km({ port: e, documentId: t, resetKey: n }) {
  const r = (e == null ? void 0 : e.threads) ?? null, [o, a] = T([]), [s, i] = T(null), l = M(0), c = M(o);
  c.current = o;
  const u = M(/* @__PURE__ */ new Map()), f = M(/* @__PURE__ */ new Set()), d = () => (l.current += 1, l.current);
  C(() => {
    if (i(null), a([]), u.current.clear(), !r || !t) return;
    let v = !1;
    return r.list(t).then(
      (g) => {
        v || a(g.map((y) => ({ key: d(), anchor: y.anchor, threadId: y.threadId, title: y.title })));
      },
      () => {
      }
    ), () => {
      v = !0;
    };
  }, [r, t, n]);
  const h = D((v) => {
    const g = d();
    a((y) => [...y, { key: g, anchor: v }]), i({ key: g, anchor: v, initial: [] });
  }, []), b = D(async (v) => {
    const g = u.current.get(v.key);
    if (g || !v.threadId || !r || !t) {
      i({ key: v.key, anchor: v.anchor, initial: g || [] });
      return;
    }
    try {
      const y = await r.get(t, v.threadId), S = y.messages || [];
      u.current.set(v.key, S), i({ key: v.key, anchor: y.anchor || v.anchor, initial: S });
    } catch {
      i({ key: v.key, anchor: v.anchor, initial: [] });
    }
  }, [r, t]), m = D((v, g, y) => {
    if (u.current.set(v, g), !r || !t) return;
    const S = c.current.find((E) => E.key === v);
    if (S) {
      if (S.threadId) {
        r.update(t, S.threadId, { agentId: y, messages: g }).catch(() => {
        });
        return;
      }
      f.current.has(v) || (f.current.add(v), r.create(t, { agentId: y, anchor: S.anchor, messages: g }).then(
        (E) => {
          a((z) => z.map(($) => $.key === v ? { ...$, threadId: E.threadId, title: E.title } : $));
          const N = u.current.get(v);
          N && N.length > g.length && r.update(t, E.threadId, { agentId: y, messages: N }).catch(() => {
          });
        },
        () => {
        }
      ).finally(() => f.current.delete(v)));
    }
  }, [r, t]), w = D((v) => {
    const g = c.current.find((y) => y.key === v);
    a((y) => y.filter((S) => S.key !== v)), i((y) => (y == null ? void 0 : y.key) === v ? null : y), u.current.delete(v), g != null && g.threadId && r && t && r.remove(t, g.threadId).catch(() => {
    });
  }, [r, t]), k = D(() => {
    i((v) => {
      var g;
      if (v && !((g = u.current.get(v.key)) != null && g.length)) {
        const y = c.current.find((S) => S.key === v.key);
        y && !y.threadId && a((S) => S.filter((E) => E.key !== v.key));
      }
      return null;
    });
  }, []);
  return { marks: o, open: s, ask: h, reopen: b, save: m, remove: w, close: k, persistent: !!(r && t) };
}
const Im = 250;
function Rm(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function Em(e, t, n) {
  const r = n === "back" ? e.back : e.forward;
  if (!r.length) return null;
  const o = r[r.length - 1], a = r.slice(0, -1), s = n === "back" ? { back: a, forward: [...e.forward, t] } : { back: [...e.back, t], forward: a };
  return { to: o, history: s };
}
function Pm(e) {
  var n;
  const t = e;
  return !!((n = t == null ? void 0 : t.closest) != null && n.call(t, "input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
function Tm({
  shellEl: e,
  index: t,
  primaryPane: n,
  follow: r
}) {
  const [o, a] = T(null), [s, i] = T({ back: [], forward: [] }), l = M(s);
  l.current = s;
  const c = M(null), u = M({ index: t, primaryPane: n, follow: r, shellEl: e });
  u.current = { index: t, primaryPane: n, follow: r, shellEl: e };
  const f = D(() => {
    const { shellEl: h, primaryPane: b } = u.current;
    return Vt(h, b);
  }, []);
  C(() => {
    if (!e) return;
    const h = (g) => {
      var y, S;
      return (S = (y = g.target) == null ? void 0 : y.closest) == null ? void 0 : S.call(y, `.${ya}`);
    }, b = () => {
      c.current != null && window.clearTimeout(c.current), c.current = null;
    }, m = (g) => {
      var N;
      const y = h(g);
      if (!y) return;
      const S = u.current.index.get(y.getAttribute(Hn) || "");
      if (!S) return;
      const E = ((N = y.closest("[data-reader-pane]")) == null ? void 0 : N.getAttribute("data-reader-pane")) || u.current.primaryPane;
      b(), c.current = window.setTimeout(() => {
        const z = y.getBoundingClientRect();
        a({ target: S, pane: E, anchor: { left: z.left, top: z.top, right: z.right, bottom: z.bottom } });
      }, Im);
    }, w = (g) => {
      const y = h(g);
      !y || y.contains(g.relatedTarget) || (b(), a(null));
    }, k = (g) => {
      var z, $;
      const y = h(g);
      if (!y || g.button !== 0 || g.metaKey || g.ctrlKey || g.shiftKey || `${((z = window.getSelection) == null ? void 0 : z.call(window)) || ""}`.trim()) return;
      const S = u.current.index.get(y.getAttribute(Hn) || "");
      if (!S) return;
      g.preventDefault(), g.stopPropagation(), b(), a(null);
      const E = (($ = y.closest("[data-reader-pane]")) == null ? void 0 : $.getAttribute("data-reader-pane")) || u.current.primaryPane, N = f();
      N && i((A) => Rm(A, N)), u.current.follow(S, E);
    }, v = () => {
      b(), a(null);
    };
    return e.addEventListener("pointerover", m), e.addEventListener("pointerout", w), e.addEventListener("click", k, !0), e.addEventListener("scroll", v, { passive: !0 }), () => {
      b(), e.removeEventListener("pointerover", m), e.removeEventListener("pointerout", w), e.removeEventListener("click", k, !0), e.removeEventListener("scroll", v);
    };
  }, [e, f]);
  const d = D((h) => {
    const b = f();
    if (!b) return !1;
    const m = Em(l.current, b, h);
    if (!m) return !1;
    const { shellEl: w, primaryPane: k } = u.current;
    return xt(w, m.to, "auto", k) ? (i(m.history), !0) : !1;
  }, [f]);
  return C(() => {
    const h = (b) => {
      if (!b.altKey || b.metaKey || b.ctrlKey || b.shiftKey || b.defaultPrevented || b.key !== "ArrowLeft" && b.key !== "ArrowRight" || Pm(b.target)) return;
      d(b.key === "ArrowLeft" ? "back" : "forward") && b.preventDefault();
    };
    return window.addEventListener("keydown", h), () => window.removeEventListener("keydown", h);
  }, [d]), {
    preview: o,
    closePreview: D(() => a(null), []),
    canGoBack: s.back.length > 0,
    backPage: s.back.length ? s.back[s.back.length - 1].page : null,
    goBack: D(() => d("back"), [d])
  };
}
const Mm = Fo(() => import("./ReaderMarkdownPanel-DnFYwmTh.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), Nm = Fo(() => import("./ReaderAskWindow-kmg4CAqG.js")), Am = [];
function Lm(e) {
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
function _m(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function xm() {
  var Er;
  const e = pc(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = Eh(e.viewStateKey), s = a.panel, i = a.setPanel, [l, c] = T(!1), u = M(null), f = M(null), d = s !== null, h = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, b = Lm({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: h,
    liveTranslationVisible: l,
    assistantOpen: d
  }), m = nc({
    hasOverlayContent: h,
    connection: e.liveTranslation.connection,
    showSource: b.showSource,
    liveTranslationVisible: l,
    assistantOpen: d
  }), w = b.sourceViewOnly, k = b.visibleMode;
  C(() => {
    c(!1);
  }, [e.viewStateKey]), C(() => {
    e.session.jobTerminal && c(!1);
  }, [e.session.jobTerminal]);
  const v = M(null);
  C(() => {
    v.current !== e.viewStateKey && ac({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: w,
      jobTerminal: e.session.jobTerminal
    }) && (v.current = e.viewStateKey, c(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, w]), C(() => {
    if (!(t.loading || t.failed)) {
      if (u.current !== e.viewStateKey) {
        u.current = e.viewStateKey;
        const j = Ke(e.viewStateKey), U = Nh({
          savedMode: j == null ? void 0 : j.mode,
          sourceViewOnly: w,
          viewportWidth: ut()
        });
        f.current = U.auto ? U.mode : null, U.mode && U.mode !== e.mode && e.setModeKeepingPage(U.mode);
        return;
      }
      Ah(e.mode, f.current) && (f.current = null, wn(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, w]);
  const g = s || (e.mode === "compare" ? "compare" : "reading"), y = _h(s, "markdown"), { docDark: S, toggleDocDark: E } = im();
  kc({
    toggleDocDark: E,
    mode: k,
    sourceOnly: e.sourceOnly,
    setMode: e.setModeKeepingPage,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    currentPage: e.currentPage,
    numPages: n.hudNumPages,
    goToPage: e.goToPage,
    enabled: e.showHud
  });
  const N = D(() => {
    i(null);
  }, []), z = rc(e.liveTranslation), $ = D(() => {
    z && e.goToPage(z, "source");
  }, [e.goToPage, z]), [A, I] = T(null);
  C(() => {
    k === "compare" && e.session.jobTerminal && I(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, k]);
  const R = A !== e.viewStateKey && sc({
    state: e.liveTranslation,
    sourceViewOnly: w,
    visibleMode: k
  }), P = D((j) => {
    const U = _m(j, e.liveTranslationAvailable);
    U !== null && c(U), e.setModeKeepingPage(j);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), _ = J(() => m.sourcePaneToggle ? /* @__PURE__ */ p(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${l ? " is-active" : ""}`,
      onClick: () => c((j) => !j),
      "aria-pressed": l,
      title: l ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [m.sourcePaneToggle, l]), x = D((j) => {
    i(j);
  }, []), [H] = T(xh), [F, G] = T(null), Z = D((j) => G((U) => U === j ? null : j), []), [ae, se] = T(""), [ce, ue] = T("");
  C(() => {
    const j = ae.replace(/\s+/gu, " ").trim(), U = window.setTimeout(() => ue(j), j ? 150 : 0);
    return () => window.clearTimeout(U);
  }, [ae]);
  const [le, Ce] = T(0), te = D(() => {
    G("search"), Ce((j) => j + 1);
  }, []);
  Yh(te);
  const re = D((j) => {
    e.jumpToAnchor({ block_id: j }), (F === "outline" || ut() < 900) && G(null);
  }, [e.jumpToAnchor, F]), fe = D((j) => e.jumpToAnchor({ block_id: j }), [e.jumpToAnchor]), [ve, Se] = T({}), pe = M({ source: r.sourceUrl, translated: r.translatedUrl });
  pe.current = { source: r.sourceUrl, translated: r.translatedUrl };
  const Ve = D((j, U) => {
    Se((ye) => ({ ...ye, [U]: { url: pe.current[U], nodes: j } }));
  }, []), Je = J(() => {
    const j = ve.source;
    if (j && j.url === r.sourceUrl && j.nodes.length) return j.nodes;
    const U = ve.translated;
    return U && U.url === r.translatedUrl && U.nodes.length ? U.nodes : Am;
  }, [ve, r.sourceUrl, r.translatedUrl]), ze = M({}), [oe, de] = T(0), ge = D((j, U) => {
    ze.current[U] = { url: pe.current[U], pdf: j }, de((ye) => ye + 1);
  }, []), [B, q] = T(null), ee = D((j) => q(j), []), Oe = D(() => q(null), []);
  C(() => q(null), [e.viewStateKey]);
  const Te = J(() => {
    const j = (U, ye) => {
      const me = ze.current[U];
      return me && me.url === ye ? me.pdf : null;
    };
    return { source: j("source", r.sourceUrl), translated: j("translated", r.translatedUrl) };
  }, [oe, r.sourceUrl, r.translatedUrl]), Me = J(() => tu(o.regions), [o.regions]), $e = D(
    (j, U) => e.jumpToAnchor({ block_id: j.itemId }, U),
    [e.jumpToAnchor]
  ), Ne = Tm({ shellEl: e.shell.shellEl, index: Me, primaryPane: e.panes.primaryPane, follow: $e }), Fe = D((j) => {
    e.goToPage(j), (F === "outline" || ut() < 900) && G(null);
  }, [e.goToPage, F]), we = nm({
    jobId: o.jobId,
    jobStatus: o.jobStatus,
    jobPayload: o.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!r.translatedUrl,
    refreshJobStatus: o.refreshJobStatus
  }), Ae = we.select, je = e.setModeKeepingPage, qe = o.regions, He = D((j) => {
    yu(qe, j) && (k === "source" && je("compare"), Ae(j));
  }, [qe, Ae, k, je]);
  rm(we.available ? He : null, H);
  const Le = ld(e.viewStateKey);
  Kh(Le);
  const [ot, ht] = T(null), O = D(() => ht(null), []), W = J(() => {
    try {
      return nt().ask ?? null;
    } catch {
      return null;
    }
  }, []), [V, Y] = T(null), Q = km({ port: W, documentId: o.documentId || "", resetKey: e.viewStateKey }), K = Q.marks, ne = Q.ask, be = Q.reopen, at = Q.open, Sn = D(
    (j, U, ye, me) => Sm({
      pageElement: (j == null ? void 0 : j.closest(`[${Ee}]`)) ?? null,
      clientX: U,
      clientY: ye,
      itemId: H.get().itemId,
      selection: me,
      regions: o.regions,
      bookmarks: Je,
      metadata: o.readerMetadata
    }),
    [H, o.regions, Je, o.readerMetadata]
  );
  C(() => {
    if (!W) return;
    const j = (U) => {
      var Et, Pr;
      if (U.key !== "?" || U.metaKey || U.ctrlKey || U.altKey || U.defaultPrevented) return;
      const ye = U.target;
      if ((Et = ye == null ? void 0 : ye.closest) != null && Et.call(ye, "input, textarea, select, [contenteditable='true']")) return;
      const me = Co(((Pr = globalThis.getSelection) == null ? void 0 : Pr.call(globalThis)) ?? null);
      if (!me.text || !me.element || !me.rect) return;
      const Ge = Sn(me.element, me.rect.left + me.rect.width / 2, me.rect.top + me.rect.height / 2, me.text);
      Ge && (U.preventDefault(), U.stopImmediatePropagation(), ne(Ge));
    };
    return window.addEventListener("keydown", j, !0), () => window.removeEventListener("keydown", j, !0);
  }, [W, Sn, ne]);
  const mt = Gh({ documentId: o.documentId, jobId: o.jobId }), kr = ((Er = mt.compared) == null ? void 0 : Er.url) || "";
  C(() => {
    kr && k !== "compare" && P("compare");
  }, [kr]), C(() => {
    k !== "compare" && mt.clear();
  }, [k]);
  const Ir = J(
    () => {
      const { compared: j, versions: U, readingVersionId: ye } = mt;
      if (!j) return null;
      const me = U.find((Et) => Et.versionId === j.versionId), Ge = U.find((Et) => Et.versionId === ye);
      return {
        url: j.url,
        regions: j.regions,
        left: { name: j.name, createdAt: (me == null ? void 0 : me.createdAt) || "" },
        right: { name: (Ge == null ? void 0 : Ge.name) || "当前译文", createdAt: (Ge == null ? void 0 : Ge.createdAt) || "" }
      };
    },
    [mt.compared, mt.versions, mt.readingVersionId]
  ), Rr = J(() => {
    if (!we.savedCounts.size) return e.revisedBlocks;
    const j = new Map(e.revisedBlocks);
    for (const [U, ye] of we.savedCounts) j.set(U, (j.get(U) || 0) + ye);
    return j;
  }, [e.revisedBlocks, we.savedCounts]), os = J(() => ({
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
    regions: o.regions,
    readerMetadata: o.readerMetadata,
    activeRegion: e.activeRegion,
    regionHover: H,
    jumpToBlock: fe,
    revisedBlocks: Rr,
    onPdfOutline: Ve,
    onPdfDocument: ge,
    zoomBlock: ee,
    xrefIndex: Me,
    askMarks: K,
    onAskMark: be,
    editBlock: we.available ? He : void 0,
    blockEdit: we,
    editShowsSource: k !== "compare",
    findTerm: F === "search" ? ce : "",
    compareVersion: Ir,
    ink: Le,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: w,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: x, close: N },
    docDark: S,
    toggleDocDark: E
  }), [
    e.shell,
    e.userZoom,
    e.onZoomChange,
    e.rowHeights,
    e.panes,
    e.sessionFiles,
    o.regions,
    o.readerMetadata,
    e.activeRegion,
    H,
    fe,
    Rr,
    Ve,
    ge,
    ee,
    Me,
    K,
    be,
    we,
    He,
    k,
    F,
    ce,
    Ir,
    Le,
    e.sourceOnly,
    w,
    e.download,
    e.goToPage,
    x,
    N,
    S,
    E
  ]), as = J(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), ss = [
    Ji,
    `is-workspace-${g}`,
    d ? "is-assistant-open" : "",
    F ? "is-finder-open" : "",
    b.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(pd, { value: os, hud: as, children: /* @__PURE__ */ L(
    "div",
    {
      className: ss,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": g,
      "data-ink-mode": Le.tool || void 0,
      onContextMenu: (j) => {
        var ye;
        const U = Wh(j);
        if (U) {
          if (j.preventDefault(), W) {
            const me = Co(((ye = globalThis.getSelection) == null ? void 0 : ye.call(globalThis)) ?? null);
            Y(Sn(j.target, j.clientX, j.clientY, me.element ? me.text : ""));
          }
          ht(U);
        }
      },
      children: [
        /* @__PURE__ */ p(qf, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata, onRetry: o.refreshJobArtifacts }),
        /* @__PURE__ */ p(Oh, { open: F, onToggle: Z }),
        F ? /* @__PURE__ */ p(
          Fh,
          {
            tab: F,
            onTab: G,
            onClose: () => G(null),
            onJump: re,
            bookmarks: Je,
            onJumpPage: Fe,
            query: ae,
            onQuery: se,
            term: ce,
            focusSignal: le
          }
        ) : null,
        /* @__PURE__ */ L("div", { className: "reader-chrome-tray", children: [
          /* @__PURE__ */ p(rh, {}),
          /* @__PURE__ */ p(Nc, { onBeforeClose: o.prepareClose })
        ] }),
        /* @__PURE__ */ p(
          Qd,
          {
            mode: k,
            documentReady: !!o.jobId,
            sourceViewOnly: w,
            onModeChange: P,
            liveTranslation: m.topBarPill ? {
              visible: l,
              state: e.liveTranslation,
              onToggle: () => c((j) => !j),
              latestPage: l ? z : null,
              currentPage: e.currentPage,
              onJumpToLatest: $
            } : null,
            completion: R ? {
              onOpenCompare: () => {
                I(e.viewStateKey), P("compare");
              }
            } : null
          }
        ),
        /* @__PURE__ */ p(af, { active: s }),
        d ? /* @__PURE__ */ p(Vf, {}) : null,
        /* @__PURE__ */ p(Gd, { paneComposition: b, markdownSplit: y.open, assistantSplit: d, liveTranslation: e.liveTranslation, sourcePaneAction: _ }),
        e.showHud ? /* @__PURE__ */ p(
          Ih,
          {
            mode: k,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            issuesJobId: e.sourceOnly ? "" : o.jobId,
            searchSlot: /* @__PURE__ */ p($h, { open: F, onToggle: Z })
          }
        ) : null,
        /* @__PURE__ */ p(Lr, { fallback: null, children: y.mounted ? /* @__PURE__ */ p(Mm, { open: y.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: N }) : null }),
        Ne.preview ? /* @__PURE__ */ p(bm, { preview: Ne.preview, regions: o.regions, metadata: o.readerMetadata, documents: Te }) : null,
        Ne.canGoBack ? /* @__PURE__ */ L(X, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => Ne.goBack(), children: [
          /* @__PURE__ */ p(Vs, { size: 14, "aria-hidden": !0 }),
          " 回到第 ",
          Ne.backPage,
          " 页"
        ] }) : null,
        B ? /* @__PURE__ */ p(
          hm,
          {
            itemId: B,
            regions: o.regions,
            metadata: o.readerMetadata,
            documents: Te,
            panes: k === "compare" ? ["source", "translated"] : k === "translated" ? ["translated"] : ["source"],
            onNavigate: q,
            onClose: Oe
          }
        ) : null,
        /* @__PURE__ */ p(Bh, { active: s, compare: mt, ink: Le }),
        /* @__PURE__ */ p(
          Hh,
          {
            ink: Le,
            menu: ot,
            onClose: O,
            actions: W && V ? [{
              key: "ask",
              label: V.selection ? "问这段" : "在这里提问",
              hint: V.selection ? "?" : void 0,
              onSelect: () => ne(V)
            }] : []
          }
        ),
        W && at ? /* @__PURE__ */ p(Lr, { fallback: null, children: /* @__PURE__ */ p(
          Nm,
          {
            port: W,
            jobId: o.jobId,
            anchor: at.anchor,
            onClose: Q.close,
            onShowAnchor: () => e.goToPage(at.anchor.page, at.anchor.pane),
            initialMessages: at.initial,
            onTurnDone: (j, U) => Q.save(at.key, j, U),
            onDelete: () => Q.remove(at.key)
          },
          at.key
        ) }) : null,
        /* @__PURE__ */ p(Uh, { ink: Le }),
        /* @__PURE__ */ p(om, { edit: we }),
        /* @__PURE__ */ p(Mh, {})
      ]
    }
  ) });
}
function Qm() {
  return /* @__PURE__ */ p(xm, {});
}
export {
  Qm as R,
  xm as a,
  Ym as b,
  Eu as c,
  Zm as d,
  Gm as f,
  Xm as r,
  rt as u
};
//# sourceMappingURL=ReaderApp-jtCWfxgP.js.map
