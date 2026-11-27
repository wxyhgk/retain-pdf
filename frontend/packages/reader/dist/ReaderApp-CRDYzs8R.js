var Ir = (e) => {
  throw TypeError(e);
};
var Tr = (e, t, n) => t.has(e) || Ir("Cannot " + n);
var Ct = (e, t, n) => (Tr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Rr = (e, t, n) => t.has(e) ? Ir("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Er = (e, t, n, r) => (Tr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as C, jsx as p, Fragment as yt } from "react/jsx-runtime";
import { useMemo as Y, useState as P, useEffect as z, useCallback as x, useRef as _, useLayoutEffect as Ee, memo as pn, createContext as Xn, useContext as Zn, forwardRef as Do, useImperativeHandle as Yn, useSyncExternalStore as Co, useId as zo, Suspense as Oo, lazy as $o } from "react";
import { requireAdapter as Dt, getReaderAdapters as xe } from "./adapters.js";
import { resolveReaderDownloadName as ss, resolveReaderDownloadUrls as is, READER_PROGRESS_COPY as qe, trimString as sn, READER_DOWNLOAD_ACTIONS as cs, disabledReason as ls } from "./runtime/state.js";
import { r as us, b as ds } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as Ln, isFinishedJobStatus as Vt } from "@retainpdf/domain/job";
import { n as Fo, d as fs, f as vn, k as Pr, b as ms, c as hs, j as De, p as vt, g as ps, l as At, i as gs } from "./reader-regions-BmqHsJ-I.js";
import { fetchDocumentReading as bs } from "@retainpdf/api/documents";
import { isReaderTransportError as ys, createReaderTransportError as vs } from "./contracts.js";
import { X as wt, PenLine as Qn, ZoomIn as ws, Check as Bo, Copy as Ss, ChevronUp as ks, ChevronDown as jo, History as Is, LoaderCircle as Ts, Pin as Rs, LogOut as Es, FileText as Ho, Columns2 as Uo, Languages as Wo, Radio as Ps, ArrowDownToLine as Ms, CheckCircle2 as _s, Keyboard as Ns, Download as As, ListOrdered as Ls, TriangleAlert as xs, ChevronRight as Ko, ListTree as Ds, Search as Cs, GitCompareArrows as zs, LayoutGrid as Os, Highlighter as $s, Eraser as Fs, Undo2 as Bs, Trash2 as js, ChevronLeft as Hs, Minus as Us, Plus as Ws, ArrowLeft as Ks } from "lucide-react";
import { Button as oe, Textarea as Vs, IconButton as mt, Input as Vo } from "@retainpdf/ui";
import { toast as xn, Toaster as qs } from "sonner";
import { pdfjs as qo, Page as Js, Document as Gs } from "react-pdf";
import { e as Xs, m as Zs, a as Ys } from "./markdown-math-XkF5urpn.js";
const Qs = (...e) => {
  var t, n;
  return ((n = (t = xe()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, ei = "", ti = Object.freeze({
  progress: "retainpdf-reader-progress"
}), ni = (e) => {
  var t, n;
  return ((n = (t = xe()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, lp = (...e) => {
  var n;
  return (((n = xe()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, up = () => {
  var e, t;
  return ((t = (e = xe()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
}, Je = () => Dt("defaultReaderDataPort"), Mr = () => Dt("defaultReaderPageConfigPort"), dp = {
  get apiPrefix() {
    return Je().apiPrefix;
  },
  fetchProtected: (...e) => Je().fetchProtected(...e),
  loadMarkdownPayload: (e) => Je().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => Je().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => Je().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => Je().loadJobPayload(e),
  loadReaderPayload: (e, t) => Je().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => Je().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return Je().liveTranslation;
  }
}, Jo = {
  messageTargetOrigin: () => Mr().messageTargetOrigin(),
  readerJobId: () => Mr().readerJobId()
}, ri = () => {
  var e;
  return ((e = xe()) == null ? void 0 : e.liveTranslation) ?? null;
}, qt = () => {
  var t;
  const e = xe();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, Qe = () => {
  const e = xe();
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
}, oi = (...e) => {
  var t, n;
  return ((n = (t = xe()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, ai = () => {
  var e, t;
  return ((t = (e = xe()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, si = (...e) => {
  var t, n;
  return ((n = (t = xe()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, ii = (...e) => {
  var t, n;
  return ((n = (t = xe()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? ss(...e);
}, ci = (...e) => {
  var t, n;
  return ((n = (t = xe()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? is(...e);
}, li = (...e) => Dt("downloadProtectedResource")(...e), ui = (...e) => Dt("failDownloadToast")(...e), fp = (e, t) => Dt("resolveMarkdownAssetUrl")(e, t), _r = "/api/v1";
function di() {
  const e = () => {
    var r;
    return us(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = P(e);
  return z(() => {
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
function fi() {
  const e = di(), t = Y(() => si(Jo), [e]), n = Y(() => ai(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
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
  } = e, [c, l] = P({
    documentId: "",
    jobId: ""
  }), [u, f] = P({
    documentId: "",
    jobId: ""
  }), d = c.documentId === t ? c.jobId : "", m = u.documentId === t ? u.jobId : "", g = n || d, [h, y] = P({
    jobId: "",
    documentId: ""
  }), w = h.jobId === g ? h.documentId : "", S = t || w, b = !!t && !g, [v, k] = P(null), R = (v == null ? void 0 : v.sessionIdentity) === r && v.documentId === S ? v : null, N = b || !!R, $ = x((A) => {
    const I = `${A.documentId || ""}`.trim();
    if (!I || a.current && a.current !== I) return;
    if (!a.current && s.current)
      y({
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
  z(() => {
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
        f({ documentId: A.documentId, jobId: A.jobId });
        break;
      case "resolved-job-document":
        y((I) => I.jobId === A.jobId && I.documentId === A.documentId ? I : { jobId: A.jobId, documentId: A.documentId });
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
    activeCommittedDocumentSource: R,
    sourceViewOnly: N,
    refreshCommittedDocument: $,
    applyIdentityEvent: O
  };
}
function Nr(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function hi(e) {
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
  return ni(Ln(e, t));
}
function pi(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function gi(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !pi(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function Dn({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: ti.progress,
        stage: n,
        percent: e,
        text: t
      },
      Jo.messageTargetOrigin()
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
  }), Dn({ percent: t, text: n, stage: r });
}
function bi(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = P(null), [l, u] = P(null), [f, d] = P(""), [m, g] = P(0), h = f === n ? i : null, y = f === n ? l : null, w = Nr(h), S = Vt(w), b = x(() => {
    g((O) => O + 1);
  }, []), v = x((O) => {
    c(O.jobPayload), u(O.manifestPayload), d(O.sessionIdentity);
  }, []), k = x((O) => {
    c(null), u(null), d(O);
  }, []), R = _(""), N = _(""), $ = x(async () => {
    const O = o.current;
    if (!O || R.current === O) return;
    const A = Qe().loadJobPayload;
    if (typeof A != "function") return;
    const I = a.current.value;
    R.current = O;
    try {
      const T = await A(O);
      if (s.current || a.current.value !== I || o.current !== O || !T || typeof T != "object")
        return;
      const E = Nr(T);
      c(T), d(r.current), !Vt(E) && N.current === O && (N.current = ""), E === "succeeded" && N.current !== O && (N.current = O, g((L) => L + 1));
    } catch {
    } finally {
      R.current === O && (R.current = "");
    }
  }, []);
  return z(() => {
    N.current = "";
  }, [n]), z(() => {
    if (!t || S || !h) return;
    const O = window.setInterval(() => {
      document.visibilityState !== "hidden" && $();
    }, 1e3);
    return () => window.clearInterval(O);
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
function Cn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function yi(e, t) {
  e(t), Cn(t);
}
function vi(e) {
  const [t, n] = P(e ? "source" : "compare"), r = x((a) => {
    e && a !== "source" || (n(a), Cn(a));
  }, [e]), o = x((a) => {
    yi(n, a);
  }, []);
  return z(() => (e && document.documentElement.classList.add("reader-source-only"), Cn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Lr(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function wi(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Lr(n.active_job_id),
    activeVersionId: Lr(n.active_version_id)
  };
}
function Si(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function ki(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Ii(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Ti = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Ri(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Ti.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const Ei = 48 * 1024 * 1024;
function Pi(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Mi = 2, Le = /* @__PURE__ */ new Map();
function zn(e, t) {
  Le.delete(e), Le.set(e, t);
}
function xr(e) {
  if (Le.size < Mi) return;
  const t = Le.keys().next().value;
  t && Le.delete(t);
}
async function _i(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function Go(e, t = qt().fetchProtected, n = {}) {
  var u, f, d, m, g, h, y, w, S;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (Le.has(r)) {
    const b = Le.get(r);
    return zn(r, b), b;
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
    const v = await _i(s);
    throw v && (b.reason = v), b;
  }
  const i = Ni(r, s, t);
  if (i) {
    o.abort();
    const b = { ranged: i };
    return xr(), Le.set(r, b), b;
  }
  (y = (h = n.signal) == null ? void 0 : h.addEventListener) == null || y.call(h, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (S = (w = n.signal) == null ? void 0 : w.removeEventListener) == null || S.call(w, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return Le.has(r) ? zn(r, l) : (xr(), Le.set(r, l)), l;
}
function Ni(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < Ei ? null : {
    url: e,
    length: o,
    async fetchRange(i, c) {
      const l = await n(e, { headers: { Range: `bytes=${i}-${c - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const Ai = { file: null, loading: !1, error: "" }, Li = { file: null, loading: !0, error: "" };
function xi(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = P(null);
  if (z(() => {
    if (t || !n) return;
    const s = Le.get(n);
    if (s) {
      zn(n, s);
      return;
    }
    const i = new AbortController();
    return Go(n, void 0, { signal: i.signal }).then((c) => {
      i.signal.aborted || o({ url: n, file: c, loading: !1, error: "" });
    }).catch((c) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (c == null ? void 0 : c.message) || String(c) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Ai;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = Le.get(n);
  return a ? { file: a, loading: !1, error: "" } : Li;
}
function Di(e) {
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
  cn(s, r, n, "download");
  const i = await Go(t, qt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (cn(s, o, n, "download"), i);
}
async function Ci(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  cn(o, 25, "正在下载 PDF…", "download");
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
async function Oi({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = bs,
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
const Qt = {
  regions: null,
  metadata: null
};
function $i(e) {
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
  } = e, [S, b] = P(""), [v, k] = P(""), [R, N] = P(null), [$, O] = P(null), [A, I] = P(!1), [T, E] = P(""), [L, D] = P([]), [U, M] = P(!1), [H, K] = P(() => ({
    source: null,
    translated: null
  })), [Q, te] = P(
    Qt
  ), [F, V] = P({
    loading: !0,
    percent: 4,
    text: qe.boot,
    stage: "progress",
    failed: !1
  });
  return z(() => {
    const q = new AbortController(), he = h.current.value, G = Di({
      sessionEpochRef: h,
      closingRef: y,
      abort: q,
      sessionEpoch: he
    });
    w.current = q;
    const J = Qe();
    if (y.current)
      return q.abort(), () => {
        w.current === q && (w.current = null);
      };
    let ce = !1;
    function ge(le, pe) {
      G.markFailed(), M(!0), V({
        loading: !1,
        percent: 100,
        text: le,
        stage: "failed",
        failed: !0
      }), Dn({ percent: 100, text: pe, stage: "failed" });
    }
    function ie() {
      I(!0), ce || M(!0), V({
        loading: !1,
        percent: 100,
        text: qe.ready,
        stage: "ready",
        failed: !1
      }), Dn({ percent: 100, text: qe.ready, stage: "ready" });
    }
    function me() {
      return l != null && l.documentId ? Ar(
        l.documentId,
        l.revision
      ) : Qs() ? ei : J.resolveResourceUrl(Ln(r));
    }
    async function Ie() {
      var re;
      let le = { activeJobId: "", activeVersionId: "" };
      try {
        const se = await ((re = J.fetchDocument) == null ? void 0 : re.call(J, r));
        se && (le = wi(se));
      } catch {
      }
      const pe = Si({
        link: le,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (pe.kind === "follow-active-job") {
        if (G.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: pe.jobId
        }), pe.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: pe.activeVersionId,
          sessionIdentity: c
        }), m("source")) : m("compare");
        return;
      }
      if (pe.kind === "open-committed-source") {
        if (G.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: pe.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const ye = me();
      if (G.isInactive()) return;
      b(ye), k(""), E(""), d(c);
      const j = await On({
        url: ye,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: G,
        setBoot: V
      });
      if (!G.isInactive()) {
        if (!j) {
          ge("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        N(j), ie();
      }
    }
    async function tt() {
      var ut;
      const le = !l, pe = !!(le && J.loadSessionSnapshot && J.loadReaderOptionalArtifacts), ye = pe ? J.loadReaderOptionalArtifacts(t) : null, j = await ((ut = J.loadSessionSnapshot) == null ? void 0 : ut.call(J, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: le && !pe
      })), re = j ? {
        jobPayload: j.sourcePayload,
        manifestPayload: j.manifestPayload,
        readerMetadata: j.readerMetadata,
        regionsPayload: j.regions,
        readerErrors: j.readerErrors
      } : await J.loadReaderPayload(t, {
        includeOptionalArtifacts: le
      });
      if (G.isInactive()) return;
      let se = null;
      if (n && !r)
        if (j && j.linkedDocument !== void 0)
          se = j.linkedDocument;
        else {
          try {
            se = await J.fetchDocumentByJobId(_r, t);
          } catch {
          }
          if (G.isInactive()) return;
        }
      const ze = hi(re.jobPayload) || `${(se == null ? void 0 : se.document_id) || ""}`.trim();
      ze && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: ze
      });
      const Pe = ki({
        payloadDocumentId: ze,
        linkedActiveJobId: `${(se == null ? void 0 : se.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(se == null ? void 0 : se.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (Pe.kind === "restore-committed-source") {
        if (G.isInactive()) return;
        u({
          type: "committed-source",
          documentId: Pe.documentId,
          revision: Pe.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const Me = J.resolveReaderSourcePdf(re.manifestPayload), Oe = J.resolveReaderTranslatedPdfUrl(re.jobPayload, re.manifestPayload), _e = typeof Me == "string" ? Me : J.resolveReaderArtifactUrl(Me), $e = r || ze, we = l != null && l.documentId ? Ar(
        l.documentId,
        l.revision
      ) : _e || ($e ? J.resolveResourceUrl(Ln($e)) : ""), Ne = l ? "" : Oe || "";
      b(we || ""), k(Ne), E(gi(re.jobPayload, t)), f({
        jobPayload: re.jobPayload || null,
        manifestPayload: re.manifestPayload || null,
        sessionIdentity: c
      });
      const Be = () => Ci({
        sourceFinal: we || "",
        translatedFinal: Ne,
        fence: G,
        setBoot: V
      }), Ke = !!(we || Ne), je = ye && Ke ? Be() : null;
      je == null || je.catch(() => {
      });
      const Ae = (B) => {
        G.isInactive() || (D(l ? [] : Fo(B.regionsPayload)), K(l ? { source: null, translated: null } : fs(B.readerMetadata)), te(l ? Qt : B.readerErrors ?? Qt), M(!0));
      };
      if (ye ? (ce = !0, ye.then(Ae)) : Ae(re), !Ke) {
        ge(qe.failed, qe.failed);
        return;
      }
      const nt = await (je ?? Be());
      if (nt.status !== "inactive") {
        if (nt.status === "incomplete") {
          ge("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        N(nt.sourceBytes), O(nt.translatedBytes), ie();
      }
    }
    async function Ce() {
      I(!1), N(null), O(null), D([]), M(!1), K({ source: null, translated: null }), te(Qt), cn(V, 8, qe.metadata, "metadata");
      try {
        if (s) {
          await Ie();
          return;
        }
        if (!t) {
          ge(qe.failed, qe.failed);
          return;
        }
        await tt();
      } catch (le) {
        if (G.isClosedOrStale() || (le == null ? void 0 : le.name) === "AbortError") return;
        G.markFailed();
        const pe = Number(le == null ? void 0 : le.status), ye = `${(le == null ? void 0 : le.reason) || ""}`, j = Ri({ status: pe, reason: ye, sessionJobId: t });
        if (j && (await Oi({
          apiPrefix: _r,
          documentId: j,
          expiredJobId: t
        }) || G.isClosedOrStale()))
          return;
        if (Ii({
          status: pe,
          reason: ye,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const re = le instanceof Error ? le.message : qe.failed;
        ge(re, re);
      }
    }
    return Ce(), () => {
      q.abort(), w.current === q && (w.current = null);
    };
  }, [t, r, o, a, s, i, l, g, n, c, u, f, d, m]), {
    sourceUrl: S,
    translatedUrl: v,
    sourceFile: R,
    translatedFile: $,
    assetsReady: A,
    title: T,
    regions: L,
    regionsSettled: U,
    readerMetadata: H,
    readerErrors: Q,
    boot: F
  };
}
function Fi() {
  const e = _(!1), t = _(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = fi(), s = _({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = _(a), c = _(""), l = _(""), u = _(() => {
  }), f = x(() => u.current(), []), d = mi({
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
  } = d, { mode: w, setMode: S, switchSessionMode: b } = vi(y);
  u.current = () => {
    b("source");
  }, i.current = a, c.current = g, l.current = m;
  const v = bi({
    sessionJobId: m,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: k,
    scopedManifestPayload: R,
    jobStatus: N,
    jobTerminal: $,
    jobRefreshRevision: O,
    refreshJobArtifacts: A,
    refreshJobStatus: I
  } = v, T = $i({
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
    jobRefreshRevision: O,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), E = x(() => {
    var D;
    e.current = !0, (D = t.current) == null || D.abort();
  }, []), L = Y(
    () => ({
      fetchProtected: Qe().fetchProtected,
      jobId: m,
      jobPayload: k,
      manifestPayload: R,
      sourceUrl: T.sourceUrl,
      translatedUrl: T.translatedUrl,
      sourceOnly: y
    }),
    [m, k, R, T.sourceUrl, T.translatedUrl, y]
  );
  return {
    jobId: m,
    jobStatus: N,
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
    download: L,
    refreshJobArtifacts: A,
    refreshJobStatus: I,
    refreshCommittedDocument: d.refreshCommittedDocument,
    prepareClose: E
  };
}
const Bi = 160, ji = 8, Hi = 0;
function Ui() {
  const e = _(null), [t, n] = P(null), [r, o] = P(Hi), a = x((s) => {
    e.current = s, n(s);
  }, []);
  return z(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (l) => {
      !Number.isFinite(l) || l < Bi || o((u) => Math.abs(u - l) < ji ? u : l);
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
function Wi(e) {
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
function Ki(e, t) {
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
  const [f, d] = P(() => ({
    identity: l,
    pages: wn
  })), [m, g] = P(() => ({ identity: l, tick: 0 })), h = f.identity === l ? f.pages : wn, y = m.identity === l ? m.tick : 0, w = Wi({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: S } = w, b = x((I, T) => {
    u.current === l && d((E) => {
      const L = E.identity === l ? E.pages : wn;
      return L[T] === I && E.identity === l ? E : {
        identity: l,
        pages: { ...L, [T]: I }
      };
    });
  }, [l]), v = _(null), k = x(() => {
    v.current && clearTimeout(v.current);
    const I = l;
    v.current = setTimeout(() => {
      v.current = null, u.current === I && g((T) => ({
        identity: I,
        tick: T.identity === I ? T.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  z(() => (v.current && (clearTimeout(v.current), v.current = null), d((I) => I.identity === l && I.pages.source === 0 && I.pages.translated === 0 ? I : { identity: l, pages: { source: 0, translated: 0 } }), g((I) => I.identity === l && I.tick === 0 ? I : { identity: l, tick: 0 }), () => {
    v.current && (clearTimeout(v.current), v.current = null);
  }), [l]);
  const R = Y(
    () => Math.max(h.source, h.translated),
    [h]
  ), N = S === "translated" ? h.translated : h.source || h.translated, $ = t == null ? void 0 : t.userZoom, O = t == null ? void 0 : t.shellWidth, A = `${l}-${y}-${$}-${n}-${h.source}-${h.translated}-${O}`;
  return {
    ...w,
    numPagesByPane: h,
    hudNumPages: R,
    primaryNumPages: N,
    metricsTick: y,
    onNumPages: b,
    onMetrics: k,
    rowSyncRevision: A
  };
}
const Re = "data-reader-page", ke = "data-reader-pane", er = "data-natural-height", Vi = "reader-react-root", Xo = "reader-react-grid", Zo = "reader-react-scroll-shell", gn = "reader-react-pdf-pane", Yo = "reader-react-pdf-page", ln = "reader-react-pdf-page-placeholder", tr = "reader-react-pdf-page-slot";
function un(e, t) {
  const n = e != null ? `[${Re}="${e}"]` : `[${Re}]`;
  return t ? `${n}[${ke}="${t}"]` : n;
}
function nr() {
  return `.${tr}[${Re}]`;
}
function dn(e) {
  return Number(e.getAttribute(Re));
}
const Qo = 0.25, fn = 1, qi = 0.05, Yt = 0.5, Ji = 16, Gi = 8, ea = Ji + Gi, Xi = 720;
function it() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function ta(e) {
  return Number.isFinite(e) && e < Xi;
}
function Pt(e, t = Number.POSITIVE_INFINITY) {
  return ta(t) && (e === "source" || e === "translated") ? fn : Yt;
}
function Ze(e) {
  return Number.isFinite(e) ? Math.min(fn, Math.max(Qo, e)) : Yt;
}
function Jt(e, t) {
  const n = Ze(Number(e) + t * qi);
  return Math.round(n * 100) / 100;
}
function Zi(e) {
  return Math.round(Ze(e) * 100);
}
function na(e) {
  const n = (Number(e) || 0) - ea;
  return Math.max(160, Math.floor(n));
}
function Yi(e, t = Yt) {
  const n = Ze(t);
  return na((Number(e) || 0) * n);
}
function Qi(e, t) {
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
const ec = 8;
function tc(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < ec ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const ra = 200, oa = [
  "markdown"
], nc = oa;
function aa(e) {
  return nc.includes(e);
}
const rc = "retainpdf:reader:view:v1:", Dr = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), oc = /* @__PURE__ */ new Set([
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
function ac({
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
  return t ? `${rc}${t}` : "";
}
function sc(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function ic(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!Dr.has(t) || !Dr.has(n) || t === n))
    return { left: t, right: n };
}
function cc(e) {
  return e === null ? null : aa(e) ? e : void 0;
}
function lc(e) {
  return oc.has(e) ? e : void 0;
}
function ca(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = sc(t.anchor), r = Number(t.zoom), o = lc(t.mode), a = ic(t.splitLayout), s = cc(t.assistantPanel);
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
function We(e, t = sa()) {
  const n = ia(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? ca(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function bn(e, t, n = sa()) {
  const r = ia(e);
  if (!r || !n) return null;
  const o = We(e, n), a = ca({
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
function uc(e, t, n = "") {
  var d;
  const [r, o] = P(() => {
    var m;
    return ((m = We(n)) == null ? void 0 : m.zoom) ?? Pt(e, it());
  }), a = _(r), s = _(n);
  a.current = r;
  const i = _(1), c = _(((d = We(n)) == null ? void 0 : d.zoom) !== void 0);
  z(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const m = (h = We(n)) == null ? void 0 : h.zoom;
    c.current = m !== void 0;
    const g = m ?? Pt(e, it());
    i.current = 1, a.current = g, o(g);
  }, [e, n]), z(() => {
    if (c.current) return;
    const m = Pt(e, it()), g = a.current;
    Math.abs(m - g) < 5e-4 || (i.current = 1, a.current = m, o(m));
  }, [e]);
  const l = x((m, g) => {
    const h = Ze(m), y = a.current;
    Math.abs(h - y) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : h / (y || 1), a.current = h, c.current = !0, bn(s.current, { zoom: h }), o(h));
  }, []), u = x((m) => {
    l(Jt(a.current, m));
  }, [l]), f = x((m) => {
    l(Pt(m));
  }, [l]);
  return Ee(() => {
    const m = i.current;
    Math.abs(m - 1) < 1e-3 || (i.current = 1, Qi(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: f };
}
const dc = 160, fc = 3e-3, Cr = 50, mc = 16, hc = 800;
function pc(e, t = 0) {
  const n = t === 1 ? mc : t === 2 ? hc : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-Cr, Math.min(Cr, r));
  return Math.exp(-o * fc);
}
function gc(e, t, n = 0) {
  return Ze(e * pc(t, n));
}
function bc(e) {
  return Math.round(Ze(e) * 100) / 100;
}
function yc(e, t, n) {
  const r = Ze(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return Ze(t) / r;
  const a = (o + ea) / r;
  return na(a * Ze(t)) / o;
}
function vc(e) {
  return Array.from(e.querySelectorAll(nr()));
}
function wc(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function Sc(e, t, n) {
  let r = null;
  for (const s of vc(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const c = wc(i, t, n);
    if ((!r || c < r.distance) && (r = { el: s, rect: i, distance: c }), c === 0) break;
  }
  if (!r) return null;
  const { el: o, rect: a } = r;
  return {
    page: o.getAttribute(Re) || "",
    pane: o.getAttribute(ke) || "",
    fracX: (t - a.left) / a.width,
    fracY: (n - a.top) / a.height,
    clientX: t,
    clientY: n,
    pageWidth: a.width
  };
}
function kc(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function la(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${nr()}[${Re}="${t.page}"][${ke}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (kc(n, e).scrollLeft += a);
}
function Ic(e, t, n, r) {
  const o = e.querySelector(`.${Xo}`);
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
const Tc = 600, Rc = 1e3;
function Ec(e, t) {
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
  const c = r.setTimeout(() => l(), Rc);
  function l() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(c);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return l;
}
function Pc(e, t, n) {
  const r = _(t);
  r.current = t;
  const o = _(n);
  o.current = n;
  const a = _(null), s = _(null), i = _(null);
  z(() => {
    if (!e) return;
    const c = () => {
      const u = a.current;
      if (a.current = null, !u) return;
      const f = bc(u.target);
      if (Math.abs(f - r.current) < 5e-3) {
        zt(u.grid);
        return;
      }
      const d = { anchor: u.anchor, grid: u.grid, fallback: null };
      d.fallback = setTimeout(() => {
        s.current === d && (s.current = null, zt(d.grid));
      }, Tc), s.current = d, o.current(f, { keepScroll: !1 });
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
          anchor: Sc(e, u.clientX, u.clientY),
          grid: null,
          timer: null
        }, a.current = f;
      }
      f.target = gc(f.target, u.deltaY, u.deltaMode);
      const d = yc(f.start, f.target, ((g = f.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      f.grid = Ic(e, d, u.clientX, u.clientY) ?? f.grid, f.timer && clearTimeout(f.timer), f.timer = setTimeout(c, dc);
    };
    return e.addEventListener("wheel", l, { passive: !1 }), () => {
      var f;
      e.removeEventListener("wheel", l);
      const u = a.current;
      a.current = null, u != null && u.timer && clearTimeout(u.timer), zt((u == null ? void 0 : u.grid) ?? null), (f = i.current) == null || f.call(i), i.current = null;
    };
  }, [e]), Ee(() => {
    var l;
    const c = s.current;
    c && (s.current = null, c.fallback && clearTimeout(c.fallback), zt(c.grid), !(!e || !c.anchor) && (la(e, c.anchor), (l = i.current) == null || l.call(i), i.current = Ec(e, c.anchor)));
  }, [t, e]);
}
function Mc(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = _(t), a = _(n), s = _(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: x((c) => {
    c !== o.current && (s.current(), a.current(c));
  }, []) };
}
const rr = 48;
function ua(e, t = rr) {
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
function Wt(e, t, n = rr) {
  if (!e)
    return null;
  const r = un(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = ua(e, n), i = da(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function Lt(e, t, n = "auto", r, o = rr) {
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
function _c(e, t, n = "smooth", r) {
  return Lt(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function Fn(e, t, n) {
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
function Nc(e, t, n) {
  return Fn(
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
function Fe(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function Ac(e, t, n = !0, r = "", o) {
  const [a, s] = P(1);
  return z(() => {
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
      const y = ua(i), w = da(h, y);
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
const Lc = `canvas, .react-pdf__Page, .${Yo}, .${ln}`, zr = /* @__PURE__ */ new WeakMap();
function xc(e) {
  const t = Number(e.getAttribute(er));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = zr.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(Lc), zr.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Dc(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Cc(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(nr()).forEach((r) => {
    const o = dn(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = xc(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function zc(e, t, n = "", r) {
  const [o, a] = P(() => /* @__PURE__ */ new Map()), s = _(o), i = _(r);
  return i.current = r, Ee(() => {
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
      const v = Cc(b);
      Dc(s.current, v) || (s.current = v, a(v)), u && !f && (f = !0, (k = i.current) == null || k.call(i));
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
const Oc = [0, 48, 140, 320, 560], $c = 700, Fc = [80, 200, 400], Bc = 500, jc = 50, Hc = /* @__PURE__ */ new Set([
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
]), Uc = 180, Or = [0, 48, 140, 320, 700, 1200];
function Wc(e, t) {
  var T;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = _(
    ((T = We(a)) == null ? void 0 : T.anchor) || { page: 1, fraction: 0 }
  ), c = _(null), l = _(!1), u = _(r), f = _(null), d = _(null), m = _(null), g = _(null), h = _(a), y = _(""), w = _(n);
  w.current = n;
  const S = x(() => {
    var E;
    (E = f.current) == null || E.call(f), f.current = null, d.current != null && (clearTimeout(d.current), d.current = null);
  }, []), b = x(() => {
    !l.current && c.current == null || (S(), m.current != null && (clearTimeout(m.current), m.current = null), c.current = null, l.current = !1);
  }, [S]), v = x((E = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const L = () => {
      g.current = null, bn(h.current, {
        anchor: Fe(i.current)
      });
    };
    E ? L() : g.current = setTimeout(L, Uc);
  }, []), k = x((E) => {
    i.current = Fe(E), c.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, l.current = !1;
    }, jc);
  }, []);
  z(() => {
    if (!o)
      return;
    let E = !1, L = null, D = null, U = null;
    const M = () => {
      if (E) return;
      const H = e.current;
      if (!H) {
        U = setTimeout(M, 50);
        return;
      }
      L = H, D = () => {
        if (l.current)
          return;
        const K = Wt(L, w.current);
        K && (i.current = K, v());
      }, L.addEventListener("scroll", D, { passive: !0 }), l.current || D();
    };
    return M(), () => {
      E = !0, U != null && clearTimeout(U), L && D && L.removeEventListener("scroll", D);
    };
  }, [o, r, n, e, v]), z(() => {
    if (!o) return;
    const E = e.current;
    if (!E) return;
    const L = (D) => {
      D.metaKey || D.ctrlKey || D.altKey || Hc.has(D.key) && b();
    };
    return E.addEventListener("wheel", b, { passive: !0 }), E.addEventListener("touchmove", b, { passive: !0 }), window.addEventListener("keydown", L), () => {
      E.removeEventListener("wheel", b), E.removeEventListener("touchmove", b), window.removeEventListener("keydown", L);
    };
  }, [o, e, b]), Ee(() => {
    var L;
    if (h.current === a) return;
    v(!0), S(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, y.current = "";
    const E = (L = We(a)) == null ? void 0 : L.anchor;
    i.current = E ? Fe(E) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, u.current = r;
  }, [a, r, v, S]), z(() => {
    var L;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const E = Fe(
      ((L = We(a)) == null ? void 0 : L.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = E, c.current = E, l.current = !0, S(), f.current = Fn(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: w.current,
        delaysMs: Or,
        onDone: () => k(E)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(E);
    }, Math.max(...Or) + 160), () => S();
  }, [o, s, a, e, k, S]), z(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, c.current = null, S();
      return;
    }
    const E = c.current ? Fe(c.current) : Fe(i.current);
    return l.current = !0, c.current = E, i.current = E, S(), f.current = Fn(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Oc,
        onDone: () => k(E)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(E);
    }, $c), () => {
      S();
    };
  }, [r, o, n, e, k, S]), z(() => () => {
    S(), m.current != null && (clearTimeout(m.current), m.current = null), v(!0);
  }, [S, v]);
  const R = x(() => {
    const E = Wt(
      e.current,
      w.current
    );
    return Fe(E || i.current);
  }, [e]), N = x(() => {
    l.current = !0;
    const E = Wt(
      e.current,
      w.current
    ), L = Fe(E ?? i.current);
    return i.current = L, c.current = L, v(), L;
  }, [e, v]), $ = x((E, L, D) => {
    const U = D || w.current, M = mn(E, L || 1), H = { page: M, fraction: 0 };
    i.current = H, l.current = !0, c.current = H, v(), S(), _c(e.current, M, "smooth", U), f.current = Nc(
      () => e.current,
      M,
      {
        behavior: "auto",
        pane: U,
        delaysMs: Fc,
        onDone: () => k(H)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(H);
    }, Bc);
  }, [e, k, S, v]), O = x(() => Fe(i.current), []), A = x(() => l.current, []), I = x(() => {
    if (!l.current || !c.current)
      return;
    const E = Fe(c.current);
    Lt(
      e.current,
      E,
      "auto",
      w.current
    );
  }, [e]);
  return {
    lockFromShell: R,
    beginModeSwitch: N,
    goToPage: $,
    getAnchor: O,
    isRestoring: A,
    repinIfRestoring: I
  };
}
function Kc(e, t) {
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
const Vc = [0, 80, 200, 400, 800], qc = 120, Jc = 400;
function Gc(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: c, documentId: l, regionsSettled: u = !0 } = e, f = _(a);
  f.current = a;
  const d = _(s);
  d.current = s;
  const m = _(i);
  m.current = i;
  const g = _(n);
  g.current = n, z(() => {
    var v, k;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = oi(), y = Kc(h, d.current);
    if (y == null && (h != null && h.blockId) && !u) return;
    const w = fa(h, y, { jobId: c, documentId: l });
    if (t.current === w)
      return;
    if (y == null) {
      t.current = w, (v = g.current) == null || v.call(g);
      return;
    }
    t.current = w, h && ((k = m.current) == null || k.call(m, h, y));
    const S = [];
    let b = 0;
    for (const R of Vc)
      b = Math.max(b, R), S.push(
        setTimeout(() => {
          f.current(y);
        }, R)
      );
    return S.push(
      setTimeout(() => {
        var R;
        (R = g.current) == null || R.call(g);
      }, b + qc)
    ), () => {
      for (const R of S) clearTimeout(R);
    };
  }, [r, o, c, l, t, u]);
}
function Xc(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function Zc(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = Jc,
    jobId: i,
    documentId: c,
    applyReaderSearch: l
  } = e, u = _(a);
  u.current = a;
  const f = _(l);
  f.current = l;
  const d = _(0);
  z(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || d.current === o) return;
    const m = setTimeout(() => {
      var w;
      const g = ((w = globalThis.location) == null ? void 0 : w.search) || "", h = ds(g, o, u.current);
      if (d.current = o, h === null) return;
      const y = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = fa(
        { blockId: y },
        o,
        { jobId: i, documentId: c }
      ), (f.current || Xc)(h);
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
function Yc(e) {
  const t = _(""), [n, r] = P(!1), o = x(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  Gc(a, t, o), Zc(e, t, n);
}
const Ot = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function Qc(e) {
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
function el(e, t, n) {
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
function tl(e) {
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
function nl(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function rl(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function ol(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function al(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const Fr = [250, 500, 1e3, 2e3, 4e3], Sn = [80, 160, 320, 640, 1e3, 1500], Br = [250, 500, 1e3, 2e3, 4e3, 5e3];
function Bn(e, t) {
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
function or(e) {
  return ys(e) ? `${e.code || ""}`.trim() : "";
}
function en(e, t) {
  const n = or(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function sl(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (ma(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
        return c;
      a = vs(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (c) {
      if ((c == null ? void 0 : c.name) === "AbortError") throw c;
      a = c;
      const l = or(c);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw c;
    }
    const i = Sn[Math.min(s, Sn.length - 1)];
    if (await Bn(i, r), s >= Sn.length + 2) throw a;
  }
}
function il({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = P(Ot), s = _(o), i = _("");
  s.current = o;
  const c = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = Vt(l) ? l : "";
  return z(() => {
    if (!n || !c) {
      i.current = "", s.current = Ot, a(Ot);
      return;
    }
    const f = r === void 0 ? ri() : r, d = i.current === c;
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
            layoutByPage: Qc(v),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (v) {
          if ((v == null ? void 0 : v.name) === "AbortError") return;
          const k = or(v);
          if (!(k === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !k)) {
            y((N) => ({
              ...N,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: en(v, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            y((N) => ({
              ...N,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          y((N) => ({
            ...N,
            connection: "connecting",
            jobStatus: l,
            error: en(v, "正在等待 OCR 版面数据")
          })), await Bn(Fr[Math.min(b, Fr.length - 1)], m.signal).catch(() => {
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
                k = await sl(
                  c,
                  v,
                  s.current,
                  m.signal,
                  f
                );
              } catch (R) {
                if ((R == null ? void 0 : R.name) === "AbortError" || m.signal.aborted) throw R;
                y((N) => ({
                  ...N,
                  lastSeq: Math.max(N.lastSeq, v.seq),
                  error: en(R, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((R) => {
                const N = el(R, v, k);
                return u ? {
                  ...N,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ...N,
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
        await Bn(Br[Math.min(b, Br.length - 1)], m.signal).catch(() => {
        }), b += 1;
      }
    })(), () => m.abort();
  }, [n, r, c, u]), o;
}
function cl(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), c = Number(s.count) || 0;
    i && c > 0 && o.set(i, c);
  }
  return o;
}
function ll(e, t = !0) {
  const [n, r] = P(() => /* @__PURE__ */ new Map());
  return z(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = Qe().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(cl(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const ul = 4500;
function dl(e) {
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
const fl = /* @__PURE__ */ new Set(["book", "translate"]);
function ha(e) {
  return !!(e.jobId && e.sourceUrl && fl.has(e.workflow));
}
function ml(e) {
  return !!(ha(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function hl() {
  const e = Fi(), t = ha({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = ml({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = _({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Vt(o) && (r.current.running = !0);
  const a = il({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = Ui(), u = ll(e.jobId, !e.sourceOnly), f = ac({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: g } = uc(e.mode, s, f);
  Pc(i, m, g);
  const h = Ki(
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
  } = Wc(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: h.primaryNumPages > 0
  });
  z(() => {
    S();
  }, [c, S]);
  const b = zc(
    s,
    h.compareMode,
    h.rowSyncRevision,
    S
  ), v = Ac(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${m}-${h.metricsTick}`,
    h.primaryPane
  ), k = x((M, H) => {
    var Q, te;
    const K = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((Q = h.numPagesByPane) == null ? void 0 : Q.source) || 0,
      Number((te = h.numPagesByPane) == null ? void 0 : te.translated) || 0
    );
    w(M, K, H);
  }, [w, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [R, N] = P(null), $ = _(null), O = x((M) => {
    $.current && clearTimeout($.current), N(M), M && ($.current = setTimeout(() => N(null), ul));
  }, []);
  z(() => () => {
    $.current && clearTimeout($.current);
  }, []);
  const A = x((M) => {
    const H = vn(e.regions, M);
    return H ? Pr(H, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), I = x((M, H) => {
    const K = H || h.primaryPane, Q = typeof M == "object" && M ? `${M.block_id || ""}`.trim() : "", te = typeof M == "object" && M ? `${M.image_url || ""}`.trim() : "", F = typeof M == "object" && M ? M.page_idx != null ? Number(M.page_idx) + 1 : M.page != null ? Number(M.page) : null : typeof M == "number" ? M + 1 : null, V = ms(e.regions, te, F) || vn(e.regions, Q) || (typeof M == "object" ? hs(e.regions, M) : null);
    let q = V ? Pr(V, K).page : null;
    q == null && (q = dl(M)), !(q == null || q < 1) && (O(V), k(q, K));
  }, [O, k, h.primaryPane, e.regions]);
  Yc({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: v,
    goToPage: k,
    resolveBlockPage: A,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (M) => {
      O(vn(e.regions, M.blockId));
    }
  });
  const { setModeKeepingPage: T } = Mc({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: y
  });
  z(() => {
    O(null);
  }, [d, O]);
  const E = !e.boot.loading && !e.boot.failed, L = Y(() => ({ bindShell: l, shellEl: i, shellWidth: c, shellRef: s }), [l, i, c, s]), D = Y(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), U = Y(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: m,
    onZoomChange: g,
    shell: L,
    panes: h,
    sessionFiles: D,
    rowHeights: b,
    goToPage: k,
    activeRegion: R,
    jumpToAnchor: I,
    setModeKeepingPage: T,
    download: e.download,
    showHud: E,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, L, h, D, b, k, R, I, T, E, m, g, f, a, n, u]);
  return Y(() => ({
    ...U,
    currentPage: v
  }), [U, v]);
}
const pl = [
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
], gl = [
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
function bl(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of pl)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function yl(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const vl = ".reader-notes-panel";
function wl(e) {
  return e instanceof Element ? !!e.closest(vl) : !1;
}
function Sl(e) {
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
  z(() => {
    if (!u)
      return;
    const f = (d) => {
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || yl(d.target) || wl(d.target))
        return;
      const m = d.key, g = bl(m);
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
              a(Jt(o, 1));
              return;
            case "zoom-out":
              a(Jt(o, -1));
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
const kl = "retainpdf:soft-reader-close";
function Il() {
  return new URL("./index.html", window.location.href).href;
}
function Tl() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: kl },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function Rl(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function El() {
  if (!(typeof window > "u") && !Tl()) {
    if (Rl(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(Il());
  }
}
function Pl({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function Ml({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ C(Pl, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), El();
  }, children: [
    /* @__PURE__ */ p(wt, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
const _l = 3e3, Nl = 8;
async function Al(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function Ll(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function xl(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = _l;
  const r = [], o = (s, i, c) => {
    const l = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const f = s[u], d = Ll(f == null ? void 0 : f.title);
      if (!d) continue;
      n -= 1;
      const m = c ? `${c}.${u}` : `${u}`, g = { id: m, title: d, page: null, level: i, children: [] };
      r.push({ node: g, dest: f.dest }), l.push(g), i < Nl && Array.isArray(f.items) && f.items.length && (g.children = o(f.items, i + 1, m));
    }
    return l;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await Al(e, i);
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
function Dl() {
  if (Hr)
    return;
  const e = qt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (qo.GlobalWorkerOptions.workerSrc = e, Hr = !0);
}
function Cl({
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
const st = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), zl = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Ol = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, $l = {
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
function Fl(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Ur(o ?? a ?? "", zl)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Ur(o ?? a ?? "", Ol)).replace(/\\([a-zA-Z]+)/gu, (r, o) => $l[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Bl(e) {
  return st(e.translatedBlockText) || st(e.translated.text) || st(e.source.text);
}
const jl = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Hl(e) {
  const t = [];
  for (const n of e) {
    if (!jl(n)) continue;
    const r = Fl(Bl(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function Ul(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const Wl = 24, Kl = 60;
function Wr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - Wl), o = Math.min(e.length, n + t.length + Kl), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function Vl(e, t, n = 200) {
  const r = st(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = st(a.translatedBlockText) || st(a.translated.text), c = i ? Wr(i, r) : null, l = c ?? Wr(st(a.source.text), r);
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
function ql(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const ba = "reader-xref", jn = "data-xref", jt = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, Jl = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${jt})`), Gl = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function Hn(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function Xl(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function Zl(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function Yl(e, t, n) {
  const r = e[t], o = (i) => {
    if (!i || i.source.page !== r.source.page) return !1;
    const c = De(i);
    return c === "figure" || c === "table" || c === "formula";
  }, a = (i) => {
    const c = [];
    for (let l = t + i; o(e[l]) && c.length < 40; l += i) c.push(e[l]);
    return i < 0 ? c.reverse() : c;
  }, s = a(n === "table" ? 1 : -1);
  return s.length ? s : a(n === "table" ? -1 : 1);
}
function Ql(e, t, n) {
  return (e.find((o) => De(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function eu(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = De(r), s = Zl(r);
    if (a === "formula") {
      for (const g of s.matchAll(Gl)) {
        const h = Hn(g[1]);
        h && n({ key: `equation:${h}`, kind: "equation", label: h, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = Jl.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const l = Xl(i[1]), u = Hn(i[2]), f = Yl(e, o, l), d = [...f.map((g) => g.itemId), r.itemId], m = new Map(e.map((g, h) => [g.itemId, h]));
    d.sort((g, h) => (m.get(g) ?? 0) - (m.get(h) ?? 0)), n({ key: `${l}:${u}`, kind: l, label: u, itemId: Ql(f, r, l), itemIds: d, captionId: r.itemId });
  }), t;
}
const tu = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${jt})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${jt})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${jt})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${jt})\s*[）)]`, "g"), kind: () => "equation" }
];
function nu(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of tu) {
    o.lastIndex = 0;
    for (const s of e.matchAll(o)) {
      const i = s.length > 2 ? s[1] : "", c = Hn(s[s.length - 1]), l = `${a(i)}:${c}`;
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
function ru(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function ou(e, t, n = "") {
  const r = nu(e, t);
  if (!r.length) return Bt(e, n);
  let o = "", a = 0;
  for (const s of r)
    o += Bt(e.slice(a, s.start), n), o += `<mark class="${ba}" ${jn}="${ru(s.key)}">${Bt(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  return o + Bt(e.slice(a), n);
}
const au = { figure: "图", table: "表", equation: "式" };
function Kr(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${au[e.kind]} ${e.label}`;
}
function be(e) {
  return typeof e == "string" ? e : "";
}
function su(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function iu(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function cu(e) {
  return {
    source: be(e == null ? void 0 : e.source_text) || be(e == null ? void 0 : e.unit_source_text),
    translated: be(e == null ? void 0 : e.protected_translated_text) || be(e == null ? void 0 : e.translated_text)
  };
}
const lu = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function ya(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function uu(e) {
  const t = ya(e).sort((r, o) => be(r.ts).localeCompare(be(o.ts)));
  return t.length ? [
    { text: be(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: be(r.new_text),
      label: lu[be(r.source)] || be(r.source) || "修订",
      ts: be(r.ts),
      reason: be(r.reason)
    }))
  ].reverse() : [];
}
function du(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function fu(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return be(r.finished_at) || be(n.finished_at) || "";
}
function mu(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = ya(e).sort((a, s) => be(a.ts).localeCompare(be(s.ts)));
  for (const a of o) {
    const s = new Date(be(a.ts)).getTime(), i = be(a.reader_item_id) || be(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, be(a.new_text));
  }
  return n;
}
const hu = {
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
function pu(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = hu[be(n.kind)] || be(n.kind) || "问题", o = be(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const gu = /* @__PURE__ */ new Set(["text", "formula"]);
function ar(e) {
  return gu.has(e);
}
function bu(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || ar(De(n));
}
function yu(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !ar(De(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const vu = 300, wu = 72;
function Su(e, t) {
  if (e.width >= vu && e.height >= wu)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const ku = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function Iu(e, t, n) {
  return e.flatMap((r) => {
    if (!ku.has(De(r.region))) return [];
    const o = vt(r, t, n);
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
async function Tu(e) {
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
const Ru = "reader-text-hover-copy", Eu = "reader-text-hover-edit", Pu = "reader-text-hover-zoom", Mu = "reader-text-hover-id";
function _u(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const va = "reader-text-hover-tools";
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
const Nu = 26, Au = 220;
function Lu(e, t = Au) {
  return e.height < Nu * 2 || e.width < t;
}
function xu({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? Bo : e === "failed" ? wt : Ss, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function Du({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  onZoom: o,
  frameRect: a,
  placement: s,
  tailTop: i = 0
}) {
  const [c, l] = P("idle"), [u, f] = P("idle"), [d] = P(() => _u()), m = _([]), g = (e == null ? void 0 : e.itemId) || "";
  if (z(() => {
    l("idle"), f("idle");
    const k = m.current;
    return () => {
      k.forEach((R) => window.clearTimeout(R)), m.current = [];
    };
  }, [g]), !e) return null;
  const h = ps(e.highlight.region, t), y = De(e.highlight.region), w = (k, R) => async (N) => {
    N.preventDefault(), N.stopPropagation();
    const $ = await Tu(k);
    R($ ? "copied" : "failed"), m.current.push(window.setTimeout(() => R("idle"), 1200));
  }, S = y === "formula" ? "复制 LaTeX" : "复制", b = a || e.rect, v = s || (Lu(b) ? "outside" : "inside");
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
          className: va,
          "data-placement": v,
          style: v === "tail" ? { top: i } : void 0,
          children: [
            d ? /* @__PURE__ */ p(
              nn,
              {
                className: Mu,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: w(e.itemId, f),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && ar(y) ? /* @__PURE__ */ p(
              nn,
              {
                className: Eu,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (k) => {
                  k.preventDefault(), k.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ p(Qn, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            h ? /* @__PURE__ */ p(
              nn,
              {
                className: Ru,
                state: c,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: c === "copied" ? "已复制" : c === "failed" ? "复制失败" : S,
                onClick: w(h, l),
                children: /* @__PURE__ */ p(xu, { state: c })
              }
            ) : null,
            o ? /* @__PURE__ */ p(
              nn,
              {
                className: Pu,
                state: "idle",
                label: "放大看这一块",
                title: y === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (k) => {
                  k.preventDefault(), k.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ p(ws, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Cu(e, t) {
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
    const i = vt(
      Cu(e, a),
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
const Ou = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', $u = 256, $t = /* @__PURE__ */ new Map();
function Fu(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function wa(e) {
  const t = `${e || ""}`, { text: n, slots: r } = Xs(t, { bareLatex: !0 }), o = Fu(n), a = Zs(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = $t.get(t);
  if (!s && (s = Ys(o, r), $t.set(t, s), $t.size > $u)) {
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
function Bu(e, t) {
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
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Ou,
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
function ju(e, t, n, r) {
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
const Hu = 512, Ft = /* @__PURE__ */ new Map();
let Un = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  Un += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  Un += 1;
}));
function Uu(e, t, n, r) {
  return [
    Un,
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
  const n = _(null), r = Y(
    () => wa(e.translatedText),
    [e.translatedText]
  ), [o, a] = P(r.fallbackHtml), s = Y(
    () => Bu(e, t),
    [e, t]
  );
  z(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((d) => {
      f && a(d);
    }), () => {
      f = !1;
    };
  }, [r]), Ee(() => {
    const f = n.current;
    if (!f) return;
    const [d, m, g, h] = s.padding, y = Math.max(1, e.rect.width - h - m), w = Math.max(1, e.rect.height - d - g), S = Uu(o, y, w, s);
    let b = Ft.get(S);
    if (b === void 0 && (b = ju(
      (v) => (f.style.fontSize = `${v}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      y,
      w,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), Ft.set(S, b), Ft.size > Hu)) {
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
function Wu({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = Y(
    () => zu(e, t, n, r),
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
const Ku = pn(Wu);
function Vu({
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
        Sa,
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
const qu = pn(Vu), ka = 24, ot = ka * 2 + 4, Xe = 24, Ju = 4, Gu = 6, ht = (e) => e.left + e.width, lt = (e) => e.top + e.height;
function Ht(e, t) {
  const n = Math.min(ht(e), ht(t)) - Math.max(e.left, t.left), r = Math.min(lt(e), lt(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const qr = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= ht(t) && r >= t.top && r <= lt(t);
}, Xu = (e) => e.height > 40 && e.height > e.width * 2.5;
function Zu(e, t, n) {
  if (!t.length || e.height < Xe || e.width < n + 8) return null;
  const r = Math.max(...t.map(lt)), o = ht(e) - 4 - n;
  for (const a of [r, lt(e) - 2]) {
    const s = Math.max(e.top, a - Xe), i = { left: o, top: s, width: n, height: Xe };
    if (!t.some((c) => Ht(i, c) > 0)) return s - e.top;
  }
  return null;
}
function Yu(e, t) {
  const n = [], r = (a) => {
    const s = ka + Ju, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: ht(e), top: i, width: s, height: ot } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: ot } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - Xe - 3, width: ot, height: Xe + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: lt(e), width: ot, height: Xe + 3 } }), r(!0);
  const o = Zu(e, t, ot);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: ht(e) - 4 - ot, top: e.top + o, width: ot, height: Xe } }), n;
}
function Qu(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((S) => S.width > 0 && S.height > 0 && !Xu(S)), i = s.filter((S) => qr(S, t)), c = s.filter((S) => !qr(S, t)), l = n.filter((S) => S !== t && Ht(S, t) < t.width * t.height * 0.5), u = Yu(t, i).filter(({ box: S, overhang: b }) => {
    const v = b ? Gu : 0;
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
function ed(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - Xe - 3 : lt(r);
  return t >= r.left - 4 && t <= r.left + ot + 4 && n >= a && n <= a + Xe + 3;
}
const In = (e) => e.left + e.width, Tn = (e) => e.top + e.height;
function td(e, t, n = 3, r = 6) {
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
function nd(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function rd(e, t, n, r) {
  const [o, a] = P(null);
  return Ee(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? nd(s) : [], c = De(t.highlight.region) === "figure", l = i.length && !c ? td(t.rect, i) : t.rect, u = n.filter((d) => d.itemId !== t.itemId).map((d) => d.rect), f = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...Qu({ frame: l, others: u, pageWidth: r, pageHeight: f, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
const Ia = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], Jr = { pen: 35e-4, highlighter: 0.018 }, Gr = 0.015, Wn = "retainpdf.reader.ink.v1:";
function Xr(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem(Wn + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function od(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem(Wn + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem(Wn + e);
    } catch {
    }
}
function ad(e, t, n, r, o, a) {
  const s = Gr * Gr;
  return e.filter((i) => Ta(i, t, n) && i.points.some(([c, l]) => (c - r) ** 2 + ((l - o) * a) ** 2 <= s)).map((i) => i.id);
}
function Ta(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function sd(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function id(e) {
  const [t, n] = P(null), [r, o] = P(Ia[0].key), [a, s] = P(() => Xr(e)), i = _(a), c = _([]);
  z(() => {
    const h = Xr(e);
    i.current = h, s(h), c.current = [];
  }, [e]);
  const l = x((h) => {
    i.current = h, s(h), od(e, h);
  }, [e]), u = x((h) => {
    const y = i.current, w = h(y);
    w !== y && (c.current = [...c.current.slice(-49), y], l(w));
  }, [l]), f = x((h) => {
    h.points.length < 1 || u((y) => [...y, { ...h, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [u]), d = x((h) => {
    h.length && u((y) => y.filter((w) => !h.includes(w.id)));
  }, [u]), m = x((h) => {
    u((y) => y.some((w) => w.page === h) ? y.filter((w) => w.page !== h) : y);
  }, [u]), g = x(() => {
    const h = c.current.pop();
    h && l(h);
  }, [l]);
  return Y(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: d, undo: g, clearPage: m }),
    [t, r, a, f, d, g, m]
  );
}
const cd = "reader-ink-layer";
function ld(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function Zr({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: ld(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function ud({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = P(null), i = _(!1), c = o.strokes.filter((h) => Ta(h, e, t)), l = !!o.tool;
  if (!l && !c.length) return null;
  const u = (h) => {
    const y = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - y.left) / Math.max(1, y.width))),
      Math.min(1, Math.max(0, (h.clientY - y.top) / Math.max(1, y.height)))
    ];
  }, f = (h, y) => o.erase(ad(o.strokes, e, t, h, y, r / Math.max(1, n))), d = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [y, w] = u(h);
    o.tool === "eraser" ? f(y, w) : s([[y, w]]);
  }, m = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [y, w] = u(h);
    o.tool === "eraser" ? f(y, w) : s((S) => S ? sd(S, y, w) : [[y, w]]);
  }, g = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: Jr[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ C(
    "svg",
    {
      className: cd,
      "data-ink-active": l ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: d,
      onPointerMove: m,
      onPointerUp: g,
      onPointerCancel: g,
      children: [
        c.map((h) => /* @__PURE__ */ p(Zr, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(Zr, { stroke: { tool: o.tool, color: o.color, width: Jr[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
function dd({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = P(null), [i, c] = P(!1), [l, u] = P([]), [f, d] = P(""), [m, g] = P(""), [h, y] = P(!1), [w, S] = P(null), [b, v] = P([]), k = r.drafts, R = r.generation, N = x(async (I, T) => {
    if (e)
      try {
        u(uu(await e.fetchRevisions(I, T)));
      } catch {
        u([]);
      }
  }, [e]);
  z(() => {
    if (s(null), u([]), S(null), v([]), g(""), !e || !t || !n) return;
    let I = !1;
    return c(!0), e.loadItem(t, n).then((T) => {
      if (I) return;
      const E = T == null ? void 0 : T.item;
      if (!E) throw new Error("找不到这一段的译文。");
      const L = `${(T == null ? void 0 : T.item_id) || n}`, { source: D, translated: U } = cu(E);
      s({ readerItemId: n, itemId: L, source: D, current: U }), d(k.get(n) ?? U);
    }).catch((T) => {
      I || S({ tone: "error", message: (T == null ? void 0 : T.message) || "读取这段译文失败。" });
    }).finally(() => {
      I || c(!1);
    }), N(t, n), () => {
      I = !0;
    };
  }, [e, t, n, N]);
  const $ = x((I) => {
    d(I), n && k.set(n, I);
  }, [n, k]), O = x(async (I, T) => {
    if (!e || !a || h) return !1;
    const E = I ?? f;
    if (!E.trim()) return !1;
    y(!0), S(null), v([]);
    try {
      const L = await e.revise(t, a.itemId, {
        translated_text: E,
        source: "user",
        reason: (T ?? m).trim() || "在阅读页手动修改",
        ...R.current != null ? { expected_generation: R.current } : {}
      }), D = Number(L == null ? void 0 : L.generation);
      return Number.isFinite(D) && (R.current = D), k.delete(a.readerItemId), s({ ...a, current: E }), d(E), g(""), (L == null ? void 0 : L.changed) === !1 ? S({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, E), S({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), N(t, a.readerItemId), !0;
    } catch (L) {
      const D = L;
      return (D == null ? void 0 : D.reason) === "generation_mismatch" && (R.current = null), S({ tone: "error", message: (D == null ? void 0 : D.message) || "保存失败，请稍后再试。" }), v(pu(D == null ? void 0 : D.issues)), !1;
    } finally {
      y(!1);
    }
  }, [e, a, h, f, m, t, o, N, k, R]), A = x(() => {
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
    save: O,
    discardDraft: A
  };
}
const Ra = "reader-inline-edit";
function fd({ text: e }) {
  const [t, n] = P("");
  return z(() => {
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
  }, [e]), t ? /* @__PURE__ */ C("div", { className: "reader-inline-edit-preview", "data-inline-edit-preview": "true", children: [
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
  const s = e.itemId, i = dd({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = P(!1), [u, f] = P(!1), d = _(null), m = Su(e.rect, t), g = Y(() => yu(o), [o]), h = g.indexOf(s), { loaded: y } = i, w = i.saving || i.loading, S = n.blockedReason, b = !y || i.draft === y.current, { close: v, select: k } = n, R = x((I) => {
    const T = g[h + I];
    T && (k(T), a == null || a(T));
  }, [g, h, k, a]), N = x(() => {
    i.discardDraft(), v();
  }, [i, v]), $ = x(async (I, T) => {
    await i.save(I, T) && v();
  }, [i, v]);
  z(() => {
    const I = (T) => {
      !T.altKey || T.key !== "ArrowUp" && T.key !== "ArrowDown" || (T.preventDefault(), R(T.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", I), () => window.removeEventListener("keydown", I);
  }, [R]), Ee(() => {
    const I = d.current;
    if (!I) return;
    I.style.height = "auto";
    const T = m.mode === "inline" ? m.minHeight : 0;
    I.style.height = `${Math.max(T, I.scrollHeight + 2)}px`;
  }, [i.draft, y, m.mode, m.mode === "inline" ? m.minHeight : 0]);
  const O = m.mode === "inline" ? { left: m.left, top: m.top, width: m.width } : { left: m.left, width: m.width, top: m.top, bottom: m.bottom };
  return /* @__PURE__ */ C(yt, { children: [
    m.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ C(
      "div",
      {
        className: `${Ra} is-${m.mode}`,
        style: O,
        role: "group",
        "aria-label": `改第 ${((A = n.target) == null ? void 0 : A.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": m.mode,
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
          S ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note is-blocked", "data-block-edit-blocked": "true", children: S }) : null,
          i.loading ? /* @__PURE__ */ p("p", { className: "reader-inline-edit-note", children: "正在读这一段…" }) : null,
          y ? /* @__PURE__ */ p(
            Vs,
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
                I.key === "Enter" && (I.metaKey || I.ctrlKey) ? (I.preventDefault(), b || $()) : I.key === "Escape" && (I.preventDefault(), N());
              }
            }
          ) : null,
          y ? /* @__PURE__ */ p(fd, { text: i.draft }) : null,
          /* @__PURE__ */ C("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(mt, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => R(-1), children: /* @__PURE__ */ p(ks, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(mt, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= g.length - 1, onClick: () => R(1), children: /* @__PURE__ */ p(jo, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              Vo,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: w || !!S || !y,
                onChange: (I) => i.setReason(I.target.value),
                onKeyDown: (I) => {
                  I.key === "Enter" ? (I.preventDefault(), b || $()) : I.key === "Escape" && (I.preventDefault(), N());
                }
              }
            ),
            i.history.length ? /* @__PURE__ */ C(
              oe,
              {
                className: "reader-inline-edit-act",
                variant: "ghost",
                size: "sm",
                "aria-expanded": u,
                "data-block-edit-action": "history",
                onClick: () => f((I) => !I),
                children: [
                  /* @__PURE__ */ p(Is, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ p(oe, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: N, children: "取消" }),
            /* @__PURE__ */ p(
              oe,
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
            const E = I.text === y.current, L = [du(I.ts), I.label].filter(Boolean).join(" · ");
            return /* @__PURE__ */ C("li", { "data-block-edit-history": I.label, "data-current": E ? "true" : void 0, children: [
              /* @__PURE__ */ C("div", { className: "reader-inline-edit-history-meta", children: [
                /* @__PURE__ */ C("span", { children: [
                  L,
                  E ? "（现在用的）" : "",
                  I.reason ? ` · ${I.reason}` : ""
                ] }),
                E ? null : /* @__PURE__ */ p(
                  oe,
                  {
                    className: "reader-inline-edit-act",
                    variant: "ghost",
                    size: "sm",
                    "data-block-edit-action": "restore",
                    disabled: w || !!S,
                    onClick: () => {
                      $(I.text, `回到「${L.replace(" · ", " ")}」那一版`);
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
const Ea = Xn(null), Pa = Xn(null);
function hd({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(Ea.Provider, { value: e, children: /* @__PURE__ */ p(Pa.Provider, { value: t, children: n }) });
}
function et() {
  return Zn(Ea);
}
function Ma() {
  return Zn(Pa);
}
const _a = 1.414;
function pd({
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
  var le, pe, ye;
  const b = et(), v = b == null ? void 0 : b.revisedBlocks, k = b == null ? void 0 : b.blockEdit, R = k == null ? void 0 : k.pendingEdits, N = b == null ? void 0 : b.editBlock, $ = (b == null ? void 0 : b.findTerm) || "", O = b == null ? void 0 : b.xrefIndex, A = Y(
    () => O != null && O.size ? ({ str: j }) => ou(j, O, $) : $ ? ({ str: j }) => Bt(j, $) : void 0,
    [$, O]
  ), I = _(c ?? _a), [T, E] = P(I.current);
  z(() => {
    c != null && Math.abs(c - I.current) >= 1e-3 && (I.current = c, E(c));
  }, [c]);
  const L = _(u);
  L.current = u;
  const D = _(null), U = _((j) => {
    var re;
    D.current = j, (re = L.current) == null || re.call(L, j);
  }).current, M = _(null), H = _(`${t}@${n}`);
  Ee(() => {
    const j = `${t}@${n}`;
    H.current !== j && (H.current = j, o && bd(D.current, M.current));
  }, [o, n, t]), z(() => {
    o || Rn(M.current);
  }, [o]), z(() => () => Rn(M.current), []);
  const K = Math.max(120, Math.floor(t * T)), Q = Math.max(K, Math.ceil(s || 0)), te = vt(f, t, K), F = Y(
    () => Iu(d, t, K),
    [K, d, t]
  ), [V, q] = P(null), he = typeof g == "function", G = he ? m ?? null : V, J = (j) => {
    he ? j !== (m ?? null) && (g == null || g(j)) : q((re) => re === j ? re : j);
  }, ce = Y(
    () => F.find((j) => j.itemId === G) || null,
    [G, F]
  ), ge = r === "translated" && ((le = k == null ? void 0 : k.target) == null ? void 0 : le.itemId) || "", ie = Y(
    () => ge && F.find((j) => j.itemId === ge) || null,
    [ge, F]
  ), me = rd(D, o ? ce : null, F, t), Ie = (j) => {
    var Me, Oe, _e, $e, we;
    if (j.pointerType === "touch") return;
    if ((Me = b == null ? void 0 : b.ink) != null && Me.tool) {
      J(null);
      return;
    }
    if (j.buttons !== 0) {
      J(null);
      return;
    }
    if ((_e = (Oe = j.target) == null ? void 0 : Oe.closest) != null && _e.call(Oe, `.${va}`) || (we = ($e = j.target) == null ? void 0 : $e.closest) != null && we.call($e, `.${Ra}`)) return;
    const re = j.currentTarget.getBoundingClientRect(), se = j.clientX - re.left, ze = j.clientY - re.top;
    if (ed(me, se, ze)) return;
    const Pe = Vr(F, se, ze);
    J((Pe == null ? void 0 : Pe.itemId) || null);
  }, tt = (j) => {
    if (j.pointerType === "mouse") return;
    const re = j.currentTarget.getBoundingClientRect(), se = Vr(
      F,
      j.clientX - re.left,
      j.clientY - re.top
    );
    J((se == null ? void 0 : se.itemId) || null);
  }, Ce = (j) => {
    !Number.isFinite(j) || j <= 0 || Math.abs(I.current - j) < 1e-3 || (I.current = j, E(j), l == null || l(e, j));
  };
  return /* @__PURE__ */ C(
    "div",
    {
      ref: U,
      [Re]: e,
      [ke]: r,
      [er]: K,
      className: tr,
      onPointerMoveCapture: Ie,
      onPointerDown: tt,
      onDoubleClick: (j) => {
        var se;
        const re = b == null ? void 0 : b.zoomBlock;
        !re || (se = b == null ? void 0 : b.ink) != null && se.tool || !ce || De(ce.highlight.region) === "figure" && (j.preventDefault(), re(ce.itemId));
      },
      onPointerLeave: (j) => {
        j.pointerType === "mouse" && J(null);
      },
      style: {
        width: t,
        height: Q,
        minHeight: Q
      },
      children: [
        o ? /* @__PURE__ */ p(
          Js,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: A,
            renderAnnotationLayer: !1,
            className: Yo,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: ln,
                style: { width: t, height: K }
              }
            ),
            onLoadSuccess: (j) => {
              try {
                const re = j.getViewport({ scale: 1 });
                if (re.width > 0) {
                  const se = re.height / re.width;
                  Ce(se);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              Rn(M.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ p(
          "div",
          {
            className: ln,
            style: { width: t, height: K },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: M, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        te ? /* @__PURE__ */ p(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: te,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && w ? /* @__PURE__ */ p(
          Ku,
          {
            layoutPage: h,
            pageState: y,
            width: t,
            height: K
          }
        ) : null,
        o && w && S ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (R != null && R.size) ? /* @__PURE__ */ p(qu, { targets: F, edits: R, width: t, excludeId: ie == null ? void 0 : ie.itemId }) : null,
        o && ie && k ? /* @__PURE__ */ p(
          md,
          {
            target: ie,
            page: { width: t, height: K },
            edit: k,
            showSource: !!(b != null && b.editShowsSource),
            regions: b == null ? void 0 : b.regions,
            jumpToBlock: b == null ? void 0 : b.jumpToBlock
          }
        ) : null,
        o && r === "translated" && (v != null && v.size) ? /* @__PURE__ */ p("div", { className: "reader-revised-markers", "aria-hidden": "true", children: F.filter((j) => v.has(j.itemId)).map((j) => /* @__PURE__ */ p(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": j.itemId,
            style: { left: j.rect.left, top: j.rect.top, height: j.rect.height }
          },
          j.itemId
        )) }) : null,
        o && (b != null && b.ink) ? /* @__PURE__ */ p(
          ud,
          {
            page: e,
            pane: r === "translated" ? "translated" : b.compareVersion ? "compare" : "source",
            width: t,
            height: K,
            ink: b.ink
          }
        ) : null,
        (pe = b == null ? void 0 : b.askMarks) != null && pe.length && b.onAskMark ? /* @__PURE__ */ p(Cl, { marks: b.askMarks, page: e, height: K, onOpen: b.onAskMark }) : null,
        /* @__PURE__ */ p(
          Du,
          {
            target: o && !((ye = b == null ? void 0 : b.ink) != null && ye.tool) && (ce == null ? void 0 : ce.itemId) !== (ie == null ? void 0 : ie.itemId) ? ce : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: ce && (v == null ? void 0 : v.get(ce.itemId)) || 0,
            onEdit: N,
            onZoom: b == null ? void 0 : b.zoomBlock,
            frameRect: me == null ? void 0 : me.rect,
            placement: me == null ? void 0 : me.placement,
            tailTop: me == null ? void 0 : me.tailTop
          }
        )
      ]
    }
  );
}
const gd = pn(pd);
function bd(e, t) {
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
const yd = 2 * 1024 * 1024;
function vd(e) {
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
const En = 5, wd = "120% 0px", Sd = 120, kd = "25% 0px";
let Yr = 1;
const Qr = /* @__PURE__ */ new WeakMap();
function Id(e) {
  if (!e) return 0;
  const t = Qr.get(e);
  if (t) return t;
  const n = Yr;
  return Yr += 1, Qr.set(e, n), n;
}
function Td() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Rd = Do(
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
    showLiveTranslation: R = t === "source",
    liveTranslationPendingLabel: N = "",
    paneAction: $
  }, O) {
    Dl();
    const { file: A, loading: I, error: T } = xi(n, r), E = `${n}\0${Id(A)}`, L = _(E);
    L.current = E;
    const D = Y(() => {
      const B = Pi(A);
      return B ? "ranged" in B ? { range: vd(B.ranged) } : B : null;
    }, [A, n]), [U, M] = P(0), [H, K] = P(""), [Q, te] = P(null), [F, V] = P(480), q = _(null), he = _(0), G = Y(() => Td(), []), J = Y(() => ({
      cMapUrl: qt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: qt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: yd,
      disableAutoFetch: !0
    }), []);
    Yn(O, () => Q, [Q]), z(() => {
      const B = (Z) => {
        he.current = Z, V(Z);
      }, X = (Z) => {
        const ue = tc(Z, he.current);
        if (ue !== "ignore") {
          if (q.current && clearTimeout(q.current), ue === "immediate") {
            B(Z);
            return;
          }
          q.current = setTimeout(() => B(Z), ra);
        }
      }, ee = !!(c && c >= 80);
      X(ee ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const de = !ee && i && typeof ResizeObserver < "u" ? new ResizeObserver((Z) => {
        var ue, ve;
        X(((ve = (ue = Z[0]) == null ? void 0 : ue.contentRect) == null ? void 0 : ve.width) ?? i.clientWidth);
      }) : null;
      return de && i && de.observe(i), () => {
        de == null || de.disconnect(), q.current && clearTimeout(q.current);
      };
    }, [c, i, a]);
    const ce = Y(
      () => Yi(F, o),
      [F, o]
    ), [ge, ie] = P(() => /* @__PURE__ */ new Map()), [me, Ie] = P(() => /* @__PURE__ */ new Set()), [tt, Ce] = P(() => /* @__PURE__ */ new Set()), le = _(/* @__PURE__ */ new Map()), pe = _(null), ye = _(null), [j, re] = P(() => /* @__PURE__ */ new Set()), se = _(/* @__PURE__ */ new Map()), ze = x((B, X) => {
      ie((ee) => {
        if (ee.get(B) === X) return ee;
        const ne = new Map(ee);
        return ne.set(B, X), ne;
      });
    }, []), Pe = x((B, X) => {
      const ee = le.current, ne = ee.get(B), de = [pe.current, ye.current];
      if (ne)
        for (const Z of de)
          try {
            Z == null || Z.unobserve(ne);
          } catch {
          }
      if (X) {
        ee.set(B, X);
        for (const Z of de)
          try {
            Z == null || Z.observe(X);
          } catch {
          }
      } else
        ee.delete(B);
    }, []), Me = _(/* @__PURE__ */ new Map()), Oe = x((B) => {
      const X = Me.current;
      let ee = X.get(B);
      return ee || (ee = (ne) => Pe(B, ne), X.set(B, ee)), ee;
    }, [Pe]);
    z(() => {
      if (typeof IntersectionObserver > "u") return;
      const B = se.current, X = new IntersectionObserver(
        (ee) => {
          const ne = [], de = [];
          for (const Z of ee) {
            const ue = Z.target, ve = dn(ue);
            Number.isFinite(ve) && (Z.isIntersecting ? ne : de).push(ve);
          }
          if ((ne.length || de.length) && Ie((Z) => {
            let ue = null;
            for (const ve of ne)
              Z.has(ve) || (ue = ue || new Set(Z), ue.add(ve));
            for (const ve of de)
              Z.has(ve) && (ue = ue || new Set(Z), ue.delete(ve));
            return ue || Z;
          }), ne.length) {
            for (const Z of ne) {
              const ue = B.get(Z);
              ue && (clearTimeout(ue), B.delete(Z));
            }
            Ce((Z) => {
              let ue = null;
              for (const ve of ne)
                Z.has(ve) || (ue = ue || new Set(Z), ue.add(ve));
              return ue || Z;
            });
          }
          for (const Z of de)
            B.has(Z) || B.set(Z, setTimeout(() => {
              B.delete(Z), Ce((ue) => {
                if (!ue.has(Z)) return ue;
                const ve = new Set(ue);
                return ve.delete(Z), ve;
              });
            }, Sd));
        },
        { root: i, rootMargin: wd, threshold: 0 }
      );
      pe.current = X;
      for (const ee of le.current.values())
        try {
          X.observe(ee);
        } catch {
        }
      return () => {
        X.disconnect(), pe.current === X && (pe.current = null);
        for (const ee of B.values()) clearTimeout(ee);
        B.clear();
      };
    }, [i]), z(() => {
      if (typeof IntersectionObserver > "u") return;
      const B = new IntersectionObserver(
        (X) => {
          re((ee) => {
            let ne = null;
            for (const de of X) {
              const Z = dn(de.target);
              !Number.isFinite(Z) || de.isIntersecting === ee.has(Z) || (ne = ne || new Set(ee), de.isIntersecting ? ne.add(Z) : ne.delete(Z));
            }
            return ne || ee;
          });
        },
        { root: i, rootMargin: kd, threshold: 0 }
      );
      ye.current = B;
      for (const X of le.current.values())
        try {
          B.observe(X);
        } catch {
        }
      return () => {
        B.disconnect(), ye.current === B && (ye.current = null);
      };
    }, [i]);
    const _e = !!i && typeof IntersectionObserver < "u";
    Ee(() => {
      M(0), K(""), Ie(/* @__PURE__ */ new Set()), Ce(/* @__PURE__ */ new Set()), ie(/* @__PURE__ */ new Map()), le.current.clear();
      const B = se.current;
      for (const X of B.values()) clearTimeout(X);
      B.clear(), h == null || h(0, t);
    }, [E, h, t]);
    const $e = x(
      (B) => {
        if (L.current !== E) return;
        const X = B.numPages;
        M(X), K(""), h == null || h(X, t), f == null || f({ numPages: X, pane: t }), m && typeof B.getPage == "function" && m(B, t), d && typeof B.getOutline == "function" && xl(B).then((ee) => {
          L.current === E && d(ee, t);
        }, () => {
        });
      },
      [E, f, d, m, h, t]
    ), we = x(
      (B) => {
        if (L.current !== E) return;
        const X = (B == null ? void 0 : B.message) || "PDF 解析失败";
        K(X), M(0), h == null || h(0, t), g == null || g(B, t);
      },
      [E, g, h, t]
    ), Ne = Y(
      () => U > 0 ? Array.from({ length: U }, (B, X) => X + 1) : [],
      [U]
    );
    z(() => {
      typeof IntersectionObserver < "u" || Ce(new Set(Ne));
    }, [Ne]);
    const Be = Y(
      () => At(y, S, t),
      [y, S, t]
    ), Ke = Y(() => {
      const B = /* @__PURE__ */ new Map();
      for (const X of w) {
        const ee = At(X, S, t);
        if (!ee) continue;
        const ne = B.get(ee.box.page) || [];
        ne.push(ee), B.set(ee.box.page, ne);
      }
      return B;
    }, [t, S, w]), je = Y(() => {
      const B = /* @__PURE__ */ new Set();
      if (!b) return B;
      for (const [X, ee] of Ke)
        ee.some((ne) => ne.itemId === b) && B.add(X);
      return B;
    }, [b, Ke]), Ae = Y(() => {
      if (U === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(Ne);
      if (me.size === 0) {
        const ee = Math.min(U, En * 2 + 1);
        return new Set(Array.from({ length: ee }, (ne, de) => de + 1));
      }
      const X = /* @__PURE__ */ new Set();
      for (const ee of me)
        for (let ne = -En; ne <= En; ne++) {
          const de = ee + ne;
          de >= 1 && de <= U && X.add(de);
        }
      return X;
    }, [U, Ne, i, a, me]), nt = !n || !!T || !!H, ut = n && (T || H) || s;
    return /* @__PURE__ */ C(
      "section",
      {
        ref: te,
        className: `reader-panel ${gn}${a ? "" : " is-hidden"}`,
        [ke]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (k == null ? void 0 : k.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          $ ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: $ }) : null,
          N ? /* @__PURE__ */ C("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: N })
          ] }) : null,
          nt && !I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: ut }) : null,
          I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          D && !T ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            Gs,
            {
              file: D,
              loading: null,
              error: null,
              options: J,
              onLoadSuccess: $e,
              onLoadError: we,
              className: "reader-react-pdf-document",
              children: Ne.map((B) => {
                if (Ae.has(B))
                  return /* @__PURE__ */ p(
                    gd,
                    {
                      pane: t,
                      pageNumber: B,
                      width: ce,
                      devicePixelRatio: G,
                      active: tt.has(B),
                      textLayer: !_e || j.has(B),
                      syncedMinHeight: (l == null ? void 0 : l.get(B)) || 0,
                      onMetrics: u,
                      cachedAspect: ge.get(B),
                      onAspectChange: ze,
                      sentinelRef: Oe(B),
                      regionHighlight: (Be == null ? void 0 : Be.box.page) === B ? Be : null,
                      regionTargets: Ke.get(B),
                      hoveredRegionId: b && je.has(B) ? b : null,
                      onHoverRegion: v,
                      liveTranslationLayout: k == null ? void 0 : k.layoutByPage.get(B - 1),
                      liveTranslationPage: k == null ? void 0 : k.pagesByPage.get(B - 1),
                      showLiveTranslation: R,
                      liveTranslationMissing: rl(k, B - 1)
                    },
                    `${t}-${B}`
                  );
                const ee = ge.get(B) ?? _a, ne = Math.max(120, Math.floor(ce * ee)), de = Math.max(ne, Math.ceil((l == null ? void 0 : l.get(B)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: Oe(B),
                    [Re]: B,
                    [ke]: t,
                    [er]: ne,
                    className: `${tr} is-placeholder`,
                    style: {
                      width: ce,
                      height: de,
                      minHeight: de
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: ln,
                        style: { width: ce, height: ne },
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
), eo = pn(Rd), Ed = 2e3, Pd = 6, Md = 500, to = "reader-react-resizing";
function _d(e, t) {
  const n = _(null), r = _(null);
  Ee(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const v = Nd(e), k = Wt(e, v);
      if (!k) return;
      s = { pane: v, progress: k, started: performance.now() };
    }
    const { pane: i, progress: c, started: l } = s;
    let u = 0, f = null, d = e.scrollHeight, m = d, g = 0, h = l;
    const y = /* @__PURE__ */ new WeakMap(), w = typeof ResizeObserver > "u" ? null : new ResizeObserver((v) => {
      let k = !1;
      for (const R of v) {
        const N = Math.round(R.contentRect.height);
        y.has(R.target) && y.get(R.target) !== N && (k = !0), y.set(R.target, N);
      }
      k && Lt(e, c, "auto", i);
    }), S = () => {
      var v;
      f && clearTimeout(f), cancelAnimationFrame(u), w == null || w.disconnect(), e.classList.remove(to);
      for (const k of no) e.removeEventListener(k, S);
      ((v = r.current) == null ? void 0 : v.stop) === S && (r.current = null);
    }, b = () => {
      Lt(e, c, "auto", i);
      const v = e.scrollHeight;
      g = v === m ? g + 1 : 0, m = v;
      const k = performance.now() - h;
      g >= Pd && (v !== d || k > Md) || k > Ed ? S() : u = requestAnimationFrame(b);
    };
    for (const v of no) e.addEventListener(v, S, { passive: !0 });
    for (const v of Array.from(e.children)) w == null || w.observe(v);
    e.classList.add(to), r.current = { ...s, stop: S }, f = setTimeout(() => {
      f = null, h = performance.now(), d = e.scrollHeight, m = d, g = 0, u = requestAnimationFrame(b);
    }, ra);
  }, [e, t]), z(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Nd(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Re}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(ke) || null;
  }
  return null;
}
const no = ["wheel", "touchstart", "keydown", "pointerdown"];
function Ad(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function Ld(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(gn)) && ((n = e.hasAttribute) != null && n.call(e, ke)));
}
function xd(e, t) {
  z(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!Ld(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${gn}[${ke}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const c = Ad(a, i);
        if (c === null || Math.abs(i.scrollLeft - c) < 1) continue;
        const l = i.scrollLeft;
        i.scrollLeft = c, Math.abs(i.scrollLeft - l) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function Dd(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), c = t - i, l = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: c * l };
}
function Cd(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const ro = 12;
function sr(e) {
  return Array.from(e.querySelectorAll(`.${gn}[${ke}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function zd(e) {
  const t = e.getBoundingClientRect();
  return sr(e).map((n) => {
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
function Od(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function $d(e, t) {
  return e ? sr(e).find((n) => n.getAttribute(ke) === t) ?? null : null;
}
function Fd({ shellEl: e }) {
  const [t, n] = P([]), r = _(0), o = x(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = zd(e);
      n((i) => Od(i, s) ? i : s);
    }));
  }, [e]);
  z(() => {
    if (!e) return;
    o();
    const s = e.ownerDocument.defaultView;
    e.addEventListener("scroll", o, { capture: !0, passive: !0 });
    const i = s && typeof s.ResizeObserver < "u" ? new s.ResizeObserver(o) : null, c = () => {
      if (i) {
        i.disconnect(), i.observe(e);
        for (const f of sr(e))
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
  return a.length ? /* @__PURE__ */ p("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ p(Bd, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function Bd({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - ro * 2), r = Dd(e, n), o = _(null);
  if (!r) return null;
  const a = (d) => {
    const m = $d(t, e.pane);
    m && (m.scrollLeft = d);
  }, s = (d) => {
    var m, g;
    d.button === 0 && (d.preventDefault(), d.stopPropagation(), (g = (m = d.currentTarget).setPointerCapture) == null || g.call(m, d.pointerId), o.current = { startX: d.clientX, startScroll: e.scrollLeft, pointerId: d.pointerId });
  }, i = (d) => {
    const m = o.current;
    !m || m.pointerId !== d.pointerId || a(m.startScroll + Cd(e, n, r.size, d.clientX - m.startX));
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
      style: { left: e.left + ro, width: n },
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
function Na(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function jd(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function Hd({ compare: e, onDone: t }) {
  return /* @__PURE__ */ C("div", { className: "reader-version-compare-menu", role: "dialog", "aria-label": "选一份译文放在左边对照", children: [
    /* @__PURE__ */ p("p", { className: "reader-version-compare-hint", children: "选一份放在左边，和右边正在读的这份逐段对着看。" }),
    /* @__PURE__ */ p("ol", { className: "reader-version-compare-list", children: [...e.versions].reverse().map((n) => {
      var s;
      const r = n.versionId === e.readingVersionId, o = ((s = e.compared) == null ? void 0 : s.versionId) === n.versionId, a = e.loading === n.versionId;
      return /* @__PURE__ */ p("li", { children: /* @__PURE__ */ C(
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
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: Na(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(Bo, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(Ts, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
          ]
        }
      ) }, n.versionId);
    }) }),
    e.error ? /* @__PURE__ */ p("p", { className: "reader-version-compare-error", role: "alert", children: e.error }) : null,
    e.compared ? /* @__PURE__ */ C("div", { className: "reader-version-compare-actions", children: [
      /* @__PURE__ */ C(
        oe,
        {
          className: "reader-version-compare-adopt",
          title: "以后阅读就用左边这份（和书详情「译文版本」里选的一样）",
          onClick: () => {
            e.adopt(), t();
          },
          children: [
            /* @__PURE__ */ p(Rs, { size: 13, "aria-hidden": !0 }),
            "用左边这份"
          ]
        }
      ),
      /* @__PURE__ */ C(
        oe,
        {
          className: "reader-version-compare-close",
          title: "左栏换回原文",
          onClick: () => {
            e.clear(), t();
          },
          children: [
            /* @__PURE__ */ p(Es, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function oo({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = jd(t), a = [e === "compare" ? "对比" : "正在读", r, Na(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ C("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
    /* @__PURE__ */ p("em", { children: "RetainPDF" }),
    /* @__PURE__ */ p("strong", { children: o }),
    /* @__PURE__ */ p("span", { children: a })
  ] });
}
function Ud({
  shellEl: e,
  left: t,
  right: n
}) {
  const [r, o] = P({ source: null, translated: null });
  return Ee(() => {
    if (!e) return;
    const a = () => {
      const i = e.getBoundingClientRect(), c = (l) => {
        const u = e.querySelector(`[${ke}="${l}"]`), f = u == null ? void 0 : u.getBoundingClientRect();
        return f && f.width > 0 ? { x: Math.round(f.left + f.width / 2), top: Math.round(i.top + 14) } : null;
      };
      o({ source: c("source"), translated: c("translated") });
    };
    a();
    const s = typeof ResizeObserver > "u" ? null : new ResizeObserver(a);
    return s == null || s.observe(e), e.querySelectorAll(`[${ke}]`).forEach((i) => s == null ? void 0 : s.observe(i)), window.addEventListener("resize", a), e.addEventListener("scroll", a, { passive: !0 }), () => {
      s == null || s.disconnect(), window.removeEventListener("resize", a), e.removeEventListener("scroll", a);
    };
  }, [e]), /* @__PURE__ */ C("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(oo, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(oo, { role: "reading", ...n }) }) : null
  ] });
}
const Wd = () => () => {
}, ao = () => null;
function Kd({
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
function Vd(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function qd(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Jd(e) {
  const t = et(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), d = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Yt, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, w = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, b = (t == null ? void 0 : t.compareVersion) ?? null, v = (b == null ? void 0 : b.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", k = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", R = b ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, N = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, $ = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), O = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), A = t == null ? void 0 : t.onPdfOutline, I = t == null ? void 0 : t.onPdfDocument, T = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), E = e.regions ?? (t == null ? void 0 : t.regions) ?? [], L = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), D = (t == null ? void 0 : t.regionHover) ?? null, [U, M] = P(null), H = Co(
    D ? D.subscribe : Wd,
    D ? () => D.get().itemId : ao,
    D ? () => D.get().itemId : ao
  ), K = D ? H : U, Q = x((q) => {
    D ? D.set(q, "pdf") : M(q);
  }, [D]), te = Kd({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), V = Number.isFinite(g) && g > 0 ? Vd(
    g,
    n || r,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return _d(d, V), xd(d, te.compareMode), /* @__PURE__ */ C(
    "div",
    {
      ref: f,
      className: Zo,
      "data-reader-region-count": E.length,
      "data-reader-structured-region-count": E.filter(gs).length,
      "data-reader-metadata-ready": L ? "true" : "false",
      children: [
        /* @__PURE__ */ C(
          "main",
          {
            className: `${Xo} reader-mode-${te.mode}`,
            "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              y ? /* @__PURE__ */ p(
                eo,
                {
                  pane: "source",
                  url: v,
                  preloadedFile: R,
                  userZoom: m,
                  visible: te.showSource,
                  scrollRoot: d,
                  pageWidthOverride: V,
                  rowHeights: te.compareMode ? h : void 0,
                  onMetrics: $,
                  emptyLabel: S ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: O,
                  onOutline: b ? void 0 : A,
                  onDocument: b ? void 0 : I,
                  activeRegion: T,
                  regions: (b == null ? void 0 : b.regions) ?? E,
                  readerMetadata: L,
                  hoveredRegionId: K,
                  onHoverRegion: Q,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? qd(o) : "",
                  paneAction: u && te.showTranslated ? /* @__PURE__ */ C(yt, { children: [
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
                eo,
                {
                  pane: "translated",
                  url: k,
                  preloadedFile: N,
                  userZoom: m,
                  visible: te.showTranslated,
                  scrollRoot: d,
                  pageWidthOverride: V,
                  rowHeights: te.compareMode ? h : void 0,
                  onMetrics: $,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: O,
                  onOutline: A,
                  onDocument: I,
                  activeRegion: T,
                  regions: E,
                  readerMetadata: L,
                  hoveredRegionId: K,
                  onHoverRegion: Q,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ p(Fd, { shellEl: d }),
        b ? /* @__PURE__ */ p(Ud, { shellEl: d, left: b.left, right: b.right }) : null
      ]
    }
  );
}
const Gd = [
  { id: "source", label: "原文", Icon: Ho },
  { id: "compare", label: "对照", Icon: Uo },
  { id: "translated", label: "译文", Icon: Wo }
];
function Xd(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function Zd(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function Yd(e) {
  const t = et(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? Xd(a.state) : "";
  return /* @__PURE__ */ C("header", { className: "reader-workspace-bar", children: [
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
    /* @__PURE__ */ C("div", { className: "reader-workspace-center", children: [
      /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Gd.map(({ id: l, label: u, Icon: f }) => {
        const d = n === l, m = Zd({
          id: l,
          documentReady: r,
          sourceViewOnly: i,
          liveTranslationAvailable: !!a
        });
        return /* @__PURE__ */ C(
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
              /* @__PURE__ */ p(Ps, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: c })
            ]
          }
        ),
        a.latestPage && a.onJumpToLatest && a.latestPage !== a.currentPage ? /* @__PURE__ */ C(
          oe,
          {
            className: "reader-live-translation-toggle reader-live-jump",
            "aria-label": `跳到最新译好的第 ${a.latestPage} 页`,
            title: `跳到最新译好的第 ${a.latestPage} 页`,
            onClick: a.onJumpToLatest,
            children: [
              /* @__PURE__ */ p(Ms, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
              /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "跳到最新" })
            ]
          }
        ) : null
      ] }) : s ? /* @__PURE__ */ p("div", { className: "reader-live-strip", children: /* @__PURE__ */ C(
        oe,
        {
          className: "reader-live-translation-toggle is-done",
          title: "翻译完成，左右对照看最终译文",
          onClick: s.onOpenCompare,
          children: [
            /* @__PURE__ */ p(_s, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
          ]
        }
      ) }) : null
    ] })
  ] });
}
const Qd = Do(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
  return /* @__PURE__ */ C(
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
}), ef = Qd, tf = {
  markdown: { label: "Markdown", short: "MD", Icon: ef, needsJob: !0 }
}, nf = oa.map(
  (e) => ({ id: e, ...tf[e] })
);
function Aa() {
  return nf.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function rf(e) {
  const t = et(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(yt, { children: Aa().map(({ id: s, label: i, Icon: c, needsJob: l }) => {
    const u = n === s, f = l && r, d = u ? `收起${i}` : `打开${i}`;
    return /* @__PURE__ */ C(
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
function of(e) {
  const t = et(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = Aa().map(({ id: c, label: l, short: u, Icon: f, needsJob: d }) => ({
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
    /* @__PURE__ */ p("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: c, label: l, Icon: u, disabled: f, selected: d, badge: m, onClick: g }) => /* @__PURE__ */ C(
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
function af(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function sf(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function cf(e) {
  return e / 100 * window.innerHeight;
}
function lf(e) {
  return e / 100 * window.innerWidth;
}
function uf(e) {
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
  const [o, a] = uf(n);
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
      r = sf(t, o);
      break;
    }
    case "em": {
      r = af(t, o);
      break;
    }
    case "vh": {
      r = cf(o);
      break;
    }
    case "vw": {
      r = lf(o);
      break;
    }
  }
  return r;
}
function Te(e) {
  return parseFloat(e.toFixed(3));
}
function xt({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function Kn(e) {
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
      s = Te(u / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const u = Ut({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = Te(u / n * 100);
    }
    let c = 0;
    if (a.minSize !== void 0) {
      const u = Ut({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      c = Te(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = Ut({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      l = Te(u / n * 100);
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
function fe(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function Vn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? df : ff
  );
}
function df(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function ff(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function La(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function xa(e, t) {
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
    const { x: i, y: c } = xa(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return fe(o, "No rect found"), o;
}
let rn;
function hf() {
  return rn === void 0 && (typeof matchMedia == "function" ? rn = !!matchMedia("(pointer:coarse)").matches : rn = !1), rn;
}
function Da(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Vn(
    n,
    Array.from(t.children).filter(La).map((g) => ({ element: g }))
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
                  const R = m[0], N = mf({
                    orientation: n,
                    rects: [w, S],
                    targetRect: R.element.getBoundingClientRect()
                  });
                  b = [
                    R,
                    N === w ? k : v
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
              const R = hf() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (k.width < R) {
                const $ = R - k.width;
                k = new DOMRect(
                  k.x - $ / 2,
                  k.y,
                  k.width + $,
                  k.height
                );
              }
              if (k.height < R) {
                const $ = R - k.height;
                k = new DOMRect(
                  k.x,
                  k.y - $ / 2,
                  k.width,
                  k.height + $
                );
              }
              const N = g <= l || g > u;
              !i && !N && s.push({
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
class Ca {
  constructor() {
    Rr(this, at, {});
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
    Er(this, at, {});
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
let _t = {
  cursorFlags: 0,
  state: "inactive"
};
const ir = new Ca();
function pt() {
  return _t;
}
function pf(e) {
  return ir.addListener("change", e);
}
function gf(e) {
  const t = _t, n = { ..._t };
  n.cursorFlags = e, _t = n, ir.emit("change", {
    prev: t,
    next: n
  });
}
function Nt(e) {
  const t = _t;
  _t = e, ir.emit("change", {
    prev: t,
    next: e
  });
}
const bf = (e) => e, Pn = () => {
}, za = 1, Oa = 2, $a = 4, Fa = 8, so = 3, io = 12;
let on;
function co() {
  return on === void 0 && (on = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (on = !0)), on;
}
function yf({
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
        if (e && co()) {
          const a = (e & za) !== 0, s = (e & Oa) !== 0, i = (e & $a) !== 0, c = (e & Fa) !== 0;
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
    return co() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const lo = /* @__PURE__ */ new WeakMap();
function cr(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = lo.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = pt();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = yf({
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
  lo.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Ue = /* @__PURE__ */ new Map();
const Ba = new Ca();
function vf(e) {
  Ue = new Map(Ue), Ue.delete(e);
}
function uo(e, t) {
  for (const [n] of Ue)
    if (n.id === e)
      return n;
}
function ct(e, t) {
  for (const [n, r] of Ue)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function St() {
  return Ue;
}
function lr(e, t) {
  return Ba.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Ye(e, t, n) {
  const r = Ue.get(e);
  Ue = new Map(Ue), Ue.set(e, t), Ba.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function ja(e) {
  const t = pt();
  let n = !1;
  switch (t.state) {
    case "active":
      Nt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (cr(e), n = !0, t.hitRegions.forEach((r) => {
        const o = ct(r.group.id, !0);
        Ye(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function fo(e) {
  e.defaultPrevented || ja(e.currentTarget);
}
function wf(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = xa(n, a.rect);
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
function Sf(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function kf(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: po(e),
    b: po(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  fe(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: ho(mo(n.a)),
    b: ho(mo(n.b))
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
const If = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function Tf(e) {
  const t = getComputedStyle(Ha(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function Rf(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || Tf(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || If.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function mo(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (fe(n, "Missing node"), Rf(n)) return n;
  }
  return null;
}
function ho(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function po(e) {
  const t = [];
  for (; e; )
    t.push(e), e = Ha(e);
  return t;
}
function Ha(e) {
  const { parentNode: t } = e;
  return Sf(t) ? t.host : t;
}
function Ef(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Pf({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!La(n) || n.contains(e) || e.contains(n))
    return !0;
  if (kf(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Ef(r.getBoundingClientRect(), t))
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
    const a = Da(o), s = wf(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Pf({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function Mf(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function Se(e, t, n = 0) {
  return Math.abs(Te(e) - Te(t)) <= n;
}
function He(e, t) {
  return Se(e, t) ? 0 : e > t ? 1 : -1;
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
  if (He(r, c) < 0)
    if (a) {
      const l = (o + c) / 2;
      He(r, l) < 0 ? r = o : r = c;
    } else
      r = c;
  return r = Math.min(i, r), r = Te(r), r;
}
function Gt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (Se(e, 0))
    return t;
  const s = a === "imperative-api", i = Object.values(t), c = Object.values(o), l = [...i], [u, f] = r;
  fe(u != null, "Invalid first pivot index"), fe(f != null, "Invalid second pivot index");
  let d = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? f : u, y = n[h];
        fe(
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
          if (fe(
            v != null,
            `Previous layout not found for panel index ${h}`
          ), Se(v, w)) {
            const k = b - v;
            He(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      {
        const h = e < 0 ? u : f, y = n[h];
        fe(
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
          if (fe(
            v != null,
            `Previous layout not found for panel index ${h}`
          ), Se(v, b)) {
            const k = v - w;
            He(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? f : u, y = n[h];
      fe(
        y,
        `Panel constraints not found for index ${h}`
      );
      const w = i[h], { collapsible: S, collapsedSize: b, minSize: v } = y;
      if (S && He(w, v) < 0)
        if (e > 0) {
          const k = v - b, R = k / 2, N = w + e;
          He(N, v) < 0 && (e = He(e, R) <= 0 ? 0 : k);
        } else {
          const k = v - b, R = 100 - k / 2, N = w - e;
          He(N, v) < 0 && (e = He(100 + e, R) > 0 ? 0 : -k);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let y = e < 0 ? f : u, w = 0;
    for (; ; ) {
      const b = i[y];
      fe(
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
      fe(
        w != null,
        `Previous layout not found for panel index ${h}`
      );
      const S = w - y, b = Mt({
        overrideDisabledPanels: s,
        panelConstraints: n[h],
        prevSize: w,
        size: S
      });
      if (!Se(w, b) && (d += w - b, l[h] = b, d.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? h-- : h++;
    }
  }
  if (Mf(c, l))
    return o;
  {
    const h = e < 0 ? f : u, y = i[h];
    fe(
      y != null,
      `Previous layout not found for panel index ${h}`
    );
    const w = y + d, S = Mt({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: y,
      size: w
    });
    if (l[h] = S, !Se(S, w)) {
      let b = w - S, v = e < 0 ? f : u;
      for (; v >= 0 && v < n.length; ) {
        const k = l[v];
        fe(
          k != null,
          `Previous layout not found for panel index ${v}`
        );
        const R = k + b, N = Mt({
          overrideDisabledPanels: s,
          panelConstraints: n[v],
          prevSize: k,
          size: R
        });
        if (Se(k, N) || (b -= N - k, l[v] = N), Se(b, 0))
          break;
        e > 0 ? v-- : v++;
      }
    }
  }
  const m = Object.values(l).reduce(
    (h, y) => y + h,
    0
  );
  if (!Se(m, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return l.reduce((h, y, w) => (h[g[w]] = y, h), {});
}
function gt(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || He(e[n], t[n]) !== 0)
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
  if (!Se(o, 100) && r.length > 0)
    for (let i = 0; i < t.length; i++) {
      const c = r[i];
      fe(c != null, `No layout data found for index ${i}`);
      const l = 100 / o * c;
      r[i] = l;
    }
  let a = 0;
  for (let i = 0; i < t.length; i++) {
    const c = n[i];
    fe(c != null, `No layout data found for index ${i}`);
    const l = r[i];
    fe(l != null, `No layout data found for index ${i}`);
    const u = Mt({
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
      fe(c != null, `No layout data found for index ${i}`);
      const l = c + a, u = Mt({
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
function Ua({
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
      return (S == null ? void 0 : S.collapsible) && Se(S.collapsedSize, u[S.panelId]);
    }))) {
      const y = l.slice(0, m).reduce((w, S) => w + u[S.id], 0);
      return {
        ...u,
        [t]: Te(100 - y)
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
      return c && Se(l, u);
    },
    resize: (c) => {
      const { group: l } = n(), { element: u } = o(), f = xt({ group: l }), d = Ut({
        groupSize: f,
        panelElement: u,
        styleProp: c
      }), m = Te(d / f * 100);
      i(m);
    }
  };
}
function go(e) {
  if (e.defaultPrevented)
    return;
  const t = St();
  ur(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = Ua({
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
function Wa({
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
  fe(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  fe(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), i = Wa({ groupId: n.id }).getLayout(), c = Gt({
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
function bo(e) {
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
        fe(c, "Matching separator not found");
        const l = i.get(c);
        fe(l, "Matching panels not found");
        const u = l[0], f = a.find(
          (d) => d.panelId === u.id
        );
        if (fe(f, "Panel metadata not found"), f.collapsible) {
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
        fe(o !== null, "Index not found");
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
function yo(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = St(), n = ur(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), Nt({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function Ka({
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
      separatorToPanels: R
    } = w;
    if (b && k && R) {
      const N = Gt({
        delta: h,
        initialLayout: y,
        panelConstraints: b,
        pivotIndices: l.panels.map(($) => m.indexOf($)),
        prevLayout: k,
        trigger: "mouse-or-touch"
      });
      if (gt(N, k)) {
        if (h !== 0 && !g)
          switch (d) {
            case "horizontal": {
              i |= h < 0 ? za : Oa;
              break;
            }
            case "vertical": {
              i |= h < 0 ? $a : Fa;
              break;
            }
          }
      } else
        Ye(l.group, {
          defaultLayoutDeferred: S,
          derivedPanelConstraints: b,
          groupSize: v,
          layout: N,
          separatorToPanels: R
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & so : c |= i & so, t.movementY === 0 ? c |= s & io : c |= i & io, gf(c), cr(e);
}
function vo(e) {
  const t = St(), n = pt();
  switch (n.state) {
    case "active":
      Ka({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function wo(e) {
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
        Nt({
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
      Ka({
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
      a.length === 0 ? t.state !== "inactive" && Nt({
        cursorFlags: 0,
        state: "inactive"
      }) : Nt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), cr(e.currentTarget);
      break;
    }
  }
}
function So(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (pt().state) {
      case "hover":
        Nt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function ko(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || ja(e.currentTarget) && e.preventDefault();
}
function Io(e) {
  let t = 0, n = 0;
  const r = {};
  for (const a of e)
    if (a.defaultSize !== void 0) {
      t++;
      const s = Te(a.defaultSize);
      n += s, r[a.panelId] = s;
    } else
      r[a.panelId] = void 0;
  const o = e.length - t;
  if (o !== 0) {
    const a = Te((100 - n) / o);
    for (const s of e)
      s.defaultSize === void 0 && (r[s.panelId] = a);
  }
  return r;
}
function _f(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((c) => c.element === t);
  if (!r || !r.onResize)
    return;
  const o = xt({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: Te(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function Nf(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function Af({
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
        const m = d / 100 * n, g = Te(
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
      u[f] = Te(
        d / a * l
      );
    }
  else {
    const f = Te(
      l / c.length
    );
    for (const d of c)
      u[d] = f;
  }
  return u;
}
function Lf(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const Tt = /* @__PURE__ */ new Map();
function xf(e) {
  let t = !0;
  fe(
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
          const v = Kn(e), k = b.defaultLayoutDeferred ? Io(v) : b.layout, R = Af({
            group: e,
            nextGroupSize: S,
            prevGroupSize: b.groupSize,
            prevLayout: k
          }), N = bt({
            layout: R,
            panelConstraints: v
          });
          if (!b.defaultLayoutDeferred && gt(b.layout, N) && Nf(
            b.derivedPanelConstraints,
            v
          ) && b.groupSize === S)
            return;
          Ye(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: v,
            groupSize: S,
            layout: N,
            separatorToPanels: b.separatorToPanels
          });
        }
      } else
        _f(e, w, y);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    fe(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = xt({ group: e }), i = Kn(e), c = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (Lf(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[c] ?? l ?? Io(i), f = bt({
    layout: u,
    panelConstraints: i
  }), d = e.element.ownerDocument;
  Tt.set(
    d,
    (Tt.get(d) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return Da(e).forEach((g) => {
    g.separator && m.set(g.separator, g.panels);
  }), Ye(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: m
  }), e.separators.forEach((g) => {
    fe(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", bo);
  }), Tt.get(d) === 1 && (d.addEventListener("contextmenu", fo, !0), d.addEventListener("dblclick", go, !0), d.addEventListener("pointerdown", yo, !0), d.addEventListener("pointerleave", vo), d.addEventListener("pointermove", wo), d.addEventListener("pointerout", So), d.addEventListener("pointerup", ko, !0)), function() {
    t = !1, Tt.set(
      d,
      Math.max(0, (Tt.get(d) ?? 0) - 1)
    ), vf(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", bo);
    }), Tt.get(d) || (d.removeEventListener(
      "contextmenu",
      fo,
      !0
    ), d.removeEventListener(
      "dblclick",
      go,
      !0
    ), d.removeEventListener(
      "pointerdown",
      yo,
      !0
    ), d.removeEventListener("pointerleave", vo), d.removeEventListener("pointermove", wo), d.removeEventListener("pointerout", So), d.removeEventListener("pointerup", ko, !0)), a.disconnect();
  };
}
function Df() {
  const [e, t] = P({}), n = x(() => t({}), []);
  return [e, n];
}
function dr(e) {
  const t = zo();
  return `${e ?? t}`;
}
const kt = typeof window < "u" ? Ee : z;
function Kt(e) {
  const t = _(e);
  return kt(() => {
    t.current = e;
  }, [e]), x(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function fr(...e) {
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
function mr(e) {
  const t = _({ ...e });
  return kt(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const Va = Xn(null);
function Cf(e, t) {
  const n = _({
    getLayout: () => ({}),
    setLayout: bf
  });
  Yn(t, () => n.current, []), kt(() => {
    Object.assign(
      n.current,
      Wa({ groupId: e })
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
  const g = _({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), h = Kt((I) => {
    gt(g.current.onLayoutChange, I) || (g.current.onLayoutChange = I, c == null || c(I));
  }), y = Kt(
    (I, T) => {
      gt(g.current.onLayoutChanged, I) || (g.current.onLayoutChanged = I, l == null || l(I, { isUserInteraction: T }));
    }
  ), w = dr(i), S = _(null), [b, v] = Df(), k = _({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), R = fr(S, a);
  Cf(w, s);
  const N = Kt(
    (I, T) => {
      const E = pt(), L = uo(I), D = ct(I);
      if (D) {
        let U = !1;
        switch (E.state) {
          case "active": {
            U = E.hitRegions.some(
              (M) => M.group === L
            );
            break;
          }
        }
        return {
          flexGrow: D.layout[T] ?? 1,
          pointerEvents: U ? "none" : void 0
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
  }), O = Y(
    () => ({
      get disableCursor() {
        return !!$.disableCursor;
      },
      getPanelStyles: N,
      id: w,
      orientation: u,
      registerPanel: (I) => {
        const T = k.current;
        return T.panels = Vn(u, [
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
        return T.separators = Vn(u, [
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
          (U) => U.id === I
        );
        E && (E.panelConstraints.disabled = T);
        const L = uo(w), D = ct(w);
        L && D && Ye(L, {
          ...D,
          derivedPanelConstraints: Kn(L)
        });
      },
      updateSeparatorProps: (I, {
        disabled: T,
        disableDoubleClick: E
      }) => {
        const L = k.current.separators.find(
          (D) => D.id === I
        );
        L && (L.disabled = T, L.disableDoubleClick = E);
      }
    }),
    [N, w, v, u, $]
  ), A = _(null);
  return kt(() => {
    const I = S.current;
    if (I === null)
      return;
    const T = k.current;
    let E;
    if ($.defaultLayout !== void 0 && Object.keys($.defaultLayout).length === T.panels.length) {
      E = {};
      for (const Q of T.panels) {
        const te = $.defaultLayout[Q.id];
        te !== void 0 && (E[Q.id] = te);
      }
    }
    const L = {
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
    A.current = L;
    const D = xf(L), { defaultLayoutDeferred: U, derivedPanelConstraints: M, layout: H } = ct(L.id, !0);
    !U && M.length > 0 && (h(H), y(H, !1));
    const K = lr(w, (Q) => {
      const { defaultLayoutDeferred: te, derivedPanelConstraints: F, layout: V } = Q.next;
      if (te || F.length === 0)
        return;
      const q = L.panels.map(({ id: G }) => G).join(",");
      L.mutableState.layouts[q] = V, F.forEach((G) => {
        if (G.collapsible) {
          const { layout: J } = Q.prev ?? {};
          if (J) {
            const ce = Se(
              G.collapsedSize,
              V[G.panelId]
            ), ge = Se(
              G.collapsedSize,
              J[G.panelId]
            );
            ce && !ge && (L.mutableState.expandedPanelSizes[G.panelId] = J[G.panelId]);
          }
        }
      });
      const he = pt().state !== "active";
      h(V), he && y(V, Q.isUserInteraction);
    });
    return () => {
      A.current = null, D(), K();
    };
  }, [
    o,
    w,
    y,
    h,
    u,
    b,
    $
  ]), z(() => {
    const I = A.current;
    I && (I.mutableState.defaultLayout = n, I.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p(Va.Provider, { value: O, children: /* @__PURE__ */ p(
    "div",
    {
      ...m,
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
qa.displayName = "Group";
function hr() {
  const e = Zn(Va);
  return fe(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function zf(e, t) {
  const { id: n } = hr(), r = _({
    collapse: Pn,
    expand: Pn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Pn
  });
  Yn(t, () => r.current, []), kt(() => {
    Object.assign(
      r.current,
      Ua({ groupId: n, panelId: e })
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
  onResize: f,
  panelRef: d,
  style: m,
  ...g
}) {
  const h = !!c, y = dr(c), w = mr({
    disabled: a
  }), S = _(null), b = fr(S, s), {
    getPanelStyles: v,
    id: k,
    orientation: R,
    registerPanel: N,
    updatePanelProps: $
  } = hr(), O = f !== null, A = Kt(
    (L, D, U) => {
      f == null || f(L, c, U);
    }
  );
  kt(() => {
    const L = S.current;
    if (L !== null) {
      const D = {
        element: L,
        id: y,
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
      return N(D);
    }
  }, [
    i,
    n,
    r,
    o,
    O,
    y,
    h,
    l,
    u,
    A,
    N,
    w
  ]), z(() => {
    $(y, { disabled: a });
  }, [a, y, $]), zf(y, d);
  const I = () => {
    const L = v(k, y);
    if (L)
      return JSON.stringify(L);
  }, T = Co(
    (L) => lr(k, L),
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
        ...Of,
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
            touchAction: R === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
qn.displayName = "Panel";
const Of = {
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
function $f({
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
function Ja({
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
  }), [u, f] = P({}), [d, m] = P("inactive"), [g, h] = P(!1), y = _(null), w = fr(y, o), {
    disableCursor: S,
    id: b,
    orientation: v,
    registerSeparator: k,
    updateSeparatorProps: R
  } = hr(), N = v === "horizontal" ? "vertical" : "horizontal";
  kt(() => {
    const A = y.current;
    if (A !== null) {
      const I = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: A,
        id: c
      }, T = k(I), E = pf(
        (D) => {
          m(
            D.next.state !== "inactive" && D.next.hitRegions.some(
              (U) => U.separator === I
            ) ? D.next.state : "inactive"
          );
        }
      ), L = lr(
        b,
        (D) => {
          const { derivedPanelConstraints: U, layout: M, separatorToPanels: H } = D.next, K = H.get(I);
          if (K) {
            const Q = K[0], te = K.indexOf(Q);
            f(
              $f({
                layout: M,
                panelConstraints: U,
                panelId: Q.id,
                panelIndex: te
              })
            );
          }
        }
      );
      return () => {
        E(), L(), T();
      };
    }
  }, [b, c, k, l]), z(() => {
    R(c, { disabled: n, disableDoubleClick: r });
  }, [n, r, c, R]);
  let $;
  n && !S && ($ = "not-allowed");
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
        g ? O = "focus" : O = d;
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
Ja.displayName = "Separator";
const pr = 30, gr = 65, Xt = 50, Ff = 100 - gr, Bf = 100 - pr;
function jf(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(gr, Math.max(pr, t)) : Xt;
}
function br(e) {
  return 100 - e;
}
function Rt(e) {
  return `${e}%`;
}
const yr = "reader-document", Zt = "reader-assistant", Ga = "retainpdf.reader.ai-split-layout.v1", Hf = {
  [yr]: br(Xt),
  [Zt]: Xt
};
function vr(e) {
  const t = jf(e == null ? void 0 : e[Zt]);
  return {
    [yr]: br(t),
    [Zt]: t
  };
}
function Uf() {
  try {
    const e = JSON.parse(localStorage.getItem(Ga) || "null");
    return vr(e);
  } catch {
    return Hf;
  }
}
function Wf(e) {
  try {
    localStorage.setItem(Ga, JSON.stringify(vr(e)));
  } catch {
  }
}
function Mn(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = vr(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[Zt]}vw`
  );
}
function Kf() {
  const e = _(null), [t] = P(Uf);
  Ee(() => {
    const o = e.current;
    return Mn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = x((o) => {
    Mn(e.current, o);
  }, []), r = x((o, a) => {
    Mn(e.current, o), a.isUserInteraction && Wf(o);
  }, []);
  return /* @__PURE__ */ C(
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
            id: yr,
            defaultSize: Rt(br(Xt)),
            minSize: Rt(Ff),
            maxSize: Rt(Bf)
          }
        ),
        /* @__PURE__ */ p(
          Ja,
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
            id: Zt,
            defaultSize: Rt(Xt),
            minSize: Rt(pr),
            maxSize: Rt(gr)
          }
        )
      ]
    }
  );
}
function Vf({
  regionsFailed: e = !1,
  metadataFailed: t = !1,
  onRetry: n
}) {
  const [r, o] = P(!1);
  if (z(() => {
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
function qf({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(Vf, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ C(yt, { children: [
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
      s ? /* @__PURE__ */ p(oe, { className: "reader-react-error-retry", "data-reader-retry": "boot", onClick: s, children: "重试" }) : null
    ] }) : null
  ] });
}
function Jf(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Gf() {
  const [e, t] = P(!1), n = zo(), r = _(null);
  return z(() => {
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
  }, [e]), z(() => {
    const o = (a) => {
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || Jf(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((i) => !i);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
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
        onClick: () => t((o) => !o),
        children: /* @__PURE__ */ p(Ns, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
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
          /* @__PURE__ */ p("div", { className: "reader-react-shortcuts-body", children: gl.map((o) => /* @__PURE__ */ C("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ p("h3", { children: o.title }),
            /* @__PURE__ */ p("ul", { children: o.items.map((a) => /* @__PURE__ */ C("li", { children: [
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
const Xf = ["source", "sideBySide", "translated"], Zf = { source: "", translated: "", sideBySide: "" };
function Yf(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = sn(e.sourceUrl), n = sn(e.translatedUrl);
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
function Qf(e) {
  const [t, n] = P(() => /* @__PURE__ */ new Set()), r = Y(
    () => e ? Yf(e) : Zf,
    [e]
  ), o = Y(
    () => Xf.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = x(async (s) => {
    if (!e) return;
    const i = sn(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? ii(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await li(
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
        ui(l), n((u) => {
          const f = new Set(u);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const em = {
  source: Ho,
  sideBySide: Uo,
  translated: Wo
}, tm = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function nm(e) {
  const t = et(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Qf(n), i = _(null);
  return z(() => {
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
      /* @__PURE__ */ p(As, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ p(jo, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = cs[c], u = sn(r[c]), f = a.has(c), d = !!u && !f, m = d ? "" : ls(c, r), g = em[c];
      return /* @__PURE__ */ C(
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
            /* @__PURE__ */ C("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ C("span", { className: "reader-download-action-label", children: [
                tm[c],
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
const rm = "retainpdf:reader:bookmarks:v1:", om = 200;
function wr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Xa(e) {
  const t = `${e || ""}`.trim();
  return t ? `${rm}${t}` : "";
}
function am(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function hn(e, t = wr()) {
  const n = Xa(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = am(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function Jn(e, t, n) {
  const r = Xa(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, om);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function sm(e, t, n = "", { storage: r = wr(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = hn(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? Jn(e, a.filter((i) => i.page !== s), r) : Jn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function im(e, t, n = wr()) {
  return Jn(e, hn(e, n).filter((r) => r.page !== t), n);
}
function cm(e, t) {
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
function lm({ filled: e }) {
  return /* @__PURE__ */ p("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ p("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function um({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = P(() => hn(e)), [i, c] = P(!1), l = _(null);
  if (z(() => {
    s(hn(e)), c(!1);
  }, [e]), z(() => {
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
  return /* @__PURE__ */ C("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: l, children: [
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${f ? " is-marked" : ""}`,
        "aria-pressed": f,
        "aria-label": f ? `取消第 ${u} 页的书签` : `给第 ${u} 页加书签`,
        title: f ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(sm(e, u, cm(r, u))),
        children: /* @__PURE__ */ p(lm, { filled: f })
      }
    ),
    a.length ? /* @__PURE__ */ C(
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
          /* @__PURE__ */ p(Ls, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { className: "reader-bookmark-count", children: a.length })
        ]
      }
    ) : null,
    i && a.length ? /* @__PURE__ */ p("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ p("ol", { className: "reader-bookmark-list", children: a.map((d) => /* @__PURE__ */ C("li", { className: d.page === u ? "is-current" : "", children: [
      /* @__PURE__ */ C(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(d.page, n)), c(!1);
          },
          children: [
            /* @__PURE__ */ C("span", { className: "reader-bookmark-page", children: [
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
          onClick: () => s(im(e, d.page)),
          children: "×"
        }
      )
    ] }, d.page)) }) }) : null
  ] });
}
function dm(e) {
  const [t, n] = P([]);
  return z(() => {
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
function fm(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const mm = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, hm = ["failed", "content", "layout"];
function pm(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function gm({ jobId: e, currentPage: t }) {
  var f;
  const n = dm(e), r = (f = et()) == null ? void 0 : f.jumpToBlock, [o, a] = P(!1), [s, i] = P(-1), c = _(null);
  z(() => i(-1), [n]);
  const l = (d) => {
    const m = n[d];
    !m || !r || (i(d), r(m.readerItemId));
  }, u = _({ issues: n, last: s, currentPage: t, goTo: l });
  return u.current = { issues: n, last: s, currentPage: t, goTo: l }, z(() => {
    const d = (m) => {
      if (m.key.toLowerCase() !== "n" || m.metaKey || m.ctrlKey || m.altKey || pm(m.target)) return;
      const { issues: g, last: h, currentPage: y, goTo: w } = u.current, S = fm(g, h, y, m.shiftKey);
      S < 0 || (m.preventDefault(), w(S));
    };
    return document.addEventListener("keydown", d), () => document.removeEventListener("keydown", d);
  }, []), z(() => {
    if (!o) return;
    const d = (m) => {
      var g;
      (g = c.current) != null && g.contains(m.target) || a(!1);
    };
    return document.addEventListener("pointerdown", d, !0), () => document.removeEventListener("pointerdown", d, !0);
  }, [o]), n.length ? /* @__PURE__ */ C("div", { className: "reader-react-hud-group reader-issues", ref: c, "aria-label": "待处理", children: [
    /* @__PURE__ */ C(
      oe,
      {
        className: "reader-react-hud-btn reader-issues-toggle",
        "aria-expanded": o,
        "aria-haspopup": "true",
        "aria-label": `待处理 ${n.length} 处`,
        title: "这次翻译里要人看一眼的段落（N 下一处，Shift+N 上一处）",
        onClick: () => a((d) => !d),
        children: [
          /* @__PURE__ */ p(xs, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { children: n.length })
        ]
      }
    ),
    o ? /* @__PURE__ */ C("div", { className: "reader-issues-popover", role: "dialog", "aria-label": "待处理", children: [
      /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
      hm.map((d) => {
        const m = n.map((g, h) => ({ issue: g, index: h })).filter(({ issue: g }) => g.kind === d);
        return m.length ? /* @__PURE__ */ C("section", { className: "reader-issues-group", "data-issue-kind": d, children: [
          /* @__PURE__ */ C("h4", { children: [
            mm[d],
            /* @__PURE__ */ p("span", { children: m.length })
          ] }),
          /* @__PURE__ */ p("ol", { children: m.map(({ issue: g, index: h }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ C(
            oe,
            {
              className: "reader-issues-item",
              "aria-current": h === s ? "true" : void 0,
              onClick: () => {
                l(h), a(!1);
              },
              children: [
                /* @__PURE__ */ p("span", { className: "reader-issues-title", children: g.title }),
                /* @__PURE__ */ C("span", { className: "reader-issues-page", children: [
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
const bm = 48, ym = 96, vm = 700;
function wm(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= bm, downSoFar: r };
}
function Sm(e) {
  const [t, n] = P(!1), r = _(0);
  return z(() => {
    const o = /* @__PURE__ */ new WeakMap();
    let a = 0;
    const s = () => {
      a = Date.now();
    }, i = /* @__PURE__ */ new WeakMap(), c = () => {
      const d = e.current;
      return !!(d && (d.querySelector(":focus-visible") || d.querySelector("[aria-expanded='true']")));
    }, l = (d) => {
      const m = d.target;
      if (!(m instanceof Element) || (i.has(m) || i.set(m, !!m.querySelector(`[${Re}]`)), !i.get(m))) return;
      const g = m.scrollTop, h = o.get(m);
      if (o.set(m, g), h === void 0 || Date.now() - a > vm) return;
      const y = wm(!1, r.current, g - h);
      r.current = y.downSoFar, g - h < -4 ? n(!1) : y.hidden && !c() && n(!0);
    }, u = (d) => {
      d.clientY >= window.innerHeight - ym && (r.current = 0, n(!1));
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
function km(e) {
  const t = et(), n = Ma(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Yt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = Zi(a), f = a > Qo + 1e-3, d = a < fn - 1e-3, m = Pt(r, it()), g = m >= fn ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", h = _(null), y = Sm(h), [w, S] = P(!1), [b, v] = P(`${i}`);
  z(() => {
    w || v(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, w]);
  const k = () => {
    if (S(!1), !l || c <= 0)
      return;
    const R = Number(`${b}`.trim());
    l(mn(R, c));
  };
  return /* @__PURE__ */ C("div", { ref: h, className: "reader-react-hud", "data-reader-hud": "true", "data-hud-hidden": y ? "true" : void 0, children: [
    o ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "页码", children: w ? /* @__PURE__ */ C(
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
                R.key === "Escape" && (R.preventDefault(), S(!1), v(`${i}`));
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
          !l || c <= 0 || (v(`${i}`), S(!0));
        },
        children: c > 0 ? `${Math.min(i, c)} / ${c}` : "—"
      }
    ) }),
    e.searchSlot ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "搜索", children: e.searchSlot }) : null,
    e.bookmarkScope ? /* @__PURE__ */ p(
      um,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: c,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
      }
    ) : null,
    e.issuesJobId ? /* @__PURE__ */ p(gm, { jobId: e.issuesJobId, currentPage: i }) : null,
    t != null && t.toggleDocDark ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "显示", children: /* @__PURE__ */ p(
      oe,
      {
        className: "reader-react-hud-btn reader-react-hud-doc-dark",
        "aria-pressed": t.docDark ? "true" : "false",
        "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
        title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
        onClick: t.toggleDocDark,
        children: /* @__PURE__ */ p(Im, {})
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
          onClick: () => s(Jt(a, -1)),
          children: "−"
        }
      ),
      /* @__PURE__ */ C(
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
          onClick: () => s(Jt(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p(Gf, {}) })
  ] });
}
function Im() {
  return /* @__PURE__ */ C("svg", { width: "14", height: "14", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: [
    /* @__PURE__ */ p("circle", { cx: "8", cy: "8", r: "6.25", fill: "none", stroke: "currentColor", strokeWidth: "1.5" }),
    /* @__PURE__ */ p("path", { d: "M8 1.75a6.25 6.25 0 0 1 0 12.5z", fill: "currentColor" })
  ] });
}
function To(e) {
  var t, n;
  return aa(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function Tm(e) {
  const [t, n] = P(() => ({
    scope: e,
    panel: To(We(e))
  }));
  z(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: To(We(e))
    });
  }, [e]), z(() => {
    t.scope === e && bn(t.scope, {
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
const Gn = "download-toast";
function Rm({
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
function Em(e = {}) {
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
    () => /* @__PURE__ */ p(Rm, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: Gn, duration: 1 / 0 }
  );
}
function Pm() {
  const e = x((t) => {
    t && (t.setState = Em, t.hide = () => xn.dismiss(Gn));
  }, []);
  return /* @__PURE__ */ C(yt, { children: [
    /* @__PURE__ */ p(qs, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function Mm(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : ta(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function _m(e, t) {
  return t === null || e !== t;
}
function Nm(e) {
  const t = _(!1);
  return e && (t.current = !0), t.current;
}
function Am(e, t) {
  const n = e === t;
  return { open: n, mounted: Nm(n) };
}
const Ro = { itemId: null, origin: null };
function Lm() {
  let e = Ro;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? Ro : { itemId: n, origin: r };
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
function xm({
  nodes: e,
  currentPage: t,
  onJumpPage: n
}) {
  const r = Y(() => ga(e, t), [e, t]), [o, a] = P(() => /* @__PURE__ */ new Set([...jr(r), ...r ? [r] : []]));
  z(() => {
    a(/* @__PURE__ */ new Set([...jr(r), ...r ? [r] : []]));
  }, [e]);
  const s = _(null);
  z(() => {
    var l, u;
    (u = (l = s.current) == null ? void 0 : l.querySelector('[aria-current="location"]')) == null || u.scrollIntoView({ block: "center" });
  }, [e]);
  const i = (l) => a((u) => {
    const f = new Set(u);
    return f.has(l) ? f.delete(l) : f.add(l), f;
  }), c = (l) => l.map((u) => {
    const f = o.has(u.id), d = u.children.length > 0;
    return /* @__PURE__ */ C("li", { className: "reader-bookmark", "data-level": u.level, children: [
      /* @__PURE__ */ C("div", { className: "reader-bookmark-row", children: [
        d ? /* @__PURE__ */ p(
          oe,
          {
            className: `reader-bookmark-toggle${f ? " is-open" : ""}`,
            "aria-label": f ? `收起「${u.title}」` : `展开「${u.title}」`,
            "aria-expanded": f,
            onClick: () => i(u.id),
            children: /* @__PURE__ */ p(Ko, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 })
          }
        ) : /* @__PURE__ */ p("span", { className: "reader-bookmark-spacer", "aria-hidden": "true" }),
        /* @__PURE__ */ C(
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
      d && f ? /* @__PURE__ */ p("ol", { className: "reader-bookmark-children", children: c(u.children) }) : null
    ] }, u.id);
  });
  return /* @__PURE__ */ p("ol", { ref: s, className: "reader-finder-list reader-bookmark-tree", "aria-label": "书签", children: c(e) });
}
const Dm = [], Cm = [];
function zm({
  open: e,
  onToggle: t,
  children: n
}) {
  return /* @__PURE__ */ C("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ p(oe, { className: "reader-finder-toggle", "aria-label": "目录", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: /* @__PURE__ */ p(Ds, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }) }),
    n
  ] });
}
function Om({ open: e, onToggle: t }) {
  return /* @__PURE__ */ p(
    oe,
    {
      className: "reader-react-hud-btn reader-search-toggle",
      "data-finder-toggle": "search",
      "aria-label": "在书里搜索",
      "aria-pressed": e === "search",
      title: "在书里搜索（原文和译文，⌘F）",
      onClick: () => t("search"),
      children: /* @__PURE__ */ p(Cs, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 })
    }
  );
}
function $m({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0,
  bookmarks: c = Cm,
  onJumpPage: l
}) {
  var A, I;
  const u = ((A = et()) == null ? void 0 : A.regions) ?? Dm, f = ((I = Ma()) == null ? void 0 : I.currentPage) ?? 1, d = Y(() => Hl(u), [u]), m = c.length > 0 && !!l, [g, h] = P("bookmarks"), y = m && (g === "bookmarks" || !d.length), w = Ul(d, f), S = Y(() => Vl(u, s), [u, s]), [b, v] = P(-1);
  z(() => v(-1), [s]);
  const k = _(null), R = _(null), N = _(n);
  N.current = n, z(() => {
    const T = (L) => {
      var U, M;
      const D = L.target;
      !D || (U = R.current) != null && U.contains(D) || (M = D.closest) != null && M.call(D, ".reader-finder-toggles, [data-finder-toggle]") || N.current();
    }, E = (L) => {
      L.key === "Escape" && N.current();
    };
    return document.addEventListener("pointerdown", T, !0), document.addEventListener("keydown", E), () => {
      document.removeEventListener("pointerdown", T, !0), document.removeEventListener("keydown", E);
    };
  }, []);
  const $ = _(null);
  z(() => {
    var T, E, L;
    e === "search" ? (T = k.current) == null || T.focus() : (L = (E = $.current) == null ? void 0 : E.querySelector('[aria-current="location"]')) == null || L.scrollIntoView({ block: "center" });
  }, [e, i]), z(() => {
    var T, E;
    e === "search" && b >= 0 && ((E = (T = $.current) == null ? void 0 : T.querySelector('[aria-current="true"]')) == null || E.scrollIntoView({ block: "nearest" }));
  }, [e, b]);
  const O = (T) => {
    const E = S[T];
    E && (v(T), r(E.itemId));
  };
  return /* @__PURE__ */ C("aside", { ref: R, className: "reader-finder", "data-finder-tab": e, "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ C("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ C("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ p(oe, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ p(oe, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ p(oe, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(wt, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" && m && d.length ? /* @__PURE__ */ C("div", { className: "reader-finder-switch", role: "radiogroup", "aria-label": "目录按什么列", children: [
      /* @__PURE__ */ p(oe, { className: "reader-finder-switch-option", role: "radio", "aria-checked": y, onClick: () => h("bookmarks"), children: "按书签" }),
      /* @__PURE__ */ p(oe, { className: "reader-finder-switch-option", role: "radio", "aria-checked": !y, onClick: () => h("headings"), children: "按标题" })
    ] }) : null,
    e === "outline" && y && l ? /* @__PURE__ */ p(xm, { nodes: c, currentPage: f, onJumpPage: l }) : e === "outline" ? d.length ? /* @__PURE__ */ p("ol", { ref: $, className: "reader-finder-list", children: d.map((T, E) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ C(
      oe,
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
    ) }, T.itemId)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: u.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ C(yt, { children: [
      /* @__PURE__ */ C("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          Vo,
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
              T.key === "Enter" ? (T.preventDefault(), O(ql(b, S.length, T.shiftKey))) : T.key === "Escape" && (T.preventDefault(), n()), T.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: S.length === 0 ? "没有找到" : `${b >= 0 ? `第 ${b + 1} / ` : ""}${S.length >= 200 ? "200+ 处，只列前 200 处" : `${S.length} 处`}${b < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { className: "reader-finder-list", children: S.map((T, E) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ C(oe, { className: "reader-finder-entry is-hit", "aria-current": E === b ? "true" : void 0, onClick: () => O(E), children: [
        /* @__PURE__ */ C("span", { className: "reader-finder-entry-text", children: [
          T.snippet.slice(0, T.at),
          /* @__PURE__ */ p("mark", { children: T.snippet.slice(T.at, T.at + T.length) }),
          T.snippet.slice(T.at + T.length)
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: T.page })
      ] }) }, T.itemId)) })
    ] })
  ] });
}
function Fm({ active: e, compare: t, ink: n }) {
  const [r, o] = P(!1), [a, s] = P(!1), i = _(null);
  z(() => {
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
  return /* @__PURE__ */ C("div", { className: "reader-toolball", ref: i, "data-open": r ? "true" : void 0, children: [
    a ? /* @__PURE__ */ p(Hd, { compare: t, onDone: () => {
      s(!1), o(!1);
    } }) : null,
    r ? /* @__PURE__ */ C("div", { className: "reader-toolball-stack", role: "group", "aria-label": "工具", children: [
      n ? /* @__PURE__ */ p(
        oe,
        {
          className: "reader-toolball-item",
          "aria-label": "画笔",
          title: "画笔（P；书页上右键也能选笔和颜色）",
          "aria-pressed": !!n.tool,
          "data-toolball-item": "ink",
          onClick: () => {
            n.setTool(n.tool ? null : "pen"), o(!1);
          },
          children: /* @__PURE__ */ p(Qn, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null,
      /* @__PURE__ */ p(rf, { active: e }),
      t.available ? /* @__PURE__ */ p(
        oe,
        {
          className: "reader-toolball-item",
          "aria-label": "对比版本",
          title: "对比版本：左边换成这本书的另一份译文",
          "aria-pressed": c || a,
          "data-toolball-item": "compare",
          onClick: () => s((l) => !l),
          children: /* @__PURE__ */ p(zs, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null
    ] }) : null,
    /* @__PURE__ */ p(
      oe,
      {
        className: "reader-toolball-ball",
        "aria-label": r ? "收起工具" : "工具：画笔、Markdown、对比版本",
        title: r ? "收起" : "工具",
        "aria-expanded": r,
        "data-active": e || c ? "true" : void 0,
        onClick: () => {
          o((l) => !l), s(!1);
        },
        children: r ? /* @__PURE__ */ p(wt, { size: 20, strokeWidth: 2.2, "aria-hidden": !0 }) : /* @__PURE__ */ p(Os, { size: 20, strokeWidth: 2.1, "aria-hidden": !0 })
      }
    )
  ] });
}
const Bm = [
  { tool: "pen", label: "画笔", Icon: Qn },
  { tool: "highlighter", label: "荧光笔", Icon: $s },
  { tool: "eraser", label: "橡皮", Icon: Fs }
];
function Za(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Ya({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ C(yt, { children: [
    Bm.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
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
    Ia.map((o) => /* @__PURE__ */ p(
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
    /* @__PURE__ */ p(oe, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(Bs, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      oe,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p(js, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
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
        children: /* @__PURE__ */ p(wt, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function jm({
  ink: e,
  menu: t,
  onClose: n,
  actions: r = []
}) {
  const o = _(null);
  if (z(() => {
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
  return /* @__PURE__ */ C("div", { ref: o, className: "reader-ink-menu", style: { left: s, top: i }, "data-ink-menu": "true", children: [
    r.length ? /* @__PURE__ */ p("div", { className: "reader-ink-menu-actions", role: "menu", "aria-label": "书页", children: r.map((c) => /* @__PURE__ */ C(
      oe,
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
    /* @__PURE__ */ p("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ p(Ya, { ink: e, page: t.page, onPick: n }) })
  ] });
}
function Hm({ ink: e }) {
  return e.tool ? /* @__PURE__ */ p("div", { className: "reader-ink-bar is-dock", role: "toolbar", "aria-label": "画笔", "data-ink-dock": "true", children: /* @__PURE__ */ p(Ya, { ink: e }) }) : null;
}
function Um(e) {
  var r;
  if (e.shiftKey || Za(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${Zo}`))) return null;
  const n = Number((r = t.closest(`[${Re}]`)) == null ? void 0 : r.getAttribute(Re)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Wm(e) {
  const t = _(e);
  t.current = e, z(() => {
    const n = (r) => {
      if (Za(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
function _n() {
  try {
    return Qe().translationVersions ?? null;
  } catch {
    return null;
  }
}
function Km(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function Vm(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function qm(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function Jm({ documentId: e, jobId: t }) {
  const [n, r] = P([]), [o, a] = P(null), [s, i] = P(null), [c, l] = P(""), [u, f] = P(""), d = _(0);
  z(() => {
    r([]), i(null), f("");
    const y = _n();
    if (!y || !e) return;
    let w = !1;
    return y.list(e).then((S) => {
      w || (r(S.versions), a(S.currentVersionId));
    }).catch(() => {
    }), () => {
      w = !0;
    };
  }, [e, t]);
  const m = x((y) => {
    const w = _n(), S = n.find((v) => v.versionId === y);
    if (!w || !S || !e) return;
    const b = ++d.current;
    l(y), f(""), (async () => {
      const v = Qe(), k = await w.resolveJob(e, y);
      if (!k) throw new Error("这一份还没有能读的译文。");
      const R = await v.loadReaderPayload(k, { includeOptionalArtifacts: !0 }), N = v.resolveReaderTranslatedPdfUrl(R.jobPayload, R.manifestPayload);
      if (!N) throw new Error("这一份没有译文 PDF。");
      return { versionId: y, name: S.name, jobId: k, url: N, regions: Km(Fo(R.regionsPayload)) };
    })().then((v) => {
      b === d.current && i(v);
    }).catch((v) => {
      b === d.current && f((v == null ? void 0 : v.message) || "这一份打不开。");
    }).finally(() => {
      b === d.current && l("");
    });
  }, [e, n]), g = x(() => {
    d.current += 1, i(null), l(""), f("");
  }, []), h = x(async () => {
    var S, b;
    const y = _n();
    if (!y || !s || !e) return;
    try {
      await y.select(e, s.versionId);
    } catch (v) {
      f((v == null ? void 0 : v.message) || "换不过去，请稍后再试。");
      return;
    }
    const w = (S = globalThis.location) == null ? void 0 : S.href;
    w && ((b = globalThis.history) == null || b.replaceState(globalThis.history.state, "", qm(w, s.jobId))), i(null);
  }, [s, e]);
  return {
    available: n.length >= 2,
    versions: n,
    readingVersionId: Vm(n, t, o),
    compared: s,
    loading: c,
    error: u,
    choose: m,
    clear: g,
    adopt: h
  };
}
const Gm = "reader-finder-input";
function Xm(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function Zm(e, t = typeof window > "u" ? null : window) {
  z(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!Xm(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(Gm) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function Ym() {
  try {
    return Qe().translationEdit ?? null;
  } catch {
    return null;
  }
}
const Qm = "这本书正在处理（翻译或排版），处理完才能改。", eh = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function th({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = Ym(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = su(s), l = !t || Vt(t), u = fu(n), [f, d] = P(""), [m, g] = P(null), [h, y] = P(() => /* @__PURE__ */ new Map()), [w, S] = P(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [b, v] = P(() => /* @__PURE__ */ new Map()), [k, R] = P({ phase: "idle" }), N = _({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  z(() => {
    g(null), N.drafts.clear(), N.generation.current = null, v(/* @__PURE__ */ new Map()), R({ phase: "idle" });
  }, [s]), z(() => {
    if (d(""), !i || c || !a) return;
    let D = !1;
    return a.resolveOwnerJobId(s).then((U) => {
      D || d(`${U || s}`.trim() || s);
    }).catch(() => {
      D || d(s);
    }), () => {
      D = !0;
    };
  }, [i, c, a, s]), z(() => {
    if (y(/* @__PURE__ */ new Map()), !a || !f || !u || !l) return;
    let D = !1;
    return a.fetchRevisions(f).then((U) => {
      D || y(mu(U, u));
    }).catch(() => {
    }), () => {
      D = !0;
    };
  }, [a, f, u, l]);
  const $ = k.phase === "running" && k.seenActive;
  z(() => {
    if (k.phase === "running") {
      if (!l) {
        $ || R({ phase: "running", seenActive: !0 });
        return;
      }
      $ && R(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [k.phase, $, l, t]);
  const O = Y(() => {
    const D = new Map(h);
    if (w.renderedAt === u)
      for (const [U, M] of w.edits) D.set(U, M);
    return D;
  }, [h, w, u]), A = x((D) => {
    const U = `${D || ""}`.trim();
    U && g({ itemId: U, page: iu(U) });
  }, []), I = x(() => g(null), []), T = x((D, U) => {
    S((M) => {
      const H = new Map(M.renderedAt === u ? M.edits : []);
      return H.set(D, U), { renderedAt: u, edits: H };
    }), v((M) => new Map(M).set(D, (M.get(D) || 0) + 1));
  }, [u]), E = x(async () => {
    if (!(!a || !s || k.phase === "submitting" || k.phase === "running")) {
      R({ phase: "submitting" });
      try {
        await a.rerender(s), R({ phase: "running", seenActive: !1 }), await o();
      } catch (D) {
        R({ phase: "failed", message: (D == null ? void 0 : D.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, k.phase, o]), L = c ? eh : !l || k.phase === "running" || k.phase === "submitting" ? Qm : "";
  return Y(() => ({
    available: i,
    blockedReason: L,
    port: a,
    ownerJobId: f,
    target: m,
    select: A,
    close: I,
    memory: N,
    pendingEdits: O,
    savedCounts: b,
    markSaved: T,
    rerender: k,
    startRerender: E
  }), [i, L, a, f, m, A, I, N, O, b, T, k, E]);
}
function nh(e, t) {
  z(() => {
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
function rh({ edit: e }) {
  const t = e.pendingEdits.size, { rerender: n } = e;
  return n.phase === "running" || n.phase === "submitting" ? /* @__PURE__ */ p("div", { className: "reader-pending-edits is-running", role: "status", "data-block-edit-rerender": "running", children: "正在重新排版，排完译文 PDF 会自动换成新的（大书要几分钟）。" }) : !t && n.phase !== "failed" ? null : /* @__PURE__ */ C("div", { className: "reader-pending-edits", role: "status", "data-block-edit-pending": t, children: [
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
const Qa = "retainpdf:reader:doc-theme:v1", Eo = "data-reader-doc";
function es() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function oh(e = es()) {
  try {
    return (e == null ? void 0 : e.getItem(Qa)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function ah(e, t = es()) {
  try {
    t == null || t.setItem(Qa, e);
  } catch {
  }
}
function Po(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(Eo, "dark") : t.removeAttribute(Eo));
}
function sh() {
  const [e, t] = P(() => oh());
  z(() => {
    Po(e);
  }, [e]), z(() => () => Po("light"), []);
  const n = x(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return ah(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
const Mo = 6e3;
function ts(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function ih(e, t, n, r) {
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
function ns({
  pdf: e,
  page: t,
  region: n,
  cssWidth: r,
  className: o,
  label: a
}) {
  const s = _(null), [i, c] = P({ status: "loading", cssHeight: 0 }), l = `${t}:${n.left}:${n.top}:${n.width}:${n.height}:${Math.round(r)}`;
  return z(() => {
    let u = !1, f = null;
    return c((d) => ({ status: "loading", cssHeight: d.cssHeight })), (async () => {
      try {
        const d = await e.getPage(t);
        if (u) return;
        const m = d.getViewport({ scale: 1 }), g = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), h = ih(n, m, r, g), y = s.current, w = y == null ? void 0 : y.getContext("2d");
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
const _o = { figure: "图", table: "表", formula: "公式", text: "文字" }, rt = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function ch(e, t, n) {
  const r = At(e, t, n), o = r ? vt(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = ts({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function lh(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, c = null;
  for (const u of e) {
    const f = At(u, t, n), d = f ? vt(f, 1, 1) : null;
    !f || !d || (r || (r = f.box.page, c = f.pageSize), f.box.page === r && (o = Math.min(o, d.left), a = Math.min(a, d.top), s = Math.max(s, d.left + d.width), i = Math.max(i, d.top + d.height)));
  }
  if (!r || !c) return null;
  const l = ts({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: l, aspect: l.height * c.height / Math.max(1e-6, l.width * c.width) };
}
function uh(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function dh(e, t) {
  const n = (o) => {
    const a = De(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function fh({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var O;
  const i = t.find((A) => A.itemId === e) ?? null, c = Y(() => i ? dh(t, i) : [], [t, i]), l = i ? c.indexOf(i) : -1, [u, f] = P(rt.indexOf(1)), d = rt[u], m = _(null), [g, h] = P(0);
  Ee(() => {
    const A = m.current;
    if (!A) return;
    const I = () => h(A.clientWidth);
    I();
    const T = typeof ResizeObserver == "function" ? new ResizeObserver(I) : null;
    return T == null || T.observe(A), () => T == null ? void 0 : T.disconnect();
  }, []);
  const y = x((A) => {
    const I = c[l + A];
    I && a(I.itemId);
  }, [c, l, a]);
  z(() => {
    const A = (I) => {
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
    return window.addEventListener("keydown", A, !0), () => window.removeEventListener("keydown", A, !0);
  }, [s, y]), z(() => {
    const A = m.current;
    if (!A) return;
    const I = (T) => {
      !T.ctrlKey && !T.metaKey || (T.preventDefault(), f((E) => Math.max(0, Math.min(rt.length - 1, E + (T.deltaY < 0 ? 1 : -1)))));
    };
    return A.addEventListener("wheel", I, { passive: !1 }), () => A.removeEventListener("wheel", I);
  }, []);
  const w = _(null);
  if (!i) return null;
  const S = De(i), b = o.map((A) => ({ pane: A, pdf: r[A] ?? null, where: ch(i, n, A) })).filter((A) => !!(A.pdf && A.where)), v = 16, k = typeof window > "u" ? 800 : window.innerHeight, R = Math.min(880, k * 0.9) - 56 - 32 - (b.length > 1 ? 26 : 0), N = b.length ? uh(Math.max(120, (g - v * (b.length - 1) - 32) / b.length), R, b.map((A) => A.where.aspect)) : 0, $ = ((O = b[0]) == null ? void 0 : O.where.page) ?? i.source.page;
  return /* @__PURE__ */ C("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${_o[S] ?? "这一块"}`, children: [
    /* @__PURE__ */ p("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ C("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ C("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ C("span", { className: "reader-zoom-title", children: [
          _o[S] ?? "这一块",
          " · 第 ",
          $,
          " 页"
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-zoom-count", children: l >= 0 ? `${l + 1} / ${c.length}` : "" }),
        /* @__PURE__ */ C("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ p(mt, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: l <= 0, onClick: () => y(-1), children: /* @__PURE__ */ p(Hs, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(mt, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: l < 0 || l >= c.length - 1, onClick: () => y(1), children: /* @__PURE__ */ p(Ko, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(mt, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => f((A) => Math.max(0, A - 1)), children: /* @__PURE__ */ p(Us, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ C(oe, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => f(rt.indexOf(1)), children: [
            Math.round(d * 100),
            "%"
          ] }),
          /* @__PURE__ */ p(mt, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === rt.length - 1, onClick: () => f((A) => Math.min(rt.length - 1, A + 1)), children: /* @__PURE__ */ p(Ws, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(mt, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: s, children: /* @__PURE__ */ p(wt, { size: 16, "aria-hidden": !0 }) })
        ] })
      ] }),
      /* @__PURE__ */ p(
        "div",
        {
          ref: m,
          className: "reader-zoom-body",
          onPointerDown: (A) => {
            const I = m.current;
            !I || A.button !== 0 || (w.current = { x: A.clientX, y: A.clientY, left: I.scrollLeft, top: I.scrollTop }, I.setPointerCapture(A.pointerId));
          },
          onPointerMove: (A) => {
            const I = m.current, T = w.current;
            !I || !T || (I.scrollLeft = T.left - (A.clientX - T.x), I.scrollTop = T.top - (A.clientY - T.y));
          },
          onPointerUp: () => {
            w.current = null;
          },
          children: b.length && g ? /* @__PURE__ */ p("div", { className: "reader-zoom-columns", style: { gap: v }, children: b.map(({ pane: A, pdf: I, where: T }) => /* @__PURE__ */ C("figure", { className: "reader-zoom-column", children: [
            b.length > 1 ? /* @__PURE__ */ p("figcaption", { children: A === "source" ? "原文" : "译文" }) : null,
            /* @__PURE__ */ p(
              ns,
              {
                className: "reader-zoom-canvas",
                pdf: I,
                page: T.page,
                region: T.fraction,
                cssWidth: N * d,
                label: `${A === "source" ? "原文" : "译文"}第 ${T.page} 页`
              }
            )
          ] }, A)) }) : /* @__PURE__ */ p("p", { className: "reader-zoom-empty", children: g ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
const mh = 380, hh = 320, Et = 8;
function ph(e, t, n) {
  const r = Math.max(Et, Math.min(e.left, n.width - t.width - Et)), o = e.bottom + Et, a = o + t.height <= n.height - Et ? o : Math.max(Et, e.top - Et - t.height);
  return { left: r, top: a };
}
function gh({
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
    const m = r[d], g = m ? lh(o, n, d) : null;
    if (m && g) {
      s = { pdf: m, where: g };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min(mh, hh / Math.max(0.05, s.where.aspect))), c = Math.round(i * s.where.aspect) + 30, l = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: f } = ph(e.anchor, { width: Math.max(i, 160) + 16, height: c + 16 }, l);
  return /* @__PURE__ */ C("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: f }, children: [
    /* @__PURE__ */ C("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ p("span", { children: Kr(e.target) }),
      /* @__PURE__ */ C("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ p(ns, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: Kr(e.target) })
  ] });
}
const bh = 4e3;
function yh(e, t, n) {
  if (e.length) {
    const o = ga(e, n), a = o ? pa(e).find((s) => s.id === o) : null;
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
  const t = e.getRangeAt(0), n = t.startContainer, r = ((s = (a = n.nodeType === 1 ? n : n.parentElement) == null ? void 0 : a.closest) == null ? void 0 : s.call(a, `[${Re}]`)) ?? null;
  return r ? { text: `${e}`.replace(/\s+\n/g, `
`).trim().slice(0, bh), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function vh(e, t, n, r, o) {
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
function wh({
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
  const c = Number(e.getAttribute(Re)) || 0;
  if (c < 1) return null;
  const l = e.getAttribute(ke) === "source" ? "source" : "translated", u = e.getBoundingClientRect(), f = u.width > 0 && u.height > 0 ? { x: Math.min(1, Math.max(0, (t - u.left) / u.width)), y: Math.min(1, Math.max(0, (n - u.top) / u.height)) } : null, m = (r ? a.find((g) => g.itemId === r) ?? null : null) ?? (f ? vh(a, i, l, c, f) : null);
  return {
    pane: l,
    page: c,
    itemId: (m == null ? void 0 : m.itemId) ?? null,
    selection: o,
    sourceText: `${(m == null ? void 0 : m.source.text) || (m == null ? void 0 : m.markdown) || ""}`.trim(),
    translatedText: `${(m == null ? void 0 : m.translatedBlockText) || (m == null ? void 0 : m.translated.text) || ""}`.trim(),
    section: yh(s, a, (m == null ? void 0 : m.source.page) ?? c),
    point: f
  };
}
const Ao = 5e4, Sh = 2e4;
function Nn(e, t) {
  const n = `${e || ""}`;
  return n.length > t ? n.slice(0, t) : n;
}
function mp(e, t) {
  const n = { page: e.page, pane: e.pane, item_ids: e.itemId ? [e.itemId] : [] };
  return t.documentId && (n.document_id = t.documentId), t.jobId && (n.job_id = t.jobId), t.versionId && (n.translation_version = t.versionId), e.selection && (n.selected_text = e.selection), e.section && (n.section = e.section), e.sourceText && (n.source_text = e.sourceText), e.translatedText && (n.translated_text = e.translatedText), n;
}
function kh(e, t = null) {
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
function Ih(e, t) {
  if (!(e != null && e.page)) return null;
  const r = [!!(e.document_id && t && e.document_id !== t) ? "别的书" : "", `第 ${e.page} 页`, e.section || ""].filter(Boolean).join(" · ");
  return { page: e.page, label: r, data: e };
}
function Th(e, t) {
  var o;
  if (!t) return;
  const n = e.findIndex((a) => a.message_id === t);
  if (n < 0) return;
  const r = ((o = e[n + 1]) == null ? void 0 : o.role) === "assistant" ? Rh(e[n + 1].text) : "";
  return { question: e[n].text, ...r ? { answer: r } : {} };
}
function Rh(e, t = 160) {
  const n = e.replace(/```[\s\S]*?(```|$)/g, " ").replace(/\$\$[\s\S]*?\$\$/g, " … ").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim(), r = [...n];
  return r.length > t ? `${r.slice(0, t).join("")}…` : n;
}
function Eh(e, t = [], n = "") {
  const r = new Set(t.map((o) => o.covers_to_seq));
  return e.filter((o) => !o.superseded_at).map((o) => {
    const a = r.has(o.seq) ? { compactedBefore: !0 } : {};
    if (o.role === "user") {
      const s = Th(e, o.edited_from);
      return {
        id: o.message_id,
        role: "user",
        text: o.text,
        context: Ih(o.selection, n),
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
function Ph(e, t, n, r) {
  var l, u, f;
  const o = ((f = (u = (l = e.context) == null ? void 0 : l.meta) == null ? void 0 : u.retainpdf) == null ? void 0 : f.selection) ?? null, a = (o == null ? void 0 : o.document_id) || t || null, s = e.sessionId && e.sessionId.length <= 256 ? e.sessionId : null, i = { agent_id: e.agentId || null, document_id: a, session_id: s }, c = e.answer.usage && JSON.stringify(e.answer.usage).length <= 4096 ? e.answer.usage : null;
  return [
    { ...i, role: "user", text: Nn(e.question.text, Ao), selection: o, client_message_id: `${n}-q`, ...r ? { edited_from: r } : {} },
    {
      ...i,
      role: "assistant",
      text: Nn(e.answer.text, Ao),
      thought: e.answer.thought ? Nn(e.answer.thought, Sh) : null,
      usage: c,
      client_message_id: `${n}-a`,
      memory_ids: e.memoryIds.slice(0, 10)
    }
  ];
}
function Mh(e) {
  return new Date(e - 2e3).toISOString().replace(/\.\d+Z$/, "Z");
}
function _h(e, t) {
  return e.filter((n) => n.origin === "agent" && n.status === "active" && !t.has(n.memory_id)).map((n) => ({ id: n.memory_id, scope: n.scope, text: n.text, category: n.category, documentId: n.document_id, created: !0 }));
}
function Nh(e, t) {
  if (t.id && e.some((r) => r.message_id === t.id)) return t.id;
  const n = t.text.trim();
  for (let r = e.length - 1; r >= 0; r -= 1) {
    const o = e[r];
    if (o.role === "assistant" && o.text.trim() === n) return o.message_id;
  }
  return null;
}
function Ah(e) {
  const t = e.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().split(new RegExp("(?<=[。！？.!?])"))[0] || "";
  return `深挖：${[...t].slice(0, 30).join("")}${[...t].length > 30 ? "…" : ""}`;
}
const Lh = 50, An = { conversation: null, main: null, records: [], compactions: [], hasMore: !1, key: "local", initial: [] };
function xh() {
  var t, n;
  return `c-${((n = (t = globalThis.crypto) == null ? void 0 : t.randomUUID) == null ? void 0 : n.call(t)) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}
function Lo(e) {
  var n, r, o, a;
  const t = e;
  return `${(t == null ? void 0 : t.reason) || ((n = t == null ? void 0 : t.details) == null ? void 0 : n.reason) || ((a = (o = (r = t == null ? void 0 : t.payload) == null ? void 0 : r.error) == null ? void 0 : o.details) == null ? void 0 : a.reason) || (e instanceof Error ? e.message : "")}`;
}
function Dh({ port: e, book: t, onAppended: n }) {
  const r = (e == null ? void 0 : e.conversations) ?? null, o = (e == null ? void 0 : e.memories) ?? null, [a, s] = P(!1), [i, c] = P(An), [l, u] = P(!1), [f, d] = P(""), [m, g] = P("idle"), [h, y] = P(null), [w, S] = P(() => /* @__PURE__ */ new Map()), b = _(/* @__PURE__ */ new Set()), v = _(/* @__PURE__ */ new Map()), k = (F) => {
    if (!F) return null;
    const V = v.current.get(F);
    return V || (R.current.records.some((q) => q.message_id === F) ? F : null);
  }, R = _(i);
  R.current = i;
  const N = _(t);
  N.current = t;
  const $ = _(0), O = x(async (F, V, q, he = []) => {
    if (!r) return;
    const G = await r.messages(F.conversation_id, { limit: Lh, ...q ? { beforeSeq: q } : {} }), J = [...G.messages, ...he];
    $.current += 1, c({
      conversation: F,
      main: V ?? F,
      records: J,
      compactions: G.compactions || [],
      hasMore: G.has_more,
      key: `${F.conversation_id}:${$.current}`,
      initial: Eh(J, G.compactions || [], N.current.documentId)
    });
  }, [r]), A = x(async () => {
    var F;
    if (s(!0), !(!r || ((F = R.current.conversation) == null ? void 0 : F.kind) === "main")) {
      u(!0), d("");
      try {
        const V = await r.main(N.current.documentId || void 0);
        await O(V, V);
      } catch (V) {
        d(V instanceof Error ? V.message : String(V));
      } finally {
        u(!1);
      }
    }
  }, [r, O]), I = x((F) => {
    y(F), A();
  }, [A]), T = _(t.documentId);
  z(() => {
    T.current !== t.documentId && (T.current = t.documentId, R.current = An, c(An), y(null), S(/* @__PURE__ */ new Map()), v.current.clear(), a && A());
  }, [t.documentId, a, A]);
  const E = x(async () => {
    const F = R.current, V = F.records[0];
    if (!(!F.conversation || !V || !F.hasMore)) {
      u(!0);
      try {
        await O(F.conversation, F.main, V.seq, F.records);
      } finally {
        u(!1);
      }
    }
  }, [O]), L = x(async (F) => {
    const q = R.current.conversation;
    if (!r || !q) return;
    for (const ie of F.memoryIds) b.current.add(ie);
    let he = F.memoryIds;
    if (!he.length && o && F.startedAt) {
      const ie = _h(
        await o.list({ source_conversation_id: q.conversation_id, created_after: Mh(F.startedAt) }).catch(() => []),
        b.current
      );
      for (const Ie of ie) b.current.add(Ie.id);
      he = ie.map((Ie) => Ie.id);
      const me = F.answerId;
      ie.length && me && S((Ie) => new Map(Ie).set(me, ie));
    }
    const G = Ph({ ...F, memoryIds: he }, N.current.documentId, xh(), k(F.editedFrom));
    let J;
    try {
      J = await r.append(q.conversation_id, G);
    } catch (ie) {
      if (q.kind !== "side" || !/ask_conversation_not_open/.test(Lo(ie))) throw ie;
      await r.reopen(q.conversation_id), J = await r.append(q.conversation_id, G);
    }
    const [ce, ge] = J.messages;
    F.questionId && ce && v.current.set(F.questionId, ce.message_id), F.answerId && ge && v.current.set(F.answerId, ge.message_id), c((ie) => {
      var me;
      return ((me = ie.conversation) == null ? void 0 : me.conversation_id) === q.conversation_id ? { ...ie, conversation: J.conversation, records: [...ie.records, ...J.messages] } : ie;
    }), n == null || n(J.messages), J.compaction_due && q.kind === "main" && r.compact(q.conversation_id).catch(() => {
    });
  }, [r, o, n]), D = x(async (F) => {
    const V = R.current.conversation, q = k(F);
    if (!r || !V || !q) return null;
    try {
      await r.supersede(V.conversation_id, q);
    } catch (J) {
      if (!/ask_message_superseded/.test(Lo(J))) throw J;
    }
    const he = R.current.records.find((J) => J.message_id === q), G = R.current.records.findIndex((J) => J.message_id === q);
    return c((J) => ({ ...J, records: J.records.map((ce, ge) => ge >= G && G >= 0 && !ce.superseded_at ? { ...ce, superseded_at: "now" } : ce) })), (he == null ? void 0 : he.selection) ?? null;
  }, [r]), U = x((F) => {
    L(F).catch((V) => d(`这一轮没存上：${V instanceof Error ? V.message : String(V)}`));
  }, [L]), M = x(async (F) => {
    var he;
    const V = R.current, q = V.main;
    if (!(!r || !q || ((he = V.conversation) == null ? void 0 : he.kind) !== "main")) {
      d("");
      try {
        const G = Nh(V.records, F), J = await r.fork({
          parent_id: q.conversation_id,
          ...G ? { forked_from_message_id: G } : {},
          title: Ah(F.text),
          ...N.current.documentId ? { document_id: N.current.documentId } : {}
        });
        await O(J, q);
      } catch (G) {
        d(`开不了副对话：${G instanceof Error ? G.message : String(G)}`);
      }
    }
  }, [r, O]), H = x(async (F) => {
    const V = R.current.main;
    if (r)
      try {
        await O(await r.get(F), V);
      } catch (q) {
        d(`打不开副对话：${q instanceof Error ? q.message : String(q)}`);
      }
  }, [r, O]), K = x(async () => {
    const F = R.current.main;
    F && await O(F, F).catch(() => {
    });
  }, [O]), Q = x(async () => {
    const F = R.current.conversation;
    if (!(!r || (F == null ? void 0 : F.kind) !== "side")) {
      g("busy");
      try {
        await r.close(F.conversation_id), g("idle"), await K();
      } catch {
        g("failed");
      }
    }
  }, [r, K]), te = x(async () => {
    const F = R.current.main;
    if (!r || !F) return;
    await r.archive(F.conversation_id);
    const V = await r.main(N.current.documentId || void 0);
    await O(V, V);
  }, [r, O]);
  return {
    visible: a,
    view: i,
    loading: l,
    error: f,
    pending: h,
    setPending: y,
    closingSide: m,
    notices: w,
    persistent: !!r,
    openMain: A,
    ask: I,
    close: x(() => s(!1), []),
    loadEarlier: E,
    onTurn: U,
    rewrite: D,
    fork: M,
    openSide: H,
    backToMain: K,
    closeSide: Q,
    archiveMain: te,
    forgetMemory: r ? r.forgetMemory : void 0
  };
}
function xo(e, t, n) {
  var c;
  const r = e.selection, o = e.page ?? (r == null ? void 0 : r.page) ?? 0;
  if (e.role !== "user" || !o) return null;
  const a = (e.pane ?? (r == null ? void 0 : r.pane)) === "source" ? "source" : "translated", s = ((c = r == null ? void 0 : r.item_ids) == null ? void 0 : c[0]) ?? null, i = kh({ item_ids: [], ...r, page: o, pane: a }, n(s, a, o));
  return { key: t, anchor: i, messageId: e.message_id, title: e.text.slice(0, 80) };
}
function Ch({ port: e, documentId: t, resetKey: n, pointOf: r }) {
  const [o, a] = P([]), s = _(0), i = _(r);
  i.current = r;
  const c = () => (s.current += 1, s.current);
  z(() => {
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
      (h) => d(h.map((y) => xo(y, c(), i.current)).filter((y) => !!y)),
      () => {
      }
    ), () => {
      f = !0;
    };
  }, [e, t, n]);
  const l = x((f) => {
    const d = f.filter((m) => !m.document_id || m.document_id === t).map((m) => xo(m, c(), i.current)).filter((m) => !!m);
    d.length && a((m) => [...m.filter((g) => !d.some((h) => h.messageId === g.messageId)), ...d]);
  }, [t]), u = x((f) => a((d) => d.filter((m) => m.key !== f)), []);
  return { marks: o, addRecords: l, removeMark: u };
}
const zh = $o(() => import("./ReaderAskPanel-Dr30GSoR.js"));
function Oh({
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
  var U;
  const f = Y(() => ({ documentId: t, jobId: n, versionId: r }), [t, n, r]), d = x((M, H, K) => {
    const Q = M ? o.find((V) => V.itemId === M) : null, te = Q ? At(Q, a, H) : null, F = te && te.box.page === K ? vt(te, 1, 1) : null;
    return F ? { x: F.left, y: F.top } : null;
  }, [o, a]), m = Ch({ port: e, documentId: t, resetKey: c, pointOf: d }), g = Dh({ port: e, book: f, onAppended: m.addRecords }), [h, y] = P(null), w = x(
    (M, H, K, Q) => wh({
      pageElement: (M == null ? void 0 : M.closest(`[${Re}]`)) ?? null,
      clientX: H,
      clientY: K,
      itemId: i(),
      selection: Q,
      regions: o,
      bookmarks: s,
      metadata: a
    }),
    [i, o, s, a]
  ), S = x(() => {
    var H;
    const M = No(((H = globalThis.getSelection) == null ? void 0 : H.call(globalThis)) ?? null);
    return !M.text || !M.element || !M.rect ? null : w(M.element, M.rect.left + M.rect.width / 2, M.rect.top + M.rect.height / 2, M.text);
  }, [w]), b = x((M) => {
    y(null), g.ask(M);
  }, [g.ask]);
  z(() => {
    if (!e) return;
    const M = (H) => {
      var te;
      if (H.key !== "?" || H.metaKey || H.ctrlKey || H.altKey || H.defaultPrevented) return;
      const K = H.target;
      if ((te = K == null ? void 0 : K.closest) != null && te.call(K, "input, textarea, select, [contenteditable='true']")) return;
      const Q = S();
      Q && (H.preventDefault(), H.stopImmediatePropagation(), b(Q));
    };
    return window.addEventListener("keydown", M, !0), () => window.removeEventListener("keydown", M, !0);
  }, [e, S, b]);
  const v = _(""), k = ((U = g.pending) == null ? void 0 : U.selection) || "";
  z(() => {
    k && (v.current = k);
  }, [k]);
  const R = g.visible && !h, N = g.setPending;
  z(() => {
    if (!R) return;
    let M = null;
    const H = () => {
      M && clearTimeout(M), M = setTimeout(() => {
        const K = S();
        K && K.selection !== v.current && N(K);
      }, 250);
    };
    return document.addEventListener("selectionchange", H), () => {
      M && clearTimeout(M), document.removeEventListener("selectionchange", H);
    };
  }, [R, S, N]);
  const $ = x(async (M) => {
    if (M.threadId && (e != null && e.threads) && t) {
      try {
        const H = await e.threads.get(t, M.threadId);
        y({ anchor: H.anchor || M.anchor, messages: H.messages || [], mark: M });
      } catch {
        y({ anchor: M.anchor, messages: [], mark: M });
      }
      return;
    }
    y(null), g.openMain();
  }, [e, t, g.openMain]), [O, A] = P(null), I = x((M, H, K) => {
    var te;
    if (!e) return;
    const Q = No(((te = globalThis.getSelection) == null ? void 0 : te.call(globalThis)) ?? null);
    A(w(M, H, K, Q.element ? Q.text : ""));
  }, [e, w]), T = e && O ? [{
    key: "ask",
    label: O.selection ? "问这段" : "在这里提问",
    hint: O.selection ? "?" : void 0,
    onSelect: () => b(O)
  }] : [], E = h ? {
    anchor: h.anchor,
    messages: h.messages,
    onClose: () => y(null),
    onDelete: e != null && e.threads && h.mark.threadId ? () => {
      e.threads.remove(t, h.mark.threadId).catch(() => {
      }), m.removeMark(h.mark.key), y(null);
    } : void 0
  } : null, L = !g.persistent || !!g.view.conversation || !!g.error, D = e && (g.visible && L || h) ? /* @__PURE__ */ p(Oo, { fallback: null, children: /* @__PURE__ */ p(
    zh,
    {
      port: e,
      jobId: n,
      book: f,
      ask: g,
      legacy: E,
      onShowSelection: ({ page: M, pane: H }) => l(M, H),
      onJumpToPage: (M) => l(M),
      pageCount: u
    }
  ) }) : null;
  return { marks: m.marks, onMark: $, captureMenu: I, menuActions: T, panel: D, open: g.openMain };
}
const $h = 250;
function Fh(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function Bh(e, t, n) {
  const r = n === "back" ? e.back : e.forward;
  if (!r.length) return null;
  const o = r[r.length - 1], a = r.slice(0, -1), s = n === "back" ? { back: a, forward: [...e.forward, t] } : { back: [...e.back, t], forward: a };
  return { to: o, history: s };
}
function jh(e) {
  var n;
  const t = e;
  return !!((n = t == null ? void 0 : t.closest) != null && n.call(t, "input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}
function Hh({
  shellEl: e,
  index: t,
  primaryPane: n,
  follow: r
}) {
  const [o, a] = P(null), [s, i] = P({ back: [], forward: [] }), c = _(s);
  c.current = s;
  const l = _(null), u = _({ index: t, primaryPane: n, follow: r, shellEl: e });
  u.current = { index: t, primaryPane: n, follow: r, shellEl: e };
  const f = x(() => {
    const { shellEl: m, primaryPane: g } = u.current;
    return Wt(m, g);
  }, []);
  z(() => {
    if (!e) return;
    const m = (b) => {
      var v, k;
      return (k = (v = b.target) == null ? void 0 : v.closest) == null ? void 0 : k.call(v, `.${ba}`);
    }, g = () => {
      l.current != null && window.clearTimeout(l.current), l.current = null;
    }, h = (b) => {
      var N;
      const v = m(b);
      if (!v) return;
      const k = u.current.index.get(v.getAttribute(jn) || "");
      if (!k) return;
      const R = ((N = v.closest("[data-reader-pane]")) == null ? void 0 : N.getAttribute("data-reader-pane")) || u.current.primaryPane;
      g(), l.current = window.setTimeout(() => {
        const $ = v.getBoundingClientRect();
        a({ target: k, pane: R, anchor: { left: $.left, top: $.top, right: $.right, bottom: $.bottom } });
      }, $h);
    }, y = (b) => {
      const v = m(b);
      !v || v.contains(b.relatedTarget) || (g(), a(null));
    }, w = (b) => {
      var $, O;
      const v = m(b);
      if (!v || b.button !== 0 || b.metaKey || b.ctrlKey || b.shiftKey || `${(($ = window.getSelection) == null ? void 0 : $.call(window)) || ""}`.trim()) return;
      const k = u.current.index.get(v.getAttribute(jn) || "");
      if (!k) return;
      b.preventDefault(), b.stopPropagation(), g(), a(null);
      const R = ((O = v.closest("[data-reader-pane]")) == null ? void 0 : O.getAttribute("data-reader-pane")) || u.current.primaryPane, N = f();
      N && i((A) => Fh(A, N)), u.current.follow(k, R);
    }, S = () => {
      g(), a(null);
    };
    return e.addEventListener("pointerover", h), e.addEventListener("pointerout", y), e.addEventListener("click", w, !0), e.addEventListener("scroll", S, { passive: !0 }), () => {
      g(), e.removeEventListener("pointerover", h), e.removeEventListener("pointerout", y), e.removeEventListener("click", w, !0), e.removeEventListener("scroll", S);
    };
  }, [e, f]);
  const d = x((m) => {
    const g = f();
    if (!g) return !1;
    const h = Bh(c.current, g, m);
    if (!h) return !1;
    const { shellEl: y, primaryPane: w } = u.current;
    return Lt(y, h.to, "auto", w) ? (i(h.history), !0) : !1;
  }, [f]);
  return z(() => {
    const m = (g) => {
      if (!g.altKey || g.metaKey || g.ctrlKey || g.shiftKey || g.defaultPrevented || g.key !== "ArrowLeft" && g.key !== "ArrowRight" || jh(g.target)) return;
      d(g.key === "ArrowLeft" ? "back" : "forward") && g.preventDefault();
    };
    return window.addEventListener("keydown", m), () => window.removeEventListener("keydown", m);
  }, [d]), {
    preview: o,
    closePreview: x(() => a(null), []),
    canGoBack: s.back.length > 0,
    backPage: s.back.length ? s.back[s.back.length - 1].page : null,
    goBack: x(() => d("back"), [d])
  };
}
const Uh = $o(() => import("./ReaderMarkdownPanel-CcGhqZGn.js").then((e) => ({ default: e.ReaderMarkdownPanel }))), Wh = [];
function Kh(e) {
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
function Vh(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function qh() {
  var kr;
  const e = hl(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = Tm(e.viewStateKey), s = a.panel, i = a.setPanel, [c, l] = P(!1), u = _(null), f = _(null), d = s !== null, m = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, g = Kh({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: m,
    liveTranslationVisible: c,
    assistantOpen: d
  }), h = tl({
    hasOverlayContent: m,
    connection: e.liveTranslation.connection,
    showSource: g.showSource,
    liveTranslationVisible: c,
    assistantOpen: d
  }), y = g.sourceViewOnly, w = g.visibleMode;
  z(() => {
    l(!1);
  }, [e.viewStateKey]), z(() => {
    e.session.jobTerminal && l(!1);
  }, [e.session.jobTerminal]);
  const S = _(null);
  z(() => {
    S.current !== e.viewStateKey && ol({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: y,
      jobTerminal: e.session.jobTerminal
    }) && (S.current = e.viewStateKey, l(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, y]), z(() => {
    if (!(t.loading || t.failed)) {
      if (u.current !== e.viewStateKey) {
        u.current = e.viewStateKey;
        const W = We(e.viewStateKey), ae = Mm({
          savedMode: W == null ? void 0 : W.mode,
          sourceViewOnly: y,
          viewportWidth: it()
        });
        f.current = ae.auto ? ae.mode : null, ae.mode && ae.mode !== e.mode && e.setModeKeepingPage(ae.mode);
        return;
      }
      _m(e.mode, f.current) && (f.current = null, bn(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, y]);
  const b = s || (e.mode === "compare" ? "compare" : "reading"), v = Am(s, "markdown"), { docDark: k, toggleDocDark: R } = sh();
  Sl({
    toggleDocDark: R,
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
  const N = x(() => {
    i(null);
  }, []), $ = nl(e.liveTranslation), O = x(() => {
    $ && e.goToPage($, "source");
  }, [e.goToPage, $]), [A, I] = P(null);
  z(() => {
    w === "compare" && e.session.jobTerminal && I(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, w]);
  const T = A !== e.viewStateKey && al({
    state: e.liveTranslation,
    sourceViewOnly: y,
    visibleMode: w
  }), E = x((W) => {
    const ae = Vh(W, e.liveTranslationAvailable);
    ae !== null && l(ae), e.setModeKeepingPage(W);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), L = Y(() => h.sourcePaneToggle ? /* @__PURE__ */ p(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${c ? " is-active" : ""}`,
      onClick: () => l((W) => !W),
      "aria-pressed": c,
      title: c ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [h.sourcePaneToggle, c]), D = x((W) => {
    i(W);
  }, []), [U] = P(Lm), [M, H] = P(null), K = x((W) => H((ae) => ae === W ? null : W), []), [Q, te] = P(""), [F, V] = P("");
  z(() => {
    const W = Q.replace(/\s+/gu, " ").trim(), ae = window.setTimeout(() => V(W), W ? 150 : 0);
    return () => window.clearTimeout(ae);
  }, [Q]);
  const [q, he] = P(0), G = x(() => {
    H("search"), he((W) => W + 1);
  }, []);
  Zm(G);
  const J = x((W) => {
    e.jumpToAnchor({ block_id: W }), (M === "outline" || it() < 900) && H(null);
  }, [e.jumpToAnchor, M]), ce = x((W) => e.jumpToAnchor({ block_id: W }), [e.jumpToAnchor]), [ge, ie] = P({}), me = _({ source: r.sourceUrl, translated: r.translatedUrl });
  me.current = { source: r.sourceUrl, translated: r.translatedUrl };
  const Ie = x((W, ae) => {
    ie((Ve) => ({ ...Ve, [ae]: { url: me.current[ae], nodes: W } }));
  }, []), tt = Y(() => {
    const W = ge.source;
    if (W && W.url === r.sourceUrl && W.nodes.length) return W.nodes;
    const ae = ge.translated;
    return ae && ae.url === r.translatedUrl && ae.nodes.length ? ae.nodes : Wh;
  }, [ge, r.sourceUrl, r.translatedUrl]), Ce = _({}), [le, pe] = P(0), ye = x((W, ae) => {
    Ce.current[ae] = { url: me.current[ae], pdf: W }, pe((Ve) => Ve + 1);
  }, []), [j, re] = P(null), se = x((W) => re(W), []), ze = x(() => re(null), []);
  z(() => re(null), [e.viewStateKey]);
  const Pe = Y(() => {
    const W = (ae, Ve) => {
      const dt = Ce.current[ae];
      return dt && dt.url === Ve ? dt.pdf : null;
    };
    return { source: W("source", r.sourceUrl), translated: W("translated", r.translatedUrl) };
  }, [le, r.sourceUrl, r.translatedUrl]), Me = Y(() => eu(o.regions), [o.regions]), Oe = x(
    (W, ae) => e.jumpToAnchor({ block_id: W.itemId }, ae),
    [e.jumpToAnchor]
  ), _e = Hh({ shellEl: e.shell.shellEl, index: Me, primaryPane: e.panes.primaryPane, follow: Oe }), $e = x((W) => {
    e.goToPage(W), (M === "outline" || it() < 900) && H(null);
  }, [e.goToPage, M]), we = th({
    jobId: o.jobId,
    jobStatus: o.jobStatus,
    jobPayload: o.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!r.translatedUrl,
    refreshJobStatus: o.refreshJobStatus
  }), Ne = we.select, Be = e.setModeKeepingPage, Ke = o.regions, je = x((W) => {
    bu(Ke, W) && (w === "source" && Be("compare"), Ne(W));
  }, [Ke, Ne, w, Be]);
  nh(we.available ? je : null, U);
  const Ae = id(e.viewStateKey);
  Wm(Ae);
  const [nt, ut] = P(null), B = x(() => ut(null), []), X = Jm({ documentId: o.documentId, jobId: o.jobId }), ee = Y(() => {
    try {
      return Qe().ask ?? null;
    } catch {
      return null;
    }
  }, []), ne = Oh({
    port: ee,
    documentId: o.documentId || "",
    jobId: o.jobId,
    versionId: X.readingVersionId || null,
    regions: o.regions,
    metadata: o.readerMetadata,
    bookmarks: tt,
    hoveredItemId: () => U.get().itemId,
    resetKey: e.viewStateKey,
    goToPage: e.goToPage,
    pageCount: n.hudNumPages || 0
  }), de = ne.marks, Z = ne.onMark, ue = ((kr = X.compared) == null ? void 0 : kr.url) || "";
  z(() => {
    ue && w !== "compare" && E("compare");
  }, [ue]), z(() => {
    w !== "compare" && X.clear();
  }, [w]);
  const ve = Y(
    () => {
      const { compared: W, versions: ae, readingVersionId: Ve } = X;
      if (!W) return null;
      const dt = ae.find((yn) => yn.versionId === W.versionId), It = ae.find((yn) => yn.versionId === Ve);
      return {
        url: W.url,
        regions: W.regions,
        left: { name: W.name, createdAt: (dt == null ? void 0 : dt.createdAt) || "" },
        right: { name: (It == null ? void 0 : It.name) || "当前译文", createdAt: (It == null ? void 0 : It.createdAt) || "" }
      };
    },
    [X.compared, X.versions, X.readingVersionId]
  ), Sr = Y(() => {
    if (!we.savedCounts.size) return e.revisedBlocks;
    const W = new Map(e.revisedBlocks);
    for (const [ae, Ve] of we.savedCounts) W.set(ae, (W.get(ae) || 0) + Ve);
    return W;
  }, [e.revisedBlocks, we.savedCounts]), rs = Y(() => ({
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
    regionHover: U,
    jumpToBlock: ce,
    revisedBlocks: Sr,
    onPdfOutline: Ie,
    onPdfDocument: ye,
    zoomBlock: se,
    xrefIndex: Me,
    askMarks: de,
    onAskMark: Z,
    editBlock: we.available ? je : void 0,
    blockEdit: we,
    editShowsSource: w !== "compare",
    findTerm: M === "search" ? F : "",
    compareVersion: ve,
    ink: Ae,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: y,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: D, close: N },
    docDark: k,
    toggleDocDark: R
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
    U,
    ce,
    Sr,
    Ie,
    ye,
    se,
    Me,
    de,
    Z,
    we,
    je,
    w,
    M,
    F,
    ve,
    Ae,
    e.sourceOnly,
    y,
    e.download,
    e.goToPage,
    D,
    N,
    k,
    R
  ]), os = Y(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), as = [
    Vi,
    `is-workspace-${b}`,
    d ? "is-assistant-open" : "",
    M ? "is-finder-open" : "",
    g.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(hd, { value: rs, hud: os, children: /* @__PURE__ */ C(
    "div",
    {
      className: as,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": b,
      "data-ink-mode": Ae.tool || void 0,
      onContextMenu: (W) => {
        const ae = Um(W);
        ae && (W.preventDefault(), ne.captureMenu(W.target, W.clientX, W.clientY), ut(ae));
      },
      children: [
        /* @__PURE__ */ p(qf, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata, onRetry: o.refreshJobArtifacts }),
        /* @__PURE__ */ p(zm, { open: M, onToggle: K }),
        M ? /* @__PURE__ */ p(
          $m,
          {
            tab: M,
            onTab: H,
            onClose: () => H(null),
            onJump: J,
            bookmarks: tt,
            onJumpPage: $e,
            query: Q,
            onQuery: te,
            term: F,
            focusSignal: q
          }
        ) : null,
        /* @__PURE__ */ C("div", { className: "reader-chrome-tray", children: [
          /* @__PURE__ */ p(nm, {}),
          /* @__PURE__ */ p(Ml, { onBeforeClose: o.prepareClose })
        ] }),
        /* @__PURE__ */ p(
          Yd,
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
              onJumpToLatest: O
            } : null,
            completion: T ? {
              onOpenCompare: () => {
                I(e.viewStateKey), E("compare");
              }
            } : null
          }
        ),
        /* @__PURE__ */ p(of, { active: s }),
        d ? /* @__PURE__ */ p(Kf, {}) : null,
        /* @__PURE__ */ p(Jd, { paneComposition: g, markdownSplit: v.open, assistantSplit: d, liveTranslation: e.liveTranslation, sourcePaneAction: L }),
        e.showHud ? /* @__PURE__ */ p(
          km,
          {
            mode: w,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            issuesJobId: e.sourceOnly ? "" : o.jobId,
            searchSlot: /* @__PURE__ */ p(Om, { open: M, onToggle: K })
          }
        ) : null,
        /* @__PURE__ */ p(Oo, { fallback: null, children: v.mounted ? /* @__PURE__ */ p(Uh, { open: v.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: N }) : null }),
        _e.preview ? /* @__PURE__ */ p(gh, { preview: _e.preview, regions: o.regions, metadata: o.readerMetadata, documents: Pe }) : null,
        _e.canGoBack ? /* @__PURE__ */ C(oe, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => _e.goBack(), children: [
          /* @__PURE__ */ p(Ks, { size: 14, "aria-hidden": !0 }),
          " 回到第 ",
          _e.backPage,
          " 页"
        ] }) : null,
        j ? /* @__PURE__ */ p(
          fh,
          {
            itemId: j,
            regions: o.regions,
            metadata: o.readerMetadata,
            documents: Pe,
            panes: w === "compare" ? ["source", "translated"] : w === "translated" ? ["translated"] : ["source"],
            onNavigate: re,
            onClose: ze
          }
        ) : null,
        /* @__PURE__ */ p(Fm, { active: s, compare: X, ink: Ae }),
        /* @__PURE__ */ p(
          jm,
          {
            ink: Ae,
            menu: nt,
            onClose: B,
            actions: ne.menuActions
          }
        ),
        ne.panel,
        /* @__PURE__ */ p(Hm, { ink: Ae }),
        /* @__PURE__ */ p(rh, { edit: we }),
        /* @__PURE__ */ p(Pm, {})
      ]
    }
  ) });
}
function hp() {
  return /* @__PURE__ */ p(qh, {});
}
export {
  hp as R,
  qh as a,
  mp as b,
  fp as c,
  dp as d,
  lp as f,
  up as r,
  kh as s,
  et as u
};
//# sourceMappingURL=ReaderApp-CRDYzs8R.js.map
