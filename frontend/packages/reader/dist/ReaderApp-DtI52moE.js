var Fn = (e) => {
  throw TypeError(e);
};
var $n = (e, t, n) => t.has(e) || Fn("Cannot " + n);
var it = (e, t, n) => ($n(e, t, "read from private field"), n ? n.call(e) : t.get(e)), jn = (e, t, n) => t.has(e) ? Fn("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, n), Bn = (e, t, n, r) => ($n(e, t, "write to private field"), r ? r.call(e, n) : t.set(e, n), n);
import { jsxs as z, jsx as b, Fragment as Ot } from "react/jsx-runtime";
import { useMemo as Y, useState as N, useEffect as x, useCallback as $, useRef as k, useLayoutEffect as ke, memo as mn, createContext as hn, useContext as pn, forwardRef as Mo, useImperativeHandle as gn, useSyncExternalStore as Nr, useId as Lr, Suspense as ko, lazy as Ao } from "react";
import { requireAdapter as at, getReaderAdapters as ye } from "./adapters.js";
import { resolveReaderDownloadName as _o, resolveReaderDownloadUrls as No, READER_PROGRESS_COPY as Ie, trimString as At, READER_DOWNLOAD_ACTIONS as Lo, disabledReason as Co } from "./runtime/state.js";
import { r as Do, b as zo } from "./page-config-Ct7qR5rm.js";
import { documentSourcePdfPath as Yt, isFinishedJobStatus as bn } from "@retainpdf/domain/job";
import { c as xo, n as Oo, f as Ht, j as Un, a as Fo, b as $o, h as Cr, p as yn, d as jo, k as Hn, i as Bo } from "./reader-regions-CP3ZMHPc.js";
import { fetchDocumentReading as Uo } from "@retainpdf/api/documents";
import { isReaderTransportError as Ho, createReaderTransportError as Wo } from "./contracts.js";
import { toast as Xt, Toaster as Vo } from "sonner";
import { X as vn, Radio as Jo, FileText as Dr, Columns2 as zr, Languages as xr, FileCode2 as qo, Keyboard as Go, Download as Ko, ChevronDown as Zo, ListTree as Yo, Search as Xo } from "lucide-react";
import { Button as xe, Input as Qo } from "@retainpdf/ui";
import { pdfjs as ea, Page as ta, Document as na } from "react-pdf";
import { extractMarkdownMath as ra, materializeMarkdownMathFallbackHtml as oa, materializeMarkdownMathHtml as aa } from "./runtime/content.js";
const sa = (...e) => {
  var t, n;
  return ((n = (t = ye()) == null ? void 0 : t.isMockMode) == null ? void 0 : n.call(t, ...e)) ?? !1;
}, ia = "", ca = Object.freeze({
  progress: "retainpdf-reader-progress"
}), la = (e) => {
  var t, n;
  return ((n = (t = ye()) == null ? void 0 : t.resolveResourceUrl) == null ? void 0 : n.call(t, e)) ?? e;
}, iu = (...e) => {
  var n;
  return (((n = ye()) == null ? void 0 : n.fetchProtected) ?? fetch)(...e);
}, Te = () => at("defaultReaderDataPort"), Wn = () => at("defaultReaderPageConfigPort"), cu = {
  get apiPrefix() {
    return Te().apiPrefix;
  },
  fetchProtected: (...e) => Te().fetchProtected(...e),
  loadMarkdownPayload: (e) => Te().loadMarkdownPayload(e),
  loadMarkdownSource: (e) => Te().loadMarkdownSource(e),
  loadMarkdownRange: (e, t, n, r, o) => Te().loadMarkdownRange(e, t, n, r, o),
  loadJobPayload: (e) => Te().loadJobPayload(e),
  loadReaderPayload: (e, t) => Te().loadReaderPayload(e, t),
  loadReaderOptionalArtifacts: (e) => Te().loadReaderOptionalArtifacts(e),
  get liveTranslation() {
    return Te().liveTranslation;
  }
}, Or = {
  messageTargetOrigin: () => Wn().messageTargetOrigin(),
  readerJobId: () => Wn().readerJobId()
}, ua = () => {
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
}, da = (...e) => {
  var t, n;
  return ((n = (t = ye()) == null ? void 0 : t.resolveReaderAnchor) == null ? void 0 : n.call(t, ...e)) ?? null;
}, fa = () => {
  var e, t;
  return ((t = (e = ye()) == null ? void 0 : e.resolveReaderDocumentId) == null ? void 0 : t.call(e)) ?? "";
}, ma = (...e) => {
  var t, n;
  return ((n = (t = ye()) == null ? void 0 : t.resolveReaderJobId) == null ? void 0 : n.call(t, ...e)) ?? "";
}, ha = (...e) => {
  var t, n;
  return ((n = (t = ye()) == null ? void 0 : t.resolveReaderDownloadName) == null ? void 0 : n.call(t, ...e)) ?? _o(...e);
}, pa = (...e) => {
  var t, n;
  return ((n = (t = ye()) == null ? void 0 : t.resolveReaderDownloadUrls) == null ? void 0 : n.call(t, ...e)) ?? No(...e);
}, ga = (...e) => at("downloadProtectedResource")(...e), ba = (...e) => at("failDownloadToast")(...e), lu = (e, t) => at("resolveMarkdownAssetUrl")(e, t), Vn = "/api/v1";
function ya() {
  const e = () => {
    var r;
    return Do(
      ((r = globalThis.location) == null ? void 0 : r.search) || ""
    );
  }, [t, n] = N(e);
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
function va() {
  const e = ya(), t = Y(() => ma(Or), [e]), n = Y(() => fa(), [e]), r = t || n ? `job:${t}|document:${n}` : `location:${e}`;
  return { locationKey: e, jobId: t, routeDocumentId: n, sessionIdentity: r };
}
function Sa(e) {
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
  }), f = i.documentId === t ? i.jobId : "", h = u.documentId === t ? u.jobId : "", g = n || f, [m, v] = N({
    jobId: "",
    documentId: ""
  }), y = m.jobId === g ? m.documentId : "", w = t || y, P = !!t && !g, [p, S] = N(null), E = (p == null ? void 0 : p.sessionIdentity) === r && p.documentId === w ? p : null, _ = P || !!E, O = $((C) => {
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
    documentJobId: f,
    rejectedDocumentJobId: h,
    sessionJobId: g,
    resolvedJobDocument: m,
    setResolvedJobDocument: v,
    jobDocumentId: y,
    documentId: w,
    sourceOnly: P,
    committedDocumentSource: p,
    setCommittedDocumentSource: S,
    activeCommittedDocumentSource: E,
    sourceViewOnly: _,
    refreshCommittedDocument: O,
    applyIdentityEvent: L
  };
}
function Jn(e) {
  return `${(e == null ? void 0 : e.status) || ""}`.trim().toLowerCase();
}
function wa(e) {
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
function qn(e, t) {
  return la(Yt(e, t));
}
function Pa(e, t = "") {
  const n = `${e || ""}`.trim(), r = `${t || ""}`.trim();
  return !!(!n || r && (n === r || n === `${r}.pdf`) || /^\d{8,14}-[0-9a-f]{4,}$/i.test(n));
}
function Ra(e, t) {
  var r;
  const n = [
    e == null ? void 0 : e.title,
    e == null ? void 0 : e.display_name,
    e == null ? void 0 : e.source_file_name,
    (r = e == null ? void 0 : e.book_summary) == null ? void 0 : r.source_file_name
  ];
  for (const o of n) {
    const a = `${o || ""}`.trim();
    if (a && !Pa(a, t))
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
        type: ca.progress,
        stage: n,
        percent: e,
        text: t
      },
      Or.messageTargetOrigin()
    );
  } catch {
  }
}
function _t(e, t, n, r = "progress") {
  e({
    loading: !0,
    percent: t,
    text: n,
    stage: r,
    failed: !1
  }), Qt({ percent: t, text: n, stage: r });
}
function Ia(e) {
  const {
    sessionJobId: t,
    sessionIdentity: n,
    sessionIdentityRef: r,
    sessionJobIdRef: o,
    sessionEpochRef: a,
    closingRef: s
  } = e, [c, i] = N(null), [l, u] = N(null), [d, f] = N(""), [h, g] = N(0), m = d === n ? c : null, v = d === n ? l : null, y = Jn(m), w = bn(y), P = $(() => {
    g((L) => L + 1);
  }, []), p = $((L) => {
    i(L.jobPayload), u(L.manifestPayload), f(L.sessionIdentity);
  }, []), S = $((L) => {
    i(null), u(null), f(L);
  }, []), E = k(""), _ = k(""), O = $(async () => {
    const L = o.current;
    if (!L || E.current === L) return;
    const C = Ft().loadJobPayload;
    if (typeof C != "function") return;
    const R = a.current.value;
    E.current = L;
    try {
      const I = await C(L);
      if (s.current || a.current.value !== R || o.current !== L || !I || typeof I != "object")
        return;
      const T = Jn(I);
      i(I), f(r.current), T === "succeeded" && _.current !== L && (_.current = L, g((M) => M + 1));
    } catch {
    } finally {
      E.current === L && (E.current = "");
    }
  }, []);
  return x(() => {
    _.current = "";
  }, [n]), x(() => {
    if (!t || w || !m) return;
    const L = window.setInterval(() => {
      document.visibilityState !== "hidden" && O();
    }, 1e3);
    return () => window.clearInterval(L);
  }, [w, O, m, t]), {
    jobPayload: c,
    setJobPayload: i,
    manifestPayload: l,
    setManifestPayload: u,
    payloadSessionIdentity: d,
    setPayloadSessionIdentity: f,
    scopedJobPayload: m,
    scopedManifestPayload: v,
    jobStatus: y,
    jobTerminal: w,
    jobRefreshRevision: h,
    refreshJobArtifacts: P,
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
function Ta(e, t) {
  e(t), en(t);
}
function Ea(e) {
  const [t, n] = N(e ? "source" : "compare"), r = $((a) => {
    e && a !== "source" || (n(a), en(a));
  }, [e]), o = $((a) => {
    Ta(n, a);
  }, []);
  return x(() => (e && document.documentElement.classList.add("reader-source-only"), en(t), () => {
    document.documentElement.classList.remove("reader-source-only");
  }), [e, t]), { mode: t, setMode: r, setModeState: n, switchSessionMode: o };
}
function Gn(e) {
  return typeof e == "string" ? e.trim() : `${e ?? ""}`.trim();
}
function Ma(e) {
  const t = (e == null ? void 0 : e.data) ?? e, n = t && typeof t == "object" ? t : {};
  return {
    activeJobId: Gn(n.active_job_id),
    activeVersionId: Gn(n.active_version_id)
  };
}
function ka(e) {
  const { link: t, rejectedDocumentJobId: n, hasCommittedSource: r } = e, o = t.activeJobId && t.activeJobId !== n && !t.activeJobId.startsWith("doc:") ? t.activeJobId : "";
  return o ? { kind: "follow-active-job", jobId: o, activeVersionId: t.activeVersionId } : t.activeVersionId && !r ? { kind: "open-committed-source", documentId: "", revision: t.activeVersionId } : { kind: "open-source-url" };
}
function Aa(e) {
  const {
    payloadDocumentId: t,
    linkedActiveJobId: n,
    linkedActiveVersionId: r,
    sessionJobId: o,
    hasCommittedSource: a
  } = e;
  return t && r && n === o && !a ? { kind: "restore-committed-source", documentId: t, revision: r } : { kind: "open-job-artifacts" };
}
function _a(e) {
  return e.status === 404 && e.reason !== "not_ready" && !e.jobId && !!e.routeDocumentId && !!e.documentJobId && e.sessionJobId === e.documentJobId;
}
const Na = /^merged-([0-9a-f]{64})-[0-9a-f]+$/;
function La(e) {
  var t;
  return e.status !== 404 || e.reason !== "merged_reading_expired" ? "" : ((t = Na.exec(`${e.sessionJobId || ""}`.trim())) == null ? void 0 : t[1]) || "";
}
function Ca(e) {
  return e ? { data: e.data.slice() } : null;
}
const Da = 2, be = /* @__PURE__ */ new Map();
function tn(e, t) {
  be.delete(e), be.set(e, t);
}
function za(e) {
  if (be.size < Da) return;
  const t = be.keys().next().value;
  t && be.delete(t);
}
async function xa(e) {
  var t, n;
  if (typeof e.json != "function") return "";
  try {
    const r = await e.json(), o = (n = (t = r == null ? void 0 : r.error) == null ? void 0 : t.details) == null ? void 0 : n.reason;
    return typeof o == "string" ? o.trim() : "";
  } catch {
    return "";
  }
}
async function Fr(e, t = mt().fetchProtected, n = {}) {
  const r = `${e || ""}`.trim();
  if (!r)
    return null;
  if (be.has(r)) {
    const c = be.get(r);
    return tn(r, c), c;
  }
  const o = await t(r, { signal: n.signal });
  if (!o.ok) {
    const c = new Error(`读取 PDF 失败 (${o.status})`);
    c.status = o.status;
    const i = await xa(o);
    throw i && (c.reason = i), c;
  }
  const a = await o.arrayBuffer(), s = { data: new Uint8Array(a) };
  return be.has(r) ? tn(r, s) : (za(), be.set(r, s)), s;
}
const Oa = { file: null, loading: !1, error: "" }, Fa = { file: null, loading: !0, error: "" };
function $a(e = "", t = null) {
  const n = `${e || ""}`.trim(), [r, o] = N(null);
  if (x(() => {
    if (t || !n) return;
    const s = be.get(n);
    if (s) {
      tn(n, s);
      return;
    }
    const c = new AbortController();
    return Fr(n, void 0, { signal: c.signal }).then((i) => {
      c.signal.aborted || o({ url: n, file: i, loading: !1, error: "" });
    }).catch((i) => {
      c.signal.aborted || o({ url: n, file: null, loading: !1, error: (i == null ? void 0 : i.message) || String(i) });
    }), () => c.abort();
  }, [n, t]), t) return { file: t, loading: !1, error: "" };
  if (!n) return Oa;
  if ((r == null ? void 0 : r.url) === n) return r;
  const a = be.get(n);
  return a ? { file: a, loading: !1, error: "" } : Fa;
}
function ja(e) {
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
  _t(s, r, n, "download");
  const c = await Fr(t, mt().fetchProtected, {
    signal: a.signal
  });
  return a.isInactive() ? null : (_t(s, o, n, "download"), c);
}
async function Ba(e) {
  const { sourceFinal: t, translatedFinal: n, fence: r, setBoot: o } = e;
  _t(o, 25, "正在下载 PDF…", "download");
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
function Ua(e, t, n) {
  const r = new URL(e);
  return n ? r.searchParams.set("job_id", n) : (r.searchParams.delete("job_id"), r.searchParams.set("document_id", t)), r.toString();
}
async function Ha({
  apiPrefix: e,
  documentId: t,
  expiredJobId: n,
  fetchReading: r = Uo,
  location: o = globalThis.location
}) {
  let a;
  try {
    const s = await r(e, t);
    a = `${(s == null ? void 0 : s.job_id) || ""}`.trim() || null;
  } catch {
    return !1;
  }
  return a === n || !o ? !1 : (o.replace(Ua(o.href, t, a)), !0);
}
const Rt = {
  regions: null,
  metadata: null
};
function Wa(e) {
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
    sessionEpochRef: m,
    closingRef: v,
    activeLoadAbortRef: y
  } = e, [w, P] = N(""), [p, S] = N(""), [E, _] = N(null), [O, L] = N(null), [C, R] = N(!1), [I, T] = N(""), [M, F] = N([]), [K, D] = N(!1), [q, U] = N(() => ({
    source: null,
    translated: null
  })), [V, ne] = N(
    Rt
  ), [me, re] = N({
    loading: !0,
    percent: 4,
    text: Ie.boot,
    stage: "progress",
    failed: !1
  });
  return x(() => {
    const oe = new AbortController(), j = m.current.value, B = ja({
      sessionEpochRef: m,
      closingRef: v,
      abort: oe,
      sessionEpoch: j
    });
    y.current = oe;
    const Z = Ft();
    if (v.current)
      return oe.abort(), () => {
        y.current === oe && (y.current = null);
      };
    let he = !1;
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
      R(!0), he || D(!0), re({
        loading: !1,
        percent: 100,
        text: Ie.ready,
        stage: "ready",
        failed: !1
      }), Qt({ percent: 100, text: Ie.ready, stage: "ready" });
    }
    function Ae() {
      return l != null && l.documentId ? qn(
        l.documentId,
        l.revision
      ) : sa() ? ia : Z.resolveResourceUrl(Yt(r));
    }
    async function Re() {
      var ue;
      let te = { activeJobId: "", activeVersionId: "" };
      try {
        const ie = await ((ue = Z.fetchDocument) == null ? void 0 : ue.call(Z, r));
        ie && (te = Ma(ie));
      } catch {
      }
      const le = ka({
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
      const pe = Ae();
      if (B.isInactive()) return;
      P(pe), S(""), T(""), f(i);
      const se = await nn({
        url: pe,
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
      const te = !l, le = !!(te && Z.loadSessionSnapshot && Z.loadReaderOptionalArtifacts), pe = le ? Z.loadReaderOptionalArtifacts(t) : null, se = await ((J = Z.loadSessionSnapshot) == null ? void 0 : J.call(Z, {
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
      const Ge = wa(ue.jobPayload) || `${(ie == null ? void 0 : ie.document_id) || ""}`.trim();
      Ge && !r && u({
        type: "resolved-job-document",
        jobId: t,
        documentId: Ge
      });
      const Ke = Aa({
        payloadDocumentId: Ge,
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
      const st = Z.resolveReaderSourcePdf(ue.manifestPayload), Bt = Z.resolveReaderTranslatedPdfUrl(ue.jobPayload, ue.manifestPayload), Ut = typeof st == "string" ? st : Z.resolveReaderArtifactUrl(st), _e = r || Ge, Ne = l != null && l.documentId ? qn(
        l.documentId,
        l.revision
      ) : Ut || (_e ? Z.resolveResourceUrl(Yt(_e)) : ""), De = l ? "" : Bt || "";
      P(Ne || ""), S(De), T(Ra(ue.jobPayload, t)), d({
        jobPayload: ue.jobPayload || null,
        manifestPayload: ue.manifestPayload || null,
        sessionIdentity: i
      });
      const St = () => Ba({
        sourceFinal: Ne || "",
        translatedFinal: De,
        fence: B,
        setBoot: re
      }), wt = !!(Ne || De), Ze = pe && wt ? St() : null;
      Ze == null || Ze.catch(() => {
      });
      const Pt = (W) => {
        B.isInactive() || (F(l ? [] : xo(W.regionsPayload)), U(l ? { source: null, translated: null } : Oo(W.readerMetadata)), ne(l ? Rt : W.readerErrors ?? Rt), D(!0));
      };
      if (pe ? (he = !0, pe.then(Pt)) : Pt(ue), !wt) {
        ae(Ie.failed, Ie.failed);
        return;
      }
      const A = await (Ze ?? St());
      if (A.status !== "inactive") {
        if (A.status === "incomplete") {
          ae("PDF 下载失败，请重试", "PDF 下载失败");
          return;
        }
        _(A.sourceBytes), L(A.translatedBytes), Pe();
      }
    }
    async function qe() {
      R(!1), _(null), L(null), F([]), D(!1), U({ source: null, translated: null }), ne(Rt), _t(re, 8, Ie.metadata, "metadata");
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
        const le = Number(te == null ? void 0 : te.status), pe = `${(te == null ? void 0 : te.reason) || ""}`, se = La({ status: le, reason: pe, sessionJobId: t });
        if (se && (await Ha({
          apiPrefix: Vn,
          documentId: se,
          expiredJobId: t
        }) || B.isClosedOrStale()))
          return;
        if (_a({
          status: le,
          reason: pe,
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
    return qe(), () => {
      oe.abort(), y.current === oe && (y.current = null);
    };
  }, [t, r, o, a, s, c, l, g, n, i, u, d, f, h]), {
    sourceUrl: w,
    translatedUrl: p,
    sourceFile: E,
    translatedFile: O,
    assetsReady: C,
    title: I,
    regions: M,
    regionsSettled: K,
    readerMetadata: q,
    readerErrors: V,
    boot: me
  };
}
function Va() {
  const e = k(!1), t = k(null), { locationKey: n, jobId: r, routeDocumentId: o, sessionIdentity: a } = va(), s = k({ identity: "", value: 0 });
  s.current.identity !== a && (s.current = {
    identity: a,
    value: s.current.value + 1
  }, e.current = !1);
  const c = k(a), i = k(""), l = k(""), u = k(() => {
  }), d = $(() => u.current(), []), f = Sa({
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
    sourceOnly: m,
    sourceViewOnly: v
  } = f, { mode: y, setMode: w, switchSessionMode: P } = Ea(v);
  u.current = () => {
    P("source");
  }, c.current = a, i.current = g, l.current = h;
  const p = Ia({
    sessionJobId: h,
    sessionIdentity: a,
    sessionIdentityRef: c,
    sessionJobIdRef: l,
    sessionEpochRef: s,
    closingRef: e
  }), {
    scopedJobPayload: S,
    scopedManifestPayload: E,
    jobStatus: _,
    jobTerminal: O,
    jobRefreshRevision: L,
    refreshJobArtifacts: C,
    refreshJobStatus: R
  } = p, I = Wa({
    sessionJobId: h,
    jobId: r,
    routeDocumentId: o,
    documentJobId: f.documentJobId,
    rejectedDocumentJobId: f.rejectedDocumentJobId,
    sourceOnly: m,
    locationKey: n,
    sessionIdentity: a,
    committedSource: f.activeCommittedDocumentSource,
    applyIdentityEvent: f.applyIdentityEvent,
    publishPayload: p.publishPayload,
    clearPayload: p.clearPayload,
    switchSessionMode: P,
    jobRefreshRevision: L,
    sessionEpochRef: s,
    closingRef: e,
    activeLoadAbortRef: t
  }), T = $(() => {
    var F;
    e.current = !0, (F = t.current) == null || F.abort();
  }, []), M = Y(
    () => ({
      fetchProtected: Ft().fetchProtected,
      jobId: h,
      jobPayload: S,
      manifestPayload: E,
      sourceUrl: I.sourceUrl,
      translatedUrl: I.translatedUrl,
      sourceOnly: v
    }),
    [h, S, E, I.sourceUrl, I.translatedUrl, v]
  );
  return {
    jobId: h,
    jobStatus: _,
    workflow: `${(S == null ? void 0 : S.workflow) || ""}`.trim().toLowerCase(),
    jobTerminal: O,
    documentId: g,
    sessionIdentity: a,
    sourceOnly: m,
    mode: y,
    setMode: w,
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
    refreshCommittedDocument: f.refreshCommittedDocument,
    prepareClose: T
  };
}
const Ja = 160, qa = 8, Ga = 0;
function Ka() {
  const e = k(null), [t, n] = N(null), [r, o] = N(Ga), a = $((s) => {
    e.current = s, n(s);
  }, []);
  return x(() => {
    const s = t;
    if (!s || typeof ResizeObserver > "u")
      return;
    const c = (l) => {
      !Number.isFinite(l) || l < Ja || o((u) => Math.abs(u - l) < qa ? u : l);
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
function Za(e) {
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
function Ya(e, t) {
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
  const [d, f] = N(() => ({
    identity: l,
    pages: Wt
  })), [h, g] = N(() => ({ identity: l, tick: 0 })), m = d.identity === l ? d.pages : Wt, v = h.identity === l ? h.tick : 0, y = Za({
    mode: n,
    sourceOnly: r,
    assetsReady: o,
    hasSource: !!c || !!a,
    hasTranslated: !!i
  }), { primaryPane: w } = y, P = $((R, I) => {
    u.current === l && f((T) => {
      const M = T.identity === l ? T.pages : Wt;
      return M[I] === R && T.identity === l ? T : {
        identity: l,
        pages: { ...M, [I]: R }
      };
    });
  }, [l]), p = k(null), S = $(() => {
    p.current && clearTimeout(p.current);
    const R = l;
    p.current = setTimeout(() => {
      p.current = null, u.current === R && g((I) => ({
        identity: R,
        tick: I.identity === R ? I.tick + 1 : 1
      }));
    }, 60);
  }, [l]);
  x(() => (p.current && (clearTimeout(p.current), p.current = null), f((R) => R.identity === l && R.pages.source === 0 && R.pages.translated === 0 ? R : { identity: l, pages: { source: 0, translated: 0 } }), g((R) => R.identity === l && R.tick === 0 ? R : { identity: l, tick: 0 }), () => {
    p.current && (clearTimeout(p.current), p.current = null);
  }), [l]);
  const E = Y(
    () => Math.max(m.source, m.translated),
    [m]
  ), _ = w === "translated" ? m.translated : m.source || m.translated, O = t == null ? void 0 : t.userZoom, L = t == null ? void 0 : t.shellWidth, C = `${l}-${v}-${O}-${n}-${m.source}-${m.translated}-${L}`;
  return {
    ...y,
    numPagesByPane: m,
    hudNumPages: E,
    primaryNumPages: _,
    metricsTick: v,
    onNumPages: P,
    onMetrics: S,
    rowSyncRevision: C
  };
}
const $e = "data-reader-page", rt = "data-reader-pane", Sn = "data-natural-height", Xa = "reader-react-root", Qa = "reader-react-grid", es = "reader-react-scroll-shell", ts = "reader-react-pdf-pane", $r = "reader-react-pdf-page", Nt = "reader-react-pdf-page-placeholder", wn = "reader-react-pdf-page-slot";
function Lt(e, t) {
  const n = e != null ? `[${$e}="${e}"]` : `[${$e}]`;
  return t ? `${n}[${rt}="${t}"]` : n;
}
function ns() {
  return `.${wn}[${$e}]`;
}
function Ct(e) {
  return Number(e.getAttribute($e));
}
const jr = 0.25, Dt = 1, rs = 0.05, vt = 0.5, os = 16, as = 8, ss = 720;
function Fe() {
  const e = typeof window > "u" ? NaN : Number(window.innerWidth);
  return Number.isFinite(e) && e > 0 ? e : Number.POSITIVE_INFINITY;
}
function Br(e) {
  return Number.isFinite(e) && e < ss;
}
function Qe(e, t = Number.POSITIVE_INFINITY) {
  return Br(t) && (e === "source" || e === "translated") ? Dt : vt;
}
function $t(e) {
  return Number.isFinite(e) ? Math.min(Dt, Math.max(jr, e)) : vt;
}
function ht(e, t) {
  const n = $t(Number(e) + t * rs);
  return Math.round(n * 100) / 100;
}
function is(e) {
  return Math.round($t(e) * 100);
}
function cs(e) {
  const n = (Number(e) || 0) - os - as;
  return Math.max(160, Math.floor(n));
}
function ls(e, t = vt) {
  const n = $t(t);
  return cs((Number(e) || 0) * n);
}
function us(e, t) {
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
const ds = 8;
function fs(e, t) {
  return !Number.isFinite(e) || e < 80 || Math.abs(e - t) < ds ? "ignore" : !Number.isFinite(t) || t <= 0 ? "immediate" : "settle";
}
const Ur = 200, Hr = [
  "markdown"
], ms = Hr;
function Wr(e) {
  return ms.includes(e);
}
const hs = "retainpdf:reader:view:v1:", Kn = /* @__PURE__ */ new Set([
  "source",
  "translated",
  "markdown",
  "ai"
]), ps = /* @__PURE__ */ new Set([
  "source",
  "compare",
  "translated"
]);
function Vr() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function rn(e) {
  return `${e || ""}`.trim();
}
function gs({
  documentId: e,
  jobId: t
}) {
  const n = rn(e);
  if (n) return `document:${n}`;
  const r = rn(t);
  return r ? `job:${r}` : "";
}
function Jr(e) {
  const t = rn(e);
  return t ? `${hs}${t}` : "";
}
function bs(e) {
  if (!e || typeof e != "object") return;
  const t = Math.floor(Number(e.page)), n = Number(e.fraction);
  if (!(!Number.isFinite(t) || t < 1 || !Number.isFinite(n)))
    return {
      page: t,
      fraction: Math.max(0, Math.min(1, n))
    };
}
function ys(e) {
  if (e === null) return null;
  if (!e || typeof e != "object") return;
  const t = `${e.left || ""}`, n = `${e.right || ""}`;
  if (!(!Kn.has(t) || !Kn.has(n) || t === n))
    return { left: t, right: n };
}
function vs(e) {
  return e === null ? null : Wr(e) ? e : void 0;
}
function Ss(e) {
  return ps.has(e) ? e : void 0;
}
function qr(e) {
  if (!e || typeof e != "object") return null;
  const t = e;
  if (t.schema !== "retainpdf_reader_view_v1") return null;
  const n = bs(t.anchor), r = Number(t.zoom), o = Ss(t.mode), a = ys(t.splitLayout), s = vs(t.assistantPanel);
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
function we(e, t = Vr()) {
  const n = Jr(e);
  if (!n || !t) return null;
  try {
    const r = t.getItem(n);
    return r ? qr(JSON.parse(r)) : null;
  } catch {
    return null;
  }
}
function jt(e, t, n = Vr()) {
  const r = Jr(e);
  if (!r || !n) return null;
  const o = we(e, n), a = qr({
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
function ws(e, t, n = "") {
  var f;
  const [r, o] = N(() => {
    var h;
    return ((h = we(n)) == null ? void 0 : h.zoom) ?? Qe(e, Fe());
  }), a = k(r), s = k(n);
  a.current = r;
  const c = k(1), i = k(((f = we(n)) == null ? void 0 : f.zoom) !== void 0);
  x(() => {
    var m;
    if (s.current === n) return;
    s.current = n;
    const h = (m = we(n)) == null ? void 0 : m.zoom;
    i.current = h !== void 0;
    const g = h ?? Qe(e, Fe());
    c.current = 1, a.current = g, o(g);
  }, [e, n]), x(() => {
    if (i.current) return;
    const h = Qe(e, Fe()), g = a.current;
    Math.abs(h - g) < 5e-4 || (c.current = 1, a.current = h, o(h));
  }, [e]);
  const l = $((h) => {
    const g = $t(h), m = a.current;
    Math.abs(g - m) < 5e-4 || (c.current = g / (m || 1), i.current = !0, jt(s.current, { zoom: g }), o(g));
  }, []), u = $((h) => {
    l(ht(a.current, h));
  }, [l]), d = $((h) => {
    l(Qe(h));
  }, [l]);
  return ke(() => {
    const h = c.current;
    Math.abs(h - 1) < 1e-3 || (c.current = 1, us(t == null ? void 0 : t.current, h));
  }, [r, t]), { userZoom: r, onZoomChange: l, stepZoom: u, resetZoom: d };
}
function Ps(e) {
  const { mode: t, setMode: n, beginModeSwitch: r } = e, o = k(t), a = k(n), s = k(r);
  return o.current = t, a.current = n, s.current = r, { setModeKeepingPage: $((i) => {
    i !== o.current && (s.current(), a.current(i));
  }, []) };
}
const Pn = 48;
function Gr(e, t = Pn) {
  return e.getBoundingClientRect().top + t;
}
function Kr(e, t) {
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
  const o = Ct(n);
  if (!Number.isFinite(o) || o < 1)
    return null;
  const a = n.getBoundingClientRect(), s = a.height > 0 ? a.height : 1, c = Math.min(1, Math.max(0, (t - a.top) / s));
  return { el: n, page: o, fraction: c };
}
function Mt(e, t, n = Pn) {
  if (!e)
    return null;
  const r = Lt(void 0, t), o = Array.from(e.querySelectorAll(r));
  if (!o.length || e.getBoundingClientRect().height <= 0)
    return null;
  const s = Gr(e, n), c = Kr(o, s);
  return c ? { page: c.page, fraction: c.fraction } : null;
}
function pt(e, t, n = "auto", r, o = Pn) {
  if (!e || !t)
    return !1;
  const a = Math.max(1, Math.floor(Number(t.page) || 1)), s = Math.min(1, Math.max(0, Number(t.fraction) || 0));
  let c = null;
  if (r && (c = e.querySelector(Lt(a, r))), c || (c = e.querySelector(Lt(a))), !c)
    return !1;
  const i = e.getBoundingClientRect(), l = c.getBoundingClientRect();
  if (i.height <= 0 || l.height < 8 && c.offsetHeight < 8)
    return !1;
  const u = l.height > 0 ? l.height : c.offsetHeight, d = e.scrollTop + (l.top - i.top), f = Math.max(0, d + s * u - o);
  return n === "auto" ? Math.abs(e.scrollTop - f) >= 1 && (e.scrollTop = f) : e.scrollTo({ top: f, behavior: n }), !0;
}
function Rs(e, t, n = "smooth", r) {
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
function Is(e, t, n) {
  return on(
    e,
    { page: t, fraction: 0 },
    n
  );
}
function zt(e, t) {
  if (!Number.isFinite(e))
    return 1;
  const n = Math.max(1, Math.floor(e));
  return !Number.isFinite(t) || t <= 0 ? n : Math.min(t, n);
}
function ge(e) {
  return {
    page: Math.max(1, Math.floor(Number(e.page) || 1)),
    fraction: Math.min(1, Math.max(0, Number(e.fraction) || 0))
  };
}
function Ts(e, t, n = !0, r = "", o) {
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
    const d = Lt(void 0, o), f = () => {
      if (i) return;
      const m = Array.from(c.querySelectorAll(d));
      if (!m.length)
        return;
      const v = Gr(c), y = Kr(m, v);
      y && s(y.page);
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
const Es = `canvas, .react-pdf__Page, .${$r}, .${Nt}`, Zn = /* @__PURE__ */ new WeakMap();
function Ms(e) {
  const t = Number(e.getAttribute(Sn));
  if (Number.isFinite(t) && t > 0)
    return t;
  let n = Zn.get(e);
  if ((n == null || !n.isConnected) && (n = e.querySelector(Es), Zn.set(e, n)), n) {
    const o = n.getBoundingClientRect().height;
    if (Number.isFinite(o) && o > 0)
      return o;
  }
  const r = e.getBoundingClientRect().height;
  return Number.isFinite(r) && r > 0 ? r : 0;
}
function ks(e, t) {
  if (e.size !== t.size) return !1;
  for (const [n, r] of t)
    if (e.get(n) !== r) return !1;
  return !0;
}
function As(e) {
  const t = /* @__PURE__ */ new Map();
  e.querySelectorAll(ns()).forEach((r) => {
    const o = Ct(r);
    if (!Number.isFinite(o) || o < 1) return;
    const a = Ms(r);
    if (a <= 0) return;
    const s = t.get(o) || { height: 0, count: 0 };
    s.height = Math.max(s.height, a), s.count += 1, t.set(o, s);
  });
  const n = /* @__PURE__ */ new Map();
  return t.forEach((r, o) => {
    r.count >= 2 && r.height > 0 && n.set(o, Math.ceil(r.height));
  }), n;
}
function _s(e, t, n = "", r) {
  const [o, a] = N(() => /* @__PURE__ */ new Map()), s = k(o), c = k(r);
  return c.current = r, ke(() => {
    if (!t) {
      s.current.size !== 0 && (s.current = /* @__PURE__ */ new Map(), a(s.current));
      return;
    }
    let i = !1, l = 0, u = !1, d = !1;
    const f = () => {
      var S;
      if (i) return;
      const P = e.current;
      if (!P) return;
      const p = As(P);
      ks(s.current, p) || (s.current = p, a(p)), u && !d && (d = !0, (S = c.current) == null || S.call(c));
    }, h = () => {
      cancelAnimationFrame(l), l = requestAnimationFrame(() => {
        requestAnimationFrame(f);
      });
    };
    h();
    const g = window.setTimeout(h, 100), m = window.setTimeout(() => {
      u = !0, h();
    }, 300), v = window.setTimeout(h, 700), y = e.current;
    let w = null;
    return y && typeof ResizeObserver < "u" && (w = new ResizeObserver(() => h()), w.observe(y)), () => {
      i = !0, cancelAnimationFrame(l), window.clearTimeout(g), window.clearTimeout(m), window.clearTimeout(v), w == null || w.disconnect();
    };
  }, [e, t, n]), o;
}
const Ns = [0, 48, 140, 320, 560], Ls = 700, Cs = [80, 200, 400], Ds = 500, zs = 50, xs = /* @__PURE__ */ new Set([
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
]), Os = 180, Yn = [0, 48, 140, 320, 700, 1200];
function Fs(e, t) {
  var I;
  const {
    primaryPane: n,
    mode: r,
    enabled: o = !0,
    persistenceKey: a = "",
    restoreReady: s = !0
  } = t, c = k(
    ((I = we(a)) == null ? void 0 : I.anchor) || { page: 1, fraction: 0 }
  ), i = k(null), l = k(!1), u = k(r), d = k(null), f = k(null), h = k(null), g = k(null), m = k(a), v = k(""), y = k(n);
  y.current = n;
  const w = $(() => {
    var T;
    (T = d.current) == null || T.call(d), d.current = null, f.current != null && (clearTimeout(f.current), f.current = null);
  }, []), P = $(() => {
    !l.current && i.current == null || (w(), h.current != null && (clearTimeout(h.current), h.current = null), i.current = null, l.current = !1);
  }, [w]), p = $((T = !1) => {
    g.current != null && (clearTimeout(g.current), g.current = null);
    const M = () => {
      g.current = null, jt(m.current, {
        anchor: ge(c.current)
      });
    };
    T ? M() : g.current = setTimeout(M, Os);
  }, []), S = $((T) => {
    c.current = ge(T), i.current = null, h.current != null && clearTimeout(h.current), h.current = setTimeout(() => {
      h.current = null, l.current = !1;
    }, zs);
  }, []);
  x(() => {
    if (!o)
      return;
    let T = !1, M = null, F = null, K = null;
    const D = () => {
      if (T) return;
      const q = e.current;
      if (!q) {
        K = setTimeout(D, 50);
        return;
      }
      M = q, F = () => {
        if (l.current)
          return;
        const U = Mt(M, y.current);
        U && (c.current = U, p());
      }, M.addEventListener("scroll", F, { passive: !0 }), l.current || F();
    };
    return D(), () => {
      T = !0, K != null && clearTimeout(K), M && F && M.removeEventListener("scroll", F);
    };
  }, [o, r, n, e, p]), x(() => {
    if (!o) return;
    const T = e.current;
    if (!T) return;
    const M = (F) => {
      F.metaKey || F.ctrlKey || F.altKey || xs.has(F.key) && P();
    };
    return T.addEventListener("wheel", P, { passive: !0 }), T.addEventListener("touchmove", P, { passive: !0 }), window.addEventListener("keydown", M), () => {
      T.removeEventListener("wheel", P), T.removeEventListener("touchmove", P), window.removeEventListener("keydown", M);
    };
  }, [o, e, P]), ke(() => {
    var M;
    if (m.current === a) return;
    p(!0), w(), h.current != null && (clearTimeout(h.current), h.current = null), m.current = a, v.current = "";
    const T = (M = we(a)) == null ? void 0 : M.anchor;
    c.current = T ? ge(T) : { page: 1, fraction: 0 }, i.current = null, l.current = !!a, u.current = r;
  }, [a, r, p, w]), x(() => {
    var M;
    if (!o || !s || !a || v.current === a) return;
    v.current = a;
    const T = ge(
      ((M = we(a)) == null ? void 0 : M.anchor) || { page: 1, fraction: 0 }
    );
    return c.current = T, i.current = T, l.current = !0, w(), d.current = on(
      () => e.current,
      T,
      {
        behavior: "auto",
        pane: y.current,
        delaysMs: Yn,
        onDone: () => S(T)
      }
    ), f.current = setTimeout(() => {
      f.current = null, S(T);
    }, Math.max(...Yn) + 160), () => w();
  }, [o, s, a, e, S, w]), x(() => {
    if (u.current === r)
      return;
    if (u.current = r, !o) {
      l.current = !1, i.current = null, w();
      return;
    }
    const T = i.current ? ge(i.current) : ge(c.current);
    return l.current = !0, i.current = T, c.current = T, w(), d.current = on(
      () => e.current,
      T,
      {
        behavior: "auto",
        pane: n,
        // 等页宽/行高同步后再钉；同一 locked 幂等，不会越滚越远
        delaysMs: Ns,
        onDone: () => S(T)
      }
    ), f.current = setTimeout(() => {
      f.current = null, S(T);
    }, Ls), () => {
      w();
    };
  }, [r, o, n, e, S, w]), x(() => () => {
    w(), h.current != null && (clearTimeout(h.current), h.current = null), p(!0);
  }, [w, p]);
  const E = $(() => {
    const T = Mt(
      e.current,
      y.current
    );
    return ge(T || c.current);
  }, [e]), _ = $(() => {
    l.current = !0;
    const T = Mt(
      e.current,
      y.current
    ), M = ge(T ?? c.current);
    return c.current = M, i.current = M, p(), M;
  }, [e, p]), O = $((T, M, F) => {
    const K = F || y.current, D = zt(T, M || 1), q = { page: D, fraction: 0 };
    c.current = q, l.current = !0, i.current = q, p(), w(), Rs(e.current, D, "smooth", K), d.current = Is(
      () => e.current,
      D,
      {
        behavior: "auto",
        pane: K,
        delaysMs: Cs,
        onDone: () => S(q)
      }
    ), f.current = setTimeout(() => {
      f.current = null, S(q);
    }, Ds);
  }, [e, S, w, p]), L = $(() => ge(c.current), []), C = $(() => l.current, []), R = $(() => {
    if (!l.current || !i.current)
      return;
    const T = ge(i.current);
    pt(
      e.current,
      T,
      "auto",
      y.current
    );
  }, [e]);
  return {
    lockFromShell: E,
    beginModeSwitch: _,
    goToPage: O,
    getAnchor: L,
    isRestoring: C,
    repinIfRestoring: R
  };
}
function $s(e, t) {
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
function Zr(e, t, n) {
  const r = `${(n == null ? void 0 : n.jobId) || ""}`.trim(), o = `${(n == null ? void 0 : n.documentId) || ""}`.trim(), a = `j:${r}:d:${o}`;
  return t == null ? `${a}:none:${(e == null ? void 0 : e.blockId) || ""}` : `${a}:p:${t}:b:${(e == null ? void 0 : e.blockId) || ""}`;
}
const js = [0, 80, 200, 400, 800], Bs = 120, Us = 400;
function Hs(e, t, n) {
  const { enabled: r, numPages: o, goToPage: a, resolveBlockPage: s, onAnchorApplied: c, jobId: i, documentId: l, regionsSettled: u = !0 } = e, d = k(a);
  d.current = a;
  const f = k(s);
  f.current = s;
  const h = k(c);
  h.current = c;
  const g = k(n);
  g.current = n, x(() => {
    var p, S;
    if (!r || !Number.isFinite(o) || o < 1)
      return;
    const m = da(), v = $s(m, f.current);
    if (v == null && (m != null && m.blockId) && !u) return;
    const y = Zr(m, v, { jobId: i, documentId: l });
    if (t.current === y)
      return;
    if (v == null) {
      t.current = y, (p = g.current) == null || p.call(g);
      return;
    }
    t.current = y, m && ((S = h.current) == null || S.call(h, m, v));
    const w = [];
    let P = 0;
    for (const E of js)
      P = Math.max(P, E), w.push(
        setTimeout(() => {
          d.current(v);
        }, E)
      );
    return w.push(
      setTimeout(() => {
        var E;
        (E = g.current) == null || E.call(g);
      }, P + Bs)
    ), () => {
      for (const E of w) clearTimeout(E);
    };
  }, [r, o, i, l, t, u]);
}
function Ws(e) {
  var a;
  const t = globalThis.window;
  if (!t || typeof ((a = t.history) == null ? void 0 : a.replaceState) != "function") return;
  const n = t.location, r = `${e || ""}`, o = `${n.pathname}${r ? `?${r}` : ""}${n.hash || ""}`;
  t.history.replaceState(null, "", o);
}
function Vs(e, t, n) {
  const {
    syncEnabled: r,
    currentPage: o,
    resolveBlockPage: a,
    syncDebounceMs: s = Us,
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
      var y;
      const g = ((y = globalThis.location) == null ? void 0 : y.search) || "", m = zo(g, o, u.current);
      if (f.current = o, m === null) return;
      const v = `${new URLSearchParams(m).get("block_id") || ""}`.trim();
      t.current = Zr(
        { blockId: v },
        o,
        { jobId: c, documentId: i }
      ), (d.current || Ws)(m);
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
function Js(e) {
  const t = k(""), [n, r] = N(!1), o = $(() => r(!0), []), a = {
    enabled: e.enabled,
    numPages: e.numPages,
    goToPage: e.goToPage,
    resolveBlockPage: e.resolveBlockPage,
    onAnchorApplied: e.onAnchorApplied,
    jobId: e.jobId,
    documentId: e.documentId,
    regionsSettled: e.regionsSettled
  };
  Hs(a, t, o), Vs(e, t, n);
}
const ct = {
  layoutByPage: /* @__PURE__ */ new Map(),
  pagesByPage: /* @__PURE__ */ new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: ""
};
function qs(e) {
  return new Map(((e == null ? void 0 : e.pages) || []).map((t) => [t.page_idx, t]));
}
function Xn(e, t) {
  return e.attempt !== t.attempt ? e.attempt < t.attempt ? -1 : 1 : e.generation !== t.generation ? e.generation < t.generation ? -1 : 1 : 0;
}
function Yr(e, t, n) {
  if (n.page_idx !== t.page_idx) return "retry";
  const r = Xn(n, t);
  if (r < 0 || r === 0 && n.page_hash !== t.page_hash) return "retry";
  if (!e) return "accept";
  const o = Xn(n, e);
  return o < 0 || o === 0 && n.page_hash === e.pageHash ? "ignore" : "accept";
}
function Gs(e, t, n) {
  if (t.seq <= e.lastSeq) return e;
  const r = e.pagesByPage.get(t.page_idx), o = Yr(r, t, n);
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
function Ks(e) {
  const { hasOverlayContent: t, connection: n, showSource: r } = e;
  return {
    topBarPill: t && n !== "terminal",
    sourcePaneToggle: t && r,
    // 和 resolveReaderPaneComposition 的 overlayOnSource 同一套条件，外加
    // 「源文栏得在台面上」——否则叠层没有落脚的地方。
    overlayRenderable: t && r && e.liveTranslationVisible && !e.assistantOpen
  };
}
const Qn = [250, 500, 1e3, 2e3, 4e3], Vt = [80, 160, 320, 640, 1e3, 1500], er = [250, 500, 1e3, 2e3, 4e3, 5e3];
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
  return Ho(e) ? `${e.code || ""}`.trim() : "";
}
function It(e, t) {
  const n = Rn(e);
  return n === "LIVE_TRANSLATION_PAGE_NOT_COMMITTED" ? "尚未收到可显示的页面译文" : n === "LIVE_TRANSLATION_LAYOUT_NOT_READY" ? "正在等待 OCR 版面数据" : `${(e == null ? void 0 : e.message) || ""}`.trim() || t;
}
async function Zs(e, t, n, r, o) {
  let a = null;
  for (let s = 0; ; s += 1) {
    try {
      const i = await o.fetchPage(e, t.page_idx, { signal: r });
      if (Yr(n.pagesByPage.get(t.page_idx), t, i) !== "retry")
        return i;
      a = Wo(
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
function Ys({
  jobId: e,
  jobStatus: t,
  enabled: n,
  liveTranslationPort: r = void 0
}) {
  const [o, a] = N(ct), s = k(o), c = k("");
  s.current = o;
  const i = `${e || ""}`.trim(), l = `${t || ""}`.trim().toLowerCase(), u = bn(l) ? l : "";
  return x(() => {
    if (!n || !i) {
      c.current = "", s.current = ct, a(ct);
      return;
    }
    const d = r === void 0 ? ua() : r, f = c.current === i;
    if (c.current = i, !d) {
      const P = {
        ...f ? s.current : ct,
        connection: u ? "terminal" : "unavailable",
        jobStatus: l,
        error: "实时译文暂不可用"
      };
      s.current = P, a(P);
      return;
    }
    const h = new AbortController();
    let g = !1;
    const m = {
      ...f ? s.current : ct,
      connection: u ? "terminal" : "connecting",
      jobStatus: l,
      error: ""
    };
    s.current = m, a(m);
    const v = (P) => {
      h.signal.aborted || a((p) => {
        const S = P(p);
        return s.current = S, S;
      });
    }, y = async () => {
      let P = 0;
      for (; !h.signal.aborted; )
        try {
          const p = await d.fetchLayout(i, { signal: h.signal });
          g = !0, v((S) => ({
            ...S,
            layoutByPage: qs(p),
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
              error: It(p, "实时译文暂不可用")
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
            error: It(p, "正在等待 OCR 版面数据")
          })), await an(Qn[Math.min(P, Qn.length - 1)], h.signal).catch(() => {
          }), P += 1;
        }
    };
    return (async () => {
      if (await y(), !g || h.signal.aborted) return;
      let P = 0;
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
                S = await Zs(
                  i,
                  p,
                  s.current,
                  h.signal,
                  d
                );
              } catch (E) {
                if ((E == null ? void 0 : E.name) === "AbortError" || h.signal.aborted) throw E;
                v((_) => ({
                  ..._,
                  lastSeq: Math.max(_.lastSeq, p.seq),
                  error: It(E, "部分页面的实时译文暂时取不到")
                }));
                return;
              }
              v((E) => {
                const _ = Gs(E, p, S);
                return u ? {
                  ..._,
                  connection: "terminal",
                  jobStatus: l
                } : {
                  ..._,
                  jobStatus: l
                };
              }), P = 0;
            }
          });
        } catch (p) {
          if ((p == null ? void 0 : p.name) === "AbortError" || h.signal.aborted) return;
          v((S) => ({
            ...S,
            connection: u ? "terminal" : "reconnecting",
            jobStatus: l,
            error: It(p, "实时译文连接已中断，正在重连")
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
        await an(er[Math.min(P, er.length - 1)], h.signal).catch(() => {
        }), P += 1;
      }
    })(), () => h.abort();
  }, [n, r, i, u]), o;
}
function Xs(e) {
  const t = e && typeof e == "object" ? e : {}, n = t.data && typeof t.data == "object" ? t.data : t, r = Array.isArray(n.groups) ? n.groups : [], o = /* @__PURE__ */ new Map();
  for (const a of r) {
    const s = a || {}, c = `${s.value ?? ""}`.trim(), i = Number(s.count) || 0;
    c && i > 0 && o.set(c, i);
  }
  return o;
}
function Qs(e, t = !0) {
  const [n, r] = N(() => /* @__PURE__ */ new Map());
  return x(() => {
    r((c) => c.size ? /* @__PURE__ */ new Map() : c);
    const o = `${e || ""}`.trim();
    if (!t || !o) return;
    const a = Ft().fetchRevisionGroups;
    if (!a) return;
    let s = !1;
    return a(o).then((c) => {
      !s && c && r(Xs(c));
    }).catch(() => {
    }), () => {
      s = !0;
    };
  }, [e, t]), n;
}
const ei = 4500;
function ti(e) {
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
const ni = /* @__PURE__ */ new Set(["book", "translate"]);
function Xr(e) {
  return !!(e.jobId && e.sourceUrl && ni.has(e.workflow));
}
function ri(e) {
  return !!(Xr(e) && !(e.jobStatus === "succeeded" && e.translatedUrl));
}
function oi() {
  const e = Va(), t = Xr({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    workflow: e.workflow
  }), n = ri({
    jobId: e.jobId,
    sourceUrl: e.sourceUrl,
    translatedUrl: e.translatedUrl,
    jobStatus: e.jobStatus,
    workflow: e.workflow
  }), r = k({ jobId: "", running: !1 });
  r.current.jobId !== e.jobId && (r.current = { jobId: e.jobId, running: !1 });
  const o = `${e.jobStatus || ""}`.trim().toLowerCase();
  o && !bn(o) && (r.current.running = !0);
  const a = Ys({
    jobId: e.jobId,
    jobStatus: e.jobStatus,
    enabled: t && (n || r.current.running)
  }), { shellRef: s, shellEl: c, shellWidth: i, bindShell: l } = Ka(), u = Qs(e.jobId, !e.sourceOnly), d = gs({
    documentId: e.documentId,
    jobId: e.jobId
  }), f = `${d}\0${e.jobId}\0${e.sourceUrl}\0${e.translatedUrl}`, { userZoom: h, onZoomChange: g } = ws(e.mode, s, d), m = Ya(
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
    beginModeSwitch: v,
    goToPage: y,
    repinIfRestoring: w
  } = Fs(s, {
    primaryPane: m.primaryPane,
    mode: e.mode,
    enabled: !e.boot.loading,
    persistenceKey: d,
    restoreReady: m.primaryNumPages > 0
  });
  x(() => {
    w();
  }, [i, w]);
  const P = _s(
    s,
    m.compareMode,
    m.rowSyncRevision,
    w
  ), p = Ts(
    s,
    m.primaryNumPages,
    !e.boot.loading,
    `${e.mode}-${h}-${m.metricsTick}`,
    m.primaryPane
  ), S = $((D, q) => {
    var V, ne;
    const U = Math.max(
      Number(m.hudNumPages) || 0,
      Number(m.primaryNumPages) || 0,
      Number((V = m.numPagesByPane) == null ? void 0 : V.source) || 0,
      Number((ne = m.numPagesByPane) == null ? void 0 : ne.translated) || 0
    );
    y(D, U, q);
  }, [y, m.hudNumPages, m.primaryNumPages, m.numPagesByPane]), [E, _] = N(null), O = k(null), L = $((D) => {
    O.current && clearTimeout(O.current), _(D), D && (O.current = setTimeout(() => _(null), ei));
  }, []);
  x(() => () => {
    O.current && clearTimeout(O.current);
  }, []);
  const C = $((D) => {
    const q = Ht(e.regions, D);
    return q ? Un(q, m.primaryPane).page : null;
  }, [e.regions, m.primaryPane]), R = $((D, q) => {
    const U = q || m.primaryPane, V = typeof D == "object" && D ? `${D.block_id || ""}`.trim() : "", ne = typeof D == "object" && D ? `${D.image_url || ""}`.trim() : "", me = typeof D == "object" && D ? D.page_idx != null ? Number(D.page_idx) + 1 : D.page != null ? Number(D.page) : null : typeof D == "number" ? D + 1 : null, re = Fo(e.regions, ne, me) || Ht(e.regions, V) || (typeof D == "object" ? $o(e.regions, D) : null);
    let oe = re ? Un(re, U).page : null;
    oe == null && (oe = ti(D)), !(oe == null || oe < 1) && (L(re), S(oe, U));
  }, [L, S, m.primaryPane, e.regions]);
  Js({
    enabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    syncEnabled: !e.boot.loading && !e.boot.failed && e.assetsReady,
    numPages: m.hudNumPages || 0,
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
  const { setModeKeepingPage: I } = Ps({
    mode: e.mode,
    setMode: e.setMode,
    beginModeSwitch: v
  });
  x(() => {
    L(null);
  }, [f, L]);
  const T = !e.boot.loading && !e.boot.failed, M = Y(() => ({ bindShell: l, shellEl: c, shellWidth: i, shellRef: s }), [l, c, i, s]), F = Y(() => ({
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
    panes: m,
    sessionFiles: F,
    rowHeights: P,
    goToPage: S,
    activeRegion: E,
    jumpToAnchor: R,
    setModeKeepingPage: I,
    download: e.download,
    showHud: T,
    viewStateKey: d,
    liveTranslation: a,
    liveTranslationAvailable: n,
    revisedBlocks: u
  }), [e, M, m, F, P, S, E, R, I, T, h, g, d, a, n, u]);
  return Y(() => ({
    ...K,
    currentPage: p
  }), [K, p]);
}
const ai = [
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
], si = [
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
function ii(e) {
  const t = e.length === 1 ? e.toLowerCase() : e;
  for (const n of ai)
    if (n.keys.some(
      (o) => o.length === 1 ? o === t : o === e
    )) return n;
  return null;
}
function ci(e) {
  if (!(e instanceof HTMLElement))
    return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
const li = ".reader-notes-panel";
function ui(e) {
  return e instanceof Element ? !!e.closest(li) : !1;
}
function di(e) {
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
      if (d.defaultPrevented || d.metaKey || d.ctrlKey || d.altKey || ci(d.target) || ui(d.target))
        return;
      const f = d.key, h = ii(f);
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
              a(Qe(t, Fe()));
              return;
            case "next-page":
              i(zt(s + 1, c));
              return;
            case "prev-page":
              i(zt(s - 1, c));
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
const fi = "retainpdf:soft-reader-close";
function mi() {
  return new URL("./index.html", window.location.href).href;
}
function hi() {
  if (typeof window > "u" || window.self === window.top) return !1;
  try {
    return window.parent.postMessage(
      { type: fi },
      window.location.origin
    ), !0;
  } catch {
    return !1;
  }
}
function pi(e, t, n) {
  if (n <= 1 || !e) return !1;
  try {
    const r = new URL(t), o = new URL(e, r);
    return o.origin === r.origin && !/reader\.html$/i.test(o.pathname) && !/detail\.html$/i.test(o.pathname);
  } catch {
    return !1;
  }
}
function gi() {
  if (!(typeof window > "u") && !hi()) {
    if (pi(
      document.referrer,
      window.location.href,
      window.history.length
    )) {
      window.history.back();
      return;
    }
    window.location.assign(mi());
  }
}
function bi({
  id: e,
  className: t,
  label: n,
  pressed: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ b("button", { id: e, type: "button", className: t, "aria-label": n, title: n, "aria-pressed": r, onClick: o, children: a });
}
function yi({ onBeforeClose: e } = {}) {
  return /* @__PURE__ */ z(bi, { id: "reader-close-home-btn", className: "reader-close-home-btn", label: "返回主页", onClick: () => {
    e == null || e(), gi();
  }, children: [
    /* @__PURE__ */ b(vn, { className: "reader-close-home-icon", size: 18, strokeWidth: 2.25, "aria-hidden": !0 }),
    /* @__PURE__ */ b("span", { className: "reader-close-home-label", children: "关闭" })
  ] });
}
let tr = !1;
function vi() {
  if (tr)
    return;
  const e = mt().resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  e && (ea.GlobalWorkerOptions.workerSrc = e, tr = !0);
}
const Si = /* @__PURE__ */ new Set(["text", "formula", "table"]);
function wi(e, t, n) {
  return e.flatMap((r) => {
    if (!Si.has(Cr(r.region))) return [];
    const o = yn(r, t, n);
    return o ? [{ itemId: r.itemId, highlight: r, rect: o }] : [];
  });
}
function nr(e, t, n) {
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
async function Pi(e) {
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
const Ri = "reader-text-hover-copy", Ii = "reader-text-hover-id", Qr = "reader-text-hover-tools";
function rr({
  className: e,
  state: t,
  label: n,
  title: r,
  onClick: o,
  children: a
}) {
  return /* @__PURE__ */ b(
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
const eo = 26, to = 190;
function no(e, t = to) {
  return e.height < eo * 2 || e.width < t;
}
function Ti({
  target: e,
  pane: t = "source",
  revisedCount: n = 0
}) {
  const [r, o] = N("idle"), [a, s] = N("idle"), c = k([]), i = (e == null ? void 0 : e.itemId) || "";
  if (x(() => {
    o("idle"), s("idle");
    const g = c.current;
    return () => {
      g.forEach((m) => window.clearTimeout(m)), c.current = [];
    };
  }, [i]), !e) return null;
  const l = jo(e.highlight.region, t), u = Cr(e.highlight.region), d = (g, m) => async (v) => {
    v.preventDefault(), v.stopPropagation();
    const y = await Pi(g);
    m(y ? "copied" : "failed"), c.current.push(window.setTimeout(() => m("idle"), 1200));
  }, f = u === "formula" ? "复制 LaTeX" : "复制", h = no(e.rect);
  return /* @__PURE__ */ b("div", { className: "reader-text-hover-layer", children: /* @__PURE__ */ b(
    "div",
    {
      className: "reader-text-hover-frame",
      "data-reader-text-hover-id": e.itemId,
      "data-reader-text-hover-kind": u,
      style: e.rect,
      children: /* @__PURE__ */ z(
        "div",
        {
          className: Qr,
          "data-placement": h ? "outside" : "inside",
          children: [
            /* @__PURE__ */ b(
              rr,
              {
                className: Ii,
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
            l ? /* @__PURE__ */ b(
              rr,
              {
                className: Ri,
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
function Ei(e, t) {
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
function Mi(e, t, n, r) {
  if (!e || !t) return [];
  const o = [];
  for (const a of e.blocks) {
    const s = t.itemsById.get(a.item_id);
    if (!(s != null && s.translated_text)) continue;
    const c = yn(
      Ei(e, a),
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
const ki = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", serif', Ai = 256, lt = /* @__PURE__ */ new Map();
function _i(e) {
  return `${e || ""}`.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function Ni(e) {
  const t = `${e || ""}`, { text: n, slots: r } = ra(t, { bareLatex: !0 }), o = _i(n), a = oa(o, r);
  if (!r.length)
    return { fallbackHtml: a, richHtml: Promise.resolve(a), hasMath: !1 };
  let s = lt.get(t);
  if (!s && (s = aa(o, r), lt.set(t, s), lt.size > Ai)) {
    const c = lt.keys().next().value;
    c !== void 0 && lt.delete(c);
  }
  return { fallbackHtml: a, richHtml: s, hasMath: !0 };
}
function Jt(e) {
  return /title|heading|header|display_formula|equation/i.test(e);
}
function Ee(e) {
  const t = Number(e);
  return Number.isFinite(t) && t > 0 ? t : void 0;
}
function Li(e, t) {
  const n = e.typography, r = Ee(t) || 1, o = Ee(n == null ? void 0 : n.font_size_pt), a = Math.max(1, `${e.sourceText || ""}`.split(/\n+/).length), s = e.rect.height / Math.max(1.28, a * 1.18), c = Jt(e.kind) ? 24 : /caption|footnote|table/i.test(e.kind) ? 9.5 : 11, i = Math.max(5.5 * r, Math.min(s, c * r)), l = Ee(n == null ? void 0 : n.fit_min_font_size_pt), u = Ee(n == null ? void 0 : n.fit_max_font_size_pt), d = Math.max(3.5, (l || 5.5) * r), f = Math.max(
    d,
    u ? u * r : o ? o * r : i
  ), h = o ? o * r : i, g = Ee(n == null ? void 0 : n.leading_em), m = [
    Ee(n == null ? void 0 : n.padding_top_pt) || 0,
    Ee(n == null ? void 0 : n.padding_right_pt) || 0,
    Ee(n == null ? void 0 : n.padding_bottom_pt) || 0,
    Ee(n == null ? void 0 : n.padding_left_pt) || 0
  ].map((v) => v * r);
  return {
    fontFamily: `${(n == null ? void 0 : n.font_family) || ""}`.trim() || ki,
    fontSizePx: Math.max(d, Math.min(f, h)),
    minFontSizePx: d,
    maxFontSizePx: f,
    // Typst leading is the additional inter-line gap, unlike CSS line-height.
    lineHeight: g ? 1 + g : 1.3,
    fontWeight: (n == null ? void 0 : n.font_weight) || (Jt(e.kind) ? 600 : 400),
    textAlign: ["left", "center", "right", "justify"].includes(`${(n == null ? void 0 : n.text_align) || ""}`) ? n == null ? void 0 : n.text_align : Jt(e.kind) ? "center" : "justify",
    padding: m,
    exact: !!o
  };
}
function Ci(e, t, n, r) {
  const { minFontSizePx: o, maxFontSizePx: a } = r, s = /* @__PURE__ */ new Map(), c = (d) => {
    const f = s.get(d);
    if (f !== void 0) return f;
    const { width: h, height: g } = e(d), m = h <= t + 0.5 && g <= n + 0.5;
    return s.set(d, m), m;
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
const Di = 512, ut = /* @__PURE__ */ new Map();
let sn = 0;
typeof document < "u" && document.fonts && (document.fonts.ready.then(() => {
  sn += 1;
}).catch(() => {
}), typeof document.fonts.addEventListener == "function" && document.fonts.addEventListener("loadingdone", () => {
  sn += 1;
}));
function zi(e, t, n, r) {
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
function xi({ item: e, pageScale: t }) {
  const n = k(null), r = Y(
    () => Ni(e.translatedText),
    [e.translatedText]
  ), [o, a] = N(r.fallbackHtml), s = Y(
    () => Li(e, t),
    [e, t]
  );
  x(() => {
    let d = !0;
    return a(r.fallbackHtml), r.hasMath && r.richHtml.then((f) => {
      d && a(f);
    }), () => {
      d = !1;
    };
  }, [r]), ke(() => {
    const d = n.current;
    if (!d) return;
    const [f, h, g, m] = s.padding, v = Math.max(1, e.rect.width - m - h), y = Math.max(1, e.rect.height - f - g), w = zi(o, v, y, s);
    let P = ut.get(w);
    if (P === void 0 && (P = Ci(
      (p) => (d.style.fontSize = `${p}px`, { width: d.scrollWidth, height: d.scrollHeight }),
      v,
      y,
      {
        minFontSizePx: s.minFontSizePx,
        maxFontSizePx: s.maxFontSizePx,
        requestedFontSizePx: s.fontSizePx,
        exact: s.exact
      }
    ), ut.set(w, P), ut.size > Di)) {
      const p = ut.keys().next().value;
      p !== void 0 && ut.delete(p);
    }
    d.style.fontSize = `${P.toFixed(2)}px`;
  }, [o, e.rect.height, e.rect.width, s]);
  const [c, i, l, u] = s.padding;
  return /* @__PURE__ */ b(
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
      children: /* @__PURE__ */ b(
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
function Oi({
  layoutPage: e,
  pageState: t,
  width: n,
  height: r
}) {
  const o = Y(
    () => Mi(e, t, n, r),
    [r, e, t, n]
  );
  return o.length ? /* @__PURE__ */ b(
    "div",
    {
      className: "reader-live-translation-overlay",
      "data-live-translation-page": e == null ? void 0 : e.page_idx,
      "data-live-translation-generation": t == null ? void 0 : t.generation,
      "aria-hidden": "true",
      children: o.map((a) => /* @__PURE__ */ b(
        xi,
        {
          item: a,
          pageScale: e != null && e.width ? n / e.width : 1
        },
        `${a.itemId}:${a.changedAtSeq}`
      ))
    }
  ) : null;
}
const Fi = mn(Oi), ro = hn(null), oo = hn(null);
function $i({ value: e, hud: t, children: n }) {
  return /* @__PURE__ */ b(ro.Provider, { value: e, children: /* @__PURE__ */ b(oo.Provider, { value: t, children: n }) });
}
function He() {
  return pn(ro);
}
function ao() {
  return pn(oo);
}
const so = 1.414;
function ji({
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
  liveTranslationLayout: m,
  liveTranslationPage: v,
  showLiveTranslation: y = r === "source"
}) {
  var oe;
  const w = (oe = He()) == null ? void 0 : oe.revisedBlocks, P = k(i ?? so), [p, S] = N(P.current);
  x(() => {
    i != null && Math.abs(i - P.current) >= 1e-3 && (P.current = i, S(i));
  }, [i]);
  const E = k(u);
  E.current = u;
  const _ = k(null), O = k((j) => {
    var B;
    _.current = j, (B = E.current) == null || B.call(E, j);
  }).current, L = k(null), C = k(`${t}@${n}`);
  ke(() => {
    const j = `${t}@${n}`;
    C.current !== j && (C.current = j, o && Ui(_.current, L.current));
  }, [o, n, t]), x(() => {
    o || qt(L.current);
  }, [o]), x(() => () => qt(L.current), []);
  const R = Math.max(120, Math.floor(t * p)), I = Math.max(R, Math.ceil(s || 0)), T = yn(d, t, R), M = Y(
    () => wi(f, t, R),
    [R, f, t]
  ), [F, K] = N(null), D = typeof g == "function", q = D ? h ?? null : F, U = (j) => {
    D ? j !== (h ?? null) && (g == null || g(j)) : K((B) => B === j ? B : j);
  }, V = Y(
    () => M.find((j) => j.itemId === q) || null,
    [q, M]
  ), ne = (j) => {
    var Ae, Re;
    if (j.pointerType === "touch") return;
    if (j.buttons !== 0) {
      U(null);
      return;
    }
    if ((Re = (Ae = j.target) == null ? void 0 : Ae.closest) != null && Re.call(Ae, `.${Qr}`)) return;
    const B = j.currentTarget.getBoundingClientRect(), Z = j.clientX - B.left, he = j.clientY - B.top, ae = V == null ? void 0 : V.rect;
    if (ae && no(ae) && Z >= ae.left - 4 && Z <= ae.left + to && he >= ae.top - eo && he <= ae.top) return;
    const Pe = nr(M, Z, he);
    U((Pe == null ? void 0 : Pe.itemId) || null);
  }, me = (j) => {
    if (j.pointerType === "mouse") return;
    const B = j.currentTarget.getBoundingClientRect(), Z = nr(
      M,
      j.clientX - B.left,
      j.clientY - B.top
    );
    U((Z == null ? void 0 : Z.itemId) || null);
  }, re = (j) => {
    !Number.isFinite(j) || j <= 0 || Math.abs(P.current - j) < 1e-3 || (P.current = j, S(j), l == null || l(e, j));
  };
  return /* @__PURE__ */ z(
    "div",
    {
      ref: O,
      [$e]: e,
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
        o ? /* @__PURE__ */ b(
          ta,
          {
            pageNumber: e,
            width: t,
            devicePixelRatio: n,
            renderTextLayer: a,
            renderAnnotationLayer: !1,
            className: $r,
            loading: /* @__PURE__ */ b(
              "div",
              {
                className: Nt,
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
              qt(L.current), c == null || c();
            }
          }
        ) : /* @__PURE__ */ b(
          "div",
          {
            className: Nt,
            style: { width: t, height: R },
            "aria-hidden": !0
          }
        ),
        o ? /* @__PURE__ */ b("div", { ref: L, className: "reader-react-pdf-kept-paint", "aria-hidden": "true" }) : null,
        T ? /* @__PURE__ */ b(
          "div",
          {
            className: "reader-react-pdf-region-highlight",
            "data-reader-region-id": d == null ? void 0 : d.itemId,
            style: T,
            "aria-hidden": "true"
          }
        ) : null,
        o && a && y ? /* @__PURE__ */ b(
          Fi,
          {
            layoutPage: m,
            pageState: v,
            width: t,
            height: R
          }
        ) : null,
        o && r === "translated" && (w != null && w.size) ? /* @__PURE__ */ b("div", { className: "reader-revised-markers", "aria-hidden": "true", children: M.filter((j) => w.has(j.itemId)).map((j) => /* @__PURE__ */ b(
          "span",
          {
            className: "reader-revised-marker",
            "data-reader-revised-id": j.itemId,
            style: { left: j.rect.left, top: j.rect.top, height: j.rect.height }
          },
          j.itemId
        )) }) : null,
        /* @__PURE__ */ b(
          Ti,
          {
            target: o ? V : null,
            pane: r === "translated" ? "translated" : "source",
            revisedCount: V && (w == null ? void 0 : w.get(V.itemId)) || 0
          }
        )
      ]
    }
  );
}
const Bi = mn(ji);
function Ui(e, t) {
  if (!e || !t || t.firstChild) return;
  const n = e.querySelector(".react-pdf__Page__canvas");
  if (!n || !n.width || !n.height || n.style.visibility === "hidden") return;
  const r = e.ownerDocument.createElement("canvas");
  r.width = n.width, r.height = n.height;
  const o = r.getContext("2d");
  o && (o.drawImage(n, 0, 0), t.appendChild(r));
}
function qt(e) {
  if (e != null && e.firstChild) {
    for (const t of Array.from(e.querySelectorAll("canvas")))
      t.width = 0, t.height = 0;
    e.replaceChildren();
  }
}
const Gt = 5, Hi = "120% 0px", Wi = 120, Vi = "25% 0px";
let or = 1;
const ar = /* @__PURE__ */ new WeakMap();
function Ji(e) {
  if (!e) return 0;
  const t = ar.get(e);
  if (t) return t;
  const n = or;
  return or += 1, ar.set(e, n), n;
}
function qi() {
  const e = typeof window < "u" && window.devicePixelRatio || 1;
  return Math.max(1, Math.min(e, 2));
}
const Gi = Mo(
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
    regions: m = [],
    readerMetadata: v = null,
    hoveredRegionId: y = null,
    onHoverRegion: w,
    liveTranslation: P,
    showLiveTranslation: p = t === "source",
    liveTranslationPendingLabel: S = "",
    paneAction: E
  }, _) {
    vi();
    const { file: O, loading: L, error: C } = $a(n, r), R = `${n}\0${Ji(O)}`, I = k(R);
    I.current = R;
    const T = Y(
      () => Ca(O),
      [O, n]
    ), [M, F] = N(0), [K, D] = N(""), [q, U] = N(null), [V, ne] = N(480), me = k(null), re = k(0), oe = Y(() => qi(), []), j = Y(() => ({
      cMapUrl: mt().resolvePdfjsVendorUrl("cmaps/"),
      cMapPacked: !0,
      standardFontDataUrl: mt().resolvePdfjsVendorUrl("standard_fonts/")
    }), []);
    gn(_, () => q, [q]), x(() => {
      const A = (H) => {
        re.current = H, ne(H);
      }, J = (H) => {
        const Q = fs(H, re.current);
        if (Q !== "ignore") {
          if (me.current && clearTimeout(me.current), Q === "immediate") {
            A(H);
            return;
          }
          me.current = setTimeout(() => A(H), Ur);
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
      () => ls(V, o),
      [V, o]
    ), [Z, he] = N(() => /* @__PURE__ */ new Map()), [ae, Pe] = N(() => /* @__PURE__ */ new Set()), [Ae, Re] = N(() => /* @__PURE__ */ new Set()), Je = k(/* @__PURE__ */ new Map()), qe = k(null), te = k(null), [le, pe] = N(() => /* @__PURE__ */ new Set()), se = k(/* @__PURE__ */ new Map()), ue = $((A, J) => {
      he((W) => {
        if (W.get(A) === J) return W;
        const G = new Map(W);
        return G.set(A, J), G;
      });
    }, []), ie = $((A, J) => {
      const W = Je.current, G = W.get(A), ee = [qe.current, te.current];
      if (G)
        for (const H of ee)
          try {
            H == null || H.unobserve(G);
          } catch {
          }
      if (J) {
        W.set(A, J);
        for (const H of ee)
          try {
            H == null || H.observe(J);
          } catch {
          }
      } else
        W.delete(A);
    }, []), Ge = k(/* @__PURE__ */ new Map()), Ke = $((A) => {
      const J = Ge.current;
      let W = J.get(A);
      return W || (W = (G) => ie(A, G), J.set(A, W)), W;
    }, [ie]);
    x(() => {
      if (typeof IntersectionObserver > "u") return;
      const A = se.current, J = new IntersectionObserver(
        (W) => {
          const G = [], ee = [];
          for (const H of W) {
            const Q = H.target, ce = Ct(Q);
            Number.isFinite(ce) && (H.isIntersecting ? G : ee).push(ce);
          }
          if ((G.length || ee.length) && Pe((H) => {
            let Q = null;
            for (const ce of G)
              H.has(ce) || (Q = Q || new Set(H), Q.add(ce));
            for (const ce of ee)
              H.has(ce) && (Q = Q || new Set(H), Q.delete(ce));
            return Q || H;
          }), G.length) {
            for (const H of G) {
              const Q = A.get(H);
              Q && (clearTimeout(Q), A.delete(H));
            }
            Re((H) => {
              let Q = null;
              for (const ce of G)
                H.has(ce) || (Q = Q || new Set(H), Q.add(ce));
              return Q || H;
            });
          }
          for (const H of ee)
            A.has(H) || A.set(H, setTimeout(() => {
              A.delete(H), Re((Q) => {
                if (!Q.has(H)) return Q;
                const ce = new Set(Q);
                return ce.delete(H), ce;
              });
            }, Wi));
        },
        { root: c, rootMargin: Hi, threshold: 0 }
      );
      qe.current = J;
      for (const W of Je.current.values())
        try {
          J.observe(W);
        } catch {
        }
      return () => {
        J.disconnect(), qe.current === J && (qe.current = null);
        for (const W of A.values()) clearTimeout(W);
        A.clear();
      };
    }, [c]), x(() => {
      if (typeof IntersectionObserver > "u") return;
      const A = new IntersectionObserver(
        (J) => {
          pe((W) => {
            let G = null;
            for (const ee of J) {
              const H = Ct(ee.target);
              !Number.isFinite(H) || ee.isIntersecting === W.has(H) || (G = G || new Set(W), ee.isIntersecting ? G.add(H) : G.delete(H));
            }
            return G || W;
          });
        },
        { root: c, rootMargin: Vi, threshold: 0 }
      );
      te.current = A;
      for (const J of Je.current.values())
        try {
          A.observe(J);
        } catch {
        }
      return () => {
        A.disconnect(), te.current === A && (te.current = null);
      };
    }, [c]);
    const st = !!c && typeof IntersectionObserver < "u";
    ke(() => {
      F(0), D(""), Pe(/* @__PURE__ */ new Set()), Re(/* @__PURE__ */ new Set()), he(/* @__PURE__ */ new Map()), Je.current.clear();
      const A = se.current;
      for (const J of A.values()) clearTimeout(J);
      A.clear(), h == null || h(0, t);
    }, [R, h, t]);
    const Bt = $(
      ({ numPages: A }) => {
        I.current === R && (F(A), D(""), h == null || h(A, t), d == null || d({ numPages: A, pane: t }));
      },
      [R, d, h, t]
    ), Ut = $(
      (A) => {
        if (I.current !== R) return;
        const J = (A == null ? void 0 : A.message) || "PDF 解析失败";
        D(J), F(0), h == null || h(0, t), f == null || f(A, t);
      },
      [R, f, h, t]
    ), _e = Y(
      () => M > 0 ? Array.from({ length: M }, (A, J) => J + 1) : [],
      [M]
    );
    x(() => {
      typeof IntersectionObserver < "u" || Re(new Set(_e));
    }, [_e]);
    const Ne = Y(
      () => Hn(g, v, t),
      [g, v, t]
    ), De = Y(() => {
      const A = /* @__PURE__ */ new Map();
      for (const J of m) {
        const W = Hn(J, v, t);
        if (!W) continue;
        const G = A.get(W.box.page) || [];
        G.push(W), A.set(W.box.page, G);
      }
      return A;
    }, [t, v, m]), St = Y(() => {
      const A = /* @__PURE__ */ new Set();
      if (!y) return A;
      for (const [J, W] of De)
        W.some((G) => G.itemId === y) && A.add(J);
      return A;
    }, [y, De]), wt = Y(() => {
      if (M === 0) return /* @__PURE__ */ new Set();
      if (!a) return /* @__PURE__ */ new Set();
      if (!(!!c && typeof IntersectionObserver < "u")) return new Set(_e);
      if (ae.size === 0) {
        const W = Math.min(M, Gt * 2 + 1);
        return new Set(Array.from({ length: W }, (G, ee) => ee + 1));
      }
      const J = /* @__PURE__ */ new Set();
      for (const W of ae)
        for (let G = -Gt; G <= Gt; G++) {
          const ee = W + G;
          ee >= 1 && ee <= M && J.add(ee);
        }
      return J;
    }, [M, _e, c, a, ae]), Ze = !n || !!C || !!K, Pt = n && (C || K) || s;
    return /* @__PURE__ */ z(
      "section",
      {
        ref: U,
        className: `reader-panel ${ts}${a ? "" : " is-hidden"}`,
        [rt]: t,
        "data-reader-engine": "react-pdf",
        "data-reader-visible": a ? "true" : "false",
        "data-live-translation-status": (P == null ? void 0 : P.jobStatus) || void 0,
        "aria-hidden": a ? void 0 : !0,
        "aria-label": t === "source" ? "原文 PDF" : "译文 PDF",
        children: [
          E ? /* @__PURE__ */ b("div", { className: "reader-react-pdf-pane-action", children: E }) : null,
          S ? /* @__PURE__ */ z("div", { className: "reader-live-translation-waiting", role: "status", children: [
            /* @__PURE__ */ b("span", { className: "reader-live-translation-waiting-dot", "aria-hidden": "true" }),
            /* @__PURE__ */ b("span", { children: S })
          ] }) : null,
          Ze && !L ? /* @__PURE__ */ b("div", { className: "reader-empty reader-react-pdf-empty", "data-reader-pdf-empty": t, children: Pt }) : null,
          L ? /* @__PURE__ */ b("div", { className: "reader-empty reader-react-pdf-loading", "data-reader-pdf-loading": t, children: "正在加载 PDF…" }) : null,
          T && !C ? /* @__PURE__ */ b("div", { className: "reader-viewer-wrap reader-react-pdf-wrap", children: /* @__PURE__ */ b(
            na,
            {
              file: T,
              loading: null,
              error: null,
              options: j,
              onLoadSuccess: Bt,
              onLoadError: Ut,
              className: "reader-react-pdf-document",
              children: _e.map((A) => {
                if (wt.has(A))
                  return /* @__PURE__ */ b(
                    Bi,
                    {
                      pane: t,
                      pageNumber: A,
                      width: B,
                      devicePixelRatio: oe,
                      active: Ae.has(A),
                      textLayer: !st || le.has(A),
                      syncedMinHeight: (l == null ? void 0 : l.get(A)) || 0,
                      onMetrics: u,
                      cachedAspect: Z.get(A),
                      onAspectChange: ue,
                      sentinelRef: Ke(A),
                      regionHighlight: (Ne == null ? void 0 : Ne.box.page) === A ? Ne : null,
                      regionTargets: De.get(A),
                      hoveredRegionId: y && St.has(A) ? y : null,
                      onHoverRegion: w,
                      liveTranslationLayout: P == null ? void 0 : P.layoutByPage.get(A - 1),
                      liveTranslationPage: P == null ? void 0 : P.pagesByPage.get(A - 1),
                      showLiveTranslation: p
                    },
                    `${t}-${A}`
                  );
                const W = Z.get(A) ?? so, G = Math.max(120, Math.floor(B * W)), ee = Math.max(G, Math.ceil((l == null ? void 0 : l.get(A)) || 0));
                return /* @__PURE__ */ b(
                  "div",
                  {
                    ref: Ke(A),
                    [$e]: A,
                    [rt]: t,
                    [Sn]: G,
                    className: `${wn} is-placeholder`,
                    style: {
                      width: B,
                      height: ee,
                      minHeight: ee
                    },
                    children: /* @__PURE__ */ b(
                      "div",
                      {
                        className: Nt,
                        style: { width: B, height: G },
                        "aria-hidden": !0
                      }
                    )
                  },
                  `${t}-${A}`
                );
              })
            },
            R
          ) }) : null
        ]
      }
    );
  }
), sr = mn(Gi), Ki = 2e3, Zi = 6, Yi = 500, ir = "reader-react-resizing";
function Xi(e, t) {
  const n = k(null), r = k(null);
  ke(() => {
    const o = n.current;
    if (n.current = t, !e || o === null || t === null || Math.abs(o - t) < 1) return;
    const a = r.current;
    a == null || a.stop();
    let s = a ? { pane: a.pane, progress: a.progress, started: a.started } : null;
    if (!s) {
      const p = Qi(e), S = Mt(e, p);
      if (!S) return;
      s = { pane: p, progress: S, started: performance.now() };
    }
    const { pane: c, progress: i, started: l } = s;
    let u = 0, d = null, f = e.scrollHeight, h = f, g = 0, m = l;
    const v = /* @__PURE__ */ new WeakMap(), y = typeof ResizeObserver > "u" ? null : new ResizeObserver((p) => {
      let S = !1;
      for (const E of p) {
        const _ = Math.round(E.contentRect.height);
        v.has(E.target) && v.get(E.target) !== _ && (S = !0), v.set(E.target, _);
      }
      S && pt(e, i, "auto", c);
    }), w = () => {
      var p;
      d && clearTimeout(d), cancelAnimationFrame(u), y == null || y.disconnect(), e.classList.remove(ir);
      for (const S of cr) e.removeEventListener(S, w);
      ((p = r.current) == null ? void 0 : p.stop) === w && (r.current = null);
    }, P = () => {
      pt(e, i, "auto", c);
      const p = e.scrollHeight;
      g = p === h ? g + 1 : 0, h = p;
      const S = performance.now() - m;
      g >= Zi && (p !== f || S > Yi) || S > Ki ? w() : u = requestAnimationFrame(P);
    };
    for (const p of cr) e.addEventListener(p, w, { passive: !0 });
    for (const p of Array.from(e.children)) y == null || y.observe(p);
    e.classList.add(ir), r.current = { ...s, stop: w }, d = setTimeout(() => {
      d = null, m = performance.now(), f = e.scrollHeight, h = f, g = 0, u = requestAnimationFrame(P);
    }, Ur);
  }, [e, t]), x(() => () => {
    var o;
    return (o = r.current) == null ? void 0 : o.stop();
  }, []);
}
function Qi(e) {
  for (const t of Array.from(e.querySelectorAll(`[${$e}]`))) {
    const n = t.getBoundingClientRect();
    if (n.height >= 8 && n.width >= 8) return t.getAttribute(rt) || null;
  }
  return null;
}
const cr = ["wheel", "touchstart", "keydown", "pointerdown"], ec = () => () => {
}, lr = () => null;
function tc({
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
function nc(e, t, n = e * 2) {
  return t ? !Number.isFinite(e) || e <= 0 ? n : e * 2 : e;
}
function rc(e) {
  return e ? e.connection === "terminal" && e.jobStatus === "failed" ? e.pagesByPage.size > 0 ? `翻译已暂停，已保留 ${e.pagesByPage.size} 页译文` : "翻译已暂停，原始 PDF 仍可阅读" : e.connection === "terminal" && ["cancelled", "canceled"].includes(e.jobStatus) ? e.pagesByPage.size > 0 ? `翻译已取消，已保留 ${e.pagesByPage.size} 页译文` : "翻译已取消，原始 PDF 仍可阅读" : e.pagesByPage.size > 0 ? "" : e.connection === "unavailable" ? e.error || "实时译文暂不可用，原始 PDF 仍可阅读" : e.error ? e.error : e.layoutByPage.size === 0 ? "正在完成 OCR，译文将在这里逐页出现" : "版面已就绪，正在等待首个译文页面" : "";
}
function oc(e) {
  const t = He(), {
    markdownSplit: n = !1,
    assistantSplit: r = !1,
    liveTranslation: o,
    paneComposition: a
  } = e, s = (a == null ? void 0 : a.visibleMode) ?? e.mode ?? "compare", c = (a == null ? void 0 : a.compareMode) ?? e.compareMode ?? s === "compare", i = (a == null ? void 0 : a.showSource) ?? e.showSource ?? !0, l = (a == null ? void 0 : a.showTranslated) ?? e.showTranslated ?? (s === "compare" || s === "translated"), u = (a == null ? void 0 : a.overlayOnSource) ?? e.overlayOnSource ?? !1, d = e.bindShell ?? (t == null ? void 0 : t.bindShell), f = e.shellEl ?? (t == null ? void 0 : t.shellEl) ?? null, h = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? vt, g = e.shellWidth ?? (t == null ? void 0 : t.shellWidth) ?? 0, m = e.rowHeights ?? (t == null ? void 0 : t.rowHeights), v = e.mountSource ?? (t == null ? void 0 : t.mountSource) ?? !1, y = e.mountTranslated ?? (t == null ? void 0 : t.mountTranslated) ?? !1, w = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, P = e.sourceUrl ?? (t == null ? void 0 : t.sourceUrl) ?? "", p = e.translatedUrl ?? (t == null ? void 0 : t.translatedUrl) ?? "", S = e.sourceFile ?? (t == null ? void 0 : t.sourceFile) ?? null, E = e.translatedFile ?? (t == null ? void 0 : t.translatedFile) ?? null, _ = e.onMetrics ?? (t == null ? void 0 : t.onMetrics), O = e.onNumPagesChange ?? (t == null ? void 0 : t.onNumPagesChange), L = e.activeRegion ?? (t == null ? void 0 : t.activeRegion), C = e.regions ?? (t == null ? void 0 : t.regions) ?? [], R = e.readerMetadata ?? (t == null ? void 0 : t.readerMetadata), I = (t == null ? void 0 : t.regionHover) ?? null, [T, M] = N(null), F = Nr(
    I ? I.subscribe : ec,
    I ? () => I.get().itemId : lr,
    I ? () => I.get().itemId : lr
  ), K = I ? F : T, D = $((ne) => {
    I ? I.set(ne, "pdf") : M(ne);
  }, [I]), q = tc({
    mode: s,
    compareMode: c,
    showSource: i,
    showTranslated: l,
    markdownSplit: n,
    overlayOnSource: u
  }), V = Number.isFinite(g) && g > 0 ? nc(
    g,
    n || r,
    typeof document > "u" ? g * 2 : document.documentElement.clientWidth
  ) : null;
  return Xi(f, V), /* @__PURE__ */ b(
    "div",
    {
      ref: d,
      className: es,
      "data-reader-region-count": C.length,
      "data-reader-structured-region-count": C.filter(Bo).length,
      "data-reader-metadata-ready": R ? "true" : "false",
      children: /* @__PURE__ */ z(
        "main",
        {
          className: `${Qa} reader-mode-${q.mode}`,
          "data-reader-mode": n ? "markdown-split" : r ? "assistant-split" : s,
          children: [
            v ? /* @__PURE__ */ b(
              sr,
              {
                pane: "source",
                url: P,
                preloadedFile: S,
                userZoom: h,
                visible: q.showSource,
                scrollRoot: f,
                pageWidthOverride: V,
                rowHeights: q.compareMode ? m : void 0,
                onMetrics: _,
                emptyLabel: w ? "源文件不可用：该文档没有可读取的源 PDF。" : "暂无原文 PDF",
                onNumPagesChange: O,
                activeRegion: L,
                regions: C,
                readerMetadata: R,
                hoveredRegionId: K,
                onHoverRegion: D,
                liveTranslation: u ? o : void 0,
                showLiveTranslation: u,
                liveTranslationPendingLabel: u ? rc(o) : "",
                paneAction: u ? /* @__PURE__ */ z(Ot, { children: [
                  e.sourcePaneAction,
                  /* @__PURE__ */ b(
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
            y ? /* @__PURE__ */ b(
              sr,
              {
                pane: "translated",
                url: p,
                preloadedFile: E,
                userZoom: h,
                visible: q.showTranslated,
                scrollRoot: f,
                pageWidthOverride: V,
                rowHeights: q.compareMode ? m : void 0,
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
const ac = [
  { id: "source", label: "原文", Icon: Dr },
  { id: "compare", label: "对照", Icon: zr },
  { id: "translated", label: "译文", Icon: xr }
];
function sc(e) {
  return e.connection === "live" ? `实时译文 · ${e.pagesByPage.size} 页` : e.connection === "reconnecting" ? "实时译文 · 重连中" : e.connection === "unavailable" ? "实时译文 · 不可用" : e.connection === "terminal" ? e.jobStatus === "failed" ? "实时译文 · 已暂停" : e.jobStatus === "cancelled" || e.jobStatus === "canceled" ? "实时译文 · 已取消" : e.jobStatus === "succeeded" ? "实时译文 · 已完成" : "实时译文 · 已结束" : e.error || "实时译文 · 连接中";
}
function ic(e) {
  return e.id === "translated" ? e.sourceViewOnly : e.id === "compare" ? !e.documentReady || e.sourceViewOnly && !e.liveTranslationAvailable : !1;
}
function cc(e) {
  const t = He(), {
    mode: n,
    documentReady: r,
    onModeChange: o,
    liveTranslation: a = null
  } = e, s = e.sourceViewOnly ?? (t == null ? void 0 : t.sourceViewOnly) ?? !1, c = a ? sc(a.state) : "";
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
          /* @__PURE__ */ b(Jo, { size: 14, strokeWidth: 2.2, "aria-hidden": !0 }),
          /* @__PURE__ */ b("span", { className: "reader-live-translation-toggle-label", children: c })
        ]
      }
    ) : null,
    /* @__PURE__ */ b("div", { className: "reader-workspace-tabs", role: "tablist", "aria-label": "阅读工作区", children: ac.map(({ id: i, label: l, Icon: u }) => {
      const d = n === i, f = ic({
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
          title: f ? `${l} 需要文档任务` : l,
          disabled: f,
          onClick: () => o(i),
          children: [
            /* @__PURE__ */ b(u, { size: 15, strokeWidth: 2.2, "aria-hidden": !0 }),
            /* @__PURE__ */ b("span", { className: "reader-workspace-tab-label", children: l })
          ]
        },
        i
      );
    }) })
  ] });
}
const lc = {
  markdown: { label: "Markdown", short: "MD", Icon: qo, needsJob: !0 }
}, uc = Hr.map(
  (e) => ({ id: e, ...lc[e] })
);
function dc() {
  return uc.map(({ id: e, label: t, short: n, Icon: r, needsJob: o }) => ({
    id: e,
    label: t,
    short: n,
    Icon: r,
    needsJob: o
  }));
}
function fc(e) {
  const t = He(), { active: n, badges: r } = e, o = e.sourceOnly ?? (t == null ? void 0 : t.sourceOnly) ?? !1, a = e.onSelect ?? (t == null ? void 0 : t.assistant.select) ?? (() => {
  }), s = e.onClose ?? (t == null ? void 0 : t.assistant.close) ?? (() => {
  }), c = dc().map(({ id: i, label: l, short: u, Icon: d, needsJob: f }) => ({
    key: i,
    label: l,
    short: u,
    Icon: d,
    disabled: f && o,
    selected: n === i,
    badge: r == null ? void 0 : r[i],
    onClick: () => a(i)
  }));
  return n ? /* @__PURE__ */ z("header", { className: "reader-assistant-dock-header", children: [
    /* @__PURE__ */ b("div", { className: "reader-assistant-dock-tabs", role: "tablist", "aria-label": "阅读辅助面板", children: c.map(({ key: i, label: l, Icon: u, disabled: d, selected: f, badge: h, onClick: g }) => /* @__PURE__ */ z(
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
          /* @__PURE__ */ b(u, { size: 15, strokeWidth: 2.15, "aria-hidden": !0 }),
          /* @__PURE__ */ b("span", { className: "reader-assistant-dock-tab-label", children: l }),
          h ? /* @__PURE__ */ b("span", { className: "reader-assistant-dock-badge", children: h }) : null
        ]
      },
      i
    )) }),
    /* @__PURE__ */ b(
      "button",
      {
        type: "button",
        className: "reader-assistant-dock-close",
        "aria-label": "关闭阅读辅助面板",
        title: "关闭辅助面板",
        onClick: s,
        children: /* @__PURE__ */ b(vn, { size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
      }
    )
  ] }) : /* @__PURE__ */ b("nav", { className: "reader-assistant-rail", "aria-label": "阅读辅助工具", children: c.map(({ key: i, label: l, short: u, Icon: d, disabled: f, badge: h, onClick: g }) => /* @__PURE__ */ z(
    "button",
    {
      type: "button",
      className: "reader-assistant-rail-button",
      "aria-label": `打开${l}`,
      title: f ? `${l} 需打开任务阅读` : l,
      disabled: f,
      onClick: g,
      children: [
        /* @__PURE__ */ b(d, { size: 18, strokeWidth: 2, "aria-hidden": !0 }),
        /* @__PURE__ */ b("span", { children: u }),
        h ? /* @__PURE__ */ b("span", { className: "reader-assistant-dock-badge", children: h }) : null
      ]
    },
    i
  )) });
}
function mc(e, t) {
  const n = getComputedStyle(e), r = parseFloat(n.fontSize);
  return t * r;
}
function hc(e, t) {
  const n = getComputedStyle(e.ownerDocument.documentElement), r = parseFloat(n.fontSize);
  return t * r;
}
function pc(e) {
  return e / 100 * window.innerHeight;
}
function gc(e) {
  return e / 100 * window.innerWidth;
}
function bc(e) {
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
  const [o, a] = bc(n);
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
      r = hc(t, o);
      break;
    }
    case "em": {
      r = mc(t, o);
      break;
    }
    case "vh": {
      r = pc(o);
      break;
    }
    case "vw": {
      r = gc(o);
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
    e === "horizontal" ? yc : vc
  );
}
function yc(e, t) {
  const n = e.element.offsetLeft - t.element.offsetLeft;
  return n !== 0 ? n : e.element.offsetWidth - t.element.offsetWidth;
}
function vc(e, t) {
  const n = e.element.offsetTop - t.element.offsetTop;
  return n !== 0 ? n : e.element.offsetHeight - t.element.offsetHeight;
}
function io(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.ELEMENT_NODE;
}
function co(e, t) {
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
function Sc({
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
    const { x: c, y: i } = co(r, s), l = e === "horizontal" ? c : i;
    l < a && (a = l, o = s);
  }
  return X(o, "No rect found"), o;
}
let Tt;
function wc() {
  return Tt === void 0 && (typeof matchMedia == "function" ? Tt = !!matchMedia("(pointer:coarse)").matches : Tt = !1), Tt;
}
function lo(e) {
  const { element: t, orientation: n, panels: r, separators: o } = e, a = ln(
    n,
    Array.from(t.children).filter(io).map((g) => ({ element: g }))
  ).map(({ element: g }) => g), s = [];
  let c = !1, i = !1, l = -1, u = -1, d = 0, f, h = [];
  {
    let g = -1;
    for (const m of a)
      m.hasAttribute("data-panel") && (g++, m.hasAttribute("data-disabled") || (d++, l === -1 && (l = g), u = g));
  }
  if (d > 1) {
    let g = -1;
    for (const m of a)
      if (m.hasAttribute("data-panel")) {
        g++;
        const v = r.find(
          (y) => y.element === m
        );
        if (v) {
          if (f) {
            const y = f.element.getBoundingClientRect(), w = m.getBoundingClientRect();
            let P;
            if (i) {
              const p = n === "horizontal" ? new DOMRect(
                y.right,
                y.top,
                0,
                y.height
              ) : new DOMRect(
                y.left,
                y.bottom,
                y.width,
                0
              ), S = n === "horizontal" ? new DOMRect(w.left, w.top, 0, w.height) : new DOMRect(w.left, w.top, w.width, 0);
              switch (h.length) {
                case 0: {
                  P = [
                    p,
                    S
                  ];
                  break;
                }
                case 1: {
                  const E = h[0], _ = Sc({
                    orientation: n,
                    rects: [y, w],
                    targetRect: E.element.getBoundingClientRect()
                  });
                  P = [
                    E,
                    _ === y ? S : p
                  ];
                  break;
                }
                default: {
                  P = h;
                  break;
                }
              }
            } else
              h.length ? P = h : P = [
                n === "horizontal" ? new DOMRect(
                  y.right,
                  w.top,
                  w.left - y.right,
                  w.height
                ) : new DOMRect(
                  w.left,
                  y.bottom,
                  w.width,
                  w.top - y.bottom
                )
              ];
            for (const p of P) {
              let S = "width" in p ? p : p.element.getBoundingClientRect();
              const E = wc() ? e.resizeTargetMinimumSize.coarse : e.resizeTargetMinimumSize.fine;
              if (S.width < E) {
                const O = E - S.width;
                S = new DOMRect(
                  S.x - O / 2,
                  S.y,
                  S.width + O,
                  S.height
                );
              }
              if (S.height < E) {
                const O = E - S.height;
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
                panels: [f, v],
                separator: "width" in p ? void 0 : p,
                rect: S
              }), c = !1;
            }
          }
          i = !1, f = v, h = [];
        }
      } else if (m.hasAttribute("data-separator")) {
        m.ariaDisabled !== null && (c = !0);
        const v = o.find(
          (y) => y.element === m
        );
        v ? h.push(v) : (f = void 0, h = []);
      } else
        i = !0;
  }
  return s;
}
var Le;
class uo {
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
const In = new uo();
function je() {
  return tt;
}
function Pc(e) {
  return In.addListener("change", e);
}
function Rc(e) {
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
const Ic = (e) => e, Kt = () => {
}, fo = 1, mo = 2, ho = 4, po = 8, ur = 3, dr = 12;
let Et;
function fr() {
  return Et === void 0 && (Et = !1, typeof window < "u" && (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) && (Et = !0)), Et;
}
function Tc({
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
        if (e && fr()) {
          const a = (e & fo) !== 0, s = (e & mo) !== 0, c = (e & ho) !== 0, i = (e & po) !== 0;
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
    return fr() ? r > 0 && o > 0 ? "move" : r > 0 ? "ew-resize" : "ns-resize" : r > 0 && o > 0 ? "grab" : r > 0 ? "col-resize" : "row-resize";
  }
}
const mr = /* @__PURE__ */ new WeakMap();
function Tn(e) {
  if (e.defaultView === null || e.defaultView === void 0)
    return;
  let { prevStyle: t, styleSheet: n } = mr.get(e) ?? {};
  n === void 0 && (n = new e.defaultView.CSSStyleSheet(), e.adoptedStyleSheets && (Object.isExtensible(e.adoptedStyleSheets) ? e.adoptedStyleSheets.push(n) : e.adoptedStyleSheets = [
    ...e.adoptedStyleSheets,
    n
  ]));
  const r = je();
  switch (r.state) {
    case "active":
    case "hover": {
      const o = Tc({
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
  mr.set(e, {
    prevStyle: t,
    styleSheet: n
  });
}
let Se = /* @__PURE__ */ new Map();
const go = new uo();
function Ec(e) {
  Se = new Map(Se), Se.delete(e);
}
function hr(e, t) {
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
function En(e, t) {
  return go.addListener("groupChange", (n) => {
    n.group.id === e && t(n);
  });
}
function Me(e, t, n) {
  const r = Se.get(e);
  Se = new Map(Se), Se.set(e, t), go.emit("groupChange", {
    group: e,
    isUserInteraction: (n == null ? void 0 : n.isUserInteraction) === !0,
    prev: r,
    next: t
  });
}
function bo(e) {
  const t = je();
  let n = !1;
  switch (t.state) {
    case "active":
      nt({
        cursorFlags: 0,
        state: "inactive"
      }), t.hitRegions.length > 0 && (Tn(e), n = !0, t.hitRegions.forEach((r) => {
        const o = Ce(r.group.id, !0);
        Me(r.group, o, {
          isUserInteraction: !0
        });
      }));
  }
  return n;
}
function pr(e) {
  e.defaultPrevented || bo(e.currentTarget);
}
function Mc(e, t, n) {
  let r, o = {
    x: 1 / 0,
    y: 1 / 0
  };
  for (const a of t) {
    const s = co(n, a.rect);
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
function kc(e) {
  return e !== null && typeof e == "object" && "nodeType" in e && e.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
function Ac(e, t) {
  if (e === t) throw new Error("Cannot compare node with itself");
  const n = {
    a: yr(e),
    b: yr(t)
  };
  let r;
  for (; n.a.at(-1) === n.b.at(-1); )
    r = n.a.pop(), n.b.pop();
  X(
    r,
    "Stacking order can only be calculated for elements with a common ancestor"
  );
  const o = {
    a: br(gr(n.a)),
    b: br(gr(n.b))
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
const _c = /\b(?:position|zIndex|opacity|transform|webkitTransform|mixBlendMode|filter|webkitFilter|isolation)\b/;
function Nc(e) {
  const t = getComputedStyle(yo(e) ?? e).display;
  return t === "flex" || t === "inline-flex";
}
function Lc(e) {
  const t = getComputedStyle(e);
  return !!(t.position === "fixed" || t.zIndex !== "auto" && (t.position !== "static" || Nc(e)) || +t.opacity < 1 || "transform" in t && t.transform !== "none" || "webkitTransform" in t && t.webkitTransform !== "none" || "mixBlendMode" in t && t.mixBlendMode !== "normal" || "filter" in t && t.filter !== "none" || "webkitFilter" in t && t.webkitFilter !== "none" || "isolation" in t && t.isolation === "isolate" || _c.test(t.willChange) || t.webkitOverflowScrolling === "touch");
}
function gr(e) {
  let t = e.length;
  for (; t--; ) {
    const n = e[t];
    if (X(n, "Missing node"), Lc(n)) return n;
  }
  return null;
}
function br(e) {
  return e && Number(getComputedStyle(e).zIndex) || 0;
}
function yr(e) {
  const t = [];
  for (; e; )
    t.push(e), e = yo(e);
  return t;
}
function yo(e) {
  const { parentNode: t } = e;
  return kc(t) ? t.host : t;
}
function Cc(e, t) {
  return e.x < t.x + t.width && e.x + e.width > t.x && e.y < t.y + t.height && e.y + e.height > t.y;
}
function Dc({
  groupElement: e,
  hitRegion: t,
  pointerEventTarget: n
}) {
  if (!io(n) || n.contains(e) || e.contains(n))
    return !0;
  if (Ac(n, e) > 0) {
    let r = n;
    for (; r; ) {
      if (r.contains(e))
        return !0;
      if (Cc(r.getBoundingClientRect(), t))
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
    const a = lo(o), s = Mc(o.orientation, a, {
      x: e.clientX,
      y: e.clientY
    });
    s && s.distance.x <= 0 && s.distance.y <= 0 && Dc({
      groupElement: o.element,
      hitRegion: s.hitRegion.rect,
      pointerEventTarget: e.target
    }) && n.push(s.hitRegion);
  }), n;
}
function zc(e, t) {
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
  let f = 0;
  switch (a) {
    case "keyboard": {
      {
        const m = e < 0 ? d : u, v = n[m];
        X(
          v,
          `Panel constraints not found for index ${m}`
        );
        const {
          collapsedSize: y = 0,
          collapsible: w,
          minSize: P = 0
        } = v;
        if (w) {
          const p = c[m];
          if (X(
            p != null,
            `Previous layout not found for panel index ${m}`
          ), de(p, y)) {
            const S = P - p;
            ve(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
          }
        }
      }
      {
        const m = e < 0 ? u : d, v = n[m];
        X(
          v,
          `No panel constraints found for index ${m}`
        );
        const {
          collapsedSize: y = 0,
          collapsible: w,
          minSize: P = 0
        } = v;
        if (w) {
          const p = c[m];
          if (X(
            p != null,
            `Previous layout not found for panel index ${m}`
          ), de(p, P)) {
            const S = p - y;
            ve(S, Math.abs(e)) > 0 && (e = e < 0 ? 0 - S : S);
          }
        }
      }
      break;
    }
    default: {
      const m = e < 0 ? d : u, v = n[m];
      X(
        v,
        `Panel constraints not found for index ${m}`
      );
      const y = c[m], { collapsible: w, collapsedSize: P, minSize: p } = v;
      if (w && ve(y, p) < 0)
        if (e > 0) {
          const S = p - P, E = S / 2, _ = y + e;
          ve(_, p) < 0 && (e = ve(e, E) <= 0 ? 0 : S);
        } else {
          const S = p - P, E = 100 - S / 2, _ = y - e;
          ve(_, p) < 0 && (e = ve(100 + e, E) > 0 ? 0 : -S);
        }
      break;
    }
  }
  {
    const m = e < 0 ? 1 : -1;
    let v = e < 0 ? d : u, y = 0;
    for (; ; ) {
      const P = c[v];
      X(
        P != null,
        `Previous layout not found for panel index ${v}`
      );
      const p = et({
        overrideDisabledPanels: s,
        panelConstraints: n[v],
        prevSize: P,
        size: 100
      }) - P;
      if (y += p, v += m, v < 0 || v >= n.length)
        break;
    }
    const w = Math.min(Math.abs(e), Math.abs(y));
    e = e < 0 ? 0 - w : w;
  }
  {
    let m = e < 0 ? u : d;
    for (; m >= 0 && m < n.length; ) {
      const v = Math.abs(e) - Math.abs(f), y = c[m];
      X(
        y != null,
        `Previous layout not found for panel index ${m}`
      );
      const w = y - v, P = et({
        overrideDisabledPanels: s,
        panelConstraints: n[m],
        prevSize: y,
        size: w
      });
      if (!de(y, P) && (f += y - P, l[m] = P, f.toFixed(3).localeCompare(Math.abs(e).toFixed(3), void 0, {
        numeric: !0
      }) >= 0))
        break;
      e < 0 ? m-- : m++;
    }
  }
  if (zc(i, l))
    return o;
  {
    const m = e < 0 ? d : u, v = c[m];
    X(
      v != null,
      `Previous layout not found for panel index ${m}`
    );
    const y = v + f, w = et({
      overrideDisabledPanels: s,
      panelConstraints: n[m],
      prevSize: v,
      size: y
    });
    if (l[m] = w, !de(w, y)) {
      let P = y - w, p = e < 0 ? d : u;
      for (; p >= 0 && p < n.length; ) {
        const S = l[p];
        X(
          S != null,
          `Previous layout not found for panel index ${p}`
        );
        const E = S + P, _ = et({
          overrideDisabledPanels: s,
          panelConstraints: n[p],
          prevSize: S,
          size: E
        });
        if (de(S, _) || (P -= _ - S, l[p] = _), de(P, 0))
          break;
        e > 0 ? p-- : p++;
      }
    }
  }
  const h = Object.values(l).reduce(
    (m, v) => v + m,
    0
  );
  if (!de(h, 100, 0.1))
    return o;
  const g = Object.keys(o);
  return l.reduce((m, v, y) => (m[g[y]] = v, m), {});
}
function Be(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (t[n] === void 0 || ve(e[n], t[n]) !== 0)
      return !1;
  return !0;
}
function Ue({
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
function vo({
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
    const f = a(), h = l.findIndex((v) => v.id === t), g = h === 0, m = h === l.length - 1;
    if (m && i < f && (g || l.slice(0, h).every((v, y) => {
      const w = d[y];
      return (w == null ? void 0 : w.collapsible) && de(w.collapsedSize, u[w.panelId]);
    }))) {
      const v = l.slice(0, h).reduce((y, w) => y + u[w.id], 0);
      return {
        ...u,
        [t]: fe(100 - v)
      };
    }
    return gt({
      delta: m ? f - i : i - f,
      initialLayout: u,
      panelConstraints: d,
      pivotIndices: m ? [h - 1, h] : [h, h + 1],
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
      separatorToPanels: m
    } = n(), v = s({
      nextSize: i,
      panels: f.panels,
      prevLayout: g,
      derivedPanelConstraints: d
    }), y = Ue({
      layout: v,
      panelConstraints: d
    });
    Be(g, y) || Me(f, {
      defaultLayoutDeferred: u,
      derivedPanelConstraints: d,
      groupSize: h,
      layout: y,
      separatorToPanels: m
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
      return i && de(l, u);
    },
    resize: (i) => {
      const { group: l } = n(), { element: u } = o(), d = ot({ group: l }), f = dt({
        groupSize: d,
        panelElement: u,
        styleProp: i
      }), h = fe(f / d * 100);
      c(h);
    }
  };
}
function vr(e) {
  if (e.defaultPrevented)
    return;
  const t = We();
  Mn(e, t).forEach((n) => {
    if (n.separator && !n.separator.disableDoubleClick) {
      const r = n.panels.find(
        (o) => o.panelConstraints.defaultSize !== void 0
      );
      if (r) {
        const o = r.panelConstraints.defaultSize, a = vo({
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
function So({
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
      } = t(), l = Ue({
        layout: n,
        panelConstraints: o
      });
      return r ? c : (Be(c, l) || Me(a, {
        defaultLayoutDeferred: r,
        derivedPanelConstraints: o,
        groupSize: s,
        layout: l,
        separatorToPanels: i
      }), l);
    }
  };
}
function ze(e, t) {
  const n = kt(e), r = Ce(n.id, !0), o = n.separators.find(
    (u) => u.element === e
  );
  X(o, "Matching separator not found");
  const a = r.separatorToPanels.get(o);
  X(a, "Matching panels not found");
  const s = a.map((u) => n.panels.indexOf(u)), c = So({ groupId: n.id }).getLayout(), i = gt({
    delta: t,
    initialLayout: c,
    panelConstraints: r.derivedPanelConstraints,
    pivotIndices: s,
    prevLayout: c,
    trigger: "keyboard"
  }), l = Ue({
    layout: i,
    panelConstraints: r.derivedPanelConstraints
  });
  Be(c, l) || Me(
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
function Sr(e) {
  if (e.defaultPrevented)
    return;
  const t = e.currentTarget, n = kt(t);
  if (!n.disabled)
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault(), n.orientation === "vertical" && ze(t, 5);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault(), n.orientation === "horizontal" && ze(t, -5);
        break;
      }
      case "ArrowRight": {
        e.preventDefault(), n.orientation === "horizontal" && ze(t, 5);
        break;
      }
      case "ArrowUp": {
        e.preventDefault(), n.orientation === "vertical" && ze(t, -5);
        break;
      }
      case "End": {
        e.preventDefault(), ze(t, 100);
        break;
      }
      case "Enter": {
        e.preventDefault();
        const r = kt(t), o = Ce(r.id, !0), { derivedPanelConstraints: a, layout: s, separatorToPanels: c } = o, i = r.separators.find(
          (f) => f.element === t
        );
        X(i, "Matching separator not found");
        const l = c.get(i);
        X(l, "Matching panels not found");
        const u = l[0], d = a.find(
          (f) => f.panelId === u.id
        );
        if (X(d, "Panel metadata not found"), d.collapsible) {
          const f = s[u.id], h = d.collapsedSize === f ? r.mutableState.expandedPanelSizes[u.id] ?? d.minSize : d.collapsedSize;
          ze(t, h - f);
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
        e.preventDefault(), ze(t, -100);
        break;
      }
    }
}
function wr(e) {
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
function wo({
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
    let m = 0;
    a ? f === "horizontal" ? m = (t.clientX - a.x) / d * 100 : m = (t.clientY - a.y) / d * 100 : f === "horizontal" ? m = t.clientX < 0 ? -100 : 100 : m = t.clientY < 0 ? -100 : 100;
    const v = r.get(u), y = o.get(u);
    if (!v || !y)
      return;
    const {
      defaultLayoutDeferred: w,
      derivedPanelConstraints: P,
      groupSize: p,
      layout: S,
      separatorToPanels: E
    } = y;
    if (P && S && E) {
      const _ = gt({
        delta: m,
        initialLayout: v,
        panelConstraints: P,
        pivotIndices: l.panels.map((O) => h.indexOf(O)),
        prevLayout: S,
        trigger: "mouse-or-touch"
      });
      if (Be(_, S)) {
        if (m !== 0 && !g)
          switch (f) {
            case "horizontal": {
              c |= m < 0 ? fo : mo;
              break;
            }
            case "vertical": {
              c |= m < 0 ? ho : po;
              break;
            }
          }
      } else
        Me(l.group, {
          defaultLayoutDeferred: w,
          derivedPanelConstraints: P,
          groupSize: p,
          layout: _,
          separatorToPanels: E
        });
    }
  });
  let i = 0;
  t.movementX === 0 ? i |= s & ur : i |= c & ur, t.movementY === 0 ? i |= s & dr : i |= c & dr, Rc(i), Tn(e);
}
function Pr(e) {
  const t = We(), n = je();
  switch (n.state) {
    case "active":
      wo({
        document: e.currentTarget,
        event: e,
        hitRegions: n.hitRegions,
        initialLayoutMap: n.initialLayoutMap,
        mountedGroups: t,
        prevCursorFlags: n.cursorFlags
      });
  }
}
function Rr(e) {
  var r, o;
  if (e.defaultPrevented)
    return;
  const t = je(), n = We();
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
      wo({
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
      }), Tn(e.currentTarget);
      break;
    }
  }
}
function Ir(e) {
  if (e.relatedTarget instanceof HTMLIFrameElement)
    switch (je().state) {
      case "hover":
        nt({
          cursorFlags: 0,
          state: "inactive"
        });
    }
}
function Tr(e) {
  e.defaultPrevented || e.pointerType === "mouse" && e.button > 0 || bo(e.currentTarget) && e.preventDefault();
}
function Er(e) {
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
function xc(e, t, n) {
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
function Oc(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length)
    return !1;
  for (const n in e)
    if (e[n] !== t[n])
      return !1;
  return !0;
}
function Fc({
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
        const h = f / 100 * n, g = fe(
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
      u[d] = fe(
        f / a * l
      );
    }
  else {
    const d = fe(
      l / i.length
    );
    for (const f of i)
      u[f] = d;
  }
  return u;
}
function $c(e, t) {
  const n = e.map((o) => o.id), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (const o of n)
    if (!r.includes(o))
      return !1;
  return !0;
}
const Ye = /* @__PURE__ */ new Map();
function jc(e) {
  let t = !0;
  X(
    e.element.ownerDocument.defaultView,
    "Cannot register an unmounted Group"
  );
  const n = e.element.ownerDocument.defaultView.ResizeObserver, r = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set(), a = new n((g) => {
    for (const m of g) {
      const { borderBoxSize: v, target: y } = m;
      if (y === e.element) {
        if (t) {
          const w = ot({ group: e });
          if (w === 0)
            return;
          const P = Ce(e.id);
          if (!P)
            return;
          const p = cn(e), S = P.defaultLayoutDeferred ? Er(p) : P.layout, E = Fc({
            group: e,
            nextGroupSize: w,
            prevGroupSize: P.groupSize,
            prevLayout: S
          }), _ = Ue({
            layout: E,
            panelConstraints: p
          });
          if (!P.defaultLayoutDeferred && Be(P.layout, _) && Oc(
            P.derivedPanelConstraints,
            p
          ) && P.groupSize === w)
            return;
          Me(e, {
            defaultLayoutDeferred: !1,
            derivedPanelConstraints: p,
            groupSize: w,
            layout: _,
            separatorToPanels: P.separatorToPanels
          });
        }
      } else
        xc(e, y, v);
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
  l && ($c(e.panels, l) || (l = void 0));
  const u = e.mutableState.layouts[i] ?? l ?? Er(c), d = Ue({
    layout: u,
    panelConstraints: c
  }), f = e.element.ownerDocument;
  Ye.set(
    f,
    (Ye.get(f) ?? 0) + 1
  );
  const h = /* @__PURE__ */ new Map();
  return lo(e).forEach((g) => {
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
    ), o.add(g.id), g.element.addEventListener("keydown", Sr);
  }), Ye.get(f) === 1 && (f.addEventListener("contextmenu", pr, !0), f.addEventListener("dblclick", vr, !0), f.addEventListener("pointerdown", wr, !0), f.addEventListener("pointerleave", Pr), f.addEventListener("pointermove", Rr), f.addEventListener("pointerout", Ir), f.addEventListener("pointerup", Tr, !0)), function() {
    t = !1, Ye.set(
      f,
      Math.max(0, (Ye.get(f) ?? 0) - 1)
    ), Ec(e), e.separators.forEach((g) => {
      g.element.removeEventListener("keydown", Sr);
    }), Ye.get(f) || (f.removeEventListener(
      "contextmenu",
      pr,
      !0
    ), f.removeEventListener(
      "dblclick",
      vr,
      !0
    ), f.removeEventListener(
      "pointerdown",
      wr,
      !0
    ), f.removeEventListener("pointerleave", Pr), f.removeEventListener("pointermove", Rr), f.removeEventListener("pointerout", Ir), f.removeEventListener("pointerup", Tr, !0)), a.disconnect();
  };
}
function Bc() {
  const [e, t] = N({}), n = $(() => t({}), []);
  return [e, n];
}
function kn(e) {
  const t = Lr();
  return `${e ?? t}`;
}
const Ve = typeof window < "u" ? ke : x;
function ft(e) {
  const t = k(e);
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
function An(...e) {
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
  const t = k({ ...e });
  return Ve(() => {
    for (const n in e)
      t.current[n] = e[n];
  }, [e]), t.current;
}
const Po = hn(null);
function Uc(e, t) {
  const n = k({
    getLayout: () => ({}),
    setLayout: Ic
  });
  gn(t, () => n.current, []), Ve(() => {
    Object.assign(
      n.current,
      So({ groupId: e })
    );
  });
}
function Ro({
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
  }), m = ft((R) => {
    Be(g.current.onLayoutChange, R) || (g.current.onLayoutChange = R, i == null || i(R));
  }), v = ft(
    (R, I) => {
      Be(g.current.onLayoutChanged, R) || (g.current.onLayoutChanged = R, l == null || l(R, { isUserInteraction: I }));
    }
  ), y = kn(c), w = k(null), [P, p] = Bc(), S = k({
    lastExpandedPanelSizes: {},
    layouts: {},
    panels: [],
    resizeTargetMinimumSize: d,
    separators: []
  }), E = An(w, a);
  Uc(y, s);
  const _ = ft(
    (R, I) => {
      const T = je(), M = hr(R), F = Ce(R);
      if (F) {
        let K = !1;
        switch (T.state) {
          case "active": {
            K = T.hitRegions.some(
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
      id: y,
      orientation: u,
      registerPanel: (R) => {
        const I = S.current;
        return I.panels = ln(u, [
          ...I.panels,
          R
        ]), p(), () => {
          I.panels = I.panels.filter(
            (T) => T !== R
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
            (T) => T !== R
          ), p();
        };
      },
      updatePanelProps: (R, { disabled: I }) => {
        const T = S.current.panels.find(
          (K) => K.id === R
        );
        T && (T.panelConstraints.disabled = I);
        const M = hr(y), F = Ce(y);
        M && F && Me(M, {
          ...F,
          derivedPanelConstraints: cn(M)
        });
      },
      updateSeparatorProps: (R, {
        disabled: I,
        disableDoubleClick: T
      }) => {
        const M = S.current.separators.find(
          (F) => F.id === R
        );
        M && (M.disabled = I, M.disableDoubleClick = T);
      }
    }),
    [_, y, p, u, O]
  ), C = k(null);
  return Ve(() => {
    const R = w.current;
    if (R === null)
      return;
    const I = S.current;
    let T;
    if (O.defaultLayout !== void 0 && Object.keys(O.defaultLayout).length === I.panels.length) {
      T = {};
      for (const V of I.panels) {
        const ne = O.defaultLayout[V.id];
        ne !== void 0 && (T[V.id] = ne);
      }
    }
    const M = {
      disabled: !!o,
      element: R,
      id: y,
      mutableState: {
        defaultLayout: T,
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
    const F = jc(M), { defaultLayoutDeferred: K, derivedPanelConstraints: D, layout: q } = Ce(M.id, !0);
    !K && D.length > 0 && (m(q), v(q, !1));
    const U = En(y, (V) => {
      const { defaultLayoutDeferred: ne, derivedPanelConstraints: me, layout: re } = V.next;
      if (ne || me.length === 0)
        return;
      const oe = M.panels.map(({ id: B }) => B).join(",");
      M.mutableState.layouts[oe] = re, me.forEach((B) => {
        if (B.collapsible) {
          const { layout: Z } = V.prev ?? {};
          if (Z) {
            const he = de(
              B.collapsedSize,
              re[B.panelId]
            ), ae = de(
              B.collapsedSize,
              Z[B.panelId]
            );
            he && !ae && (M.mutableState.expandedPanelSizes[B.panelId] = Z[B.panelId]);
          }
        }
      });
      const j = je().state !== "active";
      m(re), j && v(re, V.isUserInteraction);
    });
    return () => {
      C.current = null, F(), U();
    };
  }, [
    o,
    y,
    v,
    m,
    u,
    P,
    O
  ]), x(() => {
    const R = C.current;
    R && (R.mutableState.defaultLayout = n, R.mutableState.disableCursor = !!r);
  }), /* @__PURE__ */ b(Po.Provider, { value: L, children: /* @__PURE__ */ b(
    "div",
    {
      ...h,
      className: t,
      "data-group": !0,
      "data-testid": y,
      id: y,
      ref: E,
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
Ro.displayName = "Group";
function Nn() {
  const e = pn(Po);
  return X(
    e,
    "Group Context not found; did you render a Panel or Separator outside of a Group?"
  ), e;
}
function Hc(e, t) {
  const { id: n } = Nn(), r = k({
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
      vo({ groupId: n, panelId: e })
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
  panelRef: f,
  style: h,
  ...g
}) {
  const m = !!i, v = kn(i), y = _n({
    disabled: a
  }), w = k(null), P = An(w, s), {
    getPanelStyles: p,
    id: S,
    orientation: E,
    registerPanel: _,
    updatePanelProps: O
  } = Nn(), L = d !== null, C = ft(
    (M, F, K) => {
      d == null || d(M, i, K);
    }
  );
  Ve(() => {
    const M = w.current;
    if (M !== null) {
      const F = {
        element: M,
        id: v,
        idIsStable: m,
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
          disabled: y.disabled,
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
    m,
    l,
    u,
    C,
    _,
    y
  ]), x(() => {
    O(v, { disabled: a });
  }, [a, v, O]), Hc(v, f);
  const R = () => {
    const M = p(S, v);
    if (M)
      return JSON.stringify(M);
  }, I = Nr(
    (M) => En(S, M),
    R,
    R
  );
  let T;
  return I ? T = JSON.parse(I) : o !== void 0 ? T = {
    flexGrow: void 0,
    flexShrink: void 0,
    flexBasis: o
  } : T = { flexGrow: 1 }, /* @__PURE__ */ b(
    "div",
    {
      ...g,
      "data-disabled": a || void 0,
      "data-panel": !0,
      "data-testid": v,
      id: v,
      ref: P,
      style: {
        ...Wc,
        display: "flex",
        flexBasis: 0,
        flexShrink: 1,
        overflow: "visible",
        ...T
      },
      children: /* @__PURE__ */ b(
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
un.displayName = "Panel";
const Wc = {
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
function Vc({
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
    a = Ue({
      layout: gt({
        delta: l - s,
        initialLayout: e,
        panelConstraints: t,
        pivotIndices: u,
        prevLayout: e
      }),
      panelConstraints: t
    })[n], o = Ue({
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
function Io({
  children: e,
  className: t,
  disabled: n,
  disableDoubleClick: r,
  elementRef: o,
  id: a,
  style: s,
  ...c
}) {
  const i = kn(a), l = _n({
    disabled: n,
    disableDoubleClick: r
  }), [u, d] = N({}), [f, h] = N("inactive"), [g, m] = N(!1), v = k(null), y = An(v, o), {
    disableCursor: w,
    id: P,
    orientation: p,
    registerSeparator: S,
    updateSeparatorProps: E
  } = Nn(), _ = p === "horizontal" ? "vertical" : "horizontal";
  Ve(() => {
    const C = v.current;
    if (C !== null) {
      const R = {
        disabled: l.disabled,
        disableDoubleClick: l.disableDoubleClick,
        element: C,
        id: i
      }, I = S(R), T = Pc(
        (F) => {
          h(
            F.next.state !== "inactive" && F.next.hitRegions.some(
              (K) => K.separator === R
            ) ? F.next.state : "inactive"
          );
        }
      ), M = En(
        P,
        (F) => {
          const { derivedPanelConstraints: K, layout: D, separatorToPanels: q } = F.next, U = q.get(R);
          if (U) {
            const V = U[0], ne = U.indexOf(V);
            d(
              Vc({
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
        T(), M(), I();
      };
    }
  }, [P, i, S, l]), x(() => {
    E(i, { disabled: n, disableDoubleClick: r });
  }, [n, r, i, E]);
  let O;
  n && !w && (O = "not-allowed");
  let L;
  if (n)
    L = "disabled";
  else
    switch (f) {
      case "active": {
        L = "active";
        break;
      }
      default:
        g ? L = "focus" : L = f;
    }
  return /* @__PURE__ */ b(
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
      onBlur: () => m(!1),
      onFocus: () => m(!0),
      ref: y,
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
Io.displayName = "Separator";
const Ln = 30, Cn = 65, bt = 50, Jc = 100 - Cn, qc = 100 - Ln;
function Gc(e) {
  const t = Number(e);
  return Number.isFinite(t) ? Math.min(Cn, Math.max(Ln, t)) : bt;
}
function Dn(e) {
  return 100 - e;
}
function Xe(e) {
  return `${e}%`;
}
const zn = "reader-document", yt = "reader-assistant", To = "retainpdf.reader.ai-split-layout.v1", Kc = {
  [zn]: Dn(bt),
  [yt]: bt
};
function xn(e) {
  const t = Gc(e == null ? void 0 : e[yt]);
  return {
    [zn]: Dn(t),
    [yt]: t
  };
}
function Zc() {
  try {
    const e = JSON.parse(localStorage.getItem(To) || "null");
    return xn(e);
  } catch {
    return Kc;
  }
}
function Yc(e) {
  try {
    localStorage.setItem(To, JSON.stringify(xn(e)));
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
function Xc() {
  const e = k(null), [t] = N(Zc);
  ke(() => {
    const o = e.current;
    return Zt(o, t), () => {
      var a;
      (a = o == null ? void 0 : o.closest(".reader-react-root")) == null || a.style.removeProperty("--reader-ai-split-width");
    };
  }, [t]);
  const n = $((o) => {
    Zt(e.current, o);
  }, []), r = $((o, a) => {
    Zt(e.current, o), a.isUserInteraction && Yc(o);
  }, []);
  return /* @__PURE__ */ z(
    Ro,
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
        /* @__PURE__ */ b(
          un,
          {
            id: zn,
            defaultSize: Xe(Dn(bt)),
            minSize: Xe(Jc),
            maxSize: Xe(qc)
          }
        ),
        /* @__PURE__ */ b(
          Io,
          {
            id: "reader-ai-split-separator",
            className: "reader-ai-split-separator",
            "aria-label": "调整文档与 AI 问答宽度",
            children: /* @__PURE__ */ b("span", { "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ b(
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
function Qc({
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
    /* @__PURE__ */ b(
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
function el({
  loading: e,
  failed: t,
  text: n,
  percent: r,
  regionsError: o = !1,
  metadataError: a = !1
}) {
  return !e && !t ? /* @__PURE__ */ b(Qc, { regionsFailed: o, metadataFailed: a }) : /* @__PURE__ */ z(Ot, { children: [
    e ? /* @__PURE__ */ b("div", { className: "reader-boot-loading", "data-reader-boot-loading": "true", children: /* @__PURE__ */ z("div", { className: "reader-boot-loading-card", children: [
      /* @__PURE__ */ b("div", { className: "reader-boot-loading-text", children: n }),
      /* @__PURE__ */ b("div", { className: "reader-boot-loading-track", children: /* @__PURE__ */ b(
        "span",
        {
          className: "reader-boot-loading-bar",
          style: { width: `${Math.max(0, Math.min(100, r))}%` }
        }
      ) })
    ] }) }) : null,
    t ? /* @__PURE__ */ b("div", { className: "reader-react-error", role: "alert", children: n }) : null
  ] });
}
function tl(e) {
  if (!(e instanceof HTMLElement)) return !1;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || e.isContentEditable ? !0 : !!e.closest("input, textarea, select, [contenteditable='true']");
}
function nl() {
  const [e, t] = N(!1), n = Lr(), r = k(null);
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
      if (a.defaultPrevented || a.metaKey || a.ctrlKey || a.altKey || tl(a.target)) return;
      const s = a.key;
      if (s === "?" || s === "h" || s === "H" || s === "/") {
        if (s === "/" && !a.shiftKey)
          return;
        a.preventDefault(), t((c) => !c);
      }
    };
    return window.addEventListener("keydown", o), () => window.removeEventListener("keydown", o);
  }, []), /* @__PURE__ */ z("div", { className: "reader-react-shortcuts", ref: r, "data-reader-shortcuts": "", children: [
    /* @__PURE__ */ b(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-react-shortcuts-btn${e ? " is-active" : ""}`,
        "aria-label": "快捷键说明",
        "aria-expanded": e,
        "aria-controls": n,
        title: "快捷键（H 或 ?）",
        onClick: () => t((o) => !o),
        children: /* @__PURE__ */ b(Go, { className: "reader-react-shortcuts-icon", size: 16, strokeWidth: 2.25, "aria-hidden": !0 })
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
            /* @__PURE__ */ b("strong", { children: "快捷键" }),
            /* @__PURE__ */ b(
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
          /* @__PURE__ */ b("div", { className: "reader-react-shortcuts-body", children: si.map((o) => /* @__PURE__ */ z("section", { className: "reader-react-shortcuts-group", children: [
            /* @__PURE__ */ b("h3", { children: o.title }),
            /* @__PURE__ */ b("ul", { children: o.items.map((a) => /* @__PURE__ */ z("li", { children: [
              /* @__PURE__ */ b("kbd", { children: a.keys }),
              /* @__PURE__ */ b("span", { children: a.desc })
            ] }, `${o.title}-${a.keys}`)) })
          ] }, o.title)) }),
          /* @__PURE__ */ b("p", { className: "reader-react-shortcuts-foot", children: "在输入框内不会触发快捷键" })
        ]
      }
    ) : null
  ] });
}
const rl = ["source", "sideBySide", "translated"], ol = { source: "", translated: "", sideBySide: "" };
function al(e) {
  if (e.sourceOnly || !e.jobId) {
    const t = At(e.sourceUrl), n = At(e.translatedUrl);
    return {
      source: t,
      translated: n,
      // sideBySide requires dedicated artifact; no fallback to source url
      sideBySide: ""
    };
  }
  return pa({
    jobId: e.jobId,
    jobPayload: e.jobPayload,
    manifestPayload: e.manifestPayload
  });
}
function sl(e) {
  const [t, n] = N(() => /* @__PURE__ */ new Set()), r = Y(
    () => e ? al(e) : ol,
    [e]
  ), o = Y(
    () => rl.filter((s) => !(e != null && e.sourceOnly && s !== "source")),
    [e == null ? void 0 : e.sourceOnly]
  ), a = $(async (s) => {
    if (!e) return;
    const c = At(r[s]);
    if (!(!c || t.has(s)))
      try {
        const i = e.jobId ? ha(s, {
          jobId: e.jobId,
          jobPayload: e.jobPayload,
          manifestPayload: e.manifestPayload
        }) : `${e.sourceOnly ? "document" : "reader"}-${s}.pdf`;
        await ga(
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
        ba(l), n((u) => {
          const d = new Set(u);
          return d.delete(s), d;
        });
      }
  }, [r, t, e]);
  return { urls: r, downloadItems: o, busyActions: t, handleDownload: a };
}
const il = {
  source: Dr,
  sideBySide: zr,
  translated: xr
}, cl = {
  source: "原文",
  sideBySide: "对照",
  translated: "译文"
};
function ll(e) {
  const t = He(), n = e.download ?? (t == null ? void 0 : t.download), { urls: r, downloadItems: o, busyActions: a, handleDownload: s } = sl(n), c = k(null);
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
      /* @__PURE__ */ b(Ko, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ b("span", { className: "reader-download-trigger-label", children: "下载" }),
      /* @__PURE__ */ b(Zo, { size: 13, strokeWidth: 2.2, "aria-hidden": !0, className: "reader-download-trigger-caret" })
    ] }),
    /* @__PURE__ */ b("div", { className: "reader-download-menu", role: "group", "aria-label": "下载 PDF", children: o.map((i) => {
      const l = Lo[i], u = At(r[i]), d = a.has(i), f = !!u && !d, h = f ? "" : Co(i, r), g = il[i];
      return /* @__PURE__ */ z(
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
            /* @__PURE__ */ b(g, { size: 15, strokeWidth: 2.1, "aria-hidden": !0 }),
            /* @__PURE__ */ z("span", { className: "reader-download-action-text", children: [
              /* @__PURE__ */ z("span", { className: "reader-download-action-label", children: [
                cl[i],
                " PDF"
              ] }),
              h ? /* @__PURE__ */ b("span", { className: "reader-download-action-reason", children: h }) : null
            ] })
          ]
        },
        i
      );
    }) })
  ] });
}
const ul = "retainpdf:reader:bookmarks:v1:", dl = 200;
function On() {
  try {
    return typeof globalThis.localStorage > "u" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
function Eo(e) {
  const t = `${e || ""}`.trim();
  return t ? `${ul}${t}` : "";
}
function fl(e) {
  if (!e || typeof e != "object") return null;
  const t = e, n = Math.floor(Number(t.page));
  return !Number.isFinite(n) || n < 1 ? null : { page: n, label: `${t.label || ""}`.trim().slice(0, 120), createdAt: `${t.createdAt || ""}` };
}
function xt(e, t = On()) {
  const n = Eo(e);
  if (!n || !t) return [];
  try {
    const r = JSON.parse(t.getItem(n) || "[]"), o = /* @__PURE__ */ new Map();
    for (const a of Array.isArray(r) ? r : []) {
      const s = fl(a);
      s && !o.has(s.page) && o.set(s.page, s);
    }
    return [...o.values()].sort((a, s) => a.page - s.page);
  } catch {
    return [];
  }
}
function dn(e, t, n) {
  const r = Eo(e), o = [...t].sort((a, s) => a.page - s.page).slice(0, dl);
  if (!r || !n) return o;
  try {
    n.setItem(r, JSON.stringify(o));
  } catch {
  }
  return o;
}
function ml(e, t, n = "", { storage: r = On(), now: o = () => (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const a = xt(e, r), s = Math.floor(Number(t));
  return !Number.isFinite(s) || s < 1 ? a : a.some((c) => c.page === s) ? dn(e, a.filter((c) => c.page !== s), r) : dn(e, [...a, { page: s, label: `${n || ""}`.trim().slice(0, 120), createdAt: o() }], r);
}
function hl(e, t, n = On()) {
  return dn(e, xt(e, n).filter((r) => r.page !== t), n);
}
function pl(e, t) {
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
function gl({ filled: e }) {
  return /* @__PURE__ */ b("svg", { viewBox: "0 0 24 24", width: "15", height: "15", "aria-hidden": "true", fill: e ? "currentColor" : "none", children: /* @__PURE__ */ b("path", { d: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1z", stroke: "currentColor", strokeWidth: "1.7", strokeLinejoin: "round" }) });
}
function bl({ scope: e, currentPage: t, numPages: n, regions: r, onGoToPage: o }) {
  const [a, s] = N(() => xt(e)), [c, i] = N(!1), l = k(null);
  if (x(() => {
    s(xt(e)), i(!1);
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
  return /* @__PURE__ */ z("div", { className: "reader-react-hud-group reader-bookmarks", "aria-label": "书签", ref: l, children: [
    /* @__PURE__ */ b(
      "button",
      {
        type: "button",
        className: `reader-react-hud-btn reader-bookmark-toggle${d ? " is-marked" : ""}`,
        "aria-pressed": d,
        "aria-label": d ? `取消第 ${u} 页的书签` : `给第 ${u} 页加书签`,
        title: d ? "取消这一页的书签" : "给这一页加书签",
        onClick: () => s(ml(e, u, pl(r, u))),
        children: /* @__PURE__ */ b(gl, { filled: d })
      }
    ),
    /* @__PURE__ */ b(
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
    c && a.length ? /* @__PURE__ */ b("div", { className: "reader-bookmark-popover", role: "dialog", "aria-label": "书签", children: /* @__PURE__ */ b("ol", { className: "reader-bookmark-list", children: a.map((f) => /* @__PURE__ */ z("li", { className: f.page === u ? "is-current" : "", children: [
      /* @__PURE__ */ z(
        "button",
        {
          type: "button",
          className: "reader-bookmark-jump",
          onClick: () => {
            o == null || o(Math.min(f.page, n)), i(!1);
          },
          children: [
            /* @__PURE__ */ z("span", { className: "reader-bookmark-page", children: [
              "第 ",
              f.page,
              " 页"
            ] }),
            f.label ? /* @__PURE__ */ b("span", { className: "reader-bookmark-label", children: f.label }) : null
          ]
        }
      ),
      /* @__PURE__ */ b(
        "button",
        {
          type: "button",
          className: "reader-bookmark-remove",
          "aria-label": `删除第 ${f.page} 页的书签`,
          onClick: () => s(hl(e, f.page)),
          children: "×"
        }
      )
    ] }, f.page)) }) }) : null
  ] });
}
function yl(e) {
  const t = He(), n = ao(), { mode: r = "compare", modeControls: o } = e, a = e.userZoom ?? (t == null ? void 0 : t.userZoom) ?? vt, s = e.onZoomChange ?? (t == null ? void 0 : t.onZoomChange) ?? (() => {
  }), c = e.currentPage ?? (n == null ? void 0 : n.currentPage) ?? 1, i = e.numPages ?? (n == null ? void 0 : n.numPages) ?? 0, l = e.onGoToPage ?? (t == null ? void 0 : t.goToPage), u = is(a), d = a > jr + 1e-3, f = a < Dt - 1e-3, h = Qe(r, Fe()), g = h >= Dt ? "100%（铺满阅读区）" : "50%（半屏，对照铺满）", [m, v] = N(!1), [y, w] = N(`${c}`);
  x(() => {
    m || w(`${Math.min(Math.max(c, 1), Math.max(i, 1))}`);
  }, [c, i, m]);
  const P = () => {
    if (v(!1), !l || i <= 0)
      return;
    const p = Number(`${y}`.trim());
    l(zt(p, i));
  };
  return /* @__PURE__ */ z("div", { className: "reader-react-hud", "data-reader-hud": "true", children: [
    o ? /* @__PURE__ */ b("div", { className: "reader-react-hud-group reader-react-hud-modes", children: o }) : null,
    /* @__PURE__ */ b("div", { className: "reader-react-hud-group", "aria-label": "页码", children: m ? /* @__PURE__ */ z(
      "form",
      {
        className: "reader-react-hud-page-form",
        onSubmit: (p) => {
          p.preventDefault(), P();
        },
        children: [
          /* @__PURE__ */ b(
            "input",
            {
              className: "reader-react-hud-page-input",
              type: "text",
              inputMode: "numeric",
              pattern: "[0-9]*",
              "aria-label": "跳转到页码",
              value: y,
              autoFocus: !0,
              onChange: (p) => w(p.target.value.replace(/[^\d]/g, "")),
              onBlur: P,
              onKeyDown: (p) => {
                p.key === "Escape" && (p.preventDefault(), v(!1), w(`${c}`));
              }
            }
          ),
          /* @__PURE__ */ z("span", { className: "reader-react-hud-page-suffix", children: [
            "/ ",
            i || "—"
          ] })
        ]
      }
    ) : /* @__PURE__ */ b(
      "button",
      {
        type: "button",
        className: "reader-react-hud-page reader-react-hud-page-btn",
        "aria-label": i > 0 ? `跳转页码，当前第 ${c} 页，共 ${i} 页` : "页码",
        title: i > 0 ? "点击输入页码跳转" : void 0,
        disabled: !l || i <= 0,
        onClick: () => {
          !l || i <= 0 || (w(`${c}`), v(!0));
        },
        children: i > 0 ? `${Math.min(c, i)} / ${i}` : "—"
      }
    ) }),
    e.bookmarkScope ? /* @__PURE__ */ b(
      bl,
      {
        scope: e.bookmarkScope,
        currentPage: c,
        numPages: i,
        regions: t == null ? void 0 : t.regions,
        onGoToPage: l
      }
    ) : null,
    /* @__PURE__ */ z("div", { className: "reader-react-hud-group", "aria-label": "缩放", children: [
      /* @__PURE__ */ b(
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
      /* @__PURE__ */ b(
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
    /* @__PURE__ */ b("div", { className: "reader-react-hud-group reader-react-hud-help", "aria-label": "帮助", children: /* @__PURE__ */ b(nl, {}) })
  ] });
}
function Mr(e) {
  var t, n;
  return Wr(e == null ? void 0 : e.assistantPanel) ? e.assistantPanel : ((t = e == null ? void 0 : e.splitLayout) == null ? void 0 : t.left) === "markdown" || ((n = e == null ? void 0 : e.splitLayout) == null ? void 0 : n.right) === "markdown" ? "markdown" : null;
}
function vl(e) {
  const [t, n] = N(() => ({
    scope: e,
    panel: Mr(we(e))
  }));
  x(() => {
    n((o) => o.scope === e ? o : {
      scope: e,
      panel: Mr(we(e))
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
function Sl({
  title: e = "下载中",
  status: t = "正在准备...",
  meta: n = "等待响应...",
  percent: r = NaN,
  tone: o = "progress"
}) {
  const a = Number.isFinite(r) ? Math.max(4, Math.min(100, Number(r) || 0)) : 18;
  return /* @__PURE__ */ z("div", { className: "download-toast-card reader-floating-surface", "data-tone": o, "aria-live": "polite", children: [
    /* @__PURE__ */ z("div", { className: "download-toast-head", children: [
      /* @__PURE__ */ b("div", { id: "download-toast-title", className: "download-toast-title", children: e }),
      /* @__PURE__ */ b("div", { id: "download-toast-status", className: "download-toast-status", children: t })
    ] }),
    /* @__PURE__ */ b("div", { className: "download-toast-track", children: /* @__PURE__ */ b("span", { id: "download-toast-bar", className: "download-toast-bar", style: { width: `${a}%` } }) }),
    /* @__PURE__ */ b("div", { id: "download-toast-meta", className: "download-toast-meta", children: n })
  ] });
}
function wl(e = {}) {
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
    () => /* @__PURE__ */ b(Sl, { title: n, status: r, meta: o, percent: a, tone: s }),
    { id: fn, duration: 1 / 0 }
  );
}
function Pl() {
  const e = $((t) => {
    t && (t.setState = wl, t.hide = () => Xt.dismiss(fn));
  }, []);
  return /* @__PURE__ */ z(Ot, { children: [
    /* @__PURE__ */ b(Vo, { position: "bottom-right" }),
    /* @__PURE__ */ b("download-toast", { style: { display: "none" }, "aria-hidden": "true", ref: e })
  ] });
}
function Rl(e) {
  return e.sourceViewOnly ? { mode: "source", auto: !1 } : e.savedMode ? { mode: e.savedMode, auto: !1 } : Br(e.viewportWidth) ? { mode: "translated", auto: !0 } : { mode: null, auto: !1 };
}
function Il(e, t) {
  return t === null || e !== t;
}
function Tl(e) {
  const t = k(!1);
  return e && (t.current = !0), t.current;
}
function El(e, t) {
  const n = e === t;
  return { open: n, mounted: Tl(n) };
}
const kr = { itemId: null, origin: null };
function Ml() {
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
const Oe = (e) => `${e ?? ""}`.replace(/\s+/gu, " ").trim(), kl = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉", "+": "₊", "-": "₋" }, Al = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" }, _l = {
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
}, Ar = (e, t) => [...e].every((n) => n in t) ? [...e].map((n) => t[n]).join("") : e;
function Nl(e) {
  return e.replace(
    /\$([^$]+)\$/gu,
    (t, n) => n.replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\{([^{}]*)\}/gu, "$1").replace(/_\{([^{}]*)\}|_(\w)/gu, (r, o, a) => Ar(o ?? a ?? "", kl)).replace(/\^\{([^{}]*)\}|\^(\w)/gu, (r, o, a) => Ar(o ?? a ?? "", Al)).replace(/\\([a-zA-Z]+)/gu, (r, o) => _l[o] ?? "").replace(/[{}]/gu, "").trim()
  ).replace(/\s+/gu, " ").trim();
}
function Ll(e) {
  return Oe(e.translatedBlockText) || Oe(e.translated.text) || Oe(e.source.text);
}
const Cl = (e) => !!e.headingLevel || e.subType === "title" || e.subType === "heading";
function Dl(e) {
  const t = [];
  for (const n of e) {
    if (!Cl(n)) continue;
    const r = Nl(Ll(n)), o = Number(n.source.page);
    if (!r || !Number.isFinite(o) || o < 1) continue;
    const a = t[t.length - 1];
    a && a.text === r && a.page === o || t.push({ itemId: n.itemId, level: n.headingLevel && n.headingLevel > 1 ? 2 : 1, page: o, text: r });
  }
  return t;
}
function zl(e, t) {
  let n = -1;
  for (let r = 0; r < e.length && e[r].page <= t; r += 1)
    n = r;
  return n;
}
const xl = 24, Ol = 60;
function _r(e, t) {
  const n = e.toLowerCase().indexOf(t);
  if (n < 0) return null;
  const r = Math.max(0, n - xl), o = Math.min(e.length, n + t.length + Ol), a = r > 0 ? "…" : "";
  return { snippet: `${a}${e.slice(r, o)}${o < e.length ? "…" : ""}`, at: a.length + n - r, length: t.length };
}
function Fl(e, t, n = 200) {
  const r = Oe(t).toLowerCase();
  if (!r) return [];
  const o = [];
  for (const a of e) {
    const s = Number(a.source.page);
    if (!Number.isFinite(s) || s < 1) continue;
    const c = Oe(a.translatedBlockText) || Oe(a.translated.text), i = c ? _r(c, r) : null, l = i ?? _r(Oe(a.source.text), r);
    if (l && (o.push({ itemId: a.itemId, page: s, side: i ? "translated" : "source", ...l }), o.length >= n))
      break;
  }
  return o;
}
const $l = [];
function jl({ open: e, onToggle: t }) {
  return /* @__PURE__ */ z("div", { className: "reader-finder-toggles", children: [
    /* @__PURE__ */ z(xe, { className: "reader-finder-toggle", "aria-pressed": e === "outline", title: "目录", onClick: () => t("outline"), children: [
      /* @__PURE__ */ b(Yo, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ b("span", { children: "目录" })
    ] }),
    /* @__PURE__ */ z(xe, { className: "reader-finder-toggle", "aria-pressed": e === "search", title: "在书里搜索（原文和译文）", onClick: () => t("search"), children: [
      /* @__PURE__ */ b(Xo, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }),
      /* @__PURE__ */ b("span", { children: "搜索" })
    ] })
  ] });
}
function Bl({
  tab: e,
  onTab: t,
  onClose: n,
  onJump: r
}) {
  var h, g;
  const o = ((h = He()) == null ? void 0 : h.regions) ?? $l, a = ((g = ao()) == null ? void 0 : g.currentPage) ?? 1, s = Y(() => Dl(o), [o]), c = zl(s, a), [i, l] = N(""), u = Y(() => Fl(o, i), [o, i]), d = k(null), f = k(null);
  return x(() => {
    var m, v, y;
    e === "search" ? (m = d.current) == null || m.focus() : (y = (v = f.current) == null ? void 0 : v.querySelector('[aria-current="location"]')) == null || y.scrollIntoView({ block: "center" });
  }, [e]), /* @__PURE__ */ z("aside", { className: "reader-finder", "aria-label": e === "outline" ? "目录" : "搜索", children: [
    /* @__PURE__ */ z("header", { className: "reader-finder-head", children: [
      /* @__PURE__ */ z("div", { className: "reader-finder-tabs", role: "tablist", children: [
        /* @__PURE__ */ b(xe, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "outline", onClick: () => t("outline"), children: "目录" }),
        /* @__PURE__ */ b(xe, { className: "reader-finder-tab", role: "tab", "aria-selected": e === "search", onClick: () => t("search"), children: "搜索" })
      ] }),
      /* @__PURE__ */ b(xe, { className: "reader-finder-close", "aria-label": "收起", title: "收起", onClick: n, children: /* @__PURE__ */ b(vn, { size: 16, strokeWidth: 2.1, "aria-hidden": !0 }) })
    ] }),
    e === "outline" ? s.length ? /* @__PURE__ */ b("ol", { ref: f, className: "reader-finder-list", children: s.map((m, v) => /* @__PURE__ */ b("li", { children: /* @__PURE__ */ z(
      xe,
      {
        className: "reader-finder-entry",
        "data-level": m.level,
        "aria-current": v === c ? "location" : void 0,
        onClick: () => r(m.itemId),
        children: [
          /* @__PURE__ */ b("span", { className: "reader-finder-entry-text", children: m.text }),
          /* @__PURE__ */ b("span", { className: "reader-finder-entry-page", children: m.page })
        ]
      }
    ) }, m.itemId)) }) : /* @__PURE__ */ b("p", { className: "reader-finder-empty", children: o.length ? "这本书没有认出标题。" : "这本书还没有段落数据。" }) : /* @__PURE__ */ z(Ot, { children: [
      /* @__PURE__ */ z("div", { className: "reader-finder-search", children: [
        /* @__PURE__ */ b(
          Qo,
          {
            ref: d,
            type: "search",
            size: "sm",
            className: "reader-finder-input",
            placeholder: "原文、译文里的字",
            "aria-label": "在书里搜索",
            value: i,
            onChange: (m) => l(m.target.value),
            onKeyDown: (m) => {
              m.key === "Enter" && u[0] && r(u[0].itemId), m.stopPropagation();
            }
          }
        ),
        i.trim() ? /* @__PURE__ */ b("p", { className: "reader-finder-count", children: u.length >= 200 ? "200 处以上，只列前 200 处" : `${u.length} 处` }) : null
      ] }),
      /* @__PURE__ */ b("ol", { className: "reader-finder-list", children: u.map((m) => /* @__PURE__ */ b("li", { children: /* @__PURE__ */ z(xe, { className: "reader-finder-entry is-hit", onClick: () => r(m.itemId), children: [
        /* @__PURE__ */ z("span", { className: "reader-finder-entry-text", children: [
          m.snippet.slice(0, m.at),
          /* @__PURE__ */ b("mark", { children: m.snippet.slice(m.at, m.at + m.length) }),
          m.snippet.slice(m.at + m.length)
        ] }),
        /* @__PURE__ */ b("span", { className: "reader-finder-entry-page", children: m.page })
      ] }) }, m.itemId)) })
    ] })
  ] });
}
const Ul = Ao(() => import("./ReaderMarkdownPanel-Dj5AtHH0.js").then((e) => ({ default: e.ReaderMarkdownPanel })));
function Hl(e) {
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
function Wl(e, t) {
  return e === "compare" ? t ? !0 : null : !1;
}
function Vl() {
  const e = oi(), { boot: t, panes: n, sessionFiles: r, session: o } = e, a = vl(e.viewStateKey), s = a.panel, c = a.setPanel, [i, l] = N(null), [u, d] = N(!1), f = k(null), h = k(null), g = s !== null, m = e.liveTranslationAvailable || e.liveTranslation.pagesByPage.size > 0, v = Hl({
    mode: e.mode,
    sourceOnly: e.sourceOnly,
    translatedUrl: r.translatedUrl,
    overlayContentAvailable: m,
    liveTranslationVisible: u,
    assistantOpen: g,
    assistantPdfPane: i
  }), y = Ks({
    hasOverlayContent: m,
    connection: e.liveTranslation.connection,
    showSource: v.showSource,
    liveTranslationVisible: u,
    assistantOpen: g
  }), w = v.sourceViewOnly, P = v.visibleMode;
  x(() => {
    d(!1);
  }, [e.viewStateKey]), x(() => {
    e.session.jobTerminal && d(!1);
  }, [e.session.jobTerminal]), x(() => {
    l(null);
  }, [a.scope]), x(() => {
    if (!(t.loading || t.failed)) {
      if (f.current !== e.viewStateKey) {
        f.current = e.viewStateKey;
        const U = we(e.viewStateKey), V = Rl({
          savedMode: U == null ? void 0 : U.mode,
          sourceViewOnly: w,
          viewportWidth: Fe()
        });
        h.current = V.auto ? V.mode : null, V.mode && V.mode !== e.mode && e.setModeKeepingPage(V.mode);
        return;
      }
      Il(e.mode, h.current) && (h.current = null, jt(e.viewStateKey, { mode: e.mode }));
    }
  }, [t.failed, t.loading, e.mode, e.setModeKeepingPage, e.viewStateKey, w]);
  const p = s || (e.mode === "compare" ? "compare" : "reading"), S = El(s, "markdown");
  di({
    mode: P,
    sourceOnly: e.sourceOnly,
    setMode: e.setModeKeepingPage,
    userZoom: e.userZoom,
    onZoomChange: e.onZoomChange,
    currentPage: e.currentPage,
    numPages: n.hudNumPages,
    goToPage: e.goToPage,
    enabled: e.showHud
  });
  const E = $(() => {
    c(null), l(null);
  }, []), _ = $((U) => {
    l(null);
    const V = Wl(U, e.liveTranslationAvailable);
    V !== null && d(V), e.setModeKeepingPage(U);
  }, [e.liveTranslationAvailable, e.setModeKeepingPage]), O = Y(() => y.sourcePaneToggle ? /* @__PURE__ */ b(
    "button",
    {
      type: "button",
      className: `reader-live-translation-toggle${u ? " is-active" : ""}`,
      onClick: () => d((U) => !U),
      "aria-pressed": u,
      title: u ? "隐藏实时译文" : "在原文 PDF 上叠加实时译文",
      children: "译文"
    }
  ) : null, [y.sourcePaneToggle, u]), L = $((U) => {
    c(U), l(null);
  }, []), [C] = N(Ml), [R, I] = N(null), T = $((U) => I((V) => V === U ? null : U), []), M = $((U) => {
    e.jumpToAnchor({ block_id: U }), Fe() < 900 && I(null);
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
    sourceViewOnly: w,
    download: e.download,
    goToPage: e.goToPage,
    assistant: { select: L, close: E }
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
    w,
    e.download,
    e.goToPage,
    L,
    E
  ]), D = Y(() => ({
    currentPage: e.currentPage,
    numPages: n.hudNumPages
  }), [e.currentPage, n.hudNumPages]), q = [
    Xa,
    `is-workspace-${p}`,
    g ? "is-assistant-open" : "",
    R ? "is-finder-open" : "",
    v.overlayOnSource ? "is-live-translation-overlay" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ b($i, { value: K, hud: D, children: /* @__PURE__ */ z("div", { className: q, "data-reader-engine": "react-pdf", "data-reader-workspace": p, children: [
    /* @__PURE__ */ b(el, { loading: t.loading, failed: t.failed, text: t.text, percent: t.percent, regionsError: !!o.readerErrors.regions, metadataError: !!o.readerErrors.metadata }),
    /* @__PURE__ */ b(jl, { open: R, onToggle: T }),
    R ? /* @__PURE__ */ b(
      Bl,
      {
        tab: R,
        onTab: I,
        onClose: () => I(null),
        onJump: M
      }
    ) : null,
    /* @__PURE__ */ z("div", { className: "reader-chrome-tray", children: [
      /* @__PURE__ */ b(ll, {}),
      /* @__PURE__ */ b(yi, { onBeforeClose: o.prepareClose })
    ] }),
    /* @__PURE__ */ b(
      cc,
      {
        mode: P,
        documentReady: !!o.jobId,
        sourceViewOnly: w,
        onModeChange: _,
        liveTranslation: y.topBarPill ? {
          visible: u,
          state: e.liveTranslation,
          onToggle: () => d((U) => !U)
        } : null
      }
    ),
    /* @__PURE__ */ b(fc, { active: s }),
    g ? /* @__PURE__ */ b(Xc, {}) : null,
    /* @__PURE__ */ b(oc, { paneComposition: v, markdownSplit: S.open, assistantSplit: g, liveTranslation: e.liveTranslation, sourcePaneAction: O }),
    e.showHud ? /* @__PURE__ */ b(
      yl,
      {
        mode: P,
        modeControls: null,
        bookmarkScope: e.viewStateKey
      }
    ) : null,
    /* @__PURE__ */ b(ko, { fallback: null, children: S.mounted ? /* @__PURE__ */ b(Ul, { open: S.open, jobId: o.jobId, sourceOnly: e.sourceOnly, side: "right", onClose: E }) : null }),
    /* @__PURE__ */ b(Pl, {})
  ] }) });
}
function uu() {
  return /* @__PURE__ */ b(Vl, {});
}
export {
  uu as R,
  Vl as a,
  cu as d,
  iu as f,
  lu as r,
  He as u
};
//# sourceMappingURL=ReaderApp-DtI52moE.js.map
