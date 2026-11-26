var kr = (e) => {
  throw TypeError(e);
};
var Ir = (e, t, n) => t.has(e) || kr("Cannot " + n);
var Ct = (e, t, n) => (Ir(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Tr = (e, t, n) => t.has(e) ? kr("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Rr = (e, t, n, r) => (Ir(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as z, jsx as p, Fragment as yt } from "react/jsx-runtime";
import { useMemo as J, useState as N, useEffect as O, useCallback as C, useRef as A, useLayoutEffect as Te, memo as pn, createContext as Gn, useContext as Xn, forwardRef as Lo, useImperativeHandle as Zn, useSyncExternalStore as xo, useId as Do, Suspense as Co, lazy as zo } from "react";
import { requireAdapter as Dt, getReaderAdapters as Ae } from "./adapters.js";
import { resolveReaderDownloadName as os, resolveReaderDownloadUrls as as, READER_PROGRESS_COPY as Je, trimString as sn, READER_DOWNLOAD_ACTIONS as ss, disabledReason as is } from "./runtime/state.js";
import { r as cs, b as ls } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as An, isFinishedJobStatus as Vt } from "@retainpdf/domain/job";
import { n as Oo, d as us, f as vn, k as Er, b as ds, c as fs, j as Le, p as vt, g as ms, l as At, i as hs } from "./reader-regions-BmqHsJ-I.js";
import { fetchDocumentReading as ps } from "@retainpdf/api/documents";
import { isReaderTransportError as gs, createReaderTransportError as bs } from "./contracts.js";
import { X as wt, PenLine as Yn, ZoomIn as ys, Check as $o, Copy as vs, ChevronUp as ws, ChevronDown as Fo, History as Ss, LoaderCircle as ks, Pin as Is, LogOut as Ts, FileText as Bo, Columns2 as jo, Languages as Ho, Radio as Rs, ArrowDownToLine as Es, CheckCircle2 as Ps, Keyboard as Ms, Download as Ns, ListOrdered as _s, TriangleAlert as As, ChevronRight as Uo, ListTree as Ls, Search as xs, GitCompareArrows as Ds, LayoutGrid as Cs, Highlighter as zs, Eraser as Os, Undo2 as $s, Trash2 as Fs, ChevronLeft as Bs, Minus as js, Plus as Hs, ArrowLeft as Us } from "lucide-react";
import { Button as Y, Textarea as Ws, IconButton as mt, Input as Wo } from "@retainpdf/ui";
import { toast as Ln, Toaster as Ks } from "sonner";
import { pdfjs as Ko, Page as Vs, Document as Js } from "react-pdf";
import { e as qs, m as Gs, a as Xs } from "./markdown-math-XkF5urpn.js";
const Zs = (...e) => {
  var t, n;
  return ((n = (t = Ae()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, Ys = "", Qs = Object.freeze({
  progress: "retainpdf-reader-progress"
}), ei = (e) => {
  var t, n;
  return ((n = (t = Ae()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, op = (...e) => {
  var n;
  return (((n = Ae()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, ap = () => {
  var e, t;
  return ((t = (e = Ae()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
}, qe = () => Dt("defaultReaderDataPort"), Pr = () => Dt("defaultReaderPageConfigPort"), sp = {
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
}, Vo = {
  messageTargetOrigin: () => Pr().messageTargetOrigin(),
  readerJobId: () => Pr().readerJobId()
}, ti = () => {
  var e;
  return ((e = Ae()) == null ? void 0 : e.liveTranslation) ?? null;
}, Jt = () => {
  var t;
  const e = Ae();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, Qe = () => {
  const e = Ae();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => Dt("fetchDocumentByJobId")(...n),
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
}, ni = (...e) => {
  var t, n;
  return ((n = (t = Ae()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, ri = () => {
  var e, t;
  return ((t = (e = Ae()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, oi = (...e) => {
  var t, n;
  return ((n = (t = Ae()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, ai = (...e) => {
  var t, n;
  return ((n = (t = Ae()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? os(...e);
}, si = (...e) => {
  var t, n;
  return ((n = (t = Ae()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? as(...e);
}, ii = (...e) => Dt("downloadProtectedResource")(...e), ci = (...e) => Dt("failDownloadToast")(...e), ip = (e, t) => Dt("resolveMarkdownAssetUrl")(e, t), Mr = "/api/v1";
function li() {
  const e = () => {
    var r;
    return cs(
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
function ui() {
  const e = li(), t = J(() => oi(Vo), [e]), n = J(() => ri(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function di(e) {
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
  }), d = c.documentId === t ? c.jobId : "", m = u.documentId === t ? u.jobId : "", g = n || d, [h, y] = N({
    jobId: "",
    documentId: ""
  }), w = h.jobId === g ? h.documentId : "", S = t || w, b = !!t && !g, [v, k] = N(null), P = (v == null ? void 0 : v.sessionIdentity) === r && v.documentId === S ? v : null, x = b || !!P, $ = C((D) => {
    const I = `${D.documentId || ""}`.trim();
    if (!I || a.current && a.current !== I) return;
    if (!a.current && s.current)
      y({
        jobId: s.current,
        documentId: I
      });
    else if (!a.current)
      return;
    const T = `${D.revision || ""}`.trim() || `${Date.now()}`;
    k({
      documentId: I,
      revision: T,
      sessionIdentity: o.current
    }), i();
  }, []);
  O(() => {
    k((D) => D && D.sessionIdentity !== r ? null : D);
  }, [r]);
  const F = C((D) => {
    switch (D.type) {
      case "resolved-document-job":
        l({ documentId: D.documentId, jobId: D.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        f({ documentId: D.documentId, jobId: D.jobId });
        break;
      case "resolved-job-document":
        y((I) => I.jobId === D.jobId && I.documentId === D.documentId ? I : { jobId: D.jobId, documentId: D.documentId });
        break;
      case "committed-source":
        k({
          documentId: D.documentId,
          revision: D.revision,
          sessionIdentity: D.sessionIdentity
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
    setResolvedJobDocument: y,
    jobDocumentId: w,
    documentId: S,
    sourceOnly: b,
    committedDocumentSource: v,
    setCommittedDocumentSource: k,
    activeCommittedDocumentSource: P,
    sourceViewOnly: x,
    refreshCommittedDocument: $,
    applyIdentityEvent: F
  };
}
function Nr(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function fi(e) {
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
  return ei(An(e, t));
}
function mi(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function hi(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !mi(a, t))
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
        type: Qs.progress,
        stage: n,
        percent: e,
        text: t
      },
      Vo.messageTargetOrigin()
    );
  } catch {
  }
}
function cn(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), xn({ percent: t, text: n, stage: r });
}
function pi(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = N(null), [l, u] = N(null), [f, d] = N(""), [m, g] = N(0), h = f === n ? i : null, y = f === n ? l : null, w = Nr(h), S = Vt(w), b = C(() => {
    g((F) => F + 1);
  }, []), v = C((F) => {
    c(F.jobPayload), u(F.manifestPayload), d(F.sessionIdentity);
  }, []), k = C((F) => {
    c(null), u(null), d(F);
  }, []), P = A(""), x = A(""), $ = C(async () => {
    const F = o.current;
    if (!F || P.current === F) return;
    const D = Qe().loadJobPayload;
    if (typeof D != "function") return;
    const I = a.current.value;
    P.current = F;
    try {
      const T = await D(F);
      if (s.current || a.current.value !== I || o.current !== F || !T || typeof T != "object")
        return;
      const E = Nr(T);
      c(T), d(r.current), !Vt(E) && x.current === F && (x.current = ""), E === "succeeded" && x.current !== F && (x.current = F, g((R) => R + 1));
    } catch {
    } finally {
      P.current === F && (P.current = "");
    }
  }, []);
  return O(() => {
    x.current = "";
  }, [n]), O(() => {
    if (!t || S || !h) return;
    const F = window.setInterval(() => {
      document.visibilityState !== "hidden" && $();
    }, 1e3);
    return () => window.clearInterval(F);
  }, [S, $, h, t]), {
    jobPayload: i,
    setJobPayload: c,
    manifestPayload: l,
    setManifestPayload: u,
    payloadSessionIdentity: f,
    setPayloadSessionIdentity: d,
    scopedJobPayload: h,
    scopedManifestPayload: y,
    jobStatus: w,
    jobTerminal: S,
    jobRefreshRevision: m,
    refreshJobArtifacts: b,
    refreshJobStatus: $,
    publishPayload: v,
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
function gi(e, t) {
  e(t), Dn(t);
}
function bi(e) {
  const [t, n] = N(e ? "source" : "compare"), r = C((a) => {
    e && a !== "source" || (n(a), Dn(a));
  }, [e]), o = C((a) => {
    gi(n, a);
  }, []);
  return O(() => (e && document.documentElement.classList.add("reader-source-only"), Dn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Ar(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function yi(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Ar(n.active_job_id),
    activeVersionId: Ar(n.active_version_id)
  };
}
function vi(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function wi(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Si(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const ki = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Ii(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = ki.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const Ti = 48 * 1024 * 1024;
function Ri(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Ei = 2, _e = /* @__PURE__ */ new Map();
function Cn(e, t) {
  _e.delete(e), _e.set(e, t);
}
function Lr(e) {
  if (_e.size < Ei) return;
  const t = _e.keys().next().value;
  t && _e.delete(t);
}
async function Pi(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function Jo(e, t = Jt().fetchProtected, n = {}) {
  var u, f, d, m, g, h, y, w, S;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (_e.has(r)) {
    const b = _e.get(r);
    return Cn(r, b), b;
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
    const b = new Error(`读取 PDF 失败 (${s.status})`);
    b.status = s.status;
    const v = await Pi(s);
    throw v && (b.reason = v), b;
  }
  const i = Mi(r, s, t);
  if (i) {
    o.abort();
    const b = { ranged: i };
    return Lr(), _e.set(r, b), b;
  }
  (y = (h = n.signal) == null ? void 0 : h.addEventListener) == null || y.call(h, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (S = (w = n.signal) == null ? void 0 : w.removeEventListener) == null || S.call(w, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return _e.has(r) ? Cn(r, l) : (Lr(), _e.set(r, l)), l;
}
function Mi(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < Ti ? null : {
    url: e,
    length: o,
    async fetchRange(i, c) {
      const l = await n(e, { headers: { Range: `bytes=${i}-${c - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const Ni = { file: null, loading: !1, error: "" }, _i = { file: null, loading: !0, error: "" };
function Ai(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = N(null);
  if (O(() => {
    if (t || !n) return;
    const s = _e.get(n);
    if (s) {
      Cn(n, s);
      return;
    }
    const i = new AbortController();
    return Jo(n, void 0, { signal: i.signal }).then((c) => {
      i.signal.aborted || o({ url: n, file: c, loading: !1, error: "" });
    }).catch((c) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (c == null ? void 0 : c.message) || String(c) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Ni;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = _e.get(n);
  return a ? { file: a, loading: !1, error: "" } : _i;
}
function Li(e) {
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
async function zn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  cn(s, r, n, "download");
  const i = await Jo(t, Jt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (cn(s, o, n, "download"), i);
}
async function xi(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  cn(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    zn({
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
    zn({
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
function Di(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Ci({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = ps,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(Di(o.href, t, a)), !0);
}
const Qt = {
  regions: null,
  metadata: null
};
function zi(e) {
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
    closingRef: y,
    activeLoadAbortRef: w
  } = e, [S, b] = N(""), [v, k] = N(""), [P, x] = N(null), [$, F] = N(null), [D, I] = N(!1), [T, E] = N(""), [R, M] = N([]), [_, L] = N(!1), [j, U] = N(() => ({
    source: null,
    translated: null
  })), [q, ee] = N(
    Qt
  ), [le, ue] = N({
    loading: !0,
    percent: 4,
    text: Je.boot,
    stage: "progress",
    failed: !1
  });
  return O(() => {
    const ce = new AbortController(), xe = h.current.value, ne = Li({
      sessionEpochRef: h,
      closingRef: y,
      abort: ce,
      sessionEpoch: xe
    });
    w.current = ce;
    const re = Qe();
    if (y.current)
      return ce.abort(), () => {
        w.current === ce && (w.current = null);
      };
    let fe = !1;
    function be(oe, de) {
      ne.markFailed(), L(!0), ue({
        loading: !1,
        percent: 100,
        text: oe,
        stage: "failed",
        failed: !0
      }), xn({ percent: 100, text: de, stage: "failed" });
    }
    function ve() {
      I(!0), fe || L(!0), ue({
        loading: !1,
        percent: 100,
        text: Je.ready,
        stage: "ready",
        failed: !1
      }), xn({ percent: 100, text: Je.ready, stage: "ready" });
    }
    function he() {
      return l != null && l.documentId ? _r(
        l.documentId,
        l.revision
      ) : Zs() ? Ys : re.resolveResourceUrl(An(r));
    }
    async function We() {
      var Z;
      let oe = { activeJobId: "", activeVersionId: "" };
      try {
        const te = await ((Z = re.fetchDocument) == null ? void 0 : Z.call(re, r));
        te && (oe = yi(te));
      } catch {
      }
      const de = vi({
        link: oe,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (de.kind === "follow-active-job") {
        if (ne.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: de.jobId
        }), de.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: de.activeVersionId,
          sessionIdentity: c
        }), m("source")) : m("compare");
        return;
      }
      if (de.kind === "open-committed-source") {
        if (ne.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: de.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const pe = he();
      if (ne.isInactive()) return;
      b(pe), k(""), E(""), d(c);
      const H = await zn({
        url: pe,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: ne,
        setBoot: ue
      });
      if (!ne.isInactive()) {
        if (!H) {
          be("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        x(H), ve();
      }
    }
    async function tt() {
      var ut;
      const oe = !l, de = !!(oe && re.loadSessionSnapshot && re.loadReaderOptionalArtifacts), pe = de ? re.loadReaderOptionalArtifacts(t) : null, H = await ((ut = re.loadSessionSnapshot) == null ? void 0 : ut.call(re, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: oe && !de
      })), Z = H ? {
        jobPayload: H.sourcePayload,
        manifestPayload: H.manifestPayload,
        readerMetadata: H.readerMetadata,
        regionsPayload: H.regions,
        readerErrors: H.readerErrors
      } : await re.loadReaderPayload(t, {
        includeOptionalArtifacts: oe
      });
      if (ne.isInactive()) return;
      let te = null;
      if (n && !r)
        if (H && H.linkedDocument !== void 0)
          te = H.linkedDocument;
        else {
          try {
            te = await re.fetchDocumentByJobId(Mr, t);
          } catch {
          }
          if (ne.isInactive()) return;
        }
      const Ce = fi(Z.jobPayload) || `${(te == null ? void 0 : te.document_id) || ""}`.trim();
      Ce && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Ce
      });
      const Re = wi({
        payloadDocumentId: Ce,
        linkedActiveJobId: `${(te == null ? void 0 : te.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(te == null ? void 0 : te.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (Re.kind === "restore-committed-source") {
        if (ne.isInactive()) return;
        u({
          type: "committed-source",
          documentId: Re.documentId,
          revision: Re.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const Ee = re.resolveReaderSourcePdf(Z.manifestPayload), ze = re.resolveReaderTranslatedPdfUrl(Z.jobPayload, Z.manifestPayload), Pe = typeof Ee == "string" ? Ee : re.resolveReaderArtifactUrl(Ee), Oe = r || Ce, ye = l != null && l.documentId ? _r(
        l.documentId,
        l.revision
      ) : Pe || (Oe ? re.resolveResourceUrl(An(Oe)) : ""), Me = l ? "" : ze || "";
      b(ye || ""), k(Me), E(hi(Z.jobPayload, t)), f({
        jobPayload: Z.jobPayload || null,
        manifestPayload: Z.manifestPayload || null,
        sessionIdentity: c
      });
      const Fe = () => xi({
        sourceFinal: ye || "",
        translatedFinal: Me,
        fence: ne,
        setBoot: ue
      }), Ke = !!(ye || Me), Be = pe && Ke ? Fe() : null;
      Be == null || Be.catch(() => {
      });
      const Ne = (B) => {
        ne.isInactive() || (M(l ? [] : Oo(B.regionsPayload)), U(l ? { source: null, translated: null } : us(B.readerMetadata)), ee(l ? Qt : B.readerErrors ?? Qt), L(!0));
      };
      if (pe ? (fe = !0, pe.then(Ne)) : Ne(Z), !Ke) {
        be(Je.failed, Je.failed);
        return;
      }
      const nt = await (Be ?? Fe());
      if (nt.status !== "inactive") {
        if (nt.status === "incomplete") {
          be("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        x(nt.sourceBytes), F(nt.translatedBytes), ve();
      }
    }
    async function De() {
      I(!1), x(null), F(null), M([]), L(!1), U({ source: null, translated: null }), ee(Qt), cn(ue, 8, Je.metadata, "metadata");
      try {
        if (s) {
          await We();
          return;
        }
        if (!t) {
          be(Je.failed, Je.failed);
          return;
        }
        await tt();
      } catch (oe) {
        if (ne.isClosedOrStale() || (oe == null ? void 0 : oe.name) === "AbortError") return;
        ne.markFailed();
        const de = Number(oe == null ? void 0 : oe.status), pe = `${(oe == null ? void 0 : oe.reason) || ""}`, H = Ii({ status: de, reason: pe, sessionJobId: t });
        if (H && (await Ci({
          apiPrefix: Mr,
          documentId: H,
          expiredJobId: t
        }) || ne.isClosedOrStale()))
          return;
        if (Si({
          status: de,
          reason: pe,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const Z = oe instanceof Error ? oe.message : Je.failed;
        be(Z, Z);
      }
    }
    return De(), () => {
      ce.abort(), w.current === ce && (w.current = null);
    };
  }, [t, r, o, a, s, i, l, g, n, c, u, f, d, m]), {
    sourceUrl: S,
    translatedUrl: v,
    sourceFile: P,
    translatedFile: $,
    assetsReady: D,
    title: T,
    regions: R,
    regionsSettled: _,
    readerMetadata: j,
    readerErrors: q,
    boot: le
  };
}
function Oi() {
  const e = A(!1), t = A(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = ui(), s = A({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = A(a), c = A(""), l = A(""), u = A(() => {
  }), f = C(() => u.current(), []), d = di({
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
    sourceViewOnly: y
  } = d, { mode: w, setMode: S, switchSessionMode: b } = bi(y);
  u.current = () => {
    b("source");
  }, i.current = a, c.current = g, l.current = m;
  const v = pi({
    sessionJobId: m,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: k,
    scopedManifestPayload: P,
    jobStatus: x,
    jobTerminal: $,
    jobRefreshRevision: F,
    refreshJobArtifacts: D,
    refreshJobStatus: I
  } = v, T = zi({
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
    publishPayload: v.publishPayload,
    clearPayload: v.clearPayload,
    switchSessionMode: b,
    jobRefreshRevision: F,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), E = C(() => {
    var M;
    e.current = !0, (M = t.current) == null || M.abort();
  }, []), R = J(
    () => ({
      fetchProtected: Qe().fetchProtected,
      jobId: m,
      jobPayload: k,
      manifestPayload: P,
      sourceUrl: T.sourceUrl,
      translatedUrl: T.translatedUrl,
      sourceOnly: y
    }),
    [m, k, P, T.sourceUrl, T.translatedUrl, y]
  );
  return {
    jobId: m,
    jobStatus: x,
    workflow: `${(k == null ? void 0 : k.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: $,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: h,
    mode: w,
    setMode: S,
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
    refreshJobArtifacts: D,
    refreshJobStatus: I,
    refreshCommittedDocument: d.refreshCommittedDocument,
    prepareClose: E
  };
}
const $i = 160, Fi = 8, Bi = 0;
function ji() {
  const e = A(null), [t, n] = N(null), [r, o] = N(Bi), a = C((s) => {
    e.current = s, n(s);
  }, []);
  return O(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (l) => {
      !Number.isFinite(l) || l < $i || o((u) => Math.abs(u - l) < Fi ? u : l);
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
function Hi(e) {
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
function Ui(e, t) {
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
    pages: wn
  })), [m, g] = N(() => ({ identity: l, tick: 0 })), h = f.identity === l ? f.pages : wn, y = m.identity === l ? m.tick : 0, w = Hi({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: S } = w, b = C((I, T) => {
    u.current === l && d((E) => {
      const R = E.identity === l ? E.pages : wn;
      return R[T] === I && E.identity === l ? E : {
        identity: l,
        pages: { ...R, [T]: I }
      };
    });
  }, [l]), v = A(null), k = C(() => {
    v.current && clearTimeout(v.current);
    const I = l;
    v.current = setTimeout(() => {
      v.current = null, u.current === I && g((T) => ({
        identity: I,
        tick: T.identity === I ? T.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  O(() => (v.current && (clearTimeout(v.current), v.current = null), d((I) => I.identity === l && I.pages.source === 0 && I.pages.translated === 0 ? I : { identity: l, pages: { source: 0, translated: 0 } }), g((I) => I.identity === l && I.tick === 0 ? I : { identity: l, tick: 0 }), () => {
    v.current && (clearTimeout(v.current), v.current = null);
  }), [l]);
  const P = J(
    () => Math.max(h.source, h.translated),
    [h]
  ), x = S === "translated" ? h.translated : h.source || h.translated, $ = t == null ? void 0 : t.userZoom, F = t == null ? void 0 : t.shellWidth, D = `${l}-${y}-${$}-${n}-${h.source}-${h.translated}-${F}`;
  return {
    ...w,
    numPagesByPane: h,
    hudNumPages: P,
    primaryNumPages: x,
    metricsTick: y,
    onNumPages: b,
    onMetrics: k,
    rowSyncRevision: D
  };
}
const Ie = "data-reader-page", Se = "data-reader-pane", Qn = "data-natural-height", Wi = "reader-react-root", qo = "reader-react-grid", Go = "reader-react-scroll-shell", gn = "reader-react-pdf-pane", Xo = "reader-react-pdf-page", ln = "reader-react-pdf-page-placeholder", er = "reader-react-pdf-page-slot";
function un(e, t) {
  const n = e != null ? `[${Ie}="${e}"]` : `[${Ie}]`;
  return t ? `${n}[${Se}="${t}"]` : n;
}
function tr() {
  return `.${er}[${Ie}]`;
}
function dn(e) {
  return Number(e.getAttribute(Ie));
}
const Zo = 0.25, fn = 1, Ki = 0.05, Yt = 0.5, Vi = 16, Ji = 8, Yo = Vi + Ji, qi = 720;
function it() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function Qo(e) {
  return Number.isFinite(e) && e < qi;
}
function Pt(e, t = Number.POSITIVE_INFINITY) {
  return Qo(t) && (e === "source" || e === "translated") ? fn : Yt;
}
function Ze(e) {
  return Number.isFinite(e) ? Math.min(fn, Math.max(Zo, e)) : Yt;
}
function qt(e, t) {
  const n = Ze(Number(e) + t * Ki);
  return Math.round(n * 100) / 100;
}
function Gi(e) {
  return Math.round(Ze(e) * 100);
}
function ea(e) {
  const n = (Number(e) || 0) - Yo;
  return Math.max(160, Math.floor(n));
}
function Xi(e, t = Yt) {
  const n = Ze(t);
  return ea((Number(e) || 0) * n);
}
function Zi(e, t) {
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
const Yi = 8;
function Qi(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < Yi ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const ta = 200, na = [
  "markdown"
], ec = na;
function ra(e) {
  return ec.includes(e);
}
const tc = "retainpdf:reader:view:v1:", xr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), nc = /* @__PURE__ */ new Set([
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
function On(e) {
  return `${e || ""}`.trim();
}
function rc({
  documentId: e,
  jobId: t
}) {
  const n = On(e);
  if (n) return `document:${n}`;
  const r = On(t);
  return r ? `job:${r}` : "";
}
function aa(e) {
  const t = On(e);
  return t ? `${tc}${t}` : "";
}
function oc(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function ac(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!xr.has(t) || !xr.has(n) || t === n))
    return { left: t, right: n };
}
function sc(e) {
  return e === null ? null : ra(e) ? e : void 0;
}
function ic(e) {
  return nc.has(e) ? e : void 0;
}
function sa(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = oc(t.anchor), r = Number(t.zoom), o = ic(t.mode), a = ac(t.splitLayout), s = sc(t.assistantPanel);
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
function Ue(e, t = oa()) {
  const n = aa(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? sa(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function bn(e, t, n = oa()) {
  const r = aa(e);
  if (!r || !n) return null;
  const o = Ue(e, n), a = sa({
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
function cc(e, t, n = "") {
  var d;
  const [r, o] = N(() => {
    var m;
    return ((m = Ue(n)) == null ? void 0 : m.zoom) ?? Pt(e, it());
  }), a = A(r), s = A(n);
  a.current = r;
  const i = A(1), c = A(((d = Ue(n)) == null ? void 0 : d.zoom) !== void 0);
  O(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const m = (h = Ue(n)) == null ? void 0 : h.zoom;
    c.current = m !== void 0;
    const g = m ?? Pt(e, it());
    i.current = 1, a.current = g, o(g);
  }, [e, n]), O(() => {
    if (c.current) return;
    const m = Pt(e, it()), g = a.current;
    Math.abs(m - g) < 5e-4 || (i.current = 1, a.current = m, o(m));
  }, [e]);
  const l = C((m, g) => {
    const h = Ze(m), y = a.current;
    Math.abs(h - y) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : h / (y || 1), a.current = h, c.current = !0, bn(s.current, { zoom: h }), o(h));
  }, []), u = C((m) => {
    l(qt(a.current, m));
  }, [l]), f = C((m) => {
    l(Pt(m));
  }, [l]);
  return Te(() => {
    const m = i.current;
    Math.abs(m - 1) < 1e-3 || (i.current = 1, Zi(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: f };
}
const lc = 160, uc = 3e-3, Dr = 50, dc = 16, fc = 800;
function mc(e, t = 0) {
  const n = t === 1 ? dc : t === 2 ? fc : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-Dr, Math.min(Dr, r));
  return Math.exp(-o * uc);
}
function hc(e, t, n = 0) {
  return Ze(e * mc(t, n));
}
function pc(e) {
  return Math.round(Ze(e) * 100) / 100;
}
function gc(e, t, n) {
  const r = Ze(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return Ze(t) / r;
  const a = (o + Yo) / r;
  return ea(a * Ze(t)) / o;
}
function bc(e) {
  return Array.from(e.querySelectorAll(tr()));
}
function yc(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function vc(e, t, n) {
  let r = null;
  for (const s of bc(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const c = yc(i, t, n);
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
function wc(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function ia(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${tr()}[${Ie}="${t.page}"][${Se}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (wc(n, e).scrollLeft += a);
}
function Sc(e, t, n, r) {
  const o = e.querySelector(`.${qo}`);
  if (!o) return null;
  if (!o.style.transformOrigin) {
    const a = o.getBoundingClientRect();
    o.style.transformOrigin = `${n - a.left}px ${r - a.top}px`, o.style.willChange = "transform";
  }
  return o.style.transform = `scale(${t})`, o;
}
function zt(e) {
  e && (e.style.transform = "", e.style.transformOrigin = "", e.style.willChange = "");
}
const kc = 600, Ic = 1e3;
function Tc(e, t) {
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
  const c = r.setTimeout(() => l(), Ic);
  function l() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(c);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return l;
}
function Rc(e, t, n) {
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
      const f = pc(u.target);
      if (Math.abs(f - r.current) < 5e-3) {
        zt(u.grid);
        return;
      }
      const d = { anchor: u.anchor, grid: u.grid, fallback: null };
      d.fallback = setTimeout(() => {
        s.current === d && (s.current = null, zt(d.grid));
      }, kc), s.current = d, o.current(f, { keepScroll: !1 });
    }, l = (u) => {
      var m, g;
      if (!u.ctrlKey) return;
      u.preventDefault();
      let f = a.current;
      if (!f) {
        (m = i.current) == null || m.call(i), i.current = null;
        const h = s.current;
        h && (h.fallback && clearTimeout(h.fallback), s.current = null, zt(h.grid)), f = {
          start: r.current,
          target: r.current,
          anchor: vc(e, u.clientX, u.clientY),
          grid: null,
          timer: null
        }, a.current = f;
      }
      f.target = hc(f.target, u.deltaY, u.deltaMode);
      const d = gc(f.start, f.target, ((g = f.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      f.grid = Sc(e, d, u.clientX, u.clientY) ?? f.grid, f.timer && clearTimeout(f.timer), f.timer = setTimeout(c, lc);
    };
    return e.addEventListener("wheel", l, { passive: !1 }), () => {
      var f;
      e.removeEventListener("wheel", l);
      const u = a.current;
      a.current = null, u != null && u.timer && clearTimeout(u.timer), zt((u == null ? void 0 : u.grid) ?? null), (f = i.current) == null || f.call(i), i.current = null;
    };
  }, [e]), Te(() => {
    var l;
    const c = s.current;
    c && (s.current = null, c.fallback && clearTimeout(c.fallback), zt(c.grid), !(!e || !c.anchor) && (ia(e, c.anchor), (l = i.current) == null || l.call(i), i.current = Tc(e, c.anchor)));
  }, [t, e]);
}
function Ec(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = A(t), a = A(n), s = A(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: C((c) => {
    c !== o.current && (s.current(), a.current(c));
  }, []) };
}
const nr = 48;
function ca(e, t = nr) {
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
      const f = u.getBoundingClientRect();
      return f.height >= 8 && f.width >= 8;
    });
    l && l.getBoundingClientRect().bottom < t && (n = l);
  }
  if (!n)
    return null;
  const o = dn(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function Wt(e, t, n = nr) {
  if (!e)
    return null;
  const r = un(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = ca(e, n), i = la(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function Lt(e, t, n = "auto", r, o = nr) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(un(a, r))), i || (i = e.querySelector(un(a))), !i)
    return !1;
  const c = e.getBoundingClientRect(), l = i.getBoundingClientRect();
  if (c.height <= 0 || l.height < 8 && i.offsetHeight < 8)
    return !1;
  const u = l.height > 0 ? l.height : i.offsetHeight, f = e.scrollTop + (l.top - c.top), d = Math.max(0, f + s * u - o);
  return n === "auto" ? Math.abs(e.scrollTop - d) >= 1 && (e.scrollTop = d) : e.scrollTo({ top: d, behavior: n }), !0;
}
function Pc(e, t, n = "smooth", r) {
  return Lt(
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
    Lt(
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
function Mc(e, t, n) {
  return $n(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function mn(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function $e(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function Nc(e, t, n = !0, r = "", o) {
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
    const f = un(void 0, o), d = () => {
      if (c) return;
      const h = Array.from(i.querySelectorAll(f));
      if (!h.length)
        return;
      const y = ca(i), w = la(h, y);
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
const _c = `canvas, .react-pdf__Page, .${Xo}, .${ln}`, Cr = /* @__PURE__ */ new WeakMap();
function Ac(e) {
  const t = Number(e.getAttribute(Qn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Cr.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(_c), Cr.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Lc(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function xc(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(tr()).forEach((r) => {
    const o = dn(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = Ac(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Dc(e, t, n = "", r) {
  const [o, a] = N(() => /* @__PURE__ */ new Map()), s = A(o), i = A(r);
  return i.current = r, Te(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let c = !1, l = 0, u = !1, f = !1;
    const d = () => {
      var k;
      if (c) return;
      const b = e.current;
      if (!b) return;
      const v = xc(b);
      Lc(s.current, v) || (s.current = v, a(v)), u && !f && (f = !0, (k = i.current) == null || k.call(i));
    }, m = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(d);
      });
    };
    m();
    const g = window.setTimeout(m, 100), h = window.setTimeout(() => {
      u = !0, m();
    }, 300), y = window.setTimeout(m, 700), w = e.current;
    let S = null;
    return w && typeof ResizeObserver < "u" && (S = new ResizeObserver(() => m()), S.observe(w)), () => {
      c = !0, cancelAnimationFrame(l), window.clearTimeout(g), window.clearTimeout(h), window.clearTimeout(y), S == null || S.disconnect();
    };
  }, [e, t, n]), o;
}
const Cc = [0, 48, 140, 320, 560], zc = 700, Oc = [80, 200, 400], $c = 500, Fc = 50, Bc = /* @__PURE__ */ new Set([
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
]), jc = 180, zr = [0, 48, 140, 320, 700, 1200];
function Hc(e, t) {
  var T;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = A(
    ((T = Ue(a)) == null ? void 0 : T.anchor) || { page: 1, fraction: 0 }
  ), c = A(null), l = A(!1), u = A(r), f = A(null), d = A(null), m = A(null), g = A(null), h = A(a), y = A(""), w = A(n);
  w.current = n;
  const S = C(() => {
    var E;
    (E = f.current) == null || E.call(f), f.current = null, d.current != null && (clearTimeout(d.current), d.current = null);
  }, []), b = C(() => {
    !l.current && c.current == null || (S(), m.current != null && (clearTimeout(m.current), m.current = null), c.current = null, l.current = !1);
  }, [S]), v = C((E = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const R = () => {
      g.current = null, bn(h.current, {
        anchor: $e(i.current)
      });
    };
    E ? R() : g.current = setTimeout(R, jc);
  }, []), k = C((E) => {
    i.current = $e(E), c.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, l.current = !1;
    }, Fc);
  }, []);
  O(() => {
    if (!o)
      return;
    let E = !1, R = null, M = null, _ = null;
    const L = () => {
      if (E) return;
      const j = e.current;
      if (!j) {
        _ = setTimeout(L, 50);
        return;
      }
      R = j, M = () => {
        if (l.current)
          return;
        const U = Wt(R, w.current);
        U && (i.current = U, v());
      }, R.addEventListener("scroll", M, { passive: !0 }), l.current || M();
    };
    return L(), () => {
      E = !0, _ != null && clearTimeout(_), R && M && R.removeEventListener("scroll", M);
    };
  }, [o, r, n, e, v]), O(() => {
    if (!o) return;
    const E = e.current;
    if (!E) return;
    const R = (M) => {
      M.metaKey || M.ctrlKey || M.altKey || Bc.has(M.key) && b();
    };
    return E.addEventListener("wheel", b, { passive: !0 }), E.addEventListener("touchmove", b, { passive: !0 }), window.addEventListener("keydown", R), () => {
      E.removeEventListener("wheel", b), E.removeEventListener("touchmove", b), window.removeEventListener("keydown", R);
    };
  }, [o, e, b]), Te(() => {
    var R;
    if (h.current === a) return;
    v(!0), S(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, y.current = "";
    const E = (R = Ue(a)) == null ? void 0 : R.anchor;
    i.current = E ? $e(E) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, u.current = r;
  }, [a, r, v, S]), O(() => {
    var R;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const E = $e(
      ((R = Ue(a)) == null ? void 0 : R.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = E, c.current = E, l.current = !0, S(), f.current = $n(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: w.current,
        delaysMs: zr,
        onDone: () => k(E)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(E);
    }, Math.max(...zr) + 160), () => S();
  }, [o, s, a, e, k, S]), O(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, c.current = null, S();
      return;
    }
    const E = c.current ? $e(c.current) : $e(i.current);
    return l.current = !0, c.current = E, i.current = E, S(), f.current = $n(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Cc,
        onDone: () => k(E)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(E);
    }, zc), () => {
      S();
    };
  }, [r, o, n, e, k, S]), O(() => () => {
    S(), m.current != null && (clearTimeout(m.current), m.current = null), v(!0);
  }, [S, v]);
  const P = C(() => {
    const E = Wt(
      e.current,
      w.current
    );
    return $e(E || i.current);
  }, [e]), x = C(() => {
    l.current = !0;
    const E = Wt(
      e.current,
      w.current
    ), R = $e(E ?? i.current);
    return i.current = R, c.current = R, v(), R;
  }, [e, v]), $ = C((E, R, M) => {
    const _ = M || w.current, L = mn(E, R || 1), j = { page: L, fraction: 0 };
    i.current = j, l.current = !0, c.current = j, v(), S(), Pc(e.current, L, "smooth", _), f.current = Mc(
      () => e.current,
      L,
      {
        behavior: "auto",
        pane: _,
        delaysMs: Oc,
        onDone: () => k(j)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(j);
    }, $c);
  }, [e, k, S, v]), F = C(() => $e(i.current), []), D = C(() => l.current, []), I = C(() => {
    if (!l.current || !c.current)
      return;
    const E = $e(c.current);
    Lt(
      e.current,
      E,
      "auto",
      w.current
    );
  }, [e]);
  return {
    lockFromShell: P,
    beginModeSwitch: x,
    goToPage: $,
    getAnchor: F,
    isRestoring: D,
    repinIfRestoring: I
  };
}
function Uc(e, t) {
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
const Wc = [0, 80, 200, 400, 800], Kc = 120, Vc = 400;
function Jc(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: c, documentId: l, regionsSettled: u = !0 } = e, f = A(a);
  f.current = a;
  const d = A(s);
  d.current = s;
  const m = A(i);
  m.current = i;
  const g = A(n);
  g.current = n, O(() => {
    var v, k;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = ni(), y = Uc(h, d.current);
    if (y == null && (h != null && h.blockId) && !u) return;
    const w = ua(h, y, { jobId: c, documentId: l });
    if (t.current === w)
      return;
    if (y == null) {
      t.current = w, (v = g.current) == null || v.call(g);
      return;
    }
    t.current = w, h && ((k = m.current) == null || k.call(m, h, y));
    const S = [];
    let b = 0;
    for (const P of Wc)
      b = Math.max(b, P), S.push(
        setTimeout(() => {
          f.current(y);
        }, P)
      );
    return S.push(
      setTimeout(() => {
        var P;
        (P = g.current) == null || P.call(g);
      }, b + Kc)
    ), () => {
      for (const P of S) clearTimeout(P);
    };
  }, [r, o, c, l, t, u]);
}
function qc(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function Gc(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = Vc,
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
      const g = ((w = globalThis.location) == null ? void 0 : w.search) || "", h = ls(g, o, u.current);
      if (d.current = o, h === null) return;
      const y = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = ua(
        { blockId: y },
        o,
        { jobId: i, documentId: c }
      ), (f.current || qc)(h);
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
function Xc(e) {
  const t = A(""), [n, r] = N(!1), o = C(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  Jc(a, t, o), Gc(e, t, n);
}
const Ot = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function Zc(e) {
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
function Yc(e, t, n) {
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
function Qc(e) {
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
function el(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function tl(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function nl(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function rl(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const $r = [250, 500, 1e3, 2e3, 4e3], Sn = [80, 160, 320, 640, 1e3, 1500], Fr = [250, 500, 1e3, 2e3, 4e3, 5e3];
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
  return gs(e) ? `${e.code || ""}`.trim() : "";
}
function en(e, t) {
  const n = rr(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function ol(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (da(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
        return c;
      a = bs(
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
function al({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = N(Ot), s = A(o), i = A("");
  s.current = o;
  const c = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = Vt(l) ? l : "";
  return O(() => {
    if (!n || !c) {
      i.current = "", s.current = Ot, a(Ot);
      return;
    }
    const f = r === void 0 ? ti() : r, d = i.current === c;
    if (i.current = c, !f) {
      const b = {
        ...d ? s.current : Ot,
        connection: u ? "terminal" : "unavailable",
        jobStatus: l,
        error: "实时译文暂不可用"
      };
      s.current = b, a(b);
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
    const y = (b) => {
      m.signal.aborted || a((v) => {
        const k = b(v);
        return s.current = k, k;
      });
    }, w = async () => {
      let b = 0;
      for (; !m.signal.aborted; )
        try {
          const v = await f.fetchLayout(c, { signal: m.signal });
          g = !0, y((k) => ({
            ...k,
            layoutByPage: Zc(v),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (v) {
          if ((v == null ? void 0 : v.name) === "AbortError") return;
          const k = rr(v);
          if (!(k === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !k)) {
            y((x) => ({
              ...x,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: en(v, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            y((x) => ({
              ...x,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          y((x) => ({
            ...x,
            connection: "connecting",
            jobStatus: l,
            error: en(v, "正在等待 OCR 版面数据")
          })), await Fn($r[Math.min(b, $r.length - 1)], m.signal).catch(() => {
          }), b += 1;
        }
    };
    return (async () => {
      if (await w(), !g || m.signal.aborted) return;
      let b = 0;
      for (; !m.signal.aborted; ) {
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
          await f.streamEvents(c, {
            afterSeq: s.current.lastSeq,
            signal: m.signal,
            onEvent: async (v) => {
              if (v.seq <= s.current.lastSeq) return;
              let k;
              try {
                k = await ol(
                  c,
                  v,
                  s.current,
                  m.signal,
                  f
                );
              } catch (P) {
                if ((P == null ? void 0 : P.name) === "AbortError" || m.signal.aborted) throw P;
                y((x) => ({
                  ...x,
                  lastSeq: Math.max(x.lastSeq, v.seq),
                  error: en(P, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((P) => {
                const x = Yc(P, v, k);
                return u ? {
                  ...x,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...x,
                  jobStatus: l
                };
              }), b = 0;
            }
          });
        } catch (v) {
          if ((v == null ? void 0 : v.name) === "AbortError" || m.signal.aborted) return;
          y((k) => ({
            ...k,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: l,
            error: en(v, "实时译文连接已中断，正在重连")
          }));
        }
        if (m.signal.aborted) return;
        if (u) {
          y((v) => ({
            ...v,
            connection: "terminal",
            jobStatus: l
          }));
          return;
        }
        await Fn(Fr[Math.min(b, Fr.length - 1)], m.signal).catch(() => {
        }), b += 1;
      }
    })(), () => m.abort();
  }, [n, r, c, u]), o;
}
function sl(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), c = Number(s.count) || 0;
    i && c > 0 && o.set(i, c);
  }
  return o;
}
function il(e, t = !0) {
  const [n, r] = N(() => /* @__PURE__ */ new Map());
  return O(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = Qe().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(sl(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const cl = 4500;
function ll(e) {
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
const ul = /* @__PURE__ */ new Set(["book", "translate"]);
function fa(e) {
  return !!(e.jobId && e.sourceUrl && ul.has(e.workflow));
}
function dl(e) {
  return !!(fa(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function fl() {
  const e = Oi(), t = fa({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = dl({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = A({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Vt(o) && (r.current.running = !0);
  const a = al({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = ji(), u = il(e.jobId, !e.sourceOnly), f = rc({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: g } = cc(e.mode, s, f);
  Rc(i, m, g);
  const h = Ui(
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
    beginModeSwitch: y,
    goToPage: w,
    repinIfRestoring: S
  } = Hc(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: h.primaryNumPages > 0
  });
  O(() => {
    S();
  }, [c, S]);
  const b = Dc(
    s,
    h.compareMode,
    h.rowSyncRevision,
    S
  ), v = Nc(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${m}-${h.metricsTick}`,
    h.primaryPane
  ), k = C((L, j) => {
    var q, ee;
    const U = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((q = h.numPagesByPane) == null ? void 0 : q.source) || 0,
      Number((ee = h.numPagesByPane) == null ? void 0 : ee.translated) || 0
    );
    w(L, U, j);
  }, [w, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [P, x] = N(null), $ = A(null), F = C((L) => {
    $.current && clearTimeout($.current), x(L), L && ($.current = setTimeout(() => x(null), cl));
  }, []);
  O(() => () => {
    $.current && clearTimeout($.current);
  }, []);
  const D = C((L) => {
    const j = vn(e.regions, L);
    return j ? Er(j, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), I = C((L, j) => {
    const U = j || h.primaryPane, q = typeof L == "object" && L ? `${L.block_id || ""}`.trim() : "", ee = typeof L == "object" && L ? `${L.image_url || ""}`.trim() : "", le = typeof L == "object" && L ? L.page_idx != null ? Number(L.page_idx) + 1 : L.page != null ? Number(L.page) : null : typeof L == "number" ? L + 1 : null, ue = ds(e.regions, ee, le) || vn(e.regions, q) || (typeof L == "object" ? fs(e.regions, L) : null);
    let ce = ue ? Er(ue, U).page : null;
    ce == null && (ce = ll(L)), !(ce == null || ce < 1) && (F(ue), k(ce, U));
  }, [F, k, h.primaryPane, e.regions]);
  Xc({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: v,
    goToPage: k,
    resolveBlockPage: D,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (L) => {
      F(vn(e.regions, L.blockId));
    }
  });
  const { setModeKeepingPage: T } = Ec({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: y
  });
  O(() => {
    F(null);
  }, [d, F]);
  const E = !e.boot.loading && !e.boot.failed, R = J(() => ({ bindShell: l, shellEl: i, shellWidth: c, shellRef: s }), [l, i, c, s]), M = J(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), _ = J(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: m,
    onZoomChange: g,
    shell: R,
    panes: h,
    sessionFiles: M,
    rowHeights: b,
    goToPage: k,
    activeRegion: P,
    jumpToAnchor: I,
    setModeKeepingPage: T,
    download: e.download,
    showHud: E,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, R, h, M, b, k, P, I, T, E, m, g, f, a, n, u]);
  return J(() => ({
    ..._,
    currentPage: v
  }), [_, v]);
}
const ml = [
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
], hl = [
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
function pl(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of ml)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function gl(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const bl = ".reader-notes-panel";
function yl(e) {
  return e instanceof Element ? !!e.closest(bl) : !1;
}
function vl(e) {
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
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || gl(d.target) || yl(d.target))
        return;
      const m = d.key, g = pl(m);
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
              a(qt(o, 1));
              return;
            case "zoom-out":
              a(qt(o, -1));
              return;
            case "zoom-reset":
              a(Pt(t, it()));
              return;
            case "next-page":
              c(mn(s + 1, i));
              return;
            case "prev-page":
              c(mn(s - 1, i));
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
const wl = "retainpdf:soft-reader-close";
function Sl() {
  return new URL("./index.html", window.location.href).href;
}
function kl() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: wl },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Il(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Tl() {
  if (!(typeof window > "u") && !kl()) {
    if (Il(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Sl());
  }
}
function Rl({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function El({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ z(Rl, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Tl();
  }, children: [
    /* @__PURE__ */ p(wt, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
const Pl = 3e3, Ml = 8;
async function Nl(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function _l(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function Al(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = Pl;
  const r = [], o = (s, i, c) => {
    const l = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const f = s[u], d = _l(f == null ? void 0 : f.title);
      if (!d) continue;
      n -= 1;
      const m = c ? `${c}.${u}` : `${u}`, g = { id: m, title: d, page: null, level: i, children: [] };
      r.push({ node: g, dest: f.dest }), l.push(g), i < Ml && Array.isArray(f.items) && f.items.length && (g.children = o(f.items, i + 1, m));
    }
    return l;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await Nl(e, i);
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
function Br(e) {
  if (!e) return [];
  const t = e.split(".");
  return t.slice(0, -1).map((n, r) => t.slice(0, r + 1).join("."));
}
let jr = !1;
function Ll() {
  if (jr)
    return;
  const e = Jt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (Ko.GlobalWorkerOptions.workerSrc = e, jr = !0);
}
function xl({
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
      Y,
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
const st = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Dl = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Cl = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, zl = {
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
function Ol(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Hr(o ?? a ?? "", Dl)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Hr(o ?? a ?? "", Cl)).replace(/\\([a-zA-Z]+)/gu, (r, o) => zl[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function $l(e) {
  return st(e.translatedBlockText) || st(e.translated.text) || st(e.source.text);
}
const Fl = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Bl(e) {
  const t = [];
  for (const n of e) {
    if (!Fl(n)) continue;
    const r = Ol($l(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function jl(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const Hl = 24, Ul = 60;
function Ur(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - Hl), o = Math.min(e.length, n + t.length + Ul), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function Wl(e, t, n = 200) {
  const r = st(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = st(a.translatedBlockText) || st(a.translated.text), c = i ? Ur(i, r) : null, l = c ?? Ur(st(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: c ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
function tn(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function Bt(e, t) {
  const n = st(t).toLowerCase();
  if (!n || !e) return tn(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${tn(e.slice(a, s))}<mark class="reader-find-mark">${tn(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + tn(e.slice(a));
}
function Kl(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const pa = "reader-xref", Bn = "data-xref", jt = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, Vl = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${jt})`), Jl = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function jn(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function ql(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function Gl(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function Xl(e, t, n) {
  const r = e[t], o = (i) => {
    if (!i || i.source.page !== r.source.page) return !1;
    const c = Le(i);
    return c === "figure" || c === "table" || c === "formula";
  }, a = (i) => {
    const c = [];
    for (let l = t + i; o(e[l]) && c.length < 40; l += i) c.push(e[l]);
    return i < 0 ? c.reverse() : c;
  }, s = a(n === "table" ? 1 : -1);
  return s.length ? s : a(n === "table" ? -1 : 1);
}
function Zl(e, t, n) {
  return (e.find((o) => Le(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function Yl(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = Le(r), s = Gl(r);
    if (a === "formula") {
      for (const g of s.matchAll(Jl)) {
        const h = jn(g[1]);
        h && n({ key: `equation:${h}`, kind: "equation", label: h, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = Vl.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const l = ql(i[1]), u = jn(i[2]), f = Xl(e, o, l), d = [...f.map((g) => g.itemId), r.itemId], m = new Map(e.map((g, h) => [g.itemId, h]));
    d.sort((g, h) => (m.get(g) ?? 0) - (m.get(h) ?? 0)), n({ key: `${l}:${u}`, kind: l, label: u, itemId: Zl(f, r, l), itemIds: d, captionId: r.itemId });
  }), t;
}
const Ql = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${jt})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${jt})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${jt})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${jt})\s*[）)]`, "g"), kind: () => "equation" }
];
function eu(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of Ql) {
    o.lastIndex = 0;
    for (const s of e.matchAll(o)) {
      const i = s.length > 2 ? s[1] : "", c = jn(s[s.length - 1]), l = `${a(i)}:${c}`;
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
function tu(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function nu(e, t, n = "") {
  const r = eu(e, t);
  if (!r.length) return Bt(e, n);
  let o = "", a = 0;
  for (const s of r)
    o += Bt(e.slice(a, s.start), n), o += `<mark class="${pa}" ${Bn}="${tu(s.key)}">${Bt(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  return o + Bt(e.slice(a), n);
}
const ru = { figure: "图", table: "表", equation: "式" };
function Wr(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${ru[e.kind]} ${e.label}`;
}
function me(e) {
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
    source: me(e == null ? void 0 : e.source_text) || me(e == null ? void 0 : e.unit_source_text),
    translated: me(e == null ? void 0 : e.protected_translated_text) || me(e == null ? void 0 : e.translated_text)
  };
}
const iu = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function ga(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function cu(e) {
  const t = ga(e).sort((r, o) => me(r.ts).localeCompare(me(o.ts)));
  return t.length ? [
    { text: me(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: me(r.new_text),
      label: iu[me(r.source)] || me(r.source) || "修订",
      ts: me(r.ts),
      reason: me(r.reason)
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
  return me(r.finished_at) || me(n.finished_at) || "";
}
function du(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = ga(e).sort((a, s) => me(a.ts).localeCompare(me(s.ts)));
  for (const a of o) {
    const s = new Date(me(a.ts)).getTime(), i = me(a.reader_item_id) || me(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, me(a.new_text));
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
    const n = t, r = fu[me(n.kind)] || me(n.kind) || "问题", o = me(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const hu = /* @__PURE__ */ new Set(["text", "formula"]);
function or(e) {
  return hu.has(e);
}
function pu(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || or(Le(n));
}
function gu(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !or(Le(r)) || (n.add(o), t.push(o));
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
    if (!wu.has(Le(r.region))) return [];
    const o = vt(r, t, n);
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
const Iu = "reader-text-hover-copy", Tu = "reader-text-hover-edit", Ru = "reader-text-hover-zoom", Eu = "reader-text-hover-id";
function Pu(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const ba = "reader-text-hover-tools";
function nn({
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
const Mu = 26, Nu = 220;
function _u(e, t = Nu) {
  return e.height < Mu * 2 || e.width < t;
}
function Au({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? $o : e === "failed" ? wt : vs, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function Lu({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  onZoom: o,
  frameRect: a,
  placement: s,
  tailTop: i = 0
}) {
  const [c, l] = N("idle"), [u, f] = N("idle"), [d] = N(() => Pu()), m = A([]), g = (e == null ? void 0 : e.itemId) || "";
  if (O(() => {
    l("idle"), f("idle");
    const k = m.current;
    return () => {
      k.forEach((P) => window.clearTimeout(P)), m.current = [];
    };
  }, [g]), !e) return null;
  const h = ms(e.highlight.region, t), y = Le(e.highlight.region), w = (k, P) => async (x) => {
    x.preventDefault(), x.stopPropagation();
    const $ = await ku(k);
    P($ ? "copied" : "failed"), m.current.push(window.setTimeout(() => P("idle"), 1200));
  }, S = y === "formula" ? "复制 LaTeX" : "复制", b = a || e.rect, v = s || (_u(b) ? "outside" : "inside");
  return /* @__PURE__ */ p("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ p(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": y,
      style: b,
      children: /* @__PURE__ */ z(
        "div",
        {
          className: ba,
          "data-placement": v,
          style: v === "tail" ? { top: i } : void 0,
          children: [
            d ? /* @__PURE__ */ p(
              nn,
              {
                className: Eu,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: w(e.itemId, f),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && or(y) ? /* @__PURE__ */ p(
              nn,
              {
                className: Tu,
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
              nn,
              {
                className: Iu,
                state: c,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: c === "copied" ? "已复制" : c === "failed" ? "复制失败" : S,
                onClick: w(h, l),
                children: /* @__PURE__ */ p(Au, { state: c })
              }
            ) : null,
            o ? /* @__PURE__ */ p(
              nn,
              {
                className: Ru,
                state: "idle",
                label: "放大看这一块",
                title: y === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (k) => {
                  k.preventDefault(), k.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ p(ys, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
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
function Du(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = vt(
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
const Cu = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', zu = 256, $t = /* @__PURE__ */ new Map();
function Ou(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function ya(e) {
  const t = `${e || ""}`, { text: n, slots: r } = qs(t, { bareLatex: !0 }), o = Ou(n), a = Gs(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = $t.get(t);
  if (!s && (s = Xs(o, r), $t.set(t, s), $t.size > zu)) {
    const i = $t.keys().next().value;
    i !== void 0 && $t.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function kn(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Ge(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function $u(e, t) {
  const n = e.typography, r = Ge(t) || 1, o = Ge(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = kn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(s, i * r)), l = Ge(n == null ? void 0 : n.fit_min_font_size_pt), u = Ge(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (l || 5.5) * r), d = Math.max(
    f,
    u ? u * r : o ? o * r : c
  ), m = o ? o * r : c, g = Ge(n == null ? void 0 : n.leading_em), h = [
    Ge(n == null ? void 0 : n.padding_top_pt) || 0,
    Ge(n == null ? void 0 : n.padding_right_pt) || 0,
    Ge(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Ge(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((y) => y * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Cu,
    fontSizePx: Math.max(f, Math.min(d, m)),
    minFontSizePx: f,
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
const Bu = 512, Ft = /* @__PURE__ */ new Map();
let Hn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Hn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Hn += 1;
}));
function ju(e, t, n, r) {
  return [
    Hn,
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
  const n = A(null), r = J(
    () => ya(e.translatedText),
    [e.translatedText]
  ), [o, a] = N(r.fallbackHtml), s = J(
    () => $u(e, t),
    [e, t]
  );
  O(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((d) => {
      f && a(d);
    }), () => {
      f = !1;
    };
  }, [r]), Te(() => {
    const f = n.current;
    if (!f) return;
    const [d, m, g, h] = s.padding, y = Math.max(1, e.rect.width - h - m), w = Math.max(1, e.rect.height - d - g), S = ju(o, y, w, s);
    let b = Ft.get(S);
    if (b === void 0 && (b = Fu(
      (v) => (f.style.fontSize = `${v}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      y,
      w,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), Ft.set(S, b), Ft.size > Bu)) {
      const v = Ft.keys().next().value;
      v !== void 0 && Ft.delete(v);
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
function Hu({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = J(
    () => Du(e, t, n, r),
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
const Uu = pn(Hu);
function Wu({
  targets: e,
  edits: t,
  width: n,
  excludeId: r
}) {
  const o = e.filter((a) => t.has(a.itemId) && a.itemId !== r);
  return o.length ? /* @__PURE__ */ p("div", { className: "reader-live-translation-overlay reader-edited-overlay", "aria-hidden": "true", children: o.map((a) => {
    const s = a.highlight.pageSize.width;
    return /* @__PURE__ */ z("div", { className: "reader-edited-block", "data-reader-edited-id": a.itemId, children: [
      /* @__PURE__ */ p(
        va,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: Le(a.highlight.region),
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
const Ku = pn(Wu), wa = 24, ot = wa * 2 + 4, Xe = 24, Vu = 4, Ju = 6, ht = (e) => e.left + e.width, lt = (e) => e.top + e.height;
function Ht(e, t) {
  const n = Math.min(ht(e), ht(t)) - Math.max(e.left, t.left), r = Math.min(lt(e), lt(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const Vr = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= ht(t) && r >= t.top && r <= lt(t);
}, qu = (e) => e.height > 40 && e.height > e.width * 2.5;
function Gu(e, t, n) {
  if (!t.length || e.height < Xe || e.width < n + 8) return null;
  const r = Math.max(...t.map(lt)), o = ht(e) - 4 - n;
  for (const a of [r, lt(e) - 2]) {
    const s = Math.max(e.top, a - Xe), i = { left: o, top: s, width: n, height: Xe };
    if (!t.some((c) => Ht(i, c) > 0)) return s - e.top;
  }
  return null;
}
function Xu(e, t) {
  const n = [], r = (a) => {
    const s = wa + Vu, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: ht(e), top: i, width: s, height: ot } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: ot } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - Xe - 3, width: ot, height: Xe + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: lt(e), width: ot, height: Xe + 3 } }), r(!0);
  const o = Gu(e, t, ot);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: ht(e) - 4 - ot, top: e.top + o, width: ot, height: Xe } }), n;
}
function Zu(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((S) => S.width > 0 && S.height > 0 && !qu(S)), i = s.filter((S) => Vr(S, t)), c = s.filter((S) => !Vr(S, t)), l = n.filter((S) => S !== t && Ht(S, t) < t.width * t.height * 0.5), u = Xu(t, i).filter(({ box: S, overhang: b }) => {
    const v = b ? Ju : 0;
    return S.left >= -v && ht(S) <= r + v && S.top >= 0 && lt(S) <= o;
  }), f = ({ placement: S, tailTop: b }) => b === void 0 ? { placement: S } : { placement: S, tailTop: b }, d = ({ box: S }) => !c.some((b) => Ht(S, b) > 0), m = u.filter((S) => S.placement !== "tail"), g = m.find((S) => d(S) && !l.some((b) => Ht(S.box, b) > 0));
  if (g) return f(g);
  const h = m.find(d) || u.find((S) => S.placement === "tail" && d(S));
  if (h) return f(h);
  let y = null, w = Number.POSITIVE_INFINITY;
  for (const S of u) {
    const b = c.reduce((v, k) => v + Ht(S.box, k), 0);
    b < w && (y = S, w = b);
  }
  return y ? f(y) : { placement: "outside" };
}
function Yu(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - Xe - 3 : lt(r);
  return t >= r.left - 4 && t <= r.left + ot + 4 && n >= a && n <= a + Xe + 3;
}
const In = (e) => e.left + e.width, Tn = (e) => e.top + e.height;
function Qu(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const l of t) {
    if (l.width <= 0 || l.height <= 0) continue;
    const u = l.left + l.width / 2, f = l.top + l.height / 2;
    u < e.left || u > In(e) || f < e.top || f > Tn(e) || (o = Math.min(o, l.left), a = Math.min(a, l.top), s = Math.max(s, In(l)), i = Math.max(i, Tn(l)));
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
  const [o, a] = N(null);
  return Te(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? ed(s) : [], c = Le(t.highlight.region) === "figure", l = i.length && !c ? Qu(t.rect, i) : t.rect, u = n.filter((d) => d.itemId !== t.itemId).map((d) => d.rect), f = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...Zu({ frame: l, others: u, pageWidth: r, pageHeight: f, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
const Sa = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], Jr = { pen: 35e-4, highlighter: 0.018 }, qr = 0.015, Un = "retainpdf.reader.ink.v1:";
function Gr(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(Un + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function nd(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(Un + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(Un + e);
    } catch {
    }
}
function rd(e, t, n, r, o, a) {
  const s = qr * qr;
  return e.filter((i) => ka(i, t, n) && i.points.some(([c, l]) => (c - r) ** 2 + ((l - o) * a) ** 2 <= s)).map((i) => i.id);
}
function ka(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function od(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function ad(e) {
  const [t, n] = N(null), [r, o] = N(Sa[0].key), [a, s] = N(() => Gr(e)), i = A(a), c = A([]);
  O(() => {
    const h = Gr(e);
    i.current = h, s(h), c.current = [];
  }, [e]);
  const l = C((h) => {
    i.current = h, s(h), nd(e, h);
  }, [e]), u = C((h) => {
    const y = i.current, w = h(y);
    w !== y && (c.current = [...c.current.slice(-49), y], l(w));
  }, [l]), f = C((h) => {
    h.points.length < 1 || u((y) => [...y, { ...h, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [u]), d = C((h) => {
    h.length && u((y) => y.filter((w) => !h.includes(w.id)));
  }, [u]), m = C((h) => {
    u((y) => y.some((w) => w.page === h) ? y.filter((w) => w.page !== h) : y);
  }, [u]), g = C(() => {
    const h = c.current.pop();
    h && l(h);
  }, [l]);
  return J(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: d, undo: g, clearPage: m }),
    [t, r, a, f, d, g, m]
  );
}
const sd = "reader-ink-layer";
function id(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function Xr({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: id(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function cd({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = N(null), i = A(!1), c = o.strokes.filter((h) => ka(h, e, t)), l = !!o.tool;
  if (!l && !c.length) return null;
  const u = (h) => {
    const y = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - y.left) / Math.max(1, y.width))),
      Math.min(1, Math.max(0, (h.clientY - y.top) / Math.max(1, y.height)))
    ];
  }, f = (h, y) => o.erase(rd(o.strokes, e, t, h, y, r / Math.max(1, n))), d = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [y, w] = u(h);
    o.tool === "eraser" ? f(y, w) : s([[y, w]]);
  }, m = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [y, w] = u(h);
    o.tool === "eraser" ? f(y, w) : s((S) => S ? od(S, y, w) : [[y, w]]);
  }, g = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: Jr[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ z(
    "svg",
    {
      className: sd,
      "data-ink-active": l ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: d,
      onPointerMove: m,
      onPointerUp: g,
      onPointerCancel: g,
      children: [
        c.map((h) => /* @__PURE__ */ p(Xr, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(Xr, { stroke: { tool: o.tool, color: o.color, width: Jr[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
function ld({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = N(null), [i, c] = N(!1), [l, u] = N([]), [f, d] = N(""), [m, g] = N(""), [h, y] = N(!1), [w, S] = N(null), [b, v] = N([]), k = r.drafts, P = r.generation, x = C(async (I, T) => {
    if (e)
      try {
        u(cu(await e.fetchRevisions(I, T)));
      } catch {
        u([]);
      }
  }, [e]);
  O(() => {
    if (s(null), u([]), S(null), v([]), g(""), !e || !t || !n) return;
    let I = !1;
    return c(!0), e.loadItem(t, n).then((T) => {
      if (I) return;
      const E = T == null ? void 0 : T.item;
      if (!E) throw new Error("找不到这一段的译文。");
      const R = `${(T == null ? void 0 : T.item_id) || n}`, { source: M, translated: _ } = su(E);
      s({ readerItemId: n, itemId: R, source: M, current: _ }), d(k.get(n) ?? _);
    }).catch((T) => {
      I || S({ tone: "error", message: (T == null ? void 0 : T.message) || "读取这段译文失败。" });
    }).finally(() => {
      I || c(!1);
    }), x(t, n), () => {
      I = !0;
    };
  }, [e, t, n, x]);
  const $ = C((I) => {
    d(I), n && k.set(n, I);
  }, [n, k]), F = C(async (I, T) => {
    if (!e || !a || h) return !1;
    const E = I ?? f;
    if (!E.trim()) return !1;
    y(!0), S(null), v([]);
    try {
      const R = await e.revise(t, a.itemId, {
        translated_text: E,
        source: "user",
        reason: (T ?? m).trim() || "在阅读页手动修改",
        ...P.current != null ? { expected_generation: P.current } : {}
      }), M = Number(R == null ? void 0 : R.generation);
      return Number.isFinite(M) && (P.current = M), k.delete(a.readerItemId), s({ ...a, current: E }), d(E), g(""), (R == null ? void 0 : R.changed) === !1 ? S({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, E), S({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), x(t, a.readerItemId), !0;
    } catch (R) {
      const M = R;
      return (M == null ? void 0 : M.reason) === "generation_mismatch" && (P.current = null), S({ tone: "error", message: (M == null ? void 0 : M.message) || "保存失败，请稍后再试。" }), v(mu(M == null ? void 0 : M.issues)), !1;
    } finally {
      y(!1);
    }
  }, [e, a, h, f, m, t, o, x, k, P]), D = C(() => {
    n && k.delete(n);
  }, [n, k]);
  return {
    loading: i,
    loaded: (a == null ? void 0 : a.readerItemId) === n ? a : null,
    history: l,
    draft: f,
    setDraft: $,
    reason: m,
    setReason: g,
    saving: h,
    status: w,
    issues: b,
    save: F,
    discardDraft: D
  };
}
const Ia = "reader-inline-edit";
function ud({ text: e }) {
  const [t, n] = N("");
  return O(() => {
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
  }, [e]), t ? /* @__PURE__ */ z("div", { className: "reader-inline-edit-preview", "data-inline-edit-preview": "true", children: [
    /* @__PURE__ */ p("span", { className: "reader-inline-edit-preview-label", children: "预览" }),
    /* @__PURE__ */ p("div", { className: "reader-live-translation-content", dangerouslySetInnerHTML: { __html: t } })
  ] }) : null;
}
function dd({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var D;
  const s = e.itemId, i = ld({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = N(!1), [u, f] = N(!1), d = A(null), m = vu(e.rect, t), g = J(() => gu(o), [o]), h = g.indexOf(s), { loaded: y } = i, w = i.saving || i.loading, S = n.blockedReason, b = !y || i.draft === y.current, { close: v, select: k } = n, P = C((I) => {
    const T = g[h + I];
    T && (k(T), a == null || a(T));
  }, [g, h, k, a]), x = C(() => {
    i.discardDraft(), v();
  }, [i, v]), $ = C(async (I, T) => {
    await i.save(I, T) && v();
  }, [i, v]);
  O(() => {
    const I = (T) => {
      !T.altKey || T.key !== "ArrowUp" && T.key !== "ArrowDown" || (T.preventDefault(), P(T.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", I), () => window.removeEventListener("keydown", I);
  }, [P]), Te(() => {
    const I = d.current;
    if (!I) return;
    I.style.height = "auto";
    const T = m.mode === "inline" ? m.minHeight : 0;
    I.style.height = `${Math.max(T, I.scrollHeight + 2)}px`;
  }, [i.draft, y, m.mode, m.mode === "inline" ? m.minHeight : 0]);
  const F = m.mode === "inline" ? { left: m.left, top: m.top, width: m.width } : { left: m.left, width: m.width, top: m.top, bottom: m.bottom };
  return /* @__PURE__ */ z(yt, { children: [
    m.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ z(
      "div",
      {
        className: `${Ia} is-${m.mode}`,
        style: F,
        role: "group",
        "aria-label": `改第 ${((D = n.target) == null ? void 0 : D.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": m.mode,
        onPointerDown: (I) => I.stopPropagation(),
        children: [
          r && (y != null && y.source) ? /* @__PURE__ */ p(
            Y,
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
            Ws,
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
                I.key === "Enter" && (I.metaKey || I.ctrlKey) ? (I.preventDefault(), b || $()) : I.key === "Escape" && (I.preventDefault(), x());
              }
            }
          ) : null,
          y ? /* @__PURE__ */ p(ud, { text: i.draft }) : null,
          /* @__PURE__ */ z("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(mt, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => P(-1), children: /* @__PURE__ */ p(ws, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(mt, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= g.length - 1, onClick: () => P(1), children: /* @__PURE__ */ p(Fo, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              Wo,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: w || !!S || !y,
                onChange: (I) => i.setReason(I.target.value),
                onKeyDown: (I) => {
                  I.key === "Enter" ? (I.preventDefault(), b || $()) : I.key === "Escape" && (I.preventDefault(), x());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ z(
              Y,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": u,
                "data-block-edit-action": "history",
                onClick: () => f((I) => !I),
                children: [
                  /* @__PURE__ */ p(Ss, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ p(Y, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: x, children: "取消" }),
            /* @__PURE__ */ p(
              Y,
              {
                className: "reader-inline-edit-act",
                variant: "primary",
                size: "sm",
                "data-block-edit-action": "save",
                disabled: w || !!S || b || !i.draft.trim(),
                pending: i.saving,
                onClick: () => {
                  $();
                },
                children: "保存"
              }
            )
          ] }),
          i.status ? /* @__PURE__ */ p("p", { className: `reader-inline-edit-status is-${i.status.tone}`, role: i.status.tone === "error" ? "alert" : "status", children: i.status.message }) : null,
          i.issues.length ? /* @__PURE__ */ p("ul", { className: "reader-inline-edit-issues", "data-block-edit-issues": "true", children: i.issues.map((I) => /* @__PURE__ */ p("li", { children: I }, I)) }) : null,
          u && y && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((I, T) => {
            const E = I.text === y.current, R = [lu(I.ts), I.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ z("li", { "data-block-edit-history": I.label, "data-current": E ? "true" : void 0, children: [
              /* @__PURE__ */ z("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ z("span", { children: [
                  R,
                  E ? "（现在用的）" : "",
                  I.reason ? ` · ${I.reason}` : ""
                ] }),
                E ? null : /* @__PURE__ */ p(
                  Y,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: w || !!S,
                    onClick: () => {
                      $(I.text, `回到「${R.replace(" · ", " ")}」那一版`);
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
const Ta = Gn(null), Ra = Gn(null);
function fd({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(Ta.Provider, { value: e, children: /* @__PURE__ */ p(Ra.Provider, { value: t, children: n }) });
}
function et() {
  return Xn(Ta);
}
function Ea() {
  return Xn(Ra);
}
const Pa = 1.414;
function md({
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
  liveTranslationPage: y,
  showLiveTranslation: w = r === "source",
  liveTranslationMissing: S = !1
}) {
  var oe, de, pe;
  const b = et(), v = b == null ? void 0 : b.revisedBlocks, k = b == null ? void 0 : b.blockEdit, P = k == null ? void 0 : k.pendingEdits, x = b == null ? void 0 : b.editBlock, $ = (b == null ? void 0 : b.findTerm) || "", F = b == null ? void 0 : b.xrefIndex, D = J(
    () => F != null && F.size ? ({ str: H }) => nu(H, F, $) : $ ? ({ str: H }) => Bt(H, $) : void 0,
    [$, F]
  ), I = A(c ?? Pa), [T, E] = N(I.current);
  O(() => {
    c != null && Math.abs(c - I.current) >= 1e-3 && (I.current = c, E(c));
  }, [c]);
  const R = A(u);
  R.current = u;
  const M = A(null), _ = A((H) => {
    var Z;
    M.current = H, (Z = R.current) == null || Z.call(R, H);
  }).current, L = A(null), j = A(`${t}@${n}`);
  Te(() => {
    const H = `${t}@${n}`;
    j.current !== H && (j.current = H, o && pd(M.current, L.current));
  }, [o, n, t]), O(() => {
    o || Rn(L.current);
  }, [o]), O(() => () => Rn(L.current), []);
  const U = Math.max(120, Math.floor(t * T)), q = Math.max(U, Math.ceil(s || 0)), ee = vt(f, t, U), le = J(
    () => Su(d, t, U),
    [U, d, t]
  ), [ue, ce] = N(null), xe = typeof g == "function", ne = xe ? m ?? null : ue, re = (H) => {
    xe ? H !== (m ?? null) && (g == null || g(H)) : ce((Z) => Z === H ? Z : H);
  }, fe = J(
    () => le.find((H) => H.itemId === ne) || null,
    [ne, le]
  ), be = r === "translated" && ((oe = k == null ? void 0 : k.target) == null ? void 0 : oe.itemId) || "", ve = J(
    () => be && le.find((H) => H.itemId === be) || null,
    [be, le]
  ), he = td(M, o ? fe : null, le, t), We = (H) => {
    var Ee, ze, Pe, Oe, ye;
    if (H.pointerType === "touch") return;
    if ((Ee = b == null ? void 0 : b.ink) != null && Ee.tool) {
      re(null);
      return;
    }
    if (H.buttons !== 0) {
      re(null);
      return;
    }
    if ((Pe = (ze = H.target) == null ? void 0 : ze.closest) != null && Pe.call(ze, `.${ba}`) || (ye = (Oe = H.target) == null ? void 0 : Oe.closest) != null && ye.call(Oe, `.${Ia}`)) return;
    const Z = H.currentTarget.getBoundingClientRect(), te = H.clientX - Z.left, Ce = H.clientY - Z.top;
    if (Yu(he, te, Ce)) return;
    const Re = Kr(le, te, Ce);
    re((Re == null ? void 0 : Re.itemId) || null);
  }, tt = (H) => {
    if (H.pointerType === "mouse") return;
    const Z = H.currentTarget.getBoundingClientRect(), te = Kr(
      le,
      H.clientX - Z.left,
      H.clientY - Z.top
    );
    re((te == null ? void 0 : te.itemId) || null);
  }, De = (H) => {
    !Number.isFinite(H) || H <= 0 || Math.abs(I.current - H) < 1e-3 || (I.current = H, E(H), l == null || l(e, H));
  };
  return /* @__PURE__ */ z(
    "div",
    {
      ref: _,
      [Ie]: e,
      [Se]: r,
      [Qn]: U,
      className: er,
      onPointerMoveCapture: We,
      onPointerDown: tt,
      onDoubleClick: (H) => {
        var te;
        const Z = b == null ? void 0 : b.zoomBlock;
        !Z || (te = b == null ? void 0 : b.ink) != null && te.tool || !fe || Le(fe.highlight.region) === "figure" && (H.preventDefault(), Z(fe.itemId));
      },
      onPointerLeave: (H) => {
        H.pointerType === "mouse" && re(null);
      },
      style: {
        width: t,
        height: q,
        minHeight: q
      },
      children: [
        o ? /* @__PURE__ */ p(
          Vs,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: D,
            renderAnnotationLayer: !1,
            className: Xo,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: ln,
                style: { width: t, height: U }
              }
            ),
            onLoadSuccess: (H) => {
              try {
                const Z = H.getViewport({ scale: 1 });
                if (Z.width > 0) {
                  const te = Z.height / Z.width;
                  De(te);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              Rn(L.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ p(
          "div",
          {
            className: ln,
            style: { width: t, height: U },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: L, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        ee ? /* @__PURE__ */ p(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: ee,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && w ? /* @__PURE__ */ p(
          Uu,
          {
            layoutPage: h,
            pageState: y,
            width: t,
            height: U
          }
        ) : null,
        o && w && S ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (P != null && P.size) ? /* @__PURE__ */ p(Ku, { targets: le, edits: P, width: t, excludeId: ve == null ? void 0 : ve.itemId }) : null,
        o && ve && k ? /* @__PURE__ */ p(
          dd,
          {
            target: ve,
            page: { width: t, height: U },
            edit: k,
            showSource: !!(b != null && b.editShowsSource),
            regions: b == null ? void 0 : b.regions,
            jumpToBlock: b == null ? void 0 : b.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (v != null && v.size) ? /* @__PURE__ */ p("div", { className: "reader-revised-markers", "aria-hidden": "true", children: le.filter((H) => v.has(H.itemId)).map((H) => /* @__PURE__ */ p(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": H.itemId,
            style: { left: H.rect.left, top: H.rect.top, height: H.rect.height }
          },
          H.itemId
        )) }) : null,
        o && (b != null && b.ink) ? /* @__PURE__ */ p(
          cd,
          {
            page: e,
            pane: r === "translated" ? "translated" : b.compareVersion ? "compare" : "source",
            width: t,
            height: U,
            ink: b.ink
          }
        ) : null,
        (de = b == null ? void 0 : b.askMarks) != null && de.length && b.onAskMark ? /* @__PURE__ */ p(xl, { marks: b.askMarks, page: e, height: U, onOpen: b.onAskMark }) : null,
        /* @__PURE__ */ p(
          Lu,
          {
            target: o && !((pe = b == null ? void 0 : b.ink) != null && pe.tool) && (fe == null ? void 0 : fe.itemId) !== (ve == null ? void 0 : ve.itemId) ? fe : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: fe && (v == null ? void 0 : v.get(fe.itemId)) || 0,
            onEdit: x,
            onZoom: b == null ? void 0 : b.zoomBlock,
            frameRect: he == null ? void 0 : he.rect,
            placement: he == null ? void 0 : he.placement,
            tailTop: he == null ? void 0 : he.tailTop
          }
        )
      ]
    }
  );
}
const hd = pn(md);
function pd(e, t) {
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
const gd = 2 * 1024 * 1024;
function bd(e) {
  const t = new Ko.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const En = 5, yd = "120% 0px", vd = 120, wd = "25% 0px";
let Zr = 1;
const Yr = /* @__PURE__ */ new WeakMap();
function Sd(e) {
  if (!e) return 0;
  const t = Yr.get(e);
  if (t) return t;
  const n = Zr;
  return Zr += 1, Yr.set(e, n), n;
}
function kd() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Id = Lo(
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
    activeRegion: y = null,
    regions: w = [],
    readerMetadata: S = null,
    hoveredRegionId: b = null,
    onHoverRegion: v,
    liveTranslation: k,
    showLiveTranslation: P = t === "source",
    liveTranslationPendingLabel: x = "",
    paneAction: $
  }, F) {
    Ll();
    const { file: D, loading: I, error: T } = Ai(n, r), E = `${n}\0${Sd(D)}`, R = A(E);
    R.current = E;
    const M = J(() => {
      const B = Ri(D);
      return B ? "ranged" in B ? { range: bd(B.ranged) } : B : null;
    }, [D, n]), [_, L] = N(0), [j, U] = N(""), [q, ee] = N(null), [le, ue] = N(480), ce = A(null), xe = A(0), ne = J(() => kd(), []), re = J(() => ({
      cMapUrl: Jt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: Jt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: gd,
      disableAutoFetch: !0
    }), []);
    Zn(F, () => q, [q]), O(() => {
      const B = (V) => {
        xe.current = V, ue(V);
      }, K = (V) => {
        const ae = Qi(V, xe.current);
        if (ae !== "ignore") {
          if (ce.current && clearTimeout(ce.current), ae === "immediate") {
            B(V);
            return;
          }
          ce.current = setTimeout(() => B(V), ta);
        }
      }, G = !!(c && c >= 80);
      K(G ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const se = !G && i && typeof ResizeObserver < "u" ? new ResizeObserver((V) => {
        var ae, ge;
        K(((ge = (ae = V[0]) == null ? void 0 : ae.contentRect) == null ? void 0 : ge.width) ?? i.clientWidth);
      }) : null;
      return se && i && se.observe(i), () => {
        se == null || se.disconnect(), ce.current && clearTimeout(ce.current);
      };
    }, [c, i, a]);
    const fe = J(
      () => Xi(le, o),
      [le, o]
    ), [be, ve] = N(() => /* @__PURE__ */ new Map()), [he, We] = N(() => /* @__PURE__ */ new Set()), [tt, De] = N(() => /* @__PURE__ */ new Set()), oe = A(/* @__PURE__ */ new Map()), de = A(null), pe = A(null), [H, Z] = N(() => /* @__PURE__ */ new Set()), te = A(/* @__PURE__ */ new Map()), Ce = C((B, K) => {
      ve((G) => {
        if (G.get(B) === K) return G;
        const X = new Map(G);
        return X.set(B, K), X;
      });
    }, []), Re = C((B, K) => {
      const G = oe.current, X = G.get(B), se = [de.current, pe.current];
      if (X)
        for (const V of se)
          try {
            V == null || V.unobserve(X);
          } catch {
          }
      if (K) {
        G.set(B, K);
        for (const V of se)
          try {
            V == null || V.observe(K);
          } catch {
          }
      } else
        G.delete(B);
    }, []), Ee = A(/* @__PURE__ */ new Map()), ze = C((B) => {
      const K = Ee.current;
      let G = K.get(B);
      return G || (G = (X) => Re(B, X), K.set(B, G)), G;
    }, [Re]);
    O(() => {
      if (typeof IntersectionObserver > "u") return;
      const B = te.current, K = new IntersectionObserver(
        (G) => {
          const X = [], se = [];
          for (const V of G) {
            const ae = V.target, ge = dn(ae);
            Number.isFinite(ge) && (V.isIntersecting ? X : se).push(ge);
          }
          if ((X.length || se.length) && We((V) => {
            let ae = null;
            for (const ge of X)
              V.has(ge) || (ae = ae || new Set(V), ae.add(ge));
            for (const ge of se)
              V.has(ge) && (ae = ae || new Set(V), ae.delete(ge));
            return ae || V;
          }), X.length) {
            for (const V of X) {
              const ae = B.get(V);
              ae && (clearTimeout(ae), B.delete(V));
            }
            De((V) => {
              let ae = null;
              for (const ge of X)
                V.has(ge) || (ae = ae || new Set(V), ae.add(ge));
              return ae || V;
            });
          }
          for (const V of se)
            B.has(V) || B.set(V, setTimeout(() => {
              B.delete(V), De((ae) => {
                if (!ae.has(V)) return ae;
                const ge = new Set(ae);
                return ge.delete(V), ge;
              });
            }, vd));
        },
        { root: i, rootMargin: yd, threshold: 0 }
      );
      de.current = K;
      for (const G of oe.current.values())
        try {
          K.observe(G);
        } catch {
        }
      return () => {
        K.disconnect(), de.current === K && (de.current = null);
        for (const G of B.values()) clearTimeout(G);
        B.clear();
      };
    }, [i]), O(() => {
      if (typeof IntersectionObserver > "u") return;
      const B = new IntersectionObserver(
        (K) => {
          Z((G) => {
            let X = null;
            for (const se of K) {
              const V = dn(se.target);
              !Number.isFinite(V) || se.isIntersecting === G.has(V) || (X = X || new Set(G), se.isIntersecting ? X.add(V) : X.delete(V));
            }
            return X || G;
          });
        },
        { root: i, rootMargin: wd, threshold: 0 }
      );
      pe.current = B;
      for (const K of oe.current.values())
        try {
          B.observe(K);
        } catch {
        }
      return () => {
        B.disconnect(), pe.current === B && (pe.current = null);
      };
    }, [i]);
    const Pe = !!i && typeof IntersectionObserver < "u";
    Te(() => {
      L(0), U(""), We(/* @__PURE__ */ new Set()), De(/* @__PURE__ */ new Set()), ve(/* @__PURE__ */ new Map()), oe.current.clear();
      const B = te.current;
      for (const K of B.values()) clearTimeout(K);
      B.clear(), h == null || h(0, t);
    }, [E, h, t]);
    const Oe = C(
      (B) => {
        if (R.current !== E) return;
        const K = B.numPages;
        L(K), U(""), h == null || h(K, t), f == null || f({ numPages: K, pane: t }), m && typeof B.getPage == "function" && m(B, t), d && typeof B.getOutline == "function" && Al(B).then((G) => {
          R.current === E && d(G, t);
        }, () => {
        });
      },
      [E, f, d, m, h, t]
    ), ye = C(
      (B) => {
        if (R.current !== E) return;
        const K = (B == null ? void 0 : B.message) || "PDF 解析失败";
        U(K), L(0), h == null || h(0, t), g == null || g(B, t);
      },
      [E, g, h, t]
    ), Me = J(
      () => _ > 0 ? Array.from({ length: _ }, (B, K) => K + 1) : [],
      [_]
    );
    O(() => {
      typeof IntersectionObserver < "u" || De(new Set(Me));
    }, [Me]);
    const Fe = J(
      () => At(y, S, t),
      [y, S, t]
    ), Ke = J(() => {
      const B = /* @__PURE__ */ new Map();
      for (const K of w) {
        const G = At(K, S, t);
        if (!G) continue;
        const X = B.get(G.box.page) || [];
        X.push(G), B.set(G.box.page, X);
      }
      return B;
    }, [t, S, w]), Be = J(() => {
      const B = /* @__PURE__ */ new Set();
      if (!b) return B;
      for (const [K, G] of Ke)
        G.some((X) => X.itemId === b) && B.add(K);
      return B;
    }, [b, Ke]), Ne = J(() => {
      if (_ === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(Me);
      if (he.size === 0) {
        const G = Math.min(_, En * 2 + 1);
        return new Set(Array.from({ length: G }, (X, se) => se + 1));
      }
      const K = /* @__PURE__ */ new Set();
      for (const G of he)
        for (let X = -En; X <= En; X++) {
          const se = G + X;
          se >= 1 && se <= _ && K.add(se);
        }
      return K;
    }, [_, Me, i, a, he]), nt = !n || !!T || !!j, ut = n && (T || j) || s;
    return /* @__PURE__ */ z(
      "section",
      {
        ref: ee,
        className: `reader-panel ${gn}${a ? "" : " is-hidden"}`,
        [Se]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (k == null ? void 0 : k.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          $ ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: $ }) : null,
          x ? /* @__PURE__ */ z("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: x })
          ] }) : null,
          nt && !I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: ut }) : null,
          I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          M && !T ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            Js,
            {
              file: M,
              loading: null,
              error: null,
              options: re,
              onLoadSuccess: Oe,
              onLoadError: ye,
              className: "reader-react-pdf-document",
              children: Me.map((B) => {
                if (Ne.has(B))
                  return /* @__PURE__ */ p(
                    hd,
                    {
                      pane: t,
                      pageNumber: B,
                      width: fe,
                      devicePixelRatio: ne,
                      active: tt.has(B),
                      textLayer: !Pe || H.has(B),
                      syncedMinHeight: (l == null ? void 0 : l.get(B)) || 0,
                      onMetrics: u,
                      cachedAspect: be.get(B),
                      onAspectChange: Ce,
                      sentinelRef: ze(B),
                      regionHighlight: (Fe == null ? void 0 : Fe.box.page) === B ? Fe : null,
                      regionTargets: Ke.get(B),
                      hoveredRegionId: b && Be.has(B) ? b : null,
                      onHoverRegion: v,
                      liveTranslationLayout: k == null ? void 0 : k.layoutByPage.get(B - 1),
                      liveTranslationPage: k == null ? void 0 : k.pagesByPage.get(B - 1),
                      showLiveTranslation: P,
                      liveTranslationMissing: tl(k, B - 1)
                    },
                    `${t}-${B}`
                  );
                const G = be.get(B) ?? Pa, X = Math.max(120, Math.floor(fe * G)), se = Math.max(X, Math.ceil((l == null ? void 0 : l.get(B)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: ze(B),
                    [Ie]: B,
                    [Se]: t,
                    [Qn]: X,
                    className: `${er} is-placeholder`,
                    style: {
                      width: fe,
                      height: se,
                      minHeight: se
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: ln,
                        style: { width: fe, height: X },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${B}`
                );
              })
            },
            E
          ) }) : null
        ]
      }
    );
  }
), Qr = pn(Id), Td = 2e3, Rd = 6, Ed = 500, eo = "reader-react-resizing";
function Pd(e, t) {
  const n = A(null), r = A(null);
  Te(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const v = Md(e), k = Wt(e, v);
      if (!k) return;
      s = { pane: v, progress: k, started: performance.now() };
    }
    const { pane: i, progress: c, started: l } = s;
    let u = 0, f = null, d = e.scrollHeight, m = d, g = 0, h = l;
    const y = /* @__PURE__ */ new WeakMap(), w = typeof ResizeObserver > "u" ? null : new ResizeObserver((v) => {
      let k = !1;
      for (const P of v) {
        const x = Math.round(P.contentRect.height);
        y.has(P.target) && y.get(P.target) !== x && (k = !0), y.set(P.target, x);
      }
      k && Lt(e, c, "auto", i);
    }), S = () => {
      var v;
      f && clearTimeout(f), cancelAnimationFrame(u), w == null || w.disconnect(), e.classList.remove(eo);
      for (const k of to) e.removeEventListener(k, S);
      ((v = r.current) == null ? void 0 : v.stop) === S && (r.current = null);
    }, b = () => {
      Lt(e, c, "auto", i);
      const v = e.scrollHeight;
      g = v === m ? g + 1 : 0, m = v;
      const k = performance.now() - h;
      g >= Rd && (v !== d || k > Ed) || k > Td ? S() : u = requestAnimationFrame(b);
    };
    for (const v of to) e.addEventListener(v, S, { passive: !0 });
    for (const v of Array.from(e.children)) w == null || w.observe(v);
    e.classList.add(eo), r.current = { ...s, stop: S }, f = setTimeout(() => {
      f = null, h = performance.now(), d = e.scrollHeight, m = d, g = 0, u = requestAnimationFrame(b);
    }, ta);
  }, [e, t]), O(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Md(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Ie}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(Se) || null;
  }
  return null;
}
const to = ["wheel", "touchstart", "keydown", "pointerdown"];
function Nd(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function _d(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(gn)) && ((n = e.hasAttribute) != null && n.call(e, Se)));
}
function Ad(e, t) {
  O(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!_d(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${gn}[${Se}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const c = Nd(a, i);
        if (c === null || Math.abs(i.scrollLeft - c) < 1) continue;
        const l = i.scrollLeft;
        i.scrollLeft = c, Math.abs(i.scrollLeft - l) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function Ld(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), c = t - i, l = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: c * l };
}
function xd(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const no = 12;
function ar(e) {
  return Array.from(e.querySelectorAll(`.${gn}[${Se}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function Dd(e) {
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
function Cd(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function zd(e, t) {
  return e ? ar(e).find((n) => n.getAttribute(Se) === t) ?? null : null;
}
function Od({ shellEl: e }) {
  const [t, n] = N([]), r = A(0), o = C(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = Dd(e);
      n((i) => Cd(i, s) ? i : s);
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
        for (const f of ar(e))
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
  return a.length ? /* @__PURE__ */ p("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ p($d, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function $d({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - no * 2), r = Ld(e, n), o = A(null);
  if (!r) return null;
  const a = (d) => {
    const m = zd(t, e.pane);
    m && (m.scrollLeft = d);
  }, s = (d) => {
    var m, g;
    d.button === 0 && (d.preventDefault(), d.stopPropagation(), (g = (m = d.currentTarget).setPointerCapture) == null || g.call(m, d.pointerId), o.current = { startX: d.clientX, startScroll: e.scrollLeft, pointerId: d.pointerId });
  }, i = (d) => {
    const m = o.current;
    !m || m.pointerId !== d.pointerId || a(m.startScroll + xd(e, n, r.size, d.clientX - m.startX));
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
      style: { left: e.left + no, width: n },
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
function Fd(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function Bd({ compare: e, onDone: t }) {
  return /* @__PURE__ */ z("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ p("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ p("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ p("li", { children: /* @__PURE__ */ z(
        Y,
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
            o ? /* @__PURE__ */ p($o, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(ks, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ p("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ z("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ z(
        Y,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ p(Is, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ z(
        Y,
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
function ro({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = Fd(t), a = [e === "compare" ? "对比" : "正在读", r, Ma(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ z("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function jd({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = N({ source: null, translated: null });
  return Te(() => {
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
  }, [e]), /* @__PURE__ */ z("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(ro, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(ro, { role: "reading", ...n }) }) : null
  ] });
}
const Hd = () => () => {
}, oo = () => null;
function Ud({
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
function Wd(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function Kd(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Vd(e) {
  const t = et(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), d = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Yt, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, w = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, b = (t == null ? void 0 : t.compareVersion) ?? null, v = (b == null ? void 0 : b.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", k = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", P = b ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, x = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, $ = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), F = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), D = t == null ? void 0 : t.onPdfOutline, I = t == null ? void 0 : t.onPdfDocument, T = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), E = e.regions ?? (t == null ? void 0 : t.regions) ?? [], R = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), M = (t == null ? void 0 : t.regionHover) ?? null, [_, L] = N(null), j = xo(
    M ? M.subscribe : Hd,
    M ? () => M.get().itemId : oo,
    M ? () => M.get().itemId : oo
  ), U = M ? j : _, q = C((ce) => {
    M ? M.set(ce, "pdf") : L(ce);
  }, [M]), ee = Ud({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), ue = Number.isFinite(g) && g > 0 ? Wd(
    g,
    n || r,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return Pd(d, ue), Ad(d, ee.compareMode), /* @__PURE__ */ z(
    "div",
    {
      ref: f,
      className: Go,
      "data-reader-region-count": E.length,
      "data-reader-structured-region-count": E.filter(hs).length,
      "data-reader-metadata-ready": R ? "true" : "false",
      children: [
        /* @__PURE__ */ z(
          "main",
          {
            className: `${qo} reader-mode-${ee.mode}`,
            "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              y ? /* @__PURE__ */ p(
                Qr,
                {
                  pane: "source",
                  url: v,
                  preloadedFile: P,
                  userZoom: m,
                  visible: ee.showSource,
                  scrollRoot: d,
                  pageWidthOverride: ue,
                  rowHeights: ee.compareMode ? h : void 0,
                  onMetrics: $,
                  emptyLabel: S ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: F,
                  onOutline: b ? void 0 : D,
                  onDocument: b ? void 0 : I,
                  activeRegion: T,
                  regions: (b == null ? void 0 : b.regions) ?? E,
                  readerMetadata: R,
                  hoveredRegionId: U,
                  onHoverRegion: q,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? Kd(o) : "",
                  paneAction: u && ee.showTranslated ? /* @__PURE__ */ z(yt, { children: [
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
                Qr,
                {
                  pane: "translated",
                  url: k,
                  preloadedFile: x,
                  userZoom: m,
                  visible: ee.showTranslated,
                  scrollRoot: d,
                  pageWidthOverride: ue,
                  rowHeights: ee.compareMode ? h : void 0,
                  onMetrics: $,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: F,
                  onOutline: D,
                  onDocument: I,
                  activeRegion: T,
                  regions: E,
                  readerMetadata: R,
                  hoveredRegionId: U,
                  onHoverRegion: q,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ p(Od, { shellEl: d }),
        b ? /* @__PURE__ */ p(jd, { shellEl: d, left: b.left, right: b.right }) : null
      ]
    }
  );
}
const Jd = [
  { id: "source", label: "原文", Icon: Bo },
  { id: "compare", label: "对照", Icon: jo },
  { id: "translated", label: "译文", Icon: Ho }
];
function qd(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function Gd(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function Xd(e) {
  const t = et(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? qd(a.state) : "";
  return /* @__PURE__ */ z("header", { className: "reader-workspace-bar", children: [
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
    /* @__PURE__ */ z("div", { className: "reader-workspace-center", children: [
      /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Jd.map(({ id: l, label: u, Icon: f }) => {
        const d = n === l, m = Gd({
          id: l,
          documentReady: r,
          sourceViewOnly: i,
          liveTranslationAvailable: !!a
        });
        return /* @__PURE__ */ z(
          "button",
          {
            type: "button",
            className: `reader-workspace-tab${d ? " is-active" : ""}`,
            role: "tab",
            "aria-selected": d,
            "aria-label": u,
            title: m ? `${u} 需要文档任务` : u,
            disabled: m,
            onClick: () => o(l),
            children: [
              /* @__PURE__ */ p(f, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-workspace-tab-label", children: u })
            ]
          },
          l
        );
      }) }),
      a ? /* @__PURE__ */ z("div", { className: "reader-live-strip", children: [
        /* @__PURE__ */ z(
          "button",
          {
            type: "button",
            className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
            "aria-pressed": a.visible,
            "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
            title: a.state.error || `${c}，${a.visible ? "点一下看原文" : "点一下叠上译文"}`,
            onClick: a.onToggle,
            children: [
              /* @__PURE__ */ p(Rs, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: c })
            ]
          }
        ),
        a.latestPage && a.onJumpToLatest && a.latestPage !== a.currentPage ? /* @__PURE__ */ z(
          Y,
          {
            className: "reader-live-translation-toggle reader-live-jump",
            "aria-label": `跳到最新译好的第 ${a.latestPage} 页`,
            title: `跳到最新译好的第 ${a.latestPage} 页`,
            onClick: a.onJumpToLatest,
            children: [
              /* @__PURE__ */ p(Es, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "跳到最新" })
            ]
          }
        ) : null
      ] }) : s ? /* @__PURE__ */ p("div", { className: "reader-live-strip", children: /* @__PURE__ */ z(
        Y,
        {
          className: "reader-live-translation-toggle is-done",
          title: "翻译完成，左右对照看最终译文",
          onClick: s.onOpenCompare,
          children: [
            /* @__PURE__ */ p(Ps, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
          ]
        }
      ) }) : null
    ] })
  ] });
}
const Zd = Lo(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
  return /* @__PURE__ */ z(
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
}), Yd = Zd, Qd = {
  markdown: { label: "Markdown", short: "MD", Icon: Yd, needsJob: !0 }
}, ef = na.map(
  (e) => ({ id: e, ...Qd[e] })
);
function Na() {
  return ef.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function tf(e) {
  const t = et(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(yt, { children: Na().map(({ id: s, label: i, Icon: c, needsJob: l }) => {
    const u = n === s, f = l && r, d = u ? `收起${i}` : `打开${i}`;
    return /* @__PURE__ */ z(
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
          /* @__PURE__ */ p(c, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
          /* @__PURE__ */ p("span", { className: "reader-panel-toggle-label", "aria-hidden": "true", children: i })
        ]
      },
      s
    );
  }) });
}
function nf(e) {
  const t = et(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = Na().map(({ id: c, label: l, short: u, Icon: f, needsJob: d }) => ({
    key: c,
    label: l,
    short: u,
    Icon: f,
    disabled: d && o,
    selected: n === c,
    badge: r == null ? void 0 : r[c],
    onClick: () => a(c)
  }));
  return n ? /* @__PURE__ */ z("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ p("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: c, label: l, Icon: u, disabled: f, selected: d, badge: m, onClick: g }) => /* @__PURE__ */ z(
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
        children: /* @__PURE__ */ p(wt, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function rf(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function of(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function af(e) {
  return e / 100 * window.innerHeight;
}
function sf(e) {
  return e / 100 * window.innerWidth;
}
function cf(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function Ut({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = cf(n);
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
      r = of(t, o);
      break;
    }
    case "em": {
      r = rf(t, o);
      break;
    }
    case "vh": {
      r = af(o);
      break;
    }
    case "vw": {
      r = sf(o);
      break;
    }
  }
  return r;
}
function ke(e) {
  return parseFloat(e.toFixed(3));
}
function xt({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function Wn(e) {
  const { panels: t } = e, n = xt({ group: e });
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
      const u = Ut({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = ke(u / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const u = Ut({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = ke(u / n * 100);
    }
    let c = 0;
    if (a.minSize !== void 0) {
      const u = Ut({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      c = ke(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = Ut({
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
function ie(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function Kn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? lf : uf
  );
}
function lf(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function uf(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function _a(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Aa(e, t) {
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
function df({
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
    const { x: i, y: c } = Aa(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return ie(o, "No rect found"), o;
}
let rn;
function ff() {
  return rn === void 0 && (typeof matchMedia == "function" ? rn = !!matchMedia("(pointer:coarse)").matches : rn = !1), rn;
}
function La(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Kn(
    n,
    Array.from(t.children).filter(_a).map((g) => ({ element: g }))
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
              switch (m.length) {
                case 0: {
                  b = [
                    v,
                    k
                  ];
                  break;
                }
                case 1: {
                  const P = m[0], x = df({
                    orientation: n,
                    rects: [w, S],
                    targetRect: P.element.getBoundingClientRect()
                  });
                  b = [
                    P,
                    x === w ? k : v
                  ];
                  break;
                }
                default: {
                  b = m;
                  break;
                }
              }
            } else
              m.length ? b = m : b = [
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
              const P = ff() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (k.width < P) {
                const $ = P - k.width;
                k = new DOMRect(
                  k.x - $ / 2,
                  k.y,
                  k.width + $,
                  k.height
                );
              }
              if (k.height < P) {
                const $ = P - k.height;
                k = new DOMRect(
                  k.x,
                  k.y - $ / 2,
                  k.width,
                  k.height + $
                );
              }
              const x = g <= l || g > u;
              !i && !x && s.push({
                group: e,
                groupSize: xt({ group: e }),
                panels: [d, y],
                separator: "width" in v ? void 0 : v,
                rect: k
              }), i = !1;
            }
          }
          c = !1, d = y, m = [];
        }
      } else if (h.hasAttribute("data-separator")) {
        h.ariaDisabled !== null && (i = !0);
        const y = o.find(
          (w) => w.element === h
        );
        y ? m.push(y) : (d = void 0, m = []);
      } else
        c = !0;
  }
  return s;
}
var at;
class xa {
  constructor() {
    Tr(this, at, {});
  }
  addListener(t, n) {
    const r = Ct(this, at)[t];
    return r === void 0 ? Ct(this, at)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = Ct(this, at)[t];
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
    Rr(this, at, {});
  }
  removeListener(t, n) {
    const r = Ct(this, at)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
at = new WeakMap();
let Nt = {
  cursorFlags: 0,
  state: "inactive"
};
const sr = new xa();
function pt() {
  return Nt;
}
function mf(e) {
  return sr.addListener("change", e);
}
function hf(e) {
  const t = Nt, n = { ...Nt };
  n.cursorFlags = e, Nt = n, sr.emit("change", {
    prev: t,
    next: n
  });
}
function _t(e) {
  const t = Nt;
  Nt = e, sr.emit("change", {
    prev: t,
    next: e
  });
}
const pf = (e) => e, Pn = () => {
}, Da = 1, Ca = 2, za = 4, Oa = 8, ao = 3, so = 12;
let on;
function io() {
  return on === void 0 && (on = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (on = !0)), on;
}
function gf({
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
        if (e && io()) {
          const a = (e & Da) !== 0, s = (e & Ca) !== 0, i = (e & za) !== 0, c = (e & Oa) !== 0;
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
    return io() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const co = /* @__PURE__ */ new WeakMap();
function ir(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = co.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = pt();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = gf({
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
  co.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let He = /* @__PURE__ */ new Map();
const $a = new xa();
function bf(e) {
  He = new Map(He), He.delete(e);
}
function lo(e, t) {
  for (const [n] of He)
    if (n.id === e)
      return n;
}
function ct(e, t) {
  for (const [n, r] of He)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function St() {
  return He;
}
function cr(e, t) {
  return $a.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Ye(e, t, n) {
  const r = He.get(e);
  He = new Map(He), He.set(e, t), $a.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function Fa(e) {
  const t = pt();
  let n = !1;
  switch (t.state) {
    case "active":
      _t({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (ir(e), n = !0, t.hitRegions.forEach((r) => {
        const o = ct(r.group.id, !0);
        Ye(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function uo(e) {
  e.defaultPrevented || Fa(e.currentTarget);
}
function yf(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Aa(n, a.rect);
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
function vf(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function wf(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: ho(e),
    b: ho(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  ie(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: mo(fo(n.a)),
    b: mo(fo(n.b))
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
const Sf = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function kf(e) {
  const t = getComputedStyle(Ba(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function If(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || kf(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || Sf.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function fo(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (ie(n, "Missing node"), If(n)) return n;
  }
  return null;
}
function mo(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function ho(e) {
  const t = [];
  for (; e; )
    t.push(e), e = Ba(e);
  return t;
}
function Ba(e) {
  const { parentNode: t } = e;
  return vf(t) ? t.host : t;
}
function Tf(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Rf({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!_a(n) || n.contains(e) || e.contains(n))
    return !0;
  if (wf(n, e) > 0) {
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
function lr(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = La(o), s = yf(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Rf({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function Ef(e, t) {
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
function je(e, t) {
  return we(e, t) ? 0 : e > t ? 1 : -1;
}
function Mt({
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
  return r = Math.min(i, r), r = ke(r), r;
}
function Gt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (we(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), c = Object.values(o), l = [...i], [u, f] = r;
  ie(u != null, "Invalid first pivot index"), ie(f != null, "Invalid second pivot index");
  let d = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? f : u, y = n[h];
        ie(
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
          if (ie(
            v != null,
            `Previous layout not found for panel index ${h}`
          ), we(v, w)) {
            const k = b - v;
            je(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      {
        const h = e < 0 ? u : f, y = n[h];
        ie(
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
          if (ie(
            v != null,
            `Previous layout not found for panel index ${h}`
          ), we(v, b)) {
            const k = v - w;
            je(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? f : u, y = n[h];
      ie(
        y,
        `Panel constraints not found for index ${h}`
      );
      const w = i[h], { collapsible: S, collapsedSize: b, minSize: v } = y;
      if (S && je(w, v) < 0)
        if (e > 0) {
          const k = v - b, P = k / 2, x = w + e;
          je(x, v) < 0 && (e = je(e, P) <= 0 ? 0 : k);
        } else {
          const k = v - b, P = 100 - k / 2, x = w - e;
          je(x, v) < 0 && (e = je(100 + e, P) > 0 ? 0 : -k);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let y = e < 0 ? f : u, w = 0;
    for (; ; ) {
      const b = i[y];
      ie(
        b != null,
        `Previous layout not found for panel index ${y}`
      );
      const v = Mt({
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
    let h = e < 0 ? u : f;
    for (; h >= 0 && h < n.length; ) {
      const y = Math.abs(e) - Math.abs(d), w = i[h];
      ie(
        w != null,
        `Previous layout not found for panel index ${h}`
      );
      const S = w - y, b = Mt({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: w,
        size: S
      });
      if (!we(w, b) && (d += w - b, l[h] = b, d.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (Ef(c, l))
    return o;
  {
    const h = e < 0 ? f : u, y = i[h];
    ie(
      y != null,
      `Previous layout not found for panel index ${h}`
    );
    const w = y + d, S = Mt({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: y,
      size: w
    });
    if (l[h] = S, !we(S, w)) {
      let b = w - S, v = e < 0 ? f : u;
      for (; v >= 0 && v < n.length; ) {
        const k = l[v];
        ie(
          k != null,
          `Previous layout not found for panel index ${v}`
        );
        const P = k + b, x = Mt({
          overrideDisabledPanels: s,
          panelConstraints: n[v],
          prevSize: k,
          size: P
        });
        if (we(k, x) || (b -= x - k, l[v] = x), we(b, 0))
          break;
        e > 0 ? v-- : v++;
      }
    }
  }
  const m = Object.values(l).reduce(
    (h, y) => y + h,
    0
  );
  if (!we(m, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return l.reduce((h, y, w) => (h[g[w]] = y, h), {});
}
function gt(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || je(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function bt({
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
    const u = Mt({
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
      ie(c != null, `No layout data found for index ${i}`);
      const l = c + a, u = Mt({
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
function ja({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const c = St();
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
    const d = a(), m = l.findIndex((y) => y.id === t), g = m === 0, h = m === l.length - 1;
    if (h && c < d && (g || l.slice(0, m).every((y, w) => {
      const S = f[w];
      return (S == null ? void 0 : S.collapsible) && we(S.collapsedSize, u[S.panelId]);
    }))) {
      const y = l.slice(0, m).reduce((w, S) => w + u[S.id], 0);
      return {
        ...u,
        [t]: ke(100 - y)
      };
    }
    return Gt({
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
    } = n(), y = s({
      nextSize: c,
      panels: d.panels,
      prevLayout: g,
      derivedPanelConstraints: f
    }), w = bt({
      layout: y,
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
      return c && we(l, u);
    },
    resize: (c) => {
      const { group: l } = n(), { element: u } = o(), f = xt({ group: l }), d = Ut({
        groupSize: f,
        panelElement: u,
        styleProp: c
      }), m = ke(d / f * 100);
      i(m);
    }
  };
}
function po(e) {
  if (e.defaultPrevented)
    return;
  const t = St();
  lr(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = ja({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function an(e) {
  const t = St();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function Ha({
  groupId: e
}) {
  const t = () => {
    const n = St();
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
      } = t(), l = bt({
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
function ft(e, t) {
  const n = an(e), r = ct(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  ie(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  ie(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), i = Ha({ groupId: n.id }).getLayout(), c = Gt({
    delta: t,
    initialLayout: i,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: i,
    trigger: "keyboard"
  }), l = bt({
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
function go(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = an(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && ft(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && ft(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && ft(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && ft(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), ft(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = an(t), o = ct(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, c = r.separators.find(
          (d) => d.element === t
        );
        ie(c, "Matching separator not found");
        const l = i.get(c);
        ie(l, "Matching panels not found");
        const u = l[0], f = a.find(
          (d) => d.panelId === u.id
        );
        if (ie(f, "Panel metadata not found"), f.collapsible) {
          const d = s[u.id], m = f.collapsedSize === d ? r.mutableState.expandedPanelSizes[u.id] ?? f.minSize : f.collapsedSize;
          ft(t, m - d);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = an(t).separators.map(
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
        e.preventDefault(), ft(t, -100);
        break;
      }
    }
}
function bo(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = St(), n = lr(e, t), r = /* @__PURE__ */ new Map();
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
function Ua({
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
    const y = r.get(u), w = o.get(u);
    if (!y || !w)
      return;
    const {
      defaultLayoutDeferred: S,
      derivedPanelConstraints: b,
      groupSize: v,
      layout: k,
      separatorToPanels: P
    } = w;
    if (b && k && P) {
      const x = Gt({
        delta: h,
        initialLayout: y,
        panelConstraints: b,
        pivotIndices: l.panels.map(($) => m.indexOf($)),
        prevLayout: k,
        trigger: "mouse-or-touch"
      });
      if (gt(x, k)) {
        if (h !== 0 && !g)
          switch (d) {
            case "horizontal": {
              i |= h < 0 ? Da : Ca;
              break;
            }
            case "vertical": {
              i |= h < 0 ? za : Oa;
              break;
            }
          }
      } else
        Ye(l.group, {
          defaultLayoutDeferred: S,
          derivedPanelConstraints: b,
          groupSize: v,
          layout: x,
          separatorToPanels: P
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & ao : c |= i & ao, t.movementY === 0 ? c |= s & so : c |= i & so, hf(c), ir(e);
}
function yo(e) {
  const t = St(), n = pt();
  switch (n.state) {
    case "active":
      Ua({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function vo(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = pt(), n = St();
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
          const s = ct(a.group.id, !0);
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
      Ua({
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
      a.length === 0 ? t.state !== "inactive" && _t({
        cursorFlags: 0,
        state: "inactive"
      }) : _t({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), ir(e.currentTarget);
      break;
    }
  }
}
function wo(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (pt().state) {
      case "hover":
        _t({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function So(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || Fa(e.currentTarget) && e.preventDefault();
}
function ko(e) {
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
function Pf(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((c) => c.element === t);
  if (!r || !r.onResize)
    return;
  const o = xt({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: ke(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function Mf(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function Nf({
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
        const m = d / 100 * n, g = ke(
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
      u[f] = ke(
        d / a * l
      );
    }
  else {
    const f = ke(
      l / c.length
    );
    for (const d of c)
      u[d] = f;
  }
  return u;
}
function _f(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const Tt = /* @__PURE__ */ new Map();
function Af(e) {
  let t = !0;
  ie(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const h of g) {
      const { borderBoxSize: y, target: w } = h;
      if (w === e.element) {
        if (t) {
          const S = xt({ group: e });
          if (S === 0)
            return;
          const b = ct(e.id);
          if (!b)
            return;
          const v = Wn(e), k = b.defaultLayoutDeferred ? ko(v) : b.layout, P = Nf({
            group: e,
            nextGroupSize: S,
            prevGroupSize: b.groupSize,
            prevLayout: k
          }), x = bt({
            layout: P,
            panelConstraints: v
          });
          if (!b.defaultLayoutDeferred && gt(b.layout, x) && Mf(
            b.derivedPanelConstraints,
            v
          ) && b.groupSize === S)
            return;
          Ye(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: v,
            groupSize: S,
            layout: x,
            separatorToPanels: b.separatorToPanels
          });
        }
      } else
        Pf(e, w, y);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    ie(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = xt({ group: e }), i = Wn(e), c = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (_f(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[c] ?? l ?? ko(i), f = bt({
    layout: u,
    panelConstraints: i
  }), d = e.element.ownerDocument;
  Tt.set(
    d,
    (Tt.get(d) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return La(e).forEach((g) => {
    g.separator && m.set(g.separator, g.panels);
  }), Ye(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: m
  }), e.separators.forEach((g) => {
    ie(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", go);
  }), Tt.get(d) === 1 && (d.addEventListener("contextmenu", uo, !0), d.addEventListener("dblclick", po, !0), d.addEventListener("pointerdown", bo, !0), d.addEventListener("pointerleave", yo), d.addEventListener("pointermove", vo), d.addEventListener("pointerout", wo), d.addEventListener("pointerup", So, !0)), function() {
    t = !1, Tt.set(
      d,
      Math.max(0, (Tt.get(d) ?? 0) - 1)
    ), bf(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", go);
    }), Tt.get(d) || (d.removeEventListener(
      "contextmenu",
      uo,
      !0
    ), d.removeEventListener(
      "dblclick",
      po,
      !0
    ), d.removeEventListener(
      "pointerdown",
      bo,
      !0
    ), d.removeEventListener("pointerleave", yo), d.removeEventListener("pointermove", vo), d.removeEventListener("pointerout", wo), d.removeEventListener("pointerup", So, !0)), a.disconnect();
  };
}
function Lf() {
  const [e, t] = N({}), n = C(() => t({}), []);
  return [e, n];
}
function ur(e) {
  const t = Do();
  return `${e ?? t}`;
}
const kt = typeof window < "u" ? Te : O;
function Kt(e) {
  const t = A(e);
  return kt(() => {
    t.current = e;
  }, [e]), C(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function dr(...e) {
  return Kt((t) => {
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
  const t = A({ ...e });
  return kt(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const Wa = Gn(null);
function xf(e, t) {
  const n = A({
    getLayout: () => ({}),
    setLayout: pf
  });
  Zn(t, () => n.current, []), kt(() => {
    Object.assign(
      n.current,
      Ha({ groupId: e })
    );
  });
}
function Ka({
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
  }), h = Kt((I) => {
    gt(g.current.onLayoutChange, I) || (g.current.onLayoutChange = I, c == null || c(I));
  }), y = Kt(
    (I, T) => {
      gt(g.current.onLayoutChanged, I) || (g.current.onLayoutChanged = I, l == null || l(I, { isUserInteraction: T }));
    }
  ), w = ur(i), S = A(null), [b, v] = Lf(), k = A({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), P = dr(S, a);
  xf(w, s);
  const x = Kt(
    (I, T) => {
      const E = pt(), R = lo(I), M = ct(I);
      if (M) {
        let _ = !1;
        switch (E.state) {
          case "active": {
            _ = E.hitRegions.some(
              (L) => L.group === R
            );
            break;
          }
        }
        return {
          flexGrow: M.layout[T] ?? 1,
          pointerEvents: _ ? "none" : void 0
        };
      }
      if (n != null && n[T])
        return {
          flexGrow: n == null ? void 0 : n[T]
        };
    }
  ), $ = fr({
    defaultLayout: n,
    disableCursor: r
  }), F = J(
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
        ]), v(), () => {
          T.panels = T.panels.filter(
            (E) => E !== I
          ), v();
        };
      },
      registerSeparator: (I) => {
        const T = k.current;
        return T.separators = Kn(u, [
          ...T.separators,
          I
        ]), v(), () => {
          T.separators = T.separators.filter(
            (E) => E !== I
          ), v();
        };
      },
      updatePanelProps: (I, { disabled: T }) => {
        const E = k.current.panels.find(
          (_) => _.id === I
        );
        E && (E.panelConstraints.disabled = T);
        const R = lo(w), M = ct(w);
        R && M && Ye(R, {
          ...M,
          derivedPanelConstraints: Wn(R)
        });
      },
      updateSeparatorProps: (I, {
        disabled: T,
        disableDoubleClick: E
      }) => {
        const R = k.current.separators.find(
          (M) => M.id === I
        );
        R && (R.disabled = T, R.disableDoubleClick = E);
      }
    }),
    [x, w, v, u, $]
  ), D = A(null);
  return kt(() => {
    const I = S.current;
    if (I === null)
      return;
    const T = k.current;
    let E;
    if ($.defaultLayout !== void 0 && Object.keys($.defaultLayout).length === T.panels.length) {
      E = {};
      for (const q of T.panels) {
        const ee = $.defaultLayout[q.id];
        ee !== void 0 && (E[q.id] = ee);
      }
    }
    const R = {
      disabled: !!o,
      element: I,
      id: w,
      mutableState: {
        defaultLayout: E,
        disableCursor: !!$.disableCursor,
        expandedPanelSizes: k.current.lastExpandedPanelSizes,
        layouts: k.current.layouts
      },
      orientation: u,
      panels: T.panels,
      resizeTargetMinimumSize: T.resizeTargetMinimumSize,
      separators: T.separators
    };
    D.current = R;
    const M = Af(R), { defaultLayoutDeferred: _, derivedPanelConstraints: L, layout: j } = ct(R.id, !0);
    !_ && L.length > 0 && (h(j), y(j, !1));
    const U = cr(w, (q) => {
      const { defaultLayoutDeferred: ee, derivedPanelConstraints: le, layout: ue } = q.next;
      if (ee || le.length === 0)
        return;
      const ce = R.panels.map(({ id: ne }) => ne).join(",");
      R.mutableState.layouts[ce] = ue, le.forEach((ne) => {
        if (ne.collapsible) {
          const { layout: re } = q.prev ?? {};
          if (re) {
            const fe = we(
              ne.collapsedSize,
              ue[ne.panelId]
            ), be = we(
              ne.collapsedSize,
              re[ne.panelId]
            );
            fe && !be && (R.mutableState.expandedPanelSizes[ne.panelId] = re[ne.panelId]);
          }
        }
      });
      const xe = pt().state !== "active";
      h(ue), xe && y(ue, q.isUserInteraction);
    });
    return () => {
      D.current = null, M(), U();
    };
  }, [
    o,
    w,
    y,
    h,
    u,
    b,
    $
  ]), O(() => {
    const I = D.current;
    I && (I.mutableState.defaultLayout = n, I.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(Wa.Provider, { value: F, children: /* @__PURE__ */ p(
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
Ka.displayName = "Group";
function mr() {
  const e = Xn(Wa);
  return ie(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Df(e, t) {
  const { id: n } = mr(), r = A({
    collapse: Pn,
    expand: Pn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Pn
  });
  Zn(t, () => r.current, []), kt(() => {
    Object.assign(
      r.current,
      ja({ groupId: n, panelId: e })
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
  onResize: f,
  panelRef: d,
  style: m,
  ...g
}) {
  const h = !!c, y = ur(c), w = fr({
    disabled: a
  }), S = A(null), b = dr(S, s), {
    getPanelStyles: v,
    id: k,
    orientation: P,
    registerPanel: x,
    updatePanelProps: $
  } = mr(), F = f !== null, D = Kt(
    (R, M, _) => {
      f == null || f(R, c, _);
    }
  );
  kt(() => {
    const R = S.current;
    if (R !== null) {
      const M = {
        element: R,
        id: y,
        idIsStable: h,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: F ? D : void 0,
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
    F,
    y,
    h,
    l,
    u,
    D,
    x,
    w
  ]), O(() => {
    $(y, { disabled: a });
  }, [a, y, $]), Df(y, d);
  const I = () => {
    const R = v(k, y);
    if (R)
      return JSON.stringify(R);
  }, T = xo(
    (R) => cr(k, R),
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
      "data-testid": y,
      id: y,
      ref: b,
      style: {
        ...Cf,
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
Vn.displayName = "Panel";
const Cf = {
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
function zf({
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
    a = bt({
      layout: Gt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = bt({
      layout: Gt({
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
function Va({
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
  }), [u, f] = N({}), [d, m] = N("inactive"), [g, h] = N(!1), y = A(null), w = dr(y, o), {
    disableCursor: S,
    id: b,
    orientation: v,
    registerSeparator: k,
    updateSeparatorProps: P
  } = mr(), x = v === "horizontal" ? "vertical" : "horizontal";
  kt(() => {
    const D = y.current;
    if (D !== null) {
      const I = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: D,
        id: c
      }, T = k(I), E = mf(
        (M) => {
          m(
            M.next.state !== "inactive" && M.next.hitRegions.some(
              (_) => _.separator === I
            ) ? M.next.state : "inactive"
          );
        }
      ), R = cr(
        b,
        (M) => {
          const { derivedPanelConstraints: _, layout: L, separatorToPanels: j } = M.next, U = j.get(I);
          if (U) {
            const q = U[0], ee = U.indexOf(q);
            f(
              zf({
                layout: L,
                panelConstraints: _,
                panelId: q.id,
                panelIndex: ee
              })
            );
          }
        }
      );
      return () => {
        E(), R(), T();
      };
    }
  }, [b, c, k, l]), O(() => {
    P(c, { disabled: n, disableDoubleClick: r });
  }, [n, r, c, P]);
  let $;
  n && !S && ($ = "not-allowed");
  let F;
  if (n)
    F = "disabled";
  else
    switch (d) {
      case "active": {
        F = "active";
        break;
      }
      default:
        g ? F = "focus" : F = d;
    }
  return /* @__PURE__ */ p(
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
      "data-separator": F,
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
Va.displayName = "Separator";
const hr = 30, pr = 65, Xt = 50, Of = 100 - pr, $f = 100 - hr;
function Ff(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(pr, Math.max(hr, t)) : Xt;
}
function gr(e) {
  return 100 - e;
}
function Rt(e) {
  return `${e}%`;
}
const br = "reader-document", Zt = "reader-assistant", Ja = "retainpdf.reader.ai-split-layout.v1", Bf = {
  [br]: gr(Xt),
  [Zt]: Xt
};
function yr(e) {
  const t = Ff(e == null ? void 0 : e[Zt]);
  return {
    [br]: gr(t),
    [Zt]: t
  };
}
function jf() {
  try {
    const e = JSON.parse(localStorage.getItem(Ja) || "null");
    return yr(e);
  } catch {
    return Bf;
  }
}
function Hf(e) {
  try {
    localStorage.setItem(Ja, JSON.stringify(yr(e)));
  } catch {
  }
}
function Mn(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = yr(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[Zt]}vw`
  );
}
function Uf() {
  const e = A(null), [t] = N(jf);
  Te(() => {
    const o = e.current;
    return Mn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = C((o) => {
    Mn(e.current, o);
  }, []), r = C((o, a) => {
    Mn(e.current, o), a.isUserInteraction && Hf(o);
  }, []);
  return /* @__PURE__ */ z(
    Ka,
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
          Vn,
          {
            id: br,
            defaultSize: Rt(gr(Xt)),
            minSize: Rt(Of),
            maxSize: Rt($f)
          }
        ),
        /* @__PURE__ */ p(
          Va,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ p("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ p(
          Vn,
          {
            id: Zt,
            defaultSize: Rt(Xt),
            minSize: Rt(hr),
            maxSize: Rt(pr)
          }
        )
      ]
    }
  );
}
function Wf({
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
  return /* @__PURE__ */ z("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ z("span", { className: "reader-error-notice-text", children: [
      a.join("、"),
      "加载失败，正文仍可正常阅读。"
    ] }),
    n ? /* @__PURE__ */ p(Y, { className: "reader-error-notice-retry", "data-reader-retry": "optional", onClick: n, children: "重试" }) : null,
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
function Kf({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(Wf, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ z(yt, { children: [
    e ? /* @__PURE__ */ p("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ z("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ p("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ p(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ z("div", { className: "reader-react-error", role: "alert", children: [
      /* @__PURE__ */ p("span", { className: "reader-react-error-text", children: n }),
      s ? /* @__PURE__ */ p(Y, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function Vf(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Jf() {
  const [e, t] = N(!1), n = Do(), r = A(null);
  return O(() => {
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
  }, [e]), O(() => {
    const o = (a) => {
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || Vf(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((i) => !i);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
  }, []), /* @__PURE__ */ z("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
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
        children: /* @__PURE__ */ p(Ms, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ z(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ z("div", { className: "reader-react-shortcuts-head", children: [
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
          /* @__PURE__ */ p("div", { className: "reader-react-shortcuts-body", children: hl.map((o) => /* @__PURE__ */ z("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ p("h3", { children: o.title }),
            /* @__PURE__ */ p("ul", { children: o.items.map((a) => /* @__PURE__ */ z("li", { children: [
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
const qf = ["source", "sideBySide", "translated"], Gf = { source: "", translated: "", sideBySide: "" };
function Xf(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = sn(e.sourceUrl), n = sn(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return si({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function Zf(e) {
  const [t, n] = N(() => /* @__PURE__ */ new Set()), r = J(
    () => e ? Xf(e) : Gf,
    [e]
  ), o = J(
    () => qf.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = C(async (s) => {
    if (!e) return;
    const i = sn(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? ai(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await ii(
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
        ci(l), n((u) => {
          const f = new Set(u);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const Yf = {
  source: Bo,
  sideBySide: jo,
  translated: Ho
}, Qf = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function em(e) {
  const t = et(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Zf(n), i = A(null);
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
  }, []), /* @__PURE__ */ z("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ z("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ p(Ns, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ p(Fo, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = ss[c], u = sn(r[c]), f = a.has(c), d = !!u && !f, m = d ? "" : is(c, r), g = Yf[c];
      return /* @__PURE__ */ z(
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
            /* @__PURE__ */ p(g, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ z("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ z("span", { className: "reader-download-action-label", children: [
                Qf[c],
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
const tm = "retainpdf:reader:bookmarks:v1:", nm = 200;
function vr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function qa(e) {
  const t = `${e || ""}`.trim();
  return t ? `${tm}${t}` : "";
}
function rm(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function hn(e, t = vr()) {
  const n = qa(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = rm(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function Jn(e, t, n) {
  const r = qa(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, nm);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function om(e, t, n = "", { storage: r = vr(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = hn(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? Jn(e, a.filter((i) => i.page !== s), r) : Jn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function am(e, t, n = vr()) {
  return Jn(e, hn(e, n).filter((r) => r.page !== t), n);
}
function sm(e, t) {
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
function im({ filled: e }) {
  return /* @__PURE__ */ p("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ p("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function cm({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = N(() => hn(e)), [i, c] = N(!1), l = A(null);
  if (O(() => {
    s(hn(e)), c(!1);
  }, [e]), O(() => {
    if (!i) return;
    const d = (g) => {
      l.current && !l.current.contains(g.target) && c(!1);
    }, m = (g) => {
      g.key === "Escape" && c(!1);
    };
    return document.addEventListener("pointerdown", d), document.addEventListener("keydown", m), () => {
      document.removeEventListener("pointerdown", d), document.removeEventListener("keydown", m);
    };
  }, [i]), !e || n <= 0) return null;
  const u = Math.min(Math.max(t, 1), n), f = a.some((d) => d.page === u);
  return /* @__PURE__ */ z("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: l, children: [
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${f ? " is-marked" : ""}`,
        "aria-pressed": f,
        "aria-label": f ? `取消第 ${u} 页的书签` : `给第 ${u} 页加书签`,
        title: f ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(om(e, u, sm(r, u))),
        children: /* @__PURE__ */ p(im, { filled: f })
      }
    ),
    a.length ? /* @__PURE__ */ z(
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
          /* @__PURE__ */ p(_s, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { className: "reader-bookmark-count", children: a.length })
        ]
      }
    ) : null,
    i && a.length ? /* @__PURE__ */ p("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ p("ol", { className: "reader-bookmark-list", children: a.map((d) => /* @__PURE__ */ z("li", { className: d.page === u ? "is-current" : "", children: [
      /* @__PURE__ */ z(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(d.page, n)), c(!1);
          },
          children: [
            /* @__PURE__ */ z("span", { className: "reader-bookmark-page", children: [
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
          onClick: () => s(am(e, d.page)),
          children: "×"
        }
      )
    ] }, d.page)) }) }) : null
  ] });
}
function lm(e) {
  const [t, n] = N([]);
  return O(() => {
    n((s) => s.length ? [] : s);
    const r = `${e || ""}`.trim();
    let o;
    try {
      o = Qe().loadIssues;
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
function um(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const dm = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, fm = ["failed", "content", "layout"];
function mm(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function hm({ jobId: e, currentPage: t }) {
  var f;
  const n = lm(e), r = (f = et()) == null ? void 0 : f.jumpToBlock, [o, a] = N(!1), [s, i] = N(-1), c = A(null);
  O(() => i(-1), [n]);
  const l = (d) => {
    const m = n[d];
    !m || !r || (i(d), r(m.readerItemId));
  }, u = A({ issues: n, last: s, currentPage: t, goTo: l });
  return u.current = { issues: n, last: s, currentPage: t, goTo: l }, O(() => {
    const d = (m) => {
      if (m.key.toLowerCase() !== "n" || m.metaKey || m.ctrlKey || m.altKey || mm(m.target)) return;
      const { issues: g, last: h, currentPage: y, goTo: w } = u.current, S = um(g, h, y, m.shiftKey);
      S < 0 || (m.preventDefault(), w(S));
    };
    return document.addEventListener("keydown", d), () => document.removeEventListener("keydown", d);
  }, []), O(() => {
    if (!o) return;
    const d = (m) => {
      var g;
      (g = c.current) != null && g.contains(m.target) || a(!1);
    };
    return document.addEventListener("pointerdown", d, !0), () => document.removeEventListener("pointerdown", d, !0);
  }, [o]), n.length ? /* @__PURE__ */ z("div", { className: "reader-react-hud-group reader-issues", ref: c, "aria-label": "待处理", children: [
    /* @__PURE__ */ z(
      Y,
      {
        className: "reader-react-hud-btn reader-issues-toggle",
        "aria-expanded": o,
        "aria-haspopup": "true",
        "aria-label": `待处理 ${n.length} 处`,
        title: "这次翻译里要人看一眼的段落（N 下一处，Shift+N 上一处）",
        onClick: () => a((d) => !d),
        children: [
          /* @__PURE__ */ p(As, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { children: n.length })
        ]
      }
    ),
    o ? /* @__PURE__ */ z("div", { className: "reader-issues-popover", role: "dialog", "aria-label": "待处理", children: [
      /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
      fm.map((d) => {
        const m = n.map((g, h) => ({ issue: g, index: h })).filter(({ issue: g }) => g.kind === d);
        return m.length ? /* @__PURE__ */ z("section", { className: "reader-issues-group", "data-issue-kind": d, children: [
          /* @__PURE__ */ z("h4", { children: [
            dm[d],
            /* @__PURE__ */ p("span", { children: m.length })
          ] }),
          /* @__PURE__ */ p("ol", { children: m.map(({ issue: g, index: h }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ z(
            Y,
            {
              className: "reader-issues-item",
              "aria-current": h === s ? "true" : void 0,
              onClick: () => {
                l(h), a(!1);
              },
              children: [
                /* @__PURE__ */ p("span", { className: "reader-issues-title", children: g.title }),
                /* @__PURE__ */ z("span", { className: "reader-issues-page", children: [
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
const pm = 48, gm = 96, bm = 700;
function ym(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= pm, downSoFar: r };
}
function vm(e) {
  const [t, n] = N(!1), r = A(0);
  return O(() => {
    const o = /* @__PURE__ */ new WeakMap();
    let a = 0;
    const s = () => {
      a = Date.now();
    }, i = /* @__PURE__ */ new WeakMap(), c = () => {
      const d = e.current;
      return !!(d && (d.querySelector(":focus-visible") || d.querySelector("[aria-expanded='true']")));
    }, l = (d) => {
      const m = d.target;
      if (!(m instanceof Element) || (i.has(m) || i.set(m, !!m.querySelector(`[${Ie}]`)), !i.get(m))) return;
      const g = m.scrollTop, h = o.get(m);
      if (o.set(m, g), h === void 0 || Date.now() - a > bm) return;
      const y = ym(!1, r.current, g - h);
      r.current = y.downSoFar, g - h < -4 ? n(!1) : y.hidden && !c() && n(!0);
    }, u = (d) => {
      d.clientY >= window.innerHeight - gm && (r.current = 0, n(!1));
    }, f = () => {
      c() && n(!1);
    };
    document.addEventListener("scroll", l, { capture: !0, passive: !0 }), window.addEventListener("pointermove", u, { passive: !0 }), document.addEventListener("focusin", f);
    for (const d of ["wheel", "touchmove", "keydown"]) window.addEventListener(d, s, { passive: !0, capture: !0 });
    return () => {
      for (const d of ["wheel", "touchmove", "keydown"]) window.removeEventListener(d, s, { capture: !0 });
      document.removeEventListener("scroll", l, { capture: !0 }), window.removeEventListener("pointermove", u), document.removeEventListener("focusin", f);
    };
  }, [e]), t;
}
function wm(e) {
  const t = et(), n = Ea(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Yt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = Gi(a), f = a > Zo + 1e-3, d = a < fn - 1e-3, m = Pt(r, it()), g = m >= fn ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", h = A(null), y = vm(h), [w, S] = N(!1), [b, v] = N(`${i}`);
  O(() => {
    w || v(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, w]);
  const k = () => {
    if (S(!1), !l || c <= 0)
      return;
    const P = Number(`${b}`.trim());
    l(mn(P, c));
  };
  return /* @__PURE__ */ z("div", { ref: h, className: "reader-react-hud", "data-reader-hud": "true", "data-hud-hidden": y ? "true" : void 0, children: [
    o ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "页码", children: w ? /* @__PURE__ */ z(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (P) => {
          P.preventDefault(), k();
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
              onChange: (P) => v(P.target.value.replace(/[^\d]/g, "")),
              onBlur: k,
              onKeyDown: (P) => {
                P.key === "Escape" && (P.preventDefault(), S(!1), v(`${i}`));
              }
            }
          ),
          /* @__PURE__ */ z("span", { className: "reader-react-hud-page-suffix", children: [
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
      cm,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: c,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
      }
    ) : null,
    e.issuesJobId ? /* @__PURE__ */ p(hm, { jobId: e.issuesJobId, currentPage: i }) : null,
    t != null && t.toggleDocDark ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "显示", children: /* @__PURE__ */ p(
      Y,
      {
        className: "reader-react-hud-btn reader-react-hud-doc-dark",
        "aria-pressed": t.docDark ? "true" : "false",
        "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
        title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
        onClick: t.toggleDocDark,
        children: /* @__PURE__ */ p(Sm, {})
      }
    ) }) : null,
    /* @__PURE__ */ z("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ p(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !f,
          onClick: () => s(qt(a, -1)),
          children: "−"
        }
      ),
      /* @__PURE__ */ z(
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
          onClick: () => s(qt(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(Jf, {}) })
  ] });
}
function Sm() {
  return /* @__PURE__ */ z("svg", { width: "14", height: "14", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: [
    /* @__PURE__ */ p("circle", { cx: "8", cy: "8", r: "6.25", fill: "none", stroke: "currentColor", strokeWidth: "1.5" }),
    /* @__PURE__ */ p("path", { d: "M8 1.75a6.25 6.25 0 0 1 0 12.5z", fill: "currentColor" })
  ] });
}
function Io(e) {
  var t, n;
  return ra(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function km(e) {
  const [t, n] = N(() => ({
    scope: e,
    panel: Io(Ue(e))
  }));
  O(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Io(Ue(e))
    });
  }, [e]), O(() => {
    t.scope === e && bn(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = C((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const qn = "download-toast";
function Im({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ z("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ z("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ p("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ p("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ p("div", { className: "download-toast-track", children: /* @__PURE__ */ p("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ p("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function Tm(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    Ln.dismiss(qn);
    return;
  }
  Ln.custom(
    () => /* @__PURE__ */ p(Im, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: qn, duration: 1 / 0 }
  );
}
function Rm() {
  const e = C((t) => {
    t && (t.setState = Tm, t.hide = () => Ln.dismiss(qn));
  }, []);
  return /* @__PURE__ */ z(yt, { children: [
    /* @__PURE__ */ p(Ks, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function Em(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : Qo(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Pm(e, t) {
  return t === null || e !== t;
}
function Mm(e) {
  const t = A(!1);
  return e && (t.current = !0), t.current;
}
function Nm(e, t) {
  const n = e === t;
  return { open: n, mounted: Mm(n) };
}
const To = { itemId: null, origin: null };
function _m() {
  let e = To;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? To : { itemId: n, origin: r };
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
function Am({
  nodes: e,
  currentPage: t,
  onJumpPage: n
}) {
  const r = J(() => ha(e, t), [e, t]), [o, a] = N(() => /* @__PURE__ */ new Set([...Br(r), ...r ? [r] : []]));
  O(() => {
    a(/* @__PURE__ */ new Set([...Br(r), ...r ? [r] : []]));
  }, [e]);
  const s = A(null);
  O(() => {
    var l, u;
    (u = (l = s.current) == null ? void 0 : l.querySelector('[aria-current="location"]')) == null || u.scrollIntoView({ block: "center" });
  }, [e]);
  const i = (l) => a((u) => {
    const f = new Set(u);
    return f.has(l) ? f.delete(l) : f.add(l), f;
  }), c = (l) => l.map((u) => {
    const f = o.has(u.id), d = u.children.length > 0;
    return /* @__PURE__ */ z("li", { className: "reader-bookmark", "data-level": u.level, children: [
      /* @__PURE__ */ z("div", { className: "reader-bookmark-row", children: [
        d ? /* @__PURE__ */ p(
          Y,
          {
            className: `reader-bookmark-toggle${f ? " is-open" : ""}`,
            "aria-label": f ? `收起「${u.title}」` : `展开「${u.title}」`,
            "aria-expanded": f,
            onClick: () => i(u.id),
            children: /* @__PURE__ */ p(Uo, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 })
          }
        ) : /* @__PURE__ */ p("span", { className: "reader-bookmark-spacer", "aria-hidden": "true" }),
        /* @__PURE__ */ z(
          Y,
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
      d && f ? /* @__PURE__ */ p("ol", { className: "reader-bookmark-children", children: c(u.children) }) : null
    ] }, u.id);
  });
  return /* @__PURE__ */ p("ol", { ref: s, className: "reader-finder-list reader-bookmark-tree", "aria-label": "书签", children: c(e) });
}
const Lm = [], xm = [];
function Dm({
  open: e,
  onToggle: t,
  children: n
}) {
  return /* @__PURE__ */ z("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ p(Y, { className: "reader-finder-toggle", "aria-label": "目录", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: /* @__PURE__ */ p(Ls, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }) }),
    n
  ] });
}
function Cm({ open: e, onToggle: t }) {
  return /* @__PURE__ */ p(
    Y,
    {
      className: "reader-react-hud-btn reader-search-toggle",
      "data-finder-toggle": "search",
      "aria-label": "在书里搜索",
      "aria-pressed": e === "search",
      title: "在书里搜索（原文和译文，⌘F）",
      onClick: () => t("search"),
      children: /* @__PURE__ */ p(xs, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 })
    }
  );
}
function zm({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0,
  bookmarks: c = xm,
  onJumpPage: l
}) {
  var D, I;
  const u = ((D = et()) == null ? void 0 : D.regions) ?? Lm, f = ((I = Ea()) == null ? void 0 : I.currentPage) ?? 1, d = J(() => Bl(u), [u]), m = c.length > 0 && !!l, [g, h] = N("bookmarks"), y = m && (g === "bookmarks" || !d.length), w = jl(d, f), S = J(() => Wl(u, s), [u, s]), [b, v] = N(-1);
  O(() => v(-1), [s]);
  const k = A(null), P = A(null), x = A(n);
  x.current = n, O(() => {
    const T = (R) => {
      var _, L;
      const M = R.target;
      !M || (_ = P.current) != null && _.contains(M) || (L = M.closest) != null && L.call(M, ".reader-finder-toggles, [data-finder-toggle]") || x.current();
    }, E = (R) => {
      R.key === "Escape" && x.current();
    };
    return document.addEventListener("pointerdown", T, !0), document.addEventListener("keydown", E), () => {
      document.removeEventListener("pointerdown", T, !0), document.removeEventListener("keydown", E);
    };
  }, []);
  const $ = A(null);
  O(() => {
    var T, E, R;
    e === "search" ? (T = k.current) == null || T.focus() : (R = (E = $.current) == null ? void 0 : E.querySelector('[aria-current="location"]')) == null || R.scrollIntoView({ block: "center" });
  }, [e, i]), O(() => {
    var T, E;
    e === "search" && b >= 0 && ((E = (T = $.current) == null ? void 0 : T.querySelector('[aria-current="true"]')) == null || E.scrollIntoView({ block: "nearest" }));
  }, [e, b]);
  const F = (T) => {
    const E = S[T];
    E && (v(T), r(E.itemId));
  };
  return /* @__PURE__ */ z("aside", { ref: P, className: "reader-finder", "data-finder-tab": e, "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ z("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ z("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ p(Y, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ p(Y, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ p(Y, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(wt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" && m && d.length ? /* @__PURE__ */ z("div", { className: "reader-finder-switch", role: "radiogroup", "aria-label": "目录按什么列", children: [
      /* @__PURE__ */ p(Y, { className: "reader-finder-switch-option", role: "radio", "aria-checked": y, onClick: () => h("bookmarks"), children: "按书签" }),
      /* @__PURE__ */ p(Y, { className: "reader-finder-switch-option", role: "radio", "aria-checked": !y, onClick: () => h("headings"), children: "按标题" })
    ] }) : null,
    e === "outline" && y && l ? /* @__PURE__ */ p(Am, { nodes: c, currentPage: f, onJumpPage: l }) : e === "outline" ? d.length ? /* @__PURE__ */ p("ol", { ref: $, className: "reader-finder-list", children: d.map((T, E) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ z(
      Y,
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
    ) }, T.itemId)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: u.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ z(yt, { children: [
      /* @__PURE__ */ z("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          Wo,
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
              T.key === "Enter" ? (T.preventDefault(), F(Kl(b, S.length, T.shiftKey))) : T.key === "Escape" && (T.preventDefault(), n()), T.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: S.length === 0 ? "没有找到" : `${b >= 0 ? `第 ${b + 1} / ` : ""}${S.length >= 200 ? "200+ 处，只列前 200 处" : `${S.length} 处`}${b < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { className: "reader-finder-list", children: S.map((T, E) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ z(Y, { className: "reader-finder-entry is-hit", "aria-current": E === b ? "true" : void 0, onClick: () => F(E), children: [
        /* @__PURE__ */ z("span", { className: "reader-finder-entry-text", children: [
          T.snippet.slice(0, T.at),
          /* @__PURE__ */ p("mark", { children: T.snippet.slice(T.at, T.at + T.length) }),
          T.snippet.slice(T.at + T.length)
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: T.page })
      ] }) }, T.itemId)) })
    ] })
  ] });
}
function Om({ active: e, compare: t, ink: n }) {
  const [r, o] = N(!1), [a, s] = N(!1), i = A(null);
  O(() => {
    if (!r && !a) return;
    const l = () => {
      o(!1), s(!1);
    }, u = (d) => {
      var m;
      (m = i.current) != null && m.contains(d.target) || l();
    }, f = (d) => {
      d.key === "Escape" && l();
    };
    return document.addEventListener("pointerdown", u, !0), document.addEventListener("keydown", f), () => {
      document.removeEventListener("pointerdown", u, !0), document.removeEventListener("keydown", f);
    };
  }, [r, a]);
  const c = !!(t.compared || t.loading);
  return /* @__PURE__ */ z("div", { className: "reader-toolball", ref: i, "data-open": r ? "true" : void 0, children: [
    a ? /* @__PURE__ */ p(Bd, { compare: t, onDone: () => {
      s(!1), o(!1);
    } }) : null,
    r ? /* @__PURE__ */ z("div", { className: "reader-toolball-stack", role: "group", "aria-label": "工具", children: [
      n ? /* @__PURE__ */ p(
        Y,
        {
          className: "reader-toolball-item",
          "aria-label": "画笔",
          title: "画笔（P；书页上右键也能选笔和颜色）",
          "aria-pressed": !!n.tool,
          "data-toolball-item": "ink",
          onClick: () => {
            n.setTool(n.tool ? null : "pen"), o(!1);
          },
          children: /* @__PURE__ */ p(Yn, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null,
      /* @__PURE__ */ p(tf, { active: e }),
      t.available ? /* @__PURE__ */ p(
        Y,
        {
          className: "reader-toolball-item",
          "aria-label": "对比版本",
          title: "对比版本：左边换成这本书的另一份译文",
          "aria-pressed": c || a,
          "data-toolball-item": "compare",
          onClick: () => s((l) => !l),
          children: /* @__PURE__ */ p(Ds, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null
    ] }) : null,
    /* @__PURE__ */ p(
      Y,
      {
        className: "reader-toolball-ball",
        "aria-label": r ? "收起工具" : "工具：画笔、Markdown、对比版本",
        title: r ? "收起" : "工具",
        "aria-expanded": r,
        "data-active": e || c ? "true" : void 0,
        onClick: () => {
          o((l) => !l), s(!1);
        },
        children: r ? /* @__PURE__ */ p(wt, { size: 20, strokeWidth: 2.2, "aria-hidden": !0 }) : /* @__PURE__ */ p(Cs, { size: 20, strokeWidth: 2.1, "aria-hidden": !0 })
      }
    )
  ] });
}
const $m = [
  { tool: "pen", label: "画笔", Icon: Yn },
  { tool: "highlighter", label: "荧光笔", Icon: zs },
  { tool: "eraser", label: "橡皮", Icon: Os }
];
function Ga(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Xa({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ z(yt, { children: [
    $m.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
      Y,
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
    Sa.map((o) => /* @__PURE__ */ p(
      Y,
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
    /* @__PURE__ */ p(Y, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p($s, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      Y,
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
      Y,
      {
        className: "reader-ink-tool",
        "aria-label": "退出画笔",
        title: "退出画笔（Esc）",
        "data-ink-exit": "true",
        onClick: () => {
          e.setTool(null), r();
        },
        children: /* @__PURE__ */ p(wt, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function Fm({
  ink: e,
  menu: t,
  onClose: n,
  actions: r = []
}) {
  const o = A(null);
  if (O(() => {
    if (!t) return;
    const c = (u) => {
      var f;
      (f = o.current) != null && f.contains(u.target) || n();
    }, l = (u) => {
      u.key === "Escape" && n();
    };
    return document.addEventListener("pointerdown", c, !0), document.addEventListener("keydown", l), () => {
      document.removeEventListener("pointerdown", c, !0), document.removeEventListener("keydown", l);
    };
  }, [t, n]), !t) return null;
  const a = 380, s = Math.max(8, Math.min(t.x, (globalThis.innerWidth || a) - a - 8)), i = Math.max(68, Math.min(t.y, (globalThis.innerHeight || 600) - 60 - (r.length ? 40 : 0)));
  return /* @__PURE__ */ z("div", { ref: o, className: "reader-ink-menu", style: { left: s, top: i }, "data-ink-menu": "true", children: [
    r.length ? /* @__PURE__ */ p("div", { className: "reader-ink-menu-actions", role: "menu", "aria-label": "书页", children: r.map((c) => /* @__PURE__ */ z(
      Y,
      {
        className: "reader-ink-menu-action",
        role: "menuitem",
        title: c.hint,
        onClick: () => {
          c.onSelect(), n();
        },
        children: [
          c.label,
          c.hint ? /* @__PURE__ */ p("kbd", { children: c.hint }) : null
        ]
      },
      c.key
    )) }) : null,
    /* @__PURE__ */ p("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ p(Xa, { ink: e, page: t.page, onPick: n }) })
  ] });
}
function Bm({ ink: e }) {
  return e.tool ? /* @__PURE__ */ p("div", { className: "reader-ink-bar is-dock", role: "toolbar", "aria-label": "画笔", "data-ink-dock": "true", children: /* @__PURE__ */ p(Xa, { ink: e }) }) : null;
}
function jm(e) {
  var r;
  if (e.shiftKey || Ga(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${Go}`))) return null;
  const n = Number((r = t.closest(`[${Ie}]`)) == null ? void 0 : r.getAttribute(Ie)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Hm(e) {
  const t = A(e);
  t.current = e, O(() => {
    const n = (r) => {
      if (Ga(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
function Nn() {
  try {
    return Qe().translationVersions ?? null;
  } catch {
    return null;
  }
}
function Um(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function Wm(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function Km(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function Vm({ documentId: e, jobId: t }) {
  const [n, r] = N([]), [o, a] = N(null), [s, i] = N(null), [c, l] = N(""), [u, f] = N(""), d = A(0);
  O(() => {
    r([]), i(null), f("");
    const y = Nn();
    if (!y || !e) return;
    let w = !1;
    return y.list(e).then((S) => {
      w || (r(S.versions), a(S.currentVersionId));
    }).catch(() => {
    }), () => {
      w = !0;
    };
  }, [e, t]);
  const m = C((y) => {
    const w = Nn(), S = n.find((v) => v.versionId === y);
    if (!w || !S || !e) return;
    const b = ++d.current;
    l(y), f(""), (async () => {
      const v = Qe(), k = await w.resolveJob(e, y);
      if (!k) throw new Error("这一份还没有能读的译文。");
      const P = await v.loadReaderPayload(k, { includeOptionalArtifacts: !0 }), x = v.resolveReaderTranslatedPdfUrl(P.jobPayload, P.manifestPayload);
      if (!x) throw new Error("这一份没有译文 PDF。");
      return { versionId: y, name: S.name, jobId: k, url: x, regions: Um(Oo(P.regionsPayload)) };
    })().then((v) => {
      b === d.current && i(v);
    }).catch((v) => {
      b === d.current && f((v == null ? void 0 : v.message) || "这一份打不开。");
    }).finally(() => {
      b === d.current && l("");
    });
  }, [e, n]), g = C(() => {
    d.current += 1, i(null), l(""), f("");
  }, []), h = C(async () => {
    var S, b;
    const y = Nn();
    if (!y || !s || !e) return;
    try {
      await y.select(e, s.versionId);
    } catch (v) {
      f((v == null ? void 0 : v.message) || "换不过去，请稍后再试。");
      return;
    }
    const w = (S = globalThis.location) == null ? void 0 : S.href;
    w && ((b = globalThis.history) == null || b.replaceState(globalThis.history.state, "", Km(w, s.jobId))), i(null);
  }, [s, e]);
  return {
    available: n.length >= 2,
    versions: n,
    readingVersionId: Wm(n, t, o),
    compared: s,
    loading: c,
    error: u,
    choose: m,
    clear: g,
    adopt: h
  };
}
const Jm = "reader-finder-input";
function qm(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function Gm(e, t = typeof window > "u" ? null : window) {
  O(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!qm(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(Jm) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function Xm() {
  try {
    return Qe().translationEdit ?? null;
  } catch {
    return null;
  }
}
const Zm = "这本书正在处理（翻译或排版），处理完才能改。", Ym = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function Qm({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = Xm(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = ou(s), l = !t || Vt(t), u = uu(n), [f, d] = N(""), [m, g] = N(null), [h, y] = N(() => /* @__PURE__ */ new Map()), [w, S] = N(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [b, v] = N(() => /* @__PURE__ */ new Map()), [k, P] = N({ phase: "idle" }), x = A({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  O(() => {
    g(null), x.drafts.clear(), x.generation.current = null, v(/* @__PURE__ */ new Map()), P({ phase: "idle" });
  }, [s]), O(() => {
    if (d(""), !i || c || !a) return;
    let M = !1;
    return a.resolveOwnerJobId(s).then((_) => {
      M || d(`${_ || s}`.trim() || s);
    }).catch(() => {
      M || d(s);
    }), () => {
      M = !0;
    };
  }, [i, c, a, s]), O(() => {
    if (y(/* @__PURE__ */ new Map()), !a || !f || !u || !l) return;
    let M = !1;
    return a.fetchRevisions(f).then((_) => {
      M || y(du(_, u));
    }).catch(() => {
    }), () => {
      M = !0;
    };
  }, [a, f, u, l]);
  const $ = k.phase === "running" && k.seenActive;
  O(() => {
    if (k.phase === "running") {
      if (!l) {
        $ || P({ phase: "running", seenActive: !0 });
        return;
      }
      $ && P(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [k.phase, $, l, t]);
  const F = J(() => {
    const M = new Map(h);
    if (w.renderedAt === u)
      for (const [_, L] of w.edits) M.set(_, L);
    return M;
  }, [h, w, u]), D = C((M) => {
    const _ = `${M || ""}`.trim();
    _ && g({ itemId: _, page: au(_) });
  }, []), I = C(() => g(null), []), T = C((M, _) => {
    S((L) => {
      const j = new Map(L.renderedAt === u ? L.edits : []);
      return j.set(M, _), { renderedAt: u, edits: j };
    }), v((L) => new Map(L).set(M, (L.get(M) || 0) + 1));
  }, [u]), E = C(async () => {
    if (!(!a || !s || k.phase === "submitting" || k.phase === "running")) {
      P({ phase: "submitting" });
      try {
        await a.rerender(s), P({ phase: "running", seenActive: !1 }), await o();
      } catch (M) {
        P({ phase: "failed", message: (M == null ? void 0 : M.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, k.phase, o]), R = c ? Ym : !l || k.phase === "running" || k.phase === "submitting" ? Zm : "";
  return J(() => ({
    available: i,
    blockedReason: R,
    port: a,
    ownerJobId: f,
    target: m,
    select: D,
    close: I,
    memory: x,
    pendingEdits: F,
    savedCounts: b,
    markSaved: T,
    rerender: k,
    startRerender: E
  }), [i, R, a, f, m, D, I, x, F, b, T, k, E]);
}
function eh(e, t) {
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
function th({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ p("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ z("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
    /* @__PURE__ */ p("span", { children: n.phase === "failed" ? n.message : `改了 ${t} 处，还没排进 PDF` }),
    t ? /* @__PURE__ */ p(
      Y,
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
const Za = "retainpdf:reader:doc-theme:v1", Ro = "data-reader-doc";
function Ya() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function nh(e = Ya()) {
  try {
    return (e == null ? void 0 : e.getItem(Za)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function rh(e, t = Ya()) {
  try {
    t == null || t.setItem(Za, e);
  } catch {
  }
}
function Eo(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(Ro, "dark") : t.removeAttribute(Ro));
}
function oh() {
  const [e, t] = N(() => nh());
  O(() => {
    Eo(e);
  }, [e]), O(() => () => Eo("light"), []);
  const n = C(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return rh(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
const Po = 6e3;
function Qa(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function ah(e, t, n, r) {
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
function es({
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
        const m = d.getViewport({ scale: 1 }), g = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), h = ah(n, m, r, g), y = s.current, w = y == null ? void 0 : y.getContext("2d");
        if (!y || !w) return;
        y.width = h.canvasWidth, y.height = h.canvasHeight, c({ status: "loading", cssHeight: h.cssHeight });
        const S = d.getViewport({ scale: h.scale, offsetX: h.offsetX, offsetY: h.offsetY }), b = d.render({ canvasContext: w, viewport: S });
        f = b, await b.promise, u || c({ status: "ready", cssHeight: h.cssHeight });
      } catch (d) {
        !u && (d == null ? void 0 : d.name) !== "RenderingCancelledException" && c((m) => ({ status: "error", cssHeight: m.cssHeight }));
      }
    })(), () => {
      u = !0, f == null || f.cancel();
    };
  }, [e, l]), /* @__PURE__ */ z(
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
const Mo = { figure: "图", table: "表", formula: "公式", text: "文字" }, rt = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function sh(e, t, n) {
  const r = At(e, t, n), o = r ? vt(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = Qa({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function ih(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, c = null;
  for (const u of e) {
    const f = At(u, t, n), d = f ? vt(f, 1, 1) : null;
    !f || !d || (r || (r = f.box.page, c = f.pageSize), f.box.page === r && (o = Math.min(o, d.left), a = Math.min(a, d.top), s = Math.max(s, d.left + d.width), i = Math.max(i, d.top + d.height)));
  }
  if (!r || !c) return null;
  const l = Qa({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: l, aspect: l.height * c.height / Math.max(1e-6, l.width * c.width) };
}
function ch(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function lh(e, t) {
  const n = (o) => {
    const a = Le(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function uh({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var F;
  const i = t.find((D) => D.itemId === e) ?? null, c = J(() => i ? lh(t, i) : [], [t, i]), l = i ? c.indexOf(i) : -1, [u, f] = N(rt.indexOf(1)), d = rt[u], m = A(null), [g, h] = N(0);
  Te(() => {
    const D = m.current;
    if (!D) return;
    const I = () => h(D.clientWidth);
    I();
    const T = typeof ResizeObserver == "function" ? new ResizeObserver(I) : null;
    return T == null || T.observe(D), () => T == null ? void 0 : T.disconnect();
  }, []);
  const y = C((D) => {
    const I = c[l + D];
    I && a(I.itemId);
  }, [c, l, a]);
  O(() => {
    const D = (I) => {
      if (I.key === "Escape")
        I.preventDefault(), s();
      else if (I.key === "ArrowLeft")
        I.preventDefault(), y(-1);
      else if (I.key === "ArrowRight")
        I.preventDefault(), y(1);
      else if (I.key === "+" || I.key === "=")
        I.preventDefault(), f((T) => Math.min(rt.length - 1, T + 1));
      else if (I.key === "-" || I.key === "_")
        I.preventDefault(), f((T) => Math.max(0, T - 1));
      else if (I.key === "0")
        I.preventDefault(), f(rt.indexOf(1));
      else
        return;
      I.stopPropagation();
    };
    return window.addEventListener("keydown", D, !0), () => window.removeEventListener("keydown", D, !0);
  }, [s, y]), O(() => {
    const D = m.current;
    if (!D) return;
    const I = (T) => {
      !T.ctrlKey && !T.metaKey || (T.preventDefault(), f((E) => Math.max(0, Math.min(rt.length - 1, E + (T.deltaY < 0 ? 1 : -1)))));
    };
    return D.addEventListener("wheel", I, { passive: !1 }), () => D.removeEventListener("wheel", I);
  }, []);
  const w = A(null);
  if (!i) return null;
  const S = Le(i), b = o.map((D) => ({ pane: D, pdf: r[D] ?? null, where: sh(i, n, D) })).filter((D) => !!(D.pdf && D.where)), v = 16, k = typeof window > "u" ? 800 : window.innerHeight, P = Math.min(880, k * 0.9) - 56 - 32 - (b.length > 1 ? 26 : 0), x = b.length ? ch(Math.max(120, (g - v * (b.length - 1) - 32) / b.length), P, b.map((D) => D.where.aspect)) : 0, $ = ((F = b[0]) == null ? void 0 : F.where.page) ?? i.source.page;
  return /* @__PURE__ */ z("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${Mo[S] ?? "这一块"}`, children: [
    /* @__PURE__ */ p("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ z("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ z("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ z("span", { className: "reader-zoom-title", children: [
          Mo[S] ?? "这一块",
          " · 第 ",
          $,
          " 页"
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-zoom-count", children: l >= 0 ? `${l + 1} / ${c.length}` : "" }),
        /* @__PURE__ */ z("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ p(mt, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: l <= 0, onClick: () => y(-1), children: /* @__PURE__ */ p(Bs, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(mt, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: l < 0 || l >= c.length - 1, onClick: () => y(1), children: /* @__PURE__ */ p(Uo, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(mt, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => f((D) => Math.max(0, D - 1)), children: /* @__PURE__ */ p(js, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ z(Y, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => f(rt.indexOf(1)), children: [
            Math.round(d * 100),
            "%"
          ] }),
          /* @__PURE__ */ p(mt, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === rt.length - 1, onClick: () => f((D) => Math.min(rt.length - 1, D + 1)), children: /* @__PURE__ */ p(Hs, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(mt, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: s, children: /* @__PURE__ */ p(wt, { size: 16, "aria-hidden": !0 }) })
        ] })
      ] }),
      /* @__PURE__ */ p(
        "div",
        {
          ref: m,
          className: "reader-zoom-body",
          onPointerDown: (D) => {
            const I = m.current;
            !I || D.button !== 0 || (w.current = { x: D.clientX, y: D.clientY, left: I.scrollLeft, top: I.scrollTop }, I.setPointerCapture(D.pointerId));
          },
          onPointerMove: (D) => {
            const I = m.current, T = w.current;
            !I || !T || (I.scrollLeft = T.left - (D.clientX - T.x), I.scrollTop = T.top - (D.clientY - T.y));
          },
          onPointerUp: () => {
            w.current = null;
          },
          children: b.length && g ? /* @__PURE__ */ p("div", { className: "reader-zoom-columns", style: { gap: v }, children: b.map(({ pane: D, pdf: I, where: T }) => /* @__PURE__ */ z("figure", { className: "reader-zoom-column", children: [
            b.length > 1 ? /* @__PURE__ */ p("figcaption", { children: D === "source" ? "原文" : "译文" }) : null,
            /* @__PURE__ */ p(
              es,
              {
                className: "reader-zoom-canvas",
                pdf: I,
                page: T.page,
                region: T.fraction,
                cssWidth: x * d,
                label: `${D === "source" ? "原文" : "译文"}第 ${T.page} 页`
              }
            )
          ] }, D)) }) : /* @__PURE__ */ p("p", { className: "reader-zoom-empty", children: g ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
const dh = 380, fh = 320, Et = 8;
function mh(e, t, n) {
  const r = Math.max(Et, Math.min(e.left, n.width - t.width - Et)), o = e.bottom + Et, a = o + t.height <= n.height - Et ? o : Math.max(Et, e.top - Et - t.height);
  return { left: r, top: a };
}
function hh({
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
    const m = r[d], g = m ? ih(o, n, d) : null;
    if (m && g) {
      s = { pdf: m, where: g };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min(dh, fh / Math.max(0.05, s.where.aspect))), c = Math.round(i * s.where.aspect) + 30, l = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: f } = mh(e.anchor, { width: Math.max(i, 160) + 16, height: c + 16 }, l);
  return /* @__PURE__ */ z("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: f }, children: [
    /* @__PURE__ */ z("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ p("span", { children: Wr(e.target) }),
      /* @__PURE__ */ z("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ p(es, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: Wr(e.target) })
  ] });
}
const ph = 4e3;
function gh(e, t, n) {
  if (e.length) {
    const o = ha(e, n), a = o ? ma(e).find((s) => s.id === o) : null;
    if (a) return a.title;
  }
  let r = null;
  for (const o of t)
    !o.headingLevel || o.source.page > n || (!r || o.source.page >= r.source.page) && (r = o);
  return `${(r == null ? void 0 : r.source.text) || (r == null ? void 0 : r.markdown) || ""}`.replace(/\s+/g, " ").trim().slice(0, 80);
}
function No(e) {
  var a, s;
  if (!e || e.isCollapsed || !e.rangeCount) return { text: "", element: null, rect: null };
  const t = e.getRangeAt(0), n = t.startContainer, r = ((s = (a = n.nodeType === 1 ? n : n.parentElement) == null ? void 0 : a.closest) == null ? void 0 : s.call(a, `[${Ie}]`)) ?? null;
  return r ? { text: `${e}`.replace(/\s+\n/g, `
`).trim().slice(0, ph), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function bh(e, t, n, r, o) {
  let a = null, s = 0.15;
  for (const i of e) {
    const c = At(i, t, n);
    if (!c || c.box.page !== r) continue;
    const l = vt(c, 1, 1);
    if (!l) continue;
    const u = o.y < l.top ? l.top - o.y : o.y > l.top + l.height ? o.y - l.top - l.height : 0, f = o.x < l.left ? l.left - o.x : o.x > l.left + l.width ? o.x - l.left - l.width : 0, d = u + f * 0.25;
    (d < s || d === 0 && a === null) && (a = i, s = d);
  }
  return a;
}
function yh({
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
  const l = e.getAttribute(Se) === "source" ? "source" : "translated", u = e.getBoundingClientRect(), f = u.width > 0 && u.height > 0 ? { x: Math.min(1, Math.max(0, (t - u.left) / u.width)), y: Math.min(1, Math.max(0, (n - u.top) / u.height)) } : null, m = (r ? a.find((g) => g.itemId === r) ?? null : null) ?? (f ? bh(a, i, l, c, f) : null);
  return {
    pane: l,
    page: c,
    itemId: (m == null ? void 0 : m.itemId) ?? null,
    selection: o,
    sourceText: `${(m == null ? void 0 : m.source.text) || (m == null ? void 0 : m.markdown) || ""}`.trim(),
    translatedText: `${(m == null ? void 0 : m.translatedBlockText) || (m == null ? void 0 : m.translated.text) || ""}`.trim(),
    section: gh(s, a, (m == null ? void 0 : m.source.page) ?? c),
    point: f
  };
}
const _o = 5e4, vh = 2e4;
function _n(e, t) {
  const n = `${e || ""}`;
  return n.length > t ? n.slice(0, t) : n;
}
function cp(e, t) {
  const n = { page: e.page, pane: e.pane, item_ids: e.itemId ? [e.itemId] : [] };
  return t.documentId && (n.document_id = t.documentId), t.jobId && (n.job_id = t.jobId), t.versionId && (n.translation_version = t.versionId), e.selection && (n.selected_text = e.selection), e.section && (n.section = e.section), e.sourceText && (n.source_text = e.sourceText), e.translatedText && (n.translated_text = e.translatedText), n;
}
function wh(e, t) {
  if (!(e != null && e.page)) return null;
  const r = [!!(e.document_id && t && e.document_id !== t) ? "别的书" : "", `第 ${e.page} 页`, e.section || ""].filter(Boolean).join(" · ");
  return { page: e.page, label: r, data: e };
}
function Sh(e, t = [], n = "") {
  const r = new Set(t.map((o) => o.covers_to_seq));
  return e.map((o) => {
    const a = r.has(o.seq) ? { compactedBefore: !0 } : {};
    return o.role === "user" ? { id: o.message_id, role: "user", text: o.text, context: wh(o.selection, n) } : o.role === "side_summary" ? {
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
function kh(e, t, n) {
  var i, c, l;
  const r = ((l = (c = (i = e.context) == null ? void 0 : i.meta) == null ? void 0 : c.retainpdf) == null ? void 0 : l.selection) ?? null, o = (r == null ? void 0 : r.document_id) || t || null, a = { agent_id: e.agentId || null, document_id: o }, s = e.answer.usage && JSON.stringify(e.answer.usage).length <= 4096 ? e.answer.usage : null;
  return [
    { ...a, role: "user", text: _n(e.question.text, _o), selection: r, client_message_id: `${n}-q` },
    {
      ...a,
      role: "assistant",
      text: _n(e.answer.text, _o),
      thought: e.answer.thought ? _n(e.answer.thought, vh) : null,
      usage: s,
      client_message_id: `${n}-a`,
      memory_ids: e.memoryIds.slice(0, 10)
    }
  ];
}
function Ih(e, t) {
  if (t.id && e.some((r) => r.message_id === t.id)) return t.id;
  const n = t.text.trim();
  for (let r = e.length - 1; r >= 0; r -= 1) {
    const o = e[r];
    if (o.role === "assistant" && o.text.trim() === n) return o.message_id;
  }
  return null;
}
function Th(e) {
  const t = e.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().split(new RegExp("(?<=[。！？.!?])"))[0] || "";
  return `深挖：${[...t].slice(0, 30).join("")}${[...t].length > 30 ? "…" : ""}`;
}
const Rh = 50, Eh = { conversation: null, main: null, records: [], compactions: [], hasMore: !1, key: "local", initial: [] };
function Ph() {
  var t, n;
  return `c-${((n = (t = globalThis.crypto) == null ? void 0 : t.randomUUID) == null ? void 0 : n.call(t)) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}
function Mh(e) {
  var n, r, o, a;
  const t = e;
  return `${(t == null ? void 0 : t.reason) || ((n = t == null ? void 0 : t.details) == null ? void 0 : n.reason) || ((a = (o = (r = t == null ? void 0 : t.payload) == null ? void 0 : r.error) == null ? void 0 : o.details) == null ? void 0 : a.reason) || (e instanceof Error ? e.message : "")}`;
}
function Nh({ port: e, book: t, onAppended: n }) {
  const r = (e == null ? void 0 : e.conversations) ?? null, [o, a] = N(!1), [s, i] = N(Eh), [c, l] = N(!1), [u, f] = N(""), [d, m] = N("idle"), [g, h] = N(null), y = A(s);
  y.current = s;
  const w = A(t);
  w.current = t;
  const S = A(0), b = C(async (R, M, _, L = []) => {
    if (!r) return;
    const j = await r.messages(R.conversation_id, { limit: Rh, ..._ ? { beforeSeq: _ } : {} }), U = [...j.messages, ...L];
    S.current += 1, i({
      conversation: R,
      main: M ?? R,
      records: U,
      compactions: j.compactions || [],
      hasMore: j.has_more,
      key: `${R.conversation_id}:${S.current}`,
      initial: Sh(U, j.compactions || [], w.current.documentId)
    });
  }, [r]), v = C(async () => {
    var R;
    if (a(!0), !(!r || ((R = y.current.conversation) == null ? void 0 : R.kind) === "main")) {
      l(!0), f("");
      try {
        const M = await r.main();
        await b(M, M);
      } catch (M) {
        f(M instanceof Error ? M.message : String(M));
      } finally {
        l(!1);
      }
    }
  }, [r, b]), k = C((R) => {
    h(R), v();
  }, [v]), P = C(async () => {
    const R = y.current, M = R.records[0];
    if (!(!R.conversation || !M || !R.hasMore)) {
      l(!0);
      try {
        await b(R.conversation, R.main, M.seq, R.records);
      } finally {
        l(!1);
      }
    }
  }, [b]), x = C(async (R) => {
    const _ = y.current.conversation;
    if (!r || !_) return;
    const L = kh(R, w.current.documentId, Ph());
    let j;
    try {
      j = await r.append(_.conversation_id, L);
    } catch (U) {
      if (_.kind !== "side" || !/ask_conversation_not_open/.test(Mh(U))) throw U;
      await r.reopen(_.conversation_id), j = await r.append(_.conversation_id, L);
    }
    i((U) => {
      var q;
      return ((q = U.conversation) == null ? void 0 : q.conversation_id) === _.conversation_id ? { ...U, conversation: j.conversation, records: [...U.records, ...j.messages] } : U;
    }), n == null || n(j.messages), j.compaction_due && _.kind === "main" && r.compact(_.conversation_id).catch(() => {
    });
  }, [r, n]), $ = C((R) => {
    x(R).catch((M) => f(`这一轮没存上：${M instanceof Error ? M.message : String(M)}`));
  }, [x]), F = C(async (R) => {
    var L;
    const M = y.current, _ = M.main;
    if (!(!r || !_ || ((L = M.conversation) == null ? void 0 : L.kind) !== "main")) {
      f("");
      try {
        const j = Ih(M.records, R), U = await r.fork({
          parent_id: _.conversation_id,
          ...j ? { forked_from_message_id: j } : {},
          title: Th(R.text),
          ...w.current.documentId ? { document_id: w.current.documentId } : {}
        });
        await b(U, _);
      } catch (j) {
        f(`开不了副对话：${j instanceof Error ? j.message : String(j)}`);
      }
    }
  }, [r, b]), D = C(async (R) => {
    const M = y.current.main;
    if (r)
      try {
        await b(await r.get(R), M);
      } catch (_) {
        f(`打不开副对话：${_ instanceof Error ? _.message : String(_)}`);
      }
  }, [r, b]), I = C(async () => {
    const R = y.current.main;
    R && await b(R, R).catch(() => {
    });
  }, [b]), T = C(async () => {
    const R = y.current.conversation;
    if (!(!r || (R == null ? void 0 : R.kind) !== "side")) {
      m("busy");
      try {
        await r.close(R.conversation_id), m("idle"), await I();
      } catch {
        m("failed");
      }
    }
  }, [r, I]), E = C(async () => {
    const R = y.current.main;
    if (!r || !R) return;
    await r.archive(R.conversation_id);
    const M = await r.main();
    await b(M, M);
  }, [r, b]);
  return {
    visible: o,
    view: s,
    loading: c,
    error: u,
    pending: g,
    setPending: h,
    closingSide: d,
    persistent: !!r,
    openMain: v,
    ask: k,
    close: C(() => a(!1), []),
    loadEarlier: P,
    onTurn: $,
    fork: F,
    openSide: D,
    backToMain: I,
    closeSide: T,
    archiveMain: E,
    forgetMemory: r ? r.forgetMemory : void 0
  };
}
function Ao(e, t, n) {
  var c;
  const r = e.selection, o = e.page ?? (r == null ? void 0 : r.page) ?? 0;
  if (e.role !== "user" || !o) return null;
  const a = (e.pane ?? (r == null ? void 0 : r.pane)) === "source" ? "source" : "translated", s = ((c = r == null ? void 0 : r.item_ids) == null ? void 0 : c[0]) ?? null, i = {
    pane: a,
    page: o,
    itemId: s,
    selection: (r == null ? void 0 : r.selected_text) || "",
    sourceText: (r == null ? void 0 : r.source_text) || "",
    translatedText: (r == null ? void 0 : r.translated_text) || "",
    section: (r == null ? void 0 : r.section) || "",
    point: n(s, a, o)
  };
  return { key: t, anchor: i, messageId: e.message_id, title: e.text.slice(0, 80) };
}
function _h({ port: e, documentId: t, resetKey: n, pointOf: r }) {
  const [o, a] = N([]), s = A(0), i = A(r);
  i.current = r;
  const c = () => (s.current += 1, s.current);
  O(() => {
    var m, g;
    if (a([]), !e || !t) return;
    let f = !1;
    const d = (h) => {
      !f && h.length && a((y) => [...y, ...h]);
    };
    return (m = e.threads) == null || m.list(t).then(
      (h) => d(h.map((y) => ({ key: c(), anchor: y.anchor, threadId: y.threadId, title: y.title }))),
      () => {
      }
    ), (g = e.conversations) == null || g.bookMessages(t).then(
      (h) => d(h.map((y) => Ao(y, c(), i.current)).filter((y) => !!y)),
      () => {
      }
    ), () => {
      f = !0;
    };
  }, [e, t, n]);
  const l = C((f) => {
    const d = f.filter((m) => !m.document_id || m.document_id === t).map((m) => Ao(m, c(), i.current)).filter((m) => !!m);
    d.length && a((m) => [...m.filter((g) => !d.some((h) => h.messageId === g.messageId)), ...d]);
  }, [t]), u = C((f) => a((d) => d.filter((m) => m.key !== f)), []);
  return { marks: o, addRecords: l, removeMark: u };
}
const Ah = zo(() => import("./ReaderAskPanel-Dgaqyev_.js"));
function Lh({
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
  var M;
  const f = J(() => ({ documentId: t, jobId: n, versionId: r }), [t, n, r]), d = C((_, L, j) => {
    const U = _ ? o.find((le) => le.itemId === _) : null, q = U ? At(U, a, L) : null, ee = q && q.box.page === j ? vt(q, 1, 1) : null;
    return ee ? { x: ee.left, y: ee.top } : null;
  }, [o, a]), m = _h({ port: e, documentId: t, resetKey: c, pointOf: d }), g = Nh({ port: e, book: f, onAppended: m.addRecords }), [h, y] = N(null), w = C(
    (_, L, j, U) => yh({
      pageElement: (_ == null ? void 0 : _.closest(`[${Ie}]`)) ?? null,
      clientX: L,
      clientY: j,
      itemId: i(),
      selection: U,
      regions: o,
      bookmarks: s,
      metadata: a
    }),
    [i, o, s, a]
  ), S = C(() => {
    var L;
    const _ = No(((L = globalThis.getSelection) == null ? void 0 : L.call(globalThis)) ?? null);
    return !_.text || !_.element || !_.rect ? null : w(_.element, _.rect.left + _.rect.width / 2, _.rect.top + _.rect.height / 2, _.text);
  }, [w]), b = C((_) => {
    y(null), g.ask(_);
  }, [g.ask]);
  O(() => {
    if (!e) return;
    const _ = (L) => {
      var q;
      if (L.key !== "?" || L.metaKey || L.ctrlKey || L.altKey || L.defaultPrevented) return;
      const j = L.target;
      if ((q = j == null ? void 0 : j.closest) != null && q.call(j, "input, textarea, select, [contenteditable='true']")) return;
      const U = S();
      U && (L.preventDefault(), L.stopImmediatePropagation(), b(U));
    };
    return window.addEventListener("keydown", _, !0), () => window.removeEventListener("keydown", _, !0);
  }, [e, S, b]);
  const v = A(""), k = ((M = g.pending) == null ? void 0 : M.selection) || "";
  O(() => {
    k && (v.current = k);
  }, [k]);
  const P = g.visible && !h, x = g.setPending;
  O(() => {
    if (!P) return;
    let _ = null;
    const L = () => {
      _ && clearTimeout(_), _ = setTimeout(() => {
        const j = S();
        j && j.selection !== v.current && x(j);
      }, 250);
    };
    return document.addEventListener("selectionchange", L), () => {
      _ && clearTimeout(_), document.removeEventListener("selectionchange", L);
    };
  }, [P, S, x]);
  const $ = C(async (_) => {
    if (_.threadId && (e != null && e.threads) && t) {
      try {
        const L = await e.threads.get(t, _.threadId);
        y({ anchor: L.anchor || _.anchor, messages: L.messages || [], mark: _ });
      } catch {
        y({ anchor: _.anchor, messages: [], mark: _ });
      }
      return;
    }
    y(null), g.openMain();
  }, [e, t, g.openMain]), [F, D] = N(null), I = C((_, L, j) => {
    var q;
    if (!e) return;
    const U = No(((q = globalThis.getSelection) == null ? void 0 : q.call(globalThis)) ?? null);
    D(w(_, L, j, U.element ? U.text : ""));
  }, [e, w]), T = e && F ? [{
    key: "ask",
    label: F.selection ? "问这段" : "在这里提问",
    hint: F.selection ? "?" : void 0,
    onSelect: () => b(F)
  }] : [], E = h ? {
    anchor: h.anchor,
    messages: h.messages,
    onClose: () => y(null),
    onDelete: e != null && e.threads && h.mark.threadId ? () => {
      e.threads.remove(t, h.mark.threadId).catch(() => {
      }), m.removeMark(h.mark.key), y(null);
    } : void 0
  } : null, R = e && (g.visible || h) ? /* @__PURE__ */ p(Co, { fallback: null, children: /* @__PURE__ */ p(
    Ah,
    {
      port: e,
      jobId: n,
      book: f,
      ask: g,
      legacy: E,
      onShowSelection: ({ page: _, pane: L }) => l(_, L),
      onJumpToPage: (_) => l(_),
      pageCount: u
    }
  ) }) : null;
  return { marks: m.marks, onMark: $, captureMenu: I, menuActions: T, panel: R, open: g.openMain };
}
const xh = 250;
function Dh(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function Ch(e, t, n) {
  const r = n === "back" ? e.back : e.forward;
  if (!r.length) return null;
  const o = r[r.length - 1], a = r.slice(0, -1), s = n === "back" ? { back: a, forward: [...e.forward, t] } : { back: [...e.back, t], forward: a };
  return { to: o, history: s };
}
function zh(e) {
  var n;
  const t = e;
  return !!((n = t == null ? void 0 : t.closest) != null && n.call(t, "input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
function Oh({
  shellEl: e,
  index: t,
  primaryPane: n,
  follow: r
}) {
  const [o, a] = N(null), [s, i] = N({ back: [], forward: [] }), c = A(s);
  c.current = s;
  const l = A(null), u = A({ index: t, primaryPane: n, follow: r, shellEl: e });
  u.current = { index: t, primaryPane: n, follow: r, shellEl: e };
  const f = C(() => {
    const { shellEl: m, primaryPane: g } = u.current;
    return Wt(m, g);
  }, []);
  O(() => {
    if (!e) return;
    const m = (b) => {
      var v, k;
      return (k = (v = b.target) == null ? void 0 : v.closest) == null ? void 0 : k.call(v, `.${pa}`);
    }, g = () => {
      l.current != null && window.clearTimeout(l.current), l.current = null;
    }, h = (b) => {
      var x;
      const v = m(b);
      if (!v) return;
      const k = u.current.index.get(v.getAttribute(Bn) || "");
      if (!k) return;
      const P = ((x = v.closest("[data-reader-pane]")) == null ? void 0 : x.getAttribute("data-reader-pane")) || u.current.primaryPane;
      g(), l.current = window.setTimeout(() => {
        const $ = v.getBoundingClientRect();
        a({ target: k, pane: P, anchor: { left: $.left, top: $.top, right: $.right, bottom: $.bottom } });
      }, xh);
    }, y = (b) => {
      const v = m(b);
      !v || v.contains(b.relatedTarget) || (g(), a(null));
    }, w = (b) => {
      var $, F;
      const v = m(b);
      if (!v || b.button !== 0 || b.metaKey || b.ctrlKey || b.shiftKey || `${(($ = window.getSelection) == null ? void 0 : $.call(window)) || ""}`.trim()) return;
      const k = u.current.index.get(v.getAttribute(Bn) || "");
      if (!k) return;
      b.preventDefault(), b.stopPropagation(), g(), a(null);
      const P = ((F = v.closest("[data-reader-pane]")) == null ? void 0 : F.getAttribute("data-reader-pane")) || u.current.primaryPane, x = f();
      x && i((D) => Dh(D, x)), u.current.follow(k, P);
    }, S = () => {
      g(), a(null);
    };
    return e.addEventListener("pointerover", h), e.addEventListener("pointerout", y), e.addEventListener("click", w, !0), e.addEventListener("scroll", S, { passive: !0 }), () => {
      g(), e.removeEventListener("pointerover", h), e.removeEventListener("pointerout", y), e.removeEventListener("click", w, !0), e.removeEventListener("scroll", S);
    };
  }, [e, f]);
  const d = C((m) => {
    const g = f();
    if (!g) return !1;
    const h = Ch(c.current, g, m);
    if (!h) return !1;
    const { shellEl: y, primaryPane: w } = u.current;
    return Lt(y, h.to, "auto", w) ? (i(h.history), !0) : !1;
  }, [f]);
  return O(() => {
    const m = (g) => {
      if (!g.altKey || g.metaKey || g.ctrlKey || g.shiftKey || g.defaultPrevented || g.key !== "ArrowLeft" && g.key !== "ArrowRight" || zh(g.target)) return;
      d(g.key === "ArrowLeft" ? "back" : "forward") && g.preventDefault();
    };
    return window.addEventListener("keydown", m), () => window.removeEventListener("keydown", m);
  }, [d]), {
    preview: o,
    closePreview: C(() => a(null), []),
    canGoBack: s.back.length > 0,
    backPage: s.back.length ? s.back[s.back.length - 1].page : null,
    goBack: C(() => d("back"), [d])
  };
}
const $h = zo(() => import("./ReaderMarkdownPanel-C6c1b42M.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), Fh = [];
function Bh(e) {
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
function jh(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function Hh() {
  var Sr;
  const e = fl(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = km(e.viewStateKey), s = a.panel, i = a.setPanel, [c, l] = N(!1), u = A(null), f = A(null), d = s !== null, m = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, g = Bh({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: m,
    liveTranslationVisible: c,
    assistantOpen: d
  }), h = Qc({
    hasOverlayContent: m,
    connection: e.liveTranslation.connection,
    showSource: g.showSource,
    liveTranslationVisible: c,
    assistantOpen: d
  }), y = g.sourceViewOnly, w = g.visibleMode;
  O(() => {
    l(!1);
  }, [e.viewStateKey]), O(() => {
    e.session.jobTerminal && l(!1);
  }, [e.session.jobTerminal]);
  const S = A(null);
  O(() => {
    S.current !== e.viewStateKey && nl({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: y,
      jobTerminal: e.session.jobTerminal
    }) && (S.current = e.viewStateKey, l(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, y]), O(() => {
    if (!(t.loading || t.failed)) {
      if (u.current !== e.viewStateKey) {
        u.current = e.viewStateKey;
        const W = Ue(e.viewStateKey), Q = Em({
          savedMode: W == null ? void 0 : W.mode,
          sourceViewOnly: y,
          viewportWidth: it()
        });
        f.current = Q.auto ? Q.mode : null, Q.mode && Q.mode !== e.mode && e.setModeKeepingPage(Q.mode);
        return;
      }
      Pm(e.mode, f.current) && (f.current = null, bn(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, y]);
  const b = s || (e.mode === "compare" ? "compare" : "reading"), v = Nm(s, "markdown"), { docDark: k, toggleDocDark: P } = oh();
  vl({
    toggleDocDark: P,
    mode: w,
    sourceOnly: e.sourceOnly,
    setMode: e.setModeKeepingPage,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    currentPage: e.currentPage,
    numPages: n.hudNumPages,
    goToPage: e.goToPage,
    enabled: e.showHud
  });
  const x = C(() => {
    i(null);
  }, []), $ = el(e.liveTranslation), F = C(() => {
    $ && e.goToPage($, "source");
  }, [e.goToPage, $]), [D, I] = N(null);
  O(() => {
    w === "compare" && e.session.jobTerminal && I(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, w]);
  const T = D !== e.viewStateKey && rl({
    state: e.liveTranslation,
    sourceViewOnly: y,
    visibleMode: w
  }), E = C((W) => {
    const Q = jh(W, e.liveTranslationAvailable);
    Q !== null && l(Q), e.setModeKeepingPage(W);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), R = J(() => h.sourcePaneToggle ? /* @__PURE__ */ p(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${c ? " is-active" : ""}`,
      onClick: () => l((W) => !W),
      "aria-pressed": c,
      title: c ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [h.sourcePaneToggle, c]), M = C((W) => {
    i(W);
  }, []), [_] = N(_m), [L, j] = N(null), U = C((W) => j((Q) => Q === W ? null : W), []), [q, ee] = N(""), [le, ue] = N("");
  O(() => {
    const W = q.replace(/\s+/gu, " ").trim(), Q = window.setTimeout(() => ue(W), W ? 150 : 0);
    return () => window.clearTimeout(Q);
  }, [q]);
  const [ce, xe] = N(0), ne = C(() => {
    j("search"), xe((W) => W + 1);
  }, []);
  Gm(ne);
  const re = C((W) => {
    e.jumpToAnchor({ block_id: W }), (L === "outline" || it() < 900) && j(null);
  }, [e.jumpToAnchor, L]), fe = C((W) => e.jumpToAnchor({ block_id: W }), [e.jumpToAnchor]), [be, ve] = N({}), he = A({ source: r.sourceUrl, translated: r.translatedUrl });
  he.current = { source: r.sourceUrl, translated: r.translatedUrl };
  const We = C((W, Q) => {
    ve((Ve) => ({ ...Ve, [Q]: { url: he.current[Q], nodes: W } }));
  }, []), tt = J(() => {
    const W = be.source;
    if (W && W.url === r.sourceUrl && W.nodes.length) return W.nodes;
    const Q = be.translated;
    return Q && Q.url === r.translatedUrl && Q.nodes.length ? Q.nodes : Fh;
  }, [be, r.sourceUrl, r.translatedUrl]), De = A({}), [oe, de] = N(0), pe = C((W, Q) => {
    De.current[Q] = { url: he.current[Q], pdf: W }, de((Ve) => Ve + 1);
  }, []), [H, Z] = N(null), te = C((W) => Z(W), []), Ce = C(() => Z(null), []);
  O(() => Z(null), [e.viewStateKey]);
  const Re = J(() => {
    const W = (Q, Ve) => {
      const dt = De.current[Q];
      return dt && dt.url === Ve ? dt.pdf : null;
    };
    return { source: W("source", r.sourceUrl), translated: W("translated", r.translatedUrl) };
  }, [oe, r.sourceUrl, r.translatedUrl]), Ee = J(() => Yl(o.regions), [o.regions]), ze = C(
    (W, Q) => e.jumpToAnchor({ block_id: W.itemId }, Q),
    [e.jumpToAnchor]
  ), Pe = Oh({ shellEl: e.shell.shellEl, index: Ee, primaryPane: e.panes.primaryPane, follow: ze }), Oe = C((W) => {
    e.goToPage(W), (L === "outline" || it() < 900) && j(null);
  }, [e.goToPage, L]), ye = Qm({
    jobId: o.jobId,
    jobStatus: o.jobStatus,
    jobPayload: o.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!r.translatedUrl,
    refreshJobStatus: o.refreshJobStatus
  }), Me = ye.select, Fe = e.setModeKeepingPage, Ke = o.regions, Be = C((W) => {
    pu(Ke, W) && (w === "source" && Fe("compare"), Me(W));
  }, [Ke, Me, w, Fe]);
  eh(ye.available ? Be : null, _);
  const Ne = ad(e.viewStateKey);
  Hm(Ne);
  const [nt, ut] = N(null), B = C(() => ut(null), []), K = Vm({ documentId: o.documentId, jobId: o.jobId }), G = J(() => {
    try {
      return Qe().ask ?? null;
    } catch {
      return null;
    }
  }, []), X = Lh({
    port: G,
    documentId: o.documentId || "",
    jobId: o.jobId,
    versionId: K.readingVersionId || null,
    regions: o.regions,
    metadata: o.readerMetadata,
    bookmarks: tt,
    hoveredItemId: () => _.get().itemId,
    resetKey: e.viewStateKey,
    goToPage: e.goToPage,
    pageCount: n.hudNumPages || 0
  }), se = X.marks, V = X.onMark, ae = ((Sr = K.compared) == null ? void 0 : Sr.url) || "";
  O(() => {
    ae && w !== "compare" && E("compare");
  }, [ae]), O(() => {
    w !== "compare" && K.clear();
  }, [w]);
  const ge = J(
    () => {
      const { compared: W, versions: Q, readingVersionId: Ve } = K;
      if (!W) return null;
      const dt = Q.find((yn) => yn.versionId === W.versionId), It = Q.find((yn) => yn.versionId === Ve);
      return {
        url: W.url,
        regions: W.regions,
        left: { name: W.name, createdAt: (dt == null ? void 0 : dt.createdAt) || "" },
        right: { name: (It == null ? void 0 : It.name) || "当前译文", createdAt: (It == null ? void 0 : It.createdAt) || "" }
      };
    },
    [K.compared, K.versions, K.readingVersionId]
  ), wr = J(() => {
    if (!ye.savedCounts.size) return e.revisedBlocks;
    const W = new Map(e.revisedBlocks);
    for (const [Q, Ve] of ye.savedCounts) W.set(Q, (W.get(Q) || 0) + Ve);
    return W;
  }, [e.revisedBlocks, ye.savedCounts]), ts = J(() => ({
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
    regionHover: _,
    jumpToBlock: fe,
    revisedBlocks: wr,
    onPdfOutline: We,
    onPdfDocument: pe,
    zoomBlock: te,
    xrefIndex: Ee,
    askMarks: se,
    onAskMark: V,
    editBlock: ye.available ? Be : void 0,
    blockEdit: ye,
    editShowsSource: w !== "compare",
    findTerm: L === "search" ? le : "",
    compareVersion: ge,
    ink: Ne,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: y,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: M, close: x },
    docDark: k,
    toggleDocDark: P
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
    _,
    fe,
    wr,
    We,
    pe,
    te,
    Ee,
    se,
    V,
    ye,
    Be,
    w,
    L,
    le,
    ge,
    Ne,
    e.sourceOnly,
    y,
    e.download,
    e.goToPage,
    M,
    x,
    k,
    P
  ]), ns = J(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), rs = [
    Wi,
    `is-workspace-${b}`,
    d ? "is-assistant-open" : "",
    L ? "is-finder-open" : "",
    g.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(fd, { value: ts, hud: ns, children: /* @__PURE__ */ z(
    "div",
    {
      className: rs,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": b,
      "data-ink-mode": Ne.tool || void 0,
      onContextMenu: (W) => {
        const Q = jm(W);
        Q && (W.preventDefault(), X.captureMenu(W.target, W.clientX, W.clientY), ut(Q));
      },
      children: [
        /* @__PURE__ */ p(Kf, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata, onRetry: o.refreshJobArtifacts }),
        /* @__PURE__ */ p(Dm, { open: L, onToggle: U }),
        L ? /* @__PURE__ */ p(
          zm,
          {
            tab: L,
            onTab: j,
            onClose: () => j(null),
            onJump: re,
            bookmarks: tt,
            onJumpPage: Oe,
            query: q,
            onQuery: ee,
            term: le,
            focusSignal: ce
          }
        ) : null,
        /* @__PURE__ */ z("div", { className: "reader-chrome-tray", children: [
          /* @__PURE__ */ p(em, {}),
          /* @__PURE__ */ p(El, { onBeforeClose: o.prepareClose })
        ] }),
        /* @__PURE__ */ p(
          Xd,
          {
            mode: w,
            documentReady: !!o.jobId,
            sourceViewOnly: y,
            onModeChange: E,
            liveTranslation: h.topBarPill ? {
              visible: c,
              state: e.liveTranslation,
              onToggle: () => l((W) => !W),
              latestPage: c ? $ : null,
              currentPage: e.currentPage,
              onJumpToLatest: F
            } : null,
            completion: T ? {
              onOpenCompare: () => {
                I(e.viewStateKey), E("compare");
              }
            } : null
          }
        ),
        /* @__PURE__ */ p(nf, { active: s }),
        d ? /* @__PURE__ */ p(Uf, {}) : null,
        /* @__PURE__ */ p(Vd, { paneComposition: g, markdownSplit: v.open, assistantSplit: d, liveTranslation: e.liveTranslation, sourcePaneAction: R }),
        e.showHud ? /* @__PURE__ */ p(
          wm,
          {
            mode: w,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            issuesJobId: e.sourceOnly ? "" : o.jobId,
            searchSlot: /* @__PURE__ */ p(Cm, { open: L, onToggle: U })
          }
        ) : null,
        /* @__PURE__ */ p(Co, { fallback: null, children: v.mounted ? /* @__PURE__ */ p($h, { open: v.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: x }) : null }),
        Pe.preview ? /* @__PURE__ */ p(hh, { preview: Pe.preview, regions: o.regions, metadata: o.readerMetadata, documents: Re }) : null,
        Pe.canGoBack ? /* @__PURE__ */ z(Y, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => Pe.goBack(), children: [
          /* @__PURE__ */ p(Us, { size: 14, "aria-hidden": !0 }),
          " 回到第 ",
          Pe.backPage,
          " 页"
        ] }) : null,
        H ? /* @__PURE__ */ p(
          uh,
          {
            itemId: H,
            regions: o.regions,
            metadata: o.readerMetadata,
            documents: Re,
            panes: w === "compare" ? ["source", "translated"] : w === "translated" ? ["translated"] : ["source"],
            onNavigate: Z,
            onClose: Ce
          }
        ) : null,
        /* @__PURE__ */ p(Om, { active: s, compare: K, ink: Ne }),
        /* @__PURE__ */ p(
          Fm,
          {
            ink: Ne,
            menu: nt,
            onClose: B,
            actions: X.menuActions
          }
        ),
        X.panel,
        /* @__PURE__ */ p(Bm, { ink: Ne }),
        /* @__PURE__ */ p(th, { edit: ye }),
        /* @__PURE__ */ p(Rm, {})
      ]
    }
  ) });
}
function lp() {
  return /* @__PURE__ */ p(Hh, {});
}
export {
  lp as R,
  Hh as a,
  cp as b,
  ip as c,
  sp as d,
  op as f,
  ap as r,
  et as u
};
//# sourceMappingURL=ReaderApp-DMyvMgeZ.js.map
