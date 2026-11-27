var pr = (e) => {
  throw TypeError(e);
};
var gr = (e, t, n) => t.has(e) || pr("Cannot " + n);
var Mt = (e, t, n) => (gr(e, t, "read from private field"), n ? n.call(e) : t.get(e)), br = (e, t, n) => t.has(e) ? pr("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), yr = (e, t, n, r) => (gr(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as D, jsx as p, Fragment as We } from "react/jsx-runtime";
import { useMemo as G, useState as P, useEffect as z, useCallback as x, useRef as M, useLayoutEffect as Te, memo as un, createContext as Wn, useContext as Kn, forwardRef as Eo, useImperativeHandle as Vn, useSyncExternalStore as Po, useId as Mo, Suspense as _o, lazy as Ao } from "react";
import { requireAdapter as Pt, getReaderAdapters as Pe } from "./adapters.js";
import { resolveReaderDownloadName as Ga, resolveReaderDownloadUrls as Xa, READER_PROGRESS_COPY as $e, trimString as tn, READER_DOWNLOAD_ACTIONS as Za, disabledReason as Ya } from "./runtime/state.js";
import { r as Qa, b as es } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as En, isFinishedJobStatus as Ft } from "@retainpdf/domain/job";
import { n as No, d as ts, f as mn, k as vr, b as ns, c as rs, j as Me, p as lt, g as os, l as Rt, i as as } from "./reader-regions-BmqHsJ-I.js";
import { fetchDocumentReading as ss } from "@retainpdf/api/documents";
import { isReaderTransportError as is, createReaderTransportError as cs } from "./contracts.js";
import { toast as Pn, Toaster as ls } from "sonner";
import { X as ut, PenLine as qn, ZoomIn as us, Check as Lo, Copy as ds, ChevronUp as fs, ChevronDown as xo, History as ms, LoaderCircle as hs, Pin as ps, LogOut as gs, FileText as Do, Columns2 as Co, Languages as zo, Radio as bs, ArrowDownToLine as ys, CheckCircle2 as vs, Keyboard as ws, Download as Ss, ListOrdered as ks, TriangleAlert as Is, ChevronRight as Oo, Search as Rs, ListTree as Ts, GitCompareArrows as Es, LayoutGrid as Ps, Highlighter as Ms, Eraser as _s, Undo2 as As, Trash2 as Ns, ChevronLeft as Ls, Minus as xs, Plus as Ds, ArrowLeft as Cs } from "lucide-react";
import { Button as te, Textarea as zs, IconButton as ot, Input as $o } from "@retainpdf/ui";
import { pdfjs as Fo, Page as Os, Document as $s } from "react-pdf";
import { e as Fs, m as Bs, a as js } from "./markdown-math-XkF5urpn.js";
const Hs = (...e) => {
  var t, n;
  return ((n = (t = Pe()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, Us = "", Ws = Object.freeze({
  progress: "retainpdf-reader-progress"
}), Ks = (e) => {
  var t, n;
  return ((n = (t = Pe()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, cp = (...e) => {
  var n;
  return (((n = Pe()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, lp = () => {
  var e, t;
  return ((t = (e = Pe()) == null ? void 0 : e.resolveKatexStylesheetUrl) == null ? void 0 : t.call(e)) ?? "";
}, Fe = () => Pt("defaultReaderDataPort"), wr = () => Pt("defaultReaderPageConfigPort"), up = {
  get apiPrefix() {
    return Fe().apiPrefix;
  },
  fetchProtected: (...e) => Fe().fetchProtected(...e),
  loadMarkdownPayload: (e) => Fe().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => Fe().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => Fe().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => Fe().loadJobPayload(e),
  loadReaderPayload: (e, t) => Fe().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => Fe().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return Fe().liveTranslation;
  }
}, Bo = {
  messageTargetOrigin: () => wr().messageTargetOrigin(),
  readerJobId: () => wr().readerJobId()
}, Vs = () => {
  var e;
  return ((e = Pe()) == null ? void 0 : e.liveTranslation) ?? null;
}, Bt = () => {
  var t;
  const e = Pe();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, Ke = () => {
  const e = Pe();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => Pt("fetchDocumentByJobId")(...n),
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
}, qs = (...e) => {
  var t, n;
  return ((n = (t = Pe()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, Js = () => {
  var e, t;
  return ((t = (e = Pe()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, Gs = (...e) => {
  var t, n;
  return ((n = (t = Pe()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, Xs = (...e) => {
  var t, n;
  return ((n = (t = Pe()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? Ga(...e);
}, Zs = (...e) => {
  var t, n;
  return ((n = (t = Pe()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? Xa(...e);
}, Ys = (...e) => Pt("downloadProtectedResource")(...e), Qs = (...e) => Pt("failDownloadToast")(...e), dp = (e, t) => Pt("resolveMarkdownAssetUrl")(e, t), Sr = "/api/v1";
function ei() {
  const e = () => {
    var r;
    return Qa(
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
function ti() {
  const e = ei(), t = G(() => Gs(Bo), [e]), n = G(() => Js(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function ni(e) {
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
  }), w = h.jobId === g ? h.documentId : "", S = t || w, b = !!t && !g, [v, k] = P(null), T = (v == null ? void 0 : v.sessionIdentity) === r && v.documentId === S ? v : null, A = b || !!T, $ = x((_) => {
    const I = `${_.documentId || ""}`.trim();
    if (!I || a.current && a.current !== I) return;
    if (!a.current && s.current)
      y({
        jobId: s.current,
        documentId: I
      });
    else if (!a.current)
      return;
    const R = `${_.revision || ""}`.trim() || `${Date.now()}`;
    k({
      documentId: I,
      revision: R,
      sessionIdentity: o.current
    }), i();
  }, []);
  z(() => {
    k((_) => _ && _.sessionIdentity !== r ? null : _);
  }, [r]);
  const O = x((_) => {
    switch (_.type) {
      case "resolved-document-job":
        l({ documentId: _.documentId, jobId: _.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        f({ documentId: _.documentId, jobId: _.jobId });
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
    activeCommittedDocumentSource: T,
    sourceViewOnly: A,
    refreshCommittedDocument: $,
    applyIdentityEvent: O
  };
}
function kr(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function ri(e) {
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
function Ir(e, t) {
  return Ks(En(e, t));
}
function oi(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function ai(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !oi(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function Mn({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: Ws.progress,
        stage: n,
        percent: e,
        text: t
      },
      Bo.messageTargetOrigin()
    );
  } catch {
  }
}
function nn(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), Mn({ percent: t, text: n, stage: r });
}
function si(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [i, c] = P(null), [l, u] = P(null), [f, d] = P(""), [m, g] = P(0), h = f === n ? i : null, y = f === n ? l : null, w = kr(h), S = Ft(w), b = x(() => {
    g((O) => O + 1);
  }, []), v = x((O) => {
    c(O.jobPayload), u(O.manifestPayload), d(O.sessionIdentity);
  }, []), k = x((O) => {
    c(null), u(null), d(O);
  }, []), T = M(""), A = M(""), $ = x(async () => {
    const O = o.current;
    if (!O || T.current === O) return;
    const _ = Ke().loadJobPayload;
    if (typeof _ != "function") return;
    const I = a.current.value;
    T.current = O;
    try {
      const R = await _(O);
      if (s.current || a.current.value !== I || o.current !== O || !R || typeof R != "object")
        return;
      const E = kr(R);
      c(R), d(r.current), !Ft(E) && A.current === O && (A.current = ""), E === "succeeded" && A.current !== O && (A.current = O, g((L) => L + 1));
    } catch {
    } finally {
      T.current === O && (T.current = "");
    }
  }, []);
  return z(() => {
    A.current = "";
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
function _n(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function ii(e, t) {
  e(t), _n(t);
}
function ci(e) {
  const [t, n] = P(e ? "source" : "compare"), r = x((a) => {
    e && a !== "source" || (n(a), _n(a));
  }, [e]), o = x((a) => {
    ii(n, a);
  }, []);
  return z(() => (e && document.documentElement.classList.add("reader-source-only"), _n(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Rr(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function li(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Rr(n.active_job_id),
    activeVersionId: Rr(n.active_version_id)
  };
}
function ui(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function di(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function fi(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const mi = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function hi(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = mi.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const pi = 48 * 1024 * 1024;
function gi(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const bi = 2, Ee = /* @__PURE__ */ new Map();
function An(e, t) {
  Ee.delete(e), Ee.set(e, t);
}
function Tr(e) {
  if (Ee.size < bi) return;
  const t = Ee.keys().next().value;
  t && Ee.delete(t);
}
async function yi(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function jo(e, t = Bt().fetchProtected, n = {}) {
  var u, f, d, m, g, h, y, w, S;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (Ee.has(r)) {
    const b = Ee.get(r);
    return An(r, b), b;
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
    const v = await yi(s);
    throw v && (b.reason = v), b;
  }
  const i = vi(r, s, t);
  if (i) {
    o.abort();
    const b = { ranged: i };
    return Tr(), Ee.set(r, b), b;
  }
  (y = (h = n.signal) == null ? void 0 : h.addEventListener) == null || y.call(h, "abort", a, { once: !0 });
  let c;
  try {
    c = await s.arrayBuffer();
  } finally {
    (S = (w = n.signal) == null ? void 0 : w.removeEventListener) == null || S.call(w, "abort", a);
  }
  const l = { data: new Uint8Array(c) };
  return Ee.has(r) ? An(r, l) : (Tr(), Ee.set(r, l)), l;
}
function vi(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < pi ? null : {
    url: e,
    length: o,
    async fetchRange(i, c) {
      const l = await n(e, { headers: { Range: `bytes=${i}-${c - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const wi = { file: null, loading: !1, error: "" }, Si = { file: null, loading: !0, error: "" };
function ki(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = P(null);
  if (z(() => {
    if (t || !n) return;
    const s = Ee.get(n);
    if (s) {
      An(n, s);
      return;
    }
    const i = new AbortController();
    return jo(n, void 0, { signal: i.signal }).then((c) => {
      i.signal.aborted || o({ url: n, file: c, loading: !1, error: "" });
    }).catch((c) => {
      i.signal.aborted || o({ url: n, file: null, loading: !1, error: (c == null ? void 0 : c.message) || String(c) });
    }), () => i.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return wi;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = Ee.get(n);
  return a ? { file: a, loading: !1, error: "" } : Si;
}
function Ii(e) {
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
async function Nn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  nn(s, r, n, "download");
  const i = await jo(t, Bt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (nn(s, o, n, "download"), i);
}
async function Ri(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  nn(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, i = null;
  return t && a.push(
    Nn({
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
    Nn({
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
function Ti(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Ei({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = ss,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(Ti(o.href, t, a)), !0);
}
const Jt = {
  regions: null,
  metadata: null
};
function Pi(e) {
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
  } = e, [S, b] = P(""), [v, k] = P(""), [T, A] = P(null), [$, O] = P(null), [_, I] = P(!1), [R, E] = P(""), [L, C] = P([]), [U, N] = P(!1), [H, K] = P(() => ({
    source: null,
    translated: null
  })), [Y, Z] = P(
    Jt
  ), [F, W] = P({
    loading: !0,
    percent: 4,
    text: $e.boot,
    stage: "progress",
    failed: !1
  });
  return z(() => {
    const V = new AbortController(), me = h.current.value, J = Ii({
      sessionEpochRef: h,
      closingRef: y,
      abort: V,
      sessionEpoch: me
    });
    w.current = V;
    const q = Ke();
    if (y.current)
      return V.abort(), () => {
        w.current === V && (w.current = null);
      };
    let ie = !1;
    function ge(se, ce) {
      J.markFailed(), N(!0), W({
        loading: !1,
        percent: 100,
        text: se,
        stage: "failed",
        failed: !0
      }), Mn({ percent: 100, text: ce, stage: "failed" });
    }
    function ne() {
      I(!0), ie || N(!0), W({
        loading: !1,
        percent: 100,
        text: $e.ready,
        stage: "ready",
        failed: !1
      }), Mn({ percent: 100, text: $e.ready, stage: "ready" });
    }
    function he() {
      return l != null && l.documentId ? Ir(
        l.documentId,
        l.revision
      ) : Hs() ? Us : q.resolveResourceUrl(En(r));
    }
    async function ke() {
      var re;
      let se = { activeJobId: "", activeVersionId: "" };
      try {
        const ae = await ((re = q.fetchDocument) == null ? void 0 : re.call(q, r));
        ae && (se = li(ae));
      } catch {
      }
      const ce = ui({
        link: se,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (ce.kind === "follow-active-job") {
        if (J.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: ce.jobId
        }), ce.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: ce.activeVersionId,
          sessionIdentity: c
        }), m("source")) : m("compare");
        return;
      }
      if (ce.kind === "open-committed-source") {
        if (J.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: ce.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const be = he();
      if (J.isInactive()) return;
      b(be), k(""), E(""), d(c);
      const j = await Nn({
        url: be,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: J,
        setBoot: W
      });
      if (!J.isInactive()) {
        if (!j) {
          ge("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        A(j), ne();
      }
    }
    async function tt() {
      var qt;
      const se = !l, ce = !!(se && q.loadSessionSnapshot && q.loadReaderOptionalArtifacts), be = ce ? q.loadReaderOptionalArtifacts(t) : null, j = await ((qt = q.loadSessionSnapshot) == null ? void 0 : qt.call(q, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: se && !ce
      })), re = j ? {
        jobPayload: j.sourcePayload,
        manifestPayload: j.manifestPayload,
        readerMetadata: j.readerMetadata,
        regionsPayload: j.regions,
        readerErrors: j.readerErrors
      } : await q.loadReaderPayload(t, {
        includeOptionalArtifacts: se
      });
      if (J.isInactive()) return;
      let ae = null;
      if (n && !r)
        if (j && j.linkedDocument !== void 0)
          ae = j.linkedDocument;
        else {
          try {
            ae = await q.fetchDocumentByJobId(Sr, t);
          } catch {
          }
          if (J.isInactive()) return;
        }
      const Ae = ri(re.jobPayload) || `${(ae == null ? void 0 : ae.document_id) || ""}`.trim();
      Ae && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Ae
      });
      const ue = di({
        payloadDocumentId: Ae,
        linkedActiveJobId: `${(ae == null ? void 0 : ae.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(ae == null ? void 0 : ae.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (ue.kind === "restore-committed-source") {
        if (J.isInactive()) return;
        u({
          type: "committed-source",
          documentId: ue.documentId,
          revision: ue.revision,
          sessionIdentity: c
        }), m("source");
        return;
      }
      const ve = q.resolveReaderSourcePdf(re.manifestPayload), Ce = q.resolveReaderTranslatedPdfUrl(re.jobPayload, re.manifestPayload), mt = typeof ve == "string" ? ve : q.resolveReaderArtifactUrl(ve), ze = r || Ae, qe = l != null && l.documentId ? Ir(
        l.documentId,
        l.revision
      ) : mt || (ze ? q.resolveResourceUrl(En(ze)) : ""), Oe = l ? "" : Ce || "";
      b(qe || ""), k(Oe), E(ai(re.jobPayload, t)), f({
        jobPayload: re.jobPayload || null,
        manifestPayload: re.manifestPayload || null,
        sessionIdentity: c
      });
      const nt = () => Ri({
        sourceFinal: qe || "",
        translatedFinal: Oe,
        fence: J,
        setBoot: W
      }), ht = !!(qe || Oe), pt = be && ht ? nt() : null;
      pt == null || pt.catch(() => {
      });
      const Vt = (B) => {
        J.isInactive() || (C(l ? [] : No(B.regionsPayload)), K(l ? { source: null, translated: null } : ts(B.readerMetadata)), Z(l ? Jt : B.readerErrors ?? Jt), N(!0));
      };
      if (be ? (ie = !0, be.then(Vt)) : Vt(re), !ht) {
        ge($e.failed, $e.failed);
        return;
      }
      const gt = await (pt ?? nt());
      if (gt.status !== "inactive") {
        if (gt.status === "incomplete") {
          ge("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        A(gt.sourceBytes), O(gt.translatedBytes), ne();
      }
    }
    async function _e() {
      I(!1), A(null), O(null), C([]), N(!1), K({ source: null, translated: null }), Z(Jt), nn(W, 8, $e.metadata, "metadata");
      try {
        if (s) {
          await ke();
          return;
        }
        if (!t) {
          ge($e.failed, $e.failed);
          return;
        }
        await tt();
      } catch (se) {
        if (J.isClosedOrStale() || (se == null ? void 0 : se.name) === "AbortError") return;
        J.markFailed();
        const ce = Number(se == null ? void 0 : se.status), be = `${(se == null ? void 0 : se.reason) || ""}`, j = hi({ status: ce, reason: be, sessionJobId: t });
        if (j && (await Ei({
          apiPrefix: Sr,
          documentId: j,
          expiredJobId: t
        }) || J.isClosedOrStale()))
          return;
        if (fi({
          status: ce,
          reason: be,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), m("source");
          return;
        }
        const re = se instanceof Error ? se.message : $e.failed;
        ge(re, re);
      }
    }
    return _e(), () => {
      V.abort(), w.current === V && (w.current = null);
    };
  }, [t, r, o, a, s, i, l, g, n, c, u, f, d, m]), {
    sourceUrl: S,
    translatedUrl: v,
    sourceFile: T,
    translatedFile: $,
    assetsReady: _,
    title: R,
    regions: L,
    regionsSettled: U,
    readerMetadata: H,
    readerErrors: Y,
    boot: F
  };
}
function Mi() {
  const e = M(!1), t = M(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = ti(), s = M({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const i = M(a), c = M(""), l = M(""), u = M(() => {
  }), f = x(() => u.current(), []), d = ni({
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
  } = d, { mode: w, setMode: S, switchSessionMode: b } = ci(y);
  u.current = () => {
    b("source");
  }, i.current = a, c.current = g, l.current = m;
  const v = si({
    sessionJobId: m,
    sessionIdentity: a,
    sessionIdentityRef: i,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: k,
    scopedManifestPayload: T,
    jobStatus: A,
    jobTerminal: $,
    jobRefreshRevision: O,
    refreshJobArtifacts: _,
    refreshJobStatus: I
  } = v, R = Pi({
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
    var C;
    e.current = !0, (C = t.current) == null || C.abort();
  }, []), L = G(
    () => ({
      fetchProtected: Ke().fetchProtected,
      jobId: m,
      jobPayload: k,
      manifestPayload: T,
      sourceUrl: R.sourceUrl,
      translatedUrl: R.translatedUrl,
      sourceOnly: y
    }),
    [m, k, T, R.sourceUrl, R.translatedUrl, y]
  );
  return {
    jobId: m,
    jobStatus: A,
    workflow: `${(k == null ? void 0 : k.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: $,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: h,
    mode: w,
    setMode: S,
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
    download: L,
    refreshJobArtifacts: _,
    refreshJobStatus: I,
    refreshCommittedDocument: d.refreshCommittedDocument,
    prepareClose: E
  };
}
const _i = 160, Ai = 8, Ni = 0;
function Li() {
  const e = M(null), [t, n] = P(null), [r, o] = P(Ni), a = x((s) => {
    e.current = s, n(s);
  }, []);
  return z(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const i = (l) => {
      !Number.isFinite(l) || l < _i || o((u) => Math.abs(u - l) < Ai ? u : l);
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
function xi(e) {
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
const hn = { source: 0, translated: 0 };
function Di(e, t) {
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
  const [f, d] = P(() => ({
    identity: l,
    pages: hn
  })), [m, g] = P(() => ({ identity: l, tick: 0 })), h = f.identity === l ? f.pages : hn, y = m.identity === l ? m.tick : 0, w = xi({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!i || !!a,
    hasTranslated: !!c
  }), { primaryPane: S } = w, b = x((I, R) => {
    u.current === l && d((E) => {
      const L = E.identity === l ? E.pages : hn;
      return L[R] === I && E.identity === l ? E : {
        identity: l,
        pages: { ...L, [R]: I }
      };
    });
  }, [l]), v = M(null), k = x(() => {
    v.current && clearTimeout(v.current);
    const I = l;
    v.current = setTimeout(() => {
      v.current = null, u.current === I && g((R) => ({
        identity: I,
        tick: R.identity === I ? R.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  z(() => (v.current && (clearTimeout(v.current), v.current = null), d((I) => I.identity === l && I.pages.source === 0 && I.pages.translated === 0 ? I : { identity: l, pages: { source: 0, translated: 0 } }), g((I) => I.identity === l && I.tick === 0 ? I : { identity: l, tick: 0 }), () => {
    v.current && (clearTimeout(v.current), v.current = null);
  }), [l]);
  const T = G(
    () => Math.max(h.source, h.translated),
    [h]
  ), A = S === "translated" ? h.translated : h.source || h.translated, $ = t == null ? void 0 : t.userZoom, O = t == null ? void 0 : t.shellWidth, _ = `${l}-${y}-${$}-${n}-${h.source}-${h.translated}-${O}`;
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
const Re = "data-reader-page", Se = "data-reader-pane", Jn = "data-natural-height", Ci = "reader-react-root", Ho = "reader-react-grid", Uo = "reader-react-scroll-shell", dn = "reader-react-pdf-pane", Wo = "reader-react-pdf-page", rn = "reader-react-pdf-page-placeholder", Gn = "reader-react-pdf-page-slot";
function on(e, t) {
  const n = e != null ? `[${Re}="${e}"]` : `[${Re}]`;
  return t ? `${n}[${Se}="${t}"]` : n;
}
function Xn() {
  return `.${Gn}[${Re}]`;
}
function an(e) {
  return Number(e.getAttribute(Re));
}
const Ko = 0.25, sn = 1, zi = 0.05, Kt = 0.5, Oi = 16, $i = 8, Vo = Oi + $i, Fi = 720;
function Ye() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function qo(e) {
  return Number.isFinite(e) && e < Fi;
}
function wt(e, t = Number.POSITIVE_INFINITY) {
  return qo(t) && (e === "source" || e === "translated") ? sn : Kt;
}
function He(e) {
  return Number.isFinite(e) ? Math.min(sn, Math.max(Ko, e)) : Kt;
}
function jt(e, t) {
  const n = He(Number(e) + t * zi);
  return Math.round(n * 100) / 100;
}
function Bi(e) {
  return Math.round(He(e) * 100);
}
function Jo(e) {
  const n = (Number(e) || 0) - Vo;
  return Math.max(160, Math.floor(n));
}
function ji(e, t = Kt) {
  const n = He(t);
  return Jo((Number(e) || 0) * n);
}
function Hi(e, t) {
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
const Ui = 8;
function Wi(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < Ui ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const Go = 200, Xo = [
  "markdown"
], Ki = Xo;
function Zo(e) {
  return Ki.includes(e);
}
const Vi = "retainpdf:reader:view:v1:", Er = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), qi = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function Yo() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Ln(e) {
  return `${e || ""}`.trim();
}
function Ji({
  documentId: e,
  jobId: t
}) {
  const n = Ln(e);
  if (n) return `document:${n}`;
  const r = Ln(t);
  return r ? `job:${r}` : "";
}
function Qo(e) {
  const t = Ln(e);
  return t ? `${Vi}${t}` : "";
}
function Gi(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function Xi(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!Er.has(t) || !Er.has(n) || t === n))
    return { left: t, right: n };
}
function Zi(e) {
  return e === null ? null : Zo(e) ? e : void 0;
}
function Yi(e) {
  return qi.has(e) ? e : void 0;
}
function ea(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = Gi(t.anchor), r = Number(t.zoom), o = Yi(t.mode), a = Xi(t.splitLayout), s = Zi(t.assistantPanel);
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
function De(e, t = Yo()) {
  const n = Qo(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? ea(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function fn(e, t, n = Yo()) {
  const r = Qo(e);
  if (!r || !n) return null;
  const o = De(e, n), a = ea({
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
function Qi(e, t, n = "") {
  var d;
  const [r, o] = P(() => {
    var m;
    return ((m = De(n)) == null ? void 0 : m.zoom) ?? wt(e, Ye());
  }), a = M(r), s = M(n);
  a.current = r;
  const i = M(1), c = M(((d = De(n)) == null ? void 0 : d.zoom) !== void 0);
  z(() => {
    var h;
    if (s.current === n) return;
    s.current = n;
    const m = (h = De(n)) == null ? void 0 : h.zoom;
    c.current = m !== void 0;
    const g = m ?? wt(e, Ye());
    i.current = 1, a.current = g, o(g);
  }, [e, n]), z(() => {
    if (c.current) return;
    const m = wt(e, Ye()), g = a.current;
    Math.abs(m - g) < 5e-4 || (i.current = 1, a.current = m, o(m));
  }, [e]);
  const l = x((m, g) => {
    const h = He(m), y = a.current;
    Math.abs(h - y) < 5e-4 || (i.current = (g == null ? void 0 : g.keepScroll) === !1 ? 1 : h / (y || 1), a.current = h, c.current = !0, fn(s.current, { zoom: h }), o(h));
  }, []), u = x((m) => {
    l(jt(a.current, m));
  }, [l]), f = x((m) => {
    l(wt(m));
  }, [l]);
  return Te(() => {
    const m = i.current;
    Math.abs(m - 1) < 1e-3 || (i.current = 1, Hi(t == null ? void 0 : t.current, m));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: f };
}
const ec = 160, tc = 3e-3, Pr = 50, nc = 16, rc = 800;
function oc(e, t = 0) {
  const n = t === 1 ? nc : t === 2 ? rc : 1, r = Number(e) * n;
  if (!Number.isFinite(r) || r === 0) return 1;
  const o = Math.max(-Pr, Math.min(Pr, r));
  return Math.exp(-o * tc);
}
function ac(e, t, n = 0) {
  return He(e * oc(t, n));
}
function sc(e) {
  return Math.round(He(e) * 100) / 100;
}
function ic(e, t, n) {
  const r = He(e), o = Number(n);
  if (!Number.isFinite(o) || o <= 0) return He(t) / r;
  const a = (o + Vo) / r;
  return Jo(a * He(t)) / o;
}
function cc(e) {
  return Array.from(e.querySelectorAll(Xn()));
}
function lc(e, t, n) {
  const r = t < e.left ? e.left - t : t > e.right ? t - e.right : 0, o = n < e.top ? e.top - n : n > e.bottom ? n - e.bottom : 0;
  return Math.hypot(r, o);
}
function uc(e, t, n) {
  let r = null;
  for (const s of cc(e)) {
    const i = s.getBoundingClientRect();
    if (i.width <= 0 || i.height <= 0) continue;
    const c = lc(i, t, n);
    if ((!r || c < r.distance) && (r = { el: s, rect: i, distance: c }), c === 0) break;
  }
  if (!r) return null;
  const { el: o, rect: a } = r;
  return {
    page: o.getAttribute(Re) || "",
    pane: o.getAttribute(Se) || "",
    fracX: (t - a.left) / a.width,
    fracY: (n - a.top) / a.height,
    clientX: t,
    clientY: n,
    pageWidth: a.width
  };
}
function dc(e, t) {
  for (let n = e.parentElement; n && n !== t; n = n.parentElement)
    if (n.scrollWidth > n.clientWidth + 1) return n;
  return t;
}
function ta(e, t) {
  if (!t) return;
  const n = e.querySelector(
    `${Xn()}[${Re}="${t.page}"][${Se}="${t.pane}"]`
  );
  if (!n) return;
  const r = n.getBoundingClientRect(), o = r.top + t.fracY * r.height - t.clientY, a = r.left + t.fracX * r.width - t.clientX;
  Math.abs(o) >= 0.5 && (e.scrollTop += o), Math.abs(a) >= 0.5 && (dc(n, e).scrollLeft += a);
}
function fc(e, t, n, r) {
  const o = e.querySelector(`.${Ho}`);
  if (!o) return null;
  if (!o.style.transformOrigin) {
    const a = o.getBoundingClientRect();
    o.style.transformOrigin = `${n - a.left}px ${r - a.top}px`, o.style.willChange = "transform";
  }
  return o.style.transform = `scale(${t})`, o;
}
function _t(e) {
  e && (e.style.transform = "", e.style.transformOrigin = "", e.style.willChange = "");
}
const mc = 600, hc = 1e3;
function pc(e, t) {
  const n = e.firstElementChild, r = e.ownerDocument.defaultView;
  if (!n || !r || typeof r.ResizeObserver > "u") return () => {
  };
  let o = !1;
  const a = new r.ResizeObserver(() => {
    o || ta(e, t);
  });
  a.observe(n);
  const s = (u) => {
    u.type === "wheel" && u.ctrlKey || l();
  }, i = ["wheel", "keydown", "pointerdown", "touchstart"];
  for (const u of i) r.addEventListener(u, s, { capture: !0, passive: !0 });
  const c = r.setTimeout(() => l(), hc);
  function l() {
    if (!o) {
      o = !0, a.disconnect(), r == null || r.clearTimeout(c);
      for (const u of i) r == null || r.removeEventListener(u, s, { capture: !0 });
    }
  }
  return l;
}
function gc(e, t, n) {
  const r = M(t);
  r.current = t;
  const o = M(n);
  o.current = n;
  const a = M(null), s = M(null), i = M(null);
  z(() => {
    if (!e) return;
    const c = () => {
      const u = a.current;
      if (a.current = null, !u) return;
      const f = sc(u.target);
      if (Math.abs(f - r.current) < 5e-3) {
        _t(u.grid);
        return;
      }
      const d = { anchor: u.anchor, grid: u.grid, fallback: null };
      d.fallback = setTimeout(() => {
        s.current === d && (s.current = null, _t(d.grid));
      }, mc), s.current = d, o.current(f, { keepScroll: !1 });
    }, l = (u) => {
      var m, g;
      if (!u.ctrlKey) return;
      u.preventDefault();
      let f = a.current;
      if (!f) {
        (m = i.current) == null || m.call(i), i.current = null;
        const h = s.current;
        h && (h.fallback && clearTimeout(h.fallback), s.current = null, _t(h.grid)), f = {
          start: r.current,
          target: r.current,
          anchor: uc(e, u.clientX, u.clientY),
          grid: null,
          timer: null
        }, a.current = f;
      }
      f.target = ac(f.target, u.deltaY, u.deltaMode);
      const d = ic(f.start, f.target, ((g = f.anchor) == null ? void 0 : g.pageWidth) ?? 0);
      f.grid = fc(e, d, u.clientX, u.clientY) ?? f.grid, f.timer && clearTimeout(f.timer), f.timer = setTimeout(c, ec);
    };
    return e.addEventListener("wheel", l, { passive: !1 }), () => {
      var f;
      e.removeEventListener("wheel", l);
      const u = a.current;
      a.current = null, u != null && u.timer && clearTimeout(u.timer), _t((u == null ? void 0 : u.grid) ?? null), (f = i.current) == null || f.call(i), i.current = null;
    };
  }, [e]), Te(() => {
    var l;
    const c = s.current;
    c && (s.current = null, c.fallback && clearTimeout(c.fallback), _t(c.grid), !(!e || !c.anchor) && (ta(e, c.anchor), (l = i.current) == null || l.call(i), i.current = pc(e, c.anchor)));
  }, [t, e]);
}
function bc(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = M(t), a = M(n), s = M(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: x((c) => {
    c !== o.current && (s.current(), a.current(c));
  }, []) };
}
const Zn = 48;
function na(e, t = Zn) {
  return e.getBoundingClientRect().top + t;
}
function ra(e, t) {
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
  const o = an(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, i = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: i };
}
function Ot(e, t, n = Zn) {
  if (!e)
    return null;
  const r = on(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = na(e, n), i = ra(o, s);
  return i ? { page: i.page, fraction: i.fraction } : null;
}
function Tt(e, t, n = "auto", r, o = Zn) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let i = null;
  if (r && (i = e.querySelector(on(a, r))), i || (i = e.querySelector(on(a))), !i)
    return !1;
  const c = e.getBoundingClientRect(), l = i.getBoundingClientRect();
  if (c.height <= 0 || l.height < 8 && i.offsetHeight < 8)
    return !1;
  const u = l.height > 0 ? l.height : i.offsetHeight, f = e.scrollTop + (l.top - c.top), d = Math.max(0, f + s * u - o);
  return n === "auto" ? Math.abs(e.scrollTop - d) >= 1 && (e.scrollTop = d) : e.scrollTo({ top: d, behavior: n }), !0;
}
function yc(e, t, n = "smooth", r) {
  return Tt(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function xn(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const i = [], c = () => {
    var u;
    if (a) return;
    Tt(
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
function vc(e, t, n) {
  return xn(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function cn(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function Ne(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function wc(e, t, n = !0, r = "", o) {
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
    const f = on(void 0, o), d = () => {
      if (c) return;
      const h = Array.from(i.querySelectorAll(f));
      if (!h.length)
        return;
      const y = na(i), w = ra(h, y);
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
const Sc = `canvas, .react-pdf__Page, .${Wo}, .${rn}`, Mr = /* @__PURE__ */ new WeakMap();
function kc(e) {
  const t = Number(e.getAttribute(Jn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Mr.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(Sc), Mr.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Ic(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Rc(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(Xn()).forEach((r) => {
    const o = an(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = kc(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Tc(e, t, n = "", r) {
  const [o, a] = P(() => /* @__PURE__ */ new Map()), s = M(o), i = M(r);
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
      const v = Rc(b);
      Ic(s.current, v) || (s.current = v, a(v)), u && !f && (f = !0, (k = i.current) == null || k.call(i));
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
const Ec = [0, 48, 140, 320, 560], Pc = 700, Mc = [80, 200, 400], _c = 500, Ac = 50, Nc = /* @__PURE__ */ new Set([
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
]), Lc = 180, _r = [0, 48, 140, 320, 700, 1200];
function xc(e, t) {
  var R;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, i = M(
    ((R = De(a)) == null ? void 0 : R.anchor) || { page: 1, fraction: 0 }
  ), c = M(null), l = M(!1), u = M(r), f = M(null), d = M(null), m = M(null), g = M(null), h = M(a), y = M(""), w = M(n);
  w.current = n;
  const S = x(() => {
    var E;
    (E = f.current) == null || E.call(f), f.current = null, d.current != null && (clearTimeout(d.current), d.current = null);
  }, []), b = x(() => {
    !l.current && c.current == null || (S(), m.current != null && (clearTimeout(m.current), m.current = null), c.current = null, l.current = !1);
  }, [S]), v = x((E = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const L = () => {
      g.current = null, fn(h.current, {
        anchor: Ne(i.current)
      });
    };
    E ? L() : g.current = setTimeout(L, Lc);
  }, []), k = x((E) => {
    i.current = Ne(E), c.current = null, m.current != null && clearTimeout(m.current), m.current = setTimeout(() => {
      m.current = null, l.current = !1;
    }, Ac);
  }, []);
  z(() => {
    if (!o)
      return;
    let E = !1, L = null, C = null, U = null;
    const N = () => {
      if (E) return;
      const H = e.current;
      if (!H) {
        U = setTimeout(N, 50);
        return;
      }
      L = H, C = () => {
        if (l.current)
          return;
        const K = Ot(L, w.current);
        K && (i.current = K, v());
      }, L.addEventListener("scroll", C, { passive: !0 }), l.current || C();
    };
    return N(), () => {
      E = !0, U != null && clearTimeout(U), L && C && L.removeEventListener("scroll", C);
    };
  }, [o, r, n, e, v]), z(() => {
    if (!o) return;
    const E = e.current;
    if (!E) return;
    const L = (C) => {
      C.metaKey || C.ctrlKey || C.altKey || Nc.has(C.key) && b();
    };
    return E.addEventListener("wheel", b, { passive: !0 }), E.addEventListener("touchmove", b, { passive: !0 }), window.addEventListener("keydown", L), () => {
      E.removeEventListener("wheel", b), E.removeEventListener("touchmove", b), window.removeEventListener("keydown", L);
    };
  }, [o, e, b]), Te(() => {
    var L;
    if (h.current === a) return;
    v(!0), S(), m.current != null && (clearTimeout(m.current), m.current = null), h.current = a, y.current = "";
    const E = (L = De(a)) == null ? void 0 : L.anchor;
    i.current = E ? Ne(E) : { page: 1, fraction: 0 }, c.current = null, l.current = !!a, u.current = r;
  }, [a, r, v, S]), z(() => {
    var L;
    if (!o || !s || !a || y.current === a) return;
    y.current = a;
    const E = Ne(
      ((L = De(a)) == null ? void 0 : L.anchor) || { page: 1, fraction: 0 }
    );
    return i.current = E, c.current = E, l.current = !0, S(), f.current = xn(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: w.current,
        delaysMs: _r,
        onDone: () => k(E)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(E);
    }, Math.max(..._r) + 160), () => S();
  }, [o, s, a, e, k, S]), z(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, c.current = null, S();
      return;
    }
    const E = c.current ? Ne(c.current) : Ne(i.current);
    return l.current = !0, c.current = E, i.current = E, S(), f.current = xn(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Ec,
        onDone: () => k(E)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(E);
    }, Pc), () => {
      S();
    };
  }, [r, o, n, e, k, S]), z(() => () => {
    S(), m.current != null && (clearTimeout(m.current), m.current = null), v(!0);
  }, [S, v]);
  const T = x(() => {
    const E = Ot(
      e.current,
      w.current
    );
    return Ne(E || i.current);
  }, [e]), A = x(() => {
    l.current = !0;
    const E = Ot(
      e.current,
      w.current
    ), L = Ne(E ?? i.current);
    return i.current = L, c.current = L, v(), L;
  }, [e, v]), $ = x((E, L, C) => {
    const U = C || w.current, N = cn(E, L || 1), H = { page: N, fraction: 0 };
    i.current = H, l.current = !0, c.current = H, v(), S(), yc(e.current, N, "smooth", U), f.current = vc(
      () => e.current,
      N,
      {
        behavior: "auto",
        pane: U,
        delaysMs: Mc,
        onDone: () => k(H)
      }
    ), d.current = setTimeout(() => {
      d.current = null, k(H);
    }, _c);
  }, [e, k, S, v]), O = x(() => Ne(i.current), []), _ = x(() => l.current, []), I = x(() => {
    if (!l.current || !c.current)
      return;
    const E = Ne(c.current);
    Tt(
      e.current,
      E,
      "auto",
      w.current
    );
  }, [e]);
  return {
    lockFromShell: T,
    beginModeSwitch: A,
    goToPage: $,
    getAnchor: O,
    isRestoring: _,
    repinIfRestoring: I
  };
}
function Dc(e, t) {
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
function oa(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const Cc = [0, 80, 200, 400, 800], zc = 120, Oc = 400;
function $c(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: i, jobId: c, documentId: l, regionsSettled: u = !0 } = e, f = M(a);
  f.current = a;
  const d = M(s);
  d.current = s;
  const m = M(i);
  m.current = i;
  const g = M(n);
  g.current = n, z(() => {
    var v, k;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const h = qs(), y = Dc(h, d.current);
    if (y == null && (h != null && h.blockId) && !u) return;
    const w = oa(h, y, { jobId: c, documentId: l });
    if (t.current === w)
      return;
    if (y == null) {
      t.current = w, (v = g.current) == null || v.call(g);
      return;
    }
    t.current = w, h && ((k = m.current) == null || k.call(m, h, y));
    const S = [];
    let b = 0;
    for (const T of Cc)
      b = Math.max(b, T), S.push(
        setTimeout(() => {
          f.current(y);
        }, T)
      );
    return S.push(
      setTimeout(() => {
        var T;
        (T = g.current) == null || T.call(g);
      }, b + zc)
    ), () => {
      for (const T of S) clearTimeout(T);
    };
  }, [r, o, c, l, t, u]);
}
function Fc(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function Bc(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = Oc,
    jobId: i,
    documentId: c,
    applyReaderSearch: l
  } = e, u = M(a);
  u.current = a;
  const f = M(l);
  f.current = l;
  const d = M(0);
  z(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || d.current === o) return;
    const m = setTimeout(() => {
      var w;
      const g = ((w = globalThis.location) == null ? void 0 : w.search) || "", h = es(g, o, u.current);
      if (d.current = o, h === null) return;
      const y = `${new URLSearchParams(h).get("block_id") || ""}`.trim();
      t.current = oa(
        { blockId: y },
        o,
        { jobId: i, documentId: c }
      ), (f.current || Fc)(h);
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
function jc(e) {
  const t = M(""), [n, r] = P(!1), o = x(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  $c(a, t, o), Bc(e, t, n);
}
const At = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function Hc(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function Ar(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function aa(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = Ar(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = Ar(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function Uc(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = aa(r, t, n);
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
function Wc(e) {
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
function Kc(e) {
  let t = null;
  for (const [n, r] of e.pagesByPage)
    (!t || r.lastEventSeq > t.seq) && (t = { page: n + 1, seq: r.lastEventSeq });
  return t ? t.page : null;
}
function Vc(e, t) {
  return !e || e.connection === "terminal" || e.pagesByPage.size === 0 ? !1 : e.layoutByPage.has(t) && !e.pagesByPage.has(t);
}
function qc(e) {
  return e.liveTranslationAvailable && e.sourceViewOnly && !e.jobTerminal;
}
function Jc(e) {
  return e.state.connection === "terminal" && e.state.jobStatus === "succeeded" && e.state.pagesByPage.size > 0 && !e.sourceViewOnly && e.visibleMode !== "compare";
}
const Nr = [250, 500, 1e3, 2e3, 4e3], pn = [80, 160, 320, 640, 1e3, 1500], Lr = [250, 500, 1e3, 2e3, 4e3, 5e3];
function Dn(e, t) {
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
function Yn(e) {
  return is(e) ? `${e.code || ""}`.trim() : "";
}
function Gt(e, t) {
  const n = Yn(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function Gc(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const c = await o.fetchPage(e, t.page_idx, { signal: r });
      if (aa(n.pagesByPage.get(t.page_idx), t, c) !== "retry")
        return c;
      a = cs(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (c) {
      if ((c == null ? void 0 : c.name) === "AbortError") throw c;
      a = c;
      const l = Yn(c);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw c;
    }
    const i = pn[Math.min(s, pn.length - 1)];
    if (await Dn(i, r), s >= pn.length + 2) throw a;
  }
}
function Xc({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = P(At), s = M(o), i = M("");
  s.current = o;
  const c = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = Ft(l) ? l : "";
  return z(() => {
    if (!n || !c) {
      i.current = "", s.current = At, a(At);
      return;
    }
    const f = r === void 0 ? Vs() : r, d = i.current === c;
    if (i.current = c, !f) {
      const b = {
        ...d ? s.current : At,
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
      ...d ? s.current : At,
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
            layoutByPage: Hc(v),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (v) {
          if ((v == null ? void 0 : v.name) === "AbortError") return;
          const k = Yn(v);
          if (!(k === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !k)) {
            y((A) => ({
              ...A,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: Gt(v, "实时译文暂不可用")
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
            error: Gt(v, "正在等待 OCR 版面数据")
          })), await Dn(Nr[Math.min(b, Nr.length - 1)], m.signal).catch(() => {
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
                k = await Gc(
                  c,
                  v,
                  s.current,
                  m.signal,
                  f
                );
              } catch (T) {
                if ((T == null ? void 0 : T.name) === "AbortError" || m.signal.aborted) throw T;
                y((A) => ({
                  ...A,
                  lastSeq: Math.max(A.lastSeq, v.seq),
                  error: Gt(T, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              y((T) => {
                const A = Uc(T, v, k);
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
          if ((v == null ? void 0 : v.name) === "AbortError" || m.signal.aborted) return;
          y((k) => ({
            ...k,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: l,
            error: Gt(v, "实时译文连接已中断，正在重连")
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
        await Dn(Lr[Math.min(b, Lr.length - 1)], m.signal).catch(() => {
        }), b += 1;
      }
    })(), () => m.abort();
  }, [n, r, c, u]), o;
}
function Zc(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, i = `${s.value ?? ""}`.trim(), c = Number(s.count) || 0;
    i && c > 0 && o.set(i, c);
  }
  return o;
}
function Yc(e, t = !0) {
  const [n, r] = P(() => /* @__PURE__ */ new Map());
  return z(() => {
    r((i) => i.size ? /* @__PURE__ */ new Map() : i);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = Ke().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((i) => {
      !s && i && r(Zc(i));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const Qc = 4500;
function el(e) {
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
const tl = /* @__PURE__ */ new Set(["book", "translate"]);
function sa(e) {
  return !!(e.jobId && e.sourceUrl && tl.has(e.workflow));
}
function nl(e) {
  return !!(sa(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function rl() {
  const e = Mi(), t = sa({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = nl({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = M({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !Ft(o) && (r.current.running = !0);
  const a = Xc({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: i, shellWidth: c, bindShell: l } = Li(), u = Yc(e.jobId, !e.sourceOnly), f = Ji({
    documentId: e.documentId,
    jobId: e.jobId
  }), d = `${f}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: m, onZoomChange: g } = Qi(e.mode, s, f);
  gc(i, m, g);
  const h = Di(
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
  } = xc(s, {
    primaryPane: h.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: f,
    restoreReady: h.primaryNumPages > 0
  });
  z(() => {
    S();
  }, [c, S]);
  const b = Tc(
    s,
    h.compareMode,
    h.rowSyncRevision,
    S
  ), v = wc(
    s,
    h.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${m}-${h.metricsTick}`,
    h.primaryPane
  ), k = x((N, H) => {
    var Y, Z;
    const K = Math.max(
      Number(h.hudNumPages) || 0,
      Number(h.primaryNumPages) || 0,
      Number((Y = h.numPagesByPane) == null ? void 0 : Y.source) || 0,
      Number((Z = h.numPagesByPane) == null ? void 0 : Z.translated) || 0
    );
    w(N, K, H);
  }, [w, h.hudNumPages, h.primaryNumPages, h.numPagesByPane]), [T, A] = P(null), $ = M(null), O = x((N) => {
    $.current && clearTimeout($.current), A(N), N && ($.current = setTimeout(() => A(null), Qc));
  }, []);
  z(() => () => {
    $.current && clearTimeout($.current);
  }, []);
  const _ = x((N) => {
    const H = mn(e.regions, N);
    return H ? vr(H, h.primaryPane).page : null;
  }, [e.regions, h.primaryPane]), I = x((N, H) => {
    const K = H || h.primaryPane, Y = typeof N == "object" && N ? `${N.block_id || ""}`.trim() : "", Z = typeof N == "object" && N ? `${N.image_url || ""}`.trim() : "", F = typeof N == "object" && N ? N.page_idx != null ? Number(N.page_idx) + 1 : N.page != null ? Number(N.page) : null : typeof N == "number" ? N + 1 : null, W = ns(e.regions, Z, F) || mn(e.regions, Y) || (typeof N == "object" ? rs(e.regions, N) : null);
    let V = W ? vr(W, K).page : null;
    V == null && (V = el(N)), !(V == null || V < 1) && (O(W), k(V, K));
  }, [O, k, h.primaryPane, e.regions]);
  jc({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: h.hudNumPages || 0,
    currentPage: v,
    goToPage: k,
    resolveBlockPage: _,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (N) => {
      O(mn(e.regions, N.blockId));
    }
  });
  const { setModeKeepingPage: R } = bc({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: y
  });
  z(() => {
    O(null);
  }, [d, O]);
  const E = !e.boot.loading && !e.boot.failed, L = G(() => ({ bindShell: l, shellEl: i, shellWidth: c, shellRef: s }), [l, i, c, s]), C = G(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), U = G(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: m,
    onZoomChange: g,
    shell: L,
    panes: h,
    sessionFiles: C,
    rowHeights: b,
    goToPage: k,
    activeRegion: T,
    jumpToAnchor: I,
    setModeKeepingPage: R,
    download: e.download,
    showHud: E,
    viewStateKey: f,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, L, h, C, b, k, T, I, R, E, m, g, f, a, n, u]);
  return G(() => ({
    ...U,
    currentPage: v
  }), [U, v]);
}
const ol = [
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
], al = [
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
function sl(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of ol)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function il(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const cl = ".reader-notes-panel";
function ll(e) {
  return e instanceof Element ? !!e.closest(cl) : !1;
}
function ul(e) {
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
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || il(d.target) || ll(d.target))
        return;
      const m = d.key, g = sl(m);
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
              a(jt(o, 1));
              return;
            case "zoom-out":
              a(jt(o, -1));
              return;
            case "zoom-reset":
              a(wt(t, Ye()));
              return;
            case "next-page":
              c(cn(s + 1, i));
              return;
            case "prev-page":
              c(cn(s - 1, i));
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
const dl = "retainpdf:soft-reader-close";
function fl() {
  return new URL("./index.html", window.location.href).href;
}
function ml() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: dl },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function hl(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function pl() {
  if (!(typeof window > "u") && !ml()) {
    if (hl(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(fl());
  }
}
function gl({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ p("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function bl({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ D(gl, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), pl();
  }, children: [
    /* @__PURE__ */ p(ut, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ p("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
const yl = 3e3, vl = 8;
async function wl(e, t) {
  try {
    const n = typeof t == "string" ? await e.getDestination(t) : t;
    if (!Array.isArray(n) || !n.length) return null;
    const r = n[0], o = typeof r == "number" ? r : await e.getPageIndex(r);
    return Number.isInteger(o) && o >= 0 ? o + 1 : null;
  } catch {
    return null;
  }
}
function Sl(e) {
  return `${e ?? ""}`.replace(/\s+/gu, " ").trim();
}
async function kl(e) {
  let t;
  try {
    t = await e.getOutline();
  } catch {
    return [];
  }
  if (!Array.isArray(t) || !t.length) return [];
  let n = yl;
  const r = [], o = (s, i, c) => {
    const l = [];
    for (let u = 0; u < s.length && n > 0; u += 1) {
      const f = s[u], d = Sl(f == null ? void 0 : f.title);
      if (!d) continue;
      n -= 1;
      const m = c ? `${c}.${u}` : `${u}`, g = { id: m, title: d, page: null, level: i, children: [] };
      r.push({ node: g, dest: f.dest }), l.push(g), i < vl && Array.isArray(f.items) && f.items.length && (g.children = o(f.items, i + 1, m));
    }
    return l;
  }, a = o(t, 1, "");
  return await Promise.all(r.map(async ({ node: s, dest: i }) => {
    s.page = await wl(e, i);
  })), a;
}
function ia(e) {
  const t = [], n = (r) => {
    for (const o of r)
      t.push(o), n(o.children);
  };
  return n(e), t;
}
function ca(e, t) {
  let n = null;
  for (const r of ia(e))
    r.page === null || r.page > t || (!n || r.page > (n.page ?? 0) || r.page === n.page && r.id.startsWith(`${n.id}.`)) && (n = r);
  return (n == null ? void 0 : n.id) ?? null;
}
function xr(e) {
  if (!e) return [];
  const t = e.split(".");
  return t.slice(0, -1).map((n, r) => t.slice(0, r + 1).join("."));
}
let Dr = !1;
function Il() {
  if (Dr)
    return;
  const e = Bt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (Fo.GlobalWorkerOptions.workerSrc = e, Dr = !0);
}
function Rl({
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
const Ze = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Tl = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, El = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Pl = {
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
}, Cr = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function Ml(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Cr(o ?? a ?? "", Tl)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Cr(o ?? a ?? "", El)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Pl[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function _l(e) {
  return Ze(e.translatedBlockText) || Ze(e.translated.text) || Ze(e.source.text);
}
const Al = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Nl(e) {
  const t = [];
  for (const n of e) {
    if (!Al(n)) continue;
    const r = Ml(_l(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function Ll(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const xl = 24, Dl = 60;
function zr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - xl), o = Math.min(e.length, n + t.length + Dl), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function Cl(e, t, n = 200) {
  const r = Ze(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const i = Ze(a.translatedBlockText) || Ze(a.translated.text), c = i ? zr(i, r) : null, l = c ?? zr(Ze(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: c ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
function Xt(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function xt(e, t) {
  const n = Ze(t).toLowerCase();
  if (!n || !e) return Xt(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${Xt(e.slice(a, s))}<mark class="reader-find-mark">${Xt(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + Xt(e.slice(a));
}
function zl(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const la = "reader-xref", Cn = "data-xref", Dt = String.raw`[A-Z]?\d+(?:[.\-–]\d+)*[a-z]?`, Ol = new RegExp(String.raw`^\s*(?:\*\*)?\s*(Figure|FIGURE|Fig\.?|FIG\.?|Table|TABLE|图|表)\s*(${Dt})`), $l = /\\tag\s*\{\s*([^}]*?)\s*\}/g;
function zn(e) {
  return `${e || ""}`.replace(/\s+/g, "").replace(/[–—]/g, "-");
}
function Fl(e) {
  return /^(table|表)/i.test(e) ? "table" : "figure";
}
function Bl(e) {
  return `${e.source.text || e.markdown || ""}`;
}
function jl(e, t, n) {
  const r = e[t], o = (i) => {
    if (!i || i.source.page !== r.source.page) return !1;
    const c = Me(i);
    return c === "figure" || c === "table" || c === "formula";
  }, a = (i) => {
    const c = [];
    for (let l = t + i; o(e[l]) && c.length < 40; l += i) c.push(e[l]);
    return i < 0 ? c.reverse() : c;
  }, s = a(n === "table" ? 1 : -1);
  return s.length ? s : a(n === "table" ? -1 : 1);
}
function Hl(e, t, n) {
  return (e.find((o) => Me(o) === (n === "table" ? "table" : "figure")) || e[0] || t).itemId;
}
function Ul(e) {
  const t = /* @__PURE__ */ new Map(), n = (r) => {
    t.has(r.key) || t.set(r.key, r);
  };
  return e.forEach((r, o) => {
    const a = Me(r), s = Bl(r);
    if (a === "formula") {
      for (const g of s.matchAll($l)) {
        const h = zn(g[1]);
        h && n({ key: `equation:${h}`, kind: "equation", label: h, itemId: r.itemId, itemIds: [r.itemId], captionId: "" });
      }
      return;
    }
    if (a !== "text" && a !== "region") return;
    const i = Ol.exec(s);
    if (!i || !/caption/i.test(`${r.subType || ""} ${r.regionType || ""}`) && s.length > 400) return;
    const l = Fl(i[1]), u = zn(i[2]), f = jl(e, o, l), d = [...f.map((g) => g.itemId), r.itemId], m = new Map(e.map((g, h) => [g.itemId, h]));
    d.sort((g, h) => (m.get(g) ?? 0) - (m.get(h) ?? 0)), n({ key: `${l}:${u}`, kind: l, label: u, itemId: Hl(f, r, l), itemIds: d, captionId: r.itemId });
  }), t;
}
const Wl = [
  {
    re: new RegExp(String.raw`\b(Figures?|Figs?\.?|FIGURES?|FIGS?\.?|Tables?|TABLES?)\s*(${Dt})`, "g"),
    kind: (e) => /^tab/i.test(e) ? "table" : "figure"
  },
  { re: new RegExp(String.raw`\b(?:Eqs?\.?|Equations?)\s*\(\s*(${Dt})\s*\)`, "g"), kind: () => "equation" },
  { re: new RegExp(String.raw`(图|表)\s*(${Dt})`, "g"), kind: (e) => e === "表" ? "table" : "figure" },
  { re: new RegExp(String.raw`(?:式|方程|公式)\s*[（(]\s*(${Dt})\s*[）)]`, "g"), kind: () => "equation" }
];
function Kl(e, t) {
  if (!e || !t.size) return [];
  const n = [];
  for (const { re: o, kind: a } of Wl) {
    o.lastIndex = 0;
    for (const s of e.matchAll(o)) {
      const i = s.length > 2 ? s[1] : "", c = zn(s[s.length - 1]), l = `${a(i)}:${c}`;
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
function Vl(e) {
  return e.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function ql(e, t, n = "") {
  const r = Kl(e, t);
  if (!r.length) return xt(e, n);
  let o = "", a = 0;
  for (const s of r)
    o += xt(e.slice(a, s.start), n), o += `<mark class="${la}" ${Cn}="${Vl(s.key)}">${xt(e.slice(s.start, s.end), n)}</mark>`, a = s.end;
  return o + xt(e.slice(a), n);
}
const Jl = { figure: "图", table: "表", equation: "式" };
function Or(e) {
  return e.kind === "equation" ? `式 (${e.label})` : `${Jl[e.kind]} ${e.label}`;
}
function pe(e) {
  return typeof e == "string" ? e : "";
}
function Gl(e) {
  return `${e || ""}`.trim().startsWith("merged-");
}
function Xl(e) {
  const t = /^p(\d+)-/.exec(`${e || ""}`.trim());
  return t ? Number(t[1]) : 0;
}
function Zl(e) {
  return {
    source: pe(e == null ? void 0 : e.source_text) || pe(e == null ? void 0 : e.unit_source_text),
    translated: pe(e == null ? void 0 : e.protected_translated_text) || pe(e == null ? void 0 : e.translated_text)
  };
}
const Yl = {
  user: "手改",
  agent: "助手改",
  refine: "精修"
};
function ua(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" && !Array.isArray(t.data) ? t.data : t;
  return (Array.isArray(n.rows) ? n.rows : Array.isArray(n.revisions) ? n.revisions : []).filter((o) => !!o && typeof o == "object");
}
function Ql(e) {
  const t = ua(e).sort((r, o) => pe(r.ts).localeCompare(pe(o.ts)));
  return t.length ? [
    { text: pe(t[0].previous_text), label: "初译", ts: "", reason: "" },
    ...t.map((r) => ({
      text: pe(r.new_text),
      label: Yl[pe(r.source)] || pe(r.source) || "修订",
      ts: pe(r.ts),
      reason: pe(r.reason)
    }))
  ].reverse() : [];
}
function eu(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return e || "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function tu(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = n.timestamps && typeof n.timestamps == "object" ? n.timestamps : {};
  return pe(r.finished_at) || pe(n.finished_at) || "";
}
function nu(e, t) {
  const n = /* @__PURE__ */ new Map(), r = new Date(t).getTime();
  if (!t || Number.isNaN(r)) return n;
  const o = ua(e).sort((a, s) => pe(a.ts).localeCompare(pe(s.ts)));
  for (const a of o) {
    const s = new Date(pe(a.ts)).getTime(), i = pe(a.reader_item_id) || pe(a.item_id);
    !i || Number.isNaN(s) || s <= r || n.set(i, pe(a.new_text));
  }
  return n;
}
const ru = {
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
function ou(e) {
  return Array.isArray(e) ? e.filter((t) => t && typeof t == "object" && t.severity !== "warning").map((t) => {
    const n = t, r = ru[pe(n.kind)] || pe(n.kind) || "问题", o = pe(n.message).trim();
    return o && o !== r ? `${r}（${o}）` : r;
  }) : [];
}
const au = /* @__PURE__ */ new Set(["text", "formula"]);
function Qn(e) {
  return au.has(e);
}
function su(e, t) {
  const n = (e || []).find((r) => (r == null ? void 0 : r.itemId) === t);
  return !n || Qn(Me(n));
}
function iu(e) {
  const t = [], n = /* @__PURE__ */ new Set();
  for (const r of e || []) {
    const o = `${(r == null ? void 0 : r.itemId) || ""}`.trim();
    !o || n.has(o) || !Qn(Me(r)) || (n.add(o), t.push(o));
  }
  return t;
}
const cu = 300, lu = 72;
function uu(e, t) {
  if (e.width >= cu && e.height >= lu)
    return { mode: "inline", left: e.left, top: e.top, width: e.width, minHeight: e.height };
  const n = Math.max(240, Math.min(Math.max(e.width, 360), t.width - 16)), r = Math.max(8, Math.min(e.left, t.width - n - 8)), o = 6, a = e.top + e.height + o;
  return t.height - a >= 260 ? { mode: "popout", left: r, width: n, top: a } : { mode: "popout", left: r, width: n, bottom: t.height - e.top + o };
}
const du = /* @__PURE__ */ new Set(["text", "formula", "table", "figure"]);
function fu(e, t, n) {
  return e.flatMap((r) => {
    if (!du.has(Me(r.region))) return [];
    const o = lt(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function $r(e, t, n) {
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
async function mu(e) {
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
const hu = "reader-text-hover-copy", pu = "reader-text-hover-edit", gu = "reader-text-hover-zoom", bu = "reader-text-hover-id";
function yu(e = typeof window > "u" ? "" : window.location.search) {
  try {
    const t = new URLSearchParams(e).get("debug");
    return t === "1" || t === "true";
  } catch {
    return !1;
  }
}
const da = "reader-text-hover-tools";
function Zt({
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
const vu = 26, wu = 220;
function Su(e, t = wu) {
  return e.height < vu * 2 || e.width < t;
}
function ku({ state: e }) {
  return /* @__PURE__ */ p(e === "copied" ? Lo : e === "failed" ? ut : ds, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 });
}
function Iu({
  target: e,
  pane: t = "source",
  revisedCount: n = 0,
  onEdit: r,
  onZoom: o,
  frameRect: a,
  placement: s,
  tailTop: i = 0
}) {
  const [c, l] = P("idle"), [u, f] = P("idle"), [d] = P(() => yu()), m = M([]), g = (e == null ? void 0 : e.itemId) || "";
  if (z(() => {
    l("idle"), f("idle");
    const k = m.current;
    return () => {
      k.forEach((T) => window.clearTimeout(T)), m.current = [];
    };
  }, [g]), !e) return null;
  const h = os(e.highlight.region, t), y = Me(e.highlight.region), w = (k, T) => async (A) => {
    A.preventDefault(), A.stopPropagation();
    const $ = await mu(k);
    T($ ? "copied" : "failed"), m.current.push(window.setTimeout(() => T("idle"), 1200));
  }, S = y === "formula" ? "复制 LaTeX" : "复制", b = a || e.rect, v = s || (Su(b) ? "outside" : "inside");
  return /* @__PURE__ */ p("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ p(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": y,
      style: b,
      children: /* @__PURE__ */ D(
        "div",
        {
          className: da,
          "data-placement": v,
          style: v === "tail" ? { top: i } : void 0,
          children: [
            d ? /* @__PURE__ */ p(
              Zt,
              {
                className: bu,
                state: u,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: w(e.itemId, f),
                children: u === "copied" ? "已复制编号" : e.itemId
              }
            ) : null,
            t === "translated" && r && Qn(y) ? /* @__PURE__ */ p(
              Zt,
              {
                className: pu,
                state: "idle",
                label: "改这段译文",
                title: n > 0 ? `改这段译文（E；改过 ${n} 次）` : "改这段译文（E）",
                onClick: (k) => {
                  k.preventDefault(), k.stopPropagation(), r(e.itemId);
                },
                children: /* @__PURE__ */ p(qn, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null,
            h ? /* @__PURE__ */ p(
              Zt,
              {
                className: hu,
                state: c,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                title: c === "copied" ? "已复制" : c === "failed" ? "复制失败" : S,
                onClick: w(h, l),
                children: /* @__PURE__ */ p(ku, { state: c })
              }
            ) : null,
            o ? /* @__PURE__ */ p(
              Zt,
              {
                className: gu,
                state: "idle",
                label: "放大看这一块",
                title: y === "figure" ? "放大看（也可以双击图片）" : "放大看",
                onClick: (k) => {
                  k.preventDefault(), k.stopPropagation(), o(e.itemId);
                },
                children: /* @__PURE__ */ p(us, { size: 13, strokeWidth: 2.2, "aria-hidden": !0 })
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function Ru(e, t) {
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
function Tu(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const i = lt(
      Ru(e, a),
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
const Eu = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Pu = 256, Nt = /* @__PURE__ */ new Map();
function Mu(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function fa(e) {
  const t = `${e || ""}`, { text: n, slots: r } = Fs(t, { bareLatex: !0 }), o = Mu(n), a = Bs(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = Nt.get(t);
  if (!s && (s = js(o, r), Nt.set(t, s), Nt.size > Pu)) {
    const i = Nt.keys().next().value;
    i !== void 0 && Nt.delete(i);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function gn(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Be(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function _u(e, t) {
  const n = e.typography, r = Be(t) || 1, o = Be(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), i = gn(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, c = Math.max(5.5 * r, Math.min(s, i * r)), l = Be(n == null ? void 0 : n.fit_min_font_size_pt), u = Be(n == null ? void 0 : n.fit_max_font_size_pt), f = Math.max(3.5, (l || 5.5) * r), d = Math.max(
    f,
    u ? u * r : o ? o * r : c
  ), m = o ? o * r : c, g = Be(n == null ? void 0 : n.leading_em), h = [
    Be(n == null ? void 0 : n.padding_top_pt) || 0,
    Be(n == null ? void 0 : n.padding_right_pt) || 0,
    Be(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Be(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((y) => y * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Eu,
    fontSizePx: Math.max(f, Math.min(d, m)),
    minFontSizePx: f,
    maxFontSizePx: d,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (gn(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : gn(e.kind) ? "center" : "justify",
    padding: h,
    exact: !!o
  };
}
function Au(e, t, n, r) {
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
const Nu = 512, Lt = /* @__PURE__ */ new Map();
let On = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  On += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  On += 1;
}));
function Lu(e, t, n, r) {
  return [
    On,
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
function ma({ item: e, pageScale: t }) {
  const n = M(null), r = G(
    () => fa(e.translatedText),
    [e.translatedText]
  ), [o, a] = P(r.fallbackHtml), s = G(
    () => _u(e, t),
    [e, t]
  );
  z(() => {
    let f = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((d) => {
      f && a(d);
    }), () => {
      f = !1;
    };
  }, [r]), Te(() => {
    const f = n.current;
    if (!f) return;
    const [d, m, g, h] = s.padding, y = Math.max(1, e.rect.width - h - m), w = Math.max(1, e.rect.height - d - g), S = Lu(o, y, w, s);
    let b = Lt.get(S);
    if (b === void 0 && (b = Au(
      (v) => (f.style.fontSize = `${v}px`, { width: f.scrollWidth, height: f.scrollHeight }),
      y,
      w,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), Lt.set(S, b), Lt.size > Nu)) {
      const v = Lt.keys().next().value;
      v !== void 0 && Lt.delete(v);
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
function xu({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = G(
    () => Tu(e, t, n, r),
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
        ma,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Du = un(xu);
function Cu({
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
        ma,
        {
          item: {
            itemId: a.itemId,
            translatedText: t.get(a.itemId) || "",
            status: "edited",
            kind: Me(a.highlight.region),
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
const zu = un(Cu), ha = 24, Ge = ha * 2 + 4, je = 24, Ou = 4, $u = 6, at = (e) => e.left + e.width, et = (e) => e.top + e.height;
function Ct(e, t) {
  const n = Math.min(at(e), at(t)) - Math.max(e.left, t.left), r = Math.min(et(e), et(t)) - Math.max(e.top, t.top);
  return n > 1 && r > 1 ? n * r : 0;
}
const Fr = (e, t) => {
  const n = e.left + e.width / 2, r = e.top + e.height / 2;
  return n >= t.left && n <= at(t) && r >= t.top && r <= et(t);
}, Fu = (e) => e.height > 40 && e.height > e.width * 2.5;
function Bu(e, t, n) {
  if (!t.length || e.height < je || e.width < n + 8) return null;
  const r = Math.max(...t.map(et)), o = at(e) - 4 - n;
  for (const a of [r, et(e) - 2]) {
    const s = Math.max(e.top, a - je), i = { left: o, top: s, width: n, height: je };
    if (!t.some((c) => Ct(i, c) > 0)) return s - e.top;
  }
  return null;
}
function ju(e, t) {
  const n = [], r = (a) => {
    const s = ha + Ou, i = e.top - 2;
    n.push({ placement: "side-right", overhang: a, box: { left: at(e), top: i, width: s, height: Ge } }), n.push({ placement: "side-left", overhang: a, box: { left: e.left - s, top: i, width: s, height: Ge } });
  };
  r(!1), n.push({ placement: "outside", box: { left: e.left - 2, top: e.top - je - 3, width: Ge, height: je + 3 } }), n.push({ placement: "below", box: { left: e.left - 2, top: et(e), width: Ge, height: je + 3 } }), r(!0);
  const o = Bu(e, t, Ge);
  return o !== null && n.push({ placement: "tail", tailTop: o, box: { left: at(e) - 4 - Ge, top: e.top + o, width: Ge, height: je } }), n;
}
function Hu(e) {
  const { frame: t, others: n, pageWidth: r, pageHeight: o, glyphs: a = [] } = e, s = a.filter((S) => S.width > 0 && S.height > 0 && !Fu(S)), i = s.filter((S) => Fr(S, t)), c = s.filter((S) => !Fr(S, t)), l = n.filter((S) => S !== t && Ct(S, t) < t.width * t.height * 0.5), u = ju(t, i).filter(({ box: S, overhang: b }) => {
    const v = b ? $u : 0;
    return S.left >= -v && at(S) <= r + v && S.top >= 0 && et(S) <= o;
  }), f = ({ placement: S, tailTop: b }) => b === void 0 ? { placement: S } : { placement: S, tailTop: b }, d = ({ box: S }) => !c.some((b) => Ct(S, b) > 0), m = u.filter((S) => S.placement !== "tail"), g = m.find((S) => d(S) && !l.some((b) => Ct(S.box, b) > 0));
  if (g) return f(g);
  const h = m.find(d) || u.find((S) => S.placement === "tail" && d(S));
  if (h) return f(h);
  let y = null, w = Number.POSITIVE_INFINITY;
  for (const S of u) {
    const b = c.reduce((v, k) => v + Ct(S.box, k), 0);
    b < w && (y = S, w = b);
  }
  return y ? f(y) : { placement: "outside" };
}
function Uu(e, t, n) {
  if (!e) return !1;
  const { rect: r, placement: o } = e;
  if (o !== "outside" && o !== "below") return !1;
  const a = o === "outside" ? r.top - je - 3 : et(r);
  return t >= r.left - 4 && t <= r.left + Ge + 4 && n >= a && n <= a + je + 3;
}
const bn = (e) => e.left + e.width, yn = (e) => e.top + e.height;
function Wu(e, t, n = 3, r = 6) {
  let o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0;
  for (const l of t) {
    if (l.width <= 0 || l.height <= 0) continue;
    const u = l.left + l.width / 2, f = l.top + l.height / 2;
    u < e.left || u > bn(e) || f < e.top || f > yn(e) || (o = Math.min(o, l.left), a = Math.min(a, l.top), s = Math.max(s, bn(l)), i = Math.max(i, yn(l)));
  }
  if (!Number.isFinite(o)) return e;
  const c = {
    left: Math.max(e.left - r, o - n),
    top: Math.max(e.top - r, a - n),
    width: 0,
    height: 0
  };
  return c.width = Math.min(bn(e) + r, s + n) - c.left, c.height = Math.min(yn(e) + r, i + n) - c.top, c.width * c.height < e.width * e.height * 0.3 && c.height < 24 ? e : c;
}
function Ku(e) {
  const t = e.getBoundingClientRect();
  return Array.from(e.querySelectorAll(".textLayer span")).flatMap((n) => {
    var o;
    if (!((o = n.textContent) != null && o.trim())) return [];
    const r = n.getBoundingClientRect();
    return [{ left: r.left - t.left, top: r.top - t.top, width: r.width, height: r.height }];
  });
}
function Vu(e, t, n, r) {
  const [o, a] = P(null);
  return Te(() => {
    if (!t) {
      a(null);
      return;
    }
    const s = e.current, i = s ? Ku(s) : [], c = Me(t.highlight.region) === "figure", l = i.length && !c ? Wu(t.rect, i) : t.rect, u = n.filter((d) => d.itemId !== t.itemId).map((d) => d.rect), f = (s == null ? void 0 : s.clientHeight) || Number.POSITIVE_INFINITY;
    a({ rect: l, ...Hu({ frame: l, others: u, pageWidth: r, pageHeight: f, glyphs: i }) });
  }, [e, r, t, n]), o && t ? o : null;
}
const pa = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" }
], Br = { pen: 35e-4, highlighter: 0.018 }, jr = 0.015, $n = "retainpdf.reader.ink.v1:";
function Hr(e) {
  var t;
  if (!e) return [];
  try {
    const n = (t = globalThis.localStorage) == null ? void 0 : t.getItem($n + e), r = n ? JSON.parse(n) : [];
    return Array.isArray(r) ? r.filter((o) => o && Array.isArray(o.points)) : [];
  } catch {
    return [];
  }
}
function qu(e, t) {
  var n, r;
  if (e)
    try {
      t.length ? (n = globalThis.localStorage) == null || n.setItem($n + e, JSON.stringify(t)) : (r = globalThis.localStorage) == null || r.removeItem($n + e);
    } catch {
    }
}
function Ju(e, t, n, r, o, a) {
  const s = jr * jr;
  return e.filter((i) => ga(i, t, n) && i.points.some(([c, l]) => (c - r) ** 2 + ((l - o) * a) ** 2 <= s)).map((i) => i.id);
}
function ga(e, t, n) {
  return e.page === t && (e.pane || "translated") === n;
}
function Gu(e, t, n, r = 15e-4) {
  const o = e[e.length - 1];
  return o && Math.abs(o[0] - t) < r && Math.abs(o[1] - n) < r ? e : [...e, [t, n]];
}
function Xu(e) {
  const [t, n] = P(null), [r, o] = P(pa[0].key), [a, s] = P(() => Hr(e)), i = M(a), c = M([]);
  z(() => {
    const h = Hr(e);
    i.current = h, s(h), c.current = [];
  }, [e]);
  const l = x((h) => {
    i.current = h, s(h), qu(e, h);
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
  return G(
    () => ({ tool: t, color: r, strokes: a, setTool: n, setColor: o, add: f, erase: d, undo: g, clearPage: m }),
    [t, r, a, f, d, g, m]
  );
}
const Zu = "reader-ink-layer";
function Yu(e, t, n) {
  if (!e.length) return "";
  const [r, ...o] = e.map(([a, s]) => `${(a * t).toFixed(1)} ${(s * n).toFixed(1)}`);
  return o.length ? `M${r} L${o.join(" L")}` : `M${r} l0.01 0`;
}
function Ur({ stroke: e, width: t, height: n }) {
  return /* @__PURE__ */ p(
    "path",
    {
      className: `reader-ink-stroke is-${e.tool}`,
      d: Yu(e.points, t, n),
      style: { stroke: `var(--${e.color})`, strokeWidth: Math.max(1, e.width * t) }
    }
  );
}
function Qu({ page: e, pane: t, width: n, height: r, ink: o }) {
  const [a, s] = P(null), i = M(!1), c = o.strokes.filter((h) => ga(h, e, t)), l = !!o.tool;
  if (!l && !c.length) return null;
  const u = (h) => {
    const y = h.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (h.clientX - y.left) / Math.max(1, y.width))),
      Math.min(1, Math.max(0, (h.clientY - y.top) / Math.max(1, y.height)))
    ];
  }, f = (h, y) => o.erase(Ju(o.strokes, e, t, h, y, r / Math.max(1, n))), d = (h) => {
    if (!o.tool || h.button !== 0) return;
    h.preventDefault(), h.stopPropagation(), h.currentTarget.setPointerCapture(h.pointerId), i.current = !0;
    const [y, w] = u(h);
    o.tool === "eraser" ? f(y, w) : s([[y, w]]);
  }, m = (h) => {
    if (!i.current || !o.tool) return;
    h.stopPropagation();
    const [y, w] = u(h);
    o.tool === "eraser" ? f(y, w) : s((S) => S ? Gu(S, y, w) : [[y, w]]);
  }, g = (h) => {
    i.current && (i.current = !1, h.stopPropagation(), a && o.tool && o.tool !== "eraser" && o.add({ page: e, pane: t, tool: o.tool, color: o.color, width: Br[o.tool], points: a }), s(null));
  };
  return /* @__PURE__ */ D(
    "svg",
    {
      className: Zu,
      "data-ink-active": l ? o.tool : void 0,
      width: n,
      height: r,
      viewBox: `0 0 ${n} ${r}`,
      onPointerDown: d,
      onPointerMove: m,
      onPointerUp: g,
      onPointerCancel: g,
      children: [
        c.map((h) => /* @__PURE__ */ p(Ur, { stroke: h, width: n, height: r }, h.id)),
        a && o.tool && o.tool !== "eraser" ? /* @__PURE__ */ p(Ur, { stroke: { tool: o.tool, color: o.color, width: Br[o.tool], points: a }, width: n, height: r }) : null
      ]
    }
  );
}
function ed({
  port: e,
  jobId: t,
  readerItemId: n,
  memory: r,
  onSaved: o
}) {
  const [a, s] = P(null), [i, c] = P(!1), [l, u] = P([]), [f, d] = P(""), [m, g] = P(""), [h, y] = P(!1), [w, S] = P(null), [b, v] = P([]), k = r.drafts, T = r.generation, A = x(async (I, R) => {
    if (e)
      try {
        u(Ql(await e.fetchRevisions(I, R)));
      } catch {
        u([]);
      }
  }, [e]);
  z(() => {
    if (s(null), u([]), S(null), v([]), g(""), !e || !t || !n) return;
    let I = !1;
    return c(!0), e.loadItem(t, n).then((R) => {
      if (I) return;
      const E = R == null ? void 0 : R.item;
      if (!E) throw new Error("找不到这一段的译文。");
      const L = `${(R == null ? void 0 : R.item_id) || n}`, { source: C, translated: U } = Zl(E);
      s({ readerItemId: n, itemId: L, source: C, current: U }), d(k.get(n) ?? U);
    }).catch((R) => {
      I || S({ tone: "error", message: (R == null ? void 0 : R.message) || "读取这段译文失败。" });
    }).finally(() => {
      I || c(!1);
    }), A(t, n), () => {
      I = !0;
    };
  }, [e, t, n, A]);
  const $ = x((I) => {
    d(I), n && k.set(n, I);
  }, [n, k]), O = x(async (I, R) => {
    if (!e || !a || h) return !1;
    const E = I ?? f;
    if (!E.trim()) return !1;
    y(!0), S(null), v([]);
    try {
      const L = await e.revise(t, a.itemId, {
        translated_text: E,
        source: "user",
        reason: (R ?? m).trim() || "在阅读页手动修改",
        ...T.current != null ? { expected_generation: T.current } : {}
      }), C = Number(L == null ? void 0 : L.generation);
      return Number.isFinite(C) && (T.current = C), k.delete(a.readerItemId), s({ ...a, current: E }), d(E), g(""), (L == null ? void 0 : L.changed) === !1 ? S({ tone: "ok", message: "和原来一样，没有改动。" }) : (o(a.readerItemId, E), S({ tone: "ok", message: "存好了。点「重新排版」以后，译文 PDF 才会换成新的。" })), A(t, a.readerItemId), !0;
    } catch (L) {
      const C = L;
      return (C == null ? void 0 : C.reason) === "generation_mismatch" && (T.current = null), S({ tone: "error", message: (C == null ? void 0 : C.message) || "保存失败，请稍后再试。" }), v(ou(C == null ? void 0 : C.issues)), !1;
    } finally {
      y(!1);
    }
  }, [e, a, h, f, m, t, o, A, k, T]), _ = x(() => {
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
    discardDraft: _
  };
}
const ba = "reader-inline-edit";
function td({ text: e }) {
  const [t, n] = P("");
  return z(() => {
    if (!/\$|\\\(|\\\[/.test(e)) {
      n("");
      return;
    }
    let r = !0;
    const o = window.setTimeout(() => {
      const a = fa(e);
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
function nd({
  target: e,
  page: t,
  edit: n,
  showSource: r,
  regions: o,
  jumpToBlock: a
}) {
  var _;
  const s = e.itemId, i = ed({
    port: n.available && !n.blockedReason ? n.port : null,
    jobId: n.ownerJobId,
    readerItemId: s,
    memory: n.memory,
    onSaved: n.markSaved
  }), [c, l] = P(!1), [u, f] = P(!1), d = M(null), m = uu(e.rect, t), g = G(() => iu(o), [o]), h = g.indexOf(s), { loaded: y } = i, w = i.saving || i.loading, S = n.blockedReason, b = !y || i.draft === y.current, { close: v, select: k } = n, T = x((I) => {
    const R = g[h + I];
    R && (k(R), a == null || a(R));
  }, [g, h, k, a]), A = x(() => {
    i.discardDraft(), v();
  }, [i, v]), $ = x(async (I, R) => {
    await i.save(I, R) && v();
  }, [i, v]);
  z(() => {
    const I = (R) => {
      !R.altKey || R.key !== "ArrowUp" && R.key !== "ArrowDown" || (R.preventDefault(), T(R.key === "ArrowUp" ? -1 : 1));
    };
    return window.addEventListener("keydown", I), () => window.removeEventListener("keydown", I);
  }, [T]), Te(() => {
    const I = d.current;
    if (!I) return;
    I.style.height = "auto";
    const R = m.mode === "inline" ? m.minHeight : 0;
    I.style.height = `${Math.max(R, I.scrollHeight + 2)}px`;
  }, [i.draft, y, m.mode, m.mode === "inline" ? m.minHeight : 0]);
  const O = m.mode === "inline" ? { left: m.left, top: m.top, width: m.width } : { left: m.left, width: m.width, top: m.top, bottom: m.bottom };
  return /* @__PURE__ */ D(We, { children: [
    m.mode === "popout" ? /* @__PURE__ */ p("div", { className: "reader-inline-edit-frame", style: e.rect, "aria-hidden": "true" }) : null,
    /* @__PURE__ */ D(
      "div",
      {
        className: `${ba} is-${m.mode}`,
        style: O,
        role: "group",
        "aria-label": `改第 ${((_ = n.target) == null ? void 0 : _.page) || "?"} 页这一段译文`,
        "data-inline-edit-id": s,
        "data-inline-edit-mode": m.mode,
        onPointerDown: (I) => I.stopPropagation(),
        children: [
          r && (y != null && y.source) ? /* @__PURE__ */ p(
            te,
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
            zs,
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
                I.key === "Enter" && (I.metaKey || I.ctrlKey) ? (I.preventDefault(), b || $()) : I.key === "Escape" && (I.preventDefault(), A());
              }
            }
          ) : null,
          y ? /* @__PURE__ */ p(td, { text: i.draft }) : null,
          /* @__PURE__ */ D("div", { className: "reader-inline-edit-toolbar", children: [
            /* @__PURE__ */ p(ot, { className: "reader-inline-edit-step", size: "sm", label: "上一段（Alt+↑）", disabled: h <= 0, onClick: () => T(-1), children: /* @__PURE__ */ p(fs, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(ot, { className: "reader-inline-edit-step", size: "sm", label: "下一段（Alt+↓）", disabled: h < 0 || h >= g.length - 1, onClick: () => T(1), children: /* @__PURE__ */ p(xo, { size: 14, "aria-hidden": !0 }) }),
            /* @__PURE__ */ p(
              $o,
              {
                size: "sm",
                className: "reader-inline-edit-reason",
                value: i.reason,
                placeholder: "原因（可不填）",
                "aria-label": "修改原因",
                disabled: w || !!S || !y,
                onChange: (I) => i.setReason(I.target.value),
                onKeyDown: (I) => {
                  I.key === "Enter" ? (I.preventDefault(), b || $()) : I.key === "Escape" && (I.preventDefault(), A());
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
                onClick: () => f((I) => !I),
                children: [
                  /* @__PURE__ */ p(ms, { size: 13, "aria-hidden": !0 }),
                  i.history.length - 1
                ]
              }
            ) : null,
            /* @__PURE__ */ p(te, { className: "reader-inline-edit-act", variant: "ghost", size: "sm", "data-block-edit-action": "cancel", onClick: A, children: "取消" }),
            /* @__PURE__ */ p(
              te,
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
          u && y && i.history.length ? /* @__PURE__ */ p("ol", { className: "reader-inline-edit-history", "aria-label": "修订历史", children: i.history.map((I, R) => {
            const E = I.text === y.current, L = [eu(I.ts), I.label].filter(Boolean).join(" · ");
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
                    disabled: w || !!S,
                    onClick: () => {
                      $(I.text, `回到「${L.replace(" · ", " ")}」那一版`);
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
const ya = Wn(null), va = Wn(null);
function rd({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ p(ya.Provider, { value: e, children: /* @__PURE__ */ p(va.Provider, { value: t, children: n }) });
}
function Ve() {
  return Kn(ya);
}
function wa() {
  return Kn(va);
}
const Sa = 1.414;
function od({
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
  var se, ce, be;
  const b = Ve(), v = b == null ? void 0 : b.revisedBlocks, k = b == null ? void 0 : b.blockEdit, T = k == null ? void 0 : k.pendingEdits, A = b == null ? void 0 : b.editBlock, $ = (b == null ? void 0 : b.findTerm) || "", O = b == null ? void 0 : b.xrefIndex, _ = G(
    () => O != null && O.size ? ({ str: j }) => ql(j, O, $) : $ ? ({ str: j }) => xt(j, $) : void 0,
    [$, O]
  ), I = M(c ?? Sa), [R, E] = P(I.current);
  z(() => {
    c != null && Math.abs(c - I.current) >= 1e-3 && (I.current = c, E(c));
  }, [c]);
  const L = M(u);
  L.current = u;
  const C = M(null), U = M((j) => {
    var re;
    C.current = j, (re = L.current) == null || re.call(L, j);
  }).current, N = M(null), H = M(`${t}@${n}`);
  Te(() => {
    const j = `${t}@${n}`;
    H.current !== j && (H.current = j, o && sd(C.current, N.current));
  }, [o, n, t]), z(() => {
    o || vn(N.current);
  }, [o]), z(() => () => vn(N.current), []);
  const K = Math.max(120, Math.floor(t * R)), Y = Math.max(K, Math.ceil(s || 0)), Z = lt(f, t, K), F = G(
    () => fu(d, t, K),
    [K, d, t]
  ), [W, V] = P(null), me = typeof g == "function", J = me ? m ?? null : W, q = (j) => {
    me ? j !== (m ?? null) && (g == null || g(j)) : V((re) => re === j ? re : j);
  }, ie = G(
    () => F.find((j) => j.itemId === J) || null,
    [J, F]
  ), ge = r === "translated" && ((se = k == null ? void 0 : k.target) == null ? void 0 : se.itemId) || "", ne = G(
    () => ge && F.find((j) => j.itemId === ge) || null,
    [ge, F]
  ), he = Vu(C, o ? ie : null, F, t), ke = (j) => {
    var ve, Ce, mt, ze, qe;
    if (j.pointerType === "touch") return;
    if ((ve = b == null ? void 0 : b.ink) != null && ve.tool) {
      q(null);
      return;
    }
    if (j.buttons !== 0) {
      q(null);
      return;
    }
    if ((mt = (Ce = j.target) == null ? void 0 : Ce.closest) != null && mt.call(Ce, `.${da}`) || (qe = (ze = j.target) == null ? void 0 : ze.closest) != null && qe.call(ze, `.${ba}`)) return;
    const re = j.currentTarget.getBoundingClientRect(), ae = j.clientX - re.left, Ae = j.clientY - re.top;
    if (Uu(he, ae, Ae)) return;
    const ue = $r(F, ae, Ae);
    q((ue == null ? void 0 : ue.itemId) || null);
  }, tt = (j) => {
    if (j.pointerType === "mouse") return;
    const re = j.currentTarget.getBoundingClientRect(), ae = $r(
      F,
      j.clientX - re.left,
      j.clientY - re.top
    );
    q((ae == null ? void 0 : ae.itemId) || null);
  }, _e = (j) => {
    !Number.isFinite(j) || j <= 0 || Math.abs(I.current - j) < 1e-3 || (I.current = j, E(j), l == null || l(e, j));
  };
  return /* @__PURE__ */ D(
    "div",
    {
      ref: U,
      [Re]: e,
      [Se]: r,
      [Jn]: K,
      className: Gn,
      onPointerMoveCapture: ke,
      onPointerDown: tt,
      onDoubleClick: (j) => {
        var ae;
        const re = b == null ? void 0 : b.zoomBlock;
        !re || (ae = b == null ? void 0 : b.ink) != null && ae.tool || !ie || Me(ie.highlight.region) === "figure" && (j.preventDefault(), re(ie.itemId));
      },
      onPointerLeave: (j) => {
        j.pointerType === "mouse" && q(null);
      },
      style: {
        width: t,
        height: Y,
        minHeight: Y
      },
      children: [
        o ? /* @__PURE__ */ p(
          Os,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: _,
            renderAnnotationLayer: !1,
            className: Wo,
            loading: /* @__PURE__ */ p(
              "div",
              {
                className: rn,
                style: { width: t, height: K }
              }
            ),
            onLoadSuccess: (j) => {
              try {
                const re = j.getViewport({ scale: 1 });
                if (re.width > 0) {
                  const ae = re.height / re.width;
                  _e(ae);
                }
              } catch {
              }
              i == null || i();
            },
            onRenderSuccess: () => {
              vn(N.current), i == null || i();
            }
          }
        ) : /* @__PURE__ */ p(
          "div",
          {
            className: rn,
            style: { width: t, height: K },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ p("div", { ref: N, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        Z ? /* @__PURE__ */ p(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": f == null ? void 0 : f.itemId,
            style: Z,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && w ? /* @__PURE__ */ p(
          Du,
          {
            layoutPage: h,
            pageState: y,
            width: t,
            height: K
          }
        ) : null,
        o && w && S ? /* @__PURE__ */ p("div", { className: "reader-live-translation-page-note", role: "note", children: "这一页还没翻到，译好后会自动出现" }) : null,
        o && r === "translated" && (T != null && T.size) ? /* @__PURE__ */ p(zu, { targets: F, edits: T, width: t, excludeId: ne == null ? void 0 : ne.itemId }) : null,
        o && ne && k ? /* @__PURE__ */ p(
          nd,
          {
            target: ne,
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
          Qu,
          {
            page: e,
            pane: r === "translated" ? "translated" : b.compareVersion ? "compare" : "source",
            width: t,
            height: K,
            ink: b.ink
          }
        ) : null,
        (ce = b == null ? void 0 : b.askMarks) != null && ce.length && b.onAskMark ? /* @__PURE__ */ p(Rl, { marks: b.askMarks, page: e, height: K, onOpen: b.onAskMark }) : null,
        /* @__PURE__ */ p(
          Iu,
          {
            target: o && !((be = b == null ? void 0 : b.ink) != null && be.tool) && (ie == null ? void 0 : ie.itemId) !== (ne == null ? void 0 : ne.itemId) ? ie : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: ie && (v == null ? void 0 : v.get(ie.itemId)) || 0,
            onEdit: A,
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
const ad = un(od);
function sd(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function vn(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const id = 2 * 1024 * 1024;
function cd(e) {
  const t = new Fo.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const wn = 5, ld = "120% 0px", ud = 120, dd = "25% 0px";
let Wr = 1;
const Kr = /* @__PURE__ */ new WeakMap();
function fd(e) {
  if (!e) return 0;
  const t = Kr.get(e);
  if (t) return t;
  const n = Wr;
  return Wr += 1, Kr.set(e, n), n;
}
function md() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const hd = Eo(
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
    showLiveTranslation: T = t === "source",
    liveTranslationPendingLabel: A = "",
    paneAction: $
  }, O) {
    Il();
    const { file: _, loading: I, error: R } = ki(n, r), E = `${n}\0${fd(_)}`, L = M(E);
    L.current = E;
    const C = G(() => {
      const B = gi(_);
      return B ? "ranged" in B ? { range: cd(B.ranged) } : B : null;
    }, [_, n]), [U, N] = P(0), [H, K] = P(""), [Y, Z] = P(null), [F, W] = P(480), V = M(null), me = M(0), J = G(() => md(), []), q = G(() => ({
      cMapUrl: Bt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: Bt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: id,
      disableAutoFetch: !0
    }), []);
    Vn(O, () => Y, [Y]), z(() => {
      const B = (X) => {
        me.current = X, W(X);
      }, ee = (X) => {
        const de = Wi(X, me.current);
        if (de !== "ignore") {
          if (V.current && clearTimeout(V.current), de === "immediate") {
            B(X);
            return;
          }
          V.current = setTimeout(() => B(X), Go);
        }
      }, Q = !!(c && c >= 80);
      ee(Q ? c : (i == null ? void 0 : i.clientWidth) || 0);
      const fe = !Q && i && typeof ResizeObserver < "u" ? new ResizeObserver((X) => {
        var de, ye;
        ee(((ye = (de = X[0]) == null ? void 0 : de.contentRect) == null ? void 0 : ye.width) ?? i.clientWidth);
      }) : null;
      return fe && i && fe.observe(i), () => {
        fe == null || fe.disconnect(), V.current && clearTimeout(V.current);
      };
    }, [c, i, a]);
    const ie = G(
      () => ji(F, o),
      [F, o]
    ), [ge, ne] = P(() => /* @__PURE__ */ new Map()), [he, ke] = P(() => /* @__PURE__ */ new Set()), [tt, _e] = P(() => /* @__PURE__ */ new Set()), se = M(/* @__PURE__ */ new Map()), ce = M(null), be = M(null), [j, re] = P(() => /* @__PURE__ */ new Set()), ae = M(/* @__PURE__ */ new Map()), Ae = x((B, ee) => {
      ne((Q) => {
        if (Q.get(B) === ee) return Q;
        const oe = new Map(Q);
        return oe.set(B, ee), oe;
      });
    }, []), ue = x((B, ee) => {
      const Q = se.current, oe = Q.get(B), fe = [ce.current, be.current];
      if (oe)
        for (const X of fe)
          try {
            X == null || X.unobserve(oe);
          } catch {
          }
      if (ee) {
        Q.set(B, ee);
        for (const X of fe)
          try {
            X == null || X.observe(ee);
          } catch {
          }
      } else
        Q.delete(B);
    }, []), ve = M(/* @__PURE__ */ new Map()), Ce = x((B) => {
      const ee = ve.current;
      let Q = ee.get(B);
      return Q || (Q = (oe) => ue(B, oe), ee.set(B, Q)), Q;
    }, [ue]);
    z(() => {
      if (typeof IntersectionObserver > "u") return;
      const B = ae.current, ee = new IntersectionObserver(
        (Q) => {
          const oe = [], fe = [];
          for (const X of Q) {
            const de = X.target, ye = an(de);
            Number.isFinite(ye) && (X.isIntersecting ? oe : fe).push(ye);
          }
          if ((oe.length || fe.length) && ke((X) => {
            let de = null;
            for (const ye of oe)
              X.has(ye) || (de = de || new Set(X), de.add(ye));
            for (const ye of fe)
              X.has(ye) && (de = de || new Set(X), de.delete(ye));
            return de || X;
          }), oe.length) {
            for (const X of oe) {
              const de = B.get(X);
              de && (clearTimeout(de), B.delete(X));
            }
            _e((X) => {
              let de = null;
              for (const ye of oe)
                X.has(ye) || (de = de || new Set(X), de.add(ye));
              return de || X;
            });
          }
          for (const X of fe)
            B.has(X) || B.set(X, setTimeout(() => {
              B.delete(X), _e((de) => {
                if (!de.has(X)) return de;
                const ye = new Set(de);
                return ye.delete(X), ye;
              });
            }, ud));
        },
        { root: i, rootMargin: ld, threshold: 0 }
      );
      ce.current = ee;
      for (const Q of se.current.values())
        try {
          ee.observe(Q);
        } catch {
        }
      return () => {
        ee.disconnect(), ce.current === ee && (ce.current = null);
        for (const Q of B.values()) clearTimeout(Q);
        B.clear();
      };
    }, [i]), z(() => {
      if (typeof IntersectionObserver > "u") return;
      const B = new IntersectionObserver(
        (ee) => {
          re((Q) => {
            let oe = null;
            for (const fe of ee) {
              const X = an(fe.target);
              !Number.isFinite(X) || fe.isIntersecting === Q.has(X) || (oe = oe || new Set(Q), fe.isIntersecting ? oe.add(X) : oe.delete(X));
            }
            return oe || Q;
          });
        },
        { root: i, rootMargin: dd, threshold: 0 }
      );
      be.current = B;
      for (const ee of se.current.values())
        try {
          B.observe(ee);
        } catch {
        }
      return () => {
        B.disconnect(), be.current === B && (be.current = null);
      };
    }, [i]);
    const mt = !!i && typeof IntersectionObserver < "u";
    Te(() => {
      N(0), K(""), ke(/* @__PURE__ */ new Set()), _e(/* @__PURE__ */ new Set()), ne(/* @__PURE__ */ new Map()), se.current.clear();
      const B = ae.current;
      for (const ee of B.values()) clearTimeout(ee);
      B.clear(), h == null || h(0, t);
    }, [E, h, t]);
    const ze = x(
      (B) => {
        if (L.current !== E) return;
        const ee = B.numPages;
        N(ee), K(""), h == null || h(ee, t), f == null || f({ numPages: ee, pane: t }), m && typeof B.getPage == "function" && m(B, t), d && typeof B.getOutline == "function" && kl(B).then((Q) => {
          L.current === E && d(Q, t);
        }, () => {
        });
      },
      [E, f, d, m, h, t]
    ), qe = x(
      (B) => {
        if (L.current !== E) return;
        const ee = (B == null ? void 0 : B.message) || "PDF 解析失败";
        K(ee), N(0), h == null || h(0, t), g == null || g(B, t);
      },
      [E, g, h, t]
    ), Oe = G(
      () => U > 0 ? Array.from({ length: U }, (B, ee) => ee + 1) : [],
      [U]
    );
    z(() => {
      typeof IntersectionObserver < "u" || _e(new Set(Oe));
    }, [Oe]);
    const nt = G(
      () => Rt(y, S, t),
      [y, S, t]
    ), ht = G(() => {
      const B = /* @__PURE__ */ new Map();
      for (const ee of w) {
        const Q = Rt(ee, S, t);
        if (!Q) continue;
        const oe = B.get(Q.box.page) || [];
        oe.push(Q), B.set(Q.box.page, oe);
      }
      return B;
    }, [t, S, w]), pt = G(() => {
      const B = /* @__PURE__ */ new Set();
      if (!b) return B;
      for (const [ee, Q] of ht)
        Q.some((oe) => oe.itemId === b) && B.add(ee);
      return B;
    }, [b, ht]), Vt = G(() => {
      if (U === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!i && typeof IntersectionObserver < "u")) return new Set(Oe);
      if (he.size === 0) {
        const Q = Math.min(U, wn * 2 + 1);
        return new Set(Array.from({ length: Q }, (oe, fe) => fe + 1));
      }
      const ee = /* @__PURE__ */ new Set();
      for (const Q of he)
        for (let oe = -wn; oe <= wn; oe++) {
          const fe = Q + oe;
          fe >= 1 && fe <= U && ee.add(fe);
        }
      return ee;
    }, [U, Oe, i, a, he]), gt = !n || !!R || !!H, qt = n && (R || H) || s;
    return /* @__PURE__ */ D(
      "section",
      {
        ref: Z,
        className: `reader-panel ${dn}${a ? "" : " is-hidden"}`,
        [Se]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (k == null ? void 0 : k.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          $ ? /* @__PURE__ */ p("div", { className: "reader-react-pdf-pane-action", children: $ }) : null,
          A ? /* @__PURE__ */ D("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ p("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ p("span", { children: A })
          ] }) : null,
          gt && !I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: qt }) : null,
          I ? /* @__PURE__ */ p("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          C && !R ? /* @__PURE__ */ p("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ p(
            $s,
            {
              file: C,
              loading: null,
              error: null,
              options: q,
              onLoadSuccess: ze,
              onLoadError: qe,
              className: "reader-react-pdf-document",
              children: Oe.map((B) => {
                if (Vt.has(B))
                  return /* @__PURE__ */ p(
                    ad,
                    {
                      pane: t,
                      pageNumber: B,
                      width: ie,
                      devicePixelRatio: J,
                      active: tt.has(B),
                      textLayer: !mt || j.has(B),
                      syncedMinHeight: (l == null ? void 0 : l.get(B)) || 0,
                      onMetrics: u,
                      cachedAspect: ge.get(B),
                      onAspectChange: Ae,
                      sentinelRef: Ce(B),
                      regionHighlight: (nt == null ? void 0 : nt.box.page) === B ? nt : null,
                      regionTargets: ht.get(B),
                      hoveredRegionId: b && pt.has(B) ? b : null,
                      onHoverRegion: v,
                      liveTranslationLayout: k == null ? void 0 : k.layoutByPage.get(B - 1),
                      liveTranslationPage: k == null ? void 0 : k.pagesByPage.get(B - 1),
                      showLiveTranslation: T,
                      liveTranslationMissing: Vc(k, B - 1)
                    },
                    `${t}-${B}`
                  );
                const Q = ge.get(B) ?? Sa, oe = Math.max(120, Math.floor(ie * Q)), fe = Math.max(oe, Math.ceil((l == null ? void 0 : l.get(B)) || 0));
                return /* @__PURE__ */ p(
                  "div",
                  {
                    ref: Ce(B),
                    [Re]: B,
                    [Se]: t,
                    [Jn]: oe,
                    className: `${Gn} is-placeholder`,
                    style: {
                      width: ie,
                      height: fe,
                      minHeight: fe
                    },
                    children: /* @__PURE__ */ p(
                      "div",
                      {
                        className: rn,
                        style: { width: ie, height: oe },
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
), Vr = un(hd), pd = 2e3, gd = 6, bd = 500, qr = "reader-react-resizing";
function yd(e, t) {
  const n = M(null), r = M(null);
  Te(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const v = vd(e), k = Ot(e, v);
      if (!k) return;
      s = { pane: v, progress: k, started: performance.now() };
    }
    const { pane: i, progress: c, started: l } = s;
    let u = 0, f = null, d = e.scrollHeight, m = d, g = 0, h = l;
    const y = /* @__PURE__ */ new WeakMap(), w = typeof ResizeObserver > "u" ? null : new ResizeObserver((v) => {
      let k = !1;
      for (const T of v) {
        const A = Math.round(T.contentRect.height);
        y.has(T.target) && y.get(T.target) !== A && (k = !0), y.set(T.target, A);
      }
      k && Tt(e, c, "auto", i);
    }), S = () => {
      var v;
      f && clearTimeout(f), cancelAnimationFrame(u), w == null || w.disconnect(), e.classList.remove(qr);
      for (const k of Jr) e.removeEventListener(k, S);
      ((v = r.current) == null ? void 0 : v.stop) === S && (r.current = null);
    }, b = () => {
      Tt(e, c, "auto", i);
      const v = e.scrollHeight;
      g = v === m ? g + 1 : 0, m = v;
      const k = performance.now() - h;
      g >= gd && (v !== d || k > bd) || k > pd ? S() : u = requestAnimationFrame(b);
    };
    for (const v of Jr) e.addEventListener(v, S, { passive: !0 });
    for (const v of Array.from(e.children)) w == null || w.observe(v);
    e.classList.add(qr), r.current = { ...s, stop: S }, f = setTimeout(() => {
      f = null, h = performance.now(), d = e.scrollHeight, m = d, g = 0, u = requestAnimationFrame(b);
    }, Go);
  }, [e, t]), z(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function vd(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Re}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(Se) || null;
  }
  return null;
}
const Jr = ["wheel", "touchstart", "keydown", "pointerdown"];
function wd(e, t) {
  const n = e.scrollWidth - e.clientWidth, r = t.scrollWidth - t.clientWidth;
  return n <= 1 ? null : r <= 1 ? 0 : Math.min(1, Math.max(0, e.scrollLeft / n)) * r;
}
function Sd(e) {
  var t, n;
  return !!(e && ((t = e.classList) != null && t.contains(dn)) && ((n = e.hasAttribute) != null && n.call(e, Se)));
}
function kd(e, t) {
  z(() => {
    if (!e || !t) return;
    const n = /* @__PURE__ */ new WeakSet(), r = (o) => {
      const a = o.target;
      if (!Sd(a) || a.classList.contains("is-hidden")) return;
      if (n.has(a)) {
        n.delete(a);
        return;
      }
      const s = Array.from(e.querySelectorAll(`.${dn}[${Se}]`));
      for (const i of s) {
        if (i === a || i.classList.contains("is-hidden")) continue;
        const c = wd(a, i);
        if (c === null || Math.abs(i.scrollLeft - c) < 1) continue;
        const l = i.scrollLeft;
        i.scrollLeft = c, Math.abs(i.scrollLeft - l) >= 0.5 && n.add(i);
      }
    };
    return e.addEventListener("scroll", r, { capture: !0, passive: !0 }), () => e.removeEventListener("scroll", r, { capture: !0 });
  }, [e, t]);
}
function Id(e, t, n = 32) {
  const { width: r, scrollWidth: o, scrollLeft: a } = e, s = o - r;
  if (!(t > 0) || !(r > 0) || s <= 1) return null;
  const i = Math.min(t, Math.max(n, r / o * t)), c = t - i, l = Math.min(1, Math.max(0, a / s));
  return { size: i, offset: c * l };
}
function Rd(e, t, n, r) {
  const o = t - n, a = e.scrollWidth - e.width;
  return o <= 0 || a <= 0 ? 0 : r * a / o;
}
const Gr = 12;
function er(e) {
  return Array.from(e.querySelectorAll(`.${dn}[${Se}]`)).filter((t) => !t.classList.contains("is-hidden") && t.clientWidth > 0);
}
function Td(e) {
  const t = e.getBoundingClientRect();
  return er(e).map((n) => {
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
function Ed(e, t) {
  return e.length === t.length && e.every((n, r) => {
    const o = t[r];
    return n.pane === o.pane && Math.abs(n.left - o.left) < 0.5 && Math.abs(n.width - o.width) < 0.5 && Math.abs(n.scrollWidth - o.scrollWidth) < 0.5 && Math.abs(n.scrollLeft - o.scrollLeft) < 0.5;
  });
}
function Pd(e, t) {
  return e ? er(e).find((n) => n.getAttribute(Se) === t) ?? null : null;
}
function Md({ shellEl: e }) {
  const [t, n] = P([]), r = M(0), o = x(() => {
    !e || r.current || (r.current = requestAnimationFrame(() => {
      r.current = 0;
      const s = Td(e);
      n((i) => Ed(i, s) ? i : s);
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
        for (const f of er(e))
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
  return a.length ? /* @__PURE__ */ p("div", { className: "reader-pane-scrollbars", "data-reader-pane-scrollbars": "true", children: a.map((s) => /* @__PURE__ */ p(_d, { metrics: s, shellEl: e }, s.pane)) }) : null;
}
function _d({ metrics: e, shellEl: t }) {
  const n = Math.max(0, e.width - Gr * 2), r = Id(e, n), o = M(null);
  if (!r) return null;
  const a = (d) => {
    const m = Pd(t, e.pane);
    m && (m.scrollLeft = d);
  }, s = (d) => {
    var m, g;
    d.button === 0 && (d.preventDefault(), d.stopPropagation(), (g = (m = d.currentTarget).setPointerCapture) == null || g.call(m, d.pointerId), o.current = { startX: d.clientX, startScroll: e.scrollLeft, pointerId: d.pointerId });
  }, i = (d) => {
    const m = o.current;
    !m || m.pointerId !== d.pointerId || a(m.startScroll + Rd(e, n, r.size, d.clientX - m.startX));
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
      style: { left: e.left + Gr, width: n },
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
function ka(e) {
  const t = new Date(e);
  if (!e || Number.isNaN(t.getTime())) return "";
  const n = (r) => `${r}`.padStart(2, "0");
  return `${t.getMonth() + 1}月${t.getDate()}日 ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function Ad(e) {
  const t = e.indexOf(" · ");
  return t > 0 ? { engine: e.slice(0, t), model: e.slice(t + 3) } : { engine: "", model: e };
}
function Nd({ compare: e, onDone: t }) {
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
            /* @__PURE__ */ p("span", { className: "reader-version-compare-time", children: ka(n.createdAt) }),
            r ? /* @__PURE__ */ p("span", { className: "reader-version-compare-tag", children: "正在读" }) : null,
            o ? /* @__PURE__ */ p(Lo, { size: 14, "aria-hidden": !0 }) : null,
            a ? /* @__PURE__ */ p(hs, { size: 14, className: "reader-version-compare-spin", "aria-hidden": !0 }) : null
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
            /* @__PURE__ */ p(ps, { size: 13, "aria-hidden": !0 }),
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
            /* @__PURE__ */ p(gs, { size: 13, "aria-hidden": !0 }),
            "退出对比"
          ]
        }
      )
    ] }) : null
  ] });
}
function Xr({ role: e, name: t, createdAt: n }) {
  const { engine: r, model: o } = Ad(t), a = [e === "compare" ? "对比" : "正在读", r, ka(n)].filter(Boolean).join(" · ");
  return /* @__PURE__ */ D("div", { className: `reader-version-watermark is-${e}`, "data-version-watermark": e, children: [
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
  }, [e]), /* @__PURE__ */ D("div", { className: "reader-version-watermarks", "aria-hidden": "true", children: [
    r.source ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.source.x, top: r.source.top }, children: /* @__PURE__ */ p(Xr, { role: "compare", ...t }) }) : null,
    r.translated ? /* @__PURE__ */ p("div", { className: "reader-version-watermark-slot", style: { left: r.translated.x, top: r.translated.top }, children: /* @__PURE__ */ p(Xr, { role: "reading", ...n }) }) : null
  ] });
}
const xd = () => () => {
}, Zr = () => null;
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
function Cd(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function zd(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Od(e) {
  const t = Ve(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", i = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", c = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, f = e.bindShell ?? (t == null ? void 0 : t.bindShell), d = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, m = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Kt, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, h = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), y = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, w = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, S = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, b = (t == null ? void 0 : t.compareVersion) ?? null, v = (b == null ? void 0 : b.url) ?? e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", k = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", T = b ? null : e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, A = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, $ = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), O = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), _ = t == null ? void 0 : t.onPdfOutline, I = t == null ? void 0 : t.onPdfDocument, R = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), E = e.regions ?? (t == null ? void 0 : t.regions) ?? [], L = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), C = (t == null ? void 0 : t.regionHover) ?? null, [U, N] = P(null), H = Po(
    C ? C.subscribe : xd,
    C ? () => C.get().itemId : Zr,
    C ? () => C.get().itemId : Zr
  ), K = C ? H : U, Y = x((V) => {
    C ? C.set(V, "pdf") : N(V);
  }, [C]), Z = Dd({
    mode: s,
    compareMode: i,
    showSource: c,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), W = Number.isFinite(g) && g > 0 ? Cd(
    g,
    n || r,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return yd(d, W), kd(d, Z.compareMode), /* @__PURE__ */ D(
    "div",
    {
      ref: f,
      className: Uo,
      "data-reader-region-count": E.length,
      "data-reader-structured-region-count": E.filter(as).length,
      "data-reader-metadata-ready": L ? "true" : "false",
      children: [
        /* @__PURE__ */ D(
          "main",
          {
            className: `${Ho} reader-mode-${Z.mode}`,
            "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
            children: [
              y ? /* @__PURE__ */ p(
                Vr,
                {
                  pane: "source",
                  url: v,
                  preloadedFile: T,
                  userZoom: m,
                  visible: Z.showSource,
                  scrollRoot: d,
                  pageWidthOverride: W,
                  rowHeights: Z.compareMode ? h : void 0,
                  onMetrics: $,
                  emptyLabel: S ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                  onNumPagesChange: O,
                  onOutline: b ? void 0 : _,
                  onDocument: b ? void 0 : I,
                  activeRegion: R,
                  regions: (b == null ? void 0 : b.regions) ?? E,
                  readerMetadata: L,
                  hoveredRegionId: K,
                  onHoverRegion: Y,
                  liveTranslation: u ? o : void 0,
                  showLiveTranslation: u,
                  liveTranslationPendingLabel: u ? zd(o) : "",
                  paneAction: u && Z.showTranslated ? /* @__PURE__ */ D(We, { children: [
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
                Vr,
                {
                  pane: "translated",
                  url: k,
                  preloadedFile: A,
                  userZoom: m,
                  visible: Z.showTranslated,
                  scrollRoot: d,
                  pageWidthOverride: W,
                  rowHeights: Z.compareMode ? h : void 0,
                  onMetrics: $,
                  emptyLabel: "暂无译文 PDF",
                  onNumPagesChange: O,
                  onOutline: _,
                  onDocument: I,
                  activeRegion: R,
                  regions: E,
                  readerMetadata: L,
                  hoveredRegionId: K,
                  onHoverRegion: Y,
                  liveTranslation: void 0,
                  showLiveTranslation: !1
                }
              ) : null
            ]
          }
        ),
        /* @__PURE__ */ p(Md, { shellEl: d }),
        b ? /* @__PURE__ */ p(Ld, { shellEl: d, left: b.left, right: b.right }) : null
      ]
    }
  );
}
const $d = [
  { id: "source", label: "原文", Icon: Do },
  { id: "compare", label: "对照", Icon: Co },
  { id: "translated", label: "译文", Icon: zo }
];
function Fd(e) {
  if (e.connection === "live") {
    const t = e.layoutByPage.size;
    return t > 0 ? `已译 ${e.pagesByPage.size} / ${t} 页` : `已译 ${e.pagesByPage.size} 页`;
  }
  return e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function Bd(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function jd(e) {
  const t = Ve(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null,
    completion: s = null
  } = e, i = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? Fd(a.state) : "";
  return /* @__PURE__ */ D("header", { className: "reader-workspace-bar", children: [
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-left", "aria-hidden": "true" }),
    /* @__PURE__ */ p("span", { className: "theme-ornament", "data-ornament": "reader-bar-right", "aria-hidden": "true" }),
    /* @__PURE__ */ D("div", { className: "reader-workspace-center", children: [
      /* @__PURE__ */ p("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: $d.map(({ id: l, label: u, Icon: f }) => {
        const d = n === l, m = Bd({
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
              /* @__PURE__ */ p(bs, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
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
              /* @__PURE__ */ p(ys, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
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
            /* @__PURE__ */ p(vs, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ p("span", { className: "reader-live-translation-toggle-label", children: "翻译完成 · 看对照" })
          ]
        }
      ) }) : null
    ] })
  ] });
}
const Hd = Eo(function({ size: t = 24, strokeWidth: n = 2, color: r = "currentColor", className: o, ...a }, s) {
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
}), Ud = Hd, Wd = {
  markdown: { label: "Markdown", short: "MD", Icon: Ud, needsJob: !0 }
}, Kd = Xo.map(
  (e) => ({ id: e, ...Wd[e] })
);
function Ia() {
  return Kd.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function Vd(e) {
  const t = Ve(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ p(We, { children: Ia().map(({ id: s, label: i, Icon: c, needsJob: l }) => {
    const u = n === s, f = l && r, d = u ? `收起${i}` : `打开${i}`;
    return /* @__PURE__ */ D(
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
function qd(e) {
  const t = Ve(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), i = Ia().map(({ id: c, label: l, short: u, Icon: f, needsJob: d }) => ({
    key: c,
    label: l,
    short: u,
    Icon: f,
    disabled: d && o,
    selected: n === c,
    badge: r == null ? void 0 : r[c],
    onClick: () => a(c)
  }));
  return n ? /* @__PURE__ */ D("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ p("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: i.map(({ key: c, label: l, Icon: u, disabled: f, selected: d, badge: m, onClick: g }) => /* @__PURE__ */ D(
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
        children: /* @__PURE__ */ p(ut, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function Jd(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Gd(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Xd(e) {
  return e / 100 * window.innerHeight;
}
function Zd(e) {
  return e / 100 * window.innerWidth;
}
function Yd(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function zt({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = Yd(n);
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
      r = Gd(t, o);
      break;
    }
    case "em": {
      r = Jd(t, o);
      break;
    }
    case "vh": {
      r = Xd(o);
      break;
    }
    case "vw": {
      r = Zd(o);
      break;
    }
  }
  return r;
}
function Ie(e) {
  return parseFloat(e.toFixed(3));
}
function Et({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function Fn(e) {
  const { panels: t } = e, n = Et({ group: e });
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
      const u = zt({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = Ie(u / n * 100);
    }
    let i;
    if (a.defaultSize !== void 0) {
      const u = zt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      i = Ie(u / n * 100);
    }
    let c = 0;
    if (a.minSize !== void 0) {
      const u = zt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      c = Ie(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = zt({
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
function le(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function Bn(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? Qd : ef
  );
}
function Qd(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function ef(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function Ra(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function Ta(e, t) {
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
function tf({
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
    const { x: i, y: c } = Ta(r, s), l = e === "horizontal" ? i : c;
    l < a && (a = l, o = s);
  }
  return le(o, "No rect found"), o;
}
let Yt;
function nf() {
  return Yt === void 0 && (typeof matchMedia == "function" ? Yt = !!matchMedia("(pointer:coarse)").matches : Yt = !1), Yt;
}
function Ea(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = Bn(
    n,
    Array.from(t.children).filter(Ra).map((g) => ({ element: g }))
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
                  const T = m[0], A = tf({
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
              const T = nf() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (k.width < T) {
                const $ = T - k.width;
                k = new DOMRect(
                  k.x - $ / 2,
                  k.y,
                  k.width + $,
                  k.height
                );
              }
              if (k.height < T) {
                const $ = T - k.height;
                k = new DOMRect(
                  k.x,
                  k.y - $ / 2,
                  k.width,
                  k.height + $
                );
              }
              const A = g <= l || g > u;
              !i && !A && s.push({
                group: e,
                groupSize: Et({ group: e }),
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
var Xe;
class Pa {
  constructor() {
    br(this, Xe, {});
  }
  addListener(t, n) {
    const r = Mt(this, Xe)[t];
    return r === void 0 ? Mt(this, Xe)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = Mt(this, Xe)[t];
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
    yr(this, Xe, {});
  }
  removeListener(t, n) {
    const r = Mt(this, Xe)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
Xe = new WeakMap();
let kt = {
  cursorFlags: 0,
  state: "inactive"
};
const tr = new Pa();
function st() {
  return kt;
}
function rf(e) {
  return tr.addListener("change", e);
}
function of(e) {
  const t = kt, n = { ...kt };
  n.cursorFlags = e, kt = n, tr.emit("change", {
    prev: t,
    next: n
  });
}
function It(e) {
  const t = kt;
  kt = e, tr.emit("change", {
    prev: t,
    next: e
  });
}
const af = (e) => e, Sn = () => {
}, Ma = 1, _a = 2, Aa = 4, Na = 8, Yr = 3, Qr = 12;
let Qt;
function eo() {
  return Qt === void 0 && (Qt = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (Qt = !0)), Qt;
}
function sf({
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
        if (e && eo()) {
          const a = (e & Ma) !== 0, s = (e & _a) !== 0, i = (e & Aa) !== 0, c = (e & Na) !== 0;
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
    return eo() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const to = /* @__PURE__ */ new WeakMap();
function nr(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = to.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = st();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = sf({
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
  to.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let xe = /* @__PURE__ */ new Map();
const La = new Pa();
function cf(e) {
  xe = new Map(xe), xe.delete(e);
}
function no(e, t) {
  for (const [n] of xe)
    if (n.id === e)
      return n;
}
function Qe(e, t) {
  for (const [n, r] of xe)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function dt() {
  return xe;
}
function rr(e, t) {
  return La.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Ue(e, t, n) {
  const r = xe.get(e);
  xe = new Map(xe), xe.set(e, t), La.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function xa(e) {
  const t = st();
  let n = !1;
  switch (t.state) {
    case "active":
      It({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (nr(e), n = !0, t.hitRegions.forEach((r) => {
        const o = Qe(r.group.id, !0);
        Ue(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function ro(e) {
  e.defaultPrevented || xa(e.currentTarget);
}
function lf(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = Ta(n, a.rect);
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
function uf(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function df(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: so(e),
    b: so(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  le(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: ao(oo(n.a)),
    b: ao(oo(n.b))
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
const ff = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function mf(e) {
  const t = getComputedStyle(Da(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function hf(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || mf(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || ff.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function oo(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (le(n, "Missing node"), hf(n)) return n;
  }
  return null;
}
function ao(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function so(e) {
  const t = [];
  for (; e; )
    t.push(e), e = Da(e);
  return t;
}
function Da(e) {
  const { parentNode: t } = e;
  return uf(t) ? t.host : t;
}
function pf(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function gf({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!Ra(n) || n.contains(e) || e.contains(n))
    return !0;
  if (df(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (pf(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function or(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = Ea(o), s = lf(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && gf({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function bf(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function we(e, t, n = 0) {
  return Math.abs(Ie(e) - Ie(t)) <= n;
}
function Le(e, t) {
  return we(e, t) ? 0 : e > t ? 1 : -1;
}
function St({
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
  if (Le(r, c) < 0)
    if (a) {
      const l = (o + c) / 2;
      Le(r, l) < 0 ? r = o : r = c;
    } else
      r = c;
  return r = Math.min(i, r), r = Ie(r), r;
}
function Ht({
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
  le(u != null, "Invalid first pivot index"), le(f != null, "Invalid second pivot index");
  let d = 0;
  switch (a) {
    case "keyboard": {
      {
        const h = e < 0 ? f : u, y = n[h];
        le(
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
          if (le(
            v != null,
            `Previous layout not found for panel index ${h}`
          ), we(v, w)) {
            const k = b - v;
            Le(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      {
        const h = e < 0 ? u : f, y = n[h];
        le(
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
          if (le(
            v != null,
            `Previous layout not found for panel index ${h}`
          ), we(v, b)) {
            const k = v - w;
            Le(k, Math.abs(e)) > 0 && (e = e < 0 ? 0 - k : k);
          }
        }
      }
      break;
    }
    default: {
      const h = e < 0 ? f : u, y = n[h];
      le(
        y,
        `Panel constraints not found for index ${h}`
      );
      const w = i[h], { collapsible: S, collapsedSize: b, minSize: v } = y;
      if (S && Le(w, v) < 0)
        if (e > 0) {
          const k = v - b, T = k / 2, A = w + e;
          Le(A, v) < 0 && (e = Le(e, T) <= 0 ? 0 : k);
        } else {
          const k = v - b, T = 100 - k / 2, A = w - e;
          Le(A, v) < 0 && (e = Le(100 + e, T) > 0 ? 0 : -k);
        }
      break;
    }
  }
  {
    const h = e < 0 ? 1 : -1;
    let y = e < 0 ? f : u, w = 0;
    for (; ; ) {
      const b = i[y];
      le(
        b != null,
        `Previous layout not found for panel index ${y}`
      );
      const v = St({
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
      le(
        w != null,
        `Previous layout not found for panel index ${h}`
      );
      const S = w - y, b = St({
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
  if (bf(c, l))
    return o;
  {
    const h = e < 0 ? f : u, y = i[h];
    le(
      y != null,
      `Previous layout not found for panel index ${h}`
    );
    const w = y + d, S = St({
      overrideDisabledPanels: s,
      panelConstraints: n[h],
      prevSize: y,
      size: w
    });
    if (l[h] = S, !we(S, w)) {
      let b = w - S, v = e < 0 ? f : u;
      for (; v >= 0 && v < n.length; ) {
        const k = l[v];
        le(
          k != null,
          `Previous layout not found for panel index ${v}`
        );
        const T = k + b, A = St({
          overrideDisabledPanels: s,
          panelConstraints: n[v],
          prevSize: k,
          size: T
        });
        if (we(k, A) || (b -= A - k, l[v] = A), we(b, 0))
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
function it(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || Le(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function ct({
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
    const u = St({
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
      le(c != null, `No layout data found for index ${i}`);
      const l = c + a, u = St({
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
function Ca({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const c = dt();
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
        [t]: Ie(100 - y)
      };
    }
    return Ht({
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
    }), w = ct({
      layout: y,
      panelConstraints: f
    });
    it(g, w) || Ue(d, {
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
      const { group: l } = n(), { element: u } = o(), f = Et({ group: l }), d = zt({
        groupSize: f,
        panelElement: u,
        styleProp: c
      }), m = Ie(d / f * 100);
      i(m);
    }
  };
}
function io(e) {
  if (e.defaultPrevented)
    return;
  const t = dt();
  or(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = Ca({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function en(e) {
  const t = dt();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function za({
  groupId: e
}) {
  const t = () => {
    const n = dt();
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
      } = t(), l = ct({
        layout: n,
        panelConstraints: o
      });
      return r ? i : (it(i, l) || Ue(a, {
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
  const n = en(e), r = Qe(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  le(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  le(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), i = za({ groupId: n.id }).getLayout(), c = Ht({
    delta: t,
    initialLayout: i,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: i,
    trigger: "keyboard"
  }), l = ct({
    layout: c,
    panelConstraints: r.derivedPanelConstraints
  });
  it(i, l) || Ue(
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
function co(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = en(t);
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
        const r = en(t), o = Qe(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: i } = o, c = r.separators.find(
          (d) => d.element === t
        );
        le(c, "Matching separator not found");
        const l = i.get(c);
        le(l, "Matching panels not found");
        const u = l[0], f = a.find(
          (d) => d.panelId === u.id
        );
        if (le(f, "Panel metadata not found"), f.collapsible) {
          const d = s[u.id], m = f.collapsedSize === d ? r.mutableState.expandedPanelSizes[u.id] ?? f.minSize : f.collapsedSize;
          rt(t, m - d);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = en(t).separators.map(
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
        e.preventDefault(), rt(t, -100);
        break;
      }
    }
}
function lo(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = dt(), n = or(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), It({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function Oa({
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
      separatorToPanels: T
    } = w;
    if (b && k && T) {
      const A = Ht({
        delta: h,
        initialLayout: y,
        panelConstraints: b,
        pivotIndices: l.panels.map(($) => m.indexOf($)),
        prevLayout: k,
        trigger: "mouse-or-touch"
      });
      if (it(A, k)) {
        if (h !== 0 && !g)
          switch (d) {
            case "horizontal": {
              i |= h < 0 ? Ma : _a;
              break;
            }
            case "vertical": {
              i |= h < 0 ? Aa : Na;
              break;
            }
          }
      } else
        Ue(l.group, {
          defaultLayoutDeferred: S,
          derivedPanelConstraints: b,
          groupSize: v,
          layout: A,
          separatorToPanels: T
        });
    }
  });
  let c = 0;
  t.movementX === 0 ? c |= s & Yr : c |= i & Yr, t.movementY === 0 ? c |= s & Qr : c |= i & Qr, of(c), nr(e);
}
function uo(e) {
  const t = dt(), n = st();
  switch (n.state) {
    case "active":
      Oa({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function fo(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = st(), n = dt();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        It({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = Qe(a.group.id, !0);
          Ue(a.group, s, {
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
      Oa({
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
      const a = or(e, n);
      a.length === 0 ? t.state !== "inactive" && It({
        cursorFlags: 0,
        state: "inactive"
      }) : It({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), nr(e.currentTarget);
      break;
    }
  }
}
function mo(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (st().state) {
      case "hover":
        It({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function ho(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || xa(e.currentTarget) && e.preventDefault();
}
function po(e) {
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
function yf(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((c) => c.element === t);
  if (!r || !r.onResize)
    return;
  const o = Et({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, i = {
    asPercentage: Ie(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = i, r.onResize(i, r.id, s);
}
function vf(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function wf({
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
        const m = d / 100 * n, g = Ie(
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
      u[f] = Ie(
        d / a * l
      );
    }
  else {
    const f = Ie(
      l / c.length
    );
    for (const d of c)
      u[d] = f;
  }
  return u;
}
function Sf(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const bt = /* @__PURE__ */ new Map();
function kf(e) {
  let t = !0;
  le(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const h of g) {
      const { borderBoxSize: y, target: w } = h;
      if (w === e.element) {
        if (t) {
          const S = Et({ group: e });
          if (S === 0)
            return;
          const b = Qe(e.id);
          if (!b)
            return;
          const v = Fn(e), k = b.defaultLayoutDeferred ? po(v) : b.layout, T = wf({
            group: e,
            nextGroupSize: S,
            prevGroupSize: b.groupSize,
            prevLayout: k
          }), A = ct({
            layout: T,
            panelConstraints: v
          });
          if (!b.defaultLayoutDeferred && it(b.layout, A) && vf(
            b.derivedPanelConstraints,
            v
          ) && b.groupSize === S)
            return;
          Ue(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: v,
            groupSize: S,
            layout: A,
            separatorToPanels: b.separatorToPanels
          });
        }
      } else
        yf(e, w, y);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    le(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = Et({ group: e }), i = Fn(e), c = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (Sf(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[c] ?? l ?? po(i), f = ct({
    layout: u,
    panelConstraints: i
  }), d = e.element.ownerDocument;
  bt.set(
    d,
    (bt.get(d) ?? 0) + 1
  );
  const m = /* @__PURE__ */ new Map();
  return Ea(e).forEach((g) => {
    g.separator && m.set(g.separator, g.panels);
  }), Ue(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: i,
    groupSize: s,
    layout: f,
    separatorToPanels: m
  }), e.separators.forEach((g) => {
    le(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", co);
  }), bt.get(d) === 1 && (d.addEventListener("contextmenu", ro, !0), d.addEventListener("dblclick", io, !0), d.addEventListener("pointerdown", lo, !0), d.addEventListener("pointerleave", uo), d.addEventListener("pointermove", fo), d.addEventListener("pointerout", mo), d.addEventListener("pointerup", ho, !0)), function() {
    t = !1, bt.set(
      d,
      Math.max(0, (bt.get(d) ?? 0) - 1)
    ), cf(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", co);
    }), bt.get(d) || (d.removeEventListener(
      "contextmenu",
      ro,
      !0
    ), d.removeEventListener(
      "dblclick",
      io,
      !0
    ), d.removeEventListener(
      "pointerdown",
      lo,
      !0
    ), d.removeEventListener("pointerleave", uo), d.removeEventListener("pointermove", fo), d.removeEventListener("pointerout", mo), d.removeEventListener("pointerup", ho, !0)), a.disconnect();
  };
}
function If() {
  const [e, t] = P({}), n = x(() => t({}), []);
  return [e, n];
}
function ar(e) {
  const t = Mo();
  return `${e ?? t}`;
}
const ft = typeof window < "u" ? Te : z;
function $t(e) {
  const t = M(e);
  return ft(() => {
    t.current = e;
  }, [e]), x(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function sr(...e) {
  return $t((t) => {
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
function ir(e) {
  const t = M({ ...e });
  return ft(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const $a = Wn(null);
function Rf(e, t) {
  const n = M({
    getLayout: () => ({}),
    setLayout: af
  });
  Vn(t, () => n.current, []), ft(() => {
    Object.assign(
      n.current,
      za({ groupId: e })
    );
  });
}
function Fa({
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
  const g = M({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), h = $t((I) => {
    it(g.current.onLayoutChange, I) || (g.current.onLayoutChange = I, c == null || c(I));
  }), y = $t(
    (I, R) => {
      it(g.current.onLayoutChanged, I) || (g.current.onLayoutChanged = I, l == null || l(I, { isUserInteraction: R }));
    }
  ), w = ar(i), S = M(null), [b, v] = If(), k = M({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: f,
    separators: []
  }), T = sr(S, a);
  Rf(w, s);
  const A = $t(
    (I, R) => {
      const E = st(), L = no(I), C = Qe(I);
      if (C) {
        let U = !1;
        switch (E.state) {
          case "active": {
            U = E.hitRegions.some(
              (N) => N.group === L
            );
            break;
          }
        }
        return {
          flexGrow: C.layout[R] ?? 1,
          pointerEvents: U ? "none" : void 0
        };
      }
      if (n != null && n[R])
        return {
          flexGrow: n == null ? void 0 : n[R]
        };
    }
  ), $ = ir({
    defaultLayout: n,
    disableCursor: r
  }), O = G(
    () => ({
      get disableCursor() {
        return !!$.disableCursor;
      },
      getPanelStyles: A,
      id: w,
      orientation: u,
      registerPanel: (I) => {
        const R = k.current;
        return R.panels = Bn(u, [
          ...R.panels,
          I
        ]), v(), () => {
          R.panels = R.panels.filter(
            (E) => E !== I
          ), v();
        };
      },
      registerSeparator: (I) => {
        const R = k.current;
        return R.separators = Bn(u, [
          ...R.separators,
          I
        ]), v(), () => {
          R.separators = R.separators.filter(
            (E) => E !== I
          ), v();
        };
      },
      updatePanelProps: (I, { disabled: R }) => {
        const E = k.current.panels.find(
          (U) => U.id === I
        );
        E && (E.panelConstraints.disabled = R);
        const L = no(w), C = Qe(w);
        L && C && Ue(L, {
          ...C,
          derivedPanelConstraints: Fn(L)
        });
      },
      updateSeparatorProps: (I, {
        disabled: R,
        disableDoubleClick: E
      }) => {
        const L = k.current.separators.find(
          (C) => C.id === I
        );
        L && (L.disabled = R, L.disableDoubleClick = E);
      }
    }),
    [A, w, v, u, $]
  ), _ = M(null);
  return ft(() => {
    const I = S.current;
    if (I === null)
      return;
    const R = k.current;
    let E;
    if ($.defaultLayout !== void 0 && Object.keys($.defaultLayout).length === R.panels.length) {
      E = {};
      for (const Y of R.panels) {
        const Z = $.defaultLayout[Y.id];
        Z !== void 0 && (E[Y.id] = Z);
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
      panels: R.panels,
      resizeTargetMinimumSize: R.resizeTargetMinimumSize,
      separators: R.separators
    };
    _.current = L;
    const C = kf(L), { defaultLayoutDeferred: U, derivedPanelConstraints: N, layout: H } = Qe(L.id, !0);
    !U && N.length > 0 && (h(H), y(H, !1));
    const K = rr(w, (Y) => {
      const { defaultLayoutDeferred: Z, derivedPanelConstraints: F, layout: W } = Y.next;
      if (Z || F.length === 0)
        return;
      const V = L.panels.map(({ id: J }) => J).join(",");
      L.mutableState.layouts[V] = W, F.forEach((J) => {
        if (J.collapsible) {
          const { layout: q } = Y.prev ?? {};
          if (q) {
            const ie = we(
              J.collapsedSize,
              W[J.panelId]
            ), ge = we(
              J.collapsedSize,
              q[J.panelId]
            );
            ie && !ge && (L.mutableState.expandedPanelSizes[J.panelId] = q[J.panelId]);
          }
        }
      });
      const me = st().state !== "active";
      h(W), me && y(W, Y.isUserInteraction);
    });
    return () => {
      _.current = null, C(), K();
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
    const I = _.current;
    I && (I.mutableState.defaultLayout = n, I.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ p($a.Provider, { value: O, children: /* @__PURE__ */ p(
    "div",
    {
      ...m,
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
Fa.displayName = "Group";
function cr() {
  const e = Kn($a);
  return le(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Tf(e, t) {
  const { id: n } = cr(), r = M({
    collapse: Sn,
    expand: Sn,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Sn
  });
  Vn(t, () => r.current, []), ft(() => {
    Object.assign(
      r.current,
      Ca({ groupId: n, panelId: e })
    );
  });
}
function jn({
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
  const h = !!c, y = ar(c), w = ir({
    disabled: a
  }), S = M(null), b = sr(S, s), {
    getPanelStyles: v,
    id: k,
    orientation: T,
    registerPanel: A,
    updatePanelProps: $
  } = cr(), O = f !== null, _ = $t(
    (L, C, U) => {
      f == null || f(L, c, U);
    }
  );
  ft(() => {
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
        onResize: O ? _ : void 0,
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
    O,
    y,
    h,
    l,
    u,
    _,
    A,
    w
  ]), z(() => {
    $(y, { disabled: a });
  }, [a, y, $]), Tf(y, d);
  const I = () => {
    const L = v(k, y);
    if (L)
      return JSON.stringify(L);
  }, R = Po(
    (L) => rr(k, L),
    I,
    I
  );
  let E;
  return R ? E = JSON.parse(R) : o !== void 0 ? E = {
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
        ...Ef,
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
            touchAction: T === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
jn.displayName = "Panel";
const Ef = {
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
function Pf({
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
    a = ct({
      layout: Ht({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = ct({
      layout: Ht({
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
function Ba({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...i
}) {
  const c = ar(a), l = ir({
    disabled: n,
    disableDoubleClick: r
  }), [u, f] = P({}), [d, m] = P("inactive"), [g, h] = P(!1), y = M(null), w = sr(y, o), {
    disableCursor: S,
    id: b,
    orientation: v,
    registerSeparator: k,
    updateSeparatorProps: T
  } = cr(), A = v === "horizontal" ? "vertical" : "horizontal";
  ft(() => {
    const _ = y.current;
    if (_ !== null) {
      const I = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: _,
        id: c
      }, R = k(I), E = rf(
        (C) => {
          m(
            C.next.state !== "inactive" && C.next.hitRegions.some(
              (U) => U.separator === I
            ) ? C.next.state : "inactive"
          );
        }
      ), L = rr(
        b,
        (C) => {
          const { derivedPanelConstraints: U, layout: N, separatorToPanels: H } = C.next, K = H.get(I);
          if (K) {
            const Y = K[0], Z = K.indexOf(Y);
            f(
              Pf({
                layout: N,
                panelConstraints: U,
                panelId: Y.id,
                panelIndex: Z
              })
            );
          }
        }
      );
      return () => {
        E(), L(), R();
      };
    }
  }, [b, c, k, l]), z(() => {
    T(c, { disabled: n, disableDoubleClick: r });
  }, [n, r, c, T]);
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
      "aria-orientation": A,
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
Ba.displayName = "Separator";
const lr = 30, ur = 65, Ut = 50, Mf = 100 - ur, _f = 100 - lr;
function Af(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(ur, Math.max(lr, t)) : Ut;
}
function dr(e) {
  return 100 - e;
}
function yt(e) {
  return `${e}%`;
}
const fr = "reader-document", Wt = "reader-assistant", ja = "retainpdf.reader.ai-split-layout.v1", Nf = {
  [fr]: dr(Ut),
  [Wt]: Ut
};
function mr(e) {
  const t = Af(e == null ? void 0 : e[Wt]);
  return {
    [fr]: dr(t),
    [Wt]: t
  };
}
function Lf() {
  try {
    const e = JSON.parse(localStorage.getItem(ja) || "null");
    return mr(e);
  } catch {
    return Nf;
  }
}
function xf(e) {
  try {
    localStorage.setItem(ja, JSON.stringify(mr(e)));
  } catch {
  }
}
function kn(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = mr(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[Wt]}vw`
  );
}
function Df() {
  const e = M(null), [t] = P(Lf);
  Te(() => {
    const o = e.current;
    return kn(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = x((o) => {
    kn(e.current, o);
  }, []), r = x((o, a) => {
    kn(e.current, o), a.isUserInteraction && xf(o);
  }, []);
  return /* @__PURE__ */ D(
    Fa,
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
          jn,
          {
            id: fr,
            defaultSize: yt(dr(Ut)),
            minSize: yt(Mf),
            maxSize: yt(_f)
          }
        ),
        /* @__PURE__ */ p(
          Ba,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ p("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ p(
          jn,
          {
            id: Wt,
            defaultSize: yt(Ut),
            minSize: yt(lr),
            maxSize: yt(ur)
          }
        )
      ]
    }
  );
}
function Cf({
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
function zf({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1,
  onRetry: s
}) {
  return !e && !t ? /* @__PURE__ */ p(Cf, { regionsFailed: o, metadataFailed: a, onRetry: s }) : /* @__PURE__ */ D(We, { children: [
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
function Of(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function $f() {
  const [e, t] = P(!1), n = Mo(), r = M(null);
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
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || Of(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((i) => !i);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
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
        onClick: () => t((o) => !o),
        children: /* @__PURE__ */ p(ws, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
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
          /* @__PURE__ */ p("div", { className: "reader-react-shortcuts-body", children: al.map((o) => /* @__PURE__ */ D("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ p("h3", { children: o.title }),
            /* @__PURE__ */ p("ul", { children: o.items.map((a) => /* @__PURE__ */ D("li", { children: [
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
const Ff = ["source", "sideBySide", "translated"], Bf = { source: "", translated: "", sideBySide: "" };
function jf(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = tn(e.sourceUrl), n = tn(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return Zs({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function Hf(e) {
  const [t, n] = P(() => /* @__PURE__ */ new Set()), r = G(
    () => e ? jf(e) : Bf,
    [e]
  ), o = G(
    () => Ff.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = x(async (s) => {
    if (!e) return;
    const i = tn(r[s]);
    if (!(!i || t.has(s)))
      try {
        const c = e.jobId ? Xs(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await Ys(
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
        Qs(l), n((u) => {
          const f = new Set(u);
          return f.delete(s), f;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const Uf = {
  source: Do,
  sideBySide: Co,
  translated: zo
}, Wf = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function Kf(e) {
  const t = Ve(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Hf(n), i = M(null);
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
  }, []), /* @__PURE__ */ D("details", { ref: i, className: "reader-download-actions", children: [
    /* @__PURE__ */ D("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ p(Ss, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ p("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ p(xo, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((c) => {
      const l = Za[c], u = tn(r[c]), f = a.has(c), d = !!u && !f, m = d ? "" : Ya(c, r), g = Uf[c];
      return /* @__PURE__ */ D(
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
            /* @__PURE__ */ D("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ D("span", { className: "reader-download-action-label", children: [
                Wf[c],
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
const Vf = "retainpdf:reader:bookmarks:v1:", qf = 200;
function hr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Ha(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Vf}${t}` : "";
}
function Jf(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function ln(e, t = hr()) {
  const n = Ha(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = Jf(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function Hn(e, t, n) {
  const r = Ha(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, qf);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function Gf(e, t, n = "", { storage: r = hr(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = ln(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((i) => i.page === s) ? Hn(e, a.filter((i) => i.page !== s), r) : Hn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Xf(e, t, n = hr()) {
  return Hn(e, ln(e, n).filter((r) => r.page !== t), n);
}
function Zf(e, t) {
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
function Yf({ filled: e }) {
  return /* @__PURE__ */ p("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ p("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function Qf({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = P(() => ln(e)), [i, c] = P(!1), l = M(null);
  if (z(() => {
    s(ln(e)), c(!1);
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
  return /* @__PURE__ */ D("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: l, children: [
    /* @__PURE__ */ p(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${f ? " is-marked" : ""}`,
        "aria-pressed": f,
        "aria-label": f ? `取消第 ${u} 页的书签` : `给第 ${u} 页加书签`,
        title: f ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(Gf(e, u, Zf(r, u))),
        children: /* @__PURE__ */ p(Yf, { filled: f })
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
          /* @__PURE__ */ p(ks, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
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
          onClick: () => s(Xf(e, d.page)),
          children: "×"
        }
      )
    ] }, d.page)) }) }) : null
  ] });
}
function em(e) {
  const [t, n] = P([]);
  return z(() => {
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
function tm(e, t, n, r) {
  if (!e.length) return -1;
  if (t >= 0 && t < e.length) return (t + (r ? -1 : 1) + e.length) % e.length;
  if (r) {
    for (let a = e.length - 1; a >= 0; a -= 1) if (e[a].page <= n) return a;
    return e.length - 1;
  }
  const o = e.findIndex((a) => a.page >= n);
  return o >= 0 ? o : 0;
}
const nm = {
  failed: "没翻成",
  content: "内容问题",
  layout: "版面放不下"
}, rm = ["failed", "content", "layout"];
function om(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function am({ jobId: e, currentPage: t }) {
  var f;
  const n = em(e), r = (f = Ve()) == null ? void 0 : f.jumpToBlock, [o, a] = P(!1), [s, i] = P(-1), c = M(null);
  z(() => i(-1), [n]);
  const l = (d) => {
    const m = n[d];
    !m || !r || (i(d), r(m.readerItemId));
  }, u = M({ issues: n, last: s, currentPage: t, goTo: l });
  return u.current = { issues: n, last: s, currentPage: t, goTo: l }, z(() => {
    const d = (m) => {
      if (m.key.toLowerCase() !== "n" || m.metaKey || m.ctrlKey || m.altKey || om(m.target)) return;
      const { issues: g, last: h, currentPage: y, goTo: w } = u.current, S = tm(g, h, y, m.shiftKey);
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
          /* @__PURE__ */ p(Is, { size: 14, strokeWidth: 2, "aria-hidden": "true" }),
          /* @__PURE__ */ p("span", { children: n.length })
        ]
      }
    ),
    o ? /* @__PURE__ */ D("div", { className: "reader-issues-popover", role: "dialog", "aria-label": "待处理", children: [
      /* @__PURE__ */ p("p", { className: "reader-issues-hint", children: "点一条跳过去，悬停那一段可以「改」。N 下一处，Shift+N 上一处。" }),
      rm.map((d) => {
        const m = n.map((g, h) => ({ issue: g, index: h })).filter(({ issue: g }) => g.kind === d);
        return m.length ? /* @__PURE__ */ D("section", { className: "reader-issues-group", "data-issue-kind": d, children: [
          /* @__PURE__ */ D("h4", { children: [
            nm[d],
            /* @__PURE__ */ p("span", { children: m.length })
          ] }),
          /* @__PURE__ */ p("ol", { children: m.map(({ issue: g, index: h }) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ D(
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
const sm = 48, im = 96, cm = 700;
function lm(e, t, n) {
  if (n < -4) return { hidden: !1, downSoFar: 0 };
  if (n <= 0) return { hidden: e, downSoFar: t };
  const r = t + n;
  return { hidden: r >= sm, downSoFar: r };
}
function um(e) {
  const [t, n] = P(!1), r = M(0);
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
      if (o.set(m, g), h === void 0 || Date.now() - a > cm) return;
      const y = lm(!1, r.current, g - h);
      r.current = y.downSoFar, g - h < -4 ? n(!1) : y.hidden && !c() && n(!0);
    }, u = (d) => {
      d.clientY >= window.innerHeight - im && (r.current = 0, n(!1));
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
function dm(e) {
  const t = Ve(), n = wa(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? Kt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), i = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, c = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = Bi(a), f = a > Ko + 1e-3, d = a < sn - 1e-3, m = wt(r, Ye()), g = m >= sn ? "恢复默认大小（铺满阅读区）" : "恢复默认大小（对照时左右各占一半）", h = M(null), y = um(h), [w, S] = P(!1), [b, v] = P(`${i}`);
  z(() => {
    w || v(`${Math.min(Math.max(i, 1), Math.max(c, 1))}`);
  }, [i, c, w]);
  const k = () => {
    if (S(!1), !l || c <= 0)
      return;
    const T = Number(`${b}`.trim());
    l(cn(T, c));
  };
  return /* @__PURE__ */ D("div", { ref: h, className: "reader-react-hud", "data-reader-hud": "true", "data-hud-hidden": y ? "true" : void 0, children: [
    o ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "页码", children: w ? /* @__PURE__ */ D(
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
          !l || c <= 0 || (v(`${i}`), S(!0));
        },
        children: c > 0 ? `${Math.min(i, c)} / ${c}` : "—"
      }
    ) }),
    e.searchSlot ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "搜索", children: e.searchSlot }) : null,
    e.bookmarkScope ? /* @__PURE__ */ p(
      Qf,
      {
        scope: e.bookmarkScope,
        currentPage: i,
        numPages: c,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
      }
    ) : null,
    e.issuesJobId ? /* @__PURE__ */ p(am, { jobId: e.issuesJobId, currentPage: i }) : null,
    t != null && t.toggleDocDark ? /* @__PURE__ */ p("div", { className: "reader-react-hud-group", "aria-label": "显示", children: /* @__PURE__ */ p(
      te,
      {
        className: "reader-react-hud-btn reader-react-hud-doc-dark",
        "aria-pressed": t.docDark ? "true" : "false",
        "aria-label": t.docDark ? "深色文档：开（书页黑底白字），点一下换回白底" : "深色文档：关，点一下书页换成黑底白字",
        title: t.docDark ? "换回白底黑字（D）" : "深色文档：书页黑底白字（D）",
        onClick: t.toggleDocDark,
        children: /* @__PURE__ */ p(fm, {})
      }
    ) }) : null,
    /* @__PURE__ */ D("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ p(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !f,
          onClick: () => s(jt(a, -1)),
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
          onClick: () => s(jt(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ p("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ p($f, {}) })
  ] });
}
function fm() {
  return /* @__PURE__ */ D("svg", { width: "14", height: "14", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false", children: [
    /* @__PURE__ */ p("circle", { cx: "8", cy: "8", r: "6.25", fill: "none", stroke: "currentColor", strokeWidth: "1.5" }),
    /* @__PURE__ */ p("path", { d: "M8 1.75a6.25 6.25 0 0 1 0 12.5z", fill: "currentColor" })
  ] });
}
function go(e) {
  var t, n;
  return Zo(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function mm(e) {
  const [t, n] = P(() => ({
    scope: e,
    panel: go(De(e))
  }));
  z(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: go(De(e))
    });
  }, [e]), z(() => {
    t.scope === e && fn(t.scope, {
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
const Un = "download-toast";
function hm({
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
function pm(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    Pn.dismiss(Un);
    return;
  }
  Pn.custom(
    () => /* @__PURE__ */ p(hm, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: Un, duration: 1 / 0 }
  );
}
function gm() {
  const e = x((t) => {
    t && (t.setState = pm, t.hide = () => Pn.dismiss(Un));
  }, []);
  return /* @__PURE__ */ D(We, { children: [
    /* @__PURE__ */ p(ls, { position: "bottom-right" }),
    /* @__PURE__ */ p("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function bm(e) {
  const t = M(!1);
  return e && (t.current = !0), t.current;
}
function ym(e, t) {
  const n = e === t;
  return { open: n, mounted: bm(n) };
}
const bo = { itemId: null, origin: null };
function vm() {
  let e = bo;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? bo : { itemId: n, origin: r };
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
function wm({
  nodes: e,
  currentPage: t,
  onJumpPage: n
}) {
  const r = G(() => ca(e, t), [e, t]), [o, a] = P(() => /* @__PURE__ */ new Set([...xr(r), ...r ? [r] : []]));
  z(() => {
    a(/* @__PURE__ */ new Set([...xr(r), ...r ? [r] : []]));
  }, [e]);
  const s = M(null);
  z(() => {
    var l, u;
    (u = (l = s.current) == null ? void 0 : l.querySelector('[aria-current="location"]')) == null || u.scrollIntoView({ block: "center" });
  }, [e]);
  const i = (l) => a((u) => {
    const f = new Set(u);
    return f.has(l) ? f.delete(l) : f.add(l), f;
  }), c = (l) => l.map((u) => {
    const f = o.has(u.id), d = u.children.length > 0;
    return /* @__PURE__ */ D("li", { className: "reader-bookmark", "data-level": u.level, children: [
      /* @__PURE__ */ D("div", { className: "reader-bookmark-row", children: [
        d ? /* @__PURE__ */ p(
          te,
          {
            className: `reader-bookmark-toggle${f ? " is-open" : ""}`,
            "aria-label": f ? `收起「${u.title}」` : `展开「${u.title}」`,
            "aria-expanded": f,
            onClick: () => i(u.id),
            children: /* @__PURE__ */ p(Oo, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 })
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
      d && f ? /* @__PURE__ */ p("ol", { className: "reader-bookmark-children", children: c(u.children) }) : null
    ] }, u.id);
  });
  return /* @__PURE__ */ p("ol", { ref: s, className: "reader-finder-list reader-bookmark-tree", "aria-label": "书签", children: c(e) });
}
const Sm = [], km = [];
function Im({
  open: e,
  onToggle: t,
  children: n
}) {
  return /* @__PURE__ */ D("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ p(te, { className: "reader-finder-toggle", "aria-label": "目录", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: /* @__PURE__ */ p(Ts, { size: 17, strokeWidth: 2.1, "aria-hidden": !0 }) }),
    n
  ] });
}
function Rm({ open: e, onToggle: t }) {
  return /* @__PURE__ */ p(
    te,
    {
      className: "reader-react-hud-btn reader-search-toggle",
      "data-finder-toggle": "search",
      "aria-label": "在书里搜索",
      "aria-pressed": e === "search",
      title: "在书里搜索（原文和译文，⌘F）",
      onClick: () => t("search"),
      children: /* @__PURE__ */ p(Rs, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 })
    }
  );
}
function Tm({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: i = 0,
  bookmarks: c = km,
  onJumpPage: l
}) {
  var _, I;
  const u = ((_ = Ve()) == null ? void 0 : _.regions) ?? Sm, f = ((I = wa()) == null ? void 0 : I.currentPage) ?? 1, d = G(() => Nl(u), [u]), m = c.length > 0 && !!l, [g, h] = P("bookmarks"), y = m && (g === "bookmarks" || !d.length), w = Ll(d, f), S = G(() => Cl(u, s), [u, s]), [b, v] = P(-1);
  z(() => v(-1), [s]);
  const k = M(null), T = M(null), A = M(n);
  A.current = n, z(() => {
    const R = (L) => {
      var U, N;
      const C = L.target;
      !C || (U = T.current) != null && U.contains(C) || (N = C.closest) != null && N.call(C, ".reader-finder-toggles, [data-finder-toggle]") || A.current();
    }, E = (L) => {
      L.key === "Escape" && A.current();
    };
    return document.addEventListener("pointerdown", R, !0), document.addEventListener("keydown", E), () => {
      document.removeEventListener("pointerdown", R, !0), document.removeEventListener("keydown", E);
    };
  }, []);
  const $ = M(null);
  z(() => {
    var R, E, L;
    e === "search" ? (R = k.current) == null || R.focus() : (L = (E = $.current) == null ? void 0 : E.querySelector('[aria-current="location"]')) == null || L.scrollIntoView({ block: "center" });
  }, [e, i]), z(() => {
    var R, E;
    e === "search" && b >= 0 && ((E = (R = $.current) == null ? void 0 : R.querySelector('[aria-current="true"]')) == null || E.scrollIntoView({ block: "nearest" }));
  }, [e, b]);
  const O = (R) => {
    const E = S[R];
    E && (v(R), r(E.itemId));
  };
  return /* @__PURE__ */ D("aside", { ref: T, className: "reader-finder", "data-finder-tab": e, "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ D("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ D("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ p(te, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ p(te, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ p(te, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ p(ut, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" && m && d.length ? /* @__PURE__ */ D("div", { className: "reader-finder-switch", role: "radiogroup", "aria-label": "目录按什么列", children: [
      /* @__PURE__ */ p(te, { className: "reader-finder-switch-option", role: "radio", "aria-checked": y, onClick: () => h("bookmarks"), children: "按书签" }),
      /* @__PURE__ */ p(te, { className: "reader-finder-switch-option", role: "radio", "aria-checked": !y, onClick: () => h("headings"), children: "按标题" })
    ] }) : null,
    e === "outline" && y && l ? /* @__PURE__ */ p(wm, { nodes: c, currentPage: f, onJumpPage: l }) : e === "outline" ? d.length ? /* @__PURE__ */ p("ol", { ref: $, className: "reader-finder-list", children: d.map((R, E) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ D(
      te,
      {
        className: "reader-finder-entry",
        "data-level": R.level,
        "aria-current": E === w ? "location" : void 0,
        onClick: () => r(R.itemId),
        children: [
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-text", children: R.text }),
          /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: R.page })
        ]
      }
    ) }, R.itemId)) }) : /* @__PURE__ */ p("p", { className: "reader-finder-empty", children: u.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ D(We, { children: [
      /* @__PURE__ */ D("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ p(
          $o,
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
              R.key === "Enter" ? (R.preventDefault(), O(zl(b, S.length, R.shiftKey))) : R.key === "Escape" && (R.preventDefault(), n()), R.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ p("p", { className: "reader-finder-count", "aria-live": "polite", children: S.length === 0 ? "没有找到" : `${b >= 0 ? `第 ${b + 1} / ` : ""}${S.length >= 200 ? "200+ 处，只列前 200 处" : `${S.length} 处`}${b < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ p("ol", { className: "reader-finder-list", children: S.map((R, E) => /* @__PURE__ */ p("li", { children: /* @__PURE__ */ D(te, { className: "reader-finder-entry is-hit", "aria-current": E === b ? "true" : void 0, onClick: () => O(E), children: [
        /* @__PURE__ */ D("span", { className: "reader-finder-entry-text", children: [
          R.snippet.slice(0, R.at),
          /* @__PURE__ */ p("mark", { children: R.snippet.slice(R.at, R.at + R.length) }),
          R.snippet.slice(R.at + R.length)
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-finder-entry-page", children: R.page })
      ] }) }, R.itemId)) })
    ] })
  ] });
}
function Em({ active: e, compare: t, ink: n }) {
  const [r, o] = P(!1), [a, s] = P(!1), i = M(null);
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
  return /* @__PURE__ */ D("div", { className: "reader-toolball", ref: i, "data-open": r ? "true" : void 0, children: [
    a ? /* @__PURE__ */ p(Nd, { compare: t, onDone: () => {
      s(!1), o(!1);
    } }) : null,
    r ? /* @__PURE__ */ D("div", { className: "reader-toolball-stack", role: "group", "aria-label": "工具", children: [
      n ? /* @__PURE__ */ p(
        te,
        {
          className: "reader-toolball-item",
          "aria-label": "画笔",
          title: "画笔（P；书页上右键也能选笔和颜色）",
          "aria-pressed": !!n.tool,
          "data-toolball-item": "ink",
          onClick: () => {
            n.setTool(n.tool ? null : "pen"), o(!1);
          },
          children: /* @__PURE__ */ p(qn, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null,
      /* @__PURE__ */ p(Vd, { active: e }),
      t.available ? /* @__PURE__ */ p(
        te,
        {
          className: "reader-toolball-item",
          "aria-label": "对比版本",
          title: "对比版本：左边换成这本书的另一份译文",
          "aria-pressed": c || a,
          "data-toolball-item": "compare",
          onClick: () => s((l) => !l),
          children: /* @__PURE__ */ p(Es, { size: 18, strokeWidth: 2.1, "aria-hidden": !0 })
        }
      ) : null
    ] }) : null,
    /* @__PURE__ */ p(
      te,
      {
        className: "reader-toolball-ball",
        "aria-label": r ? "收起工具" : "工具：画笔、Markdown、对比版本",
        title: r ? "收起" : "工具",
        "aria-expanded": r,
        "data-active": e || c ? "true" : void 0,
        onClick: () => {
          o((l) => !l), s(!1);
        },
        children: r ? /* @__PURE__ */ p(ut, { size: 20, strokeWidth: 2.2, "aria-hidden": !0 }) : /* @__PURE__ */ p(Ps, { size: 20, strokeWidth: 2.1, "aria-hidden": !0 })
      }
    )
  ] });
}
const Pm = [
  { tool: "pen", label: "画笔", Icon: qn },
  { tool: "highlighter", label: "荧光笔", Icon: Ms },
  { tool: "eraser", label: "橡皮", Icon: _s }
];
function Ua(e) {
  return e instanceof Element && !!e.closest("input, textarea, select, [contenteditable='true']");
}
function Wa({ ink: e, page: t = 0, onPick: n }) {
  const r = () => n == null ? void 0 : n();
  return /* @__PURE__ */ D(We, { children: [
    Pm.map(({ tool: o, label: a, Icon: s }) => /* @__PURE__ */ p(
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
    pa.map((o) => /* @__PURE__ */ p(
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
    /* @__PURE__ */ p(te, { className: "reader-ink-tool", "aria-label": "撤销", title: "撤销（⌘Z）", onClick: e.undo, children: /* @__PURE__ */ p(As, { size: 17, strokeWidth: 2, "aria-hidden": !0 }) }),
    t > 0 ? /* @__PURE__ */ p(
      te,
      {
        className: "reader-ink-tool",
        "aria-label": `清掉第 ${t} 页的笔迹`,
        title: `清掉第 ${t} 页的笔迹`,
        onClick: () => {
          e.clearPage(t), r();
        },
        children: /* @__PURE__ */ p(Ns, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
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
        children: /* @__PURE__ */ p(ut, { size: 17, strokeWidth: 2, "aria-hidden": !0 })
      }
    ) : null
  ] });
}
function Mm({
  ink: e,
  menu: t,
  onClose: n,
  actions: r = []
}) {
  const o = M(null);
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
  return /* @__PURE__ */ D("div", { ref: o, className: "reader-ink-menu", style: { left: s, top: i }, "data-ink-menu": "true", children: [
    r.length ? /* @__PURE__ */ p("div", { className: "reader-ink-menu-actions", role: "menu", "aria-label": "书页", children: r.map((c) => /* @__PURE__ */ D(
      te,
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
    /* @__PURE__ */ p("div", { className: "reader-ink-bar is-menu", role: "menu", "aria-label": "画笔", children: /* @__PURE__ */ p(Wa, { ink: e, page: t.page, onPick: n }) })
  ] });
}
function _m({ ink: e }) {
  return e.tool ? /* @__PURE__ */ p("div", { className: "reader-ink-bar is-dock", role: "toolbar", "aria-label": "画笔", "data-ink-dock": "true", children: /* @__PURE__ */ p(Wa, { ink: e }) }) : null;
}
function Am(e) {
  var r;
  if (e.shiftKey || Ua(e.target)) return null;
  const t = e.target instanceof Element ? e.target : null;
  if (!(t != null && t.closest(`.${Uo}`))) return null;
  const n = Number((r = t.closest(`[${Re}]`)) == null ? void 0 : r.getAttribute(Re)) || 0;
  return { x: e.clientX, y: e.clientY, page: n };
}
function Nm(e) {
  const t = M(e);
  t.current = e, z(() => {
    const n = (r) => {
      if (Ua(r.target)) return;
      const o = t.current;
      !r.metaKey && !r.ctrlKey && !r.altKey && !r.repeat && (r.key === "p" || r.key === "P") ? (r.preventDefault(), o.setTool(o.tool ? null : "pen")) : r.key === "Escape" && o.tool ? o.setTool(null) : o.tool && (r.metaKey || r.ctrlKey) && !r.shiftKey && (r.key === "z" || r.key === "Z") && (r.preventDefault(), o.undo());
    };
    return window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n);
  }, []);
}
function Lm({ edit: e }) {
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
const Ka = "retainpdf:reader:doc-theme:v1", yo = "data-reader-doc";
function Va() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function xm(e = Va()) {
  try {
    return (e == null ? void 0 : e.getItem(Ka)) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function Dm(e, t = Va()) {
  try {
    t == null || t.setItem(Ka, e);
  } catch {
  }
}
function vo(e, t = ((n) => (n = globalThis.document) == null ? void 0 : n.documentElement)() ?? null) {
  t && (e === "dark" ? t.setAttribute(yo, "dark") : t.removeAttribute(yo));
}
function Cm() {
  const [e, t] = P(() => xm());
  z(() => {
    vo(e);
  }, [e]), z(() => () => vo("light"), []);
  const n = x(() => {
    t((r) => {
      const o = r === "dark" ? "light" : "dark";
      return Dm(o), o;
    });
  }, []);
  return { docDark: e === "dark", toggleDocDark: n };
}
const zm = 250;
function Om(e, t) {
  return { back: [...e.back, t].slice(-50), forward: [] };
}
function $m(e, t, n) {
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
  const [o, a] = P(null), [s, i] = P({ back: [], forward: [] }), c = M(s);
  c.current = s;
  const l = M(null), u = M({ index: t, primaryPane: n, follow: r, shellEl: e });
  u.current = { index: t, primaryPane: n, follow: r, shellEl: e };
  const f = x(() => {
    const { shellEl: m, primaryPane: g } = u.current;
    return Ot(m, g);
  }, []);
  z(() => {
    if (!e) return;
    const m = (b) => {
      var v, k;
      return (k = (v = b.target) == null ? void 0 : v.closest) == null ? void 0 : k.call(v, `.${la}`);
    }, g = () => {
      l.current != null && window.clearTimeout(l.current), l.current = null;
    }, h = (b) => {
      var A;
      const v = m(b);
      if (!v) return;
      const k = u.current.index.get(v.getAttribute(Cn) || "");
      if (!k) return;
      const T = ((A = v.closest("[data-reader-pane]")) == null ? void 0 : A.getAttribute("data-reader-pane")) || u.current.primaryPane;
      g(), l.current = window.setTimeout(() => {
        const $ = v.getBoundingClientRect();
        a({ target: k, pane: T, anchor: { left: $.left, top: $.top, right: $.right, bottom: $.bottom } });
      }, zm);
    }, y = (b) => {
      const v = m(b);
      !v || v.contains(b.relatedTarget) || (g(), a(null));
    }, w = (b) => {
      var $, O;
      const v = m(b);
      if (!v || b.button !== 0 || b.metaKey || b.ctrlKey || b.shiftKey || `${(($ = window.getSelection) == null ? void 0 : $.call(window)) || ""}`.trim()) return;
      const k = u.current.index.get(v.getAttribute(Cn) || "");
      if (!k) return;
      b.preventDefault(), b.stopPropagation(), g(), a(null);
      const T = ((O = v.closest("[data-reader-pane]")) == null ? void 0 : O.getAttribute("data-reader-pane")) || u.current.primaryPane, A = f();
      A && i((_) => Om(_, A)), u.current.follow(k, T);
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
    const h = $m(c.current, g, m);
    if (!h) return !1;
    const { shellEl: y, primaryPane: w } = u.current;
    return Tt(y, h.to, "auto", w) ? (i(h.history), !0) : !1;
  }, [f]);
  return z(() => {
    const m = (g) => {
      if (!g.altKey || g.metaKey || g.ctrlKey || g.shiftKey || g.defaultPrevented || g.key !== "ArrowLeft" && g.key !== "ArrowRight" || Fm(g.target)) return;
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
function jm({ state: e, bookmarks: t }) {
  const { finder: n, setFinder: r, toggleFinder: o, findQuery: a, setFindQuery: s, findTerm: i, findFocus: c, jumpFromFinder: l, jumpToPageFromFinder: u } = e;
  return /* @__PURE__ */ D(We, { children: [
    /* @__PURE__ */ p(Im, { open: n, onToggle: o }),
    n ? /* @__PURE__ */ p(
      Tm,
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
const wo = 6e3;
function qa(e, t = 0.012) {
  const n = Math.max(0, e.left - t), r = Math.max(0, e.top - t), o = Math.min(1, e.left + e.width + t), a = Math.min(1, e.top + e.height + t);
  return { left: n, top: r, width: o - n, height: a - r };
}
function Hm(e, t, n, r) {
  const o = e.width * t.width, a = e.height * t.height;
  let s = n * r / Math.max(1, o);
  const i = Math.max(o, a) * s;
  return i > wo && (s *= wo / i), {
    scale: s,
    offsetX: -e.left * t.width * s,
    offsetY: -e.top * t.height * s,
    canvasWidth: Math.max(1, Math.round(o * s)),
    canvasHeight: Math.max(1, Math.round(a * s)),
    /** 显示高度（CSS 像素），按区域的宽高比。 */
    cssHeight: Math.round(n * (a / Math.max(1, o)))
  };
}
function Ja({
  pdf: e,
  page: t,
  region: n,
  cssWidth: r,
  className: o,
  label: a
}) {
  const s = M(null), [i, c] = P({ status: "loading", cssHeight: 0 }), l = `${t}:${n.left}:${n.top}:${n.width}:${n.height}:${Math.round(r)}`;
  return z(() => {
    let u = !1, f = null;
    return c((d) => ({ status: "loading", cssHeight: d.cssHeight })), (async () => {
      try {
        const d = await e.getPage(t);
        if (u) return;
        const m = d.getViewport({ scale: 1 }), g = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1)), h = Hm(n, m, r, g), y = s.current, w = y == null ? void 0 : y.getContext("2d");
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
const So = { figure: "图", table: "表", formula: "公式", text: "文字" }, Je = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
function Um(e, t, n) {
  const r = Rt(e, t, n), o = r ? lt(r, 1, 1) : null;
  if (!r || !o) return null;
  const a = qa({ left: o.left, top: o.top, width: o.width, height: o.height }), { width: s, height: i } = r.pageSize;
  return { page: r.box.page, fraction: a, aspect: a.height * i / Math.max(1e-6, a.width * s) };
}
function Wm(e, t, n) {
  let r = 0, o = 1 / 0, a = 1 / 0, s = -1 / 0, i = -1 / 0, c = null;
  for (const u of e) {
    const f = Rt(u, t, n), d = f ? lt(f, 1, 1) : null;
    !f || !d || (r || (r = f.box.page, c = f.pageSize), f.box.page === r && (o = Math.min(o, d.left), a = Math.min(a, d.top), s = Math.max(s, d.left + d.width), i = Math.max(i, d.top + d.height)));
  }
  if (!r || !c) return null;
  const l = qa({ left: o, top: a, width: s - o, height: i - a });
  return { page: r, fraction: l, aspect: l.height * c.height / Math.max(1e-6, l.width * c.width) };
}
function Km(e, t, n) {
  const r = Math.max(0, ...n);
  return r <= 0 || t <= 0 ? e : Math.round(Math.max(120, Math.min(e, t / r)));
}
function Vm(e, t) {
  const n = (o) => {
    const a = Me(o);
    return a === "figure" || a === "table" ? "visual" : a;
  }, r = n(t);
  return e.filter((o) => n(o) === r);
}
function qm({
  itemId: e,
  regions: t,
  metadata: n,
  documents: r,
  panes: o,
  onNavigate: a,
  onClose: s
}) {
  var O;
  const i = t.find((_) => _.itemId === e) ?? null, c = G(() => i ? Vm(t, i) : [], [t, i]), l = i ? c.indexOf(i) : -1, [u, f] = P(Je.indexOf(1)), d = Je[u], m = M(null), [g, h] = P(0);
  Te(() => {
    const _ = m.current;
    if (!_) return;
    const I = () => h(_.clientWidth);
    I();
    const R = typeof ResizeObserver == "function" ? new ResizeObserver(I) : null;
    return R == null || R.observe(_), () => R == null ? void 0 : R.disconnect();
  }, []);
  const y = x((_) => {
    const I = c[l + _];
    I && a(I.itemId);
  }, [c, l, a]);
  z(() => {
    const _ = (I) => {
      if (I.key === "Escape")
        I.preventDefault(), s();
      else if (I.key === "ArrowLeft")
        I.preventDefault(), y(-1);
      else if (I.key === "ArrowRight")
        I.preventDefault(), y(1);
      else if (I.key === "+" || I.key === "=")
        I.preventDefault(), f((R) => Math.min(Je.length - 1, R + 1));
      else if (I.key === "-" || I.key === "_")
        I.preventDefault(), f((R) => Math.max(0, R - 1));
      else if (I.key === "0")
        I.preventDefault(), f(Je.indexOf(1));
      else
        return;
      I.stopPropagation();
    };
    return window.addEventListener("keydown", _, !0), () => window.removeEventListener("keydown", _, !0);
  }, [s, y]), z(() => {
    const _ = m.current;
    if (!_) return;
    const I = (R) => {
      !R.ctrlKey && !R.metaKey || (R.preventDefault(), f((E) => Math.max(0, Math.min(Je.length - 1, E + (R.deltaY < 0 ? 1 : -1)))));
    };
    return _.addEventListener("wheel", I, { passive: !1 }), () => _.removeEventListener("wheel", I);
  }, []);
  const w = M(null);
  if (!i) return null;
  const S = Me(i), b = o.map((_) => ({ pane: _, pdf: r[_] ?? null, where: Um(i, n, _) })).filter((_) => !!(_.pdf && _.where)), v = 16, k = typeof window > "u" ? 800 : window.innerHeight, T = Math.min(880, k * 0.9) - 56 - 32 - (b.length > 1 ? 26 : 0), A = b.length ? Km(Math.max(120, (g - v * (b.length - 1) - 32) / b.length), T, b.map((_) => _.where.aspect)) : 0, $ = ((O = b[0]) == null ? void 0 : O.where.page) ?? i.source.page;
  return /* @__PURE__ */ D("div", { className: "reader-zoom", role: "dialog", "aria-modal": "true", "aria-label": `放大查看：${So[S] ?? "这一块"}`, children: [
    /* @__PURE__ */ p("div", { className: "reader-zoom-backdrop", onClick: s }),
    /* @__PURE__ */ D("section", { className: "reader-zoom-panel", children: [
      /* @__PURE__ */ D("header", { className: "reader-zoom-head", children: [
        /* @__PURE__ */ D("span", { className: "reader-zoom-title", children: [
          So[S] ?? "这一块",
          " · 第 ",
          $,
          " 页"
        ] }),
        /* @__PURE__ */ p("span", { className: "reader-zoom-count", children: l >= 0 ? `${l + 1} / ${c.length}` : "" }),
        /* @__PURE__ */ D("div", { className: "reader-zoom-tools", children: [
          /* @__PURE__ */ p(ot, { variant: "ghost", size: "sm", label: "上一块", title: "上一块（←）", disabled: l <= 0, onClick: () => y(-1), children: /* @__PURE__ */ p(Ls, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(ot, { variant: "ghost", size: "sm", label: "下一块", title: "下一块（→）", disabled: l < 0 || l >= c.length - 1, onClick: () => y(1), children: /* @__PURE__ */ p(Oo, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(ot, { variant: "ghost", size: "sm", label: "缩小", title: "缩小（−）", disabled: u === 0, onClick: () => f((_) => Math.max(0, _ - 1)), children: /* @__PURE__ */ p(xs, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ D(te, { variant: "ghost", size: "sm", className: "reader-zoom-level", "aria-label": "回到 100%", title: "回到 100%（0）", onClick: () => f(Je.indexOf(1)), children: [
            Math.round(d * 100),
            "%"
          ] }),
          /* @__PURE__ */ p(ot, { variant: "ghost", size: "sm", label: "放大", title: "放大（+、⌘/Ctrl + 滚轮）", disabled: u === Je.length - 1, onClick: () => f((_) => Math.min(Je.length - 1, _ + 1)), children: /* @__PURE__ */ p(Ds, { size: 16, "aria-hidden": !0 }) }),
          /* @__PURE__ */ p(ot, { variant: "ghost", size: "sm", label: "关掉", title: "关掉（Esc）", onClick: s, children: /* @__PURE__ */ p(ut, { size: 16, "aria-hidden": !0 }) })
        ] })
      ] }),
      /* @__PURE__ */ p(
        "div",
        {
          ref: m,
          className: "reader-zoom-body",
          onPointerDown: (_) => {
            const I = m.current;
            !I || _.button !== 0 || (w.current = { x: _.clientX, y: _.clientY, left: I.scrollLeft, top: I.scrollTop }, I.setPointerCapture(_.pointerId));
          },
          onPointerMove: (_) => {
            const I = m.current, R = w.current;
            !I || !R || (I.scrollLeft = R.left - (_.clientX - R.x), I.scrollTop = R.top - (_.clientY - R.y));
          },
          onPointerUp: () => {
            w.current = null;
          },
          children: b.length && g ? /* @__PURE__ */ p("div", { className: "reader-zoom-columns", style: { gap: v }, children: b.map(({ pane: _, pdf: I, where: R }) => /* @__PURE__ */ D("figure", { className: "reader-zoom-column", children: [
            b.length > 1 ? /* @__PURE__ */ p("figcaption", { children: _ === "source" ? "原文" : "译文" }) : null,
            /* @__PURE__ */ p(
              Ja,
              {
                className: "reader-zoom-canvas",
                pdf: I,
                page: R.page,
                region: R.fraction,
                cssWidth: A * d,
                label: `${_ === "source" ? "原文" : "译文"}第 ${R.page} 页`
              }
            )
          ] }, _)) }) : /* @__PURE__ */ p("p", { className: "reader-zoom-empty", children: g ? "这一块没有可以放大的位置（缺页面尺寸或 PDF 还没读完）。" : "" })
        }
      )
    ] })
  ] });
}
const Jm = 380, Gm = 320, vt = 8;
function Xm(e, t, n) {
  const r = Math.max(vt, Math.min(e.left, n.width - t.width - vt)), o = e.bottom + vt, a = o + t.height <= n.height - vt ? o : Math.max(vt, e.top - vt - t.height);
  return { left: r, top: a };
}
function Zm({
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
    const m = r[d], g = m ? Wm(o, n, d) : null;
    if (m && g) {
      s = { pdf: m, where: g };
      break;
    }
  }
  if (!s) return null;
  const i = Math.round(Math.min(Jm, Gm / Math.max(0.05, s.where.aspect))), c = Math.round(i * s.where.aspect) + 30, l = typeof window > "u" ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight }, { left: u, top: f } = Xm(e.anchor, { width: Math.max(i, 160) + 16, height: c + 16 }, l);
  return /* @__PURE__ */ D("div", { className: "reader-xref-preview", role: "tooltip", style: { left: u, top: f }, children: [
    /* @__PURE__ */ D("div", { className: "reader-xref-preview-head", children: [
      /* @__PURE__ */ p("span", { children: Or(e.target) }),
      /* @__PURE__ */ D("span", { className: "reader-xref-preview-page", children: [
        "第 ",
        s.where.page,
        " 页 · 点击跳过去"
      ] })
    ] }),
    /* @__PURE__ */ p(Ja, { pdf: s.pdf, page: s.where.page, region: s.where.fraction, cssWidth: i, label: Or(e.target) })
  ] });
}
function Ym({
  session: e,
  xrefs: t,
  zoomDocuments: n,
  zoomItem: r,
  setZoomItem: o,
  closeZoom: a,
  visiblePdfMode: s
}) {
  return /* @__PURE__ */ D(We, { children: [
    t.preview ? /* @__PURE__ */ p(Zm, { preview: t.preview, regions: e.regions, metadata: e.readerMetadata, documents: n }) : null,
    t.canGoBack ? /* @__PURE__ */ D(te, { className: "reader-xref-back", title: "回到跳之前读到的地方（Alt+←）", onClick: () => t.goBack(), children: [
      /* @__PURE__ */ p(Cs, { size: 14, "aria-hidden": !0 }),
      " 回到第 ",
      t.backPage,
      " 页"
    ] }) : null,
    r ? /* @__PURE__ */ p(
      qm,
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
function Qm(e) {
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
function eh(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function th(e, t) {
  const { sessionFiles: n } = e, [r, o] = P(!1), a = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, s = Qm({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: n.translatedUrl,
    overlayContentAvailable: a,
    liveTranslationVisible: r,
    assistantOpen: t
  }), i = Wc({
    hasOverlayContent: a,
    connection: e.liveTranslation.connection,
    showSource: s.showSource,
    liveTranslationVisible: r,
    assistantOpen: t
  }), c = s.sourceViewOnly, l = s.visibleMode;
  z(() => {
    o(!1);
  }, [e.viewStateKey]), z(() => {
    e.session.jobTerminal && o(!1);
  }, [e.session.jobTerminal]);
  const u = M(null);
  return z(() => {
    u.current !== e.viewStateKey && qc({
      liveTranslationAvailable: e.liveTranslationAvailable,
      sourceViewOnly: c,
      jobTerminal: e.session.jobTerminal
    }) && (u.current = e.viewStateKey, o(!0));
  }, [e.liveTranslationAvailable, e.session.jobTerminal, e.viewStateKey, c]), { liveTranslationVisible: r, setLiveTranslationVisible: o, paneComposition: s, liveToggles: i, sourceViewOnly: c, visiblePdfMode: l };
}
function nh(e, { liveTranslationVisible: t, setLiveTranslationVisible: n, liveToggles: r, sourceViewOnly: o, visiblePdfMode: a }) {
  const s = Kc(e.liveTranslation), i = x(() => {
    s && e.goToPage(s, "source");
  }, [e.goToPage, s]), [c, l] = P(null);
  z(() => {
    a === "compare" && e.session.jobTerminal && l(e.viewStateKey);
  }, [e.session.jobTerminal, e.viewStateKey, a]);
  const u = c !== e.viewStateKey && Jc({
    state: e.liveTranslation,
    sourceViewOnly: o,
    visibleMode: a
  }), f = G(() => r.sourcePaneToggle ? /* @__PURE__ */ p(
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
const rh = 4e3;
function oh(e, t, n) {
  if (e.length) {
    const o = ca(e, n), a = o ? ia(e).find((s) => s.id === o) : null;
    if (a) return a.title;
  }
  let r = null;
  for (const o of t)
    !o.headingLevel || o.source.page > n || (!r || o.source.page >= r.source.page) && (r = o);
  return `${(r == null ? void 0 : r.source.text) || (r == null ? void 0 : r.markdown) || ""}`.replace(/\s+/g, " ").trim().slice(0, 80);
}
function ko(e) {
  var a, s;
  if (!e || e.isCollapsed || !e.rangeCount) return { text: "", element: null, rect: null };
  const t = e.getRangeAt(0), n = t.startContainer, r = ((s = (a = n.nodeType === 1 ? n : n.parentElement) == null ? void 0 : a.closest) == null ? void 0 : s.call(a, `[${Re}]`)) ?? null;
  return r ? { text: `${e}`.replace(/\s+\n/g, `
`).trim().slice(0, rh), element: r, rect: t.getBoundingClientRect() } : { text: "", element: null, rect: null };
}
function ah(e, t, n, r, o) {
  let a = null, s = 0.15;
  for (const i of e) {
    const c = Rt(i, t, n);
    if (!c || c.box.page !== r) continue;
    const l = lt(c, 1, 1);
    if (!l) continue;
    const u = o.y < l.top ? l.top - o.y : o.y > l.top + l.height ? o.y - l.top - l.height : 0, f = o.x < l.left ? l.left - o.x : o.x > l.left + l.width ? o.x - l.left - l.width : 0, d = u + f * 0.25;
    (d < s || d === 0 && a === null) && (a = i, s = d);
  }
  return a;
}
function sh({
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
  const l = e.getAttribute(Se) === "source" ? "source" : "translated", u = e.getBoundingClientRect(), f = u.width > 0 && u.height > 0 ? { x: Math.min(1, Math.max(0, (t - u.left) / u.width)), y: Math.min(1, Math.max(0, (n - u.top) / u.height)) } : null, m = (r ? a.find((g) => g.itemId === r) ?? null : null) ?? (f ? ah(a, i, l, c, f) : null);
  return {
    pane: l,
    page: c,
    itemId: (m == null ? void 0 : m.itemId) ?? null,
    selection: o,
    sourceText: `${(m == null ? void 0 : m.source.text) || (m == null ? void 0 : m.markdown) || ""}`.trim(),
    translatedText: `${(m == null ? void 0 : m.translatedBlockText) || (m == null ? void 0 : m.translated.text) || ""}`.trim(),
    section: oh(s, a, (m == null ? void 0 : m.source.page) ?? c),
    point: f
  };
}
const Io = 5e4, ih = 2e4;
function In(e, t) {
  const n = `${e || ""}`;
  return n.length > t ? n.slice(0, t) : n;
}
function fp(e, t) {
  const n = { page: e.page, pane: e.pane, item_ids: e.itemId ? [e.itemId] : [] };
  return t.documentId && (n.document_id = t.documentId), t.jobId && (n.job_id = t.jobId), t.versionId && (n.translation_version = t.versionId), e.selection && (n.selected_text = e.selection), e.section && (n.section = e.section), e.sourceText && (n.source_text = e.sourceText), e.translatedText && (n.translated_text = e.translatedText), n;
}
function ch(e, t = null) {
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
function lh(e, t) {
  if (!(e != null && e.page)) return null;
  const r = [!!(e.document_id && t && e.document_id !== t) ? "别的书" : "", `第 ${e.page} 页`, e.section || ""].filter(Boolean).join(" · ");
  return { page: e.page, label: r, data: e };
}
function uh(e, t) {
  var o;
  if (!t) return;
  const n = e.findIndex((a) => a.message_id === t);
  if (n < 0) return;
  const r = ((o = e[n + 1]) == null ? void 0 : o.role) === "assistant" ? dh(e[n + 1].text) : "";
  return { question: e[n].text, ...r ? { answer: r } : {} };
}
function dh(e, t = 160) {
  const n = e.replace(/```[\s\S]*?(```|$)/g, " ").replace(/\$\$[\s\S]*?\$\$/g, " … ").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim(), r = [...n];
  return r.length > t ? `${r.slice(0, t).join("")}…` : n;
}
function fh(e, t = [], n = "") {
  const r = new Set(t.map((o) => o.covers_to_seq));
  return e.filter((o) => !o.superseded_at).map((o) => {
    const a = r.has(o.seq) ? { compactedBefore: !0 } : {};
    if (o.role === "user") {
      const s = uh(e, o.edited_from);
      return {
        id: o.message_id,
        role: "user",
        text: o.text,
        context: lh(o.selection, n),
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
function mh(e, t, n, r) {
  var l, u, f;
  const o = ((f = (u = (l = e.context) == null ? void 0 : l.meta) == null ? void 0 : u.retainpdf) == null ? void 0 : f.selection) ?? null, a = (o == null ? void 0 : o.document_id) || t || null, s = e.sessionId && e.sessionId.length <= 256 ? e.sessionId : null, i = { agent_id: e.agentId || null, document_id: a, session_id: s }, c = e.answer.usage && JSON.stringify(e.answer.usage).length <= 4096 ? e.answer.usage : null;
  return [
    { ...i, role: "user", text: In(e.question.text, Io), selection: o, client_message_id: `${n}-q`, ...r ? { edited_from: r } : {} },
    {
      ...i,
      role: "assistant",
      text: In(e.answer.text, Io),
      thought: e.answer.thought ? In(e.answer.thought, ih) : null,
      usage: c,
      client_message_id: `${n}-a`,
      memory_ids: e.memoryIds.slice(0, 10)
    }
  ];
}
function hh(e) {
  return new Date(e - 2e3).toISOString().replace(/\.\d+Z$/, "Z");
}
function ph(e, t) {
  return e.filter((n) => n.origin === "agent" && n.status === "active" && !t.has(n.memory_id)).map((n) => ({ id: n.memory_id, scope: n.scope, text: n.text, category: n.category, documentId: n.document_id, created: !0 }));
}
function gh(e, t) {
  if (t.id && e.some((r) => r.message_id === t.id)) return t.id;
  const n = t.text.trim();
  for (let r = e.length - 1; r >= 0; r -= 1) {
    const o = e[r];
    if (o.role === "assistant" && o.text.trim() === n) return o.message_id;
  }
  return null;
}
function bh(e) {
  const t = e.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().split(new RegExp("(?<=[。！？.!?])"))[0] || "";
  return `深挖：${[...t].slice(0, 30).join("")}${[...t].length > 30 ? "…" : ""}`;
}
const yh = 50, Rn = { conversation: null, main: null, records: [], compactions: [], hasMore: !1, key: "local", initial: [] };
function vh() {
  var t, n;
  return `c-${((n = (t = globalThis.crypto) == null ? void 0 : t.randomUUID) == null ? void 0 : n.call(t)) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}
function Ro(e) {
  var n, r, o, a;
  const t = e;
  return `${(t == null ? void 0 : t.reason) || ((n = t == null ? void 0 : t.details) == null ? void 0 : n.reason) || ((a = (o = (r = t == null ? void 0 : t.payload) == null ? void 0 : r.error) == null ? void 0 : o.details) == null ? void 0 : a.reason) || (e instanceof Error ? e.message : "")}`;
}
function wh({ port: e, book: t, onAppended: n }) {
  const r = (e == null ? void 0 : e.conversations) ?? null, o = (e == null ? void 0 : e.memories) ?? null, [a, s] = P(!1), [i, c] = P(Rn), [l, u] = P(!1), [f, d] = P(""), [m, g] = P("idle"), [h, y] = P(null), [w, S] = P(() => /* @__PURE__ */ new Map()), b = M(/* @__PURE__ */ new Set()), v = M(/* @__PURE__ */ new Map()), k = (F) => {
    if (!F) return null;
    const W = v.current.get(F);
    return W || (T.current.records.some((V) => V.message_id === F) ? F : null);
  }, T = M(i);
  T.current = i;
  const A = M(t);
  A.current = t;
  const $ = M(0), O = x(async (F, W, V, me = []) => {
    if (!r) return;
    const J = await r.messages(F.conversation_id, { limit: yh, ...V ? { beforeSeq: V } : {} }), q = [...J.messages, ...me];
    $.current += 1, c({
      conversation: F,
      main: W ?? F,
      records: q,
      compactions: J.compactions || [],
      hasMore: J.has_more,
      key: `${F.conversation_id}:${$.current}`,
      initial: fh(q, J.compactions || [], A.current.documentId)
    });
  }, [r]), _ = x(async () => {
    var F;
    if (s(!0), !(!r || ((F = T.current.conversation) == null ? void 0 : F.kind) === "main")) {
      u(!0), d("");
      try {
        const W = await r.main(A.current.documentId || void 0);
        await O(W, W);
      } catch (W) {
        d(W instanceof Error ? W.message : String(W));
      } finally {
        u(!1);
      }
    }
  }, [r, O]), I = x((F) => {
    y(F), _();
  }, [_]), R = M(t.documentId);
  z(() => {
    R.current !== t.documentId && (R.current = t.documentId, T.current = Rn, c(Rn), y(null), S(/* @__PURE__ */ new Map()), v.current.clear(), a && _());
  }, [t.documentId, a, _]);
  const E = x(async () => {
    const F = T.current, W = F.records[0];
    if (!(!F.conversation || !W || !F.hasMore)) {
      u(!0);
      try {
        await O(F.conversation, F.main, W.seq, F.records);
      } finally {
        u(!1);
      }
    }
  }, [O]), L = x(async (F) => {
    const V = T.current.conversation;
    if (!r || !V) return;
    for (const ne of F.memoryIds) b.current.add(ne);
    let me = F.memoryIds;
    if (!me.length && o && F.startedAt) {
      const ne = ph(
        await o.list({ source_conversation_id: V.conversation_id, created_after: hh(F.startedAt) }).catch(() => []),
        b.current
      );
      for (const ke of ne) b.current.add(ke.id);
      me = ne.map((ke) => ke.id);
      const he = F.answerId;
      ne.length && he && S((ke) => new Map(ke).set(he, ne));
    }
    const J = mh({ ...F, memoryIds: me }, A.current.documentId, vh(), k(F.editedFrom));
    let q;
    try {
      q = await r.append(V.conversation_id, J);
    } catch (ne) {
      if (V.kind !== "side" || !/ask_conversation_not_open/.test(Ro(ne))) throw ne;
      await r.reopen(V.conversation_id), q = await r.append(V.conversation_id, J);
    }
    const [ie, ge] = q.messages;
    F.questionId && ie && v.current.set(F.questionId, ie.message_id), F.answerId && ge && v.current.set(F.answerId, ge.message_id), c((ne) => {
      var he;
      return ((he = ne.conversation) == null ? void 0 : he.conversation_id) === V.conversation_id ? { ...ne, conversation: q.conversation, records: [...ne.records, ...q.messages] } : ne;
    }), n == null || n(q.messages), q.compaction_due && V.kind === "main" && r.compact(V.conversation_id).catch(() => {
    });
  }, [r, o, n]), C = x(async (F) => {
    const W = T.current.conversation, V = k(F);
    if (!r || !W || !V) return null;
    try {
      await r.supersede(W.conversation_id, V);
    } catch (q) {
      if (!/ask_message_superseded/.test(Ro(q))) throw q;
    }
    const me = T.current.records.find((q) => q.message_id === V), J = T.current.records.findIndex((q) => q.message_id === V);
    return c((q) => ({ ...q, records: q.records.map((ie, ge) => ge >= J && J >= 0 && !ie.superseded_at ? { ...ie, superseded_at: "now" } : ie) })), (me == null ? void 0 : me.selection) ?? null;
  }, [r]), U = x((F) => {
    L(F).catch((W) => d(`这一轮没存上：${W instanceof Error ? W.message : String(W)}`));
  }, [L]), N = x(async (F) => {
    var me;
    const W = T.current, V = W.main;
    if (!(!r || !V || ((me = W.conversation) == null ? void 0 : me.kind) !== "main")) {
      d("");
      try {
        const J = gh(W.records, F), q = await r.fork({
          parent_id: V.conversation_id,
          ...J ? { forked_from_message_id: J } : {},
          title: bh(F.text),
          ...A.current.documentId ? { document_id: A.current.documentId } : {}
        });
        await O(q, V);
      } catch (J) {
        d(`开不了副对话：${J instanceof Error ? J.message : String(J)}`);
      }
    }
  }, [r, O]), H = x(async (F) => {
    const W = T.current.main;
    if (r)
      try {
        await O(await r.get(F), W);
      } catch (V) {
        d(`打不开副对话：${V instanceof Error ? V.message : String(V)}`);
      }
  }, [r, O]), K = x(async () => {
    const F = T.current.main;
    F && await O(F, F).catch(() => {
    });
  }, [O]), Y = x(async () => {
    const F = T.current.conversation;
    if (!(!r || (F == null ? void 0 : F.kind) !== "side")) {
      g("busy");
      try {
        await r.close(F.conversation_id), g("idle"), await K();
      } catch {
        g("failed");
      }
    }
  }, [r, K]), Z = x(async () => {
    const F = T.current.main;
    if (!r || !F) return;
    await r.archive(F.conversation_id);
    const W = await r.main(A.current.documentId || void 0);
    await O(W, W);
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
    openMain: _,
    ask: I,
    close: x(() => s(!1), []),
    loadEarlier: E,
    onTurn: U,
    rewrite: C,
    fork: N,
    openSide: H,
    backToMain: K,
    closeSide: Y,
    archiveMain: Z,
    forgetMemory: r ? r.forgetMemory : void 0
  };
}
function To(e, t, n) {
  var c;
  const r = e.selection, o = e.page ?? (r == null ? void 0 : r.page) ?? 0;
  if (e.role !== "user" || !o) return null;
  const a = (e.pane ?? (r == null ? void 0 : r.pane)) === "source" ? "source" : "translated", s = ((c = r == null ? void 0 : r.item_ids) == null ? void 0 : c[0]) ?? null, i = ch({ item_ids: [], ...r, page: o, pane: a }, n(s, a, o));
  return { key: t, anchor: i, messageId: e.message_id, title: e.text.slice(0, 80) };
}
function Sh({ port: e, documentId: t, resetKey: n, pointOf: r }) {
  const [o, a] = P([]), s = M(0), i = M(r);
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
      (h) => d(h.map((y) => To(y, c(), i.current)).filter((y) => !!y)),
      () => {
      }
    ), () => {
      f = !0;
    };
  }, [e, t, n]);
  const l = x((f) => {
    const d = f.filter((m) => !m.document_id || m.document_id === t).map((m) => To(m, c(), i.current)).filter((m) => !!m);
    d.length && a((m) => [...m.filter((g) => !d.some((h) => h.messageId === g.messageId)), ...d]);
  }, [t]), u = x((f) => a((d) => d.filter((m) => m.key !== f)), []);
  return { marks: o, addRecords: l, removeMark: u };
}
const kh = Ao(() => import("./ReaderAskPanel-D2qEGl8F.js"));
function Ih({
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
  const f = G(() => ({ documentId: t, jobId: n, versionId: r }), [t, n, r]), d = x((N, H, K) => {
    const Y = N ? o.find((W) => W.itemId === N) : null, Z = Y ? Rt(Y, a, H) : null, F = Z && Z.box.page === K ? lt(Z, 1, 1) : null;
    return F ? { x: F.left, y: F.top } : null;
  }, [o, a]), m = Sh({ port: e, documentId: t, resetKey: c, pointOf: d }), g = wh({ port: e, book: f, onAppended: m.addRecords }), [h, y] = P(null), w = x(
    (N, H, K, Y) => sh({
      pageElement: (N == null ? void 0 : N.closest(`[${Re}]`)) ?? null,
      clientX: H,
      clientY: K,
      itemId: i(),
      selection: Y,
      regions: o,
      bookmarks: s,
      metadata: a
    }),
    [i, o, s, a]
  ), S = x(() => {
    var H;
    const N = ko(((H = globalThis.getSelection) == null ? void 0 : H.call(globalThis)) ?? null);
    return !N.text || !N.element || !N.rect ? null : w(N.element, N.rect.left + N.rect.width / 2, N.rect.top + N.rect.height / 2, N.text);
  }, [w]), b = x((N) => {
    y(null), g.ask(N);
  }, [g.ask]);
  z(() => {
    if (!e) return;
    const N = (H) => {
      var Z;
      if (H.key !== "?" || H.metaKey || H.ctrlKey || H.altKey || H.defaultPrevented) return;
      const K = H.target;
      if ((Z = K == null ? void 0 : K.closest) != null && Z.call(K, "input, textarea, select, [contenteditable='true']")) return;
      const Y = S();
      Y && (H.preventDefault(), H.stopImmediatePropagation(), b(Y));
    };
    return window.addEventListener("keydown", N, !0), () => window.removeEventListener("keydown", N, !0);
  }, [e, S, b]);
  const v = M(""), k = ((U = g.pending) == null ? void 0 : U.selection) || "";
  z(() => {
    k && (v.current = k);
  }, [k]);
  const T = g.visible && !h, A = g.setPending;
  z(() => {
    if (!T) return;
    let N = null;
    const H = () => {
      N && clearTimeout(N), N = setTimeout(() => {
        const K = S();
        K && K.selection !== v.current && A(K);
      }, 250);
    };
    return document.addEventListener("selectionchange", H), () => {
      N && clearTimeout(N), document.removeEventListener("selectionchange", H);
    };
  }, [T, S, A]);
  const $ = x(async (N) => {
    if (N.threadId && (e != null && e.threads) && t) {
      try {
        const H = await e.threads.get(t, N.threadId);
        y({ anchor: H.anchor || N.anchor, messages: H.messages || [], mark: N });
      } catch {
        y({ anchor: N.anchor, messages: [], mark: N });
      }
      return;
    }
    y(null), g.openMain();
  }, [e, t, g.openMain]), [O, _] = P(null), I = x((N, H, K) => {
    var Z;
    if (!e) return;
    const Y = ko(((Z = globalThis.getSelection) == null ? void 0 : Z.call(globalThis)) ?? null);
    _(w(N, H, K, Y.element ? Y.text : ""));
  }, [e, w]), R = e && O ? [{
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
  } : null, L = !g.persistent || !!g.view.conversation || !!g.error, C = e && (g.visible && L || h) ? /* @__PURE__ */ p(_o, { fallback: null, children: /* @__PURE__ */ p(
    kh,
    {
      port: e,
      jobId: n,
      book: f,
      ask: g,
      legacy: E,
      onShowSelection: ({ page: N, pane: H }) => l(N, H),
      onJumpToPage: (N) => l(N),
      pageCount: u
    }
  ) }) : null;
  return { marks: m.marks, onMark: $, captureMenu: I, menuActions: R, panel: C, open: g.openMain };
}
function Rh(e, { bookmarks: t, regionHover: n, readingVersionId: r }) {
  const { session: o, panes: a } = e, s = G(() => {
    try {
      return Ke().ask ?? null;
    } catch {
      return null;
    }
  }, []);
  return Ih({
    port: s,
    documentId: o.documentId || "",
    jobId: o.jobId,
    versionId: r || null,
    regions: o.regions,
    metadata: o.readerMetadata,
    bookmarks: t,
    hoveredItemId: () => n.get().itemId,
    resetKey: e.viewStateKey,
    goToPage: e.goToPage,
    pageCount: a.hudNumPages || 0
  });
}
function Th() {
  try {
    return Ke().translationEdit ?? null;
  } catch {
    return null;
  }
}
const Eh = "这本书正在处理（翻译或排版），处理完才能改。", Ph = "这本书的译文是几次翻译拼起来的，这一版还不能在阅读页里改。";
function Mh({
  jobId: e,
  jobStatus: t,
  jobPayload: n,
  hasTranslation: r,
  refreshJobStatus: o
}) {
  const a = Th(), s = `${e || ""}`.trim(), i = !!(a && s && r), c = Gl(s), l = !t || Ft(t), u = tu(n), [f, d] = P(""), [m, g] = P(null), [h, y] = P(() => /* @__PURE__ */ new Map()), [w, S] = P(
    () => ({ renderedAt: "", edits: /* @__PURE__ */ new Map() })
  ), [b, v] = P(() => /* @__PURE__ */ new Map()), [k, T] = P({ phase: "idle" }), A = M({ drafts: /* @__PURE__ */ new Map(), generation: { current: null } }).current;
  z(() => {
    g(null), A.drafts.clear(), A.generation.current = null, v(/* @__PURE__ */ new Map()), T({ phase: "idle" });
  }, [s]), z(() => {
    if (d(""), !i || c || !a) return;
    let C = !1;
    return a.resolveOwnerJobId(s).then((U) => {
      C || d(`${U || s}`.trim() || s);
    }).catch(() => {
      C || d(s);
    }), () => {
      C = !0;
    };
  }, [i, c, a, s]), z(() => {
    if (y(/* @__PURE__ */ new Map()), !a || !f || !u || !l) return;
    let C = !1;
    return a.fetchRevisions(f).then((U) => {
      C || y(nu(U, u));
    }).catch(() => {
    }), () => {
      C = !0;
    };
  }, [a, f, u, l]);
  const $ = k.phase === "running" && k.seenActive;
  z(() => {
    if (k.phase === "running") {
      if (!l) {
        $ || T({ phase: "running", seenActive: !0 });
        return;
      }
      $ && T(t === "succeeded" ? { phase: "idle" } : { phase: "failed", message: "重新排版没成功，PDF 还是之前那份，改动都还在，可以再排一次。" });
    }
  }, [k.phase, $, l, t]);
  const O = G(() => {
    const C = new Map(h);
    if (w.renderedAt === u)
      for (const [U, N] of w.edits) C.set(U, N);
    return C;
  }, [h, w, u]), _ = x((C) => {
    const U = `${C || ""}`.trim();
    U && g({ itemId: U, page: Xl(U) });
  }, []), I = x(() => g(null), []), R = x((C, U) => {
    S((N) => {
      const H = new Map(N.renderedAt === u ? N.edits : []);
      return H.set(C, U), { renderedAt: u, edits: H };
    }), v((N) => new Map(N).set(C, (N.get(C) || 0) + 1));
  }, [u]), E = x(async () => {
    if (!(!a || !s || k.phase === "submitting" || k.phase === "running")) {
      T({ phase: "submitting" });
      try {
        await a.rerender(s), T({ phase: "running", seenActive: !1 }), await o();
      } catch (C) {
        T({ phase: "failed", message: (C == null ? void 0 : C.message) || "提交重新排版失败，请稍后再试。" });
      }
    }
  }, [a, s, k.phase, o]), L = c ? Ph : !l || k.phase === "running" || k.phase === "submitting" ? Eh : "";
  return G(() => ({
    available: i,
    blockedReason: L,
    port: a,
    ownerJobId: f,
    target: m,
    select: _,
    close: I,
    memory: A,
    pendingEdits: O,
    savedCounts: b,
    markSaved: R,
    rerender: k,
    startRerender: E
  }), [i, L, a, f, m, _, I, A, O, b, R, k, E]);
}
function _h(e, t) {
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
function Ah(e, t, n) {
  const { session: r, sessionFiles: o } = e, a = Mh({
    jobId: r.jobId,
    jobStatus: r.jobStatus,
    jobPayload: r.download.jobPayload,
    hasTranslation: !e.sourceOnly && !!o.translatedUrl,
    refreshJobStatus: r.refreshJobStatus
  }), s = a.select, i = e.setModeKeepingPage, c = r.regions, l = x((f) => {
    su(c, f) && (t === "source" && i("compare"), s(f));
  }, [c, s, t, i]);
  _h(a.available ? l : null, n);
  const u = G(() => {
    if (!a.savedCounts.size) return e.revisedBlocks;
    const f = new Map(e.revisedBlocks);
    for (const [d, m] of a.savedCounts) f.set(d, (f.get(d) || 0) + m);
    return f;
  }, [e.revisedBlocks, a.savedCounts]);
  return { blockEdit: a, editBlock: l, revisedBlocks: u };
}
function Tn() {
  try {
    return Ke().translationVersions ?? null;
  } catch {
    return null;
  }
}
function Nh(e) {
  return e.map((t) => ({ ...t, source: { ...t.translated } }));
}
function Lh(e, t, n) {
  var r;
  return ((r = e.find((o) => o.jobIds.includes(t))) == null ? void 0 : r.versionId) || n || "";
}
function xh(e, t) {
  const n = new URL(e);
  return n.searchParams.set("job_id", t), n.searchParams.delete("block_id"), `${n.pathname}${n.search}${n.hash}`;
}
function Dh({ documentId: e, jobId: t }) {
  const [n, r] = P([]), [o, a] = P(null), [s, i] = P(null), [c, l] = P(""), [u, f] = P(""), d = M(0);
  z(() => {
    r([]), i(null), f("");
    const y = Tn();
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
    const w = Tn(), S = n.find((v) => v.versionId === y);
    if (!w || !S || !e) return;
    const b = ++d.current;
    l(y), f(""), (async () => {
      const v = Ke(), k = await w.resolveJob(e, y);
      if (!k) throw new Error("这一份还没有能读的译文。");
      const T = await v.loadReaderPayload(k, { includeOptionalArtifacts: !0 }), A = v.resolveReaderTranslatedPdfUrl(T.jobPayload, T.manifestPayload);
      if (!A) throw new Error("这一份没有译文 PDF。");
      return { versionId: y, name: S.name, jobId: k, url: A, regions: Nh(No(T.regionsPayload)) };
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
    const y = Tn();
    if (!y || !s || !e) return;
    try {
      await y.select(e, s.versionId);
    } catch (v) {
      f((v == null ? void 0 : v.message) || "换不过去，请稍后再试。");
      return;
    }
    const w = (S = globalThis.location) == null ? void 0 : S.href;
    w && ((b = globalThis.history) == null || b.replaceState(globalThis.history.state, "", xh(w, s.jobId))), i(null);
  }, [s, e]);
  return {
    available: n.length >= 2,
    versions: n,
    readingVersionId: Lh(n, t, o),
    compared: s,
    loading: c,
    error: u,
    choose: m,
    clear: g,
    adopt: h
  };
}
function Ch(e, t, n) {
  var i;
  const { session: r } = e, o = Dh({ documentId: r.documentId, jobId: r.jobId }), a = ((i = o.compared) == null ? void 0 : i.url) || "";
  z(() => {
    a && t !== "compare" && n("compare");
  }, [a]), z(() => {
    t !== "compare" && o.clear();
  }, [t]);
  const s = G(
    () => {
      const { compared: c, versions: l, readingVersionId: u } = o;
      if (!c) return null;
      const f = l.find((m) => m.versionId === c.versionId), d = l.find((m) => m.versionId === u);
      return {
        url: c.url,
        regions: c.regions,
        left: { name: c.name, createdAt: (f == null ? void 0 : f.createdAt) || "" },
        right: { name: (d == null ? void 0 : d.name) || "当前译文", createdAt: (d == null ? void 0 : d.createdAt) || "" }
      };
    },
    [o.compared, o.versions, o.readingVersionId]
  );
  return { versionCompare: o, compareVersion: s };
}
const zh = "reader-finder-input";
function Oh(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function $h(e, t = typeof window > "u" ? null : window) {
  z(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!Oh(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(zh) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
function Fh(e) {
  const [t, n] = P(null), r = x((m) => n((g) => g === m ? null : m), []), [o, a] = P(""), [s, i] = P("");
  z(() => {
    const m = o.replace(/\s+/gu, " ").trim(), g = window.setTimeout(() => i(m), m ? 150 : 0);
    return () => window.clearTimeout(g);
  }, [o]);
  const [c, l] = P(0), u = x(() => {
    n("search"), l((m) => m + 1);
  }, []);
  $h(u);
  const f = x((m) => {
    e.jumpToAnchor({ block_id: m }), (t === "outline" || Ye() < 900) && n(null);
  }, [e.jumpToAnchor, t]), d = x((m) => {
    e.goToPage(m), (t === "outline" || Ye() < 900) && n(null);
  }, [e.goToPage, t]);
  return { finder: t, setFinder: n, toggleFinder: r, findQuery: o, setFindQuery: a, findTerm: s, findFocus: c, jumpFromFinder: f, jumpToPageFromFinder: d };
}
function Bh(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : qo(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function jh(e, t) {
  return t === null || e !== t;
}
function Hh(e, t) {
  const { boot: n } = e, r = M(null), o = M(null);
  z(() => {
    if (!(n.loading || n.failed)) {
      if (r.current !== e.viewStateKey) {
        r.current = e.viewStateKey;
        const a = De(e.viewStateKey), s = Bh({
          savedMode: a == null ? void 0 : a.mode,
          sourceViewOnly: t,
          viewportWidth: Ye()
        });
        o.current = s.auto ? s.mode : null, s.mode && s.mode !== e.mode && e.setModeKeepingPage(s.mode);
        return;
      }
      jh(e.mode, o.current) && (o.current = null, fn(e.viewStateKey, { mode: e.mode }));
    }
  }, [n.failed, n.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, t]);
}
const Uh = [];
function Wh(e) {
  const { sessionFiles: t } = e, [n, r] = P({}), o = M({ source: t.sourceUrl, translated: t.translatedUrl });
  o.current = { source: t.sourceUrl, translated: t.translatedUrl };
  const a = x((y, w) => {
    r((S) => ({ ...S, [w]: { url: o.current[w], nodes: y } }));
  }, []), s = G(() => {
    const y = n.source;
    if (y && y.url === t.sourceUrl && y.nodes.length) return y.nodes;
    const w = n.translated;
    return w && w.url === t.translatedUrl && w.nodes.length ? w.nodes : Uh;
  }, [n, t.sourceUrl, t.translatedUrl]), i = M({}), [c, l] = P(0), u = x((y, w) => {
    i.current[w] = { url: o.current[w], pdf: y }, l((S) => S + 1);
  }, []), [f, d] = P(null), m = x((y) => d(y), []), g = x(() => d(null), []);
  z(() => d(null), [e.viewStateKey]);
  const h = G(() => {
    const y = (w, S) => {
      const b = i.current[w];
      return b && b.url === S ? b.pdf : null;
    };
    return { source: y("source", t.sourceUrl), translated: y("translated", t.translatedUrl) };
  }, [c, t.sourceUrl, t.translatedUrl]);
  return { bookmarks: s, onPdfOutline: a, onPdfDocument: u, zoomItem: f, setZoomItem: d, zoomBlock: m, closeZoom: g, zoomDocuments: h };
}
const Kh = Ao(() => import("./ReaderMarkdownPanel-XaSPg1Jw.js").then((e) => ({ default: e.ReaderMarkdownPanel })));
function Vh() {
  const e = rl(), { boot: t, panes: n, session: r } = e, o = mm(e.viewStateKey), a = o.panel, s = o.setPanel, i = a !== null, { liveTranslationVisible: c, setLiveTranslationVisible: l, paneComposition: u, liveToggles: f, sourceViewOnly: d, visiblePdfMode: m } = th(e, i);
  Hh(e, d);
  const g = a || (e.mode === "compare" ? "compare" : "reading"), h = ym(a, "markdown"), { docDark: y, toggleDocDark: w } = Cm();
  ul({
    toggleDocDark: w,
    mode: m,
    sourceOnly: e.sourceOnly,
    setMode: e.setModeKeepingPage,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    currentPage: e.currentPage,
    numPages: n.hudNumPages,
    goToPage: e.goToPage,
    enabled: e.showHud
  });
  const S = x(() => {
    s(null);
  }, []), { latestLivePage: b, jumpToLatestLivePage: v, offerCompletion: k, setCompletionDismissedKey: T, sourcePaneAction: A } = nh(e, {
    liveTranslationVisible: c,
    setLiveTranslationVisible: l,
    liveToggles: f,
    sourceViewOnly: d,
    visiblePdfMode: m
  }), $ = x((ue) => {
    const ve = eh(ue, e.liveTranslationAvailable);
    ve !== null && l(ve), e.setModeKeepingPage(ue);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), O = x((ue) => {
    s(ue);
  }, []), [_] = P(vm), I = Fh(e), { finder: R, toggleFinder: E, findTerm: L } = I, C = x((ue) => e.jumpToAnchor({ block_id: ue }), [e.jumpToAnchor]), { bookmarks: U, onPdfOutline: N, onPdfDocument: H, zoomItem: K, setZoomItem: Y, zoomBlock: Z, closeZoom: F, zoomDocuments: W } = Wh(e), V = G(() => Ul(r.regions), [r.regions]), me = x(
    (ue, ve) => e.jumpToAnchor({ block_id: ue.itemId }, ve),
    [e.jumpToAnchor]
  ), J = Bm({ shellEl: e.shell.shellEl, index: V, primaryPane: e.panes.primaryPane, follow: me }), { blockEdit: q, editBlock: ie, revisedBlocks: ge } = Ah(e, m, _), ne = Xu(e.viewStateKey);
  Nm(ne);
  const [he, ke] = P(null), tt = x(() => ke(null), []), { versionCompare: _e, compareVersion: se } = Ch(e, m, $), ce = Rh(e, { bookmarks: U, regionHover: _, readingVersionId: _e.readingVersionId }), be = ce.marks, j = ce.onMark, re = G(() => ({
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
    regionHover: _,
    jumpToBlock: C,
    revisedBlocks: ge,
    onPdfOutline: N,
    onPdfDocument: H,
    zoomBlock: Z,
    xrefIndex: V,
    askMarks: be,
    onAskMark: j,
    editBlock: q.available ? ie : void 0,
    blockEdit: q,
    editShowsSource: m !== "compare",
    findTerm: R === "search" ? L : "",
    compareVersion: se,
    ink: ne,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: d,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: O, close: S },
    docDark: y,
    toggleDocDark: w
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
    _,
    C,
    ge,
    N,
    H,
    Z,
    V,
    be,
    j,
    q,
    ie,
    m,
    R,
    L,
    se,
    ne,
    e.sourceOnly,
    d,
    e.download,
    e.goToPage,
    O,
    S,
    y,
    w
  ]), ae = G(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), Ae = [
    Ci,
    `is-workspace-${g}`,
    i ? "is-assistant-open" : "",
    R ? "is-finder-open" : "",
    u.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ p(rd, { value: re, hud: ae, children: /* @__PURE__ */ D(
    "div",
    {
      className: Ae,
      "data-reader-engine": "react-pdf",
      "data-reader-workspace": g,
      "data-ink-mode": ne.tool || void 0,
      onContextMenu: (ue) => {
        const ve = Am(ue);
        ve && (ue.preventDefault(), ce.captureMenu(ue.target, ue.clientX, ue.clientY), ke(ve));
      },
      children: [
        /* @__PURE__ */ p(zf, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!r.readerErrors.regions, metadataError: !!r.readerErrors.metadata, onRetry: r.refreshJobArtifacts }),
        /* @__PURE__ */ p(jm, { state: I, bookmarks: U }),
        /* @__PURE__ */ D("div", { className: "reader-chrome-tray", children: [
          /* @__PURE__ */ p(Kf, {}),
          /* @__PURE__ */ p(bl, { onBeforeClose: r.prepareClose })
        ] }),
        /* @__PURE__ */ p(
          jd,
          {
            mode: m,
            documentReady: !!r.jobId,
            sourceViewOnly: d,
            onModeChange: $,
            liveTranslation: f.topBarPill ? {
              visible: c,
              state: e.liveTranslation,
              onToggle: () => l((ue) => !ue),
              latestPage: c ? b : null,
              currentPage: e.currentPage,
              onJumpToLatest: v
            } : null,
            completion: k ? {
              onOpenCompare: () => {
                T(e.viewStateKey), $("compare");
              }
            } : null
          }
        ),
        /* @__PURE__ */ p(qd, { active: a }),
        i ? /* @__PURE__ */ p(Df, {}) : null,
        /* @__PURE__ */ p(Od, { paneComposition: u, markdownSplit: h.open, assistantSplit: i, liveTranslation: e.liveTranslation, sourcePaneAction: A }),
        e.showHud ? /* @__PURE__ */ p(
          dm,
          {
            mode: m,
            modeControls: null,
            bookmarkScope: e.viewStateKey,
            issuesJobId: e.sourceOnly ? "" : r.jobId,
            searchSlot: /* @__PURE__ */ p(Rm, { open: R, onToggle: E })
          }
        ) : null,
        /* @__PURE__ */ p(_o, { fallback: null, children: h.mounted ? /* @__PURE__ */ p(Kh, { open: h.open, jobId: r.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: S }) : null }),
        /* @__PURE__ */ p(
          Ym,
          {
            session: r,
            xrefs: J,
            zoomDocuments: W,
            zoomItem: K,
            setZoomItem: Y,
            closeZoom: F,
            visiblePdfMode: m
          }
        ),
        /* @__PURE__ */ p(Em, { active: a, compare: _e, ink: ne }),
        /* @__PURE__ */ p(
          Mm,
          {
            ink: ne,
            menu: he,
            onClose: tt,
            actions: ce.menuActions
          }
        ),
        ce.panel,
        /* @__PURE__ */ p(_m, { ink: ne }),
        /* @__PURE__ */ p(Lm, { edit: q }),
        /* @__PURE__ */ p(gm, {})
      ]
    }
  ) });
}
function mp() {
  return /* @__PURE__ */ p(Vh, {});
}
export {
  mp as R,
  Vh as a,
  fp as b,
  dp as c,
  up as d,
  cp as f,
  lp as r,
  ch as s,
  Ve as u
};
//# sourceMappingURL=ReaderApp-CVFOwGJF.js.map
