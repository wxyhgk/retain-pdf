var Fn = (e) => {
  throw TypeError(e);
};
var $n = (e, t, n) => t.has(e) || Fn("Cannot " + n);
var it = (e, t, n) => ($n(e, t, "read from private field"), n ? n.call(e) : t.get(e)), jn = (e, t, n) => t.has(e) ? Fn("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Bn = (e, t, n, r) => ($n(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as z, jsx as y, Fragment as vt } from "react/jsx-runtime";
import { useMemo as Y, useState as N, useEffect as x, useCallback as $, useRef as A, useLayoutEffect as Ae, memo as mn, createContext as hn, useContext as pn, forwardRef as _o, useImperativeHandle as gn, useSyncExternalStore as Lr, useId as Cr, Suspense as No, lazy as Lo } from "react";
import { requireAdapter as at, getReaderAdapters as ye } from "./adapters.js";
import { resolveReaderDownloadName as Co, resolveReaderDownloadUrls as Do, READER_PROGRESS_COPY as Ie, trimString as _t, READER_DOWNLOAD_ACTIONS as zo, disabledReason as xo } from "./runtime/state.js";
import { r as Oo, b as Fo } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as Yt, isFinishedJobStatus as bn } from "@retainpdf/domain/job";
import { c as $o, n as jo, f as Ht, j as Un, a as Bo, b as Uo, h as Dr, p as yn, d as Ho, k as Hn, i as Wo } from "./reader-regions-CP3ZMHPc.js";
import { fetchDocumentReading as Vo } from "@retainpdf/api/documents";
import { isReaderTransportError as Jo, createReaderTransportError as Go } from "./contracts.js";
import { toast as Xt, Toaster as qo } from "sonner";
import { X as vn, Radio as Ko, FileText as zr, Columns2 as xr, Languages as Or, FileCode2 as Zo, Keyboard as Yo, Download as Xo, ChevronDown as Qo, ListTree as ea, Search as ta } from "lucide-react";
import { Button as Oe, Input as na } from "@retainpdf/ui";
import { pdfjs as Fr, Page as ra, Document as oa } from "react-pdf";
import { extractMarkdownMath as aa, materializeMarkdownMathFallbackHtml as sa, materializeMarkdownMathHtml as ia } from "./runtime/content.js";
const ca = (...e) => {
  var t, n;
  return ((n = (t = ye()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, la = "", ua = Object.freeze({
  progress: "retainpdf-reader-progress"
}), da = (e) => {
  var t, n;
  return ((n = (t = ye()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, fu = (...e) => {
  var n;
  return (((n = ye()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Ee = () => at("defaultReaderDataPort"), Wn = () => at("defaultReaderPageConfigPort"), mu = {
  get apiPrefix() {
    return Ee().apiPrefix;
  },
  fetchProtected: (...e) => Ee().fetchProtected(...e),
  loadMarkdownPayload: (e) => Ee().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => Ee().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => Ee().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => Ee().loadJobPayload(e),
  loadReaderPayload: (e, t) => Ee().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => Ee().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return Ee().liveTranslation;
  }
}, $r = {
  messageTargetOrigin: () => Wn().messageTargetOrigin(),
  readerJobId: () => Wn().readerJobId()
}, fa = () => {
  var e;
  return ((e = ye()) == null ? void 0 : e.liveTranslation) ?? null;
}, mt = () => {
  var t;
  const e = ye();
  return (e == null ? void 0 : e.pdf) ?? {
    fetchProtected: (e == null ? void 0 : e.fetchProtected) ?? ((t = e == null ? void 0 : e.defaultReaderDataPort) == null ? void 0 : t.fetchProtected) ?? fetch,
    resolvePdfjsVendorUrl: (n = "") => {
      var r;
      return ((r = e == null ? void 0 : e.resolvePdfjsVendorUrl) == null ? void 0 : r.call(e, n)) ?? "";
    }
  };
}, Ft = () => {
  const e = ye();
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
}, ma = (...e) => {
  var t, n;
  return ((n = (t = ye()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, ha = () => {
  var e, t;
  return ((t = (e = ye()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, pa = (...e) => {
  var t, n;
  return ((n = (t = ye()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, ga = (...e) => {
  var t, n;
  return ((n = (t = ye()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? Co(...e);
}, ba = (...e) => {
  var t, n;
  return ((n = (t = ye()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? Do(...e);
}, ya = (...e) => at("downloadProtectedResource")(...e), va = (...e) => at("failDownloadToast")(...e), hu = (e, t) => at("resolveMarkdownAssetUrl")(e, t), Vn = "/api/v1";
function Sa() {
  const e = () => {
    var r;
    return Oo(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = N(e);
  return x(() => {
    var c, i, l, u;
    const r = () => n(e()), o = (i = (c = globalThis.history) == null ? void 0 : c.pushState) == null ? void 0 : i.bind(globalThis.history), a = (u = (l = globalThis.history) == null ? void 0 : l.replaceState) == null ? void 0 : u.bind(globalThis.history);
    let s = !1;
    if (o && a)
      try {
        const d = (m) => function(...h) {
          const g = m.apply(this, h);
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
function wa() {
  const e = Sa(), t = Y(() => pa($r), [e]), n = Y(() => ha(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
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
  } = e, [i, l] = N({
    documentId: "",
    jobId: ""
  }), [u, d] = N({
    documentId: "",
    jobId: ""
  }), m = i.documentId === t ? i.jobId : "", h = u.documentId === t ? u.jobId : "", g = n || m, [f, v] = N({
    jobId: "",
    documentId: ""
  }), b = f.jobId === g ? f.documentId : "", P = t || b, w = !!t && !g, [p, S] = N(null), T = (p == null ? void 0 : p.sessionIdentity) === r && p.documentId === P ? p : null, _ = w || !!T, O = $((C) => {
    const R = `${C.documentId || ""}`.trim();
    if (!R || a.current && a.current !== R) return;
    if (!a.current && s.current)
      v({
        jobId: s.current,
        documentId: R
      });
    else if (!a.current)
      return;
    const I = `${C.revision || ""}`.trim() || `${Date.now()}`;
    S({
      documentId: R,
      revision: I,
      sessionIdentity: o.current
    }), c();
  }, []);
  x(() => {
    S((C) => C && C.sessionIdentity !== r ? null : C);
  }, [r]);
  const L = $((C) => {
    switch (C.type) {
      case "resolved-document-job":
        l({ documentId: C.documentId, jobId: C.jobId });
        break;
      case "cleared-resolved-document-job":
        l({ documentId: "", jobId: "" });
        break;
      case "missing-document-job":
        d({ documentId: C.documentId, jobId: C.jobId });
        break;
      case "resolved-job-document":
        v((R) => R.jobId === C.jobId && R.documentId === C.documentId ? R : { jobId: C.jobId, documentId: C.documentId });
        break;
      case "committed-source":
        S({
          documentId: C.documentId,
          revision: C.revision,
          sessionIdentity: C.sessionIdentity
        });
        break;
    }
  }, []);
  return {
    resolvedDocumentJob: i,
    setResolvedDocumentJob: l,
    missingDocumentJob: u,
    setMissingDocumentJob: d,
    documentJobId: m,
    rejectedDocumentJobId: h,
    sessionJobId: g,
    resolvedJobDocument: f,
    setResolvedJobDocument: v,
    jobDocumentId: b,
    documentId: P,
    sourceOnly: w,
    committedDocumentSource: p,
    setCommittedDocumentSource: S,
    activeCommittedDocumentSource: T,
    sourceViewOnly: _,
    refreshCommittedDocument: O,
    applyIdentityEvent: L
  };
}
function Jn(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function Ra(e) {
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
  return da(Yt(e, t));
}
function Ia(e, t = "") {
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
    if (a && !Ia(a, t))
      return a.replace(/\.pdf$/i, "");
  }
  return "";
}
function Qt({
  percent: e,
  text: t,
  stage: n
}) {
  var r;
  try {
    (r = window.parent) == null || r.postMessage(
      {
        type: ua.progress,
        stage: n,
        percent: e,
        text: t
      },
      $r.messageTargetOrigin()
    );
  } catch {
  }
}
function Nt(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), Qt({ percent: t, text: n, stage: r });
}
function Ta(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [c, i] = N(null), [l, u] = N(null), [d, m] = N(""), [h, g] = N(0), f = d === n ? c : null, v = d === n ? l : null, b = Jn(f), P = bn(b), w = $(() => {
    g((L) => L + 1);
  }, []), p = $((L) => {
    i(L.jobPayload), u(L.manifestPayload), m(L.sessionIdentity);
  }, []), S = $((L) => {
    i(null), u(null), m(L);
  }, []), T = A(""), _ = A(""), O = $(async () => {
    const L = o.current;
    if (!L || T.current === L) return;
    const C = Ft().loadJobPayload;
    if (typeof C != "function") return;
    const R = a.current.value;
    T.current = L;
    try {
      const I = await C(L);
      if (s.current || a.current.value !== R || o.current !== L || !I || typeof I != "object")
        return;
      const E = Jn(I);
      i(I), m(r.current), E === "succeeded" && _.current !== L && (_.current = L, g((M) => M + 1));
    } catch {
    } finally {
      T.current === L && (T.current = "");
    }
  }, []);
  return x(() => {
    _.current = "";
  }, [n]), x(() => {
    if (!t || P || !f) return;
    const L = window.setInterval(() => {
      document.visibilityState !== "hidden" && O();
    }, 1e3);
    return () => window.clearInterval(L);
  }, [P, O, f, t]), {
    jobPayload: c,
    setJobPayload: i,
    manifestPayload: l,
    setManifestPayload: u,
    payloadSessionIdentity: d,
    setPayloadSessionIdentity: m,
    scopedJobPayload: f,
    scopedManifestPayload: v,
    jobStatus: b,
    jobTerminal: P,
    jobRefreshRevision: h,
    refreshJobArtifacts: w,
    refreshJobStatus: O,
    publishPayload: p,
    clearPayload: S
  };
}
function en(e) {
  document.body.classList.remove(
    "reader-mode-source",
    "reader-mode-translated",
    "reader-mode-compare"
  ), document.body.classList.add(`reader-mode-${e}`);
}
function Ma(e, t) {
  e(t), en(t);
}
function Aa(e) {
  const [t, n] = N(e ? "source" : "compare"), r = $((a) => {
    e && a !== "source" || (n(a), en(a));
  }, [e]), o = $((a) => {
    Ma(n, a);
  }, []);
  return x(() => (e && document.documentElement.classList.add("reader-source-only"), en(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function qn(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function ka(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: qn(n.active_job_id),
    activeVersionId: qn(n.active_version_id)
  };
}
function _a(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Na(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function La(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Ca = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function Da(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Ca.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
const za = 48 * 1024 * 1024;
function xa(e) {
  return e ? "ranged" in e ? e : { data: e.data.slice() } : null;
}
const Oa = 2, he = /* @__PURE__ */ new Map();
function tn(e, t) {
  he.delete(e), he.set(e, t);
}
function Kn(e) {
  if (he.size < Oa) return;
  const t = he.keys().next().value;
  t && he.delete(t);
}
async function Fa(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function jr(e, t = mt().fetchProtected, n = {}) {
  var u, d, m, h, g, f, v, b, P;
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (he.has(r)) {
    const w = he.get(r);
    return tn(r, w), w;
  }
  const o = new AbortController(), a = () => o.abort();
  (u = n.signal) != null && u.aborted && o.abort(), (m = (d = n.signal) == null ? void 0 : d.addEventListener) == null || m.call(d, "abort", a, { once: !0 });
  let s;
  try {
    s = await t(r, { signal: o.signal });
  } finally {
    (g = (h = n.signal) == null ? void 0 : h.removeEventListener) == null || g.call(h, "abort", a);
  }
  if (!s.ok) {
    const w = new Error(`读取 PDF 失败 (${s.status})`);
    w.status = s.status;
    const p = await Fa(s);
    throw p && (w.reason = p), w;
  }
  const c = $a(r, s, t);
  if (c) {
    o.abort();
    const w = { ranged: c };
    return Kn(), he.set(r, w), w;
  }
  (v = (f = n.signal) == null ? void 0 : f.addEventListener) == null || v.call(f, "abort", a, { once: !0 });
  let i;
  try {
    i = await s.arrayBuffer();
  } finally {
    (P = (b = n.signal) == null ? void 0 : b.removeEventListener) == null || P.call(b, "abort", a);
  }
  const l = { data: new Uint8Array(i) };
  return he.has(r) ? tn(r, l) : (Kn(), he.set(r, l)), l;
}
function $a(e, t, n) {
  const r = t.headers;
  if (!r || typeof r.get != "function") return null;
  const o = Number(r.get("content-length") || 0), a = `${r.get("accept-ranges") || ""}`.toLowerCase().includes("bytes"), s = `${r.get("content-encoding") || ""}`.trim();
  return !a || s || !Number.isFinite(o) || o < za ? null : {
    url: e,
    length: o,
    async fetchRange(c, i) {
      const l = await n(e, { headers: { Range: `bytes=${c}-${i - 1}` } });
      if (l.status !== 206) throw new Error(`读取 PDF 片段失败 (${l.status})`);
      return new Uint8Array(await l.arrayBuffer());
    }
  };
}
const ja = { file: null, loading: !1, error: "" }, Ba = { file: null, loading: !0, error: "" };
function Ua(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = N(null);
  if (x(() => {
    if (t || !n) return;
    const s = he.get(n);
    if (s) {
      tn(n, s);
      return;
    }
    const c = new AbortController();
    return jr(n, void 0, { signal: c.signal }).then((i) => {
      c.signal.aborted || o({ url: n, file: i, loading: !1, error: "" });
    }).catch((i) => {
      c.signal.aborted || o({ url: n, file: null, loading: !1, error: (i == null ? void 0 : i.message) || String(i) });
    }), () => c.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return ja;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = he.get(n);
  return a ? { file: a, loading: !1, error: "" } : Ba;
}
function Ha(e) {
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
async function nn(e) {
  const { url: t, label: n, percentStart: r, percentEnd: o, fence: a, setBoot: s } = e;
  if (!t || a.isInactive())
    return null;
  Nt(s, r, n, "download");
  const c = await jr(t, mt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (Nt(s, o, n, "download"), c);
}
async function Wa(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  Nt(o, 25, "正在下载 PDF…", "download");
  const a = [];
  let s = null, c = null;
  return t && a.push(
    nn({
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
    nn({
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
function Va(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Ja({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = Vo,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(Va(o.href, t, a)), !0);
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
    clearPayload: m,
    switchSessionMode: h,
    jobRefreshRevision: g,
    sessionEpochRef: f,
    closingRef: v,
    activeLoadAbortRef: b
  } = e, [P, w] = N(""), [p, S] = N(""), [T, _] = N(null), [O, L] = N(null), [C, R] = N(!1), [I, E] = N(""), [M, F] = N([]), [K, D] = N(!1), [G, U] = N(() => ({
    source: null,
    translated: null
  })), [V, ne] = N(
    It
  ), [me, re] = N({
    loading: !0,
    percent: 4,
    text: Ie.boot,
    stage: "progress",
    failed: !1
  });
  return x(() => {
    const oe = new AbortController(), j = f.current.value, B = Ha({
      sessionEpochRef: f,
      closingRef: v,
      abort: oe,
      sessionEpoch: j
    });
    b.current = oe;
    const Z = Ft();
    if (v.current)
      return oe.abort(), () => {
        b.current === oe && (b.current = null);
      };
    let pe = !1;
    function ae(te, le) {
      B.markFailed(), D(!0), re({
        loading: !1,
        percent: 100,
        text: te,
        stage: "failed",
        failed: !0
      }), Qt({ percent: 100, text: le, stage: "failed" });
    }
    function Pe() {
      R(!0), pe || D(!0), re({
        loading: !1,
        percent: 100,
        text: Ie.ready,
        stage: "ready",
        failed: !1
      }), Qt({ percent: 100, text: Ie.ready, stage: "ready" });
    }
    function ke() {
      return l != null && l.documentId ? Gn(
        l.documentId,
        l.revision
      ) : ca() ? la : Z.resolveResourceUrl(Yt(r));
    }
    async function Re() {
      var ue;
      let te = { activeJobId: "", activeVersionId: "" };
      try {
        const ie = await ((ue = Z.fetchDocument) == null ? void 0 : ue.call(Z, r));
        ie && (te = ka(ie));
      } catch {
      }
      const le = _a({
        link: te,
        rejectedDocumentJobId: a,
        hasCommittedSource: !!l
      });
      if (le.kind === "follow-active-job") {
        if (B.isInactive()) return;
        u({
          type: "resolved-document-job",
          documentId: r,
          jobId: le.jobId
        }), le.activeVersionId ? (l || u({
          type: "committed-source",
          documentId: r,
          revision: le.activeVersionId,
          sessionIdentity: i
        }), h("source")) : h("compare");
        return;
      }
      if (le.kind === "open-committed-source") {
        if (B.isInactive()) return;
        u({
          type: "committed-source",
          documentId: r,
          revision: le.revision,
          sessionIdentity: i
        }), h("source");
        return;
      }
      const ge = ke();
      if (B.isInactive()) return;
      w(ge), S(""), E(""), m(i);
      const se = await nn({
        url: ge,
        label: "正在下载原文 PDF…",
        percentStart: 30,
        percentEnd: 85,
        fence: B,
        setBoot: re
      });
      if (!B.isInactive()) {
        if (!se) {
          ae("源文件不可用：该文档没有可读取的源 PDF。", "源文件下载失败");
          return;
        }
        _(se), Pe();
      }
    }
    async function Je() {
      var J;
      const te = !l, le = !!(te && Z.loadSessionSnapshot && Z.loadReaderOptionalArtifacts), ge = le ? Z.loadReaderOptionalArtifacts(t) : null, se = await ((J = Z.loadSessionSnapshot) == null ? void 0 : J.call(Z, {
        jobId: t,
        documentId: r,
        routeDocumentId: r,
        committedSource: l,
        includeOptionalArtifacts: te && !le
      })), ue = se ? {
        jobPayload: se.sourcePayload,
        manifestPayload: se.manifestPayload,
        readerMetadata: se.readerMetadata,
        regionsPayload: se.regions,
        readerErrors: se.readerErrors
      } : await Z.loadReaderPayload(t, {
        includeOptionalArtifacts: te
      });
      if (B.isInactive()) return;
      let ie = null;
      if (n && !r)
        if (se && se.linkedDocument !== void 0)
          ie = se.linkedDocument;
        else {
          try {
            ie = await Z.fetchDocumentByJobId(Vn, t);
          } catch {
          }
          if (B.isInactive()) return;
        }
      const qe = Ra(ue.jobPayload) || `${(ie == null ? void 0 : ie.document_id) || ""}`.trim();
      qe && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: qe
      });
      const Ke = Na({
        payloadDocumentId: qe,
        linkedActiveJobId: `${(ie == null ? void 0 : ie.active_job_id) || ""}`.trim(),
        linkedActiveVersionId: `${(ie == null ? void 0 : ie.active_version_id) || ""}`.trim(),
        sessionJobId: t,
        hasCommittedSource: !!l
      });
      if (Ke.kind === "restore-committed-source") {
        if (B.isInactive()) return;
        u({
          type: "committed-source",
          documentId: Ke.documentId,
          revision: Ke.revision,
          sessionIdentity: i
        }), h("source");
        return;
      }
      const st = Z.resolveReaderSourcePdf(ue.manifestPayload), Bt = Z.resolveReaderTranslatedPdfUrl(ue.jobPayload, ue.manifestPayload), Ut = typeof st == "string" ? st : Z.resolveReaderArtifactUrl(st), _e = r || qe, Ne = l != null && l.documentId ? Gn(
        l.documentId,
        l.revision
      ) : Ut || (_e ? Z.resolveResourceUrl(Yt(_e)) : ""), ze = l ? "" : Bt || "";
      w(Ne || ""), S(ze), E(Ea(ue.jobPayload, t)), d({
        jobPayload: ue.jobPayload || null,
        manifestPayload: ue.manifestPayload || null,
        sessionIdentity: i
      });
      const wt = () => Wa({
        sourceFinal: Ne || "",
        translatedFinal: ze,
        fence: B,
        setBoot: re
      }), Pt = !!(Ne || ze), Ze = ge && Pt ? wt() : null;
      Ze == null || Ze.catch(() => {
      });
      const Rt = (W) => {
        B.isInactive() || (F(l ? [] : $o(W.regionsPayload)), U(l ? { source: null, translated: null } : jo(W.readerMetadata)), ne(l ? It : W.readerErrors ?? It), D(!0));
      };
      if (ge ? (pe = !0, ge.then(Rt)) : Rt(ue), !Pt) {
        ae(Ie.failed, Ie.failed);
        return;
      }
      const k = await (Ze ?? wt());
      if (k.status !== "inactive") {
        if (k.status === "incomplete") {
          ae("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        _(k.sourceBytes), L(k.translatedBytes), Pe();
      }
    }
    async function Ge() {
      R(!1), _(null), L(null), F([]), D(!1), U({ source: null, translated: null }), ne(It), Nt(re, 8, Ie.metadata, "metadata");
      try {
        if (s) {
          await Re();
          return;
        }
        if (!t) {
          ae(Ie.failed, Ie.failed);
          return;
        }
        await Je();
      } catch (te) {
        if (B.isClosedOrStale() || (te == null ? void 0 : te.name) === "AbortError") return;
        B.markFailed();
        const le = Number(te == null ? void 0 : te.status), ge = `${(te == null ? void 0 : te.reason) || ""}`, se = Da({ status: le, reason: ge, sessionJobId: t });
        if (se && (await Ja({
          apiPrefix: Vn,
          documentId: se,
          expiredJobId: t
        }) || B.isClosedOrStale()))
          return;
        if (La({
          status: le,
          reason: ge,
          jobId: n,
          routeDocumentId: r,
          documentJobId: o,
          sessionJobId: t
        })) {
          u({ type: "missing-document-job", documentId: r, jobId: t }), u({ type: "cleared-resolved-document-job" }), h("source");
          return;
        }
        const ue = te instanceof Error ? te.message : Ie.failed;
        ae(ue, ue);
      }
    }
    return Ge(), () => {
      oe.abort(), b.current === oe && (b.current = null);
    };
  }, [t, r, o, a, s, c, l, g, n, i, u, d, m, h]), {
    sourceUrl: P,
    translatedUrl: p,
    sourceFile: T,
    translatedFile: O,
    assetsReady: C,
    title: I,
    regions: M,
    regionsSettled: K,
    readerMetadata: G,
    readerErrors: V,
    boot: me
  };
}
function qa() {
  const e = A(!1), t = A(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = wa(), s = A({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const c = A(a), i = A(""), l = A(""), u = A(() => {
  }), d = $(() => u.current(), []), m = Pa({
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
    sourceOnly: f,
    sourceViewOnly: v
  } = m, { mode: b, setMode: P, switchSessionMode: w } = Aa(v);
  u.current = () => {
    w("source");
  }, c.current = a, i.current = g, l.current = h;
  const p = Ta({
    sessionJobId: h,
    sessionIdentity: a,
    sessionIdentityRef: c,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: S,
    scopedManifestPayload: T,
    jobStatus: _,
    jobTerminal: O,
    jobRefreshRevision: L,
    refreshJobArtifacts: C,
    refreshJobStatus: R
  } = p, I = Ga({
    sessionJobId: h,
    jobId: r,
    routeDocumentId: o,
    documentJobId: m.documentJobId,
    rejectedDocumentJobId: m.rejectedDocumentJobId,
    sourceOnly: f,
    locationKey: n,
    sessionIdentity: a,
    committedSource: m.activeCommittedDocumentSource,
    applyIdentityEvent: m.applyIdentityEvent,
    publishPayload: p.publishPayload,
    clearPayload: p.clearPayload,
    switchSessionMode: w,
    jobRefreshRevision: L,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), E = $(() => {
    var F;
    e.current = !0, (F = t.current) == null || F.abort();
  }, []), M = Y(
    () => ({
      fetchProtected: Ft().fetchProtected,
      jobId: h,
      jobPayload: S,
      manifestPayload: T,
      sourceUrl: I.sourceUrl,
      translatedUrl: I.translatedUrl,
      sourceOnly: v
    }),
    [h, S, T, I.sourceUrl, I.translatedUrl, v]
  );
  return {
    jobId: h,
    jobStatus: _,
    workflow: `${(S == null ? void 0 : S.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: O,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: f,
    mode: b,
    setMode: P,
    sourceUrl: I.sourceUrl,
    translatedUrl: I.translatedUrl,
    sourceFile: I.sourceFile,
    translatedFile: I.translatedFile,
    assetsReady: I.assetsReady,
    boot: I.boot,
    title: I.title,
    regions: I.regions,
    regionsSettled: I.regionsSettled,
    readerMetadata: I.readerMetadata,
    readerErrors: I.readerErrors,
    download: M,
    refreshJobArtifacts: C,
    refreshJobStatus: R,
    refreshCommittedDocument: m.refreshCommittedDocument,
    prepareClose: E
  };
}
const Ka = 160, Za = 8, Ya = 0;
function Xa() {
  const e = A(null), [t, n] = N(null), [r, o] = N(Ya), a = $((s) => {
    e.current = s, n(s);
  }, []);
  return x(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const c = (l) => {
      !Number.isFinite(l) || l < Ka || o((u) => Math.abs(u - l) < Za ? u : l);
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
function Qa(e) {
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
const Wt = { source: 0, translated: 0 };
function es(e, t) {
  const {
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    sourceUrl: a,
    translatedUrl: s,
    sourceFile: c,
    translatedFile: i
  } = e, l = `${(t == null ? void 0 : t.identityKey) || ""}\0${a}\0${s}`, u = A(l);
  u.current = l;
  const [d, m] = N(() => ({
    identity: l,
    pages: Wt
  })), [h, g] = N(() => ({ identity: l, tick: 0 })), f = d.identity === l ? d.pages : Wt, v = h.identity === l ? h.tick : 0, b = Qa({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!c || !!a,
    hasTranslated: !!i
  }), { primaryPane: P } = b, w = $((R, I) => {
    u.current === l && m((E) => {
      const M = E.identity === l ? E.pages : Wt;
      return M[I] === R && E.identity === l ? E : {
        identity: l,
        pages: { ...M, [I]: R }
      };
    });
  }, [l]), p = A(null), S = $(() => {
    p.current && clearTimeout(p.current);
    const R = l;
    p.current = setTimeout(() => {
      p.current = null, u.current === R && g((I) => ({
        identity: R,
        tick: I.identity === R ? I.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  x(() => (p.current && (clearTimeout(p.current), p.current = null), m((R) => R.identity === l && R.pages.source === 0 && R.pages.translated === 0 ? R : { identity: l, pages: { source: 0, translated: 0 } }), g((R) => R.identity === l && R.tick === 0 ? R : { identity: l, tick: 0 }), () => {
    p.current && (clearTimeout(p.current), p.current = null);
  }), [l]);
  const T = Y(
    () => Math.max(f.source, f.translated),
    [f]
  ), _ = P === "translated" ? f.translated : f.source || f.translated, O = t == null ? void 0 : t.userZoom, L = t == null ? void 0 : t.shellWidth, C = `${l}-${v}-${O}-${n}-${f.source}-${f.translated}-${L}`;
  return {
    ...b,
    numPagesByPane: f,
    hudNumPages: T,
    primaryNumPages: _,
    metricsTick: v,
    onNumPages: w,
    onMetrics: S,
    rowSyncRevision: C
  };
}
const je = "data-reader-page", rt = "data-reader-pane", Sn = "data-natural-height", ts = "reader-react-root", ns = "reader-react-grid", rs = "reader-react-scroll-shell", os = "reader-react-pdf-pane", Br = "reader-react-pdf-page", Lt = "reader-react-pdf-page-placeholder", wn = "reader-react-pdf-page-slot";
function Ct(e, t) {
  const n = e != null ? `[${je}="${e}"]` : `[${je}]`;
  return t ? `${n}[${rt}="${t}"]` : n;
}
function as() {
  return `.${wn}[${je}]`;
}
function Dt(e) {
  return Number(e.getAttribute(je));
}
const Ur = 0.25, zt = 1, ss = 0.05, St = 0.5, is = 16, cs = 8, ls = 720;
function $e() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function Hr(e) {
  return Number.isFinite(e) && e < ls;
}
function Qe(e, t = Number.POSITIVE_INFINITY) {
  return Hr(t) && (e === "source" || e === "translated") ? zt : St;
}
function $t(e) {
  return Number.isFinite(e) ? Math.min(zt, Math.max(Ur, e)) : St;
}
function ht(e, t) {
  const n = $t(Number(e) + t * ss);
  return Math.round(n * 100) / 100;
}
function us(e) {
  return Math.round($t(e) * 100);
}
function ds(e) {
  const n = (Number(e) || 0) - is - cs;
  return Math.max(160, Math.floor(n));
}
function fs(e, t = St) {
  const n = $t(t);
  return ds((Number(e) || 0) * n);
}
function ms(e, t) {
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
const hs = 8;
function ps(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < hs ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const Wr = 200, Vr = [
  "markdown"
], gs = Vr;
function Jr(e) {
  return gs.includes(e);
}
const bs = "retainpdf:reader:view:v1:", Zn = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), ys = /* @__PURE__ */ new Set([
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
function rn(e) {
  return `${e || ""}`.trim();
}
function vs({
  documentId: e,
  jobId: t
}) {
  const n = rn(e);
  if (n) return `document:${n}`;
  const r = rn(t);
  return r ? `job:${r}` : "";
}
function qr(e) {
  const t = rn(e);
  return t ? `${bs}${t}` : "";
}
function Ss(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function ws(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!Zn.has(t) || !Zn.has(n) || t === n))
    return { left: t, right: n };
}
function Ps(e) {
  return e === null ? null : Jr(e) ? e : void 0;
}
function Rs(e) {
  return ys.has(e) ? e : void 0;
}
function Kr(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = Ss(t.anchor), r = Number(t.zoom), o = Rs(t.mode), a = ws(t.splitLayout), s = Ps(t.assistantPanel);
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
function we(e, t = Gr()) {
  const n = qr(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? Kr(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function jt(e, t, n = Gr()) {
  const r = qr(e);
  if (!r || !n) return null;
  const o = we(e, n), a = Kr({
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
function Is(e, t, n = "") {
  var m;
  const [r, o] = N(() => {
    var h;
    return ((h = we(n)) == null ? void 0 : h.zoom) ?? Qe(e, $e());
  }), a = A(r), s = A(n);
  a.current = r;
  const c = A(1), i = A(((m = we(n)) == null ? void 0 : m.zoom) !== void 0);
  x(() => {
    var f;
    if (s.current === n) return;
    s.current = n;
    const h = (f = we(n)) == null ? void 0 : f.zoom;
    i.current = h !== void 0;
    const g = h ?? Qe(e, $e());
    c.current = 1, a.current = g, o(g);
  }, [e, n]), x(() => {
    if (i.current) return;
    const h = Qe(e, $e()), g = a.current;
    Math.abs(h - g) < 5e-4 || (c.current = 1, a.current = h, o(h));
  }, [e]);
  const l = $((h) => {
    const g = $t(h), f = a.current;
    Math.abs(g - f) < 5e-4 || (c.current = g / (f || 1), i.current = !0, jt(s.current, { zoom: g }), o(g));
  }, []), u = $((h) => {
    l(ht(a.current, h));
  }, [l]), d = $((h) => {
    l(Qe(h));
  }, [l]);
  return Ae(() => {
    const h = c.current;
    Math.abs(h - 1) < 1e-3 || (c.current = 1, ms(t == null ? void 0 : t.current, h));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: d };
}
function Es(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = A(t), a = A(n), s = A(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: $((i) => {
    i !== o.current && (s.current(), a.current(i));
  }, []) };
}
const Pn = 48;
function Zr(e, t = Pn) {
  return e.getBoundingClientRect().top + t;
}
function Yr(e, t) {
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
  const o = Dt(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, c = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: c };
}
function At(e, t, n = Pn) {
  if (!e)
    return null;
  const r = Ct(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = Zr(e, n), c = Yr(o, s);
  return c ? { page: c.page, fraction: c.fraction } : null;
}
function pt(e, t, n = "auto", r, o = Pn) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let c = null;
  if (r && (c = e.querySelector(Ct(a, r))), c || (c = e.querySelector(Ct(a))), !c)
    return !1;
  const i = e.getBoundingClientRect(), l = c.getBoundingClientRect();
  if (i.height <= 0 || l.height < 8 && c.offsetHeight < 8)
    return !1;
  const u = l.height > 0 ? l.height : c.offsetHeight, d = e.scrollTop + (l.top - i.top), m = Math.max(0, d + s * u - o);
  return n === "auto" ? Math.abs(e.scrollTop - m) >= 1 && (e.scrollTop = m) : e.scrollTo({ top: m, behavior: n }), !0;
}
function Ts(e, t, n = "smooth", r) {
  return pt(
    e,
    { page: t, fraction: 0 },
    n,
    r
  );
}
function on(e, t, n) {
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
function Ms(e, t, n) {
  return on(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function xt(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function be(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function As(e, t, n = !0, r = "", o) {
  const [a, s] = N(1);
  return x(() => {
    if (!n || t <= 0) {
      s(1);
      return;
    }
    const c = e.current;
    if (!c)
      return;
    let i = !1, l = null, u = 0;
    const d = Ct(void 0, o), m = () => {
      if (i) return;
      const f = Array.from(c.querySelectorAll(d));
      if (!f.length)
        return;
      const v = Zr(c), b = Yr(f, v);
      b && s(b.page);
    }, h = () => {
      i || (u && cancelAnimationFrame(u), u = requestAnimationFrame(() => {
        u = 0, m();
      }));
    }, g = () => {
      if (i) return;
      if (!Array.from(c.querySelectorAll(d)).length) {
        l = setTimeout(g, 120);
        return;
      }
      m(), c.addEventListener("scroll", h, { passive: !0 });
    };
    return g(), () => {
      i = !0, l && clearTimeout(l), u && cancelAnimationFrame(u), c.removeEventListener("scroll", h);
    };
  }, [e, t, n, r, o]), a;
}
const ks = `canvas, .react-pdf__Page, .${Br}, .${Lt}`, Yn = /* @__PURE__ */ new WeakMap();
function _s(e) {
  const t = Number(e.getAttribute(Sn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Yn.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(ks), Yn.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function Ns(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function Ls(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(as()).forEach((r) => {
    const o = Dt(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = _s(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function Cs(e, t, n = "", r) {
  const [o, a] = N(() => /* @__PURE__ */ new Map()), s = A(o), c = A(r);
  return c.current = r, Ae(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let i = !1, l = 0, u = !1, d = !1;
    const m = () => {
      var S;
      if (i) return;
      const w = e.current;
      if (!w) return;
      const p = Ls(w);
      Ns(s.current, p) || (s.current = p, a(p)), u && !d && (d = !0, (S = c.current) == null || S.call(c));
    }, h = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(m);
      });
    };
    h();
    const g = window.setTimeout(h, 100), f = window.setTimeout(() => {
      u = !0, h();
    }, 300), v = window.setTimeout(h, 700), b = e.current;
    let P = null;
    return b && typeof ResizeObserver < "u" && (P = new ResizeObserver(() => h()), P.observe(b)), () => {
      i = !0, cancelAnimationFrame(l), window.clearTimeout(g), window.clearTimeout(f), window.clearTimeout(v), P == null || P.disconnect();
    };
  }, [e, t, n]), o;
}
const Ds = [0, 48, 140, 320, 560], zs = 700, xs = [80, 200, 400], Os = 500, Fs = 50, $s = /* @__PURE__ */ new Set([
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
]), js = 180, Xn = [0, 48, 140, 320, 700, 1200];
function Bs(e, t) {
  var I;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, c = A(
    ((I = we(a)) == null ? void 0 : I.anchor) || { page: 1, fraction: 0 }
  ), i = A(null), l = A(!1), u = A(r), d = A(null), m = A(null), h = A(null), g = A(null), f = A(a), v = A(""), b = A(n);
  b.current = n;
  const P = $(() => {
    var E;
    (E = d.current) == null || E.call(d), d.current = null, m.current != null && (clearTimeout(m.current), m.current = null);
  }, []), w = $(() => {
    !l.current && i.current == null || (P(), h.current != null && (clearTimeout(h.current), h.current = null), i.current = null, l.current = !1);
  }, [P]), p = $((E = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const M = () => {
      g.current = null, jt(f.current, {
        anchor: be(c.current)
      });
    };
    E ? M() : g.current = setTimeout(M, js);
  }, []), S = $((E) => {
    c.current = be(E), i.current = null, h.current != null && clearTimeout(h.current), h.current = setTimeout(() => {
      h.current = null, l.current = !1;
    }, Fs);
  }, []);
  x(() => {
    if (!o)
      return;
    let E = !1, M = null, F = null, K = null;
    const D = () => {
      if (E) return;
      const G = e.current;
      if (!G) {
        K = setTimeout(D, 50);
        return;
      }
      M = G, F = () => {
        if (l.current)
          return;
        const U = At(M, b.current);
        U && (c.current = U, p());
      }, M.addEventListener("scroll", F, { passive: !0 }), l.current || F();
    };
    return D(), () => {
      E = !0, K != null && clearTimeout(K), M && F && M.removeEventListener("scroll", F);
    };
  }, [o, r, n, e, p]), x(() => {
    if (!o) return;
    const E = e.current;
    if (!E) return;
    const M = (F) => {
      F.metaKey || F.ctrlKey || F.altKey || $s.has(F.key) && w();
    };
    return E.addEventListener("wheel", w, { passive: !0 }), E.addEventListener("touchmove", w, { passive: !0 }), window.addEventListener("keydown", M), () => {
      E.removeEventListener("wheel", w), E.removeEventListener("touchmove", w), window.removeEventListener("keydown", M);
    };
  }, [o, e, w]), Ae(() => {
    var M;
    if (f.current === a) return;
    p(!0), P(), h.current != null && (clearTimeout(h.current), h.current = null), f.current = a, v.current = "";
    const E = (M = we(a)) == null ? void 0 : M.anchor;
    c.current = E ? be(E) : { page: 1, fraction: 0 }, i.current = null, l.current = !!a, u.current = r;
  }, [a, r, p, P]), x(() => {
    var M;
    if (!o || !s || !a || v.current === a) return;
    v.current = a;
    const E = be(
      ((M = we(a)) == null ? void 0 : M.anchor) || { page: 1, fraction: 0 }
    );
    return c.current = E, i.current = E, l.current = !0, P(), d.current = on(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: b.current,
        delaysMs: Xn,
        onDone: () => S(E)
      }
    ), m.current = setTimeout(() => {
      m.current = null, S(E);
    }, Math.max(...Xn) + 160), () => P();
  }, [o, s, a, e, S, P]), x(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, i.current = null, P();
      return;
    }
    const E = i.current ? be(i.current) : be(c.current);
    return l.current = !0, i.current = E, c.current = E, P(), d.current = on(
      () => e.current,
      E,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Ds,
        onDone: () => S(E)
      }
    ), m.current = setTimeout(() => {
      m.current = null, S(E);
    }, zs), () => {
      P();
    };
  }, [r, o, n, e, S, P]), x(() => () => {
    P(), h.current != null && (clearTimeout(h.current), h.current = null), p(!0);
  }, [P, p]);
  const T = $(() => {
    const E = At(
      e.current,
      b.current
    );
    return be(E || c.current);
  }, [e]), _ = $(() => {
    l.current = !0;
    const E = At(
      e.current,
      b.current
    ), M = be(E ?? c.current);
    return c.current = M, i.current = M, p(), M;
  }, [e, p]), O = $((E, M, F) => {
    const K = F || b.current, D = xt(E, M || 1), G = { page: D, fraction: 0 };
    c.current = G, l.current = !0, i.current = G, p(), P(), Ts(e.current, D, "smooth", K), d.current = Ms(
      () => e.current,
      D,
      {
        behavior: "auto",
        pane: K,
        delaysMs: xs,
        onDone: () => S(G)
      }
    ), m.current = setTimeout(() => {
      m.current = null, S(G);
    }, Os);
  }, [e, S, P, p]), L = $(() => be(c.current), []), C = $(() => l.current, []), R = $(() => {
    if (!l.current || !i.current)
      return;
    const E = be(i.current);
    pt(
      e.current,
      E,
      "auto",
      b.current
    );
  }, [e]);
  return {
    lockFromShell: T,
    beginModeSwitch: _,
    goToPage: O,
    getAnchor: L,
    isRestoring: C,
    repinIfRestoring: R
  };
}
function Us(e, t) {
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
function Xr(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const Hs = [0, 80, 200, 400, 800], Ws = 120, Vs = 400;
function Js(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: c, jobId: i, documentId: l, regionsSettled: u = !0 } = e, d = A(a);
  d.current = a;
  const m = A(s);
  m.current = s;
  const h = A(c);
  h.current = c;
  const g = A(n);
  g.current = n, x(() => {
    var p, S;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const f = ma(), v = Us(f, m.current);
    if (v == null && (f != null && f.blockId) && !u) return;
    const b = Xr(f, v, { jobId: i, documentId: l });
    if (t.current === b)
      return;
    if (v == null) {
      t.current = b, (p = g.current) == null || p.call(g);
      return;
    }
    t.current = b, f && ((S = h.current) == null || S.call(h, f, v));
    const P = [];
    let w = 0;
    for (const T of Hs)
      w = Math.max(w, T), P.push(
        setTimeout(() => {
          d.current(v);
        }, T)
      );
    return P.push(
      setTimeout(() => {
        var T;
        (T = g.current) == null || T.call(g);
      }, w + Ws)
    ), () => {
      for (const T of P) clearTimeout(T);
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
function qs(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = Vs,
    jobId: c,
    documentId: i,
    applyReaderSearch: l
  } = e, u = A(a);
  u.current = a;
  const d = A(l);
  d.current = l;
  const m = A(0);
  x(() => {
    if (!n || !r || !t.current || !Number.isFinite(o) || o < 1 || m.current === o) return;
    const h = setTimeout(() => {
      var b;
      const g = ((b = globalThis.location) == null ? void 0 : b.search) || "", f = Fo(g, o, u.current);
      if (m.current = o, f === null) return;
      const v = `${new URLSearchParams(f).get("block_id") || ""}`.trim();
      t.current = Xr(
        { blockId: v },
        o,
        { jobId: c, documentId: i }
      ), (d.current || Gs)(f);
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
function Ks(e) {
  const t = A(""), [n, r] = N(!1), o = $(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  Js(a, t, o), qs(e, t, n);
}
const ct = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function Zs(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function Qn(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function Qr(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = Qn(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = Qn(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function Ys(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = Qr(r, t, n);
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
function Xs(e) {
  const { hasOverlayContent: t, connection: n, showSource: r } = e;
  return {
    topBarPill: t && n !== "terminal",
    sourcePaneToggle: t && r,
    // 和 resolveReaderPaneComposition 的 overlayOnSource 同一套条件，外加
    // 「源文栏得在台面上」——否则叠层没有落脚的地方。
    overlayRenderable: t && r && e.liveTranslationVisible && !e.assistantOpen
  };
}
const er = [250, 500, 1e3, 2e3, 4e3], Vt = [80, 160, 320, 640, 1e3, 1500], tr = [250, 500, 1e3, 2e3, 4e3, 5e3];
function an(e, t) {
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
function Rn(e) {
  return Jo(e) ? `${e.code || ""}`.trim() : "";
}
function Et(e, t) {
  const n = Rn(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function Qs(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const i = await o.fetchPage(e, t.page_idx, { signal: r });
      if (Qr(n.pagesByPage.get(t.page_idx), t, i) !== "retry")
        return i;
      a = Go(
        "Authoritative page snapshot has not reached the event generation",
        409,
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      );
    } catch (i) {
      if ((i == null ? void 0 : i.name) === "AbortError") throw i;
      a = i;
      const l = Rn(i);
      if (l && ![
        "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
        "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE"
      ].includes(l)) throw i;
    }
    const c = Vt[Math.min(s, Vt.length - 1)];
    if (await an(c, r), s >= Vt.length + 2) throw a;
  }
}
function ei({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = N(ct), s = A(o), c = A("");
  s.current = o;
  const i = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = bn(l) ? l : "";
  return x(() => {
    if (!n || !i) {
      c.current = "", s.current = ct, a(ct);
      return;
    }
    const d = r === void 0 ? fa() : r, m = c.current === i;
    if (c.current = i, !d) {
      const w = {
        ...m ? s.current : ct,
        connection: u ? "terminal" : "unavailable",
        jobStatus: l,
        error: "实时译文暂不可用"
      };
      s.current = w, a(w);
      return;
    }
    const h = new AbortController();
    let g = !1;
    const f = {
      ...m ? s.current : ct,
      connection: u ? "terminal" : "connecting",
      jobStatus: l,
      error: ""
    };
    s.current = f, a(f);
    const v = (w) => {
      h.signal.aborted || a((p) => {
        const S = w(p);
        return s.current = S, S;
      });
    }, b = async () => {
      let w = 0;
      for (; !h.signal.aborted; )
        try {
          const p = await d.fetchLayout(i, { signal: h.signal });
          g = !0, v((S) => ({
            ...S,
            layoutByPage: Zs(p),
            jobStatus: l,
            error: ""
          }));
          return;
        } catch (p) {
          if ((p == null ? void 0 : p.name) === "AbortError") return;
          const S = Rn(p);
          if (!(S === "LIVE_TRANSLATION_LAYOUT_NOT_READY" || !S)) {
            v((_) => ({
              ..._,
              connection: u ? "terminal" : "unavailable",
              jobStatus: l,
              error: Et(p, "实时译文暂不可用")
            }));
            return;
          }
          if (u) {
            v((_) => ({
              ..._,
              connection: "terminal",
              jobStatus: l,
              error: ""
            }));
            return;
          }
          v((_) => ({
            ..._,
            connection: "connecting",
            jobStatus: l,
            error: Et(p, "正在等待 OCR 版面数据")
          })), await an(er[Math.min(w, er.length - 1)], h.signal).catch(() => {
          }), w += 1;
        }
    };
    return (async () => {
      if (await b(), !g || h.signal.aborted) return;
      let w = 0;
      for (; !h.signal.aborted; ) {
        u || v((p) => ({
          ...p,
          connection: p.lastSeq > 0 ? "reconnecting" : "connecting",
          jobStatus: l,
          // 保留已有错误：首页还没提交（lastSeq 为 0）时恰恰是最容易出错的阶段，
          // 此前这里把它清成空串，UI 于是一直显示「连接中」，用户看到的是
          // "正在努力"，实际可能已经在反复失败。
          error: p.error
        }));
        try {
          await d.streamEvents(i, {
            afterSeq: s.current.lastSeq,
            signal: h.signal,
            onEvent: async (p) => {
              if (p.seq <= s.current.lastSeq) return;
              let S;
              try {
                S = await Qs(
                  i,
                  p,
                  s.current,
                  h.signal,
                  d
                );
              } catch (T) {
                if ((T == null ? void 0 : T.name) === "AbortError" || h.signal.aborted) throw T;
                v((_) => ({
                  ..._,
                  lastSeq: Math.max(_.lastSeq, p.seq),
                  error: Et(T, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              v((T) => {
                const _ = Ys(T, p, S);
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
        } catch (p) {
          if ((p == null ? void 0 : p.name) === "AbortError" || h.signal.aborted) return;
          v((S) => ({
            ...S,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: l,
            error: Et(p, "实时译文连接已中断，正在重连")
          }));
        }
        if (h.signal.aborted) return;
        if (u) {
          v((p) => ({
            ...p,
            connection: "terminal",
            jobStatus: l
          }));
          return;
        }
        await an(tr[Math.min(w, tr.length - 1)], h.signal).catch(() => {
        }), w += 1;
      }
    })(), () => h.abort();
  }, [n, r, i, u]), o;
}
function ti(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, c = `${s.value ?? ""}`.trim(), i = Number(s.count) || 0;
    c && i > 0 && o.set(c, i);
  }
  return o;
}
function ni(e, t = !0) {
  const [n, r] = N(() => /* @__PURE__ */ new Map());
  return x(() => {
    r((c) => c.size ? /* @__PURE__ */ new Map() : c);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = Ft().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((c) => {
      !s && c && r(ti(c));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const ri = 4500;
function oi(e) {
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
const ai = /* @__PURE__ */ new Set(["book", "translate"]);
function eo(e) {
  return !!(e.jobId && e.sourceUrl && ai.has(e.workflow));
}
function si(e) {
  return !!(eo(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function ii() {
  const e = qa(), t = eo({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = si({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = A({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !bn(o) && (r.current.running = !0);
  const a = ei({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: c, shellWidth: i, bindShell: l } = Xa(), u = ni(e.jobId, !e.sourceOnly), d = vs({
    documentId: e.documentId,
    jobId: e.jobId
  }), m = `${d}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: h, onZoomChange: g } = Is(e.mode, s, d), f = es(
    {
      mode: e.mode,
      sourceOnly: e.sourceOnly,
      assetsReady: e.assetsReady,
      sourceUrl: e.sourceUrl,
      translatedUrl: e.translatedUrl,
      sourceFile: e.sourceFile,
      translatedFile: e.translatedFile
    },
    { userZoom: h, shellWidth: i, identityKey: m }
  ), {
    beginModeSwitch: v,
    goToPage: b,
    repinIfRestoring: P
  } = Bs(s, {
    primaryPane: f.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: d,
    restoreReady: f.primaryNumPages > 0
  });
  x(() => {
    P();
  }, [i, P]);
  const w = Cs(
    s,
    f.compareMode,
    f.rowSyncRevision,
    P
  ), p = As(
    s,
    f.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${h}-${f.metricsTick}`,
    f.primaryPane
  ), S = $((D, G) => {
    var V, ne;
    const U = Math.max(
      Number(f.hudNumPages) || 0,
      Number(f.primaryNumPages) || 0,
      Number((V = f.numPagesByPane) == null ? void 0 : V.source) || 0,
      Number((ne = f.numPagesByPane) == null ? void 0 : ne.translated) || 0
    );
    b(D, U, G);
  }, [b, f.hudNumPages, f.primaryNumPages, f.numPagesByPane]), [T, _] = N(null), O = A(null), L = $((D) => {
    O.current && clearTimeout(O.current), _(D), D && (O.current = setTimeout(() => _(null), ri));
  }, []);
  x(() => () => {
    O.current && clearTimeout(O.current);
  }, []);
  const C = $((D) => {
    const G = Ht(e.regions, D);
    return G ? Un(G, f.primaryPane).page : null;
  }, [e.regions, f.primaryPane]), R = $((D, G) => {
    const U = G || f.primaryPane, V = typeof D == "object" && D ? `${D.block_id || ""}`.trim() : "", ne = typeof D == "object" && D ? `${D.image_url || ""}`.trim() : "", me = typeof D == "object" && D ? D.page_idx != null ? Number(D.page_idx) + 1 : D.page != null ? Number(D.page) : null : typeof D == "number" ? D + 1 : null, re = Bo(e.regions, ne, me) || Ht(e.regions, V) || (typeof D == "object" ? Uo(e.regions, D) : null);
    let oe = re ? Un(re, U).page : null;
    oe == null && (oe = oi(D)), !(oe == null || oe < 1) && (L(re), S(oe, U));
  }, [L, S, f.primaryPane, e.regions]);
  Ks({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: f.hudNumPages || 0,
    currentPage: p,
    goToPage: S,
    resolveBlockPage: C,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled,
    onAnchorApplied: (D) => {
      L(Ht(e.regions, D.blockId));
    }
  });
  const { setModeKeepingPage: I } = Es({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: v
  });
  x(() => {
    L(null);
  }, [m, L]);
  const E = !e.boot.loading && !e.boot.failed, M = Y(() => ({ bindShell: l, shellEl: c, shellWidth: i, shellRef: s }), [l, c, i, s]), F = Y(() => ({
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    sourceFile: e.sourceFile,
    translatedFile: e.translatedFile
  }), [e.sourceUrl, e.translatedUrl, e.sourceFile, e.translatedFile]), K = Y(() => ({
    session: e,
    boot: e.boot,
    sourceOnly: e.sourceOnly,
    mode: e.mode,
    userZoom: h,
    onZoomChange: g,
    shell: M,
    panes: f,
    sessionFiles: F,
    rowHeights: w,
    goToPage: S,
    activeRegion: T,
    jumpToAnchor: R,
    setModeKeepingPage: I,
    download: e.download,
    showHud: E,
    viewStateKey: d,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, M, f, F, w, S, T, R, I, E, h, g, d, a, n, u]);
  return Y(() => ({
    ...K,
    currentPage: p
  }), [K, p]);
}
const ci = [
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
], li = [
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
    title: "模式",
    items: [
      { actions: ["mode-source"], keys: "1", desc: "原文" },
      { actions: ["mode-compare"], keys: "2", desc: "对照" },
      { actions: ["mode-translated"], keys: "3", desc: "译文" }
    ]
  }
];
function ui(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of ci)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function di(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const fi = ".reader-notes-panel";
function mi(e) {
  return e instanceof Element ? !!e.closest(fi) : !1;
}
function hi(e) {
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
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || di(d.target) || mi(d.target))
        return;
      const m = d.key, h = ui(m);
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
              a(Qe(t, $e()));
              return;
            case "next-page":
              i(xt(s + 1, c));
              return;
            case "prev-page":
              i(xt(s - 1, c));
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
const pi = "retainpdf:soft-reader-close";
function gi() {
  return new URL("./index.html", window.location.href).href;
}
function bi() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: pi },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function yi(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function vi() {
  if (!(typeof window > "u") && !bi()) {
    if (yi(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(gi());
  }
}
function Si({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ y("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function wi({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ z(Si, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), vi();
  }, children: [
    /* @__PURE__ */ y(vn, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ y("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
let nr = !1;
function Pi() {
  if (nr)
    return;
  const e = mt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (Fr.GlobalWorkerOptions.workerSrc = e, nr = !0);
}
const Ri = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function Ii(e, t, n) {
  return e.flatMap((r) => {
    if (!Ri.has(Dr(r.region))) return [];
    const o = yn(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function rr(e, t, n) {
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
const Ti = "reader-text-hover-copy", Mi = "reader-text-hover-id", to = "reader-text-hover-tools";
function or({
  className: e,
  state: t,
  label: n,
  title: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ y(
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
const no = 26, ro = 190;
function oo(e, t = ro) {
  return e.height < no * 2 || e.width < t;
}
function Ai({
  target: e,
  pane: t = "source",
  revisedCount: n = 0
}) {
  const [r, o] = N("idle"), [a, s] = N("idle"), c = A([]), i = (e == null ? void 0 : e.itemId) || "";
  if (x(() => {
    o("idle"), s("idle");
    const g = c.current;
    return () => {
      g.forEach((f) => window.clearTimeout(f)), c.current = [];
    };
  }, [i]), !e) return null;
  const l = Ho(e.highlight.region, t), u = Dr(e.highlight.region), d = (g, f) => async (v) => {
    v.preventDefault(), v.stopPropagation();
    const b = await Ei(g);
    f(b ? "copied" : "failed"), c.current.push(window.setTimeout(() => f("idle"), 1200));
  }, m = u === "formula" ? "复制 LaTeX" : "复制", h = oo(e.rect);
  return /* @__PURE__ */ y("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ y(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": u,
      style: e.rect,
      children: /* @__PURE__ */ z(
        "div",
        {
          className: to,
          "data-placement": h ? "outside" : "inside",
          children: [
            /* @__PURE__ */ y(
              or,
              {
                className: Mi,
                state: a,
                label: `复制翻译编号 ${e.itemId}`,
                title: "翻译编号，点击复制",
                onClick: d(e.itemId, s),
                children: a === "copied" ? "已复制编号" : e.itemId
              }
            ),
            t === "translated" && n > 0 ? /* @__PURE__ */ z("span", { className: "reader-text-hover-revised", "data-reader-revised-count": n, children: [
              "改过 ",
              n,
              " 次"
            ] }) : null,
            l ? /* @__PURE__ */ y(
              or,
              {
                className: Ti,
                state: r,
                label: t === "translated" ? "复制这段译文" : "复制这段原文",
                onClick: d(l, o),
                children: r === "copied" ? "已复制" : r === "failed" ? "复制失败" : m
              }
            ) : null
          ]
        }
      )
    }
  ) });
}
function ki(e, t) {
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
function _i(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const c = yn(
      ki(e, a),
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
const Ni = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Li = 256, lt = /* @__PURE__ */ new Map();
function Ci(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Di(e) {
  const t = `${e || ""}`, { text: n, slots: r } = aa(t, { bareLatex: !0 }), o = Ci(n), a = sa(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = lt.get(t);
  if (!s && (s = ia(o, r), lt.set(t, s), lt.size > Li)) {
    const c = lt.keys().next().value;
    c !== void 0 && lt.delete(c);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function Jt(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Te(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function zi(e, t) {
  const n = e.typography, r = Te(t) || 1, o = Te(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), c = Jt(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, i = Math.max(5.5 * r, Math.min(s, c * r)), l = Te(n == null ? void 0 : n.fit_min_font_size_pt), u = Te(n == null ? void 0 : n.fit_max_font_size_pt), d = Math.max(3.5, (l || 5.5) * r), m = Math.max(
    d,
    u ? u * r : o ? o * r : i
  ), h = o ? o * r : i, g = Te(n == null ? void 0 : n.leading_em), f = [
    Te(n == null ? void 0 : n.padding_top_pt) || 0,
    Te(n == null ? void 0 : n.padding_right_pt) || 0,
    Te(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Te(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((v) => v * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || Ni,
    fontSizePx: Math.max(d, Math.min(m, h)),
    minFontSizePx: d,
    maxFontSizePx: m,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (Jt(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : Jt(e.kind) ? "center" : "justify",
    padding: f,
    exact: !!o
  };
}
function xi(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), c = (d) => {
    const m = s.get(d);
    if (m !== void 0) return m;
    const { width: h, height: g } = e(d), f = h <= t + 0.5 && g <= n + 0.5;
    return s.set(d, f), f;
  };
  let i = o, l = a, u = Math.min(r.requestedFontSizePx, l);
  if (c(u)) {
    if (!r.exact) {
      i = u;
      for (let d = 0; d < 6 && l > i; d += 1) {
        const m = (i + l) / 2;
        c(m) ? (u = m, i = m) : l = m;
      }
    }
  } else {
    l = u, u = i;
    for (let d = 0; d < 8 && l > i; d += 1) {
      const m = (i + l) / 2;
      c(m) ? (u = m, i = m) : l = m;
    }
  }
  return Math.max(o, u);
}
const Oi = 512, ut = /* @__PURE__ */ new Map();
let sn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  sn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  sn += 1;
}));
function Fi(e, t, n, r) {
  return [
    sn,
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
function $i({ item: e, pageScale: t }) {
  const n = A(null), r = Y(
    () => Di(e.translatedText),
    [e.translatedText]
  ), [o, a] = N(r.fallbackHtml), s = Y(
    () => zi(e, t),
    [e, t]
  );
  x(() => {
    let d = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((m) => {
      d && a(m);
    }), () => {
      d = !1;
    };
  }, [r]), Ae(() => {
    const d = n.current;
    if (!d) return;
    const [m, h, g, f] = s.padding, v = Math.max(1, e.rect.width - f - h), b = Math.max(1, e.rect.height - m - g), P = Fi(o, v, b, s);
    let w = ut.get(P);
    if (w === void 0 && (w = xi(
      (p) => (d.style.fontSize = `${p}px`, { width: d.scrollWidth, height: d.scrollHeight }),
      v,
      b,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), ut.set(P, w), ut.size > Oi)) {
      const p = ut.keys().next().value;
      p !== void 0 && ut.delete(p);
    }
    d.style.fontSize = `${w.toFixed(2)}px`;
  }, [o, e.rect.height, e.rect.width, s]);
  const [c, i, l, u] = s.padding;
  return /* @__PURE__ */ y(
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
      children: /* @__PURE__ */ y(
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
function ji({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = Y(
    () => _i(e, t, n, r),
    [r, e, t, n]
  );
  return o.length ? /* @__PURE__ */ y(
    "div",
    {
      className: "reader-live-translation-overlay",
      "data-live-translation-page": e == null ? void 0 : e.page_idx,
      "data-live-translation-generation": t == null ? void 0 : t.generation,
      "aria-hidden": "true",
      children: o.map((a) => /* @__PURE__ */ y(
        $i,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Bi = mn(ji), ao = hn(null), so = hn(null);
function Ui({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ y(ao.Provider, { value: e, children: /* @__PURE__ */ y(so.Provider, { value: t, children: n }) });
}
function De() {
  return pn(ao);
}
function io() {
  return pn(so);
}
const co = 1.414;
function Hi({
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
  regionTargets: m = [],
  hoveredRegionId: h,
  onHoverRegion: g,
  liveTranslationLayout: f,
  liveTranslationPage: v,
  showLiveTranslation: b = r === "source"
}) {
  var oe;
  const P = (oe = De()) == null ? void 0 : oe.revisedBlocks, w = A(i ?? co), [p, S] = N(w.current);
  x(() => {
    i != null && Math.abs(i - w.current) >= 1e-3 && (w.current = i, S(i));
  }, [i]);
  const T = A(u);
  T.current = u;
  const _ = A(null), O = A((j) => {
    var B;
    _.current = j, (B = T.current) == null || B.call(T, j);
  }).current, L = A(null), C = A(`${t}@${n}`);
  Ae(() => {
    const j = `${t}@${n}`;
    C.current !== j && (C.current = j, o && Vi(_.current, L.current));
  }, [o, n, t]), x(() => {
    o || Gt(L.current);
  }, [o]), x(() => () => Gt(L.current), []);
  const R = Math.max(120, Math.floor(t * p)), I = Math.max(R, Math.ceil(s || 0)), E = yn(d, t, R), M = Y(
    () => Ii(m, t, R),
    [R, m, t]
  ), [F, K] = N(null), D = typeof g == "function", G = D ? h ?? null : F, U = (j) => {
    D ? j !== (h ?? null) && (g == null || g(j)) : K((B) => B === j ? B : j);
  }, V = Y(
    () => M.find((j) => j.itemId === G) || null,
    [G, M]
  ), ne = (j) => {
    var ke, Re;
    if (j.pointerType === "touch") return;
    if (j.buttons !== 0) {
      U(null);
      return;
    }
    if ((Re = (ke = j.target) == null ? void 0 : ke.closest) != null && Re.call(ke, `.${to}`)) return;
    const B = j.currentTarget.getBoundingClientRect(), Z = j.clientX - B.left, pe = j.clientY - B.top, ae = V == null ? void 0 : V.rect;
    if (ae && oo(ae) && Z >= ae.left - 4 && Z <= ae.left + ro && pe >= ae.top - no && pe <= ae.top) return;
    const Pe = rr(M, Z, pe);
    U((Pe == null ? void 0 : Pe.itemId) || null);
  }, me = (j) => {
    if (j.pointerType === "mouse") return;
    const B = j.currentTarget.getBoundingClientRect(), Z = rr(
      M,
      j.clientX - B.left,
      j.clientY - B.top
    );
    U((Z == null ? void 0 : Z.itemId) || null);
  }, re = (j) => {
    !Number.isFinite(j) || j <= 0 || Math.abs(w.current - j) < 1e-3 || (w.current = j, S(j), l == null || l(e, j));
  };
  return /* @__PURE__ */ z(
    "div",
    {
      ref: O,
      [je]: e,
      [rt]: r,
      [Sn]: R,
      className: wn,
      onPointerMoveCapture: ne,
      onPointerDown: me,
      onPointerLeave: (j) => {
        j.pointerType === "mouse" && U(null);
      },
      style: {
        width: t,
        height: I,
        minHeight: I
      },
      children: [
        o ? /* @__PURE__ */ y(
          ra,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            renderAnnotationLayer: !1,
            className: Br,
            loading: /* @__PURE__ */ y(
              "div",
              {
                className: Lt,
                style: { width: t, height: R }
              }
            ),
            onLoadSuccess: (j) => {
              try {
                const B = j.getViewport({ scale: 1 });
                if (B.width > 0) {
                  const Z = B.height / B.width;
                  re(Z);
                }
              } catch {
              }
              c == null || c();
            },
            onRenderSuccess: () => {
              Gt(L.current), c == null || c();
            }
          }
        ) : /* @__PURE__ */ y(
          "div",
          {
            className: Lt,
            style: { width: t, height: R },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ y("div", { ref: L, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        E ? /* @__PURE__ */ y(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": d == null ? void 0 : d.itemId,
            style: E,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && b ? /* @__PURE__ */ y(
          Bi,
          {
            layoutPage: f,
            pageState: v,
            width: t,
            height: R
          }
        ) : null,
        o && r === "translated" && (P != null && P.size) ? /* @__PURE__ */ y("div", { className: "reader-revised-markers", "aria-hidden": "true", children: M.filter((j) => P.has(j.itemId)).map((j) => /* @__PURE__ */ y(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": j.itemId,
            style: { left: j.rect.left, top: j.rect.top, height: j.rect.height }
          },
          j.itemId
        )) }) : null,
        /* @__PURE__ */ y(
          Ai,
          {
            target: o ? V : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: V && (P == null ? void 0 : P.get(V.itemId)) || 0
          }
        )
      ]
    }
  );
}
const Wi = mn(Hi);
function Vi(e, t) {
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
const Ji = 2 * 1024 * 1024;
function Gi(e) {
  const t = new Fr.PDFDataRangeTransport(e.length, null);
  return t.requestDataRange = (n, r) => {
    e.fetchRange(n, r).then(
      (o) => t.onDataRange(n, o),
      () => {
        t.abort();
      }
    );
  }, t;
}
const qt = 5, qi = "120% 0px", Ki = 120, Zi = "25% 0px";
let ar = 1;
const sr = /* @__PURE__ */ new WeakMap();
function Yi(e) {
  if (!e) return 0;
  const t = sr.get(e);
  if (t) return t;
  const n = ar;
  return ar += 1, sr.set(e, n), n;
}
function Xi() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Qi = _o(
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
    onLoadError: m,
    onNumPagesChange: h,
    activeRegion: g = null,
    regions: f = [],
    readerMetadata: v = null,
    hoveredRegionId: b = null,
    onHoverRegion: P,
    liveTranslation: w,
    showLiveTranslation: p = t === "source",
    liveTranslationPendingLabel: S = "",
    paneAction: T
  }, _) {
    Pi();
    const { file: O, loading: L, error: C } = Ua(n, r), R = `${n}\0${Yi(O)}`, I = A(R);
    I.current = R;
    const E = Y(() => {
      const k = xa(O);
      return k ? "ranged" in k ? { range: Gi(k.ranged) } : k : null;
    }, [O, n]), [M, F] = N(0), [K, D] = N(""), [G, U] = N(null), [V, ne] = N(480), me = A(null), re = A(0), oe = Y(() => Xi(), []), j = Y(() => ({
      cMapUrl: mt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: mt().resolvePdfjsVendorUrl("standard_fonts/"),
      // 只对按段取的大文件起作用：要哪页取哪页，不在后台把整份取完（取完又是一整份在内存里）。
      rangeChunkSize: Ji,
      disableAutoFetch: !0
    }), []);
    gn(_, () => G, [G]), x(() => {
      const k = (H) => {
        re.current = H, ne(H);
      }, J = (H) => {
        const Q = ps(H, re.current);
        if (Q !== "ignore") {
          if (me.current && clearTimeout(me.current), Q === "immediate") {
            k(H);
            return;
          }
          me.current = setTimeout(() => k(H), Wr);
        }
      }, W = !!(i && i >= 80);
      J(W ? i : (c == null ? void 0 : c.clientWidth) || 0);
      const ee = !W && c && typeof ResizeObserver < "u" ? new ResizeObserver((H) => {
        var Q, ce;
        J(((ce = (Q = H[0]) == null ? void 0 : Q.contentRect) == null ? void 0 : ce.width) ?? c.clientWidth);
      }) : null;
      return ee && c && ee.observe(c), () => {
        ee == null || ee.disconnect(), me.current && clearTimeout(me.current);
      };
    }, [i, c, a]);
    const B = Y(
      () => fs(V, o),
      [V, o]
    ), [Z, pe] = N(() => /* @__PURE__ */ new Map()), [ae, Pe] = N(() => /* @__PURE__ */ new Set()), [ke, Re] = N(() => /* @__PURE__ */ new Set()), Je = A(/* @__PURE__ */ new Map()), Ge = A(null), te = A(null), [le, ge] = N(() => /* @__PURE__ */ new Set()), se = A(/* @__PURE__ */ new Map()), ue = $((k, J) => {
      pe((W) => {
        if (W.get(k) === J) return W;
        const q = new Map(W);
        return q.set(k, J), q;
      });
    }, []), ie = $((k, J) => {
      const W = Je.current, q = W.get(k), ee = [Ge.current, te.current];
      if (q)
        for (const H of ee)
          try {
            H == null || H.unobserve(q);
          } catch {
          }
      if (J) {
        W.set(k, J);
        for (const H of ee)
          try {
            H == null || H.observe(J);
          } catch {
          }
      } else
        W.delete(k);
    }, []), qe = A(/* @__PURE__ */ new Map()), Ke = $((k) => {
      const J = qe.current;
      let W = J.get(k);
      return W || (W = (q) => ie(k, q), J.set(k, W)), W;
    }, [ie]);
    x(() => {
      if (typeof IntersectionObserver > "u") return;
      const k = se.current, J = new IntersectionObserver(
        (W) => {
          const q = [], ee = [];
          for (const H of W) {
            const Q = H.target, ce = Dt(Q);
            Number.isFinite(ce) && (H.isIntersecting ? q : ee).push(ce);
          }
          if ((q.length || ee.length) && Pe((H) => {
            let Q = null;
            for (const ce of q)
              H.has(ce) || (Q = Q || new Set(H), Q.add(ce));
            for (const ce of ee)
              H.has(ce) && (Q = Q || new Set(H), Q.delete(ce));
            return Q || H;
          }), q.length) {
            for (const H of q) {
              const Q = k.get(H);
              Q && (clearTimeout(Q), k.delete(H));
            }
            Re((H) => {
              let Q = null;
              for (const ce of q)
                H.has(ce) || (Q = Q || new Set(H), Q.add(ce));
              return Q || H;
            });
          }
          for (const H of ee)
            k.has(H) || k.set(H, setTimeout(() => {
              k.delete(H), Re((Q) => {
                if (!Q.has(H)) return Q;
                const ce = new Set(Q);
                return ce.delete(H), ce;
              });
            }, Ki));
        },
        { root: c, rootMargin: qi, threshold: 0 }
      );
      Ge.current = J;
      for (const W of Je.current.values())
        try {
          J.observe(W);
        } catch {
        }
      return () => {
        J.disconnect(), Ge.current === J && (Ge.current = null);
        for (const W of k.values()) clearTimeout(W);
        k.clear();
      };
    }, [c]), x(() => {
      if (typeof IntersectionObserver > "u") return;
      const k = new IntersectionObserver(
        (J) => {
          ge((W) => {
            let q = null;
            for (const ee of J) {
              const H = Dt(ee.target);
              !Number.isFinite(H) || ee.isIntersecting === W.has(H) || (q = q || new Set(W), ee.isIntersecting ? q.add(H) : q.delete(H));
            }
            return q || W;
          });
        },
        { root: c, rootMargin: Zi, threshold: 0 }
      );
      te.current = k;
      for (const J of Je.current.values())
        try {
          k.observe(J);
        } catch {
        }
      return () => {
        k.disconnect(), te.current === k && (te.current = null);
      };
    }, [c]);
    const st = !!c && typeof IntersectionObserver < "u";
    Ae(() => {
      F(0), D(""), Pe(/* @__PURE__ */ new Set()), Re(/* @__PURE__ */ new Set()), pe(/* @__PURE__ */ new Map()), Je.current.clear();
      const k = se.current;
      for (const J of k.values()) clearTimeout(J);
      k.clear(), h == null || h(0, t);
    }, [R, h, t]);
    const Bt = $(
      ({ numPages: k }) => {
        I.current === R && (F(k), D(""), h == null || h(k, t), d == null || d({ numPages: k, pane: t }));
      },
      [R, d, h, t]
    ), Ut = $(
      (k) => {
        if (I.current !== R) return;
        const J = (k == null ? void 0 : k.message) || "PDF 解析失败";
        D(J), F(0), h == null || h(0, t), m == null || m(k, t);
      },
      [R, m, h, t]
    ), _e = Y(
      () => M > 0 ? Array.from({ length: M }, (k, J) => J + 1) : [],
      [M]
    );
    x(() => {
      typeof IntersectionObserver < "u" || Re(new Set(_e));
    }, [_e]);
    const Ne = Y(
      () => Hn(g, v, t),
      [g, v, t]
    ), ze = Y(() => {
      const k = /* @__PURE__ */ new Map();
      for (const J of f) {
        const W = Hn(J, v, t);
        if (!W) continue;
        const q = k.get(W.box.page) || [];
        q.push(W), k.set(W.box.page, q);
      }
      return k;
    }, [t, v, f]), wt = Y(() => {
      const k = /* @__PURE__ */ new Set();
      if (!b) return k;
      for (const [J, W] of ze)
        W.some((q) => q.itemId === b) && k.add(J);
      return k;
    }, [b, ze]), Pt = Y(() => {
      if (M === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!c && typeof IntersectionObserver < "u")) return new Set(_e);
      if (ae.size === 0) {
        const W = Math.min(M, qt * 2 + 1);
        return new Set(Array.from({ length: W }, (q, ee) => ee + 1));
      }
      const J = /* @__PURE__ */ new Set();
      for (const W of ae)
        for (let q = -qt; q <= qt; q++) {
          const ee = W + q;
          ee >= 1 && ee <= M && J.add(ee);
        }
      return J;
    }, [M, _e, c, a, ae]), Ze = !n || !!C || !!K, Rt = n && (C || K) || s;
    return /* @__PURE__ */ z(
      "section",
      {
        ref: U,
        className: `reader-panel ${os}${a ? "" : " is-hidden"}`,
        [rt]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (w == null ? void 0 : w.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          T ? /* @__PURE__ */ y("div", { className: "reader-react-pdf-pane-action", children: T }) : null,
          S ? /* @__PURE__ */ z("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ y("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ y("span", { children: S })
          ] }) : null,
          Ze && !L ? /* @__PURE__ */ y("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: Rt }) : null,
          L ? /* @__PURE__ */ y("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          E && !C ? /* @__PURE__ */ y("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ y(
            oa,
            {
              file: E,
              loading: null,
              error: null,
              options: j,
              onLoadSuccess: Bt,
              onLoadError: Ut,
              className: "reader-react-pdf-document",
              children: _e.map((k) => {
                if (Pt.has(k))
                  return /* @__PURE__ */ y(
                    Wi,
                    {
                      pane: t,
                      pageNumber: k,
                      width: B,
                      devicePixelRatio: oe,
                      active: ke.has(k),
                      textLayer: !st || le.has(k),
                      syncedMinHeight: (l == null ? void 0 : l.get(k)) || 0,
                      onMetrics: u,
                      cachedAspect: Z.get(k),
                      onAspectChange: ue,
                      sentinelRef: Ke(k),
                      regionHighlight: (Ne == null ? void 0 : Ne.box.page) === k ? Ne : null,
                      regionTargets: ze.get(k),
                      hoveredRegionId: b && wt.has(k) ? b : null,
                      onHoverRegion: P,
                      liveTranslationLayout: w == null ? void 0 : w.layoutByPage.get(k - 1),
                      liveTranslationPage: w == null ? void 0 : w.pagesByPage.get(k - 1),
                      showLiveTranslation: p
                    },
                    `${t}-${k}`
                  );
                const W = Z.get(k) ?? co, q = Math.max(120, Math.floor(B * W)), ee = Math.max(q, Math.ceil((l == null ? void 0 : l.get(k)) || 0));
                return /* @__PURE__ */ y(
                  "div",
                  {
                    ref: Ke(k),
                    [je]: k,
                    [rt]: t,
                    [Sn]: q,
                    className: `${wn} is-placeholder`,
                    style: {
                      width: B,
                      height: ee,
                      minHeight: ee
                    },
                    children: /* @__PURE__ */ y(
                      "div",
                      {
                        className: Lt,
                        style: { width: B, height: q },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${k}`
                );
              })
            },
            R
          ) }) : null
        ]
      }
    );
  }
), ir = mn(Qi), ec = 2e3, tc = 6, nc = 500, cr = "reader-react-resizing";
function rc(e, t) {
  const n = A(null), r = A(null);
  Ae(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const p = oc(e), S = At(e, p);
      if (!S) return;
      s = { pane: p, progress: S, started: performance.now() };
    }
    const { pane: c, progress: i, started: l } = s;
    let u = 0, d = null, m = e.scrollHeight, h = m, g = 0, f = l;
    const v = /* @__PURE__ */ new WeakMap(), b = typeof ResizeObserver > "u" ? null : new ResizeObserver((p) => {
      let S = !1;
      for (const T of p) {
        const _ = Math.round(T.contentRect.height);
        v.has(T.target) && v.get(T.target) !== _ && (S = !0), v.set(T.target, _);
      }
      S && pt(e, i, "auto", c);
    }), P = () => {
      var p;
      d && clearTimeout(d), cancelAnimationFrame(u), b == null || b.disconnect(), e.classList.remove(cr);
      for (const S of lr) e.removeEventListener(S, P);
      ((p = r.current) == null ? void 0 : p.stop) === P && (r.current = null);
    }, w = () => {
      pt(e, i, "auto", c);
      const p = e.scrollHeight;
      g = p === h ? g + 1 : 0, h = p;
      const S = performance.now() - f;
      g >= tc && (p !== m || S > nc) || S > ec ? P() : u = requestAnimationFrame(w);
    };
    for (const p of lr) e.addEventListener(p, P, { passive: !0 });
    for (const p of Array.from(e.children)) b == null || b.observe(p);
    e.classList.add(cr), r.current = { ...s, stop: P }, d = setTimeout(() => {
      d = null, f = performance.now(), m = e.scrollHeight, h = m, g = 0, u = requestAnimationFrame(w);
    }, Wr);
  }, [e, t]), x(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function oc(e) {
  for (const t of Array.from(e.querySelectorAll(`[${je}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(rt) || null;
  }
  return null;
}
const lr = ["wheel", "touchstart", "keydown", "pointerdown"], ac = () => () => {
}, ur = () => null;
function sc({
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
function ic(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function cc(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function lc(e) {
  const t = De(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", c = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", i = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, d = e.bindShell ?? (t == null ? void 0 : t.bindShell), m = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, h = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? St, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, f = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), v = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, b = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, P = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, w = e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", p = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", S = e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, T = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, _ = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), O = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), L = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), C = e.regions ?? (t == null ? void 0 : t.regions) ?? [], R = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), I = (t == null ? void 0 : t.regionHover) ?? null, [E, M] = N(null), F = Lr(
    I ? I.subscribe : ac,
    I ? () => I.get().itemId : ur,
    I ? () => I.get().itemId : ur
  ), K = I ? F : E, D = $((ne) => {
    I ? I.set(ne, "pdf") : M(ne);
  }, [I]), G = sc({
    mode: s,
    compareMode: c,
    showSource: i,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), V = Number.isFinite(g) && g > 0 ? ic(
    g,
    n || r,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return rc(m, V), /* @__PURE__ */ y(
    "div",
    {
      ref: d,
      className: rs,
      "data-reader-region-count": C.length,
      "data-reader-structured-region-count": C.filter(Wo).length,
      "data-reader-metadata-ready": R ? "true" : "false",
      children: /* @__PURE__ */ z(
        "main",
        {
          className: `${ns} reader-mode-${G.mode}`,
          "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
          children: [
            v ? /* @__PURE__ */ y(
              ir,
              {
                pane: "source",
                url: w,
                preloadedFile: S,
                userZoom: h,
                visible: G.showSource,
                scrollRoot: m,
                pageWidthOverride: V,
                rowHeights: G.compareMode ? f : void 0,
                onMetrics: _,
                emptyLabel: P ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                onNumPagesChange: O,
                activeRegion: L,
                regions: C,
                readerMetadata: R,
                hoveredRegionId: K,
                onHoverRegion: D,
                liveTranslation: u ? o : void 0,
                showLiveTranslation: u,
                liveTranslationPendingLabel: u ? cc(o) : "",
                paneAction: u ? /* @__PURE__ */ z(vt, { children: [
                  e.sourcePaneAction,
                  /* @__PURE__ */ y(
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
            b ? /* @__PURE__ */ y(
              ir,
              {
                pane: "translated",
                url: p,
                preloadedFile: T,
                userZoom: h,
                visible: G.showTranslated,
                scrollRoot: m,
                pageWidthOverride: V,
                rowHeights: G.compareMode ? f : void 0,
                onMetrics: _,
                emptyLabel: "暂无译文 PDF",
                onNumPagesChange: O,
                activeRegion: L,
                regions: C,
                readerMetadata: R,
                hoveredRegionId: K,
                onHoverRegion: D,
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
const uc = [
  { id: "source", label: "原文", Icon: zr },
  { id: "compare", label: "对照", Icon: xr },
  { id: "translated", label: "译文", Icon: Or }
];
function dc(e) {
  return e.connection === "live" ? `实时译文 · ${e.pagesByPage.size} 页` : e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function fc(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function mc(e) {
  const t = De(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null
  } = e, s = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? dc(a.state) : "";
  return /* @__PURE__ */ z("header", { className: "reader-workspace-bar", children: [
    a ? /* @__PURE__ */ z(
      "button",
      {
        type: "button",
        className: `reader-live-translation-toggle is-${a.state.connection}${a.visible ? " is-active" : ""}`,
        "aria-pressed": a.visible,
        "aria-label": a.visible ? "隐藏实时译文" : "显示实时译文",
        title: a.state.error || c,
        onClick: a.onToggle,
        children: [
          /* @__PURE__ */ y(Ko, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
          /* @__PURE__ */ y("span", { className: "reader-live-translation-toggle-label", children: c })
        ]
      }
    ) : null,
    /* @__PURE__ */ y("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: uc.map(({ id: i, label: l, Icon: u }) => {
      const d = n === i, m = fc({
        id: i,
        documentReady: r,
        sourceViewOnly: s,
        liveTranslationAvailable: !!a
      });
      return /* @__PURE__ */ z(
        "button",
        {
          type: "button",
          className: `reader-workspace-tab${d ? " is-active" : ""}`,
          role: "tab",
          "aria-selected": d,
          "aria-label": l,
          title: m ? `${l} 需要文档任务` : l,
          disabled: m,
          onClick: () => o(i),
          children: [
            /* @__PURE__ */ y(u, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ y("span", { className: "reader-workspace-tab-label", children: l })
          ]
        },
        i
      );
    }) })
  ] });
}
const hc = {
  markdown: { label: "Markdown", short: "MD", Icon: Zo, needsJob: !0 }
}, pc = Vr.map(
  (e) => ({ id: e, ...hc[e] })
);
function lo() {
  return pc.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function gc(e) {
  const t = De(), { active: n } = e, r = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, o = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), a = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  });
  return /* @__PURE__ */ y(vt, { children: lo().map(({ id: s, label: c, Icon: i, needsJob: l }) => {
    const u = n === s, d = l && r, m = u ? `收起${c}` : `打开${c}`;
    return /* @__PURE__ */ y(
      "button",
      {
        type: "button",
        className: "reader-panel-toggle",
        "aria-label": m,
        "aria-pressed": u,
        title: d ? `${c} 需打开任务阅读` : c,
        disabled: d,
        onClick: () => u ? a() : o(s),
        children: /* @__PURE__ */ y(i, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 })
      },
      s
    );
  }) });
}
function bc(e) {
  const t = De(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), c = lo().map(({ id: i, label: l, short: u, Icon: d, needsJob: m }) => ({
    key: i,
    label: l,
    short: u,
    Icon: d,
    disabled: m && o,
    selected: n === i,
    badge: r == null ? void 0 : r[i],
    onClick: () => a(i)
  }));
  return n ? /* @__PURE__ */ z("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ y("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: c.map(({ key: i, label: l, Icon: u, disabled: d, selected: m, badge: h, onClick: g }) => /* @__PURE__ */ z(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": m,
        className: `reader-assistant-dock-tab${m ? " is-active" : ""}`,
        title: d ? `${l} 需打开任务阅读` : l,
        disabled: d,
        onClick: g,
        children: [
          /* @__PURE__ */ y(u, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
          /* @__PURE__ */ y("span", { className: "reader-assistant-dock-tab-label", children: l }),
          h ? /* @__PURE__ */ y("span", { className: "reader-assistant-dock-badge", children: h }) : null
        ]
      },
      i
    )) }),
    /* @__PURE__ */ y(
      "button",
      {
        type: "button",
        className: "reader-assistant-dock-close",
        "aria-label": "关闭阅读辅助面板",
        title: "关闭辅助面板",
        onClick: s,
        children: /* @__PURE__ */ y(vn, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : null;
}
function yc(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function vc(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function Sc(e) {
  return e / 100 * window.innerHeight;
}
function wc(e) {
  return e / 100 * window.innerWidth;
}
function Pc(e) {
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
  const [o, a] = Pc(n);
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
      r = vc(t, o);
      break;
    }
    case "em": {
      r = yc(t, o);
      break;
    }
    case "vh": {
      r = Sc(o);
      break;
    }
    case "vw": {
      r = wc(o);
      break;
    }
  }
  return r;
}
function fe(e) {
  return parseFloat(e.toFixed(3));
}
function ot({
  group: e
}) {
  const { orientation: t, panels: n } = e;
  return n.reduce((r, o) => (r += t === "horizontal" ? o.element.offsetWidth : o.element.offsetHeight, r), 0);
}
function cn(e) {
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
      s = fe(u / n * 100);
    }
    let c;
    if (a.defaultSize !== void 0) {
      const u = dt({
        groupSize: n,
        panelElement: o,
        styleProp: a.defaultSize
      });
      c = fe(u / n * 100);
    }
    let i = 0;
    if (a.minSize !== void 0) {
      const u = dt({
        groupSize: n,
        panelElement: o,
        styleProp: a.minSize
      });
      i = fe(u / n * 100);
    }
    let l = 100;
    if (a.maxSize !== void 0) {
      const u = dt({
        groupSize: n,
        panelElement: o,
        styleProp: a.maxSize
      });
      l = fe(u / n * 100);
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
function X(e, t = "Assertion error") {
  if (!e)
    throw Error(t);
}
function ln(e, t) {
  return Array.from(t).sort(
    e === "horizontal" ? Rc : Ic
  );
}
function Rc(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function Ic(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function uo(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function fo(e, t) {
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
function Ec({
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
    const { x: c, y: i } = fo(r, s), l = e === "horizontal" ? c : i;
    l < a && (a = l, o = s);
  }
  return X(o, "No rect found"), o;
}
let Tt;
function Tc() {
  return Tt === void 0 && (typeof matchMedia == "function" ? Tt = !!matchMedia("(pointer:coarse)").matches : Tt = !1), Tt;
}
function mo(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = ln(
    n,
    Array.from(t.children).filter(uo).map((g) => ({ element: g }))
  ).map(({ element: g }) => g), s = [];
  let c = !1, i = !1, l = -1, u = -1, d = 0, m, h = [];
  {
    let g = -1;
    for (const f of a)
      f.hasAttribute("data-panel") && (g++, f.hasAttribute("data-disabled") || (d++, l === -1 && (l = g), u = g));
  }
  if (d > 1) {
    let g = -1;
    for (const f of a)
      if (f.hasAttribute("data-panel")) {
        g++;
        const v = r.find(
          (b) => b.element === f
        );
        if (v) {
          if (m) {
            const b = m.element.getBoundingClientRect(), P = f.getBoundingClientRect();
            let w;
            if (i) {
              const p = n === "horizontal" ? new DOMRect(
                b.right,
                b.top,
                0,
                b.height
              ) : new DOMRect(
                b.left,
                b.bottom,
                b.width,
                0
              ), S = n === "horizontal" ? new DOMRect(P.left, P.top, 0, P.height) : new DOMRect(P.left, P.top, P.width, 0);
              switch (h.length) {
                case 0: {
                  w = [
                    p,
                    S
                  ];
                  break;
                }
                case 1: {
                  const T = h[0], _ = Ec({
                    orientation: n,
                    rects: [b, P],
                    targetRect: T.element.getBoundingClientRect()
                  });
                  w = [
                    T,
                    _ === b ? S : p
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
                  P.top,
                  P.left - b.right,
                  P.height
                ) : new DOMRect(
                  P.left,
                  b.bottom,
                  P.width,
                  P.top - b.bottom
                )
              ];
            for (const p of w) {
              let S = "width" in p ? p : p.element.getBoundingClientRect();
              const T = Tc() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (S.width < T) {
                const O = T - S.width;
                S = new DOMRect(
                  S.x - O / 2,
                  S.y,
                  S.width + O,
                  S.height
                );
              }
              if (S.height < T) {
                const O = T - S.height;
                S = new DOMRect(
                  S.x,
                  S.y - O / 2,
                  S.width,
                  S.height + O
                );
              }
              const _ = g <= l || g > u;
              !c && !_ && s.push({
                group: e,
                groupSize: ot({ group: e }),
                panels: [m, v],
                separator: "width" in p ? void 0 : p,
                rect: S
              }), c = !1;
            }
          }
          i = !1, m = v, h = [];
        }
      } else if (f.hasAttribute("data-separator")) {
        f.ariaDisabled !== null && (c = !0);
        const v = o.find(
          (b) => b.element === f
        );
        v ? h.push(v) : (m = void 0, h = []);
      } else
        i = !0;
  }
  return s;
}
var Le;
class ho {
  constructor() {
    jn(this, Le, {});
  }
  addListener(t, n) {
    const r = it(this, Le)[t];
    return r === void 0 ? it(this, Le)[t] = [n] : r.includes(n) || r.push(n), () => {
      this.removeListener(t, n);
    };
  }
  emit(t, n) {
    const r = it(this, Le)[t];
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
    Bn(this, Le, {});
  }
  removeListener(t, n) {
    const r = it(this, Le)[t];
    if (r !== void 0) {
      const o = r.indexOf(n);
      o >= 0 && r.splice(o, 1);
    }
  }
}
Le = new WeakMap();
let tt = {
  cursorFlags: 0,
  state: "inactive"
};
const In = new ho();
function Be() {
  return tt;
}
function Mc(e) {
  return In.addListener("change", e);
}
function Ac(e) {
  const t = tt, n = { ...tt };
  n.cursorFlags = e, tt = n, In.emit("change", {
    prev: t,
    next: n
  });
}
function nt(e) {
  const t = tt;
  tt = e, In.emit("change", {
    prev: t,
    next: e
  });
}
const kc = (e) => e, Kt = () => {
}, po = 1, go = 2, bo = 4, yo = 8, dr = 3, fr = 12;
let Mt;
function mr() {
  return Mt === void 0 && (Mt = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (Mt = !0)), Mt;
}
function _c({
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
        if (e && mr()) {
          const a = (e & po) !== 0, s = (e & go) !== 0, c = (e & bo) !== 0, i = (e & yo) !== 0;
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
    return mr() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const hr = /* @__PURE__ */ new WeakMap();
function En(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = hr.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = Be();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = _c({
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
  hr.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Se = /* @__PURE__ */ new Map();
const vo = new ho();
function Nc(e) {
  Se = new Map(Se), Se.delete(e);
}
function pr(e, t) {
  for (const [n] of Se)
    if (n.id === e)
      return n;
}
function Ce(e, t) {
  for (const [n, r] of Se)
    if (n.id === e)
      return r;
  if (t)
    throw Error(`Could not find data for Group with id ${e}`);
}
function We() {
  return Se;
}
function Tn(e, t) {
  return vo.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Me(e, t, n) {
  const r = Se.get(e);
  Se = new Map(Se), Se.set(e, t), vo.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function So(e) {
  const t = Be();
  let n = !1;
  switch (t.state) {
    case "active":
      nt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (En(e), n = !0, t.hitRegions.forEach((r) => {
        const o = Ce(r.group.id, !0);
        Me(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function gr(e) {
  e.defaultPrevented || So(e.currentTarget);
}
function Lc(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = fo(n, a.rect);
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
function Cc(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Dc(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: vr(e),
    b: vr(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  X(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: yr(br(n.a)),
    b: yr(br(n.b))
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
const zc = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function xc(e) {
  const t = getComputedStyle(wo(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function Oc(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || xc(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || zc.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function br(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (X(n, "Missing node"), Oc(n)) return n;
  }
  return null;
}
function yr(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function vr(e) {
  const t = [];
  for (; e; )
    t.push(e), e = wo(e);
  return t;
}
function wo(e) {
  const { parentNode: t } = e;
  return Cc(t) ? t.host : t;
}
function Fc(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function $c({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!uo(n) || n.contains(e) || e.contains(n))
    return !0;
  if (Dc(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Fc(r.getBoundingClientRect(), t))
        return !1;
      r = r.parentElement;
    }
  }
  return !0;
}
function Mn(e, t) {
  const n = [];
  return t.forEach((r, o) => {
    if (o.disabled)
      return;
    const a = mo(o), s = Lc(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && $c({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function jc(e, t) {
  if (e.length !== t.length)
    return !1;
  for (let n = 0; n < e.length; n++)
    if (e[n] != t[n])
      return !1;
  return !0;
}
function de(e, t, n = 0) {
  return Math.abs(fe(e) - fe(t)) <= n;
}
function ve(e, t) {
  return de(e, t) ? 0 : e > t ? 1 : -1;
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
  if (ve(r, i) < 0)
    if (a) {
      const l = (o + i) / 2;
      ve(r, l) < 0 ? r = o : r = i;
    } else
      r = i;
  return r = Math.min(c, r), r = fe(r), r;
}
function gt({
  delta: e,
  initialLayout: t,
  panelConstraints: n,
  pivotIndices: r,
  prevLayout: o,
  trigger: a
}) {
  if (de(e, 0))
    return t;
  const s = a === "imperative-api", c = Object.values(t), i = Object.values(o), l = [...c], [u, d] = r;
  X(u != null, "Invalid first pivot index"), X(d != null, "Invalid second pivot index");
  let m = 0;
  switch (a) {
    case "keyboard": {
      {
        const f = e < 0 ? d : u, v = n[f];
        X(
          v,
          `Panel constraints not found for index ${f}`
        );
        const {
          collapsedSize: b = 0,
          collapsible: P,
          minSize: w = 0
        } = v;
        if (P) {
          const p = c[f];
          if (X(
            p != null,
            `Previous layout not found for panel index ${f}`
          ), de(p, b)) {
            const S = w - p;
            ve(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
          }
        }
      }
      {
        const f = e < 0 ? u : d, v = n[f];
        X(
          v,
          `No panel constraints found for index ${f}`
        );
        const {
          collapsedSize: b = 0,
          collapsible: P,
          minSize: w = 0
        } = v;
        if (P) {
          const p = c[f];
          if (X(
            p != null,
            `Previous layout not found for panel index ${f}`
          ), de(p, w)) {
            const S = p - b;
            ve(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
          }
        }
      }
      break;
    }
    default: {
      const f = e < 0 ? d : u, v = n[f];
      X(
        v,
        `Panel constraints not found for index ${f}`
      );
      const b = c[f], { collapsible: P, collapsedSize: w, minSize: p } = v;
      if (P && ve(b, p) < 0)
        if (e > 0) {
          const S = p - w, T = S / 2, _ = b + e;
          ve(_, p) < 0 && (e = ve(e, T) <= 0 ? 0 : S);
        } else {
          const S = p - w, T = 100 - S / 2, _ = b - e;
          ve(_, p) < 0 && (e = ve(100 + e, T) > 0 ? 0 : -S);
        }
      break;
    }
  }
  {
    const f = e < 0 ? 1 : -1;
    let v = e < 0 ? d : u, b = 0;
    for (; ; ) {
      const w = c[v];
      X(
        w != null,
        `Previous layout not found for panel index ${v}`
      );
      const p = et({
        overrideDisabledPanels: s,
        panelConstraints: n[v],
        prevSize: w,
        size: 100
      }) - w;
      if (b += p, v += f, v < 0 || v >= n.length)
        break;
    }
    const P = Math.min(Math.abs(e), Math.abs(b));
    e = e < 0 ? 0 - P : P;
  }
  {
    let f = e < 0 ? u : d;
    for (; f >= 0 && f < n.length; ) {
      const v = Math.abs(e) - Math.abs(m), b = c[f];
      X(
        b != null,
        `Previous layout not found for panel index ${f}`
      );
      const P = b - v, w = et({
        overrideDisabledPanels: s,
        panelConstraints: n[f],
        prevSize: b,
        size: P
      });
      if (!de(b, w) && (m += b - w, l[f] = w, m.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? f-- : f++;
    }
  }
  if (jc(i, l))
    return o;
  {
    const f = e < 0 ? d : u, v = c[f];
    X(
      v != null,
      `Previous layout not found for panel index ${f}`
    );
    const b = v + m, P = et({
      overrideDisabledPanels: s,
      panelConstraints: n[f],
      prevSize: v,
      size: b
    });
    if (l[f] = P, !de(P, b)) {
      let w = b - P, p = e < 0 ? d : u;
      for (; p >= 0 && p < n.length; ) {
        const S = l[p];
        X(
          S != null,
          `Previous layout not found for panel index ${p}`
        );
        const T = S + w, _ = et({
          overrideDisabledPanels: s,
          panelConstraints: n[p],
          prevSize: S,
          size: T
        });
        if (de(S, _) || (w -= _ - S, l[p] = _), de(w, 0))
          break;
        e > 0 ? p-- : p++;
      }
    }
  }
  const h = Object.values(l).reduce(
    (f, v) => v + f,
    0
  );
  if (!de(h, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return l.reduce((f, v, b) => (f[g[b]] = v, f), {});
}
function Ue(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || ve(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function He({
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
  if (!de(o, 100) && r.length > 0)
    for (let c = 0; c < t.length; c++) {
      const i = r[c];
      X(i != null, `No layout data found for index ${c}`);
      const l = 100 / o * i;
      r[c] = l;
    }
  let a = 0;
  for (let c = 0; c < t.length; c++) {
    const i = n[c];
    X(i != null, `No layout data found for index ${c}`);
    const l = r[c];
    X(l != null, `No layout data found for index ${c}`);
    const u = et({
      overrideDisabledPanels: !0,
      panelConstraints: t[c],
      prevSize: i,
      size: l
    });
    l != u && (a += l - u, r[c] = u);
  }
  if (!de(a, 0))
    for (let c = 0; c < t.length; c++) {
      const i = r[c];
      X(i != null, `No layout data found for index ${c}`);
      const l = i + a, u = et({
        overrideDisabledPanels: !0,
        panelConstraints: t[c],
        prevSize: i,
        size: l
      });
      if (i !== u && (a -= u - i, r[c] = u, de(a, 0)))
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
    const i = We();
    for (const [
      l,
      {
        defaultLayoutDeferred: u,
        derivedPanelConstraints: d,
        layout: m,
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
          layout: m,
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
    const m = a(), h = l.findIndex((v) => v.id === t), g = h === 0, f = h === l.length - 1;
    if (f && i < m && (g || l.slice(0, h).every((v, b) => {
      const P = d[b];
      return (P == null ? void 0 : P.collapsible) && de(P.collapsedSize, u[P.panelId]);
    }))) {
      const v = l.slice(0, h).reduce((b, P) => b + u[P.id], 0);
      return {
        ...u,
        [t]: fe(100 - v)
      };
    }
    return gt({
      delta: f ? m - i : i - m,
      initialLayout: u,
      panelConstraints: d,
      pivotIndices: f ? [h - 1, h] : [h, h + 1],
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
      group: m,
      groupSize: h,
      layout: g,
      separatorToPanels: f
    } = n(), v = s({
      nextSize: i,
      panels: m.panels,
      prevLayout: g,
      derivedPanelConstraints: d
    }), b = He({
      layout: v,
      panelConstraints: d
    });
    Ue(g, b) || Me(m, {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: d,
      groupSize: h,
      layout: b,
      separatorToPanels: f
    });
  };
  return {
    collapse: () => {
      const { collapsible: i, collapsedSize: l } = r(), { mutableValues: u } = o(), d = a();
      i && d !== l && (u.expandToSize = d, c(l));
    },
    expand: () => {
      const { collapsible: i, collapsedSize: l, minSize: u } = r(), { mutableValues: d } = o(), m = a();
      if (i && m === l) {
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
      return i && de(l, u);
    },
    resize: (i) => {
      const { group: l } = n(), { element: u } = o(), d = ot({ group: l }), m = dt({
        groupSize: d,
        panelElement: u,
        styleProp: i
      }), h = fe(m / d * 100);
      c(h);
    }
  };
}
function Sr(e) {
  if (e.defaultPrevented)
    return;
  const t = We();
  Mn(e, t).forEach((n) => {
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
function kt(e) {
  const t = We();
  for (const [n] of t)
    if (n.separators.some(
      (r) => r.element === e
    ))
      return n;
  throw Error("Could not find parent Group for separator element");
}
function Ro({
  groupId: e
}) {
  const t = () => {
    const n = We();
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
      } = t(), l = He({
        layout: n,
        panelConstraints: o
      });
      return r ? c : (Ue(c, l) || Me(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: l,
        separatorToPanels: i
      }), l);
    }
  };
}
function xe(e, t) {
  const n = kt(e), r = Ce(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  X(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  X(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), c = Ro({ groupId: n.id }).getLayout(), i = gt({
    delta: t,
    initialLayout: c,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: c,
    trigger: "keyboard"
  }), l = He({
    layout: i,
    panelConstraints: r.derivedPanelConstraints
  });
  Ue(c, l) || Me(
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
function wr(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = kt(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && xe(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && xe(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && xe(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && xe(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), xe(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = kt(t), o = Ce(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: c } = o, i = r.separators.find(
          (m) => m.element === t
        );
        X(i, "Matching separator not found");
        const l = c.get(i);
        X(l, "Matching panels not found");
        const u = l[0], d = a.find(
          (m) => m.panelId === u.id
        );
        if (X(d, "Panel metadata not found"), d.collapsible) {
          const m = s[u.id], h = d.collapsedSize === m ? r.mutableState.expandedPanelSizes[u.id] ?? d.minSize : d.collapsedSize;
          xe(t, h - m);
        }
        break;
      }
      case "F6": {
        e.preventDefault();
        const r = kt(t).separators.map(
          (s) => s.element
        ), o = Array.from(r).findIndex(
          (s) => s === e.currentTarget
        );
        X(o !== null, "Index not found");
        const a = e.shiftKey ? o > 0 ? o - 1 : r.length - 1 : o + 1 < r.length ? o + 1 : 0;
        r[a].focus({
          preventScroll: !0
        });
        break;
      }
      case "Home": {
        e.preventDefault(), xe(t, -100);
        break;
      }
    }
}
function Pr(e) {
  if (e.defaultPrevented || e.pointerType === "mouse" && e.button > 0)
    return;
  const t = We(), n = Mn(e, t), r = /* @__PURE__ */ new Map();
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
function Io({
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
    const { group: u, groupSize: d } = l, { orientation: m, panels: h } = u, { disableCursor: g } = u.mutableState;
    let f = 0;
    a ? m === "horizontal" ? f = (t.clientX - a.x) / d * 100 : f = (t.clientY - a.y) / d * 100 : m === "horizontal" ? f = t.clientX < 0 ? -100 : 100 : f = t.clientY < 0 ? -100 : 100;
    const v = r.get(u), b = o.get(u);
    if (!v || !b)
      return;
    const {
      defaultLayoutDeferred: P,
      derivedPanelConstraints: w,
      groupSize: p,
      layout: S,
      separatorToPanels: T
    } = b;
    if (w && S && T) {
      const _ = gt({
        delta: f,
        initialLayout: v,
        panelConstraints: w,
        pivotIndices: l.panels.map((O) => h.indexOf(O)),
        prevLayout: S,
        trigger: "mouse-or-touch"
      });
      if (Ue(_, S)) {
        if (f !== 0 && !g)
          switch (m) {
            case "horizontal": {
              c |= f < 0 ? po : go;
              break;
            }
            case "vertical": {
              c |= f < 0 ? bo : yo;
              break;
            }
          }
      } else
        Me(l.group, {
          defaultLayoutDeferred: P,
          derivedPanelConstraints: w,
          groupSize: p,
          layout: _,
          separatorToPanels: T
        });
    }
  });
  let i = 0;
  t.movementX === 0 ? i |= s & dr : i |= c & dr, t.movementY === 0 ? i |= s & fr : i |= c & fr, Ac(i), En(e);
}
function Rr(e) {
  const t = We(), n = Be();
  switch (n.state) {
    case "active":
      Io({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function Ir(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = Be(), n = We();
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
          const s = Ce(a.group.id, !0);
          Me(a.group, s, {
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
      Io({
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
      const a = Mn(e, n);
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
function Er(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (Be().state) {
      case "hover":
        nt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function Tr(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || So(e.currentTarget) && e.preventDefault();
}
function Mr(e) {
  let t = 0, n = 0;
  const r = {};
  for (const a of e)
    if (a.defaultSize !== void 0) {
      t++;
      const s = fe(a.defaultSize);
      n += s, r[a.panelId] = s;
    } else
      r[a.panelId] = void 0;
  const o = e.length - t;
  if (o !== 0) {
    const a = fe((100 - n) / o);
    for (const s of e)
      s.defaultSize === void 0 && (r[s.panelId] = a);
  }
  return r;
}
function Bc(e, t, n) {
  if (!n[0])
    return;
  const r = e.panels.find((i) => i.element === t);
  if (!r || !r.onResize)
    return;
  const o = ot({ group: e }), a = e.orientation === "horizontal" ? r.element.offsetWidth : r.element.offsetHeight, s = r.mutableValues.prevSize, c = {
    asPercentage: fe(a / o * 100),
    inPixels: a
  };
  r.mutableValues.prevSize = c, r.onResize(c, r.id, s);
}
function Uc(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function Hc({
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
    const m = r[d.id] ?? 0;
    switch (d.panelConstraints.groupResizeBehavior) {
      case "preserve-pixel-size": {
        s = !0;
        const h = m / 100 * n, g = fe(
          h / t * 100
        );
        c.set(d.id, g), o += g;
        break;
      }
      case "preserve-relative-size":
      default: {
        i.push(d.id), a += m;
        break;
      }
    }
  }
  if (!s || i.length === 0)
    return r;
  const l = 100 - o, u = { ...r };
  if (c.forEach((d, m) => {
    u[m] = d;
  }), a > 0)
    for (const d of i) {
      const m = r[d] ?? 0;
      u[d] = fe(
        m / a * l
      );
    }
  else {
    const d = fe(
      l / i.length
    );
    for (const m of i)
      u[m] = d;
  }
  return u;
}
function Wc(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const Ye = /* @__PURE__ */ new Map();
function Vc(e) {
  let t = !0;
  X(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const f of g) {
      const { borderBoxSize: v, target: b } = f;
      if (b === e.element) {
        if (t) {
          const P = ot({ group: e });
          if (P === 0)
            return;
          const w = Ce(e.id);
          if (!w)
            return;
          const p = cn(e), S = w.defaultLayoutDeferred ? Mr(p) : w.layout, T = Hc({
            group: e,
            nextGroupSize: P,
            prevGroupSize: w.groupSize,
            prevLayout: S
          }), _ = He({
            layout: T,
            panelConstraints: p
          });
          if (!w.defaultLayoutDeferred && Ue(w.layout, _) && Uc(
            w.derivedPanelConstraints,
            p
          ) && w.groupSize === P)
            return;
          Me(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: p,
            groupSize: P,
            layout: _,
            separatorToPanels: w.separatorToPanels
          });
        }
      } else
        Bc(e, b, v);
    }
  });
  a.observe(e.element), e.panels.forEach((g) => {
    X(
      !r.has(g.id),
      `Panel ids must be unique; id "${g.id}" was used more than once`
    ), r.add(g.id), g.onResize && a.observe(g.element);
  });
  const s = ot({ group: e }), c = cn(e), i = e.panels.map(({ id: g }) => g).join(",");
  let l = e.mutableState.defaultLayout;
  l && (Wc(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[i] ?? l ?? Mr(c), d = He({
    layout: u,
    panelConstraints: c
  }), m = e.element.ownerDocument;
  Ye.set(
    m,
    (Ye.get(m) ?? 0) + 1
  );
  const h = /* @__PURE__ */ new Map();
  return mo(e).forEach((g) => {
    g.separator && h.set(g.separator, g.panels);
  }), Me(e, {
    defaultLayoutDeferred: s === 0,
    derivedPanelConstraints: c,
    groupSize: s,
    layout: d,
    separatorToPanels: h
  }), e.separators.forEach((g) => {
    X(
      !o.has(g.id),
      `Separator ids must be unique; id "${g.id}" was used more than once`
    ), o.add(g.id), g.element.addEventListener("keydown", wr);
  }), Ye.get(m) === 1 && (m.addEventListener("contextmenu", gr, !0), m.addEventListener("dblclick", Sr, !0), m.addEventListener("pointerdown", Pr, !0), m.addEventListener("pointerleave", Rr), m.addEventListener("pointermove", Ir), m.addEventListener("pointerout", Er), m.addEventListener("pointerup", Tr, !0)), function() {
    t = !1, Ye.set(
      m,
      Math.max(0, (Ye.get(m) ?? 0) - 1)
    ), Nc(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", wr);
    }), Ye.get(m) || (m.removeEventListener(
      "contextmenu",
      gr,
      !0
    ), m.removeEventListener(
      "dblclick",
      Sr,
      !0
    ), m.removeEventListener(
      "pointerdown",
      Pr,
      !0
    ), m.removeEventListener("pointerleave", Rr), m.removeEventListener("pointermove", Ir), m.removeEventListener("pointerout", Er), m.removeEventListener("pointerup", Tr, !0)), a.disconnect();
  };
}
function Jc() {
  const [e, t] = N({}), n = $(() => t({}), []);
  return [e, n];
}
function An(e) {
  const t = Cr();
  return `${e ?? t}`;
}
const Ve = typeof window < "u" ? Ae : x;
function ft(e) {
  const t = A(e);
  return Ve(() => {
    t.current = e;
  }, [e]), $(
    (...n) => {
      var r;
      return (r = t.current) == null ? void 0 : r.call(t, ...n);
    },
    [t]
  );
}
function kn(...e) {
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
function _n(e) {
  const t = A({ ...e });
  return Ve(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const Eo = hn(null);
function Gc(e, t) {
  const n = A({
    getLayout: () => ({}),
    setLayout: kc
  });
  gn(t, () => n.current, []), Ve(() => {
    Object.assign(
      n.current,
      Ro({ groupId: e })
    );
  });
}
function To({
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
  style: m,
  ...h
}) {
  const g = A({
    onLayoutChange: {},
    onLayoutChanged: {}
  }), f = ft((R) => {
    Ue(g.current.onLayoutChange, R) || (g.current.onLayoutChange = R, i == null || i(R));
  }), v = ft(
    (R, I) => {
      Ue(g.current.onLayoutChanged, R) || (g.current.onLayoutChanged = R, l == null || l(R, { isUserInteraction: I }));
    }
  ), b = An(c), P = A(null), [w, p] = Jc(), S = A({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: d,
    separators: []
  }), T = kn(P, a);
  Gc(b, s);
  const _ = ft(
    (R, I) => {
      const E = Be(), M = pr(R), F = Ce(R);
      if (F) {
        let K = !1;
        switch (E.state) {
          case "active": {
            K = E.hitRegions.some(
              (D) => D.group === M
            );
            break;
          }
        }
        return {
          flexGrow: F.layout[I] ?? 1,
          pointerEvents: K ? "none" : void 0
        };
      }
      if (n != null && n[I])
        return {
          flexGrow: n == null ? void 0 : n[I]
        };
    }
  ), O = _n({
    defaultLayout: n,
    disableCursor: r
  }), L = Y(
    () => ({
      get disableCursor() {
        return !!O.disableCursor;
      },
      getPanelStyles: _,
      id: b,
      orientation: u,
      registerPanel: (R) => {
        const I = S.current;
        return I.panels = ln(u, [
          ...I.panels,
          R
        ]), p(), () => {
          I.panels = I.panels.filter(
            (E) => E !== R
          ), p();
        };
      },
      registerSeparator: (R) => {
        const I = S.current;
        return I.separators = ln(u, [
          ...I.separators,
          R
        ]), p(), () => {
          I.separators = I.separators.filter(
            (E) => E !== R
          ), p();
        };
      },
      updatePanelProps: (R, { disabled: I }) => {
        const E = S.current.panels.find(
          (K) => K.id === R
        );
        E && (E.panelConstraints.disabled = I);
        const M = pr(b), F = Ce(b);
        M && F && Me(M, {
          ...F,
          derivedPanelConstraints: cn(M)
        });
      },
      updateSeparatorProps: (R, {
        disabled: I,
        disableDoubleClick: E
      }) => {
        const M = S.current.separators.find(
          (F) => F.id === R
        );
        M && (M.disabled = I, M.disableDoubleClick = E);
      }
    }),
    [_, b, p, u, O]
  ), C = A(null);
  return Ve(() => {
    const R = P.current;
    if (R === null)
      return;
    const I = S.current;
    let E;
    if (O.defaultLayout !== void 0 && Object.keys(O.defaultLayout).length === I.panels.length) {
      E = {};
      for (const V of I.panels) {
        const ne = O.defaultLayout[V.id];
        ne !== void 0 && (E[V.id] = ne);
      }
    }
    const M = {
      disabled: !!o,
      element: R,
      id: b,
      mutableState: {
        defaultLayout: E,
        disableCursor: !!O.disableCursor,
        expandedPanelSizes: S.current.lastExpandedPanelSizes,
        layouts: S.current.layouts
      },
      orientation: u,
      panels: I.panels,
      resizeTargetMinimumSize: I.resizeTargetMinimumSize,
      separators: I.separators
    };
    C.current = M;
    const F = Vc(M), { defaultLayoutDeferred: K, derivedPanelConstraints: D, layout: G } = Ce(M.id, !0);
    !K && D.length > 0 && (f(G), v(G, !1));
    const U = Tn(b, (V) => {
      const { defaultLayoutDeferred: ne, derivedPanelConstraints: me, layout: re } = V.next;
      if (ne || me.length === 0)
        return;
      const oe = M.panels.map(({ id: B }) => B).join(",");
      M.mutableState.layouts[oe] = re, me.forEach((B) => {
        if (B.collapsible) {
          const { layout: Z } = V.prev ?? {};
          if (Z) {
            const pe = de(
              B.collapsedSize,
              re[B.panelId]
            ), ae = de(
              B.collapsedSize,
              Z[B.panelId]
            );
            pe && !ae && (M.mutableState.expandedPanelSizes[B.panelId] = Z[B.panelId]);
          }
        }
      });
      const j = Be().state !== "active";
      f(re), j && v(re, V.isUserInteraction);
    });
    return () => {
      C.current = null, F(), U();
    };
  }, [
    o,
    b,
    v,
    f,
    u,
    w,
    O
  ]), x(() => {
    const R = C.current;
    R && (R.mutableState.defaultLayout = n, R.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ y(Eo.Provider, { value: L, children: /* @__PURE__ */ y(
    "div",
    {
      ...h,
      className: t,
      "data-group": !0,
      "data-testid": b,
      id: b,
      ref: T,
      style: {
        height: "100%",
        width: "100%",
        overflow: "hidden",
        ...m,
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
To.displayName = "Group";
function Nn() {
  const e = pn(Eo);
  return X(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function qc(e, t) {
  const { id: n } = Nn(), r = A({
    collapse: Kt,
    expand: Kt,
    getSize: () => ({
      asPercentage: 0,
      inPixels: 0
    }),
    isCollapsed: () => !1,
    resize: Kt
  });
  gn(t, () => r.current, []), Ve(() => {
    Object.assign(
      r.current,
      Po({ groupId: n, panelId: e })
    );
  });
}
function un({
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
  panelRef: m,
  style: h,
  ...g
}) {
  const f = !!i, v = An(i), b = _n({
    disabled: a
  }), P = A(null), w = kn(P, s), {
    getPanelStyles: p,
    id: S,
    orientation: T,
    registerPanel: _,
    updatePanelProps: O
  } = Nn(), L = d !== null, C = ft(
    (M, F, K) => {
      d == null || d(M, i, K);
    }
  );
  Ve(() => {
    const M = P.current;
    if (M !== null) {
      const F = {
        element: M,
        id: v,
        idIsStable: f,
        mutableValues: {
          expandToSize: void 0,
          prevSize: void 0
        },
        onResize: L ? C : void 0,
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
      return _(F);
    }
  }, [
    c,
    n,
    r,
    o,
    L,
    v,
    f,
    l,
    u,
    C,
    _,
    b
  ]), x(() => {
    O(v, { disabled: a });
  }, [a, v, O]), qc(v, m);
  const R = () => {
    const M = p(S, v);
    if (M)
      return JSON.stringify(M);
  }, I = Lr(
    (M) => Tn(S, M),
    R,
    R
  );
  let E;
  return I ? E = JSON.parse(I) : o !== void 0 ? E = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : E = { flexGrow: 1 }, /* @__PURE__ */ y(
    "div",
    {
      ...g,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": v,
      id: v,
      ref: w,
      style: {
        ...Kc,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...E
      },
      children: /* @__PURE__ */ y(
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
            touchAction: T === "horizontal" ? "pan-y" : "pan-x"
          },
          children: e
        }
      )
    }
  );
}
un.displayName = "Panel";
const Kc = {
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
function Zc({
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
    a = He({
      layout: gt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = He({
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
function Mo({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...c
}) {
  const i = An(a), l = _n({
    disabled: n,
    disableDoubleClick: r
  }), [u, d] = N({}), [m, h] = N("inactive"), [g, f] = N(!1), v = A(null), b = kn(v, o), {
    disableCursor: P,
    id: w,
    orientation: p,
    registerSeparator: S,
    updateSeparatorProps: T
  } = Nn(), _ = p === "horizontal" ? "vertical" : "horizontal";
  Ve(() => {
    const C = v.current;
    if (C !== null) {
      const R = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: C,
        id: i
      }, I = S(R), E = Mc(
        (F) => {
          h(
            F.next.state !== "inactive" && F.next.hitRegions.some(
              (K) => K.separator === R
            ) ? F.next.state : "inactive"
          );
        }
      ), M = Tn(
        w,
        (F) => {
          const { derivedPanelConstraints: K, layout: D, separatorToPanels: G } = F.next, U = G.get(R);
          if (U) {
            const V = U[0], ne = U.indexOf(V);
            d(
              Zc({
                layout: D,
                panelConstraints: K,
                panelId: V.id,
                panelIndex: ne
              })
            );
          }
        }
      );
      return () => {
        E(), M(), I();
      };
    }
  }, [w, i, S, l]), x(() => {
    T(i, { disabled: n, disableDoubleClick: r });
  }, [n, r, i, T]);
  let O;
  n && !P && (O = "not-allowed");
  let L;
  if (n)
    L = "disabled";
  else
    switch (m) {
      case "active": {
        L = "active";
        break;
      }
      default:
        g ? L = "focus" : L = m;
    }
  return /* @__PURE__ */ y(
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
      "data-separator": L,
      "data-testid": i,
      id: i,
      onBlur: () => f(!1),
      onFocus: () => f(!0),
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
Mo.displayName = "Separator";
const Ln = 30, Cn = 65, bt = 50, Yc = 100 - Cn, Xc = 100 - Ln;
function Qc(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(Cn, Math.max(Ln, t)) : bt;
}
function Dn(e) {
  return 100 - e;
}
function Xe(e) {
  return `${e}%`;
}
const zn = "reader-document", yt = "reader-assistant", Ao = "retainpdf.reader.ai-split-layout.v1", el = {
  [zn]: Dn(bt),
  [yt]: bt
};
function xn(e) {
  const t = Qc(e == null ? void 0 : e[yt]);
  return {
    [zn]: Dn(t),
    [yt]: t
  };
}
function tl() {
  try {
    const e = JSON.parse(localStorage.getItem(Ao) || "null");
    return xn(e);
  } catch {
    return el;
  }
}
function nl(e) {
  try {
    localStorage.setItem(Ao, JSON.stringify(xn(e)));
  } catch {
  }
}
function Zt(e, t) {
  const n = e == null ? void 0 : e.closest(".reader-react-root");
  if (!n) return;
  const r = xn(t);
  n.style.setProperty(
    "--reader-ai-split-width",
    `${r[yt]}vw`
  );
}
function rl() {
  const e = A(null), [t] = N(tl);
  Ae(() => {
    const o = e.current;
    return Zt(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = $((o) => {
    Zt(e.current, o);
  }, []), r = $((o, a) => {
    Zt(e.current, o), a.isUserInteraction && nl(o);
  }, []);
  return /* @__PURE__ */ z(
    To,
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
        /* @__PURE__ */ y(
          un,
          {
            id: zn,
            defaultSize: Xe(Dn(bt)),
            minSize: Xe(Yc),
            maxSize: Xe(Xc)
          }
        ),
        /* @__PURE__ */ y(
          Mo,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ y("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ y(
          un,
          {
            id: yt,
            defaultSize: Xe(bt),
            minSize: Xe(Ln),
            maxSize: Xe(Cn)
          }
        )
      ]
    }
  );
}
function ol({
  regionsFailed: e = !1,
  metadataFailed: t = !1
}) {
  const [n, r] = N(!1);
  if (x(() => {
    !e && !t && r(!1);
  }, [e, t]), n || !e && !t)
    return null;
  const o = [
    e ? "译文区域" : "",
    t ? "阅读元数据" : ""
  ].filter(Boolean);
  return /* @__PURE__ */ z("div", { className: "reader-error-notice", role: "status", "data-reader-error-notice": "true", children: [
    /* @__PURE__ */ z("span", { className: "reader-error-notice-text", children: [
      o.join("、"),
      "加载失败，正文仍可正常阅读。"
    ] }),
    /* @__PURE__ */ y(
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
function al({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1
}) {
  return !e && !t ? /* @__PURE__ */ y(ol, { regionsFailed: o, metadataFailed: a }) : /* @__PURE__ */ z(vt, { children: [
    e ? /* @__PURE__ */ y("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ z("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ y("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ y("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ y(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ y("div", { className: "reader-react-error", role: "alert", children: n }) : null
  ] });
}
function sl(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function il() {
  const [e, t] = N(!1), n = Cr(), r = A(null);
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
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || sl(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((c) => !c);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
  }, []), /* @__PURE__ */ z("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
    /* @__PURE__ */ y(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-react-shortcuts-btn${e ? " is-active" : ""}`,
        "aria-label": "快捷键说明",
        "aria-expanded": e,
        "aria-controls": n,
        title: "快捷键（H 或 ?）",
        onClick: () => t((o) => !o),
        children: /* @__PURE__ */ y(Yo, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
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
            /* @__PURE__ */ y("strong", { children: "快捷键" }),
            /* @__PURE__ */ y(
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
          /* @__PURE__ */ y("div", { className: "reader-react-shortcuts-body", children: li.map((o) => /* @__PURE__ */ z("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ y("h3", { children: o.title }),
            /* @__PURE__ */ y("ul", { children: o.items.map((a) => /* @__PURE__ */ z("li", { children: [
              /* @__PURE__ */ y("kbd", { children: a.keys }),
              /* @__PURE__ */ y("span", { children: a.desc })
            ] }, `${o.title}-${a.keys}`)) })
          ] }, o.title)) }),
          /* @__PURE__ */ y("p", { className: "reader-react-shortcuts-foot", children: "在输入框内不会触发快捷键" })
        ]
      }
    ) : null
  ] });
}
const cl = ["source", "sideBySide", "translated"], ll = { source: "", translated: "", sideBySide: "" };
function ul(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = _t(e.sourceUrl), n = _t(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return ba({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function dl(e) {
  const [t, n] = N(() => /* @__PURE__ */ new Set()), r = Y(
    () => e ? ul(e) : ll,
    [e]
  ), o = Y(
    () => cl.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = $(async (s) => {
    if (!e) return;
    const c = _t(r[s]);
    if (!(!c || t.has(s)))
      try {
        const i = e.jobId ? ga(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await ya(
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
        va(l), n((u) => {
          const d = new Set(u);
          return d.delete(s), d;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const fl = {
  source: zr,
  sideBySide: xr,
  translated: Or
}, ml = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function hl(e) {
  const t = De(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = dl(n), c = A(null);
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
  }, []), /* @__PURE__ */ z("details", { ref: c, className: "reader-download-actions", children: [
    /* @__PURE__ */ z("summary", { className: "reader-download-trigger", "aria-label": "下载 PDF", title: "下载 PDF", children: [
      /* @__PURE__ */ y(Xo, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ y("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ y(Qo, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ y("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((i) => {
      const l = zo[i], u = _t(r[i]), d = a.has(i), m = !!u && !d, h = m ? "" : xo(i, r), g = fl[i];
      return /* @__PURE__ */ z(
        "button",
        {
          type: "button",
          id: `reader-download-${i}`,
          className: `reader-download-action${d ? " is-busy" : ""}`,
          disabled: !m,
          "aria-label": m ? `下载${l.label}` : h,
          onClick: () => {
            c.current && (c.current.open = !1), s(i);
          },
          children: [
            /* @__PURE__ */ y(g, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ z("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ z("span", { className: "reader-download-action-label", children: [
                ml[i],
                " PDF"
              ] }),
              h ? /* @__PURE__ */ y("span", { className: "reader-download-action-reason", children: h }) : null
            ] })
          ]
        },
        i
      );
    }) })
  ] });
}
const pl = "retainpdf:reader:bookmarks:v1:", gl = 200;
function On() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function ko(e) {
  const t = `${e || ""}`.trim();
  return t ? `${pl}${t}` : "";
}
function bl(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function Ot(e, t = On()) {
  const n = ko(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = bl(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function dn(e, t, n) {
  const r = ko(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, gl);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function yl(e, t, n = "", { storage: r = On(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = Ot(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((c) => c.page === s) ? dn(e, a.filter((c) => c.page !== s), r) : dn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function vl(e, t, n = On()) {
  return dn(e, Ot(e, n).filter((r) => r.page !== t), n);
}
function Sl(e, t) {
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
function wl({ filled: e }) {
  return /* @__PURE__ */ y("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ y("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function Pl({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = N(() => Ot(e)), [c, i] = N(!1), l = A(null);
  if (x(() => {
    s(Ot(e)), i(!1);
  }, [e]), x(() => {
    if (!c) return;
    const m = (g) => {
      l.current && !l.current.contains(g.target) && i(!1);
    }, h = (g) => {
      g.key === "Escape" && i(!1);
    };
    return document.addEventListener("pointerdown", m), document.addEventListener("keydown", h), () => {
      document.removeEventListener("pointerdown", m), document.removeEventListener("keydown", h);
    };
  }, [c]), !e || n <= 0) return null;
  const u = Math.min(Math.max(t, 1), n), d = a.some((m) => m.page === u);
  return /* @__PURE__ */ z("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: l, children: [
    /* @__PURE__ */ y(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${d ? " is-marked" : ""}`,
        "aria-pressed": d,
        "aria-label": d ? `取消第 ${u} 页的书签` : `给第 ${u} 页加书签`,
        title: d ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(yl(e, u, Sl(r, u))),
        children: /* @__PURE__ */ y(wl, { filled: d })
      }
    ),
    /* @__PURE__ */ y(
      "button",
      {
        type: "button",
        className: "reader-react-hud-btn reader-bookmark-list-btn",
        "aria-expanded": c,
        "aria-haspopup": "true",
        "aria-label": `书签列表，共 ${a.length} 个`,
        title: "书签列表",
        disabled: !a.length,
        onClick: () => i((m) => !m),
        children: a.length
      }
    ),
    c && a.length ? /* @__PURE__ */ y("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ y("ol", { className: "reader-bookmark-list", children: a.map((m) => /* @__PURE__ */ z("li", { className: m.page === u ? "is-current" : "", children: [
      /* @__PURE__ */ z(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(m.page, n)), i(!1);
          },
          children: [
            /* @__PURE__ */ z("span", { className: "reader-bookmark-page", children: [
              "第 ",
              m.page,
              " 页"
            ] }),
            m.label ? /* @__PURE__ */ y("span", { className: "reader-bookmark-label", children: m.label }) : null
          ]
        }
      ),
      /* @__PURE__ */ y(
        "button",
        {
          type: "button",
          className: "reader-bookmark-remove",
          "aria-label": `删除第 ${m.page} 页的书签`,
          onClick: () => s(vl(e, m.page)),
          children: "×"
        }
      )
    ] }, m.page)) }) }) : null
  ] });
}
function Rl(e) {
  const t = De(), n = io(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? St, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), c = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, i = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = us(a), d = a > Ur + 1e-3, m = a < zt - 1e-3, h = Qe(r, $e()), g = h >= zt ? "100%（铺满阅读区）" : "50%（半屏，对照铺满）", [f, v] = N(!1), [b, P] = N(`${c}`);
  x(() => {
    f || P(`${Math.min(Math.max(c, 1), Math.max(i, 1))}`);
  }, [c, i, f]);
  const w = () => {
    if (v(!1), !l || i <= 0)
      return;
    const p = Number(`${b}`.trim());
    l(xt(p, i));
  };
  return /* @__PURE__ */ z("div", { className: "reader-react-hud", "data-reader-hud": "true", children: [
    o ? /* @__PURE__ */ y("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ y("div", { className: "reader-react-hud-group", "aria-label": "页码", children: f ? /* @__PURE__ */ z(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (p) => {
          p.preventDefault(), w();
        },
        children: [
          /* @__PURE__ */ y(
            "input",
            {
              className: "reader-react-hud-page-input",
              type: "text",
              inputMode: "numeric",
              pattern: "[0-9]*",
              "aria-label": "跳转到页码",
              value: b,
              autoFocus: !0,
              onChange: (p) => P(p.target.value.replace(/[^\d]/g, "")),
              onBlur: w,
              onKeyDown: (p) => {
                p.key === "Escape" && (p.preventDefault(), v(!1), P(`${c}`));
              }
            }
          ),
          /* @__PURE__ */ z("span", { className: "reader-react-hud-page-suffix", children: [
            "/ ",
            i || "—"
          ] })
        ]
      }
    ) : /* @__PURE__ */ y(
      "button",
      {
        type: "button",
        className: "reader-react-hud-page reader-react-hud-page-btn",
        "aria-label": i > 0 ? `跳转页码，当前第 ${c} 页，共 ${i} 页` : "页码",
        title: i > 0 ? "点击输入页码跳转" : void 0,
        disabled: !l || i <= 0,
        onClick: () => {
          !l || i <= 0 || (P(`${c}`), v(!0));
        },
        children: i > 0 ? `${Math.min(c, i)} / ${i}` : "—"
      }
    ) }),
    e.bookmarkScope ? /* @__PURE__ */ y(
      Pl,
      {
        scope: e.bookmarkScope,
        currentPage: c,
        numPages: i,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
      }
    ) : null,
    /* @__PURE__ */ z("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ y(
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
      /* @__PURE__ */ z(
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
      /* @__PURE__ */ y(
        "button",
        {
          type: "button",
          className: "reader-react-hud-btn",
          "aria-label": "放大",
          disabled: !m,
          onClick: () => s(ht(a, 1)),
          children: "+"
        }
      )
    ] }),
    /* @__PURE__ */ y("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ y(il, {}) })
  ] });
}
function Ar(e) {
  var t, n;
  return Jr(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function Il(e) {
  const [t, n] = N(() => ({
    scope: e,
    panel: Ar(we(e))
  }));
  x(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Ar(we(e))
    });
  }, [e]), x(() => {
    t.scope === e && jt(t.scope, {
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
const fn = "download-toast";
function El({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ z("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ z("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ y("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ y("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ y("div", { className: "download-toast-track", children: /* @__PURE__ */ y("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ y("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function Tl(e = {}) {
  const {
    visible: t = !1,
    title: n = "下载中",
    status: r = "正在准备...",
    meta: o = "等待响应...",
    percent: a = NaN,
    tone: s = "progress"
  } = e;
  if (!t) {
    Xt.dismiss(fn);
    return;
  }
  Xt.custom(
    () => /* @__PURE__ */ y(El, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: fn, duration: 1 / 0 }
  );
}
function Ml() {
  const e = $((t) => {
    t && (t.setState = Tl, t.hide = () => Xt.dismiss(fn));
  }, []);
  return /* @__PURE__ */ z(vt, { children: [
    /* @__PURE__ */ y(qo, { position: "bottom-right" }),
    /* @__PURE__ */ y("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function Al(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : Hr(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function kl(e, t) {
  return t === null || e !== t;
}
function _l(e) {
  const t = A(!1);
  return e && (t.current = !0), t.current;
}
function Nl(e, t) {
  const n = e === t;
  return { open: n, mounted: _l(n) };
}
const kr = { itemId: null, origin: null };
function Ll() {
  let e = kr;
  const t = /* @__PURE__ */ new Set();
  return {
    get: () => e,
    set(n, r) {
      if (!(e.itemId === n && (n === null || e.origin === r))) {
        e = n === null ? kr : { itemId: n, origin: r };
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
const Fe = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), Cl = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Dl = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, zl = {
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
}, _r = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function xl(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => _r(o ?? a ?? "", Cl)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => _r(o ?? a ?? "", Dl)).replace(/\\([a-zA-Z]+)/gu, (r, o) => zl[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Ol(e) {
  return Fe(e.translatedBlockText) || Fe(e.translated.text) || Fe(e.source.text);
}
const Fl = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function $l(e) {
  const t = [];
  for (const n of e) {
    if (!Fl(n)) continue;
    const r = xl(Ol(n)), o = Number(n.source.page);
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
const Bl = 24, Ul = 60;
function Nr(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - Bl), o = Math.min(e.length, n + t.length + Ul), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function Hl(e, t, n = 200) {
  const r = Fe(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const c = Fe(a.translatedBlockText) || Fe(a.translated.text), i = c ? Nr(c, r) : null, l = i ?? Nr(Fe(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: i ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
const Wl = [];
function Vl({ open: e, onToggle: t }) {
  return /* @__PURE__ */ z("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ z(Oe, { className: "reader-finder-toggle", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: [
      /* @__PURE__ */ y(ea, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ y("span", { children: "目录" })
    ] }),
    /* @__PURE__ */ z(Oe, { className: "reader-finder-toggle", "aria-pressed": e === "search", title: "在书里搜索（原文和译文）", onClick: () => t("search"), children: [
      /* @__PURE__ */ y(ta, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ y("span", { children: "搜索" })
    ] })
  ] });
}
function Jl({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r
}) {
  var h, g;
  const o = ((h = De()) == null ? void 0 : h.regions) ?? Wl, a = ((g = io()) == null ? void 0 : g.currentPage) ?? 1, s = Y(() => $l(o), [o]), c = jl(s, a), [i, l] = N(""), u = Y(() => Hl(o, i), [o, i]), d = A(null), m = A(null);
  return x(() => {
    var f, v, b;
    e === "search" ? (f = d.current) == null || f.focus() : (b = (v = m.current) == null ? void 0 : v.querySelector('[aria-current="location"]')) == null || b.scrollIntoView({ block: "center" });
  }, [e]), /* @__PURE__ */ z("aside", { className: "reader-finder", "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ z("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ z("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ y(Oe, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ y(Oe, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ y(Oe, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ y(vn, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" ? s.length ? /* @__PURE__ */ y("ol", { ref: m, className: "reader-finder-list", children: s.map((f, v) => /* @__PURE__ */ y("li", { children: /* @__PURE__ */ z(
      Oe,
      {
        className: "reader-finder-entry",
        "data-level": f.level,
        "aria-current": v === c ? "location" : void 0,
        onClick: () => r(f.itemId),
        children: [
          /* @__PURE__ */ y("span", { className: "reader-finder-entry-text", children: f.text }),
          /* @__PURE__ */ y("span", { className: "reader-finder-entry-page", children: f.page })
        ]
      }
    ) }, f.itemId)) }) : /* @__PURE__ */ y("p", { className: "reader-finder-empty", children: o.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ z(vt, { children: [
      /* @__PURE__ */ z("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ y(
          na,
          {
            ref: d,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "原文、译文里的字",
            "aria-label": "在书里搜索",
            value: i,
            onChange: (f) => l(f.target.value),
            onKeyDown: (f) => {
              f.key === "Enter" && u[0] && r(u[0].itemId), f.stopPropagation();
            }
          }
        ),
        i.trim() ? /* @__PURE__ */ y("p", { className: "reader-finder-count", children: u.length >= 200 ? "200 处以上，只列前 200 处" : `${u.length} 处` }) : null
      ] }),
      /* @__PURE__ */ y("ol", { className: "reader-finder-list", children: u.map((f) => /* @__PURE__ */ y("li", { children: /* @__PURE__ */ z(Oe, { className: "reader-finder-entry is-hit", onClick: () => r(f.itemId), children: [
        /* @__PURE__ */ z("span", { className: "reader-finder-entry-text", children: [
          f.snippet.slice(0, f.at),
          /* @__PURE__ */ y("mark", { children: f.snippet.slice(f.at, f.at + f.length) }),
          f.snippet.slice(f.at + f.length)
        ] }),
        /* @__PURE__ */ y("span", { className: "reader-finder-entry-page", children: f.page })
      ] }) }, f.itemId)) })
    ] })
  ] });
}
const Gl = Lo(() => import("./ReaderMarkdownPanel-DlVwOnci.js").then((e) => ({ default: e.ReaderMarkdownPanel })));
function ql(e) {
  const t = e.sourceOnly || !e.translatedUrl, n = !!(e.overlayContentAvailable && e.liveTranslationVisible && !e.assistantOpen), o = e.assistantPdfPane || (e.assistantOpen && e.mode === "compare" ? "source" : e.mode), a = !t && (o === "translated" || o === "compare");
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
function Kl(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function Zl() {
  const e = ii(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = Il(e.viewStateKey), s = a.panel, c = a.setPanel, [i, l] = N(null), [u, d] = N(!1), m = A(null), h = A(null), g = s !== null, f = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, v = ql({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: f,
    liveTranslationVisible: u,
    assistantOpen: g,
    assistantPdfPane: i
  }), b = Xs({
    hasOverlayContent: f,
    connection: e.liveTranslation.connection,
    showSource: v.showSource,
    liveTranslationVisible: u,
    assistantOpen: g
  }), P = v.sourceViewOnly, w = v.visibleMode;
  x(() => {
    d(!1);
  }, [e.viewStateKey]), x(() => {
    e.session.jobTerminal && d(!1);
  }, [e.session.jobTerminal]), x(() => {
    l(null);
  }, [a.scope]), x(() => {
    if (!(t.loading || t.failed)) {
      if (m.current !== e.viewStateKey) {
        m.current = e.viewStateKey;
        const U = we(e.viewStateKey), V = Al({
          savedMode: U == null ? void 0 : U.mode,
          sourceViewOnly: P,
          viewportWidth: $e()
        });
        h.current = V.auto ? V.mode : null, V.mode && V.mode !== e.mode && e.setModeKeepingPage(V.mode);
        return;
      }
      kl(e.mode, h.current) && (h.current = null, jt(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, P]);
  const p = s || (e.mode === "compare" ? "compare" : "reading"), S = Nl(s, "markdown");
  hi({
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
  const T = $(() => {
    c(null), l(null);
  }, []), _ = $((U) => {
    l(null);
    const V = Kl(U, e.liveTranslationAvailable);
    V !== null && d(V), e.setModeKeepingPage(U);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), O = Y(() => b.sourcePaneToggle ? /* @__PURE__ */ y(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${u ? " is-active" : ""}`,
      onClick: () => d((U) => !U),
      "aria-pressed": u,
      title: u ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [b.sourcePaneToggle, u]), L = $((U) => {
    c(U), l(null);
  }, []), [C] = N(Ll), [R, I] = N(null), E = $((U) => I((V) => V === U ? null : U), []), M = $((U) => {
    e.jumpToAnchor({ block_id: U }), $e() < 900 && I(null);
  }, [e.jumpToAnchor]), F = $((U) => e.jumpToAnchor({ block_id: U }), [e.jumpToAnchor]), K = Y(() => ({
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
    regionHover: C,
    jumpToBlock: F,
    revisedBlocks: e.revisedBlocks,
    sourceOnly: e.sourceOnly,
    sourceViewOnly: P,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: L, close: T }
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
    C,
    F,
    e.revisedBlocks,
    e.sourceOnly,
    P,
    e.download,
    e.goToPage,
    L,
    T
  ]), D = Y(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), G = [
    ts,
    `is-workspace-${p}`,
    g ? "is-assistant-open" : "",
    R ? "is-finder-open" : "",
    v.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ y(Ui, { value: K, hud: D, children: /* @__PURE__ */ z("div", { className: G, "data-reader-engine": "react-pdf", "data-reader-workspace": p, children: [
    /* @__PURE__ */ y(al, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata }),
    /* @__PURE__ */ y(Vl, { open: R, onToggle: E }),
    R ? /* @__PURE__ */ y(
      Jl,
      {
        tab: R,
        onTab: I,
        onClose: () => I(null),
        onJump: M
      }
    ) : null,
    /* @__PURE__ */ z("div", { className: "reader-chrome-tray", children: [
      /* @__PURE__ */ y(gc, { active: s }),
      /* @__PURE__ */ y(hl, {}),
      /* @__PURE__ */ y(wi, { onBeforeClose: o.prepareClose })
    ] }),
    /* @__PURE__ */ y(
      mc,
      {
        mode: w,
        documentReady: !!o.jobId,
        sourceViewOnly: P,
        onModeChange: _,
        liveTranslation: b.topBarPill ? {
          visible: u,
          state: e.liveTranslation,
          onToggle: () => d((U) => !U)
        } : null
      }
    ),
    /* @__PURE__ */ y(bc, { active: s }),
    g ? /* @__PURE__ */ y(rl, {}) : null,
    /* @__PURE__ */ y(lc, { paneComposition: v, markdownSplit: S.open, assistantSplit: g, liveTranslation: e.liveTranslation, sourcePaneAction: O }),
    e.showHud ? /* @__PURE__ */ y(
      Rl,
      {
        mode: w,
        modeControls: null,
        bookmarkScope: e.viewStateKey
      }
    ) : null,
    /* @__PURE__ */ y(No, { fallback: null, children: S.mounted ? /* @__PURE__ */ y(Gl, { open: S.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: T }) : null }),
    /* @__PURE__ */ y(Ml, {})
  ] }) });
}
function pu() {
  return /* @__PURE__ */ y(Zl, {});
}
export {
  pu as R,
  Zl as a,
  mu as d,
  fu as f,
  hu as r,
  De as u
};
//# sourceMappingURL=ReaderApp-_4cqyo5R.js.map
