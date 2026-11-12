var $n = (e) => {
  throw TypeError(e);
};
var jn = (e, t, n) => t.has(e) || $n("Cannot " + n);
var it = (e, t, n) => (jn(e, t, "read from private field"), n ? n.call(e) : t.get(e)), Bn = (e, t, n) => t.has(e) ? $n("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Un = (e, t, n, r) => (jn(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as F, jsx as v, Fragment as vt } from "react/jsx-runtime";
import { useMemo as K, useState as L, useEffect as x, useCallback as $, useRef as k, useLayoutEffect as Ne, memo as hn, createContext as pn, useContext as gn, forwardRef as No, useImperativeHandle as bn, useSyncExternalStore as Cr, useId as Dr, Suspense as Lo, lazy as Co } from "react";
import { requireAdapter as at, getReaderAdapters as ve } from "./adapters.js";
import { resolveReaderDownloadName as Do, resolveReaderDownloadUrls as zo, READER_PROGRESS_COPY as Me, trimString as Nt, READER_DOWNLOAD_ACTIONS as xo, disabledReason as Oo } from "./runtime/state.js";
import { r as Fo, b as $o } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as Xt, isFinishedJobStatus as yn } from "@retainpdf/domain/job";
import { n as jo, d as Bo, f as Wt, k as Hn, b as Uo, c as Ho, j as zr, p as vn, g as Wo, l as Wn, i as Vo } from "./reader-regions-B6o2DsPy.js";
import { fetchDocumentReading as Jo } from "@retainpdf/api/documents";
import { isReaderTransportError as qo, createReaderTransportError as Go } from "./contracts.js";
import { toast as Qt, Toaster as Ko } from "sonner";
import { X as Sn, Radio as Zo, FileText as xr, Columns2 as Or, Languages as Fr, FileCode2 as Yo, Keyboard as Xo, Download as Qo, ChevronDown as ea, ListTree as ta, Search as na } from "lucide-react";
import { Button as je, Input as ra } from "@retainpdf/ui";
import { pdfjs as $r, Page as oa, Document as aa } from "react-pdf";
import { e as sa, m as ia, a as ca } from "./markdown-math-XkF5urpn.js";
const la = (...e) => {
  var t, n;
  return ((n = (t = ve()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, ua = "", da = Object.freeze({
  progress: "retainpdf-reader-progress"
}), fa = (e) => {
  var t, n;
  return ((n = (t = ve()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, yu = (...e) => {
  var n;
  return (((n = ve()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, ke = () => at("defaultReaderDataPort"), Vn = () => at("defaultReaderPageConfigPort"), vu = {
  get apiPrefix() {
    return ke().apiPrefix;
  },
  fetchProtected: (...e) => ke().fetchProtected(...e),
  loadMarkdownPayload: (e) => ke().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => ke().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => ke().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => ke().loadJobPayload(e),
  loadReaderPayload: (e, t) => ke().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => ke().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return ke().liveTranslation;
  }
}, jr = {
  messageTargetOrigin: () => Vn().messageTargetOrigin(),
  readerJobId: () => Vn().readerJobId()
}, ma = () => {
  var e;
  return ((e = ve()) == null ? void 0 : e.liveTranslation) ?? null;
}, mt = () => {
  var t;
  const e = ve();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, $t = () => {
  const e = ve();
  if (e != null && e.sessionData) return e.sessionData;
  const t = e == null ? void 0 : e.defaultReaderDataPort;
  if (!t) throw new Error("Reader adapter missing: defaultReaderDataPort (call setReaderAdapters)");
  return {
    loadReaderPayload: t.loadReaderPayload,
    // 旧宿主 / 测试替身可能没有这个方法：缺了就是 undefined，session 照旧一并加载。
    loadReaderOptionalArtifacts: t.loadReaderOptionalArtifacts,
    loadJobPayload: t.loadJobPayload,
    fetchDocumentByJobId: (...n) => at("fetchDocumentByJobId")(...n),
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
}, ha = (...e) => {
  var t, n;
  return ((n = (t = ve()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, pa = () => {
  var e, t;
  return ((t = (e = ve()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, ga = (...e) => {
  var t, n;
  return ((n = (t = ve()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, ba = (...e) => {
  var t, n;
  return ((n = (t = ve()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? Do(...e);
}, ya = (...e) => {
  var t, n;
  return ((n = (t = ve()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? zo(...e);
}, va = (...e) => at("downloadProtectedResource")(...e), Sa = (...e) => at("failDownloadToast")(...e), Su = (e, t) => at("resolveMarkdownAssetUrl")(e, t), Jn = "/api/v1";
function wa() {
  const e = () => {
    var r;
    return Fo(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = L(e);
  return x(() => {
    var c, i, l, u;
    const r = () => n(e()), o = (i = (c = globalThis.history) == null ? void 0 : c.pushState) == null ? void 0 : i.bind(globalThis.history), a = (u = (l = globalThis.history) == null ? void 0 : l.replaceState) == null ? void 0 : u.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const d = (f) => function(...h) {
          const g = f.apply(this, h);
          return r(), globalThis.dispatchEvent(new Event("pushstate")), globalThis.dispatchEvent(new Event("replacestate")), globalThis.dispatchEvent(new Event("locationchange")), g;
        };
        globalThis.history.pushState = d(o), globalThis.history.replaceState = d(a), s = !0;
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
function Ra() {
  const e = wa(), t = K(() => ga(jr), [e]), n = K(() => pa(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function Pa(e) {
  const {
    routeDocumentId: t,
    jobId: n,
    sessionIdentity: r,
    sessionIdentityRef: o,
    documentIdRef: a,
    sessionJobIdRef: s,
    switchToSourceMode: c
  } = e, [i, l] = L({
    documentId: "",
    jobId: ""
  }), [u, d] = L({
    documentId: "",
    jobId: ""
  }), f = i.documentId === t ? i.jobId : "", h = u.documentId === t ? u.jobId : "", g = n || f, [p, S] = L({
    jobId: "",
    documentId: ""
  }), b = p.jobId === g ? p.documentId : "", R = t || b, w = !!t && !g, [m, y] = L(null), M = (m == null ? void 0 : m.sessionIdentity) === r && m.documentId === R ? m : null, _ = w || !!M, O = $((D) => {
    const I = `${D.documentId || ""}`.trim();
    if (!I || a.current && a.current !== I) return;
    if (!a.current && s.current)
      S({
        jobId: s.current,
        documentId: I
      });
    else if (!a.current)
      return;
    const P = `${D.revision || ""}`.trim() || `${Date.now()}`;
    y({
      documentId: I,
      revision: P,
      sessionIdentity: o.current
    }), c();
  }, []);
  x(() => {
    y((D) => D && D.sessionIdentity !== r ? null : D);
  }, [r]);
  const C = $((D) => {
    switch (D.type) {
      case "resolved-document-job":
        l({ documentId: D.documentId, jobId: D.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        d({ documentId: D.documentId, jobId: D.jobId });
        break;
      case "resolved-job-document":
        S((I) => I.jobId === D.jobId && I.documentId === D.documentId ? I : { jobId: D.jobId, documentId: D.documentId });
        break;
      case "committed-source":
        y({
          documentId: D.documentId,
          revision: D.revision,
          sessionIdentity: D.sessionIdentity
        });
        break;
    }
  }, []);
  return {
    resolvedDocumentJob: i,
    setResolvedDocumentJob: l,
    missingDocumentJob: u,
    setMissingDocumentJob: d,
    documentJobId: f,
    rejectedDocumentJobId: h,
    sessionJobId: g,
    resolvedJobDocument: p,
    setResolvedJobDocument: S,
    jobDocumentId: b,
    documentId: R,
    sourceOnly: w,
    committedDocumentSource: m,
    setCommittedDocumentSource: y,
    activeCommittedDocumentSource: M,
    sourceViewOnly: _,
    refreshCommittedDocument: O,
    applyIdentityEvent: C
  };
}
function qn(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function Ia(e) {
  var r, o, a, s;
  if (!e || typeof e != "object") return "";
  const t = e, n = [
    t.document_id,
    t.documentId,
    (r = t.document) == null ? void 0 : r.document_id,
    (o = t.book_summary) == null ? void 0 : o.document_id,
    (s = (a = t.request_payload) == null ? void 0 : a.source) == null ? void 0 : s.document_id
  ];
  for (const c of n) {
    const i = `${c || ""}`.trim();
    if (i) return i;
  }
  return "";
}
function Gn(e, t) {
  return fa(Xt(e, t));
}
function Ta(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function Ea(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !Ta(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function en({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: da.progress,
        stage: n,
        percent: e,
        text: t
      },
      jr.messageTargetOrigin()
    );
  } catch {
  }
}
function Lt(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), en({ percent: t, text: n, stage: r });
}
function Ma(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [c, i] = L(null), [l, u] = L(null), [d, f] = L(""), [h, g] = L(0), p = d === n ? c : null, S = d === n ? l : null, b = qn(p), R = yn(b), w = $(() => {
    g((C) => C + 1);
  }, []), m = $((C) => {
    i(C.jobPayload), u(C.manifestPayload), f(C.sessionIdentity);
  }, []), y = $((C) => {
    i(null), u(null), f(C);
  }, []), M = k(""), _ = k(""), O = $(async () => {
    const C = o.current;
    if (!C || M.current === C) return;
    const D = $t().loadJobPayload;
    if (typeof D != "function") return;
    const I = a.current.value;
    M.current = C;
    try {
      const P = await D(C);
      if (s.current || a.current.value !== I || o.current !== C || !P || typeof P != "object")
        return;
      const T = qn(P);
      i(P), f(r.current), T === "succeeded" && _.current !== C && (_.current = C, g((E) => E + 1));
    } catch {
    } finally {
      M.current === C && (M.current = "");
    }
  }, []);
  return x(() => {
    _.current = "";
  }, [n]), x(() => {
    if (!t || R || !p) return;
    const C = window.setInterval(() => {
      document.visibilityState !== "hidden" && O();
    }, 1e3);
    return () => window.clearInterval(C);
  }, [R, O, p, t]), {
    jobPayload: c,
    setJobPayload: i,
    manifestPayload: l,
    setManifestPayload: u,
    payloadSessionIdentity: d,
    setPayloadSessionIdentity: f,
    scopedJobPayload: p,
    scopedManifestPayload: S,
    jobStatus: b,
    jobTerminal: R,
    jobRefreshRevision: h,
    refreshJobArtifacts: w,
    refreshJobStatus: O,
    publishPayload: m,
    clearPayload: y
  };
}
function tn(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function ka(e, t) {
  e(t), tn(t);
}
function Aa(e) {
  const [t, n] = L(e ? "source" : "compare"), r = $((a) => {
    e && a !== "source" || (n(a), tn(a));
  }, [e]), o = $((a) => {
    ka(n, a);
  }, []);
  return x(() => (e && document.documentElement.classList.add("reader-source-only"), tn(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Kn(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function _a(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Kn(n.active_job_id),
    activeVersionId: Kn(n.active_version_id)
  };
}
function Na(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function La(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function Ca(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Da = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function za(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Da.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const xa = 48 * 1024 * 1024;
function Oa(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Fa = 2, pe = /* @__PURE__ */ new Map();
function nn(e, t) {
  pe.delete(e), pe.set(e, t);
}
function Zn(e) {
  if (pe.size < Fa) return;
  const t = pe.keys().next().value;
  t && pe.delete(t);
}
async function $a(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function Br(e, t = mt().fetchProtected, n = {}) {
  var u, d, f, h, g, p, S, b, R;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (pe.has(r)) {
    const w = pe.get(r);
    return nn(r, w), w;
  }
  const o = new AbortController(), a = () => o.abort();
  (u = n.signal) != null && u.aborted && o.abort(), (f = (d = n.signal) == null ? void 0 : d.addEventListener) == null || f.call(d, "abort", a, { once: !0 });
  let s;
  try {
    s = await t(r, { signal: o.signal });
  } finally {
    (g = (h = n.signal) == null ? void 0 : h.removeEventListener) == null || g.call(h, "abort", a);
  }
  if (!s.ok) {
    const w = new Error(`读取 PDF 失败 (${s.status})`);
    w.status = s.status;
    const m = await $a(s);
    throw m && (w.reason = m), w;
  }
  const c = ja(r, s, t);
  if (c) {
    o.abort();
    const w = { ranged: c };
    return Zn(), pe.set(r, w), w;
  }
  (S = (p = n.signal) == null ? void 0 : p.addEventListener) == null || S.call(p, "abort", a, { once: !0 });
  let i;
  try {
    i = await s.arrayBuffer();
  } finally {
    (R = (b = n.signal) == null ? void 0 : b.removeEventListener) == null || R.call(b, "abort", a);
  }
  const l = { data: new Uint8Array(i) };
  return pe.has(r) ? nn(r, l) : (Zn(), pe.set(r, l)), l;
}
function ja(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < xa ? null : {
    url: e,
    length: o,
    async fetchRange(c, i) {
      const l = await n(e, { headers: { Range: `bytes=${c}-${i - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const Ba = { file: null, loading: !1, error: "" }, Ua = { file: null, loading: !0, error: "" };
function Ha(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = L(null);
  if (x(() => {
    if (t || !n) return;
    const s = pe.get(n);
    if (s) {
      nn(n, s);
      return;
    }
    const c = new AbortController();
    return Br(n, void 0, { signal: c.signal }).then((i) => {
      c.signal.aborted || o({ url: n, file: i, loading: !1, error: "" });
    }).catch((i) => {
      c.signal.aborted || o({ url: n, file: null, loading: !1, error: (i == null ? void 0 : i.message) || String(i) });
    }), () => c.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Ba;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = pe.get(n);
  return a ? { file: a, loading: !1, error: "" } : Ua;
}
function Wa(e) {
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
async function rn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  Lt(s, r, n, "download");
  const c = await Br(t, mt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (Lt(s, o, n, "download"), c);
}
async function Va(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  Lt(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, c = null;
  return t && a.push(
    rn({
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
    rn({
      url: n,
      label: "正在下载译文 PDF…",
      percentStart: 55,
      percentEnd: 85,
      fence: r,
      setBoot: o
    }).then((u) => {
      c = u;
    })
  ), await Promise.all(a), r.isInactive() ? { status: "inactive" } : !!t && !s || !!n && !c ? { status: "incomplete" } : { status: "downloaded", sourceBytes: s, translatedBytes: c };
}
function Ja(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function qa({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = Jo,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(Ja(o.href, t, a)), !0);
}
const It = {
  regions: null,
  metadata: null
};
function Ga(e) {
  const {
    sessionJobId: t,
    jobId: n,
    routeDocumentId: r,
    documentJobId: o,
    rejectedDocumentJobId: a,
    sourceOnly: s,
    locationKey: c,
    sessionIdentity: i,
    committedSource: l,
    applyIdentityEvent: u,
    publishPayload: d,
    clearPayload: f,
    switchSessionMode: h,
    jobRefreshRevision: g,
    sessionEpochRef: p,
    closingRef: S,
    activeLoadAbortRef: b
  } = e, [R, w] = L(""), [m, y] = L(""), [M, _] = L(null), [O, C] = L(null), [D, I] = L(!1), [P, T] = L(""), [E, j] = L([]), [V, z] = L(!1), [q, re] = L(() => ({
    source: null,
    translated: null
  })), [Z, ne] = L(
    It
  ), [ie, Q] = L({
    loading: !0,
    percent: 4,
    text: Me.boot,
    stage: "progress",
    failed: !1
  });
  return x(() => {
    const B = new AbortController(), se = p.current.value, G = Wa({
      sessionEpochRef: p,
      closingRef: S,
      abort: B,
      sessionEpoch: se
    });
    b.current = B;
    const N = $t();
    if (S.current)
      return B.abort(), () => {
        b.current === B && (b.current = null);
      };
    let oe = !1;
    function ae(te, de) {
      G.markFailed(), z(!0), Q({
        loading: !1,
        percent: 100,
        text: te,
        stage: "failed",
        failed: !0
      }), en({ percent: 100, text: de, stage: "failed" });
    }
    function Te() {
      I(!0), oe || z(!0), Q({
        loading: !1,
        percent: 100,
        text: Me.ready,
        stage: "ready",
        failed: !1
      }), en({ percent: 100, text: Me.ready, stage: "ready" });
    }
    function Se() {
      return l != null && l.documentId ? Gn(
        l.documentId,
        l.revision
      ) : la() ? ua : N.resolveResourceUrl(Xt(r));
    }
    async function we() {
      var fe;
      let te = { activeJobId: "", activeVersionId: "" };
      try {
        const le = await ((fe = N.fetchDocument) == null ? void 0 : fe.call(N, r));
        le && (te = _a(le));
      } catch {
      }
      const de = Na({
        link: te,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (de.kind === "follow-active-job") {
        if (G.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: de.jobId
        }), de.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: de.activeVersionId,
          sessionIdentity: i
        }), h("source")) : h("compare");
        return;
      }
      if (de.kind === "open-committed-source") {
        if (G.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: de.revision,
          sessionIdentity: i
        }), h("source");
        return;
      }
      const be = Se();
      if (G.isInactive()) return;
      w(be), y(""), T(""), f(i);
      const ce = await rn({
        url: be,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: G,
        setBoot: Q
      });
      if (!G.isInactive()) {
        if (!ce) {
          ae("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        _(ce), Te();
      }
    }
    async function ge() {
      var W;
      const te = !l, de = !!(te && N.loadSessionSnapshot && N.loadReaderOptionalArtifacts), be = de ? N.loadReaderOptionalArtifacts(t) : null, ce = await ((W = N.loadSessionSnapshot) == null ? void 0 : W.call(N, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: te && !de
      })), fe = ce ? {
        jobPayload: ce.sourcePayload,
        manifestPayload: ce.manifestPayload,
        readerMetadata: ce.readerMetadata,
        regionsPayload: ce.regions,
        readerErrors: ce.readerErrors
      } : await N.loadReaderPayload(t, {
        includeOptionalArtifacts: te
      });
      if (G.isInactive()) return;
      let le = null;
      if (n && !r)
        if (ce && ce.linkedDocument !== void 0)
          le = ce.linkedDocument;
        else {
          try {
            le = await N.fetchDocumentByJobId(Jn, t);
          } catch {
          }
          if (G.isInactive()) return;
        }
      const Ge = Ia(fe.jobPayload) || `${(le == null ? void 0 : le.document_id) || ""}`.trim();
      Ge && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Ge
      });
      const Ke = La({
        payloadDocumentId: Ge,
        linkedActiveJobId: `${(le == null ? void 0 : le.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(le == null ? void 0 : le.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (Ke.kind === "restore-committed-source") {
        if (G.isInactive()) return;
        u({
          type: "committed-source",
          documentId: Ke.documentId,
          revision: Ke.revision,
          sessionIdentity: i
        }), h("source");
        return;
      }
      const st = N.resolveReaderSourcePdf(fe.manifestPayload), Ut = N.resolveReaderTranslatedPdfUrl(fe.jobPayload, fe.manifestPayload), Ht = typeof st == "string" ? st : N.resolveReaderArtifactUrl(st), Le = r || Ge, Ce = l != null && l.documentId ? Gn(
        l.documentId,
        l.revision
      ) : Ht || (Le ? N.resolveResourceUrl(Xt(Le)) : ""), Fe = l ? "" : Ut || "";
      w(Ce || ""), y(Fe), T(Ea(fe.jobPayload, t)), d({
        jobPayload: fe.jobPayload || null,
        manifestPayload: fe.manifestPayload || null,
        sessionIdentity: i
      });
      const wt = () => Va({
        sourceFinal: Ce || "",
        translatedFinal: Fe,
        fence: G,
        setBoot: Q
      }), Rt = !!(Ce || Fe), Ze = be && Rt ? wt() : null;
      Ze == null || Ze.catch(() => {
      });
      const Pt = (H) => {
        G.isInactive() || (j(l ? [] : jo(H.regionsPayload)), re(l ? { source: null, translated: null } : Bo(H.readerMetadata)), ne(l ? It : H.readerErrors ?? It), z(!0));
      };
      if (be ? (oe = !0, be.then(Pt)) : Pt(fe), !Rt) {
        ae(Me.failed, Me.failed);
        return;
      }
      const A = await (Ze ?? wt());
      if (A.status !== "inactive") {
        if (A.status === "incomplete") {
          ae("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        _(A.sourceBytes), C(A.translatedBytes), Te();
      }
    }
    async function Ee() {
      I(!1), _(null), C(null), j([]), z(!1), re({ source: null, translated: null }), ne(It), Lt(Q, 8, Me.metadata, "metadata");
      try {
        if (s) {
          await we();
          return;
        }
        if (!t) {
          ae(Me.failed, Me.failed);
          return;
        }
        await ge();
      } catch (te) {
        if (G.isClosedOrStale() || (te == null ? void 0 : te.name) === "AbortError") return;
        G.markFailed();
        const de = Number(te == null ? void 0 : te.status), be = `${(te == null ? void 0 : te.reason) || ""}`, ce = za({ status: de, reason: be, sessionJobId: t });
        if (ce && (await qa({
          apiPrefix: Jn,
          documentId: ce,
          expiredJobId: t
        }) || G.isClosedOrStale()))
          return;
        if (Ca({
          status: de,
          reason: be,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), h("source");
          return;
        }
        const fe = te instanceof Error ? te.message : Me.failed;
        ae(fe, fe);
      }
    }
    return Ee(), () => {
      B.abort(), b.current === B && (b.current = null);
    };
  }, [t, r, o, a, s, c, l, g, n, i, u, d, f, h]), {
    sourceUrl: R,
    translatedUrl: m,
    sourceFile: M,
    translatedFile: O,
    assetsReady: D,
    title: P,
    regions: E,
    regionsSettled: V,
    readerMetadata: q,
    readerErrors: Z,
    boot: ie
  };
}
function Ka() {
  const e = k(!1), t = k(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = Ra(), s = k({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const c = k(a), i = k(""), l = k(""), u = k(() => {
  }), d = $(() => u.current(), []), f = Pa({
    routeDocumentId: o,
    jobId: r,
    sessionIdentity: a,
    sessionIdentityRef: c,
    documentIdRef: i,
    sessionJobIdRef: l,
    switchToSourceMode: d
  }), {
    sessionJobId: h,
    documentId: g,
    sourceOnly: p,
    sourceViewOnly: S
  } = f, { mode: b, setMode: R, switchSessionMode: w } = Aa(S);
  u.current = () => {
    w("source");
  }, c.current = a, i.current = g, l.current = h;
  const m = Ma({
    sessionJobId: h,
    sessionIdentity: a,
    sessionIdentityRef: c,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: y,
    scopedManifestPayload: M,
    jobStatus: _,
    jobTerminal: O,
    jobRefreshRevision: C,
    refreshJobArtifacts: D,
    refreshJobStatus: I
  } = m, P = Ga({
    sessionJobId: h,
    jobId: r,
    routeDocumentId: o,
    documentJobId: f.documentJobId,
    rejectedDocumentJobId: f.rejectedDocumentJobId,
    sourceOnly: p,
    locationKey: n,
    sessionIdentity: a,
    committedSource: f.activeCommittedDocumentSource,
    applyIdentityEvent: f.applyIdentityEvent,
    publishPayload: m.publishPayload,
    clearPayload: m.clearPayload,
    switchSessionMode: w,
    jobRefreshRevision: C,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), T = $(() => {
    var j;
    e.current = !0, (j = t.current) == null || j.abort();
  }, []), E = K(
    () => ({
      fetchProtected: $t().fetchProtected,
      jobId: h,
      jobPayload: y,
      manifestPayload: M,
      sourceUrl: P.sourceUrl,
      translatedUrl: P.translatedUrl,
      sourceOnly: S
    }),
    [h, y, M, P.sourceUrl, P.translatedUrl, S]
  );
  return {
    jobId: h,
    jobStatus: _,
    workflow: `${(y == null ? void 0 : y.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: O,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: p,
    mode: b,
    setMode: R,
    sourceUrl: P.sourceUrl,
    translatedUrl: P.translatedUrl,
    sourceFile: P.sourceFile,
    translatedFile: P.translatedFile,
    assetsReady: P.assetsReady,
    boot: P.boot,
    title: P.title,
    regions: P.regions,
    regionsSettled: P.regionsSettled,
    readerMetadata: P.readerMetadata,
    readerErrors: P.readerErrors,
    download: E,
    refreshJobArtifacts: D,
    refreshJobStatus: I,
    refreshCommittedDocument: f.refreshCommittedDocument,
    prepareClose: T
  };
}
const Za = 160, Ya = 8, Xa = 0;
function Qa() {
  const e = k(null), [t, n] = L(null), [r, o] = L(Xa), a = $((s) => {
    e.current = s, n(s);
  }, []);
  return x(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const c = (l) => {
      !Number.isFinite(l) || l < Za || o((u) => Math.abs(u - l) < Ya ? u : l);
    }, i = new ResizeObserver((l) => {
      var u, d;
      c(((d = (u = l[0]) == null ? void 0 : u.contentRect) == null ? void 0 : d.width) ?? s.clientWidth);
    });
    return i.observe(s), c(s.clientWidth), () => i.disconnect();
  }, [t]), {
    shellRef: e,
    shellEl: t,
    shellWidth: r,
    bindShell: a
  };
}
function es(e) {
  const { mode: t, sourceOnly: n, assetsReady: r, hasSource: o, hasTranslated: a } = e, s = r && o, c = r && a && !n, i = t === "source" || t === "compare", l = !n && (t === "translated" || t === "compare");
  return {
    mountSource: s,
    mountTranslated: c,
    showSource: i,
    showTranslated: l,
    compareMode: t === "compare" && i && l && s && c,
    primaryPane: t === "translated" ? "translated" : "source"
  };
}
const Vt = { source: 0, translated: 0 };
function ts(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    sourceUrl: a,
    translatedUrl: s,
    sourceFile: c,
    translatedFile: i
  } = e, l = `${(t == null ? void 0 : t.identityKey) || ""}\0${a}\0${s}`, u = k(l);
  u.current = l;
  const [d, f] = L(() => ({
    identity: l,
    pages: Vt
  })), [h, g] = L(() => ({ identity: l, tick: 0 })), p = d.identity === l ? d.pages : Vt, S = h.identity === l ? h.tick : 0, b = es({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!c || !!a,
    hasTranslated: !!i
  }), { primaryPane: R } = b, w = $((I, P) => {
    u.current === l && f((T) => {
      const E = T.identity === l ? T.pages : Vt;
      return E[P] === I && T.identity === l ? T : {
        identity: l,
        pages: { ...E, [P]: I }
      };
    });
  }, [l]), m = k(null), y = $(() => {
    m.current && clearTimeout(m.current);
    const I = l;
    m.current = setTimeout(() => {
      m.current = null, u.current === I && g((P) => ({
        identity: I,
        tick: P.identity === I ? P.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  x(() => (m.current && (clearTimeout(m.current), m.current = null), f((I) => I.identity === l && I.pages.source === 0 && I.pages.translated === 0 ? I : { identity: l, pages: { source: 0, translated: 0 } }), g((I) => I.identity === l && I.tick === 0 ? I : { identity: l, tick: 0 }), () => {
    m.current && (clearTimeout(m.current), m.current = null);
  }), [l]);
  const M = K(
    () => Math.max(p.source, p.translated),
    [p]
  ), _ = R === "translated" ? p.translated : p.source || p.translated, O = t == null ? void 0 : t.userZoom, C = t == null ? void 0 : t.shellWidth, D = `${l}-${S}-${O}-${n}-${p.source}-${p.translated}-${C}`;
  return {
    ...b,
    numPagesByPane: p,
    hudNumPages: M,
    primaryNumPages: _,
    metricsTick: S,
    onNumPages: w,
    onMetrics: y,
    rowSyncRevision: D
  };
}
const Ue = "data-reader-page", rt = "data-reader-pane", wn = "data-natural-height", ns = "reader-react-root", rs = "reader-react-grid", os = "reader-react-scroll-shell", as = "reader-react-pdf-pane", Ur = "reader-react-pdf-page", Ct = "reader-react-pdf-page-placeholder", Rn = "reader-react-pdf-page-slot";
function Dt(e, t) {
  const n = e != null ? `[${Ue}="${e}"]` : `[${Ue}]`;
  return t ? `${n}[${rt}="${t}"]` : n;
}
function ss() {
  return `.${Rn}[${Ue}]`;
}
function zt(e) {
  return Number(e.getAttribute(Ue));
}
const Hr = 0.25, xt = 1, is = 0.05, St = 0.5, cs = 16, ls = 8, us = 720;
function Be() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function Wr(e) {
  return Number.isFinite(e) && e < us;
}
function Qe(e, t = Number.POSITIVE_INFINITY) {
  return Wr(t) && (e === "source" || e === "translated") ? xt : St;
}
function jt(e) {
  return Number.isFinite(e) ? Math.min(xt, Math.max(Hr, e)) : St;
}
function ht(e, t) {
  const n = jt(Number(e) + t * is);
  return Math.round(n * 100) / 100;
}
function ds(e) {
  return Math.round(jt(e) * 100);
}
function fs(e) {
  const n = (Number(e) || 0) - cs - ls;
  return Math.max(160, Math.floor(n));
}
function ms(e, t = St) {
  const n = jt(t);
  return fs((Number(e) || 0) * n);
}
function hs(e, t) {
  if (!e || !Number.isFinite(t) || t <= 0 || Math.abs(t - 1) < 1e-3)
    return;
  const n = e.scrollLeft + e.clientWidth / 2, r = e.scrollTop + e.clientHeight / 2, o = Array.from(
    e.querySelectorAll(`[${rt}]`)
  ).map((s) => ({
    pane: s,
    cx: s.scrollLeft + s.clientWidth / 2,
    hadOverflow: s.scrollWidth > s.clientWidth + 1
  })), a = () => {
    e.scrollLeft = Math.max(0, n * t - e.clientWidth / 2), e.scrollTop = Math.max(0, r * t - e.clientHeight / 2);
    for (const { pane: s, cx: c, hadOverflow: i } of o) {
      const l = Math.max(0, s.scrollWidth - s.clientWidth);
      if (l <= 0) {
        s.scrollLeft = 0;
        continue;
      }
      i ? s.scrollLeft = Math.min(
        l,
        Math.max(0, c * t - s.clientWidth / 2)
      ) : s.scrollLeft = l / 2;
    }
  };
  requestAnimationFrame(() => {
    requestAnimationFrame(a);
  });
}
const ps = 8;
function gs(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < ps ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const Vr = 200, Jr = [
  "markdown"
], bs = Jr;
function qr(e) {
  return bs.includes(e);
}
const ys = "retainpdf:reader:view:v1:", Yn = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), vs = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function Gr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function on(e) {
  return `${e || ""}`.trim();
}
function Ss({
  documentId: e,
  jobId: t
}) {
  const n = on(e);
  if (n) return `document:${n}`;
  const r = on(t);
  return r ? `job:${r}` : "";
}
function Kr(e) {
  const t = on(e);
  return t ? `${ys}${t}` : "";
}
function ws(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function Rs(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!Yn.has(t) || !Yn.has(n) || t === n))
    return { left: t, right: n };
}
function Ps(e) {
  return e === null ? null : qr(e) ? e : void 0;
}
function Is(e) {
  return vs.has(e) ? e : void 0;
}
function Zr(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = ws(t.anchor), r = Number(t.zoom), o = Is(t.mode), a = Rs(t.splitLayout), s = Ps(t.assistantPanel);
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
function Ie(e, t = Gr()) {
  const n = Kr(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? Zr(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function Bt(e, t, n = Gr()) {
  const r = Kr(e);
  if (!r || !n) return null;
  const o = Ie(e, n), a = Zr({
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
function Ts(e, t, n = "") {
  var f;
  const [r, o] = L(() => {
    var h;
    return ((h = Ie(n)) == null ? void 0 : h.zoom) ?? Qe(e, Be());
  }), a = k(r), s = k(n);
  a.current = r;
  const c = k(1), i = k(((f = Ie(n)) == null ? void 0 : f.zoom) !== void 0);
  x(() => {
    var p;
    if (s.current === n) return;
    s.current = n;
    const h = (p = Ie(n)) == null ? void 0 : p.zoom;
    i.current = h !== void 0;
    const g = h ?? Qe(e, Be());
    c.current = 1, a.current = g, o(g);
  }, [e, n]), x(() => {
    if (i.current) return;
    const h = Qe(e, Be()), g = a.current;
    Math.abs(h - g) < 5e-4 || (c.current = 1, a.current = h, o(h));
  }, [e]);
  const l = $((h) => {
    const g = jt(h), p = a.current;
    Math.abs(g - p) < 5e-4 || (c.current = g / (p || 1), i.current = !0, Bt(s.current, { zoom: g }), o(g));
  }, []), u = $((h) => {
    l(ht(a.current, h));
  }, [l]), d = $((h) => {
    l(Qe(h));
  }, [l]);
  return Ne(() => {
    const h = c.current;
    Math.abs(h - 1) < 1e-3 || (c.current = 1, hs(t == null ? void 0 : t.current, h));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: d };
}
function Es(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = k(t), a = k(n), s = k(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: $((i) => {
    i !== o.current && (s.current(), a.current(i));
  }, []) };
}
const Pn = 48;
function Yr(e, t = Pn) {
  return e.getBoundingClientRect().top + t;
}
function Xr(e, t) {
  if (!e.length)
    return null;
  let n = null, r = -1 / 0;
  for (const i of e) {
    const l = i.getBoundingClientRect();
    l.height < 8 || l.width < 8 || l.top <= t + 1 && l.top >= r && (n = i, r = l.top);
  }
  if (!n && (n = e.find((l) => {
    const u = l.getBoundingClientRect();
    return u.height >= 8 && u.width >= 8;
  }) ?? null, n)) {
    const l = [...e].reverse().find((u) => {
      const d = u.getBoundingClientRect();
      return d.height >= 8 && d.width >= 8;
    });
    l && l.getBoundingClientRect().bottom < t && (n = l);
  }
  if (!n)
    return null;
  const o = zt(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, c = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: c };
}
function At(e, t, n = Pn) {
  if (!e)
    return null;
  const r = Dt(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = Yr(e, n), c = Xr(o, s);
  return c ? { page: c.page, fraction: c.fraction } : null;
}
function pt(e, t, n = "auto", r, o = Pn) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let c = null;
  if (r && (c = e.querySelector(Dt(a, r))), c || (c = e.querySelector(Dt(a))), !c)
    return !1;
  const i = e.getBoundingClientRect(), l = c.getBoundingClientRect();
  if (i.height <= 0 || l.height < 8 && c.offsetHeight < 8)
    return !1;
  const u = l.height > 0 ? l.height : c.offsetHeight, d = e.scrollTop + (l.top - i.top), f = Math.max(0, d + s * u - o);
  return n === "auto" ? Math.abs(e.scrollTop - f) >= 1 && (e.scrollTop = f) : e.scrollTo({ top: f, behavior: n }), !0;
}
function Ms(e, t, n = "smooth", r) {
  return pt(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function an(e, t, n) {
  const r = (n == null ? void 0 : n.behavior) ?? "auto", o = (n == null ? void 0 : n.delaysMs) ?? [0, 32, 120, 280];
  let a = !1, s = !1;
  const c = [], i = () => {
    var u;
    if (a) return;
    pt(
      e(),
      t,
      r,
      n == null ? void 0 : n.pane
    ) && !s && (s = !0, (u = n == null ? void 0 : n.onDone) == null || u.call(n));
  };
  for (const l of o)
    l <= 0 ? requestAnimationFrame(() => {
      requestAnimationFrame(i);
    }) : c.push(setTimeout(i, l));
  return () => {
    a = !0;
    for (const l of c)
      clearTimeout(l);
  };
}
function ks(e, t, n) {
  return an(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function Ot(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function ye(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function As(e, t, n = !0, r = "", o) {
  const [a, s] = L(1);
  return x(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const c = e.current;
    if (!c)
      return;
    let i = !1, l = null, u = 0;
    const d = Dt(void 0, o), f = () => {
      if (i) return;
      const p = Array.from(c.querySelectorAll(d));
      if (!p.length)
        return;
      const S = Yr(c), b = Xr(p, S);
      b && s(b.page);
    }, h = () => {
      i || (u && cancelAnimationFrame(u), u = requestAnimationFrame(() => {
        u = 0, f();
      }));
    }, g = () => {
      if (i) return;
      if (!Array.from(c.querySelectorAll(d)).length) {
        l = setTimeout(g, 120);
        return;
      }
      f(), c.addEventListener("scroll", h, { passive: !0 });
    };
    return g(), () => {
      i = !0, l && clearTimeout(l), u && cancelAnimationFrame(u), c.removeEventListener("scroll", h);
    };
  }, [e, t, n, r, o]), a;
}
const _s = `canvas, .react-pdf__Page, .${Ur}, .${Ct}`, Xn = /* @__PURE__ */ new WeakMap();
function Ns(e) {
  const t = Number(e.getAttribute(wn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Xn.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(_s), Xn.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Ls(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Cs(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(ss()).forEach((r) => {
    const o = zt(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = Ns(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Ds(e, t, n = "", r) {
  const [o, a] = L(() => /* @__PURE__ */ new Map()), s = k(o), c = k(r);
  return c.current = r, Ne(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let i = !1, l = 0, u = !1, d = !1;
    const f = () => {
      var y;
      if (i) return;
      const w = e.current;
      if (!w) return;
      const m = Cs(w);
      Ls(s.current, m) || (s.current = m, a(m)), u && !d && (d = !0, (y = c.current) == null || y.call(c));
    }, h = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(f);
      });
    };
    h();
    const g = window.setTimeout(h, 100), p = window.setTimeout(() => {
      u = !0, h();
    }, 300), S = window.setTimeout(h, 700), b = e.current;
    let R = null;
    return b && typeof ResizeObserver < "u" && (R = new ResizeObserver(() => h()), R.observe(b)), () => {
      i = !0, cancelAnimationFrame(l), window.clearTimeout(g), window.clearTimeout(p), window.clearTimeout(S), R == null || R.disconnect();
    };
  }, [e, t, n]), o;
}
const zs = [0, 48, 140, 320, 560], xs = 700, Os = [80, 200, 400], Fs = 500, $s = 50, js = /* @__PURE__ */ new Set([
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
]), Bs = 180, Qn = [0, 48, 140, 320, 700, 1200];
function Us(e, t) {
  var P;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, c = k(
    ((P = Ie(a)) == null ? void 0 : P.anchor) || { page: 1, fraction: 0 }
  ), i = k(null), l = k(!1), u = k(r), d = k(null), f = k(null), h = k(null), g = k(null), p = k(a), S = k(""), b = k(n);
  b.current = n;
  const R = $(() => {
    var T;
    (T = d.current) == null || T.call(d), d.current = null, f.current != null && (clearTimeout(f.current), f.current = null);
  }, []), w = $(() => {
    !l.current && i.current == null || (R(), h.current != null && (clearTimeout(h.current), h.current = null), i.current = null, l.current = !1);
  }, [R]), m = $((T = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const E = () => {
      g.current = null, Bt(p.current, {
        anchor: ye(c.current)
      });
    };
    T ? E() : g.current = setTimeout(E, Bs);
  }, []), y = $((T) => {
    c.current = ye(T), i.current = null, h.current != null && clearTimeout(h.current), h.current = setTimeout(() => {
      h.current = null, l.current = !1;
    }, $s);
  }, []);
  x(() => {
    if (!o)
      return;
    let T = !1, E = null, j = null, V = null;
    const z = () => {
      if (T) return;
      const q = e.current;
      if (!q) {
        V = setTimeout(z, 50);
        return;
      }
      E = q, j = () => {
        if (l.current)
          return;
        const re = At(E, b.current);
        re && (c.current = re, m());
      }, E.addEventListener("scroll", j, { passive: !0 }), l.current || j();
    };
    return z(), () => {
      T = !0, V != null && clearTimeout(V), E && j && E.removeEventListener("scroll", j);
    };
  }, [o, r, n, e, m]), x(() => {
    if (!o) return;
    const T = e.current;
    if (!T) return;
    const E = (j) => {
      j.metaKey || j.ctrlKey || j.altKey || js.has(j.key) && w();
    };
    return T.addEventListener("wheel", w, { passive: !0 }), T.addEventListener("touchmove", w, { passive: !0 }), window.addEventListener("keydown", E), () => {
      T.removeEventListener("wheel", w), T.removeEventListener("touchmove", w), window.removeEventListener("keydown", E);
    };
  }, [o, e, w]), Ne(() => {
    var E;
    if (p.current === a) return;
    m(!0), R(), h.current != null && (clearTimeout(h.current), h.current = null), p.current = a, S.current = "";
    const T = (E = Ie(a)) == null ? void 0 : E.anchor;
    c.current = T ? ye(T) : { page: 1, fraction: 0 }, i.current = null, l.current = !!a, u.current = r;
  }, [a, r, m, R]), x(() => {
    var E;
    if (!o || !s || !a || S.current === a) return;
    S.current = a;
    const T = ye(
      ((E = Ie(a)) == null ? void 0 : E.anchor) || { page: 1, fraction: 0 }
    );
    return c.current = T, i.current = T, l.current = !0, R(), d.current = an(
      () => e.current,
      T,
      {
        behavior: "auto",
        pane: b.current,
        delaysMs: Qn,
        onDone: () => y(T)
      }
    ), f.current = setTimeout(() => {
      f.current = null, y(T);
    }, Math.max(...Qn) + 160), () => R();
  }, [o, s, a, e, y, R]), x(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, i.current = null, R();
      return;
    }
    const T = i.current ? ye(i.current) : ye(c.current);
    return l.current = !0, i.current = T, c.current = T, R(), d.current = an(
      () => e.current,
      T,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: zs,
        onDone: () => y(T)
      }
    ), f.current = setTimeout(() => {
      f.current = null, y(T);
    }, xs), () => {
      R();
    };
  }, [r, o, n, e, y, R]), x(() => () => {
    R(), h.current != null && (clearTimeout(h.current), h.current = null), m(!0);
  }, [R, m]);
  const M = $(() => {
    const T = At(
      e.current,
      b.current
    );
    return ye(T || c.current);
  }, [e]), _ = $(() => {
    l.current = !0;
    const T = At(
      e.current,
      b.current
    ), E = ye(T ?? c.current);
    return c.current = E, i.current = E, m(), E;
  }, [e, m]), O = $((T, E, j) => {
    const V = j || b.current, z = Ot(T, E || 1), q = { page: z, fraction: 0 };
    c.current = q, l.current = !0, i.current = q, m(), R(), Ms(e.current, z, "smooth", V), d.current = ks(
      () => e.current,
      z,
      {
        behavior: "auto",
        pane: V,
        delaysMs: Os,
        onDone: () => y(q)
      }
    ), f.current = setTimeout(() => {
      f.current = null, y(q);
    }, Fs);
  }, [e, y, R, m]), C = $(() => ye(c.current), []), D = $(() => l.current, []), I = $(() => {
    if (!l.current || !i.current)
      return;
    const T = ye(i.current);
    pt(
      e.current,
      T,
      "auto",
      b.current
    );
  }, [e]);
  return {
    lockFromShell: M,
    beginModeSwitch: _,
    goToPage: O,
    getAnchor: C,
    isRestoring: D,
    repinIfRestoring: I
  };
}
function Hs(e, t) {
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
function Qr(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const Ws = [0, 80, 200, 400, 800], Vs = 120, Js = 400;
function qs(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: c, jobId: i, documentId: l, regionsSettled: u = !0 } = e, d = k(a);
  d.current = a;
  const f = k(s);
  f.current = s;
  const h = k(c);
  h.current = c;
  const g = k(n);
  g.current = n, x(() => {
    var m, y;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const p = ha(), S = Hs(p, f.current);
    if (S == null && (p != null && p.blockId) && !u) return;
    const b = Qr(p, S, { jobId: i, documentId: l });
    if (t.current === b)
      return;
    if (S == null) {
      t.current = b, (m = g.current) == null || m.call(g);
      return;
    }
    t.current = b, p && ((y = h.current) == null || y.call(h, p, S));
    const R = [];
    let w = 0;
    for (const M of Ws)
      w = Math.max(w, M), R.push(
        setTimeout(() => {
          d.current(S);
        }, M)
      );
    return R.push(
      setTimeout(() => {
        var M;
        (M = g.current) == null || M.call(g);
      }, w + Vs)
    ), () => {
      for (const M of R) clearTimeout(M);
    };
  }, [r, o, i, l, t, u]);
}
function Gs(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function Ks(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = Js,
    jobId: c,
    documentId: i,
    applyReaderSearch: l
  } = e, u = k(a);
  u.current = a;
  const d = k(l);
  d.current = l;
  const f = k(0);
  x(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || f.current === o) return;
    const h = setTimeout(() => {
      var b;
      const g = ((b = globalThis.location) == null ? void 0 : b.search) || "", p = $o(g, o, u.current);
      if (f.current = o, p === null) return;
      const S = `${new URLSearchParams(p).get("block_id") || ""}`.trim();
      t.current = Qr(
        { blockId: S },
        o,
        { jobId: c, documentId: i }
      ), (d.current || Gs)(p);
    }, s);
    return () => clearTimeout(h);
  }, [
    n,
    r,
    o,
    s,
    c,
    i,
    t
  ]);
}
function Zs(e) {
  const t = k(""), [n, r] = L(!1), o = $(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  qs(a, t, o), Ks(e, t, n);
}
const ct = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function Ys(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function er(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function eo(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = er(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = er(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function Xs(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = eo(r, t, n);
  if (o === "retry") return e;
  if (o === "ignore")
    return { ...e, lastSeq: t.seq, connection: "live", error: "" };
  const a = new Map(n.items.map((i) => [i.item_id, i])), s = new Map((r == null ? void 0 : r.changedAtSeqById) || []);
  for (const i of t.changed_item_ids)
    a.has(i) && s.set(i, t.seq);
  const c = new Map(e.pagesByPage);
  return c.set(t.page_idx, {
    attempt: n.attempt,
    generation: n.generation,
    pageHash: n.page_hash,
    itemsById: a,
    changedAtSeqById: s,
    lastEventSeq: t.seq
  }), {
    ...e,
    pagesByPage: c,
    lastSeq: t.seq,
    connection: "live",
    error: ""
  };
}
function Qs(e) {
  const { hasOverlayContent: t, connection: n, showSource: r } = e;
  return {
    topBarPill: t && n !== "terminal",
    sourcePaneToggle: t && r,
    // 和 resolveReaderPaneComposition 的 overlayOnSource 同一套条件，外加
    // 「源文栏得在台面上」——否则叠层没有落脚的地方。
    overlayRenderable: t && r && e.liveTranslationVisible && !e.assistantOpen
  };
}
const tr = [250, 500, 1e3, 2e3, 4e3], Jt = [80, 160, 320, 640, 1e3, 1500], nr = [250, 500, 1e3, 2e3, 4e3, 5e3];
function sn(e, t) {
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
function In(e) {
  return qo(e) ? `${e.code || ""}`.trim() : "";
}
function Tt(e, t) {
  const n = In(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function ei(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const i = await o.fetchPage(e, t.page_idx, { signal: r });
      if (eo(n.pagesByPage.get(t.page_idx), t, i) !== "retry")
        return i;
      a = Go(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (i) {
      if ((i == null ? void 0 : i.name) === "AbortError") throw i;
      a = i;
      const l = In(i);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw i;
    }
    const c = Jt[Math.min(s, Jt.length - 1)];
    if (await sn(c, r), s >= Jt.length + 2) throw a;
  }
}
function ti({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = L(ct), s = k(o), c = k("");
  s.current = o;
  const i = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = yn(l) ? l : "";
  return x(() => {
    if (!n || !i) {
      c.current = "", s.current = ct, a(ct);
      return;
    }
    const d = r === void 0 ? ma() : r, f = c.current === i;
    if (c.current = i, !d) {
      const w = {
        ...f ? s.current : ct,
        connection: u ? "terminal" : "unavailable",
        jobStatus: l,
        error: "实时译文暂不可用"
      };
      s.current = w, a(w);
      return;
    }
    const h = new AbortController();
    let g = !1;
    const p = {
      ...f ? s.current : ct,
      connection: u ? "terminal" : "connecting",
      jobStatus: l,
      error: ""
    };
    s.current = p, a(p);
    const S = (w) => {
      h.signal.aborted || a((m) => {
        const y = w(m);
        return s.current = y, y;
      });
    }, b = async () => {
      let w = 0;
      for (; !h.signal.aborted; )
        try {
          const m = await d.fetchLayout(i, { signal: h.signal });
          g = !0, S((y) => ({
            ...y,
            layoutByPage: Ys(m),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (m) {
          if ((m == null ? void 0 : m.name) === "AbortError") return;
          const y = In(m);
          if (!(y === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !y)) {
            S((_) => ({
              ..._,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: Tt(m, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            S((_) => ({
              ..._,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          S((_) => ({
            ..._,
            connection: "connecting",
            jobStatus: l,
            error: Tt(m, "正在等待 OCR 版面数据")
          })), await sn(tr[Math.min(w, tr.length - 1)], h.signal).catch(() => {
          }), w += 1;
        }
    };
    return (async () => {
      if (await b(), !g || h.signal.aborted) return;
      let w = 0;
      for (; !h.signal.aborted; ) {
        u || S((m) => ({
          ...m,
          connection: m.lastSeq > 0 ? "reconnecting" : "connecting",
          jobStatus: l,
          // 保留已有错误：首页还没提交（lastSeq 为 0）时恰恰是最容易出错的阶段，
          // 此前这里把它清成空串，UI 于是一直显示「连接中」，用户看到的是
          // "正在努力"，实际可能已经在反复失败。
          error: m.error
        }));
        try {
          await d.streamEvents(i, {
            afterSeq: s.current.lastSeq,
            signal: h.signal,
            onEvent: async (m) => {
              if (m.seq <= s.current.lastSeq) return;
              let y;
              try {
                y = await ei(
                  i,
                  m,
                  s.current,
                  h.signal,
                  d
                );
              } catch (M) {
                if ((M == null ? void 0 : M.name) === "AbortError" || h.signal.aborted) throw M;
                S((_) => ({
                  ..._,
                  lastSeq: Math.max(_.lastSeq, m.seq),
                  error: Tt(M, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              S((M) => {
                const _ = Xs(M, m, y);
                return u ? {
                  ..._,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ..._,
                  jobStatus: l
                };
              }), w = 0;
            }
          });
        } catch (m) {
          if ((m == null ? void 0 : m.name) === "AbortError" || h.signal.aborted) return;
          S((y) => ({
            ...y,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: l,
            error: Tt(m, "实时译文连接已中断，正在重连")
          }));
        }
        if (h.signal.aborted) return;
        if (u) {
          S((m) => ({
            ...m,
            connection: "terminal",
            jobStatus: l
          }));
          return;
        }
        await sn(nr[Math.min(w, nr.length - 1)], h.signal).catch(() => {
        }), w += 1;
      }
    })(), () => h.abort();
  }, [n, r, i, u]), o;
}
function ni(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, c = `${s.value ?? ""}`.trim(), i = Number(s.count) || 0;
    c && i > 0 && o.set(c, i);
  }
  return o;
}
function ri(e, t = !0) {
  const [n, r] = L(() => /* @__PURE__ */ new Map());
  return x(() => {
    r((c) => c.size ? /* @__PURE__ */ new Map() : c);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = $t().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((c) => {
      !s && c && r(ni(c));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const oi = 4500;
function ai(e) {
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
const si = /* @__PURE__ */ new Set(["book", "translate"]);
function to(e) {
  return !!(e.jobId && e.sourceUrl && si.has(e.workflow));
}
function ii(e) {
  return !!(to(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function ci() {
  const e = Ka(), t = to({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = ii({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = k({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !yn(o) && (r.current.running = !0);
  const a = ti({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: c, shellWidth: i, bindShell: l } = Qa(), u = ri(e.jobId, !e.sourceOnly), d = Ss({
    documentId: e.documentId,
    jobId: e.jobId
  }), f = `${d}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: h, onZoomChange: g } = Ts(e.mode, s, d), p = ts(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: h, shellWidth: i, identityKey: f }
  ), {
    beginModeSwitch: S,
    goToPage: b,
    repinIfRestoring: R
  } = Us(s, {
    primaryPane: p.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: d,
    restoreReady: p.primaryNumPages > 0
  });
  x(() => {
    R();
  }, [i, R]);
  const w = Ds(
    s,
    p.compareMode,
    p.rowSyncRevision,
    R
  ), m = As(
    s,
    p.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${h}-${p.metricsTick}`,
    p.primaryPane
  ), y = $((z, q) => {
    var Z, ne;
    const re = Math.max(
      Number(p.hudNumPages) || 0,
      Number(p.primaryNumPages) || 0,
      Number((Z = p.numPagesByPane) == null ? void 0 : Z.source) || 0,
      Number((ne = p.numPagesByPane) == null ? void 0 : ne.translated) || 0
    );
    b(z, re, q);
  }, [b, p.hudNumPages, p.primaryNumPages, p.numPagesByPane]), [M, _] = L(null), O = k(null), C = $((z) => {
    O.current && clearTimeout(O.current), _(z), z && (O.current = setTimeout(() => _(null), oi));
  }, []);
  x(() => () => {
    O.current && clearTimeout(O.current);
  }, []);
  const D = $((z) => {
    const q = Wt(e.regions, z);
    return q ? Hn(q, p.primaryPane).page : null;
  }, [e.regions, p.primaryPane]), I = $((z, q) => {
    const re = q || p.primaryPane, Z = typeof z == "object" && z ? `${z.block_id || ""}`.trim() : "", ne = typeof z == "object" && z ? `${z.image_url || ""}`.trim() : "", ie = typeof z == "object" && z ? z.page_idx != null ? Number(z.page_idx) + 1 : z.page != null ? Number(z.page) : null : typeof z == "number" ? z + 1 : null, Q = Uo(e.regions, ne, ie) || Wt(e.regions, Z) || (typeof z == "object" ? Ho(e.regions, z) : null);
    let B = Q ? Hn(Q, re).page : null;
    B == null && (B = ai(z)), !(B == null || B < 1) && (C(Q), y(B, re));
  }, [C, y, p.primaryPane, e.regions]);
  Zs({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: p.hudNumPages || 0,
    currentPage: m,
    goToPage: y,
    resolveBlockPage: D,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (z) => {
      C(Wt(e.regions, z.blockId));
    }
  });
  const { setModeKeepingPage: P } = Es({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: S
  });
  x(() => {
    C(null);
  }, [f, C]);
  const T = !e.boot.loading && !e.boot.failed, E = K(() => ({ bindShell: l, shellEl: c, shellWidth: i, shellRef: s }), [l, c, i, s]), j = K(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), V = K(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: h,
    onZoomChange: g,
    shell: E,
    panes: p,
    sessionFiles: j,
    rowHeights: w,
    goToPage: y,
    activeRegion: M,
    jumpToAnchor: I,
    setModeKeepingPage: P,
    download: e.download,
    showHud: T,
    viewStateKey: d,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, E, p, j, w, y, M, I, P, T, h, g, d, a, n, u]);
  return K(() => ({
    ...V,
    currentPage: m
  }), [V, m]);
}
const li = [
  { action: "mode-source", keys: ["1"], mode: "source" },
  { action: "mode-compare", keys: ["2"], mode: "compare" },
  { action: "mode-translated", keys: ["3"], mode: "translated" },
  { action: "zoom-in", keys: ["+", "="] },
  { action: "zoom-out", keys: ["-", "_"] },
  { action: "zoom-reset", keys: ["0"] },
  { action: "next-page", keys: ["j", "ArrowDown", "PageDown"], requiresPages: !0 },
  { action: "prev-page", keys: ["k", "ArrowUp", "PageUp"], requiresPages: !0 },
  { action: "first-page", keys: ["Home"], requiresPages: !0 },
  { action: "last-page", keys: ["End"], requiresPages: !0 }
], ui = [
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
      { actions: [], keys: "点百分比", desc: "重置为模式默认" }
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
    title: "模式",
    items: [
      { actions: ["mode-source"], keys: "1", desc: "原文" },
      { actions: ["mode-compare"], keys: "2", desc: "对照" },
      { actions: ["mode-translated"], keys: "3", desc: "译文" }
    ]
  }
];
function di(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of li)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function fi(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const mi = ".reader-notes-panel";
function hi(e) {
  return e instanceof Element ? !!e.closest(mi) : !1;
}
function pi(e) {
  const {
    mode: t,
    sourceOnly: n,
    setMode: r,
    userZoom: o,
    onZoomChange: a,
    currentPage: s,
    numPages: c,
    goToPage: i,
    enabled: l = !0
  } = e;
  x(() => {
    if (!l)
      return;
    const u = (d) => {
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || fi(d.target) || hi(d.target))
        return;
      const f = d.key, h = di(f);
      if (h) {
        if (h.mode) {
          if (n && h.mode !== "source")
            return;
          d.preventDefault(), r(h.mode);
          return;
        }
        if (!(h.requiresPages && c <= 0))
          switch (d.preventDefault(), h.action) {
            case "zoom-in":
              a(ht(o, 1));
              return;
            case "zoom-out":
              a(ht(o, -1));
              return;
            case "zoom-reset":
              a(Qe(t, Be()));
              return;
            case "next-page":
              i(Ot(s + 1, c));
              return;
            case "prev-page":
              i(Ot(s - 1, c));
              return;
            case "first-page":
              i(1);
              return;
            case "last-page":
              i(c);
              return;
          }
      }
    };
    return window.addEventListener("keydown", u), () => window.removeEventListener("keydown", u);
  }, [
    l,
    t,
    n,
    r,
    o,
    a,
    s,
    c,
    i
  ]);
}
const gi = "retainpdf:soft-reader-close";
function bi() {
  return new URL("./index.html", window.location.href).href;
}
function yi() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: gi },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function vi(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function Si() {
  if (!(typeof window > "u") && !yi()) {
    if (vi(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(bi());
  }
}
function wi({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ v("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function Ri({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ F(wi, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), Si();
  }, children: [
    /* @__PURE__ */ v(Sn, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ v("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
let rr = !1;
function Pi() {
  if (rr)
    return;
  const e = mt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && ($r.GlobalWorkerOptions.workerSrc = e, rr = !0);
}
const Ii = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function Ti(e, t, n) {
  return e.flatMap((r) => {
    if (!Ii.has(zr(r.region))) return [];
    const o = vn(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function or(e, t, n) {
  let r = null, o = Number.POSITIVE_INFINITY;
  for (const a of e) {
    const { rect: s } = a;
    if (t < s.left || t > s.left + s.width || n < s.top || n > s.top + s.height)
      continue;
    const c = s.width * s.height;
    c < o && (r = a, o = c);
  }
  return r;
}
async function Ei(e) {
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
const Mi = "reader-text-hover-copy", ki = "reader-text-hover-id", no = "reader-text-hover-tools";
function ar({
  className: e,
  state: t,
  label: n,
  title: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ v(
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
const ro = 26, oo = 190;
function ao(e, t = oo) {
  return e.height < ro * 2 || e.width < t;
}
function Ai({
  target: e,
  pane: t = "source",
  revisedCount: n = 0
}) {
  const [r, o] = L("idle"), [a, s] = L("idle"), c = k([]), i = (e == null ? void 0 : e.itemId) || "";
  if (x(() => {
    o("idle"), s("idle");
    const g = c.current;
    return () => {
      g.forEach((p) => window.clearTimeout(p)), c.current = [];
    };
  }, [i]), !e) return null;
  const l = Wo(e.highlight.region, t), u = zr(e.highlight.region), d = (g, p) => async (S) => {
    S.preventDefault(), S.stopPropagation();
    const b = await Ei(g);
    p(b ? "copied" : "failed"), c.current.push(window.setTimeout(() => p("idle"), 1200));
  }, f = u === "formula" ? "复制 LaTeX" : "复制", h = ao(e.rect);
  return /* @__PURE__ */ v("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ v(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": u,
      style: e.rect,
      children: /* @__PURE__ */ F(
        "div",
        {
          className: no,
          "data-placement": h ? "outside" : "inside",
          children: [
            /* @__PURE__ */ v(
              ar,
              {
                className: ki,
                state: a,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: d(e.itemId, s),
                children: a === "copied" ? "已复制编号" : e.itemId
              }
            ),
            t === "translated" && n > 0 ? /* @__PURE__ */ F("span", { className: "reader-text-hover-revised", "data-reader-revised-count": n, children: [
              "改过 ",
              n,
              " 次"
            ] }) : null,
            l ? /* @__PURE__ */ v(
              ar,
              {
                className: Mi,
                state: r,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                onClick: d(l, o),
                children: r === "copied" ? "已复制" : r === "failed" ? "复制失败" : f
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function _i(e, t) {
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
function Ni(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const c = vn(
      _i(e, a),
      n,
      r
    );
    c && o.push({
      itemId: a.item_id,
      translatedText: s.translated_text,
      status: s.status,
      kind: a.kind,
      sourceText: a.source_text,
      typography: a.typography,
      rect: c,
      changedAtSeq: t.changedAtSeqById.get(a.item_id) || 0,
      changedNow: t.changedAtSeqById.get(a.item_id) === t.lastEventSeq
    });
  }
  return o;
}
const Li = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Ci = 256, lt = /* @__PURE__ */ new Map();
function Di(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function zi(e) {
  const t = `${e || ""}`, { text: n, slots: r } = sa(t, { bareLatex: !0 }), o = Di(n), a = ia(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = lt.get(t);
  if (!s && (s = ca(o, r), lt.set(t, s), lt.size > Ci)) {
    const c = lt.keys().next().value;
    c !== void 0 && lt.delete(c);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function qt(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Ae(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function xi(e, t) {
  const n = e.typography, r = Ae(t) || 1, o = Ae(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), c = qt(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, i = Math.max(5.5 * r, Math.min(s, c * r)), l = Ae(n == null ? void 0 : n.fit_min_font_size_pt), u = Ae(n == null ? void 0 : n.fit_max_font_size_pt), d = Math.max(3.5, (l || 5.5) * r), f = Math.max(
    d,
    u ? u * r : o ? o * r : i
  ), h = o ? o * r : i, g = Ae(n == null ? void 0 : n.leading_em), p = [
    Ae(n == null ? void 0 : n.padding_top_pt) || 0,
    Ae(n == null ? void 0 : n.padding_right_pt) || 0,
    Ae(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Ae(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((S) => S * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Li,
    fontSizePx: Math.max(d, Math.min(f, h)),
    minFontSizePx: d,
    maxFontSizePx: f,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (qt(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : qt(e.kind) ? "center" : "justify",
    padding: p,
    exact: !!o
  };
}
function Oi(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), c = (d) => {
    const f = s.get(d);
    if (f !== void 0) return f;
    const { width: h, height: g } = e(d), p = h <= t + 0.5 && g <= n + 0.5;
    return s.set(d, p), p;
  };
  let i = o, l = a, u = Math.min(r.requestedFontSizePx, l);
  if (c(u)) {
    if (!r.exact) {
      i = u;
      for (let d = 0; d < 6 && l > i; d += 1) {
        const f = (i + l) / 2;
        c(f) ? (u = f, i = f) : l = f;
      }
    }
  } else {
    l = u, u = i;
    for (let d = 0; d < 8 && l > i; d += 1) {
      const f = (i + l) / 2;
      c(f) ? (u = f, i = f) : l = f;
    }
  }
  return Math.max(o, u);
}
const Fi = 512, ut = /* @__PURE__ */ new Map();
let cn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  cn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  cn += 1;
}));
function $i(e, t, n, r) {
  return [
    cn,
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
function ji({ item: e, pageScale: t }) {
  const n = k(null), r = K(
    () => zi(e.translatedText),
    [e.translatedText]
  ), [o, a] = L(r.fallbackHtml), s = K(
    () => xi(e, t),
    [e, t]
  );
  x(() => {
    let d = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((f) => {
      d && a(f);
    }), () => {
      d = !1;
    };
  }, [r]), Ne(() => {
    const d = n.current;
    if (!d) return;
    const [f, h, g, p] = s.padding, S = Math.max(1, e.rect.width - p - h), b = Math.max(1, e.rect.height - f - g), R = $i(o, S, b, s);
    let w = ut.get(R);
    if (w === void 0 && (w = Oi(
      (m) => (d.style.fontSize = `${m}px`, { width: d.scrollWidth, height: d.scrollHeight }),
      S,
      b,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), ut.set(R, w), ut.size > Fi)) {
      const m = ut.keys().next().value;
      m !== void 0 && ut.delete(m);
    }
    d.style.fontSize = `${w.toFixed(2)}px`;
  }, [o, e.rect.height, e.rect.width, s]);
  const [c, i, l, u] = s.padding;
  return /* @__PURE__ */ v(
    "div",
    {
      className: `reader-live-translation-item${e.changedNow ? " is-changed" : ""}`,
      "data-live-translation-item": e.itemId,
      "data-live-translation-kind": e.kind,
      "data-live-translation-status": e.status,
      "data-live-translation-typography": s.exact ? "typst" : "fitted",
      style: {
        ...e.rect,
        padding: `${c}px ${i}px ${l}px ${u}px`
      },
      children: /* @__PURE__ */ v(
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
function Bi({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = K(
    () => Ni(e, t, n, r),
    [r, e, t, n]
  );
  return o.length ? /* @__PURE__ */ v(
    "div",
    {
      className: "reader-live-translation-overlay",
      "data-live-translation-page": e == null ? void 0 : e.page_idx,
      "data-live-translation-generation": t == null ? void 0 : t.generation,
      "aria-hidden": "true",
      children: o.map((a) => /* @__PURE__ */ v(
        ji,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Ui = hn(Bi), so = pn(null), io = pn(null);
function Hi({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ v(so.Provider, { value: e, children: /* @__PURE__ */ v(io.Provider, { value: t, children: n }) });
}
function Oe() {
  return gn(so);
}
function co() {
  return gn(io);
}
const ze = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Wi = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Vi = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, Ji = {
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
}, sr = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function qi(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => sr(o ?? a ?? "", Wi)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => sr(o ?? a ?? "", Vi)).replace(/\\([a-zA-Z]+)/gu, (r, o) => Ji[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Gi(e) {
  return ze(e.translatedBlockText) || ze(e.translated.text) || ze(e.source.text);
}
const Ki = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Zi(e) {
  const t = [];
  for (const n of e) {
    if (!Ki(n)) continue;
    const r = qi(Gi(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function Yi(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const Xi = 24, Qi = 60;
function ir(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - Xi), o = Math.min(e.length, n + t.length + Qi), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function ec(e, t, n = 200) {
  const r = ze(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const c = ze(a.translatedBlockText) || ze(a.translated.text), i = c ? ir(c, r) : null, l = i ?? ir(ze(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: i ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
function Et(e) {
  return e.replace(/[&<>"']/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]);
}
function tc(e, t) {
  const n = ze(t).toLowerCase();
  if (!n || !e) return Et(e || "");
  const r = e.toLowerCase();
  let o = "", a = 0;
  for (let s = r.indexOf(n); s >= 0; s = r.indexOf(n, s + n.length))
    o += `${Et(e.slice(a, s))}<mark class="reader-find-mark">${Et(e.slice(s, s + n.length))}</mark>`, a = s + n.length;
  return o + Et(e.slice(a));
}
function nc(e, t, n) {
  return t <= 0 ? -1 : e < 0 || e >= t ? n ? t - 1 : 0 : (e + (n ? t - 1 : 1)) % t;
}
const lo = 1.414;
function rc({
  pageNumber: e,
  width: t,
  devicePixelRatio: n,
  pane: r,
  active: o = !1,
  textLayer: a = !0,
  syncedMinHeight: s = 0,
  onMetrics: c,
  cachedAspect: i,
  onAspectChange: l,
  sentinelRef: u,
  regionHighlight: d = null,
  regionTargets: f = [],
  hoveredRegionId: h,
  onHoverRegion: g,
  liveTranslationLayout: p,
  liveTranslationPage: S,
  showLiveTranslation: b = r === "source"
}) {
  const R = Oe(), w = R == null ? void 0 : R.revisedBlocks, m = (R == null ? void 0 : R.findTerm) || "", y = K(
    () => m ? ({ str: N }) => tc(N, m) : void 0,
    [m]
  ), M = k(i ?? lo), [_, O] = L(M.current);
  x(() => {
    i != null && Math.abs(i - M.current) >= 1e-3 && (M.current = i, O(i));
  }, [i]);
  const C = k(u);
  C.current = u;
  const D = k(null), I = k((N) => {
    var oe;
    D.current = N, (oe = C.current) == null || oe.call(C, N);
  }).current, P = k(null), T = k(`${t}@${n}`);
  Ne(() => {
    const N = `${t}@${n}`;
    T.current !== N && (T.current = N, o && ac(D.current, P.current));
  }, [o, n, t]), x(() => {
    o || Gt(P.current);
  }, [o]), x(() => () => Gt(P.current), []);
  const E = Math.max(120, Math.floor(t * _)), j = Math.max(E, Math.ceil(s || 0)), V = vn(d, t, E), z = K(
    () => Ti(f, t, E),
    [E, f, t]
  ), [q, re] = L(null), Z = typeof g == "function", ne = Z ? h ?? null : q, ie = (N) => {
    Z ? N !== (h ?? null) && (g == null || g(N)) : re((oe) => oe === N ? oe : N);
  }, Q = K(
    () => z.find((N) => N.itemId === ne) || null,
    [ne, z]
  ), B = (N) => {
    var ge, Ee;
    if (N.pointerType === "touch") return;
    if (N.buttons !== 0) {
      ie(null);
      return;
    }
    if ((Ee = (ge = N.target) == null ? void 0 : ge.closest) != null && Ee.call(ge, `.${no}`)) return;
    const oe = N.currentTarget.getBoundingClientRect(), ae = N.clientX - oe.left, Te = N.clientY - oe.top, Se = Q == null ? void 0 : Q.rect;
    if (Se && ao(Se) && ae >= Se.left - 4 && ae <= Se.left + oo && Te >= Se.top - ro && Te <= Se.top) return;
    const we = or(z, ae, Te);
    ie((we == null ? void 0 : we.itemId) || null);
  }, se = (N) => {
    if (N.pointerType === "mouse") return;
    const oe = N.currentTarget.getBoundingClientRect(), ae = or(
      z,
      N.clientX - oe.left,
      N.clientY - oe.top
    );
    ie((ae == null ? void 0 : ae.itemId) || null);
  }, G = (N) => {
    !Number.isFinite(N) || N <= 0 || Math.abs(M.current - N) < 1e-3 || (M.current = N, O(N), l == null || l(e, N));
  };
  return /* @__PURE__ */ F(
    "div",
    {
      ref: I,
      [Ue]: e,
      [rt]: r,
      [wn]: E,
      className: Rn,
      onPointerMoveCapture: B,
      onPointerDown: se,
      onPointerLeave: (N) => {
        N.pointerType === "mouse" && ie(null);
      },
      style: {
        width: t,
        height: j,
        minHeight: j
      },
      children: [
        o ? /* @__PURE__ */ v(
          oa,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            customTextRenderer: y,
            renderAnnotationLayer: !1,
            className: Ur,
            loading: /* @__PURE__ */ v(
              "div",
              {
                className: Ct,
                style: { width: t, height: E }
              }
            ),
            onLoadSuccess: (N) => {
              try {
                const oe = N.getViewport({ scale: 1 });
                if (oe.width > 0) {
                  const ae = oe.height / oe.width;
                  G(ae);
                }
              } catch {
              }
              c == null || c();
            },
            onRenderSuccess: () => {
              Gt(P.current), c == null || c();
            }
          }
        ) : /* @__PURE__ */ v(
          "div",
          {
            className: Ct,
            style: { width: t, height: E },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ v("div", { ref: P, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        V ? /* @__PURE__ */ v(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": d == null ? void 0 : d.itemId,
            style: V,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && b ? /* @__PURE__ */ v(
          Ui,
          {
            layoutPage: p,
            pageState: S,
            width: t,
            height: E
          }
        ) : null,
        o && r === "translated" && (w != null && w.size) ? /* @__PURE__ */ v("div", { className: "reader-revised-markers", "aria-hidden": "true", children: z.filter((N) => w.has(N.itemId)).map((N) => /* @__PURE__ */ v(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": N.itemId,
            style: { left: N.rect.left, top: N.rect.top, height: N.rect.height }
          },
          N.itemId
        )) }) : null,
        /* @__PURE__ */ v(
          Ai,
          {
            target: o ? Q : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: Q && (w == null ? void 0 : w.get(Q.itemId)) || 0
          }
        )
      ]
    }
  );
}
const oc = hn(rc);
function ac(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function Gt(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const sc = 2 * 1024 * 1024;
function ic(e) {
  const t = new $r.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const Kt = 5, cc = "120% 0px", lc = 120, uc = "25% 0px";
let cr = 1;
const lr = /* @__PURE__ */ new WeakMap();
function dc(e) {
  if (!e) return 0;
  const t = lr.get(e);
  if (t) return t;
  const n = cr;
  return cr += 1, lr.set(e, n), n;
}
function fc() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const mc = No(
  function({
    pane: t,
    url: n = "",
    preloadedFile: r = null,
    userZoom: o = 1,
    visible: a = !0,
    emptyLabel: s = "暂无 PDF",
    scrollRoot: c = null,
    pageWidthOverride: i = null,
    rowHeights: l,
    onMetrics: u,
    onLoadSuccess: d,
    onLoadError: f,
    onNumPagesChange: h,
    activeRegion: g = null,
    regions: p = [],
    readerMetadata: S = null,
    hoveredRegionId: b = null,
    onHoverRegion: R,
    liveTranslation: w,
    showLiveTranslation: m = t === "source",
    liveTranslationPendingLabel: y = "",
    paneAction: M
  }, _) {
    Pi();
    const { file: O, loading: C, error: D } = Ha(n, r), I = `${n}\0${dc(O)}`, P = k(I);
    P.current = I;
    const T = K(() => {
      const A = Oa(O);
      return A ? "ranged" in A ? { range: ic(A.ranged) } : A : null;
    }, [O, n]), [E, j] = L(0), [V, z] = L(""), [q, re] = L(null), [Z, ne] = L(480), ie = k(null), Q = k(0), B = K(() => fc(), []), se = K(() => ({
      cMapUrl: mt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: mt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: sc,
      disableAutoFetch: !0
    }), []);
    bn(_, () => q, [q]), x(() => {
      const A = (U) => {
        Q.current = U, ne(U);
      }, W = (U) => {
        const X = gs(U, Q.current);
        if (X !== "ignore") {
          if (ie.current && clearTimeout(ie.current), X === "immediate") {
            A(U);
            return;
          }
          ie.current = setTimeout(() => A(U), Vr);
        }
      }, H = !!(i && i >= 80);
      W(H ? i : (c == null ? void 0 : c.clientWidth) || 0);
      const ee = !H && c && typeof ResizeObserver < "u" ? new ResizeObserver((U) => {
        var X, ue;
        W(((ue = (X = U[0]) == null ? void 0 : X.contentRect) == null ? void 0 : ue.width) ?? c.clientWidth);
      }) : null;
      return ee && c && ee.observe(c), () => {
        ee == null || ee.disconnect(), ie.current && clearTimeout(ie.current);
      };
    }, [i, c, a]);
    const G = K(
      () => ms(Z, o),
      [Z, o]
    ), [N, oe] = L(() => /* @__PURE__ */ new Map()), [ae, Te] = L(() => /* @__PURE__ */ new Set()), [Se, we] = L(() => /* @__PURE__ */ new Set()), ge = k(/* @__PURE__ */ new Map()), Ee = k(null), te = k(null), [de, be] = L(() => /* @__PURE__ */ new Set()), ce = k(/* @__PURE__ */ new Map()), fe = $((A, W) => {
      oe((H) => {
        if (H.get(A) === W) return H;
        const J = new Map(H);
        return J.set(A, W), J;
      });
    }, []), le = $((A, W) => {
      const H = ge.current, J = H.get(A), ee = [Ee.current, te.current];
      if (J)
        for (const U of ee)
          try {
            U == null || U.unobserve(J);
          } catch {
          }
      if (W) {
        H.set(A, W);
        for (const U of ee)
          try {
            U == null || U.observe(W);
          } catch {
          }
      } else
        H.delete(A);
    }, []), Ge = k(/* @__PURE__ */ new Map()), Ke = $((A) => {
      const W = Ge.current;
      let H = W.get(A);
      return H || (H = (J) => le(A, J), W.set(A, H)), H;
    }, [le]);
    x(() => {
      if (typeof IntersectionObserver > "u") return;
      const A = ce.current, W = new IntersectionObserver(
        (H) => {
          const J = [], ee = [];
          for (const U of H) {
            const X = U.target, ue = zt(X);
            Number.isFinite(ue) && (U.isIntersecting ? J : ee).push(ue);
          }
          if ((J.length || ee.length) && Te((U) => {
            let X = null;
            for (const ue of J)
              U.has(ue) || (X = X || new Set(U), X.add(ue));
            for (const ue of ee)
              U.has(ue) && (X = X || new Set(U), X.delete(ue));
            return X || U;
          }), J.length) {
            for (const U of J) {
              const X = A.get(U);
              X && (clearTimeout(X), A.delete(U));
            }
            we((U) => {
              let X = null;
              for (const ue of J)
                U.has(ue) || (X = X || new Set(U), X.add(ue));
              return X || U;
            });
          }
          for (const U of ee)
            A.has(U) || A.set(U, setTimeout(() => {
              A.delete(U), we((X) => {
                if (!X.has(U)) return X;
                const ue = new Set(X);
                return ue.delete(U), ue;
              });
            }, lc));
        },
        { root: c, rootMargin: cc, threshold: 0 }
      );
      Ee.current = W;
      for (const H of ge.current.values())
        try {
          W.observe(H);
        } catch {
        }
      return () => {
        W.disconnect(), Ee.current === W && (Ee.current = null);
        for (const H of A.values()) clearTimeout(H);
        A.clear();
      };
    }, [c]), x(() => {
      if (typeof IntersectionObserver > "u") return;
      const A = new IntersectionObserver(
        (W) => {
          be((H) => {
            let J = null;
            for (const ee of W) {
              const U = zt(ee.target);
              !Number.isFinite(U) || ee.isIntersecting === H.has(U) || (J = J || new Set(H), ee.isIntersecting ? J.add(U) : J.delete(U));
            }
            return J || H;
          });
        },
        { root: c, rootMargin: uc, threshold: 0 }
      );
      te.current = A;
      for (const W of ge.current.values())
        try {
          A.observe(W);
        } catch {
        }
      return () => {
        A.disconnect(), te.current === A && (te.current = null);
      };
    }, [c]);
    const st = !!c && typeof IntersectionObserver < "u";
    Ne(() => {
      j(0), z(""), Te(/* @__PURE__ */ new Set()), we(/* @__PURE__ */ new Set()), oe(/* @__PURE__ */ new Map()), ge.current.clear();
      const A = ce.current;
      for (const W of A.values()) clearTimeout(W);
      A.clear(), h == null || h(0, t);
    }, [I, h, t]);
    const Ut = $(
      ({ numPages: A }) => {
        P.current === I && (j(A), z(""), h == null || h(A, t), d == null || d({ numPages: A, pane: t }));
      },
      [I, d, h, t]
    ), Ht = $(
      (A) => {
        if (P.current !== I) return;
        const W = (A == null ? void 0 : A.message) || "PDF 解析失败";
        z(W), j(0), h == null || h(0, t), f == null || f(A, t);
      },
      [I, f, h, t]
    ), Le = K(
      () => E > 0 ? Array.from({ length: E }, (A, W) => W + 1) : [],
      [E]
    );
    x(() => {
      typeof IntersectionObserver < "u" || we(new Set(Le));
    }, [Le]);
    const Ce = K(
      () => Wn(g, S, t),
      [g, S, t]
    ), Fe = K(() => {
      const A = /* @__PURE__ */ new Map();
      for (const W of p) {
        const H = Wn(W, S, t);
        if (!H) continue;
        const J = A.get(H.box.page) || [];
        J.push(H), A.set(H.box.page, J);
      }
      return A;
    }, [t, S, p]), wt = K(() => {
      const A = /* @__PURE__ */ new Set();
      if (!b) return A;
      for (const [W, H] of Fe)
        H.some((J) => J.itemId === b) && A.add(W);
      return A;
    }, [b, Fe]), Rt = K(() => {
      if (E === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!c && typeof IntersectionObserver < "u")) return new Set(Le);
      if (ae.size === 0) {
        const H = Math.min(E, Kt * 2 + 1);
        return new Set(Array.from({ length: H }, (J, ee) => ee + 1));
      }
      const W = /* @__PURE__ */ new Set();
      for (const H of ae)
        for (let J = -Kt; J <= Kt; J++) {
          const ee = H + J;
          ee >= 1 && ee <= E && W.add(ee);
        }
      return W;
    }, [E, Le, c, a, ae]), Ze = !n || !!D || !!V, Pt = n && (D || V) || s;
    return /* @__PURE__ */ F(
      "section",
      {
        ref: re,
        className: `reader-panel ${as}${a ? "" : " is-hidden"}`,
        [rt]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (w == null ? void 0 : w.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          M ? /* @__PURE__ */ v("div", { className: "reader-react-pdf-pane-action", children: M }) : null,
          y ? /* @__PURE__ */ F("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ v("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ v("span", { children: y })
          ] }) : null,
          Ze && !C ? /* @__PURE__ */ v("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: Pt }) : null,
          C ? /* @__PURE__ */ v("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          T && !D ? /* @__PURE__ */ v("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ v(
            aa,
            {
              file: T,
              loading: null,
              error: null,
              options: se,
              onLoadSuccess: Ut,
              onLoadError: Ht,
              className: "reader-react-pdf-document",
              children: Le.map((A) => {
                if (Rt.has(A))
                  return /* @__PURE__ */ v(
                    oc,
                    {
                      pane: t,
                      pageNumber: A,
                      width: G,
                      devicePixelRatio: B,
                      active: Se.has(A),
                      textLayer: !st || de.has(A),
                      syncedMinHeight: (l == null ? void 0 : l.get(A)) || 0,
                      onMetrics: u,
                      cachedAspect: N.get(A),
                      onAspectChange: fe,
                      sentinelRef: Ke(A),
                      regionHighlight: (Ce == null ? void 0 : Ce.box.page) === A ? Ce : null,
                      regionTargets: Fe.get(A),
                      hoveredRegionId: b && wt.has(A) ? b : null,
                      onHoverRegion: R,
                      liveTranslationLayout: w == null ? void 0 : w.layoutByPage.get(A - 1),
                      liveTranslationPage: w == null ? void 0 : w.pagesByPage.get(A - 1),
                      showLiveTranslation: m
                    },
                    `${t}-${A}`
                  );
                const H = N.get(A) ?? lo, J = Math.max(120, Math.floor(G * H)), ee = Math.max(J, Math.ceil((l == null ? void 0 : l.get(A)) || 0));
                return /* @__PURE__ */ v(
                  "div",
                  {
                    ref: Ke(A),
                    [Ue]: A,
                    [rt]: t,
                    [wn]: J,
                    className: `${Rn} is-placeholder`,
                    style: {
                      width: G,
                      height: ee,
                      minHeight: ee
                    },
                    children: /* @__PURE__ */ v(
                      "div",
                      {
                        className: Ct,
                        style: { width: G, height: J },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${A}`
                );
              })
            },
            I
          ) }) : null
        ]
      }
    );
  }
), ur = hn(mc), hc = 2e3, pc = 6, gc = 500, dr = "reader-react-resizing";
function bc(e, t) {
  const n = k(null), r = k(null);
  Ne(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const m = yc(e), y = At(e, m);
      if (!y) return;
      s = { pane: m, progress: y, started: performance.now() };
    }
    const { pane: c, progress: i, started: l } = s;
    let u = 0, d = null, f = e.scrollHeight, h = f, g = 0, p = l;
    const S = /* @__PURE__ */ new WeakMap(), b = typeof ResizeObserver > "u" ? null : new ResizeObserver((m) => {
      let y = !1;
      for (const M of m) {
        const _ = Math.round(M.contentRect.height);
        S.has(M.target) && S.get(M.target) !== _ && (y = !0), S.set(M.target, _);
      }
      y && pt(e, i, "auto", c);
    }), R = () => {
      var m;
      d && clearTimeout(d), cancelAnimationFrame(u), b == null || b.disconnect(), e.classList.remove(dr);
      for (const y of fr) e.removeEventListener(y, R);
      ((m = r.current) == null ? void 0 : m.stop) === R && (r.current = null);
    }, w = () => {
      pt(e, i, "auto", c);
      const m = e.scrollHeight;
      g = m === h ? g + 1 : 0, h = m;
      const y = performance.now() - p;
      g >= pc && (m !== f || y > gc) || y > hc ? R() : u = requestAnimationFrame(w);
    };
    for (const m of fr) e.addEventListener(m, R, { passive: !0 });
    for (const m of Array.from(e.children)) b == null || b.observe(m);
    e.classList.add(dr), r.current = { ...s, stop: R }, d = setTimeout(() => {
      d = null, p = performance.now(), f = e.scrollHeight, h = f, g = 0, u = requestAnimationFrame(w);
    }, Vr);
  }, [e, t]), x(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function yc(e) {
  for (const t of Array.from(e.querySelectorAll(`[${Ue}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(rt) || null;
  }
  return null;
}
const fr = ["wheel", "touchstart", "keydown", "pointerdown"], vc = () => () => {
}, mr = () => null;
function Sc({
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
function wc(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function Rc(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function Pc(e) {
  const t = Oe(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", c = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", i = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, d = e.bindShell ?? (t == null ? void 0 : t.bindShell), f = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, h = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? St, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, p = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), S = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, b = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, R = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, w = e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", m = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", y = e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, M = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, _ = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), O = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), C = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), D = e.regions ?? (t == null ? void 0 : t.regions) ?? [], I = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), P = (t == null ? void 0 : t.regionHover) ?? null, [T, E] = L(null), j = Cr(
    P ? P.subscribe : vc,
    P ? () => P.get().itemId : mr,
    P ? () => P.get().itemId : mr
  ), V = P ? j : T, z = $((ne) => {
    P ? P.set(ne, "pdf") : E(ne);
  }, [P]), q = Sc({
    mode: s,
    compareMode: c,
    showSource: i,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), Z = Number.isFinite(g) && g > 0 ? wc(
    g,
    n || r,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return bc(f, Z), /* @__PURE__ */ v(
    "div",
    {
      ref: d,
      className: os,
      "data-reader-region-count": D.length,
      "data-reader-structured-region-count": D.filter(Vo).length,
      "data-reader-metadata-ready": I ? "true" : "false",
      children: /* @__PURE__ */ F(
        "main",
        {
          className: `${rs} reader-mode-${q.mode}`,
          "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
          children: [
            S ? /* @__PURE__ */ v(
              ur,
              {
                pane: "source",
                url: w,
                preloadedFile: y,
                userZoom: h,
                visible: q.showSource,
                scrollRoot: f,
                pageWidthOverride: Z,
                rowHeights: q.compareMode ? p : void 0,
                onMetrics: _,
                emptyLabel: R ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                onNumPagesChange: O,
                activeRegion: C,
                regions: D,
                readerMetadata: I,
                hoveredRegionId: V,
                onHoverRegion: z,
                liveTranslation: u ? o : void 0,
                showLiveTranslation: u,
                liveTranslationPendingLabel: u ? Rc(o) : "",
                paneAction: u ? /* @__PURE__ */ F(vt, { children: [
                  e.sourcePaneAction,
                  /* @__PURE__ */ v(
                    "span",
                    {
                      className: "reader-source-overlay-badge",
                      "data-source-overlay-badge": "true",
                      title: "源栏正在叠加实时译文，右栏为最终译文 PDF",
                      children: "原文+实时译文叠加"
                    }
                  )
                ] }) : e.sourcePaneAction
              }
            ) : null,
            b ? /* @__PURE__ */ v(
              ur,
              {
                pane: "translated",
                url: m,
                preloadedFile: M,
                userZoom: h,
                visible: q.showTranslated,
                scrollRoot: f,
                pageWidthOverride: Z,
                rowHeights: q.compareMode ? p : void 0,
                onMetrics: _,
                emptyLabel: "暂无译文 PDF",
                onNumPagesChange: O,
                activeRegion: C,
                regions: D,
                readerMetadata: I,
                hoveredRegionId: V,
                onHoverRegion: z,
                liveTranslation: void 0,
                showLiveTranslation: !1
              }
            ) : null
          ]
        }
      )
    }
  );
}
const Ic = [
  { id: "source", label: "原文", Icon: xr },
  { id: "compare", label: "对照", Icon: Or },
  { id: "translated", label: "译文", Icon: Fr }
];
function Tc(e) {
  return e.connection === "live" ? `实时译文 · ${e.pagesByPage.size} 页` : e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function Ec(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function Mc(e) {
  const t = Oe(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null
  } = e, s = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? Tc(a.state) : "";
  return /* @__PURE__ */ F("header", { className: "reader-workspace-bar", children: [
    a ? /* @__PURE__ */ F(
      "button",
      {
        type: "button",
        className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
        "aria-pressed": a.visible,
        "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
        title: a.state.error || c,
        onClick: a.onToggle,
        children: [
          /* @__PURE__ */ v(Zo, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
          /* @__PURE__ */ v("span", { className: "reader-live-translation-toggle-label", children: c })
        ]
      }
    ) : null,
    /* @__PURE__ */ v("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: Ic.map(({ id: i, label: l, Icon: u }) => {
      const d = n === i, f = Ec({
        id: i,
        documentReady: r,
        sourceViewOnly: s,
        liveTranslationAvailable: !!a
      });
      return /* @__PURE__ */ F(
        "button",
        {
          type: "button",
          className: `reader-workspace-tab${d ? " is-active" : ""}`,
          role: "tab",
          "aria-selected": d,
          "aria-label": l,
          title: f ? `${l} 需要文档任务` : l,
          disabled: f,
          onClick: () => o(i),
          children: [
            /* @__PURE__ */ v(u, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ v("span", { className: "reader-workspace-tab-label", children: l })
          ]
        },
        i
      );
    }) })
  ] });
}
const kc = {
  markdown: { label: "Markdown", short: "MD", Icon: Yo, needsJob: !0 }
}, Ac = Jr.map(
  (e) => ({ id: e, ...kc[e] })
);
function uo() {
  return Ac.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function _c(e) {
  const t = Oe(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ v(vt, { children: uo().map(({ id: s, label: c, Icon: i, needsJob: l }) => {
    const u = n === s, d = l && r, f = u ? `收起${c}` : `打开${c}`;
    return /* @__PURE__ */ v(
      "button",
      {
        type: "button",
        className: "reader-panel-toggle",
        "aria-label": f,
        "aria-pressed": u,
        title: d ? `${c} 需打开任务阅读` : c,
        disabled: d,
        onClick: () => u ? a() : o(s),
        children: /* @__PURE__ */ v(i, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 })
      },
      s
    );
  }) });
}
function Nc(e) {
  const t = Oe(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), c = uo().map(({ id: i, label: l, short: u, Icon: d, needsJob: f }) => ({
    key: i,
    label: l,
    short: u,
    Icon: d,
    disabled: f && o,
    selected: n === i,
    badge: r == null ? void 0 : r[i],
    onClick: () => a(i)
  }));
  return n ? /* @__PURE__ */ F("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ v("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: c.map(({ key: i, label: l, Icon: u, disabled: d, selected: f, badge: h, onClick: g }) => /* @__PURE__ */ F(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": f,
        className: `reader-assistant-dock-tab${f ? " is-active" : ""}`,
        title: d ? `${l} 需打开任务阅读` : l,
        disabled: d,
        onClick: g,
        children: [
          /* @__PURE__ */ v(u, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
          /* @__PURE__ */ v("span", { className: "reader-assistant-dock-tab-label", children: l }),
          h ? /* @__PURE__ */ v("span", { className: "reader-assistant-dock-badge", children: h }) : null
        ]
      },
      i
    )) }),
    /* @__PURE__ */ v(
      "button",
      {
        type: "button",
        className: "reader-assistant-dock-close",
        "aria-label": "关闭阅读辅助面板",
        title: "关闭辅助面板",
        onClick: s,
        children: /* @__PURE__ */ v(Sn, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function Lc(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function Cc(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Dc(e) {
  return e / 100 * window.innerHeight;
}
function zc(e) {
  return e / 100 * window.innerWidth;
}
function xc(e) {
  switch (typeof e) {
    case "number":
      return [e, "px"];
    case "string": {
      const t = parseFloat(e);
      return e.endsWith("%") ? [t, "%"] : e.endsWith("px") ? [t, "px"] : e.endsWith("rem") ? [t, "rem"] : e.endsWith("em") ? [t, "em"] : e.endsWith("vh") ? [t, "vh"] : e.endsWith("vw") ? [t, "vw"] : [t, "%"];
    }
  }
}
function dt({
  groupSize: e,
  panelElement: t,
  styleProp: n
}) {
  let r;
  const [o, a] = xc(n);
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
      r = Cc(t, o);
      break;
    }
    case "em": {
      r = Lc(t, o);
      break;
    }
    case "vh": {
      r = Dc(o);
      break;
    }
    case "vw": {
      r = zc(o);
      break;
    }
  }
  return r;
}
function he(e) {
  return parseFloat(e.toFixed(3));
}
function ot({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function ln(e) {
  const { panels: t } = e, n = ot({ group: e });
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
      const u = dt({
        groupSize: n,
        panelElement: o,
        styleProp: a.collapsedSize
      });
      s = he(u / n * 100);
    }
    let c;
    if (a.defaultSize !== void 0) {
      const u = dt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      c = he(u / n * 100);
    }
    let i = 0;
    if (a.minSize !== void 0) {
      const u = dt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      i = he(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = dt({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      l = he(u / n * 100);
    }
    return {
      groupResizeBehavior: a.groupResizeBehavior,
      collapsedSize: s,
      collapsible: a.collapsible === !0,
      defaultSize: c,
      disabled: a.disabled,
      minSize: i,
      maxSize: l,
      panelId: r.id
    };
  });
}
function Y(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function un(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? Oc : Fc
  );
}
function Oc(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function Fc(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function fo(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function mo(e, t) {
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
function $c({
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
    const { x: c, y: i } = mo(r, s), l = e === "horizontal" ? c : i;
    l < a && (a = l, o = s);
  }
  return Y(o, "No rect found"), o;
}
let Mt;
function jc() {
  return Mt === void 0 && (typeof matchMedia == "function" ? Mt = !!matchMedia("(pointer:coarse)").matches : Mt = !1), Mt;
}
function ho(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = un(
    n,
    Array.from(t.children).filter(fo).map((g) => ({ element: g }))
  ).map(({ element: g }) => g), s = [];
  let c = !1, i = !1, l = -1, u = -1, d = 0, f, h = [];
  {
    let g = -1;
    for (const p of a)
      p.hasAttribute("data-panel") && (g++, p.hasAttribute("data-disabled") || (d++, l === -1 && (l = g), u = g));
  }
  if (d > 1) {
    let g = -1;
    for (const p of a)
      if (p.hasAttribute("data-panel")) {
        g++;
        const S = r.find(
          (b) => b.element === p
        );
        if (S) {
          if (f) {
            const b = f.element.getBoundingClientRect(), R = p.getBoundingClientRect();
            let w;
            if (i) {
              const m = n === "horizontal" ? new DOMRect(
                b.right,
                b.top,
                0,
                b.height
              ) : new DOMRect(
                b.left,
                b.bottom,
                b.width,
                0
              ), y = n === "horizontal" ? new DOMRect(R.left, R.top, 0, R.height) : new DOMRect(R.left, R.top, R.width, 0);
              switch (h.length) {
                case 0: {
                  w = [
                    m,
                    y
                  ];
                  break;
                }
                case 1: {
                  const M = h[0], _ = $c({
                    orientation: n,
                    rects: [b, R],
                    targetRect: M.element.getBoundingClientRect()
                  });
                  w = [
                    M,
                    _ === b ? y : m
                  ];
                  break;
                }
                default: {
                  w = h;
                  break;
                }
              }
            } else
              h.length ? w = h : w = [
                n === "horizontal" ? new DOMRect(
                  b.right,
                  R.top,
                  R.left - b.right,
                  R.height
                ) : new DOMRect(
                  R.left,
                  b.bottom,
                  R.width,
                  R.top - b.bottom
                )
              ];
            for (const m of w) {
              let y = "width" in m ? m : m.element.getBoundingClientRect();
              const M = jc() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (y.width < M) {
                const O = M - y.width;
                y = new DOMRect(
                  y.x - O / 2,
                  y.y,
                  y.width + O,
                  y.height
                );
              }
              if (y.height < M) {
                const O = M - y.height;
                y = new DOMRect(
                  y.x,
                  y.y - O / 2,
                  y.width,
                  y.height + O
                );
              }
              const _ = g <= l || g > u;
              !c && !_ && s.push({
                group: e,
                groupSize: ot({ group: e }),
                panels: [f, S],
                separator: "width" in m ? void 0 : m,
                rect: y
              }), c = !1;
            }
          }
          i = !1, f = S, h = [];
        }
      } else if (p.hasAttribute("data-separator")) {
        p.ariaDisabled !== null && (c = !0);
        const S = o.find(
          (b) => b.element === p
        );
        S ? h.push(S) : (f = void 0, h = []);
      } else
        i = !0;
  }
  return s;
}
var De;
class po {
  constructor() {
    Bn(this, De, {});
  }
  addListener(t, n) {
    const r = it(this, De)[t];
    return r === void 0 ? it(this, De)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = it(this, De)[t];
    if (r !== void 0)
      if (r.length === 1)
        r[0].call(null, n);
      else {
        let o = !1, a = null;
        const s = Array.from(r);
        for (let c = 0; c < s.length; c++) {
          const i = s[c];
          try {
            i.call(null, n);
          } catch (l) {
            a === null && (o = !0, a = l);
          }
        }
        if (o)
          throw a;
      }
  }
  removeAllListeners() {
    Un(this, De, {});
  }
  removeListener(t, n) {
    const r = it(this, De)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
De = new WeakMap();
let tt = {
  cursorFlags: 0,
  state: "inactive"
};
const Tn = new po();
function He() {
  return tt;
}
function Bc(e) {
  return Tn.addListener("change", e);
}
function Uc(e) {
  const t = tt, n = { ...tt };
  n.cursorFlags = e, tt = n, Tn.emit("change", {
    prev: t,
    next: n
  });
}
function nt(e) {
  const t = tt;
  tt = e, Tn.emit("change", {
    prev: t,
    next: e
  });
}
const Hc = (e) => e, Zt = () => {
}, go = 1, bo = 2, yo = 4, vo = 8, hr = 3, pr = 12;
let kt;
function gr() {
  return kt === void 0 && (kt = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (kt = !0)), kt;
}
function Wc({
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
        if (e && gr()) {
          const a = (e & go) !== 0, s = (e & bo) !== 0, c = (e & yo) !== 0, i = (e & vo) !== 0;
          if (a)
            return c ? "se-resize" : i ? "ne-resize" : "e-resize";
          if (s)
            return c ? "sw-resize" : i ? "nw-resize" : "w-resize";
          if (c)
            return "s-resize";
          if (i)
            return "n-resize";
        }
        break;
      }
    }
    return gr() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const br = /* @__PURE__ */ new WeakMap();
function En(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = br.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = He();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = Wc({
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
  br.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Pe = /* @__PURE__ */ new Map();
const So = new po();
function Vc(e) {
  Pe = new Map(Pe), Pe.delete(e);
}
function yr(e, t) {
  for (const [n] of Pe)
    if (n.id === e)
      return n;
}
function xe(e, t) {
  for (const [n, r] of Pe)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function Je() {
  return Pe;
}
function Mn(e, t) {
  return So.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function _e(e, t, n) {
  const r = Pe.get(e);
  Pe = new Map(Pe), Pe.set(e, t), So.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function wo(e) {
  const t = He();
  let n = !1;
  switch (t.state) {
    case "active":
      nt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (En(e), n = !0, t.hitRegions.forEach((r) => {
        const o = xe(r.group.id, !0);
        _e(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function vr(e) {
  e.defaultPrevented || wo(e.currentTarget);
}
function Jc(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = mo(n, a.rect);
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
function qc(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Gc(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: Rr(e),
    b: Rr(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  Y(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: wr(Sr(n.a)),
    b: wr(Sr(n.b))
  };
  if (o.a === o.b) {
    const a = r.childNodes, s = {
      a: n.a.at(-1),
      b: n.b.at(-1)
    };
    let c = a.length;
    for (; c--; ) {
      const i = a[c];
      if (i === s.a) return 1;
      if (i === s.b) return -1;
    }
  }
  return Math.sign(o.a - o.b);
}
const Kc = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function Zc(e) {
  const t = getComputedStyle(Ro(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function Yc(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || Zc(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || Kc.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function Sr(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (Y(n, "Missing node"), Yc(n)) return n;
  }
  return null;
}
function wr(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function Rr(e) {
  const t = [];
  for (; e; )
    t.push(e), e = Ro(e);
  return t;
}
function Ro(e) {
  const { parentNode: t } = e;
  return qc(t) ? t.host : t;
}
function Xc(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Qc({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!fo(n) || n.contains(e) || e.contains(n))
    return !0;
  if (Gc(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Xc(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function kn(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = ho(o), s = Jc(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Qc({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function el(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function me(e, t, n = 0) {
  return Math.abs(he(e) - he(t)) <= n;
}
function Re(e, t) {
  return me(e, t) ? 0 : e > t ? 1 : -1;
}
function et({
  overrideDisabledPanels: e,
  panelConstraints: t,
  prevSize: n,
  size: r
}) {
  const {
    collapsedSize: o = 0,
    collapsible: a,
    disabled: s,
    maxSize: c = 100,
    minSize: i = 0
  } = t;
  if (s && !e)
    return n;
  if (Re(r, i) < 0)
    if (a) {
      const l = (o + i) / 2;
      Re(r, l) < 0 ? r = o : r = i;
    } else
      r = i;
  return r = Math.min(c, r), r = he(r), r;
}
function gt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (me(e, 0))
    return t;
  const s = a === "imperative-api", c = Object.values(t), i = Object.values(o), l = [...c], [u, d] = r;
  Y(u != null, "Invalid first pivot index"), Y(d != null, "Invalid second pivot index");
  let f = 0;
  switch (a) {
    case "keyboard": {
      {
        const p = e < 0 ? d : u, S = n[p];
        Y(
          S,
          `Panel constraints not found for index ${p}`
        );
        const {
          collapsedSize: b = 0,
          collapsible: R,
          minSize: w = 0
        } = S;
        if (R) {
          const m = c[p];
          if (Y(
            m != null,
            `Previous layout not found for panel index ${p}`
          ), me(m, b)) {
            const y = w - m;
            Re(y, Math.abs(e)) > 0 && (e = e < 0 ? 0 - y : y);
          }
        }
      }
      {
        const p = e < 0 ? u : d, S = n[p];
        Y(
          S,
          `No panel constraints found for index ${p}`
        );
        const {
          collapsedSize: b = 0,
          collapsible: R,
          minSize: w = 0
        } = S;
        if (R) {
          const m = c[p];
          if (Y(
            m != null,
            `Previous layout not found for panel index ${p}`
          ), me(m, w)) {
            const y = m - b;
            Re(y, Math.abs(e)) > 0 && (e = e < 0 ? 0 - y : y);
          }
        }
      }
      break;
    }
    default: {
      const p = e < 0 ? d : u, S = n[p];
      Y(
        S,
        `Panel constraints not found for index ${p}`
      );
      const b = c[p], { collapsible: R, collapsedSize: w, minSize: m } = S;
      if (R && Re(b, m) < 0)
        if (e > 0) {
          const y = m - w, M = y / 2, _ = b + e;
          Re(_, m) < 0 && (e = Re(e, M) <= 0 ? 0 : y);
        } else {
          const y = m - w, M = 100 - y / 2, _ = b - e;
          Re(_, m) < 0 && (e = Re(100 + e, M) > 0 ? 0 : -y);
        }
      break;
    }
  }
  {
    const p = e < 0 ? 1 : -1;
    let S = e < 0 ? d : u, b = 0;
    for (; ; ) {
      const w = c[S];
      Y(
        w != null,
        `Previous layout not found for panel index ${S}`
      );
      const m = et({
        overrideDisabledPanels: s,
        panelConstraints: n[S],
        prevSize: w,
        size: 100
      }) - w;
      if (b += m, S += p, S < 0 || S >= n.length)
        break;
    }
    const R = Math.min(Math.abs(e), Math.abs(b));
    e = e < 0 ? 0 - R : R;
  }
  {
    let p = e < 0 ? u : d;
    for (; p >= 0 && p < n.length; ) {
      const S = Math.abs(e) - Math.abs(f), b = c[p];
      Y(
        b != null,
        `Previous layout not found for panel index ${p}`
      );
      const R = b - S, w = et({
        overrideDisabledPanels: s,
        panelConstraints: n[p],
        prevSize: b,
        size: R
      });
      if (!me(b, w) && (f += b - w, l[p] = w, f.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? p-- : p++;
    }
  }
  if (el(i, l))
    return o;
  {
    const p = e < 0 ? d : u, S = c[p];
    Y(
      S != null,
      `Previous layout not found for panel index ${p}`
    );
    const b = S + f, R = et({
      overrideDisabledPanels: s,
      panelConstraints: n[p],
      prevSize: S,
      size: b
    });
    if (l[p] = R, !me(R, b)) {
      let w = b - R, m = e < 0 ? d : u;
      for (; m >= 0 && m < n.length; ) {
        const y = l[m];
        Y(
          y != null,
          `Previous layout not found for panel index ${m}`
        );
        const M = y + w, _ = et({
          overrideDisabledPanels: s,
          panelConstraints: n[m],
          prevSize: y,
          size: M
        });
        if (me(y, _) || (w -= _ - y, l[m] = _), me(w, 0))
          break;
        e > 0 ? m-- : m++;
      }
    }
  }
  const h = Object.values(l).reduce(
    (p, S) => S + p,
    0
  );
  if (!me(h, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return l.reduce((p, S, b) => (p[g[b]] = S, p), {});
}
function We(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || Re(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function Ve({
  layout: e,
  panelConstraints: t
}) {
  const n = Object.values(e), r = [...n], o = r.reduce(
    (c, i) => c + i,
    0
  );
  if (r.length !== t.length)
    throw Error(
      `Invalid ${t.length} panel layout: ${r.map((c) => `${c}%`).join(", ")}`
    );
  if (!me(o, 100) && r.length > 0)
    for (let c = 0; c < t.length; c++) {
      const i = r[c];
      Y(i != null, `No layout data found for index ${c}`);
      const l = 100 / o * i;
      r[c] = l;
    }
  let a = 0;
  for (let c = 0; c < t.length; c++) {
    const i = n[c];
    Y(i != null, `No layout data found for index ${c}`);
    const l = r[c];
    Y(l != null, `No layout data found for index ${c}`);
    const u = et({
      overrideDisabledPanels: !0,
      panelConstraints: t[c],
      prevSize: i,
      size: l
    });
    l != u && (a += l - u, r[c] = u);
  }
  if (!me(a, 0))
    for (let c = 0; c < t.length; c++) {
      const i = r[c];
      Y(i != null, `No layout data found for index ${c}`);
      const l = i + a, u = et({
        overrideDisabledPanels: !0,
        panelConstraints: t[c],
        prevSize: i,
        size: l
      });
      if (i !== u && (a -= u - i, r[c] = u, me(a, 0)))
        break;
    }
  const s = Object.keys(e);
  return r.reduce((c, i, l) => (c[s[l]] = i, c), {});
}
function Po({
  groupId: e,
  panelId: t
}) {
  const n = () => {
    const i = Je();
    for (const [
      l,
      {
        defaultLayoutDeferred: u,
        derivedPanelConstraints: d,
        layout: f,
        groupSize: h,
        separatorToPanels: g
      }
    ] of i)
      if (l.id === e)
        return {
          defaultLayoutDeferred: u,
          derivedPanelConstraints: d,
          group: l,
          groupSize: h,
          layout: f,
          separatorToPanels: g
        };
    throw Error(`Group ${e} not found`);
  }, r = () => {
    const i = n().derivedPanelConstraints.find(
      (l) => l.panelId === t
    );
    if (i !== void 0)
      return i;
    throw Error(`Panel constraints not found for Panel ${t}`);
  }, o = () => {
    const i = n().group.panels.find((l) => l.id === t);
    if (i !== void 0)
      return i;
    throw Error(`Layout not found for Panel ${t}`);
  }, a = () => {
    const i = n().layout[t];
    if (i !== void 0)
      return i;
    throw Error(`Layout not found for Panel ${t}`);
  }, s = ({
    nextSize: i,
    panels: l,
    prevLayout: u,
    derivedPanelConstraints: d
  }) => {
    const f = a(), h = l.findIndex((S) => S.id === t), g = h === 0, p = h === l.length - 1;
    if (p && i < f && (g || l.slice(0, h).every((S, b) => {
      const R = d[b];
      return (R == null ? void 0 : R.collapsible) && me(R.collapsedSize, u[R.panelId]);
    }))) {
      const S = l.slice(0, h).reduce((b, R) => b + u[R.id], 0);
      return {
        ...u,
        [t]: he(100 - S)
      };
    }
    return gt({
      delta: p ? f - i : i - f,
      initialLayout: u,
      panelConstraints: d,
      pivotIndices: p ? [h - 1, h] : [h, h + 1],
      prevLayout: u,
      trigger: "imperative-api"
    });
  }, c = (i) => {
    const l = a();
    if (i === l)
      return;
    const {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: d,
      group: f,
      groupSize: h,
      layout: g,
      separatorToPanels: p
    } = n(), S = s({
      nextSize: i,
      panels: f.panels,
      prevLayout: g,
      derivedPanelConstraints: d
    }), b = Ve({
      layout: S,
      panelConstraints: d
    });
    We(g, b) || _e(f, {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: d,
      groupSize: h,
      layout: b,
      separatorToPanels: p
    });
  };
  return {
    collapse: () => {
      const { collapsible: i, collapsedSize: l } = r(), { mutableValues: u } = o(), d = a();
      i && d !== l && (u.expandToSize = d, c(l));
    },
    expand: () => {
      const { collapsible: i, collapsedSize: l, minSize: u } = r(), { mutableValues: d } = o(), f = a();
      if (i && f === l) {
        let h = d.expandToSize ?? u;
        h === 0 && (h = 1), c(h);
      }
    },
    getSize: () => {
      const { group: i } = n(), l = a(), { element: u } = o(), d = i.orientation === "horizontal" ? u.offsetWidth : u.offsetHeight;
      return {
        asPercentage: l,
        inPixels: d
      };
    },
    isCollapsed: () => {
      const { collapsible: i, collapsedSize: l } = r(), u = a();
      return i && me(l, u);
    },
    resize: (i) => {
      const { group: l } = n(), { element: u } = o(), d = ot({ group: l }), f = dt({
        groupSize: d,
        panelElement: u,
        styleProp: i
      }), h = he(f / d * 100);
      c(h);
    }
  };
}
function Pr(e) {
  if (e.defaultPrevented)
    return;
  const t = Je();
  kn(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = Po({
          groupId: n.group.id,
          panelId: r.id
        });
        a && o !== void 0 && (a.resize(o), e.preventDefault());
      }
    }
  });
}
function _t(e) {
  const t = Je();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function Io({
  groupId: e
}) {
  const t = () => {
    const n = Je();
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
        layout: c,
        separatorToPanels: i
      } = t(), l = Ve({
        layout: n,
        panelConstraints: o
      });
      return r ? c : (We(c, l) || _e(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: l,
        separatorToPanels: i
      }), l);
    }
  };
}
function $e(e, t) {
  const n = _t(e), r = xe(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  Y(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  Y(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), c = Io({ groupId: n.id }).getLayout(), i = gt({
    delta: t,
    initialLayout: c,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: c,
    trigger: "keyboard"
  }), l = Ve({
    layout: i,
    panelConstraints: r.derivedPanelConstraints
  });
  We(c, l) || _e(
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
function Ir(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = _t(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && $e(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && $e(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && $e(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && $e(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), $e(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = _t(t), o = xe(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: c } = o, i = r.separators.find(
          (f) => f.element === t
        );
        Y(i, "Matching separator not found");
        const l = c.get(i);
        Y(l, "Matching panels not found");
        const u = l[0], d = a.find(
          (f) => f.panelId === u.id
        );
        if (Y(d, "Panel metadata not found"), d.collapsible) {
          const f = s[u.id], h = d.collapsedSize === f ? r.mutableState.expandedPanelSizes[u.id] ?? d.minSize : d.collapsedSize;
          $e(t, h - f);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = _t(t).separators.map(
          (s) => s.element
        ), o = Array.from(r).findIndex(
          (s) => s === e.currentTarget
        );
        Y(o !== null, "Index not found");
        const a = e.shiftKey ? o > 0 ? o - 1 : r.length - 1 : o + 1 < r.length ? o + 1 : 0;
        r[a].focus({
          preventScroll: !0
        });
        break;
      }
      case "Home": {
        e.preventDefault(), $e(t, -100);
        break;
      }
    }
}
function Tr(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = Je(), n = kn(e, t), r = /* @__PURE__ */ new Map();
  let o = !1;
  n.forEach((a) => {
    a.separator && (o || (o = !0, a.separator.element.focus({
      // @ts-expect-error https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#browser_compatibility
      focusVisible: !1,
      preventScroll: !0
    })));
    const s = t.get(a.group);
    s && r.set(a.group, s.layout);
  }), nt({
    cursorFlags: 0,
    hitRegions: n,
    initialLayoutMap: r,
    pointerDownAtPoint: { x: e.clientX, y: e.clientY },
    state: "active"
  }), n.length && e.preventDefault();
}
function To({
  document: e,
  event: t,
  hitRegions: n,
  initialLayoutMap: r,
  mountedGroups: o,
  pointerDownAtPoint: a,
  prevCursorFlags: s
}) {
  let c = 0;
  n.forEach((l) => {
    const { group: u, groupSize: d } = l, { orientation: f, panels: h } = u, { disableCursor: g } = u.mutableState;
    let p = 0;
    a ? f === "horizontal" ? p = (t.clientX - a.x) / d * 100 : p = (t.clientY - a.y) / d * 100 : f === "horizontal" ? p = t.clientX < 0 ? -100 : 100 : p = t.clientY < 0 ? -100 : 100;
    const S = r.get(u), b = o.get(u);
    if (!S || !b)
      return;
    const {
      defaultLayoutDeferred: R,
      derivedPanelConstraints: w,
      groupSize: m,
      layout: y,
      separatorToPanels: M
    } = b;
    if (w && y && M) {
      const _ = gt({
        delta: p,
        initialLayout: S,
        panelConstraints: w,
        pivotIndices: l.panels.map((O) => h.indexOf(O)),
        prevLayout: y,
        trigger: "mouse-or-touch"
      });
      if (We(_, y)) {
        if (p !== 0 && !g)
          switch (f) {
            case "horizontal": {
              c |= p < 0 ? go : bo;
              break;
            }
            case "vertical": {
              c |= p < 0 ? yo : vo;
              break;
            }
          }
      } else
        _e(l.group, {
          defaultLayoutDeferred: R,
          derivedPanelConstraints: w,
          groupSize: m,
          layout: _,
          separatorToPanels: M
        });
    }
  });
  let i = 0;
  t.movementX === 0 ? i |= s & hr : i |= c & hr, t.movementY === 0 ? i |= s & pr : i |= c & pr, Uc(i), En(e);
}
function Er(e) {
  const t = Je(), n = He();
  switch (n.state) {
    case "active":
      To({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function Mr(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = He(), n = Je();
  switch (t.state) {
    case "active": {
      if (
        // Skip this check for "pointerleave" events, else Firefox triggers a false positive (see #514)
        e.buttons === 0
      ) {
        nt({
          cursorFlags: 0,
          state: "inactive"
        }), t.hitRegions.forEach((a) => {
          const s = xe(a.group.id, !0);
          _e(a.group, s, {
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
      To({
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
      const a = kn(e, n);
      a.length === 0 ? t.state !== "inactive" && nt({
        cursorFlags: 0,
        state: "inactive"
      }) : nt({
        cursorFlags: 0,
        hitRegions: a,
        state: "hover"
      }), En(e.currentTarget);
      break;
    }
  }
}
function kr(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (He().state) {
      case "hover":
        nt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function Ar(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || wo(e.currentTarget) && e.preventDefault();
}
function _r(e) {
  let t = 0, n = 0;
  const r = {};
  for (const a of e)
    if (a.defaultSize !== void 0) {
      t++;
      const s = he(a.defaultSize);
      n += s, r[a.panelId] = s;
    } else
      r[a.panelId] = void 0;
  const o = e.length - t;
  if (o !== 0) {
    const a = he((100 - n) / o);
    for (const s of e)
      s.defaultSize === void 0 && (r[s.panelId] = a);
  }
  return r;
}
function tl(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((i) => i.element === t);
  if (!r || !r.onResize)
    return;
  const o = ot({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, c = {
    asPercentage: he(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = c, r.onResize(c, r.id, s);
}
function nl(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function rl({
  group: e,
  nextGroupSize: t,
  prevGroupSize: n,
  prevLayout: r
}) {
  if (n <= 0 || t <= 0 || n === t)
    return r;
  let o = 0, a = 0, s = !1;
  const c = /* @__PURE__ */ new Map(), i = [];
  for (const d of e.panels) {
    const f = r[d.id] ?? 0;
    switch (d.panelConstraints.groupResizeBehavior) {
      case "preserve-pixel-size": {
        s = !0;
        const h = f / 100 * n, g = he(
          h / t * 100
        );
        c.set(d.id, g), o += g;
        break;
      }
      case "preserve-relative-size":
      default: {
        i.push(d.id), a += f;
        break;
      }
    }
  }
  if (!s || i.length === 0)
    return r;
  const l = 100 - o, u = { ...r };
  if (c.forEach((d, f) => {
    u[f] = d;
  }), a > 0)
    for (const d of i) {
      const f = r[d] ?? 0;
      u[d] = he(
        f / a * l
      );
    }
  else {
    const d = he(
      l / i.length
    );
    for (const f of i)
      u[f] = d;
  }
  return u;
}
function ol(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const Ye = /* @__PURE__ */ new Map();
function al(e) {
  let t = !0;
  Y(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const p of g) {
      const { borderBoxSize: S, target: b } = p;
      if (b === e.element) {
        if (t) {
          const R = ot({ group: e });
          if (R === 0)
            return;
          const w = xe(e.id);
          if (!w)
            return;
          const m = ln(e), y = w.defaultLayoutDeferred ? _r(m) : w.layout, M = rl({
            group: e,
            nextGroupSize: R,
            prevGroupSize: w.groupSize,
            prevLayout: y
          }), _ = Ve({
            layout: M,
            panelConstraints: m
          });
          if (!w.defaultLayoutDeferred && We(w.layout, _) && nl(
            w.derivedPanelConstraints,
            m
          ) && w.groupSize === R)
            return;
          _e(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: m,
            groupSize: R,
            layout: _,
            separatorToPanels: w.separatorToPanels
          });
        }
      } else
        tl(e, b, S);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    Y(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = ot({ group: e }), c = ln(e), i = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (ol(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[i] ?? l ?? _r(c), d = Ve({
    layout: u,
    panelConstraints: c
  }), f = e.element.ownerDocument;
  Ye.set(
    f,
    (Ye.get(f) ?? 0) + 1
  );
  const h = /* @__PURE__ */ new Map();
  return ho(e).forEach((g) => {
    g.separator && h.set(g.separator, g.panels);
  }), _e(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: c,
    groupSize: s,
    layout: d,
    separatorToPanels: h
  }), e.separators.forEach((g) => {
    Y(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", Ir);
  }), Ye.get(f) === 1 && (f.addEventListener("contextmenu", vr, !0), f.addEventListener("dblclick", Pr, !0), f.addEventListener("pointerdown", Tr, !0), f.addEventListener("pointerleave", Er), f.addEventListener("pointermove", Mr), f.addEventListener("pointerout", kr), f.addEventListener("pointerup", Ar, !0)), function() {
    t = !1, Ye.set(
      f,
      Math.max(0, (Ye.get(f) ?? 0) - 1)
    ), Vc(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", Ir);
    }), Ye.get(f) || (f.removeEventListener(
      "contextmenu",
      vr,
      !0
    ), f.removeEventListener(
      "dblclick",
      Pr,
      !0
    ), f.removeEventListener(
      "pointerdown",
      Tr,
      !0
    ), f.removeEventListener("pointerleave", Er), f.removeEventListener("pointermove", Mr), f.removeEventListener("pointerout", kr), f.removeEventListener("pointerup", Ar, !0)), a.disconnect();
  };
}
function sl() {
  const [e, t] = L({}), n = $(() => t({}), []);
  return [e, n];
}
function An(e) {
  const t = Dr();
  return `${e ?? t}`;
}
const qe = typeof window < "u" ? Ne : x;
function ft(e) {
  const t = k(e);
  return qe(() => {
    t.current = e;
  }, [e]), $(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function _n(...e) {
  return ft((t) => {
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
function Nn(e) {
  const t = k({ ...e });
  return qe(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const Eo = pn(null);
function il(e, t) {
  const n = k({
    getLayout: () => ({}),
    setLayout: Hc
  });
  bn(t, () => n.current, []), qe(() => {
    Object.assign(
      n.current,
      Io({ groupId: e })
    );
  });
}
function Mo({
  children: e,
  className: t,
  defaultLayout: n,
  disableCursor: r,
  disabled: o,
  elementRef: a,
  groupRef: s,
  id: c,
  onLayoutChange: i,
  onLayoutChanged: l,
  orientation: u = "horizontal",
  resizeTargetMinimumSize: d = {
    coarse: 20,
    fine: 10
  },
  style: f,
  ...h
}) {
  const g = k({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), p = ft((I) => {
    We(g.current.onLayoutChange, I) || (g.current.onLayoutChange = I, i == null || i(I));
  }), S = ft(
    (I, P) => {
      We(g.current.onLayoutChanged, I) || (g.current.onLayoutChanged = I, l == null || l(I, { isUserInteraction: P }));
    }
  ), b = An(c), R = k(null), [w, m] = sl(), y = k({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: d,
    separators: []
  }), M = _n(R, a);
  il(b, s);
  const _ = ft(
    (I, P) => {
      const T = He(), E = yr(I), j = xe(I);
      if (j) {
        let V = !1;
        switch (T.state) {
          case "active": {
            V = T.hitRegions.some(
              (z) => z.group === E
            );
            break;
          }
        }
        return {
          flexGrow: j.layout[P] ?? 1,
          pointerEvents: V ? "none" : void 0
        };
      }
      if (n != null && n[P])
        return {
          flexGrow: n == null ? void 0 : n[P]
        };
    }
  ), O = Nn({
    defaultLayout: n,
    disableCursor: r
  }), C = K(
    () => ({
      get disableCursor() {
        return !!O.disableCursor;
      },
      getPanelStyles: _,
      id: b,
      orientation: u,
      registerPanel: (I) => {
        const P = y.current;
        return P.panels = un(u, [
          ...P.panels,
          I
        ]), m(), () => {
          P.panels = P.panels.filter(
            (T) => T !== I
          ), m();
        };
      },
      registerSeparator: (I) => {
        const P = y.current;
        return P.separators = un(u, [
          ...P.separators,
          I
        ]), m(), () => {
          P.separators = P.separators.filter(
            (T) => T !== I
          ), m();
        };
      },
      updatePanelProps: (I, { disabled: P }) => {
        const T = y.current.panels.find(
          (V) => V.id === I
        );
        T && (T.panelConstraints.disabled = P);
        const E = yr(b), j = xe(b);
        E && j && _e(E, {
          ...j,
          derivedPanelConstraints: ln(E)
        });
      },
      updateSeparatorProps: (I, {
        disabled: P,
        disableDoubleClick: T
      }) => {
        const E = y.current.separators.find(
          (j) => j.id === I
        );
        E && (E.disabled = P, E.disableDoubleClick = T);
      }
    }),
    [_, b, m, u, O]
  ), D = k(null);
  return qe(() => {
    const I = R.current;
    if (I === null)
      return;
    const P = y.current;
    let T;
    if (O.defaultLayout !== void 0 && Object.keys(O.defaultLayout).length === P.panels.length) {
      T = {};
      for (const Z of P.panels) {
        const ne = O.defaultLayout[Z.id];
        ne !== void 0 && (T[Z.id] = ne);
      }
    }
    const E = {
      disabled: !!o,
      element: I,
      id: b,
      mutableState: {
        defaultLayout: T,
        disableCursor: !!O.disableCursor,
        expandedPanelSizes: y.current.lastExpandedPanelSizes,
        layouts: y.current.layouts
      },
      orientation: u,
      panels: P.panels,
      resizeTargetMinimumSize: P.resizeTargetMinimumSize,
      separators: P.separators
    };
    D.current = E;
    const j = al(E), { defaultLayoutDeferred: V, derivedPanelConstraints: z, layout: q } = xe(E.id, !0);
    !V && z.length > 0 && (p(q), S(q, !1));
    const re = Mn(b, (Z) => {
      const { defaultLayoutDeferred: ne, derivedPanelConstraints: ie, layout: Q } = Z.next;
      if (ne || ie.length === 0)
        return;
      const B = E.panels.map(({ id: G }) => G).join(",");
      E.mutableState.layouts[B] = Q, ie.forEach((G) => {
        if (G.collapsible) {
          const { layout: N } = Z.prev ?? {};
          if (N) {
            const oe = me(
              G.collapsedSize,
              Q[G.panelId]
            ), ae = me(
              G.collapsedSize,
              N[G.panelId]
            );
            oe && !ae && (E.mutableState.expandedPanelSizes[G.panelId] = N[G.panelId]);
          }
        }
      });
      const se = He().state !== "active";
      p(Q), se && S(Q, Z.isUserInteraction);
    });
    return () => {
      D.current = null, j(), re();
    };
  }, [
    o,
    b,
    S,
    p,
    u,
    w,
    O
  ]), x(() => {
    const I = D.current;
    I && (I.mutableState.defaultLayout = n, I.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ v(Eo.Provider, { value: C, children: /* @__PURE__ */ v(
    "div",
    {
      ...h,
      className: t,
      "data-group": !0,
      "data-testid": b,
      id: b,
      ref: M,
      style: {
        height: "100%",
        width: "100%",
        overflow: "hidden",
        ...f,
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
Mo.displayName = "Group";
function Ln() {
  const e = gn(Eo);
  return Y(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function cl(e, t) {
  const { id: n } = Ln(), r = k({
    collapse: Zt,
    expand: Zt,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Zt
  });
  bn(t, () => r.current, []), qe(() => {
    Object.assign(
      r.current,
      Po({ groupId: n, panelId: e })
    );
  });
}
function dn({
  children: e,
  className: t,
  collapsedSize: n = "0%",
  collapsible: r = !1,
  defaultSize: o,
  disabled: a,
  elementRef: s,
  groupResizeBehavior: c = "preserve-relative-size",
  id: i,
  maxSize: l = "100%",
  minSize: u = "0%",
  onResize: d,
  panelRef: f,
  style: h,
  ...g
}) {
  const p = !!i, S = An(i), b = Nn({
    disabled: a
  }), R = k(null), w = _n(R, s), {
    getPanelStyles: m,
    id: y,
    orientation: M,
    registerPanel: _,
    updatePanelProps: O
  } = Ln(), C = d !== null, D = ft(
    (E, j, V) => {
      d == null || d(E, i, V);
    }
  );
  qe(() => {
    const E = R.current;
    if (E !== null) {
      const j = {
        element: E,
        id: S,
        idIsStable: p,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: C ? D : void 0,
        panelConstraints: {
          groupResizeBehavior: c,
          collapsedSize: n,
          collapsible: r,
          defaultSize: o,
          disabled: b.disabled,
          maxSize: l,
          minSize: u
        }
      };
      return _(j);
    }
  }, [
    c,
    n,
    r,
    o,
    C,
    S,
    p,
    l,
    u,
    D,
    _,
    b
  ]), x(() => {
    O(S, { disabled: a });
  }, [a, S, O]), cl(S, f);
  const I = () => {
    const E = m(y, S);
    if (E)
      return JSON.stringify(E);
  }, P = Cr(
    (E) => Mn(y, E),
    I,
    I
  );
  let T;
  return P ? T = JSON.parse(P) : o !== void 0 ? T = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : T = { flexGrow: 1 }, /* @__PURE__ */ v(
    "div",
    {
      ...g,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": S,
      id: S,
      ref: w,
      style: {
        ...ll,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...T
      },
      children: /* @__PURE__ */ v(
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
            touchAction: M === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
dn.displayName = "Panel";
const ll = {
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
function ul({
  layout: e,
  panelConstraints: t,
  panelId: n,
  panelIndex: r
}) {
  let o, a;
  const s = e[n], c = t.find(
    (i) => i.panelId === n
  );
  if (c) {
    const i = c.maxSize, l = c.collapsible ? c.collapsedSize : c.minSize, u = [r, r + 1];
    a = Ve({
      layout: gt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = Ve({
      layout: gt({
        delta: i - s,
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
function ko({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...c
}) {
  const i = An(a), l = Nn({
    disabled: n,
    disableDoubleClick: r
  }), [u, d] = L({}), [f, h] = L("inactive"), [g, p] = L(!1), S = k(null), b = _n(S, o), {
    disableCursor: R,
    id: w,
    orientation: m,
    registerSeparator: y,
    updateSeparatorProps: M
  } = Ln(), _ = m === "horizontal" ? "vertical" : "horizontal";
  qe(() => {
    const D = S.current;
    if (D !== null) {
      const I = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: D,
        id: i
      }, P = y(I), T = Bc(
        (j) => {
          h(
            j.next.state !== "inactive" && j.next.hitRegions.some(
              (V) => V.separator === I
            ) ? j.next.state : "inactive"
          );
        }
      ), E = Mn(
        w,
        (j) => {
          const { derivedPanelConstraints: V, layout: z, separatorToPanels: q } = j.next, re = q.get(I);
          if (re) {
            const Z = re[0], ne = re.indexOf(Z);
            d(
              ul({
                layout: z,
                panelConstraints: V,
                panelId: Z.id,
                panelIndex: ne
              })
            );
          }
        }
      );
      return () => {
        T(), E(), P();
      };
    }
  }, [w, i, y, l]), x(() => {
    M(i, { disabled: n, disableDoubleClick: r });
  }, [n, r, i, M]);
  let O;
  n && !R && (O = "not-allowed");
  let C;
  if (n)
    C = "disabled";
  else
    switch (f) {
      case "active": {
        C = "active";
        break;
      }
      default:
        g ? C = "focus" : C = f;
    }
  return /* @__PURE__ */ v(
    "div",
    {
      ...c,
      "aria-controls": u.valueControls,
      "aria-disabled": n || void 0,
      "aria-orientation": _,
      "aria-valuemax": u.valueMax,
      "aria-valuemin": u.valueMin,
      "aria-valuenow": u.valueNow,
      children: e,
      className: t,
      "data-separator": C,
      "data-testid": i,
      id: i,
      onBlur: () => p(!1),
      onFocus: () => p(!0),
      ref: b,
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
ko.displayName = "Separator";
const Cn = 30, Dn = 65, bt = 50, dl = 100 - Dn, fl = 100 - Cn;
function ml(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(Dn, Math.max(Cn, t)) : bt;
}
function zn(e) {
  return 100 - e;
}
function Xe(e) {
  return `${e}%`;
}
const xn = "reader-document", yt = "reader-assistant", Ao = "retainpdf.reader.ai-split-layout.v1", hl = {
  [xn]: zn(bt),
  [yt]: bt
};
function On(e) {
  const t = ml(e == null ? void 0 : e[yt]);
  return {
    [xn]: zn(t),
    [yt]: t
  };
}
function pl() {
  try {
    const e = JSON.parse(localStorage.getItem(Ao) || "null");
    return On(e);
  } catch {
    return hl;
  }
}
function gl(e) {
  try {
    localStorage.setItem(Ao, JSON.stringify(On(e)));
  } catch {
  }
}
function Yt(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = On(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[yt]}vw`
  );
}
function bl() {
  const e = k(null), [t] = L(pl);
  Ne(() => {
    const o = e.current;
    return Yt(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = $((o) => {
    Yt(e.current, o);
  }, []), r = $((o, a) => {
    Yt(e.current, o), a.isUserInteraction && gl(o);
  }, []);
  return /* @__PURE__ */ F(
    Mo,
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
        /* @__PURE__ */ v(
          dn,
          {
            id: xn,
            defaultSize: Xe(zn(bt)),
            minSize: Xe(dl),
            maxSize: Xe(fl)
          }
        ),
        /* @__PURE__ */ v(
          ko,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ v("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ v(
          dn,
          {
            id: yt,
            defaultSize: Xe(bt),
            minSize: Xe(Cn),
            maxSize: Xe(Dn)
          }
        )
      ]
    }
  );
}
function yl({
  regionsFailed: e = !1,
  metadataFailed: t = !1
}) {
  const [n, r] = L(!1);
  if (x(() => {
    !e && !t && r(!1);
  }, [e, t]), n || !e && !t)
    return null;
  const o = [
    e ? "译文区域" : "",
    t ? "阅读元数据" : ""
  ].filter(Boolean);
  return /* @__PURE__ */ F("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ F("span", { className: "reader-error-notice-text", children: [
      o.join("、"),
      "加载失败，正文仍可正常阅读。"
    ] }),
    /* @__PURE__ */ v(
      "button",
      {
        type: "button",
        className: "reader-error-notice-dismiss",
        "aria-label": "关闭提示",
        onClick: () => r(!0),
        children: "×"
      }
    )
  ] });
}
function vl({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1
}) {
  return !e && !t ? /* @__PURE__ */ v(yl, { regionsFailed: o, metadataFailed: a }) : /* @__PURE__ */ F(vt, { children: [
    e ? /* @__PURE__ */ v("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ F("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ v("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ v("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ v(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ v("div", { className: "reader-react-error", role: "alert", children: n }) : null
  ] });
}
function Sl(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function wl() {
  const [e, t] = L(!1), n = Dr(), r = k(null);
  return x(() => {
    if (!e) return;
    const o = (s) => {
      const c = r.current;
      c && s.target instanceof Node && !c.contains(s.target) && t(!1);
    }, a = (s) => {
      s.key === "Escape" && (s.preventDefault(), t(!1));
    };
    return document.addEventListener("mousedown", o), window.addEventListener("keydown", a), () => {
      document.removeEventListener("mousedown", o), window.removeEventListener("keydown", a);
    };
  }, [e]), x(() => {
    const o = (a) => {
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || Sl(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((c) => !c);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
  }, []), /* @__PURE__ */ F("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
    /* @__PURE__ */ v(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-react-shortcuts-btn${e ? " is-active" : ""}`,
        "aria-label": "快捷键说明",
        "aria-expanded": e,
        "aria-controls": n,
        title: "快捷键（H 或 ?）",
        onClick: () => t((o) => !o),
        children: /* @__PURE__ */ v(Xo, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    ),
    e ? /* @__PURE__ */ F(
      "div",
      {
        id: n,
        className: "reader-react-shortcuts-panel reader-floating-surface",
        role: "dialog",
        "aria-label": "阅读器快捷键",
        children: [
          /* @__PURE__ */ F("div", { className: "reader-react-shortcuts-head", children: [
            /* @__PURE__ */ v("strong", { children: "快捷键" }),
            /* @__PURE__ */ v(
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
          /* @__PURE__ */ v("div", { className: "reader-react-shortcuts-body", children: ui.map((o) => /* @__PURE__ */ F("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ v("h3", { children: o.title }),
            /* @__PURE__ */ v("ul", { children: o.items.map((a) => /* @__PURE__ */ F("li", { children: [
              /* @__PURE__ */ v("kbd", { children: a.keys }),
              /* @__PURE__ */ v("span", { children: a.desc })
            ] }, `${o.title}-${a.keys}`)) })
          ] }, o.title)) }),
          /* @__PURE__ */ v("p", { className: "reader-react-shortcuts-foot", children: "在输入框内不会触发快捷键" })
        ]
      }
    ) : null
  ] });
}
const Rl = ["source", "sideBySide", "translated"], Pl = { source: "", translated: "", sideBySide: "" };
function Il(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = Nt(e.sourceUrl), n = Nt(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return ya({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function Tl(e) {
  const [t, n] = L(() => /* @__PURE__ */ new Set()), r = K(
    () => e ? Il(e) : Pl,
    [e]
  ), o = K(
    () => Rl.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = $(async (s) => {
    if (!e) return;
    const c = Nt(r[s]);
    if (!(!c || t.has(s)))
      try {
        const i = e.jobId ? ba(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await va(
          e.fetchProtected,
          c,
          i,
          i,
          null,
          (l) => n((u) => {
            const d = new Set(u);
            return l ? d.add(s) : d.delete(s), d;
          })
        );
      } catch (i) {
        const l = i instanceof Error ? i.message : "下载失败";
        Sa(l), n((u) => {
          const d = new Set(u);
          return d.delete(s), d;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const El = {
  source: xr,
  sideBySide: Or,
  translated: Fr
}, Ml = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function kl(e) {
  const t = Oe(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = Tl(n), c = k(null);
  return x(() => {
    const i = () => {
      var d;
      (d = c.current) != null && d.open && (c.current.open = !1);
    }, l = (d) => {
      c.current && !c.current.contains(d.target) && i();
    }, u = (d) => {
      d.key === "Escape" && i();
    };
    return document.addEventListener("pointerdown", l), document.addEventListener("keydown", u), () => {
      document.removeEventListener("pointerdown", l), document.removeEventListener("keydown", u);
    };
  }, []), /* @__PURE__ */ F("details", { ref: c, className: "reader-download-actions", children: [
    /* @__PURE__ */ F("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ v(Qo, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ v("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ v(ea, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ v("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((i) => {
      const l = xo[i], u = Nt(r[i]), d = a.has(i), f = !!u && !d, h = f ? "" : Oo(i, r), g = El[i];
      return /* @__PURE__ */ F(
        "button",
        {
          type: "button",
          id: `reader-download-${i}`,
          className: `reader-download-action${d ? " is-busy" : ""}`,
          disabled: !f,
          "aria-label": f ? `下载${l.label}` : h,
          onClick: () => {
            c.current && (c.current.open = !1), s(i);
          },
          children: [
            /* @__PURE__ */ v(g, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ F("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ F("span", { className: "reader-download-action-label", children: [
                Ml[i],
                " PDF"
              ] }),
              h ? /* @__PURE__ */ v("span", { className: "reader-download-action-reason", children: h }) : null
            ] })
          ]
        },
        i
      );
    }) })
  ] });
}
const Al = "retainpdf:reader:bookmarks:v1:", _l = 200;
function Fn() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function _o(e) {
  const t = `${e || ""}`.trim();
  return t ? `${Al}${t}` : "";
}
function Nl(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Ft(e, t = Fn()) {
  const n = _o(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = Nl(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function fn(e, t, n) {
  const r = _o(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, _l);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function Ll(e, t, n = "", { storage: r = Fn(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Ft(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((c) => c.page === s) ? fn(e, a.filter((c) => c.page !== s), r) : fn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function Cl(e, t, n = Fn()) {
  return fn(e, Ft(e, n).filter((r) => r.page !== t), n);
}
function Dl(e, t) {
  var r, o, a, s;
  let n = null;
  for (const c of e || []) {
    if (`${(c == null ? void 0 : c.regionType) || ""}` != "heading") continue;
    const i = Number(((r = c.source) == null ? void 0 : r.page) ?? ((o = c.translated) == null ? void 0 : o.page));
    if (!Number.isFinite(i) || i > t) continue;
    const l = `${((a = c.translated) == null ? void 0 : a.text) || c.markdown || ((s = c.source) == null ? void 0 : s.text) || ""}`.replace(/\s+/g, " ").trim();
    if (!l) continue;
    const u = Number(c.readingOrder) || 0;
    (!n || i > n.page || i === n.page && u >= n.order) && (n = { page: i, order: u, text: l });
  }
  return n ? n.text.slice(0, 60) : "";
}
function zl({ filled: e }) {
  return /* @__PURE__ */ v("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ v("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function xl({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = L(() => Ft(e)), [c, i] = L(!1), l = k(null);
  if (x(() => {
    s(Ft(e)), i(!1);
  }, [e]), x(() => {
    if (!c) return;
    const f = (g) => {
      l.current && !l.current.contains(g.target) && i(!1);
    }, h = (g) => {
      g.key === "Escape" && i(!1);
    };
    return document.addEventListener("pointerdown", f), document.addEventListener("keydown", h), () => {
      document.removeEventListener("pointerdown", f), document.removeEventListener("keydown", h);
    };
  }, [c]), !e || n <= 0) return null;
  const u = Math.min(Math.max(t, 1), n), d = a.some((f) => f.page === u);
  return /* @__PURE__ */ F("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: l, children: [
    /* @__PURE__ */ v(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${d ? " is-marked" : ""}`,
        "aria-pressed": d,
        "aria-label": d ? `取消第 ${u} 页的书签` : `给第 ${u} 页加书签`,
        title: d ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(Ll(e, u, Dl(r, u))),
        children: /* @__PURE__ */ v(zl, { filled: d })
      }
    ),
    /* @__PURE__ */ v(
      "button",
      {
        type: "button",
        className: "reader-react-hud-btn reader-bookmark-list-btn",
        "aria-expanded": c,
        "aria-haspopup": "true",
        "aria-label": `书签列表，共 ${a.length} 个`,
        title: "书签列表",
        disabled: !a.length,
        onClick: () => i((f) => !f),
        children: a.length
      }
    ),
    c && a.length ? /* @__PURE__ */ v("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ v("ol", { className: "reader-bookmark-list", children: a.map((f) => /* @__PURE__ */ F("li", { className: f.page === u ? "is-current" : "", children: [
      /* @__PURE__ */ F(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(f.page, n)), i(!1);
          },
          children: [
            /* @__PURE__ */ F("span", { className: "reader-bookmark-page", children: [
              "第 ",
              f.page,
              " 页"
            ] }),
            f.label ? /* @__PURE__ */ v("span", { className: "reader-bookmark-label", children: f.label }) : null
          ]
        }
      ),
      /* @__PURE__ */ v(
        "button",
        {
          type: "button",
          className: "reader-bookmark-remove",
          "aria-label": `删除第 ${f.page} 页的书签`,
          onClick: () => s(Cl(e, f.page)),
          children: "×"
        }
      )
    ] }, f.page)) }) }) : null
  ] });
}
function Ol(e) {
  const t = Oe(), n = co(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? St, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), c = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, i = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = ds(a), d = a > Hr + 1e-3, f = a < xt - 1e-3, h = Qe(r, Be()), g = h >= xt ? "100%（铺满阅读区）" : "50%（半屏，对照铺满）", [p, S] = L(!1), [b, R] = L(`${c}`);
  x(() => {
    p || R(`${Math.min(Math.max(c, 1), Math.max(i, 1))}`);
  }, [c, i, p]);
  const w = () => {
    if (S(!1), !l || i <= 0)
      return;
    const m = Number(`${b}`.trim());
    l(Ot(m, i));
  };
  return /* @__PURE__ */ F("div", { className: "reader-react-hud", "data-reader-hud": "true", children: [
    o ? /* @__PURE__ */ v("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ v("div", { className: "reader-react-hud-group", "aria-label": "页码", children: p ? /* @__PURE__ */ F(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (m) => {
          m.preventDefault(), w();
        },
        children: [
          /* @__PURE__ */ v(
            "input",
            {
              className: "reader-react-hud-page-input",
              type: "text",
              inputMode: "numeric",
              pattern: "[0-9]*",
              "aria-label": "跳转到页码",
              value: b,
              autoFocus: !0,
              onChange: (m) => R(m.target.value.replace(/[^\d]/g, "")),
              onBlur: w,
              onKeyDown: (m) => {
                m.key === "Escape" && (m.preventDefault(), S(!1), R(`${c}`));
              }
            }
          ),
          /* @__PURE__ */ F("span", { className: "reader-react-hud-page-suffix", children: [
            "/ ",
            i || "—"
          ] })
        ]
      }
    ) : /* @__PURE__ */ v(
      "button",
      {
        type: "button",
        className: "reader-react-hud-page reader-react-hud-page-btn",
        "aria-label": i > 0 ? `跳转页码，当前第 ${c} 页，共 ${i} 页` : "页码",
        title: i > 0 ? "点击输入页码跳转" : void 0,
        disabled: !l || i <= 0,
        onClick: () => {
          !l || i <= 0 || (R(`${c}`), S(!0));
        },
        children: i > 0 ? `${Math.min(c, i)} / ${i}` : "—"
      }
    ) }),
    e.bookmarkScope ? /* @__PURE__ */ v(
      xl,
      {
        scope: e.bookmarkScope,
        currentPage: c,
        numPages: i,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
      }
    ) : null,
    /* @__PURE__ */ F("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ v(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "缩小",
          disabled: !d,
          onClick: () => s(ht(a, -1)),
          children: "−"
        }
      ),
      /* @__PURE__ */ F(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn reader-react-hud-zoom-label",
          "aria-label": `重置为${g}`,
          title: g,
          onClick: () => s(h),
          children: [
            u,
            "%"
          ]
        }
      ),
      /* @__PURE__ */ v(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "放大",
          disabled: !f,
          onClick: () => s(ht(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ v("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ v(wl, {}) })
  ] });
}
function Nr(e) {
  var t, n;
  return qr(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function Fl(e) {
  const [t, n] = L(() => ({
    scope: e,
    panel: Nr(Ie(e))
  }));
  x(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Nr(Ie(e))
    });
  }, [e]), x(() => {
    t.scope === e && Bt(t.scope, {
      assistantPanel: t.panel,
      // 旧的自由两栏布局已经没有写入者了，恢复时只当迁移来源读一次。
      splitLayout: null
    });
  }, [t, e]);
  const r = $((o) => {
    n((a) => ({
      scope: a.scope,
      panel: typeof o == "function" ? o(a.panel) : o
    }));
  }, []);
  return { panel: t.panel, scope: t.scope, setPanel: r };
}
const mn = "download-toast";
function $l({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ F("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ F("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ v("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ v("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ v("div", { className: "download-toast-track", children: /* @__PURE__ */ v("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ v("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function jl(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    Qt.dismiss(mn);
    return;
  }
  Qt.custom(
    () => /* @__PURE__ */ v($l, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: mn, duration: 1 / 0 }
  );
}
function Bl() {
  const e = $((t) => {
    t && (t.setState = jl, t.hide = () => Qt.dismiss(mn));
  }, []);
  return /* @__PURE__ */ F(vt, { children: [
    /* @__PURE__ */ v(Ko, { position: "bottom-right" }),
    /* @__PURE__ */ v("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function Ul(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : Wr(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Hl(e, t) {
  return t === null || e !== t;
}
function Wl(e) {
  const t = k(!1);
  return e && (t.current = !0), t.current;
}
function Vl(e, t) {
  const n = e === t;
  return { open: n, mounted: Wl(n) };
}
const Lr = { itemId: null, origin: null };
function Jl() {
  let e = Lr;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? Lr : { itemId: n, origin: r };
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
const ql = [];
function Gl({ open: e, onToggle: t }) {
  return /* @__PURE__ */ F("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ F(je, { className: "reader-finder-toggle", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: [
      /* @__PURE__ */ v(ta, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ v("span", { children: "目录" })
    ] }),
    /* @__PURE__ */ F(je, { className: "reader-finder-toggle", "aria-pressed": e === "search", title: "在书里搜索（原文和译文）", onClick: () => t("search"), children: [
      /* @__PURE__ */ v(na, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ v("span", { children: "搜索" })
    ] })
  ] });
}
function Kl({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r,
  query: o,
  onQuery: a,
  term: s,
  focusSignal: c = 0
}) {
  var R, w;
  const i = ((R = Oe()) == null ? void 0 : R.regions) ?? ql, l = ((w = co()) == null ? void 0 : w.currentPage) ?? 1, u = K(() => Zi(i), [i]), d = Yi(u, l), f = K(() => ec(i, s), [i, s]), [h, g] = L(-1);
  x(() => g(-1), [s]);
  const p = k(null), S = k(null);
  x(() => {
    var m, y, M;
    e === "search" ? (m = p.current) == null || m.focus() : (M = (y = S.current) == null ? void 0 : y.querySelector('[aria-current="location"]')) == null || M.scrollIntoView({ block: "center" });
  }, [e, c]), x(() => {
    var m, y;
    e === "search" && h >= 0 && ((y = (m = S.current) == null ? void 0 : m.querySelector('[aria-current="true"]')) == null || y.scrollIntoView({ block: "nearest" }));
  }, [e, h]);
  const b = (m) => {
    const y = f[m];
    y && (g(m), r(y.itemId));
  };
  return /* @__PURE__ */ F("aside", { className: "reader-finder", "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ F("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ F("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ v(je, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ v(je, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ v(je, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ v(Sn, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" ? u.length ? /* @__PURE__ */ v("ol", { ref: S, className: "reader-finder-list", children: u.map((m, y) => /* @__PURE__ */ v("li", { children: /* @__PURE__ */ F(
      je,
      {
        className: "reader-finder-entry",
        "data-level": m.level,
        "aria-current": y === d ? "location" : void 0,
        onClick: () => r(m.itemId),
        children: [
          /* @__PURE__ */ v("span", { className: "reader-finder-entry-text", children: m.text }),
          /* @__PURE__ */ v("span", { className: "reader-finder-entry-page", children: m.page })
        ]
      }
    ) }, m.itemId)) }) : /* @__PURE__ */ v("p", { className: "reader-finder-empty", children: i.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ F(vt, { children: [
      /* @__PURE__ */ F("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ v(
          ra,
          {
            ref: p,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "原文、译文里的字",
            "aria-label": "在书里搜索",
            value: o,
            onChange: (m) => a(m.target.value),
            onKeyDown: (m) => {
              m.key === "Enter" ? (m.preventDefault(), b(nc(h, f.length, m.shiftKey))) : m.key === "Escape" && (m.preventDefault(), n()), m.stopPropagation();
            }
          }
        ),
        s ? /* @__PURE__ */ v("p", { className: "reader-finder-count", "aria-live": "polite", children: f.length === 0 ? "没有找到" : `${h >= 0 ? `第 ${h + 1} / ` : ""}${f.length >= 200 ? "200+ 处，只列前 200 处" : `${f.length} 处`}${h < 0 ? "，回车跳到第一处" : ""}` }) : null
      ] }),
      /* @__PURE__ */ v("ol", { className: "reader-finder-list", children: f.map((m, y) => /* @__PURE__ */ v("li", { children: /* @__PURE__ */ F(je, { className: "reader-finder-entry is-hit", "aria-current": y === h ? "true" : void 0, onClick: () => b(y), children: [
        /* @__PURE__ */ F("span", { className: "reader-finder-entry-text", children: [
          m.snippet.slice(0, m.at),
          /* @__PURE__ */ v("mark", { children: m.snippet.slice(m.at, m.at + m.length) }),
          m.snippet.slice(m.at + m.length)
        ] }),
        /* @__PURE__ */ v("span", { className: "reader-finder-entry-page", children: m.page })
      ] }) }, m.itemId)) })
    ] })
  ] });
}
const Zl = "reader-finder-input";
function Yl(e) {
  return (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && `${e.key || ""}`.toLowerCase() === "f";
}
function Xl(e, t = typeof window > "u" ? null : window) {
  x(() => {
    if (!t) return;
    const n = (r) => {
      var a, s;
      if (!Yl(r)) return;
      const o = (a = t.document) == null ? void 0 : a.activeElement;
      (s = o == null ? void 0 : o.classList) != null && s.contains(Zl) || (r.preventDefault(), e());
    };
    return t.addEventListener("keydown", n), () => t.removeEventListener("keydown", n);
  }, [e, t]);
}
const Ql = Co(() => import("./ReaderMarkdownPanel-CPNtmbmO.js").then((e) => ({ default: e.ReaderMarkdownPanel })));
function eu(e) {
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
function tu(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function nu() {
  const e = ci(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = Fl(e.viewStateKey), s = a.panel, c = a.setPanel, [i, l] = L(!1), u = k(null), d = k(null), f = s !== null, h = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, g = eu({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: h,
    liveTranslationVisible: i,
    assistantOpen: f
  }), p = Qs({
    hasOverlayContent: h,
    connection: e.liveTranslation.connection,
    showSource: g.showSource,
    liveTranslationVisible: i,
    assistantOpen: f
  }), S = g.sourceViewOnly, b = g.visibleMode;
  x(() => {
    l(!1);
  }, [e.viewStateKey]), x(() => {
    e.session.jobTerminal && l(!1);
  }, [e.session.jobTerminal]), x(() => {
    if (!(t.loading || t.failed)) {
      if (u.current !== e.viewStateKey) {
        u.current = e.viewStateKey;
        const B = Ie(e.viewStateKey), se = Ul({
          savedMode: B == null ? void 0 : B.mode,
          sourceViewOnly: S,
          viewportWidth: Be()
        });
        d.current = se.auto ? se.mode : null, se.mode && se.mode !== e.mode && e.setModeKeepingPage(se.mode);
        return;
      }
      Hl(e.mode, d.current) && (d.current = null, Bt(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, S]);
  const R = s || (e.mode === "compare" ? "compare" : "reading"), w = Vl(s, "markdown");
  pi({
    mode: b,
    sourceOnly: e.sourceOnly,
    setMode: e.setModeKeepingPage,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    currentPage: e.currentPage,
    numPages: n.hudNumPages,
    goToPage: e.goToPage,
    enabled: e.showHud
  });
  const m = $(() => {
    c(null);
  }, []), y = $((B) => {
    const se = tu(B, e.liveTranslationAvailable);
    se !== null && l(se), e.setModeKeepingPage(B);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), M = K(() => p.sourcePaneToggle ? /* @__PURE__ */ v(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${i ? " is-active" : ""}`,
      onClick: () => l((B) => !B),
      "aria-pressed": i,
      title: i ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [p.sourcePaneToggle, i]), _ = $((B) => {
    c(B);
  }, []), [O] = L(Jl), [C, D] = L(null), I = $((B) => D((se) => se === B ? null : B), []), [P, T] = L(""), [E, j] = L("");
  x(() => {
    const B = P.replace(/\s+/gu, " ").trim(), se = window.setTimeout(() => j(B), B ? 150 : 0);
    return () => window.clearTimeout(se);
  }, [P]);
  const [V, z] = L(0), q = $(() => {
    D("search"), z((B) => B + 1);
  }, []);
  Xl(q);
  const re = $((B) => {
    e.jumpToAnchor({ block_id: B }), Be() < 900 && D(null);
  }, [e.jumpToAnchor]), Z = $((B) => e.jumpToAnchor({ block_id: B }), [e.jumpToAnchor]), ne = K(() => ({
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
    regionHover: O,
    jumpToBlock: Z,
    revisedBlocks: e.revisedBlocks,
    findTerm: C === "search" ? E : "",
    sourceOnly: e.sourceOnly,
    sourceViewOnly: S,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: _, close: m }
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
    O,
    Z,
    e.revisedBlocks,
    C,
    E,
    e.sourceOnly,
    S,
    e.download,
    e.goToPage,
    _,
    m
  ]), ie = K(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), Q = [
    ns,
    `is-workspace-${R}`,
    f ? "is-assistant-open" : "",
    C ? "is-finder-open" : "",
    g.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ v(Hi, { value: ne, hud: ie, children: /* @__PURE__ */ F("div", { className: Q, "data-reader-engine": "react-pdf", "data-reader-workspace": R, children: [
    /* @__PURE__ */ v(vl, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata }),
    /* @__PURE__ */ v(Gl, { open: C, onToggle: I }),
    C ? /* @__PURE__ */ v(
      Kl,
      {
        tab: C,
        onTab: D,
        onClose: () => D(null),
        onJump: re,
        query: P,
        onQuery: T,
        term: E,
        focusSignal: V
      }
    ) : null,
    /* @__PURE__ */ F("div", { className: "reader-chrome-tray", children: [
      /* @__PURE__ */ v(_c, { active: s }),
      /* @__PURE__ */ v(kl, {}),
      /* @__PURE__ */ v(Ri, { onBeforeClose: o.prepareClose })
    ] }),
    /* @__PURE__ */ v(
      Mc,
      {
        mode: b,
        documentReady: !!o.jobId,
        sourceViewOnly: S,
        onModeChange: y,
        liveTranslation: p.topBarPill ? {
          visible: i,
          state: e.liveTranslation,
          onToggle: () => l((B) => !B)
        } : null
      }
    ),
    /* @__PURE__ */ v(Nc, { active: s }),
    f ? /* @__PURE__ */ v(bl, {}) : null,
    /* @__PURE__ */ v(Pc, { paneComposition: g, markdownSplit: w.open, assistantSplit: f, liveTranslation: e.liveTranslation, sourcePaneAction: M }),
    e.showHud ? /* @__PURE__ */ v(
      Ol,
      {
        mode: b,
        modeControls: null,
        bookmarkScope: e.viewStateKey
      }
    ) : null,
    /* @__PURE__ */ v(Lo, { fallback: null, children: w.mounted ? /* @__PURE__ */ v(Ql, { open: w.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: m }) : null }),
    /* @__PURE__ */ v(Bl, {})
  ] }) });
}
function wu() {
  return /* @__PURE__ */ v(nu, {});
}
export {
  wu as R,
  nu as a,
  vu as d,
  yu as f,
  Su as r,
  Oe as u
};
//# sourceMappingURL=ReaderApp-LrL0Ka3a.js.map
